# Phase 145 — Effect-Preview Specificity Restoration

**Voiced Surface arc, Phase 18 (standing — second playtest iteration).** Tracked as ISSUE-113. Closes the second playtest cycle of the standing-phase entry in [`voiced-surface-arc.md`](voiced-surface-arc.md).

## Context

Phase 144 (ISSUE-113, first iteration) shipped the 8th structural gate `checkPreviewVariety` plus 4–8 unconditional kind-only base-rung snippets in every Movement II `effectPreview` pool. That fixed within-card preview collapse — Mira's `staff_identity` card no longer renders the same line across all 12 choices. But playtest after Phase 144 surfaced a follow-on defect:

**The lines were varied but said nothing about the meter.** When the underlying effect was `+15 coin from sales` or `-25 cleanliness` or `+1 stock price`, the player saw "the rota notes it quietly" / "the bar absorbs the change" / "the count moves a touch". Different lines per choice; meaningless translation back to sim effect.

**Root cause is structural, not text.** The per-effect snippet condition DSL (`src/cards/compose/types.ts`) exposed only two primitives about the current effect: `effectKind` (one of 5 enum values) and `effectTag` (a free string). Snippets could not read `effect.target` or `effect.amount`. So one snippet covered every `state_change` and every `pressure` indiscriminately. Phase 144's added base-rung snippets were necessarily generic because they were blind to what the effect actually did.

Worse: `composeChoicesFromSeed` at `src/cards/cardHelpers.ts:227` falls back to the sim-emitted `effect.readable` only when no snippet matches. `effect.readable` is the most informative thing in the pipeline ("Earn coin from sales", "Kitchen cleaner", "Discard mushrooms", `Raise ${stockLabel} price`) — and Phase 144's repair made it almost never reachable. The renderer (`web/src/lib/cards/CardRenderer.svelte:88-92`) shows only the resulting string per effect with no amount or target badge alongside.

## Goal

Snippet pools can author lines that **say what changed**, gated on a small framework-shaped vocabulary of per-effect data (`targetKind`, `direction`, `magnitudeBand`). Variety stays high (Phase-144 gate stays); specificity rises (new rule on the same gate); the sim-emitted `effect.readable` remains the guaranteed safety net.

## Scope & non-goals

**In scope:**
- Structured per-effect metadata (`targetKind`, `direction`, `magnitudeBand`) on `EffectPreview`, populated sim-side by the `effect()` constructor.
- Three new flat-data condition primitives: `effectTargetKind`, `effectDirection`, `effectMagnitudeBand`.
- Shared narrator-register snippet base merged into all 19 actor / narrator template pools (`fallback` excluded — no effect previews on choices).
- New optional `specificity` rule on the existing `checkPreviewVariety` gate; no 9th gate.
- Live test extensions and new fixture cases.

