# Phase 188 — Starting Fairness and Mechanical Legibility Plan

## Summary

The current simulation already has many good ingredients for a messy inherited tavern: mediocre staff trust, low-ish cleanliness, imperfect suppliers, faction/culture tension, and scarce stock. The fairness problem is that several systems do not consistently distinguish **inherited baseline weakness** from **player-caused failure**. Some calculators convert neutral or slightly poor day-zero values into live pressure immediately, several seed generators can surface accusatory issue cards as soon as pressure crosses a threshold, and the UI often summarizes real numeric consequences as flavour-only prose.

Design target for the implementation pass:

> The sim can start messy, but it must not start accusatory. The player should inherit a problematic tavern, understand the problems, and get fair chances to respond.

Recommended architecture:

1. Add an explicit opening-state/agency layer that can classify day-zero values as `inherited`, `observed`, `warned`, `playerCaused`, or `ignored`.
2. Split pressure calculation from player-facing blame: low baselines may contribute to dashboards and opening ledgers, but not crisis copy or punitive issue eligibility until agency gates are satisfied.
3. Add mechanical legibility metadata for owner actions and card choices so the UI can show costs, target quantities, thresholds, and before/after deltas consistently.
4. Retune only where agency gates are insufficient, especially day-zero stock/economy and low relationship averages.

## Current findings

### A. Starting-state registries create fragile baselines

#### 1. Staff loyalty starts neutral/unproven but can become loyalty pressure

- **File / module:** `src/sim/registries/staffRegistry.ts`, `REQUIRED_STAFF_ROLES`; `src/sim/modules/pressures/calculators/staffLoyaltyRisk.ts`, `calculateStaffLoyaltyRisk`.
- **Current behaviour:** The seeded cook/server/cleaner-bouncer have loyalty values of 50, 45, and 55, with morale 45/50/40 and stress 35/25/30. The loyalty-risk calculator averages `100 - loyalty` across all staff and starts a pressure cause once average inverse loyalty is at least 30. With the starting staff, the average inverse loyalty is 50, creating roughly 20 pressure before the player acts. Low morale and unpaid wages can add more if the opening state or weekly state changes.
- **Why it feels unfair/unreadable:** A loyalty score around 45–55 reads like “unproven staff trust,” not “the player has mistreated staff.” The pressure cause text says “Staff loyalty low on average,” and issue copy can escalate to “loyalty test,” “tense week of service,” and “may quit,” which implies player culpability.
- **Category:** Baseline-as-failure; missing agency gates; narrative/mechanical mismatch.
- **Recommended treatment:** Gate player-facing loyalty-risk issue eligibility behind one of: player missed wages, selected a blame/scapegoat/overwork action, ignored a staff warning, or day count exceeds an opening grace period. Keep neutral loyalty visible in an opening ledger as “not yet won over.” Consider retuning the baseline cause to start only below an average loyalty of 45, or classify it as `inherited_baseline` with lower issue weight until observed.
- **Suggested tests:**
  - Initial state pressure calculation may include a non-punitive staff baseline cause, but must not generate a staff identity/quit warning on day 0 without a player-caused memory.
  - After a player selects an overwork/scapegoat/unpaid-wage path, staff loyalty risk can generate a relationship test with blame copy.
  - Opening ledger labels loyalty as “unproven,” not “low” or “slighted.”

#### 2. Starting stock can become shortage pressure before the player understands opening demand

