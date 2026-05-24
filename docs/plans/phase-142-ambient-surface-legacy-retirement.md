# Phase 142 — Ambient Surface & Legacy Retirement

**Voiced Surface arc, Movement III, last in Movement III.**
**ISSUE-111 — done.**

## Context

Phase 15 (ISSUE-110, phase 141) ported the projection-built daily-report
surface — header, quiet-day, missed-opportunities, yesterday-digest,
service-log — off the legacy `composeEmpty('header'|'quiet', key)` /
hand-rolled prose helpers and onto the Phase-C compose runtime via the
existing `reportSectionAsTemplate` adapter and `buildReportSeed`
synthetic-seed helper at `src/cards/compose/reports/`.

That left exactly two surfaces still anchored on the legacy
`src/cards/voice/` slice:

1. **The day-screen empty-state lines** at
   `web/src/lib/screens/DayScreen.svelte:158-160` — three
   `composeEmpty('morning'|'service'|'closing', key)` calls feeding the
   "no urgent matters this morning" / "service runs quietly" / "nothing
   left to resolve" placeholders when a beat has zero seeds.
2. **The fallback card** at `src/cards/templates/fallback.ts` — used
   `composeTitle([adj, ti.subject || seed.family], opts)` and
   `composeBody([sensoryDetails[0], recentContext[0],
   pressureContext?.[0] ?? stakesReadable[0]], opts)`, the last legacy
   fragment-glue-with-tone-prefix template (the pattern Movement II was
   built to retire), still in the registry because any seed without a
   dedicated `REQUIRED_CARDS` match routes here.

Once those two were migrated, the legacy composer slice
(`src/cards/voice/{composer,tonePools,index}.ts` + the eight-symbol
re-export block from `src/cards/index.ts:68-80`) had no remaining call
sites and was deleted — closing the arc's promise that nothing in the
codebase would reference the old adjective-gluing composer after
Movement III.

## What shipped

### A. Day-beat empty states — three new compose-runtime sections

Three new single-slot narrator-voiced sections mirroring the Phase-15
`dailyHeader` / `dailyQuiet` precedent exactly:

- `src/reports/compose/sections/morningEmpty.ts` — id
  `day.morning_empty`, voice register `tavern_floor`, timing
  `morning_prep`, single `line` slot, body cap 10 words.
- `src/reports/compose/sections/serviceEmpty.ts` — id
  `day.service_empty`, voice register `tavern_floor`, timing
  `during_service`.
- `src/reports/compose/sections/closingEmpty.ts` — id
  `day.closing_empty`, voice register `tavern_floor`, timing
  `closing`.

Each ships a matching pool at
`src/reports/compose/pools/<section>/line.ts` + `index.ts`. Each pool
seeds with the five existing `EMPTY_STATE_POOLS[kind]` entries from the
retired `tonePools.ts` as unconditional `conditions: []` fallback
snippets (user-visible voice preserved exactly), plus 1–2
`hasTag end_of_week` / `hasTag end_of_month` gated variants for
milestone days.

Each `composeXEmptyLine` function takes
`{ state, closedDayOrdinal, isEndOfWeek?, isEndOfMonth? }` and routes
through `buildReportSeed({ sectionId, periodKey: 'd${ordinal}.${beat}',
timing, domain: [<beat-tag>, ...calendarTags] })`. `assembleSlots`
returns `{ line: string }`. Determinism keys off `closedDayOrdinal`, so
the same calendar day reads the same line across all three beats on a
refresh.

Re-exported through `src/reports/compose/sections/index.ts` (next to
the Phase-15 sections) and the top-level `src/reports/index.ts` so
`DayScreen.svelte` imports symmetrically with the existing
daily-report consumers.

### B. Fallback card — compositional rewrite

`src/cards/templates/fallback.ts` rewritten in place as a
`CompositionalCardTemplate` via `defineCompositionalCard`. One slot:

- `title` slot — narrator-voiced, ≤ 6 words, `claimMode: 'flavor'`.
  Pool at `src/cards/compose/pools/fallback/title.ts` ships one
  unconditional fallback (`"something stirs"`) plus three severity
  rungs: `severityBelow 40` (`"a loose thread"`), `severityAtLeast 40`
  (`"a matter to weigh"`), `severityAtLeast 70` (`"a hard knot
  rises"`). Renders as `${snippet}: ${subject}` where subject falls
  through to `seed.family` when blank — preserves the existing
  "renders family name when subject missing" test contract.

Body lines come straight from `seed.textIngredients` (raw sim-emitted
strings: `sensoryDetails[0]`, `recentContext[0]`, `pressureContext?.[0]
?? stakesReadable[0]`) — no composer wrapping. This is the deliberate
choice for the fallback specifically: it cannot author per-family
snippet pools (catches the long-tail families); the cards-contract
truth rule is upheld by sourcing body text only from the seed's own
state. The fallback's always-renders-something guarantee is preserved:
title pool always resolves (unconditional fallback exists); missing
textIngredients lines drop out as today; `makeCardView` always builds.

Stakes, choices, severity, tag flow through `buildStakes` /
`buildChoicesFromSeed` / `familyTag` unchanged.

### C. Legacy slice deletion

- Deleted: `src/cards/voice/composer.ts`, `src/cards/voice/tonePools.ts`,
  `src/cards/voice/index.ts`, and the now-empty `src/cards/voice/`
  directory.
