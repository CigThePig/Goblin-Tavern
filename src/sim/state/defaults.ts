import { createInitialCalendar } from "../modules/calendar/index";
import {
  areaRegistry,
  ensureRequiredAreasRegistered,
} from "../registries/areaRegistry";
import {
  ensureRequiredStockRegistered,
  stockRegistry,
} from "../registries/stockRegistry";
import {
  ensureRequiredRecipesRegistered,
  recipeRegistry,
} from "../registries/recipeRegistry";
import {
  customerRegistry,
  ensureRequiredCustomerGroupsRegistered,
} from "../registries/customerRegistry";
import {
  ensureRequiredStaffRolesRegistered,
  staffRegistry,
} from "../registries/staffRegistry";
import { regularServiceDefaults } from "../modules/regulars/regularDefaults";
import { createInitialStockModuleState } from "../modules/stock/state";
import { createInitialOwnerActionsModuleState } from "../modules/ownerActions/ownerActionsModule";
import { createInitialWeeklyModuleState } from "../modules/weekly/state";
import { createInitialMonthlyModuleState } from "../modules/monthly/monthlyModule";
import { createInitialAttributionModuleState } from "../modules/attribution/attributionModule";
import { createInitialResponsesModuleState } from "../modules/responses/responsesModule";
import { createInitialCauseModuleState } from "../modules/causes/causeModule";
import { createInitialPressureModuleState } from "../modules/pressures/pressureModule";
import { createInitialFeedbackModuleState } from "../modules/feedback/feedbackLoopModule";
import { createInitialIssueSeedModuleState } from "../modules/issues/issueSeedTypes";
import { createInitialLocalArcsModuleState } from "../modules/localArcs/state";
import { createInitialSupplierModuleState } from "../modules/suppliers/state";
import {
  ensureRequiredSuppliersRegistered,
  supplierRegistry,
} from "../content/suppliers/supplierRegistry";
import { createStaffIdentity } from "../content/staff/staffIdentityFactory";
import { ensureRequiredStaffIdentityProfilesRegistered } from "../content/staff/staffIdentityProfiles";
import {
  createCustomerGroupCastAttributes,
  createFactionCastAttributes,
  createRegularCastAttributes,
  createStaffCastAttributes,
  createSupplierCastAttributes,
} from "../content/cast/createCastAttributes";
import { ensureRequiredVerbalTicsRegistered } from "../content/cast/verbalTics";
import { createNotableNpc } from "../content/npc/npcFactory";
import {
  createHireableAdventurer,
  ADVENTURER_CULTURE_ID,
} from "../content/npc/adventurerFactory";
import {
  ensureRequiredNotableNpcProfilesRegistered,
  notableNpcProfileRegistry,
} from "../content/npc/notableNpcProfiles";
import { createRngStreams } from "../core/rng";
import { withWorkforceDefaults } from "../modules/staff/workforceDefaults";
import { createInitialStaffModuleState } from "../modules/staff/workforceState";
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from "../content/cultures/cultureRegistry";
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from "../content/factions/factionRegistry";
import { createInitialRegularModuleState } from "../modules/regulars/state";
import { generateName } from "../content/naming/nameGenerator";
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from "../content/naming/namingProfiles";
import type {
  AreaState,
  CultureWorldState,
  CustomerGroupState,
  FactionWorldState,
  HireableAdventurer,
  NotableNpcWorldState,
  PressureState,
  RecipeState,
  TransformationState,
  TeleologyEntry,
  RegularWorldState,
  ReputationState,
  StaffState,
  StockState,
  SupplierWorldState,
  TavernState,
  WorldState,
} from "./TavernState";
import { applyDifficultyToBase, type DifficultyConfig } from "./difficulty";
import { createInitialRulesetModuleState } from "../contracts/ruleset/query";
import { createInitialMetersModuleState } from "../contracts/meters/detail";
import { createInitialScheduledEventsModuleState } from "../contracts/scheduledEvents/state";
import { createInitialObligationsModuleState } from "../contracts/obligations/state";
import { createInitialFinanceModuleState } from "../modules/finance/state";
import { createInitialTenancyModuleState } from "../modules/tenancy/state";
import { createInitialRegulatoryModuleState } from "../modules/regulatory/state";
import { createInitialFactionModuleState } from "../modules/factions/factionState";
import { createInitialCultureModuleState } from "../modules/cultures/cultureState";
import { createInitialNpcModuleState } from "../modules/npcs/npcState";
import { createInitialEconomyModuleState } from "../modules/economy/state";

