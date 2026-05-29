# The Complete Surface Arc — Fill Every Cell, Wire Every Gate

**Voiced Surface made every line speak. Legible Surface made every line inform. Faithful Surface stopped the surface lying about the sim. This arc finishes what those three deliberately deferred:** the matrices were authored thin (the "readable diagonal," the "picker-reachable quadrant," the "high-traffic axes only"), one flagship card was never migrated at all, and the gates that are supposed to hold the whole surface to its contract are wired by *convention*, not by *contract* — a template can ship under-gated and nothing fails. An audit over the twenty migrated templates, the gate harness, the salience layer, and the signal surface found four classes of gap and one structural reason they stay invisible.

This is a **completeness** arc, not a defect arc. Nothing here is broken in the "the player is told a lie" sense Faithful Surface fixed — the suite is green and typecheck is clean. The gaps are *holes the prior arcs knew they were leaving*: cells no snippet covers, a card that predates the framework, gates that exist but aren't pointed at the templates they're meant to protect. The work is large but bounded: three foundation phases that make coverage a machine-checked contract, eight content phases that fill the matrices to the cell, and two closing phases that wire the completeness check into the standing bar.

---

## The diagnosis in one screen

1. **One template was never migrated.** `drinkOrderCard` is the original Phase-C compositional card (Living Cast, phase 123). Its body builder splices `seed.textIngredients.recentContext[0]` straight into the rendered body (`src/cards/templates/drinkOrder.ts:153-154`) — a raw, un-composed, un-gated, un-state-checked fragment, exactly the "fragment dump that can contradict the sim" the Voiced and Faithful arcs killed *everywhere else*. It has **no sim-backed establishing slot**, no `saliencePolicy`, and no salience-table read; it is flavor-only while the other nineteen open on a salient fact. The companion test `tests/cards/compose/phase127.simBackedHookSignal.test.ts:57` that was meant to prove its `sim_backed_hook` resolves is still `it.skip(...)` — deferred since Voiced Surface Phase 1 and never re-enabled.

2. **The quality gates are wired by convention, not contract.** Three gates are *opt-in* — they only run if a config block is passed to `runAllGates`: `previewVariety`, `choiceDistinctness`, `reportLegibility`. Across the entire test suite, `previewVariety:` is passed to `runAllGates` in **zero** files, `choiceDistinctness:` in **one** (the synthetic Phase-148 fixture, not a real template), `reportLegibility:` only in the report-section tests. So **the twenty card templates' per-template `runAllGates` walks run only the seven always-on framework gates.** Preview/choice/legibility quality is instead checked by the *cross-sim* harnesses (`legibility`, `faithfulness`) and `previewVariety.live.test.ts` — but those harnesses are **hand-maintained registries** (`legibilityHarness.ts`, `crossSituationHarness.ts`, and the dynamic `cardRegistry.all()` walk in `faithfulnessHarness.ts`). Nothing fails if a newly-added template is registered in `REQUIRED_CARDS` but forgotten in a harness list. CLAUDE.md's Phase-161 note claims per-template `runAllGates` "runs the seven framework gates + dedupe + previewVariety + choiceDistinctness + reportLegibility for every template's own pool walk" — **that claim is inaccurate**; the code runs seven + (opt-in, never-configured) three.

3. **The establishing matrices are deliberately partial.** Movement VI of the Legible Surface arc authored "the readable diagonal + extremes," not the full cell space — by design, but the holes are real content gaps now:
   - **`inspection` (critical):** only the `relationship = low` face of its 3-meter cube is authored (3-4 spec-3 cells). The `relationship = mid|high` quadrant — 18+ cells — is absent, and there is a *documented but unaddressed actor asymmetry*: when the seed's `primaryActor` is a `notable_npc` rather than a `faction`, the faction-signal reads don't resolve and the card silently falls to single-condition rungs.
   - **`maintenance` / `areaAtmosphere` / `foodSafety` / `violence`:** each authors only the picker-dominant quadrant (~8 of 27 cube cells). The other ~19 cells are unauthored on the bet that the seed picker can't reach them — *a bet never verified by instrumentation*.
   - **`reputationShift` / `rumourCrisis` / `rivalTavern` / `seasonalArc` / `monthlyReview`:** selective authoring of high-traffic paths only. Five of ten reputation axes (`cheap`/`filthy`/`strange`/`culinary_renown`/`goblinAuthentic`) have no matrix cell; rumour `target × target` and `memory × memory` pairs are absent; rival `memory × memory` is absent; seasonal cross-theme and monthly cross-pressure×memory grids are unfilled.

