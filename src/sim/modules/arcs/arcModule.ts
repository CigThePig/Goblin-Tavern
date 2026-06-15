import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import {
  createStaffMasteryArc,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from './staffMasteryArc'

// Phase 4a (teleology) — `arcModule` owns the `state.arcs` slice. It is a
// sibling to `ventureModule`: both `dependsOn: ['kernel']` and neither
// imports the other (plan §1). 4a's only behaviour is to seed and attach
// one hardcoded arc, idempotently, through cause-emitting mutators —
// proving persistence, the diff/cause wiring, and the loyalty-coexistence
// invariant before any autonomous movement exists (that lands in 4b).
//
// The arc is spawned via a mutator (not seeded into `defaults`) so that
// the attach/spawn emits a `CauseEntry` — a fresh-state factory cannot
// emit causes. Guardrail §7: `addArc` writes a `teleology/arc/start`
// cause, and `createStateDiff` already walks the `arcs` slice (the spawn
// surfaces as an `arcs.<id>` keyset change).
function seedAndAttachHardcodedArc(ctx: SimContext): void {
  // Idempotent: only spawn once. After the first day the arc persists in
  // state, so re-running the hook every startDay is a no-op.
  if (ctx.state.arcs[STAFF_MASTERY_ARC_ID]) return
  const staff = ctx.state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]
  if (!staff || !staff.castAttributes) return
  if (staff.castAttributes.arcId) return

  // Generate the label once from the character's stored name and persist
  // it on the entry (Phase 21 principle: identity is state, not a string
  // regenerated on every view).
  const subjectName = staff.name.display
  const label = `${subjectName}'s path to mastery`
  const day = ctx.state.calendar.totalDaysElapsed

  ctx.addArc(createStaffMasteryArc(label, day), {
    source: 'arcs.spawn',
    readable: `${label} begins, tracked alongside their loyalty.`,
    tags: ['teleology', 'arc', 'spawn', STAFF_MASTERY_ARC_ID],
  })

  // Attach the arc to the cast member WITHOUT touching the 0–100 loyalty
  // meter: only `castAttributes.arcId` changes. `modifyStaff` spreads the
  // rest of the staff record (including loyalty) through unchanged.
  ctx.modifyStaff(
    STAFF_MASTERY_ARC_SUBJECT_ID,
    { castAttributes: { ...staff.castAttributes, arcId: STAFF_MASTERY_ARC_ID } },
    {
      source: 'arcs.attach',
      readable: `${subjectName}'s arc is now linked to their character.`,
      tags: ['teleology', 'arc', 'attach', STAFF_MASTERY_ARC_ID],
    },
  )
}

const startDayHook: SimulationHook = (ctx) => seedAndAttachHardcodedArc(ctx)

export const arcModule: SimulationModule = {
  id: 'arcs',
  version: '0.1.0',
  dependsOn: ['kernel'],
  hooks: { startDay: [startDayHook] },
}
