# Goblin Tavern Gameplay Audit

## Phase 5 — Practical Play Evaluation

**Audit date:** 2026-07-26  
**Supplied snapshot:** `Goblin-Tavern-main (8).zip`  
**Public build:** <https://cigthepig.github.io/Goblin-Tavern/>  
**Framework:** `GAMEPLAY_AUDIT_FRAMEWORK.md`, Phase E  
**Primary browser and replay seed:** `phase5-practical-fixed`  
**Primary difficulty:** Standard

---

## 1. Completion status

Phase 5 execution is complete for the supplied snapshot.

The practical evaluation covered:

- seven complete consecutive days through the deployed browser UI and entry into Day 8;
- full, partial, zero, and over-budget owner-action variants;
- action removal, reordering, cross-screen queueing, and post-service queueing;
- card selection, revision, explicit ignore, unanswered cards, and deferred responses;
- a live week boundary and continued post-settlement play;
- browser backgrounding and hard reload;
- deterministic replay of the same seven-day route;
- Easy, Standard, and Hard comparison under one fixed day seed;
- a 28-day cadence run crossing four week boundaries and one month boundary;
- eight 28-day policy-strategy runs;
- targeted regression execution across 10 test files and 173 tests.

The R01–R15 route set finished with:

| Status | Count | Meaning |
|---|---:|---|
| **Pass** | 5 | Normal and applicable order/stress variants behaved coherently |
| **Characterized with defect or carried blocker** | 6 | The route ran far enough to establish its behaviour and the affecting defect |
| **Blocked** | 3 | A confirmed existing defect prevents the route’s required result |
| **Conditional** | 1 | Its required starting condition did not occur naturally |

Five new defects were confirmed:

| Finding | Severity | Priority | Primary player-facing impact |
|---|---|---|---|
| `P5-PLAY-001` — After-service planning says “today” but schedules tomorrow | **Medium** | **P2** | A player can unknowingly commit the next day’s time and resources after the current service has already resolved |
| `P5-PLAY-002` — Customer satisfaction rows omit the customer group | **Medium** | **P2** | Several report rows become visually indistinguishable without opening each drilldown |
| `P5-PLAY-003` — Issue evidence crosses actor and location boundaries | **High** | **P1** | Core reactive decisions routinely explain one actor’s problem with another actor’s or room’s evidence |
| `P5-PLAY-004` — “Fix the root cause” changes a rotated room rather than the cited root | **High** | **P1** | A costly response can repair a room unrelated to the card’s stated cause |
| `P5-PLAY-005` — Stock-shortage cards invent demand for unused zero-stock items | **Medium** | **P2** | The game recommends spending on an off-menu ingredient that has never sold while claiming heavy recent sales |

No new Critical/P0 issue was found. `P2-RT-001` remains the controlling Critical/P0 blocker: the hard reload at the end of this phase discarded the full eight-day browser session and returned to the new-game screen.

---

## 2. Scope and evidence protocol

### 2.1 Normal browser play

The normal route used the public build at the URL above:

- clean start;
- Standard difficulty;
- root seed `phase5-practical-fixed`;
- all state changes performed through visible controls;
- no console, storage, save, or simulation-state editing;
- seven days closed normally and Day 8 Morning reached.

The route deliberately varied use rather than optimizing play:

- Day 1 used the full 360-minute budget and a zero-minute menu toggle;
- Day 2 used 90 minutes;
- Day 3 used 30 minutes through a pressure-to-planner route;
- Days 4–7 used no owner actions;
- one card choice was revised before finalization;
- one service card was explicitly ignored;
- later cards were left unanswered;
- the action queue was reordered;
- Day, Tavern, World, and Reports were revisited between decisions.

### 2.2 Deterministic replay and controlled probes

The browser route was replayed through canonical Segment A/B/C calls with the same root seed, action order, sticky priority, and response slots:

`audit_workspace/fixtures/phase5-practical-probes.ts`

The replay matched the browser on the important checkpoints, including:

