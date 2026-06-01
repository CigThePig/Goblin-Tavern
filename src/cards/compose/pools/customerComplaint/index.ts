// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Slot manifest for the customer_complaint compositional template
// (cohort case). Replaces (with `regularComplaint/`) the legacy
// customerComplaint hand-written template. The matching spec at
// `specs/cards/customer_complaint.spec.yaml` records the design.

export { titlePool as customerComplaintTitlePool } from './title'
// Phase 188 / ISSUE-155 — optional sim-backed lead line naming the cause.
export { causeLinePool as customerComplaintCauseLinePool } from './causeLine'
export { establishingLinePool as customerComplaintEstablishingLinePool } from './establishingLine'
export { reactionLinePool as customerComplaintReactionLinePool } from './reactionLine'
export { mannerNotePool as customerComplaintMannerNotePool } from './mannerNote'
export { choiceLabelPool as customerComplaintChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as customerComplaintEffectPreviewPool } from './effectPreview'
