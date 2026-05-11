import { Registry } from './Registry'
import { staffRegistry, ensureRequiredStaffRolesRegistered } from './staffRegistry'
import type { StaffPriorityId, StaffRoleId } from '../state/TavernState'

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
}

export const staffPriorityRegistry = new Registry<StaffPriorityDefinition>()

const REQUIRED_PRIORITIES: StaffPriorityDefinition[] = [
  // Phase 11 §"Cook Priorities".
  {
    id: 'quality',
    label: 'Quality',
    roleId: 'cook',
    tags: ['food_quality', 'satisfaction', 'ingredient_use'],
  },
  {
    id: 'speed',
    label: 'Speed',
    roleId: 'cook',
    tags: ['service_speed', 'fatigue'],
  },
  {
    id: 'stretch_ingredients',
    label: 'Stretch Ingredients',
    roleId: 'cook',
    tags: ['stock_saving', 'food_quality_risk', 'food_safety_risk'],
  },
  {
    id: 'clean_as_you_go',
    label: 'Clean As You Go',
    roleId: 'cook',
    tags: ['kitchen_cleanliness', 'service_speed_penalty'],
  },

  // Phase 11 §"Server Priorities".
  {
    id: 'maximize_sales',
    label: 'Maximize Sales',
    roleId: 'server',
    tags: ['sales', 'stress', 'tab_risk'],
  },
  {
    id: 'keep_customers_happy',
    label: 'Keep Customers Happy',
    roleId: 'server',
    tags: ['satisfaction', 'sales_efficiency_penalty'],
  },
  {
    id: 'watch_tabs',
    label: 'Watch Tabs',
    roleId: 'server',
    tags: ['tab_control', 'service_speed_penalty'],
  },
  {
    id: 'help_clean',
    label: 'Help Clean',
    roleId: 'server',
    tags: ['mess_control', 'service_efficiency_penalty'],
  },

  // Phase 11 §"Cleaner/Bouncer Priorities".
  {
    id: 'clean',
    label: 'Clean',
    roleId: 'cleaner_bouncer',
    tags: ['cleanliness', 'mess_control'],
  },
  {
    id: 'minor_repairs',
    label: 'Minor Repairs',
    roleId: 'cleaner_bouncer',
    tags: ['repair', 'damage_control'],
  },
  {
    id: 'prevent_fights',
    label: 'Prevent Fights',
    roleId: 'cleaner_bouncer',
    tags: ['fight_control', 'rowdy_satisfaction_penalty'],
  },
  {
    id: 'intimidate_debtors',
    label: 'Intimidate Debtors',
    roleId: 'cleaner_bouncer',
    tags: ['tab_control', 'dangerous_reputation_risk'],
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

export function getDefaultPriorityForRole(roleId: StaffRoleId): StaffPriorityId | undefined {
  if (!staffRegistry.has(roleId)) return undefined
  return staffRegistry.get(roleId).defaultPriority
}
