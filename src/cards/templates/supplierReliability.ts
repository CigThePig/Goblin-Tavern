// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Compositional template for the supplier_relationship family
// (supplier_offer / opportunity). Replaces the legacy hand-written
// `supplierOffer` template, which built the body by concatenating
// `ti.marketContext[0]`, the raw `"reliability ${value}"` meter readout,
// and `ti.recentContext[0]` through `composeBody` — the broken-screenshot
// template that started the Voiced Surface arc.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation via
//     `supplier.reliability` / `supplier.relationship` signal bands,
//     rising `supplier_distrust` / `market_instability` pressure,
//     `memoryPresent supplier`, and the band+repeat top rung.
//   - reaction_line (flavor, ≤12 words) carries the supplier's voiced
//     reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// The Phase-3 / ISSUE-098 spec at `specs/cards/supplier_reliability.spec.yaml`
// is the design record; the pools under `compose/pools/supplierReliability/`
// emit it.
//
// The `custom` predicate insists the resolved supplier has Phase-2
// `castAttributes` populated. Graceful degradation per framework §5,
// identical to drinkOrder / regularComplaint / staffBurnout.

import {
  buildStakes,
  composeChoicesFromSeed,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'
import { defineCompositionalCard } from '../compose/defineCompositionalCard'
import type {
  CompositionalCardTemplate,
  FilledSlots,
} from '../compose/types'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  supplierReliabilityChoiceLabelPool,
  supplierReliabilityEffectPreviewPool,
  supplierReliabilityEstablishingLinePool,
  supplierReliabilityMannerNotePool,
  supplierReliabilityReactionLinePool,
  supplierReliabilityTitlePool,
} from '../compose/pools/supplierReliability'

export const supplierReliabilityTemplate: CompositionalCardTemplate = {
  id: 'supplier_relationship.supplier_offer',
  appliesTo: {
    seedFamilies: ['supplier_relationship'],
    seedTypes: ['supplier_offer', 'opportunity'],
    timings: ['morning_prep'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'supplier') return false
      return state.world.suppliers[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 65,
  voiceRegister: 'trade_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: supplierReliabilityTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1. The
      // supplier card is *about* reliability × relationship; when both
      // bands resolve, the establishing line should state the pair.
      // `saliencePolicy: 'multi'` lets the assembler tie-break top-
      // specificity matches by salience (reliability is the lead read
      // for `supplier_relationship`; see `compose/salience.ts`), then
      // append a secondary snippet covering the next orthogonal salient
      // fact (relationship, distrust, market_instability, repeat,
      // memory) within the combined word budget. Layered OVER the
      // gradient — when only one read resolves, behaviour matches the
      // single-fact baseline.
      id: 'establishing_line',
      role: 'utterance',
      pool: supplierReliabilityEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: supplierReliabilityReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: supplierReliabilityMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildSupplierReliabilityTitle(filled, seed, state),
      body: buildSupplierReliabilityBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: supplierReliabilityChoiceLabelPool,
        previewPool: supplierReliabilityEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildSupplierReliabilityTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const supplier =
    ref && ref.kind === 'supplier' ? state.world.suppliers[ref.id] : undefined
  const display =
    supplier?.name?.display ??
    supplier?.label ??
    seed.textIngredients.subject ??
    'A supplier'
  const snippet = filled['title'] ?? 'morning trade'
  return `${display}: ${snippet}`
}

function buildSupplierReliabilityBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const supplierReliabilityCard: CardDefinition = defineCompositionalCard(
  supplierReliabilityTemplate,
)
