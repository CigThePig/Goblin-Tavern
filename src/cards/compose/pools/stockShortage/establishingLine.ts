// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Sim-backed establishing line for the stock_shortage compositional
// template. The first card the family has had — the legacy surface
// routed every stock_shortage seed through the fallback. The seed has
// no primaryActor (the subject is a stock item; affectedActors is a
// customer cohort), so the line is narrator-voiced and gates on
// state-lookup primitives only — no voiceAxis / verbalTic in this pool.
//
// State surfaces leaned on:
//   - pressureRising `stock_shortage` / `reputation_drift`
//   - memoryPresent on prior owner choices (watered_*, raised_prices,
//     ignored_shortage, restocked_*, limited_sales)
//   - repeatCount `stock` ≥ 3
//   - severityAtLeast 70 (the shortage is biting now)
//
// Design record at `specs/cards/stock_shortage.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The cellar door swings open on shelves that should be fuller.',
      conditions: [],
    },

    {
      id: 'est_shortage_rising',
      text: "The shelves have been thinning faster than the deliveries can catch.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
      ],
    },
    {
      id: 'est_reputation_rising',
      text: 'Word of the lean pours has begun drifting beyond the door.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },

    {
      id: 'est_watered_memory',
      text: 'The stretched batch from last week is still on the slate.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'est_raised_prices_memory',
      text: 'The new prices went up only days ago; the cellar still answers for it.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'est_ignored_memory',
      text: 'You left the shortage to itself once; it is back at the door.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_restocked_memory',
      text: 'The last restock barely lasted the week; here it is again.',
      conditions: [
        { kind: 'memoryPresent', tag: 'stock' },
      ],
    },

    {
      id: 'est_repeat_stock',
      text: 'Third morning running, the same cellar shelf comes up short.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'stock', atLeast: 3 },
      ],
    },

    {
      id: 'est_high_severity',
      text: 'The barrels are nearly bare; this is no longer drift.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
      ],
    },

    {
      id: 'est_shortage_repeat',
      text: 'The shortage has crept back twice now; the slate keeps the score.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'repeatCount', subjectTag: 'stock', atLeast: 3 },
      ],
    },

    // ─── Phase 149 / ISSUE-117 — matrix cells ────────────────────────
    // Spec-2 combos covering pressure × memory / hasTag / severity
    // intersections the seed generator can reach. Every snippet carries
    // at least one state-lookup primitive (pressureRising / memoryPresent
    // / repeatCount) so the sim-coherence gate passes — hasTag and
    // severityAtLeast are NOT state-lookup kinds on their own.

    {
      id: 'est_shortage_high_demand',
      text: 'The shortage tightens, and the rush is already at the door.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'est_shortage_deception',
      text: 'The shortage worsens, with the watered ale still on the slate.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'est_shortage_price',
      text: 'The shortage worsens, and the price hike sits fresh on the slate.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'est_shortage_ignored',
      text: 'The shortage you left to itself has come back biting harder.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_severity_high_demand',
      text: 'Critical shortage, and the day is already drawing a thirsty crowd.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'stock_shortage' },
        { kind: 'hasTag', tag: 'high_demand' },
      ],
    },
    {
      id: 'est_severity_deception',
      text: 'Critical shortage, and the watered ale still marks the slate.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'est_high_demand_deception',
      text: "A busy day looms, and the watered ale isn't forgotten yet.",
      conditions: [
        { kind: 'hasTag', tag: 'high_demand' },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'est_reputation_ignored',
      text: 'Regulars are noticing — the untended shortage echoes outside the door.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
  ],
}
