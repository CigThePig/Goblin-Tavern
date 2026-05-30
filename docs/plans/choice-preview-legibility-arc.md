# The Choice-Preview Legibility Arc — Make Every Preview Name the Meter, the Magnitude, and the Risk

**This arc fixes a single shared defect that prior surface arcs never touched.** The Voiced / Legible / Faithful / Complete Surface arcs all worked on a card's *establishing line* (its opening body) and on the gate/coverage machinery. The defect this arc fixes lives entirely in the *choice-preview* path — the bullet lines under each option that tell the player what a choice will do. That path is shared verbatim by all twenty card templates, so the bug is uniform across the whole game and cannot be fixed card-by-card.

This is a **defect** arc, not a completeness arc. The previews actively misinform: they duplicate lines, hide more than a third of the consequences the simulation authored, and name fictional meters ("trust", "grit") instead of the real ones. The simulation is correct — the information is destroyed in translation between the seed and the rendered card.

**This document is self-contained.** Every claim below is grounded in a file path and, where useful, a line reference, all in this repository. The motivating measurements are reproduced in Appendix A and re-runnable via the committed instruments in Appendix B. No part of this plan depends on any external conversation, chat log, or document not in the repo.

---

## The diagnosis in one screen

The only function that turns a seed's response options into rendered choices is **`composeChoicesFromSeed`** (`src/cards/cardHelpers.ts:361`). **All twenty card templates call it** (every file in `src/cards/templates/` except `fallback.ts`), and **all twenty pass `maxPreview: 2`** (grep `maxPreview` across `src/cards/templates/*.ts` — twenty hits, all `2`). The per-choice preview text is then composed from effect-preview snippet pools that build on the shared base `narratorEffectPreviewBase()` in `src/cards/compose/pools/_shared/effectPreviewBase.ts`. Four mechanisms compound, all upstream of the per-family pools:

1. **The effect→cell key is too coarse, so distinct meters become indistinguishable.** Each effect is rendered from only its triple `(targetKind, direction, magnitudeBand)`. `targetKind` is computed by `classifyTargetKind` (`src/sim/modules/issues/generatorHelpers.ts`) and is one of sixteen coarse buckets (`src/sim/core/effect.ts:24`): `staff` covers loyalty **and** morale **and** stress **and** fatigue; `reputation` covers `respectable`/`dangerous`/etc.; `pressure` covers every pressure id. The distinguishing leaf of the target string (`loyalty`, `respectable`, `staff_loyalty_risk`) is discarded before the pool ever sees it. The pool therefore cannot name which meter moved and reaches for unifying metaphors. Observed: the "Comfort" choice on a `staff_identity` card moves loyalty +10, stress −8, morale +6 and renders all of it as *"the crew would feel a marked rise in trust"* — and **`trust` is not a meter that exists**.

2. **The within-choice "cell collapse" emits a duplicate line.** In `composeChoicesFromSeed`, the Phase-167 block (search `cellLineThisChoice` in `src/cards/cardHelpers.ts`, ~lines 434–460) maps each effect's `(targetKind|direction|magnitudeBand)` cell to a line, and when two effects share a cell it **reuses the same text but still emits one array entry per effect** — so the player sees the identical line twice. Because the key omits the meter, two *different* meters (loyalty +10 and stress −8, both `staff|positive|medium`) collide into one cell. Observed across six families (Appendix A §3).

3. **A flat `maxPreview: 2` hides most consequences, and the only rescue is for coin.** `selectPreviewEffects` (`src/cards/compose/previewSelect.ts`) takes the first two effects, with one exception: a negative `coin` effect past the cap is pulled into view (Phase 166 cost-surfacing). Nothing rescues *pressure* effects, which encode risk relief / escalation (positive pressure = rising/bad, negative = relief/good — see the pressure-block comment in `effectPreviewBase.ts`). Across the sixteen families that surface in a passive playthrough, **92 of 250 authored effects (37%) never reach the player**, and a by-kind breakdown shows **72 of those 92 are player-relevant** (36 meter `state_change`, 36 `pressure`); only 20 are bookkeeping `cause` writes (Appendix A §2). The hidden pressure relief is frequently the single fact that distinguishes one option from another.

4. **The pool vocabulary casts the magnitude as the grammatical subject and the meter as metaphor.** Snippets in `effectPreviewBase.ts` are templated as `{magnitude} would {verb} {target-metaphor}` — e.g. *"a marked rise would back the rota in public"*, *"a clear drop would weigh on the kitchen crew"*. The magnitude words come from `MAGNITUDE_LEXICON` (`src/cards/compose/magnitudeLexicon.ts`: `medium positive` = "a clear lift" / "a real step" / "a marked rise", etc.). To a reader who does not already know the schema, the sentence has no actor and no referent — it reads as mood, not mechanics. This is the deepest "design rule followed as intended": the Voiced Surface philosophy traded mechanical reference for flavour.

