// Expansion Phase 9 §9.4 (repo phase 216) / ISSUE-179 — a month modifier
// becomes a process.
//
// WHAT WAS BROKEN. A modifier was a label, three tags and a sentence. Once a
// month one was drawn; for the next twenty-eight days it subtracted one point
// from a roof or added one to a cellar's smell; `tax_month` had a single
// month-end twist. There was no source beyond the draw, no warning, no
// duration that was not "a month", nothing the player could do about it, and
// nothing left behind when it stopped.
//
// §9.4 names seven things each modifier needs — source, forecast, duration,
// affected systems, counterplay, accumulated consequences, and a report and
// history. This file checks all seven against conditions reached by PLAYING:
// every condition here arrives through the forecast pipeline on a normally
// simulated day, and every counter-move is taken through the owner action a
// player would use.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext, SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/registries/actionRegistry'
import {
  CONDITION_REPEAT_COOLDOWN_DAYS,
  COUNTER_COOLDOWN_DAYS,
  WORLD_CONDITIONS,
  conditionFor,
} from '../../src/sim/content/conditions/conditionDefinitions'
import {
  MAX_ACTIVE_CONDITIONS,
  MAX_CONDITION_HISTORY,
  MAX_SCARS,
  SCAR_LIFETIME_DAYS,
  confidenceFor,
  getConditionsModuleState,
  liveScars,
} from '../../src/sim/modules/conditions/index'
import { getMonthlyModuleState } from '../../src/sim/modules/monthly/monthlyModule'

const SEED = 'phase216/conditions'

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
  seedTag = SEED,
): TavernState {
  return simulateDay(state, { seed: `${seedTag}/${day}`, ownerActions }, FULL_PIPELINE)
    .state
}

function house(coin = 20000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  return state
}

function offers(state: TavernState, actionId: string) {
  ensureRequiredOwnerActionsRegistered()
  const definition = actionRegistry.get(actionId)
  return definition.getValidTargets
    ? definition.getValidTargets({ state } as unknown as SimContext)
    : []
}

/** Play forward until something is running, taking no action. */
function runUntilActive(
  state: TavernState,
  fromDay: number,
  seedTag = SEED,
  maxDays = 90,
): { state: TavernState; day: number } {
  let current = state
  let day = fromDay
  for (let i = 0; i < maxDays; i += 1) {
    if (getConditionsModuleState(current).active.length > 0) break
    current = run(current, day, [], seedTag)
    day += 1
  }
  return { state: current, day }
}

/** Play forward until something has been forecast, taking no action. */
function runUntilForecast(
  state: TavernState,
  fromDay: number,
  seedTag = SEED,
  maxDays = 90,
): { state: TavernState; day: number } {
  let current = state
  let day = fromDay
  for (let i = 0; i < maxDays; i += 1) {
    if (getConditionsModuleState(current).forecasts.length > 0) break
    current = run(current, day, [], seedTag)
    day += 1
  }
  return { state: current, day }
}

