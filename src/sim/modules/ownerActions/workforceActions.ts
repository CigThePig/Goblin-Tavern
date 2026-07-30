import type { SimContext } from '../../core/context'
import type { StaffShiftId, StaffState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { staffRegistry } from '../../registries/staffRegistry'
import { spendCoin } from '../stock/ledger'
import {
  cancelScheduledEvents,
  getLiveScheduledEvents,
} from '../../contracts/scheduledEvents/index'

import {
  getEmployment,
  getStaffModuleState,
} from '../staff/workforceState'
import {
  MAX_DISCIPLINE_ESCALATION,
  disciplineStaff,
  giveNotice,
  separateStaff,
  setStaffWage,
  severanceFor,
  withdrawNotice,
} from '../staff/employment'
import {
  checkPromotion,
  crossTrainableRoles,
  promoteStaff,
  trainStaff,
} from '../staff/development'
import { getApplicant, hireApplicant, listApplicants } from '../staff/laborMarket'
import { noteContact, ownerTrust } from '../staff/relationships'
import { setAbsence } from '../staff/roster'
import {
  listWageArrears,
  payDownArrears,
  totalWageArrears,
} from '../staff/staffWages'
import { clearStaffIntent } from '../staff/staffActors'
import {
  STAFF_QUIT_RISK_EVENT,
  STAFF_RAISE_DEMAND_EVENT,
  describeQuitRiskContributors,
  quitRiskScore,
} from '../staff/staffEvents'

import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
  TIME_COST_STANDARD,
  TIME_COST_HEAVY,
} from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 3 §"Player-facing work" — the workforce capabilities.
//
// WHAT THE PLAYER COULD DO BEFORE THIS PHASE: hire a role, fire a non-founding
// hire, and set twelve daily priorities. That is the whole surface. Everything
// §3 asks for — shifts, stations, training, promotion, wage negotiation,
// discipline, leave, notice, keeping somebody who is about to walk, and paying
// what is owed — had no action behind it, which is the §5 "a player cannot
// discover what action is available and why" failure applied to an entire
// domain.
//
// ELEVEN ACTIONS, and each one is the counterplay to something the simulation
// now does on its own:
//
//   hire_staff             ← a vacancy, from a separation or role demand
//   set_staff_shift        ← fatigue, and coverage that needs spreading
//   assign_staff_area      ← a station away from where the work is
//   train_staff            ← a skill ceiling, or a role nobody can cover
//   promote_staff          ← somebody at their ceiling with nowhere to go
//   adjust_staff_wage      ← a raise demand with a deadline
//   pay_staff_wages        ← arrears the weekly settlement could not cover
//   grant_staff_leave      ← exhaustion, before it becomes an absence
//   discipline_staff       ← an unexcused absence, or a repeated problem
//   give_staff_notice      ← a dismissal the player wants done properly
//   negotiate_with_staff   ← a quit risk, a resignation, or a raise demand
//
// NOTHING HERE WRITES STAFF STATE DIRECTLY. Every apply asks the staff domain to
// make the transition (§5.4) — `employment.ts` for terms and separation,
// `development.ts` for skill and rank, `laborMarket.ts` for hiring,
// `staffWages.ts` for money, `roster.ts` for absence. The action is the player's
// request; the domain is the authority.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}

/** `"<staffId>:<suffix>"` → its parts. Used by the composite-target actions. */
export function parseStaffTarget(
  targetId: string | undefined,
): { staffId: string; suffix: string } | undefined {
  if (!targetId) return undefined
  const split = targetId.indexOf(':')
  if (split <= 0) return undefined
  const staffId = targetId.slice(0, split)
  const suffix = targetId.slice(split + 1)
  if (!staffId || !suffix) return undefined
  return { staffId, suffix }
}

function livePlainTargets(ctx: SimContext): StaffState[] {
  return [...Object.values(ctx.state.staff)].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
}

// ---------------------------------------------------------------------------
// hire_staff — from the applicant board
// ---------------------------------------------------------------------------

export const HIRE_STAFF_ACTION_ID = 'hire_staff'

/**
 * The placement fee, paid on top of the agreed wage.
 *
 * Unchanged from Phase 86 so the cost of bringing somebody in has not moved;
 * what changed is that the player now picks a PERSON at a negotiated wage rather
 * than a role at the registry default.
 */
export const HIRE_STAFF_COST = 40

