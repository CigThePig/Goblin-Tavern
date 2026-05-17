# Phase 90 — Weekly Overview Screen + Persistent Weekly History

> Lands the dedicated **Reports → Weekly** screen deferred by Phase 89,
> and fixes the sim-side limitation that would otherwise have forced a
> web-layer bandaid: `state.modules.weekly.lastWeeklyResult` was wiped on
> day 1 of the next week, leaving the screen empty for 6 of every 7
> days. Phase 90 makes weekly results part of durable simulation state —
> a persistent latest pointer plus a bounded `weeklyHistory[]` buffer —
> so the screen reads truth instead of a UI cache. Picks up directly
> from PR #76 (Phase 89). Implements the deliverable described in
> [`docs/plans/game-loop-and-ux.md §4.1, §6, §10`](../docs/plans/game-loop-and-ux.md).

## Context — why this change

Phase 89 wired the **Today** and **Pressures** sub-tabs and stubbed
Weekly / Monthly / Log as "available in phase N" placeholders. The
engine already produces a rich `WeeklyResult` (`src/sim/modules/weekly/types.ts:147`)
on the last day of each calendar week — economy totals, wage
resolution, per-staff and per-customer trends, maintenance backlog,
signal deltas, community block. Nothing reads it in the UI yet.

Two limitations would otherwise compromise the screen:

1. **`lastWeeklyResult` lifetime is one calendar day.** Verified at
   `src/sim/modules/weekly/weeklyModule.ts:107` (`freshAccumulator`)
   and `:278–295` (`startDayHook`): on day 1 of the next week (or
   whenever `weekFinalized === true`), the slice is replaced with a
   fresh accumulator that does *not* carry `lastWeeklyResult` over.
   The current `buildWeeklyReport` (`:517–523`) explicitly relies on
   this wipe to stay one-shot. Result: a player can only read the
   weekly result on the close day itself.
2. **No multi-week history exists on state.** Future "vs previous
   week" comparison features, Phase 94 Tavern Log, and any
   week-over-week analytics have nothing to read.

