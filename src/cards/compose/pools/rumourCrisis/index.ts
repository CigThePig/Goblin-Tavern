// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Slot manifest for the rumour_crisis compositional template. First
// dedicated card for the family — pre-Phase 13, rumour_crisis seeds
// routed to `fallbackCard`. Actor-voiced via the target's
// `castAttributes` (any of supplier / regular / faction / staff /
// customer_group / notable_npc — all six carry Phase-128 cast
// surface). The `tavern_identity` no-primaryActor path falls through
// to fallbackCard via the template's custom predicate. Design record
// at `specs/cards/rumour_crisis.spec.yaml`.

export { titlePool as rumourCrisisTitlePool } from './title'
export { establishingLinePool as rumourCrisisEstablishingLinePool } from './establishingLine'
export { reactionLinePool as rumourCrisisReactionLinePool } from './reactionLine'
export { mannerNotePool as rumourCrisisMannerNotePool } from './mannerNote'
export { choiceLabelPool as rumourCrisisChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as rumourCrisisEffectPreviewPool } from './effectPreview'
