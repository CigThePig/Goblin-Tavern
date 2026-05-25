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

    // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
    //
    // 4 spec-3 cube corners (damage=high × condition × cleanliness 2×2).
    // The picker scores `damage + (60 − condition)`, so damage=high is
    // the dominant lever; cleanliness adds the cube-face third meter.
    // Each combo states all three salient bands in one ≤14-word line;
    // imagery varies per corner so the within-pool dedupe gate has
    // room.
    {
      id: 'est_high_dmg_high_cond_high_clean',
      text: 'A fresh gouge across an otherwise-careful wall stands out at the door.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_dmg_high_cond_low_clean',
      text: 'A split in sound timber that has not been scrubbed for weeks.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_high_dmg_low_cond_high_clean',
      text: 'The floor is swept clean and the joist beneath it is listing badly.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_dmg_low_cond_low_clean',
      text: 'A wreck of a corner, with no pretence of upkeep to soften it.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },

    // 4 spec-2 damage × condition supports (for cleanliness=mid or
    // when cleanliness is unbanded). Out-rank single-condition snippets
    // when both meters resolve; under-rank the spec-3 cube corners.
    {
      id: 'est_high_dmg_high_cond',
      text: 'Sudden harm in a room that had been kept careful until now.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_dmg_low_cond',
      text: 'A long-overdue room has finally taken visible harm.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_dmg_low_cond',
      text: 'A quiet decline; deferred upkeep is turning into something structural.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'mid' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_high_dmg_mid_cond',
      text: 'Visible harm written into the wear of an average room.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'mid' },
      ],
    },

    // 3 pressure / memory / hasTag top rungs. The first shares
    // conditions with the legacy `est_damage_high_rising` above; FNV
    // tie-break picks one. Both are semantically equivalent (the same
    // damage+pressure cell phrased two ways); the new wording widens
    // the pool's spec-2 surface here without erasing the legacy line.
    {
      id: 'est_damage_rising_top',
      text: 'The damage stands out plainly, and the pressure keeps climbing.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'est_low_cond_warning',
      text: "The room is failing today on a warning we noted before.",
      conditions: [
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'est_fire_risk_ignored',
      text: 'A fire risk we have already chosen once to live with.',
      conditions: [
        { kind: 'hasTag', tag: 'fire_risk' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
  ],
}
