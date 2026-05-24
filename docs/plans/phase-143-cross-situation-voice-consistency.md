# Phase 143 — Cross-Situation Voice Consistency

**Voiced Surface arc, Movement IV centerpiece.** Tracked as ISSUE-112.
Closes Phase 17 of [`voiced-surface-arc.md`](voiced-surface-arc.md).

## Context

By the close of Movement II (Phase 14, ISSUE-109) and Movement III
(Phase 16, ISSUE-111) the arc had migrated 18 compositional templates
and retired the legacy adjective-glue composer entirely. Each template
clears `runAllGates` (the seven framework gates plus `checkDedupe`) in
isolation, and every actor-voiced template selects snippets through
`voiceAxis` / `verbalTic` conditions reading `CastAttributes.voice`
via `resolveActorCastAttributes`. What the arc had NOT yet proven was
the original Living Cast vision: that **the same character is
recognizably themselves across situations** — a terse-cold staff
member should read terse-cold whether ordering supplies (`staffAside`),
asking for a raise (`staffBurnout`), running the line in a food-safety
incident (`foodSafetyCrisis`), or surfacing in a rumour
(`rumourCrisis`), driven only by their stored `voiceProfile`. This
phase closes that loop with a structural gate + harness.

## Goal

Ship `checkCrossSituationVoice` plus a sibling test suite that
holds one `voiceProfile` fixed, samples its rendered output across
every migrated actor-voiced template, and asserts three structural
rules:

1. **Voice-pole expression** (LIVENESS): per archetype, ≥ ⌈templates × 0.5⌉ templates show an axis-gated snippet matching one of the archetype's poles.
2. **Tic surfacing** (LIVENESS): per archetype with `verbalTic`, the tic-conditioned snippet fires in ≥2 templates (≥1 for 2-template kinds).
3. **Voice-blind pool** (SAFETY): per actor-voiced `(template, slot)`, terse_cold vs florid_warm produce identical text in <80% of samples.

A deliberately-broken fixture proves each rule bites.

## Scope & non-goals

**In scope:**
- New gate `src/cards/compose/gates/crossSituation.ts`.
- New harness `tests/cards/compose/gates/crossSituationHarness.ts`.
- New tests `tests/cards/compose/gates/crossSituation.test.ts` (live suite + failure-fixture suite).
- One refactor: `pickSnippet` → delegates to a new `pickSnippetTrace` that returns the resolved `Snippet` object instead of just text. Public API unchanged.
- Export the gate + types from `src/cards/compose/gates/index.ts`.
- Record completion in `CLAUDE.md`, `docs/ISSUE_TRACKER.md`, and `docs/plans/voiced-surface-arc.md`.

**Out of scope** (per the plan-mode AskUserQuestion answers):
- New voice axes or verbal tics. Phase 17 is structural; Phase 18 (Deepening & Tuning) handles content tuning.
- New condition primitives.
- Narrator-voiced templates (`stockShortage`, `debtRent`, `cultureConflict`, `maintenance`, `areaAtmosphere`, `reputationShift`, `monthlyReview`, `rivalTavern`, `seasonalArc`, `fallback`). By design these have no actor voice — they are EXCLUDED from cross-situation actor voice consistency.
- Modifying any existing pool to make the gate pass. If a real pool fails, file as a Phase 18 follow-on ISSUE and document — do NOT patch in this phase.

## Architectural decisions (carried from the plan-mode design record)

