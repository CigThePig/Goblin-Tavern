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

    // ─── Phase 152 / ISSUE-120 — tension × comfort × familiarity cube
    // The card is *about* the three-meter culture surface; when more
    // than one band resolves the establishing line should state the
    // salient combination, not whichever single condition out-specifies
    // the others. The seed generator picks by highest tension, so the
    // 4 spec-3 cube corners fix tension=high and span comfort ×
    // familiarity 2×2 (the readable cube face). The 4 spec-2 supports
    // cover the (mid+high tension) × (low+high comfort) edges for the
    // familiarity=mid case. Mid-band combinations fall back to single-
    // condition snippets and ultimately the unconditional fallback.

    // ── Spec-3 cube corners (tension=high × comfort × familiarity) ──
    {
      id: 'est_high_ten_low_comf_low_fam',
      text: 'Strangers in a room that never tried to read them, gone tense.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
      ],
    },
    {
      id: 'est_high_ten_low_comf_high_fam',
      text: 'A crowd you read well, kept in a room that has never been theirs.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'high' },
      ],
    },
    {
      id: 'est_high_ten_high_comf_low_fam',
      text: 'Settled enough to stay, opaque enough for the outburst to land cold.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
      ],
    },
    {
      id: 'est_high_ten_high_comf_high_fam',
      text: 'The crowd that always made the place feel certain, suddenly unfamiliar.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'high' },
      ],
    },

    // ── Spec-2 tension × comfort supports (familiarity-mid catch) ──
    {
      id: 'est_mid_ten_low_comf',
      text: 'A quiet drift toward the door — not angry, just not welcome.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_ten_high_comf',
      text: 'A low rumble in a cheerful corner — out of place, sounding worse.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
      ],
    },
    {
      id: 'est_high_ten_low_comf',
      text: 'Stirred up, and never settled here in the first place.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
      ],
    },
    {
      id: 'est_high_ten_high_comf',
      text: 'At home in this room, and yet stirred to anger inside it.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'high' },
      ],
    },

    // ── Spec-2 signal × pressure / memory top rungs ──
    {
      id: 'est_tension_pressure',
      text: 'On edge in the room, and the wider tension only climbing.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.tension', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },
    {
      id: 'est_comfort_ignored',
      text: 'Braced today, on the back of the silence you gave them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.comfort', equals: 'low' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_familiarity_neglected',
      text: 'The gap in how you know them is showing, and old neglect with it.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'culture.familiarity', equals: 'low' },
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
  ],
}
