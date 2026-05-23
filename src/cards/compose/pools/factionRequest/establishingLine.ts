// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Sim-backed establishing line for the faction_request compositional
// template. States the faction situation in third-person narration:
// relationship band, influence band, rising faction_anger /
// cultural_tension, returning faction (memoryPresent), prior-choice
// memory (grudge, gratitude, refusal), and a two-condition band+repeat
// top rung.
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees
// (a faction has come to call).

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A delegation has come to the tavern with business.',
      conditions: [],
    },

    {
      id: 'est_low_relationship',
      text: 'There is old cold between this house and theirs.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.relationship', equals: 'low' },
      ],
    },
    {
      id: 'est_high_relationship',
      text: 'Their people walk this room like welcome guests.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.relationship', equals: 'high' },
      ],
    },
    {
      id: 'est_low_influence',
      text: 'Their reach is thinner than they would like to admit.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.influence', equals: 'low' },
      ],
    },
    {
      id: 'est_high_influence',
      text: 'Their word carries weight across half the quarter.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.influence', equals: 'high' },
      ],
    },

    {
      id: 'est_anger_rising',
      text: 'Their anger has been building toward the tavern all month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'faction_anger' },
      ],
    },
    {
      id: 'est_cultural_rising',
      text: 'Cultural tension has been thickening around their visits.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },

    {
      id: 'est_grudge_memory',
      text: 'A grudge from a prior dealing still hangs in the air.',
      conditions: [
        { kind: 'memoryPresent', tag: 'grudge' },
      ],
    },
    {
      id: 'est_gratitude_memory',
      text: 'They have not forgotten the favour from before.',
      conditions: [
        { kind: 'memoryPresent', tag: 'gratitude' },
      ],
    },
    {
      id: 'est_refusal_memory',
      text: 'The last refusal still sits between you, unspoken.',
      conditions: [
        { kind: 'memoryPresent', tag: 'refusal' },
      ],
    },

    {
      id: 'est_returning_faction',
      text: 'They have stood at this counter before; the slate remembers.',
      conditions: [
        { kind: 'memoryPresent', tag: 'faction' },
      ],
    },

    {
      id: 'est_low_repeat',
      text: 'Cold runs deep here; the same faction keeps returning.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'faction.relationship', equals: 'low' },
        { kind: 'repeatCount', subjectTag: 'faction', atLeast: 3 },
      ],
    },
    {
      id: 'est_anger_repeat',
      text: 'Their anger keeps coming back to this door, harder each time.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'faction_anger' },
        { kind: 'repeatCount', subjectTag: 'faction', atLeast: 3 },
      ],
    },
  ],
}
