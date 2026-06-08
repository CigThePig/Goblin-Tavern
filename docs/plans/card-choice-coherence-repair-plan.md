# Card Choice Coherence Repair Plan

## Purpose

The current card system has enough simulation depth to produce meaningful situations, but the player-facing card layer does not yet enforce a strong contract between:

- why a card appeared
- what each option claims to do
- what each option mechanically does
- what each option costs
- what delayed effects matter
- what risks are being accepted
- what strategic tradeoff the player is actually choosing

This causes cards to feel incoherent even when the underlying simulation contains useful information. The goal of this repair plan is to make every card choice understandable, mechanically honest, and strategically legible.

The guiding rule:

> A player should be able to read an option title, its preview text, and its effect chips, then correctly understand what kind of action it is, what it costs, what it fixes, what it does not fix, and why they might choose it over the others.

This is not primarily a prose-polish pass. It is a structural repair to the card generation contract.

---

## Phase 0: Preserve Current Behavior Before Surgery

### Goal

Create a baseline so future changes can be compared against the current output.

### Tasks

1. Add or update a development-only card sampling script.
2. Generate a representative sample of all current card families and response slots.
3. Save sample output to a non-runtime audit location.
4. Include immediate effects, delayed effects, previews, labels, causes, and risks.

Suggested output location:

```text
docs/audits/generated-card-baseline/
```

Suggested files:

```text
docs/audits/generated-card-baseline/card-sample-index.md
docs/audits/generated-card-baseline/area-atmosphere-samples.md
docs/audits/generated-card-baseline/stock-samples.md
docs/audits/generated-card-baseline/staff-samples.md
docs/audits/generated-card-baseline/reputation-samples.md
```

### Acceptance Criteria

- A developer can run one command and generate card samples.
- The output includes enough information to inspect choice labels, option prose, effect chips, immediate effects, delayed effects, and card causes.
- No gameplay logic is changed in this phase.

---

## Phase 1: Build the Card Choice Audit Harness

### Goal

Create tooling that exposes incoherent choices before trying to fix them by hand.

The audit should inspect every issue seed, card template, response slot, and consequence profile it can reach.

### Tasks

Create a script similar to:

```text
src/dev/auditCardChoices.ts
```

or:

```text
scripts/audit-card-choices.ts
```

The script should output one row per generated choice.

Each row should include:

```text
card family
issue id
seed id
response slot id
response label
response shape
choice label
choice prose
immediate effects
delayed effects
expected effects
visible preview effects
cost effects
benefit effects
risk effects
hidden delayed benefits
hidden delayed risks
warning flags
```

Warnings should include:

```text
expected_cost_missing
expected_risk_missing
expected_capacity_loss_missing
free_positive_option
hidden_delayed_benefit
hidden_delayed_risk
high_cost_low_visible_benefit
possible_dominated_option
long_term_investment_without_visible_payoff
ignore_without_downside
pressure_label_unclear
label_strength_mismatch
```

### Important Detection Rules

#### Expected Cost Missing

If `expectedEffects` claims any of the following, the actual immediate or delayed effects must contain a matching mechanical cost, risk, or tradeoff:

```text
time cost
coin cost
capacity loss
staff burden
risk relationship
risk credibility
```

If not, flag it.

#### Free Positive Option

If an option has meaningful positive immediate effects and no visible cost, downside, delayed risk, or limitation, flag it.

This especially matters for options such as:

```text
clean_area
clean_kitchen
comfort_staff
change_priority
mediate_groups
ask_regular_to_spread_word
negotiate_supplier
```

#### Hidden Delayed Benefit

If an option has delayed positive effects that explain its strategic value, but those effects are not shown in the preview, flag it.

This is especially important for long-term investments such as:

```text
start_project
```

#### Possible Dominated Option

If one option costs more and appears to do less than another option in the same card, flag it unless it has visible delayed value, reduced risk, different target domain, unlock value, or reputation/audience effect.

