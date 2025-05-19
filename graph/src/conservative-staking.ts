// biome-ignore lint/style/useImportType: not supported
import {
	Claimed as ClaimedEvent,
	ConservativeStaking,
	PoolOpened as PoolOpenedEvent,
	Staked as StakedEvent,
	Withdraw as WithdrawEvent,
} from "../generated/ConservativeStaking/ConservativeStaking";
import { Claim, Pool, Stake, Withdraw } from "../generated/schema";
import { ConservativeStakingPool } from "../generated/ConservativeStaking/ConservativeStakingPool";
// biome-ignore lint/suspicious/noShadowRestrictedNames: shadowing
import { BigInt, Bytes, DataSourceContext } from "@graphprotocol/graph-ts";
import { ConservativeStakingPool as PoolTemplate } from "../generated/templates";

export function handlePoolOpened(event: PoolOpenedEvent): void {
	const entity = new Pool(event.params.pool);
	entity.pool = event.params.pool;
	entity.staking = event.address;
	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;
	entity.lastDistributed = event.block.timestamp;
	entity.save();

	const context = new DataSourceContext();
	context.setBytes("staking", event.address);

	PoolTemplate.createWithContext(event.params.pool, context);
}

export function handleClaimed(event: ClaimedEvent): void {
	const receipt = event.receipt;
	const transferSignature = Bytes.fromHexString("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"); // signature of ERC20 transfer event
   
	if(receipt) {
		const logs = receipt.logs;
		for(let i = 0; i < logs.length; i++) {
			const log = logs[i];
			if(log.topics[0].equals(transferSignature)) {
				const amount = log.data;
		
				const entity = new Claim(
					event.transaction.hash.concatI32(log.logIndex.toI32()),
				);
			
				entity.staker = event.params.staker;
				entity.amount = BigInt.fromByteArray(amount);
			
				entity.blockNumber = event.block.number;
				entity.blockTimestamp = event.block.timestamp;
				entity.transactionHash = event.transaction.hash;
				entity.address = event.address;
				entity.save();
			}
		}
	} 
}

export function handleStaked(event: StakedEvent): void {
	const entity = new Stake(
		event.transaction.hash.concatI32(event.logIndex.toI32()),
	);
	entity.staker = event.params.staker;
	entity.amount = event.params.amount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;
	const lastPoolIndex = ConservativeStaking.bind(
		event.address,
	).getStakedPoolsCount(event.params.staker);
	const pool = ConservativeStaking.bind(event.address).stakedPools(
		event.params.staker,
		lastPoolIndex.minus(BigInt.fromI32(1)),
	);
	entity.pool = pool;
	entity.unlock = ConservativeStakingPool.bind(pool)
		.getStake(event.params.staker)
		.getValue1();
	entity.reward = ConservativeStakingPool.bind(pool).profit(
		event.params.staker,
	);
	entity.address = event.address;
	entity.save();
}

export function handleWithdraw(event: WithdrawEvent): void {
	const entity = new Withdraw(
		event.transaction.hash.concatI32(event.logIndex.toI32()),
	);
	entity.staker = event.params.staker;
	entity.amount = event.params.amount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}
