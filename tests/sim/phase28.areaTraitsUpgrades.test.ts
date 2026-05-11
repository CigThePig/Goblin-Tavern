import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  areasModule,
  describeAreaAtmosphere,
  getAreaMechanicalTags,
  getInstalledUpgradeIds,
  hasAreaAtmosphere,
  hasAreaTrait,
  hasInstalledUpgrade,
} from '../../src/sim/modules/areas'
import {
  areaTraitRegistry,
  ensureRequiredAreaTraitsRegistered,
} from '../../src/sim/content/tavern/areaTraitRegistry'
import {
  areaUpgradeRegistry,
  ensureRequiredAreaUpgradesRegistered,
} from '../../src/sim/content/tavern/areaUpgradeRegistry'
import { AreaStateSchema } from '../../src/sim/state/schemas'
import { ensureAreaIdentityFields } from '../../src/sim/state/migrations'
import { normalizeArea } from '../../src/sim/state/normalize'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { withArea } from '../../src/sim/testing/stateFactories'
import type { AreaState, TavernState } from '../../src/sim/state/TavernState'

// Phase 28 — Area traits, upgrades, and atmosphere.
//
// Covers the nine §28.9 acceptance points:
//   1. `createInitialTavernState` populates traits, atmosphere, upgrades.
//   2. Existing required area ids / labels are unchanged.
//   3. The upgrade schema rejects invalid statuses.
//   4. The trait registry exposes the starter trait set.
//   5. The upgrade registry exposes the starter upgrade set.
//   6. Derived helpers detect traits + installed upgrades correctly.
//   7. The area report mentions trait/atmosphere info.
//   8. Phase 8 invariants (decay, validation, required areas) still hold.
//   9. Migration / normalization fills missing identity fields.

const SEED = 'phase-28-areas-test'

function input() {
  return { seed: SEED }
}

