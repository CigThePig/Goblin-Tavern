# Goblin Tavern Simulation — Expanded Plan: Phases 16–20

This document expands **Phases 16 through 20** of the simulation-first build plan.

**Phase 1 is complete.**  
**Phases 2–15 should already be complete or in progress before this batch begins.**

This final batch prepares the simulation for real card development.

By the end of Phase 20, the tavern simulation should be able to:

- Remember what happened.
- Explain why important state changes occurred.
- Track pressures and feedback loops.
- Generate structured issue seeds that future cards can present.
- Accept response intents that future cards can send back.
- Show the impact of possible player choices before card writing starts.
- Run cardless playtests using raw seeds and mechanical response previews.
- Prove that the game is ready for card development.

This batch is where the tavern learns to **speak**.

Still, do not write real cards in these phases.

The output of Phase 20 is not a card set.  
It is a card-ready simulation.

---

# Current Phase Status

## Phase 1 — Simulation Contract & Design Rules

**Status:** Complete.

Do not expand Phase 1 in this batch.

All work in this batch must obey the core rule:

> The simulation is truth. Cards will eventually present simulation truth, but cards must not invent truth.

---

# Phase 16 — Memory & History System

## Goal

Implement the tavern’s memory system so the simulation can remember incidents, facts, patterns, grudges, recent actions, and future hooks.

The tavern should stop being a sequence of isolated days and become a place with history.

## Why This Phase Matters

Cards cannot feel meaningful if the tavern forgets what happened.

Future cards need to know:

```txt
The player watered down ale last week.
The cook was blamed for spoiled stew.
Merchants stopped visiting after repeated filth.
The roof leak was ignored for twelve days.
Ogres broke the main room twice this month.
Rent was missed last month.
The privy received an inspector warning.
The same problem has appeared too often recently.
```

The memory system gives future issue seeds and cards continuity.

Without memory, the tavern becomes oatmeal in a mug.

## Memory Types

Implement several memory categories.

### 1. Fact Memory

A persistent truth.

Examples:

```txt
rat_treaty_signed
first_rent_paid
roof_repaired_once
merchant_trust_broken
```

Fact memories may last forever or until explicitly removed.

### 2. Timed Memory

A temporary but meaningful recent event.

Examples:

```txt
watered_ale_detected
recent_brawl
kitchen_cleaned_recently
stew_shortage_yesterday
```

Timed memories decay or expire.

### 3. Grudge Memory

A negative actor-specific memory.

Examples:

```txt
cook_publicly_blamed
merchants_mocked
ogres_overcharged
supplier_blamed_for_bad_mushrooms
```

Grudges should connect to actors.

### 4. Pattern Memory

A repeated trend or behaviour.

Examples:

```txt
repeated_ale_shortages
repeated_unpaid_wages
habitual_roof_neglect
merchant_decline_pattern
```

Pattern memories are created from repeated causes or events.

### 5. Future Hook

A delayed or conditional follow-up possibility.

Examples:

```txt
food_poisoning_rumor_possible
supplier_retaliation_possible
inspector_followup_possible
staff_quit_risk_possible
```

A future hook does not guarantee an event. It marks a possibility that issue seed generation can later inspect.

## Required Outputs

Create or update:

```txt
/src/sim/modules/memories/memoryModule.ts
/src/sim/modules/memories/memoryTypes.ts
/src/sim/modules/memories/memoryRegistry.ts
/src/sim/modules/memories/memoryQueries.ts
/src/sim/modules/memories/memoryDecay.ts
/src/sim/modules/history/historyLog.ts
/src/sim/modules/history/historyModule.ts
```

Exact file placement may vary based on previous phase structure, but the responsibilities must exist.

## Memory Shape

Recommended:

```ts
type Memory = {
  id: string;
  type: "fact" | "timed" | "grudge" | "pattern" | "future_hook";

  label?: string;

  createdAt: CalendarStamp;
  expiresAt?: CalendarStamp;

  ageDays: number;
  durationDays?: number;

  strength: number;       // 0–100
  decayRate?: number;

  actors: EntityRef[];
  locations: EntityRef[];
  relatedSystems: string[];

  tags: string[];

  source?: string;
  metadata?: Record<string, unknown>;
}
```

## Calendar Stamp

Create a stable calendar stamp type:

```ts
type CalendarStamp = {
  month: number;
  week: number;
  day: number;
  absoluteDay: number;
}
```

Use `absoluteDay` for easy aging.

## History Log Shape

The history log is not the same as memory.

Memory affects simulation.  
History records what happened for debugging and later summaries.

Recommended:

```ts
type HistoryEntry = {
  id: string;
  timestamp: CalendarStamp;
  category:
    | "owner_action"
    | "service"
    | "weekly"
    | "monthly"
    | "state_change"
    | "memory"
    | "pressure"
    | "system";

  summary: string;
  tags: string[];
  relatedActors: EntityRef[];
  relatedLocations: EntityRef[];
  relatedSystems: string[];

  mechanicalRefs?: string[];
}
```

The summary should be concise and debug-facing, not narrative prose.

Example:

```txt
Owner watered down ale. Ale quantity increased, ale quality decreased.
```

This is not a card. It is a record.

## Tasks

### 16.1 Add Memory Registry

Create a memory registry so memory definitions are not scattered.

A memory definition should include:

```ts
type MemoryDefinition = {
  id: string;
  type: Memory["type"];
  defaultDurationDays?: number;
  defaultStrength?: number;
  tags: string[];
  stacking?: "replace" | "stack" | "refresh" | "increase_strength";
}
```

Examples:

```ts
memoryRegistry.register({
  id: "watered_ale_recently",
  type: "timed",
  defaultDurationDays: 14,
  defaultStrength: 40,
  tags: ["stock", "ale", "deception", "customer_trust"],
  stacking: "increase_strength",
});
```

### 16.2 Add Memory Context API

Extend `SimContext` with:

```ts
ctx.addMemory(memoryDraft)
ctx.removeMemory(memoryId)
ctx.hasMemory(memoryId)
ctx.getMemoriesByTag(tag)
ctx.getMemoriesForActor(actorRef)
ctx.getMemoriesForLocation(locationRef)
ctx.getMemoryStrength(memoryId)
```

Do not make modules search raw arrays everywhere.

### 16.3 Add Memory Creation from Existing Systems

Add memory creation at obvious mechanical moments.

Examples:

Owner action memories:

```txt
water_down_ale -> watered_ale_recently
pay_staff_bonus -> staff_bonus_paid_recently
patch_roof -> roof_patched_recently
fumigate_cellar -> cellar_fumigated_recently
```

Weekly memories:

```txt
unpaid wages -> wages_unpaid_recently
paid wages -> wages_paid_recently
```

Monthly memories:

```txt
missed rent -> rent_missed_recently
paid rent -> rent_paid_recently
```

Service memories:

```txt
major brawl -> recent_brawl
ale shortage -> ale_shortage_recently
merchant satisfaction drop -> merchants_unhappy_recently
```

Keep the first pass simple.

