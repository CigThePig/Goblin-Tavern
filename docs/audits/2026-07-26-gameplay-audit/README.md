# Goblin Tavern Gameplay Audit Package

This directory contains the complete eight-phase gameplay audit conducted on
the supplied `Goblin-Tavern-main (8).zip` snapshot and its public GitHub Pages
build.

> **Working queue:** `REMEDIATION_QUEUE.md` (added on extraction) is the
> authoritative per-finding checklist for this repository's remediation arc,
> tracked as ISSUE-166. Everything below describes the audit package as
> delivered.

## Installation

Extract the ZIP at the root of the Goblin Tavern repository. It adds:

```text
docs/audits/2026-07-26-gameplay-audit/
```

The archive contains no game source, dependencies, generated build output, or
changes outside that directory.

## Recommended reading order

1. `reports/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md`
2. `GAMEPLAY_AUDIT_FRAMEWORK.md`
3. Phase 1 through Phase 7 under `reports/` when detailed reproduction or
   technical evidence is needed.

Phase 8 is the consolidated deliverable. It contains:

- the final 29-finding register;
- severity and priority decisions;
- ownership and dependencies;
- causal clusters and deduplication decisions;
- the ordered remediation roadmap;
- regression and verification requirements;
- design-clarification questions.

## Included reports

- Phase 1 — Structural Verification
- Phase 2 — Runtime Path Verification
- Phase 3 — Individual Gameplay Behaviour
- Phase 4 — Connection and Seam Testing
- Phase 5 — Practical Play Evaluation
- Phase 6 — Player Comprehension
- Phase 7 — Whole-Experience Evaluation
- Phase 8 — Final Findings and Prioritization

## Reproducible fixtures

The `fixtures/` directory contains the controlled probes used during the
audit:

- `phase2_runtime_probe.ts`
- `phase2_quickday_probe.ts`
- `phase3-invalid-save.json`
- `phase4-seam-trace.ts`
- `phase4-periodic-trace.ts`
- `phase5-practical-probes.ts`
- `phase7-whole-experience-probes.ts`

The packaged TypeScript copies use repository-native imports targeting the
root `src/` directory.

From the repository root, a Phase 7 probe can be run with:

```bash
node --import tsx \
  docs/audits/2026-07-26-gameplay-audit/fixtures/phase7-whole-experience-probes.ts \
  strategyProbe
```

Available Phase 7 sections are:

- `freeRestockProbe`
- `debtPaymentProbe`
- `pacingAndCoachingProbe`
- `pressureContinuityProbe`
- `strategyProbe`

The Phase 5 fixture similarly accepts:

- `practicalReplay`
- `complaintDiagnostics`
- `shortageDiagnostics`
- `difficultyProbe`
- `budgetProbe`
- `monthAndCadenceProbe`
- `strategyProbe`

## Validation baseline

At completion of the audit:

```text
npm run check      Passed — 0 errors and 0 warnings
npm run typecheck  Passed
npm run build      Passed — 884 modules transformed
Targeted tests     Passed — 11 files, 103 tests
```

The production build retained its existing large-chunk advisory. No
performance-affecting-play defect was established from that advisory.

## Important status

The audit identifies confirmed defects and a repair order; it does not contain
product fixes. The first recommended correction is `P2-RT-001`, the
deterministic save serialization failure.

