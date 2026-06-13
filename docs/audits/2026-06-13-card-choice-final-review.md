# Card Choice Coherence Final Review — Phase 12

Generated on 2026-06-13 for `docs/plans/card-choice-coherence-repair-plan.md` Phase 12.

## Review inputs

- Refreshed the durable card sample baseline with `npm run sample:card-choices`.
- Refreshed the full card-choice audit with `npm run audit:card-choices`.
- Ran a five-day no-response smoke playthrough from `createInitialTavernState()` using `runOneDay()`, then rendered each valid issue seed with `pickCard()` to check first-day heat, context lines, exact mechanical chips, delayed chips, and representative strategic tradeoffs.

## Audit summary

The current audit covers 113 rendered choices across 19 families:

```text
area_atmosphere, culture_conflict, customer_complaint, debt_rent, faction_request,
food_safety, inspection, maintenance, monthly_review, regular_customer,
reputation_shift, rival_tavern, rumour_crisis, seasonal_arc, staff_burnout,
staff_identity, stock_shortage, supplier_relationship, violence
```

Warning rows are down to 15, compared with the plan's post-Phase-8 snapshot of 26 warning rows. The remaining warnings are concentrated in conservative dominance/contract checks rather than the original systemic hidden-payoff/free-upgrade failures.

| Warning | Rows | Review disposition |
|---|---:|---|
| `possible_dominated_option` | 7 | Deferred/conservative. These are still useful audit leads, mostly where the audit compares options without knowing audience/stock/festival intent. |
| `expected_cost_missing` | 3 | Deferred content cleanup for legacy expected-effect wording. The visible chips generally show exact tradeoffs, but expectations should be made contract-first. |
| `contract_delayed_payoff_missing` | 2 | Deferred for `reputation_shift` rebrand/spin options: cards show delayed drift/risk, but the contract asks for a delayed payoff role. |
| `hidden_delayed_risk` | 2 | Deferred for `rumour_crisis`; immediate risks are visible, but one delayed risk remains below the rendered preview threshold. |
| `expected_capacity_loss_missing` | 1 | Deferred for `maintenance/close_area`; needs either a true capacity effect or revised expectation wording. |
| `expected_risk_missing` | 1 | Deferred for `customer_complaint/discount`; likely an expected-effects wording mismatch because the option shows a coin cost and loyalty/satisfaction upside. |

Warnings that remain at zero rows are the important Phase 12 coherence gates: `free_positive_option`, `hidden_delayed_benefit`, `high_cost_low_visible_benefit`, `long_term_investment_without_visible_payoff`, `ignore_without_downside`, `pressure_label_unclear`, `label_strength_mismatch`, `contract_cost_missing`, `contract_visible_tradeoff_missing`, and `contract_archetype_rule_violation`.

## Refreshed baseline artifacts

`npm run sample:card-choices` refreshed 21 rendered production-path samples under `docs/audits/generated-card-baseline/`. The refreshed files are:

- `docs/audits/generated-card-baseline/area-atmosphere-samples.md`
- `docs/audits/generated-card-baseline/stock-samples.md`
- `docs/audits/generated-card-baseline/staff-samples.md`
- `docs/audits/generated-card-baseline/reputation-samples.md`

These samples now record the current authored slots, consequence profiles, contracts, and rendered choices after the Phase 9-11 repairs.

## First several days smoke review

A five-day no-response smoke playthrough produced no validation errors. The first simulated day produced no valid issue seeds/cards, so the run does not start with unavoidable punishment cards. The first visible cards appear after day 1 conditions have been simulated, and they are framed as current tavern conditions or emerging opportunities rather than accusations of prior player failure.

| Day rendered | Valid seeds | Review notes |
|---:|---:|---|
| 1 | 0 | No unavoidable opening punishment cards. |
| 2 | 2 | `customer_complaint` and `area_atmosphere` cards had context lines and exact mechanical chips. `area_atmosphere/start_project` displayed immediate coin cost plus delayed condition and maintenance-backlog payoff. |
| 3 | 3 | Seasonal, complaint, and cellar atmosphere cards showed cost/risk/payoff splits, including rival/festival blowback and delayed project value. |
| 4 | 4 | Staff, stock, complaint, and atmosphere cards showed distinct action identities: address/back/pay bonus, refill/raise/stretch, repair/clean/project. |
| 5 | 6 | Policy, staff, stock, complaint, seasonal, and atmosphere cards remained legible with exact costs, delayed risks, and audience/faction effects. |

