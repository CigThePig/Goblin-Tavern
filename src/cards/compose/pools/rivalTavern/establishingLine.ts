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

    // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10
    // (Reputation, Rumour & Rivals cluster). Multi-meter combination
    // cells covering `(rival_type × dual-pressure)`, `(rival_type ×
    // memory)`, `(dual-pressure × memory)`, and top-rung
    // (rival_type × severity × repeat) cells. Every combo pairs
    // `hasTag rival.*` with `pressureRising` / `memoryPresent` /
    // `severityAtLeast` / `repeatCount` so the sim-coherence gate sees
    // a state-lookup primitive.
    {
      id: 'est_arc_customer_loss',
      text: 'A named rival has been bleeding regulars off the floor for days.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_system_customer_loss',
      text: 'An anonymous undercutter is bleeding regulars off the floor.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },

    // Rival-type × memory combos — last round's response tangled with
    // the current rival reading.
    {
      id: 'est_arc_price_memory',
      text: 'The named rival and last round’s price cut are both still trading.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'est_arc_event_memory',
      text: 'The named rival and last round’s counter-event sit beside each other.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'memoryPresent', tag: 'event' },
      ],
    },
    {
      id: 'est_system_ignored_memory',
      text: 'The anonymous pull was set aside last round; it is back heavier.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'est_arc_deception_memory',
      text: 'The named rival and last round’s counter-rumour are still in talk.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },

    // Dual-pressure combos — both pressures climbing in step, or one
    // pressure paired with last round's choice memory.
    {
      id: 'est_dual_pressure_rising',
      text: 'Both the rival pull and the regulars drift are climbing on the same day.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_dual_pressure_deception_memory',
      text: 'Both pressures are up while last round’s counter-rumour still trades.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },

    // Top-rung (rival_type × severity × repeat) — the deepest cells.
    {
      id: 'est_arc_severity_repeat',
      text: 'The named house, three closings deep, pulls harder again today.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'rival', atLeast: 3 },
      ],
    },
    {
      id: 'est_system_severity_pressure',
      text: 'The anonymous pull has tipped past softening; the books bend with it.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
  ],
}
