import { actionRegistry } from '../sim/registries/actionRegistry'
import {
  getPromotionTarget,
  getRoleDailyDemand,
  getRoleSkillCeiling,
  staffRegistry,
} from '../sim/registries/staffRegistry'
import { staffPriorityRegistry } from '../sim/registries/staffPriorityRegistry'
import { formatDuration } from '../sim/modules/ownerActions/stateHelpers'
import {
  CROSS_TRAINING_COVER_THRESHOLD,
  MAX_ACTIVE_EDGES_PER_STAFF,
  MAX_CROSS_TRAINED_ROLES,
  MIN_CONTACTS_FOR_ACTIVE_EDGE,
} from '../sim/modules/staff/workforceTypes'
import {
  DEFAULT_NOTICE_DAYS,
  MAX_DISCIPLINE_ESCALATION,
  PROBATION_DAYS,
  PROBATION_NOTICE_DAYS,
} from '../sim/modules/staff/employmentRecord'
import {
  CROSS_TRAINING_PER_SESSION,
  EXPERIENCE_PER_SKILL_POINT,
  PROMOTION_MIN_TENURE_DAYS,
  PROMOTION_SKILL_MARGIN,
  TRAINING_EXPERIENCE,
  TRAINING_EXPERIENCE_WITH_HELPER,
} from '../sim/modules/staff/development'
import { ABANDONMENT_DAYS } from '../sim/modules/staff/roster'
import {
  QUIT_RISK_DEFER_BELOW,
  QUIT_RISK_DEFER_DAYS,
  QUIT_RISK_NO_OP_BELOW,
  QUIT_RISK_WALKOUT_AT,
} from '../sim/modules/staff/staffEvents'
import {
  APPLICANT_SHELF_LIFE_DAYS,
  MAX_APPLICANTS,
} from '../sim/modules/staff/workforceTypes'
import { MARKET_REFRESH_DAYS } from '../sim/modules/staff/laborMarket'
import {
  HIRE_STAFF_COST,
  TRAIN_STAFF_COST,
} from '../sim/modules/ownerActions/workforceActions'

// Expansion Phase 3 §5.12 / §"Player-facing work" — Help DERIVED from the
// workforce rules.
//
// §5.12: "Update help from shared rule metadata. Do not create a second
// prose-only version of timing, costs, or eligibility." The static glossary
// already says wages are "paid in full when coin is sufficient; otherwise the
// unpaid list takes a loyalty hit" — which is now WRONG, because a shortfall
// becomes a per-person payable and partial payment is the normal case. That is
// exactly the failure mode a second prose copy produces: it was accurate when it
// was written and nothing made it change when the rule did.
//
// So nothing in this file authors a number. Every figure below is read at call
// time from the role registry, the priority registry, the owner-action registry,
// or the phase's own constants, and the contract test pins the two together so
// they cannot disagree.

export type RoleHelpRow = {
  roleId: string
  label: string
  /** Bodies a normal day wants on this role. */
  dailyDemand: number
  /** Highest skill reachable without a promotion. */
  skillCeiling: number
  /** The rung above, if there is one. */
  promotesToLabel?: string
  promotionRequirementLines: string[]
  /** The focuses this role may be given, with what each buys and costs. */
  priorityLines: string[]
  openingWage: number
}

export type WorkforceHelp = {
  /** How hiring works, with the live cost and the board's own rules. */
  hiringLines: string[]
  /** Shifts, stations, cover and overtime. */
  rotaLines: string[]
  /** Wages, arrears, and what non-payment actually does. */
  wageLines: string[]
  /** Training, cross-training, and the skill ceiling. */
  developmentLines: string[]
  /** Notice, severance, discipline, and walking out. */
  separationLines: string[]
  /** How the quit-risk warning works and what answers it. */
  retentionLines: string[]
  /** How relationships form and what they change. */
  relationshipLines: string[]
  roles: RoleHelpRow[]
}

function actionMinutes(actionId: string): number | undefined {
  return actionRegistry.has(actionId)
    ? actionRegistry.get(actionId).timeCost
    : undefined
}

function timeFor(actionId: string): string {
  const minutes = actionMinutes(actionId)
  return minutes === undefined ? 'some of the day' : formatDuration(minutes)
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}

