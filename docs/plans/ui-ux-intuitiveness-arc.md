# UI/UX Intuitiveness Arc — Tier 5 continuation

**Status:** open. Phases 190–196 (190 split into 190a + 190b).

**Slots before:** Tier 4 Progressive Onboarding (planned, not yet started).

**Tracker entries:** ISSUE-157…163 (7 issues). ISSUE-157 (phase 190) is
split into **ISSUE-157a** (phase 190a — primitives + routing + drilldown
paths) and **ISSUE-157b** (phase 190b — consumer wiring); the two share the
one issue id so the arc keeps seven entries. 191–196 keep ISSUE-158…163.

**Builds on:** Tier 5 UI/UX clarity passes (ISSUE-078/079, phases 117–118) and
the More-tab chassis work (ISSUE-080, phase 98). Also lands on top of the
day-clock **time economy** (phase 186) and the card-layer **legibility arcs**
(Legible → Faithful → Complete Surface, Choice-Preview Legibility; ~phases
145–189), which it complements rather than overlaps — see "Revival note".

---

## Revival note (2026-06)

This arc was scoped and written long before the work that now precedes it, then
**orphaned**: its originally-reserved slots (phases 121–127, ISSUE-081…087) were
silently reused by unrelated card-layer and character-depth work, and the arc
was never entered into `docs/ISSUE_TRACKER.md`. It is revived here with fresh
numbering (phases 190–196, ISSUE-157…163) and three substantive updates from a
re-audit against the current repo:

1. **Time economy, not action points.** Phase 186 replaced the action-point
   budget with a **time/minutes** economy (`DAY_MINUTES`, `timeCost`,
   `formatDuration`). Every "AP" reference in the original draft is now framed
   as **time remaining / time cost**.
2. **Phase 191 (pressure stakes) reuses existing sim truth.** The sim already
   authors per-pressure `consequences: string[]` (surfaced in the daily report
   as "If ignored: …") and exposes `severity`/`urgency` bands. There is **no
   hard `70` threshold** in the registry. So this phase **surfaces the existing
   consequence lines and severity band** on the standing pressure surfaces —
   it does **not** author a parallel `stakeLines.ts` content file or invent a
   threshold number.
3. **Phase 193 (suggested actions) also surfaces owner-action effect previews.**
   Owner-action definitions already carry an `effectsPreview` the picker never
   renders, while *card choices* (post-legibility arcs) have rich previews. The
   asymmetry is the bigger clarity gap, so this phase shows action effects in
   the picker **and** adds the pressure-affinity suggestion engine.

**Why this is not redundant with the card-layer arcs:** those arcs made
*card choices* legible (what a choice does, after you decide to engage a card).
This arc makes the *standing UI* legible and navigable (what matters right now,
where to tap, what a rising pressure threatens). Orthogonal; mutually
reinforcing.

---

## Vision

The current UI lays the simulation flat. Every screen carries equal weight; every noun is rendered as static text; every number floats without consequence. The player has to construct their own hierarchy of "what to look at first" and their own translation table from "what I want" to "where to tap." That is the source of the unintuitive feel.

Two principles drive this arc:

**The UI should be a graph, not a tree.** Every visible noun or number is a node. Tapping a node should land on the most relevant detail surface for it — and tapping detail back should land you in context. Right now the only path is `tab → sub-tab → list → row → sheet`; this arc adds direct edges everywhere.

**The UI should have an opinion about what matters right now.** When pressures are rising, the planning surface should know. When yesterday's report named a staff member's mistake, that name should be a link to staff. When the topbar shows "Day 3," it should also show the one thing the player is most likely to act on.

The sim is genuinely deep. The arc does not simplify it. It exposes the depth through directed surfaces instead of flat ones.

---

## Sequencing rationale

**Phase 190 (interconnection primitives) lands first** because every later phase consumes them. `EntityLink` and `MetricLink` become the carriers for everything else — stakes lines, suggested actions, drilldown CTAs all hang off them. Building those first means later phases are wiring, not invention. Phase 190 itself is split: **190a** builds the primitives, the routing-target mechanism, and the drilldown-path extensions (pure infrastructure, independently testable); **190b** wires the first round of high-traffic consumers onto them. 190a must land before 190b, and both before 191+.

**Phase 191 (pressure stakes) lands second** because it is the highest-leverage comprehensibility change available. Players don't fear numbers; they fear consequences. A "Food Safety 67 ↑" tells you nothing without the sim's own "if ignored" line beside it.

**Phase 192 (TopBar reframe) is small but visually defining** — the topbar is the one element the player sees on every screen.

**Phase 193 (action previews + suggestions) closes the "what do I do" loop.** With pressures now carrying their consequence lines (phase 191) and entities now linked (phase 190), the picker can show what each action *does* and surface "this action defuses this pressure" reliably.

**Phase 194 (typography pass) is intentionally late:** doing it earlier would force re-touching every component when the linking work lands. Easier to split the `.tag` class once, after every consumer has settled.

**Phase 195 (Reports → Action) and Phase 196 (Day dominance + cleanups) are polish.**

This sequence is the recommended execution order. Dependencies between phases are noted per-issue; pieces can be reordered within those constraints if needed.

---

## Cross-cutting constraints

**Time economy, not action points (phase 186).** The day budget is **time in minutes** (`DAY_MINUTES`), spent via per-action `timeCost`, formatted with `formatDuration`. There is no "AP X/3". Wherever this arc surfaces budget or sorts by cost, it uses time.

