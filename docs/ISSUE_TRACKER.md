# Goblin Tavern Issue Tracker

Working source of truth for post-Phase-40 work. One entry per problem
bundle, scoped to land as a single phase.

**Closed issues keep their index row only.** Their full write-ups (evidence,
scope, test approach) were removed in the 2026-07-26 documentation cleanup —
recover any of them from git history (`git log --diff-filter=D -- docs/`) if
a specific fix needs re-reading. Only live work carries a full entry below.

## How to use this tracker

- **Issue IDs are stable** — never renumber, even if scope shifts or an
  issue is split. Cross-references depend on it.
- **Update status inline** in the index as work progresses.
- **Dependencies are hard:** a `depends-on` issue must be `done` first.
- **Test approach means observable behavior change** — what state mutation,
  attribution flow, or report output proves the fix worked end to end.
- **Adding an issue:** take the next free number, add an index row, and
  write a full entry only if the work is live. Match the entry shape
  (Grade / Status / Phase / Record / Evidence / Scope / Depends on / Test
  approach). Don't fold new problems into existing entries.

Status: `open` · `in-progress` · `done` · `deferred` · `superseded`.
Grade: `broken` · `thin` · `solid` · `design`.

## Current work

> ### 🔒 All development is paused outside `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` (2026-07-29)
>
> The Simulation Expansion and Obligation-Closure plan is the **only
> unpaused work**. It is a standalone implementation document — it needs
> no earlier audit, report, or ledger to execute — and it runs as
> **ISSUE-170…183 (repo phases 207–220)**, one issue per plan phase 0–13.
> **ISSUE-170…176 (Phases 0–6) are done** — the baseline is frozen, the
> implementation ledger exists, the shared contracts are in place, **OBL-01
> is closed** (area upgrades can be discovered, quoted, started, funded,
> paused, resumed, cancelled, built, damaged, disabled, repaired, serviced
> and persisted, and areas own real physical capacity), **the staff half of
> OBL-02 is closed** (staff have employment terms, shifts, stations, absence,
> cross-training, promotion, relationships, arrears they are actually owed,
> and they resign — founding staff included), and **service is now a
> capacity-constrained flow**: patrons arrive as parties across six waves,
> compete for seats/kitchen/delivery/reset throughput, choose dishes on a
> scored comparison, run out of patience, run tabs, and regulars remember
> what happened and decide whether to come back. **The economy is now a
> survival loop:** persistent service collapse reduces group traffic, spend and
> tolerance; attributable costs and exact daily/weekly/monthly accounting bind
> cash; policies require real enforcers; insolvency can constrain and close the
> tavern; registered restructuring/reopening actions recover it. Phase 6
> closes **OBL-04**: supplier orders, deliveries, credit and invoices are now
> one transactional loop. **Phase 7 closes OBL-03 and the loan/eviction half
> of OBL-02**: loans have lenders, schedules, delinquency, collections,
> renegotiation and settlement; the tenancy bills real rent periods and runs
> a notice ladder that ends in an eviction hearing the tavern can still
> escape; and an inspector actually visits, grades seven dimensions against
> live state, and leaves findings, fines and orders a follow-up re-reads.
> **ISSUE-178 (Phase 8 — the autonomous social world) is DONE, executed part
> by part (8.1–8.5). ISSUE-179 (Phase 9) is now in progress, part by part;
> §9.1 (the rival actor), §9.2 (local arcs) and §9.3 (expeditions) are
> done.** **§8.1 (factions) is done
> (2026-08-06).**
> Factions are now actors rather than meters: each has goals derived from
> live state, a budget derived from its influence, a constituency of real
> customer groups and suppliers, a dated and decaying ledger of how it has
> been treated, and a bounded eight-move action set (ask, back, boycott,
> report to the watch, squeeze supply, sponsor, protect, back the rival).
> They decide deterministically, announce the move two days before making
> it, and each move is read by the domain that owns what it changes — the
> customers' own forecast rule, the supplier's own price and credit
> decision, the violence calculator, the competitor factor. The visible
> `relationship` meter is now a summary of the ledger rather than a
> threshold drift, and four owner actions (grant, refuse, appeal, repay)
> mean every move can be opposed. Five `HOOK-*` families stop draining:
> `faction_grudge_*`, `faction_revenge_*`, `faction_deception_exposed_*`,
> `<group>_boycott_possible` and `shrine_favour_owed_*` now resolve into
> real faction moves.
>
> **§8.2 (cultures) is done (2026-08-07), which closes DEP-08.** The two
> things §8.2 names as broken are fixed at the source rather than
> re-heuristicked: food taboo and delight now read the order lines a party
> was actually DELIVERED (they scanned the cellar, so a crate of something a
> culture does not eat offended them whether or not a plate ever left the
> kitchen), and seating tension now reads actual placement and crowding from
> the Phase 4 flow (it compared two patronage meters, so groups could
> "conflict over seating" on a night neither sat down). On top of that:
> comfort, familiarity, trust and tension are derived daily from that
> evidence instead of being seeded at day zero and never written again;
> cultures keep an accommodation history, observe the calendar, rub against
> each other by actually sharing a room, shift their preferences toward what
> they have been served, and pass the word weekly; and a real slight opens a
> misunderstanding that names its own remedy, which `make_amends_to_culture`
> settles. `seat_groups_apart` is the first policy to carry the
> `cultural_accommodation` tag that two systems had been looking for since
> Phase 38 without ever finding — it buys friction off and charges seats and
> server time for it.
>
> **§8.3 (notable NPCs) is done (2026-08-07).** The nine notable NPCs have
> existed since Phase 44 as names the issue-seed prose refers to; nothing
> had ever written to one, including the `lastSeenDay` their own record
> declares. §8.3's distinctive constraint is the design — "do not promote
> every generated name into a full agent" — so there are two tiers.
> Everybody gets a cheap record: what the house has had to do with them,
> how they feel about the owner, when they are about (a market factor keeps
> market days, a smuggler keeps nights), and what they can put behind
> something. Only somebody the house has dealt with four times AND who
> matters to something live — a case open, a loan outstanding, their
> faction taking a position — is promoted to an actor, capped at four at a
> time with a grace window so nobody flickers. The promoted get a goal, a
> five-move action set that lands in service, factions, suppliers,
> regulation and arcs, and a two-day announced intent; their offers carry
> deadlines and being ignored costs more than being turned down. Also
> closes the two culture hook families §8.2 left open
> (`culture_walkout_risk_*`, `culture_seating_backlash_*`) — 8.2 machinery
> that was simply missed.
>
> **§8.4 (the rumour network) is done (2026-08-07), which closes DEP-10 and
> the rumour half of OBL-08.** Talk used to appear at full volume in
> everybody's ears at once and then get quieter: a bag of records with a
> strength and an `accuracy` that decided nothing. A rumour now has a
> source, an audience it reached one hop at a time, a credibility separate
> from its volume, and a version of itself that drifts from what was
> originally said. It travels through the people the world already has —
> promoted NPCs, factions, cultures and customer groups — and only through
> those willing to repeat it, bounded six ways (6 audiences, 5 hops, 2
> spreads per rumour per day, 4 a day overall, 3 shares per channel per
> week, counter-stories one deep). Belief hardens when a story is heard
> from two directions and falls when it is denied, countered, contradicted
> or traced home; three owner actions (deny it, put a story about, name the
> source) are all answers a player can be wrong to give, since denying a
> TRUE story costs credit when the denial is tested. `rumour_pressure` now
> reads what the town CREDITS rather than how often it is repeated, which
> is what makes those three actions move the meter honestly. Every material
> deletion — the daily fade, the monthly prune, the overflow — leaves a
> cause naming what went, alongside the §1.4 grouped cause for the day's
> drift, which is the rumour half of OBL-08; five `HOOK-*` families
> (`rumour_escalation_*`, `rumour_denial_backfire_*`,
> `counter_rumour_runaway_*` and their two-part forms) stop draining and
> resolve against the live rumour. Three defects fixed on the way: nothing
> spread at all until minted rumours were given an origin (a channel may
> only repeat what it has heard); propagation would revive a story nobody
> had mentioned in three months, which also made the monthly stale prune
> dead code; and a rumour created between the day's `rumourUpdate` and a
> save was migrated into different network fields than the uninterrupted
> run had, which failed §5.10.
>
> **§8.5 (attribution becomes behavioral) is done (2026-08-07), which closes
> DEP-11 and completes ISSUE-178.** Since Phase 37 the attribution layer has
> produced a rich, aging, merging record of what everybody in the world
> thinks — and exactly one rule in the whole simulation read it as an input
> to a decision (the supplier's price). Everywhere else it fed pressure
> calculators, issue-seed selection and report prose: belief you could read
> about but never feel. It is now a bounded input to **six** domains' own
> rules — supplier quotes and credit lines, customer-group forecast, regular
> visits, staff quit risk, faction goals and target selection, and the way
> the watch and the landlord READ the same facts — and the two words doing
> the work are *capped* and *domain-owned*: the belief layer returns a 0–1
> weight and each domain declares its own ceiling as a named constant.
> Nothing outside a domain mutates that domain. The landlord and the watch
> read only what is being said ALOUD (publicness ≥ 60), because overhearing
> a private grudge would be the leak §8.5 forbids, and the weight is the
> strongest single belief rather than a sum, so "how many separate things
> went wrong" cannot accumulate the way the Wave 7 pressure stacking did.
> `address_grievance` is the move on the other side of it, and it can be
> played badly: answering something somebody is RIGHT about hardens it,
> exactly as denying a true rumour does in §8.4. The two remaining Phase-8
> hook families close here rather than with the rumour network because both
> are promises about belief — the party the house deflected blame onto now
> resents it (accuracy `true`, so it cannot be talked away), and a bribe that
> gets out is believed by the watch, which then reads the next inspection
> harder. **ISSUE-178 is complete.**
>
> **ISSUE-179 §9.1 (the rival tavern) is done (2026-08-07), which closes the
> rival half of DEP-09.** The competitor was three numbers in the monthly
> slice — `pressure`, `appeal` and a `strategy` nothing ever wrote — scaling
> every crowd's turnout by one factor. It is now a record with an
> `ActorState`: it picks a market position from where the house is serving
> worst, hires, moves on price and menu focus, courts named customer groups,
> gets factions to back it, puts about a failing the simulation already has
> (accuracy `partial`, never invented), answers what is said about it, goes
> hard at a crowd on recorded evidence the house failed it, and digs itself
> out of troubles that get worse while it ignores them. It announces two
> days before it moves, like a faction. **Appeal is now derived per customer
> group on both sides** — what that crowd thinks of drinking here against
> what the rival has actually built — so a cheap, loud house is a
> catastrophe for miners and an irrelevance to merchants; the swing keeps
> the old ±20% ceiling, so a rival that has done nothing leaves turnout
> where it was. Rival pressure and the monthly numbers became summaries OF
> that competition rather than the model. Four owner actions answer it
> (scout, win a crowd back, hire out from under them, settle), and the last
> two rebound: poaching schedules a retaliation the rival picks for itself,
> settling schedules the review at which it reconsiders. Four `HOOK-*`
> families stop draining: `rival_retaliation_*`, `rival_dominance_*`,
> `rival_rumour_exposed_*` and `rival_settlement_pact_*` now resolve into
> real rival moves or explained no-ops.
>
> **ISSUE-179 §9.2 (local arcs) is done (2026-08-08), which closes DEP-13.**
> An arc used to age: `progressRules` keyed on `afterDays`, ticked once a
> month, walking `seeded → rising → active → climax → resolved` on a fixed
> clock. Nothing in the world could hurry it, slow it, win it or lose it —
> the blight resolved on day 84 whether the cellar was spotless or crawling.
> Arcs now progress DAILY against a stated **goal**, driven by an **owner**
> resolved once at seed time, who makes **opposing moves** on its own cadence
> and in its own domain (a faction's standing ledger, a supplier's terms, a
> rumour). Stages advance on live state, **fork on branches**, and **time
> out** into a named fallback. The player has two moves — `intervene_in_arc`
> takes one of the arc's own declared interventions, `settle_arc` ends a
> close-run one as a compromise — and the outcome is decided by goal minus
> opposition: **success, compromise, failure**, each with its own aftermath
> and, where it earns one, a **permanent change** the world keeps (an area
> trait, a crowd's base custom, an identity label, a house rule, a supplier's
> terms). Winning branches are gated on the MARGIN rather than goal progress
> alone, so opposition is an opponent rather than a pacing knob, and a stage
> that simply runs out ends on the margin so the compromise band is reachable
> through play. The catalog covers all eight shapes §9.2 requires across nine
> definitions — the five that existed are migrated, not duplicated, and the
> four added are the state-driven crisis, the faction conflict, the recovery
> arc and the arc that changes the world for good. Five `HOOK-*` families
> stop draining: `arc_failure_*`, `blight_brand_lock_*`,
> `arc_exploit_backlash_*`, `arc_faction_debt_*` and
> `arc_supplier_favour_owed_*` now resolve into real arc outcomes, permanent
> locks, owner backlashes and debts collected through the creditor's own
> domain.
>
> **ISSUE-179 §9.3 (expeditions) is done (2026-08-08), which closes DEP-12.**
> A Phase 70 expedition was a wait: a runner, a tier and a day count the
> player typed, a counter, and one roll on the last day that decided
> everything. It is now a **journey**. A **route** sets the distance, the
> danger, what can be found there and — the part that matters — how long
> **word** takes to get home. A **party** goes, carrying a **loadout** that
> is actually eaten day by day, on **contract terms** that are three
> different bets rather than three prices. Up to four **intermediate
> events** fire from a stream indexed by the day of the trip, some of them
> putting a **risk/reward decision** to the house with a deadline that
> includes the round trip — so distance costs information rather than making
> the question impossible, and a party nobody answers takes the cautious
> option itself. **Injury, delay, retreat, recall, rescue and loss** are
> distinct recorded ends, and the outcome is read off the journey rather
> than rolled for it (`ExpeditionOutcome` gained `recalled` and `retreated`,
> because somebody making a call is not a failure). Three road actions —
> answer the dispatch, call them home, send relief — are all gated on word
> having actually arrived. A trip that gets there and back can bring home a
> **discovery**, which is how the Underdeep becomes reachable at all.
> **Who went still decides the trip:** the party's experience and
> reliability set how often the road catches them out and how badly injuries
> land, and the working day at the site is a real **search** — skill plus a
> specialty match, less the tier's difficulty and whatever the journey has
> already cost them. That is what keeps Phase 77's contract alive now that
> the closing roll is gone (an all-journey outcome briefly made a master
> forager and a rookie identical), and it is what `failure` now means: they
> got there, and there was nothing there for them. The commission sheet
> gained the route, party, loadout and terms pickers and lost the duration
> segment the engine had stopped reading.
> **Next: §9.4 (month modifiers as processes).**
>
> **Still open in Phase 9:** six `HOOK-*` families from the rival and arc
> CONTENT — `price_war_*`, `quality_arms_race_*`, `festival_obligations_*`,
> `payday_brawl_legend_*`, `payday_gouging_remembered_*`,
> `payday_supplier_return_*`. All six are `arcKey`-shaped promises from the
> seasonal-arc seed generator, and the machinery to close them exists; they
> want picking up alongside §9.4.
>
> Everything else below — the Complete Surface resume points, the
> onboarding arc, the standing tails — is **paused, not cancelled**, and
> keeps its status for when the pause lifts.

The expansion plan targets **causal completeness**: nine broken gameplay
obligations (`OBL-01…OBL-09`) plus the simulation-depth gaps behind them.
Its §5 work protocol governs every phase — rediscover the current code,
write the phase ledger, write failing contract tests first, implement
state + rules + player capability + autonomous behavior + reporting +
persistence together, then run the gates. A phase fails if only the data
model or UI exists, if a test reaches the feature by injecting impossible
state, or if the system's only consequence is a direct meter adjustment.

**Repository preparation (2026-07-29, this pass — no behavior change).**
The plan's §3 inventory was verified against `HEAD` (all 22 counts still
hold, read out of the live registries) and the gate baseline recorded:
`npm run test:full` **299 files / 3,831 tests**, `npm run typecheck`
clean, `npm run check` 979 files / 0 errors, `npm run build` passing with
the known >500 kB chunk warning §13.5 asks to split. Both are written
into the plan's §2.1/§3 as Phase 0's freeze reference.

