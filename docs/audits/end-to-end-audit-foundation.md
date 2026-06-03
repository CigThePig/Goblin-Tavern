# End-to-End Codebase Audit Foundation

This document is the starting plan for a deliberately incremental audit of Goblin
Tavern. It is **not** the audit report. It defines the phases, boundaries,
artifacts, and initial code-map needed to inspect the codebase piece by piece for
mistakes that the current green tests can miss: unwired systems, stale design
assumptions, unreachable code, persistence drift, deterministic-replay hazards,
UI integration gaps, and weak test oracles.

## Why this audit exists

The project has grown into several tightly-coupled surfaces:

- a pure headless simulation pipeline under `src/sim/`;
- projection/report layers under `src/reports/`;
- compositional cards under `src/cards/` plus YAML authoring specs;
- a segmented Svelte day runner and persistence layer under `web/src/`;
- a large phase-oriented test suite under `tests/`.

The existing suite is valuable, but many tests assert known phase contracts rather
than unknown failure modes. This audit should therefore look for contract drift,
consumer/producer mismatches, stale extension seams, code that is only tested in
isolation, and browser/session paths that differ from headless test paths.

## Initial reconnaissance only

The foundation pass intentionally stopped after enough exploration to design the
audit. No findings below should be treated as confirmed defects unless a later
phase records reproduction evidence.

Snapshot from reconnaissance:

| Area | Observed scale / source of truth | Audit implication |
|---|---:|---|
| TypeScript files | 874 | Favor scripted inventory and narrow slices over manual browsing. |
| Svelte files | 68 | UI audit needs component wiring plus store-level behavior checks. |
| Test files | 255 | Audit should classify what each suite proves, not just that tests exist. |
| Card YAML specs | 20 | Card audit must compare specs, templates, registry, and rendered views. |
| Sim module folders | 29 | Module-by-module audits should use the canonical pipeline order. |
| Web components | 59 | Component-only tests may miss route/session/store integration. |
| Plan docs | 125 | Historical phase docs are context, not necessarily current truth. |

Reconnaissance files and commands used:

- `README.md`, `CLAUDE.md`, `package.json`, `vitest.config.ts`,
  `scripts/run-tests.mjs`.
- `src/sim/canonicalPipeline.ts`, `src/sim/core/engine.ts`,
  `src/sim/core/phases.ts`, `src/sim/core/module.ts`,
  `src/sim/core/result.ts`.
- `web/src/lib/sim/gameStore.svelte.ts`, `web/src/lib/sim/persistence.ts`.
- `src/cards/compose/assemble.ts`, `src/cards/templates/index.ts`.
- Existing historical investigation ledger:
  `docs/plans/seven-pass-investigation-plan.md`.
- Inventory commands: `rg --files`, `find ... -maxdepth`, targeted `rg -n`, and
  targeted `sed -n` reads. Avoid recursive `grep` and `ls -R`.

## Ground rules for every audit phase

1. **One bounded section at a time.** Do not mix repair work with discovery unless
   the user explicitly asks for a fix phase.
2. **Evidence before conclusions.** Each suspected issue needs at least two of:
   source path, consumer path, failing/manual reproduction, missing test oracle,
   or design-contract conflict.
3. **Distinguish candidates from defects.** Use the statuses in the finding log
   below; do not promote a suspicion directly to the issue tracker.
4. **Prefer executable probes.** When possible, add temporary local scripts or
   focused test invocations during the audit, then record the command and remove
   throwaway files unless the user asks to keep them.
5. **Respect source-of-truth boundaries.** Simulation state is authoritative;
   cards and reports should reveal state, not invent it.
6. **Assume historical docs may be stale.** Use old phase plans to understand why
   a system exists, then verify against current code and tests.
7. **No broad rewrites during audit.** The output of an audit phase is a compact
   findings table, proposed follow-up tests, and repair candidates.

## Standard phase deliverables

Each phase should produce or update a small Markdown file under this folder:

```text
docs/audits/
  end-to-end-audit-foundation.md      # this file
  phase-01-architecture-map.md        # example future phase output
  phase-02-sim-engine-and-state.md
  findings-ledger.md                  # optional consolidated ledger
```

Recommended finding schema:

| Field | Meaning |
|---|---|
| ID | Stable audit-local id, e.g. `AUD-SIM-001`. |
| Status | `candidate`, `confirmed`, `needs-design-call`, `tracked`, `fixed`, `wont-fix`. |
| Severity | `critical`, `high`, `medium`, `low`. |
| Area | System or file family. |
| Summary | One-sentence issue statement. |
| Evidence | File paths, line ranges, command output, or repro steps. |
| Current tests | Tests that cover adjacent behavior and what they miss. |
| Next action | Probe, test, design decision, or repair phase. |

## Audit phases and scope

### Phase 1 — Architecture and source-of-truth map

**Goal:** Establish the current runtime map before looking for defects.

Scope:

- Confirm the authoritative module order in `src/sim/canonicalPipeline.ts`.
- Map public entry points: headless `simulateDay`, segmented
  `advanceDaySegment`, report/card projections, and web store methods.
- Identify stale or secondary registries, compatibility exports, and historical
  wrappers that might confuse future audits.
- Produce a dependency diagram or table with producer/consumer edges.

Questions:

- Which arrays/registries are canonical at runtime versus extension seams?
- Which production code still imports from `testing/`, deprecated wrappers, or
  compatibility aliases?
- Are all source-of-truth lists validated by tests that fail on drift?

Suggested commands:

```bash
rg -n "FULL_PIPELINE|simulateDay|advanceDaySegment|runSimulation|moduleRegistry" src web/src tests
rg -n "from ['\"].*testing|deprecated|compat|alias" src web/src tests
```

Exit criteria:

- A current architecture map exists.
- Every later phase knows which entry points to exercise.

### Phase 2 — Simulation engine, phases, state, validation, and migrations

**Goal:** Audit the mechanics that all other layers rely on.

Scope:

- `src/sim/core/*`: phase ordering, dependency sorting, RNG streams, diffs,
  causes, report collection, validation timing, segment composition.
- `src/sim/state/*`: schemas, defaults, normalization, migrations, reference
  validation, save-envelope compatibility.
- Calendar gates: end-day, end-week, end-month, and day-clock segment seams.

Bug classes to hunt:

- Segment path differs from full-day path.
- Validation helper defaults omit canonical modules.
- Migrations repair initial state but not browser/import save state.
- Diffs omit slices that reports/cards read.
- Causes are emitted for state movement but not used, or used without coverage.
- Deterministic RNG shifts when unrelated hooks are added.

Suggested probes:

```bash
npm test -- tests/sim/phase7.engine.test.ts tests/web/phase186.daySegments.test.ts
npm test -- tests/web/persistence.test.ts tests/web/exportImport.test.ts
npm run typecheck
```

Exit criteria:

- Confirmed list of engine/state invariants and any untested invariants.
- Candidate migration/reference-validation gaps queued for focused tests.

### Phase 3 — Simulation modules by canonical pipeline slice

**Goal:** Audit producer modules in the order the game actually runs.

Recommended slices:

1. Foundations: areas, stock, staff, customers.
2. World identity: world, cultures, factions, suppliers, regulars, adventurers,
   expeditions, tavern identity.
3. Player/day systems: owner actions, service, weekly, monthly, local arcs.
4. Memory/analysis stack: memories, history, causes, attribution, pressures,
   feedback, issue seeds, responses.

For each module:

- Read `index.ts`, module state type/defaults, hooks, validators, reports, and
  tests.
- Trace every state field to at least one producer and one consumer, or mark it
  as intentionally dormant.
- Compare `dependsOn` with actual reads/writes.
- Check that module-local tests use realistic neighboring modules when needed.
- Look for caps, pruning, aging, and dedupe assumptions that only work for short
  playtests.

Suggested commands:

```bash
rg -n "export const .*Module|dependsOn|hooks|stateSchema|validate|buildReport" src/sim/modules/<module>
rg -n "<module id>|<state field>|<action id>" src web/src tests docs/plans
```

Exit criteria:

- Module slice ledger with field-level producer/consumer status.
- Candidate unwired fields separated from deliberate future seams.

### Phase 4 — Cards, issue seeds, and composition faithfulness

**Goal:** Verify cards are faithful consumers of issue seeds and sim facts.

Scope:

- `src/sim/modules/issues/*` seed generation, ranking, validation, and reports.
- `src/cards/registry.ts`, `src/cards/selection.ts`, `src/cards/templates/*`.
- `src/cards/compose/*` assembly, conditions, salience, preview selection, gates.
- `specs/cards/*.spec.yaml` as authoring/design inputs.
- Web card rendering in `web/src/lib/cards/*` and card deck components.

