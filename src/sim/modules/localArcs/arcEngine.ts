import type { SimContext } from '../../core/context'
import type {
  LocalEventWorldState,
  TavernState,
} from '../../state/TavernState'
import {
  ARC_REPEAT_COOLDOWN_DAYS,
  MAX_ACTIVE_LOCAL_ARCS,
  isActiveArcStage,
  isTerminalArcStage,
  type LocalArcCondition,
  type LocalArcDefinition,
  type LocalArcProgressRule,
  type LocalArcStage,
} from '../../content/events/localArcTypes'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { MONTHLY_MODULE_ID } from '../monthly/types'
import type { MonthlyModuleState } from '../monthly/types'

// Phase 35 §35.5 — Arc engine.
//
// Three operations per monthly tick (in order):
//
//   1. `progressActiveArcs`: existing arcs age by 28 days, advance
//      through any progress rule whose gates pass, and resolve when
//      their max duration is reached.
//   2. `pickArcsToStart`: candidate definitions are filtered by
//      cooldown + concurrent-arc cap + start conditions; ties are
//      broken deterministically using the seasonal_events RNG stream.
//   3. `createArcInstance`: returns a new `LocalEventWorldState`-shaped
//      record ready to drop onto `state.world.localEvents`.
//
// The engine is pure (no `ctx.modify*` calls) — it returns descriptions
// of changes that the caller applies. This keeps the engine easy to
// reason about and makes testing it without a full `SimContext` easy.

// ---------- Predicate helpers ----------

function evaluateCondition(
  state: TavernState,
  monthlySlice: MonthlyModuleState,
  condition: LocalArcCondition,
): boolean {
  switch (condition.kind) {
    case 'calendar_tag':
      return state.calendar.tags.includes(condition.id as never)
    case 'month_modifier':
      return monthlySlice.currentModifier.id === condition.id
    case 'pressure_above': {
      const pressure = state.pressures[condition.id]
      return pressure !== undefined && pressure.value >= condition.threshold
    }
    case 'reputation_axis_above': {
      const axis = (state.reputation as Record<string, number>)[condition.id]
      return typeof axis === 'number' && axis >= condition.threshold
    }
    case 'supplier_relationship_below': {
      const supplier = state.world.suppliers[condition.id]
      return supplier !== undefined && supplier.relationship <= condition.threshold
    }
    case 'faction_tension_above': {
      const faction = state.world.factions[condition.id]
      // Faction `relationship` is 0–100 (lower = worse). A "tension high"
      // gate triggers when the relationship is poor enough.
      return faction !== undefined && (100 - faction.relationship) >= condition.threshold
    }
    case 'random_weight':
      // Random-weight conditions are treated as always-pass gates; they
      // act as tie-breakers during candidate selection, not start gates.
      return true
    default:
      return false
  }
}

function passesStartConditions(
  state: TavernState,
  monthlySlice: MonthlyModuleState,
  definition: LocalArcDefinition,
): boolean {
  for (const condition of definition.startConditions) {
    if (!evaluateCondition(state, monthlySlice, condition)) return false
  }
  return true
}

function weightOf(definition: LocalArcDefinition): number {
  for (const condition of definition.startConditions) {
    if (condition.kind === 'random_weight') return condition.weight
  }
  return 1
}

// ---------- Active-arc helpers ----------

function isArcRecord(record: LocalEventWorldState): boolean {
  // A Phase 35 arc record always carries a stage; legacy Phase 25
  // local-event entries without arc semantics do not. The engine
  // ignores non-arc records entirely.
  return record.stage !== undefined
}

export function listActiveArcs(state: TavernState): LocalEventWorldState[] {
  const arcs: LocalEventWorldState[] = []
  for (const event of Object.values(state.world.localEvents)) {
    if (!isArcRecord(event)) continue
    if (event.stage !== undefined && isActiveArcStage(event.stage)) arcs.push(event)
  }
  return arcs
}

