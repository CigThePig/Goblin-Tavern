# Goblin Tavern Simulation — Expanded Plan: Phases 11–15

This document expands **Phases 11 through 15** of the simulation-first build plan.

**Phase 1 is complete.**  
**Phases 2–10 should already be complete or in progress before this batch begins.**

This batch turns the tavern from a passive simulation into an interactive operational sim. By the end of Phase 15, the tavern should support:

- Staff roles, skill, morale, stress, fatigue, wages, and priorities.
- A complete daily service loop.
- Owner actions that meaningfully change the state.
- Weekly routines such as wages, supplier invoices, trends, and maintenance backlog.
- Monthly systems such as rent, landlord pressure, inspection windows, reputation shifts, and upgrade readiness.
- Strong debug reports for daily, weekly, and monthly scales.

This is still **not** the card phase.

No real cards, card text, card scenes, narrative choice writing, issue seed generation, or response-intent system should be added in this batch.

The tavern is becoming playable as a headless sim, but it is not yet speaking to the future card layer. That comes later.

---

# Current Phase Status

## Phase 1 — Simulation Contract & Design Rules

**Status:** Complete.

Do not expand Phase 1 in this batch.

All work in this batch must obey the core rule:

> The simulation is truth. Cards will eventually present simulation truth, but cards must not invent truth.

---

# Phase 11 — Staff System

## Goal

Implement staff as active simulation agents who affect service quality, cleaning, repairs, sales, customer satisfaction, tavern risk, and operating pressure.

Staff should not be passive modifiers. They should be living business constraints.

A dirty tavern should feel different if the cleaner is skilled and rested. A crowded Payday should feel different if the server is stressed. A good cook should make bad stock less disastrous, but not magically safe. A bouncer should reduce violence while costing wages and potentially changing the tavern’s identity.

## Why This Phase Matters

The staff system gives the tavern an internal workforce. Without staff, the player’s owner actions become too direct and too powerful. With staff, the player manages a messy operation instead of personally controlling every outcome.

Staff also create future card fuel:

```txt
The cook is overworked.
The server is pocketing coin.
The bouncer scares away merchants.
The cleaner refuses to enter the cellar.
Staff wages are overdue.
A staff member is loyal but exhausted.
```

Those future cards must come from simulation state.

## Required Staff Roles

Implement these initial staff roles:

```txt
cook
server
cleaner_bouncer
```

The combined `cleaner_bouncer` role is intentional for early scope control. It can later split into separate cleaner and bouncer roles once the sim proves the need.

Optional later roles:

```txt
dedicated_cleaner
dedicated_bouncer
bookkeeper
cellar_goblin
entertainer
brewer
room_keeper
rat_catcher
```

Do not add optional roles in this phase unless the base three are complete and tested.

## Staff State

Each staff member should track:

```ts
type StaffState = {
  id: StaffId;
  name: string;
  role: StaffRoleId;

  skill: number;        // 0–100
  morale: number;      // 0–100
  stress: number;      // 0–100
  fatigue: number;     // 0–100
  loyalty: number;     // 0–100

  wage: number;
  paidThisWeek: boolean;

  currentPriority?: StaffPriorityId;
  unavailable?: boolean;

  tags: string[];
  activeFlags: string[];
}
```

**Role typing clarification.** `role: StaffRoleId` is a registry string ID — the canonical type for this field — because the staff role registry (§11.1) is the source of truth for what roles exist. An earlier draft typed this as `role: StaffRole` (a literal union of `'cook' | 'server' | 'cleaner_bouncer'`), which conflicts with the `CLAUDE.md` rule that expandable concepts go through registries. If you see `StaffRole` as a hard-coded union elsewhere (including the Phase 5 staff defaults), treat it as legacy shorthand — implement `StaffRoleId` as `string` validated against `staffRegistry`. The same rule applies to `currentPriority: StaffPriorityId`, which is validated against `staffPriorityRegistry`.

Names can be simple placeholders for now. Do not write character backstories yet.

Example placeholder staff:

```txt
Gribna — cook
Nesk — server
Brug — cleaner_bouncer
```

## Staff Priority System

Staff should have daily priorities. Priorities guide behaviour during service.

### Cook Priorities

```txt
quality
speed
stretch_ingredients
clean_as_you_go
```

Expected effects:

```txt
quality:
  improves food quality and satisfaction
  increases ingredient usage
  increases fatigue/stress slightly

speed:
  serves more customers
  may reduce quality
  increases fatigue

stretch_ingredients:
  reduces stock usage
  may reduce food quality/satisfaction
  may increase spoilage/food safety risk if abused

clean_as_you_go:
  slows service slightly
  reduces kitchen mess/filth accumulation
```

### Server Priorities

```txt
maximize_sales
keep_customers_happy
watch_tabs
help_clean
```

Expected effects:

```txt
maximize_sales:
  increases sales
  increases stress
  may increase unpaid tabs/mistakes

keep_customers_happy:
  improves satisfaction
  may reduce sales efficiency

watch_tabs:
  reduces unpaid tabs/theft
  may reduce service speed

help_clean:
  reduces main room mess
  reduces service efficiency
```

### Cleaner/Bouncer Priorities

```txt
clean
minor_repairs
prevent_fights
intimidate_debtors
```

Expected effects:

```txt
clean:
  improves cleanliness/mess control
  weak fight prevention

minor_repairs:
  reduces small damage
  weak cleaning

prevent_fights:
  reduces rowdy damage/incidents
  may reduce rowdy customer satisfaction

intimidate_debtors:
  reduces unpaid tabs
  may increase dangerous/intimidating reputation later
```

## Tasks

### 11.1 Create Staff Registry

Create:

```txt
/src/sim/registries/staffRegistry.ts
/src/sim/registries/staffPriorityRegistry.ts
```

