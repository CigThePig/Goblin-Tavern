// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Compositional template for the debt_rent family (debt_pressure). First
// dedicated card for the family — pre-Phase 9 every debt_rent seed
// routed to the fallback. The seed has no `primaryActor` by design
// (audit pass 1 §5.3 — the landlord is a `systemRef`, not a real entity)
// and an empty `affectedActors`, so the template renders in a
// NARRATOR-VOICED register: voice axes / verbal tics are absent from
// every pool because no actor would resolve them.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation via
//     `pressureRising debt|landlord`, prior-payment memories
//     (rent_paid / rent_delayed / borrowed_coin / eviction_threat),
//     `repeatCount debt`, the `rent_due_soon` calendar tag (via seed
//     toneHints / domain), and `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) narrates the owner's quiet read
//     of the ledger.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// No `custom` predicate — the family has no actor cast surface to
// require. Timing is `end_month`, distinct from supplier (morning_prep)
// and stock_shortage (morning_prep).

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
  debtRentChoiceLabelPool,
  debtRentEffectPreviewPool,
  debtRentEstablishingLinePool,
  debtRentMannerNotePool,
  debtRentReactionLinePool,
  debtRentTitlePool,
} from '../compose/pools/debtRent'

export const debtRentTemplate: CompositionalCardTemplate = {
  id: 'debt_rent.debt_pressure',
  appliesTo: {
    seedFamilies: ['debt_rent'],
    seedTypes: ['debt_pressure'],
    timings: ['end_month'],
  },
  priority: 65,
  voiceRegister: 'office_quarters',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: debtRentTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. The
      // debt_rent card is *about* the converging end-of-month pressures:
      // severity, the `rent_due_soon` calendar window, rising debt and
      // landlord pressures, prior payment / borrow / delay memories.
      // When two top-salient facts resolve (e.g. severity ≥ 70 AND
      // rent_due_soon; or rising debt AND a 3-month repeat), the
      // establishing line should state the pair, not whichever single
      // condition out-specifies the other. Salience table at
      // `compose/salience.ts:debt_rent`; assembler joins primary +
      // secondary with ' — ' within the combined budget.
      id: 'establishing_line',
      role: 'utterance',
      pool: debtRentEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: debtRentReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: debtRentMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildDebtRentTitle(filled),
      body: buildDebtRentBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: debtRentChoiceLabelPool,
        previewPool: debtRentEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildDebtRentTitle(filled: FilledSlots): string {
  return filled['title'] ?? 'a quiet hour with the ledger'
}

function buildDebtRentBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const debtRentCard: CardDefinition = defineCompositionalCard(
  debtRentTemplate,
)
