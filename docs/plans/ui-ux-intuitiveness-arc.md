# UI/UX Intuitiveness Arc — Tier 5 continuation

**Status:** open. Phases 121–127.

**Slots before:** Tier 4 Progressive Onboarding (ISSUE-060…077, phases 99–116).

**Tracker entries:** ISSUE-081…087 (7 issues).

**Builds on:** Tier 5 UI/UX clarity passes (ISSUE-078/079, phases 117–118) and the More-tab chassis work (ISSUE-080, phase 98).

---

## Vision

The current UI lays the simulation flat. Every screen carries equal weight; every noun is rendered as static text; every number floats without consequence. The player has to construct their own hierarchy of "what to look at first" and their own translation table from "what I want" to "where to tap." That is the source of the unintuitive feel.

Two principles drive this arc:

**The UI should be a graph, not a tree.** Every visible noun or number is a node. Tapping a node should land on the most relevant detail surface for it — and tapping detail back should land you in context. Right now the only path is `tab → sub-tab → list → row → sheet`; this arc adds direct edges everywhere.

**The UI should have an opinion about what matters right now.** When pressures are rising, the planning surface should know. When yesterday's report named a staff member's mistake, that name should be a link to staff. When the topbar shows "Day 3," it should also show the one thing the player is most likely to act on.

The sim is genuinely deep. The arc does not simplify it. It exposes the depth through directed surfaces instead of flat ones.

---

## Sequencing rationale

**Phase 121 (interconnection primitives) lands first** because every later phase consumes them. `EntityLink` and `MetricLink` become the carriers for everything else — stakes lines, suggested actions, drilldown CTAs all hang off them. Building those first means later phases are wiring, not invention.

**Phase 122 (pressure stakes) lands second** because it is the highest-leverage comprehensibility change available. Players don't fear numbers; they fear consequences. A "Food Safety 67 ↑" tells you nothing without "if this hits 100, the health inspector arrives."

**Phase 123 (TopBar reframe) is small but visually defining** — the topbar is the one element the player sees on every screen.

**Phase 124 (Suggested actions) closes the "what do I do" loop.** With pressures now carrying stakes (phase 122) and entities now linked (phase 121), the picker can surface "this action defuses this pressure" reliably.

**Phase 125 (typography pass) is intentionally late:** doing it earlier would force re-touching every component when the linking work lands. Easier to split the `.tag` class once, after every consumer has settled.

**Phase 126 (Reports → Action) and Phase 127 (Day dominance + cleanups) are polish.**

This sequence is the recommended execution order. Dependencies between phases are noted per-issue; pieces can be reordered within those constraints if needed.

---

## Cross-cutting constraints

**Tier 4 awareness.** Tier 4 Progressive Onboarding (ISSUE-060…077) will gate features behind in-game time. `EntityLink` / `MetricLink` built here must fail gracefully on entities that do not yet exist — render as plain text (no link affordance) rather than throwing. This is the only Tier-4 coupling required; the arc does not implement unlock logic.

**Atmosphere lives in copy, not chrome.** The dark/parchment aesthetic, voice lines, and report prose stay untouched. Scan-speed improvements (phase 125) remove decorative type from *functional* chrome only.

**No simulation changes beyond minimal additive extensions.** Most phases are web-layer only. Phase 122 adds a `stakeLine` projection (read-only on existing pressure state). Phase 124 adds an additive `pressureAffinity?` field to `OwnerActionDefinition`. Both follow the project's "additive integration during arcs" rule from `CLAUDE.md`. Phase 122's `stakeLine` data lives in content folders, never invented by cards.

**No new dependencies.** Stay on Svelte 5 + existing CSS tokens. New primitives are pure components.

**Tests live under `tests/web/` (web-layer) and `tests/sim/` (sim projection extensions).** Match the existing pattern from phases 119–120.

**The simulation is the source of truth.** Nothing in this arc invents state. Entity references and stake lines all read existing or trivially-projected state. Cards/UI must not contradict known state.

