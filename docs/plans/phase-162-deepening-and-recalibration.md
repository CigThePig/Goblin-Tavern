# Phase 162 — Deepening, Pruning & Recalibration (iteration #1)

**Arc:** Legible Surface (`docs/plans/legible-surface-arc.md` §Phase 17).
**Issue:** ISSUE-130.
**Status:** in-progress.

## Why this phase

Phase 17 of the Legible Surface arc is a **standing** phase — "play
it, then deepen / prune / recalibrate." This is iteration #1. With no
playtest notes available yet, the iteration picks up:

- The **explicit Phase-17 deferrals** named in prior phase plans
  (Phases 139, 140 left harmless dead snippets in three pools; the
  Phase 155 / Phase 156 plan docs explicitly tagged them as "cleanup
  deferred to Phase 17").
- One **matrix-thinness** the gate-walk inventory surfaced: the
  `supplier_relationship` salience table ranks
  `market_instability` (rising) at #4, but the pool carried only one
  market_instability-gated snippet — the single-condition base-rung
  `est_market_rising`. When `market_instability` rose alongside a band
  signal extreme, the gradient picked the band combo and the
  multi-fact slot fell back to the base-rung market line, exactly the
  failure mode Movement V's multi-fact slot was built to fix.

`BAND_THRESHOLDS` and `SALIENCE_TABLES` orderings are **not** touched
this iteration — the arc explicitly says recalibration follows
playtest input and none is available yet. Iteration #2 (whenever it
lands) can address them.

## What changes

### Pruning (5 dead snippets across 4 pool files)

**`src/cards/compose/pools/reputationShift/establishingLine.ts`**
- Delete `est_axis_reputable` (gated `hasTag reputation.reputable` +
  `pressureRising reputation_drift`).
- Delete `est_axis_scholarly` (gated `hasTag reputation.scholarly` +
  `pressureRising reputation_drift`).

Reason: the seed's reputation axis IDs in production are `cheap`,
`tasty`, `filthy`, `dangerous`, `cozy`, `strange`, `reliable`,
`goblinAuthentic`, `respectable`, `culinary_renown`. Neither
`reputable` nor `scholarly` is a real axis — they're a Phase 139
typo, never reachable. Flagged in `phase-155-reputation-rumour-rivals-content.md`'s
out-of-scope as "harmless dead code authored in Phase 139."

**`src/cards/compose/pools/monthlyReview/establishingLine.ts`**
- Delete `est_rent_due_soon` (gated `hasTag rent_due_soon` +
  `pressureRising landlord`).

**`src/cards/compose/pools/monthlyReview/reactionLine.ts`**
- Delete `rxn_rent_due_soon` (gated `hasTag rent_due_soon`).

**`src/cards/compose/pools/monthlyReview/title.ts`**
- Delete `title_rent_due_soon` (gated `hasTag rent_due_soon`).

Reason: `rent_due_soon` lives on `state.calendar.tags` (the calendar
module sets it when `day >= 22 && day <= 28`). The `monthly_review`
seed at `issueSeedGenerators.ts:3844-3868` emits
`domain: ['monthly','economy','reputation']` and
`toneHints: ['summary','monthly']` — neither includes
`rent_due_soon`. `collectSeedTags` reads only seed.domain ∪
toneHints ∪ stakes[*].tags, so `hasTag rent_due_soon` could never
match on this family's seeds. Flagged in
`phase-156-periodic-narrative-content.md`'s out-of-scope as
"Pre-existing dead-snippet bug from Phase 140 ... fixing them is
separate cleanup work."

### Fix (1 mis-conditioned snippet)

**`src/cards/compose/pools/seasonalArc/reactionLine.ts`**
- `rxn_anticipation`: change condition from
  `{ kind: 'hasTag', tag: 'anticipation' }` to
  `{ kind: 'memoryPresent', tag: 'anticipation' }`.

Reason: the seasonal_arc generator at
`expandedSeedGenerators.ts:4465-4470` writes the `anticipation` flag
into `memoriesCreated[].tags`, not into seed.domain / toneHints /
stake tags. `memoryPresent` reads from `state.memories`, which
receives those entries when a prior anticipation card resolves.
Post-fix the line surfaces on second-and-later anticipation seeds
for the same arc theme.

### Deepening (3 new snippets in 1 pool)

**`src/cards/compose/pools/supplierReliability/establishingLine.ts`**

