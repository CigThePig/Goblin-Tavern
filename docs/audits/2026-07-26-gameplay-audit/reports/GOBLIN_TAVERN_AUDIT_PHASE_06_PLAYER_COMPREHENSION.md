# Goblin Tavern Gameplay Audit

## Phase 6 — Player Comprehension

**Audit date:** 2026-07-26  
**Supplied snapshot:** `Goblin-Tavern-main (8).zip`  
**Public build:** <https://cigthepig.github.io/Goblin-Tavern/>  
**Framework:** `GAMEPLAY_AUDIT_FRAMEWORK.md`, Phase F  
**Primary browser seed:** `phase6-comprehension-fixed`  
**Primary difficulty:** Standard

---

## 1. Completion status

Phase 6 execution is complete for the supplied snapshot.

The audit observed the interface before consulting source or replay data, then compared the player-readable answer with canonical state. Coverage included:

- new-game setup and deterministic-seed explanation;
- a fresh Morning, card selection, revision, and unanswered cards;
- full-budget owner planning, a zero-minute recipe toggle, staff priorities, and disabled actions;
- Service and a reactive complaint choice;
- Closing, the immediate Daily Report, and a report reopened after the next day began;
- report rows, cause drilldowns, pressure details, and a pressure-to-plan route;
- Tavern area, stock, recipe, staff, project, and policy surfaces;
- World identity and regular detail;
- More, Saves, Help, glossary, Tavern Log, and error recovery;
- a delayed area-project commitment from selection through later application;
- a deterministic delayed-response replay covering queued and applied future effects;
- nine targeted test files and 46 passing tests.

The Phase F exit condition is met: every core route has player-facing observations, not only internal traces.

Seven new comprehension defects were confirmed:

| Finding | Severity | Priority | Primary player-facing impact |
|---|---|---|---|
| `P6-COMP-001` — Decision confirmations replace choice language with internal verbs | **High** | **P1** | The game can summarize “Back Mira” as `blame` and several unrelated commitments as `upgrade`, so the authoritative decision record does not reliably repeat what the player chose |
| `P6-COMP-002` — Delayed choices have no pending ledger or completion attribution | **High** | **P1** | A promised later effect can disappear after selection and later arrive as an unexplained number change |
| `P6-COMP-003` — Cause drilldowns expose machine sources and debug metadata | **Medium** | **P2** | The dedicated “why” surface often answers with paths such as `customers.merchants.dish_ale`, raw actor IDs, and unexplained `weight` values |
| `P6-COMP-004` — Staff priorities hide effects and receive no outcome attribution | **Medium** | **P2** | A sticky strategic choice has no visible tradeoff before selection and no report evidence after Service |
| `P6-COMP-005` — “Spend owner time” advances the licence without spending or naming time | **Medium** | **P2** | The choice contract and visible planner disagree about whether a limited daily resource was consumed |
| `P6-COMP-006` — Historical Daily Reports discard resolved choices | **Medium** | **P2** | “You answered the day” is present at Closing but vanishes when the same report is revisited after the next day starts |
| `P6-COMP-007` — Implementation vocabulary leaks into default player surfaces | **Low** | **P3** | Default cards and detail sheets expose internal family, trait, memory, and engine terms instead of a consistent tavern vocabulary |

No new Critical/P0 defect was found. The carried Critical/P0 save failure, `P2-RT-001`, still limits durable comprehension because the game promises persistence that the deployed runtime does not provide.

---

## 2. Evidence protocol

### 2.1 Player-first observation

The public build was opened as a normal player and started from Day zero with:

```text
Difficulty: Standard
Seed: phase6-comprehension-fixed
```

The run used visible controls only. Simulation state, storage, saves, and console data were not edited. For each route, the evaluator answered the Phase F questions from the interface first:

1. What is happening now?
2. Which choices are available and which are final?
3. What just changed?
4. Why did it change?
5. Did the action succeed, fail, or remain pending?
6. What consequence should be expected later?
7. What does the game expect next?

Source and deterministic replay were consulted only after the player-facing observation was recorded.

### 2.2 Live route

The primary route progressed from setup through Day 6 entry. It deliberately included:

- four Day 1 owner actions using all six hours;
- a zero-minute recipe-menu toggle;
- a custom cleaner/bouncer priority;
- an opening choice and a staff-arc choice;
- a Day 2 area project with an advertised delayed effect;
- a Day 2 liquor-licence investment described as owner time;
- a during-service customer complaint response;
- a Day 3 rival response with immediate and later consequences;
- repeated report, pressure, Tavern, World, and More inspection;
- enough uninterrupted days for the area project to complete.

### 2.3 Canonical comparison

The live observations were compared with:

