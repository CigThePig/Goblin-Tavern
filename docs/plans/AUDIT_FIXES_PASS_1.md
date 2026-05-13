# Goblin Tavern Audit Fixes — Pass 1

## What this is

A sequenced list of code fixes that address content, structural, and engine-contract problems surfaced by the Phase 20 / Phase 40 readiness audits. Each fix is self-contained: read the problem, locate the files, apply the change, verify the acceptance criteria, move on.

**Scope:** Code under `src/sim/{core, modules, state, content, registries}`. Engine, content registries, generators, calculators, memory writers, and seeded defaults.

**Out of scope:** Audit readers, scoring formulas, thresholds, and the cardless test harness under `src/sim/testing/`. Those have their own structural issues but are deliberately deferred to a follow-up pass.

## Baseline state (what the audit reports today)

```
identity_richness:             25/70   FAIL
entity_memory_quality:         69/70   FAIL (just under)
attribution_quality:           65/65   pass
expanded_pressure_quality:     68/70   FAIL (just under)
expanded_seed_coverage:       100/65   pass
text_ingredient_quality:       87/75   pass
named_entity_repetition:       28/70   FAIL
arc_and_calendar_use:         100/60   pass
social_consequence_quality:    63/70   FAIL
expanded_contradiction_safety:100/90   pass

core.cause_coverage:            0/80   FAIL
core.response_impact:          17/70   FAIL
core.strategy_diversity:       62/70   FAIL
```

Two failing metrics — `named_entity_repetition` and `core.strategy_diversity` — are gated by audit-side calibration issues; pass 1 will improve them but not push them over threshold. That's expected; they're flagged for the next pass.

## How to use this document

- Fixes are ordered by dependency. Stage 1 must land before Stage 2; Stage 2 before Stage 3; etc.
- Each fix is small enough to land in one commit.
- After each fix, verify the acceptance criteria before moving on.
- Line numbers cited are accurate at time of writing but will drift as fixes land. Use them as starting points; grep for the function or pattern if the line doesn't match.
- If the actual code differs significantly from what's described, stop and re-read — don't guess.

## Progress checklist

**Stage 1 — Foundation (seeding and contract fixes)**
- [ ] 1.1: Align `StaffState.name` with `GeneratedName` shape
- [ ] 1.2: Make engine Phase 7 mutation helpers record causes
- [ ] 1.3: Seed starter regulars at day 0
- [ ] 1.4: Seed one starter enabled policy
- [ ] 1.5: Add 4 non-goblin naming profiles and route content to them
- [ ] 1.6: Move festival calendar tag inside 3-month run range

**Stage 2 — Memory and attribution writer fixes**
- [ ] 2.1: Arc memory writers attach `local_event` actor refs
- [ ] 2.2: Service brawl memory puts area in `subjects`
- [ ] 2.3: Rate-limit and diversify the rumour distrust attribution rule
- [ ] 2.4: Lower per-actor branch thresholds in `supplierDistrust`

**Stage 3 — Pressure-calculator per-cause actor wiring**
- [x] 3.1: Add per-rumour cause entries to `rumourPressure`
- [x] 3.2: Attach actor refs to per-cause entries in three calculators

**Stage 4 — Feedback loop fix**
- [ ] 4.1: `festival_unreadiness_loop` requires festival_readiness as evidence

**Stage 5 — Generator content (the biggest content lift)**
- [x] 5.1: Upgrade thin consequence profiles across 6 expanded families
- [x] 5.2: Add picker rotation to expanded seed generators
- [x] 5.3: Stop using singleton `system:*` refs as `primaryActor`

**Stage 6 — Optional balance touch-up**
- [x] 6.1: Tighten weekly faction memory creation triggers (evaluated and skipped — `entity_memory_quality` measured at 72 after Stages 1–5, already over the 70 threshold; per the fix's own guidance, the marginal benefit isn't worth the noise)

---

## Stage 1 — Foundation

### Fix 1.1: Align `StaffState.name` with `GeneratedName` shape

**Problem.** The identity richness audit reads `staff.name?.display` and `staff.name.profileId` (`src/sim/testing/expandedReadinessReport.ts`, around line 111). But `StaffState.name` is typed as a plain `string` (`src/sim/state/TavernState.ts:134-155`), populated as `identity.generatedName.display` (`src/sim/state/defaults.ts` `createInitialStaff`). The actual `GeneratedName` object lives at `staff.identity.generatedName`. The audit sees `"Gribna".display === undefined` and reports all staff as missing names, even though identity generation IS happening correctly and three different naming profiles are bound to the three staff roles (`cook_goblin_common`, `server_town_human`, `cleaner_bouncer_dwarf_caravan`).

This single shape mismatch is why the audit reports `namedStaff: 0` and `namingProfilesUsed: ['goblin_common']` despite the system working correctly under the hood.

**Files.**
- `src/sim/state/TavernState.ts` — `StaffState` type
- `src/sim/state/defaults.ts` — `createInitialStaff`
- All readers — find via:
  - `grep -rn "staff.name\b" src/sim`
  - `grep -rn "\${.*\.name}" src/sim/modules`
  - `grep -rn "member\.name\|chosen\.name" src/sim/modules`

**What to change.**

1. In `TavernState.ts`, change `StaffState.name: string` to `StaffState.name: GeneratedName`. Import `GeneratedName` from `../content/naming/nameTypes` if not already.

2. In `defaults.ts` `createInitialStaff`, change `name: identity.generatedName.display` to `name: identity.generatedName`.

3. Remove the now-redundant `generatedName` field from `StaffIdentityState` (`TavernState.ts:121-132`). It duplicates `staff.name`. Update `createStaffIdentity` (`src/sim/content/staff/staffIdentityFactory.ts`) to stop populating it. Any reader of `staff.identity.generatedName` should instead read `staff.name`.

4. Migrate every reader from `staff.name` (string) to `staff.name.display` (string). Mechanical change. Expect ~20-30 sites across `src/sim/modules/`: pressure-calculator readables, owner-action labels, seed-generator template literals, service scene strings, weekly/monthly reports.

**Acceptance.** After this fix alone, running `buildIdentityRichnessReport(createInitialTavernState())` returns:
- `namedStaff: 3`
- `entitiesWithMissingNames: []`
- `namingProfilesUsed` includes all three of `goblin_common`, `human_town`, `dwarf_caravan`
- Score climbs from 25 toward 65

**Complexity:** M. Type change is one line; reader migration spans many files but is mechanical.

---

### Fix 1.2: Make engine Phase 7 mutation helpers record causes

