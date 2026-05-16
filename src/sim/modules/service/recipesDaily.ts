import type { SimContext } from '../../core/context'
import { recipeRegistry } from '../../registries/recipeRegistry'
import { applyRenownDrift } from './renown'

// Phase 65 / ISSUE-025 §5.2 + Phase 67 / ISSUE-027 §6.6 — Recipes
// daily housekeeping.
//
// At end-of-day this helper:
//
//   1. Increments `daysSinceLastServed` on every recipe that was not
//      served today. The counter feeds phase 72's niche-customer
//      decay rule (a niche group drifts off the active roster when
//      their preferred recipes haven't appeared in N days).
//   2. Applies a slow common-only renown decay: if the player has
//      served zero uncommon-tier-or-higher recipes in the past 30
//      days, `culinary_renown` drifts down by 1. Operationally this
//      checks whether *any* uncommon+ recipe has
//      `daysSinceLastServed < 30`; if not, the decay fires.
//
// Both passes use `ctx.modifyRecipe` so the cause-emission contract
// holds. The renown decay attributes its cause back to a
// representative recipe ref (the highest-served uncommon+ recipe if
// one is on the menu) plus a tavern-identity actor for the
// "tavern-wide" semantic.

// "Extended period" of pure common-only service starts at ~1 week.
// Once the streak crosses this, renown decays by 1 per day until the
// meter hits 0 or the player serves any uncommon+ recipe.
const COMMON_ONLY_DECAY_THRESHOLD_DAYS = 7

export function applyRecipesEndOfDay(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed + 1
  let servedAnyNonCommonRecently = false

  for (const [id, recipe] of Object.entries(ctx.state.recipes)) {
    const servedToday = recipe.lastServedDay === today
    if (!servedToday) {
      // Bump counter; lastServedDay = null means never served, so the
      // counter just keeps climbing — the niche decay logic in phase 72
      // checks both fields to decide what to do.
      ctx.modifyRecipe(
        id,
        { daysSinceLastServed: recipe.daysSinceLastServed + 1 },
        {
          source: 'service.recipes.daily',
          reason: 'recipe_idle_tick',
          readable: `${recipe.label} not served today.`,
          tags: ['recipe', 'idle', id],
          relatedActors: [{ kind: 'recipe', id }],
        },
      )
    }

    if (!recipeRegistry.has(id)) continue
    const def = recipeRegistry.get(id)
    if (def.demandTier === 'common') continue
    // After today's tick: a recipe that was served within the
    // threshold counts as "non-common activity".
    const updated = ctx.state.recipes[id]
    if (!updated) continue
    if (updated.daysSinceLastServed < COMMON_ONLY_DECAY_THRESHOLD_DAYS) {
      servedAnyNonCommonRecently = true
    }
  }

  // Phase 67 / ISSUE-027 §4.6, §6.6 — slow natural decay when the
  // menu has been common-only for 30 days. Apply once per day; the
  // total decay rate works out to ~1 renown per stretch of 30 idle
  // days because the meter clamps at 0 and `applyRenownDrift` is a
  // no-op when at the floor.
  if (!servedAnyNonCommonRecently && ctx.state.reputation.culinary_renown > 0) {
    // Pick the most-served uncommon+ recipe as the cause's
    // attribution anchor (so the cause has a non-empty
    // relatedActors list).
    let anchor: string | null = null
    let bestServed = -1
    for (const [id, state] of Object.entries(ctx.state.recipes)) {
      if (!recipeRegistry.has(id)) continue
      const def = recipeRegistry.get(id)
      if (def.demandTier === 'common') continue
      if (state.timesServed > bestServed) {
        bestServed = state.timesServed
        anchor = id
      }
    }
    const relatedActors = anchor
      ? [{ kind: 'recipe' as const, id: anchor }]
      : [{ kind: 'tavern_identity' as const, id: ctx.state.meta.tavernId }]
    applyRenownDrift(ctx, -1, {
      source: 'service.renown_decay',
      readable: 'Menu has been common-only for too long — culinary renown slips.',
      tags: ['renown', 'decay', 'common_only'],
      relatedActors,
    })
  }
}
