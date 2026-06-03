// Phase 193 / ISSUE-160 — Action affinity + preview metadata invariants.
//
// The picker's "Suggested" section trusts that every `pressureAffinity`
// entry names a real pressure (otherwise a suggestion could never fire, or
// worse, drift silently when a pressure is renamed). This is the same
// cross-reference discipline the pressure-remedy map already enforces.

import { describe, expect, it } from 'vitest'

import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import {
  EXPANDED_PRESSURE_IDS,
  PRESSURE_IDS,
} from '../../src/sim/modules/pressures/pressureTypes'

const VALID_PRESSURE_IDS = new Set<string>([
  ...PRESSURE_IDS,
  ...EXPANDED_PRESSURE_IDS,
])

describe('owner-action pressure affinity (Phase 193)', () => {
  it('every pressureAffinity entry is a registered pressure id', () => {
    for (const action of actionRegistry.all()) {
      for (const id of action.pressureAffinity ?? []) {
        expect(
          VALID_PRESSURE_IDS.has(id),
          `action '${action.id}' has unknown pressure affinity '${id}'`,
        ).toBe(true)
      }
    }
  })

  it('pressureAffinity arrays, when present, are non-empty and unique', () => {
    for (const action of actionRegistry.all()) {
      const affinity = action.pressureAffinity
      if (!affinity) continue
      expect(affinity.length, `action '${action.id}'`).toBeGreaterThan(0)
      expect(new Set(affinity).size, `action '${action.id}' has duplicates`).toBe(
        affinity.length,
      )
    }
  })

  it('the obvious remedial actions carry their expected affinity', () => {
    const cases: Record<string, string> = {
      clean_area: 'food_safety',
      repair_area: 'maintenance',
      restock_item: 'stock_shortage',
      pay_staff_bonus: 'staff_burnout',
      fumigate_cellar: 'pests',
    }
    for (const [actionId, pressureId] of Object.entries(cases)) {
      const action = actionRegistry.get(actionId)
      expect(action.pressureAffinity ?? []).toContain(pressureId)
    }
  })

  it('authored effectsPreview values are non-empty trimmed strings', () => {
    for (const action of actionRegistry.all()) {
      if (action.effectsPreview === undefined) continue
      expect(typeof action.effectsPreview).toBe('string')
      expect(action.effectsPreview.trim().length, `action '${action.id}'`).toBeGreaterThan(0)
    }
  })

  it('covers at least 60% of the directly-remedial actions with affinity', () => {
    // The immediate + social categories are the directly-remedial set the
    // suggestion engine draws from. Projects are long-term investments
    // (mostly no single-pressure remedy) and policies are standing toggles,
    // so neither is part of the coverage target.
    const remedial = actionRegistry
      .all()
      .filter((a) => a.category === 'immediate' || a.category === 'social')
    const tagged = remedial.filter((a) => (a.pressureAffinity ?? []).length > 0)
    expect(tagged.length / remedial.length).toBeGreaterThanOrEqual(0.6)
  })
})