describe('Phase 216 §9.4 — every condition declares the seven things', () => {
  it('gives each one a source, affected systems, a duration and a forecast lead', () => {
    for (const definition of WORLD_CONDITIONS) {
      expect(definition.source.actor.length, definition.id).toBeGreaterThan(0)
      expect(definition.source.readable.length, definition.id).toBeGreaterThan(20)
      expect(definition.omen.length, definition.id).toBeGreaterThan(20)
      expect(definition.affects.length, definition.id).toBeGreaterThan(0)
      expect(definition.minDays, definition.id).toBeGreaterThan(0)
      expect(definition.maxDays, definition.id).toBeGreaterThanOrEqual(definition.minDays)
      expect(definition.forecastLeadDays, definition.id).toBeGreaterThan(0)
      expect(definition.burdenPerDay, definition.id).toBeGreaterThan(0)
    }
  })

  it('gives each one counterplay a player could actually reach', () => {
    // The gap this closes: three of the six originally had no way to act on
    // them once they had started, so a player who missed the forecast was
    // back to watching the weather — which is the exact complaint §9.4 makes.
    for (const definition of WORLD_CONDITIONS) {
      const kinds = definition.counterplay.map((move) => move.kind)
      expect(kinds, definition.id).toContain('prepare')
      expect(kinds, definition.id).toContain('counter')
      for (const move of definition.counterplay) {
        expect(move.strength, `${definition.id}:${move.id}`).toBeGreaterThan(0)
        expect(move.readable.length, `${definition.id}:${move.id}`).toBeGreaterThan(20)
      }
    }
  })

  it('makes one preparation worth more than one countering', () => {
    // Not decoration: if being warned did not buy more than reacting, the
    // whole forecast half of §9.4 would be a caption. The two are compared
    // in the same units — burden actually avoided — because preparation is
    // a RATE reduction across the whole run while countering is a lump taken
    // off once, and comparing the raw `strength` numbers would be comparing
    // a percentage with a quantity.
    for (const definition of WORLD_CONDITIONS) {
      const prepare = definition.counterplay.find((m) => m.kind === 'prepare')!
      const counter = definition.counterplay.find((m) => m.kind === 'counter')!
      const typicalDays = (definition.minDays + definition.maxDays) / 2
      const avoidedByPreparing =
        definition.burdenPerDay *
        typicalDays *
        (1 - Math.max(0.3, 1 - prepare.strength / 100))
      expect(avoidedByPreparing, definition.id).toBeGreaterThan(counter.strength)
    }
  })

  it('declares an aftermath that can end clean', () => {
    for (const definition of WORLD_CONDITIONS) {
      expect(definition.aftermath.cleanBelow, definition.id).toBeGreaterThan(0)
      expect(definition.aftermath.severityDivisor, definition.id).toBeGreaterThan(0)
      expect(definition.aftermath.readable.length, definition.id).toBeGreaterThan(20)
    }
  })
})

describe('Phase 216 §9.4 — the forecast', () => {
  it('reaches the house before the condition does, with a named source', () => {
    const found = runUntilForecast(house(), 0)
    const slice = getConditionsModuleState(found.state)
    expect(slice.forecasts.length).toBeGreaterThan(0)
    const forecast = slice.forecasts[0]!
    // The whole point: it is heard BEFORE it starts.
    expect(forecast.startsOnDay).toBeGreaterThan(forecast.heardOnDay)
    expect(forecast.sourceActor.length).toBeGreaterThan(0)
    expect(forecast.readable.length).toBeGreaterThan(20)
    expect(forecast.confidence).toBeGreaterThan(0)
    expect(forecast.confidence).toBeLessThanOrEqual(100)
  })

  it('firms up as the day nears rather than being certain from the start', () => {
    expect(confidenceFor(0, 6)).toBe(100)
    expect(confidenceFor(6, 6)).toBeLessThan(confidenceFor(2, 6))
    expect(confidenceFor(2, 6)).toBeLessThan(confidenceFor(1, 6))

    // And through the sim: a live forecast's confidence rises as it nears.
    let found = runUntilForecast(house(), 0)
    const first = getConditionsModuleState(found.state).forecasts[0]!
    let state = found.state
    let day = found.day
    let later = first
    for (let i = 0; i < 3; i += 1) {
      state = run(state, day, [], SEED)
      day += 1
      const match = getConditionsModuleState(state).forecasts.find(
        (entry) => entry.conditionId === first.conditionId,
      )
      if (!match) break
      later = match
    }
    expect(later.confidence).toBeGreaterThanOrEqual(first.confidence)
  })

  it('starts exactly what it said it would, on the day it said', () => {
    // The forecast IS the decision, not a prediction of a future roll —
    // which is what makes it honest and what makes it reload-safe.
    const found = runUntilForecast(house(), 0)
    const forecast = getConditionsModuleState(found.state).forecasts[0]!
    let state = found.state
    let day = found.day
    for (let i = 0; i < 20; i += 1) {
      const active = getConditionsModuleState(state).active.find(
        (entry) => entry.conditionId === forecast.conditionId,
      )
      if (active) {
        expect(active.startedOnDay).toBe(forecast.startsOnDay)
        return
      }
      state = run(state, day, [], SEED)
      day += 1
    }
    throw new Error('the forecast condition never started')
  })
})

