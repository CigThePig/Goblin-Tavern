# Phase 10 — Prioritization, Repair Roadmap, and Audit Tracker

Status: **completed** on 2026-06-03.

This document consolidates the Phase 1–9 audit ledgers into a repair roadmap.
Per the follow-up instruction for this pass, confirmed work was **not** promoted
to `docs/ISSUE_TRACKER.md`. Instead, this file creates audit-local tracking
numbers with the `AUD-ROAD-010-*` prefix.

## Inputs reviewed

| Source | Role in this phase |
|---|---|
| `docs/audits/phase-01-architecture-map.md` | Architecture candidates and source-of-truth drift. |
| `docs/audits/phase-02-sim-engine-and-state.md` | Engine/state candidates and migration guardrails. |
| `docs/audits/phase-03-simulation-modules.md` | Module dependency, issue-seed seam, and long-run follow-ups. |
| `docs/audits/phase-04-cards-issue-seeds-composition.md` | Card template coverage candidate for policy backlash. |
| `docs/audits/phase-05-reports-projections-explanatory-surfaces.md` | Confirmed report explanation defect and quiet-digest design candidate. |
| `docs/audits/phase-06-web-store-persistence-session-recovery.md` | Browser persistence/session candidate guardrails. |
| `docs/audits/phase-07-ui-screens-components-accessibility-affordances.md` | Confirmed entity-link detail-sheet defect and UI candidates. |
| `docs/audits/phase-08-test-suite-oracle-blind-spots.md` | Confirmed heavy-tier failure, fast-tier ergonomics issue, and test oracle candidates. |
| `docs/audits/phase-09-content-data-quality-balance-long-run.md` | Confirmed long-run debt/rent validation defect and content/balance candidates. |

## Promotion rules used

- Only findings marked `confirmed` in their phase ledger were promoted to active
  repair tracker rows.
- Findings marked `candidate` remain in the candidate backlog below and should
  receive a focused reproduction, design decision, or guardrail test before being
  treated as defects.
- Design or tuning questions were grouped separately from mechanical bugs so they
  do not block high-confidence repair work.
- Tracking numbers in this file are audit-local and intentionally separate from
  `docs/ISSUE_TRACKER.md`.

## Confirmed findings promoted to audit-local repair tracker

| Tracker ID | Source finding(s) | Status | Priority | Severity | Risk | Root cause group | Repair scope | Suggested tests / checks |
|---|---|---|---|---|---|---|---|---|
| AUD-ROAD-010-001 | `AUD-TEST-008-001` | ready | P0 | high | The heavy long-run oracle cannot complete, so later balance/content fixes may be validated against an incomplete suite. | Test infrastructure and memory pressure. | Restore `npm run test:heavy` by splitting or isolating `tests/sim/phase20.cardlessPlaytest.test.ts`, reducing retained playtest payload, or running heavy shards in separate processes. | Re-run `npm run test:heavy` until all four heavy files and all collected tests pass; add a guard that fails on collected-vs-run gaps. |
| AUD-ROAD-010-002 | `AUD-REP-001` | ready | P1 | high | Player-facing explanations can disappear for real state changes, weakening report trust and missed-opportunity guidance. | Report/cause target contract drift. | Update cause lookup to match current field-level cause targets, or support both current diff-path targets and legacy colon/id targets. Repair missed-opportunity filtering through the same lookup contract. | Plant field-level causes for area, stock, staff, and reputation paths; assert `causesForPath(...)` finds them. Add a missed-opportunity counterfactual test for a negative significant diff with a matching cause. |
| AUD-ROAD-010-003 | `AUD-CONTENT-009-001` | ready | P1 | high | Long no-input saves accumulate recurring validation errors once rent/debt pressure crosses the seed urgency bounds. | Issue-seed numeric bounds not clamped at generation. | Clamp `debt_rent` seed severity/urgency to the 0–100 contract, preferably through a shared seed-building clamp if equivalent families can drift. | Add a long-run no-input regression that fails on any `issue_seed_*_oor` validation issue and covers the day-85+ unpaid-rent path. |
| AUD-ROAD-010-004 | `AUD-UI-007-001` | ready | P2 | medium | Entity links often route to the right screen but fail to open the intended detail sheet, reducing navigability and making report/card references feel broken. | UI route-target consumption is implemented per panel, not consistently across destinations. | Add target-consumption effects or a shared helper for all panels with detail destinations declared in `ENTITY_ROUTING`, including stale-id silent degradation. | Add an EntityLink destination matrix covering every routed kind with a detail sheet; add stale-target fallback tests. |
| AUD-ROAD-010-005 | `AUD-TEST-008-002` | ready | P2 | medium | The default test tier is operationally too slow for the documented expectation, reducing the chance contributors run it routinely. | Test tier documentation and suite partitioning drift. | Measure per-file runtime, refresh comments/docs, and either create a small smoke tier or move the slowest current fast-tier files to a medium/heavy tier. | Re-run `npm test`; add and run the new smoke command if created; document expected runtime from measured data. |

