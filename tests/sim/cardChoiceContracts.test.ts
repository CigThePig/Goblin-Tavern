import { describe, expect, it } from 'vitest'

import { composeChoicesFromSeed } from '../../src/cards/cardHelpers'
import { formatEffectPreview } from '../../src/cards/compose/formatEffectPreview'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import { effect } from '../../src/sim/modules/issues/generatorHelpers'
import type { ChoiceArchetype, IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../src/sim/state/TavernState'
import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  buildAreaAtmosphereTriggeringState,
  buildDebtRentTriggeringState,
  buildFactionRequestTriggeringState,
  buildMonthlyReviewTriggeringState,
  buildRegularCustomerRelationshipTriggeringState,
  buildReputationShiftTriggeringState,
  buildViolenceTriggeringState,
} from '../sim/triggeringStates'

const EXPECTED_AREA_ARCHETYPES: Record<string, ChoiceArchetype> = {
  repair_area: 'proper_repair',
  clean_area: 'clean',
  start_project: 'major_project',
  close_area_temporarily: 'close_temporarily',
  rebrand_area: 'spin_or_rebrand',
  ignore_area_problem: 'ignore',
}

function captureSeed(family: string, buildState: () => TavernState, seed: string) {
  let result = runOneDay(buildState(), { seed })
  let captured = getIssueSeeds(result.state, { family })[0]
  if (captured === undefined) {
    result = runOneDay(result.state, { seed: `${seed}-warm` })
    captured = getIssueSeeds(result.state, { family })[0]
  }
  return { seed: captured, state: result.state }
}

function composeForContract(seed: IssueSeed, state: TavernState) {
  return composeChoicesFromSeed(seed, state, {
    labelPool: { slotId: 'choice_label', snippets: [] },
    previewPool: { slotId: 'effect_preview', snippets: [] },
  })
}

function captureAreaAtmosphereSeed(seed: string) {
  let result = runOneDay(buildAreaAtmosphereTriggeringState(), { seed })
  let areaSeed = getIssueSeeds(result.state, { family: 'area_atmosphere' })[0]
  if (areaSeed === undefined) {
    result = runOneDay(result.state, { seed: `${seed}-warm` })
    areaSeed = getIssueSeeds(result.state, { family: 'area_atmosphere' })[0]
  }
  return areaSeed
}

