import { BigInt } from "@graphprotocol/graph-ts"
import {
  ConservativeStaking,
  Claimed,
  NewCalculationWindow,
  NewMinAllowedAmount,
  PoolClosed,
  PoolOpened,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked,
  Staked,
  Withdraw
} from "../generated/ConservativeStaking/ConservativeStaking"
import { ExampleEntity } from "../generated/schema"

export function handleClaimed(event: Claimed): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from)

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new ExampleEntity(event.transaction.from)

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  entity.staker = event.params.staker
  entity.amount = event.params.amount

  // Entities can be written to the store with `.save()`
  entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.CORE(...)
  // - contract.DEFAULT_ADMIN_ROLE(...)
  // - contract.SECONDS_IN_DAY(...)
  // - contract.SECONDS_IN_WEEK(...)
  // - contract.TIMELOCK(...)
  // - contract.allTimeStaked(...)
  // - contract.calculated(...)
  // - contract.calculatedProfit(...)
  // - contract.calculationWindow(...)
  // - contract.currentPool(...)
  // - contract.distributedByCycle(...)
  // - contract.duration(...)
  // - contract.getActivePoolCount(...)
  // - contract.getAddress(...)
  // - contract.getClaimable(...)
  // - contract.getDuration(...)
  // - contract.getProfit(...)
  // - contract.getRoleAdmin(...)
  // - contract.getStaked(...)
  // - contract.getStakedPoolsCount(...)
  // - contract.getToken(...)
  // - contract.hasRole(...)
  // - contract.isCalculation(...)
  // - contract.isStaker(...)
  // - contract.minAllowedAmount(...)
  // - contract.pass(...)
  // - contract.pools(...)
  // - contract.staked(...)
  // - contract.stakedPools(...)
  // - contract.supportsInterface(...)
  // - contract.token(...)
  // - contract.totalClaimed(...)
  // - contract.totalProfit(...)
  // - contract.totalStaked(...)
  // - contract.totalStakers(...)
  // - contract.totalStakesOfInvitees(...)
}

export function handleNewCalculationWindow(event: NewCalculationWindow): void {}

export function handleNewMinAllowedAmount(event: NewMinAllowedAmount): void {}

export function handlePoolClosed(event: PoolClosed): void {}

export function handlePoolOpened(event: PoolOpened): void {}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {}

export function handleRoleGranted(event: RoleGranted): void {}

export function handleRoleRevoked(event: RoleRevoked): void {}

export function handleStaked(event: Staked): void {}

export function handleWithdraw(event: Withdraw): void {}