### Acceptance Criteria

- The audit script runs without changing game state.
- The audit produces a readable Markdown or JSON report.
- The report identifies systemic card-coherence failures.
- The audit catches the `area_atmosphere/start_project` hidden delayed payoff issue.
- The audit catches free-benefit options where costs exist only in prose or `expectedEffects`.

---

## Phase 2: Define Choice Contracts and Archetypes

### Goal

Add explicit card-choice meaning, so every option belongs to a known strategic shape.

The current `ResponseIntentShape` values are useful but too broad. They describe the mood of a choice, not the mechanical contract it must satisfy.

Add a new layer:

```ts
ChoiceArchetype
```

or:

```ts
ChoiceContract
```

This should exist alongside current response shapes at first. Do not replace the old system immediately.

### Suggested Archetypes

```ts
type ChoiceArchetype =
  | "patch"
  | "proper_repair"
  | "major_project"
  | "clean"
  | "close_temporarily"
  | "ignore"
  | "spin_or_rebrand"
  | "compensate"
  | "staff_push"
  | "staff_care"
  | "buy_stock"
  | "cheap_supplier"
  | "negotiate"
  | "escalate"
  | "policy_change"
  | "delay"
  | "call_in_favor"
  | "appease"
  | "cut_corners";
```

### Contract Fields

Each response slot or consequence profile should be able to declare something like:

```ts
choiceContract: {
  archetype: "major_project",
  primaryTarget: "area.condition",
  solves: ["structural_damage"],
  doesNotSolve: ["smell", "mess"],
  costTypes: ["coin"],
  payoffTiming: "mixed",
  mustShowDelayedPayoff: true,
  requiresVisibleTradeoff: true
}
```

### Archetype Rules

#### Patch

A patch is a cheap short-term fix.

Rules:

```text
low to medium cost
small to medium immediate improvement
does not solve root cause
may allow recurrence
should not outperform proper repair on the same target
```

#### Proper Repair

A proper repair directly fixes damage.

Rules:

```text
medium cost
strong immediate improvement
targets condition or damage
does not usually add future resilience
should be more efficient than a patch for direct repair
```

#### Major Project

A major project is expensive and future-facing.

Rules:

```text
high cost
may have modest immediate benefit
must have visible delayed payoff
must improve future stability, reduce pressure, increase max quality, unlock something, or reduce recurrence
must not look worse than proper repair unless future value is visible
```

#### Clean

Cleaning addresses mess, smell, grime, or food-safety issues.

Rules:

```text
improves cleanliness, smell, mess, hygiene, or safety
does not meaningfully repair structural condition
must cost coin, staff fatigue, owner time, service capacity, or use a clearly limited idle-labour condition
```

#### Close Temporarily

Closing a space prevents worsening or allows controlled recovery.

Rules:

```text
reduces traffic-driven worsening
may improve cleanliness or reduce damage
must visibly cost capacity, revenue, guest comfort, service speed, or availability
```

#### Spin or Rebrand

Spin changes perception, not reality.

Rules:

```text
may protect reputation temporarily
may shift audience
should not materially fix physical damage
must carry reputation, audience, trust, or respectability risk
must clearly indicate the root issue remains
```

#### Ignore

Ignoring costs nothing now but worsens future state.

Rules:

```text
no immediate cost
must increase pressure, risk, damage, dissatisfaction, spoilage, or future severity
must never look like a neutral choice unless the problem is genuinely trivial
```

### Acceptance Criteria

- Choice archetypes are defined in a central location.
- At least `area_atmosphere` response slots are annotated with contracts.
- The audit script can read these contracts.
- The system can validate archetype-specific rules without changing the runtime renderer yet.

---

## Phase 3: Repair Preview Selection for Delayed Effects

### Goal

Make the preview system show the effects that explain a choice’s actual strategic meaning.

Currently, delayed effects can be hidden unless they are future hooks or tagged as risks. This makes long-term options look irrational.

