# Phase 185 / ISSUE-153 — Choice-Preview Legibility arc, Phase 5: Drive, tune, deepen (standing)

**Arc contract:** `docs/plans/choice-preview-legibility-arc.md` (Phase 5 — "Drive, tune, deepen").
**Depends on:** ISSUE-152 (Phase 4, the legibility gate). `done`. **Standing — never strictly done.**

## Goal

Close the sampling gap the arc's motivating audit (Appendix A §2) left open, then tune.

Three of the twenty families — `food_safety`, `regular_customer`, `rumour_crisis` —
did **not** surface in the passive playthrough sweep, so they were tabulated as
"unverified": the legibility harness (`legibilityHarness.ts`) does exercise their
templates, but only via the synthetic determinism samplers built from captured
`*_SHAPE()` fixtures, never against a seed the *live* simulation actually emitted
under adverse state. This phase drives each of the three into existence through the
real `simulateDay` pipeline, renders the production seed through its production
template, and confirms the Phase-4 legibility gate is clean for it — closing the gap
with a standing regression test, not a one-off script.

The arc's Phase 5 is explicitly standing. This session lands part (a) — the driven
verification — as a permanent test. Part (b) — deepening flat meter-named lines and
recalibrating `MAGNITUDE_BAND_CUTOFFS` — stays open: it requires playtest evidence
that a specific cut-point reads wrong, and changing cutoffs without that evidence
would risk regressing the calibrated bands every gate already depends on. No band
cutoff is changed in this session; none has been shown to read wrong.

## Why a driven test, not the `_audit/` scripts

Appendix B describes three `npx tsx` instruments at `_audit/`. They were never
committed, and this environment has no `tsx` (only `vitest`). Rather than resurrect
throwaway scripts that nothing runs, this phase bakes the same idea into the standing
vitest suite: a driven harness that surfaces each unsampled family from constructed
adverse state and asserts the live gate passes. This runs on every `npm test`, so the
"no family unverified" guarantee can never silently regress.

## How each family is driven into existence

Each builder starts from `createInitialTavernState()` and perturbs only the state the
family's seed generator + its backing pressure calculator read, so the target family
dominates the day's seed set. One `runOneDay` then lets the **real** generators emit
the seed; the surfaced seed is paired with that day's `result.state` for rendering.

- **`food_safety`** — `calculateFoodSafety` reads kitchen cleanliness/smell and
  stew/mushroom spoilage; `generateFoodSafety` fires at `food_safety` pressure ≥ 45.
  Builder: kitchen cleanliness 8 + smell 85, stew & mushroom spoilage 85 (≈ 62, well
  over threshold). (Also surfaces readily under the `auto_profit_focused` policy bot —
  ~250/300 days — which the harness notes as the play-driven alternative.)
- **`regular_customer`** — `calculateRegularCustomerLoss` reads regular irritation +
  low loyalty; `generateRegularCustomer` fires at `regular_customer_loss` ≥ 25 with a
  trending-negative regular. Builder: every starter regular set to irritation 80,
  loyalty 20 (avg-irritation + low-loyalty causes ≈ 36). Irritation > 60 makes the
  generator emit `type: 'complaint'` → the `regularComplaint` template.
- **`rumour_crisis`** — `calculateRumourPressure` reads `socialRumours` strength;
  `generateRumourCrisis` fires at `rumour_pressure` ≥ 25 against the strongest *public
  attribution* (preferring false/partial), falling back to the strongest rumour.
  A tavern-wide rumour target has no `primaryActor` and is rejected by the seed
  validation contract ("no actor, group, or location") — so the builder injects a
  strength-100 false rumour **and** a high-publicness false `suspicion` attribution
  targeting a real starter regular, so the dramatic target is that regular and the
  seed validates.

## The work

- Add a reusable harness `tests/cards/compose/gates/drivenFamilies.ts`:
  - `buildAdverse<Family>State(base)` for the three families (pure state perturbation).
  - `surfaceDrivenSample(family)` — runs `runOneDay` over the adverse state, harvests
    the first seed of `family` from `getAllSeedsToday(result.state)`, and returns the
    `LegibilitySample` `{ seed, state }` (state = the day's result state). Throws a
    clear error if the family did not surface (so a future generator change that stops
    surfacing it fails loudly rather than silently skipping the check).
  - `templateForSeed(seed, state)` — selects the production template the seed renders
    through, by reusing the registry's `pickCardForSeed` over the 20 migrated
    compositional templates (the exact production selection), so the gate renders what
    the player would see.
- Add `tests/cards/compose/gates/legibility.driven.test.ts`:
  - For each of the three families, surface the driven sample, resolve its template,
    build a single-situation `LegibilityConfig`, run `checkLegibility`, and assert
    `report.pass` plus every per-situation failure counter is 0 — including the three
    Phase-184 counters (`meterNamingChecksFailed`, `duplicateLineCount`,
    `riskSurfacingChecksFailed`).
  - Assert at least one choice rendered (the cap never drops everything) and that the
    surfaced seed really is the target family + carries consequence profiles (so the
    check is exercising real content, not an empty stub).
- If the driven gate flags any allowlisted meter as unnamed for these families, author
  the missing leaf-naming snippet in the relevant pool (Phase-3-style). (Empirically
  the three families render clean against the current `DEFAULT_NAMED_METERS`, so no
  pool change is required this session.)

## Acceptance criteria

- `food_safety`, `regular_customer`, `rumour_crisis` each surface from the driven
  harness and render previews the Phase-4 legibility gate passes — no family unverified.
- The driven check runs in the default `npm test` suite and is deterministic
  (constructed state + seeded `runOneDay`).
- `npm test` and `npm run typecheck` green.

## Do Not Do

- Do not change effect mechanics, selection policy, or pool prose except to author a
  missing leaf-naming snippet the driven gate actually flags.
- Do not change `MAGNITUDE_BAND_CUTOFFS` without playtest evidence that a specific
  cut-point reads wrong (part (b) stays standing; none is changed here).
- Do not fold the driven check into `runAllGates` — the legibility gate is
  cross-template by construction.
- Do not grow `DEFAULT_NAMED_METERS` unless the corresponding leaf prose is verified
  100%-named across the live samples (the Phase-4 contract for that allowlist).