Register staff roles and priority definitions.

Staff roles should define:

```ts
type StaffRoleDefinition = {
  id: StaffRoleId;
  label: string;
  defaultTags: string[];
  allowedPriorities: StaffPriorityId[];
}
```

Staff priorities should define:

```ts
type StaffPriorityDefinition = {
  id: StaffPriorityId;
  label: string;
  roleId: StaffRoleId;
  tags: string[];
}
```

### 11.2 Add Staff Module

Create:

```txt
/src/sim/modules/staff/staffModule.ts
```

The module should:

- Ensure default staff exist.
- Validate staff state.
- Apply daily fatigue/stress changes.
- Apply priority effects during service phases.
- Support wage status for later weekly systems.
- Generate staff reports.

### 11.3 Add Staff Assignment Input

Extend daily simulation input:

```ts
type SimInput = {
  ownerActions?: OwnerActionInput[];
  staffPriorities?: Record<StaffId, StaffPriorityId>;
}
```

If no priority is assigned, staff should use a safe default:

```txt
cook: speed
server: keep_customers_happy
cleaner_bouncer: clean
```

### 11.4 Add Staff Performance Helpers

Create derived helpers:

```ts
getStaffEffectiveness(staff): number
getStaffStressPenalty(staff): number
getStaffFatiguePenalty(staff): number
getStaffMoraleBonus(staff): number
canStaffWork(staff): boolean
```

Effectiveness should consider:

```txt
skill
morale
stress
fatigue
unavailable state
```

Example rough formula:

```txt
effectiveness = skill
+ morale * 0.2
- stress * 0.25
- fatigue * 0.25
```

Clamp to 0–100.

Do not over-tune yet.

### 11.5 Add Priority Effects to Context

Staff priority effects should not directly bypass systems.

Good:

```txt
cook priority modifies food service quality calculation
server priority modifies sales/tabs/satisfaction calculation
cleaner_bouncer priority modifies mess/damage/fight calculations
```

Bad:

```txt
staff module hardcodes all customer sales and area damage logic internally
```

Keep responsibilities clean.

### 11.6 Add Staff Reports

Report:

```txt
name
role
priority
skill
morale
stress
fatigue
loyalty
effectiveness
wage
paid/unpaid status
notable changes
```

Example:

```txt
STAFF REPORT

Gribna — Cook
Priority: Stretch Ingredients
Skill: 68
Morale: 45
Stress: 62
Fatigue: 51
Effectiveness: 48
Notes: Saved ingredients but reduced stew quality.

Nesk — Server
Priority: Watch Tabs
Skill: 54
Morale: 58
Stress: 38
Fatigue: 44
Effectiveness: 55
Notes: Reduced unpaid tabs at the cost of sales speed.
```

## Sub-Batching Recommendation

Phase 11 is large enough to deserve atomic task splitting. Recommended sub-batches:

```txt
11a: Staff state schema, registry, default staff, state validation
11b: Staff priority system, priority registry, allowed priorities per role
11c: Staff performance helpers (effectiveness, stress/fatigue penalties)
11d: Staff hooks into service phases via context (plumbing only — Phase 12 wires them in)
11e: Staff reports
```

Each sub-batch should compile and pass its own tests before the next begins.

## Acceptance Criteria

Phase 11 is complete when:

- Staff roles are registry-driven.
- Default staff exist.
- Staff priorities can be assigned daily.
- Staff effectiveness is derived from skill, morale, stress, and fatigue.
- Staff priorities influence later service calculations.
- Staff reports exist.
- Staff state validates.
- No cards or narrative staff scenes are added.

## Tests

Minimum tests:

```txt
default staff exist
staff roles have allowed priorities
invalid priority for role fails validation or assignment
staff effectiveness decreases with high fatigue
staff effectiveness decreases with high stress
staff morale improves effectiveness
cook quality priority improves food quality calculation
server watch_tabs priority reduces unpaid tabs
cleaner_bouncer prevent_fights reduces rowdy damage risk
staff report includes priority and effectiveness
```

## Do Not Do

Do not:

- Add named character arcs.
- Add staff cards.
- Add firing/hiring complexity unless needed for base action placeholders.
- Add interpersonal drama yet.
- Add issue seeds.
- Add narrative prose.
- Make staff omnipotent or purely cosmetic.

---

# Phase 12 — Daily Service Simulation

## Goal

Implement the full daily service loop where customers arrive, staff perform, stock is consumed, coin is earned, mess and damage are created, satisfaction shifts, and daily reports summarize what happened.

This is the phase where the tavern first feels alive as a working business.

## Why This Phase Matters

Earlier phases created ingredients:

```txt
calendar
areas
stock
economy
customers
staff
```

Phase 12 combines them.

The daily service simulation should answer:

```txt
Who came in today?
What did they buy?
Was service good or bad?
What stock was used?
How much coin came in?
What mess/damage was created?
Did staff priorities matter?
Which customer groups became happier or angrier?
What changed enough to be noticed?
```

Still, this is not a card system. It is operational simulation.

## Daily Service Inputs

The service simulation should use:

```txt
calendar day type
area state
stock state
customer group state
staff state
staff priorities
prices
reputation, if implemented
seeded RNG
```

## Service Output

Each day should produce a structured service result:

```ts
type DailyServiceResult = {
  dayKey: string;
  trafficByGroup: Record<CustomerGroupId, number>;
  purchasesByGroup: Record<CustomerGroupId, PurchaseSummary>;
  coinEarned: number;
  stockConsumed: StockConsumptionSummary[];
  shortages: ShortageRecord[];
  messCreated: AreaChangeSummary[];
  damageCreated: AreaChangeSummary[];
  satisfactionChanges: CustomerSatisfactionChange[];
  staffChanges: StaffChangeSummary[];
  incidents: ServiceIncidentSummary[];
}
```

