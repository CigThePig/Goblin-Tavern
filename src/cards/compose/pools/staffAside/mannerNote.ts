// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
// Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18 (repair).
//
// Committed snippet pool for the `manner_note` slot — an optional
// physical-beat companion to the `aside_line`. No fallback: when no
// snippet matches the staff member's voice, the slot omits silently
// (framework §2.4 "silence beats weak copy"). All flavor; no checkable
// claim asserted by any line.
//
// Phase 18 repair: the original 5 snippets all required voice extremes
// (atLeast: 2 or atMost: 0). Moderate-voiced staff (the bulk of the
// cast under `[-1,0,0,1]` perturbation) matched nothing, the slot
// omitted, and the body collapsed to 2 lines. The repair adds four
// `atLeast: 1` mid-rung snippets at explicit `specificity: 0` so they
// fill the gap for neutral actors WITHOUT outranking the extreme
// snippets when those match. The extreme rung and the two-axis combo
// keep their original priorities — every prior test still expects the
// same snippet for the same actor.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    // — top rung: two-axis combo (specificity 2) —
    {
      id: 'manner_cold_sleeves',
      text: 'They roll their sleeves before answering.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
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

    // — middle rung: single voice extreme (specificity 1) —
    {
      id: 'manner_warm_kettle',
      text: 'They start the kettle without being asked.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'manner_terse_nod',
      text: 'They give the question a single nod.',
      conditions: [
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
      id: 'manner_qualifies_wipe',
      text: 'They wipe the same spot twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // — base rung: `atLeast: 1` mid-bias fallbacks (explicit spec 0)
    //   so neutral-leaning actors fire SOMETHING without outranking the
    //   sharper rungs above.
    {
      id: 'manner_mild_warm',
      text: 'They glance at the door before settling in.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_formal',
      text: 'They wait until the kettle settles to speak.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_terse',
      text: 'They shift the cloth from one hand to the other.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'manner_mild_florid',
      text: 'They smooth their apron as if rehearsing.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },
  ],
}
