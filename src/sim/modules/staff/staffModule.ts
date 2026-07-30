import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { StaffPriorityId, StaffState } from '../../state/TavernState'

import {
  ensureRequiredStaffRolesRegistered,
  getRoleSkillCeiling,
  staffRegistry,
} from '../../registries/staffRegistry'
import {
  ensureRequiredStaffPrioritiesRegistered,
  getDefaultPriorityForRole,
  isPriorityAllowedForRole,
  staffPriorityRegistry,
} from '../../registries/staffPriorityRegistry'
import { namingProfileRegistry } from '../../content/naming/namingProfiles'
import { staffIdentityProfileRegistry } from '../../content/staff/staffIdentityProfiles'
import { clampPercent } from '../../state/normalize'
import { getWarnedScheduledEvents } from '../../contracts/scheduledEvents/index'

import {
  canStaffWork,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffMoraleBonus,
  getStaffStressPenalty,
} from './performance'
import { derivePriorityModifiers, summarizeStaff } from './priorityEffects'
import type {
  ServiceQualityModifiers,
  StaffEffectivenessSummary,
  StaffModuleState,
} from './types'
import {
  StaffWorkforceStateSchema,
  isActiveEdge,
  type StaffWorkKind,
} from './workforceTypes'
import {
  STAFF_MODULE_ID,
  createInitialStaffModuleState,
  getStaffModuleState,
  writeStaffSlice,
} from './workforceState'
import {
  ensureEmploymentRecords,
  ensureWorkforceFieldsOnState,
} from './employment'
import { refreshLaborMarket } from './laborMarket'
import { ageRelationships, listEdges, ownerTrust } from './relationships'
import {
  advanceTenure,
  applyDayLoad,
  buildRoster,
  resolveAbsences,
  totalCoverageGap,
} from './roster'
import { applyExperience } from './development'
import { listStaffIntents, runStaffActors } from './staffActors'
import { ensureStaffScheduledEventsRegistered } from './staffEvents'
import { describeQuitRiskContributors, quitRiskScore } from './staffEvents'
import { listWageArrears, totalWageArrears } from './staffWages'
import {
  getRule,
  scaleOngoingIntegerDecay,
} from '../../contracts/ruleset/index'

// Phase 11 §11.2 — Staff module. Expansion Phase 3 §3.1–§3.4 turns it from a
// publisher of six service-quality numbers into the owner of a workforce.
//
// The hook order is the phase's shape:
//
//   startDay                  who is in (absence, illness, returns), overnight
//                             recovery, the labor market, relationship ageing
//   assignStaffPriorities     priorities applied, then TODAY'S ROSTER derived
//                             from them — station, cover, handoff, overtime
//   beforeService             service-quality modifiers, scaled by the roster
//   afterService              what the day cost: fatigue, stress, experience,
//                             conflict, and the contact that builds relationships
//   endDay                    experience banked into skill, tenure, and the
//                             autonomous staff actors deciding and acting
//   endWeek                   wages (in `weekly`, which calls into this module)
//   generateReports           the STAFF REPORT
//
// TWO THINGS THAT USED TO BE HERE AND ARE NOT ANY MORE.
//
// `REQUIRED_STAFF_IDS` no longer throws. `startDayHook` used to abort the run if
// `cook`, `server` or `cleaner_bouncer` was missing, which made the game's
// central staff promise — people leave if you treat them badly — structurally
// impossible for exactly the three people it could have been about (plan §3.1).
// The constant survives as the DAY-ZERO roster, which is what it always really
// described; a missing role is now a coverage gap with a measurable cost.
//
// And the passive-recovery comment that said "Phase 12 wires the service-driven
// drift" is now wrong in the good way: `applyDayLoad` wires it, calibrated so a
// nominal day exactly offsets the morning's recovery.

export { STAFF_MODULE_ID }
const SOURCE = STAFF_MODULE_ID

/**
 * The staff the tavern OPENS with.
 *
 * Expansion Phase 3 §3.1 — no longer a structural requirement. `createInitialStaff`
 * seeds these three, `validateStaff` reports a role with declared demand and
 * nobody on it as a coverage warning rather than an error, and every one of them
 * can now be dismissed, resign, or be promoted out of the role.
 */
