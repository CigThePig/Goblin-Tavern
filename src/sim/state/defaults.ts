import { createInitialCalendar } from '../modules/calendar/index'
import type {
  AreaState,
  CustomerGroupState,
  PressureState,
  ReputationState,
  StaffState,
  StockState,
  TavernState,
} from './TavernState'

function createInitialAreas(): Record<string, AreaState> {
  return {
    main_room: {
      id: 'main_room',
      label: 'Main Room',
      condition: 60,
      cleanliness: 45,
      mess: 20,
      damage: 15,
      smell: 25,
      risk: 20,
      tags: ['public', 'service', 'customer_facing'],
      activeProblems: [],
    },
    kitchen: {
      id: 'kitchen',
      label: 'Kitchen',
      condition: 55,
      cleanliness: 40,
      mess: 30,
      damage: 10,
      smell: 35,
      risk: 30,
      tags: ['food', 'staff_work', 'cleanliness_sensitive'],
      activeProblems: [],
    },
    cellar: {
      id: 'cellar',
      label: 'Cellar',
      condition: 45,
      cleanliness: 30,
      mess: 35,
      damage: 20,
      smell: 45,
      risk: 40,
      tags: ['storage', 'damp', 'pests'],
      activeProblems: [],
    },
    privy: {
      id: 'privy',
      label: 'Privy',
      condition: 40,
      cleanliness: 25,
      mess: 45,
      damage: 20,
      smell: 70,
      risk: 50,
      tags: ['sanitation', 'smell', 'inspection_relevant'],
      activeProblems: [],
    },
    roof: {
      id: 'roof',
      label: 'Roof',
      condition: 50,
      cleanliness: 50,
      mess: 0,
      damage: 35,
      smell: 0,
      risk: 35,
      tags: ['structure', 'weather_sensitive'],
      activeProblems: [],
    },
  }
}

function createInitialStock(): Record<string, StockState> {
  return {
    ale: {
      id: 'ale',
      label: 'Ale',
      quantity: 80,
      quality: 45,
      spoilage: 5,
      unitValue: 2,
      tags: ['drink', 'alcohol', 'service_item'],
    },
    stew: {
      id: 'stew',
      label: 'Stew',
      quantity: 40,
      quality: 35,
      spoilage: 20,
      unitValue: 2,
      tags: ['food', 'prepared', 'service_item'],
    },
    ingredients: {
      id: 'ingredients',
      label: 'Ingredients',
      quantity: 60,
      quality: 45,
      spoilage: 15,
      unitValue: 1,
      tags: ['food', 'raw'],
    },
    mushrooms: {
      id: 'mushrooms',
      label: 'Mushrooms',
      quantity: 45,
      quality: 40,
      spoilage: 25,
      unitValue: 1,
      tags: ['food', 'raw', 'goblin_favourite', 'risky'],
    },
    firewood: {
      id: 'firewood',
      label: 'Firewood',
      quantity: 50,
      quality: 50,
      spoilage: 0,
      unitValue: 1,
      tags: ['fuel', 'utility'],
    },
    mugs: {
      id: 'mugs',
      label: 'Mugs',
      quantity: 35,
      quality: 35,
      spoilage: 0,
      unitValue: 1,
      tags: ['equipment', 'service_item', 'breakable'],
    },
  }
}

function createInitialStaff(): Record<string, StaffState> {
  return {
    cook: {
      id: 'cook',
      name: 'Gribna',
      role: 'cook',
      skill: 55,
      morale: 45,
      stress: 35,
      fatigue: 20,
      loyalty: 50,
      wage: 12,
      tags: [],
      activeProblems: [],
    },
    server: {
      id: 'server',
      name: 'Nix',
      role: 'server',
      skill: 50,
      morale: 50,
      stress: 25,
      fatigue: 20,
      loyalty: 45,
      wage: 10,
      tags: [],
      activeProblems: [],
    },
    cleaner_bouncer: {
      id: 'cleaner_bouncer',
      name: 'Bruk',
      role: 'cleaner_bouncer',
      skill: 45,
      morale: 40,
      stress: 30,
      fatigue: 25,
      loyalty: 55,
      wage: 11,
      tags: [],
      activeProblems: [],
    },
  }
}

