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
import type {
  EffectPreview,
  EffectTargetKind,
} from '../../../sim/core/effect'
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
  /** Phase 145 / ISSUE-113 (iteration 2). Catches the
   *  "varied-but-meaningless" defect: every line is distinct from its
   *  neighbour, so the Phase-144 rules pass, but no line names the meter
   *  it describes — the player can't translate flavor back to sim
   *  effect. Disabled when omitted (back-compat with Phase-144 callers). */
  specificity?: PreviewSpecificityRule
}

/** A rendered preview line counts as "specific" when one of three things
 *  is true:
 *    1. It is the verbatim `effect.readable` (sim fallback — the sim's
 *       own translation; always authoritative).
 *    2. Its text contains any keyword from `targetKindKeywords` for the
 *       effect's `targetKind`.
 *    3. The effect's `targetKind` is undefined or `'other'` (legacy or
 *       unclassifiable effect — gate can't expect specificity).
 *  The rule fails when fewer than `minSpecificityRatio` of all sampled
 *  rendered lines pass. */
export type PreviewSpecificityRule = {
  /** Minimum fraction of rendered lines that must be "specific" per the
   *  rules above. Default 0.7 — 70% of lines must be readable-style or
   *  contain a targetKind keyword. */
  minSpecificityRatio?: number
  /** Per-targetKind keyword lists. A rendered line passes the keyword
   *  rule if it contains any of these as a substring (case-insensitive).
   *  Defaults to `DEFAULT_TARGET_KIND_KEYWORDS` when omitted. */
  targetKindKeywords?: Partial<Record<EffectTargetKind, readonly string[]>>
}

export type PreviewVarietyObservation = {
  sampleSize: number
  /** Lowest unique-ratio observed across samples. */
  minUniqueRatio: number
  /** Longest identical-run observed across samples. */
  maxIdenticalRun: number
  /** Phase 145 — overall specificity ratio across every line rendered
   *  across every sample. `undefined` when the specificity rule is
   *  disabled. */
  specificityRatio?: number
}

export const PREVIEW_VARIETY_REASONS = Object.freeze([
  'within_card_preview_collapse',
  'card_render_low_diversity',
  'preview_specificity_low',
] as const)

export type PreviewVarietyReason = (typeof PREVIEW_VARIETY_REASONS)[number]

// Defaults chosen to distinguish "single snippet dominates" (screenshot
// defect, ratio ~0.04) from "healthy multi-snippet pool" (ratio ~0.25
// with 6 snippets across 24 lines). 0.15 sits comfortably between.
const DEFAULT_MIN_UNIQUE_RATIO = 0.15
const DEFAULT_MAX_IDENTICAL_RUN = 2
const DEFAULT_MIN_SPECIFICITY_RATIO = 0.7

/** Default per-targetKind keyword list for the specificity check. A
 *  rendered preview line "names what changed" when it contains one of
 *  these tokens for its effect's targetKind. Authored conservatively:
 *  generic words ("change", "shift") deliberately omitted so the
 *  Phase-144 kind-only base rung fails the specificity check (it's
 *  meant to). Tokens are matched as case-insensitive substrings. */
export const DEFAULT_TARGET_KIND_KEYWORDS: Record<
  EffectTargetKind,
  readonly string[]
> = {
  coin: ['coin', 'till', 'purse', 'silver', 'copper', 'penny'],
  stock: ['shelf', 'shelves', 'stock', 'stores', 'barrel', 'pantry', 'cellar'],
  area: ['room', 'floor', 'space', 'corner', 'kitchen', 'cellar', 'privy'],
  customer: ['regular', 'patron', 'customer', 'guest'],
  staff: ['staff', 'cook', 'crew', 'rota', 'shift'],
  pressure: ['pressure', 'meter', 'reading', 'risk', 'climb', 'settle'],
  memory: ['memory', 'remember', 'recall', 'rumour', 'whisper'],
  reputation: ['reputation', 'name', 'word', 'talk'],
  cohort: ['group', 'cohort', 'crowd', 'table'],
  supplier: ['supplier', 'merchant', 'trader', 'deal'],
  faction: ['faction', 'guild', 'order', 'house'],
  culture: ['culture', 'kin', 'folk', 'people'],
  arc: ['arc', 'thread', 'story', 'campaign'],
  attribution: ['blame', 'credit', 'mark', 'attribution'],
  global: ['tavern', 'house', 'place', 'business'],
  other: [],
}

export const PREVIEW_VARIETY_DEFAULTS = Object.freeze({
  minUniqueRatio: DEFAULT_MIN_UNIQUE_RATIO,
  maxIdenticalRun: DEFAULT_MAX_IDENTICAL_RUN,
  minSpecificityRatio: DEFAULT_MIN_SPECIFICITY_RATIO,
})

