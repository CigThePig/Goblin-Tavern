# Phase 88 — Card Layer & Full Day Loop

> Lands the real card layer at `src/cards/` and the full five-beat day
> loop in the web client. Picks up directly from Phase 87 (web chassis,
> merged in PR #73). Implements decisions from `cards-contract.md` and
> `game-loop-and-ux.md §§3, 6, 9`.

## Why

Phase 87 shipped the chassis: a Svelte 5 + Vite mobile site, a
`gameStore.svelte.ts` wrapping `simulateDay`, and a `CardRenderer`
driven by a throwaway `mockCardRegistry`. Beat 1 worked, Beat 5 had a
trimmed report, and player choices were tracked but **discarded** —
nothing reached the engine.

Phase 88 makes the loop interactive. Real cards. Real player input. The
sim sees three input channels — `ownerActions`, `staffPriorities`,
`responseIntents` — and bundles them into a single `simulateDay` per
game-day.

## Locked decisions

These resolve open questions from `cards-contract.md §9` and
`game-loop-and-ux.md §9`. Future phases inherit them.

| Question | Decision |
|---|---|
| Where does `cardRegistry` live? | `src/cards/` — separate slice. Cards import from sim; sim never imports cards. |
| Card type source of truth | `src/cards/types.ts`. `web/src/lib/cards/types.ts` is a thin re-export. |
| Selection when multiple cards match a seed | `priority` desc → specificity desc → `id` asc. Specificity counts defined `appliesTo` constraints (array fields by entry count; `custom` predicate scores 2). |
| Per-timing card cap | UI shows all valid seeds today; the deck-style components surface them in `cardWorthiness` order (mirroring `rankSeeds`). The "more matters today" overflow affordance is deferred to a later UX pass once the card volume warrants it. |
| Render target | Svelte `<CardRenderer>` (from Phase 87). No terminal renderer. |
| `toneHints` use | Carried on `CardDefinition`; renderer does not yet consume them. Future style pass. |
| Card ↔ owner-action surface | Separate. Cards are seed-driven; `ActionPicker` is its own sheet. |
| Ignore behaviour | Always rendered. Emitted as a `verb: 'ignore'` intent so the responses report has a record of the player's decision. The sim treats unmatched ignore intents as no-ops. |
| Engine calls per game-day | One `simulateDay` call at "End day." All beats accumulate into a single bundled `SimInput`. |
| Save shape | Unchanged. Player choices live in component state. Browser-storage save is deferred. |

## Delivered

### Card layer (`src/cards/`)

- `src/cards/types.ts` — `CardDefinition`, `CardAppliesTo`, `CardView`,
  `CardChoice`, `StakeView`. Canonical re-exports of supporting
  simulation types so callers can pull everything from one place.
- `src/cards/registry.ts` — `cardRegistry: Registry<CardDefinition>`,
  `ensureRequiredCardsRegistered()`, and `pickCard(seed, state)` — the
  single function the UI calls. Falls back to the catch-all card so
  every valid seed renders something.
- `src/cards/selection.ts` — `appliesToMatches`, `specificity`,
  `compareCards`, `pickCardForSeed`. Pure functions; no side effects.
- `src/cards/cardHelpers.ts` — `clampWords`, `formatTitle`, `buildBody`,
  `buildStakes`, `buildChoice`, `buildChoicesFromSeed`, `familyTag`,
  `makeCardView`. Shared template boilerplate so each archetype file
  stays focused on the composition that's specific to it.
- `src/cards/templates/` — the 8 starter templates from
  `cards-contract.md §7`, plus `fallback.ts`:
  - `foodSafetyCrisis.ts` — crisis archetype.
  - `customerComplaint.ts` — complaint, names a regular when supplied.
  - `supplierOffer.ts` — supplier opportunity with reliability surface.
  - `maintenanceWarning.ts` — warning with delayed-effect preview.
  - `staffRequest.ts` — staff personnel ask, names staff via state.
  - `factionRequest.ts` — relationship-test using stored relation.
  - `reputationWeekly.ts` — end-of-week trend; reads recent causes.
  - `monthlyReview.ts` — end-of-month review; reads pressure rollup.
  - `fallback.ts` — catch-all so unmatched valid seeds still render.

All templates: pure `(seed, state) → CardView`, respect
`TEXT_INGREDIENT_LIMITS`, emit only verbs in `slot.allowedVerbs`,
target only entities in `slot.targetOptions` (or omit), use the
descriptor pools (`pickSeverityAdjective`, `pickAreaStateAdjective`,
`pickFactionRelationNoun`) for flavour words. No `Math.random()`. No
state mutation.

### Web integration

- `web/src/lib/cards/types.ts` — re-export from `src/cards/types.ts`.
- `web/src/lib/cards/realCardRegistry.ts` — `renderCard(seed, state)`
  façade over `pickCard` from `src/cards/`.
- `web/src/lib/cards/mockCardRegistry.ts` — **deleted**.
- `web/src/lib/sim/intentBuilder.ts` — `buildIntent(seed, choice)` and
  `buildIgnoreIntent(seed)`. Sets `metadata.responseSlotId` so the
  responses module binds the intent to the exact slot via
  `selectConsequence.ts:30`.
- `web/src/lib/sim/actionBuilder.ts` — owner-action picker support:
  `listActionsByCategory`, `listValidTargets`, `canApplyAction`,
  `picksToInputs`, `totalActionPoints`, plus a readonly-context shim
  so `getValidTargets(ctx)` can run without a real engine pass.
- `web/src/lib/sim/gameStore.svelte.ts` — adds `seedsForTiming(timing)`
  helper. The `runDay(input)` signature was already complete in Phase
  87; Phase 88 just feeds it real data.

### New web components

- `web/src/lib/components/BottomSheet.svelte` — generic sheet primitive
  used by the picker, staff sheet, and any future drawer. Backdrop
  dismiss, Escape close, sticky header, optional footer slot, full
  height on mobile.
- `web/src/lib/components/ActionPicker.svelte` — tabbed by category
  (Immediate / Projects / Policies / Social). Per-row: label,
  action-point cost, disabled-reason text. Targeted actions push a
  second-level target picker. Picked actions appear as removable chips.
  Action-point budget sticky in the footer.
- `web/src/lib/components/StaffPrioritySheet.svelte` — one row per
  staff member with morale/stress mini-line; segmented control of the
  role's `allowedPriorities`. Selection auto-applies.
- `web/src/lib/components/CardDeck.svelte` — vertical single-card deck
  for `during_service` and `closing` beats. "X of N" counter, dot
  progress, prev/next nav. Auto-advances past resolved cards. Shows
  "noted: <verb>" or "ignored" overlay.
- `web/src/lib/components/BeatTransition.svelte` — 600ms pacing
  overlay between beats. Gated on `prefers-reduced-motion: reduce`.

### Day screen — five-beat state machine

`web/src/lib/screens/DayScreen.svelte` rewritten around a `Beat` enum:

```
'morning' → 'plan' → 'service' → 'closing' → 'report' → next day's 'morning'
```

- **Morning** — at-a-glance, pressure ribbon, morning_prep cards in the
  original stacked layout. Player resolves or defers. "Plan the day"
  button advances.
- **Plan** — two rows (Owner actions, Staff priorities) opening their
  respective sheets. Shows current pick count. "Back" returns to
  morning; "Run service" triggers the transition and advances.
- **Service** — 600ms `BeatTransition`, then a `CardDeck` of
  during_service seeds (or "service runs quietly" if empty). Continue
  button advances to closing.
- **Closing** — `CardDeck` of closing + end_week + end_month seeds.
  "End day" button bundles every accumulated input into a single
  `gameStore.runDay({ownerActions, staffPriorities, responseIntents})`
  call.
- **Report** — minimal diff dialog (same shape as Phase 87; full
  report is Phase 89). "Next day" returns to morning.

`staffPriorities` is sticky across days; `picks` and `pendingBySeedId`
reset on each `runDay`.

## Verification

| Check | Result |
|---|---|
| `npm test` | 79 files / 1164 tests pass. 51 new tests across `tests/cards/`. |
| `npm run typecheck` | clean (root tsconfig stays DOM-free). |
| `npm run check` (svelte-check) | clean. |
| `npm run build` | builds successfully. Bundle 832 KB / 219 KB gzipped (see Risks). |
| Intent round-trip | `tests/cards/intentRoundtrip.test.ts` drives 7 days, picks a card, builds an intent, feeds it back into `simulateDay`, asserts the engine sees it. |

### New tests

- `tests/cards/registry.test.ts` — 18 tests covering registration, the
  selection algorithm (priority / specificity / id ordering), and
  end-to-end `pickCard` calls including fallback behaviour.
- `tests/cards/templates.test.ts` — 31 tests, ~3-4 per template,
  asserting applies-to matches, render-within-budgets, choice
  validity (verb ⊆ allowedVerbs, target id resolves), and
  non-mutation (`JSON.stringify` before/after equal).
- `tests/cards/intentRoundtrip.test.ts` — 2 tests: pickCard works for
  every valid seed produced over 5 days; the engine accepts a built
  intent (resolved or logged) for at least one seed after 7 days.
- `tests/cards/cardFactories.ts` — shared `makeSeed(blueprint)` and
  `makeTavernState()` for the above suites.

### Test update

- `tests/sim/phase22.expansionStructure.test.ts` — the "no
  card/deck/cardUI folder at the src/sim or src root" assertion was
  intentionally maximalist for Phase 22. Phase 88 explicitly introduces
  `src/cards/` per cards-contract and game-loop-and-ux, so the rule
  narrows to "no card folders **under `src/sim/`**" — the sim must
  never import cards; cards may freely import sim. Comment added inline.

## Critical files referenced (read-only)

- `src/sim/core/engine.ts:1460` — `simulateDay`.
- `src/sim/core/context.ts:62` — `SimInput`, `ResponseIntent`,
  `SimInputOwnerAction`.
- `src/sim/modules/issues/issueSeedTypes.ts` — `IssueSeed`,
  `ResponseSlot`, `ConsequenceProfile`, `TEXT_INGREDIENT_LIMITS`.
- `src/sim/modules/responses/selectConsequence.ts:30` — confirms the
  `metadata.responseSlotId` slot-binding path the intent builder uses.
- `src/sim/modules/issues/issueSeedModule.ts:84` — confirms seeds are
  generated during `generateReports`, so all timings' seeds for "today"
  are present at start-of-day. Risk #1 from the plan turned out moot.
- `src/sim/registries/actionRegistry.ts` — owner action registry the
  picker reads.
- `src/sim/registries/staffPriorityRegistry.ts` — per-role allowed
  priorities the staff sheet reads.
- `src/sim/content/text/descriptors.ts` — pickers used by templates.
- `docs/plans/cards-contract.md §§5-7` — rules, definition shape, 8
  starter templates.
- `docs/plans/game-loop-and-ux.md §§3, 6, 9` — beat structure, screen
  map, open questions answered here.

## Out of scope (deferred)

Carried over from the plan; verified at implementation time as
genuinely later-phase concerns.

- Full Beat 5 report (causes drilldown, future hooks, attribution
  panels) — **Phase 89**.
- Weekly / monthly overview screens — **Phases 90, 91**.
- Reports / Tavern / World tab content (still `ComingSoon`) — **Phases
  89–94**.
- Tooltip layer ("what is food_safety?") — Phase 89 alongside Reports.
- Quick-day pattern (single-tap when nothing's on fire) — depends on
  reliable light-day detection; not yet.
- Browser-storage save / load — future phase.
- Voice/style pass on card prose — **Phase 95+**.
- "You could have done X" missed-opportunity hints — future phase;
  needs a deliberate missed-opportunity calculator.
- Per-timing card cap and overflow affordance — UI-only; deferred
  until typical card volume per beat is known from playtest.

## Risks & notes

1. **Bundle size.** 832 KB / 219 KB gzipped. The simulation is the
   heaviest part — pulling in `FULL_PIPELINE` materialises every
   module and registry. Acceptable for a single-page-app first iteration;
   `manualChunks` / dynamic imports become worthwhile when the
   simulation grows or when subsequent screens add weight.
2. **`mockCardRegistry` deletion.** Was an explicit Phase 87 throwaway.
   Removed in this phase; replaced by `realCardRegistry.ts` exporting
   the same function name so the DayScreen import was a one-line swap.
3. **Action-picker `getValidTargets` ctx shim.** Some owner-action
   definitions reach for context APIs (`addMemory`, `addCause`, etc.)
   from inside `getValidTargets` or `canApply`. The shim throws on
   those and the picker catches, falling back to "no valid targets"
   for that action that day. None of the current `REQUIRED_OWNER_ACTIONS`
   exhibit this in practice (verified via picker rendering); the
   safety net catches regressions loudly.
4. **End-of-week / end-of-month seed visibility.** Both timings'
   seeds are generated at the previous day's `generateReports` phase
   and remain on `seedsToday` until the next day. They surface in the
   closing beat alongside `closing`-timing seeds. The cards layer
   itself doesn't care — selection is per seed.
