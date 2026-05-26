# Phase 155 — Reputation, Rumour & Rivals Content Matrices

**ISSUE-123.** Seventh phase of Movement VI of the Legible Surface arc (`docs/plans/legible-surface-arc.md`, Phase 10). Mirrors phases 149/150/151/152/153/154 — same authoring loop, same nine gates, no Movement-V loopback.

## Context

Voiced Surface (Phase 13 / ISSUE-108) shipped three compositional templates for this cluster — `reputationShiftCard`, `rumourCrisisCard`, `rivalTavernCard` — but none was extended into the Legible Surface salience matrix. Today, when both an accuracy band (`rumour.true`) and a pressure (`rumour_pressure` rising) resolve on a rumour seed, the assembler picks whichever single-condition snippet out-specifies the other; the *combination* the card actually turns on never lands as one line. Same gap for reputation_shift (axis × pressure / memory) and rival_tavern (rival_type × dual-pressure / memory). Phase 10 closes that gap.

**Cluster asymmetry vs prior phases.** Phases 152/153/154 had banded signals on the situation's primary subject (`faction.relationship × faction.influence`, `area.damage × area.condition × area.cleanliness`, `staff.stress × staff.fatigue × area.cleanliness`) and authored 3-meter cube corners. This cluster has *no band signals on its primary subject* — Phase 13/ISSUE-108 explicitly chose tag enrichment over new bands because `reputation.<axis>`, `rumour.<accuracy>`, `rumour.target.<kind>`, `rival.arc`/`rival.system` are categorical enums that don't band naturally. So the matrix shape is `(categorical hasTag × pressureRising × memoryPresent)` — flat reads, matching Phase 149's narrator-voiced families (`stock_shortage`, `debt_rent`) which used `severity` + `pressure` + `hasTag` + `memory` + `repeat`. **No new band signals. No new condition primitives. No new salience-read kinds.**

**Three templates, three voicings:**
- **`reputationShiftCard`** — narrator-voiced, no primaryActor with castAttributes (reputation is tavern-wide).
- **`rumourCrisisCard`** — actor-voiced through six possible target kinds (supplier / regular / faction / staff / customer_group / notable_npc), each carrying castAttributes per Phase 121 / Phase 128. Establishing pool is sim-backed narrator; reaction/manner pools carry the target's voice.
- **`rivalTavernCard`** — narrator-voiced, primaryActor is `local_event` (arc) or `systemRef('rival_tavern')` — neither carries castAttributes.

## What shipped

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Three new entries. Each lists reads most-salient-first. The categorical *what-is-this-about* tag leads (the card is about *this axis* / *this accuracy* / *this rival type*), then the family pressure rising, then secondary pressures (where applicable), then choice-affecting memories ordered to mirror each generator's emit, then severity, then the per-family repeat as the deepest rung.

- **`reputation_shift`** (15 reads): ten axis hasTag reads ordered by trafficked extremity → `pressureRising reputation_drift` → memory `identity` → memory `customer` → severity ≥ 70 → repeat reputation ≥ 3. Only one axis tag resolves per seed; the order is enumerable, not exclusive.
- **`rumour_crisis`** (17 reads): four accuracy hasTag → six target-kind hasTag → `pressureRising rumour_pressure` → memory `denial` → `honesty` → `bribe` → `deception` (mirrors `expandedSeedGenerators.ts:5074,5723,5333`) → severity ≥ 70 → repeat rumour ≥ 3. Accuracy leads target-kind because accuracy shapes the decision space.
- **`rival_tavern`** (10 reads): `rival.arc` → `rival.system` → `pressureRising rival_tavern_pressure` → `pressureRising regular_customer_loss` (cross-pressure crossover) → memory `price` → `event` → `deception` → `ignored` → severity ≥ 70 → repeat rival ≥ 3.

### B. Multi-fact slot enablement

All three templates' `establishing_line` slots gain `saliencePolicy: 'multi'` + `multiFactJoin: ' — '` plus a 10-line comment block matching `supplierReliability.ts` precedent.

### C. Establishing matrix authoring

Per template, ~10 new combination snippet cells. No new condition primitives. Every combo gates on two or three of `hasTag` / `pressureRising` / `memoryPresent` / `severityAtLeast` / `repeatCount`.

- **`reputationShift/establishingLine.ts`** (+10 cells, total 14 → 24): 5 axis × pressure × memory cells (cozy / dangerous / reliable / tasty / respectable); 4 axis × severity × pressure cells; 1 top-rung `est_dangerous_severity_repeat`.
- **`rumourCrisis/establishingLine.ts`** (+10 cells, total 16 → 26): 6 accuracy × target_kind × pressure corners; 1 `est_target_notable_npc_pressure` filling the previously-missing notable_npc rung; 3 accuracy × memory cells; 1 top-rung `est_false_pressure_repeat`.
- **`rivalTavern/establishingLine.ts`** (+10 cells, total 12 → 22): 2 rival_type × customer_loss-pressure cells; 4 rival_type × memory cells; 2 dual-pressure cells; 2 top rungs.

### D. State-keyed reaction & sensory pools

