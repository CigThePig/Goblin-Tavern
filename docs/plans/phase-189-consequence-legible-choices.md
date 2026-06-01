# Phase 189 — Consequence-Legible Choices: surface the delayed cost and the blast radius

**Provisional:** ISSUE-156. **Phase doc:** `docs/plans/phase-189-consequence-legible-choices.md`.

**This document is self-contained.** Every claim below is grounded in a file path (and, where useful, a symbol or line reference) inside this repository. Nothing here depends on any external conversation, chat log, or document not in the repo. The *Evidence* reproduction uses only `createInitialTavernState` (`src/sim/state/defaults.ts`), `simulateDay` (`src/sim/core/engine.ts`), `FULL_PIPELINE` (`src/sim/canonicalPipeline.ts`), and `pickCard` (`src/cards/index.ts`).

**Builds on the Choice-Preview Legibility arc.** That arc (`docs/plans/choice-preview-legibility-arc.md`, ISSUE-149…153) fixed how the *shown* preview effects read — it added the `meterId`/`meterLabel` contract to `EffectPreview`, an `effectMeter` snippet condition, a decision-relevance selection over the chosen effect source, and the `legibility` gate. **This phase does not touch prose or the meter contract.** It changes *which effects enter the preview for an active choice* — specifically, that authored **delayed** consequences and **other-actor** consequences currently cannot enter at all.

---

## The defect in one screen

Every choice the simulation authors carries two kinds of consequence the player never sees: the **delayed** effect (what the choice sets up for later) and the **blast radius** (who *other* than the primary actor it moves). Both are computed, structured, and discarded at render.

1. **Delayed effects are structurally excluded from every active choice.** The only function that renders a seed's options is `composeChoicesFromSeed` (`src/cards/cardHelpers.ts:361`); all twenty templates call it. Inside it (the per-slot loop, ~lines 454–458), the preview source is chosen as:

   ```ts
   const immediate = profile?.immediateEffects ?? []
   const delayed = profile?.delayedEffects ?? []
   const useDelayed = immediate.length === 0 && delayed.length > 0   // line ~456
   const source = useDelayed ? delayed : immediate
   ```

   So `delayedEffects` are previewed **only** when a choice has *zero* immediate effects — the Phase-147 inaction carve-out for the `ignore` option. For every choice that does anything immediately (i.e. almost all of them), `source = immediate` and the delayed consequences never reach `selectPreviewEffects` (`src/cards/compose/previewSelect.ts`) or the rendered card. The `later: ${e.readable}` rendering convention already exists in the sibling override builder (`cardHelpers.ts`, ~lines 155–158, behind `overrides.includeDelayed`), but `composeChoicesFromSeed` never uses it.

2. **`seed.affectedActors` is never read, and other-actor effects aren't named.** `seed.affectedActors` (the `IssueSeed` type, `src/sim/modules/issues/issueSeedTypes.ts`) has zero references under `src/cards/`. Consequence profiles routinely move actors other than the primary one — e.g. a "comp the table" profile raises a neighbouring customer group's satisfaction, and a "back the staff" profile moves a staff member's loyalty — but the preview line names only a meter direction and magnitude, never *whose* meter, so the spill is invisible.

The simulation is correct; the consequence information is destroyed in translation. This is the same class of defect the Choice-Preview Legibility arc named ("the previews … hide more than a third of the consequences the simulation authored"), on the two axes that arc did not reach: its selection policy ranks within `source`, and for active choices `source` is `immediate` only — delayed and cross-actor consequences are excluded one layer earlier, at the `useDelayed` gate above.

## Evidence (reproducible from the repo)

```ts
const result = simulateDay(createInitialTavernState(), { seed: 'alpha' }, FULL_PIPELINE)
const seeds = (result.state.modules['issueSeeds'] as any).seedsToday ?? []
const seed = seeds.find((s: any) => s.family === 'customer_complaint')

// What the sim authored as the LATER consequence of each choice:
for (const p of seed.consequenceProfiles) {
  const later = (p.delayedEffects ?? []).map((e: any) => e.readable)
  if (later.length) console.log(p.responseSlotId, '→', later.join(' | '))
}
// What the player actually sees:
for (const c of pickCard(seed, result.state).choices ?? []) {
  console.log(c.label, '::', (c.previewEffects ?? []).join(' / '))
}
```

Observed today: the profiles author delayed consequences such as `fix_root → "Group may expect this standard"`, `public_apology → "Group may expect more apologies"`, `side_with_staff → "Staff remember the backing"`, and `mock → "Group spreads the story | Cultural snub | Merchants may boycott"`; the rendered choices show only immediate previews. None of the "later:" consequences appears on any active choice.

