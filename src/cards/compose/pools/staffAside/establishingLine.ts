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
    // Phase 172 / ISSUE-140 — Complete Surface arc, Phase 5 (Staff &
    // Personnel matrix fill). The low-fatigue single rung the Legible-
    // Phase-5 authoring left out: the pool had est_high_fatigue but no
    // est_low_fatigue, so the (stress=mid, fatigue=low) matrix cell had
    // no covering snippet — the band corners need stress low/high and
    // est_low_stress needs stress=low, so a mid-stress/low-fatigue staff
    // member fell to the bare fallback. This single rung closes it.
    {
      id: 'est_low_fatigue',
      text: 'Light on their feet, the run of shifts not yet showing.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'low' },
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

    // ─── Phase 150 / ISSUE-118 — exhaustive stress × fatigue matrix ──
    // The four corner combos of the 9-cell stress × fatigue grid. Each
    // spec-2 combo cell beats the single-condition rungs above when
    // both bands resolve, and beats the multi-fact join when both reads
    // are top-salient. The mid×mid case stays unauthored — the
    // unconditional fallback handles it cleanly (Phase-149 precedent).
    {
      id: 'est_low_stress_low_fatigue',
      text: 'They walk in clear-eyed; the week has not landed on them yet.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'low' },
      ],
    },
    {
      id: 'est_low_stress_high_fatigue',
      text: 'Steady steps, but the long week shows in their shoulders.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'est_high_stress_low_fatigue',
      text: 'Rested, and still pulled tight before the door props open.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'low' },
      ],
    },
    {
      id: 'est_high_stress_high_fatigue',
      text: 'Tight shoulders, slow steps; the long week sits heavy on them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },

    // ─── Pressure × signal/memory top rungs (orthogonal to band×band) ─
    {
      id: 'est_fatigue_burnout',
      text: 'Slow steps, and the load already crowding into the morning.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'est_stress_identity',
      text: 'Wound tight, and last week’s slight still sits between you.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'est_loyalty_risk_warning',
      text: 'Pulling away again, and the warning from before still on file.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
  ],
}