### 16.4 Add Memory Aging and Expiration

At end of each day:

```txt
age timed memories
decay strength if applicable
expire memories if duration elapsed or strength reaches 0
```

Fact memories should not expire unless explicitly removed.

Future hooks may expire if not used.

### 16.5 Add Memory Stacking Rules

If the same memory is added repeatedly, do not blindly duplicate it unless stacking is intended.

Example behaviours:

```txt
replace:
  old memory replaced by new

refresh:
  duration resets

increase_strength:
  strength increases up to 100, duration may refresh

stack:
  multiple separate memories allowed
```

Use registry definitions.

### 16.6 Add Pattern Memory Detection

Add a small pattern detector.

Examples:

```txt
3 ale shortages in 14 days -> repeated_ale_shortages
3 days of unpaid wages or 2 unpaid weeks -> repeated_unpaid_wages
roof below threshold for 10 days -> habitual_roof_neglect
merchant satisfaction falling for 2 weeks -> merchant_decline_pattern
```

Pattern detection should run weekly at first.

### 16.7 Add Future Hook Support

Future hooks should be stored as memories of type `future_hook`.

Example:

```ts
ctx.addMemory({
  id: "food_poisoning_rumor_possible",
  type: "future_hook",
  strength: 35,
  durationDays: 7,
  tags: ["food_safety", "rumor", "customer_trust"],
  relatedSystems: ["stock", "customers", "inspection"],
});
```

Issue seed generation in Phase 19 will inspect these hooks.

### 16.8 Add History Logging

Add context helpers:

```ts
ctx.addHistory(entryDraft)
ctx.getRecentHistory(days)
ctx.getHistoryByTag(tag)
```

Add history entries for:

```txt
owner actions
major service results
weekly wage result
monthly rent result
major reputation shift
memory creation/expiration, if useful
```

### 16.9 Add Memory Report

Report:

```txt
active memories
new memories today
expired memories
strongest memories
pattern memories
future hooks
actor/location-specific memories
```

Example:

```txt
MEMORY REPORT

New:
- watered_ale_recently, strength 40, expires in 14 days.
- recent_brawl, strength 31, expires in 7 days.

Active Patterns:
- repeated_ale_shortages, strength 62.

Future Hooks:
- inspector_followup_possible, strength 44.
```

## Acceptance Criteria

Phase 16 is complete when:

- Memories can be created, queried, aged, stacked, and expired.
- Fact, timed, grudge, pattern, and future-hook memory types exist.
- Existing systems create basic memories at meaningful points.
- History log exists separately from memory.
- Memory reports are useful.
- Tests prove memory aging and pattern detection.
- No real cards are added.

## Tests

Minimum tests:

```txt
timed memory expires after duration
fact memory does not expire
memory refresh resets duration
memory increase_strength stacks strength up to 100
water_down_ale creates watered_ale_recently memory
unpaid wages creates wages_unpaid_recently memory
missed rent creates rent_missed_recently memory
repeated ale shortages create repeated_ale_shortages pattern
future hooks can be added and queried
history entries are created for owner actions
memory report lists active and expired memories
state validates after memory aging
```

## Do Not Do

Do not:

- Add card text.
- Add issue seed generation yet.
- Add response intents yet.
- Turn history entries into prose scenes.
- Make every tiny number change into a memory.
- Allow memory spam without stacking rules.

---

# Phase 17 — Cause Tracking & State Diffs

## Goal

Make the simulation explain why important changes happened and show exactly what changed after player actions, service, weekly routines, and monthly pressure.

The simulation must become inspectable.

If merchant satisfaction drops, the sim should say why.  
If coin rises, the sim should say where it came from.  
If inspection suspicion increases, the sim should identify the causes.

## Why This Phase Matters

Future cards need intelligent context.

A card should not say:

```txt
Merchants are upset.
```

It should be backed by causes:

```txt
Merchants are upset because the main room is filthy, ale quality dropped, and repeated brawls made the tavern feel unsafe.
```

Cause tracking lets the future card layer present state truth without inventing it.

State diffs let the future card layer show consequences after player choices.

## Required Outputs

Create or update:

```txt
/src/sim/modules/causes/causeTypes.ts
/src/sim/modules/causes/causeRegistry.ts
/src/sim/modules/causes/causeModule.ts
/src/sim/modules/causes/causeQueries.ts
/src/sim/core/diff.ts
/src/sim/core/changeTracker.ts
/src/sim/core/effect.ts
```

## Cause Shape

Recommended:

```ts
type CauseEntry = {
  id: string;
  timestamp: CalendarStamp;

  source: string;
  sourceType:
    | "owner_action"
    | "service"
    | "area"
    | "stock"
    | "staff"
    | "customer"
    | "weekly"
    | "monthly"
    | "memory"
    | "pressure"
    | "system";

  target: string;
  targetType:
    | "coin"
    | "area"
    | "stock"
    | "staff"
    | "customer"
    | "reputation"
    | "pressure"
    | "memory"
    | "global";

  amount: number;
  direction: "increase" | "decrease" | "neutral";

  weight: number;       // explanatory importance, not necessarily same as amount

  readable: string;
  tags: string[];

  relatedActors: EntityRef[];
  relatedLocations: EntityRef[];
  relatedSystems: string[];

  expiresAfterDays?: number;
}
```

## State Diff Shape

Recommended:

```ts
type StateChange = {
  path: string;
  before: unknown;
  after: unknown;
  delta?: number;
  readable: string;
  tags: string[];
  source?: string;
}
```

A state diff result:

```ts
type StateDiff = {
  changes: StateChange[];
  significantChanges: StateChange[];
}
```

## Tasks

### 17.1 Add Change Tracking Helpers

Create helpers that compare before/after state.

```ts
createStateDiff(before, after): StateDiff
filterSignificantChanges(diff, thresholds): StateChange[]
```

Thresholds should avoid noise.

Example thresholds:

```txt
percent-like value change >= 5
coin change >= 5
stock quantity change >= 5
new memory added
rent paid/missed
reputation tier changed
```

### 17.2 Add Cause Context API

Extend `SimContext`:

```ts
ctx.addCause(causeDraft)
ctx.getCausesForTarget(target)
ctx.getCausesByTag(tag)
ctx.getRecentCauses(days)
ctx.getTopCausesForTarget(target, limit)
```

Modules should use `ctx.addCause` instead of silently changing important values.

### 17.2.1 Hard Contract: Significant Mutations Require Causes

Phase 7 introduced significant-mutation helpers (`ctx.modifyArea`, `ctx.modifyStock`, etc.) with a placeholder `meta: { source: string }` argument. Phase 17 upgrades that argument to a full `CauseDraft` and enforces it at the type level.

The hard contract:

```ts
ctx.modifyArea(id, changes, cause: CauseDraft)
ctx.modifyStock(id, changes, cause: CauseDraft)
ctx.modifyStaff(id, changes, cause: CauseDraft)
ctx.modifyCustomerGroup(id, changes, cause: CauseDraft)
ctx.modifyCoin(amount, cause: CauseDraft)
ctx.modifyReputation(axis, change, cause: CauseDraft)
ctx.modifyPressure(id, change, cause: CauseDraft)
```