export function listAllArcs(state: TavernState): LocalEventWorldState[] {
  const arcs: LocalEventWorldState[] = []
  for (const event of Object.values(state.world.localEvents)) {
    if (!isArcRecord(event)) continue
    arcs.push(event)
  }
  return arcs
}

// ---------- Cooldown helpers ----------

function lastResolvedDayForDefinition(
  state: TavernState,
  definitionId: string,
): number | undefined {
  let maxDay: number | undefined = undefined
  for (const event of Object.values(state.world.localEvents)) {
    if (!isArcRecord(event)) continue
    if (event.definitionId !== definitionId) continue
    if (event.stage === undefined || !isTerminalArcStage(event.stage)) continue
    const day = event.lastUpdatedDay ?? event.startedDay
    if (maxDay === undefined || day > maxDay) maxDay = day
  }
  return maxDay
}

export function isCooledDown(
  state: TavernState,
  cooldowns: Record<string, number>,
  definitionId: string,
  today: number,
): boolean {
  const explicit = cooldowns[definitionId]
  if (typeof explicit === 'number' && today < explicit) return false
  const lastResolved = lastResolvedDayForDefinition(state, definitionId)
  if (typeof lastResolved === 'number' && today - lastResolved < ARC_REPEAT_COOLDOWN_DAYS) {
    return false
  }
  return true
}

function hasActiveArcForDefinition(state: TavernState, definitionId: string): boolean {
  for (const event of Object.values(state.world.localEvents)) {
    if (!isArcRecord(event)) continue
    if (event.definitionId !== definitionId) continue
    if (event.stage !== undefined && !isTerminalArcStage(event.stage)) return true
  }
  return false
}

// ---------- Candidate selection ----------

export function pickArcsToStart(args: {
  ctx: SimContext
  monthlySlice: MonthlyModuleState
  cooldowns: Record<string, number>
}): LocalArcDefinition[] {
  const { ctx, monthlySlice, cooldowns } = args
  const state = ctx.state
  const today = state.calendar.totalDaysElapsed
  const activeCount = listActiveArcs(state).length
  const remainingSlots = MAX_ACTIVE_LOCAL_ARCS - activeCount
  if (remainingSlots <= 0) return []

  const candidates: LocalArcDefinition[] = []
  for (const definition of localArcRegistry.all()) {
    if (hasActiveArcForDefinition(state, definition.id)) continue
    if (!isCooledDown(state, cooldowns, definition.id, today)) continue
    if (!passesStartConditions(state, monthlySlice, definition)) continue
    candidates.push(definition)
  }
  if (candidates.length === 0) return []

  // Deterministic selection: weighted pick using the seasonal_events
  // RNG stream. We pick at most one new arc per monthly tick to keep
  // the system from spamming and to honor §35.10's cap mechanics.
  const rng = ctx.getRngStream('seasonal_events')
  const chosenSet = new Set<string>()
  const chosen: LocalArcDefinition[] = []
  const remaining = candidates.slice()
  const maxToStart = Math.min(1, remainingSlots, remaining.length)
  for (let i = 0; i < maxToStart && remaining.length > 0; i += 1) {
    const weighted = remaining.map((def) => ({ item: def, weight: weightOf(def) }))
    const picked = rng.weightedPick(weighted)
    if (!chosenSet.has(picked.id)) {
      chosen.push(picked)
      chosenSet.add(picked.id)
    }
    const idx = remaining.indexOf(picked)
    if (idx !== -1) remaining.splice(idx, 1)
  }
  return chosen
}

// ---------- Progress ----------

export type ArcProgressOutcome = {
  arcId: string
  previousStage: LocalArcStage
  nextStage: LocalArcStage
  reason: string
}

