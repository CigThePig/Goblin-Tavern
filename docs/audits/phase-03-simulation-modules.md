# Phase 3 — Simulation modules by canonical pipeline slice

Status: complete for the Phase 3 audit pass. This is a discovery artifact, not
an implementation pass. No confirmed defects were found during this slice; the
findings table records candidate guardrails and later-phase follow-ups only.

## Scope and commands used

Phase 3 audited producer modules in the order declared by the production
`FULL_PIPELINE`. The pass focused on whether module-owned state has defaults,
schemas, producers, consumers, declared ordering dependencies where they are
load-bearing, and long-run caps/pruning where the state can grow.

Commands run during this phase:

```bash
sed -n '1,240p' docs/audits/end-to-end-audit-foundation.md
sed -n '240,520p' docs/audits/end-to-end-audit-foundation.md
find docs/audits -maxdepth 1 -type f -print | sort
sed -n '1,220p' src/sim/canonicalPipeline.ts
find src/sim/modules -maxdepth 2 -type f | sort
python3 - <<'PY'
from pathlib import Path
import re
mods=['areas','stock','staff','customers','world','cultures','factions','suppliers','regulars','adventurers','expeditions','ownerActions','service','weekly','monthly','localArcs','tavernIdentity','memories','history','causes','attribution','pressures','feedback','issues','responses']
for m in mods:
    d=Path('src/sim/modules')/m
    print('\n##',m)
    for f in sorted(d.glob('*.ts')):
        txt=f.read_text()
        hits=[]
        for pat in ['export const .*Module','id:','dependsOn:','stateSchema:','createDefaultState','hooks:','validate','generateReports','max','slice','prune','age']:
            if re.search(pat,txt): hits.append(pat)
        if hits:
            print(f, ', '.join(hits))
PY
rg -n "export const .*Module|id: '|dependsOn:|stateSchema:|createDefault.*State|hooks:|generateReports|validate:" src/sim/modules/{areas,stock,staff,customers,world,cultures,factions,suppliers,regulars,adventurers,expeditions,ownerActions,service,weekly,monthly,localArcs,tavernIdentity,memories,history,causes,attribution,pressures,feedback,issues,responses}/*.ts
rg -n "HISTORY_LIMIT|MAX|slice\(|MAX_|prune|weeklyHistory|monthlyHistory" src/sim/modules/weekly src/sim/modules/monthly src/sim/modules/issues src/sim/modules/pressures src/sim/modules/feedback
python3 - <<'PY'
from pathlib import Path
import re
mods=['areas','stock','staff','customers','world','cultures','factions','suppliers','regulars','adventurers','expeditions','ownerActions','service','weekly','monthly','localArcs','tavernIdentity','memories','history','causes','attribution','pressures','feedback','issues','responses']
for m in mods:
    deps=set()
    for f in (Path('src/sim/modules')/m).glob('*.ts'):
        for line in f.read_text().splitlines():
            mm=re.search(r"from ['\"]\.\./([^/'\"]+)", line)
            if mm: deps.add(mm.group(1))
    print(f'{m:16s} imports sibling modules: {", ".join(sorted(deps)) or "-"}')
PY
npm test -- tests/sim/phase12.service.test.ts tests/sim/phase13.ownerActions.test.ts tests/sim/phase29.suppliersMarketGoods.test.ts tests/sim/phase54.regularCustomer.test.ts tests/sim/phase91.monthlyPersistence.test.ts tests/sim/phase186.segmentedEngine.test.ts tests/web/phase186.daySegments.test.ts
npm test -- tests/sim/phase91.monthlyPersistence.test.ts tests/reports/weeklyOverviewProjection.test.ts tests/reports/monthlyOverviewProjection.test.ts tests/reports/pressureRemedyMap.test.ts tests/web/phase190b.consumerWiring.test.ts
```

## Canonical module slice ledger

The runtime module order remains the Phase 1 source of truth: root-state owners
run first, then world identity, player/day systems, and the analysis/response
stack. This pass did not find a module present on disk but absent from the
canonical production pipeline.

