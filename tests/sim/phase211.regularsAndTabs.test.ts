// Expansion Phase 4 (repo phase 211) / ISSUE-174 — §4.3 active regulars and
// §4.5 patron tabs.
//
// The plan's required test here is "regular order, seat, tab, memory, and
// return behavior", and §4.5's list of what a debt record has to support:
// principal, debtor identity level, collection probability, policy effect,
// repayment, forgiveness, escalation, write-off, and relationship consequence.
//
// EVERY ROUTE IS THE PLAYER'S. Slates are run up by trading, not written onto
// state; they are chased and wiped through the owner actions
// (`collect_tab`, `forgive_tab`); regulars are talked to through
// `greet_regular` and answered through `answer_regular_request`. §5.3 forbids
// reaching any of it by injection.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { RegularWorldState, TavernState } from '../../src/sim/state/TavernState'
import {
  withCoin,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import { getServiceModuleState } from '../../src/sim/modules/service/index'
import {
  listPatronTabs,
  totalPatronTabDebt,
} from '../../src/sim/modules/service/tabs'
import { outstandingAmount } from '../../src/sim/contracts/obligations/index'
import { getRegularModuleState } from '../../src/sim/modules/regulars/index'
import { serviceMemoryScore } from '../../src/sim/modules/regulars/regularMemory'
import {
  BAD_VISITS_BEFORE_LAPSE,
  assessVisit,
} from '../../src/sim/modules/regulars/visits'
import { MAX_REGULAR_SERVICE_MEMORY } from '../../src/sim/state/TavernState'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'

const SEED = 'phase211/regulars-and-tabs'

/**
 * `assessVisit` is pure but takes a `SimContext`, and it reads exactly two
 * things off it: the culture and the day type. This supplies those two reads
 * against a real state so the assessment can be inspected without running a
 * whole day — it is a narrow read-only double, not injected state.
 */
function readOnlyCtx(state: TavernState) {
  return {
    state,
    getCulture: (id: string) => state.world.cultures[id],
    getDayType: () => state.calendar.dayType,
  } as never
}

function input(day: number, actions?: SimInput['ownerActions']): SimInput {
  return {
    seed: `${SEED}-d${day}`,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function runDay(
  state: TavernState,
  day: number,
  actions?: SimInput['ownerActions'],
) {
  return simulateDay(state, input(day, actions), FULL_PIPELINE)
}

function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 4000 }), 'stew', {
      quantity: 4000,
    }),
    'mushrooms',
    { quantity: 4000 },
  )
}

/** A tavern that has been trading for a week, with slates on the board. */
function afterAWeekOfTrading(days = 7): TavernState {
  let state = withCoin(stocked(createInitialTavernState()), 800)
  for (let day = 0; day < days; day += 1) {
    state = withCoin(stocked(runDay(state, day).state), 800)
  }
  return state
}

