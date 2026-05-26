# Phase 159 — Operational Previews (+ Pressure & Delayed/Uncertain framing)

**Legible Surface arc, Phase 14.** Provisional tracker entry: **ISSUE-127**. Third
(and final) Movement-VII per-meter authoring phase. Pairs with the arc plan at
`docs/plans/legible-surface-arc.md §Phase 14` and the Phase-147 / ISSUE-115
contract (`MAGNITUDE_LEXICON`, `requireMagnitude`, `requireCostSurfacing`,
`forbidInactionBlank`, the `inactionPreview` primitive). Follows ISSUE-125 (Phase
12, economic previews) and ISSUE-126 (Phase 13, social previews); reuses both
shapes unchanged.

## Context

Movement VII authors previews by **effect target meter**. Phase 12 recalibrated
the shared narrator base for `coin` + `stock` (economic); Phase 13 did the same
for `customer`, `cohort`, `reputation`, `supplier`, `faction`, `culture` (social).
Phase 14 owns the **operational meters and the delayed/uncertain framing**.

After Phases 12–13, three target kinds in
`src/cards/compose/pools/_shared/effectPreviewBase.ts` are still at
**kind+direction-only (2-condition)** with no magnitude vocabulary:

- `staff` — 6 snippets at lines 530-578 (`shared_preview_staff_neg_a/b/c`,
  `_pos_a/b/c`). Production emits stress/fatigue/morale/loyalty effects from -20
  to +20 across all four bands; today every banded staff effect on a card
  renders one of "the rota would wear thin tonight" / "the crew would feel the
  weight" with no calibration of "a step" vs "a real step" vs "a surge".
- `area` — 4 snippets at lines 360-392 (`shared_preview_area_pos_a/b`,
  `_neg_a/b`). Production emits cleanliness/condition/damage/smell from -25 to
  +25; today rendered as "the room would read cleaner" / "the corner would slip
  further" with no calibration.
