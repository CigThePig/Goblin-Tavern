// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// `assembleSlots` is the deterministic core of the compose layer
// (framework §3). Per slot it filters the pool to matching snippets,
// keeps the highest-specificity tier, and resolves ties by hashing
// `${seed.id}::${slot.id}` through the shared FNV helper. Three
// properties fall out:
//
//   1. A required pool always resolves — its unconditional fallback
//      (specificity 0) matches everything, so there is always at least
//      one candidate.
//   2. More specific always wins — adding a sharper snippet later
//      enriches the card with zero structural change.
//   3. Determinism — equal-specificity ties resolve by hashed key, never
//      `Math.random`. Same seed + same slot ⇒ same pick, every re-render.
//
// Optional slots that find no match return `undefined`; the template's
// `toCardView` omits them.

import { fnvIndex } from '../../sim/utils/fnv'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import { resolveMeterValence } from '../../sim/modules/issues/generatorHelpers'
import type { TavernState } from '../../sim/state/TavernState'
import { evalCondition } from './conditions'
import {
  resolveSalientReads,
  scoreCandidateSalience,
  type ResolvedRead,
  type SalienceScore,
} from './salience'
import type {
  ConditionContext,
  FilledSlots,
  SlotSpec,
  Snippet,
} from './types'

export function specificityOf(snippet: Snippet): number {
  return snippet.specificity ?? snippet.conditions.length
}

/** Framework body cap (framework §4) — kept in sync with
 *  `voiceBounds.DEFAULT_BODY_WORD_BUDGET`. Used as the multi-fact
 *  combined-line budget when the slot omits `wordBudget`. */
const DEFAULT_BODY_WORD_BUDGET = 12

/** Token-count over a string, matching `voiceBounds.wordCount` semantics
 *  (whitespace split, trimmed). Inlined to keep `assemble.ts` free of
 *  gate-layer imports. */
