# Goblin Tavern Gameplay Audit

## Phase 7 — Whole-Experience Evaluation

**Audit date:** 2026-07-26  
**Supplied snapshot:** `Goblin-Tavern-main (8).zip`  
**Public build:** <https://cigthepig.github.io/Goblin-Tavern/>  
**Framework:** `GAMEPLAY_AUDIT_FRAMEWORK.md`, Phase G  
**Controlled-run seed:** `phase7-integrated-shared`  
**Controlled-run difficulty:** Standard

---

## 1. Completion status

Phase 7 execution is complete for the supplied snapshot.

The evaluation followed the complete:

```text
Morning → Plan → Service → React → Closing Report → Next Morning
```

loop in the public build, continued that route across a weekly boundary, and compared it with shared-seed 28-day strategies that exercised proactive actions, staff priorities, reactive card choices, delayed effects, pressures, reports, and monthly rent.

The whole experience has a coherent and often satisfying daily skeleton. Immediate owner actions visibly alter service and later state, Service gives a compact result, and the strategy matrix produces materially different cash, patron, cleanliness, damage, morale, and reputation outcomes.

It is not yet reliable as a connected management experience. Two core economy paths violate state or cost contracts; the report can recommend knowingly harmful choices; response effects make the reported pressure state stale; recurring cards consume most of the daily attention budget; and planning links lose the concrete target that motivated the action.

Six new Phase 7 findings were confirmed:

| Finding | Severity | Priority | Primary player-facing impact |
|---|---:|---:|---|
| `P7-EXP-001` — “Pay what we owe” can spend unaffordable coin without paying the rent | **High** | **P1** | A nominally safe response repeatedly drives coin below zero, leaves rent unpaid, and can be selected again the next day |
| `P7-EXP-002` — Supplier pricing makes three ordinary restocks free | **High** | **P1** | Mushrooms, Ingredients, and Stew can be purchased in full-day quantities for zero coin, invalidating a central procurement tradeoff |
| `P7-EXP-003` — Missed-opportunity coaching recommends destructive blame and mock responses | **High** | **P1** | The report presents severe loyalty, morale, customer, reputation, rumour, and quit-risk damage as the action the player should have taken |
| `P7-EXP-004` — Reported pressures are calculated before responses change final state | **Medium** | **P1** | “What’s building” and the next morning’s Yesterday digest can disagree materially with the current pressure shown elsewhere |
| `P7-EXP-005` — The hand budget does not bound full-day decision load or family repetition | **Medium** | **P2** | A passive 28-day route averaged 5.61 cards and 31.82 choice buttons per day while five families repeated for 20–27 consecutive days |
| `P7-EXP-006` — Planning handoffs discard the affected stock or pressure target | **Medium** | **P2** | A suggestion to address a specific shortage opens a global target list, forcing the player to reconstruct the original problem |

No new Critical/P0 finding was established. The carried `P2-RT-001` save-loss failure remains the highest-severity obstacle to treating a long run as durable.

The Phase G exit condition is met: whole-loop conclusions below cite both the normal player route and the connected systems that produce the observed experience.

---

## 2. Evidence protocol

### 2.1 Normal player route

The public build was used through visible controls only. No browser storage, simulation state, or runtime objects were edited.

The Phase 7 continuation covered:

- a Day 6 Morning with six cards;
- a staff response, a stock response, and a policy response;
- a shortage-to-planner route;
- a zero-price Mushrooms restock, a Main Room clean, and an Ale restock;
- Service and the Day 6 report;
- a Day 7 Morning, five-card hand, and no-action/no-response day;
- Service, weekly settlement, the Day 7 report, and the weekly digest;
- the Day 8 Yesterday bridge and repeated issue cards;
- comparison of report pressure values with the current top-bar state;
- Tavern, World, planning, report, and recovery navigation.

The already-confirmed Tavern Log failure remained reproducible and was treated as carried `P2-RT-003`, not counted again.

### 2.2 Controlled integrated routes

The new audit-only fixture is:

```text
audit_workspace/fixtures/phase7-whole-experience-probes.ts
```

It uses the canonical segmented pipeline:

1. Segment A opens Morning.
2. A policy bot chooses owner actions and priorities from that Morning state.
3. Segment B resolves planning and Service.
4. The bot chooses responses from every card that remained resolvable after Service.
5. Segment C applies responses, periodic settlement, reports, validation, and calendar advance.

The primary comparison used eight strategies for 28 days each—224 integrated strategy-days—with one shared seed:

- no owner actions or responses;
- pseudo-random owner actions;
- clean-focused;
- profit-focused;
- merchant-focused;
- miner-focused;
- ignore-repairs;
- staff-friendly.

Additional probes isolated:

- effective supplier prices and repeated restocks;
- the debt/rent payment lifecycle;
- full-day card and rendered-choice load;
- report coaching selection;
- pre-response pressure snapshots versus post-response final state.

The fixture does not directly edit canonical state.

### 2.3 Method correction to the repository harness

The repository’s built-in strategy runner is useful for broad smoke coverage, but it is not a valid same-world response comparison:

- `src/sim/testing/balanceRuns.ts:26-44` defaults to a different seed for each bot and supplies only actions and staff priorities.
- `src/sim/testing/policyBots.ts:43-47` defines `chooseResponse`, but the built-in runner does not call it.
- `src/sim/testing/balanceRuns.ts:56-64` invokes that runner without a shared seed.

The Phase 7 fixture therefore uses one seed for every strategy and explicitly wires responses into Segment C. This is an audit-method note, not a player-facing defect.

### 2.4 Interpretation limits

