// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Sim-backed establishing line for the maintenance compositional
// template. Replaces the legacy `maintenanceWarning` template which
// composed the body from raw `ti.sensoryDetails[0]` + `ti.pressureContext[0]`
// + `ti.stakesReadable[0]` through the legacy `composeBody`. The seed
// carries no `primaryActor` — the area is referenced via `seed.location`
// — so the line is narrator-voiced and gates on state-lookup primitives
// only (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - signalEquals `area.damage` (low/mid/high) — Phase 11 loopback
//   - signalEquals `area.condition` (low/mid/high)
//   - pressureRising `maintenance`
//   - memoryPresent on prior owner choices (warning / ignored / area-tagged)
//   - repeatCount `maintenance` ≥ 3
//   - severityAtLeast 70
//
// Design record at `specs/cards/maintenance.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A morning walk-through turns up wear that wants a decision.',
      conditions: [],
    },

    {
      id: 'est_damage_high',
      text: 'The damage has crept past anything a wipe-down can hide.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_condition_low',
      text: 'The room is holding together poorly, and it shows.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Maintenance has been climbing on the board for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },

    {
      id: 'est_warning_memory',
      text: 'The same warning has come round again from the last pass.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_ignored_memory',
      text: 'The neglect from last time is sitting plainly in the boards.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_patch_memory',
      text: 'A recent patch is already softening at its edges.',
      conditions: [
        { kind: 'memoryPresent', tag: 'patch' },
      ],
    },

    {
      id: 'est_repeat_maintenance',
      text: 'Third morning running, this same wear writes itself onto the list.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'maintenance', atLeast: 3 },
      ],
    },

    {
      id: 'est_damage_high_rising',
      text: 'The damage is well past the line, and the pressure keeps climbing.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'est_high_severity_repeat',
      text: 'A near-break that the room has put to you twice before.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'maintenance', atLeast: 3 },
      ],
    },
  ],
}
