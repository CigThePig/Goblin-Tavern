// Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4
// (Suppliers, Stock & Debt cluster).
//
// Exhaustive matrix-cell reachability tests. For each of the three
// templates the phase deepens (supplierReliability, stockShortage,
// debtRent), this file enumerates hand-picked `(seed, state)` fixtures
// covering the matrix corners and asserts the establishing line resolves
// to the matrix cell snippet (matched by a distinctive substring that
// only the combo cell contains). Proves the authored cells are reachable,
// not just present in the pool.
//
// The cell-coverage approach: when both top-salient facts of a corner
// resolve, the spec-2 combo snippet wins specificity over both single-
// condition snippets AND over the multi-fact join. The test asserts the
// distinctive vocabulary of the combo cell appears in body[0].

import { describe, expect, it } from 'vitest'

import {
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
} from '../../../src/cards/index'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { SupplierCastAttributes } from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

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

// Neutral voice profile — every axis at 1 — so voice-axis-gated snippets
// (which require atLeast: 2 or atMost: 0) never fire and we can prove
// state-keyed snippets vary independently of voice.
const NEUTRAL_SUPPLIER_CAST: SupplierCastAttributes = {
  specialty: 'goods',
  blindspot: 'late_payment',
  affinities: [],
  voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
}

function withNeutralSupplierVoice(
  state: TavernState,
  supplierId: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...state.world.suppliers[supplierId]!,
          castAttributes: NEUTRAL_SUPPLIER_CAST,
        },
      },
    },
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 50,
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

// ─── supplier_relationship fixtures ─────────────────────────────────

function supplierSeed(supplierId: string, id = 'supplier-seed'): IssueSeed {
  return makeSeed({
    id,
    family: 'supplier_relationship' as IssueSeedFamilyId,
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers'],
    primaryActor: { kind: 'supplier', id: supplierId },
  })
}

describe('supplierReliability — exhaustive matrix cells', () => {
  const tests: { label: string; reliability: number; relationship: number; substring: string }[] = [
    { label: 'low × low (burning bridge)', reliability: 20, relationship: 20, substring: 'goodwill' },
    { label: 'low × high (loyal but failing)', reliability: 20, relationship: 85, substring: "loyalty hasn't shifted" },
    { label: 'high × low (icy professional)', reliability: 85, relationship: 20, substring: 'stays cold' },
    { label: 'high × high (ally)', reliability: 85, relationship: 85, substring: 'trade as it should run' },
  ]
  for (const { label, reliability, relationship, substring } of tests) {
    it(`opens with the combo cell for ${label}`, () => {
      const base = createInitialTavernState()
      const supplierId = firstSupplierId(base)
      const state = withSupplier(base, supplierId, { reliability, relationship })
      const view = supplierReliabilityCard.render(supplierSeed(supplierId), state)
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with low-reliability × distrust-rising combo when both fire', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    let state = withSupplier(base, supplierId, { reliability: 20 })
    state = withRisingPressure(state, 'supplier_distrust')
    const view = supplierReliabilityCard.render(supplierSeed(supplierId), state)
    // `est_low_rel_distrust`: "Light loads, and the talk turns sour faster every visit."
    expect(view.body[0]).toContain('faster every visit')
  })
})

// ─── stock_shortage fixtures ────────────────────────────────────────

function stockShortageSeed(
  id = 'stock-shortage-seed',
  overrides: { severity?: number; toneHints?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'stock_shortage' as IssueSeedFamilyId,
    type: 'warning',
    timing: 'morning_prep',
    severity: overrides.severity ?? 50,
    toneHints: overrides.toneHints ?? ['warning'],
  })
}

describe('stockShortage — exhaustive matrix cells', () => {
  it('opens with shortage-rising × high-demand combo', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'stock_shortage')
    const seed = stockShortageSeed('stock-shortage-rush', {
      toneHints: ['warning', 'high_demand'],
    })
    const view = stockShortageCard.render(seed, state)
    // `est_shortage_high_demand`: "The shortage tightens, and the rush is already at the door."
    expect(view.body[0]).toContain('rush is already at the door')
  })

  it('opens with shortage-rising × deception-memory combo', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'stock_shortage')
    state = withMemory(state, 'watered_ale_recently', ['deception'])
    const view = stockShortageCard.render(stockShortageSeed('stock-shortage-decep'), state)
    // `est_shortage_deception`: "The shortage worsens, with the watered ale still on the slate."
    expect(view.body[0]).toContain('watered ale still on the slate')
  })

  it('opens with shortage-rising × ignored-memory combo', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'stock_shortage')
    state = withMemory(state, 'ignored_shortage_recently', ['ignored'])
    const view = stockShortageCard.render(stockShortageSeed('stock-shortage-ign'), state)
    // `est_shortage_ignored`: "The shortage you left to itself has come back biting harder."
    expect(view.body[0]).toContain('back biting harder')
  })

  it('opens with severity × shortage × high-demand 3-cond top rung', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'stock_shortage')
    const seed = stockShortageSeed('stock-shortage-crisis-rush', {
      severity: 80,
      toneHints: ['warning', 'high_demand'],
    })
    const view = stockShortageCard.render(seed, state)
    // `est_severity_high_demand`: "Critical shortage, and the day is already drawing a thirsty crowd."
    expect(view.body[0]).toContain('thirsty crowd')
  })

  it('opens with reputation-drift × ignored-memory combo when both fire', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'reputation_drift')
    state = withMemory(state, 'ignored_shortage_recently', ['ignored'])
    const view = stockShortageCard.render(stockShortageSeed('stock-shortage-rep'), state)
    // `est_reputation_ignored`: "Regulars are noticing — the untended shortage echoes outside the door."
    expect(view.body[0]).toContain('echoes outside the door')
  })
})

