# Phase 206 — Audit Wave 7: balance and whole experience

Plan for Wave 7 of the 2026-07-26 gameplay-audit remediation arc
(ISSUE-166). Queue:
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`.
Scope: Phase 8 §7 (Wave 7), §9 (design register), §11.4 (balance gate).

Wave 7 has **no findings**. Its deliverable is a set of numbers and a
verdict drawn from them. That inverts the risk of every earlier wave: the
thing most likely to be wrong is not the simulation but the instrument, so
this phase begins with the instrument and does not begin the verdict until
the instrument is calibrated against evidence that already exists.

**Status: CLOSED 2026-07-28.** The framework landed first (PR #242); the
balance pass followed in the same wave — §5's decisions were taken (the
user delegated them; recorded in the queue's Wave 7 section with anchors),
the ten Codex review findings on the instrument were fixed before any
number was trusted, five evidence-backed tuning changes landed
(recurrence cap, rumour decay, attribution narrative merge, Segment-A
snapshot sync, visible-turn rotation), and the 360-cell sweep's verdict,
residual gaps, and the Day-29+ route evidence are recorded in
`REMEDIATION_QUEUE.md` under Wave 7. This document remains as the
framework's design record; §§5–7 below describe the state *before* the
pass ran.

---

## 1. Why the existing harnesses could not do this

| Harness | What it does | Why Wave 7 needs more |
|---|---|---|
| `balanceRuns.runStrategy` / `runStrategyMatrix` (Phase 20) | Eight bots through `simulateDay`, owner actions only | **No run it has ever produced answered a card.** `simulateDay` takes the whole day's input up front, so a response has to be chosen before Service resolves — which is not a decision a player can make |
| `strategyComparison.buildStrategyComparison` | Distinct identities / customer groups / coin spread | Proves *differentiation*, which Phase 7 §5.2 already granted. Says nothing about balance |
| `fixtures/phase7-whole-experience-probes.ts` | Segmented A→B→C run **with** responses | One seed, one difficulty, one response policy, a bespoke row shape, and eight 28-day histories held in memory at once. A script, not a comparable instrument |
| `tests/sim/phase200.wave1.strategyMatrix.test.ts` | Per-day §8.2 invariants over eight strategies | The right invariants, but on the owner-actions-only route |

Phase 8 §7 asks for eight strategies × three difficulties × five
action/response variants, and Phase 7 §5.2 says a single seed cannot
support a balance claim. Nothing above spans that.

## 2. What was built

### `src/sim/testing/balanceHarness.ts`

One scenario runner. Drives the real segmented day —

```
A  Morning        the morning hand is generated
B  Plan + Service owner actions are queued, Service resolves
C  React + Close  cards are answered from POST-SERVICE state
```

— which is what makes a response variant a real strategy rather than a
scripted guess. Two levers (`ownerActions: 'none' | 'bot'`,
`responses: 'none' | 'all' | 'partial'`), three difficulties, any seed.

Emits `BalanceDayObservation` per day and one `BalanceRunMetrics` row per
run, covering every axis Phase 8 §7 names — cash, patrons, satisfaction,
staff, areas, stock, pressures, delayed obligations — plus identity axes,
the `DC-06` decision-load dimensions, and per-day invariant results. No
`TavernState` snapshots are retained: the audit fixture already hit the
memory ceiling holding eight 28-day histories, and a whole matrix has to
fit in one process.

Two deliberate constraints:

- **No card-layer import.** `src/sim` must not depend on `src/cards`, so
  decision load is priced with the sim's own `renderedChoiceCost` — an
  upper bound. Callers that may legally import the card layer pass
  `measureRenderedChoices` for the exact render. See §3.
- **No verdict.** What counts as "balanced" depends on `DC-03` and
  `DC-04`, which are unanswered. The harness measures; it never scores.

`coreStateInvariantFailures` is the Phase 8 §8.2 invariant check, moved
here out of the Wave 1 gate test so the Wave 1 gate and every Wave 7 cell
test **one** contract. Wave 7 must not be able to publish a "balanced"
run that Wave 1 would have called schema-invalid — that is precisely
Phase 7 §5.2's first limitation, where two strategies were ranked on data
taken after they had gone invalid.

### `src/sim/testing/balanceMatrix.ts`

The cross product, the seed aggregation, and an **objective-agnostic**
analysis layer. It answers only questions that hold under every candidate
`DC-03` objective:

- does any strategy lead on every outcome axis (**dominance** — a balance
  failure under any objective, because nothing trades off against it);
- does any strategy lead on none (**a dead strategy**);
- does acting beat not acting, and does answering cards beat ignoring them
  (**agency value** — `compareVariants`);
- do Easy / Standard / Hard order correctly
  (**`checkDifficultyMonotonicity`**);
- **is the seed-to-seed spread wider than the gap between the best and
  worst strategy?** If it is, the metric is reported as noisy and must not
  be ranked on. This is the direct answer to Phase 7 §5.2's second
  limitation.

Ties are never leads. `no_action` makes every strategy identical by
construction, and a non-strict comparison would crown whichever bot
happened to be listed first; that slice reports `allStrategiesTied`
instead.

When `DC-03`/`DC-04` are answered, **add a scoring layer on top of these
primitives — do not fold the objective into them.**

### `scripts/balance-matrix.ts` — `npm run balance:matrix`

The full sweep is 360 cells at ~6.7s each: ~33 minutes serially. A balance
pass nobody will wait for does not get run, so the driver shards across
worker processes.

```bash
# cost before committing
npm run balance:matrix -- --estimate --difficulties=all --variants=all --concurrency=4

