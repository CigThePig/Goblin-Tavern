import { z } from "zod";
import type { SimulationModule } from "../core/module";

// Phase 6 §6.1 — Core schemas.
//
// Each schema mirrors the corresponding Phase 5 type exactly: same field
// names, same shapes, no re-tuned ranges beyond what Phase 5 already
// specified. The 0–100 percentage range and the "stock quantity ≥ 0,
// no NaN" rules come from `phases-06-10.md` §"State Safety Rules".

const meter = () => z.number().min(0).max(100);
const nonNegativeNumber = () => z.number().min(0);
const nonNegativeInt = () => z.number().int().min(0);

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
    "supplier_day",
    "quiet_day",
    "market_day",
    "local_night",
    "payday",
    "brawl_night",
    "maintenance_day",
  ]),
  season: z.enum(["mudwake", "highsun", "redleaf", "deepfrost"]),
  tags: z.array(z.string()),
});

export const TavernMetaStateSchema = z.object({
  tavernId: z.string(),
  tavernName: z.string(),
  simVersion: z.string(),
  createdAtDay: nonNegativeInt(),
});

// Phase 28 §28.1 — Upgrade record carried on `AreaState.upgrades`. The
// status enum mirrors `AreaUpgradeStatus` on the TS type; `progress` is
// optional because an `available` upgrade has not been started, and
// `installedAtDay` is only set once an upgrade is actually installed.
// Expansion Phase 2 §2.2 / §5.7 — the construction fields land in the
// same phase as their schema. All optional, so a pre-Phase-2 save parses
// untouched.
export const AreaUpgradeStateSchema = z.object({
  id: z.string(),
  status: z.enum([
    "available",
    "in_progress",
    "paused",
    "installed",
    "damaged",
    "disabled",
    "cancelled",
  ]),
  progress: nonNegativeNumber().optional(),
  installedAtDay: nonNegativeInt().optional(),
  tags: z.array(z.string()),
  requiredProgress: nonNegativeNumber().optional(),
  startedAtDay: nonNegativeInt().optional(),
  coinInvested: nonNegativeNumber().optional(),
  ownerMinutesInvested: nonNegativeNumber().optional(),
  materialsUsed: z.record(z.string(), nonNegativeNumber()).optional(),
  lastProgressDay: nonNegativeInt().optional(),
  stalledReason: z.string().optional(),
  stalledDays: nonNegativeInt().optional(),
  pausedOnDay: nonNegativeInt().optional(),
  cancelledOnDay: nonNegativeInt().optional(),
  condition: meter().optional(),
  lastUpkeepDay: nonNegativeInt().optional(),
  upkeepDueDay: nonNegativeInt().optional(),
  damagedOnDay: nonNegativeInt().optional(),
  disabledReason: z.string().optional(),
  replacedUpgradeId: z.string().optional(),
});

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
});

// Phase 65 / ISSUE-025 §5.1 — `rarity` joins the stock state shape.
export const StockRaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "legendary",
]);

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
  rarity: StockRaritySchema,
});

// Phase 65 / ISSUE-025 §5.2 — Recipe state slice schema. Runtime
// tracking only; static config lives on `RecipeDefinition`.
export const RecipeStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  tags: z.array(z.string()),
  onMenu: z.boolean(),
  timesServed: z.number().int().min(0),
  daysSinceLastServed: z.number().int().min(0),
  lastServedDay: z.number().int().min(0).nullable(),
});

// Phase 70 / ISSUE-030 §5.3 — Expedition subsystem schemas.
export const ExpeditionModeSchema = z.enum(["open", "targeted"]);
export const ExpeditionTargetTierSchema = z.enum([
  "uncommon",
  "rare",
  "legendary",
]);
export const ExpeditionOutcomeSchema = z.enum([
  "success",
  "partial",
  "failure",
  "runner_lost",
  // Expansion Phase 9 §9.3 — recalled by the house, or turned back by the
  // party. Both are terminal and neither is a plain failure.
  "recalled",
  "retreated",
]);

export const ExpeditionSchema = z.object({
  id: z.string(),
  runnerId: z.string(),
  mode: ExpeditionModeSchema,
  targetTier: ExpeditionTargetTierSchema.nullable(),
  targetIngredientId: z.string().nullable(),
  daysTotal: z.number().int().min(1),
  daysElapsed: z.number().int().min(0),
  costPaid: z.number().min(0),
  startedDay: z.number().int().min(0),
  status: z.literal("in_progress"),
  seed: z.string(),
});

