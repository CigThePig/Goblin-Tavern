import type { CalendarStamp, EntityRef } from '../../state/TavernState'

// Phase 18 §"Pressure Shape" — runtime/report-facing pressure shape.
//
// The on-state `PressureState` (defined in `state/TavernState.ts`) keeps
// the compact `{ id, label, value, trend, tags, topCauses }` shape so
// existing tests and the diff/cause pipelines keep working. The richer
// Phase 18 shape — severity, urgency, volatility, full cause refs,
// related actors/locations/systems — lives in the pressure module's
// namespaced slice at `state.modules.pressures` as a `PressureSnapshot`.
//
// Storing the rich shape in the module slice (not on state) follows the
// precedent set by Phase 14 (weekly result) and Phase 15 (monthly
// result): the engine's diff/cause layer sees the canonical value, while
// the module slice carries the explanation data.

/** Canonical pressure ids — Phase 18 §"Naming reconciliation". */
export const PRESSURE_IDS = [
  'food_safety',
  'inspection',
  'staff_burnout',
  'pests',
  'debt',
  'maintenance',
  'violence',
  'reputation_drift',
  'stock_shortage',
  'landlord',
] as const

export type PressureId = (typeof PRESSURE_IDS)[number]

export type PressureTrend = 'rising' | 'stable' | 'falling'

/**
 * A single contribution that pushed a pressure up or down on the most
 * recent calculation. The pressure module derives these from runtime
 * state, recent causes, and memories — they are not separate persistent
 * records, just the explanatory breakdown surfaced in reports.
 */
export type PressureCauseRef = {
  /** Stable id for this contribution, scoped to the parent pressure. */
  id: string
  /** Short human-readable label, e.g. "Kitchen cleanliness very low". */
  readable: string
  /** Signed contribution to the pressure value (positive = pushes up). */
  amount: number
  /** Explanatory importance for reports; usually `Math.abs(amount)`. */
  weight: number
  direction: 'increase' | 'decrease' | 'neutral'
  tags: string[]
  relatedActors?: EntityRef[]
  relatedLocations?: EntityRef[]
  relatedSystems?: string[]
}

/** The PressureCalculationResult a calculator returns. */
export type PressureCalculationResult = {
  /** Target value clamped to 0–100. */
  value: number
  /** 0–100, how severe the pressure is right now. */
  severity: number
  /** 0–100, how urgent it feels (combines severity with imminence). */
  urgency: number
  /** Optional 0–100 volatility hint; defaults to delta magnitude. */
  volatility?: number
  /** Ordered list of dominant contributions; first is most explanatory. */
  causes: PressureCauseRef[]
  /** Related actors involved in the dominant causes. */
  relatedActors?: EntityRef[]
  /** Related locations involved in the dominant causes. */
  relatedLocations?: EntityRef[]
  /** Related systems (free-form strings, e.g. "stock", "inspection"). */
  relatedSystems?: string[]
  /** Extra tags to merge onto the on-state pressure. */
  tags?: string[]
  /** Optional consequences-if-ignored hints for the pressure report. */
  consequences?: string[]
}

/**
 * Snapshot of a pressure after a full calculation pass. Lives under
 * `state.modules.pressures.snapshots[id]`. JSON-safe: no class instances,
 * no functions, no Maps.
 */
export type PressureSnapshot = {
  id: PressureId | string
  label: string
  value: number
  previousValue: number
  delta: number
  trend: PressureTrend
  severity: number
  urgency: number
  volatility: number
  causes: PressureCauseRef[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  tags: string[]
  consequences: string[]
  lastUpdated: CalendarStamp
}

/** Recommended trend thresholds. Trends are computed against the previous
 * stored value: |delta| < `stableEpsilon` is "stable". */
export const TREND_STABLE_EPSILON = 1
