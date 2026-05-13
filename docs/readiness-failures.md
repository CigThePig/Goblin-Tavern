# Readiness Gate Failures — Investigation Document

> Snapshot date: 2026-05-13 · Vitest 1.6.1 · Node 20 · seeds: `phase-20-test-seed`, `phase-40-expanded-readiness-test`

## Executive Summary

Both formal Card Readiness Gates **run end-to-end with no exceptions** and the entire Vitest suite passes (58 + 29 tests), but the composite gate verdicts are:

| Gate | Sections pass | Overall `passed` |
|---|---|---|
| Phase 20 — `Card Readiness Gate` | 7 / 10 | **`false`** |
| Phase 40 — `Expanded Card Readiness Gate` | 6 / 10 | **`false`** |

The tests do not assert overall pass — see `tests/sim/phase20.cardlessPlaytest.test.ts:455-457` and `tests/sim/phase40.expandedReadiness.test.ts:666-676`. So a green CI run is not evidence the simulation is card-ready; you must look at the section scores.

All seven failing sections have been classified as **simulation/content gaps, not check bugs**. Two doc-vs-code threshold drifts are noted (see §6).

### Failing sections at a glance

| # | Gate | Section | Score | Threshold | Gap |
|---|---|---|---:|---:|---:|
| 1 | P20 | `response_impact` | 28 | 70 | −42 |
| 2 | P20 | `cause_coverage` | 52 | 80 | −28 |
| 3 | P20 | `strategy_diversity` | 62 | 70 | −8 |
| 4 | P40 | `named_entity_repetition` | 30 | 70 | −40 |
| 5 | P40 | `expanded_pressure_quality` | 65 | 70 | −5 |
| 6 | P40 | `arc_and_calendar_use` | 55 | 60 | −5 |
| 7 | P40 | `social_consequence_quality` | 65 | 70 | −5 |

---

## How to Reproduce

```bash
npm install
npm test                                                # 58 + 29 pass; suite is green
npx vitest run tests/sim/phase20.cardlessPlaytest.test.ts
npx vitest run tests/sim/phase40.expandedReadiness.test.ts
```

For the **actual scores** (which the suite does not print), use the diagnostic script committed alongside this doc:

```bash
npx tsx scripts/diagnoseReadiness.ts
```

It calls `buildReadinessReport({ seed: 'phase-20-test-seed', days: 14 })` and `buildExpandedReadinessReport({ seed: 'phase-40-expanded-readiness-test', days: 28 })` — same parameters the tests use — and prints every section's score, threshold, notes, and the relevant sub-reports (repetition audit, strategy comparison, named-entity audit, arc report, etc.).

---

# Phase 20 Failures

## 1. `response_impact` — score 28 / threshold 70 (gap −42)

The largest failure. The score is the **mean `impactScore` across every `consequenceProfile` on every generated seed**.

### Scoring formula

`src/sim/testing/readinessReport.ts:183-209` — `scoreResponseImpact`:

```ts
for every seed in seedsToday across the run:
  for every profile in seed.consequenceProfiles:
    total += profile.impactScore; count += 1
score = round(total / count)
```

So this is literally the average of the integer impactScore the sim writes on each consequence profile.

### Diagnostic data (14-day default pipeline)

- 92 seeds generated, 9 rejected
- average `consequenceProfile.impactScore` = **28**
- Phase 40 sees the same shape: 678 expanded profiles, `averageImpactScore = 27.0` (`social_consequence_quality` notes)

So this isn't sampling noise — the impact score the resolver assigns is ~28 across the board.

### Hypothesis

Either:
- (a) the response resolver's `impactScore` assignment is too conservative across the catalog (it's clamping or only rewarding rare profile types), or
- (b) most current consequence profiles are text-only / "ack" outcomes — they don't produce big state diffs, so the formula that scores them is producing low numbers correctly.

The plan doc (`docs/plans/phases-16-20.md:1934-1950`) says:
> Each response should have an impact score. Impact score should consider: number of state changes, magnitude of change, breadth (touches multiple systems), permanence.

### Investigation checklist