- `CardChoice`, pending choice, intent-building, and resolved-intent paths;
- response pending scheduling and start-day application;
- Daily Report and report-screen projections;
- cause production and `CauseDrilldown`;
- staff priority definitions and service modifiers;
- venture issue generation and response effects;
- owner-action quoting and disabled-reason helpers;
- card context, seed-family tags, and preferences.

The existing deterministic Phase 5 fixture was reused for delayed-response truth:

```text
audit_workspace/fixtures/phase5-practical-probes.ts
```

No product source was changed.

---

## 3. Seven-question route matrix

Legend: **✓** clear from the player surface; **△** partly inferable or inconsistently explained; **✕** unavailable or misleading; **—** not applicable.

| Core route | Now | Choices / finality | What changed | Why | Success / pending | Later consequence | Expected next |
|---|---|---|---|---|---|---|---|
| **Setup → fresh Morning** | ✓ Day zero, difficulty, and Day 1 state are explicit | ✓ Difficulty and seed are editable before opening | ✓ Start values and forecast are visible | ✓ Difficulty descriptions and “same seed + same input” explain setup | ✓ Open Tavern gives an unambiguous transition | ✓ Seed-fork behaviour is stated | ✓ Review cards, then plan |
| **Morning card decision** | ✓ Card subject and immediate stakes are prominent | △ Choice previews are useful, but “applies at End Day” is not stated | △ A revise chip appears, but it says `noted: <verb>` rather than the selected choice | △ Some causes are useful; others are tautologies or raw IDs | △ Revision implies pending, but finalization timing is implicit | △ Later effects can be named without a due day or persistent pending state | ✓ Plan the day remains visible |
| **Owner-action planner** | ✓ Remaining time and queued actions are visible | ✓ Most costs, targets, deltas, risks, removal, and order are explicit | ✓ Rich action quotes show expected immediate changes | ✓ Most disabled reasons are present | △ `Budget full` can appear with time remaining; a recipe toggle loses its direction in the queue quote | ✓ Immediate action consequences are generally legible | ✓ Run Service |
| **Staff priorities** | ✓ Staff, role, morale, stress, and selected priority are visible | ✕ Options are labels only; effects and tradeoffs are absent | △ Selection is visually sticky | ✕ No explanation connects a priority to Service modifiers | △ The selected radio state confirms storage, not gameplay success | ✕ No expected outcome or later feedback is shown | ✓ Return to the plan |
| **Service and reactive card** | ✓ Patrons, coin, incidents, and active complaint are visible | △ Choice previews exist, but one staff effect appeared only as `Mira +8` | ✓ Service outcome is concise | △ Card evidence is readable in places but affected by carried cross-actor causes | △ “Back Mira” became `noted: blame` | ✕ No persistent pending/due view follows a delayed response | ✓ End Day |
| **Closing Daily Report** | ✓ Day and coin movement are prominent | — | ✓ Owner actions and many stat changes are listed | △ Readable lines coexist with duplicate causes, raw paths, and anonymous rows | △ Response summaries use internal verbs; time reset can appear as a negative result | ✕ “What might happen” can be empty while response effects are canonically pending | ✓ Next Day |
| **Historical report and pressure follow-up** | ✓ The closed day remains selectable as Today | — | △ Numeric changes remain, but the prior choices disappear | ✕ Cause drilldowns expose machine paths and weights | ✕ The historical decision record is incomplete | △ Pressure bands show current values, but not a scale, threshold, or due consequence at lower bands | △ Pressure CTA opens the right action category, but its global Suggested block can be unrelated |
| **Delayed project chain** | △ History says a project started, but no due day or progress ledger is exposed | △ The initial preview names later effects but not timing | △ Completion appears only as separate metric deltas | ✕ The completion report does not name the project or originating choice | ✕ Pending versus completed is not represented as one lifecycle | ✕ The player cannot know when to expect completion | △ Continue days and notice a later number change |
| **Tavern / World / Help / recovery** | ✓ Entity summaries and quick actions usually establish place and state | △ Most controls are clear; the expedition blocker and some staff wording use engine vocabulary | △ Detail sheets expose current values | △ Raw trait/memory IDs and “engine fallback” weaken explanations | △ The Tavern Log error offers a useful Go to Day recovery, but glossary and Log routes are carried crashes | △ Project detail is helpful; other long-horizon systems vary | ✓ Navigation and recovery controls are visible |

The matrix shows a consistent split:

- **State and immediate action previews are usually strong.**
- **Finality, causal explanation, delayed status, and historical decision memory are not yet reliable.**

---

## 4. Live comprehension diary

### 4.1 Setup and Day 1

The advanced start panel gave one of the clearest explanations in the product:

```text
same seed + same input = same days. change to fork the world.
```

Day 1 Morning then established the current state well:

- the calendar and beat were prominent;
- “At a glance” summarized forecast and pressures;
- the hand contained an opening card and a staff-arc card;
- first-encounter Supplier guidance appeared at the appropriate route.

Choice previews communicated prospective effects, but the post-selection language did not repeat the choice:

| Player selected | Confirmation shown |
|---|---|
| Take up the licence opportunity | `noted: upgrade` |
| Mark how far Mira has come | `noted: promote` |

The revise affordance showed that the choice was not yet final, but only source comments—not the interface—stated that decisions remain uncommitted until End Day.

The owner planner was substantially clearer. Fumigate Cellar showed:

- exact coin cost;
- Cellar pest-risk, smell, and cleanliness changes;
- the hidden chemical-smell tradeoff;
- the four-hour time cost.

After Fumigate, two hours remained. Four-hour actions were disabled as `Budget full`, even though the budget was not full; the action merely required more time than remained.

The Day 1 queue used:

- Fumigate Cellar — 240 minutes;
- Toggle Bowl of Stew off-menu — 0 minutes;
- Improve Stew — 60 minutes;
- Water Down Ale — 60 minutes.

The three non-toggle actions retained useful quotes. The toggle appeared only as `Toggle Recipe On/Off Menu: Bowl of Stew`, so its direction was not recoverable from the queue itself. The Daily Report later correctly said that Bowl of Stew was removed from the menu.

The Staff Priority sheet listed `Clean`, `Minor Repairs`, `Prevent Fights`, and `Intimidate Debtors` but no effects. Nash was changed from Clean to Prevent Fights. The plan summary only reported `1 customised`, and the Daily Report provided no priority result or causal attribution.

Service itself was easy to read:

```text
91 patrons · +295 coin · 2 incidents
```

The report also clearly listed all four owner actions and their immediate effects. Its response ledger, however, reduced the selected card wording to:

```text
you chose: upgrade · Acquire a liquor licence
you chose: promote · Mira the Resolute
```

### 4.2 Day 2 decisions and Service

The Day 2 Main Room card offered a project with a useful mechanical preview:

```text
Immediate: Coin -25 · Main Room Condition +10
Later: Main Room Condition +20 · Maintenance -10
```

It did not state when the later result would arrive. After selection, the confirmation was only `noted: upgrade`.

The active liquor venture showed progress `0/2` and offered:

```text
Spend owner time on the licence
```

Its preview said only `Advance licence paperwork`. After selecting it:

- the plan still said no owner actions;
- all six owner hours remained;
- the next day’s venture advanced to `1/2`.

The interface therefore claimed a limited-resource cost while simultaneously showing that none was consumed.

During Service, an Ogres complaint offered a response to back Mira. The preview included a bare `Mira the Resolute +8` without naming the affected meter. Selecting it produced:

```text
noted: blame
```

The closing report later rendered:

```text
you chose: blame · the Ogres
```

This is not a faithful confirmation of the visible choice wording. It may reflect the internal target of blame, but it drops the important action—publicly backing Mira—and makes the player’s own decision sound different.

The Day 2 report otherwise made immediate resource changes readable, including the project’s -25 coin. It did not show a pending project, a due day, or the claimed staff memory. Its Other section also rendered the normal daily budget reset as:

```text
Time spent: 360 → 0 (−360)
```

That is technically a state diff but reads like a lost outcome rather than the opening of a new daily budget.

### 4.3 Day 3 report revisit and explanatory surfaces

Day 3’s rival choice preview was useful:

```text
Immediate: Ale Quality +10 · Coin -20 · Regular Customer Loss -10
Later: Rival may match quality
```

The immediate coin and quality changes did not occur at selection; they applied when End Day resolved responses. That timing was inferable only by comparing Top Bar values before and after Service/Closing.

After Day 3 began, reopening the Day 2 report exposed a separate retention failure: the same report no longer contained any “You answered the day” entries. The numeric results remained, but the player’s three decisions had disappeared.

The pressure dashboard grouped all pressures and displayed current values and trends. It did not explain:

- the scale;
- what value changes the band;
- what a low-band pressure is likely to cause;
- when that consequence would become relevant.

Staff Loyalty’s action CTA correctly opened the Social planner tab. The global Suggested block then led with a restock recommendation based on yesterday’s ale loss, not the Staff Loyalty pressure that initiated the route. The navigation target was correct; the recommendation context was not scoped to the initiating pressure.

The Tavern and World routes generally provided strong entity summaries and quick actions. Comprehension weakened in detail views that displayed:

- `cleanliness_negative`, `risk_positive`, and `merchant_sensitive`;
- `ogres_dismissed`;
- `engine fallback`;
- hyphenated identity fragments such as `local goblins-welcoming`.

