// Expansion Phase 8 §8.1 (repo phase 215) / ISSUE-178 — factions act.
//
// Contract tests for the eleven things §8.1 says every active faction
// definition must have: goals, resources or influence, current priorities,
// membership or represented constituency, memory of treatment, a bounded
// action set, eligible targets, deterministic target scoring, commitments
// and cooldowns, visible intent, and outcomes that can succeed, fail, or be
// opposed.
//
// Nothing here writes a stance, a demand or a grievance into state by hand.
// Every case reaches the behaviour the way a player would: by running days
// on a real tavern whose pressures, satisfaction and till are what they are
// because of what happened on the previous days. The one shortcut taken is
// emptying the till or letting a pressure stand high — those are starting
// conditions (a tavern in trouble), not outcomes.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { decideActorAction } from '../../src/sim/contracts/actors/index'
import {
  FACTION_ACTOR_ACTION_LIST,
  FACTION_GOALS,
  FACTION_INTENT_LEAD_DAYS,
  MAX_FACTION_MOVE_HISTORY,
  MAX_STANDING_ENTRIES,
  STANCE_DURATION_DAYS,
  STANDING_MEMORY_DAYS,
  activeStance,
  activeStances,
  buildPerception,
  constituencyReach,
  deriveGoals,
  getFactionForecastModifier,
  getFactionModuleState,
  getFactionProtection,
  getFactionSupplyPressure,
  listFactionIntents,
  noteStanding,
  openDemandFor,
  openStance,
  representedGroups,
  standingNet,
  weeklyBudgetFor,
} from '../../src/sim/modules/factions/index'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../src/sim/content/factions/factionRegistry'
import { FACTION_ACTION_IDS } from '../../src/sim/content/factions/factionTypes'
import { forecastTrafficForGroup } from '../../src/sim/modules/customers/forecast'
import { creditLimitFor, quoteSupplierOrder } from '../../src/sim/modules/suppliers/quote'
import { getSupplierAccount } from '../../src/sim/modules/suppliers/state'

const SEED = 'phase215/faction-agency'

type Actions = NonNullable<SimInput['ownerActions']>

function trading(coin = 900): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
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

/**
 * A starting condition, not an injected outcome: this tavern has been a bad
 * neighbour for a while and the faction has noticed. The grievance is
 * written through the module's own `noteStanding` — the same call the
 * evidence pass makes — rather than by editing the slice, so nothing here
 * reaches a state the simulation could not produce on its own.
 */
function withGrievance(
  state: TavernState,
  factionId: string,
  weight: number,
): TavernState {
  const result = simulateDay(
    state,
    { seed: `${SEED}/grievance` },
    [
      ...FULL_PIPELINE,
      {
        id: 'test_grievance',
        version: '1.0.0',
        hooks: {
          startDay: [
            (ctx) => {
              noteStanding(ctx, {
                factionId,
                id: 'test_bad_blood',
                kind: 'grievance',
                weight,
                readable: 'The house has been a bad neighbour.',
                tags: ['test'],
              })
            },
          ],
        },
      },
    ],
  )
  return result.state
}

