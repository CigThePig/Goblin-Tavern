# The Voiced Surface Arc — Every Line in the Game Speaks

**The full fix, not a patch.** The Living Cast arc proved that compositional snippets, selected by a character's bounded `voiceProfile`, beat fragment-gluing — but it only reached two *flavor-only* situations (`drink_order`, `staff_aside`). Everything else still renders by concatenating raw `textIngredients` ("reliability 45", "tight jaw", "prefers: quality_sensitive, food") or truncating duplicated titles ("Main Room: Main Room", "…a word before…"). This arc finishes the job: it makes **every diegetic line in the game** — card title, body, choices, previews, reports, day beats, the tavern log — speak through one tested composition layer that states *what actually happened* (sim-backed) and *how this character feels about it* (flavor), and never invents either.

**This is the continuation of [`living-cast-arc.md`](living-cast-arc.md).** That doc's Phase F ("scale out, one situation at a time") and Phase G ("finish") are *generalised here* to the whole game and to sim-backed claims, not just customer-facing flavor. Read it first — the spine, the flavor/sim-backed split, and "voice is a generation dimension, not a runtime transformer" all carry over unchanged.

**Pairs with:**
- [`card-composition-framework.md`](card-composition-framework.md) — the runtime: `Snippet` / `SnippetPool` / `SnippetCondition` (the 11 data primitives), `assembleSlots`, the specificity gradient, and the six structural gates (§6). Built and shipped under `src/cards/compose/`.
- [`cards-contract.md`](cards-contract.md) — **LOCKED.** The truth rules: compose don't invent, reference by id, skip invalid seeds, stable re-render. Nothing here weakens them; the whole arc pushes them *down* into snippet authoring.
- The shipped Phase-A vocabulary under `src/sim/content/cast/` — four voice axes (`terseness`, `warmth`, `formality`, `floridity`, each `0–2`), an optional `verbalTic`, and `CULTURE_VOICE_DEFAULTS` for the eight cultures.

---

## Two corrections this arc bakes in

These are decisions taken *for* this arc; later phases assume them.

1. **Authoring is a Claude Code plan-mode run, not a build-time API call.** The Phase-E pipeline (`scripts/generate-pool/`, `.github/workflows/generate-pool.yml`) that called the Anthropic API and opened PRs is **retired** (Phase 4). The repeatable scaling unit becomes: *Claude Code reads a spec → authors the pools in-repo → runs `runAllGates` + the situation's tests → iterates to green → commits.* The spec format and the gates are kept exactly; only **who generates** changes. The gates — not a human and not the API loop — are the quality bar.
2. **The fix reaches into `src/sim/`.** The reason cards feel context-less is that the sim's truth isn't *reachable* by the snippet layer — the `sim_backed_hook` slot in `drink_order.spec.yaml` is disabled with the note that "the underlying sim signals do not yet exist." Phases 1–2 fix that at the simulation layer (a queryable signal surface; voice attributes for *every* actor, not just staff/regulars). All sim rules still hold: pure, headless, serializable, named RNG streams, no `Math.random`, additive integration over rewrites.

---

## The spine at a glance

```
  MOVEMENT I  — Foundations (the machine that makes context safe)
   1  Signal Surface           sim truth becomes queryable conditions       ← unblocks sim-backed slots
   2  Universal Cast           every actor gets a bounded voiceProfile       ← suppliers/factions/groups can speak
   3  Establishing-Line Spike  hand-converge the "what happened" slot        ← the sim-backed gate (Phase-B for facts)
   4  Authoring Loop           Claude-Code-run pool authoring; retire API    ← the scale unit, corrected
   5  Title & Frame Discipline titles composed, never truncated/duplicated   ← every migration inherits it
   6  Choice & Consequence     responses voiced & situation-aware            ← the "responses feel generic" half

  MOVEMENT II — Migrate every card situation (legacy template deleted each time)
   7  Staff & Personnel        staff_identity, staff_burnout
   8  Regulars & Complaints    regular_customer, customer_complaint
   9  Suppliers, Stock & Debt  supplier_relationship, stock_shortage, debt_rent
  10  Factions & Culture       faction_request, culture_conflict
  11  Premises & Atmosphere    maintenance, area_atmosphere
  12  Crises & Safety          food_safety, violence, inspection
  13  Reputation/Rumour/Rivals reputation_shift, rumour_crisis, rival_tavern
  14  Periodic & Narrative     monthly_review, seasonal_arc, weekly overview

  MOVEMENT III — The rest of the diegetic surface
  15  Reports Prose            the Reports tab speaks in the same voice
  16  Ambient Surface          day beats, tavern log, hints, fallback; legacy composer deleted

  MOVEMENT IV — Finish (never strictly done, but maintainable)
  17  Cross-Situation Voice    same character recognizable across situations  ← the centerpiece, made testable
  18  Deepening & Tuning       play, add up the gradient, prune the dead      ← standing
```

