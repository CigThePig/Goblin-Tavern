import type { CalendarState } from '../modules/calendar/types'
import type { GeneratedName, NamingProfileId } from '../content/naming/nameTypes'
import type { RngStreamState } from '../core/rng'

export type TavernMetaState = {
  tavernId: string
  tavernName: string
  simVersion: string
  createdAtDay: number
}

// Phase 28 §28.1 — Area trait, upgrade, and atmosphere shapes.
//
// Phase 8 treated areas as bundles of mechanical meters (condition,
// cleanliness, mess, damage, smell, risk). Phase 28 turns each area into
// a place with persistent identity: a list of trait ids (`cozy`,
// `sticky_floor`, …), an atmosphere tag list, and a per-upgrade record
// that tracks status, build progress, and install timing. The mechanical
// meters from Phase 8 are unchanged; the new fields stack on top.
export type AreaTraitId = string
export type AreaUpgradeId = string
export type AtmosphereTag = string

export type AreaUpgradeStatus =
  | 'available'
  | 'in_progress'
  | 'installed'
  | 'damaged'
  | 'disabled'

export type AreaUpgradeState = {
  id: AreaUpgradeId
  status: AreaUpgradeStatus
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

// Phase 9 §"Stock State" — Phase 9 extends the Phase 5 stock shape with
// `basePrice` (per-unit restock cost), `salePrice` (per-unit customer
// price), and an optional `storageAreaId`. This mirrors the additive
// precedent set for `CustomerGroupState` (forward note in Phase 10 §"Customer
// Group State"). The Phase 5 placeholder field `unitValue` is replaced by
// the explicit two-price model the economy needs.
//
// Phase 65 / ISSUE-025 §5.1 — Stock items gain a `rarity` tier. Rarity is
// a property of the ingredient type (the stock id), not per-batch.
// Provenance lives in memories, not on stock state.
export type StockRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

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
  rarity: StockRarity
}

// Phase 65 / ISSUE-025 §5.2 — Recipe state slice. Recipes are derived
// dishes that consume one or more ingredient stock items; customer
// orders resolve to recipe ids rather than stock ids. State holds only
// runtime tracking (onMenu flag, served counters); the static config
// (inputs, prepDifficulty, demandTier, culturalTags) lives on
// `RecipeDefinition` in `recipeRegistry` and is read by lookup.
export type RecipeState = {
  id: string
  label: string
  tags: string[]
  onMenu: boolean
  timesServed: number
  daysSinceLastServed: number
  lastServedDay: number | null
}

// Phase 11 §11.1 / "Role typing clarification" — `StaffRoleId` is a
// registry string. The earlier Phase 5 placeholder typed `role` as the
// hard-coded union `'cook' | 'server' | 'cleaner_bouncer'`; that union is
// kept exported as `StaffRole` for legacy shorthand, but the canonical
// field type is `StaffRoleId` (a string validated against
// `staffRegistry`). Same precedent applies to `StaffPriorityId`
// (validated against `staffPriorityRegistry`).
export type StaffRoleId = string
export type StaffPriorityId = string

/** @deprecated Phase 11 — legacy union kept only for backwards-compatible
 *  type imports. Prefer `StaffRoleId`. */
export type StaffRole = 'cook' | 'server' | 'cleaner_bouncer'

// Phase 31 §31.1 — staff identity work styles. Each value is a small,
// neutral handle describing how a staff member tends to approach the
// job; performance hooks in Phase 31 §31.9 attach modest mechanical
// modifiers to specific values. Later phases (32 service scenes, 33
// social actions) read identity fields directly.
export type StaffWorkStyle =
  | 'steady'
  | 'fast'
  | 'careful'
  | 'social'
  | 'rough'
  | 'methodical'
  | 'improviser'

// Phase 31 §31.1 — staff stress response. Plumbing for Phase 32 §32.3
// "Staff Moment" scene generation: when a staff member's stress climbs,
// the scene builder reads this value to decide what kind of scene to
// emit.
export type StaffStressResponse =
  | 'withdraws'
  | 'snaps'
  | 'rushes'
  | 'overworks'
  | 'gets_sloppy'
  | 'asks_for_help'

