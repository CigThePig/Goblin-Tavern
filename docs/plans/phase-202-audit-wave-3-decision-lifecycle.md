# Phase 202 — Gameplay audit, Wave 3: complete the decision lifecycle

Wave doc for `ISSUE-166` / Wave 3 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`. Depends on
Waves 0–2 (phases 199–201), all closed.

**Findings:** `P6-COMP-001` (High/P1), `P6-COMP-002` (High/P1),
`P6-COMP-003` (Med/P2), `P6-COMP-004` (Med/P2), `P5-PLAY-002` (Med/P2).

**Gate (Phase 8 §7):** the seven Phase F comprehension questions are
answerable from the interface for one immediate response, one delayed
response, one project, one priority and one report-to-plan path — and the
same explanation survives reload and historical revisit.

The seven questions (framework §Phase F): *what is happening now; which
choices are available and which are final; what just changed; why did it
change; did the action succeed, fail or remain pending; what consequence
should be expected later; what does the game expect next.*

---

## 1. Decisions taken (user, 2026-07-27)

**`DC-02` / `P3-DC-001` — deliberate Ignore and no answer are different
facts.** An explicit Ignore is a decision and is recorded as one ("You let
it stand"); a card the player never answered reports as no answer given.
Mechanically identical, distinct in the record — so the day's decision
ledger says what the player actually did. No blocking Closing prompt: the
audit asked for comprehension, not for a new gate in the day loop.

**`P6-COMP-003` — cause importance reads as a share of the change.** Each
cause's contribution is shown as its proportion of the drilldown's total,
not as a raw `weight 72` on a scale the player has no reference for. The
ranking information survives; the invented precision does not.

## 2. The decision record keeps the player's words (`P6-COMP-001`)

The card model carries both `label` ("Back Mira against the Ogres") and
`verb` (`blame`), and every confirmation surface renders the verb. So the
game told the player they had chosen `blame`, collapsed four unrelated
commitments into `upgrade`, and — because the report projection drops the
label when it builds the resolved-intent row — kept doing so in the
archive.

The visible label becomes the record:

- `buildIntent` carries the choice's label and target label on the intent;
- `applyResponsesHook` stores them on the `ResolvedIntentRecord`, so the
  sim owns the player-facing summary rather than the UI re-deriving it;
- `ReportResolvedIntent` carries `selectionLabel`, and the report renders
  it with the target as clearly secondary;
- an explicit Ignore records "You let it stand" (per `DC-02`);
- the pending chip reads the label plus **"Selected — revisable until End
  Day"**, which is the missing answer to *which choices are final*.

The internal verb stays out of default copy. It remains on the record for
debug surfaces and for the engine's own matching.

## 3. Delayed consequences get a lifecycle (`P6-COMP-002`)

A choice that promises a later effect currently vanishes at selection and
reappears as an unexplained number. The pending queue already holds
everything needed — `origin` (seed, slot, verb, enqueued day),
`scheduledFor` and `expiresAt` — but the report's future section only
projects `future_hook` memories from the closed day, so a canonical replay
with four scheduled entries showed an empty "What might happen".

New `projectPendingConsequences` reads `modules.responses.pending` and
emits one row per entry: what was chosen, what is expected, and when it is
due. `projectResolvedConsequences` reads `appliedFromPendingToday` and
`expiredFromPendingToday` and emits the completion side, naming the
originating choice — the link that lets a later delta be recognised as the
result of an earlier decision. States are distinct: **pending**, **due**,
**applied**, **expired**.

Both project from the closed-day state, so Wave 2's immutability holds and
they survive reload and historical revisit.

## 4. Causes speak tavern (`P6-COMP-003`)

The Coin drilldown answered "why" with `customers.merchants.dish_ale`,
`service.tabs.local_goblins`, and `weight 72`. The projection now
humanizes known source families, resolves actor and location refs through
`resolveEntityLabel`, and expresses importance as a share of the change.
An unknown source falls back to a safe generic sentence rather than
leaking its path.

## 5. Priorities show their trade and their result (`P6-COMP-004`)

The priority sheet renders only `def.label`, so a repeatable strategic
lever offered no forecast and no feedback: after switching Nash from Clean
to Prevent Fights, the plan said `1 customised`, the detail sheet said
`engine fallback`, and neither Service nor the report attributed anything
to the change.

Each priority definition gains a `benefit` and a `tradeoff` line in player
terms; the sheet renders both; the plan summary names the staff member and
their focus; and the report carries a directional contribution line. The
audit is explicit that precision here would be dishonest — the service
model cannot attribute a fight to a priority — so the line is directional
("Nash worked the floor for calm"), never a fabricated count.

## 6. Report rows keep their subject (`P5-PLAY-002`)

`humanizePath` has mappings for reputation, stock, pressures, areas and
staff; customer paths fall through to the last segment, so four groups'
satisfaction changes all rendered as `Satisfaction: 46 → 41 (−5)`. Adding
the customer mapping restores the group name. One line, and it is the
difference between a comparable report and four identical rows.

## 7. Evidence

`tests/sim/phase202.wave3.decisionLifecycle.test.ts` and
`tests/reports/phase202.wave3.comprehension.test.ts`:

- choices whose verbs are `upgrade`, `promote` and `blame` keep their
  visible wording through pending, revision, closing report and the
  historical report after the next day opens;
- an explicit Ignore reads as a refusal, distinct from an unanswered card;
- a delayed response appears as pending with a due day, then as applied
  and attributed to its originating choice, then not at all — and an
  expiring entry reads as expired, not as silently gone;
- cause drilldown rows carry no `.`-joined machine path and no raw weight,
  and name their actors by display name;
- every priority exposes a benefit and a tradeoff line;
- a report containing two customer satisfaction changes with identical
  before/after values renders two distinguishable rows.
