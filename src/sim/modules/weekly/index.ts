export { weeklyModule } from './weeklyModule'
export {
  WEEKLY_MODULE_ID,
  createInitialWeeklyModuleState,
  emptyEconomyTotals,
  emptySignalTotals,
  formatWeekKey,
  getWeeklyModuleState,
} from './state'
export { resolveWages } from './wages'
export { computeMaintenanceBacklog } from './maintenance'
export { addSignalTotals, computeDailySignals } from './signals'
export { computeStaffTrend, computeCustomerTrend } from './trends'
export {
  emptyWeeklyCommunityResult,
  findSuppliersForStockId,
  resolveWeeklyCommunity,
} from './community'
export { buildWeeklyReportSection } from './report'
export type {
  CustomerWeeklyTrendEntry,
  MaintenanceBacklogEntry,
  StaffWeeklyTrendEntry,
  SupplierInvoice,
  WeeklyCommunityResult,
  WeeklyCommunityRumour,
  WeeklyCommunityRumourAccuracy,
  WeeklyCommunityRumourSource,
  WeeklyEconomyTotals,
  WeeklyFactionTrendEntry,
  WeeklyModuleState,
  WeeklyRegularTrendEntry,
  WeeklyResult,
  WeeklySignalAxis,
  WeeklySignalTotals,
  WeeklySupplierTrendEntry,
  WeeklyWageResolution,
} from './types'
