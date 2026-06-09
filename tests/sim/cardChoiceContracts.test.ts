import { describe, expect, it } from 'vitest'

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
      costTypes: ['coin', 'owner_time'],
      payoffTiming: 'mixed',
      mustShowDelayedPayoff: true,
      requiresVisibleTradeoff: true,
    })
  })
})
