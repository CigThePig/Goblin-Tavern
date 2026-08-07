// Expansion Phase 8 §8.2 (repo phase 215) / ISSUE-178 — §5.7, §5.9 and
// §5.10 for the culture layer.
//
// Phase 8.2's lifecycle crosses:
//
//   cultureUpdate  the meter summary, preference shifts, recommendations
//   applyOwnerActions  making amends, marking an observance
//   closing        the service-evidence pass, observance resolution,
//                  misunderstanding review, pruning
//
// On the engine's three segments those are `cultureUpdate` and
// `applyOwnerActions` in A and `closing` in B. Reloading at each of the five
// player beats covers them — and this file does it with LIVE
// MISUNDERSTANDINGS, EARNED FRICTION and a populated evidence ledger in
// flight, because a reload with nothing outstanding proves nothing about
// outstanding things.

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
import { ensureCultureAgencyFields } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  CULTURES_MODULE_ID,
  activeFriction,
  getCultureModuleState,
  liveMisunderstandings,
} from '../../src/sim/modules/cultures/index'
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from '../../src/sim/content/cultures/cultureRegistry'

ensureRequiredCulturesRegistered()

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

const SEED = 'phase215/culture-beats'

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
    savedAt: '2026-08-07T00:00:00.000Z',
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
 * A tavern the cultures have formed opinions about.
 *
 * Reached by trading for a month in a place that is comfortable in some
 * rooms and not others, so the evidence, the friction and the
 * misunderstandings are all earned rather than written in.
 */
function tavernWithCultureHistory(): TavernState {
  let state = withCoin(createInitialTavernState(), 900)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 25 })
  for (let day = 0; day <= 24; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 215 §5.10 — a reload at every beat the culture lifecycle crosses', () => {
  const base = tavernWithCultureHistory()

  it('reaches a state with real culture history in flight', () => {
    const slice = getCultureModuleState(base)
    const withEvidence = Object.values(slice.standing).filter(
      (standing) => standing.evidence.length > 0,
    )
    expect(withEvidence.length, 'no culture noticed anything in a month').toBeGreaterThan(0)
    const served = Object.values(slice.standing).some(
      (standing) => Object.keys(standing.dishExperience).length > 0,
    )
    expect(served, 'nobody was served anything in a month').toBe(true)
    expect(
      liveMisunderstandings(base).length + activeFriction(base).length + slice.totals.observancesHonoured,
      'nothing outstanding to reload with',
    ).toBeGreaterThan(0)
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

  it('a resumed day reaches the same culture state as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })
})

describe('Phase 215 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = tavernWithCultureHistory()
    let segmented = tavernWithCultureHistory()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const live = liveMisunderstandings(batch)
      const actions: SimInput['ownerActions'] =
        live.length > 0
          ? [{ actionId: 'make_amends_to_culture', targetId: live[0]!.cultureId }]
          : [{ actionId: 'enable_seat_groups_apart' }]

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    // And the fortnight exercised the culture lifecycle rather than idling.
    const slice = getCultureModuleState(batch)
    expect(slice.totals.dishesServed).toBeGreaterThan(0)
  })
})

describe('Phase 215 §5.7 — the migration carries an old save forward honestly', () => {
  it('repairs the empty pre-Phase-8 cultures slice the generic sweep walks past', () => {
    const fresh = createInitialTavernState()
    const old = {
      ...fresh,
      modules: { ...fresh.modules, [CULTURES_MODULE_ID]: {} },
    }
    const migrated = ensureCultureAgencyFields(old) as TavernState
    const slice = getCultureModuleState(migrated)

    expect(slice.standing).toEqual({})
    expect(slice.misunderstandings).toEqual({})
    expect(slice.friction).toEqual({})
    expect(slice.evidenceToday).toEqual([])
    expect(slice.totals.dishesServed).toBe(0)

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('derives trust from the comfort and tension the save already carries', () => {
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      world: {
        ...fresh.world,
        cultures: Object.fromEntries(
          Object.entries(fresh.world.cultures).map(([id, culture]) => {
            const { trust: _dropped, ...rest } = culture
            return [id, rest]
          }),
        ),
      },
      modules: { ...fresh.modules, [CULTURES_MODULE_ID]: {} },
    } as unknown as TavernState

    // A save where the player had made one culture very comfortable and
    // another very tense.
    const warmed = {
      ...stripped,
      world: {
        ...stripped.world,
        cultures: {
          ...stripped.world.cultures,
          goblin_local: { ...stripped.world.cultures['goblin_local']!, comfort: 95, tension: 5 },
          ogre_clans: { ...stripped.world.cultures['ogre_clans']!, comfort: 10, tension: 90 },
        },
      },
    }

    const migrated = ensureCultureAgencyFields(warmed) as TavernState
    const goblins = migrated.world.cultures['goblin_local']!
    const ogres = migrated.world.cultures['ogre_clans']!

    expect(goblins.trust).toBeDefined()
    expect(ogres.trust).toBeDefined()
    // The comfortable, untense culture trusts more than its anchor; the
    // tense one trusts less. Nothing was rolled and nothing was invented.
    expect(goblins.trust!).toBeGreaterThan(cultureRegistry.get('goblin_local').defaultTrust)
    expect(ogres.trust!).toBeLessThan(cultureRegistry.get('ogre_clans').defaultTrust)
    for (const culture of Object.values(migrated.world.cultures)) {
      expect(culture.trust!).toBeGreaterThanOrEqual(0)
      expect(culture.trust!).toBeLessThanOrEqual(100)
    }
  })

  it('fabricates no evidence, no friction and no dispute from the meters', () => {
    const fresh = createInitialTavernState()
    const soured = {
      ...fresh,
      world: {
        ...fresh.world,
        cultures: {
          ...fresh.world.cultures,
          merchant_roadfolk: {
            ...fresh.world.cultures['merchant_roadfolk']!,
            tension: 95,
          },
        },
      },
      modules: { ...fresh.modules, [CULTURES_MODULE_ID]: {} },
    }
    const migrated = ensureCultureAgencyFields(soured) as TavernState
    const slice = getCultureModuleState(migrated)

    expect(migrated.world.cultures['merchant_roadfolk']!.tension).toBe(95)
    expect(slice.standing['merchant_roadfolk']).toBeUndefined()
    expect(Object.keys(slice.friction)).toEqual([])
    expect(Object.keys(slice.misunderstandings)).toEqual([])
  })

  it('leaves an already-migrated state alone', () => {
    const fresh = createInitialTavernState()
    expect(ensureCultureAgencyFields(fresh)).toBe(fresh)
  })
})
