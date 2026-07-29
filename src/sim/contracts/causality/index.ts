// Expansion Phase 1 §1.4 — public surface of the causality contract.
// Re-exports only; see `../ruleset/index.ts` for why.

export {
  MAX_NAMED_GROUP_MEMBERS,
  groupedTarget,
  groupedTargetCovers,
  groupedTargetMembers,
  isGroupedTarget,
  targetKind,
} from './groupedTargets'

export {
  EVENT_LINK_TAG_PREFIX,
  addGroupedCause,
  addLifecycleCause,
  causesForScheduledEvent,
  eventLinkTag,
  scheduledEventIdForCause,
  type GroupedCauseInput,
  type LifecycleChange,
  type LifecycleKind,
} from './groupedCause'

export {
  AUDITED_CAUSE_CLASSES,
  auditCausalCoverage,
  auditedChanges,
  auditedClassForPath,
  type AuditedCauseClass,
  type CausalAuditResult,
  type CausalGap,
} from './audit'
