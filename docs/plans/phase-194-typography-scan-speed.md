# Phase 194 / ISSUE-161 — Typography scan-speed pass

Locked contract: `docs/plans/ui-ux-intuitiveness-arc.md` (§Phase 194).
This doc is the implementation record; read the contract section first for
goal/scope/acceptance.

## Goal

Stop letting decorative type carry functional load. Split the overloaded
`.tag` class so high-frequency chrome parses fast and decorative atmosphere
stays where it belongs.

## What shipped

### 1. The four-class vocabulary (`web/src/lib/design/global.css`)

The old `.tag` (small-caps, 0.06em tracking, 12px, `--text-faint`) carried
four jobs at once. It is split into a small, documented vocabulary, and a
new `--type-chip: 0.8125rem` (13px) token drives the functional set so it
still honours the phase-98 font-scale override:

| Class | Style | Job |
| --- | --- | --- |
| `.section-label` | small-caps **kept**, 13px, `--text-dim` | section header markers ("Rising", "Morning", block labels) |
| `.chip` | sentence case, 13px, `--text` | inline status / metric / nav labels — the default for functional chrome |
| `.badge` | `.chip` + emphasis box (border/padding/radius) | coloured emphasis pills (topbar day-type, policy on/off, accuracy) |
| `.tag` (narrowed) | unchanged small-caps | **true meta context only** — passive, non-tappable |

The acceptance contract for `TermLabel` (static dotted underline) vs
`EntityLink` (hover-only border-bottom) was already documented in
`global.css` from phase 190a and is unchanged.

### 2. Migration (~250 sites, ~50 files)

Every `class="…tag…"` was audited and migrated by its job:

- **Headers → `.section-label`.** All `block-label tag` / `bucket-label tag`
  markers (DailyReport, Weekly/MonthlyOverview, dashboards, panels) plus the
  ActionPicker "Suggested" head.
- **Functional labels → `.chip`.** The large bulk: report stat/diff labels,
  panel sub/foot/meta lines, detail-sheet `terms`, status/rarity/pill text,
  picker hints, plan-row metadata, etc. `.chip` supplies typography only; any
  coloured box stays on the component's own scoped class (which wins on
  specificity), so no pill lost its colour or box.
- **`.badge`.** The global utility backs the pre-existing scoped `.badge`
  users (TopBar day-type, RecipeDetailSheet policy on/off, AccuracyBadge);
  `AccuracyBadge` dropped its decorative `tag` and now reads
  `class="badge {accuracy}"`. Emphasis pills that already carry their own
  scoped box (warn-pill, problem-badge, rarity) migrated to `.chip` rather
  than `.badge` so the global badge box is never double-applied.
- **`.tag` retained** on nine passive meta labels only (see test allowlist):
  the YesterdayDigest "Yesterday · Day N" header, Weekly/Monthly
  "(closed N days ago)" notes, TavernLog day-coordinate / result-count /
  "involving" meta, the CauseDrilldown cause-meta line, and two
  component-scoped footnotes (CardRenderer seed-family corner, AboutSection
  phase note). All are non-tappable, so retaining small-caps is fine under
  acceptance criterion 2.

### 3. Tappable small-caps removed (criterion 2)

The primary scan-speed offenders had hand-rolled small-caps in scoped
styles, not via `.tag`. Removed from: `BottomNav .label`, the three screen
`.subtab`s (Reports/Tavern/World), and the ActionPicker `.tab` strip.

### 4. Collision handling

Two components owned a *scoped* `.chip` whose meaning differs from the new
global utility. To use the global `.chip` safely there:
- `ActionPicker`'s queued-pick pill `.chip` → renamed `.pick-pill`.
- `ActionQueueChip`'s inner label dropped `tag` and got sentence-case
  typography on its own `.label` (its root keeps the component-scoped
  `.chip`, which wins on specificity).

## Tests

`tests/web/phase194.typography.test.ts` (14 tests):
- global.css vocabulary: `.section-label`/`.tag` keep small-caps,
  `.chip`/`.badge` drop it, `.badge` carries a box.
- tappable chrome (BottomNav/subtabs/picker tabs) is sentence case.
- key components emit the new classes (DailyReport section headers,
  ActionPicker chip + section-label, AccuracyBadge badge).
- regression guard: a recursive scan asserts `class="…tag…"` appears ONLY
  on the nine-entry meta allowlist — any new `.tag` in chrome fails.
- ActionPicker DOM renders `.chip` and no `.tag`.

`npm run typecheck` + `npm run check` (svelte-check, 0 errors) green; all
242 `tests/web` pass.

## Do not do (honoured)

- No font-family changes; no global font-size scale change (the split is
  style, not scale — `--type-chip` is +1px only on the functional set that
  the contract specified bumps to 13px).
- `.section-label` keeps small-caps; report prose + empty-state voice lines
  untouched; no new utility classes beyond the four named.
