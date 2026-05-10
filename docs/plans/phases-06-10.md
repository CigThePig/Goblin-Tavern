# Goblin Tavern Simulation — Expanded Plan: Phases 6–10

This document expands **Phases 6 through 10** of the simulation-first build plan.

**Phase 1 is complete.**  
**Phases 2–5 should already be complete or in progress before this batch begins.**

These phases continue building the headless goblin tavern simulation. The goal is not to create cards, story scenes, UI polish, or narrative content. The goal is to make the underlying tavern state safe, testable, and mechanically meaningful.

By the end of Phase 10, the simulation should have:

- A validated state model.
- A working phase pipeline.
- Physical tavern areas with decay and tags.
- Stock, spoilage, purchasing, sales, shortages, and coin flow.
- Customer groups with preferences, satisfaction, traffic patterns, and basic behaviours.
- Enough structure for later staff, owner actions, weekly systems, monthly pressure, memories, cause tracking, and issue seeds.

---

# Current Phase Status

## Phase 1 — Simulation Contract & Design Rules

**Status:** Complete.

Do not expand Phase 1 in this batch.

The Phase 1 contract is the source of truth for what this simulation is allowed to become. All work in Phases 6–10 must obey the core rule:

> The simulation is truth. Cards will eventually present simulation truth, but cards must not invent truth.

---

# Phase 6 — Schema Validation & State Safety

## Goal

Add validation and state safety infrastructure so the simulation can detect impossible state, prevent silent corruption, and produce predictable output.

This phase protects future systems from creating broken taverns such as:

- Negative stock.
- Cleanliness over 100.
- Missing areas.
- Invalid customer group IDs.
- Undefined reputation values.
- NaN coin values.
- Calendar values outside the valid day/week/month range.
- Module state that exists but does not match its declared schema.

## Why This Phase Matters

The simulation will become large and modular. Every future system will mutate state. Without validation, bugs will hide inside the state tree and only become visible much later, often as confusing simulation behaviour.

Validation gives the project tripwires.

If the tavern becomes impossible, the engine should know immediately.

## Required Outputs

By the end of this phase, the project should include:

```txt
/src/sim/state/schemas.ts
/src/sim/state/validation.ts
/src/sim/state/normalize.ts
/src/sim/state/defaults.ts
/src/sim/state/types.ts
/src/sim/testing/stateFactories.ts
/src/sim/testing/stateAssertions.ts
```

Existing file paths may differ slightly depending on Phase 2 decisions, but the responsibilities must exist.

## Recommended Dependency

Use one schema validation library.

Preferred:

```txt
zod
```

Reason:

- TypeScript-friendly.
- Easy for agents to understand.
- Useful for nested schemas.
- Good enough for runtime validation and inferred types.

Alternative:

```txt
valibot
```

Only use Valibot if the project already chose it during earlier setup.

Do not use both.

## State Safety Rules

The simulation should enforce these basic ranges unless Phase 1 or a later design document explicitly changes them:

```txt
percentage-like values: 0–100
coin: integer, can go negative only if debt is explicitly supported
stock quantity: 0+
stock quality: 0–100
stock spoilage: 0–100
area condition: 0–100
area cleanliness: 0–100
area damage: 0–100
customer satisfaction: 0–100
customer patronage: 0–100
customer rowdiness: 0–100
reputation axes: 0–100
staff morale: 0–100
staff stress: 0–100
staff fatigue: 0–100
```

If the design wants debt later, debt should be explicit:

```ts
coin: number
debt: number
```

Do not allow negative stock or NaN values.

## Tasks

### 6.1 Create Core Schemas

Create schemas for:

```txt
CalendarState
TavernState
AreaState
StockItemState
CustomerGroupState
StaffState
ReputationState
MemoryState
CauseEntry
PressureState
ModuleState container
```

The base schemas should match the state model produced in Phase 5.

Example shape:

```ts
const AreaStateSchema = z.object({
  id: z.string(),
  condition: z.number().min(0).max(100),
  cleanliness: z.number().min(0).max(100),
  damage: z.number().min(0).max(100),
  smell: z.number().min(0).max(100).optional(),
  riskTags: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
```

