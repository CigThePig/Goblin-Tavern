# Goblin Tavern Gameplay Audit — Phase 3 Individual Gameplay Behaviour

**Report version:** 1.0  
**Audit framework phase:** Phase C — Individual gameplay behaviour  
**Snapshot date:** 2026-07-26  
**Status:** Complete — exit condition met with explicit blockers  
**Primary runtime:** [GitHub Pages deployment](https://cigthepig.github.io/Goblin-Tavern/)  
**Primary difficulty:** Standard  
**Shared difficulty seed:** `phase3-difficulty-fixed`

## 1. Result

Phase 3 is complete for the supplied snapshot.

Fourteen of the seventeen Section 6 behaviour contracts completed through a normal player-facing path. The three contracts without a successful path are explicitly blocked:

- **Continue a saved session** and **save/snapshot/export/import/recover** are blocked by the Phase 2 save-serialization defect, `P2-RT-001`.
- **Commission an expedition** is blocked by a newly confirmed applicability mismatch, `P3-BHV-002`.

Every behaviour that remains reachable has at least one successful normal-path test. Applicable variants included a full owner-time budget, removal from the action queue, disabled targets, a project lifecycle, policy conflict feedback, recipe removal and restoration, staff hire/fire gating, card revision after route changes, explicit ignore, unanswered-card finalization, cross-report planning, and next-day state retention.

### New Phase 3 findings

| Finding | Severity | Priority | Player-facing impact |
|---|---|---|---|
| `P3-BHV-001` — Tavern policy toggles never reach the queue | **Medium** | **P2** | Every inline policy control under Tavern → Projects rejects with “Couldn't queue: no target”; the central planner is a working recovery path |
| `P3-BHV-002` — Expedition commissioning is unreachable from both normal entry points | **Medium** | **P2** | The Stock CTA and central planner both disable commissioning before the dedicated form can open |
| `P3-BHV-003` — Fired staff lose their name in the report action heading | **Low** | **P3** | The report heading displays a humanized generated ID, although the effect line still names the fired worker correctly |
| `P3-DC-001` — Explicit ignore and unanswered cards converge on the same report wording | **Observation** | **P4** | Both final states are presented as “Ignored …”; whether that equivalence is intentional needs design clarification |

### Carried blocker expanded in this phase

`P2-RT-001` remains the controlling Critical/P0 blocker. Phase 3 additionally confirmed that:

- **Snapshot now** throws the same `DataCloneError` and creates no named snapshot;
- **Export current save** throws the same `DataCloneError` and produces no export;
- both failures are silent in the Saves surface;
- after five uninterrupted played days, a new same-origin tab still showed only **Open the Tavern**, with no Continue option.

This is one shared serialization defect, not four separate findings.

## 2. Evidence identity and method

### Snapshot identity

| Item | Value |
|---|---|
| Uploaded archive | `Goblin-Tavern-main (8).zip` |
| Archive SHA-256 | `6a03761f79cf175a50fd27b9c6d65b4f8e5a7530695983a84f2f26b05b923324` |
| Package / simulation version | `goblin-tavern@0.1.0` / `0.1.0` |
| Save schema | version `1` |
| Tavern identity | `the_crooked_keg` |
| Local source root | `audit_workspace/source/Goblin-Tavern-main` |
| Prior runtime report | `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_02_RUNTIME_PATH_VERIFICATION.md` |

The deployed asset fingerprint was already matched to the supplied production build in Phase 2. A separate temporary deployment was therefore unnecessary.

### Runtime scenarios

| Scenario | Seed | Scope |
|---|---|---|
| Shared-seed difficulty comparison | `phase3-difficulty-fixed` | Fresh Easy, Standard, and Hard starts through the Advanced start UI |
| Immediate action and card contract | `phase3-actions` | Selection/revision, route-away return, queue budget/removal, priorities, service, report, next day |
| Connected behaviour lifecycle | `phase3-systems` | Recipes, projects, policies, social action, unanswered cards, hire/fire, report-to-plan action, six uninterrupted played days |
| Persistence continuation check | Same browser origin after the lifecycle run | New tab launch after repeated autosave opportunities |

All gameplay actions under test were taken through the deployed UI. Source was inspected after runtime observations to identify ownership and root cause. No game code or canonical state was edited. A generated invalid-import fixture was prepared, but the cloud browser denied file upload; that import variant is labeled environment-blocked rather than represented as product evidence.

## 3. Section 6 behaviour-contract matrix

| # | Behaviour contract | Result | Normal-path evidence | Invalid, interrupted, or recovery evidence |
|---:|---|---|---|---|
| 1 | Start a seeded session at a chosen difficulty | **Pass** | Easy, Standard, and Hard all opened Day 1 Morning with the same seed and visibly different coin/pressure/forecast initialization | Preset selection state and explanatory copy updated before start |
| 2 | Continue a saved session | **Blocked — `P2-RT-001`** | No valid saved-session entry exists | New same-origin tab after five days returned to Day zero with only Open the Tavern |
| 3 | Navigate and inspect Day/Reports/Tavern/World/More | **Pass with carried exceptions** | Phase 2 reached every root route and all Reports/Tavern/World subviews; Phase 3 repeatedly crossed Day, Tavern, Reports, and More without losing queued or pending state | Known glossary and populated-Log failures remain `P2-RT-002` and `P2-RT-003` |
| 4 | Queue an immediate owner action | **Pass** | Patch Roof queued on Roof, consumed 4h, applied in Segment B, and reported exact effects | Patch Roof + Clean Privy filled 6h; all non-free actions displayed Budget full; removing Clean restored 2h |
| 5 | Start, fund, and cancel a project | **Pass** | Private Booths started, advanced, was funded, advanced again, and was cancelled across Days 1–3 | Duplicate start disappeared while active; fund/cancel were unavailable before a project existed |
| 6 | Enable or disable a policy | **Pass with `P3-BHV-001`** | Central planner enabled Allow Tabs for Regulars and disabled Cheap Payday Specials; both applied and persisted | Refuse Tabs displayed a conflict warning; the alternate Tavern → Projects controls always failed with “no target” |
| 7 | Take a social or staff-management action | **Pass** | Supplier negotiation applied; a Kitchen Hand was hired and later fired through the planner | Fire Staff was disabled with No valid targets before a non-founding worker existed; became legal after hiring |
| 8 | Set staff priorities | **Pass** | Three role-valid priorities were selected and the plan showed “3 customised” | The same three selections remained checked on Day 2, confirming uninterrupted sticky behaviour |
| 9 | Toggle a recipe on the menu | **Pass** | Bowl of Stew was removed for free, later queued back on, applied, and consumed stew in service | Both directions displayed queued state; the free toggle remained available even when paid owner time was full |
| 10 | Commission an expedition | **Blocked — `P3-BHV-002`** | No successful normal entry exists | Stock CTA showed `commission_expedition requires a runner targetId`; central planner disabled the action for the same reason |
| 11 | Select or revise a card response | **Pass** | Licence response selected, revised, changed to Delay, finalized once, and appeared in the report | A Day 2 response remained selected after Tavern navigation and return to Day |
| 12 | Ignore or leave an issue unanswered | **Pass; clarification `P3-DC-001`** | Explicit Ignore displayed a selected ignored state; unanswered Morning and Service cards could be left behind and produced missed-opportunity rows | Skip to closing accepted an unanswered card without warning; post-day wording did not distinguish it from explicit Ignore |
| 13 | Run service | **Pass** | Multiple services completed and reported patrons, coin, incidents, and action effects | Both quiet service and service with a surfaced card were exercised; unanswered service content could be skipped to Closing |
| 14 | End the day | **Pass** | Closing → End day completed Segment C and produced a Day report | End Day remained gated behind Closing; no duplicate calendar advance was observed |
| 15 | Follow an explanation into a plan | **Pass** | Stock Shortage drilldown showed “Plan an action against this,” opened the planner on Immediate, focused relevant suggestions, and queued Buy Mugs | The queued report-origin action survived Next Day and applied on Day 6 |
| 16 | Advance to the next day | **Pass** | Next day opened Morning with Yesterday context and retained canonical project, policy, recipe, priority, and action-queue state | Project progress advanced once per day; no duplicate start-day tick was observed |
| 17 | Save, snapshot, export, import, or recover | **Blocked — `P2-RT-001`** | Preferences remained usable, but no full-session save path completed | Autosave, named snapshot, export, Continue, and reload recovery are blocked; import upload was additionally environment-blocked |

## 4. Behaviour evidence

### 4.1 Difficulty initialization

All three runs used root seed `phase3-difficulty-fixed`.

| Preset | Starting coin | Forecast | Top three visible pressures |
|---|---:|---:|---|
| Easy | 150 | about 89 guests | Violence 30; Food Safety 25; Inspection 25 |
| Standard | 100 | about 87 guests | Food Safety 35; Pests 35; Maintenance 35 |
| Hard | 75 | about 83 guests | Food Safety 40; Pests 40; Maintenance 40 |

Shared stock and roster values remained stable at 240 ale, 130 stew, 60 ingredients, and three staff. The start screen also changed its explanation:

- Easy: “Cleaner rooms, slower decay, extra coin to find your feet.”
- Hard: “Thinner purse, stickier floors, more eyes on your kitchen.”

The chosen preset was therefore visible both before and after initialization.

### 4.2 Immediate action, budget, and applicability

Starting Standard state for `phase3-actions`:

```text
Day 1 Morning
coin 100
owner time 6h
Roof: cleanliness 50, damage 35
Privy: cleanliness 25, damage 20
```

Runtime sequence:

1. Queue **Patch Roof**; its sole valid target auto-selected Roof.
2. Queue **Clean Area** and choose Privy.
3. Observe `6h / 6h`.
4. Observe every paid action disabled with **Budget full** while the free recipe toggle remained enabled.
5. Remove **Clean Area on Privy** from its queue chip.
6. Observe `4h / 6h` and 2h available again.
7. Run service with Patch Roof retained.

Day 1 report:

```text
Patched Roof · Roof (4h)
roof damage 35 → 14
roof condition 50 → 60
Time spent 0 → 240
```

The preview, budget, applied state, and report agreed.

Additional applicability variants:

- Fire Staff: **No valid targets** with only the three founding workers.
- Water Down Ale: disabled once ale reached zero, with “Ale is empty; nothing to water down.”
- Commission Expedition: disabled for the defect documented below.

### 4.3 Sticky staff priorities

The Day 1 plan changed:

| Staff member | Role | Default | Selected |
|---|---|---|---|
| Nash | Cleaner/Bouncer | Clean | Prevent Fights |
| Ib Mudshank | Cook | Speed | Clean As You Go |
| Mira the Resolute | Server | Keep Customers Happy | Watch Tabs |

The sheet immediately marked each chosen radio. After close, the plan summary showed **3 customised**. On Day 2, the same summary remained and reopening the sheet showed all three selected priorities still checked.

This verifies valid selection, visible acknowledgement, and uninterrupted next-day stickiness. Reload persistence remains blocked by `P2-RT-001`.

### 4.4 Recipe off/on lifecycle

Day 1:

- Tavern → Recipes listed Bowl of Stew as **on menu**.
- Tapping its control displayed **→ off (queued)**.
- The action queue showed one free pick and `0m / 6h`.
- Day 1 report displayed:

```text
Removed from Menu · Bowl of Stew
Bowl of Stew off menu
```

Day 5 report → Day 6:

- Bowl of Stew appeared under Available with **off menu**.
- Tapping displayed **→ on (queued)**.
- The toggle coexisted with a 30m Buy Mugs action queued from a report drilldown.
- Both picks survived Next Day.
- Day 6 report displayed:

```text
Added to Menu · Bowl of Stew
Bowl of Stew on menu
Stew stock 130 → 91
```

Both menu directions completed and the enabled recipe participated in service consumption.

### 4.5 Project lifecycle

The `phase3-systems` run exercised one project without state injection:

| Day | Player action / state | Visible result |
|---:|---|---|
| 1 | Queue Start Private Booths, 2h, 10 coin | Report: project started; coin −10 |
| 2 Morning | Inspect Tavern → Projects | Active; day 1 of 5; 10 coin invested |
| 2 | Queue Fund Active Project, 1h | Report: progress 1 → 2; invested 10 → 14 |
| 3 Morning | Inspect project | Active; day 3 of 5; 14 coin invested |
| 3 | Queue Cancel Project, 30m | Report: project `private_booths` cancelled |

While Private Booths was active, its start option was absent; only other project starters remained. Before a project existed, fund and cancel controls were absent. Start, fund, natural daily progress, and cancel therefore agreed on project identity and status.

### 4.6 Policies

The central planner successfully queued:

- **Allow Tabs for Regulars → on** (30m);
- **Cheap Payday Specials → off** (30m).

Once Allow Tabs was queued, Refuse Tabs displayed:

```text
Conflicts with queued Allow Tabs for Regulars.
```

The report recorded both policy actions. Tavern → Projects on the following mornings displayed Allow Tabs On with increasing days active and Cheap Payday Specials Off.

The alternate inline controls are broken as `P3-BHV-001`; this does not invalidate the successful central-planner policy execution.

### 4.7 Social and staff-management actions

Supplier negotiation:

```text
Target: Crystalspine Traders
Time: 1h
Relationship 30 → 35
Reliability 60 → 61
```

The action report and the later Recent social moves panel both retained the supplier identity and exact changes.

Staff lifecycle:

1. With only founding staff, Fire Staff was disabled with **No valid targets**.
2. Hire Staff offered six role candidates.
3. Choosing Kitchen Hand queued a 4h action.
4. Segment B hired **Caravanmaster Willem Threepence** for 40 coin.
5. On the next day, Fire Staff became enabled and auto-targeted that sole dismissible worker.
6. Segment B removed the worker and reduced remaining staff morale by five each.

The hire/fire rules and target gating worked. The fired worker's report heading has the labeling defect documented as `P3-BHV-003`.

### 4.8 Card selection, revision, route retention, and inaction

Licence card:

1. Select **Take up the licence and start the paperwork**.
2. Observe `noted: upgrade`.
3. Tap **Revise this decision**.
4. Observe the unselected card again.
5. Select **Leave the licence for now**.
6. End Day.
7. Observe report: `you chose: delay · Acquire a liquor licence`.

Route-retention variant:

1. On Day 2 select **Repair what is broken** on the Main Room card.
2. Navigate Day → Tavern → Day.
3. Observe the same card still selected with **Revise this decision**.

Inaction variants:

- Explicit Ignore immediately displayed an active Ignore control and `ignored`.
- Morning cards could be left unanswered by moving to Plan.
- A surfaced Service card could be left unanswered through **Skip to closing →**.
- Reports later listed those unresolved situations under **What you could have done** as missed opportunities.

The mechanics complete, but the report wording treats explicit ignore and no selection alike; see `P3-DC-001`.

### 4.9 Service, Closing, report, and Next Day

The immediate-action scenario completed:

```text
Service: 89 patrons, +424 coin, 2 incidents
Closing: End day available
Report: coin 100 → 515 (+415)
Next Morning: Day 2, coin 515
```

The report attributed Patch Roof before service and the final card response separately. Next Morning showed Yesterday's Day 1 summary and retained the three customized priorities.

Across the longer systems run:

- quiet and card-bearing Service beats both completed;
- Closing was reached through **Closing time →** after a response and **Skip to closing →** while unanswered;
- each End Day created one report;
- each Next Day advanced the calendar once;
- project progress and policy active-day counts advanced once per day.

### 4.10 Explanation into planning

The Day 5 Stock Shortage pressure detail showed:

```text
If ignored
Customers may leave dissatisfied.
Reliable reputation will drop.
Plan an action against this →
```

The CTA:

- closed the cause sheet;
- routed to the Day-owned planner;
- opened Immediate actions;
- displayed a Suggested section containing Buy Mugs and Restock Item, both labeled **Stock Shortage rising**.

Buy Mugs queued from that surface, survived Next Day, and the Day 6 report recorded:

```text
Bought Mugs · Mugs (30m)
mugs 35 → 45
coin −10
```

This is a complete successful player-facing path from explanation to a legal plan and applied result.

### 4.11 Persistence controls

Runtime observations:

| Control | Observed result |
|---|---|
| Autosave | Repeated console `DataCloneError`; no resumable session |
| Snapshot now | No named snapshot appears; console `DataCloneError` |
| Export current save | No download; console `DataCloneError` |
| Continue | Absent in a new same-origin tab after five played days |
| Reload/recover | Returns to Day-zero Start; Phase 2 established progress loss |
| Import invalid fixture | Browser file upload denied by the test environment; no product claim made |

The Saves surface continued to describe Autosave as updating every few seconds and displayed a current Day label, but did not surface the write failures.

Technical root, already filed as `P2-RT-001`:

```text
web/src/lib/sim/gameStore.svelte.ts:519-548
serializeForSave()
pendingBySeedId: structuredClone(this.pendingBySeedId)
```

The value is a Svelte `$state` proxy that Chrome cannot clone.

## 5. Findings

## P3-BHV-001 — Tavern policy toggles never reach the queue

- **Status:** Confirmed
- **Category:** Incorrect state transfer
- **Secondary tags:** Functional failure; action applicability mismatch; broken alternate route
- **Severity:** Medium
- **Priority:** P2
- **Confidence:** High
- **Evidence state:** Confirmed through runtime testing and static tracing
- **Systems involved:** R3, R5, S7
- **Runtime path:** Day 1 Plan; Tavern → Projects → Policies
- **Seam or connection involved:** M05
- **Player-facing impact:** Every inline policy Turn on/Turn off control fails. Players must discover and use the central planner instead.
- **Expected behaviour:** The Section 6 policy contract and the component's own design require the inline control to queue the generated enable/disable action for that policy.
- **Observed behaviour:** Tapping Cheap Payday Specials → Turn off or Allow Tabs for Regulars → Turn on leaves the queue unchanged and displays `Couldn't queue: no target`.
- **Reproduction steps:**
  1. Start a Standard game and enter Plan.
  2. Open Tavern → Projects.
  3. Tap any policy Turn on/Turn off control.
  4. Observe the unchanged queue and `Couldn't queue: no target`.
- **Frequency:** Always — 2 of 2 tested policies; the shared code path covers all rows.
- **Preconditions:** Any open day with at least 30m remaining.
- **Technical evidence:** `ProjectsPanel.svelte:86-101` builds a policy pick without `targetId`; `gameStore.svelte.ts:633-648` therefore calls `actionDisabledReasonForTarget(..., undefined, ...)`, which returns `no target`. `ActionPicker.svelte` passes both `targetId: row.policyId` and `targetLabel`, and works.
- **Gameplay evidence:** Visible inline error; central planner subsequently queued and applied both tested policy directions.
- **Related findings:** None.
- **Likely ownership:** Tavern Projects UI / owner-action queue adapter
- **Open questions:** None for the demonstrated failure.
- **Possible correction direction:** Make the inline pick carry the same policy ID and label as the central planner and scope queued/removal checks to that target.
- **Regression risks:** Policy inverse-toggle behavior, conflict messaging, queue deduplication, persisted queued picks.
- **Verification requirements:** Retest enable, disable, cancel queued toggle, inverse flip, conflict pair, full budget, Segment B application, and next-day policy state through both planner and inline paths.

## P3-BHV-002 — Expedition commissioning is unreachable from both normal entry points

- **Status:** Confirmed
- **Category:** Unreachable behaviour
- **Secondary tags:** Action applicability mismatch; incomplete runtime path; missing connection
- **Severity:** Medium
- **Priority:** P2
- **Confidence:** High
- **Evidence state:** Confirmed through runtime testing and static tracing
- **Systems involved:** R3, R5, S7, S12
- **Runtime path:** R06; Day 1 Plan → Tavern → Stock and central ActionPicker → Immediate
- **Seam or connection involved:** M10
- **Player-facing impact:** Players cannot open the dedicated commissioning form, select an adventurer, spend coin, or begin the expedition lifecycle.
- **Expected behaviour:** Stock panel → Commission Expedition sheet should accept a runner, mode, target, duration, and cost, then queue the action.
- **Observed behaviour:** Stock shows three available adventurers but disables Commission expedition with `commission_expedition requires a runner targetId`. The central planner disables Commission Expedition with “Commission from Tavern → Stock — pick a runner there.”
- **Reproduction steps:**
  1. Start a fresh Standard game.
  2. Enter Plan and open Tavern → Stock.
  3. Inspect the available adventurers.
  4. Observe the disabled CTA and missing-target reason.
  5. Open the central planner and observe its disabled Commission Expedition row.
- **Frequency:** Always — both normal entry surfaces, across Phase 2 and Phase 3 fresh sessions.
- **Preconditions:** Available uninjured adventurers, sufficient coin, and at least 2h owner time; all were present.
- **Technical evidence:** `commissionExpedition.ts:83-110` declares `targetType: 'global'` but rejects inputs without `targetId`. `readonlyHelpers.ts:158-168` validates global actions once without a target. `tavernOverviewProjection.ts:535-538` uses that result for Stock eligibility, and `StockPanel.svelte:166-177` disables the only form-opening button.
- **Gameplay evidence:** Stock listed Larian Shieldborn, Lyra the Bold, and Mira of the Wastes as available; the CTA remained disabled.
- **Related findings:** Phase 2 R06 was blocked by the same visible state.
- **Likely ownership:** Expedition action definition / owner-action applicability adapter / Stock entry UI
- **Open questions:** Whether the action should remain globally typed with special eligibility or receive a target type that lets generic applicability enumerate runners.
- **Possible correction direction:** Separate “can open the form” eligibility from fully specified commission validation, or make generic target discovery agree with the runner requirement.
- **Regression risks:** Expedition options, budget enforcement, runner busy/injured gating, cost preview, save compatibility, action-picker routing.
- **Verification requirements:** Open the form normally; test open and targeted modes, three durations, insufficient coin, busy/injured runner, queue budget, commission application, next-day progress, completion, runner state, stock return, and report attribution.

## P3-BHV-003 — Fired staff lose their name in the report action heading

- **Status:** Confirmed
- **Category:** Surface-truth mismatch
- **Secondary tags:** Player-comprehension failure; entity identity fallback
- **Severity:** Low
- **Priority:** P3
- **Confidence:** High
- **Evidence state:** Confirmed through runtime testing and static tracing
- **Systems involved:** S5, S7, P4
- **Runtime path:** Day 5 Report after Fire Staff
- **Seam or connection involved:** M05, M11
- **Player-facing impact:** The main action heading reads like an internal/generated identifier instead of the worker's name. The following effect line partly recovers comprehension.
- **Expected behaviour:** The report should preserve the same named staff identity shown while targeting and in the action's effect text.
- **Observed behaviour:** Queue: `Fire Staff on Caravanmaster Willem Threepence`. Report heading: `Fired Staff · Hire kitchen hand 4 0 (2h)`. Effect: `Fired Caravanmaster Willem Threepence (kitchen_hand).`
- **Reproduction steps:**
  1. Hire a non-founding staff member.
  2. On a later day, queue Fire Staff for that member.
  3. Run service and End Day.
  4. Inspect the owner-action report heading.
- **Frequency:** Once; deterministic root cause for any removed staff target.
- **Preconditions:** At least one dismissible worker.
- **Technical evidence:** `dailyReportProjection.ts:386-426` resolves the action target against post-action `state.staff`; the fired record no longer exists, so it falls back to `humanizeId(targetId)`.
- **Gameplay evidence:** Exact queue and report strings above.
- **Related findings:** None.
- **Likely ownership:** Daily report owner-action target-label projection
- **Open questions:** Whether applied action records should carry immutable display labels for other destructive/removal actions too.
- **Possible correction direction:** Preserve the target display name in the applied action/report payload before removal rather than resolving only from post-action state.
- **Regression risks:** Report schema, serialization, deleted regular/other entity actions, historical log identity.
- **Verification requirements:** Retest fire after hire, multiple generated roles/names, report rendering, history/log rendering, and save/reload once persistence works.

## P3-DC-001 — Explicit ignore and unanswered cards converge on the same report wording

- **Status:** Design clarification needed
- **Category:** Design intent unclear
- **Secondary tags:** Issue/card/response lifecycle; player-comprehension
- **Severity:** Observation
- **Priority:** P4
- **Confidence:** High for observed presentation; unknown for intent
- **Evidence state:** Requires design clarification
- **Systems involved:** P1, P2, P3, P4, P6
- **Runtime path:** Morning and Service cards through Segment C report
- **Seam or connection involved:** M13–M19
- **Player-facing impact:** A player cannot tell from the report whether they deliberately chose Ignore or simply advanced without choosing.
- **Expected behaviour:** The framework's Section 6 challenge asks whether modeled ignore, generic ignore, and no selection should be distinguishable and intentional.
- **Observed behaviour:** Explicit Ignore is distinguishable while the card is open. Unanswered cards can be skipped without warning. After End Day, missed-opportunity rows use `Ignored …` for both cases.
- **Reproduction steps:**
  1. Explicitly Ignore one surfaced Service card and finish the day.
  2. On another day, leave a Service card unanswered through Skip to closing.
  3. Compare the missed-opportunity wording.
- **Frequency:** Repeated across explicit and unanswered variants in the multi-day run.
- **Preconditions:** Surfaced card and a missed-opportunity projection.
- **Technical evidence:** Runtime report strings; no correctness claim is made without an intended distinction.
- **Gameplay evidence:** Explicit Miners Ignore and unanswered Ogres/other incidents all became `Ignored …` missed opportunities.
- **Related findings:** None.
- **Likely ownership:** Response/inaction design and report composition
- **Open questions:** Is generic Ignore intentionally equivalent to leaving no response? Should advancing with unanswered content warn, record “left unanswered,” or remain frictionless?
- **Possible correction direction:** Decide and document the semantic contract before changing wording or response state.
- **Regression risks:** Response exact-once behavior, missed opportunities, card hand flow, Quick Day, save/resume of pending choices.
- **Verification requirements:** Once intent is set, compare modeled ignore, generic ignore, no selection, revised-away choice, service skip, closing skip, report wording, delayed effects, and reload.

## 6. Phase 3 exit assessment

The Phase C exit condition is met:

- all currently reachable Section 6 behaviours have a successful normal path;
- invalid/applicability variants were exercised where the UI exposes them;
- unreachable or persistence-dependent behaviours are labeled with confirmed blockers;
- each new player-impact claim has runtime evidence and static ownership evidence;
- no audit finding is inferred from source alone;
- no product code was changed.

### Required carry-forward into later phases

| Item | Later-phase consequence |
|---|---|
| `P2-RT-001` | Blocks all reload, resume, snapshot, and import/export seam tests |
| `P3-BHV-002` | Blocks expedition commission → progress → resolution seam and long-horizon evaluation |
| `P3-BHV-001` | Both policy entry paths must be distinguished in seam testing; only central planner is trustworthy |
| `P3-BHV-003` | Destructive entity actions need identity-preservation checks in report/history seams |
| `P3-DC-001` | Phase D/E should preserve evidence for explicit versus implicit inaction without assigning design intent |

Phase 4 can proceed on uninterrupted-session seams, with persistence and expedition chains explicitly blocked until their controlling defects are addressed or a corrected build is supplied.
