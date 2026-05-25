// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Optional third-person sensory beat for the customer_complaint
// template (cohort case) — the body of the cohort, their table, their
// mugs. Omitted rather than weak.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'They huddle closer like they used to.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'Their faces close like shutters at dusk.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They sit upright as if pleading before a court.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'Their mugs catch the lamplight unevenly.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'They cross their arms and wait.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'One of them turns a coaster over twice.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: `atLeast: 1` mid-rung fillers at explicit spec 0
    // so the body fires SOMETHING for neutral-leaning cohorts.
    {
      id: 'mnr_mild_warm',
      text: 'They lean closer over their table.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'Their oldest one keeps both hands on the cup.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'A chair scrapes back, then settles flat.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'Their candle gutters and one of them frowns at it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // ─── Phase 151 / ISSUE-119 — state-keyed sensory beats ──────────
    // Same pattern as the reaction pool: spec-1 state-keyed snippets
    // fire when state matches but voice is neutral. All third-person
    // plural cohort framing — never a named individual.

    {
      id: 'mnr_state_low_satisfaction',
      text: 'Coins set on the table without a glance up.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_low_loyalty',
      text: 'Chairs scrape back in unison.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_reputation_rising',
      text: 'One of them is at the window, beckoning others.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'mnr_state_complaint_memory',
      text: 'The same tired glance passes around the table.',
      conditions: [
        { kind: 'memoryPresent', tag: 'complaint' },
      ],
    },
    {
      id: 'mnr_state_repeat',
      text: 'No fuss now — just practiced disappointment.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'customer', atLeast: 3 },
      ],
    },
  ],
}