**Tier 4 awareness.** Tier 4 Progressive Onboarding (planned, not started) will gate features behind in-game time. `EntityLink` / `MetricLink` built here must fail gracefully on entities that do not yet exist — render as plain text (no link affordance) rather than throwing. This is the only Tier-4 coupling required; the arc does not implement unlock logic.

**Atmosphere lives in copy, not chrome.** The dark/parchment aesthetic, voice lines, and report prose stay untouched. Scan-speed improvements (phase 194) remove decorative type from *functional* chrome only.

**No simulation changes beyond minimal additive extensions.** Most phases are web-layer only.
- Phase 191 adds **no new content** — it adds a read-only projection over the *existing* per-pressure `consequences` and severity band. No `stakeLines.ts`, no threshold field.
- Phase 193 adds an additive `pressureAffinity?: PressureId[]` field to `OwnerActionDefinition`, and surfaces the *existing* `effectsPreview` in the picker.

Both follow the project's "additive integration during arcs" rule from `CLAUDE.md`.

**No new dependencies.** Stay on Svelte 5 + existing CSS tokens. New primitives are pure components.

**Tests live under `tests/web/` (web-layer) and `tests/sim/` (sim projection extensions).** Match the existing pattern from phases 119–120.

**The simulation is the source of truth.** Nothing in this arc invents state. Entity references, consequence lines, and severity bands all read existing or trivially-projected state. Cards/UI must not contradict known state.

---

## Phase 190a / ISSUE-157a — Interconnection primitives + routing + drilldown paths

**Goal:** Build `EntityLink` and `MetricLink` so any reference to an entity or number in the UI *can* be tapped to land on its detail surface — plus the routing-target mechanism and drilldown-path extensions they need. This phase ships the infrastructure and its tests; the high-traffic consumer call sites are wired in phase 190b. Building the carriers first means 190b (and 191+) are wiring, not invention.

### Scope (190a)

**New components** under `web/src/lib/components/links/`:

- `EntityLink.svelte` — wraps a reference to an entity. Props: `{ kind: EntityKind, id: string, label: string, variant?: 'inline' | 'chip' }`. On click: routes to the entity's sub-view via `gameStore.setRoute` + a new `target` parameter, opens the relevant detail sheet on mount.
- `MetricLink.svelte` — wraps a metric value. Props: `{ kind: MetricKind, id?: string, children: Snippet }`. On click: opens `CauseDrilldown` with the appropriate path, via a tiny global `drilldownStore` (mirrors `glossaryStore`) so a `MetricLink` anywhere in the tree can open a drilldown without prop-drilling. A single app-root `CauseDrilldown` binds against the store (mounted in `App.svelte` alongside `Glossary`). Screens that already own a local `CauseDrilldown` (DailyReport, ReportsScreen) keep theirs.

**Entity kinds** (union type locked in a new `web/src/lib/components/links/types.ts`). Every kind below has a confirmed detail sheet under `web/src/lib/components/tavern/` or `world/`:

```
type EntityKind =
  | 'staff' | 'area' | 'stock' | 'recipe' | 'project'
  | 'regular' | 'supplier' | 'faction' | 'culture' | 'npc' | 'rumour'
```

**Metric kinds:**

```
type MetricKind = 'coin' | 'pressure' | 'reputation' | 'inventory'
```

**Routing extension** (`web/src/lib/sim/gameStore.svelte.ts` + `persistence.ts`):

- The store currently exposes `setRoute(r: Route)` plus separate `setTavernSubview` / `setWorldSubview` / `setReportsSubview` setters, and persists `tavernSubview` / `worldSubview` / `reportsSubview`. This phase adds the *target* hop on top of that model.
- Add transient (non-persisted, session-only) fields `tavernSubviewTarget?: string` and `worldSubviewTarget?: string` to the store. These do not enter the save envelope — keeps the save schema stable.
- Extend `setRoute(route, opts?)` to accept `{ target?: string, kind?: EntityKind }`. When given, it sets the relevant target and updates the corresponding sub-view to the kind's home tab (e.g. `kind: 'staff'` → `tavernSubview = 'staff'`, `tavernSubviewTarget = id`). Existing single-arg callers keep working.
- Tavern/World sub-panels (`StaffPanel`, `RegularsPanel`, `StockPanel`, etc.) read `*SubviewTarget` on mount via `$effect` and call into their existing detail-sheet open path. The target is consumed once (cleared on read) so re-entering the panel later doesn't re-open the sheet.

**Drilldown path extensions** (`web/src/lib/components/CauseDrilldown.svelte`):

The existing path scheme handles `pressures.<id>` and diff paths like `reputation.<axis>` via `causesForPath`. Extend to handle:

- `coin` — opens a coin-flow drilldown showing today's income / expenses if `latestResult` exists; falls back to current balance only if no day has run yet.
- `reputation.<axis>` — opens a per-axis drilldown built from `state.reputation.<axis>` history.
- `inventory.<itemId>` — alias that routes through to the existing `StockDetailSheet`.

The first two require small projection helpers in `src/reports/` mirroring the existing pressure-cause pattern. `inventory` reuses existing wiring.

### Visual treatment (190a)

- Default state: indistinguishable from surrounding text (no static underline, no color shift).
- Hover / focus: `border-bottom: 1px dotted color-mix(in srgb, var(--accent) 35%, transparent)`. Subtle.
- Touch devices: no hover state; affordance is taught by behaviour, not chrome.
- Must NOT use the same hover treatment as `TermLabel`. Players need to distinguish "what does this mean?" (definition) from "take me there" (navigation). `TermLabel` currently uses a static dotted underline at all times; `EntityLink` uses a hover-only border-bottom in a slightly different color/opacity. Document both treatments side-by-side as comments in `web/src/lib/design/global.css`.

