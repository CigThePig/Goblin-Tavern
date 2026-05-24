// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Optional third-person sensory beat for the reputation_shift template
// — a different crowd at the door, an emptied stool, regulars settling
// deeper into their corner, a coin tally tilted toward an unfamiliar
// hand. Narrator-voiced; gated on prior-choice memories, severity, tone
// tags, and rising pressure (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_severity',
      text: 'The door swings on a different rhythm tonight.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_pressure_rising',
      text: 'The till sits heavier in one column, thinner elsewhere.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'mnr_axis_cozy',
      text: 'A corner table fills before the front benches do.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.cozy' },
      ],
    },
    {
      id: 'mnr_axis_dangerous',
      text: 'The shoulders at the bar carry a wider stance tonight.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.dangerous' },
      ],
    },
    {
      id: 'mnr_embraced_memory',
      text: 'The room looks like a place that chose itself.',
      conditions: [
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'mnr_repeat',
      text: 'The same drift, the same closing, again.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'reputation', atLeast: 3 },
      ],
    },

    // Phase 18 repair: spec-0 unconditional fillers so the body fires.
    {
      id: 'mnr_mild_door',
      text: 'A regular slows near the door and looks around.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_lamp',
      text: 'The lamp over the bar casts a warmer light.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_corner',
      text: 'A corner table sits emptier than the rest.',
      conditions: [],
      specificity: 0,
    },
  ],
}
