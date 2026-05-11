# Goblin Tavern Simulation Expansion - Phases 31 to 35 Implementation Plan

Status: **Phases 1 to 20 complete, Phase 21 contract complete, Phases 22 to 30 planned**  
Scope of this document: **Expand Phases 31 to 35 only**  
Purpose: Give an implementation agent enough detail to add staff identity, service scenes, owner projects/policies/social actions, weekly community routines, and seasonal arcs while staying grounded in the current repo.

---

## Current Repo Baseline

This plan assumes the current finished `Goblin-Tavern-main` repo plus the added planning docs through Phase 30.

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

The current pipeline in `src/sim/core/phases.ts` is:

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

The repo already has registries:

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

The repo already has gameplay modules through Phase 20:

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

The completed system already includes:

- Deterministic simulation through `simulateDay`.
- `SimContext` mutation helpers such as `ctx.modifyArea`, `ctx.modifyStock`, `ctx.modifyStaff`, `ctx.modifyCoin`, `ctx.modifyModuleState`, `ctx.addMemory`, `ctx.addHistory`, and `ctx.addCause`.
- Staff roles and priorities in `src/sim/modules/staff/` and `src/sim/registries/staffRegistry.ts` / `staffPriorityRegistry.ts`.
- Service resolution in `src/sim/modules/service/resolveService.ts` and `serviceModule.ts`.
- Owner actions in `src/sim/modules/ownerActions/`.
- Weekly routines in `src/sim/modules/weekly/`.
- Monthly routines in `src/sim/modules/monthly/`.
- Memory, history, causes, pressures, feedback loops, issue seeds, and cardless playtest utilities.
- Tests through `tests/sim/phase20.cardlessPlaytest.test.ts`.

Do not re-scaffold these systems. This batch should extend them.

---

## Dependency Assumption From Phases 22 to 30

Phases 31 to 35 assume Phases 22 to 30 are implemented before this batch begins.

Expected Phase 22 to 25 additions:

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

Expected Phase 25 world state:

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

Expected Phase 24 RNG stream support:

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

Expected Phase 26 to 30 additions:

- Expanded schemas and reference validation.
- World update hooks that fit the existing phase pipeline.
- Area traits and upgrades.
- Supplier registry and supplier state.
- Culture/customer group expansion and persistent regulars.

If these pieces are not present yet, implement them first. Do not smuggle missing Phase 22 to 30 work into Phase 31 to 35 like a ratkin invoice with three different totals.

---

## Expansion Rules For This Batch

Phases 31 to 35 must obey the Phase 21 contract:

1. **No finished cards.**
2. **No UI work.**
3. **No flavour-only entities.**
4. **Names, scenes, projects, policies, community state, and arcs must be serializable if they persist.**
5. **Every generated identity must be deterministic.**
6. **Every new record must either have schema validation or module-level validation.**
7. **Every new system must eventually feed issue seeds, reports, memories, causes, or pressures.**
8. **Do not break the existing Phase 1 to 20 tests.**
9. **Do not remove or rewrite the current service/staff/weekly/monthly architecture.**
10. **Prefer additive state changes and module slices over large top-level rewrites.**

---

# Phase 31 - Staff Identity, Personality, and Deterministic Names

## Mirrors Phase 11: Staff System

## Goal

Expand staff from role-based workers into persistent named people with group identity, deterministic generated names, personality tags, work style, stress response, loyalties, dislikes, and background hooks.

The existing staff system already handles:

```txt
src/sim/modules/staff/
  index.ts
  performance.ts
  priorityEffects.ts
  staffModule.ts
  types.ts
```

and registries:

```txt
src/sim/registries/staffRegistry.ts
src/sim/registries/staffPriorityRegistry.ts
```

The current `StaffState` in `src/sim/state/TavernState.ts` is:

```ts
export type StaffState = {
  id: string
  name: string
  role: StaffRoleId
  skill: number
  morale: number
  stress: number
  fatigue: number
  loyalty: number
  wage: number
  paidThisWeek: boolean
  currentPriority?: StaffPriorityId
  unavailable?: boolean
  tags: string[]
  activeFlags: string[]
}
```

Phase 31 should extend this shape without breaking existing tests.

---

## 31.1 Add Staff Identity Fields

Update `StaffState` in `src/sim/state/TavernState.ts`.

Add optional or defaulted fields first, then ensure defaults populate them for all starting staff.

Recommended final shape:

```ts
import type { GeneratedName } from '../../content/naming/nameTypes'

export type StaffIdentityState = {
  groupId: string
  cultureId?: string
  namingProfileId: string
  generatedName: GeneratedName
  personalityTags: string[]
  workStyle: StaffWorkStyle
  stressResponse: StaffStressResponse
  loyalties: string[]
  dislikes: string[]
  backgroundHook?: string
}

export type StaffWorkStyle =
  | 'steady'
  | 'fast'
  | 'careful'
  | 'social'
  | 'rough'
  | 'methodical'
  | 'improviser'

export type StaffStressResponse =
  | 'withdraws'
  | 'snaps'
  | 'rushes'
  | 'overworks'
  | 'gets_sloppy'
  | 'asks_for_help'

export type StaffState = {
  id: string
  name: string
  role: StaffRoleId
  skill: number
  morale: number
  stress: number
  fatigue: number
  loyalty: number
  wage: number
  paidThisWeek: boolean
  currentPriority?: StaffPriorityId
  unavailable?: boolean
  tags: string[]
  activeFlags: string[]

  // Phase 31
  identity: StaffIdentityState
}
```

If adding a required `identity` field causes too much migration churn, add it as optional during the first commit, write normalization/migration/default helpers, then make schemas enforce it once all seeded staff paths are covered.

---

## 31.2 Create Staff Identity Content Files

Use the content structure expected from Phase 22.

Add:

```txt
src/sim/content/naming/
  namingProfiles.ts
  nameGenerator.ts
  nameTypes.ts
  index.ts

src/sim/content/staff/
  staffIdentityProfiles.ts
  staffIdentityFactory.ts
  staffIdentityTypes.ts
  index.ts
```

If `src/sim/content/staff/` does not exist yet, create it. The Phase 22 structure listed broad content folders but did not require a staff-specific subfolder. It is appropriate here because staff identity has its own factory and profile rules.

---

## 31.3 Naming Types

Do not redefine naming types here. Import them from Phase 22:

```ts
import type {
  GeneratedName,
  NamingProfile,
  NamePattern,
  NamePartKind,
} from '../naming/nameTypes'
```

