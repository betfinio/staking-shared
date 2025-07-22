// biome-ignore lint/style/useImportType: not supported
import {
	DynamicStaking,
	PoolOpened as PoolOpenedEvent,
	Staked as StakedEvent,
	Withdraw as WithdrawEvent,
} from "../generated/DynamicStaking/DynamicStaking";
import { Pool, Stake } from "../generated/schema";
import { DynamicStakingPool } from "../generated/DynamicStaking/DynamicStakingPool";
import { DynamicStakingPool as PoolTemplate } from "../generated/templates";
import { Address, BigInt, Bytes, DataSourceContext } from "@graphprotocol/graph-ts";

export function handlePoolOpened(event: PoolOpenedEvent): void {
	const entity = new Pool(event.params.pool);
	entity.pool = event.params.pool;
	entity.staking = event.address;
	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.lastDistributed = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;
	entity.stakes = [];
	entity.save();

	const context = new DataSourceContext();
	context.setBytes("staking", event.address);

	PoolTemplate.createWithContext(event.params.pool, context);
}

export function handleStaked(event: StakedEvent): void {
	const entity = new Stake(
		event.transaction.hash.concatI32(event.logIndex.toI32()),
	);
	entity.staker = event.params.staker;
	entity.amount = event.params.amount;

	entity.address = event.address;
	entity.unstaked = false;
	entity.unstakedAt = BigInt.fromI32(0);
	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;
	const pool = DynamicStaking.bind(event.address).currentPool();
	entity.pool = pool;
	entity.unlock = DynamicStakingPool.bind(pool).endCycle();
	entity.reward = DynamicStakingPool.bind(pool).getClaimed(event.params.staker);

	entity.save();

	const poolEntity = Pool.load(pool);
	if (poolEntity) {
		poolEntity.stakes = poolEntity.stakes.concat([entity.id]);
		poolEntity.save();
	}


	
}


export function handleDynamicWithdraw(event: WithdrawEvent): void {
	const pool = event.params.pool;
	const stakersCount = DynamicStakingPool.bind(event.params.pool).getStakersCount();
	for (let i = 0; i < stakersCount.toI32(); i++) {
		const staker = DynamicStakingPool.bind(event.params.pool).stakers(BigInt.fromI32(i));
		handleWithdraw(pool, event.block.timestamp, staker, event.transaction.hash);
	}


}

function handleWithdraw(pool: Address, blockTimestamp: BigInt, staker: Address, transactionHash: Bytes): void {

	const poolEntity = Pool.load(pool);
	if (poolEntity) {
		for (let i = 0; i < poolEntity.stakes.length; i++) {
			const stake = poolEntity.stakes[i];
			const stakeEntity = Stake.load(stake);
			if (stakeEntity && stakeEntity.staker.equals(staker) && stakeEntity.unstaked == false) {
				stakeEntity.unstaked = true;
				stakeEntity.unstakedAt = blockTimestamp;
				stakeEntity.unstakeTransactionHash = transactionHash;
				stakeEntity.save();
			}
		}
	}

}