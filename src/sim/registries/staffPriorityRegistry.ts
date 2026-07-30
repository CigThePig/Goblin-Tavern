import { Registry } from './Registry'
import { staffRegistry, ensureRequiredStaffRolesRegistered } from './staffRegistry'
import type { StaffPriorityId, StaffRoleId } from '../state/TavernState'
import type { StaffWorkKind } from '../modules/staff/workforceTypes'

// Phase 11 §11.1 — Staff priority registry.
//
// Each entry defines a daily priority a staff member can adopt. Priorities
// are role-scoped: every priority belongs to exactly one role, and the
// staff module rejects assignments that mix them. Tags surface expected
// effect categories so Phase 12 service code (and future card metadata)
// can read priorities by tag rather than by hard-coded id.

export type StaffPriorityDefinition = {
  id: StaffPriorityId
  label: string
  roleId: StaffRoleId
  tags: string[]
  /**
   * Phase 202 / audit Wave 3 (`P6-COMP-004`) — what this focus buys and
   * what it costs, in player terms.
   *
   * The priority sheet rendered only `label`, so a repeatable strategic
   * lever offered no forecast at all: switching a bouncer from Clean to
   * Prevent Fights told the player nothing about what would change. The
   * tags below already encode the direction; these two lines say it out
   * loud. Deliberately directional — the service model cannot promise a
   * number of fights deterred, and the audit is explicit that inventing
   * one would be worse than saying nothing.
   */
  benefit: string
  tradeoff: string
  /**
   * Expansion Phase 3 §3.2 — what this focus actually has the person DOING.
   *
   * Declared here rather than inferred from `tags`, because the roster has to
   * place a body somewhere and a tag list is a search rather than an answer.
   * It is what turns "twelve priorities" into "real allocations": the work kind
   * picks the default station, decides which coverage row the body counts
   * toward, and decides whether switching focus costs a handoff.
   */
  workKind: StaffWorkKind
  /**
   * §3.2 — the area this focus is normally worked in, when the player has not
   * stationed the person anywhere. Absent means "wherever they are".
   */
  defaultAreaId?: string
}

export const staffPriorityRegistry = new Registry<StaffPriorityDefinition>()

