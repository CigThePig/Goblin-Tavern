// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.

import { foodSafetyCrisisCard } from './foodSafetyCrisis'
import { customerComplaintCard } from './customerComplaint'
import { supplierOfferCard } from './supplierOffer'
import { maintenanceWarningCard } from './maintenanceWarning'
import { staffBurnoutCard } from './staffBurnout'
import { factionRequestCard } from './factionRequest'
import { reputationShiftWeeklyCard } from './reputationWeekly'
import { monthlyReviewCard } from './monthlyReview'
import { drinkOrderCard } from './drinkOrder'
import { staffAsideCard } from './staffAside'
import { fallbackCard, FALLBACK_CARD_ID } from './fallback'
import type { CardDefinition } from '../types'

export const REQUIRED_CARDS: ReadonlyArray<CardDefinition> = [
  foodSafetyCrisisCard,
  customerComplaintCard,
  supplierOfferCard,
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
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
  supplierOfferCard,
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
