# Phase 192 / ISSUE-159 — TopBar stakes reframe

Implementation record for the arc entry in
`docs/plans/ui-ux-intuitiveness-arc.md §Phase 192`. Read that section for
the goal, full acceptance criteria, and the "Do not do" list — this file
records the concrete decisions made while implementing.

## Goal (recap)

Turn the topbar from a calendar chronicle (`Day 1 · Week 1 · Month 1 ·
<day-type>`) into a **stakes summary** — the one element on every screen.

New shape:

```
[mark]   Day 1 · <top pressure chip | "tavern steady">   [coin] [time] [?]
                  (day chip → calendar peek popover)        (badge only when non-normal)
```

## Decisions

### Top pressure = the #1 PressureRibbon row (shared helper)

The arc says the topbar chip "uses the same #1 row from `PressureRibbon`'s
logic". To keep a single source of truth (no drift between the ribbon and
the topbar), the inline ribbon selection is extracted to a pure helper:

- New `web/src/lib/sim/topPressures.ts` — `topPressures(pressures, limit=3)`
  returns the same filter (`value >= 10 || trend !== 0`) + sort
  (`value desc, |trend| desc`) + slice the ribbon used inline.
- `PressureRibbon.svelte` now calls `topPressures(..., 3)`; output is
  byte-identical, so the phase-191 ribbon tests stay green.
- `TopBar.svelte` calls `topPressures(..., 1)[0]`.

When there is no #1 row (no pressure rising or notable), the center
renders `tavern steady` in `var(--text-dim)` italic. One pressure is the
maximum — the topbar is a summary, not the ribbon dashboard.

The chip is a `MetricLink kind="pressure" id={top.id}` so a tap opens the
same `pressures.<id>` `CauseDrilldown` a ribbon row does. Renders
`<label> <value> <trend-icon>` (e.g. `Food Safety 67 ↑`).

### Day-type badge: shown only when non-normal

The `DayType` union has no literal `'normal'`; `quiet_day` is the
unremarkable baseline ("reduces chrome on quiet days" — arc). So the badge
is omitted when `dayType === 'quiet_day'` (`BASELINE_DAY_TYPE`) and shown
inline otherwise. The badge keeps its glossary `TermLabel`, so its
definition stays reachable both inline and from the calendar peek.

### Calendar peek popover

The `Day N` ordinal becomes a tap target opening a small inline popover
(modelled on `FirstEncounterHint`, not a `BottomSheet` — it is a tiny
glance, not a sheet). It shows:

- Full date string: `Day N · Week N · Month N`.
- Day-type `TermLabel` (label + glossary definition on tap).
- Days until end-of-week / end-of-month milestone (or "today" when the
  day *is* the milestone). Cadence constants (`DAYS_PER_WEEK = 7`,
  `DAYS_PER_MONTH = 28`) are mirrored locally with a comment — the
  calendar module does not export them and this phase is web-only.

Dismiss on outside-click / Escape / re-tap. Inline `$state` — not
persisted.

### Time-remaining chip (the time economy, not AP)

Right side, after coin:

- Value = `formatDuration(DAY_MINUTES − minutesQueued)` — the day's
  remaining minutes from the phase-186 time economy. No "AP X/3".
- Beat gating (arc criterion 6):
  - `report` → **hidden**.
  - `morning` → shown, **non-interactive** (a `<span>`, planning hasn't
    begun).
  - `plan` / `service` / `closing` → shown, **interactive** `<button>`;
    tapping opens the `ActionPicker`.

### Opening the ActionPicker from a global topbar

The `ActionPicker` open-state is screen-local (`DayScreen`/`TavernScreen`/
`WorldScreen` each own a `pickerOpen`). The topbar is global, so the chip
needs a one-shot cross-component signal. Added — additively, transient,
**not persisted** (a routing hint like the 190a sub-view targets):

- `gameStore.actionPickerRequested` (`$state(false)`) +
  `requestActionPicker()` (sets the flag and routes to `'day'`) +
  `consumeActionPickerRequest()` (read-and-clear).
- `DayScreen` consumes it in a mount/reactive `$effect` to set
  `pickerOpen = true`. Consume-once, mirroring the sub-view-target
  pattern. This is the only file outside `TopBar.svelte` touched beyond
  the shared helper; it is the minimum needed to honour "opens
  ActionPicker on tap".

### Welcome-back pill (Phase 96) preserved

Still rendered below the day line on first morning after a ≥4h-gap
reload, still dismisses on tap and on the 30s App timer / first beat
advance. Unchanged behaviour.

## Files

- `web/src/lib/sim/topPressures.ts` — new pure helper.
- `web/src/lib/components/PressureRibbon.svelte` — use the helper (no
  behaviour change).
- `web/src/lib/components/TopBar.svelte` — the reframe.
- `web/src/lib/sim/gameStore.svelte.ts` — transient picker-request flag +
  two methods.
- `web/src/lib/screens/DayScreen.svelte` — consume the picker request.
- `tests/web/phase192.topbar.test.ts` — new.

## Test approach

`tests/web/phase192.topbar.test.ts` (jsdom):

- **Center branching:** a planted top pressure renders its `MetricLink`
  chip (label + value); with no pressures the center reads `tavern
  steady`. No `Week N · Month N` inline.
- **Pressure chip is a working MetricLink:** tapping opens
  `pressures.<id>` on the global `drilldownStore`.
- **Badge visibility:** `quiet_day` omits the badge; a non-baseline type
  renders it.
- **Calendar peek:** tapping the day chip opens the popover (full date +
  milestone line); a second tap / Escape closes it.
- **Time-chip beat gating:** hidden in `report`; a non-interactive `span`
  in `morning`; an interactive `button` in `plan`/`service`/`closing`,
  and tapping it sets the picker request.
- **Welcome-back pill** still renders when the just-loaded flag + last
  saved timestamp are set.

`npm run typecheck` + `npm run check` (svelte-check) green; targeted
file + the phase-191 ribbon tests green.

## Do not do (from the arc — restated)

- Keep the day ordinal; never surface more than one pressure; no chip
  change animation (quiet fade only); don't alter `TermLabel` on the
  badge; no consequence lines in the topbar; no action-point language.
