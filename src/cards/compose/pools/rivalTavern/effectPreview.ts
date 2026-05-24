// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced effect-preview lines for the rival_tavern template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates
// `profile.immediateEffects` per choice); the snippet replaces only
// the readable string, never the kind / target / amount / tags.
// Narrator-voiced — gated on `effectKind` / `effectTag`, never on
// actor voice.
//
// The rival_tavern consequence surface at
// `expandedSeedGenerators.ts:5843-5996`:
//   - compete_on_price_profile:    customers patronage +8/+10, coin -12; delayed pressure -8
//   - host_counter_event_profile:  customers patronage +12/+10, coin -20; delayed pressure -12 / reputation +8
//   - improve_quality_profile:     reputation +12/+8, coin -15; delayed pressure -10
//   - spread_counter_rumour_profile: pressure -10 / rumour pressure +10
//   - negotiate_with_rival_profile:  pressure -12, reputation +4; delayed customers -6
//   - ignore_rival_profile:        delayed pressure +12 / customers -8 / regulars_loss +6

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_customer_gain',
      text: 'Crowds would drift back this way',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'customer' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for it',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_reputation_gain',
      text: "The house's standing would lift with this",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Rival pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
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
      id: 'pre_severity_state',
      text: 'The pull would ease off the books',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'severityAtLeast', value: 70 },
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
      text: 'The till would feel the move',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'The crowd at the door would tilt a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'The slate would carry the choice forward',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_a',
      text: 'A meter would lean back a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'The drift would carry into next week',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate for later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
