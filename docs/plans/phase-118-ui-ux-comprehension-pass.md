# Phase 118 — UI/UX Comprehension Pass

Tracker: `ISSUE-079` in `docs/ISSUE_TRACKER.md`.

## Context

Phase 117 (`docs/plans/phase-117-ui-ux-clarity-pass.md`, `ISSUE-078`)
landed the translation layer: `idLabel()` and `humanizePath()` plus
the structural fixes for the three loudest surfaces — diffs, the
policy picker, and the recipe panel.

The clarity pass made each surface *legible*. Four classes of
comprehension friction remain — they make screens *dense* even when
each individual word is now player-facing. This phase is the
information-design follow-up the clarity pass deferred. Per §8.6 of
the Phase 117 plan, the §8 design seed has been lifted here.

The four classes:

1. **Significant changes** in the Daily Report still flat-renders up
   to 8 mixed-category rows. On a busy day this is a wall of stock +
   pressures + reputation + coin that the player must mentally
   cluster.
2. **Empty states** across panels default to no message or to a thin
   "no items" line — players hit dead ends with no guidance.
3. **Glossary coverage** is partial. Phase 117 surfaced new terms
   (upkeep, ON/OFF policy state, action points, queued action,
   demand tier, spoilage, shortage, expedition outcomes, day types,
   every pressure label) that lack `TermLabel` wiring at their first
   on-screen occurrence.
4. **Tavern panel rows** still pack 4–6 metrics inline (staff row,
   stock row, area row, recipe row). Detail sheets already exist —
   secondary metrics should live there.

## Design rules

1. **The simulation is the source of truth.** Engine output is
   unchanged; this is pure projection + view work.
2. **One canonical lookup.** Reuse `idLabel` / `humanizeId` /
   `humanizePath` from Phase 117 — no second translator.
3. **Pure projection.** No new state shape, no migration, no schema
   changes. New view-model fields are additive.
4. **Additive copy.** Empty-state copy stays inline English; no i18n
   layer; the existing `Glossary` + `TermLabel` + `FirstEncounterHint`
   chassis is sufficient for first-encounter education.

## Plan

### 1. Diff grouping in the Daily Report (§8.1)

The Significant Changes list flat-renders up to 8 mixed-category
rows. Group them under category headers:

- **Coin & reputation** — coin delta + every `reputation.<axis>`
  change. Always at top.
- **Stock** — every `stock.<id>.<field>` change, sorted by absolute
  delta.
- **Pressures** — every `pressures.<id>.value` change, sorted by
  absolute delta. Each row shows the pressure label and trend arrow.
- **Areas** — every `areas.<id>.<field>` change, surfaced only when
  one of the four area meters crossed a threshold.

Implementation lives in `src/reports/dailyReportProjection.ts`. A new
`projectGroupedDiffs(significant)` returns a `GroupedDiffs` shape;
`DailyReport.svelte` renders one `<section>` per non-empty group.
`projectTopDiffs` is preserved for back-compat snapshot callers.

`TOP_DIFFS_PER_GROUP_CAP = 4` and `TOP_DIFFS_OVERALL_CAP = 12` —
per-group sliced first, then overall ceiling trims tails.

### 2. Empty-state copywriting (§8.2)

Every panel/section gets a player-facing empty state:

| Panel/section | Today | After |
|---|---|---|
| `ActionPicker` action list (per tab) | "no actions in this category" | "Nothing to do in this tab right now. Try Immediate." |
| `ActionPicker` after picks cleared (ap full) | (no message) | "Your action points are unspent. Tap Done to skip planning." |
| `RecipesPanel` On menu (empty) | "No recipes on the menu. …" | append " Stew, Ale, and Mushrooms are good starters." |
| `StockPanel` shortages section | (no message) | "No shortages — supply is keeping up with demand." |
| `StaffPanel` no staff | (no message) | "You have no staff. Hire from the World → Hireable list." |
| `SuppliersPanel` empty | (verify) | "You haven't met any suppliers yet. They arrive as your reputation grows." |
| `TavernLog` empty | "No history yet — run a day to start the log." | keep — good. |

Inline component strings; no i18n table.

### 3. Glossary content + TermLabel wiring (§8.3)

Audit every player-facing term. New terms added by ISSUE-078:
"upkeep" (recipe tag), "ON/OFF" policy state semantics, "action
points", "queued action" (chip vs applied), "demand tier",
"spoilage", "shortage", "expedition outcome" labels. Existing terms
missing entries: "renown" axes, the day-type labels visible in the
top bar, every pressure surfaced in the new grouped pressures
section in step 1.

Wire `<TermLabel>` at the first occurrence per screen:

- `DailyReport.svelte` — grouped-pressures rows; coin & reputation
  axis names.
- `TopBar.svelte` — day-type label.
- `StockPanel.svelte` — "used for upkeep" pill.
- `ActionPicker.svelte` — action-points budget header.

First-encounter hints fire automatically via the existing per-term
`FirstEncounterHint` chassis (Phase 98). No new component.

### 4. Information-density tuning (§8.4)

Tavern panels still pack a lot per row. Tune:

- **Recipes:** rarity pill + prep number + served-times subtitle →
  collapse `prep N` and `served N times` into one dim `meta` line
  wrapping under the label.
- **Stock:** primary line shows quantity + status; quality and
  freshness move into the detail sheet. "Used for upkeep" stays
  inline.
- **Areas:** adjective + single 3-segment bar showing worst meter +
  problem count badge ("⚠ 2"). Full meter breakdown in the area
  detail sheet.
- **Staff:** row shows role + morale; stress + fatigue move to the
  detail sheet.

Only row internals change; design tokens and screen-level layout
stay as-is.

## Critical files

### New

- `tests/reports/groupedDiffs.test.ts` — classifier + caps for the
  grouped projection.
- `tests/web/components/emptyStates.test.ts` — per-panel empty-state
  copy assertions.
- `tests/web/glossaryCoverage.test.ts` — static check that every
  `<TermLabel term="…">` resolves to a glossary entry.
- `tests/web/components/density.test.ts` — moved-out metrics live in
  detail sheets, not panel rows.

### Touched

- `src/reports/types.ts` — `GroupedDiffs` type; `DailyReportData`
  gains `groupedDiffs`.
- `src/reports/dailyReportProjection.ts` — `projectGroupedDiffs` +
  per-group/overall caps; `projectTopDiffs` preserved.
- `src/reports/glossary.ts` — new mechanic / day-type / expedition /
  pressure / renown entries.
- `web/src/lib/components/DailyReport.svelte` — render
  `groupedDiffs` as four `<section>`s; TermLabel wiring.
- `web/src/lib/components/ActionPicker.svelte` — empty-state copy,
  action-points TermLabel.
- `web/src/lib/components/TopBar.svelte` — day-type TermLabel.
- `web/src/lib/components/tavern/RecipesPanel.svelte` — meta-line
  collapse, empty-state append.
- `web/src/lib/components/tavern/StockPanel.svelte` — row density,
  shortages empty state, upkeep TermLabel.
- `web/src/lib/components/tavern/StaffPanel.svelte` — empty state,
  row density.
- `web/src/lib/components/tavern/AreasPanel.svelte` — single-meter +
  problem-count badge row.
- `web/src/lib/components/world/SuppliersPanel.svelte` — empty state.

## Verification (status: complete)

- `npm test` — 1681 tests pass across 126 files (up from 1657 in
  Phase 117). New: 11 grouped-diff tests, 5 empty-state tests,
  2 glossary-coverage tests, 6 density tests = 24 new.
- `npm run typecheck` — clean.
- `npm run check` (svelte-check) — clean apart from the same
  pre-existing BottomSheet a11y warning Phase 117 called out.

Manual spot-checks:
- Daily report renders separate sections per non-empty group
  (Coin & reputation, Stock, Pressures, Areas), each capped at 4,
  overall ceiling 12.
- ActionPicker shows "Your action points are unspent. Tap Done to
  skip planning." when no picks are queued, and category-specific
  empty hints per tab.
- StockPanel surfaces "No shortages — supply is keeping up with
  demand." when nothing is low or spoiling; staff and suppliers
  panels show actionable empty-roster copy.
- TopBar's day-type segment is a TermLabel chip; tapping it opens
  the glossary at the matching entry.
- Tavern panel rows are visibly denser: areas show one bar + ⚠ N
  badge, stock rows are quantity + status only, staff rows show
  morale only, recipes collapse prep + served into one dim line.
  Full meters live in their respective detail sheets.

## Scope boundary

This phase still does not introduce: a sim-side label registry, an
i18n string table, changes to `SimResult` or `StateChange`, a
redesign of bottom-nav / top-bar / screen layout, or tutorial
overlays. Translation stays in `src/reports/labels/` + web; copy
stays inline English; pacing of introductions is the
progressive-onboarding arc's job.

## References

- `docs/plans/phase-117-ui-ux-clarity-pass.md` — translation layer
  this phase builds on (§8 of that file is the design seed lifted
  here).
- `docs/plans/game-loop-and-ux.md §3.6` — daily report design goal.
- `docs/plans/progressive-onboarding.md` — Tier 4 arc that this
  phase lands inside. Progressive onboarding becomes effective only
  once each surface is comprehensible standalone.
