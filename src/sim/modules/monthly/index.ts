export {
  monthlyModule,
  createInitialMonthlyModuleState,
  getMonthlyModuleState,
  MAX_MONTHLY_HISTORY,
  MONTHLY_MODULE_ID,
  emptyMonthlyEconomy,
  emptyAccumulator,
  formatMonthKey,
  getReputationTier,
} from './monthlyModule'

export {
  MONTH_MODIFIERS,
  getMonthModifier,
  listMonthModifiers,
  pickMonthModifier,
} from './modifiers'

export { resolveRent } from './rent'
export { resolveLandlord } from './landlord'
export { resolveInspection } from './inspection'
export { resolveRivalTavern } from './rival'
export { computeReputationShifts } from './reputation'
export { computeUpgradeReadiness } from './upgradeReadiness'
export { buildMonthlyReportSection } from './report'

export type {
  InspectionResolution,
  InspectionState,
  LandlordResolution,
  LandlordState,
  MonthlyAccumulator,
  MonthlyEconomyTotals,
  MonthlyModuleState,
  MonthlyResult,
  MonthModifier,
  MonthModifierId,
  RentResolution,
  RentState,
  ReputationAxisId,
  ReputationAxisShift,
  ReputationTier,
  RivalTavernResolution,
  RivalTavernState,
  RivalTavernStrategy,
  UpgradeReadinessEntry,
} from './types'
export { REPUTATION_AXIS_IDS } from './types'
