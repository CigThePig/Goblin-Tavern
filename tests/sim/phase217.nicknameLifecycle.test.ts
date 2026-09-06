import { beforeAll, describe, expect, it } from 'vitest'
import { runProgressionLab } from '../../scripts/progression-lab'
import { observeIdentity } from '../../src/sim/modules/tavernIdentity/evidence'
import { updateEarnedNicknames } from '../../src/sim/modules/tavernIdentity/nicknames'
import { calculateRumourPressure } from '../../src/sim/modules/pressures/calculators/rumourPressure'
import { makeReadOnlyCtx } from '../../src/sim/modules/ownerActions/readonlyHelpers'
import type { SimContext } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'

describe('nickname evidence remains accountable', () => {
  let earned: TavernState
  beforeAll(() => { earned = runProgressionLab(10, 'nickname-natural').state }, 60000)
  it('loses naturally earned names when their supporting pattern persists no longer', () => {
    const state = structuredClone(earned)
    const ids = Object.values(state.world.socialRumours).filter(r => r.tags.includes('earned_nickname')).map(r => r.id)
    expect(ids.length).toBeGreaterThan(0)
    const reasons: string[] = []
    // Isolate contradiction from other producers: the starting rumours were
    // earned by ordinary play; this unit probe supplies seven contrary days.
    const ctx = { state, removeSocialRumour: (id: string, meta: { readable: string }) => { delete state.world.socialRumours[id]; reasons.push(meta.readable) } } as unknown as SimContext
    for (let day = 0; day < 7; day++) {
      state.calendar.totalDaysElapsed++
      const observed = observeIdentity(state, { knownFor: [], atmosphere: [] }, 0)
      state.modules.tavernIdentity = observed.evidence
      state.world.tavernIdentity.knownFor = observed.knownFor
      state.world.tavernIdentity.atmosphereTags = observed.atmosphereTags
      updateEarnedNicknames(ctx, undefined)
    }
    expect(ids.every(id => state.world.socialRumours[id] === undefined)).toBe(true)
    expect(reasons).toHaveLength(ids.length)
  })
  it('does not turn a fond nickname into scandal pressure', () => {
    const state = structuredClone(earned)
    const before = calculateRumourPressure(makeReadOnlyCtx(state)).value
    const fondNames = Object.values(state.world.socialRumours).filter(r => r.tags.includes('earned_nickname') && !r.tags.includes('identity:an unfussy floor') && !r.tags.includes('identity:a rough edge'))
    expect(fondNames.length).toBeGreaterThan(0)
    for (const name of fondNames) delete state.world.socialRumours[name.id]
    expect(calculateRumourPressure(makeReadOnlyCtx(state)).value).toBe(before)
  })
  it('cannot earn an extra public day by observing the same saved day twice', () => {
    const state = structuredClone(earned)
    const raw = { knownFor: ['cheap drinks'], atmosphere: [] }
    const first = observeIdentity(state, raw, 50)
    state.modules.tavernIdentity = first.evidence
    state.world.tavernIdentity.knownFor = first.knownFor
    state.world.tavernIdentity.atmosphereTags = first.atmosphereTags
    expect(observeIdentity(state, raw, 50)).toEqual(first)
  })
})
