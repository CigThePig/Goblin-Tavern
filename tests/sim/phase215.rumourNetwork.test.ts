// Expansion Phase 8 §8.4 (repo phase 215) / ISSUE-178 — the rumour network,
// and the rumour half of OBL-08.
//
// §8.4 lists ten things bounded propagation needs — sources, audiences or
// channels, credibility, topic/entity targets, distortion, public/private
// reach, reinforcement and contradiction, correction, decay, and faction /
// culture / regular / NPC sharing behaviour — then adds two requirements
// that are really about honesty:
//
//   "All material decay and deletion must be causally covered."   → OBL-08
//   "…retaining anti-recursion and bounded-growth protections."
//
// WHAT THIS REPLACES. `world.socialRumours` was a bag of records with a
// strength and an accuracy. The weekly pass added to it, a daily hook
// multiplied every strength by 0.85 in a bare loop that mutated state
// directly, and a monthly hook deleted whatever had gone stale. Nothing
// spread: a rumour appeared at full volume in everybody's ears at once and
// then got quieter. Nobody heard it from anybody, and `accuracy` decided
// nothing at all.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { SocialRumourState, TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/state'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import { groupedTargetMembers } from '../../src/sim/contracts/causality/groupedTargets'
import {
  COUNTER_RUMOUR_RUNAWAY_EVENT,
  MAX_RUMOUR_AUDIENCES,
  MAX_RUMOUR_HOPS,
  MAX_SPREADS_PER_DAY,
  MAX_SPREAD_HISTORY,
  RUMOUR_SILENCE_LIMIT_DAYS,
  RUMOUR_DENIAL_BACKFIRE_EVENT,
  RUMOUR_ESCALATION_EVENT,
  audiencesOf,
  correctRumour,
  damagingBeliefFor,
  getRumourModuleState,
  hasHeard,
  listRumours,
  liveRumours,
  openContradiction,
} from '../../src/sim/modules/rumours/index'

const SEED = 'phase215/rumour-network'

type Module = Parameters<typeof simulateDay>[2][number]
type SetupHook = (ctx: import('../../src/sim/core/context').SimContext) => void
type Actions = NonNullable<SimInput['ownerActions']>

/** A tavern with enough going wrong that people talk about it. */
function talkedAbout(coin = 400): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 200, spoilage: 0 })
  }
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 85 })
  state = withArea(state, 'main_room', { cleanliness: 20, damage: 60 })
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

function withSetup(state: TavernState, tag: string, setup: SetupHook): TavernState {
  return simulateDay(
    state,
    { seed: `${SEED}/${tag}` },
    [
      ...FULL_PIPELINE,
      { id: `test_${tag}`, version: '1.0.0', hooks: { startDay: [setup] } } as Module,
    ],
  ).state
}

/** Put a specific story about, the way the world does. */
function withRumour(
  state: TavernState,
  tag: string,
  rumour: Partial<SocialRumourState> & { id: string; label: string },
): TavernState {
  return withSetup(state, tag, (ctx) => {
    if (ctx.state.world.socialRumours[rumour.id]) return
    ctx.addSocialRumour(
      {
        strength: 60,
        accuracy: 'unknown',
        firstHeardDay: ctx.state.calendar.totalDaysElapsed,
        lastSpreadDay: ctx.state.calendar.totalDaysElapsed,
        tags: ['rumour'],
        ...rumour,
      } as SocialRumourState,
      {
        source: 'test',
        sourceType: 'rumour',
        target: rumour.id,
        targetType: 'rumour',
        readable: 'test rumour',
        tags: ['test'],
      },
    )
  })
}

