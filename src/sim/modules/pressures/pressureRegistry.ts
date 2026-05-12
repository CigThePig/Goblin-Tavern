import { Registry } from '../../registries/Registry'
import type { SimContext } from '../../core/context'
import { calculateFoodSafety } from './calculators/foodSafety'
import { calculateInspection } from './calculators/inspection'
import { calculateStaffBurnout } from './calculators/staffBurnout'
import { calculatePest } from './calculators/pest'
import { calculateDebt } from './calculators/debt'
import { calculateMaintenance } from './calculators/maintenance'
import { calculateViolence } from './calculators/violence'
import { calculateReputationDrift } from './calculators/reputationDrift'
import { calculateStockShortage } from './calculators/stockShortage'
import { calculateLandlord } from './calculators/landlord'
import { calculateSupplierDistrust } from './calculators/supplierDistrust'
import { calculateRegularCustomerLoss } from './calculators/regularCustomerLoss'
import { calculateStaffLoyaltyRisk } from './calculators/staffLoyaltyRisk'
import { calculateFactionAnger } from './calculators/factionAnger'
import { calculateCulturalTension } from './calculators/culturalTension'
import { calculateRivalTavernPressure } from './calculators/rivalTavernPressure'
import { calculateFestivalReadiness } from './calculators/festivalReadiness'
import { calculateMarketInstability } from './calculators/marketInstability'
import { calculateRumourPressure } from './calculators/rumourPressure'
import { calculatePolicyBacklash } from './calculators/policyBacklash'
import { calculateArcEscalation } from './calculators/arcEscalation'
import type { PressureCalculationResult, PressureId } from './pressureTypes'

// Phase 18 §18.1 — Pressure registry.
//
// Each registered pressure provides a `calculate(ctx)` function that
// returns a `PressureCalculationResult`. The module collects results
// from every registered pressure each day and writes the resulting
// snapshots to `state.modules.pressures.snapshots`.

export type PressureDefinition = {
  id: PressureId | string
  label: string
  tags: string[]
  /** Free-form systems hint surfaced in reports. */
  relatedSystems?: string[]
  calculate(ctx: SimContext): PressureCalculationResult
}

export const pressureRegistry = new Registry<PressureDefinition>()

export const REQUIRED_PRESSURE_DEFINITIONS: PressureDefinition[] = [
  {
    id: 'food_safety',
    label: 'Food Safety',
    tags: ['food', 'kitchen', 'risk'],
    relatedSystems: ['stock', 'areas', 'staff'],
    calculate: calculateFoodSafety,
  },
  {
    id: 'inspection',
    label: 'Inspection',
    tags: ['inspection', 'risk', 'reputation'],
    relatedSystems: ['inspection', 'monthly', 'customers'],
    calculate: calculateInspection,
  },
  {
    id: 'staff_burnout',
    label: 'Staff Burnout',
    tags: ['staff', 'risk'],
    relatedSystems: ['staff'],
    calculate: calculateStaffBurnout,
  },
  {
    id: 'pests',
    label: 'Pests',
    tags: ['pests', 'cellar', 'risk'],
    relatedSystems: ['areas', 'stock'],
    calculate: calculatePest,
  },
  {
    id: 'debt',
    label: 'Debt',
    tags: ['economy', 'risk'],
    relatedSystems: ['economy', 'monthly'],
    calculate: calculateDebt,
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    tags: ['maintenance', 'areas'],
    relatedSystems: ['areas'],
    calculate: calculateMaintenance,
  },
  {
    id: 'violence',
    label: 'Violence',
    tags: ['violence', 'service', 'risk'],
    relatedSystems: ['service', 'customers'],
    calculate: calculateViolence,
  },
  {
    id: 'reputation_drift',
    label: 'Reputation Drift',
    tags: ['reputation', 'identity'],
    relatedSystems: ['reputation', 'customers'],
    calculate: calculateReputationDrift,
  },
  {
    id: 'stock_shortage',
    label: 'Stock Shortage',
    tags: ['stock', 'forecast'],
    relatedSystems: ['stock', 'customers'],
    calculate: calculateStockShortage,
  },
  {
    id: 'landlord',
    label: 'Landlord',
    tags: ['landlord', 'rent', 'risk'],
    relatedSystems: ['monthly', 'rent'],
    calculate: calculateLandlord,
  },
]

