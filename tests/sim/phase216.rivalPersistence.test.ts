// Expansion Phase 9 §9.1 (repo phase 216) / ISSUE-179 — §5.7, §5.9 and
// §5.10 for the rival layer.
//
// The rival's lifecycle crosses:
//
//   localEventUpdate   the week's takings, courting decay, backing sync,
//                      then decide / announce / act
//   applyOwnerActions  scouting, winning a crowd back, poaching, settling
//   endDay             pruning
//   wrap_up            all four scheduled events
//
// On the engine's three segments those are `localEventUpdate` +
// `applyOwnerActions` in A, and `endDay` + `wrap_up` in C. This file
// reloads with a POSITIONED RIVAL, LIVE CAMPAIGNS, an OPEN SETBACK and an
// ANNOUNCED MOVE in flight.

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
import { ensureRivalSlice } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  BASELINE_CAPABILITY,
  PRIMARY_RIVAL_ID,
  RIVAL_MODULE_ID,
  createInitialRivalModuleState,
  getPrimaryRival,
  getRivalModuleState,
  rivalCapabilityFromRecordedAppeal,
  rivalIntent,
} from '../../src/sim/modules/rival/index'

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

const SEED = 'phase216/rival-beats'

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

/** A house that has given the competition plenty to work with. */
function contestedTavern(): TavernState {
  let state = withCoin(createInitialTavernState(), 2500)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 10, damage: 60, smell: 85 })
  state = withArea(state, 'kitchen', { cleanliness: 10, damage: 30, smell: 90 })
  for (let day = 0; day <= 24; day += 1) {
    const actions: SimInput['ownerActions'] =
      day === 12 ? [{ actionId: 'poach_rival_staff', targetId: PRIMARY_RIVAL_ID }] : []
    state = simulateDay(state, input(day, actions), FULL_PIPELINE).state
  }
  return state
}

describe('Phase 216 §5.10 — a reload at every beat the rival lifecycle crosses', () => {
  const base = contestedTavern()

  it('reaches a state with a positioned rival that has actually done things', () => {
    const rival = getPrimaryRival(base)
    expect(rival, 'no rival was ever opened').toBeDefined()
    expect(rival!.position).not.toBe('unknown')
    const slice = getRivalModuleState(base)
    expect(
      slice.moveHistory.length + (rivalIntent(base) ? 1 : 0),
      'the rival neither did nor announced anything in a month',
    ).toBeGreaterThan(0)
    expect(rival!.setbacks.length, 'the poaching left no mark').toBeGreaterThan(0)
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

  it('a resumed day makes the same rival decisions as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('does not let a reload hand the rival a second move or a second week of takings', () => {
    const once = simulateDay(base, input(150), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'report', 'C')
    const twice = simulateDay(reloaded, input(150), FULL_PIPELINE).state
    expect(getRivalModuleState(twice).moveHistory.length).toBe(
      getRivalModuleState(once).moveHistory.length,
    )
    expect(getPrimaryRival(twice)!.purse).toBe(getPrimaryRival(once)!.purse)
    expect(plain(twice)).toEqual(plain(once))
  })
})

describe('Phase 216 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = contestedTavern()
    let segmented = contestedTavern()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const rival = getPrimaryRival(batch)
      const courted = rival ? Object.keys(rival.courting).sort()[0] : undefined
      const actions: SimInput['ownerActions'] =
        day % 5 === 0
          ? [{ actionId: 'scout_the_competition', targetId: PRIMARY_RIVAL_ID }]
          : courted
            ? [{ actionId: 'win_back_group', targetId: courted }]
            : []

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    expect(getRivalModuleState(batch).totals.movesMade).toBeGreaterThan(0)
  })
})

describe('Phase 216 §5.7 — the migration carries an old save forward honestly', () => {
  it('installs the slice when a save has never seen one', () => {
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(([id]) => id !== RIVAL_MODULE_ID),
      ),
    } as TavernState
    const migrated = ensureRivalSlice(stripped)
    expect(migrated.modules[RIVAL_MODULE_ID]).toEqual(createInitialRivalModuleState())
  })

  it('leaves a slice that is already complete exactly alone', () => {
    const played = contestedTavern()
    expect(ensureRivalSlice(played)).toBe(played)
  })

  it('rolls no name and moves no RNG cursor — the module opens the record', () => {
    // The migration cannot reach a named stream, and rolling one would shift
    // a generated name somewhere else (architecture rule 7). So it installs
    // an EMPTY rival book and leaves the record to the first played day.
    const fresh = createInitialTavernState()
    const stripped = {
      ...fresh,
      modules: Object.fromEntries(
        Object.entries(fresh.modules).filter(([id]) => id !== RIVAL_MODULE_ID),
      ),
    } as TavernState
    const migrated = ensureRivalSlice(stripped)
    expect(getRivalModuleState(migrated).rivals).toEqual({})
    expect(getPrimaryRival(migrated)).toBeUndefined()

    const played = simulateDay(migrated, input(0), FULL_PIPELINE).state
    expect(getPrimaryRival(played)!.name.length).toBeGreaterThan(3)
  })

  it('opens the record at the standing the save already recorded', () => {
    // A save whose rival had pulled well ahead must not restart as an
    // unknown newcomer: the appeal and strategy in the monthly slice are a
    // competition the player already lived through.
    const fresh = createInitialTavernState()
    const withHistory = {
      ...fresh,
      modules: {
        ...Object.fromEntries(
          Object.entries(fresh.modules).filter(([id]) => id !== RIVAL_MODULE_ID),
        ),
        monthly: {
          ...(fresh.modules['monthly'] as Record<string, unknown>),
          rivalTavern: { pressure: 55, appeal: 70, strategy: 'cheap' },
        },
      },
    } as TavernState
    const played = simulateDay(
      ensureRivalSlice(withHistory),
      input(0),
      FULL_PIPELINE,
    ).state
    const rival = getPrimaryRival(played)!
    expect(rival.position).toBe('cheap')
    expect(rival.capability.reach).toBeGreaterThan(BASELINE_CAPABILITY.reach)
    expect(rival.capability).toEqual(rivalCapabilityFromRecordedAppeal(70))
  })

  it('opens a level rival for a save whose competition never got going', () => {
    const fresh = createInitialTavernState()
    const played = simulateDay(
      ensureRivalSlice(fresh),
      input(0),
      FULL_PIPELINE,
    ).state
    // 30 was the pre-Phase-9 recorded neutral; a neutral record must not
    // invent a competitor that was never there.
    expect(getPrimaryRival(played)!.capability).toEqual({ ...BASELINE_CAPABILITY })
  })
})
