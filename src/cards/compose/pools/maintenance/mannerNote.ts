// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Optional third-person sensory beat for the maintenance template — the
// boards underfoot, dust drifting from a beam, a board's whine when
// nudged. Narrator-voiced; gated on prior-choice memories, severity,
// tone tags, and rising pressure (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_severity',
      text: 'The board groans softly when you put weight on it.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_ignored_memory',
      text: 'Old splinters mark where this was passed over before.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'mnr_patch_memory',
      text: 'A coat of patch already darkens the same spot.',
      conditions: [
        { kind: 'memoryPresent', tag: 'patch' },
      ],
    },
    {
      id: 'mnr_pressure_rising',
      text: 'Dust drifts down each time the door slams shut.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'mnr_inspection_relevant',
      text: 'A clipboard would linger on this corner.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_relevant' },
      ],
    },
    {
      id: 'mnr_repeat',
      text: 'The same wear, in the same place, again.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'maintenance', atLeast: 3 },
      ],
    },

    // Phase 18 repair: spec-0 unconditional fillers so the body fires.
    {
      id: 'mnr_mild_board',
      text: 'A board settles under your boot as you cross.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_corner',
      text: 'The corner sits darker than the rest of the room.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_handle',
      text: 'A door handle hangs a fraction loose.',
      conditions: [],
      specificity: 0,
    },
  ],
}
