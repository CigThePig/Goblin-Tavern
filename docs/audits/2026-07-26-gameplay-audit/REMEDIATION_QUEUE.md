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

## Wave 4 — Restore action reachability and contextual transfer ✅ gate passed

Gate: R02/R06 pass through every normal entry; one contextual target stays
consistent from CTA through picker, quote, queue, Segment B, report and
reload; after-Service work is disallowed or explicitly labelled tomorrow;
expeditions complete naturally end to end.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P3-BHV-001 | done | Med/P2 | Inline policy toggles never queue (payload omits the target) | P3 §5 |
| P3-BHV-002 | done | Med/P2 | Expedition commissioning cannot open | P3 §5 |
| P5-PLAY-001 | done | Med/P2 | After-service planning says "today", queues tomorrow | P5 §6 |
| P6-COMP-005 | done | Med/P2 | Licence claims owner time but spends none | P6 §6 |
| P7-EXP-006 | done | Med/P2 | Planner handoff loses the problem target | P7 §7 |

**Closed 2026-07-27.** Plan:
`docs/plans/phase-203-audit-wave-4-action-reachability.md`. Regression:
`tests/sim/phase203.wave4.actionReachability.test.ts` (12 assertions) and
`tests/web/phase203.wave4.planningHorizon.test.ts` (17). All five were
reproduced against the pre-fix build first, with the audit's own strings:
the inline policy pick returned `no target`, a fully specified commission
returned `commission_expedition requires a runner targetId`, two stock
shortages collapsed into one targetless suggestion, `stock.ale.quantity`
mapped to no CTA at all, and no planning-horizon authority existed.

**Contract decisions taken (these were choices the audit left open):**

- **`P5-PLAY-001` — keep pre-planning, label it tomorrow.** The queue
  behaviour was already right (`beginDay` preserves picks on purpose);
  only the copy lied. Restricting the planner after Segment B would
  remove reach, which is the opposite of this wave's purpose.
  `gameStore.planningHorizon` reads `segment`, not `beat`, and the Top
  Bar chip, picker title, unspent line and a queue banner all read it.
- **`P6-COMP-005` — owner time becomes a real, named, enforced cost.**
  `phase-186-day-clock-time-economy.md` is locked (the budget is time),
  and four other profiles already claimed `global.owner_time` on effects
  the applier silently discarded. Removing the claim would have deleted
  the only lever card responses have on the day clock.

Work landed:

- Every finding is one payload losing a field between two surfaces, so
  each fix is the same shape. The inline policy pick carries `targetId` /
  `targetLabel` and scopes its queue checks to them; `enable_*`/`disable_*`
  `getValidTargets` now returns its own policy rather than all seven.
- `OwnerActionDefinition` gains `canOpen` ("may the player begin
  specifying this?", distinct from `canApply`) and `composer` (the form
  that owns an input a generic picker cannot assemble).
  `actionDisabledReasonForInput` validates a COMPLETE payload — target,
  amount and options — and `tryAddPick` uses it, so a global-typed
  action's own `targetId` and `options` stop being dropped at the queue.
- `global.owner_time` is a first-class effect target landing on
  `modules.ownerActions.timeSpent`, with `immediateOwnerTimeCost` /
  `ownerTimeCostOfSlot` beside the coin pair, a `gateChoicesByTime`
  selection gate, and a DC-07 atomic re-check that skips a
  no-longer-affordable intent WHOLE.
- `SuggestedAction` and `ActionPickerRequest` carry `targetId` /
  `preferredTargetId` / `reason`; suggestions de-duplicate by action AND
  target; `planActionCtaForPath` handles `stock.<id>.*`; the picker
  preselects a valid preferred target and otherwise sorts and marks it.

**Consequence worth knowing before Wave 7:** the four pre-existing
`global.owner_time` amounts (`-5`, `-6`) were on the retired
action-point scale and cost nothing at all, because the applier had no
branch for the target. Restated in minutes on the registry ladder
(`TIME_COST_QUICK` 30m, `TIME_COST_SHORT` 60m) they are **new spend in
the model** — five profiles now take real hours off the day.
**Owner-time tuning judged against the pre-Wave-4 build is suspect.**
Two derived rulers moved with it: owner time gets its own magnitude
ladder (`[30, 60, 120]` — minutes of a 360-minute day are not a 0–100
meter), and `audit-card-choices`' dominance heuristic normalises
owner-time minutes onto the 0–100 scale it sums everything else on,
which otherwise let a half-hour outweigh a 4-coin cost.

Gates re-run green: `npm test` (3 635), `npm run test:heavy` (129),
`npm run typecheck`, `npm run check` (0/0), `npm run build`.

## Wave 5 — Repair secondary surfaces and identity ✅ gate passed

Gate: R15 crosses every root/detail/support surface without error; entity
names and historical labels survive removal, close, next day and reload.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P2-RT-002 | done | Med/P2 | Duplicate glossary ID crashes rendering | P2 §9 |
| P2-RT-003 | done | Med/P2 | Duplicate tags crash a populated Tavern Log | P2 §9 |
| P3-BHV-003 | done | Low/P3 | Fired staff name lost in the report heading | P3 §5 |
| P4-SEAM-005 | done | Low/P3 | New local-arc projections disagree by one boundary | P4 §5 |
| P6-COMP-007 | done | Low/P3 | Internal vocabulary leaks onto default surfaces | P6 §6 |

