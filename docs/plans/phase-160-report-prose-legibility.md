# Phase 160 — Report-Prose Legibility

**Legible Surface arc, Phase 15.** Tracked as **ISSUE-128**. Movement
VIII opener. Pairs with the arc plan at
[`docs/plans/legible-surface-arc.md §Phase 15`](legible-surface-arc.md),
the Phase-1 salience read (Phase 146 / ISSUE-114,
`src/cards/compose/salience.ts`), the Phase-2 legibility contract +
magnitude lexicon (Phase 147 / ISSUE-115,
`src/cards/compose/magnitudeLexicon.ts`), and the Voiced Surface Phase
141 / ISSUE-110 baseline (the projection-layer report compose runtime at
`src/cards/compose/reports/` + `src/reports/compose/`).

## Context

Voiced Surface Phase 141 made the daily-report surface **speak** via
composition: nine projection-layer sections (`yesterdayDigest` secondary
+ coin; `missedOpportunity` readable + secondary + diff + ignored;
`serviceLog` traffic + service + driver; plus the four empty/header
sections) route a 1-2-word verb pool through `assembleSlots` per
`(direction, magnitude-band)` tag. The figures (signed deltas, patron
counts, coin) stay structurally exact; the leading verb is voiced.

Today a player reads:

> Respectable **rose** +5
> Food safety **rising** +5 to 42
> **Took** 14 coin (2 unpaid tabs)

The voicing is alive but **uncalibrated** — a `+5` reputation gain reads
identically to a `+25` one ("rose" → "rose"), a `+1` pressure rise reads
identically to a `+12` one ("rising" → "rising"), and a small coin gain
reads identically to a large one ("earned" → "earned"). Phase 147 fixed
this for choice-effect previews via the shared `MAGNITUDE_LEXICON`
(`positive small: ['a step','a notch','a measure']`, etc.) and an opt-in
`requireMagnitude` rule on `checkPreviewVariety`. Reports never plugged
into either: their verbs were direction-keyed (sometimes magnitude-tier-
keyed) but never lexicon-bound, so a player could read direction but not
weight.

Beyond magnitude, the second half of legibility is **figure salience**:
of the figures a section could surface, lead with the one that moved
most. The yesterday-digest projection (`pickSecondary` at
`src/reports/yesterdayDigest.ts:145-167`) already picks the larger of
(top reputation delta, top rising pressure) by magnitude. The missed-
opportunity projection (`sortByImpact` at
`src/reports/missedOpportunityProjection.ts:96`) already orders lines by
`delta × severity × remedy weight`. The principle holds in both, but
nothing asserts a regression won't drop it.

The Phase 141 sim-emitted notes carve-out **carries over unchanged**:
`src/sim/modules/weekly/signals.ts`,
`src/sim/modules/weekly/community.ts`, and
`src/sim/modules/monthly/{landlord,inspection,rival}.ts` push flat-line
strings directly onto `ReportSection.lines`. Voicing them through the
projection-layer runtime is a sim-layer refactor that conflicts with
"don't alter what reports measure" and is deferred.

## What this phase ships

A documented report-prose legibility contract that mirrors Phase 147's
choice-preview contract:

1. **Every magnitude-tagged report snippet** carries a
   `MAGNITUDE_LEXICON[direction][band]` token in its rendered text —
   read by the new `checkReportLegibility` gate and authored into the
   verb pools directly (`wordBudget` bumped 2 → 4).
2. **Every figure** the section structures (signed delta, value, count,
   coin) renders verbatim in the composed line — no number drift, no
   prose restatement.
3. **Salience-first ordering** holds at the projection layer for
   sections that emit multiple lines, asserted by tests.
4. The new gate slots into `runAllGates` as the **10th gate**, opt-in
   via `AllGatesConfig.reportLegibility?`, declared per-section in the
   `runAllGates.*.test.ts` files.

Phase 141's scope is preserved: the **`ReportSection` shape is
unchanged**, no sim modules touched, runtime (`assembleNotesList`,
`buildReportSeed`, `reportSectionAsTemplate`) reused unchanged.

## What landed

### New files (3)

