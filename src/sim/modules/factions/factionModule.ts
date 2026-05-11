import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

// Phase 27 §27.4 — Faction module skeleton.
//
// Owns the `factionUpdate` phase hook. Phase 30 §30.9 will land the
// faction relationship drift logic; Phase 38 expands the pressure
// webs that feed it. Phase 27's responsibility is the wiring.

const SOURCE = 'factions'

export const FACTIONS_MODULE_ID = SOURCE

const FactionModuleStateSchema = z.object({}).passthrough().optional()

const factionUpdateHook = (_ctx: SimContext): void => {
  // Phase 27 leaves this empty on purpose.
}

export const factionModule: SimulationModule = {
  id: FACTIONS_MODULE_ID,
  version: '0.1.0',
  hooks: {
    factionUpdate: [factionUpdateHook],
  },
  stateSchema: FactionModuleStateSchema,
}
