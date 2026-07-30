import type { SimContext } from '../../core/context'
import type {
  StaffAbsenceKind,
  StaffPriorityId,
  StaffRoleId,
  StaffShiftId,
  StaffState,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import {
  getRoleDailyDemand,
  staffRegistry,
} from '../../registries/staffRegistry'
import {
  getPriorityDefaultAreaId,
  getPriorityWorkKind,
} from '../../registries/staffPriorityRegistry'
import { getRule } from '../../contracts/ruleset/index'
import { getServiceModuleState } from '../service/serviceModule'

import {
  bumpStaffTotal,
  getStaffModuleState,
  writeStaffSlice,
} from './workforceState'
import {
  CROSS_TRAINING_COVER_THRESHOLD,
  type StaffCoverageEntry,
  type StaffRosterEntry,
  type StaffWorkKind,
} from './workforceTypes'
import {
  coworkerEdgeId,
  findConflictPairs,
  findWillingCover,
  noteContact,
} from './relationships'
import {
  UNEXCUSED_MEMORY_DAYS,
  recordUnexcusedAbsence,
  separateStaff,
  unexcusedRun,
} from './employment'

// Expansion Phase 3 §3.2 — turning twelve priorities into real allocations.
//
// THE CLAIM THIS FILE HAS TO MAKE GOOD ON. §3.2 asks for station assignment,
// coverage gaps, handoff and multitasking costs, skill fit, fatigue, recovery,
// overtime — and, in the required-tests list, "service outputs traceable to
// actual assignment and staff state". Before this phase a priority was a lookup
// into a table of six modifiers; who was where, whether anyone was on the door
// at all, and whether the person had worked nine days straight made no
// difference to anything.
//
// So the roster is now the record service is derived FROM. Each row ends in one
// number, `contribution`, and every factor that produced it is on the same row
// with a note. `priorityEffects.ts` multiplies a member's published modifiers by
// it. That is what makes the traceability claim checkable rather than rhetorical:
// if a member's contribution is 0.6, the row says which of station, cover,
// handoff or shift took the other 0.4.
//
// WHY THE DEFAULTS ARE EXACTLY NEUTRAL. One body per role, on its role's default
// priority, in that priority's default area, on the default shift, scores
// `skillFit 1 × shiftCoverage 1 × (1 − 0) = 1`. The reference route therefore
// produces the same service-quality numbers it produced before this phase, and
// every deviation from 1 is something the PLAYER did — moved someone, switched
// their focus, put two people on one station and nobody on another, or ran them
// into the ground.
//
// SHIFTS ARE NOT A SECOND CLOCK. The day-clock contract (§2.5) owns the owner's
// 360 minutes and this phase does not reprice it. A shift changes WHAT gets
// covered, not how many minutes exist: two bodies on the same role and the same
// shift overlap and leave the rest of the day short, which is why the second one
// counts for less than the first. Within-day service flow belongs to Phase 4;
// this phase stops at who is on and what that is worth.

const SOURCE = 'staff.roster'

/** §3.2 — how much of the trading day each shift covers. */
const SHIFT_COVERAGE: Record<StaffShiftId, number> = {
  early: 1,
  late: 1,
  /** A double is more hours from one body — bought at an overtime price. */
  double: 1.4,
  rest: 0,
}

/**
 * A second body on the same role AND the same shift is worth less than the
 * first: they are on at the same time as each other and off at the same time.
 * Spreading the crew across `early` and `late` is what buys full cover.
 */
const SAME_SHIFT_OVERLAP_FACTOR = 0.75

/** Station away from where the work actually is. */
const OFF_STATION_FIT = 0.85
/** Switching focus from yesterday eats part of the day. */
const PRIORITY_SWITCH_HANDOFF = 0.15
/** Holding down a second role as well as your own. */
const MULTITASK_HANDOFF = 0.1
const MAX_HANDOFF = 0.4

/**
 * Patrons one available body absorbs on a normal night.
 *
 * Used ONLY for the experience a day is worth — a busy night teaches more than a
 * dead one. It is not a second fatigue rule: see `dayFatigueAndStress` for why
 * there is exactly one of those.
 */
const NOMINAL_PATRONS_PER_BODY = 24

const OVERTIME_FATIGUE_FACTOR = 1.6

/**
 * Extra fatigue a rest day sheds, on top of the morning's ordinary recovery.
 *
 * This is what the player buys with the coverage they gave up, so it has to be
 * worth more than a quiet day — otherwise `rest` would be a strictly worse
 * choice than simply hoping for light traffic.
 */
const REST_DAY_FATIGUE_RECOVERY = 4
const OVERTIME_STRESS = 2
/** Stress each unit of uncovered role demand costs the people who did turn up. */
const COVERAGE_GAP_STRESS = 3
/** Stress from sharing a station with somebody you cannot stand. */
const CONFLICT_STRESS = 3
/** Experience a nominal day's work is worth. 100 buys a skill point. */
const NOMINAL_EXPERIENCE = 4

/**
 * §3.2 / §5.4 — the ONE rule that turns a day's work into fatigue and stress.
 *
 * This is a MOVE, not an addition. Phase 12 put a traffic-driven fatigue rule in
 * `service/resolveService.ts` (`applyStaffStressFatigue`), keyed off the staff
 * member's ROLE. Adding a second rule here would have been the duplication §2.2
 * forbade for capacity applied to a meter: two writers of `staff.fatigue`, both
 * charging for the same day, and the player's fatigue climbing twice as fast as
 * either rule intended. So the whole computation moved to the staff module,
 * which owns staff transitions (§5.4), and the service module now READS these
 * numbers for its report rather than writing them.
 *
 * Two deliberate improvements came with the move, and neither changes the
 * reference route:
 *
 *   * the divisor keys off WORK KIND rather than role, which is what §3.2's
 *     "service versus cleaning, repair, security" allocation actually means. A
 *     cook sent to scrub the kitchen tires like a cleaner, not like a cook. On
 *     the default assignment every role maps to the same divisor it had before.
 *   * the Phase 3 burdens — overtime, a short-handed rota, sharing a station
 *     with somebody you cannot stand — are added on top. All three are zero on
 *     the reference route, so its numbers are unchanged.
 */
const HEAVY_WORK_KINDS: ReadonlySet<StaffWorkKind> = new Set([
  'kitchen',
  'service',
])
/** Patrons per point of fatigue, for work on the floor or in the kitchen. */
const HEAVY_TRAFFIC_DIVISOR = 30
/** …and for the quieter kinds. */
const LIGHT_TRAFFIC_DIVISOR = 60

/** Per-priority strain, carried over from the Phase 12 rule unchanged. */
const PRIORITY_FATIGUE: Record<string, number> = {
  quality: 1,
  speed: 2,
}
const PRIORITY_STRESS: Record<string, number> = {
  quality: 1,
  maximize_sales: 2,
}

/** Fatigue and stress shed per day while genuinely off sick or on leave. */
const ABSENCE_FATIGUE_RECOVERY = 6
const ABSENCE_STRESS_RECOVERY = 3

// Illness / injury risk. Deliberately small at rest and steep under load — the
// point is that exhaustion has a cost the player can see coming, not that people
// randomly vanish.
const ILLNESS_BASE_RISK = 0.002
const ILLNESS_FATIGUE_DIVISOR = 2000
const ILLNESS_STRESS_DIVISOR = 4000
/** Extra risk once somebody has worked a full week without a rest day. */
const OVERWORK_RISK = 0.02
const OVERWORK_DAYS = 7

/**
 * The floor under the illness rule: nobody falls ill until they are actually
 * worn down.
 *
 * Without it a day-zero crew — fatigue in the twenties, stress in the thirties —
 * could lose somebody on the opening morning, which reads as the simulation being
 * arbitrary rather than as a consequence. Absence has to be something the PLAYER
 * caused: run people past `ILLNESS_MIN_FATIGUE`, wind them up past
 * `ILLNESS_MIN_STRESS`, or work them a full week without a rest day, and the risk
 * switches on. Below all three it is exactly zero.
 */
const ILLNESS_MIN_FATIGUE = 40
const ILLNESS_MIN_STRESS = 60

/** Days somebody is out. Injuries take longer than a bad stomach. */
const ILLNESS_DAYS = 2
const INJURY_DAYS = 4

/** Consecutive unexcused absences before the job is treated as abandoned. */
export const ABANDONMENT_DAYS = 4

// ---------------------------------------------------------------------------
// Morning: absence, recovery, tenure
// ---------------------------------------------------------------------------

export type AbsenceOutcome = {
  returned: string[]
  stillOut: string[]
  newlyAbsent: Array<{ staffId: string; kind: StaffAbsenceKind; untilDay: number }>
  abandoned: string[]
}

/**
 * Resolve who is in today.
 *
 * Order matters: returns first (so somebody whose leave ends today is available
 * and cannot immediately fall ill on the same morning), then the people still
 * out, then at most ONE new absence. The cap is the difference between a rule
 * and a catastrophe — a bad roll should cost the player a body, not the tavern.
 */
export function resolveAbsences(ctx: SimContext): AbsenceOutcome {
  const today = ctx.state.calendar.totalDaysElapsed
  const out: AbsenceOutcome = {
    returned: [],
    stillOut: [],
    newlyAbsent: [],
    abandoned: [],
  }
  const members = [...Object.values(ctx.state.staff)].sort((a, b) =>
    a.id.localeCompare(b.id),
  )

  // Somebody who simply stops turning up eventually stops being employed. This
  // is the one separation the player never chose, and it needs a warning window
  // rather than a surprise, which `ABANDONMENT_DAYS` provides.
  //
  // JUDGED BEFORE THE RETURN PASS, and on the RUN rather than on one absence.
  // Both halves were wrong. An absence is cleared the morning its `untilDay`
  // arrives, so a check that ran afterwards could never see one that had lasted
  // its full length — the threshold was unreachable by construction. And the
  // only thing that writes an unexcused absence takes a single day at a time,
  // so no single absence was ever going to reach four days anyway. The run is
  // what "stopped turning up" actually means.
  for (const member of members) {
    const absence = member.absence
    if (!absence || absence.kind !== 'unexcused') continue
    const thisAbsence = today - absence.startedOnDay
    const run = unexcusedRun(ctx.state, member.id)
    if (thisAbsence < ABANDONMENT_DAYS && run < ABANDONMENT_DAYS) continue
    separateStaff(ctx, {
      staffId: member.id,
      kind: 'abandoned',
      reason:
        thisAbsence >= ABANDONMENT_DAYS
          ? `absent without leave for ${thisAbsence} days`
          : `did not come in ${run} days out of the last ${UNEXCUSED_MEMORY_DAYS}`,
      source: `${SOURCE}.abandonment`,
    })
    out.abandoned.push(member.id)
  }

  for (const member of members) {
    if (out.abandoned.includes(member.id)) continue
    const absence = member.absence
    if (!absence) continue
    if (today < absence.untilDay) {
      out.stillOut.push(member.id)
      continue
    }
    // Notice running out is the separation event's business, not the roster's:
    // clearing it here would put somebody back on the rota the day they were
    // supposed to leave.
    if (absence.kind === 'notice_served') {
      out.stillOut.push(member.id)
      continue
    }
    ctx.modifyStaff(
      member.id,
      { absence: undefined, unavailable: false },
      {
        source: `${SOURCE}.return`,
        sourceType: 'staff',
        target: `staff:${member.id}`,
        targetType: 'staff',
        amount: 1,
        readable: `${member.name.display} is back on the rota after ${absence.kind === 'leave' ? 'time off' : absence.kind}.`,
        tags: ['staff', 'absence', 'return', absence.kind, member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    out.returned.push(member.id)
  }

  // One new absence at most, and only for somebody who is in today.
  //
  // Today's returnees are excluded. The ordering above puts returns first so that
  // somebody whose leave ends this morning is available — but without this the
  // very next loop would consider that still-tired person for a fresh illness
  // roll and could take them straight back out before they ever reached a roster,
  // which is the opposite of what coming back is supposed to mean.
  const returnedToday = new Set(out.returned)
  const recoveryMultiplier = getRule(ctx.state, 'staffRecoveryMultiplier')
  const rng = ctx.getRngStream('staff_wellbeing')
  for (const member of members) {
    const live = ctx.state.staff[member.id]
    if (!live || live.absence) continue
    if (returnedToday.has(member.id)) continue
    if (live.shift === 'rest') continue
    const risk = illnessRisk(live, recoveryMultiplier)
    if (rng.float() >= risk) continue

    // Injury rather than illness when the work itself is physical — the fitting
    // that fell on them was a repair job, not a head cold.
    const workKind = getPriorityWorkKind(live.currentPriority)
    const injured = workKind === 'repair' || workKind === 'security'
    const kind: StaffAbsenceKind = injured ? 'injury' : 'illness'
    const days = injured ? INJURY_DAYS : ILLNESS_DAYS
    const untilDay = today + days
    const reason = injured
      ? `hurt on ${workKind === 'repair' ? 'a repair job' : 'the door'} (fatigue ${live.fatigue})`
      : `taken ill (fatigue ${live.fatigue}, stress ${live.stress})`

    ctx.modifyStaff(
      member.id,
      {
        absence: { kind, startedOnDay: today, untilDay, reason },
        unavailable: true,
      },
      {
        source: `${SOURCE}.${kind}`,
        sourceType: 'staff',
        target: `staff:${member.id}`,
        targetType: 'staff',
        amount: -1,
        readable: `${live.name.display} is out for ${days} day(s) — ${reason}.`,
        tags: ['staff', 'absence', kind, member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    ctx.addMemory({
      id: `staff_absent_${member.id}`,
      source: `${SOURCE}.${kind}`,
      actors: [{ kind: 'staff', id: member.id }],
      tags: ['staff', 'absence', kind, member.id],
      metadata: { staffId: member.id, kind, days, reason },
    })
    out.newlyAbsent.push({ staffId: member.id, kind, untilDay })
    break
  }

  // Anyone out today sheds fatigue faster than they would on the floor, and
  // counts against the run's absence tally.
  for (const member of Object.values(ctx.state.staff)) {
    const absence = member.absence
    if (!absence) continue
    bumpStaffTotal(ctx, 'absenceDays')
    if (absence.kind === 'notice_served') continue
    const nextFatigue = clampPercent(member.fatigue - ABSENCE_FATIGUE_RECOVERY)
    const nextStress = clampPercent(member.stress - ABSENCE_STRESS_RECOVERY)
    if (nextFatigue === member.fatigue && nextStress === member.stress) continue
    ctx.modifyStaff(
      member.id,
      { fatigue: nextFatigue, stress: nextStress, unavailable: true },
      { source: `${SOURCE}.absent_recovery`, reason: 'absent_recovery' },
    )
  }

  return out
}

export function illnessRisk(
  member: StaffState,
  recoveryMultiplier: number,
): number {
  const overworked = (member.consecutiveDaysWorked ?? 0) >= OVERWORK_DAYS
  // The floor. A rested, unstressed crew that has had a day off does not get ill.
  if (
    member.fatigue < ILLNESS_MIN_FATIGUE &&
    member.stress < ILLNESS_MIN_STRESS &&
    !overworked
  ) {
    return 0
  }
  const raw =
    ILLNESS_BASE_RISK +
    member.fatigue / ILLNESS_FATIGUE_DIVISOR +
    member.stress / ILLNESS_STRESS_DIVISOR +
    (overworked ? OVERWORK_RISK : 0)
  // The ruleset's recovery knob works both ways: a world that lets people bounce
  // back also makes them harder to knock down. No new knob for the same idea.
  return Math.max(0, raw / Math.max(0.1, recoveryMultiplier))
}

/** Put somebody out deliberately — granted leave, or a staff member calling in. */
export function setAbsence(
  ctx: SimContext,
  staffId: string,
  input: {
    kind: StaffAbsenceKind
    days: number
    reason: string
    source: string
    /**
     * Whether today counts as one of the days off. Default `true`, which is
     * right for anything decided while the day is still ahead — the owner
     * granting leave in the morning takes them off today's rota.
     *
     * `false` shifts the window one day forward, and the autonomous
     * `call_in_sick` needs it: actors run at `endDay`, when the shift has
     * already been worked. With the default the absence expired on the very next
     * morning, so nobody ever missed a roster, no service was ever short-handed
     * by it, and repeated unexcused absence could never reach the abandonment
     * threshold — a rule that fired and cost nothing.
     */
    includeToday?: boolean
  },
): boolean {
  const member = ctx.state.staff[staffId]
  if (!member || member.absence) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const startedOnDay = input.includeToday === false ? today + 1 : today
  ctx.modifyStaff(
    staffId,
    {
      absence: {
        kind: input.kind,
        startedOnDay,
        untilDay: startedOnDay + Math.max(1, input.days),
        reason: input.reason,
      },
      unavailable: true,
      consecutiveDaysWorked: 0,
    },
    {
      source: input.source,
      sourceType: 'staff',
      target: `staff:${staffId}`,
      targetType: 'staff',
      amount: -1,
      readable: `${member.name.display} is off for ${Math.max(1, input.days)} day(s) — ${input.reason}.`,
      tags: ['staff', 'absence', input.kind, staffId],
      relatedActors: [{ kind: 'staff', id: staffId }],
      relatedSystems: ['staff'],
    },
  )
  // A no-show goes on the employment record as well as on the person, because
  // "how often does this happen?" is a fact about the job, not about today, and
  // the abandonment rule reads the run rather than one absence's length.
  if (input.kind === 'unexcused') {
    recordUnexcusedAbsence(ctx, staffId, Math.max(1, input.days))
  }
  return true
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

function defaultAreaFor(
  member: StaffState,
  priorityId: StaffPriorityId | undefined,
): string {
  return (
    member.assignedAreaId ??
    getPriorityDefaultAreaId(priorityId) ??
    'main_room'
  )
}

function workKindFor(
  member: StaffState,
  priorityId: StaffPriorityId | undefined,
): StaffWorkKind {
  return getPriorityWorkKind(priorityId) ?? 'service'
}

function crossTrainingFor(member: StaffState, roleId: StaffRoleId): number {
  return member.crossTraining?.[roleId] ?? 0
}

/**
 * Build today's roster and coverage.
 *
 * Runs at `assignStaffPriorities`, immediately after the priorities are applied,
 * so the assignment it derives is the assignment the day actually runs on.
 */
export function buildRoster(ctx: SimContext): {
  roster: StaffRosterEntry[]
  coverage: StaffCoverageEntry[]
} {
  const slice = getStaffModuleState(ctx.state)
  const changed = new Set(slice.priorityChanges ?? [])
  const members = [...Object.values(ctx.state.staff)].sort((a, b) =>
    a.id.localeCompare(b.id),
  )

  // ---- who is covering for whom
  //
  // Cover is offered by a colleague who actually gets on with the absent member
  // (§3.3), so an owner who has let the crew fall out finds nobody steps up.
  const covering = new Map<string, StaffRoleId>()
  const alreadyCovering = new Set<string>()
  for (const member of members) {
    if (!member.absence) continue
    const helper = findWillingCover(ctx.state, member.id, alreadyCovering)
    if (!helper) continue
    const helperMember = ctx.state.staff[helper]
    if (!helperMember || helperMember.absence) continue
    if (
      helperMember.role !== member.role &&
      crossTrainingFor(helperMember, member.role) < CROSS_TRAINING_COVER_THRESHOLD
    ) {
      continue
    }
    covering.set(helper, member.role)
    alreadyCovering.add(helper)
  }

  // ---- shift crowding, per role
  const shiftCount = new Map<string, number>()
  for (const member of members) {
    if (member.absence) continue
    const key = `${member.role}|${member.shift ?? 'early'}`
    shiftCount.set(key, (shiftCount.get(key) ?? 0) + 1)
  }
  const shiftSeen = new Map<string, number>()

  const roster: StaffRosterEntry[] = []
  for (const member of members) {
    const shift: StaffShiftId = member.shift ?? 'early'
    const priorityId = member.currentPriority
    const areaId = defaultAreaFor(member, priorityId)
    const workKind = workKindFor(member, priorityId)
    const available = !member.absence && shift !== 'rest'
    const notes: string[] = []

    if (member.absence) {
      notes.push(`Out: ${member.absence.reason}`)
    } else if (shift === 'rest') {
      notes.push('Rest day — no cover from this member.')
    }

    // shift coverage, discounted for overlap with a same-role, same-shift peer
    let shiftCoverage = available ? SHIFT_COVERAGE[shift] : 0
    if (available) {
      const key = `${member.role}|${shift}`
      const index = (shiftSeen.get(key) ?? 0) + 1
      shiftSeen.set(key, index)
      if (index > 1) {
        shiftCoverage *= SAME_SHIFT_OVERLAP_FACTOR
        notes.push(
          `Shares the ${shift} shift with ${index - 1} other ${roleLabel(member.role)} — overlapping hours.`,
        )
      }
    }

    // skill fit
    let skillFit = available ? 1 : 0
    const priorityArea = getPriorityDefaultAreaId(priorityId)
    if (available && priorityArea && areaId !== priorityArea) {
      skillFit *= OFF_STATION_FIT
      notes.push(
        `Stationed in ${areaLabel(ctx.state, areaId)} rather than ${areaLabel(ctx.state, priorityArea)}.`,
      )
    }
    const coveringRoleId = covering.get(member.id)
    if (available && coveringRoleId && coveringRoleId !== member.role) {
      const level = crossTrainingFor(member, coveringRoleId)
      const coverFit = 0.5 + level * 0.005
      skillFit *= coverFit
      notes.push(
        `Covering ${roleLabel(coveringRoleId)} on ${level} cross-training.`,
      )
    }

    // handoff and multitasking
    let handoffPenalty = 0
    if (available && changed.has(member.id)) {
      handoffPenalty += PRIORITY_SWITCH_HANDOFF
      notes.push('Switched focus today — part of the day lost to the handover.')
    }
    if (available && coveringRoleId) {
      handoffPenalty += MULTITASK_HANDOFF
      notes.push('Holding down two jobs at once.')
    }
    handoffPenalty = Math.min(MAX_HANDOFF, handoffPenalty)

    const overtime = available && (shift === 'double' || coveringRoleId !== undefined)
    if (overtime) notes.push('Working over.')

    const contribution = available
      ? round2(skillFit * shiftCoverage * (1 - handoffPenalty))
      : 0

    roster.push({
      staffId: member.id,
      roleId: member.role,
      shift,
      areaId,
      workKind,
      ...(priorityId !== undefined ? { priorityId } : {}),
      available,
      ...(member.absence ? { absenceKind: member.absence.kind } : {}),
      skillFit: round2(skillFit),
      handoffPenalty: round2(handoffPenalty),
      shiftCoverage: round2(shiftCoverage),
      contribution,
      overtime,
      ...(coveringRoleId !== undefined ? { coveringRoleId } : {}),
      // Filled in at `afterService`, once the day's load is known.
      fatigueAdded: 0,
      stressAdded: 0,
      experienceAdded: 0,
      notes,
    })
  }

  const coverage = buildCoverage(roster)

  writeStaffSlice(
    ctx,
    (current) => ({ ...current, roster, coverage }),
    'build_roster',
  )
  return { roster, coverage }
}

/**
 * Role demand versus what the day actually got.
 *
 * A gap is what a missing founding staff member now produces instead of a thrown
 * error: the tavern keeps trading, the people who came in carry it, and the
 * report says exactly which role is short and by how much.
 */
export function buildCoverage(
  roster: ReadonlyArray<StaffRosterEntry>,
): StaffCoverageEntry[] {
  const covered = new Map<string, number>()
  const coveredBy = new Map<string, string[]>()

  for (const row of roster) {
    if (!row.available) continue
    const own = row.coveringRoleId ? row.shiftCoverage * 0.5 : row.shiftCoverage
    add(covered, row.roleId, own)
    if (row.coveringRoleId) {
      add(covered, row.coveringRoleId, row.shiftCoverage * 0.5 * row.skillFit)
      const list = coveredBy.get(row.coveringRoleId) ?? []
      list.push(row.staffId)
      coveredBy.set(row.coveringRoleId, list)
    }
  }

  const out: StaffCoverageEntry[] = []
  for (const def of [...staffRegistry.all()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const demand = getRoleDailyDemand(def.id)
    const have = round2(covered.get(def.id) ?? 0)
    if (demand <= 0 && have <= 0) continue
    const gap = round2(Math.max(0, demand - have))
    const helpers = coveredBy.get(def.id) ?? []
    out.push({
      roleId: def.id,
      demand,
      covered: have,
      gap,
      coveredBy: helpers,
      readable:
        gap > 0
          ? `${def.label}: ${have} of ${demand} covered — short by ${gap}.`
          : helpers.length > 0
            ? `${def.label}: covered, with help from ${helpers.length} other hand(s).`
            : `${def.label}: covered.`,
    })
  }
  return out
}

export function totalCoverageGap(coverage: ReadonlyArray<StaffCoverageEntry>): number {
  return round2(coverage.reduce((sum, row) => sum + row.gap, 0))
}

// ---------------------------------------------------------------------------
// After service: what the day cost the people who worked it
// ---------------------------------------------------------------------------

/**
 * The day's fatigue and stress for one roster row.
 *
 * Pure and exported, so the service report can quote the same numbers the staff
 * module wrote rather than recomputing them — one rule, one result, two readers.
 */
export function dayFatigueAndStress(input: {
  row: StaffRosterEntry
  visitors: number
  coverageGap: number
  incidents: ReadonlyArray<{ id: string }>
  inConflict: boolean
}): { fatigue: number; stress: number; notes: string[] } {
  const { row } = input
  if (!row.available) return { fatigue: 0, stress: 0, notes: [] }
  const notes: string[] = []

  const divisor = HEAVY_WORK_KINDS.has(row.workKind)
    ? HEAVY_TRAFFIC_DIVISOR
    : LIGHT_TRAFFIC_DIVISOR
  let fatigue = Math.round(input.visitors / divisor)
  let stress = 0

  const priorityId = row.priorityId ?? ''
  fatigue += PRIORITY_FATIGUE[priorityId] ?? 0
  stress += PRIORITY_STRESS[priorityId] ?? 0

  // Incidents land on whoever the work makes responsible for them, which is what
  // keying off work kind rather than role buys: a cook who spent the day on the
  // door carries the door's trouble.
  if (input.incidents.length > 0) {
    if (row.workKind === 'service') {
      stress += Math.min(8, input.incidents.length * 2)
    } else if (row.workKind === 'security') {
      const fights = input.incidents.filter(
        (incident) => incident.id === 'minor_brawl' || incident.id === 'chair_damage',
      ).length
      stress += Math.min(10, fights * 3)
    } else if (row.workKind === 'kitchen') {
      const food = input.incidents.filter(
        (incident) => incident.id === 'food_complaint',
      ).length
      stress += Math.min(6, food * 3)
    }
  }

  // ---- the Phase 3 burdens. All three are zero on the reference route.
  if (row.overtime) {
    fatigue = Math.round(fatigue * OVERTIME_FATIGUE_FACTOR)
    stress += OVERTIME_STRESS
    notes.push('worked over')
  }
  if (input.coverageGap > 0) {
    stress += Math.round(input.coverageGap * COVERAGE_GAP_STRESS)
    notes.push('short-handed')
  }
  if (input.inConflict) {
    stress += CONFLICT_STRESS
    notes.push('bad company on the station')
  }

  return { fatigue, stress, notes }
}

/**
 * Charge the day to the people who worked it, and credit what they learned.
 *
 * Runs at `afterService`, because the traffic it divides by is what actually came
 * through the door. The staff module sits at position 61 in the canonical
 * pipeline and the service module at 71, so this runs BEFORE the service
 * module's own `afterService` — which is what lets the service report read these
 * numbers instead of computing a second set of them.
 */
export function applyDayLoad(ctx: SimContext): void {
  const slice = getStaffModuleState(ctx.state)
  if (slice.roster.length === 0) return

  const visitors = totalVisitors(ctx.state)
  const incidents = getServiceModuleState(ctx.state).result.incidents ?? []
  const workingBodies = slice.roster.reduce(
    (sum, row) => sum + (row.available ? row.shiftCoverage : 0),
    0,
  )
  // Used only for experience: a busy night teaches more than a dead one.
  const loadFactor =
    workingBodies > 0
      ? clamp(visitors / (workingBodies * NOMINAL_PATRONS_PER_BODY), 0.25, 2.5)
      : 0
  const gap = totalCoverageGap(slice.coverage)
  if (gap > 0) bumpStaffTotal(ctx, 'coverageGapDays')

  // Conflict: two people who cannot stand each other, on the same station.
  const stations = new Map<string, string[]>()
  for (const row of slice.roster) {
    if (!row.available) continue
    const list = stations.get(row.areaId) ?? []
    list.push(row.staffId)
    stations.set(row.areaId, list)
  }
  const pairs: Array<[string, string]> = []
  for (const list of stations.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        pairs.push([list[i]!, list[j]!])
      }
    }
  }
  const conflicts = findConflictPairs(ctx.state, pairs)
  const inConflict = new Set(
    conflicts.flatMap((edge) => [edge.from.id, edge.to.id]),
  )

  const updated: StaffRosterEntry[] = []
  for (const row of slice.roster) {
    const member = ctx.state.staff[row.staffId]
    if (!member) continue
    if (!row.available) {
      updated.push(row)
      continue
    }

    const load = dayFatigueAndStress({
      row,
      visitors,
      coverageGap: gap,
      incidents,
      inConflict: inConflict.has(row.staffId),
    })
    // Experience follows the work actually done: a quiet day teaches little, and
    // a day spent covering a job you are barely trained for teaches a lot.
    const experienceAdded = Math.round(
      NOMINAL_EXPERIENCE * loadFactor * (row.coveringRoleId ? 1.5 : 1),
    )

    const nextFatigue = clampPercent(member.fatigue + load.fatigue)
    const nextStress = clampPercent(member.stress + load.stress)
    if (nextFatigue !== member.fatigue || nextStress !== member.stress) {
      ctx.modifyStaff(
        row.staffId,
        { fatigue: nextFatigue, stress: nextStress },
        {
          source: `${SOURCE}.day_load`,
          sourceType: 'staff',
          target: `staff:${row.staffId}.fatigue`,
          targetType: 'staff',
          amount: load.fatigue,
          readable:
            `${member.name.display} worked the day` +
            (load.notes.length > 0 ? ` (${load.notes.join(', ')})` : '') +
            `: fatigue +${load.fatigue}, stress +${load.stress}.`,
          tags: ['staff', 'workload', row.staffId],
          relatedActors: [{ kind: 'staff', id: row.staffId }],
          relatedSystems: ['staff', 'service'],
        },
      )
    }
    if (row.overtime) bumpStaffTotal(ctx, 'overtimeDays')

    updated.push({
      ...row,
      fatigueAdded: load.fatigue,
      stressAdded: load.stress,
      experienceAdded,
    })
  }

  // Conflict is a relationship fact, so it deepens the relationship it came
  // from rather than only taxing a meter.
  for (const edge of conflicts) {
    const a = ctx.state.staff[edge.from.id]
    const b = ctx.state.staff[edge.to.id]
    if (!a || !b) continue
    ctx.addCause({
      source: `${SOURCE}.conflict`,
      sourceType: 'staff',
      target: `staff:${a.id}.stress`,
      targetType: 'staff',
      amount: CONFLICT_STRESS,
      readable: `${a.name.display} and ${b.name.display} spent the day on top of each other and it showed.`,
      tags: ['staff', 'conflict', a.id, b.id],
      relatedActors: [
        { kind: 'staff', id: a.id },
        { kind: 'staff', id: b.id },
      ],
      relatedSystems: ['staff'],
    })
  }

  // Working the same station is the contact that builds — or sours — a working
  // relationship. This is the ONLY place coworker contact is created from the
  // ordinary run of a day, which is what keeps §3.3's "do not run every possible
  // pair every day" true: only pairs who were actually together are touched.
  for (const [a, b] of pairs) {
    const smooth = gap === 0 && loadFactor <= 1.3
    const hostile = findConflictPairs(ctx.state, [[a, b]]).length > 0
    noteContact(ctx, {
      aStaffId: a,
      bStaffId: b,
      affinityDelta: hostile ? -2 : smooth ? 3 : -1,
      trustDelta: smooth ? 1 : 0,
      reason: smooth ? 'a good shift together' : 'a hard shift together',
      tags: ['station', stationTag(slice.roster, a)],
    })
  }

  writeStaffSlice(ctx, (current) => ({ ...current, roster: updated }), 'day_load')
}

/**
 * End of day: tenure, consecutive days, and the rest-day reward.
 *
 * `consecutiveDaysWorked` is what `illnessRisk` and the overtime rule read, so
 * it has to be maintained where "did they work today" is finally known.
 */
export function advanceTenure(ctx: SimContext): void {
  const slice = getStaffModuleState(ctx.state)
  const worked = new Map(slice.roster.map((row) => [row.staffId, row.available]))
  const recoveryMultiplier = getRule(ctx.state, 'staffRecoveryMultiplier')

  for (const member of Object.values(ctx.state.staff)) {
    const didWork = worked.get(member.id) ?? false
    const changes: Partial<StaffState> = {
      daysEmployed: (member.daysEmployed ?? 0) + 1,
      consecutiveDaysWorked: didWork
        ? (member.consecutiveDaysWorked ?? 0) + 1
        : 0,
    }
    // A rest day is worth taking: the extra recovery is the thing the player
    // buys with the coverage they gave up.
    if (!didWork && member.shift === 'rest' && !member.absence) {
      changes.fatigue = clampPercent(
        member.fatigue - Math.round(REST_DAY_FATIGUE_RECOVERY * recoveryMultiplier),
      )
      changes.stress = clampPercent(member.stress - 2)
    }
    ctx.modifyStaff(member.id, changes, {
      source: `${SOURCE}.tenure`,
      reason: didWork ? 'worked_today' : 'did_not_work',
    })
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function totalVisitors(state: TavernState): number {
  const result = getServiceModuleState(state).result
  return Object.values(result.trafficByGroup ?? {}).reduce(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0,
  )
}

function stationTag(
  roster: ReadonlyArray<StaffRosterEntry>,
  staffId: string,
): string {
  return roster.find((row) => row.staffId === staffId)?.areaId ?? 'unknown'
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}

function areaLabel(state: TavernState, areaId: string): string {
  return state.areas[areaId]?.label ?? areaId
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export { coworkerEdgeId }
