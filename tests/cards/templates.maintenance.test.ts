// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Integration tests for `maintenanceCard` — replaces the legacy
// `maintenanceWarning` template (deleted in this phase). Narrator-voiced
// (areas have no `castAttributes`), so every snippet pool is free of
// `voiceAxis` / `verbalTic` conditions. Variety comes from state
// perturbation (signals on area meters, pressures rising, memories,
// calendar tags, severity).

import { describe, expect, it } from 'vitest'

import {
  maintenanceCard,
  areaAtmosphereCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  maintenanceChoiceLabelPool,
  maintenanceEstablishingLinePool,
  maintenanceMannerNotePool,
  maintenanceReactionLinePool,
  maintenanceTitlePool,
} from '../../src/cards/compose/pools/maintenance'
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

function maintenanceSeed(
  id = 'maintenance-seed',
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
    family: 'maintenance' as IssueSeedFamilyId,
    type: 'maintenance_problem',
    timing: 'morning_prep',
    severity: overrides.severity ?? 55,
    domain: overrides.domain ?? ['areas', 'maintenance'],
    toneHints: overrides.toneHints ?? ['maintenance', 'risk'],
    location: { kind: 'area', id: areaId },
    responseSlots: [
      {
        id: `${id}-repair`,
        labelHint: `Repair ${areaId}`,
        allowedVerbs: ['repair'],
        shape: 'long_term_investment',
        targetOptions: [{ kind: 'area', id: areaId }],
        expectedEffects: ['raise area condition', 'spend coin'],
      },
      {
        id: `${id}-patch`,
        labelHint: 'Patch temporarily',
        allowedVerbs: ['repair'],
        shape: 'short_term_patch',
        targetOptions: [{ kind: 'area', id: areaId }],
        expectedEffects: ['small condition gain', 'cheap'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the damage',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['no cost'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-repair-profile`,
        responseSlotId: `${id}-repair`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `areas.${areaId}.damage`,
            amount: -25,
            readable: 'repair damage',
            tags: ['area'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -25,
            readable: 'pay for repair',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 8,
      },
      {
        id: `${id}-patch-profile`,
        responseSlotId: `${id}-patch`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: `areas.${areaId}.damage`,
            amount: -10,
            readable: 'patch damage',
            tags: ['area'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
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
      subject: 'visible damage',
      sensoryDetails: ['cracked plank', 'creaking timber'],
      recentContext: ['damage worsening over days'],
      stakesReadable: ['main room may collapse'],
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

function withAreaDamage(state: TavernState, areaId: string, damage: number): TavernState {
  return {
    ...state,
    areas: {
      ...state.areas,
      [areaId]: {
        ...state.areas[areaId]!,
        damage,
      },
    },
  }
}

const ESTABLISHING_TEXTS = new Set(
  maintenanceEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  maintenanceReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(maintenanceTitlePool.snippets.map((s) => s.text))

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

describe('maintenanceCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(maintenanceCard)
  })

  it('matches a maintenance / maintenance_problem / morning_prep seed', () => {
    const seed = maintenanceSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(maintenanceCard.id)
  })

  it('does not match the area_atmosphere family (areaAtmosphereCard owns that)', () => {
    const seed = makeSeed({
      family: 'area_atmosphere' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      location: { kind: 'area', id: 'main_room' },
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(maintenanceCard.id)
    expect(chosen?.id).toBe(areaAtmosphereCard.id)
  })

  it('falls back when no template can be selected at all (unknown timing)', () => {
    const seed = makeSeed({
      family: 'maintenance' as IssueSeedFamilyId,
      type: 'maintenance_problem',
      timing: 'closing',
      location: { kind: 'area', id: 'main_room' },
    })
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(maintenanceCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('maintenanceCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const view = maintenanceCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments or mechanical readouts', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const view = maintenanceCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('cracked plank')
      expect(line).not.toBe('creaking timber')
      expect(line).not.toBe('damage worsening over days')
      expect(line).not.toBe('main room may collapse')
      expect(line).not.toMatch(/damage \d+/)
      expect(line).not.toMatch(/condition \d+/)
    }
  })

  it('title carries the area label as `${area.label}: ${snippet}` prefix', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const view = maintenanceCard.render(seed, state)
    const area = state.areas['main_room']!
    expect(view.title.startsWith(`${area.label}: `)).toBe(true)
    const snippet = view.title.slice(`${area.label}: `.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
    // Legacy `pickAreaStateAdjective` prefix retired.
    expect(view.title).not.toMatch(/^(Dirty|Damaged|Smelly|Risky)\s/)
  })

  it('establishing_line fires the area.damage high signal snippet when damage is high', () => {
    const state = createInitialTavernState()
    const damaged = withAreaDamage(state, 'main_room', 80)
    const seed = maintenanceSeed('maintenance-damage-high')
    const view = maintenanceCard.render(seed, damaged)
    // Three valid sim-anchored rungs on this state. Phase 153 added the
    // damage=high × condition=mid spec-2 support; main_room defaults to
    // condition in the mid band, so the new combo cell is the deepest
    // matching rung and typically wins.
    expect([
      'The damage has crept past anything a wipe-down can hide.',
      'The damage is well past the line, and the pressure keeps climbing.',
      'Visible harm written into the wear of an average room.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the rising-pressure snippet when maintenance pressure trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'maintenance')
    const seed = maintenanceSeed('maintenance-pressure-rising')
    const view = maintenanceCard.render(seed, rising)
    // Either the pressure-only mid rung or the damage+pressure top rung
    // depending on the area's default damage band.
    expect([
      'Maintenance has been climbing on the board for days.',
      'The damage is well past the line, and the pressure keeps climbing.',
    ]).toContain(view.body[0])
  })

  it('establishing_line fires the warning-memory snippet when a warning memory is present', () => {
    const state = createInitialTavernState()
    const remembered = withMemory(state, 'maintenance_warning_seen', ['maintenance', 'warning'])
    const seed = maintenanceSeed('maintenance-warning-memory')
    const view = maintenanceCard.render(seed, remembered)
    expect(view.body[0]).toBe('The same warning has come round again from the last pass.')
  })

  it('reaction_line picks a tag-specific snippet when the seed names a risk-shaped tag', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed('maintenance-fire-risk', {
      toneHints: ['maintenance', 'fire_risk'],
    })
    const view = maintenanceCard.render(seed, state)
    expect(view.body[1]).toBe('A stray spark would find this and not let it go.')
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const view = maintenanceCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const view = maintenanceCard.render(seed, state)
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
    const seed = maintenanceSeed('maintenance-tag', { severity: 75 })
    const view = maintenanceCard.render(seed, state)
    expect(view.tag).toBe('maintenance')
    expect(view.severity).toBe(75)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const a = maintenanceCard.render(seed, state)
    const b = maintenanceCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = maintenanceSeed()
    const before = JSON.stringify(state)
    maintenanceCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('degrades gracefully when seed.location does not resolve to an area', () => {
    const state = createInitialTavernState()
    const seed = makeSeed({
      family: 'maintenance' as IssueSeedFamilyId,
      type: 'maintenance_problem',
      timing: 'morning_prep',
      // No location at all.
    })
    const view = maintenanceCard.render(seed, state)
    expect(view.title.length).toBeGreaterThan(0)
    expect(view.title).not.toContain(':')
    expect(view.body.length).toBeGreaterThan(0)
  })
})

describe('maintenanceCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (no actor would resolve)', () => {
    expect(poolHasActorCondition(maintenanceTitlePool)).toBe(false)
    expect(poolHasActorCondition(maintenanceEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(maintenanceReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(maintenanceMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(maintenanceChoiceLabelPool)).toBe(false)
  })
})
