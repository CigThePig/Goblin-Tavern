// Expansion Phase 3 (repo phase 210) / ISSUE-173 — §5.9 and §5.10 for the
// workforce lifecycle.
//
// The work protocol makes two standing demands of every phase:
//
//   §5.9  full-day versus segmented equivalence for affected routes
//   §5.10 at least one save/reload at every day beat the new lifecycle crosses
//
// Phase 3's lifecycle crosses five beats:
//
//   morning       absence and illness resolution, the returns, relationship
//                 ageing, the labor-market refresh, and the `staff_separation`
//                 event (notice running out)
//   assignStaffPriorities
//                 the roster: shift, station, cover, handoff, overtime
//   beforeService the service-quality modifiers, scaled by that roster
//   afterService  what the day cost — fatigue, stress, experience, conflict, and
//                 the station contact that builds relationships
//   endDay        experience banked into skill, tenure, and the autonomous staff
//                 actors deciding and acting
//   wrap_up       `staff_quit_risk`, `staff_raise_demand` and the nine other
//                 wrap-up events
//   endWeek       the wage settlement and its arrears
//
// On the engine's three segments those land as: `morning` and
// `assignStaffPriorities` in A, `beforeService`/`afterService` in B, and
// `endDay`/`wrap_up`/`endWeek` in C. A reload at each of the five player beats
// therefore covers all of them — and this file does it with a LIVE WORKFORCE
// SITUATION rather than a day-zero shell: somebody on notice, somebody owed back
// pay, a cross-trained second trade, and a relationship graph with real edges. A
// reload with nothing going on proves nothing about the workforce.
//
// The route runs through the real persistence layer (`saveSession` /
// `loadSession`), not a JSON copy, so the migration chain and the schema are
// exercised on the way through.

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
import type { TavernState } from '../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import { getStaffModuleState } from '../../src/sim/modules/staff/workforceState'
import { listEdges } from '../../src/sim/modules/staff/relationships'
import { totalWageArrears } from '../../src/sim/modules/staff/staffWages'
import {
  ensureStaffWorkforceFields,
  ensureModuleSlices,
} from '../../src/sim/state/migrations'
import { safeValidateState } from '../../src/sim/state/validation'

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

const SEED = 'phase210/workforce-beats'

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

