# The Legible Surface Arc — Every Line Earns Its Place in the Decision

**The Voiced Surface arc made every line *speak*. This arc makes every line *inform*.** Voiced Surface closed the "cards dump raw fragments" wound — `tonePools.ts` is gone, titles are composed, every situation routes to a tested compositional template, and a fixed `voiceProfile` reads recognizably across situations. A render audit over thousands of cards confirms it: zero crashes, zero degenerate output, zero truncated titles, zero raw fragment dumps. The surface is voiced. But voicing solved the *prose* problem and quietly opened a *legibility* problem, and that is the whole of this arc:

1. **The establishing line states *a* fact, not the *salient* one.** A supplier at mid reliability / mid relationship says "the ledger remembers" or "talk's been turning sour" — never the standing the card is actually *about*. The specificity gradient picks whichever single condition fires, which is not the same as the fact that makes the choice interesting.
2. **The choice previews hide the mechanics they were supposed to surface.** "the meter would settle a notch", "pressure would ease its reading" — no *which* meter, no *how much*, no *what it costs*. Worse, the Phase-6 voiced-label layer *collapses mechanically-distinct slots into the same rendered string*: the supplier seed emits eleven separate response slots ("Place a standing order", "Sign exclusivity", "Split orders", "Negotiate") and four of them render as the identical "Cut the terms shorter." Two distinct effects on one choice render as the same preview line. **The voiced card is, in places, less legible than the un-voiced labels were.**

These are not bugs — the pipeline does exactly what it was told. They are the design frontier: voicing optimized for *how it sounds* and never had a contract for *whether the player can decide*. This arc writes that contract and then authors the content that satisfies it, mapping prose to two different halves of the simulation:

- **"Does the text make sense given the context?"** is answered by **state meters** — the seventeen `src/sim/signals/` bands, the pressures, memory, repeat-count. Content keys on *what the world is*. (Movement VI.)
- **"Does it give enough to decide?"** is answered by **effect descriptors** — `EffectTargetKind`, `EffectDirection`, `EffectMagnitudeBand`, and cost. Content keys on *what each choice does*. (Movement VII.)

Authoring against two different variable sets is what gives this arc its volume: large writing passes, one per meter cluster and one per effect-meter family, each a branching matrix rather than a handful of lines.

**This is the continuation of [`voiced-surface-arc.md`](voiced-surface-arc.md).** That arc's Phase 18 ("Deepening, Pruning & Tuning") is *generalised here* into a disciplined, gated content programme with a legibility contract behind it. Read it first — the compose runtime, the seven gates, the flavor/sim-backed split, the Phase-4 authoring loop, and "voice is a generation dimension, not a runtime transformer" all carry over unchanged. The signal surface (Phase 1) and the per-effect descriptors (`effectTargetKind` / `effectDirection` / `effectMagnitudeBand`, shipped in Phase 18 iteration 2) are the seams this arc finally authors *content* against.

**Pairs with:**
- [`card-composition-framework.md`](card-composition-framework.md) — the runtime: `Snippet` / `SnippetPool` / `SnippetCondition`, `assembleSlots`, the specificity gradient, and the structural gates (§6). Unchanged. This arc adds a *salience* read on top of the gradient and a *distinctness* gate beside the existing seven.
- [`cards-contract.md`](cards-contract.md) — **LOCKED.** Compose don't invent, reference by id, skip invalid seeds, stable re-render. Nothing here weakens them. This arc adds a sibling principle (below) that points the same direction.
- The shipped signal surface under `src/sim/signals/` — seventeen banded meters (`supplier.reliability`, `staff.stress`, `area.damage`, `culture.tension`, …), `BAND_THRESHOLDS`, `bandOf` (`low`/`mid`/`high`), `querySignal`, `repeatCountByTag`, `pressureIsRising`.
- The effect descriptors in [`src/sim/core/effect.ts`](../../src/sim/core/effect.ts) — `EffectTargetKind` (16 values), `EffectDirection` (`positive`/`negative`/`neutral`), `EffectMagnitudeBand` (`tiny`/`small`/`medium`/`large`), and the `effectTargetKind` / `effectDirection` / `effectMagnitudeBand` condition primitives that read them.

---

## Two principles this arc bakes in

These are decisions taken *for* this arc; later phases assume them. They are to legibility what Voiced Surface's "authoring is a Claude Code run" and "the fix reaches into `src/sim/`" were to voicing.

1. **Salience beats the gradient.** The specificity gradient answers "which snippet is most *specific*"; it does not answer "which fact is most *decision-relevant*." A supplier card is *about* reliability × relationship, so when both resolve, the establishing line must state the pair, not whichever single condition happens to out-specify the other. Phase 1 adds a small, pure, inspectable **salience ordering** over the signal/pressure/repeat reads a situation can make, and a **multi-fact establishing slot** that can state the top one or two. This is additive: the gradient and the six framework gates are untouched; salience is a read *into* slot selection, not a rewrite of it. It stays data, stays enumerable, stays deterministic.

