# Phase 190b / ISSUE-157b — Consumer wiring

Companion record to `docs/plans/ui-ux-intuitiveness-arc.md §Phase 190b`. The
arc doc is the locked contract; this file pins the concrete call sites and
the decisions taken where the contract left latitude.

## Goal

Wire the first round of high-traffic consumers onto the 190a primitives
(`EntityLink` / `MetricLink` / `gameStore.setRoute` + the transient
sub-view targets). Pure consumer work — the only non-component additions
are thin **pure mappers** that translate already-existing structured
references (`OwnerActionTargetType`, `EntityRef.kind`) into the
`EntityKind` union the carriers consume. No new sim facts, no new routing
mechanism.

## Call sites wired

1. **`DayScreen.svelte` morning at-a-glance** (`beat === 'morning'`):
   - coin → `<MetricLink kind="coin">{coin}</MetricLink>` (opens the `coin`
     drilldown — a *live* metric, so this is honest).
   - `N staff` → `<EntityLink kind="staff" id="" label="N staff">` — empty
     id ⇒ Tavern → Staff home tab, no auto-open (AC2).
   - stock chips → the joined `stockSummary` string is replaced by a
     structured `stockChips` array (`{ id, label }`) + `moreCount`; each
     chip is an `<EntityLink kind="stock" id={id}>`; `+N more` is an
     id-less `EntityLink` (Tavern → Stock, no auto-open).

2. **`PressureRibbon.svelte`:** each row is wrapped in
   `<MetricLink kind="pressure" id={p.id}>`; the existing grid `.row` lives
   inside the carrier (scoped `:global(.metric-link)` makes the carrier a
   full-width block so the grid layout is unchanged). Opens the same
   `pressures.<id>` drilldown a `PressureCard` does (AC4).

3. **`DayScreen.svelte` plan rows:** the whole `.plan-row` is clickable
   (mouse) via a row-level `onclick`; the existing right-side `<button>`
   stays as the keyboard/AT affordance (no nested-button semantics — the
   row container is a plain div). Queued-pick target labels become
   `EntityLink`s when the pick's `targetType` maps to an `EntityKind`.

4. **`DayScreen.svelte` pending tags:** the `noted: <verb>` / `ignored`
   tag becomes a button that clears the pending decision
   (`gameStore.clearSeed`), re-opening the still-rendered card's choices
   for revision before End Day (AC6).

5. **`DailyReport.svelte` resolved-intent block:** `intent.subject`
   renders as an `EntityLink` when the projection resolves it to a concrete
   entity (new optional `ReportResolvedIntent.subjectRef`), else plain text
   (AC7). The ref is populated only from a `namedEntities` entry whose
   `displayName` equals the subject and whose `ref.kind` maps to an
   `EntityKind` — never invented from prose.

6. **`WeeklyOverview.svelte`:** staff names (Staff section + unpaid list)
   become `EntityLink kind="staff"`. **`MonthlyOverview.svelte`:** top
   pressures become interactive, opening the global pressure drilldown.
   Capped to these top-level references; full line-item coverage is
   phase 195.

**Panel-side consumption:** `StaffPanel` and `StockPanel` read
`gameStore.consume{Tavern}SubviewTarget()` in a mount `$effect` and open
the matching detail sheet. Consume-once (190a) means a later tab re-entry
finds the target cleared and does not re-open (AC8).

## New pure helpers (links/types.ts)

- `entityKindFromTargetType(t: OwnerActionTargetType): EntityKind | undefined`
- `entityKindFromRefKind(k: EntityRef['kind']): EntityKind | undefined`

Both are exhaustive lookups returning `undefined` for kinds with no detail
surface (`customer_group`, `policy`, `global`, `role`, `system`, `other`,
`local_event`, `tavern_identity`).

## gameStore addition

- `clearSeed(seedId)` — read-and-remove a pending decision (mirrors
  `resolveSeed`). Transient session state; not persisted differently.

## Do not do

Per arc §"Do not do (190a + 190b)": no info icons, no auto-linking of
free-form prose, no Tavern+World consolidation, no history stack, no
persisting the transient targets. Historical economy figures in the
overviews are NOT linked to the live `coin` drilldown (would contradict
sim truth).

## Test approach

`tests/web/phase190b.consumerWiring.test.ts` (jsdom):
- the two pure mappers (target-type / ref-kind → EntityKind, incl. the
  `undefined` rejects);
- `DayScreen` morning renders coin `MetricLink`, `N staff` EntityLink,
  per-item stock EntityLinks; tapping coin opens the `coin` drilldown;
  tapping `N staff` routes to Tavern → Staff with no target; tapping a
  stock chip routes to Tavern → Stock with the item target stashed;
- `PressureRibbon` row opens the `pressures.<id>` drilldown;
- `clearSeed` removes a pending entry (pending-tag revision);
- `DailyReport` links a resolved-intent subject that resolves to staff and
  leaves a generic subject as plain text;
- `StockPanel` consume-once opens the targeted sheet on first mount and not
  on re-mount (AC8 end-to-end).

`npm test` + `npm run typecheck` green.
