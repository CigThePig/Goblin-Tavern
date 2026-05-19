# Phase 119 + 120 — Web UI test coverage + `$derived` audit

> Combined repair-pass phase landing [`ISSUE-058`](../ISSUE_TRACKER.md)
> (web UI component smoke-test coverage) and
> [`ISSUE-059`](../ISSUE_TRACKER.md) (unprotected cross-module builders
> inside `$derived` / `$derived.by`). Continues the defensive layer
> started in Phase 97 / ISSUE-057.

## Context — why this change

Phase 97 / ISSUE-057 fixed the worst-symptom case (End Day silently
doing nothing) with three layers of defense around the day loop:
store-side `runError`, handler-side try/catch, derived-side try/catch
for the four highest-risk projections (`buildDailyReport` ×2,
`buildWeeklyOverview`, `buildMonthlyOverview`), plus an App-level
`<svelte:boundary>`. It also stood up the first Svelte component tests
(`tests/web/components/dayScreen.test.ts`, `reportsScreen.test.ts`)
under jsdom via `vitest.config.ts`'s `environmentMatchGlobs`.

Two deliberate follow-ups were deferred:

1. **ISSUE-058** — Only DayScreen and one ReportsScreen failure path
   had component tests. Every other top-level screen (Tavern, World,
   More, Start) and every major bottom sheet (ActionPicker,
   StaffPrioritySheet, CommissionExpeditionSheet) had never been
   exercised in CI.
2. **ISSUE-059** — Five cross-module builders still ran inside reactive
   reads with no try/catch (`buildTavernOverview`, `buildWorldOverview`,
   `projectYesterdayDigest`, `causesForPath`, the rare-ingredients
   `stockRegistry.all()` chain). A throw from any of them propagated to
   the App boundary and unmounted the entire `<AppShell>` tree.

Both issues build on the same scaffolding — the test stack and the
`{ ok, data | error }` discriminated-union projection pattern — so they
landed as one combined phase. The pattern that lived inlined in
`ReportsScreen.svelte` is now extracted to a shared module that every
wrap site (old and new) imports from.

## Goals

- Every top-level screen and every major bottom sheet has at least one
  smoke test that mounts the component, exercises one primary
  interaction, and asserts a visible state change.
- One cross-screen flow test (queue → Day → End Day → Report) catches
  breakage that single-screen tests would miss.
- Every cross-module builder invoked from a reactive read in the web
  layer is wrapped in `safeProject<T>(fn)`. A throw renders a
  screen-local "unavailable" panel; the rest of the UI stays live.
- The discriminated-union pattern lives in one place
  (`web/src/lib/sim/projectionSlot.ts`); all wrap sites import it.

## Non-goals

- Wrapping every `$derived` / `$derived.by` block in the web layer.
  Trivial local label / filter / map computations stay covered by the
  App-level boundary.
- Diagnosing or fixing the underlying builder bugs. The fallback panel
  surfaces the thrown message so a focused follow-up can address each
  real failure.
- Visual / pixel-layout tests. Smoke tests assert presence + behaviour,
  not appearance.

## Implementation

### Layer 1 — extract the shared helper

New file `web/src/lib/sim/projectionSlot.ts` exports
`ProjectionSlot<T>` (the three-state discriminated union) and
`safeProject<T>(fn)` (try/catch that returns either `{ ok: 'success',
data }` or `{ ok: 'error', error }`).

The four preexisting Phase 97 wraps now import from this module:
- `DayScreen.svelte` — `dailyReport`
- `ReportsScreen.svelte` — `report`, `weeklyOverview`, `monthlyOverview`

This is behaviour-preserving; all existing dayScreen / reportsScreen
tests continue to pass.

### Layer 2 — wrap five risky cross-module builders

Each new wrap follows the same shape: convert the builder call to
`safeProject(...)`, render the success branch unchanged, render a small
screen-local "unavailable" panel on the error branch.

1. **`web/src/lib/screens/TavernScreen.svelte:43`** — wraps
   `buildTavernOverview(gameStore.state)`. Was bare `$derived(...)`;
   now `$derived.by(() => safeProject(...))`. Subnav stays live on the
   error branch; the panel content is replaced with a
   `role="alert"` block carrying the error message.
2. **`web/src/lib/screens/WorldScreen.svelte:48`** — same shape as
   Tavern. `countFor` returns 0 on the error branch so tab counts
   collapse to `—` (matching the existing zero-count visual). The
   `TavernIdentityStrip` header only renders on success.
3. **`web/src/lib/screens/DayScreen.svelte:135`** — wraps
   `projectYesterdayDigest(dailyReport.data)`. The projection
   legitimately returns `undefined` for a quiet day, which collapses
   to the `empty` branch; thrown errors render a tiny
   `.digest-fallback` panel above the Pressures block.
4. **`web/src/lib/components/CauseDrilldown.svelte:29`** — wraps
   `causesForPath(gameStore.state, path, { limit: 10 })`. The bottom
   sheet now renders three panel states: no-path-selected, no-causes,
   or causes-unavailable.