`incidents` are not cards. They are structured numeric/log summaries.

Example:

```txt
minor_brawl
dropped_tray
unpaid_tabs
ogre_chair_damage
stew_shortage
```

Do not write full scenes for them.

## Tasks

### 12.1 Build Service Resolver

Create:

```txt
/src/sim/modules/service/serviceModule.ts
/src/sim/modules/service/resolveService.ts
```

If service logic belongs inside the customer module based on earlier architecture, keep it there only if it remains clean. Prefer a dedicated service module that coordinates customers, stock, staff, and areas.

The service module should run during:

```txt
beforeService
service
afterService
closing
```

### 12.2 Resolve Customer Turnout

Use Phase 10 forecast logic to produce actual turnout.

Actual turnout should include small deterministic variation from RNG.

Example:

```txt
forecast miners: 30
actual miners: 27–34 depending on seeded RNG and conditions
```

Do not make variation too wild.

### 12.3 Resolve Purchases

Each customer group should attempt purchases based on:

```txt
traffic count
wealth
preferred stock tags
stock availability
sale price
price sensitivity
stock quality
effective service quality
```

Use Phase 9 stock helpers so sales affect stock and coin through the ledger.

### 12.4 Resolve Service Quality

Service quality should be derived from staff effectiveness and priorities.

Example factors:

```txt
cook effectiveness affects food quality/speed
server effectiveness affects sales/satisfaction/tabs
cleaner_bouncer affects mess/fights/damage
```

Create a derived daily service quality object:

```ts
type ServiceQuality = {
  foodQualityModifier: number;
  serviceSpeed: number;
  tabControl: number;
  messControl: number;
  fightControl: number;
  repairSupport: number;
}
```

### 12.5 Resolve Mess and Damage

Mess should come from:

```txt
traffic volume
food/drink consumption
rowdiness
day type
staff mess control
area cleanliness
```

Damage should come from:

```txt
rowdiness
ogre traffic
adventurer traffic
brawl night
low fight control
existing risk/damage
```

Apply mess/damage mostly to:

```txt
main_room
kitchen
privy
cellar, if storage/stock issues occur
```

### 12.6 Resolve Unpaid Tabs / Theft

Implement a simple unpaid tab mechanic.

Unpaid tabs should depend on:

```txt
customer group tabRisk
traffic
server watch_tabs priority
bouncer intimidate_debtors priority
danger/rowdy environment
```

Unpaid tabs should reduce actual coin compared to expected sales.

Track in daily report.

### 12.7 Resolve Basic Incidents

Add low-detail incident summaries.

Examples:

```txt
minor_brawl
chair_damage
stock_shortage
food_complaint
unpaid_tabs
slippery_floor
```

These should be structured logs only.

Example:

```ts
{
  id: "chair_damage",
  severity: 22,
  actorGroup: "ogres",
  areaId: "main_room",
  effects: ["main_room.damage +4"]
}
```

No prose scenes.

### 12.8 Update Satisfaction

At the end of service, customer satisfaction should change based on:

```txt
got preferred items
shortages
price vs value
service quality
cleanliness tolerance
danger tolerance
incidents
food/drink quality
```

### 12.9 Update Staff Stress/Fatigue

Daily service should affect staff:

```txt
high traffic increases fatigue
high incidents increase stress
priority choice affects stress/fatigue
bad conditions increase stress
successful service may improve morale slightly
unpaid wages later affect morale
```

### 12.10 Generate Daily Service Report

Report should include:

```txt
traffic by group
sales
stock consumed
shortages
coin earned
unpaid tabs
mess/damage
staff performance
satisfaction changes
incidents
largest positive driver
largest negative driver
```

Example:

```txt
DAILY SERVICE REPORT — Payday

Traffic:
- Local Goblins: 18
- Miners: 34
- Merchants: 3
- Ogres: 4
- Adventurers: 2

Economy:
- Coin earned: 73
- Unpaid tabs: 8
- Best seller: Ale

Stock:
- Ale: -41
- Stew: -18
- Shortage: Ale nearly depleted

Tavern Impact:
- Main room mess +12
- Main room damage +6
- Kitchen cleanliness -5

Staff:
- Server stress +8
- Cook fatigue +7
- Cleaner/Bouncer prevented one minor brawl

Customer Satisfaction:
- Miners +6
- Merchants -4
- Ogres +2
```

## Sub-Batching Recommendation

Phase 12 is the largest single phase in the plan. Splitting is required, not optional. Recommended sub-batches:

```txt
12a: Service resolver skeleton, customer turnout resolution with deterministic variation
12b: Purchase resolution, service quality derivation from staff effectiveness
12c: Mess and damage application to areas, unpaid tabs/theft
12d: Incident summaries (structured, not prose), satisfaction updates
12e: Staff stress/fatigue updates from service, daily service report
```

Each sub-batch should run a single-day headless test before the next begins. Do not chain all five sub-batches into one task file. The temptation is real because the service loop feels like one thing — but it is five things that touch every earlier phase, and debugging a single five-system change is harder than debugging five sequential ones.

## Acceptance Criteria

Phase 12 is complete when:

- A complete service day can resolve without owner actions.
- Customers arrive, buy stock, create income, and affect the tavern.
- Staff priorities modify outcomes.
- Stock and coin update through existing helpers/ledger.
- Mess and damage update areas.
- Satisfaction updates customer groups.
- Staff stress/fatigue update.
- Daily service report is clear and useful.
- No narrative cards are added.

## Tests

Minimum tests:

