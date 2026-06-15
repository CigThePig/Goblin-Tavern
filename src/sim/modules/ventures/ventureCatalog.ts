import type { TavernState, TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition } from '../kernel'
import {
  createLiquorLicenseVenture,
  liquorLicenseDefinition,
  LIQUOR_LICENSE_VENTURE_ID,
} from './liquorLicense'
import {
  createSignatureBrewVenture,
  signatureBrewDefinition,
  SIGNATURE_BREW_VENTURE_ID,
} from './signatureBrew'
import { MASTER_ON_STAFF_TRANSFORMATION_ID } from '../teleologyCrossLinks'

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
  /** Phase 4c (teleology) — cross-pollination: when this venture's progress
   *  is gated by a transformation that another teleology system (an arc)
   *  produces. The card surfaces a legible "stalled until …" line while the
   *  gate is closed; the gate itself is a `transformation_active` milestone
   *  requirement in the definition. Optional — ungated ventures omit it. */
  crossLink?: {
    /** Transformation id that gates `gatedStage → next`. */
    gateTransformationId: string
    /** Stage at which the venture waits on the gate. */
    gatedStage: string
    /** Player-facing line shown while the gate is closed. */
    blockedNote: string
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
  [SIGNATURE_BREW_VENTURE_ID]: {
    id: SIGNATURE_BREW_VENTURE_ID,
    label: 'Brew a signature ale',
    createEntry: createSignatureBrewVenture,
    definition: signatureBrewDefinition,
    // The idea of a house brew only surfaces once a staffer shows real
    // promise — the opening keys off an ACTIVE staff arc that has become
    // `proven` (loyalty has climbed past the proven threshold). That keeps
    // the opening off day 1 and ties its appearance to a real character on
    // the rise (an arc-biased opening, plan §"Phase 4c"). Resolved from
    // `state.arcs`, never a hardcoded arc id.
    openingApplies: (state) =>
      Object.values(state.arcs).some(
        (arc) =>
          arc.status === 'active' &&
          arc.tags.includes('staff_arc') &&
          arc.tags.includes('proven'),
      ),
    opening: {
      establishingLine:
        'A promising hand at the bar could carry a brew of their own, if the tavern backed it.',
      problemNoun: 'a house-brew idea',
      sensoryDetails: ['a half-filled tasting jug', 'hops and roasted grain'],
      stakesReadable:
        'A signature ale would mark the tavern out — but it can only be perfected by a true master.',
      pursueHint: 'Back the house brew',
      declineHint: 'Let the idea sit for now',
    },
    crossLink: {
      gateTransformationId: MASTER_ON_STAFF_TRANSFORMATION_ID,
      gatedStage: 'refining',
      blockedNote: 'Stalled at refining until a master joins the staff.',
    },
  },
}

export function getVentureBlueprint(id: string): VentureBlueprint | undefined {
  return VENTURE_BLUEPRINTS[id]
}

/** Phase 4c (teleology) — the cross-pollination gate status for a venture,
 *  for card legibility. Returns the blueprint's `blockedNote` when the
 *  venture is waiting at its gated stage and the gating transformation is
 *  not yet active; otherwise `undefined`. Resolves everything from the
 *  passed entry + state — no hardcoded venture/arc id (guardrail §10). */
export function ventureGateBlockedNote(
  state: TavernState,
  venture: TeleologyEntry,
): string | undefined {
  const link = getVentureBlueprint(venture.id)?.crossLink
  if (!link) return undefined
  if (venture.stage !== link.gatedStage) return undefined
  if (state.transformations[link.gateTransformationId]?.active) return undefined
  return link.blockedNote
}

export function allVentureBlueprints(): VentureBlueprint[] {
  return Object.values(VENTURE_BLUEPRINTS)
}
