// Phase 31 §31.6 — staff identity profile registry.
//
// Phase 31 ships one identity profile per required staff role
// (`cook`, `server`, `cleaner_bouncer`). The list is intentionally
// small: profiles are infrastructure, not cast writing. Later phases
// can register additional profiles for new roles (or culture-specific
// variants) without touching this file.

import { Registry } from '../../registries/Registry'
import { ensureStarterNamingProfilesRegistered } from '../naming/namingProfiles'
import type { StaffIdentityProfile } from './staffIdentityTypes'

export const staffIdentityProfileRegistry =
  new Registry<StaffIdentityProfile>()

const REQUIRED_STAFF_IDENTITY_PROFILES: StaffIdentityProfile[] = [
  {
    id: 'cook_goblin_common',
    roleId: 'cook',
    groupId: 'kitchen_goblin',
    cultureId: 'goblin_local',
    namingProfileId: 'goblin_common',
    personalityTags: ['proud', 'impatient', 'protective_of_recipe'],
    workStyles: ['fast', 'rough', 'methodical'],
    stressResponses: ['snaps', 'rushes', 'overworks'],
    loyalties: ['kitchen', 'old_regulars'],
    dislikes: ['bland_food', 'wasted_stock'],
    backgroundHooks: [
      'apprenticed under a market-stall cook',
      'lost a sibling to mushroom blight',
      'guards a stolen stew recipe',
    ],
  },
  {
    id: 'server_town_human',
    roleId: 'server',
    groupId: 'front_of_house',
    // `human_town` is a registered naming profile but not a culture in
    // the Phase 30 starter set — leave `cultureId` unset rather than
    // pointing at a non-existent world culture (reference validation
    // would reject it).
    namingProfileId: 'human_town',
    personalityTags: ['gossipy', 'quick', 'socially_alert'],
    workStyles: ['social', 'fast', 'improviser'],
    stressResponses: ['rushes', 'asks_for_help', 'gets_sloppy'],
    loyalties: ['regulars', 'tips'],
    dislikes: ['unpaid_tabs', 'rude_regulars'],
    backgroundHooks: [
      'worked at a busier tavern in town',
      'collects rumours like other people collect coins',
      'still owes a debt to the previous owner',
    ],
  },
  {
    id: 'cleaner_bouncer_dwarf_caravan',
    roleId: 'cleaner_bouncer',
    groupId: 'house_security',
    // Dwarven-caravan flavour without a registered dwarf culture — keep
    // `cultureId` unset until a matching culture lands.
    namingProfileId: 'dwarf_caravan',
    personalityTags: ['grim', 'loyal', 'hates_rats'],
    workStyles: ['steady', 'careful', 'methodical'],
    stressResponses: ['withdraws', 'overworks', 'snaps'],
    loyalties: ['the_owner', 'house_rules'],
    dislikes: ['brawls', 'sticky_floor'],
    backgroundHooks: [
      'left a caravan after a wagon-fire',
      'sweeps the cellar twice when nobody is watching',
      'remembers every face that ever skipped a tab',
    ],
  },
  // Phase 71 / ISSUE-031 §4.3 — identity profiles for the new cook
  // tier roles. These don't seed on day zero; profiles are wired so
  // that when the player hires one, the createStaffIdentity path can
  // resolve a profile for the role.
  {
    id: 'kitchen_hand_goblin_common',
    roleId: 'kitchen_hand',
    groupId: 'kitchen_goblin',
    cultureId: 'goblin_local',
    namingProfileId: 'goblin_common',
    personalityTags: ['eager', 'clumsy', 'curious'],
    workStyles: ['fast', 'rough'],
    stressResponses: ['rushes', 'asks_for_help'],
    loyalties: ['the_owner'],
    dislikes: ['boring_tasks'],
    backgroundHooks: [
      'first kitchen job — still learning the difference between salt and sugar',
      'family worked the market stalls but never the back of house',
    ],
  },
  {
    id: 'seasoned_cook_human_town',
    roleId: 'seasoned_cook',
    groupId: 'kitchen_skilled',
    namingProfileId: 'human_town',
    personalityTags: ['confident', 'patient', 'practical'],
    workStyles: ['methodical', 'careful'],
    stressResponses: ['overworks', 'withdraws'],
    loyalties: ['the_craft', 'the_team'],
    dislikes: ['hurried_prep', 'cut_corners'],
    backgroundHooks: [
      'ran a town-square kitchen before drifting here',
      'keeps a small notebook of recipes nobody else has read',
    ],
  },
  {
    id: 'master_chef_dwarf_caravan',
    roleId: 'master_chef',
    groupId: 'kitchen_elite',
    namingProfileId: 'dwarf_caravan',
    personalityTags: ['exacting', 'private', 'celebrated'],
    workStyles: ['methodical', 'careful', 'steady'],
    stressResponses: ['snaps', 'withdraws'],
    loyalties: ['the_craft'],
    dislikes: ['servile_questions', 'mediocre_ingredients'],
    backgroundHooks: [
      'cooked for an emir for nine years before the war',
      'commands a fee that pays for itself only when patrons notice',
    ],
  },
]

let initialized = false

export function ensureRequiredStaffIdentityProfilesRegistered(): void {
  if (initialized) return
  // Naming profiles must be registered first because the identity
  // profiles reference them; cross-reference validation will fail
  // otherwise.
  ensureStarterNamingProfilesRegistered()
  for (const profile of REQUIRED_STAFF_IDENTITY_PROFILES) {
    if (!staffIdentityProfileRegistry.has(profile.id)) {
      staffIdentityProfileRegistry.register(profile)
    }
  }
  initialized = true
}

export function getStaffIdentityProfileForRole(
  roleId: string,
): StaffIdentityProfile | undefined {
  ensureRequiredStaffIdentityProfilesRegistered()
  return staffIdentityProfileRegistry
    .all()
    .find((profile) => profile.roleId === roleId)
}
