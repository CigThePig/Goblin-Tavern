// Expansion Phase 9 §9.2 (repo phase 216) / ISSUE-179 — local arcs stop
// being things that age and start being things that happen.
//
// WHAT WAS BROKEN. A Phase 35 arc had `progressRules` keyed on `afterDays`,
// ticked once a month, and walked `seeded → rising → active → climax →
// resolved` on a fixed clock. Nothing in the world could hurry it, slow it,
// win it or lose it: the mushroom blight resolved on day 84 whether the
// cellar was spotless or crawling, and the player's only relationship with
// it was reading about it.
//
// §9.2 lists eleven things an arc must support. The honest summary of what
// was missing is that an arc had no GOAL and no OWNER — without a goal there
// is nothing to succeed or fail at, and without an owner there is nobody for
// a player intervention to push against. This file checks all eleven, plus
// the catalog-coverage requirement, against arcs reached by playing.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { withArea, withCoin, withStock } from '../../src/sim/testing/stateFactories'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/registries/actionRegistry'
import { localArcRegistry } from '../../src/sim/content/events/localArcRegistry'
import {
  CLOSED_ARC_RUN_RETENTION_DAYS,
  MAX_ARC_RUNS_KEPT,
  MAX_ARC_RUN_HISTORY,
  type ArcShape,
} from '../../src/sim/content/events/localArcTypes'
import {
  SETTLEMENT_MARGIN,
  availableInterventions,
  canSettleArc,
  getArcRun,
  getArcRunTotals,
  getArcRuns,
  hasStateGate,
  liveArcRuns,
  progressionFor,
  pruneArcRuns,
  resolveArcOwner,
  stageFor,
  unmetConditions,
  type ArcRun,
} from '../../src/sim/modules/localArcs/index'

const SEED = 'phase216/local-arcs'

function run(
  state: TavernState,
  day: number,
  ownerActions: NonNullable<SimInput['ownerActions']> = [],
): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

/** A house with enough going wrong that arcs have something to seed off. */
function troubledHouse(coin = 6000): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 900, spoilage: 0 })
  }
  state = withArea(state, 'main_room', { cleanliness: 5, damage: 70, smell: 90 })
  state = withArea(state, 'kitchen', { cleanliness: 5, damage: 40, smell: 95 })
  state = withArea(state, 'cellar', { cleanliness: 10, smell: 80 })
  return state
}

/** Play `days`, never touching an arc. */
function ignoringArcs(state: TavernState, days: number): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, day)
  return current
}

/** Play `days`, taking up to `perDay` of whatever each arc offers. */
function fightingArcs(state: TavernState, days: number, perDay = 2): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) {
    const offers = availableInterventions(current)
      .filter((offer) => offer.blockedReason === undefined)
      .slice(0, perDay)
    current = run(
      current,
      day,
      offers.map((offer) => ({
        actionId: 'intervene_in_arc',
        targetId: `${offer.arcId}:${offer.intervention.id}`,
      })),
    )
  }
  return current
}

/**
 * Play `days`, taking one intervention every fifth day.
 *
 * The interesting strategy: enough to keep pace with the owner on some arcs
 * and fall behind on others, without pulling decisively ahead anywhere. That
 * is where §9.2's compromise band lives, and a catalog in which it were
 * unreachable would have only two outcomes wearing three names. A house that
 * intervenes more often than this wins outright; one that intervenes less
 * loses outright; both are also what you would expect.
 */
function halfHeartedArcs(state: TavernState, days: number): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) {
    const offers =
      day % 5 === 0
        ? availableInterventions(current)
            .filter((offer) => offer.blockedReason === undefined)
            .slice(0, 1)
        : []
    current = run(
      current,
      day,
      offers.map((offer) => ({
        actionId: 'intervene_in_arc',
        targetId: `${offer.arcId}:${offer.intervention.id}`,
      })),
    )
  }
  return current
}

