# Phase 50 — Cultures + tag alignment (ISSUE-010)

This phase delivers the work tracked as `ISSUE-010` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

Pre-phase: 5 cultures map 1:1 to customer groups, so
`culturalTension` essentially encodes the same axis as
`customer_group_friction`. The pressure's `taboo_memory` cause reads
three memory tags (`cultural_misunderstanding`, `seating_conflict`,
`food_taboo`) that no producer in `src/sim/` writes, so that cause
never fires.

Phase 50 grows the culture roster with three cross-cutting overlays,
points two existing world entities (a faction and four starter
regulars) at the new cultures so members exist across multiple
customer-group bases, registers three memory definitions whose tags
match the dead reads, and wires a `closing` hook on `cultureModule`
that emits those memories when the same conditions
`culturalTension` itself would care about are present.

### `src/sim/content/cultures/cultureRegistry.ts`

Three additions to `REQUIRED_CULTURES`:

| culture id | role | preferred tags | disliked tags |
|---|---|---|---|
| `shrine_devotees` | religious overlay (goblin + miner regulars) | `ritual`, `goblin_favourite`, `food` | `expensive`, `risky` |
| `traveling_outsiders` | outsider culture (merchant + adventurer regulars) | `quality_sensitive`, `food`, `drink` | `filth`, `goblin_favourite` |
| `guild_artisans` | professional overlay (`brewers_guild` faction, mixed regulars) | `quality_sensitive`, `drink` | `watered`, `cheap` |

Each uses `namingProfileId: 'goblin_common'` (the only starter profile
the codebase ships). Each carries an `importantCalendarTags` list so
`cultural_misunderstanding` has a calendar signal to bind to:

- `shrine_devotees` — `['shrine_day', 'mushroom_festival']`
- `traveling_outsiders` — `['market_day', 'supplier_day']`
- `guild_artisans` — `['supplier_day']`

(`shrine_day` is not a calendar tag the engine emits today; it is
present in the culture's "watch for" list. The
`cultural_misunderstanding` producer only fires when the calendar
actually carries one of the tags, so unobserved tags simply stay
quiet.)

### `src/sim/content/factions/factionRegistry.ts`

One additive change to the existing `brewers_guild` definition:
`cultureId: 'guild_artisans'`. The field was previously unset; the
type already permits an optional culture id, and
`validateState` runs after `ensureRequiredCulturesRegistered` so the
reference resolves cleanly.

### `src/sim/state/defaults.ts`

`StarterRegularSpec` gains an optional `cultureId` override field:

```ts
type StarterRegularSpec = {
  groupId: string
  loyalty: number
  cultureId?: string
}
```

Four existing specs adopt cross-cutting cultures:

| spec | new cultureId |
|---|---|
| `local_goblins` (loyalty 65) | `shrine_devotees` |
| `miners` (loyalty 68) | `shrine_devotees` |
| `merchants` (loyalty 62) | `traveling_outsiders` |
| `adventurers` (loyalty 64) | `traveling_outsiders` |

`createInitialRegulars` now reads `spec.cultureId ?? group.cultureId`
when composing the regular's `cultureId` and `culture:` tag. The
existing `cultureId ? { cultureId } : {}` conditional stays intact;
only the source of the id changes.

This produces `shrine_devotees` membership across
`local_goblins` + `miners` (2 customer-group bases) and
`traveling_outsiders` across `merchants` + `adventurers` (2 customer-
group bases). `guild_artisans` is referenced by the `brewers_guild`
faction.

### `src/sim/modules/memories/memoryRegistry.ts`

Three new entries in `REQUIRED_MEMORY_DEFINITIONS`:

```ts
{
  id: 'seating_conflict_recently',
  type: 'timed',
  label: 'Seating Conflict',
  defaultDurationDays: 7,
  defaultStrength: 30,
  tags: ['culture', 'seating_conflict'],
  relatedSystems: ['cultures', 'customers'],
  stacking: 'increase_strength',
}
{
  id: 'food_taboo_recently',
  type: 'timed',
  label: 'Food Taboo Encountered',
  defaultDurationDays: 7,
  defaultStrength: 25,
  tags: ['culture', 'food_taboo'],
  relatedSystems: ['cultures', 'stock'],
  stacking: 'increase_strength',
}
{
  id: 'cultural_misunderstanding_recently',
  type: 'timed',
  label: 'Cultural Misunderstanding',
  defaultDurationDays: 10,
  defaultStrength: 25,
  tags: ['culture', 'cultural_misunderstanding'],
  relatedSystems: ['cultures'],
  stacking: 'increase_strength',
}
```

`increase_strength` stacking means repeated daily fires compound
toward the 100 cap rather than spawning duplicates, mirroring how
`watered_ale_recently` and other multi-day memories behave.

### `src/sim/modules/cultures/cultureModule.ts`

Replaces the empty `cultureUpdate` placeholder with a meaningful
`closing` hook (cultureUpdate stays empty; closing runs after
service has settled). The hook scans state and emits the three
memories above when their conditions hold:

- **`seating_conflict_recently`** — pairs of customer groups where
  both have `patronage >= 25` AND
  `relationshipToOtherGroups[other.id] <= -30`. Same shape as
  `culturalTension`'s `conflicting_groups_present` cause; emits once
  per detection day with `actors` populated by both groups.
- **`food_taboo_recently`** — any customer group with
  `patronage >= 25` whose culture's `dislikedTags` intersect with the
  tags of any stock item that currently has `quantity > 0`. Emits
  with the group and culture as actors.
- **`cultural_misunderstanding_recently`** — any culture whose
  `importantCalendarTags` includes an active calendar tag today AND
  no friction-reducing policy (`cultural_accommodation`, `seating`,
  `friction_reduction` — same tag set `culturalTension` already
  recognises) is enabled. Emits with the culture as actor.

The hook reuses helpers already imported elsewhere
(`hasCalendarTag`, `ownerPolicies` from
`modules/pressures/calculators/expandedHelpers.ts`). The module now
registers two hooks (`cultureUpdate`, `closing`); the
`cultureUpdate` slot keeps its no-op placeholder so phase ordering
expectations don't shift.

## Tests

`tests/sim/phase50.culturesTagAlignment.test.ts` covers nine focused
cases (registry coverage, default-state seeding, cross-cutting
membership, `brewers_guild` adoption, validation cleanliness,
producer firings for all three tags, and end-to-end accumulation that
makes `culturalTension`'s `taboo_memory` cause fire).

## Verification

- `npm run typecheck` — passes.
- `npm test` — full Vitest suite green, including phase30
  cultures/customers/regulars tests (cross-cutting cultures should not
  break the existing 1:1 mappings) and phase44 notable-npc tests
  (unrelated; runs against the same FULL_PIPELINE shape).

## Out of scope

- New pressure causes that read each dead tag individually. The
  existing `taboo_memory` cause sums them; that's enough to close
  ISSUE-010.
- Adding a `secondaryCultures[]` field to `customerGroupState`.
  Cross-cutting is realised through individual-entity overrides
  (regulars, factions) in this pass.
- Wiring naming variation per cross-cutting culture. All three reuse
  `goblin_common` — the only starter naming profile registered today.
