import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import { stockRegistry } from '../../registries/stockRegistry'
import type {
  Expedition,
  ExpeditionOutcome,
  ExpeditionRecord,
  ExpeditionReturnedIngredient,
  ExpeditionTargetTier,
  HireableAdventurer,
  StockRarity,
} from '../../state/TavernState'
import { createRng, type SimRng } from '../../core/rng'
import { applyRenownDrift } from '../service/renown'
import { resolveExpedition, updateActiveExpedition } from './state'
import { EXPEDITIONS_MODULE_ID } from './moduleId'
import {
  ExpeditionsModuleStateSchema as ExpeditionsRunSchema,
  arrivedDispatches,
  dispatchesInTransit,
  getExpeditionRun,
  getExpeditionsModuleState,
  liveExpeditionRuns,
  pruneExpeditionRuns,
  writeExpeditionsSlice,
} from './runState'
import { advanceExpeditionDay, routeFor } from './journey'
import {
  applyRenown,
  applyWorldEffects,
  buildHaul,
  closeRecord,
  haulValue,
  outcomeFor,
  settleTerms,
} from './resolve'

// Build the expedition's named RNG streams from the seed stored on the
// expedition at commission time, not from the resolution day's input
// seed. Mirrors `createRngStreams.getByName`'s `${baseSeed}:${name}`
// derivation but reads from `expedition.seed` so saves resumed (or
// replayed) on a different day still produce the same outcome.
function expeditionStream(expedition: Expedition, name: string): SimRng {
  return createRng(`${expedition.seed}:${name}`, 0)
}

// Phase 70 / ISSUE-030 §4.4, §5.3, §6.3 — Expeditions module.
//
// Daily tick:
//   - `startDay` hook increments `daysElapsed` on every active
//     expedition.
//   - Any expedition where `daysElapsed >= daysTotal` resolves via
//     its named RNG stream `expedition_<id>`.
//   - Ingredients on success/partial outcomes draw quality from
//     `ingredient_quality_<id>`.
//
// Outcome roll bias:
//   - Runner experience + reliability → +X% to success.
//   - Target tier (rare > uncommon, legendary > rare) → lower base.
//   - Targeted mode is harder than open mode by ~20% at every tier.

export { EXPEDITIONS_MODULE_ID }

const RUNNER_LOST_BASE_CHANCE = 0.04
const TARGETED_PENALTY = 0.15

function targetTierBaseSuccess(tier: ExpeditionTargetTier | null): number {
  switch (tier) {
    case 'uncommon':
      return 0.7
    case 'rare':
      return 0.5
    case 'legendary':
      return 0.3
    case null:
      return 0.6
    default:
      return 0.5
  }
}

function rarityForExpedition(
  expedition: Expedition,
): ExpeditionTargetTier {
  if (expedition.mode === 'targeted' && expedition.targetIngredientId) {
    if (stockRegistry.has(expedition.targetIngredientId)) {
      const rarity = stockRegistry.get(expedition.targetIngredientId)
        .defaultState.rarity
      if (rarity === 'common') return 'uncommon'
      return rarity
    }
  }
  return expedition.targetTier ?? 'uncommon'
}

function pickOpenIngredient(
  rng: SimRng,
  tier: ExpeditionTargetTier,
): string | null {
  const candidates: string[] = []
  for (const def of stockRegistry.all()) {
    if (def.defaultState.rarity === tier) candidates.push(def.id)
  }
  if (candidates.length === 0) return null
  return rng.pick(candidates)
}

