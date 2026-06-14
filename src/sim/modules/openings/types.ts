// Phase 2 (teleology) — openings module state.
//
// Openings are the world proposing opportunities (the entry path to
// ventures). Most of an opening's life is ephemeral — it is regenerated as
// an `opportunity` issue-seed each day it is active. But the decay/return
// rule needs persistent state: when an active opening is ignored long
// enough it is *parked* with a snapshot of its keying meters and an expiry
// day; later, a return roll compares current meters against that snapshot
// and either re-offers the opening (causally mutated by the delta) or lets
// it die. That windowed accumulator is what this slice stores.

export const OPENINGS_MODULE_ID = 'openings'

export type OpeningStatus = 'active' | 'parked' | 'committed' | 'dead'

export type OpeningRecord = {
  id: string
  /** The venture blueprint this opening would spawn when committed. */
  blueprintId: string
  /** How this opening came to exist. */
  origin: 'bootstrap' | 'return'
  status: OpeningStatus
  createdAtDay: number
  /** Active-window end (inclusive). After this day with no commit, park. */
  expiresAtDay: number
  /** Set when the opening is parked: keying meters at park time. */
  meterSnapshot?: Record<string, number>
  parkedAtDay?: number
  /** Die if no qualifying delta is seen by this day. */
  returnByDay?: number
  /** Sign of the delta that brought a returned opening back. */
  valence?: 'positive' | 'negative'
}

export type OpeningsModuleState = {
  openings: Record<string, OpeningRecord>
  /** Monotonic suffix so generated opening ids stay deterministic. */
  nextSuffix: number
  lastProcessedDay: number
}

export function createInitialOpeningsModuleState(): OpeningsModuleState {
  return { openings: {}, nextSuffix: 0, lastProcessedDay: -1 }
}