Phase 22's `NamingProfile` already includes the optional `syllables?: { starts, middles?, ends }` field for procedural variety. `NamePattern` uses `{ id, weight, template, partKinds, tags }` — `template` plus `partKinds` is more expressive than a single `format` string and lets weighted patterns subsume profile-level "use family name chance" parameters (a pattern `'{given} {family}'` at weight 8 plus a pattern `'{given}'` at weight 2 encodes an 80% family-name chance directly).

`GeneratedName` keeps Phase 22's `patternId` field — useful for tests answering "which pattern produced this name?".

Phase 31 should not re-export or wrap these types under different names.

---

## 31.4 Initial Naming Profiles

Create initial profiles in `src/sim/content/naming/namingProfiles.ts`.

Minimum profiles use Phase 22's `NamingProfile` shape:

```ts
export const namingProfiles: NamingProfile[] = [
  {
    id: 'goblin_common',
    label: 'Common Goblin',
    tags: ['goblin', 'short', 'sharp'],
    given: ['Nib', 'Grakka', 'Snit', 'Brak', 'Miz', 'Skib', 'Vro', 'Takka'],
    family: ['Cracket', 'Mugbit', 'Tallowmug', 'Greasewick', 'Bentspoon'],
    nicknames: ['the Quick', 'Soupnose', 'Ashfingers', 'Mug-Cheater'],
    patterns: [
      { id: 'given_only',     weight: 50, template: '{given}',           partKinds: ['given'],           tags: ['casual'] },
      { id: 'given_family',   weight: 35, template: '{given} {family}',  partKinds: ['given', 'family'], tags: ['formal'] },
      { id: 'given_nickname', weight: 15, template: '{given} {nickname}', partKinds: ['given', 'nickname'], tags: ['informal'] },
    ],
  },
  {
    id: 'human_town',
    label: 'Town Human',
    tags: ['human', 'town'],
    given: ['Mara', 'Tomlin', 'Bessa', 'Harl', 'Edda', 'Corvin'],
    family: ['Vetch', 'Cooper', 'Marl', 'Rusk', 'Briar', 'Tanner'],
    patterns: [
      { id: 'given_family', weight: 80, template: '{given} {family}', partKinds: ['given', 'family'], tags: ['formal'] },
      { id: 'given_only',   weight: 20, template: '{given}',          partKinds: ['given'],           tags: ['casual'] },
    ],
  },
  {
    id: 'dwarf_caravan',
    label: 'Dwarven Caravan',
    tags: ['dwarf', 'caravan', 'trade'],
    given: ['Borren', 'Hilda', 'Korrim', 'Dagna', 'Varric', 'Beldi'],
    family: ['Stonekeg', 'Copperbraid', 'Ironpike', 'Ashbarrel', 'Deepmalt'],
    titles: ['Auntie', 'Uncle', 'Master', 'Mistress'],
    patterns: [
      { id: 'given_family',       weight: 90, template: '{given} {family}',         partKinds: ['given', 'family'],          tags: ['formal'] },
      { id: 'title_given_family', weight: 10, template: '{title} {given} {family}', partKinds: ['title', 'given', 'family'], tags: ['ceremonial'] },
    ],
  },
]
```

Weighted patterns encode the chance of using family names, nicknames, or titles — no separate `useFamilyNameChance` / `useNicknameChance` fields are needed.

These are starter examples. Keep the list small enough to test but diverse enough to prove the generator supports distinct profiles.

---

## 31.5 Deterministic Name Generator

Create `src/sim/content/naming/nameGenerator.ts`.

Requirements:

- Accept a deterministic RNG stream from the existing RNG system.
- Do not call `Math.random`.
- Return a structured `GeneratedName` object.
- Support stable generation from the same seed and same creation order.
- Avoid infinite loops when a profile has sparse pools.
- Respect reserved names if present.

Phase 24 already established the canonical signature:

```ts
import type { SimRng } from '../../core/rng'
import type { GeneratedName, NamingProfile } from './nameTypes'

export function generateName(
  profile: NamingProfile,
  rng: SimRng,
  generatedBy: string,
  options?: { existingDisplayNames?: ReadonlySet<string> },
): GeneratedName
```

Phase 31 adds the optional `options?` parameter additively — Phase 24 callers passing three arguments still work. The `existingDisplayNames` set lets the generator retry briefly to avoid duplicate display names (capped at a small fixed number of attempts so the function stays deterministic).

Use the existing `SimRng` type from `src/sim/core/rng.ts`; do not introduce a parallel `RngLike` interface.

---

## 31.6 Staff Identity Profiles

Create `src/sim/content/staff/staffIdentityProfiles.ts`.

Purpose: define identity defaults for seeded staff and later generated staff.

```ts
export type StaffIdentityProfile = {
  id: string
  roleId: string
  groupId: string
  cultureId?: string
  namingProfileId: string
  personalityTags: string[]
  workStyles: StaffWorkStyle[]
  stressResponses: StaffStressResponse[]
  loyalties: string[]
  dislikes: string[]
  backgroundHooks: string[]
}
```

Starter profiles should map to the existing required roles:

```txt
cook
server
cleaner_bouncer
```

Example intent:

```txt
cook:
- likely goblin_common
- personality: proud, impatient, protective_of_recipe
- dislikes: bland_food, wasted_stock

server:
- likely human_town or goblin_common
- personality: gossipy, quick, socially_alert
- dislikes: unpaid_tabs, rude_regulars

cleaner_bouncer:
- likely goblin_common or dwarf_caravan
- personality: grim, loyal, hates_rats
- dislikes: brawls, sticky_floor
```

Do not overfit these defaults. This is infrastructure, not cast writing.

---

## 31.7 Staff Identity Factory

Create `src/sim/content/staff/staffIdentityFactory.ts`.

Suggested API:

```ts
export function createStaffIdentity(args: {
  staffId: string
  roleId: string
  rng: RngLike
  existingNames?: ReadonlySet<string>
  profileId?: string
}): StaffIdentityState
```

It should:

1. Pick a `StaffIdentityProfile` by role, unless `profileId` is supplied.
2. Resolve its naming profile.
3. Generate a deterministic name.
4. Pick one work style.
5. Pick one stress response.
6. Copy personality tags, loyalties, dislikes.
7. Pick one background hook if available.

The display name should also be copied to the existing `staff.name` field for backwards compatibility.

---

## 31.8 Seed Default Staff With Identity

Update `createInitialStaff()` in `src/sim/state/defaults.ts`.

Currently it builds staff from `staffRegistry.all()` and sets:

```ts
{
  id: def.defaultStaffId,
  name: def.defaultStaffName,
  role: def.id,
  tags: [...def.defaultTags],
  ...def.defaultState,
  activeFlags: [...def.defaultState.activeFlags],
}
```

Phase 31 should add deterministic identity.

Important constraint: `createInitialTavernState()` currently does not require an input seed. Therefore default staff identity cannot rely on day input unless you change the public API.

