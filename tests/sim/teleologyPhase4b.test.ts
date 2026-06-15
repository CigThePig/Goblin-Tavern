import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import { pickCardForSeed } from '../../src/cards/selection'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { staffArcCard } from '../../src/cards/templates/staffArc'
import {
  createStaffMasteryArc,
  MASTERED_TAG,
  PROVEN_TAG,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from '../../src/sim/modules/arcs'

const WITHOUT_ARCS = FULL_PIPELINE.filter((m) => m.id !== 'arcs')

function run(state = createInitialTavernState(), extra = {}, pipeline = FULL_PIPELINE) {
  return simulateDay(state, { seed: 'teleology-phase-4b', ...extra }, pipeline)
}

function seedsToday(state: TavernState): IssueSeed[] {
  return (state.modules.issueSeeds as { seedsToday: IssueSeed[] }).seedsToday
}

/** Build a fresh state with the arc pre-seeded at a chosen stage/progress
 *  and the subject's loyalty pinned, so a single tick exercises the fork. */
function stateWithArc(opts: {
  stage: string
  progress: number
  loyalty: number
}): TavernState {
  const state = createInitialTavernState()
  const subject = state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]!
  // Pin loyalty (the driving meter) and pre-attach so the seed/attach hook
  // short-circuits and the tick drives the arc directly.
  state.staff[STAFF_MASTERY_ARC_SUBJECT_ID] = {
    ...subject,
    loyalty: opts.loyalty,
    castAttributes: { ...subject.castAttributes!, arcId: STAFF_MASTERY_ARC_ID },
  }
  const arc = createStaffMasteryArc("Mira's path to mastery", 0)
  state.arcs[STAFF_MASTERY_ARC_ID] = { ...arc, stage: opts.stage, progress: opts.progress }
  return state
}

describe('teleology phase 4b — autonomous arc advancement + fork-on-state', () => {
  it('advances the arc on its own, with NO player intent in the input', () => {
    // A fresh game: the arc spawns at apprentice, then advances under the
    // autonomous tick alone — no responses are ever submitted.
    let state = createInitialTavernState()
    let advancedAwayFromApprentice = false
    for (let i = 0; i < 6; i += 1) {
      state = run(state).state
      if (state.arcs[STAFF_MASTERY_ARC_ID]?.stage !== 'apprentice') {
        advancedAwayFromApprentice = true
        break
      }
    }
    expect(advancedAwayFromApprentice).toBe(true)
  })

  it('forks on character state: a proven (high-loyalty) apprentice steps up to journeyman', () => {
    const day = run(stateWithArc({ stage: 'apprentice', progress: 2, loyalty: 80 }))
    const arc = day.state.arcs[STAFF_MASTERY_ARC_ID]!
    expect(arc.stage).toBe('journeyman')
    expect(arc.tags).toContain(PROVEN_TAG)
  })

  it('forks on character state: an unproven (low-loyalty) apprentice settles into steady', () => {
    const day = run(stateWithArc({ stage: 'apprentice', progress: 2, loyalty: 40 }))
    const arc = day.state.arcs[STAFF_MASTERY_ARC_ID]!
    expect(arc.stage).toBe('steady')
    expect(arc.tags).not.toContain(PROVEN_TAG)
  })

  it('emits a causality entry on advancement that never targets a pressure', () => {
    const day = run(stateWithArc({ stage: 'apprentice', progress: 2, loyalty: 80 }))
    const advanceCauses = day.state.causes.filter(
      (c) =>
        c.tags.includes('arc') &&
        c.tags.includes('advance') &&
        c.tags.includes(STAFF_MASTERY_ARC_ID),
    )
    expect(advanceCauses.length).toBeGreaterThan(0)
    expect(advanceCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })

  it('reaches the terminal `mastered` stage, writing a ratchet tag that persists across a save/load', () => {
    // A proven journeyman is one milestone from mastery.
    const day = run(stateWithArc({ stage: 'journeyman', progress: 3, loyalty: 80 }))
    const arc = day.state.arcs[STAFF_MASTERY_ARC_ID]!
    expect(arc.stage).toBe('mastered')
    expect(arc.status).toBe('completed')
    expect(arc.tags).toContain(MASTERED_TAG)
    // The ratchet survives serialize → load.
    const roundTripped = JSON.parse(JSON.stringify(day.state)) as TavernState
    expect(roundTripped.arcs[STAFF_MASTERY_ARC_ID]?.tags).toContain(MASTERED_TAG)
    // A completed arc no longer advances or emits a seed.
    const day2 = run(day.state)
    expect(day2.state.arcs[STAFF_MASTERY_ARC_ID]?.stage).toBe('mastered')
    expect(seedsToday(day2.state).some((s) => s.family === 'staff_arc')).toBe(false)
  })

  it('surfaces the arc milestone as a staff_arc seed that resolves to the staff_arc card', () => {
    const day = run()
    const arcSeed = seedsToday(day.state).find((s) => s.family === 'staff_arc')
    expect(arcSeed).toBeTruthy()
    expect(arcSeed?.type).toBe('arc_milestone')
    // The seed resolves the arc from its `arc:<id>` target — not a hardcoded id.
    expect(arcSeed?.primaryActor?.id).toBe(`arc:${STAFF_MASTERY_ARC_ID}`)
    const chosen = pickCardForSeed(arcSeed!, day.state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(staffArcCard.id)
  })

  it('is replay-deterministic under a fixed seed (the named "arc" RNG stream)', () => {
    let a = createInitialTavernState()
    let b = createInitialTavernState()
    for (let i = 0; i < 8; i += 1) {
      a = run(a).state
      b = run(b).state
    }
    expect(JSON.stringify(a.arcs)).toBe(JSON.stringify(b.arcs))
  })

  it('never writes the loyalty meter — the arc tick reads loyalty, it does not move it', () => {
    let withArc = createInitialTavernState()
    let withoutArc = createInitialTavernState()
    for (let i = 0; i < 6; i += 1) {
      withArc = run(withArc).state
      withoutArc = run(withoutArc, {}, WITHOUT_ARCS).state
    }
    const loyaltyMap = (s: TavernState) =>
      Object.fromEntries(Object.values(s.staff).map((m) => [m.id, m.loyalty] as const))
    expect(loyaltyMap(withArc)).toEqual(loyaltyMap(withoutArc))
  })

  it('walks arc advancement into the day diff (stage flip + progress meter)', () => {
    const day = run(stateWithArc({ stage: 'apprentice', progress: 2, loyalty: 80 }))
    const dayDiff = day.diffs.find((d) => d.boundary === 'day')
    const paths = dayDiff?.changes.map((c) => c.path) ?? []
    expect(paths).toContain(`arcs.${STAFF_MASTERY_ARC_ID}.stage`)
  })
})