2. **Composition may compress wording but must never erase mechanical distinctness.** This is the inverse of the Voiced Surface rule. There the danger was *inventing* truth ("compose, don't invent"); here the danger is *erasing* it. A voiced label may be shorter than `labelHint`, but two response slots the sim deliberately kept separate (`place_standing_order` vs `supplier_exclusivity_deal`) must never render with the same label. A voiced preview may be prettier than `effect.readable`, but it must carry the effect's direction, magnitude band, and target meter, and two distinct effects on one choice must not collapse to one line. Phase 2 writes this into a **preview legibility contract**; Phase 3 enforces the label half with a **distinctness gate** beside the existing seven. The simulation stays the mechanical source of truth — verbs, targets, amounts, and slot identity are never touched; only wording is composed, and now wording is *held accountable* for preserving what it voices.

---

## The spine at a glance

```
  MOVEMENT V   — Foundations of legibility (make context decision-relevant; make previews honest)
   1  Signal Salience           rank meters by decision-relevance; multi-fact establishing slot   ← Q1's machine
   2  Preview Legibility        direction + magnitude + target-meter + cost on every preview;      ← Q2's machine
                                 the passive/inaction option previews its cost too
   3  Choice Distinctness       a gate that fails colliding labels; a legible choice-set cap       ← stops voicing erasing

  MOVEMENT VI  — Establishing & reaction content  (Q1: "does the text make sense?")  ← keyed to STATE METERS
   4  Suppliers, Stock & Debt        supplier.reliability × relationship; stock; debt/rent
   5  Staff & Personnel              staff.stress × fatigue; morale; tenure/role
   6  Regulars & Complaints          regular.irritation × loyalty; customer_group.satisfaction × loyalty
   7  Factions & Culture             faction.relationship × influence; culture.tension × comfort × familiarity
   8  Premises & Atmosphere          area.condition × cleanliness × damage
   9  Crises & Safety                customer_group.rowdiness; food-safety severity; inspection threat
  10  Reputation, Rumour & Rivals    reputation deltas; rumour spread/repeat; rival pressure
  11  Periodic & Narrative           monthly aggregates; seasonal_arc stages (cards, not reports)

  MOVEMENT VII — Preview & stakes content  (Q2: "can I decide?")  ← keyed to EFFECT TARGET METERS, authored per-meter
  12  Economic previews          coin / stock / debt              (direction × magnitude, calibrated weight)
  13  Social previews            loyalty / satisfaction / relationship / reputation / renown / cohort / culture
  14  Operational previews       stress / fatigue / condition / cleanliness / damage / rowdiness / tension / pressure
                                 + the rising-pressure and delayed/uncertain-effect framing

  MOVEMENT VIII — Reports & Finish
  15  Report-Prose Legibility    the Reports tab states the salient figure and its movement, not a templated stat-line
  16  Legibility Gate            every migrated card passes BOTH questions, machine-checked        ← the centerpiece
  17  Deepening & Tuning         play; deepen the matrices; recalibrate bands                      ← standing
```

**You are here:** Voiced Surface is complete through Phase 18 (`tonePools.ts` retired, twenty situations compositional, cross-situation consistency gated, two playtest iterations landed). Every line speaks. Next is Phase 1 of *this* arc.

**The one ordering rule:** Movement V is a hard prerequisite for everything after it — 1 → 2 → 3 in order. Phase 1 unblocks every Movement-VI content phase (they author against the salience read). Phases 2–3 unblock Movement VII (previews author against the legibility contract; the distinctness gate must exist before content can be held to it). Within Movement VI the eight content phases (4–11) can be reordered freely. Movement VII's three phases (12–14) can be reordered freely but all follow Movement V. Movement VIII follows everything; Phase 16's gate needs ≥3 migrated clusters and ≥2 preview-meter passes to be meaningful, so it lands late. Expect *one* loop back from an early Movement-VI phase to Phase 1 (the first content matrix will name a salience tie the ranking doesn't break, or a meter pair the multi-fact slot can't express) — that is the system working, exactly as Voiced Surface looped Phase 3 back to Phases 1–2.

**Phase numbers and ISSUE ids below are provisional labels, not a ladder.** The repo numbers them continuing from ISSUE-113 / phase 145 — so **ISSUE-114… / phases 146…**. Register each in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md) when you commit it, walk them in `Depends on` order, and let the dependency chains — not the integers — drive execution.

