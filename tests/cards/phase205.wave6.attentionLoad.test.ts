import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withStock } from '../../src/sim/testing/stateFactories'
import { getIssueSeedSlice } from '../../src/sim/modules/issues/issueSeedQueries'
import {
  FULL_DAY_CARD_CEILING,
  FULL_DAY_CHOICE_CEILING,
  isUrgentSeed,
  renderedChoiceCost,
} from '../../src/sim/modules/issues/handBudget'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { MemoryState } from '../../src/sim/modules/memories/memoryTypes'
import { pickCard } from '../../src/cards/registry'
import { evalCondition } from '../../src/cards/compose/conditions'

// Phase 205 / audit Wave 6 — the RENDERED half of `P7-EXP-005`, plus the
// time-relative title condition from `P5-PLAY-005`.
//
// The sim's ceiling is only worth anything if the card layer renders
// within it, so this file counts what the player would actually see:
// `pickCard(...).choices`, plus the renderer's generic Ignore (added by
// `CardRenderer.svelte` when no rendered choice carries the `ignore`
// verb).
//
// Pre-fix, the same 28-day passive route peaked at 7 exposed cards and
// 35 rendered choices per day (774 over 28 days) with four families
// running 25–27 consecutive days.

const SEED = 'phase205-wave6-load'
const DAYS = 28

type DayLoad = {
  day: number
  cards: number
  choices: number
  families: string[]
  urgentExposed: number
  hand: number
}

/** What the player sees for one seed: the card's own choices plus the
 *  generic Ignore the renderer adds when the card models no ignore. */
function renderedChoices(seed: IssueSeed, state: TavernState): number {
  const card = pickCard(seed, state)
  const modelsIgnore = card.choices.some((choice) => choice.verb === 'ignore')
  return card.choices.length + (modelsIgnore ? 0 : 1)
}

function memory(id: string, tags: string[], absoluteDay: number): MemoryState {
  return {
    id,
    type: 'fact',
    label: id,
    strength: 60,
    createdAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay },
    durationDays: 30,
    decayRate: 1,
    ageDays: 0,
    actors: [],
    locations: [],
    relatedSystems: [],
    tags,
  }
}

function seedsOf(state: TavernState): {
  exposed: IssueSeed[]
  hand: IssueSeed[]
} {
  const slice = getIssueSeedSlice(state)
  return {
    exposed: slice?.surfacedToday ?? [],
    hand: slice?.seedsToday ?? [],
  }
}

function passiveRun(): DayLoad[] {
  let state = createInitialTavernState()
  const load: DayLoad[] = []
  for (let day = 0; day < DAYS; day += 1) {
    state = simulateDay(state, { seed: SEED }, FULL_PIPELINE).state
    const { exposed, hand } = seedsOf(state)
    load.push({
      day: day + 1,
      cards: exposed.length,
      choices: exposed.reduce(
        (total, seed) => total + renderedChoices(seed, state),
        0,
      ),
      families: exposed.map((seed) => seed.family),
      urgentExposed: exposed.filter((seed) => isUrgentSeed(seed)).length,
      hand: hand.length,
    })
  }
  return load
}