The TypeScript signature should make `cause` non-optional. There is no "convenience" overload that skips the cause. An author who genuinely wants a non-attributable change must construct a `CauseDraft` with `source: 'system'` and an explicit `readable` string — making the silence visible.

Mutations that do not need causes:

```txt
calendar advancement (the cause is "another day passed")
debug logs and internal counters
normalization clamping during validation
internal RNG state advancement
```

Everything else — every state change that could appear in a report, feed an issue seed, or be questioned by a player — must carry a cause.

The unexplained-changes audit in 17.9 then becomes a check for engine bugs (state mutated outside the context API) rather than a check for forgetful module authors. The forgetting becomes a compile error.

### 17.3 Add Cause Creation to Owner Actions

Each owner action should add causes.

Examples:

```txt
clean_area:
  target area.cleanliness
  readable: Owner cleaned Kitchen.

repair_area:
  target area.damage/condition
  readable: Owner repaired Main Room.

water_down_ale:
  target stock.ale.quality
  readable: Owner watered down ale, increasing quantity but lowering quality.
```

### 17.4 Add Cause Creation to Service

Service should add causes for meaningful changes.

Examples:

```txt
miner_payday_traffic -> coin increase
ogre_traffic -> main room damage
dirty_main_room -> merchant satisfaction decrease
ale_shortage -> miner satisfaction decrease
server_watch_tabs -> unpaid tabs decrease
cook_quality_priority -> food satisfaction increase
```

### 17.5 Add Cause Creation to Weekly and Monthly Systems

Weekly:

```txt
paid wages -> staff morale stable/up
unpaid wages -> morale down, stress up
maintenance backlog -> risk up
```

Monthly:

```txt
missed rent -> landlord pressure up
filthy reputation -> inspection suspicion up
paid rent -> landlord opinion up
stock shortages -> reliable reputation down
```

### 17.6 Add Cause Aging

Some causes are recent explanations and should expire.

At end of day:

```txt
age causes
remove expired causes
```

Causes can also be archived in history if needed.

Do not let cause arrays grow forever.

### 17.7 Add Explanation Queries

Create queries:

```ts
explainTargetChange(target, ctx): CauseEntry[]
explainCustomerSatisfaction(groupId, ctx): CauseEntry[]
explainPressure(pressureId, ctx): CauseEntry[]
explainReputation(axisId, ctx): CauseEntry[]
explainCoinChange(ctx): CauseEntry[]
```

These will feed reports and future issue seeds.

### 17.8 Add State Diff After Player Input

After owner actions and later response intents, the engine should output a diff.

For now, produce diffs after:

```txt
owner actions
daily service
end week
end month
```

Example:

```txt
OWNER ACTION DIFF

Clean Kitchen:
- kitchen.cleanliness: 28 → 49
- kitchen.smell: 51 → 42

Restock Ale:
- stock.ale.quantity: 12 → 52
- coin: 74 → 34
```

### 17.9 Add Cause Report

Report:

```txt
top causes today
top causes by target
unexplained significant changes
cause aging/expiration
```

The report should flag significant changes with no cause.

Example:

```txt
CAUSE REPORT

Explained:
- Merchant satisfaction -12:
  - Main room cleanliness below tolerance (-7)
  - Dangerous reputation rising (-3)
  - Ale quality low (-2)

Unexplained:
- Kitchen smell +9 has no recorded cause.
```

Unexplained changes should be treated as bugs or missing instrumentation.

## Acceptance Criteria

Phase 17 is complete when:

- Major state changes produce state diffs.
- Important changes have cause entries.
- Cause queries can explain target changes.
- Reports flag unexplained significant changes.
- Owner actions, service, weekly, and monthly systems add causes.
- Causes age/expire.
- No cards are added.

## Tests

Minimum tests:

```txt
clean_area creates cause for area cleanliness increase
water_down_ale creates cause for ale quality decrease
ogre traffic creates cause for main room damage
dirty main room creates cause for merchant satisfaction drop
unpaid wages creates cause for morale drop
missed rent creates cause for landlord pressure increase
state diff detects numeric changes
state diff ignores tiny noisy changes
significant unexplained change is flagged
causes expire after configured duration
explainCustomerSatisfaction returns relevant causes
cause report includes unexplained changes
```

## Do Not Do

Do not:

- Add prose card explanations.
- Add issue seeds yet.
- Add response intents yet.
- Require every tiny +1 change to have a cause.
- Let causes grow forever.
- Use causes as replacement for actual state.

---

# Phase 18 — Pressure & Feedback Loop System

## Goal

Build higher-level pressure models and feedback-loop detection so the simulation can identify growing problems before they become issue seeds.

Pressures are not cards.  
Pressures are simmering simulation conditions.

A pressure says:

```txt
Something is becoming risky.
Here are the causes.
Here is the strength.
Here are the systems involved.
```

Feedback loops identify compounding patterns.

## Why This Phase Matters

Future cards should not be generated from random thresholds alone. They should emerge from pressures.

Examples:

```txt
Food safety pressure is high because kitchen cleanliness is poor, mushrooms are spoiled, and the cook is stressed.
Inspection pressure is rising because food safety, privy smell, and merchant complaints are all active.
Staff burnout pressure is high because wages were missed and traffic was heavy.
Debt pressure is rising because rent was missed and weekly profit is negative.
Pest pressure is rising because the cellar is dirty and food stock is stored poorly.
```

Pressure models turn scattered state into meaningful problems.

Feedback loops reveal deeper system behaviour:

```txt
low coin -> skipped repairs -> dirty tavern -> merchant loss -> lower coin
```

## Required Outputs

Create or update:

```txt
/src/sim/modules/pressures/pressureTypes.ts
/src/sim/modules/pressures/pressureRegistry.ts
/src/sim/modules/pressures/pressureModule.ts
/src/sim/modules/pressures/pressureQueries.ts
/src/sim/modules/feedback/feedbackLoopTypes.ts
/src/sim/modules/feedback/feedbackLoopRegistry.ts
/src/sim/modules/feedback/feedbackLoopModule.ts
```

## Required Pressure Types

Implement these base pressures:

```txt
food_safety_pressure
inspection_pressure
staff_burnout_pressure
pest_pressure
debt_pressure
maintenance_pressure
violence_pressure
reputation_drift_pressure
stock_shortage_pressure
landlord_pressure
```

Some already exist as state concepts from earlier phases. This phase formalizes them as pressure models with causes and reports.

## Pressure Shape

Recommended:

```ts
type PressureState = {
  id: PressureId;
  value: number;           // 0–100
  trend: "falling" | "stable" | "rising";
  urgency: number;         // 0–100
  severity: number;        // 0–100
  volatility: number;      // 0–100

  causes: CauseEntry[];
  relatedActors: EntityRef[];
  relatedLocations: EntityRef[];
  relatedSystems: string[];
  tags: string[];

  lastUpdated: CalendarStamp;
}
```

## Feedback Loop Shape

