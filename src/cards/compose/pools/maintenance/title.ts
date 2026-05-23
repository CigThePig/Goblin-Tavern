// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Title pool for the maintenance compositional template. Template glue
// prepends the area's label as `${area.label}: ${snippet}`. Area labels
// from `src/sim/registries/areaRegistry.ts` are 1–2 words ("Main Room",
// "Kitchen", "Cellar", "Roof", "Herb Garden", "Cold Cellar"), so snippet
// text stays ≤ 4 words to keep the final composed title within the
// legacy 6-word total budget that `assertTitleBudget` enforces. The
// voice-bounds gate caps individual snippets at the slot wordBudget of 6
// and forbids trailing "…" / immediate duplicate tokens in title-role
// slots.

import type { SnippetPool } from '../../types'

export const titlePool: SnippetPool = {
  slotId: 'title',
  snippets: [
    {
      id: 'title_fallback',
      text: 'damage worth watching',
      conditions: [],
    },
    {
      id: 'title_damage_rising',
      text: 'planks giving way',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'title_high_severity',
      text: 'something near to breaking',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'title_warning_memory',
      text: 'the old warning again',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'title_ignored_memory',
      text: 'still untended',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
  ],
}
