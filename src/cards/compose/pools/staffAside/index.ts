// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5: added the
// `title` slot pool.
// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6: added the
// `choice_label` + `effect_preview` slot pools.
// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7: added the
// sim-backed `establishing_line` slot pool. The matching spec at
// `specs/cards/staff_aside.spec.yaml` records the design.

export { titlePool as staffAsideTitlePool } from './title'
export { establishingLinePool as staffAsideEstablishingLinePool } from './establishingLine'
export { asideLinePool } from './asideLine'
export { mannerNotePool } from './mannerNote'
export { choiceLabelPool as staffAsideChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as staffAsideEffectPreviewPool } from './effectPreview'
