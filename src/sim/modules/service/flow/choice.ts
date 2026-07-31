import type { SimContext } from '../../../core/context'
import type {
  CustomerGroupState,
  RecipeState,
  RegularWorldState,
  TavernState,
} from '../../../state/TavernState'
import { recipeRegistry } from '../../../registries/recipeRegistry'
import { effectiveQuality, isPerishable } from '../../stock/spoilage'

// Expansion Phase 4 §4.2 — customer choice, scored.
//
// WHAT THIS REPLACES. `DEFAULT_BASKET` was a hard-coded array per group:
// miners always wanted two ales and a stew, merchants a stew and an ale, and
// nothing the player did — the menu, the price, the reputation, the culture of
// the room, a shortage last week, a regular's known favourite — could change a
// single line of it. The only two knobs were "is it on the menu" and "does the
// group's tag list veto it", which is a filter, not a decision.
//
// WHAT A DECISION NEEDS. §4.2 lists twelve inputs. Each is one scoring term
// below, each returns a bounded contribution, and each names itself in
// `drivers` when it moves the outcome — so a card or a report can say WHY the
// merchants ordered what they ordered without re-deriving it.
//
// PURITY AND DETERMINISM. `scoreRecipeForParty` is pure: same state, same
// party, same score. There is no RNG in the scoring at all — the only random
// input to ordering is the party's own composition, rolled once upstream on the
// `service_flow` stream. Ties break on recipe id, so a reload cannot reorder a
// menu.

/** Bounded per-term contribution, so no single axis can dominate. */
const TERM_CAP = 2

export type ChoiceContext = {
  group: CustomerGroupState
  regular?: RegularWorldState
  /** Waves this party has already waited. Long waits shift the order. */
  wavesWaited: number
  /** Day type, for seasonal/novelty context. */
  dayType: string
}

export type RecipeScore = {
  recipeId: string
  score: number
  drivers: string[]
  /** Servings this party would like of this dish, before capacity. */
  weight: number
}

function clampTerm(value: number): number {
  return Math.max(-TERM_CAP, Math.min(TERM_CAP, value))
}

/** Unit sale price of a recipe, from the stock its inputs consume. */
export function recipeUnitPrice(state: TavernState, recipeId: string): number {
  if (!recipeRegistry.has(recipeId)) return 0
  let price = 0
  for (const input of recipeRegistry.get(recipeId).inputs) {
    const item = state.stock[input.ingredientId]
    if (!item) continue
    price += item.salePrice * input.quantity
  }
  return price
}

/**
 * Servings of `recipeId` the current stock can back.
 *
 * The feasibility gate (§4.2 "ingredient feasibility"): a dish nobody can make
 * is not a choice, however much the patron wanted it. Returning the count
 * rather than a boolean lets the score degrade as the cellar runs down instead
 * of flipping at zero.
 */
export function feasibleServings(state: TavernState, recipeId: string): number {
  if (!recipeRegistry.has(recipeId)) return 0
  let capacity = Number.POSITIVE_INFINITY
  for (const input of recipeRegistry.get(recipeId).inputs) {
    const available = state.stock[input.ingredientId]?.quantity ?? 0
    capacity = Math.min(capacity, Math.floor(available / input.quantity))
  }
  return Number.isFinite(capacity) ? Math.max(0, capacity) : 0
}

/** Average effective quality of a recipe's inputs, 0–100. */
function recipeQuality(state: TavernState, recipeId: string): number {
  if (!recipeRegistry.has(recipeId)) return 50
  let total = 0
  let count = 0
  for (const input of recipeRegistry.get(recipeId).inputs) {
    const item = state.stock[input.ingredientId]
    if (!item) continue
    total += isPerishable(item) ? effectiveQuality(item) : item.quality
    count += 1
  }
  return count === 0 ? 50 : total / count
}

function hasTag(recipe: RecipeState, tags: ReadonlyArray<string>): boolean {
  return tags.some((tag) => recipe.tags.includes(tag))
}

/** Reputation axes a recipe's tags speak to. §4.2 "identity and reputation". */
function reputationTerm(state: TavernState, recipe: RecipeState): number {
  const rep = state.reputation
  let signal = 0
  if (recipe.tags.includes('quality_sensitive')) signal += (rep.tasty - 50) / 50
  if (recipe.tags.includes('strange') || recipe.tags.includes('exotic')) {
    signal += (rep.strange - 50) / 50
  }
  if (recipe.tags.includes('goblin')) signal += (rep.goblinAuthentic - 50) / 50
  if (recipeRegistry.has(recipe.id)) {
    const def = recipeRegistry.get(recipe.id)
    if (def.demandTier !== 'common') {
      // Renown is what draws people to the unusual dishes at all.
      signal += (rep.culinary_renown - 40) / 60
    }
  }
  return clampTerm(signal)
}

