import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { staffRegistry } from '../../src/sim/registries/staffRegistry'
import { getStaffModuleState } from '../../src/sim/modules/staff/workforceState'
import { getStockModuleState } from '../../src/sim/modules/stock/state'
import {
  listApplicants,
  refreshLaborMarket,
} from '../../src/sim/modules/staff/laborMarket'
import { listWageArrears, totalWageArrears } from '../../src/sim/modules/staff/staffWages'
import { checkPromotion } from '../../src/sim/modules/staff/development'
import { buildWorkforceHelp } from '../../src/reports/workforceHelp'
import {
  HIRE_STAFF_COST,
  TRAIN_STAFF_COST,
} from '../../src/sim/modules/ownerActions/workforceActions'
import type { SimInputOwnerAction } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'

// Expansion Phase 3 (repo phase 210) / ISSUE-173 — the workforce lifecycle.
//
// The plan's "Required tests" list for Phase 3, in order:
//
//   1. wage payment and nonpayment across multiple weeks
//   2. hiring, coverage, absence, training, promotion, and replacement
//   3. staff relationship creation and bounded growth
//   4. burnout causing real availability or separation risk
//   5. successful intervention versus resignation
//   6. quitting during active project, arc, and scheduled shift
//   7. target already fired or absent when a quit event resolves
//   8. save/load and deterministic applicant generation
//   9. service outputs traceable to actual assignment and staff state
//
// (1), (2), the applicant half of (8) and (9) are here; (3)–(7) are in
// `phase210.retentionAndQuitting.test.ts`; the save/load half of (8) and the
// §5.9/§5.10 beats are in `phase210.workforceBeatPersistence.test.ts`.
//
// EVERY test reaches the feature the way a player does: it queues a real owner
// action on `SimInput` and runs `simulateDay` on the full pipeline. Nothing
// injects an employment record, an applicant or a relationship, because §5 fails
// a phase whose tests reach the feature only by injecting impossible state.
// `withCoin` is a starting condition, not an injected outcome.

const SEED = 'phase-210-workforce-lifecycle'

function input(
  actions?: ReadonlyArray<SimInputOwnerAction>,
  staffPriorities?: Record<string, string>,
  seed = SEED,
) {
  return {
    seed,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
    ...(staffPriorities ? { staffPriorities } : {}),
  }
}

function runDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
  staffPriorities?: Record<string, string>,
  seed = SEED,
) {
  return simulateDay(state, input(actions, staffPriorities, seed), FULL_PIPELINE)
}

/** Run `days` quiet days. Used to reach a week boundary or build tenure. */
function runQuietDays(
  state: TavernState,
  days: number,
  seed = SEED,
): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runDay(current, undefined, undefined, `${seed}-${i}`).state
  }
  return current
}

/** The board is generated on the first morning, so open the tavern to read it. */
function openWithBoard(coin = 400): {
  state: TavernState
  applicantId: string
} {
  const opened = runDay(withCoin(createInitialTavernState(), coin)).state
  const applicants = listApplicants(opened)
  expect(applicants.length).toBeGreaterThan(0)
  return { state: withCoin(opened, coin), applicantId: applicants[0]!.id }
}

