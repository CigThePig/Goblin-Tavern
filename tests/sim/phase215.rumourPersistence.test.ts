// Expansion Phase 8 §8.4 (repo phase 215) / ISSUE-178 — §5.7, §5.9 and
// §5.10 for the rumour network.
//
// Phase 8.4's lifecycle crosses:
//
//   rumourUpdate       origins, propagation, reinforcement, contradiction,
//                      decay and the escalation review
//   applyOwnerActions  denying, countering, naming the source
//   resolveScheduledEvents  escalation, denial backfire, counter runaway
//   endMonth           the prune
//
// On the engine's three segments that is `rumourUpdate` +
// `applyOwnerActions` in A and `resolveScheduledEvents` + `endMonth` in C.
// This file reloads with rumours MID-FLIGHT: partly spread, partly
// believed, some denied, some with a consequence already scheduled.

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
import { ensureRumourNetworkFields } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  RUMOURS_MODULE_ID,
  audiencesOf,
  getRumourModuleState,
  listRumours,
  liveRumours,
} from '../../src/sim/modules/rumours/index'

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

const SEED = 'phase215/rumour-beats'

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

/** A tavern with enough going wrong that the town talks about it. */
function talkedAbout(): TavernState {
  let state = withCoin(createInitialTavernState(), 400)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 200, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 85 })
  state = withArea(state, 'main_room', { cleanliness: 20, damage: 60 })
  for (let day = 0; day <= 26; day += 1) {
    state = simulateDay(state, input(day), FULL_PIPELINE).state
  }
  return state
}

/** Whatever the player could answer today, answered. */
function answers(state: TavernState): SimInput['ownerActions'] {
  const open = liveRumours(state)
    .filter((rumour) => audiencesOf(rumour).length > 0)
    .filter((rumour) => rumour.correctedOnDay === undefined)
  const deniable = open.find((rumour) => !rumour.tags.includes('denied'))
  const counterable = open.find((rumour) => !rumour.counterRumourId)
  return [
    ...(deniable ? [{ actionId: 'deny_rumour', targetId: deniable.id }] : []),
    ...(counterable && counterable.id !== deniable?.id
      ? [{ actionId: 'counter_rumour', targetId: counterable.id }]
      : []),
  ]
}

describe('Phase 215 §5.10 — a reload at every beat the rumour lifecycle crosses', () => {
  const base = talkedAbout()

  it('reaches a state with talk actually in flight', () => {
    const slice = getRumourModuleState(base)
    expect(listRumours(base).length, 'nobody said anything in a month').toBeGreaterThan(0)
    expect(slice.totals.spreads, 'nothing travelled in a month').toBeGreaterThan(0)
    expect(
      listRumours(base).some((rumour) => audiencesOf(rumour).length > 0),
      'no rumour had reached a single ear',
    ).toBe(true)
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

  it('a resumed day spreads the same talk to the same ears as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('a reload cannot make a rumour un-hear or re-hear a channel', () => {
    const before = new Map(
      listRumours(base).map((rumour) => [
        rumour.id,
        audiencesOf(rumour)
          .map((audience) => `${audience.id}:${audience.belief}`)
          .join('|'),
      ]),
    )
    const restored = roundTrip(base, 'closing', 'B')
    for (const rumour of listRumours(restored)) {
      expect(
        audiencesOf(rumour)
          .map((audience) => `${audience.id}:${audience.belief}`)
          .join('|'),
        `"${rumour.label}" changed audience across a reload`,
      ).toBe(before.get(rumour.id))
    }
  })
})

describe('Phase 215 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight of talk is identical run whole or run in three segments', () => {
    let batch = talkedAbout()
    let segmented = talkedAbout()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const actions = answers(batch)

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    expect(getRumourModuleState(batch).totals.spreads).toBeGreaterThan(0)
  })

  it('a scheduled rumour consequence cannot fire twice across a reload', () => {
    const state = talkedAbout()
    const once = simulateDay(state, input(200), FULL_PIPELINE).state
    const reloaded = roundTrip(state, 'report', 'C')
    const twice = simulateDay(reloaded, input(200), FULL_PIPELINE).state
    expect(plain(twice)).toEqual(plain(once))
  })
})

describe('Phase 215 §5.7 — the migration carries an old save forward honestly', () => {
  it('installs the slice without inventing a spread', () => {
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(([id]) => id !== RUMOURS_MODULE_ID),
      ),
    } as TavernState
    const migrated = ensureRumourNetworkFields(stripped) as TavernState
    const slice = getRumourModuleState(migrated)

    expect(slice.channels).toEqual({})
    expect(slice.spreadToday).toEqual([])
    expect(slice.spreadHistory).toEqual([])
    expect(slice.totals.spreads).toBe(0)
    expect(slice.totals.started).toBe(0)

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('gives an old rumour a credibility derived from what the save already said', () => {
    const fresh = createInitialTavernState()
    const legacy = {
      ...fresh,
      world: {
        ...fresh.world,
        socialRumours: {
          r_true: {
            id: 'r_true',
            label: 'The stew is honest',
            topic: 'quality',
            strength: 60,
            accuracy: 'true',
            firstHeardDay: 3,
            lastSpreadDay: 5,
            tags: ['quality'],
          },
          r_false: {
            id: 'r_false',
            label: 'The ale is watered',
            topic: 'quality',
            strength: 60,
            accuracy: 'false',
            firstHeardDay: 3,
            lastSpreadDay: 5,
            tags: ['quality'],
          },
        },
      },
    } as unknown as TavernState

    const migrated = ensureRumourNetworkFields(legacy) as TavernState
    const trueOne = migrated.world.socialRumours['r_true']!
    const falseOne = migrated.world.socialRumours['r_false']!

    expect(trueOne.credibility).toBeGreaterThan(falseOne.credibility ?? 0)
    // Nobody is recorded as having HEARD it — the old save never said so.
    expect(trueOne.audiences ?? []).toEqual([])
    expect(falseOne.audiences ?? []).toEqual([])
    expect(trueOne.hops ?? 0).toBe(0)
    expect(trueOne.strength).toBe(60)

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('leaves an already-migrated state alone', () => {
    const fresh = createInitialTavernState()
    expect(ensureRumourNetworkFields(fresh)).toBe(fresh)
  })
})
