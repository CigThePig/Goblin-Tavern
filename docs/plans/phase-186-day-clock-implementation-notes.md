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

## Cluster 2 — what shipped (segmented engine entry + full-day diff thread)

`src/sim/core/segments.ts` (new) partitions `SIMULATION_PHASES` into three
contiguous slices on the two player-input seams:

| Segment | First phase | Phases | Pause it follows |
| --- | --- | --- | --- |
| A | `startDay` | `startDay … forecastTraffic` | — (opens the day) |
| B | `beforeOwnerActions` | `beforeOwnerActions … closing` | Pause 1 (morning plan → `ownerActions` + `staffPriorities`) |
| C | `applyResponses` | `applyResponses … advanceCalendar` | Pause 2 (service react → `responseIntents`) |

`src/sim/core/engine.ts` gains a public **`advanceDaySegment(state, input,
modules, segment, { dayBaseline? })`** that runs one slice in its own fresh
runtime and returns a normal `SimResult` whose `state` is the serializable
checkpoint. `simulateDay` is **reimplemented as the three segments run
back-to-back through the same `runSegmentPhases` helper**, so the run-all and
run-one paths are literally the same code and cannot drift. The invariant
(segmented A→B→C === `simulateDay` final state + full-day diff) is asserted in
`tests/sim/phase186.segmentedEngine.test.ts`.

### ⚠️ Correction to the contract: `simulateDay` is **not** byte-unchanged

§4.2 says "keep `simulateDay` … unchanged." Its **signature, role, and
callers are unchanged** (the cardless runner and every determinism test still
call it and still get one full day). But its **internal RNG threading
changed**: it now rebuilds the RNG stream set at each segment boundary
(`reseedSegmentRng`). This is *forced* by the other three Cluster-2
requirements taken together — per-segment sub-seeds (§1.3) + "only TavernState
crosses a pause" (no RNG serialization, §1.2/§1.3) + "segmented run produces
identical final state to `simulateDay`." A segmented run cannot carry RNG
call-counts across a pause, so each segment re-derives its RNG from a
segment-scoped seed; for the run-all path to match, it must reseed the same
way. The three constraints can only co-exist if `simulateDay` adopts the
segment reseed. So "unchanged" is a contract gap; the stronger, repeated
requirements win.

### ⚠️ Segment A keeps the per-day seed (refinement of `:seg-{A,B,C}`)

`segmentSeed(seed, 'A') === seed`; only B and C take a `:seg-{B,C}` suffix.
Rationale: Segment A runs first, so its streams can never *replay* a prior
segment (the whole reason sub-seeds exist — see the RNG map below), and
leaving A on the per-day seed keeps **all of Segment A's RNG identical to the
pre-Cluster-2 behaviour**. Segment A owns identity/name generation
(`regular_identity`, the daily `supplier_delivery` diagnostic, forecast
jitter), which is the most brittle thing to re-baseline in tests. This is a
deliberate, documented deviation from the literal `:seg-{A,B,C}` notation,
taken to bound test churn and protect name determinism. The contract's intent
(deterministic, isolated, serialization-free segments) is fully met: A↔B↔C
are pairwise seed-isolated.

### RNG stream → segment map (why the churn was bounded to B/C)

Only **`service`** (`ctx.rng`) is consumed in all three segments — forecast
jitter (A), turnout variation (B), area decay + spoilage (C). `supplier_delivery`
spans A (daily supplier cycle) + B (player restock). Every other named stream
is single-segment. Because Segment A keeps the per-day seed, the values that
*changed* under the reseed are only the **Segment B and C** rolls
(`service` turnout/decay/spoilage, `incidents`, `attribution_perceiver`,
`seasonal_events`, `adventurer_roster`/`npc_identity` on week/month
boundaries, and `staff_identity`/`supplier_delivery` only when the player
hires/restocks). The full suite stayed green with **no test edits** — the
sim's value-sensitive tests use relative/threshold/warm-up assertions, not
golden numbers.

### Cause/history numbering is now resumable from state

A per-segment runtime starts fresh (counter 0), which would re-mint `c-<day>-1`
mid-day and corrupt state. `createContext` now **derives the starting
cause/history counter from the ids already stamped for today**
(`deriveDayCounter`, scanning for the max `c-<absoluteDay>-<n>` /
`h-<absoluteDay>-<n>`). For a single `simulateDay` call or a fresh day this is
0 (no match yet), so it reproduces the old continuous numbering exactly; for a
later segment it continues where the earlier segment left off. This is the
"only TavernState crosses" property applied to the cause counter.

### Expedition seed capture moved off `baseSeed`

`commissionExpedition` captured `ctx.rngStreams.baseSeed`. After the reseed,
`baseSeed` is the *segment* seed (commissioning runs in Segment B), so the
capture now reads **`ctx.input.seed`** — the unsegmented per-day seed, which
is exactly what `baseSeed` was before Cluster 2. Expedition resolution
determinism is therefore unchanged. (`getRngStreamByName`/`baseSeed` have no
other in-sim caller.)

### ⏭️ For Cluster 5 (store / UI flow)

