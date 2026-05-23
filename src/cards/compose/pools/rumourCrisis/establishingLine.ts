// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Sim-backed establishing line for the rumour_crisis compositional
// template. First dedicated card for the family — pre-Phase 13,
// rumour_crisis seeds routed to `fallbackCard`. Third-person narration
// of the rumour situation; no first-person address (the reaction_line
// carries the target's voice).
//
// State surfaces leaned on:
//   - hasTag `rumour.<accuracy>` — Phase-13 additive seed.domain tag
//     (true / partial / false / unknown)
//   - hasTag `rumour.target.<kind>` — Phase-13 additive seed.domain tag
//   - pressureRising `rumour_pressure`
//   - memoryPresent on prior owner choices (denial / confess /
//     deflected / bribe / ignored / vouch / counter / escalation /
//     false_blame / honesty)
//   - repeatCount `rumour` ≥ 3
//   - severityAtLeast 70

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The story has begun moving past what a quiet word can settle.',
      conditions: [],
    },

    {
      id: 'est_pressure_rising',
      text: 'Rumour pressure has been climbing onto the slate for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },

    // Accuracy + target-kind snippets (Phase-13 additive seed.domain
    // tags) pair with `pressureRising rumour_pressure` so the
    // sim-backed slot's coherence gate sees a state-lookup primitive.
    // When the pressure isn't currently trending positive, the fallback
    // / memory rungs take over.
    {
      id: 'est_accuracy_false',
      text: 'The tale is outright wrong, and travelling regardless.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_accuracy_partial',
      text: 'The tale carries half the truth, with the worse half winning.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.partial' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_accuracy_true',
      text: 'The story is in fact true, and now it is loose.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.true' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },

    {
      id: 'est_target_supplier',
      text: 'The story has wound itself around a supplier and held.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.supplier' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_target_regular',
      text: 'The tale has landed on a regular and is sticking.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.regular' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_target_faction',
      text: 'A whole faction is named in the story now travelling.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.faction' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_target_staff',
      text: "The tale has folded one of the staff into it.",
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.staff' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_target_group',
      text: 'A whole table-cohort is being named in the talk doing rounds.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.customer_group' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },

    {
      id: 'est_denial_memory',
      text: 'The denial from the last round is part of the tale now.',
      conditions: [
        { kind: 'memoryPresent', tag: 'denial' },
      ],
    },
    {
      id: 'est_bribe_memory',
      text: 'A coin pressed into the wrong palm is being talked about.',
      conditions: [
        { kind: 'memoryPresent', tag: 'bribe' },
      ],
    },
    {
      id: 'est_confess_memory',
      text: 'The honesty offered last round is part of the story spreading.',
      conditions: [
        { kind: 'memoryPresent', tag: 'honesty' },
      ],
    },
    {
      id: 'est_deflected_memory',
      text: 'The deflection from the last go has been remembered.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },

    {
      id: 'est_repeat_rumour',
      text: 'Third closing running, the same whisper writes itself onto the books.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'rumour', atLeast: 3 },
      ],
    },

    {
      id: 'est_severity_repeat',
      text: 'A whisper the house has answered before, sharper today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'rumour', atLeast: 3 },
      ],
    },
  ],
}
