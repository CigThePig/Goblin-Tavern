// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Voiced effect-preview lines for the monthly_review template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag`, never on actor voice.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
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

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_pressure_a',
      text: 'A meter would lean back a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'The ledger drift would carry forward',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_c',
      text: 'A column would settle into a quieter shape',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread_a',
      text: 'A reminder would sit on the slate for later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_future_thread_b',
      text: 'A thread would loop back round in time',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
