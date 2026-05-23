// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Flavor reaction line for the seasonal_arc compositional template.
// Narrator-voiced — populace-/world-event register matching
// cultureConflict's civic_floor framing. No first-person address, no
// character voice (local_events have no castAttributes). Gated on
// `hasTag` (theme + `arc` / `calendar` / `anticipation`),
// `severityAtLeast`, and prior arc memories.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The town has begun to lean toward this on its own.',
      conditions: [],
    },

    {
      id: 'rxn_anticipation',
      text: 'It has not arrived, but the air is bending toward it.',
      conditions: [
        { kind: 'hasTag', tag: 'anticipation' },
      ],
    },
    {
      id: 'rxn_high_severity',
      text: 'The room will be reshaped before the day is through.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    {
      id: 'rxn_blight',
      text: 'Cooks and bartenders will be measuring losses by mid-shift.',
      conditions: [
        { kind: 'hasTag', tag: 'mushroom_blight' },
      ],
    },
    {
      id: 'rxn_payday',
      text: 'Take pours will run high and tempers run shorter together.',
      conditions: [
        { kind: 'hasTag', tag: 'miner_payday_boom' },
      ],
    },
    {
      id: 'rxn_inspection',
      text: 'Every back room will be wiped down twice before noon.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_campaign' },
      ],
    },
    {
      id: 'rxn_rival',
      text: 'Patronage will need a reason to choose this room.',
      conditions: [
        { kind: 'hasTag', tag: 'rival_tavern_expansion' },
      ],
    },
    {
      id: 'rxn_festival',
      text: 'The shape of the day will need decisions before the bell.',
      conditions: [
        { kind: 'hasTag', tag: 'festival_approaching' },
      ],
    },

    {
      id: 'rxn_arc_memory',
      text: 'The earlier arc choice already set part of the path today.',
      conditions: [
        { kind: 'memoryPresent', tag: 'arc' },
      ],
    },
  ],
}
