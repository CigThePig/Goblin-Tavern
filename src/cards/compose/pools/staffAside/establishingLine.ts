// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Sim-backed establishing line for the staff_aside compositional template.
// First non-fallback voice-bearing pool for staff to assert sim truth:
// stress band, fatigue band, rising loyalty-risk or burnout pressure,
// prior identity-warning memory, repeat-visit pattern. Replaces the
// previous body grounding step that lifted a raw fragment from
// `seed.textIngredients.sensoryDetails[0]` — the "dangling fragment"
// the Voiced Surface arc identified as the symptom this phase kills.
//
// Every non-fallback snippet carries >=1 state-lookup condition
// (signalEquals, pressureRising, memoryPresent, repeatCount,
// hasNamedEntity) per the sim-coherence gate. The unconditional
// fallback claims only what the seed firing guarantees: a staff
// member surfacing themselves before the day opens.
//
// Design record at `specs/cards/staff_aside.spec.yaml` (Phase 7 entry).

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    // — base: unconditional fallback —
    {
      id: 'est_fallback',
      text: 'A staff member surfaces before the day fully opens.',
      conditions: [],
    },

    // — middle rung: single state-lookup condition (COMMON) —
    {
      id: 'est_high_stress',
      text: "Their shoulders are pulled tight before the door's even propped.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
      ],
    },
    {
      id: 'est_low_stress',
      text: 'They walk through quiet, the morning sitting easy on them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
      ],
    },
    {
      id: 'est_high_fatigue',
      text: 'They came in slow today; the long week is plain to see.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'est_loyalty_risk_rising',
      text: "Something's been pulling them away from the work these days.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'est_burnout_rising',
      text: "Tomorrow's load is already crowding into this morning.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'est_identity_memory',
      text: "Last week's slight still sits in the room between you.",
      conditions: [
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'est_warning_memory',
      text: "They've been on warning before; the rota remembers.",
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_repeat_visit',
      text: 'Third quiet morning in a row from this one.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },

    // — top rung: two state-lookup conditions (RARE, sharper) —
    {
      id: 'est_stress_loyalty',
      text: 'Wound tight, and pulling back from the room besides.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'est_fatigue_warning',
      text: 'Slow steps, and they were on warning last week already.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
  ],
}
