import { NewClaimable as NewClaimableEvent, ProfitDistribution as ProfitDistributionEvent } from "../generated/templates/ConservativeStakingPool/ConservativeStakingPool"
import { Claimable, Pool, ProfitDistribution } from "../generated/schema";
import { Address, dataSource } from "@graphprotocol/graph-ts";
import { ConservativeStaking } from "../generated/ConservativeStaking/ConservativeStaking";


export function handleProfitDistribution(event: ProfitDistributionEvent): void {
	const context = dataSource.context();
	const staking = context.getBytes("staking");
	
	const profit = new ProfitDistribution(event.transaction.hash.concatI32(event.logIndex.toI32()));
	
	profit.pool = event.address;
	profit.amount = event.params.amount;
	profit.blockNumber = event.block.number;
	profit.totalStaked = ConservativeStaking.bind(Address.fromBytes(staking)).totalStaked();
	profit.blockTimestamp = event.block.timestamp;
	profit.transactionHash = event.transaction.hash;
	profit.save();
	const pool = Pool.load(event.address);
	if (pool === null) {
		throw new Error(`Pool ${ event.address.toHexString() } do not exist`)
	}
	pool.lastDistributed = event.block.timestamp;
	pool.save();
}

export function handleNewClaimable(event: NewClaimableEvent): void {
	const claimable = new Claimable(event.transaction.hash.concatI32(event.logIndex.toI32()));
	claimable.pool = event.address;
	claimable.staker = event.params.staker;
	claimable.amount = event.params.amount;
	claimable.blockNumber = event.block.number;
	claimable.blockTimestamp = event.block.timestamp;
	claimable.transactionHash = event.transaction.hash;
	claimable.save();
}