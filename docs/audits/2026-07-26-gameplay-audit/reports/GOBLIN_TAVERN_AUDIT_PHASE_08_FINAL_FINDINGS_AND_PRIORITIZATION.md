# Goblin Tavern Gameplay Audit

## Phase 8 — Final Findings and Prioritization

**Audit date:** 2026-07-26  
**Supplied snapshot:** `Goblin-Tavern-main (8).zip`  
**Public build:** <https://cigthepig.github.io/Goblin-Tavern/>  
**Framework:** `GAMEPLAY_AUDIT_FRAMEWORK.md`, Phase H  
**Inputs:** Phase 1 through Phase 7 audit reports and their reproducible fixtures

---

## 1. Final audit outcome

Phase 8 is complete.

The supplied Goblin Tavern snapshot contains a playable, materially interconnected tavern-management loop. A player can:

- start a deterministic game;
- progress through Morning, Plan, Service, Closing, Report, and Next Day;
- act on areas, stock, recipes, staff, policies, suppliers, projects, and social situations;
- complete weekly and monthly boundaries;
- produce distinct tavern outcomes through different strategies;
- follow many cards, causes, pressures, reports, and entity links across the interface.

The product is not yet trustworthy as a progress-safe or balance-ready experience.

The controlling reasons are:

1. a deterministic save failure loses the active run;
2. a responsible rent response can repeatedly produce invalid negative coin without paying rent;
3. core goods can be restocked for zero coin;
4. pressure state has competing authorities and stale report timing;
5. cards can cite the wrong actor or location and apply a response to the wrong target;
6. closed reports can mutate after the next day begins;
7. the report can recommend intentionally destructive choices;
8. delayed choices lack a complete player-facing lifecycle.

The audit confirms 29 defects:

| Severity | Count | Meaning in this audit |
|---|---:|---|
| **Critical** | 1 | Broad progress is deterministically lost on a core supported path |
| **High** | 9 | Core state, action, response, report, or decision truth is invalidated |
| **Medium** | 16 | A reachable connection, secondary route, feedback chain, or strategic choice is materially weakened |
| **Low** | 3 | Narrow, recoverable presentation or projection defects |
| **Total confirmed** | **29** | All have runtime and technical evidence |

Final priorities:

| Priority | Count | Scheduling interpretation |
|---|---:|---|
| **P0** | 1 | Fix before relying on any continued or cross-session run |
| **P1** | 10 | Fix before balance tuning, major content expansion, or trusting the main feedback loop |
| **P2** | 15 | Complete after core truth is restored, before the affected systems are considered finished |
| **P3** | 3 | Bounded backlog work |
| **P4 design/observation records** | 2 primary records | Decide intended behaviour before implementation |

No finding is marked `Resolved` or `Verified`. Phase 8 prioritized evidence; it did not implement product changes.

---

## 2. Final readiness assessment

| Readiness question | Verdict | Basis |
|---|---|---|
| Can a fresh player reach and complete a day? | **Yes** | Multiple normal browser routes completed all three simulation segments and five player-facing beats |
| Can uninterrupted play reach a week and month? | **Yes, with defects** | Weekly and monthly boundaries settled exactly once in controlled and live play |
| Is progress durable across reload? | **No** | `P2-RT-001` deterministically prevents a valid autosave/snapshot and returns reload to Start |
| Is canonical state always valid? | **No** | `P7-EXP-001` drove two natural strategy routes below the schema’s zero-coin minimum |
| Is the operational economy suitable for balance conclusions? | **No** | `P7-EXP-002` makes three ordinary procurement targets free |
| Do cards reliably explain and affect the stated problem? | **No** | `P5-PLAY-003` and `P5-PLAY-004` cross actor/location evidence and response targets |
| Is the closing report an immutable, authoritative record? | **No** | `P4-SEAM-002`, `P6-COMP-006`, `P7-EXP-003`, and `P7-EXP-004` alter, omit, mis-rank, or stale its evidence |
| Are strategic choices materially differentiated? | **Yes, provisionally** | Shared-seed routes produced four identities and a 4,479-coin spread, but invalid economy paths prevent a balance verdict |
| Is every major authored strategy normally reachable? | **No** | Expedition commissioning remains unreachable under `P3-BHV-002` |
| Is the experience ready for broad balance tuning? | **No** | Persistence, state, price, pressure, targeting, and report truth must be fixed first |

### Final product-level verdict

> Goblin Tavern has a strong playable foundation and genuine systemic agency, but its current build should be treated as an interconnected prototype rather than a progress-safe management game. Core state and evidence contracts must be made authoritative before additional balance or content work can be evaluated reliably.

---

## 3. Evidence basis

### 3.1 Phase outputs

| Phase | Primary output | Contribution to Phase 8 |
|---|---|---|
| **1 — Structural verification** | Repository/runtime/system map | Established current ownership, routes, seams, systems, tests, and unanswered scope questions |
| **2 — Runtime path verification** | Browser startup, full-day, deterministic-equivalence, persistence, glossary, and Log evidence | Confirmed the Critical/P0 persistence blocker and two crashing support surfaces |
| **3 — Individual behaviour** | Normal and invalid variants for actions, policies, staff, recipes, cards, and expeditions | Confirmed two unreachable/broken action routes, one identity projection defect, and one design question |
| **4 — Connection and seams** | 30 seam assessments, weekly/monthly and delayed-effect traces | Confirmed duplicate causes, mutable reports, pressure split-brain, cross-domain causes, and arc projection disagreement |
| **5 — Practical play** | Seven-day public run, 28-day cadence, eight strategy bots | Confirmed timing, report labels, systemic cause leakage, wrong response targeting, and false stock demand |
| **6 — Player comprehension** | Player-first seven-question route evaluation | Confirmed choice-language, delayed-lifecycle, cause-language, priority-feedback, owner-time, report-history, and vocabulary failures |
| **7 — Whole experience** | Public weekly-boundary route and shared-seed integrated strategies | Confirmed invalid rent payment, free procurement, harmful coaching, stale pressures, repetition, and lost planning target context |