| Order | Module | State surface | Producer/consumer status | Dependency and long-run notes |
|---:|---|---|---|---|
| 1 | `areas` | Root `state.areas`; optional passthrough module slot. | Produces day cleaning/condition drift and weekly gameplay-area yield; consumed by customers, service, tavern identity, reports, and validation. | No declared `dependsOn` needed for earlier root owner. Area state is bounded by the registry. |
| 2 | `stock` | Root `state.stock`; `modules.stock.ledger` and `modules.stock.shortages`. | Produces spoilage, sales/restock ledger entries, shortages, and weekly/end-day stock movement; consumed by customers, service, suppliers, expeditions, owner actions, weekly/monthly, cards/issues, and reports. | Shortage/ledger surfaces are reset or summarized by hooks; no unbounded candidate found in this slice. |
| 3 | `staff` | Root `state.staff`; `modules.staff.appliedPriorities`, rejected assignments, and service-quality modifiers. | Produces priority effects and service-quality modifiers; consumed by service, owner actions, staff UI, pressures, issue seeds, and reports. | Root staff roster is bounded by authored/default staff plus explicit management actions. |
| 4 | `customers` | Root `state.customerGroups`; `modules.customers.forecasts`, `turnouts`, and `lowSatisfactionStreak`. | Produces traffic forecasts, service turnouts, satisfaction, and streak counters; consumed by service, weekly/monthly, issue seeds, reports, and world/culture projections. | Declares `dependsOn: ['stock', 'areas']` because it reads stock and area state before/during service. |
| 5 | `world` | Root `state.world`; optional passthrough module slot. | Owns seeded cultures, factions, suppliers, regulars, adventurers, rumours, calendar tags, and world identity data; downstream consumers include most world modules, reports, UI, cards, and analysis. | Rumours have an explicit monthly pruning policy; root identity registries are bounded by content/default generation unless later systems add entries. |
| 6 | `cultures` | Root `state.world.cultures`; optional passthrough module slot. | Produces culture familiarity/comfort updates and culture memories; consumed by customers, tavern identity, reports, issue seeds, and pressure calculators. | Reads stock/customer groups/owner policies in later phases but has no same-phase producer ordering risk observed. |
| 7 | `factions` | Root `state.world.factions`; optional passthrough module slot. | Produces faction tensions, requests, influence shifts, and related causes/memories; consumed by reports, issue seeds, pressures, and weekly community effects. | Root faction map is bounded by the faction registry. |
| 8 | `suppliers` | Root `state.world.suppliers`; `modules.suppliers` active market conditions and daily delivery/price/missed-delivery records. | Produces market conditions, supplier reliability/price pressure movement, stock delivery/miss signals, and supplier reports; consumed by stock, owner actions, weekly, monthly, pressures, issue seeds, cards, and UI. | Supplier module state is daily/condition scoped; root suppliers are registry bounded. |
| 9 | `regulars` | Root `state.world.regulars`; `modules.regulars` daily candidates/created/visited/decayed ids. | Produces regular emergence, visits, relationships, and reports; consumed by weekly community, owner actions, reports, issue seeds, and UI. | Root regular roster can grow, but emergence/candidate logic and relationship decay are separately covered by regular tests; long-run roster balance belongs to Phase 9. |
| 10 | `adventurers` | Root `state.world.adventurers`; optional empty module slot. | Produces/maintains hireable adventurer availability and recovery; consumed by expeditions and reports/UI. | Module state is intentionally empty today; root roster is bounded by defaults plus expedition status changes. |
| 11 | `expeditions` | Root `state.expeditions`; optional passthrough module slot. | Produces offers, commissions, active/completed expedition records, stock hauls, and adventurer runner updates; consumed by owner actions, service scenes, reports, UI, and issue/cards. | Declares `dependsOn: ['stock', 'adventurers']` for stock haul writes and adventurer roster updates. Active/completed logs should remain a Phase 9 long-run watch item. |
| 12 | `ownerActions` | `modules.ownerActions` time budget, applied/rejected actions, projects, policies, and recent social actions. | Applies player inputs, project progress, policy toggles, social actions, staff management, and commission actions; consumed by service, weekly/monthly, tavern identity, issue seeds, responses, UI, and reports. | Declares `dependsOn: ['stock']`; cross-module action definitions import suppliers/expeditions/pressures but apply after earlier setup phases. |
| 13 | `service` | `modules.service.result`; root stock/customers/areas/staff/reputation/causes/history/memories. | Resolves daily sales, scenes, complaints, damage, revenue, renown, and service reports; consumed by weekly/monthly, attribution, issue seeds, reports, UI, and cards. | Declares `dependsOn: ['customers', 'staff', 'stock', 'areas']`; the comment documents same-phase ordering for customers and staff. |
| 14 | `weekly` | `modules.weekly` accumulators, weekly result/history, invoices, traffic/satisfaction signals, and community counters. | Produces week-close rollups, wages, maintenance, trends, supplier invoices, and community relationship effects; consumed by monthly, local arcs, issue seeds, reports, and UI. | Declares `dependsOn: ['stock', 'customers']`; `weeklyHistory` is capped to `MAX_WEEKLY_HISTORY`. |
| 15 | `monthly` | `modules.monthly` rent, landlord, inspection, rival, modifier, accumulator, result/history, and finalized flag. | Produces month-close economy, rent/inspection/rival/readiness effects, and monthly reports; consumed by local arcs, issue seeds, reports, and UI. | Declares `dependsOn: [weekly, 'stock']`; `monthlyHistory` is capped to `MAX_MONTHLY_HISTORY`. |
| 16 | `localArcs` | `modules.localArcs` active arcs/tags/market tags, cooldowns, recent effects, and monthly-calendar tags. | Produces local arc effects, issue-seed tags, market-condition tags, and arc reports; consumed by issue seeds, pressures, cards, and reports. | Declares dependency on monthly close. Active/recent/cooldown arrays are bounded by registry-style arc logic; long-run variety belongs to Phase 9. |
| 17 | `tavernIdentity` | Root `state.reputation.identity`; optional passthrough module slot. | Recomputes known-for, house-rules, and atmosphere tags from reputation, owner policies, areas, and cultures; consumed by reports/UI/card text. | No declared deps; runs at end day after upstream daily mutators in canonical order. Add a focused drift guard if future reordering touches this module. |
| 18 | `memories` | Root `state.memories`; `modules.memories.newToday`, `expiredToday`, and `lastPatternRunDay`. | Ages/prunes memories, records daily ids, runs weekly pattern detection; consumed by causes, attribution, pressures, feedback, issue seeds, reports, and cards. | Memory aging/pruning is explicit and tested adjacent to analysis stack behavior. |
| 19 | `history` | Root `state.history`; no module state schema. | Validates and monthly-prunes debug-grade history entries written by other modules; consumed by reports/debug/projections and attribution context. | Monthly pruning is explicit; absence of module-owned state is intentional. |
| 20 | `causes` | Root `state.causes`; `modules.causes.newTodayIds`, `expiredTodayIds`, and `lastSweepAbsoluteDay`. | Ages/prunes causes, records daily cause ids, and builds cause reports; consumed by attribution, pressures, issue seeds, reports, and cards. | Cause aging/pruning exists. |
| 21 | `attribution` | `modules.attribution.attributions`, generated ids, last-update day, and distrust rumour counters. | Produces higher-level blame/belief attribution from causes/history/memories/service/action context; consumed by reports, issue seeds, cards, and UI. | No declared dependencies, but it runs after causes/history/memories in canonical order. Candidate guardrail noted below. |
| 22 | `pressures` | Root `state.pressures`; `modules.pressures.snapshots`, rolling trend history, and last-calculated day. | Recomputes pressure snapshots and trend history from causes/memories/root systems; consumed by feedback, issue seeds, reports, UI, and cards. | Declares `dependsOn: ['causes', 'memories']`; rolling trend history is capped to seven values. |
| 23 | `feedback` | `modules.feedback.loops`, active loop ids, and last-calculated day. | Detects feedback loops from pressures/memories and emits history; consumed by reports, issue seeds/cards, and pressure/overview UI. | Declares `dependsOn: ['pressures', 'memories']`; loop ids are registry bounded. |
| 24 | `issueSeeds` | `modules.issueSeeds.seedsToday`, cooldowns, rejectedToday, totals, last-generated day, and recentPicks. | Generates/ranks segment-local seeds from root systems, pressures, memories, attribution, local arcs, weekly/monthly state, and contradiction guards; consumed by cards, responses, UI, and reports. | Declares same-phase dependencies on causes/memories/pressures/customers/weekly/monthly. Seed/report outputs are per-day/segment scoped; `recentPicks` is the long-run field to watch in Phase 4/9. |
| 25 | `responses` | `modules.responses.pending`, resolved/applied/rejected intents, counters, and schedules. | Applies player response intents to issue seeds, memory/state effects, and scheduled follow-ups; consumed by issue seed generation, reports/UI, persistence, and cards. | Declares `dependsOn: ['issueSeeds']`; start-day/applied slices are reset by module hooks. |