// Phase 31 §31.1 — persistent staff identity. Each staff member carries
// a deterministic generated name, a culture/naming-profile pointer, a
// short personality tag list, and a single work style + stress response.
// Identity is serializable JSON: every field is a primitive, an array
// of primitives, or a `GeneratedName` (itself JSON-shaped). The plan
// pins this as state — names are generated once at creation and reused,
// never regenerated when a report is re-viewed (CLAUDE.md §"Persistent
// identity is state, not display").
//
// Audit fixes pass 1 §1.1 — `generatedName` previously lived on identity
// AND was duplicated as a display string on `StaffState.name`. The
// duplicate is removed: `staff.name` now holds the full `GeneratedName`
// object, and identity no longer carries its own copy.
export type StaffIdentityState = {
  groupId: string
  cultureId?: string
  namingProfileId: NamingProfileId
  personalityTags: string[]
  workStyle: StaffWorkStyle
  stressResponse: StaffStressResponse
  loyalties: string[]
  dislikes: string[]
  backgroundHook?: string
}

export type StaffState = {
  id: string
  name: GeneratedName
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
  // Phase 31 §31.1 — persistent identity. Optional during the migration
  // window for pre-Phase-31 saves; new state created via
  // `createInitialTavernState` always populates it (see §31.8) and the
  // staff module's validate hook flags missing identity as a structural
  // issue.
  identity?: StaffIdentityState
}

// Phase 10 §"Customer Group State" — Phase 10 extends the Phase 5 shape
// with three additive fields: `loyalty`, `preferredStockTags`, and
// `dislikedTags`. The forward note in §"Customer Group State" pins this
// as an additive change (mirrors the `StaffRoleId` precedent), not a fork.
//
// Phase 30 §30.2 — adds cultural linkage. Each group now carries a
// `cultureId`, `namingProfileId`, `trafficPattern`, `spendingProfile`,
// and a `relationshipToOtherGroups` map. The Phase 10 numeric meters
// are unchanged; the new fields are additive. Field names from earlier
// phases stay stable.
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
  // Phase 30 §30.2 — added fields.
  cultureId: string
  namingProfileId: NamingProfileId
  trafficPattern: string
  spendingProfile: string
  relationshipToOtherGroups: Record<string, number>
  // Phase 72 / ISSUE-032 §4.7, §5.6 — niche customer threshold.
  // Groups with this field active their patronage when
  // `culinary_renown` crosses the threshold. Optional; existing
  // groups remain always-available (treated as threshold 0).
  minRenownThreshold?: number
}

// Phase 15 §15.5 — Reputation is multi-axis. The `respectable` axis was
// added in Phase 15 alongside the monthly module; the other eight axes
// are unchanged from Phase 5.
//
// Phase 67 / ISSUE-027 §4.6, §5.5 — `culinary_renown` joins the canonical
// axis set. It tracks fame for *sourcing* rare ingredients and *executing*
// rare preparations. The existing `tasty`/`strange` axes are insufficient
// for the rare-ingredient economy loop: `tasty` measures execution
// quality across all dishes and `strange` measures oddity (sometimes a
// negative). Renown captures the unified positive feedback the loop
// accumulates against.
export type ReputationState = {
  cheap: number
  tasty: number
  filthy: number
  dangerous: number
  cozy: number
  strange: number
  reliable: number
  goblinAuthentic: number
  respectable: number
  culinary_renown: number
}

// Phase 16 §"Calendar Stamp" — a stable, serializable timestamp used by
// memories and history. `absoluteDay` mirrors `CalendarState.totalDaysElapsed`
// so the age of any stamped entry can be computed without re-resolving
// week/month boundaries.
export type CalendarStamp = {
  year: number
  month: number
  week: number
  day: number
  absoluteDay: number
}

// Phase 16 §"Memory Shape" — a memory's `actors` and `locations` reference
// other simulation entities (staff, customer groups, areas, stock items).
// Kept as a plain `{ kind, id }` pair so the array stays JSON-compatible.
//
// Phase 25 §"EntityRef Expansion" — widened with world-entity kinds
// (`culture`, `faction`, `supplier`, `regular`, `notable_npc`,
// `local_event`, `rumour`, `tavern_identity`) so memories and causes can
// point at the new `state.world` records introduced in this phase.
//
// Phase 67 / ISSUE-027 — `recipe` joins the set so culinary-renown
// drift causes attribute back to the proximate dish.
export type EntityRef = {
  kind:
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
    | 'recipe'
  id: string
}

// Phase 16 §"Memory Shape" / §16.1 — `MemoryState` is the on-state record
// for a single memory instance. The Phase 5 placeholder shape
// (`id, type, strength, ageDays, durationDays?, tags, relatedIds, data?`)
// is replaced with the Phase 16 shape: typed actor/location refs,
// calendar stamps, decay rate, source, and structured metadata. The
// `'hook'` type is renamed to `'future_hook'` and `'pattern'` joins the
// canonical set.
export type MemoryType = 'fact' | 'timed' | 'grudge' | 'pattern' | 'future_hook'