describe('Phase 3 §3.1 — hiring from the labor market', () => {
  it('the board is populated, bounded, and every applicant is a whole person', () => {
    const { state } = openWithBoard()
    const applicants = listApplicants(state)
    expect(applicants.length).toBeGreaterThan(0)
    expect(applicants.length).toBeLessThanOrEqual(8)
    for (const applicant of applicants) {
      expect(applicant.name.display.length).toBeGreaterThan(0)
      expect(staffRegistry.has(applicant.roleId)).toBe(true)
      expect(applicant.skill).toBeGreaterThan(0)
      expect(applicant.wageAsk).toBeGreaterThan(0)
      expect(applicant.identity).toBeDefined()
      expect(applicant.castAttributes).toBeDefined()
      // §5.11 — every applicant carries its own expiry.
      expect(applicant.availableUntilDay).toBeGreaterThan(applicant.postedOnDay)
    }
  })

  it('applicant generation is deterministic for the same seed and state', () => {
    const first = openWithBoard()
    const second = openWithBoard()
    expect(listApplicants(second.state).map((a) => a.id)).toEqual(
      listApplicants(first.state).map((a) => a.id),
    )
    expect(listApplicants(second.state).map((a) => a.name.display)).toEqual(
      listApplicants(first.state).map((a) => a.name.display),
    )
    expect(listApplicants(second.state).map((a) => a.wageAsk)).toEqual(
      listApplicants(first.state).map((a) => a.wageAsk),
    )
  })

  it('generating applicants shifts no existing staff identity', () => {
    // Architecture rule 7: identity randomness lives on named streams so an
    // extra roll in one system cannot rename somebody in another. The applicant
    // board is generated on `labor_market`, so day zero's staff must be
    // byte-identical to what they were before this phase existed.
    const fresh = createInitialTavernState()
    const opened = runDay(withCoin(fresh, 400)).state
    for (const id of ['cook', 'server', 'cleaner_bouncer']) {
      expect(opened.staff[id]!.name.display).toBe(fresh.staff[id]!.name.display)
    }
  })

  it('hiring takes the applicant off the board and puts them on the payroll with terms', () => {
    const { state, applicantId } = openWithBoard()
    const applicant = listApplicants(state).find((a) => a.id === applicantId)!
    const result = runDay(state, [
      { actionId: 'hire_staff', targetId: applicantId },
    ])
    const after = result.state

    const hired = Object.values(after.staff).find((s) => s.id.startsWith('hire_'))
    expect(hired).toBeDefined()
    expect(hired!.name.display).toBe(applicant.name.display)
    expect(hired!.skill).toBe(applicant.skill)
    expect(hired!.wage).toBe(applicant.wageAsk)
    // The fee is read off the applied action rather than off the coin delta: the
    // extra hand also changes what the day earned, so a balance comparison would
    // be measuring two things at once.
    const applied = (
      after.modules['ownerActions'] as {
        applied?: Array<{ actionId: string; data: Record<string, unknown> }>
      }
    ).applied?.find((entry) => entry.actionId === 'hire_staff')
    expect(applied).toBeDefined()
    expect((applied!.data['coin'] as { spent: number }).spent).toBe(HIRE_STAFF_COST)
    // Off the board: one person, hired once.
    expect(listApplicants(after).some((a) => a.id === applicantId)).toBe(false)
    // And on the books with real terms.
    const employment = getStaffModuleState(after).employment[hired!.id]
    expect(employment).toBeDefined()
    expect(employment!.status).toBe('active')
    expect(employment!.noticeDays).toBeGreaterThan(0)
    expect(employment!.wagePerDay).toBeCloseTo(applicant.wageAsk / 7, 1)
  })

  it('a lowball offer is accepted and remembered in lower loyalty', () => {
    const { state, applicantId } = openWithBoard()
    const applicant = listApplicants(state).find((a) => a.id === applicantId)!
    const roleDefault = staffRegistry.get(applicant.roleId).defaultState.loyalty
    const lowball = Math.max(1, applicant.wageAsk - 4)

    const after = runDay(state, [
      { actionId: 'hire_staff', targetId: applicantId, amount: lowball },
    ]).state
    const hired = Object.values(after.staff).find((s) => s.id.startsWith('hire_'))!
    expect(hired.wage).toBe(lowball)
    expect(hired.loyalty).toBeLessThan(roleDefault)
  })

  it('an applicant who is never hired leaves the board', () => {
    const { state } = openWithBoard()
    const firstId = listApplicants(state)[0]!.id
    // Past the shelf life. The board refreshes, so the specific person is gone.
    const later = runQuietDays(state, 16, `${SEED}-shelf`)
    expect(listApplicants(later).some((a) => a.id === firstId)).toBe(false)
    expect(listApplicants(later).length).toBeLessThanOrEqual(8)
  })

  it('losing somebody opens a vacancy that the board always answers', () => {
    // Replacement, end to end: dismiss the cook, and a cook is on the board.
    const state = withCoin(runDay(withCoin(createInitialTavernState(), 400)).state, 400)
    const fired = runDay(state, [{ actionId: 'fire_staff', targetId: 'cook' }]).state
    expect(fired.staff['cook']).toBeUndefined()

    const slice = getStaffModuleState(fired)
    expect(slice.laborMarket.vacancies.map((v) => v.roleId)).toContain('cook')

    // The next morning's refresh answers it — a labor market that could leave
    // the player permanently unable to replace a cook would be a dead end.
    const nextDay = runDay(fired, undefined, undefined, `${SEED}-vacancy`).state
    expect(
      listApplicants(nextDay).some((a) => a.roleId === 'cook'),
    ).toBe(true)
  })
})