- **File / module:** `src/sim/registries/stockRegistry.ts`, `REQUIRED_STOCK`; `src/sim/modules/pressures/calculators/stockShortage.ts`, `calculateStockShortage`; `src/sim/modules/issues/issueSeedGenerators.ts`, `generateStockShortage`.
- **Current behaviour:** Starting quantities are ale 80, stew 40, ingredients 60, mushrooms 45, firewood 50, mugs 35. The stock-shortage pressure uses low thresholds of ale <= 45, stew <= 15, mushrooms <= 8, with high-demand day multipliers. The issue generator separately considers any stock item with quantity <= 30 once stock pressure reaches 35. Restocking a shortage costs 30 coin and adds 60 units, but the card preview may reduce this to broad text.
- **Why it feels unfair/unreadable:** The opening stock is not itself below the pressure thresholds, but ale can run down quickly relative to opening demand. If the first high-demand day consumes stock before the player gets a clear opening inventory/demand forecast, the player sees an urgent “shortage” warning as if they failed to prepare. The issue generator’s generic <= 30 candidate threshold can also include non-ale items if pressure came from ale or memories.
- **Category:** Over-hot opening economy; missing agency gates; hidden mechanics.
- **Recommended treatment:** Add an opening-stock runway calculation (expected servings by day type / current quantity) and surface it before service. Convert day-zero or first-service stock problems to “opening ledger: low runway” rather than “ignored shortage.” Gate “Ignore the shortage” memory/copy until the player has seen the warning and proceeds anyway. Consider retuning starting ale or first-week demand if runway tests show unavoidable depletion.
- **Suggested tests:**
  - Fresh tavern has at least N normal-demand servings and at least one fair response window before “ignored_shortage_recently” can exist.
  - High-demand day shows expected demand and current stock before service.
  - Stock-shortage seed subject matches the actual pressure cause, not any arbitrary <= 30 stock row.

#### 3. Dirty starting areas generate sanitation/inspection/pest signals immediately

- **File / module:** `src/sim/registries/areaRegistry.ts`, `REQUIRED_AREAS`; `src/sim/modules/pressures/calculators/foodSafety.ts`, `calculateFoodSafety`; `src/sim/modules/pressures/calculators/pest.ts`, `calculatePest`; `src/sim/modules/pressures/calculators/inspection.ts`, `calculateInspection`; `src/sim/modules/issues/issueSeedGenerators.ts`, `generateFoodSafety` and `generateInspection`.
- **Current behaviour:** The kitchen starts at cleanliness 40/smell 35/risk 30, cellar 30/45/40 with `pest_prone`, privy 25/70/50 with `inspection_sensitive`, main room 45/25/20. Food safety gives +10 for kitchen cleanliness <= 50. Pest gives +18 for cellar cleanliness <= 30 and +6 because a pest-prone cellar holds food. Inspection gives +14 for privy smell >= 65 and +6 for inspection-sensitive unclean privy. These are inherited day-zero values.
- **Why it feels unfair/unreadable:** The tavern should start grimy, but the sim currently treats griminess as live risk. Privy/cellar/kitchen pressure can appear before the player has had a meaningful chance to clean, hire, schedule a roster, or discover the inspection-sensitive area.
- **Category:** Baseline-as-failure; missing agency gates; narrative/mechanical mismatch.
- **Recommended treatment:** Preserve the messy meters, but introduce `inherited_sanitation` causes that feed an opening ledger and lower-severity dashboard. Gate pest outbreaks, inspection warnings, and food-safety crisis cards until the area has been discovered/observed and at least one cleaning opportunity has passed, or until the player serves risky food / ignores a warning. Reword opening copy to “found this way” rather than “neglected.”
- **Suggested tests:**
  - Fresh state may list “Privy starts foul” in opening ledger, but no inspection warning card appears on day 0 solely from the privy baseline.
  - Cleaning the privy/kitchen before service reduces the inherited cause and prevents early inspection escalation.
  - Serving anyway with known bad conditions converts the issue from inherited to player-caused and unlocks stronger consequence copy.

#### 4. Supplier baselines can read as distrust before any supplier interaction

- **File / module:** `src/sim/content/suppliers/supplierRegistry.ts`, `REQUIRED_SUPPLIERS`; `src/sim/modules/pressures/calculators/supplierDistrust.ts`, `calculateSupplierDistrust`; `src/sim/modules/issues/expandedSeedGenerators.ts`, `generateSupplierRelationship`.
- **Current behaviour:** Starter and alternate suppliers include relationships from 30 to 55 and reliability from 40 to 80. The supplier-distrust calculator averages inverse relationship and inverse reliability across all suppliers. If the average inverse relationship is >= 30, it says suppliers feel underappreciated. If average reliability deficit is >= 25, it says suppliers are unreliable on average. The supplier relationship seed can surface when supplier distrust plus market instability crosses the shared pressure threshold.
- **Why it feels unfair/unreadable:** Low supplier relationship can mean “new account / no trust yet,” not that the player underappreciated anyone. Low reliability is often a supplier trait or market fact, not the player’s failure. The phrase “underappreciated” assigns emotional blame prematurely.
- **Category:** Baseline-as-failure; narrative/mechanical mismatch.
- **Recommended treatment:** Split supplier metrics into `relationship` (how they feel about the tavern/player) and `reliability` (operational risk). Day-zero low relationship should be “unproven account” until late payment, blame, or dispute memories exist. Consider excluding alternate suppliers the player has not discovered/contracted from average distrust, or mark them as market intelligence only.
- **Suggested tests:**
  - Fresh suppliers with low relationship/reliability do not produce “underappreciated” copy or a supplier may walk stake before an interaction.
  - Late payment or blame memory unlocks distrust copy and supplier relationship issue generation.
  - Reliability-only problems produce operational-market wording, not betrayal/resentment wording.