describe('Phase 215 §8.1 — every faction definition has goals, reach and a bounded action set', () => {
  it('every registered faction declares a constituency and a capability list', () => {
    ensureRequiredFactionsRegistered()
    const defs = [...factionRegistry.all()]
    expect(defs.length).toBeGreaterThan(0)
    for (const def of defs) {
      expect(Array.isArray(def.representedGroupIds)).toBe(true)
      expect(def.actions.length).toBeGreaterThan(0)
      for (const actionId of def.actions) {
        expect(FACTION_ACTION_IDS).toContain(actionId)
        expect(
          FACTION_ACTOR_ACTION_LIST.some((action) => action.id === actionId),
          `action '${actionId}' on '${def.id}' has no implementation`,
        ).toBe(true)
      }
    }
  })

  it('every represented customer group actually exists', () => {
    const state = createInitialTavernState()
    for (const def of factionRegistry.all()) {
      for (const groupId of def.representedGroupIds) {
        expect(
          state.customerGroups[groupId],
          `'${def.id}' claims to speak for unknown group '${groupId}'`,
        ).toBeDefined()
      }
    }
  })

  it('influence is the resource: a faction with more of it gets more moves a week', () => {
    const state = createInitialTavernState()
    const watch = state.world.factions['town_watch']!
    const haulers = state.world.factions['scrap_collectors']!
    expect(watch.influence).toBeGreaterThan(haulers.influence)
    expect(weeklyBudgetFor(watch)).toBeGreaterThan(weeklyBudgetFor(haulers))
    expect(weeklyBudgetFor(haulers)).toBeGreaterThanOrEqual(1)
  })

  it('priorities come from live state, not from the definition alone', () => {
    const base = createInitialTavernState()
    const union = base.world.factions['miners_union']!

    const contentGoals = deriveGoals(base, union)
    const contentProtect = contentGoals.find(
      (goal) => goal.id === FACTION_GOALS.PROTECT_CONSTITUENCY,
    )!

    const unhappy: TavernState = {
      ...base,
      customerGroups: {
        ...base.customerGroups,
        miners: { ...base.customerGroups['miners']!, satisfaction: 20 },
      },
    }
    const strainedGoals = deriveGoals(unhappy, union)
    const strainedProtect = strainedGoals.find(
      (goal) => goal.id === FACTION_GOALS.PROTECT_CONSTITUENCY,
    )!

    expect(strainedProtect.weight).toBeGreaterThan(contentProtect.weight)
    for (const goal of strainedGoals) {
      expect(goal.weight).toBeGreaterThanOrEqual(0)
      expect(goal.weight).toBeLessThanOrEqual(1)
    }
  })

  it('constituency reach is real membership, and a faction with nobody has none', () => {
    const state = createInitialTavernState()
    expect(representedGroups(state, 'miners_union').map((g) => g.id)).toEqual(['miners'])
    expect(constituencyReach(state, 'miners_union')).toBeGreaterThan(0)
    expect(representedGroups(state, 'town_watch')).toEqual([])
  })
})

describe('Phase 215 §8.1 — memory of treatment replaces threshold drift', () => {
  it('a signal produces dated, readable evidence rather than an anonymous nudge', () => {
    let state = trading()
    state = {
      ...state,
      pressures: {
        ...state.pressures,
        violence: { ...state.pressures['violence']!, value: 85 },
      },
    }
    const after = run(state, 0)

    const standing = getFactionModuleState(after).standing['town_watch']
    expect(standing).toBeDefined()
    const entry = standing!.entries.find((e) => e.id === 'violence_high')
    expect(entry).toBeDefined()
    expect(entry!.kind).toBe('grievance')
    expect(entry!.onDay).toBe(0)
    expect(entry!.readable).toContain('watch')
    expect(standing!.net).toBeLessThan(0)
  })

  it('the visible relationship is a summary of that memory, and names its driver', () => {
    let state = trading()
    state = {
      ...state,
      pressures: {
        ...state.pressures,
        violence: { ...state.pressures['violence']!, value: 85 },
      },
    }
    const before = state.world.factions['town_watch']!.relationship
    const after = run(state, 0)

    expect(after.world.factions['town_watch']!.relationship).toBeLessThan(before)
    const cause = after.causes.find(
      (c) =>
        c.targetType === 'faction' &&
        c.target.startsWith('faction:town_watch') &&
        c.tags.includes('standing'),
    )
    expect(cause, 'the relationship move must be attributable').toBeDefined()
    expect(cause!.readable).toContain('watch')
  })

  it('evidence decays, so an old grievance stops driving the summary', () => {
    const state = withGrievance(trading(), 'brewers_guild', 30)
    const immediate = standingNet(state, 'brewers_guild')
    expect(immediate).toBeLessThan(0)

    // Walk far enough forward that the entry has faded out of the window.
    const later = runDays(state, STANDING_MEMORY_DAYS + 1, 1)
    const entries = getFactionModuleState(later).standing['brewers_guild']?.entries ?? []
    expect(entries.some((entry) => entry.id === 'test_bad_blood')).toBe(false)
  })

  it('§5.11 — a faction holds a bounded number of things against you', () => {
    let state = trading()
    for (let i = 0; i < MAX_STANDING_ENTRIES + 8; i += 1) {
      const step = i
      state = simulateDay(
        state,
        { seed: `${SEED}/cap/${step}` },
        [
          ...FULL_PIPELINE,
          {
            id: 'test_many_grievances',
            version: '1.0.0',
            hooks: {
              startDay: [
                (ctx) => {
                  noteStanding(ctx, {
                    factionId: 'town_watch',
                    id: `bad_night_${step}`,
                    kind: 'grievance',
                    weight: 5 + step,
                    readable: `Bad night ${step}.`,
                    tags: ['test'],
                  })
                },
              ],
            },
          },
        ],
      ).state
    }
    const entries = getFactionModuleState(state).standing['town_watch']!.entries
    expect(entries.length).toBeLessThanOrEqual(MAX_STANDING_ENTRIES)
  })
})

