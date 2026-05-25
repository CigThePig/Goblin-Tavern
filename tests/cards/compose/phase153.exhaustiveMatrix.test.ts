// Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8
// (Premises & Atmosphere cluster).
//
// Exhaustive matrix-cell reachability tests for the two compositional
// templates this phase deepens: maintenance (damage × condition ×
// cleanliness 3-meter cube) and areaAtmosphere (cleanliness × damage
// × condition 3-meter cube — same meter set, different picker
// projection). Both templates are narrator-voiced (areas have no
// `castAttributes`), so fixtures don't perturb voice.
//
// For each template this file enumerates hand-picked `(seed, state)`
// fixtures covering the matrix corners (4 spec-3 cube corners + 4
// spec-2 supports + 1 pressure top rung each) and asserts the
// establishing line resolves to the matrix-cell snippet (matched by
// a distinctive substring only the combo cell contains). Proves the
// authored cells are reachable, not just present in the pool.
//
// Mirrors the Phase 149 / 150 / 151 / 152 matrix-coverage approach.

import { describe, expect, it } from 'vitest'

import {
  areaAtmosphereCard,
  maintenanceCard,
} from '../../../src/cards/index'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

const AREA_ID = 'main_room'

function withAreaMeters(
  state: TavernState,
  areaId: string,
  partial: { damage?: number; condition?: number; cleanliness?: number },
): TavernState {
  const original = state.areas[areaId]!
  return {
    ...state,
    areas: {
      ...state.areas,
      [areaId]: {
        ...original,
        ...(partial.damage !== undefined ? { damage: partial.damage } : {}),
        ...(partial.condition !== undefined ? { condition: partial.condition } : {}),
        ...(partial.cleanliness !== undefined
          ? { cleanliness: partial.cleanliness }
          : {}),
      },
    },
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 60,
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

// ─── maintenance fixtures ───────────────────────────────────────────

function maintenanceSeed(id = 'maintenance-matrix-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'maintenance' as IssueSeedFamilyId,
    type: 'maintenance_problem',
    timing: 'morning_prep',
    severity: 55,
    domain: ['areas', 'maintenance'],
    toneHints: ['maintenance'],
    location: { kind: 'area', id: AREA_ID },
  })
}