#### 5. Faction and culture baselines can look like anger/conflict

- **File / module:** `src/sim/content/factions/factionRegistry.ts`, `REQUIRED_FACTIONS`; `src/sim/content/cultures/cultureRegistry.ts`, `REQUIRED_CULTURES`; `src/sim/modules/pressures/calculators/factionAnger.ts`, `calculateFactionAnger`; `src/sim/modules/pressures/calculators/culturalTension.ts`, `calculateCulturalTension`; `src/sim/modules/issues/expandedSeedGenerators.ts`, `generateFactionRequest` and `generateCultureConflict`.
- **Current behaviour:** Factions start with relationships mostly 45–55, trust as low as 35, fear up to 55. Cultures start with tension from 20 to 55, including ogre clans at 55 and road merchants/traveling outsiders at 45. Faction anger treats average inverse relationship >= 35 as “Factions feel slighted” and average fear >= 30 as anger pressure. Cultural tension treats average tension >= 25 as a pressure cause. Observance tags active today add a fixed +10 as “cultural observance tag(s) active today,” even if the player has not learned the observance.
- **Why it feels unfair/unreadable:** Faction fear and cultural tension are setting facts, not necessarily player-caused anger. “Slighted,” “observance ignored,” or “faction demand” copy can imply the player caused conflict simply by opening the game on the wrong calendar day.
- **Category:** Baseline-as-failure; missing agency gates; narrative/mechanical mismatch.
- **Recommended treatment:** Add discovery/agency gates for social pressure. Faction/culture baselines should appear in a world briefing as “political weather,” while anger/conflict issues require a player interaction, an observed warning, a calendar briefing, or a second occurrence after the player had a chance to prepare. Rename pressure causes from accusatory language to neutral baseline language until player-caused memories exist.
- **Suggested tests:**
  - Fresh world with high ogre/default culture tension may show a briefing but should not create a “conflict” card unless co-present groups or known calendar obligations actually apply.
  - Calendar observance pressure must require prior discovery or an opening notice before “ignored”/blame wording can be used.
  - Faction anger copy changes from “feel slighted” to “watching the tavern warily” until there is a grudge/blame/backlash memory.

### B. Pressure calculators lack a shared agency concept

#### 6. Pressure cause metadata has no day-zero/provenance classification

- **File / module:** `src/sim/modules/pressures/calculators/*`, especially `staffLoyaltyRisk.ts`, `supplierDistrust.ts`, `factionAnger.ts`, `culturalTension.ts`, `foodSafety.ts`, `pest.ts`, `inspection.ts`, `stockShortage.ts`.
- **Current behaviour:** `PressureCauseRef` entries carry ids, readable text, amount, tags, related actors/locations/systems. They do not say whether a cause is inherited, discovered, warned, player-caused, or ignored.
- **Why it feels unfair/unreadable:** Issue generators and cards cannot distinguish “the cellar was already pest-prone” from “the player ignored rats for a week.” As a result, opening conditions flow into the same severity/urgency pipeline as player consequences.
- **Category:** Baseline-as-failure; missing agency gates.
- **Recommended treatment:** Extend pressure cause metadata with optional provenance/agency fields such as `origin: 'inherited' | 'sim_drift' | 'player_action' | 'memory' | 'calendar'`, `agencyState: 'undiscovered' | 'observed' | 'warned' | 'ignored' | 'caused'`, and `playerFacingWeight`. Issue generators should be able to require `agencyState >= warned` for accusatory cards, while dashboards can still show baseline causes.
- **Suggested tests:**
  - All baseline registry-derived causes are tagged `origin: inherited` on fresh state.
  - Issue-seed eligibility can filter inherited-only pressure below crisis thresholds.
  - Pressure dashboards still total/visualize inherited causes without generating blame text.

