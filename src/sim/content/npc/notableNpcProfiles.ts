// Phase 44 §ISSUE-004 — Notable NPC identity profile registry.
//
// A `NotableNpcProfile` describes the persistent identity space for one
// starter notable NPC: which naming profile drives the generated name,
// which faction / culture / customer-group it belongs to, and the tags
// it lands in `state.world.notableNpcs[id]` with. Profiles are pure
// content: registering them does not by itself add NPCs to state; the
// seeding step in `state/defaults.ts` iterates the registry and calls
// `createNotableNpc` once per profile.
//
// The starter set is intentionally small (8 profiles) and faction-
// anchored so the `notable_npc` ref kind has reachable targets for the
// 7+ consumer code paths that already branch on it (pressure / feedback
// / weekly / service / issues / causes, plus reference validation).
// Mirrors `staffIdentityProfiles.ts` — single-file ergonomics: type +
// registry + REQUIRED_* array + ensure-fn.

import { Registry } from '../../registries/Registry'
import type { NamingProfileId } from '../naming/nameTypes'
import { ensureStarterNamingProfilesRegistered } from '../naming/namingProfiles'

export type NotableNpcProfileId = string

export type NotableNpcProfile = {
  id: NotableNpcProfileId
  /** Stable id the seeded NPC lands in `state.world.notableNpcs` under.
   * Distinct from `id` so a future culture-variant profile can target
   * the same canonical NPC slot. */
  defaultNpcId: string
  /** Short label for the role this NPC occupies (used as a fallback
   * display when no generated name is available). */
  label: string
  /** Domain kind, copied verbatim onto `NotableNpcWorldState.kind`.
   * Free-form string: 'authority', 'moneylender', 'gossip', 'fence',
   * 'priest', 'merchant_prince', 'labour_lead'. */
  kind: string
  /** Naming profile the factory uses to roll the display name. */
  namingProfileId: NamingProfileId
  /** Optional faction membership. When set, reference validation
   * enforces that the faction exists in `state.world.factions`. */
  factionId?: string
  /** Optional culture pointer. Reference validation enforces it
   * exists in `state.world.cultures` when present. */
  cultureId?: string
  /** Optional customer-group affiliation (e.g. a fence who hangs with
   * the locals). */
  customerGroupId?: string
  /** Tags copied verbatim onto the NPC record. */
  tags: string[]
  /** Initial `activeFlags`; usually empty. */
  activeFlags: string[]
}

export const notableNpcProfileRegistry = new Registry<NotableNpcProfile>()

// Starter roster: every profile's `factionId` / `cultureId` /
// `customerGroupId` references an entity already seeded by the
// faction, culture, and customer-group registries. Stays inside the
// existing world so reference validation passes at day zero.
const REQUIRED_NOTABLE_NPC_PROFILES: NotableNpcProfile[] = [
  {
    id: 'watch_inspector',
    defaultNpcId: 'notable_npc_watch_inspector',
    label: 'Watch Inspector',
    kind: 'authority',
    namingProfileId: 'human_town',
    factionId: 'town_watch',
    tags: ['inspector', 'authority', 'town_watch'],
    activeFlags: [],
  },
  {
    id: 'watch_captain',
    defaultNpcId: 'notable_npc_watch_captain',
    label: 'Watch Captain',
    kind: 'authority',
    namingProfileId: 'human_town',
    factionId: 'town_watch',
    tags: ['captain', 'authority', 'town_watch', 'violence_relevant'],
    activeFlags: [],
  },
  {
    id: 'moneylender',
    defaultNpcId: 'notable_npc_moneylender',
    label: 'Moneylender',
    kind: 'moneylender',
    namingProfileId: 'merchant_roadfolk',
    factionId: 'brewers_guild',
    cultureId: 'merchant_roadfolk',
    tags: ['moneylender', 'debt_relevant', 'merchant'],
    activeFlags: [],
  },
  {
    id: 'town_gossip',
    defaultNpcId: 'notable_npc_town_gossip',
    label: 'Town Gossip',
    kind: 'gossip',
    namingProfileId: 'goblin_common',
    cultureId: 'goblin_local',
    customerGroupId: 'local_goblins',
    tags: ['gossip', 'rumour_source', 'goblin'],
    activeFlags: [],
  },
  {
    id: 'fence',
    defaultNpcId: 'notable_npc_fence',
    label: 'Fence',
    kind: 'fence',
    namingProfileId: 'goblin_common',
    factionId: 'scrap_collectors',
    cultureId: 'goblin_local',
    tags: ['fence', 'underground', 'goblin'],
    activeFlags: [],
  },
  {
    id: 'shrine_priest',
    defaultNpcId: 'notable_npc_shrine_priest',
    label: 'Shrine Priest',
    kind: 'priest',
    namingProfileId: 'human_town',
    factionId: 'local_shrine',
    tags: ['priest', 'ritual', 'reputation_influence'],
    activeFlags: [],
  },
  {
    id: 'merchant_prince',
    defaultNpcId: 'notable_npc_merchant_prince',
    label: 'Merchant Prince',
    kind: 'merchant_prince',
    namingProfileId: 'merchant_roadfolk',
    factionId: 'market_caravan_circle',
    cultureId: 'merchant_roadfolk',
    tags: ['merchant', 'wealthy', 'supplier_authority'],
    activeFlags: [],
  },
  {
    id: 'miner_foreman',
    defaultNpcId: 'notable_npc_miner_foreman',
    label: 'Miner Foreman',
    kind: 'labour_lead',
    namingProfileId: 'goblin_common',
    factionId: 'miners_union',
    cultureId: 'miner_workcrew',
    customerGroupId: 'miners',
    tags: ['foreman', 'payday_pressure', 'worker'],
    activeFlags: [],
  },
]

let initialized = false

export function ensureRequiredNotableNpcProfilesRegistered(): void {
  if (initialized) return
  // Naming profiles must be registered first because every NPC profile
  // references one — `createNotableNpc` looks the naming profile up by
  // id and would throw otherwise.
  ensureStarterNamingProfilesRegistered()
  for (const profile of REQUIRED_NOTABLE_NPC_PROFILES) {
    if (!notableNpcProfileRegistry.has(profile.id)) {
      notableNpcProfileRegistry.register(profile)
    }
  }
  initialized = true
}