**Problem.** The core mutation helpers `modifyArea`, `modifyStock`, `modifyStaff`, `modifyCustomerGroup`, `modifyCoin`, `modifyReputation`, `modifyPressure` in `src/sim/core/engine.ts` (lines roughly 634-717) accept a `_meta` parameter but the underscore prefix gives it away — the meta is unused. None of them call `addCauseInternal`. Cause-recording for those changes only happens when modules explicitly call `ctx.addCause(...)`, and the manual targets use a colon convention (`staff:cook.morale`, `customer:local_goblins.satisfaction`) that doesn't match what the diff produces (`staff.cook.morale`, `customers.local_goblins.satisfaction`). The audit at `src/sim/testing/readinessReport.ts:118-126` matches `cause.target === change.path`, and finds zero overlap.

The Phase 27 world helpers (`modifyCulture`, `modifyFaction`, etc., around lines 738-862) already auto-record causes via `addCauseInternal(meta, { target: id, targetType: 'culture' })`. Apply the same shape to the older Phase 7 helpers, with target strings that match the diff's path format.

**Files.** `src/sim/core/engine.ts` — the seven `modify*` helpers and the existing `addCauseInternal` helper near line 548.

**What to change.**

For each Phase 7 helper, after applying the state change, call `addCauseInternal(meta, defaults)` where `defaults.target` matches the diff path convention from `src/sim/core/diff.ts`:

- `modifyArea(id, changes, meta)` — for each numeric key in `changes`, emit a cause with `target: 'areas.${id}.${key}'`, `targetType: 'area'`, `amount: changes[key] - before[key]`.
- `modifyStock(id, changes, meta)` — same shape, `target: 'stock.${id}.${key}'`, `targetType: 'stock'`.
- `modifyStaff(id, changes, meta)` — `target: 'staff.${id}.${key}'`, `targetType: 'staff'`.
- `modifyCustomerGroup(id, changes, meta)` — `target: 'customers.${id}.${key}'` (note plural `customers`, matching `src/sim/core/diff.ts:240`), `targetType: 'customer'`.
- `modifyReputation(next, meta)` — walk reputation axes, emit one cause per changed axis with `target: 'reputation.${axis}'`, `targetType: 'reputation'`.
- `modifyPressure(id, change, meta)` — `target: 'pressures.${id}.value'`, `targetType: 'pressure'`, `amount: nextValue - existing.value`.
- `modifyCoin(delta, meta)` — `target: 'coin'`, `targetType: 'coin'`, `amount: delta`.

Skip cause emission for non-numeric fields and for fields where before === after. If `meta` is missing or has no `source`, default to `{ source: 'system', sourceType: 'system' }`.

The existing manual `ctx.addCause(...)` sites should keep working — they emit additional causes in the colon convention, which the audit ignores but which other readers (cause-by-tag queries, pressure calculator references) use. Don't remove them.

**Acceptance.** Run the core readiness report (`buildReadinessReport`) and check `cause_coverage` section. Should climb from 0 toward 60-80% — most staff/area/stock/customer/pressure significant changes now have matching causes.

**Complexity:** M. ~10 lines per helper. The tricky bit: filtering `changes` partials down to just numeric fields that actually changed.

---

### Fix 1.3: Seed starter regulars at day 0

**Problem.** `state.world.regulars` starts as `{}` (`src/sim/state/defaults.ts:357`). Regulars are meant to emerge during play via `regularModule.regularUpdateHook`, but emergence requires `group.loyalty >= 70 && group.satisfaction >= 55` (`src/sim/modules/regulars/regularModule.ts:49-51`). Only `local_goblins` meets the loyalty bar on day 0 (loyalty=70 exactly), and its satisfaction crashes below 55 within the first few days of any no-input run. The result: 0 regulars emerge across an 84-day run.

Three downstream symptoms cascade from this:
- Identity richness audit: `namedRegulars: 0`.
- Entity memory quality audit: `regularMemories: 0` (every regular-memory writer in `weekly/community.ts` short-circuits at `regulars.length === 0`).
- Seed coverage: the `regular_customer` family produces 0 seeds (its generator returns `[]` when `regulars.length === 0`).

Fix by seeding a roster of starter regulars at day 0, similar to how factions, suppliers, cultures, and customer groups are seeded.

**Files.**
- `src/sim/state/defaults.ts` — add `createInitialRegulars()`, wire into `createInitialWorldState()`
- May need imports from `src/sim/content/naming/{nameGenerator, namingProfiles}` and `src/sim/core/rng`

**What to change.**

Add a function paralleling the existing `createInitialFactions`, `createInitialSuppliers`. It produces 6 starter regulars distributed across customer groups, each with a culture-appropriate generated name.

Use a fixed seed (`'initial-regulars'`) routed through `createRngStreams` to keep names deterministic across runs. Iterate in a stable order so name generation is repeatable.

Suggested distribution (covers 5 customer groups, exercises 5 different naming profiles after Fix 1.5):
- 2 regulars from `local_goblins` (uses `goblin_common`)
- 1 from `miners` (uses `miner_workcrew` from Fix 1.5)
- 1 from `merchants` (uses `merchant_roadfolk` from Fix 1.5)
- 1 from `ogres` (uses `ogre_clans` from Fix 1.5)
- 1 from `adventurers` (uses `adventuring_bands` from Fix 1.5)

Each regular needs:
- `id`: stable string like `starter_regular_${groupId}_${index}` (e.g. `starter_regular_local_goblins_1`)
- `name`: `GeneratedName` from `generateName(profile, rng, 'regular_customer')`
- `customerGroupId`: the group id
- `cultureId`: copied from the customer group
- `loyalty`: 60-75 range
- `irritation`: 0
- `visits`: 0
- `firstSeenDay`: 0
- `lastSeenDay`: 0
- `knownIncidentIds`: `[]`
- `tags`: `['regular', 'starter', 'culture:${cultureId}']`
- `activeFlags`: `[]`

The customer group's `namingProfileId` is the source for which profile to use. If the group's profile isn't registered, fall back to `goblin_common`.

Wire `regulars: createInitialRegulars()` into `createInitialWorldState()` in place of `regulars: {}`.

**Acceptance.**
- `state.world.regulars` has 6 entries on day 0.
- After Fix 1.1: identity richness audit shows `namedRegulars: 6+`.
- `regular_customer` family produces seeds during an 84-day run (depends on `regular_customer_loss` pressure crossing 25; with 6 regulars and existing irritation hooks, this should fire).
- Entity memory audit shows `regularMemories > 0` after weekly community trends fire.

**Complexity:** M. New function modeled on `createInitialFactions`. Care needed around determinism — must use seeded RNG, not Math.random.

**Dependencies:** Fix 1.5 (naming profiles for non-goblin cultures) should land first or alongside. If 1.5 hasn't landed yet, all 6 regulars will fall back to `goblin_common` and the culture diversity benefit is delayed.

---

### Fix 1.4: Seed one starter enabled policy

**Problem.** The `policy_backlash` seed family in `src/sim/modules/issues/expandedSeedGenerators.ts` (around line 1571) has two preconditions: `policy_backlash` pressure ≥ 25, AND at least one enabled policy in `state.modules.ownerActions.policies`. The pressure calculator (`src/sim/modules/pressures/calculators/policyBacklash.ts:26-37`) early-exits to value=0 when no policies are enabled. So the two preconditions form a deadlock: no enabled policies → pressure stays 0 → family can't fire.

