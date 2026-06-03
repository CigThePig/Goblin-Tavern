# Phase 8 — Test-Suite Oracle and Blind-Spot Audit

## Scope and status

Phase 8 audited what the current Vitest suite proves, where it is strong, and
where it can still miss defects despite a green default run. The review covered:

- Test-tier configuration in `vitest.config.ts`, `scripts/run-tests.mjs`, and
  `package.json`.
- Test-file distribution and assertion density under `tests/sim`, `tests/cards`,
  `tests/reports`, and `tests/web`.
- The default fast tier, the heavy tier, manual/canonical pipeline usage,
  skipped/todo/only markers, snapshot/string-oracle usage, and representative
  end-to-end/component tests.
- Prior phase audit outputs to avoid reclassifying previously documented UI,
  persistence, card, and report gaps as test-only issues.

Audit result: the suite has broad, behavior-oriented coverage and the wrapper is
valuable: it detects worker drops, unhandled Vitest errors, and collected-vs-run
mismatches. The default fast tier passed, but it is no longer fast in this
environment. More importantly, the heavy tier currently fails by exhausting the
Vitest worker heap before `phase20.cardlessPlaytest.test.ts` completes, so the
strongest long-run playtest oracle is not reliably available. Several older sim
tests also define local pipeline arrays, which is useful for module-slice tests
but can mask canonical-pipeline drift if those tests are treated as runtime
integration proof.

## Test inventory and tier map

| Area / tier | Current shape | Oracle strengths | Audit caveats |
|---|---:|---|---|
| Test files total | 255 `*.test.ts` files | Large suite, split across sim, cards, reports, and web. | Default `npm test` intentionally excludes 4 heavy files, so a green default run is not the complete suite. |
| `tests/sim` | 106 files | Strong module behavior, validation, determinism, persistence, segmented-engine parity, and long-run invariants. | Some older files still use local `FULL_PIPELINE` arrays rather than the canonical pipeline; many module files intentionally test partial pipelines. |
| `tests/cards` | 78 files | Very strong template, composition, gate, preview, matrix, faithfulness, and voice coverage. | Sim-backed checks exist, but many template tests still use factories; they prove rendering contracts more than live generator reachability. |
| `tests/reports` | 35 files | Good projection and prose-section checks, plus daily/weekly/monthly/world overview coverage. | Mostly projection-level or section-level; report UI handoff is covered by web tests but not exhaustively for every projection row. |
| `tests/web` | 36 files | Persistence/import/export, segmented day store, queue validity, interconnection, and component route/screen smoke tests. | Component tests cover representative flows; they do not exhaust every destination detail sheet or all accessibility mechanics. |
| Fast tier | 251 files | Passed in this audit and exercises most behavior. | Took 842.95s, contradicting the tier comment's `~1 min` expectation. |
| Heavy tier | 4 files | Intended to cover multi-day/monthly playtests and monthly projection persistence. | Failed with worker OOM after 3 of 4 files; the missing file is the cardless playtest suite. |

## Test-suite observations

### Runner and tier behavior

- `package.json` routes `npm test`, `npm run test:heavy`, and
  `npm run test:full` through `scripts/run-tests.mjs` with `--tier=fast`,
  `--tier=heavy`, and `--tier=all` respectively.
- `vitest.config.ts` keeps a single `HEAVY_TEST_GLOBS` list for the tier split.
  The heavy list currently contains:
  - `tests/sim/phase20.cardlessPlaytest.test.ts`
  - `tests/sim/phase40.expandedReadiness.test.ts`
  - `tests/sim/phase91.monthlyPersistence.test.ts`
  - `tests/reports/monthlyOverviewProjection.test.ts`
- The wrapper post-parses Vitest output for worker exits, unhandled errors, and
  summary mismatches. This audit reproduced that safety net: the heavy run
  failed not only because Vitest exited non-zero, but also because the wrapper
  detected `3 passed (4)` test files, `63 passed (121)` tests, an unhandled
  error, and an unexpected worker exit.
- No active `.skip`, `.todo`, or `.only` tests were found. The only `skip`
  matches were comments documenting a previously skipped guard in
  `tests/cards/compose/phase127.simBackedHookSignal.test.ts`.

### Assertion style

- No zero-assertion test files were found by the inventory script. Aggregate
  assertion density is roughly 2.1–2.6 `expect` calls per `it`/`test` across the
  four top-level suites.
- Snapshot-matchers are effectively absent (`toMatchSnapshot` /
  `toMatchInlineSnapshot` did not appear in test code). Tests instead tend to
  assert concrete state movement, selected text fragments, counts, ordering, and
  round-trip equality.
- Determinism and replay checks are present in sim/card gates, including RNG
  stream tests, segmented-vs-full-day parity tests, and composition determinism
  gates.