### Tasks

Update preview selection so effects are selected by role, not merely by generic importance.

Each choice preview should try to show:

```text
main cost
main immediate benefit
main tradeoff
main delayed benefit
main delayed risk
future hook, if any
```

The required roles should depend on `ChoiceArchetype`.

### Archetype Preview Requirements

#### Major Project

Must show:

```text
one major cost
one immediate benefit, if present
one delayed payoff
```

Example:

```text
Coin -25
Now: Main Room Condition +10
Later: Main Room Condition +20
Later: Maintenance Pressure -10
```

#### Clean

Must show:

```text
cleanliness/mess/smell benefit
visible cost or limitation
```

#### Close Temporarily

Must show:

```text
recovery/stabilization benefit
lost capacity/revenue/traffic/service downside
```

#### Spin or Rebrand

Must show:

```text
perception benefit or small visible improvement
respectability/trust/audience downside
root issue remains, if applicable
```

#### Ignore

Must show:

```text
no immediate cost, if supported
future worsening
risk escalation
```

### Acceptance Criteria

- `start_project` no longer appears worse than `repair_area` because its delayed payoff is visible.
- Long-term investments consistently show why they are long-term investments.
- Delayed risks and delayed benefits have clear labels such as `Later`, `Delayed`, or `Risk`.
- Existing preview tests are updated rather than bypassed.

---

## Phase 4: Clarify Meter Polarity and Effect Labels

### Goal

Make every effect chip readable without requiring the player to know internal meter polarity.

The clearest example is:

```text
Maintenance +10
```

This looks good, but it is bad if it means maintenance pressure or backlog increased.

### Tasks

Review all meters and pressures.

Classify each displayed meter as one of:

```text
good_when_higher
bad_when_higher
contextual
resource
```

For bad-when-higher meters, use labels that clearly encode badness.

Examples:

```text
Maintenance Pressure
Maintenance Backlog
Staff Fatigue
Guest Tension
Kitchen Mess
Main Room Damage
Supplier Pressure
Debt Pressure
Spoilage Risk
```

Avoid neutral-good labels for bad states.

Bad:

```text
Maintenance +10
```

Good:

```text
Maintenance Pressure +10
```

or:

```text
Repair Backlog +10
```

### Acceptance Criteria

- Pressure-style effects display with pressure/backlog/risk/tension wording.
- Positive and negative direction is understandable from the chip label.
- Card previews no longer make bad increases look beneficial.
- Tests cover at least maintenance pressure, staff fatigue, room damage, mess, smell, tension, and reputation changes.

---

## Phase 5: Repair Area, Room, Maintenance, and Atmosphere Cards First

### Goal

Use one vertical slice to prove the new contract system before expanding everywhere.

This domain should include cards and issues related to:

```text
main room
kitchen
rooms/areas
cleanliness
smell
mess
damage
condition
maintenance pressure
atmosphere rot
temporary closures
renovations
```

### Specific Repairs for `area_atmosphere`

#### `repair_area`

Archetype:

```text
proper_repair
```

Expected shape:

```text
medium coin cost
strong immediate condition/damage improvement
no major delayed payoff required
```

#### `clean_area`

Archetype:

```text
clean
```

Expected shape:

```text
improves cleanliness/smell/mess
must have visible cost or limited-use reason
must not repair structural damage
```

Possible costs:

```text
Coin -5
Staff Fatigue +4
Service Pace -5
Owner Time -1
```

Pick the cost type that best matches existing simulation resources.

#### `start_project`

Archetype:

```text
major_project
```

Expected shape:

```text
high coin cost
some immediate condition improvement
visible delayed condition improvement
visible delayed maintenance pressure reduction
possibly project/follow-up language
```

The current hidden delayed benefits should become visible.

#### `close_area_temporarily`

Archetype:

```text
close_temporarily
```

Expected shape:

```text
reduces damage or mess
improves cleanliness modestly
must reduce capacity, revenue, traffic, service speed, or guest comfort
```

