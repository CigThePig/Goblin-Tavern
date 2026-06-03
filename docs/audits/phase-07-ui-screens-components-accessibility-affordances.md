# Phase 7 — UI Screens, Components, Accessibility, and Player Affordances

## Scope and status

Phase 7 audited the player-facing Svelte surfaces that expose game state,
navigation, detail sheets, and owner actions:

- `web/src/App.svelte` and shell navigation (`AppShell`, `TopBar`, `BottomNav`).
- Screens under `web/src/lib/screens/`: Day, Reports, Tavern, World, More, and
  Start.
- Core interaction components: `ActionPicker`, `CardDeck`, `BottomSheet`,
  `EntityLink`, `MetricLink`, `CauseDrilldown`, `ActionQueueChip`, and detail
  sheets.
- Report/card/projection consumers rendered by the screens, including
  `DailyReport`, `WeeklyOverview`, `MonthlyOverview`, `TavernLog`, and dashboard
  drilldowns.
- Adjacent component and web tests under `tests/web/`.

Audit result: the primary day loop and most action affordances are wired through
store methods and guarded by existing tests. One confirmed navigation defect was
found in the EntityLink target-consumption path: most entity links route to the
right screen/subtab but do not auto-open the matching detail sheet. Two
low-severity follow-up candidates remain around the central picker guard seam and
the existing `BottomSheet` accessibility warning.

## UI path map

| Player path | UI entry | Store / engine boundary | Guard / fallback behavior | Evidence |
|---|---|---|---|---|
| Start or Continue | `StartScreen` → `App.svelte` handlers | `gameStore.reset(...)`, `gameStore.hydrateFromSave(...)`, `loadSession()` | Invalid saves stay on Start with a hydration banner; Start over clears the save before reset. | `App.svelte`, `StartScreen.svelte`, `persistence.ts`; covered by start-screen and persistence tests. |
| Primary navigation | `BottomNav` buttons | `App.svelte` `navigate(...)` → `gameStore.setRoute(...)` | Active route uses `aria-current="page"`; Day tab shows a work dot only when unresolved Day work exists off-tab. | `BottomNav.svelte`, `gameStore.hasUnresolvedDayWork`; covered by phase-196 day-nav tests. |
| Morning → plan | Day screen `Plan the day` / top-bar time chip / drilldown CTA | `gameStore.setBeat('plan')`, `gameStore.requestActionPicker(...)` | Request context can preselect a picker tab; plan beat is forced only while Segment A is open. | `DayScreen.svelte`, `TopBar.svelte`, `MetricLink`/drilldown CTAs, `gameStore.requestActionPicker`; covered by phase-192/195 tests. |
| Queue owner actions | `ActionPicker`, Tavern quick actions, recipe/project/policy/expedition controls | Usually `gameStore.tryAddPick(...)`; central `ActionPicker` currently writes with `setPicks(...)` after local disabled checks. | Store-level guard rejects unknown, over-budget, and invalid target picks. Some non-picker surfaces show inline queue errors. | `gameStore.tryAddPick`, `QuickActions.svelte`, `RecipesPanel.svelte`, `ProjectsPanel.svelte`, `CommissionExpeditionSheet.svelte`, `ActionPicker.svelte`; covered by queue-validity and component tests. |
| Run service | Day plan beat button | `gameStore.runService()` → Segment B | Engine throws are captured in `gameStore.runError`; UI stays on the plan beat and shows an alert. | `DayScreen.svelte`, `gameStore.runService`; covered by day-screen tests. |
| Resolve cards | `CardRenderer` / `CardDeck` / pending tag | `gameStore.resolveSeed(...)`, `gameStore.clearSeed(...)` | Pending decisions remain revisable until End Day; service/closing decks can mark beat completion but skipping remains possible. | `DayScreen.svelte`, `CardDeck.svelte`, `gameStore.resolveSeed`; covered by card-deck and phase-190b tests. |
| End day / report | Day closing beat button | `gameStore.endDay(...)` → Segment C | Optional confirm preference; engine/report projection errors surface as alert/fallback panels with a way forward. | `DayScreen.svelte`, `DailyReport.svelte`, `ReportsScreen.svelte`; covered by day-screen and reports tests. |
| Entity and metric exploration | `EntityLink`, `MetricLink`, dashboard rows | `gameStore.setRoute(...)`, `drilldownStore.show(...)` | Missing concrete entity ids degrade to plain text; metric links without required ids degrade to plain text. Targeted entity auto-open is incomplete; see `AUD-UI-007-001`. | `EntityLink.svelte`, `MetricLink.svelte`, `links/types.ts`, destination panels; covered only partially by phase-190a/190b/195 tests. |
| Saves, import/export, diagnostics | More screen sections | `saveSession`, `loadSession`, `importSave`, snapshots, debug bundle | Save failures stay visible with retry; import/snapshot paths validate before replacement. | `MoreScreen.svelte`, `SavesSection.svelte`, `DiagnosticsSection.svelte`; covered by phase-6 tests. |

## Accessibility and interaction notes

- Most actionable controls are native `<button>` elements with visible labels;
  tab/subnav state is exposed through `aria-current="page"` or tab attributes.
- Modal sheets have `role="dialog"`, `aria-modal="true"`, a close button,
  Escape handling at window level, focus-on-open, and focus restoration.
- Projection and engine failures generally use `role="alert"` so broken report
  or simulation paths are visible instead of failing silently.
- `svelte-check` still reports one a11y warning in `BottomSheet.svelte` because
  the inner dialog `<div>` has a click handler used only to stop backdrop-click
  propagation. This did not reproduce a broken keyboard path during source
  review, but it is still a cleanup candidate because the warning is emitted by
  the project's canonical Svelte check.

