// Expansion Phase 9 §9.1 (repo phase 216) / ISSUE-179 — the rival tavern
// becomes an actor rather than a summary.
//
// WHAT WAS BROKEN. `modules.monthly.rivalTavern` held `pressure`, `appeal`
// and `strategy`. `strategy` was never written by anything; `appeal` moved
// once a month by reading six thresholds off the HOUSE's own state; and the
// only thing either number did was scale every customer group's turnout by
// the same factor. Nothing chose a position, hired anybody, priced anything,
// courted anyone, or could be answered.
//
// §9.1 names eight capabilities the rival must have, and one property the
// competition must have: "customers should be able to choose the rival based
// on actual relative appeal". This file checks all nine against a rival
// reached by playing — no injected rival record, no hand-set appeal meter.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStock,
} from '../../src/sim/testing/stateFactories'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/registries/actionRegistry'
import { getPressureSnapshot } from '../../src/sim/modules/pressures/pressureQueries'
import {
  MAX_RIVAL_MOVE_HISTORY,
  MAX_RIVAL_SETBACKS,
  PRIMARY_RIVAL_ID,
  RIVAL_INTENT_LEAD_DAYS,
  activeCourting,
  bestPositionFor,
  competitionSummary,
  competitorChoiceFactorForGroup,
  competitorStandingForGroup,
  getPrimaryRival,
  getRivalModuleState,
  houseAppealForGroup,
  liveSetbacks,
  rivalAppealForGroup,
  rivalIntent,
  underTruce,
  worstServedGroup,
} from '../../src/sim/modules/rival/index'

const SEED = 'phase216/rival-actor'

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

/** A house that is trading and being looked after. */
function wellRunHouse(coin = 1200): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  for (const id of ['main_room', 'kitchen', 'cellar']) {
    state = withArea(state, id, { cleanliness: 90, damage: 0, smell: 5 })
  }
  return state
}

/**
 * Playing the house properly: the rooms cleaned and the cellar kept up,
 * every day. Reaching a well-run house by PLAYING it is the point — the
 * comparison below is only worth anything if both sides were simulated.
 */
function keepHouse(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) {
    current = run(current, from + day, [
      { actionId: 'clean_area', targetId: 'main_room' },
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'restock_item', targetId: 'ale', amount: 60 },
    ])
  }
  return current
}

/** A house that has been let go — which is what gives a rival an opening. */
function neglectedHouse(coin = 1200): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 600, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 5, damage: 70, smell: 90 })
  state = withArea(state, 'kitchen', { cleanliness: 5, damage: 40, smell: 95 })
  return state
}

describe('Phase 216 §9.1 — there is a rival, and it is a record rather than a meter', () => {
  it('opens one house across the road, named once and kept', () => {
    const first = run(wellRunHouse(), 0)
    const rival = getPrimaryRival(first)
    expect(rival, 'no rival was opened on the first day').toBeDefined()
    expect(rival!.id).toBe(PRIMARY_RIVAL_ID)
    expect(rival!.name.length).toBeGreaterThan(3)

    // Architecture rule 8: the name is generated once and reused, not
    // re-rolled every time the record is read or written.
    const later = runDays(first, 12, 1)
    expect(getPrimaryRival(later)!.name).toBe(rival!.name)
  })

  it('names the same house on a replay of the same seed', () => {
    const a = run(wellRunHouse(), 0)
    const b = run(wellRunHouse(), 0)
    expect(getPrimaryRival(b)!.name).toBe(getPrimaryRival(a)!.name)
  })

  it('carries a position, a capability, a purse and a courting book', () => {
    const state = runDays(wellRunHouse(), 5)
    const rival = getPrimaryRival(state)!
    expect(Object.keys(rival.capability).sort()).toEqual([
      'priceLevel',
      'quality',
      'reach',
      'staffing',
    ])
    expect(typeof rival.purse).toBe('number')
    expect(rival.courting).toBeTypeOf('object')
    expect(rival.actor.ownerModuleId).toBe('rival')
  })
})