// Phase 8 §8.1 — Area defaults are sourced from `areaRegistry` rather than
// inlined. The registry holds the same Phase 5 numbers, so this is a
// consolidation rather than a value change. Importing the registry has the
// side effect of self-registering the five required areas via
// `ensureRequiredAreasRegistered`.
function createInitialTeleologyEntries(): Record<string, TeleologyEntry> {
  return {};
}

function createInitialTransformations(): Record<string, TransformationState> {
  return {};
}

function createInitialAreas(): Record<string, AreaState> {
  ensureRequiredAreasRegistered();
  const areas: Record<string, AreaState> = {};
  for (const def of areaRegistry.all()) {
    areas[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
      activeProblems: [...def.defaultState.activeProblems],
    };
  }
  return areas;
}

// Phase 9 §9.1 — Stock defaults are sourced from `stockRegistry` rather
// than inlined. The registry holds the Phase 5 quantity/quality/spoilage
// numbers plus the new Phase 9 price/storage fields. Importing the
// registry has the side effect of self-registering the six required
// items via `ensureRequiredStockRegistered`.
function createInitialStock(): Record<string, StockState> {
  ensureRequiredStockRegistered();
  const stock: Record<string, StockState> = {};
  for (const def of stockRegistry.all()) {
    stock[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
    };
  }
  return stock;
}

// Phase 65 / ISSUE-025 §5.2 — Recipe defaults are sourced from
// `recipeRegistry`. Each registered recipe seeds one `RecipeState`
// entry keyed by recipe id. The six starter recipes ship with
// `onMenu: true` so the default service flow keeps serving the same
// stock items via 1:1 recipe wrappers.
function createInitialRecipes(): Record<string, RecipeState> {
  ensureRequiredRecipesRegistered();
  const recipes: Record<string, RecipeState> = {};
  for (const def of recipeRegistry.all()) {
    recipes[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
    };
  }
  return recipes;
}

// Phase 11 §11.1 / Phase 31 §31.8 — Staff defaults are sourced from
// `staffRegistry` rather than inlined. Phase 31 adds deterministic
// identity to every seeded staff member.
//
// `createInitialTavernState` does not accept a seed (Phase 31 §31.8
// "Determinism Note"), so default staff identity uses a stable internal
// seed (`'initial-staff-identity'`) routed through the canonical
// `staff_identity` RNG stream. Same default state -> same default
// identities, every time. Later simulation-spawned staff can use the
// daily input seed via `ctx.getRngStream('staff_identity')`.
//
// Audit fixes pass 1 §1.1 — the generated `GeneratedName` lives on
// `staff.name`; readers wanting just the display string use
// `staff.name.display`.
function createInitialStaff(): Record<string, StaffState> {
  ensureRequiredStaffRolesRegistered();
  ensureRequiredStaffIdentityProfilesRegistered();
  ensureRequiredVerbalTicsRegistered();
  const streams = createRngStreams("initial-staff-identity");
  const identityRng = streams.get("staff_identity");
  const existingNames = new Set<string>();
  const staff: Record<string, StaffState> = {};
  // Phase 31 §31.8 — iterate in a stable registry order so a future
  // refactor of the registry's storage doesn't shift staff names.
  const orderedDefs = [...staffRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const def of orderedDefs) {
    // Phase 71 / ISSUE-031 §4.3 — cook-tier roles (kitchen_hand,
    // seasoned_cook, master_chef) are registered as hireable role
    // definitions but not seeded on day zero. The flag defaults to
    // true so existing roles continue to spawn their canonical staff
    // member.
    if (def.seedOnDayZero === false) continue;
    const { identity, generatedName } = createStaffIdentity({
      staffId: def.defaultStaffId,
      roleId: def.id,
      rng: identityRng,
      existingNames,
    });
    existingNames.add(generatedName.display);
    // Phase 121 / ISSUE-090 — Living Cast Phase A. The cast attribute
    // rolls land on the SAME staff_identity stream, AFTER the existing
    // name + work-style + stress-response + background-hook rolls. That
    // ordering is load-bearing: it keeps every canonical pre-Phase-A
    // identity field byte-identical and only burns new rolls at the
    // end of the per-staff sequence.
    const castAttributes = createStaffCastAttributes({
      roleId: def.id,
      ...(identity.cultureId !== undefined
        ? { cultureId: identity.cultureId }
        : {}),
      rng: identityRng,
    });
    // Expansion Phase 3 §3.1 — the workforce fields are DERIVED from identity
    // and the role, never rolled, so adding them burned no RNG call and every
    // canonical day-zero name is byte-identical to what it was before.
    staff[def.defaultStaffId] = withWorkforceDefaults({
      id: def.defaultStaffId,
      name: generatedName,
      role: def.id,
      tags: [...def.defaultTags],
      ...def.defaultState,
      activeFlags: [...def.defaultState.activeFlags],
      identity,
      castAttributes,
    });
  }
  return staff;
}