### Acceptance criteria (190a)

1. `EntityLink` and `MetricLink` render in isolation without throwing and without adding resting chrome (no underline until hover/focus).
2. `gameStore.setRoute(route, { target, kind })` routes to the kind's home sub-view and stashes the target; existing single-arg callers (`setRoute('day')`) are unchanged and leave targets untouched.
3. `EntityLink` with an `id` that does not resolve (a staff member who left between reports, or a tier-4-gated entity that does not yet exist) renders as plain text — no click, no error, no console warn. An empty id stays a valid navigation link (home tab, no auto-open).
4. The `*SubviewTarget` is consumed on first read and cleared (consume-once), so a later re-entry finds it gone.
5. `MetricLink` opens the global `CauseDrilldown` at the metric's path on tap; an id-bearing kind given no id renders plain (non-interactive) content.
6. Drilldown path resolution works for `coin`, `reputation.<axis>`, and `inventory.<itemId>` (the last aliasing to the `stock:<id>` cause target).
7. New Vitest coverage in `tests/web/phase190a.interconnection.test.ts` validates: routing target propagation, consume-once, fallback for missing entities, drilldown-path resolution, and MetricLink opening the drilldown.

### Do not do (190a + 190b)

- Do not add a generic "?" or info icon next to linked items. The whole word/value is the affordance.
- Do not auto-link arbitrary prose in voice lines, report copy, or empty-state strings. Linking is for *structured* entity references that come from the projection as `{id, label}` pairs. Free-form prose stays prose.
- Do not implement Tavern + World tab consolidation. Out of scope for this arc.
- Do not add a "back to where I came from" history stack. Tier 4 may want this; for now the bottom nav is the back affordance.
- Do not persist `*SubviewTarget` to the save envelope. It is a transient routing hint, not state.

### Depends on (190a)

None within this arc.

---

## Phase 190b / ISSUE-157b — Consumer wiring

**Goal:** Wire the first round of high-traffic consumers onto the 190a primitives. Pure consumer work — no new infrastructure; every call site below uses `EntityLink` / `MetricLink` / `gameStore.setRoute` and the destination panels consume the transient sub-view target on mount.

### Wiring (consumers covered in this phase)

1. **`DayScreen.svelte` morning at-a-glance row:**
   - `100` coin → `<MetricLink kind="coin">100</MetricLink>`
   - `3 staff` → `<EntityLink kind="staff" id="" label="3 staff">` (no specific id — lands on Tavern → Staff with no auto-open).
   - Each stock chip ("ale 80", "stew 40", "ingredients 60") → individual `<EntityLink kind="stock" id={itemId}>` opening `StockDetailSheet`.
   - "+17 more" → plain navigation link to `Tavern → Stock` (no specific target).

2. **`PressureRibbon.svelte`:**
   - Each row becomes a `<MetricLink kind="pressure" id={p.id}>`. Opens the same `CauseDrilldown` that `PressureCard` already uses. Removes asymmetry: ribbon rows and dashboard rows now feel the same.

3. **`DayScreen.svelte` plan rows:**
   - The whole plan row ("Owner actions / Pick", "Staff priorities / Set") becomes the tap target — not just the right-side button. The button stays for accessibility but the surrounding row is also clickable.
   - Entity references inside pick labels become `EntityLink`s. E.g. "Restock: ale" — "ale" wraps as `EntityLink kind="stock"`.

4. **`DayScreen.svelte` pending tags:**
   - "noted: tend" / "ignored" — wrap as buttons that re-open the original card choice. Lets the player revise a decision before End Day.

5. **`DailyReport.svelte` resolved-intent block:**
   - Subject names (`intent.subject`) become `EntityLink`s when the projection resolves them to a concrete entity. Falls back to plain text when subject is a generic noun.

6. **`MonthlyOverview.svelte` and `WeeklyOverview.svelte`:**
   - Top entity / pressure references become links. Cap this phase's audit to the top-level summary blocks; full coverage can come in phase 195.

**Panel-side target consumption:** the Tavern/World sub-panels (`StaffPanel`, `StockPanel`, `RegularsPanel`, …) read the relevant `gameStore.consume*SubviewTarget()` on mount via `$effect` and call into their existing detail-sheet open path. The target is consumed once so re-entering the panel later does not re-open the sheet.

### Acceptance criteria (190b)

1. `EntityLink` and `MetricLink` render in all consumer locations without changing visible layout.
2. Tapping "3 staff" on DayScreen morning lands on `Tavern → Staff` with the panel scrolled to top (no auto-open since no specific target id was given).
3. Tapping "ale 80" on DayScreen morning lands on `Tavern → Stock` with `StockDetailSheet` for ale already open.
4. Tapping a pressure row in `PressureRibbon` opens `CauseDrilldown` for that pressure — same behaviour as tapping a `PressureCard` in `PressuresDashboard`.
5. Tapping the "100" coin in DayScreen at-a-glance opens `CauseDrilldown` at `coin` path.
6. Tapping a pending "noted: <verb>" tag re-opens the original card choice for revision (the choice is uncommitted until End Day).
7. In `DailyReport`, a staff name in a resolved-intent block lands on staff detail on tap.
8. Re-entering the same sub-panel via the tab nav does not re-open the previously-targeted sheet (the 190a consume-once, observed end-to-end).
9. New Vitest coverage in `tests/web/phase190b.consumerWiring.test.ts` validates the consumer call sites and the panel-side target consumption.

