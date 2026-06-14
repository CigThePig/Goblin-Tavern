# Teleology Phase 2 — Openings as the Real Entry Path

Phase 1 proved the kernel + venture spine on a single dev-spawned venture.
Phase 2 replaces the dev-only spawn with the **world-offers-commit** loop:
openings appear, committing to one spawns a venture, ignoring one lets it
decay and either return (causally mutated) or die. This is the production
entry path to ventures.

## What shipped

### sim (`src/sim/`)

- **Venture blueprint catalog** (`modules/ventures/ventureCatalog.ts`).
  Generalizes Phase 1's single hardcoded venture into a registry keyed by
  blueprint id (= venture id; a venture is a singleton ratchet). Each
  blueprint supplies `createEntry`, the kernel `definition`, an
  `openingApplies(state)` keying predicate, and opening copy. `ventureModule`
  now advances **every** active venture through its catalogued definition
  rather than referencing one id; the response applier spawns a venture by
  blueprint id.

- **Openings module** (`modules/openings/`). A `startDay` hook
  (`openingsModule`) — registered after `ventureModule`, before
  `issueSeedsModule` so the generator reads an up-to-date store — that owns
  all RNG-driven / structural lifecycle transitions:
  - **Cold-bootstrap:** offers an opening for any blueprint whose keying
    condition is met with no venture and no prior record. The liquor-licence
    blueprint keys off `tavernIdentity` (non-empty at day 1), so a fresh save
    offers an opening on day 1 with zero ventures.
  - **Commit detection:** when a venture exists for an opening's blueprint
    (spawned by the "pursue" response through the applier), the opening is
    retired with a `commit` cause.
  - **Parking:** an opening ignored past its active window
    (`OPENING_ACTIVE_WINDOW_DAYS`) is parked with a snapshot of its keyed
    meters and a return deadline.
  - **Return/death (the windowed accumulator):** a parked opening's snapshot
    is compared against current meters (`classifyReturnDelta`, pure). A
    qualifying delta re-offers the opening, mutated by the delta's sign
    (`valence`), with a cause citing the movement; otherwise it dies after
    `OPENING_RETURN_WINDOW_DAYS` with a `death` cause. The branch is
    **causal** (sign of the delta); RNG (`opening:<day>:<id>` dynamic stream)
    only spreads the return across the window.
  - **Opening generator** (`openingIssueSeeds.ts`): a pure reader of the
    store emitting `opportunity` seeds in the new `opening` family, with a
    "pursue" response (consequence profile spawns the venture via the
    applier's `ventures.<id>.spawn` path) and a "decline" no-op. Resolves its
    entity from the record's blueprint — never a hardcoded id (guardrail §10).

- **`teleologyUnlocked(state)`** (`modules/openings/teleologyUnlock.ts`):
  the single forward-compatibility predicate the opening generator + module
  route through, hardcoded to `true`. Progressive-onboarding gating later
  becomes a one-line change here.

- **Hand-composition budget** (`modules/issues/handBudget.ts`): a pure,
  post-ranking selection step in each `runGenerationPass` that bounds the
  hand to a budget while reserving slots for teleology (`venture`/`opening`)
  vs triage seeds, so low-severity teleology seeds are never crowded out. A
  no-op when the ranked set is under budget; replay-deterministic.

- **Applier spawn path:** both `ctxApplier` and `cloneApplier` handle
  `ventures.<id>.spawn`, looking the blueprint up in the catalog and spawning
  through `ctx.addVenture` (idempotent if the venture already exists).

- **Unions:** `opening` added to `IssueSeedFamilyId` /
  `EXPANDED_ISSUE_SEED_FAMILIES`.

### cards (`src/cards/`)

- `templates/opening.ts` — plain-render card (like the venture card),
  exempted from the compose gates via `NON_COMPOSITIONAL_CARD_IDS`. Resolves
  the opening record from the seed target.

## Cross-cutting constraints / guardrails honoured

- **Determinism (§2.2):** return rolls take a dynamic `opening`-keyed stream
  by day + record id (the segment stream resets to the base seed daily, so a
  single-consumer `getRngStream('opening')` would be constant). Replay test
  in the heavy tier.
- **Effect routing / polarity (§2.3/§2.4):** teleology effects target
  `ventures.*` (spawn/progress), never a pressure id; a fast-tier guard scans
  the real authored opening consequence-profile effects and asserts ≥1 real
  effect first (guardrail §9).
- **Diff visibility (§2a.7):** openings live in module state
  (`state.modules.openings`), already walked by `diffModules`; lifecycle
  transitions emit explicit causes (`bootstrap`/`park`/`return`/`death`/
  `commit`).
- **Authoring (§2.6):** opening card is plain-render and gate-exempted, the
  same precedent Phase 1 set for the venture card.

## Tests

- Fast (`tests/sim/teleologyPhase2.test.ts`): cold-bootstrap ≥1 opening with
  zero ventures; commit→spawn→retire; causal return-delta branch selection;
  budget reservation + no-op-under-budget; hand within budget; pressure-target
  guard.
- Heavy (`tests/sim/teleologyPhase2.heavy.test.ts`, in `HEAVY_TEST_GLOBS`):
  ignore→park→death; ignore→park→causal return; commit path; replay
  determinism over many days.
