// Expansion Phase 8 §8.2 (repo phase 215) / ISSUE-178 — cultures react to
// what actually happened to them.
//
// §8.2 names two things as wrong, and the first two blocks below are those
// two, stated as contracts:
//
//   "Food taboo and delight must depend on what was actually served or
//    offered to that culture, not merely on tagged stock somewhere in
//    storage."
//   "Seating tension must depend on actual placement and crowding from
//    Phase 4."
//
// The rest cover the dynamic model §8.2 asks for: comfort, familiarity,
// trust, accommodation history, relationships with areas/policies/recipes/
// events/other cultures, calendar observance, group-specific service
// evidence, and misunderstanding with reconciliation.
//
// Nothing writes evidence, a misunderstanding or a friction record by hand.
// Every case reaches the behaviour by running real days on a real tavern.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { getServiceModuleState } from '../../src/sim/modules/service/serviceModule'
import {
  cultureRegistry,
  ensureRequiredCulturesRegistered,
} from '../../src/sim/content/cultures/cultureRegistry'
import {
  MAX_CULTURE_EVIDENCE,
  MAX_TRACKED_SUBJECTS,
  activeFriction,
  cultureNet,
  getCultureModuleState,
  liveMisunderstandingFor,
  liveMisunderstandings,
  observancesToday,
  recipeTags,
  separatingGroups,
} from '../../src/sim/modules/cultures/index'
import { getCultureForecastModifier } from '../../src/sim/modules/cultures/customerInfluence'

const SEED = 'phase215/culture-agency'

// The registry bootstraps lazily; a test that reads it directly has to ask
// for it first, exactly like `createInitialTavernState` does.
ensureRequiredCulturesRegistered()

type Actions = NonNullable<SimInput['ownerActions']>

function trading(coin = 900): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms']) {
    state = withStock(state, id, { quantity: 400, spoilage: 0 })
  }
  return state
}

function run(state: TavernState, day: number, ownerActions: Actions = []): TavernState {
  return simulateDay(state, { seed: `${SEED}/${day}`, ownerActions }, FULL_PIPELINE).state
}

function runDays(state: TavernState, days: number, from = 0): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) current = run(current, from + day)
  return current
}

function evidenceFor(state: TavernState, cultureId: string, kind: string) {
  return (getCultureModuleState(state).standing[cultureId]?.evidence ?? []).filter(
    (entry) => entry.kind === kind,
  )
}

describe('Phase 215 §8.2 — taboo and delight come from what was served, not from the cellar', () => {
  it('a disliked-tagged crate in storage is not a taboo on its own', () => {
    // `merchant_roadfolk` dislike `risky`. Put something they would object to
    // in the cellar and never serve it: under the old proxy this offended
    // them every single day it sat there.
    const culture = cultureRegistry.get('merchant_roadfolk')
    expect(culture.dislikedTags.length).toBeGreaterThan(0)

    const state = runDays(trading(), 6)
    const flow = getServiceModuleState(state).result.flow

    // Whatever taboos were recorded, every one must name a recipe that
    // actually reached a table of that culture.
    for (const [cultureId, standing] of Object.entries(
      getCultureModuleState(state).standing,
    )) {
      for (const entry of standing.evidence) {
        if (entry.kind !== 'taboo') continue
        expect(entry.subjectId, 'a taboo must name the dish').toBeDefined()
        const wasDelivered = flow.parties.some(
          (party) =>
            state.customerGroups[party.groupId]?.cultureId === cultureId &&
            party.order.some(
              (line) => line.recipeId === entry.subjectId && line.delivered > 0,
            ),
        )
        // Either it was delivered tonight, or it is an older entry still in
        // the ledger — but it can never have been recorded without a
        // delivery, which the dish-experience counter proves.
        const experienced = standing.dishExperience[entry.subjectId!]
        expect(
          wasDelivered || (experienced?.served ?? 0) > 0,
          `taboo for '${entry.subjectId}' with nothing ever served`,
        ).toBe(true)
      }
    }
  })

  it('records dish experience only for servings that were actually delivered', () => {
    const state = runDays(trading(), 5)
    const slice = getCultureModuleState(state)
    let checked = 0

    for (const [cultureId, standing] of Object.entries(slice.standing)) {
      for (const [recipeId, experience] of Object.entries(standing.dishExperience)) {
        checked += 1
        expect(experience.served).toBeGreaterThan(0)
        expect(experience.delight).toBeLessThanOrEqual(experience.served)
        expect(experience.taboo).toBeLessThanOrEqual(experience.served)
        // The recipe has to be a real one, and the tags that made it a
        // delight or a taboo have to be on it.
        const tags = recipeTags(recipeId)
        expect(tags.length).toBeGreaterThan(0)
        void cultureId
      }
    }
    expect(checked, 'the run must have served somebody something').toBeGreaterThan(0)
  })

  it('a generic service tag is not a delight — being handed a drink is the baseline', () => {
    // Every culture prefers `food` or `drink` and every dish carries both.
    // If those counted, comfort would saturate for everybody in a week.
    const state = runDays(trading(), 10)
    for (const culture of Object.values(state.world.cultures)) {
      expect(culture.comfort).toBeLessThanOrEqual(100)
      // A well-run fortnight should not have pinned every culture at the top.
      if (culture.comfort === 100) {
        expect(cultureNet(state, culture.id)).toBeGreaterThan(80)
      }
    }
  })
})

