# Phase 1 — Signal Surface (Voiced Surface arc, ISSUE-096 / phase 127)

## Context

The Voiced Surface arc (`docs/plans/voiced-surface-arc.md`) finishes what Living Cast started: every diegetic line in the game speaks through one tested composition layer that *states what actually happened* (sim-backed) and *how this character feels about it* (flavor). Today's blocker is structural — the sim's truth isn't *reachable* by the snippet layer. The two shipped compositional pools (`drinkOrder`, `staffAside`) only use `voiceAxis`/`verbalTic`; `drink_order`'s `sim_backed_hook` slot is `DISABLED_FOR_SPIKE` because "the underlying sim signals do not yet exist" (`specs/cards/drink_order.spec.yaml:39–47`). The `repeatCount` condition is declared in the DSL but its evaluator always returns `false` (`src/cards/compose/conditions.ts:119–125`). And the four target situations the doc highlights (supplier reliability tier, staff blame-mode, faction relation tier, area condition + maintenance pressure) all need to state *what happened* in terms the DSL cannot currently express.

This phase fixes that at the simulation layer. After it lands, snippet conditions gate on real sim facts (band tiers, repeat count, rising pressure) by querying a small, pure, read-only **signal surface** inside `src/sim/` — never by string-sniffing `textIngredients`. The DSL stays data, stays inspectable, and grows by exactly **one** new primitive. No snippets are authored; no situations are migrated. The deliverable is the machine that makes Phase 3's establishing-line spike (and every migration after it) possible.

## Approach

### 1. Signal surface — new `src/sim/signals/` module

Pure functions over `TavernState` (no closures, no RNG, no mutation, no context dependency). The architecture matches the precedent set by `src/sim/core/context.ts:256–336` (thin readers like `getCulture`, `getMemoriesByTag`) but lives outside `SimContext` because the card layer is the consumer, not modules. Pattern decision is documented in the file header.

New files:

- `src/sim/signals/index.ts` — single import surface; re-exports the functions below and the `SignalId` / `BandId` types.
- `src/sim/signals/types.ts` — `SignalId` (string-union of the numeric band signals listed below), `BandId` (`'low' | 'mid' | 'high'`), `SignalResult` (`{ band?: BandId; missing?: true }`).
- `src/sim/signals/bands.ts` — band threshold tables as data (`BAND_THRESHOLDS: Record<SignalId, [number, number]>` — two cut-points, three bands). Tables are exported so the gates can enumerate band ids per signal.
- `src/sim/signals/numeric.ts` — `supplierReliabilityBand`, `supplierRelationshipBand`, `staffStressBand`, `staffFatigueBand`, `factionRelationshipBand`, `factionInfluenceBand`, `areaConditionBand`, `areaCleanlinessBand`. Each is a 2-line wrapper around a shared `bandOf(value, thresholds)` helper.
- `src/sim/signals/repeats.ts` — `repeatCountByTag(state, subjectTag, windowDays = 28)`. Counts `state.memories.filter(m => m.tags.includes(subjectTag) && (today − m.day) <= windowDays).length`. The window is a named constant; tests assert it.
- `src/sim/signals/pressures.ts` — `pressureTrend(state, pressureId)`. Thin re-export of the existing `pressureRising` logic from `conditions.ts:100–111` so the snippet DSL and the signal surface share one source of truth (and a Phase 1 test asserts they agree).
- `src/sim/signals/query.ts` — the unified `querySignal(state, signal, ref)` dispatcher used by the DSL; one switch arm per `SignalId` returning a `SignalResult`. Resolves entity kind from `ref.kind` and refuses signals whose kind doesn't match.

Tests under `tests/sim/phase127.signals.*.test.ts`:
- Boundary tests for every band (value at low/high threshold, value at edges).
- Determinism: `result(state) === result(structuredClone(state))`.
- `repeatCountByTag` window correctness (memory just inside / just outside window).
- `pressureTrend` parity with `evalCondition({ kind: 'pressureRising' })`.

### 2. DSL extension — **one** new primitive

In `src/cards/compose/types.ts`, add to `SnippetCondition`:

```ts
| { kind: 'signalEquals'; role: string; signal: SignalId; equals: BandId }
```

Why one primitive: the framework's `§2.3` rule ("deliberately small … no OR/NOT/nesting until 100+ snippets exist and concrete gaps demand them") argues for the minimum surface that covers the audit's needs. `signalEquals` is data, trivially evaluable (one signal lookup + string compare), and trivially enumerable (the gates can ask the signal surface for the valid bands of any `SignalId`). It covers every band tier in one shape; ordered-band comparisons (`signalAtLeast`) and enum-valued signals (when categorical signals like blame-mode arrive — see §6) are deferred until a real authoring need demands them.

