import { describe, it, expect, beforeAll } from 'vitest'

import { ensureStarterNamingProfilesRegistered } from '../../src/sim/content/naming/namingProfiles'
import {
  ensureRequiredAreaTraitsRegistered,
} from '../../src/sim/content/tavern/areaTraitRegistry'
import {
  ensureRequiredAreaUpgradesRegistered,
} from '../../src/sim/content/tavern/areaUpgradeRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  validateAreaContentReferences,
  validateStockReferences,
  validateWorldReferences,
} from '../../src/sim/state/referenceValidation'
import { safeValidateState } from '../../src/sim/state/validation'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 92 / ISSUE-052 — Validation source-of-truth + reference coverage.
//
// These tests prove:
//   1. Bare `safeValidateState(state)` (no `modules` option) uses the
//      canonical pipeline rather than the empty module registry, so
//      module-state schemas are enforced.
//   2. Dangling `stock[x].storageAreaId` is reported as an error.
//   3. Unknown area trait ids are reported.
//   4. Unknown area upgrade keys are reported.
//   5. Bare rumour `sourceEntityId`/`targetEntityId` that match no known
//      entity are reported.
//   6. A clean default state still passes bare validation.

beforeAll(() => {
  ensureStarterNamingProfilesRegistered()
  ensureRequiredAreaTraitsRegistered()
  ensureRequiredAreaUpgradesRegistered()
})

function cloneState(): TavernState {
  return JSON.parse(JSON.stringify(createInitialTavernState())) as TavernState
}

describe('Phase 92 — canonical validation', () => {
  it('bare safeValidateState() enforces module-state schemas via FULL_PIPELINE fallback', () => {
    const state = createInitialTavernState()
    // Corrupt one module's state slot in a way the schema must reject.
    // The `weekly` module owns `state.modules.weekly`; replacing it with
    // a non-object makes the schema fail. Without the FULL_PIPELINE
    // fallback the bare validator would have skipped this slot.
    const corrupt = {
      ...state,
      modules: { ...state.modules, weekly: 'not-an-object' },
    } as unknown
    const result = safeValidateState(corrupt)
    expect(result.success).toBe(false)
    if (!result.success) {
      const path = result.errors.map((e) => e.path).join(',')
      expect(path).toMatch(/modules\.weekly/)
    }
  })

  it('passes a clean default state with no options', () => {
    const state = createInitialTavernState()
    const result = safeValidateState(state)
    expect(result.success).toBe(true)
  })

  it('flags dangling stock.storageAreaId', () => {
    const state = cloneState()
    const firstStockId = Object.keys(state.stock)[0]!
    state.stock[firstStockId]!.storageAreaId = 'nonexistent_area'
    const issues = validateStockReferences(state)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]!.code).toBe('unknown_area_ref')
    expect(issues[0]!.path).toBe(`stock.${firstStockId}.storageAreaId`)
  })

  it('flags unknown area trait id', () => {
    const state = cloneState()
    const areaId = Object.keys(state.areas)[0]!
    state.areas[areaId]!.traits.push('definitely_not_a_trait' as never)
    const issues = validateAreaContentReferences(state)
    expect(issues.some((i) => i.code === 'unknown_area_trait')).toBe(true)
  })

  it('flags unknown area upgrade key', () => {
    const state = cloneState()
    const areaId = Object.keys(state.areas)[0]!
    state.areas[areaId]!.upgrades['ghost_upgrade'] = {
      id: 'ghost_upgrade' as never,
      status: 'available',
      tags: [],
    }
    const issues = validateAreaContentReferences(state)
    expect(issues.some((i) => i.code === 'unknown_area_upgrade')).toBe(true)
  })

  it('flags dangling rumour sourceEntityId and targetEntityId', () => {
    const state = cloneState()
    state.world.socialRumours['r1'] = {
      id: 'r1',
      label: 'rumor about nobody',
      strength: 0.5,
      accuracy: 'unknown',
      sourceEntityId: 'phantom_staff',
      targetEntityId: 'phantom_npc',
      firstHeardDay: 1,
      lastSpreadDay: 1,
      tags: [],
    }
    const issues = validateWorldReferences(state)
    const codes = issues.map((i) => i.code)
    expect(codes.filter((c) => c === 'unknown_rumour_endpoint').length).toBe(2)
  })

  it('accepts rumour endpoints that match known entities', () => {
    const state = cloneState()
    const staffId = Object.keys(state.staff)[0]!
    const groupId = Object.keys(state.customerGroups)[0]!
    state.world.socialRumours['r2'] = {
      id: 'r2',
      label: 'rumor about real folk',
      strength: 0.5,
      accuracy: 'partial',
      sourceEntityId: staffId,
      targetEntityId: groupId,
      firstHeardDay: 1,
      lastSpreadDay: 1,
      tags: [],
    }
    const issues = validateWorldReferences(state)
    const endpointIssues = issues.filter(
      (i) => i.code === 'unknown_rumour_endpoint',
    )
    expect(endpointIssues).toEqual([])
  })
})