- **`src/cards/compose/gates/reportLegibility.ts`** — the tenth
  structural gate. Pure function
  `checkReportLegibility(template, config) → GateReport & { observed }`.
  Config carries a
  `tagToBand: Readonly<Record<string, { direction; band }>>`. For each
  snippet in each slot's pool, the gate finds the first `hasTag`
  condition whose tag appears in `tagToBand` and asserts the snippet
  text contains a `MAGNITUDE_LEXICON[direction][band]` token via
  `lineCarriesMagnitude`. Single violation reason
  `report_magnitude_missing`. Wired through `runAllGates` /
  `AllGatesConfig` as `reportLegibility?: ReportLegibilityConfig`. The
  nine pre-Phase-160 gates leave `reportLegibility` as
  `{ skipped: true }` when the config is omitted. Exported through
  `src/cards/compose/gates/index.ts` alongside
  `REPORT_LEGIBILITY_REASONS` frozen tuple.

- **`tests/reports/sections/phase160.reportLegibility.test.ts`** — 12
  fixture tests: pass case, fail case per direction × band cell across
  positive/negative/neutral × tiny/small/medium/large, determinism
  check, frozen-reasons assertion.

- **`tests/reports/sections/phase160.figureExactness.test.ts`** — 8
  tests pinning that every composer renders the structured number
  verbatim (no number drift, no prose restatement). Guards against
  future drift where a verb pool snippet absorbs the figure.

- **`tests/reports/phase160.salienceOrdering.test.ts`** — 7 tests
  pinning the salience-first projection contract:
  `projectYesterdayDigest`'s `pickSecondary` picks max-magnitude mover
  (ties favour reputation); `projectMissedOpportunities` returns lines
  in descending impact order.

### Modified files

- **5 pool files** at
  `src/reports/compose/pools/{yesterdayDigest,missedOpportunity,serviceLog}/`
  — recalibrated to carry lexicon tokens:
  - `yesterdayDigest/secondaryVerb.ts` (28 snippets: direction-only
    fallbacks at specificity 1; 12 reputation gain/loss × small/mid/large
    at specificity 2; 6 pressure-rise × small/mid/large).
  - `yesterdayDigest/coinVerb.ts` (18 snippets following the same
    shape).
  - `missedOpportunity/secondaryVerb.ts` (7 snippets: fallback + 2 per
    band × small/mid/large carrying `MAGNITUDE_LEXICON.positive.*`
    tokens — the secondary line only emits on positive pressure rises).
  - `serviceLog/serviceVerb.ts` (13 snippets covering both gain and loss
    × small/mid/large).
  - `serviceLog/trafficVerb.ts` (7 snippets at low/mid/high mapped to
    lexicon tiny/small/large).