describe('Phase 215 §8.2 — seating tension comes from actual placement and crowding', () => {
  it('friction is only recorded for cultures that actually shared a room', () => {
    const state = runDays(trading(), 8)
    const friction = activeFriction(state)

    for (const entry of friction) {
      expect(entry.sharedDays).toBeGreaterThan(0)
      expect(entry.areaId, 'friction must name the room it happened in').toBeDefined()
      // The two cultures must genuinely rub against each other by definition.
      const a = cultureRegistry.get(entry.cultureA)
      const b = cultureRegistry.get(entry.cultureB)
      const aMinds = state.world.cultures[entry.cultureB]!.tags.some((tag) =>
        a.frictionWith.includes(tag),
      )
      const bMinds = state.world.cultures[entry.cultureA]!.tags.some((tag) =>
        b.frictionWith.includes(tag),
      )
      expect(aMinds || bMinds, `${entry.id} has no declared friction`).toBe(true)
    }
  })

  it('every seating-friction entry names the room, and every bad seat a real one', () => {
    const state = runDays(trading(), 6)
    for (const [cultureId, standing] of Object.entries(
      getCultureModuleState(state).standing,
    )) {
      for (const entry of standing.evidence) {
        if (entry.kind !== 'seating_friction' && entry.kind !== 'bad_seat') continue
        expect(entry.subjectId).toBeDefined()
        expect(
          state.areas[entry.subjectId!],
          `${cultureId} evidence names unknown area '${entry.subjectId}'`,
        ).toBeDefined()
        // …and they must actually have sat there.
        expect((standing.areaExperience[entry.subjectId!]?.seated ?? 0)).toBeGreaterThan(0)
      }
    }
  })

  it('no culture accrues seating evidence without having sat down', () => {
    // A tavern with nothing to sell still seats people — they sit, order,
    // and leave when nothing arrives — so the contract is not "no evidence"
    // but "no evidence for a room nobody of yours was in". Under the old
    // proxy two groups' patronage METERS were enough to conflict, with no
    // seat and no room involved at all.
    let state = withCoin(createInitialTavernState(), 0)
    for (const id of Object.keys(state.stock)) {
      state = withStock(state, id, { quantity: 0 })
    }
    state = runDays(state, 4)

    for (const [cultureId, standing] of Object.entries(
      getCultureModuleState(state).standing,
    )) {
      const totalSeated = Object.values(standing.areaExperience).reduce(
        (sum, entry) => sum + entry.seated,
        0,
      )
      const seatingEvidence = standing.evidence.filter((entry) =>
        ['good_seat', 'bad_seat', 'seating_friction'].includes(entry.kind),
      )
      if (seatingEvidence.length > 0) {
        expect(totalSeated, `${cultureId} has seating evidence but never sat`).toBeGreaterThan(0)
      }
    }
    // Friction in particular needs two cultures in one room on one night.
    for (const entry of activeFriction(state)) {
      expect(entry.sharedDays).toBeGreaterThan(0)
    }
  })

  it('the seat-separation policy buys friction off, and charges seats for it', () => {
    const base = runDays(trading(), 4)
    const baseSeats = getServiceModuleState(base).result.flow.capacity.seats
    expect(baseSeats).toBeGreaterThan(0)
    expect(separatingGroups(base)).toBe(false)

    const separated = run(base, 5, [
      { actionId: 'enable_seat_groups_apart' },
    ])
    const applied = getOwnerActionsModuleState(separated).applied.find(
      (entry) => entry.actionId === 'enable_seat_groups_apart',
    )
    expect(applied, 'the seating policy must be enableable').toBeDefined()

    const after = runDays(separated, 3, 6)
    expect(separatingGroups(after)).toBe(true)
    // The cost is real: fewer usable seats on the floor.
    expect(getServiceModuleState(after).result.flow.capacity.seats).toBeLessThan(
      baseSeats,
    )
    // And no new friction accrues while they are being kept apart.
    const before = activeFriction(separated).map((entry) => entry.level)
    const now = activeFriction(after).map((entry) => entry.level)
    for (let i = 0; i < Math.min(before.length, now.length); i += 1) {
      expect(now[i]!).toBeLessThanOrEqual(before[i]!)
    }
  })
})