/** §4.2 "culture" — the group's culture, not just the group. */
function cultureTerm(
  ctx: SimContext,
  group: CustomerGroupState,
  recipe: RecipeState,
): number {
  if (!group.cultureId) return 0
  const culture = ctx.getCulture(group.cultureId)
  if (!culture) return 0
  let signal = 0
  if (hasTag(recipe, culture.dislikedTags)) signal -= 1.5
  if (hasTag(recipe, culture.preferredStockTags)) signal += 0.8
  if (recipeRegistry.has(recipe.id)) {
    const def = recipeRegistry.get(recipe.id)
    if (def.culturalTags.includes(culture.id)) signal += 0.6
    // A culture that is comfortable here orders more adventurously.
    if (def.demandTier !== 'common') signal += (culture.comfort - 50) / 120
  }
  return clampTerm(signal)
}

/**
 * §4.2 "prior experience" — what this group remembers about this dish.
 *
 * Read off the memory log the kitchen already writes: a botched preparation or
 * a shortage is a reason to order something else next time. This is what makes
 * `memory` a decision input rather than an explanation (plan §4.2's "beliefs and
 * attribution must alter decisions").
 */
function experienceTerm(state: TavernState, recipe: RecipeState): number {
  let signal = 0
  for (const memory of state.memories) {
    const strength = memory.strength ?? 0
    if (strength <= 0) continue
    const metaRecipe = memory.metadata?.['recipeId']
    if (memory.id === 'botched_preparation' && metaRecipe === recipe.id) {
      signal -= 0.5 * Math.min(2, strength)
    }
    if (memory.id === 'excellent_preparation' && metaRecipe === recipe.id) {
      signal += 0.4 * Math.min(2, strength)
    }
  }
  for (const input of recipeRegistry.has(recipe.id)
    ? recipeRegistry.get(recipe.id).inputs
    : []) {
    const shortageMemory = state.memories.find(
      (m) =>
        m.id === `${input.ingredientId}_shortage_recently` &&
        (m.strength ?? 0) > 0,
    )
    if (shortageMemory) signal -= 0.3
  }
  return clampTerm(signal)
}

/** §4.2 "novelty or seasonal context". */
function noveltyTerm(recipe: RecipeState, dayType: string): number {
  let signal = 0
  // Something nobody has ordered for a while is interesting again; something
  // served every single day is not. `daysSinceLastServed` is already maintained
  // by the recipes daily pass.
  if (recipe.daysSinceLastServed >= 5) signal += 0.4
  if (recipe.daysSinceLastServed === 0 && recipe.timesServed > 40) signal -= 0.2
  if (recipeRegistry.has(recipe.id)) {
    const def = recipeRegistry.get(recipe.id)
    if (def.culturalTags.includes(dayType)) signal += 0.6
  }
  if (dayType === 'feast_day' && recipe.tags.includes('food')) signal += 0.4
  if (dayType === 'payday' && recipe.tags.includes('alcohol')) signal += 0.3
  return clampTerm(signal)
}

/**
 * §4.2 "competitor appeal".
 *
 * There is no rival tavern in state until Phase 9, so this reads the signal
 * that DOES exist today: a live local event tagged as competition pulls trade
 * toward whatever the competition is good at, and away from the ordinary
 * rounds. Wired now, on real state, so Phase 9 gives it a rival to point at
 * rather than having to introduce the term.
 */
function competitorTerm(state: TavernState, recipe: RecipeState): number {
  let signal = 0
  for (const event of Object.values(state.world.localEvents)) {
    if (!event.tags.includes('competition') && !event.tags.includes('rival')) {
      continue
    }
    const pull = Math.min(1, event.intensity / 100)
    // Common rounds are the easiest thing for a competitor to undercut.
    if (recipeRegistry.has(recipe.id)) {
      const def = recipeRegistry.get(recipe.id)
      signal += def.demandTier === 'common' ? -0.8 * pull : 0.3 * pull
    }
  }
  return clampTerm(signal)
}

/**
 * §4.2 "group purpose" — what this cohort came in for.
 *
 * Keyed off the `spendingProfile` vocabulary the customer registry already
 * ships, rather than a new field: `cheap_volume` miners are here for rounds,
 * `careful_quality` merchants for something decent, `lavish` adventurers for
 * whatever the kitchen is proudest of.
 */
