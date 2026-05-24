// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced effect-preview lines for the debt_rent template. Each composed
// line corresponds 1-to-1 to a real EffectPreview by construction
// (composeChoicesFromSeed iterates profile.immediateEffects per choice);
// the snippet replaces only the readable string, never the kind / target
// / amount / tags. Narrator-voiced — gated on `effectKind` / `effectTag`,
// never on actor voice.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    {
      id: 'pre_coin_out',
      text: 'Coin would leave the till for the landlord',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_landlord_ease',
      text: "The landlord's mood would settle a notch",
      conditions: [
        { kind: 'effectTag', tag: 'landlord' },
      ],
    },
    {
      id: 'pre_debt_climb',
      text: 'The debt column would lengthen further',
      conditions: [
        { kind: 'effectTag', tag: 'debt' },
      ],
    },
    {
      id: 'pre_rent_paid',
      text: 'The month would close with rent settled',
      conditions: [
        { kind: 'effectTag', tag: 'rent' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'The pressure would lift a measure off the room',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_future_loan_due',
      text: 'A loan would come due in time',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_pressure_a',
      text: 'A meter would lean a touch further',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'The ledger would tilt another column',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_c',
      text: 'The drift would carry into next month',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate for later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_future_visit',
      text: 'The landlord would loop back to the door',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_state_change_a',
      text: 'The books would shift a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'The till would feel the move',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
  ],
}
