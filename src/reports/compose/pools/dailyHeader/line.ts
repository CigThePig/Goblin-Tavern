// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Daily header voice line — the small italic strapline above the Daily
// Report header. Replaces the legacy `composeEmpty('header', voiceKey)`
// call at `src/reports/dailyReportProjection.ts:183` which sampled from
// `EMPTY_STATE_POOLS.header` in the Phase-95 tone composer. Narrator-
// voiced, never actor-resolved — there is no primary actor on a
// projection-level header.
//
// Variants gate on calendar tone tags routed through `seed.domain` by
// the projection (`closed`, `end_of_week`, `end_of_month`, `quiet`,
// `heavy_day`). Body cap is 6 words to keep the strapline tight.

import type { SnippetPool } from '../../../../cards/compose/types'

export const linePool: SnippetPool = {
  slotId: 'line',
  snippets: [
    {
      id: 'hdr_fallback',
      text: 'closed and counted.',
      conditions: [],
    },
    {
      id: 'hdr_lamps_out',
      text: 'lamps out, ledger in.',
      conditions: [],
    },
    {
      id: 'hdr_doors_barred',
      text: 'doors barred, books squared.',
      conditions: [],
    },
    {
      id: 'hdr_another_day',
      text: 'another day on the slate.',
      conditions: [],
    },
    {
      id: 'hdr_keg_shutters',
      text: 'the keg shutters for the night.',
      conditions: [],
    },
    {
      id: 'hdr_end_of_week',
      text: 'the week ends; the slate is set.',
      conditions: [{ kind: 'hasTag', tag: 'end_of_week' }],
    },
    {
      id: 'hdr_end_of_month',
      text: 'the month closes; the books rest.',
      conditions: [{ kind: 'hasTag', tag: 'end_of_month' }],
    },
    {
      id: 'hdr_heavy_day',
      text: 'a long day, finally counted out.',
      conditions: [{ kind: 'hasTag', tag: 'heavy_day' }],
    },
  ],
}
