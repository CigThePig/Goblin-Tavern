import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type {
  StaffPriorityId,
  StaffState,
} from '../../state/TavernState'

import {
  ensureRequiredStaffRolesRegistered,
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

import {
  canStaffWork,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffMoraleBonus,
  getStaffStressPenalty,
} from './performance'
import {
  derivePriorityModifiers,
  summarizeStaff,
} from './priorityEffects'
import type {
  ServiceQualityModifiers,
  StaffEffectivenessSummary,
  StaffModuleState,
} from './types'

// Phase 11 §11.2 — Staff module.
//
// Responsibilities:
//   - Ensure the three required staff (cook/server/cleaner_bouncer)
//     exist on the current state.
//   - Apply daily fatigue/stress drift on `startDay` (background
//     decay, intentionally modest — Phase 12 wires the service-driven
//     drift; this is the "always present" baseline).
//   - Resolve daily priority assignment during `assignStaffPriorities`,
//     filling in role defaults for any staff member the input omitted
//     and rejecting invalid assignments cleanly (Phase 11 §11.3).
//   - Derive the per-day `ServiceQualityModifiers` from staff
//     effectiveness + chosen priority during `beforeService`. Phase 12
//     will consume these — see the §11.5 boundary note.
//   - Build the staff report consumed during `generateReports`
//     (Phase 11 §11.6).
//   - Validate staff state and registry membership.

export const STAFF_MODULE_ID = 'staff'
const SOURCE = STAFF_MODULE_ID

const REQUIRED_STAFF_IDS = ['cook', 'server', 'cleaner_bouncer'] as const

const DAILY_STRESS_RECOVERY = 1
const DAILY_FATIGUE_RECOVERY = 2

export function createInitialStaffModuleState(): StaffModuleState {
  return {
    appliedPriorities: {},
    rejectedAssignments: [],
    serviceQuality: emptyServiceQuality(),
  }
}

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

export function getStaffModuleState(state: {
  modules: Record<string, unknown>
}): StaffModuleState {
  const slice = state.modules[STAFF_MODULE_ID] as StaffModuleState | undefined
  if (!slice) return createInitialStaffModuleState()
  return slice
}

function updateModuleState(
  ctx: SimContext,
  patch: Partial<StaffModuleState>,
  reason: string,
): void {
  ctx.modifyModuleState<StaffModuleState>(
    STAFF_MODULE_ID,
    (current) => {
      const base = current ?? createInitialStaffModuleState()
      return { ...base, ...patch }
    },
    { source: SOURCE, reason },
  )
}

// ---------- Hooks ----------

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ensureRequiredStaffRolesRegistered()
  ensureRequiredStaffPrioritiesRegistered()

  for (const id of REQUIRED_STAFF_IDS) {
    if (!ctx.state.staff[id]) {
      throw new Error(
        `staff module: required staff member '${id}' is missing from state`,
      )
    }
  }

  // Reset the per-day staff module slice. Priority application and
  // service-quality derivation will overwrite as the day progresses.
  ctx.modifyModuleState<StaffModuleState>(
    STAFF_MODULE_ID,
    () => createInitialStaffModuleState(),
    { source: SOURCE, reason: 'day_initialize' },
  )

  // Background passive recovery: a small bit of stress and fatigue
  // shed each morning. Service later in the day (Phase 12) will
  // push them back up. Phase 11 keeps the magnitude modest because
  // the service-driven movement is the headline signal.
  for (const staff of Object.values(ctx.state.staff)) {
    const nextStress = clampPercent(staff.stress - DAILY_STRESS_RECOVERY)
    const nextFatigue = clampPercent(staff.fatigue - DAILY_FATIGUE_RECOVERY)
    if (nextStress === staff.stress && nextFatigue === staff.fatigue) continue
    ctx.modifyStaff(
      staff.id,
      { stress: nextStress, fatigue: nextFatigue },
      { source: SOURCE, reason: 'daily_recovery' },
    )
  }
}

