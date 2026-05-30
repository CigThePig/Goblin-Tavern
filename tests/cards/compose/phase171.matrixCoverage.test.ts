// Phase 171 / ISSUE-139 — Complete Surface arc, Phase 4
// (Suppliers, Stock & Debt cluster).
//
// The first application of the Phase-3 cell-coverage read
// (`enumerateMatrixCells`, ISSUE-138) to content. Where
// `phase149.exhaustiveMatrix.test.ts` proved hand-picked corners are
// reachable, this file *derives* the matrix cells from the salience table
// and asserts EVERY cell of the cluster resolves to a covering snippet
// (or the documented mid-centre fallback, or an `unreachableCells`
// allowlist entry). It turns "is this matrix complete?" from an author's-
// eye judgement into a machine question — the per-cluster proof the
// Phase-12 coverage gate will later generalise across all situations.
//
// Coverage definition (mirrors the Phase-161 legibility gate's "meaningful
// read" filter): a cell with ≥1 low/high (extremity-2) banded signal read
// demands an establishing snippet whose `scoreCandidateSalience` index is
// finite; a cell whose meters are all mid (extremity 1, the intentional
// default) is covered by the unconditional fallback.

import { describe, expect, it } from 'vitest'

import {
  supplierReliabilityCard,
  stockShortageCard,
  debtRentCard,
} from '../../../src/cards/index'
import { supplierReliabilityTemplate } from '../../../src/cards/templates/supplierReliability'
import {
  enumerateMatrixCells,
  matrixMetersForFamily,
  resolveSalientReads,
  scoreCandidateSalience,
  UNREACHABLE_CELLS,
  isCellAllowlisted,
  validateUnreachableCells,
} from '../../../src/cards/compose'
import { pickSnippetTrace } from '../../../src/cards/compose/assemble'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { BandId } from '../../../src/sim/signals'
import { makeSeed } from '../cardFactories'

// ─── helpers ────────────────────────────────────────────────────────

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

