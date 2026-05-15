# Rare Ingredients Economy — Design Document

## Status

- **Status:** accepted (locked)
- **Scope:** ISSUE-025 through ISSUE-033 (`docs/ISSUE_TRACKER.md`, new Tier 1.5 section)
- **Phases:** 65 through 73 (per the `ISSUE-NNN → phase 40+NNN` rule)
- **Supersedes:** ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-009
- **Authority:** This document is the locked contract for the arc. Per-issue
  phase plans (`docs/plans/phase-65-*.md` through `docs/plans/phase-73-*.md`)
  implement against the rules below.

This document plays the same role for Tier 1.5 that
`phase-21-expansion-contract.md` plays for the expansion arc: it defines the
scope and rules, not the line-by-line implementation. Phase plans fill in
the implementation details.

---

# 1. Purpose

The post-Phase-40 audit found that the tier-1 roster grows
(ISSUE-005…ISSUE-009) added content density without adding gameplay. More
staff, more areas, more stock items, more customer groups, more suppliers —
all flat additions to existing lists. The picker would rotate over more
entities; the player's day-to-day decisions would not change.

This arc replaces those five flat grows with a **system** that produces
content density as a *consequence* of new gameplay.

The system's elevator pitch:

> Send adventurers out to find rare ingredients. The rarer they are, the more
> you can charge, the more interesting customers you attract, and the more
> renowned your tavern becomes for sourcing the strange and the prized. Rare
> ingredients are useless without cooks who can prepare them.

The arc remains aligned with the project's central rule:

> The simulation is the source of truth. Cards reveal, interpret, escalate, or
> resolve simulation truth. Cards must not invent truth.

Every facet of this system — ingredient rarity, expedition outcomes, runner
identity, cook performance, customer renown reactions — becomes persistent
simulation state with cause attribution. No card prose is written in this
arc.

---

# 2. Core Loop

The system creates a single closed gameplay loop spanning four player
decisions and three simulation outcomes:

```
                ┌─────────────────────────────────────────┐
                ▼                                         │
   (1) Pick a recipe to promote                           │
                │                                         │
                ▼                                         │
   (2) Acquire its ingredients                            │
        ├── via suppliers (common / uncommon)             │
        └── via expeditions (rare / legendary)            │
                │                                         │
                ▼                                         │
   (3) Prepare and serve (cook skill matters here)        │
                │                                         │
                ├──▶ excellent prep → renown ↑            │
                ├──▶ ordinary prep  → renown drift        │
                └──▶ botched prep   → renown ↓            │
                                                          │
                ▼                                         │
   (4) Customers respond                                  │
        ├── niche groups arrive (renown threshold)        │
        ├── existing groups satisfaction shifts           │
        └── word spreads (memories + cause attribution)   │
                │                                         │
                └─────────────────────────────────────────┘
                       loops back: more renown
                       → more niche demand
                       → more reason to expedition again
```

Failure modes break this loop in specific, simulation-legible ways:
runners fail to return; ingredients spoil before being served; cooks
botch preparation; niche customers leave if their dishes vanish from
the menu. Each failure mode is a state mutation with cause attribution.

---

# 3. Architectural Alignment

These rules from `CLAUDE.md` constrain everything in this arc:

1. **Pure by default.** No `Math.random()`, DOM, browser storage, or global
   state inside simulation logic. All randomness uses seeded RNG.
2. **Serializable state.** Every new piece of state in this arc must be
   plain JSON-compatible — no Maps, Sets, class instances, or functions.
3. **Modular systems.** New subsystems register their own state defaults,
   phase hooks, and report sections. No god-files.
4. **Registries for expandable concepts.** Ingredients and recipes are
   new expandable concepts; both get registries. The ingredient catalog
   is not hardcoded in the engine.
5. **Deterministic RNG with named streams.** Expedition outcomes,
   adventurer roster drift, and niche customer arrivals each use named
   RNG streams via `ctx.getRngStream(streamId)`. A save reloaded mid-
   expedition must resolve to the same outcome.
6. **Causality.** Every culinary_renown change, every expedition outcome,
   every cook botch records a cause entry with `relatedActors`.
7. **Persistent identity.** Hireable adventurers are persistent NPCs in
   `state.world.hireableAdventurers`, not throwaway display strings.
   Names are generated once at NPC creation through the existing
   `npc_identity` stream.