- Day 1: 95 patrons, +306 service coin, coin 401 after close;
- Day 2: 50 patrons, +280 service coin, coin 671;
- Day 3: 102 patrons, +602 service coin, coin 1243;
- Day 4: 79 patrons, +152 service coin, coin 1395;
- Day 5: 71 patrons and zero service coin;
- Day 6: 57 patrons, zero service coin, 12 incidents;
- Day 7: 5 patrons, zero service coin, then 33 coin in weekly wages.

Additional controlled runs used fresh deterministic initial states for:

- Easy/Standard/Hard comparison;
- 90-, 360-, and 390-minute action inputs;
- a 28-day no-action cadence and periodic-settlement run;
- eight 28-day strategy-bot runs.

These controlled states substitute for named starting saves because `P2-RT-001` prevents the supported snapshot/export/reload workflow.

### 2.3 Source and test evidence

Source was inspected after player-facing behaviour was reproduced. No product source or deployed state was changed.

Ten targeted Vitest files completed successfully:

```text
Test files: 10 passed
Tests:      173 passed
```

Coverage included owner actions and time budget, segmented days, complaint fairness, responses, grouped report diffs, weekly/monthly settlement, difficulty, stock-shortage cards, and day-session UI helpers.

The passing tests establish local contracts. They do not invalidate the findings below because the observed failures arise from combinations the current assertions do not test: after-service queue timing, multi-entity report labels, cause-domain scoping, cause-to-response location alignment, and stock-demand truthfulness.

---

## 3. R01–R15 practical route matrix

| Route | Status | Phase 5 evidence | Finding, blocker, or remaining condition |
|---|---|---|---|
| **R01 — Fresh Standard Day** | **Pass** | Clean public start reached Day 1 Morning; Easy/Standard/Hard controlled starts also validated | Reload expectation remains blocked by `P2-RT-001` |
| **R02 — Action applicability and time budget** | **Characterized with defect** | 90 and 360 minutes applied; 390 rejected only the overflow action; queue removal/reorder worked | `P5-PLAY-001`; inline policy entry remains `P3-BHV-001` |
| **R03 — Sticky staff priority** | **Characterized with blocker** | Nash stayed on Prevent Fights through seven uninterrupted days | Reload arm blocked by `P2-RT-001` |
| **R04 — Recipe, stock, and service** | **Pass** | Bowl of Stew was queued off, then on; stock and service reflected the current menu state | Stock depletion later produced `P5-PLAY-005` |
| **R05 — Issue choice and response** | **Characterized with defects** | Selection, route retention, revision, explicit ignore, inaction, immediate effects, and delayed queue all ran | `P5-PLAY-003`, `P5-PLAY-004`; carried `P3-DC-001` |
| **R06 — Expedition** | **Blocked** | Available adventurers remained visible, but no normal commissioning route can complete | `P3-BHV-002` |
| **R07 — Quick Day** | **Conditional** | No zero-Morning-card state appeared in the live week or 28-day controlled run | `P2-OBS-001`; controlled eligibility fixture still required |
| **R08 — Full interactive day** | **Characterized with defects** | Multiple full A/B/C loops completed with proactive/reactive and no-action variants | `P5-PLAY-001` through `P5-PLAY-004`; persistence checkpoint variants blocked |
| **R09 — Report-to-next-plan loop** | **Pass** | Staff Loyalty pressure CTA opened the Social planner tab and Comfort Nash applied | Carried cause duplication `P4-SEAM-001` still affects some evidence |
| **R10 — Week/month settlement** | **Characterized with blocker** | Week 1 closed interactively; days 7/14/21/28 and month 1 closed exactly once in the controlled run | Reload exact-once arm blocked by `P2-RT-001` |
| **R11 — Reload every position** | **Blocked** | Backgrounding preserved in-memory Day 8; hard reload returned to Start | `P2-RT-001` |
| **R12 — Snapshot/export/import** | **Blocked** | Carried Phase 2/3 reproduction already establishes shared serializer failure | `P2-RT-001` |
| **R13 — Opening to transformation** | **Pass** | Phase 5 covered decline/lapse; the opening remained Days 1–5 and was absent Day 6. Phase 4 covered pursue → venture → transformation | Persistence variants blocked |
| **R14 — Staff mastery arc** | **Pass** | Arc appeared Days 1–4, reached steady, accepted recognition on Day 3, then left the active hand | Persistence variant blocked |
| **R15 — Cross-screen identity/recovery** | **Characterized with defects** | Report drilldowns, pressure CTA, Tavern/World re-entry, weekly archive, and background return worked | `P5-PLAY-002`; carried `P2-RT-002`, `P2-RT-003`, and `P4-SEAM-002` |

