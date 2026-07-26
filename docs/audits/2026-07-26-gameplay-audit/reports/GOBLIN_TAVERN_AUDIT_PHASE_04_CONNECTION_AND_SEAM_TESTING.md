# Goblin Tavern Gameplay Audit

## Phase 4 — Connection and Seam Testing

**Audit date:** 2026-07-26  
**Supplied snapshot:** `Goblin-Tavern-main (8).zip`  
**Public build:** <https://cigthepig.github.io/Goblin-Tavern/>  
**Framework:** `GAMEPLAY_AUDIT_FRAMEWORK.md`, Phase D  
**Primary browser seed:** `phase4-seams-fixed`  
**Periodic trace seed:** `phase4-periodic-fixed`

---

## 1. Completion status

Phase 4 execution is complete for the supplied snapshot.

The M01–M30 seam set produced:

| Status | Count | Meaning |
|---|---:|---|
| **Pass** | 17 | Static ownership and runtime before/after evidence agree |
| **Candidate** | 9 | The transfer was reached, but a confirmed defect or carried entry-path defect affects it |
| **Blocked** | 4 | A previously confirmed prerequisite defect prevents the required transfer |
| **Clarification** | 0 | No new seam needed design clarification to classify |

Five new defects were confirmed:

| Finding | Severity | Priority | Primary player-facing impact |
|---|---|---|---|
| `P4-SEAM-001` — Significant pressure changes are logged twice | **Medium** | **P2** | Cause drilldowns repeat the same explanation and overweight that cause downstream |
| `P4-SEAM-002` — Yesterday’s missed opportunities are rebuilt from today’s state | **High** | **P1** | A closed report changes after the next Morning and describes cards that did not exist during the reported day |
| `P4-SEAM-003` — Deferred pressure effects split compact state from the rich snapshot | **High** | **P1** | Reports and pressure consumers can hold conflicting values for the same pressure |
| `P4-SEAM-004` — Seasonal-arc anticipation cards absorb unrelated staff-arc causes | **Medium** | **P2** | A Mushroom Blight card explains itself with Mira’s mastery milestones |
| `P4-SEAM-005` — Newly seeded local arcs disagree across projections | **Low** | **P3** | A new arc is shown one day too old while the same boundary’s Local Arcs report says no active arc exists |

No new Critical/P0 defect was found. The carried save-serialization failure, `P2-RT-001`, remains the controlling Critical/P0 blocker.

The strict Phase D exit condition—static ownership plus runtime before/after evidence for every important transfer—remains unmet only for the four blocked rows: M02, M10, M23, and M24. Those gaps are caused by already-confirmed product defects, not an unattempted audit route.

---

## 2. Scope and evidence protocol

### Runtime routes

The public deployment remained fingerprint-compatible with the supplied production build established in Phase 2. A temporary hosted copy was therefore unnecessary.

Phase 4 used three evidence streams:

1. **Normal browser play**
   - Standard difficulty;
   - root seed `phase4-seams-fixed`;
   - six consecutive Morning states and five completed days;
   - all player decisions made through the deployed UI;
   - exact card, action, target, metric, and route identities recorded.
2. **Segmented engine traces**
   - the same Day 1–Day 6 lifecycle replayed through canonical Segment A/B/C calls;
   - exact seed IDs, response intents, pending-entry IDs, cause IDs, state values, and validation results recorded;
   - trace fixture: `audit_workspace/fixtures/phase4-seam-trace.ts`.
3. **Natural long-run engine trace**
   - 57 uninterrupted days with no state injection;
   - week 1, month 1, and month 2 boundaries recorded before and after;
   - exact-once follow-up days recorded;
   - local arc naturally seeded, progressed, applied, reported, and consumed by the next Morning’s issue generation;
   - trace fixture: `audit_workspace/fixtures/phase4-periodic-trace.ts`.

Existing Phase 2 and Phase 3 runtime evidence was reused where it already exercised the exact same build and seam, notably staff-priority transfer, the staff-arc response, error recovery, persistence failure, and expedition entry failure.

