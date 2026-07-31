import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withStock } from '../../src/sim/testing/stateFactories'
import {
  getAllSeedsToday,
  getIssueSeeds,
  getIssueSeedSlice,
} from '../../src/sim/modules/issues/issueSeedQueries'
import type {
  IssueSeed,
  ResponseSlot,
} from '../../src/sim/modules/issues/issueSeedTypes'
import {
  CONTINUATION_CHOICE_CAP,
  FAMILY_STREAK_LIMIT,
  FULL_DAY_CARD_CEILING,
  FULL_DAY_CHOICE_CEILING,
  isUrgentSeed,
  RENDERED_CHOICE_CAP_PER_CARD,
  renderedChoiceCost,
  selectVisibleHand,
} from '../../src/sim/modules/issues/handBudget'
import {
  MATERIAL_SEVERITY_RISE,
  materiallyWorsened,
  shouldRestFamily,
  threadKeyForSeed,
} from '../../src/sim/modules/issues/issueThreads'
import { recipeRegistry } from '../../src/sim/registries/recipeRegistry'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 205 / audit Wave 6 — `P5-PLAY-005` (stock-shortage cards invent
// demand for unused zero-stock items) and the simulation half of
// `P7-EXP-005` (full-day attention load and family repetition).
//
// Plan: docs/plans/phase-205-audit-wave-6-issue-relevance-and-attention-load.md
// Findings: reports/…PHASE_05… §6 and reports/…PHASE_07… §7.
//
// Both were reproduced against the pre-fix build first. The audit's own
// route — commons drained to just below the low-stock threshold — put
// `bog truffle sales heavy this week` / `Bog Truffle may run out` on a
// card for an item at quantity 0, off-menu, never served, on day 5; and
// the 28-day passive run exposed 7 cards / 35 rendered choices on its
// worst day with four families running 25–27 consecutive days.

const SEED = 'phase205-wave6'

function run(state: TavernState, days: number): TavernState {
  let current = state
  for (let i = 0; i < days; i += 1) {
    current = simulateDay(current, { seed: SEED }, FULL_PIPELINE).state
  }
  return current
}

/** The stock item a shortage seed is about, read from the contract the
 *  restock slot declares rather than from prose. */
function shortageTargetId(seed: IssueSeed): string | undefined {
  for (const profile of seed.consequenceProfiles) {
    for (const effect of profile.immediateEffects) {
      const match = /^stock\.([a-z_]+)\.quantity$/.exec(effect.target)
      if (match) return match[1]
    }
  }
  return undefined
}

/** Does any recipe that consumes `stockId` give the sim a reason to
 *  believe the item is wanted? Mirrors the demand gate's question from
 *  the outside: on the menu, or served in the recent past. */
function hasDemandSignal(state: TavernState, stockId: string): boolean {
  for (const def of recipeRegistry.all()) {
    if (!def.inputs.some((input) => input.ingredientId === stockId)) continue
    const recipe = state.recipes[def.id]
    if (!recipe) continue
    if (recipe.onMenu) return true
    if (recipe.lastServedDay !== null && recipe.daysSinceLastServed <= 7) {
      return true
    }
  }
  const shortages =
    (state.modules.stock as { shortages?: Array<{ stockId: string }> })
      ?.shortages ?? []
  return shortages.some((entry) => entry.stockId === stockId)
}

describe('Phase 205 / Wave 6 — P5-PLAY-005 shortage demand truth', () => {
  it('never targets an off-menu, never-served item, however empty it is', () => {
    // The audit's route: every common item drained to just under the
    // low-stock threshold, so `30 - quantity` scoring hands the day to a
    // rare ingredient sitting at its registry default of zero.
    let state = createInitialTavernState()
    state = withStock(state, 'ale', { quantity: 26 })
    state = withStock(state, 'stew', { quantity: 28 })
    state = withStock(state, 'mushrooms', { quantity: 24 })

    const targets: string[] = []
    for (let day = 0; day < 10; day += 1) {
      state = run(state, 1)
      for (const seed of getIssueSeeds(state, { family: 'stock_shortage' })) {
        const target = shortageTargetId(seed)
        expect(target).toBeDefined()
        targets.push(target!)
        expect(hasDemandSignal(state, target!)).toBe(true)
      }
    }
    // The route must still produce shortage cards — the gate is about
    // truthfulness, not about silencing the family.
    expect(targets.length).toBeGreaterThan(0)
    expect(targets).not.toContain('bog_truffle')
    expect(targets).not.toContain('frost_cap_mushroom')
  })

  it('does not claim recent sales for an item that has never sold', () => {
    let state = createInitialTavernState()
    state = withStock(state, 'ale', { quantity: 26 })
    state = withStock(state, 'stew', { quantity: 28 })
    state = withStock(state, 'mushrooms', { quantity: 24 })

    for (let day = 0; day < 10; day += 1) {
      state = run(state, 1)
      for (const seed of getIssueSeeds(state, { family: 'stock_shortage' })) {
        const target = shortageTargetId(seed)!
        const served = recipeRegistry
          .all()
          .filter((def) =>
            def.inputs.some((input) => input.ingredientId === target),
          )
          .some((def) => (state.recipes[def.id]?.timesServed ?? 0) > 0)
        const context = (seed.textIngredients.recentContext ?? []).join(' ')
        if (!served) {
          expect(context).not.toMatch(/sales heavy/i)
        }
      }
    }
  })

  it('distinguishes an item already out from one running low', () => {
    // The morning pass reads the stock the day STARTS with, and service
    // drains what it can sell — so the quantity under test has to be set
    // on the state that goes into the day being measured, not before a
    // warm-up day that would empty it first.
    const warm = withStock(createInitialTavernState(), 'ale', { quantity: 8 })
    const warmed = run(warm, 1)

    // Keep the other demanded staples above the shortage threshold so this
    // wording test isolates ale instead of depending on which equally real
    // shortage happens to win the rotation score that day.
    const onlyAleCanBeShort = (state: TavernState, quantity: number) =>
      withStock(
        withStock(
          withStock(state, 'ale', { quantity }),
          'stew',
          { quantity: 100 },
        ),
        'mushrooms',
        { quantity: 100 },
      )

    const empty = run(onlyAleCanBeShort(warmed, 0), 1)
    const emptySeeds = getIssueSeeds(empty, { family: 'stock_shortage' })
    expect(emptySeeds.length).toBeGreaterThan(0)
    const outSeed = emptySeeds.find((s) => shortageTargetId(s) === 'ale')
    expect(outSeed).toBeDefined()
    const outStakes = outSeed!.stakes.map((s) => s.readable).join(' | ')
    expect(outStakes).toMatch(/has run out/i)
    expect(outStakes).not.toMatch(/may run out/i)
    expect(outSeed!.toneHints).toContain('already_out')

    const low = run(onlyAleCanBeShort(warmed, 12), 1)
    const lowSeed = getIssueSeeds(low, { family: 'stock_shortage' }).find(
      (s) => shortageTargetId(s) === 'ale',
    )
    expect(lowSeed).toBeDefined()
    const lowStakes = lowSeed!.stakes.map((s) => s.readable).join(' | ')
    expect(lowStakes).toMatch(/may run out/i)
    expect(lowSeed!.toneHints).not.toContain('already_out')
  })
})

describe('Phase 205 / Wave 6 — P7-EXP-005 attention load', () => {
  it('bounds the visible hand and the day ledger at the approved ceiling', () => {
    let state = createInitialTavernState()
    const handSizes: number[] = []
    const ledgerSizes: number[] = []
    const overCeilingWereUrgent: boolean[] = []

    for (let day = 0; day < 20; day += 1) {
      state = run(state, 1)
      const slice = getIssueSeedSlice(state)!
      handSizes.push(slice.seedsToday.length)
      const ledger = slice.surfacedToday ?? []
      ledgerSizes.push(ledger.length)
      if (ledger.length > FULL_DAY_CARD_CEILING) {
        // Only an urgent Service incident may push the day's exposure
        // past the ceiling, and only by displacing a card from the hand.
        overCeilingWereUrgent.push(ledger.some((seed) => isUrgentSeed(seed)))
      }
      const cost = ledger.reduce(
        (total, seed) => total + renderedChoiceCost(seed),
        0,
      )
      // Same allowance as the card ceiling: an urgent incident admitted
      // by displacing an already-read card cannot un-spend that card's
      // buttons, so the day can run one card's worth over — and only
      // then.
      const allowance = ledger.some((seed) => isUrgentSeed(seed))
        ? RENDERED_CHOICE_CAP_PER_CARD + 1
        : 0
      expect(cost).toBeLessThanOrEqual(FULL_DAY_CHOICE_CEILING + allowance)
    }

    expect(Math.max(...handSizes)).toBeLessThanOrEqual(FULL_DAY_CARD_CEILING)
    expect(Math.max(...ledgerSizes)).toBeLessThanOrEqual(
      FULL_DAY_CARD_CEILING + 1,
    )
    expect(overCeilingWereUrgent.every(Boolean)).toBe(true)
    // The route must still have a real hand — the ceiling is a bound, not
    // a target of zero.
    expect(Math.max(...handSizes)).toBeGreaterThan(1)
  })

  it('rests a family after the consecutive-day limit unless it worsens', () => {
    let state = createInitialTavernState()
    const perDay: Array<Map<string, number>> = []
    for (let day = 0; day < 24; day += 1) {
      state = run(state, 1)
      const exposed = getIssueSeedSlice(state)?.surfacedToday ?? []
      const byFamily = new Map<string, number>()
      for (const seed of exposed) {
        byFamily.set(
          seed.family,
          Math.max(byFamily.get(seed.family) ?? -Infinity, seed.severity),
        )
      }
      perDay.push(byFamily)
    }

    const families = new Set(perDay.flatMap((day) => [...day.keys()]))
    for (const family of families) {
      let streak = 0
      let previousSeverity: number | undefined
      for (const day of perDay) {
        const severity = day.get(family)
        if (severity === undefined) {
          streak = 0
          previousSeverity = undefined
          continue
        }
        streak += 1
        if (streak > FAMILY_STREAK_LIMIT) {
          expect(
            materiallyWorsened(previousSeverity!, severity),
            `family ${family} extended a ${streak}-day run without worsening (${previousSeverity} → ${severity})`,
          ).toBe(true)
        }
        previousSeverity = severity
      }
    }
  })

  it('carries continuity onto a recurring thread and trims its choices', () => {
    let state = createInitialTavernState()
    let continuation: IssueSeed | undefined
    let trimmed: IssueSeed | undefined
    for (let day = 0; day < 20 && !trimmed; day += 1) {
      state = run(state, 1)
      for (const seed of getAllSeedsToday(state)) {
        if (!seed.continuity) continue
        continuation ??= seed
        if (seed.continuity.trimmed) trimmed = seed
      }
    }

    expect(continuation, 'no recurring thread carried continuity').toBeDefined()
    const continuity = continuation!.continuity!
    expect(continuity.threadKey).toBe(threadKeyForSeed(continuation!))
    expect(continuity.timesSurfaced).toBeGreaterThanOrEqual(2)
    expect(continuity.daysStanding).toBeGreaterThanOrEqual(1)
    // Either the player answered it (and we know the label) or it is
    // explicitly unanswered — Wave 3 / DC-02 keeps those distinct.
    expect(
      continuity.unanswered || continuity.lastSelectionLabel !== undefined,
    ).toBe(true)

    expect(trimmed, 'no continuation trimmed its offered set').toBeDefined()
    const slots: ResponseSlot[] = trimmed!.responseSlots
    expect(slots.length).toBeLessThanOrEqual(CONTINUATION_CHOICE_CAP)
    // Trimming must not strand the player: an inaction option always
    // survives, and the seed stays valid (≥ 2 slots per contract §4.10).
    expect(slots.length).toBeGreaterThanOrEqual(2)
    expect(slots.some((slot) => slot.allowedVerbs.includes('ignore'))).toBe(true)
    expect(trimmed!.validation.valid).toBe(true)
    // The consequence profiles are untouched — the sim keeps the full
    // model, only the offer set narrows.
    expect(trimmed!.consequenceProfiles.length).toBeGreaterThan(slots.length)
  })

  it('rests a repeat but never a worsening one, and frees the family next day', () => {
    const streak = {
      family: 'violence',
      lastSurfacedDay: 9,
      consecutiveDays: FAMILY_STREAK_LIMIT,
      lastSeverity: 40,
    }
    const calm = { family: 'violence', severity: 40, urgency: 20 } as IssueSeed
    const urgent = { family: 'violence', severity: 40, urgency: 85 } as IssueSeed
    const worse = {
      family: 'violence',
      severity: 40 + MATERIAL_SEVERITY_RISE,
      urgency: 20,
    } as IssueSeed

    expect(shouldRestFamily(streak, calm, 10)).toBe(true)
    // Urgency is deliberately NOT an exemption here: `customer_complaint`
    // sits at urgency 80 for weeks while rotating its customer group, so
    // an urgency (or per-entity) escape reopens exactly the streak the
    // cooldown closes. Reachability is enforced at the ceiling instead —
    // see the displacement test below.
    expect(shouldRestFamily(streak, urgent, 10)).toBe(true)
    // Escalation always comes through.
    expect(shouldRestFamily(streak, worse, 10)).toBe(false)
    // After the rest day the family is free again.
    expect(shouldRestFamily(streak, calm, 11)).toBe(false)
    expect(materiallyWorsened(40, 41)).toBe(false)
    expect(materiallyWorsened(48, 52)).toBe(true)
  })

  it('never starves an urgent incident at a full ceiling', () => {
    const seed = (id: string, urgency: number, slots: number): IssueSeed =>
      ({
        id,
        family: 'customer_complaint',
        severity: 50,
        urgency,
        responseSlots: Array.from({ length: slots }, (_, i) => ({
          id: `slot_${i}`,
          labelHint: `slot ${i}`,
          allowedVerbs: i === 0 ? ['ignore'] : ['fix'],
          shape: i === 0 ? 'ignore' : 'safe_costly',
          targetOptions: [],
          expectedEffects: [],
        })),
      }) as unknown as IssueSeed

    // A full day: the ceiling's worth of exposed cards, then an urgent
    // incident arrives during Service.
    const exposed = Array.from({ length: FULL_DAY_CARD_CEILING }, (_, i) =>
      seed(`exposed_${i}`, 20, 4),
    )
    const urgent = seed('urgent', 90, 4)
    const calm = seed('calm', 20, 4)

    const result = selectVisibleHand({
      ranked: [...exposed, urgent, calm],
      exposed,
      holdServiceReserve: false,
    })
    expect(result.hand.map((s) => s.id)).toContain('urgent')
    // …by displacing a non-urgent card, not by growing the hand.
    expect(result.hand.length).toBeLessThanOrEqual(FULL_DAY_CARD_CEILING)
    // The non-urgent newcomer waits for tomorrow.
    expect(result.withheld.map((entry) => entry.seed.id)).toContain('calm')
  })
})