// Phase 10 §10.1 — Customer-group defaults are sourced from
// `customerRegistry` rather than inlined. The registry holds the Phase 5
// numbers for the existing fields plus the new Phase 10 fields
// (`loyalty`, `preferredStockTags`, `dislikedTags`). Importing the
// registry has the side effect of self-registering the five required
// groups via `ensureRequiredCustomerGroupsRegistered`.
function createInitialCustomerGroups(): Record<string, CustomerGroupState> {
  ensureRequiredCustomerGroupsRegistered();
  ensureRequiredVerbalTicsRegistered();
  // Phase 128 / ISSUE-097 — one identity stream per actor kind, mirroring
  // the `'initial-staff-identity'` pattern. Sort by id so a future
  // registry-storage refactor doesn't shift assignments.
  const streams = createRngStreams("initial-customer-group-identity");
  const identityRng = streams.get("customer_group_identity");
  const groups: Record<string, CustomerGroupState> = {};
  const orderedDefs = [...customerRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const def of orderedDefs) {
    const castAttributes = createCustomerGroupCastAttributes({
      cultureId: def.defaultState.cultureId,
      rng: identityRng,
    });
    groups[def.id] = {
      id: def.id,
      label: def.label,
      tags: [...def.tags],
      ...def.defaultState,
      preferredStockTags: [...def.defaultState.preferredStockTags],
      dislikedTags: [...def.defaultState.dislikedTags],
      activeGrudges: [...def.defaultState.activeGrudges],
      // Phase 30 §30.2 — defensively clone the relationship map so two
      // groups do not share a mutable reference into the registry.
      relationshipToOtherGroups: {
        ...def.defaultState.relationshipToOtherGroups,
      },
      castAttributes,
    };
  }
  return groups;
}

function createInitialReputation(): ReputationState {
  return {
    cheap: 60,
    tasty: 35,
    filthy: 65,
    dangerous: 40,
    cozy: 20,
    strange: 35,
    reliable: 30,
    goblinAuthentic: 70,
    // Phase 15 §15.5 — `respectable` joins the canonical axis set. The
    // seed value is intentionally low: the Crooked Keg starts dirty,
    // cheap, and rough — the player must earn respectability.
    respectable: 25,
    // Phase 67 / ISSUE-027 §5.5 — culinary renown tracks fame for
    // sourcing rare ingredients and executing rare preparations. The
    // tavern starts with almost no culinary reputation; it serves
    // stew and ale and that's it.
    culinary_renown: 10,
  };
}

// Phase 18 §"Naming reconciliation" — the canonical pressure id set drops
// the `_pressure` suffix used in the Phase 18 doc shorthand. Phase 18
// also folds in `stock_shortage` and `landlord`, and replaces the Phase
// 5 placeholder `structural_decay` with `maintenance` (the broader
// concept covering damage, cleanliness, and repair backlog).
function createInitialPressures(): Record<string, PressureState> {
  // Phase 38 §38.1 — Expanded pressure ids are seeded alongside the
  // canonical ten so `state.pressures[id]` exists from day zero. Starting
  // values are low; the per-day calculator pass shapes them from
  // memories, attributions, world state, and arcs.
  const baseValues: Record<string, number> = {
    food_safety: 35,
    inspection: 25,
    staff_burnout: 25,
    pests: 35,
    debt: 10,
    maintenance: 35,
    violence: 30,
    reputation_drift: 20,
    stock_shortage: 20,
    landlord: 20,
    // Phase 38 §38.1 — Expanded ids.
    supplier_distrust: 0,
    regular_customer_loss: 0,
    staff_loyalty_risk: 0,
    faction_anger: 0,
    cultural_tension: 0,
    rival_tavern_pressure: 0,
    festival_readiness: 0,
    market_instability: 0,
    rumour_pressure: 0,
    policy_backlash: 0,
    arc_escalation: 0,
  };

  const labels: Record<string, string> = {
    food_safety: "Food Safety",
    inspection: "Inspection",
    staff_burnout: "Staff Burnout",
    pests: "Pests",
    debt: "Debt",
    maintenance: "Maintenance",
    violence: "Violence",
    reputation_drift: "Reputation Drift",
    stock_shortage: "Stock Shortage",
    landlord: "Landlord",
    supplier_distrust: "Supplier Distrust",
    regular_customer_loss: "Regular Customer Loss",
    staff_loyalty_risk: "Staff Loyalty Risk",
    faction_anger: "Faction Anger",
    cultural_tension: "Cultural Tension",
    rival_tavern_pressure: "Rival Tavern Pressure",
    festival_readiness: "Festival Readiness",
    market_instability: "Market Instability",
    rumour_pressure: "Rumour Pressure",
    policy_backlash: "Policy Backlash",
    arc_escalation: "Arc Escalation",
  };

  const pressures: Record<string, PressureState> = {};
  for (const id of Object.keys(baseValues)) {
    pressures[id] = {
      id,
      label: labels[id] ?? id,
      value: baseValues[id] ?? 0,
      trend: 0,
      tags: [],
      topCauses: [],
    };
  }
  return pressures;
}

