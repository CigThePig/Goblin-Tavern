// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Voiced effect-preview lines for the monthly_review template. Each
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
      id: 'pre_coin_rent',
      text: 'Coin would leave the till for the landlord',
      conditions: [
        { kind: 'effectTag', tag: 'rent' },
      ],
    },
    {
      id: 'pre_landlord_ease',
      text: "The landlord's mood would ease a notch",
      conditions: [
        { kind: 'effectTag', tag: 'landlord' },
      ],
    },
    {
      id: 'pre_cellar_improve',
      text: 'The cellar would gain ground on the books',
      conditions: [
        { kind: 'effectTag', tag: 'cellar' },
      ],
    },
    {
      id: 'pre_rival_cool',
      text: 'The rival pressure would settle for a stretch',
      conditions: [
        { kind: 'effectTag', tag: 'rival' },
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
      text: 'A consequence would surface next month',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
  ],
}