- The public route reached Day 8; the 28-day comparisons are deterministic simulations rather than claims about every possible human strategy.
- Once a route first produced invalid negative coin, its later numbers were retained as defect evidence but not treated as trustworthy balance evidence.
- The no-action route is a pressure test of optionality and pacing, not an assertion that a typical player will ignore every control.
- The public build and supplied snapshot agreed on the exercised paths, but no deployment commit identifier was exposed in the UI.

No product source was changed.

---

## 3. Whole-loop evaluation

### 3.1 Loop scorecard

| Loop stage | What works | What weakens the experience | Assessment |
|---|---|---|---|
| **Morning** | Day, beat, forecast, pressures, Yesterday context, and a bounded visible hand establish the situation quickly | Stale Yesterday pressure values and near-daily repeats can make the new day feel like re-reading unresolved administration | **Coherent but increasingly noisy** |
| **Plan** | Owner time, queued actions, targets, costs, and most immediate previews create concrete operational agency | Source-specific suggestions become generic actions; free restocks invalidate coin tradeoffs; some carried action mappings are unrelated to the originating problem | **Mechanically meaningful, contextually unreliable** |
| **Service** | Patron count, coin, incidents, stock consumption, and reportable state changes give the day a recognizable payoff | The compact outcome cannot by itself explain which priority, policy, or social choice caused the result | **Strong immediate beat** |
| **React** | Cards expose social, policy, staff, customer, and long-horizon tradeoffs with broad consequence profiles | Affordability is not enforced across responses; delayed lifecycle feedback is carried-broken; the volume can exceed 30 visible choices per day | **High potential, excessive and unsafe** |
| **Report** | Coin movement, owner actions, stock changes, periodic summaries, and many direct effects are useful | Pressure snapshots can be stale, destructive options are framed as missed opportunities, and carried cause/history defects undermine learning | **Rich but not authoritative** |
| **Next plan** | Yesterday and “What’s building” attempt to turn results into priorities | The values can contradict current state, and the planner drops the affected entity before target selection | **Correct intent, broken handoff** |
| **Week/month** | Weekly digests appeared on Days 7/14/21/28 and the monthly digest on Day 28 in controlled play | Monthly rent can be “paid” repeatedly without changing rent state and can invalidate the route | **Cadence works; settlement contract does not** |

### 3.2 Normal-route diary

#### Day 6: a strong operational loop with a broken price

The day began with six cards. The player backed a staff member, selected a stock response, and modified a policy response. The planning suggestions included a generic `Restock Item`.

Opening it exposed all 20 stock targets. Nothing identified the shortage that had motivated the suggestion. Mushrooms, Ingredients, and Stew showed zero-price supplier quotes.

The plan queued:

- Restock Mushrooms, +40 for `Coin -0`;
- Clean Main Room;
- Restock Ale.

Service then reported:

```text
52 patrons · +130 coin
```

The Daily Report connected much of the operational chain correctly:

- Coin: `988 → 1003` (`+15`);
- Mushrooms: `0 → 86`;
- Stock Shortage: `52 → 27`;
- Staff Loyalty Risk: `39 → 52`;
- the owner-action row explicitly recorded Mushrooms `0 → 40` and `coin -0`.

This is the experience at its best: a visible problem prompts a plan, the action changes stock, Service consumes resources, and the report names the result. The zero price and lost target context weaken the decision rather than erasing the surrounding loop.

The same report also showed Staff Loyalty Risk at 66 in “What’s building,” while the report’s final state and top bar showed 52.

#### Day 7: routine can continue, but feedback becomes contradictory

The next Morning repeated the report’s 66 value in the Yesterday digest even though the current pressure was still 52. The hand again contained staff-identity and policy material.

The player deliberately chose no owner action and no response:

```text
14 patrons · +13 coin · 1 incident
```

After wages, Coin moved from `1003 → 983` (`−20`). The weekly digest appeared at the correct boundary.

The report’s missed-opportunity section stated:

```text
Blame Mira the Resolute would have ended the Mira the Resolute incident.
```

The corresponding visible choice preview imposed:

- Loyalty `−20`;
- Morale `−12`;
- Respectability `−8`;
- Rumour `+6`;
- later Staff Loyalty Risk `+12`;
- a possible staff quit.

The same report showed Policy Backlash at 50 in “What’s building” while the final current value was 40.

#### Day 8: the bad snapshot crosses the day boundary

The Day 8 Yesterday digest described Policy Backlash as rising to 50. The current top-bar pressure remained 40. Staff and policy cards repeated again.

This demonstrates that the disagreement is not confined to one report widget. A pre-response pressure snapshot is carried into the next day as historical guidance after responses have already changed canonical state.

---

## 4. Agency, continuity, and strategic value

### 4.1 Relative agency

| Decision layer | Demonstrated agency | Current limitation |
|---|---|---|
| **Proactive owner actions** | Cleaning and repair routes materially improve area condition; merchant and profit routes alter patronage and cash; applied actions receive useful immediate report rows | Supplier prices can remove coin cost; pressure/suggestion routes lose their target; some mappings remain carried-misaligned |
| **Reactive card choices** | Responses alter staff, customers, reputation, pressures, policies, memories, and future hooks; controlled routes resolve 161–198 responses in 28 days | Costs are not treated as one affordable portfolio; delayed consequences lack a visible lifecycle; report coaching ranks magnitude rather than benefit |
| **Staff priorities** | They are accepted as sticky strategy input and participate in Service | Their preview and result attribution remain carried `P6-COMP-004` |
| **Policies and recipes** | They participate in reputation, demand, price, complaint, and backlash loops | Policy backlash repeats heavily; off-menu stock can still dominate shortages under carried `P5-PLAY-005` |
| **Projects and ventures** | They create longer commitments and can apply later state effects | Pending/completion attribution remains carried `P6-COMP-002`; owner-time wording remains carried `P6-COMP-005` |
| **Expeditions** | The source contains a complete long-horizon subsystem | Normal player access remains blocked by carried `P3-BHV-002`, so it could not contribute practical Phase 7 agency |