// Phase 29 §29.2 — Seed `state.world.suppliers` from the supplier
// registry. The Phase 22 skeleton reserved the slot empty; Phase 29 fills
// it with the registered starter suppliers so the rest of the simulation
// can read them as persistent world entities. Names are static and
// generated-name-shaped (per §29.2 "Determinism Note") because default
// state generation does not currently accept a seed — true random names
// will be produced later during `identityGeneration` when `ctx.rng` is
// available.
function createInitialSuppliers(): Record<string, SupplierWorldState> {
  ensureRequiredSuppliersRegistered();
  ensureRequiredVerbalTicsRegistered();
  // Phase 128 / ISSUE-097 — supplier identity stream, sorted iteration.
  const streams = createRngStreams("initial-supplier-identity");
  const identityRng = streams.get("supplier_identity");
  const suppliers: Record<string, SupplierWorldState> = {};
  const orderedDefs = [...supplierRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const def of orderedDefs) {
    const castAttributes = createSupplierCastAttributes({
      supplierType: def.supplierType,
      ...(def.cultureId !== undefined ? { cultureId: def.cultureId } : {}),
      rng: identityRng,
    });
    suppliers[def.id] = {
      id: def.id,
      label: def.label,
      name: {
        display: def.label,
        profileId: def.namingProfileId,
        parts: {},
        patternId: "given_family",
        generatedBy: "supplier_registry",
      },
      supplierType: def.supplierType,
      reliability: def.defaultReliability,
      relationship: def.defaultRelationship,
      debtTolerance: def.defaultDebtTolerance,
      priceBias: def.defaultPriceBias,
      goodsProvided: [...def.goodsProvided],
      ...(def.factionId !== undefined ? { factionId: def.factionId } : {}),
      ...(def.cultureId !== undefined ? { cultureId: def.cultureId } : {}),
      tags: [...def.tags],
      activeFlags: [],
      castAttributes,
    };
  }
  return suppliers;
}

// Phase 30 §30.3 — Seed `state.world.cultures` from the culture
// registry. Each registered culture becomes a persistent world entity
// with the meters and tag lists declared in its definition.
function createInitialCultures(): Record<string, CultureWorldState> {
  ensureRequiredCulturesRegistered();
  const cultures: Record<string, CultureWorldState> = {};
  for (const def of cultureRegistry.all()) {
    cultures[def.id] = {
      id: def.id,
      label: def.label,
      familiarity: def.defaultFamiliarity,
      comfort: def.defaultComfort,
      tension: def.defaultTension,
      trust: def.defaultTrust,
      namingProfileId: def.namingProfileId,
      preferredStockTags: [...def.preferredStockTags],
      dislikedTags: [...def.dislikedTags],
      importantCalendarTags: [...def.importantCalendarTags],
      tags: [...def.tags],
    };
  }
  return cultures;
}

// Phase 30 §30.5 — Seed `state.world.factions` from the faction
// registry. Each registered faction becomes a persistent world entity
// with its starting relationship/influence/trust/fear meters.
function createInitialFactions(): Record<string, FactionWorldState> {
  ensureRequiredFactionsRegistered();
  ensureRequiredVerbalTicsRegistered();
  // Phase 128 / ISSUE-097 — faction identity stream, sorted iteration.
  const streams = createRngStreams("initial-faction-identity");
  const identityRng = streams.get("faction_identity");
  const factions: Record<string, FactionWorldState> = {};
  const orderedDefs = [...factionRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const def of orderedDefs) {
    const castAttributes = createFactionCastAttributes({
      ...(def.cultureId !== undefined ? { cultureId: def.cultureId } : {}),
      rng: identityRng,
    });
    factions[def.id] = {
      id: def.id,
      label: def.label,
      ...(def.cultureId !== undefined ? { cultureId: def.cultureId } : {}),
      relationship: def.defaultRelationship,
      influence: def.defaultInfluence,
      trust: def.defaultTrust,
      fear: def.defaultFear,
      tags: [...def.tags],
      activeFlags: [],
      castAttributes,
    };
  }
  return factions;
}