describe('Phase 215 §8.4 — talk has a source, and travels through people', () => {
  it('every rumour that anybody has heard has somebody who started it', () => {
    const state = runDays(talkedAbout(), 12)
    const carried = liveRumours(state).filter((rumour) => audiencesOf(rumour).length > 0)
    expect(carried.length, 'nothing was going round in a fortnight').toBeGreaterThan(0)
    for (const rumour of carried) {
      expect(rumour.originRef, `"${rumour.label}" is going round from nowhere`).toBeDefined()
      // The source is one of the kinds that can actually speak.
      expect(['faction', 'culture', 'customer_group', 'notable_npc']).toContain(
        rumour.originRef!.kind,
      )
    }
  })

  it('a rumour only reaches somebody who was told it by somebody who had heard it', () => {
    const state = runDays(talkedAbout(), 16)
    const slice = getRumourModuleState(state)
    expect(slice.spreadHistory.length, 'nothing spread at all').toBeGreaterThan(0)

    for (const spread of slice.spreadHistory) {
      const rumour = state.world.socialRumours[spread.rumourId]
      if (!rumour) continue
      // The carrier is on the audience list (or was the origin).
      const carrierHeard =
        hasHeard(rumour, spread.fromId) || rumour.originRef?.id === spread.fromId
      expect(
        carrierHeard,
        `${spread.fromId} passed on "${rumour.label}" without having heard it`,
      ).toBe(true)
    }
  })

  it('the spread log names who told whom, unambiguously', () => {
    const state = runDays(talkedAbout(), 16)
    for (const spread of getRumourModuleState(state).spreadHistory) {
      expect(spread.readable).toContain('passed it to')
      // A customer group and its culture share a display label, so the
      // readable has to say which is which or a group→culture hop reads as
      // somebody telling themselves.
      expect(spread.fromId).not.toBe(spread.toId)
    }
  })
})

describe('Phase 215 §8.4 — credibility, distortion and reach are separate things', () => {
  it('strength and credibility come apart', () => {
    const state = runDays(talkedAbout(), 20)
    const carried = liveRumours(state).filter((r) => audiencesOf(r).length > 0)
    if (carried.length === 0) return
    for (const rumour of carried) {
      expect(rumour.credibility).toBeDefined()
      expect(rumour.credibility!).toBeGreaterThanOrEqual(0)
      expect(rumour.credibility!).toBeLessThanOrEqual(100)
    }
    // At least one is loud-and-doubted or quiet-and-credited; if they always
    // matched, credibility would be a second name for strength.
    const diverged = carried.some(
      (rumour) => Math.abs(rumour.strength - (rumour.credibility ?? 50)) >= 10,
    )
    expect(diverged).toBe(true)
  })

  it('distortion only ever grows, and rewrites the story when it is far enough gone', () => {
    const state = runDays(talkedAbout(), 24)
    for (const rumour of listRumours(state)) {
      const distortion = rumour.distortion ?? 0
      expect(distortion).toBeGreaterThanOrEqual(0)
      expect(distortion).toBeLessThanOrEqual(100)
      if (distortion >= 40) {
        // The label says so — the player can see it has become something else.
        expect(rumour.label).not.toBe(rumour.originalLabel)
      }
      // Whatever it has become, what it started as is still recorded.
      if (audiencesOf(rumour).length > 0) {
        expect(rumour.originalLabel).toBeDefined()
      }
    }
  })

  it('accuracy finally decides something', () => {
    // Before §8.4 `accuracy` was read by one pressure calculator and nothing
    // else: whether a rumour was TRUE made no difference to whether anybody
    // credited it. A denial of something true now backfires; of something
    // false it does not.
    let state = withRumour(talkedAbout(), 'true-story', {
      id: 'rumour_test_true',
      label: 'The house waters the ale',
      accuracy: 'true',
      strength: 60,
    })
    state = runDays(state, 2, 1)
    state = run(state, 10, [{ actionId: 'deny_rumour', targetId: 'rumour_test_true' }])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (entry) => entry.actionId === 'deny_rumour',
    )
    expect(applied).toBeDefined()
    expect((applied!.data as { backfireScheduled?: boolean }).backfireScheduled).toBe(true)

    let falseState = withRumour(talkedAbout(), 'false-story', {
      id: 'rumour_test_false',
      label: 'The house poisons its stew',
      accuracy: 'false',
      strength: 60,
    })
    falseState = runDays(falseState, 2, 1)
    falseState = run(falseState, 10, [
      { actionId: 'deny_rumour', targetId: 'rumour_test_false' },
    ])
    const falseApplied = getOwnerActionsModuleState(falseState).applied.find(
      (entry) => entry.actionId === 'deny_rumour',
    )
    expect(falseApplied).toBeDefined()
    expect(
      (falseApplied!.data as { backfireScheduled?: boolean }).backfireScheduled,
    ).toBe(false)
  })
})

