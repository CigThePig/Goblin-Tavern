import type { TavernState } from '../state/TavernState'
import { cloneTavernState } from '../state/defaults'
import {
  type PhaseBoundary,
  type StateDiff,
  type TaggedStateDiff,
  createStateDiff,
  tagDiff,
} from './diff'

// Phase 17 §17.1 / §17.8 — Change tracker.
//
// Snapshots TavernState at the full-day boundary and computes the
// diff after the calendar tick. The engine owns one instance per
// `simulateDay` call so module hooks can ask "what changed during
// today?" without re-walking the state tree themselves.
//
// Phase 76 / ISSUE-036 retired the per-phase boundaries (start of owner
// actions, start of service, start of week, start of month): nothing
// consumed them in production, and finalising the `service` boundary
// five slots before `generateReports` meant any new consumer would have
// read stale state. Today only `'day'` is captured and finalised; the
// boundary union is preserved for forward extensibility.
//
// Phase 91 / ISSUE-051 refreshed this comment after re-establishing the
// `generateReports` → `collectReports` ordering in the engine.
//
// Snapshots use `cloneTavernState` (structuredClone) so the captured
// `before` snapshot is never mutated by later phases of the same day.

export class ChangeTracker {
  private snapshots = new Map<PhaseBoundary, TavernState>()
  private diffs: TaggedStateDiff[] = []

  snapshot(boundary: PhaseBoundary, state: TavernState): void {
    this.snapshots.set(boundary, cloneTavernState(state))
  }

  hasSnapshot(boundary: PhaseBoundary): boolean {
    return this.snapshots.has(boundary)
  }

  diffAgainst(boundary: PhaseBoundary, state: TavernState): StateDiff | undefined {
    const before = this.snapshots.get(boundary)
    if (!before) return undefined
    const diff = createStateDiff(before, state)
    return diff
  }

  /**
   * Diff the current state against the matching boundary snapshot and
   * record the result so the engine can publish it via `SimResult.diffs`.
   * The tagged diff is also returned for module-side use.
   */
  finalize(
    boundary: PhaseBoundary,
    state: TavernState,
  ): TaggedStateDiff | undefined {
    const diff = this.diffAgainst(boundary, state)
    if (!diff) return undefined
    const tagged = tagDiff(diff, boundary)
    this.diffs.push(tagged)
    return tagged
  }

  all(): ReadonlyArray<TaggedStateDiff> {
    return this.diffs
  }

  getByBoundary(boundary: PhaseBoundary): TaggedStateDiff | undefined {
    for (let i = this.diffs.length - 1; i >= 0; i -= 1) {
      const entry = this.diffs[i]!
      if (entry.boundary === boundary) return entry
    }
    return undefined
  }
}
