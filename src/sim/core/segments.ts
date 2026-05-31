// Phase 186 (Cluster 2) — Day segments.
//
// The day-clock contract (`docs/plans/phase-186-day-clock-time-economy.md`
// §2) splits the canonical phase pipeline into three ordered segments
// bracketed by the engine's two player-input phases:
//
//   SEGMENT A — setup → the morning the player sees
//     startDay … forecastTraffic
//   ⏸ PAUSE 1 (morning plan)        — input: ownerActions + staffPriorities
//   SEGMENT B — proactive moves → the day happening
//     beforeOwnerActions … closing  (service resolves; pressures recomputed)
//   ⏸ PAUSE 2 (service react)       — input: responseIntents
//   SEGMENT C — wrap-up (pure aftermath)
//     applyResponses … advanceCalendar
//
// A segment is a *contiguous slice* of `SIMULATION_PHASES`; the three
// slices partition the pipeline with no phase dropped or duplicated. This
// is a pure naming/partitioning layer — it introduces no timeline. See the
// contract §1.1 / §6 for why the day stays a sequence of discrete segments
// rather than a continuous clock.

import { SIMULATION_PHASES, type SimulationPhase } from './phases'

export type DaySegment = 'A' | 'B' | 'C'

export const DAY_SEGMENTS: readonly DaySegment[] = ['A', 'B', 'C'] as const

// The first phase of each segment — the seam each segment opens on. Every
// phase from a segment's first phase up to (but not including) the next
// segment's first phase belongs to that segment.
const SEGMENT_FIRST_PHASE: Record<DaySegment, SimulationPhase> = {
  A: 'startDay',
  B: 'beforeOwnerActions',
  C: 'applyResponses',
}

function buildSegmentPhases(): Record<DaySegment, SimulationPhase[]> {
  const out: Record<DaySegment, SimulationPhase[]> = { A: [], B: [], C: [] }
  let current: DaySegment = 'A'
  for (const phase of SIMULATION_PHASES) {
    if (phase === SEGMENT_FIRST_PHASE.B) current = 'B'
    else if (phase === SEGMENT_FIRST_PHASE.C) current = 'C'
    out[current].push(phase)
  }
  return out
}

const SEGMENT_PHASES: Record<DaySegment, ReadonlyArray<SimulationPhase>> =
  buildSegmentPhases()

/** The ordered phases that run inside `segment`. */
export function phasesForSegment(
  segment: DaySegment,
): ReadonlyArray<SimulationPhase> {
  return SEGMENT_PHASES[segment]
}

/** Which segment a given phase runs in. */
export function segmentForPhase(phase: SimulationPhase): DaySegment {
  for (const segment of DAY_SEGMENTS) {
    if (SEGMENT_PHASES[segment].includes(phase)) return segment
  }
  // Unreachable: every canonical phase is partitioned above.
  throw new Error(`segmentForPhase: phase '${phase}' is not in any segment`)
}

/**
 * Per-segment RNG sub-seed (contract §1.3 / Cluster 2 scope).
 *
 * Because the engine runtime is rebuilt fresh per segment and only
 * `TavernState` crosses a pause (§1.2), each segment derives its RNG from a
 * segment-scoped seed so resuming a segment is deterministic with *zero*
 * RNG serialization. Distinct sub-seeds also keep the segments isolated:
 * the `service` stream is consumed in all three segments (forecast in A,
 * turnout in B, decay/spoilage in C), so a shared seed would replay the
 * same rolls across segments.
 *
 * Segment A keeps the per-day seed unchanged. A is the first segment, so
 * its streams can never replay a prior segment, and leaving its seed
 * untouched preserves the determinism of the identity/name generation that
 * runs in A (`regular_identity`, etc.). B and C take a `:seg-{B,C}` suffix.
 * This is a deliberate, documented refinement of the contract's literal
 * `:seg-{A,B,C}` notation — see
 * `phase-186-day-clock-implementation-notes.md`.
 */
export function segmentSeed(baseSeed: string, segment: DaySegment): string {
  return segment === 'A' ? baseSeed : `${baseSeed}:seg-${segment}`
}
