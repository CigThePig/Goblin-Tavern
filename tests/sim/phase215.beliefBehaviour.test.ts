// Expansion Phase 8 §8.5 (repo phase 215) / ISSUE-178 — attribution becomes
// behavioral.
//
// §8.5 is one sentence of design and six named consumers:
//
//   "Strong beliefs should influence capped, domain-owned decisions such as
//    supplier quotes and willingness to extend credit; faction target
//    selection; regular visits and recommendations; staff cooperation,
//    stress, and resignation; customer-group forecast; landlord and
//    inspector interpretation where legitimate. Attribution does not
//    directly mutate unrelated domains. It supplies a bounded input to
//    their decision rules."
//
// WHAT THIS REPLACES. Since Phase 37 the attribution layer has produced a
// rich, aging, merging record of what everybody in the world thinks — and
// exactly one thing in the simulation read it as an input to a decision
// (`supplierGrievance`, in the supplier's price). Everywhere else it fed
// pressure calculators, issue-seed selection and report prose: belief you
// could read about but never feel. §8.5 makes it act, and the two words
// doing the work are CAPPED and DOMAIN-OWNED — the belief layer supplies a
// number, and each domain decides for itself what that number is worth
// inside its own rule.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext, SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { EntityRef, TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  BELIEF_ACTING_THRESHOLD,
  actingBeliefs,
  beliefAgainstHouse,
  beliefBetween,
  getAttributionModuleState,
  goodwillTowardHouse,
  houseRef,
  recordAttribution,
} from '../../src/sim/modules/attribution/index'
import {
  MAX_BELIEF_FORECAST_SWING,
  getBeliefForecastModifier,
} from '../../src/sim/modules/customers/beliefInfluence'
import { supplierGrievance } from '../../src/sim/modules/suppliers/quote'
import { describeQuitRiskContributors } from '../../src/sim/modules/staff/index'
import { assessVisit } from '../../src/sim/modules/regulars/visits'
import { buildPerception } from '../../src/sim/modules/factions/factionActors'
import { outcomeFor } from '../../src/sim/modules/regulatory/inspection'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { scheduleEvent } from '../../src/sim/contracts/scheduledEvents/index'
import {
  BELIEF_BRIBE_EXPOSED_EVENT,
  BELIEF_GRUDGE_EVENT,
} from '../../src/sim/modules/attribution/index'

const SEED = 'phase215/belief-behaviour'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: SimContext) => void

/** A tavern being run badly enough that people form opinions about it. */
function resented(coin = 400): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 200, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 85 })
  state = withArea(state, 'main_room', { cleanliness: 20, damage: 60 })
  return state
}

function run(state: TavernState, day: number, ownerActions: SimInput['ownerActions'] = []): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(state, { seed: `${SEED}/${tag}` }, [
    ...FULL_PIPELINE,
    { id: `test_${tag}`, version: '1.0.0', hooks: { startDay: [setup] } } as Module,
  ]).state
}

/**
 * Somebody comes to believe something about the house.
 *
 * Through `recordAttribution`, the module's own domain-facing entry point —
 * the same merge, clamp, age and propagate path a rule's draft takes. Nothing
 * here writes state the rule pass could not have written, which is what §5
 * means by not reaching the feature through injected state.
 */
function believing(
  state: TavernState,
  tag: string,
  holder: EntityRef,
  options: { strength?: number; accuracy?: 'true' | 'partial' | 'false' | 'unknown' } = {},
): TavernState {
  return withSetup(state, tag, (ctx) => {
    recordAttribution(ctx, {
      perceivedBy: holder,
      target: houseRef(ctx.state),
      attributionType: 'blame',
      accuracy: options.accuracy ?? 'false',
      strength: options.strength ?? 85,
      confidence: 90,
      publicness: 70,
      volatility: 20,
      readable: 'They hold the house responsible for what happened.',
      tags: ['test_belief', tag],
      relatedSystems: ['attribution'],
    })
  })
}