Proactive action is currently the clearest form of agency because its target and immediate result often survive into the report. Reactive cards are broader and more consequential, but their affordability, volume, coaching, and delayed feedback are less dependable. Long-horizon systems exist mechanically but are the least legible as continuous player commitments.

### 4.2 Connected-system continuity

| Connection | Evidence | Result |
|---|---|---|
| Operational shortage → owner action → Service → stock/report | Day 6 Mushrooms shortage, restock, Service consumption, and owner-action report | **Works**, except price and target context |
| Staff/social state → card → response → later pressure | Staff cards carry immediate and delayed loyalty consequences | **Mechanically connected**, but delayed status and coaching are misleading |
| Causes/state → calculated pressure → report | Pressure module calculates from the day and reports snapshots | **Breaks after responses**, because the snapshot is not reconciled |
| Report insight → next-day priority → planner | Yesterday and “What’s building” lead toward Plan | **Partly works**, but stale values and dropped targets force reinterpretation |
| Policy/recipe state → demand/complaint/identity | Strategy routes reach four identity combinations and distinct patron totals | **Material**, though dominant audience remains invariant |
| Monthly obligation → response/payment → settlement | Debt card offers a safe payment and monthly rent later resolves | **Broken**, because the card payment and monthly rent state are separate contracts |

### 4.3 Which decisions matter

The matrix and live route show that the following are materially consequential:

- cleaning and repair;
- demand/merchant focus;
- profit-oriented pricing/action choices;
- staff-friendly responses;
- policy and reputation responses;
- stock procurement;
- the decision to answer or leave issue families unresolved.

Some interactions can be ignored without stopping day progression, but not without experiential change. The 28-day no-action route still ended with positive coin, yet produced:

- only 828 patrons;
- average customer satisfaction of 0;
- average cleanliness of 38.33;
- Staff Loyalty Risk and Rumour Pressure at 100;
- a `filthy+goblinAuthentic` identity.

That route shows the loop is permissive rather than empty: ignoring management does not halt the calendar, but it creates a substantially different tavern. Whether it should eventually produce a hard failure is a design question because the current design document explicitly describes an endless game without a win condition.

---

## 5. Shared-seed strategy comparison

### 5.1 Results

All rows used `phase7-integrated-shared` for 28 Standard days.

| Strategy | Final coin | Patrons | Actions | Responses | Final identity | Avg satisfaction | Avg cleanliness | Avg damage | Avg morale | Valid throughout |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| No owner actions | 1,043 | 828 | 0 | 0 | filthy + goblin-authentic | 0.00 | 38.33 | 19.00 | 58.00 | Yes |
| Pseudo-random owner | 942 | 982 | 28 | 0 | filthy + goblin-authentic | 7.11 | 55.78 | 7.67 | 60.00 | Yes |
| Clean-focused | **−473** | 1,249 | 72 | 163 | filthy + respectable | 28.33 | **77.00** | **2.33** | 69.00 | **No; first failure Day 23** |
| Profit-focused | **4,006** | 967 | 39 | 186 | cozy + goblin-authentic | 0.00 | 38.33 | 19.67 | 60.33 | Yes |
| Merchant-focused | 810 | **1,618** | 70 | 161 | cheap + goblin-authentic | 30.11 | 64.00 | 12.11 | **99.67** | Yes |
| Miner-focused | 1,068 | 1,244 | 30 | 198 | filthy + goblin-authentic | 7.11 | 69.44 | 5.56 | 57.33 | Yes |
| Ignore repairs | 417 | 1,042 | 29 | 192 | filthy + goblin-authentic | 1.11 | 38.33 | **23.11** | 76.67 | Yes |
| Staff-friendly | **−323** | 1,330 | 60 | 164 | filthy + respectable | **31.33** | 76.56 | 8.44 | 76.00 | **No; first failure Day 25** |

The final-coin spread was 4,479 and four identity combinations emerged.

### 5.2 Interpretation

No one strategy dominated every measured objective:

- profit focus produced by far the most coin but no average customer satisfaction;
- merchant focus produced the most patrons and highest morale;
- clean focus produced the cleanest, least-damaged rooms;
- staff focus produced the highest satisfaction;
- ignoring repair preserved some cash but produced the most damage;
- the no-action route remained solvent but accumulated severe soft-state failures.

This is strong evidence that the simulation contains real strategic differentiation.

Two limitations prevent a balance verdict:

1. Clean-focused and staff-friendly routes became schema-invalid when response costs drove coin negative. Results after their first invalid day are defect traces, not trustworthy balance outcomes.
2. Every strategy retained `local_goblins` as the dominant customer group. The identity axes changed, but audience leadership did not. Whether that is intended starter-world stability or insufficient strategic audience differentiation requires design clarification.

---

## 6. Pacing, repetition, and feedback continuity

### 6.1 Full-day decision load

The passive 28-day route exposed the union of the Morning hand and every additional card surfaced at the Service pause.

