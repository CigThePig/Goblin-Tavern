import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin } from '../../src/sim/testing/stateFactories'
import {
  getScheduledEventDefinition,
  readScheduledEventsSlice,
  scheduleEvent,
} from '../../src/sim/contracts/scheduledEvents/index'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { getStaffModuleState } from '../../src/sim/modules/staff/workforceState'
import {
  isActiveEdge,
  MAX_ACTIVE_EDGES_PER_STAFF,
  MIN_CONTACTS_FOR_ACTIVE_EDGE,
} from '../../src/sim/modules/staff/workforceTypes'
import {
  findTrainingHelper,
  findTrainingLearner,
  findWillingCover,
  listEdges,
  ownerTrust,
} from '../../src/sim/modules/staff/relationships'
import { checkPromotion } from '../../src/sim/modules/staff/development'
import { MAX_DISCIPLINE_ESCALATION } from '../../src/sim/modules/staff/employmentRecord'
import {
  QUIT_RISK_DEFER_BELOW,
  QUIT_RISK_NO_OP_BELOW,
  STAFF_QUIT_RISK_EVENT,
  STAFF_SEPARATION_EVENT,
  describeQuitRiskContributors,
  quitRiskScore,
  scheduleQuitRisk,
} from '../../src/sim/modules/staff/staffEvents'
import { STAFF_SCHEDULED_EVENT_TYPES } from '../../src/sim/modules/staff/staffEvents'
import {
  WEEKLY_ACTOR_BUDGET,
  listStaffIntents,
} from '../../src/sim/modules/staff/staffActors'
import { ABANDONMENT_DAYS, setAbsence } from '../../src/sim/modules/staff/roster'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { listValidTargets } from '../../src/sim/modules/ownerActions/readonlyHelpers'
import { totalWageArrears } from '../../src/sim/modules/staff/staffWages'
import type { SimContext, SimInputOwnerAction } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import type { TavernState } from '../../src/sim/state/TavernState'

// Expansion Phase 3 (repo phase 210) / ISSUE-173 — §3.3 relationships, §3.4
// quitting, and the twelve hook families that stop being narrative.
//
// This file covers required tests (3)–(7):
//
//   3. staff relationship creation and bounded growth
//   4. burnout causing real availability or separation risk
//   5. successful intervention versus resignation
//   6. quitting during active project, arc, and scheduled shift
//   7. target already fired or absent when a quit event resolves
//
// HOW THE QUIT RISK IS REACHED. Through the real path: a run where the crew is
// treated badly (unpaid, worn out, warned) reaches a state whose contributors add
// up, then the event is put on the calendar the way a response profile or the
// staff actor puts it there — `scheduleQuitRisk`, which is the same call the
// future-hook bridge makes. Nothing writes a `resigned` flag or injects an
// employment record; the state that produces the risk is state the player
// produced.

const SEED = 'phase-210-retention'

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

function runQuietDays(state: TavernState, days: number, seed = SEED): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = runDay(current, undefined, undefined, `${seed}-${i}`).state
  }
  return current
}

/**
 * A tavern where the cook has every reason to leave, reached by playing badly.
 *
 * Nothing is injected: the till is kept empty so the weekly settlement cannot
 * pay, the cook is worked on doubles so they wear out, and they are formally
 * warned. Those are all player choices, and the arrears, fatigue and discipline
 * rung they produce are the contributors the resolver reads.
 */
function tavernWithAMiserableCook(seed = SEED): TavernState {
  let state = withCoin(createInitialTavernState(), 20)
  for (let i = 0; i < 12; i += 1) {
    state = withCoin(state, 2)
    const actions: SimInputOwnerAction[] = []
    if (i === 1) {
      actions.push({ actionId: 'set_staff_shift', targetId: 'cook:double' })
    }
    if (i === 3 || i === 6) {
      actions.push({ actionId: 'discipline_staff', targetId: 'cook' })
    }
    state = runDay(state, actions, undefined, `${seed}-misery-${i}`).state
    if (!state.staff['cook']) break
  }
  return state
}

function liveEventsOfType(state: TavernState, type: string) {
  return readScheduledEventsSlice(state).queue.filter(
    (event) =>
      event.type === type &&
      (event.status === 'scheduled' || event.status === 'warned'),
  )
}

function outcomesOfType(state: TavernState, type: string) {
  const slice = readScheduledEventsSlice(state)
  return [...slice.archive, ...slice.resolvedToday].filter(
    (outcome) => outcome.type === type,
  )
}

describe('Phase 3 §1.1 — the staff module owns its event types', () => {
  it('every declared type is registered to the staff module', () => {
    for (const type of STAFF_SCHEDULED_EVENT_TYPES) {
      const def = getScheduledEventDefinition(type)
      expect(def, type).toBeDefined()
      expect(def!.ownerModuleId).toBe('staff')
      expect(def!.kind).toBe('mechanical')
    }
  })

  it('the twelve Phase 3 hook families all resolve to a registered owner', () => {
    // The `OBL-02` close for the staff half. Each of these names appeared in a
    // response profile as a bare string that nothing owned; each now maps to a
    // registered type whose adapter turns the name into a valid payload.
    const families: Array<[string, string]> = [
      ['staff_quit_risk_cook', STAFF_QUIT_RISK_EVENT],
      ['wage_expectation_cook', 'wage_expectation'],
      ['raise_promised_cook', 'raise_promised'],
      ['coverage_gap_cook', 'coverage_gap'],
      ['training_helper_cook', 'training_helper'],
      ['authority_test_cook', 'authority_test'],
      ['staff_bonus_expected_cook', 'staff_bonus_expected'],
      ['cross_staff_grumble_cook', 'cross_staff_grumble'],
      ['staff_backing_remembered_cook', 'staff_loyalty_memory'],
      ['staff_publicly_backed_cook', 'staff_loyalty_memory'],
      ['staff_betrayal_remembered_cook', 'staff_loyalty_memory'],
      ['staff_emotional_debt_cook', 'staff_loyalty_memory'],
    ]
    for (const [hookName, expectedType] of families) {
      const def = getScheduledEventDefinition(expectedType)!
      const adapted = def.fromFutureHook?.({
        hookName,
        readable: 'test',
        scheduledForDay: 7,
      })
      expect(adapted, hookName).toBeDefined()
      // The adapter builds a payload that passes the definition's own schema —
      // the bridge never guesses one.
      expect(def.payloadSchema.safeParse(adapted!.payload).success, hookName).toBe(
        true,
      )
      expect(adapted!.target).toEqual({ kind: 'staff', id: 'cook' })
    }
  })

  it('the loyalty-memory adapter never mistakes one family for another', () => {
    // `staff_publicly_backed_` and `staff_backing_remembered_` are close enough
    // that a shortest-prefix match would confuse them, so the adapter tries the
    // longest first.
    const def = getScheduledEventDefinition('staff_loyalty_memory')!
    const backed = def.fromFutureHook?.({
      hookName: 'staff_publicly_backed_server',
      readable: '',
      scheduledForDay: 5,
    })
    const remembered = def.fromFutureHook?.({
      hookName: 'staff_backing_remembered_server',
      readable: '',
      scheduledForDay: 5,
    })
    expect((backed!.payload as { kind: string }).kind).toBe('publicly_backed')
    expect((remembered!.payload as { kind: string }).kind).toBe(
      'backing_remembered',
    )
  })
})

