# Phase 59 — `monthly_review` promotion to card family (ISSUE-019)

This phase delivers the work tracked as `ISSUE-019` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). User chose the
promote-to-card-family path.

## What changed

Pre-phase the `monthly_review` family was a structured report seed
with empty `responseSlots`, empty `consequenceProfiles`, empty
`memoriesCreated`, empty `futureHooks`, and empty `stakes`. Four
`seed.type === 'monthly_review'` bypasses in
`issueSeedValidation.ts` exempted it from the 10-point contract
checks. Every month-end was a meaningful decision point that the
simulation handled as a wordless report.

Phase 59 promotes the family to a real card seed with 3–4 strategic
decision slots and removes the 4 validator bypasses.

### `src/sim/modules/issues/issueSeedGenerators.ts`

Rewrite `generateMonthlyReview` to populate:

- `responseSlots`: 3 always-on slots plus 1 conditional slot when the
  `rival_taverns` faction (added in phase 52) is seeded.
  - `pay_landlord_on_time` (safe_costly): spend the month's rent
    amount to lower landlord pressure.
  - `invest_in_cellar` (long_term_investment): -20 coin +12
    cellar.condition; risk delayed landlord pressure.
  - `hold_reserves` (compromise): preserve coin; staff feel the
    squeeze on a delay.
  - `settle_with_rival` (compromise, conditional): -15 coin, cause on
    `faction:rival_taverns` +12, lower rival pressure; gossip rises
    on a delay.
- `consequenceProfiles`: matching profiles for each slot, all with
  delayedEffects + futureHooks.
- `stakes`: rent + coin stakes so the validator's `reason_to_care`
  contract check passes without a bypass.
- `memoriesCreated`: one `monthly_review_${monthKey}` memory.
- `primaryActor`: a `month:${monthKey}` ref so the seed has a stable
  per-month identity.

### `src/sim/modules/issues/issueSeedValidation.ts`

Remove the 4 `seed.type === 'monthly_review'` bypass clauses at
lines 404 / 415 / 428 / 441. After promotion the seed satisfies all
four checks on its own merits.

## Tests

`tests/sim/phase59.monthlyReview.test.ts` covers:

1. The family fires exactly once per month boundary (gated by the
   contradiction guard's `isEndOfMonth()` check).
2. Each promoted slot produces a distinct treatment-vs-control
   mutation: `pay_landlord_on_time` spends rent and lowers landlord
   pressure; `invest_in_cellar` raises cellar.condition; `hold_reserves`
   lowers debt pressure; `settle_with_rival` lowers rival_tavern_pressure
   when the faction exists.
3. All 4 promoted slots park at least one pending entry in
   `state.modules.responses.pending`.
4. The seed validates against the contract WITHOUT the removed
   `monthly_review` bypasses — `at_least_two_responses`,
   `short_term_consequences`, `memory_or_future_hook`, and
   `reason_to_care` all pass on their own merits.

## Verification

- `npx vitest run tests/sim/phase59.monthlyReview.test.ts` — passes.
- `npm run typecheck` — passes.
- No regressions in existing `phase19.issueSeeds`,
  `phase39.expandedIssueSeeds`, `phase52.nicheFactions` tests.

## Out of scope

- Tweaking the monthly economy / rent / reserve calculation. The
  promoted family reads month-end results from
  `state.modules.monthly.lastMonthlyResult` and `monthly.rent` —
  unchanged.
- Replacing the structured monthly report. The seed coexists with the
  existing monthly report section; it's the player-agency surface, not
  the analytical summary.
