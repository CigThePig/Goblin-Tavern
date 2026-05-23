// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.
//
// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9. Replaces the
// legacy `supplierOfferCard` with the compositional
// `supplierReliabilityCard`; adds `stockShortageCard` and `debtRentCard`
// (first dedicated cards for those two families — they previously fell
// through to the fallback).

import { foodSafetyCrisisCard } from './foodSafetyCrisis'
import { customerComplaintCard } from './customerComplaint'
import { regularComplaintCard } from './regularComplaint'
import { supplierReliabilityCard } from './supplierReliability'
import { stockShortageCard } from './stockShortage'
import { debtRentCard } from './debtRent'
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
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
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
  regularComplaintCard,
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
