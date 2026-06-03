# Phase 9 — Content/Data Quality, Balance, and Long-Run Simulation Behavior

## Scope and status

Phase 9 audited the content registries, long-run state surfaces, readiness
probes, and multi-month simulation behavior. The review covered:

- Content registries under `src/sim/content/*`, including cultures, factions,
  suppliers, naming profiles, notable NPCs, staff profiles, local arcs, area
  traits, area upgrades, and placeholder event registries.
- Long-run caps and pruning for memories, causes, root history, social rumours,
  weekly/monthly histories, pressure trend history, attribution state, issue-seed
  cooldown/recency state, regulars, expeditions, projects, and invoices.
- Readiness/balance scripts for 14-day and 28-day cardless runs.
- Additional 112-day and 365-day headless probes for no-input and policy-bot
  economies.

Audit result: the data-wide registries are mostly coherent and default state
cross-reference validation passes. Long-run caps exist for the major append-heavy
surfaces that previous phases flagged: root history, causes, weekly history,
monthly history, social rumours, pressure trends, and regular roster growth. The
largest confirmed defect found in this phase is a long-run debt/rent seed
validation failure: if the tavern remains unable to pay rent for long enough, the
`debt_rent` generator emits seeds with `urgency > 100`, causing validation errors
on every affected day. The balance/readiness probes also expose several tuning
or content-coverage candidates, but those are kept separate from confirmed bugs.

## Content registry inventory

| Registry / content surface | Count / shape observed | Cross-link status | Audit notes |
|---|---:|---|---|
| Naming profiles | 7 | Loaded before culture/staff/NPC factories. | Starter set includes generic plus culture-aligned profiles. |
| Cultures | 8 | All `namingProfileId` references resolve. | Default state seeds all culture world records. |
| Factions | 9 | Culture/supplier references resolve where present. | Default state seeds all faction world records. |
| Suppliers | 9 | Culture/faction references resolve where present. | Supplier registry count matches seeded supplier world records. |
| Market conditions | 8 | Registry-only, consumed by supplier/issue systems. | No missing ids found in the registry probe. |
| Local arcs | 5 | Consumed by local-arc module and issue seeds. | Active/resolved arc records are stored in `world.localEvents`. |
| Notable NPC profiles | 11 | Culture/faction/naming references resolve. | Default state seeds 11 notable NPCs. |
| Staff identity profiles | 15 | Naming/cast profile creation passes default validation. | Default staff roster remains intentionally small at 3 staff. |
| Area traits | 14 | Area upgrade trait references resolve. | Trait registry bounds area trait vocabulary. |
| Area upgrades | 18 | `addsTraits` / `removesTraits` references resolve. | Upgrade content appears internally coherent. |
| `localEventRegistry` / `seasonalEventRegistry` | 0 / 0 | Intentionally empty placeholder registries. | Tests still pin them as empty; active arc content moved through `localArcRegistry` and `world.localEvents`. |

The registry probe found `missingRefs 0 []` and `validateState(createInitialTavernState())`
passed. This does not prove every generated card path is reachable, but it rules
out obvious stale id references across the main authored data registries.

## Long-run state surface audit