A web-only cache on `gameStore` would patch (1) but leaves the sim
holding a structural bug ("data we report exists for one day, then
vanishes") and does nothing for (2). The fix belongs in the sim. The
schema change is small, the migration is trivial, and the UI gains
real week-over-week comparison instead of a single-week snapshot.

## Locked decisions

| Question | Decision |
|---|---|
| Persistent latest pointer | Keep `lastWeeklyResult?: WeeklyResult` on `WeeklyModuleState`. Stop wiping it in `freshAccumulator` / `startDayHook`. After endWeek runs on day 7, the pointer survives through days 1–6 of the next week and is replaced when *that* week's endWeek runs. |
| Multi-week history | Add `weeklyHistory: WeeklyResult[]` to `WeeklyModuleState`. Append the finalised result at `endWeek`. Bounded buffer: keep the most recent **12 weeks** (≈ 3 months). Older entries fall off the front. This is bounded enough that save size stays predictable but covers the player horizons the UX cares about. |
| Weekly report emission cadence | The existing comment at `weeklyModule.ts:520–521` says the report stays one-shot because the slice is wiped on the next day. With persistence, that's no longer true. Replace the implicit guard with an explicit one in `buildWeeklyReport`: only emit when `lastWeeklyResult.endDay === state.calendar.totalDaysElapsed` (i.e. today is the close day, before `advanceCalendar` runs). This keeps the daily report's inline weekly block one-shot, preserving Phase 89's behavior. |
| Schema validation | Add `weeklyHistory: z.array(WeeklyResultSchema)` to `WeeklyModuleStateSchema` (`weeklyModule.ts:705`). Keep `lastWeeklyResult` optional as it is now (week 1 days 1–6 have neither). |
| Migration | Add `ensureWeeklyHistoryField(state)` to `src/sim/state/migrations.ts`, mirroring the existing `ensureWorldBranch` / `ensureAreaIdentityFields` / `ensureStaffIdentityFields` shape. Initializes `weeklyHistory: []` when missing. Preserves any existing `lastWeeklyResult`. Idempotent. |
| Where the projection lives | `src/reports/weeklyOverviewProjection.ts`. Mirrors the Phase 89 pattern: pure `buildWeeklyOverview(state)` returns a `WeeklyOverviewData` view-model; the Svelte component is presentation-only. Sim never imports reports. |
| Web-layer cache | **None.** With sim-side persistence, the projection reads `state.modules.weekly.lastWeeklyResult` directly. `gameStore` is unchanged. |
| Wages / invoices interactivity | **Read-only.** Both are auto-resolved by the existing weekly pipeline (wages by `endWeek`, supplier invoices stay empty because the project ships Option A per `types.ts:71–74`). Adding Pay/Defer/Skip requires reworking the weekly module to gate payment on player intents — that's a separate phase with its own sim changes. Phase 90 displays the resolution outcome, not a decision point. |
| End-of-week cards | Not duplicated here. `end_week` timing seeds surface in `DayScreen` Beat 5 on end-of-week days; this screen is for reading the past, not active play. |
| Empty state | When `state.modules.weekly.lastWeeklyResult` is undefined (player is in week 1 before day 7), render: "Your first weekly summary appears after day 7." |
| Stale-week notice | When `daysSinceClose > 0`, the header notes "(closed N days ago)". Purely informational. |
| Week-over-week comparison | When `weeklyHistory.length >= 2`, the screen renders a small "vs previous week" delta strip for headline metrics: net coin, sales, wages, average customer satisfaction, signal deltas. The first surfaced week (Y1-M1-W1) has no comparison; the strip is hidden. |
| Sparklines / multi-week charts | **Deferred.** 12 weeks is enough data for them eventually, but adding chart primitives is a separate UI investment. Week-over-week deltas (textual + colored arrows) cover the immediate UX need; sparklines become a polish phase. |
| Glossary integration | Use `<TermLabel>` for technical terms (`patronage`, `loyalty`, `morale`, `stress`, `fatigue`, `wages`, `signals`, `maintenance_backlog`). Add any missing entries to `src/reports/glossary.ts`. |
| Tone / icon system | Same pure-typographic baseline as Phase 89 — no emoji headers. Section labels in Cinzel small-caps; data in IBM Plex Mono; body in EB Garamond. Trend marks reuse the `↗ → ↙` glyphs from `PressureCard.svelte`. |

## Files to change

### Sim side

#### `src/sim/modules/weekly/types.ts` (edit)

Extend `WeeklyModuleState`:

```ts
export type WeeklyModuleState = {
  // ... existing fields unchanged ...

  /** Last finalized weekly result. Set on endWeek; persists across the next week until the next endWeek replaces it. */
  lastWeeklyResult?: WeeklyResult

  /**
   * Bounded buffer of recent finalized weekly results, oldest first.
   * Append-on-finalize; truncate from the front when length exceeds
   * MAX_WEEKLY_HISTORY (12 weeks ≈ 3 months).
   */
  weeklyHistory: WeeklyResult[]

  // ... rest unchanged ...
}
```

Update the doc comment on `lastWeeklyResult` to reflect the new lifetime.

#### `src/sim/modules/weekly/state.ts` (edit)

Add the history bound constant and initialise the new field:

```ts
export const MAX_WEEKLY_HISTORY = 12

export function createInitialWeeklyModuleState(): WeeklyModuleState {
  return {
    // ... existing fields ...
    weeklyHistory: [],
    // ... rest ...
  }
}
```

#### `src/sim/modules/weekly/weeklyModule.ts` (edit)

1. **`freshAccumulator`** (line 107) — preserve `lastWeeklyResult` and `weeklyHistory` across the reset:

   ```ts
   function freshAccumulator(state: TavernState): WeeklyModuleState {
     const previous = getWeeklyModuleState(state)
     const { satisfaction, patronage } = snapshotCustomerStarting(state)
     return {
       weekKey: formatWeekKey(state),
       weekNumber: state.calendar.week,
       monthNumber: state.calendar.month,
       yearNumber: state.calendar.year,
       startedOnDay: state.calendar.day,
       startingSatisfaction: satisfaction,
       startingPatronage: patronage,
       trafficByGroup: {},
       satisfactionSumByGroup: {},
       satisfactionSamplesByGroup: {},
       shortageCountByGroup: {},
       shortageCountByStock: {},
       dayTypeCounts: {},
       economy: emptyEconomyTotals(),
       salesByStockId: {},
       signals: emptySignalTotals(),
       signalNotes: [],
       supplierInvoices: [],
       weekFinalized: false,
       // Preserve persistent fields across the accumulator reset.
       lastWeeklyResult: previous.lastWeeklyResult,
       weeklyHistory: [...previous.weeklyHistory],
       // Phase 34 community accumulators.
       regularVisitsById: {},
       regularSceneCounts: {},
       groupSceneCounts: {},
       sceneTypeCounts: {},
     }
   }
   ```

2. **`endWeekHook`** (around line 505) — append to history on finalisation:

   ```ts
   const nextHistory = [...sliceAfterWages.weeklyHistory, result]
   const trimmedHistory =
     nextHistory.length > MAX_WEEKLY_HISTORY
       ? nextHistory.slice(nextHistory.length - MAX_WEEKLY_HISTORY)
       : nextHistory

   replaceSlice(
     ctx,
     {
       ...sliceAfterWages,
       lastWeeklyResult: result,
       weeklyHistory: trimmedHistory,
       weekFinalized: true,
       supplierInvoices,
     },
     'finalize_week',
   )
   ```

3. **`buildWeeklyReport`** (line 517) — replace the implicit one-shot guard with an explicit calendar-day match, so the daily report's inline weekly block still emits exactly once:

   ```ts
   function buildWeeklyReport(ctx: SimContext): ReportSection | null {
     const slice = getWeeklyModuleState(ctx.state)
     if (!slice.lastWeeklyResult) return null
     // generateReports runs before advanceCalendar; on the close day,
     // totalDaysElapsed still matches the result's endDay. The next day,
     // totalDaysElapsed has incremented and we skip emission.
     if (slice.lastWeeklyResult.endDay !== ctx.state.calendar.totalDaysElapsed) return null
     return buildWeeklyReportSection(slice.lastWeeklyResult)
   }
   ```

4. **`WeeklyModuleStateSchema`** (line 705) — add `weeklyHistory: z.array(WeeklyResultSchema)`.

5. Re-export `MAX_WEEKLY_HISTORY` from the module's existing index/state surface as needed.

#### `src/sim/state/migrations.ts` (edit)

Add an idempotent migration helper following the existing pattern:

```ts
import { getWeeklyModuleState } from '../modules/weekly/state'
import { WEEKLY_MODULE_ID } from '../modules/weekly/state'
import type { WeeklyModuleState } from '../modules/weekly/types'

/**
 * Phase 90 §"Persistence" — pre-Phase-90 saves do not carry the
 * `weeklyHistory` array on the weekly module slice. This helper attaches
 * an empty array when missing; preserves `lastWeeklyResult` exactly as
 * stored. Idempotent. Callers wiring this into the save envelope path
 * should run it before `validateState`, mirroring the other ensure helpers.
 */
export function ensureWeeklyHistoryField<T extends { modules?: Record<string, unknown> }>(
  state: T,
): T {
  if (!state.modules) return state
  const slice = state.modules[WEEKLY_MODULE_ID] as
    | (WeeklyModuleState & { weeklyHistory?: WeeklyResult[] })
    | undefined
  if (!slice) return state
  if (Array.isArray(slice.weeklyHistory)) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      [WEEKLY_MODULE_ID]: { ...slice, weeklyHistory: [] },
    },
  }
}
```

Wire into the save-envelope load path wherever the other `ensure*` helpers are already chained (check `src/sim/state/saveEnvelope.ts` for the existing chain; this slot is **read-only** for the planner — implementer should locate and extend that chain).

#### `src/sim/state/defaults.ts` (verify only)

`createInitialTavernState()` calls into module initial-state helpers. Since `createInitialWeeklyModuleState()` now returns `weeklyHistory: []`, fresh saves are correct without further changes. Confirm no other call site bypasses the helper.

### Reports side

#### `src/reports/weeklyOverviewProjection.ts` (new)

Pure projection. No DOM, no `Math.random`, no wall-clock reads.

```ts
import { getWeeklyModuleState } from '../sim/modules/weekly/state'
import type { TavernState } from '../sim/state/TavernState'
import type { WeeklyResult } from '../sim/modules/weekly/types'

export type WeeklyOverviewData = {
  hasResult: boolean
  /** Present when hasResult === false. */
  empty?: { reason: 'no_week_yet'; message: string }

  header?: {
    weekKey: string
    weekNumber: number
    monthNumber: number
    yearNumber: number
    endDay: number
    daysSinceClose: number
  }

  economy?: {
    sales: number
    purchases: number
    wages: number
    rent: number
    repairs: number
    waste: number
    other: number
    net: number
    topRevenueSource?: { id: string; label: string; amount: number }
    largestCost?: string
  }

  wages?: {
    totalDue: number
    paidAmount: number
    paid: boolean
    unpaidStaff: { id: string; name: string; roleLabel: string }[]
  }

  signals?: {
    cheap: number
    filthy: number
    dangerous: number
    tasty: number
    reliable: number
    notes: string[]
  }

  customerGroups?: {
    rows: CustomerGroupRow[]
    bestGroupId?: string
    worstGroupId?: string
  }

  staff?: { rows: StaffRow[] }
  maintenance?: { rows: MaintenanceRow[] }
  supplierInvoices?: {
    paidCount: number
    unpaidCount: number
    totalUnpaid: number
    rows: InvoiceRow[]
  }
  community?: {
    suppliersTouched: number
    regularsTouched: number
    factionShifts: number
    rumoursActive: number
    notes: string[]
  }

  /** Present when at least one prior week exists in weeklyHistory and is distinct from the current one. */
  comparison?: WeeklyComparison
}

export type CustomerGroupRow = {
  id: string
  label: string
  patronageDelta: number
  loyaltyDelta: number
  averageSatisfaction: number
  totalTraffic: number
  shortageCount: number
  isBest: boolean
  isWorst: boolean
  notes: string[]
}

export type StaffRow = {
  id: string
  name: string
  roleLabel: string
  moraleDelta: number
  stressDelta: number
  fatigueDelta: number
  loyaltyDelta: number
  notes: string[]
}

export type MaintenanceRow = {
  areaId: string
  areaLabel: string
  /** Severity on the 0–10 scale used in MaintenanceBacklogEntry. */
  severity: number
  reasons: string[]
}

export type InvoiceRow = {
  id: string
  supplierLabel: string
  amount: number
  dueWeek: number
  paid: boolean
  relatedStock: string[]
}

export type WeeklyComparison = {
  previousWeekKey: string
  netDelta: number
  salesDelta: number
  wagesDelta: number
  signalsDelta: { cheap: number; filthy: number; dangerous: number; tasty: number; reliable: number }
  averageSatisfactionDelta: number
}

export function buildWeeklyOverview(state: TavernState): WeeklyOverviewData
```

Resolution rules (apply in the projection, not the component):
- Source week: `getWeeklyModuleState(state).lastWeeklyResult`.
- Previous week for comparison: `weeklyHistory[weeklyHistory.length - 2]` when it exists and `weekKey !== lastWeeklyResult.weekKey`. (`weeklyHistory` includes the current finalised week as its last entry once endWeek has run.)
- Staff name: `state.staff[id].name.display` — required (`TavernState.ts:163`). Role label: pass through the raw role id; the component is free to do further lookup if needed.
- Customer group label: `state.customerGroups[id]?.label ?? id`.
- Area label: `state.areas[id]?.label ?? id`.
- Supplier label: `state.world.suppliers[id]?.name?.display ?? state.world.suppliers[id]?.label ?? id`. Supplier `name` is optional (`TavernState.ts:464`) — always guard.
- Stock label for `topRevenueSource`: `state.stock[id]?.label ?? id`. Amount from `slice.salesByStockId[id]` … note: by the time the projection runs, the slice's accumulators have already been replaced for the new week. The amount is not directly recoverable from state for past weeks. Acceptable: omit amount when not derivable; show label only. **Simpler**: drop the `amount` field from `topRevenueSource` and just surface the label.
- Drop the community sub-object entirely when all four counts are 0.
- Always fall back to the raw id when an entity is missing from state.
- `daysSinceClose = state.calendar.totalDaysElapsed - lastWeeklyResult.endDay`.

(Update the `economy.topRevenueSource` type to omit `amount` per the note above.)

#### `src/reports/index.ts` (edit)

Add `export * from './weeklyOverviewProjection'`.

#### `src/reports/glossary.ts` (edit, additive only)

Add entries for weekly-specific terms missing from the existing dictionary: `patronage`, `loyalty`, `morale`, `stress`, `fatigue`, `wages`, `weekly_signals` (or split into `signal_cheap`, etc.), `maintenance_backlog`, `supplier_invoice`, `weekly_net`. Check the existing file before adding; don't duplicate.

### Web side

#### `web/src/lib/components/WeeklyOverview.svelte` (new)

Renders a `WeeklyOverviewData`. Single scrollable column. Sections in order, each gracefully omitted when its slice is undefined:

1. **Header** — week / month / year, "Closed day N", and "(N days ago)" when `daysSinceClose > 0`.
2. **Week-over-week strip** — when `comparison` is present. A horizontal row of 5–6 small stat tiles: net, sales, wages, avg satisfaction, signals shift. Each tile shows the headline number for the current week with a delta vs previous in parentheses, color-tinted by direction.
3. **Economy** — coin table: each row `label · amount`, gain (moss) for positive, loss (blood) for negative; sticky **Net** row in accent. Callout chips below: "Top revenue: <label>" and "Largest cost: <label>" when present.
4. **Signals** — five inline pills (cheap / filthy / dangerous / tasty / reliable) with delta values; tinted by sign. Notes as a bullet list.
5. **Customer groups** — one row per `CustomerGroupRow`: group label (with marker if best/worst) · loyalty Δ · patronage Δ · satisfaction average · traffic count · shortage badge when > 0.
6. **Staff** — one row per `StaffRow`: name + role · morale Δ · stress Δ · fatigue Δ · loyalty Δ. Notes collapse-expand via inline `<details>`.
7. **Maintenance** — one row per `MaintenanceRow`: area label · thin tint bar (width = severity × 10, color = `pressureColor(severity * 10)`; severity is 0–10 per `MaintenanceBacklogEntry`). Reasons as comma-separated text.
8. **Wages** — header "Wages: paid X / due Y". Unpaid list (name + role) appears when non-empty, tinted as loss.
9. **Supplier invoices** — paid/unpaid counts at top; unpaid list first (blood-tinted), then paid (dim). Each row: supplier · amount · due week · related stock chips. (Currently always empty per Option A; the list renders correctly when populated.)
10. **Community** — collapsed `<details>`: title line "Community: X suppliers · Y regulars · Z factions · N rumours"; expand to show `notes[]`.

Props:

```ts
interface Props { data: WeeklyOverviewData }
let { data }: Props = $props()
```

Styling notes:
- Only existing CSS vars from `web/src/lib/design/global.css` (`--text`, `--text-dim`, `--text-faint`, `--accent`, `--gain`, `--loss`, `--risk`, `--surface`, `--surface-raised`, `--border-faint`, `--sp-*`, `--radius-md`).
- Section headers: `font-family: var(--font-display)`, `font-variant: small-caps`, `letter-spacing: 0.08em`, `color: var(--text-faint)`, `font-size: 13px`, `margin-bottom: var(--sp-xs)`.
- Data column: monospace via `font-variant-numeric: tabular-nums`; right-align numeric columns.
- Trend arrows: `↗` gain, `→` flat (`|delta| < 1`), `↙` loss — same convention as `PressureCard.svelte`.
- Term chips: wrap `patronage`, `loyalty`, `morale`, `stress`, `fatigue`, `wages`, `signals`, `maintenance_backlog` in `<TermLabel term="...">`.
- Minimum tap target 44 px tall (Apple HIG) for rows that need it; rows that are display-only need no minimum.

#### `web/src/lib/screens/ReportsScreen.svelte` (edit)

Replace the Weekly tab stub (lines 78–81):

```svelte
{:else if active === 'weekly'}
  {#if weeklyOverview.hasResult}
    <WeeklyOverview data={weeklyOverview} />
  {:else}
    <p class="placeholder">{weeklyOverview.empty?.message}</p>
  {/if}
```

Add at the top of the `<script>`:

```ts
import WeeklyOverview from '../components/WeeklyOverview.svelte'
import { buildWeeklyOverview } from '../../../../src/reports/weeklyOverviewProjection'

const weeklyOverview = $derived(buildWeeklyOverview(gameStore.state))
```

Use the same relative import convention used elsewhere in the file. The `.placeholder` class already exists from Phase 89.

#### `web/src/lib/sim/gameStore.svelte.ts` — **unchanged**

The sim now persists weekly results, so no `lastSeenWeeklyResult` cache field is needed. This is a deliberate consequence of the sim-side fix.

## Tests

### `tests/sim/phase90.weeklyPersistence.test.ts` (new)

Drive a deterministic multi-week arc with `runOneDay` from `simRunner.ts`. Assert:

1. **Fresh state has empty history** — `state.modules.weekly.weeklyHistory === []` and `lastWeeklyResult === undefined`.
2. **endWeek populates both** — after running 7 days, `lastWeeklyResult` is set, `weeklyHistory.length === 1`, and `weeklyHistory[0] === lastWeeklyResult`.
3. **Persistence across the next week** — after running 8 days, `lastWeeklyResult` is still the week-1 result (not undefined, not overwritten), `weeklyHistory.length === 1`.
4. **Second week replaces latest, appends to history** — after running 14 days, `lastWeeklyResult.weekKey === 'Y1-M1-W2'`, `weeklyHistory.length === 2`, `weeklyHistory[0].weekKey === 'Y1-M1-W1'`.
5. **Bounded history** — after running 14 weeks (98 days), `weeklyHistory.length === 12`, and the oldest entry is week 3 (weeks 1 and 2 fell off the front).
6. **`buildWeeklyReport` is still one-shot** — `result.reports.find(r => r.id === 'weekly')` is defined on day 7's result and undefined on day 8's result.
7. **Schema validates** — `WeeklyModuleStateSchema.parse(state.modules.weekly)` passes on the post-week-1 state.
8. **Migration** — given a state object with `state.modules.weekly = { ...everythingExceptHistory }`, `ensureWeeklyHistoryField(state)` produces a state with `weeklyHistory: []` and an unchanged `lastWeeklyResult`. Idempotent — calling twice doesn't change the result.

### `tests/reports/weeklyOverviewProjection.test.ts` (new)

Use `makeTavernState` plus `runOneDay` / multi-day arcs to build realistic input. Assert:

1. **Empty state** — fresh state on day 1 → `hasResult === false`, `empty.reason === 'no_week_yet'`.
2. **After end of week 1** — run 7 days → `hasResult === true`, `header.endDay === 7`, `header.daysSinceClose === 0`.
3. **Persistence into next week** — run 8 days → `hasResult === true`, `header.endDay === 7`, `header.daysSinceClose === 1`.
4. **Economy fields populated** — sales / purchases / wages / net match the `WeeklyResult` source.
5. **Staff rows resolve names** — every staff row has a `name` derived from `state.staff[id].name.display`.
6. **Customer group rows resolve labels** — every row has a non-id label; `isBest` / `isWorst` flags match `bestGroupId` / `worstGroupId`.
7. **Maintenance rows resolve area labels and carry severity in the 0–10 range.**
8. **Supplier invoice rows** resolve supplier labels and stock labels; with Option A the list is empty, asserting an empty `rows` array.
9. **Community section omitted when empty** — set all four counts to 0 → `community === undefined`.
10. **Comparison present after two weeks** — run 14 days → `comparison.previousWeekKey === 'Y1-M1-W1'`; comparison deltas equal `currentWeek.field - previousWeek.field` for every covered field.
11. **Comparison absent after one week** — only `weeklyHistory.length === 1` → `comparison === undefined`.
12. **Non-mutation** — `JSON.stringify(state)` unchanged after `buildWeeklyOverview(state)`.

### Existing tests

`tests/sim/phase14.*.test.ts` and `tests/reports/dailyReportProjection.test.ts` may have assertions that read `state.modules.weekly` shape or assume the wipe semantics. Run the full suite; expect zero regressions, but be ready to update specific assertions if any test depended on `lastWeeklyResult === undefined` mid-week (no expected hits, but verify).

## Verification

| Check | How to run |
|---|---|
| Unit tests | `npm test` — should grow by ~20 tests; existing 1185+ keep passing. |
| Type-check | `npm run typecheck` (root, DOM-free) plus `npm run check` (svelte-check on web). |
| Build | `npm run build` — bundle growth < 5 KB gzipped. |
| End-to-end visual | `npm run dev`, open `http://localhost:5173`. Golden path: fresh save → Reports → Weekly shows the placeholder → run days 1–7 in the Day tab → Reports → Weekly renders the full overview, no comparison strip → run days 8–14 → comparison strip appears against week 1 → confirm staff/customer/area names resolve, term chips open the glossary, no empty section bleeds whitespace. |
| Schema migration | Construct a minimal pre-Phase-90 save shape (no `weeklyHistory`), pass through `ensureWeeklyHistoryField`, then `WeeklyModuleStateSchema.parse` — should succeed. Covered by tests but worth checking manually if any save fixtures live in the repo. |

## Out of scope (deferred)

- **Sparkline / mini-chart rendering across the 12-week history.** Phase 90 ships text-and-color comparison; sparkline rendering is a polish phase.
- **Pay / Defer / Skip workflow for wages and invoices.** Needs a weekly-module refactor to gate payment on player intent (new owner actions or response intents, cascading loyalty/supplier effects). Worth its own phase.
- **Supplier invoice Option B** (deferred payment). The `SupplierInvoice` shape exists but the weekly module always ships Option A (immediate payment). Opting into Option B is a future supplier-module change.
- **Per-area condition trend.** Could be added by snapshotting per-area conditions at week start (mirroring how customer satisfaction is snapshotted) and computing deltas at endWeek. Reasonable scope addition but feature creep for Phase 90; defer to a focused future phase.
- **Filterable weekly history browsing.** Reports → Weekly shows the latest week only. Past-week navigation aligns naturally with Phase 94 (Tavern Log).
- **DailyReport bridge link** ("View full weekly overview →" from the inline `<details>` block on end-of-week days). Touches Phase 89 territory; out of scope unless a cross-screen navigation API already exists.
- **"You could have done X" missed-opportunity hints.** Same calculator-gap as Phase 89.
- **Browser-storage save / load with migration applied on load.** The migration helper is wired into the existing save-envelope chain so future save-load lands cleanly, but Phase 90 doesn't ship the save feature itself.

## Risks & notes

1. **The `buildWeeklyReport` guard change is the highest-risk edit.** Phase 89's `DailyReportData.weeklyDigest` is presence-tested for boundary-day rendering. The new guard (`endDay === totalDaysElapsed`) must yield the same emit/skip pattern as the old wipe-based guard, or the daily report's inline weekly section breaks. Test: existing Phase 89 test `weeklyDigest undefined on day 1, present on day 7` must still pass; add a follow-up "undefined on day 8" assertion to lock the new behavior.
2. **Save-envelope migration wiring.** `ensureWeeklyHistoryField` must be chained into the same load path as `ensureWorldBranch` / `ensureAreaIdentityFields` / `ensureStaffIdentityFields`. The implementer should grep `ensureWorldBranch` to find the call site and add the new helper alongside; tests that load synthetic pre-Phase-90 fixtures verify the chain works.
3. **Bundle bounds.** 12 weeks of `WeeklyResult` is roughly N × (economy + trends + community arrays). For a busy late-game save that's perhaps 30–50 KB. Acceptable for in-memory state; once browser-storage save/load lands, this is also acceptable for a save payload but the bound (`MAX_WEEKLY_HISTORY = 12`) is the lever to revisit if save size becomes a concern.
4. **`state.modules.weekly` is typed `Record<string, unknown>`** at the source. **Always go through `getWeeklyModuleState(state)`** — never hand-cast. This is the established pattern.
5. **Svelte 5 runes** — repo is fully on runes. `WeeklyOverview.svelte` uses `let { data }: Props = $props()`; `ReportsScreen.svelte` uses `$derived(...)`. Event handlers use `onclick={...}`, not `on:click`. `{#each}` keys are `(item.id)`. Multi-statement derivations use `$derived.by(() => { ... })`.
6. **No Svelte component test infrastructure exists** (no `@testing-library/svelte` in the repo). The projection function carries the test weight; the `.svelte` file is covered by manual visual smoke + the type checker. Same pattern Phase 89 used for `DailyReport.svelte`.
7. **Component file name** — `WeeklyOverview.svelte`, mirroring `DailyReport.svelte`. The screen surfaces more than the text digest, so "Overview" is the accurate framing.
8. **Comparison correctness on month/year rollover.** The previous-week lookup is structurally `weeklyHistory[length - 2]`, which traverses calendar-week boundaries cleanly (Y1-M1-W4 → Y1-M2-W1 still compares back to W4). Test: run 28+ days and assert the comparison is non-degenerate across the month boundary.

## Critical files referenced

- `src/sim/modules/weekly/types.ts:147, :176, :217` — `WeeklyResult`, `WeeklyModuleState`, `lastWeeklyResult` field.
- `src/sim/modules/weekly/state.ts:39, :68, :76` — `createInitialWeeklyModuleState`, `getWeeklyModuleState`, `formatWeekKey`.
- `src/sim/modules/weekly/weeklyModule.ts:107, :278, :505, :517, :705` — `freshAccumulator`, `startDayHook`, endWeek finalisation, `buildWeeklyReport`, `WeeklyModuleStateSchema`.
- `src/sim/state/migrations.ts` — existing `ensure*` helpers to mirror.
- `src/sim/state/saveEnvelope.ts` — chain to wire `ensureWeeklyHistoryField` into.
- `src/reports/dailyReportProjection.ts` — Phase 89 projection pattern.
- `src/reports/glossary.ts` — extend additively.
- `web/src/lib/screens/ReportsScreen.svelte:19–27, 78–81` — tab definition and stub to replace.
- `web/src/lib/components/DailyReport.svelte` — precedent for digest rendering layout.
- `web/src/lib/components/PressureCard.svelte` — row + delta + trend-arrow pattern.
- `web/src/lib/components/TermLabel.svelte` — inline glossary chip.
- `web/src/lib/design/tokens.ts:6–46` — palette, spacing, `pressureColor()`.
- `web/src/lib/sim/gameStore.svelte.ts` — read `gameStore.state`; no edits needed.
- `docs/plans/cards-contract.md §3.6` — pressure conventions.
- `docs/plans/game-loop-and-ux.md §4.1, §6, §10` — UX vision and roadmap slot.
- `docs/plans/phase-89-reports-layer.md` — precedent / sibling phase.

## Suggested implementation order

1. **Sim persistence first** — edit `weekly/types.ts`, `weekly/state.ts`, `weekly/weeklyModule.ts` (the three changes: `freshAccumulator`, `endWeekHook`, `buildWeeklyReport`, schema). Add `ensureWeeklyHistoryField` to `migrations.ts` and chain it into the save envelope.
2. **Sim tests** — write `tests/sim/phase90.weeklyPersistence.test.ts`. Run `npm test` and fix any unexpected regressions in existing weekly / report tests.
3. **Type-check the sim layer** with `npm run typecheck`.
4. **Projection** — write `src/reports/weeklyOverviewProjection.ts`, extend `src/reports/index.ts`, add glossary entries.
5. **Projection tests** — write `tests/reports/weeklyOverviewProjection.test.ts`. Run `npm test`.
6. **Component** — write `web/src/lib/components/WeeklyOverview.svelte`. Iterate layout with `npm run dev`, watching the Day tab take a fresh save through days 1–14 to exercise the empty / single-week / two-week-comparison paths.
7. **Wire** — replace the stub in `ReportsScreen.svelte`.
8. **Verify** — `npm run typecheck`, `npm run check`, `npm run build`. Manual visual smoke across the golden path above.
9. **Commit and push** to `claude/phase-90-implementation-w5ZRg`. **Do not open a PR unless explicitly asked.**
