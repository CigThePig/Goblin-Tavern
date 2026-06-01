// Phase 188 / ISSUE-155 — Causal Establishing Line.
//
// Sim-backed LEAD line for the customer_complaint compositional template.
// Where `establishingLine.ts` states the cohort's *standing* (satisfaction
// / loyalty bands, rising pressures, prior memory), this slot names the
// *event* the sim attributed as the dominant negative cause — the reason
// the cohort is unhappy tonight, classified off `seed.causes` via
// `pickDominantCause` → `classifyCause`.
//
// One snippet per `CauseClass`, each gated on a single `dominantCause`
// condition. There is DELIBERATELY no unconditional fallback: this is an
// OPTIONAL slot, so when no cause classifies the slot fills nothing and
// the body matches the pre-Phase-188 output exactly (framework §5
// graceful degradation). An unconditional fallback here would assert a
// cause the sim never recorded — the Core Design Rule forbids it.
//
// Every snippet is ≤14 words (the slot's wordBudget) and speaks in cohort
// voice ("they" / "what they came in for").

import type { SnippetPool } from '../../types'

export const causeLinePool: SnippetPool = {
  slotId: 'cause_line',
  snippets: [
    {
      id: 'cause_shortage',
      text: "What they came in for, we'd run dry of.",
      conditions: [{ kind: 'dominantCause', anyOf: ['shortage'] }],
    },
    {
      id: 'cause_cleanliness',
      text: "The room hadn't been touched, and they could see it.",
      conditions: [{ kind: 'dominantCause', anyOf: ['cleanliness'] }],
    },
    {
      id: 'cause_price',
      text: "The reckoning came dearer than they'd planned for.",
      conditions: [{ kind: 'dominantCause', anyOf: ['price'] }],
    },
    {
      id: 'cause_danger',
      text: "Last night's trouble still hung in the air, and they felt it.",
      conditions: [{ kind: 'dominantCause', anyOf: ['danger'] }],
    },
    {
      id: 'cause_rumour',
      text: "They'd heard the talk before they reached the door.",
      conditions: [{ kind: 'dominantCause', anyOf: ['rumour'] }],
    },
    {
      id: 'cause_wait',
      text: 'They waited, and waited, and watched us not come.',
      conditions: [{ kind: 'dominantCause', anyOf: ['wait'] }],
    },
  ],
}