Recommended approach:

- Use a stable default seed derived from `meta.tavernId` or a constant such as `'initial-staff-identity'` inside `createInitialStaff()`.
- Later simulation-spawned staff can use the `staff_identity` RNG stream from the daily input seed.
- Tests should verify default names are deterministic.

Example:

```ts
const identity = createStaffIdentity({
  staffId: def.defaultStaffId,
  roleId: def.id,
  rng: createRng('initial-staff-identity').stream('staff_identity'),
  existingNames,
})

staff[def.defaultStaffId] = {
  ...existingFields,
  name: identity.generatedName.display,
  identity,
}
```

Adjust this to match the actual RNG API from Phase 24.

---

## 31.9 Identity Effects On Staff Performance

Update `src/sim/modules/staff/performance.ts` carefully.

Do not make identity dominate the numeric staff system.

Add small modifiers only:

```txt
fast workStyle: small service speed support
careful workStyle: small quality/support bonus, small speed penalty
rough workStyle: small fight control support, small customer comfort risk later
steady workStyle: small stress resistance
improviser workStyle: small bonus under shortages/incidents later
```

Better place for this may be `src/sim/modules/staff/priorityEffects.ts`, because that file already translates staff + priorities into `ServiceQualityModifiers`.

Acceptance rule: existing staff priority tests should still pass with the same broad relationships. If exact numeric tests fail, update them only if the new identity effect is intentional and documented.

---

## 31.10 Staff Reports Include Identity

Update staff report generation in `src/sim/modules/staff/staffModule.ts`.

Current `describeStaffLine()` already prints role and priority. Add concise identity information when useful:

```txt
Nib Cracket — Cook, priority Speed, steady, proud, stress 31, fatigue 22
```

Do not turn reports into prose scenes. The staff report should remain structured/debuggable.

---

## 31.11 Phase 31 Tests

Create:

```txt
tests/sim/phase31.staffIdentity.test.ts
```

Required tests:

1. Default staff have `identity` records.
2. Default staff names are non-empty and match `identity.generatedName.display`.
3. Default staff identities include `groupId`, `namingProfileId`, `personalityTags`, `workStyle`, and `stressResponse`.
4. Name generation is deterministic for the same seed/profile.
5. Different naming profiles can produce visibly different display-name patterns.
6. `validateState(createInitialTavernState())` passes.
7. Invalid staff identity profile reference fails validation or module validation.
8. Existing Phase 11 priority assignment still works.
9. Staff report includes identity fields without losing role/priority information.
10. No generated staff identity uses `Math.random` behaviour. Test by running the same generation twice and comparing deep equality.

---

## Phase 31 Acceptance Criteria

- Staff have persistent deterministic identity.
- Staff names are generated from naming profiles.
- Staff `name` remains backwards-compatible.
- Identity feeds staff reports.
- Identity has small, documented mechanical hooks or is ready for Phase 32/33 hooks.
- Existing tests still pass.
- New tests cover determinism and validation.

---

# Phase 32 - Expanded Daily Service Scenes

## Mirrors Phase 12: Daily Service Simulation

## Goal

Add structured service scenes that make daily service more specific and card-ready without creating finished cards.

The current service system already produces `DailyServiceResult` in `src/sim/modules/service/types.ts`:

```ts
export type DailyServiceResult = {
  dayKey: string
  trafficByGroup: Record<string, number>
  purchasesByGroup: Record<string, PurchaseSummary>
  coinEarned: number
  unpaidTabs: number
  netCoinEarned: number
  stockConsumed: Array<{ stockId: string; quantity: number }>
  shortages: ShortageRecord[]
  messCreated: AreaChangeSummary[]
  damageCreated: AreaChangeSummary[]
  satisfactionChanges: CustomerSatisfactionChange[]
  staffChanges: StaffChangeSummary[]
  incidents: ServiceIncidentSummary[]
  serviceQuality: ServiceQualityModifiers
}
```

Phase 32 should add a new `scenes` array to this result.

---

## 32.1 Add Service Scene Types

Update `src/sim/modules/service/types.ts`.

Add:

```ts
import type { EntityRef } from '../../state/TavernState'

export type ServiceSceneSeverity = 'minor' | 'moderate' | 'major'

export type ServiceScene = {
  id: string
  sceneType:
    | 'staff_customer_friction'
    | 'regular_complaint'
    | 'supplier_arrival_during_rush'
    | 'area_problem_noticed'
    | 'stock_quality_complaint'
    | 'cultural_seating_friction'
    | 'unpaid_tab_argument'
    | 'brawl_aftermath'
    | 'staff_moment'
  severity: ServiceSceneSeverity
  numericSeverity: number
  areaId?: string
  involvedEntityRefs: EntityRef[]
  involvedGroupIds: string[]
  staffIds: string[]
  regularIds: string[]
  supplierIds: string[]
  tags: string[]
  causes: string[]
  textIngredients: Record<string, string | number | boolean | null>
  possibleIssueSeedIds: string[]
}
```

Then extend:

```ts
export type DailyServiceResult = {
  // existing fields...
  scenes: ServiceScene[]
}
```

Update `buildEmptyResult()` in `src/sim/modules/service/resolveService.ts` to include:

```ts
scenes: []
```

---

## 32.2 Add Scene Builder Module

Create:

```txt
src/sim/modules/service/serviceScenes.ts
```

Suggested API:

```ts
export function buildServiceScenes(args: {
  ctx: SimContext
  resultBeforeScenes: DailyServiceResult
}): ServiceScene[]
```

The builder should inspect existing service result data plus expanded Phase 25 to 31 state:

- `result.incidents`
- `result.shortages`
- `result.satisfactionChanges`
- `ctx.state.staff`
- `ctx.state.customerGroups`
- `ctx.state.areas`
- `ctx.state.world?.regulars`
- `ctx.state.world?.suppliers`
- `ctx.state.world?.cultures`
- `ctx.state.memories`
- `ctx.state.causes`
- `ctx.state.pressures`
- `ctx.state.calendar.tags` or equivalent Phase 23 calendar tags

Do not make the scene builder mutate state directly. It should return structured scene records. The service module decides whether to add memories/history from those scenes.

---

## 32.3 Scene Generation Rules

Scenes must be deterministic.

Use the Phase 24 `incidents` or `service` RNG stream only when choosing among equally valid scene candidates.

Do not create more than a small number of scenes per day.

Recommended cap:

```ts
const MAX_SERVICE_SCENES_PER_DAY = 3
```

Generation should be mostly condition-driven:

### Stock Quality Complaint

Trigger when:

- a group had visitors
- food or ale quality is poor
- satisfaction dropped
- there is a food complaint or shortage incident

