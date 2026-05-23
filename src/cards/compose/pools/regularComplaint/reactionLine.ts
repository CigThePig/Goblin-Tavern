// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Flavor reaction line for the regular_complaint template. The regular
// (primaryActor) speaking in character to the owner; first-person
// voice driven by `voiceAxis` and `verbalTic` only. May show mood,
// scorn, disappointment, weariness. Must not assert specific past
// events or named NPCs / factions.
//
// Four rungs:
//   - base    (specificity 0)  one unconditional fallback
//   - middle  (specificity 1)  single-axis snippets (COMMON rung)
//   - top     (specificity 2)  two-axis snippets (RARE rung)
//   - tic     (specificity 1)  one snippet per registered verbal tic

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'I came in for warmth. The bench is cold today.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: "Say something. I'm waiting.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: "You know me, owner. I wouldn't say it lightly.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: "Don't waste my time, owner. Just answer me.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'I would not raise this lightly, owner.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_florid',
      text: "The ale tastes like a winter I don't remember.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: "Fix it or I'm done here.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: "Look, I want to keep coming, but something's slipping.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal_restrained',
      text: 'I must speak plainly, before others follow.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_qualifies',
      text: "It's fine. Mostly. Except for, well, today.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: "I came in — never mind, it doesn't matter.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_understates',
      text: "A small thing, maybe, but it's been on my mind.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: "I'm saying it. I'm saying it, and I mean it.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_trails_off',
      text: 'I came in for the usual, but…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'I am still here. That should count for something.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'My old uncle said — silence is the worst review.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },
  ],
}
