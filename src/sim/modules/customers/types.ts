import type { ShortageRecord } from '../stock/types'

// Phase 10 — Customer module types.
//
// `CustomerGroupDefinition` mirrors the area/stock registry pattern.
// `CustomerForecast` is the per-group projection produced during the
// `forecastTraffic` phase and consumed by Phase 12 (Daily Service) — see
// the forward note in Phase 10 §10.3 ("Phase 12 reads the forecast and
// converts it into actual turnout numbers"). Phase 10 itself uses the
// forecast immediately to resolve simple turnout during `service`, but the
// shape is the public contract.
//
// `CustomerTurnout` is the post-service summary used by reports and by
// satisfaction logic. The shape is intentionally small in Phase 10;
// Phase 12 will extend it.

export type CustomerForecast = {
  groupId: string
  /** Projected visitor count for the day (>= 0). */
  expected: number
  /** Day-type modifier component (informational, can be negative). */
  dayTypeModifier: number
  /** Satisfaction modifier component (informational, can be negative). */
  satisfactionModifier: number
  /** Cleanliness penalty component (>= 0, expressed as a subtraction). */
  cleanlinessPenalty: number
  /** Price-sensitivity penalty component (>= 0, expressed as a subtraction). */
  pricePenalty: number
  /** Stock-availability/preference modifier (informational, can be negative). */
  stockModifier: number
  /** Free-form notes for the customer report. */
  notes: string[]
}

export type CustomerTurnout = {
  groupId: string
  /** Visitors who actually arrived (>= 0). */
  visitors: number
  /** Total coin earned from this group via the Phase 9 ledger. */
  coinEarned: number
  /** Net satisfaction change applied this day (can be negative). */
  satisfactionChange: number
  /** Shortage records the group experienced (mirrors §9.6). */
  shortages: ShortageRecord[]
  /** Free-form notes for the customer report. */
  notes: string[]
}

export type CustomerModuleState = {
  forecasts: CustomerForecast[]
  turnouts: CustomerTurnout[]
  /**
   * Phase 187 / ISSUE-154 — per-group count of consecutive evaluated
   * services that ended at or below `COMPLAINT_THRESHOLD` satisfaction.
   * Reset to 0 the first service a group recovers above the threshold.
   * Persisted across days (the per-day `startDay` reset preserves it) so
   * the complaint generator can require that dissatisfaction survived at
   * least one decision point before it fires. Plain JSON — keyed by group
   * id, no Maps.
   */
  lowSatisfactionStreak: Record<string, number>
}
