// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Flavor reaction line for the culture_conflict compositional template.
// Narrator-voiced — no first-person address, no character voice. Gates
// on tone tags, severity, and prior-choice memories. Frames the moment
// as the owner reads the room, without putting words in any culture
// member's mouth.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The room asks how the house will hold the moment.',
      conditions: [],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no quiet answer left; a choice has to land.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    {
      id: 'rxn_festival',
      text: 'A festival is coming; goodwill here will spend twice over.',
      conditions: [
        { kind: 'hasTag', tag: 'festival' },
      ],
    },
    {
      id: 'rxn_ritual',
      text: 'A ritual is due, and the room watches what gets offered.',
      conditions: [
        { kind: 'hasTag', tag: 'ritual' },
      ],
    },

    {
      id: 'rxn_ignored_memory',
      text: 'Last time you let it pass; this time the room is watching.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'rxn_neglected_memory',
      text: 'A neglected group reads every silence as a second slight.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'rxn_honour_memory',
      text: 'Past honouring buys you patience here, but only some.',
      conditions: [
        { kind: 'memoryPresent', tag: 'honour' },
      ],
    },
    {
      id: 'rxn_mediation_memory',
      text: 'They remember the last mediation; they will accept another.',
      conditions: [
        { kind: 'memoryPresent', tag: 'mediation' },
      ],
    },
    {
      id: 'rxn_seating_memory',
      text: 'The seating change still echoes when they look around.',
      conditions: [
        { kind: 'memoryPresent', tag: 'seating' },
      ],
    },

    {
      id: 'rxn_cultural_rising',
      text: 'Tension is rising and the wrong word will tip it over.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },

    {
      id: 'rxn_severity_repeat',
      text: 'This is the third night running the same group has bristled.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'culture', atLeast: 3 },
      ],
    },
    {
      id: 'rxn_rising_festival',
      text: 'A festival ahead and tension rising; the timing is sharp.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
        { kind: 'hasTag', tag: 'festival' },
      ],
    },

    // ─── Phase 152 / ISSUE-120 — signal-keyed reaction snippets ─────
    // Narrator-voiced state-keyed reactions on the three culture
    // bands. The existing pool covered memories, severity, pressure,
    // and hasTag, but had no direct signal reads; these fill that
    // coverage gap. Each carries one band condition so spec stays at
    // 1 and they tie-break orthogonally to the existing snippets.
    {
      id: 'rxn_state_tension_high',
      text: 'The noise from their table has stopped being a murmur.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_comfort_low',
      text: 'They sit with shoulders the room has never softened.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_comfort_high',
      text: 'A settled crowd, and yet the corner is turning sharp.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
      ],
    },
    {
      id: 'rxn_state_familiarity_low',
      text: 'Their gestures sit outside what the staff knows how to read.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
      ],
    },
    {
      id: 'rxn_state_familiarity_high',
      text: 'Staff knows them well, and the knowing cuts both ways now.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'high' },
      ],
    },
  ],
}