The Tavern Log triggered the carried duplicate-key error, but its error boundary offered an effective Go to Day recovery. The Help route said terms could be tapped for definitions; the glossary did not open because of the carried glossary crash.

### 4.4 Delayed completion

The Main Room project’s original preview promised a later +20 Condition and -10 Maintenance result. Subsequent mornings provided only a history phrase that the project had started. They did not show:

- progress;
- remaining days;
- due day;
- a pending consequence record.

When the effect arrived, the later report showed:

```text
Main Room condition: 70 → 90 (+20)
Maintenance: 12 → 2 (−10)
```

It did not identify a project completion, the originating Day 2 choice, or the original preview. The Condition drilldown said `Project completes +20`; the Maintenance drilldown only said `Maintenance pressure eases -10`. The two halves of one promised result were not presented as one resolved commitment.

---

## 5. Canonical comparison

| Player-facing question | Player answer | Canonical answer | Mismatch |
|---|---|---|---|
| What did I choose? | `noted: upgrade`, `promote`, or `blame` | `CardChoice` retains both a player-facing `label` and an internal `verb` | The UI and report select the engine verb instead of the chosen label |
| Is the choice final now? | Revision is possible, but timing is unstated | Pending decisions remain uncommitted until End Day | Finality is only indirectly signaled |
| Is a later consequence pending? | Often no visible pending entry and an empty “What might happen” section | Response state contains scheduled pending entries with due and expiry days | Canonical pending truth is not projected |
| Why did coin change? | Some drilldown rows are `customers.<group>.<recipe>` or `service.tabs.<group>` | Those strings are mutation source identifiers | A technical source key is being used as player explanation |
| What does Prevent Fights do? | No effect shown | Canonical modifier is `fightControl: 1`; alternatives have different operational tradeoffs | A real strategic effect is invisible before and after selection |
| How much owner time did the licence use? | The wording says owner time, but the planner remains at six hours | The response increments venture progress and records a memory; it applies no owner-time change | The stated cost contract is not implemented or quantified |
| Can I review yesterday’s choices? | The closing report can, the reopened report cannot | `resolvedToday` is cleared at the next start-day hook | The report is rebuilt from transient current-day state |

### 5.1 Internal verb path

`src/cards/types.ts:47–56` defines both:

```text
label: string
verb: ResponseIntentVerb
```

The player-facing confirmation renders the latter:

- `web/src/lib/components/CardDeck.svelte:126–132`;
- `web/src/lib/screens/DayScreen.svelte:527–545`.

The report projection carries `r.verb` unchanged at `src/reports/dailyReportProjection.ts:458–510`, and `web/src/lib/components/DailyReport.svelte:142–163` displays it as `you chose`.

The architecture already preserves the information needed to show the selected label while keeping the verb for engine routing. The wrong field is being treated as the player summary.

### 5.2 Hidden delayed state

Canonical response scheduling is explicit:

- delayed effects default to +3 days;
- future-hook memories default to +7 days;
- every pending entry has `scheduledFor` and `expiresAt`.

These contracts are implemented in `src/sim/modules/responses/pendingHelpers.ts:10–28` and `85–145`.

The Daily Report’s “What might happen” projection does not inspect that queue. `src/reports/dailyReportProjection.ts:744–759` only selects memories of type `future_hook` that were already created on the just-closed day.

The deterministic replay demonstrated the gap:

| Reported day | Canonical pending entries | Report future hooks | Applied that day |
|---:|---|---:|---|
| 3 | Four: two due on absolute day 5, two due on day 9 | 0 | None |
| 4 | Same four | 0 | None |
| 5 | Same four | 0 | None |
| 6 | Two day-9 entries remain | 0 | `pending-2-0`, `pending-2-2` |

All four replay states had zero validation errors. The engine knows both that the consequences are pending and when they are due; the player feedback layer does not.

### 5.3 Raw cause path

`web/src/lib/components/CauseDrilldown.svelte:68–75` formats actors and locations as:

```text
<kind>/<id>
```

The same component renders raw `cause.readable`, `weight <number>`, and those raw references at lines 117–135.

Several mutation producers use engine-oriented source strings without player-readable text:

- purchases: `customers.${group.id}.${recipeId}` in `src/sim/modules/customers/purchases.ts:104–117`;
- unpaid tabs: `service.tabs.${group.id}` in `src/sim/modules/service/resolveService.ts:311–321`.

The drilldown therefore has no player-facing translation to fall back on.

### 5.4 Staff priority path

`web/src/lib/components/StaffPrioritySheet.svelte:43–78` renders each priority’s label only. The canonical definitions carry useful tradeoff tags, including:

```text
Prevent Fights → fight_control, rowdy_satisfaction_penalty
Intimidate Debtors → tab_control, dangerous_reputation_risk
```

