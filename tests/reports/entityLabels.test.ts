// Phase 94 — Tests for the shared entity-label helpers.
//
// The pair was lifted out of `worldOverviewProjection.ts` at Phase 94
// so the Tavern Log projection could reuse it. These tests pin the
// behaviour so the world projection's existing tests don't have to
// carry the load alone.

import { describe, expect, it } from 'vitest'

import { resolveEntityLabel, resolveBareEntityId } from '../../src/reports/entityLabels'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { EntityRef } from '../../src/sim/state/TavernState'

describe('resolveEntityLabel', () => {
  it('resolves a staff ref to the staff GeneratedName.display', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.staff)[0]!
    const ref: EntityRef = { kind: 'staff', id }
    expect(resolveEntityLabel(state, ref)).toBe(state.staff[id]!.name.display)
  })

  it('resolves an area ref to area.label', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.areas)[0]!
    expect(resolveEntityLabel(state, { kind: 'area', id })).toBe(
      state.areas[id]!.label,
    )
  })

  it('resolves a stock ref to stock.label', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.stock)[0]!
    expect(resolveEntityLabel(state, { kind: 'stock', id })).toBe(
      state.stock[id]!.label,
    )
  })

  it('resolves a customer_group ref to customerGroups[id].label', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.customerGroups)[0]!
    expect(resolveEntityLabel(state, { kind: 'customer_group', id })).toBe(
      state.customerGroups[id]!.label,
    )
  })

  it('resolves a regular ref to the regular GeneratedName.display', () => {
    const state = createInitialTavernState()
    const ids = Object.keys(state.world.regulars)
    expect(ids.length).toBeGreaterThan(0)
    const id = ids[0]!
    expect(resolveEntityLabel(state, { kind: 'regular', id })).toBe(
      state.world.regulars[id]!.name.display,
    )
  })

  it('resolves a supplier ref to name.display when present, label otherwise', () => {
    const state = createInitialTavernState()
    const ids = Object.keys(state.world.suppliers)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const supplier = state.world.suppliers[id]!
      const label = resolveEntityLabel(state, { kind: 'supplier', id })
      expect(label).toBe(supplier.name?.display ?? supplier.label)
    }
  })

  it('resolves a faction ref to faction.label', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.world.factions)[0]!
    expect(resolveEntityLabel(state, { kind: 'faction', id })).toBe(
      state.world.factions[id]!.label,
    )
  })

  it('resolves a culture ref to culture.label', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.world.cultures)[0]!
    expect(resolveEntityLabel(state, { kind: 'culture', id })).toBe(
      state.world.cultures[id]!.label,
    )
  })

  it('resolves a notable_npc ref to npc.name.display', () => {
    const state = createInitialTavernState()
    const ids = Object.keys(state.world.notableNpcs)
    if (ids.length === 0) return  // starter state may not seed NPCs
    const id = ids[0]!
    expect(resolveEntityLabel(state, { kind: 'notable_npc', id })).toBe(
      state.world.notableNpcs[id]!.name.display,
    )
  })

  it('resolves tavern_identity to a constant string', () => {
    const state = createInitialTavernState()
    expect(resolveEntityLabel(state, { kind: 'tavern_identity', id: '_' })).toBe(
      'the tavern',
    )
  })

  it('resolves system to a constant string', () => {
    const state = createInitialTavernState()
    expect(resolveEntityLabel(state, { kind: 'system', id: '_' })).toBe(
      'the system',
    )
  })

  it('falls back to the raw id when the entity is missing under each kind', () => {
    const state = createInitialTavernState()
    const kinds: EntityRef['kind'][] = [
      'staff',
      'area',
      'stock',
      'customer_group',
      'regular',
      'supplier',
      'faction',
      'culture',
      'notable_npc',
      'local_event',
      'rumour',
      'recipe',
      'role',
      'other',
    ]
    for (const kind of kinds) {
      const ghostId = `does_not_exist:${kind}`
      expect(resolveEntityLabel(state, { kind, id: ghostId })).toBe(ghostId)
    }
  })
})

describe('resolveBareEntityId', () => {
  it('resolves a known regular id without a kind tag', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.world.regulars)[0]!
    expect(resolveBareEntityId(state, id)).toBe(
      state.world.regulars[id]!.name.display,
    )
  })

  it('resolves a known staff id without a kind tag', () => {
    const state = createInitialTavernState()
    const id = Object.keys(state.staff)[0]!
    expect(resolveBareEntityId(state, id)).toBe(state.staff[id]!.name.display)
  })

  it('falls back to the raw id when no world slice matches', () => {
    const state = createInitialTavernState()
    expect(resolveBareEntityId(state, 'absolutely_no_such_entity')).toBe(
      'absolutely_no_such_entity',
    )
  })
})
