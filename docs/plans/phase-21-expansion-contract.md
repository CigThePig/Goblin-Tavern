# Goblin Tavern Simulation Expansion Contract & Scope Rules

## Phase 21 Status

**Status:** Complete on paper.

This document completes **Phase 21: Expansion Contract & Scope Rules**.

Phases 1 through 20 built the first card-ready version of the headless tavern simulation. The tavern can now run through days, weeks, and months, track meaningful state, explain causes, remember important events, detect pressure loops, generate structured issue seeds, preview response intent consequences, and run cardless readiness tests.

Phase 21 begins the second major planning arc.

This arc does not start card writing yet. It expands the simulation so future cards have more living material to draw from.

The core rule remains unchanged:

> **The simulation is the source of truth. Cards reveal, interpret, escalate, or resolve simulation truth. Cards must not invent truth.**

The expansion rule adds a second sentence:

> **Identity, culture, place, and relationships must become persistent simulation facts before they become card flavour.**

---

# 1. Purpose of the Expansion Arc

## 1.1 Original Build Arc

The first twenty phases answered this question:

> Can the tavern simulate enough mechanical truth to support cards later?

The answer should now be yes.

The first arc created the tavern's operational skeleton:

- calendar and deterministic replay
- serializable tavern state
- validation and normalization
- modular simulation pipeline
- physical tavern areas
- stock, sales, spoilage, shortages, and coin flow
- customer groups and satisfaction
- staff roles and performance
- daily service resolution
- owner actions
- weekly and monthly routines
- memory and history
- cause tracking
- pressures and feedback loops
- issue seed generation
- response intent previews
- cardless playtesting and readiness reporting

That work made the tavern mechanically legible.

## 1.2 Expansion Build Arc

The next arc answers a different question:

> Can the tavern simulate enough identity, variety, culture, and long-term social context that future cards feel specific instead of generic?

The expansion arc should give the card layer better ingredients without writing the cards yet.

By the end of the expansion arc, the simulation should support:

- named staff with persistent identities
- deterministic name generation
- distinct naming profiles by group, race, culture, or faction
- named regular customers
- named suppliers
- recurring faction representatives
- stronger customer-group identity
- local cultures and customs
- festivals, observances, market cycles, and settlement rhythms
- area atmosphere and upgrade identity
- long-term relationship memory between entities
- rumours, blame, credit, and social attribution
- richer pressure webs
- expanded issue seed families with better text ingredients

The expansion arc should make the tavern feel less like a spreadsheet that serves ale and more like a little goblin ecosystem with ledgers, grudges, sticky floors, suspicious stew, and people who remember exactly who watered down the beer.

---

# 2. Scope Boundary

## 2.1 What This Arc Is Allowed To Add

The expansion arc may add simulation systems that increase the amount of structured context available to future cards.

Allowed additions include:

- registries
- schemas
- deterministic generators
- persistent identity state
- social state
- faction state
- supplier state
- regular customer state
- expanded area metadata
- expanded calendar tags
- new pressure types
- new memory owners
- new issue seed families
- richer debug and readiness reports
- tests proving deterministic, serializable, card-ready behaviour

## 2.2 What This Arc Must Not Add Yet

Do not add finished cards in this arc.

Do not add:

- final card prose
- card decks
- card rarity systems
- card art prompts
- card UI
- narrative scenes detached from state
- one-off flavour events with arbitrary effects
- hardcoded storylines that bypass the simulation
- random names generated only for display and then discarded
- relationship changes without causes or memories

This arc creates the living pantry. The cards come later to cook from it.

## 2.3 The Difference Between Issue Seeds and Cards

Issue seeds are still allowed.

Cards are not.

An issue seed is structured simulation output:

```ts
{
  id: "seed_staff_burnout_001",
  familyId: "staff_loyalty_test",
  severity: 62,
  involvedEntityIds: ["staff_cook_001"],
  causes: ["cause_unpaid_wages_003"],
  textIngredients: {
    staffName: "Gribna Sootspoon",
    role: "cook",
    pressureName: "staff_burnout"
  },
  responseIntents: ["pay", "apologize", "ignore", "blame"]
}
```

A card is player-facing presentation:

```txt
Gribna Sootspoon slams the stew ladle down and says she is done cooking for a tavern that pays rats more reliably than staff.
```

The expansion arc may produce the first structure.

It must not produce the second as final content.

---

# 3. Mirror Rule For Phases 21 Through 40

Phases 21 through 40 should mirror Phases 1 through 20.