**Closed 2026-07-27.** Plan:
`docs/plans/phase-204-audit-wave-5-secondary-surfaces-and-identity.md`.
Regression: `tests/sim/phase204.wave5.identityAndSurfaces.test.ts` (8
assertions) and `tests/web/phase204.wave5.vocabulary.test.ts` (10, which
also carries the R15 gate sweep). All five reproduced first: the glossary
held two `atmosphere` ids, seven of three days' history entries carried a
duplicate tag, the fired staffer's label was absent from the applied
record, and no shared arc predicate existed.

Where Wave 4's findings were a payload losing a field, Wave 5's are
**surfaces asserting things the data does not guarantee** — so each fix
makes the guarantee real at the source rather than defending at the leaf.

Work landed:

- **Unique keys, guaranteed rather than assumed.** The tavern-wide
  atmosphere term becomes `tavern_atmosphere` (the two concepts are
  genuinely different, and `TavernIdentityStrip` was already linking to
  the wrong definition before the duplicate crashed anything).
  `ctx.addHistory` deduplicates tags on write, `buildTavernLog`
  deduplicates on projection so pre-Wave-5 saves render, and both `each`
  blocks key on something unique by construction.
- **Removal actions keep the name they acted on.** `applyOwnerActionsHook`
  captures the target's label from the definition's own `getValidTargets`
  *before* `apply` runs and stores it on `OwnerActionApplied.targetLabel`
  — the same label the picker showed, captured while the entity still
  exists. Answers the finding's open question with **yes, and for every
  action**: one lookup closes the class rather than the instance.
- **One age, one presence for a local arc.** `isPresentedArcStage` /
  `listPresentedArcs` answer "is this arc in play" for both player
  surfaces; `listActiveArcs` keeps its narrower cap-counting meaning, so
  arc seeding behaviour is untouched. The monthly overview reads the
  `ageDays` the sim stores instead of re-deriving it from the calendar.
- **One vocabulary layer.** `idLabel` gains `seedFamily` and
  `mechanicalTag` categories; `humanizeActionReason` moved to
  `src/reports/labels/actionReason.ts` so the *projection* emits
  player-ready rejection text rather than each component remembering the
  call. Memory labels, atmosphere tags and project-starter target labels
  humanize; the staff-priority hint stopped describing the engine. A new
  **`showDiagnostics`** preference (default off) is where raw ids live now.

**Decision taken:** `P6-COMP-007` offered "hide seed-family tags by default
OR map them to deliberate player labels" — **mapped.** The card corner
shows what the card is about ("Your people", "The rooms"); `familyTag()`
still returns `seed.family`, so sim data and card-composition conditions
are untouched and only the render boundary changed.

**Two things found while fixing, not in the audit:** the project-starter
actions returned the area *id* as their target label (which Wave 4 had
just made the source of the immutable applied-action label, so it would
have propagated into the report), and `AvailableProjectRow.disabledReason`
was the one Tavern row that rendered an engine rejection string verbatim.
Both are fixed and covered by the vocabulary scan.

**Worth knowing:** the now-shared arc `ageDays` advances on the monthly
tick, not daily, so a seeded arc reads `0d` for the rest of its creating
month. That is the arc engine's own design ("existing arcs age by 28 days"
per tick) and it is now coarse *consistently*; the alternative on offer
was the projection's private daily count, which is what disagreed with
everything else. A finer age belongs in the engine, where both surfaces
would pick it up for free.

Gates re-run green: `npm test` (3 653), `npm run test:heavy` (129),
`npm run typecheck`, `npm run check` (0/0), `npm run build`.

## Wave 6 — Tune issue relevance and attention load ✅ gate passed

Gate: no off-menu unused item claims recent demand; long-run card and
rendered-choice ceilings meet an approved target; recurring issues keep state
and escalation instead of reappearing context-free; urgent Service incidents
stay reachable.

| ID | St | Sev/Pri | Finding | Evidence |
|---|---|---|---|---|
| P5-PLAY-005 | done | Med/P2 | Stock shortage invents demand for unused items | P5 §6 |
| P7-EXP-005 | done | Med/P2 | Full-day card load and repetition unbounded (157 cards / 891 buttons over 28 days) | P7 §7 |

**Closed 2026-07-28.** Plan:
`docs/plans/phase-205-audit-wave-6-issue-relevance-and-attention-load.md`.
Regression: `tests/sim/phase205.wave6.issueRelevance.test.ts` (8 tests) and
`tests/cards/phase205.wave6.attentionLoad.test.ts` (6, which counts what
the card layer actually renders). Both findings reproduced on the current
build first: the audit's own route (commons drained to just under the
low-stock threshold) put `bog truffle sales heavy this week` /
`Bog Truffle may run out` on a day-5 card for an item at quantity 0,
off-menu, never served — while ale, also at 0, was warned it "may run
out"; and the 28-day passive probe measured 4.93 cards / 27.64 rendered
choices per day, peaking at 7 / 35, with four families running 25–27
consecutive days.

**Decision taken (user) — `DC-06`, the approved reactive-workload target:**

