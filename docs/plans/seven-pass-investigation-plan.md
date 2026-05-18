# Seven-Pass Investigation Plan

This document is the working ledger for a multi-pass investigation into unwired
systems, UI issues, bugs, dead fields, incomplete feature loops, and regression
risk across Goblin Tavern. Each pass should leave durable notes here so later
passes can build from evidence instead of re-discovering the same gaps.

## How to use this file

1. Work one pass at a time, in order, unless a blocker requires jumping ahead.
2. For every finding, record the evidence path, reproduction path, severity,
   owner system, and recommended follow-up.
3. Promote actionable defects to `docs/ISSUE_TRACKER.md` only after the pass has
   enough evidence to scope a repair phase.
4. Keep speculation separate from confirmed defects. Use the finding status
   values below.
5. At the end of each pass, update the pass summary and the cross-pass backlog.

## Finding status values

- `candidate` — suspicious gap; needs one more source of evidence.
- `confirmed` — reproduced or proven by code path / test path.
- `tracked` — promoted to `docs/ISSUE_TRACKER.md` or a phase plan.
- `fixed` — resolved in a later change and verified.
- `wont-fix` — intentionally accepted; document why.

## Severity guide

- `critical` — blocks play, corrupts saves, or prevents core loop progression.
- `high` — major system is unwired, misleading, or routinely fails.
- `medium` — noticeable UX / balance / data issue with a workaround.
- `low` — polish, copy, minor edge case, or test coverage gap.

## Cross-pass backlog

| ID | Pass | Area | Severity | Status | Summary | Evidence | Next action |
|---|---:|---|---|---|---|---|---|
| P1-001 | 1 | Architecture docs | low | candidate | `FULL_PIPELINE` is the real module list, while `moduleRegistry` exists as an empty exported registry and older comments still describe a Phase 19-era pipeline. | `src/sim/testing/simRunner.ts`, `src/sim/registries/moduleRegistry.ts` | Phase 2 should treat `FULL_PIPELINE` as source of truth and decide whether to remove, populate, or document `moduleRegistry`. |
| P1-002 | 1 | Persistence docs | medium | candidate | Save/load truth is split between web persistence, sim migrations, and an older sim save-envelope stub; this is not a confirmed runtime bug, but it is a drift risk for Phase 6. | `web/src/lib/sim/persistence.ts`, `src/sim/state/migrations.ts`, `src/sim/state/saveEnvelope.ts` | Phase 6 should mutate old/corrupt saves and verify every migration path is reachable from browser load/import. |
| P1-003 | 1 | Historical phase plans | low | candidate | Several older phase plans contain intentionally historical “stub/deferred/coming soon” language that is no longer current after Phases 89-98. | `docs/plans/phase-87-web-chassis.md`, `docs/plans/phase-88-card-layer-day-loop.md`, `docs/plans/phase-90-weekly-overview.md`, current `web/src/lib/screens/*` | Later passes should rely on code/current overview docs first, and only use old phase plans as implementation history. |
| P1-004 | 1 | Empty/secondary registries | low | candidate | Most content registries self-seed, but some exported registries are structural placeholders or mirrors (`moduleRegistry`, `src/sim/registries/issueSeedRegistry.ts`, event registries). | `src/sim/registries/*`, `src/sim/content/events/*`, `src/sim/modules/issues/issueSeedRegistry.ts` | Phase 4 should distinguish intentional extension seams from dead registries before filing defects. |
| P1-005 | 1 | UI subroute persistence | medium | candidate | Top-level route is persisted, but Reports/Tavern/World sub-tabs are local `$state`; this may be acceptable, but it means reload/continue restores only the top tab. | `web/src/App.svelte`, `web/src/lib/screens/ReportsScreen.svelte`, `web/src/lib/screens/TavernScreen.svelte`, `web/src/lib/screens/WorldScreen.svelte` | Phase 5/6 should decide whether sub-tab restoration is required or explicitly accepted as ephemeral UI state. |
| P2-001 | 2 | Report pipeline | medium | confirmed | The engine collects module `buildReport` output before running `generateReports` hooks, but `issueSeedsModule` uses a `generateReports` hook to create the seeds its report claims to include. The state is updated for tomorrow's UI, while the same day's `SimResult.reports` can describe the previous seed set. | `src/sim/core/engine.ts`, `src/sim/modules/issues/issueSeedModule.ts`, `src/sim/core/module.ts` | Phase 3 should decide whether to move `generateReports` hooks before `collectReports`, split seed generation into an earlier phase, or make report builders pull after hook writes. |
| P2-002 | 2 | RNG / web day runner | medium | confirmed | Web `runDay` seeds the simulation with `${seedString}-d${state.calendar.day}`, so day-of-month RNG seeds repeat every 28-day month for systems using `ctx.rng`; headless callers often use absolute-day seeds, so browser play can have a different long-run variance pattern. | `web/src/lib/sim/gameStore.svelte.ts`, `src/sim/core/engine.ts`, `src/sim/core/rng.ts`, `src/sim/modules/calendar/index.ts` | Use an absolute-day/calendar-coordinate seed in the web runner and confirm save/resume keeps expedition stored seeds stable. |
| P2-003 | 2 | Validation defaults | low | confirmed | `validateState()` without an explicit module list resolves `moduleRegistry.all()`, but the active runtime uses `FULL_PIPELINE` and `moduleRegistry` is not populated. Browser load and engine validation pass `FULL_PIPELINE`, but ad-hoc diagnostics that call `validateState(state)` do not enforce module-state schemas. | `src/sim/state/validation.ts`, `src/sim/registries/moduleRegistry.ts`, `src/sim/testing/simRunner.ts`, `web/src/lib/sim/persistence.ts` | Phase 7 should add a canonical validation helper or populate/deprecate `moduleRegistry`; until then, deep audits should pass `FULL_PIPELINE` explicitly. |
| P2-004 | 2 | Save migrations | medium | candidate | Browser save hydration manually chains five additive migrations, while newer module/top-level slices rely on current saves already carrying the fields. This pass did not mutate old saves, so compatibility risk remains unproven but scoped for Phase 6. | `web/src/lib/sim/persistence.ts`, `src/sim/state/migrations.ts`, `src/sim/state/defaults.ts`, `src/sim/state/schemas.ts` | Phase 6 should build old-save fixtures that omit late slices (`recipes`, `expeditions`, newer module states, response queues) and verify load/import behavior. |
| P2-005 | 2 | Change-tracker docs | low | confirmed | `ChangeTracker` comments still describe multiple phase-boundary snapshots, but the engine now snapshots/finalizes only the full `day` boundary after Phase 76. Runtime behavior is coherent; the risk is stale architecture guidance during later diff/cause audits. | `src/sim/core/changeTracker.ts`, `src/sim/core/engine.ts`, `src/sim/core/diff.ts` | Treat `SimResult.diffs[boundary='day']` as the only current production diff unless a later repair reintroduces per-phase boundaries. |
| P3-001 | 3 | Cross-surface action queue | medium | confirmed | The central ActionPicker disables actions against remaining queued action points, but Tavern quick actions, project/policy buttons, and the expedition sheet queue directly through `gameStore.addPick()` using projection-time disabled reasons computed against the full daily budget. These surfaces can overfill the queue; the sticky chip warns, but the engine later rejects overflow after the player ends the day. | `web/src/lib/components/ActionPicker.svelte`, `web/src/lib/components/tavern/QuickActions.svelte`, `web/src/lib/components/tavern/ProjectsPanel.svelte`, `web/src/lib/components/tavern/CommissionExpeditionSheet.svelte`, `src/reports/tavernOverviewProjection.ts`, `src/sim/modules/ownerActions/ownerActionsModule.ts` | Add a shared queue-aware disabled helper or make `gameStore.addPick()` enforce budget for all owner-action entry points. |
| P3-002 | 3 | Action picker UI | low | confirmed | Queued action chips render the label/target text twice inside the same chip, making queued choices visually noisy and potentially confusing. | `web/src/lib/components/ActionPicker.svelte` | Remove the duplicated label span content in the picker chip. |
| P3-003 | 3 | Missed opportunities | medium | candidate | The missed-opportunity projector recommends pressure remedies and counterfactual actions by registry/remedy map, but does not run the same target/current-state `canApply` checks the owner-action UI uses. It can therefore teach an action that may not have been affordable or valid at the time. | `src/reports/missedOpportunityProjection.ts`, `src/reports/pressureRemedyMap.ts`, `src/sim/modules/ownerActions/readonlyHelpers.ts` | Phase 7 should decide whether missed opportunities need historical validity snapshots or should be limited to actions currently/previously valid. |
| P3-004 | 3 | Card choice affordances | low | candidate | `CardChoice.disabledReason` exists and the renderer displays it, but card helper/template paths never populate it. If future response slots gain requirements/costs, the UI has a display slot but no source-to-render validation path. | `src/cards/types.ts`, `src/cards/cardHelpers.ts`, `web/src/lib/cards/CardRenderer.svelte`, `src/sim/modules/issues/issueSeedTypes.ts` | Keep as a guardrail for future response-slot preconditions; no repair needed until slots gain real disabled conditions. |
| P3-005 | 3 | Ignore routing | low | fixed | Generic Ignore and modeled `ignore` slots now have distinct paths: the renderer hides generic Ignore when a card already has an ignore-verb choice, and `selectConsequence()` no longer uses verb-only fallback. | `web/src/lib/cards/CardRenderer.svelte`, `web/src/lib/sim/intentBuilder.ts`, `src/sim/modules/responses/selectConsequence.ts`, `tests/sim/issue-generic-ignore-routing.test.ts` | Treat as a regression guard during Phase 3 repairs; do not reopen unless a new fallback path appears. |
| P4-001 | 4 | Stock / areas | medium | confirmed | `StockState.storageAreaId` drives spoilage modifiers and UI labels, but reference validation does not check that the id exists in `state.areas`. A dangling storage area silently falls back to default spoilage and displays an id without a label. | `src/sim/state/referenceValidation.ts`, `src/sim/modules/stock/spoilage.ts`, `src/reports/tavernOverviewProjection.ts`, `src/sim/registries/stockRegistry.ts` | Add stock storage-area reference validation and decide whether stock may reference registry-only areas missing from state. |
| P4-002 | 4 | Area traits / upgrades | medium | confirmed | Area `traits` and `upgrades` are schema strings/records but are not cross-reference validated. The Tavern overview calls `areaTraitRegistry.get()` / `areaUpgradeRegistry.get()` while projecting rows, so a bad save or stale registry id can throw in the UI instead of failing validation. | `src/sim/state/schemas.ts`, `src/sim/state/referenceValidation.ts`, `src/reports/tavernOverviewProjection.ts`, `src/sim/content/tavern/areaTraitRegistry.ts`, `src/sim/content/tavern/areaUpgradeRegistry.ts` | Extend validation to verify area trait/upgrade ids and optionally allowed area tags/ids. |
| P4-003 | 4 | Supplier economy | medium | confirmed | Supplier relationship/reliability/market-condition pricing is implemented in supplier helpers and reports, but the primary `restock_item` owner action still prices purchases as `amount * item.basePrice` with no supplier choice, effective price, reliability, or missed-delivery consequence. | `src/sim/modules/suppliers/pricing.ts`, `src/sim/modules/suppliers/supplierModule.ts`, `src/sim/modules/ownerActions/actionDefinitions.ts`, `src/sim/modules/stock/sales.ts`, `src/reports/worldOverviewProjection.ts` | Decide whether restock should choose a supplier or whether supplier pricing remains report-only; if gameplay-bearing, route restock through `getEffectiveBasePrice()` and supplier availability. |
| P4-004 | 4 | Areas / issue seeds | low | confirmed | Phase 73 unpinned some `main_room` references, but issue seed generators still contain several hardcoded `areaRef('main_room')` and direct `areas.main_room.*` effects. New customer-facing areas therefore remain underused by seed content. | `docs/plans/phase-73-storage-integration.md`, `src/sim/modules/issues/issueSeedGenerators.ts`, `src/sim/modules/issues/expandedSeedGenerators.ts` | Continue the unpin pass with a shared area picker for customer-facing / kitchen-adjacent / repairable areas, and keep `main_room` only as fallback. |
| P4-005 | 4 | Rumours / memory | low | confirmed | `SocialRumourState.subject` and `involvedRefs` are validated as `EntityRef`s, but bare `sourceEntityId` and `targetEntityId` are only resolved at projection time by scanning known ids and falling back to the raw string. Dangling rumour endpoints can survive validation. | `src/sim/state/TavernState.ts`, `src/sim/state/referenceValidation.ts`, `src/reports/entityLabels.ts`, `src/reports/worldOverviewProjection.ts`, `src/sim/modules/attribution/attributionRules.ts` | Prefer typed `EntityRef`s for rumour source/target, or add conservative validation for bare ids against all entity indexes. |
| P5-001 | 5 | Day / Reports navigation | medium | confirmed | The Yesterday digest tap-through calls `gameStore.setRoute('reports')`, but `App.svelte` renders from its local `view` state and has no effect that follows later store-route mutations. The button can update the persisted route without changing the visible screen until reload/navigation. | `web/src/lib/screens/DayScreen.svelte`, `web/src/App.svelte`, `web/src/lib/components/YesterdayDigest.svelte` | Route in-app tap-throughs through the App-level `navigate()` path, add a store route subscription/effect, or pass a navigation callback into DayScreen. |
| P5-002 | 5 | Modal sheets / accessibility | high | confirmed | `BottomSheet` claims Escape closes sheets, but keydown inside the dialog calls `stopPropagation()`, so focused controls inside ActionPicker, Glossary, detail sheets, and StaffPrioritySheet never reach the backdrop Escape handler. The sheet also renders with `tabindex="-1"` but never focuses itself or restores opener focus. | `web/src/lib/components/BottomSheet.svelte`, `web/src/lib/components/ActionPicker.svelte`, `web/src/lib/components/Glossary.svelte`, `web/src/lib/components/StaffPrioritySheet.svelte` | Move Escape handling onto the dialog or document/window while open, focus the sheet/first control on open, and restore focus to the opener on close. |
| P5-003 | 5 | UI subroute persistence | low | confirmed | Reports, Tavern, and World sub-tabs are local `$state` values initialized to Today/Areas/Regulars. Continue/reload restores only the top-level route, so a player saved on Reports→Monthly, Tavern→Projects, or World→Rumours lands on that screen's default sub-tab. | `web/src/App.svelte`, `web/src/lib/sim/persistence.ts`, `web/src/lib/screens/ReportsScreen.svelte`, `web/src/lib/screens/TavernScreen.svelte`, `web/src/lib/screens/WorldScreen.svelte` | Product decision: either persist subroute state in the session envelope or explicitly document sub-tabs as ephemeral. |
| P5-004 | 5 | Preferences / font scaling | low | candidate | The Font scale setting persists and updates `<html data-font-scale>`, but the global stylesheet notes that most visible type tokens are fixed px values, so the setting has only modest coverage despite being presented as a body-text accessibility control. | `web/src/lib/components/more/SettingsSection.svelte`, `web/src/lib/prefs/prefsStore.svelte.ts`, `web/src/App.svelte`, `web/src/lib/design/global.css` | Decide whether this is acceptable copy/expectation management or convert type tokens/components to rem-based sizing for a stronger large-text mode. |
| P6-001 | 6 | Autosave / storage errors | high | confirmed | Autosave writes can fail silently: `saveSession()` catches storage/quota errors and returns `void`, while `App.svelte` always copies the just-serialized timestamp into `gameStore.lastSavedAt`. The More screen can therefore report a recent autosave even when localStorage did not persist it. | `web/src/lib/sim/persistence.ts`, `web/src/App.svelte`, `web/src/lib/components/more/SavesSection.svelte` | Make `saveSession()` return a success/failure result and surface a recoverable save-error banner instead of updating `lastSavedAt` unconditionally. |
| P6-002 | 6 | Old-save migrations | high | confirmed | The browser load/import/snapshot path runs five additive `ensure*` helpers before validating, but top-level required slices added later (`recipes`, `expeditions`, newer world rosters, required module slices) are not synthesized. A structurally valid older save that predates those required fields will fail validation instead of being migrated. | `web/src/lib/sim/persistence.ts`, `src/sim/state/migrations.ts`, `src/sim/state/defaults.ts`, `src/sim/state/schemas.ts`, `src/sim/state/saveEnvelope.ts` | Replace ad-hoc helpers with a version-stepped migration pipeline or add explicit default-slice migrations using the current default factories. |
| P6-003 | 6 | Save input sanitation | medium | confirmed | `validatePersistedSession()` sanitizes staff priorities, pending card choices, route, and beat, but `picks` are accepted as any array and cast to `PickedAction[]`. Imported/corrupt saves can hydrate malformed queued actions that the UI/engine later treats as valid picks. | `web/src/lib/sim/persistence.ts`, `web/src/lib/sim/gameStore.svelte.ts`, `web/src/lib/sim/actionBuilder.ts` | Add a `sanitizePicks()` helper that verifies action id, label/category, target/options shape, and non-negative action-point cost against the action registry where possible. |
| P6-004 | 6 | Save slots / deletion UX | medium | confirmed | Snapshot load/import replacement is gated behind an explicit confirmation, but snapshot deletion is wired directly from `SnapshotRow` to `deleteSnapshot()` with no confirm/undo path. A mistap permanently removes the named slot metadata and payload. | `web/src/lib/components/more/SavesSection.svelte`, `web/src/lib/components/more/SnapshotRow.svelte`, `web/src/lib/sim/snapshots.ts` | Add an in-place delete confirmation or undo toast before removing snapshot payloads. |
| P6-005 | 6 | Save slots / orphan payloads | low | candidate | If the snapshot index is malformed, unsupported, or fails to write after payload changes, `readIndex()` falls back to an empty index. Existing snapshot payload keys remain in storage but become unreachable from the UI and still count against the storage budget. | `web/src/lib/sim/snapshots.ts` | Consider index-rebuild/recovery by scanning `SNAPSHOT_PAYLOAD_PREFIX` keys, or add cleanup tooling for orphan payloads. |