---

## 4. Practical route diary

| Day | Morning and decisions | Plan/order variant | Service and closing | Report / next-state evidence |
|---:|---|---|---|---|
| **1** | Opening + staff arc. Selected licence pursuit, navigated away/back, then revised to decline. Staff arc unanswered. | Fumigate Cellar 240m, Water Down Ale 60m, Improve Stew 60m, Bowl of Stew off 0m. Improve was removed/re-added to change order. Nash changed to Prevent Fights. | 95 patrons, +306 coin, 2 incidents. | Coin 100→401. All four actions reported. Licence decline reported; unanswered staff arc omitted. |
| **2** | Area, opening, and staff-arc cards. Service complaint explicitly ignored. | Buy Mugs 30m, Bowl of Stew on 0m, Improve Stew 60m. | 50 patrons, +280 coin. | Coin 401→671. Two rows both read `Satisfaction: 46 → 41 (−5)` but represented Adventurers and Miners. |
| **3** | Seasonal arc, Cellar, opening, staff arc. Chose Compete on Quality and Mark Milestone. | Staff Loyalty pressure CTA opened Social; Comfort Nash 30m queued. | 102 patrons, +602 coin, 2 incidents. Merchants complaint chose Fix Root. | Coin 671→1243. Ale quality, staff recognition, Nash comfort, and complaint response applied. Four delayed entries queued. |
| **4** | Six-card hand: staff identity, stock shortage, liquor compliance, area, opening, staff arc. | No owner actions. Sticky priority remained `1 customised`. | 79 patrons, +152 coin, 8 incidents. Miners complaint unanswered. | Bog Truffle shortage claimed recent heavy sales despite quantity 0, off-menu recipe, and zero lifetime serves. Multiple anonymous satisfaction rows. |
| **5** | Six-card hand: policy, staff identity, stock shortage, seasonal arc, area, opening. | No owner actions. | 71 patrons, 0 coin, 5 incidents. Adventurers complaint unanswered. | Ale and stew depletion began a zero-revenue decline. Four anonymous satisfaction rows. |
| **6** | Five-card hand: stock, staff identity, policy, seasonal arc, area. Opening and staff arc no longer surfaced. | No owner actions. | 57 patrons, 0 coin, 12 incidents. Local Goblins complaint unanswered. | The two response effects due on absolute day 5 applied once; Staff Loyalty Risk reached 89. |
| **7** | Four-card hand: policy, stock, staff identity, area. | No owner actions. | 5 patrons, 0 coin, 3 incidents; Violence and complaint cards surfaced during service. | Weekly settlement charged 33 wages: 1395→1362. Week digest and archived Weekly Report rendered once. |
| **8 entry** | Post-week Morning opened normally. Reports and World remained navigable. | No action committed. | Not run. | Reopened “Today” report used Day 8 missed opportunities instead of the closed Day 7 set (`P4-SEAM-002`). Background/return preserved state; hard reload lost the session. |

### Live Morning hand cadence

| Day | Morning cards | During-service cards |
|---:|---:|---:|
| 1 | 2 | 0 |
| 2 | 3 | 1 |
| 3 | 4 | 1 |
| 4 | 6 | 1 |
| 5 | 6 | 1 |
| 6 | 5 | 1 |
| 7 | 4 | 2 |

The hand grew from introductory teleology into a four-to-six-card operational/social cadence. The route remained mechanically playable, but the repeated evidence and labeling defects reduced confidence in what several cards and report rows meant.

---

## 5. Order, stress, and interruption variants

### 5.1 Owner-time boundaries

The controlled budget probe produced:

| Input | Applied | Rejected | Recorded time |
|---|---|---|---:|
| 90m | Buy Mugs 30m + Improve Stew 60m | None | 90m |
| 360m | Fumigate 240m + Water Down Ale 60m + Improve Stew 60m | None | 360m |
| 390m requested | First three actions above | Buy Mugs: `over_budget` | 360m |

Every result validated with zero errors. The overflow reason was:

```text
Action would exceed the 6h daily time budget
```

In the browser, an action whose cost exceeded the remaining time was disabled before queueing. Zero-minute recipe toggles remained available at 360/360 minutes.

### 5.2 Queue order and revision

- Removing and re-adding Improve Stew moved it behind Water Down Ale.
- Segment B applied the actions in the resulting queue order.
- The opening choice remained selected after Tavern navigation.
- Revising pursuit to decline replaced the earlier choice; only decline became the response intent.
- Pressure CTA navigation retained the active day and existing queue.
- The sticky priority survived all route changes and seven day advances.

### 5.3 Explicit ignore versus unanswered

The Day 2 complaint used the visible Ignore control. Later cards were left unanswered by advancing to Closing.

The report did not list the explicit ignore under “You answered.” Both cases entered missed opportunities with the same “Ignored” treatment, reproducing `P3-DC-001`. The engine state is stable, but the intended semantic distinction still needs design clarification.

### 5.4 After-service queue boundary

After Day 1 Segment B had already applied the full 360-minute plan:

1. the Top Bar reset to `6h left today`;
2. the time chip remained interactive during Service and Closing;
3. the planner said `Your day is unspent`;
4. Buy Mugs queued for 30 minutes;
5. the Day 1 report did not include Buy Mugs;
6. Day 2 opened with only 5h30m remaining and Buy Mugs still queued;
7. Day 2 Segment B bought 10 mugs and charged 10 coin.

The underlying next-day preplanning behaviour is deterministic. Its player-facing time identity is not.

### 5.5 Background and reload

- Moving to another tab, waiting, and returning left Day 8 unchanged in memory.
- Hard reload returned to the introduction.
- The console repeated the known `DataCloneError` that an `[object Array] could not be cloned`.
- No Continue option existed for the eight-day run.

This is a direct extended-session reproduction of `P2-RT-001`.

---

## 6. Cadence, deferred effects, and long-horizon state

### 6.1 Delayed response timing

Day 3’s two chosen response profiles queued four entries:

| Pending IDs | Due absolute day | Payload |
|---|---:|---|
| `pending-2-0`, `pending-2-2` | 5 | “Rival may match quality” and “Group may expect this standard” future-hook effects |
| `pending-2-1`, `pending-2-3` | 9 | Corresponding future-hook memories |

At Day 6 Segment A:

- `pending-2-0` and `pending-2-2` moved to `appliedFromPendingToday`;
- neither applied again on Day 7;
- the day result remained validation-clean.

The compact queue therefore obeyed its due point and exact-once rule in uninterrupted play. The Phase 4 split between some compact pressure effects and rich snapshots remains a separate carried defect.

### 6.2 Weekly and monthly boundaries

The 28-day controlled run completed with zero validation errors:

| Check | Result |
|---|---|
| Weekly digest days | 7, 14, 21, 28 |
| Monthly digest day | 28 |
| Final calendar | Year 1, Month 2, Week 1, Day 1 |
| Calendar elapsed | 28 |
| Seeds per full day | min 2, max 6, average 5.43 |

The live Day 7 settlement also ran once and exposed the weekly archive after the report gate was closed.

### 6.3 Teleology, expeditions, and regulars

- **Opening:** Decline on Day 1 did not remove the opportunity immediately. It resurfaced through Day 5 and was absent on Day 6, characterizing the natural lapse/park window. The Phase 4 pursue path already established venture and transformation completion.
- **Staff arc:** Apprentice and steady stages appeared naturally. Recognition resolved on Day 3; the arc stopped occupying the hand after Day 4.
- **Expeditions:** The required route remains unreachable because of `P3-BHV-002`; no expedition progress was invented through state injection.
- **Regulars:** Named regular state remained visible in World and periodic reporting, but no distinct named-regular interaction family surfaced in the live week or the 28-day no-action hand sample. The sample produced customer-group complaints, not a separate regular interaction.
- **Quick Day:** No Morning with zero visible seeds occurred. The 28-day sample had no day with zero `morning_prep` seeds.