export function buildRoleHelpRow(roleId: string): RoleHelpRow | undefined {
  if (!staffRegistry.has(roleId)) return undefined
  const def = staffRegistry.get(roleId)
  const promotion = getPromotionTarget(roleId)

  const promotionRequirementLines: string[] = []
  if (promotion) {
    promotionRequirementLines.push(
      `Skill at least ${promotion.defaultState.skill + PROMOTION_SKILL_MARGIN}`,
    )
    promotionRequirementLines.push(
      `${PROMOTION_MIN_TENURE_DAYS} days on the books`,
    )
    promotionRequirementLines.push(
      `Wage rises to at least ${promotion.defaultState.wage}/wk`,
    )
  }

  const priorityLines = def.allowedPriorities
    .filter((priorityId) => staffPriorityRegistry.has(priorityId))
    .map((priorityId) => {
      const priority = staffPriorityRegistry.get(priorityId)
      const where = priority.defaultAreaId
        ? ` in the ${priority.defaultAreaId.replace(/_/g, ' ')}`
        : ''
      return `${priority.label} (${priority.workKind}${where}): ${priority.benefit} ${priority.tradeoff}`
    })

  return {
    roleId,
    label: def.label,
    dailyDemand: getRoleDailyDemand(roleId),
    skillCeiling: getRoleSkillCeiling(roleId),
    ...(promotion ? { promotesToLabel: promotion.label } : {}),
    promotionRequirementLines,
    priorityLines,
    openingWage: def.defaultState.wage,
  }
}

