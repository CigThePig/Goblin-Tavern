# Phase 158 — Social Previews (Loyalty / Satisfaction / Relationship / Reputation)

**Legible Surface arc, Phase 13.** Provisional tracker entry: **ISSUE-126**. Second
Movement-VII phase (per-meter preview authoring); follows Phase 12 / ISSUE-125
(Economic Previews) directly. Pairs with the arc plan at
`docs/plans/legible-surface-arc.md §Phase 13` and the contract that landed in
Phase 147 / ISSUE-115 (`MAGNITUDE_LEXICON`, `requireMagnitude`,
`requireCostSurfacing`, `forbidInactionBlank`).

## Context

Phase 12 recalibrated the shared narrator base for the two economic targetKinds
(`coin`, `stock`) so every banded preview carries a calibrated
`MAGNITUDE_LEXICON[direction][band]` token and every coin-spend surfaces cost.
That fixed `+15 coin` → "coin would land in the till" by rendering it as "a step
of coin would settle into the till" instead.

The same defect is still alive on the **social meters**. Today
`src/cards/compose/pools/_shared/effectPreviewBase.ts:417-606` carries 12
snippets across `customer / staff / reputation / cohort / supplier / faction /
culture` that gate only on `(effectTargetKind × effectDirection)` — no band
condition, no magnitude vocabulary. So:
- `customers.merchants.patronage +12` (medium) and `+4` (small) both render as
  "the patron would warm a measure" — calibration is gone.
- `reputation.respectable -8` (small) and `-3` (tiny) both render as "word would
  turn against the name" — same line, very different stakes.
- `world.suppliers.X.relationship -10` (medium) and `-5` (small) both render as
  "the trader's deal would cool".
- `factions.X.relationship -20` (large) reads identically to a `-8` (small) snub.