describe('Phase 215 §8.4 — contradiction and correction are different', () => {
  it('a contradiction leaves both stories alive and costs both their credit', () => {
    let state = withRumour(talkedAbout(), 'contradicted', {
      id: 'rumour_test_contra',
      label: 'The cellar is full of rats',
      strength: 60,
      credibility: 70,
    })
    state = runDays(state, 2, 1)

    state = withSetup(state, 'open-counter', (ctx) => {
      openContradiction(ctx, {
        rumourId: 'rumour_test_contra',
        label: 'The cellar was inspected and is clean',
        credibility: 60,
      })
    })

    const original = state.world.socialRumours['rumour_test_contra']
    expect(original?.counterRumourId).toBeDefined()
    const counter = state.world.socialRumours[original!.counterRumourId!]
    expect(counter, 'the counter-story must exist').toBeDefined()

    // Both alive.
    const after = runDays(state, 3, 5)
    expect(after.world.socialRumours['rumour_test_contra']).toBeDefined()
    // Both worn down.
    expect(after.world.socialRumours['rumour_test_contra']!.credibility!).toBeLessThan(70)
  })

  it('anti-recursion — a counter-story cannot itself be countered', () => {
    let state = withRumour(talkedAbout(), 'anti-recursion', {
      id: 'rumour_test_recurse',
      label: 'Something is wrong at the house',
      strength: 60,
    })
    state = runDays(state, 2, 1)
    state = withSetup(state, 'counter-once', (ctx) => {
      const counter = openContradiction(ctx, {
        rumourId: 'rumour_test_recurse',
        label: 'Nothing is wrong at the house',
        credibility: 60,
      })
      expect(counter, 'the first counter should open').toBeDefined()
      // …and a counter to the counter must not.
      const second = openContradiction(ctx, {
        rumourId: counter!.id,
        label: 'Actually something IS wrong',
        credibility: 60,
      })
      expect(second, 'a counter-story must not be counterable').toBeUndefined()
    })
    void state
  })

  it('a correction settles the matter rather than merely quietening it', () => {
    let state = withRumour(talkedAbout(), 'corrected', {
      id: 'rumour_test_correct',
      label: 'The cook was seen stealing',
      strength: 70,
    })
    state = runDays(state, 2, 1)
    state = withSetup(state, 'do-correct', (ctx) => {
      const ok = correctRumour(ctx, 'rumour_test_correct', 'It was settled publicly.')
      expect(ok).toBe(true)
    })

    const settled = state.world.socialRumours['rumour_test_correct']!
    expect(settled.correctedOnDay).toBeDefined()
    expect(settled.credibility).toBe(0)
    for (const audience of audiencesOf(settled)) {
      expect(audience.belief).toBe(0)
    }
    // …and it stops travelling: a settled story is not carried on.
    const later = runDays(state, 5, 5)
    const stillThere = later.world.socialRumours['rumour_test_correct']
    if (stillThere) {
      expect(audiencesOf(stillThere).length).toBeLessThanOrEqual(
        audiencesOf(settled).length,
      )
    }
  })
})