// Phase 38 §38.2 — Expanded pressure definitions. Layered on top of the
// canonical list so Phase 18 tests keep passing while social, market,
// and arc pressures join the per-day calculation pass.
export const EXPANDED_PRESSURE_DEFINITIONS: PressureDefinition[] = [
  {
    id: 'supplier_distrust',
    label: 'Supplier Distrust',
    tags: ['supplier', 'distrust', 'social', 'expanded'],
    relatedSystems: ['suppliers', 'memories', 'attribution', 'market'],
    calculate: calculateSupplierDistrust,
  },
  {
    id: 'regular_customer_loss',
    label: 'Regular Customer Loss',
    tags: ['regulars', 'social', 'expanded'],
    relatedSystems: ['regulars', 'customers', 'memories'],
    calculate: calculateRegularCustomerLoss,
  },
  {
    id: 'staff_loyalty_risk',
    label: 'Staff Loyalty Risk',
    tags: ['staff', 'loyalty', 'social', 'expanded'],
    relatedSystems: ['staff', 'memories', 'attribution'],
    calculate: calculateStaffLoyaltyRisk,
  },
  {
    id: 'faction_anger',
    label: 'Faction Anger',
    tags: ['faction', 'social', 'expanded'],
    relatedSystems: ['factions', 'memories', 'attribution', 'localArcs'],
    calculate: calculateFactionAnger,
  },
  {
    id: 'cultural_tension',
    label: 'Cultural Tension',
    tags: ['culture', 'social', 'expanded'],
    relatedSystems: ['cultures', 'customers', 'memories', 'policies'],
    calculate: calculateCulturalTension,
  },
  {
    id: 'rival_tavern_pressure',
    label: 'Rival Tavern Pressure',
    tags: ['rival', 'market', 'social', 'expanded'],
    relatedSystems: ['localArcs', 'reputation', 'regulars', 'rumours'],
    calculate: calculateRivalTavernPressure,
  },
  {
    id: 'festival_readiness',
    label: 'Festival Readiness',
    tags: ['festival', 'arc', 'expanded'],
    relatedSystems: ['stock', 'staff', 'areas', 'suppliers', 'localArcs'],
    calculate: calculateFestivalReadiness,
  },
  {
    id: 'market_instability',
    label: 'Market Instability',
    tags: ['market', 'expanded'],
    relatedSystems: ['suppliers', 'market', 'localArcs', 'stock'],
    calculate: calculateMarketInstability,
  },
  {
    id: 'rumour_pressure',
    label: 'Rumour Pressure',
    tags: ['rumour', 'social', 'expanded'],
    relatedSystems: ['rumours', 'attribution', 'memories'],
    calculate: calculateRumourPressure,
  },
  {
    id: 'policy_backlash',
    label: 'Policy Backlash',
    tags: ['policy', 'social', 'expanded'],
    relatedSystems: ['policies', 'customers', 'attribution', 'regulars'],
    calculate: calculatePolicyBacklash,
  },
  {
    id: 'arc_escalation',
    label: 'Arc Escalation',
    tags: ['arc', 'expanded'],
    relatedSystems: ['localArcs', 'memories', 'pressures'],
    calculate: calculateArcEscalation,
  },
]

let initialized = false

export function ensureRequiredPressuresRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_PRESSURE_DEFINITIONS) {
    if (!pressureRegistry.has(def.id)) {
      pressureRegistry.register(def)
    }
  }
  for (const def of EXPANDED_PRESSURE_DEFINITIONS) {
    if (!pressureRegistry.has(def.id)) {
      pressureRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredPressuresRegistered()