// ─── debt_rent fixtures ─────────────────────────────────────────────

function debtRentSeed(
  id = 'debt-rent-seed',
  overrides: { severity?: number; toneHints?: string[]; domain?: string[] } = {},
): IssueSeed {
  return makeSeed({
    id,
    family: 'debt_rent' as IssueSeedFamilyId,
    type: 'debt_pressure',
    timing: 'end_month',
    severity: overrides.severity ?? 50,
    domain: overrides.domain ?? ['economy', 'monthly', 'landlord'],
    toneHints: overrides.toneHints ?? ['debt', 'pressure'],
  })
}

describe('debtRent — exhaustive matrix cells', () => {
  it('opens with rent_due × debt-rising combo', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'debt')
    const seed = debtRentSeed('debt-rent-due-debt', {
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const view = debtRentCard.render(seed, state)
    // `est_rent_due_debt`: "The rent window is closing and the coin pile keeps thinning."
    expect(view.body[0]).toContain('coin pile keeps thinning')
  })

  it('opens with rent_due × risk-memory combo', () => {
    const base = createInitialTavernState()
    const state = withMemory(base, 'eviction_threat_possible', ['risk'])
    const seed = debtRentSeed('debt-rent-due-risk', {
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const view = debtRentCard.render(seed, state)
    // `est_rent_due_risk`: "Rent is days away, and the eviction warning sits open on the desk."
    expect(view.body[0]).toContain('eviction warning sits open')
  })

  it('opens with debt × landlord both-rising combo', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'debt')
    state = withRisingPressure(state, 'landlord')
    const view = debtRentCard.render(debtRentSeed('debt-rent-both'), state)
    // `est_debt_landlord`: "Both pressures squeezing — debt climbing, landlord patience thinning."
    expect(view.body[0]).toContain('Both pressures squeezing')
  })

  it('opens with landlord-rising × rent-memory combo', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'landlord')
    state = withMemory(state, 'rent_paid_recently', ['rent', 'landlord'])
    const view = debtRentCard.render(debtRentSeed('debt-rent-paid-cool'), state)
    // `est_landlord_rent_paid`: "The landlord is cooling even after last month's clean payment."
    expect(view.body[0]).toContain('even after')
  })

  it('opens with severity × rent_due × landlord 3-cond top rung', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'landlord')
    const seed = debtRentSeed('debt-rent-crisis', {
      severity: 85,
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const view = debtRentCard.render(seed, state)
    // `est_severity_rent_due`: "The worst month yet, and the rent window is closing fast."
    expect(view.body[0]).toContain('worst month yet')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────
//
// The Phase-4 plan requires reaction lines to vary with state, not just
// voice. These tests render the same template under two distinct states
// (no voice change) and assert the reaction line differs.

describe('supplierReliability — reaction varies with state, not just voice', () => {
  it('low-reliability supplier and high-reliability supplier produce different reactions (neutral voice)', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    // Pin a neutral voice profile so voice-extreme spec-2 combos don't
    // fire — the test isolates state-keyed (Phase 149) variation from
    // voice-keyed variation. With neutral voice, the spec-1 state
    // snippets (signalEquals reliability low/high) out-rank the spec-0
    // unconditional fallback when state matches.
    const neutral = withNeutralSupplierVoice(base, supplierId)
    const low = withSupplier(neutral, supplierId, { reliability: 20 })
    const high = withSupplier(neutral, supplierId, { reliability: 85 })
    const lowView = supplierReliabilityCard.render(supplierSeed(supplierId, 'low-rxn'), low)
    const highView = supplierReliabilityCard.render(supplierSeed(supplierId, 'high-rxn'), high)
    expect(lowView.body[1]).not.toBe(highView.body[1])
  })
})

describe('stockShortage — reaction varies with state', () => {
  it('severity × deception state produces a different reaction than the bare fallback', () => {
    const base = createInitialTavernState()
    let primed = withRisingPressure(base, 'stock_shortage')
    primed = withMemory(primed, 'watered_ale_recently', ['deception'])
    const baseView = stockShortageCard.render(stockShortageSeed('stock-base'), base)
    const primedSeed = stockShortageSeed('stock-primed', { severity: 80 })
    const primedView = stockShortageCard.render(primedSeed, primed)
    expect(baseView.body[1]).not.toBe(primedView.body[1])
  })
})

describe('debtRent — reaction varies with state', () => {
  it('rent-due × debt-rising state produces a different reaction than the bare fallback', () => {
    const base = createInitialTavernState()
    const primed = withRisingPressure(base, 'debt')
    const baseView = debtRentCard.render(debtRentSeed('debt-base'), base)
    const primedSeed = debtRentSeed('debt-primed', {
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const primedView = debtRentCard.render(primedSeed, primed)
    expect(baseView.body[1]).not.toBe(primedView.body[1])
  })
})

// ─── Determinism + re-render stability ──────────────────────────────

describe('matrix cells — re-render stability', () => {
  it('supplier low × low combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    const state = withSupplier(base, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId, 'supplier-stable')
    const a = supplierReliabilityCard.render(seed, state)
    const b = supplierReliabilityCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('debt rent_due × risk combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    const state = withMemory(base, 'eviction_threat_possible', ['risk'])
    const seed = debtRentSeed('debt-rent-stable', {
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const a = debtRentCard.render(seed, state)
    const b = debtRentCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('stock shortage × deception combo is byte-identical on re-render', () => {
    const base = createInitialTavernState()
    let state = withRisingPressure(base, 'stock_shortage')
    state = withMemory(state, 'watered_ale_recently', ['deception'])
    const seed = stockShortageSeed('stock-shortage-stable')
    const a = stockShortageCard.render(seed, state)
    const b = stockShortageCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
