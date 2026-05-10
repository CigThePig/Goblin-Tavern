# Goblin Tavern Simulation — Phases 6–10 Implementation Plan

Status: **Phase 1 complete.** Phases 2–5 should already be complete or in progress before this batch begins.  
Scope of this document: **Expand Phases 6–10 only.**  
Purpose: Give an implementation agent enough detail to build the validation, engine, area, stock/economy, and customer systems without drifting into cards, UI polish, or content writing. The structure mirrors the post-expansion `phases-02-05.md`: each phase opens with an Agent Execution Checklist, pins previously-soft tooling and contract decisions, and uses `**Forward note:**` / `**Canonical naming:**` / `**Scope note:**` callouts where later phases are about to depend on a contract that ships here.

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

## Pinned Dependency

Use `zod`. This is the deferred dependency announced in `phases-02-05.md` Phase 2 ("Deferred dependencies (do not install in Phase 2): … `zod` — introduced in Phase 6 for module/state schema validation").

`valibot` was considered as an alternative and rejected. Keep the codebase on a single validator so module schemas (§6.1.1) compose cleanly and so error formatting stays consistent across the simulation. Do not introduce a second validation library.

## Agent Execution Checklist

Create the following in this order. Each item is a single small file unless noted.

**Dependency:**

1. Add `zod` to `package.json` `dependencies`. Run `npm install`.

**Schemas and validation (`src/sim/state/`):**

2. `src/sim/state/schemas.ts` — replace the Phase 5 stub with `CalendarStateSchema`, `TavernStateSchema`, `AreaStateSchema`, `StockItemStateSchema`, `CustomerGroupStateSchema`, `StaffStateSchema`, `ReputationStateSchema`, `MemoryStateSchema`, `CauseEntrySchema`, `PressureStateSchema`, plus the dynamic modules schema described in §6.1.1. Each schema must match the corresponding Phase 5 type exactly — no field renames, no new fields, no re-tuned ranges beyond the explicit Phase 5 defaults.
3. `src/sim/state/types.ts` — re-export inferred types from `schemas.ts` (`type AreaState = z.infer<typeof AreaStateSchema>` etc.) so callers depend on schema-derived types. The `ValidationIssue` type used by §6.3 lives here too.
4. `src/sim/state/validation.ts` — exports `validateState` (§6.2) and `safeValidateState` (§6.3).
5. `src/sim/state/normalize.ts` — exports `clampPercent`, `clampNonNegative`, `normalizeArea`, `normalizeStockItem`, `normalizeTavernState` (§6.4).
6. `src/sim/state/saveEnvelope.ts` — `SaveEnvelope` type and `migrateSaveEnvelope` placeholder (§6.6). Preserve the scope note: full save/load is deferred until post-Phase 20.

**Testing helpers (`src/sim/testing/`):**

7. `src/sim/testing/stateFactories.ts` — replace the Phase 2 placeholder with helpers for building partial test states layered onto `createInitialTavernState`.
8. `src/sim/testing/stateAssertions.ts` — replace the Phase 2 placeholder with `expectValidState`, `expectNoNegativeStock`, `expectPercentRangesValid`, `expectCalendarValid` (§6.5).

**Tests (`tests/sim/`):**

9. `tests/sim/phase6.validation.test.ts` — implement the eight numbered tests in "Testing Requirements" below.

`src/sim/state/defaults.ts` already exists from Phase 5 and does **not** change in Phase 6. Module-state schemas are still empty in Phase 6 (real module schemas land in Phases 8–10 as those modules acquire namespaced state — see §6.1.1).

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

**Forward note:** this section is the Phase 6 half of a contract introduced in `phases-02-05.md` Phase 5 §"Module-State Validation Deferral", which read: "Module-state validation is deferred to Phase 6. The intent is that modules register their own schemas at registration time, and the state validator composes those module schemas into the validation for `state.modules`." Phase 5 left `state.modules` as `Record<string, unknown>` precisely because no module schemas existed yet. Phase 6 closes the loop by adding the composition mechanism described below — without retroactively widening Phase 5's loose type into a permanently opaque schema.

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