describe('Phase 216 §9.2 — the catalog covers eight materially different shapes', () => {
  const definitions = [...localArcRegistry.all()]

  it('gives every shipped definition a goal, an owner and stages', () => {
    for (const definition of definitions) {
      const progression = definition.progression
      expect(progression, `${definition.id} has no progression`).toBeDefined()
      expect(progression!.goal.length, definition.id).toBeGreaterThan(10)
      expect(progression!.stages.length, definition.id).toBeGreaterThanOrEqual(3)
      expect(progression!.interventions.length, definition.id).toBeGreaterThan(0)
      expect(progression!.opposingMoves.length, definition.id).toBeGreaterThan(0)
    }
  })

  it('collectively exercises all eight shapes §9.2 names', () => {
    const required: ArcShape[] = [
      'state_driven_crisis',
      'faction_conflict',
      'market_disruption',
      'cultural_event',
      'rival_move',
      'regulatory_event',
      'recovery',
      'transformation',
    ]
    const present = new Set(
      definitions.map((definition) => definition.progression?.shape).filter(Boolean),
    )
    for (const shape of required) {
      expect([...present], `no definition has shape '${shape}'`).toContain(shape)
    }
  })

  it('migrated the five that existed rather than duplicating them', () => {
    for (const id of [
      'mushroom_blight',
      'miner_payday_boom',
      'inspection_campaign',
      'rival_tavern_expansion',
      'festival_approaching',
    ]) {
      expect(localArcRegistry.has(id), id).toBe(true)
      expect(localArcRegistry.get(id).progression, `${id} was not migrated`).toBeDefined()
    }
    // And nothing was forked into a parallel "v2" definition.
    const ids = definitions.map((definition) => definition.id)
    expect(ids.filter((id) => id.endsWith('_v2'))).toEqual([])
  })

  it('names every stage a branch or a timeout points at', () => {
    for (const definition of definitions) {
      const progression = definition.progression
      if (!progression) continue
      const ids = new Set(progression.stages.map((stage) => stage.id))
      for (const stage of progression.stages) {
        if (stage.next) expect(ids, `${definition.id}:${stage.id}.next`).toContain(stage.next)
        if (stage.onTimeout) {
          expect(ids, `${definition.id}:${stage.id}.onTimeout`).toContain(stage.onTimeout)
        }
        for (const branch of stage.branches ?? []) {
          expect(ids, `${definition.id}:${stage.id} branch`).toContain(branch.toStage)
        }
      }
      // Every arc declares all three outcomes, because any of the three can
      // be reached: two through named terminal stages, and the third when a
      // stage runs out and the margin decides.
      expect(Object.keys(progression.outcomes).sort(), definition.id).toEqual([
        'compromise',
        'failure',
        'success',
      ])
      const terminal = progression.stages.filter(
        (stage) =>
          stage.outcome !== undefined ||
          (stage.next === undefined && (stage.branches ?? []).length === 0),
      )
      expect(terminal.length, `${definition.id} can never end`).toBeGreaterThanOrEqual(2)
    }
  })

  it('gives a timeout somewhere on every arc, so nothing sits forever', () => {
    for (const definition of definitions) {
      const progression = definition.progression
      if (!progression) continue
      const timed = progression.stages.filter((stage) => stage.timeoutDays !== undefined)
      expect(timed.length, `${definition.id} has no stage that can time out`).toBeGreaterThan(0)
    }
  })
})

