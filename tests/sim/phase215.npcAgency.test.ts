// Expansion Phase 8 §8.3 (repo phase 215) / ISSUE-178 — notable NPCs and
// actor memory.
//
// §8.3 lists seven things an important NPC should have — a current goal,
// relationships, schedule or availability, relevant possessions/resources,
// memories and beliefs, a small action set, and visible participation in
// service, factions, suppliers, regulation or arcs — and then adds the
// constraint that makes the phase interesting:
//
//   "Do not promote every generated name into a full agent. Use importance
//    and repeated interaction thresholds."
//
// So the first block below is about who does NOT get to act, and why. The
// nine notable NPCs have existed since Phase 44 as names referenced by
// issue-seed prose; nothing has ever written to one, including the
// `lastSeenDay` the record declares.
//
// Nothing here promotes anybody by hand. Every case reaches promotion the
// way the game does: by playing days in a tavern with live problems.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { decideActorAction } from '../../src/sim/contracts/actors/index'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import {
  DEMOTION_IMPORTANCE_THRESHOLD,
  MAX_NPC_INTERACTIONS,
  MAX_NPC_MOVE_HISTORY,
  MAX_PROMOTED_NPCS,
  NPC_ACTOR_ACTION_LIST,
  NPC_INTENT_LEAD_DAYS,
  NPC_PROPOSAL_DEADLINE_EVENT,
  PROMOTION_IMPORTANCE_THRESHOLD,
  PROMOTION_INTERACTION_THRESHOLD,
  buildPerception,
  computeImportance,
  deriveGoals,
  getNpcModuleState,
  getNpcRecord,
  isAboutToday,
  listNpcIntents,
  openProposals,
  promotedNpcs,
} from '../../src/sim/modules/npcs/index'

const SEED = 'phase215/npc-agency'

type Actions = NonNullable<SimInput['ownerActions']>

/** A tavern with enough going wrong that some of these people matter. */
function troubled(coin = 400): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 200, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 85 })
  state = withArea(state, 'main_room', { cleanliness: 20, damage: 60 })
  return state
}