This means the new work should expand existing concepts rather than create an unrelated second game.

| Original Phase | Original Purpose | Expansion Phase | Expansion Purpose |
|---:|---|---:|---|
| 1 | Simulation contract | 21 | Expansion contract |
| 2 | Core structure | 22 | Content and domain structure |
| 3 | Calendar and time | 23 | Seasonal, cultural, and market time |
| 4 | RNG and replay | 24 | RNG streams and deterministic identity generation |
| 5 | Base state | 25 | Expanded world and social state |
| 6 | Validation | 26 | Expanded schemas and identity safety |
| 7 | Engine pipeline | 27 | Expanded simulation hooks |
| 8 | Areas | 28 | Area traits, upgrades, and atmosphere |
| 9 | Stock and economy | 29 | Suppliers, markets, and goods variety |
| 10 | Customers | 30 | Cultures, races, factions, and regulars |
| 11 | Staff | 31 | Staff identity, personality, and names |
| 12 | Daily service | 32 | Scene-level service incidents |
| 13 | Owner actions | 33 | Projects, policies, and social moves |
| 14 | Weekly routine | 34 | Supplier, staff, and community routines |
| 15 | Monthly routine | 35 | Seasonal arcs and local events |
| 16 | Memory | 36 | Character, faction, and relationship memory |
| 17 | Causes and diffs | 37 | Credit, blame, rumours, and attribution |
| 18 | Pressures | 38 | Expanded social and economic pressure webs |
| 19 | Issue seeds | 39 | Expanded issue seed and text ingredient families |
| 20 | Cardless readiness | 40 | Expanded content-readiness gate |

The mirror rule is not a prison. It is a navigation lantern.

If a later phase needs to shift because implementation reveals a better order, the new order must still preserve the contract: expand simulation truth before card expression.

---

# 4. Identity-First Design Rules

## 4.1 Generated Identity Must Persist

If the simulation generates an important person, group representative, supplier, faction contact, or regular customer, that identity must be stored in state.

Bad:

```txt
A goblin named Nib complains today.
```

Good:

```ts
regulars.byId["regular_goblin_001"] = {
  id: "regular_goblin_001",
  name: {
    display: "Nib Cracket",
    profileId: "goblin_common",
    parts: {
      given: "Nib",
      family: "Cracket"
    },
    generatedBy: "npc_identity"
  },
  groupId: "goblin_miners",
  firstSeenDay: 12,
  lastSeenDay: 12,
  loyalty: 42,
  irritation: 8,
  tags: ["complains_about_weak_ale"]
};
```

A name that appears in reports, issue seeds, or future cards should represent an entity the simulation can remember.

## 4.2 Names Must Come From Naming Profiles

Do not create one universal fantasy name generator.

Each major group, race, culture, or faction should be able to use a distinct naming profile.

A naming profile may define:

- given name patterns
- family name patterns
- clan name patterns
- occupational surnames
- title patterns
- nickname patterns
- syllable pools
- prefix and suffix pools
- formality rules
- short-name chance
- family-name chance
- nickname chance
- reserved names
- banned outputs
- examples for tests and debugging

Example profile IDs:

```txt
goblin_common
goblin_miner
dwarf_caravan
human_town
mirefolk_marsh
ratkin_scrapper
orc_roadcrew
elf_herbalist
```

These examples are not mandatory final lore. They are examples of the shape the system should support.

## 4.3 Names Are Not Decorations

Names must be useful to the simulation.

A generated staff name should be able to appear in:

- staff reports
- wage issues
- service incidents
- morale memories
- loyalty risks
- attribution records
- future card text ingredients

A generated supplier name should be able to appear in:

- stock shortages
- delivery records
- invoice pressure
- supplier relationship memory
- market explanations
- future supplier issue seeds

A generated regular customer name should be able to appear in:

- complaint records
- loyalty reports
- grudges
- rumours
- seating conflicts
- future regular-customer issue seeds

## 4.4 Identity Requires References

Any generated entity should use stable IDs and references.

Use IDs for simulation logic. Use display names for reports.

Good:

```ts
{
  involvedEntityIds: ["staff_cook_001", "regular_goblin_004"],
  textIngredients: {
    staffName: "Gribna Sootspoon",
    regularName: "Nib Cracket"
  }
}
```

Bad:

```ts
{
  summary: "Gribna argued with Nib"
}
```

The second version may be readable, but it gives future systems nothing sturdy to grab.

---

# 5. Culture, Race, and Group Rules

## 5.1 Distinct Groups Must Be Mechanically Meaningful

