import { seedCareerArcs, advanceCareerArcs } from './careerArcs'
import { getStaffModuleState } from '../staff/workforceState'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { TeleologyEntry } from '../../state/TavernState'
import {
  advanceLifecycleEntry,
  resolveBranchingMilestone,
  type LifecycleDefinition,
  type LifecycleTrigger,
} from '../kernel'
import {
  createStaffMasteryArc,
  GROWTH_FLOOR_LOYALTY,
  PROVEN_LOYALTY,
  PROVEN_TAG,
  readArcSubjectId,
  staffMasteryArcDefinition,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from './staffMasteryArc'

// Phase 4b (teleology) — `arcModule` now makes arcs MOVE on their own.
// 4a only seeded and attached the hardcoded arc; 4b adds the autonomous
// trigger (no player investment), fork-on-state branching, the named
// `'arc'` RNG stream, and causality-on-advancement.
//
// The arc is a sibling to `ventureModule`: both `dependsOn: ['kernel']`
// and neither imports the other. The key contrast — the venture trigger
// reads owner-time INVESTMENT; the arc trigger is AUTONOMOUS, hooking the
// same `startDay` tick pattern the regulars/expeditions/culture updates
// use (plan §"Phase 4b").

// Catalog: arc id → its lifecycle definition. Keyed so the tick advances
// any registered arc without hardcoding a single one (mirrors the venture
// blueprint catalog).
const ARC_DEFINITIONS: Record<string, LifecycleDefinition> = {
  [STAFF_MASTERY_ARC_ID]: staffMasteryArcDefinition,
}

// ---- 4a behaviour (unchanged): seed + attach the hardcoded arc ----
function seedAndAttachHardcodedArc(ctx: SimContext): void {
  if (ctx.state.arcs[STAFF_MASTERY_ARC_ID]) return
  const staff = ctx.state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]
  if (!staff || !staff.castAttributes) return
  if (staff.castAttributes.arcId) return

  const subjectName = staff.name.display
  const label = `${subjectName}'s path to mastery`
  const day = ctx.state.calendar.totalDaysElapsed

  ctx.addArc(createStaffMasteryArc(label, day), {
    source: 'arcs.spawn',
    readable: `${label} begins, tracked through their working days and loyalty.`,
    tags: ['teleology', 'arc', 'spawn', STAFF_MASTERY_ARC_ID],
  })

  // Attach WITHOUT touching the 0–100 loyalty meter — only
  // `castAttributes.arcId` changes (the 4a loyalty-coexistence invariant).
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

// ---- 4b: the autonomous trigger ----
//
// Reads NO player intent. It resolves the branching milestone for the
// entry's current stage; advancement happens once the autonomously-
// accrued progress clears the milestone requirement. The fork is decided
// by the `proven` tag the tick syncs from the subject's loyalty (below).
const autonomousTrigger: LifecycleTrigger = (entry, ctx, definition) => {
  const milestone = definition.milestones.find((m) => m.fromStage === entry.stage)
  if (!milestone) return { advanced: false }
  const resolved = resolveBranchingMilestone(entry, ctx, milestone)
  if (!resolved) return { advanced: false }
  return {
    advanced: true,
    toStage: resolved.nextStage,
    effects: resolved.effects,
    // Terminality is milestone DATA (guardrail §8) — the kernel never
    // hardcodes which stage ends a lifecycle.
    ...(resolved.terminal ? { status: 'completed' as const } : {}),
    cause: {
      source: 'arcs.advance',
      readable: `${entry.label} advanced on its own to ${resolved.nextStage}.`,
      tags: ['teleology', 'arc', 'advance', entry.id, `stage:${resolved.nextStage}`],
    },
  }
}

// Sync the `proven` fork tag to the subject's loyalty. This is the
// producer for the fork condition (guardrail §10): the branch is reachable
// because loyalty genuinely moves. Only writes when the tag flips, so a
// stable loyalty never churns causes.
function syncProvenTag(ctx: SimContext, entry: TeleologyEntry, loyalty: number): void {
  const shouldBeProven = loyalty >= PROVEN_LOYALTY
  const isProven = entry.tags.includes(PROVEN_TAG)
  if (shouldBeProven === isProven) return
  const tags = shouldBeProven
    ? [...entry.tags, PROVEN_TAG]
    : entry.tags.filter((t) => t !== PROVEN_TAG)
  ctx.modifyArc(entry.id, { tags }, {
    source: 'arcs.proven',
    readable: shouldBeProven
      ? `${entry.label}: the character has proven themselves.`
      : `${entry.label}: the character's footing has slipped.`,
    tags: ['teleology', 'arc', 'proven', entry.id],
  })
}

// Accrue progress autonomously. Higher loyalty means a higher chance of a
// strong day (+2); a plain day is +1. Minimum gain 1/day keeps the arc
// advancing reliably. The roll uses the named `'arc'` stream so it is
// replay-deterministic and never shifts service/identity generation.
function accrueProgress(ctx: SimContext, entry: TeleologyEntry, loyalty: number): void {
  if (loyalty < GROWTH_FLOOR_LOYALTY) return
  // Scale the strong-day chance with loyalty above the floor (0–~0.7).
  const span = 100 - GROWTH_FLOOR_LOYALTY
  const strongChance = Math.min(0.7, Math.max(0, (loyalty - GROWTH_FLOOR_LOYALTY) / span))
  const gain = ctx.getRngStream('arc').chance(strongChance) ? 2 : 1
  ctx.modifyArc(entry.id, { progress: entry.progress + gain }, {
    source: 'arcs.progress',
    readable: `${entry.label} grows by ${gain}.`,
    tags: ['teleology', 'arc', 'progress', entry.id],
  })
}

function autonomousArcTick(ctx: SimContext): void {
  // Snapshot the active arc ids up front; we re-read each entry after
  // mutating so the kernel advances against the freshly-accrued progress.
  const arcIds = Object.keys(ctx.state.arcs)
  for (const id of arcIds) {
    const entry = ctx.state.arcs[id]
    if (!entry || entry.status !== 'active') continue
    const definition = ARC_DEFINITIONS[entry.id]
    if (!definition) continue
    const subjectId = readArcSubjectId(entry)
    if (!subjectId) continue
    const staff = ctx.state.staff[subjectId]
    if (!staff) {
      ctx.modifyArc(entry.id, { status: 'failed', stage: 'departed', updatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'arcs.departed', readable: `${entry.label} ended when its subject left.`, tags: ['teleology', 'arc', entry.id, 'departed'] })
      continue
    }
    if (!getStaffModuleState(ctx.state).roster.some(row => row.staffId === subjectId && row.available && row.contribution > 0)) continue

    syncProvenTag(ctx, ctx.state.arcs[id]!, staff.loyalty)
    accrueProgress(ctx, ctx.state.arcs[id]!, staff.loyalty)
    advanceLifecycleEntry(
      ctx,
      ctx.state.arcs[id]!,
      definition,
      autonomousTrigger,
      (entryId, changes, meta) => ctx.modifyArc(entryId, changes, meta),
    )
  }
}

const startDayHook: SimulationHook = (ctx) => {
  seedAndAttachHardcodedArc(ctx)
  seedCareerArcs(ctx)
}

export const arcModule: SimulationModule = {
  id: 'arcs',
  version: '0.2.0',
  dependsOn: ['kernel'],
  hooks: { startDay: [startDayHook], endDay: [autonomousArcTick, advanceCareerArcs] },
}