function rollOutcome(
  rng: SimRng,
  runner: HireableAdventurer,
  expedition: Expedition,
): ExpeditionOutcome {
  // Experience + reliability move the success line. A 0/0 runner
  // operates at the base tier rate; a 100/100 runner shifts ~30%
  // points of probability mass toward success.
  const tier = rarityForExpedition(expedition)
  let success = targetTierBaseSuccess(tier)
  success += (runner.experience / 100) * 0.15
  success += (runner.reliability / 100) * 0.15
  if (expedition.mode === 'targeted') success -= TARGETED_PENALTY
  // Phase 77 / ISSUE-037 — `specialty` biases the outcome roll when
  // the runner's specialty matches the actual rarity tier being
  // fetched. Magnitude (+0.10) is small enough to preserve the
  // rookie/master spread but big enough to make specialty a real
  // hiring signal.
  if (runner.specialty !== null && runner.specialty === tier) {
    success += 0.1
  }
  success = Math.max(0.05, Math.min(0.95, success))

  // runner_lost outcome is rare and biased by low reliability and
  // dangerous tier. Legendary tier doubles the base.
  let lostChance = RUNNER_LOST_BASE_CHANCE
  if (tier === 'rare') lostChance += 0.02
  if (tier === 'legendary') lostChance += 0.05
  lostChance += (1 - runner.reliability / 100) * 0.05

  const roll = rng.float()
  if (roll < lostChance) return 'runner_lost'
  // Partial outcome occupies the band just below success.
  const partialBand = Math.max(0.05, 0.18 - (runner.experience / 100) * 0.08)
  if (roll < lostChance + success) return 'success'
  if (roll < lostChance + success + partialBand) return 'partial'
  return 'failure'
}

function buildReturnedIngredients(
  ctx: SimContext,
  expedition: Expedition,
  outcome: ExpeditionOutcome,
): ExpeditionReturnedIngredient[] {
  if (outcome !== 'success' && outcome !== 'partial') return []
  void ctx
  const qualityRng = expeditionStream(
    expedition,
    `ingredient_quality_${expedition.id}`,
  )
  const tier: ExpeditionTargetTier = rarityForExpedition(expedition)
  const ingredientId =
    expedition.mode === 'targeted' && expedition.targetIngredientId
      ? expedition.targetIngredientId
      : pickOpenIngredient(qualityRng, tier)
  if (!ingredientId || !stockRegistry.has(ingredientId)) return []
  // Success → 3-5 units at quality 60-90; partial → 1-2 units at 40-65.
  let quantity: number
  let quality: number
  if (outcome === 'success') {
    quantity = qualityRng.int(3, 5)
    quality = qualityRng.int(60, 90)
  } else {
    quantity = qualityRng.int(1, 2)
    quality = qualityRng.int(40, 65)
  }
  return [{ ingredientId, quantity, quality }]
}

function writeIngredientsToStock(
  ctx: SimContext,
  returned: ExpeditionReturnedIngredient[],
  expeditionId: string,
): void {
  for (const ret of returned) {
    const existing = ctx.state.stock[ret.ingredientId]
    if (!existing) continue
    // Blended quality if some quantity is already in stock; else use
    // the returned batch's quality.
    let nextQuality = existing.quality
    let nextQuantity = existing.quantity + ret.quantity
    if (existing.quantity > 0) {
      const total = existing.quantity + ret.quantity
      nextQuality = Math.round(
        (existing.quality * existing.quantity + ret.quality * ret.quantity) /
          total,
      )
    } else {
      nextQuality = ret.quality
    }
    ctx.modifyStock(
      ret.ingredientId,
      { quantity: nextQuantity, quality: nextQuality },
      {
        source: 'expedition.haul',
        sourceType: 'system',
        direction: 'increase',
        amount: ret.quantity,
        readable: `Expedition ${expeditionId} returned ${ret.quantity} ${ret.ingredientId} at quality ${ret.quality}.`,
        tags: ['expedition', 'haul', ret.ingredientId, expeditionId],
        relatedActors: [{ kind: 'stock', id: ret.ingredientId }],
        relatedSystems: ['expeditions', 'stock'],
      },
    )
  }
}