describe('Phase 216 §9.2 — arcs progress on state and on moves, not on age', () => {
  it('opens a run with an owner as soon as an arc appears', () => {
    let state = troubledHouse()
    let opened: ArcRun | undefined
    for (let day = 0; day < 40 && !opened; day += 1) {
      state = run(state, day)
      opened = liveArcRuns(state)[0]
    }
    expect(opened, 'no arc ever started in six weeks').toBeDefined()
    expect(opened!.ownerRef, 'the arc has nobody driving it').toBeDefined()
    expect(opened!.ownerLabel!.length).toBeGreaterThan(2)
    expect(opened!.goalProgress).toBe(0)
    expect(opened!.history.length).toBeGreaterThan(0)
  })

  it('moves an arc on days that are not month ends', () => {
    // The Phase 35 engine only touched arcs at `endMonth`. If nothing moves
    // between month boundaries, §9.2's headline requirement is not met.
    let state = troubledHouse()
    for (let day = 0; day < 12; day += 1) state = run(state, day)
    const before = liveArcRuns(state)
    expect(before.length, 'no arc to observe').toBeGreaterThan(0)

    const snapshot = before.map((entry) => `${entry.stageId}:${entry.opposition}`)
    let moved = false
    for (let day = 12; day < 24 && !moved; day += 1) {
      state = run(state, day)
      // Deliberately excludes month-end days: 28-day months, so days 12..23
      // are all mid-month.
      const now = liveArcRuns(state).map((entry) => `${entry.stageId}:${entry.opposition}`)
      if (JSON.stringify(now) !== JSON.stringify(snapshot)) moved = true
    }
    expect(moved, 'nothing about any arc changed for a fortnight mid-month').toBe(true)
  })

  it('lets the owner push back on its own cadence', () => {
    const state = ignoringArcs(troubledHouse(), 30)
    const totals = getArcRunTotals(state)
    expect(totals.opposingMovesMade, 'nobody ever pushed back').toBeGreaterThan(0)
    for (const entry of Object.values(getArcRuns(state))) {
      if (entry.opposition <= 0) continue
      expect(
        entry.history.some((line) => line.note.length > 0),
        'opposition rose with nothing recorded about it',
      ).toBe(true)
    }
  })

  it('resolves state-driven arcs off live state rather than a die roll', () => {
    const sickness = localArcRegistry.get('sickness_in_the_quarter')
    expect(hasStateGate(sickness)).toBe(true)
    const festival = localArcRegistry.get('festival_approaching')
    expect(hasStateGate(festival)).toBe(false)

    // A clean house cannot seed the sickness arc at all: its start gate is
    // live food-safety pressure, so there has to have been a real failure.
    let clean = withCoin(createInitialTavernState(), 3000)
    for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
      clean = withStock(clean, id, { quantity: 600, spoilage: 0 })
    }
    for (const id of ['main_room', 'kitchen', 'cellar']) {
      clean = withArea(clean, id, { cleanliness: 95, damage: 0, smell: 2 })
    }
    const early = run(clean, 0)
    expect(
      Object.values(getArcRuns(early)).some(
        (entry) => entry.definitionId === 'sickness_in_the_quarter',
      ),
    ).toBe(false)
  })

  it('picks the same owner twice from the same world', () => {
    const state = ignoringArcs(troubledHouse(), 20)
    const blight = localArcRegistry.get('mushroom_blight').progression!
    const a = resolveArcOwner(state, blight.owner)
    const b = resolveArcOwner(state, blight.owner)
    expect(b).toEqual(a)
  })
})