**You are here:** Living Cast Phases A–F-first-situation done (`drink_order`, `staff_aside`). Two compositional templates exist; nine fragment-dump templates and the whole non-card surface do not. Next is Phase 1.

**The one ordering rule:** Movement I is a hard prerequisite for everything after it — 1 → 2 → 3 → 4 → 5 → 6 in order. Within Movement II the seven migration phases (7–13) can be reordered freely; 14 should come last in II because it bridges to reports. Movement III follows II. Movement IV's Phase 17 needs ≥3 migrated situations to be meaningful. Expect *one* loop back from Phase 3 to Phases 1–2 (the spike will name a missing signal or a missing axis) — that is the system working, exactly as Living Cast Phase B looped to A.

**Phase numbers and ISSUE ids below are provisional labels, not a ladder.** The repo numbers them `ISSUE-096…113` / `phases 127…144` (continuing from ISSUE-095 / phase 126). Register each in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md) when you commit it, walk them in order, and let `Depends on` chains — not the integers — drive execution.

---

# MOVEMENT I — Foundations

## Phase 1 — Signal Surface

**Provisional:** phase 127 / ISSUE-096.

**Goal.** Make the simulation's truth *reachable* by the snippet condition DSL. Today the facts a card needs to state — a supplier's reliability *band*, whether a staff member was *publicly blamed* vs *quietly slighted*, that this is the *third* complaint about the ale, that a pressure is *rising* — live either as numbers the card has to reformat or as pre-baked strings inside `textIngredients`. Conditions can't gate on them, so the sim-backed slot stays disabled and cards can only voice mood. This phase exposes those facts as **data-shaped, read-only signals** and reclassifies `textIngredients` so numbers/relations become queryable signals while sensory fragments stay as flavor seeds.

**The work.**
- Audit the facts the broken situations need to assert (start with the four screenshots: supplier reliability tier, staff blame-mode, faction relation tier, area condition + maintenance pressure).
- Extend the DSL's reach **without** breaking its "data, not closures / no OR/NOT/nesting" rule: wire `repeatCount` to a real per-subject counter, `pressureRising` to real pressure ids, and add the minimum new primitives the audit proves necessary (candidates: a `tieredValue` read for reliability/relationship/loyalty bands, a `relationshipTier`, a `namedEntityRole`/tenure read). Each must stay trivially evaluable and trivially enumerable for the gates.
- Give `src/sim/` a small, pure, read-only **query surface** these conditions evaluate against, so snippets stop string-sniffing `textIngredients`.
- Keep `textIngredients` but split its role: structured facts (numbers, relations, blame-mode) move behind signals; short sensory fragments remain as optional flavor seeds.

**Read first.** `card-composition-framework.md §2.3` (the 11 primitives, the data-not-closures rule, the 100-snippet DSL freeze) and `§4` (sim-coherence). `cards-contract.md §3.3`. `src/sim/modules/issues/issueSeedTypes.ts` (`TextIngredients`, `TEXT_INGREDIENT_LIMITS`). `CLAUDE.md` (pure sim, serializable, named RNG, additive integration).

**Done when.** A snippet condition can gate on a real sim fact (reliability tier, blame-mode, repeat count, rising pressure) without reading a pre-rendered string; the DSL stays data and stays inspectable; a test re-enables `drink_order`'s `sim_backed_hook` *in principle* (the signal resolves) even though no snippet is authored yet; `npm test` and `npm run typecheck` green.

**Do not do.** Don't author snippets. Don't add OR/NOT/nesting speculatively. Don't break determinism. Don't rewrite working sim modules — add read-only query helpers and additive fields only.

```
Enter plan mode. Voiced Surface arc, Phase 1 (Signal Surface).
Read card-composition-framework.md §2.3 and §4, cards-contract.md §3.3,
src/sim/modules/issues/issueSeedTypes.ts, and CLAUDE.md. Audit which concrete
sim facts the supplier/staff/faction/area situations must STATE, then write a
phase plan in docs/plans/ to: (a) wire repeatCount + pressureRising to real
signals; (b) add the minimum new DATA condition primitives the audit forces,
keeping them inspectable and free of OR/NOT/nesting; (c) add a pure, read-only
sim query surface conditions evaluate against; (d) reclassify textIngredients so
facts are signals and sensory bits stay flavor seeds. Pure sim, serializable, no
Math.random, additive only. Plan determinism + schema round-trip tests, and a
test that re-enables drink_order's sim_backed_hook signal. Wait for plan approval.
```

