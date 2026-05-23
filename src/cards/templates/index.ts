// Phase 88 — Template registration manifest.
//
// Order is presentation-only; selection uses priority + specificity
// regardless of registration order. The fallback is registered last by
// convention but the registry treats it identically to any other card.
//
// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises &
// Safety). Rewrites the hand-written `foodSafetyCrisisCard` as an
// actor-voiced compositional template and adds two new dedicated
// templates that previously routed through `fallbackCard`:
// `violenceCard` (`violence.customer_incident`) and `inspectionCard`
// (`inspection.inspection_threat`). All three are actor-voiced;
// graceful-fallback `custom` predicates require the relevant
// `castAttributes`.

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
  violenceCard,
  inspectionCard,
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
  violenceCard,
  inspectionCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  drinkOrderCard,
  staffAsideCard,
  fallbackCard,
}