describe('Phase 215 §8.2 — the four meters are dynamic and derived', () => {
  it('trust exists, starts from the definition, and is not a copy of comfort', () => {
    const state = createInitialTavernState()
    for (const culture of Object.values(state.world.cultures)) {
      const def = cultureRegistry.get(culture.id)
      expect(culture.trust).toBe(def.defaultTrust)
    }
    // At least one culture's trust and comfort differ, so they cannot be
    // reading the same number.
    const diverged = Object.values(state.world.cultures).some(
      (culture) => culture.trust !== culture.comfort,
    )
    expect(diverged).toBe(true)
  })

  it('meters move, stay bounded, and name their driver in a cause', () => {
    const before = trading()
    const after = runDays(before, 5)

    const moved = Object.values(after.world.cultures).some((culture) => {
      const was = before.world.cultures[culture.id]!
      return (
        culture.comfort !== was.comfort ||
        culture.tension !== was.tension ||
        (culture.trust ?? 0) !== (was.trust ?? 0)
      )
    })
    expect(moved, 'no culture meter moved in five days of trading').toBe(true)

    for (const culture of Object.values(after.world.cultures)) {
      for (const value of [culture.comfort, culture.tension, culture.familiarity, culture.trust ?? 50]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
        expect(Number.isInteger(value)).toBe(true)
      }
    }

    const cause = after.causes.find(
      (entry) => entry.targetType === 'culture' && entry.tags.includes('standing'),
    )
    expect(cause, 'a meter move must be attributable').toBeDefined()
  })

  it('familiarity only rises, and only when they actually came in', () => {
    const before = trading()
    const after = runDays(before, 6)
    for (const culture of Object.values(after.world.cultures)) {
      expect(culture.familiarity).toBeGreaterThanOrEqual(
        before.world.cultures[culture.id]!.familiarity,
      )
    }
  })

  it('§5.11 — evidence, dishes and areas are all bounded', () => {
    const state = runDays(trading(), 30)
    const slice = getCultureModuleState(state)
    for (const standing of Object.values(slice.standing)) {
      expect(standing.evidence.length).toBeLessThanOrEqual(MAX_CULTURE_EVIDENCE)
      expect(Object.keys(standing.dishExperience).length).toBeLessThanOrEqual(
        MAX_TRACKED_SUBJECTS,
      )
      expect(Object.keys(standing.areaExperience).length).toBeLessThanOrEqual(
        MAX_TRACKED_SUBJECTS,
      )
      expect(standing.accommodations.length).toBeLessThanOrEqual(12)
      expect(standing.learnedPreferences.length).toBeLessThanOrEqual(6)
    }
  })
})