export const ExpeditionReturnedIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number().int().min(0),
  quality: z.number().min(0).max(100),
});

export const ExpeditionRecordSchema = z.object({
  id: z.string(),
  runnerId: z.string(),
  mode: ExpeditionModeSchema,
  targetTier: ExpeditionTargetTierSchema.nullable(),
  targetIngredientId: z.string().nullable(),
  daysTotal: z.number().int().min(1),
  costPaid: z.number().min(0),
  startedDay: z.number().int().min(0),
  resolvedDay: z.number().int().min(0),
  outcome: ExpeditionOutcomeSchema,
  returnedIngredients: z.array(ExpeditionReturnedIngredientSchema),
});

export const ExpeditionsStateSchema = z.object({
  active: z.array(ExpeditionSchema),
  completed: z.array(ExpeditionRecordSchema),
});

// Phase 22 / Phase 24 — `GeneratedName` is the structured output of the
// deterministic name generator. The schema is declared early because
// Phase 31 staff identity and Phase 30 world entities both reference
// it; world schemas re-export the same constant below.
export const GeneratedNameSchema = z.object({
  display: z.string(),
  profileId: z.string(),
  parts: z.record(z.string(), z.string()),
  patternId: z.string(),
  generatedBy: z.string(),
});

// Phase 31 §31.1 — persistent staff identity schema. Mirrors the
// `StaffIdentityState` shape on the TS side. `cultureId` and
// `backgroundHook` are optional because Phase 31 only requires a
// `groupId` + naming-profile pointer to anchor identity; cultures and
// background hooks are filled in where the identity profile provides
// them.
export const StaffWorkStyleSchema = z.enum([
  "steady",
  "fast",
  "careful",
  "social",
  "rough",
  "methodical",
  "improviser",
]);

export const StaffStressResponseSchema = z.enum([
  "withdraws",
  "snaps",
  "rushes",
  "overworks",
  "gets_sloppy",
  "asks_for_help",
]);

export const StaffIdentityStateSchema = z.object({
  groupId: z.string(),
  cultureId: z.string().optional(),
  namingProfileId: z.string(),
  personalityTags: z.array(z.string()),
  workStyle: StaffWorkStyleSchema,
  stressResponse: StaffStressResponseSchema,
  loyalties: z.array(z.string()),
  dislikes: z.array(z.string()),
  backgroundHook: z.string().optional(),
});

// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Bounded selection vocabulary attached to staff and regulars. The
// schemas mirror the TS shapes in `src/sim/content/cast/castTypes.ts`.
// Voice axes are constrained to {0, 1, 2}; affinity strength to {1, 2};
// polarity to a fixed enum. `verbalTic` is an open string at the
// schema layer — the verbal-tic registry enforces membership at the
// module/test layer (same pattern as `StaffState.role`).
export const VoiceAxisIdSchema = z.enum([
  "terseness",
  "warmth",
  "formality",
  "floridity",
]);
export const VoiceAxisValueSchema = z.number().int().min(0).max(2) as z.ZodType<
  0 | 1 | 2
>;

export const VoiceProfileSchema = z.object({
  axes: z.object({
    terseness: VoiceAxisValueSchema,
    warmth: VoiceAxisValueSchema,
    formality: VoiceAxisValueSchema,
    floridity: VoiceAxisValueSchema,
  }),
  verbalTic: z.string().optional(),
});

export const AffinityAxisSchema = z.object({
  target: z.string(),
  polarity: z.enum(["toward", "away"]),
  strength: z.union([z.literal(1), z.literal(2)]),
});

export const CastAttributesSchema = z.object({
  specialty: z.string(),
  blindspot: z.string(),
  affinities: z.array(AffinityAxisSchema),
  voice: VoiceProfileSchema,
  // Phase 4a (teleology) — optional link to a staged arc in `state.arcs`,
  // tracked alongside loyalty. Optional so pre-4a saves validate untouched.
  arcId: z.string().optional(),
});

// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
//
// Customer groups carry a voice-only attribute set (cohorts aren't
// individuals; specialty/blindspot/affinities don't fit a crowd, and
// the existing `preferredStockTags` / `dislikedTags` /
// `relationshipToOtherGroups` fields already mechanically encode
// collective likes/dislikes). Suppliers, factions, and notable NPCs
// reuse `CastAttributesSchema` directly via the aliases declared in
// `castTypes.ts` — no new schema needed for those three.
export const CustomerGroupCastAttributesSchema = z.object({
  voice: VoiceProfileSchema,
});

// Phase 11 §11.1 — `role` is a registry-validated string (`StaffRoleId`),
// not a hard-coded union, per the "Role typing clarification" forward
// note. The schema accepts any string; the staff module's validate hook
// surfaces unknown role ids as structural issues so registry membership
// is enforced at the module layer (mirrors how Phase 8 area validation
// works). `currentPriority` is similarly registry-string typed and
// optional.
//
// Expansion Phase 3 §3.1–§3.3 — schemas for the persistent workforce fields.
export const StaffShiftIdSchema = z.enum(["early", "late", "double", "rest"]);
export const StaffAbsenceKindSchema = z.enum([
  "illness",
  "injury",
  "leave",
  "unexcused",
  "notice_served",
]);
export const StaffAbsenceStateSchema = z.object({
  kind: StaffAbsenceKindSchema,
  startedOnDay: z.number().int(),
  untilDay: z.number().int(),
  reason: z.string(),
});
export const StaffCareerGoalSchema = z.enum([
  "mastery",
  "coin",
  "security",
  "standing",
]);

// Phase 31 §31.1 — `identity` is optional at the schema level so
// pre-Phase-31 saves can still parse during the migration window. The
// staff module's validate hook (Phase 31 §31.11) surfaces missing
// identity as a structural issue on fresh state; the
// `ensureStaffIdentityFields` migration helper attaches defaults to
// older saves before they reach validation.
export const StaffStateSchema = z.object({
  id: z.string(),
  name: GeneratedNameSchema,
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
  identity: StaffIdentityStateSchema.optional(),
  // Phase 121 / ISSUE-090 — optional during migration window;
  // `ensureCastAttributes` attaches defaults to pre-Phase-A saves.
  castAttributes: CastAttributesSchema.optional(),
  // Expansion Phase 3 §5.7 — the persistent workforce fields. Optional at the
  // schema layer so a pre-Phase-3 save parses; `ensureStaffWorkforceFields`
  // fills them before validation, and the staff module's validate hook
  // surfaces a member still missing them on live state.
  shift: StaffShiftIdSchema.optional(),
  assignedAreaId: z.string().optional(),
  absence: StaffAbsenceStateSchema.optional(),
  experience: meter().optional(),
  crossTraining: z.record(z.string(), meter()).optional(),
  careerGoal: StaffCareerGoalSchema.optional(),
  daysEmployed: z.number().int().min(0).optional(),
  consecutiveDaysWorked: z.number().int().min(0).optional(),
});

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
  // Phase 72 / ISSUE-032 §5.6 — optional renown-activation threshold.
  minRenownThreshold: z.number().min(0).max(100).optional(),
  // Phase 128 / ISSUE-097 — optional during migration window;
  // `ensureCastAttributes` attaches defaults to pre-Phase-2 saves.
  castAttributes: CustomerGroupCastAttributesSchema.optional(),
});

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
  // Phase 67 / ISSUE-027 §5.5 — `culinary_renown` tracks fame for
  // rare-ingredient sourcing and preparation. Initial value 10.
  culinary_renown: meter(),
});

// Phase 16 §"Calendar Stamp" — stable timestamp shared by memories and
// history entries. `absoluteDay` mirrors `CalendarState.totalDaysElapsed`.
export const CalendarStampSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  week: z.number().int().min(1).max(4),
  day: z.number().int().min(1).max(28),
  absoluteDay: nonNegativeInt(),
});

// Phase 25 §"EntityRef Expansion" — the `kind` enum is widened with
// world-entity kinds so memories and causes can reference cultures,
// factions, suppliers, regulars, notable NPCs, local events, social
// rumours, and the tavern's own identity record.
export const EntityRefSchema = z.object({
  kind: z.enum([
    "staff",
    "customer_group",
    "area",
    "stock",
    "role",
    "system",
    "other",
    "culture",
    "faction",
    "supplier",
    "regular",
    "notable_npc",
    "local_event",
    "rumour",
    "tavern_identity",
    // Phase 67 / ISSUE-027 — culinary-renown drift attributes back to
    // the proximate recipe; reference validation handles `recipe`
    // refs by checking `state.recipes` membership.
    "recipe",
  ]),
  id: z.string(),
});

