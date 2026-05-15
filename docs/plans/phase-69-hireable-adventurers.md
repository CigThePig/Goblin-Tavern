# Phase 69 — Hireable adventurer roster (ISSUE-029)

Implements ISSUE-029 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.5,
§5.4, §6.4).

Adds the persistent NPC roster the expedition action (phase 70) will
commission against. Adventurers are world-state entities with stable
identity; their names are generated once via the existing
`npc_identity` RNG stream.

## Scope

- New `HireableAdventurer` type, Zod schema, and
  `state.world.hireableAdventurers: Record<string, HireableAdventurer>`
  slice.
- New `adventurer_roster` RNG stream for the weekly drift roll.
- New `createHireableAdventurer(args)` factory mirroring
  `createNotableNpc` from phase 44.
- Seed 3 starter adventurers in `defaults.ts` via
  `createInitialHireableAdventurers()` using a stable seed for
  determinism (mirror staff-identity bootstrap pattern at
  `defaults.ts:128`).
- New `adventurersModule` with `endWeek` hook driving roster drift
  per §5.4:
  - Soft cap 4 rising to 6 as `culinary_renown` climbs.
  - When roster size < soft cap and renown > drift threshold, a new
    adventurer may appear.
  - When an adventurer has `daysSinceLastJob > 60` and
    `relationship < 40`, they may leave.
  - Increments `daysSinceLastJob` for every roster member each week.
- Cross-reference validation: every adventurer's `cultureId` must
  exist in `state.world.cultures`.

## Critical files

- `src/sim/state/TavernState.ts` — `HireableAdventurer` type;
  `WorldState.hireableAdventurers`.
- `src/sim/state/schemas.ts` — `HireableAdventurerSchema`;
  `WorldStateSchema.hireableAdventurers`.
- `src/sim/state/defaults.ts` — `createInitialHireableAdventurers()`;
  thread into `createInitialWorldState`.
- `src/sim/state/referenceValidation.ts` — culture-ref check per
  adventurer.
- `src/sim/core/rng.ts` — add `'adventurer_roster'` to
  `RngStreamId` union + `ALL_STREAM_IDS`.
- `src/sim/content/npc/adventurerFactory.ts` — **NEW.**
- `src/sim/modules/adventurers/adventurersModule.ts` — **NEW.**
- `src/sim/modules/adventurers/index.ts` — **NEW** module surface.
- `src/sim/testing/simRunner.ts` — wire `adventurersModule` into
  `FULL_PIPELINE`.
- `tests/sim/phase69.hireableAdventurers.test.ts` — **NEW.**

## Test approach (ISSUE-029 verification)

- Adventurers generate deterministically from a fixed seed (same
  initial state → same display names).
- Names persist across reload (state round-trips through Zod, the
  hireableAdventurers shape is byte-identical).
- A 90-day playtest with rising `culinary_renown` lifts the soft cap
  (4 → 6) and the roster size grows to match.
- A long-inactive adventurer (daysSinceLastJob > 60, relationship <
  40) leaves on a weekly drift evaluation.
- State round-trips through Zod with the new slice present.

## Out of scope (do not do)

- The expedition subsystem itself (phase 70).
- The `onExpeditionResolved` cross-module hook firing — declared as a
  contract here only; phase 70 wires the producer side, and the
  adventurer module's reaction (post-expedition stat adjustment) is a
  small extension done in phase 70.
- Regenerating adventurer names at hire time (§12 "Do Not Do" — names
  are generated once and stored).

## Notes

- Adventurers' `cultureId` is always `'adventuring_bands'`; this
  culture must exist in `state.world.cultures`. The phase 30
  starter culture set is checked at validation time.
- The `npc_identity` stream is reused; `adventurer_roster` is for
  *which slot* turns over each week, not for names. Names use
  `npc_identity` so service rolls don't shift them.
- The weekly drift uses `ctx.getRngStream('adventurer_roster')` so
  the result is deterministic given the same seed.