Movement VII Phase 13 owns the **social meters**. Per the arc spec at
`legible-surface-arc.md:230-232` ("Social Previews — the largest preview
surface"), the cells are: `customer` / `cohort` loyalty & satisfaction,
`supplier` / `faction` / `culture` relationship, `reputation`. (The arc spec
also lists "renown" — there is no `renown` targetKind in the sim; renown maps
to `reputation` via the `culinary_renown` axis. No new targetKind here.) Phase 5
(Staff & Personnel — `staff` targetKind) sits in Movement VI for establishing
content and the Movement-VII staff *preview* cells belong to Phase 14
(Operational Previews) alongside the operational cluster — so `staff` stays
untouched in Phase 13.

## What the sim emits (the cells to author)

A second-pass audit of choice consequence profiles (not just seed-creation
effects) in `src/sim/modules/issues/issueSeedGenerators.ts` and
`expandedSeedGenerators.ts` against `MAGNITUDE_BAND_CUTOFFS` at
`generatorHelpers.ts:69-86`:

`customer` (cutoffs `[3, 8, 15]`):

| Band | Negative amounts emitted | Positive amounts emitted |
|---|---|---|
| `tiny` (<3) | — | — |
| `small` (3–<8) | -5, -6 (`customers.X.satisfaction`) | +4 (`customers.X.patronage`) |
| `medium` (8–<15) | -8 (`satisfaction`), -8 (`patronage`) | +8, +10, +12 (`patronage`) |
| `large` (≥15) | -25 (`patronage` — `violence_ban_profile`) | — |

`reputation` (cutoffs `[5, 10, 20]`):

| Band | Negative amounts emitted | Positive amounts emitted |
|---|---|---|
| `tiny` (<5) | -3, -4 (`respectable`, `dangerous`) | +2, +4 (`respectable`, `goblinAuthentic`) |
| `small` (5–<10) | -5, -6, -8 (`respectable`, `cheap`) | +5, +6, +8 (many axes) |
| `medium` (10–<20) | -10 (`cheap`, `reliable`) | +10, +12 (`reliable`, `respectable`, `tasty`) |
| `large` (≥20) | — | — |

`supplier` (cutoffs `[5, 10, 20]`):

| Band | Negative | Positive |
|---|---|---|
| `small` (5–<10) | -5 (`refuse_supplier`) | +3, +5 (`negotiate_supplier`, `place_standing_order` reliability) |
| `medium` (10–<20) | -10 (`blame_supplier`) | — |

`faction` (cutoffs `[5, 10, 20]`):

| Band | Negative | Positive |
|---|---|---|
| `small` (5–<10) | -8 (`trust`, `faction_skepticism`) | +5 (`faction_skepticism` relationship), +8 (`alliance` trust) |
| `medium` (10–<20) | -12 (trust, `betrayal`) | +10, +15 (`alliance` / `hosting` relationship) |
| `large` (≥20) | -20, -25 (`betrayal` / `alliance betray` relationship) | +15 (fear, large from faction's POV) |

`culture` (cutoffs `[5, 10, 20]`):

| Band | Negative | Positive |
|---|---|---|
| `small` (5–<10) | -8 (`comfort`) | +8 (`comfort`) |
| `medium` (10–<20) | -10 to -15 (`tension`+/-, `comfort`-) | +10 to +15 (`familiarity`, `comfort`, `tension`-relief) |

`cohort` (cutoffs `[3, 8, 15]`): **no `state_change` emissions in production.**
Cohort effects on the sim are exclusively `cause` effects (`customer_group:` ref,
`cause` verb), which don't surface as `EffectPreview`. Author optimistic
single-snippet cells so a future emission stays legible — same approach Phase 12
took for `coin large` and `stock pos large`.

**Renown / culinary_renown.** `reputation.culinary_renown` exists in state
(`TavernState.ReputationState`) but is not emitted in any production seed today.
The reputation pool covers it as a normal `reputation` cell — the player who
ever sees one gets calibrated direction × magnitude language without per-axis
authoring.

## What this phase ships

**Approach A** (the Phase-12 shape, reused unchanged): recalibrate the shared
narrator base for the six social targetKinds. Per-template pools' existing
specificity-3 voice-axis snippets stay where they're already calibrated; remove
only verbatim duplicates against the new base.

**Axis-neutrality decision.** Reputation effects encode the axis in the target
string (`reputation.respectable`, `reputation.dangerous`, ...), not in tags or a
condition primitive. The Phase 12 precedent stays in flat-data conditions; no
new primitives. Phase 13 authors **axis-neutral** reputation snippets calibrated
on `direction × band` only — "the tavern's name would lift a clear step" reads
naturally whether the moved axis is `respectable` or `cheap`. Per-axis
specificity (e.g. a snippet specific to `dangerous` rising vs `respectable`
falling) is a deliberate **future loopback** — out of scope for Phase 13. The
arc spec wording at `legible-surface-arc.md:230-232` aligns: "loyalty rises a
step" / "reputation surges" / "the guild cools a hair" calibrates *across*
meters, not *within* the axis dimension of one meter.

### 1. Shared base recalibration — `src/cards/compose/pools/_shared/effectPreviewBase.ts`

Replace the existing kind+direction-only blocks for `customer`, `cohort`,
`reputation`, `supplier`, `faction`, `culture` (lines 417-606) with `direction
× magnitudeBand` matrices at the same implicit specificity Phase 12 used
(3 conditions: `effectTargetKind` + `effectDirection` + `effectMagnitudeBand`).
Per-template specificity-3+ overrides still out-rank these via the FNV tie-break
on identical condition shapes (no specificity-bumping needed).

Per-cell authoring rules (same as Phase 12):
- Every banded snippet contains a token from
  `MAGNITUDE_LEXICON[direction][band]` → passes `requireMagnitude`.
- Every snippet contains a token from `DEFAULT_TARGET_KIND_KEYWORDS` for its
  targetKind → passes the Phase-145 specificity rule:
  - `customer`: regular / patron / customer / guest
  - `cohort`: group / cohort / crowd / table
  - `reputation`: reputation / name / word / talk
  - `supplier`: supplier / merchant / trader / deal
  - `faction`: faction / guild / order / house
  - `culture`: culture / kin / folk / people
- Each snippet ≤10 words (the `effect_preview` budget).
- No actor-role nouns ("your patron", "the merchant says") → keeps
  sim-coherence `role_claim` quiet.
- Multiple snippets per high-traffic cell (e.g. `reputation neg small`,
  `customer pos medium`, `faction pos medium`) for FNV spread across
  multi-effect renders. Single optimistic snippet for cells the sim doesn't
  emit today (`customer pos tiny`, `customer neg tiny`, `reputation pos large`,
  `reputation neg large`, all `cohort` cells, `supplier neg large` and
  `tiny`, `faction neg tiny`, all `culture tiny / large` cells).
- IDs `shared_preview_<kind>_<dir>_<band>_<letter>`, replacing existing
  `shared_preview_<kind>_neg_a` / `_pos_a` / `_neu_a` ids in the six blocks.

Approximate snippet counts per cell:

| Cell | Snippets | Notes |
|---|---|---|
| `customer neg tiny` | 1 | optimistic |
| `customer neg small` | 2 | -5/-6 satisfaction |
| `customer neg medium` | 2 | -8 satisfaction/patronage |
| `customer neg large` | 1 | -25 patronage (ban) |
| `customer pos tiny` | 1 | optimistic |
| `customer pos small` | 1 | +4 patronage |
| `customer pos medium` | 2 | +8/+10/+12 patronage |
| `customer pos large` | 1 | optimistic |
| `cohort` (all 8) | 1 each | optimistic, neutral keeps existing |
| `reputation neg tiny` | 2 | -3/-4 (multiple axes) |
| `reputation neg small` | 3 | dominant negative cell (respectable/cheap) |
| `reputation neg medium` | 2 | -10 (cheap/reliable) |
| `reputation neg large` | 1 | optimistic |
| `reputation pos tiny` | 1 | +2/+4 |
| `reputation pos small` | 3 | dominant positive cell (many axes) |
| `reputation pos medium` | 2 | +10/+12 |
| `reputation pos large` | 1 | optimistic |
| `supplier neg tiny` | 1 | optimistic |
| `supplier neg small` | 1 | -5 |
| `supplier neg medium` | 1 | -10 |
| `supplier neg large` | 1 | optimistic |
| `supplier pos tiny` | 1 | optimistic |
| `supplier pos small` | 2 | +3..+5 |
| `supplier pos medium` | 1 | optimistic (no emissions) |
| `supplier pos large` | 1 | optimistic |
| `faction neg tiny` | 1 | optimistic |
| `faction neg small` | 1 | -8 trust |
| `faction neg medium` | 2 | -12 trust / -15 relationship |
| `faction neg large` | 1 | -20/-25 relationship |
| `faction pos tiny` | 1 | optimistic |
| `faction pos small` | 2 | +5..+8 |
| `faction pos medium` | 2 | +10..+15 |
| `faction pos large` | 1 | +15 fear |
| `culture neg tiny` | 1 | optimistic |
| `culture neg small` | 1 | -8 comfort |
| `culture neg medium` | 2 | -10..-15 tension/comfort |
| `culture neg large` | 1 | optimistic |
| `culture pos tiny` | 1 | optimistic |
| `culture pos small` | 1 | +8..+9 comfort |
| `culture pos medium` | 2 | +10..+15 familiarity/comfort |
| `culture pos large` | 1 | optimistic |

Total: ~60 social-meter snippets, replacing ~12 existing kind+direction entries.
Bigger than Phase 12 (~26 snippets) — this is "the largest preview surface" as
the arc spec calls it.

### 2. Per-template pool harmonisation

For each per-template `effectPreview.ts` pool that imports
`narratorEffectPreviewBase()`, remove any locally-authored snippet whose text is
now canonically equal to a snippet in the recalibrated base. Per the audit, the
only template with substantial pre-existing social-meter snippets is
`src/cards/compose/pools/supplierReliability/effectPreview.ts` (8 supplier
snippets at lower specificity — kind+direction or kind+tag). The new base
out-ranks them via the FNV tie-break for `(targetKind, direction, band)`
matches; the existing snippets remain reachable for effects where `band` is
undefined or where they catch via `effectTag`.

The harmonisation pass is mechanical — author by reading the `checkDedupe`
gate's failure messages (similarity ≥ 0.85 within slot, canonical equality
across slots), not by enumerating ahead of time.

`src/cards/compose/pools/violence/effectPreview.ts` has one `effectTag:
'reputation'` snippet ("The house would gain a rougher name") that falls
through to the new base only when no band-keyed cell matches — should keep
working unchanged.

`src/cards/compose/pools/reputationShift/effectPreview.ts` and
`/cultureConflict/effectPreview.ts` and `/factionRequest/effectPreview.ts` and
`/customerComplaint/effectPreview.ts` and `/regularComplaint/effectPreview.ts`
and `/rumourCrisis/effectPreview.ts` all gate at the lower
`effectKind`/`effectTag` specificity — they'll be out-ranked by the new
3-condition base cells for matching effects (Phase 12 took the same path with
no per-template changes outside the two pilots).

### 3. Per-template live tests on `previewVariety` legibility rules

Extend `tests/cards/compose/gates/previewVariety.live.test.ts` with a new
`describe` block "Phase 158 social legibility on cluster pools" mirroring
Phase 12's "Phase 157 economic legibility" block at lines 702-1031. One test
per social-meter-emitting template:

- `regularComplaint` — customer effects (satisfaction -5/-8, patronage +4)
- `customerComplaint` — customer effects (cohort-scoped patronage -25, -8)
- `factionRequest` — faction relationship/trust (-12, +10), cultural pairing
- `cultureConflict` — culture tension (+12), comfort (-8, +10)
- `reputationShift` — reputation deltas across multiple axes
- `rumourCrisis` — reputation drift (-3 to -8 respectable)
- `supplierReliability` — supplier relationship (+5, -10), reliability (+5)
- `violence` — reputation.dangerous (+6) / reputation.respectable (-4)
- `monthlyReview` — reputation.respectable mover (small/medium)

Each block: builds a realistic multi-choice card render with concrete social
effects drawn from the production cells (use the `effect()` constructor in
`generatorHelpers.ts` so `targetKind` / `direction` / `band` get classified
correctly); calls `checkPreviewVariety` with `legibility: { requireMagnitude:
true }`; asserts `report.pass === true` and `observed.magnitudeRatio === 1`.

`requireCostSurfacing` doesn't apply (social meters aren't coin-flavored cost).
`forbidInactionBlank` already covered by Phase 12 for cards where it bites.