---

## Phase 2 — Universal Cast

**Provisional:** phase 128 / ISSUE-097.

**Goal.** Give *every actor a card voices* a bounded, serializable `voiceProfile` — not just staff and regulars. Three of the four broken screenshots voice a supplier, a faction, and a culture cohort, none of which carry voice attributes today, so they cannot be voiced even after migration. Generalise Phase-A's `CastAttributes` to suppliers, faction envoys, and customer-group/culture cohorts (and notable NPCs where they front a card).

**The work.**
- Attach the bounded attribute set (the four voice axes + optional `verbalTic`, plus `specialty`/`affinity` where they carry meaning) to supplier, faction, and culture-cohort/customer-group state.
- Wire `CULTURE_VOICE_DEFAULTS` through so a road-merchant envoy defaults florid-formal and a miner crew defaults terse — the defaults already exist; this connects them to the new actors.
- Generate once via named RNG streams; stable across re-render; Zod schema + migration + defaults.

**Read first.** `living-cast-arc.md` Phase A. `src/sim/content/cast/` (`createCastAttributes`, `cultureVoiceDefaults`, `voiceAxes`, `verbalTics`). `cards-contract.md §3` (state shapes). `CLAUDE.md`.

**Done when.** Every actor kind a card centres on carries a bounded `voiceProfile` generated once via a named stream and stable across re-render; culture defaults flow through; schema round-trips through save/load; `npm test` and `npm run typecheck` green.

**Do not do.** No prose. No open-ended invented tags. Don't expand the axis set unless Phase 3 forces it. Don't deeply rewrite the supplier/faction/customer modules — additive only.

```
Enter plan mode. Voiced Surface arc, Phase 2 (Universal Cast).
Read living-cast-arc.md Phase A, all of src/sim/content/cast/, cards-contract.md
§3, and CLAUDE.md. Write a phase plan in docs/plans/ to generalise the Phase-A
CastAttributes (4 voice axes + optional verbalTic, plus specialty/affinity where
meaningful) onto suppliers, factions, and culture cohorts / customer groups,
wiring CULTURE_VOICE_DEFAULTS through as the per-culture baseline. Identity via
named RNG streams, stable across re-render, Zod schema + migration + defaults,
fully serializable. Plan stable-across-re-render and schema round-trip tests
before implementing. Additive only — no module rewrites. Wait for plan approval.
```

---

## Phase 3 — The Establishing-Line Spike

**Provisional:** phase 129 / ISSUE-098. **This is authorial hand-work, not a Claude Code phase** (like Living Cast Phase B).

**Goal.** Converge the sim-backed "what happened" slot the way Phase B converged the flavor slot. Pick ONE sim-backed situation — **supplier reliability is the cleanest** (one number, one relationship, an unambiguous "what happened") — and hand-iterate slots + spec + exemplars + negatives until the card both *states the situation* and *voices the actor*, with sim-coherence satisfied and no output you have to fix.

**The split this phase makes concrete (carried from Phase B, now for facts).** An **establishing line** (`claims: sim-backed`) may only assert what a Phase-1 signal guarantees — "Brakka's wagon came light again, third run this month" requires the repeat-count signal. A **reaction line** (`claims: flavor`) is pure voice and claims nothing checkable. Sorting your exemplars into those two buckets is half the design work, exactly as before.

**Read first.** `living-cast-arc.md` Phase B + `living-cast-arc-phase-b.md` (the convergence narrative). `card-composition-framework.md §4` + `§6` (sim-coherence and its gate). `specs/cards/drink_order.spec.yaml` (the format) and `specs/cards/staff_aside.spec.yaml`. The Phase-1 signal surface.

**Done when.** The spec generates a clean, sim-coherent, voiced supplier card whose body states the real situation, hand-run to convergence without edits; and you can name which Phase-1 signals and which voice axes it reached for (feed that back to lock Phases 1–2).

**Do not do.** Don't build tooling, harness, or pipeline. Don't generate at volume. The output is throwaway — the **spec** is what you keep.

