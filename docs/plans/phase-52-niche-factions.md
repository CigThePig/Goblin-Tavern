# Phase 52 — Niche factions + factionUpdate triggers (ISSUE-012)

This phase delivers the work tracked as `ISSUE-012` in
[`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md). See the tracker entry
for the full evidence, impact, scope, and test approach. This document
records the implementation choices that arrived from the planning pass.

## What changed

Pre-phase: the faction registry shipped 6 factions, but only 4 had
trigger pairs in `factionUpdateHook`. `local_shrine` and
`scrap_collectors` accrued no module-driven drift — they only moved
through generic seed/attribution flows. The 6 factions also lacked
breadth: no smugglers, no nobles, no rival ownership.

Phase 52 adds 3 niche factions (`smugglers_ring`, `silvermark_house`,
`rival_taverns`) and wires `factionUpdate` trigger pairs for the
two mechanically inert starter factions. The new triggers reuse the
existing `shiftFaction` helper and the same kind of state-read pattern
(`hasCalendarTag`, `pressures[*].value`, `activeArcsByTypeOrTag`,
recent memory tags) that the existing 4 triggers already use.

### `src/sim/content/factions/factionRegistry.ts`

Three additions to `REQUIRED_FACTIONS`:

| id | label | culture | tags |
|---|---|---|---|
| `smugglers_ring` | Smugglers Ring | — | `underground`, `risk_tolerant` |
| `silvermark_house` | House Silvermark | `traveling_outsiders` | `wealthy`, `reputation_authority` |
| `rival_taverns` | Rival Taverns | — | `competition`, `rival_owner` |

Each carries the same shape as the existing entries: id, label,
description, defaultRelationship/Influence/Trust/Fear meters,
interests/likedPolicies/dislikedPolicies, and tags. The
`silvermark_house` culture id resolves through the phase 50
`traveling_outsiders` registration; cross-ref validation passes
because cultures register before factions seed into world state.

### `src/sim/modules/factions/factionModule.ts`

Two new triggers slot into the same `factionUpdateHook`:

- **`local_shrine` ← celebration / disregard.** When
  `hasCalendarTag(state, 'festival_window')` OR
  `hasCalendarTag(state, 'mushroom_festival')` is true:
  - If at least one festival arc is active OR the owner has a project
    with `festival`/`festival_prep` tag → `+1` (festival engagement).
  - Otherwise → `-1` (festival disregard). The two branches are
    mutually exclusive, so at most one shift lands per day.
- **`scrap_collectors` ← maintenance / waste.** When the canonical
  `maintenance` pressure or `pests` pressure exceeds 60, shift `-1`
  (clutter / refuse accumulation reflects badly on the haulers'
  perceived value). When `area_cleaned_recently` or
  `cellar_fumigated_recently` memory is present and the maintenance
  pressure is below 40, shift `+1` (recent work credits them).

The thresholds reuse the existing `VIOLENCE_THRESHOLD = 60` /
`DEBT_THRESHOLD = 60` pattern with a couple of new constants
(`MAINTENANCE_THRESHOLD = 60`, `MAINTENANCE_RELIEF_THRESHOLD = 40`).
The new triggers route through the existing `shiftFaction` helper,
so cause emission, tagging, and bounds clamping all flow through
the same path the original four triggers use.

### Reference validation

No new validator code needed. The optional `cultureId` on the new
`silvermark_house` faction is checked by the existing
`validateState` path
(`referenceValidation.ts:309-320`). The three new ids reach the
`faction_request` seed generator automatically — that generator
already iterates `Object.values(state.world.factions)`.

## Tests

`tests/sim/phase52.nicheFactions.test.ts` covers nine focused cases:

1. Registry contains the three new factions.
2. `state.world.factions` seeds each with non-zero meters.
3. `silvermark_house` references `traveling_outsiders` and that
   culture exists.
4. `validateState` passes for the default starting state.
5. `local_shrine` drops when a festival calendar tag is active with
   no festival project/arc to engage.
6. `local_shrine` rises when a festival calendar tag is active AND a
   festival-tagged owner project is active.
7. `scrap_collectors` drops when `maintenance` pressure value is at
   or above 60.
8. `scrap_collectors` rises when an `area_cleaned_recently` memory
   is present and maintenance pressure is low.
9. The new factions are reachable through the existing
   `faction_request` generator — i.e. they enumerate as valid
   targets when faction-anger conditions are high.

## Verification

- `npm run typecheck` — passes.
- `npm test` — full Vitest suite green. The phase 30, 38, and 44
  faction-relevant tests stay green; the new triggers do not change
  the existing behaviour for the 4 original trigger pairs.

## Out of scope

- Inspection family rotation that would let the `town_watch` slot pick
  up alternate inspector factions like `smugglers_ring` (covered by
  ISSUE-018).
- Notable-NPC entries for the new factions. The registry-driven NPC
  factory from Phase 44 will accept new profile entries; adding them
  is a follow-up that ISSUE-024 (thin family profile depth) can pick
  up alongside the family-rotation work.
- Reputation- and rival-pressure web wiring for `rival_taverns`. The
  faction itself ships now so `faction_request` and downstream code
  can begin to reference it; the cross-pressure wiring is broader
  scope than this issue.
