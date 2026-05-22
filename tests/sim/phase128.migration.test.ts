import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { ensureCastAttributes } from '../../src/sim/state/migrations'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
} from '../../src/sim/content/cast'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 128 / ISSUE-097 — Voiced Surface arc, Phase 2.
//
// Migration sweep coverage for the four new actor kinds. Each gate
// proves ensureCastAttributes is additive, deterministic, idempotent,
// and a structural no-op when the field is already present.

function stripCastAttributes(state: TavernState): TavernState {
  const omit = <T extends { castAttributes?: unknown }>(record: T): Omit<T, 'castAttributes'> => {
    const { castAttributes: _drop, ...rest } = record
    void _drop
    return rest
  }
  const stripMap = <T extends { castAttributes?: unknown }>(
    record: Record<string, T>,
  ): Record<string, Omit<T, 'castAttributes'>> => {
    const out: Record<string, Omit<T, 'castAttributes'>> = {}
    for (const [k, v] of Object.entries(record)) out[k] = omit(v)
    return out
  }
  return {
    ...state,
    staff: stripMap(state.staff),
    customerGroups: stripMap(state.customerGroups),
    world: {
      ...state.world,
      regulars: stripMap(state.world.regulars),
      suppliers: stripMap(state.world.suppliers),
      factions: stripMap(state.world.factions),
      notableNpcs: stripMap(state.world.notableNpcs),
    },
  } as TavernState
}

describe('Phase 128 / ISSUE-097 — ensureCastAttributes (Phase 2 sweeps)', () => {
  it('attaches castAttributes to suppliers when absent', () => {
    const pruned = stripCastAttributes(createInitialTavernState())
    const migrated = ensureCastAttributes(pruned)
    for (const supplier of Object.values(migrated.world.suppliers)) {
      expect(supplier.castAttributes).toBeDefined()
      const attrs = supplier.castAttributes as CastAttributes
      expect(typeof attrs.specialty).toBe('string')
      expect(attrs.specialty).not.toBe(attrs.blindspot)
    }
  })

  it('attaches castAttributes to factions when absent', () => {
    const pruned = stripCastAttributes(createInitialTavernState())
    const migrated = ensureCastAttributes(pruned)
    for (const faction of Object.values(migrated.world.factions)) {
      expect(faction.castAttributes).toBeDefined()
    }
  })

  it('attaches voice-only castAttributes to customer groups when absent', () => {
    const pruned = stripCastAttributes(createInitialTavernState())
    const migrated = ensureCastAttributes(pruned)
    for (const group of Object.values(migrated.customerGroups)) {
      expect(group.castAttributes).toBeDefined()
      const attrs = group.castAttributes as CustomerGroupCastAttributes
      // Voice-only by contract — no specialty/blindspot/affinities
      // surface even on migrated state.
      expect(Object.keys(attrs)).toEqual(['voice'])
    }
  })

  it('attaches castAttributes to notable NPCs when absent', () => {
    const pruned = stripCastAttributes(createInitialTavernState())
    const migrated = ensureCastAttributes(pruned)
    for (const npc of Object.values(migrated.world.notableNpcs)) {
      expect(npc.castAttributes).toBeDefined()
      const attrs = npc.castAttributes as CastAttributes
      expect(typeof attrs.specialty).toBe('string')
      expect(attrs.specialty).not.toBe(attrs.blindspot)
    }
  })

  it('idempotent — a second migration pass on already-migrated state is a deep-equal no-op', () => {
    const pruned = stripCastAttributes(createInitialTavernState())
    const once = ensureCastAttributes(pruned)
    const twice = ensureCastAttributes(once)
    expect(twice.world.suppliers).toEqual(once.world.suppliers)
    expect(twice.world.factions).toEqual(once.world.factions)
    expect(twice.customerGroups).toEqual(once.customerGroups)
    expect(twice.world.notableNpcs).toEqual(once.world.notableNpcs)
  })

  it('deterministic — two independent migrations of the same pre-Phase-2 state produce equal attributes', () => {
    const baseA = stripCastAttributes(createInitialTavernState())
    const baseB = stripCastAttributes(createInitialTavernState())
    const a = ensureCastAttributes(baseA)
    const b = ensureCastAttributes(baseB)
    for (const id of Object.keys(a.world.suppliers)) {
      expect(b.world.suppliers[id]?.castAttributes).toEqual(
        a.world.suppliers[id]?.castAttributes,
      )
    }
    for (const id of Object.keys(a.world.factions)) {
      expect(b.world.factions[id]?.castAttributes).toEqual(
        a.world.factions[id]?.castAttributes,
      )
    }
    for (const id of Object.keys(a.customerGroups)) {
      expect(b.customerGroups[id]?.castAttributes).toEqual(
        a.customerGroups[id]?.castAttributes,
      )
    }
    for (const id of Object.keys(a.world.notableNpcs)) {
      expect(b.world.notableNpcs[id]?.castAttributes).toEqual(
        a.world.notableNpcs[id]?.castAttributes,
      )
    }
  })

  it('structural no-op — state where every kind already carries castAttributes is returned unchanged', () => {
    const state = createInitialTavernState()
    const migrated = ensureCastAttributes(state)
    expect(migrated).toBe(state)
  })

  it('partial backfill — only kinds missing castAttributes get touched; the rest stay byte-identical', () => {
    const state = createInitialTavernState()
    // Strip ONLY suppliers; everything else stays put.
    const pruned: TavernState = {
      ...state,
      world: {
        ...state.world,
        suppliers: Object.fromEntries(
          Object.entries(state.world.suppliers).map(([id, s]) => {
            const { castAttributes: _drop, ...rest } = s
            void _drop
            return [id, rest]
          }),
        ),
      },
    } as TavernState
    const migrated = ensureCastAttributes(pruned)
    // Suppliers got backfilled.
    for (const supplier of Object.values(migrated.world.suppliers)) {
      expect(supplier.castAttributes).toBeDefined()
    }
    // Untouched kinds reference-equal their original records (proves
    // the migration didn't redo work it wasn't asked to do).
    expect(migrated.staff).toBe(state.staff)
    expect(migrated.customerGroups).toBe(state.customerGroups)
    expect(migrated.world.regulars).toBe(state.world.regulars)
    expect(migrated.world.factions).toBe(state.world.factions)
    expect(migrated.world.notableNpcs).toBe(state.world.notableNpcs)
  })
})