### 3.2 Evidence standard reached

Every confirmed record has:

- a normal or explicitly controlled runtime route;
- an observed player-facing effect;
- a current expected-behaviour contract;
- a traced source owner or state-transfer seam;
- a reproducible seed/path where determinism matters;
- an impact statement;
- a correction direction;
- regression requirements.

Static-only observations were not promoted to confirmed player-impact findings.

### 3.3 Final route coverage

| Framework route | Final state | Controlling evidence |
|---|---|---|
| **R01 — Fresh Standard Day** | Passed; persistence arm fails | Phase 2/3/5; `P2-RT-001` |
| **R02 — Owner actions and budget** | Characterized with defects | Phase 3/5/7; `P3-BHV-001`, `P5-PLAY-001`, `P7-EXP-002` |
| **R03 — Staff priority** | Applies and persists in memory; feedback incomplete | Phase 3/5/6; `P6-COMP-004` |
| **R04 — Recipe, stock, Service** | Mechanically connected; demand/price defects | Phase 3/5/7; `P5-PLAY-005`, `P7-EXP-002` |
| **R05 — Card response** | Select/revise/apply works; truth/lifecycle defects | Phase 3–7; multiple P1 findings |
| **R06 — Expedition** | Blocked | `P3-BHV-002` |
| **R07 — Quick Day** | Conditional, not naturally reached | `P2-OBS-001` |
| **R08 — Full interactive day** | Completes; persistence and response defects | Phase 2–7 |
| **R09 — Report to next plan** | Route exists; context and report truth degrade | `P4-SEAM-001/002`, `P7-EXP-004/006` |
| **R10 — Week/month settlement** | Exact-once cadence passed; rent response broken | Phase 4/5/7; `P7-EXP-001` |
| **R11 — Reload every position** | Blocked | `P2-RT-001` |
| **R12 — Snapshot/export/import/recovery** | Blocked or unsafe | `P2-RT-001`; error recovery only preserves in-memory state |
| **R13 — Opening to transformation** | Passed uninterrupted; cost/lifecycle feedback weak | Phase 4–6; `P6-COMP-002/005` |
| **R14 — Staff mastery arc** | Passed uninterrupted; explanation/presentation defects remain | Phase 4–6 |
| **R15 — Cross-screen identity/recovery** | Characterized with defects | `P2-RT-002/003`, `P3-BHV-003`, `P5-PLAY-002`, `P6-COMP-003/006/007` |

---

## 4. Final implementation order

Priority labels remain attached to individual player impact. The order below additionally respects technical dependencies.

### 4.1 Immediate blocker — P0

#### 1. `P2-RT-001` — Save serialization throws on a Svelte proxy

**Why first:** It deterministically destroys broad progress and blocks reload, Continue, snapshot, import/export, error-reload, and all persistence regression arms. No long-horizon fix can be considered verified while the normal save boundary is unusable.

**Exit gate:** A valid session must survive autosave, hard reload, Continue, named snapshot, export/import, and every Day beat/segment without changing pending choices, baseline, report evidence, RNG continuity, or calendar timing.

### 4.2 Core-truth work — P1

| Order | Finding | Why it precedes or follows other work |
|---:|---|---|
| 2 | `P7-EXP-001` — Unaffordable rent response does not pay rent | Restore schema validity and establish one atomic spending/rent contract before any economy or month-boundary balance work |
| 3 | `P7-EXP-002` — Three ordinary restocks are free | Restore meaningful procurement cost before comparing strategy profitability, supplier value, shortages, recipes, or expeditions |
| 4 | `P4-SEAM-003` — Compact and rich pressure state diverge | Choose one canonical pressure authority before fixing report timing, card gates, delayed effects, or pressure-based planning |
| 5 | `P7-EXP-004` — Reports use pre-response pressure snapshots | Depends on the pressure authority decision; then reconcile Closing, Report, Yesterday, ribbon, cards, and current state |
| 6 | `P4-SEAM-002` — Yesterday’s missed opportunities use today’s state | Establish an immutable closed-day evidence boundary before historical report, coaching, save, and next-plan work |
| 7 | `P5-PLAY-003` — Issue evidence crosses actor/location boundaries | Fix the shared cause-query contract before individual card content or explanation wording is tuned; this is the lead for `P4-SEAM-004` |
| 8 | `P5-PLAY-004` — Fix Root affects the wrong room | After cause identity is trustworthy, bind the response target to that evidence and verify one end-to-end target |
| 9 | `P7-EXP-003` — Missed opportunities recommend destructive choices | After closed-day and response truth are stable, replace sign-insensitive recommendation ranking |
| 10 | `P6-COMP-002` — Delayed choices lack a visible lifecycle | Build the pending/applied/expired presentation on stable save, pressure, response, and report ownership |
| 11 | `P6-COMP-001` — Confirmations replace choice language with internal verbs | Preserve player-facing choice identity through the same pending/resolved/archive lifecycle introduced above |

