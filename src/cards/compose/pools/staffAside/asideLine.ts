// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
//
// Committed snippet pool for the `aside_line` slot of the `staff_aside`
// template. Hand-authored — not generated through the Phase E pipeline.
// The matching spec at `specs/cards/staff_aside.spec.yaml` records the
// design intent in the same format Phase B used for `drink_order`.
//
// The pool has four rungs, mirroring `orderLinePool`:
//
//   - base      (specificity 0)  one unconditional fallback
//   - middle    (specificity 1)  single-axis snippets — the COMMON rung
//   - top       (specificity 2)  two-axis snippets — the RARE rung
//   - tic       (specificity 1)  one snippet per registered verbal tic
//
// All snippets are FLAVOR: the staff member voices a pre-shift remark to
// the owner without claiming any specific past event, named NPC, or
// faction outcome. The seed's loyalty / blame / "feels watched" framing
// flows in through `textIngredients` (sensoryDetails, recentContext,
// socialContext), not through the voice line.

import type { SnippetPool } from '../../types'

export const asideLinePool: SnippetPool = {
  slotId: 'aside_line',
  snippets: [
    // — base: unconditional fallback —
    {
      id: 'aside_fallback_plain',
      text: "Morning. I'm ready when you are.",
      conditions: [],
    },

    // — middle rung: single-axis (COMMON, anchors the gradient) —
    {
      id: 'aside_terse',
      text: "Ready. Tell me what's needed.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'aside_warm',
      text: "You look tired. We'll see the morning through together.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'aside_cold',
      text: "If there's a problem, say it plainly.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'aside_formal',
      text: 'At your service, as the house requires.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'aside_florid',
      text: "Morning came dressed in grey. Still — the kettle's hot.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    // — top rung: two-axis (RARE, sharpens when both extremes land) —
    {
      id: 'aside_terse_cold',
      text: "What's wrong. Say it and I'll handle it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'aside_terse_warm',
      text: "Quick word. I'm in your corner today.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'aside_warm_informal',
      text: "Look — I'm not going anywhere. We sort it.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'aside_formal_plain',
      text: 'I shall remain steady, if conduct serves.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },
    {
      id: 'aside_florid_open',
      text: "I've a morning's worth of words saved up for you.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atMost: 0 },
      ],
    },

    // — tic rung: independent of axes, all seven registry tics —
    {
      id: 'aside_tic_qualifies',
      text: "It's fine, I think. Mostly. Probably.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'aside_tic_interrupts',
      text: "I'm — well, I'm here. That should count for something.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'aside_tic_understates',
      text: "A small matter, perhaps. Nothing the work won't sort.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'aside_tic_repeats',
      text: "I'll work. I'll work, and I'll work properly.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'aside_tic_trails_off',
      text: 'I just wanted to say — well, you know…',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'aside_tic_italicises',
      text: 'I am still here. That part should count.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'aside_tic_quotes',
      text: 'As my old master said — show up first.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },

    // ─── Phase 150 / ISSUE-118 — state-keyed asides ──────────────────
    // First-person reactions that reflect the staff member's actual
    // standing instead of just their voice profile. Spec-1 by default;
    // these fire orthogonally to the voice-keyed rungs above so a
    // tense staff member sounds different from a steady one even with
    // the same axes. The existing voice-keyed snippets stay — they
    // resolve when state is neutral and voice is extreme.

    {
      id: 'aside_state_high_stress',
      text: "I'm pulled tight today. I'll keep it off the floor.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'high' },
      ],
    },
    {
      id: 'aside_state_low_stress',
      text: "Steady morning. I'm where you need me.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.stress', equals: 'low' },
      ],
    },
    {
      id: 'aside_state_high_fatigue',
      text: "I'm slow today. I'll move careful, not careless.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
      ],
    },
    {
      id: 'aside_state_loyalty_risk',
      text: "I've been pulling away. Wanted you to hear it from me.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'aside_state_burnout',
      text: "The load's been crowding into my mornings. Just so you know.",
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'aside_state_repeat',
      text: "Third quiet word in a week. I'd rather not need a fourth.",
      conditions: [
        { kind: 'repeatCount', subjectTag: 'staff', atLeast: 3 },
      ],
    },
    {
      id: 'aside_state_identity',
      text: "That slight last week — I'd like to set it down.",
      conditions: [
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'aside_state_warning',
      text: "I know I was on warning. I'm trying to be plain.",
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
  ],
}
