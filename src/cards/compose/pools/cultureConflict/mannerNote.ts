// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Optional third-person sensory beat for the culture_conflict template —
// a glance across tables, a hush, a half-finished gesture toward the
// shrine, a chair turned a fraction wrong. Narrator-voiced; gated on
// prior-choice memories, calendar tags, and severity (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_tension',
      text: 'A few of them glance at the door, just once.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
      ],
    },
    {
      id: 'mnr_ignored_memory',
      text: 'One sets their cup down a little too hard.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'mnr_high_severity',
      text: 'Two of the older patrons watch from across the room.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_festival',
      text: 'A small charm has been laid on their table already.',
      conditions: [
        { kind: 'hasTag', tag: 'festival' },
      ],
    },
    {
      id: 'mnr_low_comfort',
      text: 'They sit with their chairs angled toward the entrance.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'mnr_culture_repeat',
      text: 'Their faces are familiar from the last several nights.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'culture', atLeast: 3 },
      ],
    },

    // Phase 18 repair: unconditional narrator beats at explicit
    // specificity 0 so the body fires SOMETHING when no state gate
    // above matches.
    {
      id: 'mnr_mild_glance',
      text: 'One of them glances toward the bar and back.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_quiet',
      text: 'Their corner sits a half-beat quieter than the rest.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_table',
      text: 'They lean closer over their table when the room shifts.',
      conditions: [],
      specificity: 0,
    },
  ],
}