describe('Phase 216 §9.4 — duration and bounds', () => {
  it('runs for its own span rather than for a calendar month', () => {
    const found = runUntilActive(house(), 0)
    const entry = getConditionsModuleState(found.state).active[0]!
    const definition = conditionFor(entry.conditionId)!
    // `endsOnDay` is the LAST DAY IT RUNS, so the span is inclusive.
    const span = entry.endsOnDay - entry.startedOnDay + 1
    expect(span).toBeGreaterThanOrEqual(definition.minDays)
    expect(span).toBeLessThanOrEqual(definition.maxDays)
  })

  it('accrues exactly as many daily ticks as its duration promises', () => {
    // The off-by-one this guards: the daily pass acts on the start day AND
    // the end day, and expiry is checked at the close of the end day. An
    // exclusive `endsOnDay` gave every condition one tick more than its
    // drawn duration — over the catalogued `maxDays`, and a bigger
    // aftermath than the duration promised.
    let state = house()
    let checked = 0
    for (let day = 0; day < 220 && checked < 3; day += 1) {
      const before = getConditionsModuleState(state)
      state = run(state, day, [], `${SEED}/ticks`)
      const after = getConditionsModuleState(state)
      if (after.history.length <= before.history.length) continue
      const record = after.history.at(-1)!
      const definition = conditionFor(record.conditionId)
      if (!definition) continue
      const ticks = record.endedOnDay - record.startedOnDay + 1
      expect(ticks, record.conditionId).toBeGreaterThanOrEqual(definition.minDays)
      expect(ticks, record.conditionId).toBeLessThanOrEqual(definition.maxDays)
      checked += 1
    }
    expect(checked, 'no condition ever ended').toBeGreaterThan(0)
  })

  it('never runs more than the declared cap at once, across a long game', () => {
    let state = house()
    let peak = 0
    for (let day = 0; day < 150; day += 1) {
      state = run(state, day, [], `${SEED}/cap`)
      peak = Math.max(peak, getConditionsModuleState(state).active.length)
    }
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(MAX_ACTIVE_CONDITIONS)
  })

  it('bounds history and scars however long the game runs (§5.11)', () => {
    let state = house()
    for (let day = 0; day < 220; day += 1) {
      state = run(state, day, [], `${SEED}/bounds`)
    }
    const slice = getConditionsModuleState(state)
    expect(slice.history.length).toBeLessThanOrEqual(MAX_CONDITION_HISTORY)
    expect(slice.scars.length).toBeLessThanOrEqual(MAX_SCARS)
    for (const scar of slice.scars) {
      expect(scar.expiresOnDay - scar.createdOnDay).toBe(SCAR_LIFETIME_DAYS)
    }
  })

  it('does not let the same condition come straight back', () => {
    // The loop this closes: the state-driven conditions leave the tavern in
    // exactly the state that invited them, so without a cooldown a cellar
    // that grew mould grew it again immediately and forever.
    let state = house()
    for (let day = 0; day < 200; day += 1) {
      state = run(state, day, [], `${SEED}/cooldown`)
    }
    const history = getConditionsModuleState(state).history
    const byCondition = new Map<string, number[]>()
    for (const record of history) {
      byCondition.set(record.conditionId, [
        ...(byCondition.get(record.conditionId) ?? []),
        record.startedOnDay,
      ])
    }
    for (const [id, starts] of byCondition) {
      const ends = history
        .filter((r) => r.conditionId === id)
        .map((r) => r.endedOnDay)
        .sort((a, b) => a - b)
      const sorted = [...starts].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]! - ends[i - 1]!, id).toBeGreaterThanOrEqual(
          CONDITION_REPEAT_COOLDOWN_DAYS,
        )
      }
    }
    expect(history.length).toBeGreaterThan(2)
  })
})