1. **Sibling gate, not a `runAllGates` entry.** Cross-situation is multi-template; `runAllGates` is template-scoped. The gate is exported alongside the seven existing gates but called directly from its dedicated test suite. Adding it to `AllGatesConfig` would force every per-template `runAllGates` call to re-run cross-situation analysis — wrong fit.
2. **Six actor kinds, not all 21 templates.** The 11 migrated actor-voiced templates partition by actor kind: staff (4), regular (3), customer_group (3), faction (3), supplier (2), notable_npc (2). The gate iterates all six. `rumourCrisis` enters per kind via its predicate which accepts every cast-bearing target kind.
3. **Five voice archetypes.** terse_cold, florid_warm, formal_prickly, two tic-bearing neutrals. Covers axis poles, two tic IDs, and includes a baseline through the tic archetypes' axes.
4. **Snippet selection trace via `pickSnippetTrace`.** The gate needs to introspect the chosen snippet's `conditions` array, not just its text. Adding a trace wrapper around `pickSnippet`'s existing internals avoids an `onTrace` callback parameter that 99% of callers would ignore. `pickSnippet` is now a thin wrapper that drops the snippet id.
5. **Fixed cast, varied seed.** The harness installs the archetype's voice on one actor per kind (the first one in `state`), then varies the seed (template) — same character walks through all their situations.
6. **Per-archetype voice-pole expression, not per-axis-pole.** Real pools commonly author only one direction of an axis (high-floridity is rich text; low-floridity falls through to the fallback). Per-axis-pole would emit false positives on every kind. Per-archetype-overall catches the meaningful case: a fixed voiceProfile invisible across most situations.
7. **80% voice-blind threshold.** Allows occasional fallback collapse without false alarm. 100% would let weakly-voiced pools through; 50% would flag too many real pools.
8. **Failure fixtures live in the test, not in `src/`.** Three synthetic templates, one per violation reason. Keeps real pools pristine.

## Files added

| Path | Purpose |
|---|---|
| `src/cards/compose/gates/crossSituation.ts` | The gate function and its types. |
| `tests/cards/compose/gates/crossSituationHarness.ts` | Registry mapping each actor kind to its `[(template, role, seedFactory)]` list plus the archetype list and `buildSamples` factories. |
| `tests/cards/compose/gates/crossSituation.test.ts` | 4 live-suite tests + 3 failure-fixture tests. |
| `docs/plans/phase-143-cross-situation-voice-consistency.md` | This file. |

## Files modified

| Path | Change |
|---|---|
| `src/cards/compose/assemble.ts` | Added `pickSnippetTrace`; `pickSnippet` delegates to it. |
| `src/cards/compose/gates/index.ts` | Re-exports `checkCrossSituationVoice` and its types. |
| `docs/ISSUE_TRACKER.md` | New ISSUE-112 entry (Status: done, Phase: 143). |
| `docs/plans/voiced-surface-arc.md` | Phase 17 flipped from provisional → done. |
| `CLAUDE.md` | New Phase 143 status block. |

## Verification

- `npm test -- --run tests/cards/compose/gates/crossSituation.test.ts` — green (7 tests: 4 live + 3 failure fixtures).
- `npm test -- --run tests/cards/compose/gates/` — green (no regressions across the seven existing gates).
- `npm test -- --run tests/cards/` — green (617 tests; the `pickSnippet` refactor preserved every template's output).
- `npm test -- --run` — green: **2459 / 2459 across 199 files** (+7 vs the post-Phase-142 baseline of 2452).
- `npm run typecheck` — green.

## Notes for future phases

- **Phase 18 (Deepening & Tuning) follow-ons.** The gate ships with thresholds that pass against the live pools as authored. If a future migration adds a new actor-voiced template, run `checkCrossSituationVoice` and treat any failure as content debt to be addressed in Phase 18, not by softening the gate.
- **The voice-blind threshold is a knob.** 80% reflects the spec's intent (allow occasional fallback collapse without false alarm). If playtesting reveals voice-blindness in pools the gate currently passes, tighten to 0.7 or 0.6 in a follow-on.
- **The `pickSnippetTrace` seam is reusable.** Any future gate that needs to know WHICH snippet fired — not just its text — should call `pickSnippetTrace` and read `.conditions` / `.id` / `.specificity`. The trace shape is intentionally the same `Snippet` shape the pools author.
- **Tic-archetype axes are all 1.** This means the tic-bearing archetypes only test Rule 2 (tic surfacing) — Rule 1 skips them because they have no pole-set axes. If a future archetype needs both a tic AND pole-set axes, the gate handles it: Rule 1 runs on the poles, Rule 2 runs on the tic, both independently.

## Do not do

- Do not add new voice axes here. Phase 17 spec: "Don't add new voice axes here to 'fix' inconsistency — fix the offending pool or feed the gap back to a spec."
- Do not patch real pools to make the live suite pass during this phase. If a pool fails the gate, file as a Phase 18 follow-on ISSUE.
- Do not weaken the rules' thresholds without documenting why in a fresh ISSUE.
- Do not add the cross-situation gate to `runAllGates`. It is multi-template by definition; coupling it to `runAllGates` would create circular per-template work.
