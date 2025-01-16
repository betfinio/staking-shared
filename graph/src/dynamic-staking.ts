import { DynamicStaking, PoolOpened as PoolOpenedEvent, Staked as StakedEvent } from "../generated/DynamicStaking/DynamicStaking"
import { Pool, Stake } from "../generated/schema"
import { DynamicStakingPool } from "../generated/DynamicStaking/DynamicStakingPool"
import { DynamicStakingPool as PoolTemplate } from "../generated/templates";
import { DataSourceContext } from "@graphprotocol/graph-ts";


export function handlePoolOpened(event: PoolOpenedEvent): void {
	let entity = new Pool(
		event.params.pool
	)
	entity.pool = event.params.pool
	entity.staking = event.address
	entity.blockNumber = event.block.number
	entity.blockTimestamp = event.block.timestamp
	entity.lastDistributed = event.block.timestamp
	entity.transactionHash = event.transaction.hash
	entity.save()
	
	const context = new DataSourceContext();
	context.setBytes("staking", event.address);
	
	PoolTemplate.createWithContext(event.params.pool, context);
}


export function handleStaked(event: StakedEvent): void {
	let entity = new Stake(
		event.transaction.hash.concatI32(event.logIndex.toI32())
	)
	entity.staker = event.params.staker
	entity.amount = event.params.amount
	
	entity.address = event.address;
	
	entity.blockNumber = event.block.number
	entity.blockTimestamp = event.block.timestamp
	entity.transactionHash = event.transaction.hash
	const pool = DynamicStaking.bind(event.address).currentPool()
	entity.pool = pool
	entity.unlock = DynamicStakingPool.bind(pool).endCycle()
	entity.reward = DynamicStakingPool.bind(pool).getClaimed(event.params.staker)
	
	entity.save()
}