**The scaling unit is unchanged.** Every content phase (4–15) is a [Phase-4 Claude-Code authoring loop](voiced-surface-arc.md#appendix-a--the-claude-code-authoring-loop): read the spec → author the pools in-repo → run `runAllGates` + the situation's tests → iterate to green → commit. This arc adds two gates to the bar (`legibility`, `choiceDistinctness`) but does not change the loop.

---

# MOVEMENT V — Foundations of legibility

## Phase 1 — Signal Salience & the Multi-Fact Establishing Line

**Provisional:** phase 146 / ISSUE-114.

**Goal.** Make the establishing line state the *decision-relevant* fact, not the gradient-winning one. Today `pickSnippet` returns the highest-specificity matching snippet; when a supplier resolves both a reliability band and a relationship band, the card states whichever single condition out-specifies the other (often neither — the two-condition `band+repeat` rung rarely fires, so a one-condition mood line wins). Add a pure, inspectable **salience ordering** over the reads a situation can make, and let the establishing slot state the top one *or two* facts so the body opens with the standing the choice actually turns on.

**The work.**
- Define a **salience table**: per situation (or per seed family), an ordered list of the signals / pressures / repeat-subjects that matter most to the decision, e.g. `supplier_relationship → [reliability, relationship, supplier_distrust(rising), repeatCount(supplier)]`. Data, not closures — a `Record<family, SignalSalienceRank[]>` the gates can enumerate, living beside `BAND_THRESHOLDS` in the signal layer or under `compose/`.
- Add a **multi-fact establishing slot kind**: a slot that resolves its top-salience matching snippet *and*, optionally, a second snippet for the next-most-salient orthogonal fact, joined into one ≤14-word line (or two short lines). Keep it a `SlotSpec` — no new template plumbing. Selection stays deterministic: same `(seed, state)` ⇒ same facts in the same order.
- Resolve **salience ties** explicitly (two facts equally salient ⇒ a stable, documented order — by band extremity, then by the salience-table index, then by FNV). No `Math.random`.
- Leave the specificity gradient and the six framework gates untouched. Salience is a read layered *over* matching candidates, applied per-slot where the slot opts in; flavor/reaction/sensory slots are unaffected.

**Read first.** `voiced-surface-arc.md` Phases 1 + 3 (the signal surface and the established-line convergence this builds on). `src/cards/compose/assemble.ts` (`pickSnippet` / `pickSnippetTrace` / `specificityOf` — what salience layers over). `src/sim/signals/` (the seventeen bands, `BAND_THRESHOLDS`, `querySignal`). `src/cards/compose/pools/supplierReliability/establishingLine.ts` (the pool whose thinness motivates this). `card-composition-framework.md §3` (the assembler) + `§6` (gates).

**Done when.** A situation can declare a salience order; the establishing slot states the top one-or-two salient facts as a single coherent line; selection is deterministic and re-render-stable; a test proves the supplier card opens with reliability×relationship when both resolve (not a bare mood line); the salience read is enumerable by the gates; `npm test` and `npm run typecheck` green.

**Do not do.** Don't author the content matrices yet (that's Movement VI). Don't add OR/NOT/nesting to conditions. Don't replace the specificity gradient — layer over it. Don't let the multi-fact line exceed its word budget by stapling two long facts together; if two facts won't fit, state the higher-salience one.

```
Enter plan mode. Legible Surface arc, Phase 1 (Signal Salience & Multi-Fact Establishing Line).
Read voiced-surface-arc.md Phases 1 + 3, src/cards/compose/assemble.ts,
src/sim/signals/ (all band signals + BAND_THRESHOLDS + querySignal),
src/cards/compose/pools/supplierReliability/establishingLine.ts, and
card-composition-framework.md §3 + §6. Write a phase plan in docs/plans/ to
(a) add a DATA salience ordering per seed family over its signals / pressures /
repeat-subjects, inspectable and enumerable; (b) add a multi-fact establishing
slot that states the top one-or-two salient facts as one ≤14-word line, with a
documented, deterministic tie-break (no Math.random); (c) layer this OVER the
specificity gradient without touching it or the six framework gates. Plan a
determinism + re-render-stability test and a test that the supplier establishing
line opens with reliability×relationship when both resolve. Additive only.
Wait for plan approval.
```

---

## Phase 2 — Preview Legibility Contract (& Consequence of Inaction)

**Provisional:** phase 147 / ISSUE-115.

**Goal.** Make every effect preview answer *which meter, which way, how much, at what cost* — and make the passive/ignore option preview its consequence instead of rendering blank. Today a voiced preview is pure flavor ("the meter would settle a notch") that drops the three structural facts the sim already attached to the effect (`targetKind`, `direction`, `magnitudeBand`) plus the cost. The contract this phase writes does not forbid voice — it requires voice to *carry* those facts.

