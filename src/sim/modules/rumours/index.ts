export { rumourModule, RUMOURS_MODULE_ID, RUMOUR_MAX_ENTRIES, RUMOUR_STALE_DAYS, RUMOUR_STALE_STRENGTH } from './rumourModule'
export { buildRumourReport } from './rumourReport'
export {
  MAX_CHANNEL_SHARES_PER_WEEK,
  MAX_COUNTER_DEPTH,
  MAX_RUMOUR_AUDIENCES,
  MAX_RUMOUR_HOPS,
  MAX_SPREADS_PER_DAY,
  MAX_SPREAD_HISTORY,
  MAX_SPREAD_PER_RUMOUR_PER_DAY,
  RumourModuleStateSchema,
  audiencesOf,
  believedAgainst,
  beliefOf,
  bumpRumourTotal,
  createInitialRumourModuleState,
  createInitialRumourTotals,
  getRumourModuleState,
  hasHeard,
  listRumours,
  liveRumours,
  normalizeRumourSlice,
  writeRumourSlice,
} from './rumourState'
export { inferOrigin, seedRumourOrigins } from './origins'
export {
  audiencesFor,
  channelIsSpent,
  cultureLabel,
  isDamaging,
  listChannels,
  willingToShare,
} from './channels'
export {
  beliefOnHearing,
  RUMOUR_SILENCE_LIMIT_DAYS,
  canStillTravel,
  propagateRumours,
  resetChannelBudgets,
} from './propagation'
export {
  BELIEF_DAILY_RETENTION,
  RUMOUR_DAILY_RETENTION,
  RUMOUR_SPREADING_RETENTION,
  RUMOUR_FADE_FLOOR,
  applyContradictions,
  correctRumour,
  damagingBeliefFor,
  decayRumours,
  openContradiction,
  reinforceRumours,
} from './belief'
export {
  COUNTER_RUMOUR_RUNAWAY_EVENT,
  RUMOUR_DENIAL_BACKFIRE_EVENT,
  RUMOUR_ESCALATION_EVENT,
  RUMOUR_SCHEDULED_EVENTS,
  RUMOUR_SCHEDULED_EVENT_TYPES,
  ensureRumourScheduledEventsRegistered,
  reviewEscalations,
  scheduleRumourConsequence,
  settleRumour,
} from './rumourEvents'
export type {
  RumourChannel,
} from './channels'
export type {
  RumourModuleState,
  RumourSpreadEntry,
  RumourTotals,
} from './rumourState'
