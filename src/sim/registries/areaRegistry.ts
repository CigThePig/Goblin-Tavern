import { Registry } from './Registry'
import type { AreaState } from '../state/TavernState'
import type { AreaAdjacency, AreaCapacity } from './areaCapacityTypes'

// Phase 8 §8.1 — Area registry.
//
// Each registered area carries the data needed to seed a fresh tavern:
// the canonical id, a display label, the tag list, and the per-field
// `defaultState` that `createInitialTavernState` reads to build
// `state.areas`. Numbers come from `phases-02-05.md` Phase 5 §"Area
// State" — Phase 8 consolidates them into the registry rather than
// re-tuning them.

export type AreaDefaultState = Omit<AreaState, 'id' | 'label' | 'tags'>

// Phase 73 / ISSUE-033 §5.7 — gameplay-bearing area metadata. These
// fields live on the registry definition rather than on `AreaState`
// because they don't change at runtime; consumers read them by
// looking the area up via `areaRegistry.get(storageAreaId)`.
export type AreaIngredientYield = {
  ingredientId: string
  perWeek: number
  boostedByCalendarTags: string[]
}

export type AreaSpoilageModifier = {
  appliesToRarities: ('uncommon' | 'rare' | 'legendary')[]
  multiplier: number
}

export type AreaDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: AreaDefaultState
  ingredientYield?: AreaIngredientYield
  spoilageModifier?: AreaSpoilageModifier
  /**
   * Expansion Phase 2 §2.1 — the room's own physical capacity before any
   * upgrade. Static, like `ingredientYield`: a room's size does not change
   * at runtime, only what is installed in it and how much of it is
   * currently blocked. Read through `getAreaCapacity` in
   * `src/sim/modules/areas/capacity.ts`, never off this definition
   * directly, so installed fittings and construction blockage always
   * count.
   */
  capacity?: AreaCapacity
  /**
   * Expansion Phase 2 §2.1 — access links to other areas. Declared once
   * per unordered pair; `areAreasAdjacent` reads them in both directions.
   */
  adjacency?: ReadonlyArray<AreaAdjacency>
}

export const areaRegistry = new Registry<AreaDefinition>()

