# Phase 5 — Reports, projections, and explanatory surfaces

Status: **completed** on 2026-06-03.

This phase audited the path from simulation results and persisted state into the
report projections, composed report prose, and the Svelte surfaces that explain
what happened. It is an audit artifact, not a repair patch.

## Scope inspected

Primary surfaces inspected:

- `src/reports/index.ts`
- `src/reports/dailyReportProjection.ts`
- `src/reports/yesterdayDigest.ts`
- `src/reports/weeklyOverviewProjection.ts`
- `src/reports/monthlyOverviewProjection.ts`
- `src/reports/tavernOverviewProjection.ts`
- `src/reports/worldOverviewProjection.ts`
- `src/reports/tavernLogProjection.ts`
- `src/reports/missedOpportunityProjection.ts`
- `src/reports/causeLookup.ts`
- `src/reports/entityLabels.ts`
- `src/reports/labels/*`
- `src/reports/compose/sections/*`
- `src/reports/compose/pools/*`
- `web/src/lib/components/DailyReport.svelte`
- `web/src/lib/components/YesterdayDigest.svelte`
- `web/src/lib/components/TavernLog.svelte`
- `web/src/lib/components/WeeklyOverview.svelte`
- `web/src/lib/components/MonthlyOverview.svelte`
- `web/src/lib/components/PressureCard.svelte`
- `web/src/lib/components/PressuresDashboard.svelte`
- `web/src/lib/components/CauseDrilldown.svelte`
- `web/src/lib/screens/DayScreen.svelte`
- `web/src/lib/screens/ReportsScreen.svelte`
- `tests/reports/**`
- `tests/web/debugBundle.test.ts`
- Adjacent web report-action wiring tests, especially
  `tests/web/phase195.reportsActions.test.ts` and
  `tests/web/phase190a.interconnection.test.ts`.

Commands run during the audit:

```bash
find src/reports web/src/lib/components tests/reports -maxdepth 4 -type f | sort
rg -n "build.*Projection|projection|digest|overview|cause|pressure|label" src/reports web/src/lib/components tests/reports
rg -n "^export function|^function|const .*CAP|return \\{" src/reports/dailyReportProjection.ts src/reports/tavernLogProjection.ts src/reports/tavernOverviewProjection.ts src/reports/weeklyOverviewProjection.ts src/reports/monthlyOverviewProjection.ts src/reports/worldOverviewProjection.ts src/reports/missedOpportunityProjection.ts src/reports/entityLabels.ts src/reports/labels/*.ts
rg -n "buildDailyReport|buildWeeklyOverview|buildMonthlyOverview|buildTavernOverview|buildWorldOverview|buildTavernLog|buildYesterdayDigest|DailyReport|YesterdayDigest|TavernLog|CauseDrilldown" web/src src tests/web tests/reports
rg -n "isQuiet|quietLine|weeklyDigest|monthlyDigest|quiet" tests/reports src/reports web/src/lib/components/DailyReport.svelte
rg -n "recordCause|CauseEntry|target:|target =|target \\+" src/sim src/reports tests
rg -n "reputation[:.]|customer[:.]|customers\\.|customerGroups\\.|faction[:.]|culture[:.]|supplier[:.]|stock[:.]|area[:.]|areas\\." src/sim src/cards
npm test -- tests/reports tests/web/debugBundle.test.ts
```

## Report source map

