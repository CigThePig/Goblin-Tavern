// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
// Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. Exhaustive matrix
// authoring against the supplier_relationship salience table at
// `compose/salience.ts`. Base-rung single-condition snippets state one
// fact; spec-2 combo cells state the salience-relevant pair as one
// hand-authored line (always beats the multi-fact join because the
// combo's specificity is higher); spec-2 / 3 top rungs cover the
// pressure × signal × memory × repeat top-extremity intersections.
//
// Sim-backed establishing line for the supplier_reliability compositional
// template. States the supplier situation at the morning_prep moment:
// reliability band, relationship band, rising supplier_distrust /
// market_instability pressure, returning visitor (memoryPresent), and
// the two-condition band+repeat top rung. Emits the Phase-3 converged
// pool at `specs/cards/supplier_reliability.spec.yaml:357-399`.
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees
// (a merchant at the counter with a ledger).

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A merchant stands at the counter, ledger in hand.',
      conditions: [],
    },

    {
      id: 'est_low_reliability',
      text: 'The goods come up short most weeks.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
      ],
    },
    {
      id: 'est_high_reliability',
      text: 'Their wagons run steady; the loads always arrive whole.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'high' },
      ],
    },
    {
      id: 'est_low_relationship',
      text: "There's old cold between this house and theirs.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'low' },
      ],
    },
    {
      id: 'est_high_relationship',
      text: 'They sit at this counter like family does.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
      ],
    },

    {
      id: 'est_distrust_rising',
      text: "Talk's been turning sour about this trade all month.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
      ],
    },
    {
      id: 'est_market_rising',
      text: "The market's been wobbling, and it shows here too.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'market_instability' },
      ],
    },

    {
      id: 'est_returning_visitor',
      text: "They've come through this door before; the ledger remembers.",
      conditions: [
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },

    {
      id: 'est_low_repeat',
      text: "Light loads again; we've been around this counter all month.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
        { kind: 'repeatCount', subjectTag: 'supplier', atLeast: 3 },
      ],
    },

    // ─── Phase 149 / ISSUE-117 — matrix cells ────────────────────────
    // Spec-2 reliability × relationship corner combos. Each combo holds
    // BOTH signal facts as one hand-authored line; outranks the multi-
    // fact join (which only fires when no combo covers the pair).

    {
      id: 'est_low_rel_low_rship',
      text: 'Both their goods and their goodwill come up short with us.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'low' },
      ],
    },
    {
      id: 'est_low_rel_high_rship',
      text: "Their loyalty hasn't shifted, but the wagons keep landing light.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
      ],
    },
    {
      id: 'est_high_rel_low_rship',
      text: 'Their wagons run whole, but the air between us stays cold.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'low' },
      ],
    },
    {
      id: 'est_high_rel_high_rship',
      text: 'Steady loads and steady talk; trade as it should run.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.relationship', equals: 'high' },
      ],
    },

    // Spec-2 signal × pressure top rungs.
    {
      id: 'est_low_rel_distrust',
      text: 'Light loads, and the talk turns sour faster every visit.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
      ],
    },
    {
      id: 'est_severity_distrust',
      text: 'The trade has soured and the loss bites without mercy now.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
      ],
    },
    {
      id: 'est_distrust_memory',
      text: 'The pattern repeats — the distrust thickens with every visit.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'supplier_distrust' },
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },

    // ─── Phase 162 / ISSUE-130 — Legible Surface arc, Phase 17,
    // iteration #1. Salience-rank-#4 deepening: the
    // `supplier_relationship` salience table at
    // `compose/salience.ts:83-92` lists `market_instability` (rising)
    // as the fourth salient read after reliability, relationship, and
    // supplier_distrust. Pre-Phase-162 the pool carried five snippets
    // touching `supplier_distrust` (single + low-reliability combo +
    // severity combo + distrust+memory) but only one touching
    // `market_instability` (the bare `est_market_rising` base-rung).
    // When market_instability rose alongside a band-signal extreme,
    // the gradient picked the higher-spec band/distrust combo and the
    // multi-fact slot fell back to the base-rung market line — the
    // exact failure mode Movement V's multi-fact slot was built to
    // fix. Three new combo cells mirror the distrust matrix shape so
    // the establishing line states the pair when both reads resolve.
    {
      id: 'est_low_rel_market',
      text: 'Light loads, and the market keeps shifting under us each visit.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'supplier.reliability', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'market_instability' },
      ],
    },
    {
      id: 'est_severity_market',
      text: 'The trade has thinned and the wider market keeps slipping with it.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'market_instability' },
      ],
    },
    {
      id: 'est_market_memory',
      text: 'Each visit lands lighter; the market has been wobbling all season.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'market_instability' },
        { kind: 'memoryPresent', tag: 'supplier' },
      ],
    },
  ],
}
