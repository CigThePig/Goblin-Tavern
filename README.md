# Goblin Tavern

A text-based goblin tavern management simulation, built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

**Core design rule:** the simulation is the source of truth. Cards reveal sim state — they never invent it.

## Where to start

- [`CLAUDE.md`](CLAUDE.md) — project state, architecture rules, repo layout.
- [`docs/ISSUE_TRACKER.md`](docs/ISSUE_TRACKER.md) — what's next (see the "Current work" callout at the top).
- [`docs/plans/`](docs/plans/) — per-phase plans and locked design contracts.

## Dev commands

```
npm test            # Vitest suite
npm run typecheck   # tsc --noEmit
npm run dev         # Vite dev server (web UI)
npm run build       # Vite production build
```
