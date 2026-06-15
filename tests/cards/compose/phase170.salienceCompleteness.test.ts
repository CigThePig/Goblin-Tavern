// Phase 170 / ISSUE-138 — Complete Surface arc, Phase 3 (Salience
// Completeness & the Reachability Allowlist).
//
// Three deliverables, all reads + scaffold (no content, no gate):
//   1. Every seed family with an active generator has a SALIENCE_TABLES
//      entry — derived from ALL_SEED_GENERATORS, the single source of
//      truth, so the omission `policy_backlash` had can't recur.
//   2. A pure, enumerable matrix-cell read over SALIENCE_TABLES +
//      BAND_THRESHOLDS.
//   3. An unreachableCells allowlist scaffold (empty, validated).

import { describe, expect, it } from 'vitest'

import {
  SALIENCE_TABLES,
  resolveSalientReads,
  enumerateMatrixCells,
  matrixMetersForFamily,
  matrixCellKey,
  MAX_MATRIX_METERS,
  UNREACHABLE_CELLS,
  isCellAllowlisted,
  validateUnreachableCells,
} from '../../../src/cards/compose'
import { ALL_SEED_GENERATORS } from '../../../src/sim/modules/issues'
import type { IssueSeedFamilyId } from '../../../src/sim/modules/issues/issueSeedTypes'
import { ALL_BAND_IDS } from '../../../src/sim/signals'
import { makeSeed, makeTavernState } from '../cardFactories'

/** The families that actually emit seeds — derived, never hand-typed. */
const ACTIVE_FAMILIES: IssueSeedFamilyId[] = Array.from(
  new Set(ALL_SEED_GENERATORS.map((g) => g.family)),
) as IssueSeedFamilyId[]

// ─── 1. Salience completeness ────────────────────────────────────────