Policies normally get enabled by owner actions, but the gate-config evaluation run takes no owner actions. Result: 0 policy_backlash seeds in 84 days.

Fix by seeding one default-enabled policy at day 0.

**Files.**
- `src/sim/state/defaults.ts` — extend the owner-actions initial state (or wherever `createInitialOwnerActionsModuleState` lives, likely in `src/sim/modules/ownerActions/ownerActionsModule.ts`)
- Verify the policy registry already has a `cheap_payday_specials` definition (referenced in `src/sim/content/factions/factionRegistry.ts:25` as a miners_union liked policy)

**What to change.**

1. Pick the policy. `cheap_payday_specials` is a good choice: already referenced by faction registry, naturally controversial (miners love it, merchants likely dislike cheap food/drink).

2. In the initial owner-actions module state, add an entry:
   ```javascript
   policies: {
     cheap_payday_specials: {
       id: 'cheap_payday_specials',
       label: 'Cheap Payday Specials',
       enabled: true,
       tags: ['cheap', 'payday', 'food'],  // match the policy's existing tag shape
       // any other fields the policy state schema requires
     }
   }
   ```
   Check the actual policy state schema in `src/sim/modules/ownerActions/` and match its shape.

3. Verify the policy carries tags that some customer group's `dislikedTags` will hit. Look at `customerRegistry.ts`: `merchants.dislikedTags` includes `['filth', 'danger', 'risky']`. If `cheap_payday_specials` doesn't have a tag that matches a disliked tag of any group, add one. Either:
   - Add `cheap` to merchants' `dislikedTags`, OR
   - Add `risky` to the policy's tags

   This is what makes the policyBacklash calculator's `dislikingGroups` loop bite, which is what moves the pressure above 25.

**Acceptance.**
- `state.modules.ownerActions.policies['cheap_payday_specials']?.enabled === true` on day 0.
- `policy_backlash` pressure starts moving within the first month of an 84-day run.
- `policy_backlash` family produces ≥5 seeds in 84 days.

**Complexity:** S. ~15 lines plus a verification of the policy state shape.

---

### Fix 1.5: Add 4 non-goblin naming profiles and route content to them

**Problem.** `STARTER_NAMING_PROFILES` in `src/sim/content/naming/namingProfiles.ts` only registers 3 profiles: `goblin_common`, `human_town`, `dwarf_caravan`. Of those, only `goblin_common` is actively used by world content:
- All 5 customer groups use `goblin_common` (`src/sim/registries/customerRegistry.ts` — every `defaultState.namingProfileId`)
- All 4 suppliers use `goblin_common` (`src/sim/content/suppliers/supplierRegistry.ts`)
- Factions don't have `namingProfileId` at all
- The 2 non-goblin profiles only get exercised when staff identity uses them (server → human_town, cleaner_bouncer → dwarf_caravan)

After Fix 1.1, the audit can see 3 profiles in use. The identity richness score gives +20 for `profiles.size >= 4`. Need at least 4 distinct profiles being used by world entities. Solve by adding 4 culture-aligned profiles and routing the relevant content at them.

**Files.**
- `src/sim/content/naming/namingProfiles.ts` — add 4 new profiles to `STARTER_NAMING_PROFILES`
- `src/sim/registries/customerRegistry.ts` — change `namingProfileId` per group (in both the top-level and the nested `defaultState`)
- `src/sim/content/suppliers/supplierRegistry.ts` — change `namingProfileId` per supplier

**What to change.**

Add 4 profiles to `STARTER_NAMING_PROFILES`. Each follows the same shape as existing profiles:

- `miner_workcrew`: short, hardworking names. Given: `Hodd, Brunn, Kev, Marn, Tess, Yorra, Plym, Drev`. Family: `Pickbreaker, Ironback, Coalhand, Slatebreaker, Deeprun`. Patterns mostly `given_family`.

- `merchant_roadfolk`: trader-styled. Given: `Alric, Renna, Veska, Tomis, Hessa, Brell, Mavin, Larissa`. Family: `Caravan, Roads, Mileson, Wagonley, Sterling, Postmark`. Optional titles: `Trader, Factor, Master, Mistress`.

- `ogre_clans`: long, thunderous. Given: `Grollix, Marrok, Ulluk, Drazga, Bellor, Korragh`. Family: `Clobberkin, Boneclan, Stoneblood, Crackjaw, Ironbrood`. Patterns mostly `given_family`, possibly some `given_only` for single-name informality.

- `adventuring_bands`: epithet-heavy. Given: `Kael, Mira, Doran, Talvi, Sevren, Aldra`. Nicknames: `the Bold, of the Wastes, Ironforge, Quickfoot, the Scarred`. Patterns weight `given_nickname` heavily, with some `given_family` (Family: `Vance, Roth, Briar, Cael`).

Route content at the new profiles:

In `customerRegistry.ts`, change `namingProfileId` per group (update BOTH the top-level field AND the same field nested under `defaultState`):
- `local_goblins`: keep `goblin_common`
- `miners`: change to `miner_workcrew`
- `merchants`: change to `merchant_roadfolk`
- `ogres`: change to `ogre_clans`
- `adventurers`: change to `adventuring_bands`

In `supplierRegistry.ts`, change `namingProfileId` per supplier based on its label/character:
- `brakka_mushroom_cart`: keep `goblin_common`
- `old_keg_brewers`: keep `goblin_common` (or `merchant_roadfolk` if it fits the brewer character better)
- `mudroad_grain_runner`: change to `merchant_roadfolk` (caravan/road implies merchant)
- `scrap_meat_vendor`: keep `goblin_common`

**Acceptance.**
- `namingProfileRegistry.all()` returns 7 entries (3 existing + 4 new).
- After Fix 1.1 + 1.3 + 1.5: `buildIdentityRichnessReport` returns `namingProfilesUsed.length >= 4`, score reaches 90+.
- Starter regulars from Fix 1.3 generate culture-appropriate names (e.g. miners get names from `miner_workcrew`).

**Complexity:** S-M. Profile definitions are mostly data, ~60 lines total. Routing changes are one-liners per entity.

---

### Fix 1.6: Move festival calendar tag inside 3-month run range

**Problem.** The `festival_window` and `mushroom_festival` calendar tags are only added when `calendar.month === 7 && calendar.week === 2` (`src/sim/modules/calendar/index.ts:67-70`). The gate run is 84 days, starting at month 1 week 1 day 1 and ending at month 4 week 1 day 1. Month 7 is never reached.