4. **One seed family has no salience table.** `policy_backlash` (`issueSeedTypes.ts:70`, generated at `expandedSeedGenerators.ts:4492`) has no entry in `SALIENCE_TABLES` (`src/cards/compose/salience.ts`). It routes to `fallbackCard` today so impact is low, but it is a latent trap: the first dedicated template for it would open on a bare mood line, and the salience layer has no completeness check that would catch the omission.

**The one structural reason the gaps stay invisible.** There is no machine check that couples *"a template exists in `REQUIRED_CARDS`"* to *"it is exercised by every quality gate and present in every cross-sim harness,"* and no check that couples *"a salience table declares N salient reads for a family"* to *"the establishing pool authors a covering snippet for each salient cell."* Coverage is asserted by author discretion and hand-maintained lists. This is the same shape of blind spot Faithful Surface Phase 1 found in the samplers — *a green suite that proves the wrong thing* — one level up: not "the gate runs against a stub," but "the gate never runs at all for this template, and the matrix is judged complete by eye."

This is why "3,161/3,161 green" and "the card opens on a mood line while a meter screams, and four of its eleven choices were never preview-checked" can both be true.

---

## Two principles this arc bakes in

These are decisions taken *for* this arc; later phases assume them. They are to completeness what Faithful Surface's "direction means good or bad" and "a gate that exercises a stub is not a gate" were to faithfulness.

1. **Coverage is a contract, enumerable and machine-checked — never a hand-maintained list.** If a template is in `REQUIRED_CARDS`, a test must *derive* that it is exercised by every applicable gate and present in every cross-sim harness, and fail if it is not. If a family declares a salience table, a test must *derive* the salient cells and assert the establishing pool covers them. The author never re-types a registry; the machine reads `REQUIRED_CARDS` and `SALIENCE_TABLES` as the single source of truth and checks the rest against them.

2. **A cell is authored only if the sim can reach it.** "Fill the full matrix" does not mean writing snippets for states the generators never emit — those are dead higher rungs the `specificity` and `diversity` gates correctly reject. Filling a matrix cell therefore has two legitimate moves: **(a) widen the generator's picker** so the cell becomes a reachable state (a sim-side, additive change — new candidate selection, never a rewrite), or **(b) prove the cell is unreachable** and record it in an explicit, enumerable `unreachableCells` allowlist the coverage gate reads, so "we chose not to author this" is *data*, not a silent hole. Every gap closed by this arc resolves to (a) authored-and-reachable or (b) allowlisted-unreachable — never "absent and unexplained."

---

## The spine at a glance

```
  MOVEMENT I — Foundations (make coverage a contract, not a convention)
   1  Gate-Wiring Contract     registry-completeness guard; opt-in gates run per-template   ← closes blind spot #2
   2  drinkOrder Parity        sim-backed establishing slot + salience; drop the raw         ← closes gap #1
                                fragment; re-enable the skipped sim_backed_hook test
   3  Salience Completeness     policy_backlash + any tableless family; a cell-coverage read  ← closes gap #4, arms M-II
                                the gate can enumerate; the unreachableCells allowlist

  MOVEMENT II — Fill the establishing matrices to the cell (Q1 content)  ← keyed to STATE METERS
   4  Suppliers, Stock & Debt        supplier 9-cell already strong; fill stock/debt
   5  Staff & Personnel              stress × fatigue full 9-cell on both staff cards
   6  Regulars & Complaints          irritation × loyalty; satisfaction × loyalty full faces
   7  Factions & Culture             faction 9-cell; the 27-cell culture cube, full diagonal + faces
   8  Premises & Atmosphere          area condition × cleanliness × damage — fill or allowlist every cube cell
   9  Crises & Safety                inspection asymmetry FIX + relationship=high face; foodSafety / violence cubes
  10  Reputation, Rumour & Rivals    the low-traffic axes; target×target; memory×memory
  11  Periodic & Narrative           monthly cross-pressure×memory; seasonal cross-theme

  MOVEMENT III — Close the loop
  12  Coverage Gate             a standing matrix-cell coverage gate + harness-completeness check  ← the centerpiece
  13  Deepening & Tuning        play; deepen reachable cells; recalibrate; widen pickers          ← standing
```