| Surface | Producer/source of truth | Projection | Web consumer | Audit result |
|---|---|---|---|---|
| Daily report header | `SimResult`, post-day `TavernState`, optional `previousCalendar` snapshot | `buildDailyReport` calls `buildHeader` and composes header voice from the closed calendar day. | `DailyReport.svelte`, `DayScreen.svelte`, `ReportsScreen.svelte` | Correctly prefers `previousCalendar` in web callers; fallback is documented as losing week/month-boundary accuracy. |
| Coin and reputation summary | Day-boundary `StateChange` entries in `SimResult.diffs` | `coinBeforeAfter` reads the raw `coin` change; `projectReputationDeltas` reads `reputation.*` significant changes. | Daily report header strip and yesterday digest | Faithful to diff data; no independent web recomputation found. |
| Significant-change sections | Day-boundary `significantChanges` | `projectGroupedDiffs` classifies into coin/reputation, stock, pressures, areas, and `other`, with per-group and overall caps. | Daily report diff sections and cause drilldown buttons | Total classifier avoids silent category drops, but explanatory drilldowns for several non-pressure paths are suspect; see `AUD-REP-001`. |
| Owner actions | `ownerActions` report section data (`applied`) | `projectOwnerActions` preserves action labels/effects and resolves structured target labels from registries/state. | Daily report day arc | Faithful; fallback labels are readable but may mask missing references only where the action target no longer exists. |
| Service lines | `service` report section data (`DailyServiceResult`, drivers) | `projectServiceLines` emits traffic, coin, incidents, and service drivers, capped at six. | Daily report day arc | Faithful to service report data; cap is intentional but could hide lower-priority incidents on very busy days. No defect confirmed. |
| Resolved card responses | `state.modules.responses.resolvedToday` plus still-present `issueSeeds.seedsToday` | `projectResolvedIntents` maps response records to seed subjects and structured entity refs where available. | Daily report day arc and entity links | Good structured-link seam; fallback to seed id is visible and debuggable when seed context is missing. |
| Rising pressures | `pressures` report section snapshots | `projectRisingPressures` filters to rising pressures with value at least 25 and sorts by `severity * delta`. | Daily report `What's building`, pressure drilldowns | Faithful to pressure snapshots; intentionally salience-filtered rather than exhaustive. |
| Future hooks | `state.memories` filtered to `future_hook` on the closed day | `projectFutureHooks` caps to five and forwards actor/location refs. | Daily report `What might happen` | Faithful to state; only same-day hooks are shown. |
| Weekly/monthly inline digests | `SimResult.reports` sections with ids `weekly`/`monthly` | `projectDigest` forwards title and lines. | Collapsible daily report digest blocks | Presence tests exist; quiet-day interaction is not directly covered; see `AUD-REP-002`. |
| Yesterday digest | Already-projected `DailyReportData` | `projectYesterdayDigest` builds a compact morning card from coin, top rep delta, and top rising pressure. | `YesterdayDigest.svelte` on morning beat | Correctly avoids inventing new sim facts; intentionally omits digest when the daily report is fully quiet. |
| Weekly overview | Persistent weekly module state (`lastWeeklyResult`, `weeklyHistory`) plus current state for current coin/invoices | `buildWeeklyOverview` | `WeeklyOverview.svelte` | Reads persistent weekly result rather than re-running reports; current-state joins are visible in the projection. |
| Monthly overview | Persistent monthly module state (`lastMonthlyResult`, `monthlyHistory`) plus current state for pressures/arcs/customers | `buildMonthlyOverview` | `MonthlyOverview.svelte` | Reads persistent monthly result; active pressures and arcs are deliberately current-state summaries, not month-close snapshots. |
| Tavern/world overview | Current `TavernState` slices and registries | `buildTavernOverview`, `buildWorldOverview` | Tavern/world panels | Projection layer owns labels, action refs, and row sorting; no direct web recomputation found in inspected consumers. |
| Tavern log | `state.history` | `buildTavernLog` with filters/facets/grouping | `TavernLog.svelte` | Pure filtered projection; facets are computed against unfiltered history so chip counts stay stable. |
| Cause drilldown | `state.causes` and diff/pressure path strings | `causesForPath`, `pathToCauseTarget`, `causesForPressure` | `DailyReport.svelte`, `CauseDrilldown.svelte`, metric links | The path-to-target convention has drifted from engine-emitted per-field causes; see `AUD-REP-001`. |

