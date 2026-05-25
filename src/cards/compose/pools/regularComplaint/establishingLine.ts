// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Sim-backed establishing line for the regular_complaint compositional
// template. States what the sim says about this regular at the
// complaint moment: irritation band, loyalty band, rising
// regular_customer_loss pressure, prior memory tag (grudge, ignored
// complaint, customer, warning), repeated regular seed appearance.
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees.
//
// Design record at `specs/cards/regular_complaint.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A regular leans forward at their usual table.',
      conditions: [],
    },

    {
      id: 'est_high_irritation',
      text: 'Their patience snapped a quarter-hour back.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
      ],
    },
    {
      id: 'est_mid_irritation',
      text: "They've been stewing since they walked in.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
      ],
    },
    {
      id: 'est_low_loyalty',
      text: "Their loyalty's been thinning all month, and it shows.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_loss_rising',
      text: 'The regulars have been quietly drifting these last weeks.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_grudge_memory',
      text: "They've been holding onto the last refusal.",
      conditions: [
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
    {
      id: 'est_ignored_memory',
      text: 'The last complaint they raised never got an answer.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored_complaint' },
      ],
    },
    {
      id: 'est_customer_memory',
      text: 'They still remember the meal you comped them once.',
      conditions: [
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },
    {
      id: 'est_warning_memory',
      text: 'You were warned this could come back; here it is.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_repeat_visit',
      text: 'Same regular at the same table, same trouble.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'regular', atLeast: 3 },
      ],
    },

    {
      id: 'est_irritation_repeat',
      text: 'Same complaint, third time this week.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
        { kind: 'repeatCount', subjectTag: 'regular', atLeast: 3 },
      ],
    },
    {
      id: 'est_loyalty_grudge',
      text: 'Loyalty thin and a grudge to match — bad pairing.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },

    // ─── Phase 151 / ISSUE-119 — irritation × loyalty matrix corners ──
    // The card is *about* irritation × loyalty; when both bands resolve
    // the establishing line should state the pair, not whichever
    // single-condition snippet happens to out-specify the other. Each
    // corner combo holds BOTH signal facts as one hand-authored line and
    // outranks the multi-fact join (which only fires when no combo
    // covers the pair). The regular_customer / complaint seed fires for
    // irritation > 60 (mid or high band), so the low-irritation row of
    // the 9-cell matrix never resolves at runtime — author only the
    // mid/high × low/mid/high corners the design distinguishes.

    {
      id: 'est_high_irritation_high_loyalty',
      text: "Years between us, and the way they're looking at me now.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_high_irritation_low_loyalty',
      text: "Door's already in their hand; the words are catching up.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_irritation_high_loyalty',
      text: 'Still here, but the patience is thinning by the breath.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_mid_irritation_low_loyalty',
      text: "Quiet between us, and the visits getting shorter each round.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
      ],
    },

    // Spec-2 signal × pressure / memory top rungs. The salience table
    // ranks these below the band-pair corners but above the single-
    // condition rungs, so they fire when one signal extreme meets a
    // matching pressure or memory.
    {
      id: 'est_loyalty_loss',
      text: 'Loyalty thinning, and the regulars drifting from the door.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.loyalty', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_irritation_ignored',
      text: "Anger today, built on a complaint that's still unanswered.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'regular.irritation', equals: 'high' },
        { kind: 'memoryPresent', tag: 'ignored_complaint' },
      ],
    },
    {
      id: 'est_loss_warning',
      text: 'The loss you were warned about is starting to arrive.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
  ],
}
