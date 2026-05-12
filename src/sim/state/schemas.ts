import { z } from 'zod'
import type { SimulationModule } from '../core/module'

// Phase 6 §6.1 — Core schemas.
//
// Each schema mirrors the corresponding Phase 5 type exactly: same field
// names, same shapes, no re-tuned ranges beyond what Phase 5 already
// specified. The 0–100 percentage range and the "stock quantity ≥ 0,
// no NaN" rules come from `phases-06-10.md` §"State Safety Rules".

const meter = () => z.number().min(0).max(100)
const nonNegativeNumber = () => z.number().min(0)
const nonNegativeInt = () => z.number().int().min(0)

// Phase 23 §"Schema Update" — adds `season` (enum) and `tags` (open
// string array). Tags are intentionally not enum-constrained at this
// stage so later phases can extend the tag vocabulary without breaking
// older saves; the calendar module owns the canonical `CalendarTag` union.
export const CalendarStateSchema = z.object({
  day: z.number().int().min(1).max(28),
  week: z.number().int().min(1).max(4),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1),
  totalDaysElapsed: nonNegativeInt(),
  dayOfWeek: z.number().int().min(1).max(7),
  dayType: z.enum([
    'supplier_day',
    'quiet_day',
    'market_day',
    'local_night',
    'payday',
    'brawl_night',
    'maintenance_day',
  ]),
  season: z.enum(['mudwake', 'highsun', 'redleaf', 'deepfrost']),
  tags: z.array(z.string()),
})

export const TavernMetaStateSchema = z.object({
  tavernId: z.string(),
  tavernName: z.string(),
  simVersion: z.string(),
  createdAtDay: nonNegativeInt(),
})

// Phase 28 §28.1 — Upgrade record carried on `AreaState.upgrades`. The
// status enum mirrors `AreaUpgradeStatus` on the TS type; `progress` is
// optional because an `available` upgrade has not been started, and
// `installedAtDay` is only set once an upgrade is actually installed.
export const AreaUpgradeStateSchema = z.object({
  id: z.string(),
  status: z.enum(['available', 'in_progress', 'installed', 'damaged', 'disabled']),
  progress: nonNegativeNumber().optional(),
  installedAtDay: nonNegativeInt().optional(),
  tags: z.array(z.string()),
})

// Phase 28 §28.1 — Phase 8's `AreaState` is extended with `traits`,
// `atmosphere`, and `upgrades`. Existing meter fields are unchanged.
// Older saves are repaired via `normalizeArea` in `normalize.ts` so the
// schema can require the new fields outright.
export const AreaStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  condition: meter(),
  cleanliness: meter(),
  mess: meter(),
  damage: meter(),
  smell: meter(),
  risk: meter(),
  tags: z.array(z.string()),
  activeProblems: z.array(z.string()),
  traits: z.array(z.string()),
  atmosphere: z.array(z.string()),
  upgrades: z.record(z.string(), AreaUpgradeStateSchema),
})

export const StockItemStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantity: nonNegativeNumber(),
  quality: meter(),
  spoilage: meter(),
  basePrice: z.number().min(0),
  salePrice: z.number().min(0),
  tags: z.array(z.string()),
  storageAreaId: z.string().optional(),
})

// Phase 11 §11.1 — `role` is a registry-validated string (`StaffRoleId`),
// not a hard-coded union, per the "Role typing clarification" forward
// note. The schema accepts any string; the staff module's validate hook
// surfaces unknown role ids as structural issues so registry membership
// is enforced at the module layer (mirrors how Phase 8 area validation
// works). `currentPriority` is similarly registry-string typed and
// optional.
export const StaffStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  skill: meter(),
  morale: meter(),
  stress: meter(),
  fatigue: meter(),
  loyalty: meter(),
  wage: z.number(),
  paidThisWeek: z.boolean(),
  currentPriority: z.string().optional(),
  unavailable: z.boolean().optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

// Phase 30 §30.2 — schema extended with cultural linkage fields. The
// numeric Phase 10 meters are unchanged; the new fields are required
// strings/records so future migrations can lean on the Phase 6
// validator instead of optional shims.
export const CustomerGroupStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  patronage: meter(),
  satisfaction: meter(),
  wealth: meter(),
  rowdiness: meter(),
  dangerTolerance: meter(),
  filthTolerance: meter(),
  priceSensitivity: meter(),
  loyalty: meter(),
  damageRisk: meter(),
  tabRisk: meter(),
  preferredStockTags: z.array(z.string()),
  dislikedTags: z.array(z.string()),
  tags: z.array(z.string()),
  activeGrudges: z.array(z.string()),
  cultureId: z.string(),
  namingProfileId: z.string(),
  trafficPattern: z.string(),
  spendingProfile: z.string(),
  relationshipToOtherGroups: z.record(z.string(), z.number()),
})

export const ReputationStateSchema = z.object({
  cheap: meter(),
  tasty: meter(),
  filthy: meter(),
  dangerous: meter(),
  cozy: meter(),
  strange: meter(),
  reliable: meter(),
  goblinAuthentic: meter(),
  // Phase 15 §15.5 — `respectable` axis joined the canonical set in Phase 15.
  respectable: meter(),
})