- `pressure` — 4 snippets at lines 393-425 (`shared_preview_pressure_pos_a/b`,
  `_neg_a/b`). The most-emitted preview target in the whole sim (>180 emissions
  across every major family — staff_burnout, food_safety, supplier_distrust,
  inspection, regular_customer_loss, cultural_tension, debt, landlord,
  arc_escalation, rumour_pressure, …). Today "the meter would climb a notch" /
  "pressure would rise another reading" / "the meter would settle a notch" /
  "pressure would ease its reading" — direction-only, magnitude-blind, and
  zero pressure-family identity (every family's pressure rise reads the same).

The other defect Phase 14 closes is **delayed-effect (inaction) silence
beyond areaAtmosphere**. Phase 147 wired `inactionPreview: true` into
`composeChoicesFromSeed` (`src/cards/cardHelpers.ts:399-414`) and authored three
`inactionPreview`-gated snippets in `pools/areaAtmosphere/effectPreview.ts` as a
pilot. Every other inaction profile across the codebase emits its consequence
through `delayedEffects` (audit: 14 `immediateEffects: []` profiles in
`issueSeedGenerators.ts` + `expandedSeedGenerators.ts`, almost all of which
emit **`pressure:X` rising** as the delayed cost — stock_shortage,
maintenance, staff_burnout, debt, inspection, food_safety, customer_complaint,
regular_loss, rival, rumour, …). Without narrator-voiced shared inaction
snippets, those families currently render either bare base pressure prose
("the meter would climb a notch") or, where the per-template pool catches the
effect with no `inactionPreview` co-condition, identical text to the active-
choice preview — failing the legibility contract's "what *not* acting costs"
test by collapsing inaction into normal action.

## What this phase ships

**Approach A** (same as Phase 12 and Phase 13): recalibrate the shared narrator
base for the three operational targetKinds, plus add narrator-voiced inaction-
gated pressure snippets to the shared base so every inaction profile inherits
legible "what not acting costs" framing without per-template authoring. Per-
template pools stay; only verbatim duplicates against the new base get pulled
during the dedupe pass.

**Pressure direction semantics, in plain language.** The MAGNITUDE_LEXICON has
positive and negative bands. For pressure, **positive direction = rising = bad**
and **negative direction = relief = good**. The lexicon's tokens still apply
(`positive small: ['a step', 'a notch', 'a measure']`), but the surrounding
verbs encode threat for positive cells ("build", "mount", "climb", "creep
higher") and relief for negative cells ("settle", "ease", "loosen", "fall
back"). The Phase-147 pilot snippet
`pre_inact_pressure_pos_medium` already uses this pattern: "maintenance
pressure would keep climbing a real step" — positive-medium lexicon token
"a real step" + threat verb "climb" + family identifier "maintenance".

**Pressure family identity.** Production emits 20 distinct pressure families
(`pressure:staff_burnout`, `pressure:food_safety`, `pressure:debt`, …). The
shared base authors **axis-neutral** pressure snippets calibrated on direction ×
band only — same Phase-13 axis-neutrality precedent that reputation uses. "the
pressure would build a step" reads naturally whether the family is
`staff_burnout` or `inspection`. Per-pressure-family specificity (e.g. a
snippet specific to landlord vs food_safety) is a deliberate **future loopback**
candidate, out of scope here. Per-template inaction pools (areaAtmosphere has
the pilot) can still author family-named snippets when they want — they
out-rank the base via specificity 4 + `inactionPreview` co-condition.

### 1. Shared base recalibration — staff, area, pressure

Replace the three kind+direction-only blocks in
`src/cards/compose/pools/_shared/effectPreviewBase.ts` with `direction ×
magnitudeBand` matrices at the same implicit 3-condition specificity Phases 12
and 13 used. Per-template specificity-3+ overrides still out-rank the base on
identical condition shapes via the FNV tie-break.

#### What the sim emits — staff (`MAGNITUDE_BAND_CUTOFFS.staff = [3, 8, 15]`)

| Band | Negative emissions | Positive emissions |
|---|---|---|
| `tiny` (<3) | — | — |
| `small` (3–<8) | stress -8, fatigue -3, loyalty -3, morale -6 | morale +6, fatigue +4/+6/+8, stress +4/+6 |
| `medium` (8–<15) | stress -10/-12, morale -12, loyalty -4 | morale +8/+12, loyalty +10/+14, stress -10 (relief) |
| `large` (≥15) | morale -15, fatigue -15, loyalty -20 | loyalty +15/+20, morale +15 |

#### What the sim emits — area (`MAGNITUDE_BAND_CUTOFFS.area = [10, 25, 50]`)

| Band | Negative emissions | Positive emissions |
|---|---|---|
| `tiny` (<10) | damage +6 (delayed accrual) | condition +5, damage -8 (small repair) |
| `small` (10–<25) | condition -8, smell -10/-12, damage -10 (repair) | cleanliness +10/+12, condition +10/+12, damage -10 (repair) |
| `medium` (25–<50) | damage -20/-25 (repair) | cleanliness +15/+20/+25, condition +20 |
| `large` (≥50) | — | — |

Note: area direction semantics are split by sub-meter. For `condition` and
`cleanliness`, **negative direction = decay = bad**; for `damage`, **positive
direction = accrual = bad**, **negative direction = repair = good**. The
existing `area` base snippets are already direction-neutral on this split
("the corner would slip further" reads OK for both `condition -8` and `damage
+6` as long as the verb suggests deterioration). Stay with the axis-neutral
approach Phase 13 took for reputation.

#### What the sim emits — pressure (`MAGNITUDE_BAND_CUTOFFS.pressure = [5, 10, 20]`)

| Band | Negative emissions (relief) | Positive emissions (rising) |
|---|---|---|
| `tiny` (<5) | -3 (rare) | +3 (rare) |
| `small` (5–<10) | -5/-6/-8 (most common relief) | +5/+6/+8 (most common rising) |
| `medium` (10–<20) | -10/-12/-15 | +10/+12/+15 |
| `large` (≥20) | — | +25 (rare; staff_loyalty_risk, debt) |

Pressure is **the most-emitted preview target in the sim**. High-traffic cells
get 3 snippets for FNV spread (positive small, positive medium, negative
small); low-traffic cells get 2; tiny/large get 1 optimistic.

#### Approximate snippet counts per cell

| Cell | Snippets | Cell | Snippets | Cell | Snippets |
|---|---|---|---|---|---|
| staff neg tiny | 1 | area neg tiny | 1 | pressure neg tiny | 1 |
| staff neg small | 2 | area neg small | 2 | pressure neg small | 3 |
| staff neg medium | 2 | area neg medium | 1 (damage repair) | pressure neg medium | 2 |
| staff neg large | 2 | area neg large | 1 | pressure neg large | 1 |
| staff pos tiny | 1 | area pos tiny | 1 | pressure pos tiny | 1 |
| staff pos small | 3 | area pos small | 2 | pressure pos small | 3 |
| staff pos medium | 2 | area pos medium | 2 | pressure pos medium | 3 |
| staff pos large | 1 | area pos large | 1 | pressure pos large | 1 |

Total: ~14 staff + ~11 area + ~15 pressure (active-choice) = ~40 snippets,
replacing 14 existing kind+direction entries.

Per-cell authoring rules (same as Phases 12 / 13):
- Every banded snippet contains a token from `MAGNITUDE_LEXICON[direction][band]`
  → passes `requireMagnitude`.
- Every snippet contains a token from `DEFAULT_TARGET_KIND_KEYWORDS` for its
  targetKind:
  - `staff`: `staff / cook / crew / rota / shift`
  - `area`: `room / floor / space / corner / kitchen / cellar / privy`
  - `pressure`: `pressure / meter / reading / risk / climb / settle`
  → passes the Phase-145 specificity rule.
- Each snippet ≤10 words (the `effect_preview` budget).
- No actor-role nouns (sim-coherence `role_claim` quiet).
- IDs `shared_preview_<kind>_<dir>_<band>_<letter>`, replacing the existing
  `shared_preview_<kind>_neg_a/b/c` / `_pos_a/b/c` ids in the three blocks.
- Pressure-positive verb palette: `build / mount / climb / creep / press /
  thicken / bear up`. Pressure-negative verb palette: `settle / ease /
  loosen / fall back / lift off / quiet`. Staff and area use the existing
  state-change-verb palette from Phases 12 / 13.

### 2. Shared base inaction snippets — rising pressure (the delayed-cost path)

Add a new dedicated block at the end of `narratorEffectPreviewBase()` for
inaction-gated pressure snippets at specificity 4 (`inactionPreview: true` +
`effectTargetKind: 'pressure'` + `effectDirection: 'positive'` +
`effectMagnitudeBand`). These out-rank the active-choice pressure base via
specificity 4 on the inaction path.

Cells (drawn from the 14 inaction profile audit — every one emits delayed
positive pressure):

| Cell | Snippets | Notes |
|---|---|---|
| inaction pressure pos small | 3 | stock_shortage +6, maintenance +6/+10, staff_burnout +8, inspection +8, food_safety +8, regular_loss +5/+6, supplier_distrust +6 |
| inaction pressure pos medium | 2 | landlord +10, inspection +10/+12, food_safety +10/+12, debt +10 |
| inaction pressure pos large | 1 | optimistic — staff_loyalty_risk +25 type |

Authoring guidance: lead with the consequence-of-inaction framing, not the
neutral "would climb" voice the active-choice cells use. The pilot's
"maintenance pressure would keep climbing a real step" works precisely because
of "keep" — the inaction snippet carries the "this is what *not* acting buys
you" temporal claim. Vocabulary: `would keep …`, `would mount unchecked`,
`would press harder through the …`, `would build with every …`. The arc spec
example "the unrest would build another notch" is exactly this shape.

The areaAtmosphere pilot's `pre_inact_pressure_pos_medium` and the two
`pre_inact_area_*` snippets stay in `pools/areaAtmosphere/effectPreview.ts` —
the new shared inaction-pressure base widens coverage to every family without
disturbing the pilot's area-specific snippets (those gate on
`effectTargetKind: ['area']` and out-rank the shared pressure-only inaction
snippets for area effects).

~6 additional inaction snippets → total ~46 new shared-base snippets.

### 3. Per-template pool harmonisation

Mechanical — driven by the `checkDedupe` gate's 0.85 similarity failures, not
pre-enumerated. Known candidates:

- `pools/staffAside/effectPreview.ts` — has 3 generic pressure variants + a
  state_change rung. The new band-keyed shared snippets will out-rank them on
  banded effects via the FNV tie-break for (targetKind, direction, band)
  matches at the same specificity. The voice-axis-gated specificity-3 snippets
  stay. Risk: the generic "pressure rises another reading"-shape lines may
  collide canonically with the new shared base; reword on detection.
- `pools/staffBurnout/effectPreview.ts` — voice-gated state_change and
  pressure variants at specificity 2-3. Same pattern; same out-ranking.
- `pools/maintenance/effectPreview.ts` — 3 generic area, 2 generic pressure,
  customer (loss), future_hook. Out-ranked by the new band-keyed cells.
- `pools/violence/effectPreview.ts`, `pools/inspection/effectPreview.ts`,
  `pools/foodSafety/effectPreview.ts`, `pools/cultureConflict/effectPreview.ts`
  — all carry 1-2 generic staff/area/pressure variants. Same harmonisation.
- `pools/debtRent/effectPreview.ts`, `pools/customerComplaint/effectPreview.ts`,
  `pools/stockShortage/effectPreview.ts` — any non-banded variants the dedupe
  gate flags get reworded or pulled.
- `pools/areaAtmosphere/effectPreview.ts` — keep the inaction pilot snippets
  (they out-rank the new shared inaction snippets for area effects via the
  more specific targetKind condition).

### 4. Per-template live tests on `previewVariety` legibility rules

Extend `tests/cards/compose/gates/previewVariety.live.test.ts` with a new
`describe` block "Phase 159 operational legibility on cluster pools" mirroring
the Phase 12 / 13 live blocks. One test per operational-emitting template,
each:
1. Builds a realistic multi-choice card render with concrete operational
   effects (use the `effect()` constructor in `generatorHelpers.ts` so
   `targetKind` / `direction` / `magnitudeBand` get classified correctly).
2. Calls `checkPreviewVariety` with `legibility: { requireMagnitude: true,
   forbidInactionBlank: true }` where the template carries an inaction
   profile.
3. Asserts `report.pass === true` and `observed.magnitudeRatio === 1`.

Templates touched:
- `staffAside`, `staffBurnout` — staff stress/morale/fatigue/loyalty across
  the band grid.
- `areaAtmosphere`, `maintenance` — area cleanliness/condition/damage cells +
  inaction path (areaAtmosphere already covered by pilot, but cross-check
  Phase 14 base inaction snippets compose into the chain).
- `violence`, `inspection`, `foodSafety` — staff + area + pressure across
  multiple meters in one render.
- `debtRent` — pressure:debt + pressure:landlord rising on inaction.
- `stockShortage` — pressure:stock_shortage rising on inaction.
- `customerComplaint` — pressure:regular_customer_loss rising on inaction.
- `factionRequest`, `cultureConflict` — staff/area effects that ride along
  with the social-meter previews Phase 13 authored.
- `seasonalArc`, `monthlyReview` — pressure mover (arc_escalation,
  staff_burnout, etc.) across a multi-effect render.

`requireCostSurfacing` is reused from Phase 12 where coin/wages/rent effects
are part of the same render — no new logic.

### 5. New unit test file

`tests/cards/compose/phase159.operationalPreviews.test.ts` — mirror
`phase158.socialPreviews.test.ts` shape:

| Block | Cases | Purpose |
|---|---|---|
| shared narrator base — staff cell coverage | 8 (per-cell) | Each staff cell has a snippet carrying both the staff keyword and the magnitude-lexicon token. |
| shared narrator base — area cell coverage | 7 (per-cell) | Same shape for area. |
| shared narrator base — pressure cell coverage (active-choice) | 8 (per-cell) | Same for pressure on the non-inaction path. |
| shared narrator base — inaction pressure coverage | 6 | inactionPreview-gated cells exist + magnitudeLexicon token + threat verb. |
| inaction routing — active vs inaction render distinct | 4 | Same `pressure +6` effect resolves to different text depending on `inactionPreview: true/undefined`. |
| determinism via pickSnippet | 5 | Same effect (`staff -10`, `area +20`, `pressure +12`, inaction pressure +6, staff +15) returns the same text on repeated calls. |
| Phase 14 retirement guards | 3 | Every staff/area/pressure snippet now carries an `effectMagnitudeBand` condition (regression net against re-introducing kind+direction-only snippets). |

About 41 new tests in this file.

### 6. Files touched

```
src/cards/compose/pools/_shared/effectPreviewBase.ts            (recalibrate staff / area / pressure blocks; +inaction pressure block)
src/cards/compose/pools/staffAside/effectPreview.ts             (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/staffBurnout/effectPreview.ts           (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/maintenance/effectPreview.ts            (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/violence/effectPreview.ts               (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/inspection/effectPreview.ts             (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/foodSafety/effectPreview.ts             (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/cultureConflict/effectPreview.ts        (drop dedupe-colliding snippets — discovered via gate)
src/cards/compose/pools/areaAtmosphere/effectPreview.ts         (keep inaction pilots; harmonise generic snippets)
src/cards/compose/pools/<other operational template>/effectPreview.ts  (harmonise — driven by gate)
tests/cards/compose/gates/previewVariety.live.test.ts            (+~13 cluster live tests)
tests/cards/compose/phase159.operationalPreviews.test.ts         (new — ~41 unit cases)
docs/plans/phase-159-operational-previews.md                    (this file, copied across on implementation)
docs/ISSUE_TRACKER.md                                            (ISSUE-127 entry)
CLAUDE.md                                                        (Phase 159 status callout)
```

**No sim-side changes. No new gates. No new condition primitives.**
`composeChoicesFromSeed`, `MAGNITUDE_LEXICON`, the legibility rules,
the `inactionPreview` primitive, the eight framework gates — all reused
unchanged.

## Reused functions and data

- `MAGNITUDE_LEXICON` at `src/cards/compose/magnitudeLexicon.ts` — calibrated
  direction × band vocabulary.
- `lineCarriesMagnitude` at `src/cards/compose/magnitudeLexicon.ts` — the
  gate's substring check.
- `DEFAULT_TARGET_KIND_KEYWORDS` at
  `src/cards/compose/gates/previewVariety.ts:225-245` — per-targetKind keyword
  tables.
- `checkPreviewVariety` at `src/cards/compose/gates/previewVariety.ts:253` —
  the gate, unchanged.
- `effect()` constructor at `src/sim/modules/issues/generatorHelpers.ts:51`
  (populates `targetKind` / `direction` / `magnitudeBand`).
- `narratorEffectPreviewBase()` at
  `src/cards/compose/pools/_shared/effectPreviewBase.ts:48` — what we're
  recalibrating.
- `pickSnippet` at `src/cards/compose/assemble.ts` — what the determinism
  tests call.
- `composeChoicesFromSeed` at `src/cards/cardHelpers.ts:213` — where the
  `inactionPreview` ctx gets threaded.
- `makeSeed` at `tests/cards/cardFactories.ts` — test seed factory.

## Critical files to read before authoring

- `docs/plans/legible-surface-arc.md §Phase 14` — arc-level brief.
- `docs/plans/phase-157-economic-previews.md` — Phase 12 precedent (shape).
- `docs/plans/phase-158-social-previews.md` — Phase 13 precedent (the more
  recent shape, with axis-neutrality and template-reuse rewording notes).
- `docs/plans/phase-147-preview-legibility-contract.md` — the contract layer
  and the `inactionPreview` ctx wiring.
- `src/cards/compose/pools/_shared/effectPreviewBase.ts:360-425, 530-578` —
  the three blocks being recalibrated.
- `src/cards/compose/pools/areaAtmosphere/effectPreview.ts:260-300` — the
  inaction pilot to mirror for the shared inaction block.
- `src/cards/compose/gates/previewVariety.ts:225-449` — keyword tables, gate
  rule logic.
- `src/cards/cardHelpers.ts:213, 399-414` — inaction routing in
  `composeChoicesFromSeed`.
- `src/sim/modules/issues/generatorHelpers.ts:69-130` — band cutoffs +
  classifier.
- `tests/cards/compose/gates/previewVariety.live.test.ts` — live-test shape
  to extend (Phase 12 + Phase 13 blocks already there).
- `tests/cards/compose/phase158.socialPreviews.test.ts` — unit test shape.

## Carve-outs (do NOT do)

- **Touch `customer` / `reputation` / `supplier` / `faction` / `culture` /
  `cohort` blocks** — Phase 13 / ISSUE-126 covered them. Phase 14 stops at
  `staff` + `area` + `pressure` + the shared inaction pressure block.
- **Touch `coin` / `stock` blocks** — Phase 12 / ISSUE-125 owned them.
- **Touch `memory` / `arc` / `attribution` / `global` blocks** — those
  targetKinds stay at kind+direction specificity. They emit too rarely to
  justify a per-meter pass; the framework gates pass them today.
- **Author per-pressure-family snippets** (e.g. distinct vocabulary for
  `pressure:landlord` vs `pressure:food_safety`). The shared base is family-
  axis-neutral, mirroring Phase 13's reputation axis decision. Per-family
  specificity is a future loopback if play shows it matters.
- **Author per-customer_group rowdiness snippets**. Production emits no
  state_change effects on `customer_group:X.rowdiness` today (it's read by
  scoring, never written). Phase 13's optimistic `cohort` cells cover any
  future emission.
- **Touch sim code.** The seed generators, the `effect()` constructor, the
  `MAGNITUDE_BAND_CUTOFFS` table, the inaction profile structure — all
  unchanged. Only rendered strings change.
- **Print raw numbers** in any preview snippet. The magnitude lexicon is the
  interface.
- **Add OR / NOT / nesting to conditions.** Flat multi-condition AND arrays
  only.
- **Wire `previewVariety` into per-template `runAllGates` configs.** Phase 16
  (The Legibility Gate) is where harness-level wiring lands; Phase 14 stays
  at `previewVariety.live.test.ts` call sites.
- **Touch `composeChoicesFromSeed`.** The inaction routing, the per-effect
  synthetic slot, the `ConditionContext` shape — all Phase-147 work, unchanged
  here.
- **Pre-author cells the sim never emits in production.** `staff tiny`
  (both directions), `area large` (both directions), `pressure neg large`,
  `pressure pos tiny` get a single optimistic snippet apiece. Match the
  Phase-12 / Phase-13 optimistic-single-snippet treatment.

## Verification

1. `npm run typecheck` — passes.
2. `npx vitest run tests/cards/compose/phase159` — new unit file green.
3. `npx vitest run tests/cards/compose/gates/previewVariety` — all Phase
   12/13/14 live tests + fixture suite green.
4. `npx vitest run tests/cards/compose/gates/runAllGates` — every per-template
   block still passes the eight framework gates (dedupe is the main risk;
   harmonisation resolves any failures).
5. `npx vitest run tests/cards/templates.staffAside tests/cards/templates.staffBurnout
   tests/cards/templates.areaAtmosphere tests/cards/templates.maintenance
   tests/cards/templates.violence tests/cards/templates.inspection
   tests/cards/templates.foodSafety tests/cards/templates.cultureConflict
   tests/cards/templates.debtRent tests/cards/templates.stockShortage
   tests/cards/templates.customerComplaint` — per-template suites green.
6. `npm test -- --run` — full suite green at ≥ current baseline + ~54 new
   tests (~41 unit + ~13 live).

## Expected friction (named upfront)

- **Dedupe gate** is the most likely failure mode in the harmonisation pass.
  The new band-keyed shared snippets will collide canonically (or near it)
  with existing per-template generic-pressure / generic-staff / generic-area
  snippets. Reword on detection; the gate's failure message names the
  colliding pair and similarity score. Phase 12 hit 3 rewordings, Phase 13
  hit 7 — Phase 14's pressure block is broad enough to expect 5-10.
- **Pressure positive direction = bad** is the unintuitive bit. A snippet
  authored on autopilot ("a step of pressure would lift the room") reads as
  relief when the effect is escalation. The verb palette in §1 ("build /
  mount / climb / creep / press / thicken") is the discipline. Authors who
  reach for "lift" / "warm" / "rise" need to remember the family identity:
  pressure positive = stress accumulation, not gain.
- **Magnitude-lexicon `medium` tokens are direction-specific**. `positive
  medium = a clear lift / a real step / a marked rise`; `negative medium =
  a clear drop / a real slip / a marked fall`. A snippet for positive
  pressure that reaches for "a clear drop" fails `requireMagnitude`. The
  `lineCarriesMagnitude` helper catches this.
- **Sim-coherence `\bagain\b` / `\byesterday\b` detectors** flag temporal
  claims without `repeatCount` / `memoryPresent`. The inaction block is
  particularly prone — "would keep climbing" is fine; "would climb again
  tonight" trips the detector. Use "still" / "further" / "another" not "again".
- **Inaction routing is per-effect-iteration**. The `ConditionContext`
  carries `inactionPreview: true` only for the inaction choice's preview
  pass. A snippet gated on `inactionPreview: true` will NOT fire on the
  active-choice (e.g. "treat now") preview for the same pressure effect, even
  though the effect is the same. Tests assert both paths produce distinct
  text.

## Loopback risk

Movement V → VI → VII expects one loopback from a content phase to Movement V.
Phase 14 is Movement VII's third and final; loopback risk here is
**pressure-family specificity** — if play after Phase 14 shows "the pressure
would build a step" reads identically across landlord vs food_safety vs
staff_burnout in a way the player can't disambiguate, the right fix is a new
`effectPressureFamily { anyOf }` condition primitive plus per-family pool
authoring. That's a new-primitive addition the Phase-D framework
`runAllGates` lives around. Phase 14 deliberately doesn't open that door; if
play shows it's needed, ISSUE-127's follow-ups list it as a loopback
candidate and the fix lands as a small new-primitive phase ahead of Phase 17
(Deepening). Same shape as Phase 13's per-axis-reputation loopback note.