No source file, runtime state, registry, save payload, or deployed asset was modified. Source was inspected after runtime observations to identify ownership and root cause.

### Targeted regression evidence

Eleven relevant Vitest files completed successfully:

```text
Test files: 11 passed
Tests:      181 passed
```

Coverage included pressures, response application, weekly/monthly persistence, local arcs, cause lookup, daily reports, missed opportunities, and weekly/monthly overview projections. These passing tests establish local contracts; they do not contradict the end-to-end defects below because the failing combinations cross ownership boundaries not asserted by those fixtures.

---

## 3. M01–M30 seam evidence matrix

`Candidate` in this table means the seam was reached and its underlying defect is confirmed, not merely suspected.

| ID | Status | Static ownership | Runtime before → after evidence | Finding or blocker |
|---|---|---|---|---|
| **M01** | **Pass** | `web/src/main.ts` → `App.svelte` | Public URL mounted the Start surface and opened a fresh run | — |
| **M02** | **Blocked** | App, preference store, `persistence.ts`, game store hydration | Preferences and fresh-start selection worked; no valid session could be hydrated after gameplay | `P2-RT-001` |
| **M03** | **Pass** | Start screen → `gameStore.reset()` / `beginDay()` → Segment A | Standard + `phase4-seams-fixed` produced Day 1 Morning, coin 100, forecast about 89, pressures, and cards | — |
| **M04** | **Pass** | Day screen callbacks → game store → `advanceDaySegment()` | Morning → Plan → Service → Closing → Report advanced exactly one segment/beat at each control | — |
| **M05** | **Candidate** | Action picker/queue → `SimInput.ownerActions` → owner-actions registry | `fumigate_cellar/cellar` and `restock_item/ale` queued and applied with matching time, coin, stock, area, and report effects | Carried `P3-BHV-001`: inline policy controls still cannot enter the queue |
| **M06** | **Pass** | Sticky web priorities → staff/service input | Phase 3 priority selections reached service and remained selected on following uninterrupted days | Reload arm remains blocked by M23 |
| **M07** | **Pass** | Customer forecasts → Plan → service | Day 1 forecast about 89 → 89 patrons; later forecasts and traffic remained semantically aligned | — |
| **M08** | **Pass** | Recipes, stock, areas, staff, customers → service module | Service consumed named stock, used capacity/conditions, changed satisfaction/coin, and emitted incidents | — |
| **M09** | **Pass** | Supplier projection/action definition → stock → service | Day 4 Ale target showed Old Keg Brewers, reliability 70, +40 stock, −80 coin; action changed Ale 1→41 before service consumed it | — |
| **M10** | **Blocked** | Commission action → expedition module → stock return | Available runners existed, but both normal entry points rejected commissioning before the form/action could complete | `P3-BHV-002` |
| **M11** | **Candidate** | `SimContext` mutation APIs → causes/history | Named action and response mutations emitted causes/history, but every significant pressure shift emitted two canonical cause rows | `P4-SEAM-001`; carried `P3-BHV-003` for removed staff labels |
| **M12** | **Candidate** | Causes/history/memory → attribution, pressure, feedback modules | Causes drove drilldowns, pressure snapshots, attributions, and feedback; duplicate causes and split pressure truth corrupt some consumers | `P4-SEAM-001`, `P4-SEAM-003` |
| **M13** | **Candidate** | State/pressures/teleology → registered issue generators | Operational, staff, policy, seasonal, venture, and transformation-gated seeds appeared with stable IDs; one seasonal seed attached the wrong cause domain | `P4-SEAM-004` |
| **M14** | **Pass** | Issue ranking/fairness/hand budget | Crowded Day 4/Day 6 hands remained bounded and included licensed-service/seasonal content without making surfaced seeds unresolvable | — |
| **M15** | **Candidate** | Seed → card registry/composer → renderer | Titles, stakes, choices, and previews matched seed contracts except the Mushroom Blight “Because” block | `P4-SEAM-004`; duplicate prose also exposed `P4-SEAM-001` |
| **M16** | **Pass** | Card choice → pending map → intent builder | Exact seed/slot selections survived route changes and revisions; pending debug identity matched the final intent | — |
| **M17** | **Pass** | Response intent → responses module → state | Opening, venture, area-project, and other responses resolved once with matching immediate effects and response records | — |
| **M18** | **Candidate** | Pending response queue → start-day hook | `pending-1-0` and `pending-1-1` fired on scheduled day 4 exactly once, but the pressure effect left two canonical values | `P4-SEAM-003` |
| **M19** | **Candidate** | Full-day result/baseline → diffs → daily report | Immediate action, response, stock, area, pressure, and service changes reached reports; reopened missed opportunities changed after next Morning | `P4-SEAM-001`, `P4-SEAM-002`; carried `P3-DC-001` wording question |
| **M20** | **Pass** | Weekly/monthly hooks/history → periodic projections | Week 1 and two month closes settled once, appended bounded histories, emitted boundary reports, and remained available next day without re-emitting | — |
| **M21** | **Pass** | Typed report/metric/entity links → routes/sheets | Report pressure lines opened exact cause drilldowns; stock/entity links landed on intended Tavern/World detail | — |
| **M22** | **Pass** | Pressure detail → planner request → action picker | Stock Shortage 44 opened the planner with Restock Item suggested; Ale target queued and changed the next service inputs | — |
| **M23** | **Blocked** | Store change → autosave serialization → later hydrate | Autosave throws before a resumable session is written; no A/B/C or route checkpoint can survive reload | `P2-RT-001` |
| **M24** | **Blocked** | Snapshot/import/export → validation/migration → hydrate | Snapshot creation fails through the same serializer; no known-good replacement payload can complete the supported round trip | `P2-RT-001` |
| **M25** | **Candidate** | Month boundary → local-arcs hook → effects/tags → issue generation | Miner Payday Boom seeded on day 27, reached `rising` on day 55, applied four effects, and generated `seed-seasonal_arc-arc:miner_payday_boom:day27-d56`; its initial projection disagreed on presence/age | `P4-SEAM-005`; persistence continuity blocked by M23 |
| **M26** | **Pass** | Tavern identity/opening → response → venture | `opening_opening_venture_liquor_license_0` + slot `pursue` created `venture_liquor_license` | — |
| **M27** | **Pass** | Venture progress → transformation → gated issue family | Two `invest_owner_time` responses completed the venture, activated `licensed_liquor_service`, and surfaced `seed-licensed_service-promote_licensed_spirits-d3` next Morning | — |
| **M28** | **Pass** | Staff state → staff arc → seed/card/response | Phase 2 selected `mark_milestone`; Phase 4 traced `arc_staff_mastery` from apprentice through steady to completed/mastered with stable staff identity | — |
| **M29** | **Candidate** | Canonical state → tavern/world/report projections | Most values and IDs agreed across screens, but daily missed opportunities, pressure state/snapshot, and new-arc age/presence diverged | `P4-SEAM-002`, `P4-SEAM-003`, `P4-SEAM-005` |
| **M30** | **Pass** | `safeProject` slots and App error boundary | Local overlay failure left the screen usable; populated Log failure reached the global boundary and Go to Day preserved the active run | Reload recovery remains blocked by `P2-RT-001`; glossary/Log defects remain `P2-RT-002/003` |