export function checkPreviewVariety(
  sampler: PreviewVarietySampler,
  config: PreviewVarietyConfig,
): GateReport & { observed: PreviewVarietyObservation } {
  const minRatio = config.minUniqueRatio ?? DEFAULT_MIN_UNIQUE_RATIO
  const maxRun = config.maxIdenticalRun ?? DEFAULT_MAX_IDENTICAL_RUN
  const specificityRule = config.specificity
  const minSpecificityRatio =
    specificityRule?.minSpecificityRatio ?? DEFAULT_MIN_SPECIFICITY_RATIO
  const keywordTable =
    specificityRule?.targetKindKeywords ?? DEFAULT_TARGET_KIND_KEYWORDS
  const violations: GateViolation[] = []
  let observedMinRatio = 1
  let observedMaxRun = 0
  let samplesWithLines = 0
  let totalLines = 0
  let specificLines = 0
  let genericExamples: string[] = []
  for (let i = 0; i < config.sampleSize; i += 1) {
    const sample = sampler(i)
    const maxPreview = sample.maxPreview ?? 3
    const rendered = renderPreviewLines(sample, maxPreview)
    if (rendered.length === 0) continue
    samplesWithLines += 1
    const texts = rendered.map((r) => r.text)
    const unique = new Set(texts).size
    const ratio = unique / texts.length
    if (ratio < observedMinRatio) observedMinRatio = ratio
    const longestRun = longestIdenticalRun(texts)
    if (longestRun > observedMaxRun) observedMaxRun = longestRun
    if (ratio < minRatio) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'card_render_low_diversity',
        detail: `sample ${i}: ${unique}/${texts.length} unique preview lines (ratio ${ratio.toFixed(2)}); needed >= ${minRatio}`,
      })
    }
    if (longestRun > maxRun) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'within_card_preview_collapse',
        detail: `sample ${i}: ${longestRun} identical preview lines in a row; allowed run <= ${maxRun}`,
      })
    }
    if (specificityRule) {
      for (const line of rendered) {
        totalLines += 1
        if (isSpecificLine(line, keywordTable)) {
          specificLines += 1
        } else if (genericExamples.length < 3) {
          // Collect a few examples for the failure message — easier to
          // debug than a bare ratio.
          genericExamples.push(
            `"${line.text}" for ${line.effect.targetKind ?? '<no targetKind>'}/${line.effect.direction ?? '<no direction>'}`,
          )
        }
      }
    }
  }
  let specificityRatio: number | undefined
  if (specificityRule && totalLines > 0) {
    specificityRatio = specificLines / totalLines
    if (specificityRatio < minSpecificityRatio) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'preview_specificity_low',
        detail: `${specificLines}/${totalLines} rendered lines name what changed (ratio ${specificityRatio.toFixed(2)}); needed >= ${minSpecificityRatio}. Examples of generic lines: ${genericExamples.join('; ')}`,
      })
    }
  }
  const report = failReport(violations)
  const observed: PreviewVarietyObservation = {
    sampleSize: samplesWithLines,
    minUniqueRatio: observedMinRatio,
    maxIdenticalRun: observedMaxRun,
  }
  if (specificityRatio !== undefined) {
    observed.specificityRatio = specificityRatio
  }
  return {
    pass: report.pass,
    violations: report.violations,
    observed,
  }
}

/** A rendered line is "specific" if (a) it matched no snippet and the
 *  sim-emitted `effect.readable` was used verbatim — sim authority
 *  always counts; (b) the line contains a keyword for its
 *  targetKind; or (c) the effect has no classifiable targetKind. */
function isSpecificLine(
  rendered: { text: string; effect: EffectPreview; fromFallback: boolean },
  keywordTable: Partial<Record<EffectTargetKind, readonly string[]>>,
): boolean {
  if (rendered.fromFallback) return true
  const targetKind = rendered.effect.targetKind
  if (targetKind === undefined || targetKind === 'other') return true
  const keywords = keywordTable[targetKind]
  if (!keywords || keywords.length === 0) return true
  const haystack = rendered.text.toLowerCase()
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()))
}

type RenderedPreviewLine = {
  text: string
  effect: EffectPreview
  /** True when no snippet matched and `effect.readable` was used. */
  fromFallback: boolean
}

function renderPreviewLines(
  sample: PreviewVarietySample,
  maxPreview: number,
): RenderedPreviewLine[] {
  const lines: RenderedPreviewLine[] = []
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
      const composed = pickSnippet(slot, sample.seed, sample.state, ctx)
      lines.push({
        text: composed ?? effect.readable,
        effect,
        fromFallback: composed === undefined,
      })
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