const hireStaffAction: OwnerActionDefinition = {
  id: HIRE_STAFF_ACTION_ID,
  label: 'Hire Staff',
  category: 'immediate',
  tags: ['staff', 'hire'],
  effectsPreview: 'Takes somebody off the board and onto the payroll',
  pressureAffinity: ['staff_burnout'],
  targetType: 'staff',
  // Interviewing and settling somebody in eats most of the day.
  timeCost: TIME_COST_HEAVY,
  getValidTargets: (ctx) =>
    listApplicants(ctx.state).map((applicant) => ({
      id: applicant.id,
      label: applicant.name.display,
      hint: `${roleLabel(applicant.roleId)}, skill ${applicant.skill}, wants ${applicant.wageAsk}/wk${applicant.answersVacancyForRole ? ' — answering your vacancy' : ''}`,
    })),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject(
        'missing_target',
        'hire_staff requires targetId (an applicant id from the board)',
      )
    }
    const applicant = getApplicant(ctx.state, input.targetId)
    if (!applicant) {
      // A specific reason rather than "unknown target": an applicant who has
      // taken work elsewhere is the common case, and it is a fact about the
      // world the player should be told.
      return reject(
        'applicant_unavailable',
        `No applicant '${input.targetId}' is on the board — they may have taken work elsewhere.`,
      )
    }
    // `amount` is the wage the player is offering. Below the ask is allowed and
    // costs loyalty; below 1 is not a wage.
    const offer = input.amount
    if (offer !== undefined && (!Number.isFinite(offer) || offer < 1)) {
      return reject('bad_offer', 'A wage offer must be at least 1 coin a week.')
    }
    if (ctx.state.coin < HIRE_STAFF_COST) {
      return reject(
        'insufficient_coin',
        `Hiring costs ${HIRE_STAFF_COST} coin; have ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const applicantId = input.targetId!
    const applicant = getApplicant(ctx.state, applicantId)!
    spendCoin(ctx, HIRE_STAFF_COST, {
      source: `ownerActions.${HIRE_STAFF_ACTION_ID}`,
      category: 'wage',
      tags: ['staff', 'hire', applicant.roleId],
    })
    const hired = hireApplicant(ctx, applicantId, {
      ...(input.amount !== undefined ? { wageOffer: input.amount } : {}),
      source: `ownerActions.${HIRE_STAFF_ACTION_ID}`,
    })!
    return {
      actionId: HIRE_STAFF_ACTION_ID,
      label: 'Hired Staff',
      targetId: hired.staffId,
      targetLabel: hired.staffName,
      timeCost: TIME_COST_HEAVY,
      effects: [
        `Hired ${hired.staffName} as ${roleLabel(hired.roleId)} at ${hired.weeklyWage}/wk.`,
        `coin -${HIRE_STAFF_COST}`,
      ],
      data: {
        staffId: hired.staffId,
        roleId: hired.roleId,
        weeklyWage: hired.weeklyWage,
        wageAsk: applicant.wageAsk,
        skill: hired.skill,
        coin: { spent: HIRE_STAFF_COST },
      },
    }
  },
}

// ---------------------------------------------------------------------------
// set_staff_shift
// ---------------------------------------------------------------------------

export const SET_STAFF_SHIFT_ACTION_ID = 'set_staff_shift'

const SHIFT_LABELS: Record<StaffShiftId, string> = {
  early: 'Early shift',
  late: 'Late shift',
  double: 'Double (overtime)',
  rest: 'Rest day',
}

const SHIFT_HINTS: Record<StaffShiftId, string> = {
  early: 'covers the day from opening',
  late: 'covers the day to closing — spread the crew to cover more hours',
  double: 'more hours from one body, at an overtime cost in fatigue and stress',
  rest: 'no cover from them, double recovery',
}

const setStaffShiftAction: OwnerActionDefinition = {
  id: SET_STAFF_SHIFT_ACTION_ID,
  label: 'Set Staff Shift',
  category: 'immediate',
  tags: ['staff', 'rota'],
  effectsPreview: 'Moves someone onto a different shift, or gives them the day',
  pressureAffinity: ['staff_burnout'],
  targetType: 'staff',
  // A rota change is a word and a chalkboard.
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) => {
    const out: ActionTarget[] = []
    for (const member of livePlainTargets(ctx)) {
      for (const shift of ['early', 'late', 'double', 'rest'] as StaffShiftId[]) {
        if (member.shift === shift) continue
        out.push({
          id: `${member.id}:${shift}`,
          label: `${member.name.display} → ${SHIFT_LABELS[shift]}`,
          hint: `${SHIFT_HINTS[shift]} (fatigue ${member.fatigue}, ${member.consecutiveDaysWorked ?? 0} day(s) straight)`,
        })
      }
    }
    return out
  },
  canApply: (ctx, input) => {
    const parsed = parseStaffTarget(input.targetId)
    if (!parsed) {
      return reject(
        'missing_target',
        'set_staff_shift requires targetId "<staffId>:<shift>"',
      )
    }
    if (!ctx.state.staff[parsed.staffId]) {
      return reject('unknown_target', `Unknown staff '${parsed.staffId}'`)
    }
    if (!['early', 'late', 'double', 'rest'].includes(parsed.suffix)) {
      return reject('unknown_shift', `Unknown shift '${parsed.suffix}'`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const { staffId, suffix } = parseStaffTarget(input.targetId)!
    const member = ctx.state.staff[staffId]!
    const shift = suffix as StaffShiftId
    const before = member.shift ?? 'early'
    ctx.modifyStaff(
      staffId,
      { shift },
      {
        source: `ownerActions.${SET_STAFF_SHIFT_ACTION_ID}`,
        sourceType: 'owner_action',
        target: `staff:${staffId}.shift`,
        targetType: 'staff',
        amount: 1,
        readable: `${member.name.display} moved to the ${SHIFT_LABELS[shift].toLowerCase()}.`,
        tags: ['staff', 'rota', 'shift', staffId, shift],
        relatedActors: [{ kind: 'staff', id: staffId }],
        relatedSystems: ['staff'],
      },
    )
    // A rest day the owner granted is a kindness they notice; a double is not.
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: shift === 'rest' ? 4 : shift === 'double' ? -3 : 0,
      trustDelta: shift === 'rest' ? 3 : shift === 'double' ? -2 : 0,
      reason: `put them on the ${shift} shift`,
      tags: ['rota', shift],
    })
    return {
      actionId: SET_STAFF_SHIFT_ACTION_ID,
      label: 'Set Staff Shift',
      targetId: input.targetId!,
      targetLabel: member.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [`${member.name.display}: ${before} → ${shift}.`],
      data: { staffId, shift: { before, after: shift } },
    }
  },
}

// ---------------------------------------------------------------------------
// assign_staff_area
// ---------------------------------------------------------------------------

export const ASSIGN_STAFF_AREA_ACTION_ID = 'assign_staff_area'

const assignStaffAreaAction: OwnerActionDefinition = {
  id: ASSIGN_STAFF_AREA_ACTION_ID,
  label: 'Station Staff',
  category: 'immediate',
  tags: ['staff', 'rota', 'area'],
  effectsPreview: 'Puts someone on a particular part of the house',
  targetType: 'staff',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) => {
    const out: ActionTarget[] = []
    for (const member of livePlainTargets(ctx)) {
      for (const area of Object.values(ctx.state.areas)) {
        if (member.assignedAreaId === area.id) continue
        out.push({
          id: `${member.id}:${area.id}`,
          label: `${member.name.display} → ${area.label}`,
          hint: `condition ${area.condition}, mess ${area.mess}`,
        })
      }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  },
  canApply: (ctx, input) => {
    const parsed = parseStaffTarget(input.targetId)
    if (!parsed) {
      return reject(
        'missing_target',
        'assign_staff_area requires targetId "<staffId>:<areaId>"',
      )
    }
    if (!ctx.state.staff[parsed.staffId]) {
      return reject('unknown_target', `Unknown staff '${parsed.staffId}'`)
    }
    if (!ctx.state.areas[parsed.suffix]) {
      return reject('unknown_area', `Unknown area '${parsed.suffix}'`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const { staffId, suffix: areaId } = parseStaffTarget(input.targetId)!
    const member = ctx.state.staff[staffId]!
    const area = ctx.state.areas[areaId]!
    const before = member.assignedAreaId
    ctx.modifyStaff(
      staffId,
      { assignedAreaId: areaId },
      {
        source: `ownerActions.${ASSIGN_STAFF_AREA_ACTION_ID}`,
        sourceType: 'owner_action',
        target: `staff:${staffId}.assignedAreaId`,
        targetType: 'staff',
        amount: 1,
        readable: `${member.name.display} stationed in ${area.label}.`,
        tags: ['staff', 'rota', 'station', staffId, areaId],
        relatedActors: [{ kind: 'staff', id: staffId }],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['staff', 'areas'],
      },
    )
    return {
      actionId: ASSIGN_STAFF_AREA_ACTION_ID,
      label: 'Stationed Staff',
      targetId: input.targetId!,
      targetLabel: member.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [
        `${member.name.display}: ${before ?? 'wherever the work was'} → ${area.label}.`,
      ],
      data: { staffId, areaId: { before: before ?? null, after: areaId } },
    }
  },
}

// ---------------------------------------------------------------------------
// train_staff
// ---------------------------------------------------------------------------

export const TRAIN_STAFF_ACTION_ID = 'train_staff'
export const TRAIN_STAFF_COST = 12

const trainStaffAction: OwnerActionDefinition = {
  id: TRAIN_STAFF_ACTION_ID,
  label: 'Train Staff',
  category: 'immediate',
  tags: ['staff', 'development'],
  effectsPreview: 'Teaches someone their trade, or a second one',
  targetType: 'staff',
  // Hands-on teaching. A colleague helping makes it worth more, not shorter.
  timeCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) => {
    const out: ActionTarget[] = []
    for (const member of livePlainTargets(ctx)) {
      if (member.absence) continue
      out.push({
        id: member.id,
        label: `${member.name.display} — own trade`,
        hint: `skill ${member.skill}, experience ${member.experience ?? 0}/100`,
      })
      for (const roleId of crossTrainableRoles(member)) {
        out.push({
          id: `${member.id}:${roleId}`,
          label: `${member.name.display} — cover ${roleLabel(roleId)}`,
          hint: `cross-training ${member.crossTraining?.[roleId] ?? 0}/100; 60 is enough to stand in`,
        })
      }
    }
    return out
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject(
        'missing_target',
        'train_staff requires targetId ("<staffId>" or "<staffId>:<roleId>")',
      )
    }
    const parsed = parseStaffTarget(input.targetId)
    const staffId = parsed?.staffId ?? input.targetId
    const member = ctx.state.staff[staffId]
    if (!member) return reject('unknown_target', `Unknown staff '${staffId}'`)
    if (member.absence) {
      return reject(
        'staff_absent',
        `${member.name.display} is not in (${member.absence.kind}).`,
      )
    }
    if (parsed) {
      if (!staffRegistry.has(parsed.suffix)) {
        return reject('unknown_role', `Unknown role '${parsed.suffix}'`)
      }
      if (parsed.suffix === member.role) {
        return reject(
          'own_role',
          `${member.name.display} already works as a ${roleLabel(parsed.suffix)} — train their own trade instead.`,
        )
      }
      if (!crossTrainableRoles(member).includes(parsed.suffix)) {
        return reject(
          'cross_training_full',
          `${member.name.display} already carries as many second trades as they can.`,
        )
      }
    }
    if (ctx.state.coin < TRAIN_STAFF_COST) {
      return reject(
        'insufficient_coin',
        `Training costs ${TRAIN_STAFF_COST} coin; have ${ctx.state.coin}.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const parsed = parseStaffTarget(input.targetId)
    const staffId = parsed?.staffId ?? input.targetId!
    const member = ctx.state.staff[staffId]!
    spendCoin(ctx, TRAIN_STAFF_COST, {
      source: `ownerActions.${TRAIN_STAFF_ACTION_ID}`,
      category: 'wage',
      tags: ['staff', 'training', staffId],
    })
    const result = trainStaff(ctx, staffId, {
      ...(parsed ? { crossTrainRoleId: parsed.suffix } : {}),
      source: `ownerActions.${TRAIN_STAFF_ACTION_ID}`,
    })!
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: 6,
      trustDelta: 5,
      reason: 'spent a day teaching them',
      tags: ['training'],
    })
    // The request, if there was one, has now been answered.
    ctx.removeMemory(`staff_asked_for_training_${staffId}`)
    return {
      actionId: TRAIN_STAFF_ACTION_ID,
      label: 'Trained Staff',
      targetId: input.targetId!,
      targetLabel: member.name.display,
      timeCost: TIME_COST_STANDARD,
      effects: [result.readable, `coin -${TRAIN_STAFF_COST}`],
      data: {
        staffId,
        ...(result.helperStaffId !== undefined
          ? { helperStaffId: result.helperStaffId }
          : {}),
        experienceGained: result.experienceGained,
        skillGained: result.skillGained,
        ...(result.crossTrainedRole !== undefined
          ? {
              crossTrainedRole: result.crossTrainedRole,
              crossTrainingLevel: result.crossTrainingLevel,
            }
          : {}),
        coin: { spent: TRAIN_STAFF_COST },
      },
    }
  },
}

