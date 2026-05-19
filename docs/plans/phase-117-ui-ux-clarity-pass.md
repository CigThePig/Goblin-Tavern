# Phase 117 — UI/UX Clarity Pass

Tracker: `ISSUE-078` in `docs/ISSUE_TRACKER.md`.

## Context

The Tier 4 progressive-onboarding arc
(`docs/plans/progressive-onboarding.md`, issues 060–077) paces *when*
the player meets each system. But even one-at-a-time the
player-facing surface leaks simulation vocabulary verbatim:
snake_case ids, JSON-pointer diff paths, paired enable-and-disable
policy actions, and "recipes" for firewood and mugs sitting on the
menu next to stew. The screenshots that prompted this phase show
three concrete failures:

- **Plan the Day → Policies** lists `Disable Allow Tabs for Regulars`
  with subtext `Policy allow_tabs_for_regulars is not enabled`. Both
  halves of every policy pair appear at once.
- **Today report** dumps engine diff strings verbatim:
  `stock.ale.quantity 80 → 0 (-80)`,
  `pressures.staff_loyalty_risk.value 0 → 75 (+75)`.
- **Tavern → Recipes** shows `Firewood Bundle`, `Replacement Mug`,
  and `Cook Surplus` as menu items.

These are not isolated bugs. They share one root cause: the UI was
built to *inspect* the simulation, not to *translate* it. Registries
already carry human-friendly labels — the UI just never consulted
them when rendering diffs, action subtext, log chips, or status
pills.

This phase lands the translation layer plus the structural fixes for
the three loudest surfaces, then sweeps the smaller microcopy leaks.
A follow-up phase (ISSUE-079, plan §8 below) handles diff grouping,
empty-state copy, glossary coverage, and information-density tuning.

## Design rules

1. **The simulation is the source of truth.** Engine `readable`
   output is unchanged; translation happens in `src/reports/` and
   the web layer.
2. **One canonical lookup.** `idLabel(category, id)` is the only
   id → label resolver. Every render site uses it.
3. **Honesty over cleverness.** Firewood-as-menu-item is hidden
   from the player-facing Recipes panel; the underlying recipe
   entity stays for sim continuity.
4. **Pure projection.** No new state shape, no migration of the
   sim, no schema changes.

## Critical files

### New
- `src/reports/labels/idLabel.ts` — central id → label lookup,
  union-typed by category. Re-exports `humanizeId(id)`.
- `src/reports/labels/humanizePath.ts` — JSON-pointer → human
  string. Exports `humanizePath`, `humanizeDiff`,
  `humanizeDiffTitle`.
- `tests/reports/labels.test.ts` — 25 tests for both modules.
- `tests/reports/upkeepRecipeFilter.test.ts` — 7 tests for the
  recipe filter and migration.
- `tests/web/policyToggleRows.test.ts` — 7 tests for the toggle
  helper.

### Touched
- `src/reports/types.ts` — `ReportDiffLine` adds `humanReadable`;
  `ReportOwnerActionLine` adds `targetLabel`.
- `src/reports/dailyReportProjection.ts` — `projectTopDiffs`
  populates `humanReadable` via `humanizeDiff`. `projectOwnerActions`
  resolves `targetLabel` via `resolveActionTargetLabel`. The
  header `dayLabel` and `formatDiffPathTitle` route through
  `idLabel` / `humanizePath`. Local `formatDayType` removed.
- `web/src/lib/components/DailyReport.svelte` — diff rows bind
  to `d.humanReadable`; ledger rows fall back to `targetLabel`
  before raw `targetId`.
- `src/sim/registries/recipeRegistry.ts` — `dish_firewood`,
  `dish_mugs`, `dish_ingredients` tagged `upkeep` and
  `defaultState.onMenu: false`.
- `src/sim/state/migrations.ts` — new
  `flipUpkeepRecipesOffMenu()` helper. Imports `recipeRegistry`
  and `ensureRequiredRecipesRegistered`.
- `web/src/lib/sim/persistence.ts` — wires the new migration
  into the chain between `ensureRecipesSlice` and
  `ensureExpeditionsSlice`.
