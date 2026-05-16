# Phase 53 — `policy_backlash` family end-to-end (ISSUE-013)

This phase delivers the work tracked as `ISSUE-013` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

Pre-phase the `policy_backlash` family had:

- 6 `responseSlots` and 6 `consequenceProfiles`, but every profile was
  built through `responseSlots.map((slot) => makeProfile({...}))` — one
  `effect('cause', ...)` plus one memory entry, no
  `delayedEffects`, no `futureHooks`. With `cause`-kind effects routed
  through `ctx.addCause` (no state mutation), every player choice was a
  no-op.
- `policyBacklashAttribution` filtered recent causes by
  `direction === 'decrease'`, but the `policy_backlash` pressure only
  emits `increase`-direction causes (it raises a pressure metric, not
  lowers a relationship one). The attribution junction never fired.

Phase 53 hand-writes 6 distinct consequence profiles and removes the
direction filter on the attribution rule.

### `src/sim/modules/issues/expandedSeedGenerators.ts`

The collapsed `.map(slot => makeProfile({...}))` block at lines
4586-4605 is replaced with six hand-written profiles. Each profile uses
`pressure`, `state_change`, and `cause` effects — not the
no-op `cause`-only pattern. Each profile carries at least one
`delayedEffect`; three slots (`keep_policy`, `repeal_policy`,
`punish_violation`) carry a `futureHook`.

| Slot | Immediate | Delayed | Future hook |
|---|---|---|---|
| `keep_policy` | `pressure:policy_backlash` +6, `pressure:faction_anger` +4 | `pressure:policy_backlash` +6 (delay:7) | `policy_held_unrest_${policy.id}` (14d) |
| `modify_policy` | `pressure:policy_backlash` -10, `coin` -5 | `pressure:faction_anger` -4 (delay:5) | — |
| `repeal_policy` | `pressure:policy_backlash` -25, `reputation.respectable` -3, `cause` on `policy:${id}` -20 | `pressure:rumour_pressure` +6 (delay:4) | `policy_reversal_remembered_${policy.id}` (10d) |
| `make_exception` | `pressure:policy_backlash` -8, target-typed effect on the policy's target (loyalty +6 / cause +6) | `pressure:cultural_tension` +4 (delay:5) | — |
| `explain_policy` | `pressure:policy_backlash` -6, `reputation.respectable` +2 | `pressure:rumour_pressure` -3 (delay:3) | — |
| `punish_violation` | `pressure:violence` +5, `pressure:faction_anger` +8, target-typed cause -12 | — | `policy_punishment_grudge_${policy.id}` (14d) |

Notes:

- `repeal_policy` emits `effect('cause', 'policy:${id}', -20, …, ['policy', 'repeal'])` as a high-strength record so downstream
  consumers (ownerActions, attribution) can see the policy was withdrawn.
  The `ctxApplier` does not currently route a `policy.${id}.enabled`
  state_change path; toggling the policy's enabled flag stays the job of
  the ownerActions module and is out of scope here.
- `make_exception` and `punish_violation` use the `policy.targetType` /
  `policy.targetId` resolved into `targetRefs` to route a meaningful
  state mutation. When targetType is `customer_group`, the exception
  raises that group's `customers.${id}.loyalty` by +6 directly. When the
  target is a faction or culture, the effect routes through `cause` so
  the existing faction/culture mutator paths see the shift.

### `src/sim/modules/attribution/attributionRules.ts`

The single-line clause `c.direction === 'decrease'` is removed from the
recent-cause filter. The remaining `c.tags.includes('policy')` filter
plus the per-cause `customer_group`/`faction` related-actor gate is
enough to keep the rule from spamming on unrelated `policy` causes.

## Tests

`tests/sim/phase53.policyBacklash.test.ts` covers:

1. Seed contract: a single policy_backlash seed surfaces 6 distinct
   response slots, 6 distinct consequence profile IDs, and each profile
   carries either a delayedEffect or a futureHook.
2. Per-slot mutation distinctness: for each of the 6 slots, a
   freshly-prepared day-2 with the matching `ResponseIntent` produces a
   slot-specific state change (e.g. `repeal_policy` lowers
   `pressure:policy_backlash` and leaves a `'repeal'`-tagged memory;
   `punish_violation` raises `pressure:faction_anger`;
   `make_exception` against a customer_group raises that group's
   loyalty).
3. Delayed scheduling: slots with `delayedEffect` / `futureHook` entries
   produce records in `state.modules.responses.pending` with
   `scheduledFor` in the future.
4. Attribution junction: a policy-tagged increase-direction cause
   produces at least one attribution draft (covers the removed
   `direction === 'decrease'` filter).

## Verification

- `npx vitest run tests/sim/phase53.policyBacklash.test.ts` — passes.
- `npm run typecheck` — passes.
- No regressions in the existing `phase37.attribution`,
  `phase39.expandedIssueSeeds`, `phase40.expandedReadiness`, or
  `phase41.responsePipeline` test files.

## Out of scope

- Toggling the policy's `enabled` flag from inside a response profile.
  Profile-driven state_change paths do not yet route to ownerActions
  policies; the `repeal_policy` slot emits a high-strength cause + memory
  marker for the ownerActions module to act on later.
- The `policy_backlash` pressure calculator emits causes upward; ISSUE-013
  does not change that direction. The attribution rule is widened so it
  reads the existing causes.