---

## 7. Controlled comparison results

### 7.1 Difficulty

One fixed day seed with no owner actions produced:

| Difficulty | Start coin | Avg. area cleanliness | Food/Maint./Pests start | Forecast | Patrons | Service coin | End coin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Easy | 150 | 57.8 | 25 / 25 / 25 | 93 | 94 | 535 | 685 |
| Standard | 100 | 47.8 | 35 / 35 / 35 | 91 | 92 | 535 | 635 |
| Hard | 75 | 37.8 | 40 / 40 / 40 | 87 | 88 | 505 | 580 |

All three states and full-day results validated. Difficulty modifies the advertised start-time domains and produces a measurable first-day difference without changing the route.

### 7.2 Complaint threshold contract

The current shared threshold is:

```text
satisfaction <= 60 and lowSatisfactionStreak >= 2
```

The targeted complaint-fairness tests confirmed:

- no complaint on a default Day 1;
- a held-low group reaches streak 1 after one service without a complaint;
- the complaint becomes eligible after a second held-low service;
- recovering above the threshold resets the streak;
- the streak survives serialization and validation.

This boundary behaved as registered. The defect found in Phase 5 is not when the complaint fires; it is which causes and room the resulting card attaches.

### 7.3 Strategy comparison

Eight 28-day strategies completed with validation clean throughout and no contradiction-audit hits:

| Strategy | Final coin | Identity | Dominant customer | Seeds |
|---|---:|---|---|---:|
| No owner actions | 1045 | filthy + goblinAuthentic | local_goblins | 152 |
| Pseudo-random owner | 954 | filthy + goblinAuthentic | local_goblins | 152 |
| Clean focused | 1127 | filthy + goblinAuthentic | local_goblins | 132 |
| Profit focused | 2813 | filthy + goblinAuthentic | local_goblins | 156 |
| Merchant focused | 1251 | cheap + goblinAuthentic | local_goblins | 152 |
| Miner focused | 731 | filthy + goblinAuthentic | local_goblins | 160 |
| Ignore repairs | 1268 | filthy + goblinAuthentic | local_goblins | 156 |
| Staff friendly | 1165 | filthy + goblinAuthentic | local_goblins | 149 |

The final-coin spread was 2082 and two reputation identities emerged, so actions materially differentiate results. Every strategy nevertheless ended with Local Goblins as the dominant customer group. This is balance/whole-experience evidence for Phase 7, not by itself a Phase 5 defect.

---

## 8. New Phase 5 findings

## P5-PLAY-001 — After-service planning says “today” but schedules tomorrow

**Status:** Confirmed runtime defect  
**Category:** Timing or cadence mismatch  
**Secondary tags:** Player-comprehension failure; sequence-dependent behaviour  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Routes:** R02, R08  
**Systems:** R3, S7, P6

### Expected

After Segment B has resolved the current day’s owner actions, either:

- the current-day planner is no longer available; or
- preplanning is explicitly identified as tomorrow’s queue and tomorrow’s budget.

The UI should not call an already-consumed day “unspent.”

### Observed

During Day 1 Service and Closing, the Top Bar showed `6h left today` and the planner said `Your day is unspent`. Buy Mugs queued successfully, but:

- did not apply or appear in Day 1’s report;
- reduced Day 2’s available time to 5h30m;
- applied in Day 2 Segment B;
- charged Day 2’s coin and changed Day 2’s stock.

### Confirmed source cause

- `TopBar.svelte` makes the time chip interactive for `plan`, `service`, and `closing` and labels the remainder “left today.”
- `ActionPicker.svelte` renders “Your day is unspent.”
- `gameStore.runService()` clears the queue after Segment B.
- `gameStore.requestActionPicker()` explicitly allows picks on any beat.
- `gameStore.endDay()` does not clear newly queued picks.
- `gameStore.beginDay()` intentionally preserves picks so they reach the next Segment B.

