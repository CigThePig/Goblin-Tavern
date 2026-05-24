// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Multi-line analogue of `assembleSlots` for report-section composition.
// Cards pick ONE snippet per slot; report sections emit N notes whose
// presence in the rendered list is per-slot conditional (e.g. a weekly
// signals section emits the "cleanliness very low" line only when the
// guard holds). Each note is a separate `SlotSpec`; the slot's pool
// carries voicings of that single fact.
//
// Iteration order matches the input array — composers control the
// rendered order by ordering their slot list. Slots that resolve to
// `undefined` (no matching snippet) are filtered out, so a note that
// didn't fire produces no output line.
//
// Reuses `pickSnippet` and `evalCondition` unchanged: the seven Phase-D
// gates (coverage, specificity, voiceBounds, simCoherence, determinism,
// diversity, dedupe) apply to report-section pools exactly as they do to
// card-template pools, via the gate adapter in `./gateAdapter.ts`.

import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import { pickSnippet } from '../assemble'
import type { SlotSpec } from '../types'

export function assembleNotesList(
  noteSlots: readonly SlotSpec[],
  seed: IssueSeed,
  state: TavernState,
): string[] {
  const out: string[] = []
  for (const slot of noteSlots) {
    const picked = pickSnippet(slot, seed, state)
    if (picked !== undefined) out.push(picked)
  }
  return out
}
