import { Registry } from '../../registries/Registry'
import type { MonthModifierId } from '../../modules/monthly/types'

// Expansion Phase 9 §9.4 — a month modifier becomes a process.
//
// WHAT WAS BROKEN. A modifier was a label, three tags and a sentence. Once a
// month one was drawn, and for the next twenty-eight days it subtracted one
// point from a roof, or added one to a cellar's smell. `tax_month` had a
// single month-end twist. That was the whole of it: no source, no warning,
// no duration worth the name, no way to act on it, nothing left behind when
// it stopped.
//
// §9.4 lists seven things each modifier needs — source, forecast, duration,
// affected systems, counterplay, accumulated consequences, and a report and
// history. This file is where six of the seven are declared, because they
// are properties of the CONDITION rather than of the engine that runs it:
// where it comes from, how far ahead it can be seen, how long it lasts, what
// it touches, what the house can do about it, and what it leaves behind.
//
// THE ACCUMULATION IS THE POINT. A condition no longer nudges a meter and
// forgets. It builds a BURDEN day by day — water in the roof timbers, spores
// in the cellar, breakage in the main room, an unpaid assessment — and the
// burden is what the counterplay is fighting. Whatever is still standing
// when the condition ends is what it leaves behind. So a rainy month you
// ignored is a different tavern from a rainy month you worked through, which
// is exactly what "small daily nudges" could never express.

export type ConditionSourceKind =
  | 'weather'
  | 'season'
  | 'authority'
  | 'community'
  | 'trade'
  | 'infestation'

/**
 * Where a condition comes from.
 *
 * §9.4 asks for a source, and the useful reading of that is "somebody or
 * something the house can name". Rain comes off the sky; a levy comes from
 * the crown's assessor; a festival is called by people who live here. It
 * matters because it is the difference between a condition happening TO the
 * tavern and a condition happening in a world the tavern is part of — and
 * because a named source is something the forecast can be attributed to.
 */
export type ConditionSource = {
  kind: ConditionSourceKind
  /** Who or what brings it. Printed in the forecast and the history. */
  actor: string
  /** How the house first hears of it. */
  readable: string
}

/** How the burden is paid out when the condition ends with it still standing. */
export type ConditionAftermathKind =
  | 'area_damage'
  | 'area_smell_and_risk'
  | 'stock_spoilage'
  | 'staff_stress'
  | 'coin_assessment'
  | 'lost_trade'
  | 'renown_swing'

export type ConditionAftermath = {
  kind: ConditionAftermathKind
  /** The area / stock / reputation axis the aftermath lands on, if any. */
  targetId?: string
  /**
   * Burden per point of consequence. A `severityDivisor` of 4 means a
   * burden of 60 becomes 15 points of damage.
   */
  severityDivisor: number
  /** Below this burden the condition ends clean and leaves no scar. */
  cleanBelow: number
  /** One line the history and the report can both print. */
  readable: string
}

export type ConditionCounterplayKind = 'prepare' | 'counter' | 'exploit'

/**
 * A move the house can make.
 *
 * Three shapes, and the difference between them is WHEN and WHY. `prepare`
 * is only available against a FORECAST — it is the reward for having been
 * told in advance, and it is worth more per coin than anything available
 * once the weather is already on you. `counter` works the burden down while
 * the condition runs. `exploit` is the other half of §9.4's counterplay:
 * some conditions are opportunities, and a festival you did nothing with is
 * as much a miss as a leak you did not fix.
 */
export type ConditionCounterplay = {
  kind: ConditionCounterplayKind
  id: string
  label: string
  /** What it costs in coin. Time is charged by the owner action. */
  coinCost: number
  /** Burden removed now (counter), or burden-rate reduction (prepare). */
  strength: number
  readable: string
}

/**
 * Days between two goes at working a condition down.
 *
 * Countering is REPEATABLE, and it has to be. A once-per-run counter made a
 * fortnight of rain a single purchase — you bought the fix, and after that
 * the condition ran unopposed to whatever ceiling it wanted. Repeatable
 * with a cooldown makes it what it should have been all along: upkeep. A
 * house that keeps at it walks away owing nothing; a house that does it once
 * and forgets still ends up with a wet roof.
 *
 * Preparing and exploiting stay once-per-run, because they are decisions
 * rather than labour — you cannot prepare twice for the same rain.
 */
export const COUNTER_COOLDOWN_DAYS = 4