**Why no existing gate catches any of this.** The `previewVariety` gate (`src/cards/compose/gates/previewVariety.ts`) checks that lines vary *across* choices and that a banded line contains a magnitude token; its contract **explicitly permits within-choice duplicates** and it never checks that the specific meter is named or that risk is surfaced. The cross-template `legibility` gate (`src/cards/compose/gates/legibility.ts`, invoked from `tests/cards/compose/gates/legibility.test.ts`) already re-derives each line's backing effect and checks `preview_magnitude_missing`, `preview_cost_unsurfaced`, and `preview_inaction_blank` — but it does **not** check meter-naming, duplicate lines, or risk-surfacing. So every current check passes on the defective output.

**The one structural reason the defect is uniform.** There is exactly one choice-preview pipeline. Twenty templates feed it; one cap policy governs it; one coarse key drives both its de-duplication and its prose. Fix the pipeline, the key, the policy, and the pool vocabulary — in that order — and every card is fixed at once; edit a card's pool in isolation and nothing structural changes.

---

## Two principles this arc bakes in

1. **A preview names the real meter, the legible magnitude, and any decision-relevant risk — or the gate fails it.** "Legible" is not "varied prose." A line is legible when a player who has never read the source can tell *which meter* moved, *roughly how much*, and *which way*; and when the choice surfaces the cost it spends and the risk it relieves or incurs. This is the completion of the Phase-147 `requireMagnitude` rule, extended from "a magnitude token is present" to "the meter is named and the risk is shown."

2. **The fix is a contract change, then a policy change, then a prose pass — never a pool rewrite first.** The meter identity must travel on the effect (contract) before any pool can name it or any de-dup can distinguish it; the selection policy must decide *which* effects are shown before the prose pass tunes *how* they read. Authoring meter-aware prose against the old contract would be wasted work. The order is load-bearing.

---

## The spine at a glance

```
  1  Effect Contract: carry the meter        add `meterId` (+ label) to EffectPreview; new
                                              `effectMeter` snippet condition; meter-aware dedup key   ← root of #1 and #2
  2  Selection Policy: show what matters      replace flat maxPreview:2 with decision-relevance
                                              selection (cost AND risk surfaced); collapse identical
                                              rendered lines so no choice ever shows a literal dup     ← root of #2 and #3
  3  Pool Vocabulary: name it, ground it      author meter-named, actor-subject preview prose keyed
                                              on `effectMeter`; retire magnitude-as-subject templates  ← root of #1 and #4
  4  The Legibility Gate, completed           extend gates/legibility.ts Q2 with three rules:
                                              preview_meter_unnamed, preview_duplicate_line,
                                              preview_risk_unsurfaced; run in the standing suite        ← locks 1–3, prevents regression
  5  Drive, tune, deepen                       surface the unsampled families under driven state;
                                              recalibrate band cutoffs; deepen flat cells              ← standing
```

**Ordering rule:** **1 → 2 → 3 → 4 in order.** Phases 2 and 3 both depend on the meter field and condition from Phase 1. Phase 4's gate asserts the outcomes of 1–3 and must land after them so its fixtures are meaningful. Phase 5 is standing and never strictly done. Phase numbers/ISSUE ids are provisional labels; register each in `docs/ISSUE_TRACKER.md` when committed and let the dependency order drive execution, not the integers.

**The scaling unit is one Claude Code session per phase:** read the cited files → make the additive change in-repo → run the cited tests + `npm test` + `npm run typecheck` to green → commit. Each phase below ends with a copy-pasteable plan-mode prompt.

**Out of scope (tracked elsewhere, do not conflate).** `policy_backlash` renders the bare `fallback.everySeed` card (no compositional template, no salience entry) and therefore has no composed previews at all — confirmed by the sweep in Appendix A. That is a *coverage* gap already owned by `docs/plans/complete-surface-arc.md` (its Phase 3, Salience Completeness), not a preview-legibility defect. Phase 4's gate must **exclude the fallback card** from its meter-naming assertion so the two arcs stay decoupled.

---

# Phase 1 — The Effect Contract: carry the meter

**Provisional:** ISSUE-149.

**Goal.** Make the specific meter travel with every effect so the pool can name it and the de-dup can distinguish it. Today the meter leaf is thrown away the moment `effect()` classifies a coarse `targetKind`. This phase adds the leaf (and a human label) to the effect record, adds a snippet condition that reads it, and makes the within-choice de-dup key meter-aware. **No prose and no policy changes in this phase** — it only enriches the contract everything downstream reads.

**Evidence this is the root.** `classifyTargetKind` (`src/sim/modules/issues/generatorHelpers.ts`) maps `staff.server.loyalty`, `staff.server.stress`, and `staff.server.morale` all to `targetKind: 'staff'`; `reputation.respectable` and `reputation.dangerous` both to `'reputation'`; every `pressure:*` to `'pressure'`. The de-dup key in `composeChoicesFromSeed` (`src/cards/cardHelpers.ts`, `cellLineThisChoice`) is `${targetKind}|${direction}|${magnitudeBand}`, so two distinct meters in the same band collide — the source of mechanism #2's duplicate lines.

