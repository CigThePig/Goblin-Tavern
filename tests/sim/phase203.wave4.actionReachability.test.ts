// Phase 203 / gameplay audit Wave 4 — action reachability and contextual
// transfer.
//
// Regression coverage for the sim half of the wave's five findings and its
// gate (audit Phase 8 §7). Plan:
// docs/plans/phase-203-audit-wave-4-action-reachability.md.
//
//   P3-BHV-001  policy toggle targets (the queue half is in the web file)
//   P3-BHV-002  expedition commissioning is unreachable from both normal
//               entry points, and would not have queued if it were
//   P6-COMP-005  "Spend owner time on the licence" advances the venture
//               without spending or naming any time
//
// `P5-PLAY-001` and `P7-EXP-006` are store/surface findings and live in
// tests/web/phase203.wave4.planningHorizon.test.ts.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import type { SimInput } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import {
  actionDisabledReason,
  actionDisabledReasonForInput,
  actionDisabledReasonForTarget,
  listValidTargets,
} from '../../src/sim/modules/ownerActions/readonlyHelpers'
import {
  DAY_MINUTES,
  TIME_COST_SHORT,
  getOwnerActionsModuleState,
} from '../../src/sim/modules/ownerActions/stateHelpers'
import {
  COMMISSION_EXPEDITION_ACTION_ID,
  SUPPLY_UNIT_COST,
} from '../../src/sim/modules/expeditions/commissionExpedition'
import { routeFor } from '../../src/sim/modules/expeditions/journey'
import { routeProvisionsNeeded } from '../../src/sim/content/expeditions/expeditionRoutes'
import {
  createLiquorLicenseVenture,
  LIQUOR_LICENSE_VENTURE_ID,
} from '../../src/sim/modules/ventures/liquorLicense'
import { ownerTimeCostOfSlot } from '../../src/sim/modules/responses/responseCost'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'

const SEED = 'phase203-wave4'

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function runDay(state: TavernState, overrides: Partial<SimInput> = {}) {
  return simulateDay(state, input(overrides), FULL_PIPELINE)
}

function freshState(): TavernState {
  return createInitialTavernState()
}

/** The day-clock ledger the whole wave's time contract is written against. */
function timeSpent(state: TavernState): number {
  return getOwnerActionsModuleState(state).timeSpent
}

// ── P3-BHV-001 — policy toggles name one policy ─────────────────────

describe('P3-BHV-001 — a policy toggle targets its own policy', () => {
  it('offers exactly its own policy as a valid target', () => {
    const state = freshState()
    const def = actionRegistry.get('enable_cheap_payday_specials')
    const targets = listValidTargets(def, state)
    // The definition closes over one starter. Listing the other six was a
    // target list that could never be valid, which is what made "invalid
    // target" meaningless on the inline route.
    expect(targets.map((t) => t.id)).toEqual(['cheap_payday_specials'])
  })

  it('accepts its own policy and rejects another policy as the target', () => {
    const state = freshState()
    const def = actionRegistry.get('enable_allow_tabs_for_regulars')
    expect(
      actionDisabledReasonForTarget(
        def,
        state,
        'allow_tabs_for_regulars',
        DAY_MINUTES,
      ),
    ).toBeUndefined()
    expect(
      actionDisabledReasonForTarget(def, state, 'refuse_tabs', DAY_MINUTES),
    ).toBe('invalid target')
  })

  it('queues and applies through a targeted payload', () => {
    const state = freshState()
    const result = runDay(state, {
      ownerActions: [
        {
          actionId: 'enable_allow_tabs_for_regulars',
          targetId: 'allow_tabs_for_regulars',
        },
      ],
    })
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.policies['allow_tabs_for_regulars']?.enabled).toBe(true)
  })
})

// ── P3-BHV-002 — expedition commissioning is reachable ──────────────

