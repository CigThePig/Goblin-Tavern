// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Slot manifest for the food_safety compositional template. Rewrites
// in place the legacy hand-written `foodSafetyCrisis` template that
// hand-glued raw `textIngredients` fragments and a `pickSeverityAdjective`
// title prefix through the Phase-95 voice composer. Actor-voiced via
// the cook's `castAttributes`; design record at
// `specs/cards/food_safety.spec.yaml`.

export { titlePool as foodSafetyTitlePool } from './title'
export { establishingLinePool as foodSafetyEstablishingLinePool } from './establishingLine'
export { reactionLinePool as foodSafetyReactionLinePool } from './reactionLine'
export { mannerNotePool as foodSafetyMannerNotePool } from './mannerNote'
export { choiceLabelPool as foodSafetyChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as foodSafetyEffectPreviewPool } from './effectPreview'
