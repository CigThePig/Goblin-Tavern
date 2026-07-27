# Phase 203 — Gameplay audit, Wave 4: restore action reachability and contextual transfer

Wave doc for `ISSUE-166` / Wave 4 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`. Depends on
Waves 0–3 (phases 199–202), all closed.

**Findings:** `P3-BHV-001` (Med/P2), `P3-BHV-002` (Med/P2),
`P5-PLAY-001` (Med/P2), `P6-COMP-005` (Med/P2), `P7-EXP-006` (Med/P2).

**Gate (Phase 8 §7):**

- R02 and R06 pass through every normal entry;
- one contextual target remains consistent through CTA, picker, quote,
  queue, Segment B, report and reload;
- after-Service work is either disallowed or explicitly labelled/reserved
  for tomorrow;
- expedition commission, progress, outcome, runner state, stock, cost and
  report complete naturally.

All five findings share one root shape: **a payload that loses a field
between two surfaces.** The inline policy control drops the target; the
commission validator is handed an empty input instead of the player's own;
the planner drops which day it is planning; the venture choice declares a
cost nothing carries; the drilldown CTA drops the entity that motivated
it. So the wave is one contract stated five times — *validate and carry
the payload the player actually specified.*

---

## 1. Contract decisions taken in this wave

Two findings offered the implementer a choice of contract. Both are
recorded here and in the queue.

**`P5-PLAY-001` — keep pre-planning, label it tomorrow.** The audit
offered "restrict the current-day planner after Segment B" or "retain
pre-planning but label the queue, remaining time and action timing as
tomorrow". Taken: **label it.** The mechanism the audit found is a real
and useful feature — `beginDay` deliberately preserves picks so the
Tavern surfaces can be used between days — and removing it would take
away reach rather than restore it, which is the opposite of this wave's
purpose. The defect is the copy, not the queue.

The authority is `segment`, not `beat`: picks queued while `segment ===
'A'` are consumed by *today's* Segment B; picks queued at 'B' or 'C' are
consumed by the *next* day's Segment B. `gameStore.planningHorizon`
exposes exactly that, and every surface that says "today" reads it.

**`P6-COMP-005` — owner time becomes a real, named, enforced cost.** The
audit offered "deduct a named amount and report it" or "remove the
owner-time claim". Taken: **deduct it.** `phase-186-day-clock-time-economy.md`
is a locked contract — the player's budget is time — and four other
issue-seed profiles already claimed `global.owner_time` on effects that
the applier silently discarded. Removing the claim would have deleted the
only lever card responses have on the day clock; making it real gives the
locked contract a second, working input.

Consequence worth knowing: the four pre-existing `global.owner_time`
effects carried amounts (`-5`, `-6`) on the pre-Phase-186 action-point
scale, and applied as minutes they would have been rounding error. They
are restated in minutes on the registry's own ladder (`TIME_COST_QUICK`
30m, `TIME_COST_SHORT` 60m). They cost nothing at all before this wave,
so this is new spend in the model — **owner-time tuning judged against
the pre-Wave-4 build is suspect**, and Wave 7 should re-check it.

## 2. Inline policy toggles carry their target (`P3-BHV-001`)

`ProjectsPanel.togglePolicy` built a pick with no `targetId`, so
`tryAddPick` asked `actionDisabledReasonForTarget(def, state, undefined,
…)` about a `policy`-typed action and got `no target` back. The central
picker's row worked only because it passed `targetId: row.policyId`.

Three changes, so the two entries cannot disagree again:

- the inline pick carries `targetId: row.id` and `targetLabel:
  row.label`, and its queued/removal checks are scoped to that target
  (`isQueued(actionId, targetId)`), which is what lets two policy rows
  hold independent queue state;
- `projectPolicies` computes `toggleDisabledReason` with
  `actionDisabledReasonForTarget` against the row's own policy id, so the
  reason the row shows is the reason the queue will give;
- `enable_*` / `disable_*` `getValidTargets` returns **its own policy**
  rather than all seven. Each definition already closes over one starter,
  so listing the other six was a target list that was never valid;
  narrowing it makes `invalid target` mean something.

## 3. Form-driven actions get an open-eligibility contract (`P3-BHV-002`)

`commission_expedition` declares `targetType: 'global'` and then rejects
any input without a `targetId`, a mode, a duration and a target tier or
ingredient. Every eligibility query in the codebase asks a global action
`canApply({ actionId })` — an empty input — so the answer was always
`commission_expedition requires a runner targetId`. Stock disabled its
only form-opening button on that answer and the central picker disabled
its row. The form could not be reached, and had it been reached,
`tryAddPick` would have rejected the completed commission for the same
reason: it validated the definition generically instead of validating the
pick the player had just built.

Both halves are fixed:

- `OwnerActionDefinition` gains optional **`canOpen`** — "may the player
  begin specifying this action?", separate from "is this fully specified
  input valid?". `actionDisabledReason` prefers it when present.
  `commissionExpedition.canOpen` asks the real question: is there an
  uninjured, unbusy runner, and can the till afford the cheapest
  single-day commission?
- `actionDisabledReasonForInput` validates a **complete** payload —
  target, amount and options — and `tryAddPick` uses it. A global-typed
  action now has its `targetId` and `options` forwarded to `canApply`
  instead of dropped, which is the same "carry the payload" fix as
  `P3-BHV-001` at the queue boundary.

`OwnerActionDefinition` also gains **`composer`**, a declarative marker
that an action needs a dedicated form (`commission_expedition` →
`'expedition'`). The central picker routes a composer action to its form
instead of queueing an under-specified pick; the store carries the
request the same way `actionPickerRequest` already does, and `StockPanel`
consumes it. The target type stays `'global'` — the audit's open question
— because the runner is one of four fields the form collects, not a
target the generic two-level picker could meaningfully enumerate.

## 4. The planner names the day it is planning (`P5-PLAY-001`)

`gameStore.planningHorizon` returns `'today'` while `segment === 'A'` and
`'tomorrow'` afterwards. Reading it:

- the Top Bar time chip, whose label and `aria-label` said "left today"
  on every interactive beat, and which now renders an explicit
  `tomorrow` marker and reads "of tomorrow's budget";
- the ActionPicker title ("Plan the day" / "Plan tomorrow"), its
  unspent-day line, and a banner on the queue naming the day the picks
  will run;
- `TavernScreen`'s quick-action surfaces, through the same banner.

Nothing about the queue's behaviour changes: it was already correct.

## 5. Owner time is spent, named and enforced (`P6-COMP-005`)

`global.owner_time` reached `applyEffectViaCtx` and fell through every
branch to `unsupported effect target`. It is now a first-class target,
and the contract is enforced at the same three points Wave 1 established
for coin (`DC-07` — gate at selection, re-check atomically):

- **Cost function.** `responseCost.ts` gains `immediateOwnerTimeCost` /
  `ownerTimeCostOfSlot` beside the coin pair, so the number previewed,
  the number gated and the number spent are one function.
- **Application.** The applier adds the minutes to
  `modules.ownerActions.timeSpent` — the canonical day-clock ledger
  Segment B already writes — with a cause, and refuses (whole, applied:
  false) rather than overrunning `timeBudget`, which the module's own
  validator treats as an error.
- **Selection gate.** `gateChoicesByTime` mirrors `gateChoicesByCoin`:
  a choice costing more owner time than the day has left after queued
  owner actions and today's other committed choices is disabled with a
  readable reason.
- **Atomic re-check.** `applyResponsesHook` prices time alongside coin
  and skips a no-longer-affordable intent WHOLE, per `DC-07`.

The venture's `invest_owner_time` profile gains the effect it always
claimed (`TIME_COST_SHORT`, 60m), with a meter so the card preview states
the amount. The four pre-existing claims are restated in minutes.

## 6. Contextual targets survive the handoff (`P7-EXP-006`)

A stock-shortage suggestion knew the item, put it in prose, and then
handed the picker an action definition. The target rides the payload now:

- `SuggestedAction` carries `targetId` / `targetLabel`, and the
  yesterday-loss trigger de-duplicates by **action *and* target**, so two
  shortages produce two suggestions rather than one;
- `planActionCtaForPath` handles `stock.<id>.*` paths (previously it
  returned nothing for them) and names the item as the preferred target;
- `ActionPickerRequest` carries `preferredTargetId`, `preferredTargetLabel`
  and `reason`; the picker preselects a preferred target when it is
  valid, and otherwise sorts it first and marks it in the target list,
  leaving every alternative reachable;
- the queued pick keeps `contextReason`, so the chip, the queue and the
  confirmation say which problem the action answers. A preferred target
  that is no longer valid falls back to the ordinary list rather than
  queueing something stale.

## 7. Regression coverage

Per Phase 8 §8, every finding is reproduced on its audit route before the
fix and asserted after:

- `tests/sim/phase203.wave4.actionReachability.test.ts` — policy target
  and validity, `canOpen` / composer eligibility, full-payload
  validation, the owner-time cost function, applier, atomic re-check and
  the day-clock invariant `timeSpent <= timeBudget`, expedition
  commission → progress → completion → runner state → report.
- `tests/web/phase203.wave4.planningHorizon.test.ts` — the horizon
  authority across segments and reload, inline policy queueing, the
  composer request, suggestion/CTA target retention through queue and
  Segment B, and the selection-time owner-time gate.