describe('P3-BHV-002 — expedition commissioning opens and completes', () => {
  const def = () => actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID)

  function firstRunnerId(state: TavernState): string {
    const runner = Object.values(state.world.hireableAdventurers).find(
      (a) => a.currentExpeditionId === null && !a.activeFlags.includes('injured'),
    )
    if (!runner) throw new Error('no available runner on a fresh state')
    return runner.id
  }

  it('is eligible to open when an uninjured, unbusy runner exists', () => {
    const state = freshState()
    expect(
      Object.values(state.world.hireableAdventurers).length,
    ).toBeGreaterThan(0)
    // The audit's exact failure: Stock listed three available adventurers
    // and disabled the only form-opening button, because eligibility was
    // asked as `canApply({ actionId })` — an input the form has not been
    // filled in yet.
    expect(actionDisabledReason(def(), state, DAY_MINUTES)).toBeUndefined()
  })

  it('declares the composer that owns its full input', () => {
    // A generic two-level picker cannot enumerate runner × mode × duration
    // × tier; the definition says so rather than the UI guessing.
    expect(def().composer).toBe('expedition')
  })

  it('is not eligible to open when every runner is busy or injured', () => {
    const state = freshState()
    const adventurers = { ...state.world.hireableAdventurers }
    for (const id of Object.keys(adventurers)) {
      adventurers[id] = {
        ...adventurers[id]!,
        activeFlags: [...adventurers[id]!.activeFlags, 'injured'],
      }
    }
    const blocked: TavernState = {
      ...state,
      world: { ...state.world, hireableAdventurers: adventurers },
    }
    expect(actionDisabledReason(def(), blocked, DAY_MINUTES)).toBeDefined()
  })

  it('validates the completed commission the player actually specified', () => {
    const state = freshState()
    const runnerId = firstRunnerId(state)
    // Before the fix this returned "commission_expedition requires a
    // runner targetId" — the queue validated the definition generically
    // and threw the player's own payload away.
    expect(
      actionDisabledReasonForInput(
        def(),
        state,
        {
          actionId: COMMISSION_EXPEDITION_ACTION_ID,
          targetId: runnerId,
          options: { mode: 'open', daysTotal: 2, targetTier: 'uncommon' },
        },
        DAY_MINUTES,
      ),
    ).toBeUndefined()
    // An incomplete payload is still refused, with its own reason.
    expect(
      actionDisabledReasonForInput(
        def(),
        state,
        { actionId: COMMISSION_EXPEDITION_ACTION_ID, targetId: runnerId },
        DAY_MINUTES,
      ),
    ).toBeDefined()
  })

  it('commissions, marks the runner busy, spends coin and completes', () => {
    let state = freshState()
    state = { ...state, coin: 500 }
    const runnerId = firstRunnerId(state)
    const wageBase = state.world.hireableAdventurers[runnerId]!.wageBase

    const commissioned = runDay(state, {
      ownerActions: [
        {
          actionId: COMMISSION_EXPEDITION_ACTION_ID,
          targetId: runnerId,
          options: { mode: 'open', daysTotal: 2, targetTier: 'uncommon' },
        },
      ],
    })
    state = commissioned.state

    const active = state.expeditions.active
    expect(active.length).toBe(1)
    const expedition = active[0]!
    expect(expedition.runnerId).toBe(runnerId)
    // Phase 77 / ISSUE-037 — the cost is the runner's wage, not a
    // free-form amount, and it is actually taken out of the till.
    // Expansion Phase 9 §9.3 — the duration is the ROUTE's, not a number
    // the payload typed: an uncommon target defaults to the Market Road,
    // five days there and back, and the loadout is bought on top of the
    // wage rather than assumed into it.
    expect(expedition.daysTotal).toBe(5)
    expect(expedition.costPaid).toBe(
      wageBase * expedition.daysTotal +
        routeProvisionsNeeded(routeFor('market_road')!, 1) * SUPPLY_UNIT_COST,
    )
    expect(
      state.causes.some(
        (c) =>
          c.source === `expedition.commission.${expedition.id}` ||
          c.tags.includes(expedition.id),
      ),
    ).toBe(true)
    expect(state.world.hireableAdventurers[runnerId]?.currentExpeditionId).toBe(
      expedition.id,
    )
    expect(safeValidateState(state).success).toBe(true)

    // Run it out. The route's own duration decides when, so sweep past it
    // rather than counting; the assertion is that it completes NATURALLY.
    for (let i = 0; i < 12 && state.expeditions.active.length > 0; i += 1) {
      state = runDay(state, { seed: `${SEED}-day-${i}` }).state
    }

    expect(state.expeditions.active.length).toBe(0)
    expect(state.expeditions.completed.length).toBe(1)
    const finished = state.expeditions.completed[0]!
    expect(finished.id).toBe(expedition.id)
    expect(finished.resolvedDay).toBeGreaterThan(0)
    // The runner is released back to the roster either way the trip went.
    expect(
      state.world.hireableAdventurers[runnerId]?.currentExpeditionId,
    ).toBeNull()
    expect(safeValidateState(state).success).toBe(true)
  })
})

