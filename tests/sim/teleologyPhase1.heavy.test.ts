import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { LIQUOR_LICENSE_TRANSFORMATION_ID, LIQUOR_LICENSE_VENTURE_ID } from '../../src/sim/modules/ventures'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'

function investIntent(seedId: string): ResponseIntent {
  return { id: `intent_${seedId}`, seedId, verb: 'upgrade', shape: 'long_term_investment', target: { kind: 'system', id: `venture:${LIQUOR_LICENSE_VENTURE_ID}` }, tags: ['teleology', 'venture'], intensity: 1 }
}

describe('teleology phase 1 heavy playtest', () => {
  it('advances with investment and the ratchet tag survives many days and save/load', () => {
    let state = createInitialTavernState()
    let result = simulateDay(state, { seed: 'teleology-heavy-0', devOptions: { spawnVenture: LIQUOR_LICENSE_VENTURE_ID } }, FULL_PIPELINE)
    state = result.state
    for (let day = 1; day <= 10; day += 1) {
      const seed = (state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday.find((s) => s.family === 'venture')
      const responseIntents = seed && day <= 2 ? [investIntent(seed.id)] : []
      result = simulateDay(state, { seed: `teleology-heavy-${day}`, responseIntents }, FULL_PIPELINE)
      state = structuredClone(result.state)
    }
    expect(state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.stage).toBe('licensed')
    expect(state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID]?.active).toBe(true)
    expect(structuredClone(state).transformations[LIQUOR_LICENSE_TRANSFORMATION_ID]?.tags).toContain('ratchet')
  })
})