// Audit fixes pass 1 §1.3 — Seed a roster of starter regulars at day 0
// across the registered customer groups, so identity richness, regular
// memories, and the `regular_customer` seed family can be exercised
// during cardless gate runs without waiting for the emergence
// thresholds in `regularModule` to be cleared. Names are generated once,
// deterministically, through the `regular_identity` RNG stream so the
// roster does not drift across re-renders.
type StarterRegularSpec = {
  groupId: string;
  loyalty: number;
  // Phase 50 / ISSUE-010 — Optional override that lets a starter regular
  // adopt a cross-cutting culture (religious / outsider / professional)
  // instead of inheriting the group's primary culture. This is how cross-
  // cutting cultures get members across multiple customer-group bases at
  // day 0.
  cultureId?: string;
  // Phase 51 / ISSUE-011 — Optional faction binding so the
  // `regular ← faction` channel (notable-NPC factory pattern from
  // Phase 44) has day-0 reachable starter targets without waiting on
  // emergence.
  factionId?: string;
};

const STARTER_REGULAR_SPECS: StarterRegularSpec[] = [
  { groupId: "local_goblins", loyalty: 72 },
  { groupId: "local_goblins", loyalty: 65, cultureId: "shrine_devotees" },
  { groupId: "local_goblins", loyalty: 58 },
  { groupId: "miners", loyalty: 68, cultureId: "shrine_devotees" },
  { groupId: "miners", loyalty: 70, factionId: "miners_union" },
  { groupId: "merchants", loyalty: 62, cultureId: "traveling_outsiders" },
  {
    groupId: "merchants",
    loyalty: 70,
    factionId: "market_caravan_circle",
  },
  { groupId: "ogres", loyalty: 60 },
  { groupId: "ogres", loyalty: 70 },
  { groupId: "adventurers", loyalty: 64, cultureId: "traveling_outsiders" },
  { groupId: "adventurers", loyalty: 58 },
];

function createInitialRegulars(
  customerGroups: Record<string, CustomerGroupState>,
): Record<string, RegularWorldState> {
  ensureStarterNamingProfilesRegistered();
  const streams = createRngStreams("initial-regulars");
  const rng = streams.get("regular_identity");
  const regulars: Record<string, RegularWorldState> = {};
  const existingDisplayNames = new Set<string>();

  let perGroupIndex: Record<string, number> = {};
  for (const spec of STARTER_REGULAR_SPECS) {
    const group = customerGroups[spec.groupId];
    if (!group) continue;
    const profileId = namingProfileRegistry.has(group.namingProfileId)
      ? group.namingProfileId
      : "goblin_common";
    const profile = namingProfileRegistry.get(profileId);
    const name = generateName(profile, rng, "regular_customer", {
      existingDisplayNames,
    });
    existingDisplayNames.add(name.display);

    perGroupIndex[spec.groupId] = (perGroupIndex[spec.groupId] ?? 0) + 1;
    const index = perGroupIndex[spec.groupId]!;
    const id = `starter_regular_${spec.groupId}_${index}`;
    const cultureId = spec.cultureId ?? group.cultureId;
    const tags = ["regular", "starter"];
    if (cultureId) tags.push(`culture:${cultureId}`);

    // Phase 121 / ISSUE-090 — Living Cast Phase A. Starter regulars get
    // cast attributes from the same regular_identity stream the name
    // generator uses, AFTER each regular's name is rolled, mirroring
    // the order in `regularModule.createRegular`. Stable starter seed
    // (`initial-regulars`) keeps the roster deterministic across runs.
    const castAttributes = createRegularCastAttributes({
      ...(cultureId !== undefined ? { cultureId } : {}),
      customerGroupId: group.id,
      rng,
    });

    regulars[id] = {
      id,
      name,
      customerGroupId: group.id,
      ...(cultureId ? { cultureId } : {}),
      ...(spec.factionId !== undefined ? { factionId: spec.factionId } : {}),
      loyalty: spec.loyalty,
      irritation: 0,
      visits: 0,
      firstSeenDay: 0,
      lastSeenDay: 0,
      knownIncidentIds: [],
      tags,
      activeFlags: [],
      castAttributes,
      // Expansion Phase 4 §4.3 — the active-participant fields, from the one
      // shared definition the emergence pass and the load migration also use.
      // A new state must already look like a migrated one or a reload changes
      // the day (§5.10).
      ...regularServiceDefaults(spec.loyalty),
    };
  }
  return regulars;
}