### Do not do (190b)

See "Do not do (190a + 190b)" above.

### Depends on (190b)

Phase 190a (ISSUE-157a).

---

## Phase 191 / ISSUE-158 — Pressure stakes and danger zones

**Goal:** Make pressure values mean something on the surfaces the player looks at *during play* (ribbon, card, drilldown), not just in the post-day report. A bar at 67 ↑ should communicate (a) that it's entering a danger band and (b) what bad outcome the player is racing against — using the sim's *own* authored consequence text.

### Audit context (read first)

The sim already does most of the substance here:
- Every pressure calculator authors `consequences: string[]` on its `PressureSnapshot` (e.g. `debt.ts` → `['Debt collectors arrive']`). These are deterministic by id.
- `pressureReport.ts` already renders them in the daily report as an "If ignored:" block when severity is high enough.
- Pressures expose `severity` and `urgency` (0–100) bands. There is **no** hard `70` threshold field in the registry.

So this phase **surfaces existing truth on the standing UI** — it is a web-layer + thin-projection phase, not a content-authoring phase.

### Scope

**Danger-band visualisation** (`web/src/lib/components/PressureCard.svelte`, `PressureRibbon.svelte`):

- The ribbon/card already colour the bar fill via `pressureColor(value)` in `web/src/lib/design/tokens.ts`. Verify (and adjust if needed) that the colour crossover into the risk/loss palette lines up with the sim's severity band boundary rather than an arbitrary value. The band boundary is read from the pressure snapshot's `severity`, not invented here.
- Where the sim exposes a discrete band boundary that maps to a bar position, render a thin vertical tick at that position (`var(--risk)` at 50% opacity, 1px, full track height). If no single numeric boundary is meaningfully exposed, the colour crossover alone carries the danger signal — do not fabricate a tick at a made-up number.

**Consequence-line projection** (`src/reports/pressureConsequenceLine.ts`, new — thin):