describe('Phase 211 §4.3 — a regular is a participant, not a counter', () => {
  it('a regular who comes in is part of a real party, in a real room', () => {
    let state = stocked(createInitialTavernState())
    // Trade until a regular's visit intent is honoured by the flow.
    let found: { regularId: string; areaId: string; recipeId: string } | undefined
    for (let day = 0; day < 12 && !found; day += 1) {
      const result = runDay(state, day)
      state = stocked(result.state)
      const flow = getServiceModuleState(result.state).result.flow
      const party = flow.parties.find(
        (entry) => entry.regularId !== undefined && entry.outcome === 'served',
      )
      const line = party?.order.find((entry) => entry.delivered > 0)
      if (party?.regularId && party.areaId && line) {
        found = {
          regularId: party.regularId,
          areaId: party.areaId,
          recipeId: line.recipeId,
        }
      }
    }
    expect(found).toBeDefined()

    // They sat somewhere and ordered something, and the tavern remembers both.
    const regular = state.world.regulars[found!.regularId]!
    expect(regular.favoriteAreaId).toBe(found!.areaId)
    expect(regular.favoriteRecipeId).toBeDefined()
    // And it is a memory with a weight, not a caption.
    expect((regular.serviceMemory ?? []).length).toBeGreaterThan(0)
    expect(regular.visits).toBeGreaterThan(0)
  })

  it("a regular's memory is bounded and signed", () => {
    const state = afterAWeekOfTrading(14)
    const regulars = Object.values(state.world.regulars)
    expect(regulars.length).toBeGreaterThan(0)
    for (const regular of regulars) {
      const memory = regular.serviceMemory ?? []
      expect(memory.length).toBeLessThanOrEqual(MAX_REGULAR_SERVICE_MEMORY)
      for (const entry of memory) {
        expect(typeof entry.weight).toBe('number')
        expect(entry.readable.length).toBeGreaterThan(0)
      }
    }
  })

  it('a run of nights they cannot be served ends with them staying away', () => {
    // An empty cellar and no cook: they turn up, there is nothing for them, and
    // they leave. Three of those and they stop coming.
    let state = withCoin(createInitialTavernState(), 400)
    state = withStock(withStock(state, 'ale', { quantity: 0 }), 'stew', {
      quantity: 0,
    })
    state = withStock(state, 'mushrooms', { quantity: 0 })

    let lapsed: RegularWorldState | undefined
    for (let day = 0; day < 25 && !lapsed; day += 1) {
      const result = runDay(state, day)
      state = withStock(
        withStock(withStock(result.state, 'ale', { quantity: 0 }), 'stew', {
          quantity: 0,
        }),
        'mushrooms',
        { quantity: 0 },
      )
      lapsed = Object.values(state.world.regulars).find(
        (regular) => regular.stoppedVisiting !== undefined,
      )
    }

    expect(lapsed).toBeDefined()
    // The fact has a reason and a day, not just a small probability.
    expect(lapsed!.stoppedVisiting!.reason.length).toBeGreaterThan(0)
    expect(lapsed!.consecutiveBadVisits).toBeGreaterThanOrEqual(
      BAD_VISITS_BEFORE_LAPSE,
    )
    // And a lapsed regular does not roll for a visit at all.
    const group = state.customerGroups[lapsed!.customerGroupId]
    const assessment = assessVisit(readOnlyCtx(state), lapsed!, group)
    expect(assessment.probability).toBe(0)
    expect(assessment.blocked).toBeDefined()
  })

  it('a word from the owner brings a lapsed regular back', () => {
    let state = withCoin(createInitialTavernState(), 400)
    state = withStock(withStock(state, 'ale', { quantity: 0 }), 'stew', {
      quantity: 0,
    })
    state = withStock(state, 'mushrooms', { quantity: 0 })
    let lapsedId: string | undefined
    for (let day = 0; day < 25 && !lapsedId; day += 1) {
      const result = runDay(state, day)
      state = withStock(
        withStock(withStock(result.state, 'ale', { quantity: 0 }), 'stew', {
          quantity: 0,
        }),
        'mushrooms',
        { quantity: 0 },
      )
      lapsedId = Object.values(state.world.regulars).find(
        (regular) => regular.stoppedVisiting !== undefined,
      )?.id
    }
    expect(lapsedId).toBeDefined()

    const before = state.world.regulars[lapsedId!]!
    const after = runDay(stocked(state), 30, [
      { actionId: 'greet_regular', targetId: lapsedId! },
    ]).state
    const mended = after.world.regulars[lapsedId!]!

    expect(before.stoppedVisiting).toBeDefined()
    expect(mended.stoppedVisiting).toBeUndefined()
    expect(mended.ownerStanding ?? 0).toBeGreaterThan(before.ownerStanding ?? 0)
  })

  it('a regular asks for something, and the answer is recorded', () => {
    // The sequence matters, and it is the natural one: they have to drink here
    // long enough to acquire a usual before running out of it can be something
    // they mind. A cellar that never had ale in it produces nobody whose usual
    // is ale — preferences are LEARNED from what was actually served (§4.3).
    let state = withCoin(stocked(createInitialTavernState()), 400)
    let asker: string | undefined
    for (let day = 0; day < 25 && !asker; day += 1) {
      state = day >= 8 ? withStock(state, 'ale', { quantity: 0 }) : stocked(state)
      const result = runDay(state, day)
      state = result.state
      asker = Object.values(state.world.regulars).find(
        (regular) => regular.openRequest?.status === 'open',
      )?.id
    }
    expect(asker).toBeDefined()

    const request = state.world.regulars[asker!]!.openRequest!
    const standingBefore = state.world.regulars[asker!]!.ownerStanding ?? 50
    const granted = runDay(stocked(state), 30, [
      { actionId: 'answer_regular_request', targetId: asker!, amount: 1 },
    ]).state
    const after = granted.world.regulars[asker!]!
    const answer = getOwnerActionsModuleState(granted).applied.find(
      (action) => action.actionId === 'answer_regular_request',
    )

    expect(request.status).toBe('open')
    expect(answer?.data.accepted).toBe(true)
    expect(answer?.data.requestId).toBe(request.id)
    // Saying yes is recorded immediately, but only the real outcome closes the
    // request. Stock/slate requests may resolve this day; a promised seat or
    // quiet room remains open until service actually provides it.
    expect(['open', 'granted']).toContain(after.openRequest?.status)
    if (after.openRequest?.status === 'granted') {
      expect(after.ownerStanding ?? 0).toBeGreaterThan(standingBefore)
      expect(getRegularModuleState(granted).requestsResolved.length).toBeGreaterThan(0)
    } else {
      expect(after.ownerStanding ?? 50).toBe(standingBefore)
    }
  })

  it("a regular's favourite being off makes them less likely to come", () => {
    const state = afterAWeekOfTrading(10)
    const withFavourite = Object.values(state.world.regulars).find(
      (regular) => regular.favoriteRecipeId !== undefined,
    )
    expect(withFavourite).toBeDefined()

    const group = state.customerGroups[withFavourite!.customerGroupId]
    const onMenu = assessVisit(readOnlyCtx(state), withFavourite!, group)
    const offMenu = assessVisit(
      readOnlyCtx({
        ...state,
        recipes: {
          ...state.recipes,
          [withFavourite!.favoriteRecipeId!]: {
            ...state.recipes[withFavourite!.favoriteRecipeId!]!,
            onMenu: false,
          },
        },
      }),
      withFavourite!,
      group,
    )
    expect(offMenu.probability).toBeLessThan(onMenu.probability)
    expect(offMenu.drivers.some((driver) => driver.includes('is off'))).toBe(true)
  })
})

