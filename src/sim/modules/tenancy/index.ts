// Expansion Phase 7 §7.2 — the tenancy module's public surface.

export { tenancyModule, createInitialTenancyModuleState } from './tenancyModule'
export { TENANCY_ACTIONS, tenancySummary } from './actions'
export {
  LANDLORD_ID,
  LANDLORD_LABEL,
  MAX_NEGOTIATIONS,
  MAX_REPAIR_REQUESTS,
  MAX_TENANCY_NOTICES,
  NOTICE_LADDER,
  RENT_PAYMENT_TARGET,
  TENANCY_MODULE_ID,
  liveNotice,
  noticeRung,
  type LandlordRepairRequest,
  type LandlordState,
  type TavernTenancyRecord,
  type TenancyConcession,
  type TenancyModuleState,
  type TenancyNotice,
  type TenancyNoticeKind,
  type TenancyStatus,
} from './types'
export {
  getLandlord,
  getTenancy,
  getTenancyModuleState,
  landlordRef,
} from './state'
export {
  DEFAULT_RENT_PER_PERIOD,
  RENT_PERIOD_DAYS,
  advanceRentPeriod,
  answerAccessRequest,
  arrearsOutstanding,
  effectiveRent,
  ensureTenancy,
  evictTavern,
  forgiveRentArrears,
  issueOrEscalateNotice,
  negotiateTenancy,
  payRent,
  raiseAccessRequest,
  reinstateTenancy,
  rentObligations,
  rentOutstanding,
  rentPastGrace,
  settleRentAtMonthEnd,
  syncTenancyStatus,
  type NegotiationKind,
} from './tenancy'
export {
  EVICTION_HEARING_EVENT,
  LANDLORD_ACCESS_EVENT,
  LANDLORD_GOODWILL_EVENT,
  RENT_PERIOD_ROLLOVER_EVENT,
  TENANCY_ESCALATION_EVENT,
  scheduleAccessRequest,
} from './tenancyEvents'