Recommended:

```ts
type FeedbackLoop = {
  id: string;
  label: string;
  active: boolean;

  strength: number;        // 0–100
  speed: number;           // 0–100
  risk: number;            // 0–100

  nodes: string[];
  evidence: CauseEntry[];
  readable: string;
  tags: string[];
}
```

## Tasks

### 18.1 Add Pressure Registry

Create pressure definitions:

```ts
type PressureDefinition = {
  id: PressureId;
  label: string;
  tags: string[];
  calculate(ctx: SimContext): PressureCalculationResult;
}
```

Each pressure should produce:

```txt
value
severity
urgency
causes
related actors/locations/systems
```

### 18.2 Implement Food Safety Pressure

Inputs:

```txt
kitchen cleanliness
kitchen smell
stew spoilage
mushroom spoilage
cook stress/fatigue
recent suspicious food memories
```

Outputs:

```txt
food_safety_pressure
causes
risk tags
```

### 18.3 Implement Inspection Pressure

Inputs:

```txt
food safety pressure
privy smell
kitchen cleanliness
merchant complaints/satisfaction
filthy reputation
recent warnings/memories
```

Inspection pressure should react to multiple systems rather than one stat.

### 18.4 Implement Staff Burnout Pressure

Inputs:

```txt
staff stress
staff fatigue
unpaid wages
traffic intensity
bad working conditions
low morale
repeated heavy weeks
```

### 18.5 Implement Pest Pressure

Inputs:

```txt
cellar cleanliness
stock spoilage
food stored in cellar
cellar smell/risk
recent pest-related memories, if any
```

If no rat system exists yet, keep this generic.

### 18.6 Implement Debt Pressure

Inputs:

```txt
coin
weekly profit/loss
rent due/missed
supplier debt placeholder
wage risk
```

### 18.7 Implement Maintenance Pressure

Inputs:

```txt
area damage
area condition
roof state
privy condition
main room damage
maintenance backlog
```

### 18.8 Implement Violence Pressure

Inputs:

```txt
rowdy traffic
ogre/adventurer patronage
Brawl Night incidents
bouncer effectiveness
dangerous reputation
recent brawls
```

### 18.9 Implement Reputation Drift Pressure

Inputs:

```txt
current reputation axes
weekly signals
customer patronage shifts
dominant customer groups
recent memories
```

This pressure does not mean good or bad. It means the tavern identity is shifting strongly.

### 18.10 Implement Stock Shortage Pressure

Inputs:

```txt
stock quantities
recent shortages
traffic forecast
upcoming day type
reliable reputation
customer preferences
```

Important:

The same ale stock level should have different urgency before Payday than before Quiet Day.

### 18.11 Implement Pressure Trends

Store previous pressure values and calculate trend:

```txt
rising
stable
falling
```

Example:

```txt
food safety pressure: 42 → 57, rising
```

### 18.12 Add Feedback Loop Detection

Start with hand-authored loop detectors.

Required initial loops:

```txt
deferred_maintenance_revenue_spiral
staff_burnout_service_decline_loop
rowdy_damage_identity_loop
cheap_low_quality_reputation_loop
stock_shortage_reliability_loop
filth_merchant_loss_loop
```

Example detector:

```txt
filth_merchant_loss_loop active if:
- main room/kitchen cleanliness low
- merchant satisfaction falling
- merchant patronage falling
- coin trend falling or respectable reputation falling
```

Do not build a complex graph engine yet. Simple detectors are enough.

### 18.13 Add Pressure Reports

Report:

```txt
pressure value
trend
urgency
dominant causes
related systems
possible consequences if ignored
```

Example:

```txt
PRESSURE REPORT

Food Safety Pressure: 68, rising
Dominant causes:
- Mushroom spoilage is high.
- Kitchen cleanliness is low.
- Cook stress is high.

Inspection Pressure: 57, rising
Dominant causes:
- Food safety pressure is high.
- Privy smell is above acceptable level.
- Merchants have been dissatisfied for 2 weeks.
```

### 18.14 Add Feedback Loop Reports

Example:

```txt
FEEDBACK LOOP REPORT

Active Loop: Filth Merchant Loss
Strength: 61
Speed: Medium
Risk: High

Pattern:
low cleanliness -> merchant dissatisfaction -> merchant patronage decline -> lower revenue -> fewer repairs/cleaning -> lower cleanliness

Evidence:
- Main room cleanliness stayed below 35 for 9 days.
- Merchant satisfaction dropped from 51 to 32.
- Merchant traffic dropped by 46%.
```

## Acceptance Criteria

Phase 18 is complete when:

- Required pressures exist.
- Pressures calculate from real state, causes, and memories.
- Pressure trends work.
- Feedback loop detection works for required loops.
- Reports identify dominant pressures and active loops.
- Pressures do not create cards yet.
- Tests prove pressure changes under expected conditions.

## Tests

Minimum tests:

```txt
dirty kitchen raises food safety pressure
spoiled mushrooms raise food safety pressure
clean kitchen lowers food safety pressure
high food safety + privy smell raises inspection pressure
unpaid wages and high fatigue raise staff burnout pressure
dirty cellar raises pest pressure
missed rent and low coin raise debt pressure
damaged areas raise maintenance pressure
ogre-heavy Brawl Night raises violence pressure
ale shortage before Payday raises stock shortage urgency more than before Quiet Day
pressure trend shows rising/falling correctly
filth_merchant_loss_loop activates under expected conditions
staff_burnout_service_decline_loop activates under expected conditions
pressure report lists dominant causes
```

## Do Not Do

Do not:

- Add issue seeds yet.
- Add cards.
- Treat pressures as direct events.
- Make every pressure a simple one-stat threshold.
- Build a complex generic graph engine unless absolutely necessary.
- Hide pressure causes.

---

# Phase 19 — Issue Seed & Response Intent System

## Goal

Create the card-ready bridge.

The simulation should generate structured issue seeds that future cards can present, and define response intents that future card choices can send back into the simulation.

This is not card development.

This is the contract between simulation and future cards.

## Why This Phase Matters

The future card layer needs intelligent output.

A card should not need to inspect the whole state and guess what to say. The sim should provide:

```txt
what is happening
why it is happening
who is involved
where it is happening
why it matters
what response types are valid
what each response might change
what the tavern will remember
what future hooks may be created
```

The future card layer turns this into text.

The simulation remains the truth.

## Connection to Phase 1 Contract §4.10

The `IssueSeed` type implemented in this phase is the mechanical form of the Card-Readiness Rule (Contract §4.10). The ten verbal conditions in §4.10 map directly to required fields on a valid seed:

```txt
1.  clear situation         -> type / family
2.  reason it appeared now  -> causes (recent, with timestamps)
3.  actor or group          -> primaryActor / affectedActors
4.  location or system      -> location / domains
5.  at least two causes     -> causes (length >= 2 where possible)
6.  at least two responses  -> responseSlots (length >= 2)
7.  short-term consequences -> consequenceProfiles
8.  memory or future hook   -> memoriesCreated / futureHooks
9.  no contradictions       -> validation / contradiction guards
10. reason to care          -> severity / urgency / stakes
```

