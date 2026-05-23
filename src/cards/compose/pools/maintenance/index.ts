// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Slot manifest for the maintenance compositional template. Replaces
// the legacy hand-written `maintenanceWarning` template that hand-glued
// raw `textIngredients` fragments and a `pickAreaStateAdjective` title
// prefix through the Phase-95 voice composer. Narrator-voiced (areas
// have no `castAttributes`); design record at
// `specs/cards/maintenance.spec.yaml`.

export { titlePool as maintenanceTitlePool } from './title'
export { establishingLinePool as maintenanceEstablishingLinePool } from './establishingLine'
export { reactionLinePool as maintenanceReactionLinePool } from './reactionLine'
export { mannerNotePool as maintenanceMannerNotePool } from './mannerNote'
export { choiceLabelPool as maintenanceChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as maintenanceEffectPreviewPool } from './effectPreview'