function supplierSeed(supplierId: string, id = 'supplier-cov'): IssueSeed {
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

// Band-representative scalar. Thresholds are [40, 70] for both supplier
// signals, so 20 lands `low`, 55 `mid`, 85 `high`.
function bandValue(band: BandId): number {
  return band === 'low' ? 20 : band === 'high' ? 85 : 55
}

const SUPPLIER_FALLBACK = 'A merchant stands at the counter, ledger in hand.'
const STOCK_FALLBACK =
  'The cellar door swings open on shelves that should be fuller.'
const DEBT_FALLBACK = 'The ledger sits open, last month written and waiting.'

// ─── supplier_relationship — every cell of the derived 9-cell matrix ──

describe('Phase 171 — supplier_relationship matrix is covered to the cell', () => {
  const meters = matrixMetersForFamily('supplier_relationship' as IssueSeedFamilyId)
  const cells = enumerateMatrixCells('supplier_relationship' as IssueSeedFamilyId)
  const slot = supplierReliabilityTemplate.slots.find(
    (s) => s.id === 'establishing_line',
  )!

  it('the Phase-3 read enumerates the reliability × relationship 9-cell cube', () => {
    expect(meters.map((m) => m.signal)).toEqual([
      'supplier.reliability',
      'supplier.relationship',
    ])
    expect(cells).toHaveLength(9)
  })

  for (const cell of cells) {
    it(`cell ${cell.key} resolves to a covering snippet (or the documented centre fallback)`, () => {
      const base = createInitialTavernState()
      const supplierId = firstSupplierId(base)
      const state = withSupplier(base, supplierId, {
        reliability: bandValue(cell.bands[0]!),
        relationship: bandValue(cell.bands[1]!),
      })
      const seed = supplierSeed(supplierId, `cov-${cell.key}`)

      // Allowlisted-unreachable cells are satisfied without a snippet.
      if (isCellAllowlisted('supplier_relationship' as IssueSeedFamilyId, cell.key)) {
        return
      }

      const resolved = resolveSalientReads(seed, state)
      // Mirror the legibility gate: a mid-band signal read (extremity 1) is
      // the intentional default, not a "meaningful" fact demanding cover.
      const meaningful = resolved.filter(
        (r) => !(r.read.kind === 'signal' && r.extremity <= 1),
      )
      const trace = pickSnippetTrace(slot, seed, state, {})
      expect(trace).toBeDefined()

      if (meaningful.length === 0) {
        // The all-mid centre cell: the fallback IS the story.
        expect(trace!.text).toBe(SUPPLIER_FALLBACK)
      } else {
        // A covering snippet fired (finite salience index), not the bare
        // mood line.
        const score = scoreCandidateSalience(trace!, meaningful)
        expect(score.index).not.toBe(Infinity)
        expect(trace!.text).not.toBe(SUPPLIER_FALLBACK)
      }
    })
  }

  it('renders the covering line into body[0] for the four corners', () => {
    const base = createInitialTavernState()
    const supplierId = firstSupplierId(base)
    const corners: { rel: BandId; rship: BandId }[] = [
      { rel: 'low', rship: 'low' },
      { rel: 'low', rship: 'high' },
      { rel: 'high', rship: 'low' },
      { rel: 'high', rship: 'high' },
    ]
    for (const { rel, rship } of corners) {
      const state = withSupplier(base, supplierId, {
        reliability: bandValue(rel),
        relationship: bandValue(rship),
      })
      const view = supplierReliabilityCard.render(
        supplierSeed(supplierId, `corner-${rel}-${rship}`),
        state,
      )
      expect(view.body[0]).not.toBe(SUPPLIER_FALLBACK)
    }
  })
})

// ─── stock_shortage / debt_rent — narrator-voiced, 0 matrix cells ─────

describe('Phase 171 — narrator-voiced families have 0 matrix cells', () => {
  it('stock_shortage and debt_rent enumerate to zero band cells', () => {
    expect(
      matrixMetersForFamily('stock_shortage' as IssueSeedFamilyId),
    ).toHaveLength(0)
    expect(
      enumerateMatrixCells('stock_shortage' as IssueSeedFamilyId),
    ).toHaveLength(0)
    expect(
      matrixMetersForFamily('debt_rent' as IssueSeedFamilyId),
    ).toHaveLength(0)
    expect(
      enumerateMatrixCells('debt_rent' as IssueSeedFamilyId),
    ).toHaveLength(0)
  })

  it('stock_shortage opens on a salient binary fact, not the fallback', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'stock_shortage')
    const seed = makeSeed({
      id: 'stock-cov',
      family: 'stock_shortage' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      severity: 80,
      toneHints: ['warning'],
    })
    const view = stockShortageCard.render(seed, state)
    expect(view.body[0]).not.toBe(STOCK_FALLBACK)
  })

  it('debt_rent opens on a salient binary fact, not the fallback', () => {
    const base = createInitialTavernState()
    const state = withRisingPressure(base, 'debt')
    const seed = makeSeed({
      id: 'debt-cov',
      family: 'debt_rent' as IssueSeedFamilyId,
      type: 'debt_pressure',
      timing: 'end_month',
      severity: 80,
      domain: ['economy', 'monthly', 'landlord'],
      toneHints: ['debt', 'pressure'],
    })
    const view = debtRentCard.render(seed, state)
    expect(view.body[0]).not.toBe(DEBT_FALLBACK)
  })
})

// ─── reachability allowlist — clean, no cluster entries ───────────────

describe('Phase 171 — reachability allowlist', () => {
  it('validates clean (no typo\'d or duplicate cells anywhere)', () => {
    expect(validateUnreachableCells()).toEqual([])
  })

  it('records no entries for this cluster — every supplier cell is reachable', () => {
    // generateSupplierRelationship biases toward low reliability but does
    // not floor it (blame / memory can lift a high-reliability supplier to
    // the pick), and relationship is not scored at all — so all nine
    // reliability × relationship cells are reachable and none is
    // allowlisted.
    expect(
      UNREACHABLE_CELLS['supplier_relationship' as IssueSeedFamilyId],
    ).toBeUndefined()
    expect(
      UNREACHABLE_CELLS['stock_shortage' as IssueSeedFamilyId],
    ).toBeUndefined()
    expect(
      UNREACHABLE_CELLS['debt_rent' as IssueSeedFamilyId],
    ).toBeUndefined()
  })
})