```
(Hand-work with me, like Living Cast Phase B. Paste the supplier spec draft plus
a few generated lines split into establishing/reaction buckets; we iterate the
spec until the output needs no fixing. No Claude Code, no repo changes beyond
committing the converged spec to specs/cards/.)
```

---

## Phase 4 — The Authoring Loop (replaces the API pipeline)

**Provisional:** phase 130 / ISSUE-099.

**Goal.** Make the repeatable scaling unit a **Claude Code plan-mode run**, and retire the build-time API pipeline. A migration phase becomes: Claude Code reads a spec → authors the snippet pools directly in `src/cards/compose/pools/<template>/<slot>.ts` → runs `runAllGates` + the situation's tests → iterates to green → commits. The spec format and the gates are kept exactly; only *who generates* changes.

**The work.**
- Write the authoring-loop recipe — the standing Claude Code prompt and the gate-to-green checklist — into this doc (Appendix) or a short companion.
- Archive/delete `scripts/generate-pool/` and `.github/workflows/generate-pool.yml`, and drop the `ANTHROPIC_API_KEY` secret usage. Nothing should call the Anthropic API at build time after this.
- Fold the pipeline's structural guarantees that lived *outside* the gates (dedupe threshold, specificity-sorted emit) into the gate/test suite, so an agent-authored pool is held to the identical bar the pipeline enforced.