Three new spec-2 combo cells mirroring the existing `supplier_distrust`
matrix shape, gating on `pressureRising market_instability` plus one
orthogonal salient read:

- `est_low_rel_market` — `signalEquals supplier.reliability low` +
  `pressureRising market_instability`. Outranks both
  `est_low_reliability` and `est_market_rising` (spec-2 over spec-1)
  and is the distinct-vocabulary winner over the colliding
  `est_low_rel_distrust` combo (the two pressures are mutually
  exclusive in practice — distrust comes from supplier history, market
  comes from world-event signals).
- `est_severity_market` — `severityAtLeast 70` +
  `pressureRising market_instability`. Mirrors `est_severity_distrust`.
- `est_market_memory` — `pressureRising market_instability` +
  `memoryPresent supplier`. Mirrors `est_distrust_memory`.

Each ≤ 14 words, hand-authored. Canonical-text Levenshtein < 0.85
against every existing supplier snippet (verified by `runAllGates`'s
`dedupe` gate on the supplier template).

## Tests

**New file: `tests/cards/compose/phase162.standingDeepen.test.ts`** —
seven tests across two `describe` blocks:

- **supplierReliability — Phase 162 market_instability deepening** —
  four tests covering each new combo cell's reachability and
  determinism re-render stability.
- **seasonalArc — Phase 162 rxn_anticipation condition fix** — three
  tests covering (a) the snippet does NOT fire on a fresh state with
  no anticipation memory, (b) it DOES fire when the memory is
  installed, (c) re-renders are deterministic.

**Updated test files:**
- `tests/cards/templates.monthlyReview.test.ts` — the
  "reaction_line picks the rent_due_soon snippet" test is removed
  alongside the deleted snippet (the test could only pass by manually
  injecting the tag into toneHints, not a real production shape).
- `tests/cards/templates.supplierReliability.test.ts` — the
  "multi-fact join still composes" test's setup changes from
  `low reliability × market_instability rising` (now a Phase-162
  spec-2 combo) to `high reliability × market_instability rising`
  (still no combo cell — the multi-fact mechanism is exercised on a
  pair that remains unauthored).

No other test file is touched — the trimmed pools still pass every
existing `runAllGates` block structurally because dedupe / coverage /
specificity / diversity are all "no two snippets canonically equal"
and "every condition reachable", which deletion only improves.

## Verification

- `npm test` — full suite green (3063 + 6 new − 1 deleted = ~3068
  tests across 222 + 1 new file).
- `npm run typecheck` — green.
- The cross-template `legibility` gate continues to pass; the
  supplier situation's `salienceReadsCovered` observation rises
  modestly because the new combo cells cover the market_instability
  salient read in states the prior pool left to the bare
  single-condition snippet.

## Out of scope (deferred to future Phase-17 iterations)

- `BAND_THRESHOLDS` recalibration (no playtest data; arc says wait
  for play).
- `SALIENCE_TABLES` ordering changes (same reason).
- `staff.morale` band signal (Phase 150's deferral to Phase 17).
- Adjacent `rent_due_soon` snippets in `debtRent/reactionLine.ts` (3
  entries with the same dead-tag pattern — debt_rent seed at
  `issueSeedGenerators.ts:2519-2547` emits
  `domain: ['economy','monthly','landlord']` and
  `toneHints: ['debt','pressure']` and stakes tagged
  `['rent']`/`['landlord']`. None include `rent_due_soon`). Could
  land in iteration #2 once we confirm the snippets are dead in
  practice — they may rely on a sim-side propagation step that wasn't
  obvious from the seed-builder inspection.
- Per-reputation-axis preview specificity (Phase 158 named this as a
  small new-primitive phase that lands AHEAD of Phase 17, not inside).
- Per-pressure-family preview specificity (Phase 159 same shape).
- Additional matrix deepening on any non-supplier template (no
  evidence-of-thinness surfaced for any other establishing pool by
  the gate walk).

## How future iterations append

Future Phase-17 work updates `ISSUE-130`'s entry in
`docs/ISSUE_TRACKER.md` with a brief "Iteration N (phase 163, 164, …)"
addendum — matches how ISSUE-113 / Phase 144 handled standing
Voiced-Surface Phase 18 iterations. Each iteration's plan lives in
`docs/plans/phase-NNN-*.md` alongside this one. The `Phase` column in
the index table tracks the latest iteration's phase number.