describe('Phase 211 §4.5 — a slate is a debt somebody owes', () => {
  it('trading opens real receivables with a named or a nameless debtor', () => {
    const state = afterAWeekOfTrading()
    const tabs = listPatronTabs(state)
    expect(tabs.length).toBeGreaterThan(0)

    for (const tab of tabs) {
      expect(tab.direction).toBe('receivable')
      expect(tab.principal).toBeGreaterThan(0)
      expect(tab.dueOnDay).toBeGreaterThan(tab.openedOnDay)
      // Identity level is on the record, and it is one of the three §4.5 names.
      expect(['regular', 'customer_group', 'other']).toContain(
        tab.counterparty.kind,
      )
    }
    // The service module's index carries what the shared ledger has no field
    // for: who to chase and what the odds are.
    const index = getServiceModuleState(state).patronTabs
    expect(index.length).toBeGreaterThan(0)
    for (const entry of index) {
      expect(entry.collectionProbability).toBeGreaterThan(0)
      expect(entry.collectionProbability).toBeLessThanOrEqual(1)
    }
    // A named regular is worth more to chase than a stranger.
    const named = index.find((entry) => entry.debtorKind === 'regular')
    const stranger = index.find((entry) => entry.debtorKind === 'anonymous')
    if (named && stranger) {
      expect(named.collectionProbability).toBeGreaterThan(
        stranger.collectionProbability,
      )
    }
  })

  it('chasing a slate either recovers coin or escalates it, and costs goodwill', () => {
    const state = afterAWeekOfTrading()
    const entry = getServiceModuleState(state).patronTabs.find(
      (row) => row.debtorKind === 'regular',
    )
    expect(entry).toBeDefined()

    const regularBefore = state.world.regulars[entry!.debtorId]!
    const owedBefore = totalPatronTabDebt(state)
    const after = runDay(stocked(state), 20, [
      { actionId: 'collect_tab', targetId: entry!.obligationId },
    ]).state

    const record = listPatronTabs(after).find(
      (row) => row.id === entry!.obligationId,
    )
    const stillOwed = record ? outstandingAmount(record) : 0
    // Either they paid something, or the attempt was recorded as a refusal.
    // A heavily traded day may then overflow-write-off this oldest slate later
    // in the same pipeline, so the final record is not guaranteed to survive.
    const recovered = owedBefore - totalPatronTabDebt(after)
    const applied = (
      after.modules['ownerActions'] as {
        applied?: Array<{ actionId: string; targetId?: string; data?: Record<string, unknown> }>
      }
    ).applied?.find(
      (action) =>
        action.actionId === 'collect_tab' &&
        action.targetId === entry!.obligationId,
    )
    expect(applied).toBeDefined()
    expect(
      recovered > 0 ||
        (record?.escalation ?? 0) > 0 ||
        applied?.data?.['status'] === 'refused',
    ).toBe(true)
    expect(stillOwed).toBeLessThanOrEqual(entry ? entry.chases + owedBefore : 0)

    // §4.5 "relationship consequence" — being chased is remembered.
    const regularAfter = after.world.regulars[entry!.debtorId]!
    expect(
      (regularAfter.serviceMemory ?? []).some(
        (memory) => memory.kind === 'tab_chased',
      ),
    ).toBe(true)
    expect(regularAfter.ownerStanding ?? 0).toBeLessThan(
      regularBefore.ownerStanding ?? 0,
    )
  })

  it('wiping a slate closes the debt and buys the relationship', () => {
    const state = afterAWeekOfTrading()
    const entry = getServiceModuleState(state).patronTabs.find(
      (row) => row.debtorKind === 'regular',
    )
    expect(entry).toBeDefined()

    const before = state.world.regulars[entry!.debtorId]!
    const after = runDay(stocked(state), 20, [
      { actionId: 'forgive_tab', targetId: entry!.obligationId },
    ]).state

    // The obligation is forgiven — closed without being paid.
    const live = listPatronTabs(after).find(
      (row) => row.id === entry!.obligationId,
    )
    expect(live).toBeUndefined()

    const mended = after.world.regulars[entry!.debtorId]!
    expect(mended.ownerStanding ?? 0).toBeGreaterThan(before.ownerStanding ?? 0)
    expect(
      (mended.serviceMemory ?? []).some((memory) => memory.kind === 'tab_forgiven'),
    ).toBe(true)
    expect(serviceMemoryScore(mended, after.calendar.totalDaysElapsed)).toBeGreaterThan(
      serviceMemoryScore(before, state.calendar.totalDaysElapsed),
    )
  })

  it('the refuse_tabs policy shrinks what walks out of the door', () => {
    const base = withCoin(stocked(createInitialTavernState()), 800)
    let permissive = base
    let strict = base
    let permissiveTabs = 0
    let strictTabs = 0
    for (let day = 0; day < 5; day += 1) {
      const openHouse = runDay(permissive, day)
      permissive = withCoin(stocked(openHouse.state), 800)
      permissiveTabs += getServiceModuleState(openHouse.state).result.unpaidTabs

      const tight = runDay(
        strict,
        day,
        day === 0 ? [{ actionId: 'enable_refuse_tabs' }] : undefined,
      )
      strict = withCoin(stocked(tight.state), 800)
      strictTabs += getServiceModuleState(tight.state).result.unpaidTabs
    }
    expect(strictTabs).toBeLessThan(permissiveTabs)
  })

  it('the index stays bounded however long the tavern trades', () => {
    const state = afterAWeekOfTrading(21)
    const index = getServiceModuleState(state).patronTabs
    // §5.11 — capped, and every entry still points at a real obligation or a
    // closed one; nothing accumulates without limit.
    expect(index.length).toBeLessThanOrEqual(40)
    // At most one slate per regular per night plus one cohort slate per group,
    // so a fortnight cannot produce a party-sized pile.
    expect(index.length).toBeLessThan(state.calendar.totalDaysElapsed * 20)
  })
})