## The principle

**A choice's preview surfaces what it spends now, what it sets up for later, and whom else it moves — or the gate fails it.** This completes the arc's legibility rule on the two consequence axes it left untouched (delayed and cross-actor), reusing that arc's `meterId`/`meterLabel` so a delayed or spillover line names a real meter rather than a metaphor.

## The work

**A. Let an active choice surface its most decision-relevant delayed consequence (card layer).**
- In `composeChoicesFromSeed` (`cardHelpers.ts`, the per-slot loop ~lines 454–462), after selecting the immediate preview effects, additionally select **at most one** delayed effect by decision-relevance and append it as a trailing `later: …` line. Do this *in addition to* the immediate previews, not by counting it against the immediate `previewMax` cap — a delayed line must never displace a surfaced immediate cost. Select the delayed effect with a small ranker analogous to `selectPreviewEffects`: prefer entries whose tags mark them as consequential (`future_hook`, `risk`, and the escalation/expectation hooks the profiles emit), break ties by magnitude. Render it through the same snippet path as immediate previews so it carries the meter name from the `meterId`/`meterLabel` contract, then prefix `later: ` (the existing convention at `cardHelpers.ts` ~155–158). The inaction carve-out at ~line 456 is unchanged: a zero-immediate choice still previews its delayed effects as today.

**B. Name the other actor on a spillover line (card layer).**
- When a selected preview effect (immediate or the delayed line from A) has a target that resolves to an actor other than `seed.primaryActor`, include that actor's display name in the line. Use the effect's target/`relatedActors` and the existing entity-label resolution the templates already use for `subject`/`namedEntities` (see `makeCardView`/`buildStakes` in `cardHelpers.ts` and the `namedEntityIngredient` usage in the generators). The result reads e.g. "the miners at the next table also warm (satisfaction)" instead of an unattributed "+satisfaction". Keep it to the actors the profile actually moves; do not enumerate `seed.affectedActors` beyond those a shown effect references.

**C. Lock it with the legibility gate (card layer).**
- Extend `src/cards/compose/gates/legibility.ts` (the Q2 checks that already include `preview_magnitude_missing`, `preview_cost_unsurfaced`, `preview_inaction_blank` — see the arc doc's Phase 4 and the gate's existing rules) with one rule, `preview_delayed_unsurfaced`: a choice whose consequence profile carries a decision-relevant delayed effect (by the same tag set used in A) must surface at least one `later:` line. Mirror the structure and severity of the existing `preview_cost_unsurfaced` rule. Run it in the standing suite via `runAllGates` (`src/cards/compose/gates/runAllGates.ts`). Exclude the fallback card from the assertion, exactly as the arc's Phase-4 gate already excludes it.

This is a selection-policy extension, parallel to the arc's Phase 2: Phase 2 chose *which immediate effects* to show; this phase additionally admits *one delayed effect and the cross-actor identity* into the preview. It is uniform across all twenty templates because they all route through `composeChoicesFromSeed`.

## Read first

