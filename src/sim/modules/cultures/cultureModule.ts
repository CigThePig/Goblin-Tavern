import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'

import { buildCultureReport } from './cultureReport'
import {
  CULTURES_MODULE_ID,
  CultureModuleStateSchema,
  pruneCultureRecords,
  writeCultureSlice,
} from './cultureState'
import { observeServiceEvidence } from './serviceEvidence'
import { resolveObservances } from './observance'
import { reviewMisunderstandings, summariseCultures } from './standing'
import { applyPreferenceShifts, applyRecommendations } from './autonomy'
import './cultureEvents'

// Phase 27 §27.4 / Phase 30 §30.10 — Culture module.
//
// Expansion Phase 8 §8.2 replaces what this module DID. Phase 50 wired
// three memory producers off proxies — disliked stock sitting in the cellar,
// two groups' patronage meters, a calendar tag being present — none of
// which required anybody to have eaten, sat, or been slighted. §8.2 names
// the first two specifically: taboo and delight must come from what was
// actually served, and seating tension from actual placement and crowding.
//
// The day now runs in two halves.
//
// `closing`, once the evening is complete and `flow` can be read:
//   1. `observeServiceEvidence` — what each culture was actually served,
//      where it actually sat, who it actually sat beside, and how its night
//      ended. This is the §8.2 fix.
//   2. `resolveObservances` — whether the house kept an occasion that
//      mattered to somebody, judged on what it actually did.
//   3. `reviewMisunderstandings` — a bad enough slight opens one, with a
//      named remedy; a stale one fades.
//   4. pruning — §5.11 for five persistent collections.
//
// `cultureUpdate`, before the day's traffic is forecast:
//   5. `summariseCultures` — comfort, familiarity, trust and tension are
//      re-derived from that evidence, each on its own terms.
//   6. `applyPreferenceShifts` / `applyRecommendations` — §8.2's autonomous
//      effects, which are population behaviours rather than actor moves.
//
// The split matters: evidence is gathered when the evening is known, and
// acted on the next morning before turnout is projected, so a culture that
// was badly treated last night is already less inclined to come tonight.

export { CULTURES_MODULE_ID }

const cultureUpdateHook: SimulationHook = (ctx: SimContext): void => {
  // Today's evidence is a per-day list. Cleared here rather than at
  // `closing` so the report — which runs after `endDay` — still sees what
  // the cultures noticed today.
  writeCultureSlice(ctx, (current) => ({ ...current, evidenceToday: [] }), 'new_day')

  summariseCultures(ctx)
  applyPreferenceShifts(ctx)
  applyRecommendations(ctx)
}

const closingHook: SimulationHook = (ctx: SimContext): void => {
  observeServiceEvidence(ctx)
  resolveObservances(ctx)
  reviewMisunderstandings(ctx)

  // Pruning trims evidence lists and subject maps as well as dropping whole
  // records, so there is no cheap "nothing changed" test worth making here —
  // the write is idempotent and `modifyModuleState` handles an equal value.
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(ctx, (current) => pruneCultureRecords(current, today), 'prune')
}

export const cultureModule: SimulationModule = {
  id: CULTURES_MODULE_ID,
  version: '0.4.0',
  hooks: {
    cultureUpdate: [cultureUpdateHook],
    closing: [closingHook],
  },
  buildReport: buildCultureReport,
  stateSchema: CultureModuleStateSchema,
}
