# Phase 147 — Preview Legibility Contract & Consequence of Inaction

**Legible Surface arc, Phase 2.** Tracked as ISSUE-115. Continues from
Phase 1 (ISSUE-114, phase 146 — `SALIENCE_TABLES` + multi-fact establishing
slot). Pairs with the arc plan at `docs/plans/legible-surface-arc.md`.

## Context

Voiced Surface taught every line to *speak*; Phase 1 of this arc taught the
establishing line to state the *salient* fact. Phase 2 turns the same
discipline on the choice previews — the lines that should answer
*"can I decide?"*

Pre-Phase-147 previews failed two ways. **First**, voiced previews dropped
structural facts the sim already classified — Phase 145 added `targetKind`
/ `direction` / `magnitudeBand` to every `EffectPreview` and merged a
47-snippet shared narrator base across all 19 templates that carries a
discriminating keyword per `targetKind`. A render now says "shelves would
thin a measure" — *meter* and *direction* land, *magnitude* doesn't. There
was no shared vocabulary for "tiny / small / medium / large" so `small`
read inconsistently ("a notch", "a measure", "a touch", "a hand") and a
player could not calibrate one choice's weight against another's. A choice
that *spent* (e.g. `coin -25`) rendered no different from one that
*gained* unless the author happened to author both directions.

**Second**, the inaction option rendered blank. `composeChoicesFromSeed`
at `src/cards/cardHelpers.ts:213` mapped `profile?.immediateEffects ?? []`
to preview lines. The `ignore_area_problem` consequence profile at
`expandedSeedGenerators.ts:2692` declares `immediateEffects: []` with all
consequences in `delayedEffects`. The "Ignore the problem" choice rendered
with no preview lines at all — exactly the option a player needs the
*most* information about, because they have to weigh "do nothing" against
structurally-loud alternatives. Fourteen profiles across
`expandedSeedGenerators.ts` and `issueSeedGenerators.ts` carry the same
empty-immediate / non-empty-delayed shape.

## What this phase shipped