Representative rendered examples from the playthrough:

- `area_atmosphere/start_project`: `Coin -25`, `Main Room Condition +10`, `later: Main Room Condition +20`, `later: Maintenance Backlog -10`.
- `stock_shortage/refill`: `Ale Quantity +60`, `Coin -30`, `Stock Shortage Risk -15`.
- `staff_identity/pay_bonus`: `Morale +12`, `Coin -10`, `Staff Loyalty Risk -10`, plus delayed debt/expectation hooks.
- `policy_backlash/repeal_policy`: `Policy Backlash Risk -25`, reputation/policy movement, plus delayed rumour/reversal hooks.

## Domain review

| Domain | Representative families | Result |
|---|---|---|
| Area / rooms / maintenance | `area_atmosphere`, `maintenance` | Major projects now read as investments, with delayed condition/maintenance relief visible. Cleaning and repair have distinct immediate identities. One legacy `maintenance/close_area` capacity expectation remains deferred. |
| Stock / supplier / economy | `stock_shortage`, `supplier_relationship`, `debt_rent`, `monthly_review` | Exact coin/stock/pressure chips are visible. Debt deferrals no longer look free in the audit. Supplier switch dominance is a conservative remaining warning. |
| Staff | `staff_burnout`, `staff_identity` | Staff support, public backing, bonuses, reassignment, and rest show clear morale/fatigue/loyalty/cost tradeoffs. |
| Reputation / social / rumours | `reputation_shift`, `regular_customer`, `customer_complaint`, `culture_conflict`, `rumour_crisis` | Social cards usually identify who benefits and who pays. Remaining warnings are mostly about contract wording or hidden secondary rumour risk, not free upgrades. |
| Conflict / security / factions | `violence`, `faction_request`, `rival_tavern` | Escalation and appeasement cards show blowback, faction/audience effects, and exact risks/costs. The previous `rival_tavern/host_counter_event` hidden long-term payoff warning is absent. |
| Seasonal / monthly systems | `seasonal_arc`, `monthly_review` | Event preparation cards show readiness, coin, fatigue, faction, and delayed expectation hooks. A couple of seasonal options remain conservative dominance warnings because the audit cannot fully price event/audience intent. |

## Phase 12 acceptance check

- The first day no longer starts hot with unavoidable punishment cards: confirmed by the five-day smoke review, where day 1 rendered zero valid issue seeds/cards.
- Card choices read as strategic tradeoffs: representative cards show exact costs, target-specific benefits, and delayed hooks rather than prose-only implications.
- Major projects read as investments: `area_atmosphere/start_project` visibly includes immediate coin cost, immediate condition improvement, delayed condition payoff, and maintenance-backlog relief.
- Cleaning, closing, rebranding, ignoring, repairing, and investing have distinct identities: the audit no longer reports free positive options, hidden delayed benefits, ignore-without-downside, or long-term investment without visible payoff.
- The simulation remains the source of truth: the audit and samples render real `IssueSeed` data through the production card registry/template path and do not apply responses.

## Remaining deferred items

Phase 12 is complete, but the final audit intentionally leaves a small backlog for later tuning/content cleanup:

1. Decide whether `maintenance/close_area` should apply a concrete service-capacity effect or stop promising capacity loss in `expectedEffects`.
2. Convert remaining legacy expected-effect prose that says "cost" or "risk" into precise `choiceContract` metadata where appropriate.
3. Revisit `reputation_shift` spin/rebrand contracts so delayed payoff requirements match what those choices actually promise.
4. Add an allowlist or smarter comparator for conservative `possible_dominated_option` rows that are strategically different by event intent, audience, supplier lane, or hidden campaign value.
5. Re-check `rumour_crisis` delayed secondary risk visibility after the next social-card tuning pass.