These ten records are the P1 set. `P7-EXP-004` remains Medium severity but P1 priority because a false pressure report contaminates downstream gameplay evaluation.

### 4.3 Planned near-term — P2

| Finding | Why it follows the P0/P1 work |
|---|---|
| `P2-RT-002` — Glossary duplicate ID crash | Important comprehension route, but underlying gameplay remains usable; safe as an isolated quick fix at any time |
| `P2-RT-003` — Populated Tavern Log duplicate-tag crash | History is secondary to restoring save/report truth; verify against the immutable archive work |
| `P3-BHV-001` — Inline policy controls omit the target | Central planner is a working recovery path; repair after the common action payload is stable |
| `P3-BHV-002` — Expedition commissioning cannot open | Blocks a major alternate system but not the shortest day; verify after economy and persistence are trustworthy |
| `P4-SEAM-001` — Pressure changes are logged twice | Schedule with the P1 pressure-authority refactor even though its individual impact is Medium/P2 |
| `P4-SEAM-004` — Seasonal arc absorbs staff causes | Shares the P1 cause-query root; its own content-specific acceptance case remains P2 |
| `P5-PLAY-001` — After-service planning says today but queues tomorrow | The queued action still applies; clarify day ownership after save/action timing is stable |
| `P5-PLAY-002` — Satisfaction rows omit the customer group | Report remains inspectable through drilldown; fix after immutable report data is established |
| `P5-PLAY-005` — Stock shortage invents demand | Fix after price/stock/service truth is stable so the generator can use reliable demand signals |
| `P6-COMP-003` — Cause drilldown exposes machine metadata | Humanize only after duplicate, scope, and authority problems are fixed |
| `P6-COMP-004` — Staff priorities hide tradeoffs/results | Mechanical input works; add preview and attribution after Service/report contracts are stable |
| `P6-COMP-005` — Licence claims owner time without spending it | Opening route completes; decide the resource contract before changing UI or simulation |
| `P6-COMP-006` — Historical reports lose resolved choices | Shares the P1 immutable-report fix; preserve a separate acceptance test for the decision ledger |
| `P7-EXP-005` — Full-day card load and repetition are unbounded | Tune after card truth and strategy contracts are reliable; otherwise pacing work may mask defective content |
| `P7-EXP-006` — Planning handoff loses the target | Fix after common action targeting is stable; retain contextual target through report, suggestion, picker, queue, and result |

### 4.4 Backlog — P3

| Finding | Why it can follow |
|---|---|
| `P3-BHV-003` — Fired staff name is lost in the heading | Effect text still identifies the worker and the defect is limited to a destructive-action heading |
| `P4-SEAM-005` — New local arc projections disagree by one boundary | Narrow boundary presentation defect with no demonstrated loss of arc mechanics |
| `P6-COMP-007` — Internal vocabulary appears on default surfaces | Broad polish issue, but surrounding state remains usable; address after the underlying evidence is correct |

### 4.5 Clarify/monitor — P4

| Record | Required decision/evidence |
|---|---|
| `P2-OBS-001` — Quick Day not naturally eligible | Decide whether it is a meaningful player route; if retained, create a supported zero-card fixture and test emergent stops |
| `P3-DC-001` — Explicit Ignore and no response share wording | Decide whether deliberate refusal and inaction are semantically equivalent before changing state or copy |

---

## 5. Complete normalized finding register

All statuses below are `Confirmed`; all confidence levels are High. “Runtime evidence” means a player-facing normal route or a clearly disclosed deterministic controlled route plus static ownership tracing.

### 5.1 Phase 2 — Runtime path

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P2-RT-001` — Save serialization throws on proxy | Persistence or migration failure | Critical / P0 | Every autosave/reload and Snapshot-now attempt | Web store / persistence | CL-01 |
| `P2-RT-002` — Duplicate glossary ID crashes rendering | Functional failure | Medium / P2 | Both top-bar and Help entry routes | Glossary content / UI | CL-08 |
| `P2-RT-003` — Duplicate tags crash populated Log | Functional failure | Medium / P2 | First populated fixed-seed Log; empty Log passes | History projection / Tavern Log UI | CL-01, CL-08 |

Detailed technical and gameplay evidence: `GOBLIN_TAVERN_AUDIT_PHASE_02_RUNTIME_PATH_VERIFICATION.md`, Section 9.

### 5.2 Phase 3 — Individual behaviour

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P3-BHV-001` — Inline policy toggles never queue | Incorrect state transfer | Medium / P2 | 2/2 tested policies; shared path affects every row | Projects UI / action adapter | CL-06 |
| `P3-BHV-002` — Expedition commissioning unreachable | Unreachable behaviour | Medium / P2 | Both normal entry surfaces | Expedition applicability / Stock UI | CL-06 |
| `P3-BHV-003` — Fired staff loses name in heading | Surface-truth mismatch | Low / P3 | One natural removal; deterministic post-removal lookup | Daily Report action projection | CL-08 |

Detailed evidence: `GOBLIN_TAVERN_AUDIT_PHASE_03_INDIVIDUAL_GAMEPLAY_BEHAVIOUR.md`, Section 5.

