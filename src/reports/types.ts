// Phase 89 — Report layer types.
//
// View-model shapes for the Daily Report and its sub-sections. Lives
// outside `src/sim/` because the report layer is a read-only consumer
// of simulation output, analogous to `src/cards/`. The simulation
// never imports from here; the report layer freely imports sim types.

import type { CauseEntry, EntityRef, MemoryState } from '../sim/state/TavernState'
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
  /**
   * Engine-generated machine-readable form, e.g.
   * `stock.ale.quantity 80 → 0 (-80)`. Kept for snapshot stability
   * and log forwarding; the UI binds to `humanReadable` instead.
   */
  readable: string
  /**
   * Phase 117 — Player-facing line, e.g. `Ale stock: 80 → 0 (−80)`.
   * Populated by the projection via `humanizeDiff()`.
   */
  humanReadable: string
  direction: ReportDirection
  delta: number
  before: unknown
  after: unknown
  tags: string[]
}

/**
 * Phase 118 — Grouped projection of the day's significant changes.
 * `dailyReportProjection` populates this alongside the flat
 * `topDiffs` list so the daily-report view can render one section
 * per category instead of a wall of mixed rows. Every group is
 * present even when empty so callers can iterate a stable order.
 */
export type GroupedDiffs = {
  /** Coin delta + every `reputation.<axis>` change. */
  coinAndReputation: ReportDiffLine[]
  /** Every `stock.<id>.<field>` change. */
  stock: ReportDiffLine[]
  /** Every `pressures.<id>.value` change. */
  pressures: ReportDiffLine[]
  /** Every `areas.<id>.<field>` change. */
  areas: ReportDiffLine[]
  /**
   * Catch-all for significant changes that don't match the four named
   * prefixes — staff, customers, recipes, and world-relationship slices
   * (cultures, factions, suppliers, regulars, local events, social
   * rumours, hireable adventurers). Keeps the classifier total so the
   * daily view never silently drops a significant diff.
   */
  other: ReportDiffLine[]
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
  /**
   * Phase 190b / ISSUE-157b — set only when `subject` names a concrete
   * entity the seed already carries (a `namedEntities` entry whose
   * `displayName` equals `subject`). Lets the UI render the subject as an
   * `EntityLink` onto that entity's detail surface. Absent when the
   * subject is a generic noun — the UI then renders plain text. Never
   * derived from prose; this is a structured reference or nothing.
   */
  subjectRef?: { kind: EntityRef['kind']; id: string }
  responseSlotId: string
}

export type ReportOwnerActionLine = {
  actionId: string
  label: string
  targetId?: string
  /**
   * Phase 117 — Player-facing target label resolved from the action's
   * `targetType` via `idLabel()`. Populated by the projection so the
   * UI doesn't have to know how to translate per-category target ids.
   */
  targetLabel?: string
  timeCost: number
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

// Phase 186 / Day-Clock Cluster 6 — Report-as-unfolding.
//
// The day now runs as three real engine segments (A: setup → morning,
// B: owner actions + service, C: responses → wrap). The day arc narrates
// the day in that true temporal order instead of as flat category
// buckets: the morning moves you committed (`opening`), service running
// (`service`), and the cards you answered at the service-react pause
// (`reckoning`). Each movement carries the already-projected rich lines —
// no new sim facts are invented; this is purely an ordering + framing
// layer over `ownerActionsApplied` / `serviceLines` / `resolvedIntents`.
export type DayArcMovementId = 'opening' | 'service' | 'reckoning'

export type DayArcEntry =
  | { kind: 'owner_action'; action: ReportOwnerActionLine }
  | { kind: 'service'; line: ReportServiceLine }
  | { kind: 'resolved_intent'; intent: ReportResolvedIntent }

export type DayArcMovement = {
  id: DayArcMovementId
  /** Player-facing heading for the movement. */
  title: string
  /** Composed narrator connective; deterministic per (day, movement). */
  voice?: string
  /** The movement's rich lines, in projection order. Never empty — a
   *  movement with no entries is omitted from the arc entirely. */
  entries: DayArcEntry[]
}

// Phase 97 — Missed-opportunity projection. The daily report surfaces
// up to three "you could have done X" hints between "What happened" and
// "What's building". Computed purely from existing sim outputs (causes,
// applied owner actions, ignored seeds, pressure snapshots).
export type MissedOpportunityKind =
  | 'pressure_remedy'
  | 'ignored_seed'
  | 'diff_counterfactual'

export type MissedOpportunityLine = {
  /** Stable id used for dedup keys and per-day dismissal. */
  id: string
  kind: MissedOpportunityKind
  /** Primary line, ≤ 14 words. Hypothetical mood. */
  readable: string
  /** Optional rationale line, ≤ 10 words. */
  secondary?: string
  actionId: string
  actionLabel: string
  targetRef?: EntityRef
  targetLabel?: string
  pressureId?: string
  seedId?: string
  diffPath?: string
  /** Sort key — higher = stronger signal. */
  impact: number
  /**
   * Phase 96 / ISSUE-056 — When the suggested remedy fails the
   * owner-action `canApply` gate against the same state (insufficient
   * coin, missing target, etc.), the projection annotates the line so
   * the UI can say "would have needed: …" rather than implying the
   * player could have selected it. Stays undefined when the action was
   * applicable.
   */
  validityNote?: string
}

export type ReportCalendarHeader = {
  /** The day-number of the day that just closed (per totalDaysElapsed). */
  closedDayOrdinal: number
  dayLabel: string
  isEndOfWeek: boolean
  isEndOfMonth: boolean
  /**
   * Phase 95 — Voice line for the report header. Composed
   * deterministically per (tavernId, closed-day ordinal) from the
   * `header` empty-state pool. Stable across re-renders. Optional so
   * upstream callers that don't want the voice can ignore it.
   */
  headerVoice?: string
}

export type DailyReportData = {
  header: ReportCalendarHeader
  coinBefore: number
  coinAfter: number
  coinDelta: number
  reputationDeltas: ReportReputationDelta[]
  /**
   * Flat, capped list of the day's biggest diffs. Preserved for
   * snapshot stability and any caller that wants a single bucket.
   * The view layer prefers `groupedDiffs`.
   */
  topDiffs: ReportDiffLine[]
  /**
   * Phase 118 — Same significant changes grouped by category for the
   * Daily Report view. See {@link GroupedDiffs}.
   */
  groupedDiffs: GroupedDiffs
  ownerActionsApplied: ReportOwnerActionLine[]
  resolvedIntents: ReportResolvedIntent[]
  serviceLines: ReportServiceLine[]
  /**
   * Phase 186 / Day-Clock Cluster 6 — the day's story, ordered by the
   * engine's real segments (opening → service → reckoning). The view
   * layer renders this as the report's narrative spine; the flat
   * `ownerActionsApplied` / `serviceLines` / `resolvedIntents` fields are
   * retained for snapshot stability and non-narrative consumers
   * (e.g. yesterdayDigest). Movements with no entries are omitted.
   */
  dayArc: DayArcMovement[]
  risingPressures: ReportPressureLine[]
  futureHooks: ReportHookLine[]
  /** Phase 97 — "What you could have done" block. Up to 3 lines. */
  missedOpportunities?: MissedOpportunityLine[]
  weeklyDigest?: ReportDigest
  monthlyDigest?: ReportDigest
  /** Truthy if the report has nothing meaningful to show. */
  isQuiet: boolean
  /**
   * Phase 95 — Voice line shown only when `isQuiet === true`. Pure
   * presentation; absence is the historical behaviour.
   */
  quietLine?: string
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
