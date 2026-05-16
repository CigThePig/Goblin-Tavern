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
import type { SimRng } from '../../core/rng'
import { applyRenownDrift } from '../service/renown'
import { resolveExpedition, updateActiveExpedition } from './state'

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

export const EXPEDITIONS_MODULE_ID = 'expeditions'

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
  const qualityRng = ctx.getRngStreamByName(
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
  if (outcome === 'success') {
    experience = clamp(experience + 5)
    reliability = clamp(reliability + 5)
    relationship = clamp(relationship + 5)
  } else if (outcome === 'partial') {
    experience = clamp(experience + 3)
    reliability = clamp(reliability + 1)
    relationship = clamp(relationship + 2)
  } else {
    // failure
    reliability = clamp(reliability - 5)
  }
  ctx.modifyHireableAdventurer(
    runner.id,
    {
      experience,
      reliability,
      relationship,
      daysSinceLastJob: 0,
      currentExpeditionId: null,
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

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  if (ctx.state.expeditions.active.length === 0) return
  const active = [...ctx.state.expeditions.active]
  for (const expedition of active) {
    const nextDaysElapsed = expedition.daysElapsed + 1
    updateActiveExpedition(ctx, expedition.id, {
      daysElapsed: nextDaysElapsed,
    })
    if (nextDaysElapsed < expedition.daysTotal) continue

    // Resolve.
    const runner = ctx.state.world.hireableAdventurers[expedition.runnerId]
    if (!runner) {
      // Runner has been removed (e.g. by a prior runner_lost). Drop
      // the expedition without resolving.
      const today = ctx.state.calendar.totalDaysElapsed + 1
      const record: ExpeditionRecord = {
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
      }
      resolveExpedition(ctx, expedition.id, record)
      continue
    }
    const rng = ctx.getRngStreamByName(`expedition_${expedition.id}`)
    const outcome = rollOutcome(rng, runner, {
      ...expedition,
      daysElapsed: nextDaysElapsed,
    })
    const returned = buildReturnedIngredients(ctx, expedition, outcome)
    const today = ctx.state.calendar.totalDaysElapsed + 1
    const record: ExpeditionRecord = {
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
    }
    // Order: write ingredients first (so stock causes show the
    // proximate effect), then update the runner, then move the
    // expedition into the completed log, then memory + renown.
    if (returned.length > 0) {
      writeIngredientsToStock(ctx, returned, expedition.id)
    }
    applyRunnerUpdate(ctx, runner, outcome, expedition.id)
    resolveExpedition(ctx, expedition.id, record)
    writeOutcomeMemory(ctx, expedition, runner, outcome, returned)
    applyRenownEffect(ctx, expedition, runner, outcome)
  }
}

function buildExpeditionsReport(ctx: SimContext): ReportSection {
  const slice = ctx.state.expeditions
  const lines: string[] = []
  if (slice.active.length === 0) {
    lines.push('No active expeditions.')
  } else {
    for (const e of slice.active) {
      lines.push(
        `${e.id} — ${e.mode} (${e.targetTier ?? e.targetIngredientId ?? '—'}) day ${e.daysElapsed}/${e.daysTotal} runner=${e.runnerId}`,
      )
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
  }
}

const ExpeditionsModuleStateSchema = z
  .object({})
  .passthrough()
  .optional()

// Compile-time hint that StockRarity is still part of the slice
// contract — referenced by `targetTierBaseSuccess`. The unused-export
// is intentional; future polish may consume it from outside.
void (null as unknown as StockRarity)

export const expeditionsModule: SimulationModule = {
  id: EXPEDITIONS_MODULE_ID,
  version: '0.1.0',
  // The module depends on `adventurers` because resolution writes back
  // to the hireable roster (runner stats / runner_lost removal). It
  // depends on `stock` because successful hauls land ingredients in
  // stock with quality blending.
  dependsOn: ['stock', 'adventurers'],
  hooks: {
    startDay: [startDayHook],
  },
  buildReport: buildExpeditionsReport,
  stateSchema: ExpeditionsModuleStateSchema,
}
