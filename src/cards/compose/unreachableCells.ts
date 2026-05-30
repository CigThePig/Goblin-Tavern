// Phase 170 / ISSUE-138 — Complete Surface arc, Phase 3 (Salience
// Completeness & the Reachability Allowlist).
//
// The reachability allowlist. A matrix cell (see `matrixCells.ts`) is
// "satisfied" by the Phase-12 coverage gate if EITHER a covering
// establishing snippet exists OR the cell is recorded here as one the seed
// picker provably cannot emit. This makes "we chose not to author this
// cell because the sim can't reach it" inspectable DATA with a recorded
// reason — not a silent hole an author left on the diagonal.
//
// SEEDED EMPTY, deliberately. The arc's Phase-3 "Do not do" is explicit:
// "Don't put unreachable cells in the allowlist on a guess — if a cell's
// reachability is uncertain, Movement II resolves it by instrumenting the
// picker, not by pre-allowlisting it." The motivating audit
// (complete-surface-arc.md Appendix A) named the gaps only in aggregate
// ("~8 of 27 cube cells"), not as specific verified picker-blocked cells,
// so there is nothing audit-verified to seed. The doc's `rowdiness = low`
// line is given as the *format* of a reason; inspecting the violence
// picker (it selects groups tagged `rowdy` / `dangerous` /
// `incident_prone`, scored by `patronage + rowdiness`) shows a
// `dangerous`-tagged low-rowdiness group IS selectable — so that
// illustrative cell is not actually unreachable and must not be seeded.
//
// Each Movement-II cluster phase (4–11) populates its family's entries
// AFTER instrumenting that family's picker. The real-cell invariant in the
// Phase-170 test (and later the Phase-12 gate) checks every entry's
// `cellKey` against `enumerateMatrixCells(family)`, so a typo'd or
// non-existent allowlisted cell fails the suite.

import type { IssueSeedFamilyId } from '../../sim/modules/issues/issueSeedTypes'
import { enumerateMatrixCells } from './matrixCells'

/** One cell a family's seed picker provably cannot emit. `cellKey` matches
 *  {@link MatrixCell.key} (`"signalA=low|signalB=high"`). `reason` is a
 *  one-line, human-readable justification tying the unreachability to the
 *  picker's selection logic — e.g. "complaint seed fires only at
 *  satisfaction <= 60, so satisfaction=high is unreachable". */
export type UnreachableCell = {
  readonly cellKey: string
  readonly reason: string
}

/**
 * Cells the seed picker cannot reach, per family. Seeded empty — Movement
 * II populates it per cluster after picker instrumentation. The format a
 * future entry follows (kept as a comment so it is documentation, not
 * unverified active data):
 *
 *   customer_complaint: [
 *     {
 *       cellKey: 'customer_group.satisfaction=high|customer_group.loyalty=low',
 *       reason: 'complaint seed fires only when satisfaction <= 60 (band low|mid), so satisfaction=high is unreachable',
 *     },
 *   ],
 */
export const UNREACHABLE_CELLS: Partial<
  Record<IssueSeedFamilyId, readonly UnreachableCell[]>
> = {}

/** Is this cell recorded as unreachable for this family? Pure. */
export function isCellAllowlisted(
  family: IssueSeedFamilyId,
  cellKey: string,
): boolean {
  const entries = UNREACHABLE_CELLS[family]
  if (!entries) return false
  return entries.some((c) => c.cellKey === cellKey)
}

/**
 * Validate the allowlist against the matrix-cell read: every allowlisted
 * `cellKey` must be a real enumerable cell of its family, and no family may
 * list the same cell twice. Returns the list of problems (empty = valid).
 * Pure — the Phase-170 test and the Phase-12 gate both call this so a bad
 * allowlist addition fails fast, named.
 */
export function validateUnreachableCells(): string[] {
  const problems: string[] = []
  for (const family of Object.keys(UNREACHABLE_CELLS) as IssueSeedFamilyId[]) {
    const entries = UNREACHABLE_CELLS[family] ?? []
    const validKeys = new Set(
      enumerateMatrixCells(family).map((cell) => cell.key),
    )
    const seen = new Set<string>()
    for (const entry of entries) {
      if (!validKeys.has(entry.cellKey)) {
        problems.push(
          `unreachableCells["${family}"]: "${entry.cellKey}" is not an enumerable matrix cell of that family`,
        )
      }
      if (seen.has(entry.cellKey)) {
        problems.push(
          `unreachableCells["${family}"]: "${entry.cellKey}" listed more than once`,
        )
      }
      seen.add(entry.cellKey)
    }
  }
  return problems
}
