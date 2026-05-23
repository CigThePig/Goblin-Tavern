// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Sim-backed establishing line for the culture_conflict compositional
// template. Narrator-voiced — the culture (primaryActor) is the topic,
// not the speaker; snippet conditions gate on the new culture.* signal
// bands (Phase 136 Movement I loopback), the cultural_tension pressure,
// prior-choice memories, repeat visits, and calendar pins
// (festival/ritual tags through `hasTag`).
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees
// (cultural tension is present in the room).

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A current of cultural tension runs through the tables.',
      conditions: [],
    },

    {
      id: 'est_high_tension',
      text: 'This group has been on edge across the whole evening.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
      ],
    },
    {
      id: 'est_low_comfort',
      text: 'They sit braced, as if the room had not yet welcomed them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'est_high_comfort',
      text: 'They have settled into the back tables like locals.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
      ],
    },
    {
      id: 'est_low_familiarity',
      text: 'Their customs are still alien to this house.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
      ],
    },
    {
      id: 'est_high_familiarity',
      text: 'Their ways are known here; their habits read clear.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'high' },
      ],
    },

    {
      id: 'est_cultural_rising',
      text: 'The tension between cultures has been thickening for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },

    {
      id: 'est_ignored_memory',
      text: 'You looked past their last custom; it has not been forgotten.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_neglected_memory',
      text: 'The last neglect still hangs over how they read this room.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'est_honour_memory',
      text: 'Their custom was honoured before; the goodwill lingers.',
      conditions: [
        { kind: 'memoryPresent', tag: 'honour' },
      ],
    },
    {
      id: 'est_mediation_memory',
      text: 'A prior mediation still keeps the worst of it at bay.',
      conditions: [
        { kind: 'memoryPresent', tag: 'mediation' },
      ],
    },

    {
      id: 'est_festival_rising',
      text: 'A festival of theirs is due; the floor reads it tense.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
        { kind: 'hasTag', tag: 'festival' },
      ],
    },
    {
      id: 'est_ritual_rising',
      text: 'A ritual lands soon, and tension is climbing with it.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
        { kind: 'hasTag', tag: 'ritual' },
      ],
    },

    {
      id: 'est_high_tension_repeat',
      text: 'Their nerves have snapped at this house three nights running.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'repeatCount', subjectTag: 'culture', atLeast: 3 },
      ],
    },
    {
      id: 'est_tension_ignored',
      text: 'The friction has been growing since the night you walked past it.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
  ],
}