## Tests and checks run

| Command | Result | Notes |
|---|---|---|
| `rg -n "on:click|onclick|button|aria-|role=|BottomSheet|EntityLink|MetricLink|ActionPicker" web/src tests/web` | Pass | Used to inventory interactive controls, navigation links, ARIA affordances, and relevant tests. |
| `rg -n "role=\"button\"|role='button'|tabindex=\{0\}|onclick=\{\(e\) => e\.stopPropagation\(\)\}" web/src/lib` | Pass | Narrowed custom-control and dialog click-stop patterns. |
| `rg -n "tryAddPick|setPicks\(|addPick\(" web/src/lib tests/web` | Pass | Mapped action-queue entry points and guard seams. |
| `npm test -- tests/web tests/web/components` | Pass | 36 test files and 275 tests passed. Expected console warnings were emitted by legacy-save and storage-failure tests. |
| `npm run check` | Pass with warning | `svelte-check` found 0 errors and 1 existing warning in `BottomSheet.svelte` for a clickable non-interactive dialog element. |

## Findings ledger

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-UI-007-001 | confirmed | medium | Entity links / detail sheets | Entity links for most entity kinds route to the correct top-level screen and subview but do not auto-open the referenced entity's detail sheet, despite the shared routing contract documenting detail-surface targets. | `ENTITY_ROUTING` declares detail destinations for staff, area, stock, recipe, project, regular, supplier, faction, culture, npc, and rumour. `gameStore.setRoute()` stores only one transient target per top-level destination. Destination consumption is implemented for `StaffPanel` and `StockPanel`; `AreasPanel`, `RecipesPanel`, `ProjectsPanel`, and all World panels have selectable detail sheets but do not consume `gameStore.consumeTavernSubviewTarget()` / `consumeWorldSubviewTarget()`. Source tests verify StockPanel target consumption and some EntityLink rendering, but not every destination panel. | `tests/web/phase190a.interconnection.test.ts` covers route target stashing/consume-once at the store level. `tests/web/phase190b.consumerWiring.test.ts` covers Day glance links and StockPanel auto-open. `tests/web/phase195.reportsActions.test.ts` covers that report/missed-opportunity lines render EntityLinks, including area links, but not that the target sheet opens after navigation. | Add destination-consumption tests for every `ENTITY_ROUTING` kind with a detail sheet, then wire missing panel `$effect`s or introduce a shared consume-target helper so route targets are consumed consistently and missing/stale ids degrade silently. |
| AUD-UI-007-002 | candidate | low | Action picker / queue guards | The central `ActionPicker` locally checks disabled actions but bypasses the store's documented `tryAddPick(...)` funnel, creating a small stale-target or future-drift seam where picker behavior could diverge from other queue surfaces. | `gameStore.tryAddPick()` says every UI entry point should funnel through it. Quick actions, recipe toggles, projects, and expedition commissioning call `tryAddPick(...)`; `ActionPicker.svelte` builds `PickedAction`s and calls `gameStore.setPicks([...gameStore.picks, p])` directly after `actionDisabledReason(...)` / `listValidTargets(...)` checks. | Existing queue-validity tests exercise the pure guard and several non-picker surfaces. `tests/web/components/actionPicker.test.ts` covers happy-path picker behavior but not a mutated/stale target between opening the target list and choosing a target, nor parity with `tryAddPick` rejection text. | Prefer routing `ActionPicker` additions through `tryAddPick(...)` and rendering its rejection reason, or add parity tests proving its local checks stay equivalent to the store guard. |
| AUD-UI-007-003 | candidate | low | BottomSheet accessibility | The generic bottom sheet passes functional keyboard/focus review, but the canonical Svelte checker reports an a11y warning for the dialog element's click-only propagation stopper. | `BottomSheet.svelte` handles Escape at `window`, focuses the dialog on open, restores focus on close, and has a native close button. `npm run check` still warns at the inner `.sheet` element because it has `onclick={(e) => e.stopPropagation()}` on a non-interactive element. | Component tests cover `CauseDrilldown` and sheet-using surfaces, but there is no focused `BottomSheet` test for Escape, focus restore, or backdrop click after replacing the propagation pattern. | Replace the inner click-stop handler with a backdrop handler that checks `event.target === event.currentTarget`, or otherwise suppress the warning with a documented pattern, then add a small BottomSheet interaction test. |

## Follow-up test candidates

1. **EntityLink destination matrix**
   - Iterate each `ENTITY_ROUTING` kind with a live fixture row.
   - Route via `gameStore.setRoute(route, { kind, target: id })`.
   - Mount the destination panel and assert the matching dialog label opens once,
     the target is consumed, and a remount does not reopen it.

2. **Stale entity target fallback**
   - Route with a syntactically valid but missing target id.
   - Mount the destination panel.
   - Assert no dialog opens, no exception is thrown, and the target is consumed.

3. **ActionPicker / `tryAddPick` parity**
   - Force an action or target to become invalid after the target list has
     rendered.
   - Click the stale target and assert the picker shows the same rejection reason
     as `gameStore.tryAddPick(...)` rather than queueing an invalid pick.

4. **BottomSheet keyboard and backdrop regression test**
   - Open a sheet from a focused trigger.
   - Assert focus moves inside, Escape closes, focus returns to the trigger, and
     clicking inside the sheet does not close while clicking the backdrop does.

## Phase 7 exit criteria

- UI path map from primary player actions to store methods and engine inputs:
  complete.
- Accessibility and interaction findings classified by severity: complete.
- Confirmed and candidate UI integration gaps documented with concrete next tests:
  complete.