---

## Phase 121 / ISSUE-081 — Interconnection primitives

**Goal:** Build `EntityLink` and `MetricLink` so any reference to an entity or number in the UI can be tapped to land on its detail surface, and wire the first round of high-traffic consumers (DayScreen at-a-glance, PressureRibbon, plan rows, pending tags, DailyReport entity names).

### Scope

**New components** under `web/src/lib/components/links/`:

- `EntityLink.svelte` — wraps a reference to an entity. Props: `{ kind: EntityKind, id: string, label: string, variant?: 'inline' | 'chip' }`. On click: routes to the entity's sub-view via `gameStore.setRoute` + a new `target` parameter, opens the relevant detail sheet on mount.
- `MetricLink.svelte` — wraps a metric value. Props: `{ kind: MetricKind, id?: string, children: Snippet }`. On click: opens `CauseDrilldown` with the appropriate path.

**Entity kinds** (union type locked in a new `web/src/lib/components/links/types.ts`):

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

- Add transient (non-persisted, session-only) fields `tavernSubviewTarget?: string` and `worldSubviewTarget?: string` to the store. These do not enter the save envelope — keeps the save schema stable.
- `setRoute(route, opts?)` accepts `{ target?: string, kind?: EntityKind }`. When given, it sets the relevant target and updates the corresponding `*Subview` to the kind's home tab (e.g. `kind: 'staff'` → `tavernSubview = 'staff'`, `tavernSubviewTarget = id`).
- Tavern/World sub-panels (`StaffPanel`, `RegularsPanel`, `StockPanel`, etc.) read `*SubviewTarget` on mount via `$effect` and call into their existing detail-sheet open path. The target is consumed once (cleared on read) so re-entering the panel later doesn't re-open the sheet.

**Drilldown path extensions** (`web/src/lib/components/CauseDrilldown.svelte`):

The existing path scheme handles `pressures.<id>`. Extend to handle:

- `coin` — opens a coin-flow drilldown showing today's income / expenses if `latestResult` exists; falls back to current balance only if no day has run yet.
- `reputation.<axis>` — opens a per-axis drilldown built from `state.reputation.<axis>` history.
- `inventory.<itemId>` — alias that routes through to the existing `StockDetailSheet`.

The first two require small projection helpers in `src/reports/` mirroring the existing pressure-cause pattern. `inventory` reuses existing wiring.

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
   - Top entity / pressure references become links. Cap this phase's audit to the top-level summary blocks; full coverage can come in phase 126.

### Visual treatment

- Default state: indistinguishable from surrounding text (no static underline, no color shift).
- Hover / focus: `border-bottom: 1px dotted color-mix(in srgb, var(--accent) 35%, transparent)`. Subtle.
- Touch devices: no hover state; affordance is taught by behaviour, not chrome.
- Must NOT use the same hover treatment as `TermLabel`. Players need to distinguish "what does this mean?" (definition) from "take me there" (navigation). `TermLabel` currently uses a static dotted underline at all times; `EntityLink` uses a hover-only border-bottom in a slightly different color/opacity. Document both treatments side-by-side as comments in `web/src/lib/design/global.css`.

### Acceptance criteria

1. `EntityLink` and `MetricLink` render in all consumer locations without changing visible layout.
2. Tapping "3 staff" on DayScreen morning lands on `Tavern → Staff` with the panel scrolled to top (no auto-open since no specific target id was given).
3. Tapping "ale 80" on DayScreen morning lands on `Tavern → Stock` with `StockDetailSheet` for ale already open.
4. Tapping a pressure row in `PressureRibbon` opens `CauseDrilldown` for that pressure — same behaviour as tapping a `PressureCard` in `PressuresDashboard`.
5. Tapping the "100" coin in DayScreen at-a-glance opens `CauseDrilldown` at `coin` path.
6. Tapping a pending "noted: <verb>" tag re-opens the original card choice for revision (the choice is uncommitted until End Day).
7. In `DailyReport`, a staff name in a resolved-intent block lands on staff detail on tap.
8. `EntityLink` with an `id` that does not resolve (e.g. a staff member who left between reports, or a tier-4-gated entity that does not yet exist) renders as plain text — no click, no error, no console warn.
9. The `*SubviewTarget` is consumed on first read and cleared. Re-entering the same sub-panel via the tab nav does not re-open the previously-targeted sheet.
10. New Vitest coverage in `tests/web/phase121.interconnection.test.ts` validates: routing target propagation, fallback for missing entities, drilldown path resolution for `coin`, `reputation.<axis>`, `inventory.<itemId>`.