Keep schemas clear and boring. Do not build clever dynamic validation unless needed.

### 6.1.1 Module Schema Composition

Modules register their own schemas for their namespaced state under `state.modules`. The state validator should compose these registered schemas rather than treating `modules` as opaque or hardcoding known module schemas.

Design:

- The module registry collects `stateSchema` declarations from each registered simulation module.
- `validateState` composes a dynamic schema for `state.modules` from all currently registered module schemas.
- Modules not registered in the current run should be ignored, not rejected. A future save envelope may reference disabled modules and should still validate.
- Unknown keys under `state.modules` with no registered schema should be reported as warnings, not hard failures.

Minimum Phase 6 helper:

```ts
buildModulesSchema(registeredModules): ZodSchema
```

The composition can stay simple. Later phases will add real module schemas. The point is that the validator never silently accepts whatever shape happens to be in `state.modules`.

### 6.2 Add `validateState`

Create a function:

```ts
validateState(state: unknown): TavernState
```

It should:

1. Validate the full state.
2. Return a typed state if valid.
3. Throw a useful error if invalid.
4. Include enough path/detail to identify the broken field.

Example failure should be understandable:

```txt
Invalid tavern state:
areas.kitchen.cleanliness expected 0–100, received 142
```

### 6.3 Add `safeValidateState`

Create a non-throwing version:

```ts
safeValidateState(state: unknown): {
  success: boolean;
  state?: TavernState;
  errors?: ValidationIssue[];
}
```

This is useful for test harnesses, debug tools, and future save loading.

### 6.4 Add Normalization Helpers

Create normalization helpers for state values:

```ts
clampPercent(value: number): number
clampNonNegative(value: number): number
normalizeArea(area: AreaState): AreaState
normalizeStockItem(item: StockItemState): StockItemState
normalizeTavernState(state: TavernState): TavernState
```

Important:

Normalization should be used intentionally, not as a way to hide simulation bugs.

Use validation to catch unexpected impossible states during tests. Use normalization only where slight numeric drift is expected.

### 6.5 Add State Assertions for Tests

Create helpers:

```ts
expectValidState(state)
expectNoNegativeStock(state)
expectPercentRangesValid(state)
expectCalendarValid(state)
```

These should be used in tests after every simulation tick once the engine exists.

### 6.6 Add Basic Migration Container

Do not build complex migrations yet, but add a place for them.

```ts
type SaveEnvelope = {
  simVersion: string;
  enabledModules: Record<string, string>;
  state: TavernState;
}
```

Add placeholder migration function:

```ts
migrateSaveEnvelope(envelope: SaveEnvelope): SaveEnvelope
```

For now it can return the same envelope, but the structure must exist.

## Acceptance Criteria

Phase 6 is complete when:

- Full tavern state can be validated.
- Invalid values produce useful errors.
- All core state sections have schemas.
- Tests can assert state validity.
- Normalization helpers exist but do not hide serious bugs.
- A save envelope shape exists with version/module version fields.
- No card or narrative systems are introduced.

## Tests

Minimum tests:

```txt
valid default tavern state passes validation
negative stock fails validation
cleanliness over 100 fails validation
NaN coin fails validation
missing calendar fails validation
invalid area object fails validation
safeValidateState returns errors instead of throwing
normalization clamps percent-like values when intentionally called
```

## Do Not Do

Do not:

- Add cards.
- Add narrative prose.
- Add event writing.
- Add issue seeds yet.
- Add UI.
- Add save/load persistence beyond the versioned envelope.
- Allow modules to mutate raw state without later going through engine/context rules.

---

# Phase 7 — Simulation Engine & Phase Pipeline

## Goal

Build the core engine that advances the tavern simulation through defined phases.

At this stage, the engine can still be mostly empty internally. The important work is establishing the pipeline that all future modules will plug into.

## Why This Phase Matters

Without a clear phase pipeline, systems will be added in random order and eventually require refactors.

The daily flow must be stable before areas, stock, customers, and staff become complex.

The engine should answer:

```txt
What happens first?
What happens after owner input?
When does service resolve?
When do weekly systems run?
When do monthly systems run?
Where do modules attach?
Where do reports collect?
Where do causes and state diffs eventually collect?
```