- `src/reports/tavernOverviewProjection.ts` — `buildRecipePanel`
  filters upkeep recipes; `StockRow` gains `isUpkeepConsumed`;
  `projectStockRow` populates it via `stockConsumedByUpkeep()`.
- `src/sim/modules/ownerActions/policyActions.ts` — reject
  reason strings switch from
  `Policy <snake_id> is (not enabled|already enabled)` to
  `<Policy Label> is already (on|off).`.
- `web/src/lib/sim/actionBuilder.ts` — new `listPolicyToggleRows`
  helper + `PolicyToggleRow` type.
- `web/src/lib/components/ActionPicker.svelte` — when
  `tab === 'policy'`, renders `policyRows` via the toggle UI;
  other tabs unchanged. `tapPolicyRow` handles
  add/cancel/inverse-cancel.
- `web/src/lib/components/tavern/RecipesPanel.svelte` — no
  template change (projection filter is sufficient).
- `web/src/lib/components/tavern/StockPanel.svelte` —
  `upkeep-pill` "used for upkeep" subtitle, expedition outcome
  via `idLabel('expeditionOutcome', ...)`.
- `web/src/lib/components/tavern/StaffPanel.svelte` — plural
  bug fix.
- `web/src/lib/components/tavern/ProjectsPanel.svelte` —
  project status + social outcome via `idLabel`; inline policy
  toggle copy "Turn on"/"Turn off"/"On"/"Off".
- `web/src/lib/components/tavern/AreasPanel.svelte` —
  `activeProblems` via `humanizeId`.
- `web/src/lib/components/StaffPrioritySheet.svelte` — role
  label via `idLabel('staffRole', ...)`.
- `web/src/lib/components/TavernLog.svelte` — facet chips and
  inline tag pills via `idLabel('logFacet', ...)`.
- `web/src/lib/components/TopBar.svelte` — day-type label via
  `idLabel('dayType', ...)`; local `formatDayType` removed.
- `tests/reports/tavernOverviewProjection.test.ts` — recipe
  count assertion updated to subtract upkeep recipes.

## Verification (status: complete)

- `npm test` — 1657 tests pass (247 reports + 1215 sim + 195
  web/cards).
- `npm run typecheck` — clean.
- `npm run check` (svelte-check) — clean apart from one
  pre-existing a11y warning unrelated to this phase.

Manual spot-checks per the screenshots:
- Today report shows `Ale stock: 80 → 0 (−80)` and
  `Staff Loyalty Risk: 0 → 75 (+75)` (no `.value`, no
  underscores, typographic minus on losses).
- Plan the Day → Policies shows 7 toggle rows with ON/OFF
  pills; taps queue a single action chip; tap-again cancels.
- Tavern → Recipes does not contain Firewood Bundle,
  Replacement Mug, or Cook Surplus. Tavern → Stock shows
  "used for upkeep" on firewood and mugs.

## §8 — Follow-up phase: Comprehension Pass 2

Tracked as `ISSUE-079`, `Phase 118`. The design seed below has been
lifted into its own plan file at
`docs/plans/phase-118-ui-ux-comprehension-pass.md` per the per-issue
workflow in `CLAUDE.md`. The sub-sections that follow remain here as
historical context for the original clarity-pass framing; the
authoritative plan for Phase 118 lives in the lifted file.

### 8.1 Diff grouping in the Daily Report

The Significant Changes list flat-renders up to 8 mixed-category
rows. On a busy day this is a wall of stock + pressures +
reputation + coin that the player must mentally cluster. The
follow-up groups them under category headers:

- **Coin & reputation** — coin delta + every `reputation.<axis>`
  change. Always at top.
- **Stock** — every `stock.<id>.<field>` change, sorted by
  absolute delta.
- **Pressures** — every `pressures.<id>.value` change, sorted by
  absolute delta. Each row shows the pressure label and trend
  arrow.
- **Areas** — every `areas.<id>.<field>` change, surfaced only
  when one of the four area meters crossed a threshold.

