// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Voiced effect-preview lines for the violence template. Each composed
// line corresponds 1-to-1 to a real EffectPreview by construction
// (`composeChoicesFromSeed` iterates `profile.immediateEffects` per
// choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on
// `effectKind` / `effectTag`, never on actor voice.
//
// The violence consequence surface at `issueSeedGenerators.ts:2184-2322`:
//   - hire_security_profile: coin -20, pressure:violence -15 (+delayed)
//   - ban_group_profile: customer.patronage -25, pressure:violence -12
//   - embrace_rowdy_profile: reputation.dangerous +6, reputation.respectable -4
//   - repair_damage_profile: area.damage -20, coin -12 (+delayed)

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for it',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_customer_loss',
      text: 'That table would empty for the season',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'customer' },
      ],
    },
    {
      id: 'pre_reputation_dangerous',
      text: 'The house would gain a rougher name',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Violence pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_area_repair',
      text: 'The room would come back to order',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
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
      id: 'pre_cause_group',
      text: 'The group would feel the blow personally',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
      ],
    },
  ],
}