Consequences:
- `festival_readiness` pressure stays at value=0 across all 84 days (its calculator at `festivalReadiness.ts:49-59` early-exits to 0 when no festival arc and no festival calendar tag).
- The `festival_approaching` arc (`src/sim/content/events/localArcRegistry.ts:133-156`) has start condition `{ kind: 'calendar_tag', id: 'festival_window' }` — the arc never seeds.
- `festival_unreadiness_loop` activates anyway (21 days in a typical run) because it's gated on 2-of-3 pressures including `stock_shortage` and `staff_burnout` (Fix 4.1 addresses this).

Move the festival tag to a month inside the 3-month range so the festival prep loop can actually exercise during gate evaluation.

**Files.** `src/sim/modules/calendar/index.ts` around line 67-70.

**What to change.**

Change:
```javascript
if (calendar.month === 7 && calendar.week === 2) {
  add('mushroom_festival')
  add('festival_window')
}
```
to:
```javascript
if (calendar.month === 2 && calendar.week === 4) {
  add('mushroom_festival')
  add('festival_window')
}
```

Then verify the `festival_approaching` arc's start condition. It should trigger on the `festival_window` calendar tag, not on a hardcoded month — if any direct month references exist, leave them or align with month 2.

Note: month 2 week 4 will co-occur with `rent_due_soon` (added at `:65` for days 22-28). That's fine — both can fire together. But double-check no festival logic ASSUMES `month === 7` anywhere else:
- `grep -rn "month === 7\|month: 7\|festival_month" src/sim`

**Acceptance.**
- During an 84-day gate run, `festival_window` calendar tag appears at least once (specifically during week 4 of month 2).
- `festival_readiness` pressure moves (trend ≠ 0) on at least some days.
- `festival_approaching` arc seeds during month 2.

**Complexity:** S. One change + verification.

---

## Stage 2 — Memory and attribution writer fixes

### Fix 2.1: Arc memory writers attach `local_event` actor refs

**Problem.** When local arcs start or resolve, the `localArcsModule` writes memory entries (`src/sim/modules/localArcs/localArcsModule.ts:279-283` and `:320-324`). These memories include `metadata: { arcId: instance.id }` — a string id — but NO `actors`, NO `metadata.owner`, no entity refs at all. The audit's entity-memory category counter at `src/sim/testing/expandedReadinessReport.ts:298` looks for refs of kind `local_event` to count arc memories. The arc memories exist (3 in a typical run) but fail `isEntityMemory(m)` entirely because they have no actor/owner/subject refs — they're not even counted as entity memories.

Arcs ARE stored in `state.world.localEvents` (`localArcsModule.ts:80`), so `local_event` refs are the correct kind to use. Just need to add them.

**Files.** `src/sim/modules/localArcs/localArcsModule.ts` around lines 279 and 320.

**What to change.**

For the arc-resolved memory writer (around line 279):
```javascript
ctx.addMemory({
  id: `local_arc_resolved:${arc.definitionId}`,
  source: `${SOURCE}.${arc.definitionId}`,
  actors: [{ kind: 'local_event', id: arc.id }],   // ADD THIS LINE
  metadata: { arcId: arc.id, stage: outcome.nextStage },
})
```

For the arc-started memory writer (around line 320):
```javascript
ctx.addMemory({
  id: `local_arc_started:${def.id}`,
  source: `${SOURCE}.${def.id}`,
  actors: [{ kind: 'local_event', id: instance.id }],   // ADD THIS LINE
  metadata: { arcId: instance.id },
})
```

Apply the same shape to any other `addMemory` call in the localArcs module that references an arc.

**Acceptance.**
- After an 84-day gate run, `buildEntityMemoryQualityReport(state).arcMemories >= 3`.
- Entity memory quality score moves from 69 toward 74-78.

**Complexity:** S. Two lines.

---

### Fix 2.2: Service brawl memory puts area in `subjects`

**Problem.** The brawl memory writer in `src/sim/modules/service/serviceModule.ts:198-208` stores the area as `locations: [{ kind: 'area', id: brawl.areaId }]`. The audit's entity-memory category counter at `src/sim/testing/expandedReadinessReport.ts:285-292` looks at `owner | subjects | blamed | credited | actors` — `locations` is not in the list. So area refs from brawl memories don't contribute to `areaMemories`.

Convert from `addMemory` to `addEntityMemory` so the area becomes a subject:

**Files.** `src/sim/modules/service/serviceModule.ts` around line 198.

**What to change.**

Replace:
```javascript
ctx.addMemory({
  id: 'recent_brawl',
  source: SOURCE,
  metadata: { severity: brawl.severity, actorGroup: brawl.actorGroup },
  ...(brawl.actorGroup
    ? { actors: [{ kind: 'customer_group', id: brawl.actorGroup }] }
    : {}),
  ...(brawl.areaId
    ? { locations: [{ kind: 'area', id: brawl.areaId }] }
    : {}),
})
```
with:
```javascript
ctx.addEntityMemory(
  brawl.actorGroup
    ? { kind: 'customer_group', id: brawl.actorGroup }
    : { kind: 'tavern_identity', id: ctx.state.meta.tavernId },
  {
    id: 'recent_brawl',
    source: SOURCE,
    metadata: { severity: brawl.severity, actorGroup: brawl.actorGroup },
    ...(brawl.areaId
      ? { locations: [{ kind: 'area', id: brawl.areaId }] }
      : {}),
  },
  brawl.areaId
    ? { subjects: [{ kind: 'area', id: brawl.areaId }] }
    : undefined,
)
```

This sets the customer_group (or tavern) as owner, keeps the area location, AND adds the area as a subject. The audit counts subjects toward category buckets.

**Acceptance.** After an 84-day gate run with at least one brawl, `buildEntityMemoryQualityReport(state).areaMemories >= 1`.

**Complexity:** S.

---

### Fix 2.3: Rate-limit and diversify the rumour distrust attribution rule

**Problem.** The `rumourDistortsCause` rule in `src/sim/modules/attribution/attributionRules.ts:531-561` creates one distrust attribution per spreading rumour per day, with hardcoded `perceivedBy: { kind: 'system', id: 'town_gossip' }`. Each attribution becomes a memory via `propagateToMemories` (`attributionModule.ts:307-329`). In a typical 84-day run this produces ~44 memories, all owned by `system:town_gossip` with `tavern_identity` subjects — 90% of the entity-memory volume, contributing 0 to the audit's category breadth (the audit categories don't track `system` or `tavern_identity`).

Two fixes that compound:

1. **Cooldown.** Prevent re-firing for the same rumour every day.
2. **Diversify the perceiver.** Pick a customer_group from active groups instead of always `system`.

**Files.**
- `src/sim/modules/attribution/attributionRules.ts` — the `rumourDistortsCause` rule, around line 531
- Module state may need extending — check `src/sim/modules/attribution/attributionModule.ts` for the slice shape

**What to change.**

1. Add a `recentDistrustByRumour: Record<string, number>` field to the attribution module's state slice (the map records the last day a distrust was emitted for each rumour id).