When in doubt about whether a seed is well-formed, read §4.10 first. The implementation in this phase must satisfy that checklist mechanically, not replace or weaken it.

## Sub-Batching Recommendation

Phase 19 has 13 tasks and creates the largest single contract surface in the project. Splitting is required, not optional.

Recommended sub-batches:

```txt
19a: IssueSeed type, registry, query API, validation skeleton (tasks 19.1, 19.2, 19.5)
19b: Seed ranking, novelty/cooldown tracking (tasks 19.3, 19.4)
19c: Contradiction guards (task 19.6)
19d: First three seed families - food_safety, stock_shortage, maintenance (19.7 partial)
19e: Next four seed families - staff_burnout, customer_complaint, violence, debt_rent (19.7 continued)
19f: Last three seed families - inspection, reputation_shift, monthly_review (19.7 finished)
19g: Response slots, consequence profiles (tasks 19.8, 19.9)
19h: Response resolver, impact scoring (tasks 19.10, 19.11)
19i: Text ingredients with budget enforcement (task 19.12)
19j: Issue seed reports (task 19.13)
```

After 19d the simulation should generate a valid food safety seed end-to-end. Use that as a vertical-slice proof before continuing to the remaining families. If the first three families don't generate clean seeds, the problem is in the validation/ranking/contradiction infrastructure, not in family count — fix the infrastructure before adding more families.

## Required Outputs

Create or update:

```txt
/src/sim/modules/issues/issueSeedTypes.ts
/src/sim/modules/issues/issueSeedRegistry.ts
/src/sim/modules/issues/issueSeedModule.ts
/src/sim/modules/issues/issueSeedGenerators.ts
/src/sim/modules/issues/issueSeedValidation.ts
/src/sim/modules/issues/issueSeedRanking.ts
/src/sim/modules/responses/responseIntentTypes.ts
/src/sim/modules/responses/responseResolver.ts
/src/sim/modules/responses/consequenceProfiles.ts
/src/sim/modules/responses/impactScoring.ts
```

## Issue Seed Shape

Recommended:

```ts
type IssueSeed = {
  id: string;
  family: string;

  type:
    | "crisis"
    | "complaint"
    | "opportunity"
    | "warning"
    | "staff_request"
    | "supplier_offer"
    | "maintenance_problem"
    | "customer_incident"
    | "reputation_shift"
    | "debt_pressure"
    | "inspection_threat"
    | "monthly_review";

  domain: string[];

  timing:
    | "morning_prep"
    | "during_service"
    | "closing"
    | "end_week"
    | "end_month";

  severity: number;
  urgency: number;
  novelty: number;
  cardWorthiness: number;

  location?: EntityRef;
  primaryActor?: EntityRef;
  affectedActors: EntityRef[];

  causes: CauseEntry[];
  pressures: PressureState[];
  stakes: StakeRef[];

  responseSlots: ResponseSlot[];
  consequenceProfiles: ConsequenceProfile[];

  memoriesCreated: MemoryDraft[];
  futureHooks: MemoryDraft[];

  toneHints: string[];
  textIngredients: TextIngredients;

  validation: SeedValidation;
}
```

## Response Intent Shape

Recommended:

```ts
type ResponseIntent = {
  id: string;
  seedId: string;

  verb:
    | "repair"
    | "clean"
    | "pay"
    | "bribe"
    | "blame"
    | "hide"
    | "confess"
    | "discount"
    | "raise_price"
    | "lower_price"
    | "serve"
    | "discard"
    | "buy"
    | "sell"
    | "negotiate"
    | "threaten"
    | "appease"
    | "delegate"
    | "delay"
    | "inspect"
    | "upgrade"
    | "ban"
    | "invite"
    | "promote"
    | "fire"
    | "borrow"
    | "gamble"
    | "rebrand"
    | "ignore";

  shape:
    | "safe_costly"
    | "risky_profitable"
    | "relationship_sacrifice"
    | "delay_problem"
    | "long_term_investment"
    | "short_term_patch"
    | "deception"
    | "escalation"
    | "compromise"
    | "reputation_play"
    | "ignore";

  target?: EntityRef;
  tags: string[];
  intensity: number; // 0–100
  metadata?: Record<string, unknown>;
}
```

## Tasks

### 19.1 Create Issue Seed Registry

Create a registry where seed generators can be registered by domain.

```ts
type IssueSeedGenerator = {
  id: string;
  domain: string[];
  timing: IssueSeed["timing"][];
  generate(ctx: SimContext): IssueSeed[];
}
```

The issue module should collect seeds from all registered generators.

### 19.2 Add Seed Query API

Create:

```ts
getIssueSeeds(ctx, query): IssueSeed[]
```

Query options:

```ts
type IssueSeedQuery = {
  timing?: IssueSeed["timing"];
  types?: IssueSeed["type"][];
  max?: number;
  minCardWorthiness?: number;
  includeLowPriority?: boolean;
}
```

### 19.3 Add Seed Ranking

Rank seeds by:

```txt
severity
urgency
cardWorthiness
novelty
unresolved duration
number of systems affected
actor importance
future hook potential
repetition penalty
low consequence penalty
```

Do not always show the highest severity if it causes repetition. Use novelty and cooldown.

### 19.4 Add Novelty and Cooldown

Track:

```txt
last generated
last selected
times selected
similar seeds recently
actor recently featured
location recently featured
```

This should prevent:

```txt
rats again
rats again
rats again
```

unless rat pressure truly dominates.

### 19.5 Add Seed Validation

A valid seed must have:

```txt
clear type
timing
severity/urgency/cardWorthiness
at least one cause
at least one stake
at least one actor or location
at least two response slots
at least one consequence profile
no contradictions
valid required state
valid blocked state
cooldown allowed or explicitly overridden
```

Invalid seeds should be reported for debugging but not selected.

### 19.6 Add Contradiction Guards

Examples:

```txt
Do not generate ale shortage seed if ale stock is high.
Do not generate unpaid wages seed if wages were paid.
Do not generate merchant complaint if merchants have not visited recently and satisfaction is high.
Do not generate roof ignored warning if roof was repaired today, unless it is about a failed patch.
Do not generate inspection warning if inspection pressure is low.
```

Contradiction rules should live near the seed generators or validation layer, not hidden in card code.

### 19.7 Implement Initial Seed Families

Add seed generators for these families:

```txt
food_safety
stock_shortage
maintenance
staff_burnout
customer_complaint
violence
debt_rent
inspection
reputation_shift
monthly_review
```

Each family should generate structured seeds, not prose cards.

Examples:

#### Food Safety Seed

Triggers:

```txt
food_safety_pressure > threshold
kitchen cleanliness low
stock spoilage high
```

Responses:

```txt
discard unsafe stock
clean kitchen
serve anyway
blame supplier
delay opening
```

#### Stock Shortage Seed

Triggers:

```txt
stock shortage pressure high
important stock low before high-demand day
```

Responses:

```txt
restock
raise prices
water down/stretch stock
limit sales
ignore
```

#### Maintenance Seed

Triggers:

```txt
maintenance pressure high
specific area critical
```

Responses:

```txt
repair
patch temporarily
ignore
close area
spend extra for proper fix
```

#### Staff Burnout Seed

Triggers:

```txt
staff burnout pressure high
specific staff stress/fatigue high
```

Responses:

```txt
pay bonus
reduce workload
push through
reassign priority
ignore
```

#### Customer Complaint Seed

Triggers:

```txt
customer satisfaction drop with clear causes
```

Responses:

```txt
apologize/discount
mock/ignore
fix root cause
blame another actor
rebrand the issue
```

#### Violence Seed

Triggers:

```txt
violence pressure high
recent brawl
rowdy group traffic
```

Responses:

```txt
hire/security placeholder
prevent fights
ban group
embrace rowdy identity
repair damage
```

#### Debt/Rent Seed

Triggers:

```txt
debt pressure high
rent coming due or missed
```

Responses:

```txt
pay
borrow
delay
cut costs
raise prices
```

#### Inspection Seed

Triggers:

```txt
inspection pressure high
warning threshold crossed
```

Responses:

```txt
clean
bribe placeholder
hide evidence
improve food safety
ignore
```

#### Reputation Shift Seed

Triggers:

```txt
reputation axis crosses tier
strong identity drift
```

Responses:

```txt
embrace identity
correct identity
advertise to matching group
try to diversify
```

#### Monthly Review Seed

Triggers:

```txt
end_month
significant monthly changes
```

Responses:

```txt
not necessarily a choice yet
can be a structured summary seed
```

If a monthly review seed has no response slots, mark it as a report seed, not a choice seed.

### 19.8 Add Response Slots

Each seed should include response slots, not final card choices.

Example:

```ts
type ResponseSlot = {
  id: string;
  labelHint: string;
  allowedVerbs: ResponseIntent["verb"][];
  shape: ResponseIntent["shape"];
  targetOptions: EntityRef[];
  expectedEffects: string[];
  requiredTags?: string[];
}
```

Example:

```txt
safe_costly:
  allowedVerbs: discard, clean, repair, pay
  expectedEffects: reduce pressure, cost coin/stock/time

risky_profitable:
  allowedVerbs: serve, hide, raise_price, gamble
  expectedEffects: gain coin, raise future risk
```

### 19.9 Add Consequence Profiles

Consequence profiles predict likely mechanical effects.

```ts
type ConsequenceProfile = {
  id: string;
  responseSlotId: string;
  immediateEffects: EffectPreview[];
  delayedEffects: EffectPreview[];
  memories: MemoryDraft[];
  futureHooks: MemoryDraft[];
  impactScore: number;
}
```

Effect previews should be mechanical, not prose.

Example:

```txt
serve_questionable_stew:
  coin up
  food safety pressure up
  inspection pressure up
  merchant satisfaction down
  local goblin satisfaction maybe up
  memory: served_questionable_stew
  future hook: food_poisoning_rumor_possible
```

### 19.10 Add Response Resolver

Create:

```ts
resolveResponseIntent(
  state: TavernState,
  seed: IssueSeed,
  intent: ResponseIntent
): ResponseResolutionResult
```

Result:

```ts
type ResponseResolutionResult = {
  state: TavernState;
  appliedEffects: EffectResult[];
  stateDiff: StateDiff;
  memoriesAdded: Memory[];
  futureHooksAdded: Memory[];
  causesAdded: CauseEntry[];
  impactScore: number;
  report: ReportSection;
}
```

The resolver should apply actual effects based on current state.

Important:

The consequence profile previews likely effects.  
The response resolver actually applies effects.

### 19.11 Add Impact Scoring

Each response should have an impact score.

Impact score should consider:

```txt
visible state changes
pressure changes
memory importance
future hook strength
actor relationship changes
reputation effects
resource cost/gain
```

Use this to detect weak choices.

Set early thresholds:

```txt
minor issue response: impact 15+
normal card response: impact 30+
major crisis response: impact 60+
monthly strategic response: impact 70+
```

Do not block everything under threshold yet. Report weak choices.

### 19.12 Add Text Ingredients

Seeds should provide text ingredients for future cards.

Example:

```ts
type TextIngredients = {
  subject: string;
  problemNoun?: string;
  sensoryDetails: string[];
  actorOpinions: Record<string, string>;
  recentContext: string[];
  stakesReadable: string[];
}
```

Keep these as short fragments, not finished card prose.

Allowed:

```txt
vinegar stink
blue foam
merchants look horrified
the cook insists it is traditional
```

Not allowed:

```txt
A full written card scene with choices.
```

#### Text Ingredient Budget

"Short" needs a concrete ceiling. Without one, generators drift toward card prose.

Per-seed limits:

```txt
sensoryDetails: max 3 entries, each under 6 words
actorOpinions: max 2 entries, each under 8 words
recentContext: max 3 entries, each under 10 words
stakesReadable: max 3 entries, each under 12 words
problemNoun: max 1 entry, under 4 words
subject: max 1 entry, under 4 words
```

These limits are not balance numbers. They are discipline rails. If a generator wants to write a fourth sensory detail or a longer opinion, that is the signal to leave the elaboration for the card layer.

Validation in 19.5 should treat over-budget ingredients as a soft warning during 19d–19f development and a hard failure once the Phase 20 readiness gate runs.

Allowed (under budget):

```ts
{
  subject: "the stew",
  problemNoun: "sour bubbling",
  sensoryDetails: ["vinegar stink", "blue foam", "warm sweat"],
  actorOpinions: {
    cook: "insists it is traditional",
    merchants: "look horrified"
  }
}
```

Not allowed (over budget, drifting into card prose):

```ts
{
  sensoryDetails: [
    "The stew gives off a sharp vinegar stink that hits the moment you lift the lid",
    "...",
    "...",
    "..."
  ]
}
```

The card layer is where prose lives. The seed gives the card layer ingredients, not finished writing.

### 19.13 Add Issue Seed Reports

Report:

```txt
generated seeds
valid/invalid count
top seeds by cardWorthiness
rejected seeds with reasons
available response slots
impact score ranges
contradiction flags
```

Example:

```txt
ISSUE SEED REPORT

Generated: 18
Valid: 11
Rejected: 7

Top Valid Seeds:
1. Ale Shortage Before Payday
   Type: warning
   Severity: 61
   Urgency: 78
   Causes: ale stock low, Payday tomorrow, miner patronage high
   Responses: restock, raise prices, stretch ale, limit sales, ignore
   Impact range: 24–67

2. Kitchen Food Safety Risk
   Type: crisis
   Severity: 74
   Urgency: 62
   Causes: kitchen cleanliness, mushroom spoilage, cook stress
   Responses: discard stock, clean kitchen, serve anyway, blame supplier
   Impact range: 36–82
```

## Acceptance Criteria

Phase 19 is complete when:

- Issue seeds can be generated from pressures, causes, memories, and state.
- Seeds include causes, stakes, actors/locations, response slots, consequence profiles, future hooks, and text ingredients.
- Seeds are ranked, validated, and contradiction-checked.
- Response intents can be resolved into state changes.
- Response resolution produces state diffs, causes, memories, future hooks, and impact scores.
- Reports show whether seeds are card-ready.
- No real cards are written.

## Tests

Minimum tests:

```txt
food safety pressure generates food safety seed
low ale before Payday generates stock shortage seed
high maintenance pressure generates maintenance seed
high staff burnout generates staff seed
merchant satisfaction drop generates customer complaint seed
high violence pressure generates violence seed
missed rent generates debt/rent seed
high inspection pressure generates inspection seed
reputation tier crossing generates reputation shift seed
seed without causes fails validation
seed with fewer than two response slots fails validation
ale shortage seed blocked when ale stock is high
unpaid wage seed blocked when wages are paid
response intent safe_costly reduces relevant pressure at a cost
response intent risky_profitable improves coin but increases future risk
response resolver creates state diff
response resolver creates memories/future hooks
impact scoring flags weak response
issue seed report lists rejected seeds with reasons
text ingredient budgets are enforced (over-budget fields produce warnings or failures)
seed validation references contract §4.10 conditions
```

## Do Not Do

Do not:

- Write real card text.
- Create final player-facing card choices.
- Let cards own mechanical effects.
- Generate seeds from vibes rather than state.
- Allow seeds with no consequences.
- Allow contradiction-prone seeds.
- Make response resolver depend on UI.

---

# Phase 20 — Cardless Playtest & Readiness Gate

## Goal

Run the full simulation without real cards and prove that it is ready for card development.

The game should be playable in a crude, text/debug format using:

```txt
daily reports
weekly reports
monthly reports
raw issue seeds
response previews
response intent selection
state diffs
memory reports
pressure reports
readiness scores
```

This phase is a gate.

If the cardless version is mechanically boring, confusing, repetitive, or unexplainable, do not start card writing yet.

## Why This Phase Matters

Good prose cannot save a weak simulation.

The purpose of this phase is to answer:

```txt
Can the tavern generate meaningful problems without cards?
Can the player make meaningful choices without cards?
Do choices visibly change the tavern?
Does the tavern remember what happened?
Can the sim explain why things changed?
Are issue seeds varied enough for future card writing?
Are there enough non-fluff card opportunities?
Are contradictions under control?
Can runs be replayed?
Can different strategies create different tavern identities?
```

Only after this gate should real card development begin.

## Required Outputs

Create or update:

```txt
/src/sim/testing/cardlessPlaytest.ts
/src/sim/testing/simRunner.ts
/src/sim/testing/policyBots.ts
/src/sim/testing/readinessReport.ts
/src/sim/testing/balanceRuns.ts
/src/sim/testing/contradictionAudit.ts
/src/sim/testing/seedCoverageReport.ts
/src/sim/testing/strategyComparison.ts
```

Depending on project structure, these can be scripts, test utilities, or debug commands.

## Tasks

### 20.1 Build Cardless Playtest Runner

Create a runner that can simulate the game without UI/cards.

It should allow:

```txt
start new run with seed
run one day
run one week
run one month
select owner actions
assign staff priorities
view generated issue seeds
preview response slots
resolve response intent
view resulting state diff
```

The interface can be CLI-like, JSON output, or simple debug text.

No polished UI required.

### 20.2 Add Playtest Modes

Implement these modes:

```txt
manual_debug
auto_no_owner_actions
auto_random_owner
auto_clean_focused
auto_profit_focused
auto_merchant_focused
auto_miner_focused
auto_ignore_repairs
auto_staff_friendly
```

These are not AI agents. They are simple policy bots for simulation testing.

### 20.3 Add Policy Bots

Policy bots choose owner actions and response intents based on simple priorities.

Examples:

#### Clean Focused

```txt
clean dirtiest area
repair worst area if coin allows
restock critical stock
choose safe_costly responses
```

#### Profit Focused

```txt
restock best sellers
raise prices if demand high
water down ale if low
choose risky_profitable responses
```

#### Merchant Focused

```txt
clean public areas
improve stew/ale quality
avoid rowdy reputation
choose respectable/safe responses
```

#### Miner Focused

```txt
stock ale before Payday
keep prices cheap/moderate
tolerate mess
repair main room after Brawl Night
```

#### Ignore Repairs

```txt
never repair unless critical
prioritize stock/profit
choose delay/ignore responses
```

These bots reveal whether different strategies produce different outcomes.

### 20.4 Add One-Day Playtest Report

A one-day report should show:

```txt
calendar
owner actions
staff priorities
service result
state diffs
causes
pressures
issue seeds generated
response previews
memories added/expired
```

### 20.5 Add One-Week Playtest Report

A one-week report should show:

```txt
net profit/loss
wages
staff trends
customer trends
maintenance backlog
top pressures
issue seed variety
active memories
feedback loops
```

### 20.6 Add One-Month Playtest Report

A one-month report should show:

```txt
rent result
ending coin
reputation shifts
landlord pressure
inspection suspicion
customer base changes
upgrade readiness
dominant strategy effects
top memories
top pressures
top issue seed families
feedback loops
```

### 20.7 Add Contradiction Audit

Audit generated seeds for contradictions.

Examples:

```txt
stock shortage seed while stock is high
dirty area complaint while area is clean
unpaid wages seed while wages paid
inspection warning while inspection pressure low
customer complaint from group with no recent traffic
```

Report:

```txt
total seeds audited
contradictions found
seed IDs
reason
state evidence
```

Contradictions must be treated seriously.

### 20.8 Add Seed Coverage Report

Measure how much card-ready content the sim can support.

Report by family:

```txt
food_safety
stock_shortage
maintenance
staff_burnout
customer_complaint
violence
debt_rent
inspection
reputation_shift
monthly_review
```

For each family:

```txt
number of generators
number of valid seeds produced across test runs
average cardWorthiness
average response count
average impact score
common rejection reasons
state dependencies
```

### 20.9 Add Meaningful-Card-Capacity Report

Estimate whether the sim can support hundreds of non-fluff cards.

This does not mean hundreds of written cards. It means enough mechanical seed variety.

Report:

```txt
distinct seed families
distinct actors involved
distinct locations involved
distinct pressure combinations
distinct response shapes
distinct future hooks
distinct memories created
underrepresented systems
overrepresented systems
```

Example:

```txt
Meaningful Card Capacity

Seed Families: 10
Distinct Valid Seed Templates: 64
Distinct Actor/Location Combos: 143
Distinct Response Shapes: 9
Future Hook Types: 31
Memory Types Created by Responses: 42

Strong Coverage:
- maintenance
- stock shortage
- customer complaints
- food safety

Weak Coverage:
- rival tavern
- supplier relationships
- strange reputation
```

### 20.10 Add Repetition Audit

Detect if the same seed appears too often.

Report:

```txt
most repeated seeds
cooldown failures
overused actors
overused locations
underused domains
```

