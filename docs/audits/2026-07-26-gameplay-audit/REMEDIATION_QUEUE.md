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

## Wave 0 — Restore durable progress ✅ gate passed

Gate: R11/R12 pass at every beat and segment; pending choice, queued action,
baseline, Service outcome, report archive, RNG and calendar survive reload
unchanged.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P2-RT-001 | done | Crit/P0 | Save serialization throws on a Svelte proxy — autosave, Continue, snapshot, export/import and error-reload all lose the run | P2 §9 |

**Closed 2026-07-26.** Plan:
`docs/plans/phase-199-audit-wave-0-durable-progress.md`. Regression:
`tests/web/phase199.wave0.durableProgress.test.ts` (19 assertions) —
verified failing against the pre-fix serializer with the audit's own
`DataCloneError`, passing after.

- Root cause: two `structuredClone` calls on `$state` deep proxies inside
  `GameStore.serializeForSave()`. Replaced by `web/src/lib/sim/plainSave.ts`
  (`toPlainSaveData`), a proxy-safe JSON-faithful clone applied once to the
  whole envelope, which also throws a located error on anything non-JSON
  instead of persisting `{}`.
- The throw happened before `saveSession()` produced its typed result, so
  no banner appeared. `persistence.saveSessionFrom()` now builds and writes
  as one operation with a `'serialize'` failure reason; autosave, snapshot
  and export all route through it, and the banner gained a working Retry
  (it previously offered only Dismiss).
- Gate fields that were not persisted at all are now: the Service outcome
  strip, and the start-of-day baseline — the latter as a patch against the
  envelope's `state` (`baselinePatch.ts`, 218 KB against 1 585 KB at day
  28), which restores the report's full-day diff after a mid-day reload
  without re-breaking the quota the 2026-06-11 audit §1 fix protected.
- Gates re-run green: `npm test` (3 550), `npm run test:heavy` (129),
  `npm run typecheck`, `npm run check` (0/0), `npm run build`.

**Observation raised, not fixed (needs scheduling):** `TavernState` grows
without bound — `modules.attribution.attributions` is 985 KB of a 1 691 KB
day-28 state, ahead of `issueSeeds` (209 KB), `causes` (182 KB) and
`history` (150 KB). localStorage is UTF-16, so a day-28 save already sits
at roughly 4 MB of a typical 5 MB origin budget and a long run will
eventually fail to save for reasons unrelated to `P2-RT-001`. The audit ran
28–30 days and did not reach it; no finding covers it. Pruning those
ledgers is a simulation change — decide where it belongs.

## Wave 1 — Restore canonical state and economy ✅ gate passed

Gate: `coin >= 0` on every supported route; rent applies once; ordinary stock
obeys the minimum price; compact pressure == rich pressure at every stable
beat; one significant pressure change → one canonical cause; eight shared-seed
28-day strategies validate throughout.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P7-EXP-001 | done | High/P1 | Unaffordable rent response overspends into negative coin without paying rent | P7 §7 |
| P7-EXP-002 | done | High/P1 | Three ordinary restocks cost zero coin | P7 §7 |
| P4-SEAM-003 | done | High/P1 | Compact and rich pressure state diverge (no single authority) | P4 §5 |
| P7-EXP-004 | done | Med/P1 | Reports render pre-response pressure snapshots | P7 §7 |
| P4-SEAM-001 | done | Med/P2 | Significant pressure changes logged twice | P4 §5 |

**Closed 2026-07-27.** Plan:
`docs/plans/phase-200-audit-wave-1-canonical-state-and-economy.md`.
Regression: `tests/sim/phase200.wave1.canonicalStateAndEconomy.test.ts` (15
assertions) and `tests/sim/phase200.wave1.strategyMatrix.test.ts` (the
eight-strategy half of the gate, per-day invariants). Every finding was
reproduced first: coin reached −22 and −1 on the rent route, the three
named items quoted 0, and pressures disagreed on day 2 and after segment B.

**Decisions taken (user) — these were design questions, not defects:**

- **DC-07 — response-portfolio resource policy: gate at selection, re-check
  atomically.** A choice is disabled with a readable reason when its cost
  exceeds coin minus what today's other committed choices need; the
  portfolio is re-validated at resolution and anything that no longer fits
  is skipped WHOLE. `coin >= 0` stays a hard invariant — no modelled debt.
- **`P7-EXP-002` — price floor: minimum 1 coin per unit.** `priceBias`
  keeps its additive form and current tuning; the floor moved into
  `getEffectiveBasePrice` so quote, application, report and supplier screen
  cannot disagree. Chosen over percentage bias so Wave 1 does not move the
  economy under Wave 7's balance evaluation.
- **`P4-SEAM-003` — direct response pressure effects persist.** Recorded as
  an adjustment the calculator's value is combined with, decaying over
  `PRESSURE_ADJUSTMENT_DECAY_DAYS` (5). The alternative — the calculator
  supersedes it and the pressure rebounds next morning — would make a
  card's own preview untrue by the following day.