In `src/cards/compose/conditions.ts`, add the arm:

```ts
case 'signalEquals': {
  const ref = resolveActorRef(condition.role, seed)
  if (!ref) return false
  const result = querySignal(state, condition.signal, ref)
  if (result.missing) return false
  return result.band === condition.equals
}
```

### 3. Wire `repeatCount`

Replace the always-false body at `src/cards/compose/conditions.ts:119–125`:

```ts
case 'repeatCount':
  return repeatCountByTag(state, condition.subjectTag) >= condition.atLeast
```

No schema migration: this reuses `state.memories[].tags`. A Phase 1 test seeds memories with a subject tag and asserts `repeatCount` resolves correctly across the 28-day window boundary.

### 4. Verify `pressureRising` already reaches the ids that matter

No code change expected. Add `tests/sim/phase127.pressureIds.test.ts` asserting the pressure ids the broken-card audit names — `stock_shortage`, `maintenance`, `supplier_distrust`, `faction_anger`, `staff_loyalty_risk`, `customer_loss`, `rumour_pressure`, `market_instability`, `food_safety`, `inspection`, `violence` — are each published into `state.pressures` or `state.modules.pressures.snapshots` after a simulated day where their underlying state shifts. If one fails, fix the publication in `src/sim/modules/pressures/pressureModule.ts` (additive; do not rewrite).

### 5. Reclassify TextIngredients (contract clarification, no schema change)

The `TextIngredients` shape (`src/sim/modules/issues/issueSeedTypes.ts:220–236`) is **not** modified — it has non-card consumers. The split is contract-level:

- Add an exported constant `TEXT_INGREDIENT_ROLE: Record<keyof TextIngredients, 'signal-backed' | 'flavor-seed'>` next to `TEXT_INGREDIENT_LIMITS`. The numeric fields (`recentContext`, `pressureContext`, `marketContext`, `perceivedBlame`) are marked `signal-backed`; the sensory fields (`sensoryDetails`, `actorOpinions`, `socialContext`, `relevantMemories`, `calendarContext`, `arcContext`) stay `flavor-seed`. `subject`, `problemNoun`, `stakesReadable`, `namedEntities` are structural / referential and marked `flavor-seed` (snippets read them as labels, not as truth claims).
- Append a paragraph to `docs/plans/cards-contract.md §3.3` documenting that `sim_backed` slots must reach for signals; `flavor-seed` ingredients may be read by `flavor` slots as decoration.
- Phase 1 changes no consumer — this is the contract for the migrations that follow.

### 6. Re-enable `drink_order`'s `sim_backed_hook` *in principle*

