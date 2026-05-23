// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Sim-backed establishing line for the area_atmosphere compositional
// template. First dedicated card for the family — pre-Phase 11 every
// area_atmosphere seed routed to the legacy `maintenanceWarning`
// template, which was written against `maintenance_problem`'s text
// ingredient shape and mishandled the atmosphere seed's `cleanliness X`
// recentContext readout. The seed has no `primaryActor` — the area is
// referenced via `seed.location` — so the line is narrator-voiced and
// gates on state-lookup primitives only (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - signalEquals `area.cleanliness` (low/mid/high)
//   - signalEquals `area.damage` (low/mid/high) — Phase 11 loopback
//   - pressureRising `maintenance`
//   - memoryPresent on prior atmosphere markers + tags (atmosphere /
//     neglected / repair / cleaning)
//   - repeatCount `atmosphere` ≥ 3
//   - severityAtLeast 70
//
// Design record at `specs/cards/area_atmosphere.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The room is wearing a feeling that the boards alone cannot fix.',
      conditions: [],
    },

    {
      id: 'est_cleanliness_low',
      text: 'The grime has settled in past the surface wipe-down.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_damage_high',
      text: 'The wear is loud enough now to colour the whole space.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'The maintenance side of the board keeps creeping up by morning.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },

    {
      id: 'est_atmosphere_memory',
      text: 'The mood from the last warning has not lifted.',
      conditions: [
        { kind: 'memoryPresent', tag: 'atmosphere' },
      ],
    },
    {
      id: 'est_neglected_memory',
      text: 'The neglect from before is still hanging in the air.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'est_cleaning_memory',
      text: 'A recent scrub did not stick; the room is sliding back.',
      conditions: [
        { kind: 'memoryPresent', tag: 'cleaning' },
      ],
    },

    {
      id: 'est_repeat',
      text: 'Third morning running, the same room is asking the same question.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'atmosphere', atLeast: 3 },
      ],
    },

    {
      id: 'est_cleanliness_pressure',
      text: 'The grime sits deep and the pressure keeps climbing besides.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'est_high_severity_repeat',
      text: 'A sour room the slate has flagged more than once.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'atmosphere', atLeast: 3 },
      ],
    },
  ],
}