// ---------------------------------------------------------------------------
// promote_staff
// ---------------------------------------------------------------------------

export const PROMOTE_STAFF_ACTION_ID = 'promote_staff'

const promoteStaffAction: OwnerActionDefinition = {
  id: PROMOTE_STAFF_ACTION_ID,
  label: 'Promote Staff',
  category: 'immediate',
  tags: ['staff', 'development'],
  effectsPreview: 'Moves someone up a rung — and onto a higher wage',
  targetType: 'staff',
  timeCost: TIME_COST_SHORT,
  // Everybody eligible is listed, and everybody who is NOT eligible is listed
  // with the reason: "why can I not promote them" is exactly the question the
  // §5 discoverability rule is about.
  getValidTargets: (ctx) =>
    livePlainTargets(ctx)
      .map((member) => {
        const verdict = checkPromotion(ctx.state, member.id)
        return {
          id: member.id,
          label: member.name.display,
          hint: verdict.ok
            ? `→ ${roleLabel(verdict.targetRoleId)} at ${verdict.newWage}/wk`
            : verdict.reason,
        }
      })
      .filter((target) => target.hint.startsWith('→')),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'promote_staff requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    const verdict = checkPromotion(ctx.state, input.targetId)
    if (!verdict.ok) return reject('not_eligible', verdict.reason)
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const name = member.name.display
    const result = promoteStaff(
      ctx,
      staffId,
      `ownerActions.${PROMOTE_STAFF_ACTION_ID}`,
    )!
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: 12,
      trustDelta: 12,
      contacts: 2,
      reason: 'promoted them',
      tags: ['promotion'],
    })
    // A promotion answers the RAISE DEMAND outright — they asked for more money
    // and got a better job at a better wage.
    //
    // It does NOT cancel a live quit risk. That risk may be about unpaid back
    // pay, exhaustion or a discipline record, none of which a new title fixes,
    // and cancelling it here would let a promotion do what `negotiate_with_staff`
    // is deliberately forbidden from doing: erase an imminent resignation with a
    // material grievance still outstanding. The promotion's real loyalty and
    // morale gains lower the risk score on their own, so the resolver re-reads
    // live contributors when the day comes and stands the person down if the
    // promotion genuinely was the answer.
    cancelScheduledEvents(
      ctx,
      (event) =>
        event.type === STAFF_RAISE_DEMAND_EVENT &&
        event.target?.kind === 'staff' &&
        event.target.id === staffId,
      `${name} was promoted`,
    )
    return {
      actionId: PROMOTE_STAFF_ACTION_ID,
      label: 'Promoted Staff',
      targetId: staffId,
      targetLabel: name,
      timeCost: TIME_COST_SHORT,
      effects: [result.readable],
      data: {
        staffId,
        fromRoleId: result.fromRoleId,
        toRoleId: result.toRoleId,
        wage: result.wage,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// adjust_staff_wage
// ---------------------------------------------------------------------------

export const ADJUST_STAFF_WAGE_ACTION_ID = 'adjust_staff_wage'

/** The rise offered when the player does not name an amount. */
const DEFAULT_RAISE = 2

const adjustStaffWageAction: OwnerActionDefinition = {
  id: ADJUST_STAFF_WAGE_ACTION_ID,
  label: 'Adjust Staff Wage',
  category: 'immediate',
  tags: ['staff', 'wages'],
  effectsPreview: 'Changes what someone is paid — up, or down',
  pressureAffinity: ['staff_loyalty_risk'],
  targetType: 'staff',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    livePlainTargets(ctx).map((member) => {
      const asked = askedWageFor(ctx, member.id)
      return {
        id: member.id,
        label: member.name.display,
        hint: asked
          ? `on ${member.wage}/wk, has asked for ${asked}/wk`
          : `on ${member.wage}/wk, loyalty ${member.loyalty}`,
      }
    }),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'adjust_staff_wage requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    const next = resolveWageTarget(ctx, member, input.amount)
    if (next < 1) {
      return reject('bad_amount', 'A wage cannot be less than 1 coin a week.')
    }
    if (next === member.wage) {
      return reject(
        'no_change',
        `${member.name.display} is already on ${member.wage}/wk.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const next = resolveWageTarget(ctx, member, input.amount)
    const isRaise = next > member.wage
    const asked = askedWageFor(ctx, staffId)
    const result = setStaffWage(ctx, staffId, next, {
      kind: isRaise ? 'raise' : 'wage_cut',
      reason: isRaise ? 'the owner raised it' : 'the owner cut it',
    })!
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: isRaise ? 8 : -12,
      trustDelta: isRaise ? 10 : -14,
      reason: isRaise ? 'raised their wage' : 'cut their wage',
      tags: ['wages', isRaise ? 'raise' : 'cut'],
    })
    // A rise that meets the ask answers the request outright; the demand event
    // would otherwise fire and punish a request that was granted.
    if (isRaise && asked !== undefined && next >= asked) {
      cancelScheduledEvents(
        ctx,
        (event) =>
          event.type === STAFF_RAISE_DEMAND_EVENT &&
          event.target?.kind === 'staff' &&
          event.target.id === staffId,
        `${member.name.display}'s rise was granted`,
      )
      ctx.removeMemory(`staff_raise_refused_${staffId}`)
    }
    return {
      actionId: ADJUST_STAFF_WAGE_ACTION_ID,
      label: isRaise ? 'Raised Staff Wage' : 'Cut Staff Wage',
      targetId: staffId,
      targetLabel: member.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [
        `${member.name.display}: ${result.before}/wk → ${result.after}/wk.`,
        ...(asked !== undefined
          ? [
              next >= asked
                ? `Meets the ${asked}/wk they asked for.`
                : `Still short of the ${asked}/wk they asked for.`,
            ]
          : []),
      ],
      data: { staffId, wage: result, ...(asked !== undefined ? { asked } : {}) },
    }
  },
}

/**
 * The wage the player is moving to.
 *
 * `amount` is an absolute weekly wage when given (which is what the raise-demand
 * hint quotes, so accepting an ask is one number); with no amount it is a modest
 * default rise, so the action is usable without arithmetic.
 */
function resolveWageTarget(
  ctx: SimContext,
  member: StaffState,
  amount: number | undefined,
): number {
  if (amount === undefined) {
    const asked = askedWageFor(ctx, member.id)
    return asked ?? member.wage + DEFAULT_RAISE
  }
  return Math.round(amount)
}

/** The wage this member has actually asked for, if a demand is live. */
function askedWageFor(ctx: SimContext, staffId: string): number | undefined {
  const live = getLiveScheduledEvents(ctx.state).find(
    (event) =>
      event.type === STAFF_RAISE_DEMAND_EVENT &&
      event.target?.kind === 'staff' &&
      event.target.id === staffId,
  )
  const payload = live?.payload as { askedWage?: number } | undefined
  return typeof payload?.askedWage === 'number' ? payload.askedWage : undefined
}

// ---------------------------------------------------------------------------
// pay_staff_wages
// ---------------------------------------------------------------------------

export const PAY_STAFF_WAGES_ACTION_ID = 'pay_staff_wages'

/**
 * The counterplay for arrears, and the first owner action to settle an
 * obligation.
 *
 * Phase 1 recorded that no action could pay an obligation, and that the gap
 * belonged to whichever phase gave the player something worth paying. Wage
 * arrears are that: opened by the weekly settlement, named per person, read by
 * the quit-risk resolver as a preventable contributor.
 */
const payStaffWagesAction: OwnerActionDefinition = {
  id: PAY_STAFF_WAGES_ACTION_ID,
  label: 'Pay Staff Wages',
  category: 'immediate',
  tags: ['staff', 'wages', 'debt'],
  effectsPreview: 'Settles back pay you owe the crew',
  pressureAffinity: ['staff_loyalty_risk'],
  targetType: 'staff',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) => {
    const out: ActionTarget[] = []
    const all = totalWageArrears(ctx.state)
    if (all > 0) {
      out.push({
        id: 'all',
        label: 'Everybody owed',
        hint: `${all} coin outstanding across the crew`,
      })
    }
    for (const member of livePlainTargets(ctx)) {
      const owed = totalWageArrears(ctx.state, member.id)
      if (owed <= 0) continue
      out.push({
        id: member.id,
        label: member.name.display,
        hint: `${owed} coin in back pay`,
      })
    }
    return out
  },
  canApply: (ctx, input) => {
    const targetId = input.targetId ?? 'all'
    if (targetId !== 'all' && !ctx.state.staff[targetId]) {
      return reject('unknown_target', `Unknown staff '${targetId}'`)
    }
    const owed =
      targetId === 'all'
        ? totalWageArrears(ctx.state)
        : totalWageArrears(ctx.state, targetId)
    if (owed <= 0) {
      return reject(
        'nothing_owed',
        targetId === 'all'
          ? 'No back pay is outstanding.'
          : `Nothing is owed to '${targetId}'.`,
      )
    }
    if (ctx.state.coin <= 0) {
      return reject('insufficient_coin', 'The till is empty.')
    }
    return OK
  },
  apply: (ctx, input) => {
    const targetId = input.targetId ?? 'all'
    const owedBefore =
      targetId === 'all'
        ? totalWageArrears(ctx.state)
        : totalWageArrears(ctx.state, targetId)
    // Partial payment is the normal case: spend what the player asked for, or
    // whatever the till holds.
    const budget = Math.min(
      ctx.state.coin,
      input.amount !== undefined ? Math.max(0, Math.round(input.amount)) : owedBefore,
    )
    const paid = payDownArrears(ctx, budget, 'owner paid back wages', {
      spend: true,
      ...(targetId !== 'all' ? { staffId: targetId } : {}),
    })
    if (targetId !== 'all') {
      noteContact(ctx, {
        aStaffId: targetId,
        withOwner: true,
        affinityDelta: 8,
        trustDelta: 10,
        reason: 'paid what was owed',
        tags: ['wages', 'arrears'],
      })
    }
    const owedAfter =
      targetId === 'all'
        ? totalWageArrears(ctx.state)
        : totalWageArrears(ctx.state, targetId)
    const label =
      targetId === 'all'
        ? 'the crew'
        : (ctx.state.staff[targetId]?.name.display ?? targetId)
    return {
      actionId: PAY_STAFF_WAGES_ACTION_ID,
      label: 'Paid Staff Wages',
      targetId,
      targetLabel: label,
      timeCost: TIME_COST_QUICK,
      effects: [
        `Paid ${paid} coin of back pay to ${label}.`,
        owedAfter > 0
          ? `${owedAfter} coin still outstanding.`
          : 'Nothing left outstanding.',
      ],
      data: {
        targetId,
        paid,
        outstanding: { before: owedBefore, after: owedAfter },
        records: listWageArrears(ctx.state).map((record) => record.id),
      },
    }
  },
}

