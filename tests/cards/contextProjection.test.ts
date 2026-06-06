import { describe, expect, it } from 'vitest'

import { buildCardContext } from '../../src/cards/contextProjection'
import { fallbackCard, customerComplaintCard } from '../../src/cards/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { CauseEntry } from '../../src/sim/state/TavernState'
import type { PressureSnapshot } from '../../src/sim/modules/pressures/pressureTypes'
import { makeSeed, ZERO_STAMP } from './cardFactories'

function cause(overrides: Partial<CauseEntry> = {}): CauseEntry {
  const entry: CauseEntry = {
    id: overrides.id ?? 'cause-1',
    timestamp: overrides.timestamp ?? ZERO_STAMP,
    source: overrides.source ?? 'service',
    sourceType: overrides.sourceType ?? 'service',
    target: overrides.target ?? 'pressure:stock_shortage',
    targetType: overrides.targetType ?? 'pressure',
    amount: overrides.amount ?? 8,
    direction: overrides.direction ?? 'increase',
    weight: overrides.weight ?? 8,
    readable: overrides.readable ?? 'yesterday’s rush emptied the pantry',
    tags: overrides.tags ?? [],
    relatedActors: overrides.relatedActors ?? [],
    relatedLocations: overrides.relatedLocations ?? [],
    relatedSystems: overrides.relatedSystems ?? [],
    ageDays: overrides.ageDays ?? 0,
  }
  if (overrides.expiresAfterDays !== undefined) {
    entry.expiresAfterDays = overrides.expiresAfterDays
  }
  return entry
}

function pressure(overrides: Partial<PressureSnapshot> = {}): PressureSnapshot {
  return {
    id: overrides.id ?? 'stock_shortage',
    label: overrides.label ?? 'Stock shortage',
    value: overrides.value ?? 74,
    previousValue: overrides.previousValue ?? 61,
    delta: overrides.delta ?? 13,
    trend: overrides.trend ?? 'rising',
    severity: overrides.severity ?? 74,
    urgency: overrides.urgency ?? 68,
    volatility: overrides.volatility ?? 13,
    causes: overrides.causes ?? [],
    relatedActors: overrides.relatedActors ?? [],
    relatedLocations: overrides.relatedLocations ?? [],
    relatedSystems: overrides.relatedSystems ?? [],
    tags: overrides.tags ?? [],
    consequences: overrides.consequences ?? [],
    lastUpdated: overrides.lastUpdated ?? ZERO_STAMP,
  }
}

describe('buildCardContext', () => {
  const state = createInitialTavernState()

  it('projects sorted seed causes as cause context lines', () => {
    const seed = makeSeed({
      causes: [
        cause({ id: 'low', readable: 'small supplier delay', weight: 2 }),
        cause({ id: 'high', readable: 'missed market delivery', weight: 9 }),
      ],
    })

    const context = buildCardContext(seed, state)

    expect(context.causes[0]?.readable).toBe('missed market delivery')
    expect(context.causes[0]?.source).toBe('seed_cause')
  })

  it('projects pressure snapshots as why-now lines when no causes exist', () => {
    const seed = makeSeed({
      causes: [],
      pressures: [pressure({ label: 'Staff burnout', trend: 'rising' })],
      textIngredients: { pressureContext: [] },
    })

    const context = buildCardContext(seed, state)

    expect(context.causes).toHaveLength(0)
    expect(
      context.whyNow.some((line) => line.source === 'pressure_snapshot'),
    ).toBe(true)
    expect(context.whyNow[0]?.readable).toContain('Staff burnout')
  })

  it('projects relevant memories and recent context into history', () => {
    const seed = makeSeed({
      textIngredients: {
        relevantMemories: ['regulars remember watered ale'],
        recentContext: ['the cook noticed at midday'],
      },
    })

    const context = buildCardContext(seed, state)

    expect(context.history.map((line) => line.readable)).toContain(
      'regulars remember watered ale',
    )
  })

  it('projects future hooks and stakes into future pressure', () => {
    const seed = makeSeed({
      futureHooks: [{ id: 'hook-1', label: 'supplier trust will be tested' }],
      stakes: [
        {
          id: 'stake-1',
          target: 'supplier.reliability',
          readable: 'supplier terms may worsen',
          direction: 'risk',
          tags: [],
        },
      ],
    })

    const context = buildCardContext(seed, state)

    expect(context.future[0]?.readable).toBe('supplier trust will be tested')
    expect(context.future.map((line) => line.readable)).toContain(
      'supplier terms may worsen',
    )
  })

  it('sparse seeds get a minimal why-now fallback without fabricated causes', () => {
    const seed = makeSeed({
      severity: 20,
      urgency: 20,
      cardWorthiness: 20,
      causes: [],
      pressures: [],
      stakes: [],
      textIngredients: {
        pressureContext: [],
        relevantMemories: [],
        recentContext: [],
        stakesReadable: [],
      },
    })

    const context = buildCardContext(seed, state)

    expect(context.whyNow[0]?.source).toBe('fallback')
    expect(context.causes).toHaveLength(0)
  })

  it('dedupes context lines across sections where practical', () => {
    const seed = makeSeed({
      causes: [cause({ readable: 'same backed fragment' })],
      textIngredients: { relevantMemories: ['same backed fragment'] },
    })

    const context = buildCardContext(seed, state)
    const allLines = [
      ...context.whyNow,
      ...context.causes,
      ...context.history,
      ...context.future,
    ].map((line) => line.readable.toLowerCase())

    expect(
      allLines.filter((line) => line === 'same backed fragment'),
    ).toHaveLength(1)
  })
})

describe('card rendering context contract', () => {
  const state = createInitialTavernState()

  it('fallback cards receive minimal context but do not fabricate causes', () => {
    const seed = makeSeed({
      family: 'rival_tavern',
      severity: 20,
      urgency: 20,
      cardWorthiness: 20,
      causes: [],
      pressures: [],
      textIngredients: { pressureContext: [], recentContext: [] },
    })

    const view = fallbackCard.render(seed, state)

    expect(view.context?.whyNow.length).toBeGreaterThan(0)
    expect(view.context?.causes).toHaveLength(0)
  })

  it('customer complaint keeps cause body prose while exposing separate cause context', () => {
    const groupId = Object.keys(state.customerGroups)[0]!
    const seed = makeSeed({
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
      primaryActor: { kind: 'customer_group', id: groupId },
      affectedActors: [{ kind: 'customer_group', id: groupId }],
      causes: [
        cause({
          readable: 'the floor stayed dirty through lunch',
          target: 'area:main_room',
          targetType: 'area',
        }),
      ],
      textIngredients: {
        subject: 'tired regulars',
        perceivedBlame: ['the floor stayed dirty through lunch'],
      },
    })

    const view = customerComplaintCard.render(seed, state)

    expect(view.body.join(' ')).not.toContain(
      'the floor stayed dirty through lunch',
    )
    expect(view.context?.causes[0]?.readable).toBe('the floor stayed dirty through lunch')
  })
})