---

## Phase 1 — Inventory, architecture map, and previous-plan reconciliation

**Goal:** Build a current map of implemented systems, planned systems, and stale
or contradictory documentation before judging whether something is unwired.

**Primary questions**

- Which domains exist in `src/sim`, `web/src/lib`, `tests`, and `docs/plans`?
- Which phase plans claim functionality that is not present or only partially
  present?
- Which issue-tracker entries are marked done but still have code-level gaps?
- Which modules export registries, state slices, actions, reports, or UI panels
  that should be connected elsewhere?

**Suggested checks**

- Catalogue source directories, registries, module indexes, screens, cards,
  panels, and test files.
- Compare phase plans and issue-tracker statuses with current code paths.
- Trace app boot, route definitions, save envelope, and route persistence.
- Identify duplicate concepts, stale names, superseded docs, and TODO-like
  comments that still imply missing implementation.

**Artifacts to fill**

| Area | Expected source of truth | Current implementation | Gap / risk | Evidence |
|---|---|---|---|---|
| Simulation modules | `src/sim/testing/simRunner.ts` (`FULL_PIPELINE`) plus each module's `index.ts` / `*Module.ts` export. | 29 top-level module domains exist under `src/sim/modules`: areas, stock, staff, customers, world/culture/faction/supplier/regular/adventurer/expedition domains, owner actions, service, weekly/monthly/local arcs/tavern identity, memories/history/causes/attribution/pressures/feedback/issues/responses, plus type-only calendar/economy/reports helpers. The canonical run order is the array in `FULL_PIPELINE`; `moduleRegistry` is not populated by the runtime. | Architecture drift risk: comments and old plans still call the runner a Phase 19 pipeline even though it now carries Phase 95+ modules; `moduleRegistry` can mislead later audits if treated as authoritative. | `find src/sim/modules -mindepth 1 -maxdepth 1 -type d`; `sed -n '1,220p' src/sim/testing/simRunner.ts`; `sed -n '1,40p' src/sim/registries/moduleRegistry.ts` |
| Web screens / routes | `web/src/App.svelte` and `web/src/lib/sim/persistence.ts` `Route` union. | Start gate plus five persisted top-level routes: `day`, `reports`, `tavern`, `world`, `more`. Reports has Today/Pressures/Weekly/Monthly/Log; Tavern has Areas/Stock/Recipes/Staff/Projects; World has Regulars/Suppliers/Factions/Cultures/NPCs/Rumours. The old `ComingSoon.svelte` component remains in the tree but is not part of App's active route switch. | Only top-level route is saved. Sub-tabs are local state and reset on reload/continue; confirm in Phase 5/6 whether this is intended. | `sed -n '1,280p' web/src/App.svelte`; `sed -n '1,260p' web/src/lib/screens/ReportsScreen.svelte`; `sed -n '1,260p' web/src/lib/screens/WorldScreen.svelte`; `rg -n "export type Route" web/src/lib/sim/persistence.ts` |
| Registries / catalogs | `src/sim/registries/*`, `src/sim/content/**/*Registry.ts`, `src/sim/content/**/*Profiles.ts`, and domain registries under modules. | Core catalogs self-seed for actions, areas, customers, stock, recipes, reputation axes, staff roles/priorities, cultures, factions, suppliers, market conditions, naming/staff/NPC profiles, area traits/upgrades, local arcs, pressures, and issue seed generators. Recipe/stock/supplier/expedition/adventurer and identity catalogs now feed UI panels and service/economy modules. | Some exported registries appear intentionally structural rather than populated (`moduleRegistry`, sim-level `issueSeedRegistry`, local/seasonal event registries). Do not call these defects until Phase 4 traces intended extension seams versus dead APIs. | `rg -n "new Registry|register\(" src/sim/registries src/sim/content src/sim/modules/pressures src/sim/modules/issues`; `find src/sim/content -name '*Registry.ts' -o -name '*Profiles.ts'` |
| Persistence / saves | Browser persistence in `web/src/lib/sim/persistence.ts`; state defaults/migrations/validation in `src/sim/state`. | Phase 96-style session save persists sim state, latest result-lite, previous calendar, picks, staff priorities, pending choices, day-session beat/completion flags, top-level route, and missed-opportunity dismissals. Load applies sim migrations and validates against `FULL_PIPELINE`. App boot hydrates preferences first, then save state, and autosaves after reactive store changes plus pagehide/visibility events. | Split ownership is a Phase 6 target: sim-side `saveEnvelope.ts` remains a stub while browser persistence does real I/O and manual migration chaining. Also verify import/export uses the same sanitation guarantees. | `sed -n '1,380p' web/src/lib/sim/persistence.ts`; `sed -n '1,230p' web/src/lib/sim/gameStore.svelte.ts`; `sed -n '1,80p' src/sim/state/saveEnvelope.ts` |
| Tests / diagnostics | `tests/**`, `scripts/diagnose*.ts`, `scripts/run-tests.mjs`, and `src/sim/testing/*`. | Test inventory is broad: 85 sim test files, web persistence/snapshot/preference/difficulty/export-import tests, card/voice/report tests, readiness and impact diagnostics, balance/playtest runners, contradiction/readiness/coverage reports. User confirmed tests already pass and requested that Phase 1 not re-run them. | Phase 1 did not execute tests by request. Later passes should use existing diagnostics selectively only when the pass requires reproduction, not as blanket regression reruns. | `find tests/sim -type f`; `rg --files tests scripts src/sim/testing`; user instruction in this turn |
| Documentation claims | Current code plus `docs/ISSUE_TRACKER.md` for closed repair history; phase plans as historical implementation specs. | Issue tracker index marks ISSUE-001 through ISSUE-048 done/superseded. Current source contains implementations for late web phases (Reports/Tavern/World/More, persistence, snapshots, preferences) that supersede older “ComingSoon” / “browser save deferred” wording in Phase 87-90 docs. | Old phase plans can mislead later passes if read as current status. Keep them as history; record stale claims when they contradict current code, but do not rewrite all historical plans during this investigation. | `sed -n '1,120p' docs/ISSUE_TRACKER.md`; `rg -n "ComingSoon|deferred|stub|placeholder" docs/plans web/src src/sim` |

