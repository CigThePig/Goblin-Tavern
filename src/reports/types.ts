// Phase 89 — Report layer types.
//
// View-model shapes for the Daily Report and its sub-sections. Lives
// outside `src/sim/` because the report layer is a read-only consumer
// of simulation output, analogous to `src/cards/`. The simulation
// never imports from here; the report layer freely imports sim types.

import type { CauseEntry, MemoryState } from '../sim/state/TavernState'
import type { CalendarState } from '../sim/modules/calendar/types'
import type { ResolvedIntentRecord } from '../sim/modules/responses/types'
import type {
  PressureCategory,
  PressureSnapshot,
} from '../sim/modules/pressures/pressureTypes'

export type ReportDirection = 'gain' | 'loss' | 'neutral'

export type ReportDiffLine = {
  /** Diff path, used as the key for cause drilldown. */
  path: string
  readable: string
  direction: ReportDirection
  delta: number
  before: unknown
  after: unknown
  tags: string[]
}

export type ReportReputationDelta = {
  axis: string
  label: string
  before: number
  after: number
  delta: number
}

export type ReportPressureLine = {
  id: string
  label: string
  value: number
  previousValue: number
  delta: number
  trend: 'rising' | 'stable' | 'falling'
  severity: number
  category: PressureCategory
  dominantCauseIds: string[]
}

export type ReportHookLine = {
  memoryId: string
  label: string
  readable: string
  actors: { kind: string; id: string }[]
  locations: { kind: string; id: string }[]
  ageDays: number
}

export type ReportResolvedIntent = {
  intentId: string
  seedId: string
  verb: string
  /** Filled in when the seed is still on `seedsToday`; otherwise a fallback. */
  subject: string
  responseSlotId: string
}

export type ReportOwnerActionLine = {
  actionId: string
  label: string
  targetId?: string
  actionPointCost: number
  effects: string[]
}

export type ReportServiceLine = {
  /** Short label, e.g. "Traffic: 22 patrons". */
  readable: string
  /** Optional tag bucket for future filtering. */
  category: 'traffic' | 'incident' | 'satisfaction' | 'staff' | 'driver'
}

export type ReportDigest = {
  id: 'weekly' | 'monthly'
  title: string
  lines: string[]
}

export type ReportCalendarHeader = {
  /** The day-number of the day that just closed (per totalDaysElapsed). */
  closedDayOrdinal: number
  dayLabel: string
  isEndOfWeek: boolean
  isEndOfMonth: boolean
}

export type DailyReportData = {
  header: ReportCalendarHeader
  coinBefore: number
  coinAfter: number
  coinDelta: number
  reputationDeltas: ReportReputationDelta[]
  topDiffs: ReportDiffLine[]
  ownerActionsApplied: ReportOwnerActionLine[]
  resolvedIntents: ReportResolvedIntent[]
  serviceLines: ReportServiceLine[]
  risingPressures: ReportPressureLine[]
  futureHooks: ReportHookLine[]
  weeklyDigest?: ReportDigest
  monthlyDigest?: ReportDigest
  /** Truthy if the report has nothing meaningful to show. */
  isQuiet: boolean
}

export type GlossaryCategory = 'pressure' | 'reputation' | 'mechanic' | 'log'

export type GlossaryTerm = {
  id: string
  label: string
  category: GlossaryCategory
  /** ≤ 18 words. */
  oneLine: string
  /** Optional second paragraph, ≤ 60 words. */
  longer?: string
}

// Re-exports so callers can pull report-adjacent simulation types from
// one place — mirrors the `src/cards/types.ts` convenience pattern.
export type {
  CauseEntry,
  MemoryState,
  ResolvedIntentRecord,
  PressureSnapshot,
  CalendarState,
}