**Scope note: full save/load is deferred until post-Phase 20.** This section only introduces the placeholder shape (`SaveEnvelope`, `migrateSaveEnvelope`) so future versioning code has a stable home. No save reading, save writing, file I/O, or migration step logic is in scope for Phases 6–20. The placeholder must exist because module-state validation (§6.1.1) and module version pinning depend on the envelope's shape, not because save/load itself is being built.

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

## Testing Requirements

Minimum tests:

1. Default tavern state from `createInitialTavernState()` passes `validateState`.
2. A state with a negative stock quantity fails `validateState` with a path identifying the broken item (e.g. `stock.ale.quantity`).
3. A state with `area.cleanliness > 100` fails `validateState` with a path identifying the broken area (e.g. `areas.kitchen.cleanliness`).
4. A state with `coin: NaN` fails `validateState`.
5. A state missing the calendar block fails `validateState`.
6. An invalid area object (missing required fields) fails `validateState`.
7. `safeValidateState` returns `{ success: false, errors }` instead of throwing on the same inputs that throw in tests 2–6.
8. Normalization helpers (e.g. `clampPercent`) clamp values when called intentionally, but `validateState` does not silently re-clamp them — invalid values still fail validation.

## Acceptance Criteria

Phase 6 is complete when:

- Full tavern state can be validated.
- Invalid values produce useful errors.
- All core state sections have schemas.
- Tests can assert state validity.
- Normalization helpers exist but do not hide serious bugs.
- A save envelope shape exists with version/module version fields.
- No card or narrative systems are introduced.

## Do Not Do

Do not:

- Add cards.
- Add narrative prose.
- Add event writing.
- Add issue seeds.
- Add UI.
- Add save/load persistence, file I/O, or migration step logic beyond the placeholder `SaveEnvelope` shape from §6.6 (full save/load is deferred until post-Phase 20).
- Allow modules to mutate raw state without later going through engine/context rules (the `ctx.modify*` API lands in Phase 7 §7.3.1).
- Hardcode known module schemas into the state validator instead of composing them via §6.1.1.

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

## Agent Execution Checklist

Several files in this list already exist as Phase 2 placeholders. Expand them in place; do not create parallel files.

**Core engine seams (`src/sim/core/`):**

1. `src/sim/core/phases.ts` — replace the Phase 2 placeholder `SimulationPhase` union with the §7.1 `SimPhase` union. This is the canonical pipeline list (Phase 2 already noted "later phases will expand this"; cross-reference: `phases-02-05.md` §"Required Core Types"). The two names are the same union — pick one and hold to it.
2. `src/sim/core/module.ts` — extend the Phase 2 `SimulationModule` shape with the optional `buildReport` and `validate` members from §7.2. Existing fields (`id`, `version`, `dependsOn`, `hooks`) are unchanged.
3. `src/sim/core/context.ts` — implement the `SimContext` accessors and helpers from §7.3, plus the cause-required mutation stubs from §7.3.1.
4. `src/sim/core/reports.ts` — `ReportSection`, `SimLog` types, and the collector helpers used by `ctx.addReportSection` / `ctx.addLog`.
5. `src/sim/core/diff.ts` — placeholder structure for state diffs. Keep the file body empty with a TODO comment for Phase 17 (mirrors the Phase 2 placeholder pattern).
6. `src/sim/core/result.ts` — replace the Phase 2 placeholder with the §7.4 `SimResult` shape (`state`, `reports`, `logs`, `validation`).
7. `src/sim/core/engine.ts` — implement `simulateDay(state, input, modules): SimResult` per §7.4, using the dependency-sorted hook execution from §7.5.

`src/sim/core/rng.ts` already exists from Phase 4 and does **not** change in Phase 7 — `SimContext.rng` simply consumes the existing `SimRng`.

**Tests (`tests/sim/`):**

8. `tests/sim/phase7.engine.test.ts` — implement the nine numbered tests in "Testing Requirements" below.

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

**Forward note:** the relative ordering of `applyOwnerActions` → `beforeService` → `service` is a contract that Phase 13 (Owner Actions) depends on. `phases-11-15.md` §"Phase 13" pins it: "Phase 13 (Owner Actions) runs *before* daily service every day — owner actions are applied during the `applyOwnerActions` phase, which precedes `beforeService` and `service` in the pipeline (see Phase 7 §7.1). When implementing Phase 12, assume owner actions have already taken effect for the current day." Do not reorder these three phases without updating both phase docs together.

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

