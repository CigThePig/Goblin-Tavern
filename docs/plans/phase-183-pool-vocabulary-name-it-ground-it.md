# Phase 183 — Choice-Preview Legibility arc, Phase 3: Pool Vocabulary — name it, ground it

**ISSUE-151.** Depends on ISSUE-149 (Phase 1, the meter contract) and is authored
against ISSUE-150's selection (Phase 2). Record: `docs/plans/choice-preview-legibility-arc.md` (Phase 3).

## Goal

Make the preview prose say *what moved*. Replace the magnitude-as-subject,
meter-as-metaphor lines for the high-traffic meters with subject-first lines that
**name the real meter** (using Phase 1's `meterId` via the `effectMeter` condition),
e.g. *"loyalty would climb a real step with the crew"*, *"the inspection risk would
ease a step tonight"* — while keeping the calibrated `MAGNITUDE_LEXICON` token and the
10-word effect-preview budget.

This is the authoring phase. The standing meter-naming *guarantee* is Phase 4's gate;
this phase does the content so that gate can pass.

## What the framework gives us (read findings)

- **No glue substitution.** `pickSnippet` / `assembleSlots` emit a snippet's `text`
  verbatim — there is no `{meterLabel}` interpolation. So the meter name is **authored
  into the snippet text**.
- **Specificity & selection.** `specificityOf = snippet.specificity ?? conditions.length`.
  The shared base banded snippets carry 3 conditions (`effectTargetKind × effectDirection
  × effectMagnitudeBand`) ⇒ specificity 3. The `responseShape`-gated and `inactionPreview`-gated
  variants carry 4 ⇒ specificity 4. To out-rank the base for a covered meter, the new
  snippets gate on `effectMeter + effectTargetKind + effectDirection + effectMagnitudeBand`
  = **4 real conditions** ⇒ natural specificity 4 (no explicit override). The extra
  `effectTargetKind` also **disambiguates same-named leaves across kinds** (`loyalty` on a
  staff vs a regular) so the staff line keeps its "crew" flavour and the customer line keeps
  its "regular" flavour.
- **Gate constraints every snippet must satisfy** (so the standing suite stays green):
  - `previewVariety.requireMagnitude` / cross-template `legibility`: every banded line
    carries a `MAGNITUDE_LEXICON[direction][band]` token. **Direction is valence-adjusted**
    (`stress`/`fatigue` are lower-is-better, so a *decrease* reads `positive` and takes a
    positive token; pressure is NOT valence-inverted — relief = negative sign = negative token).
  - `previewVariety` specificity rule: a line must also contain a `DEFAULT_TARGET_KIND_KEYWORDS`
    keyword for its `targetKind` — the meter *name* alone is not in those lists, so each line
    also carries a kind keyword (`crew`/`rota`/`shift` for staff; `regular`/`patron` for
    customer; `name`/`word`/`talk` for reputation; `meter`/`pressure`/`risk`/`settle`/`climb`
    for pressure).
  - `voice-bounds`: effect_preview budget is **10 words** (runAllGates wires the synthetic
    `effect_preview` slot at `wordBudget: 10`).
  - `sim-coherence` (flavor): no `your|the (cook|cleaner|server|guard|bouncer)` role claims.
    `the crew` / `the rota` are fine.
  - `dedupe`: pairwise character-Levenshtein normalised-similarity `< 0.85` within the pool.
    Siblings vary verb + tail to stay distinct.

## Scope — the high-traffic meters the sweep names

Gated on `effectMeter + effectTargetKind + effectDirection + effectMagnitudeBand`, added to
the shared base `narratorEffectPreviewBase()` (axis-neutral meters → one place fixes all 20
templates):

- **Staff:** `loyalty`, `morale`, `stress`, `fatigue` — the cells production emits, both
  directions where they occur. **Retire** the staff `responseShape` metaphor variants
  `shared_preview_staff_pos_medium_relsac` (the non-existent **"trust"** meter — the §1
  motivating bug) and `shared_preview_staff_pos_medium_repplay` (magnitude-as-subject); the
  new meter snippets supersede them.
- **Customer:** `satisfaction`, `patronage`, and regular `loyalty`.
- **Reputation axes:** `respectable`, `dangerous`, `cheap`, `reliable`, `tasty` (the axes the
  base comment + Phase-158 tests exercise).
- **Headline pressures:** `staff_loyalty_risk`, `staff_burnout`, `rumour_pressure`,
  `inspection` — relief (negative) and rise (positive), named via the registry label token
  (`loyalty risk` / `burnout` / `rumour` / `inspection`).

**Deferred to Phase 5** (graceful degradation — the coarse base still fires, carrying its
magnitude token): `coin` (the base already names `coin`/`till`/`purse`); area sub-meters
(`cleanliness`/`condition`/`damage`/`smell`); the remaining reputation axes
(`goblinAuthentic`/`cozy`/`strange`/`filthy`/`culinary_renown`); supplier / faction / culture /
cohort leaves; the non-headline pressures.

## The work

- Add a Phase-183 meter-named block to `src/cards/compose/pools/_shared/effectPreviewBase.ts`,
  after the global block, before the closing `]`. ~60 snippets across the scoped meters, 2
  siblings on the busy `small`/`medium` cells (for within-card distinctness via the Phase-167
  `avoid` set), 1 on `tiny`/`large`.
- Delete `shared_preview_staff_pos_medium_relsac` and `_repplay`.
- Leave the coarse base intact as the unlisted-meter fallback.

## Done when

- For the scoped meters, a rendered preview line names the meter, reads subject-first, and
  carries a magnitude token; the staff "trust" / magnitude-as-subject lines are retired.
- The coarse base remains the unlisted-meter fallback.
- `previewVariety` (magnitude + specificity), cross-template `legibility`, `voice-bounds`,
  `sim-coherence`, `dedupe` gates stay green; `npm test` and `npm run typecheck` are green.

## Do not do

- Don't remove the shared base or its magnitude tokens.
- Don't change effect mechanics or selection (Phases 1–2 own those).
- Don't author a snippet for every meter — cover the high-traffic ones; the rest deepen in Phase 5.