The mechanics form a next-day preplanning feature, while the copy and Top Bar present a current-day budget.

### Impact

A player can unintentionally spend tomorrow’s limited time and coin while believing they are changing the just-completed day. The action itself is deterministic and recoverable, so the demonstrated impact is Medium rather than High.

### Correction direction and verification

Choose one explicit contract:

- restrict the current-day planner after Segment B; or
- retain preplanning but label the queue, remaining time, and action timing as tomorrow.

Regression coverage should queue from Service and Closing, assert the visible day label, confirm no current-day report entry, and confirm exactly one next-day application.

---

## P5-PLAY-002 — Customer satisfaction rows omit the customer group

**Status:** Confirmed runtime defect  
**Category:** Surface-truth mismatch  
**Secondary tags:** Player-comprehension failure; report labeling  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Routes:** R08, R15  
**Systems:** P4, R5

### Expected

Each significant customer-group change should retain its entity identity, for example:

```text
Adventurers satisfaction: 46 → 41 (−5)
Miners satisfaction: 46 → 41 (−5)
```

### Observed

Day 2 displayed two identical rows:

```text
Satisfaction: 46 → 41 (−5)
Satisfaction: 46 → 41 (−5)
```

Opening the first row showed Adventurers; opening the second showed Miners. Days 4–7 repeatedly displayed three or four anonymous satisfaction rows.

The deterministic report projection retained unique paths such as:

- `customers.adventurers.satisfaction`;
- `customers.miners.satisfaction`;
- `customers.ogres.satisfaction`.

Only the visible labels lost identity.

### Confirmed source cause

`src/reports/labels/humanizePath.ts` has explicit mappings for reputation, stock, pressures, areas, and staff. Customer paths fall through to the last path segment, so every `customers.<group>.satisfaction` becomes only `Satisfaction`.

`DailyReport.svelte` keys rows by the full path, so the rows remain technically distinct while presenting the same accessible text.

### Impact

The Daily Report is the main retrospective surface. Players must open every row to know which audience changed, materially weakening comparison and causal follow-up.

### Correction direction and verification

Add a customer-path mapping that resolves the group label and field. Test a single report containing at least two customer satisfaction changes with equal before/after values, including their row text and drilldown titles.

---

## P5-PLAY-003 — Issue evidence crosses actor and location boundaries

**Status:** Confirmed runtime defect  
**Category:** Causality or explanation gap  
**Secondary tags:** Incorrect state transfer; issue/card truthfulness  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Routes:** R05, R08  
**Systems:** C2, P1, P2, P3

### Expected

A card centered on one customer or staff member should use causes belonging to that actor or an explicitly shared system condition. Location evidence should remain relevant to the described problem.

### Observed

The normal seven-day route repeatedly crossed identities:

| Card subject | Evidence included |
|---|---|
| Merchants | `Main room cleanliness fell below Adventurers tolerance.` |
| Miners | Adventurers and Food Critics cleanliness causes |
| Local Goblins | Adventurers cleanliness plus a Private Booth response |
| Ib Mudshank | A cause stating Nash was publicly blamed |
| Main Room | `Cleaner private_booth` |

The deterministic replay found foreign-group or unrelated-area causes in every customer complaint from Days 2–7. Several cards used `fumigate_cellar` as their dominant recent context regardless of customer group.

### Confirmed source cause

`recentCauseEntries()` in `generatorHelpers.ts` matches **any** supplied tag:

```text
tags.some(tag => cause.tags.includes(tag))
```

The customer complaint generator calls it with:

```text
['customer', group.id, 'area', 'reputation', 'cleanliness']
```

Any generic `area`, `reputation`, or `cleanliness` cause therefore qualifies even when it belongs to a different customer or room.

The staff-identity generator similarly requests:

```text
['staff', chosen.id, 'blame']
```

A generic `staff` or `blame` match can admit another staff member’s event.

### Impact

This affects a central reactive-decision surface and systematically makes “Because” evidence unreliable. A player can respond to the wrong explanation even when the underlying selected group is mechanically correct.

### Related findings

