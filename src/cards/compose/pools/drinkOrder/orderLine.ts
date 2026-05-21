// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Committed snippet pool for the `order_line` slot of the `drink_order`
// template. Verbatim from `docs/plans/living-cast-arc-phase-b.md`
// §"Candidate snippet pool for Phase C". The pool has four rungs:
//
//   - base      (specificity 0)  one unconditional fallback
//   - middle    (specificity 1)  single-axis snippets — the COMMON rung
//   - top       (specificity 2)  two-axis snippets — the RARE rung
//   - tic       (specificity 1)  one snippet per registered verbal tic
//
// The single-axis middle rung is the structural fix Phase B identified:
// under the `[-1,0,0,1]` perturbation in `createCastAttributes.ts`, two-
// extreme snippets fire rarely, so a fallback+two-axis-only pool would
// collapse onto the fallback in play. The single-axis rung anchors a
// real specificity gradient.

import type { SnippetPool } from '../../types'

export const orderLinePool: SnippetPool = {
  slotId: 'order_line',
  snippets: [
    // — base: unconditional fallback —
    {
      id: 'order_fallback_plain',
      text: 'An ale, please. Whatever the house recommends.',
      conditions: [],
    },

    // — middle rung: single-axis (COMMON, anchors the gradient) —
    {
      id: 'order_terse',
      text: 'Ale. The usual size.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'order_warm',
      text: "Whatever's good tonight — surprise me kindly.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'order_cold',
      text: "An ale. That's all.",
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'order_formal',
      text: 'An ale, when it is convenient to pour one.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'order_florid',
      text: 'Your darkest pour, the colour of a closed door.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    // — top rung: two-axis (RARE, sharpens when both extremes land) —
    {
      id: 'order_terse_cold',
      text: 'Ale. Cold. No speech with it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'order_terse_warm',
      text: 'Big mug. Good ale. You know the one.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'order_warm_informal',
      text: 'House ale, friend. The kind that forgives a long day.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'order_formal_plain',
      text: 'A small beer, if the house can spare it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
      ],
    },
    {
      id: 'order_florid_open',
      text: 'Bring me something dark enough to hide my thoughts.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atMost: 0 },
      ],
    },

    // — tic rung: independent of axes, all seven registry tics —
    {
      id: 'order_tic_qualifies',
      text: 'A mild ale, I think. Nothing too heroic, more or less.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'order_tic_interrupts',
      text: 'Dark ale — no, bitter. Whichever bites first.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'order_tic_understates',
      text: 'A stout, please. Something with a bit of spine.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'order_tic_repeats',
      text: 'Ale. A proper ale — proper, mind you.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'order_tic_trails_off',
      text: "Just ale. Something quiet, if there's… you know.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },
    {
      id: 'order_tic_italicises',
      text: 'An ale. A good one — that part matters.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'order_tic_quotes',
      text: 'Ale, as my old captain always ordered it.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },
  ],
}
