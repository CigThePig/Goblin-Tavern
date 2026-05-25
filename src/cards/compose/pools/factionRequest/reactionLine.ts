// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Flavor reaction line for the faction_request template. The faction
// (primaryActor) speaking in character via first-person voice driven by
// `voiceAxis` and `verbalTic` only. May show mood, manner, authority,
// urgency. Must not assert specific past events or invent named NPCs.
//
// Four rungs:
//   - base   (specificity 0)  one unconditional fallback
//   - middle (specificity 1)  single-axis snippets (COMMON rung)
//   - top    (specificity 2)  two-axis snippets (RARE rung)
//   - tic    (specificity 1)  one snippet per registered verbal tic

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'We have come to settle a matter between our houses.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'Hear our terms; decide.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: 'You know us; we come in good faith today.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: 'Make no mistake about why we stand here.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'Our house presents a request, in due form.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_florid',
      text: 'We bring the morning and a long memory with us.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: 'No softer words. Answer us plain.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: 'Look, we can sort this out between friends.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal_restrained',
      text: 'We trust the house will weigh our petition fairly.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: 'A small thing. Surely the house can oblige.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_qualifies',
      text: 'I think — perhaps — we share an interest here.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'We came to — well, to lay out a proposal.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_trails_off',
      text: 'There is the matter from last season — you recall…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. To everyone here.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Plain. Plain dealing is all we ask.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'Our elders used to say — debts unpaid breed worse than coin.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },

    // ─── Phase 152 / ISSUE-120 — state-keyed reaction snippets ──────
    // The faction speaks in first person; state-keyed snippets fire
    // orthogonally to voice. Each carries ≥1 sim primitive so the
    // faction's reply reflects their actual standing, not only voice.
    {
      id: 'rxn_state_low_relationship',
      text: "We came because we had to, not because we wanted to.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.relationship', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_high_influence',
      text: "You'll find we don't ask twice for the same thing.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.influence', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_anger_rising',
      text: 'The patience downriver is thinner than it was a month back.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'faction_anger' },
      ],
    },
    {
      id: 'rxn_state_grudge_memory',
      text: "We haven't forgotten the last time we stood here.",
      conditions: [
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
    {
      id: 'rxn_state_refusal_memory',
      text: 'You turned us away before; this is the harder ask.',
      conditions: [
        { kind: 'memoryPresent', tag: 'refusal' },
      ],
    },
    {
      id: 'rxn_state_faction_repeat',
      text: 'Third visit, same question; a different answer would help.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'faction', atLeast: 3 },
      ],
    },
  ],
}