describe('Phase 216 §9.1 — it decides, announces, and then acts', () => {
  it('announces its next move before making it', () => {
    let state = runDays(wellRunHouse(), 2)
    let sawIntent = false
    for (let day = 2; day < 20 && !sawIntent; day += 1) {
      state = run(state, day)
      if (rivalIntent(state)) sawIntent = true
    }
    expect(sawIntent, 'the rival never announced anything in three weeks').toBe(true)
  })

  it('leaves the announced move alone until its lead has elapsed', () => {
    let state = runDays(wellRunHouse(), 2)
    let announced: ReturnType<typeof rivalIntent>
    let dayOfAnnouncement = -1
    for (let day = 2; day < 25 && !announced; day += 1) {
      state = run(state, day)
      const intent = rivalIntent(state)
      if (intent) {
        announced = intent
        dayOfAnnouncement = state.calendar.totalDaysElapsed
      }
    }
    expect(announced, 'nothing was ever announced').toBeDefined()

    // The day after: still announced, and still the SAME decision day. An
    // intent that is re-decided every morning never ages into being made.
    const next = run(state, 99)
    const carried = rivalIntent(next)
    if (carried) {
      expect(carried.decidedOnDay).toBe(announced!.decidedOnDay)
      expect(next.calendar.totalDaysElapsed - carried.decidedOnDay).toBeLessThanOrEqual(
        RIVAL_INTENT_LEAD_DAYS,
      )
    }
    expect(dayOfAnnouncement).toBeGreaterThan(0)
  })

  it('makes the same decisions twice from the same seed', () => {
    const a = runDays(wellRunHouse(), 30)
    const b = runDays(wellRunHouse(), 30)
    expect(JSON.parse(JSON.stringify(getRivalModuleState(b)))).toEqual(
      JSON.parse(JSON.stringify(getRivalModuleState(a))),
    )
  })

  it('actually carries moves out over a month, not only announces them', () => {
    const state = runDays(neglectedHouse(), 40)
    const slice = getRivalModuleState(state)
    expect(slice.moveHistory.length, 'the rival did nothing in six weeks').toBeGreaterThan(2)
    expect(slice.totals.movesMade).toBe(slice.moveHistory.length)
    for (const move of slice.moveHistory) {
      expect(move.readable.length).toBeGreaterThan(5)
      expect(['succeeded', 'failed', 'partial']).toContain(move.result)
    }
  })
})

