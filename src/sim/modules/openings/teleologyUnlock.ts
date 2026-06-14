import type { TavernState } from '../../state/TavernState'

// Phase 2 (teleology) — forward-compatibility seam for progressive
// onboarding.
//
// A progressive-onboarding/unlock layer will eventually gate *when*
// teleology (openings, ventures) first appears for a new player. That work
// is deliberately deferred to the very end of the project. Per the phase
// plan's forward-compatibility note, the opening generator routes its "is
// teleology available yet?" check through this single predicate, which
// currently returns `true` unconditionally. Later, gating becomes a
// one-line change here rather than a rearchitecture — the cold-bootstrap
// logic stays intact regardless of when "day 1" later becomes.
export function teleologyUnlocked(_state: TavernState): boolean {
  return true
}
