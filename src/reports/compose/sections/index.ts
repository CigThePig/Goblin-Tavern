// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer index. Each section exports a typed input shape, a
// `compose…` function for the projection layer to call, and a
// `ReportSection` shape for the gate adapter to wrap.

export {
  composeDailyHeaderLine,
  dailyHeaderSection,
  dailyHeaderSlots,
  type DailyHeaderInput,
} from './dailyHeader'

export {
  composeDailyQuietLine,
  dailyQuietSection,
  dailyQuietSlots,
  type DailyQuietInput,
} from './dailyQuiet'