#### `rebrand_area`

Archetype:

```text
spin_or_rebrand
```

Expected shape:

```text
small or no physical improvement
respectable reputation cost
possible rough/cozy audience shift
root issue remains clear
```

#### `ignore_area_problem`

Archetype:

```text
ignore
```

Expected shape:

```text
no immediate cost
maintenance pressure increases
condition worsens
damage increases
risks become more likely
```

### Acceptance Criteria

- Area/room cards no longer contain obviously dominated choices.
- Cleaning is not free unless explicitly justified.
- Closing a room has a visible operational cost.
- Rebranding does not pretend to be a repair.
- Major projects show delayed payoff.
- Ignoring clearly worsens the situation.
- The audit report shows fewer or no warnings for this domain.

---

## Phase 6: Repair Stock, Ale, Kitchen, and Supplier Cards

### Goal

Apply the same contract system to resource and supply problems.

This domain should include:

```text
ale shortages
food shortages
kitchen cleanliness
supplier issues
stock pressure
panic buying
cheap suppliers
negotiation
rationing
menu changes
spoilage
```

### Common Failure Patterns to Watch

```text
buying stock without clear quantity or cost
supplier options that do not say what is being bought
cheap supplier choices without quality/reputation risk
rationing choices without guest satisfaction cost
negotiation choices that improve relationships without risk or cost
kitchen cleaning with no staff/time/coin cost
```

### Required Fixes

1. Stock options must show what is gained.

Example:

```text
Ale Stock +20
Coin -12
```

2. Supplier options must show cost and supplier quality implications.

Example:

```text
Coin -8
Ale Stock +18
Supplier Trust -5
Spoilage Risk +6
```

3. Rationing must show guest or reputation tradeoff.

Example:

```text
Ale Stock Pressure -10
Guest Satisfaction -6
```

4. Negotiation must have risk, opportunity cost, or limited upside.

Example:

```text
Supplier Pressure -8
Supplier Trust -4
```

or:

```text
Supplier Trust +6
Coin -5
```

### Acceptance Criteria

- Ale and stock problems no longer feel unavoidable on day 1 unless intentionally seeded as starting conditions.
- Buying/restocking always shows quantity and cost.
- Cheap options visibly carry risk.
- Conservation/rationing choices visibly cost satisfaction, reputation, or revenue.
- Kitchen cleanup choices follow the same rules as area cleanup.

---

## Phase 7: Repair Staff Loyalty, Fatigue, Morale, and Scheduling Cards

### Goal

Make staff-related cards respect the difference between care, pressure, compensation, scheduling, and exploitation.

This domain should include:

```text
staff loyalty
staff fatigue
staff morale
stress
pay
bonuses
shift pressure
training
discipline
comfort
overwork
```

### Common Failure Patterns to Watch

```text
pay bonus without amount
comfort staff with no time or coin cost
push staff with unclear output gain
loyalty problems appearing too early without preventable cause
staff options that improve loyalty and morale for free
discipline choices that do not create resentment or fear
```

### Required Option Archetypes

#### Staff Care

```text
improves morale, loyalty, stress, or fatigue
must cost coin, time, capacity, or owner attention
```

#### Staff Push

```text
improves output, speed, or short-term coverage
must cost fatigue, morale, loyalty, mistakes, or future risk
```

#### Bonus / Compensation

```text
must show exact coin cost
must show loyalty/morale/stress benefit
should scale with staff count or severity
```

#### Training

```text
costs time/capacity now
improves competence, speed, or mistake reduction later
must show delayed payoff if expensive
```

### Acceptance Criteria

- Staff cards show exact bonus/pay amounts.
- Staff care is beneficial but not free.
- Staff push choices have visible human costs.
- Early-game loyalty cards do not punish the player for conditions they could not yet influence.
- Staff-related delayed benefits and risks are visible.

---

## Phase 8: Repair Reputation, Audience, Regulars, and Social Cards

