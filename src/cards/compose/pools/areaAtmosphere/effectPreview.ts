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
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    {
      id: 'pre_area_state',
      text: 'The room would steady its footing',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    // Phase 18 — additional state_change+area variants so multiple
    // area-tagged effects on one card resolve to different snippets via
    // the FNV tie-break.
    {
      id: 'pre_area_state_b',
      text: 'The walls would read cleaner by service',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_area_state_c',
      text: 'The room would carry the work',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_area_state_d',
      text: 'The floor would hold the change through the night',
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

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_floor',
      text: 'The floor would feel the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_wear',
      text: 'The wear would walk back a step',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_breath',
      text: 'The room would breathe a bit easier',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_meter',
      text: 'The reading would shift a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_lean',
      text: 'The drift would lean back a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_thread',
      text: 'Another thread would join the slate',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