#### 7. Shared thresholds are too generic for opening fairness

- **File / module:** `src/sim/modules/issues/issueSeedGenerators.ts` and `src/sim/modules/issues/expandedSeedGenerators.ts`.
- **Current behaviour:** Several issue generators use fixed pressure thresholds (for example food safety 45, stock shortage 35, maintenance 40, faction/culture 25-ish) without checking how the pressure arose or whether the player had an available response.
- **Why it feels unfair/unreadable:** A fixed threshold can be appropriate after a week of play but too hot for the opening morning. Baseline dirt plus neutral social tensions can cross thresholds before the player knows what knobs exist.
- **Category:** Missing agency gates; over-hot opening economy.
- **Recommended treatment:** Add a common `canSurfaceAsPlayerFacingIssue(ctx, pressureId, options)` helper that checks day count, opening grace, discovered systems, player-caused memories, prior warnings, and available responses. Use it across issue generators rather than ad hoc day checks.
- **Suggested tests:**
  - Parameterized fresh-state issue generation across all pressure families produces only opening-briefing/ledger-safe issues.
  - After a warning is shown and ignored, the same pressure can surface normally.

### C. Issue/card text sometimes implies blame too early

#### 8. Staff and social seeds include accusatory “tense week,” “slighted,” “may quit,” “demand,” and “ignored” framing

- **File / module:** `src/sim/modules/issues/expandedSeedGenerators.ts`, `generateStaffIdentity`, `generateSupplierRelationship`, `generateFactionRequest`, `generateCultureConflict`; card pools under `src/cards/compose/pools/*`.
- **Current behaviour:** Staff identity seeds use `problemNoun: 'loyalty test'`, `recentContext: ['tense week of service']`, and stakes like “may quit.” Supplier/faction/culture seeds use stakes like “Supplier may walk,” “Relationship may break,” and “Comfort may collapse,” with `type` values such as `social_conflict` and `supplier_offer`.
- **Why it feels unfair/unreadable:** Those stakes may be appropriate after repeated player choices, but on day 0 they imply a known prior failure or an actively deteriorating relationship.
- **Category:** Narrative/mechanical mismatch; baseline-as-failure.
- **Recommended treatment:** Add opening-safe text ingredients and tone hints. When all causes are inherited/unproven, use “briefing,” “uneasy baseline,” “first impression,” and “watching closely” copy. Reserve “again,” “ignored,” “slighted,” “unpaid,” “neglected,” “all week,” “failed,” and “may quit/walk/break/collapse” for player-caused or repeated states.
- **Suggested tests:**
  - Snapshot/card text tests assert forbidden blame words are absent from day-zero inherited-only cards.
  - The same family can use stronger language after a relevant memory tag exists.

#### 9. “Ignore” choices create ignored memories even when the first card is the first warning

- **File / module:** `src/sim/modules/issues/issueSeedGenerators.ts`, shortage/maintenance/inspection ignore profiles; similar profiles in expanded generators.
- **Current behaviour:** Some modeled ignore slots add delayed pressure and memories like `ignored_shortage_recently`. The UI correctly hides the generic Ignore button when a card has an explicit ignore choice, but the first explicit ignore can immediately create a memory tagged `ignored`.
- **Why it feels unfair/unreadable:** If the card is the first warning, “ignore” is a valid choice, but future copy should distinguish “declined first warning” from “ignored repeated warnings.”
- **Category:** Missing agency gates; narrative/mechanical mismatch.
- **Recommended treatment:** Introduce warning-stage memories: first ignore creates `warning_declined` or `deferred`, second ignore promotes to `ignored_warning`. Use these tags in pressure calculators and card copy.
- **Suggested tests:**
  - First ignore of a newly discovered shortage creates a non-accusatory deferred memory.
  - Second ignore or ignore after explicit “warning” creates `ignored_warning` and unlocks stronger copy.

### D. Hidden mechanics make choices hard to evaluate

#### 10. Owner action list uses prose previews even though apply functions know exact deltas