// Phase 16 §"Calendar Stamp" — stable timestamp shared by memories and
// history entries. `absoluteDay` mirrors `CalendarState.totalDaysElapsed`.
export const CalendarStampSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  week: z.number().int().min(1).max(4),
  day: z.number().int().min(1).max(28),
  absoluteDay: nonNegativeInt(),
})

// Phase 25 §"EntityRef Expansion" — the `kind` enum is widened with
// world-entity kinds so memories and causes can reference cultures,
// factions, suppliers, regulars, notable NPCs, local events, social
// rumours, and the tavern's own identity record.
export const EntityRefSchema = z.object({
  kind: z.enum([
    'staff',
    'customer_group',
    'area',
    'stock',
    'role',
    'system',
    'other',
    'culture',
    'faction',
    'supplier',
    'regular',
    'notable_npc',
    'local_event',
    'rumour',
    'tavern_identity',
  ]),
  id: z.string(),
})

// Phase 16 §"Memory Shape" — replaces the Phase 5 placeholder. The
// `'hook'` type was renamed to `'future_hook'` and `'pattern'` joined
// the canonical set; the new optional fields (`label`, `definitionId`,
// `createdAt`, `expiresAt`, `actors`, `locations`, `relatedSystems`,
// `decayRate`, `source`, `metadata`) give memories enough context for
// later phases to reason about them.
export const MemoryStateSchema = z.object({
  id: z.string(),
  type: z.enum(['fact', 'timed', 'grudge', 'pattern', 'future_hook']),
  definitionId: z.string().optional(),
  label: z.string().optional(),
  strength: meter(),
  ageDays: nonNegativeInt(),
  durationDays: nonNegativeInt().optional(),
  decayRate: z.number().optional(),
  createdAt: CalendarStampSchema,
  expiresAt: CalendarStampSchema.optional(),
  actors: z.array(EntityRefSchema),
  locations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  tags: z.array(z.string()),
  source: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// Phase 16 §"History Log Shape" — append-only debug log.
export const HistoryEntrySchema = z.object({
  id: z.string(),
  timestamp: CalendarStampSchema,
  category: z.enum([
    'owner_action',
    'service',
    'weekly',
    'monthly',
    'state_change',
    'memory',
    'pressure',
    'system',
  ]),
  summary: z.string(),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  mechanicalRefs: z.array(z.string()).optional(),
})

// Phase 17 §"Cause Shape" — widened from the Phase 5 placeholder. The
// shape now carries a calendar stamp, typed source/target enums, a
// direction, a weight, related actors/locations/systems, and aging
// fields so causes can be pruned. The Phase 16 `CalendarStamp` and
// `EntityRef` schemas back the timestamp and ref arrays.
export const CauseEntrySchema = z.object({
  id: z.string(),
  timestamp: CalendarStampSchema,
  source: z.string(),
  // Phase 27 §27.2 — widened with world source/target kinds so the
  // expanded `ctx.modify*` helpers can attribute their changes through
  // the same cause contract as the Phase 7 originals.
  sourceType: z.enum([
    'owner_action',
    'service',
    'area',
    'stock',
    'staff',
    'customer',
    'weekly',
    'monthly',
    'memory',
    'pressure',
    'system',
    'culture',
    'faction',
    'supplier',
    'regular',
    'local_event',
    'rumour',
  ]),
  target: z.string(),
  targetType: z.enum([
    'coin',
    'area',
    'stock',
    'staff',
    'customer',
    'reputation',
    'pressure',
    'memory',
    'global',
    'culture',
    'faction',
    'supplier',
    'regular',
    'notable_npc',
    'local_event',
    'rumour',
    'tavern_identity',
  ]),
  amount: z.number(),
  direction: z.enum(['increase', 'decrease', 'neutral']),
  weight: z.number().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  ageDays: nonNegativeInt(),
  expiresAfterDays: nonNegativeInt().optional(),
})

export const PressureStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: meter(),
  trend: z.number(),
  tags: z.array(z.string()),
  topCauses: z.array(z.string()),
})

// Phase 25 §"Schema Additions" — schemas for the new top-level `world`
// branch. Identity-style numbers (familiarity, comfort, tension,
// relationship, influence, trust, fear, reliability, debtTolerance,
// loyalty, irritation, intensity, strength) reuse `meter()`. `priceBias`
// is intentionally a free number because it may be negative.
export const GeneratedNameSchema = z.object({
  display: z.string(),
  profileId: z.string(),
  parts: z.record(z.string(), z.string()),
  patternId: z.string(),
  generatedBy: z.string(),
})

const RngStateSchema = z.object({
  seed: z.string(),
  calls: nonNegativeInt(),
})

export const CultureWorldStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  familiarity: meter(),
  comfort: meter(),
  tension: meter(),
  namingProfileId: z.string(),
  preferredStockTags: z.array(z.string()),
  dislikedTags: z.array(z.string()),
  importantCalendarTags: z.array(z.string()),
  tags: z.array(z.string()),
})

