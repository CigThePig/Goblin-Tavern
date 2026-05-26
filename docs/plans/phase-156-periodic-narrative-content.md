# Phase 156 — Periodic & Narrative Content Matrices

**ISSUE-124.** Eighth and final phase of Movement VI of the Legible
Surface arc (`docs/plans/legible-surface-arc.md`, **Phase 11**). Closes
Movement VI. Mirrors phases 149–155 — same authoring loop, same nine
gates, no Movement-V loopback.

## Context

Voiced Surface (Phase 140 / ISSUE-109) shipped two compositional
templates for this cluster — `monthlyReviewCard` and `seasonalArcCard`
— but neither was extended into the Legible Surface salience matrix.
Today, when a monthly_review seed resolves both a rising pressure and
a prior-month memory, the assembler picks whichever single-condition
snippet out-specifies the other; the COMBINATION the card actually
turns on never lands as one line. Same gap for seasonal_arc (theme ×
pressure / memory / severity). Phase 11 closes that gap and closes
Movement VI.

**Cluster shape.** Both families are **narrator-voiced**:
`monthly_review`'s `primaryActor` is a `month` ref (audit pass 1 §5.3
— periods are not characters), `seasonal_arc`'s is a `local_event` ref
(Path A active arc) or `undefined` (Path B anticipation). Neither has
band signals on its primary subject. The matrix shape is
`(severity × pressure × memory × repeat)` for monthly_review and
`(theme hasTag × pressure × memory × severity × repeat)` for
seasonal_arc — flat reads, matching Phase 155's narrator-voiced
cluster.

**No Movement-V loopback.** Every read uses one of the six already-
shipped `SalienceRead` kinds. No new condition primitives, no new band
signals, no `resolveActorRef` role changes, no `SalienceRead`
extensions.

## What shipped

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Two new entries appended after the Phase 155 `rival_tavern` block.