function sessionAt(
  state: TavernState,
  beat: Beat,
  segment: DaySegment,
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-30T00:00:00.000Z',
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
 * A tavern with a live workforce situation.
 *
 * Everything here happens through owner actions on a real route: a fortnight of
 * trading builds relationships and tenure, one hand is cross-trained, the till is
 * emptied across a settlement so somebody is owed back pay, and one hand is put
 * on notice so the notice clock and the separation event are both live.
 */
function tavernMidWorkforce(): TavernState {
  let state = withCoin(createInitialTavernState(), 600)

  // A week of ordinary trading: relationships form, tenure accrues.
  for (let day = 0; day < 5; day += 1) {
    state = withCoin(
      simulateDay(state, input(day), FULL_PIPELINE).state,
      600,
    )
  }
  // A second trade, so `crossTraining` is on state and somebody can cover.
  state = withCoin(
    simulateDay(
      state,
      input(5, [{ actionId: 'train_staff', targetId: 'server:cleaner_bouncer' }]),
      FULL_PIPELINE,
    ).state,
    600,
  )
  // Empty the till through the settlement so arrears exist.
  state = withCoin(state, 2)
  state = simulateDay(state, input(6), FULL_PIPELINE).state
  state = withCoin(state, 600)
  // And put the cleaner on notice, so both the notice absence and the
  // `staff_separation` event are live across every beat below.
  state = simulateDay(
    state,
    input(7, [{ actionId: 'give_staff_notice', targetId: 'cleaner_bouncer' }]),
    FULL_PIPELINE,
  ).state

  const slice = getStaffModuleState(state)
  expect(slice.employment['cleaner_bouncer']?.notice).toBeDefined()
  expect(state.staff['cleaner_bouncer']!.absence?.kind).toBe('notice_served')
  expect(totalWageArrears(state)).toBeGreaterThan(0)
  expect(state.staff['server']!.crossTraining?.['cleaner_bouncer']).toBeGreaterThan(0)
  expect(listEdges(state).length).toBeGreaterThan(0)
  return withCoin(state, 600)
}

describe('Phase 210 §5.10 — reload at every beat the workforce lifecycle crosses', () => {
  it('round-trips a live workforce unchanged at each of the five beats', () => {
    const start = tavernMidWorkforce()
    const inp = input(8)
    const afterA = advanceDaySegment(start, inp, FULL_PIPELINE, 'A').state
    const afterB = advanceDaySegment(afterA, inp, FULL_PIPELINE, 'B', {
      dayBaseline: start,
    }).state
    const afterC = advanceDaySegment(afterB, inp, FULL_PIPELINE, 'C', {
      dayBaseline: start,
    }).state
    const stateFor: Record<DaySegment, TavernState> = {
      A: afterA,
      B: afterB,
      C: afterC,
    }

    for (const { beat, segment } of BEATS) {
      const restored = roundTrip(stateFor[segment], beat, segment)
      expect(plain(restored), `beat ${beat} did not round-trip`).toEqual(
        plain(stateFor[segment]),
      )
      // Spot-check the records this phase added, so a future codec change that
      // drops one of them fails here rather than silently losing a workforce.
      const before = getStaffModuleState(stateFor[segment])
      const after = getStaffModuleState(restored)
      expect(after.employment).toEqual(before.employment)
      expect(after.relationships).toEqual(before.relationships)
      expect(after.actors).toEqual(before.actors)
      expect(after.laborMarket).toEqual(before.laborMarket)
      expect(after.roster).toEqual(before.roster)
      expect(after.coverage).toEqual(before.coverage)
      expect(after.lastWageSettlement).toEqual(before.lastWageSettlement)
      expect(after.totals).toEqual(before.totals)
      // …and the per-person fields.
      for (const [id, member] of Object.entries(stateFor[segment].staff)) {
        const other = restored.staff[id]!
        expect(other.shift).toBe(member.shift)
        expect(other.absence).toEqual(member.absence)
        expect(other.experience).toBe(member.experience)
        expect(other.crossTraining).toEqual(member.crossTraining)
        expect(other.careerGoal).toBe(member.careerGoal)
        expect(other.daysEmployed).toBe(member.daysEmployed)
        expect(other.consecutiveDaysWorked).toBe(member.consecutiveDaysWorked)
      }
    }
  })

  it('a reload at any beat leaves the rest of the day identical', () => {
    const start = tavernMidWorkforce()

    const run = (reloadAfter?: DaySegment, beat?: Beat): TavernState => {
      const inp = input(8)
      let state = start
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'A').state
      if (reloadAfter === 'A') state = roundTrip(state, beat!, 'A')
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'B', {
        dayBaseline: start,
      }).state
      if (reloadAfter === 'B') state = roundTrip(state, beat!, 'B')
      state = advanceDaySegment(state, inp, FULL_PIPELINE, 'C', {
        dayBaseline: start,
      }).state
      if (reloadAfter === 'C') state = roundTrip(state, beat!, 'C')
      return state
    }

    const clean = run()
    for (const { beat, segment } of BEATS) {
      const reloaded = run(segment, beat)
      expect(
        JSON.parse(JSON.stringify(reloaded.staff)),
        `a reload at ${beat} changed the day's staff outcome`,
      ).toEqual(JSON.parse(JSON.stringify(clean.staff)))
      expect(getStaffModuleState(reloaded)).toEqual(getStaffModuleState(clean))
      expect(reloaded.coin).toBe(clean.coin)
    }
  })
})

describe('Phase 210 §5.9 — full-day versus segmented equivalence', () => {
  it('agrees across a fortnight of rota, wages, absence and separation', () => {
    let batch = tavernMidWorkforce()
    let segmented = tavernMidWorkforce()
    expect(plain(segmented)).toEqual(plain(batch))

    for (let day = 8; day < 22; day += 1) {
      const inp = input(day)
      batch = simulateDay(batch, inp, FULL_PIPELINE).state

      const dayStart = segmented
      for (const segment of ['A', 'B', 'C'] as const) {
        segmented = advanceDaySegment(segmented, inp, FULL_PIPELINE, segment, {
          dayBaseline: dayStart,
        }).state
      }
    }

    // The notice expired somewhere in that fortnight and a wage settlement ran;
    // both routes must agree on who is still here, on their condition, and on
    // every workforce record.
    expect(JSON.parse(JSON.stringify(segmented.staff))).toEqual(
      JSON.parse(JSON.stringify(batch.staff)),
    )
    expect(getStaffModuleState(segmented)).toEqual(getStaffModuleState(batch))
    expect(segmented.coin).toBe(batch.coin)
    // The separation actually happened, so the equivalence is over a route that
    // crossed it rather than one where nothing moved.
    expect(segmented.staff['cleaner_bouncer']).toBeUndefined()
    expect(
      getStaffModuleState(segmented).separationHistory.some(
        (entry) => entry.staffId === 'cleaner_bouncer',
      ),
    ).toBe(true)
  })
})

