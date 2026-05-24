// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Voiced verb for the Yesterday Digest coin line, optional addition
// to the existing structured "Coin BEFORE → AFTER (DELTA)" line. The
// projection currently renders the structured form; this pool gives
// it a small voiced *direction* prefix when desired.
//
// Routing via seed.domain: coin_gain / coin_loss / coin_flat.
//
// Body cap 1 word — single verbs only.

import type { SnippetPool } from '../../../../cards/compose/types'

export const coinVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    {
      id: 'coin_fallback',
      text: 'shifted',
      conditions: [],
    },
    {
      id: 'coin_climbed',
      text: 'climbed',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain' }],
    },
    {
      id: 'coin_gathered',
      text: 'gathered',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain' }],
    },
    {
      id: 'coin_dropped',
      text: 'dropped',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss' }],
    },
    {
      id: 'coin_thinned',
      text: 'thinned',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss' }],
    },
    {
      id: 'coin_held',
      text: 'held',
      conditions: [{ kind: 'hasTag', tag: 'coin_flat' }],
    },
  ],
}
