// Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3.
//
// The ninth structural gate. Sibling to `previewVariety` (Phase 144):
// same shape — pure function over `(sampler, config) → GateReport` that
// simulates a full multi-choice card render. Where `previewVariety`
// asks "do the rendered preview LINES vary within a card render?", this
// gate asks "do the rendered CHOICES stay distinct from each other?".
//
// Two failure modes, two reasons:
//
//   1. `choice_label_collision` (FAIL — recorded in `report.violations`).
//      Two choices with distinct `(slotId, verb, targetId)` rendered the
//      same canonical-form label. The Voiced Surface label pools key on
//      `(responseVerb, voiceAxis)` — so two slots that share a first
//      `allowedVerb` collapse to the same label whenever a single
//      voiceProfile matches both (the supplier
//      `negotiate_supplier` / `supplier_exclusivity_deal` collision).
//      Phase 3 / Layer A added the `responseSlot { anyOf }` condition
//      primitive so pools can disambiguate; this gate proves they did.
//
//   2. `choice_preview_near_collision` (WARN — recorded in
//      `report.warnings`). Two choices' rendered preview lines share
//      canonical-form text whose Levenshtein similarity exceeds the
//      same 0.85 threshold the dedupe gate uses. Soft signal — does
//      NOT fail the gate (the invariant `pass === violations.length ===
//      0` is preserved across all nine gates). `previewVariety` already
//      catches within-card preview collapse from a different angle
//      (identical lines in a row, low unique ratio across a render);
//      this catches cross-choice near-duplicates the per-effect rules
//      don't see — two choices that "feel the same" even when no two
//      individual lines are byte-identical.
//
// Pure: no I/O, no Math.random. Same inputs ⇒ same report. The gate
// uses `pickSnippet` directly, threading the same `ConditionContext` the
// runtime helper `composeChoicesFromSeed` does, so what the gate
// renders is what the player would see.

import { pickSnippet } from '../assemble'
import type {
  ConditionContext,
  SlotSpec,
  SnippetPool,
} from '../types'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import { canonicaliseText } from './dedupe'
import { normalisedSimilarity } from './levenshtein'
import type { GateReport, GateViolation } from './types'

/** Default cap on the rendered choice set — must match the value in
 *  `cardHelpers.DEFAULT_LEGIBLE_CHOICE_CAP`. Kept here as a constant
 *  for sampler authors who need to pre-cap their fixtures. */
export const DEFAULT_PREVIEW_MAX = 3

/** Levenshtein-on-canonical similarity threshold above which two
 *  choices' joined preview text counts as a near-collision. Matches the
 *  dedupe gate's `DEFAULT_DEDUPE_THRESHOLD = 0.85`. */
export const DEFAULT_PREVIEW_NEAR_COLLISION_THRESHOLD = 0.85

/** One slot's worth of render inputs. The gate's `renderChoice` helper
 *  mirrors `composeChoicesFromSeed`'s per-slot composition exactly. */
export type ChoiceDistinctnessSlot = {
  slot: ResponseSlot
  profile: ConsequenceProfile | undefined
}

/** One sample = one fully-composed render of a card's choice set. The
 *  caller assembles `slots` AFTER applying any presentation cap (Phase
 *  3 / Layer C) so the gate operates on what the player would see. */
export type ChoiceDistinctnessSample = {
  seed: IssueSeed
  state: TavernState
  labelPool: SnippetPool
  previewPool: SnippetPool
  /** The slots this render surfaces — already capped by the caller. */
  slots: readonly ChoiceDistinctnessSlot[]
  /** Per-choice preview cap, mirroring `composeChoicesFromSeed`'s
   *  `maxPreview` option. Defaults to 3. */
  maxPreview?: number
}

export type ChoiceDistinctnessSampler = (i: number) => ChoiceDistinctnessSample

export type ChoiceDistinctnessConfig = {
  sampleSize: number
  /** Levenshtein-on-canonical similarity threshold above which two
   *  choices' joined preview text emits a `choice_preview_near_collision`
   *  warning. Defaults to 0.85 (matches the dedupe gate). */
  previewNearCollisionThreshold?: number
}

export type ChoiceDistinctnessObservation = {
  sampleSize: number
  /** Total `choice_label_collision` violations across all samples. */
  labelCollisions: number
  /** Total `choice_preview_near_collision` warnings across all samples. */
  previewNearCollisions: number
  /** Highest preview-similarity observed across any sampled choice
   *  pair. 0 when no sample had ≥2 choices with rendered previews. */
  maxPreviewSimilarity: number
}

export const CHOICE_DISTINCTNESS_REASONS = Object.freeze([
  'choice_label_collision',
  'choice_preview_near_collision',
] as const)

export type ChoiceDistinctnessReason =
  (typeof CHOICE_DISTINCTNESS_REASONS)[number]

