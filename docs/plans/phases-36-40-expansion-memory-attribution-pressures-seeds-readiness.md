# Goblin Tavern Simulation Expansion - Phases 36 to 40 Implementation Plan

Status: **Phases 1 to 20 complete, Phase 21 contract complete, Phases 22 to 35 planned**  
Scope of this document: **Expand Phases 36 to 40 only**  
Purpose: Give an implementation agent enough detail to add entity-scoped memory, social attribution, expanded pressure webs, expanded issue seed families, and the final expanded readiness gate while staying grounded in the current repo.

---

## Current Repo Baseline

This plan assumes the current finished `Goblin-Tavern-main` repo plus the added expansion planning docs through Phase 35.

The repo already has the core simulation architecture:

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

The current simulation phase order in `src/sim/core/phases.ts` is:

```ts
export const SIMULATION_PHASES = [
  'startDay',
  'applyDayTypeModifiers',
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

The repo already has canonical state and validation:

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

The repo already has the key late-simulation systems this batch must extend:

```txt
src/sim/modules/history/
  historyLog.ts
  historyModule.ts
  index.ts
  types.ts

src/sim/modules/memories/
  index.ts
  memoryDecay.ts
  memoryModule.ts
  memoryQueries.ts
  memoryRegistry.ts
  memoryReport.ts
  memoryTypes.ts
  patternDetection.ts
  types.ts

src/sim/modules/causes/
  causeAging.ts
  causeModule.ts
  causeQueries.ts
  causeRegistry.ts
  causeReport.ts
  causeTypes.ts
  index.ts
  types.ts

src/sim/modules/pressures/
  index.ts
  pressureModule.ts
  pressureQueries.ts
  pressureRegistry.ts
  pressureReport.ts
  pressureTypes.ts
  types.ts

src/sim/modules/feedback/
  feedbackLoopModule.ts
  feedbackLoopRegistry.ts
  feedbackLoopTypes.ts
  feedbackReport.ts
  index.ts

src/sim/modules/issues/
  contradictionGuards.ts
  generatorHelpers.ts
  impactScoring.ts
  index.ts
  issueSeedGenerators.ts
  issueSeedModule.ts
  issueSeedQueries.ts
  issueSeedRanking.ts
  issueSeedRegistry.ts
  issueSeedReport.ts
  issueSeedTypes.ts
  issueSeedValidation.ts
