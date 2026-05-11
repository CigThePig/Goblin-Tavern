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

let initialized = false

export function ensureRequiredPressuresRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_PRESSURE_DEFINITIONS) {
    if (!pressureRegistry.has(def.id)) {
      pressureRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredPressuresRegistered()
