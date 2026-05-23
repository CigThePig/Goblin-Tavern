// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Title pool for the culture_conflict compositional template. Template
// glue prepends the culture's label as `${culture.label}: ${snippet}`.
// Culture labels run 1–3 words ("Local Goblins", "Road Merchants");
// snippet text stays ≤ 6 words. Narrator-voiced — gated on state, not
// on actor voice. Phase 5 forbids trailing "…" and immediate duplicate
// tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'tension across the room',
      conditions: [],
    },
    {
      id: 'title_high_tension',
      text: 'a snapping cord of nerves',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
      ],
    },
    {
      id: 'title_low_comfort',
      text: 'an unsettled corner',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'title_low_familiarity',
      text: 'strangers and old customs',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
      ],
    },
    {
      id: 'title_festival',
      text: 'festival nerves rising',
      conditions: [
        { kind: 'hasTag', tag: 'festival' },
      ],
    },
    {
      id: 'title_cultural_rising',
      text: 'friction in the room',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },
  ],
}
