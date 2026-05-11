# Goblin Tavern Simulation Expansion - Phases 22 to 25 Implementation Plan

Status: **Phase 21 complete on paper**  
Scope of this document: **Expand Phases 22 to 25 only**  
Purpose: Give an implementation agent enough detail to widen the existing simulation structure, calendar, RNG, and state model without starting cards or rewriting the completed Phase 1 to 20 foundation.

---

## Current Repo Baseline

This plan is grounded in the current finished repo structure, not a greenfield version of the game.

The current repo already has:

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

src/sim/state/
  TavernState.ts
  defaults.ts
  migrations.ts
  normalize.ts
  saveEnvelope.ts
  schemas.ts
  types.ts
  validation.ts

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

tests/sim/
  phase2.structure.test.ts
  phase3.calendar.test.ts
  phase4.rng.test.ts
  phase5.state.test.ts
  ... through phase20.cardlessPlaytest.test.ts
```

The implementation already uses:

- TypeScript with strict project settings.
- Vitest.
- `prando` for deterministic RNG.
- `zod` for schemas.
- A pure headless simulation engine at `src/sim/core/engine.ts`.
- A canonical `simulateDay(state, input, modules)` entry point.
- A fixed simulation phase list in `src/sim/core/phases.ts`.
- Runtime registries using `src/sim/registries/Registry.ts`.
- A serializable `TavernState` shape in `src/sim/state/TavernState.ts`.
- Composed validation in `src/sim/state/schemas.ts` and `src/sim/state/validation.ts`.
- Module-owned namespaced state under `state.modules`.
- Memories, causes, pressures, issue seeds, response intent previews, feedback loops, and cardless readiness reports.

Do not re-scaffold these systems. Phase 22 to 25 should add expansion seams on top of them.

---

## Phase 21 Reminder

Phase 21 established the expansion rule:

> Identity, culture, place, and relationships must become persistent simulation facts before they become card flavour.

For Phases 22 to 25 this means:

- Add structure before behaviour.
- Add calendar tags before event prose.
- Add RNG streams before name generation.
- Add state containers before staff, suppliers, regulars, or factions begin mutating them.
- Keep everything deterministic, serializable, and validation-friendly.

No finished cards are allowed in these phases.

---

# Phase 22 - Expanded Content and Domain Structure

## Mirrors Phase 2: Core Project Structure

## Goal

Add the folder, registry, and type structure needed for expansion content: naming profiles, cultures, factions, suppliers, NPCs, tavern atmosphere, local events, and text ingredients.

This phase should not add deep gameplay logic. It should create the clean domain seams that later phases can fill.

## Existing Structure To Preserve

The repo currently keeps broad gameplay systems under `src/sim/modules/*`, generic registries under `src/sim/registries/*`, and state under `src/sim/state/*`.

Phase 22 should follow that same style.

Do not create a separate parallel app structure such as:

```txt
src/world/
src/lore/
src/contentEngine/
```

That would split the simulation brain into two skulls. Keep the new work under `src/sim`.

## Required New Folder Structure

Create:

```txt
src/sim/content/
  naming/
    index.ts
    nameGenerator.ts
    namingProfiles.ts
    nameTypes.ts

  cultures/
    index.ts
    cultureRegistry.ts
    cultureTypes.ts

  factions/
    index.ts
    factionRegistry.ts
    factionTypes.ts

  npc/
    index.ts
    npcFactory.ts
    npcTypes.ts

  suppliers/
    index.ts
    supplierRegistry.ts
    supplierTypes.ts

  tavern/
    index.ts
    atmosphereTypes.ts
    upgradeTypes.ts

  events/
    index.ts
    localEventRegistry.ts
    seasonalEventRegistry.ts
    eventTypes.ts

  text/
    index.ts
    descriptors.ts
    textIngredientTypes.ts
```

Why `src/sim/content` instead of more top-level `modules`?

Because these are mostly data definitions, registries, generators, and shared domain types. They should feed modules without becoming daily simulation modules yet.

## Required Tests

Add:

```txt
tests/sim/phase22.expansionStructure.test.ts
```

This test should verify:

1. Every new `src/sim/content/*/index.ts` file imports without throwing.
2. Each registry file exports a registry object or registry-backed helper.
3. No new content file imports React, DOM APIs, Phaser, browser storage, or UI libraries.
4. No card deck, card prose, or card UI folder was introduced.
5. Existing Phase 2 to 20 tests still pass.

## Registry Pattern

The repo already has this runtime registry utility:

```ts
// src/sim/registries/Registry.ts
export type RegistryItem = {
  id: string
}