describe('Phase 215 §8.5 — the belief input is bounded and shared', () => {
  it('reads the strongest live belief one entity holds about another', () => {
    const state = believing(resented(), 'reader', { kind: 'supplier', id: 'old_keg_brewers' })
    const pressure = beliefAgainstHouse(state, { kind: 'supplier', id: 'old_keg_brewers' })
    expect(pressure).toBeDefined()
    expect(pressure!.weight).toBeGreaterThan(BELIEF_ACTING_THRESHOLD)
    expect(pressure!.weight).toBeLessThanOrEqual(1)
    expect(pressure!.readable.length).toBeGreaterThan(0)
    expect(pressure!.direction).toBe('against')
  })

  it('never reports a weight outside 0…1, however extreme the belief', () => {
    const state = believing(resented(), 'extreme', { kind: 'staff', id: Object.keys(resented().staff)[0]! }, { strength: 100 })
    const staffId = Object.keys(state.staff)[0]!
    const pressure = beliefAgainstHouse(state, { kind: 'staff', id: staffId })
    expect(pressure!.weight).toBeLessThanOrEqual(1)
    expect(pressure!.weight).toBeGreaterThanOrEqual(0)
  })

  it('separates what somebody holds against the house from what they credit it with', () => {
    const state = runDays(resented(), 14)
    for (const holder of [
      ...Object.keys(state.world.suppliers).map((id) => ({ kind: 'supplier' as const, id })),
      ...Object.keys(state.staff).map((id) => ({ kind: 'staff' as const, id })),
    ]) {
      const against = beliefAgainstHouse(state, holder)
      const toward = goodwillTowardHouse(state, holder)
      if (against) expect(against.direction).toBe('against')
      if (toward) expect(toward.direction).toBe('toward')
    }
  })

  it('is a pure read — asking does not change the world', () => {
    const state = runDays(resented(), 10)
    const before = JSON.stringify(state)
    for (const supplierId of Object.keys(state.world.suppliers)) {
      beliefAgainstHouse(state, { kind: 'supplier', id: supplierId })
      beliefBetween(state, { kind: 'supplier', id: supplierId }, houseRef(state))
    }
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('Phase 215 §8.5 — six domains read it, and each caps it themselves', () => {
  it('a supplier that blames the house quotes worse and lends less', () => {
    const base = runDays(resented(), 6)
    const supplierId = Object.keys(base.world.suppliers)[0]!
    const believed = believing(base, 'quote', { kind: 'supplier', id: supplierId })
    expect(supplierGrievance(believed, supplierId)).toBeGreaterThan(
      supplierGrievance(base, supplierId),
    )
  })

  it('a customer group that blames the house turns out smaller, within the cap', () => {
    const base = runDays(resented(), 6)
    const groupId = 'local_goblins'
    const believed = believing(base, 'forecast', { kind: 'customer_group', id: groupId })

    const forecastFor = (state: TavernState): number => {
      const next = simulateDay(state, { seed: `${SEED}/forecast` }, FULL_PIPELINE).state
      const slice = next.modules['customers'] as {
        forecasts?: Array<{ groupId: string; expected: number }>
      }
      return slice.forecasts?.find((f) => f.groupId === groupId)?.expected ?? 0
    }
    const before = forecastFor(base)
    const after = forecastFor(believed)
    expect(after).toBeLessThan(before)
    // …and the belief layer cannot be the thing that empties the room.
    expect(before - after).toBeLessThanOrEqual(MAX_BELIEF_FORECAST_SWING)
    expect(
      getBeliefForecastModifier(believed, believed.customerGroups[groupId]!).modifier,
    ).toBeGreaterThanOrEqual(-MAX_BELIEF_FORECAST_SWING)
  })

  it('a regular who blames the house is less likely to come, and is told why', () => {
    const base = runDays(resented(), 10)
    const regularId = Object.keys(base.world.regulars)[0]
    if (!regularId) return
    const believed = believing(base, 'visit', { kind: 'regular', id: regularId })

    const assess = (state: TavernState) => {
      let out: { probability: number; drivers: string[] } | undefined
      simulateDay(state, { seed: `${SEED}/assess` }, [
        ...FULL_PIPELINE,
        {
          id: 'test_assess',
          version: '1.0.0',
          hooks: {
            beforeService: [
              (ctx: SimContext) => {
                const regular = ctx.state.world.regulars[regularId]!
                const group = ctx.state.customerGroups[regular.customerGroupId]
                out = assessVisit(ctx, regular, group)
              },
            ],
          },
        } as Module,
      ])
      return out!
    }

    const before = assess(base)
    const after = assess(believed)
    expect(after.probability).toBeLessThan(before.probability)
    expect(after.drivers.some((d) => /blame|hold|against/i.test(d))).toBe(true)
  })

  it('a staff member who blames the house lists it as a reason for leaving', () => {
    const base = runDays(resented(), 8)
    const staffId = Object.keys(base.staff)[0]!
    const believed = believing(base, 'quit', { kind: 'staff', id: staffId })

    const rows = describeQuitRiskContributors(believed, staffId)
    const row = rows.find((r) => r.id === 'blames_the_house')
    expect(row, 'a staff grievance against the owner is not a reason to leave').toBeDefined()
    expect(row!.weight).toBeGreaterThan(0)
    expect(row!.remedy, 'the player is not told what would answer it').toBeTruthy()
    // Capped: no single contributor may be enough to walk somebody out.
    expect(row!.weight).toBeLessThanOrEqual(20)
  })

  it('a faction that blames the house can see it, and wants the score settled', () => {
    const base = runDays(resented(), 8)
    const factionId = Object.keys(base.world.factions)[0]!
    const believed = believing(base, 'faction', { kind: 'faction', id: factionId })

    const perception = buildPerception(believed, believed.world.factions[factionId]!)
    expect(perception.readings['grievanceAgainstHouse']).toBeGreaterThan(0)
    expect(Object.keys(perception.beliefs).length).toBeGreaterThan(0)
  })

  it('an inspector who has come to distrust the house reads the same findings harder', () => {
    const base = runDays(resented(), 8)
    const believed = believing(base, 'watch', { kind: 'faction', id: 'town_watch' })
    const findings = [
      {
        dimension: 'cleanliness' as const,
        severity: 10,
        readable: 'test',
        requirement: 'test',
        target: { kind: 'area' as const, id: 'main_room', threshold: 55 },
      },
    ]
    const plain = outcomeFor(base, findings, 10)
    const swayed = outcomeFor(believed, findings, 10)
    const ladder = ['pass', 'conditional_pass', 'warning', 'fine', 'remediation_order', 'escalation', 'closure']
    expect(ladder.indexOf(swayed)).toBeGreaterThanOrEqual(ladder.indexOf(plain))
  })
})

describe('Phase 215 §8.5 — the player can answer a belief', () => {
  it('registers an action that addresses what somebody holds against the house', () => {
    const def = actionRegistry.get('address_grievance')
    expect(def, 'there is no way to answer a grievance').toBeDefined()
    expect(def!.timeCost).toBeGreaterThan(0)
  })

  it('answering a false belief reduces its hold; answering a true one does not settle it alone', () => {
    const base = runDays(resented(), 10)
    const staffId = Object.keys(base.staff)[0]!
    const believed = believing(base, 'answer', { kind: 'staff', id: staffId })
    const before = beliefAgainstHouse(believed, { kind: 'staff', id: staffId })
    expect(before).toBeDefined()

    const after = run(believed, 60, [
      { actionId: 'address_grievance', targetId: `staff:${staffId}` },
    ])
    const pressure = beliefAgainstHouse(after, { kind: 'staff', id: staffId })
    expect(pressure?.weight ?? 0).toBeLessThan(before!.weight)
    // …by MORE than the day would have taken off on its own, or the test
    // would be measuring aging rather than the answer.
    const untouched = run(believed, 60)
    const drifted = beliefAgainstHouse(untouched, { kind: 'staff', id: staffId })
    expect(pressure?.weight ?? 0).toBeLessThan(drifted?.weight ?? 0)

    // …and the same move against something they are RIGHT about hardens it,
    // exactly as denying a true rumour does in §8.4.
    const rightlyHeld = believing(base, 'answer_true', { kind: 'staff', id: staffId }, {
      accuracy: 'true',
    })
    const heldBefore = beliefAgainstHouse(rightlyHeld, { kind: 'staff', id: staffId })!
    const argued = run(rightlyHeld, 61, [
      { actionId: 'address_grievance', targetId: `staff:${staffId}` },
    ])
    const heldAfter = beliefAgainstHouse(argued, { kind: 'staff', id: staffId })!
    expect(heldAfter.weight).toBeGreaterThanOrEqual(heldBefore.weight)
    expect(
      getAttributionModuleState(argued)!.behaviour.totals.refusedAsTrue,
    ).toBeGreaterThan(0)
  })
})

describe('Phase 215 §8.5 — what is acting is recorded and bounded', () => {
  it('records the beliefs strong enough to be changing decisions', () => {
    const state = runDays(resented(), 20)
    const slice = getAttributionModuleState(state)!
    expect(slice.behaviour).toBeDefined()
    for (const entry of slice.behaviour!.acting) {
      expect(entry.weight).toBeGreaterThanOrEqual(BELIEF_ACTING_THRESHOLD)
      expect(entry.domains.length).toBeGreaterThan(0)
    }
    expect(actingBeliefs(state).length).toBe(slice.behaviour!.acting.length)
  })

  it('keeps the record bounded on a long run', () => {
    const state = runDays(resented(), 40)
    const slice = getAttributionModuleState(state)!
    expect(slice.behaviour!.history.length).toBeLessThanOrEqual(40)
    expect(slice.behaviour!.acting.length).toBeLessThanOrEqual(12)
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(validation.success, validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2))).toBe(true)
  })

  it('reports what belief is costing the house', () => {
    const state = runDays(resented(), 20)
    const result = simulateDay(state, { seed: `${SEED}/report` }, FULL_PIPELINE)
    const section = result.reports.find((r) => r.id === 'attribution')
    expect(section).toBeDefined()
  })
})

describe('Phase 215 §8.5 — the last two Phase-8 hook families resolve into belief', () => {
  it('owns both hook families, typed and mechanical', () => {
    for (const [hookName, type] of [
      ['rumour_blame_grudge_customer_group_miners', BELIEF_GRUDGE_EVENT],
      ['rumour_blame_grudge_supplier_old_keg_brewers', BELIEF_GRUDGE_EVENT],
      ['rumour_bribe_exposed_regular_someone', BELIEF_BRIBE_EXPOSED_EVENT],
      ['rumour_bribe_exposed_customer_group_miners', BELIEF_BRIBE_EXPOSED_EVENT],
    ] as Array<[string, string]>) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(type)
      expect(definition?.ownerModuleId).toBe('attribution')
      expect(definition?.kind).toBe('mechanical')
    }
  })

  it('reads a composite entity kind back out of the hook name', () => {
    const definition = findScheduledEventDefinitionForHookName(
      'rumour_blame_grudge_customer_group_miners',
    )!
    const built = definition.fromFutureHook?.({
      hookName: 'rumour_blame_grudge_customer_group_miners',
      readable: '',
      scheduledForDay: 5,
      state: createInitialTavernState(),
    })
    // `customer_group` contains an underscore, so a naive split would have
    // produced kind `customer` and id `group_miners`.
    expect(built?.payload).toEqual({ holderKind: 'customer_group', holderId: 'miners' })
  })

  it('declines a hook whose subject names no entity kind at all', () => {
    const definition = findScheduledEventDefinitionForHookName('rumour_bribe_exposed_x')!
    expect(
      definition.fromFutureHook?.({
        hookName: 'rumour_bribe_exposed_nonsense',
        readable: '',
        scheduledForDay: 5,
        state: createInitialTavernState(),
      }),
    ).toBeUndefined()
  })

  it('a grudge it forms is TRUE, so it cannot be talked away', () => {
    const base = runDays(resented(), 6)
    const scheduled = withSetup(base, 'grudge', (ctx) => {
      scheduleEvent(ctx, {
        type: BELIEF_GRUDGE_EVENT,
        payload: { holderKind: 'customer_group', holderId: 'miners' },
        scheduledForDay: ctx.state.calendar.totalDaysElapsed,
        target: { kind: 'customer_group', id: 'miners' },
        origin: { source: 'test', readable: 'the house blamed them for it' },
      })
    })
    const holder = { kind: 'customer_group' as const, id: 'miners' }
    const belief = beliefAgainstHouse(scheduled, holder)
    expect(belief, 'the grudge never formed').toBeDefined()
    expect(belief!.accuracy).toBe('true')

    const answered = run(scheduled, 70, [
      { actionId: 'address_grievance', targetId: 'customer_group:miners' },
    ])
    const after = beliefAgainstHouse(answered, holder)!
    expect(after.weight).toBeGreaterThanOrEqual(belief!.weight)
  })
})
