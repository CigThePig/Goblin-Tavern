# Progressive Onboarding — Design Document

## Status

- **Status:** accepted (locked)
- **Scope:** ISSUE-060 through ISSUE-077 (`docs/ISSUE_TRACKER.md`, new Tier 4
  section)
- **Phases:** 99 through 116 (per the `ISSUE-NNN → phase 40+NNN` rule)
- **Supersedes:** the explicit "no character creation, no biome pick, no
  naming the tavern" decision in `docs/plans/game-loop-and-ux.md §2.1`. That
  section is **amended**, not rewritten — the historical reasoning stays
  visible above the amendment.
- **Authority:** This document is the locked contract for the arc. Per-issue
  phase plans (`docs/plans/phase-99-*.md` through `docs/plans/phase-116-*.md`)
  implement against the rules below.

This document plays the same role for the progressive onboarding arc that
`rare-ingredients-economy.md` plays for Tier 1.5: it defines the scope and
rules, not the line-by-line implementation. Phase plans fill in the
implementation details.

---

# 1. Purpose

Today, a new save lands the player on Day 1 with the full 25-module
pipeline already running (factions, cultures, suppliers, regulars,
expeditions, issue seeds, the full analysis stack — all pre-seeded) and a
5-tab UI (Day / Reports / Tavern / World / More) with ~25 sub-tabs visible
at once. The Day-1 experience is information-dense and contradicts the
"sparse early game, learn the tavern you inherited" intent in
`game-loop-and-ux.md §5.1`.

This arc reframes Day 1 as **a goblin opening their tavern for the very
first time**. The player names their owner-character, names their tavern
(defaulting to "The Crooked Keg"), picks 1–2 staff from a small candidate
pool, and begins in a deliberately minimal state. Simulation systems then
unlock one at a time across the first ~10 weeks of in-game time, each
unlock tied to a **story beat at a day threshold** and announced by a
one-shot discovery card.

The arc has one load-bearing rule beyond what
`game-loop-and-ux.md` already establishes:

> If a system is not visible to the player yet, its module hooks do not
> run.

No hidden background simulation for locked systems. Pressures, memories,
attribution edges, and seeds for a system come into existence on the day
the system unlocks — not before.

The arc aligns with the project's central rule:

> The simulation is the source of truth. Cards reveal, interpret, escalate,
> or resolve simulation truth. Cards must not invent truth.

Discovery cards are a special case of this: they reveal a state change
(`onboarding.unlockedSystems[systemId]` was just written) — they do not
invent the unlock.

---

# 2. Architectural Alignment

These rules from `CLAUDE.md` constrain everything in this arc:

1. **Pure by default.** No `Math.random()`, DOM, browser storage, or
   global state inside simulation logic. All randomness uses seeded RNG.
2. **Serializable state.** `OnboardingState` is plain JSON. No Maps, Sets,
   class instances, or functions.
3. **Modular systems.** The new gating infrastructure lives in its own
   module slice (`src/sim/modules/unlocks/`); the candidate pool lives in
   its own content slice (`src/sim/content/onboarding/`). No god-files.
4. **Registries for expandable concepts.** SystemIds and unlock
   conditions register through an `unlockRegistry` keyed by `SystemId`.
   Staff candidates register through the existing staff identity
   factory; the candidate pool is a content registry.
5. **Deterministic RNG with named streams.** The owner-name default and
   the staff candidate roster are generated from named streams
   (`npc_identity`, `staff_identity`). Re-rolling a candidate pool with
   the same seed produces the same five candidates in the same order.
6. **Causality.** Every system unlock writes to state with cause
   attribution (`unlocked_by_threshold` cause kind) so the tavern log
   and daily report can render *why* a system became available.
7. **Persistent identity.** The owner's name and the staff picks become
   persistent state at game creation, not throwaway display strings.
8. **Additive integration.** Do not rewrite `customerModule`,
   `serviceModule`, `staffModule`, `stockModule`, `areasModule`. The
   gating mechanism wraps modules at registration in
   `canonicalPipeline.ts`; module bodies stay untouched. The trimmed
   initial-state path is a *mode flag* on `createInitialTavernState`,
   not a rewrite of the default.

---

# 3. Core Loop

The arc creates a single closed loop spanning three actors — the player,
the unlocks module, and the gated modules:

```
   Player opens app → new save flow ────────────┐
                                                 │
                                                 ▼
                  ┌──────  OnboardingFlow  ──────┐
                  │  WelcomeStep                  │
                  │  NameOwnerStep                │
                  │  NameTavernStep               │
                  │  PickStaffStep                │
                  │  ConfirmStep                  │
                  └────────────┬──────────────────┘
                               │ writes onboarding slice + meta + staff
                               ▼
                          DayScreen Day 1
                               │
                               ▼ simulateDay()
        ┌─────────────  unlocksModule.startDay  ──────────────┐
        │  for each not-yet-unlocked SystemId:                 │
        │    if condition(state) === true:                     │
        │      write unlockedSystems[id]                       │
        │      push to pendingUnlocks                          │
        │      enqueue a discovery_<id> seed (if 'crises' is   │
        │      itself unlocked; before then, plain banner)     │
        └─────────────────────┬──────────────────────────────┘
                              │
                              ▼
        ┌──────────  gated module hooks  ──────────┐
        │  each gated hook short-circuits via       │
        │  isUnlocked(state, systemId).             │
        │                                           │
        │  modules whose SystemId is not in         │
        │  unlockedSystems do nothing this day.     │
        └─────────────────────┬───────────────────┘
                              │
                              ▼
                       day proceeds normally
                              │
                              ▼
                       Daily Report → loops
```

Failure modes break the loop in specific, simulation-legible ways:

- A gated module's hooks never fire before its `unlockedDay`. State for
  that module's slice stays at its initial (often empty) shape. Pressures,
  memories, and seeds tied to that system simply do not accumulate.
- A discovery card is fired exactly once per system per save, governed
  by `discoveryCardsShown`. Replaying the same day cannot duplicate the
  card.
- A migrated save (`isFullyUnlocked: true`) bypasses every gate. Behaviour
  is bit-for-bit identical to the pre-arc pipeline.

---

# 4. Unlock Schedule

Fifteen systems, each unlocking on a fixed day in a fresh save. Days are
counted from `state.calendar.totalDaysElapsed` and re-evaluated at the
start of every day before any gated hook runs.

| Day | SystemId | Beat (story moment) |
|---|---|---|
| 1 | `core` | opening day — owner, tavern, picked staff, 2 areas, 3 stock items, `local_goblins` only |
| 2 | `reports` | yesterday's tally — the Reports tab appears |
| 3 | `tavern_management` | the day after — the Tavern tab appears |
| 4 | `suppliers` | a knock at the door — a supplier offers their first delivery |
| 5 | `crises` | the first issue-seed card lands — the day-loop's incident shape begins |
| 7 | `weekly_report` | your first week — the Weekly digest renders |
| 10 | `regulars` | a face you recognize — a named regular emerges |
| 12 | `cultures` | a non-goblin walks in — the cultures slice activates |
| 14 | `weekly_economy` | payroll due — wages + maintenance hooks start costing coin |
| 17 | `factions` | the watch takes an interest — the first faction notices the tavern |
| 21 | `policies` | you decide how this place runs — owner-action policy toggles unlock |
| 28 | `monthly` | rent day — the Monthly digest, landlord, inspection, rival |
| 42 | `projects` | first big undertaking — `start_*` owner actions become available |
| 70 | `expeditions` | gated by `state.reputation.culinary_renown >= 25` AND day ≥ 70 — hireable adventurers + expeditions activate |

Notes on scheduling decisions:

- **`weekly_report` and `weekly_economy` are split.** The weekly *digest*
  is informational and lands on day 7 — a friendly first-week summary.
  Wages and maintenance start costing coin a week later, on day 14, after
  the player has hired a second staff member. The split prevents a "you
  lost coin you didn't know was scheduled" moment in the first week.
  Both gate `weeklyModule` but at different hook granularities; see §6.4.
- **`pressures_expanded` is not its own SystemId.** Pressures naturally
  turn on as their parent systems unlock — faction-anger pressures need
  factions, regular-irritation pressures need regulars, supplier-stress
  pressures need suppliers. The pressures dashboard renders only
  pressures whose parents are unlocked.
- **`expeditions` is the only non-day-threshold unlock.** It needs
  `culinary_renown >= 25` as well as day ≥ 70. Fresh saves with low
  renown will not see expeditions until renown catches up.
- **No `world` or `customers` SystemId.** `worldModule` owns the world
  slice that other modules write into; `customersModule` runs Day 1 with
  one customer group (`local_goblins`). Both stay ungated. Customer
  groups *populate* as their cultures unlock; the module itself never
  short-circuits.