The actual service modifiers at `src/sim/modules/staff/priorityEffects.ts:30–48` include:

```text
Clean → messControl 1, fightControl 0.2
Prevent Fights → fightControl 1
Watch Tabs → tabControl 1, serviceSpeed -0.3
Help Clean → messControl 0.5, serviceSpeed -0.4
```

The missing preview is not caused by an unknowable or purely narrative system; structured effect information exists.

### 5.5 Venture owner-time path

`src/sim/modules/ventures/ventureIssueSeeds.ts:26–31` declares:

```text
labelHint: Spend owner time on the licence
costTypes: owner_time
```

Its selected profile only increments venture progress by 1 and creates a memory. It does not deduct minutes, add an owner-action ledger entry, or name an amount.

### 5.6 Historical report path

`web/src/lib/screens/ReportsScreen.svelte:54–62` rebuilds the daily report from `latestResult` and the current `gameStore.state`.

`src/reports/dailyReportProjection.ts:458–462` reads resolved choices from:

```text
state.modules.responses.resolvedToday
```

The next start-day hook clears that array at `src/sim/modules/responses/responsesModule.ts:88–102`. The same closed-day report therefore changes when it is revisited.

---

## 6. New Phase 6 findings

## P6-COMP-001 — Decision confirmations replace choice language with internal verbs

**Status:** Confirmed runtime defect  
**Category:** Player-comprehension failure  
**Secondary tags:** Decision finality; surface-truth mismatch; report wording  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Systems:** P2, P3, P4, P6

### Expected

After a choice, the pending confirmation and Daily Report should repeat a stable player-facing summary of the selected action. They should also state whether it is revisable now and when it becomes final.

### Observed

The live route produced:

| Visible choice | Pending / report wording |
|---|---|
| Take up the licence opportunity | `noted: upgrade` |
| Mark how far Mira has come | `noted: promote` |
| Start a real Main Room project | `noted: upgrade` |
| Spend owner time on the licence | `noted: upgrade` |
| Invest ahead of the rival | `noted: upgrade` |
| Back Mira against the Ogres | `noted: blame`; later `you chose: blame · the Ogres` |

The terms are valid engine intent verbs, but they are not faithful player confirmations. `upgrade` collapses unrelated actions, while `blame` materially reframes a choice centered on backing a staff member.

The revise icon makes the pending state discoverable, but no visible text says that selection remains uncommitted until End Day.

### Confirmed source cause

The card model retains both `label` and `verb`. The pending overlays and Daily Report deliberately render `verb`. The report projection also discards the original choice label when it creates the resolved-intent row.

### Impact

This affects frequent, central decisions. The interface’s authoritative confirmation can fail the basic question “What did I choose?” and gives no direct answer to “When does it apply?” That meets the framework’s High threshold for a central decision/result made systematically incomprehensible.

### Correction direction and verification

- Store a stable player-facing selection summary with the pending and resolved intent.
- Render the selected choice label, optionally followed by a clearly secondary target.
- Add explicit status text such as `Selected — revisable until End Day`.
- Keep the internal verb out of default player copy.

Regression coverage should select choices whose verbs are `upgrade`, `promote`, and `blame`, then assert the pending confirmation, revised confirmation, closing report, and historical report all preserve the visible choice wording.

---

## P6-COMP-002 — Delayed choices have no pending ledger or completion attribution

**Status:** Confirmed runtime defect  
**Category:** Causality or explanation gap  
**Secondary tags:** Delayed feedback; report omission; lifecycle discontinuity  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Systems:** P3, P4, P6

### Expected

A choice that advertises a later effect should enter a visible lifecycle:

```text
promised → pending with timing/origin → applied or expired → reported as resolved
```

The player should be able to tell what is waiting, roughly when it will happen, and which earlier decision caused the completion.

### Observed

Two independent paths failed:

1. **Main Room project**
   - Selection preview named +20 Condition and -10 Maintenance later.
   - No due day, progress ledger, or persistent pending entry appeared.
   - Completion arrived as two separate report deltas without the project or originating Day 2 choice.

2. **Response future effects**
   - Canonical replay held four pending entries with explicit scheduled days.
   - “What might happen” remained empty.
   - Two entries later applied while the report still exposed no future-hook line.

### Confirmed source cause

Pending response entries include timing and origin, but the Daily Report’s future section only projects already-created `future_hook` memories from the closed day. It does not project the response pending queue.

The project and response systems also lack a shared player-facing completion record that links a later diff to its original commitment.

### Impact

Delayed consequences are a recurring part of card, project, venture, and social design. Without pending and completion attribution, the player cannot learn whether a strategic commitment succeeded or connect later state movement to their earlier choice.

### Correction direction and verification

