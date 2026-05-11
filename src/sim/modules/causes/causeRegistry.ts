import { Registry } from '../../registries/Registry'
import type { CauseDirection, CauseSourceType, CauseTargetType } from './causeTypes'

// Phase 17 §"Required Outputs" — Cause registry.
//
// Phase 17 does not require a heavy registry of cause definitions — the
// causes themselves are derived from runtime mutations and explicit
// `ctx.addCause` calls. The registry here lets future phases declare
// canonical cause templates (e.g. "merchants_disappointed_by_filth")
// with default tags, lifespan, and weight so reports can de-duplicate
// without each call site spelling out the same fields.
//
// Phase 17 ships a small handful of templates (e.g. the rent-missed and
// inspection-warning templates) that the monthly module uses to
// attribute the corresponding pressure shifts. The registry is
// permissive: ad-hoc causes with no matching template still work.

export type CauseDefinition = {
  id: string
  label?: string
  defaultSourceType?: CauseSourceType
  defaultTargetType?: CauseTargetType
  defaultDirection?: CauseDirection
  defaultExpiresAfterDays?: number
  defaultWeight?: number
  tags: string[]
  relatedSystems?: string[]
}

export const causeRegistry = new Registry<CauseDefinition>()

export const REQUIRED_CAUSE_DEFINITIONS: CauseDefinition[] = [
  {
    id: 'rent_missed_landlord_pressure',
    label: 'Rent Missed — Landlord Pressure Up',
    defaultSourceType: 'monthly',
    defaultTargetType: 'pressure',
    defaultDirection: 'increase',
    defaultExpiresAfterDays: 28,
    defaultWeight: 50,
    tags: ['monthly', 'rent', 'landlord', 'pressure'],
    relatedSystems: ['monthly', 'landlord'],
  },
  {
    id: 'inspection_warning_inspection_pressure',
    label: 'Inspection Warning Issued',
    defaultSourceType: 'monthly',
    defaultTargetType: 'pressure',
    defaultDirection: 'increase',
    defaultExpiresAfterDays: 28,
    defaultWeight: 40,
    tags: ['monthly', 'inspection', 'pressure'],
    relatedSystems: ['monthly', 'inspection'],
  },
  {
    id: 'unpaid_wages_morale',
    label: 'Unpaid Wages — Morale Down',
    defaultSourceType: 'weekly',
    defaultTargetType: 'staff',
    defaultDirection: 'decrease',
    defaultExpiresAfterDays: 14,
    defaultWeight: 30,
    tags: ['weekly', 'wages', 'staff', 'morale'],
    relatedSystems: ['staff'],
  },
  {
    id: 'paid_wages_morale',
    label: 'Paid Wages — Morale Stable/Up',
    defaultSourceType: 'weekly',
    defaultTargetType: 'staff',
    defaultDirection: 'increase',
    defaultExpiresAfterDays: 7,
    defaultWeight: 15,
    tags: ['weekly', 'wages', 'staff'],
    relatedSystems: ['staff'],
  },
]

let initialized = false

export function ensureRequiredCausesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_CAUSE_DEFINITIONS) {
    if (!causeRegistry.has(def.id)) causeRegistry.register(def)
  }
  initialized = true
}

ensureRequiredCausesRegistered()
