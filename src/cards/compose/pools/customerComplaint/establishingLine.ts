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
        // Phase 187 / ISSUE-154 — only *this* group's complaint memory,
        // and only one that predates today, can back the "unanswered"
        // claim. A same-evening or cross-group memory no longer matches.
        { kind: 'memoryPresent', tag: 'complaint', scopeToActor: 'primaryActor', minAgeDays: 1 },
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
        { kind: 'memoryPresent', tag: 'complaint', scopeToActor: 'primaryActor', minAgeDays: 1 },
      ],
    },

    // ─── Phase 151 / ISSUE-119 — satisfaction × loyalty matrix corners ─
    // The cohort card is *about* satisfaction × loyalty; when both
    // bands resolve, the establishing line should state the pair, not
    // whichever single-condition snippet happens to out-specify the
    // other. Each corner combo holds BOTH signal facts as one hand-
    // authored line and outranks the multi-fact join. The
    // customer_complaint generator picks groups by `100 - satisfaction`
    // weighting, so satisfaction is low or mid (rarely high) — author
    // only the cells the design distinguishes.

    {
      id: 'est_low_sat_low_loy',
      text: "Bags already on the chair, eyes already on the door.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_low_sat_high_loy',
      text: "Loyal regulars watching us stumble, and not understanding why.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'high' },
      ],
    },
    {
      id: 'est_mid_sat_low_loy',
      text: "Nothing in particular holds them; nothing is what we've offered.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
      ],
    },
    {
      id: 'est_mid_sat_high_loy',
      text: "A hundred forgiven nights; tonight is the test of one more.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'mid' },
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'high' },
      ],
    },

    // Spec-2 signal × pressure / memory top rungs. Sit between the band-
    // pair corners and the single-condition rungs; fire when one signal
    // extreme meets a matching pressure or memory.
    {
      id: 'est_sat_reputation',
      text: "Their mood drops as the talk about us turns sour outside.",
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.satisfaction', equals: 'low' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_loyalty_complaint_memory',
      text: 'Loyalty thinned, and an unanswered complaint still sits between us.',
      conditions: [
        { kind: 'signalEquals', role: 'primaryActor', signal: 'customer_group.loyalty', equals: 'low' },
        { kind: 'memoryPresent', tag: 'complaint', scopeToActor: 'primaryActor', minAgeDays: 1 },
      ],
    },
    {
      id: 'est_loss_customer_memory',
      text: 'The loss climbs and an old slight still sits unmended.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },
  ],
}