describe('Phase 205 / Wave 6 — rendered attention load over 28 days', () => {
  const load = passiveRun()

  it('renders within the approved per-day card ceiling', () => {
    const max = Math.max(...load.map((day) => day.cards))
    const worst = load.filter((day) => day.cards > FULL_DAY_CARD_CEILING)
    // Every day past the ceiling must owe the extra card to an urgent
    // Service incident, and never more than one.
    for (const day of worst) {
      expect(day.cards, `day ${day.day}`).toBeLessThanOrEqual(
        FULL_DAY_CARD_CEILING + 1,
      )
      expect(day.urgentExposed, `day ${day.day}`).toBeGreaterThan(0)
    }
    expect(max).toBeLessThanOrEqual(FULL_DAY_CARD_CEILING + 1)
    expect(Math.max(...load.map((day) => day.hand))).toBeLessThanOrEqual(
      FULL_DAY_CARD_CEILING,
    )
  })

  it('renders within the approved per-day rendered-choice ceiling', () => {
    for (const day of load) {
      expect(day.choices, `day ${day.day}`).toBeLessThanOrEqual(
        FULL_DAY_CHOICE_CEILING,
      )
    }
    const total = load.reduce((sum, day) => sum + day.choices, 0)
    // The audit measured 891 buttons over 28 days (774 on the
    // post-Wave-5 build). The approved ceiling caps the same route well
    // below that.
    expect(total).toBeLessThanOrEqual(FULL_DAY_CHOICE_CEILING * DAYS)
    expect(total).toBeLessThan(700)
  })

  it("never lets the sim's cost estimate undercount what is rendered", () => {
    let state = createInitialTavernState()
    for (let day = 0; day < 8; day += 1) {
      state = simulateDay(state, { seed: SEED }, FULL_PIPELINE).state
      for (const seed of seedsOf(state).exposed) {
        expect(
          renderedChoiceCost(seed),
          `${seed.id} cost estimate`,
        ).toBeGreaterThanOrEqual(renderedChoices(seed, state))
      }
    }
  })

  it('keeps the day playable — cards and periodic content still arrive', () => {
    const average =
      load.reduce((sum, day) => sum + day.cards, 0) / load.length
    expect(average).toBeGreaterThan(2)
    // Teleology / periodic families must still reach the hand under the
    // ceiling (the reserve the hand budget holds for them).
    const families = new Set(load.flatMap((day) => day.families))
    expect(
      [...families].some((family) =>
        ['opening', 'venture', 'debt_rent', 'monthly_review'].includes(family),
      ),
      `families seen: ${[...families].join(', ')}`,
    ).toBe(true)
  })
})

describe('Phase 205 / Wave 6 — time-relative title conditions', () => {
  function shortageSeed(state: TavernState): IssueSeed {
    const seeds = (getIssueSeedSlice(state)?.surfacedToday ?? []).filter(
      (seed) => seed.family === 'stock_shortage',
    )
    expect(seeds.length).toBeGreaterThan(0)
    return seeds[0]!
  }

  it('cannot claim last week from a memory made this week', () => {
    let state = withStock(createInitialTavernState(), 'ale', { quantity: 12 })
    state = simulateDay(state, { seed: SEED }, FULL_PIPELINE).state
    state = {
      ...state,
      memories: [...state.memories, memory('watered_ale_recently', ['ale', 'deception'], 1)],
    }
    state = simulateDay(state, { seed: SEED }, FULL_PIPELINE).state
    // Day 2–4 of week 1: no prior week exists, so the "last week was
    // already stretched" snippet must not be reachable.
    const seed = shortageSeed(state)
    expect(state.calendar.week).toBe(1)
    expect(pickCard(seed, state).title).not.toMatch(/last week/i)
    expect(
      evalCondition(
        { kind: 'memoryPresent', tag: 'deception', minAgeDays: 7, sharesSeedTag: true },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('requires the memory to be about the item the card is about', () => {
    let state = withStock(createInitialTavernState(), 'ale', { quantity: 12 })
    for (let day = 0; day < 10; day += 1) {
      state = simulateDay(state, { seed: SEED }, FULL_PIPELINE).state
    }
    const seed = shortageSeed(state)
    const today = state.calendar.totalDaysElapsed
    const aged = today - 8

    const foreign: TavernState = {
      ...state,
      memories: [
        ...state.memories,
        memory('watered_bog_truffle_recently', ['bog_truffle', 'deception'], aged),
      ],
    }
    expect(
      evalCondition(
        { kind: 'memoryPresent', tag: 'deception', minAgeDays: 7, sharesSeedTag: true },
        seed,
        foreign,
      ),
    ).toBe(false)

    const own: TavernState = {
      ...state,
      memories: [
        ...state.memories,
        memory(
          'watered_own_recently',
          [seed.stakes[0]!.tags[0]!, 'deception'],
          aged,
        ),
      ],
    }
    expect(
      evalCondition(
        { kind: 'memoryPresent', tag: 'deception', minAgeDays: 7, sharesSeedTag: true },
        seed,
        own,
      ),
    ).toBe(true)
  })
})