Work landed:

- `state.pressures[id].value` is now the single pressure authority, synced
  to the rich snapshot on every pass rather than only on a significant
  move. The day calculates twice: at `closing` (values + sync, so
  closing-time seed generation reads today's numbers) and at `endDay`,
  immediately after `applyResponses` — the second pass is the only emitter
  of pressure causes and history, which is `P7-EXP-004` and `P4-SEAM-001`
  fixed by construction.
- One rent transition (`payRentInFull`) shared by month-end settlement and
  the card, reached through a named `monthly.rent.payment` effect target;
  affordability is checked before any of a profile is applied; `spendCoin`
  now throws rather than driving the till negative.

**Consequence worth knowing before Wave 7:** the duplicate pressure cause
was feeding the attribution ledger, so blame strength was running at
roughly double. Removing it halves attribution weight and slows pressure
escalation — day-3 policy backlash in the Phase 53 fixture now reads 57
where it read 71. Two existing tests encoded the inflated numbers and were
updated to drive real state instead of stamping values the recalculation
now corrects (`phase38.expandedPressures`, `phase191.economyDebtCoherence`
— the latter's rent preview also moved from `Coin -120` to `Coin -370`,
which is what the fixture actually owes). **Any pressure or attribution
tuning judged against the pre-Wave-1 build is suspect.**

## Wave 2 — Make causality and closed reports authoritative ✅ gate passed

Gate: a closed report is field-stable immediately, next day, days later and
after reload; simultaneous causes for two staff / groups / rooms never cross
identity; Fix Root names one room from preview through report; blame/mock
cannot become positive coaching on magnitude alone.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P4-SEAM-002 | done | High/P1 | Yesterday's missed opportunities are rebuilt from today's state | P4 §5 |
| P6-COMP-006 | done | Med/P2 | Historical reports lose resolved choices | P6 §6 |
| P5-PLAY-003 | done | High/P1 | Issue evidence crosses actor/location boundaries (shared cause-query contract) | P5 §6 |
| P4-SEAM-004 | done | Med/P2 | Seasonal arc card absorbs staff-arc causes | P4 §5 |
| P5-PLAY-004 | done | High/P1 | Fix Root applies to the wrong room | P5 §6 |
| P7-EXP-003 | done | High/P1 | Missed-opportunity coaching recommends destructive choices | P7 §7 |

**Closed 2026-07-27.** Plan:
`docs/plans/phase-201-audit-wave-2-authoritative-causality.md`. Regression:
`tests/sim/phase201.wave2.causality.test.ts` and
`tests/web/phase201.wave2.closedReports.test.ts` (12 assertions). All six
reproduced first.

Work landed:

- **Closed reports project from the day they describe.** The store keeps
  `closedDayState` at `endDay` and both report screens read it; it is
  persisted as a `baselinePatch` against live state, reusing the Wave 0
  codec, so it costs a fraction of a second `TavernState`. This stabilises
  every field, not only the two the audit caught — `projectRisingPressures`
  and `projectFutureHooks` read live state by the same mistake.
- **`scopedCauseEntries` replaces the any-tag query** at entity-sensitive
  call sites. A cause qualifies only when it names one of the seed's own
  entities and names no foreign one; entity-less causes need an explicit
  `includeGlobal` plus a domain-tag match. Two further leaks turned up
  while fixing it: `pressureCauseRefsAsEntries` was flattening every
  breakdown line's actors to `[]` (making scoping impossible, and handing
  one staff member's blame line to another's card), and the Wave 1 pressure
  cause was borrowing the dominant line's *words* with the snapshot's
  *aggregate* actors. Both now carry the attribution they assert.
- **The complaint anchors on the room with the problem** (`pickComplaintArea`),
  not the day's rotation, and the `fix_root` slot offers that same room —
  so cause, preview, target, applied path and report name one place.
  Rotation survives as the tie-break when no room stands out.
- **Missed-opportunity ranking uses signed utility** (`profileUtility`),
  not `impactScore`'s absolute magnitude. A slot that would leave things
  worse is not offered at all; a slot with no signed effects still is
  (unknown, not harmful). `impactScore` keeps its meaning for prominence
  and pacing.

**`DC-03` (long-term player objective) is still open** and this ranking is
deliberately objective-agnostic — it answers only "better or worse", which
needs no objective. A strategy-aware ranking should wait for `DC-03`.

**Consequence worth knowing:** the `policy_backlash` family required
per-policy evidence that the sim never emitted — the old any-tag query
faked it, so the card named a policy on no evidence. The backlash
calculator now emits one breakdown line per policy (tagged with its id);
the pressure VALUE is unchanged (each group is still counted once). Two
tests that keyed on the old aggregate cause id were updated.

