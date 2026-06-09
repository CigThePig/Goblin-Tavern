import { describe, expect, it } from 'vitest'

import { composeChoicesFromSeed } from '../../src/cards/cardHelpers'
import { getIssueSeeds } from '../../src/sim/modules/issues/issueSeedQueries'
import type { ChoiceArchetype } from '../../src/sim/modules/issues/issueSeedTypes'
import { runOneDay } from '../../src/sim/testing/simRunner'
import { buildAreaAtmosphereTriggeringState } from '../sim/triggeringStates'

const EXPECTED_AREA_ARCHETYPES: Record<string, ChoiceArchetype> = {
  repair_area: 'proper_repair',
  clean_area: 'clean',
  start_project: 'major_project',
  close_area_temporarily: 'close_temporarily',
  rebrand_area: 'spin_or_rebrand',
  ignore_area_problem: 'ignore',
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
      'Reputation Respectable -8',
      'Reputation Cozy +6',
      'later: Audience may narrow',
    ])
    expect(bySlot.get('rebrand_area')?.mechanicalEffects?.join('\n')).not.toContain('Condition')
    expect(bySlot.get('ignore_area_problem')?.mechanicalEffects).toEqual([
      'Maintenance Backlog +10',
      'Main Room Condition -8',
      'Main Room Damage +6',
    ])
  })

})