**The work.**
- In `src/sim/core/effect.ts`, add an optional field to `EffectPreview`: `meterId?: string` (the distinguishing leaf) and `meterLabel?: string` (the player-facing name). Keep them optional so older serialized seeds remain valid — same discipline the existing `targetKind`/`direction`/`magnitudeBand` fields follow.
- In `src/sim/modules/issues/generatorHelpers.ts`, in the `effect()` constructor (the function that already sets `targetKind`/`direction`/`magnitudeBand`), derive `meterId` from `target`: the segment after the final `.` or `:` (`staff.server.loyalty` → `loyalty`; `pressure:staff_loyalty_risk` → `staff_loyalty_risk`; `reputation.respectable` → `respectable`; `coin` → `coin`). Derive `meterLabel` from a single label source — **reuse, do not reinvent**: pressure ids already have labels in `src/sim/modules/pressures/pressureRegistry`, and `src/reports/labels/idLabel.ts` already exposes `humanizeId` and registry-backed reputation labels. The card layer must remain pure and must not import from `src/reports/` (layering — see the header of `src/cards/types.ts`), so put the small label map in the sim/card layer: for `pressure` meters read `pressureRegistry`, for the staff leaves (`loyalty`/`morale`/`stress`/`fatigue`) and reputation axes use a colocated enumerable `Record<string,string>`, and fall back to a local `humanizeId`-style transform for anything unlisted. Set `meterLabel` only when a sensible label exists; leave undefined otherwise.
- In `src/cards/compose/types.ts`, add a new `SnippetCondition` variant `{ kind: 'effectMeter'; anyOf: readonly string[] }` to the union (the effect-condition variants live around lines 126–136, beside `effectTargetKind`/`effectDirection`/`effectMagnitudeBand`).
- In `src/cards/compose/conditions.ts`, add the matching `case 'effectMeter':` evaluator (beside the existing `effectTargetKind`/`effectDirection`/`effectMagnitudeBand` cases, ~lines 235–262): true when `currentEffect?.meterId` is in `anyOf`. Mirror the null-handling of the sibling effect conditions (false when there is no current effect).
- In `composeChoicesFromSeed` (`src/cards/cardHelpers.ts`), change the `cellLineThisChoice` cell key to include the meter: `${targetKind}|${meterId}|${direction}|${magnitudeBand}`. This stops two distinct meters from collapsing into one cell. (The duplicate *text* may persist until Phase 3 teaches the pool to name the meter; that is expected — this phase only stops the false collapse, verified by distinct keys, not by absence of duplicate prose.)

**Read first.** `src/sim/core/effect.ts` (the `EffectPreview` type + `EffectTargetKind`). `src/sim/modules/issues/generatorHelpers.ts` (`effect()`, `classifyTargetKind`, `classifyMagnitudeBand`). `src/cards/compose/types.ts` (the `SnippetCondition` union). `src/cards/compose/conditions.ts` (the effect-condition cases). `src/cards/cardHelpers.ts` (`composeChoicesFromSeed`, the `cellLineThisChoice` block). `src/reports/labels/idLabel.ts` and `src/sim/modules/pressures/pressureRegistry` (existing label sources to reuse, not to import from reports into cards).

**Done when.** `EffectPreview` carries `meterId` and `meterLabel`, populated by `effect()` for every emission; an `effectMeter` snippet condition exists and evaluates against `currentEffect.meterId`; the within-choice de-dup key includes the meter so two distinct meters no longer share a cell (add a unit test that constructs a choice with loyalty+10 and stress−8 and asserts they receive distinct cell keys); `npm test` and `npm run typecheck` are green. No pool text changed; no `maxPreview` changed.

**Do not do.** Don't change any preview prose yet (Phase 3). Don't change `maxPreview` or `selectPreviewEffects` yet (Phase 2). Don't import `src/reports/` from `src/cards/` — keep the card layer pure. Don't make `meterId`/`meterLabel` required — optional preserves old serialized seeds, exactly as the existing classified fields do.

```
Enter plan mode. Choice-Preview Legibility arc, Phase 1 (Effect Contract: carry the meter).
Read src/sim/core/effect.ts (EffectPreview + EffectTargetKind), generatorHelpers.ts
(effect(), classifyTargetKind, classifyMagnitudeBand), src/cards/compose/types.ts
(SnippetCondition union), src/cards/compose/conditions.ts (the effect* cases),
src/cards/cardHelpers.ts (composeChoicesFromSeed, the cellLineThisChoice block),
and the existing label sources src/reports/labels/idLabel.ts + pressureRegistry.
Write a phase plan in docs/plans/ to (a) add optional meterId + meterLabel to
EffectPreview, populated in effect() from the target leaf, with labels reused from
pressureRegistry / an enumerable colocated map (NO import of src/reports into
src/cards); (b) add an effectMeter snippet condition (types.ts + conditions.ts
evaluator on currentEffect.meterId); (c) include meterId in the within-choice
cellLineThisChoice de-dup key. Additive, deterministic, no prose or cap changes.
Add a unit test proving two distinct meters get distinct cell keys. Wait for approval.
```

