// Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18 (Deepening,
// Pruning & Voice-Selection Repair).
//
// The eighth structural gate (`framework §6` + one). The seven existing
// gates check a snippet pool *in isolation*: coverage, specificity,
// voiceBounds, simCoherence, determinism, diversity, dedupe. None
// simulate a whole card render and ask "do the rendered effect-preview
// lines vary across the choices on a single card?" This gate does.
//
// The defect this gate catches (the screenshot pattern):
//
//   "the kitchen keeps its quiet drumbeat" repeats for every choice on
//   Mira's staff_identity card; "The room would steady its footing"
//   repeats for every choice on the area_atmosphere "Privy" card.
//
// Why the existing diversity gate misses it: diversity samples ONE slot
// under fresh-actor perturbation. It never iterates a multi-choice
// multi-effect render with a fixed actor and asks whether the snippet
// pool gives each effect a distinct line. When a pool's snippets all
// require two simultaneous conditions (effectKind + voiceAxis) with no
// unconditional base rung per kind, a single actor with one matching
// axis maps every effect of that kind to the same single snippet.
//
// The structural lever the gate enforces: pools must carry enough base-
// rung diversity (per-effectKind unconditional snippets) that the
// `pickSnippet` FNV tie-break — which hashes the synthetic slot id
// `effect_preview::${slotId}::${idx}` — has multiple candidates per
// effect and resolves differently across the card's effect list.
//
// Pure function over `(sampler, config) → GateReport`. Same shape as
// the diversity gate; pure call to `pickSnippet`; no I/O.

import { pickSnippet } from '../assemble'
import type { ConditionContext, SlotSpec, SnippetPool } from '../types'
import type {
  IssueSeed,
  ResponseSlot,
} from '../../../sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../sim/core/effect'
import type { TavernState } from '../../../sim/state/TavernState'
import { failReport, type GateReport, type GateViolation } from './types'

export type PreviewVarietyChoice = {
  slot: ResponseSlot
  effects: readonly EffectPreview[]
}

export type PreviewVarietySample = {
  seed: IssueSeed
  state: TavernState
  previewPool: SnippetPool
  /** The multi-choice card render shape. Each entry is one response
   *  slot with the effects that choice would surface. The gate iterates
   *  these the same way `composeChoicesFromSeed` does at runtime. */
  choices: readonly PreviewVarietyChoice[]
  /** Per-choice preview cap, mirroring `composeChoicesFromSeed`'s
   *  `maxPreview` option. Defaults to 3. */
  maxPreview?: number
}

export type PreviewVarietySampler = (i: number) => PreviewVarietySample

export type PreviewVarietyConfig = {
  sampleSize: number
  /** Minimum ratio of distinct-to-total rendered preview lines within a
   *  single card render. 0.5 = at least half of the rendered lines on a
   *  card must be distinct from each other. */
  minUniqueRatio?: number
  /** Maximum allowed run of identical preview lines in a row within a
   *  single card render. 2 = a duplicate-pair is allowed; three-in-a-
   *  row fails. The screenshot pattern (12 identical lines in a row)
   *  catches on this rule. */
  maxIdenticalRun?: number
}

export type PreviewVarietyObservation = {
  sampleSize: number
  /** Lowest unique-ratio observed across samples. */
  minUniqueRatio: number
  /** Longest identical-run observed across samples. */
  maxIdenticalRun: number
}

export const PREVIEW_VARIETY_REASONS = Object.freeze([
  'within_card_preview_collapse',
  'card_render_low_diversity',
] as const)

export type PreviewVarietyReason = (typeof PREVIEW_VARIETY_REASONS)[number]

const DEFAULT_MIN_UNIQUE_RATIO = 0.5
const DEFAULT_MAX_IDENTICAL_RUN = 2

export const PREVIEW_VARIETY_DEFAULTS = Object.freeze({
  minUniqueRatio: DEFAULT_MIN_UNIQUE_RATIO,
  maxIdenticalRun: DEFAULT_MAX_IDENTICAL_RUN,
})

export function checkPreviewVariety(
  sampler: PreviewVarietySampler,
  config: PreviewVarietyConfig,
): GateReport & { observed: PreviewVarietyObservation } {
  const minRatio = config.minUniqueRatio ?? DEFAULT_MIN_UNIQUE_RATIO
  const maxRun = config.maxIdenticalRun ?? DEFAULT_MAX_IDENTICAL_RUN
  const violations: GateViolation[] = []
  let observedMinRatio = 1
  let observedMaxRun = 0
  let samplesWithLines = 0
  for (let i = 0; i < config.sampleSize; i += 1) {
    const sample = sampler(i)
    const maxPreview = sample.maxPreview ?? 3
    const lines = renderPreviewLines(sample, maxPreview)
    if (lines.length === 0) continue
    samplesWithLines += 1
    const unique = new Set(lines).size
    const ratio = unique / lines.length
    if (ratio < observedMinRatio) observedMinRatio = ratio
    const longestRun = longestIdenticalRun(lines)
    if (longestRun > observedMaxRun) observedMaxRun = longestRun
    if (ratio < minRatio) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'card_render_low_diversity',
        detail: `sample ${i}: ${unique}/${lines.length} unique preview lines (ratio ${ratio.toFixed(2)}); needed >= ${minRatio}`,
      })
    }
    if (longestRun > maxRun) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'within_card_preview_collapse',
        detail: `sample ${i}: ${longestRun} identical preview lines in a row; allowed run <= ${maxRun}`,
      })
    }
  }
  const report = failReport(violations)
  return {
    pass: report.pass,
    violations: report.violations,
    observed: {
      sampleSize: samplesWithLines,
      minUniqueRatio: observedMinRatio,
      maxIdenticalRun: observedMaxRun,
    },
  }
}

function renderPreviewLines(
  sample: PreviewVarietySample,
  maxPreview: number,
): string[] {
  const lines: string[] = []
  for (const choice of sample.choices) {
    const effects = choice.effects.slice(0, maxPreview)
    effects.forEach((effect, idx) => {
      const slot: SlotSpec = {
        id: `effect_preview::${choice.slot.id}::${idx}`,
        role: 'effect_preview',
        pool: sample.previewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      }
      const ctx: ConditionContext = {
        currentResponseSlot: choice.slot,
        currentEffect: effect,
      }
      const text =
        pickSnippet(slot, sample.seed, sample.state, ctx) ?? effect.readable
      lines.push(text)
    })
  }
  return lines
}

function longestIdenticalRun(lines: readonly string[]): number {
  if (lines.length === 0) return 0
  let longest = 1
  let current = 1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === lines[i - 1]) {
      current += 1
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }
  return longest
}

// Re-exported for sampler authors so per-template helpers can build
// concrete render shapes without re-typing the IssueSeed import.
export type PreviewVarietyContext = {
  seed: IssueSeed
  state: TavernState
}
