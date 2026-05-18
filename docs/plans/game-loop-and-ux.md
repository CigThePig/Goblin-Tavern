# Goblin Tavern — Game Loop & UI/UX Design

> Working design, not a phase doc. Bears the same shape as `phase-01` /
> `phase-21` / `cards-contract` so it slots into the existing series, but
> nothing here is locked. Sections 8 and 9 are explicitly open.

This document picks up where `cards-contract.md` ends. The contract told
us what a card reads, what it writes, what shape it has — but it
deliberately stopped short of saying *when the player sees one, what
screen it's on, what the rest of the experience looks like around it*.
That's section 9 of the contract: "open questions for the card-layer
phase plans." This is a first pass at answering them, anchored to what
the sim actually does.

---

## 1. Reading the simulation as a player surface

The thing the player is interacting with already has a strong shape.
Treating it as a blank slate would waste the work in phases 1–86. So
before any UI decisions, let me name what the sim is already telling us:

**The day has internal structure.** `SIMULATION_PHASES` runs 25 phases
per call to `simulateDay`. The player only ever cares about three of
them as input slots — `applyOwnerActions`, `applyResponses`,
`assignStaffPriorities` — but the engine has already partitioned the
day into five **timings** that issue seeds tag themselves with:

```
morning_prep | during_service | closing | end_week | end_month
```

That's not arbitrary. It's the player's day. The UI should mirror it.

**Player input is exactly three channels, and one of them is bounded.**
`SimInput` is the whole mutation surface:

- `ownerActions` — hard cap of **3 action points per day**.
- `staffPriorities` — sticky map, defaults if omitted.
- `responseIntents` — one per same-day seed, no carry-forward.

Everything else (every wager, every relationship move, every
reputation bet) flows through those three. The "3 action points" cap is
the single most important number in the daily UX. It's the **what gets
ignored today?** lever from `phase-01-simulation-contract.md §1.4`.

**The sim already explains itself.** Every mutation carries a
`CauseEntry`. Pressures carry `topCauses`. Memories carry actors and
locations. Diffs carry `readable` text. The player should never see a
number change without being able to drill into why — the data is
already there. The UI's job is to surface it, not invent it.

**Seeds are pre-ranked but uncapped.** `rankSeeds` sorts by
`cardWorthiness → severity → urgency`. There is no hard cap on
`seedsToday`. The card layer has to choose its own cap. This is a
design decision the sim deliberately punts.

**The starting state is opinionated.** The Crooked Keg begins:

- 100 coin (rent will hurt)
- `filthy: 65, cheap: 60, goblinAuthentic: 70, tasty: 35, respectable: 25, culinary_renown: 10`
- 5 areas, 6 starter stock items, a small staff
- 9 customer groups, only `local_goblins` reliably present at this rep mix

That's not a neutral start. It's a *dirty cheap goblin dive*. The
player isn't building from zero — they're inheriting a mess. The UI
should communicate that on day one.

---

## 2. How a game starts

Two questions are entangled here: *what is a new save?* and *what does
the first session feel like?*

### 2.1 New save

The sim already produces a complete starting state from
`createInitialTavernState()`. There is no character creation,
no biome pick, no naming the tavern — the tavern is **The Crooked
Keg**, day zero, dirty, broke, goblin-authentic. That's the design and
it should stay that way. **Customization is what the player does over
weeks of play, not in a pre-game form.**

What I'd want in a new-save flow:

- One screen. One button: *Open the Tavern*.
- Optional advanced toggle (collapsed by default): seed string,
  difficulty bias, starting coin override. Hidden because none of these
  should be present-of-mind for a new player.
- No tutorial dialog. The first day's report does the introducing.

#### Amendment — 2026-05-18 (Progressive Onboarding arc)

The "no character creation, no biome pick, no naming the tavern"
decision above was correct for the pre-arc shape, where Day 1 already
ran the full 25-module pipeline and the player landed on a dense,
information-heavy screen. The judgment was: *adding a pre-game form on
top of a busy first day would compound the friction.*

The Progressive Onboarding arc (`docs/plans/progressive-onboarding.md`,
phases 99–116, ISSUE-060…ISSUE-077) inverts the underlying constraint
— Day 1 now runs a deliberately trimmed pipeline with most systems
gated — and updates this section accordingly:

- The new save flow becomes a **multi-step intro** with steps for
  naming the owner-character, naming the tavern, and picking 1–2 staff
  from a 5-candidate pool.
- "The Crooked Keg" remains the **default tavern name** (the placeholder
  on the input, accepted on empty submit). Owner-name default is
  generated via the `npc_identity` RNG stream with a reroll button.
- The flow is **skippable** — a "Skip and use defaults" affordance on
  the welcome step jumps straight to confirmation with placeholder
  values. This preserves the spirit of the original "one screen, one
  button" intent for players who don't care about naming.
