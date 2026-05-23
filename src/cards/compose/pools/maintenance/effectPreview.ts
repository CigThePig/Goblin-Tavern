// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Voiced effect-preview lines for the maintenance template. Each composed
// line corresponds 1-to-1 to a real EffectPreview by construction
// (`composeChoicesFromSeed` iterates `profile.immediateEffects` per
// choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag` / situational tags, never on actor voice.
//
// The maintenance consequence surface at `issueSeedGenerators.ts:727-808`:
//   - repair_profile: area.damage -25, area.condition +20, coin -25, pressure -12
//   - patch_profile: area.damage -10, coin -8 (+ delayed future_hook)
//   - ignore_profile: only delayed pressure +6
//   - close_area_profile: area.risk -10, customer satisfaction -5

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_area_state',
      text: 'The damage would step back from the worst',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
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
      id: 'pre_pressure_ease',
      text: 'Maintenance pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_customer_loss',
      text: 'Regulars would feel the closure at the door',
      conditions: [
        { kind: 'effectTag', tag: 'customer' },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A risk of failure would remain on the slate',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_severity_state',
      text: 'The worst of the wear would be set right',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
