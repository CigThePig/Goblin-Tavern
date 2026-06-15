import type { TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition } from '../kernel'
import { MASTER_ON_STAFF_TRANSFORMATION_ID } from '../teleologyCrossLinks'

// Phase 4c (teleology) — the cross-pollination venture.
//
// Phase 1 proved the venture spine on the single-milestone liquor licence.
// 4c needs a venture whose progress is GATED by an arc milestone, so the
// two halves of the teleology machine couple. "Brew a signature ale" is
// that venture: a brewer can develop a recipe and refine it on owner time
// alone, but the final, signature brew cannot be perfected until a master
// is on the staff — i.e. until a staff-mastery arc has reached `mastered`
// and written the `master_on_staff` transformation.
//
// The gate is a plain `transformation_active` requirement on the
// `refining → signature` milestone, reusing the kernel condition that
// already exists (no new engine concept, plan §"Phase 4c"). Until the arc
// produces the fact, `resolveBranchingMilestone` returns `undefined` for
// that milestone and the venture simply does not advance — no churn, no
// looping.

export const SIGNATURE_BREW_VENTURE_ID = 'venture_signature_brew'

/** Per-stage progress requirements (accrued via owner-time investment, like
 *  the liquor licence). Final stage ALSO requires `master_on_staff`. */
export const SIGNATURE_BREW_RECIPE_REQUIREMENT = 2
export const SIGNATURE_BREW_REFINING_REQUIREMENT = 2

/** The ratchet a completed signature brew writes — the venture's own payoff
 *  fact (the venture→transformation direction, mirroring how the arc payoff
 *  behaves like a transformation). */
export const SIGNATURE_BREW_TRANSFORMATION_ID = 'signature_brew_served'

export const signatureBrewDefinition: LifecycleDefinition = {
  id: SIGNATURE_BREW_VENTURE_ID,
  milestones: [
    {
      // Owner-time alone gets the recipe drafted.
      id: 'develop_recipe',
      fromStage: 'recipe',
      requirements: [{ kind: 'progress_at_least', value: SIGNATURE_BREW_RECIPE_REQUIREMENT }],
      outcomes: [],
      fallback: { nextStage: 'refining', effects: [] },
    },
    {
      // The arc gate: the brew cannot be perfected until a master is on the
      // staff (`master_on_staff` active). Until then this milestone never
      // resolves and the venture holds at `refining`.
      id: 'perfect_the_brew',
      fromStage: 'refining',
      requirements: [
        { kind: 'progress_at_least', value: SIGNATURE_BREW_REFINING_REQUIREMENT },
        { kind: 'transformation_active', id: MASTER_ON_STAFF_TRANSFORMATION_ID },
      ],
      outcomes: [],
      fallback: {
        nextStage: 'signature',
        terminal: true,
        effects: [
          {
            kind: 'transformation',
            id: SIGNATURE_BREW_TRANSFORMATION_ID,
            label: 'Signature ale on the menu',
            tags: ['signature_brew', 'ratchet'],
          },
        ],
      },
    },
  ],
}

export function createSignatureBrewVenture(day: number): TeleologyEntry {
  return {
    id: SIGNATURE_BREW_VENTURE_ID,
    kind: 'venture',
    label: 'Brew a signature ale',
    stage: 'recipe',
    progress: 0,
    status: 'active',
    tags: ['signature_brew'],
    createdAtDay: day,
    updatedAtDay: day,
  }
}