export const REQUIRED_STAFF_IDS = ['cook', 'server', 'cleaner_bouncer'] as const

const DAILY_STRESS_RECOVERY = 1
const DAILY_FATIGUE_RECOVERY = 2

export { createInitialStaffModuleState, getStaffModuleState }

function emptyServiceQuality(): ServiceQualityModifiers {
  return {
    foodQualityModifier: 0,
    serviceSpeed: 0,
    tabControl: 0,
    messControl: 0,
    fightControl: 0,
    repairSupport: 0,
    staffSummaries: [],
  }
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredStaffRolesRegistered()
  ensureRequiredStaffPrioritiesRegistered()
  ensureStaffScheduledEventsRegistered()

  // Reset only the PER-DAY fields. The workforce records (employment, labor
  // market, relationships, actors, totals) persist — resetting the whole slice
  // here, as Phase 11 did, would wipe them every morning.
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      appliedPriorities: {},
      rejectedAssignments: [],
      priorityChanges: [],
      serviceQuality: emptyServiceQuality(),
      roster: [],
      coverage: [],
      development: [],
      separations: [],
    }),
    'day_initialize',
  )

  // §5.7 belt and braces for a state that never went through the save path.
  ensureWorkforceFieldsOnState(ctx)
  ensureEmploymentRecords(ctx)

  // Who is in today. Runs before recovery so somebody who is out gets the
  // absence recovery rate rather than the working one.
  resolveAbsences(ctx)

  // §5.11 — lapse stale relationships and drop any pointing at somebody gone.
  ageRelationships(ctx)

  // §3.1 — the applicant board. Weekly, plus an immediate top-up whenever a
  // vacancy has nobody answering it.
  refreshLaborMarket(ctx)

  // Background passive recovery: a small bit of stress and fatigue shed each
  // morning. Expansion Phase 1 §1.3 — overnight recovery is one of the ruleset's
  // ongoing knobs: `easy` sheds half again as much, `hard` about two-thirds as
  // much. The fractional remainder is banked per staff member and per meter so a
  // 1.5x multiplier on a 2-point recovery really does average 3 rather than
  // rounding back to 2. `standard` is exactly 1 and banks nothing, leaving the
  // reference route's numbers untouched.
  //
  // Expansion Phase 3 §3.2 — somebody who is absent already had their (larger)
  // recovery applied by `resolveAbsences`, so they are skipped here rather than
  // being paid twice for the same day off.
  const recoveryMultiplier = getRule(ctx.state, 'staffRecoveryMultiplier')
  for (const staff of Object.values(ctx.state.staff)) {
    if (staff.absence) continue
    const stressRecovery = scaleOngoingIntegerDecay(
      ctx,
      `staff_recovery:${staff.id}:stress`,
      DAILY_STRESS_RECOVERY,
      recoveryMultiplier,
    )
    const fatigueRecovery = scaleOngoingIntegerDecay(
      ctx,
      `staff_recovery:${staff.id}:fatigue`,
      DAILY_FATIGUE_RECOVERY,
      recoveryMultiplier,
    )
    const nextStress = clampPercent(staff.stress - stressRecovery)
    const nextFatigue = clampPercent(staff.fatigue - fatigueRecovery)
    if (nextStress === staff.stress && nextFatigue === staff.fatigue) continue
    ctx.modifyStaff(
      staff.id,
      { stress: nextStress, fatigue: nextFatigue },
      { source: SOURCE, reason: 'daily_recovery' },
    )
  }
}

function readPriorityInput(ctx: SimContext): Record<string, StaffPriorityId> {
  const input = ctx.input as { staffPriorities?: Record<string, StaffPriorityId> }
  return input.staffPriorities ?? {}
}