If the same rat/stock/filth issue dominates every run, adjust ranking/cooldowns or pressure balance.

### 20.11 Add Strategy Comparison Runs

Run each policy bot for:

```txt
1 month
3 months
optionally 6 months
```

Compare:

```txt
survival/rent payment
ending coin
reputation identity
top customers
staff health
inspection pressure
landlord pressure
dominant issue seeds
active feedback loops
```

The goal is not perfect balance. The goal is distinct outcomes.

Example expected differences:

```txt
Clean Focused:
  merchants rise, coin tight, inspection low

Profit Focused:
  coin high early, trust/reliability risk, scandal hooks

Miner Focused:
  ale sales high, mess/damage high, cheap/rowdy identity

Ignore Repairs:
  early profit, later maintenance spiral

Staff Friendly:
  service stable, wages costly, burnout low
```

### 20.12 Add Replay Verification

For a fixed seed and fixed input sequence:

```txt
run A
run B
compare outputs
```

They should match.

Test:

```txt
same seed + same inputs = same state, same reports, same seeds
different seed + same inputs = plausible variation
```

### 20.13 Add Readiness Score

Create a readiness report with sections.

Suggested scoring:

```txt
State Safety: 0–100
Replayability: 0–100
Cause Coverage: 0–100
Pressure Quality: 0–100
Seed Quality: 0–100
Response Impact: 0–100
Contradiction Safety: 0–100
Repetition Control: 0–100
Strategy Diversity: 0–100
Card Capacity: 0–100
```

Do not use the score as fake precision. Use it as a checklist.

Example readiness thresholds:

```txt
Minimum to begin card development:
State Safety >= 90
Replayability >= 95
Cause Coverage >= 80
Seed Quality >= 80
Response Impact >= 75
Contradiction Safety >= 90
Repetition Control >= 70
Strategy Diversity >= 70
Card Capacity >= 75
```

If a section fails, fix the sim before cards.

### 20.14 Add Final Card-Readiness Gate

The final gate should answer yes/no:

```txt
Is the simulation ready for real card development?
```

Conditions:

```txt
1. A 3-month cardless run completes without invalid state.
2. Same seed and inputs replay exactly.
3. Daily, weekly, and monthly reports are readable.
4. Major changes have causes.
5. Pressures are understandable.
6. Feedback loops are detected when active.
7. Issue seeds are generated from state, not invented.
8. Seeds include causes, stakes, response slots, consequence profiles, memories, and future hooks.
9. Response intents change the tavern meaningfully.
10. Contradiction audit passes.
11. Repetition audit is acceptable.
12. Strategy comparison produces distinct tavern identities.
13. Meaningful-card-capacity report shows enough seed variety.
```

Only then begin card development.

## Example Cardless Playtest Output

```txt
DAY 19 — Month 1, Week 3, Payday

Owner Actions:
1. Restock Ale
2. Clean Main Room
3. Pay Staff Bonus: Nesk

Service:
- Miner traffic high.
- Ale sales strong.
- Ogres caused minor damage.
- Merchants remained low.

State Diff:
- Coin: 61 -> 104
- Ale: 52 -> 11
- Main Room Cleanliness: 33 -> 46 -> 38 after service
- Server Morale: 44 -> 55
- Miner Satisfaction: 58 -> 65
- Merchant Patronage: 31 -> 29

Top Causes:
- Payday miner traffic increased ale sales.
- Restocked ale prevented shortage.
- Main room cleanliness remained below merchant tolerance.
- Staff bonus improved server morale.

Pressures:
- Stock Shortage Pressure: 63, rising
- Maintenance Pressure: 51, stable
- Staff Burnout Pressure: 37, falling
- Inspection Pressure: 48, rising

Issue Seeds:
1. Ale Low Before Brawl Night
   Type: warning
   Causes: ale stock low, Brawl Night tomorrow, miner/ogre traffic high
   Responses: restock, raise prices, water down ale, limit sales, ignore
   Impact Range: 22–65

2. Main Room Damage Becoming Visible
   Type: maintenance_problem
   Causes: ogre traffic, existing damage, deferred repairs
   Responses: repair, patch, ignore, embrace rowdy identity
   Impact Range: 18–58

3. Merchants Quietly Leaving
   Type: complaint
   Causes: dirty main room, dangerous reputation, recent brawls
   Responses: clean, discount, mock merchants, improve safety
   Impact Range: 24–61
```

If this is interesting before real card prose exists, the system is ready.

## Acceptance Criteria

Phase 20 is complete when:

- Cardless playtest runner exists.
- Policy bots exist.
- One-day, one-week, and one-month reports exist.
- Contradiction audit exists.
- Seed coverage report exists.
- Meaningful-card-capacity report exists.
- Repetition audit exists.
- Strategy comparison runs exist.
- Replay verification exists.
- Readiness score/report exists.
- Final readiness gate can clearly pass or fail the sim.
- No real cards are written.

## Tests

Minimum tests:

```txt
cardless runner completes one day
cardless runner completes one week
cardless runner completes one month
3-month run completes without invalid state
same seed and inputs replay exactly
policy bots choose valid actions
contradiction audit catches intentionally invalid seed
seed coverage report includes all seed families
repetition audit detects overused seed
strategy comparison shows different outputs for clean vs profit policy
readiness report fails when cause coverage is too low
readiness report fails when contradiction audit fails
readiness report passes when thresholds are met
```

## Do Not Do

Do not:

- Write final cards.
- Add finished player-facing card text.
- Build a polished UI.
- Skip readiness failures.
- Hide contradictions.
- Treat readiness score as a decorative metric.
- Begin card writing if the cardless sim is not interesting.

---

# Final Project State After Phase 20

After Phase 20, the simulation should be ready for real card development.

The tavern should be able to say:

```txt
Here is what is happening.
Here is why it is happening.
Here is who is involved.
Here is where it is happening.
Here is why it matters.
Here are valid ways the player can respond.
Here is what each response is likely to change.
Here is what actually changed after the response.
Here is what the tavern remembers.
Here is what may happen later because of it.
```

That is the required bridge.

The future card layer should not need to invent mechanics, causes, or consequences.

The card layer should receive structured truth from the simulation and turn it into good goblin tavern presentation.

---

# End-of-Plan Summary

The complete 20-phase simulation path is:

```txt
1. Simulation Contract & Design Rules
2. Core Project Structure
3. Calendar & Time System
4. Deterministic RNG & Replay
5. Base Tavern State Model
6. Schema Validation & State Safety
7. Simulation Engine & Phase Pipeline
8. Area System
9. Stock & Economy System
10. Customer Group System
11. Staff System
12. Daily Service Simulation
13. Owner Action System
14. Weekly Routine System
15. Monthly Pressure System
16. Memory & History System
17. Cause Tracking & State Diffs
18. Pressure & Feedback Loop System
19. Issue Seed & Response Intent System
20. Cardless Playtest & Readiness Gate
```

After Phase 20, card development can begin.

Not before.

The tavern must first learn to rot, remember, explain, pressure, tempt, punish, and recover.

Only then should it learn to speak in cards.