describe('card choice contracts', () => {
  it('annotates area_atmosphere response slots with strategic archetypes', () => {
    const areaSeed = captureAreaAtmosphereSeed('card-choice-contracts-area-atmosphere')

    expect(areaSeed).toBeDefined()
    expect(areaSeed!.responseSlots).toHaveLength(Object.keys(EXPECTED_AREA_ARCHETYPES).length)

    for (const slot of areaSeed!.responseSlots) {
      expect(slot.choiceContract, slot.id).toBeDefined()
      expect(slot.choiceContract!.archetype).toBe(EXPECTED_AREA_ARCHETYPES[slot.id])
      expect(slot.choiceContract!.primaryTarget, slot.id).toEqual(expect.any(String))
      expect(slot.choiceContract!.payoffTiming, slot.id).toEqual(expect.any(String))
      expect(slot.choiceContract!.costTypes, slot.id).toEqual(expect.any(Array))
    }
  })

  it('marks the major area project as a mixed payoff that must surface delayed value', () => {
    const areaSeed = captureAreaAtmosphereSeed('card-choice-contracts-major-project')
    const projectSlot = areaSeed!.responseSlots.find((slot) => slot.id === 'start_project')

    expect(projectSlot?.choiceContract).toMatchObject({
      archetype: 'major_project',
      primaryTarget: 'area.condition',
      costTypes: ['coin'],
      payoffTiming: 'mixed',
      mustShowDelayedPayoff: true,
      requiresVisibleTradeoff: true,
    })
  })

  it('makes the Phase 5 area-atmosphere vertical slice mechanically legible', () => {
    const areaSeed = captureAreaAtmosphereSeed('card-choice-contracts-phase-5')!
    const state = buildAreaAtmosphereTriggeringState()
    const choices = composeChoicesFromSeed(areaSeed, state, {
      labelPool: { slotId: 'choice_label', snippets: [] },
      previewPool: { slotId: 'effect_preview', snippets: [] },
    })
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))

    expect(bySlot.get('clean_area')?.mechanicalEffects).toEqual([
      'Main Room Cleanliness +20',
      'Ib Mudshank Fatigue +4',
      'Main Room Smell -12',
    ])
    expect(bySlot.get('start_project')?.mechanicalEffects).toEqual([
      'Coin -25',
      'Main Room Condition +10',
      'later: Main Room Condition +20',
      'later: Maintenance Backlog -10',
    ])
    expect(bySlot.get('close_area_temporarily')?.mechanicalEffects).toEqual([
      'Main Room Damage -8',
      'Main Room Cleanliness +10',
      'Service Capacity -5',
      'later: Stock Shortage Risk +6',
    ])
    expect(bySlot.get('rebrand_area')?.mechanicalEffects).toEqual([
      'Respectable Reputation -8',
      'Cozy Reputation +6',
      'later: Audience may narrow',
    ])
    expect(bySlot.get('rebrand_area')?.mechanicalEffects?.join('\n')).not.toContain('Condition')
    expect(bySlot.get('ignore_area_problem')?.mechanicalEffects).toEqual([
      'Maintenance Backlog +10',
      'Main Room Condition -8',
      'Main Room Damage +6',
    ])
  })

  it('makes Phase 8 regular word-of-mouth choices carry visible credibility stakes', () => {
    const captured = captureSeed(
      'regular_customer',
      buildRegularCustomerRelationshipTriggeringState,
      'card-choice-contracts-phase-8-regulars',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))

    expect(captured.seed!.responseSlots.find((slot) => slot.id === 'ask_regular_to_spread_word')?.choiceContract).toMatchObject({
      archetype: 'call_in_favor',
      costTypes: ['reputation_risk', 'relationship_risk'],
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('apologize_to_regular')?.mechanicalEffects).toContain('Coin -1')
    expect(bySlot.get('ask_regular_to_spread_word')?.mechanicalEffects).toEqual(
      expect.arrayContaining([
        'Brik Tallowmug Loyalty +8',
        'Reputation Drift Pressure +5',
        'later: Regulars may judge the promise later',
      ]),
    )
  })

  it('makes Phase 8 reputation and audience shifts plain and domain-specific', () => {
    const captured = captureSeed(
      'reputation_shift',
      buildReputationShiftTriggeringState,
      'card-choice-contracts-phase-8-reputation',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))
    const embrace = bySlot.get('embrace')?.mechanicalEffects ?? []
    const advertise = bySlot.get('advertise')?.mechanicalEffects ?? []

    expect(captured.seed!.responseSlots.find((slot) => slot.id === 'embrace')?.choiceContract).toMatchObject({
      archetype: 'spin_or_rebrand',
      doesNotSolve: ['physical_state'],
      costTypes: ['reputation_risk'],
      mustShowDelayedPayoff: true,
    })
    expect(embrace).toEqual(expect.arrayContaining([
      'Cheap Reputation +5',
      'Reliable Reputation -3',
      'later: Reputation Drift Pressure +4',
      'later: Big-spending patrons may visit less often',
    ]))
    expect(advertise).toEqual(expect.arrayContaining([
      'Reliable Reputation -3',
      'later: Big-spending patrons may visit less often',
    ]))
    expect([...embrace, ...advertise].join('\n')).not.toMatch(/Condition|Cleanliness|Damage/)
  })

  it('makes Phase 9 violence escalation and security choices show contracts, costs, and blowback', () => {
    const captured = captureSeed(
      'violence',
      buildViolenceTriggeringState,
      'card-choice-contracts-phase-11-violence',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))
    const slots = new Map(captured.seed!.responseSlots.map((slot) => [slot.id, slot]))

    expect(slots.get('hire_security')?.choiceContract).toMatchObject({
      archetype: 'major_project',
      costTypes: ['coin', 'staff_fatigue'],
      mustShowDelayedPayoff: true,
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('hire_security')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Coin -20',
      'Violence Risk -15',
      'later: Staff Burnout Risk +4',
      'later: Security may become a routine fixture',
    ]))

    expect(slots.get('ban_group')?.choiceContract).toMatchObject({
      archetype: 'escalate',
      costTypes: ['relationship_risk'],
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('ban_group')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Ogres Patronage -25',
      'Violence Risk -12',
      'Ogres -20',
      'later: ogres may try to return',
    ]))

    expect(slots.get('embrace_rowdy')?.choiceContract).toMatchObject({
      archetype: 'spin_or_rebrand',
      doesNotSolve: ['violence_pressure'],
      costTypes: ['reputation_risk', 'relationship_risk'],
    })
    expect(bySlot.get('embrace_rowdy')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Dangerous Reputation +6',
      'Respectable Reputation -4',
      'later: Merchants Patronage -8',
    ]))
  })

  it('makes Phase 9 faction escalation visibly trade immediate relief for relationship loss and revenge risk', () => {
    const captured = captureSeed(
      'faction_request',
      buildFactionRequestTriggeringState,
      'card-choice-contracts-phase-11-faction',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))
    const slots = new Map(captured.seed!.responseSlots.map((slot) => [slot.id, slot]))

    expect(slots.get('call_watch')?.choiceContract).toMatchObject({
      archetype: 'escalate',
      primaryTarget: 'pressure:faction_anger',
      costTypes: ['relationship_risk'],
      payoffTiming: 'mixed',
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('call_watch')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Relationship -25',
      'Faction Anger Tension -8',
      'later: Faction may seek revenge',
    ]))

    expect(slots.get('host_faction_night')?.choiceContract).toMatchObject({
      archetype: 'call_in_favor',
      costTypes: ['coin', 'pressure_risk'],
      payoffTiming: 'mixed',
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('host_faction_night')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Relationship +18',
      'Coin -15',
      'later: Cultural Tension +5',
    ]))

    expect(slots.get('play_rival_faction')?.choiceContract).toMatchObject({
      archetype: 'cut_corners',
      costTypes: ['relationship_risk', 'reputation_risk'],
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('play_rival_faction')?.mechanicalEffects).toEqual(expect.arrayContaining([
      'Trust -8',
      'later: Rumour Pressure +8',
      'later: Deception may surface',
    ]))
  })

  it('makes Phase 10 debt deferral an intentional no-immediate-cost risk rather than a missing-cost bug', () => {
    const captured = captureSeed(
      'debt_rent',
      buildDebtRentTriggeringState,
      'card-choice-contracts-phase-11-debt',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))
    const delaySlot = captured.seed!.responseSlots.find((slot) => slot.id === 'delay')

    expect(delaySlot?.expectedEffects.join(' ').toLowerCase()).toContain('no immediate coin cost')
    expect(delaySlot?.choiceContract).toMatchObject({
      archetype: 'delay',
      costTypes: ['none'],
      payoffTiming: 'delayed',
      requiresVisibleTradeoff: true,
    })
    expect(bySlot.get('delay')?.mechanicalEffects).toEqual([
      'Landlord Pressure +10',
      'Landlord may threaten eviction',
    ])
  })

  it('makes Phase 10 monthly-review rent payment exact about coin already spent', () => {
    const captured = captureSeed(
      'monthly_review',
      buildMonthlyReviewTriggeringState,
      'card-choice-contracts-phase-11-monthly',
    )
    expect(captured.seed).toBeDefined()

    const choices = composeForContract(captured.seed!, captured.state)
    const bySlot = new Map(choices.map((choice) => [choice.slotId, choice]))
    const paySlot = captured.seed!.responseSlots.find((slot) => slot.id === 'pay_landlord_on_time')

    expect(paySlot?.choiceContract).toMatchObject({
      archetype: 'compensate',
      costTypes: ['none'],
      payoffTiming: 'mixed',
      requiresVisibleTradeoff: true,
    })
    expect(paySlot?.expectedEffects).toEqual(['lower landlord pressure', 'rent already paid'])
    expect(bySlot.get('pay_landlord_on_time')?.mechanicalEffects).toEqual([
      'Coin 0',
      'Landlord Pressure -25',
      'later: Debt Pressure +6',
      'later: Landlord may offer a window of goodwill',
    ])
  })

  it('keeps Phase 11 bad-when-higher mechanical labels explicit for state and pressure meters', () => {
    const state = buildAreaAtmosphereTriggeringState()
    const staffId = Object.keys(state.staff)[0]!

    expect(
      formatEffectPreview(
        effect('pressure', 'pressure:maintenance', 10, 'Maintenance rises', ['pressure']),
        state,
      ),
    ).toBe('Maintenance Backlog +10')
    expect(
      formatEffectPreview(
        effect('state_change', `staff.${staffId}.fatigue`, 8, 'Fatigue rises', ['staff']),
        state,
      ),
    ).toMatch(/ Fatigue \+8$/)
    expect(
      formatEffectPreview(
        effect('pressure', 'pressure:cultural_tension', 5, 'Tension rises', ['pressure']),
        state,
      ),
    ).toBe('Cultural Tension +5')
    expect(
      formatEffectPreview(
        effect('state_change', 'areas.main_room.damage', 6, 'Damage rises', ['area']),
        state,
      ),
    ).toBe('Main Room Damage +6')
    expect(
      formatEffectPreview(
        effect('state_change', 'areas.main_room.smell', 12, 'Smell rises', ['area']),
        state,
      ),
    ).toBe('Main Room Smell +12')
    expect(
      formatEffectPreview(
        effect('pressure', 'pressure:landlord', 10, 'Landlord pressure rises', ['pressure']),
        state,
      ),
    ).toBe('Landlord Pressure +10')
  })

})