---

# 5. Concept Model

Six concepts compose the arc. Each maps to specific state shape and
specific module wiring.

## 5.1 OnboardingState — the new state slice

A new top-level slice on `TavernState`, parallel to `meta`, `calendar`,
`reputation`, etc. **Not** a sub-field of `meta` — `meta` is identity
that never changes after save creation; `onboarding` is a growing log of
unlocks plus the player's name choice.

The `ownerName` field reuses the existing `GeneratedName` shape from
`src/sim/content/naming/nameTypes.ts`, mirroring the staff identity
pattern from Phase 95.

`isFullyUnlocked` is a fast-path boolean: migrated saves set it `true`
and the `gateModule` wrapper short-circuits to "always allow" without
hitting the record lookup.

`discoveryCardsShown` prevents a card from re-firing across replays of
the same day, and on migration it's pre-filled with every SystemId so a
mid-game save never floods the player with cards for systems they've
been using for weeks.

## 5.2 SystemId — the enum of gateable systems

A union type, populated by `unlockRegistry`. Members are exactly the
keys in the unlock schedule above plus the implicit `core`:

```ts
type SystemId =
  | 'core'              // always unlocked at day 1; record-only
  | 'reports'           // UI-only
  | 'tavern_management' // UI-only
  | 'suppliers'
  | 'crises'
  | 'weekly_report'
  | 'regulars'
  | 'cultures'
  | 'weekly_economy'
  | 'factions'
  | 'policies'
  | 'monthly'
  | 'projects'
  | 'expeditions'
```

The `policies` and `projects` SystemIds gate UI affordances and
owner-action availability; they do not gate a module wholesale. The
remainder gate one or more module hooks via `gateModule`.

## 5.3 unlocksModule — the gating-driver module

A new `SimulationModule` in `src/sim/modules/unlocks/`. Its only hook is
`startDay`:

1. If `state.onboarding.isFullyUnlocked === true`, return state unchanged.
2. For each entry in `unlockRegistry` not in
   `state.onboarding.unlockedSystems`:
   - Evaluate the unlock condition `(state) => boolean`.
   - On true: write `unlockedSystems[systemId] = { unlockedDay: today,
     trigger: 'day' }`, push to `pendingUnlocks`, write a cause entry
     (`unlocked_by_threshold`), and queue a `discovery_<systemId>` seed
     into `state.modules.issueSeeds.pending` *if* the `crises` system is
     itself unlocked. For unlocks that fire before `crises` (days 1–4),
     the discovery surface is a non-card banner rendered from
     `pendingUnlocks` directly.
3. `pendingUnlocks` drains every day after the daily report renders.

The module must run **first** in `FULL_PIPELINE` so other modules' gates
see today's freshly written unlocks the same day.

## 5.4 gateModule — the registration-time wrapper

A pure function in `src/sim/modules/unlocks/gateModule.ts`:

```ts
function gateModule(mod: SimulationModule, systemId: SystemId): SimulationModule
function gateHook<H>(hook: H, systemId: SystemId): H  // per-hook variant for split gates
```

`gateModule` returns a new `SimulationModule` whose every hook — every
phase callback, `buildReport`, and `validate` — short-circuits via
`isUnlocked(state, systemId)`. Module bodies are not edited.

The per-hook `gateHook` variant exists for `weeklyModule`: its
report-building hooks gate behind `weekly_report`, its wages/maintenance
hooks gate behind `weekly_economy`. Both variants are pure and
deterministic; the wrap is applied at registration time in
`canonicalPipeline.ts`, not at runtime.

## 5.5 Discovery cards — one-shot revealers

A new family of issue seeds — one per unlockable SystemId. They are
generated by `unlocksModule` (not by `issueSeedsModule`'s generators)
because they need to fire on the day of unlock and predate the seed
generation phase in the pipeline order.

Each discovery seed:

- Renders as a card with no `ResponseIntent` slots — only an "ignore"
  acknowledgment.
- References the new system's glossary term inline (via the Phase 98
  `TermLabel` component).
- Carries `cardWorthiness: 100` so it surfaces above other morning
  seeds on its unlock day.
- Is written into `discoveryCardsShown` after a single fire, preventing
  re-emission on replay.

Discovery cards have no narrative voice authored in this phase — they
compose facts the sim already knows (the system that just unlocked, the
day, the seed-family-specific text ingredients) into a one-line body.
The Phase 95 voice pass already handles the composition layer.