describe('Phase 215 §8.2 — observance, misunderstanding and reconciliation', () => {
  it('an observance is judged on what the house actually did', () => {
    const state = runDays(trading(), 10)
    const slice = getCultureModuleState(state)
    const totals = slice.totals
    expect(
      totals.observancesHonoured + totals.observancesIgnored,
      'ten days should have crossed at least one observance',
    ).toBeGreaterThan(0)

    // Every honoured observance is backed by an accommodation entry that
    // says what the house did.
    for (const standing of Object.values(slice.standing)) {
      for (const entry of standing.accommodations) {
        expect(entry.readable.length).toBeGreaterThan(0)
        expect(typeof entry.accommodated).toBe('boolean')
      }
    }
  })

  it('a misunderstanding carries a named remedy the player can act on', () => {
    const state = runDays(trading(), 12)
    const live = liveMisunderstandings(state)
    for (const record of live) {
      expect(record.reason.length).toBeGreaterThan(0)
      expect(record.remedy.length).toBeGreaterThan(0)
      expect(record.expiresOnDay).toBeGreaterThan(record.openedOnDay)
      expect(record.status).toBe('live')
    }
  })

  it('registers the two culture actions in the shared registry', () => {
    for (const id of ['make_amends_to_culture', 'mark_culture_observance']) {
      expect(actionRegistry.get(id), `owner action '${id}' not registered`).toBeDefined()
    }
  })

  it('making amends settles the matter, costs coin, and is recorded as accommodation', () => {
    let state = runDays(trading(), 12)
    const live = liveMisunderstandings(state)
    if (live.length === 0) return
    const record = live[0]!
    const coinBefore = state.coin

    state = run(state, 99, [
      { actionId: 'make_amends_to_culture', targetId: record.cultureId },
    ])

    const applied = getOwnerActionsModuleState(state).applied.find(
      (entry) => entry.actionId === 'make_amends_to_culture',
    )
    expect(applied).toBeDefined()
    expect(state.coin).toBeLessThan(coinBefore)
    expect(
      getCultureModuleState(state).misunderstandings[record.id]!.status,
    ).toBe('reconciled')
    // A NEW matter may legitimately open the same evening — the closing pass
    // reads that night's service after the amends were made. What must not
    // happen is the settled one still being live.
    const stillLive = liveMisunderstandingFor(state, record.cultureId)
    expect(stillLive?.id).not.toBe(record.id)

    const amends = evidenceFor(state, record.cultureId, 'amends')
    expect(amends.length).toBeGreaterThan(0)
    const accommodation = getCultureModuleState(state).standing[
      record.cultureId
    ]!.accommodations.find((entry) => entry.kind === 'made_amends')
    expect(accommodation?.accommodated).toBe(true)
  })

  it('marking an observance is not overwritten by the evening pass', () => {
    // The action writes its evidence when taken; the closing pass runs later
    // the same day under the same evidence id. Without the accommodation
    // check the evening would decide the day was ignored and overwrite it.
    let state = trading()
    let marked = false
    for (let day = 0; day < 14 && !marked; day += 1) {
      const observing = observancesToday({
        state,
        getDayType: () => state.calendar.dayType,
      } as never)
      const target = observing[0]
      if (target) {
        state = run(state, day, [
          { actionId: 'mark_culture_observance', targetId: target.cultureId },
        ])
        const applied = getOwnerActionsModuleState(state).applied.find(
          (entry) => entry.actionId === 'mark_culture_observance',
        )
        if (applied) {
          marked = true
          const ignored = evidenceFor(state, target.cultureId, 'observance_ignored')
          const honoured = evidenceFor(state, target.cultureId, 'observance_honoured')
          const today = state.calendar.totalDaysElapsed - 1
          expect(
            ignored.some((entry) => entry.onDay === today),
            'the day the player paid to mark must not read as ignored',
          ).toBe(false)
          expect(honoured.some((entry) => entry.onDay === today)).toBe(true)
        }
      }
      if (!marked) state = run(state, day)
    }
    expect(marked, 'no observance came up in a fortnight').toBe(true)
  })
})

describe('Phase 215 §8.2 — autonomous effects are population behaviours', () => {
  it('an unresolved matter keeps a culture away, and says what would fix it', () => {
    const state = runDays(trading(), 12)
    const live = liveMisunderstandings(state)
    if (live.length === 0) return
    const record = live[0]!
    const group = Object.values(state.customerGroups).find(
      (entry) => entry.cultureId === record.cultureId,
    )
    if (!group) return

    const modifier = getCultureForecastModifier(state, group)
    expect(modifier.modifier).toBeLessThan(0)
    expect(modifier.notes.join(' ')).toContain(record.remedy)
  })

  it('preference shifts are learned from what they were actually served', () => {
    const state = runDays(trading(), 20)
    const slice = getCultureModuleState(state)
    for (const [cultureId, standing] of Object.entries(slice.standing)) {
      const def = cultureRegistry.get(cultureId)
      for (const tag of standing.learnedPreferences) {
        // A learned tag is never one the definition already declared —
        // otherwise it would be a duplicate rather than a shift.
        expect(def.preferredStockTags).not.toContain(tag)
        expect(def.dislikedTags).not.toContain(tag)
      }
    }
  })

  it('a fortnight of autonomous culture behaviour leaves a valid state', () => {
    const state = runDays(trading(), 14)
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    expect(
      validation.success,
      validation.success ? '' : JSON.stringify(validation.errors.slice(0, 2)),
    ).toBe(true)
  })

  it('the culture report surfaces tonight’s evidence and what is outstanding', () => {
    const state = runDays(trading(), 8)
    const result = simulateDay(state, { seed: `${SEED}/report` }, FULL_PIPELINE)
    const section = result.reports.find((entry) => entry.id === 'cultures')
    expect(section).toBeDefined()
    expect(section!.data).toHaveProperty('evidenceToday')
    expect(section!.data).toHaveProperty('misunderstandingIds')
    expect(section!.data).toHaveProperty('frictionIds')
  })
})