- **3 composer files** at `src/reports/compose/sections/`:
  - `yesterdayDigest.ts` — `reputationTag` becomes `reputationTags`
    returning both direction and banded tags; same for `coinTags` (new
    tier emission at gain/loss × small/mid/large, cutoffs 30/100). Slot
    budgets bumped 2 → 4.
  - `missedOpportunity.ts` — `SECONDARY_BUDGET` bumped 2 → 4. (`READABLE_BUDGET`
    stays at 4; the connector pool isn't magnitude-keyed.)
  - `serviceLog.ts` — `serviceCoinTag` extended to tier the loss side
    (was flat `service_loss`); slot budgets bumped 2 → 4.

- **3 pre-existing test files** updated to match the recalibrated verb
  vocabulary: `yesterdayDigest.test.ts`, `serviceLog.test.ts`,
  `missedOpportunity.test.ts`.

- **3 `runAllGates.*` test files** wiring the new gate per-section:
  `runAllGates.yesterdayDigest.test.ts` (SECONDARY_TAG_TO_BAND +
  COIN_TAG_TO_BAND), `runAllGates.missedOpportunity.test.ts`
  (TREND_TAG_TO_BAND), `runAllGates.serviceLog.test.ts`
  (TRAFFIC_TAG_TO_BAND + SERVICE_TAG_TO_BAND; driver section omits the
  config, stays `skipped: true`).

### Snippet rewordings during authoring (3)

- `yd_pres_large_surge` "surging a strong climb" collided at ~0.86 with
  `yd_rep_gain_large_surge` "surged a strong climb" (only `-ed`/`-ing`
  differed). Reworded to "pressing a surge" + restructured pressure
  verbs ("creeping / mounting / pressing / building / spiking") distinct
  from reputation verbs ("rose / climbed / surged / leapt").
- `yd_pres_mid_real_step` "climbing a real step" collided at 0.85 with
  `yd_rep_gain_mid_real_step` "climbed a real step". Reworded to
  "building a clear lift".
- `tv_high_wide_leap` "Brought a wide leap" was a verbatim duplicate of
  `sv_gain_large_wide_leap` in a different template/section (no
  dedupe-gate violation but stylistic duplication). Reworded to "Packed
  a wide leap".

### Explicit specificity overrides

Banded snippets in `yesterdayDigest/{secondaryVerb,coinVerb}.ts` carry
explicit `specificity: 2` so they out-rank the direction-only fallback
snippets on the per-pool pick. Both the direction-only and the banded
snippet have one `hasTag` condition each; without the override the FNV
tie-break would sometimes return the bare-direction fallback and the
lexicon calibration would be invisible.

`missedOpportunity/secondaryVerb.ts` doesn't need this — its
unconditional fallback is specificity 0 and all banded snippets are
specificity 1. Same for the service-log pools.

## What did NOT land (out of scope)

- **Sim-emitted notes voicing** (`src/sim/modules/weekly/signals.ts`,
  `src/sim/modules/weekly/community.ts`,
  `src/sim/modules/monthly/{landlord,inspection,rival}.ts`). Same Phase
  141 / ISSUE-110 carve-out — they live in sim modules, not the
  projection layer.
- **A `'report'` family entry in `SALIENCE_TABLES`**. Current sections
  each emit one fact per slot at the snippet layer; salience-driven
  snippet picking has no use case in the connector-only architecture.
  Salience-first ordering is a projection-layer policy.
- **Recalibration of cutoffs to align with sim `MAGNITUDE_BAND_CUTOFFS`**.
  Report-layer cutoffs (the new reputation/coin tier emission at 3/8
  for reputation, 30/100 for coin) are local to the report surface.
  Phase 15 keeps them and just binds the lexicon.
- **Forward-projecting forecast prose recalibration for the
  missedOpportunity `connector` and `diffConnector` pools**. They're
  counterfactual but action-category-keyed, not magnitude-keyed;
  lexicon-binding would require a different content shape.
- **The Phase-16 legibility gate** (Movement VIII centrepiece — needs
  the salience + legibility + distinctness checks composed into one
  harness). Phase 15 provides the report-layer half of that surface.
- **No sim-side changes**, **no new condition primitives**, **no new
  SignalIds**, **no change to `ReportSection` shape**.

## Verification

End-to-end:

```bash
npm run typecheck
npm test -- tests/reports/sections/phase160.reportLegibility.test.ts
npm test -- tests/reports/sections/phase160.figureExactness.test.ts
npm test -- tests/reports/phase160.salienceOrdering.test.ts
npm test -- tests/reports/sections/runAllGates.yesterdayDigest.test.ts
npm test -- tests/reports/sections/runAllGates.missedOpportunity.test.ts
npm test -- tests/reports/sections/runAllGates.serviceLog.test.ts
npm test
```

Smoke-rendered output across magnitude tiers (from a `createInitialTavernState` smoke harness):

```
--- Reputation ---
+5  : Cozy climbed a real step +5
+25 : Cozy surged a strong climb +25
-3  : Cozy slipped a notch -3
-15 : Cozy fell a heavy fall -15

--- Pressure ---
+2  : Food safety pressing a step +2 (now 35)
+5  : Food safety building a clear lift +5 (now 35)
+15 : Food safety pressing a surge +15 (now 35)

--- Coin ---
+15  : Coin 100 → 115 (earned a notch)
+150 : Coin 100 → 250 (brought a surge)
-15  : Coin 100 → 85  (spent a notch)
-150 : Coin 200 → 50  (took a heavy fall)

--- Service log ---
+15  : Pocketed a notch 15 coin (1 unpaid tabs).
+150 : Pulled in a surge 150 coin (0 unpaid tabs).
-15  : Spent a notch 15 coin (3 unpaid tabs).
-150 : Took a heavy fall 150 coin (5 unpaid tabs).

--- Traffic ---
12 : Welcomed a hair 12 patrons across 3 groups.
40 : Poured a step 40 patrons across 6 groups.
150: Drew a strong climb 150 patrons across 12 groups.

--- Missed opportunity secondary ---
+2  : Food safety ticked a notch +2 to 35.
+5  : Food safety rose a real step +5 to 50.
+15 : Food safety surged a strong climb +15 to 80.
```

Distinct magnitude vocabulary lands across every banded surface.

Final test counts:

- Report tests: **397/397 across 34 files** (+27 vs the post-Phase-141
  baseline of 370 — 12 new gate fixture + 8 figure-exactness + 7
  salience-ordering tests, less three pre-existing test files whose
  assertions were updated to match the new vocabulary).
- Card-compose tests: **1095/1095 across 61 files**.
- Full suite: **3053/3053 across 221 files**.
