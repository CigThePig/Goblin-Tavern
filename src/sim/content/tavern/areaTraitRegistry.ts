// Phase 28 §28.2 / §28.3 — Area trait registry.
//
// The starter set is intentionally small. Phase 28 §28.3 forbids "pure
// prose" traits: every entry must carry mechanical tags that other
// modules can hook on (report copy, customer satisfaction, pressure
// calculators, future issue seeds). Trait ids match the strings used by
// `src/sim/registries/areaRegistry.ts` defaults so the cross-reference
// validation pass added in Phase 26 cannot find a dangling id.

import { Registry } from '../../registries/Registry'
import type { AreaTraitDefinition, AreaTraitId } from './atmosphereTypes'

export const areaTraitRegistry = new Registry<AreaTraitDefinition>()

const REQUIRED_TRAITS: AreaTraitDefinition[] = [
  {
    id: 'cozy',
    label: 'Cozy',
    description: 'Warm, welcoming, and quiet enough for a real conversation.',
    mechanicalTags: ['comfort_positive', 'merchant_sensitive', 'respectable_sensitive'],
  },
  {
    id: 'drafty',
    label: 'Drafty',
    description: 'Cold air finds every gap. Not pleasant on a wet night.',
    mechanicalTags: ['comfort_negative', 'weather_sensitive'],
  },
  {
    id: 'sticky_floor',
    label: 'Sticky Floor',
    description: 'Years of spilled ale have left the floorboards tacky.',
    mechanicalTags: [
      'cleanliness_negative',
      'risk_positive',
      'merchant_sensitive',
      'inspection_relevant',
    ],
  },
  {
    id: 'smells_of_smoke',
    label: 'Smells of Smoke',
    description: 'Cooking fires and pipe-smoke linger in the rafters.',
    mechanicalTags: ['atmosphere_smoky', 'merchant_sensitive'],
  },
  {
    id: 'rat_scratched',
    label: 'Rat-Scratched',
    description: 'Bite marks and droppings betray a long pest history.',
    allowedAreaTags: ['storage', 'pest_sensitive', 'food'],
    mechanicalTags: ['pest_relevant', 'cleanliness_negative', 'inspection_relevant'],
  },
  {
    id: 'well_lit',
    label: 'Well Lit',
    description: 'Lanterns and oil keep shadows out of every corner.',
    incompatibleTraits: ['dangerous_corner'],
    mechanicalTags: ['comfort_positive', 'risk_negative', 'respectable_sensitive'],
  },
  {
    id: 'crowded',
    label: 'Crowded',
    description: 'Bodies pressed close. Loud, hot, and hard to police.',
    mechanicalTags: ['rowdy_sensitive', 'risk_positive', 'merchant_sensitive'],
  },
  {
    id: 'private',
    label: 'Private',
    description: 'Tucked away from the main room and the watch.',
    mechanicalTags: ['comfort_positive', 'merchant_sensitive', 'respectable_sensitive'],
  },
  {
    id: 'dangerous_corner',
    label: 'Dangerous Corner',
    description: 'A blind spot the brawlers and pickpockets have learned about.',
    mechanicalTags: ['risk_positive', 'rowdy_sensitive', 'merchant_sensitive'],
  },
  {
    id: 'music_friendly',
    label: 'Music-Friendly',
    description: 'Acoustics flatter a fiddle. Bards play here for cheap.',
    mechanicalTags: ['comfort_positive', 'rowdy_sensitive'],
  },
  {
    id: 'inspection_sensitive',
    label: 'Inspection-Sensitive',
    description: 'Inspectors look here first when they walk in.',
    mechanicalTags: ['inspection_relevant', 'cleanliness_negative'],
  },
  {
    id: 'food_prep_visible',
    label: 'Food-Prep Visible',
    description: 'Cooking happens in plain sight of customers.',
    allowedAreaTags: ['food', 'staff_work_area'],
    mechanicalTags: ['merchant_sensitive', 'inspection_relevant', 'atmosphere_busy'],
  },
  {
    id: 'pest_prone',
    label: 'Pest-Prone',
    description: 'Cracks, crumbs, and warm air. Rats find their way in.',
    allowedAreaTags: ['storage', 'pest_sensitive', 'food'],
    mechanicalTags: ['pest_relevant', 'cleanliness_negative', 'inspection_relevant'],
  },
  {
    id: 'weather_exposed',
    label: 'Weather-Exposed',
    description: 'Rain, wind, and frost reach this space before any other.',
    allowedAreaTags: ['structure', 'weather_exposed'],
    mechanicalTags: ['weather_sensitive', 'damage_positive'],
  },
]

let initialized = false

export function ensureRequiredAreaTraitsRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_TRAITS) {
    if (!areaTraitRegistry.has(def.id)) {
      areaTraitRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredAreaTraitsRegistered()

export function getAreaTraitDefinition(id: AreaTraitId): AreaTraitDefinition | undefined {
  return areaTraitRegistry.has(id) ? areaTraitRegistry.get(id) : undefined
}