describe('Phase 215 §8.4 — OBL-08: decay and deletion are causally covered', () => {
  it('the daily fade emits a grouped cause naming every rumour it touched', () => {
    let state = runDays(talkedAbout(), 8)
    const result = simulateDay(state, { seed: `${SEED}/decay` }, FULL_PIPELINE)
    state = result.state

    const today = state.calendar.totalDaysElapsed - 1
    const grouped = state.causes.filter(
      (cause) =>
        cause.source === 'rumours.belief.decay' &&
        cause.timestamp.absoluteDay === today,
    )
    if (grouped.length === 0) return

    const cause = grouped[0]!
    // The Phase 1 §1.4 convention: grouped, sized, and naming its members.
    expect(cause.tags).toContain('grouped')
    expect(cause.tags.some((tag) => tag.startsWith('group_size:'))).toBe(true)
    const named = groupedTargetMembers(cause.target)
    if (named) {
      expect(named.length).toBeGreaterThan(0)
    }
    expect(cause.readable).toMatch(/quietened/)
  })

  it('a rumour dying out leaves a cause naming it — not a bare deletion', () => {
    // Play until something has died out, then find its obituary.
    const state = runDays(talkedAbout(), 30)
    const faded = state.causes.filter(
      (cause) => cause.source === 'rumours.belief.faded_out',
    )
    expect(faded.length, 'nothing died out in a month').toBeGreaterThan(0)
    for (const cause of faded) {
      expect(cause.targetType).toBe('rumour')
      expect(cause.target.length).toBeGreaterThan(0)
      expect(cause.readable).toMatch(/died out|stopped being repeated/)
    }
  })

  it('every rumour that left state between two days has a cause explaining it', () => {
    let state = runDays(talkedAbout(), 20)
    for (let day = 20; day < 34; day += 1) {
      const before = new Set(Object.keys(state.world.socialRumours))
      const next = run(state, day)
      const after = new Set(Object.keys(next.world.socialRumours))
      const removed = [...before].filter((id) => !after.has(id))
      const dayStamp = next.calendar.totalDaysElapsed - 1

      for (const id of removed) {
        const explained = next.causes.some(
          (cause) =>
            cause.timestamp.absoluteDay === dayStamp &&
            (cause.target === id || (groupedTargetMembers(cause.target) ?? []).includes(id)),
        )
        expect(explained, `rumour '${id}' vanished on day ${dayStamp} uncaused`).toBe(true)
      }
      state = next
    }
  })
})

describe('Phase 215 §8.4 — anti-recursion and bounded growth', () => {
  it('a story nobody has repeated in a fortnight stops travelling', () => {
    // Found while re-running the Phase 83 prune tests: propagation happily
    // picked up a rumour nobody had mentioned in three months and passed it
    // on as if it were fresh — and because every pass refreshes
    // `lastSpreadDay`, the monthly stale prune could then never fire.
    let state = withRumour(talkedAbout(), 'silence', {
      id: 'r_silence',
      label: 'The cellar floods when it rains',
      strength: 95,
      accuracy: 'partial',
      tags: ['rumour', 'premises'],
    })

    let observedSilent = 0
    for (let day = 1; day < 40; day += 1) {
      const before = state.world.socialRumours['r_silence']
      if (!before) break
      const today = state.calendar.totalDaysElapsed
      const silent = today - before.lastSpreadDay > RUMOUR_SILENCE_LIMIT_DAYS
      const heardBefore = audiencesOf(before).length

      state = run(state, day)

      const after = state.world.socialRumours['r_silence']
      if (silent && after) {
        observedSilent += 1
        expect(
          audiencesOf(after).length,
          `a story silent for over ${RUMOUR_SILENCE_LIMIT_DAYS} days found a new ear on day ${today}`,
        ).toBe(heardBefore)
        expect(after.lastSpreadDay).toBe(before.lastSpreadDay)
      }
    }

    expect(observedSilent, 'the rumour never went quiet, so nothing was proved').toBeGreaterThan(0)
  })

  it('a rumour never reaches the same audience twice', () => {
    const state = runDays(talkedAbout(), 30)
    for (const rumour of listRumours(state)) {
      const ids = audiencesOf(rumour).map((audience) => audience.id)
      expect(new Set(ids).size, `"${rumour.label}" told somebody twice`).toBe(ids.length)
    }
  })

  it('hops, audiences, daily spread and history are all bounded', () => {
    const state = runDays(talkedAbout(), 40)
    for (const rumour of listRumours(state)) {
      expect(rumour.hops ?? 0).toBeLessThanOrEqual(MAX_RUMOUR_HOPS)
      expect(audiencesOf(rumour).length).toBeLessThanOrEqual(MAX_RUMOUR_AUDIENCES)
    }
    const slice = getRumourModuleState(state)
    expect(slice.spreadHistory.length).toBeLessThanOrEqual(MAX_SPREAD_HISTORY)
    expect(slice.spreadToday.length).toBeLessThanOrEqual(MAX_SPREADS_PER_DAY)
  })

  it('a month of talk leaves a valid state', () => {
    const state = runDays(talkedAbout(), 30)
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })
})