### 4. New unit test file

`tests/cards/compose/phase158.socialPreviews.test.ts` — mirror
`phase157.economicPreviews.test.ts` shape:

| Block | Cases | Purpose |
|---|---|---|
| `shared narrator base — customer cell coverage` | 6 (cells the sim emits) | Each customer cell has at least one snippet carrying both the customer keyword and the magnitude-lexicon token. |
| `shared narrator base — reputation cell coverage` | 7 (production cells) | Same shape for reputation. |
| `shared narrator base — supplier cell coverage` | 3 | Same for supplier. |
| `shared narrator base — faction cell coverage` | 7 | Same for faction. |
| `shared narrator base — culture cell coverage` | 5 | Same for culture. |
| `shared narrator base — cohort optimistic coverage` | 2 | Each direction has ≥1 optimistic snippet. |
| `determinism via pickSnippet` | 4 | Same effect (`customer -8`, `reputation +12`, `faction -20`, `culture +15`) returns the same text on repeated calls. |

About 34 new tests in this file.

### 5. Files touched (final list)

```
src/cards/compose/pools/_shared/effectPreviewBase.ts          (recalibrate customer / cohort / reputation / supplier / faction / culture blocks)
src/cards/compose/pools/supplierReliability/effectPreview.ts  (drop dedupe-colliding snippets if any)
src/cards/compose/pools/violence/effectPreview.ts             (light review only — likely no changes)
[other per-template effectPreview.ts]                          (harmonise — only if checkDedupe complains)
tests/cards/compose/gates/previewVariety.live.test.ts          (+~9 cluster live tests)
tests/cards/compose/phase158.socialPreviews.test.ts            (new — ~34 unit cases)
docs/plans/phase-158-social-previews.md                       (this file, renamed on commit)
docs/ISSUE_TRACKER.md                                          (ISSUE-126 entry)
CLAUDE.md                                                      (Phase 158 callout)
```

