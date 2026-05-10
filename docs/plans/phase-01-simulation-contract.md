# Goblin Tavern Simulation Contract & Design Rules

## Document Purpose

This document defines the finished product vision and simulation contract for a text-based goblin tavern management game. It completes **Phase 1: Simulation Contract & Design Rules**.

The purpose of this document is to prevent the project from drifting into a card-first game where text invents problems the simulation does not understand. The core rule is simple:

> **The simulation is the truth. Cards are only how the player sees, interprets, and acts on that truth.**

Before any real card writing begins, the tavern must be able to run, change, fail, recover, explain itself, and generate structured issue seeds without narrative prose.

---

# 1. Finished Product Vision

## 1.1 High-Level Description

The game is a text-based goblin tavern management simulation where the player owns and operates a messy, unstable, low-fantasy goblin tavern. The player is not ruling a kingdom, commanding armies, or choosing disconnected story events. They are trying to keep a small business alive day by day.

The tavern is a living system. Food spoils. Ale runs low. Staff get tired. Customers form habits. Rats spread. Inspectors become suspicious. Ogres break chairs. Merchants avoid sticky floors. Local goblins tolerate filth if the stew is cheap enough. Every complaint, crisis, opportunity, and weird tavern incident should emerge from the underlying simulation.

The game should feel granular, tactile, and grounded. It is smaller in scale than a kingdom game, but deeper in local detail.

The player’s core fantasy is:

> **I am the goblin tavern owner trying to survive another day, make rent, keep customers coming back, manage staff, patch the building, stretch supplies, and decide what kind of tavern this place is becoming.**

## 1.2 Player Experience

From the end user perspective, the game is presented through text: reports, issues, incidents, choices, staff conversations, customer complaints, supplier offers, inspection warnings, and monthly summaries.

However, the player should gradually feel that the text is only the visible surface of a deeper machine.

The player should notice that:

- Problems appear for understandable reasons.
- Choices have visible consequences.
- The tavern remembers what happened before.
- The same issue behaves differently depending on context.
- A short-term fix can create long-term trouble.
- The tavern develops a distinct identity over time.
- Reports and cards refer to actual state, not random flavour.
- Staff, customers, suppliers, and institutions react to patterns, not isolated events.

The player should not feel that the game is dealing cards from a random pile. They should feel that the tavern itself is producing problems.

## 1.3 Core Game Rhythm

The finished game uses three time scales:

```txt
Day     = operational gameplay
Week    = routine, wages, suppliers, trends, and maintenance pressure
Month   = rent, reputation shifts, inspections, upgrades, and larger consequences
```

The daily structure gives the player small, meaningful decisions. The weekly structure creates recurring business rhythm. The monthly structure gives the tavern long-term direction.

The design sentence for the game is:

> **Each day makes a mess, each week reveals a pattern, each month decides what kind of tavern you are becoming.**

## 1.4 Daily Experience

A day represents the smallest playable unit.

A typical day may include:

1. Morning prep
2. Owner actions
3. Staff assignments
4. Tavern service
5. Incidents or issues
6. Closing results
7. Daily report
8. New memories, pressures, and future hooks

The player may choose a limited number of owner actions each day, such as:

- Clean an area
- Repair damage
- Restock supplies
- Adjust prices
- Pay staff
- Stretch ingredients
- Water down ale
- Patch the roof
- Handle pests
- Talk to staff
- Negotiate with a supplier

The player should not be able to do everything. The central daily tension is:

> **What gets ignored today?**

## 1.5 Weekly Experience

Weeks create predictable routine and pressure.

A week may have repeated day types, such as:

```txt
Supplier Day      - supplies, invoices, stock planning
Quiet Day         - lower traffic, useful for recovery
Market Day        - merchants, trade, price sensitivity
Local Night       - goblin regulars and neighbourhood reputation
Payday            - miners and workers spend heavily
Brawl Night       - high profit, high danger, high damage
Maintenance Day   - lower traffic, repairs, cleaning, inspection risk
```

Weekly systems may include:

- Staff wages
- Supplier invoices
- Weekly rumour spread
- Maintenance backlog
- Staff fatigue and morale trends
- Customer group loyalty trends
- Debt interest
- Inspection suspicion changes
- Weekly summary reports

The weekly question is:

