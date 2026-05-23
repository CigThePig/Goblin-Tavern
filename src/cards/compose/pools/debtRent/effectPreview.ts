// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced effect-preview lines for the debt_rent template. Each composed
// line corresponds 1-to-1 to a real EffectPreview by construction
// (composeChoicesFromSeed iterates profile.immediateEffects per choice);
// the snippet replaces only the readable string, never the kind / target
// / amount / tags. Narrator-voiced — gated on `effectKind` / `effectTag`,
// never on actor voice.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
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
  ],
}
