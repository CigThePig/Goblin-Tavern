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
export { buildWeeklyReportSection } from './report'
export type {
  CustomerWeeklyTrendEntry,
  MaintenanceBacklogEntry,
  StaffWeeklyTrendEntry,
  SupplierInvoice,
  WeeklyEconomyTotals,
  WeeklyModuleState,
  WeeklyResult,
  WeeklySignalAxis,
  WeeklySignalTotals,
  WeeklyWageResolution,
} from './types'
