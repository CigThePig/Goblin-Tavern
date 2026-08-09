import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import {
  CONDITION_REPEAT_COOLDOWN_DAYS,
  WORLD_CONDITIONS,
  conditionFor,
  type WorldConditionDefinition,
} from '../../content/conditions/conditionDefinitions'

import {
  MAX_ACTIVE_CONDITIONS,
  MAX_FORECASTS,
  bumpConditionTotal,
  getConditionsModuleState,
  writeConditionsSlice,
  type ActiveCondition,
  type ConditionForecast,
} from './conditionState'

// Expansion Phase 9 §9.4 — how the house hears about it first.
//
// THE FORECAST IS NOT A PREDICTION. Nothing here guesses at a future random
// draw — it could not, because the day's seed does not exist yet. Instead
// the forecast IS the decision: when one is issued it fixes which condition,
// which day it starts, and which day it stops, and the condition that starts
// is exactly the one that was forecast. That makes the warning honest (a
// forecast is never contradicted by the weather) and it makes the whole
// thing reload-safe, because the schedule is state rather than a roll that
// has to come out the same way twice.
//
// CONFIDENCE IS WHAT MAKES IT A FORECAST RATHER THAN A CALENDAR. A thing
// eight days out is a rumour a carter passed on; the same thing tomorrow is
// certain. The player can act on either, but acting early is cheaper — which
// is the whole reason §9.4 lists forecast and counterplay together.

const SOURCE = 'conditions.forecast'

/** How confident the house is, given how far off it still is. */
export function confidenceFor(daysOut: number, leadDays: number): number {
  if (daysOut <= 0) return 100
  const span = Math.max(1, leadDays)
  const ratio = Math.min(1, daysOut / span)
  return Math.round(100 - ratio * 55)
}

/**
 * Has the tavern's own state invited this condition?
 *
 * §9.4 asks for a SOURCE, and "the dice picked it" is the thinnest possible
 * answer. These three preconditions are the ones where the house is
 * genuinely the cause: a cellar left damp and filthy grows mould, a house
 * with a name draws the companies, and a rival who owns the roads is why
 * nobody is walking down yours.
 */
export function preconditionMet(
  state: TavernState,
  definition: WorldConditionDefinition,
): boolean {
  switch (definition.arisesWhen) {
    case 'damp_cellar': {
      const cellar = state.areas['cellar']
      if (!cellar) return false
      return cellar.smell >= 45 || cellar.cleanliness <= 40
    }
    case 'renowned_house':
      return state.reputation.culinary_renown >= 45
    case 'rival_holds_the_roads': {
      const monthly = state.modules['monthly'] as
        | { rivalTavern?: { pressure?: number } }
        | undefined
      return (monthly?.rivalTavern?.pressure ?? 0) >= 55
    }
    default:
      return false
  }
}

/**
 * Conditions that are neither running, already on the board, nor still
 * inside their repeat cooldown.
 *
 * The cooldown is the load-bearing part. The state-driven conditions leave
 * the tavern in exactly the state that invited them — a cellar that grew
 * mould ends with its smell at the ceiling — so without a cooldown the
 * forecast picked the same one straight back and a house could spend a year
 * inside one condition.
 */
function candidates(state: TavernState): WorldConditionDefinition[] {
  const slice = getConditionsModuleState(state)
  const today = state.calendar.totalDaysElapsed
  const taken = new Set([
    ...slice.active.map((entry) => entry.conditionId),
    ...slice.forecasts.map((entry) => entry.conditionId),
  ])
  const cooling = new Set(
    slice.history
      .filter(
        (record) => today - record.endedOnDay < CONDITION_REPEAT_COOLDOWN_DAYS,
      )
      .map((record) => record.conditionId),
  )
  return WORLD_CONDITIONS.filter(
    (definition) => !taken.has(definition.id) && !cooling.has(definition.id),
  )
}

/**
 * Issue at most one forecast per day.
 *
 * The cadence is deliberately slack — a world where something is always
 * about to happen is a world where nothing is worth preparing for. The
 * pipeline is what paces it: while two things are already scheduled or
 * running, nothing new is issued at all.
 */
