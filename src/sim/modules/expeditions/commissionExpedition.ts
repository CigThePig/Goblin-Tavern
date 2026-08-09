import type { SimContext } from '../../core/context'
import { stockRegistry } from '../../registries/stockRegistry'
import type {
  Expedition,
  ExpeditionMode,
  ExpeditionTargetTier,
} from '../../state/TavernState'
import { addExpedition } from './state'
import {
  availableRoutes,
  routeFor,
} from './journey'
import {
  routeProvisionsNeeded,
  routeTravelDays,
  type ExpeditionRoute,
} from '../../content/expeditions/expeditionRoutes'
import {
  getExpeditionsModuleState,
  openExpeditionRun,
  type ExpeditionRun,
  type ExpeditionTermsKind,
} from './runState'
import { spendCoin } from '../stock/ledger'
import type {
  OwnerActionDefinition,
  OwnerActionInput,
} from '../ownerActions/types'
import { TIME_COST_STANDARD } from '../ownerActions/stateHelpers'

// Phase 70 / ISSUE-030 §6.3 — `commissionExpedition` owner action.
//
// The player picks a hireable adventurer, a mode (`open` or
// `targeted`), and a target (tier for open, ingredient id for
// targeted), then pays a cost up front. The action validates
// runner availability and player coin, then appends a new entry to
// `state.expeditions.active`. The expedition resolves end-only when
// `daysElapsed >= daysTotal` in the expeditions module.
//
// Phase 77 / ISSUE-037 — Cost is `runner.wageBase * daysTotal`,
// not the legacy `input.amount` value (which is now ignored). A
// runner with `activeFlags.includes('injured')` is filtered out of
// `getValidTargets` and rejected at `canApply`.
//
// Action inputs:
//   targetId — runnerId (the hireable adventurer)
//   options — { mode, daysTotal, targetTier?, targetIngredientId? }

export const COMMISSION_EXPEDITION_ACTION_ID = 'commission_expedition'

function readMode(input: OwnerActionInput): ExpeditionMode | null {
  const opt = input.options?.['mode']
  if (opt === 'open' || opt === 'targeted') return opt
  return null
}

function readTargetTier(
  input: OwnerActionInput,
): ExpeditionTargetTier | null {
  const opt = input.options?.['targetTier']
  if (opt === 'uncommon' || opt === 'rare' || opt === 'legendary') return opt
  return null
}

function readTargetIngredient(input: OwnerActionInput): string | null {
  const opt = input.options?.['targetIngredientId']
  return typeof opt === 'string' && opt.length > 0 ? opt : null
}

// Expansion Phase 9 §9.3 — the commission is now four more decisions than
// it was: where they go, who goes, what they carry, and what they are hired
// on. Each is read leniently and defaulted to the cautious answer, because
// the form is one of several entry points and an omitted field should
// produce a safe trip rather than a rejection.

function readRouteId(input: OwnerActionInput): string | null {
  const opt = input.options?.['routeId']
  return typeof opt === 'string' && opt.length > 0 ? opt : null
}

function readPartySize(input: OwnerActionInput): number {
  const opt = input.options?.['partySize']
  if (typeof opt !== 'number' || !Number.isFinite(opt)) return 1
  return Math.max(1, Math.min(MAX_PARTY_SIZE, Math.round(opt)))
}

function readTermsKind(input: OwnerActionInput): ExpeditionTermsKind {
  const opt = input.options?.['terms']
  if (opt === 'flat_fee' || opt === 'share_of_haul' || opt === 'hazard_bonus') {
    return opt
  }
  return 'flat_fee'
}

/**
 * Provisions bought for the trip.
 *
 * Defaults to exactly what the route asks for, so a player who does not
 * engage with the loadout is neither punished nor protected — they get the
 * trip the route describes. Buying more is insurance against delay; buying
 * less is a gamble the journey will price.
 */
function readProvisions(
  input: OwnerActionInput,
  route: ExpeditionRoute,
  partySize: number,
): number {
  const opt = input.options?.['provisions']
  const needed = routeProvisionsNeeded(route, partySize)
  if (typeof opt !== 'number' || !Number.isFinite(opt)) return needed
  return Math.max(0, Math.min(needed * 2, Math.round(opt)))
}

