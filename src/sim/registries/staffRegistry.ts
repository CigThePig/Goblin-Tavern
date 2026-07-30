import { Registry } from './Registry'
import type { StaffRoleId, StaffPriorityId, StaffState } from '../state/TavernState'

// Phase 11 §11.1 — Staff role registry.
//
// Each registered role defines:
//   - `id`: registry-canonical `StaffRoleId` value (string, per the
//     §11.1 "Role typing clarification" forward note).
//   - `label`: display name used in reports.
//   - `defaultTags`: tags applied to fresh staff of this role.
//   - `allowedPriorities`: which priority ids are valid for this role.
//   - `defaultPriority`: the priority used when a daily assignment omits
//     this staff member (Phase 11 §11.3 "safe default").
//   - `defaultState`: per-field seed used by `createInitialTavernState`
//     to spawn the canonical staff member for this role.

export type StaffRoleDefaultState = Omit<
  StaffState,
  'id' | 'name' | 'role' | 'tags' | 'currentPriority'
>

export type StaffRoleDefinition = {
  id: StaffRoleId
  label: string
  defaultTags: string[]
  allowedPriorities: StaffPriorityId[]
  defaultPriority: StaffPriorityId
  defaultStaffId: string
  defaultStaffName: string
  defaultState: StaffRoleDefaultState
  /**
   * Phase 71 / ISSUE-031 — flag set on cook-tier roles (kitchen_hand,
   * seasoned_cook, master_chef) added in this phase. Default `true`
   * for backwards compatibility; when explicitly `false`,
   * `createInitialStaff` skips this role and the player must hire
   * the role explicitly.
   */
  seedOnDayZero?: boolean
  /**
   * Expansion Phase 3 §3.1 — the role this one is promoted INTO.
   *
   * A ladder declared on the role rather than a lookup table in the promotion
   * code, so adding a role adds its rung in one place. Absent means the top of
   * that family's ladder.
   */
  promotesTo?: StaffRoleId
  /**
   * §3.2 — how many bodies a normal trading day wants on this role.
   *
   * This is what makes a coverage gap a fact rather than an opinion: demand is
   * declared, coverage is counted, and the difference is what the roster
   * reports and service pays for.
   */
  dailyDemand?: number
  /**
   * §3.1 — the highest skill this role can reach through experience alone.
   *
   * A kitchen hand who works for a year is a good kitchen hand, not a master
   * chef; getting past the ceiling means being promoted, which is the point of
   * having a ladder.
   */
  skillCeiling?: number
}

export const staffRegistry = new Registry<StaffRoleDefinition>()