**Exit criteria**

- A system map exists for all top-level sim and web domains.
- Any stale documentation that could mislead later passes is recorded.
- Later passes have a prioritized list of systems to trace deeply.

### Phase 1 system map notes

- **Engine and module order:** `simulateDay` owns the phase loop declared in
  `src/sim/core/phases.ts`; `FULL_PIPELINE` in `src/sim/testing/simRunner.ts`
  is the active, ordered production/test module list. The registry named
  `moduleRegistry` is currently just an exported `Registry<SimulationModule>`
  and is not the boot source.
- **State ownership:** fresh state is assembled by `createInitialTavernState`
  from core slices (`calendar`, `areas`, `stock`, `staff`, `customerGroups`,
  `reputation`, `recipes`, `world`, `pressures`, `history`, `causes`,
  `attribution`) plus module-owned state slots for stock, owner actions,
  weekly/monthly, causes/pressures/feedback, issue seeds, suppliers, regulars,
  local arcs, attribution, and responses.
- **Content/data graph:** expandable concepts are mostly registry-backed:
  owner actions, staff roles/priorities, areas, stock, recipes, reputation
  axes, cultures, factions, suppliers/market conditions, area traits/upgrades,
  local arcs, pressures, issue seed generators, naming profiles, staff identity
  profiles, and notable NPC profiles. Phase 4 should focus on reverse links and
  consumer reachability rather than existence.
- **Report/projection layer:** sim reports live under `src/sim/modules/*`, while
  user-facing projections live under `src/reports/*` and feed Svelte screens.
  Reports, Tavern, World, daily digest, missed opportunities, pressure remedy,
  glossary, and log projections are all separate from raw simulation state.
- **Web shell:** `web/src/App.svelte` gates boot through Start, then renders the
  route inside `AppShell`. The active top-level routes are Day, Reports,
  Tavern, World, and More. Top-level route persists; nested Reports/Tavern/World
  subviews do not persist yet.
- **Persistence surface:** browser persistence is the practical source of truth
  for playable saves. It owns localStorage I/O and delegates state repair to sim
  migrations plus validation. Snapshots and import/export sit under
  `web/src/lib/sim`, and More-tab sections expose those surfaces.
- **Testing/diagnostics:** existing coverage is phase-oriented and broad. Since
  this pass is an inventory/doc pass and the user explicitly said all tests
  already pass, no tests were re-run for Phase 1.

### Phase 1 previous-plan reconciliation

- **Issue tracker:** The index currently has no `open` or `in-progress` items;
  it is a closed repair-pass ledger through ISSUE-048. Phase 1 did not find
  enough evidence to reopen any done issue without deeper pass-specific traces.
- **Historical phase docs:** Plans for Phases 87-90 still contain language about
  `ComingSoon` screens, deferred browser saves, and future weekly/monthly/log
  tabs. Current code has since implemented those areas. Treat these as history,
  not current status, unless a later pass reproduces a code-level gap.
- **Documentation source-of-truth rule for later passes:** Prefer current source,
  tests, `docs/ISSUE_TRACKER.md`, and this investigation ledger over old phase
  plan prose when deciding whether a system exists. Use old plans to understand
  intended scope and out-of-scope decisions.
- **No promotions yet:** P1 findings remain `candidate` in the cross-pass
  backlog because Phase 1 only catalogued and reconciled architecture. Promote
  to `docs/ISSUE_TRACKER.md` only after a later pass proves a runtime or UX
  defect with reproduction.

### Phase 1 exit summary

- **Completed:** Catalogued top-level sim modules, web routes/screens, registry
  families, save/persistence surfaces, test/diagnostic inventory, and stale-doc
  risks.
- **Primary systems to trace next:** engine/state/diff/report pipeline (Phase
  2), player action/card/response wiring (Phase 3), registry/content reverse
  links (Phase 4), UI route/subview behavior (Phase 5), and save/import/export
  edge cases (Phase 6).
- **Current severity picture:** no critical/high confirmed findings from the
  inventory pass; medium candidates are persistence source-of-truth drift and
  route/subview persistence expectations; low candidates are stale docs and
  unused/structural registries.

---

## Phase 2 — Core simulation loop and state integrity

**Goal:** Verify that the day / week / month progression, state mutation,
validation, migrations, RNG, and diff/report pipelines are wired end-to-end.

**Primary questions**

- Can every beat of the playable loop progress without hidden invalid state?
- Do state mutations consistently emit diffs, reports, attribution, and history?
- Are migrations and normalization paths compatible with current state shape?
- Are RNG streams deterministic where expected and isolated where needed?

**Suggested checks**

- Trace `createInitialTavernState`, engine phases, module registration,
  validation, and save/load hydration.
- Run or add focused diagnostics for state changes across multiple days,
  weekly boundaries, and monthly boundaries.
- Compare expected mutations with `createStateDiff`, significant diff handling,
  history logs, and reports.
- Look for dead fields, write-only fields, read-only fields, and derived values
  that never feed player-visible decisions.

**Artifacts to fill**

