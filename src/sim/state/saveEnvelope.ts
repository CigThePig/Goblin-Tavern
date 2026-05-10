import type { TavernState } from './TavernState'

// Phase 6 §6.6 — Save envelope placeholder.
//
// Scope note: full save/load (file I/O, real migration steps) is deferred
// until post-Phase 20. This file only fixes the shape so module-state
// validation (§6.1.1) and module version pinning have a stable home.

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
