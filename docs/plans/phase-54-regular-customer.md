# Phase 54 — `regular_customer` family end-to-end (ISSUE-014)

This phase delivers the work tracked as `ISSUE-014` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach.

## What changed

Pre-phase the `regular_customer` family had two gates:

1. `regular_customer_loss` pressure ≥ 25 (kept).
2. A second gate that rejected the seed when
   `memories.length === 0 && chosen.irritation < 50 && chosen.loyalty > 40`.

The second gate was too tight. ISSUE-014's evidence: a high-irritation
regular without accumulated memories (a freshly-decayed regular, or one
whose service-failure tags hadn't been written yet because the response
pipeline wasn't running pre-Phase-41) would fail the gate even when the
sim recognised them as visibly trending negative.

Phase 54 relaxes the second gate to "fire if the regular is trending
negative OR has any memories." Trending negative is operationalised as
`irritation > 30 OR loyalty < 60`. The pressure gate, the picker, the
recency rotation (`recencyPenalty` already wired at line 878 +
`recordPick` at line 888), and the 6 consequence profiles are
unchanged.

The three pre-Phase-41 "dead tag reads" (`ignored_complaint`,
`favorite_order`, `bad_reputation`) are now produced via response
profile memories (`issueSeedGenerators.ts` lines 1233, 1129, etc.). The
fix from Phase 41 wired the response resolver into the pipeline, so
these write sites land in `state.memories` whenever the matching slot
fires. No additional write sites are needed.

## Tests

`tests/sim/phase54.regularCustomer.test.ts` covers:

1. The relaxed gate: a regular with `irritation=70, loyalty=30` and zero
   memories surfaces a `regular_customer` seed (was previously blocked
   by the `memories.length === 0` clause combined with the AND-form
   thresholds).
2. Rotation across multiple regulars: two equally-trending regulars
   produce distinct primary actors over a 14-day window, verified via
   `state.modules.issueSeeds.recentPicks.regular_customer` and via the
   seeds' `primaryActor.id` across days.
3. Per-slot mutation distinctness: each of the 6 response slots
   (`apologize_to_regular`, `comp_regular_meal`, `refuse_request`,
   `ask_regular_to_spread_word`, `ban_regular`, `ignore_regular`)
   produces a distinct treatment-vs-control delta. `refuse_request` and
   `ignore_regular` enqueue pending entries.

## Verification

- `npx vitest run tests/sim/phase54.regularCustomer.test.ts` — passes.
- `npm run typecheck` — passes.

## Out of scope

- New response slots, profiles, or scoring changes. The existing 6 slots
  carry distinct semantics; relaxing the gate is the only gate fix.
- The Phase 41 response pipeline wiring already covers the "dead tag
  reads" by activating the resolver paths that produce
  `ignored_complaint` / `favorite_order` / `bad_reputation` memories.
