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
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
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
      title: buildDrinkOrderTitle(seed, state),
      // The order_line snippet IS the body's voice line (Phase B caps
      // it at 12 words — body budget, not title budget). manner_note,
      // when present, follows as a physical aside; sensory + recent
      // ingredients ground the moment after.
      body: buildDrinkOrderBody(filled, seed),
      stakes: buildStakes(seed, 2),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => ({ maxPreview: 2 }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildDrinkOrderTitle(seed: IssueSeed, state: TavernState): string {
  const ref = seed.primaryActor
  const regular =
    ref && ref.kind === 'regular' ? state.world.regulars[ref.id] : undefined
  const display = regular?.name.display ?? seed.textIngredients.subject ?? 'A regular'
  return formatTitle([`${display}:`, 'orders a drink'])
}

function buildDrinkOrderBody(filled: FilledSlots, seed: IssueSeed): string[] {
  const lines: string[] = []
  const order = filled['order_line']
  if (order) lines.push(order)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  if (seed.textIngredients.recentContext[0]) {
    lines.push(seed.textIngredients.recentContext[0])
  }
  return lines.slice(0, 3)
}

export const drinkOrderCard: CardDefinition = defineCompositionalCard(
  drinkOrderTemplate,
)