// ---------------------------------------------------------------------------
// grant_staff_leave
// ---------------------------------------------------------------------------

export const GRANT_STAFF_LEAVE_ACTION_ID = 'grant_staff_leave'
export const DEFAULT_LEAVE_DAYS = 2

const grantStaffLeaveAction: OwnerActionDefinition = {
  id: GRANT_STAFF_LEAVE_ACTION_ID,
  label: 'Grant Staff Leave',
  category: 'immediate',
  tags: ['staff', 'rota'],
  effectsPreview: 'Gives someone real time off — at the cost of their cover',
  pressureAffinity: ['staff_burnout'],
  targetType: 'staff',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    livePlainTargets(ctx)
      .filter((member) => !member.absence)
      .map((member) => ({
        id: member.id,
        label: member.name.display,
        hint: `fatigue ${member.fatigue}, stress ${member.stress}, ${member.consecutiveDaysWorked ?? 0} day(s) straight`,
      })),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'grant_staff_leave requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    if (member.absence) {
      return reject(
        'already_absent',
        `${member.name.display} is already out (${member.absence.kind}).`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const days = Math.max(1, Math.round(input.amount ?? DEFAULT_LEAVE_DAYS))
    setAbsence(ctx, staffId, {
      kind: 'leave',
      days,
      reason: 'granted time off',
      source: `ownerActions.${GRANT_STAFF_LEAVE_ACTION_ID}`,
    })
    ctx.modifyStaff(
      staffId,
      { morale: clampPercent(member.morale + 6) },
      {
        source: `ownerActions.${GRANT_STAFF_LEAVE_ACTION_ID}`,
        sourceType: 'owner_action',
        target: `staff:${staffId}.morale`,
        targetType: 'staff',
        amount: 6,
        readable: `${member.name.display} was glad of the time off.`,
        tags: ['staff', 'leave', staffId],
        relatedActors: [{ kind: 'staff', id: staffId }],
        relatedSystems: ['staff'],
      },
    )
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: 8,
      trustDelta: 6,
      reason: 'gave them time off',
      tags: ['leave'],
    })
    return {
      actionId: GRANT_STAFF_LEAVE_ACTION_ID,
      label: 'Granted Staff Leave',
      targetId: staffId,
      targetLabel: member.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [
        `${member.name.display} is off for ${days} day(s).`,
        'Their role is uncovered while they are away.',
      ],
      data: { staffId, days },
    }
  },
}

