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
  ],
}