A culture, race, faction, or customer group should not exist only as a label.

If the game has goblin miners, dwarf caravaners, mirefolk fishers, ratkin scrappers, or human town officials, they should differ in at least some of the following:

- traffic patterns
- spending habits
- preferred goods
- disliked goods
- tolerance for filth
- tolerance for violence
- sensitivity to price
- sensitivity to reputation
- preferred areas
- disliked area traits
- important calendar tags
- common personality tags
- common conflict tags
- naming profile
- relationship to other groups
- relationship to the tavern

## 5.2 Avoid Essentialist Traps

Groups can have tendencies. Individuals can vary.

A customer group may be more tolerant of filth on average, but a named regular from that group can still personally hate dirty tables.

A faction may be dangerous, but one representative can be polite.

A naming profile can make names distinct without turning every member of a group into a joke.

The simulation should support colourful goblin tavern nonsense without flattening every group into one trait wearing boots.

## 5.3 Culture Should Connect To Time

Cultural identity should connect to the calendar.

Examples:

- miner payday
- mushroom festival
- caravan arrival day
- local tax window
- shrine observance
- ratkin scrap fair
- storm season
- winter shortage
- market day

These should be calendar tags or event windows that systems can query.

Do not bury cultural timing inside prose.

---

# 6. World State Expansion Rules

## 6.1 The World Around The Tavern Must Be State

The tavern should gradually know more about its surrounding settlement.

Possible future state containers:

```ts
state.world = {
  cultures: {},
  factions: {},
  suppliers: {},
  regulars: {},
  notableNpcs: {},
  localEvents: {},
  socialRumours: {},
  marketConditions: {}
};
```

Exact naming may change during implementation, but the responsibilities should exist.

## 6.2 State Must Stay Serializable

All expansion state must remain plain JSON-compatible data.

Do not store:

- class instances
- functions
- Maps
- Sets
- circular references
- live RNG objects
- Date objects
- DOM or browser references

The save file should stay boring. Boring save files are trustworthy little crates.

## 6.3 Registries Remain The Source Of Expandable Definitions

The existing project uses registries for expandable concepts. Continue that pattern.

Likely new registries include:

```txt
namingProfileRegistry
cultureRegistry
factionRegistry
supplierRegistry
npcArchetypeRegistry
areaTraitRegistry
upgradeRegistry
marketConditionRegistry
seasonalEventRegistry
localArcRegistry
expandedIssueSeedRegistry or additional issue seed family registrations
```

Avoid hardcoded lists inside simulation functions when the concept is likely to expand.

## 6.4 State Stores Instances, Registries Store Definitions

A registry describes what can exist.

State records what does exist.

Example:

```ts
// Registry definition
supplierTypeRegistry.register({
  id: "mushroom_cart",
  label: "Mushroom Cart Supplier",
  goodsProvided: ["mushrooms", "stew_base"],
  tags: ["food", "perishable", "local"]
});

// State instance
state.world.suppliers.byId["supplier_001"] = {
  id: "supplier_001",
  supplierTypeId: "mushroom_cart",
  name: "Brakka Sporewheel",
  relationship: 58,
  reliability: 71,
  lastDeliveryDay: 18,
  activeFlags: []
};
```

Do not put per-run relationship values inside registry definitions.

---

# 7. Determinism And Replay Rules

## 7.1 All Expansion Randomness Must Use Seeded RNG

No `Math.random()` may be used in simulation code.

This applies especially to:

- generated names
- generated regulars
- generated suppliers
- generated faction representatives
- generated local events
- generated rumours
- generated issue seeds
- personality tags
- background hooks

## 7.2 Use Separate RNG Streams Where Needed

Identity generation should not accidentally change because a service incident rolled one extra random number.

Future phases should introduce named RNG streams or equivalent deterministic isolation.

Suggested stream IDs:

```ts
type RngStreamId =
  | "service"
  | "economy"
  | "incidents"
  | "names"
  | "npc_identity"
  | "staff_identity"
  | "supplier_identity"
  | "regular_identity"
  | "faction_behaviour"
  | "seasonal_events"
  | "issue_seed_selection";
```

Exact implementation may differ, but replay stability is mandatory.

## 7.3 Generated Names Must Be Stable

Given the same seed and the same sequence of identity creation events, generated names should be identical.

Tests should prove this.

Generated names must not change when a report is viewed again.

Generated names must not change because an issue seed is sorted differently.

Generated names must not be regenerated on every render.

---

# 8. Relationship And Memory Rules

## 8.1 Important Relationships Must Be Trackable

