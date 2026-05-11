# Goblin Tavern Simulation Expansion - Phases 26 to 30 Implementation Plan

Status: **Phases 1 to 20 complete, Phase 21 contract complete, Phases 22 to 25 planned**  
Scope of this document: **Expand Phases 26 to 30 only**  
Purpose: Give an implementation agent enough detail to widen validation, engine hooks, area identity, supplier systems, and culture/customer systems while staying grounded in the current repo.

---

## Current Repo Baseline

This plan assumes the current finished repo structure from the uploaded `Goblin-Tavern-main` project.

The repo already contains the simulation core:

```txt
src/sim/core/
  changeTracker.ts
  context.ts
  diff.ts
  effect.ts
  engine.ts
  module.ts
  phases.ts
  reports.ts
  result.ts
  rng.ts
  types.ts
```

The repo already contains canonical state and validation:

```txt
src/sim/state/
  TavernState.ts
  defaults.ts
  migrations.ts
  normalize.ts
  saveEnvelope.ts
  schemas.ts
  types.ts
  validation.ts
```

The repo already contains registries:

```txt
src/sim/registries/
  Registry.ts
  actionRegistry.ts
  areaRegistry.ts
  customerRegistry.ts
  issueSeedRegistry.ts
  moduleRegistry.ts
  pressureRegistry.ts
  reputationRegistry.ts
  staffPriorityRegistry.ts
  staffRegistry.ts
  stockRegistry.ts
```

The repo already contains gameplay modules:

```txt
src/sim/modules/
  areas/
  calendar/
  causes/
  customers/
  economy/
  feedback/
  history/
  issueSeeds/
  issues/
  memories/
  monthly/
  ownerActions/
  pressures/
  reports/
  responses/
  service/
  staff/
  stock/
  weekly/
```

The repo already contains phase tests through Phase 20:

```txt
tests/sim/phase2.structure.test.ts
...
tests/sim/phase20.cardlessPlaytest.test.ts
```

The project uses:

- TypeScript.
- Vitest.
- `zod` for state schemas.
- `prando` for deterministic RNG.
- A headless simulation engine at `src/sim/core/engine.ts`.
- A phase pipeline in `src/sim/core/phases.ts`.
- Module-owned namespaced state under `state.modules`.
- Top-level canonical state for major simulation domains like `areas`, `stock`, `staff`, `customerGroups`, `memories`, `causes`, and `pressures`.

Do not re-scaffold these systems. These phases should extend them.

---

## Dependency Assumption From Phases 22 to 25

Phases 26 to 30 assume that Phases 22 to 25 either already exist or will be implemented first.

Expected additions from Phases 22 to 25:

```txt
src/sim/content/
  naming/
  cultures/
  factions/
  npc/
  suppliers/
  tavern/
  events/
  text/
```

Expected state additions from Phase 25:

```ts
state.world = {
  cultures: {},
  factions: {},
  suppliers: {},
  regulars: {},
  notableNpcs: {},
  localEvents: {},
  tavernIdentity: {},
  socialRumours: {},
}
```

Expected RNG additions from Phase 24:

```ts
type RngStreamId =
  | 'service'
  | 'economy'
  | 'incidents'
  | 'names'
  | 'npc_identity'
  | 'staff_identity'
  | 'supplier_identity'
  | 'faction_behaviour'
  | 'seasonal_events'
  | 'issue_seed_selection'
```

If those pieces are not present yet, implement them first. Do not squeeze Phase 22 to 25 work into Phase 26 to 30 files like contraband mushrooms hidden in a tax crate.

---

## Expansion Rules For This Batch

Phases 26 to 30 must obey the Phase 21 contract:

1. **No finished cards.**
2. **No UI work.**
3. **No flavour-only entities.**
4. **Every persistent person, supplier, faction, group, or area trait must be serializable.**
5. **Every new reference should be either schema-validated or module-validated.**
6. **Every new domain should eventually feed issue seeds, reports, memories, causes, or pressures.**
7. **Do not break deterministic replay.**
8. **Do not rewrite the completed Phase 1 to 20 architecture.**

---

# Phase 26 - Expanded Schema Validation and Identity Safety

## Mirrors Phase 6: Schema Validation and State Safety

## Goal

Extend validation so the expanded identity/world systems are safe before they become active simulation fuel.

The current repo already has:

```txt
src/sim/state/schemas.ts
src/sim/state/validation.ts
src/sim/state/types.ts
```

`schemas.ts` currently defines core Zod schemas such as:

- `CalendarStateSchema`
- `TavernMetaStateSchema`
- `AreaStateSchema`
- `StockItemStateSchema`
- `StaffStateSchema`
- `CustomerGroupStateSchema`
- `ReputationStateSchema`
- `MemoryStateSchema`
- `CauseEntrySchema`
- pressure and issue-related schemas later in the same file

`validation.ts` currently exposes:

```ts
validateState(state, options?)
safeValidateState(state, options?)
```

It also composes module-owned schemas from registered `SimulationModule.stateSchema` values and reports unknown `state.modules` keys as warnings.

Phase 26 should extend this system rather than replace it.

---

## 26.1 Add Expanded Entity Reference Kinds

Current `EntityRef` supports:

```ts
kind:
  | 'staff'
  | 'customer_group'
  | 'area'
  | 'stock'
  | 'role'
  | 'system'
  | 'other'
```

Update `src/sim/state/TavernState.ts` and `src/sim/state/schemas.ts` so `EntityRef.kind` can reference expanded world entities:

```ts
export type EntityRefKind =
  | 'staff'
  | 'customer_group'
  | 'area'
  | 'stock'
  | 'role'
  | 'system'
  | 'other'
  | 'culture'
  | 'faction'
  | 'supplier'
  | 'regular'
  | 'notable_npc'
  | 'local_event'
  | 'rumour'
  | 'tavern_identity'
```

Then update `EntityRefSchema` to use the same enum.

### Important Rule

Do not make all references valid just because the enum accepts the kind.

The enum only says the reference shape is legal. Phase 26 also needs cross-reference checks that say whether the target id exists.

---

## 26.2 Add World State Schemas

If Phase 25 added `WorldState` to `TavernState.ts`, Phase 26 must add matching schemas in `src/sim/state/schemas.ts`.

Recommended schemas:

```ts
export const GeneratedNameSchema = z.object({
  display: z.string().min(1),
  profileId: z.string().min(1),
  parts: z.record(z.string(), z.string()).optional(),
  generatedBy: z.string().min(1).optional(),
})

export const CultureWorldStateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  familiarity: meter(),
  comfort: meter(),
  tension: meter(),
  namingProfileId: z.string().min(1),
  preferredStockTags: z.array(z.string()),
  dislikedTags: z.array(z.string()),
  importantCalendarTags: z.array(z.string()),
  tags: z.array(z.string()),
})

export const FactionWorldStateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  cultureId: z.string().optional(),
  relationship: meter(),
  influence: meter(),
  trust: meter(),
  fear: meter(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const SupplierWorldStateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  name: GeneratedNameSchema.optional(),
  supplierType: z.string().min(1),
  reliability: meter(),
  relationship: meter(),
  debtTolerance: meter(),
  priceBias: z.number(),
  goodsProvided: z.array(z.string()),
  factionId: z.string().optional(),
  cultureId: z.string().optional(),
  lastDeliveryDay: z.number().int().min(0).optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const RegularWorldStateSchema = z.object({
  id: z.string().min(1),
  name: GeneratedNameSchema,
  customerGroupId: z.string().min(1),
  cultureId: z.string().optional(),
  factionId: z.string().optional(),
  loyalty: meter(),
  irritation: meter(),
  visits: z.number().int().min(0),
  favoriteStockId: z.string().optional(),
  knownIncidentIds: z.array(z.string()),
  firstSeenDay: z.number().int().min(0),
  lastSeenDay: z.number().int().min(0),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const NotableNpcWorldStateSchema = z.object({
  id: z.string().min(1),
  name: GeneratedNameSchema,
  kind: z.string().min(1),
  customerGroupId: z.string().optional(),
  cultureId: z.string().optional(),
  factionId: z.string().optional(),
  firstSeenDay: z.number().int().min(0),
  lastSeenDay: z.number().int().min(0).optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const LocalEventWorldStateSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  label: z.string().min(1),
  startedDay: z.number().int().min(0),
  endsDay: z.number().int().min(0).optional(),
  intensity: meter(),
  relatedFactionIds: z.array(z.string()),
  relatedCultureIds: z.array(z.string()),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})
```

Note: arc stage progression (`seeded` → `rising` → `active` → `climax` → `resolved` → `failed`) belongs to Phase 35's `LocalArcState`, not to this base local-event record. Local events here are persistent simulation facts; arc stages live in the Phase 35 arc module state.

```ts

export const SocialRumourWorldStateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  strength: meter(),
  accuracy: z.enum(['true', 'partial', 'false', 'unknown']),
  sourceEntityId: z.string().optional(),
  targetEntityId: z.string().optional(),
  subject: EntityRefSchema.optional(),
  firstHeardDay: z.number().int().min(0),
  lastSpreadDay: z.number().int().min(0),
  tags: z.array(z.string()),
  involvedRefs: z.array(EntityRefSchema).optional(),
})

export const TavernIdentityWorldStateSchema = z.object({
  foundingDay: z.number().int().min(0),
  knownFor: z.array(z.string()),
  houseRules: z.array(z.string()),
  atmosphereTags: z.array(z.string()),
  // optional richer descriptors — may be empty until later phases populate them
  localNicknames: z.array(z.string()).optional(),
  signatureGoods: z.array(z.string()).optional(),
})

export const WorldStateSchema = z.object({
  cultures: z.record(z.string(), CultureWorldStateSchema),
  factions: z.record(z.string(), FactionWorldStateSchema),
  suppliers: z.record(z.string(), SupplierWorldStateSchema),
  regulars: z.record(z.string(), RegularWorldStateSchema),
  notableNpcs: z.record(z.string(), NotableNpcWorldStateSchema),
  localEvents: z.record(z.string(), LocalEventWorldStateSchema),
  tavernIdentity: TavernIdentityWorldStateSchema,
  socialRumours: z.record(z.string(), SocialRumourWorldStateSchema),
})
```

### Notes

- Use the existing `meter()` helper for 0 to 100 values.
- Use string ids, not enums, for expandable registries.
- Keep all state JSON-safe.
- Prefer additive optional fields when compatibility is uncertain.

---

## 26.3 Add `world` To The Root Tavern Schema

Update the root schema builder in `src/sim/state/schemas.ts` so `world` is part of the required state shape if Phase 25 made it required.

If Phase 25 made it optional during migration, use a defaulting migration first, then make it required.

Expected root shape:

```ts
export const TavernStateBaseSchema = z.object({
  meta: TavernMetaStateSchema,
  calendar: CalendarStateSchema,
  coin: z.number(),
  areas: z.record(z.string(), AreaStateSchema),
  stock: z.record(z.string(), StockItemStateSchema),
  staff: z.record(z.string(), StaffStateSchema),
  customerGroups: z.record(z.string(), CustomerGroupStateSchema),
  reputation: ReputationStateSchema,
  memories: z.array(MemoryStateSchema),
  history: z.array(HistoryEntrySchema),
  causes: z.array(CauseEntrySchema),
  pressures: z.record(z.string(), PressureStateSchema),
  world: WorldStateSchema,
  modules: z.record(z.string(), z.unknown()),
})
```

Do not put `world` under `state.modules`. It is a major cross-cutting simulation domain, like `staff`, `areas`, and `customerGroups`.

---

## 26.4 Add Cross-Reference Validation Helpers

Zod can validate shape. It cannot easily validate cross-entity references without turning `schemas.ts` into a goblin legal code written in syrup.

Add separate cross-reference helpers under:

```txt
src/sim/state/referenceValidation.ts
```

Recommended exports:

```ts
export function validateEntityRef(state: TavernState, ref: EntityRef): ValidationIssue[]

export function validateWorldReferences(state: TavernState): ValidationIssue[]
```

`validateEntityRef` should check:

```txt
staff -> state.staff[id]
customer_group -> state.customerGroups[id]
area -> state.areas[id]
stock -> state.stock[id]
role -> staffRegistry.has(id)
culture -> state.world.cultures[id]
faction -> state.world.factions[id]
supplier -> state.world.suppliers[id]
regular -> state.world.regulars[id]
notable_npc -> state.world.notableNpcs[id]
local_event -> state.world.localEvents[id]
rumour -> state.world.socialRumours[id]
system -> always valid if id is non-empty
other -> shape-only valid
```

`validateWorldReferences` should check at least:

- each culture's `namingProfileId` exists in the naming profile registry from Phase 22
- each faction's `cultureId`, if present, exists
- each supplier's `goodsProvided` ids exist in `state.stock` or `stockRegistry`
- each supplier's `factionId`, if present, exists
- each supplier's `cultureId`, if present, exists
- each regular's `groupId` exists in `state.customerGroups`
- each regular's `cultureId`, if present, exists
- each regular's `favoriteStockId`, if present, exists
- each notable NPC's `groupId`, `cultureId`, and `factionId`, if present, exist
- each local event's related faction and culture ids exist
- each rumour's `subject` resolves through `validateEntityRef`
- no generated name has an unknown `profileId`

### Integration Point

Update `safeValidateState` and `validateState` in `src/sim/state/validation.ts` so cross-reference errors are included after schema parsing succeeds.

Recommended approach:

```ts
const parsed = schema.safeParse(state)
if (!parsed.success) { ... }
const referenceErrors = validateWorldReferences(parsed.data as TavernState)
if (referenceErrors.length > 0) {
  return { success: false, errors: referenceErrors, warnings }
}
```

For `validateState`, throw if cross-reference errors exist.

### Error Style

Use existing `ValidationIssue` style:

```ts
{
  path: 'world.suppliers.brag.goodsProvided[0]',
  message: "Supplier 'brag' provides unknown stock id 'moon_cheese'",
  code: 'unknown_stock_ref',
}
```

---

## 26.5 Add Registry Membership Checks For Existing Expanded Fields

Phase 29 and 30 will add new fields to area, supplier, culture, and customer definitions.

Prepare validation helpers now so those later phases can reuse them.

Suggested helpers:

```txt
src/sim/state/registryValidation.ts
```

Recommended functions:

```ts
export function validateRegistryId(
  path: string,
  registryName: string,
  id: string,
  exists: (id: string) => boolean,
): ValidationIssue[]

export function validateUniqueIds(
  path: string,
  ids: string[],
): ValidationIssue[]
```

Use these helpers in `referenceValidation.ts` and future module validators.

---

## 26.6 Add Phase 26 Tests

Create:

```txt
tests/sim/phase26.expandedValidation.test.ts
```

Tests should cover:

1. `createInitialTavernState()` validates successfully with the new `world` state.
2. A supplier that references an unknown stock id fails validation.
3. A regular customer that references an unknown `customerGroups` id fails validation.
4. A faction that references an unknown culture id fails validation.
5. A generated name with an unknown naming profile id fails validation.
6. A social rumour subject with an unknown entity id fails validation.
7. Existing Phase 6 validation behaviour still works.
8. Unknown `state.modules` keys remain warnings, not hard failures.

### Acceptance Criteria

- `npm run test -- tests/sim/phase26.expandedValidation.test.ts` passes.
- `npm run test` passes.
- Invalid expanded references fail clearly.
- Valid empty world state passes.
- Validation errors use precise paths.
- No cards are introduced.

---

# Phase 27 - Expanded Engine Hooks

## Mirrors Phase 7: Simulation Engine and Phase Pipeline

## Goal

Add safe engine/module seams for expanded world systems without disrupting the existing daily pipeline.

The current phase pipeline is defined in:

```txt
src/sim/core/phases.ts
```

Current phases:

```ts
export type SimulationPhase =
  | 'startDay'
  | 'applyDayTypeModifiers'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'applyOwnerActions'
  | 'afterOwnerActions'
  | 'assignStaffPriorities'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'closing'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generateReports'
  | 'validate'
  | 'advanceCalendar'
```

Do not reorder existing phases.

---

## 27.1 Add Expanded Simulation Phases

Add new phases to `src/sim/core/phases.ts` only where they naturally fit.

Recommended updated union:

```ts
export type SimulationPhase =
  | 'startDay'
  | 'identityGeneration'
  | 'applyDayTypeModifiers'
  | 'cultureUpdate'
  | 'supplierUpdate'
  | 'factionUpdate'
  | 'regularCustomerUpdate'
  | 'localEventUpdate'
  | 'rumourUpdate'
  | 'forecastTraffic'
  | 'beforeOwnerActions'
  | 'applyOwnerActions'
  | 'afterOwnerActions'
  | 'assignStaffPriorities'
  | 'beforeService'
  | 'service'
  | 'afterService'
  | 'closing'
  | 'endDay'
  | 'endWeek'
  | 'endMonth'
  | 'generateReports'
  | 'validate'
  | 'advanceCalendar'
```

Recommended order:

```ts
export const SIMULATION_PHASES: readonly SimulationPhase[] = [
  'startDay',
  'identityGeneration',
  'applyDayTypeModifiers',
  'cultureUpdate',
  'supplierUpdate',
  'factionUpdate',
  'regularCustomerUpdate',
  'localEventUpdate',
  'rumourUpdate',
  'forecastTraffic',
  'beforeOwnerActions',
  'applyOwnerActions',
  'afterOwnerActions',
  'assignStaffPriorities',
  'beforeService',
  'service',
  'afterService',
  'closing',
  'endDay',
  'endWeek',
  'endMonth',
  'generateReports',
  'validate',
  'advanceCalendar',
]
```

### Why This Order

- `identityGeneration` runs early so systems can safely reference generated identities that already exist.
- `cultureUpdate`, `supplierUpdate`, `factionUpdate`, `regularCustomerUpdate`, `localEventUpdate`, and `rumourUpdate` run before traffic forecasting so customer behaviour can eventually react to them.
- Service remains in the same general area of the pipeline.
- Reports and validation still happen near the end.
- Calendar advancement remains last.

### Important Rule

The added phases may exist before they have many hooks. Empty phases are fine. They are tracks in the tavern floor for future carts to roll on.

---

## 27.2 Add Context Helpers For World Mutation

The current `SimContext` has mutation helpers:

```ts
modifyArea(...)
modifyStock(...)
modifyStaff(...)
modifyCustomerGroup(...)
modifyCoin(...)
modifyReputation(...)
modifyModuleState(...)
modifyPressure(...)
```

Add world mutation helpers to `src/sim/core/context.ts`:

```ts
modifyCulture(id: string, changes: Partial<CultureWorldState>, meta: MutationMeta): void
modifyFaction(id: string, changes: Partial<FactionWorldState>, meta: MutationMeta): void
modifySupplier(id: string, changes: Partial<SupplierWorldState>, meta: MutationMeta): void
modifyRegular(id: string, changes: Partial<RegularWorldState>, meta: MutationMeta): void
modifyNotableNpc(id: string, changes: Partial<NotableNpcWorldState>, meta: MutationMeta): void
modifyLocalEvent(id: string, changes: Partial<LocalEventWorldState>, meta: MutationMeta): void
modifySocialRumour(id: string, changes: Partial<SocialRumourWorldState>, meta: MutationMeta): void
modifyTavernIdentity(changes: Partial<TavernIdentityWorldState>, meta: MutationMeta): void
```

These should be implemented in `src/sim/core/engine.ts` using the same mutation pattern as existing helpers:

- clone the target branch
- apply changes
- clamp meters where appropriate only if current helpers already do that for equivalent fields
- record cause metadata
- update change tracker
- preserve JSON-safe state

### Cause Type Expansion (canonical home)

Phase 27 is the canonical place to extend `CauseTargetType` and cause source types with world kinds. Later phases (28–35) must assume these have already been added here and use them directly. Do not hedge or duplicate this expansion elsewhere.

Current `CauseTargetType` includes:

```ts
'coin' | 'area' | 'stock' | 'staff' | 'customer' | 'reputation' | 'pressure' | 'memory' | 'global'
```

Update `CauseTargetType` in `src/sim/state/TavernState.ts`, `src/sim/modules/causes/causeTypes.ts`, and `CauseEntrySchema` to add:

```ts
| 'culture'
| 'faction'
| 'supplier'
| 'regular'
| 'notable_npc'
| 'local_event'
| 'rumour'
| 'tavern_identity'
```

Also update cause source types to add:

```ts
| 'culture'
| 'faction'
| 'supplier'
| 'regular'
| 'local_event'
| 'rumour'
```

Keep old values intact.

---

## 27.3 Add World Query Helpers To Context