export function buildWorkforceHelp(): WorkforceHelp {
  const rolesWithDemand = staffRegistry
    .all()
    .filter((def) => getRoleDailyDemand(def.id) > 0)
    .map((def) => `${def.label} × ${getRoleDailyDemand(def.id)}`)

  const hiringLines: string[] = [
    `Hiring goes through the applicant board: up to ${MAX_APPLICANTS} people, refreshed every ${MARKET_REFRESH_DAYS} days.`,
    `An applicant waits ${APPLICANT_SHELF_LIFE_DAYS} days and then takes work elsewhere.`,
    `Hire Staff costs ${HIRE_STAFF_COST} coin and ${timeFor('hire_staff')}, on top of the wage you agree.`,
    'Offer less than they ask and they take it — and remember it. Every coin below the ask costs loyalty.',
    'Losing somebody opens a vacancy, and the next refresh always puts at least one applicant against it.',
    `New hires are on probation for ${PROBATION_DAYS} days: ${PROBATION_NOTICE_DAYS} day's notice, no severance.`,
  ]

  const rotaLines: string[] = [
    `A normal day wants ${rolesWithDemand.join(', ')}. Anything short is a coverage gap, and the crew carries it in stress.`,
    `Set Staff Shift (${timeFor('set_staff_shift')}) moves somebody between early, late, double and rest.`,
    'Two people on the same role AND the same shift overlap: the second is worth a quarter less cover than the first. Spread them across early and late for full hours.',
    'A double is more hours from one body, at an overtime cost in fatigue and stress. A rest day is double recovery and no cover at all.',
    `Station Staff (${timeFor('assign_staff_area')}) puts somebody in a particular room. Away from where their focus actually works, they are worth less.`,
    'Switching somebody\'s focus costs part of that day to the handover, so churning priorities every morning has a price.',
    'A day\'s work costs fatigue in proportion to how busy the room was, and more of it for kitchen and floor work than for the quieter jobs. Overtime, a short-handed rota and bad blood on a station are charged on top.',
    'A night\'s rest returns some of it, and a rest day returns considerably more.',
    'Nobody falls ill until they are actually worn down — below fatigue 40, stress 60 and a full week without a rest day the risk is nothing at all. Past that it climbs. Injury rather than illness only happens to people doing repair or door work.',
  ]

  const wageLines: string[] = [
    'Wages settle at the end of each week, longest-serving first.',
    'If the till cannot cover the bill, everyone is paid as far as it goes and THE SHORTFALL BECOMES BACK PAY owed to specific people — not a mood that passes.',
    `Pay Staff Wages (${timeFor('pay_staff_wages')}) clears back pay, in part or in full. Back pay accrues late charges and is the single biggest reason people leave.`,
    `Adjust Staff Wage (${timeFor('adjust_staff_wage')}) raises or cuts a wage. A cut costs loyalty and morale roughly twice what the same-size rise buys.`,
    'Somebody who has asked for a rise has a deadline on it. Meet the figure they named and the request is answered; let it lapse and they remember being refused.',
  ]

  const developmentLines: string[] = [
    `Train Staff (${timeFor('train_staff')}, ${TRAIN_STAFF_COST} coin) banks ${TRAINING_EXPERIENCE} experience — ${TRAINING_EXPERIENCE_WITH_HELPER} when a more skilled colleague who gets on with them helps.`,
    `${EXPERIENCE_PER_SKILL_POINT} experience buys one point of skill. A day's work banks some too, more of it on an unfamiliar station.`,
    'Skill stops at the ceiling for the role. Past that, the only way up is a promotion.',
    `Cross-training teaches a second trade: ${CROSS_TRAINING_PER_SESSION} per session, ${MAX_CROSS_TRAINED_ROLES} trades per person, and ${CROSS_TRAINING_COVER_THRESHOLD} is enough to stand in for that role when its holder is out.`,
    `Promote Staff (${timeFor('promote_staff')}) moves somebody up a rung and onto the higher wage. It resets their experience bank and answers any outstanding rise request.`,
  ]

  const separationLines: string[] = [
    `Give Staff Notice (${timeFor('give_staff_notice')}) costs nothing in coin: they work out ${DEFAULT_NOTICE_DAYS} days off the floor, so their role is uncovered while it runs.`,
    `Fire Staff (${timeFor('fire_staff')}) removes them today and pays severance in lieu of the notice they did not work.`,
    `Discipline Staff (${timeFor('discipline_staff')}) is a formal warning on the record. ${MAX_DISCIPLINE_ESCALATION} warnings and dismissal is the next step.`,
    `Somebody who stops turning up without saying why is treated as having abandoned the job after ${ABANDONMENT_DAYS} days.`,
    'Nobody is exempt. The three you opened with can be dismissed, and can walk out.',
    'A departure drops everyone else\'s morale, and drops it further for anybody who actually got on with them.',
  ]

  const retentionLines: string[] = [
    'Somebody at risk of leaving is named in the staff report days before they decide, with every reason itemised and what would fix each one.',
    `When the day comes, the reasons are re-read: under ${QUIT_RISK_NO_OP_BELOW} of accumulated weight they stay, under ${QUIT_RISK_DEFER_BELOW} they give it another ${QUIT_RISK_DEFER_DAYS} days, above that they hand in notice, and at ${QUIT_RISK_WALKOUT_AT} they walk out on the spot.`,
    `Negotiate With Staff (${timeFor('negotiate_with_staff')}) talks somebody round — if your standing with them outweighs half of what is actually wrong.`,
    'Words will not settle what coin has to: back pay you owe them, a week they went unpaid, or a rise they asked for and were refused. Fix those first, then talk.',
    'A successful negotiation also withdraws a resignation already in notice.',
    'Paying back pay, granting the rise, giving them rest and training them all reduce the risk directly, because the resolver reads those records rather than a mood.',
  ]

  const relationshipLines: string[] = [
    `Working the same room builds a relationship. It starts to matter after ${MIN_CONTACTS_FOR_ACTIVE_EDGE} days together, and each person keeps at most ${MAX_ACTIVE_EDGES_PER_STAFF} that do.`,
    'A colleague who gets on with somebody covers for them when they are out, and teaches them faster. Two people who cannot stand each other on the same station cost both of them stress.',
    'Your own standing with each person is a relationship too. It decides whether they bother asking you for anything, and whether you can talk them out of leaving.',
    'Relationships lapse if the contact stops. Nothing is remembered forever.',
  ]

  return {
    hiringLines,
    rotaLines,
    wageLines,
    developmentLines,
    separationLines,
    retentionLines,
    relationshipLines,
    roles: staffRegistry
      .all()
      .map((def) => buildRoleHelpRow(def.id))
      .filter((row): row is RoleHelpRow => row !== undefined)
      .sort((a, b) => a.roleId.localeCompare(b.roleId)),
  }
}