## Recommended repair sequence

1. **Restore the heavy oracle first (`AUD-ROAD-010-001`).** This unlocks reliable
   validation for long-run balance and content repairs and prevents the audit from
   relying on a broken P0 verification path.
2. **Fix high-severity player/sim correctness issues (`AUD-ROAD-010-002` and
   `AUD-ROAD-010-003`).** These are independent code paths and can be repaired in
   either order once the target test files are identified.
3. **Repair navigation affordances (`AUD-ROAD-010-004`).** This is medium
   severity but user-visible, with a bounded web-component test matrix.
4. **Rebalance test tiers (`AUD-ROAD-010-005`).** This is lower than broken tests
   and correctness defects, but it improves everyday development safety.
5. **Return to candidates only after the confirmed queue is stable.** Candidate
   work should start with tests or design calls, not direct production changes.

## Candidate backlog requiring evidence or design decisions

These rows are **not** promoted defects. They are grouped by likely follow-up so
future repair phases can pick bounded probes without rereading every phase ledger.

### Guardrail and source-of-truth candidates

| Candidate group | Source findings | Suggested next step |
|---|---|---|
| Production code importing compatibility/testing wrappers | `AUD-ARCH-001` | Switch the web-store `FULL_PIPELINE` import to `src/sim/canonicalPipeline.ts` if the team wants source-of-truth clarity; optionally add a search guard for production `testing/` imports. |
| Empty or deprecated extension seams | `AUD-ARCH-002`, `AUD-ARCH-003`, `AUD-SIM-001`, `AUD-SIM-003`, `AUD-CONTENT-009-005` | Make a design call: keep with explicit comments/tests, rename as placeholders, or remove once no host/docs require them. |
| Canonical-pipeline oracle drift | `AUD-TEST-008-003`, related to `AUD-MOD-001` | Convert production-like local pipeline arrays to canonical imports; rename deliberate slices to `TEST_PIPELINE` / `MODULE_SLICE`; decide what `dependsOn` must guarantee. |
| Runner parser brittleness | `AUD-TEST-008-004` | At the next Vitest upgrade, add a parser fixture test or switch the wrapper to a machine-readable reporter. |

### Focused test-oracle candidates

