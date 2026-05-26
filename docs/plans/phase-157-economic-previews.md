# Phase 157 — Economic Previews (Coin / Stock / Debt)

**Legible Surface arc, Phase 12.** Tracked as **ISSUE-125**. First
Movement-VII phase: per-meter preview authoring. Pairs with the arc
plan at `docs/plans/legible-surface-arc.md §Phase 12` and follows the
Phase-147 (ISSUE-115) preview legibility contract that landed the
`MAGNITUDE_LEXICON`, the `inactionPreview` primitive, the three
opt-in legibility rules on `checkPreviewVariety`, and the two pilot
pools (`supplierReliability`, `areaAtmosphere`).

## Context

Phase 147 wrote the contract — *every immediate-effect preview must
encode meter + direction + magnitude; resource-spending choices must
surface their cost; inaction must not render blank* — and proved it
satisfiable in two pilot pools. The other 17 compositional templates
still depend on the **Phase-145 shared narrator base** at
`src/cards/compose/pools/_shared/effectPreviewBase.ts`, which gates
only on `(effectTargetKind × effectDirection)` and carries **no
magnitude vocabulary**. So every non-pilot card today renders a
voiced line that drops the magnitude band the sim already classified:
- `+15 coin` → "coin would land in the till" (no calibration of "a
  step" vs "a real step")
- `-25 coin` → "the till lightens by a hand" or "coin would leave the
  purse" (no calibration of "a step" vs "a clear drop" vs "a heavy
  fall")
- `+40 stock.ale.quantity` → "stores would deepen by a barrel" (no
  calibration of "a step" vs "a real step" vs "a wide leap")
- `stock.ale.salePrice ±1` → "shelves would thin a measure" (a `tiny`
  effect renders as `small`)

Movement VII's per-meter principle: previews recur across situations,
so authoring them by *effect target meter* once in the shared base
fills the `direction × magnitude` cells in one place and every
template that consumes the base benefits. Phase 12 owns the **economic
meters** (coin, stock) and the **debt-flavoured coin variants**
(effects tagged `['coin', 'rent']` / `['coin', 'wages']`). Per the
user's scope direction, pressure-target effects — including delayed
`pressure:debt` / `pressure:landlord` writes from the `debt_rent`
family — are **deliberately deferred to Phase 14** (Operational
Previews) which owns the `pressure` target kind plus the rising-
pressure / delayed-effect framing as a coherent meter family.

## What the sim emits (the cells to author)

Coin (`MAGNITUDE_BAND_CUTOFFS.coin = [5, 20, 50]`):

| Band | Negative amounts emitted | Positive amounts emitted |
|---|---|---|
| `tiny` (<5) | -3 (rare; "Time lost inspecting") | — |
| `small` (5–<20) | -5, -8, -10, -12, -15 (most common) | 6, 12, 15 |
| `medium` (20–<50) | -20, -25, -30, -40 (common) | 20, 30, 40 |
| `large` (≥50) | — | — |

Tag clusters observed: `['coin']` (most), `['coin', 'rent']`,
`['coin', 'wages']`. No `large`-band coin effects exist in production
— **author `large` cells optimistically** (single snippet apiece, so
the gate still passes if a future seed emits one) but don't burn
budget on multi-snippet `large` matrices.

Stock (`MAGNITUDE_BAND_CUTOFFS.stock = [10, 30, 60]`):

| Band | Stock target/amount cells |
|---|---|
| `tiny` (<10) | `stock.X.salePrice ±1` |
| `small` (10–<30) | `stock.X.quantity ±10/-15/-20/+20` |
| `medium` (30–<60) | `stock.X.quantity +30/+40`, `stock.X.quality +10` |
| `large` (≥60) | `stock.X.quantity +60` (restock response only) |

Debt/rent: lives entirely on the `coin` targetKind in this phase. The
`debt_rent` family emits `coin -(rent ?? 30)` (`small`/`medium`
depending on the dynamic amount) tagged `['coin', 'rent']`, plus
`coin +40` (`medium`, borrow). Staff burnout emits `coin -15`
tagged `['coin', 'wages']`. Snippets gated on `effectTag rent` /
`effectTag wages` at specificity 4 substitute the cost noun ("the
till" → "the rent" / "wages") without touching the magnitude word.

## What this phase ships

**Approach A** (per user direction): recalibrate the shared narrator
base for the two economic targetKinds, opt every coin/stock-emitting
template into the legibility rules. Per-template pools' existing
specificity-3 magnitude snippets stay where they're already
calibrated; remove only verbatim duplicates against the new base.

### 1. Shared base recalibration — `src/cards/compose/pools/_shared/effectPreviewBase.ts`

Replace the 4 existing kind+direction-only coin snippets and 4 stock
snippets with a `direction × magnitudeBand` matrix. The new base
adds **3-condition** snippets at the implicit specificity for
`(effectTargetKind, effectDirection, effectMagnitudeBand)` — same
shape Phase 147 used for the pilot snippets — so per-template
specificity-3 overrides still out-rank the base on identical
condition shapes via the FNV tie-break (no specificity-bumping
needed). For directions where the sim emits no cells (e.g. `coin
large`), ship a single optimistic snippet so the gate stays satisfied
if a future seed emits one.

Per-cell authoring rules:
- Every `negative` coin snippet contains a token from
  `DEFAULT_TARGET_KIND_KEYWORDS.coin` (`coin / till / purse / silver /
  copper / penny`) — passes `requireCostSurfacing`.
- Every banded snippet contains a token from
  `MAGNITUDE_LEXICON[direction][band]` — passes `requireMagnitude`.
- Multiple snippets per high-traffic cell (`coin neg small`, `coin
  neg medium`, `stock pos small`, `stock pos medium`) for the FNV
  tie-break spread across multi-effect renders (mirror Phase 145's
  staff/customer base treatment).
- Each snippet ≤10 words (the `effect_preview` budget). Avoid
  actor-role nouns ("your cook", "the cook" → fail `sim_coherence`
  `role_claim`).
- IDs prefixed `shared_preview_coin_<dir>_<band>_<letter>` and
  `shared_preview_stock_<dir>_<band>_<letter>`, replacing the
  existing `shared_preview_coin_pos_a` / `_neg_a` / `_pos_b` / `_neg_b`
  and the matching stock ids. Other targetKinds in the base
  (`area`, `pressure`, `customer`, `staff`, `reputation`, `cohort`,
  `supplier`, `faction`, `culture`, `memory`, `arc`, `attribution`,
  `global`) are **untouched** in this phase — they belong to Phases
  13–14.

Approximate snippet counts per cell:
| Cell | Snippets | Notes |
|---|---|---|
| `coin neg tiny` | 2 | rare amounts (-3); calibrated tokens "a hair / a touch / a whisper" |
| `coin neg small` | 4 | most common cost cell; -5/-8/-10/-12/-15 |
| `coin neg medium` | 4 | -20/-25/-30/-40 |
| `coin neg large` | 1 | optimistic; no emission today |
| `coin pos small` | 2 | 6/12/15 |
| `coin pos medium` | 2 | 20/30/40 |
| `coin pos large` | 1 | optimistic |
| `stock neg tiny` | 1 | salePrice -1 |
| `stock neg small` | 2 | quantity -10/-15/-20 |
| `stock neg medium` | 1 | quality variants |
| `stock pos tiny` | 1 | salePrice +1 |
| `stock pos small` | 2 | quantity +20 |
| `stock pos medium` | 2 | quantity +30/+40 |
| `stock pos large` | 1 | quantity +60 (restock) |
| ~26 snippets total | | replaces 8 existing entries |

### 2. Debt-tag variants — same file, separate block

Three to four snippets at specificity 4
`(effectTargetKind: coin, effectDirection: negative, effectTag: rent
| wages, effectMagnitudeBand: small | medium)` that substitute the
cost noun. Each contains the magnitude word AND a debt/wage
keyword — passes both rules. IDs `shared_preview_coin_rent_<band>_a`
/ `shared_preview_coin_wages_<band>_a`. Concrete cells:
- `coin neg small + rent` (1 snippet, e.g. "rent would draw a step from the till")
- `coin neg medium + rent` (1 snippet, e.g. "rent would pull a clear drop from the till")
- `coin neg small + wages` (1 snippet, e.g. "wages would lift a step from the till")

The debt-coded variants out-rank the plain coin cells (specificity
4 vs 3) for the matching effect, so the `debt_rent` and
`staff_burnout` cards land legible debt language without per-template
authoring.

### 3. Per-template pool harmonisation

For each per-template `effectPreview.ts` pool that imports
`narratorEffectPreviewBase()`, remove any locally-authored snippet
whose text is now canonically equal to a snippet in the recalibrated
base (the dedupe gate's `checkDedupe` will flag these otherwise). Two
known cases from the Phase-147 pilots:
- `src/cards/compose/pools/areaAtmosphere/effectPreview.ts`:
  `pre_leg_coin_neg_small` "coin would leave the till by a step" and
  `pre_leg_coin_neg_medium` "a clear drop of silver would leave the
  till" — drop or reword (the base now carries cost-surfacing coin
  snippets at the same condition shape). The pilot keeps its
  area-specific snippets.
- `src/cards/compose/pools/supplierReliability/effectPreview.ts`:
  same two coin cells — drop or reword. The supplier-specific
  `pre_leg_supplier_*` snippets stay; they ride at a different
  targetKind.
- `src/cards/compose/pools/debtRent/effectPreview.ts`:
  `pre_coin_out` "Coin would leave the till for the landlord" gated
  on `effectTag coin` — keep as a debt-specific flavor line (no
  magnitude word, only fires when other base+debt-tag snippets miss
  via the FNV order). Actually safer: trim to dodge the magnitude
  rule by ensuring it doesn't catch banded coin effects when a banded
  snippet exists. The shared base + rent-variants will cover banded
  cells; this snippet falls through only when magnitudeBand is
  undefined, which is fine.
- `src/cards/compose/pools/stockShortage/effectPreview.ts` and any
  other template emitting coin/stock previews: scan for canonical
  duplicates against the new base; remove or reword. Most existing
  per-template snippets gate on `effectKind`/`effectTag` (specificity
  1–2), so the new base out-ranks them anyway for banded effects.

The harmonisation pass is mechanical — author by reading the dedupe
gate's failure messages, not by enumerating every pool ahead of time.

### 4. Opt-in legibility rules on per-template `previewVariety` live tests

`previewVariety` is **not** wired into per-template `runAllGates`
configs today (template-config-scoped harness vs multi-choice gate
shape). Phase 147's contract opt-in lives at
`tests/cards/compose/gates/previewVariety.live.test.ts`. Extend that
file with new test blocks for the ten coin/stock-emitting templates:
foodSafety, stockShortage, maintenance, staffBurnout,
customerComplaint, regularComplaint, violence, debtRent, inspection,
reputationShift, monthlyReview, seasonalArc. Each block:

1. Builds a realistic multi-choice card render with concrete coin
   and/or stock effects drawn from the production cells.
2. Calls `checkPreviewVariety` with
   `legibility: { requireMagnitude: true, requireCostSurfacing: true }`.
3. Asserts `report.pass === true`, `observed.magnitudeRatio === 1`,
   and `observed.costSurfacingRatio === 1` where applicable.

`forbidInactionBlank: true` is enabled only for templates whose
seeds carry an inaction profile with empty `immediateEffects` —
`area_atmosphere` (already covered), `customer_complaint` (delay
slot), `debt_rent` (delay slot), and any other delay/refuse profile
discovered during authoring. The rule isn't blanket — the contract
allows templates without an inaction path to omit it.

### 5. New tests

| File | New cases | Purpose |
|---|---|---|
| `tests/cards/compose/gates/previewVariety.live.test.ts` | +10–12 | Each coin/stock-emitting template passes `requireMagnitude` + `requireCostSurfacing` for its realistic effect set. |
| `tests/cards/compose/phase157.economicPreviews.test.ts` | new file, ~15 | Unit-level: every direction×band cell the sim emits resolves to a snippet that carries the magnitude word; debt-tag variants out-rank the plain coin cells when `effectTag: 'rent'` / `'wages'` is in the effect's tags. Determinism per cell. |

Determinism is provable per cell because the synthetic per-effect
slot id `effect_preview::${slotId}::${idx}` is stable, the FNV
tie-break is deterministic, and `pickSnippet` is pure. Two calls
with the same `(seed, state, effect)` return the same text.

## Files touched

```
src/cards/compose/pools/_shared/effectPreviewBase.ts          (recalibrate coin + stock; +debt-tag variants)
src/cards/compose/pools/areaAtmosphere/effectPreview.ts       (drop dedupe-colliding snippets)
src/cards/compose/pools/supplierReliability/effectPreview.ts  (drop dedupe-colliding snippets)
src/cards/compose/pools/debtRent/effectPreview.ts             (harmonise; trim if dedupe complains)
src/cards/compose/pools/stockShortage/effectPreview.ts        (harmonise)
src/cards/compose/pools/<other coin/stock template>/effectPreview.ts (harmonise — discovered via dedupe gate)
tests/cards/compose/gates/previewVariety.live.test.ts         (+10–12 template live tests)
tests/cards/compose/phase157.economicPreviews.test.ts         (new — unit cell + determinism)
docs/plans/phase-157-economic-previews.md                     (this file, renamed on commit)
docs/ISSUE_TRACKER.md                                         (ISSUE-125 entry)
CLAUDE.md                                                     (Phase 157 status callout)
```

No sim-side changes. No new gates. No new condition primitives.
`composeChoicesFromSeed`, `MAGNITUDE_LEXICON`, the legibility rules,
and the `inactionPreview` primitive are reused unchanged.

## Critical files to read before authoring

- `docs/plans/legible-surface-arc.md §Phase 12` — the arc-level brief
- `docs/plans/phase-147-preview-legibility-contract.md` — the
  immediate precedent; the pilot pools' shape, the rewording fixes,
  and the dedupe-gate caveats
- `src/cards/compose/magnitudeLexicon.ts` — the calibrated vocabulary
- `src/cards/compose/pools/_shared/effectPreviewBase.ts` — what's
  being recalibrated
- `src/cards/compose/pools/supplierReliability/effectPreview.ts` +
  `…/areaAtmosphere/effectPreview.ts` — the pilot shape to mirror,
  plus the per-template snippets that need to be harmonised
- `src/cards/compose/gates/previewVariety.ts` — the gate the new
  snippets must satisfy (esp. `lineCarriesMagnitude` and
  `DEFAULT_TARGET_KIND_KEYWORDS.coin`)
- `src/sim/modules/issues/generatorHelpers.ts:154-175` — `effect()`
  and `classifyMagnitudeBand` so cell math stays correct
- `src/cards/compose/pools/debtRent/effectPreview.ts` — current debt
  template phrasing to preserve where it differs meaningfully
- `tests/cards/compose/gates/previewVariety.live.test.ts:577-679` —
  the pilot live-test shape to extend

## Carve-outs (do NOT do)

- **Touch the pressure base or any pressure snippets.** All
  `pressure` targetKind work — including the debt-coded
  `pressure:debt` / `pressure:landlord` delayed effects in the
  `debt_rent` family, and the rising-pressure framing — is owned by
  Phase 14 (Operational Previews). Phase 12 stops at the `coin` and
  `stock` targetKinds plus the `effectTag rent | wages` cost-noun
  variants on coin. If a card today renders a generic pressure
  preview, that's Phase 14's problem.
- **Touch other targetKinds in the shared base.** Customer, staff,
  reputation, cohort, supplier, faction, culture, memory, arc,
  attribution, global stay at their current kind+direction
  specificity until Phases 13–14 author them.
- **Author voice-axis-gated coin/stock snippets.** Economic previews
  are narrator-voiced — the actor's voiceProfile shouldn't determine
  how cost reads. The shared base is voice-neutral by design;
  per-template voice-axis overlays (where they exist) ride at higher
  specificity and stay on actor-domain meters.
- **Print raw numbers.** The magnitude lexicon is the interface;
  `coin -25` renders as "a clear drop of silver would leave the till",
  not "-25 coin" and not "spend 25 silver".
- **Add OR/NOT/nesting to conditions.** Snippets stay flat
  multi-condition arrays — every condition is AND.
- **Wire `previewVariety` into per-template `runAllGates` configs.**
  Phase 147 deliberately kept the gate's call sites in
  `previewVariety.live.test.ts`; Phase 12 follows that precedent.
  Phase 16 (The Legibility Gate) is where harness-level wiring lands.
- **Touch `composeChoicesFromSeed`.** The inaction routing, the
  per-effect synthetic slot, and the `ConditionContext` shape are
  Phase 147 work and don't need changes here.

## Verification

1. `npm run typecheck` — passes.
2. `npx vitest run tests/cards/compose/phase157` — new file green.
3. `npx vitest run tests/cards/compose/gates/previewVariety` — all
   pilot + new template live tests green; the fixture suite green.
4. `npx vitest run tests/cards/compose/gates/runAllGates` — all 21
   per-template + Phase-6 choice blocks still pass the seven framework
   gates (dedupe is the only one at risk; the harmonisation pass
   resolves any failures).
5. `npx vitest run tests/cards/templates.supplierReliability
   tests/cards/templates.areaAtmosphere tests/cards/templates.debtRent
   tests/cards/templates.stockShortage` — per-template suites still
   green; the pilots' Phase-147 assertions hold.
6. `npm test -- --run` — full suite green at ≥ 2649 + new tests.

## Expected friction (named upfront)

- **Dedupe gate** is the most likely failure mode during the
  harmonisation pass. The Phase-147 pilots author with the gate's
  0.85 similarity threshold in mind; recalibrating the shared base
  will introduce candidates near that threshold against existing
  per-template snippets. Per Phase 147 precedent, reword on detection
  rather than authoring defensively; the gate's failure message
  names the colliding pair and similarity score.
- **Sim-coherence `\bagain\b` / `\byesterday\b` detectors** flagged a
  Phase-147 snippet during authoring. Avoid temporal claims in new
  snippets unless paired with `repeatCount` / `memoryPresent` —
  same rule that's protected ten earlier phases.
- **Magnitude-lexicon `medium` token "a real step" doubles as a
  `positive medium` token** — Phase 147 hit two rewording fixes
  ("a clear step" → "a real step") because "a clear step" isn't in
  the lexicon. The same trap will catch new authors who reach for
  "a clear step" without checking the lexicon; the
  `lineCarriesMagnitude` helper is the safety net.
- **Coin `large` band has no production emissions.** Author a single
  optimistic snippet per direction so the gate stays passable if a
  future seed emits one, but don't author 4 snippets nobody will
  see. Same logic for the `stock pos large` cell (only restock fires
  it).

## Loopback risk

The Movement V → VI → VII chain documented in
`docs/plans/legible-surface-arc.md` predicts "*one* loop back from an
early Movement-VI phase to Phase 1." Phase 12 is Movement VII's
first, and authoring may surface a salience gap (e.g. the existing
`SALIENCE_TABLES` may not rank "rent vs coin" correctly for the
`debt_rent` family) — if so, document it as ISSUE-125's loopback
candidate and leave the salience-table change for ISSUE-114's
iteration list rather than touching the table in this phase.
