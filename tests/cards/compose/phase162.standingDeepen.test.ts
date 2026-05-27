// Phase 162 / ISSUE-130 — Legible Surface arc, Phase 17, iteration #1.
//
// Standing-phase regression tests for the two behavioural changes this
// iteration ships beyond pure pruning:
//
//   (1) supplierReliability deepening — the three new spec-2 / spec-3
//       combo cells that thicken the `market_instability` salient read
//       (rank #4 in the supplier_relationship salience table). Proves
//       each combo out-ranks both the single-condition base-rung
//       snippet and any colliding non-market combo when the state
//       carries the matching pair of facts.
//
//   (2) seasonalArc `rxn_anticipation` condition swap — the snippet
//       previously gated on `hasTag anticipation` (which `collectSeedTags`
//       never returned because the seasonal_arc seed writes the
//       anticipation flag into `memoriesCreated[].tags`, not into
//       seed.domain / toneHints / stake tags) now gates on
//       `memoryPresent { tag: 'anticipation' }`. Proves the line is
//       reachable when state.memories carries the right entry and stays
//       inert otherwise.
//
// Pruning regressions are covered structurally by the full-suite gate
// runs (`runAllGates` proves the trimmed pools still pass coverage /
// specificity / determinism / diversity / dedupe / voiceBounds /
// simCoherence / previewVariety / choiceDistinctness for each affected
// template) plus the cross-template `legibility` gate; no per-snippet
// "still gone" assertion is needed.

import { describe, expect, it } from 'vitest'

import {
  supplierReliabilityCard,
  seasonalArcCard,
} from '../../../src/cards/index'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { makeSeed } from '../cardFactories'

// ─── shared helpers ─────────────────────────────────────────────────

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) throw new Error('test setup expects at least one starter supplier')
  return id
}

function withSupplier(
  state: TavernState,
  supplierId: string,
  partial: { reliability?: number; relationship?: number },
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...state.world.suppliers[supplierId]!,
          ...(partial.reliability !== undefined
            ? { reliability: partial.reliability }
            : {}),
          ...(partial.relationship !== undefined
            ? { relationship: partial.relationship }
            : {}),
        },
      },
    },
  }
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
        id: pressureId,
        label: pressureId,
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function withMemory(
  state: TavernState,
  memoryId: string,
  tags: string[],
): TavernState {
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

// ─── supplierReliability — market_instability matrix deepening ───────

function supplierSeed(
  supplierId: string,
  options: { id?: string; severity?: number } = {},
): IssueSeed {
  return makeSeed({
    id: options.id ?? 'supplier-seed',
    family: 'supplier_relationship' as IssueSeedFamilyId,
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: options.severity ?? 45,
    domain: ['suppliers'],
    primaryActor: { kind: 'supplier', id: supplierId },
  })
}

describe('supplierReliability — Phase 162 market_instability deepening', () => {
  it('opens with low-reliability × market_instability combo when both fire', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    let state = withSupplier(base, supplierId, { reliability: 20 })
    state = withRisingPressure(state, 'market_instability')
    const view = supplierReliabilityCard.render(supplierSeed(supplierId), state)
    // `est_low_rel_market`: "Light loads, and the market keeps shifting
    // under us each visit." Out-ranks both `est_low_reliability` and
    // `est_market_rising` by spec-2 over spec-1, and is the
    // distinct-vocabulary winner over the colliding non-market combos.
    expect(view.body[0]).toContain('market keeps shifting')
  })

  it('opens with severity × market_instability combo when severity ≥ 70 + market rising', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    const state = withRisingPressure(base, 'market_instability')
    const seed = supplierSeed(supplierId, { id: 'supplier-crisis', severity: 80 })
    const view = supplierReliabilityCard.render(seed, state)
    // `est_severity_market`: "The trade has thinned and the wider
    // market keeps slipping with it."
    expect(view.body[0]).toContain('market keeps slipping')
  })

  it('opens with market_instability × memory combo when both fire', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    let state = withRisingPressure(base, 'market_instability')
    state = withMemory(state, 'supplier-prior', ['supplier'])
    const view = supplierReliabilityCard.render(supplierSeed(supplierId), state)
    // `est_market_memory`: "Each visit lands lighter; the market has
    // been wobbling all season." Out-ranks both `est_returning_visitor`
    // (spec-1 memory-only) and `est_market_rising` (spec-1 pressure-only).
    expect(view.body[0]).toContain('wobbling all season')
  })

  it('re-renders deterministically across two calls with the same (seed, state)', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    let state = withSupplier(base, supplierId, { reliability: 20 })
    state = withRisingPressure(state, 'market_instability')
    const seed = supplierSeed(supplierId, { id: 'supplier-determinism' })
    const view1 = supplierReliabilityCard.render(seed, state)
    const view2 = supplierReliabilityCard.render(seed, state)
    expect(view2.body[0]).toBe(view1.body[0])
  })
})

// ─── seasonalArc — rxn_anticipation memoryPresent fix ────────────────

function seasonalArcAnticipationSeed(id = 'seasonal-arc-anticipation'): IssueSeed {
  return makeSeed({
    id,
    family: 'seasonal_arc' as IssueSeedFamilyId,
    type: 'festival_preparation',
    timing: 'morning_prep',
    severity: 35,
    domain: ['arcs', 'calendar'],
    toneHints: ['arc', 'calendar', 'mushroom_blight'],
  })
}

const ANTICIPATION_SNIPPET =
  'It has not arrived, but the air is bending toward it.'

describe('seasonalArc — Phase 162 rxn_anticipation condition fix', () => {
  it('does NOT surface the anticipation reaction when state.memories has no anticipation entry', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcAnticipationSeed('arc-no-memory')
    const view = seasonalArcCard.render(seed, state)
    // Phase 162: pre-fix the gate was `hasTag anticipation` which never
    // matched on a Path-B anticipation seed (the tag lives in
    // memoriesCreated, not seed.domain/toneHints/stakes). Post-fix the
    // gate is `memoryPresent anticipation` which still doesn't fire on
    // a fresh state with no anticipation memory installed — proves we
    // didn't accidentally over-broaden the gate.
    for (const line of view.body) {
      expect(line).not.toBe(ANTICIPATION_SNIPPET)
    }
  })

  it('surfaces the anticipation reaction when state.memories carries an anticipation-tagged entry', () => {
    const base = createInitialTavernState()
    // A prior anticipation card resolution wrote a memory with the
    // `anticipation` tag into state — exactly what
    // expandedSeedGenerators.ts:4469 emits via memoriesCreated[].tags
    // for anticipation seeds.
    const state = withMemory(base, 'prior-anticipation', [
      'arc',
      'warning',
      'anticipation',
    ])
    const seed = seasonalArcAnticipationSeed('arc-with-memory')
    const view = seasonalArcCard.render(seed, state)
    // The reaction line lives at body[1]; the establishing line at
    // body[0] is the fallback (no rising arc / festival pressure
    // installed). The anticipation snippet wins reaction selection over
    // the unconditional `rxn_fallback` by specificity.
    expect(view.body[1]).toBe(ANTICIPATION_SNIPPET)
  })

  it('re-renders deterministically across two calls with the same (seed, state)', () => {
    const base = createInitialTavernState()
    const state = withMemory(base, 'prior-anticipation', [
      'arc',
      'warning',
      'anticipation',
    ])
    const seed = seasonalArcAnticipationSeed('arc-determinism')
    const view1 = seasonalArcCard.render(seed, state)
    const view2 = seasonalArcCard.render(seed, state)
    expect(view2.body[1]).toBe(view1.body[1])
  })
})
