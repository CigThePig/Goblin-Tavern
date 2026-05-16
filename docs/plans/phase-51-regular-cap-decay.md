# Phase 51 — Lift regular cap + decay (ISSUE-011)

This phase delivers the work tracked as `ISSUE-011` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

Pre-phase: `MAX_REGULARS_PER_GROUP = 3` capped emergence at ~15 named
regulars across the 5 customer groups, plus 6 starter regulars. Once
a slot filled, no new regular could ever emerge there because nothing
decays an inactive named regular out of state. The `regular_customer`
issue family rotates over a small, fixed pool.

Phase 51 lifts the cap to 7 (≈35 emergent regulars before any decay),
adds a soft-decay rule that drops named regulars who have been
inactive for ≥45 days AND carry irritation ≥75, and grows the starter
roster from 6 to 11 — with two starters bound to factions
(`miners_union`, `market_caravan_circle`) so the
`regular ← faction` channel has day-0 reachable targets.

### `src/sim/modules/regulars/regularModule.ts`

- `MAX_REGULARS_PER_GROUP` bumped from `3` to `7`.
- Two new constants: `INACTIVE_DECAY_DAYS = 45`,
  `INACTIVE_DECAY_IRRITATION = 75`.
- A new `closingHook` registered on the `closing` phase (runs after
  service settles `lastSeenDay` for today). The hook iterates every
  regular, computes `daysInactive = totalDaysElapsed - lastSeenDay`,
  and removes any regular whose `daysInactive` AND `irritation` both
  clear the thresholds. Removal is a direct mutation
  (`delete state.world.regulars[id]`) mirroring how `createRegular`
  directly writes the record; the matching cause goes through
  `ctx.addCause` with `source: 'regulars.decay'`.
- The module's per-day slice (`RegularModuleState`) gains a
  `decayedToday: string[]` field tracking every removal. The Zod
  schema is updated to match; `getRegularModuleState` and
  `createInitialRegularModuleState` flow through.
- `validateRegularState` extends to confirm every `decayedToday` id
  is no longer in `state.world.regulars`.

### `src/sim/modules/regulars/types.ts` + `state.ts`

`RegularModuleState` and `createInitialRegularModuleState` add
`decayedToday: []`. Existing callers keep working — the field is
populated only by the new decay hook.

### `src/sim/state/defaults.ts`

`StarterRegularSpec` gains an optional `factionId` field. Five new
entries land in `STARTER_REGULAR_SPECS`:

| spec | loyalty | faction |
|---|---|---|
| `local_goblins` (third) | 58 | — |
| `miners` (second) | 70 | `miners_union` |
| `merchants` (second) | 70 | `market_caravan_circle` |
| `adventurers` (second) | 58 | — |
| `ogres` (second) | 70 | — |

`createInitialRegulars` reads `spec.factionId` and adds it to the
created `RegularWorldState` with the same conditional-spread pattern
that already handles `cultureId`. The starter total rises from 6 to 11.

The phase 50 cross-cutting culture assignments (shrine_devotees on
goblin #2 + miner #1, traveling_outsiders on merchant #1 + adventurer
#1) stay intact; the new entries do not override them.

## Tests

`tests/sim/phase51.regularCapDecay.test.ts` covers nine focused cases:

1. Starter roster has 11 entries.
2. At least one regular carries `factionId === 'miners_union'`.
3. At least one regular carries `factionId === 'market_caravan_circle'`.
4. `validateState` passes for the default starting state.
5. Decay fires when `daysInactive >= 45` AND `irritation >= 75`.
6. Decay respects irritation threshold (irritation 70, no decay).
7. Decay respects recency (recent visit, no decay).
8. `decayedToday` slice records the removal and a cause with
   `source: 'regulars.decay'` is emitted.
9. Emergence can grow a group past the old cap of 3 over a many-day
   run (verifies the cap was actually lifted).

## Verification

- `npm run typecheck` — passes.
- `npm test` — full suite green, including phase30 regular tests
  (existing roster math) and phase50 cross-cutting culture tests
  (intact after the schema extension).

## Out of scope

- A `modifyRegular`-style `removeRegular` helper on the context. The
  direct-mutation pattern matches how `createRegular` already writes
  to `state.world.regulars`. Adding a dedicated remover would touch
  the engine and the context surface — out of scope for this issue.
- Decaying loyalty or visits over time. Only fully inactive +
  irritated regulars decay; everyone else stays in state with their
  current numbers.
- Notable-NPC-bound starters. The issue calls for "tied to a faction
  or notable-NPC source"; the faction route is sufficient.