## Required Outputs

```txt
/src/sim/core/engine.ts
/src/sim/core/phases.ts
/src/sim/core/context.ts
/src/sim/core/module.ts
/src/sim/core/result.ts
/src/sim/core/rng.ts
/src/sim/core/diff.ts
/src/sim/core/reports.ts
```

Some of these may already exist from earlier phases. Expand them as needed.

## Core Phase List

Use a phase structure like this:

```txt
startDay
applyDayTypeModifiers
forecastTraffic
beforeOwnerActions
applyOwnerActions
afterOwnerActions
assignStaffPriorities
beforeService
service
afterService
closing
endDay
endWeek, if applicable
endMonth, if applicable
generateReports
validate
advanceCalendar
```

The exact names can be adjusted, but the responsibilities must be clear and documented.

## Tasks

### 7.1 Define Phase Types

Create a union type:

```ts
type SimPhase =
  | "startDay"
  | "applyDayTypeModifiers"
  | "forecastTraffic"
  | "beforeOwnerActions"
  | "applyOwnerActions"
  | "afterOwnerActions"
  | "assignStaffPriorities"
  | "beforeService"
  | "service"
  | "afterService"
  | "closing"
  | "endDay"
  | "endWeek"
  | "endMonth"
  | "generateReports"
  | "validate"
  | "advanceCalendar";
```

### 7.2 Define the Simulation Module Contract

Create a module interface:

```ts
type SimulationModule = {
  id: string;
  version: string;
  dependsOn?: string[];
  hooks?: Partial<Record<SimPhase, SimHook>>;
  buildReport?: (ctx: SimContext) => ReportSection | ReportSection[] | null;
  validate?: (ctx: SimContext) => ValidationIssue[];
}
```

Hooks should receive a context object, not raw loose arguments.

### 7.3 Create `SimContext`

The context should be the controlled way modules interact with the simulation.

At this stage, it should expose:

```ts
ctx.state
ctx.input
ctx.rng
ctx.reports
ctx.logs
ctx.addReportSection()
ctx.addLog()
ctx.getDayType()
ctx.isEndOfWeek()
ctx.isEndOfMonth()
ctx.validate()
```

Later phases will add:

```txt
modifyArea
modifyStock
modifyCustomerGroup
addCause
addMemory
addPressure
addIssueSeed
```

For now, keep it small but designed to grow.

### 7.3.1 Cause-Required Mutation API

When Phase 17 adds cause tracking, the intent is that `ctx.modifyArea`, `ctx.modifyStock`, `ctx.modifyStaff`, `ctx.modifyCustomerGroup`, and similar significant-mutation helpers will require a cause argument, not accept it optionally.

The Phase 7 context API should be designed with this contract in mind. If `modifyArea` is added now without a cause parameter, Phase 17 will have to either break callers or add a parallel API.

Recommended Phase 7 stub:

```ts
ctx.modifyArea(id, changes, meta: { source: string; reason?: string })
ctx.modifyStock(id, changes, meta: { source: string; reason?: string })
ctx.modifyStaff(id, changes, meta: { source: string; reason?: string })
ctx.modifyCustomerGroup(id, changes, meta: { source: string; reason?: string })
```

The `meta` argument can remain lightweight in Phase 7 (just a string source) and become a proper `CauseDraft` in Phase 17. The point is that there is never a path through the context API that mutates important state silently.

Trivial mutations (debug logs, internal counters, calendar advancement, normalization clamps) do not need this contract. Only mutations that should appear in the explainability layer.

### 7.4 Create `simulateDay`

Build the main entry function:

```ts
simulateDay(
  state: TavernState,
  input: SimInput,
  modules: SimulationModule[]
): SimResult
```

It should:

1. Create a context.
2. Run phases in order.
3. Run each module hook for each phase.
4. Validate state after important phases or at the end.
5. Advance the calendar once per day.
6. Return the new state and reports/logs.

Example result:

```ts
type SimResult = {
  state: TavernState;
  reports: ReportSection[];
  logs: SimLog[];
  validation: ValidationSummary;
}
```

### 7.5 Add Module Ordering

Modules should be sorted by dependencies.

Example:

```txt
calendar before weekly
areas before customers
stock before service/economy
customers before reports
```

Implement simple dependency sorting.

If dependencies are missing or cyclic, throw a clear error.

### 7.6 Add Engine-Level Tests

Create a few dummy test modules that append logs during phases.

Test that:

- Hooks run in the correct order.
- Dependency order is respected.
- Missing dependency errors are useful.
- Calendar advances once.
- End-week and end-month phases run only when appropriate.
- Validation runs.

## Acceptance Criteria

Phase 7 is complete when:

- `simulateDay` exists and runs a full phase pipeline.
- Modules can register hooks.
- Hooks run in a deterministic order.
- Module dependency ordering works.
- Calendar advancement is integrated.
- Validation is integrated.
- Engine tests prove phase order.
- No real card/event systems are introduced.

## Tests

Minimum tests:

```txt
simulateDay advances the calendar exactly once
startDay runs before service
service runs before closing
endWeek runs on the final day of the week
endMonth runs on the final day of the month
modules respect declared dependencies
cyclic dependencies throw a clear error
state remains valid after simulateDay
dummy report sections are collected
```

## Do Not Do

Do not:

- Put all simulation rules inside `simulateDay`.
- Hardcode rats, inspectors, cards, or story content.
- Allow modules to rely on import order.
- Add UI.
- Add narrative prose.
- Add card choices.

---

# Phase 8 — Area System

## Goal

Implement the physical tavern as a set of meaningful areas with state, tags, decay, and report output.

The tavern should stop being an abstract business and become a place with rooms that get dirty, damaged, risky, and expensive to ignore.

## Why This Phase Matters

Areas are the physical foundation for later systems.

Stock lives in areas. Customers occupy areas. Staff work in areas. Owner actions target areas. Future issue seeds will often come from area state.

If areas are weak, later cards will become generic.

## Initial Areas

Implement these required areas:

```txt
main_room
kitchen
cellar
privy
roof
```

Optional but not required yet:

```txt
storage
back_alley
hearth
entryway
```

Do not add too many areas yet. The first five are enough.

## Area State

Each area should track:

```ts
type AreaState = {
  id: AreaId;
  condition: number;      // 0–100
  cleanliness: number;   // 0–100
  damage: number;        // 0–100
  smell: number;         // 0–100
  risk: number;          // 0–100 general local risk
  tags: string[];
  activeFlags: string[];
}
```

Values can be adjusted, but these concepts should exist.

## Area Tags

Use tags to make systems expandable.

Recommended tags:

```txt
public
private
food
storage
sanitation
structure
weather_exposed
customer_facing
staff_work_area
pest_sensitive
inspection_relevant
fire_risk
```

Example:

```ts
main_room.tags = ["public", "customer_facing", "inspection_relevant"];
kitchen.tags = ["food", "staff_work_area", "inspection_relevant", "fire_risk"];
cellar.tags = ["storage", "pest_sensitive", "private"];
privy.tags = ["sanitation", "inspection_relevant", "smell_source"];
roof.tags = ["structure", "weather_exposed"];
```

## Tasks

### 8.1 Create Area Registry

Create:

```txt
/src/sim/registries/areaRegistry.ts
```

The registry should allow areas to be defined data-first:

```ts
areaRegistry.register({
  id: "kitchen",
  label: "Kitchen",
  tags: ["food", "staff_work_area", "inspection_relevant"],
  defaultState: {
    condition: 60,
    cleanliness: 45,
    damage: 20,
    smell: 35,
    risk: 20,
    activeFlags: [],
  },
});
```

The default tavern state should be built from the registry.

### 8.2 Add Area Module

Create:

```txt
/src/sim/modules/areas/areasModule.ts
```

The area module should:

- Ensure required areas exist.
- Apply daily passive decay.
- Apply service-related mess/damage later, once service exists.
- Build area report sections.
- Validate area state.

### 8.3 Implement Passive Area Decay

Each day, areas should drift slightly.

Example:

```txt
main_room cleanliness -1
kitchen cleanliness -1 or -2
privy smell +1
cellar risk +1 if cleanliness low
roof condition -0.2 or small random chance of decay
```

Keep numbers small at first.