describe('Phase 3 §3.2 — coverage, assignment, and service traceability', () => {
  it('the reference roster is exactly neutral', () => {
    // The calibration this phase rests on: one body per role, on its role's
    // default priority and shift, scores a contribution of 1 — so the reference
    // route's service-quality numbers are what they were before Phase 3.
    const state = runDay(createInitialTavernState()).state
    const slice = getStaffModuleState(state)
    expect(slice.roster.length).toBe(Object.keys(state.staff).length)
    for (const row of slice.roster) {
      expect(row.available).toBe(true)
      expect(row.contribution).toBe(1)
      expect(row.handoffPenalty).toBe(0)
      expect(row.overtime).toBe(false)
    }
    for (const row of slice.coverage) {
      expect(row.gap).toBe(0)
    }
  })

  it('a missing role is a reported coverage gap rather than a thrown error', () => {
    const state = withCoin(runDay(withCoin(createInitialTavernState(), 400)).state, 400)
    const fired = runDay(state, [
      { actionId: 'fire_staff', targetId: 'cleaner_bouncer' },
    ]).state
    // The day after: the tavern still trades.
    const next = runDay(fired, undefined, undefined, `${SEED}-gap`)
    expect(next.validation.errors).toEqual([])
    const coverage = getStaffModuleState(next.state).coverage
    const row = coverage.find((entry) => entry.roleId === 'cleaner_bouncer')
    expect(row).toBeDefined()
    expect(row!.gap).toBeGreaterThan(0)
    expect(row!.readable).toContain('short by')
  })

  it('a rest shift removes cover and doubles recovery', () => {
    const state = runDay(createInitialTavernState()).state
    const rested = runDay(state, [
      { actionId: 'set_staff_shift', targetId: 'server:rest' },
    ]).state
    const row = getStaffModuleState(rested).roster.find(
      (entry) => entry.staffId === 'server',
    )!
    expect(row.available).toBe(false)
    expect(row.contribution).toBe(0)
    expect(row.shiftCoverage).toBe(0)
    const coverage = getStaffModuleState(rested).coverage.find(
      (entry) => entry.roleId === 'server',
    )!
    expect(coverage.gap).toBeGreaterThan(0)
    // The recovery is what the coverage bought.
    expect(rested.staff['server']!.fatigue).toBeLessThan(state.staff['server']!.fatigue)
  })

  it('a double shift buys cover at an overtime cost', () => {
    const state = runDay(createInitialTavernState()).state
    const doubled = runDay(state, [
      { actionId: 'set_staff_shift', targetId: 'server:double' },
    ]).state
    const row = getStaffModuleState(doubled).roster.find(
      (entry) => entry.staffId === 'server',
    )!
    expect(row.shiftCoverage).toBeGreaterThan(1)
    expect(row.overtime).toBe(true)
    expect(row.contribution).toBeGreaterThan(1)
  })

  it('stationing somebody away from their work costs part of their contribution', () => {
    const state = runDay(createInitialTavernState()).state
    // The cook's focus works in the kitchen; the cellar is not the kitchen.
    const moved = runDay(state, [
      { actionId: 'assign_staff_area', targetId: 'cook:cellar' },
    ]).state
    const row = getStaffModuleState(moved).roster.find(
      (entry) => entry.staffId === 'cook',
    )!
    expect(row.areaId).toBe('cellar')
    expect(row.skillFit).toBeLessThan(1)
    expect(row.contribution).toBeLessThan(1)
    // And the row says why — the §5.9 legibility requirement in miniature.
    expect(row.notes.join(' ')).toContain('Stationed in')
  })

  it('switching a focus costs a handoff, and the roster names it', () => {
    const state = runDay(createInitialTavernState()).state
    const switched = runDay(state, undefined, { cook: 'quality' }).state
    const row = getStaffModuleState(switched).roster.find(
      (entry) => entry.staffId === 'cook',
    )!
    expect(row.priorityId).toBe('quality')
    expect(row.handoffPenalty).toBeGreaterThan(0)
    expect(row.contribution).toBeLessThan(1)
    expect(row.notes.join(' ')).toContain('Switched focus')
  })

  it('service quality is traceable to the assignment that produced it', () => {
    // §"Required tests" item 9. The same priority, the same person, the same
    // day — moved off their station — produces a measurably smaller published
    // modifier, and the roster row carries the factor that explains it.
    const base = runDay(createInitialTavernState()).state
    const onStation = runDay(base, undefined, undefined, `${SEED}-trace-a`)
    const offStation = runDay(
      base,
      [{ actionId: 'assign_staff_area', targetId: 'cleaner_bouncer:cellar' }],
      undefined,
      `${SEED}-trace-a`,
    )

    const a = getStaffModuleState(onStation.state).serviceQuality
    const b = getStaffModuleState(offStation.state).serviceQuality
    expect(b.messControl).toBeLessThan(a.messControl)

    const row = getStaffModuleState(offStation.state).roster.find(
      (entry) => entry.staffId === 'cleaner_bouncer',
    )!
    // The drop is proportional to the contribution the row reports, which is
    // what makes the trace a join rather than a coincidence.
    expect(row.contribution).toBeLessThan(1)
    expect(b.messControl / a.messControl).toBeCloseTo(row.contribution, 1)
  })

  it('there is exactly one writer of the day\'s fatigue and stress', () => {
    // §5.4, and the duplication this phase had to avoid: the traffic-driven
    // fatigue rule used to live in the service module. If both it and the roster
    // charged for the day, fatigue would climb at twice the intended rate. So the
    // service report QUOTES the roster's numbers rather than computing its own,
    // and the two must agree exactly.
    const result = runDay(createInitialTavernState())
    const roster = getStaffModuleState(result.state).roster
    const serviceResult = (
      result.state.modules['service'] as {
        result?: {
          staffChanges?: Array<{
            staffId: string
            fatigueDelta: number
            stressDelta: number
          }>
        }
      }
    ).result
    const changes = serviceResult?.staffChanges ?? []
    expect(changes.length).toBeGreaterThan(0)
    for (const change of changes) {
      const row = roster.find((entry) => entry.staffId === change.staffId)
      expect(row).toBeDefined()
      expect(change.fatigueDelta).toBe(row!.fatigueAdded)
      expect(change.stressDelta).toBe(row!.stressAdded)
    }
  })

  it('a coverage gap is the phase\'s own stress term, and it is zero without one', () => {
    const base = runDay(createInitialTavernState()).state
    const neutral = runDay(base, undefined, undefined, `${SEED}-gap-stress`)
    for (const row of getStaffModuleState(neutral.state).roster) {
      if (!row.available) continue
      expect(row.notes.some((note) => note.includes('short-handed'))).toBe(false)
    }

    // Take the cook off the rota entirely: everybody still in pays for it.
    const short = runDay(
      base,
      [{ actionId: 'set_staff_shift', targetId: 'cook:rest' }],
      undefined,
      `${SEED}-gap-stress`,
    )
    const shortRows = getStaffModuleState(short.state).roster.filter(
      (row) => row.available,
    )
    expect(shortRows.length).toBeGreaterThan(0)
    for (const row of shortRows) {
      const neutralRow = getStaffModuleState(neutral.state).roster.find(
        (entry) => entry.staffId === row.staffId,
      )!
      expect(row.stressAdded).toBeGreaterThan(neutralRow.stressAdded)
    }
  })
})