8. **Additive integration.** Do not rewrite `stockModule`, `serviceModule`,
   `customerModule`, or `staffModule`. Extend them with new fields and
   new phase hooks. The expansion arc rule is explicit: light, additive
   integration with existing modules.

---

# 4. Concept Model

Eight concepts compose the system. Each maps to specific state shape and
specific registries.

## 4.1 Ingredients are stock items with rarity

The existing `state.stock` model is extended, not replaced. Every stock
item gains a `rarity` field with four tiers:

| Tier | Spoilage profile | Price multiplier | Primary acquisition path |
|---|---|---|---|
| `common` | low | 1× | suppliers (current behaviour) |
| `uncommon` | moderate | 2–3× | specialty suppliers |
| `rare` | aggressive | 5–8× | open expeditions |
| `legendary` | aggressive + unstable | 10–20× | targeted expeditions |

Rarity is a property of the **ingredient type** (stock id), not per-batch.
A moonpetal mushroom is rare regardless of which expedition fetched it.
Provenance becomes a memory entry (`expedition_success` recording who
brought what from where on which day), not a state-bearing field on the
stock entry.

The existing six stock items get classified into this taxonomy during the
model extension. None of the existing six are above `common`.

## 4.2 Recipes are served dishes

A new `recipeRegistry` is introduced. A recipe is a derived dish that
consumes one or more ingredients and is what customers actually order.

In v1, every ingredient has a 1:1 starter recipe — `moonpetal_mushroom`
produces a recipe `dish_moonpetal_mushroom` whose only input is one
moonpetal mushroom. The recipe registry exists so the service flow,
customer demand, and memory writes can point at *dishes* rather than at
ingredient stock ids. This avoids the semantic rewrite that would
otherwise be required when multi-input recipes are added later.

A recipe carries:

- `inputs`: ingredient ids and quantities consumed per serving
- `prepDifficulty` (0–100): the cook skill threshold for clean preparation
- `demandTier`: which culinary_renown threshold the dish attracts
- `culturalTags`: optional tags (e.g. `goblin_food`, `humanish_food`)
  for cultural-friction memory writes
- `tags`: generic tags for picker rotation and family targeting

## 4.3 Cook skill determines preparation outcome

Each staff member already carries a `skill` field. This field becomes
load-bearing for the recipe system.

When a recipe is served, the cook's skill is compared to the recipe's
`prepDifficulty`. The gating is **soft**:

- `skill > prepDifficulty + margin` → excellent preparation; served
  quality bonus; `excellent_preparation` memory writes
- `skill ≈ prepDifficulty` → ordinary preparation; no bonus; no
  memory write
- `skill < prepDifficulty - margin` → botched preparation; served
  quality penalty; `botched_preparation` memory writes; customer
  satisfaction takes a hit proportional to the gap

Soft gating means a low-skill cook can still attempt a rare-tier recipe.
They will probably botch it, the player will see this happen, and the
sim will record why. Hard gating would prevent the attempt entirely and
discard the storyable failure.

The gap also feeds culinary_renown: serving a rare-tier recipe with
excellent preparation pushes renown up faster than serving a common-tier
recipe well.

## 4.4 Expeditions are the acquisition action for rare ingredients

A new `expeditionsModule` introduces a long-running action surface. The
player commissions an expedition by selecting:

- a **mode**: `open` or `targeted`
- a **runner**: a hireable adventurer NPC
- a **target tier** (open mode) or **target ingredient** (targeted mode)
- a **cost paid up front** (scales with mode, tier, and runner wages)

The expedition then runs in the background over `daysTotal` days. Each
day, `daysElapsed` increments. When `daysElapsed >= daysTotal`, the
expedition resolves: a single outcome roll using the expedition's named
RNG stream determines what comes back.

Expeditions do not produce daily updates, sub-events, or intermediate
state. Resolution is end-only. This is a deliberate scope choice — a
daily-tick model multiplies the surface area without obviously improving
the loop.

Both modes can return one of four results:

- `success`: target acquired in full quantity, quality high
- `partial`: target acquired in reduced quantity or quality
- `failure`: nothing returned; cost is sunk; runner is fine
- `runner_lost`: runner does not return; their hireable entry is removed

