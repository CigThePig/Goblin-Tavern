// Phase 88 — Card layer public surface.
//
// `pickCard(seed, state) → CardView` is the only function the UI calls.
// Everything else (registry, selection, types, individual templates) is
// exported for tests and for future card-layer phases.

export {
  cardRegistry,
  ensureRequiredCardsRegistered,
  pickCard,
} from './registry'
export {
  appliesToMatches,
  specificity,
  compareCards,
  pickCardForSeed,
} from './selection'
export {
  REQUIRED_CARDS,
  FALLBACK_CARD_ID,
  foodSafetyCrisisCard,
  customerComplaintCard,
  supplierOfferCard,
  maintenanceWarningCard,
  staffRequestCard,
  factionRequestCard,
  reputationShiftWeeklyCard,
  monthlyReviewCard,
  fallbackCard,
} from './templates/index'
export type {
  CardDefinition,
  CardAppliesTo,
  CardView,
  CardChoice,
  StakeView,
} from './types'
// Phase 95 — Voice composer surface. Templates and the report layer
// import the composer through this entry point so the voice slice
// stays a single import target.
export {
  composeTitle,
  composeBody,
  composeEmpty,
  pickFromPool,
  TONE_POOLS,
  EMPTY_STATE_POOLS,
  type ComposeOpts,
  type TonePool,
} from './voice/index'