The expansion arc should support relationships between:

- tavern and staff
- tavern and regulars
- tavern and suppliers
- tavern and factions
- staff and staff
- customer groups and customer groups
- factions and customer groups
- suppliers and factions
- named NPCs and the tavern

Not all of these need to be implemented immediately. The architecture should not block them.

## 8.2 Memories Should Belong To Specific Owners

Phase 16 introduced memory and history. The expansion arc should eventually allow memories to belong to more specific owners.

Possible memory owners:

```txt
tavern
staff member
regular customer
supplier
faction
customer group
area
local arc
```

Example:

```ts
{
  id: "memory_supplier_late_payment_001",
  owner: { type: "supplier", id: "supplier_001" },
  type: "grudge",
  strength: 44,
  tags: ["late_payment", "trust_loss"],
  relatedCauses: ["cause_invoice_unpaid_002"]
}
```

## 8.3 Social Truth Can Differ From Mechanical Truth

The simulation should eventually distinguish between what happened and what people believe happened.

Example:

Mechanical truth:

```txt
Mushroom stew quality dropped because the supplier delivered spoiled stock.
```

Customer belief:

```txt
The cook is lazy.
```

Faction belief:

```txt
The owner is cutting costs.
```

Supplier belief:

```txt
The tavern is blaming us to avoid paying invoices.
```

Future cards become more interesting when blame, suspicion, credit, and gratitude can be wrong.

---

# 9. Report And Debug Rules

## 9.1 Reports Must Stay Useful To Developers

Expansion systems must produce reports that explain what happened without turning into final prose.

Good report output:

```txt
Regular customer update:
- Nib Cracket visited today.
- Loyalty +4 due to favourite drink being available.
- Irritation +7 due to sticky_floor trait in common_room.
- Created issue seed candidate: regular_complaint.
```

Bad report output:

```txt
Nib Cracket scowled like thunder and muttered into his ale.
```

That second line may become card prose later, but it is not the job of the simulation report.

## 9.2 Reports Should Expose Text Ingredients

Issue seed and readiness reports should show whether future cards will have enough material.

Useful text ingredients include:

```txt
named staff
staff role
staff personality tag
named regular
supplier name
faction name
customer group name
area name
area trait
market condition
calendar tag
relevant memory
relevant cause
perceived blame
current pressure
response intent options
```

## 9.3 The Expansion Arc Needs Its Own Readiness Gate

Phase 40 should prove that the expanded simulation is ready for real cards.

The readiness gate should check:

- name variety
- duplicate name risk
- identity persistence
- culture distinctness
- supplier relevance
- regular customer emergence
- faction relevance
- issue seed richness
- text ingredient coverage
- contradiction risk
- replay stability
- old Phase 1 through 20 systems still passing

---

# 10. Random Name Generator Requirements

## 10.1 Name Generator Purpose

The random name generator is not a novelty tool.

It is an identity subsystem.

It should provide stable, culturally distinct names for entities the simulation can remember and reference.

Primary users:

- staff
- regular customers
- suppliers
- faction representatives
- notable NPCs
- possibly generated businesses, clans, gangs, carts, guilds, and local places later

## 10.2 Generated Name Shape

Recommended shape:

```ts
type GeneratedName = {
  display: string;
  profileId: string;
  parts: {
    given?: string;
    family?: string;
    clan?: string;
    title?: string;
    nickname?: string;
    epithet?: string;
  };
  generatedBy: string;
  seedTag?: string;
};
```

The `display` field is what reports and future cards can show.

The `parts` object exists so systems can later distinguish between given names, clan names, nicknames, and titles.

## 10.3 Naming Profile Shape

Recommended shape:

```ts
type NamingProfile = {
  id: string;
  label: string;
  tags: string[];

  givenNamePatterns: NamePattern[];
  familyNamePatterns?: NamePattern[];
  nicknamePatterns?: NamePattern[];
  titlePatterns?: NamePattern[];

  useFamilyNameChance: number;
  useNicknameChance: number;
  useTitleChance?: number;

  syllables?: {
    starts: string[];
    middles?: string[];
    ends: string[];
  };

  reservedNames?: string[];
  bannedOutputs?: string[];
  examples?: string[];
};
```

Exact type names may change during implementation.

The important requirement is that naming logic must be data-driven and registry-backed.

## 10.4 Example Naming Directions

These are direction examples, not mandatory final content.

### Goblin Common

Short, practical, slightly jagged names. Often one or two syllables. Family names or nicknames may reference tools, food, grime, work, or small hazards.

