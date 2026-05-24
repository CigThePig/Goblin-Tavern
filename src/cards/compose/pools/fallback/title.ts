// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Title slot for the fallback compositional card. Replaces the legacy
// `composeTitle([pickSeverityAdjective(severity, key), ti.subject ||
// seed.family], opts)` glue that ran through the retired Phase-95
// composer.
//
// The fallback catches whatever family / type isn't claimed by a
// dedicated template in `REQUIRED_CARDS`. By definition it cannot
// author per-family rungs, so this pool is severity-gated and
// authored narrator-voiced — no `voiceAxis` / `verbalTic` conditions
// here (the long-tail seeds it catches frequently have no actor with
// castAttributes). The template glue prepends the seed's subject (or
// the family name when subject is blank) so the title still reads
// `${snippet}: ${subject}` shape that the existing tests expect.
//
// One unconditional fallback plus three severity rungs. Body cap
// 6 words.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'something stirs',
      conditions: [],
    },
    {
      id: 'title_low_severity',
      text: 'a loose thread',
      conditions: [{ kind: 'severityBelow', value: 40 }],
    },
    {
      id: 'title_mid_severity',
      text: 'a matter to weigh',
      conditions: [{ kind: 'severityAtLeast', value: 40 }],
    },
    {
      id: 'title_high_severity',
      text: 'a hard knot rises',
      conditions: [{ kind: 'severityAtLeast', value: 70 }],
    },
  ],
}