export class Registry<T extends RegistryItem> {
  register(item: T): void
  get(id: string): T
  has(id: string): boolean
  all(): T[]
  clear(): void
}
```

Use it for new registries.

Example:

```ts
// src/sim/content/cultures/cultureRegistry.ts
import { Registry } from '../../registries/Registry'
import type { CultureDefinition } from './cultureTypes'

export const cultureRegistry = new Registry<CultureDefinition>()
```

Do not invent a second registry abstraction unless the existing one is truly insufficient.

## Required Type Files

### Naming Types

Create `src/sim/content/naming/nameTypes.ts`.

Required starter types:

```ts
export type NamingProfileId = string

export type NamePartKind =
  | 'given'
  | 'family'
  | 'nickname'
  | 'title'
  | 'clan'
  | 'origin'

export type NamePattern = {
  id: string
  weight: number
  template: string
  partKinds: NamePartKind[]
  tags: string[]
}

export type NamingProfile = {
  id: NamingProfileId
  label: string
  tags: string[]
  given: string[]
  family?: string[]
  nicknames?: string[]
  titles?: string[]
  patterns: NamePattern[]
  reservedNames?: string[]
}

export type GeneratedName = {
  display: string
  profileId: NamingProfileId
  parts: Partial<Record<NamePartKind, string>>
  patternId: string
  generatedBy: string
}
```

Important: `GeneratedName` is not yet placed onto staff. That happens in later identity phases. Phase 22 only defines the shape.

### Culture Types

Create `src/sim/content/cultures/cultureTypes.ts`.

Required starter type:

```ts
import type { NamingProfileId } from '../naming/nameTypes'

export type CultureDefinition = {
  id: string
  label: string
  tags: string[]
  namingProfileId: NamingProfileId
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
}
```

The current `CustomerGroupState` already has `preferredStockTags` and `dislikedTags`. Culture definitions should complement that existing customer-group shape, not replace it.

### Faction Types

Create `src/sim/content/factions/factionTypes.ts`.

```ts
export type FactionDefinition = {
  id: string
  label: string
  tags: string[]
  cultureId?: string
  defaultRelationship: number
  pressureTags: string[]
}
```

### Supplier Types

Create `src/sim/content/suppliers/supplierTypes.ts`.

```ts
export type SupplierDefinition = {
  id: string
  label: string
  tags: string[]
  goodsProvided: string[]
  factionId?: string
  cultureId?: string
  defaultReliability: number
  defaultRelationship: number
}
```

The `goodsProvided` IDs must be intended to reference current `state.stock` keys such as `ale`, `stew`, `mushrooms`, or future stock IDs from `stockRegistry`.

### NPC Types

Create `src/sim/content/npc/npcTypes.ts`.

```ts
import type { GeneratedName } from '../naming/nameTypes'

export type NpcKind =
  | 'regular'
  | 'supplier_contact'
  | 'faction_contact'
  | 'visitor'
  | 'staff_candidate'

export type NpcIdentity = {
  id: string
  kind: NpcKind
  name: GeneratedName
  cultureId?: string
  factionId?: string
  customerGroupId?: string
  tags: string[]
}
```

### Tavern Atmosphere and Upgrade Types

Create `src/sim/content/tavern/atmosphereTypes.ts`:

```ts
export type AreaTraitId = string

export type AreaTraitDefinition = {
  id: AreaTraitId
  label: string
  tags: string[]
  affectedAreaTags: string[]
}
```

Create `src/sim/content/tavern/upgradeTypes.ts`:

```ts
export type AreaUpgradeDefinition = {
  id: string
  label: string
  areaId?: string
  areaTags?: string[]
  tags: string[]
  effects: string[]
}
```

Phase 28 will make these mechanically active. Phase 22 only prepares the content type space.

### Event Types

Create `src/sim/content/events/eventTypes.ts`:

```ts
export type SeasonalEventDefinition = {
  id: string
  label: string
  tags: string[]
  activeMonths: number[]
  activeCalendarTags: string[]
}

