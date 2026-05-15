# Phase 44 — NPC factory + initial notable NPC roster (ISSUE-004)

This phase delivers the work tracked as `ISSUE-004` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

`src/sim/content/npc/npcFactory.ts` was a placeholder
(`export {}`); `createInitialWorldState()` seeded
`notableNpcs: {}`. The `notable_npc` EntityRef kind had ~7 consumer
code paths across pressure, feedback, weekly, service, issues, and
causes modules — all unreachable because no notable NPC ever existed
in state. The `notable_npc_repetition` axis of the named-entity audit
was mathematically zero. The inspection family's `town_watch_advisor`
futureHook (plus three sibling watch-bound hooks) bound only to the
`town_watch` faction ref.

Phase 44 adds a `NotableNpcProfile` registry with 8 starter profiles,
implements `createNotableNpc` as a caller-passes-RNG factory mirroring
`createStaffIdentity`, seeds the initial roster through the
`npc_identity` RNG stream (which had zero callers before this phase —
ISSUE-023 expected this issue to wire it), and lifts the inspection
generator's `inspectorActor` resolution so the watch inspector NPC
flows into four faction-bound futureHooks at once.

### `src/sim/content/npc/notableNpcProfiles.ts` (new)

Co-located file: `NotableNpcProfile` type + `notableNpcProfileRegistry`
+ `REQUIRED_NOTABLE_NPC_PROFILES` + `ensureRequiredNotableNpcProfilesRegistered`.
Mirrors `staffIdentityProfiles.ts` single-file ergonomics. Eight starter
profiles anchored to the six existing factions:

| profile id | faction | culture | naming profile |
|---|---|---|---|
| `watch_inspector` | `town_watch` | — | `human_town` |
| `watch_captain` | `town_watch` | — | `human_town` |
| `moneylender` | `brewers_guild` | `merchant_roadfolk` | `merchant_roadfolk` |
| `town_gossip` | — | `goblin_local` | `goblin_common` |
| `fence` | `scrap_collectors` | `goblin_local` | `goblin_common` |
| `shrine_priest` | `local_shrine` | — | `human_town` |
| `merchant_prince` | `market_caravan_circle` | `merchant_roadfolk` | `merchant_roadfolk` |
| `miner_foreman` | `miners_union` | `miner_workcrew` | `goblin_common` |

`ensureRequiredNotableNpcProfilesRegistered` calls
`ensureStarterNamingProfilesRegistered()` first — the only registration
ordering constraint. Factions / cultures / customer-groups are looked
up by string id at runtime; reference validation
(`referenceValidation.ts:136-142`) confirms reachability when state
seeds.

### `src/sim/content/npc/npcFactory.ts`

Replaces the placeholder with `createNotableNpc(args)`:

```ts
type CreateNotableNpcArgs = {
  npcId: string
  profileId: string
  rng: SimRng
  firstSeenDay: number
  existingNames?: ReadonlySet<string>
}
type CreateNotableNpcResult = {
  npc: NotableNpcWorldState
  generatedName: GeneratedName
}
```

The factory pulls the profile, looks up the `NamingProfile`, generates
a deterministic display name via `generateName(...,
'notable_npc:${npcId}', existingDisplayNames?)`, and composes the
world-state record. Returns the `NotableNpcWorldState` shape directly
(not the stale Phase 22 `NpcIdentity`); the caller in `defaults.ts`
writes it into state without an adapter.

### `src/sim/state/defaults.ts`

Adds `createInitialNotableNpcs()` mirroring `createInitialStaff()` and
`createInitialRegulars()`: a stable seed `'initial-notable-npcs'`
routed through the `npc_identity` stream, iterating the registry in
sorted-id order so reordering the `REQUIRED_NOTABLE_NPC_PROFILES`
array does not shift generated names, threading `existingNames` to
prevent collisions. Wired into `createInitialWorldState()` —
`notableNpcs: createInitialNotableNpcs()` replaces the empty record.

### `src/sim/modules/issues/generatorHelpers.ts`

Adds two small helpers:

- `notableNpcRef(id)` — alongside the other expanded-world ref helpers
  (`regularRef`, `cultureRef`, `factionRef`, `supplierRef`, etc).
- `findNotableNpcByFaction(state, factionId)` — iterates
  `state.world.notableNpcs` in stable id order and returns the first
  ref whose `factionId` matches. Used by the inspection lift below.

### `src/sim/modules/issues/issueSeedGenerators.ts`

Two related changes in `generateInspection`:

**(a)** Lift `inspectorActor` resolution. The previous

```ts
const inspectorActor = townWatch ?? systemRef('inspector')
```

becomes

```ts
const watchInspectorNpc = findNotableNpcByFaction(ctx.state, 'town_watch')
const inspectorActor = watchInspectorNpc ?? townWatch ?? systemRef('inspector')
```

This lift covers the seed-level `primaryActor`, the
`namedEntityIngredient(state, 'inspector', inspectorActor)` call, and
any downstream reader that consumes `inspectorActor` directly.

