// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Day-screen morning empty-state line — surfaces in `DayScreen.svelte`
// when `morningSeeds.length === 0`. Replaces the legacy
// `composeEmpty('morning', voiceKey)` call that sampled from
// `EMPTY_STATE_POOLS.morning` in the retired Phase-95 tone composer.
// Narrator-voiced, no actor resolution.
//
// The five unconditional snippets are the Phase-95 pool entries lifted
// verbatim so the user-visible voice is preserved across the
// migration. One end-of-week-tagged variant adds variety on the
// week-closing morning when the projection routes `'end_of_week'` into
// `seed.domain`. Body cap 10 words (the longest legacy entry was
// 9 words).

import type { SnippetPool } from '../../../../cards/compose/types'

export const linePool: SnippetPool = {
  slotId: 'line',
  snippets: [
    {
      id: 'morn_fallback',
      text: 'the tavern is quiet. no urgent matters this morning.',
      conditions: [],
    },
    {
      id: 'morn_slow',
      text: 'a slow morning. nothing pressing yet.',
      conditions: [],
    },
    {
      id: 'morn_first_light',
      text: 'first light, no fires. coffee and a count.',
      conditions: [],
    },
    {
      id: 'morn_calm',
      text: 'the floor is calm. the day waits.',
      conditions: [],
    },
    {
      id: 'morn_belongs_to_you',
      text: 'no one shouting yet. the morning belongs to you.',
      conditions: [],
    },
    {
      id: 'morn_end_of_week',
      text: 'a quiet start to the week-end day.',
      conditions: [{ kind: 'hasTag', tag: 'end_of_week' }],
    },
  ],
}