Bug classes to hunt:

- Seed families or subtypes route to fallback unintentionally.
- Template predicates never match the generator's emitted timing/family/subtype.
- Conditions read optional metadata without a fallback.
- Preview text promises effects not enforced by owner actions/responses.
- Spec YAML, template code, and tests disagree.
- Deterministic card selection masks low-variety or duplicate text failures.

Suggested commands:

```bash
rg -n "family:|subtype:|timing:|timings:|primaryActor|preview|fallback" src/cards src/sim/modules/issues tests/cards specs/cards
npm test -- tests/cards tests/web/phase193.actionPreviewsAndSuggest.test.ts
```

Exit criteria:

- Matrix from issue-seed family/subtype/timing to card template and tests.
- List of fallback routes that are intentional versus suspicious.

### Phase 5 — Reports, projections, and explanatory surfaces

**Goal:** Verify reports explain the same state changes the sim produced.

Scope:

- `src/reports/*` projection modules and label helpers.
- `src/reports/compose/*` report prose pools and section gates.
- Consumers in `web/src/lib/components/*Overview*`, `DailyReport`,
  `YesterdayDigest`, `TavernLog`, pressure/cause drilldowns.

Bug classes to hunt:

- Report projection reads stale `SimResult` data after state mutation.
- Labels hide missing references with plausible fallback text.
- Daily/weekly/monthly summaries disagree with raw state.
- Empty-state prose fires when there was meaningful activity.
- Sorting/salience makes important negative events invisible.

Suggested commands:

```bash
rg -n "build.*Projection|projection|digest|overview|cause|pressure|label" src/reports web/src/lib/components tests/reports
npm test -- tests/reports tests/web/debugBundle.test.ts
```

Exit criteria:

- Report source map: each displayed number/text traced to state, diff, cause, or
  issue seed.
- Candidate stale-data and label-masking issues documented.

### Phase 6 — Web store, persistence, import/export, and session recovery

**Goal:** Audit browser paths that often differ from headless tests.

Scope:

- `web/src/lib/sim/gameStore.svelte.ts`: day segment methods, picks,
  staff priorities, pending choices, route/subroute state, error handling.
- `web/src/lib/sim/persistence.ts`, `exportImport.ts`, snapshots, debug bundle.
- `web/src/lib/prefs/*`: separate preference persistence.
- LocalStorage quota/unavailable behavior and corrupted-save behavior.

Bug classes to hunt:

- Mid-day save/refresh resumes with a wrong day baseline or duplicated actions.
- Save migration validates root state but drops/mishandles nested day baseline.
- Import/export accepts impossible pending choices.
- UI reports save success after failed storage write.
- Preferences and game save share hidden assumptions about storage availability.

Suggested commands:

```bash
rg -n "saveSession|loadSession|dayBaseline|latestResultLite|pendingBySeedId|localStorage|export|import" web/src tests/web src/sim/state
npm test -- tests/web/persistence.test.ts tests/web/exportImport.test.ts tests/web/phase89.persistenceSafety.test.ts
npm run build
```

Exit criteria:

- Documented browser/session state machine.
- Reproduction scripts or tests for any confirmed recovery defects.

### Phase 7 — UI screens, components, accessibility, and player affordances

**Goal:** Audit whether the UI faithfully exposes valid actions and state.

Scope:

- `web/src/App.svelte`, screens in `web/src/lib/screens/*`.
- Navigation, bottom sheets, action picker, detail sheets, entity/metric links.
- Components that render card/report/projection data.
- CSS/design-token assumptions that affect tappability and readability.

Bug classes to hunt:

- Buttons appear enabled but store/action layer rejects them.
- Detail sheets can open for missing entities or stale ids.
- Route/subroute state makes important cards unreachable.
- Component tests mount happy paths but miss real store sequences.
- Accessibility regressions: unlabeled controls, focus traps, modal escape paths.

Suggested commands:

```bash
rg -n "on:click|onclick|button|aria-|role=|BottomSheet|EntityLink|MetricLink|ActionPicker" web/src tests/web
npm test -- tests/web tests/web/components
npm run check
```

Exit criteria:

- UI path map from primary player actions to store methods and engine inputs.
- Accessibility and interaction findings classified by severity.

