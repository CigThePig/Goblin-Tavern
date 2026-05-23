// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced effect-preview lines for the food_safety template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates
// `profile.immediateEffects` per choice); the snippet replaces only
// the readable string, never the kind / target / amount / tags.
// Narrator-voiced — gated on `effectKind` / `effectTag`, never on
// actor voice.
//
// The food_safety consequence surface at `issueSeedGenerators.ts:202-310`:
//   - discard_stock_profile: stock.qty -20, pressure:food_safety -12
//   - clean_kitchen_profile: areas.kitchen.cleanliness +25, pressure -10
//   - serve_anyway_profile: coin +15, pressure:food_safety +8, pressure:inspection +6
//   - blame_supplier_profile: cause-only

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_stock_loss',
      text: 'Stock would leave the larder',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'stock' },
      ],
    },
    {
      id: 'pre_area_clean',
      text: 'The kitchen would come back to order',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_coin_gain',
      text: 'Coin would still come in from the trays',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Food safety pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A rumour would sit on the slate, waiting to surface',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_blame_cause',
      text: 'The blame would land elsewhere, for now',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
      ],
    },
    {
      id: 'pre_reputation_drag',
      text: 'Respect on the floor would dip a measure',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
  ],
}