describe('maintenance — spec-3 cube corners (damage=high × condition × cleanliness)', () => {
  // The picker scores `damage + (60 − condition)`; the 4 spec-3 corners
  // all fix damage=high and span the condition × cleanliness 2×2 face.
  // Each combo carries all three banded conditions and out-ranks
  // single-condition snippets and spec-2 supports.
  const tests: {
    label: string
    condition: number
    cleanliness: number
    substring: string
  }[] = [
    {
      label: 'high condition × high cleanliness (gouge on a careful wall)',
      condition: 80,
      cleanliness: 80,
      substring: 'otherwise-careful wall',
    },
    {
      label: 'high condition × low cleanliness (sound but grubby)',
      condition: 80,
      cleanliness: 25,
      substring: 'has not been scrubbed',
    },
    {
      label: 'low condition × high cleanliness (swept clean, structurally failing)',
      condition: 25,
      cleanliness: 80,
      substring: 'joist beneath it is listing',
    },
    {
      label: 'low condition × low cleanliness (wreck of a corner)',
      condition: 25,
      cleanliness: 25,
      substring: 'wreck of a corner',
    },
  ]
  for (const { label, condition, cleanliness, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const state = withAreaMeters(base, AREA_ID, {
        damage: 80,
        condition,
        cleanliness,
      })
      const view = maintenanceCard.render(
        maintenanceSeed(`maintenance-cube-${condition}-${cleanliness}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('maintenance — spec-2 damage × condition supports (cleanliness-mid)', () => {
  // When cleanliness is mid (no spec-3 cube cell matches), the spec-2
  // damage × condition combos cover the band pair. Each carries the
  // two band conditions; mid cleanliness leaves the third meter
  // unresolved.
  const tests: {
    label: string
    damage: number
    condition: number
    substring: string
  }[] = [
    {
      label: 'high damage × high condition (sudden harm to a careful room)',
      damage: 80,
      condition: 80,
      substring: 'Sudden harm',
    },
    {
      label: 'high damage × low condition (overdue room takes visible harm)',
      damage: 80,
      condition: 25,
      substring: 'long-overdue room',
    },
    {
      label: 'mid damage × low condition (quiet decline into structural)',
      damage: 50,
      condition: 25,
      substring: 'quiet decline',
    },
    {
      label: 'high damage × mid condition (visible harm on average room)',
      damage: 80,
      condition: 50,
      substring: 'wear of an average room',
    },
  ]
  for (const { label, damage, condition, substring } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const state = withAreaMeters(base, AREA_ID, {
        damage,
        condition,
        cleanliness: 50,
      })
      const view = maintenanceCard.render(
        maintenanceSeed(`maintenance-supp-${damage}-${condition}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the damage=high × pressureRising top rung when cleanliness and condition are mid', () => {
    const base = createInitialTavernState()
    let state = withAreaMeters(base, AREA_ID, {
      damage: 80,
      condition: 50,
      cleanliness: 50,
    })
    state = withRisingPressure(state, 'maintenance')
    const view = maintenanceCard.render(
      maintenanceSeed('maintenance-damage-pressure-rung'),
      state,
    )
    // Two snippets match this condition pair at spec 2: the existing
    // `est_damage_high_rising` ("The damage is well past the line, and
    // the pressure keeps climbing.") and the new
    // `est_damage_rising_top` ("The damage stands out plainly, and the
    // pressure keeps climbing."). Both are semantically the same
    // fact-state; FNV tie-break picks one. Test allows either.
    expect(view.body[0]).toMatch(
      /well past the line|stands out plainly/,
    )
  })
})

// ─── areaAtmosphere fixtures ───────────────────────────────────────

function areaAtmosphereSeed(id = 'area-atmosphere-matrix-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'area_atmosphere' as IssueSeedFamilyId,
    type: 'warning',
    timing: 'morning_prep',
    severity: 55,
    domain: ['areas', 'atmosphere'],
    toneHints: ['atmosphere'],
    location: { kind: 'area', id: AREA_ID },
    affectedActors: [{ kind: 'area', id: AREA_ID }],
  })
}

