// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Slot manifest for the drink_order template. The `sim_backed_hook`
// slot from Phase B is intentionally absent — it gates on signals the
// sim does not yet emit (no `repeatCount`/`subjectTag` tracking, no
// confirmed `stock_shortage` pressure id). Wiring it now would create
// dead pool entries or assert unbacked facts. Phase D / E re-enable it
// per-snippet once backing signals exist.

export { orderLinePool } from './orderLine'
export { mannerNotePool } from './mannerNote'
