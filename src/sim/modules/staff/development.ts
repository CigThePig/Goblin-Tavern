import type { SimContext } from '../../core/context'
import type { StaffRoleId, StaffState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import {
  getPromotionTarget,
  getRoleDailyDemand,
  getRoleSkillCeiling,
  staffRegistry,
} from '../../registries/staffRegistry'
import {
  getDefaultPriorityForRole,
  isPriorityAllowedForRole,
} from '../../registries/staffPriorityRegistry'

import { getStaffModuleState, bumpStaffTotal } from './workforceState'
import {
  CROSS_TRAINING_COVER_THRESHOLD,
  MAX_CROSS_TRAINED_ROLES,
} from './workforceTypes'
import { recordDevelopment, setStaffWage } from './employment'
import { findTrainingHelper } from './relationships'
import { openVacancy } from './laborMarket'

// Expansion Phase 3 §3.1 — training, skill growth, cross-training, promotion.
//
// WHAT MAKES THIS MORE THAN A NUMBER GOING UP. Three things, each of which the
// player can see and act on:
//
//   * A CEILING. Experience takes somebody to the top of what their role can be
//     (`getRoleSkillCeiling`) and no further. Getting past it means promoting
//     them, which costs a wage rise and opens a gap below them. Without the
//     ceiling, "promotion" would be a label on a raise.
//
//   * A HELPER. Training somebody with a willing, more skilled colleague is
//     cheaper and worth more than training them alone (§3.3) — so the crew
//     getting on has a mechanical payoff, and the `training_helper_*` hook
//     family has something real to resolve into.
//
//   * A CROSS-TRAINING LIMIT. Somebody may hold `MAX_CROSS_TRAINED_ROLES` second
//     trades, and at `CROSS_TRAINING_COVER_THRESHOLD` they can actually stand in
//     for that role in the coverage pass. That is the counterplay to absence:
//     the player who trained a server to keep the door does not lose the door
//     when the bouncer is ill.

const SOURCE = 'staff.development'

/**
 * Experience needed for one skill point.
 *
 * Calibrated against the two paths that spend it, so neither is pointless: a
 * day's ordinary work banks a few points of experience, so passive growth is
 * roughly a skill point a fortnight; a deliberate training session banks most of
 * a skill point, so investing in somebody is visibly faster than waiting.
 */
export const EXPERIENCE_PER_SKILL_POINT = 60

/** Experience a deliberate training session buys. */
export const TRAINING_EXPERIENCE = 40
/** With a willing, more skilled colleague helping. */
export const TRAINING_EXPERIENCE_WITH_HELPER = 60
/** Cross-training progress one session buys. */
export const CROSS_TRAINING_PER_SESSION = 20

/** Skill a promotion candidate needs, relative to the target role's opening skill. */
export const PROMOTION_SKILL_MARGIN = -4
/** Days on the books before a promotion is credible. */
export const PROMOTION_MIN_TENURE_DAYS = 10

// ---------------------------------------------------------------------------
// Experience → skill
// ---------------------------------------------------------------------------

/**
 * Bank the day's experience and cash it in for skill when it fills up.
 *
 * Runs at `endDay` off the roster rows, so what somebody learned is what they
 * actually did — a rest day teaches nothing, a day covering an unfamiliar station
 * teaches more.
 */
export function applyExperience(ctx: SimContext): void {
  const slice = getStaffModuleState(ctx.state)
  for (const row of slice.roster) {
    if (!row.available || row.experienceAdded <= 0) continue
    const member = ctx.state.staff[row.staffId]
    if (!member) continue
    grantExperience(ctx, member, row.experienceAdded, 'a day on the job')
  }
}

/**
 * Add experience, converting whole points into skill.
 *
 * The remainder is BANKED rather than rounded away, for the same reason the
 * ruleset banks its decay remainders: a rule that discards a fraction every day
 * quietly becomes a rule that never fires.
 */
export function grantExperience(
  ctx: SimContext,
  member: StaffState,
  amount: number,
  reason: string,
): { skillGained: number; experience: number } {
  if (amount <= 0) return { skillGained: 0, experience: member.experience ?? 0 }
  const ceiling = getRoleSkillCeiling(member.role)
  let experience = (member.experience ?? 0) + amount
  let skill = member.skill
  let gained = 0

  while (experience >= EXPERIENCE_PER_SKILL_POINT && skill < ceiling) {
    experience -= EXPERIENCE_PER_SKILL_POINT
    skill += 1
    gained += 1
  }
  // At the ceiling the bank stops filling: there is nothing left to buy with it,
  // and letting it grow to 900 would make a promotion instantly worth nine skill
  // points it was never earned for.
  if (skill >= ceiling) experience = Math.min(experience, EXPERIENCE_PER_SKILL_POINT - 1)

  const changes: Partial<StaffState> = { experience: Math.round(experience) }
  if (gained > 0) changes.skill = clampPercent(skill)

  ctx.modifyStaff(member.id, changes, {
    source: `${SOURCE}.experience`,
    sourceType: 'staff',
    target: gained > 0 ? `staff:${member.id}.skill` : `staff:${member.id}.experience`,
    targetType: 'staff',
    amount: gained > 0 ? gained : amount,
    readable:
      gained > 0
        ? `${member.name.display} got better at the job — skill ${member.skill} → ${skill} (${reason}).`
        : `${member.name.display} picked something up (${reason}).`,
    tags: ['staff', 'development', gained > 0 ? 'skill_growth' : 'experience', member.id],
    relatedActors: [{ kind: 'staff', id: member.id }],
    relatedSystems: ['staff'],
  })

  if (gained > 0) {
    bumpStaffTotal(ctx, 'skillPointsGained', gained)
    recordDevelopment(ctx, {
      staffId: member.id,
      kind: 'skill_growth',
      before: member.skill,
      after: skill,
      readable: `${member.name.display} reached skill ${skill}${skill >= ceiling ? ` — the ceiling for a ${roleLabel(member.role)}` : ''}.`,
      roleId: member.role,
    })
  }
  return { skillGained: gained, experience }
}

/** Is this member already as good as their role allows? */
export function isAtSkillCeiling(member: StaffState): boolean {
  return member.skill >= getRoleSkillCeiling(member.role)
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainingResult = {
  staffId: string
  helperStaffId?: string
  experienceGained: number
  skillGained: number
  crossTrainedRole?: StaffRoleId
  crossTrainingLevel?: number
  readable: string
}

/**
 * Train somebody, either at their own trade or at a second one.
 *
 * A helper is found rather than chosen: the best-suited colleague with a real
 * positive relationship and a real skill advantage. Their presence is what the
 * `training_helper_*` hook family resolves into, and the session builds the
 * relationship further — the crew that trains together works together.
 */
export function trainStaff(
  ctx: SimContext,
  staffId: string,
  input: { crossTrainRoleId?: StaffRoleId; source: string },
): TrainingResult | undefined {
  const member = ctx.state.staff[staffId]
  if (!member) return undefined
  const helperId = findTrainingHelper(ctx.state, staffId)
  const helper = helperId ? ctx.state.staff[helperId] : undefined
  const experience = helper ? TRAINING_EXPERIENCE_WITH_HELPER : TRAINING_EXPERIENCE

  bumpStaffTotal(ctx, 'trainingSessions')

  if (input.crossTrainRoleId) {
    const level = advanceCrossTraining(
      ctx,
      member,
      input.crossTrainRoleId,
      helper ? CROSS_TRAINING_PER_SESSION + 8 : CROSS_TRAINING_PER_SESSION,
      input.source,
    )
    if (level === undefined) return undefined
    const readable = `${member.name.display} trained on ${roleLabel(input.crossTrainRoleId)} work — now at ${level}${level >= CROSS_TRAINING_COVER_THRESHOLD ? ', enough to stand in' : ''}.${helper ? ` ${helper.name.display} showed them how.` : ''}`
    recordDevelopment(ctx, {
      staffId,
      kind: 'cross_training',
      after: level,
      readable,
      roleId: input.crossTrainRoleId,
    })
    return {
      staffId,
      ...(helperId !== undefined ? { helperStaffId: helperId } : {}),
      experienceGained: 0,
      skillGained: 0,
      crossTrainedRole: input.crossTrainRoleId,
      crossTrainingLevel: level,
      readable,
    }
  }

  const { skillGained } = grantExperience(
    ctx,
    member,
    experience,
    helper ? `training with ${helper.name.display}` : 'training',
  )
  // Training is a signal as well as a skill: somebody the owner invests in feels
  // it, and a `mastery` career goal feels it most.
  const moraleGain = member.careerGoal === 'mastery' ? 8 : 5
  ctx.modifyStaff(
    staffId,
    {
      morale: clampPercent(member.morale + moraleGain),
      loyalty: clampPercent(member.loyalty + 4),
    },
    {
      source: `${SOURCE}.training`,
      sourceType: 'staff',
      target: `staff:${staffId}.morale`,
      targetType: 'staff',
      amount: moraleGain,
      readable: `${member.name.display} was glad of the training.`,
      tags: ['staff', 'development', 'training', staffId],
      relatedActors: [{ kind: 'staff', id: staffId }],
      relatedSystems: ['staff'],
    },
  )

  const readable = isAtSkillCeiling(member)
    ? `${member.name.display} is already as good as a ${roleLabel(member.role)} gets — the session was worth morale, not skill.`
    : `${member.name.display} trained${helper ? ` with ${helper.name.display}` : ''} (+${experience} experience${skillGained > 0 ? `, skill +${skillGained}` : ''}).`
  recordDevelopment(ctx, {
    staffId,
    kind: 'training',
    readable,
    roleId: member.role,
  })

  return {
    staffId,
    ...(helperId !== undefined ? { helperStaffId: helperId } : {}),
    experienceGained: experience,
    skillGained,
    readable,
  }
}

/**
 * Advance a second trade. Returns the new level, or `undefined` when the request
 * is not a coherent one (their own role, an unknown role, or a fourth trade).
 */
export function advanceCrossTraining(
  ctx: SimContext,
  member: StaffState,
  roleId: StaffRoleId,
  amount: number,
  source: string,
): number | undefined {
  if (roleId === member.role) return undefined
  if (!staffRegistry.has(roleId)) return undefined
  const current = member.crossTraining ?? {}
  const known = Object.keys(current)
  if (!(roleId in current) && known.length >= MAX_CROSS_TRAINED_ROLES) {
    return undefined
  }
  const level = Math.min(100, (current[roleId] ?? 0) + amount)
  ctx.modifyStaff(
    member.id,
    { crossTraining: { ...current, [roleId]: level } },
    {
      source,
      sourceType: 'staff',
      target: `staff:${member.id}.crossTraining`,
      targetType: 'staff',
      amount,
      readable: `${member.name.display} can now do ${level}% of a ${roleLabel(roleId)}'s job.`,
      tags: ['staff', 'development', 'cross_training', member.id, roleId],
      relatedActors: [{ kind: 'staff', id: member.id }],
      relatedSystems: ['staff'],
    },
  )
  return level
}

/** Roles this member could be cross-trained on today. */
export function crossTrainableRoles(
  member: StaffState,
): StaffRoleId[] {
  const current = member.crossTraining ?? {}
  const known = Object.keys(current)
  return staffRegistry
    .all()
    .filter((def) => def.id !== member.role)
    .filter((def) => def.id in current || known.length < MAX_CROSS_TRAINED_ROLES)
    .filter((def) => (current[def.id] ?? 0) < 100)
    .map((def) => def.id)
    .sort()
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export type PromotionEligibility =
  | { ok: true; targetRoleId: StaffRoleId; newWage: number }
  | { ok: false; reason: string }

/**
 * Can this member be promoted today?
 *
 * The three gates are the ones the player can act on: the ladder has a rung
 * above them, they are good enough for it, and they have been here long enough
 * for it not to be arbitrary. Anything else — coin, the owner's time — belongs
 * to the action, not to whether the person has earned it.
 */
export function checkPromotion(
  state: { staff: Record<string, StaffState>; calendar: { totalDaysElapsed: number } },
  staffId: string,
): PromotionEligibility {
  const member = state.staff[staffId]
  if (!member) return { ok: false, reason: 'No such staff member.' }
  const target = getPromotionTarget(member.role)
  if (!target) {
    return {
      ok: false,
      reason: `${member.name.display} is already at the top of the ${roleLabel(member.role)} ladder.`,
    }
  }
  const needed = target.defaultState.skill + PROMOTION_SKILL_MARGIN
  if (member.skill < needed) {
    return {
      ok: false,
      reason: `${member.name.display} needs skill ${needed} for ${target.label} (has ${member.skill}).`,
    }
  }
  const tenure = member.daysEmployed ?? 0
  if (tenure < PROMOTION_MIN_TENURE_DAYS) {
    return {
      ok: false,
      reason: `${member.name.display} has only been here ${tenure} day(s); ${PROMOTION_MIN_TENURE_DAYS} is the minimum.`,
    }
  }
  return {
    ok: true,
    targetRoleId: target.id,
    newWage: Math.max(member.wage + 1, target.defaultState.wage),
  }
}

export type PromotionResult = {
  staffId: string
  fromRoleId: StaffRoleId
  toRoleId: StaffRoleId
  wage: { before: number; after: number }
  readable: string
}

/**
 * Move somebody up a rung.
 *
 * Two things have to happen together or the promotion is broken: the wage rises
 * (through `setStaffWage`, the one writer) and the priority is re-checked against
 * the new role. The second matters because a role's allowed priorities are
 * role-scoped — a promoted member holding a priority the new role does not allow
 * would fail validation the next morning.
 */
export function promoteStaff(
  ctx: SimContext,
  staffId: string,
  source: string,
): PromotionResult | undefined {
  const member = ctx.state.staff[staffId]
  if (!member) return undefined
  const verdict = checkPromotion(ctx.state, staffId)
  if (!verdict.ok) return undefined

  const fromRoleId = member.role
  const target = staffRegistry.get(verdict.targetRoleId)
  const priorityStillValid =
    member.currentPriority !== undefined &&
    isPriorityAllowedForRole(verdict.targetRoleId, member.currentPriority)
  const nextPriority = priorityStillValid
    ? member.currentPriority
    : getDefaultPriorityForRole(verdict.targetRoleId)

  ctx.modifyStaff(
    staffId,
    {
      role: verdict.targetRoleId,
      tags: [...new Set([...member.tags, ...target.defaultTags])],
      ...(nextPriority !== undefined ? { currentPriority: nextPriority } : {}),
      // A promotion resets the experience bank: the new ceiling is what they are
      // working towards now, and carrying a full bank across would hand them a
      // free skill point for a job they have not started.
      experience: 0,
    },
    {
      source,
      sourceType: 'staff',
      target: `staff:${staffId}.role`,
      targetType: 'staff',
      amount: 1,
      readable: `${member.name.display} was promoted from ${roleLabel(fromRoleId)} to ${target.label}.`,
      tags: ['staff', 'development', 'promotion', staffId, verdict.targetRoleId],
      relatedActors: [{ kind: 'staff', id: staffId }],
      relatedSystems: ['staff'],
    },
  )

  const wage = setStaffWage(ctx, staffId, verdict.newWage, {
    kind: 'promotion',
    reason: `promoted to ${target.label}`,
  }) ?? { before: member.wage, after: verdict.newWage }

  bumpStaffTotal(ctx, 'promotions')

  // A promotion VACATES a post. The rungs above a founding role declare no daily
  // demand, so promoting the cook leaves the kitchen's demand uncovered — and
  // without a recorded vacancy the board only answers it if a cook happens to
  // come up in a weekly roll, so the gap could sit there indefinitely. Recorded
  // only when the old role is genuinely short now, so promoting a second cook
  // out of a two-cook kitchen posts nothing.
  const stillOnOldRole = Object.values(ctx.state.staff).filter(
    (other) => other.role === fromRoleId,
  ).length
  if (stillOnOldRole < getRoleDailyDemand(fromRoleId)) {
    openVacancy(
      ctx,
      fromRoleId,
      `${member.name.display} was promoted out of ${roleLabel(fromRoleId)}`,
    )
  }

  const readable = `${member.name.display} is now ${target.label} at ${wage.after} coin a week.`
  ctx.addMemory({
    id: `staff_promoted_${staffId}`,
    source,
    actors: [{ kind: 'staff', id: staffId }],
    tags: ['staff', 'promotion', staffId, verdict.targetRoleId],
    metadata: {
      staffId,
      fromRoleId,
      toRoleId: verdict.targetRoleId,
      wage: wage.after,
    },
  })
  ctx.addHistory({
    category: 'owner_action',
    summary: readable,
    tags: ['staff', 'promotion', staffId, verdict.targetRoleId],
    relatedActors: [{ kind: 'staff', id: staffId }],
    relatedSystems: ['staff'],
    mechanicalRefs: [staffId, verdict.targetRoleId],
  })

  return {
    staffId,
    fromRoleId,
    toRoleId: verdict.targetRoleId,
    wage,
    readable,
  }
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}
