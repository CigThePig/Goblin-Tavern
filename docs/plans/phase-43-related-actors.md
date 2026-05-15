# Phase 43 — Per-cause `relatedActors` in 4 silent calculators (ISSUE-003)

This phase delivers the work tracked as `ISSUE-003` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

The four expanded-pressure calculators introduced in Phase 38
(`arcEscalation`, `policyBacklash`, `marketInstability`,
`festivalReadiness`) and the arc-effects helper from Phase 35
(`arcEffects.ts`) all pushed causes with empty per-cause
`relatedActors`. Attribution rules in
`src/sim/modules/attribution/attributionRules.ts` filter on
`cause.relatedActors[*].kind`, so arc / policy / market / festival
entities accumulated no attribution and the
named-entity-repetition report showed them at zero.

Phase 43 attaches per-cause `relatedActors` to each `pushCause` site
where actor refs are in local scope, and to the raw cause / meta-draft
sites in `arcEffects.ts`. No new ref kinds were invented; the change
re-uses the existing `EntityRef` shape that `pushCause` and
`CauseDraft` already accept.

### `arcEscalation.ts`

The function previously accumulated one `local_event` ref per
non-resolved arc into a calculator-level array used only on the
return shape. The fix splits that accumulator into three stage-keyed
arrays (`risingActors`, `activeActors`, `climaxActors`) populated
inside the existing event loop, and each stage's `pushCause` now
passes the arrays whose events drove its intensity. The
`ignored_warnings`, `failed_preparation`, and `bleed_${id}` causes
remain without `relatedActors` — they're memory-aggregate and
pressure-cross-link sites with no actor in scope, and inventing one
would mis-attribute.

### `policyBacklash.ts`

Three causes now carry per-cause refs:

- `disliking_groups` — a local `dislikingActors: EntityRef[]` is
  populated inside the existing `group × policy × tag` dislike loop
  and passed to `pushCause`. Same refs continue to land on the
  calculator-level array.
- `regular_irritation` — the regulars loop now collects
  `regular`-kind refs for entries whose `irritation >= 25` into a
  local array; that array is passed to the cause and merged into
  the calculator-level array when the cause fires.
- `tavern_blame` — when the blame strength clears the threshold the
  cause receives a single `tavern_identity` ref keyed by
  `state.meta.tavernId`.

`active_policies` is left without `relatedActors`; the `EntityRef`
union has no `policy` kind, and adding one is out of scope.

### `marketInstability.ts`

A calculator-level `relatedActors: EntityRef[]` accumulator with
key-based de-dup is added and returned on the
`PressureCalculationResult`. The local `SupplierSlice` type at the
top of the file is widened to expose `supplierId` on
`priceAdjustmentsToday` entries — the schema in
`src/sim/modules/suppliers/supplierModule.ts:182-189` already
records it; the calculator just did not see it. No upstream
supplier-module change was needed.

- `price_adjustments_high` — collects supplier refs for adjustments
  with `effectivePrice > basePrice * 1.2` (de-duped by supplier id);
  passes them to the cause.
- `avg_reliability_low` — collects supplier refs for any supplier
  whose `reliability < 75` (those pulling the average below the
  threshold); passes them to the cause.
- `seasonal_arc_market` — passes `local_event` refs for each
  contributing seasonal arc.

`active_market_conditions` and `stock_shortage_bleed` remain
actor-free: market conditions are not tied to a single supplier ref,
and the stock bleed is a pressure cross-link.

### `festivalReadiness.ts`

Five of the file's nine `pushCause` sites now carry per-cause refs;
the others have no actor in scope.

- `festival_arc_active` — passes the `local_event` refs the function
  was already accumulating from `activeArcsByTypeOrTag`.
- `low_ale_for_festival` / `low_stew_for_festival` — each passes a
  single `stock` ref (`'ale'` / `'stew'`).
- `fatigued_staff` — the staff loop now collects `staff` refs for
  members with `fatigue >= 60`; the cause receives them and the
  calculator-level array is updated.