| Surface | Producer(s) | Cap / pruning observed | Probe result / caveat |
|---|---|---|---|
| Root memories | Memory module plus response/social/project/attribution producers. | Non-fact memories age/expire; fact memories intentionally do not auto-expire. | 365-day no-input probe ended with 53 memories, so no explosive growth observed. Fact-memory volume remains a watch item if new producers add durable facts. |
| Root causes | Engine/context cause writes from most modules. | `DEFAULT_CAUSE_EXPIRY_DAYS = 5` in cause aging. | 365-day no-input probe peaked at 456 causes and ended with 345. |
| Root history | `ctx.addHistory` across service, owner actions, weekly/monthly, local arcs, pressures, etc. | History module monthly pruning keeps at least 500 entries or all entries within 90 days, whichever keeps more. | Probe history can exceed 500 because the age rule dominates; that matches the documented policy. |
| Social rumours | World/attribution/community producers. | Phase 83 monthly pruning policy, with tests for stale and max-count pruning. | Probe ended with 60 rumours and peaked around 70. |
| Weekly history | Weekly module. | `MAX_WEEKLY_HISTORY = 12`. | 112-day and 365-day probes both capped at 12. |
| Monthly history | Monthly module. | `MAX_MONTHLY_HISTORY = 12`. | 365-day probe capped at 12. |
| Pressure trend history | Pressure module. | `TREND_HISTORY_LIMIT = 7`. | All 21 pressure histories were length 7 after long runs. |
| Attributions | Attribution rules after service/end week/report generation. | Age/expiry exists; sticky high-publicness false attributions can persist. | Counts were high but stable-ish in probes: about 1.7k–1.9k. No hard cap exists, so add a targeted year-plus attribution cap/regression test before adding more sticky attribution producers. |
| Issue-seed cooldowns / recent picks | Issue seed ranking and family-specific rotation helpers. | No age pruning; keys are bounded by generator ids and authored/current entity ids in current content. | No runaway observed, but the shape should be included in future save-size dashboards. |
| Regular roster | Regular module. | Group cap plus inactive decay. | Probe stayed at 11 regulars. |
| Expeditions | Owner actions / expeditions module. | Active records resolve; completed log currently grows only when players commission expeditions. | No-input and current policy bots commissioned none, so this remains unprobed for high-expedition play. |
| Owner projects | Owner action project slice. | Active projects complete and remain in the project map. | Current policy bots did not stress project accumulation. Needs a player-action-heavy dashboard if project commissioning expands. |

## Readiness and balance probe results

### `diagnoseReadiness` highlights

The readiness script's hard-failing sections are mostly balance/content-quality
signals rather than state-integrity failures:

| Section | Result | Interpretation |
|---|---|---|
| Phase 20 `state_safety` | 100 / pass | 238 sampled day results validated. |
| Phase 20 `replayability` | 100 / pass | Same seed/input replay produced equivalent final state. |
| Phase 20 `cause_coverage` | 14 / fail | Only 82 of 602 significant changes carried a cause in the readiness scorer. This overlaps older world/module diff coverage concerns and should not be reclassified as a fresh Phase 9 content defect without a dedicated cause/diff repair pass. |
| Phase 20 `response_impact` | 42 / fail | Average consequence profile impact is below the readiness threshold; `policy_backlash` averaged only 23.3 in the impact-score probe. |
| Phase 20 `strategy_diversity` | 62 / fail | Four policy bots collapsed to one dominant customer group and one identity in the 14-day comparison. |
| Phase 40 `entity_memory_quality` | 66 / fail | Entity memories exist but owner/strength coverage misses the current 70 threshold. |
| Phase 40 `named_entity_repetition` | 30 / fail | Common policy/staff/area/NPC refs are overused in generated named-entity surfaces. |

### Multi-month economy probes

Additional probes simulated no-input and two policy-bot runs for 112 days, plus a
365-day no-input run. The bot runs validated cleanly and showed plausible
strategy spread in coin, while the no-input run exposed the confirmed debt/rent
validation bug below.

| Probe | Validation | Final coin | Long-run notes |
|---|---:|---:|---|
| 112 days, no input | 34 validation errors | 3 | Errors begin at day 85 from `debt_rent` seed urgency out of range. |
| 112 days, `auto_clean_focused` | 0 validation errors | 1216 | Weekly/monthly/pressure/history caps held. |
| 112 days, `auto_profit_focused` | 0 validation errors | 5218 | High coin outcome is expected for profit focus, but strategy identity/customer-group diversity remains weak in the readiness script. |
| 365 days, no input | 350 validation errors | 24 | Same debt/rent validation failure repeats over the year; caps still held. |

