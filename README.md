# Goblin Tavern

A text-based goblin tavern management simulation, built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

**Core design rule:** the simulation is the source of truth. Cards reveal sim state — they never invent it.

Run a low-fantasy tavern one day at a time: plan the owner's work, staff the
rooms, buy supplies, serve the crowd, and meet obligations that persist across
weeks and months. People remember the house you actually run.

## Play locally

Use Node.js 24 and npm. Install dependencies with `npm ci`, then start
`npm run dev` and open the address Vite prints. Progress saves automatically
in your browser; the Saves screen also supports named snapshots and exports.

## Ambitions and earned identity

Open **Tavern → Ambitions**, or follow the morning's ambition reminder.
Alongside the original liquor licence, six new paths connect longer goals to
the existing simulation:

| Ambition | What it asks of the house |
| --- | --- |
| A room worth gathering in | Build Better Tables, then establish a working gathering place. |
| A standing supplier compact | Choose a supplier, receive orders, and negotiate mutual or exclusive terms. |
| A charter from the quarter | Earn a named faction's approval through real dealings and hospitality. |
| The cook's own kitchen | Support a named cook, install a Large Stew Pot, and give them working shifts. |
| A place at the table | Sustain a chosen culture's welcome through food, service, and accommodation. |
| A second start | Recover from financial trouble and rebuild a trading reserve without erasing debts. |

Openings appear as days pass and circumstances change. Starting one commits
owner time; subsequent sessions use the quoted time, coin, and supplies.
Only one session per venture per day counts. Milestones are checked at closing
against live requirements. Pause to preserve investment, resume when ready,
or deliberately abandon it. New ambitions left unworked for two weeks pause.

The Ambitions screen also shows staff career paths and the evidence behind the
house's identity. Working shifts, support, morale, and coworker relationships
shape careers; an absent employee supplies no earned service bonus. Identity
changes gradually, influences who comes, and can acquire up to three
source-attributed nicknames after sustained public evidence. Names can fade
when the house stops living up to them. Existing saves retain their ventures,
mastery arcs, and progress.

This implements a substantial part of expansion Phase 10. The tracker records
the remaining actor-contact branches, recoverable failures and scars, and
identity consumers still needed before that entire phase can close.

## Where to start

- [`CLAUDE.md`](CLAUDE.md) — project state, architecture rules, repo layout.
- [`docs/ISSUE_TRACKER.md`](docs/ISSUE_TRACKER.md) — what's next (see the "Current work" callout at the top).
- [`docs/plans/`](docs/plans/) — per-phase plans and locked design contracts.

## Dev commands

```
npm test            # Vitest suite
npm run test:full   # All tests, including long simulation playthroughs
npm run typecheck   # tsc --noEmit
npm run check       # Svelte and web type checks
npm run dev         # Vite dev server (web UI)
npm run build       # Vite production build
```

## Reproduce progression

```sh
npm run progression:lab -- --days=28 --goal=venture_supplier_compact
npm run progression:lab -- --days=28 --goal=venture_supplier_compact --terms=exclusive --json
```

The lab starts a normal fresh game and uses registered owner actions through
the same morning, service, and closing segments as the UI. It purchases actual
supplies and building materials, negotiates and places orders, and validates
every resulting day. It does not inject ambitions, transformations, nicknames,
money, or completion. Choose any catalogue ID, a seed (`--seed=...`), and
1–196 days. The culture route chooses the most comfortable available partner.
The recovery route requires actual financial trouble; a solvent run correctly
leaves it locked. Its simple manager can stall or fail: the trace lists actions,
rejections, coin, patrons, milestones, and final blockers so that outcome is
inspectable.

Pull requests run both test tiers, TypeScript/Svelte checks, and a production
build. The expansion ledger, repository map, and deterministic baseline probes
remain covered by the suite. Update those snapshots deliberately when a rule
change moves their recorded behavior.
