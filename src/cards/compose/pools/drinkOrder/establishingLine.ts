// Phase 169 / ISSUE-137 — Complete Surface arc, Phase 2 (drinkOrder Parity).
//
// Sim-backed establishing line for the drink_order compositional template
// — the slot drinkOrder lacked since it shipped as the original Phase-C
// card (Living Cast, phase 123). Until now its body opened on the voiced
// `order_line` and then spliced a raw `seed.textIngredients.recentContext[0]`
// fragment in as the last line — the un-composed, un-gated, un-state-checked
// dump the Voiced and Faithful arcs killed everywhere else. This pool brings
// drinkOrder to parity with the other nineteen migrated templates: the order
// now opens on the regular's standing, stated from sim truth, before they
// speak their line.
//
// The drink_order seed is the MILD branch of the regular_customer family
// (`relationship_test`, irritation ≤ 60 — `expandedSeedGenerators.ts:1066`),
// so this pool authors only the reachable face of the shared
// `regular_customer` salience cube: irritation ∈ {low, mid} (never high —
// that's regularComplaint's branch) × loyalty ∈ {low, mid, high}, plus the
// family pressure, choice-affecting memories, and the repeat-visit pattern.
// The mid × mid interior stays on the unconditional fallback (the Phase-149
// precedent: a fact-stating slot leaves the unremarkable centre to the
// fallback rather than authoring a flat line). The full-cube completeness
// pass belongs to the Regulars & Complaints cluster (Movement II, Phase 6).
//
// Every non-fallback snippet carries ≥1 state-lookup condition
// (signalEquals / pressureRising / memoryPresent / repeatCount) per the
// sim-coherence gate. The unconditional fallback claims only what the seed
// firing guarantees: a regular settling in for service.
//
// Design record at `specs/cards/drink_order.spec.yaml` (Phase 169 entry).

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    // — base: unconditional fallback —
    {
      id: 'est_fallback',
      text: 'A regular settles in and catches your eye for service.',
      conditions: [],
    },

    // — middle rung: single state-lookup condition (COMMON) —
    {
      id: 'est_low_irritation',
      text: "They're easy company tonight, in no particular hurry.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_irritation',
      text: 'A little restless, drumming their fingers while they wait.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
      ],
    },
    {
      id: 'est_high_loyalty',
      text: 'One of your steadiest faces, here as often as not.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_low_loyalty',
      text: "They've been coming round less and less of late.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_loss_rising',
      text: 'The regulars have been drifting from the room these weeks.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_grudge_memory',
      text: "There's a coolness they've carried in with them.",
      conditions: [
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
    {
      id: 'est_customer_memory',
      text: 'They still remember the round you stood them once.',
      conditions: [
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },
    {
      id: 'est_warning_memory',
      text: "You'd been told to watch this one's mood.",
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_repeat_visit',
      text: 'Same regular on the same stool a third time this span.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'regular', atLeast: 3 },
      ],
    },

    // ─── irritation × loyalty matrix corners (reachable face) ──────────
    // The card is *about* the regular's standing; when both bands resolve
    // the establishing line should state the pair, not whichever single
    // condition out-specifies the other. Each combo holds BOTH signal
    // facts as one hand-authored line and outranks the multi-fact join
    // (which fires only when no combo covers the pair). Only irritation ∈
    // {low, mid} cells are authored — relationship_test never reaches the
    // high-irritation row (that's regularComplaint's complaint branch).
    {
      id: 'est_low_irritation_high_loyalty',
      text: 'An old hand, relaxed and glad of the usual welcome.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_low_irritation_low_loyalty',
      text: 'Calm enough, but their visits have grown thin of late.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_irritation_high_loyalty',
      text: 'Edgy tonight, though long habit keeps them on the stool.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_mid_irritation_low_loyalty',
      text: 'Short with you, and half out the door before they sit.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },

    // ─── orthogonal signal × pressure / memory top rungs ───────────────
    {
      id: 'est_loyalty_loss',
      text: 'Loyalty thinning, and the regulars slipping from the door.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_mid_irritation_grudge',
      text: 'Restless, and carrying a coolness from before besides.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
  ],
}