`src/cards/cardHelpers.ts` (`composeChoicesFromSeed` and the per-slot loop ~427–470; the override builder's `includeDelayed`/`later:` path ~150–160; `makeCardView`, `buildStakes`). `src/cards/compose/previewSelect.ts` (`selectPreviewEffects` and its cost-rescue policy — the model for the delayed ranker). `src/sim/core/effect.ts` (`EffectPreview`, including the `meterId`/`meterLabel` added by the Choice-Preview Legibility arc Phase 1). `src/sim/modules/issues/issueSeedTypes.ts` (`ConsequenceProfile.delayedEffects`, `IssueSeed.affectedActors`). `src/cards/compose/gates/legibility.ts` (the Q2 preview rules to extend) and `src/cards/compose/gates/previewVariety.ts` (so the new line stays within the variety contract). `docs/plans/choice-preview-legibility-arc.md` (the contract this builds on; read its Phases 1–2 and 4).

## Acceptance criteria (done when)

- For the default Day-1 `customer_complaint` seed, at least one active choice with an authored delayed consequence renders a `later:` line naming its meter (test asserts a `later:`-prefixed preview line is present on `fix_root` / `public_apology`).
- A choice whose effects move an actor other than the primary one names that actor in the preview (test against a profile with a neighbouring-group or staff effect, e.g. the comp/back-the-staff profiles).
- The delayed line is additive: a choice that previously surfaced a coin cost still surfaces it (the cost-rescue from the arc's Phase 2 is not displaced by the delayed line).
- `legibility.ts` fails a constructed choice that has a decision-relevant delayed effect and no `later:` line (`preview_delayed_unsurfaced`), and the fallback card is excluded from that assertion.
- The inaction/`ignore` choice behaves exactly as before (its delayed previews are unchanged).
- `runAllGates`, the choice-preview gate tests, `npm test`, and `npm run typecheck` are all green.

## Do not do

- Do **not** count the delayed line against the immediate `previewMax`; surface it as an extra, capped at one, so it never hides a cost.
- Do **not** dump every delayed effect — one decision-relevant `later:` line per choice keeps the card legible.
- Do **not** rewrite preview prose or the `MAGNITUDE_LEXICON`; that is the Choice-Preview Legibility arc's Phase 3/Phase 5 (`ISSUE-151`/`ISSUE-153`), and conflating them re-opens settled work. This phase only admits new effects into the preview and names them through the existing meter contract.
- Do **not** read `seed.affectedActors` to add actors no shown effect touches; name only the actors the previewed effects actually move.
- Do **not** modify any seed generator or consequence profile — the consequence data is correct; only its rendering changes.

## Tracker entry (add to `docs/ISSUE_TRACKER.md`)

Index row:

```
| ISSUE-156 | Consequence-legible choices — surface one delayed effect + cross-actor identity on active choices | broken | open | 189 |
```

Full entry:

> **ISSUE-156 — Consequence-legible choices.** *Status:* open. *Phase:* 189. *Depends on:* ISSUE-149 (the `meterId`/`meterLabel` effect contract; `done`).
> *Evidence:* `composeChoicesFromSeed` (`cardHelpers.ts:361`) sets `useDelayed = immediate.length === 0 && delayed.length > 0` (~line 456), so `delayedEffects` reach the preview only for zero-immediate (inaction) choices; every active choice drops them. `seed.affectedActors` has zero refs under `src/cards/`, and preview lines never name a non-primary actor. A default Day-1 `customer_complaint` seed authors delayed consequences (`fix_root → "Group may expect this standard"`, `mock → "… Merchants may boycott"`) that no active choice renders.
> *Scope:* in `composeChoicesFromSeed`, additionally select ≤1 decision-relevant `delayedEffect` per active choice and render it as a `later:` line via the existing meter-aware path (additive to the immediate cap); name the other actor when a previewed effect targets a non-primary actor; add a `preview_delayed_unsurfaced` rule to `gates/legibility.ts` (fallback excluded). No prose, contract, or generator changes. Uniform across all twenty templates via the shared pipeline.
> *Test approach:* default Day-1 complaint surfaces a meter-named `later:` line on an active choice; a spillover profile names the other actor; cost lines are not displaced; the new gate rule fails a delayed-but-unsurfaced fixture; the inaction path is unchanged; `runAllGates` green.

## Plan-mode prompt (copy-paste)

```
Enter plan mode. Consequence-Legible Choices (provisional ISSUE-156, phase 189).
Depends on ISSUE-149 (meterId/meterLabel on EffectPreview, already done) — confirm
EffectPreview carries meterId/meterLabel before starting.
Read src/cards/cardHelpers.ts (composeChoicesFromSeed + per-slot loop ~427-470; the
override includeDelayed/later: path ~150-160; makeCardView, buildStakes),
src/cards/compose/previewSelect.ts (selectPreviewEffects + cost rescue),
src/sim/core/effect.ts (EffectPreview incl. meterId/meterLabel),
src/sim/modules/issues/issueSeedTypes.ts (ConsequenceProfile.delayedEffects,
IssueSeed.affectedActors), src/cards/compose/gates/legibility.ts (Q2 preview rules),
src/cards/compose/gates/previewVariety.ts, and docs/plans/choice-preview-legibility-arc.md
(Phases 1-2, 4). Write a phase plan in docs/plans/ implementing exactly: (A) in
composeChoicesFromSeed, additionally select <=1 decision-relevant delayedEffect per
ACTIVE choice and append it as a meter-named `later:` line, additive to the immediate
previewMax so it never displaces a cost; leave the zero-immediate inaction carve-out
unchanged; (B) when a previewed effect targets a non-primary actor, name that actor
using the existing entity-label resolution; (C) add a preview_delayed_unsurfaced rule
to gates/legibility.ts (fallback excluded) and run it in runAllGates. Then implement,
add the Acceptance-Criteria tests, and take npm test + npm run typecheck + runAllGates
to green. Do NOT rewrite preview prose or MAGNITUDE_LEXICON, do NOT change generators
or consequence profiles, and do NOT count the delayed line against the immediate cap.
```