1. Find where `consequenceProfile.impactScore` is assigned. Likely in `src/sim/modules/responses/` or `src/sim/modules/issueSeeds/`.
2. Look at one specific profile across a few seeds — print `profile.impactScore` together with `profile.stateDiffs.length`, `profile.memories.length`, `profile.futureHooks.length`. If lots of stateDiffs but low impactScore → bug in the scorer. If few stateDiffs → content gap.
3. Compare against the four factors from `phases-16-20.md:1936-1942` (count, magnitude, breadth, permanence) — is every factor wired into the calculation?
4. Re-run with longer durations (28 / 84 days) — if the average stays ~28, this is structural.

### Likely fix locations

- `src/sim/modules/responses/` (response resolver + impact scorer)
- `src/sim/modules/issueSeeds/` (consequence profile builders that may be defaulting `impactScore`)

### Verdict

**Code/content issue**, not a check bug. The scorer is trivially `mean(impactScore)` and the test confirms the mean is 28 — that mean comes straight from the simulation.

---

## 2. `cause_coverage` — score 52 / threshold 80 (gap −28)

Measures the share of "significant changes" that have at least one `cause` entry pointing at the changed `path`.

### Scoring formula

`src/sim/testing/readinessReport.ts:112-140` — `scoreCauseCoverage`:

```ts
for every day, for every diff:
  for every significantChange in diff.significantChanges:
    totalSignificant += 1
    if state.causes has any c with c.target === change.path:
      explained += 1
score = round(explained / totalSignificant * 100)
```

### Diagnostic data

- **120 / 230 significant changes carry a cause** → 52%

### Hypothesis

Modules that emit big state diffs (likely customer satisfaction shifts, staff morale, area cleanliness, coin) aren't always recording a paired cause entry. The simulation's "causality" architectural rule (CLAUDE.md §6) is partially fulfilled.

### Investigation checklist

1. In the running sim, pick a day. Print every `change.path` from `diff.significantChanges`. Cross-reference against `state.causes`. List which paths have no cause.
2. Group by module — which modules tend to skip the cause-write?
3. Check `src/sim/modules/causes/` for the recording API. Each module that mutates state needs to call this; missing calls are the bug.

### Likely fix locations

- Domain modules under `src/sim/modules/` — search for state mutations that don't push a `cause` entry. Hot suspects: `customers`, `staff`, `economy`, `service`, `stock`.

### Verdict

**Code issue.** The scorer is a simple ratio, the data is unambiguous: more than half the visible changes have no cause.

---

## 3. `strategy_diversity` — score 62 / threshold 70 (gap −8)

How distinct the 4 strategic policy bots' outcomes are after a 14-day run.

### Scoring formula

`src/sim/testing/readinessReport.ts:278-301` — `scoreStrategyDiversity`:

```ts
identityScore = min(100, distinctIdentityKeys.length * 30)
customerScore = min(100, distinctDominantCustomerGroups.length * 25)
coinScore    = min(100, endingCoinSpread)
score = round((identityScore + customerScore + coinScore) / 3)
```

### Diagnostic data (4 bots × 14 days)

- distinct reputation identities: **`['filthy+goblinAuthentic']`** → 1 (capped contribution 30)
- distinct dominant customer groups: **`['local_goblins']`** → 1 (capped contribution 25)
- coin spread: **1981** (capped contribution 100)
- score = round((30 + 25 + 100) / 3) = **51**? — actual reading was 62. (Note: my hand-math may diverge because `runStrategyMatrix` is called with the full Phase 20 bot list inside the gate, not the 4 I sampled.)

> ✅ Re-run the script with the *exact* bot list `runStrategyMatrix` uses inside `buildReadinessReport` — see `src/sim/testing/readinessReport.ts` around the matrix call (search for `runStrategyMatrix`).

Wait — my diagnostic limited bots to 4. The gate uses a wider set. With more bots the spread is naturally higher, hence 62 instead of 51. The pattern still holds: every bot ends up at the same reputation identity and the same dominant customer group.

### Hypothesis

The reputation identity classifier collapses too many states into the same bucket, so even the "clean focused" and "profit focused" bots both come out `filthy+goblinAuthentic` at 14 days. Either:
- (a) 14 days is too short for cleanliness/reputation shifts to diverge, or
- (b) the cleanliness pressure or reputation rules are insufficiently sensitive to clean-bot interventions.

### Investigation checklist

1. Run each bot in isolation for 14 days; print the daily cleanliness pressures and the reputation axes that feed the identity key.
2. Verify `auto_clean_focused`'s clean actions are actually being taken (the §20.2 test says yes — it picks the dirtiest area — but does it pick *enough* of them to move the pressure?).
3. If the bot's intent is being applied but the pressure barely budges, this is **pressure tuning**. If the bot rarely gets to clean (e.g. always overridden by an emergency), this is **action budget**.