**Forward note:** `phases-16-20.md` §"Phase 17" closes this contract: "Phase 7 introduced significant-mutation helpers (`ctx.modifyArea`, `ctx.modifyStock`, etc.) with a placeholder `meta: { source: string }` argument. Phase 17 upgrades that argument to a full `CauseDraft` and enforces it at the type level." Phase 17 also extends the helper set with `ctx.modifyCoin`, `ctx.modifyReputation`, and `ctx.modifyPressure` — Phase 7 may add those signatures defensively (with the same `meta` placeholder) if the engine touches coin/reputation/pressure during the pipeline, but they can also wait until Phase 17 lands. Either way, do not introduce a parallel "fast path" that mutates significant state without a `meta` argument.

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

## Testing Requirements

Minimum tests:

1. `simulateDay` advances the calendar exactly once per call.
2. `startDay` hooks run before `service` hooks across all modules.
3. `service` hooks run before `closing` hooks across all modules.
4. `endWeek` hooks run only on the final day of the week (Maintenance Day, `dayOfWeek === 7` per `phases-02-05.md` Phase 3).
5. `endMonth` hooks run only on the final day of the month (Day 28).
6. Modules with `dependsOn` run after their declared dependencies in every phase.
7. Cyclic module dependencies throw a clear error naming the cycle.
8. State remains valid (per `validateState` from Phase 6) after `simulateDay` returns.
9. Dummy report sections registered via `buildReport` are collected into `result.reports`.

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

## Do Not Do

Do not:

- Put gameplay rules (decay numbers, traffic formulas, sale logic) inside `simulateDay`. Gameplay belongs in modules.
- Hardcode rats, inspectors, cards, or story content.
- Allow modules to rely on import order. Dependency ordering must come from `dependsOn`.
- Add UI.
- Add narrative prose.
- Add card choices.
- Add a "fast path" that mutates significant state without going through `ctx.modify*` (§7.3.1).

---

# Phase 8 — Area System

## Goal

Implement the physical tavern as a set of meaningful areas with state, tags, decay, and report output.

The tavern should stop being an abstract business and become a place with rooms that get dirty, damaged, risky, and expensive to ignore.

## Why This Phase Matters

Areas are the physical foundation for later systems.

Stock lives in areas. Customers occupy areas. Staff work in areas. Owner actions target areas. Future issue seeds will often come from area state.

If areas are weak, later cards will become generic.

## Agent Execution Checklist

**Registry (`src/sim/registries/`):**

1. `src/sim/registries/areaRegistry.ts` — replace the Phase 2 stub with the `AreaDefinition` shape (including `defaultState`) from §8.1. Register the five required areas (`main_room`, `kitchen`, `cellar`, `privy`, `roof`) using the default values already specified in `phases-02-05.md` Phase 5 §"Area State". Do not re-tune those numbers here.

**Module (`src/sim/modules/areas/`):**

2. `src/sim/modules/areas/types.ts` — `AreaDefinition` and the return types of the derived helpers.
3. `src/sim/modules/areas/areasModule.ts` — replace the Phase 2 `index.ts` stub with the area module: ensure required areas exist, apply daily passive decay (§8.3) via `ctx.modifyArea` (Phase 7 §7.3.1), and `buildReport` (§8.5).
4. `src/sim/modules/areas/derived.ts` — exports `isAreaFilthy`, `isAreaDamaged`, `isAreaDangerous`, `isAreaInspectionRisk`, `getAreaQualityBand` (§8.4).

**State integration (`src/sim/state/`):**

5. Update `src/sim/state/defaults.ts` so `createInitialTavernState` sources area defaults from `areaRegistry` instead of inlining them. This is a consolidation, not a value change — the registry holds the same numbers Phase 5 already specified.

**Tests (`tests/sim/`):**