describe('Phase 216 §9.4 — the burden and the counterplay', () => {
  it('builds a burden day by day rather than only nudging a meter', () => {
    const found = runUntilActive(house(), 0)
    const first = getConditionsModuleState(found.state).active[0]!
    let state = found.state
    let day = found.day
    for (let i = 0; i < 4; i += 1) state = run(state, day + i, [], SEED)
    const later = getConditionsModuleState(state).active.find(
      (entry) => entry.conditionId === first.conditionId,
    )
    // Either it is still running with more built up, or it ended and the
    // record carries what it reached.
    if (later) {
      expect(later.burden).toBeGreaterThan(first.burden)
      expect(later.peakBurden).toBeGreaterThanOrEqual(later.burden)
    } else {
      const record = getConditionsModuleState(state).history.find(
        (entry) => entry.conditionId === first.conditionId,
      )!
      expect(record.peakBurden).toBeGreaterThan(first.burden)
    }
  })

  it('offers the countering action only while it is actually running', () => {
    let state = house()
    expect(offers(state, 'counter_condition')).toEqual([])
    const found = runUntilActive(state, 0)
    state = found.state
    const targets = offers(state, 'counter_condition')
    expect(targets.length).toBeGreaterThan(0)
    expect(targets[0]!.id).toContain(':')
  })

  it('takes the burden down when the player works at it', () => {
    const found = runUntilActive(house(), 0)
    let state = found.state
    const target = offers(state, 'counter_condition')[0]!
    const conditionId = target.id.slice(0, target.id.lastIndexOf(':'))
    const before = getConditionsModuleState(state).active.find(
      (entry) => entry.conditionId === conditionId,
    )!.burden
    state = run(
      state,
      found.day,
      [{ actionId: 'counter_condition', targetId: target.id }],
      SEED,
    )
    const after = getConditionsModuleState(state).active.find(
      (entry) => entry.conditionId === conditionId,
    )!
    expect(after.burden).toBeLessThan(before)
    expect(after.counteredDays).toBe(1)
    expect(after.lastCounterDay).toBeDefined()
  })

  it('makes countering repeatable upkeep rather than a single purchase', () => {
    // A once-per-run counter made a fortnight of rain one thing you bought;
    // after that the condition ran unopposed to whatever ceiling it wanted.
    const found = runUntilActive(house(), 0)
    let state = found.state
    const target = offers(state, 'counter_condition')[0]!
    state = run(
      state,
      found.day,
      [{ actionId: 'counter_condition', targetId: target.id }],
      SEED,
    )
    // Immediately after, the same move is off the board.
    expect(offers(state, 'counter_condition').map((t) => t.id)).not.toContain(
      target.id,
    )
    // After the cooldown it is back, provided the condition is still running.
    let day = found.day + 1
    for (let i = 0; i < COUNTER_COOLDOWN_DAYS; i += 1) {
      state = run(state, day, [], SEED)
      day += 1
    }
    const conditionId = target.id.slice(0, target.id.lastIndexOf(':'))
    const stillRunning = getConditionsModuleState(state).active.some(
      (entry) => entry.conditionId === conditionId,
    )
    if (stillRunning) {
      expect(offers(state, 'counter_condition').map((t) => t.id)).toContain(
        target.id,
      )
    }
  })

  it('lets the player prepare against a forecast, and not after it lands', () => {
    const found = runUntilForecast(house(), 0)
    let state = found.state
    const target = offers(state, 'prepare_for_condition')[0]!
    expect(target).toBeDefined()
    const conditionId = target.id.slice(0, target.id.lastIndexOf(':'))
    state = run(
      state,
      found.day,
      [{ actionId: 'prepare_for_condition', targetId: target.id }],
      SEED,
    )
    const forecast = getConditionsModuleState(state).forecasts.find(
      (entry) => entry.conditionId === conditionId,
    )!
    expect(forecast.prepared).toBeGreaterThan(0)
    expect(forecast.preparedBy.length).toBe(1)

    // Once it has started, preparing is refused with its own reason rather
    // than silently doing nothing.
    let day = found.day + 1
    for (let i = 0; i < 30; i += 1) {
      const active = getConditionsModuleState(state).active.find(
        (entry) => entry.conditionId === conditionId,
      )
      if (active) {
        // The preparation rode across onto the run.
        expect(active.preparedness).toBeGreaterThan(0)
        const definition = actionRegistry.get('prepare_for_condition')
        const verdict = definition.canApply!(
          { state } as unknown as SimContext,
          { actionId: 'prepare_for_condition', targetId: target.id },
        )
        expect(verdict.ok).toBe(false)
        expect(verdict.ok === false && verdict.code).toBe('already_started')
        return
      }
      state = run(state, day, [], SEED)
      day += 1
    }
    throw new Error('the prepared-for condition never started')
  })

  it('makes preparation slow the burden rather than cancel the condition', () => {
    // Sandbags do not stop rain. A prepared house is in the same story as an
    // unprepared one, and that is deliberate.
    const found = runUntilForecast(house(), 0)
    const target = offers(found.state, 'prepare_for_condition')[0]!
    const conditionId = target.id.slice(0, target.id.lastIndexOf(':'))

    function burdenAfter(prepare: boolean): number | undefined {
      let state = found.state
      let day = found.day
      state = run(
        state,
        day,
        prepare ? [{ actionId: 'prepare_for_condition', targetId: target.id }] : [],
        SEED,
      )
      day += 1
      for (let i = 0; i < 24; i += 1) {
        const active = getConditionsModuleState(state).active.find(
          (entry) => entry.conditionId === conditionId,
        )
        if (active && active.daysActive >= 4) return active.burden
        state = run(state, day, [], SEED)
        day += 1
      }
      return undefined
    }

    const prepared = burdenAfter(true)
    const unprepared = burdenAfter(false)
    expect(unprepared).toBeDefined()
    expect(prepared).toBeDefined()
    expect(prepared!).toBeGreaterThan(0)
    expect(prepared!).toBeLessThan(unprepared!)
  })
})

