# Goblin Tavern Gameplay Audit — Phase 2 Runtime Path Verification

**Report version:** 1.0  
**Audit framework phase:** Phase B — Runtime path verification  
**Snapshot date:** 2026-07-25  
**Status:** Complete — exit condition met with explicit blockers  
**Primary runtime:** [GitHub Pages deployment](https://cigthepig.github.io/Goblin-Tavern/)  
**Fixed root seed:** `phase2-runtime-fixed`  
**Difficulty:** Standard

## 1. Result

Phase 2 is complete for the supplied snapshot.

The shortest complete day can be played from Morning through Report in one uninterrupted browser session. The fixed-seed browser run reached all five Day beats and all three engine segments, and its visible result matched an equivalent headless full-day run. All five root routes and all Reports, Tavern, and World subviews were reached at least once.

Three verified runtime defects materially constrain the result:

| Finding | Severity | Priority | Runtime impact |
|---|---|---|---|
| P2-RT-001 — Save serialization throws on a Svelte proxy | **Critical** | **P0** | Autosave, snapshot creation, Continue, and every reload/resume checkpoint are unusable; browser reload returns to Start and loses the active run |
| P2-RT-002 — Duplicate glossary ID crashes glossary rendering | **Medium** | **P2** | Top-bar glossary, Help term links, and inline definition links do not open |
| P2-RT-003 — Duplicate Tavern Log tags crash populated Log view | **Medium** | **P2** | Reports → Log fails once Day 1 has generated history and invokes the global error boundary |

One additional reachability observation remains:

| Observation | Status | Runtime impact |
|---|---|---|
| P2-OBS-001 — Quick Day did not become naturally eligible in the sampled state space | **Requires design clarification / special setup** | Its button and emergent-stop branch could not be exercised through normal play in this phase |

Because P2-RT-001 prevents any valid continued start, the requested reload comparisons at Morning, Plan, Service, Closing, and Report are explicitly **Blocked** rather than silently counted as passes. All other mapped Phase B paths are labeled below as Reached, Blocked, Not yet tested, or Requires special setup.

## 2. Evidence identity and method

### Snapshot identity

| Item | Value |
|---|---|
| Uploaded archive | `Goblin-Tavern-main (8).zip` |
| Archive SHA-256 | `6a03761f79cf175a50fd27b9c6d65b4f8e5a7530695983a84f2f26b05b923324` |
| Package / simulation version | `goblin-tavern@0.1.0` / `0.1.0` |
| Save schema | version `1` |
| Tavern identity | `the_crooked_keg` |
| Local source root | `audit_workspace/source/Goblin-Tavern-main` |

### Deployed-build fingerprint

The public deployment's HTML referenced the same content-hashed primary asset names as the supplied archive's production build:

| Asset | Local size | Local SHA-256 |
|---|---:|---|
| `assets/index-BRpqbRws.js` | 1,702,230 bytes | `b6ecb6c4f26d698e0edac079ac4de61d88a59b09b492a7ab5400bcbc0e8f4524` |
| `assets/index-DjBoSuO8.css` | 154,632 bytes | `e97bf04fa6f15ab56df254ae868a8988d149286bbe33be7a84036603c2f98dcf` |

This is strong deployment-to-archive fingerprint evidence. It is not represented as a separately downloaded byte-for-byte hash of the remote files.

### Runtime protocol

1. Open the deployed app in a clean browser tab.
2. Expand Advanced start controls.
3. Select Standard difficulty.
4. enter root seed `phase2-runtime-fixed`.
5. Open the tavern and record the Morning state/debug bundle.
6. Traverse the root routes and subviews without advancing the day.
7. Choose:
   - `Opening: Acquire a liquor licence` → `Take up the licence and start the paperwork`;
   - `Mira the Resolute's path to mastery` → `Mark how far they've come`.
8. Use no owner actions and leave staff priorities at defaults.
9. Advance Plan → Service → Closing → Report.
10. Inspect report metric drilldowns, error recovery, and Day 2 Morning.
11. Reproduce the same day through local segmented and full-day engine entry points.

Browser DOM/accessibility snapshots, console errors, in-app diagnostics, the generated report, and deterministic local probes form the runtime evidence. Source was inspected only after a runtime failure was reproduced, to identify its cause.

## 3. Annotated fixed-seed Day trace

### Trace overview

| Player beat | Engine position | Route/state evidence | Action and result |
|---|---|---|---|
| Morning | Segment A complete | Day 1, week 1, month 1, year 1; Supplier Day; Mudwake; coin 100; staff 3; 6h | Two Morning cards surfaced; all primary routes and most subviews were inspected |
| Plan | Segment A complete | `beat: plan`; `serviceComplete: false`; `closingComplete: false`; coin 100 | Two pending choices retained; planner opened directly and from a pressure CTA; no owner actions queued |
| Service | Segment B complete | coin 600; Landlord 24; 6h | 87 patrons, +500 coin, two incidents; no `during_service` card surfaced |
| Closing | Segment B complete | Lamps-low closing surface | No Closing cards; End Day remained available |
| Report | Segment C complete | State calendar advanced to Day 2; report labeled Day 1 | Full Day 1 report rendered; metric cause drilldown opened |
| Next Morning | Next Segment A complete | Day 2; coin 600; ale 150; stew 58; ingredients 60; forecast about 44 | Yesterday digest plus three Morning cards rendered |

### Segment A / Morning evidence

Initial player-facing values:

| Field | Value |
|---|---:|
| Coin | 100 |
| Staff | 3 |
| Ale | 240 |
| Stew | 130 |
| Ingredients | 60 |
| Forecast | about 83 guests |
| Food Safety | 35 |
| Pests | 35 |
| Maintenance | 35 |

Morning cards:

| Seed ID | Family | Card |
|---|---|---|
| `opening_opening_venture_liquor_license_0` | `opening` | `Opening: Acquire a liquor licence` |
| `staff_arc_arc_staff_mastery_apprentice` | `staff_arc` | `Mira the Resolute's path to mastery: the apprentice finds their feet` |

The first-encounter explanation for Supplier Day rendered. Memory first-encounter guidance also rendered later in the session.

The Morning debug bundle recorded:

```text
seed: phase2-runtime-fixed
calendar: day 1 / week 1 / month 1 / year 1 / elapsed 0
dayType: supplier_day
season: mudwake
beat: morning
serviceComplete: false
closingComplete: false
coin: 100
pending: {}
picks: []
priorities: {}
errors: {}
persistence: {}
```

### Pause 1 / Plan evidence

Selected pending responses:

```text
opening_opening_venture_liquor_license_0
  slot: pursue
  verb: upgrade

staff_arc_arc_staff_mastery_apprentice
  slot: mark_milestone
  verb: promote
```

The Plan debug bundle retained both pending decisions, kept the same calendar coordinate and root seed, and showed no queued owner actions or priorities. Back returned from Plan to Morning without advancing Segment B. Done closed the action picker.

### Segment B / Service and Closing evidence

Service outcome:

| Measure | Result |
|---|---:|
| Patrons | 87 |
| Customer groups with traffic | 5 of 9 |
| Net coin | +500 |
| Incidents | 2 |
| Resulting coin | 600 |

Traffic:

| Group | Patrons |
|---|---:|
| Local Goblins | 31 |
| Merchants | 19 |
| Miners | 18 |
| Adventurers | 10 |
| Ogres | 9 |

The Service surface said the service ran quietly and had nothing requiring a response. The Closing surface showed no cards and offered End Day. This is coherent with the observed absence of `during_service` and `closing` seeds, even though two reportable incidents were recorded.

### Segment C / Report evidence

The Day 1 report rendered:

| Category | Result |
|---|---|
| Coin | 100 → 600 (+500) |
| Service | 87 patrons across 9 modeled groups; +500 coin; 26 coin in unpaid tabs; chair damage ×2 |
| Positive/negative context | Lifted by Local Goblins; dragged by chair damage |
| Responses | Pursued liquor licence opening; marked Mira's mastery milestone |
| Stock | Ale 240 → 150; stew 130 → 58; mushrooms 90 → 70 |
| Pressures | Food Safety 35 → 4; Staff Burnout 25 → 0; Pests 35 → 11; Maintenance 35 → 12 |
| Main Room | Mess 20 → 41; cleanliness 45 → 29; damage 15 → 24 |
| Other | Count 0 → 6 |

Clicking the Main Room mess metric opened a cause drilldown containing, among other contributors:

- Ogres traffic caused +6 Main Room damage;
- Adventurers traffic caused +3 Main Room damage;
- the relevant customer-group and area tags.

The cause tags were explanatory text, not entity-link controls.

### Day 2 Morning evidence

Next Day opened a new Morning and retained the prior day's canonical result in the uninterrupted session:

| Field | Value |
|---|---:|
| Calendar | Day 2 |
| Coin | 600 |
| Ale | 150 |
| Stew | 58 |
| Ingredients | 60 |
| Forecast | about 44 guests |
| Top pressures | Landlord 24; Staff Loyalty Risk 16; Inspection 14 |

The Yesterday digest showed Day 1 coin `100 → 600 (+500)`. Three Morning cards appeared:

- `Main Room: a tired-looking corner`;
- `Acquire a liquor licence: paperwork`;
- `Mira the Resolute's path to mastery: the apprentice finds their feet`.

## 4. Segmented versus full-day equivalence

The same initial Standard state, per-day seed `phase2-runtime-fixed-d0`, empty owner-action list, default priorities, and two response intents were run locally through:

1. `advanceDaySegment(A) → advanceDaySegment(B) → advanceDaySegment(C)`;
2. one `simulateDay(..., FULL_PIPELINE)` call.

### Exact local comparison

| Comparison | Result |
|---|---|
| Final TavernState deep equality | **Pass — true** |
| Full-day tagged diff deep equality | **Pass — true** |

### Browser-to-headless semantic comparison

| Observable | Browser | Headless | Result |
|---|---:|---:|---|
| Calendar after close | Day 2 / elapsed 1 | Day 2 / elapsed 1 | Match |
| Coin | 600 | 600 | Match |
| Patrons | 87 | 87 | Match |
| Service net coin | +500 | +500 | Match |
| Incidents | 2 | 2 | Match |
| Ale | 150 | 150 | Match |
| Stew | 58 | 58 | Match |
| Mushrooms | 70 | 70 | Match |
| Food Safety | 4 | 4 | Match |
| Staff Burnout | 0 | 0 | Match |
| Pests | 11 | 11 | Match |
| Maintenance | 12 | 12 | Match |
| Main Room mess | 41 | 41 | Match |
| Main Room cleanliness | 29 | 29 | Match |
| Main Room damage | 24 | 24 | Match |

The fixed-seed interactive path and canonical full-day helper are semantically aligned for this scenario. This does not offset the persistence failure: equivalence was established without reloading between segments.

## 5. Runtime reachability matrix

### Start and root routes

| Entry | Status | Runtime evidence |
|---|---|---|
| Fresh Start | **Reached** | Advanced controls, difficulty, seed entry, and Open the Tavern worked |
| Continued Start | **Blocked — P2-RT-001** | No usable save survived reload; Continue was absent |
| Day | **Reached** | All five beats reached |
| Reports | **Reached with populated-Log defect** | All five subviews opened; populated Log later crashed |
| Tavern | **Reached** | All five subviews opened |
| World | **Reached** | All six subviews opened |
| More | **Reached** | Settings, Saves, Help, Diagnostics, About opened |

### Reports subviews

| Subview | Status | Evidence |
|---|---|---|
| Today | **Reached** | Pre-day empty state rendered; populated daily report separately rendered on Day's Report beat |
| Pressures | **Reached** | Core, social, market, and arc pressure rows rendered |
| Weekly | **Reached** | Correct pre-Day-7 empty state rendered |
| Monthly | **Reached** | Correct pre-Day-28 empty state rendered |
| Log | **Reached, then failed when populated** | Empty Log and filters rendered; after Day 1, 17 history entries triggered P2-RT-003 |

### Tavern subviews

| Subview | Status | Evidence |
|---|---|---|
| Areas | **Reached** | 9 areas; Cellar detail sheet opened |
| Stock | **Reached** | 20 items and supply pipeline; Ale detail opened from a Day entity link |
| Recipes | **Reached** | 3 menu recipes and 14 available recipes |
| Staff | **Reached** | 3 staff |
| Projects | **Reached** | 0 active; 5 project starters and 7 policies |

Individual project, policy, recipe, staff-priority, restock, and expedition effects are **Not yet tested**; they belong to later behavior phases.

### World subviews

| Subview | Status | Evidence |
|---|---|---|
| Regulars | **Reached** | 12 regulars; Geraint Ledgerly detail opened |
| Suppliers | **Reached** | 9 suppliers |
| Factions | **Reached** | 9 factions; Town Watch detail opened |
| Cultures | **Reached** | 8 cultures |
| NPCs | **Reached** | 11 NPCs |
| Rumours | **Reached — empty** | Explicit `No rumours circulating` state |

The expandable Tavern identity section also rendered and showed the Day-0/open/grimy/goblin-flavored identity and `known for cheap goblin food`.

### More subviews and controls

| Entry | Status | Evidence |
|---|---|---|
| Settings | **Reached** | Preference surface rendered; mutations not exercised |
| Saves | **Reached with blocker** | Autosave row rendered; Snapshot now failed under P2-RT-001 |
| Help | **Reached** | Help content rendered; term link failed under P2-RT-002 |
| Diagnostics | **Reached** | Debug bundle rendered and copied |
| About | **Reached** | About content rendered |
| Import / export | **Not yet tested** | Same serialization path makes export suspect, but no runtime verdict is assigned |
| Destructive save/reset controls | **Not yet tested** | Not required for Phase B traversal |

## 6. Cross-screen and explanatory seam matrix

| Seam | Status | Evidence |
|---|---|---|
| Direct planner request | **Reached** | Top-bar time control and Day Plan opened ActionPicker |
| Pressure → metric drilldown | **Reached** | Food Safety opened its pressure detail |
| Pressure drilldown → planner | **Reached** | `Plan an action against this` routed to Day Plan and opened ActionPicker |
| Day entity link → Tavern detail | **Reached** | `ale 150` routed to Tavern → Stock and opened Ale detail |
| Area/detail sheets | **Reached** | Cellar, Town Watch, and Geraint Ledgerly sheets opened |
| Daily report metric → cause drilldown | **Reached** | Main Room mess showed named traffic causes |
| Global glossary | **Failed — P2-RT-002** | Top-bar `Open glossary` produced duplicate-key error and no sheet |
| Help/inline definition | **Failed — P2-RT-002** | `Owner time` term did not open; same glossary renderer failed |
| Local overlay close | **Reached** | Area/metric/detail sheets closed and returned to their prior route |
| Global error recovery → Go to Day | **Reached** | Recovered from populated Log crash to the Day 1 report with Day 2 canonical values intact |
| Global error recovery → Reload | **Blocked — P2-RT-001** | Reload would discard the run; not invoked as a valid recovery |

## 7. Reload and state-integrity matrix

The intended comparison key was `(tavern identity, calendar, beat, segment, pending responses, route/subroute)`.

| Checkpoint | Pre-reload state | Result | Status |
|---|---|---|---|
| Morning / Segment A | `the_crooked_keg`; Day 1; Morning; A | Reload returned to fresh Start; Continue absent | **Failed — P2-RT-001** |
| Morning after delayed autosave window | Same, after 500 ms–1 s | Reload still returned to Start | **Failed — P2-RT-001** |
| Plan / Segment A | Day 1; Plan; A; two pending choices | Deliberate reload not repeated after deterministic save failure | **Blocked — P2-RT-001** |
| Service / Segment B | Day 1; Service; B; coin 600 | Same blocker | **Blocked — P2-RT-001** |
| Closing / Segment B | Day 1; Closing; B | Same blocker | **Blocked — P2-RT-001** |
| Report / Segment C | state calendar Day 2; Report; C | Same blocker | **Blocked — P2-RT-001** |
| Named snapshot | Day 1 session | Snapshot was not created | **Failed — P2-RT-001** |
| Continued start | Expected saved route/beat | No Continue entry | **Blocked — P2-RT-001** |

No post-reload identifier/calendar comparison is possible because the active save is never written. The app creates a new in-memory initial state instead of hydrating the prior session.

## 8. Quick Day reachability

### Runtime result

| Check | Result |
|---|---|
| Fixed Day 1 | Not eligible; 2 visible seeds |
| Fixed Day 2 | Not eligible; 3 visible seeds |
| 5,000 fresh Standard root seeds | No zero-seed Morning found |
| Recheck of 100 fresh Standard roots | Minimum 2 visible seeds; no eligible Morning |
| 10 roots × 20 sequential no-action days | 200 days completed without simulation failure; minimum 2 visible seeds; no eligible Morning |
| Quick Day button | Not reached |
| No-emergence completion path | Requires special setup |
| Emergent Service/Closing stop | Requires special setup |
| Post-Quick-Day reload | Blocked by P2-RT-001 |

The implemented guard is `Morning && todaysSeeds.length === 0`. Its handler runs Segment B, stops on the Service beat if `during_service` or `closing` seeds emerge, and otherwise runs Segment C and opens Report. That control flow is source-confirmed, not runtime-verified here.

The sampled result does not prove mathematical unreachability across every possible long-run state. It does show that the Phase B path is not naturally available in a broad fresh-seed sample or 200 ordinary sequential days. A controlled save/fixture that produces zero visible seeds is needed to verify the player-facing button and emergent-stop behavior.

## 9. Verified findings

### P2-RT-001 — Save serialization throws on `pendingBySeedId`

**Status:** Confirmed runtime defect  
**Severity:** Critical  
**Priority:** P0 — Immediate blocker  
**Frequency:** Reproduced on every attempted autosave/reload and Snapshot-now path

**Normal route**

1. Start a Standard game.
2. Wait for autosave, or use More → Saves → Snapshot now.
3. Reload.

**Expected**

The save should capture the current route, subroute, beat, segment, calendar, pending choices, and canonical state. Reload should expose Continue and restore that checkpoint.

**Actual**

The browser console reports:

```text
DataCloneError: Failed to execute 'structuredClone' on 'Window':
#<Object> could not be cloned.
```

No named snapshot appears. Reload returns to Start and Continue is absent. More → Saves retains an `Autosave Day 0` presentation but no successful last-saved timestamp or resumable state.

**Confirmed cause**

`GameStore.serializeForSave()` calls:

```ts
pendingBySeedId: structuredClone(this.pendingBySeedId)
```

`pendingBySeedId` is a Svelte `$state` deep proxy. Chrome rejects it before `saveSession()` is called. Because the exception occurs before the typed save result exists, the normal `saveError` UI is not populated.

**Affected seams**

- autosave;
- hard reload and Continue;
- named snapshot creation;
- every required beat/segment reload check;
- Reload as global error recovery.

Export uses the same serializer and is at risk, but export was not separately exercised and is not counted as a verified failure.

**Recovery**

There is no in-app recovery for the active run. Avoiding reload preserves the in-memory session only.

**Priority rationale**

This is a deterministic broad-progress loss on the core loop and blocks all persistence-dependent audit routes. It should be corrected before later phases rely on cross-session state.

### P2-RT-002 — Duplicate `atmosphere` ID crashes glossary rendering

**Status:** Confirmed runtime defect  
**Severity:** Medium  
**Priority:** P2 — Planned near-term  
**Frequency:** Reproduced through the top bar and Help term entry

**Normal routes**

- Top bar → `Open glossary`;
- More → Help → `Owner time`;
- inline `Define …` controls.

**Expected**

The glossary sheet should open, optionally anchored to the selected term.

**Actual**

No glossary sheet renders. The console reports Svelte `each_key_duplicate`.

**Confirmed cause**

`GLOSSARY_TERMS` contains 127 terms and two `mechanic` entries with:

```text
id: atmosphere
```

`Glossary.svelte` renders the category list with:

```svelte
{#each filteredByCategory[category] as term (term.id)}
```

The duplicate key aborts the render.

**Affected seams**

Global glossary, Help term links, and inline definition chips all converge on the same component.

**Recovery**

The underlying screen remains usable after the failed open attempt.

### P2-RT-003 — Duplicate tags crash a populated Tavern Log

**Status:** Confirmed runtime defect  
**Severity:** Medium  
**Priority:** P2 — Planned near-term  
**Frequency:** Reproduced on the first populated fixed-seed Log

**Normal route**

1. Visit Reports → Log before play; empty view renders.
2. Complete Day 1.
3. Re-enter Reports with Log as the retained Reports subview.

**Expected**

The 17 history entries should render with category and tag filters.

**Actual**

The app invokes its global `Something went wrong` boundary with Svelte `each_key_duplicate`.

**Confirmed cause**

Two projected rows contain repeated tags:

```text
h-0-2 — Unpaid tabs caused friction (26 coin).
tags: service, scene, unpaid_tab_argument, service_scene,
      unpaid_tab_argument, local_goblins

h-0-1 — Customers noticed a problem in Main Room.
tags: service, scene, area_problem_noticed, service_scene,
      area_problem_noticed, main_room, sticky_floor, mess_buildup
```

`TavernLog.svelte` keys each tag button by the tag string:

```svelte
{#each row.tags as t (t)}
```

Row IDs, day-group IDs, actor-chip keys, and location-chip keys were unique in the same projection; the repeated per-row tags are the isolated trigger.

**Recovery**

`Go to Day` recovered to the existing Day 1 report without losing the Day 2 calendar or 600-coin state. The boundary's Reload control is not a valid recovery while P2-RT-001 remains.

### P2-OBS-001 — Quick Day needs a controlled eligibility fixture

**Status:** Requires design clarification / special setup  
**Severity:** Observation  
**Priority:** P4 — Monitor / clarify

The feature is implemented and wired, but no naturally eligible Morning appeared in the recorded samples. Phase 3 should not treat its source path or styling test as runtime evidence. Clarify whether zero visible seeds is intended to occur during ordinary play; if yes, preserve a deterministic fixture/seed that reaches it and separately covers both no-emergence and emergent-stop outcomes.

## 10. Explicitly unverified or deferred paths

| Path | Label | Reason |
|---|---|---|
| Mid-beat reload at Plan, Service, Closing, Report | **Blocked** | P2-RT-001 invalidates the checkpoint before reload |
| Import/export round trip | **Not yet tested** | Not required to establish route reachability; export shares a suspect serializer |
| Quick Day button and both outcomes | **Requires special setup** | No eligible natural state found |
| Weekly populated report | **Requires elapsed-time setup** | First content appears after Day 7 |
| Monthly populated report | **Requires elapsed-time setup** | First content appears after Day 28 |
| Populated Rumours | **Requires content setup** | Current fixed session showed the supported empty state |
| Project/policy/recipe/staff/expedition effects | **Not yet tested** | Individual behavior work belongs to Phase C and later routes |
| Global error boundary Reload recovery | **Blocked** | It would discard the session under P2-RT-001 |

## 11. Phase 3 handoff

Phase 3 can begin for uninterrupted-session behaviors. It should carry these constraints forward:

1. Treat persistence, Continue, snapshot, and reload-dependent claims as blocked until P2-RT-001 is corrected.
2. Avoid using the glossary as proof that terminology is recoverable until P2-RT-002 is corrected.
3. Use Day's direct Report for daily-result inspection; Reports → Log is not trustworthy with populated history until P2-RT-003 is corrected.
4. Use the fixed-seed scenario above as the first browser/headless comparison fixture.
5. Obtain or create an explicit zero-visible-seed fixture before assigning a runtime verdict to Quick Day.

The Phase B exit condition is met: every mapped player-facing entry relevant to this phase now has runtime evidence or an explicit `Blocked`, `Not yet tested`, or `Requires special setup/design clarification` label.
