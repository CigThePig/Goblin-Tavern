# Cards Contract — What Cards Read, What Cards Write, How Cards Are Shaped

**Status:** locked contract. Per-phase card plans (phase 87 onward) reference this document instead of restating it.

This document is the bridge between the headless simulation (phases 1–86, complete) and the card layer (not yet built). It is the analogue of [`phase-21-expansion-contract.md`](./phase-21-expansion-contract.md) and [`rare-ingredients-economy.md`](./rare-ingredients-economy.md): the rules are fixed here, the implementation plans pick them up.

Cards do not exist yet. When they do, they will be built against the shapes documented below. Implementation choices that this contract intentionally defers (where the card registry lives, the exact card-selection algorithm, the rendering target) are listed in section 9 — they belong in the first card-layer phase plan.

---

## 1. The Core Rule

> **The simulation is the source of truth. Cards reveal, interpret, escalate, or resolve simulation truth — cards must not invent truth.**

A card **may**:

- Read any field of `TavernState`.
- Read any `ReportSection` produced by `simulateDay`.
- Read any `IssueSeed` from `state.modules.issueSeeds.seedsToday` or from the `issue_seeds` report section.
- Read `StateDiff`s, `CauseEntry`s, `AttributionState`s, `MemoryState`s, `PressureState`s, and `PressureSnapshot`s.
- Submit a `ResponseIntent` (or an `OwnerActionInput`, or a `staffPriorities` map) on the next call to `simulateDay`.
- Compose presentation prose from the seed's `textIngredients` and from the deterministic descriptor pools in `src/sim/content/text/descriptors.ts`.

A card **may not**:

- Mutate any field of state directly.
- Contradict any fact already in state (e.g. claim a customer is angry when their satisfaction is high, claim a regular's name when state holds a different `GeneratedName`).
- Invent actors, locations, factions, suppliers, NPCs, regulars, events, or memories. Reference by `EntityRef` only.
- Call `Math.random()` or read wall-clock time. Use the seed id as a stable key for any deterministic pick.
- Bypass `SeedValidation` — seeds with `validation.valid === false` are never presented.
- Reach for the DOM, network, or globals from card logic. Cards are pure functions over `(seed, state)`.

The card layer's mutation channel is `SimInput`. Nothing else.

---

## 2. The Engine Entry Point

```ts
// src/sim/core/engine.ts:1460
export function simulateDay(
  state: TavernState,
  input: SimInput,
  modules: ReadonlyArray<SimulationModule>,
): SimResult
```

**Input** — `SimInput` (`src/sim/core/context.ts:62`):

```ts
export type SimInput = {
  seed: string
  ownerActions?: ReadonlyArray<SimInputOwnerAction>
  staffPriorities?: Record<string, string>
  responseIntents?: ReadonlyArray<ResponseIntent>
}
```

**Output** — `SimResult` (`src/sim/core/result.ts:15`):

```ts
export type SimResult = {
  state: TavernState
  reports: ReportSection[]
  logs: SimLog[]
  validation: ValidationSummary
  diffs: TaggedStateDiff[]
}
```

The full pipeline (`SIMULATION_PHASES` in `src/sim/core/phases.ts:60`) is fixed at 25 phases, in order:

```
startDay → identityGeneration → applyDayTypeModifiers
  → cultureUpdate → supplierUpdate → factionUpdate
  → regularCustomerUpdate → localEventUpdate → rumourUpdate
  → forecastTraffic
  → beforeOwnerActions → applyOwnerActions → afterOwnerActions
  → assignStaffPriorities
  → beforeService → service → afterService
  → closing
  → applyResponses
  → endDay → endWeek → endMonth
  → generateReports → validate → advanceCalendar
```

Three slots cards care about:

- `applyOwnerActions` consumes `SimInput.ownerActions`.
- `applyResponses` consumes `SimInput.responseIntents` (the unified response pipeline from Phase 41 / ISSUE-001).
- `generateReports` produces `SimResult.reports`. The `issue_seeds` section is the card-facing surface; its `data.seeds` is the day's `IssueSeed[]`.

The `beforeOwnerActions → applyOwnerActions → afterOwnerActions → assignStaffPriorities → beforeService → service → afterService` block is a locked Phase 13 contract — cards must not assume any reordering.

`endWeek` and `endMonth` only run on the last day of the calendar week/month respectively; otherwise they are skipped (`engine.ts:1489`).

---

## 3. What Cards Read — Output Reference

### 3.1 TavernState

The durable world. Top-level shape (`src/sim/state/TavernState.ts:685`):

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

  recipes: Record<string, RecipeState>
  expeditions: ExpeditionsState

  world: WorldState

  memories: MemoryState[]
  history: HistoryEntry[]
  causes: CauseEntry[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
```

Cards usually pull state into the render function via:

```ts
render(seed: IssueSeed, state: TavernState): CardView
```

State is plain JSON — no classes, no Maps, no functions, no circular refs. A card may safely structural-clone it.

### 3.2 ReportSection

Per-module structured output (`src/sim/core/reports.ts:10`):

```ts
export type ReportSection = {
  id: string
  source: string
  title: string
  lines: string[]
  data?: Record<string, unknown>
}
```

Stable section ids cards look for: `issue_seeds`, `pressures`, `memories`, `causes`, `areas`, `stock`, `staff`, `customers`, `reputation`, `economy`, `owner_actions`, `service`, `weekly`, `monthly`, `world`, `attribution`, `expeditions`, `recipes`. Each module owns its id. The `data` payload carries typed structured content (e.g. the issue seed report's `data.seeds: IssueSeed[]`); the `lines` array is a debug-friendly human dump.

### 3.3 IssueSeed — the primary card surface

`src/sim/modules/issues/issueSeedTypes.ts:253`:

```ts
export type IssueSeed = {
  id: string
  family: IssueSeedFamilyId | string
  type: IssueSeedType
  domain: string[]
  timing: IssueSeedTiming

  severity: number
  urgency: number
  novelty: number
  cardWorthiness: number

  location?: EntityRef
  primaryActor?: EntityRef
  affectedActors: EntityRef[]

  causes: CauseEntry[]
  pressures: PressureSnapshot[]
  stakes: StakeRef[]

  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]

  memoriesCreated: MemoryDraft[]
  futureHooks: MemoryDraft[]

  toneHints: string[]
  textIngredients: TextIngredients

  validation: SeedValidation
  generatedAt: CalendarStamp
}
```

`IssueSeedTiming` — the five card timing slots (`issueSeedTypes.ts:19`):

```
morning_prep | during_service | closing | end_week | end_month
```

`IssueSeedType` — the 18 seed types (`issueSeedTypes.ts:29`). Card archetype for each:

| Seed type | Card archetype |
|---|---|
| `crisis` | Immediate, high-severity, "do something now" |
| `complaint` | Relational, satisfy-or-suffer |
| `opportunity` | Gain-shaped, optional |
| `warning` | Delayed risk, repair-or-pay-later |
| `staff_request` | Internal, personnel-driven |
| `supplier_offer` | Market, deal-with-an-NPC |
| `maintenance_problem` | Premises, condition decay |
| `customer_incident` | In-service event, surface-and-respond |
| `reputation_shift` | Trend reveal, no immediate fork |
| `debt_pressure` | Calendar/finance |
| `inspection_threat` | External authority |
| `monthly_review` | Strategic summary, low immediacy |
| `relationship_test` | Faction/regular relationship moment |
| `social_conflict` | Cross-group tension |
| `policy_reaction` | Consequence of a standing policy |
| `festival_preparation` | Arc/seasonal readiness |
| `rumour` | Misinformation surface |
| `arc_milestone` | Local arc transition |

`IssueSeedFamilyId` (`issueSeedTypes.ts:52`) — 20 families. **Core (10):** `food_safety`, `stock_shortage`, `maintenance`, `staff_burnout`, `customer_complaint`, `violence`, `debt_rent`, `inspection`, `reputation_shift`, `monthly_review`. **Expanded (10):** `staff_identity`, `regular_customer`, `supplier_relationship`, `faction_request`, `culture_conflict`, `area_atmosphere`, `seasonal_arc`, `policy_backlash`, `rumour_crisis`, `rival_tavern`.

`StakeRef` (`issueSeedTypes.ts:154`):

```ts
export type StakeRef = {
  id: string
  target: string
  readable: string
  direction: 'loss' | 'gain' | 'risk'
  tags: string[]
}
```

`ResponseSlot` (`issueSeedTypes.ts:166`):

```ts
export type ResponseSlot = {
  id: string
  labelHint: string
  allowedVerbs: ResponseIntentVerb[]
  shape: ResponseIntentShape
  targetOptions: EntityRef[]
  expectedEffects: string[]
  requiredTags?: string[]
}
```

`ConsequenceProfile` (`issueSeedTypes.ts:180`):

```ts
export type ConsequenceProfile = {
  id: string
  responseSlotId: string
  immediateEffects: EffectPreview[]
  delayedEffects: EffectPreview[]
  memories: MemoryDraft[]
  futureHooks: MemoryDraft[]
  impactScore: number
}
```

`EffectPreview` (`src/sim/core/effect.ts:16`):

```ts
export type EffectPreview = {
  kind: 'state_change' | 'memory' | 'future_hook' | 'cause' | 'pressure'
  target: string
  amount?: number
  readable: string
  tags: string[]
}
```

`TextIngredients` (`issueSeedTypes.ts:220`) — short structured fragments, not card prose:

```ts
export type TextIngredients = {
  subject: string
  problemNoun?: string
  sensoryDetails: string[]
  actorOpinions: Record<string, string>
  recentContext: string[]
  stakesReadable: string[]

  namedEntities?: NamedEntityIngredient[]
  socialContext?: string[]
  relevantMemories?: string[]
  perceivedBlame?: string[]
  pressureContext?: string[]
  calendarContext?: string[]
  marketContext?: string[]
  arcContext?: string[]
}
```

`TEXT_INGREDIENT_LIMITS` (`issueSeedTypes.ts:194`) — strict per-field budgets cards must honour when composing:

```ts
sensoryDetails:    { maxEntries: 3, maxWordsPerEntry: 6 }
actorOpinions:     { maxEntries: 2, maxWordsPerEntry: 8 }
recentContext:     { maxEntries: 3, maxWordsPerEntry: 10 }
stakesReadable:    { maxEntries: 3, maxWordsPerEntry: 12 }
problemNoun:       { maxEntries: 1, maxWordsPerEntry: 4 }
subject:           { maxEntries: 1, maxWordsPerEntry: 4 }
namedEntities:     { maxEntries: 4, maxWordsPerEntry: 5 }
socialContext:     { maxEntries: 3, maxWordsPerEntry: 10 }
relevantMemories:  { maxEntries: 3, maxWordsPerEntry: 10 }
perceivedBlame:    { maxEntries: 2, maxWordsPerEntry: 12 }
pressureContext:   { maxEntries: 3, maxWordsPerEntry: 10 }
calendarContext:   { maxEntries: 2, maxWordsPerEntry: 8 }
marketContext:     { maxEntries: 2, maxWordsPerEntry: 8 }
arcContext:        { maxEntries: 2, maxWordsPerEntry: 10 }
```

`SeedValidation` (`issueSeedTypes.ts:240`):

```ts
export type SeedValidation = {
  valid: boolean
  errors: string[]
  warnings: string[]
  contractChecks: Record<string, boolean>
}
```

Cards filter out `seed.validation.valid === false` before rendering. Warnings are non-blocking but should be surfaced in dev tooling.

**Signal-backed vs flavor-seed fields (Phase 127 / ISSUE-096 — Voiced Surface, Phase 1).** The fields above split into two contractual roles, declared as data on `TEXT_INGREDIENT_ROLE: Record<keyof TextIngredients, 'signal-backed' | 'flavor-seed'>` next to `TEXT_INGREDIENT_LIMITS`. **Signal-backed** fields (`recentContext`, `pressureContext`, `marketContext`, `perceivedBlame`) carry numbers / classifications whose underlying truth lives on `TavernState`; a `sim_backed` slot must NOT read them as truth — it must query the read-only signal surface at `src/sim/signals/` (`querySignal`, `repeatCountByTag`, `pressureTrend`, …) so the sim-coherence gate can validate the claim. The fields remain present for validation, legacy templates, and debugging. **Flavor-seed** fields (`sensoryDetails`, `actorOpinions`, `socialContext`, `relevantMemories`, `calendarContext`, `arcContext`, plus the structural / referential `subject`, `problemNoun`, `stakesReadable`, `namedEntities`) are sensory or labelling fragments a `flavor` slot may borrow as decoration; they make no checkable sim claim. The Phase 127 contract test asserts the map is exhaustive over `keyof TextIngredients`.

### 3.4 Diffs and Causes

`StateChange` / `StateDiff` / `TaggedStateDiff` (`src/sim/core/diff.ts:32`):

```ts
export type StateChange = {
  path: string
  before: unknown
  after: unknown
  delta?: number
  readable: string
  tags: string[]
  source?: string
}

export type StateDiff = {
  changes: StateChange[]
  significantChanges: StateChange[]
}

export type PhaseBoundary = 'day'   // collapsed in Phase 76 from earlier multi-boundary design

export type TaggedStateDiff = StateDiff & { boundary: PhaseBoundary }
```

`DEFAULT_THRESHOLDS` for the significant-change filter (`diff.ts:65`): meter 5, coin 5, stockQuantity 5, reputation 5, pressure 5. Anything below those thresholds is in `changes` but not in `significantChanges`.

`CauseEntry` (`src/sim/state/TavernState.ts:403`):

```ts
export type CauseEntry = {
  id: string
  timestamp: CalendarStamp
  source: string
  sourceType: CauseSourceType
  target: string
  targetType: CauseTargetType
  amount: number
  direction: 'increase' | 'decrease' | 'neutral'
  weight: number
  readable: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  ageDays: number
  expiresAfterDays?: number
}
```

Use `state.causes` (the array) for raw lookup, or `seed.causes` for the causes the seed-generator chose to surface.

### 3.5 Attributions vs. Causes

Different things, both important:

- `CauseEntry` (in `state.causes`) records **what actually happened** — the sim's truth about why a value changed.
- `AttributionState` (`src/sim/modules/attribution/attributionTypes.ts:27`) records **what an in-world entity thinks happened**:

```ts
export type AttributionState = {
  id: string
  timestamp: CalendarStamp
  sourceEventId?: string
  sourceCauseIds: string[]
  sourceMemoryIds: string[]
  sourceSceneIds: string[]

  perceivedBy: EntityRef
  target: EntityRef
  attributionType: 'credit' | 'blame' | 'suspicion' | 'gratitude' | 'resentment' | 'trust' | 'distrust'
  accuracy: 'true' | 'partial' | 'false' | 'unknown'

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
```

Attributions live at `state.modules.attribution.attributions`. Cards that show **blame, gratitude, suspicion, or rumour** must read attributions. The gap between cause and attribution — accurate truth vs. perceived truth — is intentional flavour material; a card can surface a `false` attribution and let the player feel the misunderstanding.

### 3.6 Memories, History, Pressures

`MemoryState` (`TavernState.ts:301`):

```ts
export type MemoryType = 'fact' | 'timed' | 'grudge' | 'pattern' | 'future_hook'

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

`HistoryEntry` (`TavernState.ts:334`) — append-only timeline:

```ts
export type HistoryEntry = {
  id: string
  timestamp: CalendarStamp
  category: 'owner_action' | 'service' | 'weekly' | 'monthly' | 'state_change' | 'memory' | 'pressure' | 'system'
  summary: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  mechanicalRefs?: string[]
}
```

`PressureState` (`TavernState.ts:425`) — compact on-state shape:

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

`PressureSnapshot` (`src/sim/modules/pressures/pressureTypes.ts:127`) — rich shape in `state.modules.pressures.snapshots[id]`:

```ts
export type PressureSnapshot = {
  id: string
  label: string
  value: number
  previousValue: number
  delta: number
  trend: 'rising' | 'stable' | 'falling'
  severity: number
  urgency: number
  volatility: number
  causes: PressureCauseRef[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  tags: string[]
  consequences: string[]
  lastUpdated: CalendarStamp
}
```

Canonical pressure ids — **core (10):** `food_safety`, `inspection`, `staff_burnout`, `pests`, `debt`, `maintenance`, `violence`, `reputation_drift`, `stock_shortage`, `landlord`. **Expanded (11):** `supplier_distrust`, `regular_customer_loss`, `staff_loyalty_risk`, `faction_anger`, `cultural_tension`, `rival_tavern_pressure`, `festival_readiness`, `market_instability`, `rumour_pressure`, `policy_backlash`, `arc_escalation`.

### 3.7 World identity — persistent named entities

Reference by id, never regenerate. All under `state.world`:

- `CultureWorldState` (`TavernState.ts:439`) — familiarity / comfort / tension meters, naming profile, preferred/disliked stock tags.
- `FactionWorldState` (`TavernState.ts:452`) — relationship / influence / trust / fear meters.
- `SupplierWorldState` (`TavernState.ts:464`) — `name?: GeneratedName`, reliability, relationship, debt tolerance, price bias, last delivery day.
- `RegularWorldState` (`TavernState.ts:481`) — `name: GeneratedName`, loyalty, irritation, visits, favorite stock, `firstSeenDay`, `lastSeenDay`, `knownIncidentIds`.
- `NotableNpcWorldState` (`TavernState.ts:498`) — `name: GeneratedName`, kind, faction/culture/customer-group pointers.
- `LocalEventWorldState` (`TavernState.ts:629`) — includes optional Phase-35 arc fields (`stage`, `arcHistory`, `activeEffects`).
- `SocialRumourState` (`TavernState.ts:657`) — `strength`, `accuracy`, source/target entity pointers, spread timestamps.
- `TavernIdentityState` (`TavernState.ts:650`) — `foundingDay`, `knownFor`, `houseRules`, `atmosphereTags`.
- `HireableAdventurer` (`TavernState.ts:588`) — `name: GeneratedName`, `experience`, `reliability`, `relationship`, `specialty`, `wageBase`, `currentExpeditionId`.

### 3.8 Generated names

`GeneratedName` (`src/sim/content/naming/nameTypes.ts:40`):

```ts
export type GeneratedName = {
  display: string
  profileId: NamingProfileId
  parts: Partial<Record<NamePartKind, string>>
  patternId: string
  generatedBy: string
}
```

Cards display `name.display`. For narrative use, `name.parts` exposes `given`, `family`, `nickname`, `title`, `clan`, `origin` — pick the appropriate part rather than tokenising `display`.

Names are generated **once at creation** via named RNG streams (`npc_identity`, `staff_identity`, `supplier_identity`, etc., from `ctx.getRngStream`) and stored on state. Cards must never re-derive a name from RNG.

### 3.9 Entity references

`EntityRef` (`TavernState.ts:271`):

```ts
export type EntityRef = {
  kind:
    | 'staff' | 'customer_group' | 'area' | 'stock'
    | 'role' | 'system' | 'other'
    | 'culture' | 'faction' | 'supplier' | 'regular' | 'notable_npc'
    | 'local_event' | 'rumour' | 'tavern_identity' | 'recipe'
  id: string
}
```

This is the canonical reference shape everywhere — memories, causes, attributions, seed actors, seed locations, response targets. Cards that emit a `ResponseIntent` with `targetId` must use an id that already exists in state under the matching `kind`.

### 3.10 Text ingredient pools

`src/sim/content/text/descriptors.ts` — deterministic fragment pools for card composition. Cards SHOULD use these instead of hardcoded adjectives.

```ts
SEVERITY_ADJECTIVES: Record<'low' | 'medium' | 'high', readonly string[]>
AREA_STATE_ADJECTIVES: Record<'dirty' | 'damaged' | 'clean' | 'smelly' | 'risky', readonly string[]>
FACTION_RELATION_NOUNS: Record<'cooperation' | 'tension' | 'rivalry' | 'truce' | 'feud', readonly string[]>

function severityTier(severity: number): 'low' | 'medium' | 'high'
function pickSeverityAdjective(severity: number, key: string): string
function pickAreaStateAdjective(condition: AreaConditionKey, key: string): string
function pickFactionRelationNoun(relation: FactionRelationKey, key: string): string
```

The pickers use an FNV-1a hash of `key` to choose a fragment from the matching pool. **Same key ⇒ same fragment**, so re-rendering a card produces stable text. Cards typically pass the seed id as `key`.

### 3.11 Owner-action ledger

`state.modules.ownerActions` carries the day's `applied[]`, `rejected[]`, plus persistent `projects[]`, `policies[]`, and `recentSocialActions[]`. Shape lives at `src/sim/modules/ownerActions/types.ts:133`. Cards that mention historic owner moves ("you started rebuilding the kitchen six days ago") read this slice and never invent the timeline.

---

## 4. What Cards Write — Input Reference

### 4.1 SimInput — the three input channels

```ts
// src/sim/core/context.ts:62
export type SimInput = {
  seed: string
  ownerActions?: ReadonlyArray<SimInputOwnerAction>
  staffPriorities?: Record<string, string>
  responseIntents?: ReadonlyArray<ResponseIntent>
}
```

- `ownerActions: SimInputOwnerAction[]` — up to 3 action points per day; the engine rejects overflow. Shape from `src/sim/core/context.ts:55` and `src/sim/modules/ownerActions/types.ts:46`:

  ```ts
  export type SimInputOwnerAction = {
    actionId: string
    targetId?: string
    amount?: number
    options?: Record<string, unknown>
  }
  ```

- `staffPriorities: Record<string, StaffPriorityId>` — keys are staff ids; values are `StaffPriorityId`s validated against the role's `allowedPriorities`. Omitted staff fall back to role defaults.

- `responseIntents: ReadonlyArray<ResponseIntent>` — picks a response slot on a same-day seed. The slim engine-facing shape from `src/sim/core/context.ts`:

  ```ts
  export type ResponseIntent = {
    id: string
    seedId: string
    verb: ResponseIntentVerb
    shape: ResponseIntentShape
    target?: EntityRef
    tags: string[]
    intensity: number
    metadata?: Record<string, unknown>
  }
  ```

  (Same type, full version: `src/sim/modules/issues/issueSeedTypes.ts:300`.) The intent's `seedId` must match a seed in `state.modules.issueSeeds.seedsToday` for the day the intent is supplied — same-day resolution only; carry forward by re-issuing.

### 4.2 Owner-action target types

`OwnerActionTargetType` (`src/sim/modules/ownerActions/types.ts:24`):

```ts
'area' | 'stock' | 'staff' | 'customer_group' | 'regular'
| 'supplier' | 'faction' | 'project' | 'policy' | 'global'
```

Cards that surface owner actions filter the registry by `category` (`immediate | project | policy | social`) and `targetType`. Each definition's `getValidTargets(ctx)` returns the currently-valid target list; cards must not invent ids outside that set.

### 4.3 ResponseIntentVerb / ResponseIntentShape

The 28 verbs (`issueSeedTypes.ts:108`):

```
repair | clean | pay | bribe | blame | hide | confess | discount
| raise_price | lower_price | serve | discard | buy | sell | negotiate
| threaten | appease | delegate | delay | inspect | upgrade | ban
| invite | promote | fire | borrow | gamble | rebrand | ignore
```

The 11 shapes (`issueSeedTypes.ts:140`):

```
safe_costly | risky_profitable | relationship_sacrifice | delay_problem
| long_term_investment | short_term_patch | deception | escalation
| compromise | reputation_play | ignore
```

A card may only emit a verb listed in the seed's `ResponseSlot.allowedVerbs`. The shape is informational — the card layer maps `shape` to tone (e.g. `safe_costly` → "responsible-but-pricey" framing) but the engine ignores it.

### 4.4 EntityRef

Same shape as §3.9. Cards must never invent an id that does not exist in state under the matching `kind`. If a card wants to express "no specific target," omit `target` entirely rather than fabricating one.

### 4.5 The registry surface

Cards do **not** register new sim content. New stock items, areas, owner actions, pressures, customer groups, staff roles, recipes, and issue seed families all flow through existing registries owned by the simulation. Cards may register themselves (with a future `cardRegistry` left for the first card-layer phase plan to define).

Existing registries cards should be aware of — not theirs to extend:

- `moduleRegistry`, `actionRegistry`, `areaRegistry`, `stockRegistry`, `customerRegistry`, `staffRegistry`, `staffPriorityRegistry`, `reputationRegistry`, `pressureRegistry`, `recipeRegistry`, `issueSeedRegistry`, `memoryRegistry`, `cultureRegistry`, `factionRegistry`, `supplierRegistry`, `areaTraitRegistry`, `areaUpgradeRegistry`.

All extend `Registry<T extends RegistryItem>` from `src/sim/registries/Registry.ts`.

---

## 5. Card Authoring Rules

Ten enforceable rules. Tests should check rules 1–4 mechanically; the rest are review/lint material.

1. **Read only.** Cards never mutate state. Side effects live exclusively in the returned `ResponseIntent`.
2. **Reference by id.** Never inline a `display` string, label, or hardcoded actor name into card logic. Pull from state via `EntityRef`.
3. **Respect ingredient budgets.** Every text field a card surfaces must honour `TEXT_INGREDIENT_LIMITS` (§3.3). Over-budget output is a hard failure.
4. **Compose, don't invent.** Final prose composes from `seed.textIngredients`, descriptor pools, and state lookups. No new facts.
5. **Use descriptor pools for flavour adjectives.** `pickSeverityAdjective`, `pickAreaStateAdjective`, `pickFactionRelationNoun`. Pass the seed id as the stable key.
6. **No `Math.random()`.** For any deterministic shuffle/pick, hash the seed id (the FNV helper inside `descriptors.ts` is the precedent).
7. **Skip invalid seeds.** Filter on `seed.validation.valid === true`. Warnings may surface to dev tooling but never to the player.
8. **No side effects.** A card returns a `CardView`; the only mutation channel is the `ResponseIntent` collected and passed into the next `simulateDay`.
9. **No card without a seed.** Cards do not render free-standing. If no seed matches `appliesTo`, no card.
10. **Stable identity across re-renders.** `render(seed, state)` is a pure function. Same inputs ⇒ same output (down to descriptor picks).

---

## 6. Card Definition Shape

This is the canonical shape per-phase plans should target. Field-by-field justification follows each block.

```ts
import type { TavernState, EntityRef } from '../sim/state/TavernState'
import type {
  IssueSeed,
  IssueSeedType,
  IssueSeedFamilyId,
  IssueSeedTiming,
  ResponseIntentVerb,
  ResponseIntentShape,
} from '../sim/modules/issues/issueSeedTypes'

export type CardDefinition = {
  id: string
  appliesTo: CardAppliesTo
  priority?: number
  toneHints?: string[]
  render: (seed: IssueSeed, state: TavernState) => CardView
}

export type CardAppliesTo = {
  seedTypes?: IssueSeedType[]
  seedFamilies?: IssueSeedFamilyId[]
  timings?: IssueSeedTiming[]
  requiredTags?: string[]
  minSeverity?: number
  minCardWorthiness?: number
  custom?: (seed: IssueSeed, state: TavernState) => boolean
}

export type CardView = {
  title: string
  body: string[]
  stakes: { readable: string; direction: 'loss' | 'gain' | 'risk' }[]
  choices: CardChoice[]
  meta?: Record<string, unknown>
}

export type CardChoice = {
  slotId: string
  label: string
  verb: ResponseIntentVerb
  targetId?: string
  shape: ResponseIntentShape
  previewEffects: string[]
  disabledReason?: string
}
```

**Why each field exists:**

- `CardDefinition.id` — stable registry key.
- `appliesTo` — selection predicate. Every field maps directly to an `IssueSeed` field (§3.3). The `custom` escape hatch is for filters that need state lookups (e.g. "regular X must be present and irritation ≥ 60").
- `priority` — tie-break when multiple cards match. The exact algorithm is deferred (§9).
- `toneHints` — non-mechanical guidance for the eventual UI. Seeded from `seed.toneHints` plus card-specific augmentations.
- `render` — pure function, `(seed, state) => CardView`. No mutation, no globals.
- `CardView.title` / `body` — composed strictly from `seed.textIngredients` and descriptor pools. Word-budget enforced per §3.3.
- `CardView.stakes` — projection of `seed.stakes` filtered for display.
- `CardView.choices` — one entry per `ResponseSlot` the card chooses to surface. `verb` must be in `slot.allowedVerbs`; `targetId` must come from `slot.targetOptions` (or be omitted). `previewEffects` is composed from `slot.expectedEffects` and the matching `ConsequenceProfile.immediateEffects[].readable`.
- `CardChoice.disabledReason` — when state makes a choice impossible (e.g. "not enough coin to `bribe`"), the choice still renders, with a reason.
- No mutation hook anywhere. The card layer's job ends when the player picks a choice; the resulting `ResponseIntent` is collected and fed into the next `simulateDay`.

---

## 7. Card Templates

Eight starter scaffolds, one per major archetype. Each is paste-ready: copy, rename, adjust `appliesTo`, adjust the prose composition. All imports are stated; templates assume the file lives under `src/cards/` once that directory exists.

### Template 1 — Crisis Card

```ts
// Immediate, high-severity. Example: food_safety / crisis / during_service.
// Word budgets (TEXT_INGREDIENT_LIMITS):
//   - subject: 1 entry, max 4 words
//   - sensoryDetails: 3 entries, max 6 words each
//   - stakesReadable: 3 entries, max 12 words each
import { pickSeverityAdjective } from '../sim/content/text/descriptors'
import type { CardDefinition } from './types'

export const foodSafetyCrisisCard: CardDefinition = {
  id: 'food_safety.crisis.serviceFloor',
  appliesTo: {
    seedFamilies: ['food_safety'],
    seedTypes: ['crisis'],
    timings: ['during_service'],
    minSeverity: 60,
  },
  priority: 90,
  render: (seed, _state) => {
    const adj = pickSeverityAdjective(seed.severity, seed.id)
    const ti = seed.textIngredients
    const title = `${adj} ${ti.subject}`
    const body = [
      ti.sensoryDetails[0] ?? '',
      ti.recentContext[0] ?? '',
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 3)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 3),
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT do this — invents a name:
//   title: `${ti.subject} from Brog the Wretched`,
// ❌ DO NOT do this — contradicts state:
//   body: ['The cook is unbothered.'],  // even if morale is high — defer to seed
// ❌ DO NOT do this — mutates state:
//   state.coin -= 5  // never mutate; emit a `pay` ResponseIntent instead
```

### Template 2 — Complaint Card

```ts
// Relational, surface-and-respond. Example: customer_complaint / complaint /
// during_service. Pulls a named regular from textIngredients.namedEntities
// and an actor opinion from textIngredients.actorOpinions.
import type { CardDefinition } from './types'

export const customerComplaintCard: CardDefinition = {
  id: 'customer_complaint.complaint.relational',
  appliesTo: {
    seedFamilies: ['customer_complaint', 'regular_customer'],
    seedTypes: ['complaint'],
    timings: ['during_service', 'closing'],
  },
  priority: 70,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const namedRegular = ti.namedEntities?.find((n) => n.role === 'complainant')
    const regularRef = namedRegular?.ref
    const regular = regularRef?.kind === 'regular'
      ? state.world.regulars[regularRef.id]
      : undefined
    const display = regular?.name.display ?? namedRegular?.displayName ?? 'A patron'
    const title = `${display}: ${ti.problemNoun ?? ti.subject}`
    const firstOpinionKey = Object.keys(ti.actorOpinions)[0]
    const body = [
      firstOpinionKey ? ti.actorOpinions[firstOpinionKey]! : ti.sensoryDetails[0] ?? '',
      ...ti.relevantMemories?.slice(0, 1) ?? [],
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 2)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots
      .filter((slot) => slot.allowedVerbs.some((v) => v === 'appease' || v === 'delegate'))
      .map((slot) => {
        const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
        return {
          slotId: slot.id,
          label: slot.labelHint,
          verb: slot.allowedVerbs[0]!,
          targetId: regularRef?.id ?? slot.targetOptions[0]?.id,
          shape: slot.shape,
          previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 2),
        }
      })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT fabricate the regular's name if namedEntities is empty — show 'A patron'.
```

### Template 3 — Opportunity Card

```ts
// Gain-shaped, optional. Example: supplier_offer / opportunity / morning_prep.
// Surfaces supplier reliability and market context.
import type { CardDefinition } from './types'

export const supplierOfferCard: CardDefinition = {
  id: 'supplier_relationship.opportunity.deal',
  appliesTo: {
    seedFamilies: ['supplier_relationship'],
    seedTypes: ['supplier_offer', 'opportunity'],
    timings: ['morning_prep'],
  },
  priority: 50,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const supplierRef = seed.primaryActor?.kind === 'supplier' ? seed.primaryActor : undefined
    const supplier = supplierRef ? state.world.suppliers[supplierRef.id] : undefined
    const supplierLabel = supplier?.name?.display ?? supplier?.label ?? 'A supplier'
    const reliabilityNote = supplier
      ? `reliability ${supplier.reliability}`
      : ''
    const title = `${supplierLabel}: ${ti.subject}`
    const body = [
      ti.marketContext?.[0] ?? '',
      reliabilityNote,
      ti.recentContext[0] ?? '',
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 3)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: supplierRef?.id ?? slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 3),
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT invent a price or quantity in `body` — those live in the seed's
//    expectedEffects/consequenceProfiles. Reference them, don't fabricate them.
```

### Template 4 — Warning Card

```ts
// Delayed risk, repair-or-pay-later. Example: maintenance / warning /
// morning_prep. Surfaces pressure context and the area's current condition.
import { pickAreaStateAdjective, type AreaConditionKey } from '../sim/content/text/descriptors'
import type { CardDefinition } from './types'

function pickAreaCondition(area: { cleanliness: number; damage: number; smell: number; risk: number }): AreaConditionKey {
  if (area.damage >= 50) return 'damaged'
  if (area.cleanliness <= 40) return 'dirty'
  if (area.smell >= 50) return 'smelly'
  if (area.risk >= 50) return 'risky'
  return 'clean'
}

export const maintenanceWarningCard: CardDefinition = {
  id: 'maintenance.warning.morning',
  appliesTo: {
    seedFamilies: ['maintenance', 'area_atmosphere'],
    seedTypes: ['warning', 'maintenance_problem'],
    timings: ['morning_prep'],
  },
  priority: 60,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const areaRef = seed.location?.kind === 'area' ? seed.location : undefined
    const area = areaRef ? state.areas[areaRef.id] : undefined
    const adj = area ? pickAreaStateAdjective(pickAreaCondition(area), seed.id) : ''
    const title = area
      ? `${adj} ${area.label}: ${ti.subject}`
      : `${ti.subject}`
    const body = [
      ti.sensoryDetails[0] ?? '',
      ti.pressureContext?.[0] ?? '',
      ti.stakesReadable[0] ?? '',
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 3)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      const previewEffects = [
        ...(profile?.immediateEffects ?? []).map((e) => e.readable),
        ...(profile?.delayedEffects ?? []).map((e) => `later: ${e.readable}`),
      ].slice(0, 3)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: areaRef?.id ?? slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects,
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT skip `delayedEffects` — warning cards specifically exist to surface
//    the "what happens if you delay" tradeoff. Show at least one delayed effect.
```

### Template 5 — Staff Request Card

```ts
// Internal, personnel-driven. Example: staff_burnout / staff_request / closing.
// Pulls staff identity (GeneratedName) and a morale/stress meter snippet.
import type { CardDefinition } from './types'

export const staffRequestCard: CardDefinition = {
  id: 'staff_burnout.request.closing',
  appliesTo: {
    seedFamilies: ['staff_burnout', 'staff_identity'],
    seedTypes: ['staff_request', 'complaint'],
    timings: ['closing'],
  },
  priority: 65,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const staffRef = seed.primaryActor?.kind === 'staff' ? seed.primaryActor : undefined
    const staff = staffRef ? state.staff[staffRef.id] : undefined
    const display = staff?.name.display ?? 'A staff member'
    const meterLine = staff
      ? `morale ${staff.morale}, stress ${staff.stress}`
      : ''
    const title = `${display}: ${ti.subject}`
    const body = [
      meterLine,
      ti.actorOpinions[staff?.id ?? ''] ?? ti.sensoryDetails[0] ?? '',
      ti.recentContext[0] ?? '',
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 2)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots
      .filter((slot) =>
        slot.allowedVerbs.some((v) => v === 'promote' || v === 'delegate' || v === 'ignore'),
      )
      .map((slot) => {
        const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
        return {
          slotId: slot.id,
          label: slot.labelHint,
          verb: slot.allowedVerbs[0]!,
          targetId: staffRef?.id ?? slot.targetOptions[0]?.id,
          shape: slot.shape,
          previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 2),
        }
      })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT contradict the staff's identity — if staff.identity.workStyle is
//    'careful', do not narrate them as 'reckless' regardless of mood.
```

### Template 6 — Relationship Test Card

```ts
// Faction/regular relationship moment. Example: faction_request /
// relationship_test / morning_prep|closing. Uses faction-relation nouns and
// surfaces cross-actor tension.
import { pickFactionRelationNoun, type FactionRelationKey } from '../sim/content/text/descriptors'
import type { CardDefinition } from './types'

function pickFactionRelation(relationship: number): FactionRelationKey {
  if (relationship <= 20) return 'feud'
  if (relationship <= 40) return 'rivalry'
  if (relationship <= 55) return 'tension'
  if (relationship <= 70) return 'truce'
  return 'cooperation'
}

export const factionRequestCard: CardDefinition = {
  id: 'faction_request.relationship_test',
  appliesTo: {
    seedFamilies: ['faction_request', 'culture_conflict'],
    seedTypes: ['relationship_test', 'social_conflict'],
  },
  priority: 75,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const factionRef = seed.primaryActor?.kind === 'faction' ? seed.primaryActor : undefined
    const faction = factionRef ? state.world.factions[factionRef.id] : undefined
    const relationNoun = faction
      ? pickFactionRelationNoun(pickFactionRelation(faction.relationship), seed.id)
      : ''
    const title = faction
      ? `${faction.label}: a ${relationNoun}`
      : ti.subject
    const body = [
      ti.socialContext?.[0] ?? '',
      ti.perceivedBlame?.[0] ?? '',
      ti.relevantMemories?.[0] ?? '',
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 3)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: factionRef?.id ?? slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 3),
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT contradict the faction's stored relationship. If state holds
//    relationship 80 (cooperation), the card must not narrate 'long-standing
//    feud' — read pickFactionRelation off state instead.
```

### Template 7 — End-of-Week Card

```ts
// end_week timing. Example: reputation_shift / reputation_shift / end_week.
// Reads recent causes (state.causes filtered by recency) to explain a trend.
import type { CardDefinition } from './types'
import type { CauseEntry } from '../sim/state/TavernState'

function topCausesForReputationAxis(
  state: { causes: CauseEntry[] },
  axis: string,
  limit = 3,
): CauseEntry[] {
  return state.causes
    .filter((c) => c.targetType === 'reputation' && c.target.endsWith(axis))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export const reputationShiftEndOfWeekCard: CardDefinition = {
  id: 'reputation_shift.weekly',
  appliesTo: {
    seedFamilies: ['reputation_shift'],
    seedTypes: ['reputation_shift'],
    timings: ['end_week'],
  },
  priority: 55,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const axisTag = seed.domain.find((d) => d.startsWith('reputation.'))
    const axis = axisTag?.split('.')[1] ?? 'reputable'
    const topCauses = topCausesForReputationAxis(state, axis, 3)
    const title = `Weekly shift: ${ti.subject}`
    const body = [
      ti.recentContext[0] ?? '',
      ...topCauses.map((c) => c.readable).slice(0, 2),
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 2)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects: (profile?.immediateEffects ?? []).map((e) => e.readable).slice(0, 2),
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT invent a cause that is not in state.causes. If `topCauses` is
//    empty, fall back to seed.textIngredients only.
```

### Template 8 — Monthly Review Card

```ts
// end_month timing. Example: monthly_review / monthly_review / end_month.
// Reads multi-week aggregate via pressures and the issue-seed cardWorthiness
// signal.
import type { CardDefinition } from './types'

export const monthlyReviewCard: CardDefinition = {
  id: 'monthly_review.strategic',
  appliesTo: {
    seedFamilies: ['monthly_review'],
    seedTypes: ['monthly_review'],
    timings: ['end_month'],
  },
  priority: 40,
  render: (seed, state) => {
    const ti = seed.textIngredients
    const topPressures = Object.values(state.pressures)
      .filter((p) => p.value >= 40)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
    const title = `Month in review: ${ti.subject}`
    const body = [
      ti.calendarContext?.[0] ?? '',
      ...topPressures.map((p) => `${p.label} ${p.value} (${p.trend >= 0 ? '+' : ''}${p.trend})`),
    ].filter(Boolean)
    const stakes = seed.stakes
      .slice(0, 3)
      .map((s) => ({ readable: s.readable, direction: s.direction }))
    const choices = seed.responseSlots.map((slot) => {
      const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
      const previewEffects = [
        ...(profile?.immediateEffects ?? []).map((e) => e.readable),
        ...(profile?.delayedEffects ?? []).map((e) => `next month: ${e.readable}`),
      ].slice(0, 3)
      return {
        slotId: slot.id,
        label: slot.labelHint,
        verb: slot.allowedVerbs[0]!,
        targetId: slot.targetOptions[0]?.id,
        shape: slot.shape,
        previewEffects,
      }
    })
    return { title, body, stakes, choices }
  },
}

// ❌ DO NOT pick a winning/losing narrative the sim does not support — surface
//    the pressures and let the player draw the conclusion.
```

---

## 8. Verification

How a card author proves their card behaves correctly:

1. **Co-locate tests under `tests/cards/<card-id>.test.ts`** using Vitest.
2. **Drive a deterministic day** with `runOneDay` / `runCardlessSim` from `src/sim/testing/simRunner.ts`, or `makeTavernState` (`src/sim/testing/stateFactories.ts`) for hand-rolled seed scenarios.
3. **Assert the predicate matches:** the card's `appliesTo` matches the produced seed.
4. **Assert budget compliance:** `render(seed, state)` returns text fields within `TEXT_INGREDIENT_LIMITS` (word counts, entry counts).
5. **Assert verb validity:** every `choices[*].verb` is in the matching `seed.responseSlots[*].allowedVerbs`.
6. **Assert target validity:** every `choices[*].targetId` (if present) exists in the matching `slot.targetOptions` or in `state` under the right `kind`.
7. **Assert state non-mutation:** `render(seed, structuredClone(state))` produces the same `CardView` as `render(seed, state)`, and the cloned state is unchanged.
8. **End-to-end round-trip:** feed the resulting `ResponseIntent` into the next `simulateDay()`; assert the produced `EffectResult`s match the seed's `ConsequenceProfile.immediateEffects` (the simulation owns the actual mutation; the card just chose the slot).
9. **Run `npm test` and `npm run typecheck`** before commit.

---

## 9. Open Questions for the Card-Layer Phase Plans

This contract intentionally does NOT decide:

- **Where cards register.** Likely a `cardRegistry: Registry<CardDefinition>`; could live in `src/sim/registries/` or in a new `src/cards/` slice. Pick in the first card-layer phase plan.
- **Selection algorithm.** When multiple cards match one seed, who wins? Highest `priority`, longest-match `appliesTo` predicate, oldest registration? Pick one and write it down.
- **Render target.** Is `CardView` rendered to terminal text first (Phase 87?), to a TUI, or to a web UI shape? Likely text-first to match the "headless" precedent.
- **Tone/presentation pipeline.** `toneHints` feeds something downstream; that thing does not exist yet.
- **Animation/pacing hints.** Not yet a thing. Mention if the eventual UI needs them.
- **Card ↔ owner-action surface.** The owner-action UI may or may not be card-shaped. Decide before the first owner-action card lands.

The first card-layer phase plan (provisionally phase 87) should resolve at least the first three of these before any production cards are written.

---

## Critical Files Referenced

Sources for every type quoted in this document. These are the read-only inputs for the card layer:

- `src/sim/core/engine.ts` — `simulateDay`.
- `src/sim/core/result.ts` — `SimResult`.
- `src/sim/core/context.ts` — `SimInput`, `SimInputOwnerAction`, slim `ResponseIntent`, `SimContext`.
- `src/sim/core/phases.ts` — `SIMULATION_PHASES`.
- `src/sim/core/module.ts` — `SimulationModule`.
- `src/sim/core/reports.ts` — `ReportSection`, `SimLog`.
- `src/sim/core/diff.ts` — `StateChange`, `StateDiff`, `TaggedStateDiff`, `DEFAULT_THRESHOLDS`.
- `src/sim/core/effect.ts` — `EffectPreview`, `EffectResult`.
- `src/sim/state/TavernState.ts` — full state schema and every entity shape.
- `src/sim/modules/issues/issueSeedTypes.ts` — `IssueSeed`, `TextIngredients`, `ResponseSlot`, `ConsequenceProfile`, `TEXT_INGREDIENT_LIMITS`, full `ResponseIntent`.
- `src/sim/modules/ownerActions/types.ts` — `OwnerActionInput`, `OwnerActionDefinition`, target types.
- `src/sim/modules/attribution/attributionTypes.ts` — `AttributionState`.
- `src/sim/modules/memories/memoryTypes.ts` — `MemoryDraft`, `MemoryDefinition`.
- `src/sim/modules/pressures/pressureTypes.ts` — `PressureSnapshot`, `PRESSURE_IDS`, `EXPANDED_PRESSURE_IDS`.
- `src/sim/content/naming/nameTypes.ts` — `GeneratedName`, `NamingProfileId`.
- `src/sim/content/text/descriptors.ts` — `SEVERITY_ADJECTIVES`, `AREA_STATE_ADJECTIVES`, `FACTION_RELATION_NOUNS`, `severityTier`, deterministic-pick helpers.
- `src/sim/content/text/textIngredientTypes.ts` — `TextIngredient`, `TextIngredientKind`.
- `src/sim/testing/simRunner.ts` — `runOneDay`, `runOneWeek`, `runOneMonth`, `runCardlessSim`, `FULL_PIPELINE`.
- `src/sim/testing/stateFactories.ts` — `makeTavernState`, `withArea`, `withStock`, etc.
- `src/sim/state/defaults.ts` — `createInitialTavernState`.
