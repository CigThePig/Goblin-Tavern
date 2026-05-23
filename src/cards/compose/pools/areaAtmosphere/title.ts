// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Title pool for the area_atmosphere compositional template. Template
// glue prepends the area's label as `${area.label}: ${snippet}`. Area
// labels from `src/sim/registries/areaRegistry.ts` are 1–2 words, so
// snippet text stays ≤ 4 words to keep the final composed title within
// the legacy 6-word total budget. The voice-bounds gate caps individual
// snippets at the slot wordBudget of 6 and forbids trailing "…" /
// immediate duplicate tokens in title-role slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'the room feels off',
      conditions: [],
    },
    {
      id: 'title_cleanliness_low',
      text: 'a tired-looking corner',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'title_pressure_rising',
      text: 'the atmosphere is slipping',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'a sour room',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'title_atmosphere_memory',
      text: 'still drifting',
      conditions: [
        { kind: 'memoryPresent', tag: 'atmosphere' },
      ],
    },
  ],
}
