import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState, TeleologyEntry } from '../../src/sim/state/TavernState'
import type { IssueSeed, ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import {
  createSignatureBrewVenture,
  signatureBrewDefinition,
  SIGNATURE_BREW_TRANSFORMATION_ID,
  SIGNATURE_BREW_VENTURE_ID,
} from '../../src/sim/modules/ventures'
import {
  createStaffMasteryArc,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from '../../src/sim/modules/arcs'
import { MASTER_ON_STAFF_TRANSFORMATION_ID } from '../../src/sim/modules/teleologyCrossLinks'

// Phase 4c (teleology) — cross-pollination: arc ↔ venture / transformation.
//
// Direction 1 (arc → venture): a staff-mastery arc reaching `mastered`
// writes the `master_on_staff` transformation; the signature-brew venture's
// `refining → signature` milestone is gated on that fact, so an arc
// milestone UNLOCKS a venture stage.
//
// Direction 2 (venture → arc): the brew venture's "lean on the staff"
// response WOUNDS the linked arc's progress (a venture outcome reaching back
// into an arc). Both directions use real authored content; neither targets a
// pressure id.

const BREW = SIGNATURE_BREW_VENTURE_ID
const ARC = STAFF_MASTERY_ARC_ID

function run(state: TavernState, extra: Record<string, unknown> = {}) {
  return simulateDay(state, { seed: 'teleology-phase-4c', ...extra }, FULL_PIPELINE)
}

function seedsOf(state: TavernState): IssueSeed[] {
  return (state.modules.issueSeeds as { seedsToday: IssueSeed[] }).seedsToday
}

function brewSeed(state: TavernState): IssueSeed | undefined {
  return seedsOf(state).find(
    (s) => s.family === 'venture' && s.primaryActor?.id === `venture:${BREW}`,
  )
}

function withMasterOnStaff(state: TavernState): TavernState {
  return {
    ...state,
    transformations: {
      ...state.transformations,
      [MASTER_ON_STAFF_TRANSFORMATION_ID]: {
        id: MASTER_ON_STAFF_TRANSFORMATION_ID,
        label: 'A master on the staff',
        active: true,
        tags: ['master_on_staff', 'staff_mastery', 'ratchet'],
        createdAtDay: 0,
        activatedAtDay: 0,
      },
    },
  }
}

/** A state with the brew venture pre-seeded at a chosen stage/progress. */
function stateWithBrew(stage: string, progress: number): TavernState {
  const state = createInitialTavernState()
  state.ventures[BREW] = { ...createSignatureBrewVenture(0), stage, progress }
  return state
}

/** A state with the brew venture AND a dormant active staff arc (loyalty
 *  pinned below the growth floor so the autonomous tick neither accrues nor
 *  advances it during a single test day — isolating the venture→arc wound). */
function stateWithBrewAndDormantArc(arcProgress: number): TavernState {
  const state = stateWithBrew('recipe', 0)
  const subject = state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]!
  state.staff[STAFF_MASTERY_ARC_SUBJECT_ID] = {
    ...subject,
    loyalty: 20, // below GROWTH_FLOOR_LOYALTY (30): no accrual, no advance
    castAttributes: { ...subject.castAttributes!, arcId: ARC },
  }
  state.arcs[ARC] = { ...createStaffMasteryArc("Mira's path", 0), stage: 'steady', progress: arcProgress }
  return state
}

function leanIntent(seedId: string): ResponseIntent {
  return {
    id: `intent_${seedId}`,
    seedId,
    verb: 'gamble',
    shape: 'risky_profitable',
    target: { kind: 'system', id: `venture:${BREW}` },
    tags: ['teleology', 'venture'],
    intensity: 1,
    metadata: { responseSlotId: 'lean_on_staff' },
  }
}

describe('teleology phase 4c — cross-pollination', () => {
  it('arc → venture: the brew venture is BLOCKED at refining until master_on_staff is active', () => {
    // Progress requirement met, but the arc-produced transformation is absent
    // → the milestone does not resolve → the venture holds at `refining`.
    const blocked = run(stateWithBrew('refining', 2))
    expect(blocked.state.ventures[BREW]?.stage).toBe('refining')
    expect(blocked.state.ventures[BREW]?.status).toBe('active')
  })

  it('arc → venture: once master_on_staff is active the venture advances to signature (terminal) and writes its ratchet', () => {
    const unlocked = run(withMasterOnStaff(stateWithBrew('refining', 2)))
    const venture = unlocked.state.ventures[BREW]!
    expect(venture.stage).toBe('signature')
    expect(venture.status).toBe('completed')
    // The venture's own payoff fact persists (venture → transformation).
    expect(unlocked.state.transformations[SIGNATURE_BREW_TRANSFORMATION_ID]?.active).toBe(true)
    // A cause attributes the advancement, and never targets a pressure.
    const advance = unlocked.state.causes.filter(
      (c) => c.tags.includes('teleology') && c.tags.includes('advance') && c.tags.includes(BREW),
    )
    expect(advance.length).toBeGreaterThan(0)
    expect(advance.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })

  it('the arc → venture gate is authored as a real milestone requirement (not a test-only injection)', () => {
    // Guardrail §10 — the gate lives in shipping content: the refining
    // milestone requires the master_on_staff transformation.
    const refining = signatureBrewDefinition.milestones.find((m) => m.fromStage === 'refining')!
    expect(
      refining.requirements.some(
        (c) => c.kind === 'transformation_active' && c.id === MASTER_ON_STAFF_TRANSFORMATION_ID,
      ),
    ).toBe(true)
  })

  it('an arc reaching mastered writes the master_on_staff transformation (the arc payoff behaves like a transformation)', () => {
    // A proven journeyman masters in one autonomous tick (4b machinery).
    const state = createInitialTavernState()
    const subject = state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]!
    state.staff[STAFF_MASTERY_ARC_SUBJECT_ID] = {
      ...subject,
      loyalty: 80,
      castAttributes: { ...subject.castAttributes!, arcId: ARC },
    }
    state.arcs[ARC] = { ...createStaffMasteryArc("Mira's path", 0), stage: 'journeyman', progress: 3 }

    const day = run(state)
    expect(day.state.arcs[ARC]?.stage).toBe('mastered')
    expect(day.state.transformations[MASTER_ON_STAFF_TRANSFORMATION_ID]?.active).toBe(true)
    // The cross-link fact is a global transformation, not a pressure.
    const xCauses = day.state.causes.filter((c) => c.tags.includes('master_on_staff'))
    expect(xCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })

  it('venture → arc: leaning on the staff wounds the arc progress and never touches loyalty', () => {
    const base = stateWithBrewAndDormantArc(2)
    // Resolve the live brew seed id from a clean run, then re-run the same
    // day with the wound intent.
    const clean = run(base)
    const seed = brewSeed(clean.state)
    expect(seed).toBeTruthy()

    const wounded = run(base, { responseIntents: [leanIntent(seed!.id)] })

    // The arc's own progress drops (the reach-back landed).
    expect(wounded.state.arcs[ARC]!.progress).toBeLessThan(clean.state.arcs[ARC]!.progress)
    // A wound cause is attributed to the arc, never a pressure.
    const woundCauses = wounded.state.causes.filter(
      (c) => c.tags.includes('wound') && c.tags.includes('cross_pollination') && c.tags.includes(ARC),
    )
    expect(woundCauses.length).toBeGreaterThan(0)
    expect(woundCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
    // Loyalty-coexistence invariant: the wound hits arc progress, not loyalty.
    const loyalty = (s: TavernState) => s.staff[STAFF_MASTERY_ARC_SUBJECT_ID]!.loyalty
    expect(loyalty(wounded.state)).toBe(loyalty(clean.state))
  })

  it('guardrail §9: the authored brew-seed effects include a real arc cross-effect and none target a pressure', () => {
    // Scan the ACTUALLY generated seed's consequence-profile effects (not an
    // inline sample), assert ≥1 cross-effect targets an arc, then assert no
    // authored effect targets a pressure id.
    const day = run(stateWithBrewAndDormantArc(3))
    const seed = brewSeed(day.state)
    expect(seed).toBeTruthy()
    const effects = seed!.consequenceProfiles.flatMap((p) => [
      ...p.immediateEffects,
      ...p.delayedEffects,
    ])
    expect(effects.length).toBeGreaterThanOrEqual(1)
    const arcCrossEffects = effects.filter((e) => e.target.startsWith(`arcs.${ARC}.`))
    expect(arcCrossEffects.length).toBeGreaterThanOrEqual(1)
    expect(effects.every((e) => !e.target.startsWith('pressure'))).toBe(true)
  })
})