### Phase 8 — Test-suite oracle and blind-spot audit

**Goal:** Determine what the green test suite does and does not prove.

Scope:

- Test tiers in `vitest.config.ts` and `scripts/run-tests.mjs`.
- Per-directory test intent: `tests/sim`, `tests/cards`, `tests/reports`,
  `tests/web`.
- Snapshot/string tests versus behavioral/property tests.
- Heavy playtests and whether their assertions catch silent failures.

Bug classes to hunt:

- Tests assert implementation details that allow real behavior to drift.
- Tests use partial module pipelines that mask canonical-pipeline issues.
- Random/playtest runs are deterministic but too narrow in seed diversity.
- Wrapper catches worker drops but not skipped describe blocks or weak assertions.

Suggested commands:

```bash
rg -n "describe\(|it\(|test\(|expect\(|FULL_PIPELINE|\[.*Module|skip|todo|only" tests src/sim/testing vitest.config.ts scripts/run-tests.mjs
npm test
npm run test:heavy
npm run test:full
```

Exit criteria:

- Blind-spot matrix by area: covered, adjacent-only, missing, misleading.
- Prioritized list of audit-derived tests to add in later repair work.

### Phase 9 — Content/data quality, balance, and long-run simulation behavior

**Goal:** Find problems that require long-run or data-wide inspection.

Scope:

- Content registries under `src/sim/content/*`.
- Naming/cast/voice attributes, faction/culture/supplier/NPC cross-links.
- Long-run caps and pruning: memories, causes, rumours, history, issue seeds,
  pressures, invoices, projects, expeditions.
- Economy and balance loops over weeks/months.

Bug classes to hunt:

- Rare content never appears because weights or prerequisites are wrong.
- Long-run arrays grow without pruning.
- Economic loops trend to impossible states under plausible play.
- Generated identities collide, lose attribution, or drift across saves.

Suggested probes:

```bash
npm run test:heavy
node scripts/diagnoseReadiness.ts
node scripts/diagnoseImpactScore.ts
```

Exit criteria:

- Long-run invariants and dashboards identified.
- Candidate balance/content defects separated from tuning preferences.

### Phase 10 — Prioritization, repair roadmap, and issue-tracker promotion

**Goal:** Turn confirmed findings into a small, actionable repair sequence.

Scope:

- Consolidate all phase ledgers.
- Deduplicate findings across layers.
- Group defects by shared root cause rather than surface symptom.
- Promote confirmed, scoped work to `docs/ISSUE_TRACKER.md` only after user
  approval or explicit follow-up instruction.

Exit criteria:

- Prioritized repair roadmap with severity, risk, and suggested tests.
- Clear list of `wont-fix` / design-call items.
- No speculative candidates promoted as confirmed bugs.

## Cross-cutting audit checklists

### Unwired-code checklist

- Is the file exported from an index or registry?
- Is the export imported by production code, tests only, or nowhere?
- If imported, is it called on the canonical runtime path?
- Does it mutate/read state that is serialized and validated?
- Is there a UI/report/card consumer, or is it intentionally headless?
- Does a test fail if this code is disconnected?

### State-field checklist

- Default exists.
- Schema validates it.
- Migration hydrates old saves.
- At least one producer mutates it.
- At least one consumer reads it.
- Diff/cause/report surfaces include it when player-visible.
- Persistence/import/export round-trip keeps it.
- Long-run cap/pruning exists if it can grow.

### Determinism checklist

- No `Math.random()` in sim/card/report selection paths.
- RNG stream ids are stable and named for identity-generating paths.
- Adding an unrelated hook does not shift identity names or persistent rosters.
- Web seeds use stable calendar coordinates and survive save/resume.
- Tests compare repeated runs from the same input and divergent runs from
  intentionally different input.

### UI integration checklist

- UI control state matches action `canApply` / store guard behavior.
- Selected ids remain valid after simulation advances or imports a save.
- Modal/detail routes handle missing entities gracefully.
- Save, import, export, and debug surfaces report failures honestly.
- Accessibility labels and keyboard/focus behavior exist for interactive chrome.

## Recommended first concrete audit section

Start with **Phase 1 — Architecture and source-of-truth map**. It is the smallest
safe first section because it establishes which runtime lists, wrappers, and entry
points every later audit phase must trust. Do not start by hunting individual
module bugs until the source-of-truth map is current.