| Measure | Result |
|---|---:|
| Cards per day, minimum | 2 |
| Cards per day, maximum | 7 |
| Cards per day, average | 5.61 |
| Cards over 28 days | 157 |
| Rendered choice buttons per day, minimum | 6 |
| Rendered choice buttons per day, maximum | 40 |
| Rendered choice buttons per day, average | 31.82 |
| Rendered choice buttons over 28 days | 891 |

The first week escalated as follows:

| Day | Cards | Rendered choices |
|---:|---:|---:|
| 1 | 2 | 6 |
| 2 | 4 | 19 |
| 3 | 5 | 24 |
| 4 | 6 | 30 |
| 5 | 7 | 38 |
| 6 | 7 | 38 |
| 7 | 6 | 35 |

The six-card generation budget in `src/sim/modules/issues/handBudget.ts:27-78` applies to one ranked hand. A Service card can raise the full-day union to seven. It does not constrain the number of choices rendered across those cards.

### 6.2 Family repetition

| Issue family | Days exposed | Longest consecutive-day streak |
|---|---:|---:|
| Area atmosphere | 27 | 27 |
| Customer complaint | 27 | 27 |
| Staff identity | 25 | 25 |
| Stock shortage | 25 | 25 |
| Policy backlash | 20 | 20 |
| Seasonal arc | 13 | 3 |
| Debt/rent | 6 | 6 |
| Opening | 5 | 5 |
| Staff arc | 5 | 4 |
| Violence | 4 | 1 |

The recency mechanism in `src/sim/modules/issues/seedRotation.ts:14-30` penalizes a recently used entity inside a family. It does not suppress the family itself. The result is subject rotation without experiential rotation: the player can receive a new room, group, staff member, or stock item under the same decision pattern on nearly every day.

Persistent unresolved problems should remain visible. The weakness is that persistence is presented as a fresh multi-choice workload rather than an evolving issue state with explicit escalation, continuity, or a lower-attention reminder mode.

### 6.3 Pressure discontinuity

Every response-heavy strategy produced report pressure values that disagreed with final state:

| Strategy | Mismatched rising-pressure rows | Largest absolute difference |
|---|---:|---:|
| Clean-focused | 35 | 74 |
| Profit-focused | 15 | 75 |
| Merchant-focused | 26 | 66 |
| Miner-focused | 11 | 71 |
| Ignore repairs | 42 | 62 |
| Staff-friendly | 33 | 59 |

Examples include:

- clean-focused Day 6 Stock Shortage: report 74, final state 19;
- profit-focused Day 7 Policy Backlash: report 51, final state 0;
- staff-friendly Day 7 Staff Loyalty Risk: report 83, final state 52.

The public route independently showed smaller but directly visible contradictions: Staff Loyalty Risk 66 versus 52 and Policy Backlash 50 versus 40.

### 6.4 Coaching quality

Across the passive route, 34 missed-opportunity selections contained an adverse relationship/reputation effect or used the `blame` verb:

- 29 selected `blame`;
- 5 selected `rebrand`, usually policy repeal with a secondary downside.

The 29 blame selections are the decisive defect evidence. Representative recommendations were:

- `Mock the complaint` for Ogres, with Satisfaction −15, Loyalty −10, Respectability −6, Rumour +8, Cultural Tension +6, and possible boycott;
- `Blame Nash`, with Loyalty −20, Morale −12, Respectability −8, Rumour +6, later Loyalty Risk +12, and possible quitting;
- the live `Blame Mira` recommendation with the same destructive staff pattern.

The report is identifying the largest modeled event, not the best foregone opportunity.

---

## 7. New Phase 7 findings

## P7-EXP-001 — “Pay what we owe” can spend unaffordable coin without paying the rent

**Status:** Confirmed runtime defect  
**Category:** Core economy and state-integrity failure  
**Secondary tags:** Response affordability; monthly settlement; repeated invalid state  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Primary owner:** Responses / monthly economy  
**Systems:** P2, P3, S2, S8, C2

### Expected

The safe/costly response `Pay what we owe` should:

1. be selectable only when its payment is affordable under the game’s response-cost policy;
2. deduct the amount once;
3. mark the corresponding rent obligation paid or reduce arrears;
4. prevent the same obligation from being offered as unpaid again;
5. preserve the `coin >= 0` state invariant.

If several responses are committed together, the set should be validated atomically or an explicit priority/rejection policy should prevent aggregate overspend.

### Observed

On Day 23 of an unedited clean-focused route:

- Coin before responses: 98;
- monthly rent amount: 120;
- `paidThisMonth`: false;
- arrears: 0;
- the choice `Pay it down clean` was enabled;
- its mechanical preview said `Coin -120`;
- selected immediate response costs totaled 183;
- final Coin became −85;
- state validation failed at `coin`;
- `paidThisMonth` remained false and arrears remained 0.

The same payment was selected again on Days 24–28. It deducted another 120 coin each time and still did not mark rent paid. The route ended Day 28 at −473 coin, then monthly settlement added one missed payment and 120 arrears.

The staff-friendly route independently became invalid on Day 25: 179 coin faced 198 of selected response costs and ended at −19.

### Connected source cause

