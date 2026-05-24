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
  EffectDirection,
  EffectMagnitudeBand,
  EffectPreview,
  EffectTargetKind,
} from '../../../sim/core/effect'
import type { TavernState } from '../../../sim/state/TavernState'
import {
  MAGNITUDE_LEXICON,
  lineCarriesMagnitude,
} from '../magnitudeLexicon'
import { failReport, type GateReport, type GateViolation } from './types'

export type PreviewVarietyChoice = {
  slot: ResponseSlot
  effects: readonly EffectPreview[]
  /** Phase 147 / ISSUE-115 — when true, the gate threads
   *  `inactionPreview: true` into the per-effect `ConditionContext`,
   *  mirroring how `composeChoicesFromSeed` flags a preview sourced
   *  from `delayedEffects` because `immediateEffects` was empty. Lets
   *  the live suite exercise inaction-specific snippet variants
   *  (`{ kind: 'inactionPreview', value: true }`). Defaults to false. */
  inactionPreview?: boolean
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
  /** Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. The legibility
   *  contract: every immediate-effect preview line must encode the
   *  effect's magnitude (via `MAGNITUDE_LEXICON`); choices that spend
   *  coin must surface that cost; the inaction option must render
   *  non-empty preview lines. Disabled when omitted (back-compat with
   *  pre-Phase-147 callers — including all 17 non-pilot templates whose
   *  per-meter content hasn't landed yet). */
  legibility?: PreviewLegibilityRule
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

/** Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2.
 *
 *  The preview legibility contract, machine-checked. Three opt-in rules
 *  that key on the structural metadata the sim already attaches to every
 *  `EffectPreview` (`targetKind`, `direction`, `magnitudeBand`):
 *
 *    1. `requireMagnitude` — a preview line whose effect carries a
 *       defined `magnitudeBand` must contain a token from
 *       `MAGNITUDE_LEXICON[direction][band]`. Sim fallthrough
 *       (`effect.readable`) always counts as legible — same carve-out
 *       Phase 145 applied to specificity. Lines for effects where
 *       `magnitudeBand` is undefined (neutral-amount, memory / arc /
 *       attribution markers) are excluded.
 *    2. `requireCostSurfacing` — a choice with any negative-direction
 *       `coin` effect must render at least one preview line containing
 *       a `coin` keyword from the targetKindKeywords table. A choice
 *       that spends should not be indistinguishable from a choice that
 *       gains.
 *    3. `forbidInactionBlank` — a choice's preview must render at least
 *       one line. The Phase-147 inaction wiring in
 *       `composeChoicesFromSeed` makes this satisfiable for every
 *       profile that has either an immediate or a delayed effect; the
 *       gate guards against regressions.
 *
 *  All three default to `false` (the rule is opt-in). Templates that
 *  haven't been authored against the magnitude lexicon yet keep
 *  passing — only the two Phase-147 pilots opt in. */
export type PreviewLegibilityRule = {
  /** Require every rendered line whose effect carries a defined
   *  `magnitudeBand` to contain a token from
   *  `MAGNITUDE_LEXICON[direction][band]`. */
  requireMagnitude?: boolean
  /** Override the magnitude lexicon. Defaults to `MAGNITUDE_LEXICON`. */
  magnitudeLexicon?: Record<
    EffectDirection,
    Record<EffectMagnitudeBand, readonly string[]>
  >
  /** Require any choice that spends coin (negative-direction `coin`
   *  effect) to surface that cost in at least one preview line via a
   *  coin keyword from `coinKeywords`. */
  requireCostSurfacing?: boolean
  /** Coin-keyword list used by `requireCostSurfacing`. Defaults to
   *  `DEFAULT_TARGET_KIND_KEYWORDS.coin`. */
  coinKeywords?: readonly string[]
  /** Require every choice to render at least one preview line. */
  forbidInactionBlank?: boolean
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
  /** Phase 147 — fraction of rendered lines whose effect carries a
   *  defined `magnitudeBand` that contain a magnitude-lexicon token.
   *  `undefined` when the `requireMagnitude` rule is disabled. */
  magnitudeRatio?: number
  /** Phase 147 — fraction of choices carrying any negative-direction
   *  coin effect whose preview surfaced a coin keyword on at least one
   *  line. `undefined` when `requireCostSurfacing` is disabled or no
   *  sampled choice spent coin. */
  costSurfacingRatio?: number
  /** Phase 147 — count of choices that rendered zero preview lines
   *  across the samples. `undefined` when `forbidInactionBlank` is
   *  disabled. */
  inactionBlankCount?: number
}

export const PREVIEW_VARIETY_REASONS = Object.freeze([
  'within_card_preview_collapse',
  'card_render_low_diversity',
  'preview_specificity_low',
  // Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2.
  'preview_magnitude_missing',
  'preview_cost_unsurfaced',
  'preview_inaction_blank',
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
  const legibilityRule = config.legibility
  const magnitudeLexicon =
    legibilityRule?.magnitudeLexicon ?? MAGNITUDE_LEXICON
  const coinKeywords =
    legibilityRule?.coinKeywords ?? DEFAULT_TARGET_KIND_KEYWORDS.coin
  const violations: GateViolation[] = []
  let observedMinRatio = 1
  let observedMaxRun = 0
  let samplesWithLines = 0
  let totalLines = 0
  let specificLines = 0
  let genericExamples: string[] = []
  // Phase 147 counters.
  let totalBandedLines = 0
  let magnitudeOkLines = 0
  let magnitudeExamples: string[] = []
  let costBearingChoices = 0
  let costSurfacedChoices = 0
  let costMissedExamples: string[] = []
  let inactionBlankChoices = 0
  let inactionBlankExamples: string[] = []
  for (let i = 0; i < config.sampleSize; i += 1) {
    const sample = sampler(i)
    const maxPreview = sample.maxPreview ?? 3
    const renderedByChoice = renderPreviewByChoice(sample, maxPreview)
    const rendered = renderedByChoice.flatMap((r) => r.lines)
    // Phase 147 — per-choice rules run on every sampled choice
    // including ones that produced zero lines (the inaction-blank
    // detector). They run before the early-exit on `rendered.length`
    // so an entirely-blank card still surfaces the violation.
    if (legibilityRule?.forbidInactionBlank) {
      for (const choice of renderedByChoice) {
        if (choice.lines.length === 0) {
          inactionBlankChoices += 1
          if (inactionBlankExamples.length < 3) {
            inactionBlankExamples.push(
              `sample ${i} choice "${choice.slot.id}" (${choice.slot.shape})`,
            )
          }
        }
      }
    }
    if (legibilityRule?.requireCostSurfacing) {
      for (const choice of renderedByChoice) {
        const spendsCoin = choice.effects.some(
          (e) => e.targetKind === 'coin' && e.direction === 'negative',
        )
        if (!spendsCoin) continue
        costBearingChoices += 1
        const surfaced = choice.lines.some((line) =>
          lineContainsAny(line.text, coinKeywords),
        )
        if (surfaced) costSurfacedChoices += 1
        else if (costMissedExamples.length < 3) {
          costMissedExamples.push(
            `sample ${i} choice "${choice.slot.id}": ${choice.lines.map((l) => `"${l.text}"`).join(', ') || '(no lines)'}`,
          )
        }
      }
    }
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
    if (legibilityRule?.requireMagnitude) {
      for (const line of rendered) {
        const band = line.effect.magnitudeBand
        const direction = line.effect.direction
        if (band === undefined || direction === undefined) continue
        totalBandedLines += 1
        // Sim fallthrough is always legible — same carve-out the
        // specificity rule applies.
        if (line.fromFallback) {
          magnitudeOkLines += 1
          continue
        }
        if (lineCarriesMagnitude(line.text, direction, band, magnitudeLexicon)) {
          magnitudeOkLines += 1
        } else if (magnitudeExamples.length < 3) {
          magnitudeExamples.push(
            `"${line.text}" for ${direction}/${band}`,
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
  let magnitudeRatio: number | undefined
  if (legibilityRule?.requireMagnitude && totalBandedLines > 0) {
    magnitudeRatio = magnitudeOkLines / totalBandedLines
    if (magnitudeOkLines < totalBandedLines) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'preview_magnitude_missing',
        detail: `${magnitudeOkLines}/${totalBandedLines} banded preview lines carry a magnitude-lexicon token. Examples of lines missing magnitude: ${magnitudeExamples.join('; ')}`,
      })
    }
  }
  let costSurfacingRatio: number | undefined
  if (legibilityRule?.requireCostSurfacing && costBearingChoices > 0) {
    costSurfacingRatio = costSurfacedChoices / costBearingChoices
    if (costSurfacedChoices < costBearingChoices) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'preview_cost_unsurfaced',
        detail: `${costSurfacedChoices}/${costBearingChoices} coin-spending choices surfaced the cost in a preview line. Examples: ${costMissedExamples.join('; ')}`,
      })
    }
  }
  let inactionBlankCount: number | undefined
  if (legibilityRule?.forbidInactionBlank) {
    inactionBlankCount = inactionBlankChoices
    if (inactionBlankChoices > 0) {
      violations.push({
        slotId: 'effect_preview',
        reason: 'preview_inaction_blank',
        detail: `${inactionBlankChoices} choice(s) rendered zero preview lines. Examples: ${inactionBlankExamples.join('; ')}`,
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
  if (magnitudeRatio !== undefined) {
    observed.magnitudeRatio = magnitudeRatio
  }
  if (costSurfacingRatio !== undefined) {
    observed.costSurfacingRatio = costSurfacingRatio
  }
  if (inactionBlankCount !== undefined) {
    observed.inactionBlankCount = inactionBlankCount
  }
  return {
    pass: report.pass,
    violations: report.violations,
    observed,
  }
}

/** Case-insensitive substring test against any token in a list. */
function lineContainsAny(line: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false
  const haystack = line.toLowerCase()
  return tokens.some((tok) => haystack.includes(tok.toLowerCase()))
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

type RenderedPreviewChoice = {
  slot: ResponseSlot
  /** The effects this choice would surface (already truncated to
   *  `maxPreview` and possibly delayed-effect-sourced for inaction). */
  effects: readonly EffectPreview[]
  lines: RenderedPreviewLine[]
  /** True when this choice rendered via the Phase-147 inaction path
   *  (`composeChoicesFromSeed` sourcing from `delayedEffects` because
   *  `immediateEffects` was empty). The gate's per-choice rules read
   *  this so the inaction-blank rule doesn't falsely fire on a choice
   *  whose preview legitimately came from delayed effects. */
  fromInaction: boolean
}

function renderPreviewByChoice(
  sample: PreviewVarietySample,
  maxPreview: number,
): RenderedPreviewChoice[] {
  return sample.choices.map((choice) => {
    const effects = choice.effects.slice(0, maxPreview)
    const inaction = choice.inactionPreview === true
    const lines: RenderedPreviewLine[] = effects.map((effect, idx) => {
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
        inactionPreview: inaction,
      }
      const composed = pickSnippet(slot, sample.seed, sample.state, ctx)
      return {
        text: composed ?? effect.readable,
        effect,
        fromFallback: composed === undefined,
      }
    })
    return {
      slot: choice.slot,
      effects,
      lines,
      fromInaction: inaction,
    }
  })
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
