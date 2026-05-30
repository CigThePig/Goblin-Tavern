# Goblin Tavern — A Plain-Language Overview

*Written for family and friends who want to understand what Ross has been building, without needing to be programmers.*

## The short version

Ross is building a video game called **Goblin Tavern**. In it, you run a scruffy tavern in a goblin town — you decide who works there, what's on the menu, how you treat your regulars, how you handle trouble, and how you keep the landlord, the health inspectors, and your own staff happy enough to keep coming back.

But here's the unusual and genuinely clever part: instead of starting with the pictures, buttons, and menus you'd normally see in a game, Ross is building the **invisible "brain" of the tavern first**. Before there's a polished screen to look at, the code already keeps track of the tavern as a living place — who's stressed, what's running low, which customers hold a grudge, what problems are quietly building up in the background. The visible game will eventually sit *on top of* that brain.

That's why it can be hard to show off in a quick demo. Most of the work so far is the part you don't see — and that part is large, careful, and well-organised.

## What you'd actually do when playing

The game is played one **day** at a time, like turning the page on a calendar. A typical day looks like this:

- **Morning:** You see what's brewing. Maybe a cook is burning out. Maybe the cellar's gone damp. Maybe a regular has been short-changed one too many times.
- **Planning:** You decide what to do — restock the pantry, hire someone, clean a room, change a house rule.
- **Service:** The day plays out. Customers come in, order, sometimes cause trouble, sometimes leave happy.
- **Closing & report:** You see how the day went and what it cost or earned you — and what consequences you've set in motion for tomorrow.

The decisions are presented as **cards** — short, written situations with a few choices, a bit like the choose-your-own-adventure card games some phone games use. You pick an option, and it ripples forward.

The fantasy here isn't "click to get rich." It's **running a place that remembers**. The tavern has a history. People in it have feelings about how you've treated them. A choice you make in week one can still be biting you in week six. That's the emotional appeal: it's a small, messy, living world that reacts to you.

## What makes it different from a simple game

A lot of management games are, underneath, glorified spreadsheets — numbers that go up when you click. Goblin Tavern is trying to be something richer:

- **It tracks *why* things happen, not just *what*.** When the tavern's reputation drops, the code records the reason — a bad night, a rude staff member, a health scare — so the game can later *explain itself* to you.
- **It has memory.** Characters remember slights and kindnesses. A regular who's been ignored three times behaves differently from one you've looked after.
- **It has "pressures" that build quietly.** Things like staff burnout, debt, pest problems, or a souring relationship with the landlord rise in the background until they boil over into a situation you have to deal with.
- **It has a populated world.** There are suppliers you trade with, rival taverns, local factions and cultures, travelling adventurers you can send on expeditions for rare ingredients, and seasonal events. These aren't just labels — the code tracks their moods and relationships over time.

In other words, it's less "tap the button" and more "manage a place full of people and problems that keep developing whether you're looking or not."

## What has actually been built so far

This is the honest part, and it's genuinely impressive.

**The simulation — the tavern's "brain" — is built and working.** This is the bulk of the project: roughly a hundred thousand lines of carefully organised code, split into about thirty self-contained systems (staff, customers, stock, money, suppliers, factions, cultures, reputation, memory, pressures, and more). You can run a full day, a full week, or a full month of tavern life in the code today, and it behaves consistently every time.

**There is a working web version you can actually click through.** It's not a finished, polished, animated game — it's text-heavy and plain-looking — but it's a real, playable interface, not a fake mock-up. You can start a new tavern, give it a name, pick a difficulty, play through days making real decisions, watch the pressures rise and fall, manage your staff and inventory, read the daily reports, and save and load your progress. The screens for the day loop, the tavern's internals, the wider world, the reports, and settings are all wired up to the real simulation underneath.

**The card system that turns simulation into readable situations is well underway.** There are over twenty different kinds of cards — drink orders, staff troubles, customer complaints, supplier offers, health inspections, debt pressure, rumours, rival taverns, and so on. Crucially, these cards don't make things up: they're built to *report what the simulation already knows is true*. If a card says "your cook is at breaking point," it's because the simulation actually has that cook's stress meter near the top.

**It's heavily tested.** There are well over two hundred test files — automated checks that run the code and confirm it does what it should. The whole project is set up so that the same starting conditions always produce the same outcome, which makes the game reliable and replayable (and much easier to debug).

## Why building the "brain" first is the smart move

This is the heart of the story, and it's worth understanding.

A lot of games are built **outside-in**: artists and writers make the menus, the art, and hundreds of cards first, and then someone tries to wire up logic underneath that makes it all feel meaningful. The risk is that the visible parts and the underlying logic never quite fit together — the cards feel disconnected, the choices don't really matter, and the world doesn't remember anything.

Ross is deliberately building **inside-out**. The plan, written down explicitly throughout the project, is: *get the world behaving like a real, reactive place first; then let the cards and screens grow out of what the world is already tracking.*

The payoff is that the cards can be written around problems the tavern is **genuinely having**. Instead of inventing a "your barrel exploded" card and hoping it fits, the simulation notices that the cellar's condition has been decaying for days, that nobody's done maintenance, and that a pressure called "maintenance" has crept into the danger zone — and *that* becomes the card. The choice feels earned because it grew from real, tracked history.

There's a written rule that runs through the entire codebase, almost like a constitution:

> **The simulation is the source of truth. Cards reveal what's already happening — they never invent it.**

That single principle is enforced everywhere, even by automated tests that check the card text against the simulation's actual state.

## What's *not* done yet (being honest)

It would be misleading to call this a finished game, and Ross hasn't. To be clear about where things stand:

- **The visual polish isn't there.** The playable web version works, but it's intentionally plain — mostly text, minimal art and animation. It's a working skeleton, not a beautiful finished product.
- **The hand-written flavour and content are still growing.** The systems that *generate* cards exist and are good; filling out every situation with rich, varied writing is ongoing work.
- **Some larger features are scaffolded for the future.** For example, there's an explicit plan for a gentle "first time opening a tavern" onboarding that eases new players in over the first several in-game weeks. The design is written down; not all of it is implemented yet.
- **It's a deep simulation more than a quick pick-up-and-play game right now.** The depth is the point, but it means the immediate "fun in thirty seconds" layer is still being built on top.

None of this is a weakness in the work — it's just where a thoughtful, foundation-first project naturally sits at this stage.

## Why this is meaningful work

It's easy to look at a project with no flashy visuals and assume not much has happened. The opposite is true here.

What Ross has built is the hard, invisible part — the engine that makes a game world feel *alive and consequential*. Anyone can put a button on a screen. Far fewer people can design a system where a tavern quietly remembers that you underpaid a supplier in the spring, lets that resentment grow, and surfaces it months later as a believable problem — and do it so reliably that it behaves identically every single time you replay it.

This is a self-directed creative and technical project of real ambition. It reflects sustained systems thinking, a clear and disciplined plan followed over many stages of work, and a strong creative vision for the kind of small, living world the game wants to be. The reason it's hard to explain in a quick conversation is exactly the reason it's worth admiring: most of the value lives *inside the logic*, in the part you can't point a camera at.

It's a tavern that's already alive in the code. The windows and the front door are simply still being built.