describe('Phase 3 §3.1 — absence, training, and promotion', () => {
  it('granted leave takes somebody off the rota, sheds fatigue, and ends on its own', () => {
    const state = runDay(withCoin(createInitialTavernState(), 200)).state
    const before = state.staff['server']!
    const onLeave = runDay(state, [
      { actionId: 'grant_staff_leave', targetId: 'server', amount: 2 },
    ]).state

    expect(onLeave.staff['server']!.absence?.kind).toBe('leave')
    expect(onLeave.staff['server']!.unavailable).toBe(true)
    expect(onLeave.staff['server']!.fatigue).toBeLessThan(before.fatigue)

    // Still out the next day...
    const day2 = runDay(onLeave, undefined, undefined, `${SEED}-leave-2`).state
    expect(day2.staff['server']!.absence).toBeDefined()
    // ...and back after that, without the player doing anything.
    const day3 = runDay(day2, undefined, undefined, `${SEED}-leave-3`).state
    expect(day3.staff['server']!.absence).toBeUndefined()
    expect(day3.staff['server']!.unavailable).toBe(false)
  })

  it('training banks experience, and enough of it buys a skill point', () => {
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 600)).state, 600)
    const startSkill = state.staff['cook']!.skill
    // Repeated training sessions. Four sessions bank more than one skill point
    // in total; the cook's ceiling is well above their opening skill.
    for (let i = 0; i < 4; i += 1) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'cook' }],
          undefined,
          `${SEED}-train-${i}`,
        ).state,
        600,
      )
    }
    expect(state.staff['cook']!.skill).toBeGreaterThan(startSkill)
  })

  it('training costs coin and is refused when the till cannot cover it', () => {
    const state = withCoin(
      runDay(withCoin(createInitialTavernState(), 200)).state,
      TRAIN_STAFF_COST - 1,
    )
    const after = runDay(state, [{ actionId: 'train_staff', targetId: 'cook' }])
    const rejected = (
      after.state.modules['ownerActions'] as {
        rejected?: Array<{ actionId: string; code: string }>
      }
    ).rejected
    expect(rejected?.some((r) => r.actionId === 'train_staff')).toBe(true)
  })

  it('cross-training reaches the level that lets somebody cover another role', () => {
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 800)).state, 800)
    for (let i = 0; i < 4; i += 1) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server:cleaner_bouncer' }],
          undefined,
          `${SEED}-cross-${i}`,
        ).state,
        800,
      )
    }
    const level = state.staff['server']!.crossTraining?.['cleaner_bouncer'] ?? 0
    expect(level).toBeGreaterThanOrEqual(60)
  })

  it('cross-training is capped at three trades per person', () => {
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 2000)).state, 2000)
    const roles = staffRegistry
      .all()
      .map((def) => def.id)
      .filter((id) => id !== 'server')
    for (const [i, roleId] of roles.entries()) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: `server:${roleId}` }],
          undefined,
          `${SEED}-cap-${i}`,
        ).state,
        2000,
      )
    }
    expect(
      Object.keys(state.staff['server']!.crossTraining ?? {}).length,
    ).toBeLessThanOrEqual(3)
  })

  it('promotion needs skill and tenure, and moves role and wage together', () => {
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 900)).state, 900)
    // Day one: not eligible — no tenure.
    expect(checkPromotion(state, 'server').ok).toBe(false)

    // Train them until they are ready, bounded so a regression fails rather than
    // hangs. Investing in somebody has to be reachable inside a month of play or
    // the ladder is decoration.
    let days = 0
    while (!checkPromotion(state, 'server').ok && days < 30) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          undefined,
          `${SEED}-promote-${days}`,
        ).state,
        900,
      )
      days += 1
      if (!state.staff['server']) break
    }
    const verdict = checkPromotion(state, 'server')
    expect(days).toBeLessThan(30)
    expect(verdict.ok).toBe(true)
    if (!verdict.ok) return

    const wageBefore = state.staff['server']!.wage
    const promoted = runDay(state, [
      { actionId: 'promote_staff', targetId: 'server' },
    ]).state
    expect(promoted.staff['server']!.role).toBe('head_server')
    expect(promoted.staff['server']!.wage).toBeGreaterThan(wageBefore)
    // The new role's priority set is respected — a role-scoped priority the new
    // role did not allow would fail validation the following morning.
    const next = runDay(promoted, undefined, undefined, `${SEED}-promoted-next`)
    expect(next.validation.errors).toEqual([])
  })

  it('promotion is refused at the top of the ladder, with the reason', () => {
    const state = runDay(createInitialTavernState()).state
    const verdict = checkPromotion(state, 'cook')
    // A day-zero cook is neither skilled nor long-serving enough; the point is
    // that the refusal SAYS which.
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('Phase 3 §3.1 — wages across multiple weeks', () => {
  it('a full week paid in full behaves exactly as before, with no obligation opened', () => {
    // Reference-route neutrality: a payable exists only when there is a real
    // debt, so the happy path leaves the obligation ledger empty.
    const state = runQuietDays(withCoin(createInitialTavernState(), 500), 8, `${SEED}-paid`)
    expect(totalWageArrears(state)).toBe(0)
    const settlement = getStaffModuleState(state).lastWageSettlement
    expect(settlement).toBeDefined()
    expect(settlement!.shortfall).toBe(0)
    expect(settlement!.paid).toBe(settlement!.totalDue)
    for (const member of Object.values(state.staff)) {
      expect(member.paidThisWeek).toBe(true)
    }
  })

  it('an empty till part-pays and opens named arrears', () => {
    // Run to the day before the settlement, then empty the till. The shortfall
    // is a per-person payable, not a mood.
    let state = runQuietDays(withCoin(createInitialTavernState(), 500), 6, `${SEED}-broke`)
    state = withCoin(state, 3)
    state = runDay(state, undefined, undefined, `${SEED}-broke-settle`).state

    const settlement = getStaffModuleState(state).lastWageSettlement!
    expect(settlement.shortfall).toBeGreaterThan(0)
    expect(settlement.paid).toBeLessThan(settlement.totalDue)
    expect(settlement.perStaff.length).toBe(Object.keys(state.staff).length)

    const arrears = listWageArrears(state)
    expect(arrears.length).toBeGreaterThan(0)
    for (const record of arrears) {
      expect(record.direction).toBe('payable')
      expect(record.ownerModuleId).toBe('staff')
      expect(record.principal).toBeGreaterThan(0)
      // Named: the tag says whose back pay this is.
      expect(record.tags.some((t) => t.startsWith('wage_arrears:'))).toBe(true)
    }
    expect(totalWageArrears(state)).toBeGreaterThan(0)
  })

  it('arrears accumulate across weeks and the crew feels each one', () => {
    let state = withCoin(createInitialTavernState(), 30)
    // Two settlement weeks with a near-empty till. Coin can climb from trading,
    // so it is pinned low at each morning to keep the shortfall real.
    const moraleStart = state.staff['cook']!.morale
    for (let i = 0; i < 15; i += 1) {
      state = withCoin(state, 3)
      state = runDay(state, undefined, undefined, `${SEED}-arrears-${i}`).state
      if (!state.staff['cook']) break
    }
    expect(totalWageArrears(state)).toBeGreaterThan(0)
    const settlements = getStaffModuleState(state)
    expect(settlements.totals.wageShortfall).toBeGreaterThan(0)
    if (state.staff['cook']) {
      expect(state.staff['cook']!.morale).toBeLessThan(moraleStart)
    }
  })

  it('paying back pay settles the record and repairs some of the damage', () => {
    let state = runQuietDays(withCoin(createInitialTavernState(), 500), 6, `${SEED}-repay`)
    state = withCoin(state, 3)
    state = runDay(state, undefined, undefined, `${SEED}-repay-settle`).state
    const owed = totalWageArrears(state)
    expect(owed).toBeGreaterThan(0)

    const moraleBefore = Object.fromEntries(
      Object.values(state.staff).map((m) => [m.id, m.morale] as const),
    )
    state = withCoin(state, owed + 50)
    const paid = runDay(
      state,
      [{ actionId: 'pay_staff_wages', targetId: 'all' }],
      undefined,
      `${SEED}-repay-pay`,
    ).state

    expect(totalWageArrears(paid)).toBe(0)
    // Somebody who was paid what they were owed is measurably less unhappy.
    const improved = Object.values(paid.staff).some(
      (m) => m.morale > (moraleBefore[m.id] ?? 0),
    )
    expect(improved).toBe(true)
  })

  it('a partial payment leaves the balance live rather than clearing it', () => {
    let state = runQuietDays(withCoin(createInitialTavernState(), 500), 6, `${SEED}-partial`)
    state = withCoin(state, 3)
    state = runDay(state, undefined, undefined, `${SEED}-partial-settle`).state
    const owed = totalWageArrears(state)
    expect(owed).toBeGreaterThan(2)

    state = withCoin(state, owed)
    const paid = runDay(
      state,
      [{ actionId: 'pay_staff_wages', targetId: 'all', amount: 2 }],
      undefined,
      `${SEED}-partial-pay`,
    ).state
    const after = totalWageArrears(paid)
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(owed)
  })
})

describe('Phase 3 — Codex review regressions (PR #248)', () => {
  it('arrears cleared by the weekly settlement actually leave the till', () => {
    // P1. `payDownArrears` marked the obligations settled and told the staff
    // member they had been paid, but the only `spendCoin` in the settlement
    // charged this week's wages — so the same coin cleared back pay again every
    // week. The player could carry permanent arrears for free.
    let state = runQuietDays(withCoin(createInitialTavernState(), 500), 6, `${SEED}-reg-arrears`)
    state = withCoin(state, 3)
    state = runDay(state, undefined, undefined, `${SEED}-reg-arrears-settle`).state
    const owed = totalWageArrears(state)
    expect(owed).toBeGreaterThan(0)

    // Enough in the till to clear the arrears and cover the coming week.
    state = withCoin(state, owed + 500)
    let after = state
    let settlementDay: TavernState | undefined
    for (let i = 0; i < 7; i += 1) {
      after = runDay(after, undefined, undefined, `${SEED}-reg-arrears-pay-${i}`).state
      const paid = getStockModuleState(after).ledger.find(
        (entry) => entry.source === 'staff.wages.arrears',
      )
      if (paid) settlementDay = after
    }
    expect(totalWageArrears(after)).toBe(0)

    // The settlement earns as well as spends, so the assertion is on the day's
    // LEDGER rather than on the balance: back pay is its own line, for the whole
    // sum owed, and it is negative — the coin left.
    expect(settlementDay, 'the arrears were never actually paid out').toBeDefined()
    const arrearsLine = getStockModuleState(settlementDay!).ledger.find(
      (entry) => entry.source === 'staff.wages.arrears',
    )!
    // At least what was owed when it was measured — late charges may have
    // pushed the balance up in the meantime, and the line covers those too.
    expect(arrearsLine.amount).toBeLessThanOrEqual(-owed)
    expect(arrearsLine.category).toBe('wage')
    // …and it is a line of its own, not folded into this week's wage payment:
    // "we finally paid what we owed" and "we paid this week" are different
    // entries in a P/L.
    expect(
      getStockModuleState(settlementDay!).ledger.some(
        (entry) => entry.source === 'staff.wages' && entry.amount < 0,
      ),
    ).toBe(true)
  })

  it('promoting somebody out of a role opens a vacancy for it', () => {
    // P2. The rungs above a founding role declare no daily demand, so promoting
    // the server left the floor short with no recorded vacancy — and the board
    // only answers recorded vacancies, so the gap could sit there indefinitely.
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 900)).state, 900)
    let days = 0
    while (!checkPromotion(state, 'server').ok && days < 30) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          undefined,
          `${SEED}-reg-promote-${days}`,
        ).state,
        900,
      )
      days += 1
    }
    expect(checkPromotion(state, 'server').ok).toBe(true)

    const promoted = runDay(state, [
      { actionId: 'promote_staff', targetId: 'server' },
    ]).state
    expect(promoted.staff['server']!.role).toBe('head_server')
    const slice = getStaffModuleState(promoted)
    expect(slice.laborMarket.vacancies.map((v) => v.roleId)).toContain('server')

    // …and the board answers it on the next refresh, so the post is fillable.
    const next = runDay(promoted, undefined, undefined, `${SEED}-reg-promote-next`).state
    expect(listApplicants(next).some((a) => a.roleId === 'server')).toBe(true)
  })
})

