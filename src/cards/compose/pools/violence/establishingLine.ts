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
  ],
}
