# Phase 94 — Tavern Log / History Filter Screen

> Lands the **Reports → Log** sub-tab — a filterable timeline view of
> `state.history`, the engine's append-only "what happened" record.
> Implements the deliverable described in
> [`docs/plans/game-loop-and-ux.md §4, §6, §10`](./game-loop-and-ux.md)
> and the read-only contract in
> [`docs/plans/cards-contract.md §1, §3.4, §3.5`](./cards-contract.md).

## Context — why this change

`ReportsScreen.svelte:102–106` carried a Log placeholder explicitly
naming Phase 94. The sim has been quietly accumulating rich timeline
data for fifty-three phases — 8 categories, structured tag arrays,
resolved `EntityRef[]` actors and locations, and a 500-entry /
90-day pruning policy — but no web surface read it. The Tavern Log
screen makes that data the player's "where did this come from?"
surface, pairing with the Pressures dashboard's forward-looking
"what's building" view to give the player a complete causality
picture.

By mid-game, `state.history` already holds hundreds of entries
spanning multiple categories. The screen earns its keep almost
immediately, and (unlike the world/tavern screens) it gracefully
handles empty/sparse early-game state.

## Locked decisions

| Question | Decision |
|---|---|
| Where it lives | **Sub-tab of Reports**, replacing the existing Log placeholder. Not a new top-level tab — game-loop §6 explicitly slots Tavern Log inside Reports. |
| Component name | `TavernLog.svelte` |
| Projection name | `buildTavernLog(state, filters?)` in `src/reports/tavernLogProjection.ts`. Pure; same `(state, filters)` ⇒ same output. Cards-contract §1. |
| Filter dimensions | **Category** (multi-select chip set, all 8) · **Tag** (multi-select chip set from top-20 by frequency + any active tag) · **Day range** (Today / Last 7 / Last 28 / All) · **Search** (case-insensitive substring on `summary`) · **Entity** ("involving X" — set by tapping an actor/location chip). All filters compose with AND. |
| Default day range | `last_7` when `state.calendar.totalDaysElapsed ≥ 7`, otherwise `all`. Avoids an empty screen on day 1–6. |
| Sort order | Reverse-chronological (newest first). Within a day, source insertion order is reversed so the latest event of the day reads first. |
| Grouping | Sticky day headers above each day's entries. |
| Per-row chip cap | **8 actors + 8 locations** per row. Wage-day entries with the full staff roster would otherwise dominate. |
| Interactions | Row category chip → toggle that category filter. Tag pill → toggle that tag filter. Actor/location chip → set the entity filter. **Clear filters** button resets everything. |
| Pagination | None. 500-entry pruning cap (`HISTORY_MAX_ENTRIES` in `historyModule.ts:33`) bounds the render set; rendering all filtered rows in one pass is well under any reasonable budget. |
| Entity label resolution | **Extracted** `resolveEntityLabel` / `resolveBareEntityId` from `worldOverviewProjection.ts` into a shared `src/reports/entityLabels.ts`. Both projections now import from there. Same behaviour, single source of truth. Also fixed a latent throw when `state.stock` is missing a stock id: the helper now uses `stockRegistry.has(id)` before `get(id)` to honour its "falls back to raw id" promise. |
| Glossary | Added new category `'log'` to `GlossaryCategory`. 9 new terms — one for the Tavern Log screen itself plus one per `HistoryCategory` — surfaced via `<TermLabel>` on the category chip toolbar. |
| Empty states | "No history yet — run a day to start the log." (day 0) · "No entries match the current filters." (filtered_out). |
| Sim-side changes | **None.** History data, helpers, pruning, and validation already exist and are complete. Phase 94 is web-and-projection-only. |
| Filter persistence | Component-local `$state`, no cross-session store. Matches the rest of the screens — App.svelte uses no router. |

## Files

### Refactor (move, no behavioural change)

- **`src/reports/entityLabels.ts`** — new. Houses `resolveEntityLabel` and `resolveBareEntityId`, lifted verbatim from `worldOverviewProjection.ts` (plus the stock-id-fallback fix).
- **`src/reports/worldOverviewProjection.ts`** — edit. Replaces the inline definitions with `import { resolveEntityLabel, resolveBareEntityId } from './entityLabels'`.

### New projection

- **`src/reports/tavernLogProjection.ts`** — new. Exports `buildTavernLog`, `HISTORY_CATEGORY_LABELS`, `TAG_FACET_LIMIT`, and the full type set (`TavernLogData`, `TavernLogFilters`, `TavernLogRow`, `TavernLogDayGroup`, `TavernLogChipRef`, `TavernLogCategoryFacet`, `TavernLogTagFacet`, `TavernLogDayRange`, `TavernLogEmptyReason`, `TavernLogAppliedFilters`).

  Resolution rules (pure):
  - Default day range: `last_7` when `state.calendar.totalDaysElapsed ≥ 7`, else `all`.
  - Facets (category + top-20 tag) computed against UNFILTERED history so chip counts stay stable as filters apply.
  - Filters compose with AND: day-range → category → tag (entry must contain every requested tag) → search (case-insensitive on summary) → entity (in `relatedActors` or `relatedLocations`).
  - Rows reversed for newest-first; grouped by `absoluteDay` with `rowStart` / `rowEnd` slice indices for the component.
  - `activeFilterCount` counts each non-default filter dimension once; `dayRange` only counts when it differs from the default for the current day.
  - Empty reasons: `'no_history'` (state.history empty) · `'filtered_out'` (entries exist but filters reject all).
  - 8-chip cap per actor/location list per row.

