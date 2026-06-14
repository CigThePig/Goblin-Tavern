import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { LIQUOR_LICENSE_VENTURE_ID } from '../../src/sim/modules/ventures'
import { OPENINGS_MODULE_ID, type OpeningsModuleState } from '../../src/sim/modules/openings'
import {
  applyHandBudget,
  DEFAULT_HAND_BUDGET,
} from '../../src/sim/modules/issues/handBudget'
import {
  classifyReturnDelta,
  readOpeningMeters,
} from '../../src/sim/modules/openings'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'

function run(state = createInitialTavernState(), extra = {}) {
  return simulateDay(state, { seed: 'teleology-phase-2', ...extra }, FULL_PIPELINE)
}

function seedsOf(state: ReturnType<typeof run>['state']): Array<{ id: string; family: string }> {
  return (state.modules.issueSeeds as { seedsToday: Array<{ id: string; family: string }> }).seedsToday
}

function pursueIntent(seedId: string, recordId: string): ResponseIntent {
  return {
    id: `intent_${seedId}`,
    seedId,
    verb: 'upgrade',
    shape: 'long_term_investment',
    target: { kind: 'system', id: `opening:${recordId}` },
    tags: ['teleology', 'opening'],
    intensity: 1,
    metadata: { responseSlotId: 'pursue' },
  }
}

describe('teleology phase 2 — openings as the entry path', () => {
  it('cold-bootstrap: a fresh save offers at least one opening on day 1 with zero ventures', () => {
    const day1 = run()
    expect(Object.keys(day1.state.ventures)).toHaveLength(0)
    const opening = seedsOf(day1.state).find((s) => s.family === 'opening')
    expect(opening?.id).toBeTruthy()

    const slice = day1.state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState
    const records = Object.values(slice.openings)
    expect(records.some((r) => r.status === 'active' && r.blueprintId === LIQUOR_LICENSE_VENTURE_ID)).toBe(true)
    // The opening offered the venture before any venture exists.
    expect(day1.state.ventures[LIQUOR_LICENSE_VENTURE_ID]).toBeUndefined()
  })

  it('committing to an opening spawns the venture through the applier and retires the opening', () => {
    const day1 = run()
    const slice = day1.state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState
    const record = Object.values(slice.openings).find((r) => r.status === 'active')!
    const seed = seedsOf(day1.state).find((s) => s.family === 'opening')!

    const day2 = run(day1.state, { responseIntents: [pursueIntent(seed.id, record.id)] })
    // Venture spawned by the pursue response.
    expect(day2.state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.status).toBe('active')
    // A spawn cause was emitted (causality on commit).
    expect(
      day2.state.causes.some(
        (c) => c.tags.includes('teleology') && c.tags.includes('venture') && !c.target.startsWith('pressure'),
      ),
    ).toBe(true)

    // Next morning the openings module retires the committed opening and the
    // venture stage card replaces the opening card.
    const day3 = run(day2.state)
    const slice3 = day3.state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState
    expect(slice3.openings[record.id]).toBeUndefined()
    expect(seedsOf(day3.state).some((s) => s.family === 'opening')).toBe(false)
    expect(seedsOf(day3.state).some((s) => s.family === 'venture')).toBe(true)
  })

  it('decay/return: branch selection is causal — positive vs negative on the delta sign', () => {
    const snapshot = { respectable: 40, reliable: 40, factionRelationship: 40, patronage: 40 }
    const noMove = classifyReturnDelta(snapshot, { ...snapshot })
    expect(noMove.qualifies).toBe(false)

    const up = classifyReturnDelta(snapshot, { ...snapshot, respectable: 60 })
    expect(up.qualifies).toBe(true)
    expect(up.valence).toBe('positive')

    const down = classifyReturnDelta(snapshot, { ...snapshot, patronage: 20 })
    expect(down.qualifies).toBe(true)
    expect(down.valence).toBe('negative')
  })

  it('readOpeningMeters reads standing meters that exist at day 1', () => {
    const meters = readOpeningMeters(createInitialTavernState())
    expect(meters).toHaveProperty('respectable')
    expect(meters).toHaveProperty('factionRelationship')
    expect(typeof meters.patronage).toBe('number')
  })

  it('hand budget reserves teleology + triage slots when over budget', () => {
    const mk = (id: string, family: string, severity: number): IssueSeed =>
      ({ id, family, type: 'opportunity', severity } as unknown as IssueSeed)
    // Ranked high→low: many high-severity triage seeds, one low-severity opening last.
    const ranked: IssueSeed[] = [
      mk('t1', 'violence', 90),
      mk('t2', 'food_safety', 85),
      mk('t3', 'maintenance', 80),
      mk('t4', 'customer_complaint', 75),
      mk('t5', 'staff_burnout', 70),
      mk('t6', 'debt_rent', 65),
      mk('o1', 'opening', 40),
    ]
    const kept = applyHandBudget(ranked, DEFAULT_HAND_BUDGET)
    expect(kept).toHaveLength(DEFAULT_HAND_BUDGET.totalBudget)
    // The low-ranked teleology seed survives truncation via its reserved slot.
    expect(kept.some((s) => s.id === 'o1')).toBe(true)
    // Triage seeds also survive (not all crowded out by teleology).
    expect(kept.filter((s) => s.family !== 'opening').length).toBeGreaterThanOrEqual(
      DEFAULT_HAND_BUDGET.triageReserve,
    )
  })

  it('hand budget is a no-op under budget', () => {
    const mk = (id: string): IssueSeed => ({ id, family: 'maintenance', type: 'warning', severity: 50 } as unknown as IssueSeed)
    const ranked = [mk('a'), mk('b'), mk('c')]
    expect(applyHandBudget(ranked)).toHaveLength(3)
  })

  it('the daily hand holds within the budget', () => {
    const day1 = run()
    expect(seedsOf(day1.state).length).toBeLessThanOrEqual(DEFAULT_HAND_BUDGET.totalBudget)
  })

  it('teleology effects authored by the opening generator never target a pressure', () => {
    // Guardrail §9 — scan the real authored consequence-profile effects the
    // opening generator emits, assert ≥1 real effect, then assert none target
    // a pressure id.
    const day1 = run()
    const seeds = (day1.state.modules.issueSeeds as { seedsToday: IssueSeed[] }).seedsToday
    const openingSeeds = seeds.filter((s) => s.family === 'opening')
    expect(openingSeeds.length).toBeGreaterThanOrEqual(1)
    const effects = openingSeeds.flatMap((s) =>
      s.consequenceProfiles.flatMap((p) => [...p.immediateEffects, ...p.delayedEffects]),
    )
    expect(effects.length).toBeGreaterThanOrEqual(1)
    expect(effects.every((e) => !e.target.startsWith('pressure'))).toBe(true)
  })
})