- **File / module:** `src/sim/modules/ownerActions/actionDefinitions.ts`, action definitions and `apply` results; `src/sim/modules/ownerActions/socialActions.ts`; `web/src/lib/components/ActionPicker.svelte`; `web/src/lib/sim/actionBuilder.ts`.
- **Current behaviour:** Owner actions define broad `effectsPreview` strings like “Raises cleanliness; lowers smell and risk,” “Restocks serving mugs for capacity,” or “Eases a staffer’s stress and steadies loyalty.” The `apply` functions calculate exact before/after values and return structured `effects`/`data`, but the picker only shows the coarse preview and time cost before the player chooses.
- **Why it feels unfair/unreadable:** Players cannot know whether a cleaning action raises cleanliness by 6 or 30, whether restocking costs enough to bankrupt them, or which pressure thresholds will be crossed. The sim has exact numbers at apply time but not preview time.
- **Category:** Hidden mechanics.
- **Recommended treatment:** Add a dry-run/preview API to owner actions, or factor effect calculations into pure helpers used by both `preview` and `apply`. Show exact cost, key before/after meters, and relevant threshold changes in `ActionPicker` target rows.
- **Suggested tests:**
  - Each owner action exposes deterministic preview data for a fixed state.
  - Preview and apply deltas match for clean/repair/restock/social actions.
  - UI renders coin cost and before/after values for target-specific actions.

#### 11. Card choice previews intentionally compress effects and can omit crucial numbers

- **File / module:** `src/cards/cardHelpers.ts`, `selectPreviewEffects`; `src/sim/core/effect.ts`, `EffectPreview`; `web/src/lib/cards/CardRenderer.svelte`; pools under `src/cards/compose/*`.
- **Current behaviour:** Consequence profiles carry numeric `EffectPreview` amounts, target kinds, directions, magnitude bands, meter ids, and readable strings. Card rendering shows `previewEffects` strings generated through compositional pools. Recent work preserves cost lines and adds delayed “later:” lines, but the final UI still often presents flavour-like summaries instead of exact numbers.
- **Why it feels unfair/unreadable:** Important tradeoffs such as coin costs, stock quantities, pressure deltas, relationship changes, risks, and delayed hooks are mechanically real but can be hidden behind prose. Magnitude bands help author text, but they are not a substitute for player-facing values during a strategy choice.
- **Category:** Hidden mechanics.
- **Recommended treatment:** Preserve voiced prose, but add an optional “mechanics” row per choice with exact deltas (`coin -30`, `ale +60`, `inspection -12`, `staff fatigue +8`) and risk/future-hook labels. Keep the current flavour preview as the short view, with an expand/toggle or always-visible compact numeric chips.
- **Suggested tests:**
  - Card choice model includes raw `EffectPreview` metadata alongside voiced strings.
  - Renderer displays exact coin costs and at least the top state/pressure deltas.
  - Delayed effects are marked delayed and not confused with immediate effects.

#### 12. Supplier details, thresholds, and demand forecasts are not consistently exposed at decision points

- **File / module:** `src/sim/modules/ownerActions/actionDefinitions.ts`, stock/restock actions; `src/sim/modules/issues/issueSeedGenerators.ts`, stock shortage profiles; `src/sim/modules/suppliers/pricing` via restock/pick supplier calls; `web/src/lib/components/ActionPicker.svelte`; `web/src/lib/components/tavern/StockDetailSheet.svelte`; `web/src/lib/components/world/SupplierDetailSheet.svelte`.
- **Current behaviour:** Some target hints show current quantity/quality or relationship, but shortage cards and action rows do not consistently show supplier picked, unit price, missed-delivery risk, day-type demand multiplier, or resulting stock runway.
- **Why it feels unfair/unreadable:** The player cannot tell whether a shortage is urgent because of today’s demand, tomorrow’s supplier day, current coin, or a supplier reliability problem.
- **Category:** Hidden mechanics; over-hot opening economy.
- **Recommended treatment:** Add stock runway and supplier quote previews: current quantity, expected demand range, days/runway, supplier, price, delivery risk, and after-restock quantity.
- **Suggested tests:**
  - Restock preview includes supplier id/label, total cost, quantity added, and missed-delivery probability/risk band.
  - Stock shortage card includes day type and demand multiplier/factor.

## Proposed architecture

### 1. Opening ledger / inherited-state briefing