export type MemoryState = {
  id: string
  type: MemoryType
  /** Definition id from the memory registry, if this memory has one. */
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

// Phase 16 §"History Log Shape" — append-only debug record that lives
// alongside (but distinct from) `state.memories`. Memories influence the
// simulation; history records what already happened.
export type HistoryCategory =
  | 'owner_action'
  | 'service'
  | 'weekly'
  | 'monthly'
  | 'state_change'
  | 'memory'
  | 'pressure'
  | 'system'

export type HistoryEntry = {
  id: string
  timestamp: CalendarStamp
  category: HistoryCategory
  summary: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  mechanicalRefs?: string[]
}

// Phase 17 §"Cause Shape" — replaces the Phase 5 placeholder. The earlier
// `CauseState` shape (`id, day, source, target, amount, readable, tags`)
// is widened to the Phase 17 contract: calendar stamps, typed
// source/target enums, direction/weight, related actors/locations, and
// `ageDays` / `expiresAfterDays` so the cause module can prune.
// `CauseState` is kept as an alias for legacy imports.
// Phase 27 §27.2 — Cause type expansion (canonical home).
//
// World mutations (`modifyCulture`, `modifyFaction`, `modifySupplier`,
// `modifyRegular`, `modifyNotableNpc`, `modifyLocalEvent`,
// `modifySocialRumour`, `modifyTavernIdentity`) need to attribute their
// changes to a cause just like Phase 7's existing helpers. Phase 27 is
// the canonical place to widen the cause source/target unions with the
// world kinds — later phases (28–35) assume these values already exist
// and use them directly.
export type CauseSourceType =
  | 'owner_action'
  | 'service'
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer'
  | 'weekly'
  | 'monthly'
  | 'memory'
  | 'pressure'
  | 'system'
  | 'culture'
  | 'faction'
  | 'supplier'
  | 'regular'
  | 'local_event'
  | 'rumour'

export type CauseTargetType =
  | 'coin'
  | 'area'
  | 'stock'
  | 'staff'
  | 'customer'
  | 'reputation'
  | 'pressure'
  | 'memory'
  | 'global'
  | 'culture'
  | 'faction'
  | 'supplier'
  | 'regular'
  | 'notable_npc'
  | 'local_event'
  | 'rumour'
  | 'tavern_identity'
  // Phase 65 / ISSUE-025 — recipe state changes attribute to `recipe`.
  | 'recipe'

export type CauseDirection = 'increase' | 'decrease' | 'neutral'

export type CauseEntry = {
  id: string
  timestamp: CalendarStamp
  source: string
  sourceType: CauseSourceType
  target: string
  targetType: CauseTargetType
  amount: number
  direction: CauseDirection
  weight: number
  readable: string
  tags: string[]
  relatedActors: EntityRef[]
  relatedLocations: EntityRef[]
  relatedSystems: string[]
  ageDays: number
  expiresAfterDays?: number
}

/** @deprecated Phase 17 — use `CauseEntry`. Kept for legacy imports. */
export type CauseState = CauseEntry

export type PressureState = {
  id: string
  label: string
  value: number
  trend: number
  tags: string[]
  topCauses: string[]
}

// Phase 25 §"Required World State Types" — serializable containers for
// the wider tavern world: cultures, factions, suppliers, regulars,
// notable NPCs, local events, tavern identity, and social rumours.
// Phase 25 only defines the shapes and the empty default containers;
// later phases (26+) populate and mutate them.
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
  trust: number
  fear: number
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

// Phase 70 / ISSUE-030 §5.3 — Expedition subsystem types.
//
// The player commissions a hireable adventurer (phase 69) to fetch
// rare or legendary ingredients (phase 66). Expeditions run end-only:
// `daysElapsed` increments each day, and resolution fires once on the
// day `daysElapsed >= daysTotal`. Outcome is rolled via the per-
// expedition named RNG stream so save/reload round-trips produce the
// same result.
export type ExpeditionMode = 'open' | 'targeted'

export type ExpeditionTargetTier = 'uncommon' | 'rare' | 'legendary'

export type ExpeditionOutcome =
  | 'success'
  | 'partial'
  | 'failure'
  | 'runner_lost'

export type Expedition = {
  id: string
  runnerId: string
  mode: ExpeditionMode
  /** Set for `open` mode: which rarity tier the expedition aims at. */
  targetTier: ExpeditionTargetTier | null
  /** Set for `targeted` mode: which specific ingredient to fetch. */
  targetIngredientId: string | null
  daysTotal: number
  daysElapsed: number
  costPaid: number
  startedDay: number
  status: 'in_progress'
  /**
   * Stable seed captured from `ctx.rngStreams.baseSeed` at commission
   * time. Resolution derives `expedition_<id>` and
   * `ingredient_quality_<id>` streams from this stored value rather
   * than from the resolution day's input seed, so saves resumed (or
   * replayed) with a different seed on the resolution day still
   * produce the same outcome.
   */
  seed: string
}

export type ExpeditionReturnedIngredient = {
  ingredientId: string
  quantity: number
  quality: number
}

export type ExpeditionRecord = {
  id: string
  runnerId: string
  mode: ExpeditionMode
  targetTier: ExpeditionTargetTier | null
  targetIngredientId: string | null
  daysTotal: number
  costPaid: number
  startedDay: number
  resolvedDay: number
  outcome: ExpeditionOutcome
  returnedIngredients: ExpeditionReturnedIngredient[]
}

export type ExpeditionsState = {
  active: Expedition[]
  completed: ExpeditionRecord[]
}

// Phase 69 / ISSUE-029 §5.4 — Hireable adventurer roster.
//
// Persistent NPCs the player commissions for expeditions (phase 70).
// Names are generated once at NPC creation through the `npc_identity`
// RNG stream and stored; never regenerated when a report is re-viewed.
//
// The existing `adventurers` customer group represents demand-side
// adventuring bands; hireable adventurers are a separate slice of the
// same culture (`adventuring_bands`) — bands' members who happen to be
// between jobs and willing to take work.
export type HireableAdventurer = {
  id: string
  name: GeneratedName
  cultureId: string
  experience: number // 0-100 — rises with successful expeditions
  reliability: number // 0-100 — rises with successes, falls with failures
  relationship: number // 0-100 — rises with repeated hires + payment
  specialty: string | null // optional tag biasing target tier/category
  wageBase: number // coin per expedition day
  daysSinceLastJob: number
  currentExpeditionId: string | null
  joinedDay: number
  tags: string[]
  activeFlags: string[]
}

// Phase 35 §35.2 — arc lifecycle stages. Stored as a plain string on
// the record so legacy local-event entries without arc semantics still
// validate; `world.localEvents` widens to cover both shapes.
export type LocalArcStageId =
  | 'seeded'
  | 'rising'
  | 'active'
  | 'climax'
  | 'resolved'
  | 'failed'

export type LocalArcHistoryRecord = {
  day: number
  stage: LocalArcStageId
  note: string
}

// Phase 25 §"Required World State Types" / Phase 35 §35.3 — local
// events double as the storage for Phase 35 local arcs. The Phase 25
// fields (id, definitionId, label, startedDay, endsDay, intensity,
// relatedFactionIds, relatedCultureIds, tags, activeFlags) stay the
// canonical shape; Phase 35 adds optional arc fields (`type`, `stage`,
// `lastUpdatedDay`, `ageDays`, `relatedRefs`, `activeEffects`,
// `arcHistory`) on top so an existing local-event record continues to
// validate without rewriting Phase 25 callers.
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
  // Phase 35 §35.3 — arc-specific fields.
  type?: string
  stage?: LocalArcStageId
  lastUpdatedDay?: number
  ageDays?: number
  relatedRefs?: EntityRef[]
  activeEffects?: string[]
  arcHistory?: LocalArcHistoryRecord[]
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
  subject?: EntityRef
  firstHeardDay: number
  lastSpreadDay: number
  tags: string[]
  involvedRefs?: EntityRef[]
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
  // Phase 69 / ISSUE-029 §5.4 — Hireable adventurer roster.
  hireableAdventurers: Record<string, HireableAdventurer>
  rngStreams?: Partial<RngStreamState>
}

export type TavernState = {
  meta: TavernMetaState
  calendar: CalendarState
  coin: number

  areas: Record<string, AreaState>
  stock: Record<string, StockState>
  staff: Record<string, StaffState>
  customerGroups: Record<string, CustomerGroupState>
  reputation: ReputationState

  // Phase 65 / ISSUE-025 §5.2 — recipe slice. Keyed by recipe id.
  recipes: Record<string, RecipeState>

  // Phase 70 / ISSUE-030 §5.3 — expedition subsystem state.
  expeditions: ExpeditionsState

  world: WorldState

  memories: MemoryState[]
  history: HistoryEntry[]
  causes: CauseEntry[]
  pressures: Record<string, PressureState>

  modules: Record<string, unknown>
}
