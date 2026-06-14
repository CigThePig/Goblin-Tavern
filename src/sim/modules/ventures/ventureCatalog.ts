import type { TavernState, TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition } from '../kernel'
import {
  createLiquorLicenseVenture,
  liquorLicenseDefinition,
  LIQUOR_LICENSE_VENTURE_ID,
} from './liquorLicense'

// Phase 2 (teleology) — venture blueprint catalog.
//
// Phase 1 proved the kernel on a single hardcoded venture, with the
// venture id, its initial entry factory, and its lifecycle definition all
// imported directly by `ventureModule`. Phase 2 introduces openings as the
// real entry path, and an opening must be able to *spawn* the venture it
// pursues. That requires a registry mapping a blueprint id → how to make
// the entry + how to advance it, so the spawn path (in the response
// applier) and the advancement loop (in `ventureModule`) can both look a
// venture up by id without hardcoding any single one.
//
// A venture is a singleton ratchet — you either have it or you don't — so
// the spawned entry's id equals its blueprint id. The catalog is keyed by
// that shared id.
export type VentureBlueprint = {
  id: string
  label: string
  /** Build the initial lifecycle entry for `state.ventures[id]`. */
  createEntry: (day: number) => TeleologyEntry
  /** Milestone definition the kernel advances the entry through. */
  definition: LifecycleDefinition
  /** Opening keying — how the world decides to *offer* this venture.
   *  Returns true when the tavern's standing identity/relationships make
   *  the opening plausible. Cold-bootstrap reads identity (non-empty at
   *  day 1) so an opening can appear with zero ventures. */
  openingApplies: (state: TavernState) => boolean
  /** Human-facing opening copy. */
  opening: {
    establishingLine: string
    problemNoun: string
    sensoryDetails: string[]
    stakesReadable: string
    pursueHint: string
    declineHint: string
  }
}

export const VENTURE_BLUEPRINTS: Record<string, VentureBlueprint> = {
  [LIQUOR_LICENSE_VENTURE_ID]: {
    id: LIQUOR_LICENSE_VENTURE_ID,
    label: 'Acquire a liquor licence',
    createEntry: createLiquorLicenseVenture,
    definition: liquorLicenseDefinition,
    // A magistrate offers a licence to a tavern with enough standing to be
    // worth the paperwork: the Crooked Keg's day-one identity ("cheap
    // goblin food", grimy but goblin-authentic) is enough to be *noticed*,
    // so the opening is plausible from day 1. Keyed off identity tags so it
    // does not require any venture to already exist.
    openingApplies: (state) => {
      const identity = state.world.tavernIdentity
      return identity.knownFor.length > 0 || identity.atmosphereTags.length > 0
    },
    opening: {
      establishingLine:
        'A clerk from the magistrate mentions the tavern could file for a liquor licence.',
      problemNoun: 'a licence opportunity',
      sensoryDetails: ['a folded writ', 'wax and ribbon'],
      stakesReadable: 'Filing now starts a permanent path to licensed liquor service.',
      pursueHint: 'Take up the licence and start the paperwork',
      declineHint: 'Leave the licence for now',
    },
  },
}

export function getVentureBlueprint(id: string): VentureBlueprint | undefined {
  return VENTURE_BLUEPRINTS[id]
}

export function allVentureBlueprints(): VentureBlueprint[] {
  return Object.values(VENTURE_BLUEPRINTS)
}
