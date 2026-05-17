import type { EntityRef } from '../../state/TavernState'

// Phase 14 — Weekly routine module types.
//
// The weekly module accumulates daily activity across a 7-day window and,
// at the end of the week, resolves wages, summarizes profit/loss, surfaces
// a maintenance backlog, applies modest staff/customer trend adjustments,
// and accumulates reputation signals. Phase 14 §"Do Not Do" — no rent,
// no landlord cards, no issue seeds, no narrative; this is data only.
//
// Phase 34 §34.1 — adds the `community` block to `WeeklyResult`. The block
// surfaces supplier/regular/faction trend entries plus the rumours
// generated for the week. Trend entries are deterministic summaries fed
// by service scenes, social actions, and policy state from Phases 32–33;
// rumours persist on `state.world.socialRumours` when they matter beyond
// the current report. Card prose is forbidden (Phase 21 contract); these
// records are structured "ingredients" only.

export type WeeklySignalAxis =
  | 'cheap'
  | 'filthy'
  | 'dangerous'
  | 'tasty'
  | 'reliable'

export type WeeklySignalTotals = Record<WeeklySignalAxis, number>

export type WeeklyEconomyTotals = {
  sales: number
  purchases: number
  repairs: number
  wages: number
  rent: number
  waste: number
  other: number
  net: number
}

export type WeeklyWageResolution = {
  totalDue: number
  paid: boolean
  paidAmount: number
  unpaidStaffIds: string[]
}

export type MaintenanceBacklogEntry = {
  areaId: string
  reasons: string[]
  severity: number
}

export type StaffWeeklyTrendEntry = {
  staffId: string
  moraleDelta: number
  stressDelta: number
  fatigueDelta: number
  loyaltyDelta: number
  notes: string[]
}

export type CustomerWeeklyTrendEntry = {
  groupId: string
  patronageDelta: number
  loyaltyDelta: number
  averageSatisfaction: number
  totalTraffic: number
  shortageCount: number
  notes: string[]
}

// Phase 14 §14.3 — supplier invoice placeholder shape. Phase 14 ships
// Option A (immediate-payment restocking) so this list is always empty
// at the moment, but the shape is reserved so later phases can opt into
// Option B without a schema migration.
export type SupplierInvoice = {
  id: string
  amount: number
  dueWeek: number
  paid: boolean
  relatedStockIds: string[]
}

// Phase 34 §34.1 — Weekly community trend entries.
//
// Each entry summarizes a single named world entity's movement across
// the week. Deltas are bounded; the weekly community routine resists
// large single-week swings so the simulation stays steady. `notes` is a
// debug-friendly list of plain strings — not card prose.
export type WeeklySupplierTrendEntry = {
  supplierId: string
  relationshipDelta: number
  reliabilityDelta: number
  pricePressureDelta: number
  notes: string[]
}

export type WeeklyRegularTrendEntry = {
  regularId: string
  loyaltyDelta: number
  irritationDelta: number
  visitsThisWeek: number
  notes: string[]
}

export type WeeklyFactionTrendEntry = {
  factionId: string
  satisfactionDelta: number
  tensionDelta: number
  notes: string[]
}

// Phase 34 §34.6 — Weekly community rumour record. Rumours that matter
// beyond the report are also written to `state.world.socialRumours`
// using the canonical Phase 25 `SocialRumourState` shape; the weekly
// version is a flatter view exposed on `WeeklyResult.community.rumours`
// so the report and downstream readers don't have to re-walk world
// state. `id` matches the world-state record when one exists.
export type WeeklyCommunityRumourSource =
  | 'service_scene'
  | 'memory'
  | 'policy'
  | 'incident'
  | 'supplier'
  | 'faction'

export type WeeklyCommunityRumourAccuracy = 'true' | 'partial' | 'false' | 'unknown'

export type WeeklyCommunityRumour = {
  id: string
  sourceType: WeeklyCommunityRumourSource
  sourceId: string
  strength: number
  accuracy: WeeklyCommunityRumourAccuracy
  tags: string[]
  involvedRefs: EntityRef[]
  summary: string
}

