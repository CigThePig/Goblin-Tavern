# Phase 82 — Notable NPC profiles for niche factions (ISSUE-042)

See `docs/ISSUE_TRACKER.md` ISSUE-042 for full evidence and impact.

## Context

ISSUE-012 (Phase 52) added three niche factions — `smugglers_ring`,
`silvermark_house`, `rival_taverns` — to the world. None had any
notable NPC representation. Pressure chains, cause attribution, and
card-flavour lookups that targeted those factions could only resolve
faction-level refs.

## Implementation

`src/sim/content/npc/notableNpcProfiles.ts` — three new profiles:

- `smuggler_contact` (factionId `smugglers_ring`, cultureId
  `goblin_local`, naming `goblin_common`, kind `smuggler`).
- `silvermark_factor` (factionId `silvermark_house`, cultureId
  `merchant_roadfolk`, naming `merchant_roadfolk`, kind `creditor`).
- `rival_tavern_keeper` (factionId `rival_taverns`, naming
  `human_town`, kind `rival`).

Drive-by: short comments on the existing `moneylender` and `fence`
entries explaining the faction pairings are deliberate (the
moneylender works the brewers' guild debt book; the fence moves
goods through the scrap collectors' underground network).

NPC seeding (`state/defaults.ts:createInitialNotableNpcs`) iterates
all registered profiles, so the three new profiles auto-seed at day
zero — no defaults.ts change required.

## Verification

`tests/sim/phase82.factionNpcCoverage.test.ts` (new, 4 tests):
- every registered faction has ≥1 profile with matching factionId;
- the three niche-faction profiles exist by name;
- day-zero seeding lands the three new NPCs in
  `state.world.notableNpcs` with generated display names;
- naming + culture pairings match the design.

`tests/sim/phase44.notableNpcs.test.ts`:
- the load-bearing `length === 8` assertion is relaxed to
  `>= 8` — the floor stays meaningful while phase 82 lifts the
  roster.

Adjacent: `phase52.nicheFactions` (9) still green.

## Files

- `src/sim/content/npc/notableNpcProfiles.ts`
- `tests/sim/phase44.notableNpcs.test.ts` (relax count assertion)
- `tests/sim/phase82.factionNpcCoverage.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
