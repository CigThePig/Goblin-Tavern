// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
//
// Committed snippet pool for the `manner_note` slot — an optional
// physical-beat companion to the `aside_line`. No fallback: when no
// snippet matches the staff member's voice, the slot omits silently
// (framework §2.4 "silence beats weak copy"). All flavor; no checkable
// claim asserted by any line.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'manner_warm_kettle',
      text: 'They start the kettle without being asked.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'manner_cold_sleeves',
      text: 'They roll their sleeves before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'manner_formal_stand',
      text: 'They stand a little straighter than the room asks.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'manner_florid_smile',
      text: 'Their smile fits like a borrowed coat.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'manner_qualifies_wipe',
      text: 'They wipe the same spot twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
  ],
}
