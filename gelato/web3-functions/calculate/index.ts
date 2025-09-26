import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import {
  Address,
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
} from "viem";
import { polygon, polygonAmoy } from "viem/chains";

const abi = parseAbi([
  "function calculateProfit(uint256 offset, uint256 count) external",
  "function currentPool() external view returns(address)",
  "function distributeProfit() external",
  "function getActivePoolCount() external view returns(uint256)",
  "function getCurrentCycle() external view returns (uint256)"
]);

// Get current cycle with fallback logic
async function getCurrentCycle(client: any, stakingAddress: Address): Promise<bigint> {
  try {
    // Try Dynamic staking's getCurrentCycle() (4-week cycles)
    return await client.readContract({
      address: stakingAddress,
      abi: abi,
      functionName: "getCurrentCycle",
      args: [],
    });
  } catch (error) {
    // Fallback to Conservative staking weekly cycles (block.timestamp / SECONDS_IN_WEEK)
    return BigInt(Math.floor(Date.now() / 1000 / (7 * 24 * 60 * 60)));
  }
}

// Get progress from storage with cycle-based reset
async function getProgress(storage: any, currentCycle: bigint) {
  const storageData = await storage.get("calculateProgress");
  let lastProcessed = 0;
  let storedCycle = BigInt(0);
  
  if (storageData) {
    const parsed = JSON.parse(storageData);
    lastProcessed = parsed.lastProcessed || 0;
    storedCycle = BigInt(parsed.cycle || 0);
  }
  
  // reset if cycle changed
  if (storedCycle !== currentCycle) {
    lastProcessed = 0;
  }
  
  return lastProcessed;
}

// Recursively find optimal pool count that fits gas limit
async function findOptimalPoolCount(client: any, stakingAddress: Address, lastProcessed: number, pools: number, gasLimit: number): Promise<number> {
  if (pools <= 0) return 1; // minimum 1 pool
  
  const estimatedGas = await client.estimateGas({
    to: stakingAddress,
    data: encodeFunctionData({
      abi: abi,
      functionName: "calculateProfit",
      args: [BigInt(lastProcessed), BigInt(pools)],
    }),
  });
  
  if (estimatedGas <= BigInt(gasLimit)) {
    return pools; // this amount fits in gas limit
  }
    
    // recursively reduce by half
  return findOptimalPoolCount(client, stakingAddress, lastProcessed, Math.floor(pools / 2), gasLimit);

}

// Simulate contract calls to ensure they won't fail
async function simulateContractCalls(client: any, stakingAddress: Address, currentPool: Address, lastProcessed: number, poolsToProcess: number): Promise<void> {
  // simulate calculateProfit call
  await client.simulateContract({
    address: stakingAddress,
    abi: abi,
    functionName: "calculateProfit",
    args: [BigInt(lastProcessed), BigInt(poolsToProcess)],
  });
  
  // simulate currentPool distribution if it's the first batch
  if (lastProcessed === 0) {
    await client.simulateContract({
      address: currentPool,
      abi: abi,
      functionName: "distributeProfit",
      args: [],
    });
  }
}

// Update storage with progress
async function updateProgress(storage: any, newLastProcessed: number, poolsCount: number, currentCycle: bigint): Promise<void> {
  if (newLastProcessed >= poolsCount) {
    // clear storage as we're done
    await storage.set("calculateProgress", "");
  } else {
    // update storage with new progress
    await storage.set("calculateProgress", JSON.stringify({
      lastProcessed: newLastProcessed,
      cycle: currentCycle.toString()
    }));
  }
}

// Build callData array
function buildCallData(stakingAddress: Address, currentPool: Address, lastProcessed: number, poolsToProcess: number): { to: Address; data: string }[] {
  const callData: { to: Address; data: string }[] = [];
  
  // add calculateProfit call
  callData.push({
    to: stakingAddress,
    data: encodeFunctionData({
      abi: abi,
      functionName: "calculateProfit",
      args: [BigInt(lastProcessed), BigInt(poolsToProcess)],
    }),
  });
  
  // add currentPool distribution only after the FIRST batch (when lastProcessed was 0)
  if (lastProcessed === 0) {
    callData.push({
      to: currentPool,
      data: encodeFunctionData({
        abi: abi,
        functionName: "distributeProfit",
        args: [],
      }),
    });
  }
  
  return callData;
}

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, gelatoArgs, secrets, storage } = context;
  const rpcURL = await secrets.get("RPC_URL") || "";

  // initialize client
  const client = createPublicClient({
    chain: gelatoArgs.chainId === 137 ? polygon : polygonAmoy,
    transport: http(rpcURL)
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise(async (resolve) =>
    setTimeout(resolve, Number(await secrets.get("DELAY"))),
  );

  const stakingAddress: Address = userArgs.staking as Address;
  const GAS_LIMIT = Number(await secrets.get("GAS_LIMIT"));

  try {
    // get contract data
    const [currentPool, poolsCount] = await Promise.all([
      client.readContract({
        address: stakingAddress,
        abi: abi,
        functionName: "currentPool",
        args: [],
      }) as Promise<Address>,
      client.readContract({
        address: stakingAddress,
        abi: abi,
        functionName: "getActivePoolCount",
        args: [],
      }) as Promise<bigint>
    ]);

    // get current cycle
    const currentCycle = await getCurrentCycle(client, stakingAddress);

    // get progress from storage
    const lastProcessed = await getProgress(storage, currentCycle);
    const remainingPools = Number(poolsCount) - lastProcessed;
    
    if (remainingPools <= 0) {
      await storage.set("calculateProgress", "");
      return {
        canExec: false,
        message: "All pools already processed for current cycle"
      };
    }
    
    // find pool count that fits gas limit
    let poolsToProcess: number;
    try {
      poolsToProcess = await findOptimalPoolCount(client, stakingAddress, lastProcessed, remainingPools, GAS_LIMIT);
    } catch (error) {
      console.warn("fallback if estimation fails:", error);
      poolsToProcess = Math.min(remainingPools, 100);
    }
    
    // build call data
    const callData = buildCallData(stakingAddress, currentPool, lastProcessed, poolsToProcess);
    
    // simulate calls to ensure they won't fail
    try {
      await simulateContractCalls(client, stakingAddress, currentPool, lastProcessed, poolsToProcess);


      // order of last processed pool  (to update storage)
      const newLastProcessed = lastProcessed + poolsToProcess;
      // only update storage after successful simulation
      await updateProgress(storage, newLastProcessed, Number(poolsCount), currentCycle);
      
    } catch (error) {
      console.error("Final simulation failed - calls would revert:", error);
      return {
        canExec: false,
        message: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
    
    // simulation passes
    return {
      canExec: true,
      callData,
    };
    
  } catch (error) {
    console.error("Error in calculate function:", error);
    return {
      canExec: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
});
