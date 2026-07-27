// Phase 35 §35.2 — Local arc type definitions.
//
// Local arcs are longer-running seasonal or community concerns (mushroom
// blights, festivals, mining booms, inspection campaigns) that start,
// progress through stages, apply modest mechanical effects, and resolve
// over many days or weeks. They live alongside the existing month
// modifiers from Phase 15; arcs do not replace those.
//
// This file defines the structural shapes only. Concrete arc definitions
// live in `localArcRegistry.ts`; per-tavern arc instances live on
// `state.world.localEvents` (the Phase 25 container, extended with
// optional arc-specific fields).

import type { EntityRef } from '../../state/TavernState'

/**
 * Canonical arc archetypes from Phase 35 §35.2. A registry entry's
 * `type` slot picks one of these; multiple definitions may share a
 * single archetype (e.g. two distinct festival arcs).
 */
export type LocalArcType =
  | 'festival_approaching'
  | 'supplier_dispute'
  | 'faction_tension'
  | 'inspection_campaign'
  | 'winter_shortage'
  | 'road_danger'
  | 'religious_pilgrimage'
  | 'mining_boom'
  | 'mushroom_blight'
  | 'rival_tavern_expansion'

/**
 * Arc lifecycle stages (Phase 35 §35.2). An arc starts at `seeded`,
 * climbs through `rising → active → climax`, and ends at either
 * `resolved` (ran its course) or `failed` (cooldown gate kept it
 * inactive). Reports treat `resolved` and `failed` as terminal.
 */
export type LocalArcStage =
  | 'seeded'
  | 'rising'
  | 'active'
  | 'climax'
  | 'resolved'
  | 'failed'

/**
 * Phase 35 §35.2 — start-condition shape. Conditions are evaluated as a
 * conjunction (all must pass) when an arc is being considered. Empty
 * `startConditions` arrays mean "no gating beyond the cap/cooldown".
 *
 * `random_weight` is a tie-breaker rather than a gate: when multiple
 * candidates qualify, the seasonal_events RNG stream picks one
 * deterministically using the supplied weights.
 */
export type LocalArcCondition =
  | { kind: 'calendar_tag'; id: string }
  | { kind: 'month_modifier'; id: string }
  | { kind: 'pressure_above'; id: string; threshold: number }
  | { kind: 'reputation_axis_above'; id: string; threshold: number }
  | { kind: 'supplier_relationship_below'; id: string; threshold: number }
  | { kind: 'faction_tension_above'; id: string; threshold: number }
  | { kind: 'random_weight'; weight: number }

/**
 * Phase 35 §35.2 — progression rule shape. The monthly tick consults
 * each rule whose `fromStage` matches the arc's current stage; the
 * first matching rule advances the arc to `toStage`. Rules without
 * gating conditions advance automatically after `afterDays`.
 */
export type LocalArcProgressRule = {
  fromStage: LocalArcStage
  toStage: LocalArcStage
  afterDays?: number
  pressureAbove?: { pressureId: string; value: number }
  memoryTagPresent?: string
  weight?: number
}

/**
 * Phase 35 §35.7 — arc effect shape. Effects are applied when the arc
 * enters or holds an active stage (rising/active/climax). Each effect
 * targets one downstream system:
 *
 *   - `pressure_delta`: nudges a registered pressure each month.
 *   - `market_condition`: activates a Phase 29 market-condition id.
 *   - `customer_group_modifier`: adds a flag tag to a customer group.
 *   - `supplier_modifier`: adds a flag tag to a supplier.
 *   - `calendar_tag`: adds the tag to the active-arc tag bundle so
 *     downstream systems can branch on it.
 *   - `issue_seed_tag`: feeds Phase 39's expanded issue seed selection.
 *   - `reputation_signal`: nudges a reputation axis modestly.
 */