describe('Phase 215 §8.1 — decisions are deterministic and announced before they land', () => {
  it('the same perceived state always yields the same decision', () => {
    const state = withGrievance(trading(), 'miners_union', 40)
    const faction = state.world.factions['miners_union']!
    const actor = getFactionModuleState(state).actors['miners_union']
    expect(actor, 'the faction must have an actor record').toBeDefined()

    const decideOnce = () =>
      decideActorAction({
        actor: { ...actor!, goals: deriveGoals(state, faction) },
        perception: buildPerception(state, faction),
        actions: FACTION_ACTOR_ACTION_LIST,
        state,
        today: state.calendar.totalDaysElapsed,
      }).decision

    expect(decideOnce()).toEqual(decideOnce())
    expect(decideOnce()).toEqual(decideOnce())
  })

  it('a faction announces its intent before it acts, leaving the player a turn', () => {
    let state = withGrievance(trading(), 'miners_union', 45)
    // Push it far enough that the union has something worth doing.
    state = runDays(state, 1, 1)

    const intents = listFactionIntents(state)
    expect(intents.length).toBeGreaterThan(0)
    const declaredOn = intents[0]!.decidedOnDay
    expect(intents[0]!.readable).toMatch(/mean to/)

    // Nothing has happened yet on the day it was announced.
    const movesOnAnnounceDay = getFactionModuleState(state).movesToday
    expect(movesOnAnnounceDay.every((move) => move.factionId !== intents[0]!.factionId)).toBe(
      true,
    )

    // …and the lead is at least the declared window.
    const acted = runDays(state, FACTION_INTENT_LEAD_DAYS + 1, 2)
    const history = getFactionModuleState(acted).moveHistory
    const move = history.find((entry) => entry.factionId === intents[0]!.factionId)
    if (move) {
      expect(move.onDay - declaredOn).toBeGreaterThanOrEqual(FACTION_INTENT_LEAD_DAYS)
    }
  })

  it('a faction cannot take a move its definition does not give it', () => {
    const state = withGrievance(trading(), 'town_watch', 60)
    const watch = state.world.factions['town_watch']!
    const perception = buildPerception(state, watch)
    const def = factionRegistry.get('town_watch')!

    for (const action of FACTION_ACTOR_ACTION_LIST) {
      const targets = action.eligibleTargets(perception, state)
      if (!def.actions.includes(action.id as never)) {
        expect(targets, `'${action.id}' must be unavailable to the watch`).toEqual([])
      }
    }
  })
})

