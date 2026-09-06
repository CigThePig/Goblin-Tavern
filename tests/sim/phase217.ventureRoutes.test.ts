import { describe, expect, it } from 'vitest'
import { runProgressionLab } from '../../scripts/progression-lab'
import { simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { startableVentures, ventureWorkQuote } from '../../src/sim/modules/ventures/ambitionQueries'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'

describe('ambitions reached through normal owner decisions', () => {
  it.each(['venture_common_room', 'venture_crew_kitchen', 'venture_faction_charter', 'venture_shared_table'])('%s reaches a consumed permanent outcome', goal => {
    const run = runProgressionLab(35, 'progression-lab', goal)
    expect(run.state.ventures[goal]?.status).toBe('completed')
    expect(Object.values(run.state.transformations).some(t => t.active && t.tags.includes(goal))).toBe(true)
    expect(run.trace.flatMap(d => d.rejected)).toEqual([])
  }, 60000)
  it('offers recovery after an unaffordable wage commitment, but does not grant solvency for starting it', () => {
    let state = createInitialTavernState()
    for (let day = 0; day < 11; day++) state = simulateDay(state, { seed: 'recovery-contract', ownerActions: day === 0 ? Object.keys(state.staff).map(targetId => ({ actionId: 'adjust_staff_wage', targetId, amount: 3000 })) : [] }, FULL_PIPELINE).state
    const opening = startableVentures(state).find(v => v.ventureId === 'venture_second_start')
    expect(opening).toBeDefined()
    state = simulateDay(state, { seed: 'recovery-contract', ownerActions: [{ actionId: 'start_venture', targetId: opening!.id }] }, FULL_PIPELINE).state
    for (let day = 0; day < 2; day++) state = simulateDay(state, { seed: 'recovery-contract', ownerActions: [{ actionId: 'work_on_venture', targetId: 'venture_second_start:invest' }] }, FULL_PIPELINE).state
    expect(state.ventures.venture_second_start?.stage).toBe('prove')
    expect(ventureWorkQuote(state, 'venture_second_start:invest').blocked).toBeDefined()
    expect(state.transformations.second_start).toBeUndefined()
    expect(getOwnerActionsModuleState(state).rejected).toEqual([])
  }, 60000)
})
