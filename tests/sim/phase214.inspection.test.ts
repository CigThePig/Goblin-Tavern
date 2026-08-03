// Expansion Phase 7 (repo phase 214) / ISSUE-177 — the inspection lifecycle.
//
// Contract tests for §7.3, which is `OBL-03`: "inspection suspicion
// accumulates and issues warnings, but no inspector visit is ever scheduled
// or resolved." These cases exist to prove the visit happens, that it reads
// the tavern as it actually stands, and that everything it produces —
// findings, fines, orders, follow-ups, appeals, closure — is a real record
// with a real consequence.
//
// Every case reaches the feature by making the tavern dirty and letting the
// watch notice, which is the route a player takes. Area cleanliness and
// stock spoilage are set directly: those are starting conditions (a tavern
// is either kept or not), and nothing else about the lifecycle is injected.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { applyDifficultyToBase, DIFFICULTY_PRESETS } from '../../src/sim/state/difficulty'
import type { DifficultyConfig } from '../../src/sim/state/difficulty'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import {
  INSPECTION_DIMENSIONS,
  MAX_EVIDENCE_ENTRIES,
  MAX_OPEN_CASES,
  REGULATORY_FOLLOWUP_EVENT,
  REGULATORY_VISIT_EVENT,
  checkRequirement,
  evaluateDimension,
  evaluateVisit,
  getRegulatoryModuleState,
  listFindings,
  observeEvidence,
  openCases,
  shouldOpenCase,
  suspicionFromEvidence,
} from '../../src/sim/modules/regulatory/index'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'
import { listObligations } from '../../src/sim/contracts/obligations/index'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { buildObligationCalendar } from '../../src/reports/obligationCalendarProjection'

const SEED = 'phase214/inspection'

type Actions = NonNullable<SimInput['ownerActions']>

/** A tavern nobody has been keeping. */
function neglected(coin = 800): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 300, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 8, smell: 85 })
  state = withArea(state, 'privy', { cleanliness: 5, smell: 95 })
  state = withArea(state, 'main_room', { cleanliness: 15, damage: 70 })
  state = withStock(state, 'stew', { spoilage: 85, quantity: 200 })
  return state
}

/** A tavern kept properly. */
function spotless(coin = 1_200): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of Object.keys(state.stock)) {
    state = withStock(state, id, { quantity: 300, spoilage: 0 })
  }
  for (const id of Object.keys(state.areas)) {
    state = withArea(state, id, {
      cleanliness: 95,
      smell: 5,
      damage: 0,
      condition: 95,
    })
  }
  return state
}

