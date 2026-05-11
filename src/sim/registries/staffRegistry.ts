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
]

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