| System | Entry point | Mutation path | Player-visible output | Test coverage | Findings |
|---|---|---|---|---|---|
| Day loop | `web/src/lib/sim/gameStore.svelte.ts` `runDay()` for browser play; `src/sim/core/engine.ts` `simulateDay()` for the engine; `FULL_PIPELINE` for module order. | `runDay()` bundles queued owner actions, sticky staff priorities, and response intents into one `simulateDay()` call, snapshots the pre-run calendar for reports, stores `latestResult`, clears per-day picks/pending choices, resets beat completion flags, prunes missed-opportunity dismissals, and returns the advanced state. Engine phases gate `endWeek` and `endMonth`, validate before `advanceCalendar`, then finalize one day-level diff after the calendar tick. | Daily progression is wired end-to-end, but the browser seed uses day-of-month rather than absolute day (`P2-002`). The diff tracker only publishes the full-day boundary despite older comments implying more. | `web/src/lib/sim/gameStore.svelte.ts`; `web/src/lib/screens/DayScreen.svelte`; `src/sim/core/engine.ts`; `src/sim/core/phases.ts`; `src/sim/core/changeTracker.ts` | `P2-002`, `P2-005` |
| Service / closing | `serviceModule`, `customersModule`, `pressuresModule`, `feedbackModule`, `issueSeedsModule`, and `responsesModule` across `beforeService`, `service`, `afterService`, `closing`, `applyResponses`, and `generateReports`. | Service resets its per-day slice on `startDay`, snapshots areas/stock at `beforeService`, resolves purchases/incidents/area/stock/staff changes at `service`/`afterService`, pressures and feedback update during `closing`, responses apply after closing, and issue seeds are generated through a `generateReports` hook for next-day UI cards. | Report timing mismatch: engine collects `buildReport` output before `generateReports` hooks, so issue-seed report output can lag the state mutation that happens later in the same phase (`P2-001`). | `src/sim/modules/service/serviceModule.ts`; `src/sim/modules/pressures/pressureModule.ts`; `src/sim/modules/feedback/feedbackLoopModule.ts`; `src/sim/modules/issues/issueSeedModule.ts`; `src/sim/modules/responses/responsesModule.ts`; `src/sim/core/engine.ts` | `P2-001` |
| Weekly systems | `weeklyModule` `endWeek` hook, gated by `isEndOfWeek()`, with reports and projections in `src/reports/weeklyOverviewProjection.ts`. | Weekly finalization runs only on day-of-week 7, stores `lastWeeklyResult`, appends bounded `weeklyHistory`, resets/finalizes weekly accumulators, and emits a one-shot weekly report only when `lastWeeklyResult.endDay` still matches the pre-advance calendar day. Reports → Weekly reads persistent state rather than only `SimResult.reports`. | No confirmed wiring defect in Phase 2. Later passes should inspect whether supplier invoice Option A and weekly aggregates are sufficiently player-visible, but the progression boundary itself is mapped. | `src/sim/modules/calendar/index.ts`; `src/sim/modules/weekly/weeklyModule.ts`; `src/reports/weeklyOverviewProjection.ts`; `web/src/lib/components/WeeklyOverview.svelte` | None from Phase 2 |
| Monthly systems | `monthlyModule` `startDay`, `endWeek`, and gated `endMonth`; Reports → Monthly projection. | Month state initializes or rolls on `startDay`, folds weekly results on `endWeek`, resolves rent/landlord/inspection/reputation/upgrades/rival on day 28, appends bounded `monthlyHistory`, preserves `lastMonthlyResult`, and emits a one-shot report before calendar advance. Monthly overview reconstructs days-since-close from result year/month/day. | Monthly modifier selection includes year/month coordinates, but it receives the browser's day-of-month seed as part of the base; fix `P2-002` before doing balance conclusions from browser long runs. Old-save migration risk is deferred to `P2-004`. | `src/sim/modules/monthly/monthlyModule.ts`; `src/reports/monthlyOverviewProjection.ts`; `src/sim/modules/calendar/index.ts`; `web/src/lib/components/MonthlyOverview.svelte` | `P2-002`, `P2-004` |
| Save / migration | Browser save/load in `web/src/lib/sim/persistence.ts`; additive migrations in `src/sim/state/migrations.ts`; schema/reference validation in `src/sim/state`. | Browser load parses one versioned envelope, applies `ensureWorldBranch`, area identity, staff identity, weekly history, and monthly history migrations, then runs `safeValidateState(..., { modules: FULL_PIPELINE })`. App persistence stores the current state, result-lite, route, day-session flags, picks, priorities, pending choices, and missed-opportunity dismissals. | Runtime browser validation uses the right module list, but migration coverage is manually curated and not version-stepped. Phase 2 did not exercise old/corrupt saves by request, so `P2-004` remains candidate for Phase 6. | `web/src/lib/sim/persistence.ts`; `web/src/App.svelte`; `src/sim/state/migrations.ts`; `src/sim/state/validation.ts`; `src/sim/state/schemas.ts` | `P2-003`, `P2-004` |
| RNG / determinism | `src/sim/core/rng.ts` streams; `createContext()` in `engine.ts`; web `runDay()` seed construction; expedition stored seeds. | Engine creates named deterministic streams from `input.seed`; `ctx.rng` maps to the `service` stream, identity/supplier/adventurer streams are isolated, and expeditions store their commission-time seed so resolution survives reload/replay. Dynamic expedition streams derive from stored expedition seed plus stream name. | The stream design is sound, but the web caller's per-day seed repeats by day-of-month (`P2-002`). Also, because the engine creates streams fresh for each `simulateDay`, callers are responsible for passing unique day seeds when they want non-repeating daily variance. | `src/sim/core/rng.ts`; `src/sim/core/engine.ts`; `src/sim/modules/expeditions/expeditionsModule.ts`; `src/sim/modules/expeditions/commissionExpedition.ts`; `web/src/lib/sim/gameStore.svelte.ts` | `P2-002` |

**Exit criteria**

- Each progression boundary has a verified reproduction or test path.
- Any silent state mutation without output is recorded.
- Any output that claims a state change without a real mutation is recorded.

### Phase 2 trace notes

- **Boundary model:** The engine loops through the canonical phase list, skips
  `endWeek` and `endMonth` unless the pre-advance calendar is on the boundary,
  validates before calendar advance, advances the calendar last, and finalizes a
  single full-day diff after the advance. This means report builders see the
  closing day's calendar, while `result.state.calendar` points at tomorrow.
- **Browser day runner:** `DayScreen` and the quick-day path both delegate to
  `gameStore.runDay()`, keeping one mutation point per playable day. The store
  persists enough UI/session state to reload mid-day, but once `runDay()` fires,
  queued picks and pending response choices are intentionally cleared for the
  new morning.
- **Report ordering defect:** `simulateDay()` calls `collectReports()` before
  `runHooks('generateReports')`. That ordering contradicts the module contract
  and the issue-seed module's own comment. State still receives the newly
  generated seeds because the hook runs later, but the same `SimResult.reports`
  array can contain a stale issue-seed report.
- **Diff/cause/report surface:** The full-day diff now walks core meters, world
  meters, recipes, expeditions, hireable adventurers, and shallow module slices.
  History arrays, causes arrays, attribution internals, calendar/meta changes,
  and deep module internals are intentionally not surfaced as field-level diffs.
  Phase 2 records the remaining risk as documentation/expectation drift rather
  than a confirmed runtime failure.
- **Validation source:** Engine validation and browser save hydration explicitly
  pass `FULL_PIPELINE`; bare `validateState(state)` still resolves the empty
  `moduleRegistry`. Later diagnostics should pass `FULL_PIPELINE` until the
  validation source-of-truth is cleaned up.
- **RNG source:** Named streams isolate random domains inside a day, and
  expeditions store their commission seed. The browser-level daily seed is the
  weak link because it uses day-of-month instead of an absolute coordinate.
- **No test rerun:** Per instruction, Phase 2 used source/documentation tracing
  only and did not rerun the passing test suite.

### Phase 2 exit summary

- **Confirmed findings:** stale issue-seed report ordering (`P2-001`), repeating
  browser day RNG seed (`P2-002`), bare validation missing module schemas
  (`P2-003`), and stale change-tracker comments (`P2-005`).
- **Candidate finding:** additive save migration coverage for old saves remains
  unproven until Phase 6 exercises fixtures (`P2-004`).
- **No issue-tracker promotion yet:** `P2-001` and `P2-002` are actionable, but
  this investigation plan defers promotion until enough cross-pass evidence can
  bundle fixes into repair phases with UI/action/save coverage.
- **Next deep traces:** Phase 3 should start with response/issue-seed/report
  timing because `P2-001` directly affects player-choice reporting. Phase 6
  should start with old-save fixture coverage because `P2-004` is still only a
  code-path risk.

---

## Phase 3 — Action, card, issue-seed, and player-choice wiring

**Goal:** Confirm that every player-facing choice is selectable only when valid,
resolves to the intended simulation effect, and is represented accurately in
cards, pending queues, reports, and missed opportunities.

**Primary questions**

- Do action definitions, generated intents, card buttons, and `canApply` checks
  agree?
- Can every issue-seed family generate, rank, display, resolve, expire, and
  explain its outcome?
- Are pending actions and queues cleared, saved, restored, and reported
  correctly?
- Are disabled states, costs, requirements, and consequences visible before the
  player commits?

**Suggested checks**

- Trace action registry definitions to UI pickers and application handlers.
- Fuzz or enumerate issue-seed generation across tags, families, and calendar
  states.
- Confirm card registry coverage for all real card types and action slots.
- Inspect mismatch risks between verbs, target IDs, fallback matching, disabled
  buttons, and generic actions.

**Artifacts to fill**

