// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Slot manifest for the reputation_shift compositional template.
// Replaces the legacy hand-written `reputationShiftWeeklyCard`
// (deleted in this phase) which had a `timings: ['end_week']` filter
// that never matched the generator's `closing` emit. Narrator-voiced;
// no `voiceAxis` / `verbalTic` conditions in any pool. Design record
// at `specs/cards/reputation_shift.spec.yaml`.

export { titlePool as reputationShiftTitlePool } from './title'
export { establishingLinePool as reputationShiftEstablishingLinePool } from './establishingLine'
export { reactionLinePool as reputationShiftReactionLinePool } from './reactionLine'
export { mannerNotePool as reputationShiftMannerNotePool } from './mannerNote'
export { choiceLabelPool as reputationShiftChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as reputationShiftEffectPreviewPool } from './effectPreview'
