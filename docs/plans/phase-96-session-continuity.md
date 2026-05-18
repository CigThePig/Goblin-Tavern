# Phase 96 — Session Continuity: Autosave, Returning Player, Quick Day

> Lands the three deliverables Phase 95's "Out of scope" explicitly
> deferred to Phase 96: **autosave** (`game-loop-and-ux.md §7.4`),
> **returning-player banner** (`§2.3`), and the **Quick Day pattern**
> (`§3.7, §7.4`). Honors [`cards-contract.md §1`](./cards-contract.md):
> the simulation stays the source of truth; the save channel only
> persists what the sim already produces.

## Context — why this change

The game is mechanically complete (Phases 1–86) and visually complete
(Phases 87–95). What ships now would not survive a phone-lock: the
entire session lives in `gameStore`'s in-memory `$state`. Closing or
backgrounding the tab loses the run.

Three concrete failures drive the phase:

1. **No persistence.** `gameStore.svelte.ts` had zero `localStorage`
   touchpoints. Refreshing the tab returned to the StartScreen with a
   fresh `createInitialTavernState()`. `game-loop-and-ux.md §7.4`
   names autosave as a load-bearing mobile requirement.

2. **Returning-player re-orientation was invisible.** Even after a
   manual state restore, the player would need to scan the topbar,
   the pressure ribbon, and yesterday's diff to understand where they
   left off. §2.3 specifies a "since you were away" pill and a
   "yesterday" digest on the morning beat.

3. **Quiet days had full-friction loops.** When the sim produced zero
   seeds across all five timing slots, the player still walked
   `morning → plan → service → closing → report` for a non-decision.

## Locked decisions

| Question | Decision |
|---|---|
| Persistence backend | `localStorage` only. Single slot, key `goblin-tavern:save:v1`. |
| Save granularity | One blob — sim state + view state (beat, pending intents, picks, sticky staff priorities, last result lite, previousCalendar, last route, simSeed). |
| Save trigger | 300 ms debounced `$effect` on the gameStore; hard flush on `visibilitychange === 'hidden'` and on `pagehide`. |
| Save shape stability | Versioned envelope (`saveVersion: 1`). Forward-incompatible reads return `'incompatible'`; the StartScreen surfaces a banner and Start Over. |
| Resume vs. restart | When a valid save loads, StartScreen renders **Continue — Day N** (primary) and **Start over** (ghost). Day-zero / no-save state keeps the existing single-button flow byte-identical. |
| Hydration validation | Round-trip through the existing `ensure*` migrations from `src/sim/state/migrations.ts` + `safeValidateState` with the `FULL_PIPELINE`. Failure → `'invalid'` outcome → StartScreen with a banner. |
| Returning-player banner | "Welcome back — N hours / N days" pill in the TopBar, only when wall-clock gap since last save ≥ 4h. Self-dismisses on first beat advance or after 30s. |
| Yesterday digest | Beat-1-only block above the pressure ribbon. Two lines: coin delta + the larger-magnitude mover between top reputation delta and top rising pressure. Pure projection of the existing `DailyReportData`. Tap → navigates to Reports tab. |
| Quick Day trigger | `gameStore.todaysSeeds.length === 0` AND `beat === 'morning'`. |
| Quick Day behaviour | Calls `runDay({ responseIntents: [] })`, jumps to Beat 5. Submits any queued picks + sticky staff priorities. Label morphs to surface picks queued: `Quick Day` / `Quick Day · 1 action queued` / `Quick Day · N actions queued`. |
| Mid-day resume | Persisted: `beat`, `pendingBySeedId`, `serviceComplete`, `closingComplete`, `route`. `transitioning` is intentionally NOT persisted (replaying a half-finished service animation is a UX bug). |
| Glossary | 3 new terms: `autosave`, `quick_day`, `welcome_back`. |
| Iconography / portraits | Stays deferred. Existing stake icon set (loss / gain / risk) covers the digest direction routing. |

## Files

### New — Web persistence slice

- **`web/src/lib/sim/persistence.ts`** — pure save/load module.
  Exports `SAVE_STORAGE_KEY`, `SAVE_VERSION`, `loadSession`,
  `saveSession`, `clearSession`, `relativeTime`,
  `setStorageForTesting`, plus the `PersistedSession`, `LoadOutcome`,
  `LatestResultLite`, `Route`, and `StorageLike` types. localStorage is
  reached through a swappable `StorageLike` adapter so tests use an
  in-memory map without jsdom.
- **`web/src/lib/sim/daySession.ts`** — shared types (`Beat`,
  `PendingChoice`, `DaySessionSnapshot`, `INITIAL_DAY_SESSION`)
  extracted so `gameStore` and `persistence` can reference them
  without circling through `DayScreen.svelte`.

### Edit — Sim wiring (none)

Per the cards-contract read-only rule and the Phase 94 precedent,
this is a projection + web phase. No sim slice changes.

### Edit — gameStore

- **`web/src/lib/sim/gameStore.svelte.ts`** — added the session-state
  slots (`beat`, `pendingBySeedId`, `serviceComplete`,
  `closingComplete`, `route`, `lastSavedAt`, `savedSnapshotJustLoaded`,
  `hydrationError`); `hydrateFromSave` / `serializeForSave` methods;
  setters `setBeat`, `resolveSeed`, `setServiceComplete`,
  `setClosingComplete`, `setRoute`, `dismissWelcomeBack`. `runDay` now
  also resets the day-session flags. `reset` clears everything. The
  store still never touches localStorage.