- `P4-SEAM-004` is an earlier symptom of the same broad any-tag evidence pattern in seasonal-arc cards.
- `P5-PLAY-004` is a separate cause-to-response location mismatch after the contaminated evidence has been selected.

### Correction direction and verification

Replace the flat any-tag query at entity-sensitive call sites with compound scoping: required actor/entity identity plus allowed domain tags, with a deliberate actor-agnostic path for truly global causes.

Regression tests should seed simultaneous causes for two customers, two staff members, and two rooms, then assert that each generated seed/card contains only the intended actor/location evidence.

---

## P5-PLAY-004 — “Fix the root cause” changes a rotated room rather than the cited root

**Status:** Confirmed runtime defect  
**Category:** Functional failure  
**Secondary tags:** Surface-truth mismatch; incorrect target transfer  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Routes:** R05, R08  
**Systems:** P1, P2, P3, S4

### Expected

The response labeled “Fix the root cause” should change the room identified by the complaint’s dominant cause, or the response should be labeled as a different generic cleanup.

### Observed

The Day 3 Merchants card cited a Main Room/Adventurers cleanliness problem. Choosing Fix Root:

- spent 10 coin;
- changed Private Booth cleanliness 65→83;
- patched Private Booth damage;
- did not clean the cited Main Room, which fell 18→0 during that day.

The following complaint targets continued rotating:

| Complaint | Cited location evidence | `fix_root_profile` area |
|---|---|---|
| Merchants | Main Room / Adventurers | Private Booth |
| Miners | Private Booth and Main Room | Stage Corner |
| Adventurers | Private Booth and Main Room | Main Room |
| Local Goblins | Private Booth and Main Room | Private Booth |
| Miners | Main Room / Adventurers | Stage Corner |

### Confirmed source cause

`generateCustomerComplaint()` selects:

```text
complaintAreaRef = pickCustomerFacingArea(ctx, 'customer_complaint')
```

That rotating picker is independent of the dominant cause. `fix_root_profile` then writes directly to:

```text
areas.${complaintAreaId}.cleanliness
areas.${complaintAreaId}.damage
```

The effect target therefore follows rotation, not the location in the cited evidence.

### Impact

This is a costly core response whose mechanical result does not perform its stated purpose. It can leave the actual bad room untouched while changing an unrelated one.

### Correction direction and verification

Derive the repair location from the dominant cause’s target or related locations. If no trustworthy location exists, use a non-location response or explicitly name the chosen generic cleanup target.

Verification should cover one complaint with two dirty rooms and prove that the card cause, preview, target option, applied state path, cause record, and report all identify the same room.

---

## P5-PLAY-005 — Stock-shortage cards invent demand for unused zero-stock items

**Status:** Confirmed runtime defect  
**Category:** Content-system mismatch  
**Secondary tags:** Surface-truth mismatch; misleading recommendation  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Routes:** R04, R08, R09  
**Systems:** S4, P1, P2, P4

### Expected

A stock-shortage warning should be grounded in actual or imminent demand, recent consumption, an active menu recipe, or another explicit use. An item already at zero should not be said to “may run out,” and fabricated sales history should not justify a paid restock.

### Observed

On Day 4, the Stock Shortage card targeted Bog Truffle:

| Fact | Actual state |
|---|---|
| Quantity | 0 from the start of the run |
| Consuming recipe | Bog Truffle Plate |
| On menu | No |
| Lifetime serves | 0 |
| Card recent context | `bog truffle sales heavy this week` |
| Card stake | `Bog Truffle may run out` |
| Offered response | Spend 30 coin to add 60 Bog Truffle |

Because Day 1 had created a deception memory by watering ale, the card title also rendered `last week was already stretched` on Day 4 of Week 1.

Later zero-stock warnings for Ale, Stew, and Mushrooms were grounded in real service consumption; the Bog Truffle warning was not.

### Confirmed source cause

`generateStockShortage()`:

- includes every stock item whose quantity is `<= 30`;
- scores primarily by `30 - quantity`;
- does not require active recipe, demand, sale, consumption, or discoverability;
- unconditionally writes `<item> sales heavy this week`;
- unconditionally writes `<item> may run out`.

