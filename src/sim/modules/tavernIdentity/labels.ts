// Phase 95 — Tavern-identity label tables.
//
// The `tavernIdentityModule` reads reputation, policies, and area /
// culture state to recompute the three identity arrays on state:
// `knownFor`, `houseRules`, `atmosphereTags`. These tables are the
// mapping from raw mechanical signals (axis name, policy id, condition
// key) to the short, player-facing fragments that land on state.
//
// Fragments are deliberately short, descriptive, and noun-shaped —
// they're meant to be read as a list of things the tavern *is* or
// *does*, not as prose. Stay ≤ 4 words each. No invented facts; every
// label encodes a state truth that the player can verify.
//
// The module reads only the keys present here; new policies / axes
// that should participate must be added here.

import type { ReputationState, AreaState } from '../../state/TavernState'

// ---------- Thresholds ----------

/** Minimum reputation value to count an axis as "known for". */
export const KNOWN_FOR_THRESHOLD = 50
/** Maximum `knownFor` entries written to state. */
export const KNOWN_FOR_LIMIT = 3
/** Maximum `atmosphereTags` entries written to state. */
export const ATMOSPHERE_LIMIT = 5
/** Fraction of areas crossing a condition threshold to trigger an atmosphere tag. */
export const AREA_CONDITION_FRACTION = 0.5
/** Culture-readiness thresholds for cultural atmosphere fragments. */
export const CULTURE_FAMILIARITY_MIN = 50
export const CULTURE_COMFORT_MIN = 50

// ---------- Reputation → known-for ----------

export const AXIS_KNOWN_FOR: Readonly<Record<keyof ReputationState, string>> = {
  cheap: 'cheap drinks',
  tasty: 'tasty plates',
  filthy: 'an unfussy floor',
  dangerous: 'a rough edge',
  cozy: 'a cosy corner',
  strange: 'curious offerings',
  reliable: 'reliable service',
  goblinAuthentic: 'goblin authenticity',
  respectable: 'respectable manners',
  culinary_renown: 'culinary renown',
}

// ---------- Policies → house rules ----------

/**
 * Map `policyType` (or policy id) → short imperative house-rule
 * fragment. Lookups try `policyType` first, then `id`, and finally
 * fall back to the policy's stored label.
 */
export const POLICY_HOUSE_RULE: Readonly<Record<string, string>> = {
  cheap_payday_specials: 'payday specials',
  allow_tabs_for_regulars: 'tabs for regulars',
  refuse_tabs: 'no tabs',
  ban_weapons_inside: 'no weapons indoors',
  serve_miners_discount: 'miner discount',
  water_ale_quietly: 'ale watered down',
  close_early_on_festival_eve: 'closed on festival eve',
}

// ---------- Area conditions → atmosphere fragments ----------

/**
 * The condition keys the module evaluates. For each area, the module
 * checks whether the area's matching meter exceeds (or falls below,
 * for `cleanliness`) the threshold. A fragment is emitted when the
 * fraction of triggering areas crosses `AREA_CONDITION_FRACTION`.
 */
export type AreaConditionFlag =
  | 'grimy'
  | 'damaged'
  | 'smelly'
  | 'rowdy'
  | 'cosy'
  | 'polished'

export const AREA_CONDITION_FRAGMENT: Readonly<Record<AreaConditionFlag, string>> = {
  grimy: 'grimy floors',
  damaged: 'weather-worn fittings',
  smelly: 'a pungent air',
  rowdy: 'a rowdy edge',
  cosy: 'a cosy hearth',
  polished: 'polished floors',
}

export function areaMatches(area: AreaState, flag: AreaConditionFlag): boolean {
  switch (flag) {
    case 'grimy':
      return area.cleanliness <= 40
    case 'damaged':
      return area.damage >= 50
    case 'smelly':
      return area.smell >= 50
    case 'rowdy':
      return area.risk >= 50
    case 'cosy':
      // A genuinely cosy area is clean, undamaged, and low-risk.
      return area.cleanliness >= 70 && area.damage <= 25 && area.risk <= 25
    case 'polished':
      return area.cleanliness >= 75
  }
}

// ---------- Cultures → atmosphere fragments ----------

/**
 * Culture-id specific atmosphere fragment. When the culture is
 * familiar and comfortable, the tavern picks up a tag describing the
 * crowd it welcomes. Falls back to a culture-id-derived fragment
 * when no explicit mapping exists.
 */
export const CULTURE_ATMOSPHERE_TAG: Readonly<Record<string, string>> = {
  goblin: 'goblin-flavored',
  human: 'human-friendly',
  dwarf: 'dwarf-welcoming',
  elf: 'elven-tolerant',
  orc: 'orc-tolerated',
  halfling: 'halfling-cosy',
  miner: 'miner-leaning',
  merchant: 'merchant-trusted',
}

export function cultureFragment(cultureId: string, label: string): string {
  const direct = CULTURE_ATMOSPHERE_TAG[cultureId]
  if (direct) return direct
  // Fall back to a derived fragment using the culture label, lower-cased.
  return `${label.toLowerCase()}-welcoming`
}