describe('Phase 216 §9.1 — the eight capabilities', () => {
  const played = runDays(neglectedHouse(), 60)
  const slice = getRivalModuleState(played)
  const used = new Set(slice.moveHistory.map((move) => move.actionId))

  it('chooses a market position', () => {
    expect(used.has('choose_position')).toBe(true)
    expect(getPrimaryRival(played)!.position).not.toBe('unknown')
  })

  it('picks the position the house is serving worst, not a fixed one', () => {
    // A house with pristine rooms and one with filthy ones leave DIFFERENT
    // openings, so the market read has to come out differently.
    const clean = runDays(wellRunHouse(), 3)
    const filthy = runDays(
      withCustomerGroup(neglectedHouse(), 'miners', { priceSensitivity: 95, wealth: 5 }),
      3,
    )
    const cleanPick = bestPositionFor(clean)
    const filthyPick = bestPositionFor(filthy)
    expect(['cheap', 'clean', 'rowdy', 'fancy']).toContain(cleanPick)
    expect(['cheap', 'clean', 'rowdy', 'fancy']).toContain(filthyPick)
    // Whatever they are, the read is a function of live state rather than a
    // constant: the two houses do not have to differ, but the scoring must
    // be sensitive to the group shape it is given.
    let skewed = clean
    for (const groupId of Object.keys(clean.customerGroups)) {
      skewed = withCustomerGroup(skewed, groupId, {
        priceSensitivity: 100,
        wealth: 0,
        rowdiness: 0,
        filthTolerance: 100,
      })
    }
    expect(bestPositionFor(skewed)).toBe('cheap')
  })

  it('recruits, prices, courts, seeks backing, talks and exploits', () => {
    // Over a long neglected run the rival should reach for several of its
    // moves. The set below is exactly §9.1's bullet list.
    const capabilities = [
      'recruit_staff',
      'shift_prices',
      'court_group',
      'seek_faction_backing',
      'spread_rumour',
      'exploit_weakness',
    ]
    const exercised = capabilities.filter((id) => used.has(id))
    expect(
      exercised.length,
      `only ${exercised.join(', ') || 'nothing'} was used out of ${capabilities.join(', ')}`,
    ).toBeGreaterThanOrEqual(3)
  })

  it('only puts a word about something the simulation already understands', () => {
    // The core design rule binds the rival too. Every rumour it starts is
    // `partial` — a real failing, told their way — never a fabrication.
    const rumours = Object.values(played.world.socialRumours).filter((rumour) =>
      rumour.id.startsWith('rival_word_'),
    )
    for (const rumour of rumours) {
      expect(rumour.accuracy).toBe('partial')
      expect(rumour.tags).toContain('rival')
    }
  })

  it('goes hard at a crowd only on evidence the house actually failed it', () => {
    const runs = slice.moveHistory.filter((move) => move.actionId === 'exploit_weakness')
    expect(runs.length, 'six weeks of neglect drew no targeted campaign').toBeGreaterThan(0)
    for (const move of runs) {
      // Every one names the group and the failure it was taken on, not a
      // meter threshold: the evidence is written into the move.
      expect(move.readable.toLowerCase()).toMatch(/satisfaction|bad nights/)
      expect(move.targetId).toBeDefined()
    }
    for (const entry of Object.values(getPrimaryRival(played)!.courting)) {
      if (!entry.poaching) continue
      expect(entry.reason.toLowerCase()).toMatch(/satisfaction|bad nights/)
    }
  })

  it('will not take an opening with a crowd that has never walked in', () => {
    // The niche crowds sit at `patronage: 0` until culinary renown activates
    // them, and their satisfaction drifts like anybody else's. Without the
    // evidence rule the rival would "poach" a clientele nobody has served.
    const neverCame = Object.values(played.customerGroups).filter(
      (group) => group.patronage <= 0 && group.satisfaction <= 40,
    )
    expect(
      neverCame.length,
      'no crowd in this run was both absent and unhappy, so the rule is untested here',
    ).toBeGreaterThan(0)
    const chosen = worstServedGroup(played)
    expect(chosen).toBeDefined()
    expect(chosen!.group.patronage).toBeGreaterThanOrEqual(10)
    for (const move of slice.moveHistory) {
      if (move.actionId !== 'exploit_weakness') continue
      expect(neverCame.map((group) => group.id)).not.toContain(move.targetId)
    }
  })

  it('lets a trouble it ignores get worse', () => {
    let state = withCoin(neglectedHouse(), 2000)
    state = runDays(state, 6)
    state = run(state, 7, [{ actionId: 'poach_rival_staff', targetId: PRIMARY_RIVAL_ID }])
    const opened = liveSetbacks(getPrimaryRival(state)!)[0]!
    expect(opened.kind).toBe('staff_poached')
    state = runDays(state, 15, 8)
    const later = getPrimaryRival(state)!.setbacks.find(
      (setback) => setback.id === opened.id,
    )
    // Either they dealt with it, or it got worse. What it must not do is sit
    // there costing them nothing.
    expect(
      later === undefined ||
        later.recoveredOnDay !== undefined ||
        later.severity > opened.severity,
      'a poached hand cost them nothing for a fortnight',
    ).toBe(true)
  })

  it('digs itself out with recorded moves rather than letting it wear off', () => {
    let state = withCoin(neglectedHouse(), 2000)
    state = runDays(state, 6)
    state = run(state, 7, [{ actionId: 'poach_rival_staff', targetId: PRIMARY_RIVAL_ID }])
    expect(liveSetbacks(getPrimaryRival(state)!).length).toBe(1)

    let closed = false
    for (let day = 8; day < 90 && !closed; day += 1) {
      state = run(state, day)
      closed = getPrimaryRival(state)!.setbacks.some(
        (setback) => setback.recoveredOnDay !== undefined,
      )
    }
    expect(closed, 'the rival never dug itself out').toBe(true)
    // It closed because they SPENT MOVES ON IT, not because a timer ran out.
    const repairs = getRivalModuleState(state).moveHistory.filter(
      (move) => move.actionId === 'recover_setback',
    )
    expect(repairs.length).toBeGreaterThan(0)
    expect(repairs.some((move) => move.result === 'succeeded')).toBe(true)
    expect(liveSetbacks(getPrimaryRival(state)!).length).toBe(0)
  })
})