function applyRunnerUpdate(
  ctx: SimContext,
  runner: HireableAdventurer,
  outcome: ExpeditionOutcome,
  expeditionId: string,
  // Expansion Phase 9 §9.3 — hurt ON THE ROAD, as distinct from the trip
  // having failed. A party can come back successful with somebody limping,
  // and the roster should say so.
  injuredOnTheRoad = false,
): void {
  if (outcome === 'runner_lost') {
    ctx.removeHireableAdventurer(runner.id, {
      source: 'expedition.runner_lost',
      sourceType: 'system',
      direction: 'decrease',
      amount: -1,
      readable: `${runner.name.display} did not return from expedition ${expeditionId}.`,
      tags: ['expedition', 'runner_lost', expeditionId, runner.id],
      relatedActors: [{ kind: 'other', id: runner.id }],
      relatedSystems: ['expeditions', 'adventurers'],
    })
    return
  }
  const clamp = (n: number) => Math.max(0, Math.min(100, n))
  let experience = runner.experience
  let reliability = runner.reliability
  let relationship = runner.relationship
  // Phase 77 / ISSUE-037 — `activeFlags` records short-term recovery
  // state. A failed expedition leaves the runner `injured`, which
  // `commissionExpedition.getValidTargets` filters out of the
  // hireable pool. The adventurers weekly drift hook clears the flag
  // after enough idle time.
  let nextFlags = [...runner.activeFlags]
  if (outcome === 'success') {
    experience = clamp(experience + 5)
    reliability = clamp(reliability + 5)
    relationship = clamp(relationship + 5)
    // A successful outing burns off any prior injury marker.
    nextFlags = nextFlags.filter((f) => f !== 'injured')
  } else if (outcome === 'partial') {
    experience = clamp(experience + 3)
    reliability = clamp(reliability + 1)
    relationship = clamp(relationship + 2)
  } else if (outcome === 'recalled' || outcome === 'retreated') {
    // Coming home when told to, or knowing when to stop, is not a failing.
    // Nothing is learned and nothing is lost.
    relationship = clamp(relationship + 1)
  } else {
    // failure
    reliability = clamp(reliability - 5)
    if (!nextFlags.includes('injured')) nextFlags.push('injured')
  }
  if (injuredOnTheRoad && !nextFlags.includes('injured')) {
    nextFlags.push('injured')
  }
  ctx.modifyHireableAdventurer(
    runner.id,
    {
      experience,
      reliability,
      relationship,
      daysSinceLastJob: 0,
      currentExpeditionId: null,
      activeFlags: nextFlags,
    },
    {
      source: 'expedition.runner_update',
      sourceType: 'system',
      readable: `${runner.name.display} returned from expedition ${expeditionId} (${outcome}).`,
      tags: ['expedition', 'runner_update', outcome, expeditionId, runner.id],
      relatedActors: [{ kind: 'other', id: runner.id }],
      relatedSystems: ['expeditions', 'adventurers'],
    },
  )
}

function applyRenownEffect(
  ctx: SimContext,
  expedition: Expedition,
  runner: HireableAdventurer,
  outcome: ExpeditionOutcome,
): void {
  const tier = rarityForExpedition(expedition)
  if (outcome === 'success') {
    const tierBoost: Record<ExpeditionTargetTier, number> = {
      uncommon: 2,
      rare: 4,
      legendary: 7,
    }
    applyRenownDrift(ctx, tierBoost[tier], {
      source: 'expedition.renown',
      readable: `Expedition ${expedition.id} returned successfully — renown rises.`,
      tags: ['renown', 'expedition_success', tier, expedition.id],
      relatedActors: [
        { kind: 'other', id: runner.id },
      ],
      relatedSystems: ['expeditions'],
    })
  } else if (outcome === 'runner_lost' && runner.relationship > 60) {
    applyRenownDrift(ctx, -4, {
      source: 'expedition.renown',
      readable: `Losing ${runner.name.display} cast a long shadow over the tavern's renown.`,
      tags: ['renown', 'runner_lost', expedition.id, runner.id],
      relatedActors: [
        { kind: 'other', id: runner.id },
      ],
      relatedSystems: ['expeditions'],
    })
  }
}

function memoryKeyForOutcome(outcome: ExpeditionOutcome): string {
  if (outcome === 'success' || outcome === 'partial') {
    return 'expedition_success'
  }
  if (outcome === 'runner_lost') return 'runner_lost'
  return 'expedition_failure'
}

function writeOutcomeMemory(
  ctx: SimContext,
  expedition: Expedition,
  runner: HireableAdventurer,
  outcome: ExpeditionOutcome,
  returned: ExpeditionReturnedIngredient[],
): void {
  const memoryId = memoryKeyForOutcome(outcome)
  ctx.addMemory({
    id: memoryId,
    source: 'expedition.resolve',
    actors: [{ kind: 'other', id: runner.id }],
    tags: ['expedition', outcome, expedition.id, runner.id],
    metadata: {
      expeditionId: expedition.id,
      runnerId: runner.id,
      runnerName: runner.name.display,
      mode: expedition.mode,
      targetTier: expedition.targetTier,
      targetIngredientId: expedition.targetIngredientId,
      outcome,
      returnedIngredients: returned,
    },
  })
}

