import { describe, expect, it } from 'vitest'
import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { allVentureBlueprints } from '../../src/sim/modules/ventures/ventureCatalog'
import { makeReadOnlyCtx } from '../../src/sim/modules/ownerActions/readonlyHelpers'

describe('ambitions are playable without waiting for a card', () => {
  it('offers seven distinct blueprints and registered lifecycle controls', () => {
    expect(allVentureBlueprints()).toHaveLength(7)
    for (const id of ['start_venture', 'work_on_venture', 'pause_venture', 'resume_venture', 'abandon_venture']) {
      expect(actionRegistry.has(id), id).toBe(true)
    }
  })

  it('earns the existing licence through paid work and refuses duplicate work in one day', () => {
    const opening = simulateDay(createInitialTavernState(), { seed: 'ambition' }, FULL_PIPELINE)
    const started = simulateDay(opening.state, { seed: 'ambition', ownerActions: [
      { actionId: 'start_venture', targetId: 'venture_liquor_license' },
    ] }, FULL_PIPELINE)
    expect(started.state.ventures.venture_liquor_license?.status).toBe('active')
    const worked = simulateDay(started.state, { seed: 'ambition', ownerActions: [
      { actionId: 'work_on_venture', targetId: 'venture_liquor_license:invest' },
      { actionId: 'work_on_venture', targetId: 'venture_liquor_license:invest' },
    ] }, FULL_PIPELINE)
    expect(worked.state.ventures.venture_liquor_license?.progress).toBe(1)
    const finished = simulateDay(worked.state, { seed: 'ambition', ownerActions: [
      { actionId: 'work_on_venture', targetId: 'venture_liquor_license:invest' },
    ] }, FULL_PIPELINE)
    expect(finished.state.transformations.licensed_liquor_service?.active).toBe(true)
    expect(finished.state.ventures.venture_liquor_license?.status).toBe('completed')
  })

  it('cannot invest into an unstarted ambition or invent a target', () => {
    const action = actionRegistry.get('work_on_venture')
    const before = createInitialTavernState()
    const serialized = JSON.stringify(before)
    expect(action.canApply(makeReadOnlyCtx(before), {
      actionId: action.id, targetId: 'venture_common_room:invest',
    }).ok).toBe(false)
    expect(JSON.stringify(before)).toBe(serialized)
  })
})
