# Goblin Tavern Simulation — Phases 2–5 Implementation Plan

Status: **Phase 1 complete**  
Scope of this document: **Expand Phases 2–5 only**  
Purpose: Give an implementation agent enough detail to build the first technical foundation of the simulation without drifting into cards, UI polish, or content writing.

---

## Phase 1 — Simulation Contract & Design Rules

**Status: Completed**

Phase 1 established the foundational design rule:

> The simulation is the source of truth. Cards will later reveal, interpret, escalate, or resolve simulation truth, but cards must not invent truth.

No further work is required in this phase for now. Future implementation must continue obeying the Phase 1 contract.

---

# Phase 2 — Core Project Structure

## Goal

Create the technical skeleton for a modular, simulation-first TypeScript project where future systems can be added without large refactors.

This phase does **not** build gameplay logic yet. It creates the folders, boundaries, naming conventions, shared interfaces, and test structure that future phases will rely on.

The result should be a repo structure where an agent can clearly see:

- where the pure simulation lives
- where modules live
- where registries live
- where tests live
- where debug simulation tools live
- where future card-facing issue seed systems will eventually plug in

## Design Intent

The simulation must be built as a **headless rules engine**. It should not depend on React, Phaser, DOM APIs, localStorage, browser events, visual card systems, or UI components.

The core simulation should eventually work like this:

```ts
const result = simulateDay(previousState, playerInput, runConfig)
```

Where:

- `previousState` is a serializable tavern state object
- `playerInput` contains owner actions and staff assignments
- `runConfig` contains deterministic RNG seed/configuration
- `result` contains the next state, reports, state diffs, generated issue seeds, and debug information

Phase 2 should prepare this architecture without implementing the full simulation yet.

## Required Folder Structure

Create the following structure under `src/sim`:

```txt
src/
  sim/
    core/
      engine.ts
      phases.ts
      context.ts
      result.ts
      types.ts

    state/
      TavernState.ts
      defaults.ts
      schemas.ts
      migrations.ts            # placeholder only — full save/load is deferred until post-Phase 20

    registries/
      Registry.ts
      areaRegistry.ts
      stockRegistry.ts
      customerRegistry.ts
      staffRegistry.ts
      actionRegistry.ts
      reputationRegistry.ts
      pressureRegistry.ts
      issueSeedRegistry.ts
      moduleRegistry.ts

    modules/
      calendar/
        index.ts
        types.ts
      economy/
        index.ts
        types.ts
      areas/
        index.ts
        types.ts
      stock/
        index.ts
        types.ts
      customers/
        index.ts
        types.ts
      staff/
        index.ts
        types.ts
      ownerActions/
        index.ts
        types.ts
      weekly/
        index.ts
        types.ts
      monthly/
        index.ts
        types.ts
      memories/
        index.ts
        types.ts
      causes/
        index.ts
        types.ts
      pressures/
        index.ts
        types.ts
      reports/
        index.ts
        types.ts
      issueSeeds/
        index.ts
        types.ts

    testing/
      createTestState.ts
      runDay.ts
      runWeek.ts
      runMonth.ts
      policyBots.ts
      simAssertions.ts

    utils/
      clamp.ts
      ids.ts
      math.ts
      object.ts
```

Also create:

```txt
tests/
  sim/
    phase2.structure.test.ts
    phase3.calendar.test.ts
    phase4.rng.test.ts
    phase5.state.test.ts
```

If the existing repo uses a different test folder convention, adapt the location but preserve the conceptual separation.

## Core Architectural Rules

### 1. Simulation code must be pure by default

Do not use:

- DOM APIs
- React state
- browser storage
- network calls
- timers
- global mutable state
- `Math.random()` inside simulation logic

### 2. Simulation state must be serializable

Tavern state must be plain JSON-compatible data.

Avoid:

- class instances inside state
- functions inside state
- Maps/Sets inside state unless converted at boundaries
- circular references

### 3. Systems should be modular

No single file should become the place where every tavern rule is added.

Each future module should be able to register:

- state defaults
- phase hooks
- actions
- report sections
- issue seed generators
- validation/migrations later

### 4. Use registries for expandable concepts

