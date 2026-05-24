// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced effect-preview lines for the inspection template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates
// `profile.immediateEffects` per choice); the snippet replaces only
// the readable string, never the kind / target / amount / tags.
// Narrator-voiced — gated on `effectKind` / `effectTag`, never on
// actor voice.
//
// The inspection consequence surface at `issueSeedGenerators.ts:2795-3206`:
//   - clean_profile: areas.*.cleanliness +12..+20, pressure:inspection -12
//   - bribe_profile: coin -30, pressure:inspection -10, rumour +8
//   - hide_profile: pressure:inspection -6 (immediate), +6 delayed
//   - improve_food_safety_profile: stock.qty -15/-10, pressure:food_safety -10
//   - ignore_profile: delayed pressure +8
//   - cleaning_roster_profile: areas.*.cleanliness +10..+12, pressure:inspection -12
//   - preinspection_walkthrough_profile: coin -5, pressure:inspection -15
//   - ask_town_watch_for_guidance_profile: pressure:inspection -10, reputation +5

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_area_clean',
      text: 'The rooms would come back to order',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    // Phase 18 — additional state_change+area variants so multi-area
    // inspection choices spread snippets via FNV tie-break.
    {
      id: 'pre_area_clean_b',
      text: 'A station would line up cleaner by close',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_area_clean_c',
      text: 'The kitchen line would read presentable',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for it',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_stock_loss',
      text: 'Stock would leave the larder',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'stock' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Inspection pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_reputation_gain',
      text: 'Respect on the slate would lift a measure',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A risk of return would remain on the slate',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_cause_faction',
      text: 'The watch would weigh the gesture in its book',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_a',
      text: 'The reading would shift a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'The house would feel the choice',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'A measure would tilt the inspector’s page',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'The slate would carry the change forward',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_a',
      text: 'A meter would lean back a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'The drift would tilt the week',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate for later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
