// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb phrase for the Missed Opportunities `secondary` line. The
// projection composes the final line as
// `${pressureLabel} ${verb} ${signed(delta)} to ${value}.` — the verb
// is voiced here, the labels and figures stay structural.
//
// Delta magnitude routes via `seed.domain` carrying one of:
//   trend_small (|delta| ≤ 3), trend_mid (3 < |delta| ≤ 8),
//   trend_large (|delta| > 8). All routed by the section composer.

import type { SnippetPool } from '../../../../cards/compose/types'

export const secondaryVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    {
      id: 'verb_fallback',
      text: 'rose',
      conditions: [],
    },
    {
      id: 'verb_climbed',
      text: 'climbed',
      conditions: [],
    },
    {
      id: 'verb_ticked',
      text: 'ticked up',
      conditions: [{ kind: 'hasTag', tag: 'trend_small' }],
    },
    {
      id: 'verb_crept',
      text: 'crept up',
      conditions: [{ kind: 'hasTag', tag: 'trend_small' }],
    },
    {
      id: 'verb_surged',
      text: 'surged',
      conditions: [{ kind: 'hasTag', tag: 'trend_large' }],
    },
    {
      id: 'verb_spiked',
      text: 'spiked',
      conditions: [{ kind: 'hasTag', tag: 'trend_large' }],
    },
  ],
}
