// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.
//
// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10. Replaces the
// legacy hand-written `factionRequestCard` with a compositional template
// that voices the faction via its `castAttributes`, and adds a first
// dedicated `cultureConflictCard` (the legacy template nominally
// matched `culture_conflict` seeds but its name resolver dropped culture
// refs).

import { foodSafetyCrisisCard } from './foodSafetyCrisis'
import { customerComplaintCard } from './customerComplaint'
import { regularComplaintCard } from './regularComplaint'
import { supplierReliabilityCard } from './supplierReliability'
import { stockShortageCard } from './stockShortage'
import { debtRentCard } from './debtRent'
import { maintenanceWarningCard } from './maintenanceWarning'
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
  maintenanceWarningCard,
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
  maintenanceWarningCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
