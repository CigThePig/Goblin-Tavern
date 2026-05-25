// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Flavor reaction line for the staff_burnout compositional template.
// The staff member (primaryActor) speaking in character to the owner;
// first-person voice driven by `voiceAxis` and `verbalTic` only. May
// show mood, weariness, professionalism, attitude. Must not assert a
// specific past event, named NPC, faction, or debt history.
//
// Four rungs mirror the staff_aside aside_line shape:
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
      text: 'I came in early. The room asks for steadier hands.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: "Tell me what you need. I'll do it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: "You look worn yourself. We'll see it through together.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: "If there's a problem, name it. I'll deal.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'At your service, as the house requires.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_florid',
      text: "Sleep tasted like ash. The kettle's hot anyway.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: "Say what's needed. I'll handle it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: "Look — I'm not going anywhere. We sort it together.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal_restrained',
      text: 'I shall serve, but the strain bears mention.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_qualifies',
      text: "It's fine, I think. Mostly. Probably.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: "I'm — well, I'm here. That should count for something.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_understates',
      text: 'A small thing, perhaps. I thought you should know.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: "I'll show. I'll show, and I'll show properly.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_trails_off',
      text: 'I just wanted to say — well, you know…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'I am still here. That part should count.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'My old master said — show up first, complain after.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },

    // ─── Phase 150 / ISSUE-118 — state-keyed reactions ───────────────
    // First-person cook reactions that reflect actual standing rather
    // than just voice axes. The cook stays the same character across
    // these — voice persists as a layer — but a tense cook sounds
    // distinct from a tired cook even with the same axes.

    {
      id: 'rxn_state_high_stress',
      text: "I'm pulled tight. Tell me plain what you need.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_high_fatigue',
      text: "I'm slow today. I'll work careful, not fast.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_burnout',
      text: "The load's been climbing. I came to ask before it broke.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'rxn_state_loyalty_risk',
      text: "I've been pulling away. Wanted to say it to you direct.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'rxn_state_bonus_memory',
      text: "The bonus carried me a stretch. Now the wind's gone out.",
      conditions: [
        { kind: 'memoryPresent', tag: 'bonus' },
      ],
    },
    {
      id: 'rxn_state_workload_memory',
      text: "That lighter rota helped. It's squeezing back tight already.",
      conditions: [
        { kind: 'memoryPresent', tag: 'workload' },
      ],
    },
    {
      id: 'rxn_state_repeat',
      text: "Third ask in a stretch. I'd rather not need a fourth.",
      conditions: [
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },
    {
      id: 'rxn_state_fatigue_bonus',
      text: "I'm worn through, even after the bonus. Wanted you to know.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        { kind: 'memoryPresent', tag: 'bonus' },
      ],
    },
  ],
}
