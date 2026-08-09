// Expansion Phase 9 §9.2 (repo phase 216) / ISSUE-179 — §5.7, §5.9 and
// §5.10 for the local-arc layer.
//
// The arc lifecycle crosses:
//
//   localEventUpdate   the owner's opposing move, stage transitions,
//                      timeouts, outcomes, and the weekly state-driven seed
//   applyOwnerActions  interventions and settlements
//   endMonth           the legacy age spine and monthly seeding
//   endDay             run-book pruning
//   wrap_up            all four scheduled events
//
// On the engine's three segments those are `localEventUpdate` +
// `applyOwnerActions` in A and `endDay` + `endMonth` + `wrap_up` in C. This
// file reloads with LIVE RUNS mid-contest, banked intervention history, an
// owner resolved, and a deadline in flight.

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
import { ensureArcProgression } from '../../src/sim/state/migrations'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  LOCAL_ARCS_MODULE_ID,
  availableInterventions,
  createInitialArcRunTotals,
  getArcRunTotals,
  getArcRuns,
  liveArcRuns,
} from '../../src/sim/modules/localArcs/index'

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

const SEED = 'phase216/arc-beats'

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

/** A house mid-contest with several arcs, some of them fought. */
function arcsInFlight(): TavernState {
  let state = withCoin(createInitialTavernState(), 6000)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 5, damage: 70, smell: 90 })
  state = withArea(state, 'kitchen', { cleanliness: 5, damage: 40, smell: 95 })
  state = withArea(state, 'cellar', { cleanliness: 10, smell: 80 })
  for (let day = 0; day <= 30; day += 1) {
    const offers =
      day % 3 === 0
        ? availableInterventions(state)
            .filter((offer) => offer.blockedReason === undefined)
            .slice(0, 1)
        : []
    state = simulateDay(
      state,
      input(
        day,
        offers.map((offer) => ({
          actionId: 'intervene_in_arc',
          targetId: `${offer.arcId}:${offer.intervention.id}`,
        })),
      ),
      FULL_PIPELINE,
    ).state
  }
  return state
}

describe('Phase 216 §5.10 — a reload at every beat the arc lifecycle crosses', () => {
  const base = arcsInFlight()

  it('reaches a state with live runs, an owner and banked interventions', () => {
    const live = liveArcRuns(base)
    expect(live.length, 'no arc was running after a month').toBeGreaterThan(0)
    expect(live.some((run) => run.ownerRef !== undefined)).toBe(true)
    const totals = getArcRunTotals(base)
    expect(
      totals.interventionsTaken + totals.opposingMovesMade,
      'nothing happened on either side in a month',
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

  it('a resumed day reaches the same arc state as an uninterrupted one', () => {
    const uninterrupted = simulateDay(base, input(99), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'morning', 'A')
    const resumed = simulateDay(reloaded, input(99), FULL_PIPELINE).state
    expect(plain(resumed)).toEqual(plain(uninterrupted))
  })

  it('does not let a reload hand an arc a second opposing move', () => {
    const once = simulateDay(base, input(150), FULL_PIPELINE).state
    const reloaded = roundTrip(base, 'report', 'C')
    const twice = simulateDay(reloaded, input(150), FULL_PIPELINE).state
    expect(getArcRunTotals(twice).opposingMovesMade).toBe(
      getArcRunTotals(once).opposingMovesMade,
    )
    expect(plain(twice)).toEqual(plain(once))
  })
})

describe('Phase 216 §5.9 — full-day and segmented routes agree', () => {
  it('a fortnight is identical run whole or run in three segments', () => {
    let batch = arcsInFlight()
    let segmented = arcsInFlight()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 100; day < 114; day += 1) {
      const offers = availableInterventions(batch)
        .filter((offer) => offer.blockedReason === undefined)
        .slice(0, 1)
      const actions: SimInput['ownerActions'] = offers.map((offer) => ({
        actionId: 'intervene_in_arc',
        targetId: `${offer.arcId}:${offer.intervention.id}`,
      }))

      batch = simulateDay(batch, input(day, actions), FULL_PIPELINE).state

      let carried = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        carried = advanceDaySegment(carried, input(day, actions), FULL_PIPELINE, segment).state
      }
      segmented = carried
      expect(plain(segmented), `day ${day}`).toEqual(plain(batch))
    }

    expect(getArcRunTotals(batch).runsOpened).toBeGreaterThan(0)
  })
})

describe('Phase 216 §5.7 — the migration carries an old save forward honestly', () => {
  it('fills the run book on a slice that predates it', () => {
    const fresh = createInitialTavernState()
    const slice = fresh.modules[LOCAL_ARCS_MODULE_ID] as Record<string, unknown>
    const {
      runs: _runs,
      runTotals: _totals,
      earnedLabels: _labels,
      ...pre
    } = slice
    const old = {
      ...fresh,
      modules: { ...fresh.modules, [LOCAL_ARCS_MODULE_ID]: pre },
    } as TavernState

    const migrated = ensureArcProgression(old)
    const after = migrated.modules[LOCAL_ARCS_MODULE_ID] as Record<string, unknown>
    expect(after['runs']).toEqual({})
    expect(after['runTotals']).toEqual(createInitialArcRunTotals())
    expect(after['earnedLabels']).toEqual({ knownFor: [], houseRules: [] })
  })

  it('leaves a slice that already has the run book alone', () => {
    const played = arcsInFlight()
    expect(ensureArcProgression(played)).toBe(played)
  })

  it('invents no progress and no label for an arc already in flight', () => {
    // The load-bearing judgement: a save mid-arc gets an EMPTY run book.
    // Backdating a goal meter would credit the player with work they never
    // did; backdating opposition would invent pushing nobody did.
    const played = arcsInFlight()
    const slice = played.modules[LOCAL_ARCS_MODULE_ID] as Record<string, unknown>
    const { runs: _r, runTotals: _t, earnedLabels: _l, ...pre } = slice
    const old = {
      ...played,
      modules: { ...played.modules, [LOCAL_ARCS_MODULE_ID]: pre },
    } as TavernState
    const migrated = ensureArcProgression(old)
    expect(Object.keys(getArcRuns(migrated))).toEqual([])
    expect(getArcRunTotals(migrated)).toEqual(createInitialArcRunTotals())
  })

  it('reopens a run for each live arc on the first played day, at its stage', () => {
    const played = arcsInFlight()
    const liveBefore = liveArcRuns(played).map((run) => run.arcId).sort()
    expect(liveBefore.length).toBeGreaterThan(0)

    const slice = played.modules[LOCAL_ARCS_MODULE_ID] as Record<string, unknown>
    const { runs: _r, runTotals: _t, earnedLabels: _l, ...pre } = slice
    const stripped = {
      ...played,
      modules: { ...played.modules, [LOCAL_ARCS_MODULE_ID]: pre },
    } as TavernState

    const resumed = simulateDay(
      ensureArcProgression(stripped),
      input(500),
      FULL_PIPELINE,
    ).state
    const liveAfter = liveArcRuns(resumed).map((run) => run.arcId).sort()
    // Every arc that was still going has a run again, and it starts level
    // rather than at whatever the pre-migration save happened to hold.
    for (const arcId of liveBefore) {
      expect(liveAfter, `${arcId} lost its run across the migration`).toContain(arcId)
    }
    for (const run of liveArcRuns(resumed)) {
      expect(run.interventions).toEqual([])
    }
  })
})
