// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5: added the
// `title` slot pool. Title composition moved from `formatTitle` to a
// gated SlotSpec; template glue keeps prepending the actor display.
//
// Slot manifest for the drink_order template. The `sim_backed_hook`
// slot from Phase B is intentionally absent — it gates on signals the
// sim does not yet emit (no `repeatCount`/`subjectTag` tracking, no
// confirmed `stock_shortage` pressure id). Wiring it now would create
// dead pool entries or assert unbacked facts. Phase D / E re-enable it
// per-snippet once backing signals exist.

export { titlePool as drinkOrderTitlePool } from './title'
export { orderLinePool } from './orderLine'
export { mannerNotePool } from './mannerNote'