Add read helpers so modules do not poke through the world state shape repeatedly.

Recommended `SimContext` additions:

```ts
getCulture(id: string): CultureWorldState | undefined
getFaction(id: string): FactionWorldState | undefined
getSupplier(id: string): SupplierWorldState | undefined
getRegular(id: string): RegularWorldState | undefined
getNotableNpc(id: string): NotableNpcWorldState | undefined
getLocalEvent(id: string): LocalEventWorldState | undefined
getSocialRumour(id: string): SocialRumourWorldState | undefined
```

These can be thin wrappers around `state.world.*`.

The purpose is not complexity. The purpose is to avoid future modules scattering direct paths everywhere like breadcrumbs through a rat maze.

---

## 27.4 Add Skeleton World Modules

Create modules under `src/sim/modules/` for expanded world behaviour. These modules can be minimal in Phase 27.

Recommended structure:

```txt
src/sim/modules/world/
  index.ts
  worldModule.ts
  types.ts

src/sim/modules/suppliers/
  index.ts
  supplierModule.ts
  supplierReport.ts
  types.ts

src/sim/modules/cultures/
  index.ts
  cultureModule.ts
  cultureReport.ts
  types.ts

src/sim/modules/factions/
  index.ts
  factionModule.ts
  factionReport.ts
  types.ts

src/sim/modules/regulars/
  index.ts
  regularModule.ts
  regularReport.ts
  types.ts
```

### Module Responsibilities In Phase 27

At this phase, modules should mostly prove they can register and run.

`worldModule`:

- owns broad world report sections if needed
- validates world references by calling Phase 26 helpers
- may build a small `World` report section

`supplierModule`:

- hooks into `supplierUpdate`
- no major price logic yet, unless Phase 29 implements it immediately

`cultureModule`:

- hooks into `cultureUpdate`
- no major customer behaviour rewrites yet, unless Phase 30 implements them immediately

`factionModule`:

- hooks into `factionUpdate`
- can leave relationship drift for later phases

`regularModule`:

- hooks into `regularCustomerUpdate`
- can leave emergence logic for Phase 30

### Register Modules

The current repo uses `src/sim/registries/moduleRegistry.ts`. Add new modules there or wherever existing required modules are registered.

Do not make module order depend on import side effects unless the existing registry pattern already does that for other modules.

---

## 27.5 Add Phase Boundary Diffs If Needed

The engine already tracks diffs around important boundaries such as owner actions, service, week, and month.

Do not add a new diff boundary unless a report or validator truly needs it.

If needed, add one new boundary:

```ts
'worldUpdate'
```

It should wrap:

```txt
cultureUpdate
supplierUpdate
factionUpdate
regularCustomerUpdate
localEventUpdate
rumourUpdate
```

But default recommendation: avoid adding this in Phase 27 unless tests prove it is valuable.

---

## 27.6 Add Phase 27 Tests

Create:

```txt
tests/sim/phase27.expandedHooks.test.ts
```

Tests should verify:

1. New phases exist in `SIMULATION_PHASES`.
2. Existing phase order around owner actions and service is unchanged:

```txt
beforeOwnerActions
applyOwnerActions
afterOwnerActions
assignStaffPriorities
beforeService
service
afterService
```

3. `identityGeneration` happens before `forecastTraffic`.
4. `supplierUpdate`, `cultureUpdate`, `factionUpdate`, `regularCustomerUpdate`, `localEventUpdate`, and `rumourUpdate` happen before `forecastTraffic`.
5. A test module can register a hook to one of the new phases and have it run.
6. The new world mutation helpers actually modify state.
7. World mutations produce causes or at least participate in the existing cause contract.
8. `npm run test` still passes.

### Acceptance Criteria

- The expanded phase pipeline works.
- Existing module hooks still run.
- Existing tests still pass.
- New world modules can hook into new phases.
- Context mutation helpers exist and are cause-aware.
- No cards are introduced.

---

# Phase 28 - Area Traits, Upgrades, and Atmosphere

## Mirrors Phase 8: Area System

## Goal

Expand areas from condition containers into physical places with persistent traits, upgrade slots, atmosphere, and better issue-seed fuel.

The current area system lives at:

```txt
src/sim/modules/areas/
  areasModule.ts
  derived.ts
  index.ts
  types.ts

src/sim/registries/areaRegistry.ts
```

Current `AreaState` in `src/sim/state/TavernState.ts` contains:

```ts
export type AreaState = {
  id: string
  label: string
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
  tags: string[]
  activeProblems: string[]
}
```

Current required areas are:

```txt
main_room
kitchen
cellar
privy
roof
```

Phase 28 should extend this system without replacing its current meters.

---

## 28.1 Extend Area State

Update `AreaState` in `src/sim/state/TavernState.ts`:

```ts
export type AreaTraitId = string
export type AreaUpgradeId = string
export type AtmosphereTag = string

export type AreaUpgradeState = {
  id: AreaUpgradeId
  status: 'available' | 'in_progress' | 'installed' | 'damaged' | 'disabled'
  progress?: number
  installedAtDay?: number
  tags: string[]
}

export type AreaState = {
  id: string
  label: string
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
  tags: string[]
  activeProblems: string[]

  traits: AreaTraitId[]
  atmosphere: AtmosphereTag[]
  upgrades: Record<AreaUpgradeId, AreaUpgradeState>
}
```

Update `AreaStateSchema` to include:

```ts
traits: z.array(z.string()),
atmosphere: z.array(z.string()),
upgrades: z.record(z.string(), AreaUpgradeStateSchema),
```

### Migration Requirement

Existing saves and tests may create old `AreaState` records without these fields.

Update:

```txt
src/sim/state/normalize.ts
src/sim/state/migrations.ts
src/sim/state/defaults.ts
```

so missing fields default to:

```ts
traits: []
atmosphere: []
upgrades: {}
```

Do not force every existing test fixture to hand-write the new fields if a normalizer already exists.

---

## 28.2 Add Area Trait and Upgrade Content Types

Phase 22 should have created:

```txt
src/sim/content/tavern/atmosphereTypes.ts
src/sim/content/tavern/upgradeTypes.ts
```

Fill these with reusable definitions.

Recommended types:

```ts
export type AreaTraitDefinition = {
  id: string
  label: string
  description: string
  allowedAreaTags?: string[]
  incompatibleTraits?: string[]
  mechanicalTags: string[]
}

export type AreaUpgradeDefinition = {
  id: string
  label: string
  description: string
  allowedAreaIds?: string[]
  allowedAreaTags?: string[]
  costCoin: number
  buildDays?: number
  addsTraits?: string[]
  removesTraits?: string[]
  addsAtmosphere?: string[]
  meterEffects?: Partial<{
    condition: number
    cleanliness: number
    mess: number
    damage: number
    smell: number
    risk: number
  }>
  tags: string[]
}
```

Create registries:

```txt
src/sim/content/tavern/areaTraitRegistry.ts
src/sim/content/tavern/areaUpgradeRegistry.ts
```