describe('areaAtmosphere — spec-3 cube corners (cleanliness=low × damage × condition)', () => {
  // The picker scores `(100 − cleanliness) + damage` and requires ≥
  // 60; the 4 spec-3 corners all fix cleanliness=low and span the
  // damage × condition 2×2 face. Each combo carries all three banded
  // conditions and out-ranks single-condition snippets and spec-2
  // supports.
  const tests: {
    label: string
    damage: number
    condition: number
    substring: string
  }[] = [
    {
      label: 'high damage × high condition (sturdy, dusty rafters)',
      damage: 80,
      condition: 80,
      substring: 'rafters whose carpentry',
    },
    {
      label: 'high damage × low condition (nobody bothered for a long stretch)',
      damage: 80,
      condition: 25,
      substring: 'long stretch',
    },
    {
      label: 'low damage × high condition (sturdy room grubby enough that bones cannot hide it)',
      damage: 25,
      condition: 80,
      substring: 'good bones cannot hide',
    },
    {
      label: 'low damage × low condition (slow slip until regulars stop sitting there)',
      damage: 25,
      condition: 25,
      substring: 'regulars stop sitting',
    },
  ]
  for (const { label, damage, condition, substring } of tests) {
    it(`opens with the spec-3 cube corner for ${label}`, () => {
      const base = createInitialTavernState()
      const state = withAreaMeters(base, AREA_ID, {
        cleanliness: 25,
        damage,
        condition,
      })
      const view = areaAtmosphereCard.render(
        areaAtmosphereSeed(`atmosphere-cube-${damage}-${condition}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('areaAtmosphere — spec-2 cleanliness × damage supports (condition-mid)', () => {
  const tests: {
    label: string
    cleanliness: number
    damage: number
    substring: string
  }[] = [
    {
      label: 'low cleanliness × high damage (grime layered over real wear)',
      cleanliness: 25,
      damage: 80,
      substring: 'both speak at once',
    },
    {
      label: 'low cleanliness × mid damage (standard atmosphere case)',
      cleanliness: 25,
      damage: 50,
      substring: 'slipping past clean',
    },
    {
      label: 'mid cleanliness × high damage (passable upkeep, real damage)',
      cleanliness: 50,
      damage: 80,
      substring: 'Passable upkeep',
    },
    {
      label: 'high cleanliness × high damage (rare clean-but-damaged room)',
      cleanliness: 80,
      damage: 80,
      substring: 'clean-but-damaged',
    },
  ]
  for (const { label, cleanliness, damage, substring } of tests) {
    it(`opens with the spec-2 support for ${label}`, () => {
      const base = createInitialTavernState()
      const state = withAreaMeters(base, AREA_ID, {
        cleanliness,
        damage,
        condition: 50,
      })
      const view = areaAtmosphereCard.render(
        areaAtmosphereSeed(`atmosphere-supp-${cleanliness}-${damage}`),
        state,
      )
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the cleanliness=low × pressureRising top rung when damage and condition are mid', () => {
    const base = createInitialTavernState()
    let state = withAreaMeters(base, AREA_ID, {
      cleanliness: 25,
      damage: 50,
      condition: 50,
    })
    state = withRisingPressure(state, 'maintenance')
    const view = areaAtmosphereCard.render(
      areaAtmosphereSeed('atmosphere-cleanliness-pressure-rung'),
      state,
    )
    // Two snippets match this condition pair at spec 2: the existing
    // `est_cleanliness_pressure` ("The grime sits deep and the
    // pressure keeps climbing besides.") and the new
    // `est_cleanliness_rising_top` ("Grime sunk into the corner while
    // the board keeps creeping upward."). Both are semantically the
    // same fact-state; FNV tie-break picks one. Test allows either.
    expect(view.body[0]).toMatch(
      /pressure keeps climbing|board keeps creeping/,
    )
  })
})

// ─── State-varying reaction proof ───────────────────────────────────
//
// Reaction lines should vary with state, not stand fixed on tone tags
// alone. These tests render the same template under two distinct
// states and assert body[1] differs.

describe('maintenance — reaction_line varies with state', () => {
  it('high-damage and low-condition fixtures produce different reactions', () => {
    const base = createInitialTavernState()
    // Hold cleanliness mid in both fixtures so body[1] differences are
    // attributable to the changed meter only.
    const highDamage = withAreaMeters(base, AREA_ID, {
      damage: 80,
      condition: 50,
      cleanliness: 50,
    })
    const lowCondition = withAreaMeters(base, AREA_ID, {
      damage: 50,
      condition: 25,
      cleanliness: 50,
    })
    const damageView = maintenanceCard.render(
      maintenanceSeed('maintenance-damage-high'),
      highDamage,
    )
    const conditionView = maintenanceCard.render(
      maintenanceSeed('maintenance-condition-low'),
      lowCondition,
    )
    expect(damageView.body[1]).not.toBe(conditionView.body[1])
  })
})

describe('areaAtmosphere — reaction_line varies with state', () => {
  it('low-cleanliness and high-damage fixtures produce different reactions', () => {
    const base = createInitialTavernState()
    const lowClean = withAreaMeters(base, AREA_ID, {
      cleanliness: 25,
      damage: 50,
      condition: 50,
    })
    const highDamage = withAreaMeters(base, AREA_ID, {
      cleanliness: 50,
      damage: 80,
      condition: 50,
    })
    const cleanView = areaAtmosphereCard.render(
      areaAtmosphereSeed('atmosphere-low-clean'),
      lowClean,
    )
    const damageView = areaAtmosphereCard.render(
      areaAtmosphereSeed('atmosphere-high-damage'),
      highDamage,
    )
    expect(cleanView.body[1]).not.toBe(damageView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('premises & atmosphere matrix cells — re-render stability', () => {
  it('maintenance spec-3 cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const state = withAreaMeters(base, AREA_ID, {
      damage: 80,
      condition: 25,
      cleanliness: 25,
    })
    const seed = maintenanceSeed('maintenance-stable')
    const a = maintenanceCard.render(seed, state)
    const b = maintenanceCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('areaAtmosphere spec-3 cube corner is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const state = withAreaMeters(base, AREA_ID, {
      cleanliness: 25,
      damage: 80,
      condition: 80,
    })
    const seed = areaAtmosphereSeed('atmosphere-stable')
    const a = areaAtmosphereCard.render(seed, state)
    const b = areaAtmosphereCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