2. In `rumourDistortsCause.evaluate`:
   - Read the slice's `recentDistrustByRumour`.
   - For each spreading rumour, check if `today - lastDay < COOLDOWN_DAYS` (suggest `COOLDOWN_DAYS = 7`). If so, skip.
   - Otherwise emit the draft and update the cooldown map.

3. Replace the hardcoded perceiver:
   ```javascript
   perceivedBy: { kind: 'system', id: 'town_gossip' },
   ```
   with a seeded pick from customer groups that have non-trivial patronage:
   ```javascript
   const rng = ctx.getRngStream('attribution_perceiver')
   const eligibleGroups = Object.values(ctx.state.customerGroups)
     .filter(g => g.patronage >= 25)
   const perceiverGroup = eligibleGroups.length > 0
     ? rng.pick(eligibleGroups)
     : null
   const perceivedBy: EntityRef = perceiverGroup
     ? { kind: 'customer_group', id: perceiverGroup.id }
     : { kind: 'system', id: 'town_gossip' }  // fallback only if no eligible groups
   ```

The seeded RNG stream `attribution_perceiver` may need registration. Check `src/sim/core/rng.ts` for how streams are declared (likely a constant array or set).

**Acceptance.**
- After an 84-day gate run, `attribution.distrust`-sourced memories number ~10-15, not ~44.
- The owners of those memories include multiple customer_group kinds, not just `system:town_gossip`.

**Complexity:** M.

---

### Fix 2.4: Lower per-actor branch thresholds in `supplierDistrust`

**Problem.** The `staff_loyalty_risk` pressure calculator at `src/sim/modules/pressures/calculators/staffLoyaltyRisk.ts:81-124` has per-staff branches with threshold 25, and these branches fire during gate runs — producing named causes with `relatedActors`. The `supplier_distrust` calculator at `src/sim/modules/pressures/calculators/supplierDistrust.ts:84-138` has the same shape of per-supplier branches but at threshold 30, and those branches rarely fire because supplier-side memory creation is sparse.

Match the thresholds.

**Files.** `src/sim/modules/pressures/calculators/supplierDistrust.ts:84-138`.

**What to change.**

Change `30` to `25` on these lines (around line numbers, search for the literal):
- `if (blame >= 30)` (around line 88)
- `if (lateMem >= 30)` (around line 100)
- `if (disputeMem >= 30)` (around line 112)
- `if (reliefScore >= 30)` (around line 127)

**Acceptance.** After an 84-day gate run, the `supplier_distrust` pressure shows at least one cause with `relatedActors` populated (i.e., supplier_distrust appears in `pressuresWithNamedCauses`).

**Complexity:** S. 4 number changes.

---

## Stage 3 — Pressure-calculator per-cause actor wiring

### Fix 3.1: Add per-rumour cause entries to `rumourPressure`

**Problem.** The `rumour_pressure` calculator at `src/sim/modules/pressures/calculators/rumourPressure.ts:21-103` iterates `state.world.socialRumours` (lines 27-43) and computes `totalStrength` as a single aggregate cause with no `relatedActors`. Every other cause in the calculator is similarly aggregate. No per-actor branches exist anywhere in the file. The pressure never appears in the audit's `pressuresWithNamedCauses` list even though it's iterating over rumour entities that carry `subject` refs.

Add per-rumour causes that forward the rumour ref.

**Files.** `src/sim/modules/pressures/calculators/rumourPressure.ts`.

**What to change.**

After the existing aggregate `active_rumours` cause (around line 35), add a loop that emits per-rumour causes for the top 3 rumours by strength (cap to avoid unbounded growth):

```javascript
const sortedRumours = Object.values(ctx.state.world.socialRumours)
  .filter(r => r.strength >= 30)
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 3)

for (const rumour of sortedRumours) {
  const actors: EntityRef[] = [{ kind: 'rumour', id: rumour.id }]
  if (rumour.subject) actors.push(rumour.subject)
  pushCause(causes, {
    id: `rumour_${rumour.id}`,
    readable: `${rumour.label} circulating (strength ${Math.round(rumour.strength)}).`,
    amount: Math.round(rumour.strength * RUMOUR_PER_STRENGTH),
    tags: ['rumour', ...rumour.tags],
    relatedActors: actors,
    relatedSystems: ['rumours'],
  })
}
```

`rumour` IS in the audit's `NAMED_ENTITY_KINDS` set (`src/sim/testing/expandedReadinessReport.ts:816`), so this counts.

**Acceptance.** After an 84-day gate run with at least one rumour, `rumour_pressure` appears in `pressuresWithNamedCauses`.

**Complexity:** S. ~15 lines added.

---

### Fix 3.2: Attach actor refs to per-cause entries in three calculators

**Problem.** Three pressure calculators currently push actor refs into the pressure-level `relatedActors` array but NOT into the per-cause entries. The audit at `src/sim/testing/expandedReadinessReport.ts:466-482` reads cause-level `relatedActors`, not pressure-level. So these pressures have the data but it's invisible to the named-cause check.

The three calculators:

- `src/sim/modules/pressures/calculators/rivalTavernPressure.ts:32-46` — the `rival_arc_active` cause around line 38-45 doesn't carry the arc refs that are pushed to `relatedActors` at line 35.
- `src/sim/modules/pressures/calculators/culturalTension.ts:55-83` — the `conflicting_groups_present` cause around line 76-83 doesn't carry the customer_group refs that are pushed to `relatedActors` at lines 70-71.
- `src/sim/modules/pressures/calculators/factionAnger.ts:133-147` — the `active_faction_arc` cause around line 139-146 doesn't carry the arc refs from line 134-137.

**What to change.**

**rivalTavernPressure.ts** — in the `pushCause` for `rival_arc_active`:
```javascript
pushCause(causes, {
  id: 'rival_arc_active',
  readable: `${arcs.length} rival arc(s) active (intensity ${arcIntensity}).`,
  amount: Math.round(arcIntensity * RIVAL_ARC_PER_INTENSITY),
  tags: ['rival', 'arc'],
  relatedActors: arcs.map(arc => ({ kind: 'local_event', id: arc.id })),  // ADD
  relatedSystems: ['localArcs'],
})
```

**culturalTension.ts** — in the `pushCause` for `conflicting_groups_present`:
```javascript
pushCause(causes, {
  id: 'conflicting_groups_present',
  readable: `${conflictPairs} hostile customer-group pair(s) co-present.`,
  amount: CONFLICTING_GROUPS_PRESENT * conflictPairs,
  tags: ['customers', 'conflict'],
  relatedActors: [...relatedActors],  // ADD — copies the pressure-level array
  relatedSystems: ['customers', 'cultures'],
})
```
Note: `customer_group` is not in the audit's `NAMED_ENTITY_KINDS`, so this won't immediately move `pressuresWithNamedCauses`. The data is still correct; the audit-side fix is deferred to the next pass.

