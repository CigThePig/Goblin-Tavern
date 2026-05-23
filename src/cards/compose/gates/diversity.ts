// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Diversity gate (framework §6 #6). A pool of N snippets must yield ≥ M
// distinct outputs across a sample drawn from the real cast-attribute
// distribution. Phase B locks `order_line ≥ 6` distinct under the
// `[-1,0,0,1]` perturbation; without this gate a pool can be technically
// well-formed but read repetitively in play because too few snippets fire.
//
// The gate is SLOT-LEVEL: it takes a `SlotSpec` and a `sampler` function
// that produces fresh `(seed, state)` pairs. The caller owns the
// sampler — gates do not know how to roll cast attributes themselves
// (that's a sim concern). Phase D wires `createRegularCastAttributes`
// into the sampler via `tests/cards/compose/gates/samplers.ts`.
//
// `undefined` results (optional slots resolving to nothing) are
// EXCLUDED from the distinct count. That's a deliberate choice: an
// optional slot that mostly omits + occasionally fires three different
// lines has diversity 3, not 4. Counting `undefined` as a distinct
// "output" would inflate diversity for pools that mostly do nothing.

import { pickSnippet } from '../assemble'
import type { ConditionContext, SlotSpec } from '../types'
import type { IssueSeed } from '../../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../sim/state/TavernState'
import { failReport, type GateReport, type GateViolation } from './types'

export type DiversitySample = {
  seed: IssueSeed
  state: TavernState
}
export type DiversitySampler = (i: number) => DiversitySample

export type DiversityConfig = {
  sampleSize: number
  minDistinct: number
  /**
   * Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Optional
   * context builder that surfaces the iteration context the choice
   * helper threads in at runtime. Choice-label and effect-preview pools
   * gate on `responseVerb` / `responseShape` / `effectKind` / `effectTag`
   * — primitives that read `ctx.currentResponseSlot` / `ctx.currentEffect`.
   * Without a context builder those conditions never match and the gate
   * would observe zero diversity. Body / title pool entries continue to
   * pass no context (omit this field).
   */
  pickContext?: (sample: DiversitySample, i: number) => ConditionContext
}

export type DiversityObservation = {
  distinct: number
  total: number
}

export function checkPoolDiversity(
  slot: SlotSpec,
  sampler: DiversitySampler,
  config: DiversityConfig,
): GateReport & { observed: DiversityObservation } {
  const seen = new Set<string>()
  let total = 0
  for (let i = 0; i < config.sampleSize; i += 1) {
    const sample = sampler(i)
    const ctx = config.pickContext?.(sample, i) ?? {}
    const result = pickSnippet(slot, sample.seed, sample.state, ctx)
    if (result !== undefined) {
      seen.add(result)
      total += 1
    }
  }
  const violations: GateViolation[] = []
  if (seen.size < config.minDistinct) {
    violations.push({
      slotId: slot.id,
      reason: 'insufficient_diversity',
      detail: `observed ${seen.size} distinct outputs across ${config.sampleSize} samples; needed ≥ ${config.minDistinct}`,
    })
  }
  const report = failReport(violations)
  return {
    pass: report.pass,
    violations: report.violations,
    observed: { distinct: seen.size, total },
  }
}
