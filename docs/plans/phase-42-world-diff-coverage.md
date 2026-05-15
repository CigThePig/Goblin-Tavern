# Phase 42 — World mutator cause emission + state diff coverage

Tracks `ISSUE-002` in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md).

## Why

The Phase 27 world mutators (`modifyCulture`, `modifyFaction`,
`modifySupplier`, `modifyRegular`, `modifyNotableNpc`, `modifyLocalEvent`,
`modifySocialRumour`, `modifyTavernIdentity`) emitted a single aggregate
cause per call regardless of how many fields moved, and `createStateDiff`
ignored `state.world.*` and `state.modules.*` entirely. That left the
daily cause-coverage audit blind to every culture / faction / supplier /
regular / event / rumour mutation: causes existed without a matching
diff entry, and the diff existed without a matching cause target.

This phase wires both halves so the audit can credit world mutations
the same way it credits core-slice mutations.

## What changes

### Engine — per-field causes for the eight world mutators

`emitDiffPathCausesForRecord` (`src/sim/core/engine.ts`) now returns the
number of causes it emitted. Each world mutator calls it with a
slice-specific `targetForField` and `targetType`, mirroring the
`modifyArea` pattern. When `emitted === 0` (i.e. only non-numeric
fields moved or `meta` was omitted), the world mutator falls back to
the original aggregate `addCauseInternal` call so existing callers
that touch only `goodsProvided`, `arcHistory`, `atmosphereTags`, etc.
keep their attribution.

Per-field cause-target conventions (canonical colon form to match
`targetForChange`'s id-prefix output via `targetMatches`):

| Mutator | Cause target | Diff path |
|---|---|---|
| `modifyCulture` | `culture:<id>.<field>` | `cultures.<id>.<field>` |
| `modifyFaction` | `faction:<id>.<field>` | `factions.<id>.<field>` |
| `modifySupplier` | `supplier:<id>.<field>` | `suppliers.<id>.<field>` |
| `modifyRegular` | `regular:<id>.<field>` | `regulars.<id>.<field>` |
| `modifyNotableNpc` | `notable_npc:<id>.<field>` | `notableNpcs.<id>.<field>` |
| `modifyLocalEvent` | `local_event:<id>.<field>` | `localEvents.<id>.<field>` |
| `modifySocialRumour` | `rumour:<id>.<field>` | `socialRumours.<id>.<field>` |
| `modifyTavernIdentity` | `tavernIdentity.<field>` (singleton — singleton has no id, so the path form doubles as the canonical bucket) | `tavernIdentity.<field>` |

### Diff — walk world slices and modules

`createStateDiff` (`src/sim/core/diff.ts`) now walks:

- `cultures` — `familiarity`, `comfort`, `tension`
- `factions` — `relationship`, `influence`, `trust`, `fear`
- `suppliers` — `reliability`, `relationship`, `debtTolerance`,
  `priceBias` (skips `lastDeliveryDay`)
- `regulars` — `loyalty`, `irritation`, `visits` (skips
  `firstSeenDay` / `lastSeenDay`)
- `localEvents` — `intensity`, `ageDays` (skips timestamp fields)
- `socialRumours` — `strength` plus a string-state flip on `accuracy`
- `tavernIdentity` — `foundingDay`
- `modules` — shallow per top-level key inside each slice, JSON-equality
  per value

`notableNpcs` has only timestamp fields and is deliberately not walked
to avoid flooding the diff with per-day +1 stamps.

`isMeterPath` is extended to recognize the six world-meter prefixes
(`cultures.`, `factions.`, `suppliers.`, `regulars.`, `localEvents.`,
`socialRumours.`) so the existing 5-point significance threshold
applies cleanly.

### Cause report — map world paths to canonical cause targets

`targetForChange` in `src/sim/modules/causes/causeReport.ts` now maps
the new diff paths to canonical cause targets:

```
cultures.X.*       → 'culture:X'
factions.X.*       → 'faction:X'
suppliers.X.*      → 'supplier:X'
regulars.X.*       → 'regular:X'
notableNpcs.X.*    → 'notable_npc:X'
localEvents.X.*    → 'local_event:X'
socialRumours.X.*  → 'rumour:X'
tavernIdentity.*   → 'tavernIdentity'
modules.*          → undefined (intentionally unmapped)
```

Per-field cause targets emitted by the engine (e.g.
`cultures.goblin_common.familiarity`) match diff paths directly.
Explicit `addCause` call sites that use the id-only canonical target
(`culture:goblin_common`) match through `targetMatches`' prefix
relationship. Module-internal writes intentionally surface as
"unexplained" until module owners attribute them — an audit signal
rather than a swallowed change.

## Tests

`tests/sim/phase42.worldDiffCoverage.test.ts` covers:

- Per-field cause emission for each world mutator (culture, faction,
  supplier, regular, local event, social rumour, tavern identity).
- Aggregate fallback when only non-numeric fields move
  (`modifySupplier(id, { goodsProvided: [...] })`,
  `modifyTavernIdentity({ atmosphereTags: [...] })`).
- Per-slice `createStateDiff` walks (cultures, suppliers, regulars,
  local events, social rumours, tavern identity, modules) including
  intentional skips for timestamp fields and the optional-field
  guard.
- End-to-end cause-coverage: a culture / faction / supplier mutation
  during a `simulateDay` produces matching diff entries that the
  daily `findUnexplainedSignificantChanges` audit does not flag.

## Verification

1. `npm run typecheck` — engine signature change propagates through the
   four core mutator call sites and the eight world mutator call sites
   without breaking other callers.
2. `npm test` — full Vitest suite passes, including the new
   `phase42.worldDiffCoverage.test.ts` and the existing per-system
   tests (`phase27.expandedHooks`, `phase29.suppliersMarketGoods`,
   `phase30.culturesCustomersRegulars`, `phase34.weeklyCommunity`,
   `phase37.attribution`, `phase40.expandedReadiness`).
3. **Smoke**: a day that mutates a culture (`familiarity +10`), a
   supplier (`relationship -8`), and a faction (`trust +6`) leaves the
   daily CAUSE REPORT's `unexplainedCount` at zero for those deltas.
