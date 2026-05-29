// Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5 (Close the Loop).
//
// Two suites:
//
//   1. Live suite — runs `checkFaithfulness` against several thousand
//      production-shape card renders collected by driving `runCardlessSim`
//      across four policy bots (per `faithfulnessHarness.FAITHFULNESS_SAMPLES`).
//      Expects `report.pass === true`: zero direction mismatches, zero
//      label collisions, zero duplicate preview lines, zero distress/calm
//      flavor lines contradicting the actor's computed state. A failure
//      here is a real surface-faithfulness regression — fix the pool / the
//      valence map / the renderer, not the gate. The canary + non-vacuous
//      tests guard against the test silently rendering nothing.
//
//   2. Failure-fixture suite — four hand-built samples, each designed to
//      fail exactly one rule, proving every `FAITHFULNESS_REASONS` entry
//      is load-bearing. Fixtures use the REAL lexicon tokens so the live
//      tables stay load-bearing.

import { describe, expect, it } from 'vitest'

import {
  checkFaithfulness,
  FAITHFULNESS_REASONS,
  type FaithfulnessSample,
} from '../../../../src/cards/compose/gates'
import { FAITHFULNESS_SAMPLES } from './faithfulnessHarness'
import { makeSeed } from '../../cardFactories'
import { makeTavernState, withStaff } from '../../../../src/sim/testing/stateFactories'
import type { CardChoice, CardView } from '../../../../src/cards/types'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../../src/sim/core/effect'

// ---------------------------------------------------------------------
// Live suite — production-shape renders.
// ---------------------------------------------------------------------

describe('Phase 167 — Faithfulness audit (live, runCardlessSim renders)', () => {
  it('every production-shape render passes all four faithfulness rules', () => {
    const report = checkFaithfulness({ samples: FAITHFULNESS_SAMPLES })
    if (!report.pass) {
      const preview = report.violations
        .slice(0, 8)
        .map((v) => `  [${v.reason}] ${v.detail ?? v.slotId}`)
        .join('\n')
      throw new Error(
        `checkFaithfulness found ${report.violations.length} violation(s):\n${preview}`,
      )
    }
    expect(report.pass).toBe(true)
    expect(report.observed.directionMismatches).toBe(0)
    expect(report.observed.labelCollisions).toBe(0)
    expect(report.observed.duplicatePreviewLines).toBe(0)
    expect(report.observed.distressMismatches).toBe(0)
  })

  it('renders a meaningful number of cards — canary floor', () => {
    const report = checkFaithfulness({ samples: FAITHFULNESS_SAMPLES })
    // The original ad-hoc audit was 2,578 cards. Floor a little under our
    // measured count so a future seed-rate change doesn't silently render
    // nothing and pass vacuously.
    expect(report.observed.samplesEvaluated).toBeGreaterThanOrEqual(2000)
  })

  it('exercises the direction and distress checks on real samples (not vacuous)', () => {
    const report = checkFaithfulness({ samples: FAITHFULNESS_SAMPLES })
    expect(report.observed.directionChecksRun).toBeGreaterThan(0)
    expect(report.observed.distressChecksRun).toBeGreaterThan(0)
  })

  it('is deterministic — two calls return identical reports', () => {
    const a = checkFaithfulness({ samples: FAITHFULNESS_SAMPLES })
    const b = checkFaithfulness({ samples: FAITHFULNESS_SAMPLES })
    expect(a.violations).toEqual(b.violations)
    expect(a.observed).toEqual(b.observed)
  })

  it('exports the frozen FAITHFULNESS_REASONS tuple', () => {
    expect([...FAITHFULNESS_REASONS]).toEqual([
      'direction_mismatch',
      'label_collision',
      'duplicate_preview_line',
      'distress_state_mismatch',
    ])
    expect(Object.isFrozen(FAITHFULNESS_REASONS)).toBe(true)
  })
})

// ---------------------------------------------------------------------
// Failure-fixture suite — each reason bites.
// ---------------------------------------------------------------------

function effect(parts: Partial<EffectPreview> & { target: string }): EffectPreview {
  return {
    kind: 'state_change',
    amount: parts.amount ?? 1,
    readable: parts.readable ?? 'something shifts',
    tags: parts.tags ?? [],
    ...parts,
  }
}

function choice(parts: {
  slotId: string
  verb: ResponseIntentVerb
  label: string
  targetId?: string
  previewEffects?: string[]
  shape?: ResponseIntentShape
}): CardChoice {
  return {
    slotId: parts.slotId,
    label: parts.label,
    verb: parts.verb,
    shape: parts.shape ?? 'safe_costly',
    previewEffects: parts.previewEffects ?? [],
    ...(parts.targetId !== undefined ? { targetId: parts.targetId } : {}),
  }
}

