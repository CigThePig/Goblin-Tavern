// Expansion Phase 1 §1.1 — public surface of the scheduled-event contract.
// Re-exports only; see `../ruleset/index.ts` for why.

export {
  EXACT_ONCE_RETENTION_DAYS,
  MAX_ARCHIVED_OUTCOMES,
  MAX_EXACT_ONCE_KEYS,
  MAX_QUEUED_EVENTS,
  SCHEDULED_EVENTS_MODULE_ID,
  ScheduledEventOutcomeRecordSchema,
  ScheduledEventRecordSchema,
  ScheduledEventsModuleStateSchema,
  type MissingTargetBehavior,
  type ScheduledEventBeat,
  type ScheduledEventDefinition,
  type ScheduledEventKind,
  type ScheduledEventMutation,
  type ScheduledEventOutcomeRecord,
  type ScheduledEventRecord,
  type ScheduledEventResolution,
  type ScheduledEventResolver,
  type ScheduledEventStatus,
  type ScheduledEventsModuleState,
} from './types'

export {
  allScheduledEventDefinitions,
  clearScheduledEventRegistry,
  getScheduledEventDefinition,
  hasScheduledEventDefinition,
  registerScheduledEvent,
  unregisterScheduledEvent,
} from './registry'

export {
  acknowledgeScheduledEvent,
  cancelScheduledEvents,
  createInitialScheduledEventsModuleState,
  defaultExactOnceKey,
  getLiveScheduledEvents,
  getWarnedScheduledEvents,
  isExactOnceKeyHonoured,
  pruneSpentKeys,
  readScheduledEventsSlice,
  scheduleEvent,
  writeScheduledEventsSlice,
  type ScheduleEventRequest,
  type ScheduleEventResult,
} from './state'

export {
  NARRATIVE_EXPECTATION_REASON,
  resolveScheduledEventsForBeat,
  scheduledEventTargetExists,
  type BeatResolutionSummary,
} from './resolve'

export {
  PROMISSORY_WORDING,
  auditNarrativeExpectationWording,
  findPromissoryWording,
  scheduledEventOwnership,
  validateScheduledEventRegistry,
  validateScheduledEventState,
  type NarrativePromiseAuditRow,
  type ScheduledEventContractProblem,
} from './validation'

export { scheduledEventsModule } from './scheduledEventsModule'