- The debt/rent generator is active when debt/landlord pressure or low coin qualifies it: `src/sim/modules/issues/issueSeedGenerators.ts:2585-2607`.
- The `pay` slot promises `clear arrears` and `spend coin`: `issueSeedGenerators.ts:2609-2624`.
- Its profile only applies Coin −rent, Landlord −15, and Debt −10; it does not update monthly rent state: `issueSeedGenerators.ts:2678-2690`.
- Card choices are disabled only when a template supplies `disabledReason`: `src/cards/cardHelpers.ts:175-218` and `web/src/lib/cards/CardRenderer.svelte:106-136`.
- Response coin effects call `spendCoin`: `src/sim/modules/responses/ctxApplier.ts:157-170`.
- `spendCoin` validates the sign of the request but not affordability: `src/sim/modules/stock/ledger.ts:63-83`.
- `modifyCoin` applies the delta without a floor: `src/sim/core/engine.ts:942-951`.
- Canonical state requires non-negative coin: `src/sim/state/schemas.ts:765-769`.
- The monthly rent resolver already contains the correct affordability and paid/arrears state transition: `src/sim/modules/monthly/rent.ts:15-98`.

### Impact

This invalidates a central long-horizon obligation and the route advertised as the responsible response. It can corrupt the economy for every later day, repeatedly charges for one unpaid obligation, and makes clean/staff strategy outcomes unusable for balance evaluation.

### Correction direction and verification

- Route the card payment and monthly settlement through one shared rent-payment transition.
- Make the response update `paidThisMonth`, arrears, history, memory, and pressure consistently.
- Enforce affordability before intent selection and again atomically when the day’s response portfolio resolves.
- Reject, defer, or prioritize unaffordable intents with a player-readable result; never silently violate the schema.
- Add a ledger guard or transaction boundary so no ordinary spend path can make coin negative.

Regression coverage should include:

- 119, 120, and 121 coin against 120 rent;
- one rent response with no other choices;
- several individually affordable choices whose aggregate is unaffordable;
- repeated days after a successful payment;
- the Day 28 monthly boundary;
- report, history, memory, pressure, and reload continuity.

---

## P7-EXP-002 — Supplier pricing makes three ordinary restocks free

**Status:** Confirmed runtime defect  
**Category:** Core economy and strategy invalidation  
**Secondary tags:** Supplier pricing; procurement; zero cost  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Primary owner:** Supplier pricing / owner actions  
**Systems:** S4, S7, S9, P4

### Expected

An ordinary supplier’s “cheap” price bias should reduce the cost while preserving a meaningful procurement tradeoff. A standard restock of common service goods should not become free unless a deliberate promotion, barter, gift, or other zero-price rule is surfaced.

### Observed

The public Day 6 plan quoted and applied:

```text
Mushrooms +40 · Coin -0
```

The report repeated `coin -0`.

The isolated probe confirmed:

| Item | Base price | Cheapest supplier bias | Effective unit price | +40 cost |
|---|---:|---:|---:|---:|
| Mushrooms | 1 | −1 | 0 | 0 |
| Ingredients | 1 | −1 | 0 | 0 |
| Stew | 2 | −2 | 0 | 0 |

Six Mushrooms restocks in one planning day:

- used all 360 owner minutes;
- applied all six orders;
- delivered 240 units before Service consumption;
- reported zero owner spend;
- produced no rejected order.

The day still spends owner time, but coin—the central procurement constraint—is absent.

### Connected source cause

- Mushrooms and Ingredients have base price 1; Stew has base price 2: `src/sim/registries/stockRegistry.ts:37-99`.
- Brakka Mushroom Cart has price bias −1 for Mushrooms/Ingredients; Scrap Meat Vendor has −2 for Stew: `src/sim/content/suppliers/supplierRegistry.ts:18-69`.
- Supplier selection clamps the effective price at 0 and selects the lowest price first: `src/sim/modules/suppliers/pricing.ts:110-140`.
- Restock cost is `ceil(amount × unitPrice)`, then applied and reported as that value: `src/sim/modules/ownerActions/actionDefinitions.ts:261-399`.

### Impact

Mushrooms and Stew are core service goods, and Ingredients are a general food input. Free bulk procurement undermines shortage recovery, supplier reliability/relationship tradeoffs, sale margins, and the relative value of expeditions or alternate sources.

### Correction direction and verification

- Establish a positive minimum unit price for ordinary purchases, or model explicit zero-price events separately.
- Decide whether price bias is additive coin, percentage, or tier-based; make the unit contract impossible to zero unintentionally.
- Consider supplier choice as a tradeoff among total cost, reliability, timing, relationship, and quality rather than unconditional cheapest price.
- Never render `Coin -0`; omit a genuine no-cost chip or explain why it is free.

Regression coverage should enumerate every stock/supplier/market-condition combination and assert:

- a valid minimum price;
- accurate quote/application/report agreement;
- affordability at boundaries;
- missed-delivery no-charge behavior;
- relationship changes;
- no free core item without an explicitly authored free-price rule.

---

## P7-EXP-003 — Missed-opportunity coaching recommends destructive blame and mock responses

**Status:** Confirmed runtime defect  
**Category:** Strategic feedback and recommendation failure  
**Secondary tags:** Sign-insensitive ranking; harmful coaching; report trust  
**Severity:** High  
**Priority:** P1  
**Confidence:** High  
**Primary owner:** Daily Report / response scoring  
**Systems:** P2, P3, P4, C2

### Expected

A section labeled as missed opportunities should identify a choice that would plausibly improve the situation under an explicit objective, or clearly describe a tradeoff. It should not present the most destructive option as the recommended resolution merely because that option has a large absolute effect.

### Observed

The public report said blaming Mira “would have ended” her incident despite the visible preview imposing major immediate and delayed damage.

The 28-day passive route selected 29 `blame` responses as missed opportunities. Examples included:

- mocking Ogres into lower satisfaction and loyalty, lower respectability, higher rumour/cultural tension, and a possible boycott;
- blaming Nash or Mira into −20 loyalty, −12 morale, lower respectability, higher rumour, +12 later loyalty risk, and possible quitting.