## Field-level producer/consumer summary by slice

### 1. Foundations: areas, stock, staff, customers

- **Root-state owners are wired into both defaults and pipeline.** Fresh state
  seeds `areas`, `stock`, `staff`, and customer groups before module slices are
  added; the canonical pipeline then runs these four modules first. The three
  module-owned slices that need durable shape (`stock`, `staff`, `customers`) all
  have schemas, and customers explicitly defaults the newer
  `lowSatisfactionStreak` map for old saves.
- **Producer/consumer chain is concrete.** Customers depend on stock and areas,
  and service later depends on customers, staff, stock, and areas, so the main
  daily sales/satisfaction path is dependency-declared where same-phase order is
  load-bearing.
- **Adjacent coverage is strong.** The focused command covering owner actions,
  service, suppliers, regulars, segmented engine parity, and web day segments
  passed for all selected fast-tier files that the runner executed.

### 2. World identity: world, cultures, factions, suppliers, regulars,
adventurers, expeditions, tavern identity

- **Most identity modules intentionally store state at the root.** World,
  cultures, factions, adventurers, expeditions, and tavern identity use optional
  passthrough module schemas or empty module schemas because their durable state
  is under `state.world`, `state.expeditions`, or `state.reputation.identity`.
  This is not currently an unwired-field defect.