| Choice surface | Source definition | UI renderer | Apply path | Failure mode checked | Findings |
|---|---|---|---|---|---|
| Day cards | Issue seeds in `state.modules.issueSeeds.seedsToday`; card templates in `src/cards/templates`; response slots/profiles on each seed. | `CardDeck.svelte` filters valid seeds by timing, calls `renderCard()` / `pickCard()`, and renders `CardRenderer.svelte`. Generic Ignore is hidden when a modeled ignore choice exists. | `CardDeck` stores pending choices in `gameStore.pendingBySeedId`; `DayScreen.endDay()` converts pending choices with `buildIntent()` / `buildIgnoreIntent()` and sends `responseIntents` to `gameStore.runDay()`; `responsesModule` applies profiles during `applyResponses`. | Source-to-effect path exists. Known Phase 2 report-ordering issue can make same-day issue-seed report output stale. `CardChoice.disabledReason` is currently unused by card helpers, so future slot requirements would need another wiring pass. | `P2-001`, `P3-004`, `P3-005` |
| Action picker | Owner actions in `actionRegistry` and definitions under `src/sim/modules/ownerActions/*`; shared read-only validation in `readonlyHelpers.ts`. | `ActionPicker.svelte` tabs by category, uses `actionDisabledReason(def, state, pointsLeft)`, lists valid targets, queues picks into `gameStore.picks`, and lets chips remove queued actions. | `gameStore.runDay()` maps picks through `picksToInputs()` into `SimInput.ownerActions`; `ownerActionsModule` revalidates budget and `canApply` before calling each definition's `apply()`. | Central picker mirrors engine validation and remaining budget, but queued chips duplicate label/target text. It cannot configure option-heavy actions such as expedition commissioning; those need custom surfaces. | `P3-002` |
| Quick actions | Applicable action refs from `buildTavernOverview()` / `applicableActionsForTarget()` for concrete area, stock, recipe, staff, project, and policy rows. | Tavern detail sheets and `ProjectsPanel.svelte` render inline queue/remove buttons; `QuickActions.svelte` disables refs with projection-provided `disabledReason`. | Buttons call `gameStore.addPick()` directly; later `runDay()` submits them through the normal owner-action engine path. | Projection disabled reasons are computed with the full daily budget, not current queued points. These entry points can create an over-budget queue that only the sticky chip/engine rejection catches. | `P3-001` |
| Staff priorities | `staffPriorityRegistry`; role defaults and allowed priorities; `SimInput.staffPriorities`. | `StaffPrioritySheet.svelte` renders one radiogroup per staff member, filtered by role, and writes sticky selections to `gameStore.staffPriorities`; Day plan summary shows customized count. | `gameStore.runDay()` includes sticky priorities; `staffModule` validates ids/role compatibility during `assignStaffPriorities`, fills defaults, writes `currentPriority`, and reports rejected assignments. | Current UI only offers allowed registry values, so ordinary invalid choices are blocked. Stale saved priorities for fired/changed staff would be rejected by the module and surfaced in reports; Phase 6 can stress persistence edge cases. | None from Phase 3 |
| Expeditions | `commissionExpedition` owner-action definition; hireable adventurers and stock rarity catalog; expedition modules. | `CommissionExpeditionSheet.svelte` lets the player choose runner, open/targeted mode, tier/ingredient, and duration with a visible coin-cost preview. Tavern supply pipeline also computes a high-level `canCommission` flag. | Sheet queues a `commission_expedition` pick with runner `targetId` and structured `options`; owner-actions module validates runner, mode, days, target rarity, coin, and budget; expedition module later ticks/resolves active expeditions. | Sheet validates runner/coin/options but bypasses current queued action-point budget, same as quick actions. The generic ActionPicker disables this global action because it needs a target/options payload, so the custom sheet is the practical path. | `P3-001` |
| Missed opportunities | `projectMissedOpportunities()` combines pressure remedies, ignored seeds, and diff counterfactuals from sim output. | `DailyReport.svelte` renders `MissedOpportunities.svelte`; dismissals write to `gameStore.dismissedMissedOpportunityIds` and are persisted/pruned. | Pure projection only; dismissal affects UI filtering, not simulation. Suggestions point to owner-action ids/targets but do not queue actions directly. | Projection does not call owner-action `canApply`, so recommendations may not account for affordability, target validity, or action availability when the day closed. | `P3-003` |

**Exit criteria**

- Every player choice has a traced source-to-effect path.
- Every disabled / invalid choice has a clear UI reason or a finding.
- Queue persistence and restoration are verified or logged as defective.

### Phase 3 trace notes

- **Single submit point:** The web layer still has one simulation submit point:
  `gameStore.runDay()`. Day cards, owner-action picks, staff priorities, and
  response intents all converge there before the engine revalidates them.
- **Owner-action validation split:** The central picker is queue-aware and uses
  shared read-only `canApply` helpers. Tavern row quick actions and custom
  surfaces reuse the same action definitions but skip the queued-points part of
  that check, relying on the sticky chip and engine rejections as backstops.
- **Response-card routing:** Card choices preserve `responseSlotId` in intent
  metadata, and generic Ignore uses a distinct `shape: 'ignore'` path. The old
  verb-only ignore bug is guarded by code and tests, so Phase 3 records it as a
  fixed regression risk rather than an active defect.
- **Pending choice persistence:** `pendingBySeedId`, action picks, staff
  priorities, and day-session beat flags are included in the persisted session.
  `runDay()` intentionally clears per-day picks and pending card choices after
  submitting; sticky staff priorities persist.
- **Expedition commissioning:** Expedition choice is not expressible through the
  generic action picker because it needs structured options. The custom sheet is
  the real UI, but it should share the same queue-budget validation before
  adding a pick.
- **Missed-opportunity scope:** Missed opportunities are teaching projections,
  not selectable actions. They are useful, but Phase 3 found they are not
  validated against action preconditions, so their wording may overstate what
  the player could actually have done.
- **No test rerun:** Per instruction, Phase 3 used source/documentation tracing
  only and did not rerun the passing test suite.

### Phase 3 exit summary

- **Confirmed findings:** queue-budget bypass from non-picker action surfaces
  (`P3-001`), duplicated queued-chip labels (`P3-002`), and fixed ignore-routing
  regression guard (`P3-005`).
- **Candidate findings:** missed-opportunity validity (`P3-003`) and dormant
  card disabled-reason wiring (`P3-004`).
- **Repair priority:** Fix `P3-001` before adding more Tavern/World action
  shortcuts; it is the active mismatch between UI affordances and engine
  acceptance. `P3-002` is low-risk polish. `P3-003` needs design input on
  whether “could have done” should mean “was valid yesterday” or “is a general
  remedy.”
- **Next deep traces:** Phase 4 should start with content/action reachability
  for owner-action targets, expedition ingredients, and pressure-remedy target
  maps because Phase 3 found several choice surfaces depend on those reverse
  links being complete.

---

## Phase 4 — World, roster, economy, and content graph coverage

**Goal:** Verify that world entities, rosters, stock, recipes, suppliers,
factions, cultures, NPCs, regulars, rumours, expeditions, and economic systems
form a coherent graph with no orphaned or unusable content.

**Primary questions**

- Are all registry entries reachable from generation, state, UI, reports, or
  player actions?
- Do cross-references resolve in both directions where the design requires it?
- Do prices, wages, reliability, storage, quality, renown, reputation, and demand
  feed meaningful decisions?
- Are content pools deep enough to avoid repetitive or contradictory output?

**Suggested checks**

- Run reference validation and add temporary probes for orphaned IDs.
- Compare registry IDs with initial state, UI panels, detail sheets, and reports.
- Trace economy fields from source to consumption: cost, quality, stock,
  delivery, storage, wage, reward, renown, and relationship.
- Inspect descriptor pools, social memory, rumours, notable NPC links, and
  faction/culture relationships.

**Artifacts to fill**

| Content graph | Registry / state | Consumers | Reverse links | Economy impact | Findings |
|---|---|---|---|---|---|
| Staff | `staffRegistry`, `staffIdentityProfileRegistry`, `staffPriorityRegistry`, and `state.staff`; identity culture refs are validated. | Service quality, staff priority assignment, wages, burnout seeds, Tavern staff panel/detail sheet, reports, attribution, and memories. | Staff role and identity culture are checked by validation/module validators; priorities are role-filtered in UI and rejected by `staffModule` if stale. | Wages drain weekly coin; skill/current priority affects service quality and recipe preparation; stress/fatigue/morale loop into service and burnout. | No new Phase 4 defect. Persistence edge case for stale staff priorities remains Phase 6 territory. |
| Areas | `areaRegistry`, area traits/upgrades registries, and `state.areas`; area defs include storage/atmosphere/yield/spoilage modifiers. | Service mess/damage, area pressures, stock spoilage storage lookup, herb-garden weekly yield, Tavern areas panel, issue seed locations/effects. | Required area ids are validated, but area trait/upgrade ids and stock `storageAreaId` are not fully reference-validated. Phase 73 unpin work is partial. | Area condition/cleanliness affects service, spoilage, pressure, and repair/clean action value; herb garden produces ingredients; cold cellar slows rare spoilage. | `P4-001`, `P4-002`, `P4-004` |
| Stock / recipes | `stockRegistry`, `recipeRegistry`, `state.stock`, and `state.recipes`; recipe input refs are validated. | Service recipe sales, customer purchase preferences, owner restock/toggle actions, storage spoilage, culinary renown, Tavern stock/recipe panels, expeditions returned ingredients. | Recipe inputs validate against stock state/registry; stock storage area does not. Card/report labels fall back to registry/state labels. | Sale price earns coin; base price drives current restock cost; quality/spoilage affects service; rare recipe prep moves culinary renown. Supplier effective pricing is not in the restock path. | `P4-001`, `P4-003` |
| Suppliers | `supplierRegistry`, market-condition registry, `state.world.suppliers`, and `state.modules.suppliers`. | Supplier update drift, missed-delivery diagnostics, supplier reports, world supplier panel/detail sheet, supplier relationship seeds, social actions, pressure/feedback loops. | Goods/faction/culture/name refs are validated; world projection exposes goods and relationship/reliability. DeliveriesToday validates supplier/stock ids. | `priceBias`, relationship multiplier, market conditions, and missed-delivery probability exist, but primary restock still pays stock base price and does not choose a supplier. | `P4-003` |
| Factions / cultures | `cultureRegistry`, `factionRegistry`, customer group culture links, and world faction/culture state. | Culture update/familiarity/tension, customer influence, weekly community faction shifts, world panels, faction social actions, issue seeds, attribution and feedback loops. | Customer-group culture/naming refs, culture naming profiles, faction culture refs, and group relationship map keys are validated. Culture member counts are derived from regulars/suppliers/factions/NPCs. | Culture preferences influence service/customer behavior and seeds; faction relationship/trust/fear affects social actions, pressure, and weekly community outputs. | No new Phase 4 defect; continue Phase 4/7 reachability probes for culture/faction content depth. |
| NPCs / regulars | Starter notable NPC profiles/factory, regular state/factory/module, and `state.world.notableNpcs` / `regulars`. | World NPC/regular panels, regular customer module, regular/faction/social issue seeds, attribution/memory, service/weekly reports, social actions for regulars. | Regular group/culture/faction/favorite stock/name refs and NPC group/culture/faction/name refs are validated. `findNotableNpcForFaction()` gives faction seeds a notable NPC when present. | Regular loyalty/visits/irritation affect retention, feedback, and social choices; NPCs are currently more attribution/seed anchors than direct economy actors. | No new Phase 4 defect; NPC direct action coverage remains intentionally thinner than regular/supplier/faction actions. |
| Rumours / memory | Root `state.memories`, attribution module state, and `state.world.socialRumours`; memory and rumour producers in service, weekly, attribution, local arcs, responses. | World rumours panel, tavern identity nickname strip, attribution panels, issue seed generators, pressure/feedback loops, history/log projections. | Memory actor/location refs use `EntityRef` shape; social rumour `subject`/`involvedRefs` validate, but bare source/target ids do not. Rumours prune monthly by world module policy. | Memories and attribution influence seeds, pressures, feedback, and identity; rumours mostly affect perception/UI and some attribution spread. | `P4-005` |
| Expeditions / adventurers | Hireable adventurer factory/roster, `state.world.hireableAdventurers`, expedition action/options, and `state.expeditions`. | Commission expedition sheet, Tavern supply pipeline, expedition module daily resolution, returned ingredients, renown drift, adventurer economy/roster updates. | Active expedition runner refs, targeted ingredient refs, adventurer culture/name refs, and adventurer `currentExpeditionId` reverse edges are validated. Completed expedition runner refs project with fallback labels. | Adventurer `wageBase` sets commission cost; experience/reliability/specialty influence outcomes; returned rare ingredients feed recipes and renown. Queue-budget mismatch is already tracked in Phase 3. | `P3-001` (carried), no new Phase 4 expedition defect. |