### 5.3 Phase 4 — Connections and seams

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P4-SEAM-001` — Significant pressure changes logged twice | Causality or explanation gap | Medium / P2 | Fixed-seed action; duplicate cause and downstream contribution | Pressure module / engine cause ownership | CL-03 |
| `P4-SEAM-002` — Yesterday uses today’s missed opportunities | Incorrect state transfer | High / P1 | Day 3→4 and later Day 7→8 normal routes | Daily Report archive/projection | CL-01 |
| `P4-SEAM-003` — Deferred pressure splits compact/rich truth | Incorrect state ownership | High / P1 | Natural delayed project effect through Day 5 | Pressure and response lifecycle | CL-03 |
| `P4-SEAM-004` — Seasonal card absorbs staff-arc causes | Causality or explanation gap | Medium / P2 | Fixed-seed Mushroom Blight; all attached causes foreign | Issue cause selection | CL-04 |
| `P4-SEAM-005` — New local arc projections disagree | Timing or cadence mismatch | Low / P3 | Month boundary trace | Local arc/report projection | CL-07, CL-08 |

Detailed evidence: `GOBLIN_TAVERN_AUDIT_PHASE_04_CONNECTION_AND_SEAM_TESTING.md`, Section 5.

### 5.4 Phase 5 — Practical play

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P5-PLAY-001` — After-service “today” plan queues tomorrow | Timing or cadence mismatch | Medium / P2 | Natural after-Service planning route | Game store / action picker timing | CL-02, CL-06 |
| `P5-PLAY-002` — Satisfaction rows omit customer group | Surface-truth mismatch | Medium / P2 | Repeated same-value rows for different groups | Daily Report diff labeling | CL-08 |
| `P5-PLAY-003` — Issue evidence crosses actor/location | Causality or explanation gap | High / P1 | Every customer complaint on controlled Days 2–7 plus live staff/card cases | Issue cause-query contract | CL-04 |
| `P5-PLAY-004` — Fix Root changes a rotated room | Functional failure | High / P1 | One applied response plus five target/evidence comparisons | Complaint target/response profile | CL-04 |
| `P5-PLAY-005` — Shortage invents unused-item demand | Content-system mismatch | Medium / P2 | Natural off-menu Bog Truffle warning; no sales/use | Shortage generator / demand signals | CL-07 |

Detailed evidence: `GOBLIN_TAVERN_AUDIT_PHASE_05_PRACTICAL_PLAY_EVALUATION.md`, Section 6.

### 5.5 Phase 6 — Player comprehension

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P6-COMP-001` — Confirmations replace choice text with verbs | Player-comprehension failure | High / P1 | Five live choices; pending and report surfaces | Card pending/response report identity | CL-05 |
| `P6-COMP-002` — Delayed choices lack lifecycle feedback | Issue/card/response lifecycle failure | High / P1 | Natural area project plus deterministic delayed responses | Responses/projects / reports | CL-05 |
| `P6-COMP-003` — Cause drilldowns expose machine metadata | Causality or explanation gap | Medium / P2 | Multiple coin, actor, and location drilldowns | Cause projection / drilldown UI | CL-04, CL-08 |
| `P6-COMP-004` — Staff priorities hide effects/results | Player-comprehension failure | Medium / P2 | Natural sticky priority through Service | Priority UI / Service report | CL-08 |
| `P6-COMP-005` — Licence claims owner time but spends none | Surface-truth mismatch | Medium / P2 | Natural opening venture progression | Venture issue / owner-time contract | CL-02, CL-06 |
| `P6-COMP-006` — Historical reports lose resolved choices | Incorrect state transfer | Medium / P2 | Immediate report versus next-day revisit | Daily Report archive/projection | CL-01 |
| `P6-COMP-007` — Internal vocabulary leaks to player UI | Player-comprehension failure | Low / P3 | Multiple default cards and details | Card/context vocabulary | CL-08 |

Detailed evidence: `GOBLIN_TAVERN_AUDIT_PHASE_06_PLAYER_COMPREHENSION.md`, Section 6.

### 5.6 Phase 7 — Whole experience

| ID and title | Normalized category | Sev / Pri | Runtime evidence and frequency | Likely ownership | Cluster |
|---|---|---:|---|---|---|
| `P7-EXP-001` — Rent response overspends without paying | Functional failure | High / P1 | Six consecutive payment days; two strategy routes invalid | Responses / monthly economy | CL-02, CL-05 |
| `P7-EXP-002` — Three ordinary restocks are free | Functional failure | High / P1 | Public route, three items, six-order day | Supplier pricing / owner actions | CL-02 |
| `P7-EXP-003` — Coaching recommends destructive choices | Feedback failure | High / P1 | Live recommendation plus 29 blame selections in 28 days | Missed-opportunity scoring/report | CL-05 |
| `P7-EXP-004` — Report pressures precede responses | Timing or cadence mismatch | Medium / P1 | Live contradictions; 11–42 mismatches in each of six routes | Pressure lifecycle / Daily Report | CL-03 |
| `P7-EXP-005` — Full-day decision load/repetition unbounded | Gameplay friction | Medium / P2 | 157 cards and 891 buttons over 28 days | Issue triage / card UX | CL-07 |
| `P7-EXP-006` — Planner handoff loses problem target | Incorrect state transfer | Medium / P2 | Public 20-target picker plus traced payload loss | Suggestions / navigation store / picker | CL-04, CL-06 |

Detailed evidence: `GOBLIN_TAVERN_AUDIT_PHASE_07_WHOLE_EXPERIENCE_EVALUATION.md`, Section 7.

---

## 6. Causal clusters and deduplication

Finding counts are not effort estimates. Several IDs preserve independently observed player impacts while sharing one technical correction.

### CL-01 — Progress and retrospective continuity

**Lead records:** `P2-RT-001`, `P4-SEAM-002`  
**Linked records:** `P2-RT-003`, `P6-COMP-006`

The game cannot serialize its active session, and closed reports are partly rebuilt from current transient state. Together these prevent reports, choices, and long-horizon consequences from functioning as durable history.

Required architectural contract:

```text
live day state
    → serializable checkpoint
    → immutable closed-day evidence packet
    → current report / historical report / Yesterday
    → reload with identical identity and values
