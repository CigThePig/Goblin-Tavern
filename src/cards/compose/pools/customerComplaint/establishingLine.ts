// Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 (Regulars & Complaints).
//
// Sim-backed establishing line for the customer_complaint compositional
// template. States what the sim says about this cohort at the
// complaint moment: group satisfaction band, group loyalty band, rising
// reputation_drift / staff_loyalty_risk / regular_customer_loss /
// rumour_pressure / cultural_tension pressure, prior memory tag
// (customer, complaint), repeated customer seed appearance.
//
// Every non-fallback snippet carries ≥1 state-lookup condition; the
// unconditional fallback claims only what the seed firing guarantees.
//
// Design record at `specs/cards/customer_complaint.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'A table of patrons gathers tighter, voices low.',
      conditions: [],
    },

    {
      id: 'est_low_satisfaction',
      text: "Their satisfaction's been bottoming out all evening.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_satisfaction',
      text: "The room's mood has been off since they sat down.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'mid' },
      ],
    },
    {
      id: 'est_low_loyalty',
      text: "The group's loyalty has been slipping for weeks now.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_reputation_rising',
      text: 'Talk of this house has been drifting in the wrong direction.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_staff_loyalty_rising',
      text: 'Word at this table reaches the kitchen by morning.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_loyalty_risk' },
      ],
    },
    {
      id: 'est_loss_rising',
      text: 'Regulars have been quietly thinning these last weeks.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'est_rumour_rising',
      text: 'Whispers about this room have started running ahead of the truth.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'est_cultural_rising',
      text: 'Old grievances between groups have been sharpening lately.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'cultural_tension' },
      ],
    },
    {
      id: 'est_complaint_memory',
      text: 'The last complaint they raised is still unanswered.',
      conditions: [
        { kind: 'memoryPresent', tag: 'complaint' },
      ],
    },
    {
      id: 'est_customer_memory',
      text: 'They remember a slight that never got smoothed over.',
      conditions: [
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },
    {
      id: 'est_repeat_visit',
      text: 'Same lot, same table, same trouble all week.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'customer', atLeast: 3 },
      ],
    },

    {
      id: 'est_satisfaction_repeat',
      text: 'Same lot, third complaint this week running.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
        { kind: 'repeatCount', subjectTag: 'customer', atLeast: 3 },
      ],
    },
    {
      id: 'est_loyalty_complaint',
      text: 'Loyalty thin and an unanswered complaint — bad pairing.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
        { kind: 'memoryPresent', tag: 'complaint' },
      ],
    },
  ],
}