Add a first-week/opening ledger model that is generated from registries and initial state. It should list inherited weaknesses neutrally:

- “Kitchen starts grimy: cleanliness 40; cleaning improves food-safety risk.”
- “Privy starts foul: smell 70; inspection-sensitive area.”
- “Staff trust is unproven: average loyalty around 50.”
- “Some suppliers are cheap but unreliable.”
- “Ogre/merchant cultures have built-in friction.”
- “Ale stock runway: X expected busy-night servings.”

This ledger should be available before the first service and should mark weaknesses as `observed` once presented. It should not create blame memories.

### 2. Agency/provenance metadata

Introduce shared metadata for causes, memories, and issue eligibility:

```ts
type CauseOrigin = 'inherited' | 'calendar' | 'sim_drift' | 'player_action' | 'memory' | 'market'
type AgencyState = 'undiscovered' | 'observed' | 'warned' | 'deferred' | 'ignored' | 'caused'
```

Pressure causes can carry optional fields:

```ts
origin?: CauseOrigin
agencyState?: AgencyState
playerFacingWeight?: number
accusatoryCopyAllowed?: boolean
```

Issue generators can then filter:

- **Briefing-safe:** inherited/observed causes only; can show as opening ledger or dashboard.
- **Warning-safe:** observed + threshold crossed; non-accusatory card allowed.
- **Accusatory:** ignored/caused memory or repeated warning; stronger crisis copy allowed.

### 3. Unified issue surfacing gate

Add a helper near issue generation:

```ts
canSurfaceIssue(ctx, {
  pressureId,
  family,
  minimumPressure,
  allowInheritedAsBriefing,
  requiresAgencyForAccusatory,
  openingGraceDays,
})
```

The helper should consider:

- `calendar.totalDaysElapsed`.
- whether opening ledger has presented the relevant system.
- whether response actions were available when the warning was shown.
- whether the player created/ignored/deferred relevant memories.
- whether the issue is a harmless briefing/opportunity versus a failure/crisis.

### 4. Tone policy for generated text

Create a tone classifier, likely in card composition or issue seed helpers:

- `opening_inherited`: neutral, explanatory, no blame words.
- `first_warning`: urgent but not accusatory.
- `deferred`: “you left it for later,” not “ignored.”
- `ignored_repeat`: stronger blame language allowed.
- `player_caused`: direct consequence language allowed.

Add forbidden-word tests for inherited/opening tone: `ignored`, `again`, `all week`, `unpaid`, `neglected`, `failed`, `slighted`, `underappreciated`, `may quit`, `may walk`, `collapse`, unless backed by a matching agency tag.

### 5. Mechanical preview model

For owner actions and card choices, add structured previews instead of prose-only previews.

Owner action definition should gain something like:

```ts
preview(ctx, input): OwnerActionPreview
```

where preview contains:

- time cost;
- coin cost;
- immediate before/after deltas;
- pressure impacts;
- risk bands and future hooks;
- supplier/source details for stock actions;
- unmet requirements.

Card choices already have `EffectPreview`; expose raw effect metadata to the web card model and render numeric chips next to the existing voiced preview lines.

## Implementation phases

### Phase 1 — Audit tests and baseline snapshots

1. Add tests that create a fresh tavern state, run pressure calculation, and snapshot baseline pressure causes.
2. Add tests that run issue seed generation on day 0 and assert no accusatory failure cards appear from inherited-only causes.
3. Add card text tests for forbidden opening blame words.
4. Add stock runway tests for first normal day and first high-demand day.

No tuning yet; this phase locks current behaviour and expected failures.

### Phase 2 — Opening ledger and cause provenance

1. Implement cause provenance fields and default them in pressure calculators.
2. Mark registry-derived day-zero signals as `origin: inherited`.
3. Generate an opening ledger from staff/stock/area/supplier/faction/culture state.
4. Persist ledger presentation/observation state in the tavern state or a module slice.
5. Update dashboards to show inherited causes neutrally.

### Phase 3 — Agency gates for issue generation

1. Add `canSurfaceIssue` helper.
2. Apply gates to staff loyalty, supplier relationship, faction request, culture conflict, stock shortage, food safety, pest/inspection, and maintenance.
3. Replace direct first-ignore memories with staged `warning_declined` / `deferred` / `ignored_warning` progression.
4. Ensure known player actions promote agency state to `caused` where appropriate.

