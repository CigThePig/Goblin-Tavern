// Phase 89 — Report layer public surface.
//
// Mirrors `src/cards/index.ts`: one shallow re-export module so callers
// pull projection helpers, types, and the glossary from a single place.

export { buildDailyReport, formatDiffPathTitle } from './dailyReportProjection'
export { buildWeeklyOverview } from './weeklyOverviewProjection'
export { buildMonthlyOverview } from './monthlyOverviewProjection'
export { buildTavernOverview } from './tavernOverviewProjection'
export {
  causesForPath,
  causesForPressure,
  closedDayAbsolute,
  pathToCauseTarget,
} from './causeLookup'
export {
  GLOSSARY_TERMS,
  GLOSSARY_CATEGORY_LABELS,
  getTerm,
  termsByCategory,
  searchTerms,
} from './glossary'
export type { BuildDailyReportOptions } from './dailyReportProjection'
export type {
  DailyReportData,
  ReportCalendarHeader,
  ReportDiffLine,
  ReportDirection,
  ReportHookLine,
  ReportOwnerActionLine,
  ReportPressureLine,
  ReportReputationDelta,
  ReportResolvedIntent,
  ReportServiceLine,
  ReportDigest,
  GlossaryCategory,
  GlossaryTerm,
} from './types'
export type {
  CustomerGroupRow,
  InvoiceRow,
  MaintenanceRow,
  StaffRow,
  WeeklyComparison,
  WeeklyOverviewCommunity,
  WeeklyOverviewCustomerGroups,
  WeeklyOverviewData,
  WeeklyOverviewEconomy,
  WeeklyOverviewEconomyTopRevenue,
  WeeklyOverviewEmptyReason,
  WeeklyOverviewHeader,
  WeeklyOverviewInvoices,
  WeeklyOverviewMaintenance,
  WeeklyOverviewSignals,
  WeeklyOverviewStaff,
  WeeklyOverviewWages,
} from './weeklyOverviewProjection'
export type {
  MonthlyComparison,
  MonthlyOverviewArc,
  MonthlyOverviewCustomers,
  MonthlyOverviewData,
  MonthlyOverviewEconomy,
  MonthlyOverviewEmptyReason,
  MonthlyOverviewHeader,
  MonthlyOverviewInspection,
  MonthlyOverviewLandlord,
  MonthlyOverviewModifier,
  MonthlyOverviewPressureRow,
  MonthlyOverviewPressures,
  MonthlyOverviewRent,
  MonthlyOverviewReputation,
  MonthlyOverviewReputationRow,
  MonthlyOverviewRival,
  MonthlyOverviewUpgradeRow,
} from './monthlyOverviewProjection'
export type {
  ActiveExpeditionRow,
  AdventurerRow,
  ApplicableActionRef,
  AreaPanelData,
  AreaRow,
  AreaTraitRow,
  AreaUpgradeRow,
  AvailableProjectRow,
  CompletedExpeditionRow,
  PolicyRow,
  ProjectPanelData,
  ProjectRow,
  RecipePanelData,
  RecipeRow,
  SocialActionRow,
  StaffPanelData,
  StaffPanelRow,
  StockPanelData,
  StockRow,
  SupplyPipelineData,
  TavernOverviewData,
} from './tavernOverviewProjection'