describe('Phase 216 §9.4 — the accumulated consequence', () => {
  it('ends clean for a house that engages and scarred for one that does not', () => {
    function play(engage: boolean): {
      state: TavernState
      clean: number
      scarred: number
    } {
      let state = house(30000)
      for (let day = 0; day < 130; day += 1) {
        const actions = engage
          ? ['prepare_for_condition', 'counter_condition'].flatMap((id) => {
              const target = offers(state, id)[0]
              return target ? [{ actionId: id, targetId: target.id }] : []
            })
          : []
        state = run(state, day, actions, `${SEED}/engage`)
      }
      const history = getConditionsModuleState(state).history
      return {
        state,
        clean: history.filter((r) => r.outcome !== 'scarred').length,
        scarred: history.filter((r) => r.outcome === 'scarred').length,
      }
    }

    const engaged = play(true)
    const ignored = play(false)
    expect(engaged.clean + engaged.scarred).toBeGreaterThan(2)
    // The headline: the same weather, two different taverns.
    expect(engaged.clean).toBeGreaterThan(ignored.clean)
    expect(ignored.scarred).toBeGreaterThan(engaged.scarred)
  })

  it('pays the leftover burden into the domain that owns it', () => {
    // §5 — a system whose only consequence is its own meter has not done
    // anything. The aftermath has to land where the rest of the sim reads.
    let state = house()
    let sawRoofAftermath = false
    for (let day = 0; day < 200 && !sawRoofAftermath; day += 1) {
      const before = state
      state = run(state, day, [], `${SEED}/aftermath`)
      const ended = getConditionsModuleState(state).history.length >
        getConditionsModuleState(before).history.length
      if (!ended) continue
      const record = getConditionsModuleState(state).history.at(-1)!
      if (record.conditionId !== 'rainy_month' || record.outcome !== 'scarred') {
        continue
      }
      expect(state.areas['roof']!.damage).toBeGreaterThan(
        before.areas['roof']!.damage,
      )
      expect(
        state.causes.some(
          (c) => c.tags.includes('aftermath') && c.tags.includes('rainy_month'),
        ),
      ).toBe(true)
      sawRoofAftermath = true
    }
    expect(sawRoofAftermath).toBe(true)
  })

  it('leaves a bounded, fading scar rather than a permanent meter', () => {
    let state = house()
    let scarDay = -1
    for (let day = 0; day < 200; day += 1) {
      state = run(state, day, [], `${SEED}/scar`)
      if (scarDay < 0 && liveScars(state).length > 0) scarDay = day
    }
    expect(scarDay).toBeGreaterThan(0)
    for (const scar of getConditionsModuleState(state).scars) {
      expect(scar.severity).toBeGreaterThan(0)
      expect(scar.readable.length).toBeGreaterThan(20)
    }
  })
})

describe('Phase 216 §9.4 — an exploited condition pays in coin', () => {
  it('banks takings, not only renown', () => {
    // Every exploit COSTS coin to buy. Converting the whole gain into
    // reputation made the one option the catalogue calls explicitly
    // profitable a guaranteed net loss however long the condition ran.
    let state = house(30000)
    let found = false
    for (let day = 0; day < 200 && !found; day += 1) {
      const target = offers(state, 'exploit_condition')[0]
      state = run(
        state,
        day,
        target ? [{ actionId: 'exploit_condition', targetId: target.id }] : [],
        `${SEED}/exploit`,
      )
      const record = getConditionsModuleState(state).history.at(-1)
      if (record && record.exploited && record.exploitGain > 0) {
        expect(
          state.causes.some(
            (cause) =>
              cause.tags.includes('exploited') && cause.targetType === 'coin',
          ),
          'the exploit paid no coin',
        ).toBe(true)
        found = true
      }
    }
    expect(found, 'no condition was ever exploited to a close').toBe(true)
  })
})