**factionAnger.ts** — in the `pushCause` for `active_faction_arc`:
```javascript
if (arcs.length > 0) {
  pushCause(causes, {
    id: 'active_faction_arc',
    readable: `${arcs.length} active faction-tension arc(s).`,
    amount: FACTION_ARC_PER_ARC * arcs.length,
    tags: ['faction', 'arc'],
    relatedActors: arcs.map(arc => ({ kind: 'local_event', id: arc.id })),  // ADD
    relatedSystems: ['localArcs', 'factions'],
  })
}
```

**Acceptance.** After an 84-day gate run, `rivalTavernPressure` and `factionAnger` appear in `pressuresWithNamedCauses` (via `local_event` arc refs). `culturalTension` carries `customer_group` refs on the cause (verifiable by inspecting the pressure module's snapshots, though audit score doesn't move until next pass).

**Complexity:** S. One-line addition per calculator.

---

## Stage 4 — Feedback loop fix

### Fix 4.1: `festival_unreadiness_loop` requires festival_readiness as evidence

**Problem.** The detector at `src/sim/modules/feedback/detectors/expandedLoops.ts:177-195` uses `pushPressureEvidence` for three pressures (`festival_readiness`, `stock_shortage`, `staff_burnout`) and activates on `highCount >= 2` (the rule in `resultFromEvidence` at line 51). The festival side is one-of-three, not mandatory.

Consequence: the loop activates ~21 days in an 84-day gate run, but `festival_readiness` is at 0 on all of those days. The loop is firing entirely on stock_shortage + staff_burnout being high. The loop's name and `readable` say it's about festival preparation, but the activation criterion doesn't enforce that.

Make festival_readiness a gate.

**Files.** `src/sim/modules/feedback/detectors/expandedLoops.ts`, the `detectFestivalUnreadinessLoop` function around line 177.

**What to change.**

Replace:
```javascript
export function detectFestivalUnreadinessLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'festival_readiness', label: 'Festival Readiness' },
    { id: 'stock_shortage', label: 'Stock Shortage' },
    { id: 'staff_burnout', label: 'Staff Burnout' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'fast',
    ['festival', 'stock', 'staff'],
    ['localArcs', 'stock', 'staff', 'pressures'],
    ['festival', 'arc'],
    'festival arrives unprepared → stock runs out → staff exhaust themselves → preparation slips further',
  )
}
```
with:
```javascript
export function detectFestivalUnreadinessLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const festivalValue = ctx.state.pressures['festival_readiness']?.value ?? 0

  // Gate: this loop is specifically about festival unreadiness. If
  // festival pressure isn't elevated, the loop is inactive even when
  // adjacent pressures (stock, burnout) are.
  if (festivalValue < EXPANDED_TRIGGER) {
    return {
      active: false,
      strength: 0,
      risk: 0,
      speed: 'fast',
      evidence,
      nodes: ['festival', 'stock', 'staff'],
      relatedSystems: ['localArcs', 'stock', 'staff', 'pressures'],
      tags: ['festival', 'arc'],
      readable: 'festival readiness within tolerance; loop inactive.',
    }
  }

  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'festival_readiness', label: 'Festival Readiness' },
    { id: 'stock_shortage', label: 'Stock Shortage' },
    { id: 'staff_burnout', label: 'Staff Burnout' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'fast',
    ['festival', 'stock', 'staff'],
    ['localArcs', 'stock', 'staff', 'pressures'],
    ['festival', 'arc'],
    'festival arrives unprepared → stock runs out → staff exhaust themselves → preparation slips further',
  )
}
```

**Acceptance.** After Fix 1.6 + 4.1 applied together, the loop activates only on days when `festival_readiness >= EXPANDED_TRIGGER` (which now happens during month 2 week 4 after Fix 1.6). Likely fewer total active days than today's 21 — that's correct; today's count is spurious.

**Complexity:** S.

**Dependencies:** Fix 1.6 should land first or alongside. Otherwise this fix will correctly make the loop inactive but festival_readiness will never move and the loop will appear "broken" by always being off.

---

## Stage 5 — Generator content

### Fix 5.1: Upgrade thin consequence profiles across 6 expanded families

**Problem.** Six expanded seed families produce consequence profiles using a repetitive thin template:

```javascript
const consequenceProfiles = responseSlots.map((slot) =>
  makeProfile({
    immediateEffects: [
      effect('cause', `<kind>:${target.id}`, slot.id === 'ignore...' ? -5 : 5, slot.labelHint, [...])
    ],
    delayedEffects: [],
    memories: [{ id: ..., actors: [ref], tags: [...] }],
    futureHooks: [],
  }),
)
```

The impact scorer at `src/sim/modules/issues/impactScoring.ts:34-52` weights `cause` effects 0.6×, memories add 3.2 each. A single cause @ amount 5 + 1 memory scores 6.2 → rounded 6. Every profile in the template scores identically regardless of which slot it represents. The pattern produces:

| Family | Profile count | Avg impact |
|---|---|---|
| area_atmosphere | 504 | 6.00 |
| rumour_crisis | 462 | 6.00 |
| rival_tavern | 168 | 6.00 |
| seasonal_arc | 174 | 6.33 |
| culture_conflict | 360 | 7.17 |
| faction_request | 102 | 8.17 |

Compared to the hand-crafted `staff_identity` profiles which average 18 because they use varied state_change effects at amounts 10-20.

Replace the thin template in each family with hand-crafted per-slot profiles that use `state_change` effects at meaningful magnitudes (12-25), stack 2-3 effects per profile, and include `futureHooks` for response shapes that imply delayed consequences.

**Files.** `src/sim/modules/issues/expandedSeedGenerators.ts` — the six generators. Find by:
- `area_atmosphere` profile builder around line 1343
- `rumour_crisis` around line 1822
- `rival_tavern` around line 1026 (one of two builders in the file)
- `seasonal_arc` builder (search for `'seasonal_arc'`)
- `culture_conflict` builder (search for `'culture_conflict'`)
- `faction_request` profile builder around line 1026 (the other one)

**What to change.**

For each family, replace the `responseSlots.map(...)` pattern with explicit per-slot profiles. Each profile should:

- Use `effect('state_change', '<path>', <amount>, ...)` for outcomes that actually move state. The state path follows the diff convention: `staff.<id>.<field>`, `areas.<id>.<field>`, `customers.<id>.<field>`, `coin`, `reputation.<axis>`, `pressures.<id>.value`.
- Use `effect('pressure', 'pressure:<id>', <amount>, ...)` for direct pressure shifts.
- Stack 2-3 effects per profile: primary outcome + cost/side effect.
- Use `delayedEffects` for things that resolve later (often a pressure shift).
- Add `futureHooks` entries for response shapes implying delayed consequences (`ignore`, `bribe`, `blame`).
- Increase magnitudes to the 10-25 range for primary effects.

