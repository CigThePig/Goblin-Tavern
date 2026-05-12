import { z } from 'zod'

import type { SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildCultureReport } from './cultureReport'

// Phase 27 §27.4 / Phase 30 §30.10 — Culture module.
//
// Phase 27 reserved the seam; Phase 30 attaches the report builder so
// the culture layer is observable per day. The actual culture-aware
// behaviour (forecast influence) lives in
// `modules/cultures/customerInfluence.ts` and is invoked by the
// customer module's forecast helper — keeping the seam light.

const SOURCE = 'cultures'

export const CULTURES_MODULE_ID = SOURCE

const CultureModuleStateSchema = z.object({}).passthrough().optional()

const cultureUpdateHook = (_ctx: SimContext): void => {
  // Phase 30 leaves this empty; the forecast helper consults culture
  // state directly without needing a runtime cache. Future phases can
  // attach tension drift, festival hooks, etc., here.
}

export const cultureModule: SimulationModule = {
  id: CULTURES_MODULE_ID,
  version: '0.2.0',
  hooks: {
    cultureUpdate: [cultureUpdateHook],
  },
  buildReport: buildCultureReport,
  stateSchema: CultureModuleStateSchema,
}