// Phase 16 §"Memory Shape" — replaces the Phase 5 placeholder. The
// `'hook'` type was renamed to `'future_hook'` and `'pattern'` joined
// the canonical set; the new optional fields (`label`, `definitionId`,
// `createdAt`, `expiresAt`, `actors`, `locations`, `relatedSystems`,
// `decayRate`, `source`, `metadata`) give memories enough context for
// later phases to reason about them.
export const MemoryStateSchema = z.object({
  id: z.string(),
  type: z.enum(["fact", "timed", "grudge", "pattern", "future_hook"]),
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
});

// Phase 16 §"History Log Shape" — append-only debug log.
export const HistoryEntrySchema = z.object({
  id: z.string(),
  timestamp: CalendarStampSchema,
  category: z.enum([
    "owner_action",
    "service",
    "weekly",
    "monthly",
    "state_change",
    "memory",
    "pressure",
    "system",
  ]),
  summary: z.string(),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  mechanicalRefs: z.array(z.string()).optional(),
});

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
    "owner_action",
    "service",
    "area",
    "stock",
    "staff",
    "customer",
    "weekly",
    "monthly",
    "memory",
    "pressure",
    "system",
    "culture",
    "faction",
    "supplier",
    "regular",
    "notable_npc",
    "local_event",
    "rumour",
  ]),
  target: z.string(),
  targetType: z.enum([
    "coin",
    "area",
    "stock",
    "staff",
    "customer",
    "reputation",
    "pressure",
    "memory",
    "global",
    "culture",
    "faction",
    "supplier",
    "regular",
    "notable_npc",
    "local_event",
    "rumour",
    "tavern_identity",
    // Phase 65 / ISSUE-025 — recipe state mutations carry the
    // `recipe` target type so the cause schema accepts them.
    "recipe",
  ]),
  amount: z.number(),
  direction: z.enum(["increase", "decrease", "neutral"]),
  weight: z.number().min(0),
  readable: z.string(),
  tags: z.array(z.string()),
  relatedActors: z.array(EntityRefSchema),
  relatedLocations: z.array(EntityRefSchema),
  relatedSystems: z.array(z.string()),
  ageDays: nonNegativeInt(),
  expiresAfterDays: nonNegativeInt().optional(),
});

export const PressureStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: meter(),
  trend: z.number(),
  tags: z.array(z.string()),
  topCauses: z.array(z.string()),
});

// Phase 25 §"Schema Additions" — schemas for the new top-level `world`
// branch. Identity-style numbers (familiarity, comfort, tension,
// relationship, influence, trust, fear, reliability, debtTolerance,
// loyalty, irritation, intensity, strength) reuse `meter()`. `priceBias`
// is intentionally a free number because it may be negative.
// `GeneratedNameSchema` is declared earlier (alongside the Phase 31
// staff identity schema) so the staff schema can reference it without
// a forward reference.

const RngStateSchema = z.object({
  seed: z.string(),
  calls: nonNegativeInt(),
});

export const CultureWorldStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  familiarity: meter(),
  comfort: meter(),
  tension: meter(),
  // Expansion Phase 8 §8.2 — optional during the migration window; a
  // pre-Phase-8 save carries no trust and `ensureCultureAgencyFields`
  // derives one from the comfort and tension it already has.
  trust: meter().optional(),
  namingProfileId: z.string(),
  preferredStockTags: z.array(z.string()),
  dislikedTags: z.array(z.string()),
  importantCalendarTags: z.array(z.string()),
  tags: z.array(z.string()),
});

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
  // Phase 128 / ISSUE-097 — optional during migration window.
  castAttributes: CastAttributesSchema.optional(),
});

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
  // Phase 128 / ISSUE-097 — optional during migration window.
  castAttributes: CastAttributesSchema.optional(),
});