- Drive the three segments with `advanceDaySegment`. Hold the **start-of-day
  `TavernState`** as one store field and pass it as `dayBaseline` to the B and
  C calls so the daily report keeps reading a single full-day diff (GATE B).
  Segment A may omit `dayBaseline` (defaults to its input).
- The **same `SimInput`** can be passed to all three segments — each segment
  only consumes the input fields whose phase it runs (`ownerActions`/
  `staffPriorities` in B, `responseIntents` in C); the others are inert.
- **Reports are only built in Segment C** (`generateReports` lives in C), so
  `buildDailyReport` should run against the Segment-C result. **Logs, however,
  accumulate per segment** — A and B produce `result.logs` of their own. If
  the store needs the full day's logs (e.g. debug bundle), concatenate
  `a.logs ++ b.logs ++ c.logs`. Validation runs only in C.
- `latestResult` for the report = the Segment-C `SimResult`. Its `diffs` hold
  the full-day diff; its `reports` hold the day's report sections.

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

---

## Cluster 3 — what shipped (AP → time recalibration)

The daily **action-point budget became a daily MINUTES budget**. The gate
is byte-for-byte the same additive `used + cost > budget` it always was
(contract §1.6); only the constants and their unit changed.

### The numbers (starting calibration — §6 defers tuning to playtest)

`src/sim/modules/ownerActions/stateHelpers.ts` is the single source of
truth:

| Constant | Value | Meaning |
| --- | --- | --- |
| `DAY_MINUTES` | `360` | the owner's working day (six hours) |
| `TIME_COST_TRIVIAL` | `0` | a pure logistics toggle |
| `TIME_COST_QUICK` | `30` | a quiet word / chalkboard change |
| `TIME_COST_SHORT` | `60` | a light hands-on task |
| `TIME_COST_STANDARD` | `120` | a solid chore — a third of the day |
| `TIME_COST_HEAVY` | `240` | a big job that eats most of the day |

`DAY_MINUTES = 360` with `STANDARD = 120` means **three standard chores
fill the day** — a deliberate, faithful re-statement of the old 3-slot
budget, now expressive (cheap social moves let you fit more small things;
a cellar/roof job eats two-thirds of the day). These are coarse tiers, not
finely-engineered numbers; tune them in playtest, not by argument.

Per-action map (every owner action, including the project/policy/social
builders and `commissionExpedition`):

