// Phase 95 — Card voice public surface.
//
// Card templates, the daily-report projection, and the day-screen
// empty-state slots import from here. Pure, deterministic helpers
// only — no state-mutation, no globals.

export {
  composeTitle,
  composeBody,
  composeEmpty,
  pickFromPool,
  type ComposeOpts,
} from './composer'
export { TONE_POOLS, EMPTY_STATE_POOLS, type TonePool } from './tonePools'