**The work.**
- Define the **preview legibility contract**: a voiced immediate-effect preview must encode (i) its target meter (from `effectTargetKind`, optionally narrowed to the named meter), (ii) its direction (`positive`/`negative`/`neutral`), and (iii) its magnitude band (`tiny`/`small`/`medium`/`large`) — and a choice that spends a resource must surface that cost as one of its preview lines. "settle a notch" satisfies *direction* but not *meter* or *magnitude*; the contract requires all three be recoverable from the rendered set.
- Establish a **magnitude lexicon** per direction × band so authors have a calibrated vocabulary ("a hair / a step / a clear lift / a surge" rather than ad-hoc "a notch"). Data the gate and the authoring loop share, so `small` reads consistently across every meter.
- Fix the **inaction preview**: the `ignore`/`delay`/`refuse` slot currently previews `(no preview)` because its consequence profile is empty or its effect is a no-op. Give it a composed line stating what *not acting* costs ("the rot keeps spreading", "they leave unanswered") — sourced from the seed's stakes / delayed effects, never invented.
- Keep this a **contract + lexicon + a couple of pilot pools** (re-voice `supplierReliability` and `areaAtmosphere` previews to satisfy it). The full per-meter authoring is Movement VII; this phase proves the contract is satisfiable and wires the inaction path.

**Read first.** `src/sim/core/effect.ts` (`EffectPreview`, `EffectTargetKind`, `EffectDirection`, `EffectMagnitudeBand`). `src/cards/cardHelpers.ts` (`composeChoicesFromSeed` / `buildChoice` — where previews are composed and where the inaction blank comes from). `src/cards/compose/conditions.ts` (the `effectTargetKind` / `effectDirection` / `effectMagnitudeBand` arms). `phase-145-effect-preview-specificity.md` (the prior iteration that surfaced these descriptors). `src/cards/compose/gates/previewVariety.ts` (the existing variety gate this contract sharpens).

**Done when.** A documented preview legibility contract + magnitude lexicon exists; the two pilot situations' previews each encode meter + direction + magnitude and surface cost where a resource is spent; the inaction option renders a sourced consequence line instead of blank; sim-coherence still holds (a preview promises only what the consequence profile carries); `npm test` and `npm run typecheck` green.

**Do not do.** Don't change what effects *do* — verbs/targets/amounts are untouched; only the rendered string changes. Don't invent a cost or consequence the seed doesn't carry. Don't author all per-meter pools here. Don't print raw numbers if the design is banded — the lexicon is the interface, calibrated to the band.

```
Enter plan mode. Legible Surface arc, Phase 2 (Preview Legibility Contract & Inaction).
Read src/sim/core/effect.ts, src/cards/cardHelpers.ts (composeChoicesFromSeed /
buildChoice), src/cards/compose/conditions.ts (effectTargetKind / effectDirection /
effectMagnitudeBand), phase-145-effect-preview-specificity.md, and
src/cards/compose/gates/previewVariety.ts. Write a phase plan in docs/plans/ to
(a) define a preview legibility contract: every immediate-effect preview must
encode target meter + direction + magnitude band, and resource-spending choices
must surface cost; (b) add a calibrated magnitude lexicon (direction × band)
shared by gate and authors; (c) make the inaction/ignore option preview its
sourced consequence instead of blank; (d) re-voice the supplierReliability and
areaAtmosphere preview pools as pilots. Sim stays mechanical truth — only strings
change, and only promise what the consequence profile carries. Wait for approval.
```

---

## Phase 3 — Choice Distinctness Gate & Legible Choice-Set Cap

**Provisional:** phase 148 / ISSUE-116.

**Goal.** Stop the voicing layer from erasing what the sim kept separate, and stop an eleven-slot seed from rendering an eleven-choice wall. Two failures, one phase: (i) four supplier slots render as the identical "Cut the terms shorter" because the label pool keys on `(verb, shape)` and several slots share them — the player cannot tell `place_standing_order` from `supplier_exclusivity_deal`; (ii) some seeds emit far more response slots than a player can weigh at once, with the genuinely-different options buried.

**The work.**
- Add a `choiceDistinctness` **gate** beside the existing seven (`coverage`, `specificity`, `voiceBounds`, `simCoherence`, `determinism`, `diversity`, `dedupe`): for a given seed's rendered choice set, **fail when two choices with distinct `(verb, targetId, slotId)` render the same label** (canonical-equal), and warn when two render near-identical previews. This is the structural inverse of the existing cross-slot `dedupe` gate — it protects *distinctness across choices*, not within a pool.
- Either (a) ensure the label pools carry enough slot-discriminating conditions that mechanically-distinct slots get distinct labels, or (b) where the design intends a slot's identity to come from its target/object, compose the label to include it (`"Standing order — {supplier}"` vs `"Exclusivity — {supplier}"`). The fix is pool/authoring-side; the gate is what proves it.
- Add a **legible choice-set policy**: a principled cap (and ordering) so a high-slot seed surfaces the most decision-relevant N choices, with the rest reachable but not crowding the first read. Reuse the Phase-1 salience instinct — order choices by the salience of the meter they move. Keep the cap a data knob, deterministic, and never drop the inaction option.