The grammar also produced `would have ended the the Ogres incident`, but the substantive defect is the strategic recommendation.

### Connected source cause

- The report chooses the non-ignore slot with the highest `impactScore`: `src/reports/missedOpportunityProjection.ts:200-265`.
- Impact scoring uses `Math.abs(effect.amount)` for immediate and delayed effects, so severe harm scores as strongly as severe benefit: `src/sim/modules/issues/impactScoring.ts:33-51`.
- The staff blame profile contains the demonstrated loyalty, morale, reputation, rumour, loyalty-risk, and quit effects: `src/sim/modules/issues/expandedSeedGenerators.ts:521-550`.
- The customer mock profile contains the demonstrated customer, reputation, rumour, tension, and boycott effects: `src/sim/modules/issues/issueSeedGenerators.ts:1689-1728`.

### Impact

The report is intended to teach the player how decisions relate to outcomes. Systematically praising harmful choices reverses that learning loop and makes one of the primary retrospective surfaces strategically unsafe.

### Correction direction and verification

- Separate effect magnitude from desirability.
- Evaluate candidate choices against the issue’s declared `solves`, `doesNotSolve`, costs, and the player’s visible strategy where available.
- Exclude intentionally harmful, spiteful, or escalation options from default “missed opportunity” coaching unless the report names the objective and tradeoff honestly.
- Prefer language such as `A forceful alternative was available` when no universally beneficial option exists.
- Fix article/subject composition independently.

Regression tests should prove that:

- blame/mock does not outrank a lower-magnitude beneficial response by default;
- negative effects reduce recommendation utility;
- mixed choices are described as tradeoffs;
- strategy-specific coaching names the strategy;
- report copy never implies an adverse option simply “would have resolved” the issue.

---

## P7-EXP-004 — Reported pressures are calculated before responses change final state

**Status:** Confirmed integration defect  
**Category:** Cross-phase state/report discontinuity  
**Secondary tags:** Stale snapshot; Yesterday bridge; response attribution  
**Severity:** Medium  
**Priority:** P1  
**Confidence:** High  
**Primary owner:** Pressure lifecycle / Daily Report  
**Systems:** C2, P3, P4, S1

### Expected

The closing report and next-day Yesterday digest should describe the same final pressure state the player carries into the next Morning. If a response raises or lowers a pressure after its initial calculation, reporting should reconcile the snapshot or clearly distinguish `before response` from `after response`.

### Observed

Public route:

- Staff Loyalty Risk: report/Yesterday 66, current/final 52;
- Policy Backlash: report/Yesterday 50, current/final 40.

Controlled routes produced 11–42 mismatched rising-pressure rows each, with maximum differences of 59–75. Both directions occurred:

- a report could warn about pressure a response had already removed;
- a report could understate pressure a response had just increased.

### Connected source cause

- Pressures calculate and store snapshots during `closing`: `src/sim/modules/pressures/pressureModule.ts:192-245` and `403-416`.
- The phase order runs `closing` before `applyResponses`: `src/sim/core/phases.ts:71-90`.
- Responses can then mutate pressure, but the pressure report reads the stored snapshots: `src/reports/dailyReportProjection.ts:709-737`.

The final canonical pressure is correct for the exercised routes; the report snapshot is stale.

### Impact

Pressures are the bridge among simulation state, cards, reports, and next planning. Contradictory values cause the player to plan against conditions that may no longer exist and obscure whether their response worked.

### Correction direction and verification

Choose and expose one coherent contract:

- recalculate/reconcile pressure snapshots after responses; or
- report both the pre-response pressure and the response-adjusted final value with explicit labels.

The final report, “What’s building,” Yesterday digest, top bar, pressure detail, and next-day card gates should all derive from the same post-response truth.

Regression coverage should include one response that:

- lowers a rising pressure to zero;
- raises a pressure into a new band;
- changes several pressures;
- schedules only a delayed pressure effect;
- crosses into the next Morning and a historical report.

---

## P7-EXP-005 — The hand budget does not bound full-day decision load or family repetition

**Status:** Confirmed gameplay-value defect  
**Category:** Pacing and repetition  
**Secondary tags:** Attention budget; recurring families; unresolved issue continuity  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Primary owner:** Issue triage / card UX  
**Systems:** P1, P2, P6

### Expected

Unresolved problems may persist and escalate, but the daily loop should keep the total attention burden legible. Repeated issues should communicate continuity and changed stakes rather than appear as a fresh full choice set every day.

### Observed

The passive Standard route averaged:

- 5.61 exposed cards per day;
- 31.82 rendered choice buttons per day;
- 891 choice buttons over 28 days.

By Day 5, the loop had reached seven cards and 38 choices. Area atmosphere and customer complaints appeared for 27 consecutive days; staff identity and stock shortage for 25; policy backlash for 20.

The public Day 7–8 route independently repeated staff-identity and policy cards immediately across mornings.

### Connected source cause

- The default hand budget caps one ranked generation pass at six seeds: `src/sim/modules/issues/handBudget.ts:27-78`.
- Morning and Service exposures can form a seven-card full-day union.
- Recency rotates the selected entity inside a family but does not cool down the family: `src/sim/modules/issues/seedRotation.ts:14-30`.
- Every recurring seed continues to render its complete choice set plus generic Ignore where needed.

### Impact

The player’s meaningful management decisions compete with 30–40 reactive buttons and repeated issue shapes. Weekly/monthly events become additions to routine workload rather than a change of cadence, and persistence is experienced as repetition rather than consequence.

### Correction direction and verification

