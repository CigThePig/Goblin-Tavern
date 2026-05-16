// Phase 16 — History module barrel.

export {
  HISTORY_MAX_ENTRIES,
  HISTORY_MIN_AGE_DAYS,
  HISTORY_MODULE_ID,
  historyModule,
} from './historyModule'
export {
  HISTORY_SUMMARY_MAX_LENGTH,
  getRecentHistory,
  getHistoryByTag,
  getHistoryByCategory,
} from './historyLog'
export type { HistoryEntryDraft } from './types'
