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

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Cross-role 3-meter cube: the fixed extreme reads on
    // `'location'` (kitchen cleanliness=low — the strictly dominant
    // picker-driver for the kitchen vector); the spec-3 cube axes
    // read on `'primaryActor'` (cook stress, cook fatigue — the
    // cook's banded surface). All four corners carry 3 state-lookup
    // primitives, so `simCoherence` is well-covered.
    //
    // The mid×mid cells (and mid-third-meter slots on the cube faces)
    // stay unauthored; the unconditional fallback handles them.
    {
      id: 'est_low_clean_high_stress_high_fatigue',
      text: 'The kitchen reeks and its lead hand is past her last good hour.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_high_stress_low_fatigue',
      text: 'A sharp-eyed cook bracing in a kitchen she has not scrubbed in days.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'est_low_clean_low_stress_high_fatigue',
      text: 'A weary cook moves slow through a kitchen well past its turn.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_low_stress_low_fatigue',
      text: 'An unhurried cook in a kitchen that does not match her composure.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'low' },
      ],
    },

    // 4 spec-2 supports for off-extreme cells (cleanliness mid OR
    // single cook-axis at high while the other is mid).
    {
      id: 'est_low_clean_high_stress',
      text: 'A grim kitchen and a cook strung tight before the doors open.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_high_fatigue',
      text: 'A grim kitchen and a cook running on yesterday and a half.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_high_stress_high_fatigue',
      text: 'The cook is wrung out and braced at once, kitchen aside.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_clean_low_inspection_pressure',
      text: 'A grim kitchen on a day the inspector has been gathering momentum.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'inspection' },
      ],
    },

    // 3 pressure / memory / hasTag top rungs (spec-2 orthogonal pairs).
    // The new top rung `area.cleanliness=low + pressureRising
    // food_safety` overlaps semantically with the existing
    // `est_cleanliness_pressure` (same conditions); FNV tie-break
    // picks one deterministically. Kept for distinctive narrative
    // imagery distinct from the existing pool's framing.
    {
      id: 'est_clean_low_kitchen_memory',
      text: 'Today the kitchen is past its turn and a prior word is sitting due.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
        { kind: 'memoryPresent', tag: 'kitchen' },
      ],
    },
    {
      id: 'est_inspection_tag_warning',
      text: 'An inspector-flagged morning, and the warning is already on record.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_relevant' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_deception_repeat',
      text: 'A trick we have served before, and the kitchen is asking for it again.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
        { kind: 'repeatCount', subjectTag: 'food_safety', atLeast: 3 },
      ],
    },
  ],
}
