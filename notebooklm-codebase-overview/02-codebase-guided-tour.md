# Goblin Tavern — A Guided Tour of the Codebase

*For someone curious about how the project is actually put together. You don't need to be a programmer — file paths are explained in plain language as we go.*

## How to read this tour

Think of the project as a building with three floors:

1. **The basement — the simulation engine.** The hidden machinery that runs the tavern. This is most of the project.
2. **The ground floor — the card and report layer.** This turns what's happening in the basement into readable situations and summaries.
3. **The shop front — the web interface.** The actual screens you click through to play.

Holding it all together are **planning documents** (the blueprints) and **tests** (the inspectors who check everything works). We'll visit each.

A note on scale, so the rest makes sense: the project is roughly **101,000 lines of simulation/game code across about 575 files**, plus **another ~79,000 lines in over 230 test files**, a **15,000-line web interface**, and **over 100 planning documents**. This is a large, mature codebase, not a weekend prototype.

---

## The basement: the simulation engine

### `src/sim/` — the heart of everything

This folder is the tavern's brain. Everything about how the tavern *behaves* lives here, and it's written to be completely self-contained: it has no idea there's a screen or a player. It just knows how a tavern works. That separation is deliberate and is one of the project's core rules.

### `src/sim/core/` — the engine room

This is the small set of files that actually *run* a day.

- **`engine.ts`** is the single most important file in the simulation. It contains `simulateDay()` — the function you call to advance the tavern by one day. You hand it the current state of the tavern and the player's decisions; it hands back the new state, a set of reports, a record of what changed, and any new situations that need the player's attention.
- **`phases.ts`** lists the ordered steps a day goes through — there are around two dozen of them, from "start of day" through customers arriving, staff working, service happening, money being counted, problems being detected, and finally the calendar ticking over. Each of the tavern's systems plugs into the steps it cares about. It's like a daily checklist the whole town runs through together.
- **`rng.ts`** handles randomness — but a special, controlled kind (more on this in the "interesting systems" document). The key idea: the same starting seed always produces the same results, so the game is perfectly replayable.
- **`effect.ts`** and **`diff.ts`** describe *changes* — what a decision does to the tavern, and how to compare "before" and "after" so the game can show you what shifted.

### `src/sim/state/` — what the tavern *is* at any moment

- **`TavernState.ts`** is the definition of the tavern's entire condition at a single point in time. It's worth listing what it tracks, because it shows how much detail the simulation holds. In one snapshot, the tavern knows: its **areas** (rooms, with cleanliness, damage, smell, atmosphere); its **stock** (ingredients, with quality and spoilage); its **recipes**; its **staff** (with morale, stress, fatigue, loyalty, skill, and personality); its **customer groups**; its **reputation** across ten different qualities; its **money**; a whole **world** of suppliers, factions, cultures, regulars, notable townsfolk, travelling adventurers, expeditions, local events, and rumours; its **memories**; its **history**; its **causes** (the *why* behind changes); and its **pressures** (the slow-building problems). Everything is plain, saveable data — which is what makes saving, loading, and replaying reliable.
- The other files here (`schemas.ts`, `validation.ts`, `migrations.ts`, `difficulty.ts`) make sure a saved tavern is always valid and consistent, and handle upgrading old saves when the game changes.

### `src/sim/modules/` — the thirty systems that make a tavern tick

This is where the bulk of the behaviour lives. Each subfolder is a self-contained system that owns one slice of tavern life. There are about **29 of them**, and the design rule is strict: no giant catch-all files, each system registers its own behaviour. A representative sampling:

- **`areas/`** — the physical rooms and how they decay, get dirty, and need maintenance.
- **`stock/`** and **`economy/`** — inventory, spoilage, prices, sales, and the coin ledger.
- **`staff/`** — your employees, with morale, stress, fatigue, loyalty, work styles, and how they respond to pressure.
- **`customers/`** — who comes in, how busy it gets, how satisfied they leave.
- **`suppliers/`** — the merchants you buy from, with reliability and relationship that shift over time.
- **`factions/`** and **`cultures/`** — the town's social groups, with their own moods, trust, and tensions.
- **`regulars/`** — named repeat customers who build up loyalty (or irritation) and remember how you treat them.
- **`reputation`** (via the reputation registry) — ten distinct reputations the tavern can have, like "cozy," "tasty," "dangerous," or "respectable."
- **`pressures/`** — the slow-building problems (burnout, debt, pests, inspection risk, and more), each with a value, a trend, and a list of what's driving it.
- **`memories/`** — events the world remembers, which fade over time and can be about specific people.
- **`causes/`** and **`attribution/`** — the bookkeeping of *why* numbers moved, so the game can always explain itself.
- **`service/`** — the busy heart of a single day: staff working, customers buying, incidents happening.
- **`weekly/`** and **`monthly/`** — the bigger rhythms: paying wages, the landlord's rent, health inspections, rival taverns making moves.
- **`issueSeeds/`** and **`issues/`** — the system that decides which *situations* the tavern is facing right now (we'll come back to this — it's the bridge to the cards).
- **`responses/`** — what happens after the player makes a choice.
- **`adventurers/`** and **`expeditions/`** — a newer system where you can send hireable adventurers off to find rare ingredients.
- **`localArcs/`** — longer seasonal storylines that play out over many days.