- Add a full-day attention budget across Morning and Service, not only a per-generation seed cap.
- Introduce family-level cooldowns, escalation thresholds, or material-change gates.
- Represent unresolved continuity as one evolving issue with prior choice/status, not a fresh incident when little changed.
- Separate urgent decisions from optional acknowledgements and low-attention reminders.
- Preserve teleology/periodic reserves while preventing them from simply expanding total load.

Long-run tests should assert:

- maximum full-day card and rendered-choice counts;
- family-level consecutive-day limits unless severity materially changes;
- persistent-issue continuity labels;
- room for weekly/monthly/teleology content;
- no starvation of genuinely urgent Service incidents.

---

## P7-EXP-006 — Planning handoffs discard the affected stock or pressure target

**Status:** Confirmed integration and usability defect  
**Category:** Report-to-action continuity  
**Secondary tags:** Target context; generic picker; redundant reconstruction  
**Severity:** Medium  
**Priority:** P2  
**Confidence:** High  
**Primary owner:** Planner suggestions / navigation store  
**Systems:** P4, P6, R3, R5, S7

### Expected

When a report, pressure, or suggestion identifies a concrete problem—such as Mushrooms being depleted—the resulting planning route should preserve that target, focus it, and quote the applicable action. The player should not have to rediscover the affected entity in a global list.

### Observed

On the public Day 6 route, a stock-driven suggestion led to `Restock Item`. Selecting it opened all 20 valid stock targets. The initiating shortage was not highlighted or preselected, and unrelated/off-menu items were mixed into the same list.

The route was technically completable, but it converted a specific recommendation into a generic action-definition lookup.

### Connected source cause

- A cause drilldown CTA sends only category tab and focus flags: `web/src/lib/components/CauseDrilldown.svelte:77-94`.
- `requestActionPicker` retains only `tab` and `focusSuggested`: `web/src/lib/sim/gameStore.svelte.ts:786-802`.
- `ActionPicker` receives only those fields: `web/src/lib/components/ActionPicker.svelte:43-64`.
- `suggestActions` derives the lost stock item and includes it only in the human-readable reason, then deduplicates by `actionId` and returns the action definition: `web/src/lib/sim/suggestActions.ts:57-104`.
- Tapping a targeted definition opens its complete global valid-target list: `web/src/lib/components/ActionPicker.svelte:180-229`.

### Impact

This adds redundant diagnosis to the most useful feedback loop:

```text
notice problem → ask why → plan remedy
```

It becomes especially costly when the picker includes invented/off-menu shortage targets under carried `P5-PLAY-005` or when a pressure maps to an only loosely related action under carried `P5-PLAY-004`.

### Correction direction and verification

- Extend suggested-action and picker-request payloads with a preferred `targetId`, source path, and reason.
- Open the target quote directly when one valid contextual target exists.
- Otherwise sort and highlight the contextual target while leaving alternatives available.
- Preserve the originating cause/pressure label through queue and report confirmation.
- Deduplicate by action-and-target where multiple shortages need separate remedies.

Regression coverage should exercise:

- one stock loss;
- several stock losses;
- area/pressure CTAs;
- unavailable or no-longer-valid preferred targets;
- off-menu items;
- returning to the source after queueing.

---

## 8. Positive whole-experience evidence

The audit found substantial strengths worth preserving:

- **Recognizable cadence:** Morning, Plan, Service, Report, and Next Day read as one tavern-management day.
- **Immediate operational agency:** Cleaning, repairing, restocking, pricing, and customer focus materially alter measured outcomes.
- **Compact Service payoff:** Patron, coin, and incident totals provide a strong beat between planning and reflection.
- **Applied-action truth:** Owner-action report rows usually name the target and actual immediate delta accurately.
- **Strategy differentiation:** One shared world produced a 4,479-coin spread, four identity combinations, and clear tradeoffs among cash, patrons, satisfaction, cleanliness, damage, and morale.
- **No universal dominant strategy:** Profit, merchant, clean, and staff routes each led a different measured objective before invalid-state contamination.
- **Periodic cadence:** Weekly summaries appeared exactly on Days 7, 14, 21, and 28; the monthly summary appeared on Day 28.
- **Broad systemic reach:** Operations, staff, customers, suppliers, policies, reputation, pressures, memories, periodic settlement, cards, and reports all participate in the loop.
- **Deterministic auditability:** Shared seeds and segmented execution make cross-strategy comparisons reproducible.
- **Recovery:** The carried Tavern Log crash still offered a usable return to Day rather than trapping the session.

These strengths make the Phase 7 defects particularly actionable: the experience does not need a new core loop. It needs consistent contracts and a lighter, more trustworthy bridge among the existing stages.

---

## 9. Design clarification needed

These are questions, not automatic defects.

### 9.1 What is the player-facing long-term objective?

`docs/plans/game-loop-and-ux.md:506-514` says there is no win condition and the late game continues until the player stops. The product should clarify:

- whether the experience is primarily an endless sandbox, survival story, score chase, or self-authored tavern identity;
- which outcomes the player is invited to optimize;
- how success should be reflected without a win screen.

### 9.2 What is the intended failure contract?

The no-action route remained coin-positive while several social/pressure values reached 100. The design document mentions bankruptcy and eviction, but the current evaluated loop did not expose a clear terminal or recovery contract.

Clarify whether:

- severe pressures should eventually force closure, staff loss, customer collapse, or another hard state;
- soft deterioration without termination is intentional;
- recovery from debt, eviction risk, or a failed social state is a primary play style.

### 9.3 Should strategic audience identity change?

