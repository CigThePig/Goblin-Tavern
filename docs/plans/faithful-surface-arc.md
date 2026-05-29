# The Faithful Surface Arc — Stop the Surface Lying About the Sim

**Voiced Surface made every line speak. Legible Surface made the establishing line state a real fact. This arc fixes what those two arcs left broken:** two-thirds of every card — the flavor lines and the choices — were never held to a coherence contract, and the gates that were supposed to enforce one were exercising synthetic stubs that didn't have the shape of a real seed. An end-to-end audit over 2,578 cards / 14,112 choices found four classes of defect at scale, and one structural reason every gate was green while every defect shipped.

This is a five-phase remediation arc, not another seventeen. The work is large but bounded: one foundation phase, three content/architecture phases, one closing phase that wires the audit into the standing bar so this can't drift again.

## The diagnosis in one screen

1. **Preview direction is inverted for every lower-is-better meter** (339 mismatches across staff/area/culture cards). `classifyDirection(amount)` returns `amount > 0 ? 'positive' : 'negative'` — the arithmetic sign of the number, with no concept of *valence*. "Comfort Mira" reduces her stress by 8, the sim tags that `direction: negative`, and the preview pool faithfully renders the negative-staff line "the rota would slip a real step thinner." The player is told a kindness makes things worse. The codebase already documents that polarity is meaning-laden ("high reliability is good; high stress is bad") — that knowledge reached establishing-line authors and never reached the effect-preview layer.

2. **Previews collapse to identical lines across mechanically distinct choices** (4,368 occurrences). On a Town Watch card, three different actions all render "a clear lift would draw the faction closer" because they all carry a generic `+relationship` effect and the preview keys only on `(targetKind, direction, band)`.

3. **Labels collide across opposite actions** (161 cases). `negotiate_terms` (compromise) and `play_rival_faction` (deception) both have `allowedVerbs: ['negotiate']`; the label pool gates on verb only, so a terse faction renders "Strike a quick bargain" for both. The Phase-3 `responseSlot` primitive built to fix this exists but the pools never use it. Plus the renderer prints raw `{verb} · {shape}` taxonomy ("RELATIONSHIP SACRIFICE", "SAFE COSTLY") below every choice.

4. **Flavor lines contradict the sim-backed line** (178 cases). `aside_line` "I've been carrying a heavy hush since dawn" is gated *only* on Mira's personality (floridity ≥ 2), zero state conditions — byte-identical at low, mid, and high stress. At low stress it directly contradicts the establishing line. The multi-fact join staples non-cohering facts the same way ("the week has not landed on them yet — Something's been pulling them away from the work").

**The one reason none of this was caught.** Every gate that touches choices, previews, or labels — `choiceDistinctness`, `previewVariety`, `legibility` — runs against **synthetic test seeds, not production seeds**. The faction sampler calls `makeSeed()` *without `responseSlots`*, so it gets a generic two-slot stub ("Address the issue" / "Push through it" with one +5 cleanliness effect). None of the fifteen samplers feed real slots. The collisions, the duplicate previews, and the direction inversions all need real seed structure to surface — and the gates structurally cannot see structure that isn't there. **The choice-quality layer was validated against a shape players never see.**

This is why "2,589/2,589 green" and "the text rarely makes sense" are both true. The bones of the arc are sound; the connective tissue is wrong, and the way it's wrong made it invisible.

## The spine

```
  1  Restore the Test Contract     gates exercise real generator seeds — everything else depends on this
  2  Meter Valence                  add the missing polarity layer; previews stop reading negative-good as bad
  3  Distinguishable Choices        labels discriminate slot identity; previews discriminate the effect;
                                     renderer stops leaking raw verb/shape taxonomy
  4  Flavor That Doesn't Lie        flavor slots gate on state where coherence demands it;
                                     multi-fact join stops stapling contradictory facts
  5  Close the Loop                 standing audit + gate harness assertions wired against real seeds
```

**The hard prerequisite:** Phase 1 first. Without real-seed samplers, every fix in 2–4 will pass tests while still being broken — the same way the prior arc shipped. Phases 2–4 then proceed in order (2 fixes the data, 3 fixes the choice surface, 4 fixes the body surface); each is independently testable once Phase 1 lands. Phase 5 closes everything.