No sim-side changes. No new gates. No new condition primitives.
`composeChoicesFromSeed`, `MAGNITUDE_LEXICON`, the legibility rules, the
`inactionPreview` primitive, the seven framework gates — all reused unchanged.

## Reused functions and data

- `MAGNITUDE_LEXICON` at `src/cards/compose/magnitudeLexicon.ts:35-57` — the
  calibrated direction × band vocabulary.
- `lineCarriesMagnitude` at `src/cards/compose/magnitudeLexicon.ts` — the
  helper the gate uses to check a line carries a band token.
- `DEFAULT_TARGET_KIND_KEYWORDS` at
  `src/cards/compose/gates/previewVariety.ts:225-245` — the per-targetKind
  keyword tables used by the specificity rule and the cost-surfacing rule.
- `checkPreviewVariety` at
  `src/cards/compose/gates/previewVariety.ts:253` — the gate, unchanged.
- `effect()` constructor at
  `src/sim/modules/issues/generatorHelpers.ts:51` — populates
  `targetKind` / `direction` / `magnitudeBand` for tests.
- `narratorEffectPreviewBase()` at
  `src/cards/compose/pools/_shared/effectPreviewBase.ts:48` — what we're
  recalibrating.
- `pickSnippet` at `src/cards/compose/assemble.ts` — what the determinism
  tests call.
