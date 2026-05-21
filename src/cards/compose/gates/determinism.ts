// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Determinism gate (framework §6 #5). For each `(seed, state)` sample,
// rendering the template twice — second time against a `structuredClone`
// of the state — must produce a byte-equal `CardView`, and must not
// mutate the state. The assembler is structurally deterministic
// (conditions are data, FNV tie-break, no `Math.random`), so this gate
// guards against regression rather than catching a class of authoring
// bug. Phase E runs the same check on generated pools as a sanity belt
// before commit.

import { defineCompositionalCard } from '../defineCompositionalCard'
import type { CompositionalCardTemplate } from '../types'
import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import { failReport, type GateReport, type GateViolation } from './types'

export type DeterminismSample = {
  seed: IssueSeed
  state: TavernState
}

export function checkDeterminism(
  template: CompositionalCardTemplate,
  samples: readonly DeterminismSample[],
): GateReport {
  const violations: GateViolation[] = []
  const card = defineCompositionalCard(template)
  for (const { seed, state } of samples) {
    const stateJsonBefore = JSON.stringify(state)
    const viewA = card.render(seed, state)
    const stateJsonAfter = JSON.stringify(state)
    if (stateJsonAfter !== stateJsonBefore) {
      violations.push({
        slotId: '__template__',
        snippetId: seed.id,
        reason: 'state_mutated_during_render',
        detail: 'render() must be pure over (seed, state)',
      })
      continue
    }
    const clone = structuredClone(state) as TavernState
    const viewB = card.render(seed, clone)
    if (JSON.stringify(viewA) !== JSON.stringify(viewB)) {
      violations.push({
        slotId: '__template__',
        snippetId: seed.id,
        reason: 'render_non_deterministic',
        detail: 'render(seed, structuredClone(state)) differed from render(seed, state)',
      })
    }
  }
  return failReport(violations)
}