function createInitialCustomerGroups(): Record<string, CustomerGroupState> {
  return {
    local_goblins: {
      id: 'local_goblins',
      label: 'Local Goblins',
      patronage: 65,
      satisfaction: 55,
      wealth: 25,
      rowdiness: 50,
      dangerTolerance: 75,
      filthTolerance: 85,
      priceSensitivity: 80,
      damageRisk: 30,
      tabRisk: 35,
      tags: [],
      activeGrudges: [],
    },
    miners: {
      id: 'miners',
      label: 'Miners',
      patronage: 45,
      satisfaction: 50,
      wealth: 45,
      rowdiness: 70,
      dangerTolerance: 70,
      filthTolerance: 60,
      priceSensitivity: 50,
      damageRisk: 55,
      tabRisk: 30,
      tags: [],
      activeGrudges: [],
    },
    merchants: {
      id: 'merchants',
      label: 'Merchants',
      patronage: 25,
      satisfaction: 40,
      wealth: 75,
      rowdiness: 15,
      dangerTolerance: 20,
      filthTolerance: 20,
      priceSensitivity: 35,
      damageRisk: 10,
      tabRisk: 15,
      tags: [],
      activeGrudges: [],
    },
    ogres: {
      id: 'ogres',
      label: 'Ogres',
      patronage: 15,
      satisfaction: 45,
      wealth: 65,
      rowdiness: 90,
      dangerTolerance: 90,
      filthTolerance: 70,
      priceSensitivity: 30,
      damageRisk: 90,
      tabRisk: 25,
      tags: [],
      activeGrudges: [],
    },
    adventurers: {
      id: 'adventurers',
      label: 'Adventurers',
      patronage: 20,
      satisfaction: 50,
      wealth: 70,
      rowdiness: 65,
      dangerTolerance: 95,
      filthTolerance: 45,
      priceSensitivity: 25,
      damageRisk: 60,
      tabRisk: 20,
      tags: [],
      activeGrudges: [],
    },
  }
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
  }
}

function createInitialPressures(): Record<string, PressureState> {
  const baseValues: Record<string, number> = {
    inspection: 25,
    staff_burnout: 25,
    pests: 35,
    food_safety: 35,
    debt: 10,
    violence: 30,
    structural_decay: 35,
    reputation_drift: 20,
  }

  const labels: Record<string, string> = {
    inspection: 'Inspection',
    staff_burnout: 'Staff Burnout',
    pests: 'Pests',
    food_safety: 'Food Safety',
    debt: 'Debt',
    violence: 'Violence',
    structural_decay: 'Structural Decay',
    reputation_drift: 'Reputation Drift',
  }

  const pressures: Record<string, PressureState> = {}
  for (const id of Object.keys(baseValues)) {
    pressures[id] = {
      id,
      label: labels[id] ?? id,
      value: baseValues[id] ?? 0,
      trend: 0,
      tags: [],
      topCauses: [],
    }
  }
  return pressures
}

export function createInitialTavernState(overrides?: Partial<TavernState>): TavernState {
  const base: TavernState = {
    meta: {
      tavernId: 'the_crooked_keg',
      tavernName: 'The Crooked Keg',
      simVersion: '0.1.0',
      createdAtDay: 0,
    },
    calendar: createInitialCalendar(),
    coin: 100,
    areas: createInitialAreas(),
    stock: createInitialStock(),
    staff: createInitialStaff(),
    customerGroups: createInitialCustomerGroups(),
    reputation: createInitialReputation(),
    memories: [],
    causes: [],
    pressures: createInitialPressures(),
    modules: {},
  }

  if (!overrides) {
    return base
  }

  return { ...base, ...overrides }
}

export function cloneTavernState(state: TavernState): TavernState {
  return structuredClone(state)
}