> **Is the tavern forming a workable routine, or is it building a failure loop?**

## 1.6 Monthly Experience

Months provide strategic consequence.

Monthly systems may include:

- Rent
- Landlord pressure
- Inspection windows
- Reputation tier changes
- Rival tavern pressure
- Upgrade readiness
- Supplier relationship shifts
- Seasonal or monthly modifiers
- Major debt checks
- Long-term tavern identity shifts

The monthly question is:

> **What kind of tavern is this becoming?**

Possible tavern identities include:

- Cheap goblin dive
- Dangerous adventurer den
- Filthy but beloved local hole
- Suspiciously respectable inn
- Miner payday trap
- Criminal meeting spot
- Haunted novelty tavern
- Experimental mushroom kitchen
- Brawl-friendly ogre hall
- Barely legal soup business

The simulation should support these identities through state and behaviour, not by assigning a superficial class label.

---

# 2. Product Pillars

## 2.1 Simulation First

The simulation must exist and work before cards are written.

Cards do not create truth. Cards reveal truth.

A card may:

- Reveal a simulated problem
- Interpret a simulated pressure
- Escalate an existing issue
- Offer player responses to a real situation
- Present the consequences of a real decision
- Add flavour to mechanically valid state

A card may not:

- Invent a problem the simulation does not understand
- Apply arbitrary effects without simulation logic
- Contradict known tavern state
- Pretend past decisions did not happen
- Use generic filler detached from real causes

## 2.2 Local Granularity

Because the game is about a tavern, not a kingdom, it should track concrete things.

Good simulation subjects:

- Kitchen cleanliness
- Cellar pests
- Main room damage
- Privy smell
- Roof leaks
- Ale stock
- Stew quality
- Mushroom spoilage
- Staff fatigue
- Cook morale
- Merchant satisfaction
- Ogre damage risk
- Inspection suspicion
- Supplier debt
- Local goblin loyalty

Avoid overly abstract global-only systems. The player should feel the tavern as a physical place.

## 2.3 Meaningful Consequence

Every major player choice should affect more than one thing.

A good choice has tradeoffs:

```txt
Water down ale:
- Ale stock lasts longer
- Short-term profit may rise
- Customer suspicion rises
- Taste reputation drops
- Cheap reputation may rise
- Future scandal risk increases
```

Weak choices only change one number and disappear.

Strong choices leave residue:

- State changes
- Cause entries
- Memories
- Pressure changes
- Relationship changes
- Future hooks
- Report lines

## 2.4 Causality and Explanation

The simulation must be able to explain itself.

If a major value changes, the game should know why.

Example:

```txt
Merchant satisfaction fell by 14.

Causes:
-8 main room cleanliness below merchant tolerance
-4 dangerous reputation rising
-3 watered ale suspicion
+1 improved stew quality
```

The player should not be asked to trust invisible math. The simulation should generate cause-aware outputs that can later become reports, card text, tooltips, and debug information.

## 2.5 Memory

The tavern must remember.

Memory prevents contradiction and creates continuity.

Examples:

```txt
watered_ale_detected
merchant_boot_stuck_to_floor
cook_unpaid_last_week
rat_seen_near_pantry
roof_patched_recently
ogre_broke_bar_twice
inspector_warned_about_privy
supplier_blamed_publicly
```

Memories may be temporary, lasting, actor-specific, area-specific, or global.

The simulation must distinguish between:

- What is true right now
- What happened recently
- What happened historically
- Who remembers it
- How strongly it still matters

## 2.6 Emergent Card Fuel

The simulation must generate enough structured situations that hundreds of future cards can be written without becoming fluff.

A future card should be based on an issue seed that already contains:

- Situation
- Causes
- Actor
- Location
- Stakes
- Valid response intents
- Consequence profiles
- Memories created
- Future hooks

If a card cannot point to a real issue seed, it should not exist.

---

# 3. Core Gameplay Model

## 3.1 The Tavern as a Living System

The tavern is a collection of interacting systems:

```txt
Calendar
Areas
Stock
Economy
Customers
Staff
Owner actions
Weekly routine
Monthly pressure
Reputation
Memories
Causes
Pressures
Issue seeds
Reports
```

Each system affects others.

Example interaction:

```txt
Dirty kitchen
→ food safety pressure rises
→ merchants become less satisfied
→ inspection suspicion rises
→ cook stress may rise
→ spoiled food issue seeds become valid
```

Example failure loop:

```txt
Low coin
→ repairs delayed
→ area condition worsens
→ merchant traffic drops
→ income falls
→ repairs become even harder
```

Example opportunity loop:

```txt
Good stew quality
→ local goblin loyalty rises
→ reliable customer base grows
→ daily income stabilizes
→ staff wages become easier
→ cook morale improves
→ stew quality improves further
```

## 3.2 Player Role

The player is the tavern owner.

The owner is not omnipotent. The player should feel responsible, but constrained.

The owner can:

- Set daily priorities
- Spend money
- Assign staff focus
- Accept or reject risks
- Patch problems
- Ignore problems
- Shape reputation
- Choose who the tavern serves
- Manage relationships
- Respond to issues

The owner cannot:

- Perfectly control customers
- Instantly fix systemic problems
- Prevent all decay
- Avoid tradeoffs
- Ignore consequences forever
- Know every hidden future outcome with certainty

## 3.3 Core Player Decisions

The game should repeatedly ask:

```txt
Do I spend coin now or risk a worse problem later?
Do I protect reputation or grab short-term profit?
Do I support staff or squeeze more work out of them?
Do I cater to goblin locals, merchants, miners, ogres, adventurers, or inspectors?
Do I clean the tavern or preserve its goblin authenticity?
Do I fix the root cause or patch the visible symptom?
Do I build a safer business or a more profitable disaster?
```

## 3.4 No Universal Best Strategy

The simulation should support multiple viable identities and strategies.

A clean, safe tavern should not simply be “correct.” A filthy, cheap goblin dive may thrive with the right customer base but create inspection and sickness risks.

Examples:

```txt
Clean and respectable:
- Better merchants
- Lower inspection pressure
- Higher upkeep cost
- Lower goblin authenticity
- Less rowdy profit
```

```txt
Cheap and filthy:
- Strong local goblin loyalty
- Better miner traffic
- Higher sickness risk
- Higher inspection suspicion
- Merchant avoidance
```

```txt
Dangerous adventurer den:
- High spending
- High incident rate
- More damage
- More rare opportunities
- Higher staff stress
```

---

# 4. Simulation Design Rules

## 4.1 The Truth Rule

The simulation is the source of truth.

Cards, reports, UI, and flavour text must derive from simulation state.

If the simulation does not know about an issue, the player should not see it as a meaningful card.

## 4.2 The No-Fluff Rule

No card, issue, or major text event may exist unless it reads from or writes to the simulation.

Valid content must do at least one of the following:

- Reveal current state
- Explain a cause
- Offer a meaningful response
- Change state
- Create memory
- Create future hooks
- Escalate a pressure
- Resolve a pressure
- Shift a relationship
- Change reputation

## 4.3 The Explainability Rule

Major changes must be explainable.

Any notable change should have cause entries attached.

The simulation must avoid unexplained jumps like:

```txt
Reputation -20
```

Instead, it should be able to output:

```txt
Reputation changed because:
- Customers noticed watered ale
- Merchants complained about sticky floors
- The privy smell reached the main room
```

## 4.4 The Memory Rule

Important events must leave memory behind.

A resolved issue should not vanish from history unless intentionally designed to fade.

Memories should affect:

- Future issue eligibility
- Actor reactions
- Reputation drift
- Contradiction checks
- Card text ingredients
- Future hooks
- Reports

## 4.5 The Contradiction Rule

The simulation must prevent future cards and issue seeds from contradicting known state.

Examples of invalid contradictions:

```txt
The roof is described as ignored, but it was patched yesterday.
A merchant loyalty card appears when merchants are actively avoiding the tavern.
A staff member complains about unpaid wages when wages were paid.
A rat crisis appears after pests were eliminated, unless a valid new source exists.
A card says ale has run out when ale stock is high.
```

The sim may allow nuanced tension:

```txt
The roof was patched, but the cheap patch failed in heavy rain.
```

That is not a contradiction if the simulation supports patch quality, rain, and failure risk.

## 4.6 The Context Rule

The same action should not always produce the same result.

Effects should depend on state.

Example:

```txt
Dump spoiled stew while rich:
- Minor financial loss
- Strong safety improvement

Dump spoiled stew while broke:
- Serious stock loss
- Possible service shortage
- Staff stress
- Reduced sickness risk
```

The card may present the same choice, but the sim resolves context-sensitive outcomes.

## 4.7 The Residue Rule

Actions should leave residue.

Residue may be:

- A changed value
- A cause entry
- A memory
- A pressure shift
- A future hook
- A relationship change
- A reputation shift
- A report line

The player should feel that choices do not simply happen and disappear.

## 4.8 The Threshold Rule

Many issue seeds should come from threshold crossings rather than static bad states.

Example:

```txt
Kitchen cleanliness crosses from questionable to filthy.
Inspection suspicion crosses into dangerous range.
Staff stress crosses into burnout risk.
Rats move from cellar signs to pantry interference.
```

This helps prevent repetitive “still dirty again” content.

## 4.9 The System Collision Rule

The best issues come from systems colliding.

Examples:

```txt
Payday + low ale stock + high miner traffic
Rain + damaged roof + kitchen cleanliness pressure
Ogre traffic + weak furniture + no bouncer
Merchant visit + filthy main room + respectable reputation goal
Staff burnout + brawl night + unpaid wages
Cheap mushrooms + stressed cook + inspection suspicion
```

Issue seed generation should prefer multi-cause problems over single-stat complaints.

## 4.10 The Card-Readiness Rule

A simulation output is card-ready only if it has:

1. A clear situation
2. A reason it appeared now
3. At least one actor or affected group
4. At least one location or system
5. At least two causes where possible
6. At least two meaningful response options
7. Short-term consequences
8. At least one memory or future hook
9. No contradictions
10. A reason the player should care

### Implementation Mapping

This checklist is the verbal form of the `IssueSeed` type implemented in Phase 19. The ten conditions above map directly to required fields on a valid seed:

```txt
1.  clear situation         -> type / family
2.  reason it appeared now  -> causes (recent, with timestamps)
3.  actor or group          -> primaryActor / affectedActors
4.  location or system      -> location / domains
5.  at least two causes     -> causes (length >= 2 where possible)
6.  at least two responses  -> responseSlots (length >= 2)
7.  short-term consequences -> consequenceProfiles
8.  memory or future hook   -> memoriesCreated / futureHooks
9.  no contradictions       -> validation / contradiction guards
10. reason to care          -> severity / urgency / stakes
```

When in doubt about whether a seed is well-formed, read §4.10 first. Phase 19's seed validation must satisfy this checklist mechanically, not replace it.

---

# 5. Code-Level Architecture Contract

## 5.1 Architectural Goal

The simulation must be modular, testable, deterministic, and expandable.

New systems should be added as modules and registered definitions, not by rewriting the core engine.

The architecture goal is:

> **New expansion = new module + registered definitions + tests. Not a large refactor.**

## 5.2 Core Engine Responsibilities

The core engine owns:

```txt
Time progression
Phase execution
Module registration
Simulation context creation
Seeded randomness
Input/output structure
State validation
State diffs
Cause collection
Memory collection
Pressure collection
Issue seed collection
Report collection
Save/load migration hooks (deferred — placeholder only; full save/load is out of scope until post-Phase 20)
```

The core engine does **not** own:

```txt
Rat rules
Inspection rules
Ogre behaviour
Food spoilage logic
Staff drama details
Supplier personalities
Weather effects
Rival tavern strategy
Haunting rules
Card prose
```

Specific systems belong in modules.

## 5.3 Module Responsibilities

A simulation module may define:

```txt
Module state
Default state
Schema
Hooks
Actions
Pressure generators
Issue seed generators
Report sections
Migrations
Tests
```

Example conceptual module shape:

```ts
export const RatsModule = {
  id: 'rats',
  version: '1.0.0',

  stateSchema: RatsStateSchema,

  defaultState: {
    infestation: 20,
    boldness: 10,
    treatyStatus: 'none',
  },

  hooks: {
    endDay(ctx) {
      // Rat spread logic.
    },

    generatePressures(ctx) {
      // Pest pressure logic.
    },

    generateIssueSeeds(ctx) {
      // Rat-related issue seeds.
    },

    generateReports(ctx) {
      // Rat debug report.
    },
  },
}
```

## 5.4 Phase Pipeline

The simulation should run through stable phases.

