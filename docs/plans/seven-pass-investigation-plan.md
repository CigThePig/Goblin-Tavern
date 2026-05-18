# Seven-Pass Investigation Plan

This document is the working ledger for a multi-pass investigation into unwired
systems, UI issues, bugs, dead fields, incomplete feature loops, and regression
risk across Goblin Tavern. Each pass should leave durable notes here so later
passes can build from evidence instead of re-discovering the same gaps.

## How to use this file

1. Work one pass at a time, in order, unless a blocker requires jumping ahead.
2. For every finding, record the evidence path, reproduction path, severity,
   owner system, and recommended follow-up.
3. Promote actionable defects to `docs/ISSUE_TRACKER.md` only after the pass has
   enough evidence to scope a repair phase.
4. Keep speculation separate from confirmed defects. Use the finding status
   values below.
5. At the end of each pass, update the pass summary and the cross-pass backlog.

## Finding status values

- `candidate` — suspicious gap; needs one more source of evidence.
- `confirmed` — reproduced or proven by code path / test path.
- `tracked` — promoted to `docs/ISSUE_TRACKER.md` or a phase plan.
- `fixed` — resolved in a later change and verified.
- `wont-fix` — intentionally accepted; document why.

## Severity guide

- `critical` — blocks play, corrupts saves, or prevents core loop progression.
- `high` — major system is unwired, misleading, or routinely fails.
- `medium` — noticeable UX / balance / data issue with a workaround.
- `low` — polish, copy, minor edge case, or test coverage gap.

## Cross-pass backlog

| ID | Pass | Area | Severity | Status | Summary | Evidence | Next action |
|---|---:|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | candidate | Fill during investigation. | TBD | TBD |

---

## Phase 1 — Inventory, architecture map, and previous-plan reconciliation

**Goal:** Build a current map of implemented systems, planned systems, and stale
or contradictory documentation before judging whether something is unwired.

**Primary questions**

- Which domains exist in `src/sim`, `web/src/lib`, `tests`, and `docs/plans`?
- Which phase plans claim functionality that is not present or only partially
  present?
- Which issue-tracker entries are marked done but still have code-level gaps?
- Which modules export registries, state slices, actions, reports, or UI panels
  that should be connected elsewhere?

**Suggested checks**

- Catalogue source directories, registries, module indexes, screens, cards,
  panels, and test files.
- Compare phase plans and issue-tracker statuses with current code paths.
- Trace app boot, route definitions, save envelope, and route persistence.
- Identify duplicate concepts, stale names, superseded docs, and TODO-like
  comments that still imply missing implementation.

**Artifacts to fill**

| Area | Expected source of truth | Current implementation | Gap / risk | Evidence |
|---|---|---|---|---|
| Simulation modules | TBD | TBD | TBD | TBD |
| Web screens / routes | TBD | TBD | TBD | TBD |
| Registries / catalogs | TBD | TBD | TBD | TBD |
| Persistence / saves | TBD | TBD | TBD | TBD |
| Tests / diagnostics | TBD | TBD | TBD | TBD |
| Documentation claims | TBD | TBD | TBD | TBD |

**Exit criteria**

- A system map exists for all top-level sim and web domains.
- Any stale documentation that could mislead later passes is recorded.
- Later passes have a prioritized list of systems to trace deeply.

---

## Phase 2 — Core simulation loop and state integrity

**Goal:** Verify that the day / week / month progression, state mutation,
validation, migrations, RNG, and diff/report pipelines are wired end-to-end.

**Primary questions**

- Can every beat of the playable loop progress without hidden invalid state?
- Do state mutations consistently emit diffs, reports, attribution, and history?
- Are migrations and normalization paths compatible with current state shape?
- Are RNG streams deterministic where expected and isolated where needed?

**Suggested checks**

- Trace `createInitialTavernState`, engine phases, module registration,
  validation, and save/load hydration.
- Run or add focused diagnostics for state changes across multiple days,
  weekly boundaries, and monthly boundaries.
- Compare expected mutations with `createStateDiff`, significant diff handling,
  history logs, and reports.
- Look for dead fields, write-only fields, read-only fields, and derived values
  that never feed player-visible decisions.

**Artifacts to fill**

| System | Entry point | Mutation path | Player-visible output | Test coverage | Findings |
|---|---|---|---|---|---|
| Day loop | TBD | TBD | TBD | TBD | TBD |
| Service / closing | TBD | TBD | TBD | TBD | TBD |
| Weekly systems | TBD | TBD | TBD | TBD | TBD |
| Monthly systems | TBD | TBD | TBD | TBD | TBD |
| Save / migration | TBD | TBD | TBD | TBD | TBD |
| RNG / determinism | TBD | TBD | TBD | TBD | TBD |

