// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Optional third-person sensory beat for the area_atmosphere template —
// dim light, dust haze, a faint sour smell, regulars sliding to the
// far booth. Narrator-voiced; gated on prior-choice memories, severity,
// tone tags, and rising pressure (no actor axes).

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_high_severity',
      text: 'A faint sour note hangs over the bar.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_neglected_memory',
      text: 'Streaks on the wall mark where dust has stayed.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'mnr_cleaning_memory',
      text: 'The recent shine has gone dull at the edges.',
      conditions: [
        { kind: 'memoryPresent', tag: 'cleaning' },
      ],
    },
    {
      id: 'mnr_pressure_rising',
      text: 'The light through the room sits thick today.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'mnr_reputation',
      text: 'A regular sidesteps the corner without noticing they did.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation' },
      ],
    },
    {
      id: 'mnr_repeat',
      text: 'The same sour patch, the same morning, once more.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'atmosphere', atLeast: 3 },
      ],
    },

    // Phase 18 repair: unconditional narrator-voiced beats at explicit
    // specificity 0 so the body fires SOMETHING when no state gate
    // above matches. Never outranks the sharper rungs.
    {
      id: 'mnr_mild_quiet',
      text: 'The corner sits a little quieter than the rest.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_step',
      text: 'A regular slows their step as they pass.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_dust',
      text: 'A scuff line traces the floor by the wall.',
      conditions: [],
      specificity: 0,
    },
    {
      id: 'mnr_mild_air',
      text: 'The air there has its own small weight.',
      conditions: [],
      specificity: 0,
    },
  ],
}