/**
 * Expansion Phase 9 §9.3 — the daily pass.
 *
 * Phase 70's tick added one to `daysElapsed` and, on the last day, made a
 * single roll that decided the entire trip. What runs now is a JOURNEY:
 * each expedition walks a leg, eats, may meet something, may be asked a
 * question, may be hurt, delayed, turned back, recalled or lost — and only
 * resolves when the party is actually home or actually gone.
 *
 * `daysElapsed` is still maintained, because the report, the commission
 * form and the existing tests all read it. It is now a description of how
 * long they have been out rather than the thing that decides anything.
 */
const startDayHook: SimulationHook = (ctx: SimContext): void => {
  if (ctx.state.expeditions.active.length === 0) return
  for (const expedition of [...ctx.state.expeditions.active]) {
    updateActiveExpedition(ctx, expedition.id, {
      daysElapsed: expedition.daysElapsed + 1,
    })

    const run = getExpeditionRun(ctx.state, expedition.id)
    if (!run) {
      // No run record — an expedition commissioned before this phase, or a
      // fixture built by hand. Fall back to the Phase 70 behaviour so the
      // trip still ends rather than running forever.
      resolveLegacyExpedition(ctx, expedition)
      continue
    }

    advanceExpeditionDay(ctx, expedition)

    const after = getExpeditionRun(ctx.state, expedition.id)
    if (!after) continue
    // A party that walked back through the door is known about the moment
    // they arrive. A party that was LOST is not: `checkTrouble` queues a
    // terminal dispatch that travels at the route's speed, and finishing
    // the expedition before it lands took the trip off the active list,
    // wrote `runner_lost` into recent resolutions and struck the runners
    // off the roster — the house learning the worst days before the message
    // could reach it, through the one boundary this module is careful about
    // everywhere else.
    const today = ctx.state.calendar.totalDaysElapsed
    const wordIsHome =
      after.terminal !== 'lost' ||
      after.dispatches.some(
        (dispatch) => dispatch.kind === 'terminal' && dispatch.arrivesOnDay <= today,
      )
    const done = (after.terminal !== undefined || after.phase === 'home') && wordIsHome
    if (!done) continue

    finishExpedition(ctx, expedition)
  }
}

/** Bring a party in and settle up. */
function finishExpedition(ctx: SimContext, expedition: Expedition): void {
  const run = getExpeditionRun(ctx.state, expedition.id)
  if (!run) return

  // A party that got home having been recalled or having turned back is
  // recorded as such rather than as a failure — somebody made a call, and
  // the record should say who.
  // A recall beats a retreat when both happened: the house's order is what
  // actually brought them in, whatever the party had already decided.
  const terminal =
    run.terminal ??
    (run.recalledOnDay !== undefined
      ? 'recalled'
      : run.retreatedOnDay !== undefined
        ? 'retreated'
        : 'returned')
  if (run.terminal === undefined) {
    writeExpeditionsSlice(
      ctx,
      (current) => {
        const held = current.runs[expedition.id]
        if (!held) return current
        return {
          ...current,
          runs: { ...current.runs, [expedition.id]: { ...held, terminal } },
        }
      },
      'home',
    )
  }
  const finished = getExpeditionRun(ctx.state, expedition.id)!
  // One recorded fact, not a reconstruction from the event log.
  const atSite = finished.reachedSiteOnDay !== undefined
  const outcome = outcomeFor(finished)
  const haul = buildHaul(expedition, finished, outcome, atSite)

  if (haul.length > 0) writeIngredientsToStock(ctx, haul, expedition.id)

  // CAPTURED BEFORE THE PARTY IS TOUCHED. On `runner_lost` the loop below
  // removes every member from the roster, the leader included, so looking
  // them up afterwards returned `undefined` — and the two consequences that
  // need the leader were silently skipped: no memory of the trip was
  // written, and `applyRenown` could not apply the loss penalty, which is
  // scaled by how well the house knew them. The legacy single-runner path
  // kept both, so a lost party lost less than a lost runner.
  const leader = ctx.state.world.hireableAdventurers[expedition.runnerId]

  for (const runnerId of finished.partyRunnerIds) {
    const runner = ctx.state.world.hireableAdventurers[runnerId]
    if (!runner) continue
    applyRunnerUpdate(
      ctx,
      runner,
      outcome === 'runner_lost' ? 'runner_lost' : outcome,
      expedition.id,
      finished.injuredRunnerIds.includes(runnerId),
    )
  }

  settleTerms(ctx, finished, outcome, haulValue(haul))
  closeRecord(ctx, expedition, finished, outcome, haul)
  if (leader) writeOutcomeMemory(ctx, expedition, leader, outcome, haul)
  applyRenown(ctx, finished, leader, outcome)
  applyWorldEffects(ctx, finished, outcome, haul, atSite)
}