Outcome probabilities are biased by the runner's `experience` and
`reliability`, the target tier, and the mode. Targeted expeditions are
more expensive and have lower base success rates but produce a specific
ingredient when they succeed. Open expeditions are cheaper and almost
always return *something*, but you cannot predict what.

## 4.5 Adventurers are persistent NPCs

Hireable adventurers live in `state.world.hireableAdventurers`, capped
at 4–6 active. They are persistent NPCs, generated once via the existing
`npc_identity` RNG stream, with the existing `adventuring_bands`
naming profile.

Each adventurer carries:

- standard identity (`id`, `name`, `cultureId`)
- `experience` (0–100): rises with successful expeditions
- `reliability` (0–100): rises with successes, falls with failures
- `relationship` (0–100): rises with repeated hires, payment in full
- `specialty`: optional tag biasing what tiers/ingredients they're best at
- `wageBase`: base hire cost per expedition day
- `daysSinceLastJob`: drift counter
- `currentExpeditionId`: nullable; set during an active expedition

Adventurers drift out of the hireable roster after extended inactivity
(`daysSinceLastJob > threshold` with low recent relationship). New
adventurers drift in over time, gated on `culinary_renown` — a more
renowned tavern attracts more adventurer interest, which expands the
roster ceiling from 4 toward 6.

The existing `adventurers` customer group continues to exist as the
demand-side representation of adventuring bands. Hireable adventurers
are a separate slice of the same culture — adventurers who happen to be
between jobs and willing to take work. The same culture id binds both,
which makes cross-references natural in memory writes.

## 4.6 Culinary renown is a new reputation axis

A new reputation axis `culinary_renown` is added to
`state.reputation`. It rides alongside the existing nine
(`cheap, tasty, filthy, dangerous, cozy, strange, reliable,
goblinAuthentic, respectable`).

`tasty` and `strange` are insufficient for the loop because:

- `tasty` measures execution quality across all dishes
- `strange` measures oddity, which is sometimes a negative
- Neither captures fame for *sourcing*

Culinary renown rises from:

- successfully serving a recipe at `uncommon` tier or higher
- excellent preparation of a rare or legendary recipe
- a successful expedition resolution (the act of acquiring a rare
  ingredient registers, even before it's served)

Culinary renown falls from:

- botched preparation of a rare or legendary recipe
- rare/legendary ingredients spoiling unsold
- expedition failures involving named (relationship > 60) adventurers
- extended periods serving only `common` tier dishes (slow decay)

## 4.7 Niche customers are demand-side groups gated on renown

New customer groups appear in `state.customerGroups` but only become
active patrons once `culinary_renown` crosses their respective
thresholds. The thresholds are different per group, creating a
progression — early-renown niche visitors give way to high-renown ones
as fame grows.

Niche groups have aggressive `preferredStockTags` (they only show up
for specific recipe tiers or cultural tags) and aggressive decay rules:
if their preferred dishes haven't been served for N days, their
`patronage` drops and they leave the active roster.

This closes ISSUE-008's "fringe group" gap with groups whose existence
is *caused by* the system rather than slapped on independently.

## 4.8 Storage areas have gameplay weight

Two new areas earn their slot through gameplay function rather than
flavour:

- **Herb garden**: produces a slow, deterministic trickle of one or two
  `uncommon`-tier herb ingredients per week. Phases with the
  `growing_season` calendar tag boost the yield.
- **Cold cellar**: an upgrade-tier area that, when active, halves the
  spoilage rate of `rare` and `legendary` ingredients stored there.

The remaining 2–3 area additions can stay flavour-tier (private booth,
stage corner, etc.) — they fulfil ISSUE-006's un-pinning work, which is
still needed to spread `area:main_room` away from its current 52-hit
saturation.

---

# 5. State Shape Additions

This section enumerates the additions to `TavernState`. Field types and
schemas are sketched here at the level of "what exists and why" — the
exact Zod schemas land in the phase 65 implementation plan.

## 5.1 Stock model extension

```ts
// Extension to existing StockState
type StockState = {
  // ... existing fields (id, label, tags, quantity, quality, spoilage,
  //     basePrice, salePrice, storageAreaId) ...

  // NEW in phase 65:
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}
```

Rarity is the only new field on stock. Provenance, prepDifficulty, and
similar concerns live elsewhere — provenance in memories, prepDifficulty
on recipes. Resist adding more fields to stock during this arc.

## 5.2 Recipe registry and state

New registry: `recipeRegistry` in `src/sim/registries/recipeRegistry.ts`.

```ts
type RecipeDefinition = {
  id: string
  label: string
  inputs: { ingredientId: string; quantity: number }[]
  prepDifficulty: number  // 0-100
  demandTier: 'common' | 'uncommon' | 'rare' | 'legendary'
  culturalTags: string[]
  tags: string[]
}
```

New state field:

```ts
type TavernState = {
  // ... existing fields ...
  recipes: Record<string, RecipeState>  // keyed by recipe id
}

type RecipeState = {
  id: string
  label: string
  onMenu: boolean              // player flag — is this dish currently offered?
  timesServed: number          // lifetime count
  daysSinceLastServed: number  // for decay / niche customer attention
  lastServedDay: number | null
  tags: string[]
}
```

Recipes are not hardcoded in the engine. They register through
`ensureRequiredRecipesRegistered()` from the content layer.

## 5.3 Expedition state

```ts
type TavernState = {
  // ... existing fields ...
  expeditions: ExpeditionsState
}

type ExpeditionsState = {
  active: Expedition[]
  completed: ExpeditionRecord[]  // capped log of resolved expeditions
}

type Expedition = {
  id: string
  runnerId: string                  // adventurer NPC id
  mode: 'open' | 'targeted'
  targetTier?: 'uncommon' | 'rare' | 'legendary'    // open mode
  targetIngredientId?: string                       // targeted mode
  daysTotal: number
  daysElapsed: number
  costPaid: number                  // up-front payment
  rngStreamId: string               // named stream for resolution
  status: 'in_progress'
  startedDay: number
}

type ExpeditionRecord = {
  // snapshot of the Expedition at resolution time, plus:
  outcome: 'success' | 'partial' | 'failure' | 'runner_lost'
  returnedIngredients: { ingredientId: string; quantity: number; quality: number }[]
  resolvedDay: number
}
```

The `completed` log is capped (history pruning policy from ISSUE-022 will
later govern this; until then, cap to the most recent 50 records).

## 5.4 Hireable adventurer roster

```ts
type WorldState = {
  // ... existing fields ...
  hireableAdventurers: HireableAdventurer[]
}

type HireableAdventurer = {
  id: string                        // npc_<uuid>
  name: string                      // generated once via npc_identity RNG
  cultureId: 'adventuring_bands'
  experience: number                // 0-100
  reliability: number               // 0-100
  relationship: number              // 0-100
  specialty: string | null          // tag biasing target tier or category
  wageBase: number                  // coin per expedition day
  daysSinceLastJob: number
  currentExpeditionId: string | null
  joinedDay: number
}
```

Roster grows and shrinks over time. Drift rules:

- One drift event per week, evaluated by `adventurer_roster` RNG stream.
- If roster < soft cap and `culinary_renown` > threshold, a new adventurer
  may appear.
- If an adventurer has `daysSinceLastJob > 60` and `relationship < 40`,
  they may leave.
- Hard cap of 6 active. Soft cap starts at 4 and rises with renown.

## 5.5 Culinary renown axis

```ts
type ReputationState = {
  // ... existing nine fields ...
  culinary_renown: number     // 0-100
}
```

Initial value: 10 (the Crooked Keg starts with almost no culinary
reputation — it serves stew and ale and that's it).

## 5.6 Niche customer groups

New customer groups register through the existing `customerRegistry`. Each
gets a `minRenownThreshold` field on its definition:

```ts
type CustomerGroupDefinition = {
  // ... existing fields ...
  minRenownThreshold?: number    // 0-100; default: 0 (always available)
}
```

Existing groups (`local_goblins`, `miners`, etc.) get the default 0. New
niche groups get thresholds in the 30–80 range.

Active patronage of a niche group decays if their preferred recipe tags
haven't appeared in the served-recipes log for `groupSpecificDecayDays`.

## 5.7 Storage area metadata

Two area definitions gain new functional fields:

```ts
type AreaDefinition = {
  // ... existing fields ...
  ingredientYield?: {
    ingredientId: string
    perWeek: number
    boostedByCalendarTags: string[]
  }
  spoilageModifier?: {
    appliesToRarities: ('rare' | 'legendary')[]
    multiplier: number   // < 1 means slower spoilage
  }
}
```

The herb garden uses `ingredientYield`. The cold cellar uses
`spoilageModifier`. Other new areas use neither.

---

# 6. Subsystems

Implementation order maps to the ISSUE-NNN sequence in §10. This section
describes what each subsystem owns at runtime.

## 6.1 Stock-and-recipe model (ISSUE-025)

Adds the `rarity` field to stock. Introduces the `recipeRegistry` and the
`state.recipes` slice. Extends `serviceModule.resolveService` so customer
orders resolve to recipes, recipes consume their input ingredients from
stock, and `salePrice` is now computed from the recipe's served quality
(quality is the product of input ingredient quality and the cook's prep
multiplier).

Existing six stock items get rarity classifications (all `common`).
Existing service flow keeps working: there's a 1:1 starter recipe per
existing stock item.

## 6.2 Specialty supplier expansion (ISSUE-028)

Adds a second supplier per existing category whose `goodsProvided` may
include uncommon-tier ingredients. Adds one new category — "specialty
goods" — with one starter supplier providing 2–3 uncommon-tier
ingredients.

Specialty suppliers have lower base reliability and higher base prices
than common suppliers, but they are the only non-expedition path to
uncommon-tier goods.

## 6.3 Expedition subsystem (ISSUE-029)

Introduces `expeditionsModule`. Phase hooks:

- `onDayStart`: increment `daysElapsed` for each active expedition;
  resolve any whose `daysElapsed >= daysTotal`.
- Resolution uses the expedition's named RNG stream
  (`expedition_${expedition.id}`) so a re-loaded save resolves
  identically.

Owner action surface: `commissionExpedition({ runnerId, mode, target,
daysTotal, costPaid })`. The action validates that the runner exists, is
not currently on an expedition, and that the player can afford the cost.

Resolution writes ingredients into stock, emits cause entries against
`culinary_renown` (positive on success, negative on runner_lost involving
named adventurers), and updates the runner's stats.

## 6.4 Hireable adventurer roster (ISSUE-030)

Introduces the `hireableAdventurers` state slice and the weekly drift
rule. Names generated once via `npc_identity` stream. Reuses the existing
`adventuring_bands` naming profile registered in phase 24.

Phase hooks:

- `onWeekStart`: evaluate drift — one roster slot may turn over.
- `onExpeditionResolved` (new hook): adjust the runner's `experience`,
  `reliability`, `relationship`.

## 6.5 Cook tier grow + preparation gating (ISSUE-031)

Adds 3–4 new staff role definitions to `staffRegistry`:

- `kitchen_hand` — low-skill helper; can run prep on common recipes
  cleanly; botches anything uncommon+
- `seasoned_cook` — mid-skill; clean prep up to rare; botches legendary
- `master_chef` — high-skill; clean prep at all tiers; expensive
- `forager_cook` — niche; modest skill but reduces ingredient spoilage
  in the kitchen by a small percentage when working

(The full role list is finalized in the phase plan; these are
direction-setting examples.)

Adds the prep difficulty check in `serviceModule.resolveService`. The
check is the same soft-gate rule described in §4.3.

Memory writes: `excellent_preparation` (cook id, recipe id, customer
group, day), `botched_preparation` (cook id, recipe id, gap severity,
day).

## 6.6 Culinary renown and reputation (ISSUE-027)

Registers the `culinary_renown` axis in `reputationRegistry`. Wires
producers in:

- `serviceModule`: positive drift on each rare-tier+ recipe served well
- `serviceModule`: negative drift on each botched rare-tier+ prep
- `expeditionsModule`: small positive drift on successful expedition
- `expeditionsModule`: negative drift on `runner_lost` involving a
  named adventurer
- `stockModule`: negative drift on spoilage of rare-tier+ ingredients

Each drift carries a cause entry with `relatedActors` (cook, runner,
recipe, ingredient, customer group as appropriate).

Niche group decay reads `culinary_renown` and the recent served-recipes
log when evaluating whether a group remains in the active roster.

## 6.7 Demand-side niche customer groups (ISSUE-032)

Adds 4–5 new customer groups to `customerRegistry`, each gated on a
specific `minRenownThreshold`. Example archetypes:

- **Gourmand** — threshold 30; tips well; demands quality on uncommon
  recipes
- **Foreign envoy** — threshold 55; large groups; demands cultural-tag
  match; relationship-sensitive
- **Eccentric noble** — threshold 70; very high spend, very high
  filth-intolerance, very rare
- **Food critic** — threshold 50; rare visits but writes a memory that
  swings `culinary_renown` heavily either way

Each new group carries `preferredStockTags` aligned with recipe tags
(rare ingredients, specific cultural cuisines).

These groups appear in `state.customerGroups` from day zero but are
inactive (`patronage: 0`) until their threshold is crossed. They decay
to inactive again if their preferences go unmet.

## 6.8 Storage areas with gameplay weight (ISSUE-033)

Adds 4–6 new area definitions in `areaRegistry`. Two of them carry
gameplay weight (herb garden, cold cellar) as described in §5.7. The
remainder are atmospheric.

Also handles ISSUE-006's original un-pinning work: removes the eight
hardcoded `areaRef('main_room')` writes in
`src/sim/modules/issues/issueSeedGenerators.ts` and replaces them with
picker-driven or state-driven area selection.

This phase also handles **integration polish**:

- Memory keys: ensure `expedition_success`, `expedition_failure`,
  `runner_lost`, `botched_preparation`, `excellent_preparation`,
  `rare_ingredient_spoiled`, `served_rare_dish`, `niche_visitor_arrived`
  are all consumed by at least one downstream calculator or seed
  generator.
- Cause attribution: confirm `relatedActors` is non-empty for every new
  cause type, per the ISSUE-003 rule.
- Pressure interactions are wired (see §9).

---

# 7. RNG Streams

The expansion arc established named RNG streams for identity-style
randomness. This arc adds four more:

| Stream id | Owner | Purpose |
|---|---|---|
| `expedition_<expeditionId>` | expeditionsModule | Outcome roll for a single expedition. Created at expedition commission; consumed at resolution. |
| `adventurer_roster` | hireableAdventurers slice | Weekly drift: who arrives, who leaves. |
| `niche_customer_arrival` | customerModule | Daily roll for niche-group visits when their threshold is met. |
| `ingredient_quality_<expeditionId>` | expeditionsModule | Quality of ingredients returned on success/partial outcomes. |

The existing `npc_identity` stream is reused for adventurer name
generation. No new stream is needed for that.

The streams are registered through the existing Phase 24 stream
registration mechanism. ISSUE-023 (RNG stream prune or wire) currently
tracks the unused `npc_identity` stream — ISSUE-004 wired one consumer;
this arc adds another (adventurer generation), which further validates
the stream's value.

---

# 8. Memories, Causes, and Attribution

New memory keys introduced by this arc:

| Memory key | Written by | Owner entity | Purpose |
|---|---|---|---|
| `expedition_success` | expeditionsModule | tavern + runner | Records the win, the haul, the runner. |
| `expedition_failure` | expeditionsModule | tavern + runner | Records the loss. Affects runner reliability. |
| `runner_lost` | expeditionsModule | tavern + runner | Permanent: runner removed from roster. |
| `excellent_preparation` | serviceModule | cook + recipe | Drives positive renown drift. |
| `botched_preparation` | serviceModule | cook + recipe | Drives negative renown drift; staff_burnout pressure. |
| `rare_ingredient_spoiled` | stockModule | tavern + ingredient | Drives stock_shortage and food_safety pressures. |
| `served_rare_dish` | serviceModule | customer group + recipe | Drives niche customer satisfaction and patronage. |
| `niche_visitor_arrived` | customerModule | customer group | Records the threshold crossing. |

Every cause entry written by this arc must include `relatedActors`. This
is the rule established by ISSUE-003 — calculators that emit causes with
empty `relatedActors` are silent and don't surface in reports. None of
the new producers may regress that rule.

The attribution rules from Phase 37 apply: rumours, credit, and blame
flow through the same paths as existing systems. A niche customer
arriving credits the recipe that attracted them, not the cook (unless
the recipe was served excellently in their last visit).

---

# 9. Pressure Interactions

The arc connects to existing pressures rather than creating new ones.
Pressure updates are additive — the existing calculator inputs continue
to fire; new inputs join them.

| Existing pressure | New input | Direction |
|---|---|---|
| `stock_shortage` | rare-ingredient spoilage | ↑ |
| `food_safety` | rare-ingredient spoilage | ↑ (rare, especially legendary) |
| `staff_burnout` | repeated `botched_preparation` memories | ↑ |
| `supplier_distrust` | specialty supplier failures | ↑ |
| `reputation_drift` | culinary_renown volatility | ↑ (large swings either direction) |
| `debt` | expedition cost overrun on failed runs | ↑ |

No new pressure types are introduced by this arc. The expansion arc's
pressure web is rich enough; further axes would add complexity without
clear gameplay return.

---

# 10. Issue Breakdown

The arc decomposes into nine issues in `docs/ISSUE_TRACKER.md`. Each
issue's full Evidence/Impact/Scope/Depends-on/Test-approach lives in the
tracker; the summaries below show the dependency chain.

| ID | Title | Depends on | Phase |
|---|---|---|---|
| ISSUE-025 | Stock-and-recipe model extension | — | 65 |
| ISSUE-026 | Ingredient + starter recipe catalog grow | ISSUE-025 | 66 |
| ISSUE-027 | Culinary renown reputation axis | ISSUE-025, ISSUE-026 | 67 |
| ISSUE-028 | Specialty supplier expansion | ISSUE-002, ISSUE-026 | 68 |
| ISSUE-029 | Expedition subsystem | ISSUE-030 | 69 |
| ISSUE-030 | Hireable adventurer roster | ISSUE-004, ISSUE-026 | 70 |
| ISSUE-031 | Cook tier grow + preparation gating | ISSUE-025, ISSUE-026 | 71 |
| ISSUE-032 | Demand-side niche customer groups | ISSUE-027, ISSUE-026 | 72 |
| ISSUE-033 | Storage areas + system integration polish | all above | 73 |

The dependency chain forces a clear order: model first (025), data
second (026), reputation and acquisition paths next (027, 028, 030,
029), preparation and demand (031, 032), integration last (033).

ISSUE-030 lands before ISSUE-029 because expeditions need an adventurer
roster to commission against — the runner NPC must exist before the
expedition that hires them can.

---

# 11. System-Level Acceptance Criteria

These criteria apply across the arc. Each per-issue phase plan inherits
them and may add specific acceptance criteria of its own.

**Determinism and replay**

- Same seed + same player input + same days = same expedition outcomes,
  same adventurer drift, same niche customer arrivals.
- Saving mid-expedition and reloading produces the identical resolution.
- An extra niche-customer arrival roll does not shift the next
  expedition's outcome (named streams must isolate).

**State integrity**

- `state.stock`, `state.recipes`, `state.expeditions`, and
  `state.world.hireableAdventurers` round-trip through Zod schemas with
  no data loss.
- No `Map`, `Set`, function, or class instance appears anywhere in these
  state slices.
- Cross-reference validation passes: every recipe input id exists in
  `stockRegistry`; every expedition `runnerId` exists in
  `hireableAdventurers`; every niche group `minRenownThreshold` is
  finite.

**Cause attribution**

- Every culinary_renown change carries a cause entry.
- Every cause entry written by new producers has a non-empty
  `relatedActors`.
- The named-entity-repetition report shows new entities (recipes, niche
  groups, adventurers) participating in seed family rotation.

**Loop closure**

- A 90-day deterministic playtest starting from default state can reach
  `culinary_renown >= 60`, trigger at least one niche group arrival, and
  resolve at least three expeditions.
- The same playtest with the player ignoring expeditions and rare
  ingredients keeps `culinary_renown <= 25`.

**Existing systems**

- Existing tests (`tests/sim/phase2…phase40`) continue to pass without
  modification. Where a phase test reads stock items or staff roles by
  index or count, the test is updated to read by id.
- No existing module file is rewritten. New behaviour arrives as new
  fields, new phase hooks, and new modules.

---

# 12. Do Not Do

These are explicit guardrails for the arc. Each is a foot-gun observed
elsewhere in the project's planning history.

**Do not introduce per-batch ingredient identity.** Rarity is a property
of the ingredient type, not of each batch. Per-batch identity (this
truffle is from the Bog, that one from the Northwood) makes the stock
model 5× more complex and provides no gameplay return that memory
entries don't already provide.

**Do not add a multi-input recipe registry in this arc.** Every starter
recipe is 1:1. Multi-input recipes are listed in §13 as a future
expansion. Adding them now bloats ISSUE-025 and ISSUE-026 and creates
balancing problems before the simpler model has shipped.

**Do not produce card prose.** Phase 21 forbids finished card text
across the entire expansion arc. This arc inherits that rule. Memory
writes, niche group descriptions, expedition outcome labels are all
*text ingredients* — structured fields that future cards will consume.
They are not card text.

**Do not pin entities in seed generators.** ISSUE-006's un-pinning
problem (`areaRef('main_room')` hardcoded eight times) is exactly the
kind of trap the expansion arc was supposed to prevent. New seed
generators must select entities through the picker or through state
queries, never through string-literal binding.

**Do not previewable expedition outcomes.** The Phase 20 response-intent
preview surface explicitly does not apply to expeditions. The gamble is
the point. The outcome roll happens once at resolution and is not
re-rolled or surfaced in advance.

**Do not deeply rewrite `stockModule`, `serviceModule`, `customerModule`,
or `staffModule`.** Extend them with new fields and new phase hooks.
Phases 28–35 of the expansion arc established this rule explicitly: light
additive integration. The same rule applies here.

**Do not stratify culinary renown across multiple axes.** A single
`culinary_renown` axis covers the loop — having rare ingredients and
serving them well both feed the same fame. Splitting it into separate
"sourcing" and "execution" axes triples the cause-attribution surface
without changing the gameplay outcome.

**Do not generate adventurer names at hire time.** Adventurer names are
generated once at NPC creation through the `npc_identity` stream, stored
in state, and reused. Regenerating a name when the hire screen is
re-rendered is exactly the failure mode Phase 24 introduced named
streams to prevent.

---

# 13. Future Expansion Hooks

This arc is designed so the following extensions can land later without
touching the core loop:

- **Multi-input recipes.** The recipe registry's `inputs` field is
  already a list. Future content can register recipes with 2–4 inputs.
  Service flow, memory writes, and customer demand all already point at
  recipes, so the upgrade is content-only.
- **Regional cuisines.** Recipe `culturalTags` already exist. Future
  cultures or factions can prefer or reject specific cuisine tags
  without engine changes.
- **Per-runner stories.** Adventurers are persistent NPCs with cause
  attribution on every expedition. A future arc could surface
  adventurer-specific story beats (a runner who keeps finding the same
  uncommon ingredient develops a reputation for it; a runner who
  survives a `runner_lost` near-miss develops a tag).
- **Black-market suppliers.** A future supplier subtype could provide
  rare-tier ingredients at high cost and high `food_safety` pressure
  risk — a third acquisition path between specialty suppliers and
  expeditions.
- **Expedition events.** The current end-only resolution leaves the
  door open for daily expedition events later (a runner sends a courier
  message, a partial outcome triggers a side-decision). These are
  additive — the existing end-roll continues to fire if no daily event
  intervenes.
- **Recipe specialization for cooks.** A future staff field could let
  individual cooks specialize in specific recipe tags, modifying their
  effective skill against those recipes. The existing
  `prepDifficulty`-vs-`skill` mechanism extends naturally.

None of these are in scope for ISSUE-025 through ISSUE-033. They are
listed here so the design choices in this arc do not foreclose them.

---

# 14. Glossary

- **Ingredient**: a stock item with a rarity tier.
- **Recipe**: a derived dish that consumes ingredients and is what
  customers order.
- **Expedition**: a long-running action where a hireable adventurer is
  paid to fetch ingredients.
- **Open expedition**: a non-specific expedition — the runner returns
  with whatever they find.
- **Targeted expedition**: an expedition aimed at a specific ingredient.
- **Hireable adventurer**: a persistent NPC in
  `state.world.hireableAdventurers` who can be commissioned for
  expeditions.
- **Culinary renown**: the new reputation axis tracking the tavern's
  fame for rare ingredients and excellent preparation.
- **Niche customer group**: a customer group whose patronage activates
  only when `culinary_renown` crosses a threshold.
- **Rarity tier**: the four-step scale (common, uncommon, rare,
  legendary) applied to ingredients and recipes.
- **Prep difficulty**: the cook skill threshold for clean preparation
  of a recipe.
- **Soft gate**: a failure mode where the action still occurs but
  produces a bad outcome (vs a hard gate that blocks the action).