## Findings

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-REP-001 | confirmed | high | Cause drilldowns / missed-opportunity explanations | Report-layer cause lookup maps many diff paths to legacy colon/id targets, while the engine now emits per-field diff-path cause targets, so daily-report drilldowns and missed-opportunity counterfactuals can show no explanation for explained changes. | `causeLookup.pathToCauseTarget` maps `areas.main_room.cleanliness` → `area:main_room`, `stock.ale.quantity` → `stock:ale`, `staff.<id>.<field>` → `staff:<id>`, and `reputation.tasty` → `reputation:tasty`. The engine comments and `modifyArea` / `modifyStock` / `modifyStaff` helpers emit targets like `areas.<id>.<field>`, `stock.<id>.<field>`, and `staff.<id>.<field>`; `modifyReputation` emits `reputation.<axis>`. `missedOpportunityProjection` also filters causes with `c.target === pathToCauseTarget(change.path)`, so the same drift affects counterfactual hints. | `tests/reports/causeLookup.test.ts` currently asserts the legacy mappings and only accepts empty cause lists as valid for live runs. It does not plant a field-level cause and require `causesForPath('areas.<id>.<field>')` or `causesForPath('reputation.<axis>')` to find it. | Repair `pathToCauseTarget` or make lookup tolerate both current diff-path targets and legacy colon/id targets. Add tests with planted field-level causes for area, stock, staff, and reputation paths, plus a missed-opportunity counterfactual test that fails when the cause lookup misses a negative significant diff. |
| AUD-REP-002 | candidate | low | Daily report empty-state prose | `isQuiet` ignores weekly/monthly digest presence, so an end-of-week or end-of-month report with no daily movement can still render the quiet-day block after a meaningful digest. | `buildDailyReport` computes `weeklyDigest` and `monthlyDigest`, but `isQuiet` only checks top diffs, owner actions, resolved intents, service lines, rising pressures, future hooks, missed opportunities, coin, and reputation deltas. `DailyReport.svelte` renders weekly/monthly digest blocks and then separately renders the quiet block when `report.isQuiet` is true. | Tests assert digest presence on day 7/day 28 and assert only that `quietLine` follows `isQuiet`; no test covers a digest-present report with otherwise quiet daily activity. | Decide whether weekly/monthly digest presence should suppress quiet prose or whether the current combination is intended. If suppressing, add a projection test using a minimal `SimResult` with a weekly/monthly report section and no daily activity. |

## Non-findings and resolved risk areas

- Daily-report web callers pass `previousCalendar` from the store when available,
  which preserves closed-day week/month labels despite the engine advancing the
  calendar before the projection renders.
- `projectGroupedDiffs` has a total catch-all bucket. Significant changes that
  do not match coin/reputation, stock, pressure, or area prefixes land in
  `other` instead of disappearing.
- Yesterday digest is a true projection over `DailyReportData`; it does not read
  state again or invent independent deltas.
- Report projection failures are wrapped in `safeProject` in the inspected day and
  reports screens, so projection throws render inline error panels rather than
  unmounting the app.
- Tavern log filtering keeps facet counts stable by computing counts from
  unfiltered history, then applying filters to rows/groups.
- Label fallbacks are mostly intentionally debuggable: `resolveEntityLabel`
  returns raw ids on missing refs instead of the word "unknown", and generic
  `idLabel` fallbacks humanize ids. This can still mask a missing registry entry
  in prose, but no concrete missing production reference was confirmed in this
  phase.

## Suggested follow-up probes

1. Add a report-layer cause-target parity test that constructs a state with
   causes whose targets match the engine's current diff paths (`areas.*.*`,
   `stock.*.*`, `staff.*.*`, `reputation.*`) and asserts `causesForPath` returns
   them for the corresponding diff paths.
2. Add a missed-opportunity projection test for a negative area/stock/staff diff
   where the planted cause carries remedy tags; the hint should disappear if and
   only if the cause is absent or the matching owner action was already applied.
3. Add a minimal digest/quiet interaction test for `buildDailyReport` to lock the
   desired behavior when weekly/monthly digest data is present but daily activity
   is otherwise quiet.
4. Consider a one-time inventory that compares all `CauseEntry.target` string
   conventions emitted by sim modules to the report-layer `pathToCauseTarget`
   mapping and the sim-side `causeReport` target mapping. The inspected files
   show at least three conventions still coexisting: diff paths, colon ids, and
   colon id plus field suffix.
5. If label masking becomes a recurring issue, add a development-only projection
   audit that records when `idLabel`/`resolveEntityLabel` returned a fallback for
   a state ref that should have had a registry or state entry.

## Verification

The focused Phase 5 test command passed:

```text
Test Files  35 passed (35)
Tests       391 passed (391)
```

Command:

```bash
npm test -- tests/reports tests/web/debugBundle.test.ts
```
