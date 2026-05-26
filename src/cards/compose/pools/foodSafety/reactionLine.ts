// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Flavor reaction line for the food_safety template. The cook
// (primaryActor) speaking in first-person voice driven by `voiceAxis`
// and `verbalTic` only. May show worry, denial, bargaining, deference,
// exasperation. Must not assert specific past events or invent named
// NPCs.
//
// Four rungs:
//   - base   (specificity 0) one unconditional fallback
//   - middle (specificity 1) single-axis snippets
//   - top    (specificity 2) two-axis snippets
//   - tic    (specificity 1) one snippet per registered verbal tic

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'It is bad. We need to decide before service.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'Bad. Decide quick.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: 'I know it is hard; we will get through it together.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: 'Make no mistake; it will not stand for service today.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'I must put it before you: the kitchen cannot stand as is.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_informal',
      text: 'Look, the kitchen will not pretend to be fine today.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: 'No softer words. The kitchen is bad.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: 'Listen, we can sort it; say where you want me to start.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: 'A small thing in the kitchen. Worth a glance.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_qualifies',
      text: 'I think — probably — it ought not go out as is.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'The kitchen is — well, the kitchen needs your call.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. We cannot send out food like this.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Bad. Bad enough that I came to find you.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Spec-1 state-keyed snippets so the cook's reaction line reflects
    // her actual standing instead of standing fixed on voice axes
    // alone. First-person framing throughout (the cook speaking).
    // Pairs `pressureRising` and `repeatCount` with `memoryPresent`
    // where the line carries a history cue so simCoherence's
    // flavor-mode history-claim detector stays quiet.
    {
      id: 'rxn_state_low_clean',
      text: 'I cannot pretend the place is fine today.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_high_stress',
      text: 'I am holding the line and it is slipping.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_high_fatigue',
      text: 'My hands are slower than I want them to be.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_stress_fatigue',
      text: 'I am wrung out before service has even begun.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_warning_pressure',
      text: 'We said this would come; here it is on my counter.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'food_safety' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'rxn_state_kitchen_repeat',
      text: 'Same kitchen trouble, three mornings out of four now.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'food_safety', atLeast: 3 },
        { kind: 'memoryPresent', tag: 'kitchen' },
      ],
    },
  ],
}
