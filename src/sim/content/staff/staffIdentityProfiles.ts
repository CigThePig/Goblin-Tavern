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
  // Phase 81 / ISSUE-041 — per-culture variants. Customer groups
  // already use the wider naming-pool set (miner_workcrew,
  // merchant_roadfolk, ogre_clans, adventuring_bands); staff identity
  // was capped at goblin/human/dwarf. These additions let
  // createStaffIdentity pick a culturally-plausible profile per role
  // and lift the cross-culture distribution toward ≥6 of 8 registered
  // cultures.
  {
    id: 'cook_miner',
    roleId: 'cook',
    groupId: 'kitchen_miner',
    cultureId: 'miner_workcrew',
    namingProfileId: 'miner_workcrew',
    personalityTags: ['stout', 'practical', 'no_nonsense'],
    workStyles: ['steady', 'methodical', 'rough'],
    stressResponses: ['overworks', 'snaps'],
    loyalties: ['the_crew', 'the_old_ways'],
    dislikes: ['fancy_garnishes', 'idle_chatter'],
    backgroundHooks: [
      'fed a pit crew for years before climbing up to the tavern kitchen',
      'still cooks like a miner — heavy on root vegetables and broth',
    ],
  },
  {
    id: 'kitchen_hand_merchant',
    roleId: 'kitchen_hand',
    groupId: 'kitchen_merchant',
    cultureId: 'merchant_roadfolk',
    namingProfileId: 'merchant_roadfolk',
    personalityTags: ['chatty', 'opportunistic', 'quick_learner'],
    workStyles: ['fast', 'social'],
    stressResponses: ['rushes', 'asks_for_help'],
    loyalties: ['the_road', 'tips'],
    dislikes: ['boring_tasks', 'unpaid_tabs'],
    backgroundHooks: [
      'travelled the caravan circuit before settling here',
      'will trade recipe gossip for any spice they have never tried',
    ],
  },
  {
    id: 'seasoned_cook_ogre',
    roleId: 'seasoned_cook',
    groupId: 'kitchen_ogre',
    cultureId: 'ogre_clans',
    namingProfileId: 'ogre_clans',
    personalityTags: ['booming', 'protective_of_recipe', 'patient'],
    workStyles: ['steady', 'rough', 'methodical'],
    stressResponses: ['overworks', 'snaps'],
    loyalties: ['the_clan', 'the_craft'],
    dislikes: ['servile_questions', 'wasted_stock'],
    backgroundHooks: [
      'won a clan cookfire contest three years running',
      'trusts no one to season the stew at the end of a long day',
    ],
  },
  {
    id: 'master_chef_adventuring',
    roleId: 'master_chef',
    groupId: 'kitchen_elite',
    cultureId: 'adventuring_bands',
    namingProfileId: 'adventuring_bands',
    personalityTags: ['celebrated', 'private', 'exacting'],
    workStyles: ['methodical', 'careful', 'improviser'],
    stressResponses: ['withdraws', 'snaps'],
    loyalties: ['the_craft', 'old_party_members'],
    dislikes: ['mediocre_ingredients', 'untested_recipes'],
    backgroundHooks: [
      'once cooked for a guild of adventurers in a tower kitchen',
      'still keeps a battered knife from the road and refuses to upgrade it',
    ],
  },
  {
    id: 'server_miner',
    roleId: 'server',
    groupId: 'front_of_house',
    cultureId: 'miner_workcrew',
    namingProfileId: 'miner_workcrew',
    personalityTags: ['steady', 'observant', 'gruff'],
    workStyles: ['steady', 'careful'],
    stressResponses: ['withdraws', 'overworks'],
    loyalties: ['the_owner', 'the_regulars'],
    dislikes: ['rude_regulars', 'fast_money'],
    backgroundHooks: [
      'sells beer to old crewmates who tip in coin and stories',
      'learned to read a room from years on the deeper shafts',
    ],
  },
  {
    id: 'server_merchant',
    roleId: 'server',
    groupId: 'front_of_house',
    cultureId: 'merchant_roadfolk',
    namingProfileId: 'merchant_roadfolk',
    personalityTags: ['charming', 'fast_talking', 'discreet'],
    workStyles: ['social', 'fast'],
    stressResponses: ['asks_for_help', 'rushes'],
    loyalties: ['regulars', 'tips'],
    dislikes: ['unpaid_tabs', 'slow_pours'],
    backgroundHooks: [
      'served wine on caravan stops from here to the coast',
      'collects rumours like other people collect coins',
    ],
  },
  {
    id: 'server_adventuring',
    roleId: 'server',
    groupId: 'front_of_house',
    cultureId: 'adventuring_bands',
    namingProfileId: 'adventuring_bands',
    personalityTags: ['unflappable', 'sharp_tongued', 'loyal_in_a_fight'],
    workStyles: ['social', 'improviser'],
    stressResponses: ['snaps', 'rushes'],
    loyalties: ['regulars', 'the_owner'],
    dislikes: ['rude_regulars', 'tab_skippers'],
    backgroundHooks: [
      'used to scout for an adventuring company and still walks like it',
      'has a working knowledge of three knife-fighting styles',
    ],
  },
  {
    id: 'cleaner_bouncer_ogre',
    roleId: 'cleaner_bouncer',
    groupId: 'house_security',
    cultureId: 'ogre_clans',
    namingProfileId: 'ogre_clans',
    personalityTags: ['imposing', 'patient', 'loyal'],
    workStyles: ['steady', 'rough'],
    stressResponses: ['withdraws', 'snaps'],
    loyalties: ['the_clan', 'the_owner'],
    dislikes: ['brawls', 'sticky_floor'],
    backgroundHooks: [
      'kept order at clan moots for a decade before drifting here',
      'has never raised a hand in anger but every patron seems to know it',
    ],
  },
  {
    id: 'cleaner_bouncer_miner',
    roleId: 'cleaner_bouncer',
    groupId: 'house_security',
    cultureId: 'miner_workcrew',
    namingProfileId: 'miner_workcrew',
    personalityTags: ['stout', 'reliable', 'wry'],
    workStyles: ['steady', 'methodical'],
    stressResponses: ['overworks', 'withdraws'],
    loyalties: ['the_crew', 'house_rules'],
    dislikes: ['brawls', 'unswept_floors'],
    backgroundHooks: [
      'broke up shift fights in the lower tunnels for years',
      'still sweeps the cellar like it might collapse if neglected',
    ],
  },
  // Expansion Phase 3 §3.1 — identity profiles for the two lead roles the
  // promotion ladder adds. Without one, `createStaffIdentity` throws for the
  // role, so a promotion target with no profile would be a role nobody could
  // ever be hired into. Deliberately the same naming profiles and cultures as
  // the roles they sit above: a head server is a server who stayed.
  {
    id: 'head_server_town_human',
    roleId: 'head_server',
    groupId: 'front_of_house',
    namingProfileId: 'human_town',
    personalityTags: ['unflappable', 'watchful', 'well_known'],
    workStyles: ['social', 'steady', 'methodical'],
    stressResponses: ['asks_for_help', 'overworks', 'snaps'],
    loyalties: ['the_crew', 'regulars'],
    dislikes: ['unpaid_tabs', 'a_room_left_unwatched'],
    backgroundHooks: [
      'ran the floor at a coaching inn for a decade',
      'knows which regular is about to become a problem before they do',
      'keeps a private ledger of who tips and who does not',
    ],
  },
  {
    id: 'head_keeper_dwarf_caravan',
    roleId: 'head_keeper',
    groupId: 'house_security',
    namingProfileId: 'dwarf_caravan',
    personalityTags: ['implacable', 'orderly', 'quietly_feared'],
    workStyles: ['methodical', 'steady', 'rough'],
    stressResponses: ['withdraws', 'overworks', 'snaps'],
    loyalties: ['house_rules', 'the_owner'],
    dislikes: ['brawls', 'a_door_left_unwatched'],
    backgroundHooks: [
      'kept order on a caravan road nobody else would work',
      'has a written list of house rules and enforces every line',
      'trained half the doormen in the district',
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

// Phase 81 / ISSUE-041 — return every registered profile for a role
// so callers can weighted-pick (the original first-match-only path
// collapsed staff identity onto three cultures regardless of how
// many profiles existed).
export function getStaffIdentityProfilesForRole(
  roleId: string,
): StaffIdentityProfile[] {
  ensureRequiredStaffIdentityProfilesRegistered()
  return staffIdentityProfileRegistry
    .all()
    .filter((profile) => profile.roleId === roleId)
}