Initial target phases:

```txt
init
startDay
applyDayTypeModifiers
forecastTraffic
beforeOwnerActions
ownerActions
afterOwnerActions
assignStaff
beforeService
service
afterService
closing
endDay
endWeek
endMonth
generatePressures
generateIssueSeeds
generateReports
validate
```

Modules register hooks into these phases.

The engine should not hardcode every system call manually.

Bad pattern:

```ts
updateRats(state)
updateInspectors(state)
updateWeather(state)
updateRivalTavern(state)
```

Preferred pattern:

```ts
runPhase('endDay', ctx)
runPhase('generatePressures', ctx)
runPhase('generateIssueSeeds', ctx)
```

## 5.5 Namespaced Module State

Expansion-specific state should live under module namespaces.

Preferred:

```ts
state.modules.rats = {
  infestation: 20,
  boldness: 10,
  treatyStatus: 'none',
}
```

Avoid flattening expansion data into the root state unless it is core to every simulation run.

The root state should remain stable and general.

## 5.6 Registries

Expandable game objects should be registered, not hardcoded.

Use registries for:

```txt
areas
stock items
customer groups
staff roles
staff priorities
owner actions
reputation axes
pressure types
memory types
issue seed types
report sections
upgrades
suppliers
monthly modifiers
```

A future expansion should be able to add a new stock item, area, customer type, or action through registration.

## 5.7 Tags and Capabilities

Systems should communicate through tags, pressures, causes, memories, and capabilities rather than direct private coupling.

Example tags:

```txt
food
cleanliness_sensitive
inspection_relevant
pests
filth
rowdy
high_spend
low_cleanliness_tolerance
fire_risk
storage
service_area
```

Example:

A rats module should not directly mutate inspector suspicion.

Less desirable:

```ts
state.modules.inspections.suspicion += 10
```

Preferred:

```ts
ctx.addPressure({
  type: 'sanitation',
  source: 'rats:cellar_activity',
  amount: 10,
  tags: ['pests', 'filth', 'inspection_relevant'],
})
```

The inspection module may then react to pressures tagged `inspection_relevant`.

## 5.8 Simulation Context API

Modules should use a shared context API rather than freely mutating state.

The context API should provide helpers like:

```ts
ctx.getArea(id)
ctx.modifyArea(id, changes, meta)

ctx.getStock(id)
ctx.modifyStock(id, changes, meta)

ctx.getStaff(id)
ctx.modifyStaff(id, changes, meta)

ctx.getCustomerGroup(id)
ctx.modifyCustomerGroup(id, changes, meta)

ctx.addCause(cause)
ctx.addMemory(memory)
ctx.addPressure(pressure)
ctx.addIssueSeed(seed)
ctx.addReportSection(section)
ctx.random()
```

The API should help with:

- Clamping values
- Recording causes
- Producing state diffs
- Validating state
- Debug tracing
- Preventing unsafe mutation

## 5.9 Pure Simulation Logic

The simulation should be runnable without UI.

The core simulation should avoid:

```txt
DOM access
UI state
network calls
localStorage calls inside sim logic
raw Math.random
hidden globals
non-deterministic time access
```

The preferred model is:

```txt
previous state + player input + seeded RNG
→ next state + reports + diffs + issue seeds
```

This enables testing, replay, mobile development, and AI-assisted code changes.

---

# 6. Card Communication Contract

## 6.1 Purpose

Before real cards exist, the simulation must be able to produce intelligent outputs that future cards can use.

The card layer should receive structured objects, not vague prompts.

The simulation should be able to say:

```txt
Something is happening,
because of these causes,
involving these actors and systems,
with these stakes,
and these valid response intents,
which produce these consequences,
memories, and future hooks.
```

## 6.2 Issue Seeds

An issue seed is a structured, card-ready simulation output.

It is not a card. It contains the mechanical truth that a card may later present.

A conceptual issue seed:

```ts
type IssueSeed = {
  id: string
  family: string
  type: IssueType
  domains: string[]

  severity: number
  urgency: number
  novelty: number
  cardWorthiness: number

  timing: IssueTiming
  location?: EntityRef
  primaryActor?: EntityRef
  affectedActors: EntityRef[]

  causes: CauseRef[]
  stakes: StakeRef[]
  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]

  memoriesCreated: MemoryDraft[]
  futureHooks: FutureHook[]

  toneHints: ToneHint[]
  textIngredients: TextIngredients

  validation: SeedValidation
}
```