## 5.6 New-game flow — the multi-step intro

A multi-step Svelte flow replacing the current `StartScreen` single-tap
intro. Lives at `web/src/lib/screens/onboarding/` with a controller
component and five step components:

1. **WelcomeStep** — atmospheric framing. "You are a goblin. You have
   100 coin. There is an empty room and a doorway to a street." Single
   "Begin" button.
2. **NameOwnerStep** — text input for the owner-character's name. The
   placeholder shows a default generated through the `npc_identity` RNG
   stream + the `goblin_locals` naming profile. A "Reroll" button
   regenerates the default. Submitting an empty field accepts the
   placeholder.
3. **NameTavernStep** — text input for the tavern's name. The
   placeholder is "The Crooked Keg" (the existing hardcoded default).
   Empty submit accepts the placeholder.
4. **PickStaffStep** — five candidate cards (one per starter candidate),
   each showing name, role, one-line trait. The player taps to select 1
   or 2. The candidate roster is generated deterministically from the
   game seed via `staffCandidatePool.ts`.
5. **ConfirmStep** — summary of choices; "Open the Tavern" button. On
   confirmation, the flow writes `onboarding.ownerName`,
   `meta.tavernName`, and the picked staff to a freshly-created
   `TavernState({mode: 'onboarding', chosenStaffIds})` and routes to
   `DayScreen`.

The flow is **skippable**: a "Skip and use defaults" affordance on
WelcomeStep jumps straight to ConfirmStep with the placeholder values
selected. This preserves the spirit of the original
`game-loop-and-ux.md §2.1` design — "one button, one screen" — for
players who don't care about naming.

---

# 6. State Shape Additions

This section enumerates the additions to `TavernState`. Field types and
schemas are sketched here at the level of "what exists and why" — the
exact Zod schemas land in the phase 100 implementation plan.

## 6.1 OnboardingState

```ts
type TavernState = {
  // ... existing fields ...
  onboarding: OnboardingState
}

type OnboardingState = {
  ownerName: GeneratedName              // reuses src/sim/content/naming/nameTypes.ts
  unlockedSystems: Record<SystemId, UnlockRecord>
  pendingUnlocks: SystemId[]
  discoveryCardsShown: SystemId[]
  isFullyUnlocked: boolean
}

type UnlockRecord = {
  unlockedDay: number
  trigger: 'day' | 'beat' | 'migration'
}
```

The slice always contains `core` in `unlockedSystems` with
`unlockedDay: 1, trigger: 'day'`. Fresh saves create the slice via
`createInitialOnboardingState()` with only `core` present; migrated
saves get all SystemIds present with `trigger: 'migration'`.

## 6.2 staffCandidatePool — content registry

```ts
type StaffCandidate = {
  id: string
  role: StaffRole               // existing union — cook, server, bouncer, cleaner
  namingProfileId: string       // existing naming profile id
  traitLine: string             // short, one-sentence flavour
  startingSkill: number         // 0-100
  startingMorale: number        // 0-100
}

function generateStaffCandidatePool(seed: string): StaffCandidate[]  // returns 5
```

The pool is content, not state — generated deterministically per game
seed via the existing `staff_identity` RNG stream. The player's two
picks become real `StaffMember` records in `state.staff` via the existing
`staffIdentityFactory.ts`. Unpicked candidates are not stored.

## 6.3 Trimmed initial state — mode flag

`createInitialTavernState()` gains an optional second-shape argument:

```ts
function createInitialTavernState(
  overrides?: Partial<TavernState>,
  config?: {
    difficulty?: DifficultyConfig
    mode?: 'onboarding' | 'full'           // NEW, defaults to 'onboarding'
    chosenStaffIds?: string[]              // NEW, used when mode === 'onboarding'
    ownerName?: GeneratedName              // NEW, used when mode === 'onboarding'
    tavernName?: string                    // NEW, used when mode === 'onboarding'
  },
): TavernState
```

**Onboarding mode produces:**

- `meta.tavernName`: from `config.tavernName ?? 'The Crooked Keg'`
- `onboarding.ownerName`: from `config.ownerName ?? generated default`
- `areas`: 2 (`main_room`, `kitchen`) — the rest empty
- `stock`: 3 starter items — `ale`, `stew`, `bread`
- `recipes`: 3 starter recipes — 1:1 with the stock
- `customerGroups`: `local_goblins` only
- `staff`: from `config.chosenStaffIds` (1 or 2 members)
- `pressures`: only `food_safety`, `maintenance`, `pests`
- `world.factions`, `world.suppliers`, `world.regulars`, `world.cultures`,
  `world.hireableAdventurers`, `world.notableNpcs`: empty maps
