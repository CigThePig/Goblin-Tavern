import { describe, expect, it } from 'vitest'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { observeIdentity, identityEvidence, MAX_IDENTITY_EVIDENCE } from '../../src/sim/modules/tavernIdentity/evidence'
import { getStaffModuleState } from '../../src/sim/modules/staff/workforceState'
import { derivePriorityModifiers } from '../../src/sim/modules/staff/priorityEffects'
import { buildAmbitionsOverview } from '../../src/reports/ambitionsOverview'
import { runProgressionLab } from '../../scripts/progression-lab'

describe('identity evidence and earned development', () => {
  it('holds an established identity through a short dip and drops it after persistent contradiction', () => {
    const state = createInitialTavernState()
    const raw = { knownFor: ['cheap drinks'], atmosphere: ['grimy floors'] }
    for (let day=0; day<5; day++) {
      state.calendar.totalDaysElapsed = day
      const observed = observeIdentity(state, raw, 10)
      state.modules.tavernIdentity = observed.evidence
      state.world.tavernIdentity.knownFor = observed.knownFor
      state.world.tavernIdentity.atmosphereTags = observed.atmosphereTags
    }
    state.calendar.totalDaysElapsed++
    const oneBadDay = observeIdentity(state, { knownFor: [], atmosphere: [] }, 0)
    expect(oneBadDay.knownFor).toContain('cheap drinks')
    state.modules.tavernIdentity = oneBadDay.evidence
    for (let day=0; day<7; day++) {
      state.calendar.totalDaysElapsed++
      const changed = observeIdentity(state, { knownFor: [], atmosphere: [] }, 0)
      state.modules.tavernIdentity = changed.evidence
      state.world.tavernIdentity.knownFor = changed.knownFor
    }
    expect(state.world.tavernIdentity.knownFor).not.toContain('cheap drinks')
    expect(Object.keys(identityEvidence(state).evidence).length).toBeLessThanOrEqual(MAX_IDENTITY_EVIDENCE)
  })
  it('earns source-attributed nicknames through normal play without injected rumours', () => {
    const result = runProgressionLab(10, 'nickname-natural')
    const rumours = Object.values(result.state.world.socialRumours).filter(r => r.tags.includes('earned_nickname'))
    expect(rumours.length).toBeGreaterThan(0)
    expect(rumours.length).toBeLessThanOrEqual(3)
    for (const rumour of rumours) {
      expect(result.state.customerGroups[rumour.sourceEntityId!]).toBeDefined()
      expect(rumour.originRef?.kind).toBe('customer_group')
    }
    expect(buildAmbitionsOverview(result.state).nicknames.length).toBeGreaterThan(0)
  }, 60000)
  it('a resting subject cannot progress the original mastery arc', () => {
    let state = createInitialTavernState()
    state = simulateDay(state, { seed: 'rest-before-growth' }, FULL_PIPELINE).state
    const before = state.arcs.arc_staff_mastery!.progress
    const next = simulateDay(state, { seed: 'rest-before-growth', ownerActions: [{ actionId: 'set_staff_shift', targetId: 'server:rest' }] }, FULL_PIPELINE).state
    expect(getStaffModuleState(next).roster.find(r => r.staffId === 'server')?.contribution).toBe(0)
    expect(next.arcs.arc_staff_mastery!.progress).toBe(before)
  })
  it('earned staff traits affect actual assignments and never supply an absent member', () => {
    const state = simulateDay(createInitialTavernState(), { seed: 'working-traits' }, FULL_PIPELINE).state
    const cook = state.staff.cook!
    const roster = getStaffModuleState(state).roster
    const base = derivePriorityModifiers([cook], roster)
    const earned = derivePriorityModifiers([{ ...cook, tags: [...cook.tags, 'kitchen_mentor'] }], roster)
    expect(earned.foodQualityModifier).toBeGreaterThan(base.foodQualityModifier)
    const absentRoster = roster.map(r => ({ ...r, available: false, contribution: 0 }))
    const absent = derivePriorityModifiers([{ ...cook, tags: [...cook.tags, 'kitchen_mentor'] }], absentRoster)
    expect(absent.foodQualityModifier).toBe(0)
    expect(derivePriorityModifiers([cook], []).foodQualityModifier).toBe(0)
    const both = derivePriorityModifiers([{ ...cook, tags: [...cook.tags, 'kitchen_mentor', 'kitchen_mentor_steady'] }], roster)
    expect(both.foodQualityModifier).toBe(earned.foodQualityModifier)
  })
})
