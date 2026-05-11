// Phase 14 — Weekly routine module types.
//
// The weekly module accumulates daily activity across a 7-day window and,
// at the end of the week, resolves wages, summarizes profit/loss, surfaces
// a maintenance backlog, applies modest staff/customer trend adjustments,
// and accumulates reputation signals. Phase 14 §"Do Not Do" — no rent,
// no landlord cards, no issue seeds, no narrative; this is data only.

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

  /** Last finalized weekly result. Set on endWeek, cleared at next week start. */
  lastWeeklyResult?: WeeklyResult

  /** Phase 14 §14.3 — supplier invoice placeholder. Always empty in Option A. */
  supplierInvoices: SupplierInvoice[]

  /** Has the current accumulation window already had endWeek run on it? */
  weekFinalized: boolean
}