- `strong_suppliers` — same pattern with `supplier` refs for
  members whose `relationship >= 75 && reliability >= 65`.

`dirty_areas` continues to populate `relatedLocations` only — areas
belong on the locations channel, mirroring the existing split.
`festival_window_open`, `supplier_distrust_bleed`, and
`preparation_projects_complete` are calendar-tag / pressure
cross-link / project-tag sites with no `EntityRef` kind available;
they remain actor-free.

### `arcEffects.ts`

All four state-mutating effect kinds now attach
`relatedActors: [{ kind: 'local_event', id: arc.id }]`:

- `pressure_delta` (lines 73–95) — the raw cause object passed to
  `ctx.modifyPressure` and `ctx.addCause`.
- `reputation_signal` (lines 96–127) — the raw cause object passed
  to `ctx.modifyReputation` and `ctx.addCause`.
- `customer_group_modifier` (lines 128–148) — the meta draft passed
  to `ctx.modifyCustomerGroup`.
- `supplier_modifier` (lines 149–171) — the meta draft passed to
  `ctx.modifySupplier`.

`buildCauseFromDraft` (`src/sim/core/engine.ts:527-529`) already
reads `relatedActors` off a `CauseDraft`, so no engine-side change
was required. The tracker explicitly named only `pressure_delta`
(lines 73–94) but the same one-line fix shape applied to the three
sibling raw-cause / meta-draft sites with no behaviour regression.

## Tests

`tests/sim/phase43.relatedActors.test.ts` adds six focused tests:

1. **arcEscalation** — seeds three local events (rising, active,
   climax) and asserts each stage's cause carries the matching
   `local_event` ref.
2. **policyBacklash** — relies on the day-zero
   `cheap_payday_specials` policy and merchants' existing
   `risky` dislike tag; injects a single high-irritation regular and
   seeds a `tavern_identity` blame attribution. Asserts the
   `disliking_groups`, `regular_irritation`, and `tavern_blame`
   causes carry the expected refs.
3. **marketInstability** — seeds `priceAdjustmentsToday` with one
   elevated and one non-elevated adjustment, drops all suppliers
   below the reliability threshold, and seeds a seasonal arc.
   Asserts each cause's per-cause refs and that the calculator-level
   `relatedActors` aggregates them.
4. **festivalReadiness** — seeds a `festival`-typed arc, low stock,
   a fatigued staff member, and a strong supplier. Asserts each
   cause's per-cause refs.
5. **arcEffects (pressure_delta + reputation_signal)** — invokes
   `applyArcEffect` against the `inspection_campaign` definition
   with a mutation-capturing stub; asserts both captured causes
   carry the arc's `local_event` ref.
6. **arcEffects (customer_group_modifier + supplier_modifier)** —
   invokes `applyArcEffect` against the `miner_payday_boom`
   definition with a meta-capturing stub; asserts every captured
   meta carries the arc's `local_event` ref.

The tests invoke each calculator directly with a minimal
`{ state } as SimContext` stub. The calculators read only `ctx.state`,
so the stub is sound; this also sidesteps the supplier module's
`startDay` reset of `priceAdjustmentsToday`, which would otherwise
make the price-adjustment cause untestable through `simulateDay`.

## Verification

- `npm run typecheck` passes.
- `npm test` runs the full Vitest suite; the new
  `phase43.relatedActors.test.ts` passes and the existing
  `phase38.expandedPressures`, `phase35.seasonalArcs`,
  `phase37.attribution`, and `phase40.expandedReadiness` suites
  remain green.

## Out of scope

- `policyBacklashAttribution`'s `direction === 'decrease'` filter
  (`attributionRules.ts:415-417`) — owned by ISSUE-013.
- Growing the suppliers / staff / customer groups rosters that
  these calculators iterate — owned by ISSUE-005, 008, 009.
- Notable-NPC actor refs — owned by ISSUE-004.
- Any change to `supplierModule.ts` itself; the slice's schema
  already carried `supplierId`.
