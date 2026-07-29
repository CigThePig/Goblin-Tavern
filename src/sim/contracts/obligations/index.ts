// Expansion Phase 1 §1.2 — public surface of the obligation contract.
// Re-exports only; see `../ruleset/index.ts` for why.

export {
  MAX_CONTRACT_TRANSITIONS,
  TERMINAL_CONTRACT_STATUSES,
  ContractRecordBaseSchema,
  ContractStatusSchema,
  ContractTransitionSchema,
  ObligationRecordSchema,
  isSettled,
  isTerminalContractStatus,
  outstandingAmount,
  type AnyContractRecord,
  type ConstructionRecord,
  type ContractFamily,
  type ContractRecordBase,
  type ContractStatus,
  type ContractTransition,
  type EmploymentRecord,
  type ObligationRecord,
  type OrderRecord,
  type RegulatoryRecord,
  type TenancyRecord,
} from './types'

export {
  accrueLateCharge,
  cancelContract,
  defaultObligation,
  enterGrace,
  escalateToCollections,
  expireContract,
  forgiveObligation,
  graceEndsOnDay,
  openObligation,
  payObligation,
  settleObligation,
  transitionContract,
  type OpenObligationInput,
  type PaymentResult,
} from './lifecycle'

export {
  MAX_CLOSED_OBLIGATIONS,
  MAX_OPEN_OBLIGATIONS,
  OBLIGATIONS_MODULE_ID,
  ObligationsModuleStateSchema,
  createInitialObligationsModuleState,
  getObligation,
  listObligations,
  nextObligationId,
  readObligationsSlice,
  recordObligationCharges,
  recordObligationPayment,
  totalOutstanding,
  upsertObligation,
  writeObligationsSlice,
  type ObligationsModuleState,
} from './state'

export {
  OBLIGATION_DUE_EVENT,
  OBLIGATION_GRACE_EXPIRY_EVENT,
  ensureObligationEventsRegistered,
  scheduleObligationDueDate,
} from './obligationEvents'

export { obligationsModule } from './obligationsModule'