**Exit criteria**

- Orphaned registry entries and dead fields are either disproven or listed.
- Economy inputs and outputs are traced across at least one full loop.
- Content repetition or contradiction risks have examples.

### Phase 4 trace notes

- **Reference-validation coverage:** Current validation covers many high-risk
  links: customer-group cultures/naming profiles, supplier goods/faction/culture
  links, regular/NPC identity links, staff identity culture, active expedition
  runner/ingredient links, adventurer reverse expedition edges, local-event refs,
  and social-rumour `EntityRef` fields. The remaining confirmed gaps are stock
  storage-area ids, area trait/upgrade ids, and rumour bare source/target ids.
- **Economy loop:** Customer service sells recipes/stock into coin and renown;
  weekly wages and monthly rent drain coin; expeditions convert wages into rare
  ingredients; rare dishes and spoilage feed culinary renown. Supplier pricing
  is the main broken loop: relationship/reliability pricing exists, but the
  restock action still uses stock base price directly.
- **Content reachability:** Staff, stock, recipes, suppliers, factions,
  cultures, regulars, NPCs, rumours, expeditions, and adventurers all have at
  least one state/UI/report consumer. Phase 4 did not find an entirely orphaned
  top-level roster, but it did find partial reachability: remaining `main_room`
  hard pins reduce the practical reach of newer areas.
- **Storage integration:** Storage is gameplay-bearing through spoilage
  modifiers and weekly area yield, not a capacity system. Any future capacity
  design should not assume a current cap exists; current storage balance is via
  spoilage and location traits.
- **No test rerun:** Per instruction, Phase 4 used source/documentation tracing
  only and did not rerun the passing test suite or reference-validation probes.

### Phase 4 exit summary

- **Confirmed findings:** missing storage-area validation (`P4-001`), missing
  area trait/upgrade validation (`P4-002`), supplier pricing not reaching
  restock gameplay (`P4-003`), remaining `main_room` hard pins (`P4-004`), and
  unvalidated bare rumour endpoints (`P4-005`).
- **Disproven as dead fields:** staff skill/priority/wage, recipe rarity and
  prep difficulty, supplier relationship/reliability, adventurer wage/specialty,
  culinary renown, and area storage modifiers all have at least one consumer.
  Some still need stronger player-facing loops, but they are not dead.
- **Repair priority:** Fix validation gaps (`P4-001`, `P4-002`, `P4-005`) before
  broad save/import stress testing, then decide whether supplier pricing should
  become gameplay-bearing (`P4-003`). Continue area unpinning (`P4-004`) as a
  content-diversity repair rather than a core-loop blocker.
- **Next deep traces:** Phase 5 should check whether the fallback labels and
  over-budget queue warnings identified in Phases 3–4 are understandable in the
  UI; Phase 6 should mutate saves around the validation gaps found here.

---

## Phase 5 — Web UI, accessibility, responsive layout, and interaction polish

**Goal:** Audit the Svelte UI for broken navigation, stale data, missing empty
states, inaccessible controls, mobile layout issues, and presentation bugs.

**Primary questions**

- Do all routes, tabs, sheets, panels, dialogs, and glossary affordances open,
  close, persist, and restore as expected?
- Does the UI accurately reflect current state after every mutation?
- Are controls keyboard-accessible, labelled, focus-safe, and usable with reduced
  motion and font scaling preferences?
- Are mobile, tablet, narrow, and desktop layouts free of clipping, overlap, and
  unreachable controls?

**Suggested checks**

- Manual pass through Start, Day, Reports, Tavern, World, More, sheets, and
  bottom navigation.
- Inspect Svelte event handlers, derived values, keyed loops, and stale closure
  risks.
- Run `npm run check`, `npm run build`, and browser smoke tests when possible.
- Capture screenshots for visible UI defects and note viewport dimensions.

**Artifacts**

| UI surface | Interaction path | Expected behavior | Actual behavior | Accessibility notes | Findings |
|---|---|---|---|---|---|
| Start | Boot through `App.svelte`, `StartScreen.svelte`, Continue/Start-over CTAs, advanced difficulty/seed controls. | Valid saves hydrate store but keep Start visible until Continue; invalid/incompatible saves show a banner; Start over clears save and enters Day with selected difficulty/seed. | Code path matches the stated Start gate. Continue restores `gameStore.route`, and fresh Start sets both App view and store route to `day`. | Main CTAs are native buttons; difficulty chips use `aria-pressed`; advanced section exposes `aria-expanded`. Invalid-save banner uses `role="status"`, but destructive Start-over remains a one-click reset from this screen. | No new Phase 5 defect. Destructive/import edge cases deferred to Phase 6. |
| Day | Morning digest, pressure ribbon, issue cards, plan beat, ActionPicker, StaffPrioritySheet, service/closing decks, confirm-End-Day, report beat. | Beat/session state persists through `gameStore`; card intents/picks/staff priorities survive refresh before day end; yesterday digest should tap through to Reports; End Day should submit one `runDay()`. | Beat/session state is store-backed, but the yesterday digest calls `gameStore.setRoute('reports')` while App still renders local `view`, so the tap-through does not visibly navigate in the current session. | Most controls are native buttons and preference-controlled confirm-End-Day exists. Modal accessibility inherits `BottomSheet` Escape/focus gaps. | `P5-001`, `P5-002`; carries `P3-001` for over-budget actions queued from non-picker surfaces. |
| Reports | Top-level Reports route, Today/Pressures/Weekly/Monthly/Log subnav, pressure drilldown via `CauseDrilldown`, Monthly → Pressures callback. | Subnav should switch panels; Today has an empty state before first result; Monthly pressure links should switch to Pressures and open drilldown where applicable. | In-screen subview callbacks work locally. The selected Reports sub-tab is local `$state('today')`, so refresh/continue into Reports always returns to Today, not the last selected report. | Subnav uses buttons and `aria-current`, but not the full `tablist`/`tabpanel` pattern. Drilldown inherits `BottomSheet` Escape/focus gaps. | `P5-002`, `P5-003`; stale report ordering remains `P2-001`. |
| Tavern | Tavern route, Areas/Stock/Recipes/Staff/Projects subnav, row detail sheets, quick actions, projects/policies, expedition commissioning, action queue chip. | Subnav should switch panels; detail sheets should open/close; queued actions should be visible and editable; queue budget warnings should be understandable before End Day. | Panel switching and sticky queue chip are wired. Tavern subview is local `$state('areas')`, so reload/continue resets Projects/Stock/etc. Direct quick-action/project/policy/expedition entry points can still overfill the queue, although the chip turns over-budget and the central picker shows the budget. | Row/detail controls are mostly native buttons. Detail sheets inherit `BottomSheet` Escape/focus gaps; over-budget chip has a color state but no explicit text beyond the numeric budget. | `P5-002`, `P5-003`; carries `P3-001` for queue enforcement/affordance. |
| World | World route, identity strip, Regulars/Suppliers/Factions/Cultures/NPCs/Rumours subnav, detail sheets, shared ActionPicker queue. | Subnav should switch panels; empty counts should be visible; detail sheets should close; shared action queue should behave consistently with Tavern. | Panel switching is local and count chips are projected from `buildWorldOverview`. World subview is local `$state('regulars')`, so reload/continue resets the player away from Suppliers/Rumours/etc. | Horizontal subnav is scrollable on narrow screens and uses native buttons/`aria-current`, but not full tab semantics. Detail sheets inherit `BottomSheet` Escape/focus gaps. | `P5-002`, `P5-003`; carries `P4-005` for raw rumour endpoint fallback labels. |
| More | More route, Settings, Saves, Help, About vertical sections; preference controls; import/snapshot replacement callback. | Preference changes should persist immediately; save replacement/import should call `onreplaced` and return to the hydrated run; help/about remain readable. | Preference store writes synchronously and App mirrors font/motion preferences to `<html>`. Font scale is intentionally modest because most existing tokens are px; import/snapshot replacement reroutes through `gameStore.route`. | Toggles use `role="switch"`; segmented controls use `aria-pressed`; reduced motion is enforced through CSS. Font scaling may not meet player expectations for a large-text accessibility knob. | `P5-004`; import/export edge cases remain Phase 6. |
| Sheets / popovers | `BottomSheet` users: ActionPicker, Glossary, CauseDrilldown, staff priorities, tavern/world detail sheets, expedition sheet; plus first-encounter hint popover. | Backdrop click and Escape should close sheets; focus should enter the modal and return to the opener; modal content should remain scrollable on mobile. | Backdrop click closes. Escape only works if focus is on the backdrop, because the dialog's own `onkeydown` stops propagation before the backdrop handler sees focused-control key events. No open-time focus movement or focus restoration is implemented. | `role="dialog"` and `aria-modal="true"` are present on sheets, but the keyboard/focus contract is incomplete. First-encounter hint separately supports Escape dismissal and a dialog role. | `P5-002`. |
| Navigation shell | `AppShell`, `TopBar`, `BottomNav`, Glossary help button, autosave route persistence. | Bottom nav should update App view and persisted route; top-bar help should open Glossary; content should not sit under the nav on narrow/mobile layouts. | Bottom nav uses App's `navigate()` and is the reliable route path. Store-only route changes after mount (e.g. Day's digest tap-through) do not drive App view. Major screens include bottom padding for nav/action chips; More uses a vertical stack with the sticky nav outside normal content. | Primary nav buttons have labels/icons and `aria-current`; TopBar help has an aria label. Glossary inherits `BottomSheet` focus/Escape gaps. | `P5-001`, `P5-002`. |

