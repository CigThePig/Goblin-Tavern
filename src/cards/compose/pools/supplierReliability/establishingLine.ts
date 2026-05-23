// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
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
  ],
}
