# Codebase audit — 2026-06-10 (II): autosave outgrows localStorage by day ~12 — persistence collapses mid-campaign

A second targeted audit on the same day as
`2026-06-10-recipe-consumption-audit.md` (whose four findings are fixed
and were excluded from this pass). This pass combined static review of
the sim core, card/report layer, and web persistence with **empirical
long-run probes** (120–150-day cardless runs, 90-day runs under all ten
Phase-20 policy bots, per-day save-size measurement). One critical
systemic issue was found and quantified; several smaller problems were
collected along the way (§2–§5), and a set of suspected-fragile areas
were probed and verified clean (§6).

---

## 1. CRITICAL — The autosave cannot fit in localStorage past the early game

**Verified empirically on this commit.** The serialized
`PersistedSession` that `App.svelte` autosaves after every day grows
past **Firefox/Safari's ~5 MB localStorage quota on day 12** and past
**Chrome's ~10 MB quota on day 21** of a plain no-input run. From that
point on, every autosave throws `QuotaExceededError`, every refresh
loses the campaign back to the last save that fit, and the manual
snapshot system refuses new snapshots even earlier (~day 8). A
"simulation-first" game whose campaigns are designed to run for months
of in-game time currently cannot persist a campaign past its third week.

### Measured save sizes (no-input cardless run, seed `save-size`)

JSON characters ≈ UTF-16 code units; browsers store localStorage as
UTF-16, so on-disk bytes ≈ 2× the character count.

| Day | Autosave (chars) | of which `diffs` | Quota status |
| --- | --- | --- | --- |
| 1 | 422 k | 192 k | fits |
| 5 | 1,814 k | 1,089 k | fits |
| 10 | 2,398 k | 1,551 k | fits |
| **12** | **2,593 k** | 1,750 k | **> Firefox/Safari ~5 MB** |
| 20 | 4,804 k | 3,488 k | > FF/Safari |
| **21** | **5,511 k** | 3,988 k | **> Chrome ~10 MB** |
| 35 | 7,226 k | 5,352 k | > Chrome |
| 90 | 7,477 k | 5,203 k | > Chrome (steady state) |

A **mid-day** save (day segment 'A'/'B') additionally embeds
`dayBaseline` — a second full `TavernState` — and reaches **~9,508 k
chars (~18.6 MB UTF-16) at day 90**.

### Root-cause chain (four compounding contributors)

**(a) `diffModules` diffs module slices at container granularity —
`src/sim/core/diff.ts:597-628`.** It walks exactly one level into each
`state.modules.<id>` slice and, for any second-level key whose JSON
differs, emits a single `StateChange` whose `before` and `after` are the
**entire sub-object**. Decomposition of a day-35 diff (101 change
entries, 5.48 M chars total):

| Change entry path | Serialized size |
| --- | --- |
| `modules.attribution.attributions` | 4,172 k chars |
| `modules.issueSeeds.seedsToday` | 525 k chars |
| `modules.weekly.weeklyHistory` | 151 k chars |
| `modules.pressures.snapshots` | 86 k chars |

**(b) `modules.attribution.attributions` is a ~1 MB container touched
every single day.** It grows to ~919 kB JSON by day 30 and plateaus at
~935 kB — **45 % of the entire state**. The attribution module's
`endDay` hook (`src/sim/modules/attribution/attributionModule.ts:553`)
ages/decays entries daily, so the container's JSON differs every day,
and per (a) the diff records the full ~1 MB container **twice**
(before + after) every day. (Unbounded attribution growth was flagged
as candidate AUD-CONTENT-009-006; the new fact here is that the diff
layer doubles it daily into every `SimResult`.)

**(c) `serializeForSave` persists the whole day's diffs.**
`web/src/lib/sim/gameStore.svelte.ts:477-486` copies
`latestResult.diffs` (and full `reports`) into `latestResultLite` and
writes them into the autosave untrimmed. The diff payload — a debug/
drill-down artifact — is 2.5× larger than the state it describes.

**(d) Even without diffs, state alone is on a collision course.**
Steady-state `TavernState` is ~2,032 k chars (~4 MB UTF-16); a mid-day
save stores it twice (`state` + `dayBaseline`,
`web/src/lib/sim/persistence.ts:98-132`). That is ~8 MB UTF-16 before
reports/diffs — already past the Firefox/Safari quota on its own.

### Player-visible consequences

