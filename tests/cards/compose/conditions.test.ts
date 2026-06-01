// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Unit tests for `evalCondition`. One positive and one negative case
// per condition kind. The two voice forms (`voiceAxis`, `verbalTic`)
// also cover their forward-seam edges: missing actor, missing cast
// attributes — both must return `false` silently.

import { describe, expect, it } from 'vitest'

import { evalCondition } from '../../../src/cards/compose/conditions'
import type { SnippetCondition } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  CastAttributes,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
} from '../../../src/sim/content/cast'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects at least one starter regular')
  return id
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function setCastAttributes(
  state: TavernState,
  regularId: string,
  attributes: CastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          castAttributes: attributes,
        },
      },
    },
  }
}

function castWith(opts: {
  axes?: Partial<Record<VoiceAxisId, VoiceAxisValue>>
  verbalTic?: VerbalTicId
}): CastAttributes {
  return {
    specialty: 'gossip',
    blindspot: 'war_story',
    affinities: [],
    voice: {
      axes: {
        terseness: 1,
        warmth: 1,
        formality: 1,
        floridity: 1,
        ...(opts.axes ?? {}),
      },
      ...(opts.verbalTic !== undefined ? { verbalTic: opts.verbalTic } : {}),
    },
  }
}

function seedWith(overrides: Parameters<typeof makeSeed>[0] = {}): IssueSeed {
  return makeSeed({
    family: 'regular_customer' as IssueSeedFamilyId,
    type: 'relationship_test',
    timing: 'during_service',
    severity: 50,
    domain: ['regulars', 'social'],
    ...overrides,
  })
}

describe('evalCondition — seed-shape primitives', () => {
  const state = createInitialTavernState()
  const seed = seedWith()

  it('seedFamily matches anyOf', () => {
    const yes: SnippetCondition = { kind: 'seedFamily', anyOf: ['regular_customer'] }
    const no: SnippetCondition = { kind: 'seedFamily', anyOf: ['food_safety'] }
    expect(evalCondition(yes, seed, state)).toBe(true)
    expect(evalCondition(no, seed, state)).toBe(false)
  })

  it('seedType matches anyOf', () => {
    expect(
      evalCondition({ kind: 'seedType', anyOf: ['relationship_test'] }, seed, state),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'seedType', anyOf: ['complaint'] }, seed, state),
    ).toBe(false)
  })

  it('timing matches anyOf', () => {
    expect(
      evalCondition({ kind: 'timing', anyOf: ['during_service'] }, seed, state),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'timing', anyOf: ['end_week'] }, seed, state),
    ).toBe(false)
  })

  it('severityAtLeast / severityBelow', () => {
    expect(
      evalCondition({ kind: 'severityAtLeast', value: 50 }, seed, state),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'severityAtLeast', value: 80 }, seed, state),
    ).toBe(false)
    expect(
      evalCondition({ kind: 'severityBelow', value: 80 }, seed, state),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'severityBelow', value: 10 }, seed, state),
    ).toBe(false)
  })

  it('hasTag inspects domain + toneHints + stake tags', () => {
    // domain hit
    expect(evalCondition({ kind: 'hasTag', tag: 'social' }, seed, state)).toBe(true)
    // miss
    expect(evalCondition({ kind: 'hasTag', tag: 'banana' }, seed, state)).toBe(false)
    // toneHints hit
    const tonedSeed = seedWith({ toneHints: ['quiet'] })
    expect(evalCondition({ kind: 'hasTag', tag: 'quiet' }, tonedSeed, state)).toBe(true)
  })

  it('hasNamedEntity filters by role and kind', () => {
    const namedSeed = seedWith({
      textIngredients: {
        namedEntities: [
          { role: 'complainant', ref: regularRef('foo'), displayName: 'Foo' },
        ],
      },
    })
    expect(
      evalCondition({ kind: 'hasNamedEntity', role: 'complainant' }, namedSeed, state),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'hasNamedEntity', role: 'complainant', entityKind: 'regular' },
        namedSeed,
        state,
      ),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'hasNamedEntity', role: 'complainant', entityKind: 'staff' },
        namedSeed,
        state,
      ),
    ).toBe(false)
    expect(
      evalCondition({ kind: 'hasNamedEntity', role: 'someone_else' }, namedSeed, state),
    ).toBe(false)
    // no namedEntities at all
    expect(
      evalCondition({ kind: 'hasNamedEntity' }, seed, state),
    ).toBe(false)
  })
})