Use the existing `Registry<T>` utility from `src/sim/registries/Registry.ts`.

---

## 28.3 Seed Required Area Traits

Add a small starter set. Keep it useful, not encyclopedic.

Suggested traits:

```txt
cozy
drafty
sticky_floor
smells_of_smoke
rat_scratched
well_lit
crowded
private
dangerous_corner
music_friendly
inspection_sensitive
food_prep_visible
pest_prone
weather_exposed
```

Each trait must have mechanical tags, such as:

```txt
comfort_positive
cleanliness_negative
risk_positive
merchant_sensitive
rowdy_sensitive
inspection_relevant
pest_relevant
```

### Rule

A trait should never be pure prose. If it cannot influence reports, satisfaction, issue seeds, pressure, or future card text ingredients, do not add it yet.

---

## 28.4 Seed Required Area Upgrades

Add a small starter set organized by current required areas.

### Main Room

```txt
better_tables
hearth_repair
music_corner
private_booths
reinforced_stools
```

### Kitchen

```txt
sharp_knives
large_stew_pot
clean_prep_bench
smoke_vent
```

### Cellar

```txt
rat_proof_barrels
cold_stone_shelves
hidden_reserve_rack
```

### Privy

```txt
lime_bucket_station
privacy_screen
stone_drainage
```

### Roof

```txt
patched_thatch
rain_gutters
reinforced_beams
```

Each upgrade should specify:

- allowed area id or tags
- coin cost
- optional build days
- traits added or removed
- atmosphere added
- meter effects
- mechanical tags

---

## 28.5 Update Area Registry Defaults

`src/sim/registries/areaRegistry.ts` currently defines `AreaDefaultState` as:

```ts
export type AreaDefaultState = Omit<AreaState, 'id' | 'label' | 'tags'>
```

After extending `AreaState`, this means every required area default must include:

```ts
traits
atmosphere
upgrades
```

Recommended default flavour grounded in current areas:

```ts
main_room: {
  traits: ['sticky_floor', 'dangerous_corner'],
  atmosphere: ['cheap', 'rowdy', 'lived_in'],
  upgrades: {},
}

kitchen: {
  traits: ['smells_of_smoke', 'food_prep_visible'],
  atmosphere: ['hot', 'busy', 'rough'],
  upgrades: {},
}

cellar: {
  traits: ['pest_prone', 'drafty'],
  atmosphere: ['damp', 'shadowed'],
  upgrades: {},
}

privy: {
  traits: ['inspection_sensitive'],
  atmosphere: ['grim', 'smelly'],
  upgrades: {},
}

roof: {
  traits: ['weather_exposed'],
  atmosphere: ['leaky'],
  upgrades: {},
}
```

Keep the existing numeric meters unchanged unless a test specifically requires adjustment. This phase expands identity. It does not retune the tavern.

---

## 28.6 Update Derived Area Helpers

Current derived area helpers live at:

```txt
src/sim/modules/areas/derived.ts
```

Add helpers like:

```ts
export function hasAreaTrait(area: AreaState, traitId: string): boolean
export function hasAreaAtmosphere(area: AreaState, tag: string): boolean
export function hasInstalledUpgrade(area: AreaState, upgradeId: string): boolean
export function getAreaMechanicalTags(area: AreaState): string[]
export function describeAreaAtmosphere(area: AreaState): string[]
```

`getAreaMechanicalTags` should combine:

- `area.tags`
- trait mechanical tags from the trait registry
- installed upgrade tags
- current active problems

This gives later customer, issue seed, and report modules one place to ask what an area means.

---

## 28.7 Update Area Reports

The current `areasModule.ts` already builds reports about area condition, mess, damage, smell, and risks.

Expand reports so they can mention traits and installed upgrades when relevant.

Examples:

```txt
Main Room: rough, sticky floor, dangerous corner. No installed upgrades.
Kitchen: smoky and busy. Smoke vent upgrade is available but not installed.
Cellar: damp and pest-prone. Rat-proof barrels would reduce stock risk.
```

### Important Rule

Reports should not become purple prose soup.

Area report lines should remain compact and mechanical. The purpose is to expose useful simulation facts, not write card flavour yet.

---

## 28.8 Add Area Trait Influence To Existing Systems Lightly

Do not rewrite service.

Add small, testable influence points:

- `sticky_floor` increases `risk` or service incident chance slightly.
- `cozy` helps merchant or respectable customer satisfaction.
- `pest_prone` increases pest pressure if stock exists in that area.
- `inspection_sensitive` increases inspection pressure when cleanliness is low.
- `music_friendly` can be inert until owner action/social phases later.

Prefer helpers that other modules can call rather than burying trait logic directly inside service.

---

## 28.9 Add Phase 28 Tests

Create:

```txt
tests/sim/phase28.areaTraitsUpgrades.test.ts
```

Tests should verify:

1. `createInitialTavernState()` creates every area with `traits`, `atmosphere`, and `upgrades` fields.
2. Existing required areas retain their original ids and labels.
3. Area schemas reject invalid upgrade statuses.
4. Area trait registry imports and contains required starter traits.
5. Area upgrade registry imports and contains required starter upgrades.
6. Derived helpers detect traits and installed upgrades correctly.
7. Area reports include trait or atmosphere information when present.
8. Existing Phase 8 tests still pass.

### Acceptance Criteria

- Areas have persistent traits.
- Areas have persistent upgrade records.
- Area defaults remain compatible with existing systems.
- Reports expose area atmosphere without becoming card prose.
- No finished cards are introduced.

---

# Phase 29 - Supplier, Market, and Goods Expansion

## Mirrors Phase 9: Stock and Economy System

## Goal

Expand the stock/economy layer so goods have suppliers, market conditions, delivery causes, and more card-ready economic texture.

The current economy and stock systems live at:

```txt
src/sim/modules/stock/
  index.ts
  ledger.ts
  sales.ts
  spoilage.ts
  state.ts
  stockModule.ts
  types.ts

src/sim/modules/economy/
  index.ts
  types.ts

src/sim/registries/stockRegistry.ts
```

Current stock state includes:

```ts
export type StockState = {
  id: string
  label: string
  quantity: number
  quality: number
  spoilage: number
  basePrice: number
  salePrice: number
  tags: string[]
  storageAreaId?: string
}
```

Phase 29 should not throw this out. It should add supplier and market context around it.

---

## 29.1 Supplier Content Definitions

Phase 22 should have created:

```txt
src/sim/content/suppliers/
  index.ts
  supplierRegistry.ts
  supplierTypes.ts
```

Fill these with supplier definitions.

Recommended types:

```ts
export type SupplierTypeId = string
export type DeliveryPatternId = string

export type SupplierDefinition = {
  id: string
  label: string
  supplierType: SupplierTypeId
  namingProfileId: string
  goodsProvided: string[]
  defaultReliability: number
  defaultRelationship: number
  defaultDebtTolerance: number
  defaultPriceBias: number
  deliveryPattern: DeliveryPatternId
  factionId?: string
  cultureId?: string
  tags: string[]
}
```