```txt
Payday creates higher miner turnout than Quiet Day
customers purchase stock and increase coin
stock shortages reduce customer satisfaction
server watch_tabs reduces unpaid tabs
cleaner_bouncer prevent_fights reduces brawl/damage
cook stretch_ingredients reduces stock use but lowers food satisfaction
high ogre traffic increases main room damage
dirty main room reduces merchant satisfaction during service
daily service report includes traffic, coin, stock, damage, and satisfaction
state validates after service
```

## Do Not Do

Do not:

- Add real cards.
- Add card choices.
- Add narrative service scenes.
- Add issue seeds.
- Add complex combat/brawl systems.
- Add named customer personalities.
- Add UI beyond debug output.

---

# Phase 13 — Owner Action System

## Goal

Implement daily owner actions that allow the player to meaningfully intervene in the tavern before service.

Owner actions are the player’s primary direct control layer before cards exist.

Actions should create noticeable effects, tradeoffs, and state changes.

## Why This Phase Matters

The simulation must eventually receive player choices from cards. Owner actions are the first direct proof that player input can alter the tavern in meaningful ways.

Before card development starts, the player should be able to play a crude headless version using action inputs like:

```txt
clean kitchen
repair main room
restock ale
pay staff bonus
water down ale
patch roof
fumigate cellar
change prices
```

If these actions do not matter, future card choices will not matter either.

## Action Design Rules

Each action should define:

```txt
id
label
target type
requirements
cost
effects
side effects
report output
validation
```

Each meaningful action should affect at least two state areas when possible.

Example:

```txt
clean kitchen:
  kitchen cleanliness up
  food safety risk down later
  owner action slot spent
  possibly staff stress down if kitchen was bad
```

Avoid actions that only do:

```txt
stat +5
```

They can be simple, but they should have context.

## Required Owner Actions

Implement these core actions:

```txt
clean_area
repair_area
restock_item
adjust_prices
pay_staff_bonus
water_down_ale
improve_stew
patch_roof
fumigate_cellar
buy_mugs
```

Optional later:

```txt
hire_staff
fire_staff
negotiate_supplier
bribe_inspector
advertise
host_theme_night
ban_customer_group
upgrade_area
borrow_money
```

Do not add optional actions unless required for the base simulation.

## Action Point Limit

Start with:

```txt
3 owner action slots per day
```

Some actions may cost more than one slot later, but for this phase keep all core actions at 1 slot unless there is a strong reason.

## Tasks

### 13.1 Create Action Registry

Create:

```txt
/src/sim/registries/actionRegistry.ts
/src/sim/modules/ownerActions/ownerActionsModule.ts
```

Action definitions should be data-driven:

```ts
type OwnerActionDefinition = {
  id: OwnerActionId;
  label: string;
  targetType?: "area" | "stock" | "staff" | "global";
  tags: string[];
  actionPointCost: number;

  getValidTargets(ctx: SimContext): ActionTarget[];
  canApply(ctx: SimContext, input: OwnerActionInput): ActionValidationResult;
  apply(ctx: SimContext, input: OwnerActionInput): void;
}
```

### 13.2 Add Owner Action Input

Define:

```ts
type OwnerActionInput = {
  actionId: OwnerActionId;
  targetId?: string;
  amount?: number;
  options?: Record<string, unknown>;
}
```

The engine should accept up to 3 action points worth of inputs per day.

Invalid actions should produce clear validation errors.

### 13.3 Implement `clean_area`

Target: area.

Effects:

```txt
area cleanliness up
area smell down if relevant
area risk down slightly
```

Scaling:

```txt
bigger effect if area is very dirty
smaller effect if already clean
```

Report:

```txt
Cleaned Kitchen: cleanliness 31 → 52, smell 44 → 35
```

### 13.4 Implement `repair_area`

Target: area.

Effects:

```txt
area damage down
area condition up
coin down
```

Cost should scale with damage.

If coin is insufficient, either:

```txt
block action
```

or:

```txt
allow partial repair
```

Pick one simple behaviour and document it.

Recommended early behaviour: block if insufficient coin.

### 13.5 Implement `restock_item`

Target: stock.

Effects:

```txt
stock quantity up
coin down
possibly quality based on purchase option later
```

For now, use base restock cost from stock definition.

Do not add supplier complexity yet.

### 13.6 Implement `adjust_prices`

Target: global or stock category.

Start simple:

```txt
ale sale price +1/-1
stew sale price +1/-1
```

Effects are not immediate except future customer purchasing/satisfaction.

Ensure prices cannot go below 1.

### 13.7 Implement `pay_staff_bonus`

Target: staff.

Effects:

```txt
coin down
staff morale up
staff stress down slightly
loyalty up slightly
```

### 13.8 Implement `water_down_ale`

Target: ale stock.

Effects:

```txt
ale quantity up or effective servings up
ale quality down
cheap/profit potential up during service
customer satisfaction risk later
```

This action should create a temporary flag or stock quality penalty that future memory/cause systems can use later.

At this phase, just apply the mechanical effect and log it.

### 13.9 Implement `improve_stew`

Target: stew/ingredients.

Effects:

```txt
ingredient or mushroom quantity down
stew quality up
cook stress/fatigue may rise slightly
```

Requires enough ingredients.

### 13.10 Implement `patch_roof`

Target: roof.

Effects:

```txt
roof damage down
roof condition up
coin down
future leak risk reduced
```

This may overlap with `repair_area`, but it is useful as a named action because roof/weather systems will become important later.

### 13.11 Implement `fumigate_cellar`

Target: cellar.

Effects:

```txt
cellar risk down
pest-related placeholder value down if available
cellar smell up temporarily
stock quality/spoilage risk maybe affected if food stored there
coin down
```

If there is no pest system yet, apply risk/smell/cellar cleanliness effects only.

### 13.12 Implement `buy_mugs`

Target: mugs stock.

Effects:

```txt
mugs quantity up
coin down
service capacity improves later
```

