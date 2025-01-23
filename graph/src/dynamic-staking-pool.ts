import { NewProfit as NewProfitEvent, ProfitDistribution as ProfitDistributionEvent } from "../generated/templates/DynamicStakingPool/DynamicStakingPool"
import { Pool, Profit, ProfitDistribution } from "../generated/schema"
import { Address, dataSource } from "@graphprotocol/graph-ts";
import { DynamicStaking } from "../generated/DynamicStaking/DynamicStaking";


export function handleProfitDistribution(event: ProfitDistributionEvent): void {
	const context = dataSource.context();
	const staking = context.getBytes("staking");
	
	const profit = new ProfitDistribution(event.transaction.hash.concatI32(event.logIndex.toI32()));
	const pool = Pool.load(event.address);
	if (pool === null) {
		throw new Error(`Pool ${ event.address.toHexString() } do not exist`)
	}
	profit.pool = pool.id;
	profit.amount = event.params.amount;
	profit.blockNumber = event.block.number;
	profit.totalStaked = DynamicStaking.bind(Address.fromBytes(staking)).totalStaked();
	profit.blockTimestamp = event.block.timestamp;
	profit.transactionHash = event.transaction.hash;
	profit.save();
	
	pool.lastDistributed = event.block.timestamp;
	pool.save();
}

export function handleNewProfit(event: NewProfitEvent): void {
	const claimable = new Profit(event.transaction.hash.concatI32(event.logIndex.toI32()));
	claimable.pool = event.address;
	claimable.staker = event.params.staker;
	claimable.amount = event.params.amount;
	claimable.blockNumber = event.block.number;
	claimable.blockTimestamp = event.block.timestamp;
	claimable.transactionHash = event.transaction.hash;
	claimable.save();
}