// ---------------------------------------------------------------------------
// discipline_staff
// ---------------------------------------------------------------------------

export const DISCIPLINE_STAFF_ACTION_ID = 'discipline_staff'

const disciplineStaffAction: OwnerActionDefinition = {
  id: DISCIPLINE_STAFF_ACTION_ID,
  label: 'Discipline Staff',
  category: 'immediate',
  tags: ['staff', 'discipline'],
  effectsPreview: 'A formal warning — on the record',
  pressureAffinity: ['staff_loyalty_risk'],
  targetType: 'staff',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    livePlainTargets(ctx).map((member) => {
      const record = getEmployment(ctx.state, member.id)
      return {
        id: member.id,
        label: member.name.display,
        hint: `warning ${(record?.escalation ?? 0) + 1} of ${MAX_DISCIPLINE_ESCALATION}${member.absence?.kind === 'unexcused' ? ' — did not come in' : ''}`,
      }
    }),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'discipline_staff requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    const record = getEmployment(ctx.state, input.targetId)
    if ((record?.escalation ?? 0) >= MAX_DISCIPLINE_ESCALATION) {
      return reject(
        'already_final',
        `${member.name.display} is already on a final warning — dismissal is the next step.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const reason =
      typeof input.options?.['reason'] === 'string'
        ? (input.options['reason'] as string)
        : (member.absence?.kind === 'unexcused'
            ? 'did not come in'
            : 'conduct')
    const next = disciplineStaff(ctx, staffId, reason)!
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: -8,
      trustDelta: -5,
      reason: 'gave them a formal warning',
      tags: ['discipline'],
    })
    return {
      actionId: DISCIPLINE_STAFF_ACTION_ID,
      label: 'Disciplined Staff',
      targetId: staffId,
      targetLabel: member.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [
        `${member.name.display} received warning ${next.escalation} of ${MAX_DISCIPLINE_ESCALATION} (${reason}).`,
      ],
      data: { staffId, escalation: next.escalation, reason },
    }
  },
}

// ---------------------------------------------------------------------------
// give_staff_notice  /  fire_staff
// ---------------------------------------------------------------------------

export const GIVE_STAFF_NOTICE_ACTION_ID = 'give_staff_notice'
export const FIRE_STAFF_ACTION_ID = 'fire_staff'

const giveStaffNoticeAction: OwnerActionDefinition = {
  id: GIVE_STAFF_NOTICE_ACTION_ID,
  label: 'Give Staff Notice',
  category: 'immediate',
  tags: ['staff', 'fire', 'notice'],
  effectsPreview: 'Lets somebody go properly — they work out their notice',
  targetType: 'staff',
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) => {
    const today = ctx.state.calendar.totalDaysElapsed
    return livePlainTargets(ctx)
      .filter((member) => !getEmployment(ctx.state, member.id)?.notice)
      .map((member) => ({
        id: member.id,
        label: member.name.display,
        hint: `${roleLabel(member.role)}; works out ${severanceDays(ctx, member, today)} day(s), no severance owed`,
      }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'give_staff_notice requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    if (getEmployment(ctx.state, input.targetId)?.notice) {
      return reject(
        'already_on_notice',
        `${member.name.display} is already working out their notice.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const reason =
      typeof input.options?.['reason'] === 'string'
        ? (input.options['reason'] as string)
        : 'the owner let them go'
    const given = giveNotice(ctx, staffId, { givenBy: 'owner', reason })!
    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: -20,
      trustDelta: -15,
      reason: 'gave them notice',
      tags: ['notice'],
    })
    return {
      actionId: GIVE_STAFF_NOTICE_ACTION_ID,
      label: 'Gave Staff Notice',
      targetId: staffId,
      targetLabel: member.name.display,
      timeCost: TIME_COST_SHORT,
      effects: [
        `${member.name.display} leaves on day ${given.separationDay}.`,
        'They are off the floor while the notice runs — their role is uncovered.',
      ],
      data: {
        staffId,
        separationDay: given.separationDay,
        roleId: member.role,
        reason,
      },
    }
  },
}