Text ingredients:

```ts
{
  groupName: 'Miners',
  stockName: 'Ale',
  quality: 24,
  staffName: 'Nib Cracket',
}
```

### Regular Complaint

Trigger when:

- Phase 30 regulars exist
- a regular's group had satisfaction loss
- the regular's loyalty or irritation makes them likely to speak up

Text ingredients:

```ts
{
  regularName: 'Brik Tallowmug',
  complaintTopic: 'watery ale',
  groupName: 'Miners',
}
```

### Area Problem Noticed

Trigger when:

- an area gained mess/damage
- area has Phase 28 traits such as `sticky_floor`, `drafty`, or `smells_of_smoke`
- merchants or respectable groups are present

### Unpaid Tab Argument

Trigger when:

- `result.unpaidTabs > 0`
- server priority is not `watch_tabs`, or group tab risk is high

### Brawl Aftermath

Trigger when:

- `result.incidents` includes `minor_brawl`
- `main_room.damage` or `violence` pressure is high

### Staff Moment

Trigger when:

- staff stress or fatigue crosses threshold
- staff has relevant `stressResponse`
- service quality modifier is strongly positive or negative

---

## 32.4 Integrate Scenes Into Service Module

Update `src/sim/modules/service/serviceModule.ts`.

Current flow:

1. Build or resolve daily service result.
2. Write result to `state.modules.service`.
3. Apply staff stress/fatigue.
4. Emit memories and history for key service events.

Phase 32 should:

1. Resolve base result as currently done.
2. Call `buildServiceScenes()`.
3. Attach scenes to the result.
4. Write result to `state.modules.service`.
5. Emit memories/history from selected scenes only where appropriate.

Do not duplicate memories already emitted for brawls/shortages unless the scene adds new context.

---

## 32.5 Scene Memory and History Rules

Scenes may create memories/history, but only if they are meaningful.

Examples:

```ts
ctx.addHistory({
  category: 'service',
  summary: 'Named regular complained about watery ale.',
  tags: ['service', 'scene', 'regular_complaint', 'ale'],
  relatedActors: [
    { kind: 'regular', id: regularId },
    { kind: 'customer_group', id: groupId },
  ],
  relatedLocations: [{ kind: 'area', id: 'main_room' }],
  relatedSystems: ['service', 'regulars'],
  mechanicalRefs: [scene.id],
})
```

Only add memories when they should affect future simulation:

- `regular_complained_recently`
- `staff_snapped_recently`
- `supplier_embarrassed_recently`
- `area_problem_publicly_noticed`
- `cultural_friction_recently`

Use the Phase 16 memory system rather than creating custom arrays.

---

## 32.6 Service Report Update

Update service reports in `src/sim/modules/service/serviceModule.ts`.

The report should include a compact scene subsection:

```txt
Service Scenes
- Moderate regular_complaint: Brik Tallowmug noticed watery ale in Main Room.
- Minor staff_moment: Nib Cracket rushed through service under high fatigue.
```

Keep the report debug-readable. It should not become card prose.

---

## 32.7 Phase 32 Tests

Create:

```txt
tests/sim/phase32.serviceScenes.test.ts
```

Required tests:

1. `DailyServiceResult` includes `scenes` even on quiet days.
2. Same seed + same state produces identical scenes.
3. Poor stock quality can create a `stock_quality_complaint` scene.
4. A brawl incident can create a `brawl_aftermath` scene.
5. A regular with high irritation can appear in a `regular_complaint` scene.
6. A stressed staff member can appear in a `staff_moment` scene.
7. Scenes reference valid entity IDs.
8. Scene count is capped.
9. Service report includes scene information.
10. Scenes do not create finished card text or card IDs.

---

## Phase 32 Acceptance Criteria

- Service results include structured scenes.
- Scenes use named entities when available.
- Scenes include causes and text ingredients.
- Scenes are deterministic.
- Reports expose scenes for future card-writing audits.
- Existing service tests still pass.

---

# Phase 33 - Owner Projects, Policies, and Social Actions

## Mirrors Phase 13: Owner Action System

## Goal

Expand owner actions beyond immediate one-day fixes into persistent projects, standing policies, and relationship-based social actions.

The current owner action system already has:

```txt
src/sim/modules/ownerActions/
  actionDefinitions.ts
  index.ts
  ownerActionsModule.ts
  types.ts
```

Current `OwnerActionDefinition` supports:

```ts
export type OwnerActionDefinition = {
  id: OwnerActionId
  label: string
  tags: string[]
  targetType?: OwnerActionTargetType
  actionPointCost: number
  getValidTargets: (ctx: SimContext) => ActionTarget[]
  canApply: (ctx: SimContext, input: OwnerActionInput) => ActionValidationResult
  apply: (ctx: SimContext, input: OwnerActionInput) => OwnerActionApplied
}
```

Phase 33 should extend this system without replacing it.

---

## 33.1 Expand Owner Action Target Types

Update `src/sim/modules/ownerActions/types.ts`.

Current:

```ts
export type OwnerActionTargetType = 'area' | 'stock' | 'staff' | 'global'
```

Expand:

```ts
export type OwnerActionTargetType =
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer_group'
  | 'regular'
  | 'supplier'
  | 'faction'
  | 'project'
  | 'policy'
  | 'global'
```

Existing actions should continue to work unchanged.

---

## 33.2 Add Owner Action Category

Add:

```ts
export type OwnerActionCategory =
  | 'immediate'
  | 'project'
  | 'policy'
  | 'social'

export type OwnerActionDefinition = {
  id: OwnerActionId
  label: string
  category: OwnerActionCategory
  tags: string[]
  targetType?: OwnerActionTargetType
  actionPointCost: number
  getValidTargets: (ctx: SimContext) => ActionTarget[]
  canApply: (ctx: SimContext, input: OwnerActionInput) => ActionValidationResult
  apply: (ctx: SimContext, input: OwnerActionInput) => OwnerActionApplied
}
```

For existing actions, set:

```ts
category: 'immediate'
```

This is an additive registry metadata change. It should not alter existing behaviour.

---

## 33.3 Add Project and Policy State

Prefer a module-owned state slice under `state.modules.ownerActions` rather than a new top-level branch.

Update `OwnerActionsModuleState` in `src/sim/modules/ownerActions/types.ts`.

Add:

```ts
export type OwnerProjectState = {
  id: string
  projectType: string
  label: string
  targetType?: OwnerActionTargetType
  targetId?: string
  startedAtDay: number
  progress: number
  requiredProgress: number
  coinInvested: number
  status: 'active' | 'completed' | 'cancelled' | 'blocked'
  tags: string[]
  effectsPreview: string[]
}

export type OwnerPolicyState = {
  id: string
  policyType: string
  label: string
  enabled: boolean
  startedAtDay: number
  targetType?: OwnerActionTargetType
  targetId?: string
  tags: string[]
  effects: string[]
}

export type OwnerSocialActionRecord = {
  id: string
  actionId: string
  targetType: OwnerActionTargetType
  targetId: string
  day: number
  outcome: 'improved' | 'worsened' | 'neutral'
  notes: string[]
  tags: string[]
}
```

Then extend:

```ts
export type OwnerActionsModuleState = {
  actionPointsUsed: number
  actionPointBudget: number
  applied: OwnerActionApplied[]
  rejected: OwnerActionRejected[]

  // Phase 33
  projects: Record<string, OwnerProjectState>
  policies: Record<string, OwnerPolicyState>
  recentSocialActions: OwnerSocialActionRecord[]
}
```

Update `createInitialOwnerActionsModuleState()` in `ownerActionsModule.ts`:

```ts
projects: {},
policies: {},
recentSocialActions: [],
```

Important: the current module resets daily applied/rejected/action points. Do not accidentally erase active projects and policies every morning. When resetting daily fields, preserve persistent fields.

Bad:

```ts
return createInitialOwnerActionsModuleState()
```

Good:

```ts
return {
  ...createInitialOwnerActionsModuleState(),
  projects: current?.projects ?? {},
  policies: current?.policies ?? {},
  recentSocialActions: pruneRecentSocialActions(current?.recentSocialActions ?? []),
}
```

---

## 33.4 Project Action Definitions

Create a new file:

```txt
src/sim/modules/ownerActions/projectActions.ts
```

Add definitions such as:

```txt
start_project
fund_project
cancel_project
```

Or use separate explicit action IDs:

```txt
start_private_booths
start_hearth_repair
start_rat_proof_storage
start_music_corner
fund_active_project
cancel_project
```

Recommended for testability: explicit project-start actions.

Starter projects:

| Project Type | Target | Effect when complete |
|---|---|---|
| `repair_hearth` | `area:main_room` | add/enable cozy or well_lit trait, reduce smell/risk |
| `private_booths` | `area:main_room` | improve merchant/regular satisfaction, reduce cultural friction |
| `rat_proof_storage` | `area:cellar` | reduce pests/spoilage/stock loss |
| `larger_stew_pot` | `area:kitchen` | improve service capacity for stew |
| `music_corner` | `area:main_room` | improve cozy/strange, may increase rowdy traffic |

Projects should:

- cost action points to start or fund
- optionally cost coin
- progress over days/weeks
- complete deterministically
- add area upgrades or traits from Phase 28
- create causes/history/memories on start and completion

---

## 33.5 Project Progress Hook

Add project progress handling in `ownerActionsModule.ts`.

Best phase:

```txt
closing
```

or

```txt
endDay
```

Recommendation: use `closing` or `endDay`, after service has resolved.

Project progress should consider:

- action investment today
- available coin invested
- staff fatigue/stress maybe slowing work later
- blocked conditions, if any

Initial simple rule:

```txt
Every active project gains 1 progress per day if not blocked.
Funding actions can add extra progress.
Completion occurs when progress >= requiredProgress.
```

On completion:

- apply the project effect
- set status to `completed`
- add history
- add memory
- add cause records
- update area traits/upgrades if Phase 28 exists

---

## 33.6 Policy Action Definitions

Create:

```txt
src/sim/modules/ownerActions/policyActions.ts
```

Starter policies:

```txt
allow_tabs_for_regulars
refuse_tabs
ban_weapons_inside
serve_miners_discount
close_early_on_festival_eve
water_ale_quietly
```

Policies should be persistent records in `OwnerActionsModuleState.policies`.

Policies should affect existing systems modestly:

### `refuse_tabs`

- reduces unpaid tabs
- lowers satisfaction for high-tab-risk or regular-heavy groups
- may increase reliable/respectable reputation later

### `allow_tabs_for_regulars`

- increases regular loyalty
- increases unpaid tab risk
- can create debt pressure later

### `ban_weapons_inside`

- reduces brawl/violence risk
- irritates rowdy groups
- may increase respectable reputation

### `serve_miners_discount`

- increases miner satisfaction/patronage
- reduces ale/stew profit margins for miner purchases

### `water_ale_quietly`

- reduces stock consumption or increases ale stretch
- risks reputation, regular complaints, and blame records later

Do not implement all downstream effects in Phase 33 if the relevant hooks belong to later phases. It is enough to store policies and wire one or two obvious effects into service as proof.

---

## 33.7 Social Action Definitions

Create:

```txt
src/sim/modules/ownerActions/socialActions.ts
```

Starter social actions:

```txt
comfort_stressed_staff
apologize_to_regular
negotiate_with_supplier
warn_rowdy_group
host_faction_night
```

Target validation:

- `comfort_stressed_staff`: target must be staff.
- `apologize_to_regular`: target must be regular.
- `negotiate_with_supplier`: target must be supplier.
- `warn_rowdy_group`: target must be customer group.
- `host_faction_night`: target must be faction.

Example effects:

### `comfort_stressed_staff`

- staff stress decreases
- morale or loyalty increases
- memory added to staff actor

### `apologize_to_regular`

- regular irritation decreases
- regular loyalty increases
- memory added to regular actor

### `negotiate_with_supplier`

- supplier relationship increases
- reliability may improve slightly
- may create social memory

Use Phase 30 supplier/regular/faction state if available. If a target type is missing because Phase 30 is not implemented, validation should reject gracefully.

---

## 33.8 Service Integration For Policies

Update `src/sim/modules/service/resolveService.ts` or a helper near it.

Add a small policy reader:

```ts
export function getEnabledPolicies(state: TavernState): OwnerPolicyState[]
```

Apply simple policy effects inside existing calculations:

- `refuse_tabs`: reduce computed unpaid tabs.
- `allow_tabs_for_regulars`: increase unpaid tabs only for groups with regulars, but increase regular loyalty later.
- `ban_weapons_inside`: reduce brawl likelihood or severity.
- `water_ale_quietly`: reduce ale consumption but add potential `stock_quality_complaint` / `regular_complaint` scene later.

Keep this modest. Phase 33 proves the hook exists; later phases can make it richer.

---

## 33.9 Owner Action Reports

Update the owner action report in `ownerActionsModule.ts`.

Add sections:

```txt
Active Projects
- Rat-Proof Storage: 2/5 progress, active

Enabled Policies
- Refuse Tabs: active, affects unpaid tabs and customer satisfaction

Recent Social Actions
- Comforted Nib Cracket: improved morale, lowered stress
```

Keep daily applied/rejected actions visible as before.

---

## 33.10 Phase 33 Tests