function readMedicine(input: OwnerActionInput): number {
  const opt = input.options?.['medicine']
  if (typeof opt !== 'number' || !Number.isFinite(opt)) return 0
  return Math.max(0, Math.min(3, Math.round(opt)))
}

function readGear(input: OwnerActionInput): number {
  const opt = input.options?.['gear']
  if (typeof opt !== 'number' || !Number.isFinite(opt)) return 0
  return Math.max(0, Math.min(3, Math.round(opt)))
}

/**
 * The route a commission gets when the player named a target but not a place.
 *
 * §9.3 makes the target a consequence of the route, which cuts both ways: a
 * commission that names `rare` and no route is asking to be sent somewhere
 * rare things are, not to be refused because the nearest road only has
 * mushrooms on it. The default is the SAFEST known route that can actually
 * fill the request — `availableRoutes` is already sorted by danger, so the
 * first match is the least dangerous one, and a player who wants the richer
 * haul has to name the worse road themselves.
 */
export function pickDefaultRoute(
  routes: ExpeditionRoute[],
  wanted: ExpeditionTargetTier | null,
): ExpeditionRoute | undefined {
  if (!wanted) return routes[0]
  return routes.find((route) => route.yields.includes(wanted)) ?? undefined
}

/** The tier a commission is really asking for, whichever mode it used. */
function requestedTier(input: OwnerActionInput): ExpeditionTargetTier | null {
  const mode = readMode(input)
  if (mode === 'open') return readTargetTier(input)
  const ingredientId = readTargetIngredient(input)
  if (!ingredientId || !stockRegistry.has(ingredientId)) return null
  const rarity = stockRegistry.get(ingredientId).defaultState.rarity
  return rarity === 'uncommon' || rarity === 'rare' || rarity === 'legendary'
    ? rarity
    : null
}

/** The most runners one commission may send. */
export const MAX_PARTY_SIZE = 3
/** Coin per unit of provisions, medicine and gear. */
export const SUPPLY_UNIT_COST = 2
export const MEDICINE_UNIT_COST = 12
export const GEAR_UNIT_COST = 15

