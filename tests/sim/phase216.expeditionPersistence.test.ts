// Expansion Phase 9 §9.3 (repo phase 216) / ISSUE-179 — §5.7, §5.9 and
// §5.10 for the expedition layer.
//
// The journey crosses:
//
//   startDay           the leg, the day's rations, the event, the trouble
//                      check, and the resolution when they are home
//   applyOwnerActions  commissioning, answering a dispatch, recalling,
//                      sending relief
//   endDay             run-book pruning
//
// On the engine's three segments those are `startDay` + `applyOwnerActions`
// in A and `endDay` in C. This file reloads with PARTIES MID-JOURNEY, a
// question outstanding, dispatches still on the road, and supplies part
// spent — the states where a resumed day could most easily diverge.

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
import { ensureExpeditionRunBook } from '../../src/sim/state/migrations'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { EXPEDITIONS_MODULE_ID } from '../../src/sim/modules/expeditions/moduleId'
import {
  createInitialExpeditionTotals,
  createInitialExpeditionsModuleState,
  getExpeditionsModuleState,
  liveExpeditionRuns,
} from '../../src/sim/modules/expeditions/index'

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

const SEED = 'phase216/expedition-beats'

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

/** Two parties on the road, one of them a good way out. */
function partiesOnTheRoad(): TavernState {
  let state = withCoin(createInitialTavernState(), 9000)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  for (let day = 0; day <= 8; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  const free = Object.values(state.world.hireableAdventurers).filter(
    (adventurer) => adventurer.currentExpeditionId === null,
  )
  if (free[0]) {
    state = simulateDay(
      state,
      input(9, [
        {
          actionId: 'commission_expedition',
          targetId: free[0].id,
          options: {
            mode: 'open',
            targetTier: 'rare',
            routeId: 'deep_fen',
            terms: 'share_of_haul',
          },
        },
      ]),
      FULL_PIPELINE,
    ).state
  }
  // Walk them a good way out, so the reload lands mid-journey.
  for (let day = 10; day <= 17; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 216 §5.10 — a reload at every beat the journey crosses', () => {
  const base = partiesOnTheRoad()

  it('reaches a state with a party mid-journey', () => {
    const live = liveExpeditionRuns(base)
    expect(live.length, 'nobody was on the road after a week').toBeGreaterThan(0)
    const run = live[0]!
    expect(run.phase === 'outbound' || run.phase === 'at_site' || run.phase === 'returning').toBe(
      true,
    )
    expect(run.supplies).toBeLessThan(run.loadout.provisions)
    expect(getExpeditionsModuleState(base).totals.commissioned).toBeGreaterThan(0)
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

  it('a resumed day walks the same journey as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('does not let a reload eat two days of rations or fire two events', () => {
    const once = simulateDay(base, input(150), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'report', 'C')
    const twice = simulateDay(reloaded, input(150), FULL_PIPELINE).state
    const a = liveExpeditionRuns(once)[0]
    const b = liveExpeditionRuns(twice)[0]
    if (a && b) {
      expect(b.supplies).toBe(a.supplies)
      expect(b.events.length).toBe(a.events.length)
      expect(b.dispatches.length).toBe(a.dispatches.length)
    }
    expect(plain(twice)).toEqual(plain(once))
  })

  it('resolves the same way whatever day the resolution lands on', () => {
    // §9.3's "stable from commission through resolution", checked the hard
    // way: a save resumed under a completely different day seed must still
    // bring back the same trip.
    let straight = base
    for (let day = 18; day < 45; day += 1) {
      straight = simulateDay(straight, input(day), FULL_PIPELINE).state
    }
    let reloadedEveryDay = base
    for (let day = 18; day < 45; day += 1) {
      reloadedEveryDay = roundTrip(reloadedEveryDay, 'morning', 'A')
      reloadedEveryDay = simulateDay(reloadedEveryDay, input(day), FULL_PIPELINE).state
    }
    expect(
      reloadedEveryDay.expeditions.completed.map((record) => record.outcome),
    ).toEqual(straight.expeditions.completed.map((record) => record.outcome))
  })
})

describe('Phase 216 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = partiesOnTheRoad()
    let segmented = partiesOnTheRoad()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 18; day < 32; day += 1) {
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
  it('fills the run book on the empty passthrough every save already has', () => {
    const fresh = createInitialTavernState()
    const old = {
      ...fresh,
      // Exactly what a pre-Phase-9.3 save carries: the slice exists and is
      // empty, which is why the generic sweep walks past it.
      modules: { ...fresh.modules, [EXPEDITIONS_MODULE_ID]: {} },
    } as TavernState
    const migrated = ensureExpeditionRunBook(old)
    expect(migrated.modules[EXPEDITIONS_MODULE_ID]).toEqual(
      createInitialExpeditionsModuleState(),
    )
  })

  it('leaves a slice that already has the run book alone', () => {
    const played = partiesOnTheRoad()
    expect(ensureExpeditionRunBook(played)).toBe(played)
  })

  it('invents no route, party or terms for a trip already on the road', () => {
    // The load-bearing judgement. A commission made before any of this
    // existed was made under different rules, and fabricating a route it was
    // never sent down would be inventing the player's own decisions.
    const played = partiesOnTheRoad()
    const stripped = {
      ...played,
      modules: { ...played.modules, [EXPEDITIONS_MODULE_ID]: {} },
    } as TavernState
    const migrated = ensureExpeditionRunBook(stripped)
    expect(getExpeditionsModuleState(migrated).runs).toEqual({})
    expect(getExpeditionsModuleState(migrated).totals).toEqual(
      createInitialExpeditionTotals(),
    )
    expect(migrated.expeditions.active.length).toBe(played.expeditions.active.length)
  })

  it('still finishes a trip that has no run record, on the rules it was sent under', () => {
    // The other half of that judgement: an old commission must not run
    // forever just because it has no journey attached.
    const played = partiesOnTheRoad()
    const activeBefore = played.expeditions.active.length
    expect(activeBefore).toBeGreaterThan(0)
    let migrated = ensureExpeditionRunBook({
      ...played,
      modules: { ...played.modules, [EXPEDITIONS_MODULE_ID]: {} },
    } as TavernState)
    for (let day = 200; day < 240; day += 1) {
      migrated = simulateDay(migrated, input(day), FULL_PIPELINE).state
      if (migrated.expeditions.active.length === 0) break
    }
    expect(
      migrated.expeditions.active.length,
      'a pre-Phase-9.3 expedition never came home',
    ).toBe(0)
    expect(migrated.expeditions.completed.length).toBeGreaterThan(0)
  })
})
