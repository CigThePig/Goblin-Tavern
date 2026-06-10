# Phase 197 / ISSUE-164 — Cause-coverage instrument repair: dead audit check, target-convention split, meta-target clobbering

**Parent contract:** Core Design Rule (`CLAUDE.md` §"Core Design Rule") and
Architectural Rule 6 ("Causality. When a major value changes, the sim must
record *why*."). No arc doc — this is a standalone correctness phase on the
cause/audit contract.
**Status:** open.
**Numbering note:** verify 197 / ISSUE-164 are still free against
`docs/ISSUE_TRACKER.md` §"Issue index" before committing; renumber the file
and headings if taken. Content does not depend on the numbers.

## Why this phase exists

An engine-core audit (June 2026) found that the causality contract's
enforcement instrument has been silently broken since it shipped, in three
stacked ways. Each defect masked the next. All three are diagnosed below
with file/line evidence and reproducible empirical runs; this plan repairs
the instrument, not the modules — module-level attribution discipline was
measured at ~100% once the instrument was fixed (see "Empirical evidence").

### Defect 1 — The unexplained-changes check is dead (never sees a diff)

`src/sim/modules/causes/causeReport.ts` (`buildCauseReport`, ~line 173)
reads:

```ts
const dayDiff = ctx.getDiffs().find((d) => d.boundary === 'day')
```

This runs during the `generateReports` phase (via `causeModule.buildReport`
→ engine `collectReports`). But the engine only finalizes the `'day'` diff
**after** the phase loop completes:

- `simulateDay` (`src/sim/core/engine.ts`): `changeTracker.finalize('day',
  …)` is called after the `for (const segment of DAY_SEGMENTS)` loop.
- `advanceDaySegment` (same file): `finalize('day', …)` is called after
  `runSegmentPhases(…)` returns.
- Nothing else ever pushes into `ChangeTracker.diffs`; `snapshot()` does
  not.

So `ctx.getDiffs()` is **always empty** at report time, `dayDiff` is always
`undefined`, and `findUnexplainedSignificantChanges` short-circuits
(`if (!diff) return []` — `causeReport.ts` line ~113). The report has
printed `"(none — every significant change has a recorded cause)"` on every
day ever simulated, in both engine entry paths.

**Test blind spot:** `tests/sim/phase17.causes.test.ts` (~lines 461, 473)
unit-tests `findUnexplainedSignificantChanges` with a hand-built tagged
diff, and only asserts the report text matches `/Unexplained/i` — which the
section header always satisfies. No test runs the engine and asserts a
**nonzero** `unexplainedCount` for a deliberately uncaused mutation.

### Defect 2 — Target-convention split: dot-style engine causes are invisible to every matcher

The engine's per-field auto-causes for the **core slices** use **dot**
targets (`src/sim/core/engine.ts`, the `targetForField` lambdas inside each
`ctx.modify*`):

| Mutator | Emitted cause target |
| --- | --- |
| `modifyArea` | `areas.<id>.<field>` |
| `modifyStock` | `stock.<id>.<field>` |
| `modifyStaff` | `staff.<id>.<field>` |
| `modifyCustomerGroup` | `customers.<id>.<field>` |
| `modifyRecipe` | `recipes.<id>.<field>` |
| `modifyReputation` | `reputation.<axis>` |
| `modifyPressure` | `pressures.<id>.value` |

The **world** mutators in the same file use **colon** targets
(`culture:<id>.<field>`, `faction:<id>.<field>`, `supplier:`, `regular:`,
`notable_npc:`, `local_event:`, `rumour:`).

Both downstream consumers expect **colon**:

- Audit: `targetForChange` in `src/sim/modules/causes/causeReport.ts`
  (~lines 28–99) maps diff paths to `area:<id>`, `stock:<id>`,
  `staff:<id>`, `customer:<id>`, `reputation:<axis>`, `pressure:<id>`, plus
  the colon world kinds. `targetMatches` (same file, ~lines 102–107) checks
  equality and dot-suffix prefix relations only — `stock.ale.quantity` vs
  `stock:ale` fails all three checks.
- UI drilldowns: `pathToCauseTarget` in `src/reports/causeLookup.ts`
  (~lines 26+) maps the same paths to the same colon style
  (`stock.ale.quantity` → `stock:ale`, etc.).

Consequence: every dot-style auto-cause is invisible to both the audit and
the player-facing CauseDrilldown. Measured on day 1 of a fresh sim
(`createInitialTavernState()`, `FULL_PIPELINE`): **82 of 158 causes (52%)**
were dot-style and unmatchable. The engine comment above
`emitDiffPathCausesForRecord` ("so the cause-coverage audit's
`cause.target === change.path` lookup matches") describes a contract the
audit does not implement; the world mutators and the report layers settled
on colon while the core emitters kept dots. Defect 1 ensured the
disagreement was never observed.

### Defect 3 — `meta.target` / `meta.amount` clobber per-field auto-causes

`buildCauseFromDraft` (`src/sim/core/engine.ts`) resolves:

```ts
const target = draft.target ?? defaults.target ?? 'global'
const amount = draft.amount ?? defaults.amount ?? 0
```

`emitDiffPathCausesForRecord` passes the caller's `meta` as the **draft**
and its computed per-field target/amount as **defaults** — so any call site
that includes `target:` or `amount:` in a `modify*` meta silently overrides
the per-field diff-path target (and the real delta) for **every** field
cause emitted by that call. The aggregate-fallback path
(`if (emitted === 0 && meta)`) is the only place the caller's `target`
should win.

Concrete instance: `updateArcRecord` in
`src/sim/modules/localArcs/localArcsModule.ts` (~lines 94–110) passes
`target: arcId` and `amount: 0`. Its arc-progress causes are therefore
emitted under `arc:<defId>:day<N>` (no `local_event:` prefix) with amount
0, instead of `local_event:<arcId>.<field>` with the real delta — making
them unfindable by `targetForChange` and `pathToCauseTarget`. These were
the only "true gaps" the fixed instrument found (see below). Other modules
with `target:`-bearing metas near world mutators (verify each during
implementation; some may only feed `addCause`, which is fine):
`localArcs/arcEffects.ts`, `regulars/regularModule.ts`,
`weekly/community.ts`, `ownerActions/{actionDefinitions,socialActions,
readonlyHelpers}.ts`, `suppliers/supplierModule.ts`,
`factions/factionModule.ts`.

## Empirical evidence (instruments committed with this phase)

Two standalone diagnostics, runnable via `npx tsx`, are committed at:

- `scripts/resurrect-cause-audit.ts` — runs the **existing**
  `findUnexplainedSignificantChanges` against post-finalize `result.diffs`
  (the check Defect 1 prevents), 3 seeds × 56 days.
- `scripts/true-gaps-audit.ts` — same runs with a convention-tolerant
  matcher (accepts engine dot paths AND audit colon targets), isolating
  true attribution gaps from convention artifacts. Its `explained()`
  function is the reference semantics for the unified matcher below.

Results on 3 seeds × 56 days (168 simulated days, full pipeline, no owner
input):

- 5,947 significant changes total; the existing (resurrected) matcher
  flags 5,244 (88.2%) — dominated by `modules.*` bookkeeping, which is
  **by design** unmapped (see the comment block above `diffModules` in
  `src/sim/core/diff.ts` and the tail of `targetForChange`).
- Player-facing slices only (excluding `modules.*` and `memories.count`):
  793 significant changes; existing matcher flags 95 (stock quantity/
  spoilage, monthly reputation on days 27/55, area mess, local arcs) — all
  but 6 are Defect 2 artifacts (the causes exist, dot-style).
- Convention-tolerant matcher: **6 of 793 (0.8%)** unexplained — all six
  are the localArcs Defect 3 instance (`localEvents.*.intensity`,
  `localEvents.*.ageDays` on day 55), where causes exist under the
  clobbered target. **Zero changes had no cause at all.**

Re-run after implementation; both scripts must report shrinking numbers
per the acceptance criteria.

## Design decision: unify on the colon convention at the emitters

Fix the **emitters**, not just the matchers, because two independent
consumers (`causeReport.targetForChange`, `causeLookup.pathToCauseTarget`)
already speak colon, and matcher-only normalization would leave the UI
drilldown blind to half the cause population. Core emitters change to
mirror the world mutators exactly:

- `areas.<id>.<field>` → `area:<id>.<field>` (note singular `area`,
  matching `targetForChange`)
- `stock.<id>.<field>` → `stock:<id>.<field>`
- `staff.<id>.<field>` → `staff:<id>.<field>`
- `customers.<id>.<field>` → `customer:<id>.<field>` (singular)
- `recipes.<id>.<field>` → `recipe:<id>.<field>` (singular; add a
  `recipes.` → `recipe:<id>` branch to `targetForChange` and
  `pathToCauseTarget`, which currently lack one)
- `reputation.<axis>` → `reputation:<axis>`
- `pressures.<id>.value` → `pressure:<id>.value`

`targetMatches`' existing prefix rule (`target.startsWith(expected + '.')`)
then matches `stock:ale.quantity` against expected `stock:ale` with no
matcher change. No save migration: causes expire in ≤5 days
(`DEFAULT_CAUSE_EXPIRY_DAYS`, `src/sim/modules/causes/causeAging.ts`), so
add **transitional dot-tolerance** to the matcher (cluster 2) instead of
migrating, and old-style entries age out on their own.

## Scope (ordered clusters; each lands green before the next)

### Cluster 1 — Resurrect the check (Defect 1)

1. Add to `SimContext` (`src/sim/core/context.ts` + implementation in
   `createContext`, `src/sim/core/engine.ts`):
   `getDiffSoFar(boundary: PhaseBoundary): StateDiff | undefined`, backed
   by the existing `ChangeTracker.diffAgainst(boundary, runtime.current)` —
   computes snapshot→now without finalizing. `getDiff`/`getDiffs`
   semantics are unchanged (still post-finalize only).
2. `buildCauseReport` switches its day-diff read to
   `ctx.getDiffSoFar('day')`. The diff at `generateReports` time excludes
   only later-phase mutations (validate/advanceCalendar write no
   player-facing state), which is the correct window for "today's changes
   vs today's causes".
3. Both engine entry paths must feed it: `simulateDay` already snapshots
   `'day'` up front; `advanceDaySegment` snapshots the supplied
   `dayBaseline` — so segment C's report sees the true full-day window.
   Add a test on the segmented path (see Test approach).

### Cluster 2 — Unify the target convention (Defect 2)

1. Change the seven core-slice `targetForField` lambdas in
   `src/sim/core/engine.ts` to the colon forms in the table above. Update
   the stale comment above `emitDiffPathCausesForRecord` (the
   `cause.target === change.path` claim) to describe the colon contract.
2. Extract one shared canonicalizer — suggested:
   `src/sim/modules/causes/causeTargets.ts` exporting
   `canonicalCauseTarget(path: string): string | undefined` — and have
   **both** `causeReport.targetForChange` and
   `causeLookup.pathToCauseTarget` delegate to it (`pathToCauseTarget`
   keeps its `inventory.` alias as a pre-mapping). One mapping, two former
   copies.
3. Transitional dot-tolerance in `targetMatches`: also accept
   `cause.target` equal to the raw diff path (the old engine convention)
   so the ≤5-day tail of pre-upgrade causes in live saves still matches.
   Mark with a comment that it can be removed after one release cycle.
4. Grep for consumers of the **old dot targets** before merging:
   `getCausesForTarget('` call sites, anything matching
   `stock\.\$\{`/`staff\.\$\{` style target construction in `src/` and
   `web/src/`, and the `tests/sim/phase42.worldDiffCoverage.test.ts` and
   phase-17 expectations. Update expectations; do not add compatibility
   shims beyond 2.3.

### Cluster 3 — Stop meta clobbering per-field causes (Defect 3)

1. In `emitDiffPathCausesForRecord`, build the per-field draft from a
   sanitized meta: strip `target`, `targetType`, and `amount` before
   passing it as the draft (e.g.
   `const { target: _t, targetType: _tt, amount: _a, ...metaRest } = meta`),
   so the computed per-field target/amount/`targetType` always win. The
   caller's `direction`/`weight` overrides remain honored.
2. The aggregate fallback (`emitted === 0`) keeps its current behavior:
   the caller's `target` is the intended aggregate target there.
3. Verify the localArcs instance specifically: after the fix,
   `updateArcRecord`'s age/stage updates must emit
   `local_event:<arcId>.intensity` / `.ageDays` with real deltas. Sweep
   the other modules listed under Defect 3 — most need **no source
   change** (the engine-side sanitization fixes them); only adjust a call
   site if its meta `target` was load-bearing for the per-field causes,
   which the audit found nowhere.

### Cluster 4 — Tests + standing instrument

1. New engine-level test (suggested
   `tests/sim/phase197.causeCoverage.test.ts`):
   - A probe module mutates state **without** any cause (direct
     `modifyModuleState`-style write to a walked slice, or a probe
     mutator) → run `simulateDay` → assert the cause report's
     `data.unexplainedCount > 0` and the path appears in
     `data.unexplainedPaths`. This is the regression test Defect 1 lacked.
   - Happy path: a `modifyStock` day produces `unexplainedCount === 0`
     for that path (proves emitter↔matcher alignment end-to-end).
   - Segmented path: same assertions through
     `advanceDaySegment(A→B→C, { dayBaseline })`, reading segment C's
     report.
   - Clobber regression: `modifyLocalEvent` with a meta carrying
     `target`/`amount` → assert per-field causes carry
     `local_event:<id>.<field>` and the real delta.
2. Wire the diagnostics as an npm script:
   `"audit:cause-coverage": "tsx scripts/true-gaps-audit.ts"` (pattern:
   the existing `audit:card-choices`). Keep both scripts current with the
   canonicalizer from 2.2 (import it rather than duplicating the map, once
   it exists).

## Acceptance criteria

- [ ] `npx tsx scripts/resurrect-cause-audit.ts` player-facing pass: every
      formerly-flagged convention artifact (stock quantity/spoilage,
      reputation days 27/55, areas mess) is gone; remaining rows are only
      `modules.*` bookkeeping, `memories.count`, or genuinely uncaused
      changes (expected: none).
- [ ] `npx tsx scripts/true-gaps-audit.ts` reports **0** true unexplained
      player-facing changes over 3 seeds × 56 days (the 6 localArcs
      entries are gone).
- [ ] The in-engine cause report produces a **nonzero**
      `unexplainedCount` for a deliberately uncaused significant change,
      in both `simulateDay` and segmented `advanceDaySegment` runs
      (asserted by the new test, not by inspection).
- [ ] `targetForChange` and `pathToCauseTarget` share one canonical
      mapping; `recipes.` paths are mapped by both.
- [ ] `modifyLocalEvent` (and all `modify*`) per-field causes are immune
      to caller `meta.target`/`meta.amount`; the aggregate fallback still
      honors caller `target`.
- [ ] `npm test` and `npm run typecheck` green; `npm run test:full` green
      pre-merge (segmented-equivalence and phase-42 coverage tests
      updated, not deleted).

## Do Not Do

- Do **not** change diff thresholds (`DEFAULT_THRESHOLDS`), the
  `PhaseBoundary` union, `SIMULATION_PHASES` order, or when
  `finalize('day')` runs — `SimResult.diffs` consumers
  (`dailyReportProjection`, `missedOpportunityProjection`,
  `significantDiffs.ts`) depend on current semantics.
- Do **not** write a save migration for cause targets — causes self-expire
  in ≤5 days; transitional matcher tolerance (Cluster 2.3) covers the tail.
- Do **not** map `modules.*` paths in the canonicalizer — surfacing module
  bookkeeping as unexplained is the documented design (see `diffModules`
  comment); attributing module slices is future per-module work, out of
  scope.
- Do **not** attempt to attribute `memories.count` — it is an aggregate
  with no single cause target; exclude it the way the diagnostics do, or
  leave it flagged.
- Do **not** touch issue-seed generators, pressure calculations, or any
  module's mutation *logic* — this phase changes the attribution plumbing
  and its instruments only.

## Test approach (observable behavior)

The proof is the instrument catching a planted gap: a state mutation with
no cause must surface as `unexplainedCount > 0` in the live engine's cause
report (both entry paths), and the planted-gap test plus the two committed
diagnostics at zero constitute the end-to-end evidence. Secondary proof:
a CauseDrilldown-layer lookup (`causesForTarget` via
`pathToCauseTarget('stock.ale.quantity')`) returns the engine's auto-cause
for a `modifyStock` mutation — demonstrating the UI blind spot is closed.

## Tracker entry (paste into `docs/ISSUE_TRACKER.md`)

```
### ISSUE-164 — Cause-coverage instrument repair (dead check, convention split, meta clobbering)
- **Grade:** broken · **Status:** open · **Phase:** 197 · **Record:** `docs/plans/phase-197-cause-coverage-instrument-repair.md`
- **Evidence:** `buildCauseReport` reads `ctx.getDiffs()` during `generateReports`, but `finalize('day')` runs after the phase loop in both engine entry paths — the unexplained-changes check has returned "(none)" on every simulated day. Behind it: core-slice `modify*` auto-causes use dot targets (`stock.<id>.<field>`) while both `targetForChange` (causeReport) and `pathToCauseTarget` (causeLookup) expect colon (`stock:<id>`) — 52% of day-1 causes unmatchable by audit AND UI drilldown; and `draft.target ?? defaults.target` precedence lets caller meta clobber per-field targets (localArcs emits `arc:<id>` instead of `local_event:<id>.<field>`). Empirics: 168-day runs show 0.8% (6/793) player-facing unexplained under a convention-tolerant matcher, all from the clobbering instance; instruments at `scripts/resurrect-cause-audit.ts`, `scripts/true-gaps-audit.ts`.
- **Scope:** `ctx.getDiffSoFar(boundary)` backed by `ChangeTracker.diffAgainst`; causeReport switches to it. Core emitters unify on colon convention; shared `canonicalCauseTarget` consumed by causeReport + causeLookup; transitional dot-tolerance in `targetMatches`. `emitDiffPathCausesForRecord` sanitizes meta (`target`/`targetType`/`amount`) for per-field drafts; aggregate fallback unchanged. Planted-gap engine test (both entry paths) + clobber regression + `audit:cause-coverage` npm script.
- **Depends on:** none.
- **Test approach:** a deliberately uncaused significant mutation yields `unexplainedCount > 0` in the live report (simulateDay AND segmented A/B/C); `modifyStock` change resolves through `pathToCauseTarget` → cause found (UI blind spot closed); both committed diagnostics report zero player-facing gaps over 3 seeds × 56 days.
```