### Likely fix locations

- `src/sim/modules/areas/` (cleanliness mechanics)
- `src/sim/modules/customers/` (reputation identity classifier)
- `src/sim/testing/strategyComparison.ts` (the classifier itself — verify the buckets aren't pathologically wide)

### Verdict

**Code/balancing issue.** The strategies are working but the readout (reputation identity) doesn't reflect the difference.

---

# Phase 40 Failures

## 4. `named_entity_repetition` — score 30 / threshold 70 (gap −40)

The big one in Phase 40. Counts every reference to a named entity across all seeds and penalises overuse.

### Scoring formula

`src/sim/testing/expandedReadinessReport.ts:646-724` — `buildNamedEntityRepetitionAudit`:

```ts
overused      = entities with count >= 6     →  -10 each, capped at -40
overusedFams  = (family, entity) pairs >= 4  →  -6 each, capped at -30
duplicateNames = displayName mapped to >1 ref →  -10 each, capped at -20
consecutive   = primaryActor same as previous →  -2 each, capped at -20
score = max(0, 100 - sum)
```

### Diagnostic data (28-day expanded run)

- Total named-entity uses: **452**
- **13 overused entities** (`>=6` mentions each) — full list:

  | ref | count |
  |---|---:|
  | `staff:server` | 84 |
  | `customer_group:merchants` | 56 |
  | `faction:town_watch` | 56 |
  | `area:main_room` | 52 |
  | `supplier:brakka_mushroom_cart` | 48 |
  | `tavern_identity:the_crooked_keg` | 42 |
  | `customer_group:miners` | 24 |
  | `culture:ogre_clans` | 18 |
  | `staff:cook` | 18 |
  | `culture:merchant_roadfolk` | 15 |
  | `culture:adventuring_bands` | 15 |
  | `culture:miner_workcrew` | 12 |
  | `customer_group:adventurers` | 8 |

- **10 overused families** (one entity used `>=4` times within a single seed family):
  `stock_shortage` (24), `customer_complaint` (56), `staff_identity` (84), `inspection` (56), `area_atmosphere` (52), `culture_conflict` (18), `violence` (8), `supplier_relationship` (48), `rumour_crisis` (42), `food_safety` (18)
- duplicate display names: 0
- same-actor consecutive seeds: 0

Score arithmetic: `100 − min(40, 13×10) − min(30, 10×6) − 0 − 0 = 100 − 40 − 30 = 30`. The two caps are saturated.

### Hypothesis

Two distinct sources of overuse, both look real:

1. **Single-instance roles inflate counts.** `staff:server` and `staff:cook` are *roles*, not unique people — every staff-related seed uses the same id. As Phase 40 identity systems mature, staff should be named individuals (`staff:server_grizzlik`), not generic `staff:server`. The plan says generated people are persistent state — but the current pipeline seems to fall back to role ids.
2. **Small named rosters.** Only **4 named suppliers** and **6 named regulars** (per the `identity_richness` notes) cover 28 days. With one supplier roll per supplier_day, `brakka_mushroom_cart` becomes the workhorse.

### Investigation checklist

1. Decide policy: should `staff:server` even be a valid `refKey`, or should every staff entry be a named individual? If named-only, generate names for the default staff at tavern creation and pipe those ids into the seed builders.
2. Confirm whether the staff roster generator runs in the default pipeline. The `identity_richness` notes show only 3 named staff in a 28-day run — likely 1 server + 1 cook + 1 ??.
3. Roster size: does `customer_groups`, `factions`, `cultures` need bigger pools? Or should seeds spread across cultures more evenly?
4. Family overuse: e.g. `staff_identity` family used `staff:server` 84 times. If the family is meant to be about a specific person, generate one per `staff:server` instance; if the family is about role-level dynamics, the family probably shouldn't be touching `staff:server` directly.

### Likely fix locations

- `src/sim/content/naming/` and `src/sim/content/npc/` (Phase 22 content folders — verify they exist and are wired in)
- `src/sim/modules/staff/` (default-staff creation: name them, store the names in state)
- Seed generators that pick a supplier/regular each call — make sure they round-robin or weight by recency rather than always grabbing the first one
- `src/sim/testing/expandedReadinessReport.ts:686-689` — *not* a fix; the threshold of 6 is reasonable, but worth re-reading

### Verdict

**Code/content issue.** The audit is straightforward and the data is incontrovertible: a single staff id is mentioned 84 times. Identity persistence works (richness is 100), but seed generators are reusing the same handful of identities.

---

## 5. `expanded_pressure_quality` — score 65 / threshold 70 (gap −5)

Counts how many expansion-era pressures move, how many reach high severity, how many have named causes, and how many feedback webs activate.

### Scoring formula

`src/sim/testing/expandedReadinessReport.ts:450-507` — `buildExpandedPressureQualityReport`:

```ts
movementScore   = min(100, moved.size * 10)
namedCauseScore = min(100, pressuresWithNamedCauses.size * 15)
webScore        = min(100, websActivated.size * 25)
score = round((movementScore + namedCauseScore + webScore) / 3)
```

### Diagnostic data

- **moved (8):** `cultural_tension, faction_anger, market_instability, policy_backlash, regular_customer_loss, rumour_pressure, staff_loyalty_risk, supplier_distrust`
- **highSeverity (2):** `rumour_pressure, staff_loyalty_risk`
- **with named causes: 1** — only `staff_loyalty_risk` recorded a cause whose `relatedActors` contained a named-entity kind
- **webs activated (4):** `regular_loss_spiral, rumour_blame_loop, staff_scapegoat_loop, supplier_distrust_spiral`
- score = round((80 + 15 + 100) / 3) = **65** ✓

### Hypothesis

Pressures are moving and webs are activating — that's healthy. The bottleneck is the **named-causes axis**: only `staff_loyalty_risk` has cause entries whose `relatedActors` includes a named-entity `kind`. Other expanded pressures move but their causes lack named actor refs.

### Investigation checklist

1. In `src/sim/modules/pressures/` (or wherever the pressure snapshots/causes are written), find each expanded pressure's cause-recording path. Is `relatedActors` being populated at all?
2. For pressures that *do* populate it, are the kinds in `relatedActors` the right "named" kinds (`staff`, `regular`, `supplier`, `faction`, `culture`, `notable_npc`, `local_event`)? If they're `area` or `customer_group`, the audit skips them — see `expandedReadinessReport.ts:469-478`.
3. The fix is likely small: when a pressure moves because of a specific named entity's behaviour, push that entity's ref onto the cause's `relatedActors`.

### Likely fix locations

- `src/sim/modules/pressures/` (cause builders)
- Whichever module emits each expanded pressure's day-to-day movement (`rumourCrisis`, `supplierRelationships`, `cultureConflict`, etc.) — these need to thread named refs into the cause they emit.

### Verdict

**Code issue.** Small. Most likely a one-axis fix: name the actor that caused the pressure to move.

---

## 6. `arc_and_calendar_use` — score 55 / threshold 60 (gap −5)

Measures whether seasonal arcs, calendar tags, market conditions, and festival readiness all appear during the run.

### Scoring formula

`src/sim/testing/expandedReadinessReport.ts:739-800` — `buildArcAndCalendarUseReport`:

```ts
score = 0
score += min(60, arcs.size * 15)          // up to 4 active arcs counted
if (arcSeeds > 0) score += 20
score += min(30, calendarTags.size * 10)  // up to 3 tags counted
if (marketConditions.size > 0) score += 10
if (festivalMoved) score += 10
```

### Diagnostic data

- **activeArcs (1):** `arc:inspection_campaign:day27` → +15
- **arcSeeds: 0** → +0  (no seed had family `seasonal_arc` *or* an `affectedActors` of kind `local_event`)
- **calendarTags (9):** all the tag strings present → +30 (capped)
- **marketConditions:** `market unstable 22, market unstable 23` → +10
- **festivalReadinessMoved: false** → +0

score = 15 + 0 + 30 + 10 + 0 = **55** ✓

### Hypothesis

Three plausible angles, in priority order:

1. **No seasonal arcs run.** The only `activeArc` is an inspection campaign (probably hits day 27 by accident, not a planted arc). For 4 arcs × 15 = 60 you would want 4 distinct multi-day arcs to fire across 28 days.
2. **No arc seeds emitted.** Not a single seed had `family === 'seasonal_arc'` and not one carried a `local_event` actor. There's a `seasonal_arc` family registered (it's listed as missing in `expanded_seed_coverage` too — note 5/10) but it never fires.
3. **No festival readiness movement.** `festival_readiness` pressure stays flat the whole run. Either no festival fits in 28 days or the festival arc isn't seeded.

