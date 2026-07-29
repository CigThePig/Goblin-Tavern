import type { StateChange, StateDiff } from '../../core/diff'
import type { CauseEntry } from '../../state/TavernState'
import {
  canonicalCauseTarget,
  targetMatches,
} from '../../modules/causes/causeTargets'

// Expansion Phase 1 §1.4 — the targeted diff-to-cause audit.
//
// The existing cause report already lists "unexplained significant
// changes", but it treats every path the same and it treats a missing
// canonical mapping as an unexplained change — which means the noise floor
// (`modules.*` bookkeeping) hides the real gaps. §1.4 asks for a TARGETED
// audit instead: pick the classes of change that must never be unexplained,
// and check only those, so a regression is a specific, actionable failure
// rather than a number that has always been non-zero.
//
// The classes below are the ones the plan names, plus coin. A change in one
// of these with no matching cause is a genuine causality bug: the player can
// see the number move and the simulation cannot say why.

export type AuditedCauseClass =
  | 'coin'
  | 'reputation'
  | 'pressure'
  | 'area'
  | 'stock'
  | 'staff'
  | 'rumour'
  | 'venture'
  | 'arc'
  | 'transformation'

export const AUDITED_CAUSE_CLASSES: ReadonlyArray<AuditedCauseClass> = [
  'coin',
  'reputation',
  'pressure',
  'area',
  'stock',
  'staff',
  'rumour',
  'venture',
  'arc',
  'transformation',
] as const

/**
 * Which audited class a diff path belongs to, or `undefined` when the path
 * is outside the audited set.
 *
 * `modules.*` deliberately maps to nothing: module-internal bookkeeping
 * (a suffix counter, a per-day id list) is not a player-visible fact and
 * demanding a cause for it would only teach module authors to emit noise.
 */
export function auditedClassForPath(path: string): AuditedCauseClass | undefined {
  if (path === 'coin' || path.startsWith('coin.')) return 'coin'
  if (path.startsWith('reputation.')) return 'reputation'
  if (path.startsWith('pressures.')) return 'pressure'
  if (path.startsWith('areas.')) return 'area'
  if (path.startsWith('stock.')) return 'stock'
  if (path.startsWith('staff.')) return 'staff'
  if (path.startsWith('socialRumours.') || path.startsWith('world.socialRumours.')) {
    return 'rumour'
  }
  if (path.startsWith('ventures.')) return 'venture'
  if (path.startsWith('arcs.')) return 'arc'
  if (path.startsWith('transformations.')) return 'transformation'
  return undefined
}

export type CausalGap = {
  class: AuditedCauseClass
  path: string
  readable: string
  /** The canonical cause target that was looked for and not found. */
  expectedTarget: string | undefined
}

export type CausalAuditResult = {
  /** Audited changes with a matching cause. */
  covered: number
  gaps: CausalGap[]
  /** Per-class counts, so a regression names the domain that caused it. */
  byClass: Record<AuditedCauseClass, { covered: number; gaps: number }>
}

/**
 * Audit one day's diff against the day's causes.
 *
 * A grouped cause counts as coverage for each element it names — that is
 * the whole point of the convention in `groupedTargets.ts`, and it is why
 * `targetMatches` had to learn about grouped targets rather than the audit
 * special-casing them here.
 */
export function auditCausalCoverage(
  diff: StateDiff | undefined,
  causes: ReadonlyArray<CauseEntry>,
): CausalAuditResult {
  const byClass = Object.fromEntries(
    AUDITED_CAUSE_CLASSES.map((c) => [c, { covered: 0, gaps: 0 }]),
  ) as CausalAuditResult['byClass']
  const gaps: CausalGap[] = []
  let covered = 0

  for (const change of diff?.significantChanges ?? []) {
    const auditClass = auditedClassForPath(change.path)
    if (!auditClass) continue

    const expectedTarget = canonicalCauseTarget(change.path)
    const matched =
      expectedTarget !== undefined &&
      causes.some((cause) => targetMatches(cause.target, expectedTarget))

    if (matched) {
      covered += 1
      byClass[auditClass].covered += 1
    } else {
      byClass[auditClass].gaps += 1
      gaps.push({
        class: auditClass,
        path: change.path,
        readable: change.readable,
        expectedTarget,
      })
    }
  }

  return { covered, gaps, byClass }
}

/** Changes in the audited classes, for tests that want the denominator. */
export function auditedChanges(diff: StateDiff | undefined): StateChange[] {
  return (diff?.significantChanges ?? []).filter(
    (change) => auditedClassForPath(change.path) !== undefined,
  )
}
