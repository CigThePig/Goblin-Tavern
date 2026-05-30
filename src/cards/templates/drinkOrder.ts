// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// The first live compositional card. Wires the Phase-B `drink_order`
// spec through `defineCompositionalCard` so a real seed renders a
// composed `CardView` alongside the eight existing hand-written
// templates. `REQUIRED_CARDS` holds the mix; nothing else changes.
//
// Why this template attaches to `regular_customer` / `relationship_test`
// / `during_service`:
//
//   - `regular_customer` is the only seed family whose seeds carry an
//     actual regular as `primaryActor` (see
//     `src/sim/modules/issues/expandedSeedGenerators.ts:1063–1120`).
//     `customer_complaint` seeds put the customer GROUP as primaryActor.
//   - `relationship_test` is the milder branch of that family
//     (irritation ≤ 60); the `complaint` branch is already covered by
//     `customerComplaintCard`. No card today covers `relationship_test`
//     from this family — it falls through to the fallback. Plugging
//     drink_order in there fills a gap rather than fighting for it.
//   - `during_service` is the natural beat for "a regular speaks an
//     order line." Phase B's exemplars are written for that beat.
//
// The `custom` predicate insists the resolved regular has Phase-A
// `castAttributes` populated. Without them the voice conditions have
// nothing to read, so the template steps aside and the fallback
// renders — graceful degradation per framework §5.

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
  drinkOrderChoiceLabelPool,
  drinkOrderEffectPreviewPool,
  drinkOrderEstablishingLinePool,
  drinkOrderTitlePool,
  mannerNotePool,
  orderLinePool,
} from '../compose/pools/drinkOrder'

// Phase 124 / ISSUE-093: exported so the Phase-D gate harness (and
// Phase-E generation pipeline) can run structural checks against the
// template's slots + pools directly. `defineCompositionalCard` only
// returns a `CardDefinition`; the gates work on `CompositionalCardTemplate`.
export const drinkOrderTemplate: CompositionalCardTemplate = {
  id: 'regular_customer.drink_order',
  appliesTo: {
    seedFamilies: ['regular_customer'],
    seedTypes: ['relationship_test'],
    timings: ['during_service'],
    // Only fire when the regular we'd be voicing actually has Phase-A
    // attributes. Pre-Phase-A saves migrate via `ensureCastAttributes`,
    // but the predicate keeps the template safe even before that lands.
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'regular') return false
      return state.world.regulars[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 60,
  voiceRegister: 'tavern_floor',
  slots: [
    // Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5. The title is
    // now a composed slot with its own pool + 6-word budget. The
    // template glue (`buildDrinkOrderTitle`) prepends the regular's
    // display name to the chosen snippet without any clamping — the
    // voice-bounds gate forbids trailing "…" so titles are authored
    // short, never truncated.
    {
      id: 'title',
      role: 'title',
      pool: drinkOrderTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    // Phase 169 / ISSUE-137 — Complete Surface arc, Phase 2 (drinkOrder
    // Parity). Sim-backed establishing line that STATES the regular's
    // standing — the slot drinkOrder lacked while the other nineteen
    // migrated templates all opened on a salient fact. Lands before the
    // voiced `order_line` so the body reads "what's true of them" then
    // "what they say" — the staffAside / supplier_reliability shape.
    // `saliencePolicy: 'multi'` lets the assembler tie-break top-
    // specificity matches by salience (the regular_customer table reads
    // irritation × loyalty first) and append a secondary snippet covering
    // the next orthogonal fact within the combined budget; the authored
    // irritation × loyalty combo cells beat the join when both resolve.
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: drinkOrderEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    // Phase B budgets locked: order_line ≤ 12 words, manner_note ≤ 10 words
    // (`docs/plans/living-cast-arc-phase-b.md` §"Must-pass gates").
    // Phase D moves those numbers from the doc into the slot data so the
    // voice-bounds gate has a single source of truth.
    {
      id: 'order_line',
      role: 'utterance',
      pool: orderLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: mannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildDrinkOrderTitle(filled, seed, state),
      // Phase 169 / ISSUE-137 — body is now fully composed from slots:
      // [establishing_line, order_line, manner_note?]. The sim-backed
      // establishing_line carries the regular's standing, the order_line
      // carries their voice, the optional manner_note carries the beat.
      // The raw `seed.textIngredients.recentContext[0]` splice that used
      // to end the body is gone (the un-composed fragment dump).
      body: buildDrinkOrderBody(filled),
      stakes: buildStakes(seed, 2),
      // Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Choice
      // labels and effect-preview lines are composed through the
      // snippet pipeline. The sim's verb / targetId / shape / per-effect
      // (kind, target, amount, tags) are unchanged — only wording is
      // composed. Pool misses pass `slot.labelHint` / `effect.readable`
      // through verbatim.
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: drinkOrderChoiceLabelPool,
        previewPool: drinkOrderEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildDrinkOrderTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const regular =
    ref && ref.kind === 'regular' ? state.world.regulars[ref.id] : undefined
  const display = regular?.name.display ?? seed.textIngredients.subject ?? 'A regular'
  // Required slot with an unconditional fallback — `filled['title']` is
  // always defined in practice. The `?? 'orders a drink'` is defensive
  // only (mirrors the pool's fallback text).
  const snippet = filled['title'] ?? 'orders a drink'
  return `${display}: ${snippet}`
}

function buildDrinkOrderBody(filled: FilledSlots): string[] {
  // Phase 169 / ISSUE-137 — three composed slots, three voiced lines:
  // sim-backed standing, then the voiced order, then the optional beat.
  // No textIngredients splice — the cards-contract truth rule holds by
  // sourcing every body line from a gated, state-checked slot.
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const order = filled['order_line']
  if (order) lines.push(order)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const drinkOrderCard: CardDefinition = defineCompositionalCard(
  drinkOrderTemplate,
)
