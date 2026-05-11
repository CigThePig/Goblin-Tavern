import { Registry } from './Registry'
import type { AreaState } from '../state/TavernState'

// Phase 8 §8.1 — Area registry.
//
// Each registered area carries the data needed to seed a fresh tavern:
// the canonical id, a display label, the tag list, and the per-field
// `defaultState` that `createInitialTavernState` reads to build
// `state.areas`. Numbers come from `phases-02-05.md` Phase 5 §"Area
// State" — Phase 8 consolidates them into the registry rather than
// re-tuning them.

export type AreaDefaultState = Omit<AreaState, 'id' | 'label' | 'tags'>

export type AreaDefinition = {
  id: string
  label: string
  tags: string[]
  defaultState: AreaDefaultState
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
