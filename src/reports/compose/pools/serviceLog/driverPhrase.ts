// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Lead phrase for the daily service-log Driver lines. Composed as:
//   `${phrase} ${driverName}.`
// The driver name stays sim-derived; only the lead phrase is voiced.
//
// Routing via seed.domain: driver_positive | driver_negative.
//
// Body cap 3 words ("Held back by").

import type { SnippetPool } from '../../../../cards/compose/types'

export const driverPhrasePool: SnippetPool = {
  slotId: 'phrase',
  snippets: [
    { id: 'dp_fallback', text: 'Driven by', conditions: [] },
    {
      id: 'dp_pos_boosted',
      text: 'Boosted by',
      conditions: [{ kind: 'hasTag', tag: 'driver_positive' }],
    },
    {
      id: 'dp_pos_lifted',
      text: 'Lifted by',
      conditions: [{ kind: 'hasTag', tag: 'driver_positive' }],
    },
    {
      id: 'dp_pos_carried',
      text: 'Carried by',
      conditions: [{ kind: 'hasTag', tag: 'driver_positive' }],
    },
    {
      id: 'dp_neg_held_back',
      text: 'Held back by',
      conditions: [{ kind: 'hasTag', tag: 'driver_negative' }],
    },
    {
      id: 'dp_neg_dragged',
      text: 'Dragged by',
      conditions: [{ kind: 'hasTag', tag: 'driver_negative' }],
    },
    {
      id: 'dp_neg_slowed',
      text: 'Slowed by',
      conditions: [{ kind: 'hasTag', tag: 'driver_negative' }],
    },
  ],
}