// Expansion Phase 4 §4.3 — a regular's bounded service memory and open request.
export const RegularServiceMemoryEntrySchema = z.object({
  onDay: nonNegativeInt(),
  kind: z.enum([
    "served_favourite",
    "good_service",
    "waited",
    "abandoned",
    "turned_away",
    "shortage",
    "incident",
    "tab_forgiven",
    "tab_chased",
    "request_granted",
    "request_ignored",
  ]),
  weight: z.number(),
  readable: z.string(),
});

export const RegularRequestSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "stock_favourite",
    "keep_my_seat",
    "quieter_room",
    "forgive_my_slate",
  ]),
  subjectId: z.string().optional(),
  openedOnDay: nonNegativeInt(),
  expiresOnDay: nonNegativeInt(),
  readable: z.string(),
  status: z.enum(["open", "granted", "refused", "expired"]),
});

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
  // Phase 121 / ISSUE-090 — optional during migration window;
  // `ensureCastAttributes` attaches defaults to pre-Phase-A saves.
  castAttributes: CastAttributesSchema.optional(),
  // Expansion Phase 4 §4.3 — the active-participant fields. All optional so a
  // pre-Phase-4 save validates unchanged; `ensureRegularServiceFields` fills
  // them on load.
  favoriteRecipeId: z.string().optional(),
  favoriteAreaId: z.string().optional(),
  ownerStanding: meter().optional(),
  serviceMemory: z.array(RegularServiceMemoryEntrySchema).optional(),
  openRequest: RegularRequestSchema.optional(),
  lastVisitOutcome: z
    .enum(["served", "abandoned", "turned_away", "no_visit"])
    .optional(),
  consecutiveBadVisits: nonNegativeInt().optional(),
  stoppedVisiting: z
    .object({ sinceDay: nonNegativeInt(), reason: z.string() })
    .optional(),
  wordOfMouth: z
    .object({
      recommendations: nonNegativeInt(),
      criticisms: nonNegativeInt(),
    })
    .optional(),
});

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
  // Phase 128 / ISSUE-097 — optional during migration window;
  // runtime creation via `createNotableNpc` always populates it.
  castAttributes: CastAttributesSchema.optional(),
});

// Phase 69 / ISSUE-029 §5.4 — Hireable adventurer roster schema.
export const HireableAdventurerSchema = z.object({
  id: z.string(),
  name: GeneratedNameSchema,
  cultureId: z.string(),
  experience: meter(),
  reliability: meter(),
  relationship: meter(),
  specialty: z.string().nullable(),
  wageBase: z.number().min(0),
  daysSinceLastJob: nonNegativeInt(),
  currentExpeditionId: z.string().nullable(),
  joinedDay: nonNegativeInt(),
  tags: z.array(z.string()),
  activeFlags: z.array(z.string()),
});

// Phase 35 §35.2 — arc lifecycle stages.
export const LocalArcStageSchema = z.enum([
  "seeded",
  "rising",
  "active",
  "climax",
  "resolved",
  "failed",
]);

export const LocalArcHistoryRecordSchema = z.object({
  day: nonNegativeInt(),
  stage: LocalArcStageSchema,
  note: z.string(),
});

// Phase 25 §"World State Schema" / Phase 35 §35.3 — extended with
// optional arc fields. Legacy local-event records without arc semantics
// still validate; Phase 35 arcs add `type`, `stage`, `lastUpdatedDay`,
// `ageDays`, `relatedRefs`, `activeEffects`, and `arcHistory`.
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
  // Phase 35 §35.3 — arc-specific fields.
  type: z.string().optional(),
  stage: LocalArcStageSchema.optional(),
  lastUpdatedDay: nonNegativeInt().optional(),
  ageDays: nonNegativeInt().optional(),
  relatedRefs: z.array(EntityRefSchema).optional(),
  activeEffects: z.array(z.string()).optional(),
  arcHistory: z.array(LocalArcHistoryRecordSchema).optional(),
});

export const TavernIdentityStateSchema = z.object({
  foundingDay: nonNegativeInt(),
  knownFor: z.array(z.string()),
  houseRules: z.array(z.string()),
  atmosphereTags: z.array(z.string()),
});