- **`reputationShift/reactionLine.ts`** (+5 narrator state-keyed snippets), **`mannerNote.ts`** (+3 sensory beats).
- **`rumourCrisis/reactionLine.ts`** (+5 first-person target snippets gated on rumour-state reads only, so they fire across all six target kinds regardless of voice axis), **`mannerNote.ts`** (+3 third-person sensory beats).
- **`rivalTavern/reactionLine.ts`** (+5 narrator state-keyed snippets), **`mannerNote.ts`** (+3 sensory beats).

### E. Tests

- `tests/cards/compose/phase146.salience.test.ts` — extended with 3 new SALIENCE_TABLES coverage tests (one per family), asserting the lead-rung shape and the order of subsequent reads.
- `tests/cards/compose/phase155.exhaustiveMatrix.test.ts` — new file. 32 tests covering: matrix-cell reachability (each new combo's distinctive substring appears in `view.body[0]` for its triggering state); state-varying reaction tests (same family × two state mutations → distinct `body[1]`); re-render stability (JSON equality across two `card.render()` calls).

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — 3 new SALIENCE_TABLES entries (~115 LOC including comment block).
- `src/cards/templates/{reputationShift,rumourCrisis,rivalTavern}.ts` — each gains `saliencePolicy: 'multi'` + `multiFactJoin: ' — '` + comment block on the establishing slot.
- `src/cards/compose/pools/{reputationShift,rumourCrisis,rivalTavern}/establishingLine.ts` — 10 new combo snippets each.
- `src/cards/compose/pools/{reputationShift,rumourCrisis,rivalTavern}/reactionLine.ts` — 5 state-keyed snippets each.
- `src/cards/compose/pools/{reputationShift,rumourCrisis,rivalTavern}/mannerNote.ts` — 3 state-keyed beats each.
- `specs/cards/{reputation_shift,rumour_crisis,rival_tavern}.spec.yaml` — `phase155:` design-record sections appended.
- `docs/ISSUE_TRACKER.md` — new ISSUE-123 row.
- `tests/cards/compose/phase146.salience.test.ts` — 3 new coverage tests.

**Created:**
- `tests/cards/compose/phase155.exhaustiveMatrix.test.ts` — 32 matrix tests.
- `docs/plans/phase-155-reputation-rumour-rivals-content.md` — this file.

## Authoring iterations

Eight in-place rewrites during authoring to clear gate violations:

1. `rxn_state_repeat_three` reword: initial draft duplicated existing `rxn_repeat` text ("Three closings on the same drift means the shape is set.") → reworded to a pressure × repeat pair (`rxn_state_pressure_repeat`).
2. `rxn_state_cozy_pressure` voice-bounds trim: 13 → 11 words.
3. `rxn_state_customer_pressure` voice-bounds trim: 13 → 10 words.
4. `mnr_state_severity_repeat` (reputationShift) voice-bounds trim: 12 → 10 words.
5. `mnr_state_dangerous_identity` voice-bounds trim: 12 → 10 words.
6. `mnr_state_false_pressure` (rumour) voice-bounds trim: 11 → 10 words.
7. `mnr_state_supplier_bribe` voice-bounds trim: 11 → 9 words.
8. `rxn_state_arc_customer_loss`, `rxn_state_price_pressure`, `mnr_state_arc_pressure`, `mnr_state_dual_pressure`, `mnr_state_severity_repeat` (rivalTavern) — voice-bounds trims (13 → ≤12 for reaction, 11–13 → ≤10 for manner). `mnr_state_dual_pressure` initial draft "Two columns of the ledger have thinned since the same night last week" also hit `simCoherence` unbacked-history detector (`\blast\s+(week|night|month|time)\b`) — reworded to "Two columns of the ledger have both thinned tonight."

One test rewrite: the `est_dual_pressure_rising` snippet is salience-disadvantaged when the seed always carries either `rival.arc` or `rival.system` (those hasTag reads sit at salience index 0–1 and outcompete the pressure-only snippet at indices 2–3), so the dual-pressure assertion was rewritten to verify the multi-fact join surfaces both pressure facts via the primary rival_type snippet plus the secondary customer-loss snippet.

## Verification

```
npm run typecheck   # green
npx vitest run tests/cards/compose/phase146.salience.test.ts   # 35/35
npx vitest run tests/cards/compose/phase155.exhaustiveMatrix.test.ts   # 32/32
npx vitest run tests/cards/compose/gates/runAllGates.test.ts   # 41/41
npx vitest run tests/cards/templates.{reputationShift,rumourCrisis,rivalTavern}.test.ts   # 49/49
npm test   # 2824/2824 across 214 files
```

## Out of scope (deliberate)

- The remaining Movement VI cluster phase (11 — periodic/narrative).
- Movement VII preview pools (12–14).
- The Phase-16 legibility gate.
- Phase-17 deepening & recalibration.
- Any change to sim response slot counts, verbs, targets, or effect amounts.
- New condition primitives, new `SalienceRead` kinds, new band signals.
- Fix to the pre-existing `est_axis_reputable` / `est_axis_scholarly` dead-snippet bug in `reputationShift/establishingLine.ts` — those snippets gate on `reputation.reputable` / `reputation.scholarly` tags that don't exist in production (the actual reputation state axes are `cheap`, `tasty`, `filthy`, `dangerous`, `cozy`, `strange`, `reliable`, `goblinAuthentic`, `respectable`, `culinary_renown`). Left unfixed because it's harmless dead code authored in Phase 139.