/** The Phase 70 end-only roll, for an expedition with no run record. */
function resolveLegacyExpedition(ctx: SimContext, expedition: Expedition): void {
  const daysElapsed = expedition.daysElapsed + 1
  if (daysElapsed < expedition.daysTotal) return
  const today = ctx.state.calendar.totalDaysElapsed + 1
  const runner = ctx.state.world.hireableAdventurers[expedition.runnerId]
  if (!runner) {
    resolveExpedition(ctx, expedition.id, {
      id: expedition.id,
      runnerId: expedition.runnerId,
      mode: expedition.mode,
      targetTier: expedition.targetTier,
      targetIngredientId: expedition.targetIngredientId,
      daysTotal: expedition.daysTotal,
      costPaid: expedition.costPaid,
      startedDay: expedition.startedDay,
      resolvedDay: today,
      outcome: 'failure',
      returnedIngredients: [],
    })
    return
  }
  const rng = expeditionStream(expedition, `expedition_${expedition.id}`)
  const outcome = rollOutcome(rng, runner, { ...expedition, daysElapsed })
  const returned = buildReturnedIngredients(ctx, expedition, outcome)
  if (returned.length > 0) writeIngredientsToStock(ctx, returned, expedition.id)
  applyRunnerUpdate(ctx, runner, outcome, expedition.id, false)
  resolveExpedition(ctx, expedition.id, {
    id: expedition.id,
    runnerId: expedition.runnerId,
    mode: expedition.mode,
    targetTier: expedition.targetTier,
    targetIngredientId: expedition.targetIngredientId,
    daysTotal: expedition.daysTotal,
    costPaid: expedition.costPaid,
    startedDay: expedition.startedDay,
    resolvedDay: today,
    outcome,
    returnedIngredients: returned,
  })
  writeOutcomeMemory(ctx, expedition, runner, outcome, returned)
  applyRenownEffect(ctx, expedition, runner, outcome)
}

/** §5.11 — prune the closed tail of the run book. */
const endDayHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getExpeditionsModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const resolvedDayFor = new Map(
    ctx.state.expeditions.completed.map((record) => [record.id, record.resolvedDay]),
  )
  const pruned = pruneExpeditionRuns(slice.runs, today, (run) =>
    resolvedDayFor.get(run.expeditionId),
  )
  if (Object.keys(pruned).length === Object.keys(slice.runs).length) return
  writeExpeditionsSlice(ctx, (current) => ({ ...current, runs: pruned }), 'prune')
}

