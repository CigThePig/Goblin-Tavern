# Phase 201 — Gameplay audit, Wave 2: authoritative causality and closed reports

Wave doc for `ISSUE-166` / Wave 2 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`. Depends on
Waves 0 and 1 (phases 199, 200), both closed.

**Findings:** `P4-SEAM-002` (High/P1), `P6-COMP-006` (Med/P2),
`P5-PLAY-003` (High/P1), `P4-SEAM-004` (Med/P2), `P5-PLAY-004` (High/P1),
`P7-EXP-003` (High/P1).

**Gate (Phase 8 §7):** a closed report is field-stable immediately, next
day, days later and after reload; simultaneous causes for two staff /
groups / rooms never cross identity; Fix Root names one room from preview
through report; blame/mock cannot become positive coaching on magnitude
alone.

---

## 1. Closed reports are rebuilt from live state (`P4-SEAM-002`, `P6-COMP-006`)

Both report entry points call `buildDailyReport(result, gameStore.state)`.
The projections then read *current* state:

- `projectMissedOpportunities` reads `modules.responses.resolvedToday`,
  `modules.issueSeeds.seedsToday` and `modules.pressures.snapshots`;
- `projectResolvedIntents` reads `modules.responses.resolvedToday`, which
  the next `startDay` clears.

So the moment Segment A of the next day runs, yesterday's report starts
describing today: the audit watched a Day 3 report swap "restock Ale,
respond to rival expansion" for Day 4's "restock stew, blame Nash", and
watched three resolved choices vanish from a Day 2 report entirely.

**The closed day already exists** — `result.state` is exactly the state
the report describes. The defect is that the callers hand the projections
the live store state instead, and that nothing retains the closed state
once the next day opens.

The fix keeps one rule: **a daily report projects from the state of the
day it describes.** The store retains `closedDayState` at `endDay`, both
screens project from it, and it is persisted so the rule survives reload.
Persisting a second whole `TavernState` is the quota problem Wave 0 already
solved — so it rides as a `baselinePatch` against the live state, the same
codec and the same envelope machinery the start-of-day baseline uses. At
the report beat the two states are identical and the patch is empty; after
the next morning opens it covers one segment of divergence.

This fixes every field of the closed report, not just the two the audit
caught — `projectRisingPressures`, `projectFutureHooks` and the day arc
read live state by the same mistake.

## 2. Evidence crosses identity (`P5-PLAY-003`, `P4-SEAM-004`)

`recentCauseEntries(ctx, tags, days, limit)` matches **any** supplied tag:

```ts
if (tags.some((tag) => cause.tags.includes(tag)))
```

Call sites mix an entity id in with domain tags —
`['customer', group.id, 'area', 'reputation', 'cleanliness']` — so a
generic `area` or `cleanliness` cause belonging to a different group or
room qualifies. Every customer complaint on Days 2–7 carried foreign
evidence: a Merchants card citing "Main room cleanliness fell below
Adventurers tolerance", an Ib Mudshank card citing Nash being blamed. The
seasonal-arc case is the same bug with a different tag: `['arc',
'local_arc', arcKey, theme, 'festival']` let the generic `arc` tag pull
four staff-mastery causes onto a mushroom-blight card.

New `scopedCauseEntries(ctx, scope, days, limit)` with compound scoping:

- a cause qualifies when it **names one of the scope's entities** — by tag,
  `relatedActors` or `relatedLocations`;
- a cause that names *no* entity at all qualifies only when
  `includeGlobal` is set and it matches a domain tag (genuinely shared
  system conditions — a market shift, a calendar event);
- a cause naming a *different* entity never qualifies, whatever its
  domain tags say.

`recentCauseEntries` stays for the call sites that are legitimately
entity-agnostic (`['rent','coin','wages']`, `['kitchen','spoilage','food']`).
The entity-sensitive sites — customer complaint, staff identity, regular,
supplier, faction, culture, area, seasonal arc, policy, stock — move to the
scoped query.

## 3. Fix Root repairs a rotated room (`P5-PLAY-004`)

`generateCustomerComplaint` picks its anchor area from
`pickCustomerFacingArea(ctx, 'customer_complaint')`, a day-rotating picker
that knows nothing about the complaint's evidence. `fix_root_profile` then
writes to `areas.${complaintAreaId}.*`. So the Day 3 Merchants card cited
a Main Room problem, and Fix Root spent 10 coin cleaning the Private Booth
while Main Room fell 18 → 0 the same day.

The anchor now comes from the evidence: the dominant cause's location
(`relatedLocations`, or an `areas.<id>.*` target) when the seed's causes
name one, falling back to the rotating picker only when they genuinely
name no room. One area id then flows through the cited cause, the choice
preview, the target option, the applied state path, the emitted cause and
the report.

## 4. Coaching recommends harm (`P7-EXP-003`)

`scoreEffects` sums `Math.abs(effect.amount)`, so −20 loyalty scores
exactly as strongly as +20. The report picks the non-ignore slot with the
highest `impactScore`, so a 28-day route recommended `blame` 29 times —
mocking Ogres into a possible boycott, blaming Mira into −20 loyalty, −12
morale and a possible resignation, presented as what the player "could have
done".

`impactScore` keeps its meaning — how *much* a choice moves, used for
ranking prominence and pacing. What changes is that the missed-opportunity
projection stops using it as a proxy for desirability, and ranks candidate
slots by a new **signed utility**: the same effect weights, but each
contribution signed by the effect's `direction`, which Phase 164 already
computes valence-correctly (a −8 `staff.stress` is `positive`; a −20
`loyalty` is `negative`). A slot whose net utility is negative is not
offered as a missed opportunity at all; when a seed has no net-positive
slot, it is dropped from coaching rather than dressed up.

`DC-03` (the long-term player objective, which the audit says governs
desirability scoring) is **still open** — this ranking is deliberately
objective-agnostic. It answers only "would this have made things better or
worse", which needs no objective; a richer strategy-aware ranking should
wait for `DC-03`.

## 5. Evidence

`tests/sim/phase201.wave2.causality.test.ts` and
`tests/web/phase201.wave2.closedReports.test.ts`:

- a closed report's every field is identical immediately, after the next
  morning opens, several days later and across a save/reload round trip —
  including the resolved-choice ledger and the missed-opportunity rows;
- simultaneous causes for two staff, two customer groups and two rooms,
  asserting each generated seed carries only its own actor's/room's
  evidence;
- no `seasonal_arc` seed carries only staff-arc/teleology causes;
- a complaint with two dirty rooms: the cited cause, the preview, the
  target option, the applied state path, the emitted cause and the report
  all name the same room;
- a blame/mock slot with large negative effects never outranks a smaller
  beneficial slot, and a seed whose only slots are harmful produces no
  missed-opportunity line.