6. `tests/sim/phase8.areas.test.ts` — implement the eight numbered tests in "Testing Requirements" below.

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
  activeProblems: string[];
}
```

Values can be adjusted, but these concepts should exist.

**Canonical naming:** the field is `activeProblems`, matching `phases-02-05.md` Phase 5 §"Area State" and §"Staff State". Earlier drafts of this phase used `activeFlags`; treat that as a deprecated alias and do not introduce both fields. Phase 5's `AreaState.activeProblems: string[]` is the authoritative shape — Phase 8's `defaultState` must use `activeProblems: []`, and the area module reads/writes the same field.

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
    condition: 55,
    cleanliness: 40,
    damage: 10,
    smell: 35,
    risk: 30,
    activeProblems: [],
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

These numbers are intentionally small for Phase 8. Balance is a later concern; the goal here is believable movement, not difficulty tuning. Mirror the hedging style used for Phase 5's starting values in `phases-02-05.md` Phase 5 ("intentionally imperfect"). Any randomness must come from `ctx.rng` (Phase 4) — not `Math.random()`. All mutations go through `ctx.modifyArea` (Phase 7 §7.3.1) with `meta.source: 'areas'`.

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

## Testing Requirements

Minimum tests:

1. Default tavern (from `createInitialTavernState`) includes `main_room`, `kitchen`, `cellar`, `privy`, and `roof`.
2. All required areas pass `validateState` (Phase 6) immediately after `createInitialTavernState`.
3. Running the area module's daily decay hook lowers `cleanliness` for areas where the rule applies.
4. `privy.smell` does not exceed 100 even after sustained decay days.
5. `roof.condition` does not go negative even after sustained decay days.
6. `kitchen` carries the `food` and `inspection_relevant` tags.
7. `getAreaQualityBand` returns the expected band at threshold values (excellent / good / rough / bad / critical).
8. The area report includes the worst area (lowest condition) by name.

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

## Do Not Do

Do not:

- Add card text about areas.
- Add room upgrades.
- Add customer traffic effects (Phase 10 owns those).
- Add staff work effects (Phase 11 owns those).
- Add weather interactions.
- Hardcode area checks in unrelated modules when tags should be used.
- Mutate `state.areas` directly. Use `ctx.modifyArea` (Phase 7 §7.3.1).

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

## Agent Execution Checklist

**Registry (`src/sim/registries/`):**

1. `src/sim/registries/stockRegistry.ts` — replace the Phase 2 stub with the `StockDefinition` shape (including `defaultState`) from §9.1. Register the six required items (`ale`, `stew`, `ingredients`, `mushrooms`, `firewood`, `mugs`) using the default values already specified in `phases-02-05.md` Phase 5 §"Stock State". Do not re-tune those numbers here.

**Module (`src/sim/modules/stock/`):**

2. `src/sim/modules/stock/types.ts` — `StockDefinition`, `CoinLedgerEntry`, `ShortageRecord`.
3. `src/sim/modules/stock/stockModule.ts` — the stock module per §9.2 (registration check, daily spoilage, ledger initialization on `startDay`, `buildReport`).
4. `src/sim/modules/stock/ledger.ts` — `addCoin`, `spendCoin`, `getDailyProfitLoss` per §9.3.
5. `src/sim/modules/stock/sales.ts` — `sellStockItem`, `consumeStockItem`, `restockItem`, `wasteStockItem` per §9.4. Each calls `ctx.modifyStock` (Phase 7 §7.3.1) and the ledger helpers; never mutates state directly.
6. `src/sim/modules/stock/spoilage.ts` — daily spoilage and the `effectiveQuality` computation per §9.5.

**State integration (`src/sim/state/`):**

7. Update `src/sim/state/defaults.ts` so `createInitialTavernState` sources stock defaults from `stockRegistry`, and seeds an empty ledger at `state.modules.stock.ledger = []` (see §9.3 below for the canonical location).

**Tests (`tests/sim/`):**

8. `tests/sim/phase9.stock.test.ts` — implement the ten numbered tests in "Testing Requirements" below.

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

**Canonical naming:** the ledger lives at `state.modules.stock.ledger` (an array of `CoinLedgerEntry`). Phase 5 (`phases-02-05.md` §"Modules Extension State") reserved `state.modules: Record<string, unknown>` for exactly this kind of namespaced module state, and Phase 6 §6.1.1 introduces the schema-composition mechanism that validates it. The stock module registers the schema for `state.modules.stock` at registration time so `validateState` knows the ledger's shape. Do not put the ledger at the top level of `TavernState`, and do not put it directly under `state.modules` (it must be namespaced under `stock`).

### 9.4 Add Basic Sales Helpers

Create helpers but do not fully resolve customer traffic yet.

```ts
sellStockItem(stockId, quantity, buyerGroupId?)
consumeStockItem(stockId, quantity, reason)
restockItem(stockId, quantity, totalCost)
wasteStockItem(stockId, quantity, reason)
```

These should:

- Update stock quantity via `ctx.modifyStock` (Phase 7 §7.3.1) — never write to `state.stock` directly.
- Update coin via `addCoin` / `spendCoin` (§9.3) — never write to `state.coin` directly.
- Add ledger entries for every coin change.
- Clamp quantity at zero.
- Report shortages (via `ShortageRecord`, §9.6) when requested quantity cannot be fulfilled.

**Forward note:** Phase 12 (Daily Service, in `phases-11-15.md` §"Phase 12") consumes these helpers directly: "Use Phase 9 stock helpers so sales affect stock and coin through the ledger." That makes `sellStockItem`, `consumeStockItem`, `restockItem`, and `wasteStockItem` a public contract. Phase 17 (`phases-16-20.md` §"Phase 17") will require all significant mutations to carry a `CauseDraft`; these helpers must therefore accept and forward `meta` to `ctx.modifyStock` so the cause contract holds end-to-end. Do not introduce a parallel sale path that writes to stock or coin without going through these helpers.

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

## Testing Requirements

Minimum tests:

1. Default stock items (`ale`, `stew`, `ingredients`, `mushrooms`, `firewood`, `mugs`) exist after `createInitialTavernState`.
2. Stock quantities cannot become negative — calling `sellStockItem` for more than available clamps to 0 and produces a shortage record.
3. `sellStockItem('ale', N)` increases coin by `N * salePrice` and decreases `ale.quantity` by `N`, with matching ledger entries.
4. `restockItem('ale', N, totalCost)` decreases coin by `totalCost` and increases `ale.quantity` by `N`, with matching ledger entries.
5. Consuming more stock than available creates a `ShortageRecord` with the `requested` vs `available` delta.
6. Perishable items (`stew`, `mushrooms`, `ingredients`) gain spoilage over consecutive days.
7. Non-perishable `mugs` do not gain spoilage.
8. Bad cellar cleanliness increases mushroom spoilage faster than clean cellar conditions.
9. `getDailyProfitLoss()` matches the net coin change for the day.
10. The stock report includes any shortage records produced that day.

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

## Do Not Do

Do not:

- Add full customer behaviour (Phase 10 owns that).
- Add card events about shortages.
- Add supplier negotiation.
- Add recipe systems.
- Add brewing.
- Add cards or issue seeds.
- Mutate `state.coin` or `state.stock` directly. Use the ledger and `ctx.modifyStock` (Phase 7 §7.3.1).

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

## Agent Execution Checklist

**Registry (`src/sim/registries/`):**

1. `src/sim/registries/customerRegistry.ts` — replace the Phase 2 stub with the `CustomerGroupDefinition` shape (including `defaultState`, `preferredStockTags`, `dislikedTags`) from §10.1. Register the five required groups (`local_goblins`, `miners`, `merchants`, `ogres`, `adventurers`) using the values already specified in `phases-02-05.md` Phase 5 §"Customer Group State" for the existing fields, plus the §10.1 examples for the three new fields (`loyalty`, `preferredStockTags`, `dislikedTags`).

**Module (`src/sim/modules/customers/`):**

2. `src/sim/modules/customers/types.ts` — `CustomerGroupDefinition`, `CustomerForecast`, `CustomerTurnout`.
3. `src/sim/modules/customers/customerModule.ts` — the customer module per §10.2. Register `forecastTraffic` on the `forecastTraffic` phase, the turnout/purchase resolver on `service`, satisfaction updates on `afterService`, and `buildReport`.
4. `src/sim/modules/customers/forecast.ts` — `forecastTraffic(ctx)` per §10.3. Deterministic via `ctx.rng` (Phase 4); no `Math.random`.
5. `src/sim/modules/customers/purchases.ts` — preference-driven buying per §10.4, calling Phase 9 sale helpers (`sellStockItem`, etc.). Never writes to stock or coin directly.
6. `src/sim/modules/customers/satisfaction.ts` — satisfaction updates per §10.5, applied via `ctx.modifyCustomerGroup` (Phase 7 §7.3.1).
7. `src/sim/modules/customers/impact.ts` — customer-created mess and damage per §10.6, applied via `ctx.modifyArea` with `meta.source: 'customers'`.

**State integration (`src/sim/state/`):**

8. Update `src/sim/state/defaults.ts` so `createInitialTavernState` sources customer-group defaults from `customerRegistry`.

**Tests (`tests/sim/`):**

9. `tests/sim/phase10.customers.test.ts` — implement the eleven numbered tests in "Testing Requirements" below.

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
  activeGrudges: string[];
}
```