const assignPrioritiesHook: SimulationHook = (ctx: SimContext): void => {
  const assignment = readPriorityInput(ctx)
  const applied: Record<string, StaffPriorityId> = {}
  const rejected: StaffModuleState['rejectedAssignments'] = []

  // First, validate any input pairs and mark rejected/applied.
  for (const [staffId, priorityId] of Object.entries(assignment)) {
    const staff = ctx.state.staff[staffId]
    if (!staff) {
      rejected.push({ staffId, priorityId, reason: 'unknown_staff' })
      continue
    }
    if (!staffPriorityRegistry.has(priorityId)) {
      rejected.push({ staffId, priorityId, reason: 'unknown_priority' })
      continue
    }
    if (!isPriorityAllowedForRole(staff.role, priorityId)) {
      rejected.push({
        staffId,
        priorityId,
        reason: 'priority_not_allowed_for_role',
      })
      continue
    }
    applied[staffId] = priorityId
  }

  // Fill in defaults for any staff member without a valid assignment.
  for (const staff of Object.values(ctx.state.staff)) {
    if (applied[staff.id]) continue
    const fallback = getDefaultPriorityForRole(staff.role)
    if (!fallback) continue
    applied[staff.id] = fallback
  }

  // Write currentPriority onto each staff member and the module slice.
  //
  // Expansion Phase 3 §3.2 — the members whose focus actually MOVED are recorded
  // here and nowhere else, because this is the only moment the previous value is
  // still readable. The roster charges them a handoff cost.
  const changed: string[] = []
  for (const staff of Object.values(ctx.state.staff)) {
    const next = applied[staff.id]
    if (next === undefined) continue
    if (staff.currentPriority === next) continue
    if (staff.currentPriority !== undefined) changed.push(staff.id)
    ctx.modifyStaff(
      staff.id,
      { currentPriority: next },
      { source: SOURCE, reason: 'assign_priority' },
    )
  }

  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      appliedPriorities: applied,
      rejectedAssignments: rejected,
      priorityChanges: changed,
    }),
    'assign_priorities',
  )

  // §3.2 — the assignment the day actually runs on, derived from the priorities
  // just applied.
  buildRoster(ctx)
}

const beforeServiceHook: SimulationHook = (ctx: SimContext): void => {
  // Phase 11 §11.5 — derive the service-quality modifiers service reads. Writing
  // them into the staff module slice (rather than pushing changes into customer /
  // area state directly) keeps the responsibilities clean: staff publishes the
  // signal; service math consumes it.
  //
  // Expansion Phase 3 §3.2 — the roster is passed in, so each member's published
  // contribution is scaled by their actual assignment. This is what makes
  // "service outputs traceable to actual assignment" true rather than asserted.
  const slice = getStaffModuleState(ctx.state)
  const serviceQuality = derivePriorityModifiers(
    Object.values(ctx.state.staff),
    slice.roster,
  )
  writeStaffSlice(
    ctx,
    (current) => ({ ...current, serviceQuality }),
    'derive_service_quality',
  )
}

const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  // §3.2 — charge the day to the people who worked it, and record the contact
  // that builds (or sours) working relationships.
  applyDayLoad(ctx)
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  // §3.1 — bank what they learned, then advance tenure and consecutive days.
  applyExperience(ctx)
  advanceTenure(ctx)
  // §3.3 — the autonomous half. Declares intent one evening, acts the next.
  runStaffActors(ctx)
}

// ---------- Reports ----------

