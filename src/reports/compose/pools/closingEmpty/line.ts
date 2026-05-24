// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Day-screen closing empty-state line — surfaces in `DayScreen.svelte`
// when `closingSeeds.length === 0`. Replaces the legacy
// `composeEmpty('closing', voiceKey)` call from the retired Phase-95
// tone composer. Narrator-voiced.
//
// Five unconditional snippets lifted verbatim from the legacy
// `EMPTY_STATE_POOLS.closing` to preserve voice. Two milestone
// variants (`end_of_week`, `end_of_month`) surface on the week- and
// month-closing days. Body cap 10 words.

import type { SnippetPool } from '../../../../cards/compose/types'

export const linePool: SnippetPool = {
  slotId: 'line',
  snippets: [
    {
      id: 'cls_fallback',
      text: 'nothing left to resolve. close up?',
      conditions: [],
    },
    {
      id: 'cls_lamps_low',
      text: 'lamps low, doors barred. close the day?',
      conditions: [],
    },
    {
      id: 'cls_last_patron',
      text: 'the last patron drained their cup. close?',
      conditions: [],
    },
    {
      id: 'cls_clean_close',
      text: 'a clean close. ready when you are.',
      conditions: [],
    },
    {
      id: 'cls_all_settled',
      text: 'all settled. lock the keg and call it.',
      conditions: [],
    },
    {
      id: 'cls_end_of_week',
      text: 'a quiet end to the week. close it?',
      conditions: [{ kind: 'hasTag', tag: 'end_of_week' }],
    },
    {
      id: 'cls_end_of_month',
      text: 'the month closes without incident. close out?',
      conditions: [{ kind: 'hasTag', tag: 'end_of_month' }],
    },
  ],
}
