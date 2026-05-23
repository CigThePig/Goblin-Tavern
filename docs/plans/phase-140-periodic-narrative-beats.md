# Phase 140 — Voiced Surface arc, Phase 14: Periodic & Narrative Beats

**ISSUE-109.** Final Movement II migration of the [Voiced Surface arc](voiced-surface-arc.md). Reads the arc's per-cluster standing prompt; runs the Phase-4 ([ISSUE-099 / phase 130](../ISSUE_TRACKER.md)) authoring loop end-to-end on the `monthly_review` and `seasonal_arc` card surface. Closes Movement II; Phase 15 (Reports Prose) picks up the weekly overview and the rest of the report surface.

---

## Context

Two issue-seed families render through legacy paths today:

| Family | Current handler | Primary actor | Timing | Generator |
|---|---|---|---|---|
| `monthly_review` / `monthly_review` | `src/cards/templates/monthlyReview.ts` (hand-written `composeBody` + `composeTitle`, lists top-3 pressures as raw `${label} ${value} (${trend})` lines) | `{ kind: 'other', id: 'month:${monthKey}' }` — a month ref, no `castAttributes` | `end_month` | `generateMonthlyReview` (`issueSeedGenerators.ts:3569`) |
| `seasonal_arc` / `arc_milestone` or `festival_preparation` | `fallbackCard` (no dedicated template) | Path A (active arc): `localArcRef(arcKey)` — `local_event` ref has no `castAttributes`; Path B (anticipation): `undefined` | `morning_prep` | `generateSeasonalArc` (`expandedSeedGenerators.ts:4285`) |

Per user scope direction, the **weekly overview** (a Svelte ReportSection rendered by `web/src/lib/components/WeeklyOverview.svelte` from structured data in `src/reports/weeklyOverviewProjection.ts`) is **deferred to Phase 15 (Reports Prose)**. Phase 14 stays a tight card-cluster migration.

---

## Movement I loopback — none

Both seeds expose what's needed through existing primitives:

- **monthly_review** lifts every pressure via `pressureRising` (`landlord`, `debt`, `reputation_drift`, `staff_burnout`, `customer_complaint`, `rival_tavern_pressure`); pulls calendar tags via `hasTag` (`rent_due_soon`, `monthly`, `summary`, `economy`, `reputation` — all in `seed.domain` / `seed.toneHints`); pulls prior-monthly memories via `memoryPresent` (the seed records `rent_paid_${monthKey}`, `cellar_invested_${monthKey}`, `reserves_held_${monthKey}`, `rival_settled_${monthKey}` memories on prior monthly choices).
- **seasonal_arc** routes per theme via `hasTag` against the theme already present in `seed.toneHints[2]` (`collectSeedTags` reads `domain ∪ toneHints ∪ stake tags`); reaches the two arc pressures via `pressureRising arc_escalation|festival_readiness`; distinguishes climax via `seedType arc_milestone`.

No new band signals. No new condition primitives. No new `resolveActorRef` role strings.

---

## Scope delivered

### Spec changes (design records)

- **New** `specs/cards/monthly_review.spec.yaml`.
- **New** `specs/cards/seasonal_arc.spec.yaml`.

### Code changes — templates

- **Rewritten in place** `src/cards/templates/monthlyReview.ts` — switches from hand-written `composeBody` + `composeTitle` to a compositional template via `defineCompositionalCard`. Template id `monthly_review.monthly_review`. Priority 65. Voice register `office_quarters`. Body shape `[establishing_line (sim-backed, ≤14 words), reaction_line (flavor, ≤12), manner_note? (flavor, ≤10)]`. Title rendered as `Month in review: ${snippet}`.
- **New** `src/cards/templates/seasonalArc.ts` — `seasonalArcTemplate` + `seasonalArcCard`. Template id `seasonal_arc.arc_milestone`. `appliesTo.seedTypes` covers both `['arc_milestone', 'festival_preparation']`. Priority 70. Voice register `civic_floor`. Body shape identical to monthly_review. Title rendered as `${arcLabel ?? themeLabel ?? 'Seasonal event'}: ${snippet}`.

### Code changes — pools

- **New** `src/cards/compose/pools/monthlyReview/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.
- **New** `src/cards/compose/pools/seasonalArc/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts`.

### Code changes — wiring

- **Modified** `src/cards/templates/index.ts` — adds `seasonalArcCard` to imports, `REQUIRED_CARDS`, and the re-export block.
- **Modified** `src/cards/index.ts` — re-exports `seasonalArcCard`.

### Test changes

- **New** `tests/cards/templates.monthlyReview.test.ts` — 16 tests.
- **New** `tests/cards/templates.seasonalArc.test.ts` — 18 tests (including dual-type and dual-path coverage, theme-routing assertions).
- **Modified** `tests/cards/templates.test.ts` — Template 8 (monthlyReview) block rewritten for compositional output; Template 9 (seasonalArc) block added.
- **Modified** `tests/cards/templates.voice.test.ts` — monthlyReview voice block rewritten; seasonalArc voice block added.
- **Modified** `tests/cards/compose/gates/samplers.ts` — four new exported sampler families plus two new Phase-6 context builders per template.
- **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — two new template-integration blocks + two new ad-hoc choice-pool blocks (all seven gates green per template).

---

## Out of scope (explicit)

- Weekly overview voicing → Phase 15 (Reports Prose).
- Reports tab prose, tavern log, day beats, fallback voicing → Phases 15 / 16.
- Touching `voice/composer.ts` or `voice/tonePools.ts` globally → Phase 16 retires them.
- Adding band signals, new condition primitives, new `resolveActorRef` role strings.
- Changes to `generateMonthlyReview` or `generateSeasonalArc` — mechanical truth (severity, response slots, consequence profiles, future hooks, memory tags) is unchanged.
- A `systemRef` fallback voicing for seasonal_arc Path B anticipation — handled by the title `themeLabel` fallback without a separate card.
- A separate template split by seasonal_arc seed type — user direction: one template covering both.

---

## Verification

- `npm test -- --run tests/cards/templates.monthlyReview.test.ts` — 16 tests.
- `npm test -- --run tests/cards/templates.seasonalArc.test.ts` — 18 tests.
- `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — two new template-integration blocks + two new ad-hoc choice-pool blocks (all seven gates green per template).
- `npm test -- --run tests/cards/compose/gates/` — all seven structural gates clean.
- `npm test -- --run tests/cards/templates.test.ts tests/cards/templates.voice.test.ts` — registration sweep + voice block updates.
- `npm run typecheck` — clean.
- `npm test -- --run` — full regression green.
- **Structural:** `grep -rn 'composeBody\|composeTitle' src/cards/templates/monthlyReview.ts src/cards/templates/seasonalArc.ts` returns nothing.
