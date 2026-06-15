// Phase 4c (teleology) — heavy cross-pollination playtest. Proves the
// arc → venture gate holds across many days: a signature-brew venture parked
// at `refining` cannot reach `signature` until a staff-mastery arc advances
// (autonomously) all the way to `mastered` and writes the `master_on_staff`
// transformation — at which point the venture unlocks. Plus a replay /
// determinism check. Registered ONLY in `HEAVY_TEST_GLOBS`.

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  createSignatureBrewVenture,
  SIGNATURE_BREW_TRANSFORMATION_ID,
  SIGNATURE_BREW_VENTURE_ID,
} from '../../src/sim/modules/ventures'
import {
  createStaffMasteryArc,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from '../../src/sim/modules/arcs'
import { MASTER_ON_STAFF_TRANSFORMATION_ID } from '../../src/sim/modules/teleologyCrossLinks'

const BREW = SIGNATURE_BREW_VENTURE_ID
const ARC = STAFF_MASTERY_ARC_ID

/** A fresh state with a high-loyalty staffer (so the arc masters quickly)
 *  and a brew venture parked at `refining` with its progress requirement
 *  already met — so the ONLY thing gating it is the arc-produced
 *  `master_on_staff` transformation. */
function scenario(): TavernState {
  const state = createInitialTavernState()
  const subject = state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]!
  state.staff[STAFF_MASTERY_ARC_SUBJECT_ID] = {
    ...subject,
    loyalty: 90, // well past PROVEN_LOYALTY → the arc forks up to mastery
    castAttributes: { ...subject.castAttributes!, arcId: ARC },
  }
  state.arcs[ARC] = createStaffMasteryArc("Mira's path to mastery", 0)
  state.ventures[BREW] = { ...createSignatureBrewVenture(0), stage: 'refining', progress: 2 }
  return state
}

function runTrail(seed: string, days: number): TavernState[] {
  const trail: TavernState[] = []
  let state = scenario()
  for (let i = 0; i < days; i += 1) {
    state = simulateDay(state, { seed }, FULL_PIPELINE).state
    trail.push(state)
  }
  return trail
}

describe('teleology phase 4c — heavy cross-pollination playtest', () => {
  it('the brew venture stays blocked at refining until the arc masters, then unlocks to signature', () => {
    const trail = runTrail('phase-4c-heavy', 40)

    // The day the arc-produced transformation first goes active.
    const unlockDay = trail.findIndex(
      (s) => s.transformations[MASTER_ON_STAFF_TRANSFORMATION_ID]?.active === true,
    )
    expect(unlockDay).toBeGreaterThanOrEqual(0)

    // The arc genuinely reached mastery (the producer of the gate fact).
    expect(trail[unlockDay]!.arcs[ARC]?.stage).toBe('mastered')

    // Before the unlock, the venture is held at `refining` every single day —
    // the gate held across many days, not just once.
    for (let d = 0; d < unlockDay; d += 1) {
      expect(trail[d]!.ventures[BREW]?.stage).toBe('refining')
      expect(trail[d]!.ventures[BREW]?.status).toBe('active')
    }

    // The venture unlocks: it reaches `signature` (terminal) and writes its
    // own ratchet, and never reverts for the rest of the run.
    const final = trail[trail.length - 1]!.ventures[BREW]!
    expect(final.stage).toBe('signature')
    expect(final.status).toBe('completed')
    expect(trail[trail.length - 1]!.transformations[SIGNATURE_BREW_TRANSFORMATION_ID]?.active).toBe(true)

    const firstSignatureDay = trail.findIndex((s) => s.ventures[BREW]?.stage === 'signature')
    expect(firstSignatureDay).toBeGreaterThanOrEqual(unlockDay)
    for (let d = firstSignatureDay; d < trail.length; d += 1) {
      expect(trail[d]!.ventures[BREW]?.stage).toBe('signature')
    }

    // No cross-pollination cause ever targeted a pressure (constraint 3/4).
    const teleologyCauses = trail.flatMap((s) =>
      s.causes.filter((c) => c.tags.includes('teleology')),
    )
    expect(teleologyCauses.length).toBeGreaterThan(0)
    expect(teleologyCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })

  it('replays identically under the same seed (ventures, arcs, transformations)', () => {
    const a = runTrail('phase-4c-replay', 30)
    const b = runTrail('phase-4c-replay', 30)
    for (let i = 0; i < a.length; i += 1) {
      expect(JSON.stringify(a[i]!.ventures)).toBe(JSON.stringify(b[i]!.ventures))
      expect(JSON.stringify(a[i]!.arcs)).toBe(JSON.stringify(b[i]!.arcs))
      expect(JSON.stringify(a[i]!.transformations)).toBe(JSON.stringify(b[i]!.transformations))
    }
  })
})
