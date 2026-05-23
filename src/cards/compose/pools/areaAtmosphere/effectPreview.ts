// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Voiced effect-preview lines for the area_atmosphere template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates `profile.immediateEffects`
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag` / situational tags, never on actor voice.
//
// The area_atmosphere consequence surface at `expandedSeedGenerators.ts:2574-2712`:
//   - repair_area_profile: area.condition +15, area.damage -15, coin -15
//   - clean_area_profile: area.cleanliness +20, area.smell -12, area.mess -10
//   - start_project_profile: coin -25, area.condition +10 (+ delayed)
//   - close_area_temporarily_profile: area.damage -8, area.cleanliness +10 (+ delayed pressure)
//   - rebrand_area_profile: reputation -8, area.condition +5 (+ delayed future_hook)
//   - ignore_area_problem_profile: only delayed pressure + decay

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_area_state',
      text: 'The room would steady its footing',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for the work',
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
      id: 'pre_reputation',
      text: 'Reputation would tilt with the gamble',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A risk would remain on the slate for later',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_severity_state',
      text: 'The worst of the rot would be turned back',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