describe('Phase 3 §3.3 — relationships form from contact and stay bounded', () => {
  it('an edge starts forming on the first shared shift and activates on repetition', () => {
    // The cook and the cleaner both work the kitchen and the main room on the
    // default assignment, so contact is a fact about the rota rather than a
    // fixture.
    const day1 = runDay(createInitialTavernState()).state
    const forming = listEdges(day1).filter((edge) => edge.kind === 'coworker')
    expect(forming.length).toBeGreaterThan(0)
    // One shared day is not a relationship yet.
    for (const edge of forming) {
      expect(edge.contacts).toBeLessThan(MIN_CONTACTS_FOR_ACTIVE_EDGE)
      expect(isActiveEdge(edge)).toBe(false)
    }

    const later = runQuietDays(day1, MIN_CONTACTS_FOR_ACTIVE_EDGE, `${SEED}-edges`)
    const active = listEdges(later).filter(
      (edge) => edge.kind === 'coworker' && isActiveEdge(edge),
    )
    expect(active.length).toBeGreaterThan(0)
    // A smooth run of days is a positive relationship.
    expect(active.some((edge) => edge.affinity > 0)).toBe(true)
  })

  it('an owner edge forms from owner actions and gates the owner\'s standing', () => {
    let state = withCoin(runDay(withCoin(createInitialTavernState(), 600)).state, 600)
    const before = ownerTrust(state, 'cook')
    for (let i = 0; i < 3; i += 1) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'cook' }],
          undefined,
          `${SEED}-owner-${i}`,
        ).state,
        600,
      )
    }
    const edge = listEdges(state).find((e) => e.kind === 'owner' && e.to.id === 'cook')
    expect(edge).toBeDefined()
    expect(isActiveEdge(edge!)).toBe(true)
    expect(ownerTrust(state, 'cook')).toBeGreaterThan(before)
  })

  it('no person exceeds the active-edge cap over a long run', () => {
    // §3.3 "cap each person's active social edges", checked across a run long
    // enough for every pair to have met.
    const state = runQuietDays(withCoin(createInitialTavernState(), 900), 30, `${SEED}-cap`)
    const edges = listEdges(state)
    const degree = new Map<string, number>()
    for (const edge of edges) {
      if (!isActiveEdge(edge)) continue
      for (const ref of [edge.from, edge.to]) {
        if (ref.kind !== 'staff') continue
        degree.set(ref.id, (degree.get(ref.id) ?? 0) + 1)
      }
    }
    for (const [staffId, count] of degree) {
      // The owner edge is kept whatever happens, so the ceiling is the coworker
      // cap plus that one.
      expect(count, staffId).toBeLessThanOrEqual(MAX_ACTIVE_EDGES_PER_STAFF + 1)
    }
  })

  it('an edge to a departed staff member is dropped, not left dangling', () => {
    let state = runQuietDays(withCoin(createInitialTavernState(), 600), 4, `${SEED}-drop`)
    expect(
      listEdges(state).some(
        (edge) => edge.from.id === 'cook' || edge.to.id === 'cook',
      ),
    ).toBe(true)

    state = withCoin(state, 600)
    const fired = runDay(state, [{ actionId: 'fire_staff', targetId: 'cook' }])
    expect(fired.state.staff['cook']).toBeUndefined()
    expect(
      listEdges(fired.state).some(
        (edge) => edge.from.id === 'cook' || edge.to.id === 'cook',
      ),
    ).toBe(false)
    // And validation agrees — an orphan edge is a reported structural problem.
    expect(fired.validation.errors).toEqual([])
  })
})

