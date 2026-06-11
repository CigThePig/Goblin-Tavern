# Codebase audit — 2026-06-11: the quota fix fixed the wrong save — interactive campaigns still collapse, and the fix blanked the reloaded daily report

A follow-up audit one day after `2026-06-10-persistence-quota-audit.md`
and its fix commit (`4d92a56`, merged as PR #216). That fix measured and
repaired the **end-of-day, no-input** save shape — the shape the
original audit's cardless probes produced. This pass re-ran the same
empirical methodology against the save shape an **interactive player**
actually produces (mid-day, segment 'A'/'B', `dayBaseline` embedded) on
the post-fix commit (`65c4f7c`), and reviewed the fix itself as new,
unaudited code. One critical systemic issue remains (§1), the fix
introduced a player-facing regression (§3) and a silent-data-loss sharp
edge (§4), and the manual snapshot system is now structurally dead past
the early game (§2). Smaller findings collected along the way are in
§5–§6; areas probed and verified clean are in §7.

All measurements were taken on this commit with probes that replicate
`gameStore.serializeForSave()` field-for-field (diffs omitted,
`latestResultLite = {reports, logs, validation}`, `dayBaseline` included
only for segment 'A'/'B' envelopes), driving the engine through the same
three `advanceDaySegment` calls the web store makes. Seed `save-size`,
no-input runs, 90–150 day horizons. JSON characters ≈ UTF-16 code units;
localStorage stores UTF-16, so on-disk bytes ≈ 2× the character count
(Firefox/Safari quota ~5 MB ⇒ ~2,621 k chars; Chrome ~10 MB ⇒ ~5,243 k
chars).

---

## 1. CRITICAL — Mid-day autosaves still exceed the Firefox/Safari quota from day ~22

**Verified empirically on this commit.** PR #216 dropped diffs from the
save and that genuinely fixed the **end-of-day** envelope (it now peaks
at ~2,347 k chars ≈ 4.7 MB at day 85 — under, but within ~10 % of, the
Firefox/Safari quota). But the **mid-day** envelope — the one written
while a day is in progress — additionally embeds `dayBaseline`, a second
full `TavernState` (`gameStore.svelte.ts:520-522`), and crosses the
Firefox/Safari quota **on day 22**, reaching ~4,567 k chars (~9.1 MB
UTF-16) by day 85.

### Measured save sizes (post-fix, no-input run, seed `save-size`)

| Day | End-of-day save | Mid-day save | `state` alone | reports+logs |
| --- | --- | --- | --- | --- |
| 5 | 755 k | 1,290 k | 571 k | 183 k |
| 10 | 873 k | 1,548 k | 691 k | 182 k |
| 15 | 1,145 k | 2,095 k | 965 k | 179 k |
| 20 | 1,320 k | 2,432 k | 1,147 k | 172 k |
| **22** | — | **> 2,621 k** | — | **> Firefox/Safari ~5 MB** |
| 30 | 1,809 k | 3,583 k | 1,608 k | 200 k |
| 50 | 1,975 k | 3,824 k | 1,765 k | 209 k |
| 70 | 2,174 k | 4,056 k | 1,918 k | 256 k |
| 85 | 2,347 k | 4,567 k | 2,091 k | 256 k |
| 90 | 2,251 k | 4,358 k | 2,014 k | 236 k |

(Chrome's ~10 MB quota was not crossed within the 90-day horizon — peak
~9.1 MB at day 85 — but the trend line leaves little margin.)

### Why the mid-day shape is the one that matters

The autosave `$effect` (`web/src/App.svelte:147-169`) fires — debounced
300 ms — on every change to `state`, `beat`, `segment`,
`pendingBySeedId`, `picks`, etc. An interactive player spends almost the
entire session **inside** a day (reading morning cards, planning,
reacting to service), i.e. in segment 'A'/'B', so nearly every autosave
written during play is mid-day-shaped. The cardless probes that sized
the original fix only ever produced end-of-day saves, which is how the
gap survived.

### Player-facing consequences on a ~5 MB browser, from day ~22

- Every beat advance, card choice, and pick-queue edit triggers an
  autosave that throws `QuotaExceededError`; the More → Saves error
  banner (`saveError`) is effectively permanent while a day is open.
- The `pagehide`/`visibilitychange` hard flush (`App.svelte:51-59`)
  fails the same way, so closing the tab mid-day loses the in-progress
  day.
- Mid-day refresh-and-resume — the headline feature of Phase 96 and the
  Day-Clock Cluster 5 segment persistence — is dead: the last save that
  fits is the previous end-of-day one, so a refresh always rewinds to
  the morning of the current day at best.

### Root cause: the state itself was never shrunk, and mid-day doubles it

The original audit's §1(d) ("even without diffs, state alone is on a
collision course") and its recommended structural fixes — bound the
attribution slice, move to IndexedDB — were not part of PR #216. The
post-fix breakdown of `TavernState` at day 90 (2,014 k chars):

| Slice | JSON chars | Share |
| --- | --- | --- |
| `modules.attribution` | 951 k | **47 %** |
| `history` | 495 k | 25 % |
| `modules.issueSeeds` | 180 k | 9 % |
| `causes` | 130 k | 6 % |
| `modules.weekly` | 104 k | 5 % |
| everything else | ~154 k | 8 % |

A 150-day probe of the attribution slice shows it is bounded but
enormous: it plateaus at ~1,650–1,790 live entries × ~550 chars
(~0.9–1.0 MB JSON) from day 30 onward, churning roughly 170 new
attributions per day against expiry-based pruning
(`attributionModule.ts:296-317`). Half the campaign's persisted bytes
are internal perceiver bookkeeping the player never sees directly. The
mid-day envelope then stores all of it **twice** (`state` +
`dayBaseline`).

### Suggested fix direction

Any one of these closes §1; the first two also fix §2:

1. **Bound or compact the attribution slice** (cap live entries
   per perceiver/target, or store a compacted form) — halves state and
   buys the most headroom per unit of work.
2. **Move persistence to IndexedDB** (no practical quota at these
   sizes) — the original audit's recommendation; localStorage can keep a
   small boot pointer.
3. **Stop persisting `dayBaseline` as a second full state** — persist a
   structural delta against `state`, or accept the documented
   post-reload partial-diff edge for all segments (it is already
   accepted when `dayBaseline` is absent, `gameStore.svelte.ts:267-271`).

---

## 2. HIGH — Manual snapshots permanently refuse from roughly day 13; the budget guard counts the autosave against its own budget

`createSnapshot` refuses with `storage_budget` when
`estimateStorageBytes() + extraBytes > 4 MB`
(`web/src/lib/sim/snapshots.ts:32,150-155`). `estimateStorageBytes()`
sums **every key in localStorage** (`snapshots.ts:119-148`) — including
the autosave, which shares the origin. PR #216's correction of the
UTF-16 byte estimate (×2) made the guard honest, but without shrinking
the underlying data it converted quota crashes into early hard refusals:

- A snapshot payload is a full `PersistedSession` (≈ the end-of-day save
  size). Taking **one** end-of-day snapshot stops fitting around
  **day 13–15** (autosave ~2.3 MB + snapshot ~2.3 MB > 4 MB).
- From ~**day 15** (if the autosave on disk is mid-day-shaped) or
  ~**day 65** (end-of-day-shaped), the autosave **alone** exceeds the
  4 MB budget, so even a zero-byte snapshot would be refused — with zero
  snapshots stored.
- The refusal UI says "delete an older snapshot first", which is wrong
  and unactionable in that state: there is nothing to delete.

The snapshot feature is therefore usable for roughly the first two
in-game weeks of a campaign designed to run for months. This is the same
root cause as §1 (state size) wearing a different hat; fixing §1 via
direction 1 or 2 revives snapshots. Independent quick win: exclude the
autosave key from the snapshot budget and give snapshots their own
budget, so the message at least matches reality.

---

## 3. MEDIUM — Regression introduced by PR #216: reloading blanks the daily report's "what changed" sections

The fix stopped persisting `diffs` on the stated grounds that they are
"not needed for report display" (`persistence.ts:63-66`). That premise
is wrong: `buildDailyReport` is diff-driven —
`src/reports/dailyReportProjection.ts:105-113` reads the full-day diff
for `topDiffs`, `groupedDiffs`, `coinBefore/coinAfter/coinDelta`, the
reputation deltas, and the heavy-day header heuristic, exactly as the
engine's GATE B comment (`engine.ts:1744-1750`) says it must. After
`hydrateFromSave`, `latestResult.diffs` is rebuilt as `[]`
(`gameStore.svelte.ts:438`), so a refresh while the report is up (or any
reload before the next day closes) silently degrades the just-closed
day's report.

**Verified empirically:** an 8-day run, then `buildDailyReport` on the
live result vs. the same result with `diffs: []` (what hydration
reconstructs):

| Projection | Live | After reload |
| --- | --- | --- |
| `topDiffs` | 8 | **0** |
| `groupedDiffs.pressures` | populated | **empty** |
| `coinDelta` | from day diff | **always 0** (falls back to `state.coin` for both ends) |

`web/src/lib/sim/significantDiffs.ts:30` (missed-opportunity surface)
reads the same day diff and degrades the same way. The narrative
sections survive (they read `result.reports`), which makes the loss easy
to miss in a casual glance — the report renders, just with its
mechanical core missing.

**Fix direction:** persist the day-boundary diff's
`significantChanges` (a few KB — it is the *module-container* diffs that
were multi-MB, and §1's granularity fix already excludes those), or
rebuild the day diff at hydration from `dayBaseline`/`state` when
available.

---

## 4. MEDIUM — The new 10 k-char diff threshold silently swallows real changes, with no signal

The granularity fix in `diffModules` (`src/sim/core/diff.ts:602,636`)
drops any module sub-key change whose serialized `before` **or** `after`
exceeds `DIFF_MODULE_VALUE_MAX_JSON = 10_000` chars. The intent (keep
multi-MB containers out of per-day diffs) is sound, but the mechanism
has sharp edges:

- **It is silent.** No log, no marker change entry, no debug counter.
  `modules.issueSeeds.seedsToday` (~180 k) and
  `modules.weekly.weeklyHistory` (~104 k) are already permanently above
  the threshold; any future consumer of their diffs gets "no change"
  rather than "change too large".
- **It is a time bomb for mid-sized containers.** A module sub-key that
  grows past 10 k chars mid-campaign (several module slices sit in the
  1–10 k band today) drops out of diff/causality coverage from that day
  forward, with nothing to flag the transition.
- **It compounds AUD-ROAD-010-002** (cause-target lookup drift): module
  writes were already surfacing as "unexplained"; above the threshold
  they now don't surface at all.

**Fix direction:** emit a sentinel change entry (path + `truncated:
true`, no payloads) instead of skipping, so consumers can distinguish
"nothing changed" from "changed, payload elided", and log once per
day/key in dev builds.

---

## 5. LOW (latent) — `isStickyFalse` attributions never expire and have no count bound

`ageAttributions` (`attributionModule.ts:308-313`) exempts attributions
with `accuracy === 'false' && publicness >= 60` from both expiry and
minimum-strength pruning ("decay slowly until corrected"). If correction
never lands, they accumulate forever, and there is no cap on the
attribution array. In 150 days of no-input probing the count stayed at
**zero**, so this is not the driver of §1 — but rumour-heavy play (the
`blame`/`hide`/deception response shapes exist precisely to create
false, public narratives) arms it. Worth a cap or a hard ceiling-age
while the slice is being bounded for §1.

---

## 6. LOW — Locale-sensitive collation feeds identity-RNG roll order

Day-zero state creation and migrations order registry/entity ids with
bare `localeCompare` before consuming named identity RNG streams —
e.g. `src/sim/state/defaults.ts:177` (staff identity roll order),
`defaults.ts:236,373,441,648`, `migrations.ts:120,331-399`. The comments
say "stable registry order", but `localeCompare` without an explicit
locale collates by the host's default locale. All current ids are plain
ASCII, where collation agrees across common locales, so this is
theoretical today — but a single non-ASCII or case-mixed id would make
"same seed, same world" quietly locale-dependent. One-character fix:
compare with `<`/`>` on code units (or pass an explicit locale).

---

## 7. Probed and verified clean

- **Determinism/purity sweep** of `src/sim`, `src/cards`,
  `src/reports` (post-fix code included): no `Math.random` /
  `Date.now` / `performance.now` / `process.*`; no Map/Set/class
  instances persisted into state; no RNG consumption in the card or
  report layers; conditional-RNG and iteration-order hot spots
  (`regularModule.pickFavoriteStockId`, supplier delivery rolls,
  `arcEngine.weightedPick`, `monthly/modifiers`) all draw from
  deterministic per-stream seeds. The 2026-06-10 hardening
  (`freezeInDev`, mutation helpers, diff snapshotting) holds.
- **150-day no-input run:** zero validation errors, no NaN/negative
  meters; `history` stays windowed (~495 k chars, not unbounded);
  attribution plateaus (§1) rather than diverging.
- **End-of-day save shape:** the PR #216 goal was met for this shape —
  it stays under the Firefox/Safari quota through day 90 (peak ~4.7 MB
  at day 85, ~10 % headroom).
- **Suite health:** `npm run typecheck` clean; fast tier 266 files /
  3,461 tests green on this commit. Note that this is itself the §1–§3
  oracle gap: no test serializes a late-game **mid-day** session against
  a quota-sized budget, and no test reloads a save and asserts the daily
  report still carries its diff-driven sections. Both would have caught
  these before merge.

---

## Reproduction notes

Probes were run with `npx tsx` against this commit:

1. **Save-size probe (§1, §2):** drive `advanceDaySegment` A→B→C per day
   with `seed = 'save-size-d<totalDaysElapsed>'`, empty owner actions;
   after B build the mid-day envelope (with `dayBaseline` and the
   *previous* day's `latestResultLite`), after C the end-of-day envelope
   (without `dayBaseline`); `JSON.stringify(...).length` per day;
   compare against 2,621 k / 5,243 k char thresholds.
2. **Report-reload probe (§3):** 8 × `simulateDay`, then
   `buildDailyReport(result, state)` vs.
   `buildDailyReport({...result, diffs: []}, state)`; compare projection
   field counts.
3. **Attribution probe (§1, §5):** 150 × `simulateDay`; per 10 days
   count `modules.attribution.attributions`, sticky-false subset, slice
   JSON size.