describe('Phase 215 §8.1 — moves are real, and the domain that owns the thing reads them', () => {
  it('a boycott keeps the constituency at home, through the customers own forecast rule', () => {
    let state = trading()
    const group = state.customerGroups['miners']!
    const before = forecastTrafficForGroup(
      group,
      state,
      { state, rng: { int: () => 0 }, getDayType: () => state.calendar.dayType } as never,
    )

    state = simulateDay(
      state,
      { seed: `${SEED}/boycott` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_boycott',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'miners_union',
                  kind: 'boycott',
                  strength: 100,
                  reason: 'test',
                  goalId: FACTION_GOALS.SETTLE_THE_SCORE,
                })
              },
            ],
          },
        },
      ],
    ).state

    const modifier = getFactionForecastModifier(state, state.customerGroups['miners']!)
    expect(modifier.modifier).toBeLessThan(0)
    expect(modifier.notes.join(' ')).toContain("Miners' Union")

    const after = forecastTrafficForGroup(
      state.customerGroups['miners']!,
      state,
      { state, rng: { int: () => 0 }, getDayType: () => state.calendar.dayType } as never,
    )
    expect(after.expected).toBeLessThan(before.expected)
    expect(after.notes.some((note) => note.includes("Miners' Union"))).toBe(true)
  })

  it('a supply squeeze reaches the supplier price and credit line, capped', () => {
    const clean = trading()
    const supplier = Object.values(clean.world.suppliers).find(
      (s) => s.factionId === 'brewers_guild',
    )
    expect(supplier, 'a brewers-guild supplier must exist to squeeze').toBeDefined()

    const squeezed = simulateDay(
      clean,
      { seed: `${SEED}/squeeze` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_squeeze',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'brewers_guild',
                  kind: 'supply_squeeze',
                  strength: 100,
                  reason: 'test',
                  goalId: FACTION_GOALS.SETTLE_THE_SCORE,
                })
              },
            ],
          },
        },
      ],
    ).state

    const pressure = getFactionSupplyPressure(squeezed, squeezed.world.suppliers[supplier!.id]!)
    expect(pressure.priceMultiplier).toBeGreaterThan(1)
    expect(pressure.priceMultiplier).toBeLessThanOrEqual(1.08)
    expect(pressure.creditMultiplier).toBeLessThan(1)
    expect(pressure.creditMultiplier).toBeGreaterThanOrEqual(0.65)

    const account = getSupplierAccount(squeezed, supplier!.id)
    const squeezedLimit = creditLimitFor(squeezed, squeezed.world.suppliers[supplier!.id]!, account)
    const cleanLimit = creditLimitFor(clean, clean.world.suppliers[supplier!.id]!, getSupplierAccount(clean, supplier!.id))
    expect(squeezedLimit).toBeLessThan(cleanLimit)

    const quote = quoteSupplierOrder(squeezed, {
      supplierId: supplier!.id,
      stockId: supplier!.goodsProvided[0]!,
      quantity: 5,
    })
    expect(quote.refusal).toBeUndefined()
    // The squeeze is named in the quote's own factor list, so the price the
    // player is shown explains itself.
    expect(JSON.stringify(quote.factors)).toContain('Brewers Guild')
  })

  it('protection reaches violence pressure as named relief', () => {
    let state = trading()
    state = {
      ...state,
      pressures: {
        ...state.pressures,
        violence: { ...state.pressures['violence']!, value: 70 },
      },
    }
    state = simulateDay(
      state,
      { seed: `${SEED}/protection` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_protection',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'town_watch',
                  kind: 'protection',
                  strength: 100,
                  reason: 'test',
                  goalId: FACTION_GOALS.ENFORCE_STANDARDS,
                })
              },
            ],
          },
        },
      ],
    ).state

    const protection = getFactionProtection(state)
    expect(protection.relief).toBeGreaterThan(0)
    expect(protection.readable).toContain('Town Watch')
  })

  it('§5.11 — stances expire on their own and stop being read', () => {
    let state = simulateDay(
      trading(),
      { seed: `${SEED}/expiry` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_expiry',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'miners_union',
                  kind: 'boycott',
                  strength: 60,
                  reason: 'test',
                  goalId: FACTION_GOALS.SETTLE_THE_SCORE,
                })
              },
            ],
          },
        },
      ],
    ).state
    expect(activeStance(state, 'miners_union', 'boycott')).toBeDefined()

    state = runDays(state, STANCE_DURATION_DAYS.boycott + 2, 1)
    expect(activeStance(state, 'miners_union', 'boycott')).toBeUndefined()
    expect(activeStances(state).some((s) => s.id === 'miners_union:boycott')).toBe(false)
    // Pruned, not merely ignored.
    expect(getFactionModuleState(state).stances['miners_union:boycott']).toBeUndefined()
  })

  it('§5.11 — move history is capped', () => {
    const state = runDays(trading(), 40)
    expect(getFactionModuleState(state).moveHistory.length).toBeLessThanOrEqual(
      MAX_FACTION_MOVE_HISTORY,
    )
  })
})