## 6.3 Issue Seed Types

The simulation should support multiple issue seed types:

```txt
crisis
warning
complaint
opportunity
staff_request
supplier_offer
maintenance_problem
customer_incident
reputation_shift
debt_pressure
inspection_threat
neighbourhood_event
weekly_trend
monthly_review
```

Each type tells the future card layer how the issue should be presented.

## 6.4 Text Ingredients

Issue seeds should include text ingredients but not full prose.

Example:

```ts
type TextIngredients = {
  subject?: string
  problemNoun?: string
  sensoryDetails?: string[]
  actorOpinions?: Record<string, string>
  recentContext?: string[]
  stakesReadable?: string[]
}
```

Example output:

```json
{
  "subject": "the stew",
  "problemNoun": "sour bubbling",
  "sensoryDetails": ["vinegar stink", "blue foam", "warm mushroom sweat"],
  "actorOpinions": {
    "cook": "insists it is traditional",
    "merchants": "look horrified",
    "local_goblins": "seem curious"
  },
  "recentContext": [
    "mushrooms were bought cheap yesterday",
    "the kitchen has not been cleaned in three days"
  ],
  "stakesReadable": [
    "Inspectors would hate this.",
    "Local goblins might actually buy it.",
    "The cook will resent being blamed."
  ]
}
```

The card layer later turns this into scene writing.

## 6.5 Response Intents

Player choices should send structured response intents back into the simulation.

Cards should not directly apply arbitrary effects.

Example response intent:

```ts
type ResponseIntent = {
  id: string
  verb: ResponseVerb
  target?: EntityRef
  tags: string[]
  tone?: string
  riskProfile?: string
}
```

Example:

```json
{
  "id": "serve_questionable_stew_as_special",
  "verb": "serve",
  "target": "stock.stew",
  "tags": ["risky_profit", "deception", "goblin_authenticity"],
  "tone": "reckless"
}
```

The simulation resolves the actual effects based on current state.

## 6.6 Response Verbs

The simulation should understand common response verbs:

```txt
repair
clean
pay
bribe
blame
hide
confess
discount
raise_price
lower_price
serve
discard
buy
sell
negotiate
threaten
appease
delegate
delay
inspect
upgrade
ban
invite
promote
fire
borrow
gamble
rebrand
```

Each verb should have consistent mechanical patterns.

Example:

```txt
bribe:
- costs coin
- reduces immediate institutional pressure
- creates corruption memory
- may increase future bribe expectations
```

```txt
blame:
- shifts pressure away from tavern short-term
- damages relationship with target
- may create future retaliation
```

```txt
rebrand:
- may convert a negative condition into a reputation experiment
- attracts some groups while repelling others
- creates identity memory
```

## 6.7 Choice Shapes

Response options should have recognizable tradeoff shapes.

Examples:

```txt
safe_costly
risky_profitable
relationship_sacrifice
delay_problem
long_term_investment
short_term_patch
deception
escalation
compromise
reputation_play
```

A strong card choice set usually includes multiple shapes, not four versions of the same answer.

## 6.8 Consequence Profiles

Issue seeds should describe likely consequence profiles.

Example:

```json
{
  "choiceId": "dump_stew",
  "effects": [
    { "target": "stock.stew.quantity", "delta": -20 },
    { "target": "foodSafetyPressure", "delta": -25 },
    { "target": "coin", "delta": -8 },
    { "target": "staff.cook.morale", "delta": -4 }
  ],
  "memories": ["stew_dumped_for_safety"],
  "futureHooksRemoved": ["food_poisoning_rumor"]
}
```

The exact outcome may still be context-sensitive, but the issue seed must communicate what the response is about.

## 6.9 State Diffs

After resolving a player response, the simulation should output state diffs.

Example:

```json
{
  "choiceId": "serve_anyway",
  "stateChanges": [
    {
      "target": "coin",
      "before": 42,
      "after": 61,
      "delta": 19,
      "readable": "You earned 19 coin."
    },
    {
      "target": "inspection.suspicion",
      "before": 38,
      "after": 51,
      "delta": 13,
      "readable": "Inspection suspicion increased."
    },
    {
      "target": "customerGroups.merchants.satisfaction",
      "before": 44,
      "after": 31,
      "delta": -13,
      "readable": "Merchants are less satisfied."
    }
  ],
  "memoriesAdded": ["served_questionable_stew"],
  "futureHooksAdded": ["food_poisoning_rumor"]
}
```