export type WorldConditionDefinition = {
  id: MonthModifierId
  /** The one line the forecast prints before anybody has seen it. */
  omen: string
  source: ConditionSource
  /** Systems this condition touches. Declared so the report can say. */
  affects: string[]
  /** How long it runs once it starts, in days. */
  minDays: number
  maxDays: number
  /** How far ahead word of it can reach the house. */
  forecastLeadDays: number
  /** Burden added per day it runs unopposed, 0..100 scale. */
  burdenPerDay: number
  /** What it leaves behind if the burden is still standing at the end. */
  aftermath: ConditionAftermath
  counterplay: ConditionCounterplay[]
  /**
   * A condition can also arise because the tavern's own state invited it.
   *
   * §9.4 asks for a SOURCE, and "the dice said so" is the weakest possible
   * answer. A cellar left damp and filthy grows mould whether or not the
   * calendar drew mould this month; a house with a name gets the adventurer
   * traffic. When the precondition is met the condition can start on its own
   * alongside the month's headline one, which is what makes the source real
   * rather than a caption on a random draw.
   */
  arisesWhen?: 'damp_cellar' | 'renowned_house' | 'rival_holds_the_roads'
}

/**
 * Days after a condition ends before the same one can be forecast again.
 *
 * Without it the state-driven conditions ate the world: a cellar that grew
 * mould came out of it with its smell at 100, which is exactly the
 * precondition that invited the mould, so the next forecast was mould again
 * and the tavern spent a year in a single condition. The cooldown does not
 * let the house off — a filthy cellar still grows mould again — it just puts
 * a month between the bouts, which is long enough to clean it in.
 */
export const CONDITION_REPEAT_COOLDOWN_DAYS = 30

export const worldConditionRegistry = new Registry<WorldConditionDefinition>()

