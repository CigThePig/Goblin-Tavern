// Phase 95 — Tests for the new `attributionHints` and `nicknames`
// fields on `TavernIdentityData`.

import { describe, expect, it } from 'vitest'

import { buildWorldOverview } from '../../src/reports/worldOverviewProjection'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withModuleState } from '../../src/sim/testing/stateFactories'
import type {
  AttributionModuleState,
  AttributionState,
  AttributionType,
  AttributionAccuracy,
} from '../../src/sim/modules/attribution/attributionTypes'
import type {
  CalendarStamp,
  EntityRef,
  SocialRumourState,
  TavernState,
} from '../../src/sim/state/TavernState'

function stampZero(): CalendarStamp {
  return { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 }
}

function makeAttribution(
  i: number,
  patch: Partial<AttributionState> = {},
): AttributionState {
  const perceivedBy: EntityRef = { kind: 'regular', id: `regular-${i}` }
  const target: EntityRef = { kind: 'tavern_identity', id: 'self' }
  return {
    id: `attr-${i}`,
    timestamp: stampZero(),
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy,
    target,
    attributionType: 'credit' as AttributionType,
    accuracy: 'true' as AttributionAccuracy,
    strength: 70,
    confidence: 70,
    publicness: 70,
    volatility: 20,
    readable: `attribution ${i}`,
    tags: [],
    relatedSystems: [],
    ageDays: 0,
    ...patch,
  }
}

function withAttributions(
  state: TavernState,
  attributions: AttributionState[],
): TavernState {
  const slice: AttributionModuleState = {
    attributions,
    generatedToday: [],
    lastUpdatedDay: 0,
    recentDistrustByRumour: {},
  }
  return withModuleState(state, 'attribution', slice)
}

function makeRumour(
  id: string,
  patch: Partial<SocialRumourState> = {},
): SocialRumourState {
  return {
    id,
    label: id,
    strength: 60,
    accuracy: 'true',
    firstHeardDay: 0,
    lastSpreadDay: 0,
    tags: [],
    ...patch,
  }
}

// ---------- attributionHints ----------

describe('TavernIdentityData.attributionHints', () => {
  it('is empty when there is no attribution slice', () => {
    const out = buildWorldOverview(createInitialTavernState())
    expect(out.identity.attributionHints).toEqual([])
  })

  it('is empty when no attribution meets thresholds', () => {
    const attrs = [
      makeAttribution(1, { publicness: 30, strength: 80 }), // publicness too low
      makeAttribution(2, { publicness: 80, strength: 30 }), // strength too low
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints).toEqual([])
  })

  it('produces a hint when public + strong', () => {
    const attrs = [
      makeAttribution(1, {
        attributionType: 'credit',
        publicness: 80,
        strength: 80,
      }),
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints.length).toBeGreaterThan(0)
    expect(out.identity.attributionHints[0]).toMatch(/credit/i)
  })

  it('dedups per (perceiver kind, attribution type)', () => {
    const attrs = [
      makeAttribution(1, {
        attributionType: 'credit',
        publicness: 80,
        strength: 80,
      }),
      makeAttribution(2, {
        attributionType: 'credit',
        publicness: 80,
        strength: 80,
      }),
      makeAttribution(3, {
        attributionType: 'credit',
        publicness: 80,
        strength: 80,
      }),
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints.length).toBe(1)
  })

  it('caps at 4 hints', () => {
    // Many different perceiver kinds + types to exceed the cap.
    const attrs: AttributionState[] = []
    let i = 1
    const kinds: EntityRef['kind'][] = [
      'regular',
      'faction',
      'culture',
      'notable_npc',
      'customer_group',
    ]
    for (const kind of kinds) {
      for (const type of ['credit', 'blame', 'trust'] as AttributionType[]) {
        attrs.push(
          makeAttribution(i++, {
            perceivedBy: { kind, id: `${kind}-${i}` },
            attributionType: type,
            publicness: 80,
            strength: 80,
          }),
        )
      }
    }
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints.length).toBeLessThanOrEqual(4)
  })

  it('marks false / partial attributions as "perhaps wrongly"', () => {
    const attrs = [
      makeAttribution(1, {
        attributionType: 'blame',
        accuracy: 'false',
        publicness: 80,
        strength: 80,
      }),
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints[0]).toMatch(/wrongly/i)
  })

  it('skips attributions with unknown accuracy', () => {
    const attrs = [
      makeAttribution(1, {
        accuracy: 'unknown',
        publicness: 80,
        strength: 80,
      }),
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const out = buildWorldOverview(state)
    expect(out.identity.attributionHints).toEqual([])
  })

  it('is deterministic across builds', () => {
    const attrs = [
      makeAttribution(1, { publicness: 80, strength: 80 }),
      makeAttribution(2, { publicness: 80, strength: 80, attributionType: 'blame' }),
    ]
    const state = withAttributions(createInitialTavernState(), attrs)
    const a = buildWorldOverview(state)
    const b = buildWorldOverview(state)
    expect(a.identity.attributionHints).toEqual(b.identity.attributionHints)
  })
})

