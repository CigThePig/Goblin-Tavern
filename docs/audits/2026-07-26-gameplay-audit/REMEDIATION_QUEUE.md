# Gameplay Audit — Remediation Queue

Working checklist for the 2026-07-26 eight-phase gameplay audit. **This file
is the authoritative work queue for the audit arc** (ISSUE-166); the tracker
carries one entry, not 29. Update the `St` column here as findings land —
do not copy findings into `docs/ISSUE_TRACKER.md`.

Status: `open` · `wip` · `done` (fixed + regression test) · `n/a` (dropped, with reason).

**Order is by wave, and waves are sequential** — each wave ends at an evidence
gate, not at code completion. Detail for any finding: open the phase report
under `reports/` at the section named in the last column. Priority/severity
rationale, causal clusters (CL-01…CL-08), the regression matrix, and the
acceptance gates live in
`reports/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md`
(§4 order, §6 clusters, §7 waves, §8 regression, §11 acceptance).

## Wave 0 — Restore durable progress

Gate: R11/R12 pass at every beat and segment; pending choice, queued action,
baseline, Service outcome, report archive, RNG and calendar survive reload
unchanged.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P2-RT-001 | open | Crit/P0 | Save serialization throws on a Svelte proxy — autosave, Continue, snapshot, export/import and error-reload all lose the run | P2 §9 |

## Wave 1 — Restore canonical state and economy

Gate: `coin >= 0` on every supported route; rent applies once; ordinary stock
obeys the minimum price; compact pressure == rich pressure at every stable
beat; one significant pressure change → one canonical cause; eight shared-seed
28-day strategies validate throughout.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P7-EXP-001 | open | High/P1 | Unaffordable rent response overspends into negative coin without paying rent | P7 §7 |
| P7-EXP-002 | open | High/P1 | Three ordinary restocks cost zero coin | P7 §7 |
| P4-SEAM-003 | open | High/P1 | Compact and rich pressure state diverge (no single authority) | P4 §5 |
| P7-EXP-004 | open | Med/P1 | Reports render pre-response pressure snapshots | P7 §7 |
| P4-SEAM-001 | open | Med/P2 | Significant pressure changes logged twice | P4 §5 |

## Wave 2 — Make causality and closed reports authoritative

Gate: a closed report is field-stable immediately, next day, days later and
after reload; simultaneous causes for two staff / groups / rooms never cross
identity; Fix Root names one room from preview through report; blame/mock
cannot become positive coaching on magnitude alone.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P4-SEAM-002 | open | High/P1 | Yesterday's missed opportunities are rebuilt from today's state | P4 §5 |
| P6-COMP-006 | open | Med/P2 | Historical reports lose resolved choices | P6 §6 |
| P5-PLAY-003 | open | High/P1 | Issue evidence crosses actor/location boundaries (shared cause-query contract) | P5 §6 |
| P4-SEAM-004 | open | Med/P2 | Seasonal arc card absorbs staff-arc causes | P4 §5 |
| P5-PLAY-004 | open | High/P1 | Fix Root applies to the wrong room | P5 §6 |
| P7-EXP-003 | open | High/P1 | Missed-opportunity coaching recommends destructive choices | P7 §7 |

## Wave 3 — Complete the decision lifecycle

Gate: the seven Phase 6 comprehension questions are answerable from the
interface for one immediate response, one delayed response, one project, one
priority and one report-to-plan path — and the same explanation survives
reload and historical revisit.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P6-COMP-001 | open | High/P1 | Confirmations replace player choice language with internal verbs | P6 §6 |
| P6-COMP-002 | open | High/P1 | Delayed choices have no pending/applied/expired lifecycle | P6 §6 |
| P6-COMP-003 | open | Med/P2 | Cause drilldowns expose machine metadata | P6 §6 |
| P6-COMP-004 | open | Med/P2 | Staff priorities hide tradeoffs and results | P6 §6 |
| P5-PLAY-002 | open | Med/P2 | Satisfaction rows omit the customer group | P5 §6 |

