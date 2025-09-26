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
  "function getActivePoolCount() external view returns (uint256)",
  "function pools(uint256 index) external view returns (address)",
  "function getCurrentCycle() external view returns (uint256)"
]);

const poolAbi = parseAbi(["function distributeProfit() external"]);

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, gelatoArgs, secrets, storage } = context;
  const rpcURL = await secrets.get("RPC_URL") || "";

  // initialize client
  const client = createPublicClient({
    chain: gelatoArgs.chainId === 137 ? polygon : polygonAmoy,
    transport: http(rpcURL)
  });

  // get staking address
  const stakingAddress: Address = userArgs.staking as Address;

  // get batch size
  const count = Number(await secrets.get("COUNT"));

  try {
    // get current cycle - try dynamic first, fallback to conservative calculation
    let currentCycle: bigint;

    try {
      // Try Dynamic staking's getCurrentCycle() (4-week cycles)
      currentCycle = await client.readContract({
        address: stakingAddress,
        abi: abi,
        functionName: "getCurrentCycle",
        authorizationList: undefined,
        args: [],
      });
    } catch (error) {
      // Fallback to Conservative staking weekly cycles (block.timestamp / SECONDS_IN_WEEK)
      currentCycle = BigInt(Math.floor(Date.now() / 1000 / (7 * 24 * 60 * 60)));
    }

    // get total pool count
    const totalPools = await client.readContract({
      address: stakingAddress,
      authorizationList: undefined,
      abi: abi,
      functionName: "getActivePoolCount",
      args: [],
    });


    // get all pool addresses using multicall
    const poolCalls: any[] = [];
    for (let i = 0; i < Number(totalPools); i++) {
      poolCalls.push({
        address: stakingAddress,
        abi: abi,
        functionName: "pools",
        args: [BigInt(i)],
      });
    }

    const poolResults = await client.multicall({
      contracts: poolCalls,
    });

    const poolAddresses = poolResults.map(result => {
      if (result.status === 'success') {
        return result.result as Address;
      }
      throw new Error(`Failed to get pool address: ${result.error}`);
    });

    // check distribution status using storage (pool address -> lastDistributedCycle)
    const undistributedPools: Address[] = [];

    for (const poolAddr of poolAddresses) {
      const lastDistributedCycle = await storage.get(poolAddr.toLowerCase());
      const lastCycle = lastDistributedCycle ? BigInt(lastDistributedCycle) : BigInt(0);

      // pool is undistributed if it wasn't distributed in the current cycle
      if (lastCycle < currentCycle) {
        undistributedPools.push(poolAddr);
      }
    }

    if (undistributedPools.length === 0) {
      return {
        canExec: false,
        message: "All pools already distributed for current cycle"
      };
    }

    // batch process up to COUNT pools
    const poolsToProcess = undistributedPools.slice(0, count);

    // prepare call data for each pool
    const callData = poolsToProcess.map((poolAddress) => ({
      to: poolAddress,
      data: encodeFunctionData({
        abi: poolAbi,
        functionName: "distributeProfit",
        args: [],
      }),
    }));

    // simulate all distributeProfit calls before updating storage
    try {
      for (const poolAddr of poolsToProcess) {
        await client.simulateContract({
          address: poolAddr,
          abi: poolAbi,
          functionName: "distributeProfit",
          args: [],
        });
      }

      // only update storage after successful simulation of all calls
      for (const poolAddr of poolsToProcess) {
        await storage.set(poolAddr.toLowerCase(), currentCycle.toString());
      }

    } catch (error) {
      console.error("Pool distribution simulation failed - calls would revert:", error);
      return {
        canExec: false,
        message: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    return {
      canExec: true,
      callData,
    };

  } catch (error) {
    console.error("Error in Staking distribution:", error);
    return {
      canExec: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
});
