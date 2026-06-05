import type { TavernState } from './TavernState'

// Phase 6 §6.6 — legacy SaveEnvelope placeholder.
//
// The web runtime now owns real browser save/load through
// `web/src/lib/sim/persistence.ts`. This sim-side envelope is retained as a
// documented compatibility seam for Phase 6 validation tests and older docs
// that describe module version pinning; it is not the active production save
// format.

export type SaveEnvelope = {
  simVersion: string
  enabledModules: Record<string, string>
  state: TavernState
}

export function migrateSaveEnvelope(envelope: SaveEnvelope): SaveEnvelope {
  // No migrations to apply yet. Future versions of the simulation will fill
  // this in with explicit version-to-version migration steps.
  return envelope
}