// Phase 77 / ISSUE-037 — cost is derived from the runner's wageBase
// and the chosen daysTotal, not the player's `input.amount` value
// (which was free-form and let a master adventurer ship for 0 coin).
function computeCost(
  runner: { wageBase: number },
  daysTotal: number,
): number {
  const value = runner.wageBase * daysTotal
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Expansion Phase 9 §9.3 — what a commission costs, broken out.
 *
 * The ADVANCE depends on the terms, which is the whole point of having
 * terms: a flat fee is paid in full up front, a share of the haul costs
 * almost nothing to start and everything if it goes well, and a hazard
 * bonus sits between the two. The loadout is bought outright either way —
 * provisions are provisions whoever is paying the runner.
 */
export function commissionCosts(
  party: ReadonlyArray<{ wageBase: number }>,
  route: ExpeditionRoute,
  loadout: { provisions: number; gear: number; medicine: number },
  terms: ExpeditionTermsKind,
): { advance: number; loadout: number; agreed: number; total: number } {
  const days = routeTravelDays(route) + 1
  // EVERY MEMBER AT THEIR OWN RATE. Multiplying the leader's wage by the
  // party size priced companions the form picks automatically — by highest
  // experience — at whatever the leader happens to earn: a cheap leader
  // brought expensive veterans at the cheap rate, and an expensive one
  // overcharged for cheap companions. The party is a list of people who are
  // each owed something, so it is summed rather than multiplied.
  const wage = party.reduce(
    (sum, member) => sum + computeCost(member, days),
    0,
  )
  const agreed =
    terms === 'flat_fee'
      ? wage
      : terms === 'share_of_haul'
        ? Math.round(wage * 0.25)
        : Math.round(wage * 0.6)
  const advance =
    terms === 'flat_fee'
      ? agreed
      : terms === 'share_of_haul'
        ? Math.round(agreed * 0.4)
        : Math.round(agreed * 0.5)
  const kit =
    loadout.provisions * SUPPLY_UNIT_COST +
    loadout.medicine * MEDICINE_UNIT_COST +
    loadout.gear * GEAR_UNIT_COST
  return { advance, loadout: kit, agreed, total: advance + kit }
}

/**
 * Who actually goes, in the order they are picked.
 *
 * The leader is the runner the player named; the rest come along by
 * experience, in a stable order so the same commission builds the same
 * party. Shared between `canApply` and `apply` so the price quoted at the
 * gate is the price charged — they used to build the party twice, by
 * slightly different routes.
 */
function buildParty(
  ctx: SimContext,
  leader: { id: string; wageBase: number; experience: number },
  requested: number,
): Array<{ id: string; wageBase: number; experience: number }> {
  const others = availableRunners(ctx)
    .filter((candidate) => candidate.id !== leader.id)
    .sort((a, b) => b.experience - a.experience || a.id.localeCompare(b.id))
  const size = Math.max(1, Math.min(requested, 1 + others.length))
  return [leader, ...others.slice(0, size - 1)]
}

/** Adventurers who are neither out on a job nor recovering from one. */
function availableRunners(ctx: SimContext) {
  return Object.values(ctx.state.world.hireableAdventurers).filter(
    (a) => a.currentExpeditionId === null && !a.activeFlags.includes('injured'),
  )
}

function buildExpeditionId(ctx: SimContext): string {
  // Use the calendar day plus the count of expeditions so far for a
  // stable, deterministic id given the same input sequence.
  const today = ctx.state.calendar.totalDaysElapsed + 1
  const seq =
    ctx.state.expeditions.active.length +
    ctx.state.expeditions.completed.length
  return `exp_${today}_${seq}`
}

export const commissionExpedition: OwnerActionDefinition = {
  id: COMMISSION_EXPEDITION_ACTION_ID,
  label: 'Commission Expedition',
  category: 'immediate',
  tags: ['expedition', 'world', 'adventurer'],
  effectsPreview: 'Sends adventurers out for rare ingredients',
  targetType: 'global',
  timeCost: TIME_COST_STANDARD,
  // Phase 203 / audit Wave 4 (`P3-BHV-002`) — a runner is one of four
  // fields this action needs; the other three (mode, duration, tier or
  // ingredient) have no target list a generic picker could walk. The
  // definition names the form that owns them so every entry point routes
  // there rather than queueing an under-specified pick.
  composer: 'expedition',
  // Phase 203 / audit Wave 4 (`P3-BHV-002`) — eligibility to OPEN that
  // form, which is the question Stock and the central picker were really
  // asking. They asked `canApply({ actionId })` instead — an empty input —
  // and got "requires a runner targetId" back, so the only form-opening
  // button in the game disabled itself while three runners stood idle.
  canOpen: (ctx: SimContext) => {
    const runners = availableRunners(ctx)
    if (runners.length === 0) {
      return {
        ok: false,
        code: 'no_runner_available',
        reason: 'No adventurer is free to send right now.',
      }
    }
    // AFFORDABLE AT THE CHEAPEST COMMISSION THE FORM CAN ACTUALLY PRODUCE.
    //
    // This used to price one day of the cheapest runner's wage — a shape no
    // commission can have any more, because §9.3 derives the duration from
    // a route and the shortest of those is five days with a loadout to buy.
    // So the Stock panel enabled the button for a player who could not
    // afford any configuration the form offers, and every attempt bounced
    // off `canApply`. The real floor is the cheapest known route, a party
    // of one, the loadout that route asks for, and the terms with the
    // smallest advance.
    const known = getExpeditionsModuleState(ctx.state).knownDiscoveries
    const routes = availableRoutes(ctx.state, known)
    if (routes.length === 0) {
      return {
        ok: false,
        code: 'no_route_available',
        reason: 'There is nowhere to send anybody.',
      }
    }
    let cheapest = Number.POSITIVE_INFINITY
    for (const runner of runners) {
      for (const route of routes) {
        const loadout = {
          provisions: routeProvisionsNeeded(route, 1),
          gear: 0,
          medicine: 0,
        }
        for (const terms of ['flat_fee', 'share_of_haul', 'hazard_bonus'] as const) {
          const costs = commissionCosts([runner], route, loadout, terms)
          if (costs.total < cheapest) cheapest = costs.total
        }
      }
    }
    if (ctx.state.coin < cheapest) {
      return {
        ok: false,
        code: 'insufficient_coin',
        reason: `The cheapest commission costs ${cheapest} coin; you have ${ctx.state.coin}.`,
      }
    }
    return { ok: true }
  },
  getValidTargets: (ctx: SimContext) => {
    return availableRunners(ctx).map((a) => ({
      id: a.id,
      label: a.name.display,
      hint: `exp ${a.experience}, rel ${a.reliability}, friend ${a.relationship}, wage ${a.wageBase}/day`,
    }))
  },
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return {
        ok: false,
        code: 'missing_target',
        reason: 'commission_expedition requires a runner targetId',
      }
    }
    const runner = ctx.state.world.hireableAdventurers[input.targetId]
    if (!runner) {
      return {
        ok: false,
        code: 'unknown_runner',
        reason: `Hireable adventurer '${input.targetId}' does not exist.`,
      }
    }
    if (runner.currentExpeditionId !== null) {
      return {
        ok: false,
        code: 'runner_busy',
        reason: `${runner.name.display} is already on expedition ${runner.currentExpeditionId}.`,
      }
    }
    if (runner.activeFlags.includes('injured')) {
      return {
        ok: false,
        code: 'runner_injured',
        reason: `${runner.name.display} is recovering from a prior expedition and cannot be commissioned.`,
      }
    }
    const mode = readMode(input)
    if (!mode) {
      return {
        ok: false,
        code: 'invalid_mode',
        reason: 'commission_expedition requires options.mode of "open" or "targeted".',
      }
    }
    // Expansion Phase 9 §9.3 — the duration is a consequence of WHERE they
    // are sent, not a number the player types. A route that has not been
    // discovered yet is not on the board at all.
    const known = getExpeditionsModuleState(ctx.state).knownDiscoveries
    const routeId = readRouteId(input)
    const routes = availableRoutes(ctx.state, known)
    const wanted = requestedTier(input)
    const route = routeId
      ? routes.find((entry) => entry.id === routeId)
      : pickDefaultRoute(routes, wanted)
    if (!route) {
      return {
        ok: false,
        code: routeId ? 'unknown_route' : 'no_route_yields_tier',
        reason: routeId
          ? `Nobody knows a way called '${routeId}'.`
          : wanted
            ? `Nobody knows a way to anything ${wanted} yet.`
            : 'There is nowhere to send anybody.',
      }
    }
    const daysTotal = routeTravelDays(route) + 1
    if (mode === 'open') {
      const tier = readTargetTier(input)
      if (!tier) {
        return {
          ok: false,
          code: 'invalid_target_tier',
          reason: 'Open expeditions require options.targetTier (uncommon/rare/legendary).',
        }
      }
      // §9.3 — a target is a consequence of the route. Asking the Market
      // Road for something legendary is not an expensive gamble, it is a
      // request nobody can fill, and it is refused rather than silently
      // downgraded.
      if (!route.yields.includes(tier)) {
        return {
          ok: false,
          code: 'tier_not_on_route',
          reason: `${route.label} does not yield ${tier} — it yields ${route.yields.join(', ')}.`,
        }
      }
    } else {
      const ingredientId = readTargetIngredient(input)
      if (!ingredientId) {
        return {
          ok: false,
          code: 'invalid_target_ingredient',
          reason: 'Targeted expeditions require options.targetIngredientId.',
        }
      }
      if (!stockRegistry.has(ingredientId)) {
        return {
          ok: false,
          code: 'unknown_ingredient',
          reason: `Ingredient '${ingredientId}' is not registered in stockRegistry.`,
        }
      }
      // Phase 70 fix — targeted expeditions exist to fetch
      // rare/legendary ingredients (see
      // docs/plans/rare-ingredients-economy.md §4.4). Common-tier
      // items are supplier-sourced and must not be requestable via
      // an expedition commission.
      const rarity = stockRegistry.get(ingredientId).defaultState.rarity
      if (rarity === 'common') {
        return {
          ok: false,
          code: 'invalid_target_rarity',
          reason: `Targeted expeditions only fetch uncommon/rare/legendary ingredients; '${ingredientId}' is common.`,
        }
      }
      // AND THE ROUTE HAS TO BE ABLE TO YIELD IT. Open mode already refuses
      // a tier the route cannot produce; targeted mode checked only that the
      // ingredient was not common, so naming a legendary ingredient
      // alongside `routeId: 'market_road'` passed — and `tierForRun` then
      // read the ingredient's own rarity and `buildHaul` handed it over.
      // That is the whole danger-and-discovery progression bypassed by
      // asking for the thing by name instead of by tier.
      if (!route.yields.includes(rarity)) {
        return {
          ok: false,
          code: 'tier_not_on_route',
          reason: `${route.label} does not yield ${rarity} — it yields ${route.yields.join(', ')}.`,
        }
      }
    }
    // The same party `apply` will actually send, so the gate prices what the
    // player will be charged rather than an approximation of it.
    const party = buildParty(ctx, runner, readPartySize(input))
    const loadout = {
      provisions: readProvisions(input, route, party.length),
      gear: readGear(input),
      medicine: readMedicine(input),
    }
    const costs = commissionCosts(party, route, loadout, readTermsKind(input))
    if (ctx.state.coin < costs.total) {
      return {
        ok: false,
        code: 'insufficient_coin',
        reason: `Need ${costs.total} coin up front for ${route.label} (${costs.advance} advance + ${costs.loadout} supplies); have ${ctx.state.coin}.`,
      }
    }
    return { ok: true }
  },
  apply: (ctx, input) => {
    const runner = ctx.state.world.hireableAdventurers[input.targetId!]!
    const mode = readMode(input)!
    const known = getExpeditionsModuleState(ctx.state).knownDiscoveries
    const routes = availableRoutes(ctx.state, known)
    const routeId = readRouteId(input)
    const route =
      (routeId ? routes.find((entry) => entry.id === routeId) : undefined) ??
      pickDefaultRoute(routes, requestedTier(input)) ??
      routes[0]!
    const daysTotal = routeTravelDays(route) + 1

    // The party: the named runner leads, and anybody else free comes along
    // in a stable order so the same commission builds the same party.
    const others = availableRunners(ctx)
      .filter((candidate) => candidate.id !== runner.id)
    const party = buildParty(ctx, runner, readPartySize(input))
    const partyRunnerIds = party.map((member) => member.id)

    const loadout = {
      provisions: readProvisions(input, route, partyRunnerIds.length),
      gear: readGear(input),
      medicine: readMedicine(input),
    }
    const termsKind = readTermsKind(input)
    const costs = commissionCosts(party, route, loadout, termsKind)
    const cost = costs.total
    const targetTier = mode === 'open' ? readTargetTier(input) : null
    const targetIngredientId =
      mode === 'targeted' ? readTargetIngredient(input) : null
    const expeditionId = buildExpeditionId(ctx)
    const today = ctx.state.calendar.totalDaysElapsed + 1

    if (cost > 0) {
      spendCoin(ctx, cost, {
        source: `expedition.commission.${expeditionId}`,
        category: 'other',
        tags: ['expedition', 'commission', expeditionId],
      })
    }

    const expedition: Expedition = {
      id: expeditionId,
      runnerId: runner.id,
      mode,
      targetTier,
      targetIngredientId,
      daysTotal,
      daysElapsed: 0,
      costPaid: cost,
      startedDay: today,
      status: 'in_progress',
      // Capture the commission day's per-day input seed so resolution can
      // rebuild the expedition's named streams independent of the
      // resolution day's input seed. Phase 186 (Cluster 2): read
      // `ctx.input.seed` rather than `ctx.rngStreams.baseSeed` — the stream
      // set is now reseeded per segment, so `baseSeed` would be the
      // segment-scoped seed (commissioning runs in Segment B). `input.seed`
      // is the unsegmented per-day seed, which is exactly what `baseSeed`
      // was before segmentation, keeping expedition resolution stable.
      seed: ctx.input.seed,
    }
    addExpedition(ctx, expedition)

    // Expansion Phase 9 §9.3 — the journey's own record, opened in the same
    // pass as the expedition so the two cannot drift.
    const run: ExpeditionRun = {
      expeditionId: expedition.id,
      routeId: route.id,
      partyRunnerIds,
      loadout,
      terms: {
        kind: termsKind,
        advanceCoin: costs.advance,
        agreedCoin: costs.agreed - costs.advance,
        sharePercent: termsKind === 'share_of_haul' ? 35 : 0,
        settled: false,
        settledCoin: 0,
        unpaidCoin: 0,
      },
      phase: 'outbound',
      legIndex: 0,
      legsTotal: route.legs,
      dayInLeg: 0,
      supplies: loadout.provisions,
      hungryDays: 0,
      medicine: loadout.medicine,
      // Gear is spent up front and shows up as a party that starts steadier
      // and in less danger, rather than as a meter nobody sees.
      morale: Math.min(100, 65 + loadout.gear * 5),
      hazard: Math.max(0, Math.round(route.danger / 4) - loadout.gear * 3),
      delayDays: 0,
      injuredRunnerIds: [],
      events: [],
      dispatches: [],
      haulBonus: 1,
      discoveries: [],
      roadCosts: 0,
    }
    openExpeditionRun(ctx, run)

    // Reflect the assignment on every runner who went, so other modules can
    // see they are unavailable.
    for (const memberId of partyRunnerIds) {
      const member = ctx.state.world.hireableAdventurers[memberId]
      if (!member) continue
      ctx.modifyHireableAdventurer(
        memberId,
        { currentExpeditionId: expedition.id, daysSinceLastJob: 0 },
        {
          source: 'expedition.commission',
          sourceType: 'system',
          readable: `${member.name.display} commissioned for expedition ${expedition.id}.`,
          tags: ['expedition', 'commission', expedition.id, memberId],
          relatedActors: [{ kind: 'other', id: memberId }],
          relatedSystems: ['expeditions', 'adventurers'],
        },
      )
    }

    ctx.addHistory({
      category: 'owner_action',
      summary: `Commissioned ${runner.name.display} down ${route.label} for a ${mode} expedition (${
        targetTier ?? targetIngredientId
      }) over about ${daysTotal} days.`,
      tags: ['expedition', 'commission', expedition.id],
      relatedActors: [{ kind: 'other', id: runner.id }],
      relatedSystems: ['expeditions'],
      mechanicalRefs: [COMMISSION_EXPEDITION_ACTION_ID],
    })

    const effects: string[] = [
      `${route.label}: ${partyRunnerIds.length === 1 ? runner.name.display : `${runner.name.display} and ${partyRunnerIds.length - 1} other(s)`}, about ${daysTotal} days.`,
      route.readable,
      `Carrying ${loadout.provisions} provisions${loadout.medicine > 0 ? `, ${loadout.medicine} medicine` : ''}${loadout.gear > 0 ? `, ${loadout.gear} gear` : ''}.`,
      `On ${termsKind.replace(/_/g, ' ')} terms — ${costs.advance} coin advance, ${costs.agreed - costs.advance} on return.`,
      `Spent ${cost} coin up front.`,
      route.wordDelayDays > 0
        ? `Word from that far out takes ${route.wordDelayDays} day(s) to reach the house.`
        : 'Word from the road reaches the house the same day.',
    ]

    return {
      actionId: COMMISSION_EXPEDITION_ACTION_ID,
      label: 'Commission Expedition',
      targetId: runner.id,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: {
        expeditionId: expedition.id,
        runnerId: runner.id,
        routeId: route.id,
        partyRunnerIds,
        loadout,
        terms: termsKind,
        mode,
        targetTier,
        targetIngredientId,
        daysTotal,
        costPaid: cost,
      },
    }
  },
}