function purposeTerm(group: CustomerGroupState, recipe: RecipeState): number {
  const tier = recipeRegistry.has(recipe.id)
    ? recipeRegistry.get(recipe.id).demandTier
    : 'common'
  let signal = 0
  switch (group.spendingProfile) {
    case 'cheap_volume':
      if (recipe.tags.includes('alcohol')) signal += 0.5
      if (tier !== 'common') signal -= 0.5
      break
    case 'binge_spend':
      if (recipe.tags.includes('alcohol')) signal += 0.9
      break
    case 'careful_quality':
      if (recipe.tags.includes('quality_sensitive')) signal += 0.6
      break
    case 'high_margin':
      if (tier !== 'common') signal += 0.5
      if (recipe.tags.includes('food')) signal += 0.3
      break
    case 'big_spend':
    case 'lavish':
    case 'splurge':
      if (tier !== 'common') signal += 0.8
      break
    default:
      break
  }
  if (group.rowdiness >= 70 && recipe.tags.includes('alcohol')) signal += 0.4
  return clampTerm(signal)
}

/** §4.2 "price and wealth". */
function priceTerm(
  state: TavernState,
  group: CustomerGroupState,
  recipe: RecipeState,
): number {
  const price = recipeUnitPrice(state, recipe.id)
  if (price <= 0) return 0
  // What this cohort considers an ordinary price, from its own wealth.
  const comfortable = Math.max(1, group.wealth / 20)
  const overshoot = (price - comfortable) / comfortable
  if (overshoot <= 0) {
    // A cheap round is a small positive for the price-sensitive.
    return clampTerm((-overshoot) * (group.priceSensitivity / 100) * 0.6)
  }
  return clampTerm(-overshoot * (group.priceSensitivity / 100) * 1.6)
}

/**
 * §4.2 "waiting time" — patience shifts what people order.
 *
 * A cohort that has been standing about does not order the elaborate thing; it
 * orders whatever comes out fastest. `prepDifficulty` is the existing measure of
 * how much work a dish is, so this needs no new field.
 */
function waitTerm(recipe: RecipeState, wavesWaited: number): number {
  if (wavesWaited <= 0) return 0
  if (!recipeRegistry.has(recipe.id)) return 0
  const def = recipeRegistry.get(recipe.id)
  const fussiness = (def.prepDifficulty - 30) / 40
  return clampTerm(-fussiness * Math.min(2, wavesWaited) * 0.5)
}

/**
 * §4.3 "favorite stock must affect behavior rather than remain descriptive".
 *
 * Before this phase `favoriteStockId` was written at emergence and read by
 * nothing but display text. Here it is a real pull on the order, and — because
 * the regular's party is the one ordering — it decides what the tavern actually
 * sells on the nights they come in.
 */
function regularFavouriteTerm(
  regular: RegularWorldState | undefined,
  recipe: RecipeState,
): number {
  if (!regular) return 0
  let signal = 0
  if (regular.favoriteRecipeId === recipe.id) signal += 1.8
  if (regular.favoriteStockId && recipeRegistry.has(recipe.id)) {
    const usesFavourite = recipeRegistry
      .get(recipe.id)
      .inputs.some((input) => input.ingredientId === regular.favoriteStockId)
    if (usesFavourite) signal += 1.2
  }
  return clampTerm(signal)
}

/** Quality of what is actually in the cellar, as the patron would find it. */
function qualityTerm(state: TavernState, recipe: RecipeState): number {
  const quality = recipeQuality(state, recipe.id)
  return clampTerm((quality - 50) / 40)
}

/**
 * Score one dish for one party. Pure, bounded, and self-explaining.
 *
 * A returned score of `-Infinity` means a hard veto — off the menu, tabooed by
 * the group, or nothing in the cellar to make it with. Those are not weak
 * preferences and must not be scored into contention by a strong term elsewhere.
 */
