# Goblin Tavern Issue Tracker

Working source of truth for the post-Phase-40 repair pass. Each entry is a
problem-bundle: cross-cutting fixes for one feature or subsystem, scoped to
land as a single phase. Phase docs reference issue IDs and stay short; this
file holds the full description of what's broken, what needs to change, and
how to verify the fix.

## How to use this tracker

- **Issue IDs are stable.** Even if scope shifts or an issue gets split,
  never renumber. Cross-references in phase docs depend on stability.
- **Update status inline.** Edit the Status field as work progresses.
  When done, leave the entry in place — closed issues are history, not
  noise.
- **Dependencies are hard.** A `depends-on` issue must reach `done` before
  dependent work starts. If a dependency turns out to be wrong, fix it in
  the tracker before starting work.
- **Scope describes shape, not size.** What changes, not how big. No line
  counts. Phase docs may add detail; this file should not.
- **Test approach describes observable behavior change.** Not "add tests" —
  "what state mutation, attribution flow, or report output proves the fix
  worked end-to-end."
- **Numbered order = suggested sequencing.** Lower numbers should generally
  land first. Independent branches (e.g. core-slice roster grows) can be
  worked in parallel.

## Status legend

- `open` — not started
- `in-progress` — phase assigned, work underway
- `done` — phase merged, tests passing, behavior verified against the
  evidence in the issue entry
- `deferred` — known issue, consciously skipped this repair pass

## Issue index

| ID | Title | Grade | Status | Phase |
|---|---|---|---|---|
| ISSUE-001 | Response pipeline + unified pending queue | broken | done | 41 |
| ISSUE-002 | World mutator cause emission + state diff coverage | thin | open | — |
| ISSUE-003 | Per-cause `relatedActors` in 4 silent calculators | broken | open | — |
| ISSUE-004 | NPC factory + initial notable NPC roster | broken | open | — |
| ISSUE-005 | Grow staff roster + role-specific identity | thin | open | — |
| ISSUE-006 | Grow areas roster + un-pin `main_room` | thin | open | — |
| ISSUE-007 | Grow stock items roster | thin | open | — |
| ISSUE-008 | Grow customer groups roster | thin | open | — |
| ISSUE-009 | Grow suppliers roster + specialty category | thin | open | — |
| ISSUE-010 | Grow cultures + cross-cutting cultures + tag alignment | thin | open | — |
| ISSUE-011 | Lift regular cap + add starter regulars | thin | open | — |
| ISSUE-012 | Add niche factions + factionUpdate triggers for missing 2 | thin | open | — |
| ISSUE-013 | `policy_backlash` family end-to-end | broken | open | — |
| ISSUE-014 | `regular_customer` family end-to-end | broken | open | — |
| ISSUE-015 | `reputation_shift` family rewrite | broken | open | — |
| ISSUE-016 | `violence` family rewrite + rotation | broken | open | — |
| ISSUE-017 | `staff_burnout` family rewrite + rotation | broken | open | — |
| ISSUE-018 | `inspection` family un-pinning | thin | open | — |
| ISSUE-019 | `monthly_review` design decision + implementation | design | open | — |
| ISSUE-020 | `activeIssueSeedTags` consumer wiring | thin | open | — |
| ISSUE-021 | Calendar tag consumers (priority: `rent_due_soon`) | thin | open | — |
| ISSUE-022 | History log pruning policy | thin | open | — |
| ISSUE-023 | RNG stream prune or wire | thin | open | — |
| ISSUE-024 | Thin family profile depth + core picker rotation | thin | open | — |

---

## Tier 0 — Infrastructure

The three tier-0 issues unblock most downstream work. They are mutually
independent and could be worked in parallel, but the suggested order
prioritizes leverage: response wiring unblocks the most features.

### ISSUE-001 — Response pipeline + unified pending queue

- **Grade:** broken
- **Status:** done
- **Phase:** 41
- **Evidence:**
  - `src/sim/modules/responses/responseResolver.ts:277` — pure transform
    that takes state + seed + intent and returns a new state. Called from
    3 unit/integration tests only; no module ever invokes it.
  - No `applyResponses` phase slot in `src/sim/core/phases.ts`. No
    `responsesModule.ts` under `src/sim/modules/responses/`.
  - `responseResolver.ts:90-213` — the resolver applies 2 of the 5
    declared `EffectKind` values. `cause`, `memory`, and `future_hook`
    effects return `{ applied: false, notes: ['non-state effect, recorded
    only'] }` and produce no state mutation.
  - `responseResolver.ts:311-321` — `delayedEffects` and `futureHooks`
    are collected into the result tuple and discarded by every caller.
- **Impact:** Every issue seed's response slots and consequence profiles
  are decorative. A player (or future card UI) can pick a response, the
  seed has 4-11 well-shaped slots, and the choice has zero effect on
  simulation state. Several seed families lean on `effect('cause', ...)`
  as their primary content; those effects are no-ops even if the
  resolver were wired.
- **Scope:**
  - Add `responsesModule` consuming `ctx.input.responseIntents`,
    registered on a new `applyResponses` phase slot (suggested placement:
    between `closing` and `endDay`).
  - Add `state.modules.responses.pending` slot holding both delayed-effect
    and futureHook records, drained on `startDay` via a new
    `pendingDrain` hook. Each entry carries `kind`, `origin`,
    `scheduledFor`, `expiresAt`, `payload`, optional `preconditions`.
  - Extend the resolver to dispatch all 5 effect kinds. Effects of kind
    `cause`, `memory`, `future_hook` should mutate state via the same
    paths the profile-level arrays use.
  - `SimInput` gains optional `responseIntents?: ResponseIntent[]`.
