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

**Only one arc is active: ISSUE-166 — remediation of the 2026-07-26 gameplay
audit.** Everything else is paused until it closes. Work the waves in order
from `docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`, which
tracks the 29 findings; this file carries one entry for the arc.

**Waves 0, 1 and 2 are closed** (phases 199, 200 and 201). **Next: Wave 3 —
complete the decision lifecycle** (`P6-COMP-001`, `P6-COMP-002`,
`P6-COMP-003`, `P6-COMP-004`, `P5-PLAY-002`).

### Paused arcs — resume points

Nothing is abandoned; these are the exact restart points.

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
| ISSUE-166 | **Gameplay-audit remediation arc (2026-07-26, 29 findings, Waves 0–7)** | broken | in-progress | 199+ |
| ISSUE-116 | Legible Surface Phase 3 — Choice Distinctness Gate & Legible Choice-Set Cap | broken | done | 148 |

---

## Live issues

Full entries for open and in-progress work only. ISSUE-141…148 (Complete
Surface) and ISSUE-130 are tracked in their arc docs, per the resume points
above.

### Tier 7 — Gameplay-audit remediation (active; all other arcs paused)

### ISSUE-166 — Gameplay-audit remediation arc (2026-07-26)

- **Grade:** broken · **Status:** in-progress · **Phase:** 199+ (one phase doc per wave, `docs/plans/phase-NNN-audit-wave-N-*.md`) · **Record:** `docs/audits/2026-07-26-gameplay-audit/` — queue: `REMEDIATION_QUEUE.md`, consolidated findings: `reports/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md`.
- **Evidence:** Eight-phase external gameplay audit of the shipped build (`Goblin-Tavern-main (8).zip` + the GitHub Pages deployment) confirmed **29 defects** with runtime routes and reproducible fixtures: 1 Critical, 9 High, 16 Medium, 3 Low. The loop is playable and strategies genuinely differentiate (4,479-coin spread across eight shared-seed 28-day bots), but the build is not progress-safe: save serialization throws on a Svelte proxy so every reload returns to Start (`P2-RT-001`); a rent response spends into negative coin without paying rent, breaching the schema's zero minimum (`P7-EXP-001`); three ordinary restocks are free (`P7-EXP-002`); compact and rich pressure state disagree and reports render pre-response snapshots (`P4-SEAM-003`, `P7-EXP-004`); cards cite the wrong actor/room and Fix Root repairs a different room (`P5-PLAY-003`, `P5-PLAY-004`); closed reports mutate after the next day begins (`P4-SEAM-002`, `P6-COMP-006`); coaching recommends destructive choices (`P7-EXP-003`). None of the 29 was caught by the existing suite, which was green at audit time.
- **Impact:** No balance, content, or onboarding conclusion drawn from the current build is trustworthy — hence the pause on every other arc. The audit's own verdict: an interconnected prototype, not yet a progress-safe management game.
- **Scope:** Eight sequential waves, each ending at an evidence gate rather than at code completion — W0 durable progress · W1 canonical state + economy · W2 authoritative causality and closed reports · W3 decision lifecycle · W4 action reachability and contextual transfer · W5 secondary surfaces and identity · W6 issue relevance and attention load · W7 balance re-evaluation. Findings, wave membership, gates and per-finding status: `REMEDIATION_QUEUE.md`. Twelve design questions (`P2-OBS-001`, `P3-DC-001`, `DC-01…DC-10`) are decisions, not defects; answer each inside the wave that reaches it and record the answer in the queue.
- **Depends on:** none — Wave 0 starts immediately. Internally the waves are hard-ordered (a later wave's gate assumes the earlier fixes); `DC-09` (onboarding vs. complete surface) must be settled before the Tier 4 arc resumes.
- **Progress:** **Wave 0 done** (phase 199, `docs/plans/phase-199-audit-wave-0-durable-progress.md`) — `P2-RT-001` fixed and verified, its gate (R11/R12 at every beat and segment) passing under `tests/web/phase199.wave0.durableProgress.test.ts`. The run now survives reload: the envelope is built by a proxy-safe serializer, a serialization failure is a reportable save error with a working Retry instead of an uncaught throw, and the two gate fields that were never persisted — the Service outcome strip and the start-of-day baseline (now a patch against `state`, 218 KB against 1 585 KB at day 28) — cross the boundary. One observation raised for scheduling, recorded in the queue: `TavernState` grows without bound (the attribution ledger is 985 KB of a 1 691 KB day-28 state), so a long run will eventually exhaust the storage quota for reasons unrelated to this arc. **Next: Wave 1.**
- **Progress (Wave 1):** **done** (phase 200, `docs/plans/phase-200-audit-wave-1-canonical-state-and-economy.md`) — all five findings fixed and verified, gate passing under `tests/sim/phase200.wave1.canonicalStateAndEconomy.test.ts` plus `tests/sim/phase200.wave1.strategyMatrix.test.ts` (eight shared-seed 28-day strategies, per-day invariants). `state.pressures[id].value` is now the single pressure authority — synced to the rich snapshot every pass, recalculated after responses so the report and next morning read post-response truth, and emitting exactly one cause per significant move. Rent is one shared transition reached through a named `monthly.rent.payment` effect target, affordability-checked before any part of a profile is applied, with `spendCoin` throwing rather than driving the till negative; ordinary supplier purchases have a 1-coin floor. Three user decisions were recorded rather than guessed (DC-07 gate-at-selection + atomic re-check; additive price bias with a minimum unit price; direct pressure deltas persisting as decaying adjustments) — detail in the queue. **Consequence for Wave 7:** the duplicate pressure cause had been doubling attribution weight, so removing it slows pressure escalation; any tuning judged against the pre-Wave-1 build is suspect. **Next: Wave 2.**
- **Progress (Wave 2):** **done** (phase 201, `docs/plans/phase-201-audit-wave-2-authoritative-causality.md`) — all six findings fixed and verified, gate passing under `tests/sim/phase201.wave2.causality.test.ts` and `tests/web/phase201.wave2.closedReports.test.ts`. A daily report now projects from the state of the day it describes (`closedDayState`, persisted as a patch against live state via the Wave 0 codec), so every field is stable immediately, next morning, days later and after reload — not just the missed opportunities and resolved choices the audit caught. `scopedCauseEntries` replaces the any-tag cause query at entity-sensitive call sites: a cause must name the seed's own entity and no foreign one. Two further attribution leaks surfaced and were fixed — `pressureCauseRefsAsEntries` was flattening every breakdown line's actors to `[]`, and the Wave 1 pressure cause borrowed the dominant line's words with the snapshot's aggregate actors. Customer complaints anchor on the room that actually has the problem, so Fix Root repairs what the card cites. Missed-opportunity ranking uses signed utility instead of absolute magnitude, so blame/mock can no longer be coached as an opportunity. `DC-03` stays open; the ranking is deliberately objective-agnostic. **Next: Wave 3.**
- **Test approach:** Every wave ships regression coverage for its gate, per Phase 8 §8 (required routes R01–R15, state invariants, existing gates to retain). Bar for closing a finding: the audit's own route reproduces the defect before the fix and passes after, plus an automated assertion — reload-survival for W0, `coin >= 0` and pressure-authority equality across eight shared-seed 28-day runs for W1, field-stable closed reports across reload for W2, and so on. The `fixtures/` probes import the live `src/` tree and run as-is (`npx tsx docs/audits/2026-07-26-gameplay-audit/fixtures/phase2_quickday_probe.ts` verified after extraction) — reuse them as harnesses rather than rebuilding the routes. W7 re-runs the strategy matrix only after W0–W6 close.

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