The following concepts must be registry-friendly from the start:

- areas
- stock items
- customer groups
- staff roles
- owner actions
- reputation axes
- pressure types
- issue seed families
- simulation modules

Do not hardcode expandable lists directly into the engine.

Hardcoding initial defaults is acceptable inside their proper default/registry files.

## Required Core Types

Create initial type placeholders that later phases can expand.

### Simulation phase names

In `src/sim/core/phases.ts`:

```ts
export type SimulationPhase =
  | 'init'
  | 'startDay'
  | 'beforeForecast'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'ownerActions'
  | 'afterOwnerActions'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generatePressures'
  | 'generateIssueSeeds'
  | 'generateReports'
  | 'validate'
```

### Simulation module interface

In `src/sim/core/types.ts` or a dedicated module type file:

```ts
import type { SimulationPhase } from './phases'
import type { SimContext } from './context'

export type SimulationHook = (ctx: SimContext) => void

export type SimulationModule = {
  id: string
  version: string
  dependsOn?: string[]
  hooks?: Partial<Record<SimulationPhase, SimulationHook[]>>
  register?: (ctx: RegistrationContext) => void
}

export type RegistrationContext = {
  // Phase 2 can keep this minimal.
  // Later phases will expose specific registry helpers.
}
```

### Simulation result placeholder

In `src/sim/core/result.ts`:

```ts
import type { TavernState } from '../state/TavernState'

export type SimulationResult = {
  state: TavernState
  reports: unknown[]
  causes: unknown[]
  stateDiffs: unknown[]
  issueSeeds: unknown[]
  debug: Record<string, unknown>
}
```

Phase 2 can keep `reports`, `causes`, `stateDiffs`, and `issueSeeds` as placeholders. Later phases will strongly type them.

## Generic Registry Utility

Create a small generic registry utility in `src/sim/registries/Registry.ts`.

It should support:

- registering definitions by ID
- preventing duplicate IDs
- retrieving by ID
- listing all definitions
- checking existence

Suggested shape:

```ts
export type RegistryItem = {
  id: string
}

export class Registry<T extends RegistryItem> {
  private items = new Map<string, T>()

  register(item: T): void {
    if (this.items.has(item.id)) {
      throw new Error(`Duplicate registry id: ${item.id}`)
    }
    this.items.set(item.id, item)
  }

  get(id: string): T {
    const item = this.items.get(id)
    if (!item) {
      throw new Error(`Missing registry id: ${id}`)
    }
    return item
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  all(): T[] {
    return [...this.items.values()]
  }

  clear(): void {
    this.items.clear()
  }
}
```

Use this utility to create placeholder registries.

Example:

```ts
import { Registry } from './Registry'

export type AreaDefinition = {
  id: string
  label: string
  tags: string[]
}

export const areaRegistry = new Registry<AreaDefinition>()
```

Do not overbuild this registry yet. Keep it small and boring.

## Testing Requirements

Create tests that prove the structure exists and registries work.

Minimum Phase 2 tests:

1. Registry can register and retrieve an item.
2. Registry rejects duplicate IDs.
3. Registry lists all registered items.
4. Core phase names are exported.
5. Placeholder module interface can be imported without circular dependency errors.

Example test names:

```txt
Registry registers and retrieves definitions
Registry rejects duplicate ids
Simulation phases include daily, weekly, and monthly hooks
Core sim modules can be imported
```

## Acceptance Criteria

Phase 2 is complete when:

- required folder structure exists
- generic registry utility exists
- placeholder registries exist
- simulation phase names exist
- simulation module interface exists
- simulation result placeholder exists
- tests confirm registry behaviour
- no UI/card/gameplay content has been added
- no simulation logic has been prematurely implemented

## Do Not Do In Phase 2

Do not implement:

- cards
- card text
- actual customer traffic
- actual economy math
- real owner actions
- real staff behaviour
- real reports
- real issue seed generation
- UI
- balancing
- save/load persistence beyond placeholder migration files

Phase 2 is architecture scaffolding only.

---

# Phase 3 — Calendar & Time System

## Goal

Implement the tavern simulation calendar: days, weeks, months, day types, week boundaries, and month boundaries.