| Dimension | Target |
|---|---|
| Cards per full day (Morning ∪ Service) | **5**, hard |
| Rendered choice buttons per full day | **24**, hard |
| Family recurrence | **2 consecutive days, then one rest day**, unless materially worse |
| Urgent Service incidents | admitted at a full ceiling by **displacing** the weakest non-urgent card, never dropped |
| Persistent threads | a **continuity line** (days standing + the prior decision) and a **trimmed choice set** |
| Periodic / teleology reserve | preserved — Morning holds back one card slot *and* one card's worth of buttons for Service, and the teleology/triage reserves survive |

**Gate evidence — the audit's own probe re-run**
(`fixtures/phase7-whole-experience-probes.ts pacingAndCoachingProbe`):

| Metric | Audit | Pre-Wave-6 | Now |
|---|---:|---:|---:|
| Cards / day (avg · max) | 5.61 · 7 | 4.93 · 7 | **3.46 · 5** |
| Rendered choices / day (avg · max) | 31.82 · — | 27.64 · 35 | **15.68 · 24** |
| Rendered choices, 28 days | 891 | 774 | **439** |
| Longest family streaks | 27 / 27 / 25 / 20 | 27 / 27 / 25 / 25 | **3 / 2 / 3 / 2** |

Weekly boundaries still land on days 7/14/21/28 and the monthly on 28;
`violence`, `debt_rent`, `opening` and `staff_arc` all still reach the
hand, so the ceiling did not buy its numbers by starving periodic or
teleology content.

Work landed:

- **The hand budget became a full-day ledger.** `applyHandBudget` bounded
  one ranked pass, which is why Morning + Service summed to seven cards:
  neither pass could see the other. `selectVisibleHand` now prices the
  day's exposure (`surfacedToday`) in cards AND in rendered buttons, so
  the two passes spend one budget. Reserves and budgets resolve in a
  single admission pass — selecting winners by rank first and testing
  affordability second let an unaffordable high-ranked card occupy the
  day's last slot and block a cheaper one behind it (a five-button brawl
  lost its slot to an eight-button complaint that then could not pay).
  The sim owns the per-card choice cap now (`RENDERED_CHOICE_CAP_PER_CARD`);
  `cards/cardHelpers.ts` re-exports it as `DEFAULT_LEGIBLE_CHOICE_CAP` so
  the budget cannot price a card differently from how it renders.
- **Family cooldown, keyed on family.** Two consecutive days, then a rest
  day, unless severity crossed a quarter band or rose ≥ 8.
- **Continuity threads.** `attention.threads[family:entity]` carries first
  and last appearance, times surfaced, peak severity, the slots already
  tried and the label of the last decision (folded in by a new `endDay`
  hook — `responses` depends on `issueSeeds`, so the reverse dependency is
  impossible, but `applyResponses` runs before `endDay`). A recurrence
  carries `seed.continuity`; the card's History section states how long it
  has stood and what the player chose (or that it went unanswered — the
  Wave 3 `DC-02` distinction is preserved), and a non-escalating repeat is
  trimmed to three options: the inaction slot plus the best-utility
  choices not already tried.
- **Shortage cards need real demand.** `generateStockShortage` scored by
  `30 - quantity`, so every never-stocked specialty ingredient (registry
  default `quantity: 0`) outscored a genuinely depleted staple. A
  candidate now needs a use signal — an unfilled order in today's service,
  a recipe served within 7 days, or a recipe on the menu — and the card's
  "recent context" is derived from whichever signal qualified it rather
  than asserted. `recentContext` is a `signal-backed` ingredient role, so
  the fabricated sales history was a contract violation as well as a lie.
  Zero stock now reads "has run out", not "may run out", and carries an
  `already_out` tone hint the title pool can use.
- **Time-relative title claims verify themselves.** `last week was already
  stretched` gained `minAgeDays: 7` (a memory that old guarantees a prior
  week exists) and a new optional `sharesSeedTag` scope on the existing
  `memoryPresent` primitive, so the memory must be about the item the card
  is about — a watered-ale memory can no longer title a truffle card.

**Two things worth knowing:**

