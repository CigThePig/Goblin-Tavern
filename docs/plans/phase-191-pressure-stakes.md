# Phase 191 / ISSUE-158 — Pressure stakes and danger zones

Implementation record. Locked contract: `docs/plans/ui-ux-intuitiveness-arc.md §Phase 191`.

## Goal

Make pressure values mean something on the surfaces the player looks at *during
play* (ribbon, drilldown), not just in the post-day report — using the sim's
*own* authored consequence text. A bar climbing into its danger band should say
*what bad outcome the player is racing against*.

## Audit findings (the sim already owns the truth)

- Every pressure calculator authors `consequences: string[]` on its
  `PressureCalculationResult`, **gated on that calculator's own severity
  threshold** (e.g. `foodSafety`/`debt`/`violence` at `severity >= 60`,
  `stockShortage` at `severity >= 50`, `marketInstability` at `severity >= 40`).
  Below the threshold the array is empty.
- So **a non-empty `consequences` array IS the sim's danger-band signal.**
  Reading `consequences[0]` returns the line only when the pressure is in/above
  its (own, per-pressure) danger band — no invented threshold, no `70`, no
  `stakeLines.ts`. This is exactly the data `pressureReport.ts` renders in its
  "If ignored:" block.
- `severityFromValue` (helpers.ts) tracks value 1:1 by default; calculators
  override only to flag low-value-but-serious cases. There is **no single
  numeric severity-band boundary** exported, so per the contract we do **not**
  fabricate a vertical tick — the colour crossover carries the visual signal.

## What shipped

### 1. `src/reports/pressureConsequenceLine.ts` (new, thin projection)

Pure functions over the existing snapshot:

- `buildPressureConsequenceLine(pressureId, state): string | undefined` — the
  top `consequences` line, or `undefined` when the pressure is unknown / has
  no authored consequences (= below its danger band).
- `buildPressureConsequenceLines(pressureId, state): string[]` — all authored
  lines, for the drilldown callout. Empty array when none.

Exported from `src/reports/index.ts`. No new copy authored; both read
`getPressureSnapshot(state, id).consequences` verbatim.

### 2. Top-3 ribbon surface (`PressureRibbon.svelte`)

For each of the (up to) three rows shown, project the consequence line from
`gameStore.state`. When present, render it as a second line under the row label
and mark the row `data-danger="true"` (a `--risk`-tinted treatment). When
absent (below band), the row is unchanged. One line per row — fuller text lives
in the drilldown.

### 3. CauseDrilldown header callout (`CauseDrilldown.svelte`)

When the open `path` is a `pressures.<id>` path, render the projected
consequence line(s) in a subtle bordered callout above the cause list. Silent
when the pressure has no authored consequences.

### 4. Danger-band colouring (`tokens.ts`)

`pressureColor` is **verified, not changed**: the crossover into the risk/loss
palette (`rust` at value 50, `blood` at 70) already aligns with where the
calculators begin authoring consequences (severity 50–60, ≈ value 50–60 at the
1:1 default). The new, sim-driven danger emphasis is the consequence line +
`data-danger` row treatment, keyed off consequence presence rather than an
invented number.

## Tests

- `tests/sim/phase191.pressureConsequence.test.ts` — runs the full pipeline,
  asserts the projection returns exactly `consequences[0]` (or `undefined`)
  for every one of the 21 pressure ids, never inventing; determinism on repeat;
  unknown id → `undefined`; planted-snapshot below/above band cases.
- `tests/web/phase191.pressureUI.test.ts` — ribbon surfaces the line + danger
  marking only when in band; drilldown callout renders for a pressure path with
  consequences and stays silent otherwise; `pressureColor` crossover guard.

## Do-not-do compliance

No `stakeLines.ts`; no hard `70` threshold; no change to severity/urgency
computation; no temporal gating; one ribbon line per row; consequence lines are
the sim's verbatim data, not reworded or turned into recommendations.
