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
]);

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { multiChainProvider, userArgs, gelatoArgs, secrets } = context;
  const provider = multiChainProvider.default();
  const url = provider.connection.url;
  // initialize client
  const client = createPublicClient({
    chain: gelatoArgs.chainId === 80002 ? polygonAmoy : polygon,
    transport: http(url),
  });

  // eslint-disable-next-line no-async-promise-executor
  await new Promise(async (resolve) =>
    setTimeout(resolve, Number(await secrets.get("DELAY"))),
  );

  // get luro address
  const stakingAddress: Address = userArgs.staking as Address;

  // get previous round
  const currentPool: Address = await client.readContract({
    address: stakingAddress,
    abi: abi,
    functionName: "currentPool",
    args: [],
  });
  const poolsCount = await client.readContract({
    address: stakingAddress,
    abi: abi,
    functionName: "getActivePoolCount",
    args: [],
  });
  // split the pools into chunks of 50
  const pools: { to: Address; data: Address }[] = [];
  for (let i = BigInt(0); i < poolsCount; i += BigInt(50)) {
    pools.push({
      to: stakingAddress,
      data: encodeFunctionData({
        abi: abi,
        functionName: "calculateProfit",
        args: [i, BigInt(50)],
      }),
    });
  }
  const currentPoolDistribution = {
    to: currentPool,
    data: encodeFunctionData({
      abi: abi,
      functionName: "distributeProfit",
      args: [],
    }),
  };
  return {
    canExec: true,
    callData: [...pools, currentPoolDistribution],
  };
});