No new snippet authored (Phase 3's spike does that). What this phase delivers:
- Lift `sim_backed_hook` from `status: DISABLED_FOR_SPIKE` to `status: SIGNAL_AVAILABLE` (a comment-level change in `specs/cards/drink_order.spec.yaml`) with a note pointing at the signal surface.
- Add a test `tests/cards/compose/phase127.simBackedHookSignal.test.ts` that constructs an `IssueSeed` whose primary actor is a known regular customer and asserts a `signalEquals` condition on that role resolves through `querySignal` — i.e. the signal reaches, even though no snippet is wired into the live pool.

### 7. Gate updates

Two of the six Phase-D gates need to learn about the new primitive:
- `src/cards/compose/gates/simCoherence.ts` — extend the "state-lookup condition" list so a non-fallback snippet in a `sim_backed` slot may satisfy the rule with a `signalEquals` alone. Currently the list is `pressureRising | memoryPresent | repeatCount | hasNamedEntity`.
- `src/cards/compose/gates/specificity.ts` — `signalEquals` counts as a specifying condition (+1 specificity) under the existing `s.specificity ?? s.conditions.length` rule, so no change. Add a regression test that asserts it.

The other four gates (coverage, voice-bounds, determinism, diversity) need no update; the new primitive is data and enumerates the same way.

---

## Explicit deferrals (documented gaps the next phases will hit)

### Blame-mode classification — deferred

**Decision (this phase): defer.** The doc's Phase 1 audit lists "staff blame-mode" as one of four target situations. Of the four, three (supplier reliability tier, faction relation tier, area condition) sit on numeric fields already in `TavernState` and become signals as a purely additive change. Blame-mode is the outlier: there is no underlying classification today. `perceivedBlame: string[]` (`issueSeedTypes.ts:231`) is pre-rendered prose produced by `strongestAttributionText(ctx.state, ref, ['blame', 'distrust'])` in seed generators (`expandedSeedGenerators.ts:186, 1827, 2153`). It carries no discrete "publicly blamed vs quietly slighted vs self-blamed" enum.

**Why deferred, not built now:**
- Surfacing blame-mode honestly requires an *additive sim* change (a `blameMode?: BlameMode` field on memories or on the response-resolver path), a verb→mode data table over `ResponseIntentVerb`, and recording-site changes at the response-resolution path that writes memories for staff targets. That work materially expands Phase 1's footprint beyond "make existing sim truth queryable."
- The doc explicitly anticipates this kind of gap: "Expect *one* loop back from Phase 3 to Phases 1–2 (the spike will name a missing signal or a missing axis) — that is the system working." Phase 3's spike picks supplier (one number, one relationship, unambiguous "what happened"), which is fully covered by §1–6 above. Staff blame-mode is not on the spike's critical path.
- Phase 7 (Staff & Personnel migration, ISSUE-102 / phase 133) is the first downstream phase that needs blame-mode to land its `staff_burnout` / `staff_request` cards. It is the natural place for the additive sim change — co-located with the snippet authoring that exercises it.

**Contract for the deferral — what Phase 7 (or whichever phase first authors a staff blame card) must do:**

1. **Schema** — add optional `blameMode?: BlameMode` to `MemoryDraft` and `MemoryState` (`src/sim/modules/memories/memoryTypes.ts`). Zod: `z.enum(['public', 'private', 'self']).optional()`. Defaults to undefined; existing saves load unchanged (no migration step needed).
2. **Recording** — in the response-resolver path (`src/sim/modules/responses/`), add a `BLAME_MODE_BY_VERB: Record<ResponseIntentVerb, BlameMode | undefined>` data table (e.g. `Blame → 'public'`, `Cover up → 'private'`, `Apologize → 'self'`). When the resolver writes memories targeting a staff entity, stamp `blameMode` from the table. Exhaustiveness test required.
3. **Signal** — add `src/sim/signals/blame.ts` with `latestBlameMode(state, staffId, windowDays = 14)`. Scans memories tagged with the staff id, returns the most recent qualifying memory's `blameMode` (or undefined).
4. **DSL** — the existing `signalEquals` primitive covers blame-mode if its second-arm type widens from `equals: BandId` to `equals: BandId | BlameMode`. That widening is *additive* (no existing snippet uses `equals`'s string set yet). Alternatively, a sibling primitive `signalEnum` lands at that time. Both options are reachable from Phase 1's shape and the choice is the migrating phase's to make.
5. **Gate update** — `simCoherence`'s state-lookup whitelist already includes `signalEquals`; no further change needed.

**Why this is safe to defer:**
- No Phase 1 deliverable depends on blame-mode. The supplier-led spike works fine.
- No existing card or test references blame-mode discretely; the prose path through `perceivedBlame` keeps working for the (still-legacy) `staffRequest` / `staffBurnout` templates until they migrate.
- The shape of the deferred work is small, localized, and additive — it does not invalidate any Phase 1 decision.

### Other audit candidates the doc lists — also deferred

- **`relationshipTier` as its own primitive** — folded into `signalEquals` (the `supplier.relationship` / `faction.relationship` band signals cover it). The doc's `§1` framing of relationshipTier is treated as a *signal*, not a primitive.
- **`namedEntityRole`/tenure read** — none of the four audit targets force tenure. Deferred to whichever migration first needs a "this regular has been coming for years" gradient. Lands as an additive signal (`entityTenureDays(state, ref)`) + either a sibling primitive or a widening of `signalEquals`'s value set. No Phase 1 cost.
- **Ordered-band comparisons (`signalAtLeast`)** — `signalEquals` is the v1; ordered comparisons are deferred until an authoring need surfaces. The framework's §2.3 rule explicitly licenses this kind of late expansion.

---

## Critical files

- New: `src/sim/signals/{index,types,bands,numeric,repeats,pressures,query}.ts`
- Edit: `src/cards/compose/types.ts` — add `signalEquals` to `SnippetCondition`.
- Edit: `src/cards/compose/conditions.ts` — wire `signalEquals`, replace always-false `repeatCount` body.
- Edit: `src/sim/modules/issues/issueSeedTypes.ts` — add `TEXT_INGREDIENT_ROLE` next to `TEXT_INGREDIENT_LIMITS`.
- Edit: `src/cards/compose/gates/simCoherence.ts` — include `signalEquals` in the state-lookup whitelist.
- Edit: `specs/cards/drink_order.spec.yaml` — relabel `sim_backed_hook` status.
- Edit: `docs/plans/cards-contract.md §3.3` — short paragraph on the signal-backed / flavor-seed split.
- Edit: `docs/ISSUE_TRACKER.md` — mark ISSUE-096 / phase 127 as `done` when the work lands; the tracker entry must call out blame-mode as a Phase 7 dependency.

## Reuse — existing utilities the plan leans on

- `resolveActorRef`, `resolveActorCastAttributes` (`src/cards/compose/conditions.ts:24–44`) — reused unchanged for the `signalEquals` arm.
- `state.memories[].tags` indexing pattern — reused unchanged for `repeatCountByTag`.
- `state.pressures[id].trend` + `state.modules.pressures.snapshots[id]` (`src/cards/compose/conditions.ts:100–111`) — reused unchanged; `pressures.ts` is a thin re-export to share the source.
- The `cooldowns` / `recentPicks` structures in `IssueSeedModuleState` (`src/sim/modules/issues/issueSeedTypes.ts:339–360`) — *not* used for `repeatCount` (they track family-level picks, not subject-tag occurrences); memory-tag count is the right shape.

## Verification

End-to-end checklist before declaring the phase done:

1. **Unit-level**: `npm test -- phase127` — every new test file passes:
   - `phase127.signals.numeric.test.ts` (band thresholds + boundary cases for 8 band signals)
   - `phase127.signals.repeats.test.ts` (window arithmetic + tag matching)
   - `phase127.signals.pressureTrend.test.ts` (parity with `evalCondition({pressureRising})`)
   - `phase127.signalEquals.condition.test.ts` (band arm; missing actor → false; unmatched value → false; wrong-kind ref → false)
   - `phase127.repeatCount.condition.test.ts` (formerly always-false; now resolves with the memory-tag window)
   - `phase127.pressureIds.publication.test.ts` (the 11 pressure ids show up in state after relevant transitions)
   - `phase127.textIngredientRole.test.ts` (`TEXT_INGREDIENT_ROLE` is exhaustive over `keyof TextIngredients`)
   - `phase127.simBackedHookSignal.test.ts` (the `sim_backed_hook` signal reaches in principle)

2. **Schema round-trip**: `npm test -- schemas` — `TavernState` Zod schema unchanged by Phase 1 (no schema migration in this phase). Existing saves continue to load.

3. **Determinism**: `npm test -- determinism` — existing determinism gates remain green; a fresh determinism test asserts `querySignal(state, …) === querySignal(structuredClone(state), …)` for all signals.

4. **Existing pools**: `npm test -- drinkOrder staffAside` — both compositional pools render identically to today (the DSL extension and the new arm are additive; no existing snippet uses `signalEquals` or `repeatCount`).

5. **Static**: `npm run typecheck` green.

6. **Tracker**: `docs/ISSUE_TRACKER.md` — flip ISSUE-096 to `Status: done`, `Phase: 127`. The tracker entry's `Test approach` / followup section must explicitly note that blame-mode is deferred and call out Phase 7 (ISSUE-102) as its landing place, referencing the deferral contract in this plan.

## Out of scope (do not do)

- No snippets authored. The signal surface enables Phase 3; Phase 1 does not write prose.
- No OR / NOT / nesting added to the DSL.
- No new condition primitives beyond `signalEquals`. The candidates `relationshipTier` and `namedEntityRole`/tenure are folded into `signalEquals` (band signals cover tiers) or deferred (tenure isn't forced by the four audit targets).
- **No blame-mode work in Phase 1.** No `blameMode` field added to memories; no verb→mode table; no recording-site changes in `responses/`; no `blame.ts` signal file. See the "Explicit deferrals" section above for the full contract handed to Phase 7.
- No rewrite of supplier / staff / faction / area modules. Phase 1 is read-only over those subtrees.
- No use of `Math.random()` anywhere; signals are pure and deterministic over `TavernState`.
- No removal of `textIngredients` fields. The split is contract-level (`TEXT_INGREDIENT_ROLE`) plus documentation.
- No changes to the API pipeline (`scripts/generate-pool/`) — that's Phase 4's job.