- "No tutorial dialog" still holds. Each system unlock is announced by
  a one-shot **discovery card** (a regular issue-seed card, not a
  pop-up overlay) — the first-day report still does the introducing
  for Day 1 itself.

Customization is now what the player does **at the start *and* over
weeks of play**, not exclusively the latter. See
`docs/plans/progressive-onboarding.md` for the locked rules and the
unlock schedule.

### 2.2 The first session

Day one of a new save is the **state-introducing day**. There's no
existing memory, no causes, no pressures above their seeded baselines,
no regulars, no faction history. Seed generation will be sparse — most
seed families need state context the day-zero tavern doesn't have yet.

This is actually a feature. The player sees:

- The areas (5 of them, with cleanliness/damage/smell meters)
- The stock (6 items, with quantities and freshness)
- The staff (3 of them, with names, roles, morale, stress)
- The customer groups (who will visit at this rep mix)
- The reputation bars (the 9 axes)
- The pressures (low across the board, but visible)
- Coin: 100

No crises. No cards. Just *the tavern as a place*. The player picks 0-3
owner actions, assigns staff priorities (or accepts defaults), and runs
the day.

Day one ends with a **first-day report** that uses no narrative voice
but is heavier on definitions: "The Crooked Keg's main room has
cleanliness 35. Below 40, merchants notice." Tooltips earn their
keep. By day three or four the sim has enough state to start producing
seeds, and the player has had time to read the place before the place
starts producing cards.

### 2.3 Returning to a save

Mobile sessions are short. A returning player needs to be re-oriented
in seconds:

- **What day is it?** Top of screen, calendar + day-type.
- **What changed since last session?** A "since you were away" pill if
  the player closed the app mid-day, or "yesterday" summary at the top
  of morning_prep.