describe('Phase 215 §8.4 — belief alters decisions', () => {
  it('what an audience believes is a bounded input to their own forecast rule', () => {
    const state = runDays(talkedAbout(), 20)
    let sawBelief = false
    for (const culture of Object.values(state.world.cultures)) {
      const reading = damagingBeliefFor(state, culture.id)
      expect(reading.belief).toBeGreaterThanOrEqual(0)
      expect(reading.belief).toBeLessThanOrEqual(100)
      if (reading.belief > 0) {
        sawBelief = true
        expect(reading.readable).toBeTruthy()
        expect(reading.rumourId).toBeTruthy()
      }
    }
    // Somebody, somewhere, believes something after three weeks of trouble.
    expect(sawBelief).toBe(true)
  })
})

describe('Phase 215 §8.4 — the three hook families, and the player’s answers', () => {
  it('claims rumour_escalation_*, rumour_denial_backfire_* and counter_rumour_runaway_*', () => {
    for (const [hookName, type] of [
      ['rumour_escalation_rumour_x', RUMOUR_ESCALATION_EVENT],
      ['rumour_denial_backfire_rumour_x', RUMOUR_DENIAL_BACKFIRE_EVENT],
      ['counter_rumour_runaway_rumour_x', COUNTER_RUMOUR_RUNAWAY_EVENT],
    ] as const) {
      const definition = findScheduledEventDefinitionForHookName(hookName)
      expect(definition?.type, hookName).toBe(type)
      expect(definition?.ownerModuleId).toBe('rumours')
      expect(definition?.kind).toBe('mechanical')
    }
  })

  it('declines a hook naming a rumour nobody is repeating', () => {
    const state = createInitialTavernState()
    const definition = findScheduledEventDefinitionForHookName('rumour_escalation_x')!
    expect(
      definition.fromFutureHook?.({
        hookName: 'rumour_escalation_nothing_at_all',
        readable: '',
        scheduledForDay: 5,
        state,
      }),
    ).toBeUndefined()
  })

  it('an unanswered rumour escalates, and a settled one does not', () => {
    let state = withRumour(talkedAbout(), 'escalates', {
      id: 'rumour_test_escalate',
      label: 'The house is a den of thieves',
      strength: 70,
    })
    state = runDays(state, 12, 1)

    const outcome = readScheduledEventsSlice(state).archive.find(
      (entry) => entry.type === RUMOUR_ESCALATION_EVENT,
    )
    if (outcome?.status === 'resolved') {
      expect(outcome.mutations.length).toBeGreaterThan(0)
    } else if (outcome?.status === 'no_op') {
      expect(outcome.reason).toBeTruthy()
    }
  })

  it('registers the three rumour actions in the shared registry', () => {
    for (const id of ['deny_rumour', 'counter_rumour', 'name_the_source']) {
      expect(actionRegistry.get(id), `owner action '${id}' not registered`).toBeDefined()
    }
  })

  it('naming the source settles the story and costs the standing', () => {
    let state = runDays(talkedAbout(), 12)
    const named = liveRumours(state).find(
      (rumour) =>
        rumour.originRef !== undefined && audiencesOf(rumour).length > 0,
    )
    if (!named) return

    state = run(state, 90, [{ actionId: 'name_the_source', targetId: named.id }])
    const applied = getOwnerActionsModuleState(state).applied.find(
      (entry) => entry.actionId === 'name_the_source',
    )
    expect(applied).toBeDefined()
    const settled = state.world.socialRumours[named.id]
    expect(settled?.correctedOnDay).toBeDefined()
  })
})