- `expeditions`: `{ active: [], completed: [] }`
- `onboarding`: `{ unlockedSystems: { core: {...} }, isFullyUnlocked: false, ... }`

**Full mode is the pre-arc behaviour.** Existing test fixtures call
`createFullInitialTavernState()` (new re-export — `createInitialTavernState({mode: 'full'})`)
to keep the ~950 fixture sites green. Production code paths default to
`'onboarding'`.

## 6.4 Pipeline wiring

`canonicalPipeline.ts:43` is the only sim file that imports the gating
helpers. Module imports are unchanged. The wiring:

```ts
import { gateModule } from './modules/unlocks/gateModule'
import { unlocksModule } from './modules/unlocks/index'
// ... existing module imports ...

export const FULL_PIPELINE: ReadonlyArray<SimulationModule> = [
  unlocksModule,                                              // NEW, runs first
  areasModule,                                                // core, ungated
  stockModule,                                                // core, ungated
  staffModule,                                                // core, ungated
  customersModule,                                            // core, ungated
  worldModule,                                                // core, ungated (owns the slice)
  gateModule(cultureModule,     'cultures'),
  gateModule(factionModule,     'factions'),
  gateModule(supplierModule,    'suppliers'),
  gateModule(regularModule,     'regulars'),
  gateModule(adventurersModule, 'expeditions'),
  gateModule(expeditionsModule, 'expeditions'),
  ownerActionsModule,                                         // core; policies + projects gate at action-availability level
  serviceModule,                                              // core
  gateWeeklyHooks(weeklyModule),                              // split: report vs economy
  gateModule(monthlyModule,     'monthly'),
  gateModule(localArcsModule,   'factions'),                  // depends on factions
  tavernIdentityModule,                                       // core
  memoriesModule,                                             // core
  historyModule,                                              // core
  causesModule,                                               // core
  attributionModule,                                          // core
  pressuresModule,                                            // core
  feedbackModule,                                             // core
  gateModule(issueSeedsModule,  'crises'),
  gateModule(responsesModule,   'crises'),
]
```

`gateWeeklyHooks` is the split-gate variant — it wraps `weeklyModule`'s
report-building hooks under `weekly_report` and its wages/maintenance
hooks under `weekly_economy`.

---

# 7. Migration

`state/migrations.ts` gains one new helper:

```ts
function ensureOnboardingSlice(state: any): TavernState
```

Mirroring `ensureWorldBranch`, `ensureRecipesSlice`, and
`ensureExpeditionsSlice`. For a pre-arc save:

- `state.onboarding = { ownerName: deterministic-from-tavernId,
  unlockedSystems: { /* all SystemIds */ }, pendingUnlocks: [],
  discoveryCardsShown: [/* all SystemIds */], isFullyUnlocked: true }`
- Every SystemId carries `trigger: 'migration'` and
  `unlockedDay: state.calendar.totalDaysElapsed` (or 1 if calendar is
  missing).
- `discoveryCardsShown` populated with every SystemId so a migrated save
  cannot replay any discovery cards.

The `ownerName` field for migrated saves is generated deterministically
from `state.meta.tavernId` (via `npc_identity` RNG stream seeded with
the tavern id) so re-loading a migrated save produces a stable name
without drift.

---

# 8. UI Gating

Three web-layer touch points read `state.onboarding.unlockedSystems`:

## 8.1 Bottom navigation tabs

`web/src/lib/components/BottomNav.svelte` reads the slice and emits
only the tabs whose SystemId is unlocked. The mapping:

| Tab | Unlocked by |
|---|---|
| Day | always (the `core` SystemId is always in the slice) |
| Reports | `reports` |
| Tavern | `tavern_management` |
| World | union of `suppliers ∪ regulars ∪ cultures ∪ factions` (any one) |
| More | always |

A tab appears the same day its gating SystemId unlocks. Tabs do not
disappear once they've appeared. A migrated save shows all five.

## 8.2 Sub-tabs

`web/src/lib/screens/WorldScreen.svelte`,
`ReportsScreen.svelte`, `TavernScreen.svelte` filter their sub-tab
lists by `isUnlocked`. If only one sub-tab is visible, the sub-tab row
is suppressed entirely (the screen renders its single sub-tab directly).