```

### CL-02 — Economy and resource contracts

**Lead records:** `P7-EXP-001`, `P7-EXP-002`  
**Linked records:** `P5-PLAY-001`, `P6-COMP-005`

Coin, owner time, calendar ownership, and monthly obligations do not yet share one transaction contract. A response can spend unaffordable coin; ordinary suppliers can charge zero; after-Service actions quietly belong to tomorrow; and a venture claims owner time without using the visible budget.

Required contract:

- quote;
- affordability/applicability;
- atomic reservation;
- apply exactly once;
- update owning state;
- report actual cost and timing;
- preserve validation invariants.

### CL-03 — Pressure authority and phase timing

**Lead record:** `P4-SEAM-003`  
**Linked records:** `P4-SEAM-001`, `P7-EXP-004`

Pressure has:

- compact canonical values;
- rich snapshots;
- calculated deltas;
- direct response mutations;
- delayed mutations;
- report snapshots;
- next-day projections.

Those representations are not synchronized at one stable boundary. The same workstream should define the authoritative value, one cause-logging owner, post-response reconciliation, and report timing.

### CL-04 — Cause identity and target transfer

**Lead record:** `P5-PLAY-003`  
**Linked records:** `P4-SEAM-004`, `P5-PLAY-004`, `P6-COMP-003`, `P7-EXP-006`

The full intended chain is:

```text
state event
  → cause tied to actor/location
  → issue seed tied to that cause
  → card evidence
  → response target
  → applied state path
  → report/drilldown
  → suggested follow-up target