### Goal

Make reputation and audience shifts understandable and connected to actual causes.

This domain should include:

```text
respectable reputation
rough reputation
regular patrons
audience narrowing
credibility
word of mouth
faction perception
public complaints
atmosphere drift
```

### Common Failure Patterns to Watch

```text
rebrand options physically fixing problems
regulars spreading word without credibility risk
reputation penalties with unclear audience meaning
audience may narrow with no explanation
respectable/rough/cozy shifts not explained
```

### Required Fixes

1. Separate physical state from social perception.

A reputation action should not materially repair a room unless paired with a real repair action.

2. Audience shifts need plain labels.

Bad:

```text
Audience may narrow
```

Better:

```text
Delayed risk: respectable patrons may visit less often.
```

3. Word-of-mouth actions need credibility stakes.

Example:

```text
Regular Loyalty +8
Reputation Risk +5
```

4. Reputation chips should specify which reputation is changing.

Example:

```text
Respectable Reputation -8
Rough Reputation +6
```

### Acceptance Criteria

- Social choices no longer masquerade as physical repairs.
- Reputation effects are domain-specific.
- Delayed audience consequences are readable.
- Word-of-mouth and public-facing options carry credibility or trust implications.

---

## Phase 9: Repair Conflict, Security, Faction, and Escalation Cards

### Goal

Make risky, violent, factional, or disciplinary choices legible.

This domain should include:

```text
fights
theft
threats
rough patrons
guards
ogres/adventurers
factions
ban decisions
escalation
intimidation
appeasement
```

### Common Failure Patterns to Watch

```text
escalation without clear risk
appeasement without reputation/faction cost
ban decisions without traffic/reputation consequences
security improvements without coin/staff cost
faction choices that do not explain who is angered or helped
```

### Required Fixes

1. Escalation must show upside and risk.

Example:

```text
Immediate: Threat Pressure -10
Risk: Violence may escalate
Respectable Reputation -5
```

2. Appeasement must show who is appeased and who loses respect.

3. Banning/removing patrons must affect traffic, safety, reputation, or faction standing.

4. Security improvements must cost coin, staff load, or atmosphere.

### Acceptance Criteria

- Risky options are not disguised as clean upgrades.
- The player can tell who benefits and who is angered.
- Security options have costs.
- Escalation cards always show possible blowback.

---

## Phase 10: Repair Economy, Debt, Coin, and Recurring Pressure Cards

### Goal

Make financial choices concrete and strategically understandable.

This domain should include:

```text
coin pressure
debt pressure
maintenance spending
supplier bills
wages
bonuses
emergency costs
deferred repairs
revenue loss
```

### Common Failure Patterns to Watch

```text
vague cost phrases without numbers
coin costs that do not scale with benefit
expensive options with hidden or missing payoff
deferred payment without interest/risk
debt relief without future consequence
```

### Required Fixes

1. Any money choice must show exact coin cost or exact coin gain.

Bad:

```text
a real slip of coin would leave the purse
```

Good:

```text
Coin -25
```

2. Deferred costs must show future risk.

Example:

```text
Coin unchanged now
Later: Debt Pressure +12
Risk: Supplier Trust may fall
```

3. Expensive choices must show why they are expensive.

They need at least one of:

```text
large immediate benefit
visible delayed payoff
risk reduction
unlock
recurrence reduction
multi-domain benefit
```

### Acceptance Criteria

- All financial options show exact values.
- Deferred payments are not free.
- Expensive options are visibly justified.
- The audit flags no high-cost-low-visible-benefit choices unless intentionally documented.

---

## Phase 11: Add Automated Coherence Tests

### Goal

Prevent the same class of bugs from returning.

### Test Categories

#### Archetype Contract Tests

Each archetype should have tests for required shape.

Examples:

```text
major_project must have visible delayed payoff
ignore must worsen something or increase risk
clean must have cost or limitation
spin_or_rebrand must not materially repair physical state
close_temporarily must have operational cost
```