---

## 4. Core end-to-end chain evidence

### 4.1 Forecast → plan → service → change → cause → pressure → report

| Point | Evidence |
|---|---|
| Day 1 forecast | About 89 patrons |
| Planned action | `fumigate_cellar` targeting `cellar`; 4h; coin −5; risk 40→20 preview |
| Service | 89 patrons; +509 service coin; 2 incidents |
| Full-day economy | Coin 100→604 (+504), including the action cost |
| Physical change | Cellar risk 40→21 |
| Pressure changes | Pests 35→0; Food Safety 35→4; Maintenance 35→12 |
| Report | Named Fumigated Cellar and every above change |
| Cause drilldown | Pests listed “Cellar was fumigated recently.” twice |

The chain transfers the correct action and mechanical state. Its explanation seam fails exact-once causality under `P4-SEAM-001`.

### 4.2 Issue → card → choice → response → deferred effect → later report

On Day 2, `seed-area_atmosphere-main_room-d1` rendered a Main Room card. The UI selected `start_project`, producing intent `phase4-intent-area-project`.

Segment C created:

| Pending ID | Due | Payload |
|---|---:|---|
| `pending-1-0` | absolute day 4 | `areas.main_room.condition +20` — “Project completes” |
| `pending-1-1` | absolute day 4 | `pressure:maintenance −10` — “Maintenance pressure eases” |
| `pending-1-2` | absolute day 8 | Future-hook memory `area_project_completion_main_room` |

