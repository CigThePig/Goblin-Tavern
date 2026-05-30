# Phase 169 — drinkOrder Parity (Complete Surface arc, Phase 2)

**ISSUE-137.** Provisional phase 169. Depends on ISSUE-136 (the Gate-Wiring
Contract — the full nine-gate walk must run on `drinkOrder` as this slot
lands).

Arc doc: [`complete-surface-arc.md`](complete-surface-arc.md) Phase 2.

## Problem

`drinkOrderCard` is the original Phase-C compositional card (Living Cast,
phase 123) and the one template never brought to parity with the other
nineteen migrated cards:

- Its body builder spliced `seed.textIngredients.recentContext[0]` straight
  into the rendered body (`src/cards/templates/drinkOrder.ts:153-154`) — a
  raw, un-composed, un-gated, un-state-checked fragment, the exact class the
  Voiced and Faithful arcs killed everywhere else.
- It had **no sim-backed establishing slot**, no `saliencePolicy`, and no
  salience-table read; it opened on the voiced `order_line` (flavor) while
  the other nineteen open on a salient fact.
- The companion test `tests/cards/compose/phase127.simBackedHookSignal.test.ts`
  guarded its three primitive checks behind an `it.skip(...)` for the case
  where no starter regulars are seeded — but `createInitialTavernState()`
  seeds eleven regulars (all with castAttributes), so the guard was dead and
  the render-level assertion it promised "in principle" never landed.

## The change

1. **New `establishing_line` slot** on `drinkOrderTemplate`, mirroring the
   staffAside / supplier_reliability shape:
   - `role: 'utterance'`, `wordBudget: 14`, `claimMode: 'sim_backed'`,
     `saliencePolicy: 'multi'`, `multiFactJoin: ' — '`.
   - Lands first in the body, before the voiced `order_line`.

2. **New matrix pool** at `src/cards/compose/pools/drinkOrder/establishingLine.ts`
   (exported as `drinkOrderEstablishingLinePool`). Keyed on the shared
   `regular_customer` salience table (irritation × loyalty bands, the
   `regular_customer_loss` pressure, the grudge / customer / warning
   memories, the `regular` repeat). 16 snippets:
   - one unconditional fallback;
   - single-condition rungs (each band, the pressure, each memory, the repeat);
   - the **four reachable irritation × loyalty corners** — `low×high`,
     `low×low`, `mid×high`, `mid×low`;
   - two orthogonal signal × (pressure | memory) top rungs.

   **Reachability discipline (arc principle 2).** drink_order is the MILD
   branch of `regular_customer` (`type: 'relationship_test'`, emitted only
   when `irritation ≤ 60` — `expandedSeedGenerators.ts:1066`). With band
   thresholds `[40, 70]` for `regular.irritation`, the seed reaches irritation
   bands `low` and `mid` only — never `high`. So the pool authors only the
   reachable face of the shared cube; the high-irritation row belongs to
   `regularComplaint` (the complaint branch), and the `mid × mid` interior
   stays on the unconditional fallback (the Phase-149 "leave the unremarkable
   centre to the fallback" precedent). The full-cube completeness pass for
   this family is Movement II, Phase 6 (ISSUE-141), which owns the
   reachable-cell enumeration + `unreachableCells` allowlist.

3. **Delete the raw splice.** `buildDrinkOrderBody` no longer reads
   `seed.textIngredients`; the body is fully composed:
   `[establishing_line, order_line, manner_note?]`.

4. **Re-enable / upgrade the skipped test.** The dead `it.skip` guard is
   removed (regulars are always seeded). Three new render-level assertions
   in `phase127.simBackedHookSignal.test.ts` prove the sim-backed signal
   resolves at render: `resolveSalientReads` returns the two signal reads
   for the starter regular, and `drinkOrderCard.render(...).body[0]` is the
   covering `est_low_irritation_high_loyalty` combo (irritation=low ×
   loyalty=high — the starter regular's standing), not the bare fallback,
   and is deterministic.

5. **Gate wiring.** drinkOrder's `runAllGates` block gains an
   `establishing_line` diversity slot (`minDistinct: 1` — the
   voice-perturbation sampler doesn't vary signal state, matching the
   staffAside / regularComplaint establishing-line config). drinkOrder is
   already in every cross-sim harness (legibility / crossSituation /
   fullGate), so the Phase-1 completeness test stays green.

## Tests touched

- `tests/cards/compose/phase127.simBackedHookSignal.test.ts` — dead skip
  guard removed; three render-level assertions added.
- `tests/cards/templates.drinkOrder.test.ts` — three render tests shifted
  for the new body shape (`order_line` is `body[1]`, its companion
  `manner_note` is `body[2]`).
- `tests/cards/compose/gates/runAllGates.test.ts` — establishing_line
  diversity slot added to the drinkOrder happy-path block.

## Out of scope

- The full irritation × loyalty cube fill + `unreachableCells` allowlist →
  Movement II, Phase 6 (ISSUE-141). This phase authors the reachable face
  and brings the card to *parity*; the machine-checked completeness contract
  is Phase 3 (ISSUE-138) + Phase 12 (ISSUE-147).
- Mechanical choice fields (verb / targetId / shape / per-effect kind /
  target / amount / tags) — untouched (Faithful rule).

## Done when

- drinkOrder's body is fully composed from slots, no raw `textIngredients`
  splice; it opens on a salient `regular_customer` fact via the multi-fact
  slot; the establishing pool is a covering matrix for the reachable face;
  the previously-dead skip is gone and the render assertion is live and
  green; drinkOrder passes the full nine-gate walk and is present in every
  cross-sim harness; `npm test` and `npm run typecheck` green.
