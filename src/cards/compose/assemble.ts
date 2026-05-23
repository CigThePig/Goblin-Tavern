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
import type { TavernState } from '../../sim/state/TavernState'
import { evalCondition } from './conditions'
import type {
  ConditionContext,
  FilledSlots,
  SlotSpec,
  Snippet,
} from './types'

export function specificityOf(snippet: Snippet): number {
  return snippet.specificity ?? snippet.conditions.length
}

export function pickSnippet(
  slot: SlotSpec,
  seed: IssueSeed,
  state: TavernState,
  ctx: ConditionContext = {},
): string | undefined {
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
  if (top.length === 1) return top[0]!.text
  // Deterministic tie-break: same seed + same slot ⇒ same pick across
  // every re-render. Matches the FNV precedent in `descriptors.ts` and
  // `voice/composer.ts`, now via the shared helper. Slot id namespacing
  // (Phase 132 / ISSUE-101) ensures choice-label / effect-preview synthetic
  // slots discriminate between response slots in the helper.
  const idx = fnvIndex(`${seed.id}::${slot.id}`, top.length)
  return top[idx]!.text
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