**Two things the preparation pass surfaced, neither silently applied:**

1. **Quick Day reverses a recorded decision.** Audit record `DC-01`
   (2026-07-28) retired Quick Day as a player-facing route for 0.1.0;
   the plan's OBL-06 / §12.2 requires it built with a reachable
   eligibility rule, and its scope rule forbids closing the gap by
   deleting the UI. The plan is the later authority, so Phase 12
   (ISSUE-182) implements it and `DC-01` is treated as superseded —
   **flagged for the user to reverse before Phase 12 if retirement was
   the intent.** Detail: plan §6.2. Nothing earlier depends on it.
2. **Three audit follow-ups are absorbed, not duplicated.**
   ISSUE-168 → Phase 5 (**closed with ISSUE-175**; it is §5.1's
   collapse-must-bind-cash lever),
   ISSUE-167 → Phase 13 (§13.3's long-run matrix supersedes the
   2026-07-28 sweep), ISSUE-169 → Phase 11 (§11.6 attention fairness
   owns rotation). All three keep their IDs; the absorbing phase closes each
   one when it lands. Detail: plan §6.1.

`DC-09` (onboarding vs. complete-surface exposure) and `DC-10`
(supported environments / persistence promise) stay open and untouched —
they gate paused arcs, not this one.

**Closed, for reference.** The 2026-07-26 gameplay-audit remediation arc
(ISSUE-166) closed on 2026-07-28 — all eight waves, gates passed; the
queue (`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`) is a
closed record of 29 findings and eight answered design questions. Its
`fixtures/` probes import the live `src/` tree and remain the fastest way
to reproduce an audit route — reuse them as Phase 0 baseline probes
rather than rebuilding those routes.

### Paused — resume points held for when the pause lifts

1. **Card layer — Complete Surface arc** (was the active frontier).
   Contract: `docs/plans/complete-surface-arc.md`, which holds the per-issue
   detail for ISSUE-136…148. Movement I (ISSUE-136…138) and Movement II's
   first phases (ISSUE-139…140) are `done`. **Resume at ISSUE-141…148**
   (phases 173–180): Movement II content phases 141–146 (reorderable —
   except **ISSUE-144**, which carries the `inspection` actor-asymmetry
   correctness fix and must not be deferred), then the Coverage Gate
   (**ISSUE-147**), then the standing Deepening phase (**ISSUE-148**).
2. **Tier 4 Progressive Onboarding arc** — ISSUE-060…077 (phases 99–116),
   all `open`, strictly linear, never started. Contract:
   `docs/plans/progressive-onboarding.md`. Audit record `DC-09` questions
   onboarding vs. complete-surface exposure — settle it before restarting.
3. **Standing tails.** ISSUE-153 (Choice-Preview Legibility phase 185) is
   `in-progress`: part (a) landed, part (b) — prose-deepening and
   band-cutoff recalibration — is the resume point. ISSUE-130 (Legible
   Surface phase 17, standing recalibration; detail in
   `docs/plans/legible-surface-arc.md`) is likewise standing.
4. **Complete, nothing to resume:** the UI/UX Intuitiveness arc
   (ISSUE-157a…163, phases 190a–196) and the card-layer arcs Living Cast →
   Voiced → Legible → Faithful.

## Issue index