At Day 5 Segment A:

- Main Room condition changed 70→90;
- compact Maintenance changed 12→2;
- `pending-1-0` and `pending-1-1` entered `appliedFromPendingToday`;
- causes `c-4-11` and `c-4-12` retained the original response identity.

The Day 5 report showed Main Room condition 70→90 and Maintenance 12→2. The delayed queue therefore fires once and remains explainable, but the pressure snapshot inconsistency in `P4-SEAM-003` means not every later consumer receives the same result.

### 4.3 Report → pressure detail → planner → target → next service/report

The Day 3 report showed Stock Shortage at 44. Its pressure detail repeated the Ale shortage cause but also exposed `Plan an action against this`.

That route opened Plan with:

- suggested action `restock_item`;
- target Ale;
- current quantity 1;
- supplier Old Keg Brewers;
- supplier reliability 70;
- preview +40 Ale and −80 coin.

The queued action applied before Day 4 service:

- Ale 1→41;
- coin paid −80;
- Day 4 service consumed the new stock;
- the report recorded the restock and the day’s service;
- Stock Shortage still rose 44→50 because demand exceeded the replenishment.

This is a successful advisory chain: the suggested action was relevant and legal without guaranteeing that one purchase would eliminate the underlying pressure.

### 4.4 Opening → venture → transformation → gated content

| Day | Transfer | Result |
|---:|---|---|
| 1 | `opening_opening_venture_liquor_license_0` → `pursue` | `venture_liquor_license` created |
| 2 | `venture_venture_liquor_license_paperwork` → `invest_owner_time` | Progress 0→1 |
| 3 | Same venture seed/slot | Venture completed with stage `licensed` |
| 3 | Completion | Transformation `licensed_liquor_service` activated |
| 4 Morning | Transformation gate | `seed-licensed_service-promote_licensed_spirits-d3` surfaced |

The Day 4 card’s “Because” line named the active Licensed liquor service transformation. M26–M27 pass through the normal UI without state injection.

### 4.5 Weekly/monthly cadence and local arcs

#### Week 1 close

- calendar: Day 7 / elapsed 6 → Day 8 / elapsed 7;
- coin: 1296→1263;
- wages: 33 due, 33 paid;
- weekly history: 0→1;
- report: `WEEKLY REPORT — Week 1, Month 1`;
- next day: history remained 1, overview said closed 1 day ago, and no weekly report re-emitted.

#### Month 1 close

- calendar: Month 1 Day 28 / elapsed 27 → Month 2 Day 1 / elapsed 28;
- coin: 1197→1044 from 33 wages plus 120 rent;
- weekly history: 3→4;
- monthly history: 0→1;
- monthly accumulator contained exactly `Y1-M1-W1` through `Y1-M1-W4`;
- weekly, monthly, and local-arcs report sections emitted once;
- Miner Payday Boom naturally seeded as `arc:miner_payday_boom:day27`.

#### Month 2 close and next Morning