- Removed: the eight-symbol re-export block at `src/cards/index.ts:68-80`
  (`composeTitle` / `composeBody` / `composeEmpty` / `pickFromPool` /
  `TONE_POOLS` / `EMPTY_STATE_POOLS` / `ComposeOpts` / `TonePool`) —
  replaced with a five-line retirement note pointing to the new
  composers.
- Deleted: `tests/cards/voice/composer.test.ts` (the 175-line legacy
  composer test — its coverage is superseded by the seven structural
  gates running against the three new sections + the fallback pool).
- Reworded: the doc comment in `src/sim/utils/fnv.ts` that referenced
  `cards/voice/composer.ts` — the FNV helper now stands on its own
  rationale (descriptors + compose-slice tie-break).

### D. Retirement-guard test

New `tests/cards/voice/noLegacyImports.test.ts` walks `src/`,
`web/src/`, and `tests/` recursively and fails if any `.ts` / `.tsx` /
`.svelte` / `.js` / `.mjs` file contains the string `'/cards/voice/'`.
The needle is split across two string literals (`'/cards' +
'/voice/'`) and the test file itself is filtered out by filename, so
the scanner can't match its own probe.

### E. Out of scope (documented)

- **Tavern log** row summaries — sim-emitted at history-write time by
  producer modules across `src/sim/modules/*`. Voicing them would
  require a sim-layer refactor. Mirrors Phase 15's weekly/monthly
  notes carve-out.
- **First-encounter hint** copy — static glossary `oneLine` / `longer`
  definitions from `src/reports/glossary.ts`; deliberately stable for
  player learning.
- The `EMPTY_STATE_POOLS.header` and `.quiet` entries — already
  migrated in Phase 15 (`composeDailyHeaderLine` /
  `composeDailyQuietLine`); their pool entries die with `tonePools.ts`.

## Files

**New (sections + pools)**
- `src/reports/compose/sections/morningEmpty.ts`
- `src/reports/compose/sections/serviceEmpty.ts`
- `src/reports/compose/sections/closingEmpty.ts`
- `src/reports/compose/pools/morningEmpty/{line.ts,index.ts}`
- `src/reports/compose/pools/serviceEmpty/{line.ts,index.ts}`
- `src/reports/compose/pools/closingEmpty/{line.ts,index.ts}`
- `src/cards/compose/pools/fallback/{title.ts,index.ts}`
- `tests/reports/sections/morningEmpty.test.ts`
- `tests/reports/sections/serviceEmpty.test.ts`
- `tests/reports/sections/closingEmpty.test.ts`
- `tests/reports/sections/runAllGates.dayBeatEmpty.test.ts`
- `tests/cards/templates.fallback.voice.test.ts`
- `tests/cards/templates.fallback.gates.test.ts`
- `tests/cards/voice/noLegacyImports.test.ts`

**Modified**
- `src/reports/compose/sections/index.ts` — three new section exports.
- `src/reports/index.ts` — top-level re-export of the three day-beat
  composers.
- `web/src/lib/screens/DayScreen.svelte` — swap import + three call
  sites + replace the `voiceKeyBase` derived value with
  `closedDayOrdinal` / `isEndOfWeek` / `isEndOfMonth` derived values.
- `src/cards/templates/fallback.ts` — rewrite as compositional template.
- `src/cards/index.ts` — remove the `./voice/index` re-export block;
  add a five-line retirement note.
- `src/sim/utils/fnv.ts` — reword the doc comment.
- `docs/ISSUE_TRACKER.md` — add the ISSUE-111 row.
- `CLAUDE.md` — add the Phase 142 status entry.

**Deleted**
- `src/cards/voice/composer.ts`
- `src/cards/voice/tonePools.ts`
- `src/cards/voice/index.ts`
- `src/cards/voice/` (now-empty directory)
- `tests/cards/voice/composer.test.ts`

## Verification

- `npm run typecheck` — green.
- `npm test -- --run` — 2452/2452 across 198 files. +7 vs the
  post-Phase-141 baseline of 2445: 16 new day-beat tests + 10 new
  fallback tests + 1 new retirement-guard test − 20 deleted legacy
  composer tests = +7.
- All seven structural gates (coverage, specificity, voiceBounds,
  simCoherence, determinism, diversity, dedupe) green for each new
  pool — both the three day-beat sections and the fallback title pool.
- Existing `tests/cards/templates.test.ts` `Fallback — fallbackCard`
  block unchanged: the new compositional fallback still passes
  `assertTitleBudget`, `assertBodyBudget`, the `choices.length > 0`
  guarantee, and the "honours family name when subject is blank"
  contract.

## Notes from authoring

- The day-beat pools needed no rewording during gate iteration —
  lifting the five legacy entries verbatim with one or two `hasTag`
  gated variants cleared every gate first time.
- The fallback title pool needed no rewording either — four snippets,
  unconditional + three severity rungs, all ≤ 4 words, no risk of
  exceeding the 6-word title budget when combined with the subject
  (worst case: `"a hard knot rises"` 4 + `: ${4-word subject}` = 6
  total per `TEXT_INGREDIENT_LIMITS.subject.maxWordsPerEntry`).
- The retirement-guard test caught two stale comment references to
  `cards/voice/` on first run (one in `src/cards/index.ts` paragraph,
  one in `src/sim/utils/fnv.ts` rationale block); both reworded.
