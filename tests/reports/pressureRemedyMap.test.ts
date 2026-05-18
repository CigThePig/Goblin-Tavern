// Phase 97 — Pressure-remedy map invariants.
//
// The mapping table is read-only data, but it's load-bearing for the
// missed-opportunity projection: a typo in an action id or a stale
// pressure id would produce silent dropouts. These tests turn those
// kinds of drift into hard failures.

import { describe, expect, it } from 'vitest'

import {
  PRESSURE_REMEDIES,
  resolveRemedyTarget,
  type RemedyEntry,
} from '../../src/reports/pressureRemedyMap'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import {
  PRESSURE_IDS,
  EXPANDED_PRESSURE_IDS,
} from '../../src/sim/modules/pressures/pressureTypes'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  PressureSnapshot,
} from '../../src/sim/modules/pressures/pressureTypes'
import type { EntityRef } from '../../src/sim/state/TavernState'

const VALID_ENTITY_KINDS: ReadonlySet<EntityRef['kind'] | 'global'> = new Set<
  EntityRef['kind'] | 'global'
>([
  'staff',
  'customer_group',
  'area',
  'stock',
  'role',
  'system',
  'other',
  'culture',
  'faction',
  'supplier',
  'regular',
  'notable_npc',
  'local_event',
  'rumour',
  'tavern_identity',
  'recipe',
  'global',
])

function makeSnapshot(overrides: Partial<PressureSnapshot> = {}): PressureSnapshot {
  return {
    id: 'food_safety',
    label: 'Food Safety',
    value: 50,
    previousValue: 40,
    delta: 10,
    trend: 'rising',
    severity: 60,
    urgency: 40,
    volatility: 10,
    causes: [],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    tags: [],
    consequences: [],
    lastUpdated: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 1 },
    ...overrides,
  }
}

describe('PRESSURE_REMEDIES — table invariants', () => {
  const ALL_PRESSURE_IDS: readonly string[] = [
    ...PRESSURE_IDS,
    ...EXPANDED_PRESSURE_IDS,
  ]

  it('every key references a real pressure id', () => {
    const valid = new Set<string>(ALL_PRESSURE_IDS)
    for (const key of Object.keys(PRESSURE_REMEDIES)) {
      expect(valid.has(key), `unknown pressure id '${key}'`).toBe(true)
    }
  })

  it('every pressure id has an explicit entry — no silent gaps', () => {
    for (const id of ALL_PRESSURE_IDS) {
      expect(
        Object.prototype.hasOwnProperty.call(PRESSURE_REMEDIES, id),
        `pressure '${id}' missing from PRESSURE_REMEDIES (empty array if no remedy)`,
      ).toBe(true)
    }
  })

  it('every remedy actionId exists in actionRegistry', () => {
    for (const [pressureId, remedies] of Object.entries(PRESSURE_REMEDIES)) {
      for (const remedy of remedies) {
        expect(
          actionRegistry.has(remedy.actionId),
          `pressure '${pressureId}' remedy action '${remedy.actionId}' not in registry`,
        ).toBe(true)
      }
    }
  })

  it('every remedy targetKind is a valid EntityRef kind', () => {
    for (const [pressureId, remedies] of Object.entries(PRESSURE_REMEDIES)) {
      for (const remedy of remedies) {
        expect(
          VALID_ENTITY_KINDS.has(remedy.targetKind),
          `pressure '${pressureId}' remedy '${remedy.actionId}' has invalid kind '${remedy.targetKind}'`,
        ).toBe(true)
      }
    }
  })
})

describe('resolveRemedyTarget', () => {
  const state = createInitialTavernState()

  it('returns undefined for global remedies', () => {
    const remedy: RemedyEntry = { actionId: 'clean_area', targetKind: 'global' }
    const target = resolveRemedyTarget(state, makeSnapshot(), remedy)
    expect(target).toBeUndefined()
  })

  it('prefers an id from preferTargetIds when it exists in state', () => {
    const remedy: RemedyEntry = {
      actionId: 'fumigate_cellar',
      targetKind: 'area',
      preferTargetIds: ['cellar', 'unknown'],
    }
    const target = resolveRemedyTarget(state, makeSnapshot(), remedy)
    expect(target).toBeDefined()
    expect(target!.kind).toBe('area')
    expect(target!.id).toBe('cellar')
  })

  it('falls back to a related location of the matching kind', () => {
    const remedy: RemedyEntry = {
      actionId: 'clean_area',
      targetKind: 'area',
    }
    const snap = makeSnapshot({
      relatedLocations: [{ kind: 'area', id: 'kitchen' }],
    })
    const target = resolveRemedyTarget(state, snap, remedy)
    expect(target).toEqual({ kind: 'area', id: 'kitchen' })
  })

  it('honours preferTargetTags against related locations first', () => {
    const remedy: RemedyEntry = {
      actionId: 'clean_area',
      targetKind: 'area',
      preferTargetTags: ['kitchen'],
    }
    const snap = makeSnapshot({
      relatedLocations: [
        { kind: 'area', id: 'cellar' },
        { kind: 'area', id: 'kitchen' },
      ],
    })
    const target = resolveRemedyTarget(state, snap, remedy)
    expect(target).toEqual({ kind: 'area', id: 'kitchen' })
  })

  it('falls back to the first state entity when no related refs match', () => {
    const remedy: RemedyEntry = { actionId: 'pay_staff_bonus', targetKind: 'staff' }
    const target = resolveRemedyTarget(state, makeSnapshot(), remedy)
    expect(target).toBeDefined()
    expect(target!.kind).toBe('staff')
    // Must be a staff id that exists in state.
    expect(state.staff[target!.id]).toBeDefined()
  })

  it('honours preferTargetTags in the state-fallback path', () => {
    const remedy: RemedyEntry = {
      actionId: 'patch_roof',
      targetKind: 'area',
      preferTargetTags: ['main_room'],
    }
    const target = resolveRemedyTarget(state, makeSnapshot(), remedy)
    expect(target).toBeDefined()
    expect(target!.id).toContain('main_room')
  })

  it('returns undefined when no entities of the target kind exist', () => {
    const remedy: RemedyEntry = { actionId: 'clean_area', targetKind: 'recipe' }
    // The starting state has no recipes registered yet.
    const minimal = { ...state, recipes: {} }
    const target = resolveRemedyTarget(minimal, makeSnapshot(), remedy)
    expect(target).toBeUndefined()
  })

  it('produces deterministic output across repeated calls', () => {
    const remedy: RemedyEntry = { actionId: 'pay_staff_bonus', targetKind: 'staff' }
    const t1 = resolveRemedyTarget(state, makeSnapshot(), remedy)
    const t2 = resolveRemedyTarget(state, makeSnapshot(), remedy)
    expect(t1).toEqual(t2)
  })
})