- **Cross-module consumers exist.** Culture closing emits memories from stock,
  customer groups, calendar tags, and owner friction-relief policies; suppliers
  emit causes/pressure changes and maintain daily delivery/market-condition
  records; expeditions write back to stock and adventurers; tavern identity
  computes atmosphere from areas and cultures.
- **Long-run watch items are balance/content rather than wiring defects.** Root
  regulars, completed expeditions, and rumours can change over time, but each has
  either bounded content/default generation or a pruning/balance policy to inspect
  during Phase 9 rather than a Phase 3 confirmed defect.

### 3. Player/day systems: owner actions, service, weekly, monthly, local arcs

- **Player input to service to close-out is wired in canonical order.** Owner
  actions apply after setup and before service; service depends on its upstream
  producers; weekly depends on stock/customers; monthly depends on weekly/stock;
  local arcs depend on monthly.
- **Week/month histories are capped.** Weekly history is trimmed to
  `MAX_WEEKLY_HISTORY`; monthly history is trimmed to `MAX_MONTHLY_HISTORY`.
  These are the two largest durable summary arrays in this slice.
- **Local arcs are deliberately post-monthly.** Local arc effects read monthly
  close context, write active tags/effects/cooldowns, and provide issue-seed fuel.
  The Phase 3 pass did not find a missing producer/consumer link, but Phase 4
  should verify every emitted local-arc issue tag maps to card/template behavior.

### 4. Memory/analysis stack: memories, history, causes, attribution,
pressures, feedback, issue seeds, responses