export type LocalEventDefinition = {
  id: string
  label: string
  tags: string[]
  relatedFactionIds?: string[]
  relatedCultureIds?: string[]
}
```

### Text Ingredient Types

Create `src/sim/content/text/textIngredientTypes.ts`:

```ts
export type TextIngredientKind =
  | 'staff'
  | 'regular'
  | 'supplier'
  | 'faction'
  | 'culture'
  | 'customer_group'
  | 'area'
  | 'stock'
  | 'calendar_tag'
  | 'market_condition'
  | 'memory'
  | 'cause'
  | 'pressure'

export type TextIngredient = {
  kind: TextIngredientKind
  id: string
  label: string
  tags: string[]
}
```

The existing issue seed system already has `textIngredients` style concepts in Phase 19. These new types are a shared vocabulary for later Phase 39 expansion, not a replacement yet.

## Barrels

Each `index.ts` should re-export only from nearby files.

Example:

```ts
export * from './nameTypes'
export * from './namingProfiles'
export * from './nameGenerator'
```

Avoid deep cross-import spiderwebs. The tavern should not become a goblin yarn wall.

## Phase 22 Acceptance Criteria

Phase 22 is complete when:

- `src/sim/content/*` folders exist.
- Each content domain has type files and `index.ts` barrels.
- New registries use the existing `Registry<T>` utility.
- No simulation behaviour changes yet.
- No `TavernState` changes are required in this phase.
- No cards are added.
- `npm run typecheck` passes.
- `npm test` passes.

---

# Phase 23 - Seasonal, Cultural, and Market Calendar Tags

## Mirrors Phase 3: Calendar and Time System

## Goal

Expand the existing calendar so it can expose structured tags for seasons, festivals, market rhythms, faction rhythms, and cultural observances.

The current calendar is simple and deterministic:

```ts
export type DayType =
  | 'supplier_day'
  | 'quiet_day'
  | 'market_day'
  | 'local_night'
  | 'payday'
  | 'brawl_night'
  | 'maintenance_day'

export type CalendarState = {
  day: number
  week: number
  month: number
  year: number
  totalDaysElapsed: number
  dayOfWeek: number
  dayType: DayType
}
```

Phase 23 should extend this without breaking the existing Day 1 to Day 28 month model.

## Required Files To Edit

```txt
src/sim/modules/calendar/types.ts
src/sim/modules/calendar/index.ts
src/sim/state/schemas.ts
src/sim/state/TavernState.ts
```

Add tests:

```txt
tests/sim/phase23.calendarTags.test.ts
```

## Required Calendar Type Additions

Edit `src/sim/modules/calendar/types.ts`.

Add:

```ts
export type SeasonId =
  | 'mudwake'
  | 'highsun'
  | 'redleaf'
  | 'deepfrost'

export type CalendarTag =
  | DayType
  | 'season_mudwake'
  | 'season_highsun'
  | 'season_redleaf'
  | 'season_deepfrost'
  | 'market_day'
  | 'supplier_day'
  | 'miner_payday'
  | 'inspection_window'
  | 'rent_due_soon'
  | 'festival_window'
  | 'mushroom_festival'
  | 'winter_shortage_risk'
  | 'road_danger_risk'
  | 'merchant_traffic'
  | 'local_crowd'

export type CalendarState = {
  day: number
  week: number
  month: number
  year: number
  totalDaysElapsed: number
  dayOfWeek: number
  dayType: DayType
  season: SeasonId
  tags: CalendarTag[]
}
```

Important: `CalendarTag` intentionally includes the existing `DayType` values so callers can query one unified list.

## Required Calendar Helpers

Edit `src/sim/modules/calendar/index.ts`.

Add helpers:

```ts
export function getSeason(month: number): SeasonId
export function getCalendarTags(calendar: Omit<CalendarState, 'tags'>): CalendarTag[]
export function hasCalendarTag(calendar: CalendarState, tag: CalendarTag): boolean
```

Suggested season mapping:

```txt
Months 1 to 3: mudwake
Months 4 to 6: highsun
Months 7 to 9: redleaf
Months 10 to 12: deepfrost
```

Suggested tag logic:

- Always include `calendar.dayType`.
- Always include `season_${calendar.season}`.
- Include `market_day` when `dayType === 'market_day'`.
- Include `supplier_day` when `dayType === 'supplier_day'`.
- Include `miner_payday` when `dayType === 'payday'`.
- Include `local_crowd` when `dayType === 'local_night'`.
- Include `inspection_window` during Week 4 of each month.
- Include `rent_due_soon` on days 22 to 28 of each month.
- Include `mushroom_festival` during Month 7, Week 2.
- Include `festival_window` whenever a specific festival tag is active.
- Include `winter_shortage_risk` in deepfrost.
- Include `road_danger_risk` in mudwake or deepfrost.
- Include `merchant_traffic` on market days and during highsun.

Keep the helper deterministic. Do not use RNG in calendar tag calculation.

## Calendar Creation And Advancement

Update `createInitialCalendar()` so initial state includes:

```ts
season: getSeason(1),
tags: getCalendarTags({ ...baseWithoutTags })
```

Update `advanceCalendar(calendar)` so every returned calendar recomputes:

```ts
season: getSeason(month),
tags: getCalendarTags(nextWithoutTags)
```

Do not mutate the input calendar. The Phase 3 test currently checks that `advanceCalendar` does not mutate its input.

## Schema Update

Edit `src/sim/state/schemas.ts`.

The current `CalendarStateSchema` validates the existing fields and dayType enum. Add:

```ts
season: z.enum(['mudwake', 'highsun', 'redleaf', 'deepfrost']),
tags: z.array(z.string()),
```

For Phase 23, `tags: z.array(z.string())` is acceptable. Do not over-tighten the schema unless all tag strings are centralized cleanly enough to avoid brittle tests.

## Migration And Default Compatibility

The current `createInitialTavernState()` calls `createInitialCalendar()`, so new saves will get the fields automatically.

However, old test objects or future loaded saves may lack `calendar.season` and `calendar.tags`.

Add a migration helper in `src/sim/state/migrations.ts` only if the existing migration structure supports it cleanly. If not, update tests and note that full save/load compatibility remains owned by the existing save envelope pathway.

Do not silently accept invalid current state in `validateState`. Validation should still catch missing calendar fields once Phase 23 is complete.

## Report Integration

The existing `getCalendarLabel(calendar)` returns:

```txt
Year 1, Month 1, Week 2, Day 9 - Quiet Day
```

Update it carefully. Keep the old human-readable date. It may append season, but should not break every report with noisy tag dumps.

Acceptable:

```txt
Year 1, Month 1, Week 2, Day 9 - Quiet Day, Mudwake
```

Avoid:

```txt
Year 1, Month 1, Week 2, Day 9 - quiet_day season_mudwake rent_due_soon road_danger_risk local_crowd merchant_traffic
```

Debug helpers can expose full tags separately.

## Phase 23 Tests

`tests/sim/phase23.calendarTags.test.ts` should verify:

1. Initial calendar has `season === 'mudwake'`.
2. Initial calendar tags include `supplier_day` and `season_mudwake`.
3. Month 4 resolves to `highsun`.
4. Month 7, Week 2 includes `mushroom_festival` and `festival_window`.
5. Deepfrost months include `winter_shortage_risk`.
6. Calendar advancement recomputes tags after month changes.
7. `hasCalendarTag` returns true and false correctly.
8. Calendar tag generation is deterministic across identical dates.
9. Existing Phase 3 tests still pass after updating expected labels if needed.

## Phase 23 Acceptance Criteria

Phase 23 is complete when:

- `CalendarState` includes `season` and `tags`.
- `createInitialCalendar()` and `advanceCalendar()` populate those fields.
- Calendar tags are deterministic and contain no RNG.
- Validation includes the new fields.
- Reports remain readable.
- No cards are added.
- `npm run typecheck` passes.
- `npm test` passes.

---

# Phase 24 - RNG Streams and Deterministic Identity Generation

## Mirrors Phase 4: Deterministic RNG and Replay

## Goal

Expand the existing deterministic RNG so different systems can use separate named streams without accidentally changing each other's outcomes.

This is especially important before name generation. A staff name should not change because the service module rolled one extra brawl chance earlier in the day. That kind of tiny butterfly becomes a goblin hurricane.

## Current RNG Baseline

The current RNG lives in `src/sim/core/rng.ts` and exposes:

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

export type SimulationRunConfig = {
  seed: string
}

export function createRng(seed: string, calls: number = 0): SimRng
```

The engine currently creates one RNG in `createContext()`:

```ts
const rng = createRng(input.seed)
```

Phase 24 should preserve this API and add streams around it.

## Required Files To Edit

```txt
src/sim/core/rng.ts
src/sim/core/context.ts
src/sim/core/engine.ts
src/sim/content/naming/nameGenerator.ts
src/sim/content/naming/namingProfiles.ts
src/sim/content/naming/nameTypes.ts
tests/sim/phase24.rngStreams.test.ts
```

## Required RNG Stream Types

Edit `src/sim/core/rng.ts`.

Add:

```ts
export type RngStreamId =
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

Add:

```ts
export type RngStreamState = Record<RngStreamId, RngState>
```

Add a stream manager type:

```ts
export type SimRngStreams = {
  baseSeed: string
  get: (streamId: RngStreamId) => SimRng
  snapshot: () => RngStreamState
}
```

## Required Stream Helper

Add:

```ts
export function createRngStreams(
  seed: string,
  initialState?: Partial<RngStreamState>,
): SimRngStreams
```

Implementation guidance:

- Each stream should derive its own seed from the base seed and stream id.
- Simple and acceptable: `${seed}:${streamId}`.
- If `initialState?.[streamId]` exists, use that stream state's `calls` value.
- Do not make stream creation consume the base RNG.
- `snapshot()` should return plain serializable `{ seed, calls }` records.

Important: The current `SimRng` mutates `rng.state.calls` internally. If `createRngStreams().get(id)` returns the same cached `SimRng` object each time, the stream will naturally preserve call counts during a day.

Suggested implementation pattern:

```ts
const cache = new Map<RngStreamId, SimRng>()

function get(streamId: RngStreamId): SimRng {
  const existing = cache.get(streamId)
  if (existing) return existing

  const prior = initialState?.[streamId]
  const streamSeed = prior?.seed ?? `${seed}:${streamId}`
  const rng = createRng(streamSeed, prior?.calls ?? 0)
  cache.set(streamId, rng)
  return rng
}
```

## Context Changes

Edit `src/sim/core/context.ts`.

Currently:

```ts
readonly rng: SimRng
```

Add without removing the old field:

```ts
readonly rngStreams: SimRngStreams
getRngStream(streamId: RngStreamId): SimRng
```

Keep `ctx.rng` as the default service/general RNG for backwards compatibility.

Recommended mapping:

```ts
ctx.rng = rngStreams.get('service')
```

This preserves old call sites while making new systems more explicit.

## Engine Changes

Edit `src/sim/core/engine.ts` inside `createContext()`.

Replace:

```ts
const rng = createRng(input.seed)
```

With:

```ts
const rngStreams = createRngStreams(input.seed)
const rng = rngStreams.get('service')
```

Then expose both on the context object.

Do not thread stream state into `TavernState` yet unless there is already a clear save/load requirement. In the current engine, each day receives `input.seed`, creates the RNG, and runs that day. Phase 24 only needs deterministic isolation. Persistent cross-day stream snapshots can be added later if card-facing identity generation needs save-resume exactness across partially executed days.

## Name Generator Starter

Phase 24 should add a simple deterministic name generator, but it should not yet attach names to staff or state.

Edit `src/sim/content/naming/namingProfiles.ts`.

Register a very small starter set:

```ts
export const STARTER_NAMING_PROFILES: NamingProfile[] = [
  {
    id: 'goblin_common',
    label: 'Goblin Common',
    tags: ['goblin', 'short', 'sharp'],
    given: ['Nib', 'Grib', 'Snit', 'Brakka', 'Nesk', 'Gribna'],
    family: ['Cracket', 'Sootspoon', 'Tallowmug', 'Bentnail'],
    nicknames: ['the Quick', 'Mug-Biter', 'Stool-Kicker'],
    patterns: [
      {
        id: 'given_family',
        weight: 8,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_nickname',
        weight: 2,
        template: '{given} {nickname}',
        partKinds: ['given', 'nickname'],
        tags: ['informal'],
      },
    ],
  },
]
```

Use a registry or exported array consistently. Since Phase 22 created the content registry pattern, prefer a `namingProfileRegistry` if implemented.

Edit `src/sim/content/naming/nameGenerator.ts`.

Required function:

```ts
import type { SimRng } from '../../core/rng'
import type { GeneratedName, NamingProfile } from './nameTypes'

export function generateName(
  profile: NamingProfile,
  rng: SimRng,
  generatedBy: string,
): GeneratedName
```

Rules:

- Pick a pattern by `weight`.
- Pick required parts from the profile arrays.
- Fill the template.
- Return `GeneratedName` with `display`, `profileId`, `parts`, `patternId`, and `generatedBy`.
- Throw clear errors if a selected pattern asks for a missing part pool.
- Do not generate names with `Math.random()`.
- Do not write generated names to `TavernState` yet.

## Phase 24 Tests

Add `tests/sim/phase24.rngStreams.test.ts`.

Test these behaviours:

1. Same seed and same stream produces same sequence.
2. Same seed and different streams produce different sequences.
3. Calls in `service` stream do not affect `names` stream.
4. `snapshot()` returns serializable stream state with call counts.
5. Recreating streams from a snapshot resumes call counts correctly.
6. `ctx.rng` still works in existing simulation modules.
7. `ctx.getRngStream('names')` works inside a minimal test module.
8. `generateName()` produces the same name for same seed and stream.
9. `generateName()` changes when using a different stream or seed.
10. Existing Phase 4 tests still pass.

## Example Minimal Test Module

Use the current module contract:

```ts
const testModule: SimulationModule = {
  id: 'rng_stream_probe',
  version: '0.1.0',
  hooks: {
    startDay: [
      (ctx) => {
        const names = ctx.getRngStream('names')
        const service = ctx.rng
        ctx.addLog({
          level: 'info',
          message: 'rng stream probe',
          data: {
            nameRoll: names.int(1, 100),
            serviceRoll: service.int(1, 100),
          },
        })
      },
    ],
  },
}
```

Run this through `simulateDay()` with `createInitialTavernState()`.

## Phase 24 Acceptance Criteria

Phase 24 is complete when:

- `createRng()` still works exactly as before.
- `createRngStreams()` exists and isolates named streams.
- `SimContext` exposes `rngStreams` and `getRngStream()`.
- `ctx.rng` remains backward compatible.
- A deterministic `generateName()` helper exists.
- Name generation uses the `names` or identity-specific RNG stream in tests.
- No generated names are attached to staff yet.
- No cards are added.
- `npm run typecheck` passes.
- `npm test` passes.

---

# Phase 25 - Expanded World and Social State Model

## Mirrors Phase 5: Base Tavern State Model

## Goal

Add serializable state containers for the wider tavern world: cultures, factions, suppliers, regulars, notable NPCs, local events, tavern identity, social rumours, and optional RNG stream snapshots.

This phase creates the state pantry. Later phases will stock it with actual onions, grudges, mushroom cartels, and named people.

## Current State Baseline

The current `TavernState` shape is:

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

Phase 25 should add `world` as a new top-level branch, not bury everything under `modules`.

Reason: these are long-lived core simulation facts, not one module's private scratchpad.

## Required Files To Edit

```txt
src/sim/state/TavernState.ts
src/sim/state/defaults.ts
src/sim/state/schemas.ts
src/sim/state/normalize.ts
src/sim/state/migrations.ts, only if needed
src/sim/core/context.ts, only if adding helper accessors now
tests/sim/phase25.expandedState.test.ts
```

## Required World State Types

Edit `src/sim/state/TavernState.ts`.

Add:

```ts
import type { GeneratedName, NamingProfileId } from '../content/naming/nameTypes'
import type { RngStreamState } from '../core/rng'
```

If importing content types into state creates an import cycle, move the plain shared identity types into `src/sim/state/identityTypes.ts` or keep the state-side versions structurally duplicated. Prefer no cycles over perfect reuse.

Add these types:

```ts
export type CultureWorldState = {
  id: string
  label: string
  familiarity: number
  comfort: number
  tension: number
  namingProfileId: NamingProfileId
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
  tags: string[]
}

export type FactionWorldState = {
  id: string
  label: string
  relationship: number
  influence: number
  suspicion: number
  cultureId?: string
  tags: string[]
  activeFlags: string[]
}

export type SupplierWorldState = {
  id: string
  name?: GeneratedName
  label: string
  supplierType: string
  reliability: number
  relationship: number
  debtTolerance: number
  priceBias: number
  goodsProvided: string[]
  factionId?: string
  cultureId?: string
  lastDeliveryDay?: number
  tags: string[]
  activeFlags: string[]
}

export type RegularWorldState = {
  id: string
  name: GeneratedName
  customerGroupId: string
  cultureId?: string
  factionId?: string
  loyalty: number
  irritation: number
  visits: number
  favoriteStockId?: string
  firstSeenDay: number
  lastSeenDay: number
  knownIncidentIds: string[]
  tags: string[]
  activeFlags: string[]
}

export type NotableNpcWorldState = {
  id: string
  name: GeneratedName
  kind: string
  cultureId?: string
  factionId?: string
  customerGroupId?: string
  firstSeenDay: number
  lastSeenDay?: number
  tags: string[]
  activeFlags: string[]
}

export type LocalEventWorldState = {
  id: string
  definitionId: string
  label: string
  startedDay: number
  endsDay?: number
  intensity: number
  relatedFactionIds: string[]
  relatedCultureIds: string[]
  tags: string[]
  activeFlags: string[]
}

export type TavernIdentityState = {
  foundingDay: number
  knownFor: string[]
  houseRules: string[]
  atmosphereTags: string[]
}

export type SocialRumourState = {
  id: string
  label: string
  strength: number
  accuracy: 'true' | 'partial' | 'false' | 'unknown'
  sourceEntityId?: string
  targetEntityId?: string
  firstHeardDay: number
  lastSpreadDay: number
  tags: string[]
}

export type WorldState = {
  cultures: Record<string, CultureWorldState>
  factions: Record<string, FactionWorldState>
  suppliers: Record<string, SupplierWorldState>
  regulars: Record<string, RegularWorldState>
  notableNpcs: Record<string, NotableNpcWorldState>
  localEvents: Record<string, LocalEventWorldState>
  tavernIdentity: TavernIdentityState
  socialRumours: Record<string, SocialRumourState>
  rngStreams?: Partial<RngStreamState>
}
```

Then update `TavernState`:

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

  world: WorldState

  memories: MemoryState[]
  history: HistoryEntry[]
  causes: CauseEntry[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
```

## EntityRef Expansion

The current `EntityRef.kind` supports:

```ts
| 'staff'
| 'customer_group'
| 'area'
| 'stock'
| 'role'
| 'system'
| 'other'
```

Add:

```ts
| 'culture'
| 'faction'
| 'supplier'
| 'regular'
| 'notable_npc'
| 'local_event'
| 'rumour'
```

Then update `EntityRefSchema` in `src/sim/state/schemas.ts` to match.

This makes memories and causes able to point at the new world entities in later phases.

## Default World State

Edit `src/sim/state/defaults.ts`.

Add:

```ts
function createInitialWorldState(): WorldState {
  return {
    cultures: {},
    factions: {},
    suppliers: {},
    regulars: {},
    notableNpcs: {},
    localEvents: {},
    tavernIdentity: {
      foundingDay: 0,
      knownFor: [],
      houseRules: [],
      atmosphereTags: [],
    },
    socialRumours: {},
  }
}
```

Then include in `createInitialTavernState()`:

```ts
world: createInitialWorldState(),
```

Do not seed actual cultures, factions, suppliers, or regulars yet unless Phase 22 registries already have starter definitions and the tests need a tiny known fixture. Empty but valid containers are acceptable and preferred for Phase 25.

## Schema Additions

Edit `src/sim/state/schemas.ts`.

Add reusable helpers if useful:

```ts
const stringArray = () => z.array(z.string())
const optionalString = () => z.string().optional()
```

Add schemas matching the new state types.

Important meter fields should use the existing `meter()` helper:

- `familiarity`
- `comfort`
- `tension`
- `relationship`
- `influence`
- `suspicion`
- `reliability`
- `debtTolerance`
- `loyalty`
- `irritation`
- `intensity`
- `strength`

`priceBias` may be a normal number because it can reasonably be negative, neutral, or positive.

For `GeneratedName`, add:

```ts
export const GeneratedNameSchema = z.object({
  display: z.string(),
  profileId: z.string(),
  parts: z.record(z.string(), z.string()).partial().or(z.record(z.string(), z.string())),
  patternId: z.string(),
  generatedBy: z.string(),
})
```

If Zod 4 complains about the `parts` expression, keep it simple:

```ts
parts: z.record(z.string(), z.string()),
```

Then add `WorldStateSchema` to `buildTavernStateSchema()`:

```ts
world: WorldStateSchema,
```

## Normalization

Edit `src/sim/state/normalize.ts`.

Add `normalizeWorldState(state.world)` only for numeric meter fields.

Do not normalize IDs, tags, names, or relationships by inventing missing records.

Acceptable:

```ts
relationship: clampPercent(faction.relationship)
```

Not acceptable:

```ts
if (!regular.name) regular.name = generateName(...)
```

Normalization clamps numbers. It must not create simulation truth.

## Migration Guidance

If existing save migration helpers are already active, add a migration that inserts `world: createInitialWorldState()` when missing.

If migrations are placeholders, do not build a whole save migration framework just for Phase 25. Instead, keep the default factory and schemas correct and add a note in `src/sim/state/migrations.ts` that older pre-Phase-25 saves must receive the default `world` branch during save-envelope loading.

## Context Helpers Optional

Do not add a large world mutation API yet. That belongs in later behaviour phases.

Optional read helpers may be added to `SimContext` only if tests need them:

```ts
getWorldCulture(id: string): CultureWorldState | undefined
getWorldFaction(id: string): FactionWorldState | undefined
getWorldSupplier(id: string): SupplierWorldState | undefined
getRegular(id: string): RegularWorldState | undefined
```

Avoid write helpers until Phase 26 or later validation/mutation rules are defined.

## Phase 25 Tests

Add `tests/sim/phase25.expandedState.test.ts`.

Test these behaviours:

1. `createInitialTavernState()` includes `world`.
2. Every world branch exists and defaults to an empty record except `tavernIdentity`.
3. `tavernIdentity` defaults to serializable empty arrays and `foundingDay: 0`.
4. `cloneTavernState()` deep-clones `world`.
5. `JSON.stringify()` and parse roundtrip preserve the new state shape.
6. `safeValidateState(createInitialTavernState())` succeeds.
7. Invalid world meter values fail validation.
8. `EntityRefSchema` accepts `supplier`, `regular`, `faction`, and `culture` refs.
9. Existing Phase 5 tests still pass after updating expected top-level keys.
10. Existing Phase 16 to 20 tests still pass, proving the new state branch does not disturb memories, causes, pressures, or issue seeds.

## Phase 25 Acceptance Criteria

Phase 25 is complete when:

- `TavernState` has a top-level `world` branch.
- `WorldState` is fully serializable.
- `createInitialTavernState()` seeds valid default world state.
- Zod schemas validate the new branch.
- Entity refs support future world entities.
- Normalization clamps world meter fields without inventing records.
- No generated identities are created yet unless explicitly done by tests using Phase 24 helpers.
- No cards are added.
- `npm run typecheck` passes.
- `npm test` passes.

---

# Cross-Phase Implementation Order

Recommended order for an agent:

1. **Phase 22:** Add `src/sim/content/*` structure, starter types, barrels, and registries.
2. **Phase 23:** Extend calendar state with season and tags.
3. **Phase 24:** Add RNG streams and deterministic name generator helper.
4. **Phase 25:** Add top-level `world` state and validation.

This order matters because:

- Phase 25 can reference Phase 22 identity and content types.
- Phase 24 can use Phase 22 naming profiles.
- Phase 23 creates calendar tags that Phase 25 world records can reference.
- Later Phases 26 to 31 can validate, mutate, and populate these structures.

---

# Non-Goals For Phases 22 To 25

Do not implement:

- finished cards
- card decks
- card UI
- final narrative prose
- active faction behaviour
- active supplier delivery behaviour
- active regular customer spawning
- staff identity replacement
- staff personality mechanics
- area trait mechanics
- local event arcs
- rumour spread logic
- social attribution logic

Those belong to later phases.

These four phases are foundation work. The tavern gets more shelves, labels, jars, and a better calendar nailed to the wall. The goblins start moving in later.

---

# Final Readiness Check

After Phase 25, the repo should still be a working cardless simulation, but now with expansion-grade seams:

- Content domains exist under `src/sim/content`.
- Calendar exposes structured tags.
- RNG has isolated named streams.
- Name generation is deterministic but not yet attached to state.
- State has a serializable `world` branch.
- Memories and causes can later reference world entities.
- Existing modules still run.
- Existing readiness reports still run.
- No card content has been written.

The next batch, Phases 26 to 30, should focus on validating these new structures, adding expansion hooks, enriching areas, adding suppliers and market variety, and connecting cultures/customer groups to the new identity scaffolding.