**Read first.** `src/cards/cardHelpers.ts` (`composeChoicesFromSeed` — one choice per response slot; this is where the wall and the collisions originate). `src/cards/compose/gates/dedupe.ts` + `gates/index.ts` + `gates/runAllGates.ts` (the gate harness this slots into). `src/cards/compose/pools/supplierReliability/choiceLabel.ts` (the colliding pool). The supplier generator's response slots in `src/sim/modules/issues/expandedSeedGenerators.ts` (eleven slots — the cap's worst case).

**Done when.** `runAllGates` includes `choiceDistinctness`; a deliberately-colliding fixture (two distinct slots, one label) fails it; the supplier card renders distinct labels for its distinct slots; a high-slot seed renders a capped, salience-ordered, inaction-preserving choice set; the mechanical truth (every choice still maps to its real slot/verb/target) is proven unchanged by a test; `npm test` and `npm run typecheck` green.

**Do not do.** Don't drop or merge response slots in the sim — the cap is a *presentation* policy over the rendered set, not a sim change. Don't let the cap hide the inaction option. Don't weaken any existing gate. Don't solve collisions by truncation/ellipsis (Phase-5 of Voiced Surface forbade that and it still holds).

```
Enter plan mode. Legible Surface arc, Phase 3 (Choice Distinctness & Legible Cap).
Read src/cards/cardHelpers.ts (composeChoicesFromSeed), the gate harness
(src/cards/compose/gates/dedupe.ts, index.ts, runAllGates.ts),
src/cards/compose/pools/supplierReliability/choiceLabel.ts, and the supplier
response slots in src/sim/modules/issues/expandedSeedGenerators.ts. Write a phase
plan in docs/plans/ to (a) add a choiceDistinctness gate that fails when two
choices with distinct (verb,targetId,slotId) render the same label and warns on
near-identical previews; (b) make the supplier (and any colliding) label pools
emit slot-distinct labels; (c) add a deterministic, salience-ordered, inaction-
preserving choice-set cap as a presentation policy — no sim slot changes. Prove
mechanical mapping is unchanged by a test. Add a colliding fixture that must fail
the gate. Wait for plan approval.
```

---

# MOVEMENT VI — Establishing & reaction content (Q1: "does the text make sense?")

**The shared shape of phases 4–11.** Each is one Phase-4 authoring loop over a domain cluster, but the *deliverable* is heavier than a Voiced-Surface migration: it is a **branching matrix of establishing snippets keyed to that cluster's state meters**, plus situational reaction and sensory lines that *also* move with state instead of standing fixed. For each situation in the cluster you (1) declare its salience order (Phase 1) over its meters; (2) author establishing snippets covering the salient *combinations* — a two-meter situation wants its low/mid/high × low/mid/high cells filled where they read distinctly, not one snippet per single condition; (3) replace the fixed reaction/sensory lines with pools that branch on at least one meter or pressure so "Speak plain, I've a route to make" becomes something a *struggling* supplier says differently from a *thriving* one; (4) run `runAllGates` (now nine gates) + the situation's tests to green; (5) commit.

**Generic "done when" for 4–11.** Every situation in the cluster opens on its salient fact(s) via the Phase-1 multi-fact slot; the establishing matrix covers the decision-distinct cells of that situation's meter space with no dead higher rungs; reaction/sensory lines vary with state, not just with `voiceProfile`; the diversity, salience, and (where choices change) distinctness gates pass; determinism holds; `npm test` + `npm run typecheck` green.

**The matrices are where the volume lives.** This table names the meter space each cluster authors against — the cells are the writing.

| Phase | Provisional | Cluster | Primary meters (the matrix) | Pressures / repeats in play |
|---|---|---|---|---|
| 4 | 149 / ISSUE-117 | **Suppliers, Stock & Debt** | `supplier.reliability` × `supplier.relationship` (9 cells); stock level bands; debt/rent standing | `supplier_distrust`↑, `market_instability`↑, `repeatCount(supplier)` |
| 5 | 150 / ISSUE-118 | **Staff & Personnel** | `staff.stress` × `staff.fatigue` (9 cells); morale; tenure/role | staff-burnout pressure↑, `repeatCount(staff)` |
| 6 | 151 / ISSUE-119 | **Regulars & Complaints** | `regular.irritation` × `regular.loyalty`; `customer_group.satisfaction` × `customer_group.loyalty` | `regular_customer_loss`↑, `repeatCount(complaint subject)` |
| 7 | 152 / ISSUE-120 | **Factions & Culture** | `faction.relationship` × `faction.influence`; `culture.tension` × `culture.comfort` × `culture.familiarity` (a 27-cell space — author the readable diagonal + extremes) | `cultural_tension`↑, faction-standing pressures↑ |
| 8 | 153 / ISSUE-121 | **Premises & Atmosphere** | `area.condition` × `area.cleanliness` × `area.damage` — state *which* is failing and *how badly* | maintenance/atmosphere pressures↑ |
| 9 | 154 / ISSUE-122 | **Crises & Safety** | `customer_group.rowdiness`; food-safety severity register; inspection-threat standing — high-severity gradient, mind the register | safety/inspection pressures↑ |
| 10 | 155 / ISSUE-123 | **Reputation, Rumour & Rivals** | reputation level + recent delta; rumour spread + `repeatCount(rumour)`; rival pressure | rumour/rival pressures↑ |
| 11 | 156 / ISSUE-124 | **Periodic & Narrative** | monthly aggregates (the salient mover of the month); `seasonal_arc` stage (prep → climax) — *cards*, not the Reports tab | `arc_escalation`↑, `festival_readiness` |