Example flavour targets:

```txt
Nib Cracket
Gribna Sootspoon
Snit Brindlepot
Mog Tallowbit
```

### Dwarf Caravan

Sturdy given names with clan, trade, stone, metal, cart, brewing, or road references.

Example flavour targets:

```txt
Borren Stonekeg
Hilda Copperbraid
Dagna Ironcart
```

### Human Town

Plain local names with occupation, plant, trade, or place-like surnames.

Example flavour targets:

```txt
Mara Cooper
Tomlin Vetch
Elsbet Tanner
```

### Ratkin Scrapper

Quick clipped names with scavenged-object, rust, wire, nail, bone, or alley references.

Example flavour targets:

```txt
Tik Rustbit
Sella Bentnail
Vik Wiretail
```

### Mirefolk Marsh

Names with reed, mud, fog, fish, lantern, rain, and lowland sounds.

Example flavour targets:

```txt
Luma Reedskin
Vesh Lowmarsh
Orren Mudlamp
```

Again: do not overfit to these examples. They exist to show that profiles should produce distinct texture.

---

# 11. Expansion Coding Rules

## 11.1 Preserve Existing Architecture

All expansion work must respect the current project shape:

```txt
src/sim/core/
src/sim/state/
src/sim/registries/
src/sim/modules/
src/sim/testing/
src/sim/utils/
tests/sim/
docs/plans/
```

Do not introduce a parallel architecture.

## 11.2 Pure Simulation Only

The simulation remains headless.

Do not add:

- React
- DOM logic
- browser storage
- network calls
- timers
- UI state
- audio
- image assets
- platform-specific code

## 11.3 Tests Must Prove Behaviour

Every expansion phase should add tests similar to the existing phase tests.

Tests should cover:

- deterministic replay
- valid state
- invalid state rejection
- registry lookups
- report generation
- issue seed ingredients
- backward compatibility where relevant
- no accidental card prose

## 11.4 Migration Safety

The existing Phase 1 through 20 state shape should not be casually broken.

If expansion state requires migrations, write them deliberately.

Old valid saves should either:

- migrate into the expanded state, or
- fail with a clear validation error explaining the missing version path

Silent corruption is worse than a loud goblin with a saucepan.

---

# 12. Phase 21 Deliverables

Phase 21 is documentation only.

Required deliverable:

```txt
docs/plans/phase-21-expansion-contract.md
```

This document must define:

- the purpose of the expansion arc
- the no-card boundary
- the mirror relationship between Phases 1 to 20 and Phases 21 to 40
- identity persistence rules
- naming profile rules
- culture and group rules
- expanded world-state rules
- deterministic generation rules
- relationship and memory rules
- report and readiness expectations
- acceptance criteria for Phase 21

No TypeScript files are required for Phase 21.

No tests are required for Phase 21 unless the project has a documentation test system.

---

# 13. Acceptance Criteria

Phase 21 is complete when:

- this expansion contract exists under `docs/plans/`
- it clearly preserves the Phase 1 simulation-first rule
- it clearly states that cards are still forbidden
- it defines the second-arc expansion purpose
- it explains how Phases 21 through 40 mirror Phases 1 through 20
- it establishes persistent identity as a simulation requirement
- it establishes deterministic naming profiles as the required approach for generated names
- it explains how cultures, races, customer groups, suppliers, factions, and regulars should become mechanically meaningful
- it defines the boundary between issue seeds and finished cards
- it gives future implementation agents enough structure to build Phases 22 through 40 without drifting into unrelated systems

---

# 14. Do Not Do In Phase 21

Do not write cards.

Do not implement the name generator yet.

Do not add staff personality code yet.

Do not add new state containers yet.

Do not add schemas yet.

Do not add new issue seed families yet.

Do not rewrite existing phases.

Do not refactor completed systems.

Do not update game balance.

Do not change tests.

Do not introduce lore as final canon.

Phase 21 is the oath nailed to the tavern door before the next construction crew arrives.

---

# 15. Recommended Next Phase

The next phase should be:

```txt
Phase 22 — Expanded Content & Registry Structure
```

Phase 22 should create the folder and registry structure for the new expansion domains, especially:

- naming
- cultures
- factions
- NPC identity
- suppliers
- area traits
- upgrades
- seasonal or local events
- text ingredients

Phase 22 should still avoid finished content and final cards.

It should prepare the project so Phase 23 and beyond can add richer calendar, identity, world, and social systems without jamming everything into existing modules like stuffing a whole troll into a broom closet.