---

# Phase 2 — Selection Policy: show what matters, never show a literal duplicate

**Provisional:** ISSUE-150. **Depends on Phase 1.**

**Goal.** Two fixes to how the preview *array* is assembled, both in the selection/assembly layer, neither touching prose. First: replace the flat "first two effects + coin rescue" with a decision-relevance selection that also surfaces a choice's headline **risk/pressure** change, so the player is no longer shown two vague lines while the fact that distinguishes the option is hidden. Second: guarantee a choice never renders two identical preview lines.

**Evidence.** `selectPreviewEffects` (`src/cards/compose/previewSelect.ts`) returns the first `previewMax` effects, rescuing only a negative-`coin` effect past the cap. The sweep (Appendix A §2) shows 72 player-relevant effects hidden across sixteen families — 36 of them `pressure` changes, which are the risk-relief/escalation signals (the pressure-block comment in `effectPreviewBase.ts` documents positive = rising/bad, negative = relief/good). E.g. on the `staff_identity` card, "Back them in public" hides `pressure:staff_loyalty_risk −8` ("she's less likely to quit"), arguably the whole point of the choice. Separately, the `cellLineThisChoice` reuse in `composeChoicesFromSeed` emits the same line once per effect, producing the visible duplicates in six families (Appendix A §3).

