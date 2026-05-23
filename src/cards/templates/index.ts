// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.
//
// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation,
// Rumour & Rivals). Replaces the legacy `reputationShiftWeeklyCard`
// (whose `timings: ['end_week']` filter never matched the generator's
// `closing` emit) with the compositional `reputationShiftCard` and
// adds two new dedicated templates that previously routed through
// `fallbackCard`: `rumourCrisisCard` (`rumour_crisis.rumour`) and
// `rivalTavernCard` (`rival_tavern.social_conflict`). The rumour
// template's `custom` predicate requires `primaryActor` with
// `castAttributes`; the `tavern_identity` no-actor path falls through.

import { foodSafetyCrisisCard } from './foodSafetyCrisis'
import { customerComplaintCard } from './customerComplaint'
import { regularComplaintCard } from './regularComplaint'
import { supplierReliabilityCard } from './supplierReliability'
import { stockShortageCard } from './stockShortage'
import { debtRentCard } from './debtRent'
import { maintenanceCard } from './maintenance'
import { areaAtmosphereCard } from './areaAtmosphere'
import { violenceCard } from './violence'
import { inspectionCard } from './inspection'
import { staffBurnoutCard } from './staffBurnout'
import { factionRequestCard } from './factionRequest'
import { cultureConflictCard } from './cultureConflict'
import { reputationShiftCard } from './reputationShift'
import { rumourCrisisCard } from './rumourCrisis'
import { rivalTavernCard } from './rivalTavern'
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
  violenceCard,
  inspectionCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
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
  violenceCard,
  inspectionCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