- **`monthly_review`** (13 reads): `severity ≥ 70` → `pressure
  landlord` → `pressure debt` → `pressure reputation_drift` →
  `pressure rival_tavern_pressure` → `pressure staff_burnout` →
  `pressure customer_complaint` → memory `rent` → `cellar` →
  `reserves` → `rival` → `landlord` → `repeat monthly ≥ 3`.

  Severity leads — narrator-voiced family without a categorical
  *what-is-this-about* tag, matching Phase 149's `stock_shortage` /
  `debt_rent` precedent. Family-primary pressure `landlord` first, then
  the secondary pressures the seed actually touches via
  `recentCauseEntries` and consequence-profile delayed effects.
  Memories ordered to mirror the four consequence profiles' emitted
  tags (`rent_paid_${monthKey}` / `cellar_invested_${monthKey}` /
  `reserves_held_${monthKey}` / `rival_settled_${monthKey}`). No
  `hasTag` reads — `monthly` / `summary` / `economy` / `reputation` are
  shared surface tags, not categorical card subjects (`reputation.cozy`
  is a categorical subject for reputation_shift, but the monthly_review
  surface tags don't carry that role).

- **`seasonal_arc`** (11 reads): five theme `hasTag` reads
  (`mushroom_blight` → `miner_payday_boom` → `inspection_campaign` →
  `rival_tavern_expansion` → `festival_approaching`) → `pressure
  arc_escalation` → `pressure festival_readiness` → memory `arc` →
  `festival` → `severity ≥ 70` → `repeat arc ≥ 3`.

  Theme tag leads — the categorical *what-is-this-about* fact (a
  blight card is a different card from a festival card). Matches Phase
  155's rumour-accuracy / rival-type precedent. Only one theme tag
  resolves per seed (`theme` enum at `expandedSeedGenerators.ts:4323-
  4327` is single-valued). The `repeat arc ≥ 3` read may not always
  resolve in production (the family doesn't currently emit `arc` as a
  `recencyKey`), but listing it preserves enumerability for the Phase-
  16 legibility gate — matches Phase 152's precedent.

### B. Multi-fact slot enablement

Both templates' `establishing_line` slots gained:

```ts
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Plus a 10-line comment block explaining what the multi-fact policy
buys this template (mirrors `supplierReliability.ts:76-89`).

### C. Establishing matrix authoring

Per template, 10 new combo cells. Every combo on the sim-backed slot
carries ≥1 state-lookup primitive (`pressureRising` / `memoryPresent`
/ `repeatCount`) so `simCoherence` passes — `hasTag`,
`severityAtLeast`, and `seedType` are not state-lookup kinds on their
own.

**`monthlyReview/establishingLine.ts`** (+10 cells, total 13 → 23):

1. `est_landlord_rent_memory` — landlord↑ × rent-memory
2. `est_landlord_reserves_memory` — landlord↑ × reserves-memory
3. `est_debt_rent_memory` — debt↑ × rent-memory
4. `est_debt_landlord_dual` — debt↑ × landlord↑ (dual pressure)
5. `est_rival_pressure_memory` — rival_tavern_pressure↑ × rival-memory
6. `est_customer_complaint_reputation_dual` — customer_complaint↑ ×
   reputation_drift↑
7. `est_staff_burnout_landlord_dual` — staff_burnout↑ × landlord↑
8. `est_severity_landlord_rent` — severity 70 × landlord↑ ×
   rent-memory (3-cond top rung)
9. `est_severity_debt_repeat` — severity 70 × debt↑ × repeat monthly
   ≥ 3 (3-cond deepest rung)
10. `est_cellar_landlord_dual` — landlord↑ × cellar-memory

**`seasonalArc/establishingLine.ts`** (+10 cells, total 12 → 22):

1. `est_blight_arc_memory` — blight × arc-memory
2. `est_payday_arc_memory` — miner_payday_boom × arc-memory
3. `est_inspection_arc_memory` — inspection_campaign × arc-memory
4. `est_rival_arc_memory` — rival_tavern_expansion × arc-memory
5. `est_festival_memory` — festival_approaching × festival-memory
6. `est_blight_severity` — blight × severity 70 × arc_escalation↑
7. `est_inspection_severity` — inspection_campaign × severity 70 ×
   arc_escalation↑
8. `est_dual_pressure_arc_festival` — arc_escalation↑ ×
   festival_readiness↑
9. `est_climax_severity_pressure` — seedType arc_milestone × severity
   70 × arc_escalation↑ (3-cond climax top rung)
10. `est_festival_pressure_memory` — festival_approaching ×
    festival_readiness↑ × festival-memory (3-cond deepest rung)

### D. State-keyed reaction & sensory pools

**`monthlyReview/reactionLine.ts`** (+5 state-keyed snippets):
`rxn_landlord_rising`, `rxn_debt_rising`, `rxn_severity_landlord`,
`rxn_rival_memory_pressure`, `rxn_monthly_repeat`.

**`monthlyReview/mannerNote.ts`** (+3 state-keyed beats):
`mnr_rival_memory`, `mnr_debt_landlord_dual`, `mnr_customer_complaint`.

**`seasonalArc/reactionLine.ts`** (+5 state-keyed snippets):
`rxn_arc_escalation`, `rxn_festival_readiness`, `rxn_climax_severity`,
`rxn_arc_memory_pressure`, `rxn_dual_pressure`.

**`seasonalArc/mannerNote.ts`** (+3 state-keyed beats):
`mnr_arc_escalation`, `mnr_severity_pressure`, `mnr_dual_pressure`.

### E. Tests

- **`tests/cards/compose/phase146.salience.test.ts`** — +2 coverage
  tests asserting reads structurally (severity-lead for
  monthly_review; theme-lead for seasonal_arc).

- **`tests/cards/compose/phase156.exhaustiveMatrix.test.ts`** — new
  file, 24 tests:
  - 5 monthlyReview `pressure × memory` cells
  - 3 monthlyReview dual-pressure cells
  - 2 monthlyReview severity top rungs
  - 5 seasonalArc `theme × memory` cells
  - 2 seasonalArc `theme × severity × pressure` cells
  - 3 seasonalArc dual-pressure + climax + deepest rung
  - 2 state-varying reaction tests (one per template)
  - 2 re-render stability tests (one per template)

### F. Specs

`specs/cards/{monthly_review,seasonal_arc}.spec.yaml` — `phase156:`
design records appended listing the new matrix cells, the salience
table, and the multi-fact policy.

### G. Tracker

`docs/ISSUE_TRACKER.md` — ISSUE-124 row prepended above ISSUE-123 with
`Status: done`, `Phase: 156`.

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — 2 new `SALIENCE_TABLES` entries.
- `src/cards/templates/monthlyReview.ts` — `saliencePolicy: 'multi'` +
  comment block.
- `src/cards/templates/seasonalArc.ts` — same.
- `src/cards/compose/pools/monthlyReview/{establishingLine,reactionLine,mannerNote}.ts`
- `src/cards/compose/pools/seasonalArc/{establishingLine,reactionLine,mannerNote}.ts`
- `specs/cards/{monthly_review,seasonal_arc}.spec.yaml`
- `tests/cards/compose/phase146.salience.test.ts` — +2 coverage tests.
- `docs/ISSUE_TRACKER.md` — ISSUE-124 entry.

**Created:**
- `tests/cards/compose/phase156.exhaustiveMatrix.test.ts`
- `docs/plans/phase-156-periodic-narrative-content.md` — this file.

## Authoring iterations

Two test fixtures required care during authoring:

1. **Climax cell collision at specificity 3.** The
   `est_climax_severity_pressure` snippet ties at spec 3 with
   `est_blight_severity` and `est_inspection_severity` on those
   themes; salience scoring picks whichever covers the lower table
   index (theme `hasTag` at indices 0-4 beats `arc_escalation` at
   index 5). The climax test was scoped to `festival_approaching`
   theme — no competing `(theme × severity × pressure)` spec-3 cell
   exists for that theme, so the climax cell is the unique spec-3
   winner.

2. **Reaction-varying test FNV collapse.** A naive comparison of
   `arc_escalation`-rising vs `festival_readiness`-rising states with
   a `festival_approaching` themed seed lands both branches on the
   spec-1 `rxn_festival` (existing theme-gated reaction) via FNV
   tie-break. Fixed by scoping each fixture to force a spec-2 new
   reaction: `(arc_escalation↑ + arc-memory)` triggers
   `rxn_arc_memory_pressure`; `(arc_escalation↑ + festival_readiness↑)`
   triggers `rxn_dual_pressure`. Both spec-2, distinct text.

No snippet rewords were needed. Word budgets (14 establishing / 12
reaction / 10 manner) and the `\bagain\b` / `\byesterday\b` /
`\blast\s+(month|...)` detectors all cleared on first pass — "rent
paid last month" appears only on `establishing_line` which is
sim_backed and exempt from the flavor-mode history-claim detector.

## Verification

```
npm run typecheck                                                   # green
npx vitest run tests/cards/compose/phase146.salience.test.ts        # 37/37 (+2)
npx vitest run tests/cards/compose/phase156.exhaustiveMatrix.test.ts # 24/24
npx vitest run tests/cards/compose/gates/runAllGates.test.ts        # 41/41
npx vitest run tests/cards/templates.monthlyReview.test.ts          # 16/16 (stable)
npx vitest run tests/cards/templates.seasonalArc.test.ts            # 18/18 (stable)
npm test                                                            # 2850/2850 across 215 files (+24 vs post-Phase-155 baseline of 2826)
```

## Out of scope (deliberate)

- **Movement VI is complete after this phase.** No further cluster
  phases.
- **Movement VII preview pools (Phases 12–14)** — economic / social /
  operational previews keyed to `EffectDirection × EffectMagnitudeBand`.
- **The Phase-16 legibility gate.** Now unlocks — Movement VI has 8
  migrated clusters, gate's threshold met; gate is its own phase.
- **Phase-17 standing deepening & recalibration.**
- **Weekly overview cluster member** — `weeklyOverview` is a
  `ReportSection` per Phase 141, owned by Movement VIII Phase 15
  (Report-Prose Legibility), not Movement VI Phase 11.
- **Pre-existing dead-snippet bugs from Phase 140**:
  - `rxn_anticipation` in `seasonalArc/reactionLine.ts` gates on
    `hasTag anticipation` but `seed.toneHints` only carries `['arc',
    'calendar', theme]`; the `anticipation` flag lives on a memory tag
    inside the seed's `memoriesCreated`, not on the seed itself.
  - `est_rent_due_soon` / `rxn_rent_due_soon` in monthlyReview pools
    reference a `rent_due_soon` tag not emitted by the monthly_review
    seed.
  - Same harmless-dead-code situation as Phase 155's `est_axis_reputable`
    / `est_axis_scholarly`; fixing them is separate cleanup work.
- Any change to sim response slot counts, verbs, targets, or effect
  amounts — composition voices around mechanics, never alters them.
- New condition primitives, new `SalienceRead` kinds, new band signals.
