// Phase 18 — Feedback loop module barrel.

export {
  FEEDBACK_MODULE_ID,
  feedbackModule,
  createInitialFeedbackModuleState,
  getFeedbackModuleState,
  ensureRequiredFeedbackLoopsRegistered,
  feedbackLoopRegistry,
} from './feedbackLoopModule'

export type { FeedbackModuleState } from './feedbackLoopModule'
export type { FeedbackLoopDefinition } from './feedbackLoopRegistry'
export {
  REQUIRED_FEEDBACK_LOOPS,
  EXPANDED_FEEDBACK_LOOPS,
} from './feedbackLoopRegistry'

export type {
  FeedbackEvidence,
  FeedbackLoopDetectorResult,
  FeedbackLoopSnapshot,
  FeedbackLoopSpeed,
} from './feedbackLoopTypes'

export {
  buildFeedbackLoopReport,
  FEEDBACK_REPORT_ID,
  FEEDBACK_REPORT_SOURCE,
} from './feedbackReport'