1. **Autosave fails permanently from day ~12/~21** (browser-dependent).
   `saveSession` correctly classifies the `QuotaExceededError`
   (`web/src/lib/sim/persistence.ts:237-281`) and the store surfaces a
   banner (`saveError`, gameStore.svelte.ts:211), so the player sees a
   warning — but there is nothing they can do about it, and any
   refresh/crash discards all progress since the last fitting save.
2. **Manual snapshots stop working around day 8.** `createSnapshot`
   (`web/src/lib/sim/snapshots.ts:294-312`) rejects when
   `estimateStorageBytes() + payload > SNAPSHOT_BUDGET_BYTES` (4 MiB,
   snapshots.ts:32). With the autosave occupying ~2.1 M chars and a
   snapshot payload of the same size, the projected total crosses the
   4 MiB budget about a week in — every snapshot attempt thereafter
   returns `storage_budget`.
3. **Unit confusion understates real usage 2×.**
   `estimateStorageBytes` (snapshots.ts:119-146) sums
   `key.length + value.length` — UTF-16 **code units**, not bytes — and
   compares against a "bytes" budget. Every figure the budget guard and
   the snapshot UI (`SnapshotMeta.bytes`) reports is half the real
   storage footprint.

### Why no test or audit caught it

Persistence tests exercise the save/load **shape** with small synthetic
fixtures; the phase-06 audit verified round-trip semantics, not size.
Nothing anywhere measures a serialized save produced by a real multi-week
state. The sim-side suites never serialize through the web layer at all.

### Fix directions (roughly in order of leverage)

1. **Stop persisting raw diffs.** Hydration uses `latestResultLite` only
   to re-show the last day's report; persist the filtered projection the
   UI actually renders (cf. `web/src/lib/sim/significantDiffs.ts`)
   or drop `diffs` from the save and recompute drill-downs on demand
   from `state` + `dayBaseline`. This alone removes ~70 % of the
   payload.
2. **Fix `diffModules` granularity.** Recurse module slices to leaf
   scalars (as the dedicated walkers in the same file already do for
   areas/stock/staff/world), or emit count/summary deltas for known
   append-only containers, the way `expeditions.completed.count`
   already does (diff.ts:528-534). A per-entry size cap with truncation
   marker would also defend in depth.
3. **Bound or normalize `modules.attribution.attributions`** (existing
   candidate AUD-CONTENT-009-006, now with a number on it: 45 % of every
   save).
4. **Move persistence to IndexedDB** (no practical quota at these
   sizes), keeping localStorage only as a legacy-read path. This is the
   durable fix for (d), since state alone will keep growing with
   content phases.
5. **Count UTF-16 units honestly** (×2) in `estimateStorageBytes`, or
   measure via `new Blob([payload]).size`.

### Reproduction

```ts
// 1) sizes: serialize PersistedSession-shaped saves per day
import { runCardlessSim } from './src/sim/testing/simRunner'
const run = runCardlessSim({ seed: 'save-size', days: 40 })
// build {state, latestResultLite:{reports,logs,validation,diffs}, ...}
// per day record and JSON.stringify().length — crosses 2.62 M chars
// (FF/Safari 5 MB) on day 12, 5.24 M chars (Chrome 10 MB) on day 21.

// 2) diff composition: JSON.stringify(rec.result.diffs).length and
// per-change-entry sizes — modules.attribution.attributions ≈ 4.17 M
// chars in a single before/after pair at day 35.
```

---

## 2. MEDIUM — Multi-MB per-day diffs are a plausible root cause of the heavy-tier OOM (AUD-TEST-008-001)

The known-open heavy-tier OOM (`npm run test:heavy` exhausts the worker
heap in `tests/sim/phase20.cardlessPlaytest.test.ts`) has a candidate
mechanism in the same numbers as §1: `runCardlessSim`
(`src/sim/testing/simRunner.ts:104-125`) retains, for **every** day, a
`CardlessRunDayRecord` holding the full `stateBefore` (~2 MB JSON
equivalent) **and** the full `SimResult` including the multi-MB `diffs`.
A 364-day playtest therefore pins on the order of
364 × (state + state + diffs) ≈ several GB of reachable objects — and
the 2026-06-10 §4 hardening (snapshotting non-scalar `before`/`after` in
`pushScalarChange`) means each day's diff now holds *independent*
clones of the ~1 MB attribution container rather than shared references,
which increases retained bytes further. Fixing §1(a)/(b) shrinks diffs
~50×; alternatively the harness could keep rolling-window records or
drop `diffs`/`stateBefore` for days the assertions never read.

