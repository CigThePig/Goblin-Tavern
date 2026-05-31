# Phase 186 — Day-Clock & Time Economy: Implementation Notes

Cross-cluster findings discovered while building, recorded so later clusters
(2–7) don't re-derive them. This is a companion to the contract
`phase-186-day-clock-time-economy.md`; the contract states the *design*, this
states what the *code* actually does and where the contract had gaps. Read
this before starting any later cluster.

Status legend: ✅ landed in Cluster 1 · ⏭️ deferred to a named later cluster ·
⚠️ correction to a contract assumption.

---

## Cluster 1 — what shipped (seed lifecycle rewrite)

Generation is now **segment-local** instead of pre-baked the evening before in
one `generateReports` lump. `src/sim/modules/issues/issueSeedModule.ts`:

| Seed `timing` | Generated at phase | Reads |
| --- | --- | --- |
| `morning_prep` | `startDay` (after a clear) | prior day's closing pressure snapshot |
| `during_service` | `afterService` | this day's settled satisfaction + prior closing snapshot |
| `closing` | `closing` (after `calculatePressuresHook`) | this day's settled pressures |
| `end_week` | `closing` **and** `endWeek` | standing seeds at closing; rollup-dependent at `endWeek` |
| `end_month` | `closing` **and** `endMonth` | standing seeds at closing; rollup-dependent at `endMonth` |

- `startDay` **clears** `seedsToday` (and `rejectedToday`) first, then runs the
  morning pass. The day owns its own surface — no carry-over of yesterday's
  set. `cooldowns`/`recentPicks`/`totalGenerated`/`totalRejected` persist
  across days.
- Each pass **appends** to the accumulating `seedsToday` and **re-ranks the
  union**. `rankSeeds` is a pure sort over already-scored seeds, so re-ranking
  per pass == ranking the whole day at once.
- Passes are **idempotent**: `runGenerationPass` skips a candidate whose `id`
  is already in `seedsToday`. This is what lets `debt_rent` (an `end_month`
  seed that fires daily on standing arrears) run in the `closing` pass *and*
  be harmlessly re-attempted in the `endMonth` pass without double-counting.
- `issueSeeds.dependsOn` gained `customers`, `weekly`, `monthly` so the
  `afterService`/`endWeek`/`endMonth` passes are guaranteed to run **after**
  those modules settle their state in the same phase (satisfaction, weekly
  rollup, monthly rollup). The pre-existing `causes`/`memories`/`pressures`
  deps already ordered generation after the analysis stack.

### ✅ GATE A — satisfied

The contract (§1.8) claimed "all three `during_service` generators." There are
**five** (`customer_complaint`, `violence`, `regular_customer`,
`faction_request`, `culture_conflict`) — see ⚠️ below. The gate requires each
to read only state available at the service moment. We run the
`during_service` pass at **`afterService`** (not `service`) for two reasons:

1. `customer_complaint` reads `customerGroups.*.satisfaction`, which the
   customers module writes in its **own `afterService` hook**
   (`customerModule.ts` → `satisfaction.ts`). Running at `afterService`
   (ordered after customers via `dependsOn`) reads the day's settled value —
   what an emergent complaint should reflect.
2. `afterService` is still **before** this day's `closing` →
   `calculatePressuresHook`, so every pressure-snapshot-gated guard reads the
   **prior** closing snapshot — exactly the value §1.8 says it must, and the
   same value the seed would have read under the old model (see "determinism"
   below). `patronage`/`rowdiness` are not mutated during service/afterService.

---

## ⚠️ Corrections to contract assumptions

- **⚠️ §1.8 undercounts the during-service generators.** It says "all three";
  there are **five**. `customer_complaint` and `violence` are also
  `during_service`. `customer_complaint` is the only one that reads a
  service-mutated field (`satisfaction`), which is why the pass runs at
  `afterService` and not `service`. Any future during-service generator must
  hold the GATE A property (read only prior-closing snapshots + `world.*` +
  calendar/memories/causes, or settled-at-afterService satisfaction).

