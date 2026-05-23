// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Slot manifest for the faction_request compositional template. Replaces
// the legacy hand-written `factionRequest` template (which lifted raw
// textIngredients and used a `pickFactionRelationNoun` lookup for the
// title prefix). Design record at `specs/cards/faction_request.spec.yaml`.

export { titlePool as factionRequestTitlePool } from './title'
export { establishingLinePool as factionRequestEstablishingLinePool } from './establishingLine'
export { reactionLinePool as factionRequestReactionLinePool } from './reactionLine'
export { mannerNotePool as factionRequestMannerNotePool } from './mannerNote'
export { choiceLabelPool as factionRequestChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as factionRequestEffectPreviewPool } from './effectPreview'