**You are here:** Voiced / Legible / Faithful Surface all complete (through ISSUE-135 / phase 167). The suite is green, typecheck clean. Nineteen of twenty templates open on a salient fact through composed slots; the gates exist; the matrices are partial by design. Next is Phase 1 of *this* arc.

**The one ordering rule:** Movement I is a hard prerequisite for everything after it — **1 → 2 → 3 in order**. Phase 1's registry-completeness guard must land first so that every Movement-II content phase is *proven* to run under the full gate set as it lands (otherwise we author thin again, invisibly). Phase 3's cell-coverage read and `unreachableCells` allowlist are what every Movement-II phase authors against. Within Movement II the eight content phases (4–11) can be reordered freely, except **Phase 9 contains the `inspection` actor-asymmetry fix and should not be deferred** (it is the one *correctness* item hiding in a content phase). Movement III follows everything; Phase 12's coverage gate needs ≥3 filled clusters to be meaningful, so it lands late. Expect *one* loop back from an early Movement-II phase to Phase 3 (the first full-cube fill will name a cell the salience read can't express or a picker that's cheaper to widen than expected) — that is the system working, exactly as Legible Surface looped Movement VI back to Phase 1.

**Phase numbers and ISSUE ids below are provisional labels, not a ladder.** The repo numbers them continuing from ISSUE-135 / phase 167 — so **ISSUE-136… / phases 168…**. Register each in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md) when you commit it, walk them in `Depends on` order, and let the dependency chains — not the integers — drive execution.