export type LocalArcEffect =
  | { kind: 'pressure_delta'; id: string; amount: number; tags?: string[] }
  | { kind: 'market_condition'; id: string; tags?: string[] }
  | { kind: 'customer_group_modifier'; id: string; tags?: string[] }
  | { kind: 'supplier_modifier'; id: string; tags?: string[] }
  | { kind: 'calendar_tag'; id: string; tags?: string[] }
  | { kind: 'issue_seed_tag'; id: string; tags?: string[] }
  | { kind: 'reputation_signal'; id: string; amount: number; tags?: string[] }

/**
 * Phase 35 §35.4 — registry definition. `minDurationDays` and
 * `maxDurationDays` bound the entire lifecycle, not individual stages.
 * `possibleIssueSeedTags` is consumed by Phase 39's expanded issue
 * seed work; Phase 35 only stores the strings on the arc instance.
 */
export type LocalArcDefinition = {
  id: string
  type: LocalArcType
  label: string
  tags: string[]
  minDurationDays: number
  maxDurationDays: number
  startConditions: LocalArcCondition[]
  progressRules: LocalArcProgressRule[]
  effects: LocalArcEffect[]
  possibleIssueSeedTags: string[]
}

/**
 * Phase 35 §35.3 — per-tavern arc instance. Stored under
 * `state.world.localEvents` so the Phase 25 container keeps owning the
 * world's longer-running event records. The shape extends — does not
 * fork — the Phase 25 `LocalEventWorldState`: `type`, `stage`,
 * `lastUpdatedDay`, `ageDays`, `relatedRefs`, `activeEffects`, and
 * `history` are added optionally so legacy local-event records (with
 * no arc semantics) still validate.
 *
 * Resolved or failed arcs stay on the record so cooldown checks can
 * see them; the monthly tick gates re-entry on `lastUpdatedDay` plus
 * the cooldown constant.
 */
export type LocalArcHistoryEntry = {
  day: number
  stage: LocalArcStage
  note: string
}

export type LocalArcInstance = {
  id: string
  definitionId: string
  type: LocalArcType
  label: string
  stage: LocalArcStage
  startedAtDay: number
  lastUpdatedDay: number
  ageDays: number
  intensity: number
  relatedRefs: EntityRef[]
  tags: string[]
  activeEffects: string[]
  history: LocalArcHistoryEntry[]
}

/**
 * Phase 35 §35.10 — caps used by the monthly arc engine. Exposed so
 * tests can read the same numbers the engine does.
 */
export const MAX_ACTIVE_LOCAL_ARCS = 3
export const ARC_REPEAT_COOLDOWN_DAYS = 56

/**
 * Active stages are the ones whose effects apply each month. `seeded`
 * has no mechanical effect yet (it merely reserves the slot); the
 * terminal stages stop applying effects.
 */
export const ACTIVE_ARC_STAGES: readonly LocalArcStage[] = [
  'rising',
  'active',
  'climax',
]

export function isActiveArcStage(stage: LocalArcStage): boolean {
  return ACTIVE_ARC_STAGES.includes(stage)
}

export function isTerminalArcStage(stage: LocalArcStage): boolean {
  return stage === 'resolved' || stage === 'failed'
}

/**
 * Phase 204 / audit Wave 5 (`P4-SEAM-005`) — is this arc IN PLAY, as the
 * player would judge it?
 *
 * Distinct from `isActiveArcStage`, which answers a mechanical question:
 * does this arc count against `MAX_ACTIVE_LOCAL_ARCS` and block another
 * of its definition from seeding. `seeded` deliberately does not, and
 * that must not change.
 *
 * The two player-facing surfaces wanted this question and each guessed a
 * different answer: the Local Arcs report section used the mechanical
 * predicate and reported a just-created arc as `(none)`, while the
 * monthly overview inlined "not resolved and not failed" and listed it.
 */
export function isPresentedArcStage(stage: LocalArcStage): boolean {
  return !isTerminalArcStage(stage)
}