### Phase 4 — Tone and wording pass

1. Add tone hints based on cause agency state.
2. Reword pressure causes:
   - “Staff loyalty low” → “Staff trust is unproven” for inherited baseline.
   - “Suppliers feel underappreciated” → “Supplier accounts are not yet warm.”
   - “Factions feel slighted” → “Factions are wary of the tavern.”
   - “Observance ignored” → “Observance is active today” until warned/ignored.
3. Add opening-safe card snippets and keep accusatory snippets gated.
4. Add tests for tone classifier and rendered card text.

### Phase 5 — Mechanical legibility previews

1. Add owner-action dry-run previews and refactor apply calculations into shared pure helpers.
2. Add numeric preview rows to `ActionPicker`.
3. Carry raw `EffectPreview` metadata into web card choices.
4. Add numeric mechanics chips/expanded detail to `CardRenderer`.
5. Add supplier quote and stock runway previews.

### Phase 6 — Retuning pass after gates

Only after gates and previews are in place:

1. Re-evaluate starting ale/coin/demand/wage runway.
2. Retune staff/supplier/faction/culture thresholds if inherited dashboards still look too hot.
3. Adjust first-week calendar/demand if tests show unavoidable crises.
4. Keep messy baselines; avoid flattening the tavern into a safe/default state.

## Test plan

### Unit tests

- `createInitialTavernState` produces expected starting values and ledger classifications.
- Every pressure calculator tags baseline causes with provenance.
- `canSurfaceIssue` returns:
  - false for inherited-only accusatory issues on day 0;
  - true for opening ledger/briefing surfacing;
  - true for warning after observation;
  - true for accusatory crisis only after ignored/player-caused memories.
- Owner action preview matches apply result for representative targets.
- Card choice raw effects include numeric values and immediate/delayed classification.

### Integration tests

- Fresh-game first morning:
  - opening ledger is populated;
  - no staff-quit/faction-demand/supplier-walk/inspection-blame card appears solely from baseline;
  - stock runway is shown before service.
- First warning then ignore:
  - first ignore creates deferred/non-accusatory memory;
  - repeated ignore creates ignored-warning memory;
  - only repeated ignore unlocks blame copy.
- Cleaning/restocking/social actions:
  - previews show exact before/after values;
  - applying action matches preview;
  - pressure/issue generation reflects the response.

### UI/component tests

- `ActionPicker` renders numeric time/cost/delta rows for target-specific actions.
- `CardRenderer` renders exact mechanics chips for coin, stock, pressure, relationship, and delayed effects.
- Opening-safe cards avoid forbidden blame words.

### Scenario tests

- Day-zero dirty tavern scenario.
- High-demand opening stock scenario.
- Low-reliability supplier but no late-payment scenario.
- Known observance ignored after briefing scenario.
- Player-caused sanitation failure after serving risky stock scenario.

## Risks / compatibility notes

- **Save compatibility:** New optional cause/ledger fields must default safely for old saves. Older memories without agency tags should be treated as unknown or legacy, not automatically ignored/player-caused.
- **Pressure value stability:** If inherited causes remain in total pressure but no longer generate issues, dashboards may show high pressure with no card. The UI should explain “inherited pressure / no player-facing crisis yet.”
- **Content volume:** Tone gating requires enough opening-safe snippets. Without them, cards may fall back to generic text too often.
- **Test brittleness:** Text tests should assert high-risk forbidden words only in opening/inherited contexts, not globally.
- **Balance risk:** Retuning before gates could mask the real problem. Implement agency/tone/legibility first, then adjust numbers.
- **Player preference:** Some players dislike exact numbers. Use a compact mechanics row or preference-controlled expanded detail, but default should still expose costs and crucial deltas clearly enough to support fair decisions.

## Explicit non-goals

- Do not make the tavern clean, stocked, or socially harmonious at game start.
- Do not remove pressure systems or crisis cards.
- Do not prevent the player from suffering consequences after clear warnings or risky choices.
- Do not rewrite all card prose in one pass; add gates and opening-safe variants first.
- Do not hide inherited problems; move them to briefing/ledger/dashboard language instead of failure language.
- Do not replace voiced flavour with spreadsheets only; keep flavour but pair it with legible mechanics.
