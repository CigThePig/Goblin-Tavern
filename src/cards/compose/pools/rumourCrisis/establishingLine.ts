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

    // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10
    // (Reputation, Rumour & Rivals cluster). Multi-meter combination
    // cells covering `(accuracy × target_kind)` (the natural distinct-
    // decision corners), `(accuracy × memory)`, `(target_kind ×
    // memory)`, and top-rung (accuracy × pressure × repeat) cells.
    // Every combo pairs `hasTag` reads with `pressureRising` /
    // `memoryPresent` / `severityAtLeast` / `repeatCount` so the
    // sim-coherence gate sees at least one state-lookup primitive
    // (`STATE_LOOKUP_KINDS` excludes `hasTag`).
    {
      id: 'est_false_target_regular',
      text: 'A false tale has wound around a regular and held in the talk.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'hasTag', tag: 'rumour.target.regular' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_true_target_faction',
      text: 'A true story has landed on a whole faction and is travelling.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.true' },
        { kind: 'hasTag', tag: 'rumour.target.faction' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_partial_target_supplier',
      text: 'A half-truth has wound around a supplier, the worse half winning.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.partial' },
        { kind: 'hasTag', tag: 'rumour.target.supplier' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_false_target_staff',
      text: 'A false tale has folded one of the staff into its travelling shape.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'hasTag', tag: 'rumour.target.staff' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_true_target_customer_group',
      text: 'A true story about a whole cohort is now in steady talk.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.true' },
        { kind: 'hasTag', tag: 'rumour.target.customer_group' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_partial_target_faction',
      text: 'A half-truth pinned on a faction is finding rooms to enter.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.partial' },
        { kind: 'hasTag', tag: 'rumour.target.faction' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_target_notable_npc_pressure',
      text: 'The talk has caught on a known name and is climbing on it.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.target.notable_npc' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },

    // Accuracy × memory combos — last round's choice tangled with the
    // current accuracy reading.
    {
      id: 'est_false_denial_memory',
      text: 'The false tale and last round’s denial are now braided in the talk.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'memoryPresent', tag: 'denial' },
      ],
    },
    {
      id: 'est_true_honesty_memory',
      text: 'The truth admitted last round is the spine of what is travelling.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.true' },
        { kind: 'memoryPresent', tag: 'honesty' },
      ],
    },
    {
      id: 'est_partial_bribe_memory',
      text: 'A half-truth and a quiet bribe are sharing one mouth tonight.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.partial' },
        { kind: 'memoryPresent', tag: 'bribe' },
      ],
    },

    // Top-rung (accuracy × pressure × repeat) — the deepest cell.
    {
      id: 'est_false_pressure_repeat',
      text: 'A false tale, three closings deep, climbing the books again today.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
        { kind: 'repeatCount', subjectTag: 'rumour', atLeast: 3 },
      ],
    },
  ],
}
