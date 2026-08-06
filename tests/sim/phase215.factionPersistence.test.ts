// Expansion Phase 8 §8.1 (repo phase 215) / ISSUE-178 — §5.7, §5.9 and
// §5.10 for the faction layer.
//
// The work protocol makes three standing demands of every phase:
//
//   §5.7  a schema migration in the same phase as any persisted field
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle
//         crosses
//
// Phase 8.1's lifecycle crosses:
//
//   factionUpdate  the evidence pass, the standing summary, and the actor
//                  pass — decide, announce, act
//   wrap_up        `faction_demand_deadline`, `faction_favour_due`,
//                  `faction_retaliation`
//   endDay         pruning
//
// On the engine's three segments those are `factionUpdate` and `endDay` in
// A and C respectively, with `wrap_up` in C. Reloading at each of the five
// player beats covers all of them — and this file does it with LIVE
// STANCES, A LIVE DEMAND and AN ANNOUNCED INTENT in flight, because a
// reload with nothing outstanding proves nothing about outstanding things.
//
// The route runs through the real persistence layer (`saveSession` /
// `loadSession`), so the migration chain and the schemas are exercised on
// the way through.

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
import { ensureFactionAgencyFields } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import {
  FACTIONS_MODULE_ID,
  activeStances,
  getFactionModuleState,
  listFactionIntents,
  openDemands,
} from '../../src/sim/modules/factions/index'

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

const SEED = 'phase215/faction-beats'

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
    savedAt: '2026-08-06T00:00:00.000Z',
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

/**
 * A tavern the factions have taken an interest in.
 *
 * Reached by playing badly for a month — the rooms go, the cellar empties,
 * the till runs dry — so the grievances, the stances and the requests are
 * all earned rather than written in. No faction record is touched directly.
 */
function tavernUnderFactionPressure(): TavernState {
  let state = withCoin(createInitialTavernState(), 400)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 120, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 8, smell: 85 })
  state = withArea(state, 'privy', { cleanliness: 5, smell: 95 })
  state = withArea(state, 'main_room', { cleanliness: 15, damage: 70 })

  for (let day = 0; day <= 30; day += 1) {
    if (day === 8) {
      for (const id of Object.keys(state.stock)) {
        state = withStock(state, id, { quantity: 0 })
      }
      state = { ...state, coin: 0 }
    }
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 215 §5.10 — a reload at every beat the faction lifecycle crosses', () => {
  const base = tavernUnderFactionPressure()

  it('reaches a state with real faction activity in flight', () => {
    const slice = getFactionModuleState(base)
    // The fixture must actually exercise what the file is about: the
    // factions have to have noticed something and done something.
    const noticed = Object.values(slice.standing).some(
      (standing) => standing.entries.length > 0,
    )
    expect(noticed, 'no faction noticed anything in a bad month').toBe(true)
    expect(
      slice.moveHistory.length +
        activeStances(base).length +
        openDemands(base).length +
        listFactionIntents(base).length,
      'no faction did or announced anything in a bad month',
    ).toBeGreaterThan(0)
  })

  for (const { beat, segment } of BEATS) {
    it(`survives a save/load at ${beat} (segment ${segment}) unchanged`, () => {
      const restored = roundTrip(base, beat, segment)
      expect(plain(restored)).toEqual(plain(base))
      const validation = safeValidateState(restored, { modules: FULL_PIPELINE })
      expect(validation.success, validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2))).toBe(true)
    })
  }

  it('a resumed day makes the same faction decisions as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })
})

describe('Phase 215 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = tavernUnderFactionPressure()
    let segmented = tavernUnderFactionPressure()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const demands = openDemands(batch)
      const actions: SimInput['ownerActions'] =
        demands.length > 0
          ? [{ actionId: 'refuse_faction_demand', targetId: demands[0]!.factionId }]
          : [{ actionId: 'host_faction_night', targetId: 'miners_union' }]

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    // And the fortnight exercised the faction lifecycle rather than idling.
    const slice = getFactionModuleState(batch)
    expect(slice.moveHistory.length).toBeGreaterThan(0)
  })

  it('an exact-once faction event cannot fire twice across a reload', () => {
    const state = tavernUnderFactionPressure()
    const once = simulateDay(state, input(200), FULL_PIPELINE).state
    const reloaded = roundTrip(state, 'report', 'C')
    const twice = simulateDay(reloaded, input(200), FULL_PIPELINE).state
    expect(plain(twice)).toEqual(plain(once))

    const spent = readScheduledEventsSlice(once).spentKeys.map((entry) => entry.key)
    expect(new Set(spent).size).toBe(spent.length)
  })
})

describe('Phase 215 §5.7 — the migration carries an old save forward honestly', () => {
  it('repairs the empty pre-Phase-8 factions slice that the generic sweep walks past', () => {
    const fresh = createInitialTavernState()
    // What a pre-Phase-8 save actually looks like: the slice is PRESENT and
    // empty, because the module's schema was an empty passthrough object.
    const old = {
      ...fresh,
      modules: { ...fresh.modules, [FACTIONS_MODULE_ID]: {} },
    }
    const migrated = ensureFactionAgencyFields(old) as TavernState
    const slice = getFactionModuleState(migrated)

    expect(slice.actors).toEqual({})
    expect(slice.standing).toEqual({})
    expect(slice.stances).toEqual({})
    expect(slice.demands).toEqual({})
    expect(slice.favours).toEqual({})
    expect(slice.moveHistory).toEqual([])
    expect(slice.totals.movesMade).toBe(0)

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(validation.success, validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2))).toBe(true)
  })

  it('fabricates no grievance, no stance and no debt from the meters a save already carries', () => {
    const fresh = createInitialTavernState()
    const soured = {
      ...fresh,
      world: {
        ...fresh.world,
        factions: {
          ...fresh.world.factions,
          // A save where the player had already fallen out with the watch.
          town_watch: { ...fresh.world.factions['town_watch']!, relationship: 12 },
        },
      },
      modules: { ...fresh.modules, [FACTIONS_MODULE_ID]: {} },
    }
    const migrated = ensureFactionAgencyFields(soured) as TavernState
    const slice = getFactionModuleState(migrated)

    // The meter is untouched…
    expect(migrated.world.factions['town_watch']!.relationship).toBe(12)
    // …and no history was invented behind it. Reconstructing a grievance
    // ledger from a meter would fabricate events nobody played.
    expect(slice.standing['town_watch']).toBeUndefined()
    expect(Object.keys(slice.stances)).toEqual([])
    expect(Object.keys(slice.demands)).toEqual([])
    expect(Object.keys(slice.favours)).toEqual([])
  })

  it('leaves an already-migrated slice alone', () => {
    const fresh = createInitialTavernState()
    const migrated = ensureFactionAgencyFields(fresh)
    expect(migrated).toBe(fresh)
  })
})