- **Analysis stack ordering is explicit in pipeline and partly dependency-guarded.**
  The canonical order is memories → history → causes → attribution → pressures →
  feedback → issue seeds → responses. Pressures, feedback, issue seeds, and
  responses declare the dependencies that affect same-phase generated data.
- **Aging/pruning exists for the append-heavy root logs.** Memories and causes
  use end-day aging helpers; history has a monthly pruning policy; pressures keep
  a seven-point trend history; feedback loop ids are registry bounded.
- **Issue seeds and responses are the main later-phase seams.** Issue seeds read
  many roots and module slices, then cards/responses/UI consume `seedsToday`.
  Phase 4 should build the requested seed-family/subtype/timing-to-card matrix;
  Phase 6 should keep validating pending response persistence/import recovery.

## Dependency declaration audit notes

The audit compared declared `dependsOn` with sibling-module imports and hook
comments. No confirmed runtime ordering defect was found, because several reads
happen in later phases where upstream modules have already run by phase order.
The remaining guardrail question is whether some canonical-order-only consumers
should declare dependencies to make future reorder mistakes fail earlier:

- `tavernIdentity` reads areas, cultures, owner policies, and reputation during
  `endDay`, but has no `dependsOn` because canonical order currently places it
  after the relevant daily mutators.
- `attribution` reads action/service/cause/memory/history context but relies on
  canonical order rather than `dependsOn` declarations.
- `cultures`, `factions`, `suppliers`, and `localArcs` read broad root-world or
  module state in phase-separated hooks; no same-phase dependency miss was
  reproduced.

These are not defects without a demonstrated reorder failure. They are candidates
for a small future invariant test or a design decision about how exhaustive
`dependsOn` should be for cross-phase reads.

## Findings ledger for Phase 3

| ID | Status | Severity | Area | Summary | Evidence | Current tests | Next action |
|---|---|---|---|---|---|---|---|
| AUD-MOD-001 | candidate | low | Module dependency declarations | Some modules rely on canonical order for cross-module reads instead of declaring every root/module consumer as `dependsOn`. | `tavernIdentity` has an end-day hook and optional schema but no `dependsOn`; `attribution` has no declared deps; issue seeds/pressures/feedback/responses show the stricter dependency style. | Engine topo-sort tests cover duplicate/missing/cyclic declared dependencies; segmented parity tests cover current behavior but not future reorder drift for these consumers. | Decide whether `dependsOn` should mean same-phase ordering only or all cross-module reads. If the latter, add an invariant test before changing module declarations. |
| AUD-MOD-002 | candidate | medium | Issue seed/card seam | Phase 3 confirmed issue seeds are heavily wired to root/module state, but did not verify every generated family/subtype/timing reaches a non-fallback card path. | `issueSeeds` declares segment-local generation hooks and broad dependencies; card/template mapping is outside this phase. | Existing selected module and report tests passed; card matrix tests belong to Phase 4. | Phase 4 should produce the issue-seed family/subtype/timing matrix and separate intentional fallbacks from suspicious ones. |
| AUD-MOD-003 | candidate | low | Long-run world/content balance | Root regulars, completed expeditions, rumours, and issue-seed recent-pick history are wired, but their long-run growth/variety behavior needs data-wide simulation rather than module wiring inspection. | Regulars/expeditions/world/issueSeeds have producers and consumers; history/weekly/monthly/pressure histories show explicit caps in adjacent systems. | Regular, expedition, monthly, and segmented tests exercise adjacent behavior; long-run dashboards are Phase 9 scope. | Carry to Phase 9 for long-run probes and data-wide balance/content inspection. |

## Phase 3 exit criteria assessment

- **Module slice ledger with field-level producer/consumer status:** satisfied by
  the canonical ledger and slice summaries above.
- **Candidate unwired fields separated from deliberate future seams:** satisfied;
  optional/empty module schemas for root-state identity modules are classified as
  deliberate root-state ownership, not unwired defects.
- **Confirmed defects:** none in this phase.