- **Depends on:** none
- **Test approach:** Test calls `simulateDay` with a `responseIntents`
  array selecting one slot of an active seed. Verify (a) immediate
  effects landed in state, (b) entries with future `scheduledFor`
  appear in `state.modules.responses.pending` and not in state yet,
  (c) advancing to `scheduledFor` day applies them, (d) entries past
  `expiresAt` drop with a log entry, (e) `immediateEffects` containing
  `effect('cause', ...)` produces a cause in `state.causes`.
- **Why this is first:** Largest single unblock. Roughly 50 of 70 hook
  IDs in the codebase have time or precondition semantics that depend
  on this queue existing.

### ISSUE-002 — World mutator cause emission + state diff coverage

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/core/engine.ts` core mutators (`modifyArea`, `modifyStock`,
    `modifyStaff`, `modifyCustomerGroup`) emit one cause per changed
    field via `emitDiffPathCausesForRecord`.
  - `src/sim/core/engine.ts` world mutators (`modifyCulture`,
    `modifyFaction`, `modifySupplier`, `modifyRegular`, `modifyNotableNpc`,
    `modifyLocalEvent`, `modifySocialRumour`, `modifyTavernIdentity`)
    emit one aggregate cause per call via `addCauseInternal`, regardless
    of how many fields changed.
  - `createStateDiff` walks 8 slices: `coin`, `areas`, `stock`, `staff`,
    `customerGroups`, `reputation`, `pressures`, `memoriesCount`. It
    skips `state.world.*`, `state.modules.*`, `state.causes`,
    `state.calendar`, `state.meta`, `state.attribution`.
- **Impact:** A culture relationship shift, supplier reliability drop,
  faction tension change, or any module-slice update doesn't appear in
  the per-day `StateDiff.changes[]` array. Cause-coverage checks that
  rely on `cause.target === change.path` lookups can't see world
  mutations because the diff side is empty for those slices.
- **Scope:**
  - Apply `emitDiffPathCausesForRecord` to the 8 world mutators,
    matching the core-mutator pattern. One cause per changed field on
    a single `modify*` call.
  - Extend `createStateDiff` to walk `state.world.*` (per id, per field
    on record-typed slices) and `state.modules.*` (per slice, per key).
  - Verify the cause-coverage output in `expandedReadinessReport.ts`
    now credits world-entity mutations.
- **Depends on:** none
- **Test approach:** Mutate a culture, supplier, faction in a test;
  verify (a) one cause per changed field appears in `state.causes`,
  (b) the matching diff entries appear in `getDiff('owner_actions')`,
  (c) cause-coverage credits the change.
- **Why bundled:** Fixing one without the other emits causes without
  diff entries to match them, or walks the diff to find changes that
  haven't been attributed. Both halves are needed for the
  cause-coverage check to work.

### ISSUE-003 — Per-cause `relatedActors` in 4 silent calculators

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/pressures/calculators/arcEscalation.ts` — 7
    `pushCause` sites, all with empty `relatedActors`. The arc ref is
    available locally at line 42.
  - `src/sim/modules/pressures/calculators/policyBacklash.ts` — 5
    `pushCause` sites, all with empty `relatedActors`. The policy and
    customer-group refs are available at lines 51-55.
  - `src/sim/modules/pressures/calculators/marketInstability.ts` — 6
    `pushCause` sites, all with empty `relatedActors`. No actor refs
    available in current scope; needs upstream supplier module to pass
    them through.
  - `src/sim/modules/pressures/calculators/festivalReadiness.ts` — 10
    `pushCause` sites, all with empty `relatedActors`. The arc ref is
    available locally at line 42.
  - `src/sim/modules/localArcs/arcEffects.ts:73-94` — same shape:
    raw cause object built without `relatedActors` despite `arc.id`
    being in scope.
- **Impact:** Causes from these four calculators carry no actor
  attribution. Attribution propagation skips them; entity memories
  don't accumulate from arc, policy, market, or festival sources;
  downstream consumers reading those entity memories find nothing.
- **Scope:**
  - Attach `relatedActors: [refsAvailableInScope]` to each `pushCause`
    call in the four calculators. Three are mechanical (refs are local).
  - `marketInstability` requires `src/sim/modules/suppliers/supplierModule.ts`
    to pass affected supplier refs into the calculator's context.
  - Add `relatedActors: [{ kind: 'local_event', id: arc.id }]` to the
    raw cause write in `arcEffects.ts:73-94`. Same fix shape.
- **Depends on:** none
- **Test approach:** Run a simulated month; verify each of the four
  calculators' causes now carries non-empty `relatedActors`. Verify
  arc / policy / market / festival entities accumulate attribution
  entries in `state.attribution` and that those entities appear in
  the named-entity-repetition report as expected.

