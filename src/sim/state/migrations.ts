// Phase 25 §"Migration Guidance" — full save/load migration is still
// deferred until post-Phase 20 work resumes, but pre-Phase-25 saves
// loaded via the save envelope must receive a default `world` branch so
// validation can pass. This helper is intentionally minimal: it returns
// the same object if `world` is already present, or attaches a fresh
// empty world branch from `createInitialWorldState()` otherwise.
//
// Callers wiring this into the save envelope path should run it before
// invoking `validateState()`. Phase 25 keeps the migration step opt-in
// rather than building a full version-keyed migration framework just
// for the world branch — see `phases-22-25` §"Migration Guidance".
import { createInitialWorldState } from './defaults'
import type { TavernState, WorldState } from './TavernState'

export function ensureWorldBranch<T extends Partial<TavernState>>(
  state: T,
): T & { world: WorldState } {
  if (state.world) {
    return state as T & { world: WorldState }
  }
  return { ...state, world: createInitialWorldState() }
}

export {}
