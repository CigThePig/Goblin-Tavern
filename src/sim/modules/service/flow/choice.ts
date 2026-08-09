import type { SimContext } from '../../../core/context'
import type {
  CustomerGroupState,
  RecipeState,
  RegularWorldState,
  TavernState,
} from '../../../state/TavernState'
import {
  getPriceToleranceFactorForGroup,
  getSpendFactorForGroup,
} from '../../economy/dynamics'
import { getServicePriceMultiplier } from '../../economy/policies'
import { recipeRegistry } from '../../../registries/recipeRegistry'
import { effectiveQuality, isPerishable } from '../../stock/spoilage'
import { getPrimaryRival } from '../../rival/rivalState'

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
 * Phase 4 wired this on the only competition signal that existed then — a
 * local event tagged `competition` — with a note that Phase 9 would give it
 * a rival to point at. Expansion Phase 9 §9.1 is that: the other house has
 * a position and a menu focus it actually chose, so what it is good at is
 * now a fact rather than an intensity number, and it pulls trade away from
 * whatever it leads with. The local-event term is kept alongside it: a
 * competition arc and a standing rival are different pressures on the same
 * choice, and only one of them has to be live.
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

  const rival = getPrimaryRival(state)
  if (rival && rival.position !== 'unknown' && recipeRegistry.has(recipe.id)) {
    const def = recipeRegistry.get(recipe.id)
    // Reach is how many people have heard what they do; without it a
    // position is a decision nobody has acted on yet.
    const pull = Math.min(1, rival.capability.reach / 100)
    const undercutting = Math.max(0, (50 - rival.capability.priceLevel) / 50)
    switch (rival.menuFocus) {
      case 'rounds':
        // A cheap house leading with rounds takes the ordinary pint first.
        if (def.demandTier === 'common') signal -= (0.5 + undercutting * 0.4) * pull
        else signal += 0.2 * pull
        break
      case 'food':
        if (recipe.tags.includes('food')) signal -= 0.5 * pull
        else signal += 0.15 * pull
        break
      case 'spectacle':
        if (recipe.tags.includes('alcohol')) signal -= 0.35 * pull
        break
      case 'comfort':
        if (recipe.tags.includes('quality_sensitive')) signal -= 0.35 * pull
        break
      default:
        break
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
  const price =
    recipeUnitPrice(state, recipe.id) * getServicePriceMultiplier(state, group.id)
  if (price <= 0) return 0
  // What this cohort considers an ordinary price, from its own wealth.
  //
  // The `1 +` matters: without it a poor cohort's comfortable price sat below
  // the cheapest dish on the menu, so EVERY dish read as expensive and the
  // whole tavern drifted onto whatever was cheapest. Prices in this game start
  // at 1, so the floor belongs in the formula.
  const tolerance = getPriceToleranceFactorForGroup(state, group.id)
  const comfortable = Math.max(1, (1 + group.wealth / 25) * tolerance)
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
  // NOTE what is deliberately NOT vetoed here: an empty cellar.
  //
  // Wanting something the house has run out of is the whole content of a
  // shortage, and scoring it to zero would delete the event: patrons would
  // silently order the thing that happens to be in stock and "we are out of
  // ale" would never be true of anybody. `chooseOrder` scores what they WANT,
  // discovers it cannot be served, records the shortage, and then substitutes.

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
 * different things, it orders the two or three the table agreed on.
 *
 * Three, not two, and the difference is economic rather than cosmetic. The
 * per-group baskets this replaces listed two or three dishes and split the
 * night across all of them; capping an order at two concentrated the whole
 * tavern onto whichever dish scored highest, roughly doubling ale demand and
 * making a restock that used to cover a payday fall short. Three keeps the
 * spread of the model it replaces while the CHOICE — which three, in what
 * proportion, and for whom — is entirely new.
 */
export const MAX_ORDER_LINES = 3

/**
 * Servings each patron takes across the party's chosen dishes.
 *
 * CALIBRATED AGAINST THE TILL, NOT THE PLATE COUNT. Phase 12's fixed basket
 * sold `(1 + speedBoost) × 0.5` servings of each of a group's two-or-three
 * listed recipes; the reference route's first day took 561 coin off ~187
 * servings. A chosen order is a slightly cheaper order — every group now
 * considers the mushrooms, where only the goblins' basket used to list them —
 * so matching the old plate count would have cut the day's takings by about a
 * sixth and quietly re-balanced the whole game. This is set so the takings
 * match instead (567 on the same seed): the tavern sells a few more plates at a
 * slightly lower average price. That is a real, explicable consequence of
 * patrons choosing rather than following a script, and it is the number the
 * economy is tuned against.
 */
export const SERVINGS_PER_PATRON = 2.4

export type PartyOrder = {
  lines: Array<{ recipeId: string; servings: number; drivers: string[] }>
  /**
   * What they asked for and could not have.
   *
   * The flow turns these into shortage records: a shortage is unmet DEMAND,
   * and demand only exists if somebody wanted the thing. Substituting silently
   * would make an empty cellar invisible in every report that reads shortages —
   * the weekly reliability signal, the repeated-shortage memory pattern, and
   * the restock issue seeds all key off them.
   */
  unmet: Array<{ recipeId: string; servings: number }>
}

export function chooseOrder(
  ctx: SimContext,
  party: { size: number },
  choice: ChoiceContext,
  options: { stretchFactor?: number } = {},
): PartyOrder {
  const empty: PartyOrder = { lines: [], unmet: [] }
  const scored: RecipeScore[] = []
  for (const recipe of Object.values(ctx.state.recipes)) {
    const result = scoreRecipeForParty(ctx, recipe, choice)
    if (!Number.isFinite(result.score) || result.score <= 0) continue
    scored.push(result)
  }
  if (scored.length === 0) return empty

  // Ties break on recipe id so ordering is stable across reloads (§5.10).
  scored.sort((a, b) =>
    b.score === a.score ? a.recipeId.localeCompare(b.recipeId) : b.score - a.score,
  )

  // `stretchFactor` is the cook's `stretch_ingredients` priority: smaller
  // portions, so the same party consumes less of the stores.
  const stretch = Math.max(0.5, Math.min(1, options.stretchFactor ?? 1))
  const spend = getSpendFactorForGroup(ctx.state, choice.group.id)
  const totalServings = Math.max(
    1,
    Math.round(party.size * SERVINGS_PER_PATRON * stretch * spend),
  )

  // What they wanted, before the cellar has its say.
  //
  // The split is by SQUARED score, not by score. A table that likes ale most
  // orders mostly ale; splitting in proportion to the raw scores would hand the
  // third choice a quarter of the round however weakly it was preferred, which
  // flattens every group onto the same order and — because the third choice
  // tends to be the cheapest dish — quietly cuts the night's takings. Squaring
  // keeps the ranking honest while letting a clear favourite dominate.
  const wanted = scored.slice(0, MAX_ORDER_LINES)
  const totalWeight = wanted.reduce((sum, entry) => sum + entry.weight * entry.weight, 0)
  if (totalWeight <= 0) return empty

  const unmet: Array<{ recipeId: string; servings: number }> = []
  const wantedLines: Array<{ recipeId: string; servings: number; drivers: string[] }> = []
  let assigned = 0
  for (let i = 0; i < wanted.length; i++) {
    const entry = wanted[i]!
    const isLast = i === wanted.length - 1
    const share = isLast
      ? totalServings - assigned
      : Math.round(((entry.weight * entry.weight) / totalWeight) * totalServings)
    if (share <= 0) continue
    assigned += share
    wantedLines.push({ recipeId: entry.recipeId, servings: share, drivers: entry.drivers })
  }

  // Now the cellar. A line the kitchen cannot back at all becomes a shortage
  // and is substituted with the best dish that IS available; a line it can only
  // partly back keeps what it can, and the rest is short.
  const lines: Array<{ recipeId: string; servings: number; drivers: string[] }> = []
  const takenFrom = new Map<string, number>()
  const remainingStock = (recipeId: string): number =>
    feasibleServings(ctx.state, recipeId) - (takenFrom.get(recipeId) ?? 0)

  // One line per recipe, always. A substitution can introduce a dish that a
  // later wanted-line also asks for, and two lines for the same recipe would
  // then both match the delivery step's `find` — which drove one of them
  // negative and failed state validation.
  const addLine = (
    recipeId: string,
    servings: number,
    drivers: string[],
  ): void => {
    if (servings <= 0) return
    const existing = lines.find((entry) => entry.recipeId === recipeId)
    if (existing) {
      existing.servings += servings
      return
    }
    lines.push({ recipeId, servings, drivers })
  }

  for (const line of wantedLines) {
    const available = Math.max(0, remainingStock(line.recipeId))
    const served = Math.min(line.servings, available)
    if (served > 0) {
      takenFrom.set(line.recipeId, (takenFrom.get(line.recipeId) ?? 0) + served)
      addLine(line.recipeId, served, line.drivers)
    }
    const short = line.servings - served
    if (short <= 0) continue
    unmet.push({ recipeId: line.recipeId, servings: short })

    // Substitute: the next best thing the cellar can actually back.
    const substitute = scored.find(
      (entry) =>
        entry.recipeId !== line.recipeId && remainingStock(entry.recipeId) > 0,
    )
    if (!substitute) continue
    const canServe = Math.min(short, remainingStock(substitute.recipeId))
    if (canServe <= 0) continue
    takenFrom.set(
      substitute.recipeId,
      (takenFrom.get(substitute.recipeId) ?? 0) + canServe,
    )
    addLine(substitute.recipeId, canServe, [
      ...substitute.drivers,
      `instead of ${line.recipeId}`,
    ])
  }

  return { lines: lines.filter((line) => line.servings > 0), unmet }
}