### ISSUE-004 — NPC factory + initial notable NPC roster

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/content/npc/npcFactory.ts` — entire file is a placeholder
    comment plus `export {}`. No factory function exists.
  - `state.world.notableNpcs` schema is defined (`TavernState.ts:540`,
    `defaults.ts:439` initializes to `{}`).
  - 8 readers of the `notable_npc` ref kind across pressure, feedback,
    weekly, service, issues, and causes modules. Every code path that
    branches on `notable_npc` ref kind is unreachable in practice.
  - At least one orphan seed hook (`town_watch_advisor`) currently has
    nothing to bind to.
- **Impact:** Roughly 8 systems contain code that can never execute
  because no notable NPC ever exists in state. The
  `notable_npc_repetition` axis of the named-entity-repetition report
  is mathematically zero.
- **Scope:**
  - Implement `createNotableNpc(rng, profile, ...)` in
    `src/sim/content/npc/npcFactory.ts`.
  - Define 6-10 starter notable NPCs across factions: a town watch
    inspector, a rival owner, a moneylender, a town gossip, a fence,
    a priest, a merchant prince, a captain of the watch. Each carries
    name, culture, faction membership, area affinity, initial state.
  - Seed them at simulation start via a `defaults.ts` initializer.
  - Add at least one seed family hook that binds to a notable NPC
    (the orphan `town_watch_advisor` is the obvious candidate).
- **Depends on:** ISSUE-002 (NPCs are world entities; their mutations
  should emit per-field causes from day one).
- **Test approach:** Start a fresh simulation, verify
  `state.world.notableNpcs` has the seeded entries, run a month,
  verify at least one seed family binds to a notable NPC ref and
  resolves through validation, verify `notable_npc:` keys appear in
  the named-entity-repetition report.

---

## Tier 1 — Roster grows

These add the content density the picker needs to stop saturating the same
entities every day. Core-slice grows (staff, areas, stock, customer groups)
have no infrastructure dependency; world-slice grows depend on ISSUE-002.

The overuse threshold used in evidence below is 6+ hits per actor per 28
days from the named-entity-repetition report. Where a current hit count is
cited, it's the count observed on the most recent 28-day audit run.

### ISSUE-005 — Grow staff roster + role-specific identity

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/registries/staffRegistry.ts:41,65,89` — 3 roles only
    (`cook`, `server`, `cleaner_bouncer`).
  - 28-day named-entity-repetition: `staff:server = 56` hits (2.0/day,
    ~10× the overuse threshold).
  - With perfect round-robin across 3 roles, each staff member fires
    ~9× per 28 days — still above threshold.
- **Impact:** Picker has nowhere to rotate to. Penalties (overuse,
  recency) bite on every pick because every alternative is also above
  threshold. `staff_identity` family can't escape repetition.
- **Scope:** Add 5-7 staff roles (e.g. host, kitchenhand, runner,
  doorkeeper, specialist musician, second cook, swing-shift bouncer).
  Each carries a full identity profile in 3+ naming cultures, distinct
  stat profile, signature pressures, and contributes at least one
  role-specific incident family element.
- **Depends on:** none (staff is a core slice with per-field cause
  emission already correct)
- **Test approach:** Run a 28-day simulation; verify no single staff
  member is picked more than ~6 times. Confirm `staff_identity` family
  rotates across the grown roster via the existing recencyPenalty
  primitive.

### ISSUE-006 — Grow areas roster + un-pin `main_room`

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/registries/areaRegistry.ts:32,49,66,83,100` — 5 areas
    (`main_room`, `kitchen`, `cellar`, `privy`, `roof`).
  - 28-day hit count: `area:main_room = 52`.
  - 8 hardcoded `areaRef('main_room')` writes in
    `src/sim/modules/issues/issueSeedGenerators.ts:989,1734,1811,1996,2076,2564,2710`
    plus 1 in expandedSeedGenerators. Three different use modes:
    `location:`, `targetOptions:`, response slot fallback.
- **Impact:** Even growing the roster doesn't help atmosphere /
  maintenance / violence seeds because they pin `main_room` directly,
  not pick through state. Roster grow + pin removal must land together
  to actually spread area usage.
- **Scope:**
  - Add 4-6 areas: a back patio or garden, a private booth area, a
    stage corner, a beer cellar separate from food cellar, a yard or
    stable. Each gets cleanliness, comfort, condition fields plus
    candidate traits/upgrades.
  - Remove the 8 hardcoded `areaRef('main_room')` writes. Replace each
    with picker-driven area selection where the seed is
    location-agnostic, or with state-driven rotation where the seed
    targets a specific area type.
- **Depends on:** none (areas is a core slice)
- **Test approach:** Verify `area:main_room` hit count drops from 52 to
  roster-proportional (~10 per 28 days). Verify `area_atmosphere`,
  `maintenance`, `inspection` seed families rotate across the grown
  roster rather than always selecting `main_room`.

### ISSUE-007 — Grow stock items roster

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:** `src/sim/registries/stockRegistry.ts:27,40,53,66,86,99`
  — 6 items (`ale`, `stew`, `ingredients`, `mushrooms`, `firewood`,
  `mugs`).
- **Impact:** Menu narrative breadth is 6 items. Every "what should I
  serve at the festival" decision points at the same six. Specialty
  drinks, multiple food items, seasonal items are all absent. Stock
  isn't a named-entity-repetition target, so there's no hit-count
  number to cite — the gap is gameplay variety, not picker saturation.
- **Scope:** Add 4-6 stock items: a second ale variant (cheap vs
  premium), a soup or bread food alternate to stew, a snack item
  (nuts, pickles), candles, a specialty drink tied to one culture.
  Each gets full price tier, spoilage profile, supplier tag.
- **Depends on:** none (stock is a core slice)
- **Test approach:** Verify festival, event, and owner-action surfaces
  that read stock now have variety in generated targets. Verify the
  new items participate in shortage and quality memory writes through
  existing service and supplier paths.

### ISSUE-008 — Grow customer groups roster

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/registries/customerRegistry.ts:46,86,126,166,206` — 5
    groups (`local_goblins`, `miners`, `merchants`, `ogres`,
    `adventurers`).
  - 28-day hit counts: `local_goblins = 34`, `merchants = 32`,
    `miners = 30`. All groups saturate the per-entity cap.