5. **`web/src/lib/components/tavern/CommissionExpeditionSheet.svelte:56`**
   — wraps the `stockRegistry.all().filter(...).sort(...).map(...)`
   chain. The targeted-mode block surfaces an inline aria-live note
   ("Couldn't load the ingredient catalog (…)") when the projection
   throws; `canQueue` stays gated on `ingredientId !== null` so the
   Queue button correctly disables.

### Layer 3 — new smoke tests under `tests/web/components/`

Nine new test files plus one extension. All follow the `vi.hoisted` +
`vi.mock` + `gameStore.reset('test-seed')` pattern established by
Phase 97.

- `tavernScreen.test.ts` (3 tests) — subnav renders with default tab,
  subtab clicks update store + aria-current, builder throw renders the
  unavailable panel while keeping subnav navigable.
- `worldScreen.test.ts` (3 tests) — same structure for the 6-tab World
  layout.
- `moreScreen.test.ts` (1 test) — all four section headings render
  (Settings, Saves, Help, About).
- `startScreen.test.ts` (4 tests) — fresh vs existing-save CTAs,
  banner copy, difficulty chip → prefsStore, advanced toggle.
- `actionPicker.test.ts` (4 tests) — category tablist with default
  Immediate active, single-target action auto-adds pick, chip removal,
  Policies tab swaps action rows for policy rows.
- `staffPrioritySheet.test.ts` (2 tests) — one radiogroup per staff
  member, clicking a priority writes to `gameStore.staffPriorities`.
- `commissionExpeditionSheet.test.ts` (3 tests) — Queue disabled until
  runner picked, picking runner enables Queue + shows cost preview,
  `stockRegistry.all` throw surfaces the inline aria-live note.
- `causeDrilldown.test.ts` (2 tests) — empty-path placeholder,
  `causesForPath` throw renders the in-sheet alert.
- `crossScreen.flow.test.ts` (1 test) — queue Buy Mugs via
  `gameStore.tryAddPick` (the cross-surface entry point), End Day on
  the DayScreen, assert beat advances + picks drain + `latestResult`
  populated + report header renders.
- `dayScreen.test.ts` (extended by 1 test) — `projectYesterdayDigest`
  throw on morning beat renders the digest fallback while At a glance
  stays live.

No changes to `vitest.config.ts` — `environmentMatchGlobs` already
routes `tests/web/components/**` through jsdom.

### Tracker updates

- `ISSUE-058` Status → `done`, Phase → `119`.
- `ISSUE-059` Status → `done`, Phase → `120`.
- "Current work" callout advances to ISSUE-060 (next-up Tier 4 work).
- `CLAUDE.md` status line updated: 57 done / 18 open / 5 superseded.

## Files touched

**New:**
- `web/src/lib/sim/projectionSlot.ts`
- `tests/web/components/tavernScreen.test.ts`
- `tests/web/components/worldScreen.test.ts`
- `tests/web/components/moreScreen.test.ts`
- `tests/web/components/startScreen.test.ts`
- `tests/web/components/actionPicker.test.ts`
- `tests/web/components/staffPrioritySheet.test.ts`
- `tests/web/components/commissionExpeditionSheet.test.ts`
- `tests/web/components/causeDrilldown.test.ts`
- `tests/web/components/crossScreen.flow.test.ts`

**Modified:**
- `web/src/lib/screens/DayScreen.svelte`
- `web/src/lib/screens/ReportsScreen.svelte`
- `web/src/lib/screens/TavernScreen.svelte`
- `web/src/lib/screens/WorldScreen.svelte`
- `web/src/lib/components/CauseDrilldown.svelte`
- `web/src/lib/components/tavern/CommissionExpeditionSheet.svelte`
- `tests/web/components/dayScreen.test.ts`
- `docs/ISSUE_TRACKER.md`
- `CLAUDE.md`

## Testing

```sh
npm run typecheck                              # clean
npm run check                                  # svelte-check clean (preexisting BottomSheet a11y warning unchanged)
npx vitest run tests/web/components/           # 32 component tests pass
npm test                                       # 1706 tests pass (was 1671 before phase)
```

## Risks

- Each new component test file adds ~30–60ms of jsdom startup. Nine
  new files add ~0.5s to the suite. Mitigated by reusing the existing
  `tests/web/components/**` glob (no config changes).
- `stockRegistry.all()` is unlikely to throw under normal play; the
  wrap is defensive and the unavailable-panel branch will rarely
  exercise in practice — the test mock is the only place it lands.
- The `safeProject` extraction touched the four preexisting Phase 97
  wraps. Pure refactor (same types, same shape); preexisting tests
  passed unchanged, confirming behaviour preservation.
- Wrapping `buildTavernOverview` / `buildWorldOverview` changes them
  from bare `$derived(...)` to `$derived.by(() => safeProject(...))`.
  Adds one closure + one extra function call per dependency change;
  negligible next to the projections themselves.