describe('Phase 210 §5.7 — the migration is named, idempotent, and conservative', () => {
  it('a pre-Phase-3 save gains the workforce fields and one employment record each', () => {
    const fresh = createInitialTavernState()
    // Strip the phase back out of a real state, which is what a save written
    // before it looks like: no workforce fields on the people, and a
    // `modules.staff` slice with only the Phase 11 keys.
    const legacyStaff: Record<string, unknown> = {}
    for (const [id, member] of Object.entries(fresh.staff)) {
      const {
        shift: _s,
        absence: _a,
        experience: _e,
        crossTraining: _c,
        careerGoal: _g,
        daysEmployed: _d,
        consecutiveDaysWorked: _w,
        assignedAreaId: _r,
        ...rest
      } = member
      legacyStaff[id] = rest
    }
    const legacy = {
      ...fresh,
      staff: legacyStaff,
      modules: {
        ...fresh.modules,
        staff: {
          appliedPriorities: {},
          rejectedAssignments: [],
          serviceQuality: {
            foodQualityModifier: 0,
            serviceSpeed: 0,
            tabControl: 0,
            messControl: 0,
            fightControl: 0,
            repairSupport: 0,
            staffSummaries: [],
          },
        },
      },
    } as unknown as TavernState

    const migrated = ensureStaffWorkforceFields(legacy)
    for (const member of Object.values(migrated.staff)) {
      expect(member.shift).toBeDefined()
      expect(member.careerGoal).toBeDefined()
      expect(member.experience).toBe(0)
      expect(member.crossTraining).toEqual({})
      // Employment starts being TRACKED now rather than backdated into tenure
      // nobody earned, so day one of the migrated save is day one of the record.
      expect(member.daysEmployed).toBe(0)
    }
    const slice = getStaffModuleState(migrated)
    expect(Object.keys(slice.employment).sort()).toEqual(
      Object.keys(fresh.staff).sort(),
    )
    for (const record of Object.values(slice.employment)) {
      expect(record.status).toBe('active')
      expect(record.openedOnDay).toBe(migrated.calendar.totalDaysElapsed)
      expect(record.noticeDays).toBeGreaterThan(0)
    }
    // The migrated state is schema-valid, which is the point of running it before
    // `validateState` on the load path.
    const validated = safeValidateState(ensureModuleSlices(migrated), {
      modules: FULL_PIPELINE,
    })
    expect(validated.success).toBe(true)
  })

  it('a save that already has the phase is left exactly alone', () => {
    // Idempotence, and the reason it matters: the web layer's day baseline is a
    // state object that goes through this chain on reload. Fabricating employment
    // records into a fresh baseline is what made a reloaded day differ from an
    // uninterrupted one, so an empty-but-present `employment` map must be
    // untouched rather than filled.
    const fresh = createInitialTavernState()
    expect(getStaffModuleState(fresh).employment).toEqual({})
    expect(ensureStaffWorkforceFields(fresh)).toBe(fresh)

    const played = simulateDay(withCoin(fresh, 400), input(0), FULL_PIPELINE).state
    expect(Object.keys(getStaffModuleState(played).employment).length).toBe(3)
    const once = ensureStaffWorkforceFields(played)
    expect(getStaffModuleState(once).employment).toEqual(
      getStaffModuleState(played).employment,
    )
    expect(ensureStaffWorkforceFields(once)).toBe(once)
  })

  it('the migration drops an employment record whose person has gone', () => {
    const played = simulateDay(
      withCoin(createInitialTavernState(), 400),
      input(0),
      FULL_PIPELINE,
    ).state
    const { cook: _gone, ...remaining } = played.staff
    const orphaned = { ...played, staff: remaining }
    const repaired = ensureStaffWorkforceFields(orphaned)
    expect(getStaffModuleState(repaired).employment['cook']).toBeUndefined()
    expect(
      Object.keys(getStaffModuleState(repaired).employment).sort(),
    ).toEqual(Object.keys(remaining).sort())
  })
})