**Concrete example — area_atmosphere:**

```javascript
const consequenceProfiles: ConsequenceProfile[] = [
  makeProfile({
    id: 'repair_area_profile',
    responseSlotId: 'repair_area',
    immediateEffects: [
      effect('state_change', `areas.${chosen.id}.condition`, 15, 'Condition restored', ['area']),
      effect('state_change', `areas.${chosen.id}.damage`, -15, 'Damage reduced', ['area']),
      effect('state_change', 'coin', -15, 'Repair cost', ['coin']),
    ],
    delayedEffects: [],
    memories: [
      { id: `area_repaired_${chosen.id}`, actors: [ref], tags: ['area', 'repair'] },
    ],
    futureHooks: [],
  }),
  makeProfile({
    id: 'clean_area_profile',
    responseSlotId: 'clean_area',
    immediateEffects: [
      effect('state_change', `areas.${chosen.id}.cleanliness`, 20, 'Area cleaned', ['area']),
      effect('state_change', `areas.${chosen.id}.smell`, -10, 'Smell reduced', ['area']),
    ],
    delayedEffects: [],
    memories: [
      { id: `area_cleaned_${chosen.id}`, actors: [ref], tags: ['area', 'cleaning'] },
    ],
    futureHooks: [],
  }),
  makeProfile({
    id: 'ignore_area_problem_profile',
    responseSlotId: 'ignore_area_problem',
    immediateEffects: [],
    delayedEffects: [
      effect('pressure', 'pressure:maintenance', 8, 'Maintenance pressure rises', ['pressure']),
      effect('state_change', `areas.${chosen.id}.condition`, -5, 'Slow decay', ['area']),
    ],
    memories: [
      { id: `area_ignored_${chosen.id}`, actors: [ref], tags: ['area', 'neglected'] },
    ],
    futureHooks: [
      { id: `area_collapse_risk_${chosen.id}`, actors: [ref], tags: ['area', 'risk'] },
    ],
  }),
  // ... continue for delay_repair, rebrand_area
]
```

Apply the same pattern to:
- **rumour_crisis**: use `reputation.<axis>` state changes and `pressures.rumour_pressure.value` effects
- **rival_tavern**: use `customers.<group_id>.patronage` and `coin` state changes
- **seasonal_arc**: state changes tied to arc-relevant meters (depends on the arc subtype)
- **culture_conflict**: use `cultures.<id>.tension` if the calculator supports it; otherwise pressure effects
- **faction_request**: use `factions.<id>.relationship` (via `modifyFaction`) and coin

**Acceptance.**
- Average impact per profile across all expanded families ≥ 18 (up from ~10).
- Expanded social_consequence_quality score ≥ 70.
- Core response_impact score moves from 17 toward 30 (the threshold question is deferred to the next pass).

**Complexity:** L. ~30 profiles to rewrite across 6 families. Roughly 400-500 lines of careful content work. Each family should be a separate commit so failures can be bisected.

**Recommended order:** area_atmosphere → faction_request → rumour_crisis → rival_tavern → culture_conflict → seasonal_arc. Earlier families are simpler (single-target effects); later ones touch more cross-system state.

---

### Fix 5.2: Add picker rotation to expanded seed generators

**Problem.** Every expanded seed generator's "chosen entity" picker is deterministic argmax over slow-moving state. The pattern:

```javascript
let chosen = candidates[0]!
let chosenScore = -Infinity
for (const c of candidates) {
  if (c.someScore > chosenScore) {
    chosenScore = c.someScore
    chosen = c
  }
}
```

Examples in `src/sim/modules/issues/expandedSeedGenerators.ts`:
- Staff picker at line 135
- Regulars picker at line 411
- Suppliers picker at line 689
- Factions picker at line 956
- Cultures picker at line 1108
- Areas picker at line 1261
- Arcs picker at line 1423

No tie-breaking, no recency penalty. With slow-moving meters, the same entity wins every day for the entire run. Empirically: 16 of 17 active families have `distinct=1` for primaryActor across an 84-day run.

Add a recency penalty.

**Files.**
- `src/sim/modules/issues/expandedSeedGenerators.ts` — modify each picker
- `src/sim/modules/issues/issueSeedTypes.ts` or wherever the issueSeeds module state shape lives — add a `recentPicks` field

**What to change.**

1. Extend the issueSeeds module state to include:
   ```typescript
   recentPicks: Record<string, Record<string, number>>  // family → entityKey → lastDay
   ```
   Update the state schema and initial state factory accordingly.

2. Add a helper near the top of `expandedSeedGenerators.ts`:
   ```typescript
   const RECENCY_WINDOW_DAYS = 5
   const RECENCY_PENALTY = 25

   function recencyPenalty(
     state: TavernState,
     family: string,
     entityKey: string,
     today: number,
   ): number {
     const slice = state.modules.issueSeeds as
       | { recentPicks?: Record<string, Record<string, number>> }
       | undefined
     const familyPicks = slice?.recentPicks?.[family] ?? {}
     const lastDay = familyPicks[entityKey]
     if (lastDay === undefined) return 0
     if (today - lastDay >= RECENCY_WINDOW_DAYS) return 0
     return RECENCY_PENALTY
   }

   function recordPick(
     ctx: SimContext,
     family: string,
     entityKey: string,
   ): void {
     const today = ctx.state.calendar.totalDaysElapsed
     ctx.modifyModuleState('issueSeeds', (current) => {
       const slice = current as { recentPicks?: Record<string, Record<string, number>> } | undefined
       const recent = { ...(slice?.recentPicks ?? {}) }
       recent[family] = { ...(recent[family] ?? {}), [entityKey]: today }
       return { ...(slice ?? {}), recentPicks: recent } as never
     }, { source: 'expandedSeedGenerators.recordPick' })
   }
   ```

3. In each of the seven pickers, apply the penalty to the score:
   ```javascript
   const today = ctx.state.calendar.totalDaysElapsed
   for (const c of candidates) {
     const ref = candidateRef(c.id)  // or whatever the ref constructor is
     const baseScore = /* existing scoring logic */
     const penalty = recencyPenalty(ctx.state, '<family_id>', refKey(ref), today)
     const score = baseScore - penalty
     if (score > chosenScore) {
       chosenScore = score
       chosen = c
     }
   }
   ```
   The `<family_id>` should be the seed family name (`staff_identity`, `culture_conflict`, etc.).

4. After picking, before returning the seed, call `recordPick(ctx, '<family_id>', refKey(chosenRef))`.

**Acceptance.** After an 84-day gate run, each family with at least 3 candidate entities (staff, suppliers, cultures, factions, customer_groups) shows `distinct >= 3` distinct primaryActors. Audit's `overusedFamilies` count drops meaningfully.

**Complexity:** M. Module state addition + ~10 lines per picker × 7 pickers.