```
(Per-cluster standing prompt — fill in <CLUSTER>, <SITUATIONS>, <METERS>.)
Enter plan mode. Legible Surface arc, Movement VI, cluster: <CLUSTER>.
Use the Phase-4 authoring loop (voiced-surface-arc.md Appendix A). Read the
cluster's specs under specs/cards/, the existing establishing/reaction pools, the
Phase-1 salience read, and the signals for <METERS>. Write a phase plan in
docs/plans/ to, per situation: (a) declare its salience order over <METERS>;
(b) author a branching establishing matrix covering the decision-distinct cells
of its meter space (combinations, not single conditions) via the multi-fact slot;
(c) re-author reaction + sensory pools so they vary with at least one meter or
pressure, not stand fixed; (d) run runAllGates (nine gates incl. salience +
choiceDistinctness) + per-situation tests to green. Compose, don't invent; states
only what a signal backs. No new voice axes. Wait for plan approval before coding.
```

---

# MOVEMENT VII — Preview & stakes content (Q2: "can I decide?")

**Why per-meter, not per-cluster.** Previews recur across situations — a loyalty drop reads the same whether it comes from a complaint, a rumour, or a faction snub. Authoring them by *effect target meter* fills the `direction × magnitude` space once per meter family and reuses it everywhere, instead of re-writing "loyalty falls a little" inside eight cluster pools. Each phase is a Phase-4 authoring loop whose deliverable is a **preview pool (and matching stakes pool) covering every `EffectDirection × EffectMagnitudeBand` cell** for its meters, satisfying the Phase-2 legibility contract and the Phase-3 distinctness gate.

**Generic "done when" for 12–14.** For each meter the phase owns: every `(direction, magnitudeBand)` cell that the sim actually emits has a calibrated, contract-satisfying preview line; cost is surfaced where the meter is a resource; the matching stakes read consistently; the legibility gate (Phase 16) passes for cards whose effects hit these meters; determinism + `npm test` + `npm run typecheck` green.

## Phase 12 — Economic Previews

**Provisional:** phase 157 / ISSUE-125. **Meters:** `coin`, `stock`, `debt` (`EffectTargetKind` `coin` / `stock`, and debt/rent targets). **Goal.** The money-and-goods previews — where *cost* lives. Author the `negative×{tiny…large}` cost vocabulary ("a few coppers / a fair purse / a heavy outlay") and the `positive` inflows, calibrated so `small` means the same weight whether it's coin or stock, and so a choice that spends always shows its spend. Stakes: "the till", "the larder", "the rent".

## Phase 13 — Social Previews

**Provisional:** phase 158 / ISSUE-126. **Meters:** `customer`/`cohort` loyalty & satisfaction, `supplier`/`faction`/`culture` relationship, `reputation`, renown. **Goal.** The largest preview surface — relationship and standing. Author `direction × magnitude` per meter so "loyalty rises a step" is distinct from "reputation surges" and from "the guild cools a hair", and so the player can tell a *small social warmth* from a *large one*. Mind that several Movement-VI clusters feed these; this is the shared body they all draw from.

## Phase 14 — Operational Previews (+ Pressure & Delayed/Uncertain framing)

**Provisional:** phase 159 / ISSUE-127. **Meters:** `staff` stress/fatigue, `area` condition/cleanliness/damage, `customer_group` rowdiness, `culture` tension, and the `pressure` target kind. **Goal.** The room-and-crew previews, plus the two framings previews currently fudge: a **rising-pressure** effect ("the unrest would build another notch") and a **delayed or uncertain** effect ("later: the rot spreads" / "may steady the room"). Author `direction × magnitude` for each operational meter and a small, honest vocabulary for pressure-movement and for the `delayedEffects` path so deferred consequences are legible, not silent.

