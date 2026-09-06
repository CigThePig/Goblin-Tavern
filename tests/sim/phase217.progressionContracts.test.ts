import { beforeAll, describe, expect, it } from 'vitest'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { runProgressionLab } from '../../scripts/progression-lab'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { makeReadOnlyCtx } from '../../src/sim/modules/ownerActions/readonlyHelpers'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'
import { getResolvableSeedsToday } from '../../src/sim/modules/issues/issueSeedQueries'
import { ventureRecord } from '../../src/sim/modules/ventures/ambitionState'
import { ventureSupplierFactor } from '../../src/sim/modules/ventures/ambitionEffects'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { OwnerActionInput } from '../../src/sim/modules/ownerActions/types'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import { createInitialTavernState } from '../../src/sim/state/defaults'

const licence = 'venture_liquor_license'
const action = (actionId: string, targetId: string): OwnerActionInput => ({ actionId, targetId })
const next = (state: TavernState, ownerActions: OwnerActionInput[] = []) => simulateDay(state, { seed: 'progression-contracts', ownerActions }, FULL_PIPELINE).state

describe('venture lifecycle contracts', () => {
  let started: TavernState
  beforeAll(() => { started = next(next(createInitialTavernState()), [action('start_venture', licence)]) })

  it('keeps paid progress on pause and resume, but abandonment is permanent', () => {
    const worked = next(started, [action('work_on_venture', `${licence}:invest`)])
    const paused = next(worked, [action('pause_venture', licence), action('work_on_venture', `${licence}:invest`)])
    expect(paused.ventures[licence]?.progress).toBe(1)
    expect(paused.ventures[licence]?.status).toBe('paused')
    expect(getOwnerActionsModuleState(paused).rejected).toHaveLength(1)
    const resumed = next(paused, [action('resume_venture', licence)])
    expect(resumed.ventures[licence]?.progress).toBe(1)
    expect(resumed.ventures[licence]?.status).toBe('active')
    expect(ventureRecord(resumed, licence).attempts).toBe(2)
    const abandoned = next(resumed, [action('abandon_venture', licence)])
    expect(abandoned.ventures[licence]?.tags).toContain('abandoned')
    expect(actionRegistry.get('resume_venture').canApply(makeReadOnlyCtx(abandoned), action('resume_venture', licence)).ok).toBe(false)
    expect(actionRegistry.get('start_venture').canApply(makeReadOnlyCtx(abandoned), action('start_venture', licence)).ok).toBe(false)
  })

  it.each(['work_on_venture', 'pause_venture'] as const)('rechecks a morning card after %s without charging for its stale promise', ownerAction => {
    const input = { seed: 'licence-card-conflict' }
    const morning = advanceDaySegment(started, input, FULL_PIPELINE, 'A').state
    const seed = getResolvableSeedsToday(morning).find(s => s.family === 'venture')!
    expect(seed).toBeDefined()
    const intent: ResponseIntent = { id: 'licence-response', seedId: seed.id, verb: 'upgrade', shape: 'long_term_investment', target: { kind: 'system', id: `venture:${licence}` }, tags: ['venture'], intensity: 1, metadata: { responseSlotId: 'invest_owner_time' } }
    const afterB = advanceDaySegment(morning, { ...input, ownerActions: [action(ownerAction, ownerAction === 'work_on_venture' ? `${licence}:invest` : licence)] }, FULL_PIPELINE, 'B', { dayBaseline: started }).state
    const result = advanceDaySegment(afterB, { ...input, responseIntents: [intent] }, FULL_PIPELINE, 'C', { dayBaseline: started }).state
    expect(result.ventures[licence]?.progress).toBe(ownerAction === 'work_on_venture' ? 1 : 0)
    expect(getOwnerActionsModuleState(result).timeSpent).toBe(getOwnerActionsModuleState(afterB).timeSpent)
    expect((result.modules.responses as { resolvedToday: { outcome: string }[] }).resolvedToday[0]?.outcome).toBe('skipped_unavailable')
  })
})

describe('named supplier compact, earned through actual trading', () => {
  let mutual: TavernState
  let exclusive: TavernState
  beforeAll(() => {
    mutual = runProgressionLab(21, 'progression-lab', 'venture_supplier_compact').state
    exclusive = runProgressionLab(21, 'progression-lab', 'venture_supplier_compact', 'exclusive').state
  }, 60000)
  it('offers a beneficial partnership and a cheaper commitment with a cost elsewhere', () => {
    const id = 'venture_supplier_compact'
    expect(mutual.ventures[id]?.status).toBe('completed')
    expect(exclusive.ventures[id]?.status).toBe('completed')
    const partner = ventureRecord(mutual, id).participantId!
    const other = Object.keys(mutual.world.suppliers).find(x => x !== partner)!
    expect(ventureSupplierFactor(mutual, partner).multiplier).toBe(0.95)
    expect(ventureSupplierFactor(mutual, other).multiplier).toBe(1)
    expect(ventureSupplierFactor(exclusive, partner).multiplier).toBe(0.88)
    expect(ventureSupplierFactor(exclusive, other).multiplier).toBe(1.12)
    expect(exclusive.causes.some(c => c.tags.includes('venture_supplier_compact'))).toBe(true)
  })
  it('pauses an unworked attempt after two weeks with the named partner and investment intact', () => {
    let state = runProgressionLab(12, 'progression-lab', 'venture_supplier_compact').state
    const before = state.ventures.venture_supplier_compact!
    expect(before.progress).toBe(1)
    for (let i = 0; i < 14; i++) state = next(state)
    expect(state.ventures.venture_supplier_compact?.status).toBe('paused')
    expect(state.ventures.venture_supplier_compact?.progress).toBe(before.progress)
    expect(ventureRecord(state, 'venture_supplier_compact').participantId).toBeDefined()
  }, 60000)
})