describe('Phase 216 §9.4 — adventurer season reaches the roster', () => {
  it('does something to the adventurers it says it touches', () => {
    // The condition declared `world.hireableAdventurers` among its affected
    // systems and the report printed that claim daily, while nothing
    // anywhere read it — the season's whole premise was inert.
    const definition = conditionFor('adventurer_season')!
    expect(definition.affects).toContain('world.hireableAdventurers')

    let state = house()
    let sawSeason = false
    for (let day = 0; day < 220 && !sawSeason; day += 1) {
      const before = state
      state = run(state, day, [], `${SEED}/season`)
      const active = getConditionsModuleState(state).active
      if (!active.some((entry) => entry.conditionId === 'adventurer_season')) {
        continue
      }
      const moved = Object.values(state.world.hireableAdventurers).some(
        (adventurer) =>
          adventurer.currentExpeditionId === null &&
          adventurer.daysSinceLastJob <
            (before.world.hireableAdventurers[adventurer.id]?.daysSinceLastJob ?? 0),
      )
      if (moved) sawSeason = true
    }
    expect(sawSeason, 'the season never touched the roster').toBe(true)
  })
})

describe('Phase 216 §9.4 — the monthly slice still knows what kind of month it is', () => {
  it('projects the running condition onto currentModifier', () => {
    const found = runUntilActive(house(), 0)
    let state = found.state
    // The projection happens in the monthly module's own startDay, which
    // runs after the conditions module — so read it the day after.
    state = run(state, found.day, [], SEED)
    const active = getConditionsModuleState(state).active
    if (active.length === 0) return
    const dominant = [...active].sort(
      (a, b) => b.burden - a.burden || a.conditionId.localeCompare(b.conditionId),
    )[0]!
    expect(getMonthlyModuleState(state).currentModifier.id).toBe(
      dominant.conditionId,
    )
  })

  it('stops projecting a condition once it has ended', () => {
    // The leak this closes: the projection stood for the rest of the month
    // after the condition stopped, so a finished `tax_month` still added its
    // rent bump at month end and the arc engine's `month_modifier` gate read
    // a condition that was over.
    let state = house()
    let sawProjection = false
    let checked = false
    for (let day = 0; day < 200 && !checked; day += 1) {
      const before = getConditionsModuleState(state)
      state = run(state, day, [], `${SEED}/projection`)
      const after = getConditionsModuleState(state)
      if (after.active.length > 0) {
        sawProjection = true
        continue
      }
      if (!sawProjection || after.history.length === 0) continue
      // Nothing is running. Give the monthly module its next pass to notice.
      state = run(state, day + 1, [], `${SEED}/projection`)
      const ended = new Set(
        getConditionsModuleState(state).history.map((r) => r.conditionId),
      )
      const nowRunning = getConditionsModuleState(state).active
      if (nowRunning.length > 0) continue
      const projected = getMonthlyModuleState(state).currentModifier.id
      // Whatever the month is called now, it is not still the name of a
      // condition that has finished and not restarted.
      expect(
        ended.has(projected) &&
          !nowRunning.some((entry) => entry.conditionId === projected),
      ).toBe(false)
      checked = true
      void before
    }
    expect(checked, 'no condition ever ended while the month ran on').toBe(true)
  })
})

describe('Phase 216 §9.4 — the report says all of it', () => {
  it('names the source, the burden, what it touches and what it will leave', () => {
    const found = runUntilActive(house(), 0)
    const result = simulateDay(
      found.state,
      { seed: `${SEED}/report` },
      FULL_PIPELINE,
    )
    const section = result.reports.find((s) => s.id === 'conditions')
    expect(section).toBeDefined()
    const text = section!.lines.join('\n')
    const slice = getConditionsModuleState(result.state)
    if (slice.active.length > 0) {
      expect(text).toMatch(/building up: \d+\/100/)
      expect(text).toMatch(/touches:/)
      expect(text).toMatch(/it ends with nothing owed|it will leave:/)
    }
    expect(section!.data).toBeDefined()
  })
})
