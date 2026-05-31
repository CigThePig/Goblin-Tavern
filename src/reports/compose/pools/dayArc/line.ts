// Phase 186 / Day-Clock Cluster 6 — Report-as-unfolding.
//
// Snippets for the daily report's day-arc movement connectives. Each is
// a short narrator aside that frames one movement of the day's story —
// the morning moves you committed, service running, and the calls you
// made when the day asked. The projection supplies the hard facts (the
// owner actions, service figures, resolved intents) separately; these
// lines are atmospheric glue and must not claim anything the sim hasn't
// asserted.
//
// Routing (via seed.domain): exactly one of `opening` / `service` /
// `reckoning`, set per movement by the projection. Snippets gate on it
// with a `hasTag` condition (data, not a closure — framework §2.3), so a
// movement only ever draws its own lines. Every movement carries an
// unconditional fallback so a line always resolves.
//
// Budget: ≤ 8 words (DAY_ARC_BUDGET). Voice register: tavern_floor.

import type { Snippet } from '../../../../cards/compose/types'

export const dayArcLineSnippets: Snippet[] = [
  // ── Opening — the morning moves committed before service ──────────
  {
    id: 'arc_opening_ready',
    text: 'you spent the morning making ready.',
    conditions: [{ kind: 'hasTag', tag: 'opening' }],
  },
  {
    id: 'arc_opening_hand',
    text: 'the day began with your hand on it.',
    conditions: [{ kind: 'hasTag', tag: 'opening' }],
  },
  {
    id: 'arc_opening_before_doors',
    text: 'before the doors opened, you moved.',
    conditions: [{ kind: 'hasTag', tag: 'opening' }],
  },
  // ── Service — the day playing out ────────────────────────────────
  {
    id: 'arc_service_floor_filled',
    text: 'then the floor filled and the work came.',
    conditions: [{ kind: 'hasTag', tag: 'service' }],
  },
  {
    id: 'arc_service_took_day',
    text: 'service took the day as it always does.',
    conditions: [{ kind: 'hasTag', tag: 'service' }],
  },
  {
    id: 'arc_service_doors_opened',
    text: 'the doors opened and the day unfolded.',
    conditions: [{ kind: 'hasTag', tag: 'service' }],
  },
  // ── Reckoning — the cards answered as the day settled ────────────
  {
    id: 'arc_reckoning_dust_settled',
    text: 'as the dust settled, you made your calls.',
    conditions: [{ kind: 'hasTag', tag: 'reckoning' }],
  },
  {
    id: 'arc_reckoning_when_mattered',
    text: 'when it mattered, you answered.',
    conditions: [{ kind: 'hasTag', tag: 'reckoning' }],
  },
  {
    id: 'arc_reckoning_day_asked',
    text: 'the day asked, and you replied.',
    conditions: [{ kind: 'hasTag', tag: 'reckoning' }],
  },
]