describe('Phase 3 §3.4 — the nine requirements of the quitting promise', () => {
  it('1–2: the player is warned by name, with itemised preventable contributors', () => {
    const state = tavernWithAMiserableCook(`${SEED}-warn`)
    expect(state.staff['cook']).toBeDefined()

    const contributors = describeQuitRiskContributors(state, 'cook')
    expect(contributors.length).toBeGreaterThan(0)
    // Preventable ones name the action that would fix them.
    const preventable = contributors.filter((row) => row.preventable)
    expect(preventable.length).toBeGreaterThan(0)
    for (const row of preventable) {
      expect(row.remedy, row.id).toBeDefined()
      expect(row.remedy!.length).toBeGreaterThan(0)
    }
    // Arrears specifically: this run left the cook unpaid, and the list says so
    // with the figure rather than "morale is low".
    expect(totalWageArrears(state, 'cook')).toBeGreaterThan(0)
    expect(contributors.some((row) => row.id === 'wage_arrears')).toBe(true)
  })

  it('4–5: the resolver reads live state, and a fixed-up tavern earns the no-op', () => {
    // Reach the risk, then actually fix the contributors — pay the back pay,
    // give them rest — and the promise lapses with a recorded reason rather than
    // costing the player a cook.
    let state = tavernWithAMiserableCook(`${SEED}-fixed`)
    if (!state.staff['cook']) return
    const owed = totalWageArrears(state)
    state = withCoin(state, owed + 400)
    state = runDay(
      state,
      [
        { actionId: 'pay_staff_wages', targetId: 'all' },
        { actionId: 'grant_staff_leave', targetId: 'cook', amount: 3 },
      ],
      undefined,
      `${SEED}-fixed-repair`,
    ).state
    expect(totalWageArrears(state, 'cook')).toBe(0)

    // Several quiet, well-paid days for the fatigue and the morale to come back.
    for (let i = 0; i < 10; i += 1) {
      state = withCoin(state, 400)
      state = runDay(state, undefined, undefined, `${SEED}-fixed-${i}`).state
      if (!state.staff['cook']) break
    }
    expect(state.staff['cook'], 'the cook stayed').toBeDefined()
    const after = quitRiskScore(describeQuitRiskContributors(state, 'cook'))
    // Every PREVENTABLE contributor is gone: what is left is the discipline
    // record, which is deliberately not something the player can undo.
    const remaining = describeQuitRiskContributors(state, 'cook')
    expect(remaining.some((row) => row.id === 'wage_arrears')).toBe(false)
    expect(remaining.some((row) => row.id === 'exhausted')).toBe(false)
    // And the total has fallen far enough that the resolver would defer rather
    // than separate — the intervention bought the cook back.
    expect(after).toBeLessThan(QUIT_RISK_DEFER_BELOW)
  })

  it('5–8: an unaddressed risk performs a real separation, with the whole trail', () => {
    // Keep playing badly and the cook goes. The point is not that they leave —
    // it is that everything that should follow, does.
    let state = tavernWithAMiserableCook(`${SEED}-quit`)
    for (let i = 0; i < 25 && state.staff['cook']; i += 1) {
      state = withCoin(state, 2)
      state = runDay(state, undefined, undefined, `${SEED}-quit-${i}`).state
    }

    // Either they are gone, or they are on notice and going — both are the
    // promise being kept.
    const slice = getStaffModuleState(state)
    const separated = state.staff['cook'] === undefined
    const onNotice = slice.employment['cook']?.notice !== undefined
    expect(separated || onNotice).toBe(true)

    if (separated) {
      // §3.4 item 6 — removed safely: nothing still points at them.
      expect(
        listEdges(state).some(
          (edge) => edge.from.id === 'cook' || edge.to.id === 'cook',
        ),
      ).toBe(false)
      expect(slice.employment['cook']).toBeUndefined()
      expect(slice.actors['cook']).toBeUndefined()
      expect(
        liveEventsOfType(state, STAFF_QUIT_RISK_EVENT).filter(
          (event) => event.target?.id === 'cook',
        ).length,
      ).toBe(0)
      // §3.4 item 7 — hiring needs updated immediately…
      expect(slice.laborMarket.vacancies.some((v) => v.roleId === 'cook')).toBe(true)
      // …and coverage on the next rota. The roster was built that morning, while
      // the cook was still on it, so the gap is a fact about the day AFTER the
      // separation rather than the day of it.
      const nextDay = runDay(
        withCoin(state, 200),
        undefined,
        undefined,
        `${SEED}-quit-after`,
      )
      expect(nextDay.validation.errors).toEqual([])
      expect(
        getStaffModuleState(nextDay.state).coverage.find(
          (row) => row.roleId === 'cook',
        )?.gap,
      ).toBeGreaterThan(0)
      // §3.4 item 8 — the record of it.
      expect(slice.separationHistory.some((entry) => entry.staffId === 'cook')).toBe(true)
      expect(
        state.history.some((entry) => entry.tags.includes('separation')),
      ).toBe(true)
      // And the archive keeps the terms, so "what were we paying them?" survives.
      expect(
        slice.employmentArchive.some((record) => record.staffId === 'cook'),
      ).toBe(true)
    }
  })

  it('3 + 5: a successful negotiation cancels the promise; a hollow one does not', () => {
    // The counterplay is gated on standing, not on spending an action. A tavern
    // that has invested in somebody can talk them round; one that has not,
    // cannot — and is told which contributor is in the way.
    //
    // BOTH CASES NEED A LIVE RISK, because the action is only offered when
    // somebody has actually announced they might go — a quit risk on the
    // calendar, a resignation on the record, or an intention declared last
    // night. The risk here is put on the calendar the way a response profile
    // puts one there, through the same bridge; what differs between the two
    // taverns is whether the owner has anything to say for themselves.
    let invested = withCoin(createInitialTavernState(), 900)
    for (let i = 0; i < 6; i += 1) {
      invested = withCoin(
        runCourierDay(
          invested,
          [{ actionId: 'train_staff', targetId: 'server' }],
          `${SEED}-invest-${i}`,
        ).state,
        900,
      )
    }
    const investedDay = invested.calendar.totalDaysElapsed
    courierQueue = [
      {
        hookName: 'staff_quit_risk_server',
        onDay: investedDay,
        scheduledForDay: investedDay + 5,
      },
    ]
    invested = withCoin(
      runCourierDay(invested, undefined, `${SEED}-invest-risk`).state,
      900,
    )
    courierQueue = []
    expect(
      liveEventsOfType(invested, STAFF_QUIT_RISK_EVENT).some(
        (event) => event.target?.id === 'server',
      ),
    ).toBe(true)
    // Nothing that takes coin rather than words is outstanding, so the only
    // question left is standing — which this owner has spent a week building.
    expect(
      describeQuitRiskContributors(invested, 'server').some((row) =>
        ['wage_arrears', 'unpaid_week', 'raise_refused'].includes(row.id),
      ),
    ).toBe(false)

    const trusted = runDay(
      invested,
      [{ actionId: 'negotiate_with_staff', targetId: 'server' }],
      undefined,
      `${SEED}-negotiate-good`,
    )
    const appliedGood = (
      trusted.state.modules['ownerActions'] as {
        applied?: Array<{ actionId: string; data: Record<string, unknown> }>
      }
    ).applied?.find((entry) => entry.actionId === 'negotiate_with_staff')
    expect(appliedGood).toBeDefined()
    expect(appliedGood!.data['persuaded']).toBe(true)

    // The hollow case: a tavern that owes the crew everything and has built no
    // standing at all. Same live risk, same conversation, opposite answer.
    let miserable = tavernWithAMiserableCook(`${SEED}-negotiate-bad`)
    if (!miserable.staff['cook']) return
    expect(totalWageArrears(miserable, 'cook')).toBeGreaterThan(0)
    const miserableDay = miserable.calendar.totalDaysElapsed
    courierQueue = [
      {
        hookName: 'staff_quit_risk_cook',
        onDay: miserableDay,
        scheduledForDay: miserableDay + 5,
      },
    ]
    miserable = runCourierDay(
      withCoin(miserable, 5),
      undefined,
      `${SEED}-negotiate-bad-risk`,
    ).state
    courierQueue = []
    const hollow = runDay(
      withCoin(miserable, 5),
      [{ actionId: 'negotiate_with_staff', targetId: 'cook' }],
      undefined,
      `${SEED}-negotiate-bad-run`,
    )
    const appliedBad = (
      hollow.state.modules['ownerActions'] as {
        applied?: Array<{ actionId: string; data: Record<string, unknown> }>
      }
    ).applied?.find((entry) => entry.actionId === 'negotiate_with_staff')
    expect(appliedBad).toBeDefined()
    expect(appliedBad!.data['persuaded']).toBe(false)
    // …and it says what is in the way.
    const effects =
      (
        hollow.state.modules['ownerActions'] as {
          applied?: Array<{ actionId: string; effects: string[] }>
        }
      ).applied?.find((entry) => entry.actionId === 'negotiate_with_staff')
        ?.effects ?? []
    expect(effects.length).toBeGreaterThan(1)
  })

  it('7: a quit risk about somebody already gone resolves as an explained no-op', () => {
    // The resolver's `missingTarget: 'resolve_anyway'` branch. Reached the honest
    // way: get a risk onto the calendar, then dismiss the person before it fires.
    let state = tavernWithAMiserableCook(`${SEED}-departed`)
    if (!state.staff['cook']) return
    const live = liveEventsOfType(state, STAFF_QUIT_RISK_EVENT)
    if (live.length === 0) return

    state = withCoin(state, 600)
    state = runDay(
      state,
      [{ actionId: 'fire_staff', targetId: 'cook' }],
      undefined,
      `${SEED}-departed-fire`,
    ).state
    expect(state.staff['cook']).toBeUndefined()

    // Dismissal withdraws the events about them, so the promise is closed with a
    // reason rather than firing at nobody.
    const stillLive = liveEventsOfType(state, STAFF_QUIT_RISK_EVENT).filter(
      (event) => event.target?.id === 'cook',
    )
    expect(stillLive.length).toBe(0)
    const closed = readScheduledEventsSlice(state).queue.filter(
      (event) => event.target?.id === 'cook',
    )
    for (const event of closed) {
      expect(['cancelled', 'superseded', 'resolved', 'no_op']).toContain(event.status)
    }
  })

  it('9: two promises about the same person cannot produce two resignations', () => {
    // §3.4 item 9, at the scheduling end. `scheduleQuitRisk` refuses a second
    // live risk for the same person, which is what stops three response profiles
    // that all worry about the cook costing the player three cooks.
    const state = tavernWithAMiserableCook(`${SEED}-once`)
    const live = liveEventsOfType(state, STAFF_QUIT_RISK_EVENT).filter(
      (event) => event.target?.id === 'cook',
    )
    expect(live.length).toBeLessThanOrEqual(1)
    // And at the firing end: at most one honoured outcome per scheduled day.
    const outcomes = outcomesOfType(state, STAFF_QUIT_RISK_EVENT)
    const keys = outcomes.map((outcome) => outcome.eventId)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('Phase 3 §3.4 — notice, and quitting mid-commitment', () => {
  it('notice is a real clock: off the floor while it runs, gone when it expires', () => {
    let state = withCoin(runQuietDays(withCoin(createInitialTavernState(), 600), 3, `${SEED}-notice`), 600)
    const given = runDay(state, [
      { actionId: 'give_staff_notice', targetId: 'server' },
    ])
    state = given.state
    const record = getStaffModuleState(state).employment['server']!
    expect(record.notice?.givenBy).toBe('owner')
    expect(state.staff['server']!.absence?.kind).toBe('notice_served')
    // The coverage cost lands WHILE the notice runs — that is what makes notice
    // a cheaper-in-coin, dearer-in-cover alternative to dismissal.
    expect(
      getStaffModuleState(state).coverage.find((row) => row.roleId === 'server')?.gap,
    ).toBeGreaterThan(0)
    // A separation event is on the calendar for the day it ends.
    expect(
      liveEventsOfType(state, STAFF_SEPARATION_EVENT).some(
        (event) => event.target?.id === 'server',
      ),
    ).toBe(true)

    // Run past it: they are gone, and everything is cleaned up.
    for (let i = 0; i < 5 && state.staff['server']; i += 1) {
      state = withCoin(state, 600)
      state = runDay(state, undefined, undefined, `${SEED}-notice-run-${i}`).state
    }
    expect(state.staff['server']).toBeUndefined()
    expect(getStaffModuleState(state).employment['server']).toBeUndefined()
  })

  it('withdrawing notice puts them back on the rota and withdraws the event', () => {
    let state = withCoin(runQuietDays(withCoin(createInitialTavernState(), 900), 4, `${SEED}-withdraw`), 900)
    // Build standing so the negotiation lands.
    for (let i = 0; i < 3; i += 1) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          undefined,
          `${SEED}-withdraw-train-${i}`,
        ).state,
        900,
      )
    }
    state = runDay(state, [
      { actionId: 'give_staff_notice', targetId: 'server' },
    ]).state
    expect(getStaffModuleState(state).employment['server']!.notice).toBeDefined()

    // An owner-given notice is not a resignation, so negotiation does not undo
    // it — the withdrawal path is for a staff resignation. What it must not do is
    // leave the record inconsistent.
    const negotiated = runDay(
      withCoin(state, 900),
      [{ actionId: 'negotiate_with_staff', targetId: 'server' }],
      undefined,
      `${SEED}-withdraw-negotiate`,
    )
    expect(negotiated.validation.errors).toEqual([])
  })

  it('6: somebody quitting mid-shift and mid-project leaves the run consistent', () => {
    // The "quitting during an active project, arc, and scheduled shift" case.
    // The cleaner/bouncer is put on `minor_repairs` (the construction crew
    // priority, so they are committed to site work) and stationed away from
    // their default room, then dismissed on that very day.
    let state = withCoin(runQuietDays(withCoin(createInitialTavernState(), 900), 3, `${SEED}-midshift`), 900)
    state = runDay(
      state,
      [{ actionId: 'assign_staff_area', targetId: 'cleaner_bouncer:cellar' }],
      { cleaner_bouncer: 'minor_repairs' },
      `${SEED}-midshift-assign`,
    ).state
    const row = getStaffModuleState(state).roster.find(
      (entry) => entry.staffId === 'cleaner_bouncer',
    )!
    expect(row.workKind).toBe('repair')

    const fired = runDay(
      withCoin(state, 900),
      [{ actionId: 'fire_staff', targetId: 'cleaner_bouncer' }],
      { cleaner_bouncer: 'minor_repairs' },
      `${SEED}-midshift-fire`,
    )
    expect(fired.state.staff['cleaner_bouncer']).toBeUndefined()
    expect(fired.validation.errors).toEqual([])
    // The roster row went with them.
    expect(
      getStaffModuleState(fired.state).roster.some(
        (entry) => entry.staffId === 'cleaner_bouncer',
      ),
    ).toBe(false)

    // And the day after still runs.
    const next = runDay(fired.state, undefined, undefined, `${SEED}-midshift-next`)
    expect(next.validation.errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The hook courier, for the review regressions below.
//
// Four of the eleven findings are in resolvers that only a ROUTED FUTURE HOOK
// reaches: `raise_promised`, `training_helper`, `staff_bonus_expected` and a
// quit risk that arrives from a response profile rather than from the staff
// module's own scheduler. No shipped response profile in the tree emits those
// hooks on a route a test can steer, so this module does what
// `ctxApplier.routeFutureHook` does — look the hook name up in the registry,
// ask the OWNING module's adapter for a payload, and call `scheduleEvent` —
// and nothing else. It writes no state of its own, guesses no payload, and
// runs in `applyResponses`, the same phase the real bridge runs in.
//
// This is the `obligationProbe` precedent from Phase 1: a real module on a real
// pipeline using the sanctioned public API. It is not fixture injection —
// every field of every event below is built by the shipped adapter.
// ---------------------------------------------------------------------------

type CourierDelivery = {
  hookName: string
  /** The day the response would have declared the hook. */
  onDay: number
  /** The day the hook comes due. */
  scheduledForDay: number
}

let courierQueue: CourierDelivery[] = []

const hookCourierModule: SimulationModule = {
  id: 'phase210_hook_courier',
  version: '0.1.0',
  hooks: {
    applyResponses: [
      (ctx) => {
        const today = ctx.state.calendar.totalDaysElapsed
        for (const delivery of courierQueue) {
          if (delivery.onDay !== today) continue
          const definition = findScheduledEventDefinitionForHookName(
            delivery.hookName,
          )
          const adapted = definition?.fromFutureHook?.({
            hookName: delivery.hookName,
            readable: `Somebody said something about ${delivery.hookName}.`,
            scheduledForDay: delivery.scheduledForDay,
          })
          if (!definition || !adapted) {
            throw new Error(`no registered owner for '${delivery.hookName}'`)
          }
          const result = scheduleEvent(ctx, {
            type: definition.type,
            ...(adapted.target ? { target: adapted.target } : {}),
            scheduledForDay: delivery.scheduledForDay,
            payload: adapted.payload,
            origin: {
              source: 'test.hook_courier',
              readable: `Somebody said something about ${delivery.hookName}.`,
            },
          })
          if (result.status === 'rejected') throw new Error(result.reason)
        }
      },
    ],
    // A second seam, at the beat the staff actors themselves run on. Some of
    // the fixes below are in domain calls the actor makes — `setAbsence` with a
    // day's unexcused absence, `scheduleQuitRisk` — and the honest way to reach
    // those is to make the same call at the same beat, not to write the state
    // they would have produced.
    endDay: [
      (ctx) => {
        const today = ctx.state.calendar.totalDaysElapsed
        for (const probe of eveningProbes) {
          if (probe.onDay !== today) continue
          probe.run(ctx)
        }
      },
    ],
  },
}

type EveningProbe = { onDay: number; run: (ctx: SimContext) => void }
let eveningProbes: EveningProbe[] = []

const COURIER_PIPELINE = [...FULL_PIPELINE, hookCourierModule]

function runCourierDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
  seed = SEED,
) {
  return simulateDay(state, input(actions, undefined, seed), COURIER_PIPELINE)
}

/** One row per event id: `archive` and `resolvedToday` overlap on the last day. */
function outcomeRows(state: TavernState, type: string) {
  const slice = readScheduledEventsSlice(state)
  const byId = new Map<string, Array<{ status: string; reason?: string }>>()
  for (const outcome of [...slice.archive, ...slice.resolvedToday]) {
    if (outcome.type !== type) continue
    const rows = byId.get(outcome.eventId) ?? []
    if (
      !rows.some(
        (row) => row.status === outcome.status && row.reason === outcome.reason,
      )
    ) {
      rows.push({
        status: outcome.status,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      })
    }
    byId.set(outcome.eventId, rows)
  }
  return byId
}

describe('Phase 3 — Codex review regressions (PR #248)', () => {
  it('a promised rise is judged by whether a rise happened, not by the wage on record', () => {
    // P1. The hook-routed branch carried no terms, so the resolver fell back to
    // comparing today's wage against the wage on the EMPLOYMENT RECORD — which
    // granting the rise is exactly what moves. Every kept promise read as broken.
    // `lastRaiseOnDay` records the event instead of the level.
    const schedule = (grantRaise: boolean, seed: string) => {
      let state = withCoin(createInitialTavernState(), 900)
      courierQueue = [
        { hookName: 'raise_promised_cook', onDay: 1, scheduledForDay: 5 },
      ]
      for (let day = 0; day < 6; day += 1) {
        const raise =
          grantRaise && day === 3
            ? [
                {
                  actionId: 'adjust_staff_wage',
                  targetId: 'cook',
                  amount: state.staff['cook']!.wage + 3,
                } as SimInputOwnerAction,
              ]
            : undefined
        state = withCoin(runCourierDay(state, raise, `${seed}-${day}`).state, 900)
      }
      return state
    }

    const kept = schedule(true, `${SEED}-reg-raise-kept`)
    // The rise is stamped with the DAY it happened, which is the fact the
    // resolver needs and the wage figure cannot supply.
    expect(getStaffModuleState(kept).employment['cook']!.lastRaiseOnDay).toBe(3)
    const keptRows = outcomeRows(kept, 'raise_promised')
    expect(keptRows.size).toBe(1)
    const keptOutcome = [...keptRows.values()][0]![0]!
    expect(keptOutcome.status).toBe('no_op')
    expect(keptOutcome.reason).toContain('the promise was kept')

    // And the broken promise still lands, so the fix did not simply stop the
    // event mattering.
    const broken = schedule(false, `${SEED}-reg-raise-broken`)
    expect(
      getStaffModuleState(broken).employment['cook']!.lastRaiseOnDay,
    ).toBeUndefined()
    const brokenOutcome = [...outcomeRows(broken, 'raise_promised').values()][0]![0]!
    expect(brokenOutcome.status).toBe('resolved')
  })

  it('a wage CUT is not recorded as a rise', () => {
    // The other half of the same fix: `lastRaiseOnDay` moves on the way up only.
    let state = withCoin(runQuietDays(withCoin(createInitialTavernState(), 900), 2, `${SEED}-reg-cut`), 900)
    state = runDay(
      state,
      [
        {
          actionId: 'adjust_staff_wage',
          targetId: 'cook',
          amount: Math.max(1, state.staff['cook']!.wage - 3),
        },
      ],
      undefined,
      `${SEED}-reg-cut-do`,
    ).state
    const record = getStaffModuleState(state).employment['cook']!
    expect(record.lastRaiseOnDay).toBeUndefined()
    expect(record.lastTransitionOnDay).toBe(state.calendar.totalDaysElapsed - 1)
  })

  it('an absence decided at the end of the day costs the NEXT day', () => {
    // P1. Staff actors run at `endDay`, when the shift is already worked, but
    // `setAbsence` always started the window today — so an unexcused absence
    // expired the very next morning. Nobody ever missed a roster, no service was
    // ever short-handed by it, and repeated absence could never reach the
    // abandonment threshold.
    let state = withCoin(createInitialTavernState(), 20)
    const pending = new Map<string, number>()
    let checked = 0
    for (let i = 0; i < 25; i += 1) {
      state = withCoin(state, 2)
      const before = state
      const dayPlayed = before.calendar.totalDaysElapsed

      const actions: SimInputOwnerAction[] = []
      for (const id of Object.keys(state.staff)) {
        const member = state.staff[id]!
        if (member.shift !== 'double' && !member.absence) {
          actions.push({ actionId: 'set_staff_shift', targetId: `${id}:double` })
        }
      }
      state = runDay(state, actions, undefined, `${SEED}-reg-absence-${i}`).state

      // Anybody who said last night that they were not coming in contributes
      // nothing to the rota that was built this morning. Without the fix the
      // absence had already expired by now, so the row read as a normal shift.
      for (const [staffId, startedOnDay] of pending) {
        if (startedOnDay !== dayPlayed) continue
        expect(before.staff[staffId]?.absence?.kind, staffId).toBe('unexcused')
        const row = getStaffModuleState(state).roster.find(
          (entry) => entry.staffId === staffId,
        )!
        expect(row.available, `${staffId} was on the rota anyway`).toBe(false)
        expect(row.absenceKind).toBe('unexcused')
        expect(row.contribution).toBe(0)
        pending.delete(staffId)
        checked += 1
      }

      for (const [id, member] of Object.entries(state.staff)) {
        if (!member.absence || before.staff[id]?.absence) continue
        if (member.absence.kind !== 'unexcused') continue
        // Decided this evening, so the day they are not coming in is TOMORROW.
        expect(member.absence.startedOnDay, id).toBe(dayPlayed + 1)
        expect(member.absence.untilDay).toBeGreaterThan(member.absence.startedOnDay)
        pending.set(id, member.absence.startedOnDay)
      }
      if (Object.keys(state.staff).length === 0) break
    }
    // The run has to have actually produced some, or this proves nothing.
    expect(checked).toBeGreaterThan(0)
  })

  it('cover is only offered by somebody who is actually on duty', () => {
    // P2. `findWillingCover` filtered on `unavailable` alone, so it could name
    // somebody on a rest day or working out their notice. `buildRoster` then
    // rejected them — and because the search returns ONE name, the next willing
    // colleague was never considered and the absence went uncovered.
    let state = runQuietDays(withCoin(createInitialTavernState(), 900), 24, `${SEED}-reg-cover`)
    const willing = findWillingCover(state, 'server', new Set<string>())
    expect(willing, 'the long run built a coworker edge worth covering for').toBe(
      'cleaner_bouncer',
    )

    // Put that same colleague on a rest day, and they stop being an answer.
    state = withCoin(
      runDay(
        withCoin(state, 900),
        [{ actionId: 'set_staff_shift', targetId: 'cleaner_bouncer:rest' }],
        undefined,
        `${SEED}-reg-cover-rest`,
      ).state,
      900,
    )
    expect(state.staff['cleaner_bouncer']!.shift).toBe('rest')
    expect(findWillingCover(state, 'server', new Set<string>())).toBeUndefined()

    // Nobody the search ever names is off duty, whoever is asking.
    for (const staffId of Object.keys(state.staff)) {
      const cover = findWillingCover(state, staffId, new Set<string>())
      if (!cover) continue
      const member = state.staff[cover]!
      expect(member.unavailable, cover).not.toBe(true)
      expect(member.absence, cover).toBeUndefined()
      expect(member.shift, cover).not.toBe('rest')
    }
  })

  it('a promotion does not cancel a live quit risk', () => {
    // P2. A promotion cancelled the raise demand AND the quit risk. The risk may
    // be about back pay, exhaustion or a discipline record, none of which a new
    // title fixes — so cancelling it let a promotion do what
    // `negotiate_with_staff` is deliberately forbidden from doing.
    let state = withCoin(createInitialTavernState(), 900)
    courierQueue = []
    let days = 0
    while (!checkPromotion(state, 'server').ok && days < 30) {
      state = withCoin(
        runCourierDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          `${SEED}-reg-promote-risk-${days}`,
        ).state,
        900,
      )
      days += 1
    }
    expect(checkPromotion(state, 'server').ok).toBe(true)

    const today = state.calendar.totalDaysElapsed
    courierQueue = [
      {
        hookName: 'staff_quit_risk_server',
        onDay: today,
        scheduledForDay: today + 4,
      },
    ]
    state = withCoin(
      runCourierDay(state, undefined, `${SEED}-reg-promote-risk-schedule`).state,
      900,
    )
    expect(
      liveEventsOfType(state, STAFF_QUIT_RISK_EVENT).some(
        (event) => event.target?.id === 'server',
      ),
    ).toBe(true)

    courierQueue = []
    const promoted = withCoin(
      runCourierDay(
        state,
        [{ actionId: 'promote_staff', targetId: 'server' }],
        `${SEED}-reg-promote-risk-do`,
      ).state,
      900,
    )
    expect(promoted.staff['server']!.role).toBe('head_server')
    // Still live: the resolver will re-read the contributors when the day comes
    // and stand them down if the promotion genuinely was the answer.
    expect(
      liveEventsOfType(promoted, STAFF_QUIT_RISK_EVENT).some(
        (event) => event.target?.id === 'server',
      ),
    ).toBe(true)
  })

  it('paying the bonus answers the expectation the promise created', () => {
    // P2. `pay_staff_bonus` writes the SHARED memory id `staff_bonus_paid_recently`
    // and names the person in `actors`/`metadata`, not in the id. The resolver
    // matched only per-staff ids, so the player could pay the bonus and still take
    // the morale penalty for not paying it.
    const play = (payBonus: boolean, seed: string) => {
      let state = withCoin(createInitialTavernState(), 900)
      courierQueue = [
        { hookName: 'staff_bonus_expected_cook', onDay: 2, scheduledForDay: 5 },
      ]
      for (let day = 0; day < 6; day += 1) {
        const actions =
          payBonus && day === 3
            ? [
                {
                  actionId: 'pay_staff_bonus',
                  targetId: 'cook',
                  amount: 15,
                } as SimInputOwnerAction,
              ]
            : undefined
        state = withCoin(runCourierDay(state, actions, `${seed}-${day}`).state, 900)
      }
      return state
    }

    const paid = [...outcomeRows(play(true, `${SEED}-reg-bonus-paid`), 'staff_bonus_expected').values()][0]![0]!
    expect(paid.status).toBe('no_op')
    expect(paid.reason).toContain('looked after')

    const unpaid = [...outcomeRows(play(false, `${SEED}-reg-bonus-unpaid`), 'staff_bonus_expected').values()][0]![0]!
    expect(unpaid.status).toBe('resolved')
  })

  it('the mentor the hook names is the one who teaches', () => {
    // P2. `training_helper_<staffId>` names the MENTOR — the response profile
    // gives that person the mentoring fatigue and the loyalty for it. Reading the
    // subject as the learner and hunting for somebody better sent the event
    // looking for a mentor for the best hand on the crew, so it no-opped.
    let state = withCoin(createInitialTavernState(), 900)
    courierQueue = []
    for (let i = 0; i < 20; i += 1) {
      state = withCoin(
        runCourierDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          `${SEED}-reg-mentor-${i}`,
        ).state,
        900,
      )
    }
    // The server is now the strongest hand and has a real friendship on the crew.
    expect(state.staff['server']!.skill).toBeGreaterThan(state.staff['cook']!.skill)
    expect(findTrainingLearner(state, 'server')).toBe('cleaner_bouncer')

    const today = state.calendar.totalDaysElapsed
    courierQueue = [
      {
        hookName: 'training_helper_server',
        onDay: today,
        scheduledForDay: today + 3,
      },
    ]
    const learnerSkillBefore = state.staff['cleaner_bouncer']!.skill
    for (let i = 0; i < 4; i += 1) {
      state = withCoin(
        runCourierDay(state, undefined, `${SEED}-reg-mentor-run-${i}`).state,
        900,
      )
    }
    const rows = [...outcomeRows(state, 'training_helper').values()][0]!
    expect(rows[0]!.status).toBe('resolved')
    // The teaching landed on the LESS skilled colleague, not on the mentor.
    expect(state.staff['cleaner_bouncer']!.skill).toBeGreaterThan(learnerSkillBefore)
    expect(
      getStaffModuleState(state).development.some(
        (entry) => entry.staffId === 'cleaner_bouncer',
      ),
    ).toBe(true)
  })

  it('a dismissal at the end of the discipline ladder does not cost the crew morale', () => {
    // P2. Charging the same crew-wide morale hit for a dismissal everybody
    // watched coming as for an arbitrary firing made the ladder mechanically
    // pointless and taxed the player for following it.
    const base = withCoin(
      runQuietDays(withCoin(createInitialTavernState(), 900), 6, `${SEED}-reg-warned`),
      900,
    )

    const arbitrary = runDay(
      base,
      [{ actionId: 'fire_staff', targetId: 'cook' }],
      undefined,
      `${SEED}-reg-warned-arbitrary`,
    )
    const arbitraryWitnesses = arbitrary.state.causes.filter((cause) =>
      cause.tags?.includes('witness'),
    )
    expect(arbitraryWitnesses.length).toBeGreaterThan(0)

    let warned = base
    for (let i = 0; i < MAX_DISCIPLINE_ESCALATION; i += 1) {
      warned = withCoin(
        runDay(
          warned,
          [{ actionId: 'discipline_staff', targetId: 'cook' }],
          undefined,
          `${SEED}-reg-warned-warn-${i}`,
        ).state,
        900,
      )
    }
    expect(getStaffModuleState(warned).employment['cook']!.escalation).toBe(
      MAX_DISCIPLINE_ESCALATION,
    )
    const dueProcess = runDay(
      warned,
      [{ actionId: 'fire_staff', targetId: 'cook' }],
      undefined,
      `${SEED}-reg-warned-fire`,
    )
    expect(dueProcess.state.staff['cook']).toBeUndefined()
    expect(
      dueProcess.state.causes.filter((cause) => cause.tags?.includes('witness')),
    ).toEqual([])
  })

  it('a separation event that performs its own separation files exactly one outcome', () => {
    // P2. The event is still live in the queue while its own resolver runs, so
    // `separateStaff`'s cleanup archived it as `cancelled` and the shared
    // resolver then archived the same firing as `resolved` — two outcome rows
    // and two contradictory totals for one event.
    let state = withCoin(
      runQuietDays(withCoin(createInitialTavernState(), 900), 4, `${SEED}-reg-onerow`),
      900,
    )
    state = withCoin(
      runDay(
        state,
        [{ actionId: 'give_staff_notice', targetId: 'server' }],
        undefined,
        `${SEED}-reg-onerow-notice`,
      ).state,
      900,
    )
    for (let i = 0; i < 6 && state.staff['server']; i += 1) {
      state = withCoin(
        runDay(state, undefined, undefined, `${SEED}-reg-onerow-run-${i}`).state,
        900,
      )
    }
    expect(state.staff['server']).toBeUndefined()

    const rows = outcomeRows(state, STAFF_SEPARATION_EVENT)
    expect(rows.size).toBe(1)
    const statuses = [...rows.values()][0]!.map((row) => row.status)
    expect(statuses).toEqual(['resolved'])
  })

  it('nobody who came back this morning is taken out again the same morning', () => {
    // P2. Returns are processed before the illness roll so that somebody whose
    // leave ends this morning is available — but the roll then considered that
    // still-tired person and could take them straight back out before they ever
    // reached a roster.
    //
    // Four differently-seeded runs, because a single run only produces a handful
    // of return mornings and the old behaviour was a dice roll on each one: one
    // run could pass on luck. Every return morning in all four is checked.
    let returns = 0
    for (const variant of ['a', 'b', 'c', 'd']) {
      let state = withCoin(createInitialTavernState(), 20)
      for (let i = 0; i < 25; i += 1) {
        state = withCoin(state, 2)
        const before = state
        const actions: SimInputOwnerAction[] = []
        for (const id of Object.keys(state.staff)) {
          const member = state.staff[id]!
          if (member.shift !== 'double' && !member.absence) {
            actions.push({ actionId: 'set_staff_shift', targetId: `${id}:double` })
          }
        }
        state = runDay(
          state,
          actions,
          undefined,
          `${SEED}-reg-return-${variant}-${i}`,
        ).state
        const today = state.calendar.totalDaysElapsed - 1

        for (const [id, member] of Object.entries(state.staff)) {
          const was = before.staff[id]?.absence
          if (!was || was.kind === 'notice_served') continue
          if (was.untilDay > today) continue
          // Their absence ended this morning, so they are back — and STAY back.
          returns += 1
          expect(member.absence, `${id} was taken straight back out`).toBeUndefined()
          expect(
            getStaffModuleState(state).roster.find((row) => row.staffId === id)
              ?.available,
            `${id} came back but never worked`,
          ).toBe(true)
        }
        if (Object.keys(state.staff).length === 0) break
      }
    }
    expect(returns).toBeGreaterThan(0)
  })
})

describe('Phase 3 §3.2 / §3.4 — burnout has a real consequence', () => {
  it('4: sustained overwork produces absence, not just a higher meter', () => {
    // Doubles every day, never a rest day. The illness rule reads fatigue and
    // consecutive days worked, so the player who does this loses bodies.
    let state = withCoin(createInitialTavernState(), 900)
    let sawAbsence = false
    for (let i = 0; i < 30; i += 1) {
      state = withCoin(state, 900)
      const actions: SimInputOwnerAction[] = []
      for (const id of Object.keys(state.staff)) {
        if (state.staff[id]!.shift !== 'double' && !state.staff[id]!.absence) {
          actions.push({ actionId: 'set_staff_shift', targetId: `${id}:double` })
        }
      }
      state = runDay(state, actions, undefined, `${SEED}-burnout-${i}`).state
      if (Object.values(state.staff).some((m) => m.absence)) sawAbsence = true
    }
    expect(sawAbsence).toBe(true)
    expect(getStaffModuleState(state).totals.absenceDays).toBeGreaterThan(0)
  })

  it('the autonomous staff actor announces its move before it makes it', () => {
    // §1.6's visible intent, which is what makes an autonomous crew fair rather
    // than an ambush: the player is told, and gets a turn.
    // Checked on the first evening: an actor decides at `endDay` and carries the
    // move out the following one, so the intent is declared and reported before
    // anything happens. Checking a later day would be checking a cooldown.
    const result = runDay(
      withCoin(createInitialTavernState(), 600),
      undefined,
      undefined,
      `${SEED}-intent`,
    )
    const intents = listStaffIntents(result.state)
    expect(intents.length).toBeGreaterThan(0)
    for (const intent of intents) {
      expect(intent.readable.length).toBeGreaterThan(0)
      expect(intent.decidedOnDay).toBeLessThanOrEqual(
        result.state.calendar.totalDaysElapsed,
      )
    }
    // And the same day's report says so, so it is discoverable without reading
    // state — the player gets the turn the fairness rule promises.
    const section = result.reports.find((s) => s.id === 'staff')!
    expect(section.lines.join('\n')).toContain('Staff intentions:')
  })
})

describe('Phase 3 — Codex review regressions, second round (PR #248)', () => {
  it('a bonus promise is judged on the money going up again, not on the ordinary wage', () => {
    // `wage_expectation_*` comes from `pay_bonus_profile`: a ONE-OFF bonus, and
    // the promise is that it becomes the floor. The resolver tested
    // `paidThisWeek`, which a bonus does not change and the next ordinary
    // settlement always does — so the consequence never once landed.
    const play = (payAgain: boolean, seed: string) => {
      let state = withCoin(createInitialTavernState(), 900)
      courierQueue = [
        { hookName: 'wage_expectation_cook', onDay: 2, scheduledForDay: 6 },
      ]
      for (let day = 0; day < 7; day += 1) {
        const actions =
          payAgain && day === 3
            ? [
                {
                  actionId: 'pay_staff_bonus',
                  targetId: 'cook',
                  amount: 12,
                } as SimInputOwnerAction,
              ]
            : undefined
        state = withCoin(runCourierDay(state, actions, `${seed}-${day}`).state, 900)
      }
      courierQueue = []
      return state
    }

    // Paid every week, on time, and never another coin: the expectation is not
    // being met, whatever `paidThisWeek` says.
    const ordinary = play(false, `${SEED}-reg2-wage-ordinary`)
    expect(ordinary.staff['cook']!.paidThisWeek).toBe(true)
    const ordinaryOutcome = [...outcomeRows(ordinary, 'wage_expectation').values()][0]![0]!
    expect(ordinaryOutcome.status).toBe('resolved')

    // Another bonus, and it is.
    const kept = play(true, `${SEED}-reg2-wage-kept`)
    const keptOutcome = [...outcomeRows(kept, 'wage_expectation').values()][0]![0]!
    expect(keptOutcome.status).toBe('no_op')
    expect(keptOutcome.reason).toContain('went up again')
  })

  it('the worker whose load was lightened does not count as their own cover', () => {
    // `coverage_gap_*` comes from `reduce_workload_profile`, which marks nobody
    // absent and changes no shift. Counting every body on the role — the subject
    // included — made a one-person role read as covered by the very person whose
    // load was removed, so the delayed consequence never reached its fatigue
    // branch.
    let state = withCoin(createInitialTavernState(), 900)
    courierQueue = [
      { hookName: 'coverage_gap_cook', onDay: 2, scheduledForDay: 5 },
    ]
    let fatigueBefore = 0
    for (let day = 0; day < 6; day += 1) {
      if (day === 4) fatigueBefore = state.staff['server']!.fatigue
      state = withCoin(
        runCourierDay(state, undefined, `${SEED}-reg2-gap-${day}`).state,
        900,
      )
    }
    courierQueue = []

    const outcome = [...outcomeRows(state, 'coverage_gap').values()][0]![0]!
    expect(outcome.status).toBe('resolved')
    // And it landed on a COLLEAGUE. The person whose load the player lightened
    // is not the one who pays for it.
    expect(state.staff['server']!.fatigue).toBeGreaterThan(fatigueBefore)
    expect(
      state.causes.some(
        (cause) =>
          cause.source === 'staff.coverage_gap' &&
          cause.target?.includes('cook') === true,
      ),
    ).toBe(false)
  })

  it('repeated no-shows add up to abandonment', () => {
    // `ABANDONMENT_DAYS` was written against ONE absence's length, and the only
    // thing that writes an unexcused absence takes a single day at a time on a
    // seven-day cooldown — so the rule could not fire, ever. The run is counted
    // across absences now, and the check happens before the return pass (an
    // absence is cleared the morning its `untilDay` arrives, so a check after it
    // could never see one that had run its full length either).
    //
    // The four no-shows are made the way the actor makes them: the same
    // `setAbsence` call, at the same `endDay` beat, one day at a time.
    const callInSick = (onDay: number): EveningProbe => ({
      onDay,
      run: (ctx) => {
        setAbsence(ctx, 'cook', {
          kind: 'unexcused',
          days: 1,
          reason: 'did not come in',
          source: 'test.call_in_sick',
          includeToday: false,
        })
      },
    })
    // Spaced like the actor's own seven-day cooldown, inside the remembered
    // window.
    eveningProbes = [callInSick(2), callInSick(9), callInSick(16), callInSick(23)]

    let state = withCoin(createInitialTavernState(), 900)
    const runs: number[] = []
    for (let day = 0; day < 26 && state.staff['cook']; day += 1) {
      state = withCoin(
        runCourierDay(state, undefined, `${SEED}-reg2-abandon-${day}`).state,
        900,
      )
      const record = getStaffModuleState(state).employment['cook']
      if (record?.unexcusedDays) runs.push(record.unexcusedDays)
    }
    eveningProbes = []

    // The run accumulated rather than resetting to one every time…
    expect(runs[runs.length - 1] ?? 0).toBeGreaterThanOrEqual(ABANDONMENT_DAYS)
    // …and the job went with it.
    expect(state.staff['cook']).toBeUndefined()
    const separation = getStaffModuleState(state).separationHistory.find(
      (entry) => entry.staffId === 'cook',
    )
    expect(separation?.kind).toBe('abandoned')
    expect(separation?.reason).toContain('did not come in')
  })

  it('an actor does not hand in notice while a warning is still running', () => {
    // `scheduleQuitRisk` returns false for three different reasons and the actor
    // read all of them as "the warning has already run its course", so a live
    // promise — with days of warning window and a live contributor list — was
    // skipped and notice went in immediately. The result is discriminated now.
    let state = withCoin(createInitialTavernState(), 900)
    const today = 2
    courierQueue = [
      { hookName: 'staff_quit_risk_cook', onDay: today, scheduledForDay: today + 6 },
    ]
    const results: string[] = []
    eveningProbes = [
      {
        onDay: today + 1,
        run: (ctx) => {
          results.push(
            scheduleQuitRisk(ctx, 'cook', {
              reason: 'has had enough of the place',
              source: 'test.give_notice',
            }),
          )
        },
      },
    ]
    for (let day = 0; day < today + 2; day += 1) {
      state = withCoin(
        runCourierDay(state, undefined, `${SEED}-reg2-notice-${day}`).state,
        900,
      )
    }
    courierQueue = []
    eveningProbes = []

    // The refusal is distinguishable: the promise is live, not spent.
    expect(results).toEqual(['already_live'])
    // …and the original warning is still the one in charge.
    expect(
      liveEventsOfType(state, STAFF_QUIT_RISK_EVENT).some(
        (event) => event.target?.id === 'cook',
      ),
    ).toBe(true)
    expect(getStaffModuleState(state).employment['cook']?.notice).toBeUndefined()
  })

  it('the weekly actor allowance is not refilled mid-week', () => {
    // The pass runs at `endDay`, so topping up on `isEndOfWeek()` handed the
    // actor a fresh allowance BEFORE day seven's own action — a fourth move in a
    // three-move week, charged to the week after.
    let state = withCoin(createInitialTavernState(), 900)
    const budgets: number[] = []
    for (let day = 0; day < 8; day += 1) {
      state = withCoin(
        runDay(state, undefined, undefined, `${SEED}-reg2-budget-${day}`).state,
        900,
      )
      budgets.push(getStaffModuleState(state).actors['cook']?.budget ?? -1)
    }
    // Days 1..7 only ever spend.
    for (let i = 1; i < 7; i += 1) {
      expect(budgets[i]!, `day ${i + 1}`).toBeLessThanOrEqual(budgets[i - 1]!)
    }
    // Day 8 is the first day of the next week, so the allowance is back — and
    // never above the week's ration.
    expect(budgets[7]!).toBeGreaterThanOrEqual(budgets[6]!)
    for (const budget of budgets) {
      expect(budget).toBeLessThanOrEqual(WEEKLY_ACTOR_BUDGET)
    }
  })

  it('an off-duty colleague cannot be the one who showed them the job', () => {
    // The mirror of the cover fix. Nothing downstream rechecks the helper, so an
    // ill or resting colleague was granting the enhanced training bonus and being
    // reported as having taught a lesson they were not present for.
    // The server is trained into a genuine mentor: a real skill gap over the
    // cleaner, and a friendship built by working the same rooms.
    let state = withCoin(createInitialTavernState(), 900)
    for (let i = 0; i < 20; i += 1) {
      state = withCoin(
        runDay(
          state,
          [{ actionId: 'train_staff', targetId: 'server' }],
          undefined,
          `${SEED}-reg2-helper-${i}`,
        ).state,
        900,
      )
    }
    expect(findTrainingHelper(state, 'cleaner_bouncer')).toBe('server')

    state = withCoin(
      runDay(
        withCoin(state, 900),
        [{ actionId: 'set_staff_shift', targetId: 'server:rest' }],
        undefined,
        `${SEED}-reg2-helper-rest`,
      ).state,
      900,
    )
    expect(state.staff['server']!.shift).toBe('rest')
    expect(findTrainingHelper(state, 'cleaner_bouncer')).toBeUndefined()
  })

  it('a retention talk needs somebody to be leaving', () => {
    // The action accepted every live employee. A settled one has no contributors
    // and no material blocker, so `persuaded` came back true automatically and
    // the player could spend a short conversation every day, on everybody, for
    // +10 morale / +12 loyalty / -6 stress and a step of standing.
    const settled = runQuietDays(withCoin(createInitialTavernState(), 900), 3, `${SEED}-reg2-settled`)
    const definition = actionRegistry.get('negotiate_with_staff')
    expect(listValidTargets(definition, settled)).toEqual([])

    const refused = runDay(
      withCoin(settled, 900),
      [{ actionId: 'negotiate_with_staff', targetId: 'cook' }],
      undefined,
      `${SEED}-reg2-settled-try`,
    )
    const rejected = (
      refused.state.modules['ownerActions'] as {
        rejected?: Array<{ actionId: string; code: string; reason: string }>
      }
    ).rejected?.find((entry) => entry.actionId === 'negotiate_with_staff')
    expect(rejected?.code).toBe('no_retention_risk')
    // And it says why, in the player's terms.
    expect(rejected?.reason).toContain('settled')

    // The same crew, once one of them is actually at risk: offered, by name.
    const day = settled.calendar.totalDaysElapsed
    courierQueue = [
      { hookName: 'staff_quit_risk_cook', onDay: day, scheduledForDay: day + 5 },
    ]
    const atRisk = runCourierDay(
      withCoin(settled, 900),
      undefined,
      `${SEED}-reg2-settled-risk`,
    ).state
    courierQueue = []
    expect(listValidTargets(definition, atRisk).map((t) => t.id)).toEqual(['cook'])
  })
})