## Wave 3 — Complete the decision lifecycle ✅ gate passed

Gate: the seven Phase 6 comprehension questions are answerable from the
interface for one immediate response, one delayed response, one project, one
priority and one report-to-plan path — and the same explanation survives
reload and historical revisit.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P6-COMP-001 | done | High/P1 | Confirmations replace player choice language with internal verbs | P6 §6 |
| P6-COMP-002 | done | High/P1 | Delayed choices have no pending/applied/expired lifecycle | P6 §6 |
| P6-COMP-003 | done | Med/P2 | Cause drilldowns expose machine metadata | P6 §6 |
| P6-COMP-004 | done | Med/P2 | Staff priorities hide tradeoffs and results | P6 §6 |
| P5-PLAY-002 | done | Med/P2 | Satisfaction rows omit the customer group | P5 §6 |

**Closed 2026-07-27.** Plan:
`docs/plans/phase-202-audit-wave-3-decision-lifecycle.md`. Regression:
`tests/reports/phase202.wave3.comprehension.test.ts` (18 assertions).

**Decisions taken (user):**

- **`DC-02` / `P3-DC-001` — deliberate Ignore and no answer are DIFFERENT
  facts.** An explicit Ignore is recorded as a decision ("You let it
  stand"); an unanswered card leaves no resolved-intent record, so the
  day's ledger distinguishes a considered pass from a card never reached.
  No blocking Closing prompt — the audit asked for comprehension, not a new
  gate in the day loop. **`P3-DC-001` is answered; mark it resolved.**
- **`P6-COMP-003` — cause importance reads as a share of the change**, not
  a raw `weight 72` on a scale the player has no reference for.

Work landed:

- The visible choice label rides on the intent (`selectionLabel`), is
  stored on the `ResolvedIntentRecord` by the sim, and reaches the report
  and the pending chips — which also now say **"Selected — revisable until
  End Day"**, the missing answer to *which choices are final*. The engine
  verb stays out of default copy.
- `projectPendingConsequences` / `projectResolvedConsequences` give delayed
  effects a real lifecycle (**pending → due → applied | expired**), each row
  naming the choice that promised it and when it lands. The queue always
  held `origin`, `scheduledFor` and `expiresAt`; nothing projected them.
- Cause drilldowns translate known machine sources, resolve actor and
  location refs to display names, and show a share of the change. An
  unknown source falls back to a safe sentence rather than leaking a path.
- Every staff priority carries a `benefit` and a `tradeoff` line; the sheet
  renders both, the plan summary names who is on what focus, and the report
  carries a directional `staffFocus` line. Deliberately directional — the
  service model cannot attribute a fight to a priority, and the audit says
  inventing that precision would be worse than silence.
- `humanizePath` maps `customers.<id>.<field>`, so four groups' satisfaction
  changes stop rendering as four identical rows.

## Review of Waves 0–3 (2026-07-27)

A pass over the whole arc before pausing, beyond re-running the gates.
Two real defects in the arc's own work were found and fixed:

1. **Delayed consequences were not actually attributed** (`P6-COMP-002`).
   `PendingOrigin` carried no selection label, and the projection tried to
   recover one by matching the drained entry's id against the day's
   resolved intents — but a pending id is `pending-<day>-<n>` and embeds
   no intent, so every applied/expired row fell back to "An earlier
   decision". The Wave 3 test passed because it only asserted the label
   was not the engine verb. Fixed: the label is captured onto `origin` at
   enqueue time (so it survives to the day the effect fires, days after
   `resolvedToday` was cleared), the drain records each entry with its
   origin, and the tests now assert the actual label end-to-end through
   the real pipeline.
2. **The same state was stored twice mid-day.** Wave 0 added a
   start-of-day baseline patch and Wave 2 a closed-day patch, both encoded
   against `state` — but mid-day the baseline IS the previous day's
   closing state, so the two patches were identical. Measured at day 28
   mid-day, the save was **4.86 MB UTF-16** against a typical 5 MB origin
   budget. The baseline is now encoded against the closed-day state, which
   makes its patch empty in the common case: **4.43 MB**, with the
   reconstruction still exact (asserted).

**Standing quota warning — unchanged and now measured.** A day-28 mid-day
save is 2 267 KB of JSON (~4.43 MB UTF-16), of which `state` alone is
1 702 KB. The Wave 0 observation about unbounded `TavernState` growth is
the binding constraint on run length, and the arc's additions cost about
0.4 MB of the remaining headroom. Wave 0's save-error banner means this
fails visibly rather than silently, but a long run will still hit it.
Pruning the attribution / causes / history ledgers remains unscheduled.

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
| P3-DC-001 | done | P3 §5 | Explicit Ignore and no-response share wording — are deliberate refusal and inaction the same fact? **Answered in Wave 3: different facts.** |

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
