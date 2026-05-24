// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Day-screen service empty-state line — surfaces in `DayScreen.svelte`
// when `serviceSeeds.length === 0`. Replaces the legacy
// `composeEmpty('service', voiceKey)` call from the retired Phase-95
// tone composer. Narrator-voiced.
//
// Five unconditional snippets lifted verbatim from the legacy
// `EMPTY_STATE_POOLS.service` to preserve voice. One end-of-week
// variant surfaces on the week-closing service beat. Body cap 10
// words.

import type { SnippetPool } from '../../../../cards/compose/types'

export const linePool: SnippetPool = {
  slotId: 'line',
  snippets: [
    {
      id: 'svc_fallback',
      text: 'service runs quietly. nothing to react to.',
      conditions: [],
    },
    {
      id: 'svc_plates_clear',
      text: 'plates clear and mugs refill. no incidents.',
      conditions: [],
    },
    {
      id: 'svc_moves_itself',
      text: 'the floor moves itself. patrons drink, eat, leave.',
      conditions: [],
    },
    {
      id: 'svc_no_fuss',
      text: 'a working service, no fuss.',
      conditions: [],
    },
    {
      id: 'svc_rare_gift',
      text: 'service: routine. the rare gift.',
      conditions: [],
    },
    {
      id: 'svc_end_of_week',
      text: 'the week winds down without a stumble.',
      conditions: [{ kind: 'hasTag', tag: 'end_of_week' }],
    },
  ],
}
