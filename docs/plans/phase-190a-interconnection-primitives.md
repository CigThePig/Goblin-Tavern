# Phase 190a / ISSUE-157a — Interconnection primitives + routing + drilldown paths

**Parent contract:** `docs/plans/ui-ux-intuitiveness-arc.md` (§Phase 190a).
**Status:** done.

Phase 190 was split (see arc doc §"Tracker entries") into **190a** (this
phase — the reusable infrastructure) and **190b** (consumer wiring). 190a
ships the carriers + routing + drilldown paths and their tests; it changes
no existing visible screen. The high-traffic call sites land in 190b.

## What shipped

### New primitives — `web/src/lib/components/links/`

- `types.ts` — pure data + resolution module (no DOM/Svelte/store import,
  so `gameStore` can import the routing map without a cycle):
  - `EntityKind` (11 kinds, each with a confirmed detail surface),
    `MetricKind` (`coin | pressure | reputation | inventory`).
  - `ENTITY_ROUTING` — every entity kind → `{ route, subview }`.
  - `entityExists(state, kind, id)` — graceful-fallback resolver; wrapped
    in try/catch so a malformed slice degrades a link to plain text rather
    than throwing. Empty id ⇒ not-an-entity.
  - `metricDrilldownPath(kind, id?)` — metric kind → drilldown path
    (`coin`, `pressures.<id>`, `reputation.<axis>`, `inventory.<itemId>`);
    `undefined` when an id-bearing kind is given no id.
- `EntityLink.svelte` — `{ kind, id, label, variant? }`. Resolvable id (or
  empty id) renders a tap target that calls
  `gameStore.setRoute(dest.route, { target: id, kind })`; an unresolvable
  non-empty id renders plain text.
- `MetricLink.svelte` — `{ kind, id?, children }`. Opens the global
  drilldown at `metricDrilldownPath(...)`; id-less id-bearing kinds render
  plain (non-interactive) content.

### Global drilldown store + app-root mount

- `web/src/lib/sim/drilldownStore.svelte.ts` — tiny global mirroring
  `glossaryStore`, so a `MetricLink` anywhere opens a drilldown without
  prop-drilling. `App.svelte` mounts one `CauseDrilldown` bound to it
  (alongside `Glossary`). Screens that own a local `CauseDrilldown`
  (DailyReport, ReportsScreen) keep theirs.

### Routing-target mechanism — `gameStore.svelte.ts`

- Transient `tavernSubviewTarget` / `worldSubviewTarget` (`$state`, **not**
  persisted — kept out of `serializeForSave`/`hydrateFromSave`, so the save
  schema is unchanged). Reset in `reset()`.
- `setRoute(route, opts?: { target?, kind? })` — single-arg callers
  unchanged; with `kind`, selects the kind's home sub-view (from
  `ENTITY_ROUTING`) and stashes the target (empty target clears it).
- `consumeTavernSubviewTarget()` / `consumeWorldSubviewTarget()` —
  read-and-clear (consume-once) for 190b's panel-side `$effect`.

### Drilldown path extensions — `src/reports/`

- `causeLookup.ts`: `pathToCauseTarget` now maps `inventory.<itemId>` →
  `stock:<id>` (alias), plus thin `causesForCoin` /
  `causesForReputationAxis` / `causesForInventory` helpers mirroring
  `causesForPressure`. Exported from `src/reports/index.ts`.
- `labels/humanizePath.ts`: `inventory.<itemId>` → "<Item> stock" title.

### Visual treatment — `global.css`

- `.entity-link` / `.metric-link`: hover/focus-only dotted border-bottom at
  `accent@35%`, no resting underline (cursor pointer). Documented
  side-by-side with `TermLabel`'s static `accent@50%` underline so the
  "what does this mean?" vs "take me there" affordances stay distinct.

## Test approach

`tests/web/phase190a.interconnection.test.ts` (jsdom): `metricDrilldownPath`
mapping + id-less undefineds; `pathToCauseTarget` resolution for
coin/reputation/inventory and the thin cause helpers reading planted causes;
`entityExists` live-vs-unknown-vs-empty; `setRoute` target propagation +
single-arg invariance + empty-target-clears; consume-once; `EntityLink`
routes for a resolvable id, degrades to plain text for an unresolvable id,
and stays a navigation link for an empty id; `MetricLink` opens the global
drilldown and renders plain when id-less. 15 tests. `npm test`
(3395 passing) + `npm run typecheck` green.

## Out of scope (→ 190b)

All consumer call sites (DayScreen at-a-glance / plan rows / pending tags,
PressureRibbon, DailyReport resolved-intent, Monthly/Weekly overviews) and
the panel-side target consumption (`$effect` → `consume*SubviewTarget()` →
detail-sheet open). 190a ships the mechanism; 190b wires it in.