export function scoreRecipeForParty(
  ctx: SimContext,
  recipe: RecipeState,
  choice: ChoiceContext,
): RecipeScore {
  const state = ctx.state
  const drivers: string[] = []
  const zero: RecipeScore = { recipeId: recipe.id, score: -Infinity, drivers, weight: 0 }

  if (!recipe.onMenu) {
    drivers.push('off the menu')
    return zero
  }
  if (!recipeRegistry.has(recipe.id)) return zero
  // §4.2 "preference and taboo" — a taboo is a veto, not a penalty.
  if (choice.group.dislikedTags.some((tag) => recipe.tags.includes(tag))) {
    drivers.push(`${choice.group.label} will not touch it`)
    return zero
  }
  if (feasibleServings(state, recipe.id) <= 0) {
    drivers.push('nothing in the cellar to make it with')
    return zero
  }

  const terms: Array<{ id: string; value: number; readable: string }> = [
    {
      id: 'preference',
      value: choice.group.preferredStockTags.some((tag) => recipe.tags.includes(tag))
        ? 1
        : choice.group.preferredStockTags.length === 0
          ? 0.2
          : -0.4,
      readable: 'group taste',
    },
    { id: 'price', value: priceTerm(state, choice.group, recipe), readable: 'price' },
    { id: 'quality', value: qualityTerm(state, recipe), readable: 'quality' },
    {
      id: 'experience',
      value: experienceTerm(state, recipe),
      readable: 'past experience',
    },
    { id: 'wait', value: waitTerm(recipe, choice.wavesWaited), readable: 'the wait' },
    {
      id: 'reputation',
      value: reputationTerm(state, recipe),
      readable: "the tavern's name",
    },
    { id: 'culture', value: cultureTerm(ctx, choice.group, recipe), readable: 'culture' },
    { id: 'purpose', value: purposeTerm(choice.group, recipe), readable: 'what they came for' },
    { id: 'competitor', value: competitorTerm(state, recipe), readable: 'the competition' },
    {
      id: 'regular',
      value: regularFavouriteTerm(choice.regular, recipe),
      readable: 'a regular’s favourite',
    },
    { id: 'novelty', value: noveltyTerm(recipe, choice.dayType), readable: 'novelty' },
  ]

  let score = 1
  for (const term of terms) {
    if (term.value === 0) continue
    score += term.value
    if (Math.abs(term.value) >= 0.5) {
      drivers.push(`${term.readable} ${term.value > 0 ? '+' : ''}${term.value.toFixed(1)}`)
    }
  }

  return { recipeId: recipe.id, score, drivers, weight: Math.max(0, score) }
}

/**
 * What this party orders.
 *
 * Servings scale with party size, not with a fixed per-group basket: the cohort
 * decides what it wants, then how much of it. A party takes at most
 * `MAX_ORDER_LINES` distinct dishes — a crowd of six does not order six
 * different things, it orders the two the table agreed on.
 */
export const MAX_ORDER_LINES = 2

/**
 * Servings each patron takes across the party's chosen dishes.
 *
 * Calibrated against the model this replaces so the economy does not move on
 * the reference route: Phase 12's basket sold `(1 + speedBoost) × 0.5` servings
 * of each of a group's two-or-three listed recipes, which came to ~2 servings a
 * head on the default crew. A party now orders the same volume, but of dishes
 * it chose.
 */
export const SERVINGS_PER_PATRON = 2

export function chooseOrder(
  ctx: SimContext,
  party: { size: number },
  choice: ChoiceContext,
  options: { stretchFactor?: number } = {},
): Array<{ recipeId: string; servings: number; drivers: string[] }> {
  const scored: RecipeScore[] = []
  for (const recipe of Object.values(ctx.state.recipes)) {
    const result = scoreRecipeForParty(ctx, recipe, choice)
    if (!Number.isFinite(result.score) || result.score <= 0) continue
    scored.push(result)
  }
  if (scored.length === 0) return []

  // Ties break on recipe id so ordering is stable across reloads (§5.10).
  scored.sort((a, b) =>
    b.score === a.score ? a.recipeId.localeCompare(b.recipeId) : b.score - a.score,
  )
  const picked = scored.slice(0, MAX_ORDER_LINES)
  const totalWeight = picked.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight <= 0) return []

  // `stretchFactor` is the cook's `stretch_ingredients` priority: smaller
  // portions, so the same party consumes less of the stores.
  const stretch = Math.max(0.5, Math.min(1, options.stretchFactor ?? 1))
  const totalServings = Math.max(
    1,
    Math.round(party.size * SERVINGS_PER_PATRON * stretch),
  )
  const lines: Array<{ recipeId: string; servings: number; drivers: string[] }> = []
  let assigned = 0
  for (let i = 0; i < picked.length; i++) {
    const entry = picked[i]!
    const isLast = i === picked.length - 1
    const share = isLast
      ? totalServings - assigned
      : Math.round((entry.weight / totalWeight) * totalServings)
    const servings = Math.max(isLast ? 0 : 0, share)
    if (servings <= 0) continue
    assigned += servings
    lines.push({ recipeId: entry.recipeId, servings, drivers: entry.drivers })
  }
  return lines.filter((line) => line.servings > 0)
}