All eight strategies retained `local_goblins` as the dominant customer group despite large differences in actions, responses, patrons, satisfaction, and reputation identity.

Clarify whether dominant audience stability is:

- intended for the starter tavern;
- expected to change only after longer progression;
- intended to be a strategic outcome within the first month.

### 9.4 How much reactive workload is intended?

Is the target experience:

- a small set of consequential daily incidents;
- a broad inbox where most cards are safely optional;
- persistent issue management with explicit escalation?

The answer should set a measurable full-day card/choice budget and determine whether repeated families should recur, stack, or collapse into evolving threads.

### 9.5 Are card responses one portfolio or independent commitments?

Multiple responses are selected independently before Segment C. Clarify whether the player should:

- budget their combined coin/time/resource cost during selection;
- choose one response per day or per category;
- submit all choices and accept explicit priority-based rejection;
- be allowed debt through a modeled credit system.

The current implicit answer—apply every cost and validate afterward—is not viable.

### 9.6 What parity is intended among long-horizon systems?

Policies, projects, ventures, recipes, rent, and expeditions do not currently receive equal practical agency or feedback. Clarify which are intended as core first-month strategies and which are later or optional content.

---

## 10. Carried findings that constrain the whole experience

Phase 7 did not duplicate earlier findings. The following remain active dependencies:

| Carried finding | Whole-experience constraint |
|---|---|
| `P2-RT-001` — save/hydration failure | Long runs cannot be treated as durably recoverable |
| `P2-RT-002`, `P2-RT-003` — glossary and Tavern Log crashes | Explanation/history routes remain incomplete |
| `P3-BHV-001` — inline policy toggles | Policy state can bypass the intended action/time contract |
| `P3-BHV-002` — expedition commissioning unreachable | A major long-horizon procurement strategy cannot be evaluated in normal play |
| `P3-DC-001` — unanswered and explicit Ignore collapse | The player cannot express distinct forms of inaction |
| `P4-SEAM-001` through `P4-SEAM-005` | Duplicate causes, report-day leakage, delayed split, unrelated staff causes, and arc projection weaken continuity |
| `P5-PLAY-001` — planner timing | Planning suggestions can arrive after the actionable beat |
| `P5-PLAY-002` through `P5-PLAY-005` | Satisfaction attribution, cross-actor causes, unrelated repair targeting, and off-menu shortages distort practical decisions |
| `P6-COMP-001` through `P6-COMP-007` | Choice language, delayed lifecycle, raw causes, priorities, owner-time cost, report history, and vocabulary remain comprehension gaps |

Priority dependencies:

1. Repair persistence before relying on longitudinal player testing.
2. Restore state/economy invariants before balance tuning.
3. Restore report truth before using player-facing reports as evaluation evidence.
4. Repair target/context and delayed-lifecycle seams before judging the final strategic UX.

---

## 11. Automated validation

### 11.1 Type validation

Passed:

```text
npm run typecheck
```

The Phase 7 fixture also passed an isolated strict TypeScript check with:

- `strict`;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- `isolatedModules`.

### 11.2 Targeted regression suite

Passed:

```text
Test Files  11 passed (11)
Tests       103 passed (103)
```

Covered files:

- `tests/sim/phase41.responsePipeline.test.ts`
- `tests/sim/phase84.supplierPricingDelivery.test.ts`
- `tests/sim/phase94.restockSupplierPricing.test.ts`
- `tests/sim/phase97.missedOpportunityRoundtrip.test.ts`
- `tests/reports/missedOpportunityProjection.test.ts`
- `tests/reports/dailyReportProjection.test.ts`
- `tests/web/cardRenderer.mechanicalPreview.test.ts`
- `tests/web/components/actionPicker.test.ts`
- `tests/web/components/dayScreen.test.ts`
- `tests/web/phase193.actionPreviewsAndSuggest.test.ts`
- `tests/web/phase195.reportsActions.test.ts`

The passing tests confirm that the current implementation is internally consistent with its existing assertions. They do not invalidate the Phase 7 findings because the suite does not currently assert:

- aggregate response affordability;
- that the debt-card payment updates monthly rent state;
- a positive price floor for ordinary purchasable goods;
- desirability/sign in missed-opportunity selection;
- post-response pressure equality across report and final state;
- a full-day card/choice budget or family-level cooldown;
- preservation of a preferred target through report/pressure-to-planner navigation.

### 11.3 Reproducibility

All controlled findings reproduce from:

```text
node --import tsx ../../fixtures/phase7-whole-experience-probes.ts <probe>
```

Available probe names:

- `freeRestockProbe`
- `debtPaymentProbe`
- `pacingAndCoachingProbe`
- `pressureContinuityProbe`
- `strategyProbe`

---

## 12. Exit assessment and Phase 8 hand-off

Phase G is complete.

The evaluated experience is best summarized as:

> A materially interconnected tavern simulation with a strong day cadence and real strategic differentiation, currently undermined by broken resource contracts, unsafe retrospective coaching, stale post-response reporting, and excessive repeated decision load.

Recommended hand-off order for the next phase:

1. `P7-EXP-001` and `P7-EXP-002`: restore coin, rent, and procurement invariants.
2. `P7-EXP-003` and `P7-EXP-004`: make the report strategically and numerically trustworthy.
3. `P7-EXP-005` and `P7-EXP-006`: reduce attention cost and preserve problem-to-action context.
4. Re-run the shared-seed strategy matrix only after invalid-state paths are fixed.
5. Resolve the explicit design questions before treating survival, audience identity, or first-month strategy balance as defects.

Phase 8 prioritization was not executed here.