**The work.**
- Extend `selectPreviewEffects` (keep it pure; both the renderer and the `legibility` gate import it, so they must stay in lockstep — see the file's own header) with a **risk-surfacing** rescue analogous to the existing cost rescue: if a choice carries a `pressure` effect whose direction marks a meaningful risk change and it would fall past the cap, pull it into the previewed set (without displacing the cost line the existing rule guarantees). Decide and document the priority order — suggested: (1) the seed's headline-meter `state_change`, (2) any negative-`coin` cost, (3) the headline-`pressure` change — and keep it data-driven and enumerable, not a closure the gate can't read.
- Decide the cap. The flat `2` is the proximate cause of the 37% hidden. Either raise the default (e.g. to `3`) or, better, make the cap the *minimum* that fits cost + risk + headline meter, capped at a small ceiling so the card stays scannable on a phone. Apply the decision once in `composeChoicesFromSeed` / the templates' shared options, not per-template — the twenty templates currently duplicate `maxPreview: 2` and should converge on one source of truth.
- In `composeChoicesFromSeed` (`src/cards/cardHelpers.ts`), after composing `composedPreview`, **collapse identical rendered lines** so the array never contains a literal duplicate (drop a line that exactly equals one already emitted for the same choice). With Phase 1's meter-aware key plus the `usedPreviews` avoid-set, distinct meters should already compose distinct lines; this is the belt-and-suspenders guarantee that closes mechanism #2 even where a pool still lacks a meter-specific candidate.

**Read first.** `src/cards/compose/previewSelect.ts` (the cost-rescue policy to extend). `src/cards/cardHelpers.ts` (`composeChoicesFromSeed`: the `selectPreviewEffects` call, the `cellLineThisChoice` block, the `usedPreviews` avoid-set). The `maxPreview: 2` line in any template (e.g. `src/cards/templates/staffAside.ts`) and the shared options shape in `cardHelpers.ts`. The pressure-direction semantics comment in `src/cards/compose/pools/_shared/effectPreviewBase.ts`.

**Done when.** A choice that relieves or incurs a headline risk shows that pressure line within the cap (add a test on a `staff_identity`-style profile asserting the `staff_loyalty_risk` relief is surfaced); no rendered choice contains two identical preview lines (add a test asserting de-duplication on a two-same-cell profile); the cap policy lives in one place, not twenty; `selectPreviewEffects` remains pure and shared with the gate; `npm test` and `npm run typecheck` green.

**Do not do.** Don't change effect *mechanics* — verbs, targets, amounts, and the order in the consequence profile are untouched; this only changes which effects the preview *renders* and how the array is de-duplicated (the same boundary the existing Phase-166 cost rescue respects). Don't author or reword prose (Phase 3). Don't raise the cap so high the card overflows a phone screen — favour a priority rule over a big number. Don't fork `selectPreviewEffects` for the gate — extend the shared function.

```
Enter plan mode. Choice-Preview Legibility arc, Phase 2 (Selection Policy). Depends on Phase 1.
Read src/cards/compose/previewSelect.ts (selectPreviewEffects cost rescue),
src/cards/cardHelpers.ts (composeChoicesFromSeed: the selectPreviewEffects call,
cellLineThisChoice, usedPreviews), a template's maxPreview:2 line, and the
pressure-direction comment in effectPreviewBase.ts. Write a phase plan in docs/plans/
to (a) extend selectPreviewEffects with a risk/pressure-surfacing rescue beside the
coin rescue, with a documented enumerable priority (headline state_change > cost >
headline pressure); (b) move the cap to one source of truth and replace the flat 2
with a priority rule that always fits cost + risk + headline meter under a small
ceiling; (c) de-duplicate identical rendered preview lines within a choice in
composeChoicesFromSeed. Mechanics (verb/target/amount/order) untouched; no prose
changes; selectPreviewEffects stays pure and shared with the legibility gate. Add
tests for risk-surfaced and no-duplicate-line. Wait for approval.
```

---

# Phase 3 — Pool Vocabulary: name it, ground it

**Provisional:** ISSUE-151. **Depends on Phase 1 (and is authored against Phase 2's selection).**

**Goal.** Make the preview prose say what moved. Replace the magnitude-as-subject, meter-as-metaphor templates with lines that name the real meter (using Phase 1's `meterId`/`meterLabel` via the `effectMeter` condition) and put the change in a readable order: roughly *"<meter> would <direction-verb> <magnitude>"* (e.g. "loyalty would rise a clear step", "the inspection risk would ease a notch"), so the line reads as mechanics, not mood — while keeping it inside the 10-word effect-preview budget and keeping the calibrated magnitude tokens.

**Evidence.** The shared base `narratorEffectPreviewBase()` (`src/cards/compose/pools/_shared/effectPreviewBase.ts`) authors snippets keyed only on `(effectTargetKind × effectDirection × effectMagnitudeBand)` with text like "a hair of coin would slip from the purse" — naming the coarse kind, never the leaf meter. Per-family `effectPreview.ts` pools (e.g. `src/cards/compose/pools/staffAside/effectPreview.ts`) layer on top with the same grammar. The magnitude vocabulary is in `MAGNITUDE_LEXICON` (`src/cards/compose/magnitudeLexicon.ts`); the `requireMagnitude` rule in `previewVariety.ts` and `legibility.ts` requires a banded line to contain one of these tokens, so the magnitude words must stay.

**The work.**
- For the meters that actually appear on choices (start with the high-traffic ones the sweep names: staff `loyalty`/`morale`/`stress`/`fatigue`; `coin`; the headline pressures like `staff_loyalty_risk`/`staff_burnout`/`rumour_pressure`/`inspection`-related; reputation axes; the customer/cohort meters), add meter-specific snippets gated on `{ kind: 'effectMeter', anyOf: [...] }` (plus the existing direction × band conditions) to the shared base and/or the relevant per-family pools. Each snippet names the meter (ideally by interpolating `meterLabel` if the snippet system supports glue substitution, otherwise by authoring the label into the text) and uses an actor/subject-first grammar rather than magnitude-first.
- Keep every banded line carrying a `MAGNITUDE_LEXICON[direction][band]` token so `requireMagnitude` stays satisfied; keep within the 10-word budget enforced by the voice-bounds gate; keep snippets canonically distinct so the dedupe gate stays quiet (the base's header documents these constraints — honour them).
- Where a meter has no specific snippet yet, the coarse base line still fires (graceful degradation). Authoring is additive: new higher-specificity rungs out-rank the generic base via the existing FNV/specificity tie-break; do not delete the base — it remains the fallback for unlisted meters.
- Re-run the per-family card tests and the cross-sim `legibility` harness as you go.

**Read first.** `src/cards/compose/pools/_shared/effectPreviewBase.ts` (the base grammar + the constraints in its header). One per-family pool, e.g. `src/cards/compose/pools/staffAside/effectPreview.ts`. `src/cards/compose/magnitudeLexicon.ts` (the tokens that must remain). `src/cards/compose/conditions.ts` (the new `effectMeter` condition from Phase 1). `src/cards/compose/gates/previewVariety.ts` (`requireMagnitude`, so you keep it green). How a snippet interpolates dynamic text, if at all — inspect `pickSnippet` / `assembleSlots` in `src/cards/compose/` to see whether label glue is available or whether the label is authored into the snippet text.

**Done when.** For the high-traffic meters, a rendered preview line names the meter and reads subject-first while still carrying a magnitude token; the metaphor-only, magnitude-as-subject lines for those meters are retired in favour of the named ones; the coarse base remains as the unlisted-meter fallback; `previewVariety` / voice-bounds / dedupe gates stay green; `npm test` and `npm run typecheck` green. (The standing meter-naming guarantee is enforced by Phase 4's gate; this phase does the authoring.)

**Do not do.** Don't remove the shared base or its magnitude tokens. Don't exceed the 10-word budget or introduce actor-role nouns the sim-coherence gate forbids (see the base header). Don't change effect mechanics or selection (Phases 1–2 own those). Don't try to author a snippet for every meter in one session — cover the high-traffic meters the sweep names; the rest deepen under Phase 5.

```
Enter plan mode. Choice-Preview Legibility arc, Phase 3 (Pool Vocabulary). Depends on Phase 1.
Read src/cards/compose/pools/_shared/effectPreviewBase.ts (base grammar + header
constraints), a per-family pool (e.g. staffAside/effectPreview.ts), magnitudeLexicon.ts
(tokens to keep), the new effectMeter condition in conditions.ts, previewVariety.ts
(requireMagnitude), and pickSnippet/assembleSlots to learn whether label glue is
available. Write a phase plan in docs/plans/ to add meter-named, subject-first
preview snippets gated on effectMeter (+ direction × band) for the high-traffic
meters (staff loyalty/morale/stress/fatigue, coin, headline pressures, reputation
axes, customer/cohort), each keeping a MAGNITUDE_LEXICON token and the 10-word
budget, retiring the magnitude-as-subject metaphor lines for those meters while
leaving the coarse base as the unlisted-meter fallback. Additive; gates stay green.
Wait for approval.
```

---

# Phase 4 — The Legibility Gate, completed

**Provisional:** ISSUE-152. **Depends on Phases 1–3. The lock.**

**Goal.** Make the three fixes un-regressable. Extend the existing cross-template `legibility` gate so that, for every migrated template's production `CardView`, it asserts: every state-change preview line **names its meter**, no choice renders a **duplicate line**, and every choice with a decision-relevant **pressure/risk** change **surfaces it** — the standing analogue of the existing `preview_cost_unsurfaced` rule, for risk.

**Evidence the right home is the existing gate.** `src/cards/compose/gates/legibility.ts` already (its Q2) renders the production `CardView`, walks each `CardChoice`, re-derives the per-line `EffectPreview` by mirroring `composeChoicesFromSeed`'s source logic via the shared `selectPreviewEffects`, and fails on `preview_magnitude_missing` / `preview_cost_unsurfaced` / `preview_inaction_blank`. Adding rules there reuses the harness, the sampler set, and the effect-rederivation rather than duplicating them.

**The work.**
- Add three reasons to `legibility.ts` Q2:
  - `preview_meter_unnamed` — a previewed `state_change` effect carries a `meterId`/`meterLabel`, but the rendered line contains no token derived from that meter's label (mirror the `requireMagnitude` carve-out: a line that exactly equals `effect.readable` counts as legible, deferring to sim authority).
  - `preview_duplicate_line` — a single choice rendered two identical preview lines. (This is the rule `previewVariety` deliberately omits; the deliberate omission is documented in `composeChoicesFromSeed`'s comments and is being reversed here on purpose.)
  - `preview_risk_unsurfaced` — a choice carries a decision-relevant `pressure` effect (per Phase 2's priority definition) and no rendered line surfaces it. Reuse the shared selection so the gate and renderer never disagree about what "shown" means.
- **Exclude the `fallback` card** from `preview_meter_unnamed` (it is not a compositional template; its no-preview state is a coverage matter owned by `complete-surface-arc.md`).
- Add deliberately-failing fixtures next to the existing ones in `tests/cards/compose/gates/legibility.test.ts`: a choice with a duplicate line (fails), a choice hiding a headline pressure (fails), a state-change line that names no meter (fails), and the corrected counterparts (pass).
- Keep the gate cross-template and out of `runAllGates` (the precedent set in the file's header and shared with `crossSituation`); confirm it runs in the default `npm test` suite.

**Read first.** `src/cards/compose/gates/legibility.ts` (Q2 and its existing reasons). `tests/cards/compose/gates/legibility.test.ts` (how it is invoked + the existing fixtures). `src/cards/compose/previewSelect.ts` (the shared selection the gate reuses). `src/cards/compose/gates/previewVariety.ts` (`requireMagnitude` as the carve-out precedent). `src/cards/templates/index.ts` (`REQUIRED_CARDS` and `FALLBACK_CARD_ID`, to scope the meter rule).

**Done when.** `legibility.ts` fails on an unnamed-meter state-change line, on a within-choice duplicate, and on an unsurfaced headline risk; the fallback card is excluded from the meter rule; the new failing fixtures fail and their corrected forms pass; the gate runs in the default suite; `npm test` and `npm run typecheck` green; running the gate over all migrated templates is clean (this is the proof Phases 1–3 actually landed).

**Do not do.** Don't fold this into `runAllGates` — it is cross-template by construction. Don't assert on exact wording — assert that the meter is named, the magnitude token is present, the line is unique, and the risk is shown. Don't relax a Phase-1–3 change to make an old fixture pass; if a real template still fails, fix the pool (Phase-3 work), not the gate.

```
Enter plan mode. Choice-Preview Legibility arc, Phase 4 (The Legibility Gate, completed).
Depends on Phases 1-3. Read src/cards/compose/gates/legibility.ts (Q2 + existing
reasons), tests/cards/compose/gates/legibility.test.ts (invocation + fixtures),
previewSelect.ts (shared selection), previewVariety.ts (requireMagnitude carve-out),
and templates/index.ts (REQUIRED_CARDS, FALLBACK_CARD_ID). Write a phase plan in
docs/plans/ to add three Q2 rules — preview_meter_unnamed (state_change line must
name its meterLabel; readable-fallback exempt), preview_duplicate_line (no identical
lines within a choice), preview_risk_unsurfaced (decision-relevant pressure must be
shown, reusing the shared selection) — excluding the fallback card from the meter
rule, with failing + corrected fixtures, kept cross-template and out of runAllGates,
running in the default suite. Assert structure, not wording. Wait for approval.
```

---

# Phase 5 — Drive, tune, deepen

**Provisional:** ISSUE-153. **Standing — never strictly done.**

**Goal.** Close the sampling gap, then tune. Three of twenty families (`food_safety`, `regular_customer`, `rumour_crisis`) did not surface in a passive playthrough and are unverified (Appendix A); drive them into existence with scripted adverse state and confirm the gate passes for them. Then, from play, deepen meter-named lines that read flat, and recalibrate the band cutoffs (`MAGNITUDE_BAND_CUTOFFS` in `generatorHelpers.ts`) where a cut-point makes a real change read as the wrong magnitude.

**The work.**
- Use the cardless runner with a scripted chooser (`src/sim/testing/simRunner.ts` + `policyBots.ts`) or a constructed state to drive `food_safety` / `regular_customer` / `rumour_crisis` to surface, render them, and confirm Phase 4's gate is clean for them; author any missing meter snippets the gate flags.
- From playtest notes focused on *legibility in play*, deepen flat lines (a third-month loyalty collapse in a high-relationship situation earns a sharper line than the generic cell) and recalibrate band cutoffs where play shows a cut-point reads wrong. Every change re-runs the full suite + the legibility gate.

**Done when.** All twenty families render previews the legibility gate passes (no family unverified); band cutoffs reflect play; standing — no final checkmark by design.

```
Enter plan mode. Choice-Preview Legibility arc, Phase 5 (Drive, tune, deepen). Standing.
Read src/sim/testing/simRunner.ts + policyBots.ts (the cardless runner + bots) and
MAGNITUDE_BAND_CUTOFFS in generatorHelpers.ts. Write a phase plan in docs/plans/ to
(a) drive food_safety, regular_customer, rumour_crisis into existence with scripted
adverse state and confirm the Phase-4 gate passes for them, authoring any meter
snippets it flags; (b) from playtest notes, deepen flat meter-named lines and
recalibrate band cutoffs where a cut-point reads wrong. Every change passes the full
suite + the legibility gate. Wait for approval.
```

---

## If you only remember three things

1. **One pipeline, three coupled defects, twenty cards.** Every template feeds `composeChoicesFromSeed` (`src/cards/cardHelpers.ts:361`) with `maxPreview: 2`. The coarse `(targetKind, direction, magnitudeBand)` key discards the meter, the flat cap hides 37% of effects (72 of 92 hidden effects are player-relevant), and the pool speaks in metaphor. Fix the pipeline, not the cards.
2. **Contract → policy → prose → gate, in that order.** The meter must ride on the effect (Phase 1) before the de-dup can distinguish it or the pool can name it; the selection must decide what's shown (Phase 2) before the prose tunes how it reads (Phase 3); the gate (Phase 4) locks all three.
3. **The gate already exists — extend it.** `src/cards/compose/gates/legibility.ts` Q2 already re-derives each preview line's effect. Add `preview_meter_unnamed`, `preview_duplicate_line`, `preview_risk_unsurfaced`; exclude the fallback card; run it in the standing suite.

---

# Appendix A — The audit that motivated this arc (2026-05-30)

Recorded here so the arc's premises are auditable **from the repo alone**. Reproduce with the instruments in Appendix B.

**§1 — One card, traced end to end (`staff_identity` → `staff_aside` template).** The "Comfort" choice's consequence profile (`src/sim/modules/issues/expandedSeedGenerators.ts`, `comfort_staff_profile`) authors four immediate effects: loyalty +10, stress −8, morale +6, gratitude (`cause`) +5. With `maxPreview: 2` the player sees two lines, both rendered as *"the crew would feel a marked rise in trust"* — a duplicate, naming a meter ("trust") that does not exist. The two shown effects (loyalty +10 and stress −8) both classify to cell `staff|positive|medium`, so the within-choice collapse reused one line and emitted it twice.

**§2 — Cross-family sweep (single passive pass, 220 days/seed, 8 seeds; 16 of 20 families surfaced).**

| family | template | fb | choices | dup-choices | hidden-effect choices | raw effects | shown | hidden | meter-collapse |
|---|---|---|---|---|---|---|---|---|---|
| stock_shortage | stock_shortage.warning | · | 5 | 0 | 2 | 10 | 8 | 2 | 0 |
| maintenance | maintenance.maintenance_problem | · | 4 | 0 | 1 | 9 | 7 | 2 | 0 |
| staff_burnout | staff_burnout.staff_request | · | 4 | 0 | 1 | 9 | 8 | 1 | 0 |
| customer_complaint | customer_complaint.complaint | · | 6 | 2 | 6 | 32 | 12 | 20 | 10 |
| violence | violence.customer_incident | · | 4 | 0 | 1 | 9 | 8 | 1 | 0 |
| debt_rent | debt_rent.debt_pressure | · | 4 | 0 | 1 | 7 | 6 | 1 | 2 |
| inspection | inspection.inspection_threat | · | 7 | 3 | 7 | 32 | 14 | 18 | 8 |
| reputation_shift | reputation_shift.reputation_shift | · | 4 | 0 | 0 | 6 | 6 | 0 | 0 |
| monthly_review | monthly_review.monthly_review | · | 4 | 0 | 1 | 8 | 7 | 1 | 0 |
| staff_identity | staff_identity.staff_aside | · | 6 | 2 | 5 | 23 | 12 | 11 | 10 |
| supplier_relationship | supplier_relationship.supplier_offer | · | 6 | 1 | 6 | 23 | 12 | 11 | 8 |
| faction_request | faction_request.social_conflict | · | 6 | 0 | 4 | 16 | 12 | 4 | 0 |
| culture_conflict | culture_conflict.social_conflict | · | 6 | 1 | 4 | 16 | 12 | 4 | 4 |
| area_atmosphere | area_atmosphere.warning | · | 6 | 1 | 3 | 15 | 12 | 3 | 7 |
| seasonal_arc | seasonal_arc.arc_milestone | · | 5 | 0 | 5 | 19 | 10 | 9 | 4 |
| rival_tavern | rival_tavern.social_conflict | · | 6 | 0 | 4 | 16 | 12 | 4 | 4 |
| policy_backlash | **fallback.everySeed** | **Y** | 6 | 0 | 0 | 12 | 12 | 0 | 2 |

Totals (template-rendered families): 6/16 have a duplicate-line choice; 15/16 hide ≥1 effect; 9/16 collapse distinct meters; **92 of 250 effects (37%) hidden**. Hidden-by-kind: **36 `state_change` + 36 `pressure` (= 72 player-relevant) + 20 `cause` (bookkeeping)**. Not surfaced under passive play (need driven adverse state): `food_safety`, `regular_customer`, `rumour_crisis`.

**§3 — Duplicate exemplars (six families, identical mechanism, different words).**
- customer_complaint — "Side with Master Faline Cargoright" → "a clear lift would settle the guest into the bench" ×2
- inspection — "Scrub it" → "a measure of new timber would brace the room" ×2
- staff_identity — "Comfort Mira the Resolute" → "the crew would feel a marked rise in trust" ×2
- supplier_relationship — "Accept suspicious goods" → "the meter would climb a notch on the reading" ×2
- culture_conflict — "Mediate between groups" → "a marked rise would steady the folk in the room" ×2
- area_atmosphere — "Send the cleaning crew" → "a quick patch would lift the corner a step" ×2

---

# Appendix B — The verification instruments (committed at `_audit/`)

These are part of this arc's deliverable. Commit them at `_audit/` and re-run them at the start of each phase to confirm progress; they depend only on `prando` + `zod` (already in `package.json`) and run under `npx tsx`.

- **`_audit/dumpStaffIdentity.ts`** — freezes the seam for one family: runs `runCardlessSim` over `FULL_PIPELINE`, surfaces the first card of `FAMILY` (default `staff_identity`) via `getAllSeedsToday`, renders it with `pickCard`, and prints each choice's composed preview text beside its raw consequence-profile effects (with `targetKind`/`direction`/`magnitudeBand` and the de-dup cell key). Use it to watch a specific card's previews change as Phases 1–3 land. Run: `npx tsx _audit/dumpStaffIdentity.ts` (or `FAMILY=inspection npx tsx _audit/dumpStaffIdentity.ts`).
- **`_audit/sweepFamilies.ts`** — single deterministic pass per seed that harvests the first card of every family and tabulates the four mechanisms (duplicate-line choices, hidden-effect choices, hidden count, meter-collapse), plus a summary and fallback/unsurfaced lists. This is the §2 table generator and the regression check: after Phase 4, the dup and meter-collapse columns should fall to zero for template-rendered families. Run: `npx tsx _audit/sweepFamilies.ts`.
- **`_audit/hiddenByKind.ts`** — same single pass, but classifies the hidden effects by kind (the 36/36/20 split), so the "player-relevant vs bookkeeping" claim stays honest. Use it to confirm Phase 2 reduces hidden *player-relevant* effects. Run: `npx tsx _audit/hiddenByKind.ts`.

(If `node_modules` is absent, the only runtime deps are `prando` and `zod`; `npm install` restores them from the committed lockfile.)