The goal is not harsh balance yet. The goal is believable movement.

### 8.4 Add Derived Area Conditions

Create derived helpers:

```ts
isAreaFilthy(area): boolean
isAreaDamaged(area): boolean
isAreaDangerous(area): boolean
isAreaInspectionRisk(area): boolean
getAreaQualityBand(area): "excellent" | "good" | "rough" | "bad" | "critical"
```

These helpers should be used by later systems instead of repeating threshold logic everywhere.

### 8.5 Add Area Reports

The report should clearly show:

```txt
Area name
condition
cleanliness
damage
smell
risk
worst problem
trend if known
```

Example:

```txt
AREA REPORT

Kitchen
Condition: 58
Cleanliness: 41
Damage: 22
Smell: 37
Risk: 24
Status: Questionable but usable

Cellar
Condition: 55
Cleanliness: 28
Damage: 18
Smell: 52
Risk: 43
Status: Pest-sensitive and worsening
```

### 8.6 Add Area Tests

Test that:

- Default areas exist.
- Tags are present.
- Decay changes areas in the expected direction.
- Values stay within range.
- Area report includes required areas.
- Derived condition helpers classify correctly.

## Acceptance Criteria

Phase 8 is complete when:

- Required areas exist through a registry.
- Area state validates.
- Area tags exist and are useful.
- Daily decay works.
- Area reports are generated.
- Area helpers exist.
- Tests cover default state, decay, tags, and reports.
- No cards or issue seeds are introduced.

## Tests

Minimum tests:

```txt
default tavern includes main_room, kitchen, cellar, privy, roof
all required areas pass schema validation
daily decay lowers cleanliness where expected
privy smell does not exceed 100
roof condition does not go negative
kitchen has food and inspection_relevant tags
area quality band changes at thresholds
area report includes worst area
```

## Do Not Do

Do not:

- Add card text about areas.
- Add room upgrades yet unless needed as placeholders.
- Add customer traffic effects yet.
- Add staff work yet.
- Add detailed weather interactions yet.
- Hardcode area checks in unrelated modules when tags should be used.

---

# Phase 9 — Stock & Economy System

## Goal

Implement the tavern’s basic business economy: stock, spoilage, purchasing, selling, shortages, waste, prices, and coin movement.

The tavern must become capable of making or losing money through ordinary operation before customers, staff, and owner actions become deep.

## Why This Phase Matters

The tavern is a business. If stock and coin do not matter, decisions will not matter.

Later cards need situations like:

```txt
Ale is low before Payday.
The stew is cheap but spoiling.
Mushrooms are plentiful but questionable.
Coin is high but repairs were ignored.
Firewood is low during a cold month.
```

These must come from the sim, not from card invention.

## Initial Stock Items

Required:

```txt
ale
stew
ingredients
mushrooms
firewood
mugs
```

Optional later:

```txt
meat
bread
soap
candles
clean_water
cheap_grog
fancy_drink
```

Do not add too many yet.

## Stock State

Each stock item should track:

```ts
type StockItemState = {
  id: StockId;
  quantity: number;
  quality: number;      // 0–100
  spoilage: number;     // 0–100
  basePrice: number;
  salePrice: number;
  tags: string[];
  storageAreaId?: AreaId;
}
```

For non-food items like mugs, `spoilage` can remain 0.

## Stock Tags

Recommended:

```txt
drink
food
ingredient
perishable
equipment
service_capacity
fuel
goblin_favourite
merchant_sensitive
quality_sensitive
```

Example:

```ts
ale.tags = ["drink", "quality_sensitive"];
stew.tags = ["food", "perishable"];
mushrooms.tags = ["ingredient", "perishable", "goblin_favourite"];
firewood.tags = ["fuel"];
mugs.tags = ["equipment", "service_capacity"];
```

## Tasks

### 9.1 Create Stock Registry

Create:

```txt
/src/sim/registries/stockRegistry.ts
```

Allow stock definitions:

```ts
stockRegistry.register({
  id: "ale",
  label: "Ale",
  tags: ["drink", "quality_sensitive"],
  defaultState: {
    quantity: 60,
    quality: 50,
    spoilage: 0,
    basePrice: 2,
    salePrice: 3,
    storageAreaId: "cellar",
  },
});
```