- monthly history: 1→2;
- Miner Payday Boom advanced `seeded`→`rising`, age 0→28, intensity 20→35;
- four exact effects were recorded: Violence +6, Miners `boom`, calendar tag `miner_boom`, issue tag `rowdy_crowd`;
- Festival Approaching naturally seeded as `arc:festival_approaching:day55`;
- the Local Arcs report named Miner Payday Boom and its four effects;
- next Morning generated `seed-seasonal_arc-arc:miner_payday_boom:day27-d56` with the exact local-event primary actor;
- the following full day did not repeat settlement or append another history record.

All four boundary results validated with zero errors and zero warnings.

---

## 5. New Phase 4 findings

## P4-SEAM-001 — Significant pressure changes are logged twice

**Status:** Confirmed runtime defect  
**Category:** Causality duplication  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Affected seams:** M11, M12, M15, M19

### Reproduction

1. Start Standard with `phase4-seams-fixed`.
2. Queue Fumigate Cellar on Day 1.
3. Run service and close the day.
4. Open the Pests report line.

### Expected

The significant Pests change should create one canonical cause and one drilldown line.

### Actual

Two cause IDs, `c-0-121` and `c-0-122`, carry the same source, pressure target, −35 amount, weight 35, timestamp, and readable text:

```text
Cellar was fumigated recently.
```

The report drilldown renders both lines. A later Stock Shortage drilldown repeats the Ale-shortage cause in the same way, showing that this is systemic rather than action-specific.

### Confirmed source cause

`src/sim/modules/pressures/pressureModule.ts:241–247` calls:

1. `ctx.modifyPressure(definition.id, snapshot.delta, causeDraft)`;
2. `ctx.addCause(causeDraft)`.

Its comment says `modifyPressure` does not log the cause. The current engine contradicts that assumption: `src/sim/core/engine.ts:986–1017` calls `addCauseInternal` whenever a pressure mutation with cause metadata changes the value.

### Impact

- cause drilldowns repeat text;
- attribution weight can be doubled;
- seeds can inherit duplicate evidence;
- reports appear noisier and less trustworthy.

### Correction and verification

Choose one canonical logging owner. Removing the explicit pressure-module `addCause` is the narrowest correction if the engine contract is retained. Add an end-to-end assertion that one significant pressure shift produces one canonical cause ID, one drilldown line, and one downstream evidence contribution.

---

## P4-SEAM-002 — Yesterday’s missed opportunities are rebuilt from today’s state

**Status:** Confirmed runtime defect  
**Category:** Retrospective truth / temporal context mismatch  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Affected seams:** M19, M29

### Reproduction

1. Complete Day 3 and inspect its immediate report.
2. Record the three missed opportunities.
3. Select Next day so Day 4 Segment A generates a new hand.
4. Open Yesterday’s Day 3 report.

### Expected

The closed Day 3 report should remain immutable.

### Actual

The immediate Day 3 report included opportunities such as:

- responding to rival expansion;
- Restocking Ale for the day’s Stock Shortage;
- Buying mugs.

After Day 4 Morning began, the reopened Day 3 report instead described Day 4’s current cards:

- Restock stew;
- Blame Nash;
- Promote the licensed spirits offering.

Those cards did not exist during Day 3.

### Confirmed source cause

Both normal report entry points call `buildDailyReport(result, gameStore.state)`:

- `web/src/lib/screens/DayScreen.svelte:221–229`;
- `web/src/lib/screens/ReportsScreen.svelte:54–62`.

`src/reports/missedOpportunityProjection.ts:78–93` mixes the closed `SimResult` with live state. Its accessors at `:500–519` read current:

- `modules.responses.resolvedToday`;
- `modules.issueSeeds.seedsToday`;
- `modules.pressures.snapshots`.

Segment A has already replaced those collections with the next day’s values.

### Impact

The primary retrospective surface becomes factually false after ordinary next-day navigation. This can also route the player toward an action justified by the wrong day.

### Correction and verification

Build missed opportunities from a closed-day evidence snapshot stored with `latestResult`, or persist the projected missed-opportunity rows at close. Test immediate Report, Yesterday digest/report, Reports → Daily, reload, and snapshot/import against the same immutable closed-day IDs and text.

---

## P4-SEAM-003 — Deferred pressure effects split compact state from the rich snapshot