The stock-shortage title pool selects `last week was already stretched` from any memory tagged `deception`, without checking the calendar week or item identity.

### Impact

The player is encouraged to spend on an unused, undiscoverable specialty ingredient based on false operational history. This weakens procurement decisions without blocking the complete day.

### Correction direction and verification

Gate shortage candidates on a real consumption/demand/use signal, distinguish “already out” from “running low,” and derive recent context from recorded history. Time-relative title conditions should verify that a prior week exists and that the memory is relevant to the chosen item.

Test a mixed state containing:

- an on-menu consumed item at low stock;
- an off-menu never-served rare item at zero;
- a deception memory for a different item;
- Week 1 and Week 2 calendar positions.

---

## 9. Carried finding status after Phase 5

| Finding | Phase 5 status |
|---|---|
| `P2-RT-001` — Save serialization failure | **Reproduced.** The full eight-day session was lost on hard reload; Continue remained unavailable. Still Critical/P0. |
| `P2-RT-002` — Glossary duplicate ID crash | **Carried.** Same fingerprint-compatible build; not repeatedly invoked because the failure is already confirmed. |
| `P2-RT-003` — Populated Tavern Log duplicate-tag crash | **Carried.** Weekly Reports worked, but the known crashing Log route was not used as a progress gate. |
| `P2-OBS-001` — Quick Day eligibility | **Strengthened.** No zero-Morning-card day in the live route or 28-day cadence run. Remains conditional, not a defect. |
| `P3-BHV-001` — Inline policy toggles | **Carried.** Central planner remains the working alternate route. |
| `P3-BHV-002` — Expedition commissioning unreachable | **Blocking R06.** No expedition was injected around it. |
| `P3-BHV-003` — Fired staff report label | **Carried; not exercised in this route.** |
| `P3-DC-001` — Ignore versus unanswered wording | **Reproduced.** Explicit ignore and no selection converge on “Ignored” missed-opportunity treatment. |
| `P4-SEAM-001` — Duplicate pressure causes | **Reproduced in drilldown.** |
| `P4-SEAM-002` — Closed report uses today’s missed opportunities | **Reproduced on Day 8.** |
| `P4-SEAM-003` — Deferred pressure compact/rich split | **Carried.** Phase 5 confirmed queue due/exact-once timing, not a correction to the split truth. |
| `P4-SEAM-004` — Seasonal card absorbs staff causes | **Expanded causal cluster.** `P5-PLAY-003` shows the same any-tag scoping problem across customer and staff cards. |
| `P4-SEAM-005` — Local-arc projection disagreement | **Carried.** Periodic boundaries remained executable; the projection defect was not reclassified. |

---

## 10. Exit assessment and Phase 6 hand-off

The Phase E exit condition is met: behaviour is characterized outside a single ideal reproduction.

Evidence now includes:

- repeated normal days;
- different action-budget levels;
- action and card ordering changes;
- cross-screen interruption and re-entry;
- no-action stress;
- deferred effects;
- weekly and monthly cadence;
- difficulty and strategy comparisons;
- background and reload behaviour;
- source-backed reproduction of each promoted finding.

Remaining gaps are explicit product constraints or conditional content:

1. R06 cannot run until `P3-BHV-002` makes commissioning reachable.
2. R11 and R12 cannot run until `P2-RT-001` permits a valid save, snapshot, export, and reload.
3. R07 requires a reproducible zero-card Morning fixture or clarified eligibility; none occurred across 28 controlled days.
4. No distinct named-regular interaction surfaced naturally in the sampled route.
5. The Day 3 future-hook effects fired on Day 6; their later day-9 memory payloads were not reached through the browser before the reload destroyed the session.

Phase 6 should now evaluate player comprehension using the observed functional truth, with particular attention to:

- current-day versus next-day action timing;
- group identity in repeated report rows;
- whether card “Because” evidence can be trusted;
- whether response labels, previews, and applied targets name the same room;
- whether stock warnings distinguish low, empty, demanded, and unused inventory;
- explicit ignore versus unanswered-card language;
- visibility of queued and later-applied deferred effects.