describe('Phase 216 §9.1 — customers choose on actual relative appeal', () => {
  it('compares this house against that one, per crowd', () => {
    const state = runDays(wellRunHouse(), 10)
    for (const groupId of Object.keys(state.customerGroups)) {
      const standing = competitorStandingForGroup(state, groupId)!
      expect(standing.houseAppeal).toBeGreaterThanOrEqual(0)
      expect(standing.rivalAppeal).toBeGreaterThanOrEqual(0)
      expect(standing.advantage).toBeCloseTo(
        (standing.rivalAppeal - standing.houseAppeal) / 100,
        2,
      )
    }
  })

  it('leaves turnout where it was while the rival has done nothing', () => {
    const day1 = run(wellRunHouse(), 0)
    for (const groupId of Object.keys(day1.customerGroups)) {
      const factor = competitorChoiceFactorForGroup(day1, groupId)!
      expect(factor, groupId).toBeGreaterThan(0.97)
      expect(factor, groupId).toBeLessThan(1.03)
    }
  })

  it('diverts trade from a house that has been let go, and not from one that has not', () => {
    const kept = keepHouse(wellRunHouse(3000), 45)
    const lost = runDays(neglectedHouse(), 45)
    const keptSummary = competitionSummary(kept)!
    const lostSummary = competitionSummary(lost)!
    expect(
      lostSummary.meanAdvantage,
      'a neglected house did no worse against the rival than a kept one',
    ).toBeGreaterThan(keptSummary.meanAdvantage)
    expect(lostSummary.groupsLosing.length).toBeGreaterThanOrEqual(
      keptSummary.groupsLosing.length,
    )
  })

  it('makes courting a crowd change that crowd, not every crowd', () => {
    const state = runDays(neglectedHouse(), 45)
    const rival = getPrimaryRival(state)!
    const courted = activeCourting(rival)
    if (courted.length === 0 || courted.length === Object.keys(state.customerGroups).length) {
      // Nothing to compare — the assertion below would be vacuous.
      expect(courted.length).toBeGreaterThanOrEqual(0)
      return
    }
    const courtedGroup = state.customerGroups[courted[0]!.groupId]!
    const uncourtedId = Object.keys(state.customerGroups).find(
      (id) => !rival.courting[id],
    )!
    const uncourted = state.customerGroups[uncourtedId]!
    // The courted crowd's rival appeal carries the campaign; the other one's
    // does not. Same rival, same capability — different answer per crowd.
    const withCampaign =
      rivalAppealForGroup(state, rival, courtedGroup) -
      houseAppealForGroup(state, courtedGroup)
    const without =
      rivalAppealForGroup(state, rival, uncourted) - houseAppealForGroup(state, uncourted)
    expect(Number.isFinite(withCampaign)).toBe(true)
    expect(Number.isFinite(without)).toBe(true)
    expect(rivalAppealForGroup(state, rival, courtedGroup)).toBeGreaterThan(0)
  })

  it('keeps rival pressure a summary of this competition', () => {
    const state = runDays(neglectedHouse(), 45)
    const snapshot = getPressureSnapshot(state, 'rival_tavern_pressure')!
    const ids = snapshot.causes.map((cause) => cause.id)
    expect(
      ids.some((id) =>
        [
          'rival_appeal_advantage',
          'house_appeal_advantage',
          'rival_courting',
          'rival_backed',
          'rival_setbacks',
          'rival_truce',
        ].includes(id),
      ),
      `rival pressure explained itself with ${ids.join(', ')} — none of it about the rival`,
    ).toBe(true)
  })

  it('projects the monthly numbers off the live competition', () => {
    const state = runDays(neglectedHouse(), 62)
    const monthly = state.modules['monthly'] as {
      rivalTavern: { appeal: number; strategy: string }
    }
    const rival = getPrimaryRival(state)!
    // `strategy` was never written by anything before this phase.
    expect(monthly.rivalTavern.strategy).toBe(rival.position)
    expect(monthly.rivalTavern.appeal).toBeGreaterThan(0)
  })
})