**Out of scope** (deferred to a future Phase-18 iteration):
- Voice-axis-gated specificity-3+ snippets per template (the plan reserves these for playtest-driven authoring, not bulk-author up-front).
- YAML specs under `specs/cards/` (still lag in-repo pool authoring per the standing Phase-4 authoring loop).
- Renderer-side per-effect amount/direction badges (out of scope per Phase-144's "out of scope" list — the same line still applies here).
- New coverage gate that walks reachable consequence profiles per template to assert no `targetKind: 'other'` (deferred; current classifier table covers every observed target).

## Design

### Sim-side metadata (Step 1)

Extended `EffectPreview` at `src/sim/core/effect.ts` with three optional fields:

```ts
export type EffectTargetKind =
  | 'coin' | 'stock' | 'area' | 'customer' | 'staff'
  | 'pressure' | 'memory' | 'reputation' | 'cohort'
  | 'supplier' | 'faction' | 'culture' | 'arc'
  | 'attribution' | 'global' | 'other'
export type EffectDirection = 'positive' | 'negative' | 'neutral'
export type EffectMagnitudeBand = 'tiny' | 'small' | 'medium' | 'large'
```

The `effect()` constructor at `src/sim/modules/issues/generatorHelpers.ts:51` — the single choke point for ~240 effect emissions across `issueSeedGenerators.ts` and `expandedSeedGenerators.ts` — classifies the target string and amount once and writes them onto every preview. Old serialized seeds remain valid (fields are optional and snippet conditions degrade to `false` on missing data).

Per-`targetKind` magnitude-band cutoffs (`MAGNITUDE_BAND_CUTOFFS`) centralise what "small" means per meter family — `coin` 5/20/50, `pressure` 5/10/20, `staff` 3/8/15, etc. Tuning lives in one place; authors gate on band names.

### Condition primitives (Step 2)

Three new flat-data condition arms in `src/cards/compose/types.ts`:

```ts
| { kind: 'effectTargetKind'; anyOf: readonly EffectTargetKind[] }
| { kind: 'effectDirection'; sign: EffectDirection }
| { kind: 'effectMagnitudeBand'; anyOf: readonly EffectMagnitudeBand[] }
```

Banded magnitude (not raw `effectMagnitudeAtLeast { abs: number }`) mirrors the `signalEquals { equals: BandId }` pattern from Phase 127. All three arms graceful-degrade to `false` when `ctx.currentEffect` or the relevant classified field is absent — same shape as the Phase-6 `effectKind` / `effectTag` arms.

### Shared narrator base + per-template repopulation (Step 3)

New `src/cards/compose/pools/_shared/effectPreviewBase.ts` exports `narratorEffectPreviewBase(): Snippet[]` — 47 narrator-voiced snippets covering the `(targetKind × direction)` grid. IDs prefixed `shared_preview_` to prevent per-template collisions. Returns bare snippets (not a `SnippetPool`) so each template's pool merges it in via `[...narratorEffectPreviewBase(), ...own]`.

Each shared snippet:
- contains a keyword from `DEFAULT_TARGET_KIND_KEYWORDS` for its targetKind (passes the new specificity rule),
- stays under the 10-word effect_preview budget,
- avoids `your` / `the cook` / actor-role nouns (sim-coherence gate `role_claim` patterns stay quiet),
- is canonically distinct from every other shared snippet AND from the Phase-144 base rungs in each template (within-template dedupe stays quiet — three rewordings needed during authoring: `shared_preview_stock_pos_a` "fill again" → "fill back up", `shared_preview_staff_neg_a` "wear thin again" → "wear thin tonight" both to clear sim-coherence `\bagain\b`; `shared_preview_attribution_neu_a` and `shared_preview_arc_neu_a` reworded to dodge canonical equality with template-specific Phase-144 snippets).

High-traffic targetKinds (`staff`, `customer`) carry 2–3 snippets per direction so the FNV tie-break at `pickSnippet` (which keys on `effect_preview::${slotId}::${idx}`) has multiple equal-specificity candidates to spread across a multi-effect card render.

For each of the **19 templates** (skip `fallback`), the pool now reads `[...narratorEffectPreviewBase(), ...Phase-144-and-Phase-132-snippets]`:

```
drinkOrder, staffAside, staffBurnout, regularComplaint, customerComplaint,
supplierReliability, stockShortage, debtRent, factionRequest,
cultureConflict, maintenance, areaAtmosphere, foodSafety, violence,
inspection, reputationShift, rumourCrisis, rivalTavern, monthlyReview,
seasonalArc
```

Specificity gradient:
- **1** — Phase-144 kind-only base rung (kept as ultimate safety net, but rarely fires now).
- **2** — new shared `(targetKind, direction)` lines from the base.
- **3+** — template-specific voice-axis variants from Phases 132/133/etc. (unchanged from Phase 144).

### Gate extension (Step 4)

`src/cards/compose/gates/previewVariety.ts` extended with `PreviewSpecificityRule`:

```ts
type PreviewSpecificityRule = {
  minSpecificityRatio?: number   // default 0.7
  targetKindKeywords?: Partial<Record<EffectTargetKind, readonly string[]>>
}
type PreviewVarietyConfig = {
  // existing fields…
  specificity?: PreviewSpecificityRule
}
```

`DEFAULT_TARGET_KIND_KEYWORDS` ships next to the gate (e.g. `coin → ['coin','till','purse','silver',…]`; `stock → ['shelf','shelves','stock','stores','barrel',…]`). The specificity check runs inside the existing `renderPreviewLines` loop — no new sampler API, no new `runAllGates` wiring.

A rendered preview line counts as **specific** when one of three things is true:
1. It is the verbatim `effect.readable` (sim authority — always counts);
2. It contains any keyword from `targetKindKeywords` for the effect's `targetKind`;
3. The effect has no classifiable `targetKind` or classifies to `'other'`.

Third violation reason `'preview_specificity_low'` added to `PREVIEW_VARIETY_REASONS`. Gate is **opt-in** — omitting the `specificity` config preserves Phase-144 behaviour, so the new rule only bites where it's explicitly enabled.

### Tests (Step 5)

- New unit test `tests/sim/phase145.effectClassification.test.ts` (80 cases) — every observed target prefix + magnitude cutoff + direction sign rule.
- New unit test `tests/cards/compose/phase145.effectConditions.test.ts` (14 cases) — each new condition arm with positive/negative/no-context/legacy-seed cases.
- Extended fixture test `tests/cards/compose/gates/previewVariety.test.ts` — four new cases proving the specificity rule fires on generic-varied pools, passes on specific pools, counts sim fallthrough as specific, and stays opt-in.
- Extended live test `tests/cards/compose/gates/previewVariety.live.test.ts` — three new specificity assertions across `staffAside`, `areaAtmosphere`, `stockShortage` / `seasonalArc` / `inspection`. The pre-existing Mira regression got updated helpers (`effect()` instead of literal `EffectPreview`) so the shared base actually matches.
- The runAllGates suite already exercises every template's pools structurally (41 cases). After the shared base injection, 4 templates needed rewording fixes during the authoring loop:
  - `shared_preview_stock_pos_a`, `shared_preview_staff_neg_a` — sim-coherence `\bagain\b` / temporal language reword.
  - `shared_preview_attribution_neu_a` — dedupe `canonical_equality` with template-specific snippets.
  - `shared_preview_arc_neu_a` — dedupe `near_duplicate` / `canonical_equality` across three templates.

## What this iteration deliberately does NOT do

- Does not add a 9th structural gate — extending `checkPreviewVariety` was sufficient.
- Does not change `composeChoicesFromSeed` plumbing (`src/cards/cardHelpers.ts:227` still falls back to `effect.readable`).
- Does not write per-template voice-axis-gated specificity-3+ snippets. Authors will add those playtest-by-playtest in subsequent Phase-18 iterations.
- Does not change the renderer or per-effect UI affordances.
- Does not update `specs/cards/*.spec.yaml` — still deferred per the Phase-4 authoring loop.

## Verification

1. `npm run typecheck` — passes with the optional fields on `EffectPreview` flowing through every site.
2. `npx vitest run tests/sim/phase145.effectClassification.test.ts` — 80 / 80.
3. `npx vitest run tests/cards/compose/phase145.effectConditions.test.ts` — 14 / 14.
4. `npx vitest run tests/cards/compose/gates/previewVariety` — fixture + live suites green.
5. `npx vitest run tests/cards/compose/gates/runAllGates.test.ts` — 41 / 41.
6. `npm test -- --run` — full suite green.
7. Manual smoke in the web UI: load the **Privy area_atmosphere** card and **Mira's staff_identity** card (Phase 144's exemplars). Confirm coin / stock / pressure / area effects each surface a discriminating line — not "the rota notes it quietly". Compare against the Phase 144 baseline screenshots.

## Future Phase-18 iterations

ISSUE-113 stays the standing tracker entry. The repair recipe documented in `phase-144-deepening-and-voice-selection-repair.md` carries forward unchanged:

1. Receive playtest defect screenshots / reports.
2. Reproduce the defect with a fixture test against the relevant pool.
3. Decide whether the gate threshold needs tuning, the pool needs more snippets, or a new structural rule is warranted.
4. Apply the smallest repair that satisfies the gates and resolves the visible defect.
5. Run `npm test -- --run` + `npm run typecheck`.
6. Append a one-line entry to ISSUE-113 in the tracker.
