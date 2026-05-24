// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb phrase for the Yesterday Digest secondary line. The projection
// composes the final reputation/pressure secondary line as
// `${label} ${verb} ${signed(delta)}`. The verb is voiced here per
// (kind, direction); the label and figure stay structural.
//
// Routing via seed.domain carrying one of:
//   reputation_gain, reputation_loss, reputation_hold,
//   pressure_rise_small, pressure_rise_mid, pressure_rise_large
//
// Body cap 2 words (most snippets are single words; "ticked up" is 2).

import type { SnippetPool } from '../../../../cards/compose/types'

export const secondaryVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    // — Fallback —
    {
      id: 'yd_fallback',
      text: 'shifted',
      conditions: [],
    },

    // — Reputation gain —
    {
      id: 'yd_rep_rose',
      text: 'rose',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain' }],
    },
    {
      id: 'yd_rep_climbed',
      text: 'climbed',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain' }],
    },

    // — Reputation loss —
    {
      id: 'yd_rep_fell',
      text: 'fell',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss' }],
    },
    {
      id: 'yd_rep_slipped',
      text: 'slipped',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss' }],
    },

    // — Reputation hold —
    {
      id: 'yd_rep_held',
      text: 'held',
      conditions: [{ kind: 'hasTag', tag: 'reputation_hold' }],
    },

    // — Pressure rise (small / mid / large) —
    {
      id: 'yd_pres_creeping',
      text: 'creeping',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_small' }],
    },
    {
      id: 'yd_pres_rising',
      text: 'rising',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_mid' }],
    },
    {
      id: 'yd_pres_surging',
      text: 'surging',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_large' }],
    },
  ],
}