export type WeeklyCommunityResult = {
  supplierTrend: WeeklySupplierTrendEntry[]
  regularTrend: WeeklyRegularTrendEntry[]
  factionTrend: WeeklyFactionTrendEntry[]
  rumours: WeeklyCommunityRumour[]
  notes: string[]
}

export type WeeklyResult = {
  weekKey: string
  weekNumber: number
  monthNumber: number
  yearNumber: number
  endDay: number

  economy: WeeklyEconomyTotals
  wages: WeeklyWageResolution

  maintenance: MaintenanceBacklogEntry[]
  staffTrend: StaffWeeklyTrendEntry[]
  customerTrend: CustomerWeeklyTrendEntry[]

  topRevenueSource?: string
  largestCost?: string
  bestGroupId?: string
  worstGroupId?: string

  signals: WeeklySignalTotals
  signalNotes: string[]

  supplierInvoices: SupplierInvoice[]

  // Phase 34 §34.1 — Weekly community block. Always present; the
  // arrays are empty on weeks where nothing in the community moved.
  community: WeeklyCommunityResult
}

export type WeeklyModuleState = {
  /** Calendar coordinate of the week currently being accumulated. */
  weekKey: string
  weekNumber: number
  monthNumber: number
  yearNumber: number

  /** Day the week started accumulating on (1..28). */
  startedOnDay: number

  /** Customer-group satisfaction snapshot taken at week start. */
  startingSatisfaction: Record<string, number>
  /** Customer-group patronage snapshot taken at week start. */
  startingPatronage: Record<string, number>

  /** Per-group total visitors accumulated this week. */
  trafficByGroup: Record<string, number>
  /** Per-group running sum/count for satisfaction average. */
  satisfactionSumByGroup: Record<string, number>
  satisfactionSamplesByGroup: Record<string, number>
  /** Per-group shortage event count. */
  shortageCountByGroup: Record<string, number>

  /** Per-stock-id total shortage events this week. */
  shortageCountByStock: Record<string, number>

  /** Per-day-type count this week (informational). */
  dayTypeCounts: Record<string, number>

  /** Running coin totals by ledger category for the week. */
  economy: WeeklyEconomyTotals

  /** Per-stock sales coin total for the week (best seller detection). */
  salesByStockId: Record<string, number>

  /** Accumulated reputation-signal totals for the week. */
  signals: WeeklySignalTotals

  /** Notes recorded against signal accumulation (debug-friendly). */
  signalNotes: string[]

  /**
   * Last finalized weekly result. Set on endWeek; persists across the
   * next week's accumulator reset until the next endWeek replaces it.
   * Phase 90 changed this from one-day-of-life to durable: the
   * accumulator reset in `freshAccumulator` carries this pointer over.
   */
  lastWeeklyResult?: WeeklyResult

  /**
   * Bounded buffer of recent finalized weekly results, oldest first.
   * Append-on-finalize; truncate from the front when length exceeds
   * MAX_WEEKLY_HISTORY (12 weeks ≈ 3 months). Added in Phase 90 so the
   * Reports → Weekly screen and future week-over-week analytics have a
   * durable source instead of a single-day pointer.
   */
  weeklyHistory: WeeklyResult[]

  /** Phase 14 §14.3 — supplier invoice placeholder. Always empty in Option A. */
  supplierInvoices: SupplierInvoice[]

  /** Has the current accumulation window already had endWeek run on it? */
  weekFinalized: boolean

  // Phase 34 §34.1 — Weekly community accumulators.
  //
  // These count cross-day signals the weekly community routine reads at
  // `endWeek` to update supplier/regular/faction state. They reset on
  // `startDay` of each new week alongside the other accumulators.
  /** Visits by `regular` id this week (incremented from world.regulars deltas). */
  regularVisitsById: Record<string, number>
  /** Service scenes involving a regular, by regular id. */
  regularSceneCounts: Record<string, number>
  /** Service scenes involving a customer group, by group id. */
  groupSceneCounts: Record<string, number>
  /** Service scene `sceneType` counts. */
  sceneTypeCounts: Record<string, number>
}