**Expect Phase 1 to turn the suite very red before it gets green.** That redness is the value: every test that breaks when samplers switch to real seeds is a test that was validating the wrong thing. The triage is mechanical — fix the gate threshold or the pool until the real-seed render passes the rule that was always meant to apply.

**Provisional numbering:** phases 163–167 / ISSUE-131–135, continuing from Legible Surface's standing Phase 17.

---

## Phase 1 — Restore the Test Contract

**Provisional:** phase 163 / ISSUE-131.

**Goal.** Make every choice/preview/label gate exercise the seed shape players actually see. The `*SeedFor` factories in `tests/cards/compose/gates/samplers.ts` currently call `makeSeed()` without `responseSlots` or `consequenceProfiles`, inheriting a two-slot stub that shares almost nothing with production. Replace those stubs with real generator output (or carefully-constructed equivalents) so the gates audit the structure the surface is actually built on. Until this is done, no other phase in this arc can be verified.

**The work.**
- For each of the fifteen `*SeedFor` factories (`staffAsideSeedFor`, `staffBurnoutSeedFor`, `supplierOfferSeedFor`, `regularComplaintSeedFor`, `customerComplaintSeedFor`, `factionRequestSeedFor`, `foodSafetyCrisisSeedFor`, `violenceSeedFor`, `inspectionSeedFor`, `reputationShiftSeedFor`, `rumourCrisisSeedFor`, `rivalTavernSeedFor`, `seasonalArcSeedFor`, plus the two complaint variants), build the seed by **running the real generator function** with a deterministic RNG over the relevant `SimContext`, or by extracting the real `responseSlots` + `consequenceProfiles` arrays and inlining them. Prefer the former — it stays in sync with generator changes automatically.
- Treat the existing `makeSeed()` factory in `tests/cards/cardFactories.ts` as **deliberately minimal** — it stays as-is for tests that only need a seed shell, but the gate samplers no longer use its slot defaults.
- Run `npm test`. Catalog every newly-failing test. Each one is either (a) a pool that was passing only because the gate ran against stubs — fix the pool, or (b) a gate threshold that was too tight for real seed variety — fix the threshold. Do not loosen a gate to silence a real defect; the whole point of this phase is to surface them.
- The `legibilityHarness.ts` registry continues to pull from these samplers; no shape change to the gate itself.

**Read first.** `tests/cards/compose/gates/samplers.ts` (the fifteen `*SeedFor` functions and what they pass to `makeSeed`). `tests/cards/cardFactories.ts` lines 50–125 (the `makeSeed` default slot stub). `src/sim/modules/issues/issueSeedGenerators.ts` + `expandedSeedGenerators.ts` (the real generators — and the `SimContext` shape they need). `src/cards/compose/gates/legibility.ts` (so you can see what shape the gate expects samples in).

**Done when.** Every gate sampler emits seeds whose `responseSlots` and `consequenceProfiles` match production verbs/shapes/targets/amounts; the full suite is green again (after triaging real defects exposed by the switchover); a new headline test asserts each sampler's seed has ≥3 response slots (the synthetic-stub-detection canary); `npm test` + `npm run typecheck` green.

**Do not do.** Don't loosen a gate to keep an old test green — if the rule was right, the pool is wrong. Don't keep stub-shaped samplers "for speed" — the gates exist to find real-seed defects. Don't change any pool content in this phase except where strictly necessary to keep a test green; pool authoring is Phases 2–4.

```
Enter plan mode. Faithful Surface arc, Phase 1 (Restore the Test Contract).
Read tests/cards/compose/gates/samplers.ts (the 15 *SeedFor factories),
tests/cards/cardFactories.ts (the makeSeed default-slot stub),
src/sim/modules/issues/{issueSeedGenerators,expandedSeedGenerators}.ts (real
generators + SimContext shape), and src/cards/compose/gates/legibility.ts.
Write a phase plan in docs/plans/ to (a) rebuild every *SeedFor factory so it
emits responseSlots + consequenceProfiles matching production — prefer running
the real generator with a deterministic RNG over inlining; (b) keep
cardFactories.makeSeed as-is for non-gate tests; (c) triage every newly-failing
test, classifying each as pool-defect or threshold-defect, and resolving each
by fixing the pool, not loosening the gate; (d) add a canary test asserting
each sampler's seed has ≥3 response slots. Wait for plan approval.
```

---