- HEAVY (240): `patch_roof`, `fumigate_cellar` (the contract's own "eats
  the day" example, §3.8), `hire_staff`.
- STANDARD (120): `clean_area`, `repair_area`, `fire_staff`,
  `ban_customer_group`, `host_faction_night`, `commission_expedition`,
  project `start_*`, `buy_candles` (test fixture).
- SHORT (60): `restock_item`, `water_down_ale`, `improve_stew`,
  `negotiate_with_supplier`, `fund_active_project`.
- QUICK (30): `adjust_prices`, `pay_staff_bonus`, `buy_mugs`,
  `comfort_stressed_staff`, `apologize_to_regular`, `warn_rowdy_group`,
  `cancel_project`, every `enable_*`/`disable_*` policy toggle (and the
  web policy-toggle row).
- TRIVIAL (0): `toggle_recipe_menu`.

`formatDuration(minutes)` (also in `stateHelpers.ts`, re-exported through
the web `actionBuilder` → `gameStore`) renders `0m` / `30m` / `2h` / `2h
30m` for every player-facing surface.

### ⚠️ The amount → time design choice is DEFERRED (contract §3.8 / §6)

Time does **not** scale with `amount` (e.g. "restock 40 vs 10 barrels"
costs the same minutes). The engine has zero amount→AP coupling today
(§1.7), so this is a free future choice with no hidden breakage. If a later
calibration pass takes it, the budget gate must compute cost dynamically
from `amount` and the plan UI must show a cost that updates live as the
player sets the amount. Recorded here so it's an open choice, not an
oversight.

### ⚠️ NAMING DEBT — serialized `actionPoint*` fields kept (rename is Cluster 7's)

This is the load-bearing cross-cluster note. Four **serialized** fields
were left named `actionPoint*` even though they now hold **minutes**:

- `OwnerActionsModuleState.actionPointsUsed` / `.actionPointBudget`
  (`state.modules.ownerActions`)
- `OwnerActionApplied.actionPointCost` (inside the persisted `applied[]`)
- the web `PickedAction.actionPointCost` (persisted in the save's `picks[]`)

They were **not** renamed because renaming serialized fields changes the
save shape and forces a state migration — which is exactly Cluster 7's
job (in-flight save migration). Renaming them now would split that
migration across two clusters. So:

- **Read every `actionPoint*` field as "minutes."** Each one carries a
  doc comment saying so.
- **Cluster 7 should rename them** (suggested: `timeSpent` / `timeBudget`
  / `timeCost`) as part of the save migration it already owns, with an
  additive `ensure*` helper in `src/sim/state/migrations.ts` that renames
  the keys (and, if it wants the magnitudes right, scales an in-flight
  pre-upgrade `actionPointsUsed`/`applied[].actionPointCost` — old saves
  carry AP magnitudes like `1`, not minutes, for the last pre-upgrade
  day; cosmetic only, since `startDay` resets the daily fields).
- A day-boundary save needs **no** migration today: `actionPointBudget`
  holds a stale `3` (or `360`) but is reset to `DAY_MINUTES` at the next
  `startDay`, and `applied[]` is empty between days. The only visible
  artefact is a just-closed day's owner-action report showing tiny
  durations for a save written under the old model — harmless.

### Web no longer duplicates the budget constant

`web/src/lib/sim/actionBuilder.ts` previously hardcoded its own
`ACTION_POINT_BUDGET = 3`, a latent second source of truth. It now imports
`DAY_MINUTES` from the sim `stateHelpers` and re-exports it, so the UI cap
can never drift from the engine's gate. `ACTION_POINT_BUDGET` is gone
everywhere; the web budget identifier is `DAY_MINUTES`, the queued-time
getter is `gameStore.minutesQueued`, and the pure summer is
`totalQueuedMinutes`. (Internal locals like `pointsLeft` were left as-is —
they hold minutes; renaming them buys nothing.)

### Glossary

The `action_point` / `action_points` terms were repurposed to "Owner Time"
(minutes), and `queued_action` / `on_menu` / `project_progress` /
`history_owner_action` lost their "action point" wording. Term **ids** were
kept so `TermLabel term="action_points"` references keep resolving.

### Files touched in Cluster 3

- `src/sim/modules/ownerActions/stateHelpers.ts` — `DAY_MINUTES`, the five
  `TIME_COST_*` tiers, `formatDuration`.
- `ownerActionsModule.ts` — gate constant, report line ("Time Spent:
  …"), validation message, comments.
- `actionDefinitions.ts`, `staffManagementActions.ts`, `socialActions.ts`,
  `projectActions.ts`, `policyActions.ts`, `commissionExpedition.ts`,
  `testing/expansions/candleShortage.ts` — per-action minute costs.
- `types.ts`, `core/context.ts` — field/param doc comments (minutes).
- `src/reports/{worldOverview,tavernOverview}Projection.ts` — import
  `DAY_MINUTES`; `src/reports/glossary.ts` — term rewording.
- web: `actionBuilder.ts`, `gameStore.svelte.ts`, `ActionPicker.svelte`,
  `ActionQueueChip.svelte`, `QuickActions.svelte`, `DailyReport.svelte`.
- tests: `phase13.ownerActions`, `phase92.toggleRecipeMenu`,
  `phase90.queueValidity`, `policyToggleRows`.

---

## Cluster 4 — what shipped (periodic-choice re-homing)

The choice-bearing periodic seeds (`debt_rent`, `monthly_review`) moved from
the **closing deck** to the **morning pause** (contract §3.5), and the
generation that backs them moved with them — they are now *produced* in the
morning pass, so under the Cluster-5 segment flow they will genuinely exist
at the morning pause and not only "display there."

### The taxonomy split: generation pass decoupled from render timing

The load-bearing realization: a seed's `timing` field is used by the **card
layer** (`appliesTo.timings` template matching, salience, voice) *and* by the
engine to pick the generation pass. Cluster 1's table conflated the two.
Retagging `debt_rent`/`monthly_review` from `end_month` → `morning_prep`
would have cascaded into ~2 card templates' `appliesTo.timings` and ~20 test
fixtures that assert `timing: 'end_month'`. So instead we **split the
taxonomy at the generator, not the seed**:

- New optional field `IssueSeedGenerator.generateWith?: IssueSeedTiming[]`
  (`issueSeedRegistry.ts`) — the *generation pass(es)*, defaulting to the
  generator's render `timing`. `runGenerationPass` now selects by
  `(g.generateWith ?? g.timing)`.
- `debt_rent_pressure` and `monthly_review` set
  `generateWith: ['morning_prep']` while keeping `timing: ['end_month']`. The
  emitted seed still carries `timing: 'end_month'`, so **the entire card
  layer and its tests are untouched.**
- The pass's seed-match guard changed from "seed timing ∈ pass timings" to
  "seed timing ∈ `generator.timing`" — it now verifies a generator only
  emits seeds of a timing it *declares*, which is the real invariant once
  generation pass and render timing are decoupled.

| Seed | render `timing` (card) | `generateWith` (pass) | Generated at |
| --- | --- | --- | --- |
| `debt_rent` | `end_month` | `morning_prep` | `startDay` (daily, on condition) |
| `monthly_review` | `end_month` | `morning_prep` | `startDay`, first morning of the new month |

### Generation-timing behaviour changes (the two that bite tests)

- **`debt_rent` now has a one-day warm-up lag.** Produced at `startDay`, it
  reads the **prior** day's closing pressure snapshot (the standing debt
  condition known at sunrise, §3.1) — exactly like every other
  `morning_prep` family. A single `runDay` from a hand-set base no longer
  fires it; use the `seedDay` (warm-one-day) idiom. Tests updated:
  `phase19.issueSeeds` (→ `seedDay`), `phase61.rentDueSoon` (warm-up, then
  override the `rent_due_soon` tag on the warmed state so the snapshot is
  shared and only the live tag differs).
- **`monthly_review` fires on the first morning of the *next* month**
  (`calendar.day === 1` + persisted `lastMonthlyResult`), not at `endMonth`
  on day 28. Its contradiction guard (`contradictionGuards.ts`) was rewritten
  from `isEndOfMonth()` to that pair. **This is the proper fix for the
  Cluster-1 "monthly_review can't resolve same-day" limitation** — it now
  resolves at that morning's pause like any other morning seed. The monthly
  *digest* (the `'monthly'` report section, projected as `monthlyDigest`)
  still builds at `endMonth` and lands in the **day-28 report**, so the
  §3.5 split is honoured: read-only digest in the month-end aftermath,
  actionable review the next morning.

### The closing-pass scaffold is simplified

Cluster 1 ran the periodic timings in **both** the `closing` pass and the
`endWeek`/`endMonth` passes with id-dedupe to give `debt_rent` a daily
cadence and `monthly_review` its post-rollup read. That dual-pass is gone:
the `closing` hook now runs `['closing']` only. The `endWeek`/`endMonth`
hooks are **retained but currently select no generator** (nothing has those
in `generateWith`/`timing` any more) — kept as the opt-in home for a *future*
boundary-rollup seed that truly cannot be read before its rollup settles.
The id-dedupe inside `runGenerationPass` stays as cheap idempotency
insurance but is no longer load-bearing.

### UI re-homing (`DayScreen.svelte`)

- Morning beat seeds = `todaysSeeds.filter(timing ∈ {morning_prep, end_week,
  end_month})`. Filtering the already-rank-sorted `todaysSeeds` (rather than
  concatenating per-timing slices) keeps morning cards in **global** rank, so
  a high-severity `debt_rent` is not buried beneath low-severity standing
  conditions.
- Closing beat seeds = `seedsForTiming('closing')` only (was `closing +
  end_week + end_month`).
- The **informational** half of §3.5 needed no work: weekly/monthly digests
  are already read-only report sections (`DailyReport.svelte` renders
  `weeklyDigest`/`monthlyDigest`); no periodic *seed* is informational-only.

### ⏭️ For Cluster 5 (store / UI flow)

- The morning-pause routing is now **generation-backed**: `debt_rent` and
  `monthly_review` are produced in Segment A (`startDay`), so they exist by
  the time the morning beat renders. Drive the segments and the morning beat
  will show them with no extra plumbing.
- `monthly_review` is now resolvable **same-day** at the morning pause —
  Cluster 5's same-day response flow should treat it like any morning seed.

### ⏭️ For Cluster 7 (in-flight save migration)

- A save written under the pre-Cluster-4 model can carry `debt_rent` /
  `monthly_review` seeds in `seedsToday` that the old UI showed in the
  *closing* deck. Post-update they route to the morning beat instead (purely
  a render change; ids and resolution are unchanged). No state migration is
  required for this — `startDay` regenerates the surface — but the in-flight
  day a player updates *during* will reshuffle which beat its periodic cards
  appear under. Fold this into the "finish under old rules or reset to next
  morning" decision Cluster 7 already owns.

## Cluster 5 — what shipped (store / UI flow integration)

The web layer now drives the day as the **three real engine segments**
instead of one end-of-day `simulateDay`. This is the fix for the
interim breakage Cluster 1 flagged: the old `runDay` resolved the
player's responses against the *previous* day's seeds (which `startDay`
now clears + regenerates) and silently no-op'd. Responses are now
produced and resolved within the same day.

### The store API (`gameStore.svelte.ts`)

`simulateDay` is gone from the store; it calls `advanceDaySegment`
(Cluster 2). Three guarded segment methods plus a run-all convenience:

| Method | Segment | Runs phases | Guard (only acts when) |
| --- | --- | --- | --- |
| `beginDay()` | A | `startDay … forecastTraffic` | `segment === 'C'` |
| `runService(extra)` | B | `beforeOwnerActions … closing` | `segment === 'A'` |
| `endDay(extra)` | C | `applyResponses … advanceCalendar` | `segment === 'B'` |
| `runDay(extra)` | A→B→C | full day | — (composes the three) |

- The **guards make the methods idempotent**: a stray repeat (an effect
  firing twice, a double tap) is a no-op, so a day can't double-open or
  double-close. `runDay` composes the three guarded calls, so calling it
  mid-day *finishes* the in-progress day rather than starting a new one —
  which is what keeps the old `runDay`-based tests (reportsScreen,
  cardless callers) working unchanged.
- **`segment` is the position field** added to `DaySessionSnapshot`
  (`daySession.ts`), persisted. Values `'A' | 'B' | 'C'`; `'C'` doubles
  as the "ready to begin the next day" state (so `reset()` and a closed
  day share one resume rule). Kept in lock-step with `beat` — the
  (beat, segment) pair is always written together, so resume never
  stalls on a disagreement.
- **`dayBaseline`** (a `TavernState` store field) holds the start-of-day
  snapshot and is threaded as `advanceDaySegment(..., { dayBaseline })`
  into B and C so the daily report keeps reading one full-day diff across
  the three per-segment runtimes (**GATE B**). ⚠️ **A `$state`-stored
  TavernState is re-proxied by Svelte**, and the engine's
  `structuredClone` rejects the proxy in jsdom — read it back through
  `$state.snapshot` before handing it to the engine (`dayBaselineSnapshot`).
  Same hazard applies to any future TavernState held in `$state`.
- **Logs accumulate across segments** in an in-memory `dayLogs`; `endDay`
  prepends A+B's logs to C's for `latestResult.logs`. A mid-day refresh
  loses A/B logs (cosmetic — only the debug-bundle log count).
- **Picks are consumed by Segment B**, not end-of-day. `runService`
  drains the queue; `beginDay` does NOT (a player can queue from the
  Tavern surfaces before the plan beat, and those carry into the day's
  Segment B). `pendingBySeedId` + the deck-complete flags reset in
  `beginDay`.

### Persistence (`persistence.ts`)

- `PersistedSession` gains optional `dayBaseline?: TavernState`,
  serialized **only while a day is in progress** (`segment` 'A'/'B') to
  avoid bloating closed-day saves with a stale state copy. It runs
  through the **same migration + validation pipeline as `state`** —
  extracted into a shared `migrateAndValidateState` helper — and is
  dropped (with a console.warn) if it fails.
- `sanitizeDaySession` derives `segment` from `beat` when the field is
  absent, so a **pre-Cluster-5 save** (no segment) resumes at a
  consistent position (morning/plan→A, service/closing→B, report→C).

### DayScreen (`DayScreen.svelte`)

- The five beats now **bracket the segments**: opening the morning runs
  Segment A (via a `$effect` that calls `beginDay` when
  `beat === 'morning' && segment === 'C'`, `untrack`-wrapped so the
  engine's state writes don't re-fire it); "Run service" runs Segment B;
  "End day" runs Segment C. `nextDay` just sets `beat = 'morning'` and
  lets the effect open the new day. `App.startGame` calls `beginDay`
  once up front to avoid a first-frame flash (effect is the safety net).
- **Forecast-as-expected** (contract §3.6) added to the morning glance:
  the summed `customers.forecasts[].expected`, framed "~N guests expected
  · before your moves." This is newly *honest* only because Segment A
  now runs before the morning — pre-Cluster-5 the morning showed the
  prior day's forecast.
- **Quick Day** is now honest about emergence: it runs Segment B and, if
  service surfaced any `during_service`/`closing` seeds, drops the player
  into the service beat instead of burying them; otherwise it runs
  Segment C to the report.
- Swept two stale Cluster-3 display strings in the touched file: the
  plan-beat lede ("up to 3 owner actions" → time framing) and the queued
  pick cost (`{actionPointCost} pt` → `formatDuration(...)`, since that
  field now holds minutes).

### ⏭️ For Cluster 6 (report-as-unfolding)

- `latestResult` for the report is the **Segment-C** `SimResult`: its
  `diffs` carry the full-day diff, its `reports` carry every section
  (all report sections are built in `generateReports`, which lives in C,
  reading the final state — so B's owner-action/service/pressure data is
  present). `previousCalendar` is the start-of-day calendar captured at
  `beginDay`, so the report still labels the day it closes.
- The segments are real now, so "narrate what happened across the
  segments" has genuine per-segment boundaries to lean on if wanted
  (A's logs vs B's logs vs C's logs are separable before `endDay`
  concatenates them).

### ⏭️ For Cluster 7 (in-flight save migration)

- The interim breakage Cluster 1 described is **resolved** for
  Cluster-5+ saves. The remaining migration concern is a **pre-Cluster-5
  save resumed mid-day**: `sanitizeDaySession` derives a `segment` from
  the beat, which keeps the flow functional, but such a save's
  `seedsToday` was generated by the *old* end-of-day model and its state
  never had this day's Segment A run. Resuming it at morning/plan and
  then running Segment B skips Segment A's setup for that one day.
  Cluster 7 owns the proper "finish under old rules or reset to next
  morning" ruling (contract §4.7). The `actionPoint*` serialized-field
  rename (Cluster 3 naming debt) still belongs to Cluster 7 too.
- The new `dayBaseline` envelope field is additive and optional — old
  saves load fine without it; the segment methods fall back to the
  current state (one resumed day's report carries a Segment-C-only diff
  in that fallback, the documented edge).

### One card surface (scope note)

Card *placement* is now singular and honest via the segments: foreseeable
standing conditions + periodic choices in the morning (Segment A),
emergent events only once service runs (Segment B), aftermath in the
report (Segment C). The two rendering *components* are intentionally kept
distinct and were **not** merged: `CardRenderer` is the morning
review-list (all cards visible, per-card pending state), `CardDeck` is
the service/closing swipe-through react deck. That split is a UX choice
(review vs react), not the "inconsistent placement" problem the contract
named — which was pre-baked seeds shown at arbitrary beats, and which the
segmented flow removes.

### Files touched in Cluster 5

- `web/src/lib/sim/daySession.ts` — `DaySegment` type; `segment` on
  `DaySessionSnapshot` + `INITIAL_DAY_SESSION`.
- `web/src/lib/sim/gameStore.svelte.ts` — `beginDay`/`runService`/`endDay`
  segment methods, `runDay` recomposed, `segment`/`dayBaseline`/`dayLogs`
  fields, `dayInput`/`snapshotState`/`dayBaselineSnapshot` helpers,
  reset/hydrate/serialize updates.
- `web/src/lib/sim/persistence.ts` — `dayBaseline` envelope field +
  validation, `migrateAndValidateState` extraction, `sanitizeSegment`.
- `web/src/lib/screens/DayScreen.svelte` — begin-day effect, segment-
  driven handlers, forecast-as-expected, Quick Day emergence, stale-copy
  sweep, plan-beat run-error banner.
- `web/src/App.svelte` — `startGame` opens day one; `segment` in the
  autosave deps.
- tests: `tests/web/phase186.daySegments.test.ts` (new — store flow,
  GATE B, mid-day resume, old-save derivation), rewrote
  `tests/web/components/dayScreen.test.ts` and
  `tests/web/components/crossScreen.flow.test.ts` for the segmented flow.

---

### Files touched in Cluster 4

- `src/sim/modules/issues/issueSeedRegistry.ts` — `generateWith` field.
- `src/sim/modules/issues/issueSeedModule.ts` — pass selection via
  `generateWith ?? timing`; seed-match guard checks `generator.timing`;
  `closing` hook → `['closing']`; doc/comments.
- `src/sim/modules/issues/issueSeedGenerators.ts` — `generateWith:
  ['morning_prep']` on `debt_rent_pressure` and `monthly_review`.
- `src/sim/modules/issues/contradictionGuards.ts` — `monthly_review` guard
  (`lastMonthlyResult` + `calendar.day === 1`).
- web: `web/src/lib/screens/DayScreen.svelte` — morning/closing seed slices
  + header comment.
- tests: `phase19.issueSeeds` (debt_rent → `seedDay`), `phase59.monthlyReview`
  (`advanceToMonthlyReview` = 29 days; the unpaid-rent case runs one extra
  day; comments), `phase61.rentDueSoon` (debt_rent warm-up),
  `phase91.monthlyPersistence` (the day-1 test re-framed: a problem-free
  tavern has nothing to review), `triggeringStates` +
  `cards/compose/gates/realSeedShapes` (stale month-end comments; the
  built-in capture warm-up already lands monthly_review on day 29).

## Cluster 6 — what shipped (report-as-unfolding)

The daily report now narrates the day as the **three real engine
segments** instead of one flat end-of-day "What happened" lump. The
report's narrative spine is a new ordered **day arc** (contract §4.6):

| Movement | id | Source lines | Engine moment |
| --- | --- | --- | --- |
| You set the day in motion | `opening` | `ownerActionsApplied` | Segment B `applyOwnerActions` |
| Service ran | `service` | `serviceLines` | Segment B service resolution |
| You answered the day | `reckoning` | `resolvedIntents` | Segment C `applyResponses` |

### The load-bearing design choice: re-home, don't re-derive

The arc is built **from the already-projected rich lines**
(`ownerActionsApplied` / `serviceLines` / `resolvedIntents`), not from a
fresh read of state or diffs. `projectDayArc` runs *after* those three
projectors and maps each into a `DayArcEntry` discriminated union. This
keeps the Core Design Rule intact — the report invents **zero** new
facts; it only **orders and frames** what the projection already derived
from the sim. A test (`phase186.dayArc.test.ts`) asserts the arc entries
are `.toEqual` the flat fields, so the two can never drift.

- **The flat fields are retained**, not removed. `ownerActionsApplied` /
  `serviceLines` / `resolvedIntents` stay on `DailyReportData` because
  (a) snapshot stability and (b) `projectYesterdayDigest` and other
  non-narrative consumers read them. The arc is **additive** — a new
  `dayArc: DayArcMovement[]` field. The old "What happened" block in
  `DailyReport.svelte` was **replaced** by the per-movement rendering
  (the flat fields are no longer rendered there, but the data remains).
- **Empty movements are omitted.** A movement with no source entries is
  not pushed, so a quiet day shows a short arc (or none) rather than
  empty headings. `isQuiet` is unchanged — still computed from the flat
  fields, so the quiet-line path is untouched.

### Voice: a new connective pool, plus a now-reachable header snippet

- New compose section `daily.arc` (`src/reports/compose/sections/dayArc.ts`)
  + pool `report.daily.arc.line` (`src/reports/compose/pools/dayArc/`).
  One optional `aside` slot, `tavern_floor` register, ≤ 8 words. Three
  snippets per movement, each gated on a single `hasTag` of the movement
  id (**data conditions, not closures** — framework §2.3; this was the
  one mistake to avoid). Keyed `d{closedDay}.{movementId}` so the same
  movement on the same day reads the same connective across rebuilds.
  Connector-only: the figures stay structural in the entry lines.
- ⚠️ **`composeDailyHeaderLine` gained its `isHeavyDay` argument for
  real.** The header pool has shipped a `hdr_heavy_day` snippet gated on
  `heavy_day` since Phase 141, but **no caller ever passed
  `isHeavyDay`**, so it was unreachable dead content. Cluster 6 computes
  `isHeavyDay` in `buildDailyReport` (≥3 owner-actions+intents, or ≥6
  top diffs) and threads it through `buildHeader`. This **changes header
  voice on busy days** — deterministically, and only toward a snippet
  that was always meant to be reachable. No test asserted a specific
  header string, so the suite stayed green.

### Report ordering changed (digests moved to the coda)

The weekly/monthly digests **moved from the top of the report to the
bottom** (`DailyReport.svelte`). The day's own story reads first; the
longer-horizon zoom-out closes it. This honours the §3.5 split
(digests are read-only aftermath; choice-bearing periodic seeds already
surface at the morning pause via Cluster 4) and reads as a natural
narrative wind-down. Purely a render reordering — no projection change.

### ⏭️ For Cluster 7 (in-flight save migration)

- `dayArc` is a **pure projection field**, recomputed from
  `latestResult` + `state` on every render — it is **never persisted**.
  A pre-Cluster-6 save loads and renders fine: the next `buildDailyReport`
  produces the arc. No migration is required for the report layer.
- The flat `actionPointCost` field on `ReportOwnerActionLine` still holds
  **minutes** (Cluster 3 naming debt); the arc's `owner_action` entries
  carry the same field unchanged, so the Cluster-7 rename covers both.

### Files touched in Cluster 6

- `src/reports/types.ts` — `DayArcMovementId`, `DayArcEntry`,
  `DayArcMovement`; `dayArc` on `DailyReportData`.
- `src/reports/dailyReportProjection.ts` — `projectDayArc` + `arcVoice`;
  `isHeavyDay` computation; `buildHeader` gains `isHeavyDay` param.
- `src/reports/compose/sections/dayArc.ts` (new),
  `src/reports/compose/pools/dayArc/{index,line}.ts` (new),
  `src/reports/compose/sections/index.ts` (re-export).
- `src/reports/index.ts` — export the three new arc types.
- web: `web/src/lib/components/DailyReport.svelte` — render the arc as the
  report's spine, replace the flat "What happened" block, move digests to
  the coda, `arc-voice` style + `arcEntryKey` helper.
- tests: `tests/reports/phase186.dayArc.test.ts` (new — order, entry
  re-homing equivalence, empty-movement omission, voice routing +
  determinism, purity); `tests/reports/yesterdayDigest.test.ts` (fixture
  gains `dayArc: []`).

## Cluster 7 — what shipped (in-flight save migration + owner-time rename)

Cluster 7 closes the arc: it pays the Cluster-3 naming debt and adds the
two save migrations the earlier clusters deferred to it.

### 1. The owner-time field rename (`actionPoint* → time*`)

Cluster 3 converted the owner action-point economy to a minutes budget but
left the **serialized** fields named `actionPoint*` to avoid forcing a save
migration mid-arc. Cluster 7 owns the migration, so the rename landed:

| Old (pre-Cluster-7) | New | Where |
| --- | --- | --- |
| `actionPointsUsed` | `timeSpent` | `OwnerActionsModuleState` (serialized) |
| `actionPointBudget` | `timeBudget` | `OwnerActionsModuleState` (serialized) |
| `actionPointCost` | `timeCost` | `OwnerActionApplied` (serialized in `applied[]`), web `PickedAction` (serialized in `picks[]`), `OwnerActionDefinition` (registry, not serialized), `ReportOwnerActionLine` + `ApplicableActionRef` (projections, not serialized) |

The rename is **codebase-wide**, not just the four serialized fields the
Cluster-3 note named: the registry `OwnerActionDefinition.timeCost` and the
report projections were renamed too, so nothing reads "minutes" under an
`actionPoint*` name any more. The `TIME_COST_*` tiers and `DAY_MINUTES` were
already in place from Cluster 3 and were untouched.

### 2. `ensureOwnerTimeFields` — the schema migration

`src/sim/state/migrations.ts` gained `ensureOwnerTimeFields`, wired into the
`migrateAndValidateState` chain in `web/src/lib/sim/persistence.ts` **before
`safeValidateState`** (between `ensureMonthlyHistoryField` and
`ensureCastAttributes`). It renames the `actionPoint*` keys on the
`ownerActions` module slice — including each `applied[]` entry's
`actionPointCost` — so a pre-Cluster-7 save validates against the now
`time*`-keyed Zod schema instead of bouncing as `invalid`. Additive and
idempotent (a no-op once the new keys are present), matching every other
`ensure*` helper.

- **Magnitudes are carried verbatim, NOT scaled.** A pre-Cluster-3 save
  holds raw action-point counts (`actionPointsUsed: 1`, `actionPointBudget:
  3`). Cosmetic only — `startDay` resets the daily fields to `0` /
  `DAY_MINUTES` the next morning and `applied[]` is empty between days, so
  the lone visible artefact is a just-closed day's owner-action report
  showing tiny durations for a save written under the old AP model.
- The web pick sanitiser (`sanitizeSinglePick`, `actionBuilder.ts`) reads
  `r.timeCost ?? r.actionPointCost` so a pre-Cluster-7 save's **queued
  picks** survive the hydration boundary instead of being silently dropped.

### 3. The in-flight day reset (contract §4.7)

A save written before Cluster 5 carries **no `segment` field** and a
`seedsToday` pre-baked by the old end-of-day model. Cluster 5's interim
`sanitizeSegment` derived a segment from the beat
(morning→C, plan→A, service/closing→B, report→C). The hazard is the beats
that derive to **A or B**: the store then believes Segment A already ran for
that day, so `beginDay` is skipped and the day plays on against the stale
pre-baked surface (skipped world advance, orphaned response intents).

Cluster 7 replaces the derivation for those beats with the §4.7 ruling:
**reset cleanly to the next morning.** `restoreDaySession` (replacing
`sanitizeDaySession` in `persistence.ts`) detects the legacy case (`segment`
absent) and, for a beat in `{plan, service, closing}`, resets to
`{ beat: 'morning', segment: 'C' }` (the "ready to begin" state). `beginDay`
(Segment A) then re-opens the day on the (start-of-day) state and
regenerates today's surface honestly. The day's **pending response intents
are dropped** (they reference pre-baked seed ids the regeneration clears)
and the **start-of-day `dayBaseline` is dropped** (`beginDay` mints a fresh
one). **Queued owner-action `picks` are kept** — Segment B consumes them.

- **`morning` and `report` are NOT reset.** Both already derive to segment
  `'C'` (the clean day boundary), where `beginDay` runs Segment A fresh
  anyway — no Segment A is skipped, so there is nothing to repair and any
  pending survives the round-trip. (This is the key correction over a first
  cut that also reset `morning`: a no-segment `morning` save is the *clean*
  pre-day boundary, not a mid-day one, and the existing persistence
  round-trip test asserts pending is preserved there.)
- A **Cluster-5+ save** (explicit `segment` present) is trusted as-is; no
  reset, mid-day position preserved.

Why "reset" not "finish under old rules": the old end-of-day model is gone
(it is now the three segments), and a pre-Cluster-5 mid-day save's state is
always start-of-day (nothing resolved until the old `runDay`). Re-running
Segment A on that state is exactly correct and loses nothing the player
committed.

### Determinism / consumer notes

- The report `data` payload keys (`timeSpent`/`timeBudget`/`applied[].timeCost`
  in the `ownerActions` section) were renamed with everything else. An OLD
  `latestResultLite` loaded from a pre-Cluster-7 save still carries the old
  keys; `projectOwnerActions` now reads `a.timeCost` → `undefined` for that
  one resumed day's already-closed report, so `DailyReport.svelte`'s
  `timeCost > 0` guard just omits the cost tag. Cosmetic, one day, by design —
  `latestResultLite` is recomputed the next day and is never schema-validated.
- No engine behaviour changed — the budget gate, costs, and `DAY_MINUTES`
  are byte-identical to Cluster 3; only identifiers moved.

### Files touched in Cluster 7

- `src/sim/state/migrations.ts` — `ensureOwnerTimeFields` + `OWNER_ACTIONS_MODULE_ID` import.
- `src/sim/modules/ownerActions/{types,stateHelpers,ownerActionsModule,actionDefinitions,staffManagementActions,socialActions,projectActions,policyActions,readonlyHelpers}.ts` — field rename + comment rewrites (the stale "rename deferred to Cluster 7" notes are gone).
- `src/sim/modules/expeditions/commissionExpedition.ts`, `src/sim/testing/expansions/candleShortage.ts` — field rename.
- `src/reports/{types,dailyReportProjection,tavernOverviewProjection,worldOverviewProjection}.ts` — field rename (`ReportOwnerActionLine.timeCost`, `ApplicableActionRef.timeCost`).
- web: `actionBuilder.ts` (rename + legacy-key acceptance in `sanitizeSinglePick`), `gameStore.svelte.ts`, `persistence.ts` (`ensureOwnerTimeFields` in the chain, `restoreDaySession` + in-flight reset, pending/baseline drop), `DayScreen.svelte`, `ActionPicker.svelte`, `DailyReport.svelte`, `tavern/{ProjectsPanel,QuickActions,CommissionExpeditionSheet,RecipesPanel}.svelte`.
- tests: `tests/web/phase186.cluster7Migration.test.ts` (new — `ensureOwnerTimeFields`, legacy-save load, legacy pick key, the mid-day reset across plan/service/closing, morning/report no-reset, Cluster-5+ trust); field renames across `phase{5,13,37,92}`, `missedOpportunityProjection`, `tavern/worldOverviewProjection`, `crossScreen.flow`, `persistence`, `phase89.persistenceSafety`, `policyToggleRows`; `phase186.daySegments` updated (its "derive B from a service beat" assertion became "report beat resumes at C", since a no-segment service beat now resets).
