# Phase 58 — `inspection` family un-pinning (ISSUE-018)

This phase delivers the work tracked as `ISSUE-018` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach.

## What changed

Pre-phase the `inspection` family hardcoded three faction lookups —
`town_watch` as primary, `scrap_collectors` and `local_shrine` as
cross-faction support refs — on every inspection seed. ISSUE-012
(phase 52) grew the faction roster but the inspection family's
hardcoded pin bypassed the picker, so `town_watch` continued to
saturate the 28-day named-entity audit (hit count 66 of 28 days).

### `src/sim/modules/issues/issueSeedGenerators.ts`

Picker-driven faction rotation replaces the three hardcoded
lookups. Two pools:

1. **Primary pool** — factions whose tags include any of
   `inspection_authority`, `reputation_authority`, `authority`,
   `regulation`, `enforcement`. Scored by a +20 base-score bonus when
   `inspection_authority` is present, minus a 7-day / 35-point recency
   penalty. Highest score wins.
2. **Support pool** — remaining factions (excluding the picked
   primary) whose tags include any of `cleanliness_relevant`,
   `ritual`, `reputation_authority`, `reputation_influence`. Top-2
   after recency penalty become the cross-faction support refs.

Faction tag scan (from `factionRegistry.ts`):
- Primary candidates: `town_watch` (`inspection_authority`),
  `silvermark_house` (`reputation_authority`), `brewers_guild`,
  `market_caravan_circle` (both `supplier_authority`, currently
  in-pool only if `authority` matches — note: their tags are
  `supplier_authority` not bare `authority`, so they don't fall in
  unless we widen further).
- Support candidates: `scrap_collectors` (`cleanliness_relevant`),
  `local_shrine` (`ritual`, `reputation_influence`),
  `silvermark_house` (`reputation_authority`).

With only `town_watch` and `silvermark_house` carrying the primary
tags out of the 9 shipped factions, rotation will alternate between
the two over a 14-day window. The +20 base bonus for
`inspection_authority` keeps `town_watch` as the dominant primary
when no recency penalty applies, matching the existing inspection
semantics.

`scrap_collectors` and `local_shrine` will still pin via the support
pool when fresh, but the picker selects them via recency rotation
instead of hardcoding.

The notable-NPC fallback chain is preserved:
`findNotableNpcByFaction(state, townWatch.id) ?? townWatch ?? systemRef('inspector')`
— so the Phase 44 NPC binding still lights up when `town_watch` is
picked as primary, and falls back cleanly to the picked faction or
system ref otherwise.

## Tests

`tests/sim/phase58.inspectionRotation.test.ts` covers:

1. The primary actor differs between consecutive inspection seeds
   when multiple primary-pool factions exist (≥ 2 distinct primary
   faction ids over a 14-day window).
2. `town_watch`'s hit count as primary over 14 days is bounded
   (≤ 9 out of 14, allowing the +20 bonus to keep it dominant but
   not saturating).
3. The 8-slot semantics from `phase19.issueSeeds.test.ts:264` still
   hold — seeds generate with the canonical 8 response slots and
   the cross-faction profiles still bind to the picked support refs.

## Verification

- `npx vitest run tests/sim/phase58.inspectionRotation.test.ts` — passes.
- `npm run typecheck` — passes.
- `phase19.issueSeeds.test.ts:264` — still passes; the inspection
  seed generates with the same 8 slots.

## Out of scope

- Adding new factions with the inspection-relevant tags. ISSUE-012
  shipped 3 new factions in phase 52; only those whose tags match the
  primary pool will rotate in.
- Reweighting the inspection cause set or pressure calculator.