**Exit criteria**

- Each progression boundary has a verified reproduction or test path.
- Any silent state mutation without output is recorded.
- Any output that claims a state change without a real mutation is recorded.

---

## Phase 3 — Action, card, issue-seed, and player-choice wiring

**Goal:** Confirm that every player-facing choice is selectable only when valid,
resolves to the intended simulation effect, and is represented accurately in
cards, pending queues, reports, and missed opportunities.

**Primary questions**

- Do action definitions, generated intents, card buttons, and `canApply` checks
  agree?
- Can every issue-seed family generate, rank, display, resolve, expire, and
  explain its outcome?
- Are pending actions and queues cleared, saved, restored, and reported
  correctly?
- Are disabled states, costs, requirements, and consequences visible before the
  player commits?

**Suggested checks**

- Trace action registry definitions to UI pickers and application handlers.
- Fuzz or enumerate issue-seed generation across tags, families, and calendar
  states.
- Confirm card registry coverage for all real card types and action slots.
- Inspect mismatch risks between verbs, target IDs, fallback matching, disabled
  buttons, and generic actions.

**Artifacts to fill**

| Choice surface | Source definition | UI renderer | Apply path | Failure mode checked | Findings |
|---|---|---|---|---|---|
| Day cards | TBD | TBD | TBD | TBD | TBD |
| Action picker | TBD | TBD | TBD | TBD | TBD |
| Quick actions | TBD | TBD | TBD | TBD | TBD |
| Staff priorities | TBD | TBD | TBD | TBD | TBD |
| Expeditions | TBD | TBD | TBD | TBD | TBD |
| Missed opportunities | TBD | TBD | TBD | TBD | TBD |

**Exit criteria**

- Every player choice has a traced source-to-effect path.
- Every disabled / invalid choice has a clear UI reason or a finding.
- Queue persistence and restoration are verified or logged as defective.

---

## Phase 4 — World, roster, economy, and content graph coverage

**Goal:** Verify that world entities, rosters, stock, recipes, suppliers,
factions, cultures, NPCs, regulars, rumours, expeditions, and economic systems
form a coherent graph with no orphaned or unusable content.

**Primary questions**

- Are all registry entries reachable from generation, state, UI, reports, or
  player actions?
- Do cross-references resolve in both directions where the design requires it?
- Do prices, wages, reliability, storage, quality, renown, reputation, and demand
  feed meaningful decisions?
- Are content pools deep enough to avoid repetitive or contradictory output?

**Suggested checks**

- Run reference validation and add temporary probes for orphaned IDs.
- Compare registry IDs with initial state, UI panels, detail sheets, and reports.
- Trace economy fields from source to consumption: cost, quality, stock,
  delivery, storage, wage, reward, renown, and relationship.
- Inspect descriptor pools, social memory, rumours, notable NPC links, and
  faction/culture relationships.

**Artifacts to fill**

| Content graph | Registry / state | Consumers | Reverse links | Economy impact | Findings |
|---|---|---|---|---|---|
| Staff | TBD | TBD | TBD | TBD | TBD |
| Areas | TBD | TBD | TBD | TBD | TBD |
| Stock / recipes | TBD | TBD | TBD | TBD | TBD |
| Suppliers | TBD | TBD | TBD | TBD | TBD |
| Factions / cultures | TBD | TBD | TBD | TBD | TBD |
| NPCs / regulars | TBD | TBD | TBD | TBD | TBD |
| Rumours / memory | TBD | TBD | TBD | TBD | TBD |
| Expeditions / adventurers | TBD | TBD | TBD | TBD | TBD |

**Exit criteria**

- Orphaned registry entries and dead fields are either disproven or listed.
- Economy inputs and outputs are traced across at least one full loop.
- Content repetition or contradiction risks have examples.

---

## Phase 5 — Web UI, accessibility, responsive layout, and interaction polish

**Goal:** Audit the Svelte UI for broken navigation, stale data, missing empty
states, inaccessible controls, mobile layout issues, and presentation bugs.

**Primary questions**

- Do all routes, tabs, sheets, panels, dialogs, and glossary affordances open,
  close, persist, and restore as expected?
- Does the UI accurately reflect current state after every mutation?
- Are controls keyboard-accessible, labelled, focus-safe, and usable with reduced
  motion and font scaling preferences?
- Are mobile, tablet, narrow, and desktop layouts free of clipping, overlap, and
  unreachable controls?