## 8.3 Owner action availability

Policy and project actions in `ownerActionsModule` already use a
`canApply: (state) => boolean` predicate. That predicate now ANDs with
`isUnlocked(state, 'policies')` for policy actions and
`isUnlocked(state, 'projects')` for project actions. The change is
additive and localized — no rewrite of the action registry.

---

# 9. Out of Scope

This arc does **not** include:

- **Card prose / voice for discovery cards.** Phase 95's voice pass
  already covers card composition. Discovery cards register through the
  same registry and inherit the same voice.
- **A tutorial system.** The discovery card *is* the introduction for
  each system. No "did you know..." overlays, no interrupting modals,
  no forced first-action checkpoints. The friction budget on day 1 is
  zero.
- **A character creation system beyond name + staff.** Goblin culture
  affinity, starting traits, background story — all deferred. The owner
  is a name and a 100-coin starting purse. The player's choices over
  weeks of play shape the identity, per the existing §2.1 design.
- **Unlock-trigger customization.** The unlock days in §4 are fixed.
  Difficulty mode does not shift them. A "speed-run mode" or "skip
  onboarding" toggle is not in scope.
- **Re-locking systems.** Once a SystemId is in `unlockedSystems`, it
  stays unlocked. There is no path for a system to re-gate (no "you
  lost faction access for failing inspection").
- **Rewriting `customerGroups` seeding.** `local_goblins` stays the
  only Day-1 group; other groups become available as their cultures
  unlock through the existing reputation-gating in `customerModule`.
- **Rewriting `game-loop-and-ux.md`.** §2.1 is amended with a dated
  subsection that points to this document. The historical "no character
  creation" reasoning stays visible above the amendment.

---

# 10. Verification

End-to-end per phase, plus an integration story at the end:

- **Phases 99–102** (foundation): `npm test` and `npm run typecheck`
  pass unchanged. A new fixed-seed snapshot test
  `tests/sim/onboarding.gating.test.ts` confirms that
  `isFullyUnlocked: true` produces bit-for-bit identical state to the
  pre-arc pipeline across 30 simulated days.
- **Phase 103** (trim): existing fixtures pass via
  `createFullInitialTavernState`. New test runs
  `createInitialTavernState({mode: 'onboarding'})` and asserts the
  trimmed-state invariants from §6.3.
- **Phases 104–105** (new-game flow): Svelte component tests for each
  step. A deterministic-candidate test asserts the same game seed
  produces the same five candidates in the same order across runs.
- **Phases 106–113** (per-system unlocks): per-unlock test that for
  each SystemId asserts (a) gated module hooks do not fire before
  `unlockedDay` (verified via hook-call counter), (b) the discovery
  seed fires exactly once on `unlockedDay`, (c) the web tab/sub-tab
  appears the same day, (d) replaying a save does not re-fire the card.
- **Phase 114** (sub-tab gating): web component test that mounts each
  screen with a fresh-save state and asserts the correct sub-tab set
  renders.
- **Phase 115** (discovery narrative): one-line composition test per
  card family, asserting the body line references the system's
  glossary term.
- **Phase 116** (migration + audit): integration test
  `tests/integration/onboarding/walkthrough.test.ts` — a fixed-seed
  playthrough days 1 → 7 → 28 → 70 with snapshot assertions at each
  checkpoint. Migration test loads a pre-arc save fixture and asserts
  all SystemIds carry `trigger: 'migration'` and zero discovery cards
  fire.

Manual verification at the end of the arc: start the dev server,
click through the new-game flow on a phone-sized viewport, confirm Day
1 has no World tab, Day 4 shows the supplier discovery card, Day 7
shows the weekly summary, Day 28 shows rent day.

---

# 11. References

- `docs/plans/rare-ingredients-economy.md` — design contract this
  document is patterned after.
- `docs/plans/game-loop-and-ux.md §2.1` — amended (not rewritten) by
  this arc; see the dated **Amendment** subsection there.
- `docs/plans/game-loop-and-ux.md §5.1` — the "early game" design that
  this arc operationalizes for the first time.
- `docs/plans/phase-95-voice-and-identity.md` — the voice pass that
  discovery cards inherit composition from.
- `docs/plans/phase-98-more-tab.md` — the first-encounter hint and
  glossary chassis that discovery cards lean on.
- `CLAUDE.md` — architectural rules.
