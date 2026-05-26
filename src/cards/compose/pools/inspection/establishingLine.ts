// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Sim-backed establishing line for the inspection compositional
// template. First dedicated card for the `inspection.inspection_threat`
// seed family — pre-Phase 12 these seeds routed to `fallbackCard`.
// Third-person narration of the morning situation; no first-person
// address (the reaction_line carries the inspector's voice).
//
// State surfaces leaned on:
//   - signalEquals `faction.relationship` (low/high) on the inspecting faction
//   - signalEquals `faction.influence` (high) on the inspecting faction
//   - signalEquals `area.cleanliness` (low) on the inspected area (via
//     the Phase-11 `'location'` role)
//   - signalEquals `area.condition` (low) on the inspected area
//   - pressureRising `inspection`
//   - memoryPresent on prior owner choices (warning / bribed / hid /
//     prep / walkthrough)
//   - repeatCount `inspection` ≥ 3
//   - severityAtLeast 70

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The inspector has come to call, and the door knows it.',
      conditions: [],
    },

    {
      id: 'est_low_relationship',
      text: 'There is old cold between this house and theirs.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'est_high_relationship',
      text: 'They walk the room like welcome guests this morning.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_high_influence',
      text: 'Their reach is heavier than they would admit, and you feel it.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
      ],
    },

    {
      id: 'est_area_cleanliness_low',
      text: 'The room they walked into would not stand close reading.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_area_condition_low',
      text: 'The room is holding together poorly under the morning light.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Inspection pressure has been climbing onto the slate for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'inspection' },
      ],
    },

    {
      id: 'est_warning_memory',
      text: 'The warning from the last visit has been waiting to come due.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_bribed_memory',
      text: 'A prior arrangement still sits between you, unspoken in the room.',
      conditions: [
        { kind: 'memoryPresent', tag: 'bribed_inspector' },
      ],
    },
    {
      id: 'est_prep_memory',
      text: 'Yesterday they would have found a tidier room than this one.',
      conditions: [
        { kind: 'memoryPresent', tag: 'inspection_prep_recently' },
      ],
    },

    {
      id: 'est_repeat_inspection',
      text: 'Third call running, the inspector finds reason to walk the room.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'inspection', atLeast: 3 },
      ],
    },

    {
      id: 'est_cleanliness_pressure',
      text: 'The room is far from clean and the pressure keeps climbing on it.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'inspection' },
      ],
    },
    {
      id: 'est_severity_repeat',
      text: 'A visit they have put to you before, sharper today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'inspection', atLeast: 3 },
      ],
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Cross-role 3-meter cube: the fixed extreme reads on
    // `'primaryActor'` (faction.relationship=low — the standing that
    // makes an inspection bite); one spec-3 cube axis reads on
    // `'primaryActor'` (faction.influence); the other reads on
    // `'location'` (area.cleanliness — the venue the inspector
    // walks). All four corners carry 3 state-lookup primitives, so
    // `simCoherence` is well-covered.
    //
    // When primaryActor is a notable_npc (not a faction), the
    // faction-signal reads on `'primaryActor'` don't resolve; spec-1 /
    // spec-2 single-condition snippets handle that path. Pre-existing
    // asymmetry from Phase 138; documented in the template comment.
    //
    // Mid×mid cells stay unauthored; the unconditional fallback
    // handles them.
    {
      id: 'est_low_rel_high_inf_high_clean',
      text: 'A faction with reach and a grudge, in a room that gives no excuses.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_rel_high_inf_low_clean',
      text: 'The kind who closes places, and the room is making the argument.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_low_rel_low_inf_high_clean',
      text: 'Their grievance is real, their backing thin; the floor is clean.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_rel_low_inf_low_clean',
      text: 'A smaller faction with a longer grievance, and a grubby room.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },

    // 4 spec-2 supports for off-extreme cells.
    {
      id: 'est_low_rel_high_inf',
      text: 'A faction with reach and a grudge, here this morning by appointment.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_low_rel_low_clean',
      text: 'Cold relations to start, and the room is not helping the case.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_high_inf_low_clean',
      text: 'A heavy office to face, and a room that will not stand reading.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_low_rel_low_cond',
      text: 'Cold relations, and a room that is holding together by habit alone.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },

    // 3 pressure / memory / hasTag top rungs (spec-2 orthogonal pairs).
    // The new `faction.relationship=low + pressureRising inspection`
    // top rung covers a cell the existing pool misses.
    {
      id: 'est_low_rel_inspection_pressure',
      text: 'Cold relations on a morning the slate has been steepening for days.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'inspection' },
      ],
    },
    {
      id: 'est_low_clean_bribed_memory',
      text: 'A grubby room on a faction whose silence has already been bought.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'memoryPresent', tag: 'bribed_inspector' },
      ],
    },
    {
      id: 'est_inspection_tag_prep_memory',
      text: 'An inspector-flagged morning after a prep we thought would hold longer.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_relevant' },
        { kind: 'memoryPresent', tag: 'inspection_prep_recently' },
      ],
    },
  ],
}