Do not worry if this seems slightly large. Customers are a core system.

**Forward note:** `phases-02-05.md` Phase 5 §"Customer Group State" defines the authoritative initial shape with `id`, `patronage`, `satisfaction`, `wealth`, `rowdiness`, `dangerTolerance`, `filthTolerance`, `priceSensitivity`, `damageRisk`, `tabRisk`, `tags`, and `activeGrudges`. Phase 10 extends that shape with three new fields: `loyalty`, `preferredStockTags`, and `dislikedTags`. When Phase 10 lands, add these three fields to the Phase 5 type definition rather than fork the type — mirror the `StaffRoleId` precedent set in `phases-02-05.md` Phase 5 ("the literal union above is Phase 5 shorthand … Phase 11 introduces the staff role registry and replaces this type"). Phase 5's defaults remain the authoritative initial values for the existing fields; Phase 10's §10.1 examples are authoritative for the three new fields.

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

Keep the result deterministic through seeded RNG. All randomness must come from `ctx.rng` (Phase 4 §"RNG Wrapper"); no `Math.random` usage.

**Forward note:** Phase 12 (Daily Service, in `phases-11-15.md` §"Phase 12") consumes this forecast directly: "Use Phase 10 forecast logic to produce actual turnout." That makes `forecastTraffic(ctx)` a public contract — its signature and return shape (`CustomerForecast`) must not drift after Phase 10 ships. Phase 12 reads the forecast and converts it into actual turnout numbers; Phase 10 should not also resolve turnout, only forecast it.

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