// Phase 44 §ISSUE-004 — Seed `state.world.notableNpcs` from the
// notable-NPC profile registry. The Phase 22 skeleton reserved the
// slot empty; ISSUE-004 fills it with the registered starter profiles
// so the `notable_npc` ref kind has reachable targets for the 7+
// consumer code paths that already branch on it (pressure, feedback,
// weekly, service, issues, causes), and so the inspection family's
// `town_watch_advisor` futureHook can bind to a real notable NPC.
//
// Names are generated once, deterministically, through the
// `npc_identity` RNG stream — same default state → same default
// notable NPC roster, every time. The stable seed (`initial-notable-
// npcs`) mirrors the `initial-staff-identity` / `initial-regulars`
// convention used elsewhere in this file.
// Phase 69 / ISSUE-029 §5.4 — Seed `state.world.hireableAdventurers`
// with a starter roster of 3 adventurers. Names generate once through
// the `npc_identity` stream against a stable seed
// (`initial-hireable-adventurers`) so the default roster is
// deterministic and never shifts when other systems advance the daily
// RNG.
function createInitialHireableAdventurers(): Record<
  string,
  HireableAdventurer
> {
  const streams = createRngStreams("initial-hireable-adventurers");
  const rng = streams.get("npc_identity");
  const existingNames = new Set<string>();
  const result: Record<string, HireableAdventurer> = {};
  // Three starter slots — names generate against the shared
  // `adventuring_bands` profile. The trio carries different opening
  // stat profiles so the player has variety from day zero.
  const seedRoster: Array<
    Omit<
      Parameters<typeof createHireableAdventurer>[0],
      "rng" | "existingNames"
    >
  > = [
    {
      adventurerId: "hireable_adv_alpha",
      joinedDay: 0,
      experience: 60,
      reliability: 60,
      relationship: 50,
      specialty: "rare",
      wageBase: 6,
      tags: ["veteran"],
    },
    {
      adventurerId: "hireable_adv_beta",
      joinedDay: 0,
      experience: 35,
      reliability: 55,
      relationship: 45,
      specialty: "uncommon",
      wageBase: 4,
      tags: ["scout"],
    },
    {
      adventurerId: "hireable_adv_gamma",
      joinedDay: 0,
      experience: 25,
      reliability: 40,
      relationship: 35,
      specialty: null,
      wageBase: 3,
      tags: ["rookie"],
    },
  ];
  for (const spec of seedRoster) {
    const { adventurer, generatedName } = createHireableAdventurer({
      ...spec,
      rng,
      existingNames,
    });
    existingNames.add(generatedName.display);
    result[adventurer.id] = adventurer;
  }
  return result;
}

function createInitialNotableNpcs(): Record<string, NotableNpcWorldState> {
  ensureRequiredNotableNpcProfilesRegistered();
  const streams = createRngStreams("initial-notable-npcs");
  const rng = streams.get("npc_identity");
  const existingNames = new Set<string>();
  const result: Record<string, NotableNpcWorldState> = {};
  // Iterate in stable registry order so reordering the
  // REQUIRED_NOTABLE_NPC_PROFILES array does not shift the RNG sequence
  // and thereby the generated names.
  const orderedProfiles = [...notableNpcProfileRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const profile of orderedProfiles) {
    const { npc, generatedName } = createNotableNpc({
      npcId: profile.defaultNpcId,
      profileId: profile.id,
      rng,
      firstSeenDay: 0,
      existingNames,
    });
    existingNames.add(generatedName.display);
    result[npc.id] = npc;
  }
  return result;
}