The calendar is the first real simulation system because every later system depends on time.

Daily operations, weekly wages, supplier invoices, staff fatigue cycles, monthly rent, inspections, and reputation shifts all need a shared time model.

## Time Model

Use a simplified 28-day month.

```txt
1 month = 4 weeks
1 week = 7 days
1 month = 28 days
```

The simulation should support indefinite progression.

Recommended calendar fields:

```ts
export type CalendarState = {
  day: number          // 1-28 within current month
  week: number         // 1-4 within current month
  month: number        // starts at 1
  year: number         // starts at 1
  totalDaysElapsed: number
  dayOfWeek: number    // 1-7
  dayType: DayType
}
```

## Day Types

Initial day types:

```ts
export type DayType =
  | 'supplier_day'
  | 'quiet_day'
  | 'market_day'
  | 'local_night'
  | 'payday'
  | 'brawl_night'
  | 'maintenance_day'
```

Default weekly pattern:

```txt
Day 1: Supplier Day
Day 2: Quiet Day
Day 3: Market Day
Day 4: Local Night
Day 5: Payday
Day 6: Brawl Night
Day 7: Maintenance Day
```

The names are design-facing IDs, not final player-facing names. Final flavour can come later.

## Required Functions

Create these in the calendar module:

```ts
export function createInitialCalendar(): CalendarState
```

Returns:

```txt
Day 1, Week 1, Month 1, Year 1, totalDaysElapsed 0, dayOfWeek 1, dayType supplier_day
```

```ts
export function getDayType(dayOfWeek: number): DayType
```

Maps 1–7 to the default day type pattern.

```ts
export function advanceCalendar(calendar: CalendarState): CalendarState
```

Advances one day.

Rules:

- day increments by 1
- totalDaysElapsed increments by 1
- dayOfWeek cycles 1–7
- week updates 1–4
- month increments after day 28
- day resets to 1 after day 28
- year increments after month 12 if using years
- dayType updates based on dayOfWeek

```ts
export function isEndOfWeek(calendar: CalendarState): boolean
```

True when the current simulated day is dayOfWeek 7 before advancement or when resolving end-of-day logic for Maintenance Day. Be consistent and document whether it checks pre-advance or post-advance state.

Recommended convention:

> `isEndOfWeek(calendar)` returns true for the current day if that day is the seventh day of the week.

```ts
export function isEndOfMonth(calendar: CalendarState): boolean
```

True when current day is 28.

```ts
export function getCalendarLabel(calendar: CalendarState): string
```

Returns a debug label such as:

```txt
Year 1, Month 1, Week 2, Day 9 — Quiet Day
```

## Calendar Module Hook

Create a placeholder `calendar` simulation module.

It should eventually own time progression, but in Phase 3 it can export pure functions and a module definition:

```ts
export const calendarModule: SimulationModule = {
  id: 'calendar',
  version: '0.1.0',
}
```

Do not wire it deeply into the engine yet unless the engine skeleton from Phase 2 already supports clean hook execution.

## Testing Requirements

Create comprehensive calendar tests.

Minimum tests:

1. Initial calendar starts at Day 1, Week 1, Month 1, Year 1.
2. Day types map correctly for all seven days.
3. Advancing from Day 1 goes to Day 2.
4. Advancing Day 7 moves to Week 2, Day 8, dayOfWeek 1.
5. Advancing Day 28 moves to Month 2, Day 1, Week 1.
6. `isEndOfWeek` returns true on dayOfWeek 7.
7. `isEndOfMonth` returns true on day 28.
8. Advancing 28 days reaches Month 2, Day 1.
9. Advancing 336 days reaches Year 2, Month 1, Day 1 if using 12-month years.
10. Calendar output is deterministic and contains no randomness.

## Acceptance Criteria

Phase 3 is complete when:

- calendar state type exists
- initial calendar creation exists
- day type mapping exists
- calendar advancement works across day/week/month/year boundaries
- end-of-week and end-of-month helpers exist
- debug label helper exists
- calendar module placeholder exists
- tests cover all boundary transitions

## Do Not Do In Phase 3

Do not implement:

- customer traffic based on day type
- supplier deliveries
- wages
- rent
- inspections
- monthly modifiers
- cards or issue seeds

The calendar should only define time. Other systems will later read it.

---

# Phase 4 — Deterministic RNG & Replay

## Goal

Implement deterministic randomness so every simulation run can be reproduced exactly from a seed.

This is mandatory for simulation debugging, balance tests, card seed validation, and agent work.

If a tavern collapses on Day 19 because ogres broke every chair and the cook served blue stew, the developer must be able to rerun the exact same sequence.

## Required Rule

Simulation code must never call `Math.random()` directly.

All randomness must go through a seeded RNG wrapper.

## Recommended Dependency

Use one of:

- `prando`
- `seedrandom`

Preferred: `prando`, because it is simple and well-suited to reproducible seeded sequences.

If avoiding dependencies for now, implement a tiny deterministic PRNG locally, but keep the same wrapper API so it can be swapped later.

## RNG Wrapper

Create:

```txt
src/sim/core/rng.ts
```

Required API:

```ts
export type RngState = {
  seed: string
  calls: number
}

export type SimRng = {
  state: RngState
  float: () => number
  int: (min: number, max: number) => number
  chance: (probability: number) => boolean
  pick: <T>(items: T[]) => T
  weightedPick: <T>(items: Array<{ item: T; weight: number }>) => T
}

export function createRng(seed: string, calls?: number): SimRng
```

### Behaviour Requirements

`float()`:

- returns number `>= 0` and `< 1`
- increments call count

`int(min, max)`:

- inclusive minimum
- inclusive maximum
- throws if max < min
- increments call count

`chance(probability)`:

- accepts probability from 0 to 1
- probability 0 always false
- probability 1 always true
- throws or clamps invalid values; prefer throwing in dev/test
- increments call count unless probability is exactly 0 or 1. Pick one convention and document it.

Recommended convention:

> `chance(0)` and `chance(1)` do not consume RNG calls because the outcome is deterministic.

`pick(items)`:

- throws on empty array
- returns one item
- deterministic for same seed/call position

`weightedPick(items)`:

- ignores or rejects non-positive weights; prefer rejecting for safety
- throws if total weight <= 0
- deterministic for same seed/call position

## Replay Requirement

The RNG must support replay from seed and call count.

Example:

```ts
const rngA = createRng('crooked-keg', 0)
const first = rngA.float()
const second = rngA.float()

const rngB = createRng('crooked-keg', 1)
const replaySecond = rngB.float()

expect(replaySecond).toBe(second)
```

If the chosen RNG library cannot jump to call count directly, the wrapper can advance/discard values internally until it reaches the requested call count. That is acceptable for this phase.

## Store RNG Metadata in State or Run Config

Do not hide RNG state globally.

The simulation should eventually preserve enough information to reproduce a run.

Recommended:

```ts
export type SimulationRunConfig = {
  seed: string
}
```

The result debug metadata should eventually include:

```ts
rng: {
  seed: string
  callsBefore: number
  callsAfter: number
}
```

Phase 4 can introduce the types without fully integrating them.

## Testing Requirements

Minimum tests:

1. Same seed produces same float sequence.
2. Different seeds produce different sequences.
3. Call count increments correctly.
4. Replay from seed and call count works.
5. `int(min, max)` stays within inclusive bounds.
6. `chance(0)` is always false.
7. `chance(1)` is always true.
8. `pick()` is deterministic.
9. `pick([])` throws.
10. `weightedPick()` respects deterministic replay.
11. `weightedPick()` throws on empty or invalid weights.
12. No simulation module should import or call `Math.random()`.

For test 12, a simple static scan test is acceptable:

- scan `src/sim`
- fail if `Math.random` appears outside an allowed test/mock file

## Acceptance Criteria

Phase 4 is complete when:

- seeded RNG wrapper exists
- random helper methods exist
- replay from seed/call count works
- simulation run config type exists or is prepared
- tests prove determinism
- static guard prevents accidental `Math.random()` usage in `src/sim`

## Do Not Do In Phase 4

Do not implement:

- random customer traffic
- random incidents
- random card generation
- balance tuning
- procedural content

