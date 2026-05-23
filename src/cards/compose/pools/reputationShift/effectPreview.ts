// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced effect-preview lines for the reputation_shift template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates
// `profile.immediateEffects` per choice); the snippet replaces only
// the readable string, never the kind / target / amount / tags.
// Narrator-voiced — gated on `effectKind` / `effectTag`, never on actor
// voice.
//
// The reputation_shift consequence surface at
// `issueSeedGenerators.ts:3380-3506`:
//   - embrace_profile:   reputation.<axis> +5; delayed +3 / future hook
//   - correct_profile:   reputation.<axis> -5, coin -10
//   - advertise_profile: customers.miners.patronage +8
//   - diversify_profile: reputation.<axis> -3, customers.merchants.patronage +4

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_reputation_state',
      text: 'The name would tilt with this',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'reputation' },
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
      id: 'pre_customer_gain',
      text: 'The targeted crowd would step through the door',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'customer' },
      ],
    },
    {
      id: 'pre_pressure_change',
      text: 'Drift pressure would shift on the slate',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'The identity might lock in further later',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_severity_reputation',
      text: 'The hard turn would settle one way',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