describe('Phase 28 — Area traits, upgrades, atmosphere', () => {
  it('1. createInitialTavernState creates every area with traits, atmosphere, and upgrades fields', () => {
    const state = createInitialTavernState()
    for (const id of ['main_room', 'kitchen', 'cellar', 'privy', 'roof']) {
      const area = state.areas[id]
      expect(area).toBeDefined()
      expect(Array.isArray(area!.traits)).toBe(true)
      expect(Array.isArray(area!.atmosphere)).toBe(true)
      expect(typeof area!.upgrades).toBe('object')
      expect(area!.upgrades).not.toBeNull()
      // Every starter area carries at least one atmosphere tag.
      expect(area!.atmosphere.length).toBeGreaterThan(0)
    }
  })

  it('1b. starter traits on every required area are registered in the trait registry', () => {
    const state = createInitialTavernState()
    for (const area of Object.values(state.areas)) {
      for (const traitId of area.traits) {
        expect(areaTraitRegistry.has(traitId)).toBe(true)
      }
    }
  })

  it('2. existing required areas retain their original ids and labels', () => {
    const state = createInitialTavernState()
    expect(state.areas.main_room!.label).toBe('Main Room')
    expect(state.areas.kitchen!.label).toBe('Kitchen')
    expect(state.areas.cellar!.label).toBe('Cellar')
    expect(state.areas.privy!.label).toBe('Privy')
    expect(state.areas.roof!.label).toBe('Roof')
    expect(Object.keys(state.areas).sort()).toEqual(
      ['cellar', 'kitchen', 'main_room', 'privy', 'roof'].sort(),
    )
  })

  it('3. AreaStateSchema rejects invalid upgrade statuses', () => {
    const base = createInitialTavernState().areas.main_room!
    const bad: unknown = {
      ...base,
      upgrades: {
        bogus_upgrade: {
          id: 'bogus_upgrade',
          status: 'painted_purple',
          tags: [],
        },
      },
    }
    const parsed = AreaStateSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('3b. AreaStateSchema accepts a well-formed installed upgrade', () => {
    const base = createInitialTavernState().areas.kitchen!
    const ok = {
      ...base,
      upgrades: {
        smoke_vent: {
          id: 'smoke_vent',
          status: 'installed' as const,
          installedAtDay: 5,
          tags: ['kitchen', 'comfort_positive'],
        },
      },
    }
    const parsed = AreaStateSchema.safeParse(ok)
    expect(parsed.success).toBe(true)
  })

  it('4. area trait registry contains the required starter traits', () => {
    ensureRequiredAreaTraitsRegistered()
    const expected = [
      'cozy',
      'drafty',
      'sticky_floor',
      'smells_of_smoke',
      'rat_scratched',
      'well_lit',
      'crowded',
      'private',
      'dangerous_corner',
      'music_friendly',
      'inspection_sensitive',
      'food_prep_visible',
      'pest_prone',
      'weather_exposed',
    ]
    for (const id of expected) {
      expect(areaTraitRegistry.has(id)).toBe(true)
    }
    for (const def of areaTraitRegistry.all()) {
      expect(def.mechanicalTags.length).toBeGreaterThan(0)
    }
  })

  it('5. area upgrade registry contains starter upgrades for every required area', () => {
    ensureRequiredAreaUpgradesRegistered()
    const expected = [
      'better_tables',
      'hearth_repair',
      'music_corner',
      'private_booths',
      'reinforced_stools',
      'sharp_knives',
      'large_stew_pot',
      'clean_prep_bench',
      'smoke_vent',
      'rat_proof_barrels',
      'cold_stone_shelves',
      'hidden_reserve_rack',
      'lime_bucket_station',
      'privacy_screen',
      'stone_drainage',
      'patched_thatch',
      'rain_gutters',
      'reinforced_beams',
    ]
    for (const id of expected) {
      expect(areaUpgradeRegistry.has(id)).toBe(true)
    }
    for (const def of areaUpgradeRegistry.all()) {
      expect(def.costCoin).toBeGreaterThanOrEqual(0)
      expect(def.tags.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('5b. every starter upgrade is allowed in a real registered area', () => {
    const state = createInitialTavernState()
    const areaIds = Object.keys(state.areas)
    const areaTags = new Set<string>()
    for (const area of Object.values(state.areas)) {
      for (const t of area.tags) areaTags.add(t)
    }
    for (const def of areaUpgradeRegistry.all()) {
      const allowsAnyAreaId = !def.allowedAreaIds || def.allowedAreaIds.some((id) =>
        areaIds.includes(id),
      )
      const allowsAnyTag =
        !def.allowedAreaTags || def.allowedAreaTags.some((t) => areaTags.has(t))
      expect(allowsAnyAreaId).toBe(true)
      expect(allowsAnyTag).toBe(true)
    }
  })

  it('6. hasAreaTrait / hasAreaAtmosphere / hasInstalledUpgrade work as expected', () => {
    const state = createInitialTavernState()
    const cellar = state.areas.cellar!
    expect(hasAreaTrait(cellar, 'pest_prone')).toBe(true)
    expect(hasAreaTrait(cellar, 'cozy')).toBe(false)
    expect(hasAreaAtmosphere(cellar, 'damp')).toBe(true)
    expect(hasAreaAtmosphere(cellar, 'sunny')).toBe(false)

    const withUpgrade: AreaState = {
      ...cellar,
      upgrades: {
        rat_proof_barrels: {
          id: 'rat_proof_barrels',
          status: 'installed',
          installedAtDay: 7,
          tags: ['cellar', 'pest_negative'],
        },
        cold_stone_shelves: {
          id: 'cold_stone_shelves',
          status: 'in_progress',
          progress: 1,
          tags: [],
        },
      },
    }
    expect(hasInstalledUpgrade(withUpgrade, 'rat_proof_barrels')).toBe(true)
    expect(hasInstalledUpgrade(withUpgrade, 'cold_stone_shelves')).toBe(false)
    expect(getInstalledUpgradeIds(withUpgrade)).toEqual(['rat_proof_barrels'])
  })

  it('6b. getAreaMechanicalTags unions area tags, trait mechanical tags, and installed upgrade tags', () => {
    const state = createInitialTavernState()
    const cellarBase = state.areas.cellar!
    const cellar: AreaState = {
      ...cellarBase,
      upgrades: {
        rat_proof_barrels: {
          id: 'rat_proof_barrels',
          status: 'installed',
          installedAtDay: 7,
          tags: ['cellar', 'pest_negative'],
        },
      },
    }
    const tags = getAreaMechanicalTags(cellar)
    // base area tag
    expect(tags).toContain('storage')
    // mechanical tag from `pest_prone` trait
    expect(tags).toContain('pest_relevant')
    // installed upgrade tag
    expect(tags).toContain('pest_negative')
    // deduplicated — no duplicates from `cellar` appearing twice
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('6c. describeAreaAtmosphere produces a non-empty, ordered list for seeded rooms', () => {
    const state = createInitialTavernState()
    const main = state.areas.main_room!
    const description = describeAreaAtmosphere(main)
    expect(description.length).toBeGreaterThan(0)
    expect(description[0]).toBe('cheap')
  })

  it('7. the area report mentions trait/atmosphere/upgrade information when present', () => {
    const state = createInitialTavernState()
    const result = simulateDay(state, input(), [areasModule])
    const areaReport = result.reports.find((r) => r.id === 'areas')
    expect(areaReport).toBeDefined()
    const text = areaReport!.lines.join('\n')
    // Atmosphere line surfaces seeded atmosphere + trait labels.
    expect(text).toContain('Atmosphere:')
    expect(text).toMatch(/sticky floor|dangerous corner|damp/i)
    // No upgrades installed on day zero, but the report should suggest one.
    expect(text).toContain('Upgrade available:')
  })

  it('7b. installed upgrade ids appear in the report once installed', () => {
    const base = createInitialTavernState()
    const stateWithUpgrade = withArea(base, 'kitchen', {
      upgrades: {
        smoke_vent: {
          id: 'smoke_vent',
          status: 'installed',
          installedAtDay: 3,
          tags: ['kitchen', 'comfort_positive'],
        },
      },
    })
    const result = simulateDay(stateWithUpgrade, input(), [areasModule])
    const text =
      result.reports.find((r) => r.id === 'areas')!.lines.join('\n')
    expect(text).toContain('Upgrades installed: smoke_vent')
  })

  it('8. validateState still passes for the default tavern with the extended area shape', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
  })

  it('8b. simulateDay still drives passive decay on cleanliness for the main room and kitchen', () => {
    const before = createInitialTavernState()
    const result = simulateDay(before, input(), [areasModule])
    expect(result.state.areas.main_room!.cleanliness).toBeLessThan(
      before.areas.main_room!.cleanliness,
    )
    expect(result.state.areas.kitchen!.cleanliness).toBeLessThan(
      before.areas.kitchen!.cleanliness,
    )
  })

  it('9. ensureAreaIdentityFields backfills missing identity fields without inventing content', () => {
    const stateLike = {
      areas: {
        main_room: {
          id: 'main_room',
          label: 'Main Room',
          condition: 60,
          cleanliness: 45,
          mess: 20,
          damage: 15,
          smell: 25,
          risk: 20,
          tags: ['public'],
          activeProblems: [],
        } as Partial<AreaState> & Pick<AreaState, 'id' | 'label'>,
      },
    }
    const repaired = ensureAreaIdentityFields(stateLike)
    expect(repaired.areas!.main_room.traits).toEqual([])
    expect(repaired.areas!.main_room.atmosphere).toEqual([])
    expect(repaired.areas!.main_room.upgrades).toEqual({})
  })

  it('9b. normalizeArea also restores missing identity fields on a per-area basis', () => {
    const partial = {
      id: 'kitchen',
      label: 'Kitchen',
      condition: 55,
      cleanliness: 40,
      mess: 30,
      damage: 10,
      smell: 35,
      risk: 30,
      tags: ['food'],
      activeProblems: [],
    } as unknown as AreaState
    const repaired = normalizeArea(partial)
    expect(repaired.traits).toEqual([])
    expect(repaired.atmosphere).toEqual([])
    expect(repaired.upgrades).toEqual({})
  })
})

describe('Phase 28 — Area trait influence on existing systems', () => {
  it('passive decay raises main_room risk extra when sticky_floor trait is present', () => {
    const baseline = createInitialTavernState()
    const without = withArea(baseline, 'main_room', { traits: [] })
    const with_ = withArea(baseline, 'main_room', { traits: ['sticky_floor'] })

    // Run several days with the same seed and compare the resulting risk
    // distributions. The sticky floor bump is small and probabilistic
    // (50% chance, +1 risk) so we run enough days to see a difference.
    function totalRisk(seed: string, state: TavernState): number {
      let current = state
      let acc = 0
      for (let i = 0; i < 25; i += 1) {
        current = simulateDay(current, { seed }, [areasModule]).state
        acc += current.areas.main_room!.risk
      }
      return acc
    }

    expect(totalRisk(SEED, with_)).toBeGreaterThan(totalRisk(SEED, without))
  })
})