function wordCountOf(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

/** Salience-aware pick among the top-specificity candidates. Lower
 *  salience index wins; ties resolve by higher extremity; remaining ties
 *  fall through to the same FNV key already used for pure-gradient
 *  resolution. Returns the chosen snippet and its score. */
function pickByTopSalience(
  candidates: readonly Snippet[],
  resolved: readonly ResolvedRead[],
  fnvKey: string,
): { snippet: Snippet; score: SalienceScore } {
  const scored = candidates.map((s) => ({
    snippet: s,
    score: scoreCandidateSalience(s, resolved),
  }))
  let bestIndex = Infinity
  let bestExtremity = -1
  for (const entry of scored) {
    if (entry.score.index < bestIndex) {
      bestIndex = entry.score.index
      bestExtremity = entry.score.extremity
    } else if (
      entry.score.index === bestIndex &&
      entry.score.extremity > bestExtremity
    ) {
      bestExtremity = entry.score.extremity
    }
  }
  const top = scored.filter(
    (e) => e.score.index === bestIndex && e.score.extremity === bestExtremity,
  )
  if (top.length === 1) return top[0]!
  const idx = fnvIndex(fnvKey, top.length)
  return top[idx]!
}

/** Phase 166 / ISSUE-134 — the player-facing valence of a resolved
 *  salient read: `'distress'` (bad for the player), `'calm'` (good), or
 *  `'neutral'`. Reuses the canonical `resolveMeterValence` map (Phase
 *  164) so signal polarity matches the preview layer.
 *
 *  Only SIGNAL bands carry a calm/distress pole. A rising PRESSURE is a
 *  systemic trend (burnout, market instability, debt) that orthogonally
 *  co-occurs with any current mood — "the wagons run steady, but the
 *  market's turning" is coherent, not a contradiction — so pressures are
 *  neutral here. The multi-fact contradiction the join refuses is two
 *  opposing current dispositions: a calm signal stapled to a distress
 *  signal ("their patience snapped — they've never been steadier"). */
function readValence(resolved: ResolvedRead): 'distress' | 'calm' | 'neutral' {
  const read = resolved.read
  if (read.kind === 'signal') {
    const band = resolved.band
    if (band === undefined || band === 'mid') return 'neutral'
    const highIsBad = resolveMeterValence(read.signal) === 'lowerIsBetter'
    if (band === 'high') return highIsBad ? 'distress' : 'calm'
    return highIsBad ? 'calm' : 'distress' // band === 'low'
  }
  // pressure (a trend) / memory / repeat / hasTag / severity carry no
  // contradicting current-disposition pole.
  return 'neutral'
}

/** Phase 166 / ISSUE-134 — the valence profile a snippet expresses,
 *  computed over EVERY read it covers (not just its most-salient one). A
 *  snippet gated on `stress: low` + `fatigue: high` covers both a calm
 *  and a distress read, so it is `{ calm: true, distress: true }` — a
 *  deliberately nuanced line, not a pure pole. */
function valenceProfile(
  coveredReadIndices: readonly number[],
  resolved: readonly ResolvedRead[],
): { calm: boolean; distress: boolean } {
  let calm = false
  let distress = false
  for (const i of coveredReadIndices) {
    const r = resolved[i]
    if (!r) continue
    const v = readValence(r)
    if (v === 'calm') calm = true
    else if (v === 'distress') distress = true
  }
  return { calm, distress }
}

/** Phase 166 / ISSUE-134 — true when two valence profiles are strict
 *  opposites: one expresses ONLY calm and the other ONLY distress. A
 *  mixed snippet (carrying both, like "steady steps, but the long week
 *  shows") is never a strict opposite — it already holds the tension, so
 *  appending a same-direction secondary is coherent. Only the pure
 *  calm-vs-distress pairing ("the week hasn't landed yet — and they're
 *  drifting away") is the contradiction the multi-fact join must refuse. */
function strictlyOpposed(
  a: { calm: boolean; distress: boolean },
  b: { calm: boolean; distress: boolean },
): boolean {
  const aPureCalm = a.calm && !a.distress
  const aPureDistress = a.distress && !a.calm
  const bPureCalm = b.calm && !b.distress
  const bPureDistress = b.distress && !b.calm
  return (aPureCalm && bPureDistress) || (aPureDistress && bPureCalm)
}

/** Find a secondary snippet for `'multi'` mode: one whose conditions
 *  cover the most-salient resolved read that the primary does NOT cover,
 *  and whose text appended to the primary stays within `wordBudget`.
 *  Returns undefined when no such candidate exists — silence beats
 *  stapling. */
function pickSecondaryForMulti(
  pool: readonly Snippet[],
  primary: Snippet,
  primaryScore: SalienceScore,
  resolved: readonly ResolvedRead[],
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext,
  budget: number,
  join: string,
  fnvKey: string,
): Snippet | undefined {
  const coveredByPrimary = new Set(primaryScore.coveredReadIndices)
  // Phase 166 / ISSUE-134 — the primary's valence profile across every
  // read it covers. The join refuses to staple a secondary that is the
  // strict opposite (pure calm vs pure distress) — silence beats a
  // contradictory "the week hasn't landed yet — and they're drifting
  // away" line. A primary that already mixes both (e.g. "steady steps,
  // but the long week shows") is not a pure pole, so a same-direction
  // secondary stays coherent.
  const primaryProfile = valenceProfile(primaryScore.coveredReadIndices, resolved)
  // Walk resolved reads in salience order; the first uncovered read that
  // has at least one matching, condition-satisfied snippet wins.
  for (let i = 0; i < resolved.length; i++) {
    if (coveredByPrimary.has(i)) continue
    const read = resolved[i]!
    const matches = pool.filter((s) => {
      if (s.id === primary.id) return false
      if (!s.conditions.every((c) => evalCondition(c, seed, state, ctx))) {
        return false
      }
      const score = scoreCandidateSalience(s, resolved)
      if (!score.coveredReadIndices.includes(i)) return false
      const combined = `${primary.text}${join}${s.text}`
      return wordCountOf(combined) <= budget
    })
    if (matches.length === 0) continue
    // Prefer the most-specific covering snippet, then salience-aware
    // tie-break, then FNV — same precedent as the primary pick.
    let maxSpec = -1
    for (const m of matches) {
      const spec = specificityOf(m)
      if (spec > maxSpec) maxSpec = spec
    }
    const topSpec = matches.filter((m) => specificityOf(m) === maxSpec)
    const secondary =
      topSpec.length === 1
        ? topSpec[0]!
        : pickByTopSalience(topSpec, resolved, `${fnvKey}::secondary::${i}`).snippet
    // Drop the secondary when it is the strict valence opposite of the
    // primary; try the next orthogonal read instead.
    const secProfile = valenceProfile(
      scoreCandidateSalience(secondary, resolved).coveredReadIndices,
      resolved,
    )
    if (strictlyOpposed(primaryProfile, secProfile)) continue
    return secondary
  }
  return undefined
}

/** Phase 143 / ISSUE-112 — Voiced Surface arc, Phase 17. Internal twin
 *  of `pickSnippet` that returns the resolved `Snippet` (id + conditions
 *  + text) instead of just the text. The cross-situation voice
 *  consistency gate uses this to introspect which snippet fired so it
 *  can read its `conditions` for `voiceAxis` / `verbalTic` gates without
 *  re-running selection. `pickSnippet` delegates to this; both paths
 *  share the same filter-then-specificity-then-FNV logic, so callers
 *  see identical text.
 *
 *  Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1. When the slot
 *  opts in (`saliencePolicy === 'top' | 'multi'`), the top-specificity
 *  tier is broken not only by FNV but first by salience: lower salience-
 *  table index wins, then higher extremity, then FNV. Layered OVER the
 *  gradient — slots without `saliencePolicy` resolve exactly as before.
 *  `'multi'` uses the same primary pick; the multi-fact join lives in
 *  `pickComposedSlotText`. */
export function pickSnippetTrace(
  slot: SlotSpec,
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext = {},
): Snippet | undefined {
  const matches = slot.pool.snippets.filter((s) =>
    s.conditions.every((c) => evalCondition(c, seed, state, ctx)),
  )
  if (matches.length === 0) return undefined
  let maxSpec = -1
  for (const m of matches) {
    const s = specificityOf(m)
    if (s > maxSpec) maxSpec = s
  }
  const top = matches.filter((s) => specificityOf(s) === maxSpec)
  if (top.length === 1) return top[0]!
  const fnvKey = `${seed.id}::${slot.id}`
  if (slot.saliencePolicy) {
    const resolved = resolveSalientReads(seed, state)
    if (resolved.length > 0) {
      return pickByTopSalience(top, resolved, fnvKey).snippet
    }
  }
  // Deterministic tie-break: same seed + same slot ⇒ same pick across
  // every re-render. Matches the FNV precedent in `descriptors.ts` and
  // `voice/composer.ts`, now via the shared helper. Slot id namespacing
  // (Phase 132 / ISSUE-101) ensures choice-label / effect-preview synthetic
  // slots discriminate between response slots in the helper.
  const idx = fnvIndex(fnvKey, top.length)
  return top[idx]!
}

export function pickSnippet(
  slot: SlotSpec,
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext = {},
): string | undefined {
  // Phase 146 / ISSUE-114 — slots with `saliencePolicy === 'multi'` may
  // join a primary + secondary snippet into one line. For all other
  // slots `pickComposedSlotText` collapses to the primary's text, so
  // callers outside the body builder (the choice helper's synthetic
  // slots, direct test calls on non-multi slots) see identical output.
  return pickComposedSlotText(slot, seed, state, ctx)
}

/** Phase 146 / ISSUE-114 — the assembler-side resolver for a slot. For
 *  slots without a salience policy this is just `pickSnippet`. For
 *  `'multi'` slots it picks the salience-aware primary, then optionally
 *  appends a secondary snippet covering the next orthogonal resolved
 *  read, joined into one line within the slot's `wordBudget`. Returns
 *  one string (or undefined) so `FilledSlots` shape is unchanged. */
export function pickComposedSlotText(
  slot: SlotSpec,
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext = {},
): string | undefined {
  const primary = pickSnippetTrace(slot, seed, state, ctx)
  if (!primary) return undefined
  if (slot.saliencePolicy !== 'multi') return primary.text
  const resolved = resolveSalientReads(seed, state)
  if (resolved.length === 0) return primary.text
  const primaryScore = scoreCandidateSalience(primary, resolved)
  // No fact covered ⇒ no orthogonal read; emit only the primary.
  if (primaryScore.index === Infinity) return primary.text
  const perSnippetBudget = slot.wordBudget ?? DEFAULT_BODY_WORD_BUDGET
  const budget = slot.multiFactBudget ?? perSnippetBudget * 2
  const join = slot.multiFactJoin ?? ' '
  const secondary = pickSecondaryForMulti(
    slot.pool.snippets,
    primary,
    primaryScore,
    resolved,
    seed,
    state,
    ctx,
    budget,
    join,
    `${seed.id}::${slot.id}`,
  )
  if (!secondary) return primary.text
  return `${primary.text}${join}${secondary.text}`
}

export function assembleSlots(
  slots: readonly SlotSpec[],
  seed: IssueSeed,
  state: TavernState,
): FilledSlots {
  const out: FilledSlots = {}
  for (const slot of slots) {
    out[slot.id] = pickSnippet(slot, seed, state)
  }
  return out
}
