# Phase 193 / ISSUE-160 — Action effect previews + suggestions in the Plan beat

Locked arc contract: `docs/plans/ui-ux-intuitiveness-arc.md` (§Phase 193).
Tracker entry: `docs/ISSUE_TRACKER.md` → ISSUE-160.

Two Plan-beat clarity gaps, addressed together:

- **Part A — effect previews.** Owner-action rows in the picker show only a
  label, a time cost, and (when blocked) a disabled reason. They never say
  what the action *does*.
- **Part B — suggestions.** The picker has no stance on what matters today.
  Add a small "Suggested" section tying actions to rising pressures and
  yesterday's losses.

## Audit correction (read first)

The arc contract's Part A premise — "`OwnerActionDefinition` already carries
an `effectsPreview`" — is **factually wrong against the current code**.
`effectsPreview` exists only on the persistent *project* records
(`OwnerProjectState`) and on `ProjectStarterDefinition`; policy rows surface
`PolicyStarterDefinition.effects[0]` via `actionBuilder.listPolicyToggleRows`.
Ordinary immediate/social action **definitions** carry no preview string at
all (`OwnerActionDefinition` = `id, label, category, tags, targetType,
timeCost, getValidTargets, canApply, apply`).

So Part A's literal "no new sim data — read what the definition already
provides" instruction cannot be satisfied as written: there is nothing to
read. The faithful resolution under the Core Design Rule (*the simulation is
the source of truth; the web layer must not invent copy*) is to add the
preview as **additive sim data** — a terse `effectsPreview?: string` on
`OwnerActionDefinition`, authored on the action definitions in `src/sim/`.
This keeps the copy in the source-of-truth layer (not the web layer, which
the contract's "Do not do" list explicitly forbids), and is consistent with
Part B's own additive `pressureAffinity?` field on the same type. The picker
then surfaces what the definition provides, exactly as the contract intends.

## Part A — effect previews

- **`src/sim/modules/ownerActions/types.ts`** — add two optional, additive
  fields to `OwnerActionDefinition`: `effectsPreview?: string` (terse, one
  line) and `pressureAffinity?: PressureId[]` (Part B). Both default
  undefined; no save-schema impact (definitions are code, not state).
- Author `effectsPreview` on the immediate actions
  (`actionDefinitions.ts`), the social actions (`socialActions.ts`), and the
  project actions (`projectActions.ts` — derived from the starter's existing
  `effectsPreview` array, joined to one line). Terse and literal, matching
  the existing dim-caption voice of policy `effects`.
- **`ActionPicker.svelte`** — render `def.effectsPreview` as a one-line dim
  caption under each action row's label (mirroring the existing
  `.policy-effect` row). Rows with no preview show no caption and no
  placeholder.

## Part B — suggestion engine

- **`web/src/lib/sim/suggestActions.ts`** (new, pure) —
  `suggestActions(state, picks, previousReport?): SuggestedAction[]`,
  capped at 3.
  - **Rising-pressure trigger:** for each pressure in its danger band — the
    phase-191 rule, `getAllPressureSnapshots(state)` filtered to
    `consequences.length > 0` — find actions whose `pressureAffinity`
    includes that pressure id. Reason: `"<Label> rising"`.
  - **Yesterday-loss trigger:** for each stock-quantity loss line in
    `previousReport.groupedDiffs.stock` (`direction === 'loss'`), suggest
    `restock_item`. Reason: `"lost <item> yesterday"` (item label read from
    `state.stock`, not authored).
  - Dedup by `actionId` across both triggers and against `picks`.
  - Sort by **severity of source pressure desc, then lowest time cost asc**,
    then a stable insertion-order tiebreak (deterministic). Loss-triggered
    suggestions carry severity 0 so they sort after in-band pressures.
- **Additive registry field:** `pressureAffinity?: PressureId[]` on
  `OwnerActionDefinition`, tagged on the obvious actions (clean_area,
  repair_area, restock_item, adjust_prices, pay_staff_bonus, patch_roof,
  fumigate_cellar, buy_mugs, the five social actions, start_rat_proof_storage,
  …). ≥60% coverage of the suggestible (non-policy) actions; untagged actions
  are silently never suggested.
- **`ActionPicker.svelte`** — new optional `previousReport?: DailyReportData`
  prop. Render a "Suggested" section above the tab strip when
  `suggestActions` returns ≥1 result; each row renders like a normal action
  row (label, time, Part-A preview, disabled reason) plus the reason caption.
  Tapping routes through the existing `tapAction` path. The section collapses
  entirely when empty.
- **`DayScreen.svelte`** — pass `previousReport` from the already-derived
  `dailyReport` slot (success only) into `<ActionPicker>`.

## Tests

- `tests/sim/phase193.actionAffinity.test.ts` — every `pressureAffinity`
  value is a valid pressure id; authored `effectsPreview` values are
  non-empty strings.
- `tests/web/phase193.actionPreviewsAndSuggest.test.ts` (jsdom) —
  effect-preview rendering (present + absent), rising-pressure trigger,
  yesterday-loss trigger, cap at 3, dedup against picks, time-cost tiebreak,
  deterministic ordering, reactive collapse.

## Do not do

- No new effect-preview copy in the **web** layer (copy lives in `src/sim/`).
- No "smart" recommender — the rule set is intentionally simple.
- No suggestions outside the picker; no auto-add; no action-point language.
- No save-schema change (the two new fields live on code-level definitions).