function readPriorityInput(
  ctx: SimContext,
): Record<string, StaffPriorityId> {
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
  for (const staff of Object.values(ctx.state.staff)) {
    const next = applied[staff.id]
    if (next === undefined) continue
    if (staff.currentPriority === next) continue
    ctx.modifyStaff(
      staff.id,
      { currentPriority: next },
      { source: SOURCE, reason: 'assign_priority' },
    )
  }

  updateModuleState(
    ctx,
    { appliedPriorities: applied, rejectedAssignments: rejected },
    'assign_priorities',
  )
}

const beforeServiceHook: SimulationHook = (ctx: SimContext): void => {
  // Phase 11 §11.5 — derive the service-quality modifiers Phase 12
  // will read. Writing them into the staff module slice (rather than
  // pushing changes into customer / area state directly) keeps the
  // responsibilities clean: staff publishes the signal; service math
  // consumes it.
  const serviceQuality = derivePriorityModifiers(
    Object.values(ctx.state.staff),
  )
  updateModuleState(ctx, { serviceQuality }, 'derive_service_quality')
}

// ---------- Reports ----------

function formatModifier(label: string, value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${label}: ${sign}${value.toFixed(1)}`
}

function describeStaffLine(
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
  const lines: string[] = []
  lines.push(`${staff.name.display} — ${roleLabel}`)
  lines.push(`  Priority: ${priorityLabel}`)
  // Phase 31 §31.10 — compact identity strip. The Phase 11 report
  // stayed structured/debuggable; identity adds work style, stress
  // response, and the leading personality tag without turning the
  // report into prose.
  if (staff.identity) {
    const id = staff.identity
    const personality =
      id.personalityTags.length > 0 ? id.personalityTags[0] : 'unflagged'
    lines.push(
      `  Identity: ${id.workStyle}, ${id.stressResponse}, ${personality} (${id.namingProfileId})`,
    )
  }
  lines.push(`  Skill: ${staff.skill}`)
  lines.push(`  Morale: ${staff.morale}`)
  lines.push(`  Stress: ${staff.stress}`)
  lines.push(`  Fatigue: ${staff.fatigue}`)
  lines.push(`  Loyalty: ${staff.loyalty}`)
  lines.push(`  Effectiveness: ${effectiveness}`)
  lines.push(`  Wage: ${staff.wage} (${staff.paidThisWeek ? 'paid' : 'unpaid'})`)
  if (summary && !summary.canWork) {
    lines.push(`  Notes: Unavailable today.`)
  }
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
    lines.push(...describeStaffLine(staff, summaries.get(staff.id)))
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
      serviceQuality: {
        ...sq,
        staffSummaries: sq.staffSummaries.map((s) => ({ ...s })),
      },
    },
  }
}

// ---------- Validation ----------

function validateStaff(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const id of REQUIRED_STAFF_IDS) {
    if (!ctx.state.staff[id]) {
      issues.push({
        path: `staff.${id}`,
        message: `Required staff member '${id}' is missing`,
        code: 'missing_required_staff',
      })
    }
  }

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

    // Phase 31 §31.11 — required identity. The schema keeps `identity`
    // optional during the migration window so older saves still parse;
    // the module-level validator surfaces missing identity as a
    // structural issue. Registry membership is enforced here too — a
    // reference to an unknown naming profile or identity profile is a
    // hard error, matching the §31.11 "invalid staff identity profile
    // reference fails validation" requirement.
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
          path: `staff.${staff.id}.name.display`,
          message: `Staff '${staff.id}' has empty display name`,
          code: 'empty_staff_identity_name',
        })
      }
    }
  }

  return issues
}

// Phase 31 §31.11 — `validateStaffIdentityProfileRegistration` lets
// tests check that an arbitrary `StaffIdentityProfile` resolves against
// the currently registered naming profiles. Used by the Phase 31 test
// "Invalid staff identity profile reference fails validation".
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

const StaffModuleStateSchema = z.object({
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
  serviceQuality: ServiceQualityModifiersSchema,
})

export const staffModule: SimulationModule = {
  id: STAFF_MODULE_ID,
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    assignStaffPriorities: [assignPrioritiesHook],
    beforeService: [beforeServiceHook],
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
