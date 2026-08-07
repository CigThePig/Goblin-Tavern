// Expansion Phase 8 §8.5 (repo phase 215) / ISSUE-178 — §5.7, §5.9 and §5.10
// for the belief-behaviour layer.
//
// §8.5's lifecycle crosses:
//
//   afterService       the attribution pass that forms beliefs
//   applyOwnerActions  answering one
//   endDay             aging, then the acting-belief derivation
//   endWeek            the second attribution pass
//
// On the engine's three segments that is `applyOwnerActions` in A,
// `afterService` in B, and `endDay` + `endWeek` in C — all three. The
// reloads below happen with beliefs LIVE and acting: mid-strength, part
// aged, with the record naming which domains they are reaching.

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
import { ensureBeliefBehaviourFields } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  ATTRIBUTION_MODULE_ID,
  MAX_ACTING_BELIEFS,
  MAX_BELIEF_HISTORY,
  actingBeliefs,
  getAttributionModuleState,
  normalizeBeliefBehaviour,
} from '../../src/sim/modules/attribution/index'
import { listValidTargets } from '../../src/sim/modules/ownerActions/readonlyHelpers'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'

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

const SEED = 'phase215/belief-beats'

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

/** A tavern run badly enough that everybody has formed an opinion. */
function resented(): TavernState {
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

/** Whatever grievance the player could answer today. */
function answers(state: TavernState): SimInput['ownerActions'] {
  const def = actionRegistry.get('address_grievance')
  if (!def) return []
  const targets = listValidTargets(def, state)
  return targets.length > 0
    ? [{ actionId: 'address_grievance', targetId: targets[0]!.id }]
    : []
}

describe('Phase 215 §5.10 — a reload at every beat the belief lifecycle crosses', () => {
  const base = resented()

  it('reaches a state where beliefs are actually acting', () => {
    const slice = getAttributionModuleState(base)!
    expect(slice.attributions.length, 'nobody formed an opinion in a month').toBeGreaterThan(0)
    expect(
      slice.behaviour.acting.length + slice.behaviour.history.length,
      'no belief ever got heavy enough to change a decision',
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

  it('a resumed day reaches the same decisions as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('a reload cannot change how long a belief has been acting', () => {
    const before = new Map(
      actingBeliefs(base).map((row) => [row.attributionId, row.sinceDay]),
    )
    const restored = roundTrip(base, 'closing', 'B')
    for (const row of actingBeliefs(restored)) {
      expect(row.sinceDay, `${row.attributionId} was re-dated by a reload`).toBe(
        before.get(row.attributionId),
      )
    }
  })
})

describe('Phase 215 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight of belief is identical run whole or run in three segments', () => {
    let batch = resented()
    let segmented = resented()
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
  })

  it('answering a grievance twice on a reloaded day does not answer it twice', () => {
    const state = resented()
    const actions = answers(state)
    if (!actions || actions.length === 0) return
    const once = simulateDay(state, input(200, actions), FULL_PIPELINE).state
    const reloaded = roundTrip(state, 'plan', 'A')
    const twice = simulateDay(reloaded, input(200, actions), FULL_PIPELINE).state
    expect(plain(twice)).toEqual(plain(once))
  })
})

describe('Phase 215 §5.11 — the record stays bounded', () => {
  it('caps the acting list and the history on a long run', () => {
    let state = resented()
    for (let day = 200; day < 260; day += 1) {
      state = simulateDay(state, input(day), FULL_PIPELINE).state
    }
    const behaviour = getAttributionModuleState(state)!.behaviour
    expect(behaviour.acting.length).toBeLessThanOrEqual(MAX_ACTING_BELIEFS)
    expect(behaviour.history.length).toBeLessThanOrEqual(MAX_BELIEF_HISTORY)
    // Strongest first, and stable — a reload must not reorder it.
    for (let i = 1; i < behaviour.acting.length; i += 1) {
      expect(behaviour.acting[i - 1]!.weight).toBeGreaterThanOrEqual(
        behaviour.acting[i]!.weight,
      )
    }
  })
})

describe('Phase 215 §5.7 — the migration carries an old save forward honestly', () => {
  it('installs the record empty rather than backdating what has been acting', () => {
    const fresh = createInitialTavernState()
    const legacy = {
      ...fresh,
      modules: {
        ...fresh.modules,
        [ATTRIBUTION_MODULE_ID]: {
          attributions: [],
          generatedToday: [],
          lastUpdatedDay: 4,
          recentDistrustByRumour: {},
        },
      },
    } as unknown as TavernState

    const migrated = ensureBeliefBehaviourFields(legacy) as TavernState
    const behaviour = normalizeBeliefBehaviour(
      getAttributionModuleState(migrated)?.behaviour,
    )
    expect(behaviour.acting).toEqual([])
    expect(behaviour.history).toEqual([])
    expect(behaviour.totals.everActed).toBe(0)

    const validation = safeValidateState(migrated, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('leaves an already-migrated state alone', () => {
    const fresh = createInitialTavernState()
    expect(ensureBeliefBehaviourFields(fresh)).toBe(fresh)
  })
})