## Phase 2 — Meter Valence

**Provisional:** phase 164 / ISSUE-132.

**Goal.** Add the missing polarity layer so effect direction means *good or bad for the player*, not *positive or negative arithmetic sign*. Today `staff.stress -8` (a kindness) renders the same way as `staff.morale -8` (a loss), because both share `direction: negative`. The fix is a single canonical valence map, threaded into `classifyDirection` so the surface composition layer reads valence-aware direction without every author having to remember which meters are inverted.

**The work.**
- Add `METER_VALENCE: Record<EffectTargetKind | targetMeterId, 'higherIsBetter' | 'lowerIsBetter'>` as data, beside `BAND_THRESHOLDS`. Cover the eight or so inverted meters explicitly: `staff.stress`, `staff.fatigue`, `area.damage`, `culture.tension`, `customer_group.rowdiness`, the `pressure.*` family (rising is bad), `regular.irritation`, `supplier_distrust` and similar pressure-style targets. Everything else defaults to higher-is-better.
- Extend `classifyDirection(amount, target?)` to a two-argument form: if `target` resolves to a `lowerIsBetter` meter, invert the sign before classifying. Old callers without `target` keep the arithmetic behavior (they should be updated, but the default doesn't regress them).
- Update `generatorHelpers.ts` `makeEffect()` / `effect()` to pass `target` through. Every effect produced by the generators now carries valence-aware `direction`.
- Re-run the comprehensive render audit (Phase 5 will codify it; for this phase, run it ad-hoc). Confirm the 339 staff/customer mismatches collapse. The preview pools themselves do **not** need re-authoring — they were already correctly gated on `direction`; they were just being fed the wrong signal.
- The valence map is the authoritative source of polarity. Where individual snippet authors had locally compensated by writing "stress would settle" on `direction: negative` (rare but present), those compensations now read wrong and need rewording to the canonical positive-direction vocabulary.

**Read first.** `src/sim/modules/issues/generatorHelpers.ts` `classifyDirection` (line 133), `classifyMagnitudeBand`, `makeEffect`/`effect`. `src/sim/core/effect.ts` (`EffectDirection`, `EffectTargetKind`). `src/sim/signals/types.ts` lines 50–75 (the existing doc comment that already knows polarity is meaning-laden). `src/cards/compose/pools/_shared/effectPreviewBase.ts` (the staff/area/pressure/culture blocks — to confirm what they assume about direction).

**Done when.** A canonical `METER_VALENCE` map covers every effect target the generators emit; `classifyDirection` is valence-aware; the audit shows zero direction mismatches on staff/customer/area/culture/pressure previews; any locally-compensating snippets are reworded; full suite + typecheck green.

**Do not do.** Don't add a per-snippet "this means good actually" override — valence belongs in the data, once. Don't redefine `EffectDirection` to be three-valued (good/bad/neutral) and split from sign — keep `direction` as the surface contract, change only what `direction` *means* underneath. Don't touch the magnitude lexicon — magnitude bands are direction-symmetric and the lexicon design is sound.

```
Enter plan mode. Faithful Surface arc, Phase 2 (Meter Valence).
Read src/sim/modules/issues/generatorHelpers.ts (classifyDirection,
classifyMagnitudeBand, makeEffect/effect), src/sim/core/effect.ts,
src/sim/signals/types.ts lines 50-75 (the doc comment that already names
polarity as meaning-laden), and src/cards/compose/pools/_shared/
effectPreviewBase.ts (staff/area/pressure/culture blocks). Write a phase plan
in docs/plans/ to (a) add METER_VALENCE as data alongside BAND_THRESHOLDS,
covering staff.stress, staff.fatigue, area.damage, culture.tension,
customer_group.rowdiness, pressure.*, regular.irritation, and similar
lower-is-better targets; (b) extend classifyDirection to read target and
invert before classifying; (c) thread target through every effect() /
makeEffect() call; (d) reword the small number of locally-compensating
snippets that now read wrong. The magnitude lexicon and existing preview pools
stay structurally untouched — they were being fed the wrong signal, not built
wrong. Wait for plan approval.
```

---

## Phase 3 — Distinguishable Choices

**Provisional:** phase 165 / ISSUE-133.

**Goal.** Stop the surface collapsing mechanically-distinct choices into identical text. Three coupled defects: (a) the same preview line repeats across choices because pools key only on `(targetKind, direction, band)` and not on the slot's distinguishing identity; (b) the same label renders for opposite slots because label pools key on verb alone; (c) the renderer surfaces raw internal taxonomy ("RELATIONSHIP SACRIFICE", "IGNORE · IGNORE") as a choice subtitle.

**The work.**
- **Slot-aware label pools.** Walk every `choiceLabel.ts` pool and add `responseSlot` conditions wherever two slots share a verb. The Phase-3 primitive exists; this is applying it. The big offender is `factionRequest/choiceLabel.ts` (negotiate_terms vs play_rival_faction), but the audit's 161 collisions span several pools — fix them all. The slot-id is the discriminator; the label still composes through voice.
- **Slot/target-aware previews.** Extend preview pools so that when multiple slots on the same card carry the same `(targetKind, direction, band)` effect, the rendered lines differ. Two options, applied per-pool: (i) add `responseSlot` conditions on a couple of higher-specificity snippets per cell so distinct slots reach distinct snippets; (ii) compose the slot's target object into the line where the effect targets a named entity ("warm the **guild**" vs "warm the **watch**"). Prefer (ii) where the effect target identifies a real referent — it carries information; (i) is fallback.
- **Renderer cleanup.** `web/src/lib/cards/CardRenderer.svelte` line 85 currently emits `{c.verb} · {shapeLabel(c.shape)}` below every choice button. Remove that line, or replace it with something that carries decision-relevant signal (e.g. an icon for the choice's primary effect direction). The verb/shape pair is sim taxonomy, not player-facing copy.
- Throughout: the underlying mechanical fields (`slotId`, `verb`, `targetId`, `shape`, effect amounts) are untouched; only the rendered strings and the renderer's choice-meta line change.

**Read first.** The audit findings (Defects 2, 3, 5). Every `choiceLabel.ts` pool under `src/cards/compose/pools/*/`. The preview pools that emit generic `+relationship` lines (`_shared/effectPreviewBase.ts` social block). `web/src/lib/cards/CardRenderer.svelte` lines 78–95. `src/cards/compose/conditions.ts` `responseSlot` arm (the existing primitive).

**Done when.** No label collision across the audit (audit harness in Phase 5 will codify this); no duplicate preview line across choices in the same card on any production seed; `CardRenderer.svelte` no longer prints the raw verb/shape subtitle; full suite + typecheck green; the Phase-1 sampler-rebuilt distinctness gate is genuinely passing, not stub-passing.

**Do not do.** Don't drop or merge response slots in the sim — distinctness is presentation-side. Don't solve label collisions by truncation or ellipsis. Don't restore the verb/shape subtitle in a "polished" form — if a choice needs more context, the label or preview should carry it. Don't author per-template preview overrides for every effect cell; the shared base + slot/target discriminators are the right layer.

```
Enter plan mode. Faithful Surface arc, Phase 3 (Distinguishable Choices). Read
every src/cards/compose/pools/*/choiceLabel.ts pool, src/cards/compose/pools/
_shared/effectPreviewBase.ts (social block), web/src/lib/cards/
CardRenderer.svelte lines 78-95, and src/cards/compose/conditions.ts
responseSlot arm. Write a phase plan in docs/plans/ to (a) add responseSlot
conditions to every choiceLabel pool where two slots share a verb,
discriminating by slot id; (b) extend preview pools so multiple slots
carrying the same (targetKind, direction, band) on one card render distinct
lines — prefer composing the slot's named target object into the line, fall
back to responseSlot gating; (c) remove the verb · shape subtitle from
CardRenderer.svelte. Mechanical fields untouched; only strings and the
renderer's choice-meta line change. Wait for plan approval.
```

---

## Phase 4 — Flavor That Doesn't Lie

**Status: done (phase 166 / ISSUE-134).** Shipped the `simCoherence`
`unbacked_state_claim` detector (curated distress/calm lexicon, scoped to body
flavor slots), state-gated the 5 genuinely-ungated voice-rung distress lines (the
other ~636 flavor snippets were already gated or make no claim), added the
multi-fact valence drop (`strictlyOpposed` pure-calm-vs-pure-distress SIGNAL
pairs only; pressures neutral; mixed snippets preserved), and — folded in from
the Phase-1/2/3 carry-over — restored the cross-template legibility `it.todo` to
a live assertion by driving its 202 violations to zero (cost-surfacing via the
shared `selectPreviewEffects`, `future_hook`/`cause` magnitude exemption, and the
`world.regulars.*` → `customer` targetKind fix). See ISSUE-134 for the full
record.

**Provisional:** phase 166 / ISSUE-134.

**Goal.** Stop flavor lines contradicting the sim. The arc-defining assumption — *"flavor slots make no checkable claims"* in `simCoherence.ts` line 4 — is wrong: a flavor line that asserts emotional or situational state ("I've been carrying a heavy hush since dawn") makes a claim about the sim even though it invents no name, history, or role. Flavor pools need state conditions where their content implies state, and the multi-fact join needs to refuse pairs that don't cohere.

**The work.**
- **Audit every flavor pool for state-implying content.** For each snippet on every `aside_line`, `reactionLine`, `mannerNote`, and similar flavor slot across the twenty templates, ask: *does this line imply an emotional or situational state?* If yes, it gates on the appropriate signal/pressure/memory band — same primitives the establishing lines already use. "Heavy hush" implies stress or burnout; gate it on `signalEquals stress: high` or `pressureRising staff_burnout`. Lines that genuinely make no situational claim ("They smooth their apron as if rehearsing") stay flavor and stay ungated. This is the largest authoring pass in the arc — expect to touch hundreds of snippets across all twenty pools.
- **Promote the "no-contradiction" rule to a structural detector** in `simCoherence`. The detector for flavor slots: a flavor snippet that contains a token from a curated "implies-distress" or "implies-calm" lexicon must carry at least one corresponding state condition. The lexicon stays small and inspectable — twenty or thirty phrases, not an open vocabulary. This is the inverse of the existing `history_claim` and `role_claim` detectors: same structural shape (text scanner + condition check), new claim category.
- **Multi-fact join coherence.** When `saliencePolicy: 'multi'` resolves two facts that point in opposite directions ("calm" + "drifting"), the join currently staples them with " — " regardless. Add a coherence check: if the two snippets carry oppositely-signed signal/pressure conditions, drop the secondary and render the primary alone. Silence beats staple. The check stays data-driven — it reads the snippets' existing conditions, doesn't introduce a new "tone" concept.
- Re-run the audit. The 178 body-contradiction cases should collapse to zero or near it.

**Read first.** `src/cards/compose/gates/simCoherence.ts` lines 1–40 (the load-bearing assumption being revised). Every flavor pool under `src/cards/compose/pools/*/` — `asideLine.ts`, `reactionLine.ts`, `mannerNote.ts`. `src/cards/compose/salience.ts` `pickByTopSalience` (the multi-fact join). The Phase-1 audit's contradiction examples for concrete cases to gate.

**Done when.** Every flavor snippet whose text implies state carries the matching state condition; the `simCoherence` gate has a new detector for state-claim-without-state-condition with a curated lexicon; the multi-fact join drops oppositely-signed secondaries; the audit's 178 Mira-style contradictions go to zero; full suite + typecheck green.

**Do not do.** Don't gate *every* flavor line on state — lines that genuinely make no situational claim ("the door catches at the jamb") stay free. Don't make the implies-distress lexicon open-ended — keep it small and explicit so authors know what triggers gating. Don't change the multi-fact policy to require *agreement* — orthogonal facts that don't contradict are still fine ("rested — and on warning since last week" is two separate facts, not a contradiction).

```
Enter plan mode. Faithful Surface arc, Phase 4 (Flavor That Doesn't Lie).
Read src/cards/compose/gates/simCoherence.ts lines 1-40 (the "flavor makes no
checkable claims" assumption being revised), every flavor pool under
src/cards/compose/pools/*/ (asideLine, reactionLine, mannerNote),
src/cards/compose/salience.ts pickByTopSalience (the multi-fact join), and
the Phase 1 audit's contradiction examples. Write a phase plan in docs/plans/
to (a) walk every flavor snippet across all 20 templates and add state
conditions wherever the line implies state — heavy hush implies stress, slow
steps imply fatigue, etc.; (b) extend simCoherence with a state-claim
detector keyed to a small curated lexicon (~20-30 phrases), structurally
mirroring the existing history/role detectors; (c) make the multi-fact join
drop oppositely-signed secondaries. Lines that genuinely make no situational
claim stay ungated. Wait for plan approval.
```

---

## Phase 5 — Close the Loop

**Provisional:** phase 167 / ISSUE-135.

**Goal.** Wire the audit into the standing bar so the structural blind spot that hid all four defects can't reopen. The Phase-16 legibility gate currently asserts on synthetic samples through 10 fixture tests; it needs to assert on **production-shape samples** for the four defect classes this arc fixed. This phase is small but critical — without it, the next Claude-Code session that adds a template will re-introduce the same pattern.

**The work.**
- Promote the comprehensive audit harness (the `runCardlessSim`-driven, multi-bot, multi-template render walk that found the 339+4368+161+178 defects) to a real test under `tests/cards/compose/gates/`. It runs at suite time, with a small enough sample count to be fast (~5000 cards is enough for coverage; the original audit was 2578 and surfaced everything).
- Four assertions, mirroring the four defects: (a) zero direction mismatches on any meter where `METER_VALENCE` resolves; (b) zero label collisions on `(slotId, verb, targetId)`-distinct choices; (c) zero duplicate preview lines across choices within a single card; (d) zero state-implies-distress lines firing in low-distress states (and vice versa).
- The existing `checkLegibility` gate stays — it remains a fast per-template unit gate. The new harness is the cross-sim integration check, analogous to `crossSituation` but exercising the four faithfulness rules instead of voice consistency.
- Retire the temp `_audit_render` / `_audit_sample` instrumentation from `/tmp` and the conversation; the standing harness replaces them.

**Read first.** `src/cards/compose/gates/legibility.ts` (the per-template gate it sits beside). `src/cards/compose/gates/crossSituation.ts` (the precedent for a multi-template integration gate). The four audit tallies and their sample outputs.

**Done when.** A standing audit test runs at every `npm test`, exercising several thousand production-shape renders, asserting all four faithfulness rules; the test is fast enough to live in the default suite (target: under 30s on the slow shard); the temp audit instrumentation is removed; full suite + typecheck green.

**Do not do.** Don't make the harness so large it has to run on a special target — if it doesn't run on every commit, it doesn't protect anything. Don't merge it into `checkLegibility` — the per-template gate stays per-template, the cross-sim gate stays cross-sim. Don't add new rules in this phase — the four defects this arc fixed are the four rules; new rules come from the next play session.

```
Enter plan mode. Faithful Surface arc, Phase 5 (Close the Loop). Read
src/cards/compose/gates/legibility.ts (the per-template gate this sits
beside) and src/cards/compose/gates/crossSituation.ts (the precedent for a
multi-template integration gate). Write a phase plan in docs/plans/ to
promote the audit harness from this arc's conversation into a standing test
under tests/cards/compose/gates/, asserting (a) zero direction mismatches
where METER_VALENCE resolves; (b) zero label collisions on distinct
(slotId,verb,targetId); (c) zero duplicate preview lines within a card;
(d) zero state-implies-distress flavor firing in low-distress states. Fast
enough to live in the default suite. checkLegibility stays beside it
unchanged. Wait for plan approval.
```

---

## The three principles this arc bakes in

1. **Direction means good or bad, not positive or negative.** `EffectDirection` was the surface contract; the underlying signal must respect valence. Once meters carry polarity in data, every snippet that gates on direction is automatically correct without re-authoring.
2. **Flavor that implies state is making a claim.** The prior arcs' "flavor is exempt from coherence" rule was too broad. The new rule: flavor is exempt from coherence *when its content makes no situational claim*. Most flavor still qualifies; the lines that don't get state-gated like any other claim.
3. **A gate that exercises a stub is not a gate.** Test fixtures that don't share the structural shape of production are worse than no test — they advertise safety while hiding the bug. Every choice/preview/label gate from here on runs against real generator output, full stop.

## If you only remember three things

1. **Phase 1 first or nothing else matters.** Real samplers expose the real defects; without them the next four phases will pass tests and ship broken, just like the last seventeen.
2. **Most of the work is one large authoring pass (Phase 4) plus one small architectural fix (Phase 2).** Phases 3 and 5 are bounded; Phase 1 is bounded but red. Plan the calendar around Phase 4.
3. **Five phases, not seventeen, because three of the four defects share a single fix shape** — point the gates at real seeds and the surface failures all surface together. The arc is small because the defects had one common cause.