Extends the skeleton from Phase 22 with supplier-specific operational fields (`supplierType`, `namingProfileId`, `defaultDebtTolerance`, `defaultPriceBias`, `deliveryPattern`). All Phase 22 field names are preserved.

Create:

```ts
export const supplierRegistry = new Registry<SupplierDefinition>()
```

### Starter Supplier Definitions

Add a small starter set:

```txt
brakka_mushroom_cart
  goods: mushrooms, stew ingredients if present
  type: food_cart
  tags: cheap, local, unreliable_when_raining

old_keg_brewers
  goods: ale
  type: brewer
  tags: alcohol, established, relationship_sensitive

mudroad_grain_runner
  goods: grain/bread/flour equivalent if present
  type: caravan
  tags: road_sensitive, bulk_goods

candle_and_tallow_peddler
  goods: candles/tallow if present in current stock registry
  type: peddler
  tags: small_goods, weekly

scrap_meat_vendor
  goods: meat/stew equivalent if present
  type: butcher_or_salvage_food
  tags: cheap, suspicious_quality
```

### Important Compatibility Rule

Only reference stock ids that actually exist in `src/sim/registries/stockRegistry.ts`.

If a desired good does not exist yet, either:

1. add it deliberately to the stock registry with tests, or
2. leave it out of the supplier starter set.

Do not write suppliers that provide imaginary stock ids. Phase 26 should catch that anyway.

---

## 29.2 Supplier World State Seeding

If Phase 25 added `state.world.suppliers`, seed it in `src/sim/state/defaults.ts` using `supplierRegistry`.

Recommended helper:

```ts
function createInitialSuppliers(): Record<string, SupplierWorldState> {
  ensureRequiredSuppliersRegistered()
  const suppliers: Record<string, SupplierWorldState> = {}
  for (const def of supplierRegistry.all()) {
    suppliers[def.id] = {
      id: def.id,
      name: generateOrStaticSupplierName(def),
      supplierType: def.supplierType,
      reliability: def.defaultReliability,
      relationship: def.defaultRelationship,
      debtTolerance: def.defaultDebtTolerance,
      priceBias: def.defaultPriceBias,
      goodsProvided: [...def.goodsProvided],
      factionId: def.factionId,
      cultureId: def.cultureId,
      tags: [...def.tags],
      activeFlags: [],
    }
  }
  return suppliers
}
```

### Determinism Note

If default state generation currently does not accept a seed, do not use random supplier names in `createInitialTavernState()` yet.

Use static generated-name-shaped records for seed suppliers:

```ts
name: {
  display: def.label,
  profileId: def.namingProfileId,
  generatedBy: 'supplier_registry',
}
```

True random supplier names can be generated later during `identityGeneration` when `ctx.rng` is available.

---

## 29.3 Market Condition Types

Add market condition definitions under:

```txt
src/sim/content/suppliers/marketTypes.ts
src/sim/content/suppliers/marketConditionRegistry.ts
```

Recommended types:

```ts
export type MarketConditionDefinition = {
  id: string
  label: string
  description: string
  affectedStockTags?: string[]
  affectedStockIds?: string[]
  priceMultiplier?: number
  availabilityMultiplier?: number
  qualityModifier?: number
  pressureTags: string[]
  calendarTags?: string[]
  tags: string[]
}
```

Starter conditions:

```txt
grain_shortage
cheap_mushrooms
ale_tax
road_bandits
merchant_surplus
winter_prices
festival_demand
spoiled_delivery_rumour
```

---

## 29.4 Market Module State

Do not put every market detail directly into root state. Use a module slice for active market runtime state:

```txt
state.modules.suppliers
```

Recommended `SupplierModuleState`:

```ts
export type SupplierModuleState = {
  activeMarketConditions: ActiveMarketCondition[]
  deliveriesToday: SupplierDeliveryRecord[]
  priceAdjustmentsToday: SupplierPriceAdjustment[]
  missedDeliveriesToday: SupplierMissedDelivery[]
}

export type ActiveMarketCondition = {
  id: string
  startedAtDay: number
  expiresAtDay?: number
  intensity: number
  tags: string[]
}

export type SupplierDeliveryRecord = {
  supplierId: string
  stockId: string
  quantity: number
  quality: number
  coinCost: number
  causeId?: string
  tags: string[]
}
```

Add `stateSchema` for the supplier module, following current module schema patterns.

---

## 29.5 Supplier Update Hook

Implement `supplierModule` from Phase 27 in:

```txt
src/sim/modules/suppliers/supplierModule.ts
```

Hook into:

```ts
supplierUpdate
```

Phase 29 supplier logic should be modest:

1. Clear daily delivery/price adjustment arrays at the start of update.
2. Determine if any active market conditions apply today.
3. Apply lightweight supplier relationship drift if needed.
4. Record report-ready summaries.

Do not automatically restock huge amounts unless existing owner actions or stock systems expect that.

The current stock system already has restocking and ledger logic. Supplier systems should explain and modify availability/pricing, not bypass the stock module.

---

## 29.6 Price Adjustment Helper

Add helper:

```txt
src/sim/modules/suppliers/pricing.ts
```

Recommended function:

```ts
export function getEffectiveBasePrice(
  stock: StockState,
  supplier: SupplierWorldState | undefined,
  activeConditions: ActiveMarketCondition[],
): number
```

This should calculate:

```txt
stock.basePrice
+ supplier price bias
* market condition multipliers
```

Return a number. Do not mutate state inside this helper.

Later owner actions can use this when restocking.

---

## 29.7 Tie Suppliers To Existing Stock Reports

The current stock reports should eventually be able to explain:

```txt
Ale is expensive because Old Keg Brewers are affected by ale tax.
Mushrooms are unreliable because Brakka's cart missed delivery.
```

In Phase 29, add minimal report support:

```txt
src/sim/modules/suppliers/supplierReport.ts
```

Report section should include:

- active market conditions
- unreliable suppliers
- missed deliveries
- notable price changes
- stock ids affected

Do not rewrite `stockModule` reports unless needed. It is fine to have a separate `Suppliers` report section.

---

## 29.8 Supplier Causes and Pressures

Add causes when supplier/market systems materially change state.

Examples:

```ts
ctx.modifySupplier('old_keg_brewers', { relationship: 42 }, {
  source: 'suppliers.relationship_drift',
  sourceType: 'supplier',
  target: 'old_keg_brewers',
  targetType: 'supplier',
  readable: 'Old Keg Brewers trust fell after late payment pressure.',
  tags: ['supplier', 'relationship'],
})
```

Potential pressure integration:

- unreliable suppliers increase `stock_shortage`
- road bandits increase `stock_shortage` and maybe `violence`
- ale tax increases `debt` or `reputation_drift` if prices rise

Keep this light in Phase 29. Pressure webs expand later.

---

## 29.9 Add Phase 29 Tests

Create:

```txt
tests/sim/phase29.suppliersMarketGoods.test.ts
```

Tests should verify:

1. Supplier registry imports and contains starter suppliers.
2. Every supplier `goodsProvided` id exists in `stockRegistry` or `state.stock`.
3. Initial state contains seeded suppliers under `state.world.suppliers`.
4. Supplier module state validates.
5. `supplierUpdate` hook runs.
6. Active market conditions can affect effective base price.
7. Supplier reports mention active conditions or known suppliers.
8. Invalid supplier references fail Phase 26 validation.
9. Existing Phase 9 stock tests still pass.

### Acceptance Criteria

- Suppliers are persistent world entities.
- Supplier definitions are registry-driven.
- Market conditions exist and validate.
- Pricing helpers are deterministic and pure.
- Stock systems are extended, not replaced.
- No finished cards are introduced.

---

# Phase 30 - Cultures, Races, Factions, and Regular Customers

## Mirrors Phase 10: Customer Group System

## Goal

Expand customer groups into culturally distinct populations and add persistent regular customers that can later feed memories, issue seeds, and card text.

The current customer system lives at:

```txt
src/sim/modules/customers/
  customerModule.ts
  forecast.ts
  impact.ts
  index.ts
  purchases.ts
  satisfaction.ts
  types.ts

src/sim/registries/customerRegistry.ts
```

Current `CustomerGroupState` contains:

```ts
export type CustomerGroupState = {
  id: string
  label: string
  patronage: number
  satisfaction: number
  wealth: number
  rowdiness: number
  dangerTolerance: number
  filthTolerance: number
  priceSensitivity: number
  loyalty: number
  damageRisk: number
  tabRisk: number
  preferredStockTags: string[]
  dislikedTags: string[]
  tags: string[]
  activeGrudges: string[]
}
```

Current required customer groups are:

```txt
local_goblins
miners
merchants
ogres
adventurers
```

Phase 30 should deepen these groups without breaking current traffic/service behaviour.

---

## 30.1 Culture Content Definitions

Phase 22 should have created:

```txt
src/sim/content/cultures/
  index.ts
  cultureRegistry.ts
  cultureTypes.ts
```

Fill these with registry-driven culture definitions.

Recommended type:

```ts
export type CultureDefinition = {
  id: string
  label: string
  namingProfileId: string
  description: string
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
  areaTraitPreferences?: {
    likes: string[]
    dislikes: string[]
  }
  conflictTags: string[]
  defaultFamiliarity: number
  defaultComfort: number
  defaultTension: number
  tags: string[]
}
```

Starter cultures should map to current groups without overbuilding:

```txt
goblin_local
miner_workcrew
merchant_roadfolk
ogre_clans
adventuring_bands
```

### Naming Profile Link

Each culture must reference a naming profile from Phase 22.

Examples:

```txt
goblin_local -> goblin_common
miner_workcrew -> dwarf_or_goblin_miner style profile, depending on chosen naming setup
merchant_roadfolk -> human_town or road_merchant
ogre_clans -> ogre_clan
adventuring_bands -> mixed_adventurer
```

Do not create culture records with missing `namingProfileId` values. Phase 26 should catch them.

---

## 30.2 Extend Customer Group Definitions

Update `src/sim/registries/customerRegistry.ts` so `CustomerGroupDefinition` can include cultural metadata.

Current shape:

```ts
export type CustomerGroupDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: CustomerGroupDefaultState
}
```

Recommended extension:

```ts
export type CustomerGroupDefinition = {
  id: string
  label: string
  cultureId: string
  namingProfileId: string
  trafficPattern: string
  spendingProfile: string
  tags: string[]
  defaultState: CustomerGroupDefaultState
  relationshipToOtherGroups?: Record<string, number>
}
```

Then extend `CustomerGroupState` only if runtime values need to change during play.

Recommended state extension:

```ts
export type CustomerGroupState = {
  ...existingFields
  cultureId: string
  namingProfileId: string
  trafficPattern: string
  spendingProfile: string
  relationshipToOtherGroups: Record<string, number>
}
```

### Compatibility Rule

Update `CustomerGroupStateSchema` and `createInitialCustomerGroups()` in `src/sim/state/defaults.ts`.

Existing tests that assert required groups exist should still pass. Do not rename ids.

---

## 30.3 Seed Culture World State

Add helper in `src/sim/state/defaults.ts`:

```ts
function createInitialCultures(): Record<string, CultureWorldState> {
  ensureRequiredCulturesRegistered()
  const cultures: Record<string, CultureWorldState> = {}
  for (const def of cultureRegistry.all()) {
    cultures[def.id] = {
      id: def.id,
      label: def.label,
      familiarity: def.defaultFamiliarity,
      comfort: def.defaultComfort,
      tension: def.defaultTension,
      namingProfileId: def.namingProfileId,
      preferredStockTags: [...def.preferredStockTags],
      dislikedTags: [...def.dislikedTags],
      importantCalendarTags: [...def.importantCalendarTags],
      tags: [...def.tags],
    }
  }
  return cultures
}
```

Then wire it into `createInitialWorld()` from Phase 25.

---

## 30.4 Faction Content Definitions

Phase 22 should have created:

```txt
src/sim/content/factions/
  index.ts
  factionRegistry.ts
  factionTypes.ts
```

Recommended type:

```ts
export type FactionDefinition = {
  id: string
  label: string
  cultureId?: string
  description: string
  defaultRelationship: number
  defaultInfluence: number
  defaultTrust: number
  defaultFear: number
  interests: string[]
  dislikedPolicies: string[]
  likedPolicies: string[]
  tags: string[]
}
```

Note: Phase 22's skeleton included a separate `pressureTags` field. Fold that purpose into `tags` here — there is no behaviour Phase 22's `pressureTags` needs that an entry in `tags` cannot serve. Saves one array per faction definition.

```ts
// `pressureTags` from Phase 22 are now expressed as entries in `tags`,
// e.g., tags: ['town_watch_pressure', 'inspection_authority']
```

Starter factions:

```txt
miners_union
brewers_guild
town_watch
market_caravan_circle
local_shrine
scrap_collectors
```

These should be small but useful. Factions are not lore wallpaper. Each should have mechanical tags that can later affect issues, suppliers, inspections, or customer traffic.

---

## 30.5 Seed Faction World State

In `src/sim/state/defaults.ts`, add:

```ts
function createInitialFactions(): Record<string, FactionWorldState> {
  ensureRequiredFactionsRegistered()
  const factions: Record<string, FactionWorldState> = {}
  for (const def of factionRegistry.all()) {
    factions[def.id] = {
      id: def.id,
      label: def.label,
      cultureId: def.cultureId,
      relationship: def.defaultRelationship,
      influence: def.defaultInfluence,
      trust: def.defaultTrust,
      fear: def.defaultFear,
      tags: [...def.tags],
      activeFlags: [],
    }
  }
  return factions
}
```

Wire it into `createInitialWorld()`.

---

## 30.6 Regular Customer Types and Emergence

Create or fill:

```txt
src/sim/modules/regulars/
  index.ts
  regularModule.ts
  regularReport.ts
  types.ts
```

Recommended types:

```ts
export type RegularEmergenceCandidate = {
  groupId: string
  chance: number
  reason: string
  tags: string[]
}

export type RegularModuleState = {
  candidatesToday: RegularEmergenceCandidate[]
  createdToday: string[]
  visitedToday: string[]
}
```

### Emergence Logic

During `regularCustomerUpdate`, regulars may emerge from customer groups.

Suggested conditions:

- group turnout has been high recently
- group loyalty is high
- group satisfaction is high
- tavern has a relevant reputation axis
- a service incident involved that group

Keep this conservative. Regulars should feel notable, not pour endlessly out of the wall like named confetti.

Example:

```txt
If local_goblins loyalty > 70 and satisfaction > 55, small chance to create a regular.
If miners visited on payday and satisfaction improved, small chance to create a miner regular.
If merchants are dissatisfied, do not create a loyal merchant regular.
```

### Name Generation

Use Phase 24 RNG streams and Phase 22 naming profiles.

```ts
const rng = ctx.getRngStream('regular_identity') // Phase 24 added this stream
const name = generateName(profile, rng, 'regular_customer')
```

The `regular_identity` stream isolates regular-customer name generation from staff/supplier/NPC streams (see Phase 24).

Do not call `generateName()` in reports. Generate once, store in `state.world.regulars`, then reuse.

---

## 30.7 Regular Customer Visits

Regulars should be linked to existing customer traffic, not replace it.

In Phase 30, do not deeply rewrite `customerModule.ts`.

Recommended light integration:

- during `regularCustomerUpdate`, decide which existing regulars are likely to visit based on group traffic, loyalty, and day tags
- store `visitedToday` in `state.modules.regulars`
- reports can mention regular visits
- future issue seeds can read `visitedToday`

Do not yet make every sale customer-specific.

---

## 30.8 Culture Influence On Forecasting

Current customer forecasting lives at:

```txt
src/sim/modules/customers/forecast.ts
```

Phase 30 should add light culture influence only.

Examples:

- if calendar has a culture's important tag, increase that group's expected turnout
- if an area's traits conflict with culture preferences, reduce satisfaction or turnout slightly
- if culture tension is high, increase notes and future issue seed likelihood

Recommended helper:

```txt
src/sim/modules/cultures/customerInfluence.ts
```

Recommended function:

```ts
export function getCultureForecastModifier(
  state: TavernState,
  group: CustomerGroupState,
): { modifier: number; notes: string[] }
```

Then call it from `forecast.ts` without making `forecast.ts` own all culture logic.

---

## 30.9 Faction Relationship Drift

Implement minimal faction update in:

```txt
src/sim/modules/factions/factionModule.ts
```

Hook:

```ts
factionUpdate
```

Light drift examples:

- town watch relationship falls if violence pressure is high
- brewers guild relationship falls if ale-related debt or cheapness pressure is high
- miners union relationship rises if miners are satisfied on payday
- market caravan relationship falls if supplier debts are high

Do not overbuild this. Phase 38 will expand pressure webs later.

---

## 30.10 Culture and Faction Reports

Add compact reports:

```txt
src/sim/modules/cultures/cultureReport.ts
src/sim/modules/factions/factionReport.ts
src/sim/modules/regulars/regularReport.ts
```

Culture report should mention:

- highest tension culture
- highest comfort culture
- calendar tags that matter today
- groups affected by area traits if any

Faction report should mention:

- strongest relationship gain/loss
- high influence factions with poor relationship
- any active faction flags

Regular report should mention:

- regulars created today
- regulars who visited today
- regulars with high irritation or high loyalty

Keep reports mechanical and brief.

---

## 30.11 Cross-System Reference Rules

After Phase 30:

- every `CustomerGroupState.cultureId` must exist in `state.world.cultures`
- every `CustomerGroupState.namingProfileId` must exist in naming profiles
- every faction `cultureId`, if present, must exist
- every regular `groupId` must exist
- every regular `cultureId`, if present, must exist
- every regular name profile must exist

Add these checks to Phase 26 validation helpers if not already covered.

---

## 30.12 Add Phase 30 Tests

Create:

```txt
tests/sim/phase30.culturesCustomersRegulars.test.ts
```

Tests should verify:

1. Culture registry imports and contains starter cultures.
2. Faction registry imports and contains starter factions.
3. Initial state seeds cultures and factions.
4. Existing customer group ids remain unchanged.
5. Customer groups have valid `cultureId` and `namingProfileId` values.
6. Culture forecast helper can produce notes/modifiers without mutating state.
7. Regular module state validates.
8. A regular can be generated deterministically from a seeded run.
9. Generated regular names persist in `state.world.regulars`.
10. Faction update hook can shift a faction relationship with a cause.
11. Reports mention cultures, factions, or regulars when relevant.
12. Existing Phase 10 customer tests still pass.

### Acceptance Criteria

- Customer groups are culturally linked.
- Cultures are persistent world entities.
- Factions are persistent world entities.
- Regular customers can exist and persist.
- Name generation is used only at creation time.
- Forecasting can consult culture data lightly.
- Existing customer traffic/service behaviour remains stable.
- No finished cards are introduced.

---

# Batch-Level Implementation Order

Implement these phases in this order:

```txt
26. Validation and reference safety
27. Engine hooks and world module seams
28. Area traits, upgrades, and atmosphere
29. Suppliers, market conditions, and goods expansion
30. Cultures, factions, and regular customers
```

Do not start Phase 29 or 30 before Phase 26 reference validation exists. Otherwise invalid ids will slip into state and become tiny cursed pebbles in every later boot.

---

# Batch-Level Test Expectations

After completing Phases 26 to 30, this should pass:

```bash
npm run typecheck
npm run test
```

New tests expected:

```txt
tests/sim/phase26.expandedValidation.test.ts
tests/sim/phase27.expandedHooks.test.ts
tests/sim/phase28.areaTraitsUpgrades.test.ts
tests/sim/phase29.suppliersMarketGoods.test.ts
tests/sim/phase30.culturesCustomersRegulars.test.ts
```

Existing tests should still pass:

```txt
tests/sim/phase2.structure.test.ts
...
tests/sim/phase20.cardlessPlaytest.test.ts
```

---

# What This Batch Should Produce

By the end of Phase 30, the simulation should support:

- expanded validation for world identity systems
- entity reference validation across old and new state branches
- new simulation phase hooks for world systems
- world mutation helpers in `SimContext`
- area traits
- area atmosphere
- area upgrades
- supplier definitions
- persistent suppliers
- market conditions
- culture definitions
- persistent cultures
- faction definitions
- persistent factions
- regular customer state
- deterministic regular creation
- compact reports for the expanded systems

The game should still not have cards.

What it should have is better card soil: named people, cultural context, meaningful suppliers, textured places, and validation strong enough to keep all those little simulation goblins from eating the wiring.
