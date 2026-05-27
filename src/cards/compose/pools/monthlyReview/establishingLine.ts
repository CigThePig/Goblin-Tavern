// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Sim-backed establishing line for the monthly_review compositional
// template. Replaces the legacy `composeBody([ti.calendarContext[0],
// ...topPressures.map(p => '${label} ${value} (${trend})')], opts)` body
// that lifted raw pressure values into prose. The seed's primaryActor is
// a `{ kind: 'other', id: 'month:${monthKey}' }` ref — no castAttributes
// resolve — so the line is narrator-voiced and gates only on
// state-lookup primitives (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - pressureRising `landlord` / `debt` / `reputation_drift` /
//     `staff_burnout` / `customer_complaint` / `rival_tavern_pressure`
//   - memoryPresent on `rent` / `landlord` / `debt` / `risk` / `monthly` /
//     `reserves` (the monthly seed emits `rent_paid_${monthKey}`,
//     `cellar_invested_${monthKey}`, `reserves_held_${monthKey}`, and
//     `rival_settled_${monthKey}` memories on prior monthly choices)
//   - repeatCount `monthly` ≥ 3 (three months of the same pressure
//     trending positive)
//   - severityAtLeast 55 (mid) and 70 (hard)
//
// Phase 162 / ISSUE-130 — Legible Surface arc, Phase 17, iteration #1.
// The `est_rent_due_soon` rung (and matching reactionLine / title
// entries) was pruned: `rent_due_soon` lives on `state.calendar.tags`
// only, not on the monthly_review seed's domain / toneHints / stake
// tags, so `collectSeedTags` never returned it and the snippet was
// dead. Phase 156 / ISSUE-124's plan doc explicitly flagged this as
// harmless dead code deferred to Phase 17 cleanup.
//
// Design record at `specs/cards/monthly_review.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: 'The month closes on lamps trimmed and the ledger laid open.',
      conditions: [],
    },

    {
      id: 'est_landlord_rising',
      text: 'The landlord column has thickened with each pass this month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'est_debt_rising',
      text: 'The shortfall on the page has been widening week by week.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },
    {
      id: 'est_reputation_drift_rising',
      text: 'The reputation marks have been sliding through the month quietly.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_staff_burnout_rising',
      text: 'The staff lines on the ledger have grown louder this month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
      ],
    },
    {
      id: 'est_customer_complaint_rising',
      text: 'The complaint margin has been climbing across the closing weeks.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'customer_complaint' },
      ],
    },
    {
      id: 'est_rival_pressure_rising',
      text: 'The rival house has cut into the take more than once this month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },

    {
      id: 'est_rent_memory',
      text: 'Last month closed with rent settled; this one wants the same.',
      conditions: [
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'est_reserves_memory',
      text: 'The reserves held back from before are reflected at the bottom line.',
      conditions: [
        { kind: 'memoryPresent', tag: 'reserves' },
      ],
    },
    {
      id: 'est_risk_memory',
      text: 'An eviction warning is folded into the corner of the desk drawer.',
      conditions: [
        { kind: 'memoryPresent', tag: 'risk' },
      ],
    },

    {
      id: 'est_high_severity',
      text: 'The numbers refuse to soften, no matter how the columns are read.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'debt' },
      ],
    },

    {
      id: 'est_monthly_repeat',
      text: 'A third month running, the same hard line crowds the page.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'repeatCount', subjectTag: 'monthly', atLeast: 3 },
      ],
    },

    // ─── Phase 156 / ISSUE-124 — matrix cells ────────────────────────
    // Spec-2 / spec-3 combos covering pressure × memory / dual-pressure
    // / severity intersections the monthly_review seed can reach. Every
    // snippet carries ≥1 state-lookup primitive (pressureRising /
    // memoryPresent / repeatCount) so simCoherence passes — severity
    // alone is not a state-lookup kind. Memory tags match the four
    // consequence-profile emissions (rent / cellar / reserves / rival).

    {
      id: 'est_landlord_rent_memory',
      text: 'The landlord column thickens; rent paid last month feels distant now.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'est_landlord_reserves_memory',
      text: 'The landlord column thickens, with reserves already held back tight.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
        { kind: 'memoryPresent', tag: 'reserves' },
      ],
    },
    {
      id: 'est_debt_rent_memory',
      text: 'The shortfall widens, even with rent settled the prior month.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'est_debt_landlord_dual',
      text: 'Debt and landlord columns are both climbing across the page tonight.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'est_rival_pressure_memory',
      text: 'The rival house is taking the take; the prior settlement still echoes.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
        { kind: 'memoryPresent', tag: 'rival' },
      ],
    },
    {
      id: 'est_customer_complaint_reputation_dual',
      text: 'Complaints climb and the reputation marks slide together this closing.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'customer_complaint' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_staff_burnout_landlord_dual',
      text: 'The staff edge thickens just as the landlord column tightens.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'staff_burnout' },
        { kind: 'pressureRising', pressureId: 'landlord' },
      ],
    },
    {
      id: 'est_severity_landlord_rent',
      text: 'Crisis at the rent line, with the prior payment offering no slack.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'landlord' },
        { kind: 'memoryPresent', tag: 'rent' },
      ],
    },
    {
      id: 'est_severity_debt_repeat',
      text: 'Critical shortfall, and a third month of the same hard column.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'debt' },
        { kind: 'repeatCount', subjectTag: 'monthly', atLeast: 3 },
      ],
    },
    {
      id: 'est_cellar_landlord_dual',
      text: 'The cellar investment shows on the books; the landlord still pushes.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'landlord' },
        { kind: 'memoryPresent', tag: 'cellar' },
      ],
    },
  ],
}
