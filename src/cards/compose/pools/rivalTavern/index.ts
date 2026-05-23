// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Slot manifest for the rival_tavern compositional template. First
// dedicated card for the family — pre-Phase 13, rival_tavern seeds
// routed to `fallbackCard`. Narrator-voiced — the seed's primaryActor
// is a local_event (rival arc) or system ref, neither carrying
// castAttributes. No `voiceAxis` / `verbalTic` conditions in any pool.
// Design record at `specs/cards/rival_tavern.spec.yaml`.

export { titlePool as rivalTavernTitlePool } from './title'
export { establishingLinePool as rivalTavernEstablishingLinePool } from './establishingLine'
export { reactionLinePool as rivalTavernReactionLinePool } from './reactionLine'
export { mannerNotePool as rivalTavernMannerNotePool } from './mannerNote'
export { choiceLabelPool as rivalTavernChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as rivalTavernEffectPreviewPool } from './effectPreview'
