# Goblin Tavern Issue Tracker

Working source of truth for the post-Phase-40 repair pass. Each entry is a
problem-bundle: cross-cutting fixes for one feature or subsystem, scoped to
land as a single phase. Phase docs reference issue IDs and stay short; this
file holds the full description of what's broken, what needs to change, and
how to verify the fix.

## How to use this tracker

- **Issue IDs are stable.** Even if scope shifts or an issue gets split,
  never renumber. Cross-references in phase docs depend on stability.
- **Update status inline.** Edit the Status field as work progresses.
  When done, leave the entry in place — closed issues are history, not
  noise.
- **Dependencies are hard.** A `depends-on` issue must reach `done` before
  dependent work starts. If a dependency turns out to be wrong, fix it in
  the tracker before starting work.
- **Scope describes shape, not size.** What changes, not how big. No line
  counts. Phase docs may add detail; this file should not.
- **Test approach describes observable behavior change.** Not "add tests" —
  "what state mutation, attribution flow, or report output proves the fix
  worked end-to-end."
- **Numbered order = suggested sequencing.** Lower numbers should generally
  land first. Independent branches (e.g. core-slice roster grows) can be
  worked in parallel.

## Status legend

- `open` — not started
- `in-progress` — phase assigned, work underway
- `done` — phase merged, tests passing, behavior verified against the
  evidence in the issue entry
- `deferred` — known issue, consciously skipped this repair pass
- `superseded` — replaced by a later issue or arc. The entry stays in
  place as history; the `Superseded by:` field names the replacement.

## Current work

Next up, in this order:

1. **Tier 4 Progressive Onboarding arc** — start at **ISSUE-060**
   (phase 99, design contract); strictly linear through **ISSUE-077**
   (phase 116). Locked design contract: `docs/plans/progressive-onboarding.md`.
2. **Tier 6 Living Cast arc** — kicks off the card-layer work. Phase A
   landed as **ISSUE-090** (phase 121, status `done`); Phase B is the
   hand-authored convergence artifact at
   `docs/plans/living-cast-arc-phase-b.md` (no tracker ISSUE because no
   code shipped); Phase C landed as **ISSUE-092** (phase 123, status
   `done`); Phase D landed as **ISSUE-093** (phase 124, status `done`);
   Phase E landed as **ISSUE-094** (phase 125, status `done`).
   Phase F's first situation (staff_aside) landed as **ISSUE-095**
   (phase 126, status `done`) — hand-authored pool + spec, no API key
   used. Phase F repeats per situation: each new compositional template
   gets its own ISSUE-NNN entry. Phases F–G run against the locked
   roadmap `docs/plans/living-cast-arc.md` and the framework contract
   `docs/plans/card-composition-framework.md`.

ISSUE-058 and ISSUE-059 landed together as the combined phase 119+120
(see `docs/plans/phase-119-120-web-test-coverage-and-derived-audit.md`).

After Tier 4: the Living Cast arc takes over. The card-layer contract
(`docs/plans/cards-contract.md`) is locked; the compositional framework
(`docs/plans/card-composition-framework.md`) is locked; Phase A of the
arc is done. New tracker issues land here as each Living Cast phase
starts.