These diffs later support aftermath cards, reports, and player feedback.

## 6.10 Impact Scores

The simulation should measure whether a choice has noticeable impact.

A choice impact score may consider:

```txt
Visible state changes
Pressure changes
Memory importance
Future hook strength
Actor relationship changes
Reputation effects
Risk changes
```

Example thresholds:

```txt
Minor daily action: 10+
Normal issue/card choice: 30+
Major crisis choice: 60+
Monthly strategic decision: 80+
```

These numbers are tuning targets, not final balance laws.

The purpose is to prevent dead choices.

---

# 7. Pre-Card Readiness Requirements

Real card development may begin only after the simulation can pass the following gate.

## 7.1 Required Simulation Abilities

The simulation must be able to:

1. Run multiple days, weeks, and months without cards.
2. Produce readable daily, weekly, and monthly reports.
3. Track concrete tavern state.
4. Resolve owner actions.
5. Resolve staff priorities.
6. Resolve customer traffic and service.
7. Track stock, coin, spoilage, sales, waste, and shortages.
8. Track area condition, cleanliness, smell, damage, and risk.
9. Track staff morale, stress, wages, fatigue, skill, and loyalty.
10. Track customer group satisfaction, traffic, tolerance, rowdiness, and spending.
11. Track reputation across multiple axes.
12. Generate memories.
13. Generate causes.
14. Generate pressures.
15. Detect or report basic feedback loops.
16. Generate card-ready issue seeds.
17. Generate response intents and consequence profiles.
18. Resolve response intents back into state changes.
19. Output state diffs after choices.
20. Prevent obvious contradictions.

## 7.2 Cardless Playtest Requirement

Before cards exist, the game must support a cardless playtest using raw issue seed output.

The player/tester should be able to see something like:

```txt
DAY 12 - MORNING ISSUES

[1] Spoiled Stew Risk
Why:
- Mushroom spoilage is high.
- Kitchen cleanliness is low.
- Cook stress is high.

Stakes:
- Food safety
- Merchant satisfaction
- Inspection suspicion

Responses:
A. Dump the stew
B. Serve it anyway
C. Blame supplier
D. Assign cook to fix recipe
```

If this version is mechanically interesting, cards can make it delightful.

If this version is boring, prose will not fix the simulation.

## 7.3 Seed-to-Card Readiness Checklist

Every issue seed must answer:

```txt
What is happening?
Why is it happening now?
Where is it happening?
Who is involved?
What systems are at stake?
What can the player do?
What does each response change?
What does the tavern remember afterward?
What might this cause later?
Does it contradict anything?
```

If an issue seed cannot answer these questions, it is not ready to become a card.

---

# 8. Testing Contract

## 8.1 Deterministic Replay

Every simulation run must be replayable from:

```txt
initial state
input sequence
RNG seed
enabled modules
simulation version
```

If Day 19 produces a strange collapse, the same collapse must be reproducible.

## 8.2 Test Modes

The project should support several test modes:

```txt
runDay
runWeek
runMonth
runMany
comparePolicies
stressTestState
simulateNoPlayerInput
simulatePolicyBot
```

## 8.3 Policy Bots

Policy bots are simple automated owner strategies used for balance testing.

Examples:

```txt
always_clean
always_repair
always_maximize_profit
always_keep_prices_low
always_focus_food_quality
always_ignore_staff
always_cater_to_miners
always_cater_to_merchants
random_owner
```

These bots help reveal whether the simulation has dominant strategies, impossible survival curves, or weak systems.

## 8.4 Property Rules

The simulation should be tested against invariants such as:

```txt
Stock quantities should not become negative.
Cleanliness should remain within valid bounds.
Condition should remain within valid bounds.
Coin should never become NaN.
Calendar should advance correctly.
Expired memories should be removed or marked inactive.
Reports should not reference missing entities.
Issue seeds should not reference missing actors, areas, or systems.
Dead or unavailable staff should not receive assignments.
Rent should not be paid twice for the same month.
```