- `makeSeed` at `tests/cards/cardFactories.ts` — the test seed factory.

## Critical files to read before authoring

- `docs/plans/legible-surface-arc.md §Phase 13` — arc-level brief.
- `docs/plans/phase-157-economic-previews.md` — the immediate Movement-VII
  precedent; mirror its shape.
- `docs/plans/phase-147-preview-legibility-contract.md` — the contract layer.
- `src/cards/compose/magnitudeLexicon.ts` — calibrated vocabulary.
- `src/cards/compose/pools/_shared/effectPreviewBase.ts:417-606` — the
  social-meter blocks being recalibrated.
- `src/cards/compose/gates/previewVariety.ts:225-245` and
  `:253-449` — the keyword tables and the gate's rule logic.
- `src/sim/modules/issues/generatorHelpers.ts:51-130` — `effect()` and
  `classifyTargetKind`; cell math.
- `src/sim/modules/issues/expandedSeedGenerators.ts` — every consequence
  profile carrying social-meter effects (search for `customers.`,
  `reputation.`, `world.suppliers`, `factions.`, `cultures.`).
- `tests/cards/compose/gates/previewVariety.live.test.ts:702-1031` — the
  Phase-12 live-test block shape to mirror.
- `tests/cards/compose/phase157.economicPreviews.test.ts` — the unit test
  shape to mirror.

## Carve-outs (do NOT do)

- **Touch the `staff` base or any staff snippets.** Staff is Movement-VII
  Phase 14 (Operational Previews), alongside `area` / `pressure` / `culture
  tension` framings. Phase 13 stops at the six social targetKinds named above.
- **Touch the `pressure`, `area`, `memory`, `arc`, `attribution`, `global`
  blocks.** Same — those targetKinds are owned by Phase 14 or stay at
  kind+direction specificity.
- **Add per-reputation-axis condition primitives** (e.g.
  `effectReputationAxis { anyOf: [...] }`). The flat-data condition shape
  stays unchanged; per-axis specificity is a future loopback if play shows it
  matters.
- **Touch sim code.** The seed generators, the `effect()` constructor, the
  `MAGNITUDE_BAND_CUTOFFS` table, the response profiles — all unchanged. Only
  rendered strings change in this phase.
- **Print raw numbers.** The magnitude lexicon is the interface. A reputation
  -10 renders as "a clear drop would mark the tavern's name", not "-10
  reputation.cheap".