const REQUIRED_PRIORITIES: StaffPriorityDefinition[] = [
  // Phase 11 §"Cook Priorities".
  {
    id: 'quality',
    label: 'Quality',
    roleId: 'cook',
    tags: ['food_quality', 'satisfaction', 'ingredient_use'],
    benefit: 'Better food, happier customers.',
    tradeoff: 'Uses more ingredients.',
    workKind: 'kitchen',
    defaultAreaId: 'kitchen',
  },
  {
    id: 'speed',
    label: 'Speed',
    roleId: 'cook',
    tags: ['service_speed', 'fatigue'],
    benefit: 'Faster plates, shorter waits.',
    tradeoff: 'Tiring work — fatigue builds.',
    workKind: 'kitchen',
    defaultAreaId: 'kitchen',
  },
  {
    id: 'stretch_ingredients',
    label: 'Stretch Ingredients',
    roleId: 'cook',
    tags: ['stock_saving', 'food_quality_risk', 'food_safety_risk'],
    benefit: 'Ingredients last longer.',
    tradeoff: 'Quality slips, and food safety with it.',
    workKind: 'kitchen',
    defaultAreaId: 'kitchen',
  },
  {
    id: 'clean_as_you_go',
    label: 'Clean As You Go',
    roleId: 'cook',
    tags: ['kitchen_cleanliness', 'service_speed_penalty'],
    benefit: 'The kitchen stays in order.',
    tradeoff: 'Slower service while they tidy.',
    workKind: 'cleaning',
    defaultAreaId: 'kitchen',
  },

  // Phase 11 §"Server Priorities".
  {
    id: 'maximize_sales',
    label: 'Maximize Sales',
    roleId: 'server',
    tags: ['sales', 'stress', 'tab_risk'],
    benefit: 'More coin through the door.',
    tradeoff: 'Stressful, and more tabs left open.',
    workKind: 'service',
    defaultAreaId: 'main_room',
  },
  {
    id: 'keep_customers_happy',
    label: 'Keep Customers Happy',
    roleId: 'server',
    tags: ['satisfaction', 'sales_efficiency_penalty'],
    benefit: 'Customers leave satisfied.',
    tradeoff: 'Fewer sales per shift.',
    workKind: 'service',
    defaultAreaId: 'main_room',
  },
  {
    id: 'watch_tabs',
    label: 'Watch Tabs',
    roleId: 'server',
    tags: ['tab_control', 'service_speed_penalty'],
    benefit: 'Fewer unpaid tabs.',
    tradeoff: 'Slower service while they check.',
    workKind: 'service',
    defaultAreaId: 'main_room',
  },
  {
    id: 'help_clean',
    label: 'Help Clean',
    roleId: 'server',
    tags: ['mess_control', 'service_efficiency_penalty'],
    benefit: 'Less mess builds up in the room.',
    tradeoff: 'Less time on the floor serving.',
    workKind: 'cleaning',
    defaultAreaId: 'main_room',
  },

  // Phase 11 §"Cleaner/Bouncer Priorities".
  {
    id: 'clean',
    label: 'Clean',
    roleId: 'cleaner_bouncer',
    tags: ['cleanliness', 'mess_control'],
    benefit: 'Rooms stay clean and tidy.',
    tradeoff: 'Nothing else gets their attention.',
    workKind: 'cleaning',
    defaultAreaId: 'main_room',
  },
  {
    id: 'minor_repairs',
    label: 'Minor Repairs',
    roleId: 'cleaner_bouncer',
    tags: ['repair', 'damage_control'],
    benefit: 'Damage gets patched before it worsens.',
    tradeoff: 'Mess goes unattended.',
    workKind: 'repair',
  },
  {
    id: 'prevent_fights',
    label: 'Prevent Fights',
    roleId: 'cleaner_bouncer',
    tags: ['fight_control', 'rowdy_satisfaction_penalty'],
    benefit: 'Trouble gets stopped early.',
    tradeoff: 'The rowdier crowd enjoys it less.',
    workKind: 'security',
    defaultAreaId: 'main_room',
  },
  {
    id: 'intimidate_debtors',
    label: 'Intimidate Debtors',
    roleId: 'cleaner_bouncer',
    tags: ['tab_control', 'dangerous_reputation_risk'],
    benefit: 'Debtors settle up.',
    tradeoff: 'The tavern earns a dangerous name.',
    workKind: 'security',
    defaultAreaId: 'main_room',
  },
]

let initialized = false

export function ensureRequiredStaffPrioritiesRegistered(): void {
  if (initialized) return
  // Roles must exist before priorities reference them.
  ensureRequiredStaffRolesRegistered()
  for (const def of REQUIRED_PRIORITIES) {
    if (!staffPriorityRegistry.has(def.id)) {
      // Sanity: the priority's `roleId` must exist in the role registry.
      if (!staffRegistry.has(def.roleId)) {
        throw new Error(
          `staffPriorityRegistry: priority '${def.id}' references unknown role '${def.roleId}'`,
        )
      }
      staffPriorityRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredStaffPrioritiesRegistered()

// Phase 11 §11.3 — Lookup helpers for the staff module and tests.
export function getAllowedPrioritiesForRole(roleId: StaffRoleId): StaffPriorityId[] {
  if (!staffRegistry.has(roleId)) return []
  return staffRegistry.get(roleId).allowedPriorities
}

export function isPriorityAllowedForRole(
  roleId: StaffRoleId,
  priorityId: StaffPriorityId,
): boolean {
  return getAllowedPrioritiesForRole(roleId).includes(priorityId)
}

// Expansion Phase 3 §3.2 — what a priority has the person doing, and where.
export function getPriorityWorkKind(
  priorityId: StaffPriorityId | undefined,
): StaffWorkKind | undefined {
  if (!priorityId || !staffPriorityRegistry.has(priorityId)) return undefined
  return staffPriorityRegistry.get(priorityId).workKind
}

export function getPriorityDefaultAreaId(
  priorityId: StaffPriorityId | undefined,
): string | undefined {
  if (!priorityId || !staffPriorityRegistry.has(priorityId)) return undefined
  return staffPriorityRegistry.get(priorityId).defaultAreaId
}

export function getDefaultPriorityForRole(roleId: StaffRoleId): StaffPriorityId | undefined {
  if (!staffRegistry.has(roleId)) return undefined
  return staffRegistry.get(roleId).defaultPriority
}