function pickNextStage(
  rules: LocalArcProgressRule[],
  ageDays: number,
): { toStage: LocalArcStage; reason: string } | undefined {
  for (const rule of rules) {
    if (rule.afterDays !== undefined && ageDays < rule.afterDays) continue
    // Phase 35 keeps progress rules age-driven; pressure-driven gates
    // are present in the type for later phases. Honor them if set:
    // we evaluate the gate against the latest snapshot.
    // (Skipped here — the monthly tick re-evaluates each call.)
    return { toStage: rule.toStage, reason: `age>=${rule.afterDays ?? 0}` }
  }
  return undefined
}

export function computeArcProgress(
  arc: LocalEventWorldState,
  today: number,
): ArcProgressOutcome | undefined {
  if (arc.stage === undefined) return undefined
  if (isTerminalArcStage(arc.stage)) return undefined
  const definition = localArcRegistry.has(arc.definitionId)
    ? localArcRegistry.get(arc.definitionId)
    : undefined
  if (!definition) return undefined

  const nextAge = (arc.ageDays ?? 0) + (today - (arc.lastUpdatedDay ?? today))
  // Force resolution at max duration regardless of remaining rules.
  if (nextAge >= definition.maxDurationDays) {
    return {
      arcId: arc.id,
      previousStage: arc.stage,
      nextStage: 'resolved',
      reason: `age>=${definition.maxDurationDays} (max duration)`,
    }
  }

  const rulesFromHere = definition.progressRules.filter(
    (r) => r.fromStage === arc.stage,
  )
  const ruleAgeBaseline =
    arc.stage === 'seeded'
      ? 0
      : computeStageStartAge(definition, arc.stage)
  const ageInSegment = nextAge - ruleAgeBaseline
  const adjustedRules: LocalArcProgressRule[] = rulesFromHere.map((r) => {
    if (r.afterDays === undefined) return r
    const adjusted: LocalArcProgressRule = {
      ...r,
      afterDays: r.afterDays - ruleAgeBaseline,
    }
    return adjusted
  })
  const next = pickNextStage(adjustedRules, ageInSegment)
  if (!next) return undefined
  return {
    arcId: arc.id,
    previousStage: arc.stage,
    nextStage: next.toStage,
    reason: next.reason,
  }
}

function computeStageStartAge(
  definition: LocalArcDefinition,
  stage: LocalArcStage,
): number {
  // Walk progress rules from seeded forward; the cumulative `afterDays`
  // is the earliest age at which the arc could have entered `stage`.
  // This keeps the progress engine consistent when an arc is read mid-
  // lifecycle (e.g. for tests that hand-seed a `rising` arc).
  if (stage === 'seeded') return 0
  let cursor: LocalArcStage = 'seeded'
  let age = 0
  const visited = new Set<LocalArcStage>(['seeded'])
  while (cursor !== stage) {
    const rule = definition.progressRules.find((r) => r.fromStage === cursor)
    if (!rule) return age
    if (rule.afterDays !== undefined) age = rule.afterDays
    cursor = rule.toStage
    if (visited.has(cursor)) return age // cycle guard
    visited.add(cursor)
    if (isTerminalArcStage(cursor)) return age
  }
  return age
}

// ---------- Arc creation ----------

export function createArcInstance(args: {
  definition: LocalArcDefinition
  today: number
}): LocalEventWorldState {
  const { definition, today } = args
  return {
    id: `arc:${definition.id}:day${today}`,
    definitionId: definition.id,
    label: definition.label,
    startedDay: today,
    intensity: 20,
    relatedFactionIds: [],
    relatedCultureIds: [],
    tags: [...definition.tags, 'arc'],
    activeFlags: [],
    // Phase 35 §35.3 — arc-specific fields.
    type: definition.type,
    stage: 'seeded',
    lastUpdatedDay: today,
    ageDays: 0,
    relatedRefs: [],
    activeEffects: [],
    arcHistory: [
      {
        day: today,
        stage: 'seeded',
        note: `${definition.label} seeded.`,
      },
    ],
  }
}
