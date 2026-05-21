// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
//
// Slot manifest for the staff_aside template. Hand-authored — no
// `sim_backed_hook` slot, mirroring `drink_order`'s Phase-C decision:
// the underlying sim signals (per-actor repeat-visit count, confirmed
// pressure ids) are still partial, and shipping a sim_backed slot now
// would create dead pool entries or assert unbacked facts. The matching
// spec at `specs/cards/staff_aside.spec.yaml` records the slot design.

export { asideLinePool } from './asideLine'
export { mannerNotePool } from './mannerNote'