function buildExpeditionsReport(ctx: SimContext): ReportSection {
  const slice = ctx.state.expeditions
  const today = ctx.state.calendar.totalDaysElapsed
  const lines: string[] = []

  if (slice.active.length === 0) {
    lines.push('No active expeditions.')
  } else {
    for (const e of slice.active) {
      const run = getExpeditionRun(ctx.state, e.id)
      const route = run ? routeFor(run.routeId) : undefined
      if (!run || !route) {
        lines.push(
          `${e.id} — ${e.mode} (${e.targetTier ?? e.targetIngredientId ?? '—'}) day ${e.daysElapsed}/${e.daysTotal} runner=${e.runnerId}`,
        )
        continue
      }
      // Expansion Phase 9 §9.3 — what the house KNOWS, which is not the same
      // as what is happening. Position and condition come from dispatches
      // that have actually arrived; anything still on the road is reported
      // as being on the road, not as fact.
      lines.push(
        `${route.label} — ${run.partyRunnerIds.length === 1 ? 'one runner' : `${run.partyRunnerIds.length} runners`}, out ${e.daysElapsed} day(s) of about ${e.daysTotal}`,
      )
      const arrived = arrivedDispatches(run, today)
      const latest = arrived[arrived.length - 1]
      lines.push(`  last word: ${latest ? latest.readable : 'none yet'}`)
      const inTransit = dispatchesInTransit(run, today)
      if (inTransit.length > 0) {
        lines.push(`  ${inTransit.length} message(s) still on the road.`)
      }
      if (run.pendingDecision) {
        // ONLY ONCE THE MESSAGE HAS ARRIVED. `pendingDecision` is written
        // the day the party asks, so printing it straight away told the
        // player exactly what a party four days out wanted days before the
        // tavern could have heard — the report's own knowledge boundary,
        // which the rest of this section keeps, broken by the one line that
        // matters most. The action was already gated; the report was not.
        const askedReached =
          run.pendingDecision.askedOnDay + route.wordDelayDays <= today
        if (askedReached) {
          lines.push(
            `  THEY ARE WAITING ON AN ANSWER: ${run.pendingDecision.prompt} (they act on day ${run.pendingDecision.deadlineDay})`,
          )
          lines.push(`  options: ${run.pendingDecision.optionIds.join(', ')}`)
          if (run.pendingAnswer) {
            lines.push(
              `  the house's answer is on the road; it reaches them on day ${run.pendingAnswer.reachesOnDay}.`,
            )
          }
        } else {
          lines.push('  something happened out there; word has not reached the house yet.')
        }
      }
      if (run.reliefReachesOnDay !== undefined && run.reliefArrivedOnDay === undefined) {
        lines.push(`  relief is on the road; it reaches them on day ${run.reliefReachesOnDay}.`)
      }
      if (run.recalledOnDay !== undefined) {
        const reaches = run.recallReachesOnDay ?? run.recalledOnDay
        lines.push(
          today >= reaches
            ? `  recalled on day ${run.recalledOnDay}; on their way back.`
            : `  recalled on day ${run.recalledOnDay}; the order reaches them on day ${reaches}.`,
        )
      }
      if (run.injuredRunnerIds.length > 0) {
        lines.push(`  ${run.injuredRunnerIds.length} hurt.`)
      }
    }
  }

  const runs = liveExpeditionRuns(ctx.state)
  if (runs.length > 0) {
    const known = getExpeditionsModuleState(ctx.state).knownDiscoveries
    if (known.length > 0) {
      lines.push('')
      lines.push(`Known ways: ${known.map((k) => k.replace(/_/g, ' ')).join(', ')}`)
    }
  }

  if (slice.completed.length > 0) {
    const recent = slice.completed.slice(-5)
    lines.push('')
    lines.push('Recent resolutions:')
    for (const r of recent) {
      lines.push(
        `${r.id} → ${r.outcome} on day ${r.resolvedDay} (runner ${r.runnerId})`,
      )
    }
  }
  return {
    id: EXPEDITIONS_MODULE_ID,
    source: EXPEDITIONS_MODULE_ID,
    title: 'Expeditions',
    lines,
    data: {
      active: slice.active.length,
      awaitingAnswer: runs.filter((run) => run.pendingDecision !== undefined).length,
      wordInTransit: runs.reduce(
        (sum, run) => sum + dispatchesInTransit(run, today).length,
        0,
      ),
      knownDiscoveries: getExpeditionsModuleState(ctx.state).knownDiscoveries,
    },
  }
}

// Expansion Phase 9 §9.3 — the slice was an empty passthrough because the
// module had no state of its own. It now carries the run book: the route,
// party, loadout and terms of every trip, its position, condition, event log,
// pending question and dispatch queue, plus what the house has learned.
const ExpeditionsModuleStateSchema = ExpeditionsRunSchema

// Compile-time hint that StockRarity is still part of the slice
// contract — referenced by `targetTierBaseSuccess`. The unused-export
// is intentional; future polish may consume it from outside.
void (null as unknown as StockRarity)

export const expeditionsModule: SimulationModule = {
  id: EXPEDITIONS_MODULE_ID,
  version: '0.2.0',
  // The module depends on `adventurers` because resolution writes back
  // to the hireable roster (runner stats / runner_lost removal). It
  // depends on `stock` because successful hauls land ingredients in
  // stock with quality blending.
  dependsOn: ['stock', 'adventurers'],
  hooks: {
    startDay: [startDayHook],
    endDay: [endDayHook],
  },
  buildReport: buildExpeditionsReport,
  stateSchema: ExpeditionsModuleStateSchema,
}