// ---------- nicknames ----------

describe('TavernIdentityData.nicknames', () => {
  it('is empty when no rumours are tagged nickname', () => {
    const out = buildWorldOverview(createInitialTavernState())
    expect(out.identity.nicknames).toEqual([])
  })

  it('surfaces nickname-tagged rumours', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['r1'] = makeRumour('r1', {
      label: 'The Soup Hole',
      tags: ['nickname'],
      strength: 70,
    })
    const out = buildWorldOverview(state)
    expect(out.identity.nicknames).toContain('The Soup Hole')
  })

  it('excludes accuracy: false rumours', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['r1'] = makeRumour('r1', {
      label: 'Liar Tavern',
      tags: ['nickname'],
      accuracy: 'false',
      strength: 90,
    })
    const out = buildWorldOverview(state)
    expect(out.identity.nicknames).not.toContain('Liar Tavern')
  })

  it('caps at 2 entries', () => {
    const state = createInitialTavernState()
    for (let i = 0; i < 5; i += 1) {
      state.world.socialRumours[`r${i}`] = makeRumour(`r${i}`, {
        label: `Nick ${i}`,
        tags: ['nickname'],
        strength: 50 + i, // higher i = higher strength
      })
    }
    const out = buildWorldOverview(state)
    expect(out.identity.nicknames.length).toBeLessThanOrEqual(2)
  })

  it('orders by strength desc', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['low'] = makeRumour('low', {
      label: 'Low Strength',
      tags: ['nickname'],
      strength: 20,
    })
    state.world.socialRumours['high'] = makeRumour('high', {
      label: 'High Strength',
      tags: ['nickname'],
      strength: 90,
    })
    const out = buildWorldOverview(state)
    expect(out.identity.nicknames[0]).toBe('High Strength')
  })

  it('is deterministic across builds', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['r1'] = makeRumour('r1', {
      label: 'A Name',
      tags: ['nickname'],
    })
    const a = buildWorldOverview(state)
    const b = buildWorldOverview(state)
    expect(a.identity.nicknames).toEqual(b.identity.nicknames)
  })

  it('skips non-nickname rumours', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['r1'] = makeRumour('r1', {
      label: 'Some Other Rumour',
      tags: ['gossip', 'scandal'],
    })
    const out = buildWorldOverview(state)
    expect(out.identity.nicknames).toEqual([])
  })
})

// ---------- non-mutation ----------

describe('TavernIdentityData non-mutation', () => {
  it('does not mutate state when extracting hints', () => {
    const state = createInitialTavernState()
    state.world.socialRumours['r1'] = makeRumour('r1', {
      label: 'Test',
      tags: ['nickname'],
    })
    const before = JSON.stringify(state)
    buildWorldOverview(state)
    const after = JSON.stringify(state)
    expect(after).toBe(before)
  })
})
