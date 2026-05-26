// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Sim-backed establishing line for the violence compositional
// template. First dedicated card for the `violence.customer_incident`
// seed family — pre-Phase 12 these seeds routed to `fallbackCard`.
// Third-person narration of the floor situation; no first-person
// address (the reaction_line carries the group's voice).
//
// State surfaces leaned on:
//   - signalEquals `customer_group.rowdiness` (low/mid/high) — Phase-12
//     loopback band, drives the violence picker
//   - signalEquals `customer_group.satisfaction` (low/mid/high)
//   - signalEquals `area.damage` (low/mid/high) on the affected area
//   - pressureRising `violence`
//   - memoryPresent on prior owner choices (warning, brawl, security
//     hired, banned group)
//   - repeatCount `violence` ≥ 3
//   - severityAtLeast 70

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'Tension on the floor has slipped its ordinary leash tonight.',
      conditions: [],
    },

    {
      id: 'est_rowdiness_high',
      text: 'The rowdiest table has slipped past anything a glance can settle.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_satisfaction_low',
      text: 'They came in unhappy and the drink has not improved it.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'est_area_damage_high',
      text: 'The room is already showing the marks of the night.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Violence pressure has been climbing onto the floor for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'violence' },
      ],
    },

    {
      id: 'est_warning_memory',
      text: 'The warning from the last incident still hangs over the bench.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_brawl_memory',
      text: 'A brawl from a prior visit is still riding their breath.',
      conditions: [
        { kind: 'memoryPresent', tag: 'brawl' },
      ],
    },
    {
      id: 'est_security_memory',
      text: 'A hired set of shoulders watches them from across the room.',
      conditions: [
        { kind: 'memoryPresent', tag: 'security' },
      ],
    },

    {
      id: 'est_repeat_violence',
      text: 'Third visit running, the same group brings the same tension back.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'violence', atLeast: 3 },
      ],
    },

    {
      id: 'est_rowdiness_pressure',
      text: 'The rowdiest table is up and the pressure keeps climbing on it.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'violence' },
      ],
    },
    {
      id: 'est_severity_repeat',
      text: 'A flashpoint the group has put to you before, sharper today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'violence', atLeast: 3 },
      ],
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Cross-role 3-meter cube: the fixed extreme reads on
    // `'primaryActor'` (customer_group.rowdiness=high — the strictly
    // dominant picker-driver, scored as `patronage + rowdiness`); one
    // spec-3 cube axis reads on `'primaryActor'` (satisfaction); the
    // other reads on `'location'` (area.damage). All four corners
    // carry 3 state-lookup primitives, so `simCoherence` is
    // well-covered.
    //
    // The mid×mid cells (and mid-third-meter slots on the cube faces)
    // stay unauthored; the unconditional fallback handles them.
    {
      id: 'est_high_row_high_sat_high_dmg',
      text: 'At the loudest pitch of welcome, and the benches are paying for it.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_row_high_sat_low_dmg',
      text: 'In fine spirits and rowdier than the room can quite carry.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_high_row_low_sat_high_dmg',
      text: 'They came in wronged, and now the door-frame splinters are theirs.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_row_low_sat_low_dmg',
      text: 'A group spoiling for a fight that has not started yet.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'low' },
      ],
    },

    // 4 spec-2 supports for off-extreme cells.
    {
      id: 'est_high_row_high_sat',
      text: 'Loud, happy, and louder than this room is built for.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'est_high_row_low_sat',
      text: 'A rowdy table that came in sour and has not warmed.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'est_high_row_high_dmg',
      text: 'A rowdy table and a room already wearing the marks of it.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.rowdiness', role: 'primaryActor', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_sat_high_dmg',
      text: 'A sour group in a room whose furniture is already splintered.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },

    // 3 pressure / memory / hasTag top rungs (spec-2 orthogonal pairs).
    // The new top rung `customer_group.rowdiness=high + pressureRising
    // violence` overlaps with the existing `est_rowdiness_pressure`
    // (same conditions); FNV tie-break picks one deterministically.
    // Kept for distinctive narrative imagery.
    {
      id: 'est_low_sat_brawl_memory',
      text: 'A sour table on a hall that has already seen worse.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.satisfaction', role: 'primaryActor', equals: 'low' },
        { kind: 'memoryPresent', tag: 'brawl' },
      ],
    },
    {
      id: 'est_high_dmg_security_memory',
      text: 'Visible damage on a hall with hired hands already on the books.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'memoryPresent', tag: 'security' },
      ],
    },
    {
      id: 'est_low_loyalty_ban_memory',
      text: 'A loose-tied crowd in the wake of a banning we have made.',
      conditions: [
        { kind: 'signalEquals', signal: 'customer_group.loyalty', role: 'primaryActor', equals: 'low' },
        { kind: 'memoryPresent', tag: 'ban' },
      ],
    },
  ],
}
