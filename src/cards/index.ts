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
  violenceCard,
  inspectionCard,
  staffBurnoutCard,
  factionRequestCard,
  cultureConflictCard,
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
  monthlyReviewCard,
  seasonalArcCard,
  ventureCard,
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
  CardContextLine,
  CardContextView,
  StakeView,
} from './types'
// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
// The legacy Phase-95 voice composer is retired. Day-screen
// empty-state lines now compose through
// `src/reports/compose/sections/{morningEmpty,serviceEmpty,closingEmpty}`;
// the fallback card composes its title through the seventh-gate-clean
// pool at `src/cards/compose/pools/fallback/title.ts`.