**Status:** Confirmed runtime defect  
**Category:** Canonical-state divergence  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Affected seams:** M12, M18, M29

### Reproduction

1. On Day 2 choose Main Room → Start a real project.
2. Continue naturally to Day 5.
3. Record Maintenance after Segment A and after the completed day.

### Expected

All canonical and projected representations should agree on the applied −10 Maintenance effect.

### Actual

After the due entry fired:

```text
state.pressures.maintenance.value                     = 2
state.modules.pressures.snapshots.maintenance.value   = 12
snapshot.previousValue                                = 12
snapshot.delta                                        = 0
```

The Day 5 report says Maintenance 12→2 and its drilldown correctly shows “Maintenance pressure eases” −10. Issue generators and other consumers that call `pressureSnapshotById`, however, still read 12.

### Confirmed source cause

The response start-day hook drains due entries in `src/sim/modules/responses/responsesModule.ts:88–117`. Pressure effects call `ctx.modifyPressure` in `src/sim/modules/responses/ctxApplier.ts:87–105`, updating compact state.

Later, `src/sim/modules/pressures/pressureModule.ts:201–219` chooses the previous rich snapshot before compact state:

```text
slice.snapshots[id]?.value ?? onState?.value
```

The calculator returns 12 against previous snapshot 12, so delta is 0. Because compact state is only mutated when the calculated delta is significant, it remains 2, while the rich snapshot is independently written as 12 at `:263–274`.

### Impact

- report and ribbon values can disagree with issue/card inputs;
- a delayed response can appear applied while warnings still reason from the pre-effect value;
- later projections have no single authoritative pressure truth.

### Correction and verification

Define one canonical pressure value. If direct response deltas are meant to persist, represent them as calculator input and synchronize both stores. If recalculation is meant to supersede them, synchronize compact state to the recalculated snapshot and explain the rebound. Test immediate, delayed, monthly-arc, and ambient pressure mutations across Segment A/B/C with `compact.value === snapshot.value` at every stable beat.

---

## P4-SEAM-004 — Seasonal-arc anticipation cards absorb unrelated staff-arc causes

**Status:** Confirmed runtime defect  
**Category:** Cross-domain attribution  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Affected seams:** M13, M15

### Reproduction

1. Continue `phase4-seams-fixed` to Day 6.
2. Inspect the Morning card `Mushroom blight: the blight bites at supply`.
3. Expand its “Because” block.

### Expected

The anticipated blight should cite calendar, market, road, supplier, or mushroom evidence.

### Actual

The card cites:

```text
Mira the Resolute's path to mastery advanced on its own to mastered.
Mira the Resolute's path to mastery advanced on its own to steady.
```

The underlying seed is `seed-seasonal_arc-mushroom_blight-d5`. All four attached causes are staff-mastery causes:

```text
c-5-11
c-5-12
c-1-11
c-1-10
```

None concerns mushrooms, roads, suppliers, market conditions, or a local event.

### Confirmed source cause

`generateSeasonalArc()` calls `recentCauseEntries()` with:

```text
['arc', 'local_arc', arcKey, theme, 'festival']
```

at `src/sim/modules/issues/expandedSeedGenerators.ts:4785–4795`.

`recentCauseEntries()` at `src/sim/modules/issues/generatorHelpers.ts:426–442` accepts a cause when **any** supplied tag matches. The generic `arc` tag therefore selects teleological staff-arc causes before the anticipation path reaches its correct synthetic calendar cause.

### Impact

The card’s stakes and actions concern mushroom supply, but its explanation concerns an unrelated employee lifecycle. This directly breaks the player’s ability to understand why the situation appeared.

### Correction and verification

Require a matching local-event ID, theme tag, or related local-event actor for live arcs. For anticipation, prefer the synthetic calendar/market cause unless a theme-specific cause exists. Add a semantic test that no `seasonal_arc` seed can carry only `staff_arc`/teleology causes and deduplicate identical readable lines from multi-field lifecycle mutations.

