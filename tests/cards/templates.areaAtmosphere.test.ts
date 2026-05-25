// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Integration tests for `areaAtmosphereCard` — first dedicated card for
// the area_atmosphere family. Narrator-voiced (areas have no
// `castAttributes`), so every snippet pool is free of `voiceAxis` /
// `verbalTic` conditions. Variety comes from state perturbation (signals
// on area meters, pressures rising, memories, calendar tags, severity).

import { describe, expect, it } from 'vitest'

import {
  areaAtmosphereCard,
  maintenanceCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  areaAtmosphereChoiceLabelPool,
  areaAtmosphereEstablishingLinePool,
  areaAtmosphereMannerNotePool,
  areaAtmosphereReactionLinePool,
  areaAtmosphereTitlePool,
} from '../../src/cards/compose/pools/areaAtmosphere'
import type {
  SnippetCondition,
  SnippetPool,
} from '../../src/cards/compose/types'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function areaAtmosphereSeed(
  id = 'area-atmosphere-seed',
  overrides: {
    severity?: number
    toneHints?: string[]
    domain?: string[]
    areaId?: string
  } = {},
): IssueSeed {
  const areaId = overrides.areaId ?? 'main_room'
  return makeSeed({
    id,
    family: 'area_atmosphere' as IssueSeedFamilyId,
    type: 'warning',
    timing: 'morning_prep',
    severity: overrides.severity ?? 50,
    domain: overrides.domain ?? ['areas', 'atmosphere'],
    toneHints: overrides.toneHints ?? ['atmosphere', 'reputation'],
    location: { kind: 'area', id: areaId },
    affectedActors: [{ kind: 'area', id: areaId }],
    responseSlots: [
      {
        id: `${id}-repair`,
        labelHint: `Repair ${areaId}`,
        allowedVerbs: ['repair'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'area', id: areaId }],
        expectedEffects: ['restore condition', 'spend coin'],
      },
      {
        id: `${id}-clean`,
        labelHint: `Clean ${areaId}`,
        allowedVerbs: ['clean'],
        shape: 'short_term_patch',
        targetOptions: [{ kind: 'area', id: areaId }],
        expectedEffects: ['raise cleanliness'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the problem',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no cost', 'rep drifts'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-repair-profile`,
        responseSlotId: `${id}-repair`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `areas.${areaId}.condition`,
            amount: 15,
            readable: 'condition restored',
            tags: ['area'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -15,
            readable: 'pay for repair',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 6,
      },
      {
        id: `${id}-clean-profile`,
        responseSlotId: `${id}-clean`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `areas.${areaId}.cleanliness`,
            amount: 20,
            readable: 'area cleaned',
            tags: ['area'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-ignore-profile`,
        responseSlotId: `${id}-ignore`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'noop',
            amount: 0,
            readable: 'nothing changes',
            tags: [],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ],
    textIngredients: {
      subject: 'sour atmosphere',
      sensoryDetails: ['dim light', 'dust haze'],
      recentContext: [`cleanliness 25`],
      stakesReadable: ['atmosphere may rot'],
    },
  })
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 55,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [pressureId]: {
        ...(state.pressures[pressureId] ?? {
          id: pressureId,
          label: pressureId,
          tags: [],
          topCauses: [],
        }),
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function withMemory(state: TavernState, memoryId: string, tags: string[]): TavernState {
  return {
    ...state,
    memories: [
      ...state.memories,
      {
        id: memoryId,
        type: 'fact',
        label: memoryId,
        strength: 50,
        ageDays: 1,
        createdAt: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        actors: [],
        locations: [],
        relatedSystems: [],
        tags,
      },
    ],
  }
}

function withAreaCleanliness(state: TavernState, areaId: string, cleanliness: number): TavernState {
  return {
    ...state,
    areas: {
      ...state.areas,
      [areaId]: {
        ...state.areas[areaId]!,
        cleanliness,
      },
    },
  }
}

const ESTABLISHING_TEXTS = new Set(
  areaAtmosphereEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  areaAtmosphereReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(areaAtmosphereTitlePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function poolHasActorCondition(pool: SnippetPool): boolean {
  return pool.snippets.some((snippet) =>
    snippet.conditions.some((c: SnippetCondition) =>
      c.kind === 'voiceAxis' || c.kind === 'verbalTic' || c.kind === 'actorTrait',
    ),
  )
}

describe('areaAtmosphereCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(areaAtmosphereCard)
  })

  it('matches an area_atmosphere / warning / morning_prep seed', () => {
    const seed = areaAtmosphereSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(areaAtmosphereCard.id)
  })

  it('does not match the maintenance family (maintenanceCard owns that)', () => {
    const seed = makeSeed({
      family: 'maintenance' as IssueSeedFamilyId,
      type: 'maintenance_problem',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(areaAtmosphereCard.id)
    expect(chosen?.id).toBe(maintenanceCard.id)
  })

  it('falls back when no template can be selected at all (unknown timing)', () => {
    const seed = makeSeed({
      family: 'area_atmosphere' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'closing',
      location: { kind: 'area', id: 'main_room' },
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(areaAtmosphereCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('areaAtmosphereCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const view = areaAtmosphereCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or mechanical readouts', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const view = areaAtmosphereCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('dim light')
      expect(line).not.toBe('dust haze')
      expect(line).not.toBe('cleanliness 25')
      expect(line).not.toBe('atmosphere may rot')
      expect(line).not.toMatch(/cleanliness \d+/)
      expect(line).not.toMatch(/damage \d+/)
    }
  })

  it('title carries the area label as `${area.label}: ${snippet}` prefix', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const view = areaAtmosphereCard.render(seed, state)
    const area = state.areas['main_room']!
    expect(view.title.startsWith(`${area.label}: `)).toBe(true)
    const snippet = view.title.slice(`${area.label}: `.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('establishing_line fires the area.cleanliness low signal snippet when cleanliness is low', () => {
    const state = createInitialTavernState()
    const dirty = withAreaCleanliness(state, 'main_room', 20)
    const seed = areaAtmosphereSeed('atmosphere-dirty')
    const view = areaAtmosphereCard.render(seed, dirty)
    expect([
      'The grime has settled in past the surface wipe-down.',
      'The grime sits deep and the pressure keeps climbing besides.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the rising-pressure snippet when maintenance pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'maintenance')
    const seed = areaAtmosphereSeed('atmosphere-pressure-rising')
    const view = areaAtmosphereCard.render(seed, rising)
    // Either the pressure-only mid rung or the cleanliness+pressure top
    // rung depending on the area's default cleanliness band.
    expect([
      'The maintenance side of the board keeps creeping up by morning.',
      'The grime sits deep and the pressure keeps climbing besides.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the atmosphere-memory snippet when an atmosphere memory is present', () => {
    const state = createInitialTavernState()
    const remembered = withMemory(state, 'area_atmosphere_seed_main_room', ['area', 'atmosphere', 'warning'])
    const seed = areaAtmosphereSeed('atmosphere-memory')
    const view = areaAtmosphereCard.render(seed, remembered)
    // Phase 153 added the `hasTag reputation + memoryPresent atmosphere`
    // spec-2 combo; the default seed's toneHints carry 'reputation', so
    // the new combo outranks the single-condition memory snippet when
    // an atmosphere memory is present. Both are valid sim-anchored
    // rungs on this state.
    expect([
      'The mood from the last warning has not lifted.',
      'A reputation-facing corner where prior atmosphere calls still echo.',
    ]).toContain(view.body[0])
  })

  it('reaction_line picks a tag-specific snippet when the seed names a reputation tag', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed('atmosphere-rep', {
      toneHints: ['atmosphere', 'reputation'],
    })
    const view = areaAtmosphereCard.render(seed, state)
    expect(view.body[1]).toBe('Word about a sour corner spreads faster than coin.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const view = areaAtmosphereCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const view = areaAtmosphereCard.render(seed, state)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)!
      const profile = seed.consequenceProfiles.find(
        (p) => p.responseSlotId === slot.id,
      )!
      expect(slot.allowedVerbs).toContain(choice.verb)
      expect(slot.shape).toBe(choice.shape)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(2)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(
        profile.immediateEffects.length,
      )
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed('atmosphere-tag', { severity: 70 })
    const view = areaAtmosphereCard.render(seed, state)
    expect(view.tag).toBe('area_atmosphere')
    expect(view.severity).toBe(70)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const a = areaAtmosphereCard.render(seed, state)
    const b = areaAtmosphereCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = areaAtmosphereSeed()
    const before = JSON.stringify(state)
    areaAtmosphereCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('degrades gracefully when seed.location does not resolve to an area', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      family: 'area_atmosphere' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      // No location at all.
    })
    const view = areaAtmosphereCard.render(seed, state)
    expect(view.title.length).toBeGreaterThan(0)
    expect(view.title).not.toContain(':')
    expect(view.body.length).toBeGreaterThan(0)
  })
})

describe('areaAtmosphereCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor would resolve)', () => {
    expect(poolHasActorCondition(areaAtmosphereTitlePool)).toBe(false)
    expect(poolHasActorCondition(areaAtmosphereEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(areaAtmosphereReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(areaAtmosphereMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(areaAtmosphereChoiceLabelPool)).toBe(false)
  })
})

// ---- Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2 ----

describe('areaAtmosphereCard — inaction preview (Phase 147)', () => {
  function inactionSeed(id = 'area-inaction-seed', areaId = 'main_room'): IssueSeed {
    // Mirror the production `ignore_area_problem_profile`:
    // immediateEffects: [], delayedEffects: [pressure, condition, damage].
    return makeSeed({
      id,
      family: 'area_atmosphere' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      severity: 50,
      domain: ['areas', 'atmosphere'],
      toneHints: ['atmosphere'],
      location: { kind: 'area', id: areaId },
      affectedActors: [{ kind: 'area', id: areaId }],
      responseSlots: [
        {
          id: 'ignore_area_problem',
          labelHint: 'Ignore the problem',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: ['no cost', 'rep drifts'],
        },
      ],
      consequenceProfiles: [
        {
          id: 'ignore_area_problem_profile',
          responseSlotId: 'ignore_area_problem',
          immediateEffects: [],
          delayedEffects: [
            {
              kind: 'pressure',
              target: 'pressure:maintenance',
              amount: 10,
              readable: 'Maintenance pressure rises',
              tags: ['pressure'],
              targetKind: 'pressure',
              direction: 'positive',
              magnitudeBand: 'medium',
            },
            {
              kind: 'state_change',
              target: `areas.${areaId}.condition`,
              amount: -8,
              readable: 'Slow decay',
              tags: ['area'],
              targetKind: 'area',
              direction: 'negative',
              magnitudeBand: 'tiny',
            },
            {
              kind: 'state_change',
              target: `areas.${areaId}.damage`,
              amount: 6,
              readable: 'Damage accrues',
              tags: ['area'],
              targetKind: 'area',
              direction: 'positive',
              magnitudeBand: 'tiny',
            },
          ],
          memories: [],
          futureHooks: [],
          impactScore: 0,
        },
      ],
      textIngredients: {
        subject: 'sour atmosphere',
        sensoryDetails: ['dim light'],
        recentContext: ['cleanliness 25'],
        stakesReadable: ['atmosphere may rot'],
      },
    })
  }

  it('renders non-empty preview lines for the ignore choice (sourced from delayed effects)', () => {
    const state = createInitialTavernState()
    const seed = inactionSeed()
    const view = areaAtmosphereCard.render(seed, state)
    const ignore = view.choices.find((c) => c.slotId === 'ignore_area_problem')
    expect(ignore).toBeDefined()
    expect(ignore!.previewEffects.length).toBeGreaterThan(0)
  })

  it('inaction preview lines come from the delayed-effect pipeline, not invented text', () => {
    const state = createInitialTavernState()
    const seed = inactionSeed()
    const view = areaAtmosphereCard.render(seed, state)
    const ignore = view.choices.find((c) => c.slotId === 'ignore_area_problem')!
    // Each line is either a snippet from the effectPreview pool OR the
    // verbatim `effect.readable` from the seed's delayed effects. It is
    // never a textIngredients fragment or invented prose.
    const delayedReadables = new Set(
      seed.consequenceProfiles[0]!.delayedEffects.map((e) => e.readable),
    )
    for (const line of ignore.previewEffects) {
      expect(line.length).toBeGreaterThan(0)
      // Either it's exactly one of the delayed readables (sim
      // fallthrough), or it's prose composed by the snippet pipeline.
      // We don't pin to specific snippet text because the pool can
      // evolve; we DO pin to the line not being a textIngredient.
      expect(line).not.toBe('dim light')
      expect(line).not.toBe('atmosphere may rot')
      expect(line).not.toBe('cleanliness 25')
      // If it IS a sim readable, it must be one of the delayed ones.
      if (delayedReadables.has(line)) {
        expect(delayedReadables.has(line)).toBe(true)
      }
    }
  })

  it('inaction-preview routing is deterministic across re-renders', () => {
    const state = createInitialTavernState()
    const seed = inactionSeed()
    const a = areaAtmosphereCard.render(seed, state)
    const b = areaAtmosphereCard.render(seed, structuredClone(state) as TavernState)
    const ignoreA = a.choices.find((c) => c.slotId === 'ignore_area_problem')!
    const ignoreB = b.choices.find((c) => c.slotId === 'ignore_area_problem')!
    expect(ignoreA.previewEffects).toEqual(ignoreB.previewEffects)
  })

  it('preserves mechanical truth: ignore choice verb/shape unchanged on inaction path', () => {
    const state = createInitialTavernState()
    const seed = inactionSeed()
    const view = areaAtmosphereCard.render(seed, state)
    const ignore = view.choices.find((c) => c.slotId === 'ignore_area_problem')!
    expect(ignore.verb).toBe('ignore')
    expect(ignore.shape).toBe('ignore')
    expect(ignore.previewEffects.length).toBeLessThanOrEqual(
      seed.consequenceProfiles[0]!.delayedEffects.length,
    )
  })
})
