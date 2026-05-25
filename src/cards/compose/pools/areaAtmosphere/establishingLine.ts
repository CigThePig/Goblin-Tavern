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

    // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
    //
    // 4 spec-3 cube corners (cleanliness=low × damage × condition 2×2).
    // The picker scores `(100 − cleanliness) + damage` and requires
    // ≥ 60, so cleanliness=low is the dominant lever; condition adds
    // the cube-face third meter. Imagery varies per corner so the
    // within-pool dedupe gate has room.
    {
      id: 'est_low_clean_high_dmg_high_cond',
      text: 'Dust on rafters whose carpentry would still pass any test.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_high_dmg_low_cond',
      text: 'The room reads as nobody has bothered with it for a long stretch.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'est_low_clean_low_dmg_high_cond',
      text: 'A sturdy room let grubby enough that its good bones cannot hide it.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_low_dmg_low_cond',
      text: 'The kind of slow slip nobody catches until regulars stop sitting there.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },

    // 4 spec-2 cleanliness × damage supports (for condition=mid).
    {
      id: 'est_low_clean_high_dmg',
      text: 'Grime layered over real wear; both speak at once.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_low_clean_mid_dmg',
      text: 'The standard atmosphere case: a room slipping past clean.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'mid' },
      ],
    },
    {
      id: 'est_mid_clean_high_dmg',
      text: 'Passable upkeep, but real damage showing plainly through it.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'mid' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'est_high_clean_high_dmg',
      text: 'The rare clean-but-damaged room; the harm shows because nothing else does.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },

    // 3 pressure / memory / hasTag top rungs. The first shares
    // conditions with the legacy `est_cleanliness_pressure` above; FNV
    // tie-break picks one. Both are semantically equivalent (the same
    // cleanliness+pressure cell phrased two ways); the new wording
    // widens the pool's spec-2 surface here without erasing the
    // legacy line.
    {
      id: 'est_cleanliness_rising_top',
      text: 'Grime sunk into the corner while the board keeps creeping upward.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },
    {
      id: 'est_high_dmg_neglected',
      text: "Today's wear written on top of an older standing neglect.",
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'est_reputation_atmosphere',
      text: 'A reputation-facing corner where prior atmosphere calls still echo.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation' },
        { kind: 'memoryPresent', tag: 'atmosphere' },
      ],
    },
  ],
}