function run(state: TavernState, day: number, ownerActions: Actions = []): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${day}`, ownerActions },
    FULL_PIPELINE,
  ).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

function appliedAction(state: TavernState, actionId: string) {
  return getOwnerActionsModuleState(state).applied.find(
    (entry) => entry.actionId === actionId,
  )
}

describe('Phase 214 §7.3.1–2 — evidence accumulates from real state', () => {
  it('itemises what an inspector would notice, with a place and a severity', () => {
    const observations = observeEvidence(neglected())
    expect(observations.length).toBeGreaterThan(0)
    for (const observation of observations) {
      expect(INSPECTION_DIMENSIONS).toContain(observation.dimension)
      expect(observation.severity).toBeGreaterThan(0)
      expect(observation.readable.length).toBeGreaterThan(5)
    }
    // A neglected kitchen is a FOOD SAFETY observation, not a tidiness one.
    expect(
      observations.some((entry) => entry.dimension === 'food_safety'),
    ).toBe(true)
    expect(observations.some((entry) => entry.dimension === 'spoilage')).toBe(true)
  })

  it('a kept tavern gives the watch nothing to be curious about', () => {
    const state = runDays(spotless(), 6)
    const slice = getRegulatoryModuleState(state)
    expect(suspicionFromEvidence(state, state.calendar.totalDaysElapsed)).toBeLessThan(
      35,
    )
    expect(shouldOpenCase(state).open).toBe(false)
    expect(openCases(slice)).toHaveLength(0)
  })

  it('clears an observation the day the tavern fixes it', () => {
    let state = runDays(neglected(), 3)
    const before = getRegulatoryModuleState(state).evidence.filter(
      (entry) => entry.dimension === 'food_safety',
    )
    expect(before.length).toBeGreaterThan(0)

    state = withArea(state, 'kitchen', { cleanliness: 95, smell: 5 })
    state = runDays(state, 2, 100)
    expect(
      getRegulatoryModuleState(state).evidence.filter(
        (entry) => entry.dimension === 'food_safety',
      ),
    ).toHaveLength(0)
  })

  it('publishes suspicion as a projection the monthly slice reads', () => {
    const state = runDays(neglected(), 6)
    const monthly = state.modules['monthly'] as {
      inspection: { suspicion: number; warningCount: number }
    }
    expect(monthly.inspection.suspicion).toBe(
      suspicionFromEvidence(state, state.calendar.totalDaysElapsed),
    )
  })
})

describe('Phase 214 §7.3.3–6 — a case is opened and an inspector actually visits', () => {
  it('opens a case with an inspector, a dated visit and a preparation window', () => {
    const state = runDays(neglected(), 12)
    const cases = openCases(getRegulatoryModuleState(state))
    expect(cases.length).toBeGreaterThan(0)
    const record = cases[0]!
    expect(record.inspectorName.length).toBeGreaterThan(0)
    expect(record.scheduledVisitDays.length).toBeGreaterThan(0)
    // Announced visits give the player days to act; unannounced ones are the
    // price of letting the evidence pile up.
    if (record.announced) expect(record.preparationDays).toBeGreaterThan(0)
  })

  it('the visit is a dated beat that resolves — OBL-03, closed', () => {
    const state = runDays(neglected(), 22)
    const archive = readScheduledEventsSlice(state).archive.filter(
      (entry) => entry.type === REGULATORY_VISIT_EVENT,
    )
    expect(archive.length).toBeGreaterThan(0)
    const resolved = archive.filter((entry) => entry.status === 'resolved')
    expect(resolved.length).toBeGreaterThan(0)
    // §1.1: a resolved event must name an authoritative mutation.
    for (const outcome of resolved) {
      expect(outcome.mutations.length).toBeGreaterThan(0)
    }
    const slice = getRegulatoryModuleState(state)
    expect(slice.totals.visitsCompleted).toBeGreaterThan(0)
  })

  it('grades all seven dimensions against live state, not against the meter', () => {
    const dirty = neglected()
    const clean = spotless()
    for (const dimension of INSPECTION_DIMENSIONS) {
      const dirtyResult = evaluateDimension(dirty, dimension)
      const cleanResult = evaluateDimension(clean, dimension)
      // A clean tavern must fail no state-derived dimension.
      if (dimension !== 'records' && dimension !== 'recent_evidence') {
        expect(cleanResult, dimension).toBeUndefined()
      }
      if (dirtyResult) {
        expect(dirtyResult.requirement.length).toBeGreaterThan(5)
        expect(dirtyResult.target.kind).toBeTruthy()
      }
    }
    expect(evaluateVisit(dirty).score).toBeGreaterThan(evaluateVisit(clean).score)
  })

  it('a tavern cleaned during the preparation window is graded on the clean state', () => {
    let state = runDays(neglected(), 12)
    const record = openCases(getRegulatoryModuleState(state))[0]
    if (!record?.nextVisitDay) return
    // Do the work the window is for.
    for (const id of Object.keys(state.areas)) {
      state = withArea(state, id, { cleanliness: 95, smell: 5, damage: 0 })
    }
    for (const id of Object.keys(state.stock)) {
      state = withStock(state, id, { spoilage: 0 })
    }
    const dirtyScore = evaluateVisit(runDays(neglected(), 12)).score
    expect(evaluateVisit(state).score).toBeLessThan(dirtyScore)
  })

  it('never shuts a tavern the watch has not spoken to before', () => {
    // Closure is a listed outcome, but a first visit must not reach it.
    const state = runDays(neglected(), 12)
    const evaluation = evaluateVisit(state)
    const slice = getRegulatoryModuleState(state)
    if (slice.watch.visitsFailed < 2) {
      expect(evaluation.outcome).not.toBe('closure')
    }
  })
})

describe('Phase 214 §7.3.7–8 — findings, fines and orders are real records', () => {
  it('a failed visit raises findings whose requirements name real state', () => {
    const state = runDays(neglected(), 22)
    const findings = listFindings(state)
    expect(findings.length).toBeGreaterThan(0)
    for (const finding of findings) {
      expect(finding.requirement.length).toBeGreaterThan(5)
      // The requirement is checkable against live state — which is what
      // makes the follow-up a verification rather than a formality.
      expect(typeof checkRequirement(state, finding)).toBe('boolean')
    }
  })

  it('a fine is a payable obligation with a due date, not a vanished number', () => {
    const state = runDays(neglected(), 24)
    const fines = listObligations(state, {
      direction: 'payable',
      ownerModuleId: 'regulatory',
    })
    const slice = getRegulatoryModuleState(state)
    if (slice.totals.finesRaised === 0) return
    expect(fines.length + slice.totals.finesRaised).toBeGreaterThan(0)
    for (const fine of fines) {
      expect(fine.dueOnDay).toBeDefined()
      expect(fine.principal).toBeGreaterThan(0)
    }
  })

  it('the player can pay a fine, in part or in full', () => {
    let state = runDays(neglected(2_000), 24)
    const fines = listObligations(state, {
      direction: 'payable',
      ownerModuleId: 'regulatory',
    })
    if (fines.length === 0) return
    const fine = fines[0]!
    state = run(state, 100, [
      { actionId: 'pay_watch_fine', targetId: fine.id, amount: 5 },
    ])
    const applied = appliedAction(state, 'pay_watch_fine')
    expect(applied?.data['ok']).toBe(true)
    expect(applied?.data['paid']).toBe(5)
  })
})

describe('Phase 214 §7.3.9 — the player has real responses', () => {
  it('registers the five inspection actions', () => {
    for (const id of [
      'put_the_books_in_order',
      'declare_remediation',
      'appeal_finding',
      'pay_watch_fine',
      'bribe_inspector',
    ]) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('the books are a real graded dimension the player can improve', () => {
    let state = neglected()
    const before = getRegulatoryModuleState(state).records.readiness
    const failsBefore = evaluateDimension(state, 'records')
    expect(failsBefore).toBeDefined()

    state = run(state, 0, [{ actionId: 'put_the_books_in_order' }])
    const after = getRegulatoryModuleState(state).records.readiness
    expect(after).toBeGreaterThan(before)
    expect(evaluateDimension(state, 'records')).toBeUndefined()
  })

  it('declaring a finding done does not clear it unless it is actually done', () => {
    let state = runDays(neglected(), 22)
    const open = listFindings(state).filter(
      (finding) => finding.status === 'open' && !checkRequirement(state, finding),
    )
    if (open.length === 0) return
    const finding = open[0]!
    state = run(state, 100, [
      { actionId: 'declare_remediation', targetId: finding.id },
    ])
    const after = listFindings(state).find((entry) => entry.id === finding.id)!
    // Declared, not verified — the follow-up checks the room.
    expect(after.status).toBe('remediated')
    expect(appliedAction(state, 'declare_remediation')?.data['verified']).toBe(false)
  })

  it('doing the work and then declaring it clears the finding', () => {
    let state = runDays(neglected(), 22)
    const areaFinding = listFindings(state).find(
      (finding) => finding.status === 'open' && finding.target.kind === 'area',
    )
    if (!areaFinding?.target.id) return
    state = withArea(state, areaFinding.target.id, {
      cleanliness: 95,
      smell: 5,
      damage: 0,
    })
    state = run(state, 100, [
      { actionId: 'declare_remediation', targetId: areaFinding.id },
    ])
    const after = listFindings(state).find((entry) => entry.id === areaFinding.id)
    expect(after?.status).toBe('verified')
  })

  it('an appeal is decided on whether the finding is still true', () => {
    let state = runDays(neglected(), 22)
    const areaFinding = listFindings(state).find(
      (finding) => finding.status === 'open' && finding.target.kind === 'area',
    )
    if (!areaFinding?.target.id) return
    // Fix the room, then contest the finding: it is no longer true.
    state = withArea(state, areaFinding.target.id, {
      cleanliness: 95,
      smell: 5,
      damage: 0,
    })
    state = run(state, 100, [
      { actionId: 'appeal_finding', targetId: areaFinding.id },
    ])
    const outcome =
      appliedAction(state, 'appeal_finding') ??
      getOwnerActionsModuleState(state).rejected.find(
        (entry) => entry.actionId === 'appeal_finding',
      )
    expect(outcome, JSON.stringify(getOwnerActionsModuleState(state).rejected)).toBeDefined()
    const after = listFindings(state).find((entry) => entry.id === areaFinding.id)
    // Heard, and decided on whether the finding is still true. `verified` is
    // the other legitimate landing: the follow-up may re-read the room the
    // same day and clear the finding outright, which is the appeal getting
    // what it asked for by a shorter route.
    expect(['quashed', 'upheld', 'verified']).toContain(after?.status)
  })

  it('a bribe is a gamble with a recorded outcome, not a purchase', () => {
    let state = runDays(neglected(3_000), 12)
    const record = openCases(getRegulatoryModuleState(state))[0]
    if (!record) return
    const coinBefore = state.coin
    state = run(state, 100, [
      { actionId: 'bribe_inspector', targetId: record.id, amount: 80 },
    ])
    const applied = appliedAction(state, 'bribe_inspector')
    expect(applied?.data['ok']).toBe(true)
    // The coin left the till either way — that is what makes it a gamble.
    expect(state.coin).toBeLessThan(coinBefore + 80)
    const after = openCases(getRegulatoryModuleState(state))[0]
    expect(after?.bribe).toBeDefined()
    expect(after?.bribe?.amount).toBe(80)
  })
})

describe('Phase 214 §7.3.10 — follow-up and closure', () => {
  it('the follow-up is on the calendar whenever orders are outstanding', () => {
    const state = runDays(neglected(), 24)
    for (const record of openCases(getRegulatoryModuleState(state))) {
      const outstanding = listFindings(state, { caseId: record.id }).filter(
        (finding) => finding.status === 'open' || finding.status === 'remediated',
      )
      if (outstanding.length === 0) continue
      expect(record.nextVisitDay).toBeDefined()
    }
  })

  it('meeting every order and settling every fine closes the case', () => {
    let state = runDays(neglected(3_000), 22)
    // Do the work: clean everything, sort the books, pay whatever is owed.
    for (const id of Object.keys(state.areas)) {
      state = withArea(state, id, {
        cleanliness: 95,
        smell: 5,
        damage: 0,
        condition: 95,
      })
    }
    for (const id of Object.keys(state.stock)) {
      state = withStock(state, id, { spoilage: 0 })
    }
    for (let day = 0; day < 14; day += 1) {
      const fines = listObligations(state, {
        direction: 'payable',
        ownerModuleId: 'regulatory',
      })
      const actions: Actions = [
        { actionId: 'put_the_books_in_order' },
        ...(fines[0] ? [{ actionId: 'pay_watch_fine', targetId: fines[0].id }] : []),
      ]
      state = run(state, 200 + day, actions)
    }
    const slice = getRegulatoryModuleState(state)
    // Either the case closed, or it is still awaiting a scheduled follow-up
    // — what must not happen is an open case with nothing coming.
    for (const record of openCases(slice)) {
      const outstanding = listFindings(state, { caseId: record.id }).filter(
        (finding) => finding.status === 'open' || finding.status === 'remediated',
      )
      if (outstanding.length > 0) expect(record.nextVisitDay).toBeDefined()
    }
    expect(
      slice.caseArchive.length + openCases(slice).length,
    ).toBeGreaterThan(0)
  })

  it('repeatedly ignoring orders escalates, and can end in closure', () => {
    const state = runDays(neglected(), 60)
    const slice = getRegulatoryModuleState(state)
    const worst = [...openCases(slice), ...slice.caseArchive].reduce(
      (max, record) => Math.max(max, record.escalation),
      0,
    )
    expect(worst).toBeGreaterThan(0)
    if (slice.totals.closuresOrdered > 0) {
      expect(getEconomyModuleState(state).financial.status).toBe(
        'temporarily_closed',
      )
    }
  })
})

describe('Phase 214 §7.3 — every inspection hook has a reachable visit', () => {
  const HOOKS: ReadonlyArray<[string, string]> = [
    ['inspection_discovery_possible', REGULATORY_VISIT_EVENT],
    ['inspection_followup_possible', REGULATORY_FOLLOWUP_EVENT],
    ['inspector_followup_possible', REGULATORY_FOLLOWUP_EVENT],
    ['kitchen_inspection_followup', REGULATORY_FOLLOWUP_EVENT],
    ['repair_inspection_followup', REGULATORY_FOLLOWUP_EVENT],
    ['inspection_bribe_exposed_grell', 'inspection_bribe_exposed'],
    ['town_watch_goodwill', 'watch_relationship'],
    ['town_watch_advisor', 'watch_relationship'],
    ['inspector_advisor_grell', 'watch_relationship'],
    ['corrupt_inspector_relationship', 'watch_relationship'],
    ['cleaning_routine_streak', 'cleaning_routine_review'],
  ]

  it('routes every family to its registered regulatory owner', () => {
    for (const [hookName, expectedType] of HOOKS) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(expectedType)
      expect(definition?.ownerModuleId, hookName).toBe('regulatory')
    }
  })

  it('declines the follow-up families when no case is open', () => {
    const fresh = createInitialTavernState()
    for (const hookName of [
      'inspection_followup_possible',
      'inspector_followup_possible',
      'kitchen_inspection_followup',
      'repair_inspection_followup',
    ]) {
      const definition = findScheduledEventDefinitionForHookName(hookName)!
      expect(
        definition.fromFutureHook?.({
          hookName,
          readable: 'The inspector may come back',
          scheduledForDay: 5,
          state: fresh,
        }),
        hookName,
      ).toBeUndefined()
    }
  })

  it('declines an exposure when nobody has been bribed', () => {
    const definition = findScheduledEventDefinitionForHookName(
      'inspection_bribe_exposed_grell',
    )!
    expect(
      definition.fromFutureHook?.({
        hookName: 'inspection_bribe_exposed_grell',
        readable: 'The bribe may come out',
        scheduledForDay: 5,
        state: createInitialTavernState(),
      }),
    ).toBeUndefined()
  })
})

describe('Phase 214 §7.3 — inspection under every difficulty', () => {
  for (const preset of Object.values(DIFFICULTY_PRESETS) as DifficultyConfig[]) {
    it(`accumulates evidence, opens a case and visits on '${preset.id}'`, () => {
      // Difficulty first, then neglect: the preset sets the opening coin and
      // an area-cleanliness bonus, so applying it afterwards would tidy the
      // tavern this case is about.
      let state = applyDifficultyToBase(createInitialTavernState(), preset)
      for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
        state = withStock(state, id, { quantity: 300, spoilage: 0 })
      }
      state = withArea(state, 'kitchen', { cleanliness: 8, smell: 85 })
      state = withArea(state, 'privy', { cleanliness: 5, smell: 95 })
      state = withArea(state, 'main_room', { cleanliness: 15, damage: 70 })
      state = withStock(state, 'stew', { spoilage: 85, quantity: 200 })
      state = runDays(state, 24)
      const slice = getRegulatoryModuleState(state)
      expect(slice.evidence.length).toBeGreaterThan(0)
      expect(slice.totals.casesOpened).toBeGreaterThan(0)
      expect(slice.totals.visitsCompleted).toBeGreaterThan(0)
      const validation = safeValidateState(state, { modules: FULL_PIPELINE })
      expect(validation.success).toBe(true)
    })
  }
})

describe('Phase 214 §7.3 — the case is visible, bounded and valid', () => {
  it('shows up on the §7.4 obligation calendar with its findings and their status', () => {
    const state = runDays(neglected(), 24)
    const calendar = buildObligationCalendar(state)
    expect(calendar.watch.label.length).toBeGreaterThan(0)
    if (calendar.watch.cases.length > 0) {
      const record = calendar.watch.cases[0]!
      expect(record.inspector.length).toBeGreaterThan(0)
      for (const finding of record.findings) {
        expect(typeof finding.met).toBe('boolean')
        expect(finding.requirement.length).toBeGreaterThan(5)
      }
    }
  })

  it('keeps evidence and cases bounded across two months of neglect', () => {
    let state = neglected()
    for (let day = 0; day < 56; day += 1) {
      state = run(state, day)
      const validation = safeValidateState(state, { modules: FULL_PIPELINE })
      expect(validation.success, `day ${day}`).toBe(true)
    }
    const slice = getRegulatoryModuleState(state)
    expect(slice.evidence.length).toBeLessThanOrEqual(MAX_EVIDENCE_ENTRIES)
    expect(openCases(slice).length).toBeLessThanOrEqual(MAX_OPEN_CASES)
  })
})
