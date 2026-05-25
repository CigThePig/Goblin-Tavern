// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Sim-backed establishing line for the staff_burnout compositional
// template. States what the sim says about this staff member at the
// burnout moment: stress band, fatigue band, rising staff_burnout /
// staff_loyalty_risk pressure, prior bonus / workload / risk / priority
// memory, repeated staff seed appearance. Replaces the legacy
// staffRequest template's hand-built meter line ("morale 30, stress 80")
// — the symptom this migration kills.
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees.
//
// Design record at `specs/cards/staff_burnout.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A staff member stands at the rota, hands quiet.',
      conditions: [],
    },

    {
      id: 'est_high_stress',
      text: "They've been wound tight from the moment they walked in.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
      ],
    },
    {
      id: 'est_low_stress',
      text: 'They moved easy through the open, steady as the kettle.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
      ],
    },
    {
      id: 'est_high_fatigue',
      text: "They're moving slow today; the long week shows.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'est_burnout_rising',
      text: "The load's been creeping into their mornings now.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'est_loyalty_risk_rising',
      text: "Something's been pulling them away these last shifts.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'est_bonus_memory',
      text: 'The last bonus is still in their pocket; they remember.',
      conditions: [
        { kind: 'memoryPresent', tag: 'bonus' },
      ],
    },
    {
      id: 'est_workload_memory',
      text: 'Their hands remember the lighter rota you set.',
      conditions: [
        { kind: 'memoryPresent', tag: 'workload' },
      ],
    },
    {
      id: 'est_risk_memory',
      text: "They've stayed past the warning before; the room knows.",
      conditions: [
        { kind: 'memoryPresent', tag: 'risk' },
      ],
    },
    {
      id: 'est_repeat_visit',
      text: "Same set of the shoulders the rota's been seeing all week.",
      conditions: [
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },

    {
      id: 'est_stress_repeat',
      text: 'Third morning of the same tight shoulders, same set jaw.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },
    {
      id: 'est_fatigue_burnout',
      text: "Slow steps, and the burnout meter's been climbing besides.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },

    // ─── Phase 150 / ISSUE-118 — exhaustive stress × fatigue matrix ──
    // The four corner combos of the 9-cell stress × fatigue grid for
    // the staff_burnout family. Different phrasing than staffAside's
    // matching corners — same character of staff member, but the
    // burnout-request register is owner-facing in a different way (the
    // staff member is asking; staffAside is the staff member surfacing
    // themselves). Mid×mid stays unauthored — fallback handles it.
    {
      id: 'est_low_stress_low_fatigue',
      text: 'They stand at the rota easy, the week still ahead of them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'low' },
      ],
    },
    {
      id: 'est_low_stress_high_fatigue',
      text: 'Calm hands, but the run of long shifts shows on them.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'est_high_stress_low_fatigue',
      text: 'Rested enough, and still wound tight at the rota.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'low' },
      ],
    },
    {
      id: 'est_high_stress_high_fatigue',
      text: 'Tight as a wire, and the long week wearing them through.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },

    // ─── Pressure × memory / repeat top rungs (memory surface) ────────
    // The staff_burnout family reads bonus / workload / risk memories
    // (vs staffAside's identity / warning surface). These top rungs
    // orthogonalise burnout pressure against the memory the player's
    // last choice left in the room.
    {
      id: 'est_fatigue_bonus',
      text: 'Bone-tired, even with the bonus still warm in their pocket.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        { kind: 'memoryPresent', tag: 'bonus' },
      ],
    },
    {
      id: 'est_burnout_workload_memory',
      text: 'The lighter rota you set is already squeezing back tight.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
        { kind: 'memoryPresent', tag: 'workload' },
      ],
    },
    {
      id: 'est_burnout_repeat',
      text: "Third request this week, and the load's still climbing on them.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },
  ],
}