#### Preview Faithfulness Tests

Ensure preview chips include required effects by role:

```text
cost
main benefit
tradeoff
delayed payoff
delayed risk
```

#### Dominance Tests

Flag options that are strictly worse than another visible option unless they differ by:

```text
timing
risk
target
unlock
delayed payoff
availability
reputation effect
```

#### Label Polarity Tests

Ensure bad-when-higher meters use bad-state labels.

Examples:

```text
Maintenance Pressure
Staff Fatigue
Guest Tension
Damage
Mess
Smell
Debt Pressure
```

#### Day 1 Fairness Tests

Cards on day 1 should not punish the player for failing to prevent conditions they had no chance to influence.

Day 1 cards may exist as:

```text
starting condition cards
tutorial cards
world-state introductions
low-stakes warnings
```

But they should not imply player failure.

### Acceptance Criteria

- Tests run with the normal test suite.
- Failing tests provide useful messages that identify the card family, response slot, and broken contract.
- Existing green tests remain green or are intentionally updated.
- New tests protect the area/room vertical slice first, then expand by domain.

---

## Phase 12: Final Card System Review

### Goal

Validate that the repaired system feels coherent in play, not just in tests.

### Tasks

1. Generate a fresh full-card audit report.
2. Compare it against the Phase 0 baseline.
3. Manually review representative cards from each domain.
4. Play through the first several in-game days.
5. Confirm that cards:
   - explain why they appeared
   - show meaningful choices
   - display exact costs where relevant
   - reveal delayed payoff when it justifies an option
   - avoid fake free upgrades
   - avoid dominated options
   - do not punish impossible prevention
   - use clear meter labels

### Acceptance Criteria

- The first day no longer starts “hot” with unavoidable punishment cards unless those cards are explicitly framed as inherited starting conditions.
- Card choices feel like strategic tradeoffs rather than haunted receipts.
- Major projects read as investments, not overpriced weak repairs.
- Cleaning, closing, rebranding, ignoring, repairing, and investing all have distinct mechanical identities.
- The simulation remains the source of truth, but the card layer now translates that truth clearly.

---

## Recommended Implementation Order

Do not implement everything in one pass.

Use this order:

```text
1. Phase 0: Baseline sampling
2. Phase 1: Audit harness
3. Phase 2: Choice contracts/archetypes
4. Phase 3: Delayed effect preview repair
5. Phase 4: Meter polarity labels
6. Phase 5: Area/room/maintenance vertical slice
7. Phase 11: Tests for that vertical slice
8. Phase 6: Stock/ale/supplier
9. Phase 7: Staff
10. Phase 8: Reputation/audience
11. Phase 9: Conflict/security
12. Phase 10: Economy/debt
13. Phase 12: Final review
```

The first real proof of success should be the `area_atmosphere` card family. If that domain becomes coherent, the same repair pattern can be safely rolled across the rest of the card system.

---

## Non-Goals

This repair plan should not:

- rewrite all card prose first
- balance the entire economy in one pass
- remove simulation depth
- hide numbers from the player
- make every option equally good
- make every option safe
- convert cards into static hand-authored events
- replace procedural generation with fixed text

Bad, risky, desperate, or inefficient choices are allowed. They just need to be legible.

A bad option is acceptable if the player understands why it is bad and why they might still choose it under pressure.

---

## Final Design Rule

Every option should answer this question:

> What kind of move is this?

If the option title says one thing, the prose says another, the effect chips show a third, and the delayed consequences hide the actual reason, the card fails.

The repaired system should make each choice read as one coherent move:

```text
Patch the symptom.
Repair the cause.
Invest for later.
Clean the mess.
Close to stop the bleeding.
Spin the story.
Push the staff.
Care for the staff.
Buy your way out.
Cheap out and risk blowback.
Ignore it and let the goblins chew the floorboards.
```

That is the target.
