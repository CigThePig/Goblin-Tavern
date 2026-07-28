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

## Wave 7 — Re-evaluate balance and whole experience

No findings; runs only after Waves 0–6. Rerun the eight shared-seed
strategies, add Easy/Hard, compare action vs no-action vs partial-response
variants, re-run a human public route past Day 29, and reassess every Phase 7
design question. The current strategy matrix proves differentiation, not
balance. Detail: Phase 8 §7 (Wave 7).

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
| P2-OBS-001 | open | P2 §9 | Quick Day is never naturally eligible — keep it as a route (and build a supported zero-card fixture) or retire it |
| P3-DC-001 | done | P3 §5 | Explicit Ignore and no-response share wording — are deliberate refusal and inaction the same fact? **Answered in Wave 3: different facts.** |

**Answered so far:** `DC-02` (Wave 3 — deliberate Ignore and no answer are
different facts), `DC-07` (Wave 1 — gate the response portfolio at
selection, re-check atomically), `DC-06` (Wave 6 — the reactive-workload
target, tabulated in that wave). `DC-03` (long-term objective) is still
open and Wave 2's coaching ranking is deliberately objective-agnostic
until it is answered.

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