## 8.5 Balance Reports

Balance simulations should report:

```txt
Survival rate
Average coin
Average reputation axes
Common failure loops
Most profitable customer groups
Most dangerous customer groups
Inspection failure frequency
Staff burnout frequency
Rent failure frequency
Dominant strategies
Underused systems
Overpowered actions
```

---

# 9. Expansion Contract

## 9.1 Expansion Philosophy

The simulation must support future expansion without large refactors.

Future systems may include:

```txt
rats
inspectors
weather
rival tavern
landlord politics
guest rooms
brewing
kitchen recipes
crime
gangs
haunting
cultists
festivals
suppliers
neighbourhood map
renovations
staff personalities
```

These should plug into the existing module and registry architecture.

## 9.2 Expansion Test

Before card development begins, at least one small fake expansion should be added to prove the architecture works.

Implementation note: this expansion test is enforced as **Phase 20 readiness condition 14** (see `phases-16-20.md` §20.14). Phase 20 is where the test actually runs; this section defines what the test means and why it exists.

Example: Candle Shortage Expansion

Adds:

```txt
stock item: candles
action: buy candles
area effect: low light affects main room
customer effect: merchants dislike darkness, goblins tolerate it
issue seed: customers complain about darkness
report section: lighting report
```

If this requires editing many unrelated core files, the architecture is not ready.

The success standard is:

> **A small expansion should mostly add files, not rewrite existing systems.**

---

# 10. Initial Technical Recommendations

## 10.1 Language

The simulation should be written in TypeScript.

Reasons:

- Strong typing helps protect complex state.
- It is friendly to browser/mobile-first development.
- It works well with Vite and GitHub Pages.
- It is readable for AI coding agents.
- It supports pure simulation logic and later UI layers.

## 10.2 Recommended Dependencies

Keep dependencies lean.

Recommended:

```txt
Vitest       - test runner
fast-check   - property-based testing
Zod          - schema validation
Prando       - deterministic RNG
```

Optional later:

```txt
XState       - only if phase orchestration becomes complex
```

Avoid early:

```txt
large game engines
visual novel engines
card frameworks
complex ECS libraries
heavy economy libraries
LLM-generation dependencies
UI-first architecture
```

The simulation should be a pure engine first.

## 10.3 Suggested Folder Structure

```txt
/src/sim
  /core
    engine.ts
    phases.ts
    context.ts
    rng.ts
    validation.ts
    migrations.ts

  /state
    TavernState.ts
    schemas.ts
    defaults.ts

  /registries
    areaRegistry.ts
    stockRegistry.ts
    actionRegistry.ts
    customerRegistry.ts
    staffRegistry.ts
    reputationRegistry.ts
    pressureRegistry.ts
    issueSeedRegistry.ts

  /modules
    /calendar
    /economy
    /areas
    /stock
    /customers
    /staff
    /ownerActions
    /weekly
    /monthly
    /memories
    /causes
    /pressures
    /reports
    /issueSeeds

  /expansions
    /rats
    /inspections
    /weather
    /rivalTavern

  /testing
    runDay.ts
    runWeek.ts
    runMonth.ts
    runMany.ts
    policyBots.ts
    simAssertions.ts
```

---

# 11. Phase 1 Completion Criteria

Phase 1 is complete when this document is accepted as the design contract for the simulation.

The project should not move into implementation until these principles are understood:

```txt
The simulation is the truth.
Cards reveal truth.
The tavern must run without cards.
The tavern must explain itself.
Actions must leave residue.
Memories prevent contradiction.
Issue seeds are the bridge to cards.
The architecture must support expansions.
Testing is part of the simulation design, not a later cleanup step.
```

The finished simulation, before card writing starts, must be able to output:

```txt
Here is what is happening.
Here is why it is happening.
Here is who is involved.
Here is why it matters.
Here are valid player responses.
Here is what each response changes.
Here is what the tavern remembers afterward.
Here is what may happen later.
```

Only then should real card development begin.

---

# 12. Project Mantra

```txt
Cards do not create tavern drama.
Cards reveal, interpret, escalate, or resolve tavern drama that the simulation already understands.
```

Or, in goblin tavern terms:

```txt
The soup must actually be cursed before anyone is allowed to write a card about cursed soup.
```