// Phase 25 §"Default World State" / Phase 29 §29.2 / Phase 30 §§30.3,
// 30.5 / Phase 44 §ISSUE-004 — containers for the top-level `world`
// branch. Phase 25 deliberately left every record empty; Phase 29
// started seeding the supplier branch from the registry; Phase 30 adds
// culture and faction seeding; ISSUE-004 adds notable NPC seeding so
// the entire world identity layer exists from day zero.
//
// Audit fixes pass 1 §1.3 — `regulars` is also seeded from day zero so
// the identity, memory, and seed pipelines exercise this branch during
// cardless evaluation runs. `localEvents` and `socialRumours` still
// start empty — those entities only emerge during play.
export function createInitialWorldState(
  customerGroups?: Record<string, CustomerGroupState>,
): WorldState {
  const groups = customerGroups ?? createInitialCustomerGroups();
  return {
    cultures: createInitialCultures(),
    factions: createInitialFactions(),
    suppliers: createInitialSuppliers(),
    regulars: createInitialRegulars(groups),
    notableNpcs: createInitialNotableNpcs(),
    localEvents: {},
    tavernIdentity: {
      foundingDay: 0,
      // Phase 95 — Day-zero photo. The Crooked Keg is a dirty cheap
      // goblin dive on day one (game-loop-and-ux.md §1: "the player
      // isn't building from zero — they're inheriting a mess"). The
      // tavern-identity module will overwrite these on the first
      // endDay; the seeds make the day-zero strip carry meaning.
      knownFor: ["cheap goblin food"],
      houseRules: [],
      atmosphereTags: ["grimy floors", "goblin-flavored"],
    },
    socialRumours: {},
    // Phase 69 / ISSUE-029 §5.4 — hireable adventurer roster.
    hireableAdventurers: createInitialHireableAdventurers(),
  };
}