| ID | Title | Grade | Status | Phase |
|---|---|---|---|---|
| ISSUE-001 | Response pipeline + unified pending queue | broken | done | 41 |
| ISSUE-002 | World mutator cause emission + state diff coverage | thin | done | 42 |
| ISSUE-003 | Per-cause `relatedActors` in 4 silent calculators | broken | done | 43 |
| ISSUE-004 | NPC factory + initial notable NPC roster | broken | done | 44 |
| ISSUE-005 | Grow staff roster + role-specific identity | thin | superseded | — |
| ISSUE-006 | Grow areas roster + un-pin `main_room` | thin | superseded | — |
| ISSUE-007 | Grow stock items roster | thin | superseded | — |
| ISSUE-008 | Grow customer groups roster | thin | superseded | — |
| ISSUE-009 | Grow suppliers roster + specialty category | thin | superseded | — |
| ISSUE-010 | Grow cultures + cross-cutting cultures + tag alignment | thin | done | 50 |
| ISSUE-011 | Lift regular cap + add starter regulars | thin | done | 51 |
| ISSUE-012 | Add niche factions + factionUpdate triggers for missing 2 | thin | done | 52 |
| ISSUE-013 | `policy_backlash` family end-to-end | broken | done | 53 |
| ISSUE-014 | `regular_customer` family end-to-end | broken | done | 54 |
| ISSUE-015 | `reputation_shift` family rewrite | broken | done | 55 |
| ISSUE-016 | `violence` family rewrite + rotation | broken | done | 56 |
| ISSUE-017 | `staff_burnout` family rewrite + rotation | broken | done | 57 |
| ISSUE-018 | `inspection` family un-pinning | thin | done | 58 |
| ISSUE-019 | `monthly_review` design decision + implementation | design | done | 59 |
| ISSUE-020 | `activeIssueSeedTags` consumer wiring | thin | done | 60 |
| ISSUE-021 | Calendar tag consumers (priority: `rent_due_soon`) | thin | done | 61 |
| ISSUE-022 | History log pruning policy | thin | done | 62 |
| ISSUE-023 | RNG stream prune or wire | thin | done | 63 |
| ISSUE-024 | Thin family profile depth + core picker rotation | thin | done | 64 |
| ISSUE-025 | Stock-and-recipe model extension | thin | done | 65 |
| ISSUE-026 | Ingredient + starter recipe catalog grow | thin | done | 66 |
| ISSUE-027 | Culinary renown reputation axis | thin | done | 67 |
| ISSUE-028 | Specialty supplier expansion | thin | done | 68 |
| ISSUE-029 | Hireable adventurer roster | thin | done | 69 |
| ISSUE-030 | Expedition subsystem | thin | done | 70 |
| ISSUE-031 | Cook tier grow + preparation gating | thin | done | 71 |
| ISSUE-032 | Demand-side niche customer groups | thin | done | 72 |
| ISSUE-033 | Storage areas + system integration polish | thin | done | 73 |
| ISSUE-034 | Test worker crash silently hides ~58 untested tests | broken | done | 74 |
| ISSUE-035 | `createStateDiff` skips `recipes`, `expeditions`, `hireableAdventurers` | thin | done | 75 |
| ISSUE-036 | Tagged diff boundaries computed but never consumed | thin | done | 76 |
| ISSUE-037 | `HireableAdventurer.wageBase` / `specialty` / `activeFlags` are dead fields | broken | done | 77 |
| ISSUE-038 | Cook tier/skill does not modulate service quality | thin | done | 78 |
| ISSUE-039 | `culinary_renown` fame loop only reaches two consumers | thin | done | 79 |
| ISSUE-040 | Reference validation gaps for staff identity + adventurer reverse edges | broken | done | 80 |
| ISSUE-041 | Staff identity profile pool covers 3 of 8 cultures | thin | done | 81 |
| ISSUE-042 | Niche factions carry no notable NPCs | thin | done | 82 |
| ISSUE-043 | Social rumours never pruned (unbounded growth) | thin | done | 83 |
| ISSUE-044 | Supplier reliability + relationship do not affect pricing | thin | done | 84 |
| ISSUE-045 | `content/text/descriptors.ts` pool still empty Phase 22 stub | thin | done | 85 |
| ISSUE-046 | Staff-management owner actions (hire / fire / kick) missing | broken | done | 86 |
| ISSUE-047 | Generic Ignore button binds to non-ignore slots via verb-only matcher fallback | broken | done | 87 |
| ISSUE-048 | ActionPicker enables owner actions that fail `canApply` (e.g. `patch_roof` with no coin) | broken | done | 88 |
| ISSUE-049 | Persistence contract, migration framework, and save-slot safety | broken | done | 89 |
| ISSUE-050 | Cross-surface owner-action queue validity | broken | done | 90 |
| ISSUE-051 | Day result/report timing and browser RNG seed correctness | broken | done | 91 |
| ISSUE-052 | Validation source-of-truth and reference coverage | broken | done | 92 |
| ISSUE-053 | Web navigation, modal accessibility, and UI state persistence | broken | done | 93 |
| ISSUE-054 | Supplier pricing reaches restock gameplay | thin | done | 94 |
| ISSUE-055 | Area content unpinning and customer-area rotation | thin | done | 95 |
| ISSUE-056 | Advisory UI validity and future card-choice guardrails | thin | done | 96 |
| ISSUE-057 | End-of-day silent failure + UI error visibility | broken | done | 97 |
| ISSUE-058 | Web UI component test coverage gap | thin | done | 119 |
| ISSUE-059 | Unprotected `$derived.by(...)` blocks across the web layer | thin | done | 120 |
| ISSUE-060 | Progressive Onboarding — design contract | design | open | 99 |
| ISSUE-061 | `OnboardingState` slice + schema + migration | thin | open | 100 |
| ISSUE-062 | `gateModule` + `unlocksModule` gating infrastructure | broken | open | 101 |
| ISSUE-063 | Wire `gateModule` into `canonicalPipeline.ts` | thin | open | 102 |
| ISSUE-064 | Trim `createInitialTavernState()` with `mode` flag | thin | open | 103 |
| ISSUE-065 | New-game multi-step flow (owner + tavern naming) | thin | open | 104 |
| ISSUE-066 | Staff candidate pool + selection at start | thin | open | 105 |
| ISSUE-067 | `reports` + `tavern_management` UI unlocks (days 2–3) | thin | open | 106 |
| ISSUE-068 | `suppliers` unlock (day 4) | thin | open | 107 |
| ISSUE-069 | `crises` unlock — issue seeds + responses (day 5) | thin | open | 108 |
| ISSUE-070 | `weekly_report` (day 7) + `weekly_economy` (day 14) split gating | thin | open | 109 |
| ISSUE-071 | `regulars` unlock (day 10) | thin | open | 110 |
| ISSUE-072 | `cultures` unlock (day 12) | thin | open | 111 |
| ISSUE-073 | `factions` unlock (day 17) | thin | open | 112 |
| ISSUE-074 | Grouped late unlocks — policies (21), monthly (28), projects (42), expeditions (70) | thin | open | 113 |
| ISSUE-075 | Sub-tab gating in Reports / World / Tavern | thin | open | 114 |
| ISSUE-076 | Discovery card narrative pass | thin | open | 115 |
| ISSUE-077 | Migration finalize + fixture audit + integration walkthrough | broken | open | 116 |
| ISSUE-078 | UI/UX clarity pass — humanize ids, paths, policies, recipes | broken | done | 117 |
| ISSUE-079 | UI/UX comprehension pass — diff grouping, empty states, glossary, density | thin | done | 118 |
| ISSUE-080 | More tab + save slots + first-encounter hints + difficulty (retroactive) | thin | done | 98 |
| ISSUE-090 | Living Cast Phase A — bounded cast attributes on staff + regulars | thin | done | 121 |
| ISSUE-092 | Living Cast Phase C — composition runtime + first compositional card | thin | done | 123 |
| ISSUE-093 | Living Cast Phase D — six structural gates harness | thin | done | 124 |
| ISSUE-094 | Living Cast Phase E — model-authored generation pipeline | thin | done | 125 |
| ISSUE-095 | Living Cast Phase F (first situation) — staff_aside template | thin | done | 126 |
| ISSUE-096 | Voiced Surface Phase 1 — signal surface; DSL `signalEquals` + wired `repeatCount` | thin | done | 127 |
| ISSUE-097 | Voiced Surface Phase 2 — universal cast: castAttributes on supplier/faction/customer-group/notable-NPC | thin | done | 128 |
| ISSUE-098 | Voiced Surface Phase 3 — establishing-line spike: `supplier_reliability` spec | thin | done | 129 |
| ISSUE-099 | Voiced Surface Phase 4 — retire build-time API pipeline; document Claude Code authoring loop | tech-debt | done | 130 |
| ISSUE-100 | Voiced Surface Phase 5 — title & frame discipline | thin | done | 131 |
| ISSUE-101 | Voiced Surface Phase 6 — choice & consequence voice (composed labels + effect previews) | thin | done | 132 |
| ISSUE-102 | Voiced Surface Phase 7 — Staff & Personnel cluster | thin | done | 133 |
| ISSUE-103 | Voiced Surface Phase 8 — Regulars & Complaints cluster | thin | done | 134 |
| ISSUE-104 | Voiced Surface Phase 9 — Suppliers, Stock & Debt cluster | thin | done | 135 |
| ISSUE-105 | Voiced Surface Phase 10 — Factions & Culture cluster | thin | done | 136 |
| ISSUE-106 | Voiced Surface Phase 11 — Premises & Atmosphere cluster | thin | done | 137 |
| ISSUE-107 | Voiced Surface Phase 12 — Crises & Safety cluster | thin | done | 138 |
| ISSUE-108 | Voiced Surface Phase 13 — Reputation, Rumour & Rivals cluster | thin | done | 139 |
| ISSUE-109 | Voiced Surface Phase 14 — Periodic & Narrative Beats cluster (closes Movement II) | thin | done | 140 |
| ISSUE-110 | Voiced Surface Phase 15 — Reports Prose (connector-only voicing of the daily report) | thin | done | 141 |
| ISSUE-111 | Voiced Surface Phase 16 — Ambient Surface & Legacy Retirement (closes Movement III) | thin | done | 142 |
| ISSUE-112 | Voiced Surface Phase 17 — Cross-Situation Voice Consistency (Movement IV) | thin | done | 143 |
| ISSUE-113 | Voiced Surface Phase 18 — Deepening, Pruning & Voice-Selection Repair (standing) | thin | done | 145 |
| ISSUE-114 | Legible Surface Phase 1 — Signal Salience & Multi-Fact Establishing Line | thin | done | 146 |
| ISSUE-115 | Legible Surface Phase 2 — Preview Legibility Contract & Consequence of Inaction | thin | done | 147 |
| ISSUE-125 | Legible Surface Phase 12 — Economic Previews (Movement VII per-meter 1) | thin | done | 157 |
| ISSUE-127 | Legible Surface Phase 14 — Operational Previews (Movement VII per-meter 3, final) | thin | done | 159 |
| ISSUE-128 | Legible Surface Phase 15 — Report-Prose Legibility (Movement VIII opener) | thin | done | 160 |
| ISSUE-126 | Legible Surface Phase 13 — Social Previews (Movement VII per-meter 2) | thin | done | 158 |
| ISSUE-124 | Legible Surface Phase 11 — Periodic & Narrative content matrices (cluster 8, final) | thin | done | 156 |
| ISSUE-123 | Legible Surface Phase 10 — Reputation, Rumour & Rivals content matrices (cluster 7) | thin | done | 155 |
| ISSUE-122 | Legible Surface Phase 9 — Crises & Safety content matrices (cluster 6) | thin | done | 154 |
| ISSUE-121 | Legible Surface Phase 8 — Premises & Atmosphere content matrices (cluster 5) | thin | done | 153 |
| ISSUE-120 | Legible Surface Phase 7 — Factions & Culture content matrices (cluster 4) | thin | done | 152 |
| ISSUE-119 | Legible Surface Phase 6 — Regulars & Complaints content matrices (cluster 3) | thin | done | 151 |
| ISSUE-118 | Legible Surface Phase 5 — Staff & Personnel content matrices (cluster 2) | thin | done | 150 |
| ISSUE-117 | Legible Surface Phase 4 — Suppliers, Stock & Debt content matrices (Movement VI cluster 1) | thin | done | 149 |
| ISSUE-129 | Legible Surface Phase 16 — The Legibility Gate (Movement VIII centrepiece) | thin | done | 161 |
| ISSUE-130 | Legible Surface Phase 17 — Deepening, Pruning & Recalibration (standing) | thin | in-progress | 162 |
| ISSUE-131 | Faithful Surface Phase 1 — Restore the Test Contract | thin | done | 163 |
| ISSUE-132 | Faithful Surface Phase 2 — Meter Valence (fix direction inversions) | thin | done | 164 |
| ISSUE-133 | Faithful Surface Phase 3 — Distinguishable Choices (dedupe previews + labels) | broken | done | 165 |
| ISSUE-134 | Faithful Surface Phase 4 — Flavor That Doesn't Lie | broken | done | 166 |
| ISSUE-135 | Faithful Surface Phase 5 — Close the Loop (wire the audit into the standing bar) | thin | done | 167 |
| ISSUE-136 | Complete Surface Phase 1 — The Gate-Wiring Contract | broken | done | 168 |
| ISSUE-137 | Complete Surface Phase 2 — drinkOrder Parity | broken | done | 169 |
| ISSUE-138 | Complete Surface Phase 3 — Salience Completeness & the Reachability Allowlist | thin | done | 170 |
| ISSUE-139 | Complete Surface Phase 4 — Suppliers, Stock & Debt matrix fill | thin | done | 171 |
| ISSUE-140 | Complete Surface Phase 5 — Staff & Personnel matrix fill | thin | done | 172 |
| ISSUE-141 | Complete Surface Phase 6 — Regulars & Complaints matrix fill | thin | open | 173 |
| ISSUE-142 | Complete Surface Phase 7 — Factions & Culture matrix fill | thin | open | 174 |
| ISSUE-143 | Complete Surface Phase 8 — Premises & Atmosphere matrix fill | thin | open | 175 |
| ISSUE-144 | Complete Surface Phase 9 — Crises & Safety matrix fill (+ inspection actor-asymmetry fix) | broken | open | 176 |
| ISSUE-145 | Complete Surface Phase 10 — Reputation, Rumour & Rivals matrix fill | thin | open | 177 |
| ISSUE-146 | Complete Surface Phase 11 — Periodic & Narrative matrix fill | thin | open | 178 |
| ISSUE-147 | Complete Surface Phase 12 — The Coverage Gate (centrepiece) | thin | open | 179 |
| ISSUE-148 | Complete Surface Phase 13 — Deepening, Pruning & Recalibration (standing) | thin | open | 180 |
| ISSUE-149 | Choice-Preview Legibility Phase 1 — Effect Contract: carry the meter | broken | done | 181 |
| ISSUE-150 | Choice-Preview Legibility Phase 2 — Selection Policy: show what matters | broken | done | 182 |
| ISSUE-151 | Choice-Preview Legibility Phase 3 — Pool Vocabulary: name it, ground it | broken | done | 183 |
| ISSUE-152 | Choice-Preview Legibility Phase 4 — The Legibility Gate, completed | broken | done | 184 |
| ISSUE-153 | Choice-Preview Legibility Phase 5 — Drive, tune, deepen (standing) | thin | in-progress | 185 |
| ISSUE-154 | Early-game complaint fairness — gate customer_complaint on persistence; scope the "unanswered complaint" claim | broken | done | 187 |
| ISSUE-155 | Causal establishing line — surface seed.causes as the customer_complaint body's lead fact | thin | done | 188 |
| ISSUE-156 | Consequence-legible choices — surface one delayed effect + cross-actor identity on active choices | broken | done | 189 |
| ISSUE-157a | UI Intuitiveness Phase 1a — Interconnection primitives + routing + drilldown paths | thin | done | 190a |
| ISSUE-157b | UI Intuitiveness Phase 1b — Consumer wiring (EntityLink/MetricLink call sites) | thin | done | 190b |
| ISSUE-158 | UI Intuitiveness Phase 2 — Pressure stakes and danger zones (reuse sim consequences + severity band) | thin | done | 191 |
| ISSUE-159 | UI Intuitiveness Phase 3 — TopBar stakes reframe (time economy, not action points) | thin | done | 192 |
| ISSUE-160 | UI Intuitiveness Phase 4 — Action effect previews + suggestions in Plan beat | thin | done | 193 |
| ISSUE-161 | UI Intuitiveness Phase 5 — Typography scan-speed pass | thin | done | 194 |
| ISSUE-162 | UI Intuitiveness Phase 6 — Reports → Action conversion | thin | done | 195 |
| ISSUE-163 | UI Intuitiveness Phase 7 — Day dominance and cleanups | thin | done | 196 |
| ISSUE-164 | Cause-coverage instrument repair (dead check, convention split, meta clobbering) | broken | done | 197 |
| ISSUE-165 | UX polish pass: ID leaks, theme unlock, CTA hierarchy, service feedback | solid | done | 198 |
| ISSUE-166 | **Gameplay-audit remediation arc (2026-07-26, 29 findings, Waves 0–7)** | broken | done | 199–206 |
| ISSUE-167 | Strategy-arm diversification: distinct `chooseResponse` policies per bot; close the two residual Wave 7 gaps (miner dominated on easy×partial; hard×actions-only identity convergence) | thin | open | 220 (absorbed by ISSUE-183) |
| ISSUE-168 | Satisfaction→traffic elasticity (DC-04 follow-up): make demand collapse on sustained neglect so coin can bind; re-baseline the balance matrix after | design | done | 212 (absorbed by ISSUE-175) |
| ISSUE-169 | Visible-turn rotation for the remaining rotating seed families (food_safety, stock_shortage, maintenance, staff_identity, …) — extend Wave 7's `reconcilePicksWithSurfaced` beyond violence | thin | open | 218 (absorbed by ISSUE-181) |
| ISSUE-116 | Legible Surface Phase 3 — Choice Distinctness Gate & Legible Choice-Set Cap | broken | done | 148 |
| ISSUE-170 | Expansion Phase 0 — freeze the baseline; build the implementation ledger | design | done | 207 |
| ISSUE-171 | Expansion Phase 1 — shared contracts: typed scheduled events, obligation primitives, persistent ruleset, causal coverage, informative meters, actor interface | broken | done | 208 |
| ISSUE-172 | Expansion Phase 2 — areas, construction, and the complete upgrade lifecycle (OBL-01) | broken | done | 209 |
| ISSUE-173 | Expansion Phase 3 — persistent workforce: contracts, schedules, relationships, real resignation (staff half of OBL-02) | broken | done | 210 |
| ISSUE-174 | Expansion Phase 4 — capacity-constrained service flow, customer choice, active regulars, patron tabs | thin | done | 211 |
| ISSUE-175 | Expansion Phase 5 — economy: quality→cash feedback, operating costs, failure/recovery states, adaptive demand, enforceable policies | broken | done | 212 |
| ISSUE-176 | Expansion Phase 6 — transactional suppliers: orders, deliveries, credit, invoices (OBL-04) | broken | done | 213 |
| ISSUE-177 | Expansion Phase 7 — loans, tenancy, and a real inspection lifecycle (OBL-03 + loan/eviction half of OBL-02) | broken | done | 214 |
| ISSUE-178 | Expansion Phase 8 — autonomous social world: faction/culture/NPC agency, rumour propagation, behavioral attribution (rumour half of OBL-08) | broken | done (8.1–8.5) | 215 |
| ISSUE-179 | Expansion Phase 9 — rival actor, state-driven local arcs, deeper expeditions, month modifiers as processes | thin | in progress (9.1–9.3 done) | 216 |
| ISSUE-180 | Expansion Phase 10 — populated teleology, causal identity with hysteresis, character arcs, earned nicknames (OBL-09 + mastery half of OBL-08) | broken | open | 217 |
| ISSUE-181 | Expansion Phase 11 — reconnect issues, responses, pressures, feedback, memory and history to the deepened domains (closes OBL-02) | broken | open | 218 |
| ISSUE-182 | Expansion Phase 12 — ongoing difficulty, reachable Quick Day, correct planning horizon, new management surfaces, derived Help (OBL-05/06/07) | broken | open | 219 |
| ISSUE-183 | Expansion Phase 13 — migration, long-run balance matrix, performance, obligation-closure audit, release proof | broken | open | 220 |

---

## Live issues

Full entries for open and in-progress work only. ISSUE-141…148 (Complete
Surface) and ISSUE-130 are tracked in their arc docs, per the resume points
above; ISSUE-170…183 are tracked in the expansion work plan, per Tier 8.

### Tier 8 — Simulation expansion and obligation closure (the only unpaused arc)

**Authority:** `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md`
— a standalone implementation document. It holds each phase's objective,
required work, required tests, and completion gate; **the tracker does not
restate them.** Read the plan's phase section before implementing, exactly
as the audit arc read its queue. Per-phase plan docs are *not* wanted —
the work plan is the arc doc, and repo policy is to record fix detail in
the code or the plan rather than in new per-phase prose.

**Shape of the arc.** Fourteen phases, one issue each, hard-ordered by the
plan's §7 dependency map — with the single exception that ISSUE-172 and
ISSUE-173 (plan Phases 2 and 3) may proceed in parallel once ISSUE-171 is
`done`. A phase is a vertical slice: state, rules, player capability,
autonomous behavior, reporting, and persistence land together, or the
phase is not done. The plan's §5 lists the eight conditions that fail a
phase; the sharpest are *only the data model or UI exists*, *a test
reaches the feature by injecting impossible state*, and *the system's only
consequence is a direct pressure or reputation adjustment*.

| Issue | Plan phase | Repo phase | Closes | Depends on |
|---|---:|---:|---|---|
| ISSUE-170 | 0 — baseline + ledger | 207 | coverage only; ends with **no intended behavior change** | none |
| ISSUE-171 | 1 — shared contracts | 208 | foundation for OBL-02/05/08 | ISSUE-170 |
| ISSUE-172 | 2 — areas + upgrades | 209 | **OBL-01** (closed) | ISSUE-171 |
| ISSUE-173 | 3 — workforce | 210 | staff half of **OBL-02** (closed) | ISSUE-171 |
| ISSUE-174 | 4 — service flow | 211 | — | ISSUE-172, ISSUE-173 |
| ISSUE-175 | 5 — economy | 212 | done; supports OBL-04/05; **ISSUE-168 closed** | ISSUE-174 |
| ISSUE-176 | 6 — suppliers | 213 | done; **OBL-04 closed** | ISSUE-175 |
| ISSUE-177 | 7 — loans, tenancy, inspection | 214 | done; **OBL-03 closed** + loan/eviction half of **OBL-02** | ISSUE-175 |
| ISSUE-178 | 8 — social world | 215 | **done** — rumour half of **OBL-08** closed; DEP-08, DEP-10 and DEP-11 closed, DEP-09 NPC half | ISSUE-176, ISSUE-177 |
| ISSUE-179 | 9 — rivals, arcs, expeditions | 216 | — | ISSUE-178 |
| ISSUE-180 | 10 — teleology + identity | 217 | **OBL-09** + mastery half of **OBL-08** | ISSUE-179 |
| ISSUE-181 | 11 — issues/responses refit | 218 | all of **OBL-02**; **absorbs ISSUE-169** | ISSUE-180 |
| ISSUE-182 | 12 — difficulty, Quick Day, UI, Help | 219 | **OBL-05**, **OBL-06**, **OBL-07** | ISSUE-181 |
| ISSUE-183 | 13 — release proof | 220 | proof for all nine; **absorbs ISSUE-167** | ISSUE-182 |

**Grades** in the index follow the tracker's convention rather than the
plan's: `broken` where the phase closes an obligation the game already
advertises but cannot honor, `thin` where it deepens a system that works
but is shallow, `design` for ISSUE-170 (it produces a ledger and probes,
not behavior).

**Preparation record (2026-07-29).** The plan's §3 inventory was verified
against `HEAD` — all 22 counts unchanged — and the gate baseline measured
and written into the plan (§2.1, §3): `npm run test:full` 299 files /
3,831 tests, `typecheck` clean, `check` 979 files / 0 errors, `build`
passing with the known large-chunk warning. Phase 0 freezes against those
numbers. The ledger location is reserved at
`docs/plans/expansion/ledger.csv` (generator/validator under `scripts/`)
so later phases update one file instead of each growing a private copy.

**ISSUE-170 / Phase 0 — done 2026-07-29, no behavior change.** Full
record in the plan's Phase 0 section ("What Phase 0 actually landed").
Three derived, test-gated artifacts under `docs/plans/expansion/` are now
the arc's authoritative baseline:

- `ledger.csv` — 127 rows: `OBL-01…09`, `DEP-01…20` (plan §4.2), and one
  `HOOK-*` row per player-facing future-hook family (98 families across
  189 emission sites). `npm run ledger:check` validates it and fails when
  a hook has no row, a row has no hook, or a cited path has moved.