**Exit criteria**

- Every route and modal-like surface has been exercised.
- Any screenshot-worthy defect has a reproduction path and viewport note.
- Accessibility and preference regressions are either cleared or recorded.

### Phase 5 trace notes

- **No test/browser rerun:** Per the user's Phase 5 instruction, this pass used
  source/documentation tracing only and did not rerun the already-passing test
  suite, build, Svelte check, or browser smoke screenshots.
- **Navigation source of truth:** App rendering is controlled by local `view`,
  and bottom navigation calls App's `navigate()` helper. `gameStore.route` is
  persisted and used on Continue/import/snapshot replacement, but store-only
  route writes after mount are not observed by App rendering. The Day screen's
  Yesterday digest is the confirmed broken path because it only calls
  `gameStore.setRoute('reports')`.
- **Subview persistence:** Reports/Tavern/World each initialize a local subview
  (`today`, `areas`, `regulars`) and the persisted session only carries the
  top-level route. This is now confirmed behavior rather than speculation; the
  remaining decision is whether sub-tabs are intentionally ephemeral.
- **Sheet accessibility:** `BottomSheet` centralizes the app's modal-like
  surfaces, so its Escape/focus behavior affects ActionPicker, Glossary,
  CauseDrilldown, staff priorities, expedition commissioning, and tavern/world
  detail sheets. The code advertises Escape support, but focused controls inside
  the dialog stop keydown propagation before the backdrop handler can close it.
- **Action queue affordance:** Phase 5 confirms the UI does show a sticky
  over-budget chip and central picker budget text, but this does not cure the
  Phase 3 defect: non-picker surfaces can still add picks through direct
  `gameStore.addPick()` paths without queue-aware disabling.
- **Preference coverage:** Reduced-motion is wired through the preference store,
  App `<html>` attributes, and CSS overrides. Font scale is wired too, but its
  effect is intentionally limited by fixed-pixel type tokens, so this remains a
  candidate accessibility/expectation gap rather than a confirmed functional
  break.

### Phase 5 exit summary

- **Confirmed findings:** Day digest store-only navigation (`P5-001`), sheet
  Escape/focus accessibility gap (`P5-002`), and top-level-only route restoration
  for Reports/Tavern/World sub-tabs (`P5-003`).
- **Candidate finding:** font scale has narrow visual coverage despite a
  settings control (`P5-004`).
- **Carried findings checked in UI:** over-budget queue risk (`P3-001`) is
  visible after the fact through the sticky chip but still needs shared
  enforcement/disabled logic; raw fallback labels from Phase 4 should be
  reviewed after reference-validation fixes because the current UI can only
  display the projected fallback string.
- **No issue-tracker promotion yet:** These UI findings are actionable, but this
  plan continues to batch promotion until Phase 6 persistence/import/export
  stress work determines whether `P5-003` should become a save-envelope repair
  or an explicitly accepted ephemeral UI behavior.
- **Next deep traces:** Phase 6 should start with session envelope/import/export
  paths, because route/subroute persistence (`P5-003`) and save migration risks
  (`P1-002`, `P2-004`) now intersect.

---

## Phase 6 — Persistence, import/export, preferences, errors, and edge cases

**Goal:** Stress the non-happy paths that often expose bugs: corrupted saves,
old saves, import/export, local storage pressure, browser lifecycle events,
preference toggles, invalid inputs, and error banners.

**Primary questions**

- Are all persisted objects versioned, validated, sanitized, and backwards
  compatible where intended?
- Do corrupted or incompatible saves fail safely without losing recoverable data?
- Do settings immediately affect UI and survive reloads?
- Are error states actionable rather than silent or permanently sticky?

**Suggested checks**

- Exercise save slots, autosave, import/export, delete, replace, and snapshot
  budget limits.
- Mutate local storage manually to simulate invalid versions, missing fields,
  unknown routes, and oversized payloads.
- Verify lifecycle saves on visibility/pagehide and reload continuation.
- Toggle preferences through all combinations of difficulty, font scale, reduced
  motion, confirmation prompts, and seed-tag display.

**Artifacts**

| Edge area | Scenario | Expected result | Actual result | Data loss risk | Findings |
|---|---|---|---|---|---|
| Autosave | App boot/load, reactive autosave, and lifecycle flush through `App.svelte` and `saveSession()`. | Save writes should be versioned, atomic enough for the current session, and expose write/quota failures so the UI does not claim a save that failed. | Session envelopes are versioned and serialized from `gameStore.serializeForSave()`. However, `saveSession()` swallows storage failures and returns `void`; App then updates `lastSavedAt` unconditionally after both debounced and lifecycle saves. | High: a full-storage/private-mode write failure can leave the player believing progress was saved when the storage slot is stale or absent. | `P6-001`. |
| Continue / reset | Start boot calls `loadSession()`; invalid/incompatible outcomes stay on Start; Start over calls `clearSession()` and `gameStore.reset()`. | Valid saves should hydrate; malformed/newer saves should fail safely with a banner and no partial state; reset should clear the autosave slot and start a fresh Day run. | Load parses JSON, enforces `saveVersion`, runs the migration/validation path, then hydrates only on `loaded`. Invalid and incompatible saves remain recoverable only by starting over; there is no export/recovery affordance from the Start error banner. | Medium: invalid saves are not auto-deleted, which preserves data, but the in-app recovery path is limited to Start over. | `P6-002` for old-save migration failures; otherwise no new reset defect. |
| Save slots | Named snapshots use an index plus payload keys; create/load/rename/delete in More → Saves. | Snapshot create should refuse budget/limit overflow, load should validate through the same path as autosave, and destructive actions should require confirmation or recovery. | Create has max-count and 4 MB budget guards; load validates through `validatePersistedSession()` and has a replace confirmation. Delete is immediate from each row, while index corruption falls back to an empty visible list without scanning/recovering orphan payloads. | Medium for deletion mistaps; low for orphan payloads causing hidden storage pressure. | `P6-004`, `P6-005`. |
| Import / export | Export current save to JSON; import selected JSON through preview and replace confirmation. | Exported files should be self-identifying; imports should parse, migrate, validate, preview the target run, and replace only after explicit confirmation. | Export serializes the current session and names it by in-game day/date. Import parses through the same `validatePersistedSession()` path, previews tavern/day/seed, and reparses on confirm before hydration. Old-save compatibility is only as good as the shared migration chain. | Medium: importing a pre-required-slice save can fail instead of migrate; malformed queued picks can pass if they sit in the `picks` array. | `P6-002`, `P6-003`. |
| Preferences | Preferences hydrate before save load; settings mutate font scale, reduced motion, seed tags, confirm-End-Day, first-encounter hints, and last difficulty. | Preference storage should be independent from save corruption, invalid values should sanitize to defaults, and visual preferences should apply immediately. | Preferences have their own versioned storage key, sanitize enum/boolean/list fields, and App mirrors font/motion values onto `<html>`. Write failures are intentionally silent; font scale's limited visual reach remains from Phase 5. | Low: losing preferences does not corrupt the run. Silent preference write failures are accepted polish unless user feedback requests a settings-save banner. | Carries `P5-004`; no new Phase 6 preference defect. |
| Invalid data | Corrupt JSON, missing `saveVersion`, unsupported version, missing state, bad route/beat/pending fields, bad module/reference state. | Hard invalid roots should fail safely; recoverable UI fields should sanitize; state should reject schema/reference errors before hydration. | Root/version/state errors fail safely. Route defaults to `day`, day-session defaults to morning, pending choices are structurally sanitized, and state uses `safeValidateState(..., { modules: FULL_PIPELINE })`. `picks` and some result/calendar sidecars are cast rather than deeply validated. | Medium: malformed picks can survive import/load and later reach UI/engine entry points. | `P6-003`; validation source cleanup remains `P2-003`. |
| Browser lifecycle | `visibilitychange` hidden and `pagehide` call `flushSaveNow()`; reactive effect debounces normal updates. | Hiding/closing the tab should flush current state and cancel pending timers; the UI should know whether the flush succeeded. | Lifecycle handlers cancel pending debounce and call `saveSession()` immediately, but inherit its no-result behavior. Unmount cleanup removes handlers and clears timers. | High when storage write fails at close/background time because there may be no later chance to recover. | `P6-001`. |

**Exit criteria**

- At least one valid and one invalid persistence path is verified for each save
  surface.
- Data-loss and soft-lock risks are explicitly ranked.
- Error copy and recovery actions are reviewed.

### Phase 6 trace notes

- **No test/browser rerun:** Per the user's instruction, Phase 6 used source and
  documentation tracing only. It did not rerun the already-passing test suite,
  Svelte checks, builds, or browser/localStorage mutation scripts.
- **Shared validation path:** Autosave load, snapshot load, and JSON import all
  call `validatePersistedSession()`, which checks the envelope version, runs the
  current hand-written migration helpers, and validates state with
  `FULL_PIPELINE`. That common path is good, but it also means migration gaps and
  sanitation gaps are shared across every persistence surface.
- **Migration gap:** Current migrations cover world branch, area identity fields,
  staff identity/name promotion, weekly history, and monthly history. They do
  not synthesize top-level slices such as `recipes` or `expeditions`, nor do
  they create all newer module-state slots. Because the schema now requires
  these fields, older saves fail validation instead of upgrading.
- **Write-error visibility:** Snapshot creation returns explicit failures for
  budget, limit, and storage write errors. Autosave does not: `saveSession()`
  only logs once and App updates the saved timestamp regardless of success. This
  creates the clearest Phase 6 data-loss risk, especially on `pagehide`.