### 9.2 Add Stock Module

Create:

```txt
/src/sim/modules/stock/stockModule.ts
```

The module should:

- Ensure stock items exist.
- Apply daily spoilage.
- Apply daily passive waste if appropriate.
- Validate stock.
- Produce stock report sections.

### 9.3 Add Coin Ledger

Create an economy ledger for each day:

```ts
type CoinLedgerEntry = {
  source: string;
  amount: number;
  category: "sales" | "purchase" | "wage" | "repair" | "rent" | "waste" | "other";
  tags: string[];
}
```

The ledger should support:

```ts
addCoin(amount, meta)
spendCoin(amount, meta)
getDailyProfitLoss()
```

Do not directly mutate coin everywhere without ledger entries.

### 9.4 Add Basic Sales Helpers

Create helpers but do not fully resolve customer traffic yet.

```ts
sellStockItem(stockId, quantity, buyerGroupId?)
consumeStockItem(stockId, quantity, reason)
restockItem(stockId, quantity, totalCost)
wasteStockItem(stockId, quantity, reason)
```

These should:

- Update stock quantity.
- Update coin when selling/buying.
- Add ledger entries.
- Clamp quantity at zero.
- Report shortages when requested quantity cannot be fulfilled.

### 9.5 Add Spoilage

Perishable items should spoil over time.

Spoilage should be affected by:

```txt
stock item settings
storage area cleanliness
storage area condition
possibly cellar risk
```

Initial simple rule:

```txt
perishable stock gains spoilage daily
bad storage increases spoilage faster
high spoilage reduces effective quality
```

Example:

```ts
effectiveQuality = quality - spoilage * 0.5
```

Do not over-tune yet.

### 9.6 Add Shortage Tracking

Create shortage records:

```ts
type ShortageRecord = {
  stockId: StockId;
  requested: number;
  available: number;
  day: number;
  reason: string;
}
```

Shortages should be visible in reports.

### 9.7 Add Stock Reports

Report:

```txt
quantity
quality
spoilage
effective quality
storage area
shortages
waste
top sales
```

Example:

```txt
STOCK REPORT

Ale
Quantity: 42
Quality: 51
Spoilage: 0
Status: Adequate

Stew
Quantity: 18
Quality: 46
Spoilage: 22
Status: Getting questionable

Mushrooms
Quantity: 35
Quality: 38
Spoilage: 41
Status: Risky
```

## Acceptance Criteria

Phase 9 is complete when:

- Stock items are registry-driven.
- Coin changes go through a ledger.
- Stock can be sold, consumed, restocked, wasted, and spoiled.
- Shortages are tracked.
- Spoilage affects effective quality.
- Stock reports exist.
- Tests verify stock safety and ledger accuracy.
- No card or narrative systems are added.

## Tests

Minimum tests:

```txt
default stock exists
stock quantities cannot become negative
selling ale increases coin and decreases ale
buying ale decreases coin and increases ale
consuming more stock than available creates shortage
perishable items spoil over days
non-perishable mugs do not spoil
bad cellar cleanliness increases mushroom spoilage
ledger daily profit/loss matches coin changes
stock report includes shortage records
```

## Do Not Do

Do not:

- Add full customer behaviour yet.
- Add card events about shortages.
- Add supplier negotiation complexity yet.
- Add recipe systems yet.
- Add brewing yet.
- Add cards or issue seeds.

---

# Phase 10 — Customer Group System

## Goal

Implement customer groups as simulation actors with preferences, traffic patterns, satisfaction, spending behaviour, tolerance levels, and basic impacts on the tavern.

Customers should not be generic visitors. Different groups should create different business identities and problems.

## Why This Phase Matters

Customer groups are one of the main engines of meaningful future cards.

The game needs to understand differences like:

```txt
Local goblins tolerate filth but spend little.
Merchants spend more but hate danger and dirty rooms.
Miners spend heavily on Payday and create mess.
Ogres are profitable but destructive.
Adventurers are high-value and high-risk.
```

This lets the tavern become different things depending on how the player runs it.

## Initial Customer Groups

Required:

```txt
local_goblins
miners
merchants
ogres
adventurers
```