# the full Wave 7 sweep (~8 min on 4 cores)
npm run balance:matrix -- --difficulties=all --variants=all --concurrency=4 \
  --render --format=md --out=/tmp/wave7-matrix.md

# re-measure the committed slice and diff it against the recorded baseline
npm run balance:matrix -- --variants=all --seeds=phase7-integrated-shared \
  --concurrency=4 --render \
  --baseline=docs/audits/2026-07-26-gameplay-audit/baselines/pre-wave7-standard.json
```

| Flag | Meaning |
|---|---|
| `--bots` `--difficulties` `--variants` `--seeds` `--days` | Comma lists, or `all` |
| `--concurrency=N` | Fork N workers. Shards split by *simulation group*, not by index |
| `--render` | Price decision load with the real card layer instead of the sim's upper bound |
| `--format=md\|json`, `--out=PATH`, `--compact` | Report or machine-readable baseline |
| `--baseline=PATH` | Diff this run's tracked metrics against a stored baseline |
| `--estimate` | Print cell count and projected runtime, run nothing |

`no_action` pulls no lever the bot controls, so all eight strategies share
one simulation; the driver runs it once and relabels the copies, and
shards keep those cells together. That is 360 cells from 297 simulations.

### `tests/sim/phase206.wave7.balanceHarness.test.ts` (18 tests, fast tier)

The instrument's own gate. Determinism, that each lever actually reaches
the run, invariant parity with Wave 1, matrix shape, tie handling — and
the load-bearing one:

## 3. Calibration — the harness reproduces published evidence exactly

Same route, same seed, same numbers as the audit and the Wave 6 gate:

| Figure | Source | Harness |
|---|---|---|
| Cards / day, passive 28-day route (avg · max) | Wave 6 gate: 3.46 · 5 | **3.46 · 5** |
| Longest family streak, same route | Wave 6 gate: 3 | **3** |
| Final coin, no-action route | Phase 7 §5.1: 1,043 | **1,043** |
| Patrons, no-action route | Phase 7 §5.1: 828 | **828** |
| Choices / day, same route | Wave 6 gate: 15.68 (real render) | **15.68 with `--render`**; 16.5 with the sim's upper bound |

The choice figure is the one place the two differ, and it differs in the
documented direction: `renderedChoiceCost` is an upper bound, so the
default over-reports slightly. **Never quote a choice count against the
24-button `DC-06` ceiling without `--render`**, and never mix the two
pricings in one comparison. The test asserts the bound relationship
(`≥ 15.68`, `≥ 439`) rather than equality so the rule cannot silently
invert.

Those assertions are the reason a Wave 7 number can be trusted: if the
harness ever drifts from the ceiling gate or the audit's own route, the
fast tier fails before anyone reads a balance table.

## 4. Recorded starting point

`docs/audits/2026-07-26-gameplay-audit/baselines/pre-wave7-standard.json`
— 40 cells: eight strategies × Standard × all five variants × the audit's
own seed `phase7-integrated-shared`, 28 days, `--render`. Generated on the
post-Wave-6 build so every Wave 7 tuning change has a "before" to diff
against.

**This is a calibration baseline, not the Wave 7 data set.** The full
sweep — three difficulties, three seeds — is Wave 7's own first step.

Five observations already fall out of it. None is a finding; each is
either evidence a design decision needs, or a question about a gate an
earlier wave closed.

### 4.1 The `DC-06` family-recurrence target holds only on routes that answer nothing

| Variant | Longest family streak (of 28 days) |
|---|---|
| No action | 3 (`customer_complaint`) |
| Owner actions only | 3 |
| Actions + every other response | 7–17 (`staff_identity`) |
| Actions + all responses | **17–26** (`staff_identity`) |
| Responses only | **22** (`staff_identity`) |

The approved target is two consecutive days, then a rest day. It is met on
the passive route and missed by an order of magnitude on every route that
answers cards.

The mechanism is the answered-thread exemption in
`issueThreads.shouldRestFamily` — a deliberate Wave 6 decision ("an issue
the player ANSWERED last time it appeared comes back, because a venture
being invested in on consecutive days is engagement, not noise"). Its
own code comment reasons that it *cannot* reopen the audit's streaks
because "the 25–27-day streaks were measured on a route that answered
nothing at all". That is exactly the gap: the exemption is only reachable
by answering, so the passive measurement that validated Wave 6 could never
have exercised it.

**This is a `DC-06` decision, not a defect** — the exemption is doing what
it was asked to do. Wave 7 must decide whether "engagement" should be
uncapped, capped at some number of consecutive days, or scoped to
long-horizon families (ventures, projects) rather than every family. Do
not change it silently: it is a pacing lever, and re-tuning it moves every
other number in this table.

### 4.2 Coin never becomes a constraint

`minCoin` equals the starting balance for **every** cell — no route on any
variant ever finished a day poorer than it opened the run. Over 28 days
the no-action route ends on 1,043 coin, while three managed routes end
*below* that (clean-focused 1,014, ignore-repairs 774, miner-focused with
actions only 725).

So on the current build, managing the tavern well can leave the player
poorer than ignoring it entirely, and there is no cash floor to hit either
way. This is the concrete evidence `DC-04` (failure and recovery contract)
needs, now measured on the post-Wave-6 build rather than the audit's.

### 4.3 Pressures are bimodal, so they carry little strategic signal

On the clean-focused full-response route, `rumour_pressure` sits at 100
for 21 of 28 days and `staff_loyalty_risk` for 11, while 8 of the 21
pressures end the month at 0. Every strategy on every variant spends
21–25 of 28 days with at least one pressure pinned at the ceiling.

A meter that is at 100 regardless of what the player does cannot
differentiate strategies. Wave 1 halved attribution weight and slowed
escalation; this is what the system looks like after that change, and it
still saturates.

### 4.4 The eight "strategies" are fewer than eight arms

- `auto_no_owner_actions` defines neither `chooseActions` nor
  `chooseResponse`, so it produces the identical run in all five variants.
  It is a passive control, not a ninth strategy.
- On the responses-only variant, `auto_clean_focused` and
  `auto_staff_friendly` produce **byte-identical rows** — both prefer
  `['safe_costly', 'long_term_investment']`, and with no owner actions
  nothing else distinguishes them.

The response-variant arm therefore has ~5 distinct policies, not 8. Wave 7
should either add distinct `chooseResponse` policies to the bots or state
the arm count in its evidence. Silently reporting eight would overstate
the sample.

### 4.5 The `DC-06` choice ceiling holds

With `--render`, `maxChoicesPerDay` is **24 on every one of the 40 cells**
— the hard ceiling met exactly and never exceeded, including on the
heaviest response routes. Wave 6's ceiling generalises off its measured
route even though its recurrence target does not.

## 5. Decisions required before the balance pass starts

Phase 8 §11.4 gates balance evaluation on "the intended objective /
failure / response-budget decisions are recorded". Three of those are
still open, and two of them determine what the matrix is *for*. **These
need answers from the user; an implementation guess is not a decision.**

| ID | Question | What it blocks | Evidence now available |
|---|---|---|---|
| `DC-03` | What organizes indefinite play — survival, identity, relationships, cash, reputation, arcs, self-authored goals? | The scoring layer, coaching ranking (Wave 2 left it objective-agnostic pending this), report emphasis, and what "balanced" means at all | §4.2, §4.3 — cash does not organize play today, and pressures cannot |
| `DC-04` | Should bankruptcy / eviction / staff departure / customer collapse / forced closure exist, and how are they communicated? | Whether "the no-action route stays solvent" is a defect or the design | §4.2 — no route ever dips below its opening balance |
| `DC-05` | Should audience leadership change within the first month? | Whether `local_goblins` remaining dominant everywhere is a finding | Every cell in the baseline still ends `local_goblins` dominant |
| `DC-06` (re-open) | Is the answered-thread exemption meant to be uncapped? | The recurrence half of the approved workload target | §4.1 |
| `DC-08` | Which long-horizon systems are intended as core first-month strategies? | Whether expeditions / ventures / arcs having near-zero first-month presence is a gap | Delayed obligations and arc families are measurable per cell |
| `DC-01` (`P2-OBS-001`) | Keep Quick Day as a route, or retire it? | Still open from the Decide-before-implementing table | Unchanged since Phase 2 |

`DC-09` (onboarding vs complete surface) and `DC-10` (supported
environments / persistence promise) are also open but do not gate the
balance pass; they gate the paused arcs behind it.

## 6. Order of work when Wave 7 starts

1. **Answer §5.** `DC-03` and `DC-04` first — the scoring layer cannot be
   written without them, and §4.2 is unreadable as good or bad until
   `DC-04` exists.
2. **Run the full sweep.** `--difficulties=all --variants=all --render`,
   three seeds, 28 days. ~8 min at `-c 4`. Record it beside the baseline.
3. **Check the instrument's own preconditions before reading the tables:**
   every cell trustworthy (no invariant failures), and the noisy-metric
   list empty for anything about to be ranked on. If a metric is noisy,
   add seeds rather than ranking anyway.
4. **Add the scoring layer** on top of `balanceMatrix`'s primitives, keyed
   on the `DC-03` answer. Do not modify the primitives.
5. **Re-run the human public route past Day 29** (Phase 8 §7's last
   requirement). This is the one part no harness covers: it is a
   comprehension check, not a measurement, and Phase 8 §11.4(5) requires
   it — "normal human play confirms that the corrected evidence is
   understandable."
6. **Re-assess every Phase 7 design question** (§9.1–§9.6) against the
   sweep, and record each answer in the queue under Wave 7.
7. **Tune, then re-diff against the baseline** so every movement is
   attributable. The queue's "Carried forward into Wave 7" table lists
   what earlier waves already moved; anything tuned against a build older
   than the wave named there is suspect.

## 7. What Wave 7 must not do

- **Do not tune the `DC-06` ceiling around the recurrence problem.** It is
  a tuned constant in `handBudget.ts`; §4.1 is a decision about
  `shouldRestFamily`, and the two are separate levers.
- **Do not rank a cell that failed an invariant.** The analysis excludes
  them; do not re-include them by reading the raw rows.
- **Do not compare a `--render` number against a default-priced one.**
- **Do not change local-arc age granularity in a projection.** The queue's
  open item is explicit: change it in `localArcsModule`'s tick or not at
  all, or `P4-SEAM-005` comes straight back.
- **Do not start the paused arcs.** Complete Surface, Progressive
  Onboarding and the standing tails resume after ISSUE-166 closes, and
  `DC-09` gates the onboarding one.

## 8. Files

| Path | Role |
|---|---|
| `src/sim/testing/balanceHarness.ts` | Scenario runner, per-day observations, run metrics, §8.2 invariants |
| `src/sim/testing/balanceMatrix.ts` | Variants, cross product, seed aggregation, objective-agnostic analysis |
| `scripts/balance-matrix.ts` | `npm run balance:matrix` — sharded driver, markdown/JSON, baseline diff |
| `tests/sim/phase206.wave7.balanceHarness.test.ts` | The instrument's gate, incl. calibration against Wave 6 and Phase 7 §5.1 |
| `docs/audits/.../baselines/pre-wave7-standard.json` | Recorded post-Wave-6 starting point, 40 cells |
| `tests/sim/phase200.wave1.strategyMatrix.test.ts` | Now imports the shared invariant check rather than its own copy |