Create:

```txt
tests/sim/phase33.ownerProjectsPoliciesSocial.test.ts
```

Required tests:

1. Owner action state preserves active projects across daily reset.
2. Starting a project creates an active project record.
3. Project progress advances deterministically.
4. Completing a project applies an area trait/upgrade or other effect.
5. Enabling a policy creates a persistent policy record.
6. Disabling or replacing a policy works if implemented.
7. `refuse_tabs` reduces unpaid tabs compared with no policy.
8. `comfort_stressed_staff` changes staff stress/morale and records history/memory.
9. Invalid social targets are rejected.
10. Existing Phase 13 actions still work.

---

## Phase 33 Acceptance Criteria

- Owner action definitions support categories.
- Projects persist and progress.
- Policies persist and can affect at least one downstream system.
- Social actions affect named entities.
- Reports expose projects/policies/social actions.
- Existing owner action tests still pass.

---

# Phase 34 - Weekly Supplier, Staff, and Community Routine Expansion

## Mirrors Phase 14: Weekly Routine System

## Goal

Expand weekly routines so the tavern feels embedded in a community of suppliers, regulars, staff, customer groups, factions, and rumours.

The current weekly module already has:

```txt
src/sim/modules/weekly/
  index.ts
  maintenance.ts
  report.ts
  signals.ts
  state.ts
  trends.ts
  types.ts
  wages.ts
  weeklyModule.ts
```

Current `WeeklyResult` in `src/sim/modules/weekly/types.ts` already includes:

- economy totals
- wages
- maintenance backlog
- staff trends
- customer trends
- signals
- supplier invoice placeholder

Phase 34 should add expanded community outputs without replacing the existing result.

---

## 34.1 Add Weekly Community Types

Update `src/sim/modules/weekly/types.ts`.

Add:

```ts
export type WeeklySupplierTrendEntry = {
  supplierId: string
  relationshipDelta: number
  reliabilityDelta: number
  pricePressureDelta: number
  notes: string[]
}

export type WeeklyRegularTrendEntry = {
  regularId: string
  loyaltyDelta: number
  irritationDelta: number
  visitsThisWeek: number
  notes: string[]
}

export type WeeklyFactionTrendEntry = {
  factionId: string
  satisfactionDelta: number
  tensionDelta: number
  notes: string[]
}

export type WeeklyCommunityRumour = {
  id: string
  sourceType: 'service_scene' | 'memory' | 'policy' | 'incident' | 'supplier' | 'faction'
  sourceId: string
  strength: number
  accuracy: 'true' | 'partial' | 'false' | 'unknown'
  tags: string[]
  involvedRefs: EntityRef[]
  summary: string
}

export type WeeklyCommunityResult = {
  supplierTrend: WeeklySupplierTrendEntry[]
  regularTrend: WeeklyRegularTrendEntry[]
  factionTrend: WeeklyFactionTrendEntry[]
  rumours: WeeklyCommunityRumour[]
  notes: string[]
}
```

Extend `WeeklyResult`:

```ts
export type WeeklyResult = {
  // existing fields...
  community: WeeklyCommunityResult
}
```

Extend `WeeklyModuleState` accumulators if needed:

```ts
communityRumourIdsThisWeek: string[]
regularVisitsById: Record<string, number>
supplierIssueCounts: Record<string, number>
factionMentions: Record<string, number>
```

Keep this minimal at first. You can derive some weekly community results directly at `endWeek` from service scenes, memories, causes, and world state.

---

## 34.2 Add Community Trend Module Helpers

Create:

```txt
src/sim/modules/weekly/community.ts
```

Suggested API:

```ts
export function resolveWeeklyCommunity(args: {
  ctx: SimContext
  currentWeeklyState: WeeklyModuleState
  baseWeeklyResult: WeeklyResult
}): WeeklyCommunityResult
```

Responsibilities:

- Update supplier relationship/reliability based on shortages, unpaid invoices, and social actions.
- Update regular loyalty/irritation based on service scenes, policies, and apologies.
- Update faction satisfaction/tension based on policies, group satisfaction, and events.
- Generate weekly rumours from notable incidents or scenes.
- Add causes/history/memories only for meaningful changes.

---

## 34.3 Supplier Weekly Routine

Requires Phase 29 supplier state.

Inputs:

- stock shortages this week
- supplier invoices if implemented
- restock purchases
- `negotiate_with_supplier` social actions
- market conditions
- delivery reliability

Effects:

```txt
late payment → supplier relationship down
successful negotiation → relationship up
stock shortage tied to supplier → reliability down or price pressure up
consistent purchases → relationship up slightly
```

Supplier trend entries should reference existing supplier IDs only.

If supplier state does not yet connect stock IDs to supplier IDs, add a helper in supplier content:

```ts
findSuppliersForStockId(stockId: string): SupplierState[]
```

---

## 34.4 Regular Customer Weekly Routine

Requires Phase 30 regulars.

Inputs:

- service scenes involving regulars
- customer group satisfaction trend
- policies like `allow_tabs_for_regulars` or `refuse_tabs`
- social action `apologize_to_regular`
- memories involving regulars

Effects:

```txt
regular was heard/apologized to → loyalty up, irritation down
regular's group had repeated shortages → irritation up
regular's favorite order unavailable → irritation up
regular was allowed a tab → loyalty up, tab/debt risk later
```

Regular weekly trend entries should feed future issue seeds, not finished cards.

---

## 34.5 Faction Weekly Routine

Requires Phase 30 faction/customer culture expansion.

Inputs:

- customer group satisfaction/patronage
- policies that target or affect factions
- hosted faction nights
- incidents involving faction-linked groups
- rumours

Effects:

```txt
hosted faction night → faction satisfaction up
ban weapons → town watch satisfaction up, rowdy faction tension up
serve miners discount → miner faction satisfaction up, coin pressure possible
repeated brawls → town watch tension up
```

Faction trend entries should update `state.world.factions` if that branch exists.

---

## 34.6 Weekly Rumour Generation

Use service scenes from Phase 32 and memories/history from Phase 16.

Rumours should be stateful if they matter beyond the report. Store them in:

```ts
state.world.socialRumours
```

Use the canonical `SocialRumourState` shape defined in Phase 25. Do not redefine it here. Weekly community routines write into the same store that the world-state branch already validates.

Rumour examples:

```txt
- The tavern waters down ale.
- The new booths are good for private deals.
- The bouncer is rough with miners.
- The cook bought suspicious mushrooms.
- The owner apologized to Brik Tallowmug.
```

Do not generate rumour prose with card flourish. Keep it concise, structured, and debug-useful.

---

## 34.7 Weekly Report Update

Update `src/sim/modules/weekly/report.ts`.