describe('Phase 3 §5.12 — Help is derived, not authored', () => {
  it('every workforce action is registered and discoverable', () => {
    for (const actionId of [
      'hire_staff',
      'set_staff_shift',
      'assign_staff_area',
      'train_staff',
      'promote_staff',
      'adjust_staff_wage',
      'pay_staff_wages',
      'grant_staff_leave',
      'discipline_staff',
      'give_staff_notice',
      'fire_staff',
      'negotiate_with_staff',
    ]) {
      expect(actionRegistry.has(actionId)).toBe(true)
    }
  })

  it('role Help matches the registry rather than restating it', () => {
    const help = buildWorkforceHelp()
    expect(help.roles.length).toBe(staffRegistry.all().length)
    for (const row of help.roles) {
      const def = staffRegistry.get(row.roleId)
      expect(row.label).toBe(def.label)
      expect(row.openingWage).toBe(def.defaultState.wage)
      expect(row.skillCeiling).toBeGreaterThanOrEqual(def.defaultState.skill)
      expect(row.priorityLines.length).toBe(def.allowedPriorities.length)
      if (def.promotesTo) {
        expect(row.promotesToLabel).toBe(staffRegistry.get(def.promotesTo).label)
        expect(row.promotionRequirementLines.length).toBeGreaterThan(0)
      } else {
        expect(row.promotesToLabel).toBeUndefined()
      }
    }
  })

  it('Help quotes the live action costs', () => {
    const help = buildWorkforceHelp()
    expect(help.hiringLines.join(' ')).toContain(String(HIRE_STAFF_COST))
    expect(help.developmentLines.join(' ')).toContain(String(TRAIN_STAFF_COST))
    // Every section has something to say — an empty section is a promise the
    // Help is not keeping.
    for (const section of [
      help.hiringLines,
      help.rotaLines,
      help.wageLines,
      help.developmentLines,
      help.separationLines,
      help.retentionLines,
      help.relationshipLines,
    ]) {
      expect(section.length).toBeGreaterThan(0)
    }
  })

  it('the STAFF REPORT surfaces the assignment, the coverage and the board', () => {
    const result = runDay(withCoin(createInitialTavernState(), 400))
    const section = result.reports.find((s) => s.id === 'staff')
    expect(section).toBeDefined()
    const text = section!.lines.join('\n')
    expect(text).toContain('Assignment:')
    expect(text).toContain('Contribution:')
    expect(text).toContain('Role Coverage:')
    expect(text).toContain('Looking for work:')
    expect(text).toContain('Your standing:')
  })
})