export function createInitialTavernState(
  overrides?: Partial<TavernState>,
  difficulty?: DifficultyConfig,
): TavernState {
  const customerGroups = createInitialCustomerGroups();
  const initial: TavernState = {
    meta: {
      tavernId: "the_crooked_keg",
      tavernName: "The Crooked Keg",
      simVersion: "0.1.0",
      createdAtDay: 0,
    },
    calendar: createInitialCalendar(),
    coin: 100,
    areas: createInitialAreas(),
    stock: createInitialStock(),
    staff: createInitialStaff(),
    customerGroups,
    reputation: createInitialReputation(),
    // Phase 65 / ISSUE-025 §5.2 — seed `state.recipes` from the recipe
    // registry. The six starter recipes wrap the six existing stock
    // items as 1:1 dishes; service flow treats them as the orderable
    // surface.
    recipes: createInitialRecipes(),
    // Phase 70 / ISSUE-030 §5.3 — empty expedition slice. The player
    // commissions expeditions via the `commissionExpedition` owner
    // action; resolution writes records to the completed log.
    expeditions: { active: [], completed: [] },
    // Phase 25 §"Default World State" — world branch seeded so schemas
    // validate from day zero. Cultures, factions, suppliers, and (since
    // audit fixes pass 1 §1.3) starter regulars all come from the
    // registry/seed factories.
    world: createInitialWorldState(customerGroups),
    ventures: createInitialTeleologyEntries(),
    arcs: createInitialTeleologyEntries(),
    transformations: createInitialTransformations(),
    memories: [],
    history: [],
    causes: [],
    pressures: createInitialPressures(),
    // Phase 9 §9.3 — `state.modules.stock` is seeded with an empty ledger
    // and an empty shortage list. The slot is owned by the stock module;
    // its state schema (registered on the module) validates this shape via
    // Phase 6 §6.1.1 composition.
    modules: {
      stock: createInitialStockModuleState(),
      // Phase 13 §13.1 — seed an empty owner-actions slice so the
      // module's schema validation passes even on day zero before any
      // input has been processed.
      ownerActions: createInitialOwnerActionsModuleState(),
      // Phase 14 §14.1 — seed an empty weekly slice so the module's
      // schema validates on day zero before any week has accumulated.
      weekly: createInitialWeeklyModuleState(),
      // Phase 15 §15.1 — seed an empty monthly slice (rent, landlord,
      // inspection, rival, accumulator) so the schema validates on day
      // zero before any month has begun.
      monthly: createInitialMonthlyModuleState(),
      // Phase 17 §17.2 — seed an empty causes slice so the schema
      // validates on day zero before any cause has been added.
      causes: createInitialCauseModuleState(),
      // Phase 18 §18.1 — seed empty pressure-module and feedback-loop
      // slices. The first end-of-day pass fills them with snapshots.
      pressures: createInitialPressureModuleState(),
      feedback: createInitialFeedbackModuleState(),
      // Phase 19 — seed an empty issue-seeds slice so the schema
      // validates on day zero before any seed has been generated.
      issueSeeds: createInitialIssueSeedModuleState(),
      // Phase 29 §29.4 — seed an empty supplier slice (no active market
      // conditions, no deliveries today, no price adjustments) so the
      // module's schema validates from day zero.
      suppliers: createInitialSupplierModuleState(),
      // Expansion Phase 8 §8.1 — seed the factions slice. Before this
      // phase the module had no state at all (its schema was an empty
      // passthrough object); it now holds each faction's actor record,
      // standing ledger, live stances, open requests and favours owed,
      // so it must be present and normalised from day zero.
      factions: createInitialFactionModuleState(),
      // Expansion Phase 8 §8.2 — seed the cultures slice. Before this phase
      // the module had no state at all; it now holds each culture's
      // evidence ledger, accommodation history, dish and area experience,
      // live misunderstandings and culture-to-culture friction.
      cultures: createInitialCultureModuleState(),
      // Expansion Phase 8 §8.3 — seed the npcs slice. Notable NPCs have been
      // in `world.notableNpcs` since Phase 44 with no module state at all;
      // this holds what the house has had to do with each of them, when they
      // are about, what they can put behind something, and — for the few who
      // earn it — an actor record.
      npcs: createInitialNpcModuleState(),
      // Phase 30 §30.6 — seed an empty regulars slice (no candidates,
      // no creations, no visits) so the module's schema validates from
      // day zero before any regular has emerged.
      regulars: createInitialRegularModuleState(),
      // Phase 35 §35.3 — seed an empty local arcs slice (no active
      // arcs, no cooldowns, no applied effects) so the module's schema
      // validates from day zero before any arc has seeded.
      localArcs: createInitialLocalArcsModuleState(),
      // Phase 37 §37.3 — seed an empty attribution slice (no beliefs
      // yet) so the module's schema validates from day zero before any
      // attribution rule has fired.
      attribution: createInitialAttributionModuleState(),
      // Phase 41 / ISSUE-001 — seed an empty responses slice (no pending
      // entries, no resolved intents) so the module's schema validates
      // from day zero before any response intent has been processed.
      responses: createInitialResponsesModuleState(),
      // Expansion Phase 1 §1.3 — the ruleset the run is playing under.
      // Seeded to the reference ruleset here and overwritten by
      // `applyDifficultyToBase` below when a preset was chosen, so the
      // selection is authoritative state rather than a start-time tweak
      // the simulation forgets (`OBL-05`).
      ruleset: createInitialRulesetModuleState(),
      // Expansion Phase 1 §1.5 — empty meter-detail slice. A healthy tavern
      // never writes to it; entries appear only when a meter pins at its
      // floor or ceiling and the clamp starts discarding information.
      meters: createInitialMetersModuleState(),
      // Expansion Phase 1 §1.1 / §1.2 — empty scheduled-event queue and
      // obligation ledger. Both slices exist from day zero so their
      // schemas validate before any domain has scheduled or borrowed
      // anything.
      scheduledEvents: createInitialScheduledEventsModuleState(),
      obligations: createInitialObligationsModuleState(),
      // Expansion Phase 7 §7.1–7.3 — the three external-obligation slices,
      // seeded empty from day zero for the same two reasons the staff slice
      // below is: their schemas validate before anything has happened, and
      // the web layer's day baseline goes through the migration chain on
      // reload, so a slice present in one and absent in the other would make
      // a resumed day differ from an uninterrupted one.
      //
      // Empty is the honest starting position for two of them (nobody has
      // lent the tavern anything, and the watch has heard nothing). The
      // tenancy is different — the Crooked Keg does rent its building — so
      // `ensureTenancy` opens the agreement on the module's first day rather
      // than the record being conjured here with a due date the calendar has
      // not agreed to.
      finance: createInitialFinanceModuleState(),
      tenancy: createInitialTenancyModuleState(),
      regulatory: createInitialRegulatoryModuleState(),
      // Expansion Phase 3 §3.1 — the staff slice is seeded from day zero rather
      // than conjured by the module's first `startDay`. Two reasons, and the
      // second is the load-bearing one:
      //
      //   * its schema validates from day zero, like every other slice here;
      //   * the day baseline the web layer snapshots at `beginDay` is a state
      //     object, and it goes through the migration chain on reload. A slice
      //     that exists in one and not the other makes a reloaded day differ
      //     from an uninterrupted one, which is the §5.10 failure the R11 gate
      //     tests for. Seeding it means the migration has nothing to add.
      staff: createInitialStaffModuleState(),
      // Expansion Phase 5 — persistent quality/cash feedback, financial
      // status, policy compliance and bounded accounting history.
      economy: createInitialEconomyModuleState(),
    },
  };

  // Phase 98 — Difficulty is applied to the freshly-built base BEFORE
  // overrides merge. Overrides always win, which keeps the existing
  // test fixtures (which pass `overrides`) bit-for-bit unchanged.
  const base = difficulty
    ? applyDifficultyToBase(initial, difficulty)
    : initial;

  if (!overrides) {
    return base;
  }

  return { ...base, ...overrides };
}

export function cloneTavernState(state: TavernState): TavernState {
  return structuredClone(state);
}