export const FactionWorldStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  relationship: meter(),
  influence: meter(),
  trust: meter(),
  fear: meter(),
  cultureId: z.string().optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const SupplierWorldStateSchema = z.object({
  id: z.string(),
  name: GeneratedNameSchema.optional(),
  label: z.string(),
  supplierType: z.string(),
  reliability: meter(),
  relationship: meter(),
  debtTolerance: meter(),
  priceBias: z.number(),
  goodsProvided: z.array(z.string()),
  factionId: z.string().optional(),
  cultureId: z.string().optional(),
  lastDeliveryDay: nonNegativeInt().optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const RegularWorldStateSchema = z.object({
  id: z.string(),
  name: GeneratedNameSchema,
  customerGroupId: z.string(),
  cultureId: z.string().optional(),
  factionId: z.string().optional(),
  loyalty: meter(),
  irritation: meter(),
  visits: nonNegativeInt(),
  favoriteStockId: z.string().optional(),
  firstSeenDay: nonNegativeInt(),
  lastSeenDay: nonNegativeInt(),
  knownIncidentIds: z.array(z.string()),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const NotableNpcWorldStateSchema = z.object({
  id: z.string(),
  name: GeneratedNameSchema,
  kind: z.string(),
  cultureId: z.string().optional(),
  factionId: z.string().optional(),
  customerGroupId: z.string().optional(),
  firstSeenDay: nonNegativeInt(),
  lastSeenDay: nonNegativeInt().optional(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const LocalEventWorldStateSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  label: z.string(),
  startedDay: nonNegativeInt(),
  endsDay: nonNegativeInt().optional(),
  intensity: meter(),
  relatedFactionIds: z.array(z.string()),
  relatedCultureIds: z.array(z.string()),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
})

export const TavernIdentityStateSchema = z.object({
  foundingDay: nonNegativeInt(),
  knownFor: z.array(z.string()),
  houseRules: z.array(z.string()),
  atmosphereTags: z.array(z.string()),
})

export const SocialRumourStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  strength: meter(),
  accuracy: z.enum(['true', 'partial', 'false', 'unknown']),
  sourceEntityId: z.string().optional(),
  targetEntityId: z.string().optional(),
  subject: EntityRefSchema.optional(),
  firstHeardDay: nonNegativeInt(),
  lastSpreadDay: nonNegativeInt(),
  tags: z.array(z.string()),
  involvedRefs: z.array(EntityRefSchema).optional(),
})

export const WorldStateSchema = z.object({
  cultures: z.record(z.string(), CultureWorldStateSchema),
  factions: z.record(z.string(), FactionWorldStateSchema),
  suppliers: z.record(z.string(), SupplierWorldStateSchema),
  regulars: z.record(z.string(), RegularWorldStateSchema),
  notableNpcs: z.record(z.string(), NotableNpcWorldStateSchema),
  localEvents: z.record(z.string(), LocalEventWorldStateSchema),
  tavernIdentity: TavernIdentityStateSchema,
  socialRumours: z.record(z.string(), SocialRumourStateSchema),
  rngStreams: z.record(z.string(), RngStateSchema).optional(),
})

// Phase 6 §6.1.1 — Module schema composition.
//
// Each registered simulation module may declare a `stateSchema` for its
// namespaced data under `state.modules[id]`. `buildModulesSchema` composes a
// dynamic schema from the modules supplied. Unknown keys are passed through
// (via `.passthrough()`) so a save envelope that references a disabled
// module still validates; the caller (validation.ts) surfaces those keys
// as warnings.
export function buildModulesSchema(
  modules: ReadonlyArray<SimulationModule>,
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType<unknown>> = {}
  for (const mod of modules) {
    if (mod.stateSchema) {
      shape[mod.id] = mod.stateSchema.optional()
    }
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<Record<string, unknown>>
}

// Compose the full TavernState schema. The `modules` argument lets the
// validator wire in currently-registered module schemas (Phase 6 §6.1.1).
export function buildTavernStateSchema(modules: ReadonlyArray<SimulationModule>) {
  return z.object({
    meta: TavernMetaStateSchema,
    calendar: CalendarStateSchema,
    coin: z.number().int().min(0),
    areas: z.record(z.string(), AreaStateSchema),
    stock: z.record(z.string(), StockItemStateSchema),
    staff: z.record(z.string(), StaffStateSchema),
    customerGroups: z.record(z.string(), CustomerGroupStateSchema),
    reputation: ReputationStateSchema,
    // Phase 25 §"Schema Additions" — top-level `world` branch.
    world: WorldStateSchema,
    memories: z.array(MemoryStateSchema),
    history: z.array(HistoryEntrySchema),
    causes: z.array(CauseEntrySchema),
    pressures: z.record(z.string(), PressureStateSchema),
    modules: buildModulesSchema(modules),
  })
}

// Default static schema (no modules registered). Useful for simple use
// and for tests that don't care about module-state composition.
export const TavernStateSchema = buildTavernStateSchema([])
