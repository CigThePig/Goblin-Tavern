// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Lifted from `tests/cards/compose/gates/samplers.ts` so the generation
// pipeline (under `scripts/`) can import it without reaching into the
// tests directory. The test sampler now re-exports from here.
//
// Pulls every regular and staff `name.display` from the given state.
// The sim-coherence gate consumes this as its banned-substring list:
// flavor snippets may never invent a specific identity, so any text
// containing one of these strings fails the gate.

import type { TavernState } from '../../../sim/state/TavernState'

export function representativeBannedNames(
  state: TavernState,
): readonly string[] {
  const out = new Set<string>()
  for (const regular of Object.values(state.world.regulars)) {
    if (regular?.name?.display) out.add(regular.name.display)
  }
  for (const staff of Object.values(state.staff)) {
    if (staff?.name?.display) out.add(staff.name.display)
  }
  return [...out]
}