export const SocialRumourStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  strength: meter(),
  accuracy: z.enum(["true", "partial", "false", "unknown"]),
  sourceEntityId: z.string().optional(),
  targetEntityId: z.string().optional(),
  subject: EntityRefSchema.optional(),
  firstHeardDay: nonNegativeInt(),
  lastSpreadDay: nonNegativeInt(),
  tags: z.array(z.string()),
  involvedRefs: z.array(EntityRefSchema).optional(),
  // Expansion Phase 8 §8.4 — all optional during the migration window;
  // `ensureRumourNetworkFields` fills them from what the save already knows.
  credibility: meter().optional(),
  reach: z.enum(["private", "public"]).optional(),
  audiences: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["culture", "faction", "customer_group", "notable_npc"]),
        belief: meter(),
        heardOnDay: nonNegativeInt(),
        fromId: z.string().optional(),
      }),
    )
    .optional(),
  distortion: meter().optional(),
  originalLabel: z.string().optional(),
  hops: nonNegativeInt().optional(),
  counterRumourId: z.string().optional(),
  correctedOnDay: nonNegativeInt().optional(),
  originRef: EntityRefSchema.optional(),
});

export const WorldStateSchema = z.object({
  cultures: z.record(z.string(), CultureWorldStateSchema),
  factions: z.record(z.string(), FactionWorldStateSchema),
  suppliers: z.record(z.string(), SupplierWorldStateSchema),
  regulars: z.record(z.string(), RegularWorldStateSchema),
  notableNpcs: z.record(z.string(), NotableNpcWorldStateSchema),
  localEvents: z.record(z.string(), LocalEventWorldStateSchema),
  tavernIdentity: TavernIdentityStateSchema,
  socialRumours: z.record(z.string(), SocialRumourStateSchema),
  // Phase 69 / ISSUE-029 §5.4 — hireable adventurer roster.
  hireableAdventurers: z.record(z.string(), HireableAdventurerSchema),
  rngStreams: z.record(z.string(), RngStateSchema).optional(),
});

export const TeleologyLifecycleStatusSchema = z.enum([
  "active",
  "completed",
  "failed",
  "paused",
]);

export const TeleologyEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["venture", "arc"]),
  label: z.string(),
  stage: z.string(),
  progress: nonNegativeNumber(),
  status: TeleologyLifecycleStatusSchema,
  tags: z.array(z.string()),
  createdAtDay: nonNegativeInt(),
  updatedAtDay: nonNegativeInt(),
});

export const TransformationStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  active: z.boolean(),
  tags: z.array(z.string()),
  createdAtDay: nonNegativeInt(),
  activatedAtDay: nonNegativeInt().optional(),
});

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
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const mod of modules) {
    if (mod.stateSchema) {
      shape[mod.id] = mod.stateSchema.optional();
    }
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<
    Record<string, unknown>
  >;
}

// Compose the full TavernState schema. The `modules` argument lets the
// validator wire in currently-registered module schemas (Phase 6 §6.1.1).
export function buildTavernStateSchema(
  modules: ReadonlyArray<SimulationModule>,
) {
  return z.object({
    meta: TavernMetaStateSchema,
    calendar: CalendarStateSchema,
    coin: z.number().int().min(0),
    areas: z.record(z.string(), AreaStateSchema),
    stock: z.record(z.string(), StockItemStateSchema),
    staff: z.record(z.string(), StaffStateSchema),
    customerGroups: z.record(z.string(), CustomerGroupStateSchema),
    reputation: ReputationStateSchema,
    // Phase 65 / ISSUE-025 §5.2 — recipe slice.
    recipes: z.record(z.string(), RecipeStateSchema),
    // Phase 70 / ISSUE-030 §5.3 — expedition subsystem state.
    expeditions: ExpeditionsStateSchema,
    // Phase 25 §"Schema Additions" — top-level `world` branch.
    world: WorldStateSchema,
    ventures: z.record(z.string(), TeleologyEntrySchema),
    arcs: z.record(z.string(), TeleologyEntrySchema),
    transformations: z.record(z.string(), TransformationStateSchema),
    memories: z.array(MemoryStateSchema),
    history: z.array(HistoryEntrySchema),
    causes: z.array(CauseEntrySchema),
    pressures: z.record(z.string(), PressureStateSchema),
    modules: buildModulesSchema(modules),
  });
}

// Default static schema (no modules registered). Useful for simple use
// and for tests that don't care about module-state composition.
export const TavernStateSchema = buildTavernStateSchema([]);
