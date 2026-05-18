# Phase 98 — The "More" tab: Settings, Save Slots, First-Encounter Hints, New-Game Difficulty

**Status:** done.

## Context

Phases 87–97 shipped the web UI: card layer, Day/Reports/Tavern/World
screens, voice/identity, autosave, returning-player UX, and the
missed-opportunity affordance. The one major surface called out in
[`game-loop-and-ux.md §6`](./game-loop-and-ux.md) that hadn't been built
was the **More** tab — Settings, Save Management, Help, About — plus
the unresolved §9 open questions on first-encounter tooltips (§9.4)
and difficulty/seed options at new-game time (§2.1).

Phase 98 lands the More tab end-to-end, implements first-encounter
hints, and adds a 3-preset difficulty picker to the start screen.

## Goal

A 5th bottom-nav tab containing:

1. **Settings** — font scale, reduced motion (tri-state auto/on/off),
   show seed tags toggle, confirm-before-end-day toggle, show
   first-encounter hints toggle, reset button.
2. **Saves** — autosave row, up to 5 named snapshots with rename /
   load / delete, export (JSON download), import (JSON upload), storage
   budget warning.
3. **Help** — short intro plus quick-jump buttons into the existing
   glossary at named anchors, plus a version stamp.
4. **About** — small credits block.

Plus:

- **First-encounter hints** — when enabled (default on) and during the
  introductory week (≤ day 7), the first time a glossary term appears
  via `<TermLabel>` in the player's viewport, a small popover surfaces
  the one-line definition. Only one hint is visible globally at a
  time; dismissals are remembered.
- **Difficulty picker** on StartScreen advanced section. Three presets:
  easy (150 coin, softer decay pressures, cleaner areas), standard
  (the shipped baseline), hard (75 coin, stickier baseline). Sticky
  via prefs.

## Architectural decisions

1. **Single source of truth for `Route`.** Moved the union into
   `web/src/lib/sim/persistence.ts`. `BottomNav.svelte` and
   `AppShell.svelte` re-import it.
2. **Preferences are in their own localStorage slot**
   (`goblin-tavern:prefs:v1`), never in `PersistedSession`. Start Over
   preserves preferences. Hydration runs before `loadSession()` so the
   CSS data-attribute `$effect` paints before the first render.
3. **Snapshots reuse `PersistedSession` byte-for-byte** with a wrapping
   `SnapshotMeta`. `loadSnapshot(id)` returns the same
   `ValidationOutcome` as `loadSession()` — the hydrate path doesn't
   care which slot fed it.
4. **Difficulty is start-time-only.**
   `createInitialTavernState(overrides?, difficulty?)` applies the
   preset BEFORE merging overrides (existing tests with overrides
   remain green). No `difficulty` field on `TavernState` — a loaded
   save carries whatever values the player has played to.
5. **First-encounter logic is a pure TS helper.**
   `shouldShowFirstEncounterHint(termId, prefs, day)` lives in plain
   TS, tested directly. The Svelte component is a thin renderer.
6. **One first-encounter hint visible at a time.** Serialized via
   `prefsStore.claimHintSlot(id)` / `releaseHintSlot()` so a viewport
   full of `TermLabel`s doesn't pulse in unison.
7. **`reducedMotion` is tri-state** (`auto | on | off`), not boolean.
   `auto` respects the OS preference (existing `@media` query); `on`
   and `off` force via `<html data-reduced-motion>` attribute.

## New files

### Preferences slice

- `web/src/lib/prefs/preferences.ts` — pure save/load helpers, key
  `goblin-tavern:prefs:v1`, version 1, sanitization.
- `web/src/lib/prefs/prefsStore.svelte.ts` — reactive `PrefsStore`
  singleton; setters write synchronously; hint-slot serialization.
- `web/src/lib/prefs/firstEncounter.ts` — pure
  `shouldShowFirstEncounterHint()` + auto-dismiss timeout constant.

### Save-slot slice

- `web/src/lib/sim/snapshots.ts` — index at
  `goblin-tavern:saves:v1`, per-snapshot blobs at
  `goblin-tavern:saves:v1:{id}`, CRUD + budget guard (4 MB ceiling,
  3 MB warning).
- `web/src/lib/sim/exportImport.ts` — file download trigger and JSON
  parser routing through `validatePersistedSession`. DOM access funneled
  through `globalThis` so the file type-checks under the non-DOM main
  tsconfig.

### Difficulty (sim-side)

- `src/sim/state/difficulty.ts` — pure helper with
  `DIFFICULTY_PRESETS` and `applyDifficultyToBase(base, config)`. Deep
  clones before modifying; all numeric deltas clamped to `[0, 100]`.

### Screens / components

- `web/src/lib/screens/MoreScreen.svelte` — stacked-section layout
  hosting the four sections.
