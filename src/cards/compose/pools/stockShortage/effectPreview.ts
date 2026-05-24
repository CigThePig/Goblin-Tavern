// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced effect-preview lines for the stock_shortage template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag` / situational tags, never on actor voice.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_stock_state',
      text: 'The shelves would steady by evening',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'stock' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for the cellar',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_quality_loss',
      text: 'The pour would taste thinner for it',
      conditions: [
        { kind: 'effectTag', tag: 'quality' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'The shortage pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_customer_grumble',
      text: 'Regulars would feel the change at the bar',
      conditions: [
        { kind: 'effectTag', tag: 'customer' },
      ],
    },
    {
      id: 'pre_rumor_future',
      text: 'A rumour might surface from this later',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_a',
      text: 'The cellar count would shift a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'The shelf tally would move a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'The pour line would feel the choice',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'The bar would carry the change through service',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_a',
      text: 'A meter would lean back a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'The drift would tilt the close',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate for later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
