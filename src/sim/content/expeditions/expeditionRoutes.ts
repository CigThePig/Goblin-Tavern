import { Registry } from '../../registries/Registry'
import type { ExpeditionTargetTier } from '../../state/TavernState'

// Expansion Phase 9 §9.3 — where an expedition actually goes.
//
// WHAT WAS BROKEN. A Phase 70 expedition had a runner, a mode, a tier and a
// day count. There was no PLACE: `daysTotal` was a number the player typed,
// danger was a constant, and the only thing distinguishing a three-day trip
// from a twelve-day one was how long you waited for the same single roll.
//
// A route is the decision that makes the rest of §9.3 mean anything. It sets
// how far out the party goes (so a recall has a cost measured in days), how
// dangerous the going is (so supplies and gear matter), what can be found
// there (so the target is a consequence of where you sent them rather than a
// wish), how fast word gets home (so information is genuinely delayed), and
// which events can happen at all (so a marsh reads differently from a road).
//
// `unlockedBy` is §9.3's "future opportunities": the deep route is not on
// the board until an expedition has come back from the scree with word of a
// way down. You cannot buy your way there; somebody has to find it.

export type ExpeditionTerrain = 'road' | 'forest' | 'marsh' | 'mountain' | 'deep'

export type ExpeditionRoute = {
  id: string
  label: string
  /** One line the commission form and the report can both print. */
  readable: string
  terrain: ExpeditionTerrain
  /** Legs out. The party walks each leg out and again on the way back. */
  legs: number
  daysPerLeg: number
  /** 0..100. Drives event severity, injury odds and the loss ladder. */
  danger: number
  /** What can be found here at all. A wish for something else is refused. */
  yields: ExpeditionTargetTier[]
  /** Multiplies the haul. Far and dangerous pays better. */
  haulBonus: number
  /** Provisions a party of one burns per day here. */
  provisionsPerDay: number
  /** Days before word of anything reaches the tavern. */
  wordDelayDays: number
  /** Event ids that can fire here, beyond the ones any terrain allows. */
  localEventIds: string[]
  /** A discovery id another route's expedition must have brought back. */
  unlockedBy?: string
  /** Discovery this route can turn up, which unlocks something else. */
  discovers?: string
}

export const expeditionRouteRegistry = new Registry<ExpeditionRoute>()

export const EXPEDITION_ROUTES: ExpeditionRoute[] = [
  {
    id: 'market_road',
    label: 'The Market Road',
    readable: 'Two days out along a road with traffic on it. Nothing rare, nothing fatal.',
    terrain: 'road',
    legs: 1,
    daysPerLeg: 2,
    danger: 15,
    yields: ['uncommon'],
    haulBonus: 1,
    provisionsPerDay: 1,
    wordDelayDays: 0,
    localEventIds: ['a_local_guide', 'bandits_on_the_road'],
  },
  {
    id: 'oldwood_verge',
    label: 'The Oldwood Verge',
    readable: 'The near edge of the forest. Good foraging, and the trail is easy to lose.',
    terrain: 'forest',
    legs: 2,
    daysPerLeg: 2,
    danger: 32,
    yields: ['uncommon', 'rare'],
    haulBonus: 1.15,
    provisionsPerDay: 1,
    wordDelayDays: 1,
    localEventIds: ['lost_the_trail', 'a_rich_seam'],
  },
  {
    id: 'deep_fen',
    label: 'The Deep Fen',
    readable: 'Marsh, four days in. Everything worth having grows where the ground will not hold you.',
    terrain: 'marsh',
    legs: 2,
    daysPerLeg: 3,
    danger: 55,
    yields: ['rare'],
    haulBonus: 1.35,
    provisionsPerDay: 2,
    wordDelayDays: 2,
    localEventIds: ['sickness_in_the_party', 'washed_out_crossing', 'a_rich_seam'],
  },
  {
    id: 'broken_scree',
    label: 'The Broken Scree',
    readable: 'Up into the rockfall country. Hard walking, and people have come back rich from it.',
    terrain: 'mountain',
    legs: 3,
    daysPerLeg: 2,
    danger: 62,
    yields: ['rare', 'legendary'],
    haulBonus: 1.4,
    provisionsPerDay: 2,
    wordDelayDays: 2,
    localEventIds: ['bad_weather', 'a_rich_seam'],
    discovers: 'a_way_down',
  },
  {
    id: 'the_underdeep',
    label: 'The Underdeep',
    readable: 'Down through the way somebody found in the scree. Nobody sensible goes twice.',
    terrain: 'deep',
    legs: 3,
    daysPerLeg: 3,
    danger: 82,
    yields: ['legendary'],
    haulBonus: 1.8,
    provisionsPerDay: 2,
    wordDelayDays: 4,
    localEventIds: ['something_in_the_dark', 'a_rich_seam'],
    // §9.3 "future opportunities": not on the board until somebody has
    // come back from the scree knowing where the way down is.
    unlockedBy: 'a_way_down',
  },
]

let initialized = false

export function ensureExpeditionRoutesRegistered(): void {
  if (initialized) return
  for (const route of EXPEDITION_ROUTES) {
    if (!expeditionRouteRegistry.has(route.id)) {
      expeditionRouteRegistry.register(route)
    }
  }
  initialized = true
}

ensureExpeditionRoutesRegistered()

/** Total days there and back, before any delay. */
export function routeTravelDays(route: ExpeditionRoute): number {
  return route.legs * route.daysPerLeg * 2
}

/**
 * Provisions a party of `size` needs to make the round trip comfortably.
 *
 * The `+ 1` is the working day at the site, and it is load-bearing rather
 * than a rounding nicety: without it the DEFAULT loadout — the one a player
 * who does not engage with supplies gets — runs out on the last day of every
 * trip, which would make short rations a property of the game rather than a
 * choice the player made.
 */
export function routeProvisionsNeeded(
  route: ExpeditionRoute,
  partySize: number,
): number {
  // Travel days, plus the working day at the site, plus the day they walk
  // back through the door still eating. All three are days the party is on
  // the house's provisions, and a default that misses any of them means a
  // player who engaged with nothing still goes hungry — which would make
  // short rations a property of the game rather than a choice.
  //
  // Plus slack for the road itself. A journey is not a schedule: weather,
  // washouts and a party stood still waiting on an answer all cost days, and
  // a default loadout with no slack in it meant the FIRST event on any trip
  // started the party starving. That put hunger — and the morale collapse
  // and retreat behind it — on almost every expedition regardless of what
  // the player chose, which is the same "property of the game rather than a
  // choice" problem one step along. The dangerous routes get more slack
  // because they are where the delays are.
  const slack = Math.ceil(route.danger / 30)
  return (
    (routeTravelDays(route) + 2 + slack) *
    route.provisionsPerDay *
    Math.max(1, partySize)
  )
}