- `buildPressureConsequenceLine(pressureId, state): string | undefined`. Pure function. Returns the **top existing `consequences` line** for the pressure (the same data the report's "If ignored" block reads), or `undefined` when the pressure has none or is below the danger band. No new copy is authored here.
- Tested in `tests/sim/`.

**Top-3 ribbon surface** (`PressureRibbon.svelte`):

- For each of the top-3 rows displayed, if the pressure is within / above its danger band (severity-driven), show the consequence line as a second line under the row label.
- Below the band: no consequence line (the row is rising but not yet a concern).
- Consequence lines are not added to the full `PressuresDashboard` — too noisy at 21 rows. Dashboard rows already drill to `CauseDrilldown`, which is the right place for full explanation.

**CauseDrilldown extension** (`web/src/lib/components/CauseDrilldown.svelte`):

- Pressure drilldown header includes the consequence line(s) in a callout block (subtle border, `--text` colour, sized between `.section-label` and body).

### Acceptance criteria

1. Pressure bar fill colour crosses to the risk/loss palette at the sim's severity-band boundary (verified, not invented).
2. Top-3 pressure ribbon shows the pressure's existing consequence line when the pressure is in/above its danger band.
3. Pressure drilldown header shows the consequence line(s) in a callout when the sim has authored them.
4. The displayed lines are exactly the sim's `consequences` data — no parallel copy, no rewording in the web layer.
5. Output is deterministic — same pressure id and state yields the same line.
6. Pressures without authored consequences fall back to silence — no placeholder, no "stakes unknown."
7. `tests/sim/phase191.pressureConsequence.test.ts` validates the projection across all 21 pressures (returns the sim's line or silent, never invents).
8. `tests/web/phase191.pressureUI.test.ts` validates danger-band colouring and consequence-line surfacing in the ribbon and drilldown.

### Do not do

- Do not author a `stakeLines.ts` (or any parallel content file). The sim already owns consequence text; reuse it. Inventing a second source would violate "the simulation is the source of truth."
- Do not introduce a hard threshold number (e.g. 70) into the registry or the web layer. Use the sim's existing severity band.
- Do not change pressure severity/urgency computation. This phase only *exposes* it.
- Do not add multi-line stake explanations to the ribbon. One line per row; fuller text lives in `CauseDrilldown`.
- Do not turn consequence lines into action recommendations ("you should restock"). The Plan beat (phase 193) owns recommendations.
- Do not gate display on day-of-week, day-type, or any other temporal condition. If the pressure is in its danger band, the line shows. Predictability matters.

### Depends on

Phase 190a (`MetricLink` makes the drilldown navigation easier, though strictly not required for the consequence-line work itself).

---

## Phase 192 / ISSUE-159 — TopBar stakes reframe

**Goal:** Convert the topbar from a calendar chronicle to a stakes summary. The one element visible on every screen should carry the player's most actionable context.

### Scope

**Replace** (`web/src/lib/components/TopBar.svelte`):

Current center content (`TopBar.svelte:10–11`): `Day 1 · Week 1 · Month 1 · <day-type>`
New center content: `Day 1 · <top pressure or "tavern steady">`

- Top pressure uses the same #1 row from `PressureRibbon`'s logic. Renders as a small `<MetricLink kind="pressure" id={topId}>` chip — e.g. `Food Safety ↑ 67` with the trend icon.
- When no pressure is in its danger band: render `tavern steady` in `var(--text-dim)` italic.

Right side:

- Coin chip (already exists at `TopBar.svelte:57–61`) wrapped in `<MetricLink kind="coin">`.
- From Plan beat onward: also show a **time-remaining chip** — the day's remaining minutes (`DAY_MINUTES − minutesQueued`, formatted via `formatDuration`). Renders as a chip that opens `ActionPicker` on tap. Non-interactive in Morning beat (before planning begins). Hidden in Report beat. (This is the time economy from phase 186 — there is no "AP X/3".)

**Calendar peek:**

- The `Day 1` portion becomes a tap target. Tapping opens a small popover showing:
  - Full date string (`Day · Week · Month`).
  - Day-type label + definition (lifts `TermLabel`'s glossary integration — the day-type `TermLabel` currently lives inline on the day line).
  - Days until next end-of-week / end-of-month milestone.
- Popover uses the same `BottomSheet` or a smaller inline popover. Author's choice during implementation; the existing `FirstEncounterHint` popover styling is a reasonable model.

**Day-type badge:**

- Shown inline only when `dayType !== 'normal'`. Otherwise omitted entirely. Reduces chrome on quiet days; gives the badge actual signal when it does appear.

### Acceptance criteria

1. TopBar center shows day ordinal + top pressure chip (or "tavern steady"). No more `Week N · Month N` inline.
2. Day-type label appears as a badge only when non-normal; omitted otherwise.
3. Tapping the day chip opens the calendar peek popover.
4. Top pressure chip is a working `MetricLink` — taps open the pressure's `CauseDrilldown`.
5. Right side shows coin chip + (in Plan beat onward) a time-remaining chip.
6. Time chip is interactive in Plan/Service/Closing beats; non-interactive in Morning; hidden in Report.
7. Welcome-back pill behaviour (Phase 96) is preserved — still appears below the day line on first morning after reload, still auto-dismisses on 30s timer.
8. `tests/web/phase192.topbar.test.ts` covers: center content branching, badge visibility, time-chip beat gating, calendar peek opening.

### Do not do

- Do not remove the day ordinal. Players orient by day number.
- Do not surface multiple pressures in the topbar. One is the maximum; this is a summary surface, not a dashboard.
- Do not animate the pressure chip changing between days. Quiet transitions only — fade if anything.
- Do not change `TermLabel` behaviour on the day-type badge. Definition popover stays accessible from the calendar peek.
- Do not show consequence lines in the topbar. The topbar is summary; stakes live in the ribbon and drilldown.
- Do not reintroduce action-point language. The budget is time.

### Depends on

Phase 190a (`MetricLink` must exist). Phase 191 danger-band work is independent but reads well alongside.

---

## Phase 193 / ISSUE-160 — Action effect previews + suggestions in Plan beat

**Goal:** Two clarity gaps in the Plan beat, addressed together. (a) Owner actions in the picker show only a label, a time cost, and a disabled reason — they never say what the action *does*, even though the definition already carries an `effectsPreview`. (b) The picker has no stance on what matters today. This phase surfaces action effects **and** adds a small "Suggested" section tying choices to rising pressures and yesterday's losses.

### Audit context (read first)

- `OwnerActionDefinition` already carries an `effectsPreview` (and policy rows already surface their `effects` string). The `ActionPicker` renders neither for ordinary action rows — only `label`, `timeCost`, and `disabledReason`. Card *choices* (post-legibility arcs) have rich previews; planning actions do not. Closing that asymmetry is the higher-leverage half of this phase.
- The day budget is **time** (`DAY_MINUTES`, `timeCost`), not action points.

### Scope — Part A: action effect previews

**Picker rows** (`web/src/lib/components/ActionPicker.svelte`):

- Render the existing `effectsPreview` as a one-line dim caption under each action row's label (mirroring how policy rows already show `effects`). Keep it terse; truncate gracefully if long.
- No new sim data — read what the definition already provides. Actions with an empty `effectsPreview` simply show no caption.

### Scope — Part B: suggestion engine

**Suggestion engine** (`web/src/lib/sim/suggestActions.ts`, new):

A pure function `suggestActions(state, picks, previousResult?): SuggestedAction[]`. Returns up to 3 suggestions. The first cut uses a simple rule set:

- For each pressure in/above its danger band (severity-driven, same band as phase 191), find owner actions whose `pressureAffinity` includes that pressure id.
- For each loss-direction line in yesterday's `DailyReportData` (`gameStore.previousResult` if held; otherwise derive from `latestResult`), find actions tagged as remediations for that loss type.
- Deduplicate (an action already in `picks` is filtered out).
- Sort by (severity of source pressure desc, then by lowest **time cost** asc). Cap at 3.

Each suggestion carries `{ action: OwnerActionDefinition, reason: string }` where `reason` is generated from the trigger — `"Food Safety rising"` or `"lost ale to spoilage yesterday"`. Reason is short and literal — no interpretation.

**Additive registry field** (`src/sim/registries/actionRegistry.ts` and per-action files under `src/sim/modules/ownerActions/`):

- Add `pressureAffinity?: PressureId[]` to `OwnerActionDefinition`. Optional, defaults to undefined.
- Tag existing actions where the mapping is obvious (e.g. `restock_ingredients` → `['food_safety']`, `repair_area` → `['maintenance']`).
- Aim for 60%+ coverage of existing actions in this phase. Un-tagged actions are silently never suggested — fine.

**Picker surface** (`web/src/lib/components/ActionPicker.svelte`):

- Above the existing tab strip, render a new "Suggested" section when `suggestActions` returns ≥1 result.
- Each suggested action renders the same way as a normal action row (label, time cost, effect preview from Part A, disabled reason if any), plus the reason as a one-line dim caption.
- Tapping a suggestion adds it to picks via the existing `addPick` path. Removing it works the same way (chip × button).
- When all suggestions are taken (filtered out by the dedup rule) or the list is empty, the section collapses entirely — no "no suggestions" placeholder.

### Acceptance criteria

1. Every action row in the picker shows its `effectsPreview` as a dim caption when one is authored; rows with none show no caption and no placeholder.
2. Plan beat opens with picker visibly differentiated — Suggested section appears at top when suggestions exist.
3. Suggested actions tap-to-add behave identically to normal action rows.
4. Each suggested action shows a one-line reason ("Food Safety rising" / "lost ale yesterday").
5. Suggestion list updates reactively as picks are added (suggestions already taken are filtered out).
6. Suggestion engine is deterministic — same state, picks, and previousResult yields same suggestions.
7. Untagged actions (no `pressureAffinity`) are never suggested.
8. Sort tiebreak uses **time cost**, not action points.
9. `tests/web/phase193.actionPreviewsAndSuggest.test.ts` validates: effect-preview rendering, rising-pressure trigger, yesterday-loss trigger, cap at 3, dedup against picks, time-cost tiebreak, deterministic ordering.
10. `tests/sim/phase193.actionAffinity.test.ts` validates that `pressureAffinity` values are valid pressure ids (cross-reference check, like the existing validation pass).

### Do not do

- Do not author new effect-preview copy in the web layer. Surface what the definition already provides.
- Do not build a "smart" recommender. The rule set is intentionally simple — this is about *framing*, not optimisation. Players who want to ignore suggestions still can; players who want guidance get directional pointers.
- Do not surface suggestions outside the picker. They are scoped to Plan beat. (Phase 195 will add an "open picker with suggestions visible" link from drilldowns, but the suggestion surface itself stays in the picker.)
- Do not auto-add suggestions. The player taps.
- Do not author new copy for the suggestion reason beyond the literal trigger. Keep voice consistent with the existing terse style — no "consider doing X" framing.
- Do not block on full `pressureAffinity` coverage. Ship with partial coverage; un-tagged actions are fine.
- Do not retroactively change the time budget or category structure. The existing 4-tab picker stays as is below the Suggested section.
- Do not reintroduce action-point language anywhere in this phase.

### Depends on

Phase 190a (no hard dependency, but the picker rows will benefit from `EntityLink` on action targets). Phase 191's danger band defines the suggestion trigger, so land 191 first.

---

## Phase 194 / ISSUE-161 — Typography scan-speed pass

**Goal:** Stop letting decorative type carry functional load. Split the overloaded `.tag` class so high-frequency chrome parses fast and decorative atmosphere stays where it belongs.

### Scope

**Class split** (`web/src/lib/design/global.css`):

Current `.tag`:
```css
font-variant: small-caps;
letter-spacing: 0.06em;
font-size: var(--type-tag); /* 12px */
color: var(--text-faint);
```

New classes:

- **`.section-label`** — small-caps stays; bump to 13px (`0.8125rem`); `--text-dim` for contrast. Use for `<h2>` section markers ("Rising", "Morning", "Yesterday · Day 3"). Roughly 15–20 uses app-wide.
- **`.chip`** — sentence case, no letter-spacing; 13px; `--text`. Use for `.pending`, pick-list rows, all inline status pills, sub-nav buttons.
- **`.badge`** — like `.chip` but with a colored background or border for emphasis. Use for topbar day-type badge, welcome-back pill, danger-zone indicators, policy on/off pills.
- **`.tag` (kept, narrowed)** — reserved for true meta-context labels only. E.g. the `YesterdayDigest`'s "Yesterday · Day 3" header. Roughly 4–6 uses across the app after migration.

### Migration

Audit every `class="tag"` (and `class:tag` and template-literal usages) across `web/src/` (~15 files currently). Replace with the appropriate new class. Likely candidates (non-exhaustive — full audit during implementation):

- Sub-nav buttons in `ReportsScreen`, `TavernScreen`, `WorldScreen` → `.chip`
- Pending tags in `DayScreen` → `.chip`
- `ActionPicker` tab strip + targeting hints + `unspent`/`empty` lines → `.chip` / `.section-label` as appropriate
- "Set" / "Pick" plan row metadata → `.chip`
- Block labels (`<h2 class="block-label tag">`) → `<h2 class="block-label section-label">`
- Policy state on/off pills in `ActionPicker` → `.badge`
- `BottomNav` labels → `.chip` (the small-caps on nav labels is a primary offender for scan speed)

### TermLabel and EntityLink coexistence

`TermLabel` currently inherits surrounding type styling and adds a dotted underline for definability. After migration, audit `TermLabel` in each new context:

- Its dotted underline must remain distinguishable from `EntityLink`'s hover-only border-bottom (phase 190).
- Document the visual contract in a comment in `global.css`: `TermLabel` = static dotted underline = "what does this mean?"; `EntityLink` = hover-only border-bottom = "take me there."

### Acceptance criteria

1. `.tag` class still exists but is reserved for true meta labels (4–6 occurrences app-wide after migration).
2. Functional chrome (nav, chips, badges, status) uses one of the new classes — no `font-variant: small-caps` on tappable text smaller than 14px.
3. All previously-tagged elements pass a manual contrast check at ≥4.5:1 against background.
4. Existing web tests still pass — visual classes are decorative, so DOM remains stable except for class names. Queries that select on `.tag` need to be audited and updated.
5. `tests/web/phase194.typography.test.ts` validates that key components emit the new class names (regression guard against re-introducing `.tag` in functional chrome).
6. Manual screenshot review across all 5 tabs + 5 beats: the app reads as the same product, slightly cleaner. No "looks like a different app" regression.

### Do not do

- Do not change `Cinzel` / `EB Garamond` font families. The display type is fine.
- Do not increase font sizes globally. The split addresses *style*, not *scale*. (Font scaling is a player preference set in phase 98 and stays orthogonal.)
- Do not remove small-caps from `.section-label`. Section headers are the right place for that style.
- Do not change report prose typography. The DailyReport body is decorative on purpose.
- Do not touch voice-line styling (empty-state italics like "the floor is calm. the day waits."). Those are atmosphere, not chrome.
- Do not introduce additional new utility classes beyond the four named here. The cost of a class is finding it later; keep the vocabulary small.

### Depends on

Phases 190, 191, 192, 193 — typography work lands after the consumers have settled so the migration touches each component once.

---

## Phase 195 / ISSUE-162 — Reports → Action conversion

**Goal:** Close the loop from insight to action. Every report surface should make it possible to *do something* about what it's showing.

### Scope

**Drilldown CTA** (`web/src/lib/components/CauseDrilldown.svelte`):

- Pressure drilldowns get a "Plan an action against this" button at the bottom. Tapping:
  1. Navigates to `Day` route (if not already there).
  2. Forces beat to `plan`.
  3. Opens `ActionPicker` with the relevant tab preselected.
  4. If `suggestActions` has a relevant entry for this pressure, the Suggested section is scrolled into view.
- Coin / reputation drilldowns get a similar CTA when an appropriate action category exists. If nothing maps, omit the CTA — silence over noise.

**Yesterday Digest promotion** (`web/src/lib/components/YesterdayDigest.svelte` + `web/src/lib/screens/DayScreen.svelte`):

- Currently shown after the at-a-glance row on morning. **Move it above** the at-a-glance row. Yesterday's outcome is more decision-relevant than today's static counts. (The digest already has a tap-through to Reports; preserve it.)
- Add an optional "Today's watch" second block beneath the digest: one line derived from yesterday's pressure deltas (e.g. "Pests rose 8 — keep an eye on it"). Pure projection from `previousCalendar` + current pressure state. Voice matches existing terse style.
- When no notable delta, the second block is omitted entirely.

**Monthly / Weekly Overview navigation** (`web/src/lib/components/MonthlyOverview.svelte`, `WeeklyOverview.svelte`):

- Phase 190b covered top-level entity/pressure references. This phase audits every remaining line item — entity names, pressure references, axis labels — and wraps them in `EntityLink` / `MetricLink`.
- The existing `onnavigatepressures` callback path stays as-is.

**MissedOpportunities** (`web/src/lib/components/MissedOpportunities.svelte`):

- Each opportunity carries an entity reference. Wrap as `EntityLink` so the player can jump to the entity that was missed.

### Acceptance criteria

1. Pressure drilldown shows a "Plan an action against this" CTA that opens `ActionPicker` with appropriate context (suggested section visible, relevant tab preselected).
2. Yesterday Digest renders **above** the at-a-glance row on morning beat.
3. Yesterday Digest carries an optional "Today's watch" line when yesterday's pressure deltas surface a relevant cue. Omitted otherwise.
4. Monthly / Weekly Overview entity and pressure references are tappable via phase 190 primitives — full audit, not just top-level.
5. Missed-opportunity entries link to the named entity.
6. Drilldown CTAs that have no mapped action category are omitted, not shown as disabled.
7. `tests/web/phase195.reportsActions.test.ts` validates CTA wiring, Yesterday Digest reordering, "Today's watch" branching, and entity-link coverage in Monthly/Weekly.

### Do not do

- Do not redesign the Reports sub-nav. The five sub-tabs stay.
- Do not auto-open `ActionPicker` from a report on render — the player must tap a CTA explicitly. Auto-opening on render would break the back-button mental model.
- Do not generate fake "Today's watch" lines when no real deltas exist. Silence is fine.
- Do not extend Yesterday Digest beyond two short lines plus header.
- Do not add CTAs to surfaces that aren't actionable (e.g. the TavernLog filter view — that's historical, not actionable).

### Depends on

Phase 190a, Phase 193.

---

## Phase 196 / ISSUE-163 — Day dominance and cleanups

**Goal:** Final visual hierarchy pass. Day is where the game advances; the other tabs are reference. The nav should communicate that. Catch any drift from the prior phases.

### Scope

**Day icon emphasis** (`web/src/lib/components/BottomNav.svelte`):

- Day icon: always rendered in `--accent` color (faded when not active, full when active). Other tabs stay in `--text-faint` when inactive, `--accent` when active.
- When the current beat has unresolved seeds or queued picks that won't auto-advance (i.e. the player has work to do in Day that they've navigated away from), render a small dot indicator on the Day icon. Note: picks are now a cross-screen queue (Tavern panels enqueue actions via `gameStore.picks`), so "unresolved work in Day" is a genuine, common state — the indicator earns its place.

**Quick Day promotion** (`web/src/lib/screens/DayScreen.svelte`):

- `runQuickDay` is offered only when Segment A produced zero morning seeds (`quickDayEligible`). When it *is* available, promote its affordance to peer styling with the primary "Plan the day" button instead of an italic `--text-dim` footnote — so the player sees two real options, not one option and a hint. (Leave the eligibility rule unchanged; this is styling only.)

**Plan beat back-to-morning verification:**

- The existing `← back` from Plan returns to Morning. Verify pressure ribbon, at-a-glance, and Yesterday Digest restore correctly after the phase 195 reorder. No new work expected — sanity check only.

**Final visual audit:**

Walk through every beat and every tab once with phases 190–195 in place. Catch any chips, badges, or labels that drifted during the migration. Resolve. This is the cleanup-and-commit pass.

### Acceptance criteria

1. Day icon tinted with `--accent` (faded when inactive) in `BottomNav` always.
2. Day icon shows a dot indicator when there are unresolved seeds or queued picks at start of day (after navigating away and back).
3. Quick Day affordance reads as a peer to "Plan the day," not a footnote, when it is available.
4. Manual screenshot review across all 5 tabs + 5 beats catches no regression from prior phases.
5. `tests/web/phase196.dayNav.test.ts` covers the Day icon emphasis and dot indicator rendering.

### Do not do

- Do not collapse Tavern + World into one tab. Out of scope for this arc. (Worth reconsidering after Tier 4 onboarding lands and we can see how progressive unlocks affect navigation density.)
- Do not change `BottomNav` from 5 tabs. Numbers stay the same; visual weight changes.
- Do not redesign tab icons themselves.
- Do not introduce new beat states or change the day loop.

### Depends on

All prior phases (190–195).

---

## Out of scope for this arc

The following came up during design and are explicitly deferred:

- **Tavern + World tab consolidation.** Conceptually appealing but risky to ship before Tier 4 onboarding, which will affect how those surfaces feel under progressive unlock. Re-evaluate after Tier 4 lands.
- **Cross-day undo of card resolutions.** Phase 190 allows revising a pending choice before End Day; cross-day undo is a separate concern and would touch the sim.
- **Full "back" history stack for sheets.** Tier 4 onboarding may need this; out of scope here.
- **Animated transitions between linked surfaces.** Stick with the existing motion tokens. No bespoke route animations.
- **Recommender intelligence in suggested actions.** Phase 193 uses a simple rule set on purpose. Smarter suggestion would need its own design pass.
- **Long-press affordances on EntityLink / MetricLink (e.g. "preview without navigating").** Tempting; defer until Tier 4 informs the unlock model.
- **Tutorial / "did you know" callouts.** Tier 4 owns onboarding surfaces.

---

## Test approach summary

- Sim-side additions (phase 191 consequence-line projection, phase 193 affinity field + validation) get coverage in `tests/sim/phase{NNN}.*.test.ts` matching the existing pattern.
- Web-side changes get coverage in `tests/web/phase{NNN}.*.test.ts` mirroring the phase 119–120 pattern (full-render with the existing test harness, derived-state assertions).
- Each phase ships its own test file; no cross-phase shared fixtures beyond what already exists in `tests/web/`.
- Visual regression is manual via the dev server. No automated visual diff in this arc.
- Save-envelope schema must not change across the arc. Phase 190's `*SubviewTarget` is transient; no migration required.

---

## Tracker update

Add to `docs/ISSUE_TRACKER.md` under Tier 5 (UI/UX clarity), as a revived arc:

```
ISSUE-157 — Interconnection primitives (EntityLink, MetricLink).
  Status: open. Phase: 190. Depends on: —.
ISSUE-158 — Pressure stakes and danger zones (reuse sim consequences + severity band).
  Status: open. Phase: 191. Depends on: ISSUE-157.
ISSUE-159 — TopBar stakes reframe (time economy, not action points).
  Status: open. Phase: 192. Depends on: ISSUE-157, ISSUE-158.
ISSUE-160 — Action effect previews + suggestions in Plan beat.
  Status: open. Phase: 193. Depends on: ISSUE-157, ISSUE-158.
ISSUE-161 — Typography scan-speed pass.
  Status: open. Phase: 194. Depends on: ISSUE-157, ISSUE-158, ISSUE-159, ISSUE-160.
ISSUE-162 — Reports → Action conversion.
  Status: open. Phase: 195. Depends on: ISSUE-157, ISSUE-160.
ISSUE-163 — Day dominance and cleanups.
  Status: open. Phase: 196. Depends on: ISSUE-157, ISSUE-158, ISSUE-159, ISSUE-160, ISSUE-161, ISSUE-162.
```

---

## Notes for Claude Code

- This arc is web-layer first. Most phases require only `web/src/` changes plus matching `tests/web/`.
- Phase 191 (consequence-line projection over existing `consequences`) and Phase 193 (`pressureAffinity` field on action defs + surfacing existing `effectsPreview`) are the only sim-touching phases. Both are read-only metadata / thin projections, no engine logic, no state-shape changes, no save-schema impact.
- The budget is **time** throughout (phase 186). There is no action-point concept; do not reintroduce one.
- Per the project's per-issue workflow: each phase should produce a matching `docs/plans/phase-{190a,190b,191–196}-{slug}.md` plan file when work begins. This design contract is the parent; per-phase plans implement against it.
- The arc is intentionally executable before Tier 4 lands. Tier 4 awareness is limited to the graceful-fallback rule in phase 190 — entities that don't resolve render as plain text.
- If at any point during implementation a phase's acceptance criterion conflicts with an existing locked contract (`phase-01-simulation-contract.md`, `phase-21-expansion-contract.md`, `cards-contract.md`, etc.), stop and surface the conflict before continuing. The locked contracts win.