### Do not do

- Do not add a generic "?" or info icon next to linked items. The whole word/value is the affordance.
- Do not auto-link arbitrary prose in voice lines, report copy, or empty-state strings. Linking is for *structured* entity references that come from the projection as `{id, label}` pairs. Free-form prose stays prose.
- Do not implement Tavern + World tab consolidation. Out of scope for this arc.
- Do not add a "back to where I came from" history stack. Tier 4 may want this; for now the bottom nav is the back affordance.
- Do not persist `*SubviewTarget` to the save envelope. It is a transient routing hint, not state.

### Depends on

None within this arc.

---

## Phase 122 / ISSUE-082 — Pressure stakes and danger zones

**Goal:** Make pressure values mean something. A bar at 67 should communicate (a) where the danger threshold is and (b) what bad outcome the player is racing against.

### Scope

**Threshold visualisation** (`web/src/lib/components/PressureCard.svelte`, `PressureRibbon.svelte`):

- Each pressure has a danger threshold (typically 70, may vary by category). Read from the pressure registry under `src/sim/modules/pressures/`. Expose via the existing projection or a small additive helper — do not refactor the registry.
- Bar track receives a thin vertical tick mark at the threshold position. Tick uses `var(--risk)` at 50% opacity. 1px wide, full track height.
- When `value >= threshold`, the bar's fill color crosses to the risk/loss palette. `pressureColor` in `web/src/lib/design/tokens.ts` already maps value → color; verify the breakpoint matches the threshold and adjust if not.

**Stake-line content** (under `src/sim/content/pressures/stakeLines.ts`, new):

