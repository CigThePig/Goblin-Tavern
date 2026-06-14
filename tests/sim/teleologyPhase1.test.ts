import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { resolveBranchingMilestone } from '../../src/sim/modules/kernel'
import { createLiquorLicenseVenture, LIQUOR_LICENSE_TRANSFORMATION_ID, LIQUOR_LICENSE_VENTURE_ID, liquorLicenseDefinition } from '../../src/sim/modules/ventures'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'

function run(state = createInitialTavernState(), extra = {}) {
  return simulateDay(state, { seed: 'teleology-phase-1', ...extra }, FULL_PIPELINE)
}

function investIntent(seedId: string): ResponseIntent {
  return { id: `intent_${seedId}`, seedId, verb: 'upgrade', shape: 'long_term_investment', target: { kind: 'system', id: `venture:${LIQUOR_LICENSE_VENTURE_ID}` }, tags: ['teleology', 'venture'], intensity: 1 }
}

describe('teleology phase 1 kernel and venture spine', () => {
  it('resolves branching milestones from declarative state conditions', () => {
    const state = createInitialTavernState()
    state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID] = { id: LIQUOR_LICENSE_TRANSFORMATION_ID, label: 'Licensed liquor service', active: true, tags: ['liquor_license'], createdAtDay: 0, activatedAtDay: 0 }
    const entry = { ...createLiquorLicenseVenture(0), progress: 2, tags: ['liquor_license', 'expedited'] }
    const resolved = resolveBranchingMilestone(entry, { state }, liquorLicenseDefinition.milestones[0]!)
    expect(resolved?.nextStage).toBe('licensed')
    expect(resolved?.effects[0]).toMatchObject({ kind: 'transformation', id: LIQUOR_LICENSE_TRANSFORMATION_ID })
  })

  it('spawns the dev venture, surfaces it as a seed, advances under investment, and emits causes', () => {
    const day1 = run(createInitialTavernState(), { devOptions: { spawnVenture: LIQUOR_LICENSE_VENTURE_ID } })
    expect(day1.state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.stage).toBe('paperwork')
    const seed = (day1.state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday.find((s) => s.family === 'venture')
    expect(seed?.id).toBeTruthy()

    const day2 = run(day1.state, { responseIntents: [investIntent(seed!.id)] })
    expect(day2.state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.progress).toBe(1)

    const day3Seed = (day2.state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday.find((s) => s.family === 'venture')
    const day3 = run(day2.state, { responseIntents: [investIntent(day3Seed!.id)] })
    expect(day3.state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.stage).toBe('licensed')
    expect(day3.state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID]?.active).toBe(true)
    expect(day3.state.causes.some((c) => c.tags.includes('teleology') && c.tags.includes('advance'))).toBe(true)
  })

  it('surfaces venture advancement in the day diff (reports/projections can observe it)', () => {
    // Regression for the diff walker not covering the teleology slices:
    // before this, an invested venture left an empty top-level diff.
    const day1 = run(createInitialTavernState(), { devOptions: { spawnVenture: LIQUOR_LICENSE_VENTURE_ID } })
    const seed = (day1.state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday.find((s) => s.family === 'venture')

    const day2 = run(day1.state, { responseIntents: [investIntent(seed!.id)] })
    const dayDiff = day2.diffs.find((d) => d.boundary === 'day')
    const paths = dayDiff?.changes.map((c) => c.path) ?? []
    expect(paths).toContain(`ventures.${LIQUOR_LICENSE_VENTURE_ID}.progress`)
  })

  it('emits a cause on a lifecycle stage/status transition', () => {
    // Regression for the missing aggregate fallback: a stage flip with no
    // numeric field move must still be attributed. Drive the venture to a
    // resolvable milestone, then advance with no progress delta in the patch.
    const state = createInitialTavernState()
    state.ventures[LIQUOR_LICENSE_VENTURE_ID] = { ...createLiquorLicenseVenture(0), progress: 2 }

    // endDay advances paperwork → licensed; progress 2 → 0 is numeric, but
    // the stage/status flips are the lifecycle facts. Assert a teleology
    // cause exists and none of them target a pressure.
    const next = run(state)
    const teleologyCauses = next.state.causes.filter((c) => c.tags.includes('teleology'))
    expect(teleologyCauses.some((c) => c.tags.includes('advance'))).toBe(true)
    // Teleology causes never target a pressure (constraint 3/4); entropy-half
    // causes legitimately do, so this is scoped to teleology only.
    expect(teleologyCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })
})