**Suggested checks**

- Manual pass through Start, Day, Reports, Tavern, World, More, sheets, and
  bottom navigation.
- Inspect Svelte event handlers, derived values, keyed loops, and stale closure
  risks.
- Run `npm run check`, `npm run build`, and browser smoke tests when possible.
- Capture screenshots for visible UI defects and note viewport dimensions.

**Artifacts to fill**

| UI surface | Interaction path | Expected behavior | Actual behavior | Accessibility notes | Findings |
|---|---|---|---|---|---|
| Start | TBD | TBD | TBD | TBD | TBD |
| Day | TBD | TBD | TBD | TBD | TBD |
| Reports | TBD | TBD | TBD | TBD | TBD |
| Tavern | TBD | TBD | TBD | TBD | TBD |
| World | TBD | TBD | TBD | TBD | TBD |
| More | TBD | TBD | TBD | TBD | TBD |
| Sheets / popovers | TBD | TBD | TBD | TBD | TBD |
| Navigation shell | TBD | TBD | TBD | TBD | TBD |

**Exit criteria**

- Every route and modal-like surface has been exercised.
- Any screenshot-worthy defect has a reproduction path and viewport note.
- Accessibility and preference regressions are either cleared or recorded.

---

## Phase 6 — Persistence, import/export, preferences, errors, and edge cases

**Goal:** Stress the non-happy paths that often expose bugs: corrupted saves,
old saves, import/export, local storage pressure, browser lifecycle events,
preference toggles, invalid inputs, and error banners.

**Primary questions**

- Are all persisted objects versioned, validated, sanitized, and backwards
  compatible where intended?
- Do corrupted or incompatible saves fail safely without losing recoverable data?
- Do settings immediately affect UI and survive reloads?
- Are error states actionable rather than silent or permanently sticky?

**Suggested checks**

- Exercise save slots, autosave, import/export, delete, replace, and snapshot
  budget limits.
- Mutate local storage manually to simulate invalid versions, missing fields,
  unknown routes, and oversized payloads.
- Verify lifecycle saves on visibility/pagehide and reload continuation.
- Toggle preferences through all combinations of difficulty, font scale, reduced
  motion, confirmation prompts, and seed-tag display.

**Artifacts to fill**

| Edge area | Scenario | Expected result | Actual result | Data loss risk | Findings |
|---|---|---|---|---|---|
| Autosave | TBD | TBD | TBD | TBD | TBD |
| Continue / reset | TBD | TBD | TBD | TBD | TBD |
| Save slots | TBD | TBD | TBD | TBD | TBD |
| Import / export | TBD | TBD | TBD | TBD | TBD |
| Preferences | TBD | TBD | TBD | TBD | TBD |
| Invalid data | TBD | TBD | TBD | TBD | TBD |
| Browser lifecycle | TBD | TBD | TBD | TBD | TBD |

**Exit criteria**

- At least one valid and one invalid persistence path is verified for each save
  surface.
- Data-loss and soft-lock risks are explicitly ranked.
- Error copy and recovery actions are reviewed.

---

## Phase 7 — Regression harness, prioritization, and repair roadmap

**Goal:** Consolidate findings into a repair roadmap with reproducible tests,
prioritized phases, and guardrails that prevent the same class of unwired system
from returning.

**Primary questions**

- Which findings should become issue-tracker entries, phase plans, tests, or
  immediate fixes?
- Which classes of defect need automated coverage: registry reachability,
  UI action validity, save compatibility, state-diff completeness, or route
  smoke tests?
- What order minimizes risk and unblocks the largest number of systems?
- Which lower-severity findings are polish backlog rather than repair blockers?

**Suggested checks**

- Group all findings by root cause, not just by visible symptom.
- Add or propose diagnostics for future dead-field / orphan-registry detection.
- Compare every proposed repair against tests that would have caught it.
- Draft phase boundaries with verification criteria before implementation work
  begins.

**Artifacts to fill**

| Roadmap item | Source findings | Proposed phase / issue | Test guardrail | Priority | Notes |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |

**Final investigation summary template**

- **Critical findings:** TBD
- **High findings:** TBD
- **Medium findings:** TBD
- **Low findings:** TBD
- **Deferred / accepted risks:** TBD
- **New tests recommended:** TBD
- **New diagnostics recommended:** TBD
- **Repair phase order:** TBD

**Exit criteria**

- Every confirmed finding is either tracked, fixed, or consciously deferred.
- Repair phases have clear scope and verification notes.
- The project has a repeatable regression strategy for unwired-system detection.
