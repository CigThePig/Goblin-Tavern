// Opportunity template — supplier knocks with a deal. Surfaces the
// supplier's stored reliability/relationship rather than fabricating
// numbers. Mirrors cards-contract §7 Template 3.

import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

export const supplierOfferCard: CardDefinition = {
  id: 'supplier_relationship.opportunity.deal',
  appliesTo: {
    seedFamilies: ['supplier_relationship'],
    seedTypes: ['supplier_offer', 'opportunity'],
    timings: ['morning_prep'],
  },
  priority: 50,
  toneHints: ['transactional'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const supplierRef =
      seed.primaryActor?.kind === 'supplier' ? seed.primaryActor : undefined
    const supplier = supplierRef ? state.world.suppliers[supplierRef.id] : undefined
    const supplierLabel =
      supplier?.name?.display ?? supplier?.label ?? 'A supplier'
    const reliabilityNote = supplier ? `reliability ${supplier.reliability}` : undefined

    return makeCardView({
      title: formatTitle([`${supplierLabel}:`, ti.subject]),
      body: buildBody([ti.marketContext?.[0], reliabilityNote, ti.recentContext[0]]),
      stakes: buildStakes(seed),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => (supplierRef?.id ? { targetId: supplierRef.id } : {}),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
