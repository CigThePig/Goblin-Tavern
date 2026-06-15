// Phase 4b (teleology) — heavy playtest. Proves arc autonomy holds over
// many days: the hardcoded staff arc advances on its own, reaches the
// terminal `mastered` stage, and the ratchet tag persists for the rest of
// the run — all under a fixed seed (replay-deterministic, named `'arc'`
// stream). Registered ONLY in `HEAVY_TEST_GLOBS` (vitest.config.ts).

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  MASTERED_TAG,
  STAFF_MASTERY_ARC_ID,
} from '../../src/sim/modules/arcs'

function runDays(seed: string, days: number): TavernState[] {
  const trail: TavernState[] = []
  let state = createInitialTavernState()
  for (let i = 0; i < days; i += 1) {
    state = simulateDay(state, { seed }, FULL_PIPELINE).state
    trail.push(state)
  }
  return trail
}

describe('teleology phase 4b — heavy arc autonomy playtest', () => {
  it('advances the arc through its stages to `mastered` with no player input, and the ratchet persists', () => {
    const trail = runDays('phase-4b-heavy', 40)

    // The arc moved through more than one stage on its own — never staying
    // pinned at its initial `apprentice` stage.
    const stages = new Set(
      trail.map((s) => s.arcs[STAFF_MASTERY_ARC_ID]?.stage).filter(Boolean),
    )
    expect(stages.size).toBeGreaterThan(1)
    expect(stages.has('apprentice')).toBe(true)

    const final = trail[trail.length - 1]!.arcs[STAFF_MASTERY_ARC_ID]!
    expect(final.stage).toBe('mastered')
    expect(final.status).toBe('completed')
    expect(final.tags).toContain(MASTERED_TAG)

    // Once mastered, the ratchet tag never disappears for the rest of the run.
    const firstMasteredDay = trail.findIndex(
      (s) => s.arcs[STAFF_MASTERY_ARC_ID]?.tags.includes(MASTERED_TAG),
    )
    expect(firstMasteredDay).toBeGreaterThanOrEqual(0)
    for (let d = firstMasteredDay; d < trail.length; d += 1) {
      expect(trail[d]!.arcs[STAFF_MASTERY_ARC_ID]?.tags).toContain(MASTERED_TAG)
    }

    // No arc advancement ever wrote a pressure target. `causes` is a
    // per-day log, so scan every day across the run.
    const arcCauses = trail.flatMap((s) =>
      s.causes.filter((c) => c.tags.includes('arc')),
    )
    expect(arcCauses.length).toBeGreaterThan(0)
    expect(arcCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
    // At least one was an autonomous advancement cause.
    expect(arcCauses.some((c) => c.tags.includes('advance'))).toBe(true)
  })

  it('replays identically under the same seed across the whole run', () => {
    const a = runDays('phase-4b-replay', 30)
    const b = runDays('phase-4b-replay', 30)
    for (let i = 0; i < a.length; i += 1) {
      expect(JSON.stringify(a[i]!.arcs)).toBe(JSON.stringify(b[i]!.arcs))
    }
  })
})
