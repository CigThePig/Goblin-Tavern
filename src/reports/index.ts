// Phase 89 — Report layer public surface.
//
// Mirrors `src/cards/index.ts`: one shallow re-export module so callers
// pull projection helpers, types, and the glossary from a single place.

export { buildDailyReport, formatDiffPathTitle } from './dailyReportProjection'
export { buildWeeklyOverview } from './weeklyOverviewProjection'
export { buildMonthlyOverview } from './monthlyOverviewProjection'
export { buildTavernOverview } from './tavernOverviewProjection'
export { buildWorldOverview } from './worldOverviewProjection'
export {
  buildTavernLog,
  HISTORY_CATEGORY_LABELS,
  TAG_FACET_LIMIT,
} from './tavernLogProjection'
export { projectYesterdayDigest } from './yesterdayDigest'
export { projectMissedOpportunities } from './missedOpportunityProjection'
export { PRESSURE_REMEDIES, resolveRemedyTarget } from './pressureRemedyMap'
export type { RemedyEntry } from './pressureRemedyMap'
export type {
  MissedOpportunityKind,
  MissedOpportunityLine,
  ProjectMissedOpportunitiesOptions,
} from './missedOpportunityProjection'
export { resolveEntityLabel, resolveBareEntityId } from './entityLabels'
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
export type {
  AttributionRow,
  CultureMembers,
  CultureRow,
  CulturesPanelData,
  FactionRow,
  FactionsPanelData,
  MemoryRow,
  NpcRow,
  NpcsPanelData,
  RegularRow,
  RegularsPanelData,
  RumourRow,
  RumoursPanelData,
  SupplierGoodRow,
  SupplierRow,
  SuppliersPanelData,
  TavernIdentityData,
  WorldOverviewData,
} from './worldOverviewProjection'
export type {
  TavernLogAppliedFilters,
  TavernLogCategoryFacet,
  TavernLogChipRef,
  TavernLogData,
  TavernLogDayGroup,
  TavernLogDayRange,
  TavernLogEmptyReason,
  TavernLogFilters,
  TavernLogRow,
  TavernLogTagFacet,
} from './tavernLogProjection'
export type { HistoryCategory, HistoryEntry } from '../sim/state/TavernState'
export type {
  YesterdayDigestCoin,
  YesterdayDigestData,
  YesterdayDigestDirection,
  YesterdayDigestSecondary,
} from './yesterdayDigest'
