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

// Phase 38 §38.1 — Expanded pressure ids.
//
// Layered on top of the Phase 18 canonical list rather than replacing it
// so existing tests and consumers keep working. The expanded calculators
// read memories (Phase 36), attributions (Phase 37), suppliers,
// regulars, factions, owner projects/policies, and local arcs to produce
// social, market, and arc pressures.
export const EXPANDED_PRESSURE_IDS = [
  'supplier_distrust',
  'regular_customer_loss',
  'staff_loyalty_risk',
  'faction_anger',
  'cultural_tension',
  'rival_tavern_pressure',
  'festival_readiness',
  'market_instability',
  'rumour_pressure',
  'policy_backlash',
  'arc_escalation',
] as const

export type ExpandedPressureId = (typeof EXPANDED_PRESSURE_IDS)[number]
export type AnyPressureId = PressureId | ExpandedPressureId | string

// Phase 38 §38.16 — Pressure category buckets used by the report.
export type PressureCategory = 'core' | 'social' | 'market' | 'arc'

export const EXPANDED_PRESSURE_CATEGORIES: Record<ExpandedPressureId, PressureCategory> = {
  supplier_distrust: 'market',
  regular_customer_loss: 'social',
  staff_loyalty_risk: 'social',
  faction_anger: 'social',
  cultural_tension: 'social',
  rival_tavern_pressure: 'market',
  festival_readiness: 'arc',
  market_instability: 'market',
  rumour_pressure: 'social',
  policy_backlash: 'social',
  arc_escalation: 'arc',
}

export type PressureTrend = 'rising' | 'stable' | 'falling'

// Phase 188 — starting fairness. Pressure calculators may classify why a
// cause exists so player-facing issue generation can distinguish inherited
// tavern problems from choices the player caused or ignored. Optional for
// save compatibility: older snapshots simply read as `unknown`.
export type PressureCauseOrigin =
  | 'inherited'
  | 'discovered'
  | 'warned'
  | 'player_caused'
  | 'neglected'
  | 'decay'
  | 'external'
  | 'memory'
  | 'unknown'

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
  /** Fairness provenance for player-facing card gates. */
  origin?: PressureCauseOrigin
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