## Findings

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-CONTENT-009-001 | confirmed | high | Issue seeds / debt-rent long-run validation | Long-term unpaid rent can push `debt_rent` seed urgency above 100, causing recurring validation errors in otherwise completed simulations. | A 140-day no-input probe reported repeated `issue_seed_urgency_oor` errors beginning on absolute day 85 for seeds like `seed-debt_rent-arrears-d85`. The generator computes `urgency: Math.max(45, landlord + 10) + (rentDueSoon ? 10 : 0)`; pressure helpers clamp pressure snapshot urgency, but this seed field is not clamped before validation. | `phase61.rentDueSoon` asserts the tag increases severity/urgency, and `phase19.issueSeeds` validates representative seeds, but neither drives unpaid rent until landlord pressure reaches the cap and the generator crosses 100. | Clamp `debt_rent` seed severity/urgency to 0–100 or centralize clamping in `buildSeed`; add a long-run no-input regression that fails on any `issue_seed_*_oor` validation issue. |
| AUD-CONTENT-009-002 | candidate | medium | Strategy/balance diversity | Current strategy bots can converge to the same tavern identity and dominant customer group over the 14-day readiness matrix. | `diagnoseReadiness` strategy compare reported one identity (`filthy+goblinAuthentic`) and one dominant customer group (`local_goblins`) across clean/profit/merchant/miner-focused bots. | Strategy comparison tests exist, but Phase 8 already found the heavy tier currently fails by OOM before all heavy playtest assertions complete. | After restoring the heavy tier, decide whether the desired design is stronger bot differentiation or different readiness thresholds; if stronger differentiation is desired, add a medium-length strategy matrix dashboard with identity/customer-group assertions. |
| AUD-CONTENT-009-003 | candidate | medium | Response impact / card consequence balance | Several consequence families produce low average impact scores, especially `policy_backlash`, making choices less mechanically distinct than the readiness target expects. | `diagnoseImpactScore` found average profile impact 42.27; `policy_backlash` averaged 23.3, with 76 profiles below 20 overall. | Existing card/response tests often prove an effect exists or moves a target, but they do not enforce family-level impact distributions across live generated seeds. | Add a family-level impact dashboard and decide design thresholds per family; tune low-impact profiles only after confirming whether subtle policy choices are intentional. |
| AUD-CONTENT-009-004 | candidate | medium | Named entity repetition | Named-entity surfaces overuse stable singleton refs such as the cheap-payday policy, server, main room, watch captain, and core customer/faction ids. | Phase 40 named-entity repetition scored 30 and reported 24 overused entities; no duplicate names or same-actor-consecutive seeds were reported. | Rotation tests exist for selected families and same-actor-consecutive is controlled, but broad named-entity distribution still fails the readiness scorer. | Add a distribution dashboard by family/entity kind; then tune affected generators to rotate target refs or suppress singleton policy/area refs where they do not add player value. |
| AUD-CONTENT-009-005 | candidate | low | Placeholder event registries | `localEventRegistry` and `seasonalEventRegistry` remain empty even though active local-arc content now exists elsewhere. | Registry inventory found both registries empty; Phase 22 tests still assert they start empty, while local arc content lives in `localArcRegistry` and runtime arc state lives in `world.localEvents`. | Phase 1 already classified these as extension seams; current tests intentionally preserve the empty-registry contract. | Make a design call: either keep these as explicit deprecated/placeholder seams with comments, or remove/update the empty-registry tests once seasonal/local event content is represented only by local arcs. |
| AUD-CONTENT-009-006 | candidate | medium | Attribution save-size / sticky belief growth | Attribution state has expiry and dedupe but no hard cap; long runs currently stabilize around ~1.7k–1.9k attributions, and sticky false public attributions can survive normal expiry. | 112-day probes ended around 1,781–1,800 attributions and the 365-day no-input probe ended at 1,719; `ageAttributions` preserves high-publicness false attributions past expiry. | Attribution behavior tests focus on scoring/quality and propagation, not year-plus save-size ceilings. | Add a long-run attribution dashboard before adding new sticky attribution producers; consider per-target or global pruning if counts climb with richer content. |
| AUD-CONTENT-009-007 | candidate | low | Expeditions/projects long-run coverage | No-input and current policy-bot probes do not exercise repeated expedition commissions or heavy project creation, so completed expedition/project accumulation remains unmeasured. | Long-run probes ended with 0 active and 0 completed expeditions because the sampled bots did not commission expeditions; project-heavy action patterns were likewise not stressed. | Focused expedition/project tests cover individual actions, but no high-use month/quarter dashboard was found in this phase. | Add a scripted high-expedition/high-project playtest that asserts active records resolve, completed records remain within intended save-size bounds, and project maps do not accumulate duplicate completed work. |

