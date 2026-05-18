# Phase 97 — End-of-day failure visibility

> Repair-pass phase landing [`ISSUE-057`](../ISSUE_TRACKER.md). Also
> seeds the deferred follow-ups
> [`ISSUE-058`](../ISSUE_TRACKER.md) (web UI smoke-test coverage) and
> [`ISSUE-059`](../ISSUE_TRACKER.md) (`$derived.by` audit). Honors
> [`cards-contract.md §1`](./cards-contract.md): the simulation stays
> the source of truth — this phase only changes how UI surfaces
> propagate sim/projection failures.

## Context — why this change

A user reported the END DAY button on the Day → Closing beat "doesn't
appear to do anything." Static analysis of the wiring is clean:
`DayScreen.svelte:412` binds `onclick={endDay}` → `endDay()` calls
`gameStore.runDay(...)` → `gameStore.setBeat('report')`. All 1614
simulation tests pass; `svelte-check` is clean. But the symptom is
real, and the symptom class is systemic:

- `gameStore.runDay()` was called bare. Any throw from `simulateDay`
  killed the handler before `setBeat('report')` ran. **The button
  truly did nothing.**
- `buildDailyReport()` ran inside a `$derived.by(...)` with no error
  containment. A throw made the entire `{#if … && dailyReport}` block
  vanish — indistinguishable from "the button did nothing."
- `App.svelte` had no error boundary. Render-time errors silenced the
  whole tree.
- `tests/web/` had no Svelte component tests. The day loop had never
  been exercised in CI.

This phase makes those failures **observable and recoverable** instead
of invisible. The bandaid would be guessing at the specific throw site
(none was definitively identified from static analysis); the real fix
makes every current and future occurrence diagnosable.

## Goals

- Players see a real error message and a recovery path when the day
  loop or a report projection fails — never a blank screen.
- Developers see a failing component test when a future change breaks
  the end-of-day flow.
- The defensive surface follows existing patterns (`saveError` banner,
  `LoadOutcome` discriminated union) so the new code reads naturally
  alongside the rest of the web layer.

## Non-goals

- Identifying the specific original throw site. The defensive layer
  surfaces whatever the throw is — at which point a focused follow-up
  can address it.
- Full UI smoke-test coverage (deferred to ISSUE-058).
- Hardening every `$derived.by` block (deferred to ISSUE-059).
- Telemetry / crash reporting / remote error collection.

## Implementation

Three layers of defense, each independent of the others, plus tests
and infrastructure.

### Layer 1 — store-side error state

`web/src/lib/sim/gameStore.svelte.ts`:

- New `runError: { message: string; stack?: string } | undefined =
  $state(undefined)` near the existing `saveError` field.
- New `clearRunError()` setter.
- `reset()` clears `runError`.
- `runDay()` itself does **not** swallow errors — the store mirrors the
  `saveError` pattern where the caller owns error capture.
- Inside `runDay()`, `simulateDay()` is now called with
  `$state.snapshot(this.state) as TavernState` instead of the raw $state
  proxy. Canonical Svelte 5 idiom, and keeps the engine's
  `structuredClone` path working in environments where structuredClone
  is stricter than Chrome (jsdom in the new component tests).

### Layer 2 — handler-side try/catch (event errors)

`web/src/lib/screens/DayScreen.svelte`:

- `endDay()` and `runQuickDay()` wrap `gameStore.runDay(...)` in
  try/catch. On throw: `gameStore.runError = { message, stack? }`; do
  NOT advance the beat. On success: `setBeat('report')` as before.
- New `retryEndDay()` (clears the error and re-calls `endDay()`) and
  `dismissRunError()` (clears only).
- New banner at the top of the closing-beat actions block, and at the
  top of the morning-beat actions block (for Quick Day failures), that
  renders when `gameStore.runError` is set: "Couldn't end the day. /
  Couldn't run the day." with the error message in monospace and
  Retry/Dismiss controls.

### Layer 3 — derived-side try/catch (render errors)

`web/src/lib/screens/DayScreen.svelte`:

- `dailyReport` is now a discriminated union: `{ ok: 'success'; data }
  | { ok: 'empty' } | { ok: 'error'; error: string }`. `buildDailyReport`
  is wrapped in try/catch inside the `$derived.by` body.
- The `beat === 'report'` block renders three branches: `success` →
  existing `<DailyReport>`; `empty` → "Day complete (no report yet)"
  fallback panel; `error` → "Report unavailable" panel with the
  message. All three end with a Next day button.
- `nextDayLabel` and `yesterdayDigest` updated to consume the union.

`web/src/lib/screens/ReportsScreen.svelte`:

- `report`, `weeklyOverview`, `monthlyOverview` all become the same
  discriminated union via a shared local `safeProject<T>()` helper.
- Each subview renders a small "unavailable" panel when the projection
  is on the error branch.

### Layer 4 — App-level boundary (last-resort render errors)

`web/src/App.svelte`:

- Wraps the routed `<AppShell>` content in `<svelte:boundary>` with a
  `failed` snippet rendering a recovery panel ("Something went wrong.")
  with two buttons: Go to Day (clears the route to 'day' and resets the
  boundary) and Reload (`location.reload()`).
- Comment notes explicitly that the boundary catches render-phase
  errors only — event-handler errors are still the job of the per-call
  try/catch in DayScreen.

### Test infrastructure

- `package.json` — three new devDependencies: `@testing-library/svelte`,
  `@testing-library/jest-dom`, `jsdom`.
- `vitest.config.ts` — adds the `@sveltejs/vite-plugin-svelte` plugin
  (needed to compile `.svelte` and `.svelte.ts` files in tests) and
  `@testing-library/svelte/vite` plugin (adds `browser` resolve
  condition so Svelte's client-mode `mount()` is used). Adds
  `environmentMatchGlobs: [['tests/web/components/**/*.test.ts',
  'jsdom']]` so only component tests pay the jsdom startup cost.

### New tests

- `tests/web/components/dayScreen.test.ts` — three tests:
  1. **Happy path.** Walk to closing, click End day, assert beat
     advances to `'report'` and the DailyReport header renders.
  2. **`simulateDay` throws.** Mock simulateDay to throw on the next
     call. Click End day. Assert beat stays at `'closing'`, banner with
     error message renders, `gameStore.runError` is set. Click Retry
     after restoring the real engine; assert beat advances.
  3. **`buildDailyReport` throws.** Mock the projection. Click End day.
     Beat advances; fallback panel renders with the error message; Next
     day still works.
- `tests/web/components/reportsScreen.test.ts` — one test: after a real
  day has been run, mock `buildDailyReport` to throw; mount
  ReportsScreen on the Today subview; assert the "Report unavailable"
  panel renders.

## Testing

```sh
npm run typecheck      # clean
npm run check          # svelte-check, clean (preexisting BottomSheet a11y warning unchanged)
npm test               # 1614 sim tests + 4 new component tests = 1618 pass
npx vitest run tests/web/components/   # focused run on the new tests
```

## Risks

- `<svelte:boundary>` (added in Svelte 5.0) catches render-phase errors
  only. Event-handler errors slip past it — that's why the per-call
  try/catch in DayScreen is layered on top, not replaced by it. The
  plan doc and inline comments make this explicit.
- `$state.snapshot()` adds one deep copy per day inside `runDay`. The
  engine's `cloneTavernState` already deep-clones, so this is a
  near-double cost on the entry. Day pipelines spend most of their time
  in module hooks and report builders, so the relative overhead is
  small.
- `environmentMatchGlobs` is the vitest 1.x API and renames in vitest
  3.x. Flagged in the config comment for the upgrade ticket.
