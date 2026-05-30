// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5: added the
// `title` slot pool. Title composition moved from `formatTitle` to a
// gated SlotSpec; template glue keeps prepending the actor display.
//
// Slot manifest for the drink_order template. The Phase-B `sim_backed_hook`
// slot landed as the `establishing_line` slot in Phase 169 / ISSUE-137
// (Complete Surface arc, Phase 2): a sim-backed matrix keyed on the
// `regular_customer` salience reads (irritation × loyalty bands, the
// family pressure, choice-affecting memories, the repeat-visit pattern).
// It backs the slot's conditions against real signals rather than the
// silence the spike-era manifest noted.

export { titlePool as drinkOrderTitlePool } from './title'
// Phase 169 / ISSUE-137 — Complete Surface arc, Phase 2 (drinkOrder Parity).
// Sim-backed establishing line that opens the body on the regular's
// standing, replacing the raw `recentContext` splice the body used to end on.
export { establishingLinePool as drinkOrderEstablishingLinePool } from './establishingLine'
export { orderLinePool } from './orderLine'
export { mannerNotePool } from './mannerNote'
// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
export { choiceLabelPool as drinkOrderChoiceLabelPool } from './choiceLabel'
export { effectPreviewPool as drinkOrderEffectPreviewPool } from './effectPreview'