- Add a pending-consequences projection containing origin label, selected action, expected effect, and due day/range.
- Keep it visible after the closing report and on subsequent mornings.
- Emit one named resolution entry when the effect applies, linking all related deltas.
- Distinguish applied, expired, superseded, and still-pending states.

Verification should cover at least one project, one delayed state effect, and one future-hook memory across selection, next-day revisit, due-day application, report archive, and reload.

---

## P6-COMP-003 — Cause drilldowns expose machine sources and debug metadata

**Status:** Confirmed runtime defect  
**Category:** Causality or explanation gap  
**Secondary tags:** Internal identifier leak; report explanation  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Systems:** C2, P4, R5

### Expected

The cause drilldown should explain a change in tavern language, identify relevant people or places by display name, and express relative importance in terms a player can use.

### Observed

The Coin drilldown included entries such as:

```text
customers.merchants.dish_ale
customers.local_goblins.dish_ale
service.tabs.local_goblins
weight 72
```

Other drilldowns displayed actor/location metadata as raw `kind/id` pairs. The UI did not explain what `weight` means or how it differs from the visible amount.

Duplicate causes remain the carried `P4-SEAM-001`; cross-actor evidence remains the carried `P5-PLAY-003`. This finding is narrower: even a correctly selected cause can be unreadable because its source and metadata are not translated.

### Confirmed source cause

Service and purchase producers store machine source strings. `CauseDrilldown` displays `cause.readable` verbatim, builds actor labels directly from reference kind and ID, and prints the numeric weight.

### Impact

Players can see that coin changed but cannot use the dedicated explanation surface to understand which group bought what, who left an unpaid tab, or why one cause mattered more.

### Correction direction and verification

- Humanize known cause-source families at the report projection boundary.
- Resolve actor and location references through entity labels.
- Replace raw weight with a labeled relative-contribution treatment or remove it from default display.
- Provide a safe generic sentence for unknown sources.

Test purchases, unpaid tabs, staff, room, pressure, and response causes with IDs that differ from their labels.

---

## P6-COMP-004 — Staff priorities hide effects and receive no outcome attribution

**Status:** Confirmed runtime defect  
**Category:** Player-comprehension failure  
**Secondary tags:** Strategic preview omission; feedback gap  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Systems:** S5, S6, P4, P6

### Expected

A sticky staff priority should explain its main benefit and tradeoff before selection, then provide enough Service/report feedback to show that the chosen focus contributed.

### Observed

The sheet exposed only priority names. After Nash changed from Clean to Prevent Fights:

- the plan summary said only `1 customised`;
- staff detail described the setting as sticky and mentioned `engine fallback`;
- Service and the Daily Report did not attribute any incident, mess, repair, tab, or satisfaction result to the priority.

The player could see that the radio choice persisted but could not answer what it would do or whether it worked.

### Confirmed source cause

The registry and service layer already contain structured effect tags and numeric modifiers. `StaffPrioritySheet` renders only `def.label`, and the report has no priority-contribution projection.

### Impact

Priorities are a repeatable strategic lever, not a cosmetic preference. Hiding both forecast and result prevents informed comparison and learning across days.

### Correction direction and verification

- Add one benefit and one tradeoff line per option, using player terms.
- Show the selected staff member and focus in the plan summary.
- Add a concise Service/report contribution such as fights deterred, tabs controlled, mess prevented, or speed/quality tradeoff.
- Avoid promising precision the service model cannot attribute; an honest directional summary is sufficient.

Test at least two priorities for one role and one priority each for cook, server, and cleaner/bouncer.

---

## P6-COMP-005 — “Spend owner time” advances the licence without spending or naming time

**Status:** Confirmed runtime defect  
**Category:** Surface-truth mismatch  
**Secondary tags:** Resource contract; venture progression  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Systems:** P1, P2, P3, S7

### Expected

If a choice says it spends owner time, it should state the amount, reduce the visible daily budget, and appear in the action/report ledger. If the venture step is intentionally free, its wording should not claim an owner-time cost.

### Observed

Selecting `Spend owner time on the licence`:

- showed no time amount;
- left the planner at six hours;
- created no owner action;
- advanced the venture from 0/2 to 1/2 on the next day.

### Confirmed source cause

The issue seed’s choice contract declares `costTypes: ['owner_time']`, but the selected consequence profile only increments venture progress and creates a memory.

### Impact

The player cannot compare this venture investment against six hours of operational actions. The wording implies an opportunity cost that does not exist in canonical state.

### Correction direction and verification

Choose one contract and enforce it end to end:

- deduct a named amount from the same daily time budget and report it; or
- remove the owner-time claim and present the choice as a free narrative commitment.

Verification should assert the card preview, Top Bar, planner, Segment C application, next-day venture progress, and report from one selection.

---