export function issueForecasts(ctx: SimContext): ConditionForecast | undefined {
  const state = ctx.state
  const slice = getConditionsModuleState(state)
  if (slice.forecasts.length >= MAX_FORECASTS) return undefined
  if (slice.active.length + slice.forecasts.length >= MAX_ACTIVE_CONDITIONS) {
    return undefined
  }
  const pool = candidates(state)
  if (pool.length === 0) return undefined

  const today = state.calendar.totalDaysElapsed
  const rng = ctx.getRngStreamByName(`world_conditions_forecast_${today}`)

  // A precondition the house has actually met is worth far more than a
  // draw: it is the difference between weather and consequence.
  const invited = pool.filter((definition) => preconditionMet(state, definition))
  const chanceToday = invited.length > 0 ? 0.35 : 0.12
  if (rng.float() >= chanceToday) return undefined

  const definition =
    invited.length > 0
      ? rng.pick([...invited].sort((a, b) => a.id.localeCompare(b.id)))
      : rng.pick([...pool].sort((a, b) => a.id.localeCompare(b.id)))

  const lead = Math.max(1, definition.forecastLeadDays)
  const startsOnDay = today + rng.int(Math.max(1, Math.round(lead / 2)), lead)
  const duration = rng.int(definition.minDays, definition.maxDays)
  const forecast: ConditionForecast = {
    conditionId: definition.id,
    startsOnDay,
    // `endsOnDay` is the LAST DAY IT RUNS, not the day after. The daily pass
    // acts on the start day and on the end day alike — a condition's last
    // day is a day it was still happening — and expiry is checked at the
    // close of that day, so an exclusive end would give every condition
    // `duration + 1` ticks and push it past the catalogued `maxDays`.
    endsOnDay: startsOnDay + duration - 1,
    confidence: confidenceFor(startsOnDay - today, lead),
    heardOnDay: today,
    sourceActor: definition.source.actor,
    readable: `${definition.omen} (${definition.source.readable})`,
    prepared: 0,
    preparedBy: [],
  }
  writeConditionsSlice(
    ctx,
    (current) => ({ ...current, forecasts: [...current.forecasts, forecast] }),
    'forecast_issued',
  )
  bumpConditionTotal(ctx, 'forecast')
  ctx.addHistory({
    category: 'state_change',
    summary: `Word from ${definition.source.actor}: ${definition.omen}`,
    tags: ['condition', 'forecast', definition.id],
    relatedSystems: ['conditions'],
  })
  return forecast
}

/** Confidence firms up as the day nears. */
export function firmUpForecasts(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getConditionsModuleState(ctx.state)
  if (slice.forecasts.length === 0) return
  let changed = false
  const next = slice.forecasts.map((entry) => {
    const definition = conditionFor(entry.conditionId)
    const confidence = confidenceFor(
      entry.startsOnDay - today,
      definition?.forecastLeadDays ?? 5,
    )
    if (confidence === entry.confidence) return entry
    changed = true
    return { ...entry, confidence }
  })
  if (!changed) return
  writeConditionsSlice(ctx, (current) => ({ ...current, forecasts: next }), 'firm_up')
}

/**
 * Start whatever was due today.
 *
 * Preparation bought against the forecast rides across onto the condition as
 * `preparedness` — which is the mechanical reason to act on a warning rather
 * than wait and see.
 */
export function promoteForecasts(ctx: SimContext): ActiveCondition[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getConditionsModuleState(ctx.state)
  const due = slice.forecasts.filter((entry) => entry.startsOnDay <= today)
  if (due.length === 0) return []

  const started: ActiveCondition[] = []
  let room = MAX_ACTIVE_CONDITIONS - slice.active.length
  const promoted = new Set<string>()
  for (const entry of due) {
    if (room <= 0) break
    const definition = conditionFor(entry.conditionId)
    if (!definition) continue
    started.push({
      conditionId: entry.conditionId,
      startedOnDay: today,
      // Same inclusive convention: `minDays` days of running means the last
      // of them is `minDays - 1` days after the first.
      endsOnDay: Math.max(today + definition.minDays - 1, entry.endsOnDay),
      burden: 0,
      peakBurden: 0,
      preparedness: entry.prepared,
      daysActive: 0,
      counteredDays: 0,
      // Preparation ids ride across so the same prepare cannot be bought
      // twice, once against the forecast and again once it lands.
      counteredBy: [...entry.preparedBy],
      exploited: false,
      exploitGain: 0,
      sourceActor: entry.sourceActor,
      arose: preconditionMet(ctx.state, definition),
    })
    promoted.add(entry.conditionId)
    room -= 1
  }
  if (started.length === 0) return []

  writeConditionsSlice(
    ctx,
    (current) => ({
      ...current,
      active: [...current.active, ...started],
      forecasts: current.forecasts.filter(
        (entry) => !promoted.has(entry.conditionId),
      ),
    }),
    'condition_started',
  )
  for (const entry of started) {
    const definition = conditionFor(entry.conditionId)
    bumpConditionTotal(ctx, 'started')
    if (entry.arose) bumpConditionTotal(ctx, 'arisen')
    ctx.addHistory({
      category: 'state_change',
      summary: `${definition?.source.actor ?? entry.sourceActor} — it has started, and it will run about ${entry.endsOnDay - today + 1} day(s).`,
      tags: ['condition', 'started', entry.conditionId],
      relatedSystems: ['conditions'],
    })
    ctx.addCause({
      source: `${SOURCE}.started`,
      sourceType: 'system',
      target: entry.conditionId,
      targetType: 'global',
      amount: entry.endsOnDay - today + 1,
      direction: 'increase',
      weight: 6,
      readable: `${entry.conditionId.replace(/_/g, ' ')} began${entry.arose ? ' — the house invited it' : ''}.`,
      tags: ['condition', 'started', entry.conditionId],
      relatedSystems: ['conditions'],
    })
  }
  return started
}
