// Phase 170 / ISSUE-138 — Complete Surface arc, Phase 3 (Salience
// Completeness & the Reachability Allowlist).
//
// A pure, enumerable read over `SALIENCE_TABLES` + `BAND_THRESHOLDS` that
// turns "is this situation's establishing matrix complete?" from an
// author's-eye judgement into a machine question. Movement II's content
// phases (4–11) author against the cells this read enumerates; the
// Phase-12 coverage gate (`checkMatrixCoverage`) walks the same read and
// fails on any cell that is neither covered by a snippet nor recorded in
// the `unreachableCells` allowlist.
//
// Two structural rules carried from the framework (§2.3), the same the
// salience reads obey:
//   1. Cells are DATA, not closures — enumerable, comparable by `key`,
//      inspectable by a gate.
//   2. The read stays flat: a family's "matrix" is the cartesian product
//      of band states over its top salient *meters* (the `signal` reads of
//      its salience table). Pressures / memories / severity / repeats are
//      not band-enumerable; they decorate the establishing line but do not
//      define matrix cells. Narrator-voiced families with no banded signal
//      therefore have a zero-cell matrix — by design, not by omission.

import {
  ALL_BAND_IDS,
  BAND_THRESHOLDS,
  type BandId,
  type SignalId,
} from '../../sim/signals'
import type { IssueSeedFamilyId } from '../../sim/modules/issues/issueSeedTypes'
import { SALIENCE_TABLES } from './salience'

/**
 * The maximum number of salient meters a matrix ranges over. A 3-meter
 * cube (3^3 = 27 cells) is the documented establishing-matrix ceiling
 * (legible-surface-arc.md Appendix A). A family whose salience table
 * declares more than three banded `signal` reads is capped at its three
 * most salient (earliest in the table), matching how the Movement-VI pools
 * authored — e.g. `inspection` lists four signal reads but its cube fixes
 * one meter and spans three.
 */
export const MAX_MATRIX_METERS = 3

/** One banded meter a situation's matrix ranges over. `role` is the
 *  salience-read actor role (`'primaryActor'` / `'location'`) the
 *  Phase-12 coverage gate resolves the signal against. */
export type MatrixMeter = {
  readonly signal: SignalId
  readonly role: string
}

/** One decision-distinct cell of a situation's establishing matrix: a
 *  band assignment for each of the matrix's meters. `bands` is parallel to
 *  `meters`. `key` is a stable, self-describing identifier
 *  (`"signalA=low|signalB=high"`) used to compare a cell against authored
 *  snippets and the `unreachableCells` allowlist. */
export type MatrixCell = {
  readonly meters: readonly MatrixMeter[]
  readonly bands: readonly BandId[]
  readonly key: string
}

/** The banded meters a family's establishing matrix ranges over: the
 *  `signal` reads of its salience table, in table (salience) order, capped
 *  at {@link MAX_MATRIX_METERS}. Empty for families with no table or no
 *  banded signal read (narrator-voiced families). Pure. */
export function matrixMetersForFamily(
  family: IssueSeedFamilyId,
): MatrixMeter[] {
  const table = SALIENCE_TABLES[family]
  if (!table) return []
  const meters: MatrixMeter[] = []
  for (const read of table.reads) {
    if (read.kind !== 'signal') continue
    // Guard: a matrix meter must be a real banded signal. `BAND_THRESHOLDS`
    // is the band-cardinality source — every signal it keys has the three
    // `ALL_BAND_IDS` bands. A signal absent here would be a table typo.
    if (!(read.signal in BAND_THRESHOLDS)) {
      throw new Error(
        `Salience table for "${family}" references unbanded signal "${read.signal}"`,
      )
    }
    meters.push({ signal: read.signal, role: read.role })
    if (meters.length >= MAX_MATRIX_METERS) break
  }
  return meters
}

/** Stable cell key for a meter/band assignment. Exported so the coverage
 *  gate and the allowlist describe cells the same way. */
export function matrixCellKey(
  meters: readonly MatrixMeter[],
  bands: readonly BandId[],
): string {
  return meters.map((m, i) => `${m.signal}=${bands[i]}`).join('|')
}

/** Enumerate the decision-distinct cells of a family's establishing
 *  matrix: the cartesian product of `ALL_BAND_IDS` (low / mid / high) over
 *  the family's matrix meters. `3^n` cells for `n` meters (`n ≤ 3`). Empty
 *  for narrator-voiced families. Deterministic — band order follows
 *  `ALL_BAND_IDS`, meter order follows the salience table. Pure. */
export function enumerateMatrixCells(
  family: IssueSeedFamilyId,
): MatrixCell[] {
  const meters = matrixMetersForFamily(family)
  if (meters.length === 0) return []
  let combos: BandId[][] = [[]]
  for (let i = 0; i < meters.length; i++) {
    const next: BandId[][] = []
    for (const combo of combos) {
      for (const band of ALL_BAND_IDS) next.push([...combo, band])
    }
    combos = next
  }
  return combos.map((bands) => ({
    meters,
    bands,
    key: matrixCellKey(meters, bands),
  }))
}
