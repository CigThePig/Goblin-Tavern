// Expansion Phase 8 §8.3 (repo phase 215) / ISSUE-178 — §5.7, §5.9 and
// §5.10 for the notable-NPC layer.
//
// Phase 8.3's lifecycle crosses:
//
//   startDay           the availability roster, and `lastSeenDay`
//   applyOwnerActions  accepting, declining, cultivating
//   closing            dealings, then the promotion review
//   endDay             the actor pass, then pruning
//   wrap_up            `npc_proposal_deadline`
//
// On the engine's three segments those are `startDay` + `applyOwnerActions`
// in A, `closing` in B, and `endDay` + `wrap_up` in C — all three. This file
// reloads with PROMOTED NPCS, LIVE OFFERS and announced intent in flight.

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
import { ensureNpcAgencyFields } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  NPCS_MODULE_ID,
  getNpcModuleState,
  listNpcIntents,
  openProposals,
  promotedNpcs,
} from '../../src/sim/modules/npcs/index'

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

const SEED = 'phase215/npc-beats'

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

/** A tavern with enough going wrong that people have become somebodies. */
function tavernWithPeopleOfNote(): TavernState {
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

describe('Phase 215 §5.10 — a reload at every beat the NPC lifecycle crosses', () => {
  const base = tavernWithPeopleOfNote()

  it('reaches a state with promoted people and real dealings', () => {
    const slice = getNpcModuleState(base)
    expect(Object.keys(slice.records).length).toBeGreaterThan(0)
    expect(promotedNpcs(base).length, 'nobody became somebody in a month').toBeGreaterThan(0)
    expect(
      slice.moveHistory.length + listNpcIntents(base).length + openProposals(base).length,
      'nobody did or announced anything in a month',
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

  it('a resumed day makes the same NPC decisions as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })
})

describe('Phase 215 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = tavernWithPeopleOfNote()
    let segmented = tavernWithPeopleOfNote()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const offers = openProposals(batch)
      const actions: SimInput['ownerActions'] =
        offers.length > 0
          ? [{ actionId: 'decline_npc_offer', targetId: offers[0]!.npcId }]
          : Object.keys(batch.world.notableNpcs)
              .sort()
              .slice(0, 3)
              .map((npcId) => ({ actionId: 'cultivate_npc', targetId: npcId }))

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    expect(getNpcModuleState(batch).totals.movesMade).toBeGreaterThan(0)
  })

  it('an exact-once proposal deadline cannot fire twice across a reload', () => {
    const state = tavernWithPeopleOfNote()
    const once = simulateDay(state, input(200), FULL_PIPELINE).state
    const reloaded = roundTrip(state, 'report', 'C')
    const twice = simulateDay(reloaded, input(200), FULL_PIPELINE).state
    expect(plain(twice)).toEqual(plain(once))
  })
})

describe('Phase 215 §5.7 — the migration carries an old save forward honestly', () => {
  it('installs the slice without promoting anybody or inventing a dealing', () => {
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(([id]) => id !== NPCS_MODULE_ID),
      ),
    } as TavernState
    const migrated = ensureNpcAgencyFields(stripped) as TavernState
    const slice = getNpcModuleState(migrated)

    expect(slice.records).toEqual({})
    expect(slice.actors).toEqual({})
    expect(slice.proposals).toEqual({})
    expect(slice.totals.promoted).toBe(0)
    expect(promotedNpcs(migrated)).toEqual([])

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('leaves lastSeenDay ABSENT rather than backdating a visit nobody played', () => {
    const fresh = createInitialTavernState()
    const migrated = ensureNpcAgencyFields({
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(([id]) => id !== NPCS_MODULE_ID),
      ),
    } as TavernState) as TavernState

    for (const npc of Object.values(migrated.world.notableNpcs)) {
      expect(
        npc.lastSeenDay,
        `${npc.id} was given a last-seen day nobody earned`,
      ).toBeUndefined()
      // …and the founding day is untouched, so nothing was shuffled into it.
      expect(npc.firstSeenDay).toBe(fresh.world.notableNpcs[npc.id]!.firstSeenDay)
    }
  })

  it('leaves an already-migrated state alone', () => {
    const fresh = createInitialTavernState()
    expect(ensureNpcAgencyFields(fresh)).toBe(fresh)
  })
})