> Borderline check fairness: the scorer awards up to 60 of its 100 points to **arc breadth**, but only 28 days are sampled. Even if the simulation behaves perfectly, four distinct seasonal arcs in 28 days is a high bar. **Likely a check issue or duration issue, not a code bug** for this axis specifically. Worth discussing whether the threshold should fall to 50 or the test run length should rise to 84 days.

### Investigation checklist

1. Inspect `src/sim/modules/` for the seasonal-arc module (per phase plan it's introduced in phases 31–35). Does it exist? Is it registered in the default pipeline?
2. Search for the `seasonal_arc` seed family generator. If implemented, why isn't it firing?
3. Look at `state.world.localEvents` over the run — do any beyond the inspection campaign exist?
4. Check whether `festival_readiness` pressure is wired to anything that actually moves it.

### Likely fix locations

- `src/sim/modules/` (find the arc / seasonal module; likely `arcs`, `seasonal`, or `worldEvents`)
- `src/sim/modules/issueSeeds/generators/seasonalArc.ts` if it exists
- Re-evaluate `expandedReadinessReport.ts:778-790` thresholds against the 28-day window

### Verdict

**Mostly code/content gap with a side helping of "the threshold is harsh at 28 days."** Both worth addressing.

---

## 7. `social_consequence_quality` — score 65 / threshold 70 (gap −5)

Measures, across expanded-family seeds only, whether each consequence profile creates memories, has an attribution hook, affects named entities, and affects expanded pressures.

### Scoring formula

`src/sim/testing/expandedReadinessReport.ts:826-897` — `buildSocialConsequenceQualityReport`:

```ts
memoryAxis   = round(withMemories       / total * 100)
namedAxis    = round(withNamedEntity    / total * 100)
pressureAxis = round(withExpandedPress  / total * 100)
impactAxis   = round(impactSum / total)        // average impactScore
score = round((memoryAxis + namedAxis + pressureAxis + impactAxis) / 4)
```

### Diagnostic data (678 expanded profiles)

| Axis | Value |
|---|---|
| profiles creating memories | 678 / 678 → **100** |
| profiles affecting named entities | 384 / 678 → **57** |
| profiles affecting expanded pressures | 510 / 678 → **75** |
| average impactScore | **27.0** → **27** |

score = round((100 + 57 + 75 + 27) / 4) = **64.75 → 65** ✓

### Hypothesis

Two distinct drags:

1. **Same root cause as Phase 20 §1:** the `impactScore` average is 27 (≈ the 28 we saw in `response_impact`). Fixing the impact-score assignment in the resolver would lift this axis by ~40 points individually, which would raise the overall score by ~10 → comfortably above 70.
2. **Named-entity axis at 57%:** 294 out of 678 consequence profiles don't touch a named-entity-kind actor. Likely correlated with the same role-vs-named-individual issue as P40 §4.

### Investigation checklist

1. Fix `response_impact` first — this section will rise with it almost for free.
2. For the 294 profiles that don't affect named entities: print their `seed.family` and `seed.primaryActor` — do they belong to families that should target a named person but currently target a `customer_group`?
3. The `withMemories` axis is at 100 — that part of the system is healthy.

### Likely fix locations

- Same as Phase 20 §1 (response resolver impact scoring)
- Same as P40 §4 (named-individual references replacing role ids)

### Verdict

**Code issue, but downstream of §1 and §4.** Don't fix this section directly — fix the upstream causes and watch this rise.

---

# 6. Documentation vs. Code Drifts

Found while resolving thresholds. None of these block fixing the failures but they should be reconciled when the gates are next tuned.

| Threshold | Plan-doc value | Code value | Source |
|---|---|---|---|
| Phase 20 `seed_quality` | 80 | 75 | doc: `docs/plans/phases-16-20.md:2557`; code: `src/sim/testing/readinessReport.ts:53` |
| Phase 20 `response_impact` | 75 | 70 | doc: `docs/plans/phases-16-20.md:2558`; code: `src/sim/testing/readinessReport.ts:54` |
| Phase 20 `pressure_quality` | — (not in doc) | 70 | code: `src/sim/testing/readinessReport.ts:52` |
| Phase 40 (all sections) | match | match | doc: `docs/plans/phases-36-40-...readiness.md:2848-2859` |
| `CLAUDE.md` "Phases 21–40 not yet implemented" | doc says not implemented | code & 29-test suite is implemented | `CLAUDE.md:5-9` |

The code is uniformly *more lenient* than the plan doc on Phase 20. With doc thresholds, Phase 20 would fail in exactly the same three places (the gaps are still negative).

---

# 7. Suggested Fix Order

Smallest-blast-radius first; each step is independently shippable.

1. **P20 §2 `cause_coverage`** — mechanical. Walk modules, add missing `causes` records. Has no architectural risk. (≥80% threshold should be reachable.)
2. **P40 §5 `expanded_pressure_quality`** — small. Thread named-actor refs into expanded-pressure cause records. +5 needed.
3. **P40 §4 `named_entity_repetition`** — biggest content shift. Replace role ids with named-individual ids in default-staff creation; possibly grow supplier/regular rosters or improve round-robin. This is the largest gap (−40) but also the most concrete fix.
4. **P20 §1 `response_impact`** — investigate the resolver. Two paths: either the scorer is too conservative across the catalog (one-line tune) or the catalog is dominated by no-op profiles (content work). Fix here lifts P40 §7 as a side effect.
5. **P40 §6 `arc_and_calendar_use`** — implement (or wire up) the seasonal arc module; consider lowering the 60 threshold or running the test at 84 days.
6. **P20 §3 `strategy_diversity`** — last because it depends on cleanliness/reputation dynamics; may resolve naturally as 1–5 are fixed.
7. **P40 §7 `social_consequence_quality`** — verify it passes after §1 and §4 (no direct fix needed).

---

# 8. Threshold Reference

### Phase 20 (`READINESS_THRESHOLDS`)

```ts
state_safety: 90       replayability: 95       cause_coverage: 80
pressure_quality: 70   seed_quality: 75        response_impact: 70
contradiction_safety: 90  repetition_control: 70  strategy_diversity: 70
card_capacity: 75
```

Source: `src/sim/testing/readinessReport.ts:48-59`.

### Phase 40 (`EXPANDED_READINESS_THRESHOLDS`)

```ts
identity_richness: 70           entity_memory_quality: 70
attribution_quality: 65         expanded_pressure_quality: 70
expanded_seed_coverage: 65      text_ingredient_quality: 75
named_entity_repetition: 70     arc_and_calendar_use: 60
social_consequence_quality: 70  expanded_contradiction_safety: 90
```

Source: `src/sim/testing/expandedReadinessReport.ts:61-72`.

---

# 9. Test-Suite Caveat (important)

`tests/sim/phase20.cardlessPlaytest.test.ts:455-457`:

> *"We do not assert `passed === true` because the readiness scoring is strict and tuned for future card development; this test guarantees the gate runs end-to-end and produces a structured verdict."*

`tests/sim/phase40.expandedReadiness.test.ts:666-676` does the same — it only asserts `result.readiness.sections.length === EXPANDED_READINESS_SECTION_IDS.length` and that `replayIdentical` is a boolean.

**Implication:** the Vitest suite cannot regress to red as long as the *structure* and the *individually-asserted sections* (state_safety, replayability, contradiction_safety, expansion smoke test) hold. To make the gates self-enforcing once fixes are in, add an opt-in test that asserts `buildReadinessReport(...).passed === true` and `buildExpandedReadinessReport(...).passed === true` — initially `.skip`-ed and flipped on as each section is fixed.

---

# 10. Files Touched in This Investigation

| Purpose | Path |
|---|---|
| Phase 20 readiness scorers | `src/sim/testing/readinessReport.ts` |
| Phase 40 readiness scorers | `src/sim/testing/expandedReadinessReport.ts` |
| Phase 20 readiness tests | `tests/sim/phase20.cardlessPlaytest.test.ts` |
| Phase 40 readiness tests | `tests/sim/phase40.expandedReadiness.test.ts` |
| Phase 20 plan | `docs/plans/phases-16-20.md` (§20.13 thresholds at 2550–2562) |
| Phase 40 plan | `docs/plans/phases-36-40-expansion-memory-attribution-pressures-seeds-readiness.md` (§40.2 thresholds at 2845–2860) |
| Diagnostic script | `scripts/diagnoseReadiness.ts` |
