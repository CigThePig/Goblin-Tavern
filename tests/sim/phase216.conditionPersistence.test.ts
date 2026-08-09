// Expansion Phase 9 §9.4 (repo phase 216) / ISSUE-179 — §5.7, §5.9 and
// §5.10 for the world-conditions layer.
//
// A condition crosses:
//
//   startDay           forecasts firm up, anything due starts, the running
//                      conditions act and accrue burden, scars drag
//   applyOwnerActions  preparing, countering, exploiting
//   endDay             the reckoning and the pruning
//
// On the engine's three segments those are `startDay` + `applyOwnerActions`
// in A and `endDay` in C — so a reload can land between a condition acting
// and the same condition being paid out, which is the state where a resumed
// day could most easily accrue a second day of burden or hand out the
// aftermath twice.

import { describe, expect, it } from 'vitest'

import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat, DaySegment } from '../../web/src/lib/sim/daySession'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { ensureWorldConditions } from '../../src/sim/state/migrations'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { CONDITIONS_MODULE_ID } from '../../src/sim/modules/conditions/moduleId'
import {
  createInitialConditionsModuleState,
  getConditionsModuleState,
} from '../../src/sim/modules/conditions/index'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}

const SEED = 'phase216/condition-beats'

const BEATS: ReadonlyArray<{ beat: Beat; segment: DaySegment }> = [
  { beat: 'morning', segment: 'A' },
  { beat: 'plan', segment: 'A' },
  { beat: 'service', segment: 'B' },
  { beat: 'closing', segment: 'B' },
  { beat: 'report', segment: 'C' },
]

function input(day: number, actions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function sessionAt(state: TavernState, beat: Beat, segment: DaySegment): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-08-08T00:00:00.000Z',
    simSeed: SEED,
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

function roundTrip(state: TavernState, beat: Beat, segment: DaySegment): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state, beat, segment))
    expect(saved.ok, saved.ok ? '' : saved.reason).toBe(true)
    const outcome = loadSession()
    expect(outcome.kind).toBe('loaded')
    if (outcome.kind !== 'loaded') throw new Error('load failed')
    return outcome.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

function plain(state: TavernState): unknown {
  return JSON.parse(JSON.stringify(state))
}

/** Played far enough that something is running and something is remembered. */
function weatheredHouse(): TavernState {
  let state = withCoin(createInitialTavernState(), 12000)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  for (let day = 0; day < 60; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 216 §5.10 — a reload at every beat a condition crosses', () => {
  const base = weatheredHouse()

  it('reaches a state with a condition running and a record behind it', () => {
    const slice = getConditionsModuleState(base)
    expect(
      slice.active.length + slice.forecasts.length,
      'nothing was happening after two months',
    ).toBeGreaterThan(0)
    expect(slice.totals.started).toBeGreaterThan(0)
    expect(slice.history.length).toBeGreaterThan(0)
  })

  for (const { beat, segment } of BEATS) {
    it(`survives a save/load at ${beat} (segment ${segment}) unchanged`, () => {
      const restored = roundTrip(base, beat, segment)
      expect(plain(restored)).toEqual(plain(base))
      const validation = safeValidateState(restored, { modules: FULL_PIPELINE })
      expect(
        validation.success,
        validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
      ).toBe(true)
    })
  }

  it('a resumed day runs the same condition day as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('does not let a reload accrue a second day of burden', () => {
    const once = simulateDay(base, input(150), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'report', 'C')
    const twice = simulateDay(reloaded, input(150), FULL_PIPELINE).state
    const a = getConditionsModuleState(once)
    const b = getConditionsModuleState(twice)
    expect(b.active.map((e) => Math.round(e.burden))).toEqual(
      a.active.map((e) => Math.round(e.burden)),
    )
    expect(b.totals).toEqual(a.totals)
    expect(plain(twice)).toEqual(plain(once))
  })

  it('hands out no aftermath twice across the ending', () => {
    // The dangerous beat: `endDay` is where a condition is paid out, so a
    // save taken at `report` and resumed is exactly the shape that would
    // double-charge a levy or damage a roof twice.
    let straight = base
    for (let day = 60; day < 120; day += 1) {
      straight = simulateDay(straight, input(day), FULL_PIPELINE).state
    }
    let reloadedEveryDay = base
    for (let day = 60; day < 120; day += 1) {
      reloadedEveryDay = roundTrip(reloadedEveryDay, 'report', 'C')
      reloadedEveryDay = simulateDay(reloadedEveryDay, input(day), FULL_PIPELINE).state
    }
    const a = getConditionsModuleState(straight)
    const b = getConditionsModuleState(reloadedEveryDay)
    expect(b.history.map((r) => `${r.conditionId}:${r.outcome}`)).toEqual(
      a.history.map((r) => `${r.conditionId}:${r.outcome}`),
    )
    expect(b.totals.ended).toBe(a.totals.ended)
    expect(b.totals.scarsLeft).toBe(a.totals.scarsLeft)
    expect(reloadedEveryDay.coin).toBe(straight.coin)
    expect(reloadedEveryDay.areas['roof']!.damage).toBe(
      straight.areas['roof']!.damage,
    )
  })
})

describe('Phase 216 §5.9 — full-day and segmented routes agree', () => {
  it('two months are identical run whole or run in three segments', () => {
    let batch = weatheredHouse()
    let segmented = weatheredHouse()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 60; day < 100; day += 1) {
      batch = simulateDay(batch, input(day), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }
  })
})

describe('Phase 216 §5.7 — the migration carries an old save forward honestly', () => {
  it('seeds the slice a pre-9.4 save does not have at all', () => {
    const fresh = createInitialTavernState()
    const modules = { ...fresh.modules }
    delete (modules as Record<string, unknown>)[CONDITIONS_MODULE_ID]
    const old = { ...fresh, modules } as TavernState
    const migrated = ensureWorldConditions(old)
    expect(migrated.modules[CONDITIONS_MODULE_ID]).toEqual(
      createInitialConditionsModuleState(),
    )
  })

  it('fills only what is missing from a partly-grown slice', () => {
    const fresh = createInitialTavernState()
    const old = {
      ...fresh,
      modules: {
        ...fresh.modules,
        [CONDITIONS_MODULE_ID]: { active: [], forecasts: [] },
      },
    } as TavernState
    const migrated = ensureWorldConditions(old) as TavernState
    const slice = migrated.modules[CONDITIONS_MODULE_ID] as Record<string, unknown>
    expect(slice['active']).toEqual([])
    expect(slice['history']).toEqual([])
    expect(slice['scars']).toEqual([])
    expect(slice['totals']).toBeDefined()
  })

  it('invents no half-finished condition for an old save', () => {
    // The load-bearing judgement. A burden is something the player let
    // build; backdating one would be inventing a decision they never made,
    // so an old save simply starts hearing forecasts like a new one.
    const fresh = createInitialTavernState()
    const modules = { ...fresh.modules }
    delete (modules as Record<string, unknown>)[CONDITIONS_MODULE_ID]
    const migrated = ensureWorldConditions({ ...fresh, modules } as TavernState)
    const slice = getConditionsModuleState(migrated)
    expect(slice.active).toEqual([])
    expect(slice.forecasts).toEqual([])
    expect(slice.scars).toEqual([])
    expect(slice.history).toEqual([])
  })

  it('leaves a slice that already carries the run book alone', () => {
    const played = weatheredHouse()
    expect(ensureWorldConditions(played)).toBe(played)
  })
})