// Phase 11 §"Required Staff Roles" — only `cook`, `server`, and
// `cleaner_bouncer` are in scope for this phase. Other roles are
// listed in the phase doc as "Optional later"; do not register them
// here until they prove necessary.
const REQUIRED_STAFF_ROLES: StaffRoleDefinition[] = [
  {
    id: 'cook',
    label: 'Cook',
    defaultTags: ['kitchen', 'service'],
    allowedPriorities: [
      'quality',
      'speed',
      'stretch_ingredients',
      'clean_as_you_go',
    ],
    defaultPriority: 'speed',
    promotesTo: 'seasoned_cook',
    dailyDemand: 1,
    skillCeiling: 75,
    defaultStaffId: 'cook',
    defaultStaffName: 'Gribna',
    defaultState: {
      skill: 55,
      morale: 45,
      stress: 35,
      fatigue: 20,
      loyalty: 50,
      wage: 12,
      paidThisWeek: true,
      activeFlags: [],
    },
  },
  {
    id: 'server',
    label: 'Server',
    defaultTags: ['service', 'front_of_house'],
    allowedPriorities: [
      'maximize_sales',
      'keep_customers_happy',
      'watch_tabs',
      'help_clean',
    ],
    defaultPriority: 'keep_customers_happy',
    promotesTo: 'head_server',
    dailyDemand: 1,
    skillCeiling: 70,
    defaultStaffId: 'server',
    defaultStaffName: 'Nesk',
    defaultState: {
      skill: 50,
      morale: 50,
      stress: 25,
      fatigue: 20,
      loyalty: 45,
      wage: 10,
      paidThisWeek: true,
      activeFlags: [],
    },
  },
  {
    id: 'cleaner_bouncer',
    label: 'Cleaner/Bouncer',
    defaultTags: ['cleaning', 'security'],
    allowedPriorities: [
      'clean',
      'minor_repairs',
      'prevent_fights',
      'intimidate_debtors',
    ],
    defaultPriority: 'clean',
    promotesTo: 'head_keeper',
    dailyDemand: 1,
    skillCeiling: 68,
    defaultStaffId: 'cleaner_bouncer',
    defaultStaffName: 'Brug',
    defaultState: {
      skill: 45,
      morale: 40,
      stress: 30,
      fatigue: 25,
      loyalty: 55,
      wage: 11,
      paidThisWeek: true,
      activeFlags: [],
    },
  },
  // Phase 71 / ISSUE-031 §4.3, §6.5 — cook-tier roles. These don't
  // seed on day zero; the player hires them via the existing
  // hire_staff path (or tests inject them directly). The skill
  // gradient is what makes rare/legendary recipe attempts viable.
  {
    id: 'kitchen_hand',
    label: 'Kitchen Hand',
    defaultTags: ['kitchen', 'service', 'apprentice'],
    allowedPriorities: [
      'quality',
      'speed',
      'stretch_ingredients',
      'clean_as_you_go',
    ],
    defaultPriority: 'speed',
    promotesTo: 'cook',
    dailyDemand: 0,
    skillCeiling: 50,
    defaultStaffId: 'kitchen_hand',
    defaultStaffName: 'Bink',
    defaultState: {
      skill: 30,
      morale: 50,
      stress: 30,
      fatigue: 25,
      loyalty: 35,
      wage: 7,
      paidThisWeek: true,
      activeFlags: [],
    },
    seedOnDayZero: false,
  },
  {
    id: 'seasoned_cook',
    label: 'Seasoned Cook',
    defaultTags: ['kitchen', 'service', 'experienced'],
    allowedPriorities: [
      'quality',
      'speed',
      'stretch_ingredients',
      'clean_as_you_go',
    ],
    defaultPriority: 'quality',
    promotesTo: 'master_chef',
    dailyDemand: 0,
    skillCeiling: 82,
    defaultStaffId: 'seasoned_cook',
    defaultStaffName: 'Vassa',
    defaultState: {
      skill: 62,
      morale: 50,
      stress: 30,
      fatigue: 20,
      loyalty: 50,
      wage: 14,
      paidThisWeek: true,
      activeFlags: [],
    },
    seedOnDayZero: false,
  },
  {
    id: 'master_chef',
    label: 'Master Chef',
    defaultTags: ['kitchen', 'service', 'master'],
    allowedPriorities: [
      'quality',
      'speed',
      'stretch_ingredients',
      'clean_as_you_go',
    ],
    defaultPriority: 'quality',
    dailyDemand: 0,
    skillCeiling: 96,
    defaultStaffId: 'master_chef',
    defaultStaffName: 'Iorath',
    defaultState: {
      skill: 85,
      morale: 55,
      stress: 35,
      fatigue: 25,
      loyalty: 45,
      wage: 22,
      paidThisWeek: true,
      activeFlags: [],
    },
    seedOnDayZero: false,
  },
  // Expansion Phase 3 §3.1 — the top rung for the two families that had none.
  //
  // WHY TWO NEW ROLES. §3.1 requires promotion, and before this phase only the
  // kitchen had anywhere to be promoted to: a server or a cleaner/bouncer who
  // worked for a year hit their skill ceiling with no rung above them, so
  // "promotion" would have meant a wage rise with a new label — exactly the
  // fake-depth the §5 protocol fails a phase for. These two are the smallest
  // honest fix: same priorities as the role they come from (so no new player
  // vocabulary), a real skill ceiling above it, and a wage that makes the
  // promotion a decision. They never seed on day zero — the only way to get one
  // is to promote someone into it, or to hire one who already made the grade
  // elsewhere.
  {
    id: 'head_server',
    label: 'Head Server',
    defaultTags: ['service', 'front_of_house', 'lead'],
    allowedPriorities: [
      'maximize_sales',
      'keep_customers_happy',
      'watch_tabs',
      'help_clean',
    ],
    defaultPriority: 'keep_customers_happy',
    dailyDemand: 0,
    skillCeiling: 92,
    defaultStaffId: 'head_server',
    defaultStaffName: 'Ordreth',
    defaultState: {
      // The opening skill IS the promotion gate (`PROMOTION_SKILL_MARGIN` off
      // it), so it is set just under the Server's own ceiling of 70: a server
      // who has been trained to the top of their trade is ready for the step up,
      // and one who has not is not.
      skill: 66,
      morale: 55,
      stress: 30,
      fatigue: 20,
      loyalty: 55,
      wage: 16,
      paidThisWeek: true,
      activeFlags: [],
    },
    seedOnDayZero: false,
  },
  {
    id: 'head_keeper',
    label: 'Head Keeper',
    defaultTags: ['cleaning', 'security', 'lead'],
    allowedPriorities: [
      'clean',
      'minor_repairs',
      'prevent_fights',
      'intimidate_debtors',
    ],
    defaultPriority: 'prevent_fights',
    dailyDemand: 0,
    skillCeiling: 90,
    defaultStaffId: 'head_keeper',
    defaultStaffName: 'Kholga',
    defaultState: {
      // As `head_server`: just under the Cleaner/Bouncer ceiling of 68.
      skill: 64,
      morale: 50,
      stress: 32,
      fatigue: 22,
      loyalty: 60,
      wage: 15,
      paidThisWeek: true,
      activeFlags: [],
    },
    seedOnDayZero: false,
  },
]

/** §3.1 — the next rung up for `roleId`, if the ladder has one. */
export function getPromotionTarget(
  roleId: StaffRoleId,
): StaffRoleDefinition | undefined {
  if (!staffRegistry.has(roleId)) return undefined
  const next = staffRegistry.get(roleId).promotesTo
  if (!next || !staffRegistry.has(next)) return undefined
  return staffRegistry.get(next)
}

/**
 * §3.1 — the skill a role can reach on experience alone.
 *
 * Falls back to the role's own opening skill plus a modest margin so a role
 * that never declared a ceiling still has one — an unbounded skill would make
 * the promotion ladder pointless.
 */
export function getRoleSkillCeiling(roleId: StaffRoleId): number {
  if (!staffRegistry.has(roleId)) return 100
  const def = staffRegistry.get(roleId)
  return Math.min(100, def.skillCeiling ?? def.defaultState.skill + 20)
}

/** §3.2 — bodies a normal day wants on `roleId`. */
export function getRoleDailyDemand(roleId: StaffRoleId): number {
  if (!staffRegistry.has(roleId)) return 0
  return staffRegistry.get(roleId).dailyDemand ?? 0
}

let initialized = false

export function ensureRequiredStaffRolesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_STAFF_ROLES) {
    if (!staffRegistry.has(def.id)) {
      staffRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredStaffRolesRegistered()
