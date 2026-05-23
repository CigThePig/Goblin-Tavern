// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Voiced effect-preview lines for the seasonal_arc template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag`, never on actor voice.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_coin_out',
      text: 'Coin would leave the till for this',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_arc_ease',
      text: 'The arc pressure would settle a notch',
      conditions: [
        { kind: 'effectTag', tag: 'arc' },
      ],
    },
    {
      id: 'pre_reputation',
      text: 'Reputation would shift along the row',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_stock',
      text: 'The stock columns would change shape',
      conditions: [
        { kind: 'effectTag', tag: 'stock' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'A pressure would lift a measure off the room',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A consequence would surface later in the arc',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
  ],
}