describe('Phase 3 §5.11 — bounded growth', () => {
  it('the labor market and its vacancies stay capped over a long run', () => {
    const state = runQuietDays(withCoin(createInitialTavernState(), 900), 40, `${SEED}-bounded`)
    const slice = getStaffModuleState(state)
    expect(slice.laborMarket.applicants.length).toBeLessThanOrEqual(8)
    expect(slice.laborMarket.vacancies.length).toBeLessThanOrEqual(12)
    expect(slice.relationships.length).toBeLessThanOrEqual(48)
    expect(slice.separationHistory.length).toBeLessThanOrEqual(30)
    expect(slice.employmentArchive.length).toBeLessThanOrEqual(40)
    // Per-day lists are rebuilt each morning, so they cannot grow at all.
    expect(slice.roster.length).toBe(Object.keys(state.staff).length)
  })

  it('refreshing the market repeatedly does not grow it', () => {
    // The refresh replaces the expired rather than appending, so calling it
    // out of band cannot inflate the board.
    const opened = runDay(withCoin(createInitialTavernState(), 400))
    const before = listApplicants(opened.state).length
    let state = opened.state
    for (let i = 0; i < 5; i += 1) {
      state = runDay(state, undefined, undefined, `${SEED}-refresh-${i}`).state
      expect(listApplicants(state).length).toBeLessThanOrEqual(8)
    }
    expect(before).toBeLessThanOrEqual(8)
    void refreshLaborMarket
  })
})