- **What's about to bite?** Top one or two rising pressures, surfaced
  as banner text not a card. (Pressures aren't cards.)
- **What's on the day's card pile?** Morning_prep cards stacked,
  during_service deferred until after staff/owner actions are locked.

The pillar here: **a returning player should know within five seconds
whether this session needs careful thought or is a quick clear.**

---

## 3. The day loop in detail

This section maps the player's experience onto the 25-phase engine
pipeline. The engine ordering is locked; the UI just decides when to
hand control to the player and what to render in between.

### 3.1 The five player-facing beats

Mapped to engine phases and card timings:

| Beat | Engine phases | Card timings | Player control |
|---|---|---|---|
| 1. Morning briefing | `startDay` → `forecastTraffic` | `morning_prep` | Read pressures, respond to morning seeds |
| 2. Plan the day | `beforeOwnerActions` (gate) | — | Pick owner actions (≤3), confirm staff priorities |
| 3. Service runs | `applyOwnerActions` → `afterService` | `during_service` | Resolve incidents as they appear |
| 4. Closing | `closing` → `applyResponses` | `closing` | Final resolutions, end-of-day choices |
| 5. Report | `endDay` → `advanceCalendar` | `end_week`, `end_month` (on those days) | Read, drill in, then "Next Day" |

The player's day is **five screens, not 25 phases**. The engine
phases compress into "what shows up before/during/after the service
period."

### 3.2 Beat 1 — Morning briefing

What loads first when the player opens the app on a fresh day:

- **Day header.** `Day 14 · Week 2 · Month 1 · Market Day` (the
  day-type comes from `applyDayTypeModifiers`). Calendar tags affect
  customer turnout, so day-type belongs visible.
- **Pressure ribbon.** Top 3 rising pressures with current value and
  trend arrow. Tap to expand. The ribbon is the early-warning system —
  it's how the player learns to act on `food_safety` at 55 before it
  hits 70 and produces an inspection seed.
- **Morning seeds.** The `morning_prep` cards from `seedsToday`,
  filtered to `validation.valid === true`, sorted by
  `cardWorthiness`. Capped at **3 visible**; overflow goes into a
  "more matters today" affordance.
- **Coin / staff / stock at-a-glance.** A single line: `100c · 3 staff
  · ale 12 stew 8`. Tap to expand each.

The player either resolves these cards now or defers them by tapping
**Plan the day**. Deferred cards remain available until `closing` (a
"during_service" card doesn't have to be played before service starts —
the sim doesn't care when within the day the `responseIntent` is
collected, only that it's in the call to `simulateDay`).

### 3.3 Beat 2 — Plan the day

This is the planning screen. Two interactions:

**Owner actions (≤3).** A drawer/sheet that lists available actions
filtered by what the sim says is currently valid (`getValidTargets`
per action). The 4 categories give a natural tab grouping:

- **Immediate** (clean, repair, restock, adjust prices, patch roof,
  fumigate cellar, pay bonus, water ale, improve stew, buy mugs)
- **Project** (start_*: booths, hearth, rat-proof, music, stew pot;
  plus fund/cancel for active projects)
- **Policy** (toggle on/off: tabs, discounts, weapon bans, payday
  specials, festival close)
- **Social** (comfort staff, apologize, negotiate, warn group, host
  faction night)
- **Staff** (hire, fire, ban group)

The "3 points" budget is a sticky chip at the bottom: `Action points:
2 / 3`. Adding a fourth attempt shows the picker disabled with reason
"budget full." Cost varies by action; the sim already enforces it, the
UI just previews.

**Staff priorities.** A row per staff member: name, role, current
morale/stress mini-bars, priority dropdown (filtered to the role's
`allowedPriorities`). Sticky between days; only re-engages the player
when something changes. By default it's collapsed under the day header
unless the day type makes it relevant (Brawl Night, Inspection-likely,
etc.).

The "Run Service" button is at the bottom. Tapping it locks owner
actions and staff priorities and moves to Beat 3.

### 3.4 Beat 3 — Service runs

This is the most-asked-about beat in any tavern game design and worth
being explicit:

**The sim resolves service in one engine call.** It does not run in
real-time. The player doesn't watch customers fill the tavern. By the
time the player sees "during_service" cards, service has *already
happened in the model* — the cards are revealing what occurred, with
response slots that affect the **same day's** end-of-day pipeline.

So Beat 3 visually is: a short progress-style transition (1-2 seconds
of animation max — not loading, *pacing*), then a sequence or stack of
during_service cards. Each card resolves to a `ResponseIntent` (or
"ignore" — which is also a valid intent shape).

Design call I'd make: **during_service cards arrive as a vertical
deck**. The player swipes/taps through them one at a time. This
matches the seed `timing` semantics — they're temporally located within
service — and reads better on mobile than a list. A counter shows
`2 of 4`.

**Open question:** does the player see preview effects from
`ConsequenceProfile.immediateEffects` before choosing? I'd say yes,
abbreviated (3 lines max per choice), because the sim already produces
them and hiding them is hiding the simulation. Crown & Council's
clarity wins apply.

### 3.5 Beat 4 — Closing

`closing` timing seeds + `applyResponses` phase. This is where:

- Staff-burnout seeds tend to land
- End-of-day customer complaints surface
- The last owner-action effects are still in scope

UI is identical to Beat 1 (morning briefing) in shape — a stacked list
of card-shaped seeds, plus an "End Day" button. The visual difference
is tonal: dimmer, evening-coded; the day-header pill shows a moon or
similar low-cost cue.

### 3.6 Beat 5 — Report

The daily report screen. This is where causality lives.

Layout:

- **Header line.** "Day 14 closed. Coin 92 → 108 (+16). Reputation:
  +2 tasty, −1 filthy."
- **Diff section.** Top significant changes from `TaggedStateDiff`
  with boundary `day`. Filtered by significance thresholds from
  `diff.ts:DEFAULT_THRESHOLDS`. Each line shows the readable string
  and tags. Tap to expand causes.
- **What happened.** A digest of `ReportSection`s — owner_actions
  applied, service summary, staff performance, stock movement, any
  responses resolved. This is where the per-module `lines[]` shine.
- **What's building.** Rising pressures (any pressure with `trend > 0`
  that crossed a threshold today). Tap into a pressure to see
  `topCauses[]`.
- **What might happen.** A subtle slot for `future_hook` memories
  created today — "the cook remembers being skipped for the bonus." Not
  prescriptive, just present.

End with **Next Day**. One tap, no confirmation. On `end_week` and
`end_month` days, the Next Day button is replaced with **Close the
Week** / **Close the Month**, and tapping it takes the player to those
respective overview screens (see §4) before returning to a fresh
morning briefing.

### 3.7 The "skip-light-day" pattern

If a day has zero morning seeds, zero during_service seeds, and zero
closing seeds, the player is mostly being asked to confirm staff
priorities and pick (or skip) owner actions. That's still meaningful —
the **decision not to spend** is a real decision — but the friction
budget should be tiny. A "Quick Day" button that runs with no owner
actions and inherited staff priorities makes light days a single tap.
The sim still produces a daily report; the player still sees the
diff. They just don't have to *interact* with planning if nothing's
on fire.

---

## 4. The week and month layers

A day is the gameplay unit, but the *meaningful* unit is longer. The
sim already knows this — `endWeek` and `endMonth` phases only run on
the last day of week/month respectively, and produce dedicated
`ReportSection`s plus `end_week` / `end_month` seeds.

### 4.1 Week (every 7 days)

The week is where **routine** becomes visible. Wages get paid.
Supplier invoices clear. Maintenance backlog gets totalled.
Customer-group loyalty trends. Inspection suspicion ticks. Rumours
spread.

A weekly screen interjects between Beat 5 (Saturday report) and Beat 1
of the next day:

- **Weekly digest.** The `weekly` report section's headline lines.
  Earnings, expenses, net.
- **Trend strip.** Per-customer-group loyalty trend over the week.
  Per-staff morale/stress trend. Per-area condition trend. Mini
  sparklines if budget allows; otherwise arrows + delta.
- **Wages due.** A row per staff: amount, "Pay" / "Defer" / "Skip"
  buttons. (Skip incurs the loyalty hit the sim already models.)
- **Supplier invoices.** Same shape. Each supplier's reliability and
  current relationship is shown alongside.
- **end_week cards.** Surfaced inline after the digest, not before.
  Players read the week before they choose to respond to its shape.

The weekly screen is **read-heavy**. Most weeks the player makes 0-2
decisions on it. Don't fight that — the value is in seeing the pattern.

### 4.2 Month (every 28 days)

The month is where **identity** becomes visible. Rent hits. Landlord
patience updates. Inspection windows open. Rival tavern pressure
recalibrates. Long-running pressures roll up. Local arcs advance
stages.

A monthly screen has more weight than the weekly one:

- **Identity strip.** The reputation profile rendered as a horizontal
  bar chart across the 9 axes. Compare-to-last-month deltas. This is
  the first place the *tavern identity* (Cheap Goblin Dive → Filthy
  But Beloved → Suspiciously Respectable Inn) becomes legible to the
  player. The sim doesn't assign a label; the chart shows the shape
  and the player reads it themselves. (See §9 for the "do we ever
  assign a label" question.)
- **Rent + landlord.** Big, can't-miss. Pay / negotiate / defer.
- **Inspection status.** If a window opened this month, surface it
  here with the suspicion meter and what's contributing.
- **Pressures rollup.** The 21 pressure ids ranked by value. Top 5
  visible; rest collapsed.
- **Active arcs.** Any `LocalEventWorldState` with `stage` set.
  Surface stage, recent transitions, and pending choices.
- **end_month seeds.** As `monthly_review` cards. These are the
  strategic-tier cards — fewer choices, longer-time-scale effects.

### 4.3 Year (every 12 months — late-game-only relevance)

The sim has year-aware seasonal arcs. I would *not* build a yearly
overview screen in the first card-layer pass. By the time the player
hits day 336, they have a memory + history layer rich enough to read
the year in retrospect — `state.history` is append-only and tagged.
A "Tavern Log" screen filtered by year covers this with no special UI.

---

## 5. Early / mid / late game arc

The sim doesn't have discrete game phases — it's continuous. But three
*experiential* phases emerge from the systems already in place:

### 5.1 Early game — Days 1–~28 (Month 1)

**The player is learning the tavern they inherited.**

What the sim provides:

- Sparse seeds (most expanded families need state context that doesn't
  exist day-zero — no regulars yet, no faction history, no rumours).
- Steady pressure rise on `food_safety`, `maintenance`, `pests` — the
  natural decay vectors.
- First rent hits at end of Month 1. Coin 100 means rent must already
  be a player concern from Day 1.
- First weekly cycle introduces the wages/suppliers rhythm.

What the player learns:

- The 4 action categories and the 3-point budget.
- That pressures rise *before* they bite.
- That ignoring a thing has consequences but so does spending on it.
- That the daily report is where understanding lives.

What the UI should do *more* of in this phase:

- Show inline definitions on tap. "What is food_safety?" → a sentence
  + the pressure's `topCauses` rendered inline.
- Surface the "you could have done X" affordance on the daily report.
  Not in a punishing way — "Yesterday's repair would have prevented
  this" educates without nagging.
- Withhold late-game noise. Don't show the faction screen if no
  faction memory exists yet. Progressive disclosure.

### 5.2 Mid game — Days ~28–~120 (Months 2–4)

**The player is shaping the tavern.**

What the sim provides:

- First regulars emerge (`RegularWorldState` with `firstSeenDay`
  populated). They have names. They show up across multiple seeds.
- Projects come online as the player accumulates coin. Private booths
  unlock different customer-group satisfaction profiles.
- Policies start mattering — `cheap_payday_specials` on payday creates
  a tradeoff with cleanliness; `ban_weapons_inside` shifts adventurer
  vs merchant traffic.
- Suppliers form `relationship` meters that gate `supplier_offer`
  seeds.
- First `inspection_threat` seed lands somewhere here, depending on
  pressure trajectory.

What the player learns:

- That patterns of decision form an identity. Watering ale 3 weeks
  running creates a `policy_backlash` pressure.
- That some seeds are *about* the player's reputation, not about a
  fire that needs putting out.
- That the same situation plays differently depending on prior memory
  and pressure state.

What the UI should do in this phase:

- Begin surfacing the **Regulars** screen — names + visit counts +
  irritation/loyalty meters.
- Promote the **World** screen — cultures, factions, suppliers — to
  primary nav once entities populate it.
- Surface `attribution` data — who thinks what about whom — in
  ambient ways. A regular's card now shows "thinks the cook is
  reckless (false belief)" if state holds that attribution.

### 5.3 Late game — Days 120+ (Month 5 and beyond)

**The player is maintaining a known thing.**

What the sim provides:

- Multi-day local arcs (`LocalEventWorldState` with `arcHistory`).
- Rival tavern pressure as a directed force.
- Festival readiness for seasonal arcs.
- Rumour systems carrying false/partial beliefs that take weeks to
  resolve.
- Monthly review seeds that aggregate trends across the last 28 days.

What the player learns:

- Their identity is now legible — both to them and to the in-world
  factions/cultures.
- Decisions have longer event horizons. Cancelling a project mid-build
  feels real; not investing in maintenance compounds over months.
- The game gets *slower* in beats and *deeper* in stakes.

What the UI should do:

- Lean into the report layer. The daily report's "what's building"
  section becomes the most-read screen. Tooltips on causes get heavy
  use.
- Begin offering **History** as a top-level surface — `state.history`
  is append-only and tagged, perfect for filterable timelines.
- The week and month screens become primary; daily becomes routine.

### 5.4 What's not an arc

Worth saying explicitly: **there is no win condition in the sim**.
There's bankruptcy (negative coin past a tolerance, eviction by
landlord, etc.) but no "you won." The late game is the late game
forever, unless the player ends it themselves. That's a design
strength — the system supports continuing past where most management
games run out of content — but the UI should not pretend otherwise.
Don't ship a "scoring" screen. Ship a *legibility* screen.

---

## 6. Screens and navigation

A first-pass screen map. Top-level destinations are bold; nested
screens are indented.

**Day** — the default landing screen. Renders one of the 5 beats from §3.
This is where the player spends 80%+ of their session time.

  - *Card resolution drawer* — pulled up when a card is tapped.
    Full-height sheet showing the card, all choices with previews,
    and a back-out option.

  - *Action picker drawer* — invoked from Plan the day. Tabbed by
    action category. Search affordance.

  - *Staff priority sheet* — invoked from Plan the day. Per-staff
    rows.

**Reports** — a browser over `ReportSection`s, with a date filter.
Sections shown:

  - Daily report (today; tap into past days from the calendar)
  - Weekly digest (most recent + previous)
  - Monthly digest (most recent + previous)
  - Pressures dashboard — all 21 pressures with current value, trend,
    top causes. The diagnostic screen.
  - Reputation profile — the 9-axis bar chart with month-over-month
    history.
  - Tavern Log — `state.history` rendered as a tag-filterable
    timeline.

**Tavern** — state-as-place. The premises. Five sub-screens, one per
top-level state group:

  - *Areas* — list of `AreaState`s with their meters. Tap to see
    related memories, recent owner actions, traits, upgrades.
  - *Stock* — current inventory + freshness + recent ledger entries.
    Reorder shortcuts.
  - *Recipes* — `RecipeState`s. Which dishes the kitchen can produce,
    ingredient gates, current quality modifiers.
  - *Staff* — roster + identity + morale/stress + recent performance.
    Hire/fire affordances.
  - *Projects & Policies* — active `OwnerProjectState`s with progress
    bars; enabled `OwnerPolicyState`s with toggle controls.

**World** — state-as-people-and-relationships. Hidden until populated;
becomes a top-level tab once any of these slots has >0 entries:

  - *Regulars* — named regulars with loyalty/irritation meters,
    favourite stock, visit counts, recent incidents.
  - *Suppliers* — relationship meters, reliability, recent
    deliveries.
  - *Factions* — relationship/influence/trust/fear meters per
    faction.
  - *Cultures* — comfort/tension meters per culture.
  - *Notable NPCs* — named NPCs the sim has surfaced (e.g.
    inspectors, landlord, faction leaders).
  - *Rumours* — active `SocialRumourState`s with accuracy and reach.

**More** — settings, save management, debug.

  - Save & restore (autosave per day; manual snapshot slots)
  - Difficulty / seed
  - Display preferences (tone, font size, animation toggles)
  - Debug (dev only) — raw state inspector, seed-rejection log,
    pressure calculator output

### 6.1 Default tab bar

For mobile, a 4-tab bar at the bottom is the natural fit:

```
[ Day ] [ Reports ] [ Tavern ] [ World* ]
```

`World` becomes the 4th tab once the world has surfaced anything;
until then, the 4th slot is `Tavern Log` (a slice of Reports).
Settings/More lives behind a top-right gear or a long-press on the
Day tab — it's not high-frequency enough to occupy the bar.

### 6.2 What the screen map intentionally omits

- **Marketplace / shop screens.** Suppliers aren't a shop — they're
  relationships. Buying stock is an owner action targeting a supplier,
  not a separate "store" UI.
- **Quest log.** Local arcs and active issue seeds are the closest
  analogue. They live in their natural surfaces (World > Arcs and
  Day > current seeds).
- **Achievement screen.** The sim doesn't track achievements. Tavern
  identity emerges from reputation; that's its own surface.
- **Stats / scoring screen.** Reputation profile + history + pressures
  dashboard *are* the stats screen, distributed across surfaces.

### 6.3 The card UI itself

`CardView` from the contract has four parts: `title`, `body[]`,
`stakes[]`, `choices[]`. A first-pass render:

```
┌───────────────────────────────────┐
│ TITLE                       [tag] │
│                                   │
│ body line 1                       │
│ body line 2                       │
│ body line 3                       │
│                                   │
│ STAKES                            │
│  ↓ readable loss                  │
│  ↑ readable gain                  │
│  ⚠ readable risk                  │
│                                   │
│ ┌─────────────────────────────┐   │
│ │ Choice 1 — verb · shape     │   │
│ │  preview · preview · preview│   │
│ └─────────────────────────────┘   │
│ ┌─────────────────────────────┐   │
│ │ Choice 2 — ...              │   │
│ └─────────────────────────────┘   │
│                                   │
│ [Tap a choice]            [ignore]│
└───────────────────────────────────┘
```

Notes:

- The `[tag]` slot in the corner shows seed `family` or `type` — a
  scannable handle the player learns to recognize ("food_safety" =
  "the dirty stew one"). Optional / toggleable.
- The `stakes` icons (`↓` `↑` `⚠`) map to `direction` `loss` / `gain`
  / `risk`. This is the only place I'd add iconography that isn't in
  the seed data — the contract gives `direction` typed, the icon is
  just a render hint.
- Choices show **verb** and **shape** as small metadata under the
  label. `safe_costly` / `risky_profitable` are real player-facing
  information; the contract calls them "tone" but I'd surface them as
  text-tags. They teach the system.
- `[ignore]` is *always* an option. The sim treats ignore as a valid
  intent. Hiding it forces the player to fake-pick.
- `disabledReason` from `CardChoice` is rendered in-line on the
  disabled choice, italicized: "*Not enough coin to bribe.*"

---

## 7. Mobile-first considerations

You build mobile-only, so this isn't a "scale down later" question.
Some specifics for this game on a phone:

### 7.1 Thumb zone

The "Run Service" / "End Day" / "Next Day" button is the most-pressed
control in the game. It belongs in the bottom 25% of the screen,
right-leaning for right-handed thumbs, with a comfortable margin from
the OS gesture bar. Test on a 6.7" screen; that's where errors start.

### 7.2 Vertical density

The pressure ribbon, stakes section, and choice previews want to be
*dense but readable*. Aim for 16-17pt body, 13-14pt tags, no smaller.
Tap targets minimum 44pt tall (Apple HIG) / 48dp (Material). The
"action point: 2/3" chip wants to be sticky so the player never
forgets it while picking.

### 7.3 Sheets vs full screens

Two-handed phones make modals risky. Use **bottom sheets** for:

- Card resolution
- Action picker
- Staff priority
- Pressure detail
- Stock-item detail

Use **full-screen pushes** for:

- Reports (need full width for diff tables)
- The week and month overview screens
- Settings

### 7.4 Long sessions vs short sessions

Players will run the app in both modes. A short session is "open,
clear a day, close" (~60-90s). A long session is "binge a week or
two" (10-20min). The UI should not punish either:

- No mandatory animations longer than 200ms.
- No "pulled-away" interrupts. If the player closes the app mid-day,
  reopen on the exact same beat.
- Quick Day button (see §3.7) for skip-light days.
- Autosave on every `simulateDay` result.

### 7.5 Notifications

A specific question worth flagging: **does the app push notify between
sessions?** Tempting (rent is due, inspection imminent) but invasive,
and the sim doesn't run while the app is closed. The honest answer is
no — push a notification only for daily-engagement reminders the
player explicitly opts into, never for in-fiction events.

### 7.6 Visual tone

The sim is text-heavy, but text-only is a stylistic choice you can
make or refuse. A few options:

- **Pure typographic** — Crown & Council style. Fast, mobile-clean.
  Works for the sim's voice.
- **Light illustration** — header art per area, woodcut-style icons
  for stock, named portraits for staff/regulars (silhouettes initially,
  fillable later). Adds production cost.
- **DOS-text-game aesthetic** — monospace, ASCII art, no colour
  except status. Punk but limits readability on small screens.

My instinct: pure typographic plus icon set, save the illustration
budget for portraits when regulars and notable NPCs emerge. The
sim's strength is *causality* — players reading meaningful prose —
and visual noise competes with that.

---

## 8. Decisions this doc commits to (provisionally)

Worth listing the calls I made above so future plans can challenge
them as one set:

1. **3 action points is the hero number.** It stays visible on the
   planning screen and in the action picker. Everything else
   negotiates around it.
2. **5 player-facing beats per day**, not 25 phases. Morning briefing
   → plan → service → closing → report.
3. **No tutorial dialog.** The first-day report does the introducing.
4. **Cards arrive as a stacked deck on relevant beats**, not a
   notification feed and not all-at-once.
5. **Ignore is always an option**, rendered as a button on every
   card.
6. **Mobile primary nav is 4 tabs**: Day, Reports, Tavern, World
   (with World hidden until populated).
7. **Quick Day pattern** for sessions with no live seeds.
8. **No win condition surfaced.** No score screen.
9. **No push notifications for in-fiction events.**
10. **Pure typographic visual baseline**, saving illustration budget
    for portraits when entity rosters justify them.

If any of these feels wrong to you, the rest still stands — they're
mostly orthogonal.

---

## 9. Open questions for the first card-layer phase plan

These need answers before the first card ships. They're the design
questions Section 9 of `cards-contract.md` flagged plus the ones that
came up while writing this doc.

### 9.1 From cards-contract §9 (still open)

- **Where does `cardRegistry` live?** `src/sim/registries/` or a new
  `src/cards/` slice. The sim-vs-cards boundary suggests the latter.
- **Selection algorithm.** When multiple cards match one seed, who
  wins? Highest `priority`? Longest `appliesTo` predicate? Oldest
  registration? Suggest: priority desc, then specificity desc, then
  id asc.
- **Render target.** Text-first to terminal (matching headless
  precedent), or straight to a web/mobile UI shape? If this game is
  going to be web-based-mobile-first, the answer might be "skip the
  terminal renderer and go straight to a JSX `CardView` consumer."
- **Tone/presentation pipeline.** What consumes `toneHints`?
- **Card ↔ owner-action surface.** Are owner actions card-shaped or
  is the action picker its own UI? I lean *its own UI* — the picker
  shape doesn't fit the card mould, and forcing it warps both.

### 9.2 Card timing and volume

- **Per-day card cap.** No hard cap in the sim. What does the UI
  enforce? Suggest: 3 visible per timing slot, with an "X more
  matters today" affordance for overflow. The overflow surface needs
  spec.
- **Seed dropout when player ignores everything.** If the player
  taps "End Day" without resolving morning seeds, do they auto-pass?
  Currently the sim treats absence-of-intent as ignore-equivalent
  for that day; do we re-surface the seed tomorrow if it stays
  valid? (Sim says no — seeds are same-day only.)
- **During_service deck order.** `cardWorthiness` first or
  `severity` first? They diverge in practice — a low-severity
  high-novelty seed outranks a routine high-severity one. The sim
  ranks by cardWorthiness; UI should match.
- **End_week and end_month cards' relationship to the
  weekly/monthly screens.** Inline with the digest, or after the
  digest reveals? After-digest feels right — context first, choices
  second.

### 9.3 Owner actions

- **Should the action picker preview effects?** The sim doesn't
  precompute action effect previews the way it does for seed
  `ConsequenceProfile`s. Adding previews requires either dry-running
  the action (expensive) or annotating each `OwnerActionDefinition`
  with a static preview string (cheap, less accurate). Suggest the
  static-preview annotation.
- **Action ordering within a category.** Most-recently-used?
  Alphabetical? Sim-relevance-sorted? Most-recently-used surfaces
  the player's habits — the *what kind of tavern is this* signal.
  Suggest that, with an alphabet jump option.
- **What about projects/policies as their own surface?** They
  *also* live in `Tavern > Projects & Policies` for ongoing
  inspection. Starting a project is an owner action; managing one
  is browsing that screen. The two surfaces overlap and should
  agree on canonical state without duplicating UI.

### 9.4 First-time experience

- **How much of the sim do we explain inline?** Some terms
  (pressure, cardWorthiness, attribution) are domain-specific.
  Tooltips on first encounter, dismissable, never auto-popped after
  day 7?
- **Should day 1 force the player to take an owner action?** I say
  no — let them open and close day 1 with zero actions if they
  want. The friction is the point.
- **Does the daily report ever annotate "you could have done X"?**
  This is the kind affordance that teaches without nagging. The sim
  can compute it from cause data, but it'd need a deliberate
  "missed-opportunity" calculator. Worth flagging.

### 9.5 The identity question

This one's load-bearing. From `phase-01 §1.6`:

> The simulation should support these identities through state and
> behaviour, not by assigning a superficial class label.

So the sim deliberately doesn't compute "you are now a Filthy But
Beloved Local Hole." But the *player* needs some legibility into
what their tavern is becoming, or the monthly identity question
becomes ungrounded.

Options:

1. **Pure profile** — show the reputation bars + memory tags + named
   regulars and let the player synthesize.
2. **Identity hints** — surface unranked, non-prescriptive
   adjectives ("respected by miners; feared by merchants;
   nicknamed 'the soup hole' by locals") computed from state
   patterns. Closer to what attributions enable.
3. **Soft labels** — at month boundaries, *if* the reputation
   profile clusters cleanly enough, show a tentative label
   ("Trending: Filthy But Beloved"). Risk: feels like a class
   assignment.

I'd push for option 2 — closest to the simulation's voice and
adjectives can compose without locking the player in.

### 9.6 Save shape and migration

The sim already has `migrations.ts`. The card-layer adds card
*registrations* but not card *state* — cards are pure functions over
`(seed, state)`. So the save shape doesn't gain a card slice, which
is correct.

But: **does the player's response intent history matter beyond
same-day?** Probably yes — the sim does store applied
`OwnerActionApplied`s, resolved intents in
`state.modules.responses`, and aged memories. Surfacing this history
across saves is the Tavern Log job, not the card layer's.

### 9.7 The voice question

The sim produces "text ingredients" with strict word budgets, not
prose. Card templates compose these into card body lines that look
like "the kitchen smells faintly of cellar pests" — which is fine,
correct, and a little dry. Is anyone writing the *voice*?

The contract forbids cards from inventing facts. It does not forbid
*style*. A card may choose between two literal compositions of the
same ingredient set, picking the one that has more goblin in it.
Some thought should go into the style layer between the ingredient
composition and the player. Worth a tiny dedicated content pass once
the rendering pipeline exists.

---

## 10. Suggested next-step phase plan

If this design is roughly right, the first card-layer phase plan
(provisionally phase 87) should:

1. Land `cardRegistry: Registry<CardDefinition>` in `src/cards/`.
2. Pick a selection algorithm and write it down.
3. Stub the 8 starter card templates from
   `cards-contract.md §7` against the registry.
4. Ship a minimal `Day` screen that runs the 5 beats with stubbed
   cards (terminal render is fine for the first iteration; the
   screen-to-renderer adapter can land in phase 88).
5. End-to-end test: open a fresh save, run 7 days, never crash, see
   one card per applicable seed.

UI screens (sections 4 and 6 above) are larger work; they earn their
own phase per top-level destination. A pass-by-pass roadmap might be:

- **Phase 87** — card layer foundation (registry, selection, 8
  templates, basic Day renderer).
- **Phase 88** — Day screen, all 5 beats, mobile-shaped.
- **Phase 89** — Reports screen + Daily Report layer.
- **Phase 90** — Weekly digest screen.
- **Phase 91** — Monthly overview + reputation profile.
- **Phase 92** — Tavern screen group (areas, stock, recipes, staff,
  projects/policies).
- **Phase 93** — World screen group (regulars first; the others
  light up as state populates).
- **Phase 94** — Tavern Log / history filter.
- **Phase 95+** — voice/style pass, polish, illustration tier.

Roughly 8-10 phases to ship the experience. Probably more in
practice given how phase 41–86 expanded — but the *shape* is small
enough to commit to.

---

## Appendix — quick reference tied to existing files

So this doc has receipts:

- Engine entry: `src/sim/core/engine.ts:1460` — `simulateDay`
- Phase pipeline: `src/sim/core/phases.ts:60` — `SIMULATION_PHASES`
- Input shape: `src/sim/core/context.ts:62` — `SimInput`
- Card contract: `docs/plans/cards-contract.md` — locked
- Vision: `docs/plans/phase-01-simulation-contract.md` — locked
- Card templates: `cards-contract.md §7` — 8 scaffolds
- Owner actions: `src/sim/registries/actionRegistry.ts` —
  `actionRegistry`
- Action categories: `src/sim/modules/ownerActions/types.ts:40` —
  `immediate | project | policy | social`
- Pressures: 10 core + 11 expanded, listed in
  `cards-contract.md §3.6`
- Seed timings: `src/sim/modules/issues/issueSeedTypes.ts:19` —
  the 5 timing slots
- Starting state: `src/sim/state/defaults.ts:620` —
  `createInitialTavernState`
- Reputation axes: `defaults.ts:221` — the 9 starting axes