## Wave 4 — Restore action reachability and contextual transfer

Gate: R02/R06 pass through every normal entry; one contextual target stays
consistent from CTA through picker, quote, queue, Segment B, report and
reload; after-Service work is disallowed or explicitly labelled tomorrow;
expeditions complete naturally end to end.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P3-BHV-001 | open | Med/P2 | Inline policy toggles never queue (payload omits the target) | P3 §5 |
| P3-BHV-002 | open | Med/P2 | Expedition commissioning cannot open | P3 §5 |
| P5-PLAY-001 | open | Med/P2 | After-service planning says "today", queues tomorrow | P5 §6 |
| P6-COMP-005 | open | Med/P2 | Licence claims owner time but spends none | P6 §6 |
| P7-EXP-006 | open | Med/P2 | Planner handoff loses the problem target | P7 §7 |

## Wave 5 — Repair secondary surfaces and identity

Gate: R15 crosses every root/detail/support surface without error; entity
names and historical labels survive removal, close, next day and reload.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P2-RT-002 | open | Med/P2 | Duplicate glossary ID crashes rendering | P2 §9 |
| P2-RT-003 | open | Med/P2 | Duplicate tags crash a populated Tavern Log | P2 §9 |
| P3-BHV-003 | open | Low/P3 | Fired staff name lost in the report heading | P3 §5 |
| P4-SEAM-005 | open | Low/P3 | New local-arc projections disagree by one boundary | P4 §5 |
| P6-COMP-007 | open | Low/P3 | Internal vocabulary leaks onto default surfaces | P6 §6 |

## Wave 6 — Tune issue relevance and attention load

Gate: no off-menu unused item claims recent demand; long-run card and
rendered-choice ceilings meet an approved target; recurring issues keep state
and escalation instead of reappearing context-free; urgent Service incidents
stay reachable.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P5-PLAY-005 | open | Med/P2 | Stock shortage invents demand for unused items | P5 §6 |
| P7-EXP-005 | open | Med/P2 | Full-day card load and repetition unbounded (157 cards / 891 buttons over 28 days) | P7 §7 |

## Wave 7 — Re-evaluate balance and whole experience

No findings; runs only after Waves 0–6. Rerun the eight shared-seed
strategies, add Easy/Hard, compare action vs no-action vs partial-response
variants, re-run a human public route past Day 29, and reassess every Phase 7
design question. The current strategy matrix proves differentiation, not
balance. Detail: Phase 8 §7 (Wave 7).

## Decide before implementing (P4)

| ID | St | Record | Decision needed |
|---|---|---|---|
| P2-OBS-001 | open | P2 §9 | Quick Day is never naturally eligible — keep it as a route (and build a supported zero-card fixture) or retire it |
| P3-DC-001 | open | P3 §5 | Explicit Ignore and no-response share wording — are deliberate refusal and inaction the same fact? |

Ten broader design questions (`DC-01`…`DC-10`: long-term objective, failure
and recovery contract, intended reactive workload, onboarding vs complete
surface, persistence promise, …) are in Phase 8 §9. They gate wording and
scope decisions inside the waves above; answer each one when its wave reaches
it, and record the answer in this file under the relevant wave.

## Fixtures

`fixtures/` holds the probes the audit ran, importing the live `src/` tree —
they reproduce findings against the current code and double as regression
harnesses. Verified working after extraction:

```bash
npx tsx docs/audits/2026-07-26-gameplay-audit/fixtures/phase2_quickday_probe.ts
npx tsx docs/audits/2026-07-26-gameplay-audit/fixtures/phase7-whole-experience-probes.ts strategyProbe
```

Section names accepted by the Phase 5 and Phase 7 probes are listed in
`README.md`.

## Audit-time baseline

At audit completion `npm run check`, `npm run typecheck` and `npm run build`
passed, as did 11 targeted test files (103 tests). No finding below was
caught by the existing suite — every wave needs new regression coverage, per
Phase 8 §8.