- **Impact:** The 5 groups cover the main archetypes (locals, labour,
  wealth, muscle, wandering) but leave gaps: no fringe group, no
  time-of-day-specific group, no faction-aligned visitor. The picker
  has no untainted alternative.
- **Scope:** Add 3-4 groups with sharper trade-offs: a "tips well but
  high-maintenance" group, a "violent but profitable" group, a
  "low-spend but boosts other groups" social attractor, a
  faction-on-duty group (e.g. `town_watch_on_shift`). Each carries
  `preferredStockTags`, `dislikedTags`, `cultureId`,
  satisfaction/loyalty/patronage profile.
- **Depends on:** none (customer groups is a core slice)
- **Test approach:** Verify the new groups appear as primary actors in
  appropriate seed families, the picker rotates across the grown set
  with the per-group hit count dropping into the roster-proportional
  range, and at least one group's `dislikedTags` interaction creates
  a memory observable in tests.

### ISSUE-009 — Grow suppliers roster + specialty category

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/content/suppliers/supplierRegistry.ts:20,33,46,59` — 4
    suppliers, one per category (mushrooms, ale, grain, meat).
  - 28-day hit count: `supplier:brakka_mushroom_cart = 35` (highest
    single-supplier count).
  - One supplier per category means there's no actual switching
    choice. Switching `brakka_mushroom_cart` means losing mushrooms
    entirely.
- **Impact:** The `supplier_distrust` pressure's recommendation to
  "switch to alternate" has nowhere to switch to. The
  `supplier_relationship` family fires but its "negotiate with
  supplier" and "switch supplier" responses are phantom options.
- **Scope:** Add a second supplier per existing category with
  deliberately different trade-offs (cheap-unreliable vs
  expensive-stable). Add one new category (suggest spices, herbs, or
  candles) with a single starter supplier. The "switch supplier"
  consequence option must now have a meaningful target.
- **Depends on:** ISSUE-002 (suppliers are world entities)
- **Test approach:** Verify `supplierDistrust` pressure's "switch to
  alternate" resolves to a real supplier in the same category. Verify
  `supplier_relationship` family rotates across the grown set rather
  than concentrating on `brakka_mushroom_cart`.

### ISSUE-010 — Grow cultures + cross-cutting cultures + tag alignment

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/content/cultures/cultureRegistry.ts:22,41,60,79,98` — 5
    cultures (`goblin_local`, `miner_workcrew`, `merchant_roadfolk`,
    `ogre_clans`, `adventuring_bands`). Each maps 1:1 to a customer
    group.
  - `src/sim/modules/pressures/calculators/culturalTension.ts:108-110`
    reads memory tags `cultural_misunderstanding`, `seating_conflict`,
    `food_taboo`. No producer in `src/sim/` writes any of these tags.
- **Impact:** The 1:1 culture-to-group mapping makes `culturalTension`
  essentially equivalent to `customer_group_friction` — same axis
  encoded twice. The three dead-read tags mean `culturalTension`
  rarely fires even when culture-group conditions would warrant it.
- **Scope:**
  - Add 3-5 cross-cutting cultures: a religious or regional overlay
    that spans multiple customer groups, an outsider culture that any
    group can have members from, a professional culture (e.g. guild
    membership) orthogonal to background.
  - Wire producers for the 3 dead tags: add memory writes from
    appropriate service or event paths that emit
    `cultural_misunderstanding`, `seating_conflict`, `food_taboo` so
    `culturalTension` has tag conditions to read.
- **Depends on:** ISSUE-002 (cultures are world entities)
- **Test approach:** Verify `culturalTension` fires in tests that
  produce the relevant tag conditions. Verify at least one
  cross-cutting culture has members across 2+ customer groups in
  generated state.

### ISSUE-011 — Lift regular cap + add starter regulars

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/state/defaults.ts:363-370` — 6 starter regulars across 5
    customer groups.
  - `src/sim/modules/regulars/regularModule.ts:51` —
    `MAX_REGULARS_PER_GROUP = 3`. Maximum 15 emergent regulars across
    the simulation, plus 6 starters.
- **Impact:** Realistic mid-run named-regular population is ~10-12.
  The `regular_customer` family rotates over this small pool, and
  inactive regulars never decay — once a slot is filled, no new
  regular can emerge there.
- **Scope:**
  - Lift `MAX_REGULARS_PER_GROUP` from 3 to 6-8.
  - Add a soft-decay rule so inactive regulars age out (visit recency
    plus irritation threshold) rather than a hard cap blocking
    emergence.
  - Add 4-6 more starter regulars, at least one tied to a faction or
    notable-NPC source rather than just a customer-group base.
- **Depends on:** ISSUE-002 (regulars are world entities)
- **Test approach:** Run a 90-day simulation; verify the regulars
  population reaches ~20-30 named entities across groups, that
  long-inactive regulars decay out of named state, that
  `regular_customer` family has a rotatable roster.

### ISSUE-012 — Add niche factions + factionUpdate triggers for missing 2

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/content/factions/factionRegistry.ts:15,30,44,58,72,86` —
    6 factions. Count is healthy; the gap is breadth.
  - `src/sim/modules/factions/factionModule.ts` — `factionUpdate`
    hook has 4 hardcoded trigger pairs (`town_watch ← violence`,
    `brewers_guild ← debt`, `market_caravan_circle ← stock_shortage`,
    `miners_union ← payday-satisfaction`). `local_shrine` and
    `scrap_collectors` get no module-driven drift.