function formatModifier(label: string, value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${label}: ${sign}${value.toFixed(1)}`
}

function describeStaffLine(
  ctx: SimContext,
  staff: StaffState,
  summary: StaffEffectivenessSummary | undefined,
): string[] {
  const roleLabel = staffRegistry.has(staff.role)
    ? staffRegistry.get(staff.role).label
    : staff.role
  const priorityLabel = staff.currentPriority
    ? staffPriorityRegistry.has(staff.currentPriority)
      ? staffPriorityRegistry.get(staff.currentPriority).label
      : staff.currentPriority
    : 'None'

  const effectiveness = summary?.effectiveness ?? getStaffEffectiveness(staff)
  const slice = getStaffModuleState(ctx.state)
  const row = slice.roster.find((entry) => entry.staffId === staff.id)
  const lines: string[] = []
  lines.push(`${staff.name.display} — ${roleLabel}`)
  lines.push(`  Priority: ${priorityLabel}`)
  // Phase 31 §31.10 — compact identity strip.
  if (staff.identity) {
    const id = staff.identity
    const personality =
      id.personalityTags.length > 0 ? id.personalityTags[0] : 'unflagged'
    lines.push(
      `  Identity: ${id.workStyle}, ${id.stressResponse}, ${personality} (${id.namingProfileId})`,
    )
  }
  // Expansion Phase 3 §3.1–§3.2 — the terms, the assignment and the condition.
  lines.push(
    `  Terms: ${staff.wage}/wk (${staff.paidThisWeek ? 'paid' : 'unpaid'}), ${staff.daysEmployed ?? 0} day(s) served, goal ${staff.careerGoal ?? 'unset'}`,
  )
  if (row) {
    lines.push(
      `  Assignment: ${row.shift} shift in ${ctx.state.areas[row.areaId]?.label ?? row.areaId}, ${row.workKind}${row.coveringRoleId ? `, covering ${row.coveringRoleId}` : ''}`,
    )
    lines.push(
      `  Contribution: ${row.contribution.toFixed(2)} (fit ${row.skillFit.toFixed(2)} × shift ${row.shiftCoverage.toFixed(2)} × handoff -${row.handoffPenalty.toFixed(2)})`,
    )
    for (const note of row.notes) lines.push(`    · ${note}`)
  }
  if (staff.absence) {
    lines.push(
      `  Absent: ${staff.absence.kind} until day ${staff.absence.untilDay} — ${staff.absence.reason}`,
    )
  }
  lines.push(
    `  Skill: ${staff.skill}/${getRoleSkillCeiling(staff.role)} (experience ${staff.experience ?? 0}/100)`,
  )
  lines.push(`  Morale: ${staff.morale}`)
  lines.push(`  Stress: ${staff.stress}`)
  lines.push(`  Fatigue: ${staff.fatigue}`)
  lines.push(`  Loyalty: ${staff.loyalty}`)
  lines.push(`  Your standing: ${ownerTrust(ctx.state, staff.id)}/100`)
  lines.push(`  Effectiveness: ${effectiveness}`)
  const arrears = totalWageArrears(ctx.state, staff.id)
  if (arrears > 0) lines.push(`  OWED: ${arrears} coin in back pay.`)
  const crossTraining = Object.entries(staff.crossTraining ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([roleId, level]) => `${roleId} ${level}`)
  if (crossTraining.length > 0) {
    lines.push(`  Cross-trained: ${crossTraining.join(', ')}`)
  }
  if (summary && !summary.canWork) lines.push(`  Notes: Unavailable today.`)
  return lines
}

function buildStaffReport(ctx: SimContext): ReportSection {
  const moduleState = getStaffModuleState(ctx.state)
  const summaries = new Map<string, StaffEffectivenessSummary>()
  for (const s of moduleState.serviceQuality.staffSummaries) {
    summaries.set(s.staffId, s)
  }

  const lines: string[] = []
  for (const staff of Object.values(ctx.state.staff)) {
    lines.push(...describeStaffLine(ctx, staff, summaries.get(staff.id)))
    lines.push('')
  }

  const sq = moduleState.serviceQuality
  lines.push('Service Quality Modifiers:')
  lines.push(`  ${formatModifier('Food quality', sq.foodQualityModifier)}`)
  lines.push(`  ${formatModifier('Service speed', sq.serviceSpeed)}`)
  lines.push(`  ${formatModifier('Tab control', sq.tabControl)}`)
  lines.push(`  ${formatModifier('Mess control', sq.messControl)}`)
  lines.push(`  ${formatModifier('Fight control', sq.fightControl)}`)
  lines.push(`  ${formatModifier('Repair support', sq.repairSupport)}`)

  // §3.2 — coverage, so a short-handed rota is legible rather than a mystery
  // slump in the numbers above.
  if (moduleState.coverage.length > 0) {
    lines.push('')
    lines.push('Role Coverage:')
    for (const row of moduleState.coverage) lines.push(`  ${row.readable}`)
    const gap = totalCoverageGap(moduleState.coverage)
    if (gap > 0) {
      lines.push(`  Total shortfall: ${gap}. The crew is carrying it.`)
    }
  }

  // §3.1 — what happened to people today.
  if (moduleState.development.length > 0) {
    lines.push('')
    lines.push('Development:')
    for (const entry of moduleState.development) lines.push(`  ${entry.readable}`)
  }
  if (moduleState.separations.length > 0) {
    lines.push('')
    lines.push('Departures:')
    for (const entry of moduleState.separations) lines.push(`  ${entry.readable}`)
  }

  // §3.4 item 1–3 — the warning, the contributors and the remedies. This is the
  // discoverability half of the quit-risk contract: a player who is told
  // somebody may leave is also told why, and what would stop it.
  const warnedQuitRisks = getWarnedScheduledEvents(ctx.state).filter(
    (event) => event.type === 'staff_quit_risk',
  )
  if (warnedQuitRisks.length > 0) {
    lines.push('')
    lines.push('AT RISK OF LEAVING:')
    for (const event of warnedQuitRisks) {
      const staffId = event.target?.id
      const member = staffId ? ctx.state.staff[staffId] : undefined
      if (!member || !staffId) continue
      const contributors = describeQuitRiskContributors(ctx.state, staffId)
      lines.push(
        `  ${member.name.display} — decides on day ${event.scheduledForDay} (risk ${quitRiskScore(contributors)})`,
      )
      for (const row of contributors) {
        lines.push(
          `    · ${row.label}${row.preventable && row.remedy ? ` → ${row.remedy}` : ' (nothing to be done)'}`,
        )
      }
    }
  }

  // §3.3 / §1.6 — announced-but-not-taken staff moves. The turn the player gets
  // to answer before an actor acts.
  const intents = listStaffIntents(ctx.state)
  if (intents.length > 0) {
    lines.push('')
    lines.push('Staff intentions:')
    for (const intent of intents) lines.push(`  ${intent.readable}`)
  }

  // §3.3 — the relationships that actually matter, and only those.
  const activeEdges = listEdges(ctx.state).filter(isActiveEdge)
  if (activeEdges.length > 0) {
    lines.push('')
    lines.push('Working relationships:')
    for (const edge of activeEdges) {
      const a =
        edge.kind === 'owner'
          ? 'You'
          : (ctx.state.staff[edge.from.id]?.name.display ?? edge.from.id)
      const b = ctx.state.staff[edge.to.id]?.name.display ?? edge.to.id
      lines.push(
        `  ${a} & ${b}: affinity ${edge.affinity}, trust ${edge.trust} (${edge.contacts} day(s) together)`,
      )
    }
  }

  // §3.1 — the board, so hiring is discoverable without opening an action.
  const applicants = moduleState.laborMarket.applicants
  if (applicants.length > 0) {
    lines.push('')
    lines.push('Looking for work:')
    for (const applicant of applicants) lines.push(`  ${applicant.readable}`)
  }
  if (moduleState.laborMarket.vacancies.length > 0) {
    lines.push(
      `  Open vacancies: ${moduleState.laborMarket.vacancies.map((v) => v.roleId).join(', ')}`,
    )
  }

  const settlement = moduleState.lastWageSettlement
  if (settlement) {
    lines.push('')
    lines.push(`Last wage settlement (day ${settlement.onDay}): ${settlement.readable}`)
    for (const record of listWageArrears(ctx.state)) {
      lines.push(`  Outstanding: ${record.readable} (${record.status})`)
    }
  }

  if (moduleState.rejectedAssignments.length > 0) {
    lines.push('')
    lines.push('Rejected priority assignments:')
    for (const r of moduleState.rejectedAssignments) {
      lines.push(`  ${r.staffId} ← ${r.priorityId} (${r.reason})`)
    }
  }

  return {
    id: 'staff',
    source: SOURCE,
    title: 'STAFF REPORT',
    lines,
    data: {
      appliedPriorities: { ...moduleState.appliedPriorities },
      rejectedAssignments: moduleState.rejectedAssignments.map((r) => ({ ...r })),
      priorityChanges: [...moduleState.priorityChanges],
      serviceQuality: {
        ...sq,
        staffSummaries: sq.staffSummaries.map((s) => ({ ...s })),
      },
      roster: moduleState.roster.map((row) => ({ ...row })),
      coverage: moduleState.coverage.map((row) => ({ ...row })),
      development: moduleState.development.map((row) => ({ ...row })),
      separations: moduleState.separations.map((row) => ({ ...row })),
      applicants: applicants.map((applicant) => ({
        id: applicant.id,
        roleId: applicant.roleId,
        skill: applicant.skill,
        wageAsk: applicant.wageAsk,
      })),
      vacancies: moduleState.laborMarket.vacancies.map((v) => ({ ...v })),
      totals: { ...moduleState.totals },
      ...(settlement ? { lastWageSettlement: settlement } : {}),
    },
  }
}

// ---------- Validation ----------

function validateStaff(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Expansion Phase 3 §3.1 — a role with declared demand and nobody on it is a
  // COVERAGE problem, not a structural one. It used to be a hard validation
  // error, which is why founding staff could never leave. The roster reports the
  // gap and service pays for it; validation's job here is only to catch state
  // that cannot be read.

  for (const staff of Object.values(ctx.state.staff)) {
    if (!staffRegistry.has(staff.role)) {
      issues.push({
        path: `staff.${staff.id}.role`,
        message: `Staff role '${staff.role}' is not in staffRegistry`,
        code: 'unknown_staff_role',
      })
      continue
    }
    if (staff.currentPriority !== undefined) {
      if (!staffPriorityRegistry.has(staff.currentPriority)) {
        issues.push({
          path: `staff.${staff.id}.currentPriority`,
          message: `Priority '${staff.currentPriority}' is not in staffPriorityRegistry`,
          code: 'unknown_staff_priority',
        })
      } else if (!isPriorityAllowedForRole(staff.role, staff.currentPriority)) {
        issues.push({
          path: `staff.${staff.id}.currentPriority`,
          message: `Priority '${staff.currentPriority}' is not allowed for role '${staff.role}'`,
          code: 'staff_priority_role_mismatch',
        })
      }
    }

    // Expansion Phase 3 §5.7 — the workforce fields are optional at the schema
    // level so a pre-Phase-3 save parses, and required on live state so a member
    // the migration missed is visible rather than silently shiftless.
    if (staff.shift === undefined || staff.careerGoal === undefined) {
      issues.push({
        path: `staff.${staff.id}.shift`,
        message: `Staff '${staff.id}' is missing the Phase 3 workforce fields`,
        code: 'missing_staff_workforce_fields',
      })
    }
    if (staff.assignedAreaId !== undefined && !(staff.assignedAreaId in ctx.state.areas)) {
      issues.push({
        path: `staff.${staff.id}.assignedAreaId`,
        message: `Staff '${staff.id}' is stationed in unknown area '${staff.assignedAreaId}'`,
        code: 'unknown_area_ref',
      })
    }
    for (const roleId of Object.keys(staff.crossTraining ?? {})) {
      if (!staffRegistry.has(roleId)) {
        issues.push({
          path: `staff.${staff.id}.crossTraining.${roleId}`,
          message: `Staff '${staff.id}' is cross-trained on unknown role '${roleId}'`,
          code: 'unknown_staff_role',
        })
      }
    }

    // Phase 31 §31.11 — required identity.
    const identity = staff.identity
    if (!identity) {
      issues.push({
        path: `staff.${staff.id}.identity`,
        message: `Staff '${staff.id}' is missing required identity`,
        code: 'missing_staff_identity',
      })
    } else {
      if (!namingProfileRegistry.has(identity.namingProfileId)) {
        issues.push({
          path: `staff.${staff.id}.identity.namingProfileId`,
          message: `Staff '${staff.id}' identity references unknown naming profile '${identity.namingProfileId}'`,
          code: 'unknown_naming_profile_ref',
        })
      }
      if (staff.name.profileId !== identity.namingProfileId) {
        issues.push({
          path: `staff.${staff.id}.name.profileId`,
          message: `Staff '${staff.id}' generated-name profileId does not match identity namingProfileId`,
          code: 'staff_identity_profile_mismatch',
        })
      }
      if (
        identity.cultureId !== undefined &&
        !(identity.cultureId in ctx.state.world.cultures)
      ) {
        issues.push({
          path: `staff.${staff.id}.identity.cultureId`,
          message: `Staff '${staff.id}' identity references unknown culture '${identity.cultureId}'`,
          code: 'unknown_culture_ref',
        })
      }
      if (staff.name.display.length === 0) {
        issues.push({
          path: `staff.${staff.id}.identity.name`,
          message: `Staff '${staff.id}' has empty display name`,
          code: 'empty_staff_identity_name',
        })
      }
    }
  }

  // Expansion Phase 3 §5.4 — every live employment record names a staff member
  // who is actually here, and every staff member has one. A record that outlives
  // its person is precisely the dangling pointer `separateStaff` exists to
  // prevent, so it is worth catching if some future path forgets.
  const slice = getStaffModuleState(ctx.state)
  for (const [staffId, record] of Object.entries(slice.employment)) {
    if (!ctx.state.staff[staffId]) {
      issues.push({
        path: `modules.staff.employment.${staffId}`,
        message: `Employment record for '${staffId}' outlived the staff member`,
        code: 'orphan_employment_record',
      })
    }
    if (record.staffId !== staffId) {
      issues.push({
        path: `modules.staff.employment.${staffId}.staffId`,
        message: `Employment record keyed '${staffId}' names '${record.staffId}'`,
        code: 'employment_record_key_mismatch',
      })
    }
  }
  for (const edge of slice.relationships) {
    for (const ref of [edge.from, edge.to]) {
      if (ref.kind !== 'staff') continue
      if (ctx.state.staff[ref.id]) continue
      issues.push({
        path: `modules.staff.relationships.${edge.id}`,
        message: `Relationship '${edge.id}' points at departed staff '${ref.id}'`,
        code: 'orphan_staff_relationship',
      })
    }
  }

  return issues
}

// Phase 31 §31.11 — `validateStaffIdentityProfileRegistration` lets tests check
// that an arbitrary `StaffIdentityProfile` resolves against the currently
// registered naming profiles.
export function validateStaffIdentityProfileRegistration(args: {
  staffId: string
  profileId: string
}): ValidationIssue[] {
  if (!staffIdentityProfileRegistry.has(args.profileId)) {
    return [
      {
        path: `staff.${args.staffId}.identity.profileId`,
        message: `Unknown staff identity profile '${args.profileId}'`,
        code: 'unknown_staff_identity_profile',
      },
    ]
  }
  const profile = staffIdentityProfileRegistry.get(args.profileId)
  if (!namingProfileRegistry.has(profile.namingProfileId)) {
    return [
      {
        path: `staff.${args.staffId}.identity.namingProfileId`,
        message: `Staff identity profile '${args.profileId}' references unknown naming profile '${profile.namingProfileId}'`,
        code: 'unknown_naming_profile_ref',
      },
    ]
  }
  return []
}

// ---------- Module schema ----------

const StaffEffectivenessSummarySchema = z.object({
  staffId: z.string(),
  roleId: z.string(),
  priorityId: z.string().optional(),
  effectiveness: z.number(),
  stressPenalty: z.number(),
  fatiguePenalty: z.number(),
  moraleBonus: z.number(),
  canWork: z.boolean(),
})

const ServiceQualityModifiersSchema = z.object({
  foodQualityModifier: z.number(),
  serviceSpeed: z.number(),
  tabControl: z.number(),
  messControl: z.number(),
  fightControl: z.number(),
  repairSupport: z.number(),
  staffSummaries: z.array(StaffEffectivenessSummarySchema),
})

/**
 * Expansion Phase 3 §5.7 — the Phase 11 fields stay required (they have been
 * written since day zero) and every workforce field is optional, so a
 * pre-Phase-3 slice parses and `ensureStaffWorkforceFields` repairs it rather
 * than the save bouncing as invalid.
 */
const StaffModuleStateSchema = z
  .object({
    appliedPriorities: z.record(z.string(), z.string()),
    rejectedAssignments: z.array(
      z.object({
        staffId: z.string(),
        priorityId: z.string(),
        reason: z.enum([
          'unknown_staff',
          'unknown_priority',
          'priority_not_allowed_for_role',
        ]),
      }),
    ),
    priorityChanges: z.array(z.string()).optional(),
    serviceQuality: ServiceQualityModifiersSchema,
  })
  .and(StaffWorkforceStateSchema)

export const staffModule: SimulationModule = {
  id: STAFF_MODULE_ID,
  version: '0.2.0',
  hooks: {
    startDay: [startDayHook],
    assignStaffPriorities: [assignPrioritiesHook],
    beforeService: [beforeServiceHook],
    afterService: [afterServiceHook],
    endDay: [endDayHook],
  },
  buildReport: buildStaffReport,
  validate: validateStaff,
  stateSchema: StaffModuleStateSchema,
}

export {
  canStaffWork,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffMoraleBonus,
  getStaffStressPenalty,
  staffRegistry,
  staffPriorityRegistry,
  derivePriorityModifiers,
  summarizeStaff,
}
export type { StaffWorkKind }