Optional later:

```txt
thieves
inspectors
cultists
rat_catchers
city_watch
nobles_slumming_it
```

Inspectors are better treated as a monthly/pressure system later, not as normal customers yet.

## Customer Group State

Each group should track:

```ts
type CustomerGroupState = {
  id: CustomerGroupId;
  patronage: number;          // 0–100 likelihood/strength of visiting
  satisfaction: number;       // 0–100
  wealth: number;             // 0–100
  rowdiness: number;          // 0–100
  filthTolerance: number;     // 0–100
  dangerTolerance: number;    // 0–100
  priceSensitivity: number;   // 0–100
  loyalty: number;            // 0–100
  tabRisk: number;            // 0–100
  damageRisk: number;         // 0–100
  preferredStockTags: string[];
  dislikedTags: string[];
  tags: string[];
}
```

Do not worry if this seems slightly large. Customers are a core system.

## Customer Tags

Recommended:

```txt
local
worker
wealthy
rowdy
dangerous
cleanliness_sensitive
cheap_seeking
high_spend
food_focused
drink_focused
incident_prone
```

Examples:

```ts
local_goblins.tags = ["local", "cheap_seeking", "drink_focused"];
miners.tags = ["worker", "rowdy", "drink_focused"];
merchants.tags = ["wealthy", "cleanliness_sensitive", "high_spend"];
ogres.tags = ["rowdy", "dangerous", "high_spend", "incident_prone"];
adventurers.tags = ["dangerous", "high_spend", "incident_prone"];
```

## Tasks

### 10.1 Create Customer Registry

Create:

```txt
/src/sim/registries/customerRegistry.ts
```

Register the required groups with default values.

Example:

```ts
customerRegistry.register({
  id: "merchants",
  label: "Merchants",
  tags: ["wealthy", "cleanliness_sensitive", "high_spend"],
  defaultState: {
    patronage: 40,
    satisfaction: 50,
    wealth: 75,
    rowdiness: 15,
    filthTolerance: 20,
    dangerTolerance: 25,
    priceSensitivity: 35,
    loyalty: 25,
    tabRisk: 10,
    damageRisk: 5,
    preferredStockTags: ["quality_sensitive", "food"],
    dislikedTags: ["filth", "danger"],
  },
});
```

### 10.2 Add Customer Module

Create:

```txt
/src/sim/modules/customers/customerModule.ts
```

The module should:

- Ensure default customer groups exist.
- Forecast traffic.
- Resolve basic customer turnout.
- Update satisfaction based on tavern conditions.
- Generate customer report sections.

### 10.3 Implement Traffic Forecast

Traffic should depend on:

```txt
day type
patronage
satisfaction
reputation, if available
area cleanliness
area damage/risk
stock availability
prices
group preferences
```

Initial day type effects:

```txt
Supplier Day: lower traffic
Quiet Day: low local traffic
Market Day: merchants higher
Local Night: local goblins higher
Payday: miners much higher
Brawl Night: ogres/adventurers higher
Maintenance Day: lower traffic
```

A simple formula is fine.

Example pseudo-formula:

```txt
baseTraffic = patronage
+ dayTypeModifier
+ satisfactionModifier
+ stockPreferenceModifier
- cleanlinessPenalty if below tolerance
- pricePenalty based on priceSensitivity
```

Keep the result deterministic through seeded RNG.

### 10.4 Implement Basic Purchase Behaviour

Customer groups should attempt to buy items matching their preferences.

Examples:

```txt
local goblins: cheap ale, stew, mushrooms
miners: lots of ale, stew
merchants: better food/drink if cleanliness acceptable
ogres: lots of ale/stew, high damage risk
adventurers: higher spend, incident-prone
```

Use stock helpers from Phase 9.

If stock is missing, satisfaction should drop and shortage records should exist.

### 10.5 Implement Satisfaction Changes

Satisfaction should respond to:

```txt
stock availability
effective quality
cleanliness vs tolerance
danger/risk vs tolerance
price vs sensitivity
successful service
shortages
```

Example:

```txt
Merchants:
- strongly dislike dirty main room
- dislike low-quality stew
- like safe and reliable service

Local goblins:
- tolerate filth
- like cheap prices
- may not mind weird food as much

Ogres:
- tolerate danger
- dislike being restricted later
- cause damage
```

### 10.6 Implement Customer-Created Mess and Damage

Customers should affect the tavern physically.

Examples:

```txt
more customers → more mess
rowdy customers → more mess and damage
ogres → high furniture/main room damage
adventurers → incident/damage risk
miners on Payday → mess spike
```

At this stage, incidents can be numeric/logged only. Do not create cards.

Example report line:

```txt
Ogre traffic caused +6 main room damage.
```

### 10.7 Add Customer Reports

Report:

```txt
forecast traffic
actual traffic
satisfaction changes
sales by group
mess/damage caused
shortages experienced
top customer group
worst customer group
```

Example:

```txt
CUSTOMER REPORT

Local Goblins
Traffic: 22
Satisfaction: 57 → 60
Notes: Cheap stew helped. Filth was tolerated.

Merchants
Traffic: 4
Satisfaction: 42 → 35
Notes: Main room cleanliness below tolerance.

Miners
Traffic: 31
Satisfaction: 49 → 54
Notes: Payday ale sales were strong.
```

## Acceptance Criteria

Phase 10 is complete when:

- Customer groups are registry-driven.
- Day type affects traffic.
- Customer preferences affect purchases.
- Customers buy stock and generate coin.
- Customers react to cleanliness, quality, price, and shortages.
- Rowdy/dangerous groups create mess and damage.
- Customer reports explain changes.
- Tests prove different tavern conditions attract different groups.
- No real cards are introduced.

## Tests

Minimum tests:

```txt
default customer groups exist
Market Day increases merchant traffic
Payday increases miner traffic
Brawl Night increases ogre/adventurer traffic
dirty main room reduces merchant satisfaction
dirty main room has smaller effect on local goblins
ale shortage reduces miner satisfaction
high ale stock allows miner sales
ogre traffic increases main room damage
customer purchases increase coin through the ledger
customer report includes traffic and satisfaction changes
```

## Do Not Do

Do not:

- Add narrative customer cards.
- Add named individual customers yet.
- Add detailed incident cards.
- Add inspectors as full normal customers.
- Add staff interactions yet except placeholders.
- Add issue seeds yet.
- Hardcode customer logic in the engine instead of customer module.

---

# End-of-Batch Integration Check

After Phases 6–10, the simulation should support a basic headless run like this:

```txt
Start default tavern.
Run 28 days with no owner actions.
Each day:
- Calendar advances.
- Areas decay.
- Stock spoils.
- Customer traffic is forecast and resolved.
- Customers purchase stock.
- Coin changes through ledger.
- Mess and damage increase.
- Customer satisfaction changes.
- Reports are generated.
- State validates.
```

The output should not be exciting yet, but it should be mechanically legible.

Example expected debug summary:

```txt
Month 1, Day 5 — Payday

Areas:
- Main room got messier.
- Kitchen cleanliness declined slightly.
- Cellar stayed risky.

Stock:
- Ale sold heavily.
- Stew sold moderately.
- Mushrooms spoiled slightly.

Customers:
- Miner traffic was high.
- Merchant traffic was low because it was Payday and the main room was dirty.
- Local goblins remained steady.

Economy:
- Coin increased from sales.
- Ale stock fell.
- No wages/rent yet unless later phases add them.
```

## Batch Acceptance Criteria

This batch is complete when:

```txt
Phase 6: State validation exists and catches impossible taverns.
Phase 7: The engine runs a phase pipeline through modules.
Phase 8: Areas exist, decay, validate, and report.
Phase 9: Stock and coin economy work through helpers and ledger.
Phase 10: Customer groups visit, spend, react, and affect the tavern.
```

## Still Not Allowed After Phase 10

Even after this batch, do not add:

```txt
cards
card text
real event scenes
issue seed generation
response intent system
staff depth beyond placeholders
weekly wages
monthly rent
inspection pressure
memory-heavy story arcs
```

Those come later.

The tavern is not telling stories yet.

It is learning to rot, sell ale, lose merchants, attract miners, run out of stew, and explain the early shape of business pressure.

That is exactly where it should be.