### Pipeline oracle shape

- The canonical runtime pipeline lives in `src/sim/canonicalPipeline.ts` and is
  re-exported from `src/sim/testing/simRunner.ts` for compatibility.
- Many tests correctly import the canonical pipeline or the compatibility
  re-export. However, 15 sim files still define a local `const FULL_PIPELINE = [`
  array. Those tests can be valid slice/integration tests, but they should not be
  treated as proof that the production pipeline order or membership still works.
- The strongest canonical-pipeline oracles are the tests that import
  `src/sim/canonicalPipeline` directly, such as the segmented-engine parity
  tests, canonical-validation tests, persistence round-trip tests, and many
  newer full-pipeline checks.

## Blind-spot matrix

| Area | Covered | Adjacent-only | Missing / misleading | Priority |
|---|---|---|---|---|
| Test runner integrity | Wrapper catches non-zero exit, worker drops, unhandled errors, and collected-vs-run gaps. | Summary parsing depends on Vitest's current text format. | Heavy tier currently fails, so the wrapper is doing its job but the full oracle is unavailable without an environment or memory fix. | High |
| Fast-tier signal | 251 files / 3379 tests passed in this audit. | Fast tier now includes several long tests and took ~14 minutes in this environment. | The config comment still describes fast as `~1 min`, which can lead users/CI to overestimate how often the default suite will be run. | Medium |
| Heavy playtests | Monthly projection, monthly persistence, and expanded readiness passed before the crash. | They are serial/long-running and stress memory, which is valuable for surfacing growth bugs. | `phase20.cardlessPlaytest` did not complete in the heavy run; any readiness/cardless strategy conclusions from that file are currently absent. | High |
| Canonical pipeline | Newer tests import `src/sim/canonicalPipeline`; segmented-engine tests assert segment parity with `simulateDay`. | Local pipeline arrays in older sim tests still cover useful slices. | Local arrays can drift from production order/membership and still pass, masking canonical-pipeline issues if used as integration proof. | Medium |
| Cards | Matrix, gate, template, voice, preview, faithfulness, and sim-backed checks are extensive. | Factory-driven template tests verify rendering and choice contracts but not every live generator path. | Generator-to-card reachability remains best audited by Phase 4's family/subtype/timing matrix and live gate suites, not by template files alone. | Medium |
| Reports | Projection/section tests assert concrete metrics, labels, ordering, and empty states. | Web tests prove representative report handoffs. | Not every projection row has an end-to-end UI consumer assertion; Phase 5 report-source findings remain the better source for specific gaps. | Low |
| Web/store | Persistence, import/export, segmented day flow, queue validity, and representative components are covered. | Component tests often drive store methods directly to skip animation/timers. | Detail-sheet destination matrix and some accessibility mechanics are still follow-up candidates from Phase 7. | Medium |
| Skips and weak assertions | No active skip/todo/only markers; no zero-assertion files found. | Counts are a coarse heuristic. | A file can have assertions and still assert implementation details; representative review found this risk mainly in local-pipeline/module-slice tests, not as a suite-wide failure. | Low |