Implementation lives in `src/reports/dailyReportProjection.ts`.
`projectTopDiffs` returns a `GroupedDiffs` shape; `DailyReport.svelte`
renders one `<section>` per non-empty group. The `TOP_DIFFS_CAP`
constant moves from global cap to per-group cap (e.g. 4) with an
overall ceiling (e.g. 12).

### 8.2 Empty-state copywriting

Every panel/section gets a player-facing empty state:

| Panel/section | Today | After |
|---|---|---|
| `ActionPicker` action list (per tab) | "no actions in this category" | "Nothing to do here right now. Try the Immediate tab." |
| `ActionPicker` after picks cleared | (no message) | "Your action points are unspent. Tap Done to skip planning." |
| `RecipesPanel` On menu (empty) | "No recipes on the menu…" | keep; add "Stew, Ale, and Mushrooms are good starters." |
| `StockPanel` shortages section | (no message) | "No shortages — supply is keeping up with demand." |
| `StaffPanel` no staff | (no message) | "You have no staff. Hire from the World → Hireable list." |
| `ProjectsPanel` no active projects | (no message) | "No projects underway. Start one from Plan the Day → Projects." |
| `WorldScreen` empty rosters | (no message) | "You haven't met any suppliers yet. They arrive as your reputation grows." |
| `TavernLog` empty | "no entries" | "Your tavern's log is empty. Entries appear as days close." |

Inline component strings; no i18n table. `Glossary.svelte` copy
patterns set the tone.

### 8.3 Glossary content additions

Audit every player-facing term. New terms added by ISSUE-078:
"upkeep" (recipe tag), "ON/OFF" policy state semantics, "action
points", "queued action" (chip vs applied), "demand tier", "spoilage",
"shortage", "expedition outcome" labels. Existing terms missing
entries: "renown" axes, the day-type labels visible in the top bar,
every pressure surfaced in the new grouped pressures section
in §8.1. Wire `TermLabel` at the first occurrence per screen.

Also adds a short **first-encounter hint** sheet for the four big
concepts on a fresh save (action points, pressures, reputation
axes, day types) via the Phase 98 first-encounter chassis.

### 8.4 Information-density tuning

Tavern panels still pack a lot per row. Tune:

- **Recipes:** rarity pill + prep number + served-times subtitle
  → collapse `prep N` and `served N times` into one dim `meta`
  line wrapping under the label.
- **Stock:** primary line shows quantity + status; quality and
  spoilage move into the detail sheet. "Used for upkeep" stays
  inline.
- **Areas:** adjective + single 3-segment bar showing worst
  meter + problem count badge ("⚠ 2"). Full meter breakdown in
  the area detail sheet.
- **Staff:** row shows role + morale; skill and intent in the
  detail sheet.

Only row internals change; design tokens and screen-level layout
stay as-is.

### 8.5 Verification for the follow-up

- Snapshot tests for a busy-day fixture asserting grouped
  sections render with correct totals per group and respect
  the per-group cap.
- Per-panel empty-state tests mounting each panel against a
  fixture state with the relevant list empty.
- Glossary coverage test that walks every `TermLabel` term in
  components and asserts a matching glossary entry.
- Manual: end a busy day with mixed diffs; confirm grouped
  sections render; open stock/area detail sheets and confirm
  the moved-out metrics are there.

### 8.6 Scope boundary

Phase 2 still does not introduce: a sim-side label registry, an
i18n string table, changes to `SimResult` or `StateChange`, a
redesign of bottom-nav / top-bar / screen layout, or tutorial
overlays. Translation stays in `src/reports/labels/` + web; copy
stays inline English; pacing of introductions is the
progressive-onboarding arc's job.

## References

- `docs/plans/game-loop-and-ux.md §3.6` — daily report design
  goal this phase brings the implementation in line with.
- `docs/plans/progressive-onboarding.md` — Tier 4 arc that
  ISSUE-078 and ISSUE-079 land before. Progressive onboarding
  becomes effective only once each surface is comprehensible
  standalone.