Phase 4 only creates the safe randomness tool.

---

# Phase 5 — Base Tavern State Model

## Goal

Create the first complete serializable state model for the tavern simulation.

This state should be large enough to support future systems, but not overloaded with final gameplay details.

Phase 5 defines the initial shape of the tavern as a simulation object.

## Design Intent

The state model should answer:

```txt
What exists in the tavern right now?
What condition is it in?
Who works here?
Who comes here?
What does the tavern own?
What is the tavern known for?
What does the tavern remember?
What pressures are building?
What modules have extension state?
```

It should not yet answer:

```txt
What happened during today's service?
What cards are available?
What choices can the player make?
How much money was earned today?
```

Those come later.

## Required Top-Level State

In `src/sim/state/TavernState.ts` define:

```ts
import type { CalendarState } from '../modules/calendar/types'

export type TavernState = {
  meta: TavernMetaState
  calendar: CalendarState
  coin: number

  areas: Record<string, AreaState>
  stock: Record<string, StockState>
  staff: Record<string, StaffState>
  customerGroups: Record<string, CustomerGroupState>
  reputation: ReputationState

  memories: MemoryState[]
  causes: CauseState[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
```

## Meta State

```ts
export type TavernMetaState = {
  tavernId: string
  tavernName: string
  simVersion: string
  createdAtDay: number
}
```

Initial default:

```txt
tavernName: The Crooked Keg
simVersion: 0.1.0
createdAtDay: 0
```

## Area State

Initial areas:

```txt
main_room
kitchen
cellar
privy
roof
```

Each area:

```ts
export type AreaState = {
  id: string
  label: string
  condition: number       // 0-100
  cleanliness: number     // 0-100
  mess: number            // 0-100
  damage: number          // 0-100
  smell: number           // 0-100
  risk: number            // 0-100 general local problem risk
  tags: string[]
  activeProblems: string[]
}
```

Suggested defaults:

```txt
main_room:
  condition 60, cleanliness 45, mess 20, damage 15, smell 25, risk 20
  tags: public, service, customer_facing

kitchen:
  condition 55, cleanliness 40, mess 30, damage 10, smell 35, risk 30
  tags: food, staff_work, cleanliness_sensitive

cellar:
  condition 45, cleanliness 30, mess 35, damage 20, smell 45, risk 40
  tags: storage, damp, pests

privy:
  condition 40, cleanliness 25, mess 45, damage 20, smell 70, risk 50
  tags: sanitation, smell, inspection_relevant

roof:
  condition 50, cleanliness 50, mess 0, damage 35, smell 0, risk 35
  tags: structure, weather_sensitive
```

These values are intentionally imperfect. The tavern should start playable, not pristine.

## Stock State

Initial stock items:

```txt
ale
stew
ingredients
mushrooms
firewood
mugs
```

Each stock item:

```ts
export type StockState = {
  id: string
  label: string
  quantity: number
  quality: number        // 0-100
  spoilage: number       // 0-100
  unitValue: number
  tags: string[]
}
```

Suggested defaults:

```txt
ale:
  quantity 80, quality 45, spoilage 5, unitValue 2
  tags: drink, alcohol, service_item

stew:
  quantity 40, quality 35, spoilage 20, unitValue 2
  tags: food, prepared, service_item

ingredients:
  quantity 60, quality 45, spoilage 15, unitValue 1
  tags: food, raw

mushrooms:
  quantity 45, quality 40, spoilage 25, unitValue 1
  tags: food, raw, goblin_favourite, risky

firewood:
  quantity 50, quality 50, spoilage 0, unitValue 1
  tags: fuel, utility

mugs:
  quantity 35, quality 35, spoilage 0, unitValue 1
  tags: equipment, service_item, breakable
```

## Staff State

Initial staff:

```txt
cook
server
cleaner_bouncer
```

Each staff member:

```ts
export type StaffState = {
  id: string
  name: string
  role: StaffRole
  skill: number       // 0-100
  morale: number      // 0-100
  stress: number      // 0-100
  fatigue: number     // 0-100
  loyalty: number     // 0-100
  wage: number
  tags: string[]
  activeProblems: string[]
}

export type StaffRole =
  | 'cook'
  | 'server'
  | 'cleaner_bouncer'
```

