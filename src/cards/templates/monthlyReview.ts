// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Compositional template for the monthly_review family (monthly_review
// type). Rewritten in place from the legacy hand-written template that
// glued raw `${label} ${value} (${trend})` pressure readouts into the
// body through `composeBody`. The seed has no actor-with-castAttributes
// — `primaryActor: { kind: 'other', id: 'month:${monthKey}' }` is a
// month ref (audit pass 1 §5.3 — periods are not characters) — so the
// template renders in a NARRATOR-VOICED register: voice axes / verbal
// tics are absent from every pool because no actor would resolve them.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the month's
//     dominant pressure trend, prior-monthly choice memories (rent_paid
//     / cellar_invested / reserves_held / rival_settled),
//     `repeatCount monthly` ≥ 3, calendar tags via `hasTag`, and
//     `severityAtLeast` bands.
//   - reaction_line (flavor, ≤12 words) is the narrator's quiet read of
//     the closing.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// Title is `Month in review: ${snippet}` — the legacy "Month in review:"
// header is preserved as a fixed frame; the snippet supplies the
// month's character within a 6-word slot budget (the colon-separated
// frame is the rivalTavern title pattern at `rivalTavern.ts:109-122`).
//
// No `custom` predicate — the family has no actor cast surface to
// require. Timing is `end_month`, sharing the cadence with debtRent
// (`debtRent.ts:51`).

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
  monthlyReviewChoiceLabelPool,
  monthlyReviewEffectPreviewPool,
  monthlyReviewEstablishingLinePool,
  monthlyReviewMannerNotePool,
  monthlyReviewReactionLinePool,
  monthlyReviewTitlePool,
} from '../compose/pools/monthlyReview'

export const monthlyReviewTemplate: CompositionalCardTemplate = {
  id: 'monthly_review.monthly_review',
  appliesTo: {
    seedFamilies: ['monthly_review'],
    seedTypes: ['monthly_review'],
    timings: ['end_month'],
  },
  priority: 65,
  voiceRegister: 'office_quarters',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: monthlyReviewTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      // Phase 156 / ISSUE-124 — Legible Surface arc, Phase 11. The
      // monthly_review card is *about* the month's dominant
      // pressure(s) × prior-month choice memory × crisis severity. When
      // two top-salient facts resolve (e.g. landlord rising AND
      // rent-paid memory present; debt rising AND reserves-held
      // memory), the establishing line should state the pair, not
      // whichever single condition out-specifies the other. Salience
      // table at `compose/salience.ts:monthly_review` orders the reads;
      // assembler at `compose/assemble.ts:pickComposedSlotText` joins
      // primary + secondary with ' — ' within the combined budget. The
      // spec-2 / spec-3 combo cells in establishingLine.ts beat the
      // join when they cover the pair directly; the join is the
      // fallback when no authored combo matches.
      id: 'establishing_line',
      role: 'utterance',
      pool: monthlyReviewEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: monthlyReviewReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: monthlyReviewMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildMonthlyReviewTitle(filled),
      body: buildMonthlyReviewBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: monthlyReviewChoiceLabelPool,
        previewPool: monthlyReviewEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildMonthlyReviewTitle(filled: FilledSlots): string {
  const snippet = filled['title'] ?? 'the ledger closes for the month'
  return `Month in review: ${snippet}`
}

function buildMonthlyReviewBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const monthlyReviewCard: CardDefinition = defineCompositionalCard(
  monthlyReviewTemplate,
)
