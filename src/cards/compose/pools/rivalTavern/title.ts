// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Title pool for the rival_tavern compositional template. Template
// glue prepends the rival arc's `label` when one is active (kind
// `'local_event'`), else the literal `'Rival tavern'`, as
// `${prefix}: ${snippet}`. Arc labels can run 2–4 words; snippet
// text stays ≤ 2 words so a 4-word arc label keeps the final composed
// title within the legacy 6-word total budget.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'pulling crowds',
      conditions: [],
    },
    {
      id: 'title_arc',
      text: 'making noise',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
      ],
    },
    {
      id: 'title_system',
      text: 'unnamed competitor',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
      ],
    },
    {
      id: 'title_pressure',
      text: 'gaining ground',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'biting hard',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
