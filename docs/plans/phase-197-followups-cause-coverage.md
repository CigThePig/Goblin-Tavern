# Phase 197 / ISSUE-164 — follow-ups (player-side ramifications)

**Parent:** `docs/plans/phase-197-cause-coverage-instrument-repair.md`
(ISSUE-164, done). This file records the issues that Phase 197 deliberately
left **out of scope** ("tests + standing instrument only; do not touch the
UI lookup or module mutation logic"), framed by what a *player* actually
experiences, so each can be picked up cleanly as its own tracked issue.

ISSUE-164 repaired the cause-coverage **instrument** (the dead audit check,
the dot/colon emitter split, and meta clobbering). It did **not** repair the
player-facing **drilldown lookup**, which sits on a different code path and
has its own latent break. The most important note below (Issue A) is that a
**green audit does not mean the player can see causes** — the two layers
match targets differently.

---

## Issue A — Cause drilldown reads "no causes recorded" for stock / staff / areas / customers (HIGH player impact)

### What the player sees
In the **Daily Report**, every diff row is a tappable button
(`DailyReport.svelte` → `openDiffDrilldown(line)` → `CauseDrilldown`).
Tapping behaves inconsistently:

| Daily Report row | Tap → drilldown result |
| --- | --- |
| Coin change | ✅ shows the contributing causes |
| Pressure (e.g. food safety) | ✅ shows causes |
| Reputation axis | ✅ shows causes |
| **Stock** (e.g. "Ale 40 → 12") | ❌ "no causes recorded for this change today." |
| **Area** (e.g. main room cleanliness) | ❌ empty |
| **Staff** (stress / morale) | ❌ empty |
| **Customer** (satisfaction) | ❌ empty |
| **Social rumour** (strength) | ❌ empty |

So a player asking "why did my ale run out?" or "why is the cook stressed?"
taps the row and is told nothing was recorded — while the identical gesture
on a coin or pressure row works. The dead-ends look arbitrary, which reads
as "the drilldown is broken/unreliable" rather than "this particular change
has no cause."

This is **reproducible on day 1 of a fresh game** — it is not an edge case.
Empirically (20-day fresh sim, every player-facing significant change fed
through the UI's own `causesForPath`): coin and all pressures resolve;
**stock, staff, areas, customers, and social rumours resolve to zero on
every occurrence.**

### Root cause
Two target conventions that never meet on this code path:

- The UI lookup (`src/reports/causeLookup.ts` → `causesForPath` /
  `getCausesForTarget`) filters by **exact** equality: `c.target === target`.
- `pathToCauseTarget('stock.ale.quantity')` returns the **id-level** target
  `stock:ale` (correct, shared with the audit via `canonicalCauseTarget`).
- But the engine's per-field auto-cause is emitted at the **field level**:
  `stock:ale.quantity` (`engine.ts`, `modifyStock` ~line 786; same shape for
  `modifyArea`/`modifyStaff`/`modifyCustomerGroup`/`modifyLocalEvent`).

`stock:ale` never equals `stock:ale.quantity`, so the exact-match lookup
finds nothing.

The slices that **work** do so only because a *module* also emits a
**separate id-level** explanatory cause that happens to match the lookup:
- coin → `target: 'coin'` (engine.ts ~923),
- reputation → `reputation:<axis>` (engine.ts ~946),
- pressures → `pressure:<id>` (pressureModule.ts ~228, in addition to the
  engine's field-level `pressure:<id>.value`).

Slices whose **only** attribution is the engine's per-field auto-cause
(stock, staff, areas, customers, rumours) have no id-level cause to match,
so they always come back empty.

### Why ISSUE-164 did not fix it (the trap to avoid)
ISSUE-164 made the **audit** matcher (`causeReport.targetMatches`)
prefix-tolerant — `stock:ale.quantity` *does* satisfy expected `stock:ale`
there — and resurrected the unexplained-changes check. Both committed
diagnostics now report **0 player-facing gaps**. But the audit's
prefix-tolerant `targetMatches` is a *different function* from the UI's
exact-match `causesForPath`. **The audit being green means the causes
exist; it does not mean the drilldown surfaces them.** Anyone following up
from the green audit alone will conclude the drilldown is fine — it is not.

(This break predates Phase 197: before Cluster 2 the engine emitted dot
targets like `stock.ale.quantity`, which also failed the `stock:ale`
exact match. Phase 197 changed the emitter convention but not the UI
lookup's exact-match semantics, so the drilldown stayed blind.)

### Suggested fix direction (for the follow-up issue)
Make the drilldown lookup use the **same prefix-tolerant matching** the
audit already uses: an id-level target (`stock:ale`) should match any
`stock:ale.<field>` cause. Concretely, have `causesForPath` /
`getCausesForTarget` reuse the `targetMatches` predicate (or a shared
helper extracted from it) instead of `===`. Watch for over-matching when a
caller passes an already-field-level target. Add a regression test that
taps a **stock** Daily Report row and asserts ≥1 cause renders (the audit
tests cannot catch this — they exercise `targetMatches`, not
`causesForPath`).

---

## Issue B — Transitional dot-tolerance shim in `targetMatches` is scheduled for removal (no player impact)

ISSUE-164 Cluster 2.3 added a transitional branch to
`causeReport.targetMatches` that accepts a cause whose `target` is the raw
**old dot path**, so the ≤5-day tail of pre-upgrade causes in live saves
still matches while they age out. It carries a comment: *"Remove after one
release cycle."*

- **Player ramification:** none. It is a harmless compatibility shim; the
  only cost is a second convention lingering in the matcher.
- **Follow-up:** once one release cycle has passed (causes self-expire in
  ≤`DEFAULT_CAUSE_EXPIRY_DAYS`, i.e. ≤5 days, per `causeAging.ts`), delete
  the dot-tolerance branch so the matcher speaks one convention. No save
  migration is involved.

---

## Issue C — `memories.count` has no cause attribution (low player impact)

`memories.count` is an aggregate with no single cause target, so it is
deliberately excluded from the audit (and shows up in the resurrected audit's
player-facing pass as the only non-`modules.*` row).

- **Player ramification:** minor today — there is no drilldown that asks
  "why did memories change?". If a future surface ever makes the memory
  count tappable, it will share Issue A's empty-state behaviour with no
  underlying cause to find.
- **Follow-up:** out of scope to attribute now (per ISSUE-164 "Do Not Do").
  If memories become player-legible, give them a per-memory cause target or
  explicitly suppress the drilldown affordance.

---

## Issue D — `modules.*` bookkeeping surfaces as "unexplained" in the now-live cause report (dev-only, no player impact)

Cluster 1 resurrected the "Unexplained significant changes" section of the
CAUSE REPORT. It now correctly lists `modules.*` bookkeeping rows (by design
unmapped — see the `diffModules` comment in `src/sim/core/diff.ts`).

- **Player ramification:** **none** — the CAUSE REPORT is a sim/debug
  artifact and is **not rendered anywhere in the web UI** (verified: no
  consumer of the `causes` report section under `web/src`). The unexplained
  list is dev-facing only.
- **Follow-up:** if the cause report (or its unexplained section) is ever
  surfaced to players, filter `modules.*` and `memories.count` first so the
  player never sees engine bookkeeping framed as "unexplained." Attributing
  module-internal slices is future per-module work, explicitly out of
  ISSUE-164's scope.

---

## Priority

1. **Issue A** — the only one with concrete, day-1, repeatable player
   confusion. Recommend tracking as its own `ISSUE-NNN` (UI/legibility tier)
   with a drilldown-render regression test.
2. **Issue B** — a scheduled cleanup with a clear trigger; low effort.
3. **Issues C / D** — documented non-goals; revisit only if those values
   become player-legible surfaces.