function cardView(choices: CardChoice[], body: string[] = []): CardView {
  return { title: 'Fixture', body, stakes: [], choices }
}

function profileFor(
  slotId: string,
  immediate: EffectPreview[],
): ConsequenceProfile {
  return {
    id: `${slotId}-profile`,
    responseSlotId: slotId,
    immediateEffects: immediate,
    delayedEffects: [],
    memories: [],
    futureHooks: [],
    impactScore: 5,
  }
}

function slotFor(slotId: string, verb: ResponseIntentVerb): ResponseSlot {
  return {
    id: slotId,
    labelHint: 'Address',
    allowedVerbs: [verb],
    shape: 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }
}

describe('Phase 167 — Faithfulness failure fixtures (each reason bites)', () => {
  it('direction_mismatch fires when a lower-is-better preview speaks the wrong direction', () => {
    // staff.stress -20 is a *reduction* — good for the player, so
    // direction is positive. The preview line speaks negative/medium
    // vocabulary ("a clear drop"): the 339-case valence defect.
    const seed = makeSeed({
      id: 'fx-direction',
      family: 'staff_burnout',
      responseSlots: [slotFor('s_comfort', 'appease')],
      consequenceProfiles: [
        profileFor('s_comfort', [
          effect({
            target: 'staff.stress',
            amount: -20,
            direction: 'positive',
            magnitudeBand: 'medium',
            targetKind: 'staff',
            readable: 'eases the cook',
          }),
        ]),
      ],
    })
    const view = cardView([
      choice({
        slotId: 's_comfort',
        verb: 'appease',
        label: 'Comfort the cook',
        previewEffects: ['the rota would take a clear drop'],
      }),
    ])
    const report = checkFaithfulness({
      samples: [{ seed, state: makeTavernState(), cardView: view }],
    })
    expect(report.pass).toBe(false)
    const reasons = report.violations.map((v) => v.reason)
    expect(reasons).toContain('direction_mismatch')
  })

  it('label_collision fires across distinct (slotId, verb, targetId) choices', () => {
    const seed = makeSeed({
      id: 'fx-label',
      family: 'faction_request',
      responseSlots: [slotFor('negotiate_terms', 'negotiate'), slotFor('play_rival_faction', 'negotiate')],
    })
    const view = cardView([
      choice({ slotId: 'negotiate_terms', verb: 'negotiate', label: 'Strike a quick bargain' }),
      choice({ slotId: 'play_rival_faction', verb: 'negotiate', label: 'Strike a quick bargain' }),
    ])
    const report = checkFaithfulness({
      samples: [{ seed, state: makeTavernState(), cardView: view }],
    })
    expect(report.pass).toBe(false)
    expect(report.violations.map((v) => v.reason)).toContain('label_collision')
  })

  it('duplicate_preview_line fires when distinct choices render the same preview line', () => {
    const seed = makeSeed({
      id: 'fx-dup',
      family: 'faction_request',
      responseSlots: [slotFor('slot_a', 'appease'), slotFor('slot_b', 'negotiate')],
    })
    const view = cardView([
      choice({ slotId: 'slot_a', verb: 'appease', label: 'Warm the guild', previewEffects: ['the till would take a clear drop'] }),
      choice({ slotId: 'slot_b', verb: 'negotiate', label: 'Warm the watch', previewEffects: ['the till would take a clear drop'] }),
    ])
    const report = checkFaithfulness({
      samples: [{ seed, state: makeTavernState(), cardView: view }],
    })
    expect(report.pass).toBe(false)
    expect(report.violations.map((v) => v.reason)).toContain('duplicate_preview_line')
  })

  it('distress_state_mismatch fires when a distress line shows for a calm actor', () => {
    const base = makeTavernState()
    const staffId = Object.keys(base.staff)[0]!
    const state = withStaff(base, staffId, { stress: 5, fatigue: 5 })
    const seed = makeSeed({
      id: 'fx-distress',
      family: 'staff_identity',
      primaryActor: { kind: 'staff', id: staffId },
    })
    const view = cardView(
      [choice({ slotId: 'aside', verb: 'appease', label: 'Listen' })],
      ['There are shadows under their eyes tonight.'],
    )
    const report = checkFaithfulness({ samples: [{ seed, state, cardView: view }] })
    expect(report.pass).toBe(false)
    expect(report.violations.map((v) => v.reason)).toContain('distress_state_mismatch')
  })
})