### Glossary

- **`src/reports/types.ts`** — edit. Adds `'log'` to `GlossaryCategory`.
- **`src/reports/glossary.ts`** — edit (additive). Appends `LOG_TERMS` (9 entries) to `GLOSSARY_TERMS`; extends `termsByCategory()` and `GLOSSARY_CATEGORY_LABELS` with the new category.

### Index

- **`src/reports/index.ts`** — edit. Re-exports `buildTavernLog`, `HISTORY_CATEGORY_LABELS`, `TAG_FACET_LIMIT`, every Tavern Log type, `resolveEntityLabel`, `resolveBareEntityId`, plus pass-through re-exports of `HistoryCategory` and `HistoryEntry` from sim state.

### Web

- **`web/src/lib/components/TavernLog.svelte`** — new. Pure presentation; component-local filter state (categories, tagSet, dayRange, search, entityFilter). Derives the projection inside, mirroring the `WorldScreen` pattern. Sticky filter toolbar + sticky day headers; chip taps push filters; "Clear filters" resets state.
- **`web/src/lib/screens/ReportsScreen.svelte`** — edit. Imports `TavernLog`, replaces the Log placeholder with `<TavernLog />`. Updates header comment.
- **`web/src/lib/components/Glossary.svelte`** — edit. Extends `CATEGORY_ORDER` and the empty-record literal with `'log'` so the new glossary category appears.

### Tests

- **`tests/reports/entityLabels.test.ts`** — new (15 assertions). Pins resolver behaviour per kind; fallback-to-raw-id path; bare-id resolution.
- **`tests/reports/tavernLogProjection.test.ts`** — new (25 tests). Empty state; default day range; facets; filters (category / tag-AND / day-range / search / entity / composed); sort order; group invariants; row shape (chip cap, label fallback); active filter count; non-mutation.
- **`tests/sim/phase94.historyProducerCoverage.test.ts`** — new (3 tests). Regression net for the producers the screen depends on (post-30-day history has ≥50 entries; service/weekly/monthly all observed; every entry has summary+timestamp).

## Verification

| Check | How |
|---|---|
| Full test suite | `npm test -- --run` → **1355 passed (93 files)**, including the new 43 tests. |
| TypeScript | `npm run typecheck` clean. |
| Svelte check | `npm run check` → 0 errors / 0 warnings. |
| Build | `npm run build` → 1.04 MB / 274 kB gzipped (pre-existing chunk-size warning, unchanged). |
| Visual smoke | `npm run dev` → Reports → Log. Day 0 shows "No history yet…". After running 7 days the screen populates with grouped entries, filter chips, and counts; tapping a wage-day staff chip narrows to entries involving that staff member; "Clear filters" resets. After 28+ days the Monthly category facet activates. |

## Out of scope (deferred)

- URL deep-linking to a filter set or specific log entry. App.svelte has no router.
- Day picker (arbitrary calendar range). The 4 quick ranges cover the common case.
- Cross-screen "view in log" links from Daily Report cause lines.
- Export / share (CSV, copy-to-clipboard).
- Memory drilldown bridge — expanding `category: 'memory'` entries to show the underlying `state.memories[…]`.
- Pinning / favouriting entries.
- Style/voice pass on existing producer summaries. Deferred to Phase 95+.
- Filter state persisting across navigation away/back.
- Debouncing the search input (re-projects on every keystroke; profile suggests it stays well under one frame at 500 entries).

## Critical files referenced

- `src/sim/state/TavernState.ts:324–344` — `HistoryCategory`, `HistoryEntry`.
- `src/sim/modules/history/historyModule.ts:33` — pruning constants (`HISTORY_MAX_ENTRIES = 500`, `HISTORY_MIN_AGE_DAYS = 90`).
- `src/sim/modules/history/historyLog.ts` — read-side helpers.
- `src/reports/entityLabels.ts` — shared entity-label resolution.
- `src/reports/worldOverviewProjection.ts` — pattern source for projection shape; now imports from `entityLabels.ts`.
- `src/reports/tavernLogProjection.ts` — Phase 94 projection.
- `src/reports/glossary.ts` — extended additively with `LOG_TERMS`.
- `web/src/lib/components/TavernLog.svelte` — Phase 94 component.
- `web/src/lib/screens/ReportsScreen.svelte` — wiring.
- `docs/plans/cards-contract.md §3.4–3.5` — history-vs-cause distinction.
- `docs/plans/game-loop-and-ux.md §4, §6, §10` — UX vision and roadmap slot.
