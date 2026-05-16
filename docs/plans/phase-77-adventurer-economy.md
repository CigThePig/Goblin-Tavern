# Phase 77 — wageBase / specialty / activeFlags wiring (ISSUE-037)

See `docs/ISSUE_TRACKER.md` ISSUE-037 for full evidence and impact.

## Context

Three fields on `HireableAdventurer` declared semantics but had no
runtime consumer:

- `wageBase: number // coin per expedition day` — written at
  creation, never read. Expedition cost was `input.amount` (free-form
  player input). A master adventurer could ship for 0 coin.
- `specialty: string | null // optional tag biasing target tier` —
  written but never consulted by the outcome roll.
- `activeFlags: string[]` — written at creation, never read.

The schema and docstrings promised meaningful structure; the runtime
ignored all three. Hiring and commission decisions were not real
economic choices.

## Decisions

- **wageBase:** Route cost through `wageBase * daysTotal`. Drop
  `input.amount` from the cost calc entirely. Reject the commission
  when `state.coin < cost` with a clear "wage X/day × Yd" reason.
- **specialty:** When `runner.specialty` equals the actual rarity
  tier being fetched (resolved through `rarityForExpedition`), add
  +0.10 to the success probability. Magnitude is small enough to
  preserve the rookie/master spread but big enough to make specialty
  matter when picking a runner.
- **activeFlags:** Use `'injured'` as a recovery marker.
  - Failed expeditions set the flag on resolution.
  - `getValidTargets` filters out injured runners; `canApply` rejects
    them.
  - Successful expeditions strip the flag.
  - The weekly drift hook in `adventurersModule` clears the flag once
    `daysSinceLastJob >= 14`.

## Implementation

- `src/sim/modules/expeditions/commissionExpedition.ts`:
  - Replace `readCost(input)` with `computeCost(runner, daysTotal)`.
  - `getValidTargets` skips injured runners.
  - `canApply` rejects injured runners with `code: 'runner_injured'`.
  - `canApply` cost-rejection message names the wage formula.
- `src/sim/modules/expeditions/expeditionsModule.ts`:
  - `rollOutcome` adds `+0.10` to success when
    `runner.specialty === tier` (after `rarityForExpedition`).
  - `applyRunnerUpdate` mutates `activeFlags`: append `'injured'` on
    failure, strip on success, leave alone on partial.
- `src/sim/modules/adventurers/adventurersModule.ts`:
  - Idle-tick loop clears the `'injured'` flag when
    `nextIdle >= INJURED_RECOVERY_THRESHOLD_DAYS` (14). Constant
    declared at the module head.
  - Cause `source` switches to `adventurers.recovery` on the tick
    that clears the flag (existing `weekly_idle_tick` for plain idle).
- `tests/sim/phase70.expeditions.test.ts`:
  - Update the cost assertion for alpha's 5-day rare expedition:
    `costPaid: 30` (was `20`). The unrelated `costPaid: 20` on the
    same test referred to the same expedition so it was deduped.

## Verification

- `tests/sim/phase77.adventurerEconomy.test.ts` (new, 6 tests):
  - cost is `wageBase * daysTotal` for alpha and beta;
  - insufficient coin rejects the commission;
  - specialty match lifts success rate over 30 trials;
  - failure sets `'injured'` and a follow-up commission is blocked;
  - injury clears once `daysSinceLastJob >= 14` via the weekly hook;
  - FULL_PIPELINE still wires both modules.
- `tests/sim/phase69.hireableAdventurers.test.ts` (8) and
  `tests/sim/phase70.expeditions.test.ts` (12) — both green.
- `tests/sim/phase71.cookSkill.test.ts` (11) — green (sanity).
- `npm run typecheck` — clean.

## Files

- `src/sim/modules/expeditions/commissionExpedition.ts`
- `src/sim/modules/expeditions/expeditionsModule.ts`
- `src/sim/modules/adventurers/adventurersModule.ts`
- `tests/sim/phase70.expeditions.test.ts` (cost assertion update)
- `tests/sim/phase77.adventurerEconomy.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
