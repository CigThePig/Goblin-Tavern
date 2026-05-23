// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Sim-backed establishing line for the debt_rent compositional template.
// First card the family has had — the legacy surface routed every
// debt_rent seed through the fallback. The seed has no primaryActor (the
// landlord is a `systemRef`, not a real entity — audit pass 1 §5.3) and
// no affectedActors, so the line is narrator-voiced and gates only on
// state-lookup primitives. No voiceAxis / verbalTic in this pool.
//
// State surfaces leaned on:
//   - pressureRising `debt` / `landlord`
//   - memoryPresent on `rent` / `landlord` / `debt` / `risk` (the seed
//     emits `rent_paid_recently`, `rent_delayed_recently`,
//     `borrowed_coin_recently`, `eviction_threat_possible` memories)
//   - repeatCount `debt` ≥ 3
//   - hasTag `rent_due_soon` (calendar tag flowed through `seed.domain`
//     via `toneHints`)
//   - severityAtLeast 70
//
// Design record at `specs/cards/debt_rent.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The ledger sits open, last month written and waiting.',
      conditions: [],
    },

    {
      id: 'est_debt_rising',
      text: 'The debt column has been climbing every week of the month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },
    {
      id: 'est_landlord_rising',
      text: "The landlord's patience has been thinning since the last visit.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },

    {
      id: 'est_rent_paid_memory',
      text: 'Last rent went out clean; this month wants another.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'est_landlord_memory',
      text: 'The landlord came by once before; the door remembers.',
      conditions: [
        { kind: 'memoryPresent', tag: 'landlord' },
      ],
    },
    {
      id: 'est_debt_memory',
      text: 'The borrowed coin from earlier is still on the ledger.',
      conditions: [
        { kind: 'memoryPresent', tag: 'debt' },
      ],
    },
    {
      id: 'est_risk_memory',
      text: 'An eviction warning sits half-curled in the desk drawer.',
      conditions: [
        { kind: 'memoryPresent', tag: 'risk' },
      ],
    },

    {
      id: 'est_rent_due_soon',
      text: 'The rent window will close inside the week.',
      conditions: [
        { kind: 'hasTag', tag: 'rent_due_soon' },
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },

    {
      id: 'est_high_severity',
      text: 'The coin pile no longer covers the line at the bottom.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },

    {
      id: 'est_debt_repeat',
      text: 'The third month running, the same shortfall on the page.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'repeatCount', subjectTag: 'debt', atLeast: 3 },
      ],
    },
  ],
}