// Phase 28 §28.5 — Each required area now seeds with a small starter set
// of traits and atmosphere tags grounded in the room's existing meters.
// `upgrades` starts empty: every upgrade is "not built yet" on day zero.
// The trait ids and atmosphere tags here match the starter sets in
// `src/sim/content/tavern/areaTraitRegistry.ts` so a Phase 26 cross-ref
// pass cannot find a dangling reference.
const REQUIRED_AREAS: AreaDefinition[] = [
  {
    id: 'main_room',
    label: 'Main Room',
    tags: ['public', 'customer_facing', 'inspection_relevant'],
    defaultState: {
      condition: 60,
      cleanliness: 45,
      mess: 20,
      damage: 15,
      smell: 25,
      risk: 20,
      activeProblems: [],
      traits: ['sticky_floor', 'dangerous_corner'],
      atmosphere: ['cheap', 'rowdy', 'lived_in'],
      upgrades: {},
    },
    capacity: { seats: 90, workstations: 1, storage: 2 },
    adjacency: [
      {
        areaId: 'kitchen',
        kind: 'door',
        reason: 'Plates cross the service door between the two.',
      },
      {
        areaId: 'cellar',
        kind: 'stair',
        reason: 'Barrels come up the cellar stair behind the bar.',
      },
      {
        areaId: 'privy',
        kind: 'door',
        reason: 'Patrons walk the length of the room to reach the privy.',
      },
      {
        areaId: 'roof',
        kind: 'structural',
        reason: 'The roof sits directly over the main room.',
      },
      {
        areaId: 'private_booth',
        kind: 'door',
        reason: 'The booths open off the main room.',
      },
      {
        areaId: 'stage_corner',
        kind: 'door',
        reason: 'The stage corner is part of the same floor.',
      },
    ],
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    tags: ['food', 'staff_work_area', 'inspection_relevant', 'fire_risk'],
    defaultState: {
      condition: 55,
      cleanliness: 40,
      mess: 30,
      damage: 10,
      smell: 35,
      risk: 30,
      activeProblems: [],
      traits: ['smells_of_smoke', 'food_prep_visible'],
      atmosphere: ['hot', 'busy', 'rough'],
      upgrades: {},
    },
    capacity: { workstations: 2, storage: 4 },
    adjacency: [
      {
        areaId: 'cellar',
        kind: 'stair',
        reason: 'The cook fetches stores straight down the back stair.',
      },
      {
        areaId: 'roof',
        kind: 'structural',
        reason: 'The kitchen flue runs up through the roof.',
      },
      {
        areaId: 'herb_garden',
        kind: 'yard',
        reason: 'The garden is out the kitchen yard door.',
      },
    ],
  },
  {
    id: 'cellar',
    label: 'Cellar',
    tags: ['storage', 'pest_sensitive', 'private'],
    defaultState: {
      condition: 45,
      cleanliness: 30,
      mess: 35,
      damage: 20,
      smell: 45,
      risk: 40,
      activeProblems: [],
      traits: ['pest_prone', 'drafty'],
      atmosphere: ['damp', 'shadowed'],
      upgrades: {},
    },
    capacity: { storage: 24 },
    adjacency: [
      {
        areaId: 'cold_cellar',
        kind: 'door',
        reason: 'The cold cellar is cut into the far wall of the cellar.',
      },
      {
        areaId: 'privy',
        kind: 'plumbing',
        reason: 'The privy drain runs behind the cellar wall.',
      },
    ],
  },
  {
    id: 'privy',
    label: 'Privy',
    tags: ['sanitation', 'inspection_relevant', 'smell_source'],
    defaultState: {
      condition: 40,
      cleanliness: 25,
      mess: 45,
      damage: 20,
      smell: 70,
      risk: 50,
      activeProblems: [],
      traits: ['inspection_sensitive'],
      atmosphere: ['grim', 'smelly'],
      upgrades: {},
    },
    capacity: { seats: 2 },
  },
  {
    id: 'roof',
    label: 'Roof',
    tags: ['structure', 'weather_exposed'],
    defaultState: {
      condition: 50,
      cleanliness: 50,
      mess: 0,
      damage: 35,
      smell: 0,
      risk: 35,
      activeProblems: [],
      traits: ['weather_exposed'],
      atmosphere: ['leaky'],
      upgrades: {},
    },
    capacity: {},
  },
  // Phase 73 / ISSUE-033 §4.8, §5.7 — gameplay-bearing storage areas.
  // herb_garden produces a slow trickle of uncommon herbs; cold_cellar
  // halves spoilage on rare/legendary items stored there. The two
  // atmosphere areas (private_booth, stage_corner) round out the
  // un-pin work — they expand the customer-facing roster.
  {
    id: 'herb_garden',
    label: 'Herb Garden',
    tags: ['outdoor', 'garden', 'kitchen_adjacent'],
    defaultState: {
      condition: 55,
      cleanliness: 60,
      mess: 10,
      damage: 10,
      smell: 30,
      risk: 5,
      activeProblems: [],
      traits: [],
      atmosphere: ['fresh'],
      upgrades: {},
    },
    capacity: { workstations: 1 },
    ingredientYield: {
      ingredientId: 'wild_thyme',
      perWeek: 2,
      boostedByCalendarTags: ['growing_season'],
    },
  },
  {
    id: 'cold_cellar',
    label: 'Cold Cellar',
    tags: ['underground', 'storage', 'cooled'],
    defaultState: {
      condition: 50,
      cleanliness: 60,
      mess: 5,
      damage: 5,
      smell: 15,
      risk: 5,
      activeProblems: [],
      traits: [],
      atmosphere: ['chilly'],
      upgrades: {},
    },
    capacity: { storage: 12 },
    spoilageModifier: {
      appliesToRarities: ['rare', 'legendary'],
      multiplier: 0.5,
    },
  },
  {
    id: 'private_booth',
    label: 'Private Booth',
    tags: ['public', 'customer_facing', 'intimate'],
    defaultState: {
      condition: 65,
      cleanliness: 65,
      mess: 10,
      damage: 5,
      smell: 20,
      risk: 10,
      activeProblems: [],
      traits: [],
      atmosphere: ['cozy', 'quiet'],
      upgrades: {},
    },
    capacity: { seats: 8 },
  },
  {
    id: 'stage_corner',
    label: 'Stage Corner',
    tags: ['public', 'customer_facing', 'performance'],
    defaultState: {
      condition: 60,
      cleanliness: 55,
      mess: 15,
      damage: 10,
      smell: 25,
      risk: 15,
      activeProblems: [],
      traits: [],
      atmosphere: ['lively'],
      upgrades: {},
    },
    capacity: { seats: 12, workstations: 1 },
  },
]

let initialized = false

export function ensureRequiredAreasRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_AREAS) {
    if (!areaRegistry.has(def.id)) {
      areaRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredAreasRegistered()

// Expansion Phase 2 §2.1 — adjacency lookups.
//
// Links are declared once per unordered pair (the main room claims the
// kitchen; the kitchen does not repeat the claim), so every reader has to
// look in both directions. Doing that in one place is what keeps the graph
// honest — and a registry cross-check test walks these helpers and fails if
// a link names an area that does not exist.

/** Every link touching `areaId`, from either end, sorted by neighbour id. */
export function listAreaAdjacency(areaId: string): AreaAdjacency[] {
  ensureRequiredAreasRegistered()
  const links: AreaAdjacency[] = []
  const own = areaRegistry.has(areaId)
    ? (areaRegistry.get(areaId).adjacency ?? [])
    : []
  for (const link of own) links.push(link)
  for (const def of areaRegistry.all()) {
    if (def.id === areaId) continue
    for (const link of def.adjacency ?? []) {
      if (link.areaId !== areaId) continue
      // Rewrite the neighbour so the caller always reads "the area at the
      // other end", whichever end declared the link.
      links.push({ areaId: def.id, kind: link.kind, reason: link.reason })
    }
  }
  return links.sort((a, b) => a.areaId.localeCompare(b.areaId))
}

export function areAreasAdjacent(a: string, b: string): boolean {
  return listAreaAdjacency(a).some((link) => link.areaId === b)
}

/** The link between two areas, or `undefined` when they do not connect. */
export function getAreaAdjacency(
  a: string,
  b: string,
): AreaAdjacency | undefined {
  return listAreaAdjacency(a).find((link) => link.areaId === b)
}

export type { AreaAdjacency, AreaCapacity }