```
(Per-meter-family standing prompt — fill in <FAMILY>, <METERS>.)
Enter plan mode. Legible Surface arc, Movement VII, preview family: <FAMILY>.
Use the Phase-4 authoring loop. Read src/sim/core/effect.ts, the Phase-2 preview
legibility contract + magnitude lexicon, src/cards/cardHelpers.ts
(composeChoicesFromSeed), the effect* condition arms in conditions.ts, and
previewVariety.ts. Write a phase plan in docs/plans/ to author preview + stakes
pools for <METERS> covering every EffectDirection × EffectMagnitudeBand cell the
sim emits, calibrated to the shared lexicon, surfacing cost where the meter is a
resource, satisfying the legibility + distinctness gates. Only strings change;
amounts/targets/tags stay sim-owned; promise only what the consequence profile
carries. Run runAllGates + affected per-situation tests to green. Wait for approval.
```

---

# MOVEMENT VIII — Reports & Finish

## Phase 15 — Report-Prose Legibility

**Provisional:** phase 160 / ISSUE-128.

**Goal.** Carry both questions onto the **Reports tab**. Voiced Surface Phase 15 made report sections *speak* through composition; this phase makes them *inform* — a section opens on the salient figure and its movement ("takings up a third on the week, driven by the merchant trade") instead of a templated stat-line or a voiced-but-vague summary. Reports are the other diegetic surface, and they have the same gradient-vs-salience and number-legibility tensions cards do.

**The work.**
- Apply the **Phase-1 salience read** to report-section composition: of the figures a section could report, lead with the one that moved most / matters most, and name its direction and rough magnitude in the shared lexicon — while keeping the exact figure exact (composition voices *around* the number, never restates it wrongly).
- Apply the **Phase-2 legibility contract** to report previews/forecasts where a section projects forward.
- Reuse the report compose runtime (`assembleNotesList`, `reportSeed`, `gateAdapter`); the `ReportSection` shape is unchanged.

**Read first.** `src/sim/core/reports.ts` (`ReportSection`). `src/cards/compose/reports/` (`assembleNotesList`, `reportSeed`, `gateAdapter`). The Phase-1 salience read and the Phase-2 contract. Voiced Surface `phase-141`-equivalent (the reports-prose phase this extends). `card-composition-framework.md §6`.

**Done when.** Report sections open on the salient figure with legible direction + magnitude; every figure stays exact and uncontradicted; the salience + legibility checks pass for report seeds; `npm test` + `npm run typecheck` green.

**Do not do.** Don't change what reports *measure*. Don't let prose contradict the figures. Don't restate a number the section already shows in a way that could drift from it.

```
Enter plan mode. Legible Surface arc, Phase 15 (Report-Prose Legibility).
Use the Phase-4 authoring loop. Read src/sim/core/reports.ts,
src/cards/compose/reports/ (assembleNotesList, reportSeed, gateAdapter), the
Phase-1 salience read, the Phase-2 legibility contract + lexicon, and
card-composition-framework §6. Write a phase plan in docs/plans/ to compose
report-section prose that opens on the salient figure and states its direction +
rough magnitude in the shared lexicon while keeping every figure exact and
uncontradicted. Reuse the report runtime; ReportSection shape unchanged. Gate for
salience, legibility, and sim-coherence. Wait for plan approval.
```

---

## Phase 16 — The Legibility Gate

**Provisional:** phase 161 / ISSUE-129. **The centerpiece, made testable** — the analogue of Voiced Surface's Phase-17 cross-situation consistency gate.

**Goal.** A gate + harness that proves both questions are answered for every migrated surface: (Q1) the establishing line names a *real, salient* signal the state backs — not a bare mood line when a salient meter resolved; (Q2) every choice has a *distinct* label and a preview that encodes meter + direction + magnitude, the inaction option included, and no two choices collapse. Where Phase 17 of the last arc proved *the same character is recognizable*, this proves *the same card is decidable*.

**The work.** A harness that, across realistic sampled states, renders each migrated situation and asserts: the establishing slot resolved a salient signal whenever one was available (not the unconditional fallback); the choice set is distinct and capped; every immediate-effect preview satisfies the legibility contract; the inaction preview is non-empty. Add it to `runAllGates` or as a sibling suite. Include deliberately-failing fixtures: a card that opens on mood while a salient meter screams (fails Q1), and a card with a magnitude-stripped preview (fails Q2).

**Read first.** `card-composition-framework.md §5–6`. The Phase-D gate harness and the Phase-17 cross-situation gate (`src/cards/compose/gates/crossSituation.ts`) as the structural precedent. The Phase-1 salience read, Phase-2 contract, Phase-3 distinctness gate.

**Done when.** A fixed sampled state across all migrated situations passes both Q1 and Q2 assertions; the two deliberately-broken fixtures fail; the gate is part of the standing bar; `npm test` + `npm run typecheck` green.

**Do not do.** Don't fix a failing situation by weakening the gate — fix the pool or feed the gap back to the spec/salience table. Don't assert on exact wording (that's brittle and the diversity gate's enemy) — assert on the *structural facts* the wording must carry.

