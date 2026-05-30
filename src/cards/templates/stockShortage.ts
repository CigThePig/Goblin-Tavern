// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Compositional template for the stock_shortage family (warning). First
// dedicated card for the family — pre-Phase 9 every stock_shortage seed
// routed to the fallback card. The seed has no `primaryActor` (the
// subject is a stock item; affectedActors is a customer cohort), so the
// template renders in a NARRATOR-VOICED register: voice axes / verbal
// tics are absent from every pool because no actor would resolve them.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation via
//     `pressureRising stock_shortage|reputation_drift`, prior-choice
//     memories (watered/raised/ignored), `repeatCount stock`, and
//     `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) narrates the owner's read of
//     the morning, gated on calendar tone tags + memories.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// No `custom` predicate — the family has no actor cast surface to
// require. The seed shape is unchanged from `issueSeedGenerators.ts:390-645`.

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
import {
  stockShortageChoiceLabelPool,
  stockShortageEffectPreviewPool,
  stockShortageEstablishingLinePool,
  stockShortageMannerNotePool,
  stockShortageReactionLinePool,
  stockShortageTitlePool,
} from '../compose/pools/stockShortage'

export const stockShortageTemplate: CompositionalCardTemplate = {
  id: 'stock_shortage.warning',
  appliesTo: {
    seedFamilies: ['stock_shortage'],
    seedTypes: ['warning'],
    timings: ['morning_prep'],
  },
  priority: 65,
  voiceRegister: 'back_of_house',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: stockShortageTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. The
      // stock_shortage card is *about* the rising shortage × the
      // memory/calendar/severity context that makes the next choice
      // matter. When two top-salient facts resolve (e.g. severity ≥ 70
      // AND rising stock_shortage; or rising shortage AND a watered-ale
      // memory), the establishing line should state the pair, not
      // whichever single condition out-specifies the other. Salience
      // table at `compose/salience.ts:stock_shortage` orders the reads;
      // assembler at `compose/assemble.ts:pickComposedSlotText` joins
      // primary + secondary with ' — ' within the combined budget.
      id: 'establishing_line',
      role: 'utterance',
      pool: stockShortageEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: stockShortageReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: stockShortageMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildStockShortageTitle(filled),
      body: buildStockShortageBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: stockShortageChoiceLabelPool,
        previewPool: stockShortageEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildStockShortageTitle(filled: FilledSlots): string {
  return filled['title'] ?? 'a lean morning at the cellar'
}

function buildStockShortageBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const stockShortageCard: CardDefinition = defineCompositionalCard(
  stockShortageTemplate,
)