describe('Phase 216 §9.2 — the player has moves, and they decide it', () => {
  it('registers the two arc actions', () => {
    ensureRequiredOwnerActionsRegistered()
    expect(actionRegistry.has('intervene_in_arc')).toBe(true)
    expect(actionRegistry.has('settle_arc')).toBe(true)
  })

  it('offers only what the arc itself declares, with its costs', () => {
    const state = ignoringArcs(troubledHouse(), 25)
    const offers = availableInterventions(state)
    expect(offers.length, 'nothing was on offer for any live arc').toBeGreaterThan(0)
    for (const offer of offers) {
      const progression = progressionFor(
        getArcRun(state, offer.arcId)!.definitionId,
      )!
      expect(
        progression.interventions.map((entry) => entry.id),
        `${offer.intervention.id} is not one of that arc's moves`,
      ).toContain(offer.intervention.id)
    }
  })

  it('moves the arc when the player acts, and records that it was done', () => {
    let state = ignoringArcs(troubledHouse(), 22)
    const offer = availableInterventions(state).find(
      (entry) => entry.blockedReason === undefined,
    )
    expect(offer, 'nothing was available to do').toBeDefined()
    const before = getArcRun(state, offer!.arcId)!.goalProgress

    state = run(state, 100, [
      {
        actionId: 'intervene_in_arc',
        targetId: `${offer!.arcId}:${offer!.intervention.id}`,
      },
    ])
    const after = getArcRun(state, offer!.arcId)
    expect(after, 'the arc vanished').toBeDefined()
    expect(after!.goalProgress).toBeGreaterThan(before)
    expect(
      after!.interventions.map((entry) => entry.interventionId),
    ).toContain(offer!.intervention.id)
    expect(getArcRunTotals(state).interventionsTaken).toBeGreaterThan(0)
  })

  it('turns arcs the player fights into a different set of outcomes', () => {
    // The whole §9.2 thesis in one assertion: the same world, played two
    // ways, ends with materially different arc results.
    const ignored = getArcRunTotals(ignoringArcs(troubledHouse(), 80))
    const fought = getArcRunTotals(fightingArcs(troubledHouse(), 80))

    expect(fought.interventionsTaken).toBeGreaterThan(0)
    expect(ignored.interventionsTaken).toBe(0)
    expect(
      fought.runsSucceeded,
      'fighting every arc for eleven weeks won no more than ignoring them',
    ).toBeGreaterThan(ignored.runsSucceeded)
    expect(ignored.runsFailed).toBeGreaterThan(0)
  })

  it('refuses an intervention the arc is not offering', () => {
    let state = ignoringArcs(troubledHouse(), 22)
    const live = liveArcRuns(state)[0]
    expect(live, 'no live arc').toBeDefined()
    state = run(state, 100, [
      { actionId: 'intervene_in_arc', targetId: `${live!.arcId}:not_a_real_move` },
    ])
    const rejected = (
      state.modules['ownerActions'] as { rejected: Array<{ code: string }> }
    ).rejected
    expect(rejected.some((entry) => entry.code === 'unknown_intervention')).toBe(true)
  })

  it('only lets a close-run arc be settled', () => {
    const state = ignoringArcs(troubledHouse(), 45)
    for (const entry of liveArcRuns(state)) {
      const blocked = canSettleArc(state, entry.arcId)
      const margin = Math.abs(entry.goalProgress - entry.opposition)
      if (margin > SETTLEMENT_MARGIN) {
        expect(blocked, `${entry.arcId} should not be settleable`).toBeDefined()
      } else {
        expect(blocked, `${entry.arcId} should be settleable`).toBeUndefined()
      }
    }
  })

  it('settles a close arc as a compromise rather than a win or a loss', () => {
    let state = troubledHouse()
    let settled = false
    for (let day = 0; day < 60 && !settled; day += 1) {
      const candidate = liveArcRuns(state).find(
        (entry) => canSettleArc(state, entry.arcId) === undefined,
      )
      state = run(
        state,
        day,
        candidate ? [{ actionId: 'settle_arc', targetId: candidate.arcId }] : [],
      )
      if (candidate) {
        const after = getArcRun(state, candidate.arcId)
        if (after?.outcome === 'compromise') settled = true
      }
    }
    expect(settled, 'no arc was ever close enough to settle in two months').toBe(true)
    expect(getArcRunTotals(state).settlementsAgreed).toBeGreaterThan(0)
  })
})

describe('Phase 216 §9.2 — outcomes, aftermath and what the world keeps', () => {
  it('reaches success, failure and compromise across real play', () => {
    // Three outcomes, three ways of playing. A compromise is the middle
    // band, so it wants a house that fought some arcs and not others —
    // which is what a half-hearted strategy produces without being told to.
    const outcomes = new Set<string>()
    for (const state of [
      fightingArcs(troubledHouse(), 80),
      ignoringArcs(troubledHouse(), 80),
      halfHeartedArcs(troubledHouse(), 80),
    ]) {
      for (const entry of Object.values(getArcRuns(state))) {
        if (entry.outcome) outcomes.add(entry.outcome)
      }
    }
    expect(
      [...outcomes].sort(),
      `only reached ${[...outcomes].join(', ')}`,
    ).toEqual(['compromise', 'failure', 'success'])
  })

  it('leaves a permanent change behind, and the world keeps it', () => {
    const state = fightingArcs(troubledHouse(), 80)
    const applied = Object.values(getArcRuns(state)).flatMap(
      (entry) => entry.permanentChanges,
    )
    expect(applied.length, 'no arc left anything behind').toBeGreaterThan(0)
    expect(getArcRunTotals(state).permanentChangesApplied).toBeGreaterThan(0)

    for (const key of applied) {
      if (key.startsWith('area_trait:')) {
        const [, areaId, trait] = key.split(':')
        expect(state.areas[areaId!]!.traits).toContain(trait)
      }
      if (key.startsWith('identity_known_for:')) {
        const label = key.slice('identity_known_for:'.length)
        // The identity module rebuilds `knownFor` every morning; an earned
        // label has to survive that, or it was never permanent.
        expect(state.world.tavernIdentity.knownFor).toContain(label)
      }
      if (key.startsWith('house_rule:')) {
        const label = key.slice('house_rule:'.length)
        expect(state.world.tavernIdentity.houseRules).toContain(label)
      }
    }
  })

  it('keeps an earned identity label through days of recomputation', () => {
    let state = ignoringArcs(troubledHouse(), 60)
    const earned = Object.values(getArcRuns(state))
      .flatMap((entry) => entry.permanentChanges)
      .filter((key) => key.startsWith('identity_known_for:'))
    if (earned.length === 0) return
    const label = earned[0]!.slice('identity_known_for:'.length)
    expect(state.world.tavernIdentity.knownFor).toContain(label)
    for (let day = 60; day < 75; day += 1) state = run(state, day)
    expect(
      state.world.tavernIdentity.knownFor,
      'an arc-earned label was recomputed away',
    ).toContain(label)
  })

  it('sets a cooldown when an arc closes, and a long one for a once-only arc', () => {
    const road = localArcRegistry.get('the_road_moves').progression!
    expect(road.recurrence).toBe('once_per_run')
    const blight = localArcRegistry.get('mushroom_blight').progression!
    expect(blight.recurrence).toBe('recurring')

    const state = ignoringArcs(troubledHouse(), 80)
    const slice = state.modules['localArcs'] as { cooldowns: Record<string, number> }
    const closed = Object.values(getArcRuns(state)).filter(
      (entry) => entry.outcome !== undefined,
    )
    for (const entry of closed) {
      expect(
        slice.cooldowns[entry.definitionId],
        `${entry.definitionId} closed with no cooldown`,
      ).toBeGreaterThan(entry.closedOnDay!)
    }
  })
})