- **Add OR / NOT / nesting to conditions.** Snippets stay flat multi-condition
  AND arrays.
- **Wire `previewVariety` into per-template `runAllGates` configs.** Phase
  147's deliberate split stays — gate call sites live in
  `previewVariety.live.test.ts`. Phase 16 (Legibility Gate) is when
  harness-level wiring lands.
- **Touch `composeChoicesFromSeed`** at `src/cards/cardHelpers.ts:213`. The
  inaction routing, the per-effect synthetic slot, the `ConditionContext`
  shape — all Phase-147 work, unchanged here.
- **Pre-author cells the sim never emits in production.** Cells like
  `customer tiny`, `reputation large`, `supplier pos medium`, and all of
  `cohort` get a single optimistic snippet apiece — enough that a future
  emission stays legible, not enough to burn authoring budget on a 9-cell
  matrix for a meter that emits two cells.

## Verification

1. `npm run typecheck` — passes.
2. `npx vitest run tests/cards/compose/phase158` — new unit file green.
3. `npx vitest run tests/cards/compose/gates/previewVariety` — all pilot +
   Phase-12 + new Phase-13 live tests green; fixture suite green.
4. `npx vitest run tests/cards/compose/gates/runAllGates` — every per-template
   block still passes the seven framework gates (dedupe is the main risk;
   harmonisation pass resolves any failures).
5. `npx vitest run tests/cards/templates.supplierReliability
   tests/cards/templates.reputationShift tests/cards/templates.factionRequest
   tests/cards/templates.cultureConflict tests/cards/templates.violence
   tests/cards/templates.regularComplaint tests/cards/templates.customerComplaint
   tests/cards/templates.rumourCrisis tests/cards/templates.monthlyReview` —
   per-template suites green; existing assertions hold.
6. `npm test -- --run` — full suite green at ≥ (current baseline + ~43 new
   tests).

## Expected friction (named upfront, from Phase 12's experience)

- **Dedupe gate** is the most likely failure mode in the harmonisation pass.
  The new 3-condition cells will introduce candidates near the 0.85 similarity
  threshold against existing per-template snippets. Per Phase 12, reword on
  detection rather than authoring defensively; the gate's failure message
  names the colliding pair and similarity score.
- **Magnitude-lexicon `medium` tokens** are direction-specific —
  `positive medium` uses "a clear lift / a real step / a marked rise",
  `negative medium` uses "a clear drop / a real slip / a marked fall". A snippet
  authored for `negative medium` that reaches for "a clear lift" will fail
  `requireMagnitude` with no in-lexicon synonym. The `lineCarriesMagnitude`
  helper is the safety net.
- **Sim-coherence `\bagain\b` / `\byesterday\b` detectors** flag temporal
  claims unless paired with `repeatCount` / `memoryPresent`. Avoid them in new
  shared-base snippets — they're voice-neutral.
- **Cells with no production emissions** (cohort, customer tiny/pos-large,
  reputation large, supplier-pos-medium, etc.) get one optimistic snippet
  each — don't author multi-snippet matrices for cells nobody hits.
- **The reputation pool will be the biggest cell-density block.** Reputation
  has the most evenly-distributed production emissions across cells (the audit
  shows 6 of 8 cells live, with `respectable` dominating). Author 3 snippets
  for the high-traffic cells (`reputation neg small`, `reputation pos small`)
  for FNV spread; 1-2 elsewhere.

## Loopback risk

The Movement V → VI → VII chain at `legible-surface-arc.md:68` predicts "*one*
loop back from an early Movement-VI phase to Phase 1." Phase 13 is Movement
VII's second; the loopback risk here is **the per-axis specificity question**.
If playtest after Phase 13 shows the player can't tell a `respectable` slip
from a `cheap` slip when both read "a clear drop would mark the tavern's name",
the right fix is to add an axis-keyed condition primitive — and that's a
new-condition addition the Phase-D framework `runAllGates` lives around. Phase
13 deliberately doesn't open that door; if it needs opening, ISSUE-126's
followups list will name it, and the fix lands as a small new-primitive phase
ahead of Phase 17 (Deepening).