/**
 * Dismissal on the spot.
 *
 * Kept as its own action rather than folded into notice, because the two are a
 * real choice: notice costs coverage while it runs and no coin, dismissal costs
 * coin now (severance in lieu of the notice they did not work) and buys the
 * player the body out of the building today. The founding-staff exemption is
 * GONE — that immunity is exactly what plan §3.1 requires removing.
 */
const fireStaffAction: OwnerActionDefinition = {
  id: FIRE_STAFF_ACTION_ID,
  label: 'Fire Staff',
  category: 'immediate',
  tags: ['staff', 'fire'],
  effectsPreview: 'Lets a staffer go today, with severance in lieu of notice',
  targetType: 'staff',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) => {
    const today = ctx.state.calendar.totalDaysElapsed
    return livePlainTargets(ctx).map((member) => ({
      id: member.id,
      label: member.name.display,
      hint: `${roleLabel(member.role)}, morale ${member.morale}; severance ${severanceFor(member, getEmployment(ctx.state, member.id), today)} coin`,
    }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'fire_staff requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    const today = ctx.state.calendar.totalDaysElapsed
    const owed = severanceFor(member, getEmployment(ctx.state, input.targetId), today)
    if (owed > ctx.state.coin) {
      // A specific, actionable reason. `give_staff_notice` is the free route,
      // and the hint says so — a rejection that leaves the player stuck is the
      // discoverability failure §5 rules out.
      return reject(
        'insufficient_severance',
        `Dismissing ${member.name.display} today owes ${owed} coin in severance; have ${ctx.state.coin}. Give them notice instead.`,
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const today = ctx.state.calendar.totalDaysElapsed
    const name = member.name.display
    const owed = severanceFor(member, getEmployment(ctx.state, staffId), today)
    const reason =
      typeof input.options?.['reason'] === 'string'
        ? (input.options['reason'] as string)
        : 'the owner dismissed them'
    const result = separateStaff(ctx, {
      staffId,
      kind: 'dismissed',
      reason,
      severance: owed,
      source: `ownerActions.${FIRE_STAFF_ACTION_ID}`,
    })!
    return {
      actionId: FIRE_STAFF_ACTION_ID,
      label: 'Fired Staff',
      targetId: staffId,
      targetLabel: name,
      timeCost: TIME_COST_STANDARD,
      effects: [
        `Fired ${name} (${roleLabel(result.roleId)}).`,
        `Severance paid: ${result.severancePaid} coin.`,
        `${roleLabel(result.roleId)} is now uncovered.`,
      ],
      data: {
        staffId,
        roleId: result.roleId,
        severancePaid: result.severancePaid,
        severanceUnpaid: result.severanceUnpaid,
        reason,
      },
    }
  },
}

function severanceDays(
  ctx: SimContext,
  member: StaffState,
  today: number,
): number {
  const record = getEmployment(ctx.state, member.id)
  if (!record) return 3
  return today - record.openedOnDay < 7 ? 1 : record.noticeDays
}

// ---------------------------------------------------------------------------
// negotiate_with_staff — the §3.4 counterplay
// ---------------------------------------------------------------------------

export const NEGOTIATE_WITH_STAFF_ACTION_ID = 'negotiate_with_staff'

/**
 * Grievances a conversation cannot settle.
 *
 * Named by contributor id rather than by weight, and that matters: weight would
 * also catch `low_loyalty`, which would block the action in exactly the
 * situation it exists for — somebody with no attachment left is who you most
 * need to talk round. These three are the ones that take COIN, not words:
 * outstanding back pay, an unpaid week, and a rise that was asked for and
 * refused.
 */
const MATERIAL_GRIEVANCE_IDS: ReadonlySet<string> = new Set([
  'wage_arrears',
  'unpaid_week',
  'raise_refused',
])

/**
 * Talk somebody round.
 *
 * This is §3.4 item 3 — "allow meaningful counterplay" — and the word MEANINGFUL
 * is doing work: it must not be a free undo. So it is gated on two things the
 * player earned or did not:
 *
 *   * your standing with them (`ownerTrust`), built by training, paying, and
 *     keeping promises — a stranger cannot talk anybody round;
 *   * whether the underlying grievances are actually being addressed
 *     (`describeQuitRiskContributors`) — telling somebody you value them while
 *     still owing them three weeks' wages does not work.
 *
 * When it lands it cancels the quit risk and withdraws a resignation already in
 * notice. When it does not, it says which contributor is still in the way.
 */
const negotiateWithStaffAction: OwnerActionDefinition = {
  id: NEGOTIATE_WITH_STAFF_ACTION_ID,
  label: 'Negotiate With Staff',
  category: 'social',
  tags: ['staff', 'social', 'retention'],
  effectsPreview: 'Tries to talk somebody into staying',
  pressureAffinity: ['staff_loyalty_risk'],
  targetType: 'staff',
  // A real conversation, not a word in passing.
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) =>
    livePlainTargets(ctx).map((member) => {
      const contributors = describeQuitRiskContributors(ctx.state, member.id)
      const score = quitRiskScore(contributors)
      const worst = contributors[0]
      return {
        id: member.id,
        label: member.name.display,
        hint:
          score > 0
            ? `risk ${score}, standing ${ownerTrust(ctx.state, member.id)}; worst: ${worst?.label ?? 'unclear'}`
            : `settled; standing ${ownerTrust(ctx.state, member.id)}`,
      }
    }),
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'negotiate_with_staff requires targetId')
    }
    const member = ctx.state.staff[input.targetId]
    if (!member) {
      return reject('unknown_target', `Unknown staff '${input.targetId}'`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const staffId = input.targetId!
    const member = ctx.state.staff[staffId]!
    const contributors = describeQuitRiskContributors(ctx.state, staffId)
    const score = quitRiskScore(contributors)
    const trust = ownerTrust(ctx.state, staffId)
    const record = getEmployment(ctx.state, staffId)

    // Two gates, and the second is the one that keeps the action honest.
    //
    //   * standing has to outweigh what is wrong — half the risk weight, so a
    //     player who has invested in somebody can carry a genuine grievance;
    //   * and no MATERIAL grievance may still be outstanding. Words do not settle
    //     back pay. Without this a stranger could talk their way out of three
    //     weeks of unpaid wages, because an unknown relationship starts at
    //     neutral trust rather than at nothing — which would make the counterplay
    //     a free undo and the derived Help a lie.
    const blocker = contributors.find((row) =>
      MATERIAL_GRIEVANCE_IDS.has(row.id),
    )
    const persuaded = blocker === undefined && trust >= score / 2
    const effects: string[] = []

    if (persuaded) {
      ctx.modifyStaff(
        staffId,
        {
          morale: clampPercent(member.morale + 10),
          loyalty: clampPercent(member.loyalty + 12),
          stress: clampPercent(member.stress - 6),
        },
        {
          source: `ownerActions.${NEGOTIATE_WITH_STAFF_ACTION_ID}`,
          sourceType: 'owner_action',
          target: `staff:${staffId}.loyalty`,
          targetType: 'staff',
          amount: 12,
          readable: `${member.name.display} was talked round.`,
          tags: ['staff', 'retention', 'negotiated', staffId],
          relatedActors: [{ kind: 'staff', id: staffId }],
          relatedSystems: ['staff'],
        },
      )
      // The memory the quit-risk resolver reads to cancel a promise that has not
      // fired yet. Written even when there is no live risk, because the resolver
      // only honours one created after the promise was made.
      ctx.addMemory({
        id: `staff_talked_round_${staffId}`,
        source: `ownerActions.${NEGOTIATE_WITH_STAFF_ACTION_ID}`,
        actors: [{ kind: 'staff', id: staffId }],
        tags: ['staff', 'retention', 'negotiated', staffId],
        durationDays: 14,
        metadata: { staffId, score, trust },
      })
      cancelScheduledEvents(
        ctx,
        (event) =>
          event.type === STAFF_QUIT_RISK_EVENT &&
          event.target?.kind === 'staff' &&
          event.target.id === staffId,
        `${member.name.display} was talked round`,
      )
      clearStaffIntent(ctx, staffId)
      effects.push(`${member.name.display} agreed to stay.`)

      // A resignation already in notice is withdrawn — the strongest form of the
      // counterplay, and the reason notice is a window rather than a countdown.
      if (record?.notice?.givenBy === 'staff') {
        withdrawNotice(ctx, staffId, 'talked round by the owner')
        effects.push('Their notice is withdrawn — they are back on the rota.')
      }
    } else {
      ctx.modifyStaff(
        staffId,
        { morale: clampPercent(member.morale + 3) },
        {
          source: `ownerActions.${NEGOTIATE_WITH_STAFF_ACTION_ID}`,
          sourceType: 'owner_action',
          target: `staff:${staffId}.morale`,
          targetType: 'staff',
          amount: 3,
          readable: `${member.name.display} heard you out, but nothing changed.`,
          tags: ['staff', 'retention', 'failed', staffId],
          relatedActors: [{ kind: 'staff', id: staffId }],
          relatedSystems: ['staff'],
        },
      )
      effects.push(`${member.name.display} was not persuaded.`)
      const worst = blocker ?? contributors[0]
      if (worst) {
        effects.push(
          worst.preventable && worst.remedy
            ? `${worst.label} ${worst.remedy}`
            : worst.label,
        )
      }
    }

    noteContact(ctx, {
      aStaffId: staffId,
      withOwner: true,
      affinityDelta: persuaded ? 10 : 2,
      trustDelta: persuaded ? 6 : 1,
      reason: 'sat down with them',
      tags: ['retention'],
    })

    return {
      actionId: NEGOTIATE_WITH_STAFF_ACTION_ID,
      label: 'Negotiated With Staff',
      targetId: staffId,
      targetLabel: member.name.display,
      timeCost: TIME_COST_SHORT,
      effects,
      data: {
        staffId,
        persuaded,
        riskScore: score,
        ownerTrust: trust,
        contributors: contributors.map((row) => ({
          id: row.id,
          weight: row.weight,
          preventable: row.preventable,
        })),
      },
    }
  },
}

// ---------------------------------------------------------------------------

export const WORKFORCE_ACTIONS: OwnerActionDefinition[] = [
  hireStaffAction,
  setStaffShiftAction,
  assignStaffAreaAction,
  trainStaffAction,
  promoteStaffAction,
  adjustStaffWageAction,
  payStaffWagesAction,
  grantStaffLeaveAction,
  disciplineStaffAction,
  giveStaffNoticeAction,
  fireStaffAction,
  negotiateWithStaffAction,
]

export {
  hireStaffAction,
  setStaffShiftAction,
  assignStaffAreaAction,
  trainStaffAction,
  promoteStaffAction,
  adjustStaffWageAction,
  payStaffWagesAction,
  grantStaffLeaveAction,
  disciplineStaffAction,
  giveStaffNoticeAction,
  fireStaffAction,
  negotiateWithStaffAction,
}
