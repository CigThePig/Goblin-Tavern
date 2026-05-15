import type { SimContext } from '../../core/context'
import type { CauseDraft } from '../causes/causeTypes'
import type { EntityRef, ReputationState } from '../../state/TavernState'

// Phase 67 / ISSUE-027 §6.6 — Culinary renown drift helper.
//
// Producers that move `state.reputation.culinary_renown` route their
// mutation through this helper so the cause-emission contract holds
// uniformly. Every drift carries a non-empty `relatedActors` list per
// the §11 acceptance criterion (and the ISSUE-003 rule that every
// cause must carry actor attribution).
//
// Callers supply:
//   - `delta`: signed integer change to apply (clamped 0..100 by
//     `modifyReputation` via the `meter()` schema).
//   - `cause`: a partial `CauseDraft` providing `source`, `readable`,
//     `tags`, and `relatedActors`. The helper fills in the
//     target/targetType/amount fields so the cause path is consistent
//     across producers.

export type RenownCauseDraft = Omit<
  CauseDraft,
  'target' | 'targetType' | 'amount' | 'direction'
> & {
  source: string
  relatedActors: EntityRef[]
}

function clampMeter(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

export function applyRenownDrift(
  ctx: SimContext,
  delta: number,
  cause: RenownCauseDraft,
): number {
  if (!Number.isFinite(delta) || delta === 0) return 0
  const current = ctx.state.reputation
  const next: ReputationState = {
    ...current,
    culinary_renown: clampMeter(current.culinary_renown + delta),
  }
  const actualDelta = next.culinary_renown - current.culinary_renown
  if (actualDelta === 0) return 0
  ctx.modifyReputation(next, {
    ...cause,
    target: 'reputation.culinary_renown',
    targetType: 'reputation',
    amount: actualDelta,
    direction: actualDelta > 0 ? 'increase' : 'decrease',
  })
  return actualDelta
}