- **Urgency is deliberately NOT a cooldown exemption.** The obvious rule —
  let urgent incidents through — hands the streak straight back:
  `customer_complaint` is a `during_service` family that sat at urgency 80
  for nineteen consecutive days while rotating its customer group (ogres →
  merchants → local goblins → miners → adventurers). Any per-entity or
  per-urgency escape reopens exactly the mechanism the finding names.
  Reachability is enforced where starvation actually happens — at the
  ceiling, by displacement — and escalation remains an exemption, so a
  worsening crisis is never paced away. One exemption is keyed on the
  thread: an issue the player ANSWERED last time it appeared comes back,
  because a venture being invested in on consecutive days is engagement,
  not noise. That cannot reopen the streaks (it needs a recorded decision
  on that same thread; the audit's route answered nothing).
- **Gate harnesses now read generation, not presentation.** A card-template
  gate asks what shape a family's generator produces; whether a given day
  had room to show it is a different question. `getGeneratedSeedsToday`
  answers the first (hand ∪ displaced ∪ withheld, backed by a day-scoped
  `withheldToday`), and `realSeedShapes.ts` plus the two card-choice
  scripts use it. Cost: 19 KB of a 1 591 KB day-28 state for the withheld
  seeds and 6 KB for the attention ledger, which prunes at 28 days.

**Observation raised, not fixed:** the stock-shortage card still offers
"Stretch what is left" (`water_down`, +20 quantity) on an item at zero,
which is the same surface-truth class as this finding. No finding covers
it and suppressing the slot is a mechanical change, so it is left for a
decision rather than taken silently.

Gates re-run green: `npm test` (3 667), `npm run test:heavy` (129),
`npm run typecheck`, `npm run check` (0/0), `npm run build`,
`npm run audit:card-choices` (113 rows).

## Wave 7 — Re-evaluate balance and whole experience ✅ gate passed

No findings; ran only after Waves 0–6. Rerun the eight shared-seed
strategies, add Easy/Hard, compare action vs no-action vs partial-response
variants, re-run a human public route past Day 29, and reassess every Phase 7
design question. Detail: Phase 8 §7 (Wave 7).

**Closed 2026-07-28.** The wave landed in two pushes: the measurement
framework (PR #242), then the balance pass itself — decisions, instrument
corrections from the Codex review of that PR, five evidence-backed tuning
changes, the full 360-cell sweep with a verdict, and the Day-29+ public
route. The sections below are in landing order.

### Framework and tooling — landed 2026-07-28 (PR #242)

Plan: `docs/plans/phase-206-audit-wave-7-balance-and-whole-experience.md`.

Wave 7's deliverable is numbers, so the instrument is the thing most likely
to be wrong. It is built and calibrated; the pass itself is blocked on the
decisions below.

- **`src/sim/testing/balanceHarness.ts`** — one scenario runner over the
  real segmented day (A → B → C), so cards are answered from post-Service
  state. `simulateDay` takes the whole day's input up front, which is why
  no run `balanceRuns.runStrategy` has ever produced answered a card.
  Two levers (`ownerActions`, `responses`), three difficulties, any seed.
  Emits every axis Phase 8 §7 names plus the `DC-06` load dimensions and
  per-day invariants. No `TavernState` retained; no `src/cards` import.
- **`src/sim/testing/balanceMatrix.ts`** — cross product, seed
  aggregation, and an **objective-agnostic** analysis (dominance, dead
  strategies, agency value, difficulty ordering). It flags a metric whose
  seed spread exceeds the between-strategy gap as **noisy and unrankable**
  — Phase 7 §5.2's second limitation, answered. Ties are never leads.
- **`scripts/balance-matrix.ts`** / `npm run balance:matrix` — the sweep is
  360 cells at ~6.7s each (~33 min serial), so the driver shards across
  worker processes: ~8 min at `-c 4`. `--render`, `--baseline`,
  `--estimate`, md/JSON.
- **`tests/sim/phase206.wave7.balanceHarness.test.ts`** (18 tests, fast
  tier) — the instrument's gate, including calibration against published
  evidence: the passive 28-day route reproduces the Wave 6 gate's 3.46
  cards/day, max 5, streak 3, and Phase 7 §5.1's 1,043 coin / 828 patrons
  **exactly**. If the harness drifts from the ceiling gate, the fast tier
  fails before anyone reads a balance table.
- **`tests/sim/phase200.wave1.strategyMatrix.test.ts`** now imports
  `coreStateInvariantFailures` instead of holding its own copy, so the
  Wave 1 gate and every Wave 7 cell test one §8.2 contract. Wave 7 cannot
  publish a "balanced" run Wave 1 would have called invalid — which is
  what Phase 7 §5.2's first limitation was.
- **`baselines/pre-wave7-standard.json`** — the recorded post-Wave-6
  starting point: 8 strategies × Standard × 5 variants × the audit's seed,
  28 days, `--render`. A calibration anchor, **not** the Wave 7 data set.

### Observations from the baseline — evidence, not findings

| # | Observation | Bearing |
|---|---|---|
| 1 | **The `DC-06` family-recurrence target holds only where nothing is answered.** Longest streak: 3 days passive and actions-only; **17–26 days (`staff_identity`) on every route that answers cards**; 7–17 on partial | `DC-06`, re-open |
| 2 | **Coin never becomes a constraint.** `minCoin` equals the starting balance on all 40 cells. The no-action route ends on 1,043 while clean-focused (1,014), ignore-repairs (774) and actions-only miner (725) end *below* it | `DC-04` |
| 3 | **Pressures are bimodal.** `rumour_pressure` pinned at 100 for 21 of 28 days, `staff_loyalty_risk` for 11, while 8 of 21 pressures end the month at 0. Every cell spends 21–25 days with something at the ceiling | `DC-03`, balance |
| 4 | **Fewer than eight arms.** `auto_no_owner_actions` pulls no lever, so it is a passive control in all five variants; on responses-only, `auto_clean_focused` and `auto_staff_friendly` are byte-identical (same slot preference). ~5 distinct response policies, not 8 | Sample size in Wave 7's evidence |
| 5 | **The `DC-06` choice ceiling holds.** With `--render`, `maxChoicesPerDay` is 24 on all 40 cells — met exactly, never exceeded | Wave 6 confirmed off-route |

On (1): the mechanism is the answered-thread exemption in
`issueThreads.shouldRestFamily`, a deliberate Wave 6 decision. Its own
comment argues it cannot reopen the streaks because "the 25–27-day streaks
were measured on a route that answered nothing at all" — which is exactly
the gap, since the exemption is only reachable by answering. **A decision,
not a defect. Do not change it silently:** it is a pacing lever and
re-tuning it moves every other number in the baseline.

### Decisions recorded — 2026-07-28

The user delegated these to the balance pass explicitly ("I'm relying on
your expertise to make the choices"). Each is anchored in a locked
contract, not invented; the anchor is cited.

| ID | Decision | Anchor and rationale |
|---|---|---|
| `DC-03` | **Identity through viability.** Indefinite play is organized by shaping a distinctive tavern — reputation axes, audience mix, relationships — on top of an operation that stays viable. Cash is a constraint and a means, never the score. No player-facing scoring surface | `phase-01` frames the core question as "workable routine vs failure loop"; `game-loop-and-ux.md §5.4` locks "no win condition — ship a legibility screen, not a scoring screen". Balance under this objective = every intended strategy viable, none dominant, none Pareto-dominated, identities distinct — implemented as `balanceScoring.ts` |
| `DC-04` | **Soft-fail spiral for 0.1.0; no terminal screen.** Missed rent → arrears → landlord pressure → eviction-threat seeds (all shipped) plus morale-driven staff departure risk and audience decline are the failure surface. Bankruptcy/eviction as *hard* stops stay future work. The measured coin abundance is **accepted for 0.1.0** and the named follow-up lever is satisfaction→traffic elasticity at the low end (a passive tavern at satisfaction 9 still draws ~80% of managed traffic — `forecast.ts`'s ±8 `satisfactionModifier` is the reason coin never binds). That is a demand-curve redesign that moves every published number, so it is recorded as follow-up, not smuggled into this wave | `game-loop-and-ux.md §5.4` names bankruptcy/eviction as existing concepts without a "you won/lost" screen; `difficulty.ts` explicitly defers rent/landlord tuning. Evidence: observation (2) above; sweep shows managed play buys large social outcomes for its coin (clean-focused: 1,374 patrons / satisfaction 35 vs the passive 828 / 9), so coin-below-passive is a trade, not dead agency |
| `DC-05` | **Audience leadership stays goblin in month 1 by design.** The starter tavern is a goblin house in a goblin neighbourhood; leadership change is a longer-horizon outcome. Strategy must (and does) express through ranks 2–4 and margins: merchants swing 0↔14 patronage and adventurers/ogres reorder by strategy in the sweep | `phase-21` expansion contract (identity is earned state); every audit and Wave 7 cell agrees `local_goblins` leads month 1, while sub-leader rankings differentiate |
| `DC-06` (re-opened half) | **The answered-thread exemption is capped.** Engagement buys a longer run, not an unbounded one: `ANSWERED_FAMILY_STREAK_LIMIT = 4` consecutive days for ordinary families, then the family rests; teleology families (`venture`, `opening`) stay uncapped because consecutive-day investment is their loop; material worsening still overrides everything | Observation (1): 17–26-day `staff_identity` streaks on every answering route vs the approved two-days-then-rest target. Post-fix: max 6, median 4 across all 240 answering cells |
| `DC-08` | **Teleology families (ventures, openings) are the core month-1 long-horizon strategies** — they already hold the reserved hand slot. Expeditions, projects, staff/local/seasonal arcs are mid-horizon texture in month 1, not required strategies; their near-zero first-month presence is per design, revisit when a second-month experience is authored | The `teleologyReserve` in `handBudget.ts` is the shipped statement of this priority; sweep confirms delayed obligations and arc families measurable but minor in month 1 |
| `DC-01` / `P2-OBS-001` | **Quick Day is retired as a player-facing route for 0.1.0.** The teleology reserve guarantees ≥1 opportunity card every day, so the zero-card morning Quick Day requires is a state the design intends never to exist — 5,000 seeds never reached it. The button (unreachable, renders never) stays in the tree until the paused UI arcs resume; remove it then rather than opening card-layer work mid-arc | P2 §9; teleology contract §3.5 |

Phase 7 §9.1–§9.6 map onto the rows above: §9.1→`DC-03`, §9.2→`DC-04`,
§9.3→`DC-05`, §9.4→`DC-06` (both halves now answered), §9.5→`DC-07`
(answered in Wave 1), §9.6→`DC-08`. `DC-09`/`DC-10` stay open — they gate
the paused onboarding/persistence arcs, not this wave.

### Instrument corrections — Codex review of PR #242, all ten fixed

The merged framework PR carried ten automated review findings; every one
was verified real and fixed **before** any number below was trusted, and
both baselines were regenerated with the corrected instrument:

1. Noisy metrics excluded from leadership/dominance (computed first, not
   after).
2. `allStrategiesTied` now requires equal medians everywhere — shared
   bests no longer suppress the dominated-strategy analysis.
3. "Dead" is a real Pareto-dominance test — a compromise strategy that
   leads nowhere but is dominated by no one is no longer reported dead.
4. `compareVariants` / `checkDifficultyMonotonicity` refuse untrustworthy
   cells.
5. Noise is judged on paired seed-for-seed differences (shared seeds), so
   a hard-for-everyone seed no longer reads as strategy uncertainty; a
   metric is unrankable when the best-vs-worst sign flips across seeds.
6. §8.2 invariants are checked after **every** segment (A, B, C), not just
   end-of-day — this immediately surfaced the Segment-A snapshot seam
   fixed below.
7. Baseline JSONs record `{days, render}` and the differ rejects a
   mixed-pricing or mixed-length comparison.
8. `--concurrency` must be a positive integer (a fractional value silently
   dropped a shard's cells).
9. Observations are labelled with the day they simulated, not the next
   (`advanceCalendar` had already run).
10. `responsesResolved` counts applied responses only — a
    `skipped_unaffordable` record no longer scores as a benefit.

### Tuning pass — five changes, each reproduced before fixing

All regression-covered in `tests/sim/phase206.wave7.balanceTuning.test.ts`
(9 tests, fast tier); before/after measured on the same corrected
instrument, same seeds (`baselines/wave7-standard-slice-before-after.md`
holds the full 40-cell diff).

| # | Change | Before → after |
|---|---|---|
| T1 | `shouldRestFamily` answered-thread exemption capped (`ANSWERED_FAMILY_STREAK_LIMIT = 4`, teleology exempt) — `issueThreads.ts`, `handBudget.ts` | Answering-route family streaks 17–26 days → **max 6, median 4** across all 240 answering cells; passive route untouched (streak 3) |
| T2 | Social rumours decay daily (`RUMOUR_DAILY_RETENTION = 0.85`, fade floor 5) on the Phase-27 `rumourUpdate` hook that had been a no-op; `rumour_pressure` slopes recalibrated for the post-decay regime (0.3→0.15, false bonus 0.2→0.1) and the top-3 per-rumour causes no longer double-count their strength (amount 0, weight kept) — `worldModule.ts`, `rumourPressure.ts` | `rumour_pressure` ended AND peaked at 100 on **all 360** pre-tuning cells (21–25 days at ceiling). Now: **0 cells end at 100**; weekly community passes still spike it (a scandal breaks) and decay pulls it back (passive route: 5 days at 100, final 44; managed: ≤1 day, final ~32) — the meter differentiates neglect from care |
| T3 | Attributions merge by **narrative** (perceiver, target, type, tags) instead of per-incident evidence ids, with two feedback guards: attribution rules no longer consume the attribution layer's own causes, and threshold causes fire on *crossing*, not every day a belief stays strong — `attributionModule.ts`, `attributionRules.ts` | One recurring belief stacked **612 live copies** against one server (public-blame sum 13,822), pinning `staff_loyalty_risk` at 100 on all 360 cells. Now: live set bounded by distinct narratives (52 at day 28 vs 858), peak < 100 on 348/360 cells and strategy-differentiated (staff-friendly ~46 peak vs profit ~75). **Also resolves the Wave 0 state-growth observation**: the attribution slice was the single largest state consumer at 985 KB of a 1,691 KB day-28 save; it is now **34 KB** and the day-28 save is ~935 KB — the localStorage-quota risk is substantially retired. Without the feedback guards the belief→cause→belief loop went geometric (day 8 of a managed run stopped completing); the guards are load-bearing |
| T4 | Pressure snapshots re-sync with canonical compact values at the end of Segment A (`forecastTraffic` hook), folding the delta in with an attributed morning-adjustment cause — `pressureModule.ts` | The per-segment §8.2 check (instrument fix 6) surfaced compact-vs-snapshot divergence at the Morning pause on every managed route (14–22 failures per 28-day run; arcs and suppliers write compact values in Segment A phases, and the recalculation passes run at `closing`/`endDay`). Pre-existing seam, invisible to end-of-day checks. Now: **0 invariant failures on all 360 cells** |
| T5 | A rotation turn only counts when the player saw the seed: violence picks are reconciled against the surfaced ledger (`reconcilePicksWithSurfaced`) — `seedRotation.ts`, `issueSeedModule.ts` | Wave 6's rest/withhold spent rotation turns on invisible days; the ledger rotated ogres→adventurers→miners correctly while every *visible* violence seed was ogres. The same at-generation `recordPick` pattern exists in other rotating families (food_safety, stock_shortage, maintenance, staff_identity, …) with family-private key formats — **recorded as follow-up**, violence fixed now because its rotation is a shipped finding gate (ISSUE-016) |

Calibration constants re-pinned with the movement documented
(`phase206.wave7.balanceHarness.test.ts`): passive-route cards/day
3.46 → 3.36, upper-bound choices 16.5 → 15.71/day. **The economy figures
did not move — 1,043 coin / 828 patrons still match Phase 7 §5.1 exactly,
which is the proof that no economic lever was touched in this wave.**

### Sweep verdict — 360 cells, corrected instrument, 2026-07-28

`npm run balance:matrix -- --difficulties=all --variants=all --render`,
three seeds, 28 days. Preconditions first: **every cell trustworthy** (0
invariant failures, 0 validation errors, now checked at every segment);
noisy-metric list empty everywhere except `pressureDaysAtCeiling` on one
standard slice — nothing was ranked on it.

- **No dominant strategy on any of the 15 difficulty × variant slices.**
- **Agency pays**: full play beats no-action on ~40/56 outcome axes per
  difficulty, and the exceptions are legible (the neglect foil loses coin
  and damage by design; care strategies trade coin for social outcomes).
- **Identity expresses**: standard/full produces four distinct reputation
  identities across the eight strategies
  (`filthy+goblinAuthentic`, `filthy+respectable`, `cheap+goblinAuthentic`,
  `cheap+respectable`); dominant-audience ranks 2–4 differentiate.
- **DC-06 holds off-route**: visible hand ≤ 5 cards everywhere; the
  exposure ledger reaches 6 cards / 31 rendered choices only on
  urgent-displacement days, which is the approved Wave 6 overage rule
  (every entry past the ceiling urgent by construction).
- **The Pareto-dominated set is exactly the three foils**
  (`auto_no_owner_actions`, `auto_random_owner`, `auto_ignore_repairs`) on
  every slice, with the two residual exceptions below.
- **The scoring layer's verdict on the standard slice: balanced** — every
  intended strategy viable under the DC-04 floors (rent paid, morale above
  the departure floor, no audience collapse), none dominant, identities
  distinct. `npm run balance:matrix` now prints this verdict first.

**Difficulty**: start-time-only by locked design (`difficulty.ts`), and
the sweep confirms the presets converge within the month (186/280
orderings monotonic; the inversions beyond seed noise are small and share
one legible mechanism — trouble is profitable to a bot that answers with
`risky_profitable`, so a dirtier start can out-earn a cleaner one).
Labels only promise a different *start*; no mislabel. Persistent
difficulty stays deferred as the file says.

### Residual gaps — recorded, not silently tuned

1. **`auto_miner_focused` is Pareto-dominated by `auto_clean_focused` on
   the easy × partial-responses slice** (and only there). Root cause is
   observation (4): the responses arm has ~5 distinct policies, and
   miner's edge (payday ale volume) does not materialize on Easy with
   stride-2 answering. Follow-up: diversify `chooseResponse` policies so
   the eight bots are eight arms, then re-run the slice.
2. **hard × actions-only converges on one reputation identity**
   (`filthy+goblinAuthentic`): on Hard, identity expression currently
   requires reactive play. Defensible (cards are the loop) but worth a
   look when response policies diversify.
3. **At-generation rotation picks** in the non-violence rotating families
   (T5 above).
4. **Satisfaction→traffic elasticity** (`DC-04` follow-up above) — the
   lever that would make coin bind on neglect routes.

### Human public route past Day 29 — §11.4(5)

Scripted browser pass over the production build (`vite preview` +
Chromium driving the real beat buttons like a skimming player): 31 days
closed on Standard, **zero console errors**, month rollover at Day 29
renders correctly (calendar rolls to month 2, supplier day, monthly
overview offered at day 28), pressure ribbon reads mid-band values that
move day to day (35 → 74 → 81 → 50 → burst 100 after the week-4 community
pass) instead of a pinned 100, no `undefined`/`NaN`/`[object Object]` in
any captured beat, and reload at depth offers Continue and resumes (a
separate uncapped pass reached Day 86 and reloaded cleanly). This is an
agent-driven pass of the human route; a hands-on session remains a good
idea, but the §11.4(5) substance — the corrected evidence is
understandable on the public route past Day 29 — is evidenced.

### Wave 7 gate

Phase 8 §11.4: (1) P0/P1 verified — Waves 0–4; (2) shared-root P2
retested — Waves 4–6; (3) matrix schema-valid — 360/360 trustworthy
cells; (4) objective / failure / response-budget decisions recorded —
the table above; (5) human play confirms the corrected evidence is
understandable — the route above. **Gate passed; ISSUE-166 closes.**

### Carried forward into Wave 7 by earlier waves

Things earlier waves changed or deliberately left standing that a balance
pass needs as context. **Any tuning judged against a build older than the
wave named here is suspect.**

| From | What moved | Why Wave 7 needs it |
|---|---|---|
| Wave 1 | The duplicate pressure cause was doubling attribution weight; removing it halves blame strength and slows pressure escalation (day-3 policy backlash in the Phase 53 fixture reads 57 where it read 71) | Every pressure and attribution number predates the fix |
| Wave 4 | Owner time became a real, enforced cost. Five consequence profiles now take real minutes off the 360-minute day; their previous `-5`/`-6` amounts were on the retired action-point scale and the applier had no branch for the target, so they cost **nothing at all** | New spend in the day-clock economy that no prior playtest included. Also moved: owner time's magnitude ladder (`[30, 60, 120]`) and `audit-card-choices`' dominance heuristic, which now normalises minutes onto the 0–100 scale it sums everything else on |
| Wave 4 | Ordinary supplier purchases gained a 1-coin floor (Wave 1) and the response portfolio is gated at selection + re-checked atomically (DC-07) | Coin pacing differs from the audit's runs |
| Wave 5 | Local-arc `ageDays` is now read from the sim by **both** player surfaces instead of the monthly overview re-deriving it | See the open item below — this one may need a change *during* Wave 7 |
| Wave 6 | The approved `DC-06` ceiling (5 cards / 24 rendered choices per full day) plus a two-day family cooldown cut the passive route from 4.93 cards and 27.6 buttons a day to 3.46 and 15.7, and cut 28-day buttons from 774 to 439 | **Fewer cards reach the player per day, so fewer problems get answered per day.** Every pressure-escalation and coin-pacing number now sits on a different reactive workload than any prior playtest. If Wave 7 finds the loop too slack or too punishing, the ceiling is a tuned constant (`handBudget.ts`), not a structural bound — but re-tune it against `DC-06`, not around it |
| Wave 6 | Non-escalating recurrences are trimmed to three options, and options the player already tried on that thread are dropped first | A strategy bot that always picks the same slot will find it withheld on a repeat; response-mix comparisons across a 28-day run are not comparing the same offer set day to day |

**Open item — local-arc age granularity (`P4-SEAM-005` follow-on, not a
finding).** Wave 5 made canonical state, the engine's Local Arcs report
section and the monthly overview agree on one age. That age advances on
the **monthly tick, not daily** (the arc engine's design: "existing arcs
age by 28 days" per tick), so a seeded arc reads `0d` for the rest of the
month it was created in and then jumps by 28.

That is now coarse *consistently*, which is what the finding asked for —
the alternative on offer was the monthly overview's private daily count,
and that private count is precisely what disagreed with everything else.
It is left as-is deliberately: no finding asks for a finer age, and
inventing one during a repair wave would have been scope the audit did not
authorise.

**If Wave 7 needs finer arc-age resolution** — e.g. to reason about arc
pacing across a 28-day run, or because an arc's `afterDays` progress gates
read wrong at a daily granularity — **change it in the arc engine, not in
a projection.** `listPresentedArcs` and the stored `ageDays` are now the
single source both surfaces read, so advancing the age daily in
`localArcsModule`'s tick makes every surface finer for free and cannot
reintroduce the disagreement. Changing it in `monthlyOverviewProjection`
instead would re-create `P4-SEAM-005` exactly.

Regression cover already in place for whichever way this goes:
`tests/sim/phase204.wave5.identityAndSurfaces.test.ts` compares the report
section and the monthly overview against *whatever* canonical state holds,
rather than against a literal. The one literal it does assert is that an
arc caught on its creation day is `0d` old, which stays true under any
granularity. So a granularity change lands without rewriting the test, and
the test still fails the moment the two surfaces diverge from the sim
again.

## Decide before implementing (P4)

| ID | St | Record | Decision needed |
|---|---|---|---|
| P2-OBS-001 | done | P2 §9 | Quick Day is never naturally eligible. **Answered in Wave 7 (`DC-01`): retired as a player-facing route for 0.1.0** — the teleology reserve makes a zero-card morning a state the design intends never to exist. Physical removal waits for the UI arcs to resume |
| P3-DC-001 | done | P3 §5 | Explicit Ignore and no-response share wording — are deliberate refusal and inaction the same fact? **Answered in Wave 3: different facts.** |

**Answered:** `DC-01` (Wave 7 — Quick Day retired), `DC-02` (Wave 3 —
deliberate Ignore and no answer are different facts), `DC-03` (Wave 7 —
identity through viability), `DC-04` (Wave 7 — soft-fail spiral for
0.1.0), `DC-05` (Wave 7 — goblin leadership in month 1 is design),
`DC-06` (Wave 6 workload target + Wave 7 recurrence cap), `DC-07` (Wave 1
— gate the response portfolio at selection, re-check atomically), `DC-08`
(Wave 7 — teleology is the core month-1 long-horizon strategy). Wave 2's
coaching ranking can now be keyed on the recorded `DC-03` objective when
that surface is next touched.

**Still open:** `DC-09` (onboarding vs complete surface) and `DC-10`
(supported environments / persistence promise) — they gate the paused
onboarding and persistence arcs, not the audit arc, and need settling
before those arcs resume.

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

The Phase 7 fixture's `strategyProbe` and `pacingAndCoachingProbe` are
**superseded for balance work** by `npm run balance:matrix` (Wave 7
framework, above), which drives the same segmented route with variants,
difficulties and multiple seeds and emits comparable rows. Keep the
fixture: it is the audit's own artefact and the thing the harness is
calibrated against.

## Baselines

- `baselines/pre-wave7-standard.json` — the post-Wave-6 / pre-tuning
  starting point (regenerated 2026-07-28 with the corrected instrument, on
  the pre-tuning simulation, so the before/after diff is measured by one
  instrument).
- `baselines/post-wave7-standard.json` — the same 40-cell slice on the
  tuned build; the shipped balance record.
- `baselines/wave7-standard-slice-before-after.md` — the rendered
  before/after diff plus the DC-03 verdict for that slice.

Regenerate/diff with:

```bash
npm run balance:matrix -- --variants=all --seeds=phase7-integrated-shared \
  --concurrency=4 --render --format=json --compact \
  --out=docs/audits/2026-07-26-gameplay-audit/baselines/post-wave7-standard.json

npm run balance:matrix -- --variants=all --seeds=phase7-integrated-shared \
  --concurrency=4 --render --format=md \
  --baseline=docs/audits/2026-07-26-gameplay-audit/baselines/pre-wave7-standard.json
```

## Audit-time baseline

At audit completion `npm run check`, `npm run typecheck` and `npm run build`
passed, as did 11 targeted test files (103 tests). No finding below was
caught by the existing suite — every wave needs new regression coverage, per
Phase 8 §8.
