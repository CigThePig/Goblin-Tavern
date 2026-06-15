import type { TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition } from '../kernel'

// Phase 4a (teleology) — the arc analogue of Phase 1's single hardcoded
// venture. One staged trajectory attached to a starter staff member so the
// `state.arcs` slice carries real content to round-trip, diff, and attach.
// 4a ships NO autonomy and NO card: the arc simply exists at its initial
// stage. The autonomous trigger that reads driving meters and the fork-on-
// state milestones land in Phase 4b; this file only declares the shape.
export const STAFF_MASTERY_ARC_ID = 'arc_staff_mastery'

// The starter cast member the arc attaches to. `server` is seeded on day
// zero (see `staffRegistry` `defaultStaffId`), so this resolves on a fresh
// game. The arc reaches its subject through this id; the cast member
// reaches the arc through `castAttributes.arcId`.
export const STAFF_MASTERY_ARC_SUBJECT_ID = 'server'

// Milestones are declared now so the slice has a catalogued definition,
// but 4a never advances the arc (no trigger is registered). The branches
// are wired and exercised in Phase 4b, which adds the autonomous trigger
// and ships the producers for these conditions (guardrail §10). Until then
// the definition is dormant data, not a reachable path.
export const staffMasteryArcDefinition: LifecycleDefinition = {
  id: STAFF_MASTERY_ARC_ID,
  milestones: [],
}

export function createStaffMasteryArc(label: string, day: number): TeleologyEntry {
  return {
    id: STAFF_MASTERY_ARC_ID,
    kind: 'arc',
    label,
    stage: 'apprentice',
    progress: 0,
    status: 'active',
    tags: ['staff_arc', `subject:${STAFF_MASTERY_ARC_SUBJECT_ID}`],
    createdAtDay: day,
    updatedAtDay: day,
  }
}
