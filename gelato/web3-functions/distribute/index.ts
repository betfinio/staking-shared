import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Address, encodeFunctionData, parseAbi } from "viem";
import { request } from "graphql-request";

const query = (staking: Address, last: number) => `{
  pools(where: {staking: "${staking}", lastDistributed_lt: "${last}"}, first: 10) {
    pool
  }
}`;
const abi = parseAbi(["function distributeProfit() external"]);

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, secrets } = context;
  // get staking address
  const stakingAddress: Address = userArgs.staking as Address;

  // get graph url
  const graphUrl = (await secrets.get("STAKING_URL"))!;

  const last = Math.floor(Date.now() / 1000) - 60 * 60 * 24; // fetch pools that was not distributed in last 24 hours

  const data = await request<{ pools: { pool: Address }[] }>(
    graphUrl,
    query(stakingAddress, last),
  );
  const pools = data.pools.map((pool) => ({
    to: pool.pool,
    data: encodeFunctionData({
      abi,
      functionName: "distributeProfit",
      args: [],
    }),
  }));

  return {
    canExec: true,
    callData: pools,
  };
});
