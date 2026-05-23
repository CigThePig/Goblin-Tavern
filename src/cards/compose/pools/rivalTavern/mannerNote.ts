// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Optional third-person sensory beat for the rival_tavern template —
// a thinner ledger column, an empty stool at the bar, a quieter
// night, regulars settling at a different tavern's tables.
// Narrator-voiced; gated on prior-choice memories, severity, tone
// tags, and rising pressure (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_severity',
      text: 'The ledger column for the night sits thinner than expected.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_pressure_rising',
      text: 'An empty stool at the bar catches the lamplight.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'mnr_arc',
      text: "Word of the rival's name comes back over the bar.",
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
      ],
    },
    {
      id: 'mnr_compete_memory',
      text: 'The chalkboard prices need wiping down to be honest.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'mnr_ignored_memory',
      text: 'The same gap on the floor as the last closing.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'mnr_repeat',
      text: 'The same pull, the same closing, again.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'rival', atLeast: 3 },
      ],
    },
  ],
}