// ── Expansion Phase 9 — composite-target actions open ───────────────

describe('Expansion Phase 9 — an action with its own target list opens', () => {
  // The same failure `P3-BHV-002` found, one arc later and eight actions
  // wide. An action that declares `global` is read by every picker as
  // "takes no target", so `actionDisabledReason` asks `canApply` with an
  // empty input, gets `missing_target` back, and leaves the row disabled
  // with its target list never opened. Phase 9 added eight actions that
  // take a composite target — an arc plus one of its interventions, a
  // condition plus one of its counter-moves, a party plus the option they
  // are waiting on — and every one of them declared `global`, which put
  // most of the arc's player counterplay out of reach through the UI.
  const COMPOSITE_ACTIONS = [
    'intervene_in_arc',
    'settle_arc',
    'prepare_for_condition',
    'counter_condition',
    'exploit_condition',
    'answer_expedition_dispatch',
    'recall_expedition',
    'send_relief_to_expedition',
  ]

  it('declares a target type the picker will walk targets for', () => {
    for (const id of COMPOSITE_ACTIONS) {
      const def = actionRegistry.get(id)
      expect(def.targetType, id).toBe('composite')
      expect(def.getValidTargets, id).toBeDefined()
    }
  })

  it('never reports missing_target as the reason a row is disabled', () => {
    // `missing_target` is what an unfilled form says about itself. Surfaced
    // as a row's disabled reason it means the picker asked the wrong
    // question, and the row can never be enabled however the world looks.
    const state = freshState()
    for (const id of COMPOSITE_ACTIONS) {
      const reason = actionDisabledReason(actionRegistry.get(id), state, DAY_MINUTES)
      expect(reason ?? '', id).not.toMatch(/targetId|missing target/i)
    }
  })

  it('enables the row once the world offers something to act on', () => {
    // Played far enough that at least one arc is live, so `intervene_in_arc`
    // has real targets. Reached by playing rather than by injection.
    let state = { ...freshState(), coin: 9000 }
    for (let day = 0; day < 60; day += 1) {
      state = runDay(state, { seed: `${SEED}-composite-${day}` }).state
    }
    const withTargets = COMPOSITE_ACTIONS.filter(
      (id) => listValidTargets(actionRegistry.get(id), state).length > 0,
    )
    expect(withTargets.length, 'nothing was on offer after two months').toBeGreaterThan(0)
    for (const id of withTargets) {
      expect(
        actionDisabledReason(actionRegistry.get(id), state, DAY_MINUTES),
        id,
      ).toBeUndefined()
    }
  })
})

// ── P6-COMP-005 — owner time is named, spent and enforced ───────────

