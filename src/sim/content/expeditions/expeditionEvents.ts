import { Registry } from '../../registries/Registry'
import type { ExpeditionTerrain } from './expeditionRoutes'

// Expansion Phase 9 §9.3 — the things that happen between setting out and
// coming home.
//
// WHAT WAS BROKEN. Everything about a Phase 70 expedition happened in one
// `rollOutcome` call on the last day. The days in between were a counter.
// §9.3 asks for "intermediate seeded events" and "risk/reward decisions",
// and the two are the same requirement seen from either end: an event is
// only interesting if the player can do something about it, and a decision
// is only a decision if it arrives while there is still road left.
//
// SO EVERY EVENT EITHER RESOLVES ITSELF OR ASKS. The self-resolving ones
// are weather and luck — the party deals with them and word comes home
// afterwards. The asking ones open a `pendingDecision` with a deadline; if
// nobody answers in time the party takes the default, which is always the
// cautious option. That is what makes delayed information cost something:
// a route four days from home means the question reaches you late and your
// answer reaches them later still.
//
// BOUNDED. §9.3 says "keep event count bounded", and the bound is
// `MAX_EXPEDITION_EVENTS` — four. The cap is on the expedition, not on the
// day, so a long route is not a longer story, it is a riskier one.

/** The most events any single expedition can generate. §9.3 bound. */
export const MAX_EXPEDITION_EVENTS = 4

export type ExpeditionEventEffects = {
  /** Provisions burned beyond the daily rate. */
  supplies?: number
  /** Party spirits, 0..100. Low morale turns into a retreat. */
  morale?: number
  /** Extra days added to the current leg. */
  delayDays?: number
  /** 0..1 chance one party member is hurt. */
  injuryChance?: number
  /** Accumulated danger, 0..100. High hazard is how a party is lost. */
  hazard?: number
  /** Multiplier applied to the haul at the end. */
  haulBonus?: number
  /** Coin the party spends on the road, billed to the house. */
  coinCost?: number
}

export type ExpeditionEventOption = {
  id: string
  label: string
  /** What the party does, in their words, when this is chosen. */
  readable: string
  effects: ExpeditionEventEffects
  /** Provisions this option needs. Unaffordable options are not offered. */
  requiresSupplies?: number
  /** Choosing this turns the party around. */
  retreats?: boolean
}

export type ExpeditionEventDefinition = {
  id: string
  label: string
  /** What happened, as the dispatch will report it. */
  readable: string
  /** Terrains this can happen in. Empty means anywhere. */
  terrains?: ExpeditionTerrain[]
  /** Route danger floor. */
  minDanger?: number
  /** Only on the way out, only at the site, or only coming back. */
  phases?: Array<'outbound' | 'at_site' | 'returning'>
  /** Relative likelihood among the events eligible on a given day. */
  weight: number
  /** What happens with no decision to make. */
  effects?: ExpeditionEventEffects
  /** The question put to the house. */
  decision?: {
    prompt: string
    /** Days the party will wait for an answer before acting themselves. */
    waitDays: number
    options: ExpeditionEventOption[]
    /** Taken when nobody answers in time. Always the cautious one. */
    defaultOptionId: string
  }
}

export const expeditionEventRegistry = new Registry<ExpeditionEventDefinition>()