export const WORLD_CONDITIONS: WorldConditionDefinition[] = [
  {
    id: 'rainy_month',
    omen: 'The air has that weight to it. Rain is coming and it means to stay.',
    source: {
      kind: 'weather',
      actor: 'the weather',
      readable: 'Carters coming up from the coast say it has not stopped down there.',
    },
    affects: ['areas.roof', 'areas.cellar', 'customers.traffic'],
    minDays: 10,
    maxDays: 20,
    forecastLeadDays: 4,
    burdenPerDay: 5,
    aftermath: {
      kind: 'area_damage',
      targetId: 'roof',
      severityDivisor: 4,
      cleanBelow: 20,
      readable: 'The roof took the whole of it and the timbers have gone soft.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'pitch_the_roof',
        label: 'Pitch and tar the roof',
        coinCost: 45,
        strength: 60,
        readable: 'Tar over the worst of the shingles before the first of it lands.',
      },
      {
        kind: 'counter',
        id: 'bail_and_patch',
        label: 'Bail out and patch',
        coinCost: 12,
        strength: 22,
        readable: 'Buckets under the drips and a board over the gap, again.',
      },
    ],
  },
  {
    id: 'festival_month',
    omen: 'They are talking about the festival already. It will be a fortnight of it.',
    source: {
      kind: 'community',
      actor: 'the quarter',
      readable: 'The festival committee has been round posting the dates.',
    },
    affects: ['areas.main_room', 'customers.traffic', 'reputation', 'staff.stress'],
    minDays: 8,
    maxDays: 14,
    forecastLeadDays: 6,
    burdenPerDay: 5,
    aftermath: {
      kind: 'staff_stress',
      severityDivisor: 5,
      cleanBelow: 25,
      readable: 'The house ran a fortnight of crowds on the same tired staff.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'lay_in_for_the_crowds',
        label: 'Lay in for the crowds',
        coinCost: 40,
        strength: 55,
        readable: 'Extra hands spoken for and the cellar stacked before it starts.',
      },
      {
        kind: 'counter',
        id: 'rotate_the_shifts',
        label: 'Rotate the shifts',
        coinCost: 14,
        strength: 20,
        readable: 'Split the long nights so nobody works the whole fortnight.',
      },
      {
        kind: 'exploit',
        id: 'throw_in_with_the_festival',
        label: 'Throw in with the festival',
        coinCost: 30,
        strength: 40,
        readable: 'Put the house name on the festival and take the trade that follows.',
      },
    ],
  },
  {
    id: 'tax_month',
    omen: 'The assessor has been seen in the quarter with a ledger under his arm.',
    source: {
      kind: 'authority',
      actor: "the crown's assessor",
      readable: 'A notice has been nailed up: assessments this season, houses included.',
    },
    affects: ['coin', 'monthly.rent', 'landlord'],
    minDays: 7,
    maxDays: 12,
    forecastLeadDays: 8,
    burdenPerDay: 7,
    aftermath: {
      kind: 'coin_assessment',
      severityDivisor: 2,
      cleanBelow: 10,
      readable: 'The assessment came in and the house had nothing set aside for it.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'set_aside_for_the_levy',
        label: 'Set coin aside for the levy',
        coinCost: 60,
        strength: 70,
        readable: 'Money put by before the assessor gets to this end of the street.',
      },
      {
        kind: 'counter',
        id: 'pay_on_account',
        label: 'Pay on account',
        coinCost: 25,
        strength: 30,
        readable: 'Part of it paid over now, which the assessor writes down.',
      },
    ],
  },
  {
    id: 'mold_bloom',
    omen: 'There is a smell starting in the cellar that was not there last week.',
    source: {
      kind: 'infestation',
      actor: 'the damp',
      readable: 'It comes up through the cellar floor when the ground stays wet.',
    },
    affects: ['areas.cellar', 'stock.spoilage', 'inspection'],
    minDays: 9,
    maxDays: 16,
    forecastLeadDays: 3,
    burdenPerDay: 6,
    aftermath: {
      kind: 'stock_spoilage',
      severityDivisor: 5,
      cleanBelow: 20,
      readable: 'Whatever was in the cellar took the spores with it.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'lime_the_cellar',
        label: 'Lime the cellar',
        coinCost: 35,
        strength: 60,
        readable: 'Lime wash on the walls before the bloom takes hold properly.',
      },
      {
        kind: 'counter',
        id: 'scrub_it_back',
        label: 'Scrub it back',
        coinCost: 10,
        strength: 20,
        readable: 'Everything out, everything scrubbed, everything back again.',
      },
    ],
    arisesWhen: 'damp_cellar',
  },
  {
    id: 'quiet_roads',
    omen: 'Word is the roads are empty. Nobody is moving and nobody is coming.',
    source: {
      kind: 'trade',
      actor: 'the roads',
      readable: 'The carters are not running. Whatever the reason, nothing is arriving.',
    },
    affects: ['customers.traffic', 'suppliers', 'staff.stress'],
    minDays: 10,
    maxDays: 18,
    forecastLeadDays: 5,
    burdenPerDay: 5,
    aftermath: {
      kind: 'lost_trade',
      severityDivisor: 6,
      cleanBelow: 25,
      readable: 'A month of empty roads and the regulars got out of the habit.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'stock_deep',
        label: 'Stock deep before it bites',
        coinCost: 35,
        strength: 50,
        readable: 'Buy while there is still anything on the road to buy.',
      },
      {
        kind: 'counter',
        id: 'send_word_out',
        label: 'Send word out',
        coinCost: 10,
        strength: 18,
        readable: 'Somebody walking the lanes reminding people the house is open.',
      },
      {
        kind: 'exploit',
        id: 'court_the_locals',
        label: 'Court the locals',
        coinCost: 20,
        strength: 35,
        readable: 'Nobody is passing through, so make the house worth walking to.',
      },
    ],
    arisesWhen: 'rival_holds_the_roads',
  },
  {
    id: 'adventurer_season',
    omen: 'The season is turning and the companies will be moving through again.',
    source: {
      kind: 'season',
      actor: 'the season',
      readable: 'Word from the guild: the companies are forming up for the season.',
    },
    affects: ['areas.main_room', 'customers.traffic', 'reputation', 'world.hireableAdventurers'],
    minDays: 14,
    maxDays: 24,
    forecastLeadDays: 7,
    burdenPerDay: 5,
    aftermath: {
      kind: 'area_damage',
      targetId: 'main_room',
      severityDivisor: 4,
      cleanBelow: 20,
      readable: 'A season of boots on the tables and the main room shows every night of it.',
    },
    counterplay: [
      {
        kind: 'prepare',
        id: 'brace_the_room',
        label: 'Brace the main room',
        coinCost: 40,
        strength: 55,
        readable: 'Heavier trestles and the good glass put away before they arrive.',
      },
      {
        kind: 'counter',
        id: 'clear_up_after_them',
        label: 'Clear up after them',
        coinCost: 12,
        strength: 20,
        readable: 'Trestles righted and the worst of the breakage put right nightly.',
      },
      {
        kind: 'exploit',
        id: 'take_the_companys_coin',
        label: "Take the company's coin",
        coinCost: 25,
        strength: 40,
        readable: 'Cut a rate with a company and let them wreck the place profitably.',
      },
    ],
    arisesWhen: 'renowned_house',
  },
]

let initialized = false

export function ensureWorldConditionsRegistered(): void {
  if (initialized) return
  for (const condition of WORLD_CONDITIONS) {
    if (!worldConditionRegistry.has(condition.id)) {
      worldConditionRegistry.register(condition)
    }
  }
  initialized = true
}

ensureWorldConditionsRegistered()

export function conditionFor(id: string): WorldConditionDefinition | undefined {
  return worldConditionRegistry.has(id) ? worldConditionRegistry.get(id) : undefined
}

export function counterplayFor(
  id: string,
  counterplayId: string,
): ConditionCounterplay | undefined {
  return conditionFor(id)?.counterplay.find((entry) => entry.id === counterplayId)
}