**Forward note:** the literal union above is Phase 5 shorthand. Phase 11 introduces the staff role registry and replaces this type with `StaffRoleId` (a `string` validated against `staffRegistry`). When Phase 11 lands, remove this union and switch the `role` field to `StaffRoleId`. See `phases-11-15.md` §11 "Role typing clarification" for full reasoning.

Suggested defaults:

```txt
cook:
  name Gribna
  skill 55, morale 45, stress 35, fatigue 20, loyalty 50, wage 12

server:
  name Nix
  skill 50, morale 50, stress 25, fatigue 20, loyalty 45, wage 10

cleaner_bouncer:
  name Bruk
  skill 45, morale 40, stress 30, fatigue 25, loyalty 55, wage 11
```

Names are allowed as placeholder flavour because staff require identity for future simulation references, but do not write card content around them yet.

## Customer Group State

Initial customer groups:

```txt
local_goblins
miners
merchants
ogres
adventurers
```

Each group:

```ts
export type CustomerGroupState = {
  id: string
  label: string
  patronage: number        // 0-100 likelihood/regularity
  satisfaction: number     // 0-100
  wealth: number           // 0-100 spending ability
  rowdiness: number        // 0-100
  dangerTolerance: number  // 0-100
  filthTolerance: number   // 0-100
  priceSensitivity: number // 0-100
  damageRisk: number       // 0-100
  tabRisk: number          // 0-100
  tags: string[]
  activeGrudges: string[]
}
```

Suggested defaults:

```txt
local_goblins:
  patronage 65, satisfaction 55, wealth 25, rowdiness 50,
  dangerTolerance 75, filthTolerance 85, priceSensitivity 80,
  damageRisk 30, tabRisk 35

miners:
  patronage 45, satisfaction 50, wealth 45, rowdiness 70,
  dangerTolerance 70, filthTolerance 60, priceSensitivity 50,
  damageRisk 55, tabRisk 30

merchants:
  patronage 25, satisfaction 40, wealth 75, rowdiness 15,
  dangerTolerance 20, filthTolerance 20, priceSensitivity 35,
  damageRisk 10, tabRisk 15

ogres:
  patronage 15, satisfaction 45, wealth 65, rowdiness 90,
  dangerTolerance 90, filthTolerance 70, priceSensitivity 30,
  damageRisk 90, tabRisk 25

adventurers:
  patronage 20, satisfaction 50, wealth 70, rowdiness 65,
  dangerTolerance 95, filthTolerance 45, priceSensitivity 25,
  damageRisk 60, tabRisk 20
```

## Reputation State

Use multiple axes instead of one reputation number.

```ts
export type ReputationState = {
  cheap: number
  tasty: number
  filthy: number
  dangerous: number
  cozy: number
  strange: number
  reliable: number
  goblinAuthentic: number
}
```

Suggested defaults:

```txt
cheap: 60
tasty: 35
filthy: 65
dangerous: 40
cozy: 20
strange: 35
reliable: 30
goblinAuthentic: 70
```

This should create a starting identity: cheap, filthy, goblin-authentic, not very reliable.

## Memory State

Create placeholder memory structure:

```ts
export type MemoryState = {
  id: string
  type: 'fact' | 'timed' | 'grudge' | 'hook'
  strength: number
  ageDays: number
  durationDays?: number
  tags: string[]
  relatedIds: string[]
  data?: Record<string, unknown>
}
```

Initial memories should be empty unless there is a strong reason to seed one. Prefer empty for Phase 5.

## Cause State

Create placeholder cause structure:

```ts
export type CauseState = {
  id: string
  day: number
  source: string
  target: string
  amount: number
  readable: string
  tags: string[]
}
```

Initial causes should be empty.

## Pressure State

Create placeholder pressure structure:

```ts
export type PressureState = {
  id: string
  label: string
  value: number
  trend: number
  tags: string[]
  topCauses: string[]
}
```