**Read first.** `phase-125-generation-pipeline.md` (precisely what's being retired and why it existed). `card-composition-framework.md §6–7`. `scripts/generate-pool/` (the dedupe + emit guarantees to preserve as tests).

**Done when.** A documented, repeatable Claude-Code authoring loop exists; the API pipeline and its workflow are removed; `runAllGates` + per-situation tests are the sole quality bar; the two existing pools still pass unchanged; `npm test` and `npm run typecheck` green.

**Do not do.** Don't redesign the spec format. Don't weaken any gate. Don't leave a dormant API path "just in case."

```
Enter plan mode. Voiced Surface arc, Phase 4 (Authoring Loop).
Read phase-125-generation-pipeline.md, card-composition-framework.md §6–7, and
scripts/generate-pool/. Write a phase plan in docs/plans/ to (a) define a
repeatable Claude-Code pool-authoring loop — read spec, author pools in-repo,
run runAllGates + the situation tests, iterate to green, commit — and document
it as a standing recipe; (b) retire scripts/generate-pool/ and
.github/workflows/generate-pool.yml and the API key usage; (c) port the
pipeline's dedupe + specificity-sorted-emit guarantees into the gate/test suite
so agent-authored pools meet the same bar. Keep the spec format and every gate
exactly. Existing pools must still pass. Wait for plan approval.
```

---

## Phase 5 — Title & Frame Discipline

**Provisional:** phase 131 / ISSUE-100. Cross-cutting; lands before any migration so all 20 situations inherit it.

**Goal.** Fix card framing once. Titles today truncate mid-phrase ("…a word before…") because a composed phrase is clamped to six words, and duplicate "label: subject" ("Main Room: Main Room") because the subject *is* the label. Make the title a **composed slot** with its own pool and budget; forbid the truncation-ellipsis and the duplication structurally.

**The work.**
- Title becomes a `SlotSpec` (gated, budgeted) instead of `formatTitle`/`composeTitle` string-glue. A title that would exceed budget is *authored shorter*, never clamped with "…".
- Collapse subject-equals-label to a single mention.
- Retire the title path in `voice/composer.ts`; add a voice-bounds gate check that fails on a trailing "…" or an immediate duplicated token in a title.

**Read first.** `voice/composer.ts` (`composeTitle`/`clampWords` — what's being replaced) and `cardHelpers.ts` (`formatTitle`). `card-composition-framework.md §4` (budgets) + `§6` (voice-bounds). `drinkOrder.ts` + `staffAside.ts` (the two templates that adopt it first).

**Done when.** Titles are composed snippets within budget with no truncation ellipsis and no label/subject duplication; the two migrated templates adopt the composed title; a gate fails a mid-phrase-clamped or duplicated title; `npm test` and `npm run typecheck` green.

**Do not do.** Don't touch choice/stakes plumbing here. Don't migrate the other templates yet.

```
Enter plan mode. Voiced Surface arc, Phase 5 (Title & Frame Discipline).
Read voice/composer.ts, cardHelpers.ts (formatTitle), card-composition-framework
§4 + §6, and the drinkOrder/staffAside templates. Write a phase plan in
docs/plans/ to make the card title a composed SlotSpec with its own pool and
budget — authored-short, never clamped with an ellipsis — and to collapse
subject==label duplication. Retire the composer's title path; extend the
voice-bounds gate to fail trailing "…" and immediate duplication in titles.
Adopt it on the two existing compositional templates. Wait for plan approval.
```

---

## Phase 6 — Choice & Consequence Voice

**Provisional:** phase 132 / ISSUE-101.

**Goal.** Bring the response layer into composition so choices read as contextual answers, not generic verbs. Today choice labels are sim `labelHint` strings ("Pay a bonus", "Blame supplier") and previews are bare effect readables ("Loyalty rises"), untouched by voice — that is the entire "responses feel non-contextual" half of the complaint. Make labels and preview lines voiced/situation-aware **while the sim stays the mechanical source of truth**: the verb, target, and actual effects are unchanged; only the *wording* is composed.

**The work.**
- A choice-label slot kind and an effect-preview voicing pass keyed on `(verb, shape, family, signals)`.
- The sim still authors the mechanical intent and the consequence profile; composition selects the phrasing.
- Sim-coherence applies to previews: a voiced preview may only promise what the consequence profile guarantees.

**Read first.** `cardHelpers.ts` (`buildChoice`/`buildChoicesFromSeed`, `labelHint`, `previewEffects`). `issueSeedTypes.ts` (`ResponseSlot`, `ConsequenceProfile`, `ResponseIntentVerb`). `cards-contract.md` (the choices section). `card-composition-framework.md §4` (compose-don't-invent) + `§6` (sim-coherence).

**Done when.** Choices and previews are voiced and situation-aware on the two migrated templates; the mechanical truth (verb/target/effects) is provably unchanged by a test; sim-coherence holds on previews; `npm test` and `npm run typecheck` green.

**Do not do.** Don't change what choices *do*. Don't let composition promise an effect the consequence profile doesn't carry.

```
Enter plan mode. Voiced Surface arc, Phase 6 (Choice & Consequence Voice).
Read cardHelpers.ts, issueSeedTypes.ts (ResponseSlot/ConsequenceProfile), the
cards-contract choices section, and card-composition-framework §4 + §6. Write a
phase plan in docs/plans/ to compose voiced, situation-aware choice labels and
effect previews keyed on (verb, shape, family, signals), with the sim still the
mechanical source of truth — verb/target/effects unchanged, only wording
composed, and previews bound by sim-coherence. Prove mechanical equivalence with
a test. Adopt on the two existing compositional templates. Wait for plan approval.
```

---

# MOVEMENT II — Migrate every card situation

**The shared shape of phases 7–13.** Each is one Phase-4 authoring loop over a domain cluster: author the spec(s) and pools (establishing-line + reaction + voiced choices), run `runAllGates` + per-situation tests to green, then **delete the legacy hand-written template(s) and their `tonePools.ts` entries**. Each cluster reuses the Phase-C runtime, the Phase-1 signals, the Phase-2 cast, and the Phase-5/6 frame and choice work unchanged. The standing prompt is the **Phase-4 authoring loop**; per phase, name the cluster, the seed families/types, and the legacy template(s) being superseded.

**Generic "done when" for 7–13.** The cluster renders voiced cards with a sim-backed establishing line, a voiced reaction, and voiced choices; the legacy template(s) and their tonePool entries are gone; `runAllGates` + per-situation tests + determinism green; the same actor's `voiceProfile` drives selection.

| Phase | Provisional | Cluster | Seed families / types | Supersedes |
|---|---|---|---|---|
| 7 | 133 / ISSUE-102 | **Staff & Personnel** | `staff_identity`, `staff_burnout` (relationship_test, staff_request, complaint) | `staffRequest`; *finishes* `staffAside` (real establishing line, dangling fragment removed) |
| 8 | 134 / ISSUE-103 | **Regulars & Complaints** | `regular_customer`, `customer_complaint` | `customerComplaint` (this is the framework's own §8 worked example) |
| 9 | 135 / ISSUE-104 | **Suppliers, Stock & Debt** | `supplier_relationship`, `stock_shortage`, `debt_rent` | `supplierOffer` (uses the Phase-3 converged spec) |
| 10 | 136 / ISSUE-105 | **Factions & Culture** | `faction_request`, `culture_conflict` | `factionRequest` |
| 11 | 137 / ISSUE-106 | **Premises & Atmosphere** | `maintenance`, `area_atmosphere` | `maintenanceWarning` |
| 12 | 138 / ISSUE-107 | **Crises & Safety** | `food_safety`, `violence`, `inspection` | `foodSafetyCrisis` (a high-severity register; mind the severity-gated gradient) |
| 13 | 139 / ISSUE-108 | **Reputation, Rumour & Rivals** | `reputation_shift`, `rumour_crisis`, `rival_tavern` | `reputationWeekly` |

**Phase 14 — Periodic & Narrative Beats.** **Provisional:** phase 140 / ISSUE-109. Last in Movement II because it bridges to reports. Migrates `monthly_review`, `seasonal_arc`, and the weekly overview — the longer voiced *summaries*, which are report-shaped rather than single-beat cards. Supersedes `monthlyReview`. Done when these render voiced multi-line summaries through composition with sim-backed claims, legacy template gone, gates + tests green.

```
(Per-cluster standing prompt — fill in <CLUSTER>, <FAMILIES/TYPES>, <LEGACY>.)
Enter plan mode. Voiced Surface arc, Movement II, situation cluster: <CLUSTER>.
Use the Phase-4 authoring loop. Read cards-contract §3.3 for <FAMILIES/TYPES>,
the compose slice, the Phase-1 signals these situations need, and the Phase-3
established-line pattern. Write a phase plan in docs/plans/ for one compositional
template per situation in this cluster, each with a sim-backed establishing slot,
a flavor reaction slot, the Phase-5 composed title, and Phase-6 voiced choices.
Author the spec(s) and pools in-repo, run runAllGates + per-situation tests to
green, then DELETE <LEGACY> and its tonePools.ts entries. Voice is a generation
dimension selected by actor voiceProfile. Wait for plan approval before coding.
```

---

# MOVEMENT III — The rest of the diegetic surface

## Phase 15 — Reports Prose

**Provisional:** phase 141 / ISSUE-110.

**Goal.** Extend composition to the **Reports tab** — daily/weekly/monthly report sections — so summaries speak in the same voice system instead of templated stat-lines. The `ReportSection` shape stays; its prose becomes composed and sim-backed.

**Read first.** `src/sim/core/reports.ts` (`ReportSection`), `src/reports/` and `web/` reports layer, the Phase-14 periodic beats (the closest precedent), `card-composition-framework.md §4` + `§6`.

**Done when.** Report sections render composed, sim-coherent prose; numbers remain exact (composition voices around them, never restates them wrongly); gates + tests green.

**Do not do.** Don't alter what reports *measure*. Don't let prose contradict the figures.

```
Enter plan mode. Voiced Surface arc, Phase 15 (Reports Prose). Use the Phase-4
authoring loop. Read src/sim/core/reports.ts, the reports layer in src/reports/
and web/, the Phase-14 periodic beats, and card-composition-framework §4 + §6.
Write a phase plan in docs/plans/ to compose report-section prose through the
snippet layer with sim-backed claims, keeping every figure exact and the
ReportSection shape unchanged. Gate for sim-coherence and determinism. Wait for
plan approval.
```

---

## Phase 16 — Ambient Surface & Legacy Retirement

**Provisional:** phase 142 / ISSUE-111.

**Goal.** Voice the **last** of the surface — day-beat empty states (morning/service/closing/quiet), the **tavern log**, first-encounter hints, and the **fallback card** itself — then **delete `tonePools.ts` and the legacy composer path entirely.** After this, nothing in the codebase references the old adjective-gluing composer.

**Read first.** `voice/composer.ts` (`composeEmpty`, `EMPTY_STATE_POOLS`) and `voice/tonePools.ts` (what's being deleted). The tavern-log layer (`phase-94-tavern-log.md`), first-encounter hints (ISSUE-080 web chassis), and `templates/fallback.ts`. `card-composition-framework.md §6`.

**Done when.** Empty states, the tavern log, hints, and the fallback card all render through composition; `tonePools.ts` and the legacy composer path are removed and unreferenced; a test asserts no import of the retired path remains; gates + tests + typecheck green.

**Do not do.** Don't leave the legacy composer importable. Don't regress the fallback's "always renders something" guarantee.

```
Enter plan mode. Voiced Surface arc, Phase 16 (Ambient Surface & Legacy
Retirement). Use the Phase-4 authoring loop. Read voice/composer.ts and
voice/tonePools.ts, the tavern-log layer, the first-encounter hints, and
templates/fallback.ts. Write a phase plan in docs/plans/ to voice the day-beat
empty states, tavern log, hints, and fallback card through composition, then
delete tonePools.ts and the legacy composer path and assert (by test) nothing
imports them. Preserve the fallback's always-renders guarantee. Wait for plan
approval.
```

---

# MOVEMENT IV — Finish

## Phase 17 — Cross-Situation Voice Consistency

**Provisional:** phase 143 / ISSUE-112. Needs ≥3 migrated situations to be meaningful.

**Goal.** This is the centerpiece of the original Living Cast vision, finally made testable: a gate + harness proving the **same character is recognizably themselves across situations** — ordering, complaining, asking for a raise, grumbling about rent — driven only by their `voiceProfile`. A terse-cold dwarf reads terse-cold whether they're at the bar or in the back office.

**The work.** A harness that holds one `voiceProfile` fixed and samples its lines across every migrated template, plus a consistency metric/assertion (a high-terseness actor never draws a florid line; verbal tics surface across registers). Add it to `runAllGates` or as a sibling suite.

**Read first.** `card-composition-framework.md §5–6` (the `actorTrait`/voice seam and the gates). The Phase-D gate harness (`src/cards/compose/gates/`). `living-cast-arc.md` Phase F's "the same character speaks consistently" goal.

**Done when.** A fixed `voiceProfile` produces recognizably consistent lines across all migrated situations; a deliberately inconsistent pool (florid line reachable by a terse-max actor) fails the gate; tests + typecheck green.

**Do not do.** Don't add new voice axes here to "fix" inconsistency — fix the offending pool or feed the gap back to a spec.

```
Enter plan mode. Voiced Surface arc, Phase 17 (Cross-Situation Voice
Consistency). Read card-composition-framework §5–6, the Phase-D gate harness in
src/cards/compose/gates/, and living-cast-arc.md Phase F. Write a phase plan in
docs/plans/ for a harness + gate that holds one voiceProfile fixed, samples its
lines across every migrated template, and asserts recognizable consistency
(no out-of-register lines reachable; tics surface across situations). Include a
deliberately-inconsistent fixture that must fail. Wait for plan approval.
```

---

## Phase 18 — Deepening, Pruning & Tuning

**Provisional:** phase 144 / ISSUE-113. Standing — never strictly done.

**Goal.** Play it. Add specific high-rung snippets where a moment deserves more; delete dead snippets whose conditions stopped firing; tune `voiceProfile` axes and `CULTURE_VOICE_DEFAULTS` where a kind of character isn't landing. The gates keep every edit safe, so the gradient can deepen forever at zero structural cost.

**Done when.** It's a game whose cast feels alive in play across the whole surface — and there is no final checkmark here, by design. The diversity and consistency gates make "add more, safely" the steady state.

```
Enter plan mode. Voiced Surface arc, Phase 18 (Deepening, Pruning & Tuning).
Use the Phase-4 authoring loop. From playtest notes, write a phase plan in
docs/plans/ to add specific up-the-gradient snippets where moments deserve more,
prune snippets whose conditions no longer fire (proven dead by a coverage/
diversity check), and tune voice axes / culture defaults for characters that
aren't landing. Every change passes runAllGates. Wait for plan approval.
```

---

## If you only remember three things

1. **Context comes from the sim being reachable, not from more prose.** Movement I (especially Phase 1's signal surface and the Phase-3 establishing line) is what makes cards say *what happened*. Skipping it just scales today's mood-only thinness.
2. **Authoring is a Claude Code run, gated to green — not an API call.** The Phase-4 loop is the scaling unit; the six gates are the reviewer. You author specs; the gates pass pools.
3. **It's the Living Cast spine, generalised.** Same framework, same flavor/sim-backed split, same "voice is a generation dimension." This arc just carries it to sim-backed claims and to every line in the game, then makes consistency testable.

---

# Appendix A — The Claude Code authoring loop

**Landed in Phase 4 (ISSUE-099 / phase 130).** The Phase-125 build-time pipeline (`scripts/generate-pool/`, `.github/workflows/generate-pool.yml`, the strict `GenerationSpecSchema`, the `ANTHROPIC_API_KEY` secret usage) is gone. The repeatable scaling unit is now an in-repo Claude Code plan-mode run. The structural guarantees that lived inside the pipeline survive as a seventh gate (`checkDedupe`) in `src/cards/compose/gates/`; the six framework gates are unchanged.

## When you use it

A migration phase (Movement II) or any future situation: the situation has a converged spec under `specs/cards/<situation>.spec.yaml` and you want a `SnippetPool` for one or more of its slots.

## The standing prompt

```
Enter plan mode. Authoring pools for <situation>.

Read:
- specs/cards/<situation>.spec.yaml (the spec — slots, voiceRegister,
  voiceAxesInPlay, verbalTicsCovered, hardBounds.perSlotWords, mustNotInvent,
  positiveExemplars, negativeExamples, snippetPools, diversityCases, mustPass)
- src/cards/compose/pools/drinkOrder/orderLine.ts (the existing pool file
  shape — header, `import type { SnippetPool }`, snippet objects)
- docs/plans/card-composition-framework.md §2–6 (data primitives + gates)
- docs/plans/living-cast-arc-phase-b.md (the flavor/sim-backed split)

For each `snippetPools[]` entry whose `status` is unset (i.e. not
DISABLED_FOR_SPIKE / SIGNAL_AVAILABLE), author the pool directly at
`src/cards/compose/pools/<templateId>/<slotId>.ts`, matching the existing
file shape exactly. Honour the spec's hardBounds, positiveExemplars,
negativeExamples, voiceAxesInPlay coverage, and verbalTicsCovered.

When you have one slot drafted, run:
  npm test -- --run tests/cards/compose/gates/
  npm test -- --run tests/cards/templates/<situation>
  npm run typecheck

Read each failing gate's report (coverage / specificity / voiceBounds /
simCoherence / determinism / diversity / dedupe). Fix the offending
snippet(s) in place and re-run. Iterate to green per slot before moving
to the next. When all pools clear runAllGates + per-situation tests +
typecheck + the full `npm test -- --run`, commit.
```

## The gate-to-green checklist

For every authored slot:

1. `npm test -- --run tests/cards/compose/gates/dedupe.test.ts` — your new pool has no near-duplicate pair within the slot, and no canonical-equal text across slots.
2. `npm test -- --run tests/cards/compose/gates/` — all seven structural gates pass (coverage, specificity, voiceBounds, simCoherence, determinism, diversity, dedupe). Per-template integration tests should exercise the live template through `runAllGates`.
3. `npm test -- --run tests/cards/templates/<situation>` — the situation's own template tests pass.
4. `npm run typecheck` — types green.
5. `npm test -- --run` — full regression green.

A failing gate emits a `GateViolation[]` naming the offending `slotId` / `snippetId` and a stable `reason` string. Match on the reason to know which class of fix the snippet needs:

| Gate | Failure modes |
|---|---|
| `coverage` | A required slot has no unconditional fallback. Add one snippet with `conditions: []`. |
| `specificity` | A higher-specificity snippet is unreachable given the gradient. Adjust conditions or remove the dead higher rung. |
| `voiceBounds` | A snippet exceeds `slot.wordBudget` (or `hardBounds.perSlotWords[slotId]`). Rewrite shorter; never clamp with `…`. |
| `simCoherence` | A snippet invents a name or makes a checkable claim a signal doesn't back. Either drop the claim or add a Phase-1 signal condition. |
| `determinism` | The same `(seed, state)` resolves to two different snippets. Tighten conditions or break a tie via the FNV id. |
| `diversity` | Sampling under realistic voice perturbation collapses too narrowly. Add an alternative phrasing or relax an over-tight condition. |
| `dedupe` | Two snippets within a slot are ≥ 0.85 similar (canonical), or two across slots are canonically equal. Reword one. |

## Iterate-on-violation recipe

No retry budget. The agent iterates until green or names the **spec gap** (a missing voice axis, a missing signal, a hardBound that's too tight). A spec gap is fed back to the spec author — it is not papered over in the pool.

## Commit hygiene

One commit per slot reaching green keeps the history bisectable. Final commit message ties the cluster to its ISSUE-NNN entry and the situation name.

## What does NOT survive pipeline retirement

- The Anthropic SDK dependency, the `ANTHROPIC_API_KEY` secret, and the `workflow_dispatch` GitHub Action — gone.
- The strict Zod `GenerationSpecSchema` that rejected unknown spec keys — gone. Specs are design artifacts the agent reads; the arc documents what shapes they take.
- The deterministic emitter that produced byte-identical output from the same model response — gone with no replacement. Hand-authored pools are written in readability order (fallback first, then by axis or theme); they have no automated re-run to be stable across.
- The retry loop, parser, and prompt builder — gone. The agent's plan-mode iteration replaces them.

## What DOES survive

- All six framework gates, unchanged.
- The new seventh gate `checkDedupe` (0.85 within-slot, canonical-equality cross-slot), enforcing the structural guarantee that lived inside the pipeline's dedupe step.
- Every committed spec under `specs/cards/`.
- Every committed pool under `src/cards/compose/pools/`.
- `representativeBannedNames` for the sim-coherence gate.
