// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Flavor reaction line for the supplier_reliability template. The supplier
// (primaryActor) speaking in character to the owner; first-person voice
// driven by `voiceAxis` and `verbalTic` only. May show mood, manner,
// professionalism. Must not assert specific past events or named NPCs /
// factions. Emits the Phase-3 converged pool at
// `specs/cards/supplier_reliability.spec.yaml:400-471`.
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
      text: "Let's see what terms we can land.",
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'Tell me what the house needs.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: "Good to see you here. We'll find common ground.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: "Say what you want. Don't waste the daylight.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'At your service. Speak as the house requires.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_florid',
      text: "I've come with the morning still in my coat.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: "Speak plain. I've a route to make.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: "Look — we'll work something out, you and me.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal_restrained',
      text: 'I trust we may settle this as the house permits.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: "A small matter. Nothing the morning won't sort.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_qualifies',
      text: 'I think — probably — we can find a way through.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'I came to — well, to see where we stand.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_trails_off',
      text: 'About the last shipment — you understand…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. To both houses.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Steady. Steady is what I bring.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'My father always said — never short the house twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },

    // ─── Phase 149 / ISSUE-117 — state-keyed reactions ───────────────
    // The supplier's reaction should reflect their actual standing, not
    // just their voice profile. These spec-1 / spec-2 snippets fire on
    // signal bands / pressures / repeat / memory so a struggling
    // supplier sounds different from a thriving one even with the same
    // voice axes. The existing voice-keyed snippets above remain — they
    // resolve when state is neutral and voice is extreme.

    {
      id: 'rxn_state_low_reliability',
      text: "You'll forgive what the road's done to me lately.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_high_reliability',
      text: 'My trade speaks for itself, owner.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_low_relationship',
      text: "We'll keep this brief, then.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_high_relationship',
      text: 'Good to see you across the counter, friend.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_distrust',
      text: 'I know how this looks. Hear me through, owner.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
      ],
    },
    {
      id: 'rxn_state_market',
      text: "The trade's been like this for everyone this season.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'market_instability' },
      ],
    },
    {
      id: 'rxn_state_repeat',
      text: 'Third time at this counter, isn’t it.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'supplier', atLeast: 3 },
      ],
    },
    {
      id: 'rxn_state_warm_memory',
      text: "After what we did last quarter, you'll trust me here.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },
  ],
}