describe('salience completeness', () => {
  it('every family with an active generator has a salience table', () => {
    const missing = ACTIVE_FAMILIES.filter((f) => !SALIENCE_TABLES[f])
    expect(missing, `families with a generator but no salience table: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('there are 25 active families and all are covered', () => {
    // Sanity: the union of generator families is the full roster (21 entropy/
    // venture families + the teleology `opening` family added in Phase 2
    // + the two transformation-gated families added in Phase 3:
    // `liquor_compliance` (retirable) and `licensed_service` (locked)
    // + the teleology `staff_arc` family added in Phase 4b).
    expect(ACTIVE_FAMILIES.length).toBe(25)
    expect(ACTIVE_FAMILIES.every((f) => SALIENCE_TABLES[f] !== undefined)).toBe(true)
  })

  it('policy_backlash now has a table and resolves at render', () => {
    expect(SALIENCE_TABLES.policy_backlash).toBeDefined()
    const state = makeTavernState()
    // The narrator-voiced table leads with the `severity >= 70` crisis
    // floor; a deep-backlash seed surfaces it, proving the table is wired.
    const seed = makeSeed({ family: 'policy_backlash', severity: 82 })
    const resolved = resolveSalientReads(seed, state)
    expect(resolved.length).toBeGreaterThan(0)
    expect(resolved[0]!.read).toEqual({ kind: 'severity', atLeast: 70 })
    // Below the crisis floor the severity read drops out.
    const calm = resolveSalientReads(
      makeSeed({ family: 'policy_backlash', severity: 40 }),
      state,
    )
    expect(calm.some((r) => r.read.kind === 'severity')).toBe(false)
  })

  it('policy_backlash table declares no new SalienceRead kinds', () => {
    const kinds = new Set(
      SALIENCE_TABLES.policy_backlash!.reads.map((r) => r.kind),
    )
    const allowed = new Set([
      'signal',
      'pressure',
      'memory',
      'repeat',
      'hasTag',
      'severity',
    ])
    for (const k of kinds) expect(allowed.has(k)).toBe(true)
  })
})

// ─── 2. Matrix-cell read ─────────────────────────────────────────────

describe('matrix-cell read', () => {
  it('supplier_relationship is a 2-meter 9-cell matrix', () => {
    const meters = matrixMetersForFamily('supplier_relationship')
    expect(meters.map((m) => m.signal)).toEqual([
      'supplier.reliability',
      'supplier.relationship',
    ])
    const cells = enumerateMatrixCells('supplier_relationship')
    expect(cells.length).toBe(9)
    expect(new Set(cells.map((c) => c.key)).size).toBe(9)
    // Every band appears, keyed self-describingly.
    expect(cells.map((c) => c.key)).toContain(
      'supplier.reliability=low|supplier.relationship=high',
    )
  })

  it('culture_conflict is a full 3-meter 27-cell cube', () => {
    const meters = matrixMetersForFamily('culture_conflict')
    expect(meters.map((m) => m.signal)).toEqual([
      'culture.tension',
      'culture.comfort',
      'culture.familiarity',
    ])
    expect(enumerateMatrixCells('culture_conflict').length).toBe(27)
  })

  it('inspection caps at its top 3 signal reads (not 4 → 81 cells)', () => {
    // inspection's salience table lists FOUR signal reads; the matrix is
    // capped at MAX_MATRIX_METERS so it is a 27-cell cube, not 81.
    const signalReads = SALIENCE_TABLES.inspection!.reads.filter(
      (r) => r.kind === 'signal',
    )
    expect(signalReads.length).toBeGreaterThan(MAX_MATRIX_METERS)
    const meters = matrixMetersForFamily('inspection')
    expect(meters.length).toBe(MAX_MATRIX_METERS)
    expect(meters.map((m) => m.signal)).toEqual([
      'faction.relationship',
      'faction.influence',
      'area.cleanliness',
    ])
    expect(enumerateMatrixCells('inspection').length).toBe(3 ** MAX_MATRIX_METERS)
  })

  it('narrator-voiced families have a zero-cell matrix', () => {
    // No banded signal read on the subject → no decision-distinct band
    // cells. Their establishing line keys off pressure / memory / severity.
    for (const f of [
      'policy_backlash',
      'stock_shortage',
      'debt_rent',
      'reputation_shift',
      'rumour_crisis',
      'rival_tavern',
      'monthly_review',
      'seasonal_arc',
      'staff_arc',
    ] as IssueSeedFamilyId[]) {
      expect(matrixMetersForFamily(f)).toEqual([])
      expect(enumerateMatrixCells(f)).toEqual([])
    }
  })

  it('cell bands are parallel to meters and use the real band ids', () => {
    const cells = enumerateMatrixCells('supplier_relationship')
    for (const cell of cells) {
      expect(cell.bands.length).toBe(cell.meters.length)
      for (const band of cell.bands) expect(ALL_BAND_IDS).toContain(band)
      expect(cell.key).toBe(matrixCellKey(cell.meters, cell.bands))
    }
  })

  it('is deterministic — two enumerations are byte-equal', () => {
    for (const f of ACTIVE_FAMILIES) {
      const a = enumerateMatrixCells(f).map((c) => c.key)
      const b = enumerateMatrixCells(f).map((c) => c.key)
      expect(a).toEqual(b)
    }
  })

  it('every meter signal is a real banded signal across all families', () => {
    // matrixMetersForFamily throws on an unbanded signal; calling it for
    // every active family proves no salience table has a typo'd signal.
    for (const f of ACTIVE_FAMILIES) {
      expect(() => matrixMetersForFamily(f)).not.toThrow()
    }
  })
})

// ─── 3. Reachability allowlist scaffold ──────────────────────────────

describe('unreachableCells allowlist', () => {
  it('ships empty — Movement II populates it after picker instrumentation', () => {
    expect(Object.keys(UNREACHABLE_CELLS)).toEqual([])
  })

  it('isCellAllowlisted returns false everywhere today', () => {
    for (const f of ACTIVE_FAMILIES) {
      for (const cell of enumerateMatrixCells(f)) {
        expect(isCellAllowlisted(f, cell.key)).toBe(false)
      }
    }
    expect(isCellAllowlisted('supplier_relationship', 'not-a-real-cell')).toBe(false)
  })

  it('validates — every entry references a real enumerable cell', () => {
    // The invariant that catches a typo'd allowlist addition in Movement II.
    expect(validateUnreachableCells()).toEqual([])
  })
})