- Each pressure category (or each pressure id — author's call during implementation based on simulation granularity) gets a `stakeLine` field: a short sentence describing what happens at threshold breach. Voice matches existing report prose — terse, declarative, not hectoring.
- Examples (placeholders; final copy is the author's):
  - Food Safety: "Past 70, the health inspector takes notice."
  - Pests: "Past 70, regulars start sitting elsewhere."
  - Maintenance: "Past 70, something breaks."
- Stake lines are static content, not RNG-derived. Deterministic by id.

**Projection** (`src/reports/pressureStakeLine.ts`, new):

- `buildPressureStakeLine(pressureId, state): string | undefined`. Pure function. Returns the static line for the pressure or `undefined` if no stake line is authored. Tested in `tests/sim/`.

**Top-3 ribbon surface** (`PressureRibbon.svelte`):

- For each of the top-3 rows displayed, if `value >= threshold - 20`, show the stake line as a second line under the row label.
- If `value < threshold - 20`, no stake line is shown (the row is rising but not yet a concern).
- Stake lines are not added to the full `PressuresDashboard` — too noisy at 21 rows. Dashboard rows already drill to `CauseDrilldown`, which is the right place for full explanation.

**CauseDrilldown extension** (`web/src/lib/components/CauseDrilldown.svelte`):

- Pressure drilldown header includes the stake line in a callout block (subtle border, `--text` color, sized between `.section-label` and body).

### Acceptance criteria

1. Every pressure bar shows a threshold tick at the correct value.
2. Bar fill color crosses to risk/loss palette at and above threshold.
3. Top-3 pressure ribbon shows a stake line when value is within 20 of threshold.
4. Pressure drilldown header shows the stake line in a callout when one is authored.
5. Stake lines are deterministic — same pressure id and state yields same line.
6. Pressures without authored stake lines fall back to silence — no placeholder, no "stakes unknown."
7. `tests/sim/phase122.pressureStakes.test.ts` validates stake-line generation across all 21 pressures (authored or silent).
8. `tests/web/phase122.pressureUI.test.ts` validates threshold tick rendering and stake-line surfacing in the ribbon and drilldown.

### Do not do

- Do not write stake lines for all 21 pressures in one sitting. Cover the 5 core pressures first; expanded categories can take a follow-up. Mark uncovered pressures as silent in the projection rather than producing weak placeholder copy.
- Do not change pressure threshold values. Thresholds are sim contract; this phase only *exposes* them.
- Do not add multi-line stake explanations. One sentence per stake. Anything longer goes in `CauseDrilldown`'s existing body.
- Do not turn stake lines into action recommendations ("you should restock"). The Plan beat (phase 124) owns recommendations.
- Do not gate stake-line display on day-of-week, day-type, or any other temporal condition. If the value is within threshold-20, the line shows. Predictability matters.

### Depends on

Phase 121 (`MetricLink` makes the drilldown navigation easier, though strictly not required for stake-line work itself).

---

## Phase 123 / ISSUE-083 — TopBar stakes reframe

**Goal:** Convert the topbar from a calendar chronicle to a stakes summary. The one element visible on every screen should carry the player's most actionable context.

### Scope

**Replace** (`web/src/lib/components/TopBar.svelte`):

Current center content: `Day 1 · Week 1 · Month 1 · Supplier Day`
New center content: `Day 1 · <top pressure or "tavern steady">`

- Top pressure uses the same #1 row from `PressureRibbon`'s logic. Renders as a small `<MetricLink kind="pressure" id={topId}>` chip — e.g. `Food Safety ↑ 67` with the trend icon.
- When no pressure has `value >= threshold - 20`: render `tavern steady` in `var(--text-dim)` italic.

Right side:

- Coin chip (already exists) wrapped in `<MetricLink kind="coin">`.
- From Plan beat onward: also show `AP X/3` — action points remaining in the current day's plan. Renders as a chip that opens `ActionPicker` on tap. Non-interactive in Morning beat (before planning begins). Hidden in Report beat.

**Calendar peek:**

- The `Day 1` portion becomes a tap target. Tapping opens a small popover showing:
  - Full date string (`Day · Week · Month`).
  - Day-type label + definition (lifts `TermLabel`'s glossary integration).
  - Days until next end-of-week / end-of-month milestone.
- Popover uses the same `BottomSheet` or a smaller inline popover. Author's choice during implementation; the existing `FirstEncounterHint` popover styling is a reasonable model.

**Day-type badge:**

- Shown inline only when `dayType !== 'normal'`. Otherwise omitted entirely. Reduces chrome on quiet days; gives the badge actual signal when it does appear.

### Acceptance criteria

1. TopBar center shows day ordinal + top pressure chip (or "tavern steady"). No more `Week N · Month N` inline.
2. Day-type label appears as a badge only when non-normal; omitted otherwise.
3. Tapping the day chip opens the calendar peek popover.
4. Top pressure chip is a working `MetricLink` — taps open the pressure's `CauseDrilldown`.
5. Right side shows coin chip + (in Plan beat onward) AP-remaining chip.
6. AP chip is interactive in Plan/Service/Closing beats; non-interactive in Morning; hidden in Report.
7. Welcome-back pill behaviour (Phase 96) is preserved — still appears below the day line on first morning after reload, still auto-dismisses on 30s timer.
8. `tests/web/phase123.topbar.test.ts` covers: center content branching, badge visibility, AP chip beat gating, calendar peek opening.

### Do not do

- Do not remove the day ordinal. Players orient by day number.
- Do not surface multiple pressures in the topbar. One is the maximum; this is a summary surface, not a dashboard.
- Do not animate the pressure chip changing between days. Quiet transitions only — fade if anything.
- Do not change `TermLabel` behaviour on the day-type badge. Definition popover stays accessible from the calendar peek.
- Do not show stake lines in the topbar. The topbar is summary; stakes live in the ribbon and drilldown.

### Depends on

Phase 121 (`MetricLink` must exist). Phase 122 stake-line work is independent but reads well alongside.

---

## Phase 124 / ISSUE-084 — Suggested actions in Plan beat

**Goal:** Reframe the Plan beat so the picker has a stance on what matters today. Instead of "here are four tabs of actions, pick three," the player sees a small "Suggested" section that ties their choices to rising pressures and yesterday's losses.

### Scope

**Suggestion engine** (`web/src/lib/sim/suggestActions.ts`, new):

A pure function `suggestActions(state, picks, previousResult?): SuggestedAction[]`. Returns up to 3 suggestions. The first cut uses a simple rule set:

- For each pressure with `value >= threshold - 20`, find owner actions whose `pressureAffinity` includes that pressure id.
- For each loss-direction line in yesterday's `DailyReportData` (`gameStore.previousResult` if held; otherwise derive from `latestResult`), find actions tagged as remediations for that loss type.
- Deduplicate (an action already in `picks` is filtered out).
- Sort by (severity of source pressure desc, then by lowest AP cost asc). Cap at 3.

Each suggestion carries `{ action: OwnerActionDefinition, reason: string }` where `reason` is generated from the trigger — `"Food Safety rising"` or `"lost ale to spoilage yesterday"`. Reason is short and literal — no interpretation.

**Additive registry field** (`src/sim/registries/actionRegistry.ts` and per-action files under `src/sim/modules/ownerActions/`):

- Add `pressureAffinity?: PressureId[]` to `OwnerActionDefinition`. Optional, defaults to undefined.
- Tag existing actions where the mapping is obvious (e.g. `restock_ingredients` → `['food_safety']`, `repair_area` → `['maintenance']`).
- Aim for 60%+ coverage of existing actions in this phase. Un-tagged actions are silently never suggested — fine.

**Picker surface** (`web/src/lib/components/ActionPicker.svelte`):

- Above the existing tab strip, render a new "Suggested" section when `suggestActions` returns ≥1 result.
- Each suggested action renders the same way as a normal action row (label, AP cost, disabled reason if any), plus the reason as a one-line dim caption underneath.
- Tapping a suggestion adds it to picks via the existing `addPick` path. Removing it works the same way (chip × button).
- When all suggestions are taken (filtered out by the dedup rule) or the list is empty, the section collapses entirely — no "no suggestions" placeholder.

### Acceptance criteria

1. Plan beat opens with picker visibly differentiated — Suggested section appears at top when suggestions exist.
2. Suggested actions tap-to-add behave identically to normal action rows.
3. Each suggested action shows a one-line reason ("Food Safety rising" / "lost ale yesterday").
4. Suggestion list updates reactively as picks are added (suggestions already taken are filtered out).
5. Suggestion engine is deterministic — same state, picks, and previousResult yields same suggestions.
6. Untagged actions (no `pressureAffinity`) are never suggested.
7. `tests/web/phase124.suggestActions.test.ts` validates: rising-pressure trigger, yesterday-loss trigger, cap at 3, dedup against picks, AP-cost tiebreak, deterministic ordering.
8. `tests/sim/phase124.actionAffinity.test.ts` validates that `pressureAffinity` values are valid pressure ids (cross-reference check, like the existing validation pass).

### Do not do

- Do not build a "smart" recommender. The rule set is intentionally simple — this is about *framing*, not optimisation. Players who want to ignore suggestions still can; players who want guidance get directional pointers.
- Do not surface suggestions outside the picker. They are scoped to Plan beat. (Phase 126 will add an "open picker with suggestions visible" link from drilldowns, but the suggestion surface itself stays in the picker.)
- Do not auto-add suggestions. The player taps.
- Do not author new copy for the suggestion reason beyond the literal trigger. Keep voice consistent with the existing terse projection style — no "consider doing X" framing.
- Do not block on full `pressureAffinity` coverage. Ship with partial coverage; un-tagged actions are fine.
- Do not retroactively change the action point budget or category structure. The existing 4-tab picker stays as is below the Suggested section.

### Depends on

Phase 121 (no hard dependency, but the picker rows will benefit from `EntityLink` on action targets). Phase 122 stake lines amplify why suggestions matter but aren't required.

---

## Phase 125 / ISSUE-085 — Typography scan-speed pass

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

Audit every `class="tag"` (and `class:tag` and template-literal usages) across `web/src/`. Replace with the appropriate new class. Likely candidates (non-exhaustive — full audit during implementation):

- Sub-nav buttons in `ReportsScreen`, `TavernScreen`, `WorldScreen` → `.chip`
- Pending tags in `DayScreen` → `.chip`
- "Set" / "Pick" plan row metadata → `.chip`
- Block labels (`<h2 class="block-label tag">`) → `<h2 class="block-label section-label">`
- Policy state on/off pills in `ActionPicker` → `.badge`
- `BottomNav` labels → `.chip` (the small-caps on nav labels is a primary offender for scan speed)

### TermLabel and EntityLink coexistence

`TermLabel` currently inherits surrounding type styling and adds a dotted underline for definability. After migration, audit `TermLabel` in each new context:

- Its dotted underline must remain distinguishable from `EntityLink`'s hover-only border-bottom (phase 121).
- Document the visual contract in a comment in `global.css`: `TermLabel` = static dotted underline = "what does this mean?"; `EntityLink` = hover-only border-bottom = "take me there."

### Acceptance criteria

1. `.tag` class still exists but is reserved for true meta labels (4–6 occurrences app-wide after migration).
2. Functional chrome (nav, chips, badges, status) uses one of the new classes — no `font-variant: small-caps` on tappable text smaller than 14px.
3. All previously-tagged elements pass a manual contrast check at ≥4.5:1 against background.
4. Existing web tests still pass — visual classes are decorative, so DOM remains stable except for class names. Queries that select on `.tag` need to be audited and updated.
5. `tests/web/phase125.typography.test.ts` validates that key components emit the new class names (regression guard against re-introducing `.tag` in functional chrome).
6. Manual screenshot review across all 5 tabs + 5 beats: the app reads as the same product, slightly cleaner. No "looks like a different app" regression.

### Do not do

- Do not change `Cinzel` / `EB Garamond` font families. The display type is fine.
- Do not increase font sizes globally. The split addresses *style*, not *scale*. (Font scaling is a player preference set in phase 98 and stays orthogonal.)
- Do not remove small-caps from `.section-label`. Section headers are the right place for that style.
- Do not change report prose typography. The DailyReport body is decorative on purpose.
- Do not touch voice-line styling (empty-state italics like "the floor is calm. the day waits."). Those are atmosphere, not chrome.
- Do not introduce additional new utility classes beyond the four named here. The cost of a class is finding it later; keep the vocabulary small.

### Depends on

Phases 121, 122, 123, 124 — typography work lands after the consumers have settled so the migration touches each component once.

---

## Phase 126 / ISSUE-086 — Reports → Action conversion

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

- Currently shown after the at-a-glance row on morning. **Move it above** the at-a-glance row. Yesterday's outcome is more decision-relevant than today's static counts.
- Add an optional "Today's watch" second block beneath the digest: one line derived from yesterday's pressure deltas (e.g. "Pests rose 8 — keep an eye on it"). Pure projection from `previousCalendar` + current pressure state. Voice matches existing terse style.
- When no notable delta, the second block is omitted entirely.

**Monthly / Weekly Overview navigation** (`web/src/lib/components/MonthlyOverview.svelte`, `WeeklyOverview.svelte`):

- Phase 121 covered top-level entity/pressure references. This phase audits every remaining line item — entity names, pressure references, axis labels — and wraps them in `EntityLink` / `MetricLink`.
- The existing `onnavigatepressures` callback path stays as-is.

**MissedOpportunities** (`web/src/lib/components/MissedOpportunities.svelte`):

- Each opportunity carries an entity reference. Wrap as `EntityLink` so the player can jump to the entity that was missed.

### Acceptance criteria

1. Pressure drilldown shows a "Plan an action against this" CTA that opens `ActionPicker` with appropriate context (suggested section visible, relevant tab preselected).
2. Yesterday Digest renders **above** the at-a-glance row on morning beat.
3. Yesterday Digest carries an optional "Today's watch" line when yesterday's pressure deltas surface a relevant cue. Omitted otherwise.
4. Monthly / Weekly Overview entity and pressure references are tappable via phase 121 primitives — full audit, not just top-level.
5. Missed-opportunity entries link to the named entity.
6. Drilldown CTAs that have no mapped action category are omitted, not shown as disabled.
7. `tests/web/phase126.reportsActions.test.ts` validates CTA wiring, Yesterday Digest reordering, "Today's watch" branching, and entity-link coverage in Monthly/Weekly.

### Do not do

- Do not redesign the Reports sub-nav. The five sub-tabs stay.
- Do not auto-open `ActionPicker` from a report on render — the player must tap a CTA explicitly. Auto-opening on render would break the back-button mental model.
- Do not generate fake "Today's watch" lines when no real deltas exist. Silence is fine.
- Do not extend Yesterday Digest beyond two short lines plus header.
- Do not add CTAs to surfaces that aren't actionable (e.g. the TavernLog filter view — that's historical, not actionable).

### Depends on

Phase 121, Phase 124.

---

## Phase 127 / ISSUE-087 — Day dominance and cleanups

**Goal:** Final visual hierarchy pass. Day is where the game advances; the other tabs are reference. The nav should communicate that. Catch any drift from the prior phases.

### Scope

**Day icon emphasis** (`web/src/lib/components/BottomNav.svelte`):

- Day icon: always rendered in `--accent` color (faded when not active, full when active). Other tabs stay in `--text-faint` when inactive, `--accent` when active.
- When the current beat has unresolved seeds or queued picks that won't auto-advance (i.e. the player has work to do in Day that they've navigated away from), render a small dot indicator on the Day icon.

**Quick Day promotion** (`web/src/lib/screens/DayScreen.svelte`):

- Current `.quick-day` class uses italic + `--text-dim` — visually a footnote. Promote to peer styling with the primary "Plan the day" button when Quick Day is available. Player should see two real options, not one option and a hint.

**Plan beat back-to-morning verification:**

- The existing `← back` from Plan returns to Morning. Verify pressure ribbon, at-a-glance, and Yesterday Digest restore correctly after the phase 126 reorder. No new work expected — sanity check only.

**Final visual audit:**

Walk through every beat and every tab once with phases 121–126 in place. Catch any chips, badges, or labels that drifted during the migration. Resolve. This is the cleanup-and-commit pass.

### Acceptance criteria

1. Day icon tinted with `--accent` (faded when inactive) in `BottomNav` always.
2. Day icon shows a dot indicator when there are unresolved seeds or queued picks at start of day (after navigating away and back).
3. Quick Day button styling reads as a peer to "Plan the day," not a footnote.
4. Manual screenshot review across all 5 tabs + 5 beats catches no regression from prior phases.
5. `tests/web/phase127.dayNav.test.ts` covers the Day icon emphasis and dot indicator rendering.

### Do not do

- Do not collapse Tavern + World into one tab. Out of scope for this arc. (Worth reconsidering after Tier 4 onboarding lands and we can see how progressive unlocks affect navigation density.)
- Do not change `BottomNav` from 5 tabs. Numbers stay the same; visual weight changes.
- Do not redesign tab icons themselves.
- Do not introduce new beat states or change the 5-beat day loop.

### Depends on

All prior phases (121–126).

---

## Out of scope for this arc

The following came up during design and are explicitly deferred:

- **Tavern + World tab consolidation.** Conceptually appealing but risky to ship before Tier 4 onboarding, which will affect how those surfaces feel under progressive unlock. Re-evaluate after Tier 4 lands.
- **Cross-day undo of card resolutions.** Phase 121 allows revising a pending choice before End Day; cross-day undo is a separate concern and would touch the sim.
- **Full "back" history stack for sheets.** Tier 4 onboarding may need this; out of scope here.
- **Animated transitions between linked surfaces.** Stick with the existing motion tokens. No bespoke route animations.
- **Recommender intelligence in suggested actions.** Phase 124 uses a simple rule set on purpose. Smarter suggestion would need its own design pass.
- **Long-press affordances on EntityLink / MetricLink (e.g. "preview without navigating").** Tempting; defer until Tier 4 informs the unlock model.
- **Tutorial / "did you know" callouts.** Tier 4 owns onboarding surfaces.

---

## Test approach summary

- Sim-side additions (phase 122 stake-line projection, phase 124 affinity field + validation) get coverage in `tests/sim/phase{NNN}.*.test.ts` matching the existing pattern.
- Web-side changes get coverage in `tests/web/phase{NNN}.*.test.ts` mirroring the phase 119–120 pattern (full-render with the existing test harness, derived-state assertions).
- Each phase ships its own test file; no cross-phase shared fixtures beyond what already exists in `tests/web/`.
- Visual regression is manual via the dev server. No automated visual diff in this arc.
- Save-envelope schema must not change across the arc. Phase 121's `*SubviewTarget` is transient; no migration required.

---

## Tracker update

Add to `docs/ISSUE_TRACKER.md` under Tier 5 (UI/UX clarity), continuing after ISSUE-078/079:

```
ISSUE-081 — Interconnection primitives (EntityLink, MetricLink).
  Status: open. Phase: 121. Depends on: —.
ISSUE-082 — Pressure stakes and danger zones.
  Status: open. Phase: 122. Depends on: ISSUE-081.
ISSUE-083 — TopBar stakes reframe.
  Status: open. Phase: 123. Depends on: ISSUE-081, ISSUE-082.
ISSUE-084 — Suggested actions in Plan beat.
  Status: open. Phase: 124. Depends on: ISSUE-081.
ISSUE-085 — Typography scan-speed pass.
  Status: open. Phase: 125. Depends on: ISSUE-081, ISSUE-082, ISSUE-083, ISSUE-084.
ISSUE-086 — Reports → Action conversion.
  Status: open. Phase: 126. Depends on: ISSUE-081, ISSUE-084.
ISSUE-087 — Day dominance and cleanups.
  Status: open. Phase: 127. Depends on: ISSUE-081, ISSUE-082, ISSUE-083, ISSUE-084, ISSUE-085, ISSUE-086.
```

Update the issue-count line in `CLAUDE.md` from "79 issues across 5 tiers" to "86 issues across 5 tiers" when this arc is ready to start.

---

## Notes for Claude Code

- This arc is web-layer first. Most phases require only `web/src/` changes plus matching `tests/web/`.
- Phase 122 (`stakeLines.ts` under `src/sim/content/`) and Phase 124 (`pressureAffinity` field on action defs) are the only additive sim changes. Both are read-only metadata, no engine logic, no state-shape changes, no save-schema impact.
- Per the project's per-issue workflow: each phase should produce a matching `docs/plans/phase-{121–127}-{slug}.md` plan file when work begins. This design contract is the parent; per-phase plans implement against it.
- The arc is intentionally executable before Tier 4 lands. Tier 4 awareness is limited to the graceful-fallback rule in phase 121 — entities that don't resolve render as plain text.
- If at any point during implementation Claude Code finds that a phase's acceptance criterion conflicts with an existing locked contract (`phase-01-simulation-contract.md`, `phase-21-expansion-contract.md`, `cards-contract.md`, etc.), stop and surface the conflict before continuing. The locked contracts win.
