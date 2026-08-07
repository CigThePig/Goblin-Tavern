// Phase 22 §"Faction Types" / Phase 30 §30.4 — faction definition shape.
//
// Phase 30 extends the Phase 22 skeleton with `description`,
// `defaultInfluence`, `defaultTrust`, `defaultFear`, `interests`,
// `likedPolicies`, and `dislikedPolicies`. The Phase 22 `pressureTags`
// field is folded into `tags` per the Phase 30 spec — there is no
// behaviour that needs a separate `pressureTags` array; entries in
// `tags` can serve the same purpose. The Phase 22 `label` and `tags`
// field names stay stable — Phase 30 only adds, never renames.
//
// Expansion Phase 8 §8.1 adds the two fields that turn a definition into
// an ACTOR definition: who the faction speaks for, and what it is able to
// do about it.

/**
 * The bounded set of moves a faction can make.
 *
 * §8.1 asks for "support, requests, boycotts, inspections, sponsorships,
 * supply influence, protests, protection, or rival backing" — this is that
 * list, with protests folded into `call_boycott` because in a one-tavern
 * simulation they are the same move seen from different sides: the
 * faction tells its people to stay away and says why in public.
 *
 * The set is CLOSED. A faction cannot invent a move, and every id here has
 * exactly one implementation in `modules/factions/factionActors.ts` whose
 * effect is read by the domain that owns the thing it changes.
 */
export type FactionActionId =
  /** Ask the tavern for something, with a deadline the player can answer. */
  | 'make_demand'
  /** Tell its people this is the house to drink in. */
  | 'pledge_support'
  /** Tell its people to stay away, in public. */
  | 'call_boycott'
  /** Put the word in with the watch that the tavern is worth a look. */
  | 'press_inspection'
  /** Lean on the suppliers it speaks for: worse terms, less credit. */
  | 'squeeze_supply'
  /** Put money or goods in now, and expect a favour back. */
  | 'sponsor_house'
  /** Keep trouble off the floor, while the standing lasts. */
  | 'offer_protection'
  /** Throw its weight behind the competition. */
  | 'back_rival'

export const FACTION_ACTION_IDS: ReadonlyArray<FactionActionId> = [
  'make_demand',
  'pledge_support',
  'call_boycott',
  'press_inspection',
  'squeeze_supply',
  'sponsor_house',
  'offer_protection',
  'back_rival',
] as const

export type FactionDefinition = {
  id: string
  label: string
  tags: string[]
  cultureId?: string
  defaultRelationship: number
  // Phase 30 §30.4 — added fields.
  description: string
  defaultInfluence: number
  defaultTrust: number
  defaultFear: number
  interests: string[]
  likedPolicies: string[]
  dislikedPolicies: string[]
  // -- Expansion Phase 8 §8.1 — membership and capability ------------------
  /**
   * The customer groups this faction speaks for.
   *
   * §8.1's "membership or represented constituency". It is what makes a
   * boycott cost something real: the faction does not adjust a meter, it
   * keeps its own people at home, and the customers domain reads that when
   * it forecasts the day. A faction with an empty constituency (the watch,
   * the scrap haulers) still acts — it simply acts through its authority
   * rather than through a crowd.
   */
  representedGroupIds: string[]
  /**
   * The moves this faction is capable of. §8.1's "bounded action set".
   *
   * Capability is per-faction, not global: the shrine cannot order an
   * inspection and the watch cannot squeeze the ale supply, so what a
   * faction does tells you what it IS.
   */
  actions: FactionActionId[]
}