- **Impact:** The two factions without trigger pairs have no source of
  state variation other than what seed generators and attribution
  rules do to them. They feel mechanically inert relative to the
  other four.
- **Scope:**
  - Add 2-3 niche factions (suggest a smugglers' ring, a noble house,
    a rival tavern's faction) for breadth and to support inspection
    rotation downstream.
  - Add `factionUpdate` trigger pairs for `local_shrine` (reacts to
    celebration, mourning, cultural events) and `scrap_collectors`
    (reacts to maintenance, waste, supply chain events) so all
    factions get module-driven drift.
- **Depends on:** ISSUE-002 (factions are world entities)
- **Test approach:** Run a simulated month with conditions matching
  each new trigger pair; verify `local_shrine` and `scrap_collectors`
  drift on those days. Verify the new factions appear in
  `state.world.factions` and as `faction_request` family targets.

---

## Tier 2 — Per-feature problem bundles

Each bundle delivers a working subsystem end-to-end. Most depend on tier 0
infrastructure plus the relevant tier 1 roster grow.

### ISSUE-013 — `policy_backlash` family end-to-end

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/expandedSeedGenerators.ts:4586-4605` — 6
    response slots collapsed through `responseSlots.map((slot) =>
    makeProfile({...}))`. Every profile has identical shape: one
    `effect('cause', ...)` and one memory entry; `delayedEffects: []`,
    `futureHooks: []`.
  - All 6 profiles' only effect is `effect('cause', ...)`. Per
    ISSUE-001's evidence, the resolver treats `cause`-kind effects as
    `applied: false`, so every choice is a no-op even after the
    resolver is wired.
  - `src/sim/modules/attribution/attributionRules.ts:415-417` — the
    `policyBacklashAttribution` rule filters on
    `direction === 'decrease'`. No module emits a `policy`-tagged cause
    with `decrease` direction (`policyBacklash.ts:39-99` causes default
    to `increase` because backlash raises a pressure metric, not
    lowers a relationship one).
- **Impact:** This is the most extreme thin-family case in the
  codebase: 6 different player choices, all producing identical-shape
  consequence drafts, all of which are no-ops. The slot labels
  (`keep_policy`, `modify_policy`, `repeal_policy`, `make_exception`,
  `explain_policy`, `punish_violation`) suggest meaningful gameplay
  variety; the implementation delivers none. The attribution junction
  failure compounds this: even if profiles were rewritten, the
  attribution rule that should propagate backlash into memories never
  fires.
- **Scope:**
  - Hand-write 6 distinct consequence profiles for the 6 slots. Each
    uses `state_change` and/or `pressure` effects (not `cause`). Each
    carries meaningful `delayedEffects` and `futureHooks`.
  - Remove the `direction === 'decrease'` filter from
    `policyBacklashAttribution` (the surgical fix; the alternative is
    rewiring `policyBacklash` to emit decrease-direction causes on a
    relationship target, which is more invasive).
  - ISSUE-003 covers the per-cause `relatedActors` work in
    `policyBacklash.ts`; don't duplicate.
- **Depends on:** ISSUE-001, ISSUE-002, ISSUE-003
- **Test approach:** Test enables a policy, lets backlash pressure
  rise, fires the seed, picks each of the 6 response slots in
  separate runs. Verify each pick produces a distinct state mutation
  (different reputation deltas, pressure shifts, memory writes,
  scheduled futureHooks). Verify `policyBacklashAttribution` rule
  generates entries in `state.attribution` when backlash causes are
  present.

### ISSUE-014 — `regular_customer` family end-to-end

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts:868,891` — double-gate
    on `regular_customer_loss < 25` and a second condition requiring
    `memories.length === 0 && irritation < 50 && loyalty > 40`.
  - `src/sim/modules/pressures/calculators/regularCustomerLoss.ts:70,83,99`
    reads memory tags `ignored_complaint`, `favorite_order`,
    `bad_reputation`. These tags are written by code paths inside the
    response resolver, which has not been running (ISSUE-001).
  - Family fires zero times in 90-day playtest runs.
- **Impact:** Even with the regulars cap lifted (ISSUE-011), the
  family remains gated. The pressure can't rise (dead tag reads), and
  even if it could, the irritation/loyalty thresholds combined with
  the "no existing memories" condition mean the family only fires for
  brand-new regulars in trouble — exactly the regulars who haven't
  accumulated the memories the pressure needs.
- **Scope:**
  - Verify ISSUE-001 wired up the resolver paths that produce the 3
    tags above. If any are still unproduced, add the missing write
    site to whichever module logically owns them.
  - Relax the second gate: it should fire on sufficiently
    negative-trending regulars regardless of memory presence. Drop
    the `memories.length === 0` precondition. Soften the
    irritation/loyalty thresholds (suggest `irritation > 30 OR
    loyalty < 60`).
  - Confirm the family rotates across the now-larger regulars roster
    (recencyPenalty is already wired).
- **Depends on:** ISSUE-001, ISSUE-011
- **Test approach:** Set up a state with a regular whose irritation
  has risen via service-failure memories. Verify the family fires
  within a 14-day window. In a longer run, verify the family rotates
  across multiple regulars. Verify each response slot produces a
  measurably different mutation to the target regular's loyalty,
  irritation, or patronage.

### ISSUE-015 — `reputation_shift` family rewrite

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `reputation_shift`
    family — 4 profiles, 0 `delayedEffects`, 1 `futureHook` total
    across all 4. Worst per-profile depth among shipped families.
  - Family picker deterministically selects the strongest reputation
    axis with no rotation primitive.
- **Impact:** When the family fires, the 4 response choices barely
  differentiate. There's no scheduling of consequences over time, no
  delayed faction reactions, no scheduled second-order effects. The
  family score in card-readiness reports sits at the bottom of all
  shipped families.
- **Scope:**
  - Hand-write 4 profiles with meaningful delayed effects. Examples:
    "lean into the rumor" → reputation-axis drift over 7 days; "publicly
    deny" → opposite-axis bump now plus cost a faction relationship
    in 14 days. Each profile gets at least one `futureHook`.
  - Add rotation: pick from the top-2 reputation axes by absolute
    deviation rather than always selecting the single strongest.
  - Use `state_change` and `pressure` effect kinds.
- **Depends on:** ISSUE-001
- **Test approach:** Verify the family fires across both reputation
  axes that meet the threshold, not just the strongest. Each response
  slot produces a different reputation trajectory over the following
  14 days. At least 2 delayed effects per profile fire on schedule.

### ISSUE-016 — `violence` family rewrite + rotation

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `violence` family —
    4 profiles, 0 `delayedEffects`, 1 `futureHook` total.
  - Picker selects whichever of `ogres` or `adventurers` has higher
    current patronage. No other groups can trigger.
- **Impact:** Violence is a major escalation surface that currently
  has no temporal weight — the immediate effects fire and the seed
  ends. No "the watch shows up tomorrow" delayed consequence, no
  "staff is shaken for a week" stress buildup, no "regular customers
  start avoiding the tavern" downstream effect.
- **Scope:**
  - Hand-write 4 profiles with delayed consequences. Examples:
    "intervene personally" → injury memory plus faction respect in 3
    days; "call town watch" → faction memory plus customer-group
    distrust in 7 days; "have staff handle" → staff stress plus a
    staff skill memory.
  - Add rotation across the customer groups grown in ISSUE-008.
    Trigger condition becomes "any group with elevated tension," not
    just ogres/adventurers.
- **Depends on:** ISSUE-001, ISSUE-008
- **Test approach:** Set up multiple customer groups with elevated
  tension levels; verify the family rotates across them rather than
  always picking the same one. Each response slot produces distinct
  state mutations including delayed consequences that fire on the
  scheduled day.

### ISSUE-017 — `staff_burnout` family rewrite + rotation

- **Grade:** broken
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `staff_burnout`
    family — 4 profiles, 1 `delayedEffect`, 1 `futureHook` total.
  - Picker selects the single highest-stress staff member; no
    rotation across the staff above a stress threshold.
- **Impact:** Same staff member targeted every day they're stressed;
  responses lack meaningful temporal consequences (no "burnout
  resolves over 3 days," no "staff quits in 14 days if ignored," no
  "morale spreads to other staff").
- **Scope:**
  - Hand-write 4 profiles with delayed consequences. Examples: "give
    time off" → stress recovery plus a coverage-gap memory; "raise
    pay" → immediate stress reduction plus scheduled budget pressure;
    "do nothing" → quit-risk hook in 7-14 days; "reassign duties" →
    cross-staff stress redistribution.
  - Add rotation: pick from staff members above the stress threshold
    via `recencyPenalty`, not always the single highest.
- **Depends on:** ISSUE-001, ISSUE-005
- **Test approach:** Set up state with multiple staff above stress
  threshold; verify rotation across them in a 14-day window. Each
  response produces distinct stress, loyalty, and budget effects
  including scheduled futureHooks.

### ISSUE-018 — `inspection` family un-pinning

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts:2043-2056` — the
    `inspection` family hardcodes `town_watch` as primary actor and
    pins `scrap_collectors` plus `local_shrine` as cross-faction
    support refs on every inspection seed. A comment at those lines
    acknowledges the workaround.
  - 28-day hit counts: `faction:town_watch = 66` (most-overused
    entity in the simulation); `faction:scrap_collectors = 34`;
    `faction:local_shrine = 31`.
- **Impact:** Even with the faction roster grown (ISSUE-012),
  inspection seeds will continue saturating these three factions
  because the pin bypasses the picker entirely.
- **Scope:** Remove the three hardcoded faction pins. Replace with
  picker-driven faction rotation using `recencyPenalty`, allowing
  any faction whose tags include `authority`, `regulation`, or
  `enforcement` to act as primary. Cross-faction support refs are
  picked from the remaining faction set, not hardcoded.
- **Depends on:** ISSUE-012
- **Test approach:** Run a 28-day simulation; verify
  `faction:town_watch` hit count drops from 66 to a
  roster-proportional number (~10-15). Other factions appear as
  inspection primary actors in rotation.

### ISSUE-019 — `monthly_review` design decision + implementation

- **Grade:** design
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/monthly/monthlyModule.ts:556` — gate
    `endDay === calendar.day` means the family only fires on
    month-boundary days.
  - `src/sim/modules/issues/issueSeedValidation.ts:404,415,428,441` —
    4 special-case bypasses for `seed.type === 'monthly_review'` to
    skip the 2-response / consequence / memory / stake requirements.
  - Family has empty `responseSlots`, empty `consequenceProfiles`, no
    memories, no hooks. It's currently a structured report, not a
    card.
- **Impact:** Every month-end is a meaningful decision point
  (landlord, rent, reserves, rival, reputation, staff retention) but
  the simulation currently emits a report and moves on. No player
  agency at month boundaries.
- **Scope:**
  - **Decision required first.** Two paths:
    - **(a) Keep as report.** Drop the family from card-readiness
      scoring. Leave the 4 validator bypasses in place. Lower-effort.
    - **(b) Promote to a card family.** Add 3-4 strategic decision
      slots, give each profiles with meaningful state mutations.
      Remove the 4 validator bypasses.
  - Recommended path: (b). Example slots: "Pay landlord on time vs.
    invest in the cellar"; "Hold the season's reserves vs. expand
    staff"; "Settle with the rival tavern vs. press the feud." Each
    slot's profile uses `state_change` and `pressure` effects and at
    least one delayed effect.
- **Depends on:** ISSUE-001 (only if path (b) chosen)
- **Test approach:** Run a simulation across a month boundary. If
  promoted, verify the family fires once per month and that response
  slots produce distinct multi-week consequences. If kept as report,
  verify the report still reaches its sink and the validator bypasses
  cover it cleanly.

---

## Tier 3 — Polish and wire-the-consumer

Independent items with minimal dependencies. Slot in opportunistically
between bigger phases.

### ISSUE-020 — `activeIssueSeedTags` consumer wiring

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/localArcs/localArcsModule.ts:143` — writes
    `slice.activeIssueSeedTags` (a sorted Set) on every tick from
    arc-emitted `issue_seed_tag` effects.
  - `grep -rn "activeIssueSeedTags" src/sim/modules/issues/` returns
    zero matches. No seed generator filters on, branches on, or reads
    these tags.
- **Impact:** Active arcs declare which tag-families they want
  amplified (e.g. a `mushroom_blight` arc emits
  `supplier_suspicious_goods`, `stock_shortage`, `food_quality`).
  None of those amplifications flow through to seed ranking. The
  signal is computed and dropped.
- **Scope:** Add a ranking bonus in
  `src/sim/modules/issues/issueSeedRanking.ts:computeCardWorthiness`
  when `seed.domain` or `seed.causes[*].tags` intersect
  `state.modules.localArcs.activeIssueSeedTags`. The producer side is
  already correct; this is purely consumer wiring.
- **Depends on:** none
- **Test approach:** Start a state with a `mushroom_blight` arc
  active; verify seeds carrying matching tags receive a worthiness
  bonus and are picked more often during the arc's active window
  than during an inactive control window.

### ISSUE-021 — Calendar tag consumers (priority: `rent_due_soon`)

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/calendar/types.ts:22-37` — 14 `CalendarTag`
    values defined.
  - 4 tags consumed: `festival_window`, `mushroom_festival` (by
    `festivalReadiness.ts`); `payday`, `brawl_night` (by
    `stockShortage.ts`); `miner_payday` (by `arcEngine.ts`).
  - 10 tags emit-only: `inspection_window`, `rent_due_soon`,
    `winter_shortage_risk`, `road_danger_risk`, `merchant_traffic`,
    `local_crowd`, 4 season tags, 4 day-type tags.
- **Impact:** Calendar tags were designed as a shared signaling layer
  for seasonality and time-of-week effects. In practice only festival
  and payday signals flow through. The simulation feels less seasonal
  than the calendar data suggests it should.
- **Scope:**
  - Wire `rent_due_soon` first: it should boost landlord pressure in
    `src/sim/modules/pressures/calculators/` and increase the
    `debt_rent` seed's daily fire weight when present.
  - Optionally wire 2-3 more high-value tags:
    `winter_shortage_risk` boosts `stock_shortage`,
    `road_danger_risk` impacts supplier reliability,
    `merchant_traffic` boosts merchants customer group activity.
- **Depends on:** none
- **Test approach:** Set state to a day where `rent_due_soon` fires.
  Verify landlord pressure rises measurably and that the `debt_rent`
  seed family is more likely to fire that day than on a non-tagged
  control day.

### ISSUE-022 — History log pruning policy

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/modules/history/historyModule.ts` — validator only, no
    `endDay`, `endWeek`, or `endMonth` hook prunes entries.
  - 31 `ctx.addHistory` producers across modules. Rough estimate
    5-20 entries per simulated day. Over 365 days, 2k-7k entries.
    Each entry carries `summary`, `tags`, `relatedActors`,
    `relatedLocations`, `relatedSystems`, `mechanicalRefs`.
- **Impact:** Invisible today because no long-running save exists,
  but a real liability for any post-card persistence: state grows
  unboundedly with simulation length, and there's no way to bound
  memory or save-file size.
- **Scope:** Add an `endMonth` pruning hook that keeps the last N
  entries (suggest 500, or "last 90 days, whichever is more").
  Pruned entries are discarded silently; no separate archive needed
  at this stage.
- **Depends on:** none
- **Test approach:** Run a 365-day simulation; verify `state.history`
  stays bounded at the configured cap, the most recent entries are
  always preserved, and no module depends on entries older than the
  cap.

### ISSUE-023 — RNG stream prune or wire

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - `src/sim/core/rng.ts:123-135` — 12 streams declared. 5 have
    callers in `src/sim/`: `incidents`, `regular_identity`,
    `seasonal_events`, `attribution_perceiver`, and one path through
    `staff_identity`.
  - 7 dead declarations with zero callers: `service`, `economy`,
    `names`, `npc_identity`, `supplier_identity`, `faction_behaviour`,
    `issue_seed_selection`.
- **Impact:** Dead streams are harmless (lazy, no runtime cost) but
  misleading: they suggest the engine has more variation injection
  than it does. The systems they're named for either use a different
  stream or have no variation injection at all.
- **Scope:**
  - `npc_identity` should be wired through the NPC factory from
    ISSUE-004; verify and connect.
  - For the other 6 dead streams: decide per stream whether to wire
    (recommended for `service`, `economy`, `faction_behaviour`,
    `issue_seed_selection` since they're named for systems that
    should pull from them) or prune the declarations.
- **Depends on:** ISSUE-004
- **Test approach:** Verify every remaining stream declaration in
  `rng.ts` has at least one caller in `src/sim/`. Verify wired streams
  produce reproducible-but-decorrelated output: same seed + same input
  produces the same stream output regardless of unrelated RNG
  activity in other streams.

### ISSUE-024 — Thin family profile depth + core picker rotation

- **Grade:** thin
- **Status:** open
- **Phase:** unassigned
- **Evidence:**
  - Six families ship below the per-profile depth targets for
    delayed effects and `futureHooks` but aren't fully broken:
    `food_safety`, `stock_shortage`, `maintenance` (low delayed
    coverage); `culture_conflict`, `area_atmosphere`, `rival_tavern`
    (low `futureHook` coverage).
  - Per-profile depth targets: average ≥0.66 non-empty
    `delayedEffects` per profile, ≥0.31 non-empty `futureHooks` per
    profile. A 4-profile family needs ≥3 delayed and ≥2 fh in
    aggregate to clear.
  - Three core-family generators have no rotation primitive at all:
    `food_safety` (picks worst kitchen risk), `stock_shortage`
    (always ale), `maintenance` (picks worst area).
- **Impact:** These families fire correctly but their response slots
  feel mechanically thin compared to fully-developed families
  (`staff_identity`, `supplier_relationship`, `seasonal_arc`).
  Rotation absence in the 3 core families means the same risk vector
  / stock item / area is picked daily.
- **Scope:**
  - Add 1-2 `delayedEffects` or `futureHooks` per thin profile across
    the 6 families to clear the per-profile depth targets above.
  - Add `recencyPenalty` plus `recordPick` rotation to `food_safety`
    (rotate across kitchen risk vectors), `stock_shortage` (rotate
    across stock items, not always ale), `maintenance` (rotate across
    worst-N areas, not just the single worst). Pattern matches the
    `expandedSeedGenerators.ts:78-110` rotation primitive.
- **Depends on:** ISSUE-001
- **Test approach:** Re-run the readiness output and verify these
  families meet the per-profile depth targets. Verify the three core
  families rotate across their respective entities in a 14-day
  window.

---

## Deferred

These were identified but are consciously out of scope for this repair
pass.

- **Save / migration framework.** `src/sim/state/saveEnvelope.ts:15-19`
  has `migrateSaveEnvelope` as a no-op and three opt-in helpers
  covering legacy state shapes. No version-keyed framework exists.
  Defer until the first phase that introduces persistent state
  (post-card layer); at that point, the helpers can become the
  building blocks of a real version registry.
- **Memory tags written but never read** (write-side dead tags, as
  opposed to the read-side dead tags handled in ISSUE-010 and
  ISSUE-014). The codebase emits descriptive tag metadata that no
  consumer reads. Don't sweep-fix; pick by gameplay surface need.
  Some are absorbed into per-feature bundles when a consumer phase
  needs them; the rest stay deferred.
- **Faction memory threshold tightening.** Weekly faction-memory
  writes use thresholds (`satisfactionDelta >= 3`, `tensionDelta >= 2`)
  where deltas are clamped at ±5. The thresholds are marginal but
  the direct write path is supplemented by attribution propagation,
  which clears the audit threshold. Re-evaluate if faction memories
  show up thin again in a future readiness run.

---

## Adding a new issue

If a new problem surfaces during repair work (regression, missed
finding, side-effect of a fix):

1. Pick the next free `ISSUE-NNN` number. Don't reuse retired numbers.
2. Add it to the Issue index table.
3. Write a full entry under the appropriate tier section. Match the
   existing entry shape: Grade, Status, Phase, Evidence, Impact,
   Scope, Depends on, Test approach.
4. Update any existing issues whose dependencies should now include
   the new one. (Cross-check the index table after.)
5. Note in a commit message that the tracker was extended and which
   issue ID was added.

Don't fold new issues into existing entries — that breaks the
"one phase per issue" assumption that the phase docs will rely on.