A documented preview legibility contract + magnitude lexicon + inaction-
path fix exist; the two pilot situations satisfy the contract end-to-end;
the new check is enforceable on a per-template basis via opt-in gate
config (mirroring Phase 145's `PreviewSpecificityRule` pattern);
sim-coherence still holds (a preview promises only what the consequence
profile carries); determinism + re-render stability preserved.

### 1. Magnitude lexicon (`src/cards/compose/magnitudeLexicon.ts`)

`MAGNITUDE_LEXICON: Record<EffectDirection, Record<EffectMagnitudeBand,
readonly string[]>>` plus a `lineCarriesMagnitude` helper. Plain data, no
closures, `as const` so callers can substring-check the readonly arrays.
Re-exported from `src/cards/compose/index.ts`.

Two structural rules:
- **Shared vocabulary for `tiny` and `small` across `positive` /
  `negative`** — direction lives in the surrounding verb ("rise a notch"
  vs "fall a notch"), so the magnitude word itself does not need to read
  directional at small scales.
- **Divergent vocabulary for `medium` and `large`** — at those scales the
  magnitude word reads directional in English ("a clear lift" vs "a clear
  drop", "a surge" vs "a heavy fall"). `neutral` has its own minimal
  vocabulary for memory / arc / attribution markers whose direction
  resolves to `'neutral'`.

### 2. The `inactionPreview` condition primitive

Twelfth flat-data condition arm in `src/cards/compose/types.ts` +
`conditions.ts`:

```ts
| { kind: 'inactionPreview'; value: boolean }
```

Reads `ctx.inactionPreview`, threaded by `composeChoicesFromSeed` when the
preview is sourced from `delayedEffects` because `immediateEffects` was
empty. Graceful-degrades to `false` when the ctx field is absent — body /
title slot evaluation (no context passed) is unaffected. Lets pools
author lines specific to "what not acting costs" framing without
overloading `effectKind` or `effectTag`.

### 3. Inaction wiring in `composeChoicesFromSeed`

`src/cards/cardHelpers.ts` now sources preview effects from
`delayedEffects` when `immediateEffects` is empty:

```ts
const immediate = profile?.immediateEffects ?? []
const delayed = profile?.delayedEffects ?? []
const useDelayed = immediate.length === 0 && delayed.length > 0
const effects = (useDelayed ? delayed : immediate).slice(0, previewMax)
// …threads { …, inactionPreview: useDelayed } into the snippet ctx
```

Sim-coherence holds: the line text is composed by the pool or falls
through to the sim's verbatim `effect.readable`. The choice's mechanical
shape (verb / targetId / shape / slot identity) is untouched. The
existing `includeDelayed` override on `ChoiceOverrides` remains for the
legacy `buildChoice` path that wants both immediate AND delayed effects;
the inaction wiring only activates when immediate is empty.

### 4. Three new opt-in rules on `checkPreviewVariety`

New `PreviewLegibilityRule` config block on
`src/cards/compose/gates/previewVariety.ts`, three new violation reasons
appended to the frozen `PREVIEW_VARIETY_REASONS` tuple:

- **`preview_magnitude_missing`** — a rendered preview line whose
  `effect.magnitudeBand` is defined dropped the magnitude vocabulary.
  Sim fallthrough (`composed === undefined`, line is verbatim
  `effect.readable`) counts as legible — the same "sim authority always
  counts" carve-out Phase 145 applied to specificity. Lines whose
  `magnitudeBand` is `undefined` (neutral-amount, memory / arc /
  attribution markers) are excluded.
- **`preview_cost_unsurfaced`** — a choice carrying any
  negative-direction `coin` effect did not render any preview line
  containing a coin keyword from `DEFAULT_TARGET_KIND_KEYWORDS.coin`
  (configurable via `coinKeywords`). A choice that spends should not be
  indistinguishable from a choice that gains.
- **`preview_inaction_blank`** — a choice's preview rendered zero lines.
  The Phase-147 inaction wiring makes this satisfiable for any profile
  with either an immediate or a delayed effect; the gate guards against
  regressions and against templates that opt out.

All three default to `false` (opt-in). The 17 non-pilot templates'
existing `runAllGates` configs are untouched. New observation fields
`magnitudeRatio` / `costSurfacingRatio` / `inactionBlankCount` surface
the rule outcomes for debug.

### 5. `PreviewVarietyChoice.inactionPreview?: boolean`

The gate's choice fixture shape gained an optional `inactionPreview` flag.
When true, the gate threads `inactionPreview: true` into the per-effect
`ConditionContext`, mirroring how `composeChoicesFromSeed` flags the
inaction path. Lets the live suite exercise inaction-specific snippet
variants without crafting a full sim state. Defaults to false.

### 6. Pilot pools

**`src/cards/compose/pools/supplierReliability/effectPreview.ts`** —
gained 17 magnitude-bearing snippets gated on `(effectTargetKind ×
effectDirection × effectMagnitudeBand)` at specificity 3. Covers the
cells supplier seeds actually emit per `expandedSeedGenerators.ts`
(coin -15 small through -30 medium; supplier ±3 tiny through ±20 large;
pressure ±5 small through ±12 medium; reputation -8 small). Every coin
cell explicitly names the till / silver / purse so the cost-surfacing
rule passes. Three rewordings needed during authoring: `pre_leg_supplier_pos_medium`
"a clear step" → "a real step" (the only positive.medium token that
matches `MAGNITUDE_LEXICON`); `pre_leg_pressure_pos_medium` same fix;
`pre_leg_supplier_neg_tiny` "the merchant would cool a hair" → "trust
would dip a hair with the supplier" to clear the dedupe gate (similarity
0.867 vs `pre_leg_supplier_pos_tiny` "the merchant would warm a hair",
above the 0.85 threshold).

**`src/cards/compose/pools/areaAtmosphere/effectPreview.ts`** — gained
12 magnitude-bearing snippets covering area condition / cleanliness /
damage cells, coin -10/-15/-25, pressure +10 maintenance, reputation -8
respectable; plus 3 inaction-specific snippets at specificity 4 gated on
`inactionPreview: true` covering the `ignore_area_problem_profile`'s
delayed effects (pressure:maintenance +10 medium, area condition -8
tiny, area damage +6 tiny). Two rewordings during authoring: same "a
clear step" → "a real step" fix as supplier; `pre_leg_pressure_neg_small`
"the maintenance pressure would settle a notch" → "the maintenance
reading would step back a notch" to dedupe against the existing
`pre_pressure_ease` ("Maintenance pressure would settle a notch",
similarity 0.91).

The shared base at `_shared/effectPreviewBase.ts` is **untouched** in
this phase — the pilots prove the contract by authoring above the base
at specificity 3 (and 4 for inaction), out-ranking the base for matching
effects via the existing specificity gradient. Movement VII's per-meter
authoring phases will revisit the shared base for system-wide calibration.

## Tests

| File | Cases | Purpose |
|---|---|---|
| `tests/cards/compose/phase147.magnitudeLexicon.test.ts` | 9 | Lexicon shape + `lineCarriesMagnitude` correctness |
| `tests/cards/compose/phase147.inactionPreview.test.ts` | 11 | `inactionPreview` primitive + `composeChoicesFromSeed` routing |
| `tests/cards/compose/gates/previewVariety.test.ts` | +8 | Each new legibility-rule failure / pass / opt-in case |
| `tests/cards/compose/gates/previewVariety.live.test.ts` | +3 | The two pilots pass `requireMagnitude` + `requireCostSurfacing` + `forbidInactionBlank` |
| `tests/cards/templates.areaAtmosphere.test.ts` | +4 | `ignore_area_problem` renders sourced preview lines, deterministic, mechanical truth preserved |
| `tests/cards/compose/gates/previewVariety.test.ts` | updated | `PREVIEW_VARIETY_REASONS` extended to 6 entries |

Full suite green at **2624/2624 across 206 files** (+35 vs the
post-Phase-146 baseline of 2589: 9 magnitude-lexicon + 11 inaction +
8 legibility-rule + 3 pilot-live + 4 areaAtmosphere-inaction).

## Files touched

```
src/cards/compose/magnitudeLexicon.ts                       (new)
src/cards/compose/types.ts                                  (+inactionPreview condition + ctx)
src/cards/compose/conditions.ts                             (+inactionPreview arm)
src/cards/compose/index.ts                                  (re-export MAGNITUDE_LEXICON + lineCarriesMagnitude)
src/cards/compose/gates/previewVariety.ts                   (legibility rule + 3 reasons + observations)
src/cards/compose/gates/index.ts                            (re-export new types)
src/cards/cardHelpers.ts                                    (composeChoicesFromSeed inaction routing)
src/cards/compose/pools/supplierReliability/effectPreview.ts (+17 magnitude snippets)
src/cards/compose/pools/areaAtmosphere/effectPreview.ts     (+12 magnitude + 3 inaction snippets)
tests/cards/compose/phase147.magnitudeLexicon.test.ts       (new)
tests/cards/compose/phase147.inactionPreview.test.ts        (new)
tests/cards/compose/gates/previewVariety.test.ts            (+8 cases + updated frozen-tuple)
tests/cards/compose/gates/previewVariety.live.test.ts       (+3 pilot cases + import)
tests/cards/templates.areaAtmosphere.test.ts                (+4 inaction cases)
docs/plans/phase-147-preview-legibility-contract.md         (this file)
docs/ISSUE_TRACKER.md                                       (ISSUE-115 entry)
CLAUDE.md                                                   (Phase 147 status callout)
```

## What this phase deliberately does NOT do

- **Recalibrate the shared narrator base.** The pilots prove the
  contract by authoring above the base at higher specificity. The
  17 non-pilot templates' magnitude vocabulary is Movement VII's
  per-meter authoring work — touching the shared base now would broaden
  the change without strengthening Phase 2's deliverable.
- **Ship a separate ninth gate.** Phase 16 (*The Legibility Gate*) is
  the centerpiece that composes salience + legibility + distinctness
  into a harness-level test. Phase 2 extends the existing
  `checkPreviewVariety` opt-in surface; Phase 16 will read this surface
  along with Phase 1's salience read and Phase 3's distinctness gate.
- **Touch what effects do.** `EffectPreview { kind, target, amount,
  tags, … }` and `consequenceProfile.{immediate,delayed}Effects` are
  sim-owned. Only the rendered string changes.
- **Invent costs or consequences.** Inaction previews source from
  `delayedEffects`. If a profile carries neither immediate nor delayed
  effects (extremely rare in the codebase), the choice renders with no
  preview and the gate fires `preview_inaction_blank` — fix is sim-side
  (add a delayed effect), not card-side.
- **Print raw numbers.** The magnitude lexicon is the interface;
  `coin -25` renders as "a clear drop of silver would leave the till",
  not "-25 coin".
- **Add OR/NOT/nesting to conditions.** `inactionPreview { value }`
  stays flat data, same as every other arm.

## Verification

1. `npm run typecheck` — passes.
2. `npx vitest run tests/cards/compose/phase147` — 20 / 20.
3. `npx vitest run tests/cards/compose/gates/previewVariety` — fixture +
   live suites green (17 fixture + 13 live = 30 cases).
4. `npx vitest run tests/cards/templates.areaAtmosphere` — 22 / 22.
5. `npx vitest run tests/cards/compose/gates/runAllGates.test.ts` —
   41 / 41.
6. `npm test -- --run` — 2624 / 2624 across 206 files.

## Future Movement-VII iterations

The legibility contract is now part of the standing bar. Movement VII
(Phases 12–14) authors per-meter preview pools satisfying the contract
for every `(EffectDirection × EffectMagnitudeBand)` cell the sim emits,
calibrated to the shared magnitude lexicon, surfacing cost where the
meter is a resource. Phase 14 picks up the rising-pressure framing and
the `delayedEffects`-as-deferred preview path that this phase wired but
left to the pilot authors.

Phase 3 (`choiceDistinctness` gate + legible choice-set cap) is the next
arc-spine phase; it is independent of Phase 2 and can land in parallel.
