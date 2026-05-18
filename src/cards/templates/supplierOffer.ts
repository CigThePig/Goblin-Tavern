// Opportunity template — supplier knocks with a deal. Surfaces the
// supplier's stored reliability/relationship rather than fabricating
// numbers. Mirrors cards-contract §7 Template 3.
//
// Phase 95 — Voice pass.

import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['transactional', 'market', 'supplier'] as const

export const supplierOfferCard: CardDefinition = {
  id: 'supplier_relationship.opportunity.deal',
  appliesTo: {
    seedFamilies: ['supplier_relationship'],
    seedTypes: ['supplier_offer', 'opportunity'],
    timings: ['morning_prep'],
  },
  priority: 50,
  toneHints: [...DEFINITION_TONES],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const supplierRef =
      seed.primaryActor?.kind === 'supplier' ? seed.primaryActor : undefined
    const supplier = supplierRef ? state.world.suppliers[supplierRef.id] : undefined
    const supplierLabel =
      supplier?.name?.display ?? supplier?.label ?? 'A supplier'
    const reliabilityNote = supplier ? `reliability ${supplier.reliability}` : undefined

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle([`${supplierLabel}:`, ti.subject], opts),
      body: composeBody(
        [ti.marketContext?.[0], reliabilityNote, ti.recentContext[0]],
        opts,
      ),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => (supplierRef?.id ? { targetId: supplierRef.id } : {}),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