- **⚠️ `end_month` conflates two different surfaces.** `debt_rent` and
  `monthly_review` share the `end_month` timing but have *opposite* generation
  needs:
  - `debt_rent` is a **standing-condition choice** — it fires whenever rent
    arrears / low coin / debt pressure hold, on *any* day, reading only
    snapshots + `coin` + `monthly.rent`. It must generate at `closing` to keep
    its daily cadence.
  - `monthly_review` is a **rollup reflection** — `generateMonthlyReview`
    returns `[]` until `lastMonthlyResult` exists, and that is not written
    until the `endMonth` rollup (`monthlyModule.endMonth` → `resolveRent`),
    which runs **after** `applyResponses`. It must generate at `endMonth`.

  Cluster 1 handles this by running the periodic timings in *both* the
  `closing` pass and the boundary passes, with id-dedupe. **Cluster 4 should
  split the timing taxonomy properly** (a standing `debt`-style timing vs a
  true `end_month` rollup timing) when it re-homes choice-bearing periodic
  seeds — see below.

---

## ⏭️ The big one for Clusters 2 & 5 — response resolution is now same-day

This is the load-bearing behavioural change and the thing most likely to bite a
later cluster that isn't expecting it.

**Old model:** seeds were generated at the *previous* day's `generateReports`
and `startDay` deliberately did **not** clear `seedsToday`, so a response in
day N's input resolved against a seed generated on day **N-1** ("respond to
yesterday's seeds").

**New model:** `startDay` clears and the day regenerates its own seeds. By the
time `applyResponses` runs, `seedsToday` holds **this day's** accumulated
surface (morning + during-service + closing). A response therefore resolves
against a seed generated **earlier the same day**. This is the two-pause model
the contract is driving toward (§1.9, §3.2).

Consequences for later clusters:

- **Cluster 2 (segmented engine):** the segmented run must accumulate seeds
  across its passes within a day and only clear at the Segment-A `startDay`.
  The `simulateDay` single-call path already does exactly this in sequence, so
  "segmented run == `simulateDay` final state" should hold for seeds too. A
  response provided to a later segment resolves against a seed produced by an
  earlier segment of the *same* day — verify this explicitly (it's the §4.1
  "same-day multi-pass" check).

