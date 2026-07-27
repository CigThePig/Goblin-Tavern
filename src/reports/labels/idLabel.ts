// Phase 117 / ISSUE-078 — Canonical id → label translation utility.
//
// The simulation emits machine-readable ids (`staff_loyalty_risk`,
// `dish_firewood`, `closed_early`) freely, because the engine and tests
// need stable identifiers. The UI must never show those ids to the
// player. Every existing registry already carries a `.label` field
// alongside its definitions; this module centralises the lookup so
// every render site goes through the same translation.
//
// For registry-backed categories the function consults the registry,
// falling back to `humanizeId(id)` for ids that are not registered
// (e.g. an outcome string sourced from runtime state rather than a
// registry). For enum-shaped categories (project status, social
// outcome, expedition outcome, area problem, log facet) the function
// consults a static table colocated in this file. Adding a new enum
// value later is a one-line table extension.
//
// Pure projection: no state, no side effects, no registry mutation.

import { stockRegistry } from '../../sim/registries/stockRegistry'
import { recipeRegistry } from '../../sim/registries/recipeRegistry'
import { areaRegistry } from '../../sim/registries/areaRegistry'
import { customerRegistry } from '../../sim/registries/customerRegistry'
import { staffRegistry } from '../../sim/registries/staffRegistry'
import { staffPriorityRegistry } from '../../sim/registries/staffPriorityRegistry'
import { actionRegistry } from '../../sim/registries/actionRegistry'
import { pressureRegistry } from '../../sim/modules/pressures/pressureRegistry'
import { POLICY_STARTERS } from '../../sim/modules/ownerActions/policyActions'

export type IdCategory =
  | 'stock'
  | 'recipe'
  | 'pressure'
  | 'reputation'
  | 'area'
  | 'customerGroup'
  | 'staffRole'
  | 'staffPriority'
  | 'policy'
  | 'action'
  | 'projectStatus'
  | 'socialOutcome'
  | 'expeditionOutcome'
  | 'areaField'
  | 'logFacet'
  | 'dayType'

const REPUTATION_LABELS: Record<string, string> = {
  cheap: 'Cheap',
  tasty: 'Tasty',
  filthy: 'Filthy',
  dangerous: 'Dangerous',
  cozy: 'Cozy',
  strange: 'Strange',
  reliable: 'Reliable',
  goblinAuthentic: 'Goblin-authentic',
  respectable: 'Respectable',
  culinary_renown: 'Culinary renown',
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
}

const SOCIAL_OUTCOME_LABELS: Record<string, string> = {
  improved: 'Improved',
  worsened: 'Worsened',
  neutral: 'Neutral',
  unchanged: 'Unchanged',
  success: 'Success',
  failure: 'Failure',
}

const EXPEDITION_OUTCOME_LABELS: Record<string, string> = {
  success: 'Success',
  partial_success: 'Partial success',
  failure: 'Failure',
  runner_lost: 'Runner lost',
  delayed: 'Delayed',
  ambushed: 'Ambushed',
  empty_handed: 'Empty-handed',
  returned: 'Returned',
}

const AREA_FIELD_LABELS: Record<string, string> = {
  condition: 'condition',
  cleanliness: 'cleanliness',
  mess: 'mess',
  damage: 'damage',
  smell: 'smell',
  risk: 'risk',
  capacity: 'capacity',
  occupancy: 'occupancy',
}

const LOG_FACET_LABELS: Record<string, string> = {
  owner_action: 'Owner action',
  staff_action: 'Staff',
  service: 'Service',
  customer_group_interaction: 'Customers',
  weekly_event: 'Weekly',
  monthly_event: 'Monthly',
  supplier_event: 'Suppliers',
  faction_event: 'Factions',
  culture_event: 'Cultures',
  regular_event: 'Regulars',
  expedition_event: 'Expeditions',
  pressure: 'Pressures',
  issue_seed: 'Incidents',
  response: 'Responses',
}

