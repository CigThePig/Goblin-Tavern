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
} from './templates/index'
// Phase 123 — Living Cast arc, Phase C. The compose slice is the bottom
// half of the card layer; templates author against these types.
export {
  assembleSlots,
  defineCompositionalCard,
  evalCondition,
  pickSnippet,
  specificityOf,
} from './compose/index'
export type {
  CompositionalCardTemplate,
  FilledSlots,
  Snippet,
  SnippetCondition,
  SnippetPool,
  SlotSpec,
  VoiceRegisterId,
} from './compose/index'
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