- `baseline-probes.json` — 13 frozen route snapshots (`npm run
  baseline:probes`), probes in `src/sim/testing/expansionBaseline.ts`.
- `repo-map.json` — the §"Repository map" deliverable (`npm run
  repo:map`): scripts, runtime versions, pipeline/phases/segments,
  module-owned slices, 15 named RNG streams, the empty unscoped-random
  lists, save version + 12-step migration chain, §3's inventory, and all
  127 Help/glossary promises.

Gates: `npm run test:full` **301 files / 3,874 tests**, `npm test` 293 /
3,745, `typecheck` clean, `check` 980 files / 0 errors, `build` passing
(same chunk warning). Tests: `tests/sim/phase207.baselineAndLedger.test.ts`
(40) and `tests/sim/phase207.dayBeatPersistence.test.ts` (3 — save/load at
Morning, Plan, Service, Closing, Report, plus the mid-day-reload parity
the §5.10 protocol requires of every later phase). Every probe route runs
under ~1.3 s, so neither file joins `HEAVY_TEST_GLOBS`.

Two judgement calls worth carrying forward, both recorded in the plan:
the **supplier-focused route is frozen now** rather than deferred to
Phase 6 (so Phase 6 has a before-picture), and a **fourteenth route,
`responsive-route`, was added** because every route the plan lists answers
no cards and therefore records an empty pending queue — it is what makes
the OBL-02 baseline legible.

