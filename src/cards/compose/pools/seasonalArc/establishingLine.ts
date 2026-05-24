// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Sim-backed establishing line for the seasonal_arc compositional
// template. First dedicated card for the family — pre-Phase 14, every
// seasonal_arc seed (both `arc_milestone` and `festival_preparation`
// types, both active-arc and anticipation paths) routed to
// `fallbackCard`. The seed's primaryActor is a `local_event` ref (Path
// A) or `undefined` (Path B anticipation); local_events have no
// castAttributes — so the line is narrator-voiced and gates only on
// state-lookup primitives (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - pressureRising `arc_escalation` / `festival_readiness`
//   - hasTag `mushroom_blight` / `miner_payday_boom` /
//     `inspection_campaign` / `rival_tavern_expansion` /
//     `festival_approaching` (themes flowed through `seed.toneHints`,
//     read by `hasTag` via `collectSeedTags`) — paired with
//     `pressureRising` co-conditions for sim-coherence (themes alone are
//     seed-shape, not state-lookup)
//   - seedType `arc_milestone` (climax rung)
//   - memoryPresent on prior arc choices (`arc` / `festival` / `arc_warning`)
//   - severityAtLeast 55 (mid) and 70 (climax-grade)

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A shape gathers on the calendar that the room is starting to feel.',
      conditions: [],
    },

    {
      id: 'est_arc_escalation_rising',
      text: 'Arc pressure has been thickening through every closing of the week.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'est_festival_readiness_rising',
      text: 'Festival readiness has been climbing onto the boards for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'festival_readiness' },
      ],
    },

    {
      id: 'est_climax',
      text: 'The arc has reached the day the room cannot ignore.',
      conditions: [
        { kind: 'seedType', anyOf: ['arc_milestone'] },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },

    {
      id: 'est_blight',
      text: 'A mushroom blight is biting the supply lanes wide open.',
      conditions: [
        { kind: 'hasTag', tag: 'mushroom_blight' },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'est_payday',
      text: 'The miner payday has the road thick with coin and noise.',
      conditions: [
        { kind: 'hasTag', tag: 'miner_payday_boom' },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'est_inspection_campaign',
      text: 'An inspection sweep is moving along the row this week.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_campaign' },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'est_rival_expansion',
      text: 'A rival house is laying flags into nearby streets at speed.',
      conditions: [
        { kind: 'hasTag', tag: 'rival_tavern_expansion' },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },
    {
      id: 'est_festival',
      text: 'A festival is gathering on the horizon of the calendar.',
      conditions: [
        { kind: 'hasTag', tag: 'festival_approaching' },
        { kind: 'pressureRising', pressureId: 'festival_readiness' },
      ],
    },

    {
      id: 'est_arc_memory',
      text: 'A choice from the last arc beat is still showing on the books.',
      conditions: [
        { kind: 'memoryPresent', tag: 'arc' },
      ],
    },
    {
      id: 'est_festival_memory',
      text: 'The festival preparation from before still shapes the room today.',
      conditions: [
        { kind: 'memoryPresent', tag: 'festival' },
      ],
    },

    {
      id: 'est_high_severity',
      text: 'The shape has hardened past the point of quiet observation.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'arc_escalation' },
      ],
    },

  ],
}