- `web/src/lib/components/more/SettingsSection.svelte`
- `web/src/lib/components/more/SavesSection.svelte`
- `web/src/lib/components/more/HelpSection.svelte`
- `web/src/lib/components/more/AboutSection.svelte`
- `web/src/lib/components/more/SnapshotRow.svelte`
- `web/src/lib/components/FirstEncounterHint.svelte` — popover anchored
  to a `TermLabel`; IntersectionObserver triggers, auto-dismiss + tap-
  outside dismiss, and slot release on unmount.

### Tests

- `tests/web/preferences.test.ts` — round-trip, defaults, sanitization,
  version mismatch.
- `tests/web/snapshots.test.ts` — full CRUD, budget guard, slot limit,
  index resilience.
- `tests/web/difficulty.test.ts` — each preset's effect on day-zero
  state, clamping at boundaries, overrides-win semantics.
- `tests/web/firstEncounter.test.ts` — pure helper truth table.
- `tests/web/exportImport.test.ts` — filename format, round-trip, error
  paths.

## Modified files

- `web/src/lib/sim/persistence.ts` — Route union gains `'more'`;
  `VALID_ROUTES` updated; new exported `validatePersistedSession()` and
  `ValidationOutcome` type; existing `loadSession()` delegates.
- `web/src/lib/components/BottomNav.svelte` — Route imported from
  persistence; 5 tabs; `grid-template-columns: repeat(5, 1fr)`.
- `web/src/lib/components/AppShell.svelte` — Route import path.
- `web/src/lib/components/Icon.svelte` — new `'more'` (gear) icon.
- `web/src/App.svelte` — `prefsStore.hydrate()` before `loadSession()`;
  a `$effect` mirrors prefs onto `<html data-font-scale>` and
  `<html data-reduced-motion>`; `startGame()` passes the prefs'
  difficulty preset to `gameStore.reset()`; new `view === 'more'`
  branch renders `<MoreScreen>` with an `onreplaced` callback that
  re-routes after snapshot load / import.
- `web/src/lib/sim/gameStore.svelte.ts` — `reset(seed?, difficulty?)`
  passes `difficulty` through to `createInitialTavernState`.
- `src/sim/state/defaults.ts` —
  `createInitialTavernState(overrides?, difficulty?)`. Order:
  base → difficulty → overrides.
- `web/src/lib/screens/StartScreen.svelte` — difficulty picker (3
  buttons) in the advanced disclosure; reads/writes
  `prefsStore.preferences.lastDifficulty`.
- `web/src/lib/components/TermLabel.svelte` — renders
  `<FirstEncounterHint>` when applicable and applies a pulse class.
- `web/src/lib/screens/DayScreen.svelte` — End Day button respects
  `prefsStore.preferences.confirmEndDay` (inline confirm row).
- `web/src/lib/cards/CardRenderer.svelte` — seed `[tag]` in card corner
  hidden when `prefsStore.preferences.showSeedTags === false`.
- `src/reports/glossary.ts` — three new mechanic entries (`settings`,
  `save_slots`, `font_scale`) referenced by HelpSection.
- `web/src/lib/design/global.css` — `[data-font-scale]` selectors;
  `[data-reduced-motion]` overrides that interplay correctly with
  the OS-level media query; `.first-encounter-pulse` keyframe.
- `tests/web/persistence.test.ts` — three new tests for
  `route: 'more'` round-trip, pre-Phase-98 compat, and defensive
  sanitization of unknown routes.

## Verification

- `npm run typecheck` — green.
- `npm run check` (svelte-check) — green, no warnings.
- `npm run build` — succeeds; bundle ~299 KB gzipped (up from
  ~274 KB at Phase 97).
- `npm test` — 1518 prior tests + 49 new tests, all green.
- Manual dev pass through the new flows:
  - StartScreen advanced → difficulty picker → easy → Open the Tavern
    → coin reads 150.
  - 5 bottom-nav tabs. More → all four sections render.
  - Font scale to lg → body text grows. Reduced motion to on →
    animations stop. Seed tags off → card corner [tag] disappears.
  - Snapshot now → name it → see in list → Export → JSON downloads
    → delete → Import → preview → confirm → game state replaces and
    the player lands in Day on the loaded run.
  - Fresh save: open Reports → tap a TermLabel chip on a pressure →
    first-encounter hint appears, auto-dismisses, doesn't re-appear.

## Out of scope

- Migrating design tokens from px to rem so font-scale affects more
  than body text. The current change adjusts root font-size; tokens
  using rem will scale, tokens using px (most of them) won't. A
  future polish pass can migrate.
- Push notifications. Per `game-loop-and-ux.md §7.5` these are
  explicitly off the roadmap.
- Multiple in-flight runs (slot-based switching between saves
  without losing the other). The current model is "one active run,
  named snapshots are static backups."