Add a community section:

```txt
Community
- Suppliers: Brakka's Mushroom Cart improved relationship +3 after negotiation.
- Regulars: Brik Tallowmug irritation +4 after repeated ale complaints.
- Factions: Miners' Hall satisfaction +2 from discount policy.
- Rumours: "The tavern waters down ale" strength 31, partial.
```

The report should be plain and compact.

---

## 34.8 Weekly Causes and Memories

Use `ctx.addCause`, `ctx.addMemory`, and `ctx.addHistory` for meaningful trend changes.

Examples:

```ts
ctx.addCause({
  source: 'weekly.community.regular_irritation',
  sourceType: 'weekly',
  target: `regular:${regularId}.irritation`,
  targetType: 'customer',
  amount: irritationDelta,
  readable: `${regular.name} became more irritated after repeated complaints.`,
  tags: ['weekly', 'regular', 'irritation'],
  relatedActors: [{ kind: 'regular', id: regularId }],
  relatedSystems: ['weekly', 'regulars'],
})
```

Phase 27 already added `regular`, `supplier`, `faction`, `culture`, `notable_npc`, `local_event`, `rumour`, and `tavern_identity` to `CauseTargetType`. Use them directly here.

---

## 34.9 Phase 34 Tests

Create:

```txt
tests/sim/phase34.weeklyCommunity.test.ts
```

Required tests:

1. Weekly result includes `community`.
2. Weekly community result is empty-but-valid when no suppliers/regulars/factions exist.
3. Supplier relationship changes after supplier-relevant social action or shortage.
4. Regular irritation changes after repeated complaint scenes.
5. Faction satisfaction changes after a faction-targeted policy/social action.
6. Rumours are generated from notable service scenes.
7. Rumours persist in `state.world.socialRumours` if they matter beyond the report.
8. Community report includes suppliers/regulars/factions/rumours when present.
9. Weekly community changes create causes/history for meaningful deltas.
10. Existing Phase 14 weekly tests still pass.

---

## Phase 34 Acceptance Criteria

- Weekly routines update supplier, regular, faction, and rumour context.
- Weekly reports expose community changes.
- The system remains deterministic.
- Existing weekly economy/wage/maintenance behaviour remains intact.
- Community changes are structured card fuel, not cards.

---

# Phase 35 - Seasonal Arcs, Festivals, and Local Event Cycles

## Mirrors Phase 15: Monthly Routine System

## Goal

Add longer-running seasonal/local arcs that can start, progress, escalate, resolve, and feed future issue seeds.

The current monthly module already handles strategic monthly pressure:

```txt
src/sim/modules/monthly/
  index.ts
  inspection.ts
  landlord.ts
  modifiers.ts
  monthlyModule.ts
  rent.ts
  report.ts
  reputation.ts
  rival.ts
  types.ts
  upgradeReadiness.ts
```

Current monthly types already include month modifiers:

```ts
export type MonthModifierId =
  | 'rainy_month'
  | 'festival_month'
  | 'tax_month'
  | 'mold_bloom'
  | 'quiet_roads'
  | 'adventurer_season'
```

Phase 35 should not replace `MonthModifier`. It should add persistent arcs that can last across multiple weeks/months and interact with modifiers.

---

## 35.1 Add Local Arc Content Files

Use Phase 22 content structure.

Add:

```txt
src/sim/content/events/
  localArcRegistry.ts
  localArcTypes.ts
  seasonalEventRegistry.ts
  index.ts
```

If `events/` already exists from Phase 23, extend it rather than creating parallel event systems.

---

## 35.2 Local Arc Types

Create `src/sim/content/events/localArcTypes.ts`.

```ts
export type LocalArcType =
  | 'festival_approaching'
  | 'supplier_dispute'
  | 'faction_tension'
  | 'inspection_campaign'
  | 'winter_shortage'
  | 'road_danger'
  | 'religious_pilgrimage'
  | 'mining_boom'
  | 'mushroom_blight'
  | 'rival_tavern_expansion'

export type LocalArcStage =
  | 'seeded'
  | 'rising'
  | 'active'
  | 'climax'
  | 'resolved'
  | 'failed'

export type LocalArcDefinition = {
  id: string
  type: LocalArcType
  label: string
  tags: string[]
  minDurationDays: number
  maxDurationDays: number
  startConditions: LocalArcCondition[]
  progressRules: LocalArcProgressRule[]
  effects: LocalArcEffect[]
  possibleIssueSeedTags: string[]
}

export type LocalArcCondition = {
  kind:
    | 'calendar_tag'
    | 'month_modifier'
    | 'pressure_above'
    | 'reputation_axis_above'
    | 'supplier_relationship_below'
    | 'faction_tension_above'
    | 'random_weight'
  id?: string
  threshold?: number
  weight?: number
}

export type LocalArcProgressRule = {
  fromStage: LocalArcStage
  toStage: LocalArcStage
  afterDays?: number
  pressureAbove?: { pressureId: string; value: number }
  memoryTagPresent?: string
  weight?: number
}

export type LocalArcEffect = {
  kind:
    | 'pressure_delta'
    | 'market_condition'
    | 'customer_group_modifier'
    | 'supplier_modifier'
    | 'calendar_tag'
    | 'issue_seed_tag'
    | 'reputation_signal'
  id: string
  amount?: number
  tags?: string[]
}
```

---

## 35.3 Local Arc State

Store active arcs in `state.world.localEvents` from Phase 25 if that branch was created.

Recommended shape:

```ts
export type LocalArcState = {
  id: string
  definitionId: string
  type: LocalArcType
  label: string
  stage: LocalArcStage
  startedAtDay: number
  lastUpdatedDay: number
  ageDays: number
  intensity: number
  relatedRefs: EntityRef[]
  tags: string[]
  activeEffects: string[]
  history: Array<{
    day: number
    stage: LocalArcStage
    note: string
  }>
}
```

If `state.world.localEvents` currently has a different planned shape, align to it rather than forking. The important requirement is that arcs are persistent, serializable, and referenceable.

---

## 35.4 Local Arc Registry

Create `src/sim/content/events/localArcRegistry.ts`.

Starter arc definitions:

### `mushroom_blight`

Tags:

```txt
supplier, mushrooms, food, shortage, market
```

Effects:

- increase mushroom prices or reduce availability
- increase food safety/stock shortage pressure
- increase suspicious supplier offers later
- create issue seed tags: `supplier_suspicious_goods`, `stock_shortage`, `food_quality`

### `miner_payday_boom`

Type can be `mining_boom`.

Effects:

- increase miner traffic
- increase rowdy/brawl risk
- increase ale demand
- increase opportunity for miner loyalty

### `inspection_campaign`

Effects:

- increase inspection pressure
- make cleanliness/food safety scenes more important
- increase respectable reputation consequences

### `rival_tavern_expansion`

Effects:

- increase rival pressure
- target groups based on rival strategy from monthly module
- make upgrade readiness more urgent

### `festival_approaching`

Effects:

- add calendar/event tags
- increase traffic
- increase stock demand
- create preparation issue seed tags

---

## 35.5 Monthly Integration

Update `src/sim/modules/monthly/monthlyModule.ts`.

At `endMonth`, after the existing monthly resolution but before report generation:

1. Evaluate whether new arcs should start.
2. Progress existing arcs.
3. Apply arc effects to monthly result or state.
4. Record causes/history/memories for major arc changes.
5. Include active arcs in the monthly report.

Do not remove or replace existing:

- rent resolution
- landlord pressure
- inspection suspicion
- rival tavern pressure
- reputation shifts
- upgrade readiness
- month modifiers

Arcs should sit beside those systems, not swallow them like an overfed cellar mold.

---

## 35.6 Weekly Integration

Some arcs should progress weekly, not only monthly.

Options:

### Recommended Simple Approach

- Start/progress arcs monthly in Phase 35.
- Let weekly module read active arcs and include them in reports/rumours.

### More Active Approach

- Add a `weeklyArcTick()` helper called from the weekly module at `endWeek`.
- It increments `ageDays` or `intensity` for active arcs.
- Monthly module handles stage transitions.

Pick the simple approach unless there is already a Phase 30 world-hook module that can own weekly/monthly arc ticks.

---

## 35.7 Arc Effects

Initial implementation should support a small set of concrete effects:

### Pressure Delta

```txt
mushroom_blight → stock_shortage +8, food_safety +4
inspection_campaign → inspection +12
rival_tavern_expansion → reputation_drift +6
```

### Market Condition

If Phase 29 market conditions exist:

```txt
mushroom_blight → cheap_mushrooms false / mushroom_shortage true
road_danger → supplier reliability down
```

### Customer Group Modifier

If Phase 30 culture/customer extensions exist:

```txt
mining_boom → miners patronage +5 temporarily
festival_approaching → merchants/adventurers patronage +3
```

### Issue Seed Tags

Add tags to issue seed generation context, not finished seeds themselves:

```txt
activeArcTags: ['mushroom_blight', 'supplier_suspicious_goods']
```

The Phase 39 expanded issue seed work will consume this more deeply.

---

## 35.8 Arc Reports

Update `src/sim/modules/monthly/report.ts`.

Add:

```txt
Local Arcs
- Mushroom Blight: rising, intensity 42, effects stock_shortage +8, food_safety +4
- Rival Tavern Expansion: active, intensity 57, rival pressure rising
```

Weekly report may include a smaller note:

```txt
Active Local Concerns
- Mushroom Blight continues to affect stew reliability.
```

---

## 35.9 Arc Causes, Memories, and History

When arcs start, progress to a major stage, or resolve, add history.

```ts
ctx.addHistory({
  category: 'monthly',
  summary: 'Local arc started: Mushroom Blight.',
  tags: ['monthly', 'local_arc', 'mushroom_blight'],
  relatedActors: [],
  relatedLocations: [],
  relatedSystems: ['monthly', 'local_arcs', 'suppliers', 'stock'],
  mechanicalRefs: [arc.id],
})
```

Add memories only if future simulation should care:

```txt
mushroom_blight_started
inspection_campaign_active
festival_preparation_started
rival_expansion_public
```

Add causes for mechanical state changes:

```txt
source: monthly.localArc.mushroom_blight
target: pressure:stock_shortage
amount: +8
```

---

## 35.10 Prevent Arc Spam

Rules:

- Cap active arcs.
- Avoid starting the same definition twice.
- Use cooldowns after resolution.
- Avoid arcs that contradict existing active arcs unless designed to interact.

Recommended constants:

```ts
const MAX_ACTIVE_LOCAL_ARCS = 3
const ARC_REPEAT_COOLDOWN_DAYS = 56
```

Store resolved arc history either in `state.world.localEvents` or memory/history so cooldowns can be enforced.

---

## 35.11 Phase 35 Tests

Create:

```txt
tests/sim/phase35.seasonalArcs.test.ts
```

Required tests:

1. Active arcs branch is empty-but-valid on default state.
2. A qualifying monthly state can start a local arc.
3. Same seed + same state starts the same arc.
4. Active arcs progress stages over time.
5. Arc effects modify pressures or relevant state.
6. Arc start/progress creates history and causes where appropriate.
7. Monthly report includes local arcs.
8. Existing monthly rent/landlord/inspection/rival outputs still exist.
9. Arc cap prevents more than the configured maximum active arcs.
10. Duplicate active arcs are not created.

---

## Phase 35 Acceptance Criteria

- Local/seasonal arcs exist as persistent state.
- Arcs can start, progress, and resolve.
- Arcs affect existing systems modestly.
- Arcs appear in reports.
- Arcs feed future issue seed context.
- Existing monthly tests still pass.

---

# Batch-Level Implementation Order

Recommended order:

```txt
1. Phase 31 types + name generator + staff identity defaults + tests.
2. Phase 32 service scene types + builder + report + tests.
3. Phase 33 owner action categories + persistent projects/policies/social actions + tests.
4. Phase 34 weekly community result + supplier/regular/faction/rumour routines + tests.
5. Phase 35 local arc registry/state/monthly integration + tests.
```

Do not begin Phase 34 before Phase 32 and Phase 33 have at least minimal outputs, because weekly community routines need service scenes, policies, and social action records as fuel.

Do not begin Phase 35 before Phase 23 calendar tags and Phase 29 market/supplier concepts exist, because arcs need time and world context to avoid becoming free-floating lore balloons.

---

# Batch-Level Test Command

After each phase:

```bash
npm test
npm run typecheck
```

If the repo has no `typecheck` script in the current package, add one only if consistent with the existing scripts. The current uploaded package already has:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

So both commands should work.

---

# Batch-Level Done Definition

Phases 31 to 35 are complete when:

- Staff identities and deterministic names exist.
- Daily service can output structured scenes.
- Owner actions can create persistent projects, policies, and social actions.
- Weekly routines summarize and mutate community context.
- Monthly routines can manage seasonal/local arcs.
- All new persistent records are serializable and validated.
- Reports expose the new systems without turning into cards.
- Existing Phase 1 to 20 tests still pass.
- New Phase 31 to 35 tests pass.
- The game is richer, but still cardless.

At the end of Phase 35, the simulation should be able to produce named people, named conflicts, community shifts, long-running local concerns, and structured scene ingredients. That gives the future card system a pantry full of strange pickles instead of three lonely potatoes.