**Note:** This won't push the named_entity_repetition audit score over 70 by itself — the audit's absolute `count >= 6` threshold is structurally unreachable for sustained runs (audit-side calibration issue, deferred to next pass). But the actual narrative diversity improves substantially, which is the real goal.

---

### Fix 5.3: Stop using singleton `system:*` refs as `primaryActor`

**Problem.** Several seed generators use synthetic `system:*` or `tavern_identity:*` refs as `primaryActor`. These pollute the repetition audit's overused-entity list because there's only ever one `system:inspector`, one `system:landlord`, etc. — they can't be diversified.

Examples in the run:
- `system:inspector` — 168 uses (inspection family)
- `system:reputation` — 70 uses (reputation_shift family)
- `system:landlord` — 58 uses (debt_rent family)
- `tavern_identity:the_crooked_keg` — 231 uses (rumour_crisis when target defaults to tavern)

**Files.**
- `src/sim/modules/issues/issueSeedGenerators.ts` — inspection, reputation_shift, debt_rent generators
- `src/sim/modules/issues/expandedSeedGenerators.ts` — rumour_crisis generator

**What to change.**

Audit each generator and decide per-family:

- **Option A: Use a real-world entity as primary.** Example: inspection family → use `town_watch` faction as primary (town_watch IS the inspecting authority — confirmed in `src/sim/content/factions/factionRegistry.ts`).
- **Option B: Omit `primaryActor` entirely.** This is what `area_atmosphere`, `maintenance`, and `stock_shortage` already do. The seed shape allows `primaryActor` to be absent.

**Recommended per family:**

- `inspection`: use `factionRef('town_watch')` as primary (Option A).
- `reputation_shift`: omit `primaryActor` (Option B) — reputation is genuinely global.
- `debt_rent`: omit `primaryActor` (Option B) — no landlord entity exists; either add one or accept that this family has no character. Omit is simpler.
- `rumour_crisis`: when the rumour subject is `tavern_identity`, omit `primaryActor`; when it's a real entity (supplier/staff/faction/regular), keep it as primary.

Make the corresponding changes in each generator.

**Acceptance.** After an 84-day gate run, no `system:*` or `tavern_identity:*` refs appear in `overusedEntities` from the repetition audit.

**Complexity:** S-M. Per-family decisions + small change per generator. ~5 generators, ~10 lines each.

---

## Stage 6 — Optional balance touch-up

### Fix 6.1: Tighten weekly faction memory creation triggers

**Problem.** The faction memory writers in `src/sim/modules/weekly/community.ts:822-848` require `trend.satisfactionDelta >= 3` or `trend.tensionDelta >= 2`. The weekly trend's delta is clamped at MAX_SATISFACTION_DELTA=5 and MAX_TENSION_DELTA=5 (`:68-69`), so the writers can fire, but only when several conditions align. In runs where Stage 1 fixes have landed but factions aren't actively engaged by owner inputs, faction memories may still stay at 0.

This is a marginal fix — only apply if `entity_memory_quality` audit is still under 70 after Stages 1-5.

**Files.** `src/sim/modules/weekly/community.ts:822-848`.

**What to change.**

Lower the thresholds:
- Line ~823: `if (trend.satisfactionDelta >= 3)` → `>= 2`
- Line ~836: `if (trend.tensionDelta >= 2)` → `>= 1`

**Acceptance.** `factionMemories >= 1` after an 84-day gate run.

**Complexity:** S. 2 number changes.

**Note:** Before applying, check the entity memory quality audit score after Stages 1-5. If it's already above 70, skip this fix — the marginal benefit isn't worth the noise it adds to faction memory production.

**Outcome (post Stages 1–5).** Measured `entity_memory_quality.score = 72`
on the 84-day cardless run (`buildExpandedReadinessReport({ days: 84 })`,
seed `phase40-expanded-readiness-anchor`): 15 entity memories, 10 with
owners, 15 with real targets, 4 strong, category breakdown
`{ staff: 3, regular: 0, supplier: 1, faction: 0, area: 1, arc: 3 }`. Score
already clears the 70 threshold, so this fix was deliberately **not
applied** per the note above. Faction- and regular-memory shortfalls
remain visible but are deferred to the next pass alongside the audit
calibration items already listed under "Out of scope".

---

## Expected metric movement after pass 1

Projections based on the scoring formulas. Directional, not exact.

| Metric | Today | Projected | Passes? |
|---|---|---|---|
| identity_richness | 25 | ~95 | ✓ |
| entity_memory_quality | 69 | ~78 | ✓ |
| attribution_quality | 65 | 65+ | ✓ |
| expanded_pressure_quality | 68 | ~80 | ✓ |
| expanded_seed_coverage | 100 | 100 | ✓ |
| text_ingredient_quality | 87 | 87 | ✓ |
| named_entity_repetition | 28 | ~50 | ✗ (audit calibration, next pass) |
| arc_and_calendar_use | 100 | 100 | ✓ |
| social_consequence_quality | 63 | ~75 | ✓ |
| expanded_contradiction_safety | 100 | 100 | ✓ |
| core.cause_coverage | 0 | 60-80 | likely ✓ |
| core.response_impact | 17 | ~30 | ✗ (threshold calibration, next pass) |
| core.strategy_diversity | 62 | 62 | ✗ (next pass) |

Three metrics likely remain failing after pass 1: `named_entity_repetition`, `core.response_impact`, `core.strategy_diversity`. Each is an audit-side calibration issue rather than a content/structural fix. The next pass will reconcile audit definitions, recalibrate thresholds against the new content, and address the cardless-run "abandoned tavern" baseline question.

## Out of scope (deferred)

These are known concerns but belong with the audit/testing redesign in the next pass:

- The audit's `NAMED_ENTITY_KINDS` set excludes `area` and `customer_group`. Adding them is one line in `expandedReadinessReport.ts:816` but the right time is when the audit definitions get reconciled across multiple readers.
- The `overused` entity threshold of `count >= 6` is absolute, not proportional. Structurally unreachable for sustained runs even with perfect rotation.
- The cardless gate run uses no `chooseInput`, producing an "abandoned tavern" scenario where customer satisfaction crashes to 0 in week 1. Many cascading audit failures stem from this baseline. Decision needed: does the gate evaluate against a no-input baseline or a policy-bot run?
- `core.response_impact` threshold is set to 70 — calibrated to the "MONTHLY" tier in `IMPACT_THRESHOLDS`, which no single profile reaches. Either the bar is aspirational or the threshold needs recalibration.
- Engine helpers (Fix 1.2) emit causes in the diff-path convention. The 20+ existing manual `ctx.addCause(...)` sites still use the colon convention. Both work; reconciliation can wait.
- Customer-group initial state (patronage values 65, 45, 25, 20, 15) pins strategy diversity outcomes. Weekly trend deltas (clamped at ±2) can't credibly flip dominance in 28 days. Either rebalance initial values, widen trend deltas, or lengthen the strategy matrix window.