- **Cluster 5 (store / UI):** ⚠️ **the web store's response flow is currently
  broken in the interim and this is expected.** `gameStore.runDay()` bundles
  `responseIntents` built from `todaysSeeds` (the seeds shown from the *prior*
  `runDay`), then calls `simulateDay` for the next day — whose `startDay` now
  clears those seeds and regenerates with a new day-stamp, so the intents
  reference ids that no longer exist and **silently no-op** (logged as "unknown
  seed", no crash). Cluster 5 must switch the UI to the segmented same-day flow:
  show Segment-A/B seeds and resolve responses within the *same* day's segment
  run. No web component test currently exercises real cross-day resolution
  (they pass empty `responseIntents`), which is why the suite stays green — but
  the product itself won't resolve cards until Cluster 5 lands.

- **Cluster 7 (in-flight save migration):** a save written under the old model
  carries a `seedsToday` that the new `startDay` will clear, and AP-costed
  picks. The migration must either finish the in-flight day under old rules or
  reset cleanly to the next morning (contract §4.7).

### Test pattern for same-day resolution (use this in Clusters 2/5)

The single-call way to test a response resolving against a same-day seed,
without predicting rotation-based ids:

```
const warm  = runDay(base)          // day 0: establishes the pressure snapshot
const probe = runDay(warm.state)    // day 1: regenerates the morning/service seed
const seed  = getIssueSeeds(probe.state, { family }) [0]
// response does NOT perturb generation (it acts at applyResponses, after all
// generation), so re-running warm.state regenerates the identical seed id:
const control   = runDay(warm.state)
const treatment = runDay(warm.state, { responseIntents: [intent(seed.id)] })
```

For **closing-timed** seeds the seed already generates on day 0, so run
`control`/`treatment` from the *pre-day* `base` (no warm-up). For **end_month
rollup** seeds (`monthly_review`) same-day engine resolution is impossible
(generated after `applyResponses`) — test the consequence effects through the
pure resolver `resolveResponseIntent(state, seed, intent)` instead. Cluster 1
converted `tests/sim/phase{19,41,53,54,55,56,57,59}` to these patterns.

---

## ⏭️ Cluster 4 — periodic-choice re-homing (what Cluster 1 left half-done)

- `debt_rent` and `monthly_review` currently surface via the `closing`/boundary
  passes and the existing `seedsForTiming('end_month')` routing. Cluster 4
  should:
  - Route the **informational** weekly/monthly digests (`projectDigest`
    report sections) to the **report** (Segment C aftermath).
  - Re-point **choice-bearing** periodic seeds (`debt_rent`, and the resolvable
    part of `monthly_review`) to the **morning pause** of the day they fire, so
    the moment to act doesn't pass before the player sees the card.
  - Resolve the ⚠️ `end_month` taxonomy split noted above — a standing
    `debt_rent` timing distinct from a true month-end-rollup timing — so the
    `closing`-pass/`endMonth`-pass + id-dedupe scaffold in Cluster 1 can be
    simplified.
  - This is the proper fix for `monthly_review`'s "can't resolve same-day"
    limitation: once it surfaces at the *next morning's* pause, it resolves
    that morning like any other morning seed.

---

## Determinism notes (why the churn was bounded)

- **Generators consume no RNG.** A grep across `issueSeedGenerators.ts`,
  `expandedSeedGenerators.ts`, `generatorHelpers.ts`, `issueSeedRanking.ts`,
  `seedRotation.ts`, `areaPickers.ts` finds zero `ctx.rng`/stream usage. So
  relocating generation across phases does **not** shift the shared RNG
  sequence for any other module — the wide determinism cascade we feared does
  not happen.
- **The pressure value a seed reads is unchanged for morning/during-service.**
  A seed "active" on day N reads the day N-1 closing snapshot in *both* models
  (old: generated at day N-1's `generateReports`, after that day's closing;
  new: generated at day N's `startDay`/`afterService`, before day N's closing
  recompute). Same stored snapshot, same value. The visible change is a **one-
  day warm-up lag**: on a hand-set base with no prior day, the morning/during
  surface is legitimately empty until one closing has populated the snapshot.
  Multi-day sims (e.g. `phase20.cardlessPlaytest`) are unaffected.
- **Seed ids embed the absolute day** (`seed-{family}-{template}-d{absoluteDay}`,
  `generatorHelpers.ts:seedId`). This is why "respond to yesterday's seed"
  breaks under the clear: the regenerated seed carries today's stamp. It is
  also why the same-day test pattern above works — a deterministic re-run
  regenerates the identical id.

---

## Files touched in Cluster 1

- `src/sim/modules/issues/issueSeedModule.ts` — lifecycle rewrite
  (`runGenerationPass` + per-phase hooks, dedupe, `dependsOn`).
- `src/sim/modules/responses/responsesModule.ts` — `findSeed` comment only
  (resolution path is unchanged and timing-agnostic).
- Tests migrated to same-day / pure-resolver patterns:
  `tests/sim/phase19.issueSeeds.test.ts`, `phase41.responsePipeline.test.ts`,
  `phase53.policyBacklash.test.ts`, `phase54.regularCustomer.test.ts`,
  `phase55.reputationShift.test.ts`, `phase56.violence.test.ts`,
  `phase57.staffBurnout.test.ts`, `phase59.monthlyReview.test.ts`.
</content>
</invoke>