## Findings ledger

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-TEST-008-001 | confirmed | high | Heavy test tier / long-run oracle | `npm run test:heavy` currently fails with a Vitest worker heap OOM before all heavy files run, leaving the cardless playtest suite absent from the full long-run oracle. | Command output: `tests/reports/monthlyOverviewProjection.test.ts`, `tests/sim/phase91.monthlyPersistence.test.ts`, and `tests/sim/phase40.expandedReadiness.test.ts` passed; then Node reported `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`. Wrapper summary reported `Test Files 3 passed (4)`, `Tests 63 passed (121)`, one unhandled error, and `Worker exited unexpectedly`. The missing heavy file is `tests/sim/phase20.cardlessPlaytest.test.ts` from `HEAVY_TEST_GLOBS`; the collected-vs-run gap roughly matches that suite's remaining tests. | The wrapper correctly fails the run, so this is not a silent false green. However, the intended heavy oracle cannot be used until the memory/runtime issue is resolved. | Split `phase20.cardlessPlaytest.test.ts` into smaller files or route each long-running describe/bot matrix into separate processes; consider reducing retained `CardlessRunResult.days` payload for readiness-only checks; rerun `npm run test:heavy` until all 4 files / 121 tests pass. |
| AUD-TEST-008-002 | confirmed | medium | Test tier expectations / CI ergonomics | The fast tier is no longer fast in this environment, making the documented `~1 min` default-test expectation stale and reducing confidence that contributors will run it routinely. | `vitest.config.ts` comments describe `fast` as `~1 min`; this audit's `npm test` run passed but took `842.95s` for 251 files / 3379 tests. | The fast tier passed, so coverage exists. The issue is operational: stale timing expectations and a very long default command can reduce real-world test frequency. | Refresh tier documentation and either add a truly small smoke tier or move the slowest fast-tier files into a separate medium/heavy tier after measuring per-file runtime. |
| AUD-TEST-008-003 | candidate | medium | Canonical-pipeline oracle | Several older sim tests define local `FULL_PIPELINE` arrays, which can be correct for historical/slice coverage but can also pass after production pipeline membership or order drifts. | Inventory found local `const FULL_PIPELINE = [` definitions in 15 sim files, including `phase14.weekly`, `phase15.monthly`, `phase16.memories`, `phase17.causes`, `phase18.pressures`, and `phase19.issueSeeds`. Newer tests such as `phase186.segmentedEngine` import from `src/sim/canonicalPipeline` directly. | Canonical-validation and segmented-engine tests cover the real pipeline, and many module tests are intentionally partial. The blind spot is interpretive: a green older file should not be counted as canonical runtime proof unless it imports the canonical list. | Convert local arrays that are intended to represent production order to imports from `src/sim/canonicalPipeline`; rename deliberate partial arrays to `MODULE_SLICE` / `TEST_PIPELINE` and add comments explaining why they are not canonical. |
| AUD-TEST-008-004 | candidate | low | Runner parser compatibility | `scripts/run-tests.mjs` relies on Vitest's human-readable summary strings for collected-vs-run detection. This is effective today but brittle across Vitest output format changes. | The parser matches `Test Files  X passed (Y)` and `Tests  X passed (Y)` summary text. `vitest.config.ts` already notes another Vitest-version-sensitive API (`environmentMatchGlobs`) at upgrade time. | The parser worked during this audit and caught the heavy-tier worker drop. | At the next Vitest upgrade, add a small fixture/unit check for wrapper summary parsing or switch to a machine-readable reporter if available. |

## Prioritized follow-up tests / repair work

1. **Restore the heavy tier**
   - Reproduce `AUD-TEST-008-001` with `npm run test:heavy`.
   - Isolate whether `phase20.cardlessPlaytest.test.ts` alone OOMs or whether
     previous heavy files leave enough parent-process pressure to trigger the
     crash.
   - Split or refactor the playtest payload until the wrapper reports all 4
     heavy files and all 121 collected tests passing.

2. **Add a smoke tier or rebalance the fast tier**
   - Capture per-file runtimes from the current fast suite.
   - Move multi-minute fast-tier files into a medium/heavy tier or create
     `npm run test:smoke` for high-value route, engine, persistence, and card
     gates that can be run after every small change.

3. **Canonical-pipeline drift guard**
   - Add or extend a test that checks every production module id appears exactly
     once in `FULL_PIPELINE` and that older compatibility imports re-export the
     same object.
   - Convert local production-like arrays to canonical imports where practical.

4. **Keep Phase 7 UI blind spots in the test backlog**
   - Add the EntityLink destination matrix, stale-target fallback, ActionPicker
     parity, and BottomSheet keyboard/backdrop tests described in Phase 7.

## Tests and checks run

| Command | Result | Notes |
|---|---|---|
| `sed -n '1,220p' vitest.config.ts && sed -n '1,260p' scripts/run-tests.mjs && cat package.json` | Pass | Reviewed test-tier configuration, wrapper behavior, and npm scripts. |
| `find tests -name '*.test.ts'` / targeted inventory scripts | Pass | Counted 255 test files; top-level distribution is 106 sim, 78 cards, 35 reports, and 36 web. |
| `rg -n "\b(describe\|it\|test)\.(skip\|todo\|only)\|\.skip\(\|\.todo\(\|\.only\(" tests vitest.config.ts scripts/run-tests.mjs` | Pass | Found no active skipped/todo/only tests; only comments matched. |
| `rg -n "FULL_PIPELINE|\[.*Module|modules:\s*\[|pipeline" tests src/sim/testing` | Pass | Audited canonical versus local/partial pipeline usage. |
| `npm test` | Pass | 251 files and 3379 tests passed; duration 842.95s. Expected warning output appeared from tests that intentionally simulate legacy-save and storage-failure paths. |
| `npm run test:heavy` | Fail | 3 of 4 heavy files and 63 of 121 tests passed before a worker OOM; wrapper correctly failed the command for non-zero exit, collected-vs-run gaps, unhandled errors, and worker exit. |

## Phase 8 exit criteria

- Blind-spot matrix by area: complete.
- Prioritized audit-derived tests and repair work for later phases: complete.
- Runner/tier behavior verified with the default and heavy commands: complete,
  with a confirmed high-severity heavy-tier failure documented.
