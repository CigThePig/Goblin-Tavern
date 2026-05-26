// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Flavor reaction line for the violence template. The customer group
// (primaryActor) speaking in first-person voice via `voiceAxis` and
// `verbalTic` only. May show defiance, swagger, threat, cold
// contempt, ironic complaint. Must not assert specific past events
// or invent named NPCs.
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
      text: 'You will want to settle this before it settles itself.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'We have business. Stand aside.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: 'No quarrel with you, friend; we just want our due.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: 'Mark this room. Mark the night.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'We present a grievance and expect it answered tonight.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_informal',
      text: "Look, you serve us or you do not.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_florid',
      text: 'The night has put its hand on our shoulder.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: 'No words spare. Settle it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: 'Look, we can settle this between us, can we not?',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: 'A small disagreement. Surely the house can soothe it.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'We came to — well, to settle a thing tonight.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. To everyone at this table.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Now. Now, before the cup goes cold.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'Our elders used to say — patience runs out faster than coin.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Spec-1 state-keyed snippets so the cohort's reply reflects its
    // actual standing rather than standing fixed on voice axes alone.
    // First-person plural "we" framing throughout (cohort speaking,
    // not an individual). Pairs `pressureRising` / `repeatCount` with
    // `memoryPresent` where the line carries a history cue so
    // simCoherence's flavor-mode history-claim detector stays quiet.
    {
      id: 'rxn_state_high_rowdiness',
      text: 'We are loud and we are not stopping for you.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_low_satisfaction',
      text: 'We came in wronged, and the night has not mended it.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_high_damage',
      text: 'Look around; this room was bruised before we sat down.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_rowdy_unhappy',
      text: 'We do not owe this place gentleness tonight.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_pressure_brawl',
      text: 'We know how this one ends; we have been there.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'violence' },
        { kind: 'memoryPresent', tag: 'brawl' },
      ],
    },
    {
      id: 'rxn_state_security_repeat',
      text: 'Your hired shoulders have not changed how we drink here.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'violence', atLeast: 3 },
        { kind: 'memoryPresent', tag: 'security' },
      ],
    },
  ],
}