| Candidate group | Source findings | Suggested next step |
|---|---|---|
| Consolidated migration fixture | `AUD-SIM-002` | Build one old-shaped persisted session that omits or legacy-renames every currently migrated field, then assert load/import succeeds and normalizes all fields. |
| Diff/report consumer matrix | `AUD-SIM-004` | Complete a consumer-by-diff-path matrix for daily report, missed opportunity, pressure, and digest projections after repairing `AUD-ROAD-010-002`. |
| Pending-choice semantic rebinding | `AUD-WEB-006-001` | Create a crafted valid import whose pending choice no longer matches the current seed's response slot, then decide whether to drop, ignore, or visibly warn. |
| Snapshot budget test seam | `AUD-WEB-006-002` | Make injected storage fixtures browser-like with `length`/`key(i)`, or expose an explicit iterator so quota tests count the same bytes as production. |
| ActionPicker guard parity | `AUD-UI-007-002` | Route picker additions through `tryAddPick(...)`, or add parity tests for stale target/action rejection. |
| BottomSheet interaction and a11y warning | `AUD-UI-007-003` | Replace the click-propagation stopper with a backdrop-target check and add keyboard/focus/backdrop regression tests. |

### Content, card, and balance design candidates

| Candidate group | Source findings | Suggested next step |
|---|---|---|
| Policy-backlash authored card surface | `AUD-MOD-002`, `AUD-CARD-001` | Decide whether fallback-only rendering is intentional. If not, add a spec, dedicated template, and template tests for `policy_backlash`. |
| Long-run and content balance dashboards | `AUD-MOD-003`, `AUD-CONTENT-009-002`, `AUD-CONTENT-009-003`, `AUD-CONTENT-009-004`, `AUD-CONTENT-009-006`, `AUD-CONTENT-009-007` | After the heavy tier is restored, add dashboards for strategy diversity, response impact by family, entity distribution, attribution save-size ceilings, and high-expedition/high-project play. |
| Daily quiet prose with weekly/monthly digest | `AUD-REP-002` | Decide whether digest presence should suppress quiet-day prose; add a minimal projection test for the chosen behavior. |

## Resolved design calls for follow-up implementation

- Production `FULL_PIPELINE` imports come from `src/sim/canonicalPipeline.ts`, not `src/sim/testing/simRunner`.
- Empty/deprecated registries and compatibility seams are not active architecture unless a real host consumes them; remove them, rename them as placeholders, or document them as legacy compatibility.
- `dependsOn` means same-phase ordering only. It is not a complete data-dependency graph.
- Test-only local pipeline arrays should be named `TEST_PIPELINE` or `MODULE_SLICE`. Only true full-pipeline integration tests should import `FULL_PIPELINE`.
- Pending choices that no longer semantically match the current seed should be dropped on load/import, without a player warning.
- `ActionPicker` should use the store guard path, preferably `tryAddPick(...)`, instead of constructing and committing picks through a separate path.
- The BottomSheet accessibility warning should be fixed by using a backdrop-target check instead of suppressing propagation inside the sheet.
- `policy_backlash` should receive an authored card template later; do not implement it in this groundwork pass unless already trivial and isolated.
- Balance dashboards should start as diagnostics, not hard-failing thresholds.
- Daily quiet prose should be suppressed when weekly/monthly digest prose is present, while `isQuiet` remains a signal for daily movement only.

## Wont-fix / design-call list

No phase ledger explicitly marked a finding `wont-fix`. The following are current
design-call items rather than defects:

- Empty registries and deprecated compatibility seams may be intentional host
  extension points.
- `policy_backlash` may intentionally use generic fallback cards until its voice
  is designed.
- Strategy convergence, low-impact response families, and named-entity repetition
  may be tuning preferences unless the team defines thresholds.
- Quiet prose plus weekly/monthly digest may be acceptable if the copy is meant
  to describe the day only, not the entire report.

## Commands run for Phase 10

```bash
rg --files docs/audits | sort
python3 - <<'PY'
from pathlib import Path
for f in sorted(Path('docs/audits').glob('phase-0*.md')):
    print('\n###', f)
    for line in f.read_text().splitlines():
        if line.startswith('| AUD-'):
            print(line)
PY
```

## Exit criteria

- Prioritized repair roadmap with severity, risk, and suggested tests: complete.
- Clear list of design-call and not-yet-promoted candidate items: complete.
- No speculative candidates promoted as confirmed bugs: complete.
- No changes made to `docs/ISSUE_TRACKER.md`: complete.
