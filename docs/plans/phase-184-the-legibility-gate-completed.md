# Phase 184 / ISSUE-152 — Choice-Preview Legibility arc, Phase 4: The Legibility Gate, completed

**Arc contract:** `docs/plans/choice-preview-legibility-arc.md` (Phase 4 — "The lock").
**Depends on:** ISSUE-149 (Phase 1, meter contract), ISSUE-150 (Phase 2, selection policy), ISSUE-151 (Phase 3, pool vocabulary). All `done`.

## Goal

Make the three Phase-1–3 fixes un-regressable. Extend the existing cross-template
`legibility` gate (`src/cards/compose/gates/legibility.ts`, its Q2 block) so that,
for every migrated template's production `CardView`, it also asserts:

1. **`preview_meter_unnamed`** — a previewed `state_change` line whose backing
   effect carries a `meterId` the arc has contracted as *leaf-named* must actually
   name that meter (the rendered line contains a token derived from `meterLabel`),
   unless the line is the sim-authority fallback (`line === effect.readable`).
2. **`preview_duplicate_line`** — no single choice renders two canonically-identical
   preview lines. This is the rule `previewVariety` deliberately omits (within-choice
   duplicates are permitted there); the deliberate omission is reversed here on purpose.
3. **`preview_risk_unsurfaced`** — a choice whose source effects carry a
   decision-relevant `pressure`/risk change (`isRiskEffect`, the Phase-2 priority-3
   predicate) must surface it: the shared `selectPreviewEffects` must place that
   risk effect in the rendered set. The standing analogue of the existing
   `preview_cost_unsurfaced` rule, for risk.

The gate stays cross-template, out of `runAllGates`, and runs in the default
`npm test` suite via `tests/cards/compose/gates/legibility.test.ts`.

## The meter-naming allowlist — why a contracted set, not "every meter"

Phase 3's own "Do not do" was explicit: *author the high-traffic meters the sweep
names; the rest deepen under Phase 5.* A blanket "every `state_change` line names
its meter" rule therefore cannot hold against the live suite today — empirically,
**1258 of 2552** state-change preview lines (49%) do not literally name their meter
leaf, because coin renders as *silver/till/purse*, stock as *shelves/stores*,
reputation as *repute/name*, faction/supplier relationship as *guild/merchant*.
Those coarse-base lines name the **kind** (via `DEFAULT_TARGET_KIND_KEYWORDS`),
which is exactly what the specificity rule already governs — and a kind-keyword
carve-out would make the meter rule toothless against the *defining* defect
(`staff_identity` rendered loyalty/morale/stress all as "trust", and "the crew
would feel a marked rise in trust" *does* contain the staff keyword "crew").

The defect this rule must catch is **leaf ambiguity within a shared kind**
(loyalty vs morale vs stress; relationship vs trust vs influence). The gate can
only *prove* a leaf is named where Phase 3 authored leaf-naming prose. So the rule
is scoped to an enumerable, data-driven allowlist — `DEFAULT_NAMED_METERS` — of the
meters that are intentionally leaf-named **and** verified 100%-named across every
live sample:

```
loyalty, morale, stress, fatigue, satisfaction, patronage, reliable, tasty
```

(Measured per-meter: each of these is named in 100% of its live rendered lines.
`cheap`/`dangerous`/`respectable`/`relationship`/`trust` were authored but do not
yet cover every band — they stay out of the allowlist until Phase 5 completes their
coverage, at which point Phase 5 grows `DEFAULT_NAMED_METERS` alongside the prose.)
This is the same pattern as `DEFAULT_TARGET_KIND_KEYWORDS` — plain enumerable data
the gate reads, not a closure.

## The work

In `src/cards/compose/gates/legibility.ts`:

- Append three reasons to `LEGIBILITY_REASONS` (after the existing five):
  `preview_meter_unnamed`, `preview_duplicate_line`, `preview_risk_unsurfaced`.
- Add `DEFAULT_NAMED_METERS` (frozen string set) + `lineNamesMeter(line, label)`
  helper (case-insensitive substring on the full label, falling back to its
  ≥3-char word tokens for multi-word labels).
- Add a `LegibilityConfig.requireMeterNaming?: readonly string[]` override
  (defaults to `DEFAULT_NAMED_METERS`) so Phase 5 can grow the set without editing
  the gate body, and tests can pin it.
- Reference the fallback id as a documented local constant
  (`FALLBACK_TEMPLATE_ID = 'fallback.everySeed'`, mirroring `templates/fallback.ts`'s
  `FALLBACK_CARD_ID`) — `compose/` must not import `templates/` (that would invert
  the layering; `compose/` never imports `templates/` today). Skip the meter rule
  for that template id, decoupling this arc from the salience-coverage arc that owns
  the fallback's no-preview state.
- In the Q2 per-line loop, beside the magnitude check: when the backing effect is a
  `state_change` whose `meterId` is in the allowlist and which carries a `meterLabel`,
  run the naming check (readable-fallback exempt) and record `preview_meter_unnamed`.
- After the per-line loop, per choice: collapse the rendered lines by
  `canonicaliseText`; a repeat fires `preview_duplicate_line`.
- Per choice: if `source.some(isRiskEffect)` but the shared
  `selectPreviewEffects(source, lineCount)` set carries no risk effect, fire
  `preview_risk_unsurfaced` (reusing the exact predicate + selection the renderer
  uses, so gate and renderer never disagree about "shown").
- Extend `LegibilitySituationObservation` with `meterNamingChecksRun/Failed`,
  `duplicateLineCount`, `riskSurfacingChecksRun/Failed`.

In `tests/cards/compose/gates/legibility.test.ts`:

- Update the frozen-tuple assertion to the eight reasons.
- Add the new failed-counter `=== 0` assertions to the live "passes Q1 + Q2" test.
- Add failing fixtures + corrected counterparts: an unnamed allowlisted-meter line
  (fails) / a meter-named line (passes); a within-choice duplicate line (fails) /
  distinct lines (passes); a choice hiding a headline pressure under a tight render
  cap (fails) / one that surfaces it (passes).

## Acceptance criteria

- `legibility.ts` fails on (a) an unnamed allowlisted-meter `state_change` line,
  (b) a within-choice duplicate, (c) an unsurfaced decision-relevant pressure.
- The fallback template id is excluded from the meter rule.
- New failing fixtures fail; their corrected forms pass.
- The live 20-template suite stays green (the proof Phases 1–3 landed): meter,
  duplicate, and risk failed-counters are all 0.
- Gate stays cross-template, out of `runAllGates`, runs in the default suite.
- `npm test` and `npm run typecheck` green.

## Do not do

- Don't fold this into `runAllGates` — it is cross-template by construction.
- Don't assert exact wording — assert the meter is named, the line is unique, the
  risk is shown.
- Don't require every meter to be named — the rule is scoped to the contracted,
  verified `DEFAULT_NAMED_METERS` allowlist; Phase 5 grows it.
- Don't import `src/cards/templates/` into the gate (layering); reference the
  fallback id as a local constant.
- Don't relax a Phase-1–3 change to make a fixture pass; if a real template fails,
  fix the pool (Phase-3/5 work), not the gate.