export function checkChoiceDistinctness(
  sampler: ChoiceDistinctnessSampler,
  config: ChoiceDistinctnessConfig,
): GateReport & { observed: ChoiceDistinctnessObservation } {
  const threshold =
    config.previewNearCollisionThreshold ??
    DEFAULT_PREVIEW_NEAR_COLLISION_THRESHOLD
  const violations: GateViolation[] = []
  const warnings: GateViolation[] = []
  let labelCollisions = 0
  let previewNearCollisions = 0
  let maxPreviewSimilarity = 0

  for (let i = 0; i < config.sampleSize; i += 1) {
    const sample = sampler(i)
    const maxPreview = sample.maxPreview ?? DEFAULT_PREVIEW_MAX
    const rendered = sample.slots.map((entry) =>
      renderChoice(sample, entry, maxPreview),
    )
    // Label collisions: compare every pair of distinct (slotId, verb,
    // targetId) triples; canonical-form-equal labels fail.
    for (let a = 0; a < rendered.length; a += 1) {
      for (let b = a + 1; b < rendered.length; b += 1) {
        const A = rendered[a]!
        const B = rendered[b]!
        if (sameMechanicalIdentity(A, B)) continue
        if (A.canonicalLabel === B.canonicalLabel) {
          labelCollisions += 1
          violations.push({
            slotId: A.slot.id,
            reason: 'choice_label_collision',
            detail: `sample ${i}: "${A.label}" rendered for both ${A.slot.id} (${A.verb}) and ${B.slot.id} (${B.verb})`,
          })
        }
      }
    }
    // Preview near-collisions: warn only. Compare joined canonical
    // preview text per choice pair; threshold above similarity ⇒ warn.
    for (let a = 0; a < rendered.length; a += 1) {
      const A = rendered[a]!
      if (A.canonicalPreview.length === 0) continue
      for (let b = a + 1; b < rendered.length; b += 1) {
        const B = rendered[b]!
        if (B.canonicalPreview.length === 0) continue
        if (sameMechanicalIdentity(A, B)) continue
        const sim = normalisedSimilarity(
          A.canonicalPreview,
          B.canonicalPreview,
        )
        if (sim > maxPreviewSimilarity) maxPreviewSimilarity = sim
        if (sim >= threshold) {
          previewNearCollisions += 1
          warnings.push({
            slotId: A.slot.id,
            reason: 'choice_preview_near_collision',
            detail: `sample ${i}: ${A.slot.id} ~= ${B.slot.id} (sim ${sim.toFixed(3)})`,
          })
        }
      }
    }
  }

  const observed: ChoiceDistinctnessObservation = {
    sampleSize: config.sampleSize,
    labelCollisions,
    previewNearCollisions,
    maxPreviewSimilarity,
  }
  const report: GateReport = {
    pass: violations.length === 0,
    violations,
  }
  if (warnings.length > 0) report.warnings = warnings
  return { ...report, observed }
}

type RenderedChoice = {
  slot: ResponseSlot
  verb: string
  targetId: string | undefined
  label: string
  canonicalLabel: string
  /** Joined canonical-form preview text across all rendered preview
   *  lines for this choice. Empty string when the choice has no preview
   *  effects (the renderer-side blank case). */
  canonicalPreview: string
}

/** Two choices share mechanical identity when their `(slotId, verb,
 *  targetId)` triples are equal. Such pairs are NOT counted as
 *  collisions or near-collisions — the sim deliberately routed them to
 *  one choice and rendering them identically is the correct outcome. In
 *  practice no sampler should ever produce such a pair (one slot ⇒ one
 *  rendered choice in `composeChoicesFromSeed`), but the guard makes
 *  the gate robust against pathological samples. */
function sameMechanicalIdentity(a: RenderedChoice, b: RenderedChoice): boolean {
  return (
    a.slot.id === b.slot.id &&
    a.verb === b.verb &&
    a.targetId === b.targetId
  )
}

function renderChoice(
  sample: ChoiceDistinctnessSample,
  entry: ChoiceDistinctnessSlot,
  maxPreview: number,
): RenderedChoice {
  const slot = entry.slot
  const verb = slot.allowedVerbs[0] ?? 'ignore'
  const targetId = slot.targetOptions[0]?.id
  // Label composition mirrors composeChoicesFromSeed exactly.
  const labelSlot: SlotSpec = {
    id: `choice_label::${slot.id}`,
    role: 'choice_label',
    pool: sample.labelPool,
    optional: true,
    wordBudget: 6,
    claimMode: 'flavor',
  }
  const composedLabel = pickSnippet(labelSlot, sample.seed, sample.state, {
    currentResponseSlot: slot,
  })
  const label = composedLabel ?? slot.labelHint
  // Preview composition mirrors the Phase-147 inaction wiring.
  const immediate = entry.profile?.immediateEffects ?? []
  const delayed = entry.profile?.delayedEffects ?? []
  const useDelayed = immediate.length === 0 && delayed.length > 0
  const effects = (useDelayed ? delayed : immediate).slice(0, maxPreview)
  const previewLines = effects.map((effect, idx) => {
    const previewSlot: SlotSpec = {
      id: `effect_preview::${slot.id}::${idx}`,
      role: 'effect_preview',
      pool: sample.previewPool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    }
    const ctx: ConditionContext = {
      currentResponseSlot: slot,
      currentEffect: effect,
      inactionPreview: useDelayed,
    }
    const composed = pickSnippet(previewSlot, sample.seed, sample.state, ctx)
    return composed ?? effect.readable
  })
  const canonicalPreview = previewLines
    .map((l) => canonicaliseText(l))
    .filter((s) => s.length > 0)
    .join(' || ')
  return {
    slot,
    verb,
    targetId,
    label,
    canonicalLabel: canonicaliseText(label),
    canonicalPreview,
  }
}