The pattern across all of these is the same: each system declares what part of the state it owns, which steps of the day it acts on, and what it records about *why* things changed.

### `src/sim/signals/` — a clean "question desk" for the rest of the game

This is a small but clever folder. It provides a tidy way to ask the simulation simple questions — "is this supplier's reliability low, medium, or high?", "is staff stress rising?", "how many times has this regular complained recently?" — without the asker needing to dig through the raw numbers. There are around seventeen of these "banded" readings (things like supplier reliability, staff stress, faction relationship, area cleanliness, regular loyalty). This is the official, approved way for the card layer to *read* the simulation, which keeps the "cards never invent truth" rule enforceable.

### `src/sim/content/` — the generated cast and world

This folder holds the building blocks for *generating* people and places: name generators, culture and faction definitions, supplier and NPC types, and — interestingly — a **`cast/`** subfolder that gives characters bounded personality traits: a specialty, a blind spot, things they like or dislike, and a "voice profile" (how terse, warm, formal, or florid they are, sometimes with a verbal tic). These traits are generated once and stored, so a character stays consistent — and, importantly, so their personality can later flavour the way their cards are written.

### `src/sim/registries/` and `src/sim/testing/`

- **`registries/`** is the project's way of keeping expandable lists flexible — areas, stock items, staff roles, pressures, reputations, and so on all live in registries rather than being hard-coded. This means new content can be added without rewriting the engine.
- **`testing/`** provides convenient tools for running the simulation in tests — helpers to run a day, a week, or a month and inspect the result.

---

## The ground floor: cards and reports

### `src/cards/` — turning simulation into readable situations

This is where the simulation's dry facts become the written cards a player sees. The key insight is that cards are **composed**, not hand-written one by one.

- **`src/cards/templates/`** holds about **22 card types** — `drinkOrder.ts`, `staffAside.ts`, `customerComplaint.ts`, `supplierReliability.ts`, `inspection.ts`, `debtRent.ts`, `rumourCrisis.ts`, `rivalTavern.ts`, and so on, plus a `fallback.ts` for anything not yet covered. Each template knows which kind of situation it applies to and how to lay out a card.
- **`src/cards/compose/`** is the assembly line. Rather than one fixed paragraph per card, each card has **slots** (a title, an opening line that states a real fact, a flavour line, the choices, and previews of what each choice will do). Each slot is filled by **picking a snippet** from a **pool** of options, choosing the one whose conditions best match the current situation. There are around **143 snippet-pool files** organised by card type.
- **`src/cards/compose/conditions.ts`** defines the vocabulary a snippet can use to decide whether it fits — things like "only if this regular's loyalty is high," "only if staff burnout is rising," "only if we've warned this person before." These conditions are plain data that read directly from the simulation, which is how the "never invent truth" rule is kept.
- **`src/cards/compose/gates/`** is a genuinely impressive quality-control department. These are automated checks (about a dozen of them) that inspect the card writing for problems before it can ship: Does every slot have a safe fallback? Is the text within its word budget? Does a "fact-stating" line actually match the simulation? Does the same situation always produce the same card? Are the choices distinct from each other? Does a character sound consistent across different cards? We cover these in detail in the "most interesting systems" document.

### `src/reports/` — the daily, weekly, and monthly write-ups

After each day, the player gets a written summary of what happened. This folder builds those reports — the morning opener, the "quiet day" line, the list of missed opportunities, the day's service log, the yesterday-versus-today digest. Like the cards, these are composed from snippet pools, but they describe *what already happened* rather than offering choices. Every figure in a report (coin earned, reputation shifts, customer counts) comes straight from the simulation; only the connecting prose is composed.

### `specs/cards/` — the design notes for each card type

