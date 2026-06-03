import type { SimContext } from '../../core/context'
import { stockRegistry } from '../../registries/stockRegistry'
import type {
  Expedition,
  ExpeditionMode,
  ExpeditionTargetTier,
} from '../../state/TavernState'
import { addExpedition } from './state'
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

function readDaysTotal(input: OwnerActionInput): number | null {
  const opt = input.options?.['daysTotal']
  if (typeof opt !== 'number' || !Number.isFinite(opt)) return null
  if (!Number.isInteger(opt) || opt < 1) return null
  return opt
}

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
  getValidTargets: (ctx: SimContext) => {
    return Object.values(ctx.state.world.hireableAdventurers)
      .filter(
        (a) =>
          a.currentExpeditionId === null &&
          !a.activeFlags.includes('injured'),
      )
      .map((a) => ({
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
    const daysTotal = readDaysTotal(input)
    if (daysTotal === null) {
      return {
        ok: false,
        code: 'invalid_days_total',
        reason: 'commission_expedition requires options.daysTotal as a positive integer.',
      }
    }
    if (mode === 'open') {
      const tier = readTargetTier(input)
      if (!tier) {
        return {
          ok: false,
          code: 'invalid_target_tier',
          reason: 'Open expeditions require options.targetTier (uncommon/rare/legendary).',
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
    }
    const cost = computeCost(runner, daysTotal)
    if (ctx.state.coin < cost) {
      return {
        ok: false,
        code: 'insufficient_coin',
        reason: `Need ${cost} coin (wage ${runner.wageBase}/day × ${daysTotal}d) to commission this expedition; have ${ctx.state.coin}.`,
      }
    }
    return { ok: true }
  },
  apply: (ctx, input) => {
    const runner = ctx.state.world.hireableAdventurers[input.targetId!]!
    const mode = readMode(input)!
    const daysTotal = readDaysTotal(input)!
    const cost = computeCost(runner, daysTotal)
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

    // Reflect the assignment on the runner so other modules can see
    // they're unavailable.
    ctx.modifyHireableAdventurer(
      runner.id,
      { currentExpeditionId: expedition.id, daysSinceLastJob: 0 },
      {
        source: 'expedition.commission',
        sourceType: 'system',
        readable: `${runner.name.display} commissioned for expedition ${expedition.id}.`,
        tags: ['expedition', 'commission', expedition.id, runner.id],
        relatedActors: [{ kind: 'other', id: runner.id }],
        relatedSystems: ['expeditions', 'adventurers'],
      },
    )

    ctx.addHistory({
      category: 'owner_action',
      summary: `Commissioned ${runner.name.display} for a ${mode} expedition (${
        targetTier ?? targetIngredientId
      }) over ${daysTotal} days.`,
      tags: ['expedition', 'commission', expedition.id],
      relatedActors: [{ kind: 'other', id: runner.id }],
      relatedSystems: ['expeditions'],
      mechanicalRefs: [COMMISSION_EXPEDITION_ACTION_ID],
    })

    const effects: string[] = [
      `Commissioned ${runner.name.display} (${mode} mode, ${daysTotal}-day run).`,
      `Spent ${cost} coin up front.`,
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
        mode,
        targetTier,
        targetIngredientId,
        daysTotal,
        costPaid: cost,
      },
    }
  },
}
