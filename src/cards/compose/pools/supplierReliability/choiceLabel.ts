// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced labels for the supplier_reliability template's response choices.
// Voice register `trade_floor`. Verb-gated × voice-axis combinations cover
// pay, negotiate, blame, ignore, fire (switch supplier), buy (accept
// suspicious goods). The synthetic slot is `optional: true` so an
// unmatched seed falls back to the sim's verbatim `slot.labelHint`.
//
// The supplier's allowedVerbs surface at `expandedSeedGenerators.ts:1189-1255`
// — pay / negotiate / blame / fire / buy / ignore / inspect. Six rungs
// cover the dramatic spread; the rest take the fallback.
//
// Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3 (Choice
// Distinctness). The eleven supplier response slots include four
// same-first-verb collision sets that the verb-only Phase-135 snippets
// can't disambiguate:
//   - `negotiate_supplier` and `supplier_exclusivity_deal` both lead
//     with verb `negotiate` ⇒ a terse-axis supplier rendered both as
//     the identical "Cut the terms shorter".
//   - `place_standing_order` and `split_orders` both lead with verb
//     `buy` ⇒ both fell through to `slot.labelHint` (visibly different
//     today, but the pool grew no voiced buy snippets to be safe).
//   - `inspect_delivery` and `investigate_suspicious_goods` both lead
//     with verb `inspect` ⇒ same exposure if a voiced inspect snippet
//     ever landed.
// Layer D adds slot-distinct snippets gated on the new
// `responseSlot { anyOf }` condition primitive (Phase 148 / Layer A).
// Specificity gradient does the rest — a `responseSlot` match (1
// condition) ranks below a `responseSlot + voiceAxis` combo (2
// conditions), so the older verb-only snippets stay reachable when
// they apply to non-colliding slots (e.g. `negotiate_supplier` alone
// still hits `label_negotiate_terse`; `supplier_exclusivity_deal`
// now hits its own slot-specific snippet at equal-or-higher
// specificity). The Phase-3 `choiceDistinctness` gate proves it.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_pay_formal',
      text: 'Settle their account',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_warm',
      text: 'Find common ground',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_negotiate_terse',
      text: 'Cut the terms shorter',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_blame_cold',
      text: 'Pin it on the wagon',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_ignore_terse',
      text: 'Wave the offer off',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_fire_cold',
      text: 'Send them down the road',
      conditions: [
        { kind: 'responseVerb', anyOf: ['fire'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    // Phase 148 / ISSUE-116 — Layer D. Slot-distinct snippets for the
    // four same-first-verb collision sets. The single-condition
    // `responseSlot` snippets carry explicit `specificity: 2` so they
    // out-rank the existing 2-condition `responseVerb + voiceAxis`
    // snippets (which are the right pick for non-colliding same-verb
    // slots — `negotiate_supplier` keeps "Cut the terms shorter" — but
    // must lose to a slot-targeted snippet for the colliding peer).
    // Intent: a snippet keyed on one specific slot id is structurally
    // more specific than one keyed on a verb that matches multiple
    // slots. The two-condition variants (responseSlot + voiceAxis)
    // carry `specificity: 3` so they out-rank both base rungs and the
    // verb+axis layer.
    {
      id: 'label_exclusivity_deal',
      text: 'Sign exclusivity now',
      specificity: 2,
      conditions: [
        { kind: 'responseSlot', anyOf: ['supplier_exclusivity_deal'] },
      ],
    },
    {
      id: 'label_exclusivity_deal_warm',
      text: 'Lock them in close',
      specificity: 3,
      conditions: [
        { kind: 'responseSlot', anyOf: ['supplier_exclusivity_deal'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_standing_order',
      text: 'Lock in standing order',
      specificity: 2,
      conditions: [
        { kind: 'responseSlot', anyOf: ['place_standing_order'] },
      ],
    },
    {
      id: 'label_standing_order_formal',
      text: 'Set the weekly volume',
      specificity: 3,
      conditions: [
        { kind: 'responseSlot', anyOf: ['place_standing_order'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'label_split_orders',
      text: 'Split orders two ways',
      specificity: 2,
      conditions: [
        { kind: 'responseSlot', anyOf: ['split_orders'] },
      ],
    },
    {
      id: 'label_split_orders_terse',
      text: 'Spread the risk',
      specificity: 3,
      conditions: [
        { kind: 'responseSlot', anyOf: ['split_orders'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'label_investigate_goods',
      text: 'Investigate the goods',
      specificity: 2,
      conditions: [
        { kind: 'responseSlot', anyOf: ['investigate_suspicious_goods'] },
      ],
    },
    {
      id: 'label_investigate_goods_formal',
      text: 'Audit the shipment',
      specificity: 3,
      conditions: [
        { kind: 'responseSlot', anyOf: ['investigate_suspicious_goods'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
  ],
}