There are **20 specification files** here, one per card type, written in a simple human-readable format. Each one is a design document: it describes what a card type is for, what its slots are, which lines must state real facts versus add flavour, and what word budgets apply. These act as the agreed blueprint that the snippet pools are written against and the gates enforce.

---

## The shop front: the web interface

### `web/src/` — the playable game

This is the real, clickable version of the game. It's built with Svelte (a modern web framework) and is genuinely playable — you can start a tavern, make decisions, and save your progress — though it's deliberately plain-looking rather than polished.

- **`web/src/App.svelte`** is the front door. When it loads, it tries to restore your saved game, and it routes you between the main screens.
- **`web/src/lib/screens/`** holds the six main screens: a **Start** screen (new game / continue), a **Day** screen (the morning-to-report loop where the real playing happens), a **Tavern** screen (manage your rooms, stock, recipes, staff, and projects), a **World** screen (see the townsfolk, factions, cultures, suppliers, and rumours), a **Reports** screen (history and breakdowns), and a **More** screen (settings, saves, glossary). *(There's also a `ComingSoon.svelte` placeholder, which isn't currently used by any screen — a small sign that some areas are still planned.)*
- **`web/src/lib/components/`** holds the reusable pieces — the thing that renders a card, the deck that steps you through several cards, the action picker for queuing decisions, the pressure indicators, and the report viewers.
- **`web/src/lib/sim/gameStore.svelte.ts`** is the crucial bridge. It is the *one and only* place in the entire web interface that actually runs the simulation. Every screen reads the tavern's state from here, and every decision flows back through a single `runDay()` call that invokes the engine's `simulateDay()`. This tidy single-doorway design keeps the playable game and the simulation cleanly separated.
- **`web/src/lib/sim/persistence.ts`** handles saving and loading to the browser's local storage, including validating saves and recovering gracefully if one is corrupt.

The takeaway: the web layer is a *thin, well-organised shell* around the simulation. It doesn't duplicate any game logic — it just presents what the engine produces and feeds player choices back in.

---

## The inspectors: tests and validation

### `tests/` — over 230 files of automated checks

This is one of the strongest signs of how seriously the project is built. The tests mirror the structure of the code: `tests/sim/` checks the simulation, `tests/cards/` checks the card composition and the quality gates, `tests/reports/` checks the report write-ups, and `tests/web/` checks the interface behaves (clicking between tabs, saving and loading, advancing through a day).

The test files follow a numbered naming convention (like `phase127.*.test.ts`) that ties each batch of tests to a stage in the project's development plan. They check structure ("does this build without errors?"), determinism ("does the same input always give the same output?"), the quality gates ("does this card writing pass all the checks?"), and full end-to-end behaviour ("when a real situation runs through a real card, does it produce something sensible?").

---

## The blueprints: planning documents

### `docs/` — over 100 planning files

This folder is where the project's thinking lives, and it's unusually thorough.

- **`docs/ISSUE_TRACKER.md`** is the running to-do list and history — it tracks dozens of work items across several "tiers," noting what's done, what's open, and what depends on what.
- **`docs/plans/`** holds **107 documents**: a few "locked" design contracts that set the vision and rules (the founding simulation contract, the expansion arc, the card-layer contract, the game-loop and UX contract, the onboarding plan, the card-composition framework), plus one detailed plan per stage of work.
- **`CLAUDE.md`** at the root is a remarkably detailed running log of what's been built, phase by phase.

The existence and discipline of these documents is itself meaningful: this is a project that was *planned*, then built against the plan, with the plan kept up to date as reality changed.

---

## How a single day flows, end to end

To tie the tour together, here's the journey of one click of "End Day":

1. On the **Day** screen, the player has queued up their decisions and responded to the morning's cards.
2. The web interface calls `gameStore.runDay(...)`, the single doorway into the engine.
3. `simulateDay()` runs the day through its ~two dozen ordered steps: the calendar advances, customers are forecast, staff work, service happens, money is counted, pressures update, memories age, and the systems decide which new **situations** the tavern now faces.
4. The engine hands back the new tavern state, a set of reports, a record of exactly what changed and why, and any new situations needing attention.
5. The card layer takes each new situation and **composes** a readable card from its snippet pools — strictly reporting what the simulation already established.
6. The report layer composes the day's written summary from the recorded changes.
7. The web interface shows the player the report and the next cards, and the loop begins again.

That clean flow — from a single click, through the engine, into composed cards and reports, and back to the screen — is the shape the whole codebase is organised around.
