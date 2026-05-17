# Phase 89 — Reports Layer & Full Daily Report

> Lands the real Beat 5 (Daily Report) in the day loop and lights up
> the top-level **Reports** tab (previously `ComingSoon`). Implements
> the deliverables deferred by Phase 88 per
> [`docs/plans/game-loop-and-ux.md §3.6, §6, §9.4`](./game-loop-and-ux.md)
> and the roadmap in §10. Picks up directly from PR #75 (Phase 88).

## Why

Phase 87 shipped the web chassis with a minimal end-of-day diff dialog
(top eight significant state changes, no drill-down, no causality
surface). Phase 88 made the day interactive but left Beat 5 unchanged
and left the Reports tab as a `ComingSoon` placeholder. The simulation
already explains itself — every mutation carries a `CauseEntry`,
pressures carry `topCauses`, memories carry actors and locations,
weekly/monthly report sections are produced on boundary days — but
none of that surfaced to the player.

Phase 89 makes the day legible. New code is a read-only consumer of
`SimResult` and `TavernState`; no sim code changes.

## Locked decisions

| Question | Decision |
|---|---|
| Where do report projection helpers live? | `src/reports/` — separate slice, mirrors `src/cards/`. Sim never imports reports; reports may freely import sim. |
| Daily report seam | Pure `buildDailyReport(result, state, options?)` returns `DailyReportData`. The Svelte component is presentation-only. |
| Beat 5 vs Reports tab | One `<DailyReport>` component used by both. Beat 5 wraps it with a "Next day / Close the week / Close the month" advance button; Reports → Today embeds it without advance. |
| Reports sub-navigation | Five tabs: **Today \| Pressures \| Weekly \| Monthly \| Log**. Phase 89 ships Today + Pressures live; Weekly/Monthly/Log render a one-line "available in phase N" note. The shell is the contract for Phases 90 / 91 / 94. |
| Cause drill-down | `BottomSheet` (existing primitive) → list of `CauseEntry`s filtered to the diff/pressure target on the just-closed day, sorted by `weight` desc. Used for any diff row and any pressure row. |
| Glossary / tooltip layer | Static `GLOSSARY_TERMS` dictionary + global `glossaryStore` + `<TermLabel>` inline chip + one `<Glossary>` BottomSheet mounted near the app root. Opened from a "?" affordance in the TopBar and inline taps on term chips. Covers 21 pressures, 10 reputation axes, 12 mechanics terms. |
| End-of-week / end-of-month | Daily report renders the engine's `weekly` / `monthly` `ReportSection` inline as collapsible `<details>` blocks. Button label flips to "Close the week" / "Close the month"; behaviour is unchanged advance-to-next-day (dedicated overview screens land in Phases 90 / 91). |
| Reputation / coin deltas source | Day-boundary diff (`result.diffs.find(d => d.boundary === 'day')`). No `reputation` or `economy` ReportSection is produced — verified. |
| Just-closed calendar | gameStore snapshots `state.calendar` BEFORE each `runDay` (the engine's final phase advances the calendar, so post-day state.calendar is tomorrow). The snapshot threads through to `buildDailyReport` as `options.previousCalendar`. |
| Past-day reports | Deferred to Phase 94 (Tavern Log). Reports → Today shows `latestResult` only. |

## Delivered

### Report layer (`src/reports/`, no DOM)

- `src/reports/types.ts` — view-model shapes: `DailyReportData`,
  `ReportDiffLine`, `ReportPressureLine`, `ReportHookLine`,
  `ReportResolvedIntent`, `ReportOwnerActionLine`, `ReportServiceLine`,
  `ReportDigest`, `ReportCalendarHeader`, `ReportReputationDelta`,
  `GlossaryTerm`, `GlossaryCategory`. Re-exports relevant sim types so
  callers pull report-adjacent shapes from one place.
- `src/reports/dailyReportProjection.ts` — `buildDailyReport(result,
  state, options?)`. Pure: same inputs → same output. Composes:
  - header (closed-day ordinal from `totalDaysElapsed`, full day label
    from `previousCalendar`, end-of-week / end-of-month flags)
  - coin before / after / delta from the diff
  - reputation deltas from `significantChanges.filter(p => p.startsWith('reputation.'))`,
    sorted by `Math.abs(delta)` desc
  - top diffs (8) sorted by `Math.abs(delta)`
  - owner actions applied from the `ownerActions` ReportSection's
    `data.applied[]`
  - resolved intents from `state.modules.responses.resolvedToday`,
    enriched with seed subjects where the seed is still on
    `seedsToday`
  - service lines from the `service` ReportSection's
    `data.result: DailyServiceResult` (traffic, incidents, drivers)
  - rising pressures (`delta > 0 && value >= 25`, sorted by
    `severity * delta`, cap 5)
  - future hooks (memories with `type === 'future_hook'` stamped on
    the just-closed `absoluteDay`)
  - `weeklyDigest` / `monthlyDigest` (engine-produced boundary
    sections, copied verbatim)
  - `isQuiet` flag when nothing meaningful happened
- `src/reports/causeLookup.ts` — `pathToCauseTarget(path)`,
  `causesForPath(state, path, opts?)`, `causesForPressure(state, id,
  opts?)`, `closedDayAbsolute(state)`. Translates diff paths like
  `reputation.tasty` / `pressures.food_safety.value` into the sim's
  cause `target` strings (`reputation:tasty`, `pressure:food_safety`).
- `src/reports/glossary.ts` — `GLOSSARY_TERMS` (43 entries: 21
  pressures, 10 reputation axes, 12 mechanics), `getTerm`,
  `termsByCategory`, `searchTerms`, `GLOSSARY_CATEGORY_LABELS`.
- `src/reports/index.ts` — flat public surface re-exports.

### Web components

- `web/src/lib/components/DailyReport.svelte` — the full report
  renderer. Sections in order: header line (coin shift + reputation
  strip) → weekly digest (boundary days only) → monthly digest
  (boundary days only) → significant changes (tap to drilldown) →
  what happened (owner actions, resolved intents, service lines) →
  what's building (rising pressures, tap to drilldown) → what might
  happen (future hooks). Empty sections gracefully omitted.
- `web/src/lib/components/CauseDrilldown.svelte` — `BottomSheet`
  showing the causes for a given diff path. Weight bars, direction
  marks, actor / location tags.
- `web/src/lib/components/PressureCard.svelte` — single pressure row
  with bar, value, trend. Accepts both projected lines and the
  compact on-state `PressureState`. Optional `onselect(id)` makes the
  whole row tappable.
- `web/src/lib/components/PressuresDashboard.svelte` — all 21
  pressures grouped by category (core / social / market / arc), each
  as a `PressureCard`. Reads `gameStore.state.pressures` directly.
- `web/src/lib/components/Glossary.svelte` — `BottomSheet` listing
  every term grouped by category with a search field. Scrolls to
  `anchorTerm` on open.
- `web/src/lib/components/TermLabel.svelte` — inline chip that opens
  the global Glossary anchored to a specific term. Falls back to
  plain text when the id is unknown.

### Web screen

- `web/src/lib/screens/ReportsScreen.svelte` — top-level Reports tab
  with sub-nav (Today / Pressures / Weekly / Monthly / Log). Today
  renders `DailyReport` for `gameStore.latestResult` (or an "open the
  tavern first" placeholder). Pressures renders `PressuresDashboard`.
  Weekly / Monthly / Log are stubs.

### Glossary state

- `web/src/lib/glossary/glossaryStore.svelte.ts` — tiny global store
  exposing `open` + `anchorTerm` so any `TermLabel` anywhere can pop
  the sheet without prop-drilling.

### Wiring

- `web/src/lib/screens/DayScreen.svelte` — Beat 5 block (lines
  326–352 in the prior file) replaced with `<DailyReport
  report={dailyReport} />`; the "Next day" button's label is derived
  from `dailyReport.header.isEndOfWeek` /
  `dailyReport.header.isEndOfMonth`. Unused report-block styles
  removed.
- `web/src/App.svelte` — Reports `ComingSoon` swapped for
  `<ReportsScreen />`. The `<Glossary>` sheet is mounted at the app
  root, bound to `glossaryStore`.
- `web/src/lib/components/TopBar.svelte` — adds a "?" button on the
  right (next to coin) that opens the glossary.
- `web/src/lib/sim/gameStore.svelte.ts` — adds `previousCalendar`
  field; snapshotted before each `runDay`. `reset()` clears it.

## Tests

`tests/reports/dailyReportProjection.test.ts` — 12 tests:

- view-model shape: every required field present.
- header reports the calendar number from BEFORE `advanceCalendar`
  ran (uses `previousCalendar`).
- `coinDelta` matches the day-boundary `coin` change.
- reputation deltas sorted by `Math.abs(delta)` desc; `before + delta
  === after`.
- top diffs sorted by `Math.abs(delta)`, capped at 8.
- rising pressures filtered to `delta > 0 && value >= 25`, sorted by
  `severity * delta`, capped at 5.
- future hooks returned are exactly the memories of type
  `future_hook` stamped on the just-closed `absoluteDay`.
- `weeklyDigest` undefined on day 1, present on day 7.
- `monthlyDigest` present on the day-28 close.
- owner actions: feeding `clean_area` on `main_room` shows up in the
  applied list.
- non-mutation: `JSON.stringify` of `state` and `result` is unchanged
  after `buildDailyReport`.

`tests/reports/causeLookup.test.ts` — 9 tests:

- `pathToCauseTarget` translates every common shape
  (`reputation.<axis>` → `reputation:<axis>`, `stock.<id>[.field]` →
  `stock:<id>`, `areas.<id>.<field>` → `area:<id>`,
  `pressures.<id>.<field>` → `pressure:<id>`), passes `coin` through,
  falls through unknowns.
- `causesForPath` returns only the closed-day causes, sorted by
  `weight` desc.
- `causesForPressure` keys off the pressure id and resolves to
  `pressure:<id>` targets.
- `closedDayAbsolute(state) === state.calendar.totalDaysElapsed - 1`.

## Verification

| Check | Result |
|---|---|
| `npm test` | 81 files / 1185 tests pass. 21 new tests under `tests/reports/`. |
| `npm run typecheck` | clean (root tsconfig stays DOM-free). |
| `npm run check` (svelte-check) | clean. |
| `npm run build` | builds successfully — `dist/assets/index-*.js` 861 KB / 229 KB gzipped (≈ +10 KB gzipped over Phase 88). |

## Critical files referenced

- `src/sim/core/result.ts:15` — `SimResult`.
- `src/sim/core/diff.ts` — `StateChange` / `TaggedStateDiff` /
  `DEFAULT_THRESHOLDS`. Calendar field changes are filtered out of the
  day-boundary diff, which is why `previousCalendar` is necessary.
- `src/sim/state/TavernState.ts:403, :301, :425` — `CauseEntry`,
  `MemoryState`, `PressureState`.
- `src/sim/modules/calendar/index.ts:148, :152` — `isEndOfWeek` /
  `isEndOfMonth` semantics that the report's header mirrors.
- `src/sim/modules/pressures/pressureReport.ts:142-175` — pressures
  ReportSection `data` (snapshots + categories).
- `src/sim/modules/responses/types.ts:72, :82` —
  `ResolvedIntentRecord`, `ResponsesModuleState.resolvedToday`.
- `src/sim/modules/ownerActions/ownerActionsModule.ts:262-294` —
  ownerActions ReportSection `data` (applied / rejected / projects /
  policies).
- `src/sim/modules/service/serviceModule.ts:511-520` — service
  ReportSection `data` (`result: DailyServiceResult`, `drivers`).
- `src/sim/modules/weekly/report.ts:249`,
  `src/sim/modules/monthly/report.ts:145` — boundary digest sections.
- `src/sim/modules/pressures/pressureTypes.ts:18, :40, :60` —
  canonical pressure id lists + category mapping used by
  PressuresDashboard.
- `src/sim/modules/pressures/pressureRegistry.ts` — pressure labels
  the glossary mirrors.
- `src/sim/state/defaults.ts:235` — `ReputationState` axes the
  glossary covers.
- `docs/plans/cards-contract.md §3.6, §3.10` — pressure / cause data
  and descriptor pool references.
- `docs/plans/game-loop-and-ux.md §3.6, §6, §9.4` — Beat 5 spec,
  Reports tab layout, tooltip-layer brief.

## Out of scope (deferred)

- **Phase 90** — Weekly overview screen with sparklines / wages /
  supplier invoices / per-group trends. The engine's `weekly`
  section is surfaced inline in the daily report today; the
  dedicated screen comes next.
- **Phase 91** — Monthly overview, 9-axis reputation bar chart,
  landlord / inspection blocks, active arcs. Inline `monthly`
  section bridges the gap.
- **Phase 92** — Tavern / Stock / Recipes / Staff / Projects &
  Policies screens.
- **Phase 93** — World / Regulars / Suppliers / Factions / Cultures
  / NPCs / Rumours screens.
- **Phase 94** — Tavern Log (filterable `state.history` timeline).
  Reports tab → Log is the placeholder for it.
- Past-day report navigation via the log — depends on Phase 94.
- "You could have done X" missed-opportunity hints — needs a
  deliberate sim-side calculator.
- First-encounter tooltip auto-popup — game-loop §9.4 floats it; the
  manual-lookup glossary covers the same ground without auto-popping.
- Voice / style pass on report prose — Phase 95+.
- Browser-storage save / load.

## Risks & notes

1. **`previousCalendar` snapshot lives on the gameStore.** The
   alternative — inverse-walking `advanceCalendar` — is fiddly and
   would couple the report to calendar internals (DAYS_PER_WEEK,
   month boundaries). The snapshot is one shallow clone per day.
2. **The day-boundary diff filters out calendar fields.** Verified by
   probe: `dayDiff.changes` contains zero calendar entries. The
   header derives "Day N closed" from `totalDaysElapsed` for the
   ordinal and from `previousCalendar` for week / month / dayType.
3. **`isQuiet` is purely informational.** When true, the daily report
   shows the header and a `"a quiet day. nothing crossed a
   threshold."` line so the player always sees an end-of-day surface.
4. **Glossary anchoring uses DOM `scrollIntoView`.** Gated by a
   `queueMicrotask` so the BottomSheet has mounted before the
   element lookup runs.
5. **Bundle size up ~10 KB gzipped.** Static glossary data + the
   report projection + four new components. Below the warning bar.
   Code-splitting becomes worthwhile once Phases 90 / 91 add real
   weekly / monthly screens.