describe('evalCondition — state-lookup primitives', () => {
  it('pressureRising reads either the snapshot or the on-state shape', () => {
    const base = createInitialTavernState()
    const seed = seedWith()
    // Inject a rising pressure on the on-state surface.
    const rising: TavernState = {
      ...base,
      pressures: {
        ...base.pressures,
        food_safety: {
          id: 'food_safety',
          label: 'Food safety',
          value: 40,
          trend: 5,
          tags: [],
          topCauses: [],
        },
      },
    }
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'food_safety' }, seed, rising),
    ).toBe(true)
    // Falling — trend ≤ 0.
    const flat: TavernState = {
      ...rising,
      pressures: {
        ...rising.pressures,
        food_safety: { ...rising.pressures['food_safety']!, trend: 0 },
      },
    }
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'food_safety' }, seed, flat),
    ).toBe(false)
    // Missing pressure.
    expect(
      evalCondition({ kind: 'pressureRising', pressureId: 'unknown_pressure' }, seed, base),
    ).toBe(false)
  })

  it('memoryPresent matches any memory when tag is omitted', () => {
    const base = createInitialTavernState()
    const seed = seedWith()
    const cal = base.calendar
    const withMemory: TavernState = {
      ...base,
      memories: [
        ...base.memories,
        {
          id: 'mem-1',
          type: 'fact',
          strength: 50,
          ageDays: 0,
          createdAt: {
            year: cal.year,
            month: cal.month,
            week: cal.week,
            day: cal.day,
            absoluteDay: cal.totalDaysElapsed,
          },
          actors: [],
          locations: [],
          relatedSystems: [],
          tags: ['ale_complaint'],
        },
      ],
    }
    expect(evalCondition({ kind: 'memoryPresent' }, seed, withMemory)).toBe(true)
    expect(
      evalCondition({ kind: 'memoryPresent', tag: 'ale_complaint' }, seed, withMemory),
    ).toBe(true)
    expect(
      evalCondition({ kind: 'memoryPresent', tag: 'not_a_real_tag' }, seed, withMemory),
    ).toBe(false)
  })
})

describe('evalCondition — memoryPresent scopeToActor + minAgeDays (Phase 187 / ISSUE-154)', () => {
  const merchantsRef: EntityRef = { kind: 'customer_group', id: 'merchants' }

  function stateWithComplaintMemory(opts: {
    actorId: string
    ageDays: number
  }): TavernState {
    const base = createInitialTavernState()
    const cal = base.calendar
    return {
      ...base,
      memories: [
        ...base.memories,
        {
          id: 'complaint-mem',
          type: 'timed',
          strength: 35,
          ageDays: opts.ageDays,
          createdAt: {
            year: cal.year,
            month: cal.month,
            week: cal.week,
            day: cal.day,
            absoluteDay: cal.totalDaysElapsed - opts.ageDays,
          },
          actors: [{ kind: 'customer_group', id: opts.actorId }],
          locations: [],
          relatedSystems: ['customers'],
          tags: ['customers', opts.actorId, 'complaint'],
        },
      ],
    }
  }

  const seed = seedWith({ primaryActor: merchantsRef })
  const scoped: SnippetCondition = {
    kind: 'memoryPresent',
    tag: 'complaint',
    scopeToActor: 'primaryActor',
    minAgeDays: 1,
  }

  it('matches the actor’s own complaint memory once it predates today', () => {
    const state = stateWithComplaintMemory({ actorId: 'merchants', ageDays: 1 })
    expect(evalCondition(scoped, seed, state)).toBe(true)
  })

  it('rejects a same-day complaint memory (minAgeDays not met)', () => {
    const state = stateWithComplaintMemory({ actorId: 'merchants', ageDays: 0 })
    expect(evalCondition(scoped, seed, state)).toBe(false)
  })

  it('rejects a different group’s complaint memory (scopeToActor)', () => {
    const state = stateWithComplaintMemory({ actorId: 'miners', ageDays: 5 })
    expect(evalCondition(scoped, seed, state)).toBe(false)
  })

  it('returns false when the scoped actor does not resolve', () => {
    const state = stateWithComplaintMemory({ actorId: 'merchants', ageDays: 1 })
    const noActor = seedWith() // seedWith() omits primaryActor by default
    expect(evalCondition(scoped, seed, state)).toBe(true)
    expect(evalCondition(scoped, noActor, state)).toBe(false)
  })

  it('default semantics unchanged when scopeToActor/minAgeDays are omitted', () => {
    // A same-day, cross-group complaint memory still satisfies the plain
    // tag-only condition — proving the optional fields are additive.
    const state = stateWithComplaintMemory({ actorId: 'miners', ageDays: 0 })
    expect(
      evalCondition({ kind: 'memoryPresent', tag: 'complaint' }, seed, state),
    ).toBe(true)
  })
})

