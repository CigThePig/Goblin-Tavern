// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Slot manifest for the monthly_review compositional template. The
// legacy `monthlyReviewCard` (`composeBody` + raw `${label} ${value}
// (${trend})` pressure dumps) is rewritten in place to drive through
// these pools. Narrator-voiced — the seed's primaryActor is a
// `{ kind: 'other', id: 'month:${monthKey}' }` ref with no
// castAttributes. Design record at `specs/cards/monthly_review.spec.yaml`.

export { titlePool as monthlyReviewTitlePool } from './title'
export { establishingLinePool as monthlyReviewEstablishingLinePool } from './establishingLine'
export { reactionLinePool as monthlyReviewReactionLinePool } from './reactionLine'
export { mannerNotePool as monthlyReviewMannerNotePool } from './mannerNote'
export { choiceLabelPool as monthlyReviewChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as monthlyReviewEffectPreviewPool } from './effectPreview'
