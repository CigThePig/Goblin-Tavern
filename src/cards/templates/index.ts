// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.
//
// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises &
// Atmosphere). Replaces the legacy hand-written `maintenanceWarningCard`
// with two compositional templates: `maintenanceCard` (handles the
// `maintenance` family's `maintenance_problem` seeds) and
// `areaAtmosphereCard` (first dedicated card for `area_atmosphere` —
// pre-Phase 11 these seeds were nominally claimed by the legacy
// template but rendered through `maintenance_problem`-shaped body code).
// Both are narrator-voiced (areas have no `castAttributes`).

import { foodSafetyCrisisCard } from './foodSafetyCrisis'
import { customerComplaintCard } from './customerComplaint'
import { regularComplaintCard } from './regularComplaint'
import { supplierReliabilityCard } from './supplierReliability'
import { stockShortageCard } from './stockShortage'
import { debtRentCard } from './debtRent'
import { maintenanceCard } from './maintenance'
import { areaAtmosphereCard } from './areaAtmosphere'
import { staffBurnoutCard } from './staffBurnout'
import { factionRequestCard } from './factionRequest'
import { cultureConflictCard } from './cultureConflict'
import { reputationShiftWeeklyCard } from './reputationWeekly'
import { monthlyReviewCard } from './monthlyReview'
import { drinkOrderCard } from './drinkOrder'
import { staffAsideCard } from './staffAside'
import { fallbackCard, FALLBACK_CARD_ID } from './fallback'
import type { CardDefinition } from '../types'

export const REQUIRED_CARDS: ReadonlyArray<CardDefinition> = [
  foodSafetyCrisisCard,
  customerComplaintCard,
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
  maintenanceCard,
  areaAtmosphereCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
]

export { FALLBACK_CARD_ID }
export {
  foodSafetyCrisisCard,
  customerComplaintCard,
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
  maintenanceCard,
  areaAtmosphereCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