## Prioritized follow-up tests / dashboards

1. **Debt/rent long-run validation regression**
   - Simulate at least 120 no-input days with the canonical pipeline.
   - Fail on any `issue_seed_severity_oor` or `issue_seed_urgency_oor` issue.
   - Assert debt/rent seed severity and urgency are clamped to 0–100 when rent
     arrears and landlord pressure are high.

2. **Long-run save-size dashboard**
   - Record memories, causes, history, attributions, rumours, weekly/monthly
     history, pressure trend lengths, issue-seed cooldown/recent-pick key counts,
     regulars, completed expeditions, active projects, and serialized save bytes.
   - Run no-input plus at least two policy bots for 112 days and one one-year
     smoke scenario.

3. **Strategy/balance dashboard after heavy-tier restoration**
   - Keep the existing readiness metrics, but make the intended thresholds a
     design call rather than treating all low scores as defects.
   - If differentiation is required, assert more than one identity and more than
     one dominant customer group across strategy bots.

4. **Family-level content distribution dashboard**
   - Track generated seed families, target entity kinds, singleton entity reuse,
     response-shape coverage, future-hook ids, and impact-score buckets by family.
   - Use it to tune named-entity repetition and low-impact response profiles.

5. **Action-heavy expedition/project probe**
   - Script repeated commission/project actions over several months.
   - Assert active/completed records and project maps stay within intended bounds
     or explicitly document the expected save-growth policy.

## Tests and checks run

- `find src/sim/content -maxdepth 3 -type f | sort` — Pass. Inventoried content registry/source files.
- `rg -n "MAX|LIMIT|CAP|RETENTION|DAYS|slice\(-|slice\(0|sort\(|expire|expired|prune|aged|history|completed|archiv" src/sim/modules/{memories,causes,history,issues,issueSeeds,pressures,suppliers,expeditions,ownerActions,weekly,monthly,regulars} src/sim/state` — Pass. Located long-run caps/pruning and append-heavy surfaces.
- `npx vite-node scripts/diagnoseReadiness.ts` — Pass with failing readiness sections. Script exited 0; readiness report contained expected failing balance/quality sections: cause coverage, response impact, strategy diversity, entity memory quality, and named entity repetition.
- `npx vite-node scripts/diagnoseImpactScore.ts` — Pass. Produced response-impact distribution and per-family averages.
- `npx vite-node /tmp/audit-content.ts` — Pass after correcting temporary imports. Temporary registry cross-reference probe found no missing refs and default-state validation passed. Temporary file was outside the repository.
- `npx vite-node /tmp/longrun-audit.ts` — Pass with validation findings. Temporary long-run probe completed 112-day no-input, 112-day clean/profit bots, and 365-day no-input runs. The no-input runs exposed `AUD-CONTENT-009-001`. Temporary file was outside the repository.
- `npx vite-node /tmp/longrun-errors.ts` — Pass with validation findings. Temporary probe summarized repeated `issue_seed_urgency_oor` errors beginning at day 85. Temporary file was outside the repository.
- `node --loader ts-node/esm scripts/diagnoseReadiness.ts` — Warning. Failed because `ts-node` is not installed in this repo; reran successfully with `npx vite-node`.

## Phase 9 exit criteria

- Long-run invariants and dashboards identified: complete.
- Content registry cross-links checked: complete.
- Candidate balance/content defects separated from confirmed defects: complete.
- Confirmed long-run debt/rent validation defect recorded with reproduction
  evidence: complete.