### 13.13 Generate Owner Action Report

Report:

```txt
actions attempted
actions applied
actions rejected
action point usage
state changes
coin spent
notable side effects
```

Example:

```txt
OWNER ACTION REPORT

Actions Used: 3/3

1. Clean Kitchen
   Cleanliness: 28 → 49
   Smell: 51 → 42

2. Restock Ale
   Ale: 12 → 52
   Coin: 74 → 34

3. Pay Staff Bonus: Gribna
   Morale: 41 → 52
   Stress: 66 → 61
   Coin: 34 → 24
```

## Acceptance Criteria

Phase 13 is complete when:

- Owner actions are registry-driven.
- The engine accepts and applies up to 3 daily action slots.
- Invalid actions are rejected clearly.
- Core actions exist and affect the simulation.
- Actions produce report output.
- Actions influence later service outcomes.
- No cards or issue seeds are added.

## Tests

Minimum tests:

```txt
only 3 action points can be spent per day
clean_area improves cleanliness
repair_area reduces damage and costs coin
restock_item increases stock and costs coin
adjust_prices changes sale price and respects minimum price
pay_staff_bonus improves morale and costs coin
water_down_ale increases quantity/servings but lowers quality
improve_stew raises stew quality and consumes ingredients
patch_roof improves roof state
fumigate_cellar reduces cellar risk but increases smell temporarily
buy_mugs increases mugs stock
invalid target rejects action
owner action report includes applied and rejected actions
actions affect same-day service where relevant
state validates after owner actions
```

## Do Not Do

Do not:

- Add card choices.
- Add narrative action text beyond debug labels.
- Add complex supplier negotiation.
- Add full upgrade trees yet.
- Add permanent memories yet except simple flags if required.
- Add issue seeds.

---

# Phase 14 — Weekly Routine System

## Goal

Implement the weekly layer of simulation: wages, supplier invoices, weekly trends, rumour drift, maintenance backlog, staff fatigue patterns, and weekly reports.

The daily loop shows operations. The weekly loop reveals patterns.

## Why This Phase Matters

A tavern sim should not feel like isolated days. A good week should feel different from a bad week. Ignoring repairs for six days should create a weekly maintenance problem. High traffic should create profit and fatigue. Unpaid wages should start to matter.

Weekly systems create rhythm.

## Weekly Responsibilities

At the end of each 7-day week, resolve:

```txt
staff wages
supplier invoices
basic debt/invoice carryover
weekly profit/loss summary
staff fatigue/stress trend
maintenance backlog
rumour/reputation drift
customer loyalty trends
stock warnings
area condition warnings
```

Do not add monthly rent here. That belongs in Phase 15.

## Tasks

### 14.1 Add Weekly Module

Create:

```txt
/src/sim/modules/weekly/weeklyModule.ts
```

The module should run during:

```txt
endWeek
generateReports
```

### 14.2 Implement Wages

At end of week:

```txt
sum staff wages
attempt payment from coin
if paid:
  coin decreases
  staff paidThisWeek = true
  morale stable or slightly up
if unpaid:
  staff paidThisWeek = false
  morale down
  stress up
  loyalty down
```

Choose simple behaviour:

Recommended:

```txt
If coin can cover all wages, pay all wages automatically.
If coin cannot cover all wages, pay none automatically and mark wages unpaid.
```

Partial wage payment can be added later, but it complicates early testing.

Add a ledger entry.

### 14.3 Implement Supplier Invoices

Keep supplier logic simple.

At end of week, calculate stock restock credit/invoice if any restocking happened through actions.

Two options:

Option A, simpler:

```txt
Restocking costs coin immediately.
No supplier invoice yet.
Weekly report only summarizes purchases.
```

Option B, more sim-rich:

```txt
Restocking creates supplier invoice.
Invoice due at end of week.
Unpaid invoice becomes supplier debt.
```

For this phase, pick **Option A** unless earlier design already built invoice tracking.

However, create a placeholder structure for future supplier invoices:

```ts
type SupplierInvoice = {
  id: string;
  amount: number;
  dueWeek: number;
  paid: boolean;
  relatedStockIds: StockId[];
}
```

Do not overbuild supplier relationships yet.

### 14.4 Add Weekly Profit/Loss Summary

Aggregate ledger entries from the last 7 days:

```txt
sales
purchases
repairs
wages
other costs
net profit/loss
```

Report:

```txt
Weekly Sales: +312
Restocking: -84
Repairs: -36
Wages: -42
Net: +150
```

### 14.5 Add Maintenance Backlog

Create a weekly maintenance backlog summary from area states.

Backlog should identify areas with:

```txt
high damage
low condition
low cleanliness
high smell
high risk
```

Example:

```txt
Maintenance Backlog:
- Kitchen cleanliness critical.
- Main room damage rising.
- Roof condition below safe threshold.
```

This is not an issue seed yet. It is a report.

### 14.6 Add Staff Weekly Trend

At end of week, staff should react to the week.

Inputs:

```txt
average fatigue
average stress
wages paid/unpaid
traffic intensity
bad working conditions
successful profitable week
```

Effects:

```txt
fatigue may recover slightly if week was quiet
stress may rise if conditions were bad
morale may rise if paid and profitable
morale drops if unpaid or overworked
```

Keep the math modest.

### 14.7 Add Customer Weekly Trend

At end of week, customer groups should shift slightly based on repeated experience.

Examples:

```txt
miners who had successful Payday become more likely next week
merchants who repeatedly disliked filth lose patronage
local goblins with cheap food gain loyalty
ogres with high satisfaction increase patronage and future damage risk
```

This phase uses only aggregate weekly summaries. Detailed per-day customer records are part of the Phase 16 history log and are not available yet.

Phase 14.7 should compute trends from:

```txt
weekly traffic totals by group
weekly satisfaction average by group
weekly shortage count
weekly day-type distribution
end-of-week satisfaction snapshot vs. start-of-week snapshot
```

When Phase 16 lands, the history log will offer per-day records for any module that wants finer-grained trends. Phase 14.7 does not need to be rewritten when that happens — it can continue using aggregates, or opt into richer history queries later. Either is acceptable.

Do not introduce ad-hoc daily record arrays here just to make 14.7 work. That is exactly the path Phase 16 is meant to solve cleanly.

### 14.8 Add Rumour/Reputation Drift Placeholder

Do not build full reputation identity yet. That is mostly Phase 15.

But weekly reports should begin tracking signals:

```txt
cheap signal
filthy signal
danger signal
tasty signal
reliable signal
```

Example:

```txt
This week increased Cheap and Filthy signals.
```

These signals can become reputation shifts in Phase 15.

### 14.9 Generate Weekly Report

Report should include:

```txt
week number
profit/loss
wages paid/unpaid
top revenue source
largest cost
best customer group
worst customer group
maintenance backlog
stock warnings
staff trend
customer trend
reputation signals
```

Example:

```txt
WEEKLY REPORT — Week 2, Month 1

Economy:
Sales: +284
Purchases: -70
Repairs: -22
Wages: -42
Net: +150

Wages:
Paid in full.

Staff:
Gribna stress rose due to heavy stew demand.
Nesk morale improved after wages were paid.
Brug fatigue rose after repeated Brawl Night damage.

Customers:
Miners are becoming regulars.
Merchants are visiting less due to filth.
Ogres caused the largest repair cost.

Maintenance:
Kitchen cleanliness is critical.
Main room damage is worsening.
Roof remains neglected.

Signals:
Cheap +8
Filthy +11
Dangerous +6
Reliable -4
```

## Acceptance Criteria

Phase 14 is complete when:

- End-week logic runs only at week boundary.
- Wages resolve.
- Weekly ledger summary exists.
- Maintenance backlog exists.
- Staff weekly trends exist.
- Customer weekly trends exist.
- Reputation signals begin accumulating.
- Weekly report is clear and useful.
- No cards or issue seeds are added.

## Tests

Minimum tests:

```txt
endWeek runs on final day of week
wages paid when coin is sufficient
wages unpaid when coin is insufficient
unpaid wages reduce morale and loyalty
weekly profit/loss matches ledger entries
maintenance backlog flags dirty/damaged areas
heavy miner traffic increases miner patronage slightly
repeated merchant dissatisfaction lowers merchant patronage
weekly report includes wages, economy, maintenance, staff, customers, and signals
state validates after endWeek
```

## Do Not Do

Do not:

- Add rent here.
- Add landlord cards.
- Add supplier relationship complexity unless absolutely needed.
- Add real reputation tiers yet if not ready.
- Add issue seeds.
- Add narrative event cards.
- Add monthly upgrades.

---

# Phase 15 — Monthly Pressure System

## Goal

Implement the monthly strategic layer: rent, landlord pressure, inspection windows, reputation shifts, upgrade readiness, rival tavern pressure placeholders, month modifiers, and monthly reports.

The daily loop is operations.  
The weekly loop is routine.  
The monthly loop is identity and survival.

## Why This Phase Matters

A tavern should not only survive day-to-day. It should become something over time.

At the monthly layer, the simulation should answer:

```txt
Did the tavern pay rent?
What reputation is forming?
Is the landlord pleased or worried?
Are inspectors becoming interested?
Are upgrades possible?
Is a rival tavern gaining advantage?
What unresolved problems are now strategic threats?
What kind of tavern is this becoming?
```

This phase creates the long-term pressure needed before memories, cause tracking, feedback loops, and issue seeds become meaningful.

## Monthly Responsibilities

At the end of each 28-day month, resolve:

```txt
rent
landlord opinion
inspection window/suspicion
reputation tier changes
upgrade readiness
rival tavern pressure placeholder
monthly condition modifier
strategic summary
```

## Tasks

### 15.1 Add Monthly Module

Create:

```txt
/src/sim/modules/monthly/monthlyModule.ts
```

The module should run during:

```txt
endMonth
generateReports
```

### 15.2 Implement Rent

Add monthly rent state:

```ts
type RentState = {
  monthlyAmount: number;
  paidThisMonth: boolean;
  missedPayments: number;
}
```

At end of month:

```txt
if coin >= rent:
  pay rent
  coin decreases
  paidThisMonth = true
  landlord pressure stable/down
else:
  paidThisMonth = false
  missedPayments += 1
  landlord pressure up
  debt or arrears increase
```

Use ledger entries for rent payment.

Recommended starting rent:

```txt
100–150 coin
```

Tune later.

### 15.3 Add Landlord Pressure

Add:

```ts
type LandlordState = {
  opinion: number;    // 0–100
  pressure: number;   // 0–100
  missedRentCount: number;
}
```

Landlord pressure should respond to:

```txt
missed rent
high damage
bad reputation
dangerous reputation
inspection suspicion
timely rent payment
repairs/improvements
```

No landlord cards yet.

Report only.

### 15.4 Add Inspection Window

Implement inspection suspicion as a monthly pressure placeholder.

```ts
type InspectionState = {
  suspicion: number;       // 0–100
  lastInspectionMonth?: number;
  warningCount: number;
}
```

Suspicion should rise from:

```txt
low kitchen cleanliness
high privy smell
food spoilage
merchant dissatisfaction
sickness-like shortage/quality signals if available
filthy reputation
```

Suspicion should fall from:

```txt
clean kitchen
clean privy
good repair state
low food spoilage
high reliable reputation
```

At this phase, inspections do not need to fully occur. They can be represented as:

```txt
inspection risk increased
inspection window likely next month
inspection warning threshold crossed
```

Actual inspection event seeds/cards come later.

#### Inspector Visit Event Deferral

The actual inspector visit event — an inspector physically arrives, inspects areas, makes a finding, levies a fine or warning — is **not** part of any Phase 2–20 work. It is card-shaped content that depends on the Phase 19 seed system plus real card development, which begins after Phase 20.

For the cardless build, inspection pressure is allowed to rise indefinitely without resolving into an event. This is intentional. The Phase 20 cardless playtest should show inspection suspicion accumulating to dangerous levels without anything physically happening. That is the pressure waiting for a card to discharge it.

If this feels wrong during Phase 20 — inspection suspicion is meaningful in the data but never matters in play — that is a signal that either:

- the suspicion calculation needs to feed back into something the cardless sim already has (merchant satisfaction, customer turnout, landlord pressure), or
- the project is ready for card development sooner than expected.

Do not solve this by adding a one-off inspection event in Phase 15. The plan deliberately keeps event-shaped resolutions out of the cardless build.

### 15.5 Implement Reputation Axes and Monthly Shifts

Reputation should be multi-axis, not one number.

Initial axes:

```txt
cheap
tasty
filthy
dangerous
cozy
reliable
goblin_authentic
respectable
strange
```

If Phase 5 already created reputation state, expand it here.

Monthly reputation shifts should come from accumulated weekly signals and monthly outcomes.

Examples:

```txt
cheap rises if prices were low and sales high
filthy rises if cleanliness stayed low
dangerous rises if rowdy incidents/damage were common
tasty rises if stew/ale quality and food satisfaction were high
reliable drops if stock shortages were common
respectable rises if merchants were satisfied and cleanliness high
goblin_authentic rises if local goblins are loyal and tavern remains rough/cheap
strange rises from weird stock/quality placeholders later
```

Do not make reputation purely good/bad. Reputation axes should attract some groups and repel others.

### 15.6 Add Reputation Tier Bands

For each axis, create bands:

```txt
0–19: absent
20–39: faint
40–59: known
60–79: strong
80–100: defining
```

Example:

```txt
Filthy: strong
Cheap: defining
Reliable: faint
Respectable: absent
```

These tiers will be useful for future issue seed/card selection.

### 15.7 Add Upgrade Readiness

Do not build upgrades yet. Add readiness signals.

Upgrade readiness should identify possible future improvements based on state.

Examples:

```txt
main room upgrade readiness if coin high and main room condition stable
kitchen upgrade readiness if food sales high
cellar storage upgrade readiness if stock shortages/spoilage common
extra staff readiness if traffic high and staff fatigue high
security upgrade readiness if damage/fights high
```

Report only.

Example:

```txt
Upgrade Readiness:
- Extra Cellar Shelving: relevant due to frequent ale shortages.
- Better Kitchen Tools: relevant due to high stew sales and cook fatigue.
- Reinforced Furniture: relevant due to ogre damage.
```

No upgrade actions yet unless already planned elsewhere.

### 15.8 Add Rival Tavern Pressure Placeholder

Add a minimal rival tavern state:

```ts
type RivalTavernState = {
  pressure: number;       // 0–100
  appeal: number;         // 0–100
  strategy?: "clean" | "cheap" | "rowdy" | "fancy" | "unknown";
}
```

Rival pressure can rise if:

```txt
merchant satisfaction is low
respectable reputation is low
customer groups are underserved
tavern reliability is poor
```

Rival pressure can fall if:

```txt
local loyalty is high
prices are competitive
tavern identity is strong
```

Keep it light. Rival tavern content comes later.

### 15.9 Add Month Modifiers

Add a simple monthly modifier system.

Examples:

```txt
rainy_month
festival_month
tax_month
mold_bloom
quiet_roads
adventurer_season
```

For now, pick one modifier at month start using seeded RNG.

Each modifier should have simple mechanical effects.

Examples:

```txt
rainy_month:
  roof condition matters more
  merchant traffic slightly down
  mushroom spoilage/growth risk up later

festival_month:
  traffic up
  mess up
  inspection suspicion up slightly

tax_month:
  customer spending slightly down
  landlord pressure slightly up
```

These modifiers should affect reports and later simulation. Do not create cards from them yet.

### 15.10 Generate Monthly Report

Report should include:

```txt
month number
rent result
ending coin
landlord pressure
inspection suspicion
reputation shifts and tiers
best/worst customer group
major unresolved problems
upgrade readiness
rival pressure
next month modifier
strategic summary
```

Example:

```txt
MONTHLY REPORT — Month 1

Rent:
Paid 120 coin.
Ending Coin: 47

Landlord:
Opinion: 54 → 58
Pressure: 31 → 27
Reason: Rent paid, but main room damage remains visible.

Inspection:
Suspicion: 42 → 56
Reason: Kitchen cleanliness and privy smell are poor.

Reputation:
Cheap: 48 → 63 strong
Filthy: 39 → 58 known
Dangerous: 21 → 35 faint
Reliable: 44 → 36 faint
Goblin Authentic: 52 → 68 strong

Customers:
Miners are becoming regulars.
Merchants are slipping away.
Local goblins are loyal.

Upgrade Readiness:
- Reinforced Furniture
- Better Kitchen Tools
- Extra Ale Storage

Rival Tavern:
Pressure: 18 → 27
Reason: Merchants are underserved.

Next Month Modifier:
Rainy Month
```

### 15.11 Add End-of-Batch Policy Bot Sanity Check

Before declaring this batch (Phases 11–15) complete, run a stripped policy bot smell test.

This is not the full Phase 20 strategy comparison. It is the minimum check to catch sim-is-stagnant problems before instrumenting them with causes, pressures, and seeds in Phases 16–19.

