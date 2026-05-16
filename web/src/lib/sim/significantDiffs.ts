// Helpers for projecting a SimResult into UI-friendly diff lines.

import type { SimResult } from '../../../../src/sim/core/result'
import type { StateChange } from '../../../../src/sim/core/diff'

export type DiffLine = {
  readable: string
  direction: 'gain' | 'loss' | 'neutral'
  tags: string[]
  path: string
}

function direction(change: StateChange): 'gain' | 'loss' | 'neutral' {
  if (change.delta === undefined) return 'neutral'
  if (change.delta > 0) return 'gain'
  if (change.delta < 0) return 'loss'
  return 'neutral'
}

/**
 * Pull the day's significant changes from the engine's tagged diff,
 * sorted by absolute delta magnitude (descending) so the most
 * impactful lines lead.
 */
export function significantDiffLines(
  result: SimResult | undefined,
  limit = 8,
): DiffLine[] {
  if (!result) return []
  const dayDiff = result.diffs.find((d) => d.boundary === 'day')
  if (!dayDiff) return []
  const ranked = [...dayDiff.significantChanges].sort((a, b) => {
    const am = Math.abs(a.delta ?? 0)
    const bm = Math.abs(b.delta ?? 0)
    return bm - am
  })
  return ranked.slice(0, limit).map((c) => ({
    readable: c.readable,
    direction: direction(c),
    tags: c.tags,
    path: c.path,
  }))
}