export const EXPEDITION_EVENTS: ExpeditionEventDefinition[] = [
  // ---- self-resolving: weather, luck, the going -------------------------
  {
    id: 'bad_weather',
    label: 'Bad weather',
    readable: 'The weather closed in and they sat it out.',
    weight: 3,
    effects: { delayDays: 1, supplies: 1, morale: -8 },
  },
  {
    id: 'a_local_guide',
    label: 'A local guide',
    readable: 'Somebody who knew the ground walked with them a while.',
    terrains: ['road', 'forest'],
    weight: 2,
    effects: { delayDays: -1, morale: 6, coinCost: 8 },
  },
  {
    id: 'lost_the_trail',
    label: 'Lost the trail',
    readable: 'They lost the trail and spent a day finding it again.',
    terrains: ['forest', 'marsh', 'deep'],
    weight: 3,
    effects: { delayDays: 1, supplies: 1, morale: -6, hazard: 6 },
  },
  {
    id: 'washed_out_crossing',
    label: 'A washed-out crossing',
    readable: 'The crossing was gone and they went the long way round.',
    terrains: ['marsh', 'forest'],
    weight: 2,
    effects: { delayDays: 2, supplies: 2, hazard: 8 },
  },

  // ---- decisions: the risk/reward half ---------------------------------
  {
    id: 'a_rich_seam',
    label: 'Something worth more than they were sent for',
    readable: 'They found something better than what they were sent for.',
    phases: ['at_site'],
    weight: 3,
    decision: {
      prompt: 'There is more here than the commission asked for. Do they stay for it?',
      waitDays: 3,
      defaultOptionId: 'take_what_we_came_for',
      options: [
        {
          id: 'stay_and_work_it',
          label: 'Stay and work it',
          readable: 'They stayed on and worked it properly.',
          effects: { delayDays: 2, supplies: 2, hazard: 12, haulBonus: 0.5, morale: 5 },
          requiresSupplies: 2,
        },
        {
          id: 'take_what_we_came_for',
          label: 'Take what they came for and go',
          readable: 'They took what they came for and left the rest.',
          effects: { morale: -4 },
        },
      ],
    },
  },
  {
    id: 'bandits_on_the_road',
    label: 'Bandits on the road',
    readable: 'There were men on the road who wanted paying.',
    terrains: ['road', 'forest'],
    weight: 2,
    decision: {
      prompt: 'There are men on the road who want paying. Pay them, or go round?',
      waitDays: 2,
      defaultOptionId: 'go_the_long_way',
      options: [
        {
          id: 'pay_them_off',
          label: 'Pay them off',
          readable: 'They paid, and were let through.',
          effects: { coinCost: 30, morale: -5 },
        },
        {
          id: 'go_the_long_way',
          label: 'Go the long way',
          readable: 'They went round, and it cost them two days.',
          effects: { delayDays: 2, supplies: 2, morale: -3 },
        },
        {
          id: 'go_through_them',
          label: 'Go through them',
          readable: 'They went through, and not everybody came out of it well.',
          effects: { injuryChance: 0.5, hazard: 20, morale: 8 },
        },
      ],
    },
  },
  {
    id: 'sickness_in_the_party',
    label: 'Sickness in the party',
    readable: 'Somebody went down with a fever.',
    minDanger: 40,
    weight: 3,
    decision: {
      prompt: 'One of them is ill. Push on, or turn back?',
      waitDays: 2,
      defaultOptionId: 'turn_back',
      options: [
        {
          id: 'use_the_medicine',
          label: 'Use the medicine',
          readable: 'They used what medicine they had and carried on.',
          effects: { morale: 4 },
          requiresSupplies: 0,
        },
        {
          id: 'push_on_regardless',
          label: 'Push on regardless',
          readable: 'They pushed on, and it told on them.',
          effects: { injuryChance: 0.6, hazard: 18, morale: -10 },
        },
        {
          id: 'turn_back',
          label: 'Turn back',
          readable: 'They turned back with what little they had.',
          effects: { morale: -6 },
          retreats: true,
        },
      ],
    },
  },
  {
    id: 'something_in_the_dark',
    label: 'Something in the dark',
    readable: 'There was something down there with them.',
    terrains: ['deep', 'mountain'],
    minDanger: 55,
    weight: 4,
    decision: {
      prompt: 'There is something down there with them. Press on, or come out?',
      waitDays: 1,
      defaultOptionId: 'come_out',
      options: [
        {
          id: 'press_on',
          label: 'Press on',
          readable: 'They pressed on past it.',
          effects: { injuryChance: 0.45, hazard: 30, haulBonus: 0.6, morale: -8 },
        },
        {
          id: 'come_out',
          label: 'Come out',
          readable: 'They came out rather than find out what it was.',
          effects: { morale: -4 },
          retreats: true,
        },
      ],
    },
  },
]

let initialized = false

export function ensureExpeditionEventsRegistered(): void {
  if (initialized) return
  for (const definition of EXPEDITION_EVENTS) {
    if (!expeditionEventRegistry.has(definition.id)) {
      expeditionEventRegistry.register(definition)
    }
  }
  initialized = true
}

ensureExpeditionEventsRegistered()
