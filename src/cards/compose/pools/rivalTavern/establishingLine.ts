// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Sim-backed establishing line for the rival_tavern compositional
// template. First dedicated card for the family — pre-Phase 13,
// rival_tavern seeds routed to `fallbackCard`. Narrator-voiced; the
// seed's primaryActor is `local_event` (the rival arc) or `system`,
// neither carrying castAttributes — so gates on state-lookup
// primitives only (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - hasTag `rival.arc` / `rival.system` — Phase-13 additive seed.domain tag
//   - pressureRising `rival_tavern_pressure`
//   - pressureRising `regular_customer_loss`
//   - memoryPresent on prior owner choices (compete / price / event /
//     investment / quality / deception / rumour / compromise / ignored)
//   - repeatCount `rival` ≥ 3
//   - severityAtLeast 50 (mid) and 70 (biting hard)

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The rival is pulling at the market with steady weight.',
      conditions: [],
    },

    // The rival.arc / rival.system tags (Phase-13 additive seed.domain)
    // pair with `pressureRising rival_tavern_pressure` so the
    // sim-backed slot's coherence gate sees a state-lookup primitive.
    // When the pressure isn't currently trending positive, the fallback
    // / memory rungs take over.
    {
      id: 'est_rival_arc',
      text: 'The rival house has a name and momentum behind it now.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'est_rival_system',
      text: 'An unnamed competitor is bleeding patronage off the books.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Rival_tavern_pressure has been climbing onto the books for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'est_regulars_loss',
      text: 'The slow drift of regulars off the floor is hardening.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },

    {
      id: 'est_compete_memory',
      text: 'The price cut from before is still being measured against theirs.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'est_event_memory',
      text: 'The counter-event from before still has the merchants talking.',
      conditions: [
        { kind: 'memoryPresent', tag: 'event' },
      ],
    },
    {
      id: 'est_quality_memory',
      text: 'The quality push from before is still showing in the ledger.',
      conditions: [
        { kind: 'memoryPresent', tag: 'quality' },
      ],
    },
    {
      id: 'est_deception_memory',
      text: 'The counter-rumour from the last go is part of the talk now.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'est_compromise_memory',
      text: 'The negotiated truce from before is showing thin edges.',
      conditions: [
        { kind: 'memoryPresent', tag: 'compromise' },
      ],
    },
    {
      id: 'est_ignored_memory',
      text: 'The choice to look past the rival before is paying its bill.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },

    {
      id: 'est_repeat_rival',
      text: 'Third closing running, the rival writes itself onto the ledger again.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'rival', atLeast: 3 },
      ],
    },

    {
      id: 'est_severity_repeat',
      text: 'A pull on the market the house has answered before, harder today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'rival', atLeast: 3 },
      ],
    },
  ],
}