**(b)** Route the four watch-bound futureHook actor arrays through
`inspectorActor` rather than `townWatch` directly:

| futureHook id | Before | After |
|---|---|---|
| `corrupt_inspector_relationship` | `townWatch ? [townWatch] : []` | `[inspectorActor]` |
| `inspection_discovery_possible` | `townWatch ? [townWatch] : []` | `[inspectorActor]` |
| `town_watch_goodwill` | `townWatch ? [townWatch] : []` | `[inspectorActor]` |
| `town_watch_advisor` | `townWatch ? [townWatch] : []` | `[inspectorActor]` |

`inspectorActor` always has a value (notable NPC → faction → system
fallback), so the `?:` ternary becomes a single-element array. The
`town_watch_advisor` row is the orphan hook called out explicitly in
ISSUE-004's evidence; the other three share the same shape and lift
in the same change for consistency.

Faction-level memory entries that explicitly reference `townWatch` as
a faction ref (e.g. `bribed_inspector`, `inspection_ignored_recently`,
`town_watch_advisor_memory`, `tavern_walkthrough_done`) stay unchanged —
those are correctly faction-scoped because the memory documents a
relationship with the institution, not the individual. Response-slot
`targetOptions` (the bribe / ask-for-guidance pickers) also stay on
the faction ref; targeting "the watch" rather than a specific inspector
is a meaningful gameplay distinction.

The lift also surfaces a `notable_npc:` key in the named-entity
repetition audit; the watch inspector now accrues hits the same way
`faction:town_watch` did before.

## Tests

`tests/sim/phase44.notableNpcs.test.ts` adds ten focused tests:

1. **Roster seeded** — `state.world.notableNpcs` has 8 entries with
   non-empty `name.display`, `kind`, `firstSeenDay`, `tags`.
2. **Canonical ids present** — the 8 expected NPC ids
   (`notable_npc_watch_inspector`, `notable_npc_watch_captain`, …,
   `notable_npc_miner_foreman`) are all in the seeded state.
3. **Reference reachability** — every seeded NPC's `factionId`,
   `cultureId`, and `customerGroupId` (when set) points at an existing
   entity in `state.world.factions`, `state.world.cultures`, and
   `state.customerGroups`.
4. **Determinism** — two `createInitialTavernState()` calls produce
   the same `{ id, displayName }` set.
5. **Schema + cross-reference validation** —
   `validateState(createInitialTavernState(), { modules: FULL_PIPELINE })`
   does not throw (Zod schema + `validateWorldReferences`).
6. **Factory determinism** — two separate `createRngStreams` with the
   same base seed produce identical `npc.name.display` and identical
   `npc` records.
7. **Unknown profile id** — `createNotableNpc({ profileId: 'nope', …
   })` throws a useful error.
8. **Inspection seed includes notable_npc ref** — fire the inspection
   family on a state with high inspection pressure; at least one seed
   exposes a `notable_npc` ref in `primaryActor`, `affectedActors`, or
   `textIngredients.namedEntities`, and at least one of those refs
   points at a notable NPC whose `factionId === 'town_watch'`
   (either the captain or the inspector — `findNotableNpcByFaction`
   picks alphabetically and both belong to the watch).
9. **Inspection seed futureHooks bind to notable_npc** — at least one
   futureHook in the inspection seed's consequence profiles has an
   `actors` array containing a `notable_npc` ref to a watch-affiliated
   NPC.
10. **Named-entity audit credits notable NPCs** — over a 28-day
    cardless run with inspection conditions seeded, the named-entity
    repetition audit records at least one `notable_npc:` usage.

## Verification

- `npm run typecheck` passes.
- `npm test` runs the full Vitest suite; `phase44.notableNpcs.test.ts`
  passes and the existing `phase19.issueSeeds`, `phase31.staffIdentity`,
  `phase39.expandedIssueSeeds`, and `phase40.expandedReadiness` suites
  remain green (the inspection family still fires, just with a
  notable_npc primary actor rather than a bare faction).

## Out of scope

- `NpcIdentity` / `NpcKind` types in `npcTypes.ts` — stale Phase 22
  sketch with no current consumers. Left untouched; ISSUE-023 will
  decide whether to prune.
- Other `npc_identity` stream call sites beyond the initial-roster
  seeding — emergent NPC creation during simulation is downstream
  work for whatever phase introduces in-run NPC promotion.
- Memory entries that bind to `townWatch` as a faction ref — those
  are correctly faction-scoped and stay unchanged.
- Faction roster growth (`ISSUE-012`), culture roster growth
  (`ISSUE-010`), and inspection family un-pinning (`ISSUE-018`). The
  `inspectorActor` lift here is the minimum that lets `notable_npc`
  refs reach the audit; full rotation across alternate inspector
  factions is `ISSUE-018`'s job and depends on `ISSUE-012`.
- Adding a rival-tavern faction. No `rival_taverns` faction exists in
  the registry; rival-owner profiles would need that or `ISSUE-012`
  to land first.