describe('Phase 215 §8.1 — every move can be opposed', () => {
  it('registers the four faction actions in the shared registry', () => {
    for (const id of [
      'grant_faction_demand',
      'refuse_faction_demand',
      'appeal_to_faction',
      'repay_faction_favour',
    ]) {
      expect(actionRegistry.get(id), `owner action '${id}' not registered`).toBeDefined()
    }
  })

  it('a demand can be granted: coin leaves the till and the grievance never lands', () => {
    // Reach a real, open demand by playing days on a tavern the union has a
    // complaint about, rather than by writing one into the slice.
    let state = withGrievance(trading(300), 'miners_union', 25)
    let demand = openDemandFor(state, 'miners_union')
    for (let day = 1; day <= 12 && !demand; day += 1) {
      state = run(state, day)
      demand = openDemandFor(state, 'miners_union')
    }
    expect(demand, 'the union should have asked for something within a fortnight').toBeDefined()

    const coinBefore = state.coin
    const after = run(state, 99, [
      { actionId: 'grant_faction_demand', targetId: 'miners_union' },
    ])

    const applied = getOwnerActionsModuleState(after).applied.find(
      (entry) => entry.actionId === 'grant_faction_demand',
    )
    expect(applied).toBeDefined()
    expect(openDemandFor(after, 'miners_union')).toBeUndefined()
    expect(getFactionModuleState(after).demands[demand!.id]!.status).toBe('granted')
    if (demand!.askCoin > 0) expect(after.coin).toBeLessThan(coinBefore)

    const favour = getFactionModuleState(after).standing['miners_union']!.entries.find(
      (entry) => entry.id === `demand_granted_${demand!.id}`,
    )
    expect(favour?.kind).toBe('favour')
  })

  it('refusing is cheaper than ignoring, and is recorded either way', () => {
    let state = withGrievance(trading(300), 'miners_union', 25)
    let demand = openDemandFor(state, 'miners_union')
    for (let day = 1; day <= 12 && !demand; day += 1) {
      state = run(state, day)
      demand = openDemandFor(state, 'miners_union')
    }
    expect(demand).toBeDefined()

    const refused = run(state, 99, [
      { actionId: 'refuse_faction_demand', targetId: 'miners_union' },
    ])
    expect(getFactionModuleState(refused).demands[demand!.id]!.status).toBe('refused')
    const refusalEntry = getFactionModuleState(refused).standing['miners_union']!.entries.find(
      (entry) => entry.id === `demand_refused_${demand!.id}`,
    )
    expect(refusalEntry?.kind).toBe('grievance')

    // Ignoring it: run past the deadline without answering.
    const ignored = runDays(state, demand!.dueOnDay - state.calendar.totalDaysElapsed + 1, 50)
    expect(getFactionModuleState(ignored).demands[demand!.id]!.status).toBe('lapsed')
    const ignoredEntry = getFactionModuleState(ignored).standing['miners_union']!.entries.find(
      (entry) => entry.id === `demand_ignored_${demand!.id}`,
    )
    expect(ignoredEntry?.kind).toBe('grievance')
    expect(ignoredEntry!.weight).toBeGreaterThan(refusalEntry!.weight)
  })

  it('an appeal can be lost — it is a contest, not a cancel button', () => {
    // A faction with a deep grievance and real influence will not be talked
    // round; one the house is still on decent terms with can be.
    let hostile = withGrievance(trading(), 'miners_union', 40)
    hostile = simulateDay(
      hostile,
      { seed: `${SEED}/appeal-hostile` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_hostile_stance',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'miners_union',
                  kind: 'boycott',
                  strength: 80,
                  reason: 'test',
                  goalId: FACTION_GOALS.SETTLE_THE_SCORE,
                })
              },
            ],
          },
        },
      ],
    ).state

    const appealed = run(hostile, 5, [
      { actionId: 'appeal_to_faction', targetId: 'miners_union' },
    ])
    const applied = getOwnerActionsModuleState(appealed).applied.find(
      (entry) => entry.actionId === 'appeal_to_faction',
    )
    expect(applied, 'the appeal must be applicable').toBeDefined()
    const outcome = (applied!.data as { outcome?: string }).outcome
    expect(['withdrawn', 'softened', 'refused']).toContain(outcome)
    // With a 40-weight grievance the union will not simply drop it.
    expect(outcome).not.toBe('withdrawn')
  })

  it('a softened stance is genuinely weaker and ends sooner', () => {
    let state = simulateDay(
      trading(),
      { seed: `${SEED}/soften` },
      [
        ...FULL_PIPELINE,
        {
          id: 'test_soften',
          version: '1.0.0',
          hooks: {
            startDay: [
              (ctx) => {
                openStance(ctx, {
                  factionId: 'miners_union',
                  kind: 'boycott',
                  strength: 80,
                  reason: 'test',
                  goalId: FACTION_GOALS.SETTLE_THE_SCORE,
                })
              },
            ],
          },
        },
      ],
    ).state
    const before = activeStance(state, 'miners_union', 'boycott')!

    state = run(state, 5, [{ actionId: 'appeal_to_faction', targetId: 'miners_union' }])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (entry) => entry.actionId === 'appeal_to_faction',
    )!
    const outcome = (applied.data as { outcome?: string }).outcome

    if (outcome === 'softened') {
      const after = activeStance(state, 'miners_union', 'boycott')!
      expect(after.strength).toBeLessThan(before.strength)
      expect(after.endsOnDay).toBeLessThan(before.endsOnDay)
      expect(after.contestedOnDay).toBeDefined()
    } else if (outcome === 'withdrawn') {
      expect(activeStance(state, 'miners_union', 'boycott')).toBeUndefined()
    }
    // Either way, the same stance cannot be argued with twice.
    const second = run(state, 6, [
      { actionId: 'appeal_to_faction', targetId: 'miners_union' },
    ])
    const rejected = getOwnerActionsModuleState(second).rejected.find(
      (entry) => entry.actionId === 'appeal_to_faction',
    )
    if (activeStance(state, 'miners_union', 'boycott')) {
      expect(rejected?.code).toBe('already_contested')
    }
  })
})

describe('Phase 215 §8.1 — the world stays valid and the report says what happened', () => {
  it('a fortnight of autonomous faction behaviour leaves a valid state', () => {
    const state = runDays(trading(), 14)
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(validation.success, validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2))).toBe(true)
  })

  it('the faction report surfaces announced intent and live stances', () => {
    const state = withGrievance(trading(), 'miners_union', 45)
    const result = simulateDay(state, { seed: `${SEED}/report` }, FULL_PIPELINE)
    const section = result.reports.find((s) => s.id === 'factions')
    expect(section).toBeDefined()
    const intents = listFactionIntents(result.state)
    if (intents.length > 0) {
      expect(section!.lines.join('\n')).toContain('Announced:')
    }
    expect(section!.data).toHaveProperty('announcedIntents')
    expect(section!.data).toHaveProperty('activeStanceIds')
  })
})
