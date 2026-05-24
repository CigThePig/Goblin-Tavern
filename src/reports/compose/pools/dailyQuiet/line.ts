// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Daily quiet-day line — surfaces when nothing crossed a threshold
// (`isQuiet` in the projection). Replaces the legacy
// `composeEmpty('quiet', voiceKey)` call at
// `src/reports/dailyReportProjection.ts:135`. Narrator-voiced, fallback
// plus calendar-tone variants. Body cap 10 words.

import type { SnippetPool } from '../../../../cards/compose/types'

export const linePool: SnippetPool = {
  slotId: 'line',
  snippets: [
    {
      id: 'qt_fallback',
      text: 'a quiet day. the tavern simply was.',
      conditions: [],
    },
    {
      id: 'qt_pass',
      text: 'little to write down. the day passed.',
      conditions: [],
    },
    {
      id: 'qt_kind_of_day',
      text: 'the kind of day a tavern needs more of.',
      conditions: [],
    },
    {
      id: 'qt_no_fires',
      text: 'no fires, no songs. just the work.',
      conditions: [],
    },
    {
      id: 'qt_end_of_week',
      text: 'a quiet close on a long week.',
      conditions: [{ kind: 'hasTag', tag: 'end_of_week' }],
    },
    {
      id: 'qt_morning_repeat',
      text: 'another easy day; the third in a row.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'quiet_day', atLeast: 3 },
      ],
    },
  ],
}