## P6-COMP-006 — Historical Daily Reports discard resolved choices

**Status:** Confirmed runtime defect  
**Category:** Report retention failure  
**Secondary tags:** Historical feedback; transient-state projection  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Systems:** P3, P4, R3

### Expected

A closed Daily Report should remain stable when revisited. Its decision ledger should preserve the choices that produced the reported outcomes.

### Observed

At Day 2 Closing, the report contained three resolved choices. After Day 3 began, reopening that same report showed none of them. Other report data remained visible.

This is separate from `P4-SEAM-002`, which attaches current-day missed opportunities to the prior report. Here, prior resolved choices disappear entirely.

### Confirmed source cause

ReportsScreen rebuilds the last report using current state. The resolved-intent projection reads transient `responses.resolvedToday`, which the next start-day hook clears.

### Impact

The report cannot serve as a learning record. A player comparing yesterday’s choices with today’s state sees outcomes without the decisions that preceded them.

### Correction direction and verification

Project and store closed-day report data from the closed result/state boundary, or archive the resolved-intent records with the report. Do not rebuild historical rows from current-day transient slices.

Regression coverage should compare the full report immediately after Closing, after Next Day, after several days, and after a supported reload.

---

## P6-COMP-007 — Implementation vocabulary leaks into default player surfaces

**Status:** Confirmed runtime defect  
**Category:** Presentation and terminology  
**Secondary tags:** Internal identifier leak; content consistency  
**Severity:** Low  
**Priority:** P3  
**Confidence:** High  
**Systems:** P2, P4, R5

### Expected

Default player surfaces should use stable tavern terms. Technical family names, state keys, traits, and implementation comments should remain in debug or explicitly advanced views.

### Observed

The live route exposed:

- default card tags such as `staff_arc` and `area_atmosphere`;
- card/context IDs such as `fumigate_cellar`;
- traits such as `cleanliness_negative`, `risk_positive`, and `merchant_sensitive`;
- memory keys such as `ogres_dismissed`;
- staff text containing `engine fallback`.

### Confirmed source cause

`familyTag()` returns `seed.family` unchanged, `CardRenderer` shows the tag when the preference is enabled, and `showSeedTags` defaults to true. Several context/detail projections pass stored identifiers or readable fields directly to the surface without a controlled vocabulary layer.

### Impact

Most surrounding content remains understandable, so the demonstrated impact is Low. The leaks nevertheless make first-contact cards and entity detail feel like diagnostic tooling and can obscure the intended meaning.

### Correction direction and verification

- Hide seed-family tags by default or map them to deliberate player labels.
- Centralize humanization for traits, memory definitions, actor references, and fallback descriptions.
- Keep raw IDs available only in a debug preference.

Run a vocabulary scan over default cards, reports, and detail sheets using representative IDs with underscores and internal role names.

---

## 7. Positive comprehension evidence

The audit also found strong patterns worth preserving:

- **Setup:** Advanced difficulty and deterministic-seed copy explain reproducibility without technical overload.
- **Fresh-day orientation:** Calendar, beat, forecast, pressures, and the bounded Morning hand establish the current situation quickly.
- **Owner-action previews:** Most actions show exact time, coin, stock/stat changes, target, affordability, and hidden tradeoffs before queueing.
- **Queue control:** Removal, order, and remaining time are visible.
- **Service outcome:** Patrons, coin, and incidents form a concise, legible result strip.
- **Owner-action report:** Applied actions are named and their immediate effects are usually accurate.
- **Next-day orientation:** Yesterday digest and “What’s building” help bridge one day into the next when their source data is present.
- **First-encounter hints:** Supplier, recipe, and other route hints are concise and appear near the relevant control.
- **Entity routes:** Tavern and World summaries make areas, stock, staff, recipes, projects, policies, groups, and regulars discoverable.
- **Targeted navigation:** A pressure action CTA can open the correct planner category.
- **Recovery:** The Tavern Log failure has a useful Go to Day escape, preventing the error surface from trapping the session.

These strengths show that the product already has a capable immediate-state and immediate-preview language. The largest gap is continuity across selection, resolution, later consequence, and historical review.

---

## 8. Additional bounded observations

These observations did not receive separate tracked IDs because their demonstrated impact was narrow or their intended design needs clarification:

| Observation | Phase 6 evidence | Recommended handling |
|---|---|---|
| Remaining-time rejection says `Budget full` | Two hours remained; a four-hour action was disabled | Prefer `Needs 4h · 2h left` |
| Zero-minute recipe toggle loses direction in queue | Queue said `Toggle Recipe On/Off Menu`; report later said Removed from Menu | Include `Remove Bowl of Stew from menu` in the quote |
| Daily reset appears as a negative outcome | Report showed `Time spent: 360 → 0 (−360)` | Exclude routine budget resets from outcome diffs or label them as a reset |
| Pressure scale and thresholds are unstated | Dashboard shows values/bands/trends without scale meaning; consequence copy appears only at danger | Add a concise scale/band explanation and next threshold |
| Pressure CTA suggestion context is global | Staff Loyalty CTA opened Social, but Suggested led with unrelated ale restock | Scope or visually separate source-specific remedies from global suggestions |
| Some Service prose is grammatically unnatural | Examples included `Packed a wide leap` and `Brought a wide leap` | Treat as content-quality work in Phase 7 unless it blocks meaning |
| Tavern identity age is ambiguous | World showed `day 2 open` while the Top Bar was Day 3 | Clarify whether this means completed days or current calendar day |

---

## 9. Targeted automated validation

Nine targeted Vitest files passed:

```text
Test files: 9 passed
Tests:      46 passed
```

Coverage included:

- card context projection;
- Day screen and CardDeck advance behaviour;
- ActionPicker;
- Staff Priority sheet;
- Cause Drilldown;
- Reports screen;
- Daily Report projection;
- response pending/application pipeline.

The passing tests confirm local rendering and state contracts. They do not invalidate the findings because current assertions do not require:

- choice-label fidelity across pending and report surfaces;
- explicit End Day finality copy;
- projection of the pending response queue into future feedback;
- origin-linked completion entries;
- humanized service source IDs and actor references;
- visible staff-priority tradeoffs or outcome attribution;
- owner-time deduction for the venture choice;
- report equality before and after the next start-day reset.

---

## 10. Carried findings that constrain comprehension

| Carried finding | Phase 6 relevance |
|---|---|
| `P2-RT-001` — Save serialization failure | Reproduced during setup exploration: Saves promised durable autosave, but hard reload returned to the title. It remains the controlling Critical/P0 trust failure. |
| `P2-RT-002` — Glossary duplicate ID crash | Help says terms can be opened, but the glossary surface does not appear. This blocks the intended vocabulary recovery route. |
| `P2-RT-003` — Populated Tavern Log duplicate-tag crash | The historical event route crashes; its Go to Day recovery works. |
| `P3-BHV-002` — Expedition commissioning unreachable | The expedition route remains non-actionable and communicates an implementation-oriented runner requirement on at least one surface. |
| `P3-DC-001` — Ignore and unanswered both read “Ignored” | The report still does not distinguish a deliberate refusal from inaction. |
| `P4-SEAM-001` — Duplicate significant pressure causes | Cause drilldowns repeated the same Fumigation cause; this compounds, but is separate from, `P6-COMP-003`. |
| `P4-SEAM-002` — Closed report uses current-day missed opportunities | Historical report content remains unstable in a second way; `P6-COMP-006` covers resolved choices disappearing. |
| `P4-SEAM-003` — Compact/rich pending snapshot split | Canonical delayed truth already has two representations; Phase 6 adds that neither forms a complete player-facing lifecycle. |
| `P4-SEAM-004` / `P5-PLAY-003` | Some card “Because” lines use unrelated staff, group, or area evidence, preventing reliable causal interpretation even when the prose is readable. |
| `P5-PLAY-001` — After-service planner says today but queues tomorrow | Current/next-day timing remains misleading outside the main Phase 6 route. |
| `P5-PLAY-002` — Satisfaction rows omit customer group | The Daily Report cannot answer which audience changed without opening each row. |
| `P5-PLAY-004` — Fix Root changes an unrelated room | The response label, cited cause, and applied target can disagree. |
| `P5-PLAY-005` — Stock warning invents demand | Procurement explanations can recommend an action using false recent context. |

---

## 11. Exit assessment and Phase 7 hand-off

The Phase F exit condition is met.

Across the core loop, a player can usually understand:

- the current day and beat;
- immediate resources and pressures;
- what most owner actions will cost and change;
- the immediate Service result;
- which route to visit next.

A player cannot yet reliably understand:

- the exact decision just selected;
- when that decision becomes final;
- which long-term effects are still pending;
- when a delayed effect should arrive;
- which earlier action caused a later completion;
- why several report metrics changed;
- what staff priorities do or whether they helped;
- whether a revisited report still represents the closed day.

Phase 7 can proceed using this Phase 6 truth. Its whole-experience evaluation should treat the following as established constraints rather than rediscovering them:

1. Immediate action preview is the strongest part of the loop.
2. Reactive-choice confirmation and historical decision memory are unreliable.
3. Delayed agency loses continuity between promise and resolution.
4. Causal drilldowns are not consistently player-readable.
5. Staff priorities are mechanically meaningful but experientially opaque.
6. Several carried runtime/seam defects further reduce trust in reports and recovery.

No Phase 7 work was run as part of this phase.