```

The existing root `TavernState` already includes:

```ts
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
  history: HistoryEntry[]
  causes: CauseEntry[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
```

The existing `EntityRef` currently supports these kinds:

```ts
export type EntityRef = {
  kind:
    | 'staff'
    | 'customer_group'
    | 'area'
    | 'stock'
    | 'role'
    | 'system'
    | 'other'
  id: string
}
```

Phase 26 should already have expanded this list to include world entities such as suppliers, factions, regulars, cultures, local arcs, service scenes, and projects. If that has not been done yet, do it before starting this batch.

The existing issue seed contract in `src/sim/modules/issues/issueSeedTypes.ts` already includes:

- `IssueSeedTiming`
- `IssueSeedType`
- `IssueSeedFamilyId`
- `TextIngredients`
- `StakeRef`
- `ResponseSlot`
- `ConsequenceProfile`
- `IssueSeed`
- `IssueSeedModuleState`

The existing readiness tools are in:

```txt
src/sim/testing/
  balanceRuns.ts
  cardlessPlaytest.ts
  contradictionAudit.ts
  readinessReport.ts
  seedCoverageReport.ts
  simRunner.ts
  strategyComparison.ts
```

Do not replace these systems. Phases 36 to 40 should extend them.

---

## Dependency Assumption From Phases 22 to 35

Phases 36 to 40 assume the following earlier expansion work exists.

From Phases 22 to 25:

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

Expected expanded world state:

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

Expected deterministic RNG streams include at least:

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

From Phases 26 to 30:

- Expanded entity reference kinds.
- World state schemas and cross-reference validation.
- Expanded engine hooks.
- Area traits, upgrades, and atmosphere.
- Supplier registry and supplier state.
- Culture, faction, and regular customer state.

From Phases 31 to 35:

- Staff identity fields and deterministic generated names.
- Service scenes in `state.modules.service.scenesToday` or equivalent.
- Owner projects, policies, and social actions.
- Weekly supplier/staff/community routines.
- Seasonal/local arcs in world or module state.

If any of these pieces are missing, implement the earlier phase first. Do not bury missing Phase 22 to 35 scaffolding inside Phase 36 to 40 like a mushroom invoice hidden under a stew pot.

---

## Expansion Rules For This Batch

Phases 36 to 40 must obey the Phase 21 contract:

1. **No finished cards.**
2. **No UI work.**
3. **No flavour-only memories, rumours, pressures, or seeds.**
4. **Any persistent record must be serializable and schema-validated.**
5. **Entity-specific memories must reference real entities.**
6. **Attribution can be subjective, but it must reference objective source events when possible.**
7. **Expanded pressures must be calculated from state, causes, memories, rumours, arcs, or policies.**
8. **Expanded issue seeds must be structured card fuel, not card prose.**
9. **The readiness gate must measure variety and usefulness, not vibes.**
10. **All Phase 1 to 20 tests must keep passing.**
11. **All expansion tests should use deterministic seeds.**
12. **Prefer additive module slices over rewriting root state.**

---

# Phase 36 - Character, Faction, and Relationship Memory

## Mirrors Phase 16: Memory and History System

## Goal

Expand memory from mostly tavern-level remembered facts into entity-scoped memory that can belong to staff, regular customers, suppliers, factions, customer groups, areas, projects, and local arcs.

The current memory system already has:

```txt
src/sim/modules/memories/
  memoryDecay.ts
  memoryModule.ts
  memoryQueries.ts
  memoryRegistry.ts
  memoryReport.ts
  memoryTypes.ts
  patternDetection.ts
```

The current `MemoryState` is already flexible:

```ts
export type MemoryState = {
  id: string
  type: MemoryType
  definitionId?: string
  label?: string
  strength: number
  ageDays: number
  durationDays?: number
  decayRate?: number
  createdAt: CalendarStamp
  expiresAt?: CalendarStamp
  actors: EntityRef[]
  locations: EntityRef[]
  relatedSystems: string[]
  tags: string[]
  source?: string
  metadata?: Record<string, unknown>
}
```

Do not replace this shape. It already has the right bones. Phase 36 should add better owner semantics, helper queries, entity indexes, and memory patterns.

---

## 36.1 Add Memory Ownership Semantics

### Current Constraint

`MemoryState` can reference `actors` and `locations`, but it does not clearly distinguish:

- who remembers the event
- who caused the event
- who was affected by the event
- where it happened

For Phase 36, keep the canonical `MemoryState` shape unchanged if possible. Add ownership semantics using `metadata` and helpers instead of widening the root type unless the earlier Phase 26 schema work already created a clean `owner` field.

### Recommended Metadata Shape

Create a helper type in:

```txt
src/sim/modules/memories/entityMemory.ts
```

```ts
import type { EntityRef } from '../../state/TavernState'

export type EntityMemoryRole =
  | 'owner'
  | 'subject'
  | 'beneficiary'
  | 'target'
  | 'witness'
  | 'blamed'
  | 'credited'

export type EntityMemoryMetadata = {
  owner?: EntityRef
  subjects?: EntityRef[]
  beneficiaries?: EntityRef[]
  targets?: EntityRef[]
  witnesses?: EntityRef[]
  blamed?: EntityRef[]
  credited?: EntityRef[]
  sourceEventId?: string
  sourceCauseIds?: string[]
  sourceSceneIds?: string[]
  sourceProjectIds?: string[]
  sourceArcIds?: string[]
}
```

### Helper Functions

Add helpers:

```ts
export function memoryOwner(memory: MemoryState): EntityRef | undefined
export function memorySubjects(memory: MemoryState): EntityRef[]
export function memoryTargets(memory: MemoryState): EntityRef[]
export function memoryCredited(memory: MemoryState): EntityRef[]
export function memoryBlamed(memory: MemoryState): EntityRef[]
export function withEntityMemoryMetadata(
  draft: MemoryDraft,
  metadata: EntityMemoryMetadata,
): MemoryDraft
```

### Important Rule

Do not create a second memory array per entity.

Keep `state.memories` as the canonical store. Build indexes and queries over it.

Otherwise the save file turns into a filing cabinet dropped down a mineshaft.

---

## 36.2 Add Entity Memory Query Helpers

Extend or add to:

```txt
src/sim/modules/memories/memoryQueries.ts
```

Add queries such as:

```ts
export function memoriesForOwner(
  state: TavernState,
  owner: EntityRef,
  options?: EntityMemoryQueryOptions,
): MemoryState[]

export function memoriesAboutEntity(
  state: TavernState,
  entity: EntityRef,
  options?: EntityMemoryQueryOptions,
): MemoryState[]

export function grudgesAgainst(
  state: TavernState,
  target: EntityRef,
): MemoryState[]

export function gratitudeToward(
  state: TavernState,
  target: EntityRef,
): MemoryState[]

export function strongestMemoryFor(
  state: TavernState,
  owner: EntityRef,
  tags: string[],
): MemoryState | undefined
```

Suggested options:

```ts
export type EntityMemoryQueryOptions = {
  tags?: string[]
  minStrength?: number
  types?: MemoryType[]
  includeExpired?: boolean
  limit?: number
}
```

### Matching Rules

A memory should count as being **for an owner** if:

1. `metadata.owner` matches the entity, or
2. `actors` includes the entity and no owner is specified, or
3. `locations` includes the entity for area-owned memories.

A memory should count as being **about an entity** if the entity appears in:

- `metadata.subjects`
- `metadata.targets`
- `metadata.beneficiaries`
- `metadata.blamed`
- `metadata.credited`
- `actors`
- `locations`

---

## 36.3 Add Memory Definitions For Expanded Entities

Extend:

```txt
src/sim/modules/memories/memoryRegistry.ts
```

Add definitions for the new kinds of memories.

### Staff Memories

```ts
{
  id: 'staff_publicly_blamed',
  type: 'grudge',
  label: 'Staff member was publicly blamed',
  defaultDurationDays: 42,
  defaultStrength: 45,
  defaultDecayRate: 1,
  tags: ['staff', 'blame', 'morale', 'identity'],
  relatedSystems: ['staff', 'attribution'],
  stacking: 'increase_strength',
}
```

Other staff memory definitions:

```txt
staff_comforted_after_bad_shift
staff_given_bonus
staff_overworked_recently
staff_saved_from_angry_customer
staff_mistake_forgiven
staff_mistake_punished
staff_hidden_talent_noticed
```

### Regular Customer Memories

```txt
regular_refused_tab
regular_given_free_meal
regular_embarrassed_publicly
regular_injured_in_brawl
regular_helped_by_owner
regular_favorite_order_remembered
regular_complaint_ignored
```

### Supplier Memories

```txt
supplier_paid_late
supplier_blamed_for_bad_stock
supplier_given_fair_deal
supplier_cheated_by_owner
supplier_helped_during_shortage
supplier_exclusive_offer_refused
```

### Faction Memories

```txt
faction_discount_honoured
faction_discount_revoked
faction_member_banned
faction_event_hosted
faction_publicly_insulted
faction_helped_during_crisis
```

### Area Memories

```txt
area_known_for_brawls
area_known_for_music
area_known_for_bad_smell
area_recently_upgraded
area_neglected_too_long
```

### Arc Memories

```txt
arc_warning_ignored
arc_preparation_successful
arc_preparation_failed
arc_supplier_side_taken
arc_rival_advantage_allowed
```

---

## 36.4 Add Entity Memory Creation Helpers To Context

The current `SimContext` already exposes `ctx.addMemory` according to the Phase 31 baseline.

Add a thin helper without removing `ctx.addMemory`:

```ts
ctx.addEntityMemory(owner, draft, metadata)
```

Implementation location:

```txt
src/sim/core/context.ts
```

or, if keeping context small:

```txt
src/sim/modules/memories/entityMemory.ts
```

### Suggested Context Helper Shape

```ts
addEntityMemory(
  owner: EntityRef,
  draft: MemoryDraft,
  metadata?: Omit<EntityMemoryMetadata, 'owner'>,
): void
```

This helper should:

1. Attach `owner` into `draft.metadata.owner`.
2. Preserve existing metadata.
3. Add owner to `actors` if appropriate and not already present.
4. Call existing `ctx.addMemory`.

### Example

```ts
ctx.addEntityMemory(
  { kind: 'supplier', id: 'supplier_moldcap_cart' },
  {
    id: 'supplier_paid_late',
    tags: ['supplier', 'payment', 'relationship'],
  },
  {
    targets: [{ kind: 'other', id: ctx.state.meta.tavernId }],
    sourceCauseIds: ['cause_late_payment_001'],
  },
)
```

---

## 36.5 Add Memory Effects To Expanded Systems

Update the systems introduced in Phases 31 to 35 so their major events create entity memories.

### Staff Identity and Service Scenes

When a `ServiceScene` involves staff:

- severe failure should create a staff memory
- owner support should create a staff memory
- public blame should create a staff grudge
- successful rescue should create gratitude or confidence memory

Likely files:

```txt
src/sim/modules/service/serviceModule.ts
src/sim/modules/service/sceneBuilder.ts
src/sim/modules/staff/staffModule.ts
```

### Owner Projects and Policies

When projects finish:

- area memory: `area_recently_upgraded`
- staff memory if staff helped
- faction/customer memory if the project was for them

Likely files:

```txt
src/sim/modules/ownerActions/ownerActionsModule.ts
src/sim/modules/ownerActions/projectProgress.ts
```

### Weekly Community

Weekly routines should convert repeated signals into memories:

- regulars keep complaining about same area
- supplier late deliveries repeat
- faction satisfaction drops for multiple weeks
- staff morale stays low

Likely files:

```txt
src/sim/modules/weekly/weeklyModule.ts
src/sim/modules/weekly/communityTrends.ts
```

### Seasonal Arcs

Arc milestones should write arc memories:

- warning ignored
- preparation succeeded
- rival gained advantage
- festival handled well

Likely files:

```txt
src/sim/modules/monthly/monthlyModule.ts
src/sim/content/events/localArcRegistry.ts
```

---

## 36.6 Add Pattern Detection For Entity Memories

Extend:

```txt
src/sim/modules/memories/patternDetection.ts
```

Current Phase 16 pattern detection likely checks broad repeated events. Add entity-focused patterns.

### Pattern: Repeated Staff Blame

If the same staff member receives two or more blame memories within 14 days:

```txt
staff_feels_scapegoated
```

Effects later:

- raises staff burnout pressure
- lowers loyalty
- creates staff-related issue seeds

### Pattern: Regular Feels Ignored

If a regular has two ignored complaint memories:

```txt
regular_feels_ignored
```

Effects later:

- lowers regular loyalty
- raises reputation drift
- creates regular grudge seed

### Pattern: Supplier Distrust

If a supplier has late payment, public blame, and poor relationship memories:

```txt
supplier_distrust_pattern
```

Effects later:

- raises supplier distrust pressure
- increases delivery unreliability
- creates supplier issue seeds

### Pattern: Area Reputation Forms

If an area has repeated problem memories:

```txt
area_bad_reputation
```

Effects later:

- raises customer complaints
- affects seating/service scenes
- creates area atmosphere seeds

---

## 36.7 Update Memory Reports

Extend:

```txt
src/sim/modules/memories/memoryReport.ts
```

The memory report should now have optional sections:

```txt
Important Staff Memories
Important Regular Memories
Supplier Grudges and Gratitude
Faction Memory
Area Reputation Memory
Arc Memory
```

Do not dump everything.

Report only:

- high-strength memories
- newly created memories
- memories that affected pressures or issue seeds
- memories tied to named entities

### Example Report Fragments

```txt
Nib Cracket still remembers being blamed for the spoiled stew.
Brakka's Mushroom Cart remembers the late payment from last week.
The common room is starting to be known as a brawl corner.
```

These are report lines, not card prose. Keep them short and mechanically traceable.

---

## 36.8 Add Phase 36 Tests

Create:

```txt
tests/sim/phase36.entityMemory.test.ts
```

Test cases:

1. `addEntityMemory` stores owner metadata and preserves existing fields.
2. `memoriesForOwner` returns memories owned by a staff member.
3. `memoriesAboutEntity` finds memories where an entity is blamed or credited.
4. Expired/weak memories can be filtered out.
5. Pattern detection creates `staff_feels_scapegoated` when the same staff member is repeatedly blamed.
6. Supplier distrust pattern emerges from repeated supplier memories.
7. Memory reports include important named-entity memories but do not list every low-strength memory.
8. Full simulation remains deterministic with entity memory creation.

### Acceptance Criteria

- Existing `MemoryState` is reused rather than forked.
- Entity-specific memory helpers exist.
- Staff, regular, supplier, faction, area, and arc memories can be represented.
- Major expanded-system events write memories.
- Pattern detection can produce entity-scoped pattern memories.
- Reports expose important entity memories.
- All Phase 1 to 36 tests pass.

---

# Phase 37 - Credit, Blame, Rumours, and Social Attribution

## Mirrors Phase 17: Cause Tracking and State Diffs

## Goal

Add a social attribution layer that allows staff, regulars, suppliers, factions, and customer groups to assign blame, credit, suspicion, or gratitude for events.

The existing cause system tracks what actually changed and why. Phase 37 tracks what people **think** happened.

This is important because later cards should be able to distinguish:

```txt
Actual cause: the supplier delivered bad mushrooms.
Perceived cause: customers think the cook is careless.
Perceived cause: the supplier thinks the owner is publicly scapegoating them.
```

That difference is card fuel. It turns a flat state change into social weather.

---

## 37.1 Add Attribution Module

Create:

```txt
src/sim/modules/attribution/
  attributionModule.ts
  attributionTypes.ts
  attributionQueries.ts
  attributionReport.ts
  attributionRules.ts
  index.ts
```

Register it in:

```txt
src/sim/registries/moduleRegistry.ts
```

The module should update during one of the expanded hooks from Phase 27, preferably after causes, service scenes, weekly routines, and memories have been created.

Recommended hook:

```txt
afterService
endWeek
generateReports
```

Avoid updating attribution after validation unless the repo already supports post-validation module mutation. Validation should see the final state, not yesterday's social fog.

---

## 37.2 Attribution Types

In:

```txt
src/sim/modules/attribution/attributionTypes.ts
```

Add:

```ts
import type { CalendarStamp, EntityRef } from '../../state/TavernState'

export type AttributionType =
  | 'credit'
  | 'blame'
  | 'suspicion'
  | 'gratitude'
  | 'resentment'
  | 'trust'
  | 'distrust'

export type AttributionAccuracy =
  | 'true'
  | 'partial'
  | 'false'
  | 'unknown'

export type AttributionState = {
  id: string
  timestamp: CalendarStamp
  sourceEventId?: string
  sourceCauseIds: string[]
  sourceMemoryIds: string[]
  sourceSceneIds: string[]

  perceivedBy: EntityRef
  target: EntityRef
  attributionType: AttributionType
  accuracy: AttributionAccuracy

  strength: number
  confidence: number
  publicness: number
  volatility: number

  readable: string
  tags: string[]
  relatedSystems: string[]

  ageDays: number
  expiresAfterDays?: number
}

export type AttributionModuleState = {
  attributions: AttributionState[]
  generatedToday: string[]
  lastUpdatedDay: number
}
```

### Field Meaning

| Field | Meaning |
|---|---|
| `perceivedBy` | Who holds the belief. |
| `target` | Who or what receives credit/blame/etc. |
| `accuracy` | Whether the belief matches the cause layer. |
| `strength` | How emotionally/mechanically important it is. |
| `confidence` | How certain the perceiver feels. |
| `publicness` | How likely it is to spread. |
| `volatility` | How likely it is to flip, escalate, or decay irregularly. |

---

## 37.3 Attribution State Storage

Recommended storage:

```ts
state.modules.attribution = {
  attributions: [],
  generatedToday: [],
  lastUpdatedDay: -1,
}
```

Do not add `attributions` to the root `TavernState` unless there is a strong reason. The current repo already uses module slices for rich pressure snapshots and issue seed state. Follow that precedent.

Add a Zod schema for the module state in `attributionModule.ts` or a nearby file.

### Schema Notes

Reuse `CalendarStampSchema` and `EntityRefSchema` from:

```txt
src/sim/state/schemas.ts
```

If those schemas are not exported, export them rather than duplicating their definitions.

---

## 37.4 Add Attribution Rules

Create:

```txt
src/sim/modules/attribution/attributionRules.ts
```

Rules should read from:

- recent causes
- service scenes
- entity memories
- owner actions
- policies
- supplier events
- faction/regular/customer group state
- local arcs
- social rumours

### Rule Shape

```ts
export type AttributionRule = {
  id: string
  tags: string[]
  evaluate(ctx: SimContext): AttributionState[]
}
```

### Initial Rules

#### `bad_stock_blame_supplier`

If a food safety or stock spoilage cause references supplier goods:

- customers may blame the tavern
- owner responses may blame supplier
- supplier may resent being blamed if public

#### `staff_service_failure_blame`

If a service scene references a staff mistake:

- customers may blame staff
- owner may blame staff if a social action says so
- staff may blame bad working conditions if area/stress causes are stronger

#### `project_success_credit_owner`

If a project completes:

- factions/customer groups affected by the project may credit owner/tavern
- staff involved may feel proud or credited

#### `policy_backlash_attribution`

If a policy hurts a group:

- group blames owner/tavern
- regulars may defend or criticize depending on loyalty

#### `rival_tavern_suspicion`

If a rival arc is active and reputation drops:

- locals may suspect rival interference
- accuracy may be `unknown` or `false`

#### `rumour_distorts_cause`

If a social rumour exists with high spread:

- create a false or partial attribution matching the rumour

---

## 37.5 Add Attribution Deduplication and Aging

The attribution module must not create infinite duplicate beliefs every day.

Implement:

```ts
function attributionKey(a: AttributionState): string
```

Recommended key parts:

```txt
perceivedBy.kind
perceivedBy.id
target.kind
target.id
attributionType
sourceCauseIds or sourceEventId
tags sorted
```

If an attribution with the same key already exists:

- increase strength slightly
- refresh age to 0 only if the source is recent
- merge tags
- do not append a duplicate

Aging rules:

- `ageDays += 1` during the attribution module's aging pass
- remove if `expiresAfterDays` is exceeded
- reduce strength for low-confidence attributions
- high-publicness false attributions should decay slowly unless corrected

---

## 37.6 Attribution Creates Memories, Causes, and Rumours

Attribution should not sit in a jar doing nothing.

### Memory Creation

Strong attributions should create entity memories:

```txt
supplier_blamed_for_bad_stock
staff_publicly_blamed
regular_grateful_to_owner
faction_credits_tavern
customer_group_suspects_cheating
```

Use Phase 36 `addEntityMemory` where possible.

### Cause Creation

Strong attributions can create causes:

```ts
ctx.addCause({
  source: 'attribution:supplier_blamed_for_bad_stock',
  sourceType: 'memory',
  target: 'world.suppliers.supplier_moldcap.relationship',
  targetType: 'global',
  amount: -8,
  direction: 'decrease',
  readable: 'Supplier relationship worsened because blame landed on them',
  tags: ['supplier', 'blame', 'relationship'],
})
```

If Phase 26 expanded `CauseTargetType`, use more specific target types such as `'supplier'`, `'faction'`, or `'regular'`. If not, use `'global'` and clear tags.

### Rumour Creation

High-publicness attributions should optionally create or strengthen `state.world.socialRumours`.

Example:

```ts
{
  id: 'rumour_owner_waters_ale',
  subject: { kind: 'system', id: 'tavern' },
  belief: 'owner_waters_ale',
  accuracy: 'partial',
  spread: 44,
  heat: 31,
  sourceAttributionIds: ['attr_001'],
}
```

If earlier phases already defined a rumour state shape, use that shape instead of inventing a second one.

---

## 37.7 Attribution Queries

Create:

```txt
src/sim/modules/attribution/attributionQueries.ts
```

Add:

```ts
export function attributionsByTarget(
  state: TavernState,
  target: EntityRef,
): AttributionState[]

export function attributionsHeldBy(
  state: TavernState,
  perceiver: EntityRef,
): AttributionState[]

export function blameAgainst(
  state: TavernState,
  target: EntityRef,
): AttributionState[]

export function creditToward(
  state: TavernState,
  target: EntityRef,
): AttributionState[]

export function strongestPublicAttributions(
  state: TavernState,
  limit?: number,
): AttributionState[]
```

These will be used by:

- pressure calculators
- issue seed generators
- readiness reports
- memory reports
- future card text ingredients

---

## 37.8 Attribution Reports

Create:

```txt
src/sim/modules/attribution/attributionReport.ts
```

Report only the most relevant beliefs.

Good report lines:

```txt
The Moldcap Cart blames the tavern for publicly shifting blame onto their mushrooms.
Two miner regulars credit the owner for finishing the private booth project.
A false rumour is spreading that the cook spoiled the stew on purpose.
```

Bad report lines:

```txt
Attribution attr_001 type blame strength 42 target staff_001.
```

Still keep the underlying data structured and debug-friendly.

---

## 37.9 Add Phase 37 Tests

Create:

```txt
tests/sim/phase37.attribution.test.ts
```

Test cases:

1. Attribution module initializes its module state.
2. A service failure can create staff blame attribution.
3. A completed project can create owner/tavern credit attribution.
4. False attribution can be stored with `accuracy: 'false'`.
5. Duplicate attributions merge instead of duplicating daily.
6. Attribution ages and expires.
7. Strong public blame creates an entity memory.
8. Public attribution can strengthen a social rumour.
9. Attribution queries return expected target/perceiver subsets.
10. Full simulation is deterministic with attribution enabled.

### Acceptance Criteria

- Attribution state exists under `state.modules.attribution`.
- Attribution records distinguish objective causes from perceived blame/credit.
- Attributions can create memories, causes, and rumours.
- Queries support target and perceiver lookups.
- Reports summarize the most important beliefs.
- All Phase 1 to 37 tests pass.

---

# Phase 38 - Expanded Pressure Webs

## Mirrors Phase 18: Pressure and Feedback Loop System

## Goal

Expand the pressure system so social, supplier, faction, cultural, policy, rumour, staff-identity, and arc pressures can interact with the existing Phase 18 pressures.

The current pressure system already has:

```txt
src/sim/modules/pressures/
  pressureModule.ts
  pressureQueries.ts
  pressureRegistry.ts
  pressureReport.ts
  pressureTypes.ts
```

Current canonical pressure ids are:

```ts
export const PRESSURE_IDS = [
  'food_safety',
  'inspection',
  'staff_burnout',
  'pests',
  'debt',
  'maintenance',
  'violence',
  'reputation_drift',
  'stock_shortage',
  'landlord',
] as const
```

Phase 38 should preserve these ids and add expanded ids, calculators, and report summaries.

---

## 38.1 Add Expanded Pressure IDs

In:

```txt
src/sim/modules/pressures/pressureTypes.ts
```

Extend the pressure id list or add a second exported list:

```ts
export const EXPANDED_PRESSURE_IDS = [
  'supplier_distrust',
  'regular_customer_loss',
  'staff_loyalty_risk',
  'faction_anger',
  'cultural_tension',
  'rival_tavern_pressure',
  'festival_readiness',
  'market_instability',
  'rumour_pressure',
  'policy_backlash',
  'arc_escalation',
] as const
```

Recommended type:

```ts
export type ExpandedPressureId = (typeof EXPANDED_PRESSURE_IDS)[number]
export type AnyPressureId = PressureId | ExpandedPressureId | string
```

### Compatibility Rule

Do not break existing tests that expect the original ten pressure ids. Existing tests may assume those ids exist and move.

Add expanded pressure support without removing or renaming the original list.

---

## 38.2 Register Expanded Pressure Calculators

Extend:

```txt
src/sim/modules/pressures/pressureRegistry.ts
```

Add calculators for each expanded pressure.

Each calculator should return the existing `PressureCalculationResult` shape:

```ts
export type PressureCalculationResult = {
  value: number
  severity: number
  urgency: number
  volatility?: number
  causes: PressureCauseRef[]
  relatedActors?: EntityRef[]
  relatedLocations?: EntityRef[]
  relatedSystems?: string[]
  tags?: string[]
  consequences?: string[]
}
```

---

## 38.3 Supplier Distrust Pressure

### Pressure ID

```txt
supplier_distrust
```

### Inputs

- supplier relationship state from `state.world.suppliers`
- supplier memories from Phase 36
- supplier blame attributions from Phase 37
- late payment causes
- supplier reliability
- active market shortages

### Calculation Sketch

```txt
base = average inverse supplier relationship
+ public supplier blame attribution
+ late payment memory strength
+ repeated delivery dispute memories
+ market shortage pressure
- fair deal / paid on time memories
```

### Consequences

```txt
late deliveries more likely
price hikes more likely
exclusive offers less likely
supplier-related issue seeds more likely
```

---

## 38.4 Regular Customer Loss Pressure

### Pressure ID

```txt
regular_customer_loss
```

### Inputs

- regular loyalty
- regular irritation
- ignored complaint memories
- area bad reputation memories
- customer group satisfaction
- recent service scenes involving regulars

### Calculation Sketch

```txt
base = average regular irritation
+ low loyalty regular count
+ ignored complaint memory strength
+ recent public embarrassment attributions
- gratitude / favourite order remembered memories
```

### Consequences

```txt
regulars stop visiting
reputation drift rises
customer complaint seeds become more likely
loyalty reward seeds become less likely
```

---

## 38.5 Staff Loyalty Risk Pressure

### Pressure ID

```txt
staff_loyalty_risk
```

### Inputs

- staff loyalty
- staff morale
- staff stress/fatigue
- staff scapegoat memories
- public blame attributions
- unpaid wages
- owner comfort/social actions

### Calculation Sketch

```txt
base = inverse average staff loyalty
+ high burnout pressure contribution
+ public blame memories
+ unpaid wages
- comforted / bonus / protected memories
```

### Consequences

```txt
staff request seeds
staff quitting warnings
service quality drops
staff conflict scenes
```

---

## 38.6 Faction Anger Pressure

### Pressure ID

```txt
faction_anger
```

### Inputs

- faction relationship values
- faction memories
- policy backlash attributions
- faction event failures
- customer group conflict
- local arcs involving factions

### Calculation Sketch

```txt
base = average inverse faction relationship
+ high-strength faction grudge memories
+ policy backlash publicness
+ active faction-tension arc
- hosted faction event / honoured discount memories
```

### Consequences

```txt
faction demands
boycotts
brawls
special requests
inspection tips from angry factions
```

---

## 38.7 Cultural Tension Pressure

### Pressure ID

```txt
cultural_tension
```

### Inputs

- customer group relationships
- cultural calendar tags
- disliked area traits
- seating conflict scenes
- cultural misunderstanding memories
- faction anger

### Calculation Sketch

```txt
base = average active intergroup tension
+ conflicting customer groups present
+ cultural observance ignored
+ seating/food taboo memories
- policies or projects that reduce friction
```

### Consequences

```txt
cultural misunderstanding seeds
seating preference conflicts
festival request seeds
faction anger increases
violence risk may rise
```

---

## 38.8 Rival Tavern Pressure

### Pressure ID

```txt
rival_tavern_pressure
```

### Inputs

- active `rival_tavern_expansion` arc
- reputation drift
- regular customer loss
- market instability
- rumours crediting rival or blaming tavern
- local event state

### Calculation Sketch

```txt
base = active rival arc intensity
+ reputation drift pressure
+ regular customer loss pressure
+ public rumour pressure
- successful projects / high tavern identity
```

### Consequences

```txt
rival offer seeds
regular defection seeds
price pressure
opportunity to rebrand or host event
```

---

## 38.9 Festival Readiness Pressure

### Pressure ID

```txt
festival_readiness
```

This pressure is slightly inverted: high value means **risk of being unready**.

### Inputs

- active festival arc
- stock levels
- staff fatigue
- area condition
- project completion
- supplier reliability
- calendar distance to festival

### Calculation Sketch

```txt
base = festival arc intensity
+ low stock
+ staff fatigue
+ dirty/damaged areas
+ supplier distrust
- completed preparation projects
- strong supplier relationships
```

### Consequences

```txt
festival preparation issue seeds
big opportunity seeds
festival failure memories
festival success memories
```

---

## 38.10 Market Instability Pressure

### Pressure ID

```txt
market_instability
```

### Inputs

- market conditions from Phase 29
- supplier reliability
- seasonal arcs
- stock shortage pressure
- price volatility

### Consequences

```txt
supplier price hike seeds
suspicious goods seeds
stock shortage seeds
customer price complaints
```

---

## 38.11 Rumour Pressure

### Pressure ID

```txt
rumour_pressure
```

### Inputs

- `state.world.socialRumours`
- high-publicness attributions
- reputation drift
- false blame memories
- faction anger

### Consequences

```txt
reputation shift seeds
false accusation seeds
apology/social action seeds
faction/customer misunderstandings
```

---

## 38.12 Policy Backlash Pressure

### Pressure ID

```txt
policy_backlash
```

### Inputs

- active owner policies
- customer group dislikes
- faction reactions
- regular irritation
- social attributions targeting owner/tavern

### Consequences

```txt
policy protest seeds
regular complaint seeds
faction objection seeds
chance for compromise response slots
```

---

## 38.13 Arc Escalation Pressure

### Pressure ID

```txt
arc_escalation
```

### Inputs

- active local arcs
- ignored arc warnings
- failed preparation memories
- related pressures
- monthly/weekly arc progression

### Consequences

```txt
arc-specific issue seeds
seasonal crisis escalation
local event consequences
rival/supplier/faction pressure jumps
```

---

## 38.14 Pressure Web Interactions

Add helper in:

```txt
src/sim/modules/pressures/pressureWebs.ts
```

This file should not replace individual calculators. It should provide shared helpers for interactions.

### Example Helpers

```ts
export function pressureValue(ctx: SimContext, id: string): number
export function pressureSnapshotValue(ctx: SimContext, id: string): number
export function relatedPressureContribution(
  ctx: SimContext,
  id: string,
  multiplier: number,
  readable: string,
  tags: string[],
): PressureCauseRef | null
```

### Example Webs

#### Supplier Spiral

```txt
supplier_distrust
→ stock_shortage
→ market_instability
→ customer_complaint seeds
→ reputation_drift
```

#### Social Backlash Spiral

```txt
policy_backlash
→ faction_anger
→ cultural_tension
→ violence
→ reputation_drift
```

#### Staff Collapse Spiral

```txt
staff_loyalty_risk
→ staff_burnout
→ service failures
→ regular_customer_loss
→ debt
```

---

## 38.15 Feedback Loop Registry Expansion

Extend:

```txt
src/sim/modules/feedback/feedbackLoopRegistry.ts
```

Add loops for:

```txt
supplier_distrust_spiral
regular_loss_spiral
staff_scapegoat_loop
policy_backlash_loop
rival_pressure_loop
festival_unreadiness_loop
rumour_blame_loop
```

Each loop should reference existing and expanded pressures.

### Example

```ts
{
  id: 'supplier_distrust_spiral',
  label: 'Supplier distrust spiral',
  pressureIds: ['supplier_distrust', 'stock_shortage', 'market_instability'],
  tags: ['supplier', 'market', 'stock'],
}
```

Use the actual feedback loop type from `feedbackLoopTypes.ts`.

---

## 38.16 Update Pressure Reports

Extend:

```txt
src/sim/modules/pressures/pressureReport.ts
```

Add a distinction between:

```txt
Core Pressures
Social Pressures
Market Pressures
Arc Pressures
```

Do not list every pressure every day. Reports should prioritize:

- high severity
- sharply rising trend
- pressures with named entity causes
- pressures connected to active issue seeds
- pressures tied to local arcs

### Example Report Lines

```txt
Supplier distrust is rising because the Moldcap Cart remembers late payment and public blame.
Regular customer loss is rising around Brik Tallowmug after two ignored complaints.
Festival readiness is poor because stock is low and the common room project is unfinished.
```

---

## 38.17 Add Phase 38 Tests

Create:

```txt
tests/sim/phase38.expandedPressures.test.ts
```

Test cases:

1. Expanded pressure ids register without removing original pressure ids.
2. Supplier distrust rises from supplier blame/late payment memories.
3. Staff loyalty risk rises from public blame and low loyalty.
4. Regular customer loss rises from ignored regular complaints.
5. Faction anger rises from policy backlash.
6. Festival readiness pressure responds to active festival arc and preparation state.
7. Pressure reports include high-severity expanded pressure with named cause.
8. Feedback loops detect at least one expanded pressure loop.
9. Full simulation remains deterministic with expanded pressures enabled.

### Acceptance Criteria

- Original pressure ids still exist.
- Expanded pressure ids are calculated and stored in `state.pressures` and rich snapshots.
- Expanded pressures use memories, attributions, suppliers, regulars, factions, policies, and arcs.
- Feedback loops include expanded pressure webs.
- Reports prioritize meaningful pressure explanations.
- All Phase 1 to 38 tests pass.

---

# Phase 39 - Expanded Issue Seed and Text Ingredient Families

## Mirrors Phase 19: Issue Seed and Response Intent System

## Goal

Expand the issue seed system so it can produce rich card fuel from the expanded world systems without creating finished cards.

The current issue seed system already has:

```txt
src/sim/modules/issues/
  contradictionGuards.ts
  generatorHelpers.ts
  impactScoring.ts
  issueSeedGenerators.ts
  issueSeedModule.ts
  issueSeedQueries.ts
  issueSeedRanking.ts
  issueSeedRegistry.ts
  issueSeedReport.ts
  issueSeedTypes.ts
  issueSeedValidation.ts
```

Phase 39 should add new families, new text ingredient capacity, new contradiction guards, and new response slots that target named world entities.

---

## 39.1 Expand Issue Seed Family IDs

In:

```txt
src/sim/modules/issues/issueSeedTypes.ts
```

Extend `IssueSeedFamilyId` with expanded families:

```ts
export type IssueSeedFamilyId =
  | 'food_safety'
  | 'stock_shortage'
  | 'maintenance'
  | 'staff_burnout'
  | 'customer_complaint'
  | 'violence'
  | 'debt_rent'
  | 'inspection'
  | 'reputation_shift'
  | 'monthly_review'
  | 'staff_identity'
  | 'regular_customer'
  | 'supplier_relationship'
  | 'faction_request'
  | 'culture_conflict'
  | 'area_atmosphere'
  | 'seasonal_arc'
  | 'policy_backlash'
  | 'rumour_crisis'
  | 'rival_tavern'
```

### Compatibility Rule

Do not remove the original ten families. Existing coverage reports and tests may depend on them.

Update `REQUIRED_FAMILIES` in:

```txt
src/sim/testing/seedCoverageReport.ts
```

Recommended approach:

```ts
export const CORE_REQUIRED_FAMILIES = [...originalTen] as const
export const EXPANDED_REQUIRED_FAMILIES = [...newExpandedFamilies] as const
export const REQUIRED_FAMILIES = [
  ...CORE_REQUIRED_FAMILIES,
  ...EXPANDED_REQUIRED_FAMILIES,
] as const
```

If this makes older readiness thresholds too strict, Phase 40 will add an expanded readiness gate separate from the Phase 20 gate.

---

## 39.2 Expand Issue Seed Types

Current `IssueSeedType` includes:

```ts
export type IssueSeedType =
  | 'crisis'
  | 'complaint'
  | 'opportunity'
  | 'warning'
  | 'staff_request'
  | 'supplier_offer'
  | 'maintenance_problem'
  | 'customer_incident'
  | 'reputation_shift'
  | 'debt_pressure'
  | 'inspection_threat'
  | 'monthly_review'
```

Add types if useful:

```ts
  | 'relationship_test'
  | 'social_conflict'
  | 'policy_reaction'
  | 'festival_preparation'
  | 'rumour'
  | 'arc_milestone'
```

Keep this list small. Seed family handles subject matter; seed type handles presentation purpose.

---

## 39.3 Expand Text Ingredients Without Writing Cards

Current `TextIngredients` is intentionally compact:

```ts
export type TextIngredients = {
  subject: string
  problemNoun?: string
  sensoryDetails: string[]
  actorOpinions: Record<string, string>
  recentContext: string[]
  stakesReadable: string[]
}
```

Expand it carefully:

```ts
export type TextIngredients = {
  subject: string
  problemNoun?: string
  sensoryDetails: string[]
  actorOpinions: Record<string, string>
  recentContext: string[]
  stakesReadable: string[]

  namedEntities?: Array<{
    role: string
    ref: EntityRef
    displayName: string
  }>

  socialContext?: string[]
  relevantMemories?: string[]
  perceivedBlame?: string[]
  pressureContext?: string[]
  calendarContext?: string[]
  marketContext?: string[]
  arcContext?: string[]
}
```

Update `TEXT_INGREDIENT_LIMITS`:

```ts
namedEntities: { maxEntries: 4, maxWordsPerEntry: 5 },
socialContext: { maxEntries: 3, maxWordsPerEntry: 10 },
relevantMemories: { maxEntries: 3, maxWordsPerEntry: 10 },
perceivedBlame: { maxEntries: 2, maxWordsPerEntry: 12 },
pressureContext: { maxEntries: 3, maxWordsPerEntry: 10 },
calendarContext: { maxEntries: 2, maxWordsPerEntry: 8 },
marketContext: { maxEntries: 2, maxWordsPerEntry: 8 },
arcContext: { maxEntries: 2, maxWordsPerEntry: 10 },
```

### Important Rule

Text ingredients are fragments, not prose.

Good:

```txt
Brik Tallowmug
ignored tab complaint
Moldcap Cart feels blamed
festival in three days
```

Bad:

```txt
Brik Tallowmug stomps into the tavern, his fists clenched, and demands justice...
```

That second one is card writing. Not yet.

---

## 39.4 Update Generator Helpers

Extend:

```txt
src/sim/modules/issues/generatorHelpers.ts
```

Add helpers for expanded entities:

```ts
export function supplierRef(id: string): EntityRef
export function factionRef(id: string): EntityRef
export function regularRef(id: string): EntityRef
export function cultureRef(id: string): EntityRef
export function localArcRef(id: string): EntityRef
export function serviceSceneRef(id: string): EntityRef
export function projectRef(id: string): EntityRef
```

Add display helpers:

```ts
export function displayNameForRef(
  state: TavernState,
  ref: EntityRef,
): string

export function namedEntityIngredient(
  state: TavernState,
  role: string,
  ref: EntityRef,
): TextIngredients['namedEntities'][number]
```

Add query helpers:

```ts
export function strongestMemoryText(
  state: TavernState,
  entity: EntityRef,
  tags?: string[],
): string | undefined

export function strongestAttributionText(
  state: TavernState,
  target: EntityRef,
  types?: AttributionType[],
): string | undefined
```

If importing attribution types causes circular dependencies, keep the type import local or use string unions in helper arguments.

---

## 39.5 Staff Identity Seed Family

### Family ID

```txt
staff_identity
```

### Triggers

- `staff_loyalty_risk` pressure high
- staff member has scapegoat memory
- staff stress high but loyalty still high
- staff hidden talent memory exists
- staff personality conflicts with active policy
- staff was publicly blamed or credited

### Example Seed Templates

```txt
staff_loyalty_test
staff_public_blame_reaction
staff_hidden_talent_request
staff_conflict_with_policy
staff_burnout_identity_moment
```

### Required Seed Structure

- `primaryActor`: staff ref
- `affectedActors`: staff + possibly customer group/faction
- `causes`: recent staff-related causes
- `pressures`: staff loyalty risk, staff burnout
- `textIngredients.namedEntities`: staff name
- `textIngredients.relevantMemories`: staff memory label
- response slots should include at least two of:
  - comfort
  - blame
  - pay
  - promote
  - delegate
  - ignore

### Example Response Slots

```txt
comfort_staff
publicly_back_staff
blame_staff
pay_bonus
change_priority
ignore_request
```

---

## 39.6 Regular Customer Seed Family

### Family ID

```txt
regular_customer
```

### Triggers

- `regular_customer_loss` pressure high
- named regular has high irritation
- regular has ignored complaint memory
- regular has gratitude and offers opportunity
- regular is attached to a faction/customer group
- regular appears in a service scene

### Example Seed Templates

```txt
regular_grudge_returns
regular_favour_request
regular_loyalty_reward
regular_complaint_escalates
regular_public_argument
```

### Response Slots

```txt
apologize_to_regular
comp_regular_meal
refuse_request
ask_regular_to_spread_word
ban_regular
ignore_regular
```

### Notes

This family should help the tavern feel inhabited by returning people, not a conveyor belt of nameless complaint goblins.

---

## 39.7 Supplier Relationship Seed Family

### Family ID

```txt
supplier_relationship
```

### Triggers

- `supplier_distrust` pressure high
- supplier has late delivery pattern
- supplier has public blame attribution
- market instability high
- active shortage arc affects supplier goods
- supplier relationship is very high and creates an opportunity

### Example Seed Templates

```txt
supplier_price_hike
supplier_late_delivery_excuse
supplier_suspicious_goods_offer
supplier_demands_apology
supplier_exclusive_deal
supplier_credit_limit_warning
```

### Response Slots

```txt
pay_supplier
negotiate_supplier
blame_supplier
switch_supplier
accept_suspicious_goods
refuse_supplier_offer
```

### Required Ingredients

- supplier name
- goods involved
- market condition
- relevant supplier memory or attribution
- stock/pressure stakes

---

## 39.8 Faction Request Seed Family

### Family ID

```txt
faction_request
```

### Triggers

- `faction_anger` high
- faction relationship very high or very low
- faction event hosted or failed
- faction tied to local arc
- faction affected by owner policy

### Example Seed Templates

```txt
faction_demands_discount
faction_requests_private_event
faction_objects_to_policy
faction_conflict_spills_into_tavern
faction_offers_protection
```

### Response Slots

```txt
appease_faction
negotiate_terms
refuse_faction
host_faction_night
call_watch
play_rival_faction
```

---

## 39.9 Culture Conflict Seed Family

### Family ID

```txt
culture_conflict
```

### Triggers

- `cultural_tension` high
- cultural calendar tag active
- seating conflict service scene
- food taboo conflict
- disliked area trait matters
- two customer groups with tension overlap

### Example Seed Templates

```txt
cultural_misunderstanding
festival_custom_request
food_taboo_conflict
seating_preference_conflict
insulted_custom
```

### Response Slots

```txt
mediate_groups
honour_custom
ignore_custom
change_seating_policy
offer_discount
ask_staff_to_intervene
```

### Important Rule

Do not create stereotypes as mechanics.

A culture should have preferences, calendar hooks, tolerances, and relationship context. It should not be a bucket of caricature traits.

---

## 39.10 Area Atmosphere Seed Family

### Family ID

```txt
area_atmosphere
```

### Triggers

- area trait causes service scene
- area bad reputation memory
- repeated area complaints
- unfinished project in area
- area upgrade creates opportunity

### Example Seed Templates

```txt
area_too_dirty_for_group
area_upgrade_requested
area_trait_causes_incident
area_reputation_forms
area_project_delayed
```

### Response Slots

```txt
repair_area
clean_area
start_project
close_area_temporarily
rebrand_area
ignore_area_problem
```

---

## 39.11 Seasonal Arc Seed Family

### Family ID

```txt
seasonal_arc
```

### Triggers

- active local arc reaches milestone
- `arc_escalation` high
- `festival_readiness` high
- active monthly/weekly event creates opportunity
- ignored arc warning memory exists

### Example Seed Templates

```txt
festival_preparation_problem
rival_tavern_move
market_shortage_offer
inspection_campaign_warning
road_danger_arrival
arc_final_warning
```

### Response Slots

```txt
prepare_for_arc
exploit_arc
delay_preparation
ask_supplier_help
ask_faction_help
ignore_warning
```

---

## 39.12 Policy Backlash Seed Family

### Family ID

```txt
policy_backlash
```

### Triggers

- `policy_backlash` pressure high
- active policy affects a customer group/faction/regular
- social attribution targets owner/tavern for policy
- regular complaint mentions policy

### Example Seed Templates

```txt
regular_objects_to_policy
faction_objects_to_policy
staff_confused_by_policy
policy_loophole_exploited
policy_unintended_consequence
```

### Response Slots

```txt
keep_policy
modify_policy
repeal_policy
make_exception
explain_policy
punish_violation
```

---

## 39.13 Rumour Crisis Seed Family

### Family ID

```txt
rumour_crisis
```

### Triggers

- `rumour_pressure` high
- false attribution publicness high
- reputation drift high
- faction or regular believes rumour

### Example Seed Templates

```txt
false_blame_spreads
regular_repeats_rumour
supplier_hears_rumour
faction_acts_on_rumour
rival_amplifies_rumour
```

### Response Slots

```txt
deny_rumour
confess_partial_truth
blame_someone_else
prove_truth
bribe_gossip
ignore_rumour
```

---

## 39.14 Rival Tavern Seed Family

### Family ID

```txt
rival_tavern
```

### Triggers

- `rival_tavern_pressure` high
- active rival arc
- regular customer loss tied to rival
- market/reputation pressure overlap

### Example Seed Templates

```txt
rival_undercuts_prices
rival_lures_regular
rival_hosts_event
rival_spreads_rumour
rival_supplier_deal
```

### Response Slots

```txt
compete_on_price
host_counter_event
improve_quality
spread_counter_rumour
negotiate_with_rival
ignore_rival
```

---

## 39.15 Update Contradiction Guards

Extend:

```txt
src/sim/modules/issues/contradictionGuards.ts
```

Add guards:

```txt
supplierExistsGuard
regularExistsGuard
factionExistsGuard
activeArcExistsGuard
policyStillActiveGuard
projectStillIncompleteGuard
rumourStillActiveGuard
staffStillEmployedGuard
areaTraitStillPresentGuard
```

Examples:

- Do not generate `supplier_demands_apology` if the supplier no longer exists.
- Do not generate `regular_grudge_returns` if the regular has no grudge memory.
- Do not generate `festival_preparation_problem` after the festival arc has ended.
- Do not generate `policy_backlash` after the policy has been repealed.
- Do not generate `area_project_delayed` if the project is complete.

---

## 39.16 Update Issue Seed Validation

Extend:

```txt
src/sim/modules/issues/issueSeedValidation.ts
```

New validation checks:

1. Every `namedEntities` ref resolves.
2. Every primary/affected actor resolves.
3. Every supplier/faction/regular/culture/local arc ref resolves.
4. Expanded text ingredient arrays obey budgets.
5. Seeds using attribution must include at least one attribution or memory source.
6. Seeds using expanded pressure families must include a matching pressure snapshot.
7. Response slots targeting named entities must include valid target refs.
8. Seasonal arc seeds must reference an active or recently ended arc.

Invalid seeds should be rejected and listed in `rejectedToday` with a readable reason.

---

## 39.17 Update Ranking and Cooldowns

Extend:

```txt
src/sim/modules/issues/issueSeedRanking.ts
```

Expanded seed ranking should consider:

- named entity involvement
- high-strength memory involvement
- public attribution involvement
- rising expanded pressure
- active local arc milestone
- novelty of family/template
- repetition of same actor/location/faction/supplier

### Suggested Bonus/Penalty

```txt
+10 named entity with strong memory
+8 active arc milestone
+6 public false attribution
+5 rising expanded pressure
-15 same template appeared recently
-10 same actor overused this week
-8 same supplier/faction overused this week
```

Keep ranking deterministic. No random tiebreaks unless using the `issue_seed_selection` RNG stream.

---

## 39.18 Update Issue Reports

Extend:

```txt
src/sim/modules/issues/issueSeedReport.ts
```

Report expanded seed variety:

```txt
Expanded issue seed families today:
- supplier_relationship: 1
- staff_identity: 1
- rumour_crisis: 1

Top named seed fuel:
- Nib Cracket: staff_public_blame_reaction
- Moldcap Cart: supplier_demands_apology
- Brik Tallowmug: regular_grudge_returns
```

Do not show full seed payloads by default.

---

## 39.19 Add Phase 39 Tests

Create:

```txt
tests/sim/phase39.expandedIssueSeeds.test.ts
```

Test cases:

1. Expanded family ids are registered without removing original families.
2. Staff identity seed can generate from staff loyalty risk/scapegoat memory.
3. Supplier relationship seed can generate from supplier distrust pressure.
4. Regular customer seed can generate from ignored regular complaint memory.
5. Cultural conflict seed can generate from cultural tension pressure.
6. Seasonal arc seed can generate from active arc milestone.
7. Rumour crisis seed can generate from false public attribution.
8. Expanded text ingredients validate budgets.
9. Contradiction guards reject missing supplier/regular/faction/arc seeds.
10. Ranking penalizes repeated named actor overuse.
11. Full simulation remains deterministic with expanded seeds enabled.

### Acceptance Criteria

- Expanded issue seed families exist and generate from real state.
- Expanded seeds include named entities, memories, attributions, pressures, and response slots.
- No finished card prose is written.
- Contradiction guards cover expanded entity refs.
- Validation rejects broken expanded seeds.
- Reports summarize expanded seed fuel.
- All Phase 1 to 39 tests pass.

---

# Phase 40 - Expanded Cardless Playtest and Content Readiness Gate

## Mirrors Phase 20: Cardless Playtest and Readiness Gate

## Goal

Add an expanded readiness gate that verifies the simulation is now ready for card writing with richer identity, memory, social, pressure, and seed variety.

The existing Phase 20 readiness system lives in:

```txt
src/sim/testing/readinessReport.ts
src/sim/testing/seedCoverageReport.ts
src/sim/testing/cardlessPlaytest.ts
src/sim/testing/contradictionAudit.ts
```

Phase 40 should not delete the Phase 20 gate. Add an expanded gate alongside it.

---

## 40.1 Add Expanded Readiness Report File

Create:

```txt
src/sim/testing/expandedReadinessReport.ts
```

It can import and reuse:

```ts
import { buildReadinessReport, evaluateCardReadinessGate } from './readinessReport'
import { runCardlessSim, runMonths } from './simRunner'
import { auditRunForContradictions } from './contradictionAudit'
import { buildRepetitionAudit, buildCardCapacityReport } from './seedCoverageReport'
```

Add new report types:

```ts
export type ExpandedReadinessSection = {
  id: string
  score: number
  threshold: number
  passed: boolean
  notes: string[]
}

export type ExpandedReadinessReport = {
  passed: boolean
  sections: ExpandedReadinessSection[]
  scores: Record<string, number>
  coreReadinessPassed: boolean
}
```

---

## 40.2 Expanded Readiness Sections

Add these sections:

```txt
identity_richness
entity_memory_quality
attribution_quality
expanded_pressure_quality
expanded_seed_coverage
text_ingredient_quality
named_entity_repetition
arc_and_calendar_use
social_consequence_quality
expanded_contradiction_safety
```

Recommended thresholds:

```ts
export const EXPANDED_READINESS_THRESHOLDS = {
  identity_richness: 70,
  entity_memory_quality: 70,
  attribution_quality: 65,
  expanded_pressure_quality: 70,
  expanded_seed_coverage: 65,
  text_ingredient_quality: 75,
  named_entity_repetition: 70,
  arc_and_calendar_use: 60,
  social_consequence_quality: 70,
  expanded_contradiction_safety: 90,
} as const
```

These are deliberately a little softer than core deterministic safety. Expanded social systems are richer and more variable; the gate should catch dead systems, not demand perfect theater goblins.

---

## 40.3 Identity Richness Report

Create helper:

```ts
export type IdentityRichnessReport = {
  namedStaff: number
  namedRegulars: number
  namedSuppliers: number
  namedFactions: number
  namingProfilesUsed: string[]
  duplicateDisplayNames: string[]
  entitiesWithMissingNames: string[]
  score: number
}
```

Suggested score:

```txt
+20 at least 3 named staff
+15 at least 3 named regulars after 2 months
+15 at least 2 named suppliers
+10 at least 2 factions
+20 at least 4 naming profiles used
+20 no missing names and no duplicate display names
```

Data sources:

- `state.staff`
- `state.world.regulars`
- `state.world.suppliers`
- `state.world.factions`
- generated name metadata from Phase 31

---

## 40.4 Entity Memory Quality Report

Create helper:

```ts
export type EntityMemoryQualityReport = {
  totalEntityMemories: number
  memoriesWithOwners: number
  memoriesWithRealTargets: number
  staffMemories: number
  regularMemories: number
  supplierMemories: number
  factionMemories: number
  areaMemories: number
  arcMemories: number
  strongMemories: number
  score: number
}
```

Suggested score:

```txt
owner coverage = memoriesWithOwners / totalEntityMemories
real target coverage = memoriesWithRealTargets / totalEntityMemories
category spread = count of nonzero category buckets
strong memory count = min(100, strongMemories * 10)
```

Pass condition should require:

- at least some entity memories exist after a multi-month run
- most have owners or meaningful refs
- at least three categories are represented

---

## 40.5 Attribution Quality Report

Create helper:

```ts
export type AttributionQualityReport = {
  totalAttributions: number
  blameCount: number
  creditCount: number
  falseOrPartialCount: number
  publicAttributions: number
  attributionsWithSources: number
  attributionsCreatingMemories: number
  score: number
}
```

Suggested score:

```txt
+20 at least one blame attribution
+20 at least one credit/gratitude attribution
+15 at least one partial/false/unknown attribution
+20 at least 70% have source cause/memory/scene ids
+15 at least one attribution created or strengthened a memory
+10 at least one public attribution exists
```

Attribution should not be required every day. It should appear when social events give it a reason.

---

## 40.6 Expanded Pressure Quality Report

Create helper:

```ts
export type ExpandedPressureQualityReport = {
  expandedPressuresMoved: string[]
  expandedPressuresHighSeverity: string[]
  pressuresWithNamedCauses: string[]
  pressureWebsActivated: string[]
  score: number
}
```

Suggested score:

```txt
movementScore = min(100, expandedPressuresMoved.length * 10)
namedCauseScore = min(100, pressuresWithNamedCauses.length * 15)
webScore = min(100, pressureWebsActivated.length * 25)
score = average(movementScore, namedCauseScore, webScore)
```

Minimum expectation over a 3-month run:

- at least five expanded pressures move
- at least two expanded pressure explanations mention named entities
- at least one expanded feedback loop activates

---

## 40.7 Expanded Seed Coverage Report

Extend or create in:

```txt
src/sim/testing/expandedSeedCoverageReport.ts
```

Report shape:

```ts
export type ExpandedSeedCoverageReport = {
  totalExpandedSeeds: number
  expandedFamiliesProduced: string[]
  missingExpandedFamilies: string[]
  seedsWithNamedEntities: number
  seedsWithMemories: number
  seedsWithAttributions: number
  seedsWithExpandedPressures: number
  seedsWithArcContext: number
  averageResponseSlots: number
  score: number
}
```

Suggested expanded families:

```ts
export const EXPANDED_SEED_FAMILIES = [
  'staff_identity',
  'regular_customer',
  'supplier_relationship',
  'faction_request',
  'culture_conflict',
  'area_atmosphere',
  'seasonal_arc',
  'policy_backlash',
  'rumour_crisis',
  'rival_tavern',
] as const
```

Scoring:

```txt
family coverage: produced / expanded families
named entity coverage: seedsWithNamedEntities / totalExpandedSeeds
memory coverage: seedsWithMemories / totalExpandedSeeds
pressure coverage: seedsWithExpandedPressures / totalExpandedSeeds
response richness: averageResponseSlots >= 3
```

---

## 40.8 Text Ingredient Quality Report

Create helper:

```ts
export type TextIngredientQualityReport = {
  totalSeedsChecked: number
  seedsWithSubject: number
  seedsWithNamedEntities: number
  seedsWithRecentContext: number
  seedsWithStakes: number
  seedsOverBudget: number
  seedsWithCardProseSmell: number
  score: number
}
```

### Card Prose Smell Detection

This should be a simple heuristic, not an AI writing detector.

Flag ingredients that are too long or too sentence-like:

- more than 16 words in one ingredient
- ends with multiple punctuation marks
- contains dialogue quotation marks
- contains too many clauses
- uses second person commands

The point is to keep text ingredients as small bricks, not finished walls.

---

## 40.9 Named Entity Repetition Audit

Create helper:

```ts
export type NamedEntityRepetitionAudit = {
  totalNamedEntityUses: number
  overusedEntities: Array<{ refKey: string; count: number }>
  overusedFamilies: Array<{ family: string; count: number }>
  duplicateNames: string[]
  sameActorConsecutiveSeeds: number
  score: number
}
```

This should supplement the existing `buildRepetitionAudit`.

Rules:

- same named staff should not dominate every staff seed
- same supplier should not be the only supplier problem forever
- same regular should not carry every complaint
- duplicate display names should be heavily penalized

---

## 40.10 Arc and Calendar Use Report

Create helper:

```ts
export type ArcAndCalendarUseReport = {
  activeArcsSeen: string[]
  arcSeedsProduced: number
  calendarTagsUsedBySeeds: string[]
  festivalReadinessMoved: boolean
  marketConditionsUsedBySeeds: string[]
  score: number
}
```

This ensures Phases 23 and 35 are actually feeding the later seed layer.

If no seasonal or local arc ever affects seeds, the expansion is technically present but narratively asleep in the pantry.

---

## 40.11 Social Consequence Quality Report

Create helper:

```ts
export type SocialConsequenceQualityReport = {
  responseProfilesChecked: number
  profilesCreatingMemories: number
  profilesCreatingAttributionHooks: number
  profilesAffectingNamedEntities: number
  profilesAffectingExpandedPressures: number
  averageImpactScore: number
  score: number
}
```

Check expanded issue seed consequence profiles.

A good expanded response should often affect at least one of:

- named staff
- regular
- supplier
- faction
- culture/customer group
- active policy
- project
- local arc
- expanded pressure
- memory/attribution/future hook

If responses only move coin and reputation, the expansion failed its own reason for existing.

---

## 40.12 Expanded Contradiction Audit

Extend:

```txt
src/sim/testing/contradictionAudit.ts
```

or create:

```txt
src/sim/testing/expandedContradictionAudit.ts
```

Add checks for:

```txt
seed references missing named entity
seed references inactive policy as active
seed references completed project as unfinished
seed references ended arc as active
seed says supplier is angry but supplier relationship/high memories disagree
seed says regular is loyal while regular has leaving/anger state
seed uses cultural calendar context when tag is not active
seed uses market context when market condition is inactive
seed uses area trait that area no longer has
seed uses attribution that expired
```

Return shape:

```ts
export type ExpandedContradictionAuditResult = {
  totalExpandedSeedsAudited: number
  contradictionsFound: Array<{
    seedId: string
    family: string
    reason: string
  }>
  score: number
}
```

---

## 40.13 Build Expanded Readiness Report

In:

```txt
src/sim/testing/expandedReadinessReport.ts
```

Add:

```ts
export function buildExpandedReadinessReport(config = {}): ExpandedReadinessReport
```

Recommended run profile:

```txt
Primary run: 84 days, seed 'phase40-expanded-readiness-anchor'
Replay run: 84 days, same seed
Strategy runs: reuse existing strategy matrix if affordable
Stress runs: optional seeds targeting supplier/faction/staff/arc systems
```

The function should:

1. Run the existing core readiness report.
2. Run a 3-month expanded cardless simulation.
3. Build all Phase 40 expanded reports.
4. Score all expanded sections.
5. Pass only if core readiness passes and expanded sections pass.

### Determinism Requirement

The expanded readiness report must verify same seed produces same final state.

If deterministic replay fails, expanded readiness fails regardless of all other scores.

---

## 40.14 Expanded Card Readiness Gate

Add:

```ts
export type ExpandedCardReadinessGateConditions = {
  coreGatePasses: boolean
  expandedReplayIdentical: boolean
  identityRichnessPasses: boolean
  entityMemoryQualityPasses: boolean
  attributionQualityPasses: boolean
  expandedPressuresExpressive: boolean
  expandedSeedsFromState: boolean
  expandedSeedsCarryContext: boolean
  textIngredientsUsable: boolean
  namedEntityRepetitionAcceptable: boolean
  arcsAndCalendarMatter: boolean
  socialResponsesChangeWorld: boolean
  expandedContradictionAuditPasses: boolean
  allExpansionTestsPass: boolean
}

export type ExpandedCardReadinessGateResult = {
  passed: boolean
  conditions: ExpandedCardReadinessGateConditions
  failedReasons: string[]
  readiness: ExpandedReadinessReport
}
```

Add function:

```ts
export function evaluateExpandedCardReadinessGate(input: {
  allExpansionTestsPass: boolean
  seed?: string
}): ExpandedCardReadinessGateResult
```

### Failure Reasons

Make failure messages specific:

Good:

```txt
Only 1/10 expanded seed families appeared in the 84-day run.
Expanded replay diverged after deterministic seed phase40-expanded-readiness.
No attribution records had source cause or scene references.
Named entity repetition audit found Nib Cracket used in 9 seeds.
```

Bad:

```txt
Expanded readiness failed.
```

---

## 40.15 Expanded Readiness Report Output

Add a report formatter or snapshot helper:

```ts
export function formatExpandedReadinessReport(
  report: ExpandedReadinessReport,
): string
```

Example output:

```txt
Expanded Card Fuel Readiness
Status: PASS WITH WARNINGS

identity_richness: 84/70 PASS
- 4 named staff, 7 regulars, 3 suppliers, 3 factions
- 6 naming profiles used

entity_memory_quality: 78/70 PASS
- 42 entity memories, 37 with owners
- categories: staff, regular, supplier, area, arc

expanded_seed_coverage: 69/65 PASS
- 8/10 expanded families appeared
- weak families: rival_tavern, culture_conflict

named_entity_repetition: 62/70 FAIL
- Brik Tallowmug appeared in 8 seeds
```

This is for developer/debug use. It is not player-facing UI.

---

## 40.16 Update Index Exports

Update:

```txt
src/sim/testing/index.ts
```

Export:

```ts
export * from './expandedReadinessReport'
export * from './expandedSeedCoverageReport'
export * from './expandedContradictionAudit'
```

If some helpers are kept private, export only the main report/gate functions and public types.

---

## 40.17 Add Phase 40 Tests

Create:

```txt
tests/sim/phase40.expandedReadiness.test.ts
```

Test cases:

1. Expanded readiness report builds without throwing.
2. Expanded readiness report includes all expected section ids.
3. Identity richness scorer detects named staff/regulars/suppliers/factions.
4. Entity memory quality scorer counts owned memories.
5. Attribution quality scorer detects blame/credit/source coverage.
6. Expanded pressure quality scorer detects moved expanded pressures.
7. Expanded seed coverage scorer detects expanded seed families.
8. Text ingredient quality scorer flags over-budget prose-like ingredient.
9. Named entity repetition audit penalizes overused entity.
10. Expanded contradiction audit catches missing refs/inactive arc/policy/project contradictions.
11. Expanded readiness gate fails when `allExpansionTestsPass` is false.
12. Expanded readiness gate passes or fails with specific failure reasons, not a blank verdict.
13. Same seed expanded run is deterministic.

### Acceptance Criteria

- Expanded readiness report exists.
- Expanded card readiness gate exists.
- Gate includes core readiness plus expanded identity/social/seed checks.
- Expanded contradiction audit exists.
- Reports are specific enough for an implementation agent to fix failures.
- No player-facing card content is created.
- All Phase 1 to 40 tests pass.

---

# Batch-Level Implementation Order

Implement Phases 36 to 40 in this order:

```txt
1. Phase 36 entity memory helpers and reports
2. Phase 37 attribution module
3. Phase 38 expanded pressures and feedback loops
4. Phase 39 expanded issue seed families and text ingredients
5. Phase 40 expanded readiness reports and gate
```

Do not start Phase 39 before Phase 38 exists. Expanded seeds should draw from expanded pressures, attribution, and entity memories, not generate drama out of mist and countertop crumbs.

Do not start Phase 40 before Phase 39 exists. Readiness cannot measure expanded card fuel until expanded card fuel exists.

---

# Batch-Level Test Command

Use the existing project test command from `package.json`.

Likely command:

```bash
npm test
```

If the repo uses Vitest directly:

```bash
npx vitest run
```

Recommended phase-specific checks:

```bash
npx vitest run tests/sim/phase36.entityMemory.test.ts
npx vitest run tests/sim/phase37.attribution.test.ts
npx vitest run tests/sim/phase38.expandedPressures.test.ts
npx vitest run tests/sim/phase39.expandedIssueSeeds.test.ts
npx vitest run tests/sim/phase40.expandedReadiness.test.ts
npx vitest run tests/sim
```

---

# Batch-Level Done Definition

Phases 36 to 40 are complete when:

1. Entity-scoped memories exist and can be queried.
2. Major expanded-system events create meaningful memories.
3. Attribution records distinguish actual causes from perceived blame/credit.
4. Public attributions can create memories and rumours.
5. Expanded pressures calculate from social, supplier, faction, cultural, policy, rumour, and arc state.
6. Expanded feedback loops activate when pressure webs reinforce themselves.
7. Expanded issue seed families generate from real state.
8. Expanded seeds include named entities, relevant memories, attributions, pressures, and response slots.
9. Expanded contradiction guards prevent stale or impossible seeds.
10. Expanded text ingredients remain compact and non-card-like.
11. Expanded readiness reports measure identity, memory, attribution, pressure, seed, text, repetition, arc, and social consequence quality.
12. The expanded card readiness gate gives specific pass/fail reasons.
13. Deterministic replay still works.
14. Existing Phase 1 to 20 behaviour is not broken.
15. All tests through Phase 40 pass.

At this point, the simulation should finally be ready for actual card-writing work. The tavern will have named people, grudges, supplier drama, rumours, social pressure, seasonal arcs, and enough structured issue fuel that cards can be written from the system instead of stapled onto it like decorative bat wings.