**Phase numbers vs. order.** Phase numbers are a file-naming convention,
not an execution order — ISSUE-058 has phase 119 but is next because of
its ISSUE-NNN ordering and the suggested sequencing rule below. Always
follow this "Current work" list and the `Depends on` chains; ignore
phase-number arithmetic when deciding what's next.

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
| ISSUE-100 | Voiced Surface Phase 5 — title & frame discipline: title becomes a composed slot; voice-bounds gate forbids trailing "…" / immediate duplicate token | thin | done | 131 |
| ISSUE-101 | Voiced Surface Phase 6 — choice & consequence voice: composed labels + effect previews on drinkOrder/staffAside; 4 new condition primitives (`responseVerb`, `responseShape`, `effectKind`, `effectTag`) | thin | done | 132 |
| ISSUE-102 | Voiced Surface Phase 7 — Staff & Personnel cluster: new `staffBurnout` compositional template supersedes legacy `staffRequest`; `staffAside` gains a sim-backed `establishing_line` slot; dangling textIngredients body grounding removed; +3 bootstrap fixes (SessionStart hook, phase132 typecheck, CardRenderer keyed-each) | thin | done | 133 |
| ISSUE-103 | Voiced Surface Phase 8 — Regulars & Complaints cluster: two new compositional templates (`regularComplaint`, `customerComplaint`) replace legacy `customerComplaintCard`; +4 band signals (`regular.irritation`, `regular.loyalty`, `customer_group.satisfaction`, `customer_group.loyalty`) added as a Movement I loopback | thin | done | 134 |
| ISSUE-104 | Voiced Surface Phase 9 — Suppliers, Stock & Debt cluster: three new compositional templates (`supplierReliability` replaces legacy `supplierOffer`; `stockShortage` and `debtRent` are first dedicated cards for those families); narrator-voiced ownerless framing (`back_of_house`, `office_quarters`) on the two ownerless ones; emits the Phase-3 converged spec verbatim for supplier | thin | done | 135 |
| ISSUE-105 | Voiced Surface Phase 10 — Factions & Culture cluster: two new compositional templates (`factionRequest` replaces legacy hand-written template; `cultureConflict` is the first dedicated card for the family — narrator-voiced because cultures have no `castAttributes`); +3 band signals (`culture.tension`, `culture.comfort`, `culture.familiarity`) added as a Movement I loopback | thin | done | 136 |
| ISSUE-106 | Voiced Surface Phase 11 — Premises & Atmosphere cluster: two new compositional templates (`maintenance` replaces legacy `maintenanceWarning`; `areaAtmosphere` is the first dedicated card for the family — narrator-voiced because areas have no `castAttributes`); +1 band signal (`area.damage`) added as a Movement I loopback; +1 role-resolution extension (`'location'` role on `resolveActorRef`) so area-centred narrator-voiced cards can read signals through the seed's `seed.location` ref | thin | done | 137 |
| ISSUE-107 | Voiced Surface Phase 12 — Crises & Safety cluster: three new compositional templates (`foodSafetyCrisis` rewritten in place as actor-voiced via cook castAttributes; `violence` and `inspection` are first dedicated cards for those families — pre-Phase 12 these seeds routed to `fallbackCard`); all three actor-voiced with graceful fallback when castAttributes are missing; +1 band signal (`customer_group.rowdiness`) added as a Movement I loopback; alignment fix on legacy `foodSafetyCrisis.appliesTo.timings` (`during_service` → `morning_prep`, matching the generator's actual emit) | thin | done | 138 |
| ISSUE-108 | Voiced Surface Phase 13 — Reputation, Rumour & Rivals cluster: three new compositional templates (`reputationShift` replaces legacy `reputationShiftWeeklyCard` whose `timings: ['end_week']` never matched the generator's `closing` emit — same alignment bug Phases 7 and 12 fixed; `rumourCrisis` is the first dedicated card for its family, actor-voiced through six possible castAttribute-bearing target kinds; `rivalTavern` is the first dedicated card for its family, narrator-voiced because the rival is a `local_event` arc or `system` ref); Movement I loopback is tag-enrichment on `seed.domain` rather than new band signals (`reputation.${axisId}`, `rumour.${accuracy}`, `rumour.target.${kind}`, `rival.arc` / `rival.system`) — enum / categorical facts don't band naturally and `hasTag` reads them directly without new SignalIds; `rumourCrisis` predicate gracefully falls through to `fallbackCard` when target is `tavern_identity` / `rumour` / `system` (no castAttributes) | thin | done | 139 |
| ISSUE-109 | Voiced Surface Phase 14 — Periodic & Narrative Beats cluster: closes Movement II. `monthlyReviewCard` rewritten in place as a compositional template (replaces legacy `composeBody` + raw `${label} ${value} (${trend})` pressure dumps; narrator-voiced `office_quarters`, title rendered with the fixed `Month in review:` colon-separated prefix preserving the legacy header frame); `seasonalArcCard` is the first dedicated card for the `seasonal_arc` family (pre-Phase 14 every seed routed to `fallbackCard`; one template covers both `arc_milestone` and `festival_preparation` types and both Path A active-arc + Path B anticipation paths; narrator-voiced `civic_floor`, title rendered with `${arcLabel ?? themeLabel ?? 'Seasonal event'}:` prefix mirroring rivalTavern's pattern). No Movement I loopback — the five seasonal themes are already in `seed.toneHints[2]` and reachable via `hasTag`; monthly_review pressures are reachable via `pressureRising` per ID. Weekly overview deferred to Phase 15 (Reports Prose) per user scope direction | thin | done | 140 |
| ISSUE-110 | Voiced Surface Phase 15 — Reports Prose: connector-only voicing across the projection-built daily-report surface. Seven new sections, each a single-slot snippet pool wired into a `ReportSection` via the existing `reportSectionAsTemplate` adapter: daily header (`opening` line), daily quiet day (full one-liner), missed-opportunities pressure_remedy readable + secondary, missed-opportunities diff_counterfactual readable, missed-opportunities ignored_seed readable, yesterday-digest secondary + coin verb, daily service-log Traffic / Service / Driver lines. Every figure (coin, deltas, patron counts, severities) stays sim-derived structural; only the leading verb / phrase / connector is voiced. Sim-emitted notes (weekly signals notes, weekly community notes, monthly landlord/inspection/rival narrative) excluded from scope — they live in sim modules at `src/sim/modules/weekly/*.ts` and `src/sim/modules/monthly/*.ts` and voicing them would require a sim-layer refactor that conflicts with the phase's "do not alter what reports measure" rule. Eight pool files at `src/reports/compose/pools/{missedOpportunity,yesterdayDigest,serviceLog}/`; section composers at `src/reports/compose/sections/{missedOpportunity,yesterdayDigest,serviceLog}.ts`. Three legacy hand-rolled prose helpers deleted (`composePressureReadable`, `composeDiffReadable`, `composeSeedReadable` + their `actionLabelGuess` / `capitalize` helpers) — no remaining call sites. Dedupe gate forced unique snippet text within each slot (initial draft had multiple `"would have eased"` variants distinguished only by gating); reworked so every snippet's text is canonically distinct | thin | done | 141 |
| ISSUE-111 | Voiced Surface Phase 16 — Ambient Surface & Legacy Retirement: closes Movement III by porting the last two surfaces off the Phase-95 voice composer and deleting the slice entirely. Three new single-slot narrator-voiced sections (`day.morning_empty`, `day.service_empty`, `day.closing_empty`) at `src/reports/compose/sections/{morningEmpty,serviceEmpty,closingEmpty}.ts` + pools at `src/reports/compose/pools/<section>/line.ts` replace the three `composeEmpty('morning'\|'service'\|'closing', voiceKey)` calls in `DayScreen.svelte` — five fallback snippets per pool lifted verbatim from `EMPTY_STATE_POOLS[kind]` to preserve voice, plus one or two `hasTag end_of_week`/`end_of_month` variants for milestone days. The fallback card rewritten in place at `src/cards/templates/fallback.ts` as a compositional template: one severity-gated narrator-voiced `title` pool at `src/cards/compose/pools/fallback/title.ts` (unconditional + low / mid / high rungs via `severityBelow` / `severityAtLeast`); body lines pass through `seed.textIngredients.{sensoryDetails,recentContext,pressureContext\|stakesReadable}` verbatim, since the fallback by definition catches families that cannot have per-family snippet pools and the cards-contract truth rule holds by sourcing body text only from sim-emitted state. Legacy slice deleted: `src/cards/voice/{composer,tonePools,index}.ts` and the whole `src/cards/voice/` directory; the eight-symbol re-export block at `src/cards/index.ts:68-80` replaced with a retirement note; `tests/cards/voice/composer.test.ts` deleted. New retirement-guard test at `tests/cards/voice/noLegacyImports.test.ts` walks `src/`, `web/src/`, and `tests/` and fails if any file imports from the retired path (split-literal needle so the scanner doesn't match itself). Tavern log + first-encounter hints documented out of scope: the tavern log is a pure projection over `state.history` (row summaries are sim-emitted at write time, not voiced strings, mirrors Phase 15's weekly/monthly notes carve-out), and first-encounter hints display static glossary `oneLine` / `longer` definitions that are deliberately stable for player learning. After Phase 16 nothing in the codebase imports `src/cards/voice/` and the legacy adjective-glue composer path is unreachable. Depends on ISSUE-099 (Phase 4 dedupe-as-gate) and ISSUE-110 (section composer infrastructure) | thin | done | 142 |
| ISSUE-112 | Voiced Surface Phase 17 — Cross-Situation Voice Consistency: closes Movement IV's centerpiece. New gate `checkCrossSituationVoice` at `src/cards/compose/gates/crossSituation.ts` plus harness `tests/cards/compose/gates/crossSituationHarness.ts` wiring the 11 migrated actor-voiced templates by actor kind (staff×4, regular×3, customer_group×3, faction×3, supplier×2, notable_npc×2). Holds five archetype voice profiles fixed (terse_cold, florid_warm, formal_prickly, two tic-bearing neutrals) and samples across every template the actor appears in. Three structural rules: per-archetype voice-pole expression (LIVENESS, ≥ ⌈templates × 0.5⌉ templates show axis-gated snippets), tic surfacing (LIVENESS, ≥2 templates for ≥3-template kinds, ≥1 for 2-template kinds), voice-blind pool detection (SAFETY, terse_cold vs florid_warm produce identical text in ≥80% of samples for the same `(template, slot)` pair). One refactor: `pickSnippet` now delegates to `pickSnippetTrace` in `src/cards/compose/assemble.ts` so the gate can introspect the chosen snippet's `conditions` array without re-running selection (public API unchanged; all 153 pre-existing compose tests still green). Three failure-fixture tests prove each violation reason fires. Cross-situation gate is a peer to `runAllGates` — NOT added to it, because `runAllGates` is template-scoped while cross-situation is multi-template by definition. Voice-axis rule is per-archetype-overall (not per-axis-pole) so real pools authoring only one direction of an axis (the "marked" pole) don't trip false positives — the rule catches the meaningful case where a fixed voiceProfile is invisible across most situations. Depends on ISSUE-099 (Phase 4 dedupe-as-gate) and the 11 Movement II migration ISSUEs (ISSUE-102…109) | thin | done | 143 |
| ISSUE-113 | Voiced Surface Phase 18 — Deepening, Pruning & Voice-Selection Repair (first playtest iteration of the standing-phase entry). Fixes the screenshot defect (Mira's `staff_identity` card showed "the kitchen keeps its quiet drumbeat" repeated across all 12 choices' previews; `area_atmosphere`, `seasonal_arc`, `inspection`, `stock_shortage` cards exhibited the same single-snippet collapse) plus the body-thinness defect (Mira's body and Mushroom Blight's body each collapsed to 2 lines for moderate-voiced actors because the optional `manner_note` slot's snippets all required two simultaneous voice extremes). Root cause: across the Movement II `effectPreview` pools every snippet was 2-condition `effectKind|effectTag + voiceAxis` with no base-rung fallback per `effectKind`, so when one snippet matched it covered every effect of that kind on the card; the `mannerNote` pools demanded two simultaneous extremes so neutral actors fired nothing. Repair: new 8th structural gate `checkPreviewVariety` at `src/cards/compose/gates/previewVariety.ts` (wired into `runAllGates` as optional config alongside the seven existing gates, exported alongside `PREVIEW_VARIETY_REASONS` / `PREVIEW_VARIETY_DEFAULTS`) — simulates a multi-choice card render through `pickSnippet` with the synthetic per-effect slot ids and fires on two failure modes (`within_card_preview_collapse` when ≥3 identical preview lines render in a row, `card_render_low_diversity` when the unique-to-total ratio of rendered preview lines falls below 0.15). Across all 20 Movement II `effectPreview` pools, added 4-8 unconditional kind-only base-rung snippets per pool covering `state_change` / `pressure` / `future_hook` / `cause` as applicable — the Phase-C FNV tie-break on per-effect synthetic slot ids now spreads across multiple candidates. Across all 20 `mannerNote` pools, added 3-4 `atLeast: 1` mid-rung snippets at explicit `specificity: 0` so neutral-voiced actors fire SOMETHING without outranking the extreme-rung snippets that prior tests depend on. Live regression test at `tests/cards/compose/gates/previewVariety.live.test.ts` exercises five screenshot-defect templates (`staffAside`, `staffBurnout`, `areaAtmosphere`, `seasonalArc`, `inspection`, `stockShortage`) with realistic multi-choice multi-effect renders. Gate threshold (`minUniqueRatio: 0.15`) tuned to distinguish the broken case (~0.04) from healthy multi-snippet pools (~0.25 with 6 snippets across 24 lines) without false positives on many-choice cards. Out of scope: title verbosity, report prose, day beats, choice labels (already varied), the fallback card, the legacy composer (already retired Phase 16). Phase 18 itself stays open as the standing playtest-driven phase; future playtest iterations append additional repair entries here. Depends on ISSUE-099 (Phase 4 dedupe-as-gate) and ISSUE-102…109 (Movement II migrations whose pools are repaired) | thin | done | 144 |

---

## Tier 0 — Infrastructure

The three tier-0 issues unblock most downstream work. They are mutually
independent and could be worked in parallel, but the suggested order
prioritizes leverage: response wiring unblocks the most features.

### ISSUE-001 — Response pipeline + unified pending queue

- **Grade:** broken
- **Status:** done
- **Phase:** 41
- **Evidence:**
  - `src/sim/modules/responses/responseResolver.ts:277` — pure transform
    that takes state + seed + intent and returns a new state. Called from
    3 unit/integration tests only; no module ever invokes it.
  - No `applyResponses` phase slot in `src/sim/core/phases.ts`. No
    `responsesModule.ts` under `src/sim/modules/responses/`.
  - `responseResolver.ts:90-213` — the resolver applies 2 of the 5
    declared `EffectKind` values. `cause`, `memory`, and `future_hook`
    effects return `{ applied: false, notes: ['non-state effect, recorded
    only'] }` and produce no state mutation.
  - `responseResolver.ts:311-321` — `delayedEffects` and `futureHooks`
    are collected into the result tuple and discarded by every caller.
- **Impact:** Every issue seed's response slots and consequence profiles
  are decorative. A player (or future card UI) can pick a response, the
  seed has 4-11 well-shaped slots, and the choice has zero effect on
  simulation state. Several seed families lean on `effect('cause', ...)`
  as their primary content; those effects are no-ops even if the
  resolver were wired.
- **Scope:**
  - Add `responsesModule` consuming `ctx.input.responseIntents`,
    registered on a new `applyResponses` phase slot (suggested placement:
    between `closing` and `endDay`).
  - Add `state.modules.responses.pending` slot holding both delayed-effect
    and futureHook records, drained on `startDay` via a new
    `pendingDrain` hook. Each entry carries `kind`, `origin`,
    `scheduledFor`, `expiresAt`, `payload`, optional `preconditions`.
  - Extend the resolver to dispatch all 5 effect kinds. Effects of kind
    `cause`, `memory`, `future_hook` should mutate state via the same
    paths the profile-level arrays use.
  - `SimInput` gains optional `responseIntents?: ResponseIntent[]`.
- **Depends on:** none
- **Test approach:** Test calls `simulateDay` with a `responseIntents`
  array selecting one slot of an active seed. Verify (a) immediate
  effects landed in state, (b) entries with future `scheduledFor`
  appear in `state.modules.responses.pending` and not in state yet,
  (c) advancing to `scheduledFor` day applies them, (d) entries past
  `expiresAt` drop with a log entry, (e) `immediateEffects` containing
  `effect('cause', ...)` produces a cause in `state.causes`.
- **Why this is first:** Largest single unblock. Roughly 50 of 70 hook
  IDs in the codebase have time or precondition semantics that depend
  on this queue existing.

### ISSUE-002 — World mutator cause emission + state diff coverage

- **Grade:** thin
- **Status:** done
- **Phase:** 42
- **Evidence:**
  - `src/sim/core/engine.ts` core mutators (`modifyArea`, `modifyStock`,
    `modifyStaff`, `modifyCustomerGroup`) emit one cause per changed
    field via `emitDiffPathCausesForRecord`.
  - `src/sim/core/engine.ts` world mutators (`modifyCulture`,
    `modifyFaction`, `modifySupplier`, `modifyRegular`, `modifyNotableNpc`,
    `modifyLocalEvent`, `modifySocialRumour`, `modifyTavernIdentity`)
    emit one aggregate cause per call via `addCauseInternal`, regardless
    of how many fields changed.
  - `createStateDiff` walks 8 slices: `coin`, `areas`, `stock`, `staff`,
    `customerGroups`, `reputation`, `pressures`, `memoriesCount`. It
    skips `state.world.*`, `state.modules.*`, `state.causes`,
    `state.calendar`, `state.meta`, `state.attribution`.
- **Impact:** A culture relationship shift, supplier reliability drop,
  faction tension change, or any module-slice update doesn't appear in
  the per-day `StateDiff.changes[]` array. Cause-coverage checks that
  rely on `cause.target === change.path` lookups can't see world
  mutations because the diff side is empty for those slices.
- **Scope:**
  - Apply `emitDiffPathCausesForRecord` to the 8 world mutators,
    matching the core-mutator pattern. One cause per changed field on
    a single `modify*` call.
  - Extend `createStateDiff` to walk `state.world.*` (per id, per field
    on record-typed slices) and `state.modules.*` (per slice, per key).
  - Verify the cause-coverage output in `expandedReadinessReport.ts`
    now credits world-entity mutations.
- **Depends on:** none
- **Test approach:** Mutate a culture, supplier, faction in a test;
  verify (a) one cause per changed field appears in `state.causes`,
  (b) the matching diff entries appear in `getDiff('owner_actions')`,
  (c) cause-coverage credits the change.
- **Why bundled:** Fixing one without the other emits causes without
  diff entries to match them, or walks the diff to find changes that
  haven't been attributed. Both halves are needed for the
  cause-coverage check to work.

### ISSUE-003 — Per-cause `relatedActors` in 4 silent calculators

- **Grade:** broken
- **Status:** done
- **Phase:** 43
- **Evidence:**
  - `src/sim/modules/pressures/calculators/arcEscalation.ts` — 7
    `pushCause` sites, all with empty `relatedActors`. The arc ref is
    available locally at line 42.
  - `src/sim/modules/pressures/calculators/policyBacklash.ts` — 5
    `pushCause` sites, all with empty `relatedActors`. The policy and
    customer-group refs are available at lines 51-55.
  - `src/sim/modules/pressures/calculators/marketInstability.ts` — 6
    `pushCause` sites, all with empty `relatedActors`. No actor refs
    available in current scope; needs upstream supplier module to pass
    them through.
  - `src/sim/modules/pressures/calculators/festivalReadiness.ts` — 10
    `pushCause` sites, all with empty `relatedActors`. The arc ref is
    available locally at line 42.
  - `src/sim/modules/localArcs/arcEffects.ts:73-94` — same shape:
    raw cause object built without `relatedActors` despite `arc.id`
    being in scope.
- **Impact:** Causes from these four calculators carry no actor
  attribution. Attribution propagation skips them; entity memories
  don't accumulate from arc, policy, market, or festival sources;
  downstream consumers reading those entity memories find nothing.
- **Scope:**
  - Attach `relatedActors: [refsAvailableInScope]` to each `pushCause`
    call in the four calculators. Three are mechanical (refs are local).
  - `marketInstability` requires `src/sim/modules/suppliers/supplierModule.ts`
    to pass affected supplier refs into the calculator's context.
  - Add `relatedActors: [{ kind: 'local_event', id: arc.id }]` to the
    raw cause write in `arcEffects.ts:73-94`. Same fix shape.
- **Depends on:** none
- **Test approach:** Run a simulated month; verify each of the four
  calculators' causes now carries non-empty `relatedActors`. Verify
  arc / policy / market / festival entities accumulate attribution
  entries in `state.attribution` and that those entities appear in
  the named-entity-repetition report as expected.

### ISSUE-004 — NPC factory + initial notable NPC roster

- **Grade:** broken
- **Status:** done
- **Phase:** 44
- **Evidence:**
  - `src/sim/content/npc/npcFactory.ts` — entire file is a placeholder
    comment plus `export {}`. No factory function exists.
  - `state.world.notableNpcs` schema is defined (`TavernState.ts:540`,
    `defaults.ts:439` initializes to `{}`).
  - 8 readers of the `notable_npc` ref kind across pressure, feedback,
    weekly, service, issues, and causes modules. Every code path that
    branches on `notable_npc` ref kind is unreachable in practice.
  - At least one orphan seed hook (`town_watch_advisor`) currently has
    nothing to bind to.
- **Impact:** Roughly 8 systems contain code that can never execute
  because no notable NPC ever exists in state. The
  `notable_npc_repetition` axis of the named-entity-repetition report
  is mathematically zero.
- **Scope:**
  - Implement `createNotableNpc(rng, profile, ...)` in
    `src/sim/content/npc/npcFactory.ts`.
  - Define 6-10 starter notable NPCs across factions: a town watch
    inspector, a rival owner, a moneylender, a town gossip, a fence,
    a priest, a merchant prince, a captain of the watch. Each carries
    name, culture, faction membership, area affinity, initial state.
  - Seed them at simulation start via a `defaults.ts` initializer.
  - Add at least one seed family hook that binds to a notable NPC
    (the orphan `town_watch_advisor` is the obvious candidate).
- **Depends on:** ISSUE-002 (NPCs are world entities; their mutations
  should emit per-field causes from day one).
- **Test approach:** Start a fresh simulation, verify
  `state.world.notableNpcs` has the seeded entries, run a month,
  verify at least one seed family binds to a notable NPC ref and
  resolves through validation, verify `notable_npc:` keys appear in
  the named-entity-repetition report.

---

## Tier 1 — Roster grows

These add the content density the picker needs to stop saturating the same
entities every day. Core-slice grows (staff, areas, stock, customer groups)
have no infrastructure dependency; world-slice grows depend on ISSUE-002.

The overuse threshold used in evidence below is 6+ hits per actor per 28
days from the named-entity-repetition report. Where a current hit count is
cited, it's the count observed on the most recent 28-day audit run.

### ISSUE-005 — Grow staff roster + role-specific identity

- **Grade:** thin
- **Status:** superseded
- **Phase:** unassigned
- **Superseded by:** ISSUE-031 (cook tier grow + preparation gating)
- **Supersede note:** The Rare Ingredients Economy arc subsumes this
  work. See `docs/plans/rare-ingredients-economy.md`. The original
  scope below is preserved for history; the actual staff grow happens
  in ISSUE-031 where cook skill becomes load-bearing against recipe
  prepDifficulty.
- **Evidence:**
  - `src/sim/registries/staffRegistry.ts:41,65,89` — 3 roles only
    (`cook`, `server`, `cleaner_bouncer`).
  - 28-day named-entity-repetition: `staff:server = 56` hits (2.0/day,
    ~10× the overuse threshold).
  - With perfect round-robin across 3 roles, each staff member fires
    ~9× per 28 days — still above threshold.
- **Impact:** Picker has nowhere to rotate to. Penalties (overuse,
  recency) bite on every pick because every alternative is also above
  threshold. `staff_identity` family can't escape repetition.
- **Scope:** Add 5-7 staff roles (e.g. host, kitchenhand, runner,
  doorkeeper, specialist musician, second cook, swing-shift bouncer).
  Each carries a full identity profile in 3+ naming cultures, distinct
  stat profile, signature pressures, and contributes at least one
  role-specific incident family element.
- **Depends on:** none (staff is a core slice with per-field cause
  emission already correct)
- **Test approach:** Run a 28-day simulation; verify no single staff
  member is picked more than ~6 times. Confirm `staff_identity` family
  rotates across the grown roster via the existing recencyPenalty
  primitive.

### ISSUE-006 — Grow areas roster + un-pin `main_room`

- **Grade:** thin
- **Status:** superseded
- **Phase:** unassigned
- **Superseded by:** ISSUE-033 (storage areas + system integration polish)
- **Supersede note:** The Rare Ingredients Economy arc subsumes this
  work. See `docs/plans/rare-ingredients-economy.md`. The original
  scope below is preserved for history; ISSUE-033 carries the same
  un-pinning work plus two areas with gameplay weight (herb garden,
  cold cellar).
- **Evidence:**
  - `src/sim/registries/areaRegistry.ts:32,49,66,83,100` — 5 areas
    (`main_room`, `kitchen`, `cellar`, `privy`, `roof`).
  - 28-day hit count: `area:main_room = 52`.
  - 8 hardcoded `areaRef('main_room')` writes in
    `src/sim/modules/issues/issueSeedGenerators.ts:989,1734,1811,1996,2076,2564,2710`
    plus 1 in expandedSeedGenerators. Three different use modes:
    `location:`, `targetOptions:`, response slot fallback.
- **Impact:** Even growing the roster doesn't help atmosphere /
  maintenance / violence seeds because they pin `main_room` directly,
  not pick through state. Roster grow + pin removal must land together
  to actually spread area usage.
- **Scope:**
  - Add 4-6 areas: a back patio or garden, a private booth area, a
    stage corner, a beer cellar separate from food cellar, a yard or
    stable. Each gets cleanliness, comfort, condition fields plus
    candidate traits/upgrades.
  - Remove the 8 hardcoded `areaRef('main_room')` writes. Replace each
    with picker-driven area selection where the seed is
    location-agnostic, or with state-driven rotation where the seed
    targets a specific area type.
- **Depends on:** none (areas is a core slice)
- **Test approach:** Verify `area:main_room` hit count drops from 52 to
  roster-proportional (~10 per 28 days). Verify `area_atmosphere`,
  `maintenance`, `inspection` seed families rotate across the grown
  roster rather than always selecting `main_room`.

### ISSUE-007 — Grow stock items roster

- **Grade:** thin
- **Status:** superseded
- **Phase:** unassigned
- **Superseded by:** ISSUE-025 (stock-and-recipe model extension),
  ISSUE-026 (ingredient + starter recipe catalog grow)
- **Supersede note:** The Rare Ingredients Economy arc subsumes this
  work. See `docs/plans/rare-ingredients-economy.md`. The original
  scope below treated stock as a flat list to extend; the new arc
  introduces rarity tiers and a recipe layer first, then grows the
  catalog within that structure.
- **Evidence:** `src/sim/registries/stockRegistry.ts:27,40,53,66,86,99`
  — 6 items (`ale`, `stew`, `ingredients`, `mushrooms`, `firewood`,
  `mugs`).
- **Impact:** Menu narrative breadth is 6 items. Every "what should I
  serve at the festival" decision points at the same six. Specialty
  drinks, multiple food items, seasonal items are all absent. Stock
  isn't a named-entity-repetition target, so there's no hit-count
  number to cite — the gap is gameplay variety, not picker saturation.
- **Scope:** Add 4-6 stock items: a second ale variant (cheap vs
  premium), a soup or bread food alternate to stew, a snack item
  (nuts, pickles), candles, a specialty drink tied to one culture.
  Each gets full price tier, spoilage profile, supplier tag.
- **Depends on:** none (stock is a core slice)
- **Test approach:** Verify festival, event, and owner-action surfaces
  that read stock now have variety in generated targets. Verify the
  new items participate in shortage and quality memory writes through
  existing service and supplier paths.

### ISSUE-008 — Grow customer groups roster

- **Grade:** thin
- **Status:** superseded
- **Phase:** unassigned
- **Superseded by:** ISSUE-032 (demand-side niche customer groups)
- **Supersede note:** The Rare Ingredients Economy arc subsumes this
  work. See `docs/plans/rare-ingredients-economy.md`. The original
  scope's "fringe group" gap is filled by niche groups gated on the
  new `culinary_renown` reputation axis — their existence is a
  consequence of the gameplay loop rather than a standalone roster
  addition.
- **Evidence:**
  - `src/sim/registries/customerRegistry.ts:46,86,126,166,206` — 5
    groups (`local_goblins`, `miners`, `merchants`, `ogres`,
    `adventurers`).
  - 28-day hit counts: `local_goblins = 34`, `merchants = 32`,
    `miners = 30`. All groups saturate the per-entity cap.
- **Impact:** The 5 groups cover the main archetypes (locals, labour,
  wealth, muscle, wandering) but leave gaps: no fringe group, no
  time-of-day-specific group, no faction-aligned visitor. The picker
  has no untainted alternative.
- **Scope:** Add 3-4 groups with sharper trade-offs: a "tips well but
  high-maintenance" group, a "violent but profitable" group, a
  "low-spend but boosts other groups" social attractor, a
  faction-on-duty group (e.g. `town_watch_on_shift`). Each carries
  `preferredStockTags`, `dislikedTags`, `cultureId`,
  satisfaction/loyalty/patronage profile.
- **Depends on:** none (customer groups is a core slice)
- **Test approach:** Verify the new groups appear as primary actors in
  appropriate seed families, the picker rotates across the grown set
  with the per-group hit count dropping into the roster-proportional
  range, and at least one group's `dislikedTags` interaction creates
  a memory observable in tests.

### ISSUE-009 — Grow suppliers roster + specialty category

- **Grade:** thin
- **Status:** superseded
- **Phase:** unassigned
- **Superseded by:** ISSUE-028 (specialty supplier expansion)
- **Supersede note:** The Rare Ingredients Economy arc subsumes this
  work. See `docs/plans/rare-ingredients-economy.md`. ISSUE-028 carries
  the same expansion plus the specialty category, now scoped to carry
  uncommon-tier ingredients as the low-effort baseline acquisition
  path before expeditions.
- **Evidence:**
  - `src/sim/content/suppliers/supplierRegistry.ts:20,33,46,59` — 4
    suppliers, one per category (mushrooms, ale, grain, meat).
  - 28-day hit count: `supplier:brakka_mushroom_cart = 35` (highest
    single-supplier count).
  - One supplier per category means there's no actual switching
    choice. Switching `brakka_mushroom_cart` means losing mushrooms
    entirely.
- **Impact:** The `supplier_distrust` pressure's recommendation to
  "switch to alternate" has nowhere to switch to. The
  `supplier_relationship` family fires but its "negotiate with
  supplier" and "switch supplier" responses are phantom options.
- **Scope:** Add a second supplier per existing category with
  deliberately different trade-offs (cheap-unreliable vs
  expensive-stable). Add one new category (suggest spices, herbs, or
  candles) with a single starter supplier. The "switch supplier"
  consequence option must now have a meaningful target.
- **Depends on:** ISSUE-002 (suppliers are world entities)
- **Test approach:** Verify `supplierDistrust` pressure's "switch to
  alternate" resolves to a real supplier in the same category. Verify
  `supplier_relationship` family rotates across the grown set rather
  than concentrating on `brakka_mushroom_cart`.

### ISSUE-010 — Grow cultures + cross-cutting cultures + tag alignment

- **Grade:** thin
- **Status:** done
- **Phase:** 50
- **Evidence:**
  - `src/sim/content/cultures/cultureRegistry.ts:22,41,60,79,98` — 5
    cultures (`goblin_local`, `miner_workcrew`, `merchant_roadfolk`,
    `ogre_clans`, `adventuring_bands`). Each maps 1:1 to a customer
    group.
  - `src/sim/modules/pressures/calculators/culturalTension.ts:108-110`
    reads memory tags `cultural_misunderstanding`, `seating_conflict`,
    `food_taboo`. No producer in `src/sim/` writes any of these tags.
- **Impact:** The 1:1 culture-to-group mapping makes `culturalTension`
  essentially equivalent to `customer_group_friction` — same axis
  encoded twice. The three dead-read tags mean `culturalTension`
  rarely fires even when culture-group conditions would warrant it.
- **Scope:**
  - Add 3-5 cross-cutting cultures: a religious or regional overlay
    that spans multiple customer groups, an outsider culture that any
    group can have members from, a professional culture (e.g. guild
    membership) orthogonal to background.
  - Wire producers for the 3 dead tags: add memory writes from
    appropriate service or event paths that emit
    `cultural_misunderstanding`, `seating_conflict`, `food_taboo` so
    `culturalTension` has tag conditions to read.
- **Depends on:** ISSUE-002 (cultures are world entities)
- **Test approach:** Verify `culturalTension` fires in tests that
  produce the relevant tag conditions. Verify at least one
  cross-cutting culture has members across 2+ customer groups in
  generated state.

### ISSUE-011 — Lift regular cap + add starter regulars

- **Grade:** thin
- **Status:** done
- **Phase:** 51
- **Evidence:**
  - `src/sim/state/defaults.ts:363-370` — 6 starter regulars across 5
    customer groups.
  - `src/sim/modules/regulars/regularModule.ts:51` —
    `MAX_REGULARS_PER_GROUP = 3`. Maximum 15 emergent regulars across
    the simulation, plus 6 starters.
- **Impact:** Realistic mid-run named-regular population is ~10-12.
  The `regular_customer` family rotates over this small pool, and
  inactive regulars never decay — once a slot is filled, no new
  regular can emerge there.
- **Scope:**
  - Lift `MAX_REGULARS_PER_GROUP` from 3 to 6-8.
  - Add a soft-decay rule so inactive regulars age out (visit recency
    plus irritation threshold) rather than a hard cap blocking
    emergence.
  - Add 4-6 more starter regulars, at least one tied to a faction or
    notable-NPC source rather than just a customer-group base.
- **Depends on:** ISSUE-002 (regulars are world entities)
- **Test approach:** Run a 90-day simulation; verify the regulars
  population reaches ~20-30 named entities across groups, that
  long-inactive regulars decay out of named state, that
  `regular_customer` family has a rotatable roster.

### ISSUE-012 — Add niche factions + factionUpdate triggers for missing 2

- **Grade:** thin
- **Status:** done
- **Phase:** 52
- **Evidence:**
  - `src/sim/content/factions/factionRegistry.ts:15,30,44,58,72,86` —
    6 factions. Count is healthy; the gap is breadth.
  - `src/sim/modules/factions/factionModule.ts` — `factionUpdate`
    hook has 4 hardcoded trigger pairs (`town_watch ← violence`,
    `brewers_guild ← debt`, `market_caravan_circle ← stock_shortage`,
    `miners_union ← payday-satisfaction`). `local_shrine` and
    `scrap_collectors` get no module-driven drift.
- **Impact:** The two factions without trigger pairs have no source of
  state variation other than what seed generators and attribution
  rules do to them. They feel mechanically inert relative to the
  other four.
- **Scope:**
  - Add 2-3 niche factions (suggest a smugglers' ring, a noble house,
    a rival tavern's faction) for breadth and to support inspection
    rotation downstream.
  - Add `factionUpdate` trigger pairs for `local_shrine` (reacts to
    celebration, mourning, cultural events) and `scrap_collectors`
    (reacts to maintenance, waste, supply chain events) so all
    factions get module-driven drift.
- **Depends on:** ISSUE-002 (factions are world entities)
- **Test approach:** Run a simulated month with conditions matching
  each new trigger pair; verify `local_shrine` and `scrap_collectors`
  drift on those days. Verify the new factions appear in
  `state.world.factions` and as `faction_request` family targets.

---

## Tier 1.5 — Rare Ingredients Economy

This tier replaces the original ISSUE-005…ISSUE-009 roster grows with a
unified gameplay system: the player commissions adventurers to fetch
rare ingredients, cooks prepare them at varying skill, and the tavern's
culinary reputation pulls in new niche customer groups.

The arc's full design lives in
[`docs/plans/rare-ingredients-economy.md`](plans/rare-ingredients-economy.md).
That document is the locked specification. Each issue below references
the design doc for the authoritative rules; the entry itself records the
issue-scoped evidence, scope summary, dependencies, and verification
approach.

The dependency chain forces a clear order: model first (025), data
second (026), reputation and acquisition paths next (027, 028, 029,
030), preparation and demand (031, 032), integration last (033).

### ISSUE-025 — Stock-and-recipe model extension

- **Grade:** thin
- **Status:** done
- **Phase:** 65
- **Supersedes:** ISSUE-007 (grow stock items roster)
- **Evidence:**
  - `src/sim/registries/stockRegistry.ts` — 6 stock items, no rarity
    classification.
  - `src/sim/state/TavernState.ts` — no recipe state, no recipe
    registry. The service flow consumes stock items directly as if
    they were the served dishes.
  - `serviceModule.resolveService` — sale price computed from
    `stockState.salePrice` directly, with no preparation step
    between ingredient and dish.
- **Impact:** No mechanism to differentiate rare ingredients from
  common ones. Customer demand and memory writes point at stock ids,
  not dishes — adding multi-input recipes later would require
  retroactively rewriting every memory key and demand profile. The
  recipe abstraction is the only stable place to put `prepDifficulty`,
  cultural tags, and demand-tier metadata.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §5.1, §5.2,
  §6.1. Add `rarity` field to `StockState`. Add `recipeRegistry` with
  `RecipeDefinition` carrying `inputs`, `prepDifficulty`, `demandTier`,
  `culturalTags`. Add `state.recipes` slice with Zod schema. Extend
  `serviceModule.resolveService` so customer orders resolve to a
  recipe id, the recipe's `inputs` decrement from stock, and served
  quality computes from ingredient quality plus a cook prep multiplier
  (the cook-skill gate wires in ISSUE-031). Classify the existing six
  stock items as `common`. Register 1:1 starter recipes for each so
  the existing service flow continues to function unchanged.
- **Depends on:** none (foundation issue for the arc)
- **Test approach:** Existing `phase09.stock.test.ts` and
  `phase12.service.test.ts` continue to pass with their stock items
  graded `common` and routed through 1:1 recipes. New tests:
  cross-reference validation rejects a recipe whose `inputs`
  reference an unknown ingredient id; state with `recipes`
  round-trips through schemas without loss; a 7-day playtest using
  only the existing six items shows no behaviour change versus the
  pre-extension baseline.

### ISSUE-026 — Ingredient + starter recipe catalog grow

- **Grade:** thin
- **Status:** done
- **Phase:** 66
- **Evidence:**
  - `src/sim/registries/stockRegistry.ts` — 6 items, all `common`
    after ISSUE-025 lands.
  - Without uncommon/rare/legendary ingredients, the rest of the arc
    has nothing to operate on: suppliers can't carry specialty goods,
    expeditions have nothing to fetch, cooks have nothing to botch,
    niche customers have nothing to demand.
- **Impact:** This is the data layer the entire arc reads from. Six
  ingredients across one tier is not enough for the picker, the
  expedition outcome roller, the customer demand model, or the
  cook-skill gate to do anything meaningful.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.1, §6.2.
  Add 12–18 ingredient definitions distributed across the four rarity
  tiers (approximately 0 common, 4–6 uncommon, 5–8 rare, 2–4
  legendary). Each carries the full stock fields plus rarity, tag list
  including any cultural tags, and an appropriate spoilage profile per
  the rarity-tier table in §4.1. Register a 1:1 starter recipe per new
  ingredient (`dish_<ingredient_id>`) with `prepDifficulty` set per
  tier (common 20, uncommon 40, rare 65, legendary 85) and
  `demandTier` matching rarity.
- **Depends on:** ISSUE-025
- **Test approach:** Cross-reference validation passes across all
  registries. Each new ingredient has a corresponding 1:1 recipe.
  Spoilage-rate tests confirm rare and legendary items decay roughly
  twice as fast as common. The grow is observable in the
  named-entity-repetition report as new entities available for picker
  rotation.

### ISSUE-027 — Culinary renown reputation axis

- **Grade:** thin
- **Status:** done
- **Phase:** 67
- **Evidence:**
  - `src/sim/state/defaults.ts:186-201` — `createInitialReputation()`
    returns 9 axes; none capture fame for sourcing rare ingredients.
  - `tasty` measures execution; `strange` measures oddity. Neither
    suits a loop where having a rare ingredient *and* serving it well
    both feed the same fame signal.
- **Impact:** Without a renown axis, niche customer arrival has
  nothing to gate on, the loop's positive feedback has nowhere to
  accumulate, and expedition/preparation outcomes have no reputation
  surface to register against.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.6, §5.5,
  §6.6. Register `culinary_renown` in `reputationRegistry`. Add the
  field to `ReputationState` with initial value 10. Wire producers:
  positive drift on uncommon-tier+ recipe served well, on excellent
  prep of rare+, on expedition success; negative drift on
  rare-tier+ ingredient spoilage, on botched rare-tier+ prep, on
  `runner_lost` involving a named adventurer (relationship > 60).
  Every drift writes a cause entry with `relatedActors`. Slow natural
  decay when only common-tier dishes are served for an extended
  period.
- **Depends on:** ISSUE-025, ISSUE-026
- **Test approach:** Reputation round-trips through schemas. Serving a
  rare-tier+ recipe with cook skill ≥ prepDifficulty registers a
  positive drift with cause entry. Botching a rare-tier+ recipe
  registers negative drift. A 30-day playtest serving only common
  dishes shows `culinary_renown` drifting slowly downward toward 0.

### ISSUE-028 — Specialty supplier expansion

- **Grade:** thin
- **Status:** done
- **Phase:** 68
- **Supersedes:** ISSUE-009 (grow suppliers roster + specialty category)
- **Evidence:**
  - `src/sim/content/suppliers/supplierRegistry.ts` — 4 suppliers, one
    per category. All goods provided are `common` tier.
  - `supplierDistrust` calculator's "switch to alternate"
    recommendation has no real target — one supplier per category
    means switching loses the category entirely.
  - 28-day hit count: `supplier:brakka_mushroom_cart = 35`.
- **Impact:** Without specialty suppliers, the only path to
  uncommon-tier ingredients is expeditions, which are high-effort. The
  system needs a low-effort, predictable baseline route to uncommon so
  the player can step into the rare-ingredient economy before
  committing to expeditions.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §6.2. Add a
  second supplier per existing category with deliberately different
  trade-offs (cheap-unreliable vs expensive-stable), at least one of
  which carries one uncommon-tier ingredient in its `goodsProvided`.
  Add one new category — "specialty goods" — with one starter supplier
  providing 2–3 uncommon-tier ingredients. The "switch supplier"
  consequence option in the `supplier_relationship` family now has
  meaningful targets.
- **Depends on:** ISSUE-002, ISSUE-026
- **Test approach:** Cross-reference validation passes (every
  `goodsProvided` id exists in stockRegistry). `supplier_distrust`
  pressure's "switch to alternate" resolves to a real supplier in the
  same category. The grown roster appears in the named-entity-
  repetition report with hit counts dropping from the prior
  `brakka_mushroom_cart = 35` concentration into the
  roster-proportional range.

### ISSUE-029 — Hireable adventurer roster

- **Grade:** thin
- **Status:** done
- **Phase:** 69
- **Evidence:**
  - `state.world.hireableAdventurers` does not exist.
  - `npc_identity` RNG stream has only one consumer (ISSUE-004's
    notable NPC roster); ISSUE-023 flagged it as under-wired.
  - The existing `adventurers` customer group represents demand-side
    adventurers; no supply-side counterpart exists.
- **Impact:** Without a persistent hireable roster, expeditions have
  nothing to commission against. The roster must exist before
  ISSUE-030 can wire the action surface.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.5, §5.4,
  §6.4. Add `state.world.hireableAdventurers: HireableAdventurer[]`.
  Seed: 3 hireable adventurers generated via the `npc_identity` RNG
  stream using the existing `adventuring_bands` naming profile. Soft
  cap 4 (rising with `culinary_renown`), hard cap 6. Weekly drift
  evaluated by `adventurer_roster` RNG stream: roster slots may turn
  over per the rules in §5.4. Each adventurer carries experience,
  reliability, relationship, specialty tag, wageBase,
  daysSinceLastJob, currentExpeditionId. Add new `onExpeditionResolved`
  hook that adjusts the runner's stats post-resolution (consumed in
  ISSUE-030).
- **Depends on:** ISSUE-004, ISSUE-026
- **Test approach:** Adventurers generate deterministically from
  seed. Names are generated once at creation and persist across
  reloads. The soft cap responds to `culinary_renown` changes over a
  90-day playtest. Long-inactive adventurers
  (`daysSinceLastJob > 60`, `relationship < 40`) leave the roster on
  a weekly drift evaluation. State round-trips through Zod schemas.

### ISSUE-030 — Expedition subsystem

- **Grade:** thin
- **Status:** done
- **Phase:** 70
- **Evidence:**
  - No expedition action surface exists. The only player-driven stock
    acquisition is implicit through suppliers.
  - No mechanism for rare-tier ingredient acquisition exists at all.
- **Impact:** This is the system's core agency — the player decision
  that activates the whole loop. Without expeditions, the catalog of
  rare ingredients is unreachable, the adventurer roster is
  decorative, and `culinary_renown` has nothing meaningful driving its
  peaks.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.4, §5.3,
  §6.3. Introduce `expeditionsModule`. Add `state.expeditions` with
  `active` and `completed` slices. Add the `commissionExpedition`
  owner action validating runner availability and player coin. Add
  `onDayStart` hook incrementing `daysElapsed` for each active
  expedition; resolve those whose `daysElapsed >= daysTotal` using the
  expedition's named RNG stream (`expedition_<expeditionId>`). Outcome
  biased by runner experience and reliability, target tier, and mode.
  Four outcome types: success, partial, failure, runner_lost.
  Successful outcomes write ingredients to stock with quality computed
  via `ingredient_quality_<expeditionId>` stream. Memory writes:
  `expedition_success`, `expedition_failure`, `runner_lost`. Cause
  entries against `culinary_renown` per the rules in §6.6. Cap the
  `completed` log at 50 most recent entries.
- **Depends on:** ISSUE-029
- **Test approach:** Same seed + same `commissionExpedition` input +
  same days = same outcome. Saving mid-expedition (`daysElapsed = 3`
  of 7) and reloading resolves identically on day 7. An extra
  niche-customer arrival roll on day 5 does not shift the outcome on
  day 7 (named stream isolation). `runner_lost` outcome removes the
  runner from `hireableAdventurers`. State round-trips through Zod
  schemas across an active expedition.

### ISSUE-031 — Cook tier grow + preparation gating

- **Grade:** thin
- **Status:** done
- **Phase:** 71
- **Supersedes:** ISSUE-005 (grow staff roster + role-specific identity)
- **Evidence:**
  - `src/sim/registries/staffRegistry.ts` — 3 roles, all with similar
    skill profiles (45–55). No skill differentiation against recipe
    prepDifficulty.
  - 28-day named-entity-repetition: `staff:server = 56` hits (2.0/day,
    ~10× the overuse threshold).
  - With recipes graded prepDifficulty 20 / 40 / 65 / 85 (ISSUE-026),
    a default cook (skill 55) botches every rare and legendary recipe.
- **Impact:** The preparation half of the loop is empty without cooks
  who can clear uncommon and rare tiers. Better cooks must be a
  meaningful purchase, not just additional names on the roster.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.3, §6.5.
  Add 3–4 new staff role definitions to `staffRegistry`:
  `kitchen_hand` (low skill), `seasoned_cook` (mid skill, clean
  uncommon, attempts rare), `master_chef` (high skill, clean through
  rare, attempts legendary), `forager_cook` (modest skill, reduces
  in-kitchen spoilage). Each carries a full identity profile in 3+
  naming cultures and a distinct stat profile. Add the soft-gate prep
  check in `serviceModule.resolveService`: skill vs
  `recipe.prepDifficulty` with a margin window. Memory writes:
  `excellent_preparation` on skill above the upper margin,
  `botched_preparation` on skill below the lower margin, including the
  gap as severity.
- **Depends on:** ISSUE-025, ISSUE-026
- **Test approach:** A kitchen_hand attempting a rare recipe produces
  a `botched_preparation` memory and a quality penalty. A master_chef
  on the same recipe produces an `excellent_preparation` memory and a
  quality bonus. `staff:server` and other roles drop from the prior
  56-hit concentration in the named-entity-repetition report. The
  `staff_identity` family rotates across the grown roster via the
  existing recencyPenalty primitive.

### ISSUE-032 — Demand-side niche customer groups

- **Grade:** thin
- **Status:** done
- **Phase:** 72
- **Supersedes:** ISSUE-008 (grow customer groups roster)
- **Evidence:**
  - `src/sim/registries/customerRegistry.ts` — 5 groups, all active
    from day zero. No threshold-gated arrival.
  - No customer group exists whose patronage scales with
    `culinary_renown`.
  - 28-day hit counts on existing groups (`local_goblins = 34`,
    `merchants = 32`, `miners = 30`) saturate the per-entity cap, but
    the gap is not just density — it's the absence of any group whose
    behaviour responds to fame.
- **Impact:** Without niche groups, the demand-side of the loop is
  static — increasing `culinary_renown` produces no new customer
  behaviour. The fame is invisible to the player.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.7, §5.6,
  §6.7. Add 4–5 new customer groups: gourmand (threshold 30), foreign
  envoy (threshold 55), food critic (threshold 50), eccentric noble
  (threshold 70), and one more at the implementer's discretion. Add
  the `minRenownThreshold` field to `CustomerGroupDefinition`. Each
  new group's `preferredStockTags` align with specific recipe tiers or
  cultural tags. Groups appear in `state.customerGroups` from day zero
  but are inactive (`patronage: 0`) until threshold is crossed. Add a
  decay rule: if a group's preferred recipes haven't been served for N
  days, patronage drops back toward 0. Memory write:
  `niche_visitor_arrived` on threshold crossing.
- **Depends on:** ISSUE-026, ISSUE-027
- **Test approach:** With `culinary_renown < 30`, no niche groups are
  active. Raising renown across thresholds activates the corresponding
  groups in order. A 30-day playtest serving only common recipes after
  a niche group activates causes that group to decay back to inactive.
  Each niche group's arrival appears as a memory entry with
  `relatedActors` populated.

### ISSUE-033 — Storage areas + system integration polish

- **Grade:** thin
- **Status:** done
- **Phase:** 73
- **Supersedes:** ISSUE-006 (grow areas roster + un-pin `main_room`)
- **Evidence:**
  - `src/sim/registries/areaRegistry.ts:32,49,66,83,100` — 5 areas,
    all generic.
  - 28-day hit count: `area:main_room = 52`.
  - 8 hardcoded `areaRef('main_room')` writes in
    `src/sim/modules/issues/issueSeedGenerators.ts:989,1734,1811,1996,2076,2564,2710`
    plus 1 in expandedSeedGenerators.
  - Once the rest of the arc lands, several new memory keys
    (`expedition_success`, `botched_preparation`, etc.) may have no
    downstream consumer beyond their initial producer.
- **Impact:** Areas need un-pinning regardless of the rare ingredients
  arc (per the original ISSUE-006 scope), and the arc needs two areas
  with gameplay weight (herb garden, cold cellar) to round out the
  storage half of the loop. This issue also handles the integration
  audit at the end of the arc.
- **Scope:** See `docs/plans/rare-ingredients-economy.md` §4.8, §5.7,
  §6.8.
  - Add 4–6 area definitions to `areaRegistry`: herb garden (carries
    `ingredientYield` for one or two uncommon herbs per week, boosted
    by `growing_season` calendar tag), cold cellar (carries
    `spoilageModifier` halving rare/legendary spoilage), plus 2–3
    flavour-tier areas (private booth, stage corner, etc.).
  - Add the `ingredientYield` and `spoilageModifier` fields to
    `AreaDefinition`.
  - Remove the 8 hardcoded `areaRef('main_room')` writes. Replace each
    with picker-driven selection or state-driven rotation per the
    target seed family's intent.
  - Integration audit: confirm every new memory key from this arc
    (`expedition_success`, `expedition_failure`, `runner_lost`,
    `excellent_preparation`, `botched_preparation`,
    `rare_ingredient_spoiled`, `served_rare_dish`,
    `niche_visitor_arrived`) is consumed by at least one downstream
    calculator or seed generator.
  - Confirm `relatedActors` is non-empty for every new cause type.
  - Verify pressure interactions per §9 of the design doc are wired.
- **Depends on:** ISSUE-025, ISSUE-026, ISSUE-027, ISSUE-028,
  ISSUE-029, ISSUE-030, ISSUE-031, ISSUE-032
- **Test approach:** `area:main_room` hit count drops from 52 to
  roster-proportional (~10 per 28 days). Herb garden produces the
  expected weekly trickle. Cold cellar halves spoilage rate on
  rare/legendary items in a controlled test. Every new memory key
  produced by the arc has at least one consumer that reads it. Every
  new cause type has non-empty `relatedActors`. System-level
  acceptance criteria from `rare-ingredients-economy.md` §11 pass
  end-to-end.

---

## Tier 2 — Per-feature problem bundles

Each bundle delivers a working subsystem end-to-end. Most depend on tier 0
infrastructure plus the relevant tier 1 roster grow.

### ISSUE-013 — `policy_backlash` family end-to-end

- **Grade:** broken
- **Status:** done
- **Phase:** 53
- **Evidence:**
  - `src/sim/modules/issues/expandedSeedGenerators.ts:4586-4605` — 6
    response slots collapsed through `responseSlots.map((slot) =>
    makeProfile({...}))`. Every profile has identical shape: one
    `effect('cause', ...)` and one memory entry; `delayedEffects: []`,
    `futureHooks: []`.
  - All 6 profiles' only effect is `effect('cause', ...)`. Per
    ISSUE-001's evidence, the resolver treats `cause`-kind effects as
    `applied: false`, so every choice is a no-op even after the
    resolver is wired.
  - `src/sim/modules/attribution/attributionRules.ts:415-417` — the
    `policyBacklashAttribution` rule filters on
    `direction === 'decrease'`. No module emits a `policy`-tagged cause
    with `decrease` direction (`policyBacklash.ts:39-99` causes default
    to `increase` because backlash raises a pressure metric, not
    lowers a relationship one).
- **Impact:** This is the most extreme thin-family case in the
  codebase: 6 different player choices, all producing identical-shape
  consequence drafts, all of which are no-ops. The slot labels
  (`keep_policy`, `modify_policy`, `repeal_policy`, `make_exception`,
  `explain_policy`, `punish_violation`) suggest meaningful gameplay
  variety; the implementation delivers none. The attribution junction
  failure compounds this: even if profiles were rewritten, the
  attribution rule that should propagate backlash into memories never
  fires.
- **Scope:**
  - Hand-write 6 distinct consequence profiles for the 6 slots. Each
    uses `state_change` and/or `pressure` effects (not `cause`). Each
    carries meaningful `delayedEffects` and `futureHooks`.
  - Remove the `direction === 'decrease'` filter from
    `policyBacklashAttribution` (the surgical fix; the alternative is
    rewiring `policyBacklash` to emit decrease-direction causes on a
    relationship target, which is more invasive).
  - ISSUE-003 covers the per-cause `relatedActors` work in
    `policyBacklash.ts`; don't duplicate.
- **Depends on:** ISSUE-001, ISSUE-002, ISSUE-003
- **Test approach:** Test enables a policy, lets backlash pressure
  rise, fires the seed, picks each of the 6 response slots in
  separate runs. Verify each pick produces a distinct state mutation
  (different reputation deltas, pressure shifts, memory writes,
  scheduled futureHooks). Verify `policyBacklashAttribution` rule
  generates entries in `state.attribution` when backlash causes are
  present.

### ISSUE-014 — `regular_customer` family end-to-end

- **Grade:** broken
- **Status:** done
- **Phase:** 54
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts:868,891` — double-gate
    on `regular_customer_loss < 25` and a second condition requiring
    `memories.length === 0 && irritation < 50 && loyalty > 40`.
  - `src/sim/modules/pressures/calculators/regularCustomerLoss.ts:70,83,99`
    reads memory tags `ignored_complaint`, `favorite_order`,
    `bad_reputation`. These tags are written by code paths inside the
    response resolver, which has not been running (ISSUE-001).
  - Family fires zero times in 90-day playtest runs.
- **Impact:** Even with the regulars cap lifted (ISSUE-011), the
  family remains gated. The pressure can't rise (dead tag reads), and
  even if it could, the irritation/loyalty thresholds combined with
  the "no existing memories" condition mean the family only fires for
  brand-new regulars in trouble — exactly the regulars who haven't
  accumulated the memories the pressure needs.
- **Scope:**
  - Verify ISSUE-001 wired up the resolver paths that produce the 3
    tags above. If any are still unproduced, add the missing write
    site to whichever module logically owns them.
  - Relax the second gate: it should fire on sufficiently
    negative-trending regulars regardless of memory presence. Drop
    the `memories.length === 0` precondition. Soften the
    irritation/loyalty thresholds (suggest `irritation > 30 OR
    loyalty < 60`).
  - Confirm the family rotates across the now-larger regulars roster
    (recencyPenalty is already wired).
- **Depends on:** ISSUE-001, ISSUE-011
- **Test approach:** Set up a state with a regular whose irritation
  has risen via service-failure memories. Verify the family fires
  within a 14-day window. In a longer run, verify the family rotates
  across multiple regulars. Verify each response slot produces a
  measurably different mutation to the target regular's loyalty,
  irritation, or patronage.

### ISSUE-015 — `reputation_shift` family rewrite

- **Grade:** broken
- **Status:** done
- **Phase:** 55
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `reputation_shift`
    family — 4 profiles, 0 `delayedEffects`, 1 `futureHook` total
    across all 4. Worst per-profile depth among shipped families.
  - Family picker deterministically selects the strongest reputation
    axis with no rotation primitive.
- **Impact:** When the family fires, the 4 response choices barely
  differentiate. There's no scheduling of consequences over time, no
  delayed faction reactions, no scheduled second-order effects. The
  family score in card-readiness reports sits at the bottom of all
  shipped families.
- **Scope:**
  - Hand-write 4 profiles with meaningful delayed effects. Examples:
    "lean into the rumor" → reputation-axis drift over 7 days; "publicly
    deny" → opposite-axis bump now plus cost a faction relationship
    in 14 days. Each profile gets at least one `futureHook`.
  - Add rotation: pick from the top-2 reputation axes by absolute
    deviation rather than always selecting the single strongest.
  - Use `state_change` and `pressure` effect kinds.
- **Depends on:** ISSUE-001
- **Test approach:** Verify the family fires across both reputation
  axes that meet the threshold, not just the strongest. Each response
  slot produces a different reputation trajectory over the following
  14 days. At least 2 delayed effects per profile fire on schedule.

### ISSUE-016 — `violence` family rewrite + rotation

- **Grade:** broken
- **Status:** done
- **Phase:** 56
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `violence` family —
    4 profiles, 0 `delayedEffects`, 1 `futureHook` total.
  - Picker selects whichever of `ogres` or `adventurers` has higher
    current patronage. No other groups can trigger.
- **Impact:** Violence is a major escalation surface that currently
  has no temporal weight — the immediate effects fire and the seed
  ends. No "the watch shows up tomorrow" delayed consequence, no
  "staff is shaken for a week" stress buildup, no "regular customers
  start avoiding the tavern" downstream effect.
- **Scope:**
  - Hand-write 4 profiles with delayed consequences. Examples:
    "intervene personally" → injury memory plus faction respect in 3
    days; "call town watch" → faction memory plus customer-group
    distrust in 7 days; "have staff handle" → staff stress plus a
    staff skill memory.
  - Add rotation across the customer groups grown in ISSUE-032.
    Trigger condition becomes "any group with elevated tension," not
    just ogres/adventurers.
- **Depends on:** ISSUE-001, ISSUE-032
- **Test approach:** Set up multiple customer groups with elevated
  tension levels; verify the family rotates across them rather than
  always picking the same one. Each response slot produces distinct
  state mutations including delayed consequences that fire on the
  scheduled day.

### ISSUE-017 — `staff_burnout` family rewrite + rotation

- **Grade:** broken
- **Status:** done
- **Phase:** 57
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts` `staff_burnout`
    family — 4 profiles, 1 `delayedEffect`, 1 `futureHook` total.
  - Picker selects the single highest-stress staff member; no
    rotation across the staff above a stress threshold.
- **Impact:** Same staff member targeted every day they're stressed;
  responses lack meaningful temporal consequences (no "burnout
  resolves over 3 days," no "staff quits in 14 days if ignored," no
  "morale spreads to other staff").
- **Scope:**
  - Hand-write 4 profiles with delayed consequences. Examples: "give
    time off" → stress recovery plus a coverage-gap memory; "raise
    pay" → immediate stress reduction plus scheduled budget pressure;
    "do nothing" → quit-risk hook in 7-14 days; "reassign duties" →
    cross-staff stress redistribution.
  - Add rotation: pick from staff members above the stress threshold
    via `recencyPenalty`, not always the single highest.
- **Depends on:** ISSUE-001, ISSUE-031
- **Test approach:** Set up state with multiple staff above stress
  threshold; verify rotation across them in a 14-day window. Each
  response produces distinct stress, loyalty, and budget effects
  including scheduled futureHooks.

### ISSUE-018 — `inspection` family un-pinning

- **Grade:** thin
- **Status:** done
- **Phase:** 58
- **Evidence:**
  - `src/sim/modules/issues/issueSeedGenerators.ts:2043-2056` — the
    `inspection` family hardcodes `town_watch` as primary actor and
    pins `scrap_collectors` plus `local_shrine` as cross-faction
    support refs on every inspection seed. A comment at those lines
    acknowledges the workaround.
  - 28-day hit counts: `faction:town_watch = 66` (most-overused
    entity in the simulation); `faction:scrap_collectors = 34`;
    `faction:local_shrine = 31`.
- **Impact:** Even with the faction roster grown (ISSUE-012),
  inspection seeds will continue saturating these three factions
  because the pin bypasses the picker entirely.
- **Scope:** Remove the three hardcoded faction pins. Replace with
  picker-driven faction rotation using `recencyPenalty`, allowing
  any faction whose tags include `authority`, `regulation`, or
  `enforcement` to act as primary. Cross-faction support refs are
  picked from the remaining faction set, not hardcoded.
- **Depends on:** ISSUE-012
- **Test approach:** Run a 28-day simulation; verify
  `faction:town_watch` hit count drops from 66 to a
  roster-proportional number (~10-15). Other factions appear as
  inspection primary actors in rotation.

### ISSUE-019 — `monthly_review` design decision + implementation

- **Grade:** design
- **Status:** done
- **Phase:** 59
- **Evidence:**
  - `src/sim/modules/monthly/monthlyModule.ts:556` — gate
    `endDay === calendar.day` means the family only fires on
    month-boundary days.
  - `src/sim/modules/issues/issueSeedValidation.ts:404,415,428,441` —
    4 special-case bypasses for `seed.type === 'monthly_review'` to
    skip the 2-response / consequence / memory / stake requirements.
  - Family has empty `responseSlots`, empty `consequenceProfiles`, no
    memories, no hooks. It's currently a structured report, not a
    card.
- **Impact:** Every month-end is a meaningful decision point
  (landlord, rent, reserves, rival, reputation, staff retention) but
  the simulation currently emits a report and moves on. No player
  agency at month boundaries.
- **Scope:**
  - **Decision required first.** Two paths:
    - **(a) Keep as report.** Drop the family from card-readiness
      scoring. Leave the 4 validator bypasses in place. Lower-effort.
    - **(b) Promote to a card family.** Add 3-4 strategic decision
      slots, give each profiles with meaningful state mutations.
      Remove the 4 validator bypasses.
  - Recommended path: (b). Example slots: "Pay landlord on time vs.
    invest in the cellar"; "Hold the season's reserves vs. expand
    staff"; "Settle with the rival tavern vs. press the feud." Each
    slot's profile uses `state_change` and `pressure` effects and at
    least one delayed effect.
- **Depends on:** ISSUE-001 (only if path (b) chosen)
- **Test approach:** Run a simulation across a month boundary. If
  promoted, verify the family fires once per month and that response
  slots produce distinct multi-week consequences. If kept as report,
  verify the report still reaches its sink and the validator bypasses
  cover it cleanly.

---

## Tier 3 — Polish and wire-the-consumer

Independent items with minimal dependencies. Slot in opportunistically
between bigger phases.

### ISSUE-020 — `activeIssueSeedTags` consumer wiring

- **Grade:** thin
- **Status:** done
- **Phase:** 60
- **Evidence:**
  - `src/sim/modules/localArcs/localArcsModule.ts:143` — writes
    `slice.activeIssueSeedTags` (a sorted Set) on every tick from
    arc-emitted `issue_seed_tag` effects.
  - `grep -rn "activeIssueSeedTags" src/sim/modules/issues/` returns
    zero matches. No seed generator filters on, branches on, or reads
    these tags.
- **Impact:** Active arcs declare which tag-families they want
  amplified (e.g. a `mushroom_blight` arc emits
  `supplier_suspicious_goods`, `stock_shortage`, `food_quality`).
  None of those amplifications flow through to seed ranking. The
  signal is computed and dropped.
- **Scope:** Add a ranking bonus in
  `src/sim/modules/issues/issueSeedRanking.ts:computeCardWorthiness`
  when `seed.domain` or `seed.causes[*].tags` intersect
  `state.modules.localArcs.activeIssueSeedTags`. The producer side is
  already correct; this is purely consumer wiring.
- **Depends on:** none
- **Test approach:** Start a state with a `mushroom_blight` arc
  active; verify seeds carrying matching tags receive a worthiness
  bonus and are picked more often during the arc's active window
  than during an inactive control window.

### ISSUE-021 — Calendar tag consumers (priority: `rent_due_soon`)

- **Grade:** thin
- **Status:** done
- **Phase:** 61
- **Evidence:**
  - `src/sim/modules/calendar/types.ts:22-37` — 14 `CalendarTag`
    values defined.
  - 4 tags consumed: `festival_window`, `mushroom_festival` (by
    `festivalReadiness.ts`); `payday`, `brawl_night` (by
    `stockShortage.ts`); `miner_payday` (by `arcEngine.ts`).
  - 10 tags emit-only: `inspection_window`, `rent_due_soon`,
    `winter_shortage_risk`, `road_danger_risk`, `merchant_traffic`,
    `local_crowd`, 4 season tags, 4 day-type tags.
- **Impact:** Calendar tags were designed as a shared signaling layer
  for seasonality and time-of-week effects. In practice only festival
  and payday signals flow through. The simulation feels less seasonal
  than the calendar data suggests it should.
- **Scope:**
  - Wire `rent_due_soon` first: it should boost landlord pressure in
    `src/sim/modules/pressures/calculators/` and increase the
    `debt_rent` seed's daily fire weight when present.
  - Optionally wire 2-3 more high-value tags:
    `winter_shortage_risk` boosts `stock_shortage`,
    `road_danger_risk` impacts supplier reliability,
    `merchant_traffic` boosts merchants customer group activity.
- **Depends on:** none
- **Test approach:** Set state to a day where `rent_due_soon` fires.
  Verify landlord pressure rises measurably and that the `debt_rent`
  seed family is more likely to fire that day than on a non-tagged
  control day.

### ISSUE-022 — History log pruning policy

- **Grade:** thin
- **Status:** done
- **Phase:** 62
- **Evidence:**
  - `src/sim/modules/history/historyModule.ts` — validator only, no
    `endDay`, `endWeek`, or `endMonth` hook prunes entries.
  - 31 `ctx.addHistory` producers across modules. Rough estimate
    5-20 entries per simulated day. Over 365 days, 2k-7k entries.
    Each entry carries `summary`, `tags`, `relatedActors`,
    `relatedLocations`, `relatedSystems`, `mechanicalRefs`.
- **Impact:** Invisible today because no long-running save exists,
  but a real liability for any post-card persistence: state grows
  unboundedly with simulation length, and there's no way to bound
  memory or save-file size.
- **Scope:** Add an `endMonth` pruning hook that keeps the last N
  entries (suggest 500, or "last 90 days, whichever is more").
  Pruned entries are discarded silently; no separate archive needed
  at this stage.
- **Depends on:** none
- **Test approach:** Run a 365-day simulation; verify `state.history`
  stays bounded at the configured cap, the most recent entries are
  always preserved, and no module depends on entries older than the
  cap.

### ISSUE-023 — RNG stream prune or wire

- **Grade:** thin
- **Status:** done
- **Phase:** 63
- **Evidence:**
  - `src/sim/core/rng.ts:123-135` — 12 streams declared. 5 have
    callers in `src/sim/`: `incidents`, `regular_identity`,
    `seasonal_events`, `attribution_perceiver`, and one path through
    `staff_identity`.
  - 7 dead declarations with zero callers: `service`, `economy`,
    `names`, `npc_identity`, `supplier_identity`, `faction_behaviour`,
    `issue_seed_selection`.
- **Impact:** Dead streams are harmless (lazy, no runtime cost) but
  misleading: they suggest the engine has more variation injection
  than it does. The systems they're named for either use a different
  stream or have no variation injection at all.
- **Scope:**
  - `npc_identity` should be wired through the NPC factory from
    ISSUE-004; verify and connect.
  - For the other 6 dead streams: decide per stream whether to wire
    (recommended for `service`, `economy`, `faction_behaviour`,
    `issue_seed_selection` since they're named for systems that
    should pull from them) or prune the declarations.
- **Depends on:** ISSUE-004
- **Test approach:** Verify every remaining stream declaration in
  `rng.ts` has at least one caller in `src/sim/`. Verify wired streams
  produce reproducible-but-decorrelated output: same seed + same input
  produces the same stream output regardless of unrelated RNG
  activity in other streams.

### ISSUE-024 — Thin family profile depth + core picker rotation

- **Grade:** thin
- **Status:** done
- **Phase:** 64
- **Evidence:**
  - Six families ship below the per-profile depth targets for
    delayed effects and `futureHooks` but aren't fully broken:
    `food_safety`, `stock_shortage`, `maintenance` (low delayed
    coverage); `culture_conflict`, `area_atmosphere`, `rival_tavern`
    (low `futureHook` coverage).
  - Per-profile depth targets: average ≥0.66 non-empty
    `delayedEffects` per profile, ≥0.31 non-empty `futureHooks` per
    profile. A 4-profile family needs ≥3 delayed and ≥2 fh in
    aggregate to clear.
  - Three core-family generators have no rotation primitive at all:
    `food_safety` (picks worst kitchen risk), `stock_shortage`
    (always ale), `maintenance` (picks worst area).
- **Impact:** These families fire correctly but their response slots
  feel mechanically thin compared to fully-developed families
  (`staff_identity`, `supplier_relationship`, `seasonal_arc`).
  Rotation absence in the 3 core families means the same risk vector
  / stock item / area is picked daily.
- **Scope:**
  - Add 1-2 `delayedEffects` or `futureHooks` per thin profile across
    the 6 families to clear the per-profile depth targets above.
  - Add `recencyPenalty` plus `recordPick` rotation to `food_safety`
    (rotate across kitchen risk vectors), `stock_shortage` (rotate
    across stock items, not always ale), `maintenance` (rotate across
    worst-N areas, not just the single worst). Pattern matches the
    `expandedSeedGenerators.ts:78-110` rotation primitive.
- **Depends on:** ISSUE-001
- **Test approach:** Re-run the readiness output and verify these
  families meet the per-profile depth targets. Verify the three core
  families rotate across their respective entities in a 14-day
  window.

---

## Tier 3 — Post-Repair Audit Findings

The Tier 3 issues are all surfaced by a post-Phase-73 codebase audit
(2026-05-16). They share a shape: the test suite passes 987 of 1045
collected tests, and the typecheck is clean, but the things tests
don't catch — silent data flow, dead state fields, dangling diff
boundaries, content-roster mismatch with culture content already
registered — are still here. The issues are independent and can be
worked in any order; none are dependencies for the Tier 1.5 arc
since that work is `done`.

### ISSUE-034 — Test worker crash silently hides ~58 untested tests

- **Grade:** broken
- **Status:** done
- **Phase:** 74
- **Evidence:**
  - `npm test` reports `Test Files 64 passed (65)`,
    `Tests 987 passed (1045)`, and `Errors 1 error`. One test file's
    worker exits unexpectedly during the run; vitest collects the
    file's tests into the 1045 count but only 987 actually
    execute.
  - The summary block ends with `Vitest caught 1 unhandled error
    during the test run. This might cause false positive tests.
    Resolve unhandled errors to make sure your tests are not
    affected. … Error: Worker exited unexpectedly … tinypool …
    ChildProcess._handle.onexit`.
  - Exit code is `0` despite 58 tests being silently absent and the
    unhandled error.
  - The merge commit `c7647b7` ("fix: tier 2 review findings + phase
    20 pool isolation") landed a partial fix in this area; the
    crash is not fully resolved.
- **Impact:** CI signal is unreliable. A test file can fall out of
  the run with no failure marker; "tests pass" no longer implies
  "tests ran." Any of the 58 hidden tests could be silently regressing
  while local runs report green.
- **Scope:**
  - Identify which test file's worker is crashing (memory pressure,
    pool isolation, or an unhandled rejection in a long-running
    test).
  - Either fix the underlying crash, or configure vitest so a worker
    crash fails the suite (non-zero exit, explicit failed file count
    in the summary, no silent drop).
  - Reduce per-test memory cost where the crash is OOM-driven
    (`phase40.expandedReadiness.test.ts` runs for ~353s alone;
    pool isolation may not be enough on memory-constrained CI).
- **Depends on:** none
- **Test approach:** After the fix, `npm test` must report
  `Tests N passed (N)` with no `(M)` collected/run gap, and any
  worker exit must mark the run as failed. Verify by intentionally
  triggering a worker crash in a throwaway test and confirming
  the suite fails.

### ISSUE-035 — `createStateDiff` skips `recipes`, `expeditions`, `hireableAdventurers`

- **Grade:** thin
- **Status:** done
- **Phase:** 75
- **Evidence:**
  - `src/sim/core/diff.ts:520-552` `createStateDiff` walks coin,
    areas, stock, staff, customers, reputation, pressures,
    memoriesCount, cultures, factions, suppliers, regulars,
    localEvents, socialRumours, tavernIdentity, modules.
  - `TavernState` (`src/sim/state/TavernState.ts:685-710`) carries
    three further slices the walker never visits: `recipes`,
    `expeditions`, and `world.hireableAdventurers`. The walker
    explicitly skips `notableNpcs` at line 542 with a comment;
    the other three slices are silently absent.
  - Each of these slices is actively mutated: `ctx.modifyRecipe`
    (recipes), expeditionsModule resolution (expeditions.active /
    completed), and `ctx.modifyHireableAdventurer` (adventurer
    stats, currentExpeditionId).
  - The day-level diff is consumed by `causeReport.ts:173` in the
    "unexplained significant changes" section. Changes to these
    three slices never appear there even when no cause was emitted.
- **Impact:** ISSUE-002 (Phase 42) extended diff coverage so a
  cause-coverage audit could catch uncaused world mutations.
  Recipes, expeditions, and adventurer rosters bypass that audit.
  A regression that mutates `state.recipes['x'].onMenu` or an
  adventurer's `experience` without a cause emission will not show
  up in "unexplained changes."
- **Scope:**
  - Add `diffRecipes`, `diffExpeditions`, `diffHireableAdventurers`
    in `src/sim/core/diff.ts` following the existing per-id /
    per-field pattern used by `diffSuppliers` and `diffRegulars`.
  - Decide which fields are "meter-like" (e.g. adventurer
    experience/reliability/relationship) and route them through
    `isMeterPath` so significance thresholds apply.
  - Wire them into `createStateDiff` after the existing world-slice
    walks.
- **Depends on:** none
- **Test approach:** Mutate a recipe `onMenu`, an
  adventurer.relationship, and add an expedition record in a test;
  verify (a) the changes appear in `getDiff('day').changes[]`,
  (b) numeric meter changes are filtered by significance the same
  way supplier/regular meter changes are, (c) the cause-coverage
  report flags any of these mutations that lack a matching cause.

### ISSUE-036 — Tagged diff boundaries computed but never consumed

- **Grade:** thin
- **Status:** done
- **Phase:** 76
- **Evidence:**
  - `src/sim/core/engine.ts:1463-1488` snapshots and finalizes four
    tagged diffs per day: `owner_actions`, `service`, `end_week`,
    `end_month`. Each gets a snapshot/finalize pair around the
    matching phase block.
  - The comment at `engine.ts:1478-1480` claims "Service finished.
    Close the service-phase diff so reports can read it from
    `ctx.getDiff('service')` during `generateReports`." No production
    code reads `getDiff('service')`. The only consumers of
    non-`'day'` boundaries are `tests/sim/phase17.causes.test.ts:428`
    and `:446` (`getByBoundary('owner_actions')`,
    `getByBoundary('end_week')`).
  - The diff finalize for `'service'` runs after the `closing` phase
    but five phase slots earlier than the `generateReports` phase
    (`applyResponses`, `endDay`, `endWeek`, `endMonth` sit between
    them). Any report that did try to read the service diff would
    miss every mutation those four phases produce.
- **Impact:** Four tagged diff boundaries exist purely to keep the
  phase-17 tests passing. They cost a full state snapshot+walk each
  per day and produce no signal anywhere else. The misleading
  comment at engine.ts:1478 invites future code to read a diff
  that was sealed before the relevant mutations happened.
- **Scope:**
  - Either remove the unused tagged boundaries (snapshot only the
    `'day'` boundary the cause report reads, plus whatever the
    `phase17.causes.test.ts` assertions actually need), and update
    the test to read `'day'` if appropriate.
  - Or, if the boundaries are kept for future use, fix the engine
    comment to describe what the boundary actually captures
    (pre-`applyResponses` state for `'service'`) and add at least
    one production consumer so they're not dead weight.
  - Document the chosen direction in this issue's resolution.
- **Depends on:** none
- **Test approach:** If boundaries are pruned, the existing
  phase-17 tests must still pass against `'day'` (or whatever
  replacement is chosen). If boundaries are kept, add a report
  consumer that reads at least one non-`'day'` boundary and assert
  on its output.

### ISSUE-037 — `HireableAdventurer.wageBase` / `specialty` / `activeFlags` are dead fields

- **Grade:** broken
- **Status:** done
- **Phase:** 77
- **Evidence:**
  - `src/sim/state/TavernState.ts:596` declares
    `wageBase: number // coin per expedition day`. The field is
    written at `src/sim/modules/adventurers/adventurersModule.ts:136`
    (`wageBase: 3 + rng.int(0, 3)`) and at
    `src/sim/state/defaults.ts` during starter seeding. Grep across
    `src/` finds zero readers.
  - `src/sim/modules/expeditions/commissionExpedition.ts:57-60`
    `readCost(input)` pulls expedition cost from
    `input.amount ?? 0`. The runner's `wageBase` is never consulted.
    A master adventurer can be commissioned for 0 coin; a fresh
    rookie can be commissioned for 1000. Cost is whatever the
    player passes.
  - `src/sim/state/TavernState.ts:595` declares `specialty: string |
    null` with comment "optional tag biasing target tier/category."
    Set on starter adventurers in `defaults.ts:506-558` (e.g. alpha
    has `specialty: 'rare'`). The outcome roll in
    `src/sim/modules/expeditions/expeditionsModule.ts:90-119`
    consults experience, reliability, mode, and tier — never
    specialty. The starter adventurers' specialties are inert.
  - `src/sim/state/TavernState.ts:601` declares
    `activeFlags: string[]`. Written at creation, never read in
    `src/sim/modules/expeditions/` or `src/sim/modules/adventurers/`.
- **Impact:** Hiring decisions and expedition cost decisions are
  not real economic choices. The schema and docstrings promise
  meaningful structure (per-day wages, specialty biasing); the
  runtime ignores all three fields. ISSUE-029 / ISSUE-030 closed
  with these gaps undetected because the test suite verifies the
  fields exist but not that they affect outcomes.
- **Scope:**
  - Decide whether expedition cost should be `wageBase * daysTotal`
    (or similar) instead of `input.amount`. Either route the cost
    through `wageBase` and reject commissions that underpay, or
    delete the field outright with a state-migration helper.
  - Decide whether `specialty` modulates tier success rate (e.g.
    `+0.1` to success when `specialty === targetTier`). Either wire
    it through the outcome roll or delete it.
  - Same call for `activeFlags`: wire it (injured/exhausted/idle
    markers used by the roster drift hook) or delete it.
- **Depends on:** none
- **Test approach:** A test commissions an expedition for a 4-day
  run with an adventurer whose `wageBase` is 5; verify the cost
  charged is `wageBase * daysTotal` (or the wired formula), not
  `input.amount`. A test commissions a tier-rare expedition with
  a `specialty: 'rare'` runner and a non-specialist; verify the
  specialist's success rate exceeds the non-specialist's over N
  trials with the same seeded RNG. If a field is being deleted,
  the test verifies it is removed from defaults and schemas.

### ISSUE-038 — Cook tier/skill does not modulate service quality

- **Grade:** thin
- **Status:** done
- **Phase:** 78
- **Evidence:**
  - `src/sim/modules/staff/priorityEffects.ts:32-160` builds the
    daily `staffQualityModifiers` (notably `foodQualityModifier` and
    `serviceSpeed`) from `currentPriority`, `workStyle`, and
    `stressResponse`. The staff member's `role` and `skill` fields
    are not read in this file.
  - The four cook roles registered in
    `src/sim/content/staff/staffIdentityProfiles.ts`
    (`cook_goblin_common`, `kitchen_hand_goblin_common`,
    `seasoned_cook_human_town`, `master_chef_dwarf_caravan`) and the
    differentiated skill ranges seeded in `defaults.ts` exist to
    represent a hierarchy. The hierarchy only affects the prep gate
    in `src/sim/modules/service/recipes.ts:49-62` (per-recipe
    botched / ordinary / excellent outcome).
  - `recipes.ts:55` reads `active.skill` for prep gating;
    `priorityEffects.ts` never does. A master_chef on `quality`
    priority and a kitchen_hand on `quality` priority therefore
    produce the same `foodQualityModifier`.
- **Impact:** The cook tier system is half-wired. ISSUE-031 (Phase
  71) added the roles and the prep gate, but the daily service
  loop is role-agnostic. The player has no reason to keep a
  master_chef around when the same priorities on a kitchen_hand
  produce the same daily satisfaction signal — only rare/legendary
  recipes (where the prep gate bites) differentiate the two.
- **Scope:**
  - Extend `derivePriorityModifiers()` (or a sibling) to layer a
    small role/skill modifier onto `foodQualityModifier` and
    `serviceSpeed`. The Phase 71 plan and the rare-ingredients
    design doc have the magnitudes; pick within those bounds.
  - Ensure the modifier is monotonic in skill so a higher-tier
    cook never produces a worse quality signal on the same
    priority, all else equal.
  - Consider routing the modifier through the existing
    `scaleByEffectiveness` pipeline so morale/stress/fatigue still
    suppress it.
- **Depends on:** none
- **Test approach:** With identical priority, workStyle, and
  stressResponse, a master_chef (skill 85) on the same day input
  must produce a higher `foodQualityModifier` than a kitchen_hand
  (skill 30). Customer satisfaction delta in `resolveService`
  should reflect the difference (positive for the master, neutral
  or negative for the kitchen_hand).

### ISSUE-039 — `culinary_renown` fame loop only reaches two consumers

- **Grade:** thin
- **Status:** done
- **Phase:** 79
- **Evidence:**
  - Producers of `state.reputation.culinary_renown`:
    `src/sim/modules/service/recipes.ts:66-76` (serve uncommon+
    nudges +1..+3), `recipes.ts:248-259` (excellent rare/legendary
    prep +2/+4), `recipes.ts:276-287` (botched rare/legendary
    -3/-5), `src/sim/modules/stock/spoilage.ts:99-164` (rare/legendary
    spoilage -2/-3), `src/sim/modules/service/recipesDaily.ts:71-95`
    (idle-30-day decay -1).
  - Consumers of `culinary_renown`:
    `src/sim/modules/customers/customerModule.ts:118` (niche
    customer activation/deactivation against
    `minRenownThreshold`),
    `src/sim/modules/adventurers/adventurersModule.ts:111`
    (soft-cap lift on the hireable adventurer roster). That is the
    full consumer set.
  - `reputationRegistry.ts:12-15` registers `culinary_renown` as a
    canonical axis alongside `tasty`, `respectable`, etc., but it is
    not consulted by customer satisfaction, pricing, attraction
    bonuses, pressure modifiers, or owner-action gating.
- **Impact:** The rare-ingredients arc's headline reputation axis
  has a narrow consumption surface. A player who builds renown to
  70+ unlocks two effects (niche group visits, larger adventurer
  pool) and gets nothing on the day-to-day satisfaction or pricing
  loop. The fame mechanic doesn't reinforce itself.
- **Scope:**
  - Add at least one routine-day consumer:
    e.g. a small `culinary_renown` → patronage attraction nudge for
    customer groups with `preferredStockTags.includes('rare')`, or a
    pressure reduction on `inspector_attention` / `rival_tavern`
    when renown is high, or a price-tolerance bump on the
    `priceSensitivity` calc.
  - Document the cap on the loop so this doesn't become a runaway
    mechanic. Producers already include the idle-decay safety
    valve; consumers should not amplify that loop.
- **Depends on:** none
- **Test approach:** Run a 30-day scenario where renown rises from
  10 to 60. Verify at least one observable downstream effect beyond
  the niche activation and adventurer cap (e.g. a customer group's
  patronage rises by a small amount per renown decile; an inspector
  pressure decays faster at high renown). Verify the inverse at
  low renown.

### ISSUE-040 — Reference validation gaps for staff identity + adventurer reverse edges

- **Grade:** broken
- **Status:** done
- **Phase:** 80
- **Evidence:**
  - `src/sim/state/TavernState.ts:151` declares the optional
    `StaffIdentityState.cultureId: string`. `src/sim/state/
    referenceValidation.ts` validates customer-group cultureId
    (line 265), faction cultureId (line 311), supplier cultureId
    (line 349), local-event cultureId (line 548), adventurer
    cultureId (line 514), but does not iterate `state.staff` to
    check `staff.identity?.cultureId`. A staff member can carry a
    dangling culture pointer indefinitely.
  - `referenceValidation.ts:480-490` validates the forward edge
    from active expeditions to adventurers (an active expedition
    must point at an existing runner). It does not validate the
    reverse edge: a hireable adventurer with `currentExpeditionId`
    set must point at an active expedition. A double-resolution
    bug, an unhandled exception during `applyResolution`, or a
    save-game with mismatched data could leave an adventurer
    stuck claiming to be on a non-existent expedition.
- **Impact:** Two dangling-reference shapes that produce silent
  null lookups at runtime rather than validation failures. Both
  are easy to introduce during refactors and would not be caught by
  the existing test suite (the tests construct internally consistent
  states).
- **Scope:**
  - Add a staff loop to `validateWorldReferences` (or a sibling
    in the staff-validation block) that checks each
    `staff.identity?.cultureId`, when present, exists in
    `state.world.cultures`.
  - Add an adventurer-reverse-edge loop that asserts
    `adventurer.currentExpeditionId === null ||
    state.expeditions.active.some(e => e.id === adventurer.currentExpeditionId)`.
- **Depends on:** none
- **Test approach:** Construct a state where a staff member's
  `identity.cultureId` is set to a non-existent culture; verify
  `validateState` returns an error referencing the staff id and
  the dangling cultureId. Construct a state where an adventurer's
  `currentExpeditionId` is `'exp_999'` but `state.expeditions.active`
  is empty; verify the reverse-edge validator returns an error.

### ISSUE-041 — Staff identity profile pool covers 3 of 8 cultures

- **Grade:** thin
- **Status:** done
- **Phase:** 81
- **Evidence:**
  - `src/sim/content/staff/staffIdentityProfiles.ts` registers 6
    profiles total: `cook_goblin_common`,
    `kitchen_hand_goblin_common`, `server_town_human`,
    `seasoned_cook_human_town`,
    `cleaner_bouncer_dwarf_caravan`, `master_chef_dwarf_caravan`.
    Naming profiles cited: `goblin_common`, `human_town`,
    `dwarf_caravan`.
  - `src/sim/content/cultures/cultureRegistry.ts` plus the
    expansion-arc registration calls produce 8 cultures, including
    `miner_workcrew`, `merchant_roadfolk`, `ogre_clans`,
    `adventuring_bands`, `shrine_devotees`. Naming pools exist for
    each (`src/sim/content/naming/` carries `miner_workcrew`,
    `merchant_roadfolk`, `ogre_clans`, `adventuring_bands` profiles
    from Phase 31 fixes).
  - Customer groups already use the wider set:
    `src/sim/registries/customerRegistry.ts:90` uses
    `miner_workcrew`, `:130` uses `merchant_roadfolk`, `:170` uses
    `ogre_clans`, `:210` uses `adventuring_bands`. Staff identity
    creation goes through `createStaffIdentity`, which can only
    pick from the 6 registered profiles — so staff are confined to
    goblin/human/dwarf names regardless of which culture's
    workforce they came from.
- **Impact:** ISSUE-010 (Phase 50) closed with cultures + naming
  profiles aligned across customer groups and suppliers, but staff
  hires still feel like goblin-tavern-only. A miner-aligned cook,
  a merchant-aligned server, or an ogre-aligned bouncer cannot be
  expressed in identity, even though the cultures and naming pools
  exist. This caps perceptual roster diversity for a system
  (staff) the player interacts with most.
- **Scope:**
  - Add per-culture variants for each cook tier, plus at least
    one alternate server and bouncer profile sourced from the
    wider naming pool set (miner_workcrew, merchant_roadfolk,
    ogre_clans, adventuring_bands, shrine_devotees as relevant).
  - Update the staff identity factory's role-to-profile mapping
    so it weighs cultural plausibility (e.g. shrine_devotees
    rarely shows up as a bouncer).
- **Depends on:** none
- **Test approach:** Generate N staff members across 50 hires
  (deterministically seeded); verify the resulting culture
  distribution covers at least 5 of the 8 registered cultures
  with at least one profile per role.

### ISSUE-042 — Niche factions carry no notable NPCs

- **Grade:** thin
- **Status:** done
- **Phase:** 82
- **Evidence:**
  - `src/sim/content/factions/factionRegistry.ts` registers 9
    factions including the three niche additions from ISSUE-012
    (Phase 52): `smugglers_ring:105`, `silvermark_house:119`,
    `rival_taverns:134`.
  - `src/sim/content/npc/notableNpcProfiles.ts` registers 8 NPC
    profiles linked to factions: `watch_inspector` /
    `watch_captain` → `town_watch`, `moneylender` →
    `brewers_guild` (line 87 — note this association reads odd
    and may be a separate bug),
    `town_gossip` → `scrap_collectors`, `fence` → `local_shrine`
    (also questionable),
    `merchant_prince` → `market_caravan_circle`, `miner_foreman` →
    `miners_union`, `shrine_priest` → `local_shrine`.
  - Greps for the three niche faction ids inside
    `src/sim/content/npc/` return zero hits. The niche factions
    exist mechanically (pressures, reputation loops, issue seed
    fallbacks) but have no human face in the social graph.
- **Impact:** Pressure chains that involve smugglers, rivals, or
  silvermark cannot route attribution through an NPC actor; they
  fall back to faction-level refs. Card families that pull an
  actor name for color (per Phase 21's identity rule) have no
  candidate for these three factions. The faction-NPC association
  for the existing 6 also includes two oddly-coupled pairs
  (moneylender ↔ brewers_guild, fence ↔ local_shrine) that may
  deserve a second pass while this bundle is open.
- **Scope:**
  - Add at least one notable NPC profile per niche faction
    (smuggler contact, rival tavern proprietor, silvermark
    factor / agent).
  - Verify the existing factionId associations: a moneylender
    aligned with the brewers' guild and a fence aligned with the
    shrine read as either deliberate or a copy-paste slip; tighten
    or rationalize in a comment.
- **Depends on:** none
- **Test approach:** Verify every registered faction has at least
  one NPC profile with a matching `factionId`. A pressure / cause
  test that targets one of the niche factions resolves an NPC
  actor ref instead of falling back to a faction-level ref.

### ISSUE-043 — Social rumours never pruned (unbounded growth)

- **Grade:** thin
- **Status:** done
- **Phase:** 83
- **Evidence:**
  - `src/sim/modules/weekly/community.ts:580` writes new rumours
    to `ctx.state.world.socialRumours[rumour.id]`. The `:533-562`
    `persistRumour` helper refreshes `strength` and `lastSpreadDay`
    when an existing rumour matches, never deletes.
  - Grep across `src/sim/` for `delete ... socialRumours`,
    `pruneRumour`, `expireRumour`, `socialRumours[... = undefined`
    returns no hits. History pruning (Phase 62 / ISSUE-022) added
    a 90-day / 500-entry policy for `state.history` but did not
    extend to social rumours.
  - `src/sim/modules/pressures/calculators/rumourPressure.ts:30`
    and `:48` iterate the full rumour map every day. A long run
    that emits rumours at any non-zero rate carries that whole
    set forever.
- **Impact:** Long-run RAM and time grow linearly with simulation
  age. Rumour pressure aggregation walks more rumours every day.
  Save sizes balloon over a multi-year save. This was flagged
  briefly during the Phase 20 long-run audit (commit `359f268`
  notes) but never closed.
- **Scope:**
  - Add a pruning hook (likely `endMonth`, mirroring the history
    pruning policy) that drops rumours whose `lastSpreadDay` is
    older than a configurable window (suggest 90 days) AND whose
    `strength` has decayed below a threshold (suggest 10).
  - Optionally cap total active rumours at N (e.g. 60) and drop
    the lowest-strength survivors first.
  - Verify the contradiction-guard, attribution, and pressure
    consumers that iterate the rumour map handle the pruning
    correctly (no dangling involvedRefs from issue seeds).
- **Depends on:** none
- **Test approach:** Run a 365-day simulation that emits rumours
  weekly; assert that `Object.keys(state.world.socialRumours)
  .length` stabilizes below the cap (or grows sub-linearly with
  the pruning window) instead of climbing monotonically. Verify
  no issue-seed contradiction guard fails after pruning.

### ISSUE-044 — Supplier reliability + relationship do not affect pricing

- **Grade:** thin
- **Status:** done
- **Phase:** 84
- **Evidence:**
  - `src/sim/modules/suppliers/pricing.ts:45-61`
    `getEffectiveBasePrice` reads `stock.basePrice`,
    `supplier.priceBias`, and active market-condition multipliers.
    It does not read `supplier.reliability` or
    `supplier.relationship`.
  - `src/sim/modules/suppliers/supplierModule.ts:79-96` applies a
    one-way relationship drift when reliability < 30; relationship
    has no other operational consumer.
  - The supplier report (`supplierReport.ts:32-69`) surfaces both
    meters to the player, implying they matter. They do not feed
    any pricing, delivery, or stock-availability decision in the
    current pipeline. ISSUE-009 (Phase 29) closed with this gap
    in place; ISSUE-028 (Phase 68) added specialty suppliers
    without changing the pricing model.
- **Impact:** Two of a supplier's three top-line meters are
  decorative. The player's choice to invest in supplier
  relationship (via repeated orders, on-time payment, etc.) has
  no economic payoff. Switching suppliers is purely a
  `priceBias` + `goodsProvided` decision.
- **Scope:**
  - Extend `getEffectiveBasePrice` (or wrap it in a sibling
    helper used by restock and weekly invoice paths) so
    `relationship` provides a small discount and `reliability`
    affects the probability of delivery-on-time at the supplier
    level. Magnitudes per the Phase 29 plan or this issue's
    resolution if the plan is silent.
  - Update the supplier report to surface the effective discount
    so the player can see the meter pay off.
- **Depends on:** none
- **Test approach:** Two suppliers with identical `priceBias` and
  different `relationship` (30 vs 80) charge different effective
  base prices on the same stock. Two suppliers with different
  `reliability` (40 vs 90) have observably different missed-delivery
  rates over N weeks.

### ISSUE-045 — `content/text/descriptors.ts` pool still empty Phase 22 stub

- **Grade:** thin
- **Status:** done
- **Phase:** 85
- **Evidence:**
  - `src/sim/content/text/descriptors.ts` consists of a comment
    block stating "Phase 22 leaves the file as an empty
    placeholder. … Phase 39 consumes these pools when building
    text-ingredient generators" followed by `export {}`.
  - Phase 39 / ISSUE-039 (expanded issue-seed generators) shipped
    without ever filling this file. Greps for imports from
    `content/text/descriptors` return no consumers in
    `src/sim/modules/issues/`. The text-ingredient pool the
    expanded generators were meant to draw from doesn't exist.
  - `src/sim/content/text/textIngredientTypes.ts` defines the
    type shape; the index re-exports the type; the descriptors
    module is the data side that never landed.
- **Impact:** Issue-seed prose-adjacent labels are hardcoded
  inline in each generator instead of drawn from a shared
  descriptor pool. Per the Phase 21 contract — "no card prose,
  produce text ingredients only" — the right shape is the pool;
  the wrong shape is per-generator string literals. The current
  code is the wrong shape.
- **Scope:**
  - Populate `descriptors.ts` with the mechanical-label /
    tag-fragment pools the existing seed families would draw from
    (severity adjectives, area-state adjectives, faction-relation
    nouns). Stay on mechanical labels; no card prose.
  - Refactor at least one expanded seed family (e.g.
    `violence`, `inspection`) to read from the pool rather than
    inline literals, proving the consumption seam.
  - Document the shape so the eventual card layer can read from
    the same pools.
- **Depends on:** none
- **Test approach:** Importing `descriptors.ts` in a test returns
  non-empty pool data. At least one seed family's generator
  consumes from the pool (verifiable by mocking the pool and
  observing the generator's output change). The contract test
  that Phase 22 reserved (the placeholder check in
  `phase22.expansionStructure.test.ts`) is updated to assert the
  pool is now populated.

### ISSUE-046 — Staff-management owner actions (hire / fire / kick) missing

- **Grade:** broken
- **Status:** done
- **Phase:** 86
- **Evidence:**
  - `src/sim/modules/ownerActions/actionDefinitions.ts:851-863`
    `REQUIRED_OWNER_ACTIONS` registers 11 actions: `clean_area`,
    `repair_area`, `restock_item`, `adjust_prices`,
    `pay_staff_bonus`, `water_down_ale`, `improve_stew`,
    `patch_roof`, `fumigate_cellar`, `buy_mugs`,
    `commission_expedition`.
  - Greps across `src/sim/modules/ownerActions/` for `hire`,
    `fire`, `kick`, `kick_patron`, `ban_customer_group` return
    zero hits. There is no path for the player to add or remove
    staff or to refuse service to a customer group.
  - The Phase 13 plan (`docs/plans/phases-11-15.md` Required
    Owner Actions block) previously listed these as "Optional
    later" with a note to skip them. That tag has now been
    removed; this issue tracks the real gap.
  - Staff hires happen implicitly during initial state
    construction (`createInitialStaff` in `defaults.ts`); the
    sim has no in-run mechanism for the roster to change after
    day 1 except through the `staff_burnout` / `regular_customer`
    issue-seed response paths, which can mutate staff stats but
    not add or remove members.
- **Impact:** Several systems that exist (staff burnout,
  staff loyalty meter, wage settlement, cook tier progression
  per ISSUE-031) assume the player can act on staff problems.
  The only available response when a staff member quits, hits
  burnout limits, or stops being a good fit is — nothing. The
  cook-tier roster never grows beyond the starter set. Customer
  groups whose behavior the player wants to refuse (e.g. ogre
  brawls at low danger tolerance) have no eject lever either.
  This caps the depth of every staff- or customer-side feedback
  loop the post-Phase-40 repair pass has been building.
- **Scope:**
  - Add `hire_staff` owner action: present a small candidate
    pool (sized to renown / location pressure), charge a
    placement cost, append to `state.staff` with a proper
    identity via `createStaffIdentity`. Reuses the identity
    factory; the bottleneck is whether ISSUE-041 has landed
    (wider profile pool).
  - Add `fire_staff` owner action: validate target id in
    `state.staff`, remove the entry, emit causes against staff
    morale (other staff witnessing it), loyalty (immediate hit
    on remaining cookmates / serverkin), and a memory marker
    for any regular who had a relationship with the fired
    staff member.
  - Add `ban_customer_group` (or `kick_patron`) owner action:
    suppress the targeted group's `patronage` and `traffic`
    contributions for a configurable window, with reputation
    costs against the group's culture and any aligned faction.
  - Wire all three into the response-pipeline contract from
    ISSUE-001 (cause + memory + delayed effect support).
- **Depends on:** ISSUE-041 (hire path benefits from the wider
  staff-identity profile pool; without it the new hires are
  goblin/human/dwarf only)
- **Test approach:** `hire_staff` with a valid pick adds an
  entry to `state.staff` with a generated identity and charges
  the placement cost; insufficient coin rejects the action.
  `fire_staff` with a valid target removes the entry, drops
  remaining staff morale, and emits a cause referencing the
  fired staff member. `ban_customer_group` for one week
  suppresses that group's traffic to zero and lifts the
  reputation cost; after the window the group reappears with
  the configured loyalty hit.

### ISSUE-047 — Generic Ignore button binds to non-ignore slots via verb-only matcher fallback

- **Grade:** broken
- **Status:** done
- **Phase:** 87 (single-touch fix; no separate phase plan)
- **Evidence:**
  - `web/src/lib/sim/intentBuilder.ts:48-58` `buildIgnoreIntent` emits
    `verb: 'ignore'`, `shape: 'ignore'`, `metadata.responseSlotId: 'ignore'`.
  - `src/sim/modules/responses/selectConsequence.ts:26-48` (pre-fix)
    walked three lookup paths: (1) `metadata.responseSlotId` exact id,
    (2) `(verb, shape)` combo, (3) verb-only fallback.
  - `src/sim/modules/issues/issueSeedGenerators.ts:988-995` defines
    the staff_burnout `push_through` slot:
    `allowedVerbs: ['ignore'], shape: 'risky_profitable'`. Its
    `push_through_profile` (lines 1092+) carries delayed burnout
    pressure and a per-staff `staff_quit_risk_<id>` future hook.
  - When the staff_burnout card was shown, the deck rendered both
    "Push through" (the modeled slot) and a generic "Ignore" button
    (hardcoded in `web/src/lib/cards/CardRenderer.svelte:87-90`).
    Tapping Ignore: lookup (1) missed (no slot has `id: 'ignore'`),
    lookup (2) missed (shapes don't match), lookup (3) matched
    `push_through` by verb alone and the engine applied
    `push_through_profile` silently.
- **Impact:** Violates the CLAUDE.md contract "cards must not invent
  truth." The player thought they were skipping the card; the
  simulation booked them into a modeled
  do-nothing-and-accept-the-risk path with delayed pressure and a
  future-day quit risk. Symmetric concern for any seed family where
  a non-ignore slot's `allowedVerbs` happens to include `'ignore'`
  (e.g. the `blame`/`ignore` slots at `expandedSeedGenerators.ts`
  lines 898 and 1946).
- **Scope:**
  - Drop the verb-only fallback from `selectConsequence`. Callers
    must set `metadata.responseSlotId` (the production path) or
    match `(verb, shape)` exactly. Header comment captures the why.
  - In `CardRenderer.svelte`, suppress the generic Ignore button
    when any choice's verb is `'ignore'` — the modeled choice IS
    the player's "do nothing" option and its real consequences.
  - When no slot allows `ignore`, the generic button still renders
    and the matcher safely no-ops the intent (logged & skipped by
    `responsesModule.ts:188-201`, matching the existing comment in
    `intentBuilder.ts:10-14`).
- **Depends on:** —
- **Test approach:** New `tests/sim/issue-generic-ignore-routing.test.ts`
  pins three `selectConsequence` cases against a staff_burnout-shaped
  `SelectableSeed`: generic ignore intent (no metadata) → no
  slot/profile; named lookup with `responseSlotId: 'push_through'`
  still binds; `(verb, shape)` exact combo still binds. Unit-level
  rather than via `runDay` because `push_through`'s effects are
  delayed — the matcher contract is the structural fix.

### ISSUE-048 — ActionPicker enables owner actions that fail `canApply` (e.g. `patch_roof` with no coin)

- **Grade:** broken
- **Status:** done
- **Phase:** 88 (single-touch fix; no separate phase plan)
- **Evidence:**
  - `web/src/lib/components/ActionPicker.svelte:126-136` (pre-fix)
    `disabledReason` only checked `actionPointCost > pointsLeft` and
    `listValidTargets(...).length === 0`. It never called
    `canApply`.
  - `src/sim/modules/ownerActions/actionDefinitions.ts:622-649`
    `patch_roof.canApply` rejects with `'insufficient_coin'` when
    `state.coin < patchRoofCost(roof.damage)`.
  - With a damaged roof present, `listValidTargets` returns the
    roof regardless of coin, so the picker showed Patch Roof
    enabled. Tapping queued the action; the engine's
    `applyOwnerActions` then dropped it silently via the
    `if (!verdict.ok)` skip path.
  - `web/src/lib/sim/actionBuilder.ts:168-180` already exported
    `canApplyAction(def, state, input)` — the helper the picker
    should have been calling.
- **Impact:** The player could plan a day's action budget around
  steps that silently do not happen. Generalises to any action with
  preconditions beyond target presence (resource gates, world
  state, cooldowns). Erodes trust in the picker and breaks the UI
  contract that "disabled = will not happen."
- **Scope:**
  - Extract `actionDisabledReason(def, state, pointsLeft)` into
    `web/src/lib/sim/actionBuilder.ts` as a pure helper:
    budget check first, then `canApply` for global actions, or
    "at least one target passes canApply" for targeted actions,
    surfacing the first rejection reason when every target fails.
  - Replace the in-component `disabledReason` with a thin closure
    that forwards to the helper (`pointsLeft` reactive via closure).
  - Mirror the check at the top of `tapAction` so the target
    sub-sheet doesn't open for an action that can't apply to any
    target.
- **Depends on:** —
- **Test approach:** New `tests/sim/issue-action-picker-canapply.test.ts`
  pins four cases on `actionDisabledReason` with `patch_roof`:
  damaged roof + zero coin → reason mentions `'coin'`; damaged roof
  + ample coin → `undefined`; `pointsLeft = 0` short-circuits to
  `'budget full'`; deleted roof area → `'no valid targets'`.

---


## Seven-pass investigation repair roadmap

The following issues come from `docs/plans/seven-pass-investigation-plan.md`
Phase 7. They intentionally group findings by root cause so each repair phase
can land with targeted regression coverage instead of one-off fixes.

### ISSUE-049 — Persistence contract, migration framework, and save-slot safety

- **Grade:** broken
- **Status:** done
- **Phase:** 89
- **Evidence:**
  - `P6-001` — autosave write failures are swallowed by `saveSession()` while
    `App.svelte` still updates `lastSavedAt`.
  - `P6-002` / `P1-002` / `P2-004` — browser load/import/snapshot paths use
    additive helpers instead of a version-stepped migration pipeline, and do not
    synthesize required newer slices such as `recipes` or `expeditions`.
  - `P6-003` — saved `picks` are cast without deep validation.
  - `P6-004` / `P6-005` — snapshot delete is immediate and index corruption can
    strand payload keys.
- **Impact:** Players can lose progress while seeing a recent-save timestamp,
  older exported saves can fail instead of migrate, and corrupted/imported
  session sidecars can reach runtime paths after validation.
- **Scope:**
  - Make save writes return a typed result and surface storage/quota failures in
    the UI without advancing `lastSavedAt`.
  - Replace the current ad-hoc migration chain with explicit version steps or
    default-slice migrations that cover every required top-level/module slice.
  - Validate/sanitize saved owner-action picks before hydration.
  - Add snapshot delete confirmation/undo and decide whether to recover or clean
    orphan payloads.
- **Depends on:** ISSUE-052 for reference-validation gaps that old-save fixtures
  should catch.
- **Test approach:** Use storage adapters/fixtures for successful autosave,
  throwing storage writes, old saves missing late slices, malformed picks,
  invalid JSON/imports, snapshot delete confirmation, and orphan-index recovery
  or cleanup behavior.

### ISSUE-050 — Cross-surface owner-action queue validity

- **Grade:** broken
- **Status:** done
- **Phase:** 90
- **Evidence:**
  - `P3-001` — Tavern quick actions, project/policy buttons, and expedition
    commissioning call `gameStore.addPick()` directly and can overfill the daily
    action-point queue.
  - `P6-003` — persisted picks are not validated before hydration.
- **Impact:** The UI can plan actions that the engine later rejects or skips,
  undermining the action budget and making saved/imported queues unsafe.
- **Scope:**
  - Centralize queue mutation behind a budget- and `canApply`-aware helper.
  - Reuse the helper from all non-picker action surfaces and from save import
    sanitation.
  - Surface clear over-budget/invalid reasons before End Day rather than after
    engine rejection.
- **Depends on:** none
- **Test approach:** Component-helper and store-level tests for each action entry
  point: central picker, quick actions, projects/policies, expedition sheet, and
  hydrated saved picks.

### ISSUE-051 — Day result/report timing and browser RNG seed correctness

- **Grade:** broken
- **Status:** done
- **Phase:** 91
- **Evidence:**
  - `P2-001` — `collectReports()` runs before `generateReports` hooks, making
    issue-seed report output stale relative to same-day state.
  - `P2-002` — browser `runDay()` seeds by day-of-month, repeating seeds every
    28-day month for systems using `ctx.rng`.
  - `P2-005` — change-tracker comments still describe no-longer-produced
    per-phase diffs.
- **Impact:** Same-day reports can lie about newly generated issue seeds, and
  browser long-run variance repeats by calendar day even when headless runners
  use unique absolute-day seeds.
- **Scope:**
  - Reorder report generation or move issue-seed generation to the correct
    phase so report state and `SimResult.reports` agree.
  - Use an absolute-day/calendar-coordinate seed in the browser runner while
    preserving expedition stored-seed determinism.
  - Refresh stale diff/change-tracker docs after the runtime decision.
- **Depends on:** none
- **Test approach:** Engine tests for report/hook ordering and browser-store tests
  proving seeds differ across month boundaries while saved expeditions remain
  deterministic.

### ISSUE-052 — Validation source-of-truth and reference coverage

- **Grade:** broken
- **Status:** done
- **Phase:** 92
- **Evidence:**
  - `P2-003` / `P1-001` — bare `validateState(state)` reads the empty
    `moduleRegistry`, while runtime callers pass `FULL_PIPELINE`.
  - `P4-001` — stock `storageAreaId` is not reference-validated.
  - `P4-002` — area trait and upgrade ids can throw during projection instead
    of failing validation.
  - `P4-005` — bare rumour source/target ids are not validated.
- **Impact:** Diagnostics and imports can miss module-state errors, while stale
  references can survive validation and later degrade UI labels or crash report
  projections.
- **Scope:**
  - Establish one canonical validation module list/helper and deprecate or
    populate `moduleRegistry`.
  - Add reference checks for stock storage areas, area traits/upgrades, and
    rumour endpoints.
  - Ensure persistence/import paths and diagnostics use the same helper.
- **Depends on:** none
- **Test approach:** Reference-validation fixtures with dangling ids and a bare
  validation call that must enforce the same module schemas as runtime.

### ISSUE-053 — Web navigation, modal accessibility, and UI state persistence

- **Grade:** broken
- **Status:** done
- **Phase:** 93
- **Evidence:**
  - `P5-001` — Day's Yesterday digest writes `gameStore.route` but does not
    update App's local `view`.
  - `P5-002` — `BottomSheet` stops Escape propagation inside dialogs and does
    not focus/restore focus.
  - `P5-003` — Reports/Tavern/World sub-tabs are not persisted.
  - `P5-004` / `P3-002` — font-scale coverage and queued-chip copy remain polish
    gaps.
- **Impact:** Some in-app navigation is inert until reload, modal users can get
  trapped or lose focus context, and restored sessions can land on the wrong
  subview despite route persistence.
- **Scope:**
  - Route all in-app navigation through a single App/store contract.
  - Fix modal Escape handling, initial focus, and focus restoration centrally.
  - Decide whether subroutes enter the save envelope; if not, document them as
    intentionally ephemeral.
  - Clean queued-chip duplication and font-scale copy/coverage as polish.
- **Depends on:** ISSUE-049 if subroute persistence changes the session envelope.
- **Test approach:** Browser/component smoke coverage for digest navigation,
  BottomSheet Escape/focus behavior, route/subroute reload, and preference-driven
  font-scale expectations.

### ISSUE-054 — Supplier pricing reaches restock gameplay

- **Grade:** thin
- **Status:** done
- **Phase:** 94
- **Evidence:**
  - `P4-003` — supplier relationship/reliability/market-condition pricing exists
    in helpers/reports, but `restock_item` still uses stock base price directly.
- **Impact:** Supplier relationship systems look gameplay-bearing in reports but
  do not influence the primary purchase loop.
- **Scope:** Decide whether restock should select a supplier and route through
  effective supplier pricing/reliability, or explicitly keep supplier pricing as
  report-only flavor.
- **Depends on:** ISSUE-050 if restock UI changes action targeting/validation.
- **Test approach:** If gameplay-bearing, simulate restock under different
  supplier relationships/market conditions and assert coin, stock, and reports
  reflect effective price/delivery outcomes.

### ISSUE-055 — Area content unpinning and customer-area rotation

- **Grade:** thin
- **Status:** done
- **Phase:** 95
- **Evidence:**
  - `P4-004` — issue-seed generators still hardcode `main_room` references and
    direct `areas.main_room.*` effects.
- **Impact:** New customer-facing areas remain underused by issue content,
  reducing content diversity and making area investments less visible.
- **Scope:** Add shared area pickers for customer-facing, kitchen-adjacent, and
  repairable contexts; keep `main_room` only as fallback.
- **Depends on:** ISSUE-052 for stronger area reference validation.
- **Test approach:** Seed-generation tests across states with multiple eligible
  areas proving references/effects can target non-`main_room` areas.

### ISSUE-056 — Advisory UI validity and future card-choice guardrails

- **Grade:** thin
- **Status:** done
- **Phase:** 96
- **Evidence:**
  - `P3-003` — missed-opportunity recommendations do not run the same
    target/current-state checks as owner-action UI.
  - `P3-004` — `CardChoice.disabledReason` has a renderer slot but no producer.
- **Impact:** Advisory UI can teach actions that may not have been valid, and
  future response-slot preconditions could render inconsistently if added later.
- **Scope:** Add historical/current validity constraints for missed-opportunity
  recommendations, or clearly label them as generic advice; keep disabled card
  choices covered by helper-level guardrails before any preconditioned choices
  ship.
- **Depends on:** ISSUE-050 for shared action validity helpers.
- **Test approach:** Projection tests for missed opportunities where remedy
  actions are unaffordable/targetless, plus a renderer/helper fixture for future
  disabled card-choice metadata.

### ISSUE-057 — End-of-day silent failure + UI error visibility

- **Grade:** broken
- **Status:** done
- **Phase:** 97
- **Evidence:**
  - User report (DayScreen, fresh Day 1 closing beat): clicking END DAY
    produced no visible state change.
  - `web/src/lib/screens/DayScreen.svelte:164-185` — `endDay()` called
    `gameStore.runDay()` bare; any throw from `simulateDay` aborted the
    handler before `setBeat('report')` ran. The button truly did nothing.
  - `web/src/lib/screens/DayScreen.svelte:106-113` and
    `web/src/lib/screens/ReportsScreen.svelte:47-54` — `buildDailyReport()`
    invoked inside `$derived.by(...)` with no error containment. A throw
    propagated through Svelte 5's reactive layer and the surrounding
    `{#if … && dailyReport}` block hid the entire report.
  - `App.svelte` had no `<svelte:boundary>`; render-time errors anywhere
    in the tree silenced the UI.
  - `tests/web/` had no Svelte component tests — the day loop had never
    been exercised in CI.
- **Impact:** Any simulation or projection regression — past or future —
  manifested as the game appearing to lock up at end-of-day, with no
  error message and no recovery path. Players were stuck; the team had
  no test signal.
- **Scope:**
  - Add typed `runError: { message; stack? }` field + `clearRunError()`
    on `gameStore` (matches the existing `saveError` precedent).
  - Wrap both `gameStore.runDay()` callsites in `DayScreen.svelte`
    (`endDay`, `runQuickDay`) with try/catch. On throw: set `runError`,
    do NOT advance the beat. Surface an in-place banner with Retry +
    Dismiss.
  - Replace `dailyReport` (DayScreen) and `report` / `weeklyOverview` /
    `monthlyOverview` (ReportsScreen) with discriminated-union
    `{ ok: 'success'|'empty'|'error', ... }` deriveds wrapping the
    builder calls in try/catch. Each subview renders a small fallback
    panel on the error branch instead of disappearing.
  - In DayScreen's `beat === 'report'` block, render one of three
    branches keyed on `dailyReport.ok`: real `<DailyReport>` for success;
    "Day complete (no report yet)" panel for `empty`; "Report
    unavailable" panel with the error message for `error`. All three
    expose a Next day button so the player can always move forward.
  - Add a top-level `<svelte:boundary>` in `App.svelte` around the
    `<AppShell>` block with a `failed` snippet rendering a recovery
    panel (Go to Day + Reload).
  - Use `$state.snapshot(this.state)` inside `gameStore.runDay()` before
    passing to `simulateDay` — the canonical Svelte 5 idiom that also
    keeps the engine's `structuredClone` path safe in stricter
    environments (jsdom in component tests).
  - Add the first Svelte component tests under `tests/web/components/`:
    happy path, `simulateDay` throws, `buildDailyReport` throws. Plus
    one ReportsScreen projection-failure test. Vitest config gains an
    `environmentMatchGlobs` entry routing those files through jsdom.
- **Depends on:** none (defensive layer; sits above engine and projection
  code).
- **Test approach:** Three tests in `tests/web/components/dayScreen.test.ts`
  cover the happy path and both throw paths (sim and report). One test
  in `tests/web/components/reportsScreen.test.ts` covers the projection
  fallback when the user views a report whose builder throws. The
  thrown-error tests assert the error message is on screen and a
  forward path remains.

### ISSUE-058 — Web UI component test coverage gap

- **Grade:** thin
- **Status:** done
- **Phase:** 119
- **Evidence:** `tests/web/` contained only data-layer tests (preferences,
  persistence, exportImport, subroutePersistence, queueValidity,
  firstEncounter, snapshots, difficulty) before ISSUE-057. Zero
  `*.svelte.test.ts` files. Zero coverage of `web/src/lib/screens/` or
  `web/src/lib/components/`. The day loop, picker sheets, sticky pick
  chip, modal sheets, and bottom-nav routing had never been exercised
  in CI.
- **Impact:** UI regressions (broken handlers, missing bindings, blank
  screens) cannot be caught by `npm test`. Each phase that touches the
  UI risks the same class of issue as ISSUE-057.
- **Scope:** Add smoke tests for each top-level screen (Day, Reports,
  Tavern, World, More, Start) and the major bottom-sheet components
  (ActionPicker, StaffPrioritySheet, CommissionExpeditionSheet). Each
  test mounts the screen with a representative `gameStore` state,
  asserts key elements render, exercises one primary interaction,
  asserts a visible state change. Reuse the jsdom +
  `@testing-library/svelte` stack established in ISSUE-057.
- **Depends on:** ISSUE-057 (establishes the test stack and
  `environmentMatchGlobs` config).
- **Test approach:** One smoke test per screen, plus one cross-screen
  flow (Tavern → queue an action → Day → End Day → Report reflects the
  queued action).

### ISSUE-059 — Unprotected `$derived.by(...)` blocks across the web layer

- **Grade:** thin
- **Status:** done
- **Phase:** 120
- **Evidence:** 21 `$derived.by(...)` blocks across `web/src/lib/`
  (DayScreen, ReportsScreen, TavernScreen, TopBar, Glossary,
  PressuresDashboard, CommissionExpeditionSheet, PressureRibbon,
  TermLabel, TavernLog, CauseDrilldown, SupplierDetailSheet,
  TavernIdentityStrip, SavesSection, SnapshotRow). Most are local
  label / filter / projection computations; a small number call
  cross-module builders. ISSUE-057 wrapped the four highest-risk call
  sites (`buildDailyReport` × 2, `buildWeeklyOverview`,
  `buildMonthlyOverview`); the rest remain unprotected against throws
  that the new App-level `<svelte:boundary>` would catch but only at
  the cost of unmounting the whole screen.
- **Impact:** Same class as ISSUE-057 but lower likelihood — most of
  these derives are simple label/filter computations. Cross-module
  builders are the highest residual risk (notably `buildTavernOverview`
  in `TavernScreen.svelte:41`).
- **Scope:** Audit each `$derived.by` call. Categorise as: (a) trivial
  filter/map over store state — leave alone, App-boundary covers;
  (b) builder/projection that can plausibly throw — wrap in the same
  `{ ok, data | error }` discriminated union pattern from ISSUE-057,
  render a small "unavailable" panel for the false branch.
- **Depends on:** ISSUE-057 (introduces the discriminated-union pattern
  and the per-section fallback panel styling).
- **Test approach:** For each newly-wrapped derived, add a test that
  mocks the builder to throw and asserts the unavailable panel renders
  instead of a blank section.


## Tier 4 — Progressive Onboarding Arc

This tier reframes Day 1 as a goblin opening their tavern for the very
first time, with the player naming their owner and tavern and picking
1–2 staff at start. Simulation systems then unlock one at a time across
the first ~10 weeks of in-game time, tied to story beats at day
thresholds. Gated systems do not run hooks before they unlock — there
is no hidden background simulation for invisible systems.

The arc's full design lives in
[`docs/plans/progressive-onboarding.md`](plans/progressive-onboarding.md).
That document is the locked specification. Each issue below references
the design doc for the authoritative rules; the entry itself records the
issue-scoped evidence, scope summary, dependencies, and verification
approach.

The dependency chain forces a clear order: design contract first (060),
state slice and infrastructure next (061, 062, 063), trimmed initial
state and new-game flow (064, 065, 066), then per-system unlocks in
day-order (067 through 074), then web polish and migration (075, 076,
077).

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


## Deferred

These were identified but are consciously out of scope for this repair
pass.

- **Save / migration framework.** `src/sim/state/saveEnvelope.ts:15-19`
  has `migrateSaveEnvelope` as a no-op and three opt-in helpers
  covering legacy state shapes. No version-keyed framework exists.
  Defer until the first phase that introduces persistent state
  (post-card layer); at that point, the helpers can become the
  building blocks of a real version registry.
- **Memory tags written but never read** (write-side dead tags, as
  opposed to the read-side dead tags handled in ISSUE-010 and
  ISSUE-014). The codebase emits descriptive tag metadata that no
  consumer reads. Don't sweep-fix; pick by gameplay surface need.
  Some are absorbed into per-feature bundles when a consumer phase
  needs them; the rest stay deferred.
- **Faction memory threshold tightening.** Weekly faction-memory
  writes use thresholds (`satisfactionDelta >= 3`, `tensionDelta >= 2`)
  where deltas are clamped at ±5. The thresholds are marginal but
  the direct write path is supplemented by attribution propagation,
  which clears the audit threshold. Re-evaluate if faction memories
  show up thin again in a future readiness run.

---

## Tier 5 — UI/UX Clarity Arc

This tier sits between Tier 3 polish and Tier 4 progressive
onboarding. The clarity issues land *before* Tier 4 because
progressive pacing of system introductions cannot fix
comprehensibility — a player who unlocks "policies" on Day 21 and
sees fourteen contradictory action rows still bounces off. Each
surface has to read as English first; pacing layers in next.

The arc spans two phases: ISSUE-078 (translation + structural
fixes) and ISSUE-079 (information design follow-up). The
ISSUE-078 design lives at
[`docs/plans/phase-117-ui-ux-clarity-pass.md`](plans/phase-117-ui-ux-clarity-pass.md);
that file's `§8 Follow-up phase — Comprehension Pass 2` section
is the design seed for ISSUE-079.

### ISSUE-078 — UI/UX clarity pass — humanize ids, paths, policies, recipes

- **Grade:** broken
- **Status:** done
- **Phase:** 117
- **Evidence:** Three player-facing surfaces leak machine-readable
  ids verbatim:
  - `ActionPicker` → Policies tab lists both
    `Enable Allow Tabs for Regulars` and
    `Disable Allow Tabs for Regulars` simultaneously, with
    subtext `Policy allow_tabs_for_regulars is not enabled`
    (raw snake_case id). 7 policies → 14 action rows, half of
    them always disabled.
  - `DailyReport` → Significant Changes section renders the
    engine's raw `readable` field:
    `stock.ale.quantity 80 → 0 (-80)`,
    `pressures.staff_loyalty_risk.value 0 → 75 (+75)`,
    `pressures.cultural_tension.value 0 → 35 (+35)`. JSON-pointer
    paths with `.value` / `.quantity` internal suffixes shown to
    the player.
  - `RecipesPanel` → Tavern → Recipes lists `Firewood Bundle`,
    `Replacement Mug`, and `Cook Surplus` as menu items, all
    `onMenu: true` by default. Firewood is fuel; mugs are
    service equipment; "Cook Surplus" is developer shorthand for
    raw-ingredient consumption. None are dishes a customer
    orders.
  Smaller leaks across the panels: `member.role.replace(/_/g, ' ')`
  for staff role labels, `{social.outcome}` and `{project.status}`
  rendering raw enum strings, `{facet.tag}` showing
  `staff_action`/`weekly_event` underscored.
- **Impact:** The Day-1 player can't distinguish system noise
  from a coherent surface. Even with progressive onboarding pacing
  systems in over weeks, individual screens still look like
  developer inspectors. Progressive onboarding cannot fix it
  without this work landing first.
- **Scope:**
  - **Translation utility.** New `src/reports/labels/idLabel.ts`
    centralises every id → label resolution: registry-backed
    categories (`stock`, `recipe`, `pressure`, `area`, `staffRole`,
    `staffPriority`, `action`, `policy`) consult the matching
    registry; enum-shaped categories (`projectStatus`,
    `socialOutcome`, `expeditionOutcome`, `areaField`, `logFacet`,
    `dayType`, `reputation`) consult a colocated static table.
    Fallback is `humanizeId(id)` so render sites never crash on
    unknown values.
  - **Path humanizer.** New `src/reports/labels/humanizePath.ts`
    consumes engine-emitted JSON-pointer paths and returns
    player-facing labels (`stock.ale.quantity` → `Ale stock`).
    `humanizeDiff(d)` composes the label with the before/after/
    delta using typographic minus. `projectTopDiffs()` populates
    a new `humanReadable` field on `ReportDiffLine`; the engine's
    `readable` stays byte-identical for snapshot stability.
    `DailyReport.svelte` binds to `humanReadable`. The
    `formatDiffPathTitle()` helper used by the drilldown sheet
    delegates to `humanizePath`.
  - **Owner-action target labels.** `ReportOwnerActionLine` gains
    `targetLabel`; `projectOwnerActions` resolves it through the
    action's `targetType` (area/stock/recipe/policy → registry;
    staff/regular/supplier/faction/customer_group → state
    lookup). The "What happened" ledger renders the label.
  - **Policy toggle UX.** `actionBuilder.ts` gains
    `listPolicyToggleRows(state, pointsLeft, picks)` that returns
    one row per starter policy, resolving the matching `enable_X`
    or `disable_X` action by current state. `ActionPicker.svelte`
    renders these rows instead of the paired action list when
    `tab === 'policy'`: each row is a toggle with ON/OFF state
    pill, effects subtitle, and conflict callout when the
    inverse policy's enable is queued. The 14 underlying
    registry actions stay registered — only the picker UI
    changes. Reject reasons in `policyActions.ts` switch from
    `Policy <snake_id> is not enabled` to
    `<Policy Label> is already off.`.
  - **Recipes upkeep filter.** `recipeRegistry.ts` tags
    `dish_firewood`, `dish_mugs`, `dish_ingredients` with
    `'upkeep'` and flips their `defaultState.onMenu` to `false`.
    `tavernOverviewProjection.ts:buildRecipePanel` excludes
    upkeep-tagged recipes from both `onMenu` and `available`.
    `StockRow` gains `isUpkeepConsumed` so `StockPanel.svelte`
    renders a "used for upkeep" pill on firewood/mugs rows. New
    migration `flipUpkeepRecipesOffMenu` runs in
    `web/src/lib/sim/persistence.ts` so pre-clarity-pass saves
    drop these from the menu automatically.
  - **Microcopy sweep.** `StaffPrioritySheet.svelte` uses
    `idLabel('staffRole', ...)` instead of regex replace.
    `StaffPanel.svelte` fixes the `'staff' : 'staff'` ternary
    plural bug to `'staff member' : 'staff'`.
    `ProjectsPanel.svelte` uses `idLabel('projectStatus', ...)`
    and `idLabel('socialOutcome', ...)`, and updates the inline
    policy toggle button labels from "queue enable"/"queue
    disable" to "Turn on"/"Turn off".
    `StockPanel.svelte` uses `idLabel('expeditionOutcome', ...)`.
    `AreasPanel.svelte` routes `activeProblems` through
    `humanizeId`.  `TavernLog.svelte` routes facet chips and
    inline tag pills through `idLabel('logFacet', ...)`.
    `TopBar.svelte` uses `idLabel('dayType', ...)`; the local
    `formatDayType` is removed, and the daily report header in
    `dailyReportProjection.ts` does the same.
- **Depends on:** —
- **Test approach:**
  - `tests/reports/labels.test.ts` — 25 tests covering
    `idLabel`, `humanizeId`, `humanizePath`, `humanizeDiff`
    across every category and the canonical-path
    no-leakage assertion.
  - `tests/reports/upkeepRecipeFilter.test.ts` — 7 tests
    asserting the three upkeep recipes carry the tag, start
    off-menu, are excluded from the panel projection, that
    firewood/mugs surface `isUpkeepConsumed: true`, and the
    migration is idempotent + flips legacy `onMenu: true`.
  - `tests/web/policyToggleRows.test.ts` — 7 tests covering
    one-row-per-policy, label not raw id, correct enable_X /
    disable_X dispatch by state, budget disable, queued-pick
    bypass, conflict note.
  - `tests/reports/tavernOverviewProjection.test.ts` — existing
    recipe-count assertion updated to subtract upkeep recipes
    (sanity check that the filter is active).

### ISSUE-079 — UI/UX comprehension pass — diff grouping, empty states, glossary, density

- **Grade:** thin
- **Status:** done
- **Phase:** 118
- **Evidence:** Even with ISSUE-078 landed, four classes of
  comprehension friction remain. They are covered in detail in
  §8 of `docs/plans/phase-117-ui-ux-clarity-pass.md` (the
  "Follow-up phase — Comprehension Pass 2" section). Summary:
  (1) The Daily Report's `Significant changes` list flat-renders
  up to 8 mixed-category rows. (2) Empty states across panels
  default to no message or to "no items in this category"
  — players hit dead ends with no guidance. (3) Glossary
  coverage is partial: new terms surfaced by ISSUE-078 (upkeep,
  policy ON/OFF, action points, queued action, demand tier,
  spoilage, shortage, expedition outcomes, day types, every
  pressure label) lack `TermLabel` wiring. (4) Tavern panel rows
  pack too many metrics inline — staff row, stock row, area row,
  recipe row each push 4–6 data points into one line.
- **Impact:** The clarity pass makes each surface *legible*; the
  comprehension pass makes each surface *scannable* and explains
  its vocabulary on first encounter. Without this, the
  progressive-onboarding arc still delivers screens that work
  but feel dense.
- **Scope:** See `docs/plans/phase-117-ui-ux-clarity-pass.md §8`
  for the full design seed. When this phase starts, lift §8.1–§8.5
  into a dedicated phase plan file at
  `docs/plans/phase-118-ui-ux-comprehension-pass.md` per the
  per-issue workflow in `CLAUDE.md`.
- **Depends on:** ISSUE-078
- **Test approach:**
  - Group-render test asserting the Daily Report renders one
    `<section>` per non-empty group (coin/reputation, stock,
    pressures, areas) with per-group caps applied.
  - Per-panel empty-state test mounting each panel against a
    fixture state with the relevant list empty and asserting
    the new copy renders.
  - Glossary coverage test that walks every `TermLabel` term in
    components and asserts a matching glossary entry.
  - Manual: end a busy day with mixed diffs; confirm grouped
    sections render and the area/stock detail sheets carry the
    moved-out metrics.

---

## Retroactively tracked phases

These phases shipped before being recorded in the tracker. Entries here
are intentionally lighter than the rest — they document what landed,
not what was scoped, because the scoping happened in the phase plan.
They exist so the tracker is a complete record of all phase work.

### ISSUE-080 — More tab + save slots + first-encounter hints + difficulty (retroactive)

- **Grade:** thin
- **Status:** done
- **Phase:** 98
- **Implementation record:** `docs/plans/phase-98-more-tab.md`.
- **Evidence:** Web UI had four bottom-nav tabs (Day, Reports, Tavern,
  World) but no settings, save management, help, or about surface. The
  `game-loop-and-ux.md §6` brief called for a fifth "More" tab; §9.4
  flagged first-encounter tooltips as an open question; §2.1 flagged
  new-game difficulty/seed options.
- **Impact:** Returning players had no way to manage save slots beyond
  the autosave, no way to reset or to change accessibility settings,
  and no in-product help for unfamiliar terms. New players hit the
  full simulation depth on Day 1 with no opt-in cushion.
- **Scope (delivered):** Fifth bottom-nav tab with Settings (font scale,
  reduced motion, show-seed-tags toggle, confirm-before-end-day toggle,
  show-first-encounter-hints toggle, reset), Saves (autosave row + up
  to 5 named snapshots with rename / delete / load / export / import),
  Help, About. First-encounter hint system with per-term one-time
  tooltips. 3-preset difficulty picker on the Start screen (lenient /
  default / harsh) feeding the seed and starting modifiers.
- **Depends on:** ISSUE-049 (persistence + migration framework).
- **Test approach (delivered):** `tests/web/firstEncounter.test.ts`,
  `tests/web/snapshots.test.ts`, `tests/web/difficulty.test.ts`,
  plus the settings / saves round-trip tests in `tests/web/preferences.test.ts`
  and `tests/web/persistence.test.ts`.

---

## Tier 6 — Living Cast arc (card-layer kickoff)

The Living Cast arc gives each character a unique voice without
hand-writing dialogue. Phase A lays the bounded selection vocabulary
later phases (compositional runtime, test gates, generation pipeline,
scale-out) will select against. Locked roadmap:
`docs/plans/living-cast-arc.md`. Framework contract:
`docs/plans/card-composition-framework.md`.

### ISSUE-090 — Living Cast Phase A: bounded cast attributes on staff + regulars

- **Grade:** thin
- **Status:** done
- **Phase:** 121
- **Implementation record:** `docs/plans/phase-121-character-depth.md`.
- **Evidence:** The 20-line voice demo failed for the sim because it
  minted fresh ad-hoc tags per line (`fae_touched_wanderer`,
  `anti_mage`). At scale, freeform tags are unselectable noise — the
  compose-layer assembler (`card-composition-framework.md §3`) needs
  *bounded* vocabulary to pick deterministically. Staff carried only
  free-form `personalityTags` + `workStyle` / `stressResponse` enums
  (`StaffIdentityState` @ `src/sim/state/TavernState.ts:149`); regulars
  carried no identity vocabulary at all beyond name + culture pointer
  (`RegularWorldState` @ `src/sim/state/TavernState.ts:481`).
- **Impact:** Without this layer, the entire Living Cast arc cannot
  start — Phase B's hand-iterated generation spike has no attributes
  to reference, and the `actorTrait` SnippetCondition declared in
  `card-composition-framework.md §2.3` has no fields to read.
- **Scope (delivered):** New content slice at `src/sim/content/cast/`
  owning `CastAttributes` (`specialty`, `blindspot`, 1–2 `affinity`
  axes, `voiceProfile` with 4 axes + optional verbal-tic id), data
  tables (per-role staff specialties; shared social specialties for
  regulars; affinity targets; culture-aware voice defaults; verbal-tic
  registry), and two factories that roll attributes from the existing
  `staff_identity` / `regular_identity` named RNG streams *after* the
  existing identity rolls so all canonical pre-Phase-A names and
  identity fields stay byte-identical. Optional `castAttributes?` on
  `StaffState` and `RegularWorldState` with Zod schemas, an additive
  `ensureCastAttributes` migration helper, and wiring into
  `createInitialStaff`, `createInitialRegulars`,
  `regularModule.createRegular`, the `hire_staff` owner action, and
  `web/src/lib/sim/persistence.ts` migration chain.
- **Depends on:** none. The Living Cast arc has no upstream tracker
  dependency; the Tier 4 onboarding arc and Phase A are independent.
- **Test approach (delivered):** `tests/sim/phase121.castAttributes.test.ts`
  (13 gates): schema round-trip; determinism across re-render; stream
  isolation; no regression on existing identity fields (Phase 31
  contract preserved); culture-aware bias (miner_workcrew terseness
  mean > merchant_roadfolk terseness mean by ≥ 0.8 across 80 samples);
  migration round-trip + idempotency + determinism; bounded outputs
  per role/social domain; no-prose check (every string field is an id
  ≤ 32 chars, no spaces); registry coverage sanity. Full suite stayed
  green at 1719/1719 including the existing persistence round-trip
  tests (which were the regression guard — pre-Phase-A starter
  regulars needed the new factory too, caught and fixed during
  implementation).

### ISSUE-109 — Voiced Surface Phase 14: Periodic & Narrative Beats cluster (closes Movement II)

- **Grade:** thin
- **Status:** done
- **Phase:** 140
- **Implementation record:** `docs/plans/phase-140-periodic-narrative-beats.md` (this phase's plan), `specs/cards/monthly_review.spec.yaml`, `specs/cards/seasonal_arc.spec.yaml`.
- **Evidence:** Two issue-seed families rendered through legacy paths pre-Phase 14. (1) `monthly_review / monthly_review / end_month` (generator at `src/sim/modules/issues/issueSeedGenerators.ts:3569-3880`) rendered through the legacy hand-written `monthlyReviewCard` (`src/cards/templates/monthlyReview.ts`) which lifted `ti.calendarContext[0]` plus top-3 pressures formatted as raw `${label} ${value} (${trend})` strings into the body via `composeBody` — the high-severity fragment-dump-with-mechanical-readout pattern. (2) `seasonal_arc / arc_milestone | festival_preparation / morning_prep` (generator at `src/sim/modules/issues/expandedSeedGenerators.ts:4285-4489`; registry entry `seasonalArcMilestone` at `:6128` binds the family to the same generator) had no dedicated template — every seed across both active-arc Path A and anticipation Path B and all five themes (mushroom_blight / miner_payday_boom / inspection_campaign / rival_tavern_expansion / festival_approaching) routed to `fallbackCard`. Phase 14 closes Movement II of the [Voiced Surface arc](plans/voiced-surface-arc.md); Phase 15 (Reports Prose) picks up the weekly overview and the rest of the report surface per user scope direction.
- **Implementation record:** Final Movement II migration of the [Voiced Surface arc](plans/voiced-surface-arc.md). Two new compositional templates land in `REQUIRED_CARDS`:
  - **`monthlyReviewCard`** (rewritten in place, `src/cards/templates/monthlyReview.ts`) — id `monthly_review.monthly_review` (was `monthly_review.strategic`; aligned to the Phase-7+ `${family}.${type}` convention). Priority 65 (mirrors `debtRentCard`'s same `end_month` cadence). Voice register `office_quarters` (owner-at-the-ledger view; same register as debtRent and rivalTavern). No `custom` predicate — narrator-voiced (the seed's primaryActor is a `{ kind: 'other', id: 'month:${monthKey}' }` ref with no `castAttributes`, audit pass 1 §5.3 — periods are not characters). Body shape `[establishing_line (sim-backed, ≤14 words), reaction_line (flavor, ≤12), manner_note? (flavor, ≤10)]`. Title rendered with the fixed `Month in review: ${snippet}` colon-separated prefix — preserves the legacy header frame while the snippet supplies the month's character within a 6-word slot budget. Six slot pools at `src/cards/compose/pools/monthlyReview/`: `title` (6 — fallback + landlord/debt/reputation_drift rising + rent_due_soon + high severity), `establishing_line` (13 — fallback + six pressureRising rungs covering every major monthly pressure + three memory rungs + rent_due_soon paired with pressureRising + high severity paired with pressureRising + monthly repeat paired with pressureRising), `reaction_line` (9 — fallback + tag / memory / severity rungs), `manner_note` (5), `choice_label` (7 — pay/upgrade/delay/negotiate verb-gated × tag/severity/memory), `effect_preview` (6 — effectKind/effectTag × verb).
  - **`seasonalArcCard`** (new, `src/cards/templates/seasonalArc.ts`) — id `seasonal_arc.arc_milestone`; `appliesTo.seedTypes` lists both `['arc_milestone', 'festival_preparation']` so one template covers both types. Priority 70 (above monthly's 65 — seasonal beats are situational, monthly is bookkeeping). Voice register `civic_floor` (populace / world-event framing matching `cultureConflict`'s register for population-wide beats). No `custom` predicate — narrator-voiced (local_event refs Path A carry no `castAttributes`; Path B anticipation has no `primaryActor` at all). Body shape identical to monthly_review. Title rendered with `${arcLabel ?? themeLabel ?? 'Seasonal event'}: ${snippet}` where `arcLabel = state.world.localEvents[ref.id]?.label` when `primaryActor.kind === 'local_event'`, `themeLabel` derives from `seed.toneHints[2]` (capitalised — e.g., `'mushroom_blight'` → `'Mushroom blight'`), and the literal `'Seasonal event'` is the last-resort fallback (mirrors the `rivalTavern.ts:109-122` title pattern). Six slot pools at `src/cards/compose/pools/seasonalArc/`: `title` (8 — fallback + climax + arc_escalation + 5 per-theme), `establishing_line` (12 — fallback + arc_escalation rising + festival_readiness rising + climax paired with arc_escalation + 5 per-theme paired with arc_escalation/festival_readiness + 2 memory rungs + high severity paired with arc_escalation), `reaction_line` (10 — fallback + anticipation + severity + 5 per-theme + memory), `manner_note` (5), `choice_label` (14 — wide cross-theme verb roster including buy/upgrade/invite/clean/bribe/rebrand/negotiate/raise_price/pay/delay/discard/ignore), `effect_preview` (6 — effectKind/effectTag).
- **Impact:** (1) Both legacy seed families now render through composition with sim-backed establishing lines, narrator-voiced reactions, voiced choice labels, and composed titles — no raw textIngredients leakage, no `${label} ${value} (${trend})` mechanical readouts, no `composeBody` glue. (2) The legacy `monthlyReviewCard` hand-written template is replaced in place; the seasonal_arc family gets its first dedicated card after 14 phases of the arc. (3) The "narrator-voiced ownerless" framing now spans five registers across the arc (`office_quarters`, `back_of_house`, `civic_floor`, `tavern_floor`, plus the actor-voiced registers from Phases 7/8/9/12/13). (4) Movement II closes at 19 compositional templates in `REQUIRED_CARDS` (+monthlyReview rewritten, +seasonalArc new vs the post-Phase-13 baseline of 18; the count is +1 because monthlyReview was already listed). (5) Phase 15 (Reports Prose) inherits a clean Movement II — every seed family in the arc's scope now flows through a dedicated compositional template; the only surface left for `fallbackCard` is families outside the arc's reach.
- **Movement I loopback — none:** Both seeds expose what's needed through existing primitives. monthly_review reads every relevant pressure via `pressureRising` per ID (`landlord` / `debt` / `reputation_drift` / `staff_burnout` / `customer_complaint` / `rival_tavern_pressure`); pulls calendar tags via `hasTag` (`rent_due_soon` is already in `seed.domain` / `seed.toneHints`); pulls prior-monthly choice memories via `memoryPresent` (the seed records `rent_paid_${monthKey}`, `cellar_invested_${monthKey}`, `reserves_held_${monthKey}`, `rival_settled_${monthKey}` memories); tracks monthly repeats via `repeatCount`. seasonal_arc reads the five themes via `hasTag` against the theme already present in `seed.toneHints[2]` (`collectSeedTags` in `src/cards/compose/conditions.ts:80-88` reads `domain ∪ toneHints ∪ stake tags`); reaches the two arc pressures via `pressureRising arc_escalation|festival_readiness`; distinguishes climax via `seedType arc_milestone`. **Sim-coherence co-conditions:** the gate's `STATE_LOOKUP_KINDS` excludes `hasTag` and `seedType`, so every sim_backed snippet on seasonalArc gated only on a theme tag or climax type is paired with `pressureRising arc_escalation` or `pressureRising festival_readiness` — exactly the `cultureConflict` / `reputationShift` precedent.
- **Scope deliberately excluded:**
  - Weekly overview voicing → Phase 15 (Reports Prose) per user direction. The `weekly/report.ts:17` "no narrative prose, no card text (Phase 14 §'Do Not Do')" comment stays for Phase 14 and gets revisited by Phase 15. Adding voiced summary lines to the WeeklyOverview ReportSection requires architectural work (composition applied to a non-card surface) that belongs to Phase 15's report-prose scope.
  - Reports tab prose, tavern log, day beats, fallback voicing → Phases 15 / 16.
  - Voice register churn — two existing registers (`office_quarters`, `civic_floor`) cover the cluster.
  - New band signals, new condition primitives, new `resolveActorRef` role strings.
  - Changes to `generateMonthlyReview` or `generateSeasonalArc` — mechanical truth (severity, response slots, consequence profiles, future hooks, memory tags) is unchanged; only wording is composed.
  - A separate `seasonal_arc_milestone` template split by type — user direction: one template covering both types, with the climax distinguished by a `seedType arc_milestone` condition on specific snippets.
  - Cross-Situation Voice Consistency gate (Phase 17) — both new templates are narrator-voiced so they don't participate in actor voice consistency.
- **Depends on:** ISSUE-096 (signal surface), ISSUE-099 (Claude Code authoring loop), ISSUE-100 (composed title slot), ISSUE-101 (composed choice/preview).
- **Test approach (delivered):** Two new template-integration test files (16 + 18 tests covering `appliesTo` matching including the dual seed-type / dual-path coverage for seasonal_arc, render output, mechanical-truth preservation, determinism, non-mutation, theme-routing assertions, narrator-voiced ownerless guarantee). Two new template-level `runAllGates` blocks + two new ad-hoc choice-pool gate blocks (all seven structural gates green per template). Two new exported sampler families (`buildMonthlyReviewDeterminismSamples` / `buildMonthlyReviewDiversitySampler` and `buildSeasonalArcDeterminismSamples` / `buildSeasonalArcDiversitySampler`) with state-perturbation tables — monthly has 19 entries (pressure × memories × calendar tags × severity), seasonal has 15 entries (type × theme × activation × pressures × memories × severity). Two new Phase-6 context builders per template. `tests/cards/templates.test.ts` Template 8 block rewritten for compositional output and Template 9 (seasonalArc) added; `tests/cards/templates.voice.test.ts` monthly_review voice block rewritten and seasonalArc voice block added. Full suite stayed green at the post-Phase-13 baseline plus this phase's additions.

### ISSUE-104 — Voiced Surface Phase 9: Suppliers, Stock & Debt cluster

- **Grade:** thin
- **Status:** done
- **Phase:** 135
- **Implementation record:** Third Movement II migration of the [Voiced Surface arc](plans/voiced-surface-arc.md). Three new compositional templates land in `REQUIRED_CARDS`:
  - **`supplierReliabilityCard`** (new, `src/cards/templates/supplierReliability.ts`) — id `supplier_relationship.supplier_offer`, attaches to `supplier_relationship / [supplier_offer, opportunity] / morning_prep` with a `castAttributes`-required custom predicate on the supplier (`state.world.suppliers[id]`). Voice register `trade_floor`. Body shape `[establishing_line (sim-backed, ≤14 words), reaction_line (flavor, ≤12), manner_note? (flavor, ≤10)]`. Six slot pools at `src/cards/compose/pools/supplierReliability/`: `title` (5 — fallback + 4 voice-axis), `establishing_line` (9 — emits the Phase-3 / ISSUE-098 converged spec verbatim from `specs/cards/supplier_reliability.spec.yaml:357-399`), `reaction_line` (16 — fallback + 5 single-axis + 3 two-axis + 7 verbal-tic), `manner_note` (6), `choice_label` (6 — verb-gated × voice-axis covering pay / negotiate / blame / ignore / fire), `effect_preview` (6 — effectKind/effectTag × voice-axis). Title rendered as `${supplierDisplay}: ${snippet}`. **Replaces** the legacy hand-written `supplierOfferCard` (`src/cards/templates/supplierOffer.ts`, deleted) which built the body by concatenating `ti.marketContext[0]`, the raw `"reliability ${value}"` meter readout, and `ti.recentContext[0]` through the legacy `composeBody` — the broken-screenshot template that started the Voiced Surface arc.
  - **`stockShortageCard`** (new, `src/cards/templates/stockShortage.ts`) — id `stock_shortage.warning`, attaches to `stock_shortage / warning / morning_prep`. Voice register `back_of_house`. First dedicated card the family has had — pre-Phase 9 every `stock_shortage` seed routed to `fallbackCard`. **Narrator-voiced (no actor):** the seed has no `primaryActor` (the subject is a stock item; `affectedActors` is a `customerRef('miners')` cohort), so every snippet pool is free of `voiceAxis` / `verbalTic` conditions — those primitives would always resolve to `false` because actor resolution returns `undefined`. Variety comes from state perturbation: `pressureRising stock_shortage|reputation_drift`, `memoryPresent deception|price|ignored|stock`, `repeatCount stock`, `hasTag urgent|high_demand|payday|brawl_night|market_day|local_night`, and `severityAtLeast`. Six slot pools at `src/cards/compose/pools/stockShortage/`: `title` (5 narrator snippets, no actor prefix), `establishing_line` (10 — fallback + pressure-rising + four memory-tag rungs + repeatCount + two-condition top), `reaction_line` (12 — fallback + four tone-tag rungs + severity + memory rungs + two top-rungs), `manner_note` (5), `choice_label` (6 — verb-gated only, no axis: buy / raise_price / serve / delay / ignore), `effect_preview` (6 — effectKind/effectTag only).
  - **`debtRentCard`** (new, `src/cards/templates/debtRent.ts`) — id `debt_rent.debt_pressure`, attaches to `debt_rent / debt_pressure / end_month`. Voice register `office_quarters`. Also first dedicated card for the family. Same narrator-voiced framing as stockShortage: the seed has no `primaryActor` by design (audit pass 1 §5.3 — the landlord is a `systemRef`, not a real entity), `affectedActors: []`. Six slot pools at `src/cards/compose/pools/debtRent/`: `title` (5), `establishing_line` (10 — fallback + `pressureRising debt|landlord` + four memory-tag rungs (`rent`, `landlord`, `debt`, `risk`) + `rent_due_soon` calendar tag + `severityAtLeast` + two-condition top), `reaction_line` (12), `manner_note` (5), `choice_label` (6 — verb-gated only: pay / borrow / delay / raise_price), `effect_preview` (6 — effectKind/effectTag only). Timing `end_month` (not morning_prep) distinguishes this template from supplier and stockShortage.
- **The ownerless-framing decision (user-confirmed up-front):** For `stock_shortage` and `debt_rent`, the seed shape carries no actor that can be voiced. Three options were considered: (A) route through the affected cohort by adding `textIngredients.namedEntities`; (B) introduce a `playerOwner.castAttributes` surface on `TavernState`; (C) narrator-voiced fixed register, snippets vary on state/seed not personality. Phase 9 takes (C) — additive-only, no Movement I loopback. Cohort routing for the miners cohort and the player-owner voice profile are deferred as design-intent. Future phases that need them will follow the same Movement-II→Movement-I loopback pattern Phase 8 used for the four customer-group/regular band signals.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 9. Before this phase, `supplierOfferCard` was the broken-screenshot template (`reliability 45` mid-sentence, `composeBody`-glued fragments). `stock_shortage` and `debt_rent` seeds fell through to `fallbackCard` — running the cardless playtest produced thousands of these seeds rendered as the generic fallback card. The supplier failure is the one Phase 3 / ISSUE-098 already converged a spec against (`specs/cards/supplier_reliability.spec.yaml`); Phase 9 emits that spec verbatim as TS pools.
- **Impact:** (1) Three issue-seed families now render through composition with sim-backed establishing lines, narrator-voiced reactions (or actor-voiced for supplier), voiced choice labels, and composed titles — no raw textIngredients leakage, no `reliability \d+` / `debt \d+` / `low stock` mechanical readouts. (2) The legacy `supplierOfferCard` is gone; the supplier surface now uses the Phase-3 spec end-to-end. (3) The "narrator-voiced ownerless" framing is proven on two distinct families with two distinct registers (`back_of_house`, `office_quarters`), giving Phase 11 (Premises & Atmosphere — `maintenance`, `area_atmosphere`) and Phase 14 (Periodic & Narrative — `monthly_review`) a precedent for ownerless framing. (4) Total of 11 compositional templates in `REQUIRED_CARDS` after this phase (was 8 before; +supplierReliability, +stockShortage, +debtRent).
- **Scope (delivered):**
  - **New** `specs/cards/stock_shortage.spec.yaml` — full Phase-9 spec for the narrator-voiced family. Records `voiceAxesInPlay: (none — see voiceRegister)`, `verbalTicsCovered: (none — ownerless)`, simSignalsInUse covering the four primitive shapes the pools actually use (`pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`, `severityAtLeast`), `mustNotInvent` adapted for the no-actor case ("named NPCs (the seed has no primaryActor; no character to name)"), positive exemplars for state-driven slot conditions, negative examples including direct mechanical readouts.
  - **New** `specs/cards/debt_rent.spec.yaml` — same shape, end_month timing, ledger/office register. Notes the audit pass 1 §5.3 landlord-as-systemRef decision in the spec preamble.
  - **Pre-existing** `specs/cards/supplier_reliability.spec.yaml` (from Phase 3 / ISSUE-098) is unchanged — Phase 9 emits its inline `snippetPools` block as TS files, including five Phase-3 reaction-line voice-axis snippets, eight establishing-line state-lookup snippets, six manner-note voice-axis snippets, and the seven verbal-tic reaction rungs.
  - **New** `src/cards/templates/supplierReliability.ts` (140 lines), **new** `src/cards/templates/stockShortage.ts` (104 lines), **new** `src/cards/templates/debtRent.ts` (108 lines).
  - **New** `src/cards/compose/pools/supplierReliability/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel; ~50 snippets total).
  - **New** `src/cards/compose/pools/stockShortage/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel; ~44 snippets total).
  - **New** `src/cards/compose/pools/debtRent/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel; ~44 snippets total).
  - **Deleted** `src/cards/templates/supplierOffer.ts` (legacy hand-written template).
  - **Modified** `src/cards/templates/index.ts` — swapped `supplierOfferCard` for `supplierReliabilityCard`; added `stockShortageCard` and `debtRentCard` to imports, `REQUIRED_CARDS` array, and the re-export block. 14 entries total (fallback last).
  - **Modified** `src/cards/index.ts` — public re-exports updated.
  - **New** `tests/cards/templates.supplierReliability.test.ts` — 16 integration tests covering appliesTo (positive, opportunity-type, cast-missing → fallback, registered in REQUIRED_CARDS), render output (sim-backed establishing line, low-reliability + high-reliability band selection, body never surfaces raw `reliability \d+`, title `${supplierDisplay}: ${snippet}` no-truncation + no-duplication, two-axis terse-cold snippet, choice mechanical equivalence, tags/severity flow, determinism, no-mutation), voice variance across three profiles.
  - **New** `tests/cards/templates.stockShortage.test.ts` — 17 tests with state-perturbation helpers (`withRisingPressure`, `withMemory`): appliesTo positive + non-overlap + fall-through-on-mismatched-timing, sim-backed establishing line, rising-pressure snippet selection, memory-tag snippet selection, high_demand tone-tag selection, narrator title without colon prefix, body never surfaces `low stock` / `quantity \d+`, choice mechanical equivalence, no-mutation; ownerless guarantee block: every pool free of `voiceAxis` / `verbalTic` / `actorTrait` conditions.
  - **New** `tests/cards/templates.debtRent.test.ts` — 16 tests, parallel structure: end_month timing, rising-debt + rising-landlord snippet selection, risk-memory selection, rent_due_soon tag selection, body never surfaces `debt \d+` / `landlord \d+` / `coin pile`, choice mechanical equivalence, ownerless guarantee.
  - **Modified** `tests/cards/templates.test.ts` — replaced the legacy `Template 3 — supplierOfferCard` block with `Template 3a — supplierReliabilityCard` (actor-voiced; tests against the real starter supplier), `Template 3b — stockShortageCard` (narrator-voiced; asserts title has no colon prefix, body has no raw mechanical readouts), `Template 3c — debtRentCard` (parallel to 3b with end_month timing).
  - **Modified** `tests/cards/templates.voice.test.ts` — replaced the legacy `supplierOfferCard voice` block with three new blocks. New `assertBodyBudgetOnly` helper relaxes the 6-word title cap for templates whose composed title prefixes a display name longer than the snippet budget (the legacy `assertBudget` still applies to body budgets).
  - **Modified** `tests/cards/compose/gates/samplers.ts` — added `buildSupplierReliabilityDeterminismSamples` / `buildSupplierReliabilityDiversitySampler` (actor-perturbation via `createSupplierCastAttributes`, mirroring the staff / regular patterns); added `buildStockShortageDeterminismSamples` / `buildStockShortageDiversitySampler` and `buildDebtRentDeterminismSamples` / `buildDebtRentDiversitySampler` (state-perturbation — a pre-computed table of ~12 perturbations per template covering rising pressures, prior-choice memories, tone tags, severity bands; deterministic per index). Added Phase-6 context builders for all three templates (`buildSupplierReliabilityChoiceLabelContext`, `buildSupplierReliabilityEffectPreviewContext`, `buildStockShortageChoiceLabelContext`, `buildStockShortageEffectPreviewContext`, `buildDebtRentChoiceLabelContext`, `buildDebtRentEffectPreviewContext`) with representative response-slot rotations covering each template's verb roster.
  - **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — added three new template integration blocks (supplierReliability, stockShortage, debtRent) and three new Phase-6 choice-pool blocks. For the two narrator-voiced templates, flavor-slot `minDistinct` is set lower (3 for reaction_line, 2 for manner_note) because state perturbation reaches a smaller condition surface than cast perturbation; the gate's diversity check passes cleanly at those floors and remains informative.
- **Depends on:** ISSUE-096…103 (all done). No new dependencies.
- **Loopback recorded:** None. The arc anticipated "one loop back from Phase 3 to Phases 1–2 (the spike will name a missing signal or a missing axis)" but the Phase-3 spec converged without surfacing one (see `supplier_reliability.spec.yaml:564-587` `loopback:` block with `surfaced: [none]`). Phase 9 inherits that and finds the same — Phase 1's signal surface plus the four primitives `pressureRising` / `memoryPresent` / `repeatCount` / `hasTag` / `severityAtLeast` are enough to drive every sim-backed slot across all three templates, including the two ownerless ones. Establishing-line snippets that originally gated on `severityAtLeast` or `hasTag` alone (e.g. `est_high_severity`, `est_rent_due_soon`) gained a `pressureRising` second condition to satisfy the `sim_backed_missing_lookup` rule — the sim-coherence gate only counts `pressureRising` / `memoryPresent` / `repeatCount` / `hasNamedEntity` / `signalEquals` as state-lookups, treating `severityAtLeast` and `hasTag` as seed-shape conditions.
- **Authoring tweaks during the Phase-9 pass:** (a) The Phase-3 spec snippet `rxn_warm: "Good to see you again. We'll find common ground."` matched the sim-coherence gate's `\bagain\b` unbacked-history detector — reworded in the TS pool to `"Good to see you here. We'll find common ground."` (preserves the warmth tone; drops the history claim that has no `memoryPresent` backing). The spec stays unchanged as design record; the TS pool is the authority. (b) `title_landlord_rising: "the landlord stirs again"` hit the same detector — reworded to `"the landlord stirs"`. (c) The supplier title snippets were tightened to ≤ 3 words (`'morning trade'`, `'terms to settle'`, `'an old account'`, `'a trade matter'`, `'the road calling'`) so 3-word supplier display names like "Brakka Mushroom Cart" + colon + snippet fit the legacy `assertTitleBudget` 6-word cap that `templates.test.ts` enforces.
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/templates.supplierReliability.test.ts` — 16/16.
  - `npm test -- --run tests/cards/templates.stockShortage.test.ts` — 17/17.
  - `npm test -- --run tests/cards/templates.debtRent.test.ts` — 16/16.
  - `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 17/17 (8 main template blocks + 7 Phase-6 choice-pool blocks + 2 independent-failure-attribution cases). All seven gates green for all three new templates against the actor-perturbation (supplier) and state-perturbation (stock, debt) samplers.
  - `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts` — green after the legacy → compositional substitution.
  - `npm run typecheck` — clean.
  - `npm test -- --run` — full suite **2101/2101 across 168 files** (+121 tests vs. the post-ISSUE-103 baseline of 1980/163; supplierReliability +16, stockShortage +17, debtRent +16, the three new runAllGates template blocks +3, the three new Phase-6 choice-pool blocks +3, the three replaced/added blocks in templates.test.ts and templates.voice.test.ts net out to roughly +18, plus a few smaller incidental tests). 5 new test files net of the legacy block replacement.
  - Structural: `grep -rn 'supplierOfferCard\|supplierOffer.ts' src/ tests/` returns nothing. `grep -rn "voiceAxis\|verbalTic\|actorTrait" src/cards/compose/pools/stockShortage/ src/cards/compose/pools/debtRent/` returns nothing (the ownerless guarantee is mechanical).

### ISSUE-103 — Voiced Surface Phase 8: Regulars & Complaints cluster

- **Grade:** thin
- **Status:** done
- **Phase:** 134
- **Implementation record:** Second Movement II migration of the [Voiced Surface arc](plans/voiced-surface-arc.md). Splits the legacy `customerComplaintCard` (which hand-handled both the `regular_customer / complaint` and `customer_complaint / complaint` families through one template by lifting raw textIngredients into the body) into two compositional templates partitioned by family, matching the staffBurnout → staffAside vs staffBurnout pattern Phase 7 established:
  - **`regularComplaintCard`** (new, `src/cards/templates/regularComplaint.ts`) — id `regular_customer.complaint`, attaches to `regular_customer / complaint / during_service` with a `castAttributes`-required custom predicate on the regular. Voice register `tavern_floor`. Body shape `[establishing_line (sim-backed, ≤14 words), reaction_line (flavor, ≤12), manner_note? (flavor, ≤10)]`. Six slot pools at `src/cards/compose/pools/regularComplaint/`: `title` (5 snippets — fallback + 4 voice-axis), `establishing_line` (12 — fallback + 5 single-signal + 1 single-pressure + 4 single-memory + 1 repeat + 2 two-condition top), `reaction_line` (16 — fallback + 5 single-axis + 3 two-axis + 7 verbal-tic), `manner_note` (6), `choice_label` (6 — verb-gated × voice-axis), `effect_preview` (6).
  - **`customerComplaintCard`** (rewritten in place at `src/cards/templates/customerComplaint.ts` — same path as legacy, complete rewrite) — id `customer_complaint.complaint`, attaches to `customer_complaint / complaint / during_service` with a `castAttributes`-required custom predicate on the customer-group cohort. Title resolver reads `state.customerGroups[id].label` (the legacy template's regular-only resolver was the second symptom Phase 8 kills — the cohort case rendered as "A patron"). Same body shape and six pool files at `src/cards/compose/pools/customerComplaint/`. Title snippets stay short to accommodate multi-word group labels: `title_fallback: 'a few words'`, `title_florid: 'voices low'`.
  - Cluster partition (same `regular_customer` family, different type): `relationship_test / during_service → drinkOrderCard` (mild branch, irritation ≤ 60, since Phase 123 / ISSUE-092); `complaint / during_service → regularComplaintCard` (loud branch, irritation > 60).
- **Movement I loopback (decided up-front, not after the fact):** Phase 1's signal surface (Phase 127 / ISSUE-096) carried bands for staff, faction, supplier, and area, but nothing for regulars or customer groups — even though `regular.irritation > 60` triggers a `regular_customer.complaint` seed and `group.satisfaction <= 60` triggers a `customer_complaint`. Phase 8 adds four band signals as an additive extension of the surface:
  - `regular.irritation` and `regular.loyalty` (entity kind `regular`, reading `state.world.regulars[id].irritation/loyalty`).
  - `customer_group.satisfaction` and `customer_group.loyalty` (entity kind `customer_group`, reading `state.customerGroups[id].satisfaction/loyalty`).
  - Standard three-tier `low` / `mid` / `high` scheme, default-thirds thresholds `[40, 70]`. Mechanical wiring: 4 entries each in `SignalId` (`src/sim/signals/types.ts`), `SIGNAL_ENTITY_KIND`, `BAND_THRESHOLDS` (`src/sim/signals/bands.ts`), 4 new band-reader functions in `src/sim/signals/numeric.ts`, 4 new switch arms in `src/sim/signals/query.ts`, 4 re-exports in `src/sim/signals/index.ts`. All four band readers tested at the cut-points; the dispatcher tested for kind-mismatch and missing-entity behaviour.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 8. Before this phase, `src/cards/templates/customerComplaint.ts` rendered the body as `[firstOpinion ?? sensoryDetails[0], relevantMemories[0], recentContext[0]]` — the fragment-dump pattern the arc names. Its title resolver always read `namedEntities` for a `complainant`-role regular, so the cohort case (no named regular) defaulted to "A patron" and the card lost its subject identity. The card priority of 70 also stole `regular_customer / complaint` from any future composition migration — Phase 8 keeps that priority but splits the appliesTo by family so each template owns a clean half of the surface.
- **Impact:** (1) Both legacy seed families now render through composition with sim-backed establishing lines, voiced reactions, voiced choices, and composed titles — no raw textIngredients leakage. (2) The cohort case finally centres on its own subject (`state.customerGroups[id].label`). (3) The signal surface gains four bands that future migrations (faction & culture in Phase 10, periodic beats in Phase 14, reports in Phase 15) can read. (4) Movement II's pattern of "split legacy by family / type, build per-template pool, run gates, commit" is proven again on a cluster with both an actor and a cohort.
- **Scope (delivered):**
  - **New** `specs/cards/regular_complaint.spec.yaml` — full Phase-8 spec including establishing-line pattern, voiceAxesInPlay, verbalTicsCovered, simSignalsInUse (the four new bands + pressureRising regular_customer_loss + memoryPresent for the five regular_customer seed memory tags + repeatCount), hardBounds, positive exemplars (8 mixed + 5 single-axis + 1 single-tic), negative examples (mechanical readout, dangling fragment, unsupported backstory, modern register, overlong florid, sim-backed without condition, both title forward-flags), snippet pools convergence record, mustPass criteria, loopback section naming the four band-signal additions.
  - **New** `specs/cards/customer_complaint.spec.yaml` — same shape; simSignalsInUse covers the customer-group bands + five rising-pressure arms (reputation_drift, staff_loyalty_risk, regular_customer_loss, rumour_pressure, cultural_tension) + memoryPresent (customer, complaint) + repeatCount + hasNamedEntity. Negative examples include the cohort-specific "named individual" failure mode.
  - **Modified** `src/sim/signals/types.ts`: extended `SignalId` and `SIGNAL_ENTITY_KIND` with the four new entries.
  - **Modified** `src/sim/signals/bands.ts`: extended `BAND_THRESHOLDS`.
  - **Modified** `src/sim/signals/numeric.ts`: added `regularIrritationBand`, `regularLoyaltyBand`, `customerGroupSatisfactionBand`, `customerGroupLoyaltyBand`.
  - **Modified** `src/sim/signals/query.ts`: added four switch arms.
  - **Modified** `src/sim/signals/index.ts`: re-exported the four new band readers.
  - **New** `src/cards/compose/pools/regularComplaint/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel).
  - **New** `src/cards/compose/pools/customerComplaint/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel).
  - **New** `src/cards/templates/regularComplaint.ts` — `regularComplaintTemplate` + `regularComplaintCard`.
  - **Deleted then replaced** `src/cards/templates/customerComplaint.ts` — the legacy hand-written template (`composeBody` / `composeTitle` glue) is gone; the new compositional template lives at the same path. Git diff records a complete rewrite.
  - **Modified** `src/cards/templates/index.ts` — added `regularComplaintCard` to the imports, `REQUIRED_CARDS` array, and the re-export block. The `customerComplaintCard` re-export stays, now pointing at the new compositional template.
  - **Modified** `src/cards/index.ts` — re-exports `regularComplaintCard` alongside the existing `customerComplaintCard` re-export.
  - **New** `tests/cards/templates.regularComplaint.test.ts` — 17 integration tests covering appliesTo (positive, no-overlap with drinkOrder, no-overlap with customerComplaint, cast-missing → fallback), render output (body[0] sim-backed, body[1] voiced reaction, never-leak-textIngredients, title no-truncation + no-duplication, fallback, sim-backed snippet for high irritation, two-axis snippet, choice mechanical equivalence, tags/severity flow, determinism, no-mutation), voice variance across three profiles.
  - **New** `tests/cards/templates.customerComplaint.test.ts` — 16 integration tests mirroring the regular-complaint shape but centred on a customer-group cohort actor.
  - **Modified** `tests/cards/templates.test.ts` — replaced the legacy `Template 2 — customerComplaintCard` block with `Template 2a — customerComplaintCard (cohort case)` + `Template 2b — regularComplaintCard (named-regular case)`. The 2b block picks a 1-word starter regular (`Hodd` / `Gurrok`) by filtering so the legacy `assertTitleBudget` (≤6 words) holds against the composed `${display}: ${snippet}` title.
  - **Modified** `tests/cards/templates.voice.test.ts` — replaced the legacy `customerComplaintCard voice` block with two new blocks, one per template.
  - **Modified** `tests/cards/templates.drinkOrder.test.ts` — the "does not steal the complaint variant" assertion now points at `regularComplaintCard` instead of `customerComplaintCard`, because `regular_customer / complaint` now routes to the new compositional template.
  - **Modified** `tests/cards/compose/gates/samplers.ts` — added `buildRegularComplaintDeterminismSamples` / `buildRegularComplaintDiversitySampler` / `buildCustomerComplaintDeterminismSamples` / `buildCustomerComplaintDiversitySampler` plus Phase-6 context builders (`buildRegularComplaintChoiceLabelContext`, `buildRegularComplaintEffectPreviewContext`, `buildCustomerComplaintChoiceLabelContext`, `buildCustomerComplaintEffectPreviewContext`). Each cohort context builder rotates a 5-slot verb roster (appease, discount, ignore, ban, blame for regular; discount, appease, blame, rebrand, clean for customer group) so the verb-gated rungs in the pools can fire across the perturbed cast distribution.
  - **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — added two new template integration blocks (regularComplaint, customerComplaint) and two new Phase-6 ad-hoc choice-pool blocks. All seven gates green for both new templates against the perturbed regular / customer-group cast distribution.
  - **Modified** `tests/sim/phase127.signals.numeric.test.ts` — added boundary tests for the four new band readers + dispatcher tests for `regular.irritation`, `regular.loyalty`, `customer_group.satisfaction`, `customer_group.loyalty`. SignalId enumeration extended to include the four new ids.
- **Depends on:** ISSUE-096…102 (all done). No new dependencies.
- **Loopback recorded:** Four new band signals (`regular.irritation`, `regular.loyalty`, `customer_group.satisfaction`, `customer_group.loyalty`) added to Phase 1's signal surface as a Movement-II→Movement-I loopback. Decided up-front during Phase 8 planning rather than after the fact; the arc anticipates this kind of additive surface growth and the bands unlock the establishing line's single-signal middle rung for both new templates. No new voice axis or verbal tic was needed.
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/templates.regularComplaint.test.ts` — 17/17.
  - `npm test -- --run tests/cards/templates.customerComplaint.test.ts` — 16/16.
  - `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 11/11 (5 main template blocks + 4 Phase-6 choice-pool blocks + 2 independent-failure-attribution cases). All seven gates green for `regularComplaintTemplate` and `customerComplaintTemplate`.
  - `npm test -- --run tests/sim/phase127.signals.numeric.test.ts` — 25/25 (12 existing + 13 new covering the four new bands and dispatcher cases).
  - `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts tests/cards/templates.drinkOrder.test.ts` — green after the legacy → compositional substitution.
  - `npm run typecheck` — clean.
  - `npm test -- --run` — full suite green.
  - Structural: `grep -rn 'composeBody\|composeTitle' src/cards/templates/customerComplaint.ts src/cards/templates/regularComplaint.ts` returns nothing.

### ISSUE-102 — Voiced Surface Phase 7: Staff & Personnel cluster (first Movement II migration)

- **Grade:** thin
- **Status:** done
- **Phase:** 133
- **Implementation record:** The Staff & Personnel cluster ships two compositional templates that partition the staff seed surface cleanly:
  - **`staffAsideCard`** (extended, `src/cards/templates/staffAside.ts`) — gains a new `establishing_line` slot (`role: 'utterance'`, `wordBudget: 14`, `claimMode: 'sim_backed'`, required) authored at `src/cards/compose/pools/staffAside/establishingLine.ts` (11 snippets: 1 fallback + 8 single-condition middle-rung + 2 two-condition top-rung). The body now reads `[establishing_line, aside_line, manner_note?]`; the previous `seed.textIngredients.sensoryDetails[0] ?? recentContext[0] ?? socialContext[0]` grounding-fragment fallback in `buildStaffAsideBody` is gone — that was the "dangling fragment" the arc identified as the symptom this migration kills.
  - **`staffBurnoutCard`** (new, `src/cards/templates/staffBurnout.ts`) — template id `staff_burnout.staff_request`, attaches to `staff_burnout / staff_request / morning_prep` with the same staff-castAttributes `custom` predicate the staffAside uses. Voice register `staff_quarters` (shared with staffAside). Six slot pools at `src/cards/compose/pools/staffBurnout/`: `title` (5 snippets), `establishing_line` (12 snippets, sim-backed), `reaction_line` (16 snippets — fallback + 5 single-axis + 3 two-axis + 7 tic), `manner_note` (6 snippets), `choice_label` (6 snippets — verb-gated × voice-axis), `effect_preview` (6 snippets — kind/tag-gated × voice-axis). The body shape is `[establishing_line, reaction_line, manner_note?]` — three composed slots, three voiced lines, no raw textIngredients leakage. `composeChoicesFromSeed` carries the voiced choices.
  - **Legacy `staffRequest.ts` deleted** along with its imports from `src/cards/templates/index.ts`, `src/cards/index.ts`, the "Template 5 — staffRequestCard" block in `tests/cards/templates.test.ts`, and the `staffRequestCard voice` block in `tests/cards/templates.voice.test.ts`. Both test blocks are replaced with `staffBurnoutCard` equivalents. The `staffSeed` test helper's `timing: 'closing'` is corrected to `morning_prep` (the legacy template's `closing` timing never matched the real generator output — `issueSeedGenerators.ts:1153` emits `morning_prep`, so the legacy template was dead code in production all along).
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 7. The legacy `staffRequest` template hand-glued a meter line (`morale ${m}, stress ${s}`), an actor opinion, and a context fragment through the legacy `composeBody` — no voice, no sim-backed claims, no specificity gradient — and additionally pinned the wrong timing so it never matched any real seed. The staffAside body's grounding-fragment fallback was the arc's named "dangling fragment" (`staffAside.ts:151-155` in the pre-Phase-7 file).
- **Impact:** (1) Staff cards now state what the sim says (stress band, fatigue band, rising staff_burnout / staff_loyalty_risk pressure, prior bonus / workload / risk / identity / warning memory, repeat-count) and voice it (4 axes + 7 tics). (2) The legacy template's never-fired situation is now actually handled by a working compositional card. (3) The migration pattern for Movement II phases 8–14 is proven on the first cluster: new spec → author pools in-repo → run runAllGates + per-situation tests to green → delete legacy → commit. The Phase 4 authoring loop in Appendix A works end-to-end without an API pipeline.
- **Scope (delivered):**
  - **New** `specs/cards/staff_burnout.spec.yaml` — full Phase-7 spec including establishing-line pattern, voiceAxesInPlay, verbalTicsCovered, simSignalsInUse, hardBounds, positive exemplars, negative examples (including the legacy template's meter-line shape as a negative), snippet pools convergence record, mustPass criteria, loopback section.
  - **Edited** `specs/cards/staff_aside.spec.yaml` — added `simSignalsInUse` block, new `establishing_line` slot block (claims: sim-backed, maxWords: 14), new snippet pool entry, expanded `mustPass.simCoherence` / `voiceBounds` / `diversity` / new `dedupe` rules, loopback section recording no Phase-1 gaps surfaced. Status bumped to `phase_7_voiced_surface_arc_complete`.
  - **New** `src/cards/compose/pools/staffAside/establishingLine.ts` (11 snippets, sim-backed). **Edited** `src/cards/compose/pools/staffAside/index.ts` to re-export it.
  - **Edited** `src/cards/templates/staffAside.ts` — added the `establishing_line` slot, rewrote `buildStaffAsideBody` to compose `[establishing_line, aside_line, manner_note]` without the textIngredients grounding fragment. Updated header comments to reference Phase 7.
  - **New** `src/cards/templates/staffBurnout.ts` — `staffBurnoutTemplate` + `staffBurnoutCard` (the `defineCompositionalCard` wrapper).
  - **New** `src/cards/compose/pools/staffBurnout/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + index).
  - **Edited** `src/cards/templates/index.ts` — swapped `staffRequestCard` for `staffBurnoutCard` in import, REQUIRED_CARDS array, and the re-export block.
  - **Edited** `src/cards/index.ts` — swapped `staffRequestCard` for `staffBurnoutCard` in the public re-export.
  - **Deleted** `src/cards/templates/staffRequest.ts`.
  - **New** `tests/cards/templates.staffBurnout.test.ts` — 15 integration tests mirroring `tests/cards/templates.staffAside.test.ts` (appliesTo positive + negative + cast-missing + non-overlap with staffAside; render output covering body[0] sim-backed, body[1] voiced reaction, never-leak-textIngredients, title no-truncation + no-duplication, fallback behaviour, two-axis snippet selection, choice mechanical equivalence, tags/severity flow, determinism, no-mutation; voice variance across three profiles).
  - **Edited** `tests/cards/templates.staffAside.test.ts` — body[0] / body[1] assertions reflect the new establishing-line-first body shape; added "never raw fragment" regression test; voice-variance test now checks body[1] (the voiced aside) rather than body[0] (the sim-backed establishing line); updated fallback / two-axis / tic assertions for the body shift.
  - **Edited** `tests/cards/templates.test.ts` — Template 5 block migrates from `staffRequestCard` to `staffBurnoutCard`; `staffSeed` helper's timing corrected from `closing` to `morning_prep`.
  - **Edited** `tests/cards/templates.voice.test.ts` — staffRequestCard voice block migrates to staffBurnoutCard, timing corrected.
  - **Edited** `tests/cards/compose/gates/runAllGates.test.ts` — staffAsideTemplate block adds `establishing_line` to its diversity config (`minDistinct: 1` — voice perturbation doesn't vary signal state); new staffBurnoutTemplate block exercises every gate against the new template with the new samplers.
  - **Edited** `tests/cards/compose/gates/samplers.ts` — new `buildStaffBurnoutDeterminismSamples` and `buildStaffBurnoutDiversitySampler` (mirror the staffAside equivalents; seed factory targets the staff_burnout / staff_request / morning_prep slice).
  - **New tracker row** (ISSUE-102, phase 133, status `done`).
- **Depends on:** ISSUE-096…101 (all done). No new dependencies.
- **Loopback recorded:** None. The Phase 7 authoring pass did not need any new signal, axis, or condition primitive. The signal-surface gaps the Phase-1 plan flagged as Phase-7 candidates (blame-mode, burnout-band) turned out unnecessary: staff_aside speaks to staff_identity (where blame-mode lives in `socialContext`, not as a queryable signal — and the voiced establishing line doesn't need to assert blame-mode-specific facts), and staff_burnout already exposes a `pressureRising staff_burnout` condition that covers the rising-meter case the burnout-band signal would have served. Revisit in Phase 10 (factions & culture) if blame-mode becomes load-bearing.
- **Bootstrap fixes folded in (PR #108 regressions):** The first clean-baseline run after this branch was cut surfaced three things broken since PR #108: (a) no `node_modules/` in fresh web sessions — fixed via new `.claude/settings.json` + `.claude/hooks/session-start.sh` SessionStart hook that runs `npm install --no-audit --no-fund` (gated on `CLAUDE_CODE_REMOTE`); (b) typecheck error in `tests/cards/compose/phase132.responseConditions.test.ts` where `seedFamily.anyOf` got passed `string[]` because `IssueSeed.family` is typed `IssueSeedFamilyId | string` — fixed via cast; (c) `web/src/lib/cards/CardRenderer.svelte` keyed `{#each}` blocks used the rendered string as the key, which Svelte 5 rejects when Phase-6 composed previews legitimately produce the same text twice — fixed by switching both body and previewEffects keys to the iteration index. All three landed in the same prep commit as the SessionStart hook (commit `395d883`).
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/templates.staffBurnout.test.ts` — 15 new tests pass.
  - `npm test -- --run tests/cards/templates.staffAside.test.ts` — 15 tests pass (14 existing assertions updated for the new body shape + 1 new "never raw fragment" regression test).
  - `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 7 tests pass (drinkOrder + staffAside + staffAside-choice-pools + drinkOrder-choice-pools + bad-template + staffBurnout NEW). All seven gates (coverage, specificity, voiceBounds, simCoherence, determinism, diversity, dedupe) green for both real compositional staff templates.
  - `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts` — green; staffBurnoutCard substituted for staffRequestCard in both files without churn elsewhere.
  - `npm run typecheck` — clean.
  - `npm test -- --run` — full suite **1980/1980 across 163 files** (+17 tests vs. the post-bootstrap baseline of 1963/162; the new test file adds 15, the new gate block adds 1, the new staffAside regression test adds 1).

### ISSUE-101 — Voiced Surface Phase 6: choice & consequence voice (composed choice labels + effect previews)

- **Grade:** thin
- **Status:** done
- **Phase:** 132
- **Implementation record:** `drinkOrderCard` and `staffAsideCard` now compose their `CardChoice.label` and per-effect `CardChoice.previewEffects` through the snippet pipeline. A new helper `composeChoicesFromSeed(seed, state, { labelPool, previewPool, maxPreview })` lives in `src/cards/cardHelpers.ts`; per response slot it builds two synthetic `SlotSpec`s (`choice_label::${slot.id}` and `effect_preview::${slot.id}::${idx}`, both `optional: true`, `claimMode: 'flavor'`) and calls `pickSnippet` with a `ConditionContext { currentResponseSlot, currentEffect }`. Pool misses fall through to the sim's verbatim `slot.labelHint` / `effect.readable` — never an invented string. `buildChoice` gains two strictly-optional `ChoiceOverrides` fields (`label`, `previewEffects`); the six legacy templates keep calling `buildChoicesFromSeed` unchanged. Four new condition primitives land in `src/cards/compose/types.ts` and `src/cards/compose/conditions.ts`: `responseVerb { anyOf: ResponseIntentVerb[] }`, `responseShape { anyOf: ResponseIntentShape[] }`, `effectKind { anyOf: EffectKind[] }`, `effectTag { tag: string }`. All four return `false` when their required `ctx` field is absent — body / title slot evaluation passes no context and continues to behave identically. `evalCondition`, `pickSnippet`, and `assembleSlots` thread an optional `ctx: ConditionContext = {}` through; the 14 existing arms are unchanged. New pools at `src/cards/compose/pools/drinkOrder/{choiceLabel,effectPreview}.ts` and `src/cards/compose/pools/staffAside/{choiceLabel,effectPreview}.ts` each ship 6 snippets covering verb-gated (appease / ignore) × voice-axis (terseness / warmth / formality / floridity) combinations. The diversity gate (`src/cards/compose/gates/diversity.ts`) gains an optional `pickContext?: (sample, i) => ConditionContext` config field so the gate can exercise the new primitives; existing call sites are backward-compatible (omit the field, behaviour unchanged). The sim-coherence guarantee for previews holds **structurally**: each composed line corresponds 1-to-1 to a real `EffectPreview` because the helper iterates `profile.immediateEffects` per choice, so the snippet only ever replaces the readable string. The backing `(kind, target, amount, tags)` survives unchanged into `simulateDay`. Both specs (`specs/cards/drink_order.spec.yaml`, `specs/cards/staff_aside.spec.yaml`) gain `choice_label` and `effect_preview` slot entries as design records.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 6. Before this phase, `buildChoice` in `src/cards/cardHelpers.ts` lifted `label = slot.labelHint` and `previewEffects = profile.immediateEffects.map(e => e.readable)` straight from the seed, so the same regular said *"Smooth it over"* / *"Let it ride"* regardless of who they were — that was the entire "responses feel non-contextual" half of the arc-opening complaint.
- **Impact:** (1) Choice labels and effect-preview lines on the two compositional templates now read in the actor's voice. A warm regular's `appease` choice surfaces "Pour them one on the house" instead of the bare `labelHint`. (2) Mechanical truth survives: a new test (`tests/cards/templates.phase132.mechanicalEquivalence.test.ts`) renders both templates under a warm-formal cast and asserts `verb`, `shape`, `targetId`, `slotId`, and `previewEffects.length` match a baseline computed directly from the seed; identical re-render under the same `(seed, state)` is also asserted. (3) The migration pattern Movement II (phases 7–13) needs is now proven on two templates and two domains.
- **Scope (delivered):**
  - **Edited** `src/cards/compose/types.ts`: added four new condition kinds to `SnippetCondition`; exported `ConditionContext { currentResponseSlot?, currentEffect? }`.
  - **Edited** `src/cards/compose/conditions.ts`: added optional `ctx` parameter to `evalCondition`; added four new switch arms each returning `false` when context is missing.
  - **Edited** `src/cards/compose/assemble.ts`: `pickSnippet` and `assembleSlots` thread optional `ctx: ConditionContext = {}` through. Existing call sites unchanged.
  - **Edited** `src/cards/cardHelpers.ts`: added `label?` and `previewEffects?` to `ChoiceOverrides`; `buildChoice` honours them with `??` fallbacks. Added `composeChoicesFromSeed(seed, state, options)` and exported `ComposeChoicesOptions`.
  - **New** `src/cards/compose/pools/drinkOrder/choiceLabel.ts` (6 snippets) and `effectPreview.ts` (6 snippets).
  - **New** `src/cards/compose/pools/staffAside/choiceLabel.ts` (6 snippets) and `effectPreview.ts` (6 snippets).
  - **Edited** `src/cards/compose/pools/drinkOrder/index.ts` and `src/cards/compose/pools/staffAside/index.ts`: re-export the four new pools.
  - **Edited** `src/cards/templates/drinkOrder.ts` and `src/cards/templates/staffAside.ts`: swap `buildChoicesFromSeed` for `composeChoicesFromSeed` with the new pools.
  - **Edited** `src/cards/compose/gates/diversity.ts`: added optional `pickContext?: (sample, i) => ConditionContext` to `DiversityConfig`; threads through to `pickSnippet`.
  - **Edited** `tests/cards/compose/gates/samplers.ts`: added four Phase-6 context builders (`buildDrinkOrderChoiceLabelContext`, `buildDrinkOrderEffectPreviewContext`, `buildStaffAsideChoiceLabelContext`, `buildStaffAsideEffectPreviewContext`) with representative response-slot and effect-preview rotations.
  - **Edited** `tests/cards/compose/gates/runAllGates.test.ts`: added two new `describe` blocks driving ad-hoc gate-only templates for each compositional card's choice-label and effect-preview pools through `runAllGates`; each pool passes coverage, specificity, voiceBounds, simCoherence, dedupe, and a `sampleSize: 100, minDistinct: 3` diversity check.
  - **New** `tests/cards/compose/phase132.responseConditions.test.ts`: 13 unit tests covering positive, negative, and "no-context" cases for each of the four new condition arms, plus a spot-check that a representative existing arm (`seedFamily`) is unaffected by ctx.
  - **New** `tests/cards/templates.phase132.mechanicalEquivalence.test.ts`: 6 integration tests across both templates asserting `verb`/`shape`/`targetId`/`slotId`/preview-length match a seed-derived baseline; identical re-render under same `(seed, state)`; and "a warm-formal cast voices at least one choice label or preview line".
  - **Edited** `specs/cards/drink_order.spec.yaml` and `specs/cards/staff_aside.spec.yaml`: added `choice_label` and `effect_preview` slot entries as design records.
- **Depends on:** ISSUE-096…100 (all done). No new dependencies.
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/compose/phase132.responseConditions.test.ts` — 13 tests pass.
  - `npm test -- --run tests/cards/templates.phase132.mechanicalEquivalence.test.ts` — 6 tests pass.
  - `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 6 tests pass (4 existing + 2 new). The two new Phase-6 cases drive both templates' choice-label and effect-preview pools through every applicable gate.
  - `npm test -- --run tests/cards/templates.drinkOrder.test.ts tests/cards/templates.staffAside.test.ts` — 27 tests pass; the existing template-integration assertions are unaffected.
  - `npm run typecheck` — clean.
  - `npm test -- --run` — full suite green.

### ISSUE-100 — Voiced Surface Phase 5: title & frame discipline (title becomes a composed slot)

- **Grade:** thin
- **Status:** done
- **Phase:** 131
- **Implementation record:** The two compositional templates now carry
  a composed `title` `SlotSpec` with `wordBudget: 6` and
  `claimMode: 'flavor'`. New per-template title pools at
  `src/cards/compose/pools/drinkOrder/title.ts` and
  `src/cards/compose/pools/staffAside/title.ts` each ship one
  unconditional fallback plus four voice-axis-conditioned rungs (terse,
  warm, formal, florid), all ≤ 6 words. Template glue
  (`buildDrinkOrderTitle`, `buildStaffAsideTitle`) reads `filled['title']`
  and prepends the actor display as `${display}: ${snippet}` — no
  clamping, no trailing "…", no length cap on the assembled title.
  Imports of `formatTitle` were dropped from the two templates;
  `formatTitle` / `composeTitle` themselves remain alive (and
  unreferenced by these templates) for the nine still-legacy templates
  until each is migrated in Movement II.
  `src/cards/compose/gates/voiceBounds.ts` extended with two new
  failure reasons (`trailing_ellipsis`, `duplicate_token`) scoped to
  slots whose advisory role is `'title'` — body-slot snippets like the
  `trails_off` verbal-tic line on `aside_line` ("…well, you know…")
  keep their authored ellipsis untouched. New
  `VOICE_BOUNDS_REASONS` frozen tuple exported through
  `src/cards/compose/gates/index.ts` so tests match by name not by
  literal. `tests/cards/compose/gates/runAllGates.test.ts` extended to
  include the new `title` slot in the per-template diversity config
  (sampleSize 100, minDistinct 3 against the real
  `[-1,0,0,1]`-perturbed distribution). Per-template integration tests
  in `tests/cards/templates.drinkOrder.test.ts` and
  `tests/cards/templates.staffAside.test.ts` now assert the rendered
  title contains the actor's first display word, contains no `"…"` /
  `"..."`, and is deterministic per seed.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 5. Today
  `src/cards/voice/composer.ts` (`composeTitle`) and
  `src/cards/cardHelpers.ts` (`formatTitle`) both call
  `clampWords(s, 6)` which appends `"…"` whenever the join overshoots
  six words. The Voiced Surface arc names the two visible symptoms:
  titles truncating mid-phrase (`…a word before…`) and label/subject
  duplication (`Main Room: Main Room`). The doc prescribes a composed
  title slot per template and a voice-bounds gate check that fails on
  a trailing `"…"` or an immediate duplicated token in a title.
- **Impact:** (1) The two compositional templates' titles are no
  longer subject to ellipsis-clamping — actor identification survives
  in full even for long display names, and the situational phrase is
  authored to fit rather than truncated. (2) The voice-bounds gate
  now structurally rejects the two title symptoms before a pool ships;
  Movement II migration phases inherit the gate unchanged. (3) The
  Phase-A `trails_off` verbal-tic snippet on `aside_line` keeps its
  authored "…" because the new checks are title-slot-scoped — body
  prose retains its character flourishes. (4) The new title pools
  introduce voice-axis-conditioned variants alongside the fallback,
  so titles read differently for terse/warm/formal/florid actors
  rather than identically across the cast.
- **Scope (delivered):**
  - **Edited** `src/cards/compose/gates/voiceBounds.ts`: added
    `VOICE_BOUNDS_REASONS` frozen tuple
    (`overBudget`/`trailingEllipsis`/`duplicateToken`); extended
    `checkVoiceBounds` with title-slot-scoped checks against
    `/(?:…|\.{3,})\s*$/` and `/\b(\w+)\s+\1\b/i` (case-insensitive).
    Scope condition is `slot.role === 'title'` so body slots keep
    their existing latitude.
  - **Edited** `src/cards/compose/gates/index.ts`: exports the new
    `VOICE_BOUNDS_REASONS` constant.
  - **New** `src/cards/compose/pools/drinkOrder/title.ts`:
    `titlePool` with 5 snippets — fallback `'orders a drink'` plus
    terse / warm / formal / florid voice-axis variants, all ≤ 6 words.
  - **New** `src/cards/compose/pools/staffAside/title.ts`: same
    shape, fallback `'a word before opening'` plus 4 voice-axis
    variants, all ≤ 6 words; voice register `staff_quarters`.
  - **Edited** `src/cards/compose/pools/drinkOrder/index.ts` and
    `src/cards/compose/pools/staffAside/index.ts`: re-export the
    new title pools as `drinkOrderTitlePool` /
    `staffAsideTitlePool`.
  - **Edited** `src/cards/templates/drinkOrder.ts` and
    `src/cards/templates/staffAside.ts`: dropped the `formatTitle`
    import; added a `title` slot to `slots[]` (id `'title'`, role
    `'title'`, `wordBudget: 6`, `claimMode: 'flavor'`); rewrote the
    title-builder to take `filled` and return
    `${display}: ${filled['title'] ?? <pool fallback>}` with no
    clamping.
  - **Edited** `tests/cards/compose/gates/voiceBounds.test.ts`: 5 new
    cases — trailing `"…"` rejection, trailing `"..."` (three ASCII
    dots) rejection, immediate duplicate token rejection,
    case-insensitive duplicate detection ("Main Main Room"), and a
    real-template clean-text assertion confirming the two existing
    templates carry no offenders.
  - **Edited** `tests/cards/compose/gates/runAllGates.test.ts`: added
    the new `title` slot to both per-template diversity configs
    (sampleSize 100, minDistinct 3 against the same actor populations
    that drive `order_line` / `aside_line`).
  - **Edited** `tests/cards/templates.drinkOrder.test.ts` and
    `tests/cards/templates.staffAside.test.ts`: the "title centres on
    the named X" cases now assert the title contains no `"…"` /
    `"..."` in place of the old `wordCount(title.replace('…',
    '')) <= 6` check (long display names are allowed to extend the
    title rather than truncate). Added a compositional determinism
    check.
- **Depends on:** None hard within the Voiced Surface arc; Movement I
  Phases 1–4 (ISSUE-096…099) supply the signal surface, universal
  cast, supplier-reliability spec, and authoring-loop machinery that
  every following migration relies on. Phase 5 is cross-cutting
  setup that lands before Movement II.
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/compose/gates/voiceBounds.test.ts`
    — 11 tests, all pass. Covers the original budget checks and the
    five new title-symptom cases.
  - `npm test -- --run tests/cards/compose/gates/` — 8 test files,
    51 tests pass. The composite `runAllGates` clears both
    `drinkOrderTemplate` and `staffAsideTemplate` against all seven
    gates with the new `title` slot diversity check in place.
  - `npm test -- --run tests/cards/templates.drinkOrder.test.ts
    tests/cards/templates.staffAside.test.ts
    tests/cards/templates.voice.test.ts
    tests/cards/voice/composer.test.ts` — 66 tests pass. The legacy
    composer's title path remains exactly as before for the nine
    unmigrated templates.
  - `npm run typecheck` — clean.
  - `npm test -- --run` — full suite 1942/1942 across 160 files.

### ISSUE-099 — Voiced Surface Phase 4: retire the build-time API pipeline; document the Claude Code authoring loop

- **Grade:** tech-debt
- **Status:** done
- **Phase:** 130
- **Implementation record:** Deleted `scripts/generate-pool/` (14 files),
  `.github/workflows/generate-pool.yml`, and `tests/cards/compose/pipeline/`
  (8 files). Removed `@anthropic-ai/sdk`, `yaml`, and `tsx` from
  `package.json`; removed the `generate-pool` npm script; regenerated
  `package-lock.json`. New gate library files
  `src/cards/compose/gates/levenshtein.ts` and
  `src/cards/compose/gates/dedupe.ts` (lifted + trimmed from the retired
  pipeline modules) provide `checkDedupe(template, config?)` returning a
  `GateReport` with the same 0.85 within-slot Levenshtein-on-canonical
  + canonical-equality cross-slot semantics the pipeline enforced.
  Wired into `runAllGates` as the seventh gate; exported from
  `src/cards/compose/gates/index.ts`. New
  `tests/cards/compose/gates/dedupe.test.ts` (10 tests) carries forward
  the regression-net role of the retired pipeline test against both
  committed templates. Standing authoring-loop recipe added as
  Appendix A in `docs/plans/voiced-surface-arc.md`.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 4 prescribes
  retirement of the Phase-125 build-time pipeline in favour of an
  in-repo Claude Code plan-mode authoring loop, with the structural
  guarantees that lived outside the gates (dedupe @ 0.85, specificity-
  sorted emit) folded into the gate/test suite. Phase 3
  (`supplier_reliability.spec.yaml`) shipped with new top-level keys
  (`appliesTo`, `simSignalsInUse`, `loopback`) that the strict Zod
  `GenerationSpecSchema` in `scripts/generate-pool/loadSpec.ts` rejects
  — Codex flagged this as P1 ("Keep supplier spec parseable by
  generate-pool schema") on the Phase-3 PR, and `npm run generate-pool
  -- --spec specs/cards/supplier_reliability.spec.yaml --dry-run` exits
  with validation errors. The arc's locked correction is that the
  pipeline retires; the Codex P1 is therefore resolved by removal of
  the strict schema rather than by extending it.
- **Impact:** Two-fold. (1) Pipeline retirement: no Anthropic SDK
  dependency in the project tree; no `ANTHROPIC_API_KEY` referenced
  anywhere in `.github/workflows/` or `scripts/`; no
  `workflow_dispatch` build-time API call. Every snippet pool from
  Phase 4 onward is hand-authored in-repo through the
  `runAllGates`-gated authoring loop. (2) Codex P1 resolved: the
  supplier spec's `appliesTo` / `simSignalsInUse` / `loopback` keys are
  now legitimate because the strict schema is gone; specs are design
  artifacts the agent reads, not Zod-validated data.
- **Scope (delivered):**
  - **Deleted** `scripts/generate-pool/` (cli.ts, buildPrompt.ts,
    callModel.ts, parseModelOutput.ts, loadSpec.ts, specSchema.ts,
    runGates.ts, retryLoop.ts, dedupe.ts, levenshtein.ts, emitPool.ts,
    writePoolFiles.ts, index.ts, types.ts) and
    `.github/workflows/generate-pool.yml`.
  - **Deleted** `tests/cards/compose/pipeline/` (buildPrompt.test.ts,
    parseModelOutput.test.ts, loadSpec.test.ts, retryLoop.test.ts,
    integration.test.ts, emitPool.test.ts, runGates.test.ts,
    dedupe.test.ts — the last one's role moves to `gates/dedupe.test.ts`).
  - **Lifted** `scripts/generate-pool/levenshtein.ts` →
    `src/cards/compose/gates/levenshtein.ts` (verbatim DP
    implementation + `normalisedSimilarity`).
  - **Lifted + trimmed** `scripts/generate-pool/dedupe.ts` →
    `src/cards/compose/gates/dedupe.ts`: kept `canonicaliseText`,
    `DEFAULT_DEDUPE_THRESHOLD = 0.85`, within-slot pair-wise
    similarity check, and cross-slot canonical-equality check;
    dropped the `DedupeRejection` shape, keeper resolution, and the
    retry-feedback fields (all retry-loop machinery, irrelevant to a
    structural gate). New entry point
    `checkDedupe(template, config?): GateReport`.
  - **Edited** `src/cards/compose/gates/runAllGates.ts`: added
    `dedupe: GateReport` to `AllGatesReport` and `dedupe?: DedupeConfig`
    to `AllGatesConfig`; composite `pass` includes `dedupe.pass`.
  - **Edited** `src/cards/compose/gates/index.ts`: exports
    `checkDedupe`, `canonicaliseText`, `DEFAULT_DEDUPE_THRESHOLD`,
    `DedupeConfig`, `levenshtein`, `normalisedSimilarity`.
  - **New** `tests/cards/compose/gates/dedupe.test.ts` (10 tests):
    regression net asserting `drinkOrderTemplate` and
    `staffAsideTemplate` clear the dedupe gate; pair-wise audit of the
    committed `orderLinePool` (17 snippets) and `mannerNotePool`; six
    sharpness tests planting near-duplicates, cross-slot canonical
    duplicates, and a cross-slot near-dup negative case; a
    `canonicaliseText` utility test.
  - **Edited** `package.json`: removed `generate-pool` script; removed
    devDep `tsx`; removed deps `@anthropic-ai/sdk` and `yaml`.
    `package-lock.json` regenerated; `npm audit` confirms zero
    references to the dropped packages.
  - **Edited** `docs/plans/voiced-surface-arc.md`: added Appendix A —
    "The Claude Code authoring loop" — the standing prompt, the
    gate-to-green checklist (per-gate failure-mode table), the
    iterate-on-violation recipe, commit hygiene, and an explicit
    inventory of what does and does not survive retirement.
  - **Edited** `CLAUDE.md`: appended a Phase 130 status callout;
    annotated the Phase 125 paragraph as "done; retired in Phase 130."
  - **Specs preserved** under `specs/cards/` (`drink_order`,
    `staff_aside`, `supplier_reliability`) — design artifacts the
    authoring loop reads. No Zod gate over their shape.
- **Codex P1 resolution callout:** The Codex comment on
  `specs/cards/supplier_reliability.spec.yaml` lines +34..+37 asked us
  to keep the spec parseable by `GenerationSpecSchema`. We considered
  extending the schema to accept `appliesTo` / `simSignalsInUse` /
  `loopback`, and rejected that alternative — the Voiced Surface arc's
  first locked correction explicitly retires the pipeline that owns
  the schema. The right resolution is to delete the schema with the
  loader. After this issue lands, no machinery in the repo validates
  spec YAML against a fixed shape; the supplier spec's new keys are
  legitimate by removal.
- **Depends on:** None hard. ISSUE-094 (Phase 125) is the pipeline this
  retires; ISSUE-095 (Phase 126) wrote the staff_aside pool by hand
  already, proving the in-repo authoring path is viable.
- **Test approach (delivered):**
  - `npm test -- --run tests/cards/compose/gates/` — 8 test files,
    46 tests pass, including the new `dedupe.test.ts` (10) and the
    existing `runAllGates.test.ts` (4) which now exercises the
    seven-gate composite report against the live `drinkOrderTemplate`
    and `staffAsideTemplate`.
  - `npm test -- --run` — full suite green at 1935 tests across 160
    test files (baseline 1968/167 minus the 43 deleted pipeline tests
    plus the 10 new dedupe tests; net −33 tests, −7 files).
  - `npm run typecheck` — clean.
  - Orphan check: `grep -rn "scripts/generate-pool\|@anthropic-ai/sdk\|
    from 'yaml'" src/ web/ tests/ scripts/ .github/` returns only two
    historical comments inside the new `levenshtein.ts` and `dedupe.ts`
    that name where the code was lifted from.

### ISSUE-098 — Voiced Surface Phase 3: establishing-line spike (supplier_reliability spec)

- **Grade:** thin
- **Status:** done
- **Phase:** 129
- **Implementation record:** `specs/cards/supplier_reliability.spec.yaml`
  (the converged spec is itself the artifact; Phase 3 is authoring, not
  code).
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 3 names this as
  "the Establishing-Line Spike" — converge one sim-backed situation
  (supplier reliability is named as the cleanest) the way Living Cast
  Phase B converged the flavor-only `drink_order` slot. The arc doc
  explicitly framed Phase 3 as authorial hand-iteration "with me, like
  Living Cast Phase B"; the user chose to have it written instead. The
  deliverable shape is unchanged — one YAML spec at
  `specs/cards/supplier_reliability.spec.yaml` matching the format of
  `specs/cards/drink_order.spec.yaml` and `specs/cards/staff_aside.spec.yaml`.
- **Impact:** Phase 3 settles the open questions Phases 1–2 left for the
  arc to discover: which Phase-1 signals a sim-backed slot actually
  reaches for, and which Phase-2 voice axes a supplier exercises. The
  arc doc anticipated "one loop back from Phase 3 to Phases 1–2 (the
  spike will name a missing signal or a missing axis)" — the
  convergence pass surfaced **no missing signal or axis**; the 8
  shipped band signals + 11 framework condition primitives + 4 voice
  axes + 7 verbal tics are sufficient. Decision recorded in the spec's
  `loopback` section. Phase 9 / ISSUE-104 (Suppliers, Stock & Debt
  cluster) inherits this spec unchanged.
- **Scope (delivered):**
  - **New file:** `specs/cards/supplier_reliability.spec.yaml` — the
    converged spec. ~430 lines mirroring the structure of the two
    shipped specs.
    - Three slots: `establishing_line` (sim-backed, 14-word budget),
      `reaction_line` (flavor, 12-word budget), `manner_note` (flavor,
      optional, 10-word budget). The 14-word establishing budget vs.
      the framework's default 12 is explicit in the slot's `maxWords`;
      `SlotSpec.wordBudget` already supports per-slot overrides.
    - New voice register `trade_floor` — supplier-led, owner-facing,
      distinct from `tavern_floor` (customer) and `staff_quarters`
      (back-of-house). Registers are content discovered by authoring
      per framework §9.
    - Sim signals declared in `simSignalsInUse`: both supplier bands
      (`supplier.reliability`, `supplier.relationship` with the
      `low`/`mid`/`high` three-tier scheme from Phase 1), both
      supplier-domain pressures (`supplier_distrust`,
      `market_instability` — confirmed real in
      `pressureRegistry.ts:122,171`), `repeatCount subjectTag: supplier`
      (counts memories tagged `'supplier'` in the rolling window;
      memory tag wired through `expandedSeedGenerators.ts`),
      `memoryPresent tag: supplier`, and `hasNamedEntity` for supplier
      identity.
    - 12 positive exemplars covering the flavor-only voice gradient
      (single-axis anchors, two-axis top-rung, every verbal tic) AND
      the sim-backed signal space (reliability=low, reliability=high,
      relationship=high, market wobble rising, distrust rising,
      reliability=low + repeatCount top-rung, returning visitor via
      `memoryPresent`).
    - 8 negative examples covering the boundary: mechanical readout,
      unsupported backstory, invented authority, modern register,
      overlong florid, sim-backed claim without condition, plus two
      forward flags for Phase 5 (truncation ellipsis, label/subject
      duplication on titles).
    - 31 inline `snippetPools` snippets (9 establishing_line + 16
      reaction_line + 6 manner_note) — the convergence proof. Each
      required slot has an unconditional fallback. The
      single-condition middle rung is populated; the two-condition
      top rung covers six voice/voice and voice/signal pairs.
  - **New tracker row** in the index table (ISSUE-098, phase 129,
    status `done`).
- **Depends on:** ISSUE-096 (Phase 1 signal surface — done; the
  `signalEquals` condition + the `supplier.reliability` /
  `supplier.relationship` band signals are the entire premise of the
  sim-backed slot), ISSUE-097 (Phase 2 universal cast — done;
  `SupplierWorldState.castAttributes` is what `voiceAxis` /
  `verbalTic` conditions resolve against for the reaction line).
- **Loopback recorded:** None. The Phase 3 pass did not need a new
  signal, a new axis, or a new condition primitive. A possible future
  granular memory tag (e.g. `'light_delivery'`) is flagged as a
  Phase 9 / Phase 1-extension follow-up only if diversity numbers
  force it; `signalEquals supplier.reliability equals: low` carries
  the same truth at coarser grain today.
- **Test approach (delivered):** Phase 3 ships no TypeScript and runs
  no automated test — that is correct per the arc doc ("Don't build
  tooling, harness, or pipeline. Don't generate at volume. The output
  is throwaway — the **spec** is what you keep."). Convergence was
  verified by a Python-driven manual gate trace against the inline
  pools: YAML parse + per-snippet word-budget enforcement
  (zero violations across 31 snippets against `[14, 12, 10]` per-slot
  budgets) + sim-coherence trace (every non-fallback snippet in the
  sim-backed slot carries `>=1` of `signalEquals` / `pressureRising` /
  `repeatCount` / `memoryPresent` / `hasNamedEntity`) + coverage
  trace (both required slots have a `conditions: []` fallback).
  Determinism and diversity assertions are deferred to Phase 9 /
  ISSUE-104, where the template lands and the Phase-D harness extends
  to the supplier cohort. `npm test` and `npm run typecheck` remain
  green (no source code changes; YAML and Markdown only).

### ISSUE-097 — Voiced Surface Phase 2: universal cast on supplier/faction/customer-group/notable-NPC

- **Grade:** thin
- **Status:** done
- **Phase:** 128
- **Implementation record:** `docs/plans/phase-128-universal-cast.md`.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 2 names the
  blocker: most actors a card voices cannot be voiced. Phase A landed
  `castAttributes` only on staff and regulars (`StaffState.castAttributes`,
  `RegularWorldState.castAttributes`); `resolveActorCastAttributes` at
  `src/cards/compose/conditions.ts:42-44` explicitly returned `undefined`
  for every other ref kind and the comment named the gap. Three of the
  four broken-card screenshots the arc cites voice a supplier, a faction,
  and a culture cohort — none of which carried voice attributes today.
  Phase 7–14 migrations cannot author snippets keyed on `voiceAxis` /
  `verbalTic` for those actors until this is fixed.
- **Impact:** Without universal cast, the Voiced Surface arc's
  scale-out cannot proceed to Movement II. Phase 3's establishing-line
  spike (supplier-led) needs a supplier voice profile; every cluster in
  phases 7–14 needs its centring actor to carry voice attributes.
- **Scope (delivered):**
  - Four new exported type aliases on
    `src/sim/content/cast/castTypes.ts`:
    `SupplierCastAttributes`, `FactionCastAttributes`,
    `NotableNpcCastAttributes` (all alias `CastAttributes`), and
    `CustomerGroupCastAttributes` (voice-only; cohorts aren't
    individuals, so specialty/blindspot/affinities don't fit a crowd).
  - Three specialty-domain files —
    `supplierSpecialties.ts` (per-`supplierType` domain with fallback),
    `factionSpecialties.ts` (shared `FACTION_SOCIAL_SPECIALTIES`),
    `notableNpcSpecialties.ts` (per-NPC-`kind` domain with fallback).
  - Five new factories on `createCastAttributes.ts`:
    `createSupplierCastAttributes`, `createFactionCastAttributes`,
    `createNotableNpcCastAttributes`,
    `createCustomerGroupCastAttributes` (voice-only — reuses
    `rollVoiceProfile` only). The committed roll order at the top of
    the file is preserved for every full-shape factory.
  - Three new identity streams on `RngStreamId` —
    `supplier_identity`, `faction_identity`, `customer_group_identity`
    — plus the existing `npc_identity` stream reused for notable NPCs.
  - Day-zero seeding in `createInitialSuppliers`,
    `createInitialFactions`, `createInitialCustomerGroups` — id-sorted
    iteration mirroring the Phase 121 staff pattern, deterministic
    seeds (`initial-supplier-identity` /
    `initial-faction-identity` /
    `initial-customer-group-identity`).
  - `createNotableNpc` extended to roll `castAttributes` AFTER the
    existing name roll — preserves every canonical pre-Phase-2 NPC
    name byte-identical. Both day-zero NPCs and runtime-created NPCs
    pick up the new field through the same factory.
  - `ensureCastAttributes` extended with four new sweeps (suppliers,
    factions, customer groups, notable NPCs). Same
    `'initial-cast-attributes'` seed namespace as Phase A. Idempotent;
    structural no-op when every entity already carries the field.
  - Zod schema extensions on `SupplierWorldStateSchema`,
    `FactionWorldStateSchema`, `NotableNpcWorldStateSchema`, and
    `CustomerGroupStateSchema` (each gains an optional `castAttributes`
    field). New `CustomerGroupCastAttributesSchema` for the voice-only
    shape; the three full-shape kinds reuse `CastAttributesSchema`.
  - `resolveActorCastAttributes` widened to dispatch on
    `'supplier' | 'faction' | 'notable_npc' | 'customer_group'`. The
    customer-group branch returns an adapter shape (empty
    `specialty`/`blindspot`/`affinities`, real `voice`) so the
    `CastAttribute` condition primitives (`voiceAxis`, `verbalTic`)
    evaluate uniformly across kinds.
- **Depends on:** ISSUE-090 (Phase A cast attributes — done),
  ISSUE-096 (Phase 1 signal surface — done; not a hard schema
  dependency, but both share the `'initial-cast-attributes'` seed
  namespace and the resolver lives next to `signalEquals`).
- **Test approach (delivered):** Three new Phase-128 test files —
  `tests/sim/phase128.universalCast.test.ts` (23 tests covering
  schema round-trip, determinism, stream isolation, culture defaults
  flow-through, bounded outputs, no-prose, registry coverage,
  fallback domains, group voice-only shape, cross-kind invariants,
  Phase-A non-regression, and new RNG stream snapshot reachability);
  `tests/sim/phase128.migration.test.ts` (8 tests covering each
  sweep, idempotency, determinism, structural no-op, partial
  backfill); `tests/cards/compose/phase128.resolveActor.test.ts`
  (8 tests covering `voiceAxis` atLeast/atMost and `verbalTic`
  across all four new kinds, plus missing-actor / missing-cast-
  attribute fall-through). Phase 121 tests stay green (staff +
  regular `castAttributes` byte-identical post-Phase-2). Full suite
  and `npm run typecheck` green.

### ISSUE-096 — Voiced Surface Phase 1: signal surface + DSL signalEquals + wired repeatCount

- **Grade:** thin
- **Status:** done
- **Phase:** 127
- **Implementation record:** `docs/plans/phase-127-signal-surface.md`.
- **Evidence:** `docs/plans/voiced-surface-arc.md` Phase 1 names the
  blocker: the sim's truth isn't reachable by the snippet layer. The
  `repeatCount` snippet condition was declared but always returned `false`
  (`src/cards/compose/conditions.ts:119–125`); `drink_order`'s
  `sim_backed_hook` slot was `DISABLED_FOR_SPIKE` because "the underlying
  sim signals do not yet exist" (`specs/cards/drink_order.spec.yaml`); no
  read-only query surface existed for band tiers (supplier reliability,
  faction relation, area condition). The four target situations the doc
  highlights all needed to state facts the DSL could not express.
- **Impact:** Without a signal surface, the Voiced Surface arc's
  scale-out cannot begin — Phase 3's establishing-line spike requires
  band/repeat-count signals to author against, and every Phase 7–14
  migration requires them too. This phase ships the machine that makes
  the rest of the arc possible.
- **Scope (delivered):**
  - New `src/sim/signals/` module — pure read-only functions over
    `TavernState`. Eight band signals (`supplier.reliability`,
    `supplier.relationship`, `staff.stress`, `staff.fatigue`,
    `faction.relationship`, `faction.influence`, `area.condition`,
    `area.cleanliness`) with 3-tier (`low`/`mid`/`high`) bands; threshold
    table at `40/70` exported as data so gates can enumerate. The
    unified `querySignal(state, signal, ref)` dispatcher validates the
    entity-ref kind against the signal and returns `{ missing: true }`
    on mismatch. `repeatCountByTag` counts memory tags inside a 28-day
    rolling window. `pressureTrend` / `pressureIsRising` re-export the
    pressure read used by the existing condition so the snippet DSL
    and signal surface never drift.
  - One new DSL primitive — `{ kind: 'signalEquals'; role; signal;
    equals }` on `SnippetCondition`. Pure data (no closures), trivially
    enumerable, sim-coherence whitelist updated.
  - `repeatCount` rewired against `repeatCountByTag`. The
    "always-false" forward-seam disappears; the previously-skipped
    `repeatCount` test in `conditions.test.ts` now exercises real
    memory-tag windows.
  - `drink_order` spec: `sim_backed_hook` slot relabelled from
    `DISABLED_FOR_SPIKE` to `SIGNAL_AVAILABLE`. The pipeline schema and
    skip logic widened to accept either status — both still skip — so
    the build-time pipeline keeps working unchanged.
  - `TEXT_INGREDIENT_ROLE: Record<keyof TextIngredients,
    'signal-backed' | 'flavor-seed'>` added next to
    `TEXT_INGREDIENT_LIMITS`. Numeric / classification fields are
    declared signal-backed; sensory and structural fields are
    flavor-seed. `cards-contract.md §3.3` gains a paragraph stating
    that `sim_backed` slots must reach for signals; flavor-seed fields
    may be borrowed by `flavor` slots as decoration.
- **Depends on:** ISSUE-090 (Phase A cast attributes — done),
  ISSUE-092 (Phase C runtime — done), ISSUE-093 (Phase D gates — done).
- **Deferred — handed to Phase 7 (ISSUE-102):** Staff blame-mode
  classification ("publicly blamed" vs "quietly slighted" vs
  "self-blamed"). Of the four audit targets, three sit on already-
  existing numeric fields in `TavernState` and became signals as a
  purely additive change. Blame-mode is the outlier: no discrete
  classification exists today (`perceivedBlame: string[]` is
  pre-rendered prose). The deferral was a user-approved scope decision
  (see plan §"Explicit deferrals"). Phase 7 (Staff & Personnel
  migration) — the first downstream phase needing it — owns the
  additive sim change. The contract for that work is recorded in the
  plan file: add optional `blameMode?: BlameMode` to memory drafts /
  state (Zod `.optional()` — no migration), stamp from a verb→mode
  data table at the response-resolver's memory-write sites, add
  `latestBlameMode(state, staffId)` signal, widen `signalEquals`'s
  `equals` type to include `BlameMode` (additive — no existing snippet
  uses it). Phase 3's spike (supplier-led) is not blocked.
- **Also deferred (audit candidates that didn't force a new primitive
  this phase):** `relationshipTier` — folded into `signalEquals` (band
  signals cover it). `namedEntityRole`/tenure — no audit target forces
  it; lands when first needed. Ordered-band comparisons
  (`signalAtLeast`) — `signalEquals` is the v1; ordered shape lands
  when authoring need surfaces.
- **Test approach (delivered):** Seven new Phase 127 test files —
  `tests/sim/phase127.signals.numeric.test.ts` (boundary tests for all
  eight band signals + the dispatcher),
  `tests/sim/phase127.signals.repeats.test.ts` (window arithmetic),
  `tests/sim/phase127.signals.pressureTrend.test.ts` (parity with
  `evalCondition({pressureRising})`),
  `tests/sim/phase127.pressureIds.publication.test.ts` (11 pressure
  ids addressable on state from day zero),
  `tests/sim/phase127.textIngredientRole.test.ts` (exhaustiveness +
  role assignments), `tests/cards/compose/phase127.signalEquals.condition.test.ts`
  (the new DSL primitive end-to-end), `tests/cards/compose/phase127.simBackedHookSignal.test.ts`
  (the slot's intended signals reach). The existing `conditions.test.ts`
  block that asserted `repeatCount` is always false was rewritten to
  exercise the now-wired path. Full suite green at 1929/1929 across 164
  files; `npm run typecheck` clean.

### ISSUE-095 — Living Cast Phase F (first situation): staff_aside template

- **Grade:** thin
- **Status:** done
- **Phase:** 126
- **Implementation record:** `docs/plans/phase-126-staff-aside.md`.
- **Evidence:** `living-cast-arc.md` Phase F ("Scale Out") describes the
  centerpiece phase: each new card situation gets its own template +
  spec, the Phase-C runtime and Phase-D gates and Phase-E pipeline
  reuse unchanged, voice is a generation dimension rather than a runtime
  transformer. After Phase E shipped, the next move is one situation
  landing as proof. The `staff_identity / relationship_test /
  morning_prep` combination is the cleanest first scale-out: a staff
  member as `primaryActor` (see
  `src/sim/modules/issues/expandedSeedGenerators.ts:810`), Phase-A cast
  attributes available, currently uncovered (the hand-written
  `staffRequest` template only matches `staff_request` / `complaint` at
  `closing`, so `relationship_test` / `morning_prep` seeds fall through
  to the fallback today).
- **Impact:** Without a second compositional template, the
  Phase-C runtime + Phase-D gates + Phase-E pipeline have only the
  drink_order spike to validate them. Phase F's "hundreds of lines,
  many personalities, in an evening" goal needs templates to multiply;
  this is the first multiplication. Hand-authored rather than
  pipeline-generated this round (user explicitly opted out of API
  spend); the matching spec at `specs/cards/staff_aside.spec.yaml`
  records intent for a future regeneration. The schema generalisation
  fixed in this phase (Phase-E hardcoded the first template's slot ids
  under `HardBoundsSchema` and `PositiveExemplarSchema`) unblocks every
  subsequent Phase-F situation from needing the same fix.
- **Scope (delivered):** New compositional template + pool slice at
  `src/cards/templates/staffAside.ts` and `src/cards/compose/pools/staffAside/`
  (`asideLine.ts` with 18 snippets across four rungs, `mannerNote.ts`
  with 5 snippets, `index.ts` re-exports). Voice register
  `'staff_quarters'` (back-of-house, pre-shift, owner-facing) keeps
  exemplars from bleeding into the customer-facing `tavern_floor`
  register. The template's `custom` predicate guards on
  `state.staff[ref.id]?.castAttributes !== undefined` — mirrors
  drinkOrder's regulars-side check; graceful degradation per framework
  §5. `REQUIRED_CARDS` now holds 10 cards (9 hand-written + 2
  compositional). Phase-E schema generalised: `HardBoundsSchema` keys
  per-slot budgets under `perSlotWords: Record<slotId, number>`,
  `PositiveExemplarSchema` keys exemplar text under `slotLines:
  Record<slotId, string>`, `buildPrompt.ts` reads
  `ex.slotLines[slotId]`. `specs/cards/drink_order.spec.yaml` migrated
  to the new shape (same content, slot-agnostic shell);
  `specs/cards/staff_aside.spec.yaml` ships in the new shape from the
  start. Test sampler helpers lifted into `buildStaffDeterminismSamples`
  and `buildStaffDiversitySampler` (use `createStaffCastAttributes`
  reproducing the real Phase-A `[-1,0,0,1]`-perturbed staff
  distribution).
- **Depends on:** ISSUE-090 (Phase A cast attributes — done),
  ISSUE-092 (Phase C runtime — done), ISSUE-093 (Phase D gates — done),
  ISSUE-094 (Phase E pipeline — done; spec format the new spec reuses).
- **Test approach (delivered):** New integration test file at
  `tests/cards/templates.staffAside.test.ts` — 14 tests parallel to
  `templates.drinkOrder.test.ts` (registry coverage, fallback predicate
  when castAttributes missing, title centres on named staff, body[0]
  is a committed snippet, unconditional fallback on neutral axes,
  two-axis snippet selection on terseness=2 + warmth=0, tic snippet
  selection on qualifies_everything against neutral axes, choices
  project the seed's response slots, severity/tag flow from seed,
  determinism via `structuredClone`, no state mutation, three-distinct
  body lines across three distinct voice profiles). Each Phase-D gate
  test (`coverage`, `specificity`, `voiceBounds`, `simCoherence`,
  `determinism`, `diversity`, `runAllGates`) gained a parallel block
  exercising `staffAsideTemplate` against the same gate it already runs
  for `drinkOrderTemplate`. Pipeline tests (`loadSpec`, `buildPrompt`,
  `integration`, `runGates`) stay green under the generalised schema
  (drink_order spec was migrated to the new shape in the same change).
  Full suite green at 1856/1856 across 155 files; `npm run typecheck`
  clean.

### ISSUE-094 — Living Cast Phase E: model-authored generation pipeline

- **Grade:** thin
- **Status:** done
- **Phase:** 125
- **Implementation record:** `docs/plans/phase-125-generation-pipeline.md`.
- **Evidence:** `living-cast-arc.md` Phase E ("Generation Pipeline")
  describes the build-time loop that turns a Phase-B-style generation
  spec into a tested, committed `SnippetPool` via the model and the
  Phase-D gates. Phase D shipped `runAllGates` as a callable library
  but no caller; Phase B is the hand-authored convergence artifact
  whose YAML format the pipeline must consume; the framework's §7
  explicitly defers the pipeline to a later phase. Phase E is that
  later phase.
- **Impact:** Without a pipeline, every new template's snippet pool
  requires hand-authoring, which Phase F's "hundreds of lines, many
  personalities, in an evening" arc goal cannot survive. The pipeline
  is also the only mechanism that makes the gates load-bearing — until
  generated output flows through them in CI, the gates only protect
  the four hand-authored pool files Phase C committed.
- **Scope (delivered):** New pipeline slice at `scripts/generate-pool/`
  with one file per stage (`loadSpec`, `specSchema`, `buildPrompt`,
  `callModel`, `parseModelOutput`, `runGates`, `dedupe`, `levenshtein`,
  `retryLoop`, `emitPool`, `writePoolFiles`, plus `cli.ts` and
  `index.ts`). The spec YAML lifted from
  `docs/plans/living-cast-arc-phase-b.md` lands at
  `specs/cards/drink_order.spec.yaml` with a strict Zod schema that
  rejects unknown keys. Generation calls Sonnet 4.6 (configurable);
  spec + exemplars are cached via `cache_control: ephemeral` so
  per-slot retries reuse the prefix. Parsed output flows into a
  Phase-D `runAllGates` sweep (all six gates) — gate failures + dedupe
  rejections feed back into the next retry as plain text, up to a
  three-attempt budget. Within-slot dedupe uses normalised
  Levenshtein on canonicalised text at threshold 0.85; cross-slot
  dedupe collapses canonical equality only. Emitter sorts snippets by
  `(specificity, id)` so identical model output produces a
  byte-identical `.ts` file; the writer drops files directly under
  `src/cards/compose/pools/<templateId>/` so the regenerated PR shows
  the diff against the existing committed pool. GitHub Action at
  `.github/workflows/generate-pool.yml` runs on `workflow_dispatch`,
  reads `ANTHROPIC_API_KEY` from repo secrets, calls the pipeline,
  and opens a PR via `peter-evans/create-pull-request@v6`. The
  Phase-D helper `representativeBannedNames` was lifted from
  `tests/cards/compose/gates/samplers.ts` to
  `src/cards/compose/gates/representativeBannedNames.ts` so the
  pipeline can import it without reaching into `tests/`; the test
  file re-exports for backwards compatibility.
- **Depends on:** ISSUE-093 (Phase D gate library — done).
- **Test approach (delivered):** Seven new test files at
  `tests/cards/compose/pipeline/`. `loadSpec.test.ts` parses the real
  spec file and asserts unknown-key rejection. `buildPrompt.test.ts`
  asserts the cached prefix carries spec content, the retry tail
  carries violations + parse errors + dedupe rejections, and the two
  halves remain split for cache placement. `parseModelOutput.test.ts`
  covers happy-path fenced YAML, missing fence, bad YAML, missing
  fields, unknown condition kinds. `dedupe.test.ts` walks every pair
  in the committed 17-snippet `order_line` pool to confirm zero
  false positives at 0.85 (regression net), plus planted near-dups,
  cross-slot canonical equality, and specificity-based keeper
  selection. `runGates.test.ts` runs the existing Phase-C pools
  through the adapter and confirms all six gates pass; planted bad
  snippets fail the expected gate. `retryLoop.test.ts` injects a mock
  `generateCompletion` and exercises invalid-then-valid recovery,
  exhaustion after three failures, and the gate-violations-feed-back
  loop. `integration.test.ts` is the convergence proof — loads the
  real spec, threads the committed Phase-C pools as the mock model
  response, runs the full pipeline against a `tmpdir`, asserts the
  emitted files land at the expected paths and the accepted in-memory
  pools clear `runAllGates`. Full suite green; no regressions on
  Phase A/C/D or sim tests.

### ISSUE-093 — Living Cast Phase D: six structural gates harness

- **Grade:** thin
- **Status:** done
- **Phase:** 124
- **Implementation record:** `docs/plans/phase-124-test-harness.md`.
- **Evidence:** `card-composition-framework.md §6` names six structural
  gates — coverage, specificity-gradient, voice-bounds, sim-coherence,
  determinism, diversity — that let pool generation replace human
  review. Phase C shipped the runtime and `drinkOrderCard` but no
  gates; the existing `tests/cards/compose/` suite covers the
  *runtime* (per-condition arms, FNV tie-break, optional-slot
  omission, integration on a real seed) but does not exercise the
  *pool data* against the six framework gates. Phase B's
  "Must-pass gates for this template" block
  (`docs/plans/living-cast-arc-phase-b.md` §"Must-pass gates")
  enumerates exactly what each gate means for `drink_order` (e.g.
  `order_line ≤ 12 words`, `manner_note ≤ 10 words`, ≥ 6 distinct
  order_line outputs across the perturbed cast distribution), but
  those numbers lived only in the doc.
- **Impact:** Without the gates, Phase E (the generation pipeline)
  has no programmatic way to reject bad model output, and Phase F's
  scale-out across situations and voices is unsafe — each new pool
  would need hand review. The gates are also the regression net for
  the existing Phase B pool: a future edit that breaks coverage or
  collapses diversity would land silently.
- **Scope (delivered):** New gate library at
  `src/cards/compose/gates/` with one file per gate
  (`coverage.ts`, `specificity.ts`, `voiceBounds.ts`,
  `simCoherence.ts`, `determinism.ts`, `diversity.ts`), shared
  `types.ts` (`GateReport`, `GateViolation`), and a composite
  `runAllGates.ts` runner that Phase E will import unchanged.
  Two additive optional fields on `SlotSpec` —
  `wordBudget?: number` (defaults to framework body cap 12) and
  `claimMode?: 'flavor' | 'sim_backed'` (defaults to `'flavor'`) —
  move Phase B's locked numbers from the doc into the slot data and
  give the sim-coherence gate a structural distinction to switch
  on. `drinkOrder.ts` annotated: `order_line` gets `wordBudget: 12,
  claimMode: 'flavor'`; `manner_note` gets `wordBudget: 10,
  claimMode: 'flavor'`. Sim-coherence runs three default detectors
  on flavor slots — banned display-name substring scan, history-
  claim regex (`twice now`, `yesterday`, `last week`, etc.)
  requiring a `memoryPresent`/`repeatCount` condition, role-claim
  regex (`your cook`, `the cleaner`, …) requiring a `hasNamedEntity`
  condition — and on `sim_backed` slots requires every non-fallback
  snippet to carry a state-lookup condition. Diversity sampler
  uses `createRegularCastAttributes` with a deterministic
  `prando`-seeded RNG so the test reproduces the real `[-1,0,0,1]`
  cast distribution and stays itself deterministic. New named
  export `drinkOrderTemplate` on `src/cards/templates/drinkOrder.ts`
  so gates can run against the `CompositionalCardTemplate` directly
  (the existing `drinkOrderCard` `CardDefinition` export is unchanged).
- **Depends on:** ISSUE-092 (Phase C composition runtime — done).
- **Test approach (delivered):** Seven new test files at
  `tests/cards/compose/gates/` covering 28 gates.
  `coverage.test.ts` (3): real drinkOrder passes; no-fallback
  fixture fails with `missing_unconditional_fallback`; optional
  slots are exempt. `specificity.test.ts` (4): real passes;
  all-fallback fails with `no_conditioned_snippet`; no-fallback
  fails with `no_fallback`; optional slots are exempt.
  `voiceBounds.test.ts` (5): real passes with the locked 12/10
  budgets read from `slot.wordBudget`; over-budget fixture fails
  with `over_budget`; `config.perSlot` override beats slot data;
  default 12-word budget applies when nothing else carries one.
  `simCoherence.test.ts` (8): real passes against the
  `representativeBannedNames(createInitialTavernState())` list;
  banned-name fixture fails with `banned_display_name`; unbacked
  "twice now" fails with `unbacked_history_claim`; same text with
  a `memoryPresent` condition passes; unbacked "your cook" fails
  with `unbacked_role_claim`; sim_backed slot with a voice-only
  snippet fails with `sim_backed_missing_lookup`; sim_backed
  fallback is exempt; sim_backed with a `memoryPresent` condition
  passes. `determinism.test.ts` (2): real drinkOrder is byte-equal
  across `structuredClone` over a 15+-sample matrix covering
  neutral, every single-axis extreme, every two-axis exemplar
  pair, and every verbal tic; a planted state-mutating
  `toCardView` fails with `state_mutated_during_render`.
  `diversity.test.ts` (3): real `order_line` yields ≥ 6 distinct
  outputs across 100 samples drawn from the real `[-1,0,0,1]`
  distribution; `manner_note` yields ≥ 3; a synthetic
  never-fires pool yields 1 and fails with
  `insufficient_diversity`. `runAllGates.test.ts` (3): real
  drinkOrder template clears all six gates in one call; a planted
  over-budget snippet flips only `voiceBounds.pass` while every
  other sub-report stays green (independent failure attribution
  is the Phase-E contract); a configured slot that does not exist
  on the template surfaces as `diversity_slot_not_found`. Full
  suite green; no regressions.

### ISSUE-092 — Living Cast Phase C: composition runtime + first compositional card

- **Grade:** thin
- **Status:** done
- **Phase:** 123
- **Implementation record:** `docs/plans/phase-123-composition-runtime.md`.
- **Evidence:** `card-composition-framework.md §2–3, §8` specifies the
  bottom half of the card layer — typed snippets, data conditions, a
  deterministic slot assembler, and `defineCompositionalCard` — but
  shipped nothing. Phase B converged a `drink_order` template + pool
  by hand and surfaced two structural findings: Phase A stores voice
  as structured scalars (`CastAttributes.voice.axes[axis] ∈ {0,1,2}`
  + optional `verbalTic`), so the framework's `actorTrait` exact-
  string condition cannot match voice; and the pool needs a single-
  axis middle rung because two-axis snippets fire rarely under the
  `[-1,0,0,1]` perturbation.
- **Impact:** Without the compose slice no compositional card can
  render — every Phase D / E / F / G phase depends on this runtime.
  The eight hand-written templates kept working untouched; Phase C
  only adds, never replaces.
- **Scope (delivered):** New compose slice at `src/cards/compose/`
  with `types.ts` (Snippet / SnippetPool / SnippetCondition /
  SlotSpec / CompositionalCardTemplate / FilledSlots, plus plain-
  string `VoiceRegisterId`), `conditions.ts` (the eleven framework
  primitives + Phase-B's `voiceAxis` atLeast/atMost forms +
  `verbalTic`, all flat-data conditions; `actorTrait` declared but
  always-false as a forward seam), `assemble.ts` (deterministic
  `pickSnippet` / `assembleSlots` / `specificityOf` with FNV
  tie-break), `defineCompositionalCard.ts` (factory that wraps a
  template into the existing `CardDefinition` shape so the registry,
  selection, and renderer never learn this layer exists), and a
  committed pool slice `pools/drinkOrder/` carrying Phase B's
  `order_line` (17 snippets across fallback + single-axis + two-axis
  + verbal-tic rungs) and `manner_note` (5 snippets) verbatim. New
  template `src/cards/templates/drinkOrder.ts` wires through
  `defineCompositionalCard` and applies to `regular_customer /
  relationship_test / during_service` seeds (currently uncovered by
  any card; primaryActor is already a regular ref). The shared FNV
  helper moved to `src/sim/utils/fnv.ts`; `descriptors.ts` and
  `voice/composer.ts` both import it, with `__internal.fnvIndex`
  re-exported for test back-compat. `sim_backed_hook` slot ships
  empty per Phase B's "DISABLED for spike" decision (sim does not
  emit `repeatCount`/`subjectTag`).
- **Depends on:** ISSUE-090 (Phase A bounded cast attributes — done).
  Phase B's hand-iterated spec is a documentation artifact at
  `docs/plans/living-cast-arc-phase-b.md`; no tracker entry.
- **Test approach (delivered):** Three new suites covering 45 gates.
  `tests/cards/compose/conditions.test.ts` (21 gates) exercises each
  of the thirteen condition kinds with positive + negative cases,
  including the forward-seam `actorTrait` and `repeatCount` returning
  false today, plus `voiceAxis`/`verbalTic` graceful degradation
  (missing actor, missing castAttributes, non-cast-bearing kinds).
  `tests/cards/compose/assemble.test.ts` (12 gates) covers
  specificity ordering, optional-slot omission, FNV tie-break
  stability, and determinism across structuredClone.
  `tests/cards/templates.drinkOrder.test.ts` (12 gates) is the
  live integration: `pickCardForSeed` returns `drinkOrderCard` for
  the right seed; the seed's body[0] is one of the 17 committed
  snippets; specific cast profiles produce the expected snippet
  ("Ale. Cold. No speech with it." for `terseness=2, warmth=0`);
  the unconditional fallback fires on neutral profiles; complaint-
  type seeds still route to `customerComplaintCard`; missing cast
  attributes route to `fallbackCard`; render is deterministic and
  non-mutating. Full suite green at 1764/1764 (1719 pre-Phase-C +
  45 new).

---

## Related notes

External documents that inform tracker work but are not themselves
tracked issues:

- `docs/plans/seven-pass-investigation-plan.md` — cross-cutting audit
  that surfaced most of ISSUE-034…057.
- `docs/plans/phase-53-59-tier2-followups.md` — perf notes from the
  Tier 2 pass: `phase20.cardlessPlaytest` RAM growth and
  `phase40.expandedReadiness` long runtime. Not currently tracked
  as ISSUEs; the underlying behaviour predates the Tier 2 work.
- `docs/P20F1.md` — investigation into the `response_impact` gate
  scoring at 28 / 70 (catalog gap + scorer gap + threshold gap, in
  that order).

---

## Adding a new issue

If a new problem surfaces during repair work (regression, missed
finding, side-effect of a fix):

1. Pick the next free `ISSUE-NNN` number. Don't reuse retired numbers.
2. Add it to the Issue index table.
3. Write a full entry under the appropriate tier section. Match the
   existing entry shape: Grade, Status, Phase, Evidence, Impact,
   Scope, Depends on, Test approach.
4. Update any existing issues whose dependencies should now include
   the new one. (Cross-check the index table after.)
5. Note in a commit message that the tracker was extended and which
   issue ID was added.

Don't fold new issues into existing entries — that breaks the
"one phase per issue" assumption that the phase docs will rely on.