describe('P6-COMP-005 — an owner-time claim costs owner time', () => {
  /**
   * An active liquor licence plus the cause that explains why the card
   * appeared — the generator refuses to surface a seed it cannot justify,
   * so a bare venture entry produces nothing.
   */
  function withLicence(state: TavernState): TavernState {
    return {
      ...state,
      ventures: {
        ...state.ventures,
        [LIQUOR_LICENSE_VENTURE_ID]: createLiquorLicenseVenture(0),
      },
      causes: [
        ...state.causes,
        {
          id: 'cause-licence-opened',
          timestamp: {
            ...state.calendar,
            absoluteDay: state.calendar.totalDaysElapsed,
          },
          source: 'test.licence',
          sourceType: 'system',
          target: LIQUOR_LICENSE_VENTURE_ID,
          targetType: 'global',
          amount: 1,
          direction: 'increase',
          weight: 10,
          readable: 'The licence paperwork is open.',
          tags: ['teleology', 'venture', LIQUOR_LICENSE_VENTURE_ID],
          relatedActors: [],
          relatedLocations: [],
          relatedSystems: ['ventures'],
          ageDays: 0,
        },
      ],
    }
  }

  function licenceSeed(state: TavernState) {
    const seeds = getIssueSeeds(state)
    const seed = seeds.find((s) => s.family === 'venture')
    if (!seed) throw new Error('no venture seed generated')
    return seed
  }

  function investIntent(seedId: string): ResponseIntent {
    return {
      id: 'intent-licence',
      seedId,
      verb: 'upgrade',
      shape: 'long_term_investment',
      tags: ['teleology', 'venture'],
      intensity: 1,
      metadata: {
        responseSlotId: 'invest_owner_time',
        selectionLabel: 'Spend owner time on the licence',
      },
    }
  }

  it('prices the slot in minutes from the profile itself', () => {
    const opened = runDay(withLicence(freshState()))
    const seed = licenceSeed(opened.state)
    // The card preview, the selection gate and the applier all read this
    // one number — the audit's failure was that no number existed.
    expect(ownerTimeCostOfSlot(seed, 'invest_owner_time')).toBe(TIME_COST_SHORT)
    expect(ownerTimeCostOfSlot(seed, 'set_aside')).toBe(0)
  })

  it('spends the time it claims and still advances the venture', () => {
    const base = withLicence(freshState())
    const opened = runDay(base)
    const seed = licenceSeed(opened.state)

    const result = runDay(base, {
      responseIntents: [investIntent(seed.id)],
    })
    const venture = result.state.ventures[LIQUOR_LICENSE_VENTURE_ID]
    expect(venture?.progress).toBe(1)
    // Before the fix this stayed 0 — `global.owner_time` fell through
    // every branch of the applier.
    expect(timeSpent(result.state)).toBe(TIME_COST_SHORT)
    expect(timeSpent(result.state)).toBeLessThanOrEqual(
      getOwnerActionsModuleState(result.state).timeBudget,
    )
    expect(safeValidateState(result.state).success).toBe(true)
  })

  it('skips the choice WHOLE when the day has no time left for it', () => {
    const base = withLicence(freshState())
    const opened = runDay(base)
    const seed = licenceSeed(opened.state)

    // Fill the day with owner actions first (Segment B writes `timeSpent`
    // before Segment C applies responses), leaving under an hour: two
    // 4h/2h chores on distinct targets take 5h30m of the 6h day.
    const result = runDay(base, {
      ownerActions: [
        { actionId: 'patch_roof', targetId: 'roof' },
        { actionId: 'clean_area', targetId: 'main_room' },
        { actionId: 'buy_mugs', targetId: 'mugs' },
      ],
      responseIntents: [investIntent(seed.id)],
    })

    const slice = getOwnerActionsModuleState(result.state)
    // The three chores really do fill the day, so the branch under test
    // is the one that runs.
    expect(slice.timeBudget - slice.timeSpent).toBeLessThan(TIME_COST_SHORT)
    // DC-07's rule, applied to time: nothing partial. The venture does not
    // advance, and the day clock never overruns.
    expect(result.state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.progress).toBe(0)
    expect(slice.timeSpent).toBeLessThanOrEqual(slice.timeBudget)
    // …and the player is told, rather than the choice vanishing.
    const responses = result.state.modules['responses'] as {
      resolvedToday?: { outcome?: string; note?: string }[]
    }
    const skipped = (responses.resolvedToday ?? []).find(
      (r) => r.outcome === 'skipped_unaffordable',
    )
    expect(skipped?.note).toMatch(/of your day/)
    expect(safeValidateState(result.state).success).toBe(true)
  })

  it('holds timeSpent <= timeBudget across a multi-day run', () => {
    let state = withLicence(freshState())
    for (let day = 0; day < 6; day += 1) {
      const opened = runDay(state, { seed: `${SEED}-clock-${day}` })
      const seed = getIssueSeeds(opened.state).find((s) => s.family === 'venture')
      const intents = seed ? [investIntent(seed.id)] : []
      const result = runDay(state, {
        seed: `${SEED}-clock-${day}`,
        responseIntents: intents,
      })
      state = result.state
      const slice = getOwnerActionsModuleState(state)
      expect(slice.timeSpent).toBeLessThanOrEqual(slice.timeBudget)
      expect(safeValidateState(state).success).toBe(true)
    }
  })
})