Run three minimum-viable bots:

```txt
auto_no_owner_actions:  run for 1 month, no owner actions, default staff priorities
auto_always_clean:      run for 1 month, every day clean the dirtiest area
auto_always_restock:    run for 1 month, every day restock the lowest stock item
```

For each run, capture:

```txt
ending coin
rent paid/missed
top 3 customer groups by traffic
worst area condition
weekly profit/loss curve
final reputation tier per axis
```

Pass criteria:

- All three runs complete without invalid state.
- At least one run misses rent or comes close. At least one pays comfortably.
- The three runs produce visibly different ending states. If two of three are indistinguishable, the simulation does not yet differentiate strategies and Phases 16–19 should not be built on top of it.
- Reports are readable end-to-end.

If the check fails, fix the imbalance before continuing. The most common failures will be:

```txt
the tavern is trivially profitable - economy too generous
the tavern collapses on day 3 - economy too harsh, or decay too fast
all three runs look the same - actions/priorities don't matter enough yet
reports are missing key information - report aggregation has gaps
```

This is a smell test, not a balance pass. The simulation does not need to be tuned yet. It needs to be *responsive* to different inputs.

## Sub-Batching Recommendation

Phase 15 covers many systems. Recommended sub-batches:

```txt
15a: Monthly module skeleton, rent state, rent resolution through ledger
15b: Landlord pressure state and update rules
15c: Inspection suspicion state and update rules
15d: Reputation axis monthly shifts and tier bands
15e: Upgrade readiness, rival tavern pressure placeholder
15f: Month modifiers, monthly report
15g: Policy bot sanity check (15.11 above)
```

Each sub-batch should run an `endMonth` test before the next begins. Sub-batch 15g should not run until 15a–15f all pass their own tests.

## Acceptance Criteria

Phase 15 is complete when:

- End-month logic runs only at month boundary.
- Rent resolves through ledger.
- Landlord pressure exists and changes.
- Inspection suspicion exists and changes.
- Reputation axes shift monthly.
- Reputation tier bands exist.
- Upgrade readiness report exists.
- Rival tavern pressure placeholder exists.
- Month modifiers exist and affect simulation.
- Monthly report is clear and useful.
- Three-bot sanity check (15.11) passes.
- No cards or issue seeds are added.

## Tests

Minimum tests:

```txt
endMonth runs on final day of month
rent is paid when coin is sufficient
missed rent increases missed payment count
missed rent increases landlord pressure
high kitchen filth increases inspection suspicion
clean tavern lowers inspection suspicion
cheap pricing signals increase cheap reputation
dirty areas increase filthy reputation
high rowdy damage increases dangerous reputation
stock shortages lower reliable reputation
reputation tiers classify values correctly
upgrade readiness appears for relevant repeated pressures
rival pressure rises when merchants are underserved
month modifier is selected deterministically from seed
monthly report includes rent, landlord, inspection, reputation, upgrades, rival, and modifier
state validates after endMonth
auto_no_owner_actions bot completes one month without invalid state
auto_always_clean bot completes one month without invalid state
auto_always_restock bot completes one month without invalid state
the three bots produce visibly different ending states (coin, reputation, area condition)
```

## Do Not Do

Do not:

- Add landlord cards.
- Add inspection cards.
- Add actual card issue seeds.
- Add full upgrade purchase system unless separately planned.
- Add rival tavern event content.
- Add narrative arcs.
- Add prose-heavy summaries beyond debug reports.
- Make reputation a single good/bad score.

---

# End-of-Batch Integration Check

After Phases 11–15, the simulation should support a headless run like this:

```txt
Start default tavern.
Run 28 days.
Each day:
- Owner actions can be applied.
- Staff priorities can be assigned.
- Customers arrive based on day type and conditions.
- Service resolves.
- Stock, coin, areas, staff, and customers update.
- Daily reports are generated.

Each week:
- Wages resolve.
- Weekly profit/loss is summarized.
- Maintenance backlog is identified.
- Staff/customer trends update.
- Weekly reports are generated.

At month end:
- Rent resolves.
- Landlord pressure updates.
- Inspection suspicion updates.
- Reputation axes shift.
- Upgrade readiness appears.
- Rival pressure placeholder updates.
- Next month modifier is selected.
- Monthly report is generated.
```

The player should now be able to run a crude, cardless tavern management sim through structured inputs and reports.

It should be possible to compare different strategies, such as:

```txt
always clean
always repair
always restock
maximize cheap ale
cater to miners
try to attract merchants
ignore staff
ignore repairs
```

The simulation does not need perfect balance yet, but different strategies should visibly produce different tavern identities and problems.

## Batch Acceptance Criteria

This batch is complete when:

```txt
Phase 11: Staff exist, work, tire, stress, and affect service.
Phase 12: Daily service resolves as a complete operational loop.
Phase 13: Owner actions provide meaningful direct player control.
Phase 14: Weekly routines summarize and compound daily behaviour.
Phase 15: Monthly pressures define survival, reputation, and tavern identity.
Phase 15.11: Three-bot sanity check produces visibly distinct ending states.
```

## Still Not Allowed After Phase 15

Even after this batch, do not add:

```txt
real cards
card text
card scenes
issue seeds
response intents
future card choice logic
deep memory/history arcs
full causal explanation layer
feedback loop detection
balance bot suites
property-based fuzzing beyond basic state safety
```

Those come in Phases 16–20.

At this stage, the tavern should be a working goblin business simulator.

It should sell ale, rot floors, exhaust staff, annoy merchants, attract miners, pay wages, scrape together rent, earn a reputation, and reveal monthly pressure.

It should not yet speak in cards.

That comes after it learns to remember, explain, pressure, and expose card-ready issue seeds.