const DAY_TYPE_LABELS: Record<string, string> = {
  quiet_day: 'Quiet Day',
  supplier_day: 'Supplier Day',
  payday: 'Payday',
  market_day: 'Market Day',
  festival_eve: 'Festival Eve',
  festival_day: 'Festival Day',
  rent_day: 'Rent Day',
  inspection_day: 'Inspection Day',
}

const ACRONYM_TOKENS: Record<string, string> = {
  npc: 'NPC',
  xp: 'XP',
  ai: 'AI',
  rng: 'RNG',
  ui: 'UI',
  hp: 'HP',
}

/**
 * Convert a snake_case or camelCase id into Title Case English. Used
 * as the fallback for ids that have no registry or enum entry.
 */
export function humanizeId(id: string): string {
  if (!id) return ''
  // Split camelCase boundaries first, then handle snake_case.
  const spaced = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
  if (!spaced) return id
  const words = spaced.split(/\s+/)
  const titled = words.map((word, idx) => {
    const lower = word.toLowerCase()
    if (ACRONYM_TOKENS[lower]) return ACRONYM_TOKENS[lower]
    if (idx === 0) {
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }
    // Subsequent words: keep lowercase except acronyms. Sentence case
    // reads better than Title Case for multi-word labels like
    // "Bowl of stew".
    return lower
  })
  return titled.join(' ')
}

function registryLabel<T extends { label: string }>(
  registry: { has(id: string): boolean; get(id: string): T },
  id: string,
): string | undefined {
  if (!registry.has(id)) return undefined
  return registry.get(id).label
}

function policyLabel(id: string): string | undefined {
  // POLICY_STARTERS is keyed by both `id` and `policyType` (they are
  // identical for the starter set, but kept distinct in the schema).
  const found = POLICY_STARTERS.find(
    (p) => p.id === id || p.policyType === id,
  )
  return found?.label
}

/**
 * Resolve a player-facing label for a sim id.
 *
 * Returns the human-readable label from the matching registry or
 * static table, falling back to `humanizeId(id)` for ids that have
 * no entry. Never throws — render sites can call this with arbitrary
 * runtime strings.
 */
export function idLabel(category: IdCategory, id: string): string {
  if (!id) return ''
  switch (category) {
    case 'stock':
      return registryLabel(stockRegistry, id) ?? humanizeId(id)
    case 'recipe':
      return registryLabel(recipeRegistry, id) ?? humanizeId(id)
    case 'area':
      return registryLabel(areaRegistry, id) ?? humanizeId(id)
    case 'customerGroup':
      return registryLabel(customerRegistry, id) ?? humanizeId(id)
    case 'staffRole':
      return registryLabel(staffRegistry, id) ?? humanizeId(id)
    case 'staffPriority':
      return registryLabel(staffPriorityRegistry, id) ?? humanizeId(id)
    case 'action':
      return registryLabel(actionRegistry, id) ?? humanizeId(id)
    case 'pressure':
      return registryLabel(pressureRegistry, id) ?? humanizeId(id)
    case 'policy':
      return policyLabel(id) ?? humanizeId(id)
    case 'reputation':
      return REPUTATION_LABELS[id] ?? humanizeId(id)
    case 'projectStatus':
      return PROJECT_STATUS_LABELS[id] ?? humanizeId(id)
    case 'socialOutcome':
      return SOCIAL_OUTCOME_LABELS[id] ?? humanizeId(id)
    case 'expeditionOutcome':
      return EXPEDITION_OUTCOME_LABELS[id] ?? humanizeId(id)
    case 'areaField':
      return AREA_FIELD_LABELS[id] ?? humanizeId(id)
    case 'logFacet':
      return LOG_FACET_LABELS[id] ?? humanizeId(id)
    case 'dayType':
      return DAY_TYPE_LABELS[id] ?? humanizeId(id)
  }
}
