// Phase 20 — Testing module barrel.
//
// The testing module hosts the cardless playtest runner, policy bots,
// audits, readiness report, and the Phase 1 §9.2 fake-expansion gate.
// It is *not* part of the simulation pipeline — every export here is
// only used by tests and debug scripts.

export {
  FULL_PIPELINE,
  runCardlessSim,
  runOneDay,
  runOneWeek,
  runOneMonth,
  runMonths,
  type CardlessRunConfig,
  type CardlessRunDayRecord,
  type CardlessRunResult,
  type DayInputChooser,
} from './simRunner'

export {
  REQUIRED_POLICY_BOTS,
  PHASE_20_POLICY_BOTS,
  POLICY_BOTS_BY_ID,
  getPolicyBot,
  policyBotInput,
  manualDebugBot,
  autoNoOwnerActionsBot,
  autoRandomOwnerBot,
  autoCleanFocusedBot,
  autoProfitFocusedBot,
  autoMerchantFocusedBot,
  autoMinerFocusedBot,
  autoIgnoreRepairsBot,
  autoStaffFriendlyBot,
  autoAlwaysCleanBot,
  autoAlwaysRestockBot,
  type PolicyBot,
  type PolicyBotId,
} from './policyBots'

export {
  buildOneDayReport,
  buildOneDayReportSection,
  buildOneWeekReport,
  buildOneMonthReport,
  summarizeRun,
  collectAllSeeds,
  type OneDayReport,
  type OneWeekReport,
  type OneMonthReport,
  type RunSummary,
  type ReputationIdentity,
} from './cardlessPlaytest'

export {
  auditRunForContradictions,
  auditStateForContradictions,
  auditSeedAgainstState,
  audited,
  type ContradictionAuditResult,
  type ContradictionEvidence,
} from './contradictionAudit'

export {
  REQUIRED_FAMILIES,
  buildSeedCoverageReport,
  buildCardCapacityReport,
  buildRepetitionAudit,
  type SeedCoverageReport,
  type SeedCoverageFamilyEntry,
  type CardCapacityReport,
  type RepetitionAuditResult,
} from './seedCoverageReport'

export {
  runStrategy,
  runStrategyMatrix,
  type StrategyRunSpec,
  type StrategyComparisonRun,
} from './balanceRuns'

export {
  buildStrategyComparison,
  type StrategyComparisonReport,
  type StrategyRow,
} from './strategyComparison'

export {
  READINESS_THRESHOLDS,
  buildReadinessReport,
  evaluateCardReadinessGate,
  verifyReplay,
  verifySingleDayReplay,
  type ReadinessReport,
  type ReadinessSection,
  type ReadinessConfig,
  type CardReadinessGateResult,
  type CardReadinessGateConditions,
  type CardReadinessGateInput,
  type ReplayVerification,
} from './readinessReport'

export {
  installCandleShortageExpansion,
  isCandleShortageExpansionInstalled,
  markCandleShortageExpansionUninstalled,
  candleShortageExpansionModule,
  CANDLE_STOCK_ID,
  CANDLE_BUY_ACTION_ID,
  CANDLE_SEED_FAMILY,
  CANDLE_SEED_GENERATOR_ID,
  CANDLE_EXPANSION_MODULE_ID,
} from './expansions/candleShortage'

export { runDay, type RunDayResult } from './runDay'
export { runWeek, type RunWeekResult } from './runWeek'
export { runMonth, type RunMonthResult } from './runMonth'
