// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Voiced effect-preview lines for the culture_conflict template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (composeChoicesFromSeed iterates profile.immediateEffects
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag` / situational tags, never on actor voice.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    {
      id: 'pre_culture_state',
      text: 'The group would settle a notch by evening',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'culture' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for the gesture',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Cultural tension would loosen its grip',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_reputation_shift',
      text: 'The house would be read as taking a side',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_staff_strain',
      text: 'Staff would carry the strain of the moment',
      conditions: [
        { kind: 'effectTag', tag: 'pressure' },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A backlash may surface in the days ahead',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_room',
      text: 'The room would tilt with the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_count',
      text: 'The count would shift a measure',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_thread',
      text: 'Another thread would tighten through the floor',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_settle',
      text: 'The mood would settle a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_lean',
      text: 'A meter would lean back a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_drift',
      text: 'The drift would carry through to next week',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A thread would loop back round later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
  ],
}