### Edit — App boot

- **`web/src/App.svelte`** — `onMount` calls `loadSession()` and
  hydrates the store on `'loaded'`. A 300 ms-debounced `$effect`
  schedules saves; `visibilitychange === 'hidden'` and `pagehide`
  force a hard flush. `navigate(r)` writes `gameStore.route` so the
  active tab restores on next session.

### Edit — StartScreen

- **`web/src/lib/screens/StartScreen.svelte`** — accepts the new
  `existingSave`, `oncontinue`, and `banner` props. With a save:
  **Continue — Day N** + **Start over**; the advanced seed input is
  hidden (so Start Over resets to the default `crooked-keg` seed
  rather than carrying forward the previous world's flavour). No save:
  existing single-button flow.

### Edit — DayScreen

- **`web/src/lib/screens/DayScreen.svelte`** —
  - Beat, pending intents, and the two deck-complete flags now read
    from the store via `$derived`; mutations go through
    `gameStore.setBeat / resolveSeed / setServiceComplete /
    setClosingComplete`.
  - **Quick Day**: Beat 1 surfaces a second CTA next to "Plan the
    day" when `todaysSeeds.length === 0`; tap → `runDay` →
    `setBeat('report')`.
  - **Yesterday digest**: Beat-1-only block under the at-a-glance
    line, rendered when `latestResult` + `previousCalendar` exist.
    Tap → navigates to Reports.

### Edit — TopBar

- **`web/src/lib/components/TopBar.svelte`** — welcome-back pill
  below the day line; visible only when `savedSnapshotJustLoaded`
  + `relativeTime(lastSavedAt) !== undefined`. Tap dismisses.

### New — Yesterday digest

- **`src/reports/yesterdayDigest.ts`** —
  `projectYesterdayDigest(report)` returns `YesterdayDigestData` or
  `undefined`. Two lines max; ≤ 12 words each. Reputation wins
  magnitude ties (more interpretable for a new player).
- **`web/src/lib/components/YesterdayDigest.svelte`** — pure
  presentation. Single tappable button reusing the stake icon set
  (`stake-loss` / `stake-gain` / `stake-risk`).
- **`src/reports/index.ts`** — re-exports the projection and types.

### Edit — Glossary

- **`src/reports/glossary.ts`** — 3 new mechanic entries
  (`autosave`, `quick_day`, `welcome_back`).

### Tests

- **`tests/web/persistence.test.ts`** — 18 tests. Empty-slot,
  round-trip with hand-rolled state, round-trip with real engine
  output, picks / staff-priorities / pending-intents preservation,
  every failure mode (`incompatible`, malformed JSON, missing
  version, schema-invalid state, missing state), `clearSession`,
  `relativeTime` thresholds (4h / 23h / 24h / multi-day / 2+ weeks /
  negative / malformed).
- **`tests/reports/yesterdayDigest.test.ts`** — 16 tests. Empty
  paths, coin direction routing, secondary pick rules (reputation
  only / pressure only / reputation tie-break / pressure exceeds /
  falling rep beats small pressure rise), word budgets across all
  three line types, day-label shortening, non-mutation.
- **`tests/sim/phase96.persistenceRoundtrip.test.ts`** — 3 tests.
  State round-trip via the real engine; day-rollover parity
  (in-memory baseline vs. save-load-rollover); `seedsToday`
  preservation through the trip.

## Verification

| Check | Result |
|---|---|
| Unit/integration | `npm test -- --run` → **1474 passed (101 files)**. 37 new tests across `tests/web/persistence.test.ts`, `tests/reports/yesterdayDigest.test.ts`, `tests/sim/phase96.persistenceRoundtrip.test.ts`. |
| Types | `npm run typecheck` clean. |
| Svelte | `npm run check` → 0 errors / 0 warnings (651 files). |
| Build | `npm run build` → 1.075 MB / 286 kB gzipped (pre-existing chunk-size warning, unchanged). |

## Out of scope (deferred)

- Multiple save slots / cloud sync.
- Compression of the save blob (gzip / lz-string). Save fits well
  under typical localStorage quotas; defer until measurement says
  otherwise.
- IndexedDB migration. Defer to whichever phase first needs > 5MB.
- Push notifications (`§7.5` rules this out permanently).
- Missed-opportunity affordance (`§9.4` — slotted for Phase 97).
- Portraiture (`§7.6` — not Phase 96).
- A "More" / settings screen — Start Over remains the only reset
  path until a settings phase ships.
- Replay-from-save / branching. Not a current goal.

## Critical files referenced

- `docs/plans/game-loop-and-ux.md §2.3, §3.7, §7.4, §9.6` — UX
  primary sources.
- `docs/plans/cards-contract.md §1` — read-only contract; the save
  channel is presentation-state, not a new mutation surface.
- `docs/plans/phase-95-voice-and-identity.md` "Out of scope" — the
  three explicit Phase 96 deferrals.
- `src/sim/state/saveEnvelope.ts` — placeholder envelope shape that
  the web-side `PersistedSession` extends in spirit.
- `src/sim/state/migrations.ts` — all five `ensure*` helpers applied
  in order on hydration.
- `src/sim/state/validation.ts` — `safeValidateState` gatekeeps
  every load.
- `src/sim/core/result.ts` — `SimResult` shape that
  `LatestResultLite` trims to drop the duplicated state.
- `src/reports/dailyReportProjection.ts` — source for the
  yesterday-digest projection.