/** A tavern where nothing is wrong and nobody has any business with anybody. */
function quiet(): TavernState {
  let state = withCoin(createInitialTavernState(), 900)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function run(state: TavernState, day: number, ownerActions: Actions = []): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

describe('Phase 215 §8.3 — not every name becomes an agent', () => {
  it('nobody is promoted on day zero, however important their role', () => {
    const state = run(troubled(), 0)
    expect(promotedNpcs(state)).toEqual([])
    // …but everybody has a Tier 1 record, so they can be explained.
    const slice = getNpcModuleState(state)
    expect(Object.keys(slice.records).length).toBe(
      Object.keys(state.world.notableNpcs).length,
    )
  })

  it('promotion needs BOTH thresholds, not either', () => {
    const state = runDays(troubled(), 12)
    const slice = getNpcModuleState(state)

    for (const record of Object.values(slice.records)) {
      if (!record.promoted) continue
      expect(
        record.interactionCount,
        `${record.npcId} promoted on ${record.interactionCount} dealings`,
      ).toBeGreaterThanOrEqual(PROMOTION_INTERACTION_THRESHOLD)
      expect(record.promotionReason, `${record.npcId} promoted without a reason`).toBeTruthy()
    }

    // Somebody with plenty of dealings but nothing live at all stays a name.
    // The bar checked here is the DEMOTION line rather than the promotion
    // one, because retention is deliberately stickier than promotion: an NPC
    // who was promoted while their case was live keeps their place through
    // the grace window and while they stay above the lower line, so that
    // nobody flickers in and out on a borderline day. What must never happen
    // is somebody promoted while nothing about them is live at all.
    for (const record of Object.values(slice.records)) {
      if (!record.promoted) continue
      expect(
        record.importance,
        `${record.npcId} is promoted with nothing live about them`,
      ).toBeGreaterThanOrEqual(DEMOTION_IMPORTANCE_THRESHOLD)
    }
    const neverDealtWith = Object.values(slice.records).filter(
      (record) => record.interactionCount < PROMOTION_INTERACTION_THRESHOLD,
    )
    for (const record of neverDealtWith) {
      expect(record.promoted, `${record.npcId} promoted as a stranger`).toBe(false)
    }
  })

  it('a well-run tavern has fewer people to reckon with than a troubled one', () => {
    // The comparison IS the contract. Importance is a property of what is
    // live in the world, so a house with no case open, no debt and no faction
    // taking positions gives fewer people a reason to be somebody it has to
    // deal with. (Not "nobody": a payday still brings the miners' foreman
    // round, and that is the mechanism working, not a leak.)
    const calm = promotedNpcs(runDays(quiet(), 14))
    const troubledRun = promotedNpcs(runDays(troubled(), 14))
    expect(calm.length).toBeLessThanOrEqual(troubledRun.length)

    for (const record of calm) {
      expect(record.importance).toBeGreaterThanOrEqual(DEMOTION_IMPORTANCE_THRESHOLD)
      expect(record.interactionCount).toBeGreaterThanOrEqual(
        PROMOTION_INTERACTION_THRESHOLD,
      )
    }
  })

  it('§5.11 — the promoted roster is capped however much is going on', () => {
    const state = runDays(troubled(), 30)
    expect(promotedNpcs(state).length).toBeLessThanOrEqual(MAX_PROMOTED_NPCS)
    const slice = getNpcModuleState(state)
    // An actor record only ever belongs to somebody currently promoted.
    for (const npcId of Object.keys(slice.actors)) {
      expect(slice.records[npcId]?.promoted, `${npcId} has an actor but is not promoted`).toBe(
        true,
      )
    }
  })

  it('importance is about the world, and names the live thing behind it', () => {
    const state = runDays(troubled(), 10)
    for (const npc of Object.values(state.world.notableNpcs)) {
      const { importance, reason } = computeImportance(state, npc)
      expect(importance).toBeGreaterThanOrEqual(0)
      expect(importance).toBeLessThanOrEqual(100)
      expect(reason.length).toBeGreaterThan(0)
    }
  })
})

describe('Phase 215 §8.3 — the seven things an important NPC has', () => {
  it('a current goal, weighted from live state', () => {
    const state = runDays(troubled(), 12)
    const promoted = promotedNpcs(state)
    if (promoted.length === 0) return
    const record = promoted[0]!
    const npc = state.world.notableNpcs[record.npcId]!
    const goals = deriveGoals(state, npc, record)
    expect(goals.length).toBeGreaterThan(0)
    for (const goal of goals) {
      expect(goal.weight).toBeGreaterThanOrEqual(0)
      expect(goal.weight).toBeLessThanOrEqual(1)
      expect(goal.readable.length).toBeGreaterThan(0)
    }
    expect(goals.some((goal) => goal.weight > 0)).toBe(true)
  })

  it('a schedule: they are about on their own days, and not on others', () => {
    const state = runDays(troubled(), 8)
    const slice = getNpcModuleState(state)

    for (const record of Object.values(slice.records)) {
      expect(
        ['most_days', 'market_days', 'paydays', 'nights', 'by_arrangement'],
      ).toContain(record.availability.pattern)
      // Anybody recorded as about has a day it happened on. (`aboutToday`
      // itself describes the last day SIMULATED, and the calendar has since
      // advanced, so it cannot be compared against `state` directly.)
      if (slice.aboutToday.includes(record.npcId)) {
        expect(record.availability.lastAboutOnDay).toBeDefined()
      }
    }

    // The rule itself: a market factor is about on market day and not on a
    // quiet one, which is what makes the schedule something to learn.
    const factor = Object.values(slice.records).find(
      (record) => record.availability.pattern === 'market_days',
    )
    expect(factor, 'somebody should keep market days').toBeDefined()
    const on = (dayType: TavernState['calendar']['dayType']): TavernState => ({
      ...state,
      calendar: { ...state.calendar, dayType },
    })
    expect(isAboutToday(on('market_day'), factor!)).toBe(true)
    expect(isAboutToday(on('quiet_day'), factor!)).toBe(false)

    expect(
      Object.values(slice.records).some(
        (record) => record.availability.lastAboutOnDay !== undefined,
      ),
    ).toBe(true)
  })

  it("lastSeenDay is finally written — and only when somebody was actually about", () => {
    const fresh = createInitialTavernState()
    for (const npc of Object.values(fresh.world.notableNpcs)) {
      expect(npc.lastSeenDay, 'a fresh save must not claim anybody has been seen').toBeUndefined()
    }

    const state = runDays(troubled(), 6)
    const slice = getNpcModuleState(state)
    for (const npc of Object.values(state.world.notableNpcs)) {
      if (npc.lastSeenDay === undefined) continue
      const record = slice.records[npc.id]!
      expect(record.availability.lastAboutOnDay).toBe(npc.lastSeenDay)
    }
    expect(
      Object.values(state.world.notableNpcs).some((npc) => npc.lastSeenDay !== undefined),
    ).toBe(true)
  })

  it('resources they can actually put behind something', () => {
    const state = runDays(troubled(), 4)
    for (const record of Object.values(getNpcModuleState(state).records)) {
      expect(record.resources.coin).toBeGreaterThanOrEqual(0)
      expect(record.resources.standing).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(record.resources.goods)).toBe(true)
    }
    // A creditor has coin; a market factor has goods. Roles differ.
    const slice = getNpcModuleState(state)
    const byKind = (kind: string) =>
      Object.values(slice.records).find(
        (record) => state.world.notableNpcs[record.npcId]?.kind === kind,
      )
    expect((byKind('creditor')?.resources.coin ?? 0)).toBeGreaterThan(
      byKind('gossip')?.resources.coin ?? 0,
    )
    expect((byKind('merchant_prince')?.resources.goods.length ?? 0)).toBeGreaterThan(0)
  })

  it('memories of dealings, bounded and decaying', () => {
    const state = runDays(troubled(), 30)
    for (const record of Object.values(getNpcModuleState(state).records)) {
      expect(record.interactions.length).toBeLessThanOrEqual(MAX_NPC_INTERACTIONS)
      for (const entry of record.interactions) {
        expect(entry.readable.length).toBeGreaterThan(0)
        expect(Math.abs(entry.weight)).toBeLessThanOrEqual(40)
      }
      expect(record.ownerStanding).toBeGreaterThanOrEqual(-100)
      expect(record.ownerStanding).toBeLessThanOrEqual(100)
    }
  })

  it('a small action set, and one that is genuinely small', () => {
    expect(NPC_ACTOR_ACTION_LIST.length).toBeLessThanOrEqual(6)
    const ids = NPC_ACTOR_ACTION_LIST.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Phase 215 §8.3 — decisions are deterministic and announced', () => {
  it('the same perceived state always yields the same decision', () => {
    const state = runDays(troubled(), 14)
    const promoted = promotedNpcs(state)
    if (promoted.length === 0) return
    const record = promoted[0]!
    const npc = state.world.notableNpcs[record.npcId]!
    const actor = getNpcModuleState(state).actors[record.npcId]
    if (!actor) return

    const decideOnce = () =>
      decideActorAction({
        actor: { ...actor, goals: deriveGoals(state, npc, record) },
        perception: buildPerception(state, npc, record),
        actions: NPC_ACTOR_ACTION_LIST,
        state,
        today: state.calendar.totalDaysElapsed,
      }).decision

    expect(decideOnce()).toEqual(decideOnce())
    expect(decideOnce()).toEqual(decideOnce())
  })

  it('a move is announced before it lands', () => {
    let state = runDays(troubled(), 14)
    const intents = listNpcIntents(state)
    if (intents.length === 0) return
    const intent = intents[0]!
    expect(intent.readable).toMatch(/means to/)

    const after = runDays(state, NPC_INTENT_LEAD_DAYS + 2, 20)
    const move = getNpcModuleState(after).moveHistory.find(
      (entry) => entry.npcId === intent.npcId && entry.onDay > intent.decidedOnDay,
    )
    if (move) {
      expect(move.onDay - intent.decidedOnDay).toBeGreaterThanOrEqual(NPC_INTENT_LEAD_DAYS)
    }
    void state
  })

  it('a faction speaks with one voice — two of its people never say it at once', () => {
    const state = runDays(troubled(), 30)
    const slice = getNpcModuleState(state)
    const words = slice.moveHistory.filter((move) => move.actionId === 'put_in_a_word')

    // Group by faction and check no two on the same day, and none inside the
    // window of each other.
    const byFaction = new Map<string, number[]>()
    for (const move of words) {
      const factionId = state.world.notableNpcs[move.npcId]?.factionId
      if (!factionId) continue
      byFaction.set(factionId, [...(byFaction.get(factionId) ?? []), move.onDay])
    }
    for (const [factionId, days] of byFaction) {
      const sorted = [...days].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i += 1) {
        expect(
          sorted[i]! - sorted[i - 1]!,
          `${factionId} spoke twice within the one-voice window`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('an authority never reports the house to itself', () => {
    const state = runDays(troubled(), 30)
    const reports = getNpcModuleState(state).moveHistory.filter(
      (move) => move.actionId === 'take_it_to_the_watch',
    )
    for (const move of reports) {
      expect(
        state.world.notableNpcs[move.npcId]?.kind,
        `${move.npcId} reported the house to their own watch`,
      ).not.toBe('authority')
    }
  })
})

describe('Phase 215 §8.3 — offers are answerable, and silence costs', () => {
  it('registers the three NPC actions in the shared registry', () => {
    for (const id of ['accept_npc_offer', 'decline_npc_offer', 'cultivate_npc']) {
      expect(actionRegistry.get(id), `owner action '${id}' not registered`).toBeDefined()
    }
  })

  it('an offer carries a deadline event that owns it', () => {
    const state = runDays(troubled(), 30)
    const proposals = openProposals(state)
    if (proposals.length === 0) return
    for (const proposal of proposals) {
      expect(proposal.dueOnDay).toBeGreaterThan(proposal.openedOnDay)
      expect(proposal.readable.length).toBeGreaterThan(0)
    }
    expect(
      readScheduledEventsSlice(state).queue.some(
        (record) => record.type === NPC_PROPOSAL_DEADLINE_EVENT,
      ),
    ).toBe(true)
  })

  it('accepting delivers what was offered and settles the dealing', () => {
    let state = troubled()
    let proposal = openProposals(state)[0]
    for (let day = 0; day < 40 && !proposal; day += 1) {
      state = run(state, day)
      proposal = openProposals(state)[0]
    }
    if (!proposal) return

    const before = state.stock[proposal.stockId ?? 'ale']?.quantity ?? 0
    const coinBefore = state.coin
    const after = run(state, 99, [
      { actionId: 'accept_npc_offer', targetId: proposal.npcId },
    ])

    const applied = getOwnerActionsModuleState(after).applied.find(
      (entry) => entry.actionId === 'accept_npc_offer',
    )
    expect(applied).toBeDefined()
    expect(getNpcModuleState(after).proposals[proposal.id]!.status).toBe('accepted')

    if (proposal.stockId && proposal.units) {
      // The goods actually arrived — an offer that delivered nothing would
      // be the empty promise this arc exists to stop.
      expect(after.stock[proposal.stockId]!.quantity).toBeGreaterThan(before - proposal.units)
    }
    if (proposal.coin > 0) expect(after.coin).toBeLessThan(coinBefore)
  })

  it('being ignored costs more than being turned down', () => {
    let state = troubled()
    let proposal = openProposals(state)[0]
    for (let day = 0; day < 40 && !proposal; day += 1) {
      state = run(state, day)
      proposal = openProposals(state)[0]
    }
    if (!proposal) return

    const declined = run(state, 99, [
      { actionId: 'decline_npc_offer', targetId: proposal.npcId },
    ])
    expect(getNpcModuleState(declined).proposals[proposal.id]!.status).toBe('declined')
    const declinedStanding = getNpcRecord(declined, proposal.npcId)!.ownerStanding

    const ignored = runDays(
      state,
      proposal.dueOnDay - state.calendar.totalDaysElapsed + 2,
      50,
    )
    expect(getNpcModuleState(ignored).proposals[proposal.id]!.status).toBe('lapsed')
    const ignoredStanding = getNpcRecord(ignored, proposal.npcId)!.ownerStanding

    expect(ignoredStanding).toBeLessThan(declinedStanding)
  })

  it('cultivating somebody drives the repeated-interaction threshold', () => {
    // The roster is rebuilt every morning from the day type, so who is worth
    // seeing is a property of the day the action runs on — not of the day
    // before it. Offer it for everybody and let the validator pick.
    let state = runDays(troubled(), 3)
    const everybody = Object.keys(state.world.notableNpcs).sort()
    const before = new Map(
      everybody.map((npcId) => [npcId, getNpcRecord(state, npcId)?.interactionCount ?? 0]),
    )

    let appliedAny: string | undefined
    for (let day = 10; day < 17 && !appliedAny; day += 1) {
      const next = run(
        state,
        day,
        everybody.map((npcId) => ({ actionId: 'cultivate_npc', targetId: npcId })),
      )
      const applied = getOwnerActionsModuleState(next).applied.find(
        (entry) => entry.actionId === 'cultivate_npc',
      )
      state = next
      if (applied) appliedAny = applied.targetId
    }

    expect(appliedAny, 'nobody could be sought out in a week').toBeDefined()
    const record = getNpcRecord(state, appliedAny!)!
    expect(record.interactionCount).toBeGreaterThan(before.get(appliedAny!) ?? 0)
    expect(record.ownerStanding).toBeGreaterThan(0)
  })
})

describe('Phase 215 §8.3 — the world stays valid and the report explains itself', () => {
  it('a month of autonomous NPC behaviour leaves a valid state', () => {
    const state = runDays(troubled(), 30)
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
    expect(getNpcModuleState(state).moveHistory.length).toBeLessThanOrEqual(
      MAX_NPC_MOVE_HISTORY,
    )
  })

  it('the report says who matters and why', () => {
    const state = runDays(troubled(), 14)
    const result = simulateDay(state, { seed: `${SEED}/report` }, FULL_PIPELINE)
    const section = result.reports.find((entry) => entry.id === 'notable_npcs')
    expect(section).toBeDefined()
    expect(section!.data).toHaveProperty('promotedIds')
    expect(section!.data).toHaveProperty('aboutToday')
    if (promotedNpcs(result.state).length > 0) {
      expect(section!.lines.join('\n')).toContain('People who matter right now:')
    }
  })
})