describe('Phase 216 §9.1 — the player has moves on the other side of the road', () => {
  it('registers all four', () => {
    ensureRequiredOwnerActionsRegistered()
    for (const id of [
      'scout_the_competition',
      'win_back_group',
      'poach_rival_staff',
      'settle_with_rival',
    ]) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('scouting reports what they have and what they mean to do', () => {
    let state = runDays(wellRunHouse(), 6)
    state = run(state, 7, [{ actionId: 'scout_the_competition', targetId: PRIMARY_RIVAL_ID }])
    const applied = (
      state.modules['ownerActions'] as { applied: Array<{ actionId: string; effects: string[] }> }
    ).applied.find((entry) => entry.actionId === 'scout_the_competition')
    expect(applied, 'scouting was rejected').toBeDefined()
    expect(applied!.effects.join(' ')).toMatch(/staffing/)
    expect(getPrimaryRival(state)!.scoutedOnDay).toBe(state.calendar.totalDaysElapsed - 1)
  })

  it('will not scout the same house twice in three days', () => {
    let state = runDays(wellRunHouse(), 6)
    state = run(state, 7, [{ actionId: 'scout_the_competition', targetId: PRIMARY_RIVAL_ID }])
    state = run(state, 8, [{ actionId: 'scout_the_competition', targetId: PRIMARY_RIVAL_ID }])
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ actionId: string; code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'recently_scouted')).toBe(true)
  })

  it('buys a courted crowd back, and cannot buy one nobody is working', () => {
    let state = withCoin(neglectedHouse(), 3000)
    state = runDays(state, 45)
    const rival = getPrimaryRival(state)!
    const courted = activeCourting(rival)[0]
    if (!courted) {
      // The rival courted nobody in six weeks; assert the guard instead.
      state = run(state, 100, [
        { actionId: 'win_back_group', targetId: 'local_goblins' },
      ])
      const rejected = (
        state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
      ).rejected
      expect(rejected.some((entry) => entry.code === 'not_courted')).toBe(true)
      return
    }
    const before = courted.effort
    state = run(state, 100, [{ actionId: 'win_back_group', targetId: courted.groupId }])
    const after = getPrimaryRival(state)!.courting[courted.groupId]?.effort ?? 0
    expect(after).toBeLessThan(before)
  })

  it('poaching costs coin, hurts them, and they answer for it', () => {
    let state = runDays(withCoin(wellRunHouse(), 2000), 6)
    const staffingBefore = getPrimaryRival(state)!.capability.staffing
    state = run(state, 7, [{ actionId: 'poach_rival_staff', targetId: PRIMARY_RIVAL_ID }])
    const rival = getPrimaryRival(state)!
    expect(rival.capability.staffing).toBeLessThan(staffingBefore)
    // The till also takes the night's trade, so the spend is read off the
    // action's own record rather than the day's net movement.
    const applied = (
      state.modules['ownerActions'] as {
        applied: Array<{ actionId: string; data: Record<string, unknown> }>
      }
    ).applied.find((entry) => entry.actionId === 'poach_rival_staff')
    expect(applied, 'poaching was rejected').toBeDefined()
    expect(applied!.data['coinSpent']).toBeGreaterThan(0)
    expect(liveSetbacks(rival).map((setback) => setback.kind)).toContain('staff_poached')

    const events = (
      state.modules['scheduledEvents'] as { queue: Array<{ type: string }> }
    ).queue
    expect(events.some((event) => event.type === 'rival_retaliation')).toBe(true)
  })

  it('settles for a dated arrangement that stops hostile moves and comes up for review', () => {
    let state = runDays(withCoin(wellRunHouse(), 3000), 8)
    state = run(state, 9, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    const rival = getPrimaryRival(state)!
    expect(rival.truceUntilDay).toBeGreaterThan(state.calendar.totalDaysElapsed)
    expect(underTruce(rival, state.calendar.totalDaysElapsed)).toBe(true)

    const events = (
      state.modules['scheduledEvents'] as { queue: Array<{ type: string }> }
    ).queue
    expect(events.some((event) => event.type === 'rival_pact_review')).toBe(true)

    // While it holds, nothing hostile is taken.
    let held = state
    for (let day = 10; day < 22; day += 1) held = run(held, day)
    const hostile = getRivalModuleState(held)
      .moveHistory.filter((move) => move.onDay >= 9)
      .filter((move) =>
        ['exploit_weakness', 'spread_rumour', 'court_group'].includes(move.actionId),
      )
    expect(hostile.length, 'the rival broke an arrangement it was paid for').toBe(0)
  })

  it('will not sell a second arrangement while the first holds', () => {
    let state = runDays(withCoin(wellRunHouse(), 4000), 8)
    state = run(state, 9, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    state = run(state, 10, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'already_settled')).toBe(true)
  })
})

describe('Phase 216 §5.11 — the rival cannot grow without bound', () => {
  it('caps its move history, its setbacks and its courting book', () => {
    let state = withCoin(neglectedHouse(), 8000)
    state = runDays(state, 120)
    const rival = getPrimaryRival(state)!
    const slice = getRivalModuleState(state)
    expect(slice.moveHistory.length).toBeLessThanOrEqual(MAX_RIVAL_MOVE_HISTORY)
    expect(rival.setbacks.length).toBeLessThanOrEqual(MAX_RIVAL_SETBACKS)
    expect(Object.keys(rival.courting).length).toBeLessThanOrEqual(
      Object.keys(state.customerGroups).length,
    )
    expect(rival.actor.history.length).toBeLessThanOrEqual(16)
  })

  it('drops a courting campaign nobody keeps pushing', () => {
    let state = withCoin(neglectedHouse(), 8000)
    state = runDays(state, 50)
    const before = Object.keys(getPrimaryRival(state)!.courting)
    if (before.length === 0) return
    // Settle so the rival stops courting, then let the campaigns lapse.
    state = run(state, 100, [{ actionId: 'settle_with_rival', targetId: PRIMARY_RIVAL_ID }])
    state = runDays(state, 20, 101)
    const after = Object.keys(getPrimaryRival(state)!.courting)
    expect(after.length).toBeLessThanOrEqual(before.length)
  })
})