**The scaling unit is unchanged.** Every content phase (4–11) is a [Phase-4 Claude-Code authoring loop](voiced-surface-arc.md#appendix-a--the-claude-code-authoring-loop): read the spec → author the pools in-repo → run `runAllGates` + the situation's tests → iterate to green → commit. This arc adds *one* gate to the bar (`coverage`-of-matrix-cells, Phase 12) and *wires* three existing opt-in gates into the per-template walk (Phase 1); it does not change the loop.

**Pairs with:**
- [`legible-surface-arc.md`](legible-surface-arc.md) — the matrix *is* the unit of work (its Appendix A). This arc fills the cells that arc's Movement VI left on the diagonal, and pairs every fill with the reachability discipline above.
- [`faithful-surface-arc.md`](faithful-surface-arc.md) — the real-seed sampler contract (its Phase 1). This arc extends that contract: not just "gates run against real seeds" but "every template is *proven* to run under every gate."
- [`card-composition-framework.md`](card-composition-framework.md) — the runtime, the specificity gradient, the structural gates. Unchanged; this arc adds a coverage read over `SALIENCE_TABLES`.
- The signal surface (`src/sim/signals/`, seventeen bands), `METER_VALENCE`, `SALIENCE_TABLES` — the seams the content authors against. All shipped and verified clean by this audit.

---

# MOVEMENT I — Foundations

## Phase 1 — The Gate-Wiring Contract

**Provisional:** phase 168 / ISSUE-136.

**Goal.** Make it structurally impossible for a template to ship under-gated. Today three gates (`previewVariety`, `choiceDistinctness`, `reportLegibility`) are opt-in and never configured for any real template's `runAllGates` walk, and the cross-sim harnesses are hand-maintained lists with no completeness check. A new template that forgets a harness entry loses preview/choice protection silently. This phase derives coverage from `REQUIRED_CARDS` and fails when it's incomplete.

**The work.**
- Add a **harness-completeness test**: enumerate `REQUIRED_CARDS` (minus `fallbackCard`), and assert each non-fallback template id appears in the `legibility` harness registry, the `faithfulness` walk, and — for actor-voiced templates — the `crossSituation` per-kind registry. The test reads the registries and the card list; it does not hard-code names. Fail with the missing id(s) named.
- **Wire the opt-in gates into the per-template `runAllGates` blocks** (or a single data-driven loop over the templates) so `previewVariety` and `choiceDistinctness` run for every applicable card with its real sampler — closing the gap where they run only cross-sim. Where a per-template config is genuinely not applicable (e.g. `reportLegibility` is report-only), document that exclusion as data the completeness test reads, not as silence.
- **Correct the CLAUDE.md Phase-161 claim** to describe what the code actually does after this phase.
- Triage anything the newly-run gates surface. A gate that now fires on a real template is a defect that was hiding behind the opt-in switch — fix the pool, do not silence the gate (the Faithful Surface Phase-1 rule).

**Read first.** `src/cards/compose/gates/runAllGates.ts` (the opt-in skip branches, lines ~165-231). `tests/cards/compose/gates/runAllGates.test.ts` (the per-template blocks). `tests/cards/compose/gates/{legibilityHarness,faithfulnessHarness,crossSituationHarness}.ts` (the hand-maintained registries). `src/cards/templates/index.ts` (`REQUIRED_CARDS`). `tests/cards/compose/gates/previewVariety.live.test.ts` (where preview variety is actually checked today).

**Done when.** A test fails if any `REQUIRED_CARDS` template is absent from a cross-sim harness; `previewVariety` and `choiceDistinctness` run on every applicable template's `runAllGates` walk with its real sampler; any defect the wiring surfaces is fixed in the pool; the CLAUDE.md claim is accurate; `npm test` and `npm run typecheck` green.

**Do not do.** Don't weaken a gate to keep an old block green — if it was right cross-sim it's right per-template. Don't hand-add the missing registry entries without also adding the test that would have caught them. Don't fold the cross-sim harnesses into `runAllGates` — they stay multi-template by design (the Faithful/Legible precedent); this phase makes their *completeness* checkable.

```
Enter plan mode. Complete Surface arc, Phase 1 (Gate-Wiring Contract).
Read src/cards/compose/gates/runAllGates.ts (the opt-in skip branches), the
per-template blocks in tests/cards/compose/gates/runAllGates.test.ts, the three
hand-maintained registries (legibilityHarness / faithfulnessHarness /
crossSituationHarness), src/cards/templates/index.ts (REQUIRED_CARDS), and
previewVariety.live.test.ts. Write a phase plan in docs/plans/ to (a) add a
harness-completeness test that derives the required set from REQUIRED_CARDS and
fails if any template is missing from a cross-sim harness; (b) wire previewVariety
+ choiceDistinctness into every applicable per-template runAllGates walk with its
real sampler; (c) triage and fix (in the pool, never by loosening the gate) any
defect the newly-run gates surface; (d) correct the inaccurate CLAUDE.md Phase-161
claim. Cross-sim harnesses stay siblings. Wait for plan approval.
```

---

## Phase 2 — drinkOrder Parity

**Provisional:** phase 169 / ISSUE-137.

**Goal.** Bring the one un-migrated flagship card to parity with the other nineteen. `drinkOrderCard` splices a raw `recentContext` fragment into its body, has no sim-backed establishing slot, no `saliencePolicy`, and no salience-table read; its sim-backed-hook test is skipped. Give it a real establishing line keyed to the `regular_customer` (relationship_test branch) salient meters, drop the fragment, and re-enable the deferred test.

**The work.**
- Add an `establishing_line` `SlotSpec` to `drinkOrderTemplate` with `saliencePolicy: 'multi'`, reading the `regular_customer` salience table (`regular.irritation` × `regular.loyalty`, plus the relevant pressures/repeats). Author its pool at `src/cards/compose/pools/drinkOrder/establishingLine.ts` as a matrix (Movement-II shape), so the order opens on the regular's standing, not a bare mood line.
- **Delete the raw-fragment splice** at `drinkOrder.ts:153-154`. The body becomes `[establishing_line, order_line, manner_note?]` — fully composed, the same shape Phase 7's `staffAside` adopted.
- **Re-enable** `tests/cards/compose/phase127.simBackedHookSignal.test.ts:57` by seeding the starter regulars the skipped test was waiting on, and assert `drink_order`'s sim-backed signal actually resolves at render — the assertion Voiced Surface Phase 1 promised "in principle."
- Run `runAllGates` for `drinkOrder` *now under the full gate set from Phase 1*, plus its per-situation tests, plus the cross-sim harnesses; add `drinkOrder` to any harness it isn't already in (the Phase-1 completeness test will demand it).

**Read first.** `src/cards/templates/drinkOrder.ts` (the body builder and slot list). `src/cards/templates/staffAside.ts` (the parity target — the other relationship-style card, post-Phase-7). `src/cards/compose/salience.ts` (`regular_customer` entry). `specs/cards/drink_order.spec.yaml` (the spec to extend with the new slot). `tests/cards/compose/phase127.simBackedHookSignal.test.ts`. `card-composition-framework.md §4 + §6`.

**Done when.** `drinkOrder`'s body is fully composed from slots with no raw `textIngredients` splice; it opens on a salient `regular_customer` fact via the multi-fact slot; the establishing pool is a covering matrix; the previously-skipped sim_backed_hook test is live and green; `drinkOrder` passes the full nine-gate walk and is present in every cross-sim harness; `npm test` and `npm run typecheck` green.

**Do not do.** Don't change what the drink-order choices *do* — verbs/targets/effects are untouched (Faithful rule). Don't leave the skipped test skipped "for later." Don't invent a fact the `regular_customer` seed doesn't expose — extend the salience read or the signal surface (loop to Phase 3) if a needed fact is unreachable.

```
Enter plan mode. Complete Surface arc, Phase 2 (drinkOrder Parity). Read
src/cards/templates/drinkOrder.ts, staffAside.ts (the parity target),
src/cards/compose/salience.ts (regular_customer entry), specs/cards/
drink_order.spec.yaml, tests/cards/compose/phase127.simBackedHookSignal.test.ts,
and card-composition-framework §4 + §6. Write a phase plan in docs/plans/ to
(a) add a saliencePolicy:'multi' establishing_line slot + a matrix pool to
drinkOrder keyed on the regular_customer salient meters; (b) delete the raw
recentContext splice at drinkOrder.ts:153-154 so the body is fully composed;
(c) re-enable the skipped sim_backed_hook test by seeding the starter regulars
and assert the signal resolves at render; (d) run the full nine-gate walk +
cross-sim harnesses for drinkOrder. Mechanical choice fields untouched. Wait for
plan approval.
```

---

## Phase 3 — Salience Completeness & the Reachability Allowlist

**Provisional:** phase 170 / ISSUE-138.

**Goal.** Arm Movement II. Two pieces: close the one tableless seed family, and build the two data structures every matrix-fill phase authors against — a **cell-coverage read** the gate can enumerate (so "is this matrix complete?" becomes a machine question) and an **`unreachableCells` allowlist** (so "we chose not to author this cell because the sim can't reach it" becomes inspectable data, not a silent hole).

**The work.**
- Add a `policy_backlash` salience table entry (and audit `SALIENCE_TABLES` against the full seed-family list once more — any family with a generator but no table is the same omission). Add a test that derives the family list from the generators / `issueSeedTypes.ts` and fails if a family with an active generator has no salience entry.
- Define a pure, enumerable **matrix-cell read**: given a family's salience table and the band cardinality of its meters, enumerate the decision-distinct cells (the `low/mid/high` combinations of its top salient meters, capped at the documented diagonal+extremes shape for 3-meter spaces). This is data over `SALIENCE_TABLES` + `BAND_THRESHOLDS`; no closures, enumerable by the gate.
- Define the **`unreachableCells` allowlist**: a `Record<family, Cell[]>` recording cells the seed picker provably cannot emit, beside `SALIENCE_TABLES`. Each entry carries a one-line reason ("picker scores `patronage + rowdiness ≥ 60`, so `rowdiness = low` is unreachable"). The Phase-12 coverage gate treats a cell as satisfied if either a covering snippet exists *or* the cell is allowlisted.
- Do **not** author content or build the gate here — this phase ships the *reads* and the *allowlist scaffold* (seeded with the cells the audit already identified as picker-blocked), so Movement II has a target and Phase 12 has something to check.

**Read first.** `src/cards/compose/salience.ts` (`SALIENCE_TABLES`, the existing salience read). `src/sim/signals/bands.ts` (`BAND_THRESHOLDS`, `bandOf`). `src/sim/modules/issues/issueSeedTypes.ts` (the family list). `src/sim/modules/issues/{issueSeedGenerators,expandedSeedGenerators}.ts` (the pickers — what states they can emit, to seed the allowlist). `legible-surface-arc.md` Appendix A (the matrix-cell definition).

**Done when.** Every seed family with an active generator has a salience table (asserted by a derived test); a pure cell-coverage read enumerates the decision-distinct cells of a family's matrix; an `unreachableCells` allowlist scaffold exists with the audit's known picker-blocked cells recorded with reasons; no content authored yet; `npm test` and `npm run typecheck` green.

**Do not do.** Don't author establishing snippets (Movement II). Don't add OR/NOT/nesting to conditions. Don't put unreachable cells in the allowlist on a guess — if a cell's reachability is uncertain, Movement II resolves it by instrumenting the picker, not by pre-allowlisting it.

```
Enter plan mode. Complete Surface arc, Phase 3 (Salience Completeness & Reachability Allowlist).
Read src/cards/compose/salience.ts (SALIENCE_TABLES), src/sim/signals/bands.ts
(BAND_THRESHOLDS), issueSeedTypes.ts (family list), the two seed generators (the
pickers), and legible-surface-arc.md Appendix A. Write a phase plan in docs/plans/
to (a) add the policy_backlash salience table + a derived test that fails if any
family with an active generator has no table; (b) add a pure, enumerable
matrix-cell read over SALIENCE_TABLES + BAND_THRESHOLDS; (c) add an unreachableCells
allowlist (Record<family, Cell[]> with per-cell reasons) seeded with the audit's
known picker-blocked cells. Ship reads + scaffold only — no content, no gate yet.
Additive, deterministic, enumerable. Wait for plan approval.
```

---

# MOVEMENT II — Fill the establishing matrices to the cell

**The shared shape of phases 4–11.** Each is one Phase-4 authoring loop over a domain cluster, but the deliverable is *cell completeness*, not "the readable diagonal." For each situation: (1) enumerate its matrix cells via the Phase-3 read; (2) for each cell, either author a covering establishing snippet *or* — if the sim can't reach the cell — instrument the picker to confirm, then either **widen the picker** (additive sim change) so the cell becomes reachable and author it, or **record it in `unreachableCells`** with a verified reason; (3) keep reaction/sensory pools varying with state (the Legible Surface rule); (4) run the full nine-gate walk (now including the Phase-1-wired preview/choice gates) + the situation's tests + the cross-sim harnesses to green; (5) commit. **"Filled" means every cell of the matrix resolves to authored-and-reachable or allowlisted-unreachable — zero unexplained holes.**

**Generic "done when" for 4–11.** The Phase-3 cell-coverage read reports 100% for every situation in the cluster (covering snippet or allowlist entry per cell); the `inspection`-style actor-asymmetry holes are closed; reaction/sensory lines vary with state; the nine gates pass; determinism holds; `npm test` + `npm run typecheck` green.

| Phase | Provisional | Cluster | Matrix to fill | Known holes the audit named |
|---|---|---|---|---|
| 4 | 171 / ISSUE-139 | **Suppliers, Stock & Debt** | supplier 9-cell (strong already); stock bands; debt/rent | stock/debt selective — fill or allowlist |
| 5 | 172 / ISSUE-140 | **Staff & Personnel** | staff.stress × fatigue 9-cell on staffAside + staffBurnout | mid-band cells beyond the four corners |
| 6 | 173 / ISSUE-141 | **Regulars & Complaints** | regular irritation × loyalty; cohort satisfaction × loyalty | verify seed-threshold-blocked cells → allowlist |
| 7 | 174 / ISSUE-142 | **Factions & Culture** | faction 9-cell; **culture 27-cell cube** | the culture mid faces beyond the diagonal |
| 8 | 175 / ISSUE-143 | **Premises & Atmosphere** | area condition × cleanliness × damage cube | ~19 cells absent in maintenance + areaAtmosphere |
| 9 | 176 / ISSUE-144 | **Crises & Safety** | **inspection asymmetry FIX** + relationship=high face; foodSafety + violence cubes | inspection notable_npc path; ~19 cube cells each |
| 10 | 177 / ISSUE-145 | **Reputation, Rumour & Rivals** | low-traffic reputation axes; rumour target×target + memory×memory; rival memory×memory | 5 reputation axes, the orthogonal rumour/rival pairs |
| 11 | 178 / ISSUE-146 | **Periodic & Narrative** | monthly cross-pressure×memory; seasonal cross-theme | the unfilled aggregate grids |

```
(Per-cluster standing prompt — fill in <CLUSTER>, <SITUATIONS>, <MATRIX>.)
Enter plan mode. Complete Surface arc, Movement II, cluster: <CLUSTER>.
Use the Phase-4 authoring loop (voiced-surface-arc.md Appendix A). Read the
cluster's specs under specs/cards/, the establishing/reaction pools, the Phase-3
cell-coverage read + unreachableCells allowlist, and the signals for <MATRIX>.
Write a phase plan in docs/plans/ to, per situation: (a) enumerate matrix cells
via the Phase-3 read; (b) for each cell author a covering establishing snippet,
OR instrument the picker and either widen it (additive sim change) so the cell is
reachable and author it, or record it in unreachableCells with a verified reason;
(c) keep reaction/sensory pools varying with state; (d) run the full nine-gate
walk + per-situation tests + cross-sim harnesses to green. "Filled" = every cell
is authored-and-reachable or allowlisted-unreachable, zero unexplained holes.
Compose, don't invent. No new voice axes. Wait for plan approval before coding.
```

**Phase 9 carries the one correctness item in Movement II.** The `inspection` establishing pool's faction-signal reads don't resolve when `primaryActor` is a `notable_npc`, so those seeds fall through to single-condition rungs — a silent degradation, not a content choice. Phase 9 must fix the asymmetry (a `namedEntityRole` / actor-kind branch in the pool conditions, or a salience-read that resolves for both actor kinds) *before* filling the relationship=high face, and prove both actor paths resolve a salient line with a test.

---

# MOVEMENT III — Close the loop

## Phase 12 — The Coverage Gate

**Provisional:** phase 179 / ISSUE-147. **The centerpiece, made testable** — the analogue of Faithful Surface's Phase-5 standing audit, for completeness instead of faithfulness.

**Goal.** Wire matrix completeness into the standing bar so the "authored on the diagonal" blind spot can't reopen. A gate + harness that, for every migrated situation, enumerates its matrix cells (Phase 3 read) and asserts each resolves to a covering establishing snippet *or* an `unreachableCells` allowlist entry — no unexplained hole. Plus the harness-completeness check from Phase 1 promoted to a permanent sibling gate.

**The work.** A `checkMatrixCoverage` sibling gate (multi-template, like `legibility`/`faithfulness`) that walks the cell-coverage read across all migrated situations and fails on any uncovered, non-allowlisted cell, naming the family and cell. Include deliberately-failing fixtures: a pool with a hole that is *not* allowlisted (fails), and a hole that *is* allowlisted (passes). Fold the Phase-1 harness-completeness assertion in as a second rule so the whole "is every template fully exercised and fully covered?" question is one standing gate.

**Read first.** `src/cards/compose/gates/legibility.ts` and `faithfulness.ts` (the multi-template sibling precedents). The Phase-3 cell-coverage read and `unreachableCells` allowlist. The Phase-1 harness-completeness test.

**Done when.** A standing gate asserts 100% matrix-cell coverage (authored or allowlisted) across all migrated situations and full harness/gate exercise for every `REQUIRED_CARDS` template; the two deliberately-broken fixtures fail; the gate runs in the default suite; `npm test` + `npm run typecheck` green.

**Do not do.** Don't fix a failing situation by allowlisting a cell the sim *can* reach — allowlist is for unreachable cells only, proven by picker instrumentation. Don't merge this into `runAllGates` — it's cross-template by construction. Don't assert on exact wording — assert that a covering snippet *exists* for the cell, not what it says.

```
Enter plan mode. Complete Surface arc, Phase 12 (The Coverage Gate). Read
src/cards/compose/gates/{legibility,faithfulness}.ts (multi-template sibling
precedents), the Phase-3 cell-coverage read + unreachableCells allowlist, and the
Phase-1 harness-completeness test. Write a phase plan in docs/plans/ for a
checkMatrixCoverage sibling gate that enumerates every migrated situation's matrix
cells and fails on any uncovered, non-allowlisted cell (named), plus a second rule
folding in the harness/gate-exercise completeness check from Phase 1. Include two
failing fixtures (unallowlisted hole; allowlisted hole that passes). Assert on
cell coverage, not wording. Fast enough for the default suite. Wait for approval.
```

---

## Phase 13 — Deepening, Pruning & Recalibration

**Provisional:** phase 180 / ISSUE-148. **Standing — never strictly done.** Future playtest iterations append to ISSUE-148.

**Goal.** Play it, reading for *coverage felt in play*. Where a filled cell reads flat, deepen it (a third-month supplier shortfall in a high-relationship cell earns a sharper line than the generic corner). Where a picker was widened in Movement II, watch that the new states feel earned, not noisy. Recalibrate `BAND_THRESHOLDS` and `SALIENCE_TABLES` where a cut-point or ordering reads wrong. The coverage gate keeps every matrix whole; the framework gates keep every edit safe — so the matrices deepen and the pickers widen forever at zero structural cost.

**Done when.** It's a game where every card opens on the salient fact for *its* exact state, every choice is preview-checked, and no cell is an unexplained hole — and there is no final checkmark, by design.

```
Enter plan mode. Complete Surface arc, Phase 13 (Deepening, Pruning & Recalibration).
Use the Phase-4 authoring loop. From playtest notes focused on coverage-in-play,
write a phase plan in docs/plans/ to deepen flat filled cells, watch widened
pickers for noise, prune any cell proven dead, and recalibrate BAND_THRESHOLDS /
SALIENCE_TABLES where play shows a cut-point or ordering is wrong. Every change
passes runAllGates + the coverage gate. Wait for plan approval.
```

---

## If you only remember three things

1. **The prior arcs left holes on purpose; this arc fills them and makes "filled" a machine fact.** Voiced/Legible/Faithful authored the diagonal and the reachable quadrant. Completeness keys the establishing matrices to *every* decision-distinct cell (Movement II) and makes the coverage gate (Phase 12) prove it — every cell is authored-and-reachable or allowlisted-unreachable, never an unexplained hole.
2. **A cell is authored only if the sim can reach it.** Filling the full matrix pairs content authoring with *picker widening* (an additive sim change) or *explicit unreachability* (an inspectable allowlist). No dead higher rungs; no silent holes.
3. **Coverage is a contract, not a list.** Phase 1 derives gate/harness coverage from `REQUIRED_CARDS` and salience coverage from `SALIENCE_TABLES`, and fails when either is incomplete. The author never re-types a registry; the machine reads the single source of truth and checks the rest.

---

# Appendix A — The audit that motivated this arc (2026-05-29)

Findings, with evidence, that this arc resolves. Recorded so the arc's premises are auditable.

| # | Finding | Evidence | Resolved by |
|---|---|---|---|
| 1 | `drinkOrder` splices a raw `textIngredients.recentContext[0]` into its body; no sim-backed/salience establishing slot; the sim_backed_hook test is skipped. | `src/cards/templates/drinkOrder.ts:153-154`; `tests/cards/compose/phase127.simBackedHookSignal.test.ts:57` (`it.skip`) | Phase 2 |
| 2 | `previewVariety` / `choiceDistinctness` / `reportLegibility` are opt-in and configured for **zero / one-synthetic / report-only** real templates; per-template `runAllGates` runs only 7 framework gates; cross-sim harness registries are hand-maintained with no completeness check; CLAUDE.md's Phase-161 claim is inaccurate. | `src/cards/compose/gates/runAllGates.ts` opt-in branches; `grep "previewVariety:" tests/` → 0; `choiceDistinctness:` → 1 (phase148 synthetic); `legibilityHarness.ts` / `crossSituationHarness.ts` literal lists | Phase 1, Phase 12 |
| 3 | Establishing matrices authored on the diagonal: `inspection` only `relationship=low` face + `notable_npc` actor-asymmetry; `maintenance`/`areaAtmosphere`/`foodSafety`/`violence` ~8 of 27 cube cells; `reputationShift`/`rumourCrisis`/`rivalTavern`/`seasonalArc`/`monthlyReview` high-traffic paths only. | per-pool `establishingLine.ts` snippet conditions (audit detail in this arc's source conversation) | Phases 4–11 (correctness item: Phase 9) |
| 4 | `policy_backlash` has no `SALIENCE_TABLES` entry. | `issueSeedTypes.ts:70`, `expandedSeedGenerators.ts:4492`, absent from `salience.ts` | Phase 3 |

**Verified clean by the same audit (no action needed):** `METER_VALENCE` covers all nine lower-is-better meters and `classifyDirection` is valence-aware at every `effect()` call site (no direction-inversion bugs remain post-Faithful-Surface); all seventeen signal bands resolve correctly; the legible choice cap, inaction-preview routing, within-card distinctness avoid-set, and composed-title/choice paths are all wired in production; zero legacy `src/cards/voice/` imports remain; `REQUIRED_CARDS` holds all 20 + fallback; nineteen templates declare `saliencePolicy: 'multi'` and reach the salience code.