**Test-tier note.** Several phases add long-horizon playtests (§5.10's
save/reload beats, §13.3's 28/90/180-day matrix). Anything that grows into
a multi-minute run belongs in `HEAVY_TEST_GLOBS` in `vitest.config.ts` and
nowhere else, so `npm test` stays the fast tier and `npm run test:full`
stays the pre-merge gate.

**ISSUE-171 / Phase 1 — done 2026-07-29.** The seven shared contracts,
all under a new `src/sim/contracts/` tree with one barrel each. Detail
lives in `docs/plans/expansion/ledger.csv` rows **`CON-01`…`CON-07`** (one
per plan sub-section) — no per-phase plan doc, per the arc's convention.

- **§1.1 typed scheduled events** (`CON-01`). A registry where a mechanical
  event has exactly one owning module, a payload schema, a beat, a warning
  window, repeat/cancel/supersede/expiry rules, an exact-once key, and a
  resolver that must name an authoritative mutation — a zero-weight cause
  no longer counts as resolution. Owned by a new `scheduledEvents` module
  draining at two beats: `morning` inside `startDay`, and `wrap_up` in a
  new `resolveScheduledEvents` phase placed immediately after
  `applyResponses` (so a consequence coming due sees the day's choices)
  and before `endDay`. Segment boundaries are unmoved, and an architecture
  test now asserts that.
- **§1.2 obligation primitives** (`CON-02`). Payable/receivable records
  with principal, accrued charges, due dates, grace, partial payment,
  default, collections, settlement and forgiveness, plus the
  order/employment/regulatory/tenancy/construction shapes that share the
  lifecycle. Deliberately not a god-module: each record names its
  `ownerModuleId` and that domain decides when to open, pay or forgive;
  the ledger owns only the uniform due→grace→default progression, driven
  by two registered mechanical events.
- **§1.3 persistent ruleset** (`CON-03`). Difficulty is now versioned,
  persisted state, queryable by named knob, and consumed by four ongoing
  rules (area deterioration, spoilage, staff recovery, pressure-adjustment
  decay). Easy/standard/hard diverge measurably under identical seeds —
  the OBL-05 foundation.
- **§1.4 causal coverage** (`CON-04`), **§1.5 informative meters**
  (`CON-05`), **§1.6 actor interface** (`CON-06`), **§1.7 architecture
  checks** (`CON-07`).

**The reference route is bit-identical.** `standard` is exactly neutral on
every ruleset knob, and all **13 frozen Phase 0 baseline probes are
unchanged (`npm run baseline:probes` → 0 drifted)**. Two frozen counts in
`repo-map.json` did move — `runtimeModules` 29 → 33 and `simulationPhases`
25 → 26 — which is the plan's sanctioned "update in place as later phases
land", not a red test being written green; the other 22 inventory counts
are untouched, which is the real evidence that Phase 1 added contracts and
no content.

**Two real bugs found and fixed by the new machinery,** both pre-existing:
`canonicalCauseTarget` had no mapping for `arcs.*` / `ventures.*` /
`transformations.*`, so every arc spawn and permanent transformation was
reported as an *unexplained* significant change despite having a perfectly
good cause in `state.causes` — the attribution was there, the join was
missing. And nothing verified that a module's `dependsOn` actually runs
first; `checkModuleOrder` now does.

**Scope deliberately left for later phases,** recorded rather than
silently dropped: there is **no owner action to pay an obligation** (an
action with nothing to act on is not discoverable — it belongs to Phase 6
invoices / Phase 7 loans and rent, and Phase 12 owns new management
surfaces); `applyDebtToRecovery` has no production caller yet (Phase 2
routes clean/repair through it, and Phase 10 is the hysteresis latch's
first real consumer); and module contracts are declared for 9 of 33
modules, per §1.7's
"migrate one domain at a time" — the test pins that count so it can only
go down.

**Known hazard recorded, not fixed:** `diffModules` iterates object key
order, so diff *order* can vary between a batch run and a reloaded
segmented run. It surfaced when the new meters slice tripped it; the slice
is now excluded from diffing as derived bookkeeping, which removes the
symptom. Sorting the walk is the real fix and is a separate change with
wide snapshot churn — noted on `CON-04`.

Tests: `tests/sim/phase208.sharedContracts.test.ts` (50),
`phase208.exactOnce.test.ts` (7 — exact-once across normal play, retry,
save/load, import and segment resume, plus §5.9 full-day-vs-segmented
equivalence and §5.10 reloads at both crossed beats), and
`phase208.metersAndHooks.test.ts` (20). Everything that needs a live
context — the obligation lifecycle, both branches of the future-hook
bridge, the hysteresis latch, and actor intent/execution — is exercised end
to end by `src/sim/testing/expansions/obligationProbe.ts`, a real producer
on the sanctioned public API following the `candleShortage` precedent, not
fixture injection. All three files run in seconds, so none joins
`HEAVY_TEST_GLOBS`.

Gates: `npm run test:full` **304 files / 3,951 tests**, `npm test` 296 /
3,822, `typecheck` clean, `check` 1,014 files / 0 errors, `build` passing
(same known >500 kB chunk warning §13.5 asks Phase 13 to split), and all
three expansion artifacts clean — `ledger:check` 134 rows,
`baseline:probes` 0 drifted, `repo:map` 0 sections drifted.

**Open question carried into the arc — Quick Day.** `DC-01` retired it;
OBL-06 requires it. The plan (§6.2) records the reversal and the reason,
Phase 12 implements it, and the user can reverse that before ISSUE-182
starts without disturbing any earlier phase.

**ISSUE-172 / Phase 2 — done 2026-07-30. OBL-01 closed.** Full record in
the plan's Phase 2 section ("What Phase 2 actually landed"); per-requirement
detail in `docs/plans/expansion/ledger.csv` rows **`OBL-01`**, **`DEP-03`**
and three `HOOK-*` rows. No per-phase plan doc, per the arc's convention.

Eighteen upgrades were catalogued and none could be installed. Now:

- **One authoritative record.** `AreaUpgradeState` carries the accepted
  quote, banked labour, materials consumed, why the last tick stalled, and
  the installed fitting's own condition and upkeep clock.
  `src/sim/modules/areas/construction.ts` is its only writer; owner
  actions, scheduled events and propagation edges all request transitions
  there. `paused` and `cancelled` joined the status enum so
  start → pause → resume → cancel is a real path.
- **Seven owner actions** (`start_/fund_/pause_/resume_/cancel_/repair_/
  maintain_area_upgrade`) on `"<areaId>:<upgradeId>"` composite targets,
  every target's hint carrying its quote. Discovery is the whole
  catalogue per room, with a specific reason on anything that cannot start.
- **Capacity is derived, not stored** — base size + installed fittings −
  blockage — with four kinds (`seats`/`workstations`/`storage`/`beds`),
  each with a real consumer: crowding and privy load feed customer
  satisfaction, workstations gate construction concurrency, storage feeds
  spoilage. A stored `usableSeats` would be a second representation that
  could disagree with the records.
- **Eight bounded propagation edges**, each naming the physical route it
  travels; the two cross-room ones are checked against the adjacency graph
  (11 links across 9 areas, of 36 possible pairs) rather than trusted.
  Every edge reads one pre-pass snapshot and writes one target, so nothing
  cascades within a day.
- **The schedule is load-bearing:** `tickConstruction` advances only the
  sites the day's schedule cleared, and a conflicted block always says why.
  The locked 360-minute owner budget is untouched; travel/setup is charged
  in labour, not minutes.

**The owner-project model is unified, which meant retirements.** The five
starters that each built an area upgrade wrote a *trait* plus their own
progress row while the matching upgrade record sat at `available` forever
— the exact duplication the plan forbids. They are retired and live on as
`legacyProjectType` on their upgrade definitions; `fund_active_project`
and `cancel_project` went with them, because those five records were their
only possible targets. **Owner actions stay at 41** (seven in, seven out).
The general project system is kept with an empty starter list for the
non-upgrade projects the plan permits, and **in-flight and completed
legacy project rows convert to authoritative upgrade records on load**
(`ensureAreaConstructionFields`), so no save loses work it paid for.

**Three future-hook families moved from narrative to mechanical:**
`failed_patch_possible`, `area_collapse_risk_*`,
`area_project_completion_*`. Each performs an authoritative mutation and
each has an explained no-op for the player who put the room right first.
This needed one **additive extension to the Phase 1 bridge** —
`futureHookPrefixes`, because Phase 1 matched hook names against the
event-type key exactly and the parameterised families are the majority of
the `HOOK-*` rows. Every later phase inherits it. Three area-ish families
**stay narrative with the reason recorded**: `area_failure_possible` (seed-
level hooks never reach the bridge — Phase 11), `cellar_capacity_unlocked_*`
(honouring it means installing a fitting nobody paid for — Phase 5 owns
the monthly domain), `main_room_too_dark` (a test fixture, not content).

**CON-05 closed as a side effect** — `applyDebtToRecovery` finally has its
production caller, so one new fitting does not undo a fortnight of
neglect.

**Two new content items, and why:** `timber` and `cut_stone`, because §2.3
requires a build to consume materials and a quote listing materials it
cannot draw from anywhere is the "data model only" failure §5 rules out.
They follow the `firewood`/`mugs` precedent (non-menu stock with a 1:1
`upkeep`-tagged recipe so the stock/recipe pairing invariant stays total)
and are procured through the existing `restock_item`. Stock and recipe
counts 20 → 22; **area upgrades stay at 18** — the phase makes the
catalogue buildable rather than growing it.

**Calibration judgement worth carrying forward.** `main_room` seats **90**
(pooled customer-facing 110) so the *reference route never overcrowds* —
its busiest measured evening is 103 patrons. Capacity binds when the
**player** makes it bind: a build closing part of a room, a room left to
rot below condition 35, or patronage grown past the house. An earlier
60-seat calibration taxed every opening night and displaced the `violence`
family from the DC-06 attention budget, which is the wrong shape for a
constraint. Queues, patience and abandonment stay Phase 4's.

**All 13 frozen baseline probes drifted and were regenerated
deliberately** — +2 stock/recipe records in every `collections` count,
`activeProblems` where an edge fired, and on the managed multi-week routes
the crowding and storage rules shifting traffic, satisfaction and coin by a
few percent (the reference `no-action` route moved by one visitor).
`repo-map.json` moved on three sections plus two new glossary terms.

**Eight review findings fixed before merge** (Codex on PR #247 — one P1,
seven P2), each with a regression test; the plan's Phase 2 section lists
them. The P1 was the one that would have shipped a dead end: an existing
save keeps its own `stock` map and nothing merged new registry records
into it, so `timber` / `cut_stone` never existed for an existing player —
every material line read "0 held" and `restock_item` could not offer a way
to buy any, leaving those upgrades permanently unbuildable. The rest were
promises the code was not keeping: a broken fitting kept giving the room
what it gave when installed, crew labour was split across sites the
schedule had not cleared (so part of it vanished), workstation capacity
constrained nothing, a superseded upgrade could be rebuilt alongside its
replacement, cellar pests reliably gnawed the non-perishable firewood,
migrated builds finished on materials they never drew, and a patch failure
could collapse an unrelated room.

Gates: `npm run test:full` **307 files / 4,027 tests**, `npm test` 299 /
3,898, `typecheck` clean, `check` 1,024 files / 0 errors, `build` passing
(same known >500 kB chunk warning), and all three expansion artifacts clean
— `ledger:check` 134 rows, `baseline:probes` 0 drifted, `repo:map` 0
sections drifted. Tests:
`tests/sim/phase209.areaUpgradeLifecycle.test.ts` (35),
`phase209.areaCapacityAndPropagation.test.ts` (27),
`phase209.constructionBeatPersistence.test.ts` (3 — a reload at all five
player beats with a live build, and full-day-vs-segmented equivalence
across a week of construction, upkeep and propagation). All three run in
seconds, so none joins `HEAVY_TEST_GLOBS`.

**ISSUE-173 / Phase 3 — done 2026-07-30. The staff half of OBL-02 closed.**
Full record in the plan's Phase 3 section ("What Phase 3 actually landed");
per-requirement detail in `docs/plans/expansion/ledger.csv` row **`DEP-04`** and
twelve `HOOK-*` rows. No per-phase plan doc, per the arc's convention.

The game told the player, 189 times across 98 hook families, that a named staff
member might quit. It could not happen. Now:

- **Founding staff are no longer immune.** `startDay` used to throw on a missing
  cook/server/cleaner_bouncer, validation reported it as an error, and
  `fire_staff` refused to offer them — so the central staff promise was
  structurally impossible for the only three people it could be about. All three
  guards are gone; a missing role is a **coverage gap** with a cost the crew
  carries in stress. The two Phase 86 tests that pinned the exemption are
  inverted, because "the run survives losing a founding role" is what replaces
  the guard.
- **Employment is a record with terms.** `EmploymentRecord` (the Phase 1 family)
  carries wage, notice clock, discipline rung and transition history;
  `src/sim/modules/staff/employment.ts` is its only writer and **the only remover
  of staff**, because a safe separation is severance + archive + edges dropped +
  actor dropped + events withdrawn + vacancy opened + colleagues told +
  cause/memory/history/pressure, and performed twice one copy forgets half.
- **Hiring is a decision about a person.** `hire_staff` keeps its id and 40-coin
  fee but targets an **applicant** from a bounded, weekly-refreshing board that
  always answers an open vacancy. Two new named RNG streams (`labor_market`,
  `staff_wellbeing`) keep applicant generation and illness rolls from shifting
  anybody's generated name.
- **The roster is what service is derived from.** One number per person
  (`contribution`), with every factor on the same row. The default assignment
  scores exactly 1, so the reference route's service numbers did not move and
  every deviation is the player's doing. Shifts change *what* is covered, not how
  many minutes exist — the 360-minute owner budget is untouched.
- **Wages are partial-first and a shortfall is a debt.** The old rule paid
  everybody or nobody, so non-payment was a mood. Now the till pays as far as it
  goes, longest-serving first, and the remainder is a per-person payable in the
  shared obligation ledger. `pay_staff_wages` is the first owner action to settle
  an obligation — the gap Phase 1 recorded as belonging to whichever phase gave
  the player something worth paying. A fully-covered bill opens no obligation at
  all.
- **Twelve hook families became mechanical**, including `staff_quit_risk_*`,
  whose resolver meets all nine of §3.4's requirements: warned by name with
  itemised contributors and remedies, re-read live when due, and resolving as
  cancelled / no-op / deferred / notice / walk-out, exactly once.
- **Twelve owner actions** (`hire_staff`, `set_staff_shift`, `assign_staff_area`,
  `train_staff`, `promote_staff`, `adjust_staff_wage`, `pay_staff_wages`,
  `grant_staff_leave`, `discipline_staff`, `give_staff_notice`, `fire_staff`,
  `negotiate_with_staff`), each the counterplay to something the simulation now
  does on its own. Owner actions 41 → 51.

**The duplication this phase had to avoid, and did.** Phase 12 already owned a
traffic-driven staff-fatigue rule in the service module. Adding a second one in
the roster made fatigue climb at twice the intended rate — which the first draft
did, and a measurement caught. The rule **moved** into `staff/roster.ts` (staff
owns staff transitions, §5.4), keyed off work kind rather than role, with the
Phase 3 burdens added on top; the service module now reads the roster row for its
report. Both writers of one meter is the shape §2.2 forbade for capacity.

**`src/sim/core/diff.ts` now sorts its module walk** — the real fix Phase 1
recorded as outstanding on `CON-04`. Insertion-order iteration made diff *order*
depend on how a `Record` enumerated, which differs between a factory-built slice
and the same slice rebuilt by the migration chain, so the §5.10 reload gate read
a reloaded day as a different day. Contents unchanged; order only.

**Judgement calls worth carrying forward.** Illness risk is exactly zero below
fatigue 40 / stress 60 / a week without rest, because a day-zero crew losing
somebody on the opening morning reads as arbitrary rather than as consequence.
Negotiation needs standing **and** no outstanding material grievance, or a
stranger could talk their way out of three weeks of unpaid wages. Two new roles
(`head_server`, `head_keeper`, staffRoles 6 → 8) exist so promotion is reachable
for the two families with no rung above them — without them "promotion" is a wage
rise with a new label. `staffPriorities` stays 12: §3.2 makes the existing twelve
load-bearing rather than adding more. One Phase-3 hook family,
`apology_expectation_*`, **stays narrative and its ledger row moved to Phase 4**,
because its subject is a customer group.

**All 13 frozen probes drifted and were regenerated deliberately** — staff meters
under one fatigue rule rather than two, `causes` up and `history` down, and
loyalty down by roughly one unanswered raise request per month on the passive
routes, which is the designed consequence of a player who answers nothing. The
Wave 7 balance harness's published figures were **re-pinned with the movement
recorded**: 3.36 → 3.21 cards/day, 828 → 823 patrons, `finalCoin` unchanged at
1,043 — the evidence that this phase changed how the crew works, not what the
tavern earns per patron. `repo-map.json` moved on `rngStreams` (15 → 17), the
migration chain, `ownerActions`, `staffRoles` and `glossaryTerms` (129 → 135).
The stale `wages` glossary entry was rewritten rather than left describing a rule
that no longer exists.

**Eleven review findings fixed before merge** (Codex on PR #248 — three P1,
eight P2), each with a regression that fails on the pre-fix tree; the full list
is in the plan's Phase 3 section. The three P1s: the weekly settlement cleared
arrears **without spending the coin**, so permanent back pay was free; the
hook-routed `raise_promised_*` fallback compared the wage against the employment
record that granting the rise moves, so every kept promise read as broken
(`lastRaiseOnDay` now records the event, not the level); and `call_in_sick`,
decided at `endDay` when the shift is already worked, opened its absence window
*today* and expired the next morning — so nobody ever missed a roster and
`ABANDONMENT_DAYS` was unreachable. The eight P2s: off-duty colleagues offered as
cover, a promotion cancelling a live quit risk, a promotion not opening a vacancy
for the post it vacated, `pay_staff_bonus` not answering the bonus expectation,
`training_helper_*` teaching the wrong person (its subject is the mentor), a
by-the-book dismissal still costing crew morale, two outcome rows for one
separation firing, and a returnee eligible for a fresh illness roll the morning
they came back. Four of the fixes live in resolvers only a routed future hook
reaches, so those regressions drive them through a test-local **hook courier**
that repeats exactly what `ctxApplier.routeFutureHook` does — the Phase 1
`obligationProbe` precedent, not fixture injection. The round moved none of the
frozen artifacts.

**A second round found seven more, and the player found an eighth** — the one
that mattered most and that no review tool caught: **hiring had no surface
left**. `hire_staff` became "pick a person off a board that expires", and the
Tavern > Staff panel still listed only the people you already employ, with an
empty state pointing at the World screen's adventurer list. The board existed
only in the sim and in the action picker's target sub-sheet. `StaffPanelData`
carries a `hiring` block now — applicants with role, skill, ask, provenance and
days left, each with the same `hire_staff` ref every other row-level action
uses, plus the open vacancies — and the panel renders it under the roster. The
seven review findings: a bonus promise judged on the ordinary wage
(`wage_expectation` never landed); the worker whose load was lightened counted as
their own cover (`coverage_gap` never landed); abandonment unreachable twice over
(one absence's length against a rule nothing produces, and checked after the pass
that clears it — now a remembered RUN of unexcused days, checked first); an actor
handing in notice while its own warning was still running (`scheduleQuitRisk`
returns a discriminated result); the weekly actor allowance refilling on day
seven before that day's action; off-duty colleagues still teaching (all three
"who could do this work" searches go through one `isOnDuty` predicate); and
`negotiate_with_staff` working on a settled employee, which made it a repeatable
morale tap — it now needs something ANNOUNCED (a live quit risk, a resignation on
the record, or a declared intent). A contributor-score gate was tried and
rejected: the score reads live meters that are shed each morning and rebuilt over
the day, so the action would have been offered in the evening and refused itself
the next afternoon.

Gates: `npm run test:full` **311 files / 4,109 tests**, `typecheck` clean,
`check` 1,038 files / 0 errors, `build` passing (same known >500 kB chunk
warning), and all three expansion artifacts clean — `ledger:check` 134 rows,
`baseline:probes` 0 drifted, `repo:map` 0 sections drifted. Tests:
`tests/sim/phase210.workforceLifecycle.test.ts` (36),
`phase210.retentionAndQuitting.test.ts` (35),
`tests/reports/tavernOverviewProjection.test.ts` (+3 hiring-board cases),
`tests/web/components/staffHiringBoard.test.ts` (3),
`phase210.workforceBeatPersistence.test.ts` (6 — a reload at all five player
beats with somebody on notice, somebody owed back pay, a cross-trained second
trade and a live relationship graph, plus full-day-vs-segmented equivalence
across a fortnight crossing a separation and a wage settlement). All three run in
seconds, so none joins `HEAVY_TEST_GLOBS`.

**ISSUE-174 / Phase 4 — done 2026-07-31.** Full record in the plan's Phase 4
section ("What Phase 4 actually landed"); per-requirement detail in
`docs/plans/expansion/ledger.csv` row **`DEP-05`** and nine `HOOK-*` rows. No
per-phase plan doc, per the arc's convention.

Service was one multiplication — turnout × spend rate × satisfaction factor,
with stock drawn down afterwards to match. Nothing inside it could be a
bottleneck, because there was no inside; Phase 2's kitchen throughput and
Phase 3's roster contribution both fed report lines and never reached the till.
Now:

- **Patrons arrive as parties across six waves**, capped at 48 parties of at
  most 12 (the §5.11 caps), with headcount conserved exactly when the cap binds.
  Party size and arrival curve key off `trafficPattern`, so a busy night is a
  different *shape* of evening rather than a bigger number. Regulars get their
  parties first, so a named participant is never squeezed out.
- **Four stages can each be the tightest** — seating, kitchen prep, delivery,
  table reset — derived from the real area and staff rosters, with the default
  crew scoring exactly 1 so the reference route moved only because service has
  an interior now. The kitchen is deliberately tightest, which is what connects
  area upgrades to takings. The report names the binding stage in words.
- **Patience is a clock and abandonment is an outcome** (`served`,
  `abandoned_queue`, `abandoned_wait`, `unserved_at_close`). Table reset scales
  with the room's actual mess, so a dirty area is slow rather than merely
  unpleasant.
- **Customers choose on eleven bounded terms**, with hard vetoes only for
  off-menu items and a group's disliked tags. **Stock is deliberately not a
  veto** — wanting what the house ran out of is the content of a shortage, so
  the unmet want is recorded against the recipe's tightest input instead of
  being rewritten into a want for something in the cellar.
- **Regulars are people with a history**: decaying service memory (half-life 14
  days, capped at 8 entries), owner standing, a *learned* usual dish and usual
  seat, open requests, word of mouth, and a lapse after three bad visits with a
  real condition for coming back rather than a timer.
- **Tabs are owed by somebody** — regular, group cohort or anonymous, with
  collection odds following from that — settled or forgiven by the player and
  swept on `endDay` under declared due/cap/write-off rules.
- **Nine hook families became mechanical** (five service, three regular).
  `merchant_flight_possible` is recorded as staying narrative and its ledger row
  moved to Phase 6, where its subject will exist. **Four owner actions** —
  `collect_tab`, `forgive_tab`, `greet_regular`, `answer_regular_request`.
  Owner actions 51 → 55.

**The duplication this phase had to avoid, and did.** `customers/purchases.ts`
and `customers/impact.ts` were **deleted** rather than left as a second writer
of sales and area wear — the Phase 3 fatigue lesson applied before it could
bite. Customers own demand and satisfaction, service owns the flow and the
slates and area wear, regulars own identity and memory and outcomes.

**Judgement calls worth carrying forward.** Coin is booked at **delivery**, not
at "served", or the ledger and `coinEarned` disagree by whatever the last wave
could not carry out. Tabs are per head and rounded **once per debtor** —
rounding per party inflated slates to 43% of takings. `coinByGroup` stays
**gross**, because `netCoinEarned` already subtracts tabs and netting twice is a
silent 2× on the worst nights. The brawl rule uses ratios and **peak concurrent
occupancy**, so a busy tavern is not automatically a violent one.

**Determinism cost more care than the rules did.** Zod rebuilds objects in
schema order and the day diff renders slices as JSON, so key order is
load-bearing: literal order now matches schema order, `bottleneck` moved last
(the flow assigns it last), and `normaliseParty` **omits** absent optionals
because an explicit `undefined` survives `structuredClone` but breaks the
baseline-patch encoder. One `regularDefaults.ts` is shared by the factory,
emergence and the migration, so a migrated save and a fresh one produce
byte-identical regulars. Two new streams (`service_flow`, `regular_behaviour`),
15 → 19.

**Ten probes drifted and were regenerated deliberately** after the final review
pass — every multi-day route except the three fresh-state probes. The movement
records corrected FIFO stock allocation, request fulfillment, regular memory,
and brawl consequences rather than hiding them behind stale artifacts. The
Wave 7 harness was re-pinned with the movement recorded: 3.21 → 3.18 cards/day,
823 → 805 patrons,
`finalCoin` 1,043 → 1,078. A 3% move in the till while the entire interior of
service was replaced is the evidence the calibration held. The final follow-up
also stopped positive `favourite_served` incidents from counting as customer
complaints, restoring two patrons without moving the calibrated till. Glossary
135 → 143.

**One pre-existing gap found and deliberately not fixed here:**
`reconcilePicksWithSurfaced` covers only the `violence` family, so
`regular_customer` rotation is unenforced. That is ISSUE-169, which the tracker
assigns to Phase 11 — recorded in `tests/sim/phase54.regularCustomer.test.ts`
with a note rather than patched out of sequence.

Gates: `npm run test:full` **316 files / 4,162 tests**, `typecheck` clean,
`check` 1,052 files / 0 errors, `build` passing (same known >500 kB chunk
warning), and all three expansion artifacts clean — `ledger:check` 134 rows (done 33),
`baseline:probes` 0 drifted, `repo:map` 0 sections drifted. Tests:
`tests/sim/phase211.serviceFlow.test.ts` (19),
`phase211.regularsAndTabs.test.ts` (11), `phase211.serviceEvents.test.ts` (10),
`phase211.regularEvents.test.ts` (8),
`phase211.serviceBeatPersistence.test.ts` (5 — a reload at every day beat the
new lifecycle crosses, with a live slate, an open request and a lapsing
regular, plus full-day-vs-segmented equivalence). All five run in seconds, so
none joins `HEAVY_TEST_GLOBS`.

**ISSUE-175 / Phase 5 — done 2026-08-01; ISSUE-168 absorbed and closed.**
Full record in the plan's Phase 5 section ("What Phase 5 actually landed");
per-requirement detail in `docs/plans/expansion/ledger.csv` row **`DEP-01`**
and six `HOOK-*` rows. No per-phase plan doc, per the arc's convention.

- The empty economy module is now a persistent survival loop: smoothed service
  health and collapse/recovery history drive group-specific traffic, spend and
  price tolerance plus supplier, wage, faction, landlord and repair terms. One
  bad day cannot collapse demand; sustained neglect can.
- Daily attributable overhead, maintenance, fitting upkeep, emergency,
  enforcement and financing costs settle into operating arrears. Six financial
  states constrain or stop real service, with registered pay/close/restructure/
  reopen actions and difficulty-scaled recovery terms.
- One exhaustive accounting shape reconciles every daily cash entry and accrual
  fact, then rolls into weekly and monthly results. Day-28 rent refreshes both
  the last daily and last weekly record; live supplier obligations replace the
  old weekly invoice placeholder. Restructuring write-offs and expedition
  return value remain explicit non-cash accruals.
- Policies record intended versus actual operation, real enforcers, time/cost,
  compliance evidence, support/backlash and suspension/repeal. Their actual
  strength changes service prices, ingredients, tabs, security, waves and
  capacity; weekly social effects read the same actual enforcement, and an
  unenforced rule grants no full effect.
- Six economy future-hook families are mechanical, warned, exact-once and
  counterable. The passive 28-day re-pin moves 1,078 coin / 805 patrons to
  **919 / 574**, and the two-seed, three-strategy 28/90/180-day matrix remains
  valid with at least two solvent identities at every horizon. The long gate
  also closed a day-56 compact/rich pressure synchronization seam after late
  weekly/monthly settlement and a day-70 fractional wage-arrears payment that
  violated the whole-coin till invariant.

Post-PR review hardened four seams: watered servings now keep their full bill
while consuming less ingredient, intact reserves retain the declared 14-day
deadline, empty perishable slots are snapshotted before same-day restocking,
and unpaid-tab reversals net against cash sales instead of masquerading as
operating costs. A second review pass hardened six more: closed service clears
customer demand before area occupancy/propagation, repeal responses disable the
named policy, price complaints track the specific hike and pre-hike price,
house-rule counterplay matches the memories responses really emit, and supplier
invoice rows retain both supplier identity and remaining balance.

Tests: `phase212.economy.test.ts` (21), `phase212.economyEvents.test.ts` (5),
`phase212.economyPersistence.test.ts` (6), and the heavy
`phase212.economyMatrix.heavy.test.ts` (4). Gates: `npm run test:full`
**321 files / 4,220 tests**, `npm test` **312 files / 4,087 tests**,
`typecheck` clean, `check` 0 errors / 0 warnings, `build` passing with the
known >500 kB chunk warning, and all three expansion artifacts clean.

### Tier 7 — Gameplay-audit remediation (closed 2026-07-28; entry retained until the next documentation cleanup as the resume map)

### ISSUE-166 — Gameplay-audit remediation arc (2026-07-26)

- **Grade:** broken · **Status:** done · **Phase:** 199–206 (one phase doc per wave, `docs/plans/phase-NNN-audit-wave-N-*.md`) · **Record:** `docs/audits/2026-07-26-gameplay-audit/` — queue: `REMEDIATION_QUEUE.md`, consolidated findings: `reports/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md`.
- **Evidence:** Eight-phase external gameplay audit of the shipped build (`Goblin-Tavern-main (8).zip` + the GitHub Pages deployment) confirmed **29 defects** with runtime routes and reproducible fixtures: 1 Critical, 9 High, 16 Medium, 3 Low. The loop is playable and strategies genuinely differentiate (4,479-coin spread across eight shared-seed 28-day bots), but the build is not progress-safe: save serialization throws on a Svelte proxy so every reload returns to Start (`P2-RT-001`); a rent response spends into negative coin without paying rent, breaching the schema's zero minimum (`P7-EXP-001`); three ordinary restocks are free (`P7-EXP-002`); compact and rich pressure state disagree and reports render pre-response snapshots (`P4-SEAM-003`, `P7-EXP-004`); cards cite the wrong actor/room and Fix Root repairs a different room (`P5-PLAY-003`, `P5-PLAY-004`); closed reports mutate after the next day begins (`P4-SEAM-002`, `P6-COMP-006`); coaching recommends destructive choices (`P7-EXP-003`). None of the 29 was caught by the existing suite, which was green at audit time.
- **Impact:** No balance, content, or onboarding conclusion drawn from the current build is trustworthy — hence the pause on every other arc. The audit's own verdict: an interconnected prototype, not yet a progress-safe management game.
- **Scope:** Eight sequential waves, each ending at an evidence gate rather than at code completion — W0 durable progress · W1 canonical state + economy · W2 authoritative causality and closed reports · W3 decision lifecycle · W4 action reachability and contextual transfer · W5 secondary surfaces and identity · W6 issue relevance and attention load · W7 balance re-evaluation. Findings, wave membership, gates and per-finding status: `REMEDIATION_QUEUE.md`. Twelve design questions (`P2-OBS-001`, `P3-DC-001`, `DC-01…DC-10`) are decisions, not defects; answer each inside the wave that reaches it and record the answer in the queue.
- **Depends on:** none — Wave 0 starts immediately. Internally the waves are hard-ordered (a later wave's gate assumes the earlier fixes); `DC-09` (onboarding vs. complete surface) must be settled before the Tier 4 arc resumes.
- **Progress:** **Wave 0 done** (phase 199, `docs/plans/phase-199-audit-wave-0-durable-progress.md`) — `P2-RT-001` fixed and verified, its gate (R11/R12 at every beat and segment) passing under `tests/web/phase199.wave0.durableProgress.test.ts`. The run now survives reload: the envelope is built by a proxy-safe serializer, a serialization failure is a reportable save error with a working Retry instead of an uncaught throw, and the two gate fields that were never persisted — the Service outcome strip and the start-of-day baseline (now a patch against `state`, 218 KB against 1 585 KB at day 28) — cross the boundary. One observation raised for scheduling, recorded in the queue: `TavernState` grows without bound (the attribution ledger is 985 KB of a 1 691 KB day-28 state), so a long run will eventually exhaust the storage quota for reasons unrelated to this arc. **Next: Wave 1.**
- **Progress (Wave 1):** **done** (phase 200, `docs/plans/phase-200-audit-wave-1-canonical-state-and-economy.md`) — all five findings fixed and verified, gate passing under `tests/sim/phase200.wave1.canonicalStateAndEconomy.test.ts` plus `tests/sim/phase200.wave1.strategyMatrix.test.ts` (eight shared-seed 28-day strategies, per-day invariants). `state.pressures[id].value` is now the single pressure authority — synced to the rich snapshot every pass, recalculated after responses so the report and next morning read post-response truth, and emitting exactly one cause per significant move. Rent is one shared transition reached through a named `monthly.rent.payment` effect target, affordability-checked before any part of a profile is applied, with `spendCoin` throwing rather than driving the till negative; ordinary supplier purchases have a 1-coin floor. Three user decisions were recorded rather than guessed (DC-07 gate-at-selection + atomic re-check; additive price bias with a minimum unit price; direct pressure deltas persisting as decaying adjustments) — detail in the queue. **Consequence for Wave 7:** the duplicate pressure cause had been doubling attribution weight, so removing it slows pressure escalation; any tuning judged against the pre-Wave-1 build is suspect. **Next: Wave 2.**
- **Progress (Wave 2):** **done** (phase 201, `docs/plans/phase-201-audit-wave-2-authoritative-causality.md`) — all six findings fixed and verified, gate passing under `tests/sim/phase201.wave2.causality.test.ts` and `tests/web/phase201.wave2.closedReports.test.ts`. A daily report now projects from the state of the day it describes (`closedDayState`, persisted as a patch against live state via the Wave 0 codec), so every field is stable immediately, next morning, days later and after reload — not just the missed opportunities and resolved choices the audit caught. `scopedCauseEntries` replaces the any-tag cause query at entity-sensitive call sites: a cause must name the seed's own entity and no foreign one. Two further attribution leaks surfaced and were fixed — `pressureCauseRefsAsEntries` was flattening every breakdown line's actors to `[]`, and the Wave 1 pressure cause borrowed the dominant line's words with the snapshot's aggregate actors. Customer complaints anchor on the room that actually has the problem, so Fix Root repairs what the card cites. Missed-opportunity ranking uses signed utility instead of absolute magnitude, so blame/mock can no longer be coached as an opportunity. `DC-03` stays open; the ranking is deliberately objective-agnostic. **Next: Wave 3.**
- **Progress (Wave 3):** **done** (phase 202, `docs/plans/phase-202-audit-wave-3-decision-lifecycle.md`) — all five findings fixed and verified, gate passing under `tests/reports/phase202.wave3.comprehension.test.ts` (18 assertions). The visible choice label is now the record: it rides on the intent, the sim stores it on the resolved-intent record, and it reaches the report and the pending chips — which also state "Selected — revisable until End Day", the missing answer to *which choices are final*. Delayed effects gained a real lifecycle (pending → due → applied | expired), each row naming the choice that promised it and when it lands; the queue always held that data and nothing projected it. Cause drilldowns translate machine sources, resolve refs to display names, and show a share of the change instead of a raw weight. Every staff priority carries a benefit and a tradeoff line, the plan summary names who is on what focus, and the report carries a directional focus line. `humanizePath` maps customer paths, so identical satisfaction rows are distinguishable again. **Two decisions taken:** `DC-02`/`P3-DC-001` — deliberate Ignore and no answer are different facts (`P3-DC-001` is now answered); cause importance reads as a share of the change. **Next: Wave 4.**
- **Progress (Wave 4):** **done** (phase 203, `docs/plans/phase-203-audit-wave-4-action-reachability.md`) — all five findings fixed and verified, gate passing under `tests/sim/phase203.wave4.actionReachability.test.ts` (12 assertions) and `tests/web/phase203.wave4.planningHorizon.test.ts` (17). Every finding was the same shape — a payload losing a field between two surfaces — so the wave is one contract stated five times: validate and carry what the player actually specified. The inline policy control now carries its policy id and label (it queued nothing at all before, failing `no target`), and a toggle's valid targets are its own policy rather than all seven. `OwnerActionDefinition` gained `canOpen` (may the player *begin* specifying this, as distinct from is a complete input valid) and `composer` (the dedicated form that owns an input a two-level picker cannot assemble), and `actionDisabledReasonForInput` validates a COMPLETE payload — so expedition commissioning both opens from Stock and the planner, and queues the runner/mode/duration the player filled in. `global.owner_time` became a first-class effect target on `modules.ownerActions.timeSpent`, with a cost function, a `gateChoicesByTime` selection gate and a DC-07 atomic re-check that skips an unaffordable intent WHOLE. Suggestions and drilldown CTAs carry `targetId` / `reason` end to end, de-duplicate by action AND target, and preselect a valid preferred target. **Two contract decisions taken:** `P5-PLAY-001` — keep pre-planning and label it tomorrow (`gameStore.planningHorizon` reads `segment`, not `beat`); `P6-COMP-005` — owner time becomes a real, named, enforced cost rather than dropping the claim, because the day-clock contract is locked. **Consequence for Wave 7:** five profiles now take real hours off the day that previously cost nothing (their `-5`/`-6` amounts were on the retired action-point scale and the applier had no branch for the target), so owner-time tuning judged against the pre-Wave-4 build is suspect. **Next: Wave 5.**
- **Progress (Wave 5):** **done** (phase 204, `docs/plans/phase-204-audit-wave-5-secondary-surfaces-and-identity.md`) — all five findings fixed and verified, gate passing under `tests/sim/phase204.wave5.identityAndSurfaces.test.ts` (8 assertions) and `tests/web/phase204.wave5.vocabulary.test.ts` (10, carrying the R15 sweep). Where Wave 4's findings were a payload losing a field, these were surfaces asserting guarantees the data did not make, so each fix makes the guarantee real at the source. Two `each` blocks were aborting whole screens on `each_key_duplicate`: the glossary held two `atmosphere` terms (genuinely different concepts — the tavern-wide one becomes `tavern_atmosphere`, and its consumer had already been linking to the wrong definition), and every service-scene history row carried its own scene type twice. Tags are now deduplicated on write by `ctx.addHistory`, again at projection so pre-Wave-5 saves render, and both keyed lists key on something unique by construction. `applyOwnerActionsHook` captures a target's display label from the definition's own `getValidTargets` BEFORE applying, so firing a staff member no longer reports `humanizeId` of a dead lookup — done for every action, not just removals. `isPresentedArcStage` / `listPresentedArcs` give the two player-facing arc surfaces one predicate while `listActiveArcs` keeps its cap-counting meaning, and the monthly overview reads the `ageDays` the sim stores instead of re-deriving it. `idLabel` gained `seedFamily` and `mechanicalTag` categories and `humanizeActionReason` moved into `src/reports/labels/`, so projections emit player-ready text rather than each component remembering the call; raw ids now live behind a `showDiagnostics` preference (default off). **Decision taken:** seed-family tags are mapped to player labels rather than hidden — `familyTag()` still returns `seed.family`, only the render boundary changed. **Two defects found while fixing, outside the audit:** project-starter actions returned the area id as their target label (which Wave 4 had just made the source of the immutable applied-action label), and one Tavern row rendered an engine rejection string verbatim. **Next: Wave 6.**
- **Progress (Wave 6):** **done** (phase 205, `docs/plans/phase-205-audit-wave-6-issue-relevance-and-attention-load.md`) — both findings fixed and verified, gate passing under `tests/sim/phase205.wave6.issueRelevance.test.ts` (8 tests) and `tests/cards/phase205.wave6.attentionLoad.test.ts` (6, counting what the card layer actually renders rather than what the sim intends). The audit's own pacing probe re-run on the fixed build: **3.46 cards and 15.68 rendered choices per day (peaks 5 and 24), 439 buttons over 28 days** — against 4.93 / 27.64 / 774 before the wave and 5.61 / 31.82 / 891 in the audit — with the four families that ran 25–27 consecutive days now capped at 3, 2, 3 and 2, and weekly/monthly boundaries plus `violence`, `debt_rent`, `opening` and `staff_arc` all still reaching the hand. **Decision taken (`DC-06`, the approved reactive-workload target):** 5 cards and 24 rendered choices per full day, hard; two consecutive days per family then a rest day unless it materially worsens; urgent Service incidents admitted at a full ceiling by displacing the weakest non-urgent card; recurrences presented as continuing threads with a continuity line and a trimmed choice set. `selectVisibleHand` prices the day's exposure ledger in cards and buttons so Morning and Service spend one budget instead of capping their own passes, a new `attention` slice carries per-family streaks and per-thread history (folded in at `endDay`, since `responses` depends on `issueSeeds` and the reverse dependency is impossible), and `generateStockShortage` now requires a real demand signal — an unfilled order today, a recipe served within a week, or a recipe on the menu — deriving its "recent context" from whichever signal qualified the item instead of asserting `<item> sales heavy this week` about an ingredient that has never sold. **Worth knowing:** urgency is deliberately NOT a cooldown exemption — `customer_complaint` sat at urgency 80 for nineteen consecutive days while rotating its customer group, so any per-urgency or per-entity escape reopens the exact mechanism the finding names; reachability is enforced at the ceiling by displacement instead, and a thread the player ANSWERED last time it appeared is exempt (a venture being invested in daily is engagement, not noise). Card-template gates now read `getGeneratedSeedsToday` rather than the visible hand, because what a family's generator produces and whether today had room to show it are different questions. **Next: Wave 7 — the balance re-evaluation, which now has a materially different reactive workload to measure against (carried forward in the queue).**
- **Progress (Wave 7):** **done — arc closed** (phase 206, `docs/plans/phase-206-audit-wave-7-balance-and-whole-experience.md`; full record in the queue's Wave 7 section). The measurement framework landed first (`npm run balance:matrix`: segmented-day harness, objective-agnostic analysis, sharded driver, calibrated against the Wave 6 gate and Phase 7 §5.1 exactly). The balance pass then ran in one push: the six blocking design decisions were recorded (the user delegated them) — `DC-03` identity through viability, `DC-04` soft-fail spiral with the coin-abundance follow-up lever named, `DC-05` goblin leadership in month 1 is design, `DC-06` recurrence exemption capped at 4 (teleology exempt), `DC-08` teleology is the core month-1 long-horizon strategy, `DC-01` Quick Day retired; all ten Codex review findings on the instrument were fixed and both baselines regenerated with the corrected instrument before any number was trusted; and five evidence-backed tuning changes landed with before/after diffs — recurrence cap (answering-route streaks 17–26 → max 6), daily rumour decay + recalibrated `rumour_pressure` (pinned at 100 on 360/360 cells → 0 cells end there; weekly burst-and-fade with strategy differentiation), attribution narrative-merge with feedback guards (612 stacked copies of one belief → 52 live narratives; `staff_loyalty_risk` un-pinned and strategy-differentiated; **also retires the Wave 0 state-growth observation** — the attribution slice fell 985 KB → 34 KB and the day-28 save 1,691 KB → ~935 KB), Segment-A pressure-snapshot sync (a pre-existing §8.2 seam the new per-segment checks surfaced on every managed route), and visible-turn violence rotation. The 360-cell sweep on the corrected instrument: every cell trustworthy, no dominant strategy on any slice, agency positive, four distinct reputation identities on standard/full, the DC-06 ceilings holding off-route, and the DC-03 scoring layer (`balanceScoring.ts`) reads the standard slice **balanced**. A scripted 31-day browser pass of the public route closed month 1 into month 2 with zero console errors and no comprehension breaks (§11.4(5)). Residual gaps recorded rather than silently tuned: ISSUE-167 (arm diversification + the two slice-level gaps), ISSUE-168 (satisfaction→traffic elasticity so coin can bind), ISSUE-169 (visible-turn rotation for the other rotating families). Gates: `npm test` (3,702), `npm run test:heavy` (129), `npm run typecheck`, `npm run build` all green.
- **Test approach:** Every wave ships regression coverage for its gate, per Phase 8 §8 (required routes R01–R15, state invariants, existing gates to retain). Bar for closing a finding: the audit's own route reproduces the defect before the fix and passes after, plus an automated assertion — reload-survival for W0, `coin >= 0` and pressure-authority equality across eight shared-seed 28-day runs for W1, field-stable closed reports across reload for W2, and so on. The `fixtures/` probes import the live `src/` tree and run as-is (`npx tsx docs/audits/2026-07-26-gameplay-audit/fixtures/phase2_quickday_probe.ts` verified after extraction) — reuse them as harnesses rather than rebuilding the routes. W7 re-ran the strategy matrix after W0–W6 closed; its gate evidence lives in the queue's Wave 7 section and `baselines/`.

### Tier 6 — Choice-Preview Legibility (standing tail)

### ISSUE-153 — Choice-Preview Legibility Phase 5: Drive, tune, deepen (standing)
- **Grade:** thin · **Status:** in-progress · **Phase:** 185 · **Record:** `docs/plans/phase-185-drive-tune-deepen.md`
- **Evidence:** the motivating sweep (arc Appendix A §2) left `food_safety`, `regular_customer`, `rumour_crisis` unverified — they never surfaced in a passive playthrough, so the legibility gate had only run against their synthetic determinism samples (`legibilityHarness.ts`), never a seed the live `simulateDay` pipeline actually emitted under adverse state.
- **Scope (part a — landed):** drove all three families into existence from constructed adverse state through the real pipeline and confirmed the Phase-4 gate is clean for each. `tests/cards/compose/gates/drivenFamilies.ts` perturbs only the state each family's generator + backing pressure calculator read (food_safety: filthy kitchen + spoiled stew/mushrooms → `food_safety` ≥ 45; regular_customer: starter regulars at irritation 80 / loyalty 20 → `regular_customer_loss` ≥ 25, irritation > 60 routes to the `complaint` template; rumour_crisis: a strength-100 false rumour + a high-publicness false `suspicion` attribution targeting a real regular, so the dramatic target is an actor and the seed clears the "no actor, group, or location" validation contract), runs one day, harvests the surfaced production seed, and resolves its production template via the registry's `pickCardForSeed` over the 20 migrated templates. The gate rendered all three clean against the current `DEFAULT_NAMED_METERS` — no pool changes required.
- **Scope (part b — prose deepening, landed):** the Phase-3 (Phase 183) meter-named block named only the four pressures the *passive* sweep surfaced (`staff_loyalty_risk` / `staff_burnout` / `rumour_pressure` / `inspection`); every other pressure still rendered the coarse "the meter would climb a notch on the reading" / "a measure of risk would loosen its grip" base (the arc's §3 flat lines). A rendered-preview sweep over all twenty templates + the three driven families confirmed those flats persist on `culture_conflict` / `faction_request` / `rival_tavern` / `food_safety` / `supplier_relationship` / `stock_shortage` / `violence` / `debt_rent` / `monthly_review`. Authored meter-named, subject-first snippets for the next tier of pressures by emission count — `cultural_tension`, `food_safety`, `rival_tavern_pressure`, `faction_anger`, `stock_shortage`, `supplier_distrust`, `violence`, `debt`, `landlord` — in `pools/_shared/effectPreviewBase.ts`, each gated on `effectMeter` + `effectTargetKind: pressure` + direction + band (specificity 4, out-ranking the coarse base), keeping a `MAGNITUDE_LEXICON` token + a `pressure`-kind keyword, ≤ 10 words, two siblings per relief cell so the within-card avoid-set spreads multi-choice "fix it" cards. Forced genuinely distinct verb/tail vocabulary per pressure so no pair trips the `dedupe` gate's 0.85 char-Levenshtein near-duplicate check. `DEFAULT_NAMED_METERS` NOT grown (tiny/large bands stay coarse, so these are not 100%-named across live samples). The coarse base remains the fallback for the unlisted pressures.
- **Scope (part b — band-cutoff recalibration, standing/open):** recalibrate `MAGNITUDE_BAND_CUTOFFS` where playtest shows a cut-point reads wrong. No cutoff changed — none has been shown to read wrong, and changing one without play evidence would risk regressing the calibrated bands every gate depends on.
- **Depends on:** ISSUE-152. Standing — never strictly done.
- **Test approach:** `tests/cards/compose/gates/legibility.driven.test.ts` — for each of the three families, surface the driven sample, resolve its template, run `checkLegibility` on a single-situation config, and assert `report.pass` plus all per-situation counters are 0 (magnitude / cost / label-collision / inaction-blank / meter-naming / duplicate-line / risk-surfacing), with a guard that a real seed carrying consequence profiles and ≥1 playable choice was rendered. Deterministic (constructed state + seeded `runOneDay`); runs in the default `npm test` suite. Full suite + `npm run typecheck` green.

### Tier 4 — Progressive Onboarding arc (paused before start)

Locked contract: `docs/plans/progressive-onboarding.md`. Strictly linear —
each issue depends on the one before it. Reframes Day 1 as "first time
opening a tavern" and unlocks systems across the first ~10 in-game weeks.

### ISSUE-060 — Progressive Onboarding — design contract

- **Grade:** design
- **Status:** open
- **Phase:** 99
- **Evidence:** Today, `createInitialTavernState()` at
  `src/sim/state/defaults.ts:629` seeds the full world on day 0
  (factions, cultures, suppliers, regulars, expeditions, all populated)
  and `canonicalPipeline.ts:43` runs all 25 modules every day from day
  1. The web layer's 5-tab bottom nav and ~25 sub-tabs render
  unconditionally on day 1. `docs/plans/game-loop-and-ux.md §2.1`
  explicitly forbids character creation and tavern naming, but the
  rationale ("Day 1 is already information-heavy") is the same dense
  Day-1 problem this arc aims to fix.
- **Impact:** Without a locked design contract, the 17 downstream
  issues in this tier have no shared anchor — phase plans would
  duplicate scope decisions, gating mechanism choices, and the unlock
  schedule. Patterned after Tier 1.5's `rare-ingredients-economy.md`.
- **Scope:** New doc `docs/plans/progressive-onboarding.md` locking the
  `SystemId` enum, unlock schedule (15 systems across days 1–70), the
  `gateModule` + `unlocksModule` gating contract, the new-game flow
  step shape, the trimmed initial-state rules, the migration shape, and
  the out-of-scope list. Amend `docs/plans/game-loop-and-ux.md §2.1`
  with a dated subsection — do not rewrite it.
- **Depends on:** none.
- **Test approach:** Doc review — no code in this issue. Acceptance is
  the contract being merged and ISSUE-061…ISSUE-077 referencing it.

### ISSUE-061 — `OnboardingState` slice + schema + migration

- **Grade:** thin
- **Status:** open
- **Phase:** 100
- **Evidence:** `TavernState` (`src/sim/state/TavernState.ts:5`) has no
  player-character or unlock-state field. `meta` is identity that never
  changes after save creation, so the new slice belongs as its own
  top-level field. `src/sim/state/migrations.ts` carries
  `ensureWorldBranch`, `ensureRecipesSlice`, `ensureExpeditionsSlice`
  helpers — the new slice needs a matching `ensureOnboardingSlice` so
  pre-arc saves load without validation errors.
- **Impact:** Without the slice, the gating module (ISSUE-062) has
  nowhere to write unlock state and the new-game flow (ISSUE-065) has
  nowhere to store the owner-name choice.
- **Scope:** See `docs/plans/progressive-onboarding.md §6.1, §7`. Add
  the `OnboardingState` type at `TavernState.ts`, the schema in
  `schemas.ts` (mounted on `TavernStateSchema`), the default factory
  in `defaults.ts`, and `ensureOnboardingSlice` in `migrations.ts`.
  Migrated saves set `isFullyUnlocked: true` and pre-fill
  `discoveryCardsShown` with every SystemId.
- **Depends on:** ISSUE-060 (design contract).
- **Test approach:** Existing saves load without validation errors;
  new saves carry the slice with only `core` unlocked; migrated saves
  carry `isFullyUnlocked: true`.

### ISSUE-062 — `gateModule` + `unlocksModule` gating infrastructure

- **Grade:** broken
- **Status:** open
- **Phase:** 101
- **Evidence:** `canonicalPipeline.ts:43` has no mechanism for
  conditional hook execution. Every `SimulationModule` runs every hook
  every day. The locked design (`docs/plans/progressive-onboarding.md
  §5.3, §5.4`) requires (a) a registration-time wrapper that
  short-circuits a module's hooks against an unlock check and (b) a
  driver module that writes unlock state on `startDay`.
- **Impact:** Without this infrastructure, no per-system gating is
  possible. Every downstream unlock phase (ISSUE-067 onward) depends on
  this.
- **Scope:** See `docs/plans/progressive-onboarding.md §5.3, §5.4`. New
  files `src/sim/modules/unlocks/{unlocksModule,gateModule,
  unlockRegistry,types,index}.ts`. The `unlockRegistry` follows the
  existing registry pattern (`pressureRegistry`, `supplierRegistry`).
  `gateModule(mod, systemId)` returns a wrapped module whose every hook
  short-circuits via `isUnlocked`. `unlocksModule.startDay` evaluates
  pending conditions and writes to `state.onboarding.unlockedSystems`.
- **Depends on:** ISSUE-061 (the state slice the module writes to).
- **Test approach:** Applying `gateModule` to a fixture module makes
  its hooks no-op until the unlock condition is satisfied. Deterministic
  across reseeds. `unlocksModule` writes a cause entry per unlock.

### ISSUE-063 — Wire `gateModule` into `canonicalPipeline.ts`

- **Grade:** thin
- **Status:** open
- **Phase:** 102
- **Evidence:** `canonicalPipeline.ts:43` registers 25 modules as a
  static array with no gating. The design (`§6.4`) names which modules
  wrap with which SystemId; this issue applies those wraps.
- **Impact:** The infrastructure from ISSUE-062 has no effect until the
  pipeline is wired. With `isFullyUnlocked: true` on migrated saves,
  behaviour must remain bit-for-bit identical to today.
- **Scope:** Edit `canonicalPipeline.ts`. Insert `unlocksModule` first.
  Wrap `cultureModule`, `factionModule`, `supplierModule`,
  `regularModule`, `adventurersModule`, `expeditionsModule`,
  `monthlyModule`, `localArcsModule`, `issueSeedsModule`,
  `responsesModule` with `gateModule`. Wrap `weeklyModule` with the
  per-hook split-gate variant.
- **Depends on:** ISSUE-062.
- **Test approach:** New fixed-seed snapshot test in
  `tests/sim/onboarding.gating.test.ts` — with `isFullyUnlocked: true`,
  30 simulated days produce bit-for-bit identical state to a pre-arc
  baseline snapshot.

### ISSUE-064 — Trim `createInitialTavernState()` with `mode` flag

- **Grade:** thin
- **Status:** open
- **Phase:** 103
- **Evidence:** `createInitialTavernState()` at `defaults.ts:629`
  hardcodes the tavern id, name, coin, areas, stock, staff, customer
  groups, recipes, expeditions, world state. There is no path for a
  trimmed Day-1 state. ~950 test fixtures call this function and depend
  on the full default.
- **Impact:** Without a mode flag, the new-game flow cannot produce the
  minimal Day-1 state described in §6.3, and test fixtures break the
  moment we change the default.
- **Scope:** See `docs/plans/progressive-onboarding.md §6.3`. Add a
  `mode: 'onboarding' | 'full'` argument (default `'onboarding'`), plus
  `chosenStaffIds`, `ownerName`, `tavernName` config fields. Onboarding
  mode produces 2 areas, 3 stock items, 3 recipes, `local_goblins`
  only, empty world entities, 3 core pressures. Add a
  `createFullInitialTavernState` re-export for fixture callers.
- **Depends on:** ISSUE-061 (slice must exist on the trimmed state).
- **Test approach:** Existing fixtures pass once switched to
  `createFullInitialTavernState`. New test asserts trimmed-state
  invariants (one customer group, empty world entities, 2 areas, etc.).

### ISSUE-065 — New-game multi-step flow (owner + tavern naming)

- **Grade:** thin
- **Status:** open
- **Phase:** 104
- **Evidence:** `web/src/lib/screens/StartScreen.svelte:46–61` is a
  single-step screen with two buttons ("Open the Tavern" / "Continue")
  and an advanced disclosure for seed + difficulty. There is no naming
  flow, no character creation, no staff selection.
- **Impact:** The arc's narrative framing ("you are a goblin opening
  your tavern") requires the player to commit to an owner-character
  identity and tavern name before Day 1.
- **Scope:** See `docs/plans/progressive-onboarding.md §5.6`. Refactor
  `StartScreen.svelte` into a multi-step controller. New components in
  `web/src/lib/screens/onboarding/`: `WelcomeStep`, `NameOwnerStep`,
  `NameTavernStep`, `PickStaffStep`, `ConfirmStep`, `OnboardingFlow`.
  Owner-name default via `npc_identity` RNG stream + `goblin_locals`
  naming profile. Tavern-name default "The Crooked Keg". Empty submits
  accept placeholders. "Skip and use defaults" affordance on
  WelcomeStep.
- **Depends on:** ISSUE-064 (the trimmed state path the flow writes
  to), ISSUE-066 (the candidate pool for PickStaffStep).
- **Test approach:** Svelte component test per step. End-to-end click
  through asserts the resulting `TavernState` carries the chosen names
  and staff.

### ISSUE-066 — Staff candidate pool + selection at start

- **Grade:** thin
- **Status:** open
- **Phase:** 105
- **Evidence:** `createInitialStaff()` in `defaults.ts` seeds three
  fixed staff via the staff registry. No player choice exists.
  `staffIdentityFactory.ts` is already wired for named staff; the
  candidate pool reuses this.
- **Impact:** The arc's "you assembled this crew yourself" framing
  requires the player to pick 1–2 from a candidate pool, not inherit a
  fixed three.
- **Scope:** See `docs/plans/progressive-onboarding.md §6.2`. New file
  `src/sim/content/onboarding/staffCandidatePool.ts` — a deterministic
  5-candidate roster from the game seed via the `staff_identity` RNG
  stream. `createInitialTavernState({mode: 'onboarding', chosenStaffIds})`
  accepts the player's picks; absent picks fall back to the first
  candidate.
- **Depends on:** ISSUE-064.
- **Test approach:** Same game seed produces the same five candidates
  in the same order across runs. Picking 1 or 2 produces a valid
  starting staff record. Picking 0 falls back deterministically.

### ISSUE-067 — `reports` + `tavern_management` UI unlocks (days 2–3)

- **Grade:** thin
- **Status:** open
- **Phase:** 106
- **Evidence:** `web/src/lib/components/BottomNav.svelte:10–16` shows
  all five tabs unconditionally on day 1. Per the unlock schedule, the
  Reports tab should appear day 2 and the Tavern tab day 3 — the player
  needs to see a first daily report before "yesterday's tally" makes
  sense, and the Tavern panel becomes meaningful once a full day has
  passed.
- **Impact:** A new player on day 1 sees all five tabs but most are
  empty or unmotivated. Progressive disclosure starts here.
- **Scope:** Register `reports` and `tavern_management` SystemIds with
  day-2 and day-3 conditions in `unlockRegistry`. No `gateModule` calls
  (these are UI-only unlocks). `BottomNav.svelte` reads
  `state.onboarding.unlockedSystems` and emits only unlocked tabs.
- **Depends on:** ISSUE-063 (gating wired) and ISSUE-064 (trimmed
  state).
- **Test approach:** Day-1 state shows `[Day, More]` in bottom nav;
  day-2 adds Reports; day-3 adds Tavern. Migrated saves show all five.

### ISSUE-068 — `suppliers` unlock (day 4)

- **Grade:** thin
- **Status:** open
- **Phase:** 107
- **Evidence:** `supplierModule` runs all hooks from day 1 today. The
  player sees a populated Suppliers sub-tab in the World screen with no
  story context for why suppliers exist. Per the schedule, suppliers
  should knock on the door on day 4 with a discovery card.
- **Impact:** Establishes the unlock pattern — gate one module, register
  one condition, emit one discovery seed, reveal one sub-tab.
- **Scope:** Wrap `supplierModule` via `gateModule(..., 'suppliers')`.
  Register condition `day >= 4` in `unlockRegistry`. Add the
  `discovery_suppliers` seed-family entry in `issueSeedGenerators.ts`.
  Reveal the Suppliers sub-tab in `WorldScreen.svelte` via
  `isUnlocked`. Reuse `FirstEncounterHint` + `TermLabel` for the
  supplier glossary.
- **Depends on:** ISSUE-063, ISSUE-069 (the `crises` unlock must precede
  this so the discovery card can render — but `discovery_*` seeds emit
  through `unlocksModule` directly, not via `issueSeedsModule`, so the
  ordering is reversed: this issue can land before ISSUE-069 with a
  banner-only discovery surface, then upgrade to a card when crises
  unlocks. Confirm in the phase plan.)
- **Test approach:** Days 1–3 with a fresh save record zero
  `supplierModule` hook fires (verified via a hook-call counter); day
  4 fires the discovery surface; suppliers sub-tab appears. Replay does
  not duplicate the discovery.

### ISSUE-069 — `crises` unlock — issue seeds + responses (day 5)

- **Grade:** thin
- **Status:** open
- **Phase:** 108
- **Evidence:** `issueSeedsModule` and `responsesModule` together
  produce the card-driven incident shape of the day loop. On a fresh
  save they fire from day 1. Per the schedule, the player should
  experience two quiet days before crises begin — day 5 lands the first
  issue-seed card.
- **Impact:** Establishes the minimum cut for gating the card layer.
  `causesModule`, `pressuresModule`, `feedbackModule` stay ungated
  because they're cheap and self-contained; only the seed generation
  and response application gate.
- **Scope:** Wrap `issueSeedsModule` and `responsesModule` via
  `gateModule(..., 'crises')`. Register condition `day >= 5`. Add the
  `discovery_crises` seed family. After this unlock, all subsequent
  discovery surfaces emit as cards (before, as banners).
- **Depends on:** ISSUE-063, ISSUE-068 (the banner-to-card upgrade
  needs the earlier discovery surfaces in place).
- **Test approach:** Days 1–4 have zero card seeds. Day 5 emits the
  discovery card. Day 6+ the card layer behaves as before for fresh
  saves.

### ISSUE-070 — `weekly_report` (day 7) + `weekly_economy` (day 14) split gating

- **Grade:** thin
- **Status:** open
- **Phase:** 109
- **Evidence:** `weeklyModule` has both informational hooks (report
  building, trend strips) and economic hooks (wages, maintenance
  invoices). They co-fire on day 7 today. The design splits them: the
  weekly digest lands day 7, but wages don't start costing coin until
  day 14, after the player has hired a second staff member.
- **Impact:** The first week's "you lost coin you didn't know was
  scheduled" moment is the friction this split solves. Two SystemIds
  for one module.
- **Scope:** See `docs/plans/progressive-onboarding.md §5.4`. Use the
  per-hook split-gate variant `gateHook` to wrap `weeklyModule`'s
  `endWeek` report hooks under `weekly_report` and its
  wages/maintenance hooks under `weekly_economy`. Register conditions
  `day >= 7` and `day >= 14`. Two discovery seed families.
- **Depends on:** ISSUE-063 (split-gate variant must exist by then).
- **Test approach:** Day 7 produces a weekly digest but no wages
  ledger entries. Day 14 produces both. Both discovery cards fire once.

### ISSUE-071 — `regulars` unlock (day 10)

- **Grade:** thin
- **Status:** open
- **Phase:** 110
- **Evidence:** `regularModule` runs from day 1 today, but the World >
  Regulars sub-tab is empty until reputation conditions are met
  organically. The design fires a named regular into existence on day
  10 to motivate the system.
- **Impact:** Establishes the "seed one entity at unlock time" pattern
  — the unlock not only opens the gate but also creates the first
  member of the world slice.
- **Scope:** Wrap `regularModule` via `gateModule(..., 'regulars')`.
  Register condition `day >= 10`. Seed one named regular at unlock time
  via the `regular_identity` RNG stream — the regular has
  `firstSeenDay: 10` and a small memory of visiting yesterday.
- **Depends on:** ISSUE-063.
- **Test approach:** Days 1–9 have empty `world.regulars`. Day 10 has
  one named regular with `firstSeenDay: 10`. Discovery card references
  the regular by name.

### ISSUE-072 — `cultures` unlock (day 12)

- **Grade:** thin
- **Status:** open
- **Phase:** 111
- **Evidence:** `cultureModule` runs from day 1 with pre-seeded
  cultures. The design empties `world.cultures` on Day 1 and seeds the
  first non-goblin culture (`traveling_outsiders`) at unlock on day 12.
- **Impact:** The narrative beat "a non-goblin walks in" needs the
  cultures slice to actually empty before this day.
- **Scope:** Wrap `cultureModule` via `gateModule(..., 'cultures')`.
  Register condition `day >= 12`. Seed `traveling_outsiders` at unlock.
  Customer groups gated by this culture become available organically
  via the existing `customerModule` reputation check.
- **Depends on:** ISSUE-063, ISSUE-064 (trimmed state must omit
  cultures on Day 1).
- **Test approach:** Days 1–11 have empty `world.cultures`. Day 12 has
  `traveling_outsiders`. No customer-group changes between days 12 and
  the reputation threshold being met.

### ISSUE-073 — `factions` unlock (day 17)

- **Grade:** thin
- **Status:** open
- **Phase:** 112
- **Evidence:** `factionModule` and `localArcsModule` run from day 1.
  Hardcoded faction-id lookups exist at
  `issueSeedGenerators.ts:2672, 3618`, `expandedSeedGenerators.ts:181,
  1168, 1171`, `localArcs/arcEngine.ts:70`. All are defensive (`if
  (factions[id])`), so they tolerate empty maps but silently emit
  weaker seeds. Day 17 seeds `town_watch` to satisfy these lookups
  starting that day.
- **Impact:** The most-referenced hardcoded faction id is `town_watch`.
  Seeding it at unlock keeps the existing seed generators producing
  their expected shapes from day 17 onward.
- **Scope:** Wrap `factionModule` and `localArcsModule` via
  `gateModule(..., 'factions')`. Register condition `day >= 17`. Seed
  `town_watch` at unlock with the existing notable-NPC factory. Audit
  the hardcoded lookups listed above and confirm they tolerate empty
  factions on days 1–16.
- **Depends on:** ISSUE-063, ISSUE-064.
- **Test approach:** Days 1–16 have empty `world.factions`. Day 17 has
  `town_watch`. The hardcoded seed generators emit their expected
  shapes starting day 17. The seed audit confirms zero crashes on days
  1–16.

### ISSUE-074 — Grouped late unlocks — policies (21), monthly (28), projects (42), expeditions (70)

- **Grade:** thin
- **Status:** open
- **Phase:** 113
- **Evidence:** Four smaller unlocks following the same template,
  grouped into one phase. `policies` gates owner-action availability
  for policy toggles; `monthly` wraps `monthlyModule`; `projects`
  gates `start_*` actions; `expeditions` wraps `adventurersModule` and
  `expeditionsModule` and adds the only non-day predicate
  (`culinary_renown >= 25` AND `day >= 70`).
- **Impact:** Completes the unlock schedule. `monthly` is the
  rent-day beat (day 28), the most narrative-heavy unlock after Day 1
  itself.
- **Scope:** Four SystemIds, four conditions, four discovery seeds.
  `policies` and `projects` integrate via the existing `canApply`
  predicate on owner actions (AND with `isUnlocked`). `monthly` wraps
  `monthlyModule`. `expeditions` wraps `adventurersModule` and
  `expeditionsModule` together.
- **Depends on:** ISSUE-063, ISSUE-064.
- **Test approach:** Each SystemId: gated hooks do not fire before
  `unlockedDay`; discovery surfaces fire once; web tabs reveal at the
  right day; `expeditions` does not unlock at day 70 if
  `culinary_renown < 25`.

### ISSUE-075 — Sub-tab gating in Reports / World / Tavern

- **Grade:** thin
- **Status:** open
- **Phase:** 114
- **Evidence:** `web/src/lib/screens/ReportsScreen.svelte:104`,
  `WorldScreen.svelte:70`, `TavernScreen.svelte:49` render their
  sub-tab lists unconditionally. The design requires sub-tabs to filter
  by `isUnlocked` and the sub-tab row to suppress when only one
  sub-tab is visible.
- **Impact:** Without sub-tab gating, revealing a top-level tab still
  exposes a row of mostly-empty sub-tabs.
- **Scope:** Edit the three screen files. Filter `subTabs` by
  `isUnlocked`. Suppress the sub-tab row when `subTabs.length === 1`
  and render the single sub-tab directly.
- **Depends on:** ISSUE-067 through ISSUE-074.
- **Test approach:** Web component test per screen — mount with a
  fresh-save state at day N, assert the correct sub-tab set renders.
  Snapshot at day 3, day 10, day 28, day 70.

### ISSUE-076 — Discovery card narrative pass

- **Grade:** thin
- **Status:** open
- **Phase:** 115
- **Evidence:** ISSUE-068 through ISSUE-074 each register a
  `discovery_<system>` seed family, but the narrative composition is
  scaffolded in those phases. This issue does a dedicated pass
  consolidating all 15 families, ensuring each references the system's
  glossary term inline and matches the Phase 95 voice.
- **Impact:** Per the project's central rule, cards must reveal
  simulation truth — discovery cards reveal `unlockedSystems[id]` was
  written. The composition layer ensures they read like part of the
  game, not a tutorial.
- **Scope:** ~15 `discovery_*` family entries in
  `issueSeedGenerators.ts`. One-shot cards; `discoveryCardsShown`
  prevents replay. Cards reference glossary terms via `TermLabel` from
  Phase 98. Reuse the seed family pattern at
  `issueSeedGenerators.ts:3885+`.
- **Depends on:** ISSUE-068 through ISSUE-074 (the families they
  registered get consolidated here).
- **Test approach:** One-line composition test per family. Each card
  body references the SystemId's glossary term. No card invents facts
  outside the seed's text-ingredient set.

### ISSUE-077 — Migration finalize + fixture audit + integration walkthrough

- **Grade:** broken
- **Status:** open
- **Phase:** 116
- **Evidence:** ~950 `createInitialTavernState()` callers in `tests/`
  expect the full default world. ISSUE-064 introduces
  `createFullInitialTavernState`, but the fixture audit (which
  callers actually need full state, which can use trimmed) is deferred
  to the final phase. `ensureOnboardingSlice` from ISSUE-061 needs
  end-to-end migration testing.
- **Impact:** Without the audit, fixtures depending on full-world
  state break silently as the default mode flips. Without the
  walkthrough test, the unlock schedule has no end-to-end coverage.
- **Scope:** Finalize `ensureOnboardingSlice` for mid-game saves (set
  `isFullyUnlocked: true`, populate `discoveryCardsShown` with all
  SystemIds). Audit the ~950 fixture callers — switch the ones that
  rely on full world state to `createFullInitialTavernState`. Add
  `tests/integration/onboarding/walkthrough.test.ts` — a fixed-seed
  playthrough days 1, 7, 28, 70 with snapshot assertions at each
  checkpoint.
- **Depends on:** all of ISSUE-061 through ISSUE-076.
- **Test approach:** Full `npm test` green. Migration test loads a
  pre-arc save fixture and asserts all SystemIds carry `trigger:
  'migration'`, `isFullyUnlocked: true`, and zero discovery cards fire.
  Walkthrough test snapshots the trimmed state at days 1, 7, 28, 70.
  Manual verification: dev server, click through new-game flow on a
  phone viewport, confirm Day 1 has no World tab, Day 4 supplier card,
  Day 7 weekly summary, Day 28 rent day.