---

## 3. MEDIUM — `policy_backlash` seeds blame an arbitrary policy, not the one causing the backlash

**File:** `src/sim/modules/issues/expandedSeedGenerators.ts:4859-4871`

```ts
const policies = Object.values(owner?.policies ?? {}).filter((p) => p.enabled)
if (policies.length === 0) return []
const policy = policies[0]!
```

When the `policy_backlash` pressure is high and **multiple** policies
are enabled, the generator picks whichever enabled policy was inserted
first and builds the seed (target refs, card copy, response slots)
around it. The subsequent cause lookup
(`recentCauseEntries(ctx, ['policy', policy.id, 'backlash'], …)`) is
merged with generic pressure causes, and the seed is emitted as long as
*any* cause exists — so the card can name policy A while the backlash
pressure was driven by policy B. That violates the Core Design Rule
("cards must not invent truth") in exactly the way the actor-asymmetry
fix (ISSUE-144) is meant to police elsewhere.

Insertion order is JSON-stable, so this is **not** a determinism/replay
hazard — same save, same pick — but the pick is semantically arbitrary.
Parallel generators sort before indexing (e.g. the witness-group pick at
`expandedSeedGenerators.ts:178-179` sorts by patronage); this one should
select the enabled policy with the strongest recent
`['policy', <id>, 'backlash']` cause linkage, and skip seeds with none.

---

## 4. LOW — Web store serializes live references into the save (fragility, not active bugs)

Three sites in `web/src/lib/sim/gameStore.svelte.ts` share state between
the live store and the object handed to `saveSession`:

- `serializeForSave` copies `reports`/`logs`/`validation`/`diffs` by
  reference into `latestResultLite` (lines 477-486).
- `pendingBySeedId` is shallow-cloned only one level deep (line 502);
  nested `PendingChoice` objects remain shared.
- On hydrate, `this.dayBaseline = save.dayBaseline` (line 457) adopts
  the loaded object by reference rather than cloning.

Today nothing mutates these objects after the fact, so no corruption
occurs — but any future UI affordance that edits a pending choice or
annotates a report in place would silently rewrite what the *next*
autosave persists. Cheap hardening: `structuredClone` at the
serialize/hydrate boundary (the payloads are small once §1.1 removes
diffs).

---

## 5. Empirical confirmation of known-open AUD-CONTENT-009-001 (`debt_rent` urgency out of range)

Reproduced concretely while probing: a 90-day run driven by the
`auto_miner_focused` policy bot (seed `bot-auto_miner_focused`) yields
`issue_seed_urgency_oor` validation errors on days 85–88
(`Seed 'seed-debt_rent-arrears-d85' urgency out of range`, etc.). All
nine other Phase-20 bots and plain no-input runs stay validation-clean
over the same horizon. This narrows the trigger to sustained rent
arrears under that strategy and gives the existing tracker candidate a
deterministic reproduction.

---

## 6. Probed and verified clean

For completeness — checked on this commit and found sound:

- **Long-run state sanity:** 120-day runs (2 seeds) and 90-day runs
  under all ten policy bots: no NaN/Infinity anywhere in final state, no
  negative stock quantities, no validation errors outside §5.
- **Per-day cost is bounded:** `simulateDay` wall-clock grows with state
  size and plateaus ≈ 200–210 ms/day by day ~90 (no super-linear
  blow-up); state JSON plateaus ≈ 2.0–2.2 MB chars.
- **History pruning works as designed:** `state.history` holds ~1,300
  entries at day 120 because the 90-day retention window
  (`HISTORY_MIN_AGE_DAYS`) legitimately dominates the 500-entry cap
  (`src/sim/modules/history/historyModule.ts:57-76`); growth is
  windowed, not unbounded.
- **No `Object.values(...)[0]`-style unsorted picks feeding RNG or
  top-N selection** were found in `src/` beyond §3 (which is
  deterministic, just arbitrary).
- **Sim core/economy sweep** (engine, accumulators, wage/rent/restock
  ledgers, week/month boundaries, clamp ordering) and **card/report
  sweep** (band thresholds, salience math, generator field references,
  state mutation from projection layers) surfaced nothing beyond the
  items above.
- `npm run typecheck` clean on this commit.