**Canonical naming:** these IDs (`pests`, `structural_decay`, `reputation_drift`, etc.) are the canonical form. Because they live under `state.pressures`, the `_pressure` suffix would be redundant. Phase 18 references the same IDs without the `_pressure` suffix; if you see `pest_pressure` or `reputation_drift_pressure` in older drafts of Phase 18, treat the short form here as authoritative.

Initial pressure IDs:

```txt
inspection
staff_burnout
pests
food_safety
debt
violence
structural_decay
reputation_drift
```

Suggested defaults:

```txt
inspection: 25
staff_burnout: 25
pests: 35
food_safety: 35
debt: 10
violence: 30
structural_decay: 35
reputation_drift: 20
```

Trend should start at 0.

## Modules Extension State

Keep this as:

```ts
modules: Record<string, unknown>
```

Initial value:

```ts
modules: {}
```

Future optional systems will store namespaced state here.

Example later:

```ts
modules: {
  rats: { infestation: 40, treatyStatus: 'none' },
  weather: { current: 'rain', monthlyPattern: 'wet' }
}
```

Do not add these yet.

### Module-State Validation Deferral

Module-state validation is deferred to Phase 6. The intent is that modules register their own schemas at registration time, and the state validator composes those module schemas into the validation for `state.modules`.

Phase 5 leaves the type as `Record<string, unknown>` because no module schemas exist yet. Phase 6 will add schema composition rather than treating `modules` as permanently opaque. Do not work around the loose type by hardcoding a wide `state.modules` schema in Phase 5.

## Default State Factory

Create:

```txt
src/sim/state/defaults.ts
```

Required function:

```ts
export function createInitialTavernState(overrides?: Partial<TavernState>): TavernState
```

It should:

- create a full valid initial state
- include the initial calendar from Phase 3
- set initial coin
- create default areas
- create default stock
- create default staff
- create default customer groups
- create default reputation
- create default pressures
- use empty memories and causes
- use empty module state
- allow shallow or controlled overrides for tests

Recommended starting coin:

```txt
coin: 100
```

The tavern should start with enough money to act, but not enough to ignore pressure forever.

## State Cloning

Create a utility for safe cloning:

```ts
export function cloneTavernState(state: TavernState): TavernState
```

For now, JSON clone is acceptable because state must be serializable:

```ts
return structuredClone(state)
```

If `structuredClone` support is uncertain in the project environment, use JSON clone temporarily, but document the limitation.

## Testing Requirements

Minimum tests:

1. `createInitialTavernState()` returns a complete state.
2. Initial state includes calendar.
3. Initial state has all five required areas.
4. Initial state has all six required stock items.
5. Initial state has all three required staff members.
6. Initial state has all five customer groups.
7. Reputation axes exist and are numeric.
8. Initial pressures exist.
9. Memories and causes start empty.
10. Modules state starts empty.
11. All meter-like values are between 0 and 100.
12. State can be cloned without preserving object references.
13. State can be serialized with `JSON.stringify`.
14. State can be deserialized back into an object with the same top-level structure.

## Acceptance Criteria

Phase 5 is complete when:

- complete `TavernState` type exists
- initial state factory exists
- default tavern state includes areas, stock, staff, customers, reputation, pressures, memories, causes, and module state
- initial state uses the Phase 3 calendar
- clone utility exists
- tests verify completeness, serializability, and value ranges
- no service simulation has been implemented yet
- no card-facing issue seeds have been implemented yet

## Do Not Do In Phase 5

Do not implement:

- daily service
- income calculations
- stock consumption
- customer traffic
- owner actions
- staff assignments
- actual pressure updates
- issue seed generation
- card text
- UI

Phase 5 only defines what the tavern **is** at rest.

---

# End State After Phase 5

After Phase 5, the project should have:

```txt
- A clear simulation folder structure
- Core extension seams
- Registries prepared for expandable systems
- Calendar/time model implemented and tested
- Deterministic RNG implemented and tested
- Base tavern state model implemented and tested
```

The simulation will not yet be fun or playable. That is expected.

At this point, the tavern exists as a stable, serializable object in time, with deterministic randomness available for future systems.

The next batch, Phases 6–10, should begin making the tavern safe, executable, physical, economic, and populated.