describe('Phase 216 §5.11 — the run book cannot grow without bound', () => {
  it('caps history per run and prunes the closed tail', () => {
    const state = ignoringArcs(troubledHouse(), 120)
    for (const entry of Object.values(getArcRuns(state))) {
      expect(entry.history.length).toBeLessThanOrEqual(MAX_ARC_RUN_HISTORY)
    }
    expect(Object.keys(getArcRuns(state)).length).toBeLessThanOrEqual(
      MAX_ARC_RUNS_KEPT + 3,
    )
  })

  it('drops a closed run once it is old enough, and never a live one', () => {
    const live: ArcRun = {
      arcId: 'arc:live',
      definitionId: 'mushroom_blight',
      stageId: 'spreading',
      stageEnteredDay: 10,
      startedOnDay: 5,
      goalProgress: 10,
      opposition: 10,
      opposingCooldowns: {},
      interventions: [],
      history: [],
      permanentChanges: [],
    }
    const stale: ArcRun = {
      ...live,
      arcId: 'arc:stale',
      outcome: 'failure',
      closedOnDay: 1,
    }
    const recent: ArcRun = {
      ...live,
      arcId: 'arc:recent',
      outcome: 'success',
      closedOnDay: 200,
    }
    const pruned = pruneArcRuns(
      { 'arc:live': live, 'arc:stale': stale, 'arc:recent': recent },
      200 + CLOSED_ARC_RUN_RETENTION_DAYS - 1,
    )
    expect(Object.keys(pruned).sort()).toEqual(['arc:live', 'arc:recent'])
  })
})

describe('Phase 216 §9.2 — the report gives the player a turn', () => {
  it('says what the goal is, how it stands, and what can be done', () => {
    let state = ignoringArcs(troubledHouse(), 25)
    const result = simulateDay(state, { seed: `${SEED}/report` }, FULL_PIPELINE)
    state = result.state
    const section = result.reports.find((entry) => entry.id === 'localArcs')
    if (liveArcRuns(state).length === 0) return
    expect(section, 'no arc section on a day with a live arc').toBeDefined()
    const text = section!.lines.join('\n')
    expect(text).toMatch(/In play:/)
    expect(text).toMatch(/goal:/)
    expect(text).toMatch(/standing at \d+ against \d+/)
  })

  it('says what is still in the way of the next stage', () => {
    const state = ignoringArcs(troubledHouse(), 25)
    const entry = liveArcRuns(state)[0]
    if (!entry) return
    const progression = progressionFor(entry.definitionId)!
    const stage = stageFor(progression, entry.stageId)!
    if (stage.advanceWhen.length === 0) return
    const unmet = unmetConditions(state, entry, stage.advanceWhen)
    for (const line of unmet) expect(line.length).toBeGreaterThan(2)
  })
})
