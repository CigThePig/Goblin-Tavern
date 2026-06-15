import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { safeValidateState } from '../../src/sim/state/validation'
import { ensureTeleologySlices } from '../../src/sim/state/migrations'
import {
  createStaffMasteryArc,
  STAFF_MASTERY_ARC_ID,
  STAFF_MASTERY_ARC_SUBJECT_ID,
} from '../../src/sim/modules/arcs'

const WITHOUT_ARCS = FULL_PIPELINE.filter((m) => m.id !== 'arcs')

function run(state = createInitialTavernState(), extra = {}, pipeline = FULL_PIPELINE) {
  return simulateDay(state, { seed: 'teleology-phase-4a', ...extra }, pipeline)
}

describe('teleology phase 4a — arc slice + cast attachment', () => {
  it('seeds and attaches the hardcoded arc to a starter cast member, emitting a cause', () => {
    const day1 = run()
    const arc = day1.state.arcs[STAFF_MASTERY_ARC_ID]
    expect(arc).toBeTruthy()
    expect(arc?.kind).toBe('arc')
    expect(arc?.stage).toBe('apprentice')
    expect(arc?.status).toBe('active')
    // The arc back-references its subject via a tag; the cast member
    // forward-references the arc via castAttributes.arcId.
    expect(arc?.tags).toContain(`subject:${STAFF_MASTERY_ARC_SUBJECT_ID}`)
    const subject = day1.state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]
    expect(subject?.castAttributes?.arcId).toBe(STAFF_MASTERY_ARC_ID)

    // Guardrail §7: the spawn/attach lands a CauseEntry (never a silent
    // lifecycle transition). It targets the arc, never a pressure.
    const spawnCauses = day1.state.causes.filter(
      (c) => c.tags.includes('teleology') && c.tags.includes('arc'),
    )
    expect(spawnCauses.length).toBeGreaterThan(0)
    expect(spawnCauses.every((c) => !c.target.startsWith('pressure'))).toBe(true)
  })

  it('surfaces the arc spawn in the day diff so reports/projections can observe it', () => {
    const day1 = run()
    const dayDiff = day1.diffs.find((d) => d.boundary === 'day')
    const paths = dayDiff?.changes.map((c) => c.path) ?? []
    expect(paths).toContain(`arcs.${STAFF_MASTERY_ARC_ID}`)
  })

  it('is idempotent — the arc is spawned exactly once and persists across days', () => {
    const day1 = run()
    const day2 = run(day1.state)
    const day3 = run(day2.state)
    expect(Object.keys(day3.state.arcs)).toEqual([STAFF_MASTERY_ARC_ID])
    // Exactly one arc-spawn cause across the whole run — the hook
    // short-circuits once the arc exists (addArc would otherwise throw on
    // a duplicate id). The cause log accumulates across days, so a second
    // spawn would show as a second entry here.
    const arcSpawnCauses = day3.state.causes.filter(
      (c) =>
        c.tags.includes('arc') &&
        c.tags.includes('spawn') &&
        c.tags.includes(STAFF_MASTERY_ARC_ID),
    )
    expect(arcSpawnCauses.length).toBe(1)
    // The arc is still attached and is the only arc. (Its STAGE may have
    // advanced — Phase 4b adds the autonomous trigger that moves the arc on
    // its own; the spawn-once / persist / attach invariants this test owns
    // are unaffected by that movement.)
    expect(day3.state.arcs[STAFF_MASTERY_ARC_ID]).toBeTruthy()
    expect(
      day3.state.staff[STAFF_MASTERY_ARC_SUBJECT_ID]?.castAttributes?.arcId,
    ).toBe(STAFF_MASTERY_ARC_ID)
  })

  it('round-trips a populated arc slice through serialize → load and validates', () => {
    const day1 = run()
    expect(safeValidateState(day1.state, { modules: FULL_PIPELINE }).success).toBe(
      true,
    )
    const roundTripped = JSON.parse(JSON.stringify(day1.state))
    const validation = safeValidateState(roundTripped, { modules: FULL_PIPELINE })
    expect(validation.success).toBe(true)
    expect(roundTripped.arcs[STAFF_MASTERY_ARC_ID].stage).toBe('apprentice')
    expect(
      roundTripped.staff[STAFF_MASTERY_ARC_SUBJECT_ID].castAttributes.arcId,
    ).toBe(STAFF_MASTERY_ARC_ID)
  })

  it('migrates a populated arc slice idempotently', () => {
    const state = createInitialTavernState()
    state.arcs[STAFF_MASTERY_ARC_ID] = createStaffMasteryArc("Mira's path to mastery", 0)
    const migrated = ensureTeleologySlices(state)
    const rerun = ensureTeleologySlices(migrated)
    // Already-present slices are passed through untouched (referential
    // no-op), and the populated arc survives.
    expect(rerun).toBe(migrated)
    expect(migrated.arcs[STAFF_MASTERY_ARC_ID]?.stage).toBe('apprentice')
  })

  it('leaves loyalty byte-identical — the arc slice adds a trajectory beside loyalty, never replaces it', () => {
    // Run the same seeded scenario with and without `arcModule`. The arc
    // slice's only staff write is `castAttributes.arcId`; every loyalty
    // value across days must match exactly (no RNG shift, no meter touch).
    let withArc = createInitialTavernState()
    let withoutArc = createInitialTavernState()
    for (let i = 0; i < 5; i += 1) {
      withArc = run(withArc).state
      withoutArc = run(withoutArc, {}, WITHOUT_ARCS).state
    }
    const loyaltyMap = (s: typeof withArc) =>
      Object.fromEntries(
        Object.values(s.staff).map((m) => [m.id, m.loyalty] as const),
      )
    expect(loyaltyMap(withArc)).toEqual(loyaltyMap(withoutArc))
    // And the without-arc run never grew the slice.
    expect(withoutArc.arcs).toEqual({})
    expect(withArc.arcs[STAFF_MASTERY_ARC_ID]).toBeTruthy()
  })
})