- **Destructive action consistency:** Import and snapshot load both have an
  in-place replacement confirmation. Snapshot delete does not, even though it
  removes the only UI pointer to that named save slot.
- **Preference isolation:** Preferences are appropriately separated from run
  state. Bad preference JSON/version/value falls back to defaults, so preference
  corruption should not block Continue. The main remaining preference issue is
  the Phase 5 font-scale coverage/copy mismatch.
- **Session sidecars:** The validator sanitizes route, beat, pending choices,
  dismissed missed-opportunity ids, and staff-priority values. It does not deeply
  validate queued owner-action picks, `previousCalendar`, or `latestResultLite`;
  picks are the riskiest because they can become future engine input.

### Phase 6 exit summary

- **Confirmed findings:** autosave false-success on storage failure (`P6-001`),
  old-save migration gaps for required newer slices (`P6-002`), unsanitized
  queued picks in save/import payloads (`P6-003`), and immediate snapshot delete
  without confirmation (`P6-004`).
- **Candidate finding:** orphan snapshot payloads after index corruption or index
  write failures can hide data while still consuming browser storage (`P6-005`).
- **Carried findings resolved or clarified:** `P1-002`/`P2-004` are now upgraded
  from broad migration risk to the concrete `P6-002` gap; `P5-003` remains a
  product decision because top-level route persistence is intentionally in the
  session envelope while subroutes are not.
- **Data-loss priority:** Fix `P6-001` first because it can mislead players about
  whether any recent progress was saved. Then fix `P6-002` before broadening
  import/save compatibility promises, and add delete confirmation (`P6-004`) as
  a low-complexity safety improvement.
- **No issue-tracker promotion yet:** Phase 7 should promote confirmed findings
  into `docs/ISSUE_TRACKER.md` or a repair roadmap after grouping them with the
  earlier queue, validation, navigation, and accessibility findings.
- **Next deep traces:** Phase 7 should consolidate repair phases around shared
  root causes: persistence contract/migrations, action-input validation, route
  state ownership, reference validation, and modal accessibility.

---

## Phase 7 — Regression harness, prioritization, and repair roadmap

**Goal:** Consolidate findings into a repair roadmap with reproducible tests,
prioritized phases, and guardrails that prevent the same class of unwired system
from returning.

**Primary questions**

- Which findings should become issue-tracker entries, phase plans, tests, or
  immediate fixes?
- Which classes of defect need automated coverage: registry reachability,
  UI action validity, save compatibility, state-diff completeness, or route
  smoke tests?
- What order minimizes risk and unblocks the largest number of systems?
- Which lower-severity findings are polish backlog rather than repair blockers?

**Suggested checks**

- Group all findings by root cause, not just by visible symptom.
- Add or propose diagnostics for future dead-field / orphan-registry detection.
- Compare every proposed repair against tests that would have caught it.
- Draft phase boundaries with verification criteria before implementation work
  begins.

**Artifacts**

| Roadmap item | Source findings | Proposed phase / issue | Test guardrail | Priority | Notes |
|---|---|---|---|---|---|
| Persistence contract, migrations, and save-slot safety | `P1-002`, `P2-004`, `P5-003`, `P6-001`–`P6-005` | `ISSUE-049` | Storage adapter tests for write failure/no false `lastSavedAt`, old-save fixtures missing late slices, import/snapshot validation, saved-pick sanitation, snapshot delete/recovery. | 1 — highest data-loss risk | Fix before claiming broad save/import compatibility. Subroute persistence decision can land here if product chooses to persist sub-tabs. |
| Cross-surface owner-action queue validity | `P3-001`, `P6-003` | `ISSUE-050` | Store/helper tests that all action entry points use the same budget/`canApply` gate; hydrated malformed picks are dropped or reported. | 2 — prevents silent skipped actions | Should reuse any sanitizers from `ISSUE-049` but can be repaired independently if persisted picks are temporarily dropped. |
| Day result/report timing and browser RNG seed correctness | `P2-001`, `P2-002`, `P2-005` | `ISSUE-051` | Engine ordering test for `generateReports` vs `collectReports`; browser-store seed test across month boundaries; expedition stored-seed regression. | 3 — report trust and deterministic variance | Runtime change is small but affects baselines; repair before doing long-run balance reads from browser play. |
| Validation source-of-truth and reference coverage | `P1-001`, `P2-003`, `P4-001`, `P4-002`, `P4-005` | `ISSUE-052` | Canonical validation helper test plus dangling stock-area, area trait/upgrade, and rumour endpoint fixtures. | 4 — import/diagnostic correctness | Also supports `ISSUE-049` old-save fixture confidence. |
| Web navigation, modal accessibility, and UI state persistence | `P1-005`, `P3-002`, `P5-001`–`P5-004` | `ISSUE-053` | Component/browser smoke tests for Day digest navigation, BottomSheet Escape/focus/restore, route/subroute reload, queued-chip copy, and font-scale expectations. | 5 — UX trust/accessibility | If subroutes are persisted, coordinate session-envelope changes with `ISSUE-049`; otherwise explicitly mark sub-tabs ephemeral. |
| Supplier pricing reaches restock gameplay | `P4-003` | `ISSUE-054` | Simulation test showing relationship/reliability/market condition changes restock coin/stock/report outcomes, or a documented report-only decision. | 6 — economy depth | Design decision first; do not add pricing complexity if supplier pricing is intentionally flavor. |
| Area content unpinning and customer-area rotation | `P4-004` | `ISSUE-055` | Seed-generation tests proving customer-facing/kitchen/repairable area pickers can target non-`main_room` areas. | 7 — content diversity | Best after `ISSUE-052` adds stronger area reference validation. |
| Advisory UI validity and future card-choice guardrails | `P3-003`, `P3-004` | `ISSUE-056` | Missed-opportunity projection tests for unaffordable/targetless remedies; renderer/helper fixture for disabled choice metadata. | 8 — polish/future-proofing | Lower risk today because card choices do not yet have real disabled producers. |
| Documentation/source-of-truth cleanup | `P1-003`, `P1-004`, `P2-005` | Fold into `ISSUE-051`/`ISSUE-052` or defer as docs cleanup | Docs lint/review checklist that old phase plans are historical and active registries/helpers are named explicitly. | Deferred | Not player-facing unless stale docs cause future repair mistakes. |

**Final investigation summary**

- **Critical findings:** None confirmed. No current finding proves an immediate
  universal play blocker or guaranteed save corruption on every run.
- **High findings:** `P5-002`, `P6-001`, and `P6-002` are the highest-severity
  repair targets: modal keyboard/focus behavior affects accessibility, autosave
  can claim success after failed writes, and old-save compatibility is not backed
  by complete migrations.
- **Medium findings:** `P1-002`, `P1-005`, `P2-001`, `P2-002`, `P2-004`,
  `P3-001`, `P3-003`, `P4-001`, `P4-002`, `P4-003`, `P5-001`, `P6-003`, and
  `P6-004` affect player trust, state/report correctness, import safety, or
  important gameplay loops but have local workarounds or bounded blast radius.
- **Low findings:** `P1-001`, `P1-003`, `P1-004`, `P2-003`, `P2-005`,
  `P3-002`, `P3-004`, `P3-005`, `P4-004`, `P4-005`, `P5-003`, `P5-004`, and
  `P6-005` are polish, diagnostics, future-proofing, or content-diversity work
  unless combined with a larger repair.
- **Deferred / accepted risks:** Historical phase-plan drift is accepted as long
  as current code/overview docs are treated as source of truth. Reports/Tavern/
  World sub-tabs may remain ephemeral if product explicitly accepts that reloads
  restore only the top-level route. Font-scale coverage can remain modest if the
  Settings copy is adjusted to match reality.
- **New tests recommended:** persistence fixture suite; storage failure adapter
  tests; owner-action queue helper tests; browser-store day-seed tests; report
  hook-order tests; reference-validation fixtures; BottomSheet/navigation smoke
  tests; missed-opportunity validity projection tests.
- **New diagnostics recommended:** canonical validation helper using the active
  pipeline; registry/reference reachability diagnostic for stock areas, area
  traits/upgrades, and rumour endpoints; action-surface audit that finds direct
  `gameStore.addPick()` callers; save-envelope migration coverage report; docs
  checklist for stale phase-plan language.
- **Repair phase order:** `ISSUE-049` → `ISSUE-050` → `ISSUE-051` → `ISSUE-052`
  → `ISSUE-053` → `ISSUE-054` → `ISSUE-055` → `ISSUE-056`, with docs cleanup
  folded into the relevant runtime phases or deferred.

### Phase 7 trace notes

- **No test/browser rerun:** Per the user's instruction, Phase 7 consolidated the
  roadmap from the prior documentation passes only. It did not rerun the
  already-passing test suite, builds, Svelte checks, browser smoke tests, or
  diagnostics.
- **Promotion policy:** Confirmed findings were grouped into `ISSUE-049` through
  `ISSUE-056` in `docs/ISSUE_TRACKER.md`. Candidate/low-risk items were either
  attached to those issues as scope notes or explicitly deferred in this plan.
- **Root-cause grouping:** The repair order prioritizes data-loss risk first,
  then silent player-action failure, report/determinism trust, validation/import
  safety, and finally UX/content/advisory polish.
- **Regression harness shape:** The recommended guardrails are intentionally
  targeted rather than broad suite reruns: storage adapters for persistence,
  pure helper tests for queue/validation logic, and small browser/component
  smoke tests for navigation and modal focus.

### Phase 7 exit summary

- **Tracked findings:** Actionable confirmed findings are now mapped to
  `ISSUE-049` through `ISSUE-056` in `docs/ISSUE_TRACKER.md`.
- **Deferred findings:** Historical docs drift, placeholder/extension registries,
  modest font-scale coverage, and ephemeral sub-tabs remain accepted or
  product-decision items unless a repair phase chooses to change them.
- **Ready for repair planning:** The next step is to write phase plans for the
  first repair bundle (`ISSUE-049`) with fixtures for write failures, old saves,
  imports, snapshots, and malformed saved picks.

**Exit criteria**

- Every confirmed finding is either tracked, fixed, or consciously deferred.
- Repair phases have clear scope and verification notes.
- The project has a repeatable regression strategy for unwired-system detection.