All area mutations from this section must go through `ctx.modifyArea` (Phase 7 §7.3.1) with `meta.source: 'customers'`. Do not write directly to `state.areas`. Customer-group mutations (e.g. satisfaction adjustments downstream of incidents) go through `ctx.modifyCustomerGroup` with the same `meta.source`.

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

## Testing Requirements

Minimum tests:

1. Default customer groups (`local_goblins`, `miners`, `merchants`, `ogres`, `adventurers`) exist after `createInitialTavernState`.
2. Market Day increases merchant forecast traffic compared to a Quiet Day baseline (same seed, same state).
3. Payday increases miner forecast traffic compared to a Quiet Day baseline.
4. Brawl Night increases ogre and adventurer forecast traffic compared to a Quiet Day baseline.
5. A dirty main room (cleanliness below merchant `filthTolerance`) reduces merchant satisfaction in `afterService`.
6. The same dirty main room produces a smaller satisfaction reduction for `local_goblins` (higher `filthTolerance`).
7. An ale shortage during a high-traffic day reduces miner satisfaction.
8. Adequate ale stock allows miner sales to complete without producing shortage records.
9. Ogre traffic increases `main_room.damage` via `ctx.modifyArea`.
10. Customer purchases increase coin via the Phase 9 ledger (no direct `state.coin` mutation).
11. The customer report includes per-group traffic and satisfaction-change lines for each group that visited.

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

## Do Not Do

Do not:

- Add narrative customer cards.
- Add named individual customers.
- Add detailed incident cards.
- Add inspectors as full normal customers (inspectors are a monthly/pressure system in a later phase).
- Add staff interactions beyond placeholders (Phase 11 owns staff).
- Add issue seeds.
- Hardcode customer logic in the engine instead of the customer module.
- Mutate `state.areas`, `state.coin`, or `state.stock` directly. Use `ctx.modifyArea`, the Phase 9 ledger, and `ctx.modifyStock` respectively.

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