---

## P4-SEAM-005 — Newly seeded local arcs disagree across projections

**Status:** Confirmed runtime/projection defect  
**Category:** Boundary projection inconsistency  
**Severity:** Low  
**Priority:** P3  
**Confidence:** High  
**Affected seams:** M25, M29

### Reproduction

Run naturally through the first month close with `phase4-periodic-fixed`.

### Expected

A newly created arc should have one presence/stage/age interpretation across canonical state and report projections.

### Actual

At Month 1 close:

| Surface | Miner Payday Boom |
|---|---|
| Canonical event | `seeded`, `ageDays: 0` |
| Monthly overview projection | `seeded`, `ageDays: 1` |
| Local Arcs engine report | `Active Local Arcs: (none)` |

At Month 2 close, the same pattern persisted:

- canonical Miner Payday Boom age 28; Monthly overview age 29;
- canonical newly seeded Festival Approaching age 0; Monthly overview age 1.

`MonthlyOverview.svelte:393–408` renders the projected age directly.

### Confirmed source cause

`createArcInstance()` stores `startedDay: today` and `ageDays: 0` at `src/sim/modules/localArcs/arcEngine.ts:330–358`.

After closing, the calendar has advanced. `src/reports/monthlyOverviewProjection.ts:425–432` ignores the stored age and computes:

```text
state.calendar.totalDaysElapsed - event.startedDay
```

The Local Arcs report takes a different definition of “active”: `src/sim/modules/localArcs/report.ts:24–50` calls `listActiveArcs()`, which excludes the `seeded` stage.

### Impact

The first player-visible monthly overview makes a just-created arc one day old. The parallel report section omits it, creating a minor but concrete disagreement at the exact narrative boundary where the arc begins.

### Correction and verification

Adopt a shared non-terminal/presented-arc predicate and a single age definition. At close, a newly seeded arc should project age 0 everywhere. Verify the same event on the close report, next Morning, monthly overview, and later month boundaries.

---

## 6. Carried blockers and constraints

| Existing finding | Phase 4 effect |
|---|---|
| `P2-RT-001` — save serialization throws on the Svelte pending-choice proxy | Blocks saved-session M02 and all M23–M24 before/after tests; also makes the App boundary’s Reload control destructive to continuity |
| `P3-BHV-002` — expedition commissioning cannot open from either normal entry | Blocks M10 before an expedition ID, runner state, cost, timer, outcome, or stock return can exist |
| `P3-BHV-001` — inline Tavern policy controls reject without a target | Keeps M05 at Candidate despite successful central-planner policy/action transfer |
| `P2-RT-002` — duplicate glossary ID | Glossary overlay still fails, although the underlying screen remains usable |
| `P2-RT-003` — duplicate Tavern Log tags | Exercises the global M30 boundary; Go to Day works, Reload does not preserve the run |
| `P3-DC-001` — explicit ignore and unanswered cards share report wording | Remains a design clarification for M19 presentation, not a mechanical seam failure |

---

## 7. Phase D exit assessment and next-phase readiness

### Exit assessment

The requested M01–M30 execution is complete and every row has an explicit status. Twenty-six rows have runtime before/after evidence; four are blocked at their already-confirmed failure point.

The strict Phase D exit condition is therefore:

```text
Met for reachable seams.
Not met for M02, M10, M23, and M24 until their controlling defects are corrected.
```

### Recommended correction order before relying on later phases

1. `P2-RT-001` — restore autosave, Continue, snapshots, import/export, and safe reload.
2. `P4-SEAM-002` and `P4-SEAM-003` — restore retrospective and canonical pressure truth.
3. `P4-SEAM-001` and `P4-SEAM-004` — restore exact, relevant causal explanations.
4. `P3-BHV-002` — make the expedition lifecycle reachable.
5. `P4-SEAM-005` — align local-arc presence and age projections.

Phase 5 can proceed on uninterrupted-session practical play. Persistence, reload, snapshot/import, and expedition stress routes must remain explicitly blocked until a corrected build is supplied.

