// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Sim-backed establishing line for the food_safety compositional
// template. Replaces the legacy `foodSafetyCrisis` body, which lifted
// raw `ti.sensoryDetails[0]` + `ti.recentContext[0]` + `ti.stakesReadable[0]`
// through `composeBody`. Third-person narration of the kitchen-state
// situation — no first-person address (the reaction_line carries the
// cook's voice).
//
// State surfaces leaned on:
//   - signalEquals `area.cleanliness` (low/mid/high) on the kitchen
//   - signalEquals `area.damage` (low/mid/high) on the kitchen
//   - signalEquals `staff.stress` / `staff.fatigue` on the cook
//   - pressureRising `food_safety`
//   - memoryPresent on prior owner choices (warning / discarded /
//     cleaned / served-questionable)
//   - repeatCount `food_safety` ≥ 3
//   - severityAtLeast 70 and 85 (Phase-12 severity ceiling)

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: "The morning's kitchen check has turned up something that needs deciding.",
      conditions: [],
    },

    {
      id: 'est_cleanliness_low',
      text: 'The kitchen is filthier than a wipe-down can paper over.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_damage_high',
      text: 'The prep counters have crept past anything a scrub will fix.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },

    {
      id: 'est_cook_stress_high',
      text: "The kitchen is fraying around its lead hand this morning.",
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_cook_fatigue_high',
      text: 'The lead hand is worn thin, and the kitchen is showing it.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Food safety has been climbing onto the board for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'food_safety' },
      ],
    },

    {
      id: 'est_warning_memory',
      text: 'The warning from the last walk-through has finally come due.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },

    {
      id: 'est_repeat_food_safety',
      text: 'Third morning running, the same risk writes itself onto the list.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'food_safety', atLeast: 3 },
      ],
    },

    {
      id: 'est_inspection_relevant',
      text: 'An inspector would mark this on a first walk through the kitchen.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_relevant' },
        { kind: 'pressureRising', pressureId: 'food_safety' },
      ],
    },

    {
      id: 'est_severity_ceiling',
      text: 'It has crossed the line where service from this kitchen must stop.',
      conditions: [
        { kind: 'severityAtLeast', value: 85 },
        { kind: 'pressureRising', pressureId: 'food_safety' },
      ],
    },

    {
      id: 'est_cleanliness_pressure',
      text: 'The kitchen is filthy and the pressure keeps climbing on it.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'food_safety' },
      ],
    },
    {
      id: 'est_severity_repeat',
      text: 'A crisis the kitchen has put to you twice before, sharper today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'food_safety', atLeast: 3 },
      ],
    },
  ],
}