describe('evalCondition — repeatCount (Phase 127 / ISSUE-096 — wired)', () => {
  // Phase 127 wired this condition against memory-tag counts in a
  // rolling window. The full window-arithmetic coverage lives in
  // tests/sim/phase127.repeats.test.ts; here we just confirm the DSL
  // arm calls into the signal layer correctly.
  it('returns false when no memories carry the tag', () => {
    const state = createInitialTavernState()
    const seed = seedWith()
    expect(
      evalCondition(
        { kind: 'repeatCount', subjectTag: 'ale_complaint', atLeast: 2 },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('returns true once enough recent memories carry the tag', () => {
    const base = createInitialTavernState()
    const seed = seedWith()
    const cal = base.calendar
    const stamp = (offsetDays: number) => ({
      year: cal.year,
      month: cal.month,
      week: cal.week,
      day: cal.day,
      absoluteDay: cal.totalDaysElapsed - offsetDays,
    })
    const withMemories: TavernState = {
      ...base,
      memories: [
        {
          id: 'm1',
          type: 'fact',
          strength: 50,
          ageDays: 0,
          createdAt: stamp(0),
          actors: [],
          locations: [],
          relatedSystems: [],
          tags: ['ale_complaint'],
        },
        {
          id: 'm2',
          type: 'fact',
          strength: 50,
          ageDays: 7,
          createdAt: stamp(7),
          actors: [],
          locations: [],
          relatedSystems: [],
          tags: ['ale_complaint'],
        },
      ],
    }
    expect(
      evalCondition(
        { kind: 'repeatCount', subjectTag: 'ale_complaint', atLeast: 2 },
        seed,
        withMemories,
      ),
    ).toBe(true)
    expect(
      evalCondition(
        { kind: 'repeatCount', subjectTag: 'ale_complaint', atLeast: 3 },
        seed,
        withMemories,
      ),
    ).toBe(false)
  })
})

describe('evalCondition — forward-seam primitives (always false today)', () => {
  const state = createInitialTavernState()
  const seed = seedWith()

  it('actorTrait is always false until actors carry trait strings', () => {
    expect(
      evalCondition(
        { kind: 'actorTrait', role: 'primaryActor', trait: 'proud' },
        seed,
        state,
      ),
    ).toBe(false)
  })
})

describe('evalCondition — voiceAxis (Phase B bridge)', () => {
  const base = createInitialTavernState()
  const regularId = firstRegularId(base)
  const seed = seedWith({ primaryActor: regularRef(regularId) })

  it('atLeast matches when the axis is at or above the threshold', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ axes: { terseness: 2 } }),
    )
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('atLeast fails when the axis is below the threshold', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ axes: { terseness: 1 } }),
    )
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('atMost matches when the axis is at or below the threshold', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ axes: { warmth: 0 } }),
    )
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('atMost fails when the axis is above the threshold', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ axes: { warmth: 1 } }),
    )
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('returns false when the resolved actor has no castAttributes', () => {
    // Strip cast attributes off the resolved regular via destructuring
    // (exactOptionalPropertyTypes rejects an explicit `undefined`).
    const original = base.world.regulars[regularId]!
    const { castAttributes: _strip, ...rest } = original
    void _strip
    const state: TavernState = {
      ...base,
      world: {
        ...base.world,
        regulars: { ...base.world.regulars, [regularId]: rest },
      },
    }
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('returns false when the seed has no primaryActor', () => {
    // Default seedWith() already omits primaryActor.
    const orphanSeed = seedWith()
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        orphanSeed,
        base,
      ),
    ).toBe(false)
  })

  it('resolves named-entity roles for non-primaryActor lookups', () => {
    const namedSeed = seedWith({
      textIngredients: {
        namedEntities: [
          {
            role: 'complainant',
            ref: regularRef(regularId),
            displayName: 'Test',
          },
        ],
      },
    })
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ axes: { warmth: 2 } }),
    )
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'complainant', axis: 'warmth', atLeast: 2 },
        namedSeed,
        state,
      ),
    ).toBe(true)
  })

  it('returns false for actors whose kind has no cast surface', () => {
    const supplierSeed = seedWith({
      primaryActor: { kind: 'supplier', id: 'phantom' },
    })
    expect(
      evalCondition(
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        supplierSeed,
        base,
      ),
    ).toBe(false)
  })
})

describe('evalCondition — verbalTic (Phase B bridge)', () => {
  const base = createInitialTavernState()
  const regularId = firstRegularId(base)
  const seed = seedWith({ primaryActor: regularRef(regularId) })

  it('matches when the actor carries the named tic', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ verbalTic: 'trails_off' }),
    )
    expect(
      evalCondition(
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
        seed,
        state,
      ),
    ).toBe(true)
  })

  it('fails when the actor carries a different tic', () => {
    const state = setCastAttributes(
      base,
      regularId,
      castWith({ verbalTic: 'understates' }),
    )
    expect(
      evalCondition(
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
        seed,
        state,
      ),
    ).toBe(false)
  })

  it('fails when the actor carries no tic at all', () => {
    const state = setCastAttributes(base, regularId, castWith({}))
    expect(
      evalCondition(
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
        seed,
        state,
      ),
    ).toBe(false)
  })
})