```
Enter plan mode. Legible Surface arc, Phase 16 (The Legibility Gate). Read
card-composition-framework §5–6, the gate harness in src/cards/compose/gates/
(esp. crossSituation.ts as precedent), and the Phase-1 salience read / Phase-2
contract / Phase-3 distinctness gate. Write a phase plan in docs/plans/ for a
harness + gate that, across sampled states, asserts for every migrated situation:
(Q1) the establishing line resolved a salient backed signal when one was
available; (Q2) choices are distinct + capped, every immediate preview encodes
meter + direction + magnitude, the inaction option previews non-empty. Assert on
structural facts, not exact wording. Include two failing fixtures (mood-over-salient;
magnitude-stripped preview). Add to the standing bar. Wait for plan approval.
```

---

## Phase 17 — Deepening, Pruning & Recalibration

**Provisional:** phase 162 / ISSUE-130. **Standing — never strictly done.** Future playtest iterations append to ISSUE-130.

**Goal.** Play it, reading for *decisions* this time, not voice. Fill the high-salience matrix cells a moment deserves (a third-month-running supplier shortfall earns a sharper line than the generic low-reliability rung). Prune cells whose conditions never fire (proven dead by coverage/diversity). And **recalibrate the bands and salience tables** where play shows a threshold is wrong — if `supplier.reliability` `mid` covers too much of the interesting range, move the cut-point; if a salience order opens on the wrong fact for a situation, reorder it. The nine gates keep every edit safe, so the matrices can deepen and the thresholds can tune forever at zero structural cost.

**Done when.** It's a game whose every card states what's true and shows what each choice costs — and there is no final checkmark, by design. The salience, legibility, distinctness, and diversity gates make "deepen and recalibrate, safely" the steady state.

```
Enter plan mode. Legible Surface arc, Phase 17 (Deepening, Pruning & Recalibration).
Use the Phase-4 authoring loop. From playtest notes focused on decision-legibility,
write a phase plan in docs/plans/ to: add high-salience matrix cells where moments
deserve them; prune dead cells (proven by coverage/diversity); recalibrate
BAND_THRESHOLDS and the Phase-1 salience tables where play shows a cut-point or
ordering is wrong. Every change passes runAllGates (nine gates). Wait for approval.
```

---

## If you only remember three things

1. **Voicing solved sound; this arc solves sense and decision.** Movement VI keys establishing/reaction prose to the seventeen state meters (Q1: "does it make sense?"); Movement VII keys previews/stakes to the effect descriptors (Q2: "can I decide?"). Two halves of the sim, two content bodies.
2. **Salience beats the gradient, and composition may compress but never erase.** The two principles up front are the whole spine: the establishing line states the *decision-relevant* fact (Phase 1), and the voiced layer is held accountable for preserving meter/direction/magnitude and slot distinctness (Phases 2–3). Everything after is content authored to satisfy them.
3. **It's the same loop, the same gates, plus two.** Every content phase is the Phase-4 Claude-Code authoring loop. The bar gains `salience` (woven into Phase 16's legibility gate) and `choiceDistinctness`. You author the matrices; the gates pass them.

---

# Appendix A — The content matrix is the unit of work

A Voiced-Surface migration authored *a pool per slot*. A Legible-Surface content phase authors *a matrix per situation* (Movement VI) or *a matrix per meter* (Movement VII). The matrix is the deliverable, and its cells are the writing:

- **Movement VI cell** = a `(meter-band-combination)` → establishing snippet. A two-meter situation has up to 9 decision-distinct cells; a three-meter one has up to 27, of which you author the readable diagonal and the extremes (the gates flag dead higher rungs you don't reach). Reaction/sensory pools each branch on ≥1 meter so they stop standing fixed.
- **Movement VII cell** = an `(EffectDirection × EffectMagnitudeBand)` → preview snippet, per meter, drawing on the shared magnitude lexicon so `small` reads consistently everywhere and cost is always visible where a resource moves.

**The gate-to-green checklist is the Voiced-Surface one plus two rows:**

| Gate | Failure mode (new this arc) |
|---|---|
| `salience` (in the legibility gate) | The establishing line resolved a bare mood/fallback while a salient meter was available. Author the missing matrix cell or fix the salience order. |
| `choiceDistinctness` | Two choices with distinct `(verb, target, slot)` rendered the same label. Add slot-discriminating conditions or compose the object into the label. |
| `legibility` (Phase 16) | A preview dropped meter / direction / magnitude, or the inaction option previewed blank. Re-author against the Phase-2 contract + lexicon. |

The other seven framework gates (`coverage`, `specificity`, `voiceBounds`, `simCoherence`, `determinism`, `diversity`, `dedupe`) are unchanged and still the floor. **No retry budget:** iterate to green or name the *gap* — a missing salience entry, a meter pair the multi-fact slot can't express, a band cut-point that's wrong — and feed it back to the table or the spec. A gap is fixed at the source, never papered over in a pool.