```

Current failures occur at cause filtering, response target selection, display humanization, and planner navigation. These are connected acceptance stages, not interchangeable symptoms.

### CL-05 — Response identity, lifecycle, and coaching

**Lead records:** `P6-COMP-002`, `P7-EXP-003`  
**Linked records:** `P6-COMP-001`, `P7-EXP-001`, design record `P3-DC-001`

Response slots and profiles are mechanically rich, but the player-facing lifecycle loses:

- the exact selected choice label;
- whether selection is pending or applied;
- combined cost/applicability;
- scheduled consequence timing;
- completion attribution;
- net desirability in retrospective coaching;
- the distinction between deliberate Ignore and no response.

### CL-06 — Action reachability and planner handoff

**Lead records:** `P3-BHV-002`, `P7-EXP-006`  
**Linked records:** `P3-BHV-001`, `P5-PLAY-001`, `P6-COMP-005`

Action definitions, applicability helpers, contextual entry controls, generic picker types, and the game store do not always carry the same target, time, or day contract.

### CL-07 — Content triage and pacing

**Lead record:** `P7-EXP-005`  
**Linked records:** `P5-PLAY-005`, `P4-SEAM-005`

The system can produce valid hands, but full-day attention load, family repetition, demand relevance, and periodic/arc prominence are not governed as one player-experience budget.

### CL-08 — Presentation identity and terminology

**Lead records:** `P2-RT-002`, `P6-COMP-004`  
**Linked records:** `P2-RT-003`, `P3-BHV-003`, `P4-SEAM-005`, `P5-PLAY-002`, `P6-COMP-003`, `P6-COMP-007`

This cluster covers support/history surfaces that crash or expose incomplete identity, labels, raw IDs, or unexplained strategy controls. It should be addressed after the underlying state and cause data is correct.

### 6.1 Explicit deduplication decisions

| Records | Phase 8 disposition |
|---|---|
| `P4-SEAM-004` and `P5-PLAY-003` | Same broad any-tag cause-query root. `P5-PLAY-003` is the systemic lead; retain `P4-SEAM-004` as the seasonal-arc regression case. |
| `P4-SEAM-002` and `P6-COMP-006` | Same closed-report ownership boundary. Keep both acceptance claims: false new opportunities and missing old decisions. |
| `P4-SEAM-003` and `P7-EXP-004` | Same pressure-authority workstream but different moments: delayed start-day divergence versus same-day post-response stale reporting. |
| `P4-SEAM-001` and `P6-COMP-003` | Not duplicates. One duplicates canonical causes; the other exposes machine vocabulary even when a cause is otherwise correct. |
| `P5-PLAY-004` and `P7-EXP-006` | Not duplicates. One applies a response to the wrong room; the other loses a correct contextual target during planning navigation. |
| `P5-PLAY-005` and `P7-EXP-002` | Not duplicates. One invents demand; the other prices a real purchase at zero. Both distort procurement for different reasons. |
| `P7-EXP-003` and causal/report findings | Not a duplicate. It selects the wrong strategic recommendation even when all underlying effects are modeled accurately. |

No confirmed evidence ID is deleted. The cluster model prevents duplicated remediation and preserves all regression cases.

---

## 7. Remediation roadmap

No duration estimate is assigned. Each wave ends at an evidence gate, not merely at code completion.

### Wave 0 — Restore durable progress

**Finding:** `P2-RT-001`

Work:

- unwrap or serialize the pending-choice proxy safely;
- verify every field that must cross save boundaries;
- make save errors visible and recoverable;
- define route/beat/segment and transient-state persistence contracts;
- restore Continue, snapshot, export/import, and error reload.

Gate:

- R11 and R12 pass at Morning, Plan, Service, Closing, Report, and next Morning;
- pending choice, queued action, baseline, Service outcome, report archive, RNG, and calendar remain identical.

### Wave 1 — Restore canonical state and economy

**Findings:** `P7-EXP-001`, `P7-EXP-002`, `P4-SEAM-003`, `P7-EXP-004`, `P4-SEAM-001`

Work:

- define atomic response spending and rent ownership;
- make ordinary purchase prices positive;
- choose one pressure authority;
- reconcile direct/delayed response effects with calculated pressure;
- generate the report from post-response final truth;
- choose one pressure-cause logging owner.

Gate:

- `coin >= 0` throughout every supported route;
- rent payment applies once and updates rent state;
- all purchasable ordinary stock obeys the intended minimum price;
- compact pressure equals rich pressure at every stable beat;
- one significant pressure change creates one canonical cause;
- eight shared-seed 28-day strategies validate throughout.

### Wave 2 — Make causality and closed reports authoritative

**Findings:** `P4-SEAM-002`, `P6-COMP-006`, `P5-PLAY-003`, `P4-SEAM-004`, `P5-PLAY-004`, `P7-EXP-003`

Work:

- store one immutable closed-day evidence packet;
- scope causes by required actor/entity/location plus domain;
- derive response targets from trustworthy evidence;
- separate impact magnitude from player benefit;
- preserve missed opportunities and resolved choices across next day/reload.

Gate:

- one report is byte/field stable immediately, next day, several days later, and after reload;
- simultaneous causes for two staff, groups, and rooms never cross identities;
- Fix Root preview, cause, target, applied state, and report all name one room;
- blame/mock cannot become default positive coaching due only to magnitude.

### Wave 3 — Complete the decision lifecycle

**Findings:** `P6-COMP-001`, `P6-COMP-002`, `P6-COMP-003`, `P6-COMP-004`, `P5-PLAY-002`

Work:

- preserve player-facing choice labels;
- explicitly show selected, revisable, applied, pending, due, completed, expired, or superseded;
- link delayed results to their original choice;
- humanize cause sources/actors/locations;
- preview and attribute staff priorities;
- include entity identity in report rows.

Gate:

- the seven Phase F comprehension questions can be answered from the interface for one immediate response, one delayed response, one project, one priority, and one report-to-plan path;
- the same explanation survives reload and historical revisit.

### Wave 4 — Restore action reachability and contextual transfer

**Findings:** `P3-BHV-001`, `P3-BHV-002`, `P5-PLAY-001`, `P6-COMP-005`, `P7-EXP-006`

Work:

- normalize contextual and central action payloads;
- separate form-open eligibility from fully specified expedition validation;
- identify whether queued work belongs to today or tomorrow;
- choose and enforce the venture owner-time contract;
- retain preferred target/reason through planner navigation.

Gate:

- R02 and R06 pass through every normal entry;
- one contextual target remains consistent through CTA, picker, quote, queue, Segment B, report, and reload;
- after-Service work is either disallowed or explicitly labeled/reserved for tomorrow;
- expedition commission, progress, outcome, runner state, stock, cost, and report complete naturally.

### Wave 5 — Repair secondary surfaces and identity

**Findings:** `P2-RT-002`, `P2-RT-003`, `P3-BHV-003`, `P4-SEAM-005`, `P6-COMP-007`

Work:

- make keyed lists unique or deduplicate projected tags;
- preserve immutable target display labels on removal actions;
- align local-arc age and active projections;
- centralize player vocabulary;
- keep raw identifiers behind an explicit diagnostics preference.

Gate:

- R15 crosses every relevant root/detail/support surface without error;
- entity names and historical labels survive removal, close, next day, and reload.

### Wave 6 — Tune issue relevance and attention load

**Findings:** `P5-PLAY-005`, `P7-EXP-005`

Work:

- gate shortages on actual/imminent demand;
- add a full-day attention budget across Morning and Service;
- add family-level continuity/cooldown/material-change rules;
- distinguish urgent decisions, persistent threads, and optional reminders;
- preserve weekly/monthly/teleology space without expanding total burden.

Gate:

- no off-menu unused item claims recent demand;
- long-run card and rendered-choice ceilings meet an approved design target;
- recurring issues preserve state and escalation without appearing as context-free fresh incidents;
- urgent Service incidents remain reachable.

### Wave 7 — Re-evaluate balance and whole experience

Only after Waves 0–6:

- rerun eight shared-seed strategies;
- add Easy and Hard;
- compare action, no-action, response, and partial-response variants;
- verify dominant customer groups and identity axes;
- compare cash, patrons, satisfaction, staff, areas, stock, pressures, and delayed obligations;
- re-run a human public/preview route through at least Day 29;
- reassess every Phase 7 design question.

The current strategy matrix proves differentiation, not balance.

---

## 8. Regression and verification matrix

### 8.1 Required route coverage by cluster

| Cluster | Mandatory normal routes | Boundary/reload variants | Key automated assertions |
|---|---|---|---|
| CL-01 Progress/history | R01, R08, R09, R11, R12, R15 | Every beat; next day; several days; error recovery | Serializable state; immutable closed report; exact pending/choice/history identity |
| CL-02 Economy/resources | R02, R04, R05, R08, R10, R13 | Aggregate spends; Day 28; insufficient coin; after Service | Non-negative coin; atomic cost; rent state; positive price; owner-time agreement |
| CL-03 Pressure authority | R05, R08, R09, R10 | Immediate, delayed, ambient, month boundary, reload | Compact = snapshot; one cause; post-response report = final state |
| CL-04 Cause/target | R05, R08, R09, R15 | Multiple actors/rooms at once; stale target | Cause actor/location = card = response = applied path = report = planner target |
| CL-05 Response lifecycle | R05, R08, R09, R11 | Revision, Ignore/no answer, delayed apply, expiry, reload | Choice label/status; aggregate applicability; due/completed attribution; signed coaching utility |
| CL-06 Action reachability | R02, R06, R09, R13 | Full budget; busy/injured runner; tomorrow queue; stale target | Entry payload parity; form eligibility; target retention; time ownership |
| CL-07 Content/pacing | R04, R05, R07, R08, R10, R13, R14 | 28+ days; weekly/monthly crowded hands | Demand truth; full-day hand/button budget; family continuity; periodic reserve |
| CL-08 Presentation | R03, R08, R15 | Removed entities; duplicated tags; debug mode; reload | Unique keys; human labels; priority preview/result; no raw default IDs |

### 8.2 State invariants

The post-fix suite should assert at every stable segment:

```text
coin >= 0
calendar advances exactly once
owner time spent <= daily budget
compact pressure value == rich snapshot value
one significant state cause == one canonical cause record
resolved response applies at most once
pending delayed entry applies or expires exactly once
closed report remains immutable
all target IDs resolve or retain an immutable display fallback
all saved state is serializable and schema-valid
```

### 8.3 Existing gates to retain

Phase 8 re-ran the current release gates:

```text
npm run check      Pass — 0 errors and 0 warnings
npm run typecheck  Pass
npm run build      Pass — 884 modules transformed
```

The build retained the already-recorded large-chunk advisory; no
performance-affecting-play claim was established from that advisory.

The final Phase 7 targeted suite also passed 11 files and 103 tests on the same
supplied source.

Retain the targeted suites for:

- segmented response pipeline;
- supplier pricing/delivery;
- restock quoting/application;
- missed-opportunity roundtrip and projection;
- Daily Report projection;
- card mechanical previews;
- Action Picker;
- Day screen;
- report-to-action suggestions;
- report actions.

Passing existing tests is necessary but not sufficient. New assertions must cover the cross-system combinations that produced the audit findings.

### 8.4 Verification status rule

A finding may move:

```text
Confirmed → Resolved
```

when an intended correction exists.

It may move:

```text
Resolved → Verified
```

only when:

1. the original reproduction no longer fails;
2. its normal player route passes;
3. linked cluster seams pass;
4. relevant boundary/reload variants pass;
5. automated regression coverage is added;
6. no linked report/card/preview becomes less truthful;
7. deterministic comparison remains reproducible.

---

## 9. Design clarification register

These decisions must not be silently converted into defect fixes.

### DC-01 — Quick Day’s intended role

**Source:** `P2-OBS-001`

No naturally eligible Morning appeared across 5,000 fresh seeds or 200 ordinary sequential days in Phase 2, nor in later live/28-day routes.

Decide whether Quick Day is:

- an intentionally rare recovery/quiet-day control;
- expected to become common later;
- a debug/legacy surface;
- unnecessary in the current product.

### DC-02 — Deliberate Ignore versus no response

**Source:** `P3-DC-001`

Decide whether they:

- are mechanically and narratively equivalent;
- should record different intent;
- should receive different missed-opportunity copy;
- should trigger a warning before Closing.

### DC-03 — Long-term player objective

Current design documentation says there is no win condition. Decide what organizes indefinite play:

- survival;
- tavern identity;
- relationships;
- cash;
- reputation;
- transformations/arcs;
- self-authored goals.

This decision governs coaching, reports, balance, and desirability scoring.

### DC-04 — Failure and recovery contract

The no-action route remained solvent while major pressures reached 100. Decide whether and how:

- bankruptcy;
- eviction;
- staff departure;
- customer collapse;
- forced closure;
- recovery/credit

should occur and be communicated.

### DC-05 — Strategic audience differentiation

All eight shared-seed strategies retained `local_goblins` as the dominant customer group. Decide whether audience leadership should change within the first month, only later, or not at all.

### DC-06 — Intended reactive workload

Approve a measurable target for:

- total cards per full day;
- total rendered choices;
- urgent versus optional incidents;
- family recurrence;
- persistent thread presentation;
- periodic/teleology reserve.

### DC-07 — Response-portfolio resource policy

Decide whether multiple selected responses:

- reserve combined resources at selection;
- resolve by explicit priority;
- reject individually;
- allow modeled debt;
- are limited by count/category.

### DC-08 — Long-horizon system parity

Decide which of the following are intended as core first-month strategies:

- policies;
- recipes;
- projects;
- ventures;
- rent/debt;
- expeditions;
- staff arcs;
- local/seasonal arcs.

Their prominence, preview, persistence, and report treatment should follow that decision.

### DC-09 — Progressive onboarding versus complete-surface exposure

Phase 1 found progressive onboarding plans but a current complete-surface implementation. Decide the intended 0.1.0 onboarding scope before hiding or delaying current systems.

### DC-10 — Supported environments and persistence promise

Define:

- supported browsers/devices;
- storage/quota expectations;
- save compatibility versions;
- Node 20 versus Node 24 development/CI parity;
- which transient route/report state must survive reload.

---

## 10. Phase 1 unknowns and non-findings

Phase 8 reviewed the structural advisories rather than promoting them automatically.

| Phase 1 record | Final disposition |
|---|---|
| `P1-U01` — Which routes are reachable? | Largely resolved by Phases 2–7; remaining blocks are explicit findings or design records |
| `P1-U02` — Reload continuity without transient fields | Blocked and superseded operationally by `P2-RT-001`; exact field contract remains in DC-10 |
| `P1-U03` — Segmented UI versus full-day helper | Passed deterministic semantic-equivalence comparison in Phase 2 for the exercised route |
| `P1-U04` — No supplied deployment | Resolved when the public GitHub Pages URL was supplied |
| `P1-U05` — No local shell browser | Resolved through the supported cloud-browser audit route |
| `P1-U06` — Issue tracker freshness conflict | Documentation-maintenance question; no independent player defect established |
| `P1-U07` — `dayBaseline` comments versus serializer | Documentation/contract question folded into persistence verification |
| `P1-U08` — Empty event registries | Partly characterized; current local/seasonal arcs run, but complete intended content scope remains DC-08 |
| `P1-U09` — Long-play openings/arcs/transformations | Substantially exercised through a month; expedition remains blocked and post-fix long play remains required |
| `P1-U10` — Progressive onboarding absent | Retained as DC-09, not a defect without intended-release clarification |
| `P1-U11` — Node 24 local versus Node 20 CI | Environment/release-gate observation under DC-10; no runtime player impact demonstrated |
| `P1-U12` — Large production chunk advisory | Monitor only; no measured performance-affecting-play finding was established |

Additional non-findings:

- No universal dominant strategy was proven.
- No global win/loss absence was classified as a defect.
- No performance-affecting-play defect was established.
- No deterministic simulation-equivalence failure was found on the exercised segmented route.
- Weekly/monthly exact-once cadence worked before reload variants.
- The inability to complete an expedition was not bypassed with direct state editing.

---

## 11. Final acceptance package

### 11.1 Minimum core-trust gate

Before the build is treated as progress-safe:

- `P2-RT-001` must be Verified;
- no normal route may violate the state schema;
- rent and ordinary purchase contracts must be valid;
- pressure must have one canonical final value;
- a closed report must remain immutable through next day and reload.

### 11.2 Minimum feedback-trust gate

Before reports/cards are used to teach or evaluate play:

- causes must stay with the correct actor/location;
- response targets must match their evidence;
- missed-opportunity ranking must account for desirability;
- delayed choices must show pending and completion state;
- selected choice language must survive confirmation and archive;
- current and historical report values must agree with canonical state.

### 11.3 Minimum feature-complete gate

Before the current mapped feature set is called complete:

- expedition commissioning must complete naturally;
- policy contextual controls must work;
- planner timing and target handoff must be explicit;
- staff priorities must expose tradeoffs and feedback;
- glossary and Tavern Log must render;
- content demand and pacing must meet approved design targets.

### 11.4 Balance gate

Balance evaluation should begin only after:

1. all P0/P1 records are Verified;
2. related P2 records that share those roots are retested;
3. the eight-strategy matrix remains schema-valid;
4. the intended objective/failure/response-budget decisions are recorded;
5. normal human play confirms that the corrected evidence is understandable.

---

## 12. Deliverable index

Audit reports:

1. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_01_STRUCTURAL_VERIFICATION.md`
2. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_02_RUNTIME_PATH_VERIFICATION.md`
3. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_03_INDIVIDUAL_GAMEPLAY_BEHAVIOUR.md`
4. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_04_CONNECTION_AND_SEAM_TESTING.md`
5. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_05_PRACTICAL_PLAY_EVALUATION.md`
6. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_06_PLAYER_COMPREHENSION.md`
7. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_07_WHOLE_EXPERIENCE_EVALUATION.md`
8. `audit_workspace/evidence/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md`

Reproducible audit fixtures:

- `audit_workspace/phase2_runtime_probe.ts`
- `audit_workspace/phase2_quickday_probe.ts`
- `audit_workspace/fixtures/phase4-seam-trace.ts`
- `audit_workspace/fixtures/phase4-periodic-trace.ts`
- `audit_workspace/fixtures/phase5-practical-probes.ts`
- `audit_workspace/fixtures/phase7-whole-experience-probes.ts`

No product source was changed during Phase 8.

---

## 13. Phase H exit assessment

The Phase H exit condition is met:

- only runtime-confirmed player-impact records are in the final defect register;
- functional, integration, comprehension, feedback, content, friction, and design claims are separated;
- every confirmed record has final severity, priority, confidence, ownership, evidence source, and regression placement;
- shared causes and duplicate symptoms are explicitly linked;
- design ambiguity remains in a separate clarification register;
- priority ordering states why work precedes or follows other work;
- verification requires normal-route, affected-seam, boundary, reload, and automated regression evidence.

This document completes the planned audit. The next step is correction work beginning with `P2-RT-001`, not another audit phase.
