import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'
import {
  areaLabel,
  checkUpgradeEligibility,
  listCatalogueForArea,
  quoteAreaUpgrade,
  type AreaUpgradeQuote,
} from '../areas/quote'
import { getMaxConcurrentSites, listActiveSites } from '../areas/labour'
import {
  cancelUpgrade,
  fundUpgrade,
  pauseUpgrade,
  repairUpgrade,
  resumeUpgrade,
  serviceUpgrade,
  startUpgrade,
} from '../areas/construction'

import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
  TIME_COST_STANDARD,
} from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerActionInput,
} from './types'

// Expansion Phase 2 §2.2 / §"Player-facing work" — the OBL-01 capability.
//
// Eighteen upgrades were catalogued and none could be installed, because no
// owner action existed to install one. These seven do, and they cover the whole
// lifecycle the plan lists: start, fund, pause, resume, cancel, repair, and
// service (completion happens autonomously once the labour is banked).
//
// TARGET ENCODING. Each action targets `"<areaId>:<upgradeId>"`. The generic
// two-level picker can enumerate a flat list of composite targets, so these
// actions need no bespoke composer — and every target carries the quote in its
// `hint`, which is what makes them DISCOVERABLE rather than merely reachable.
//
// OWNERSHIP. Nothing here writes an upgrade record. Every apply asks the areas
// module's construction layer to make the transition (§5.4), so the owner
// action is the player's request and the `areas` domain is the authority.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** `"<areaId>:<upgradeId>"` → its parts. */
export function parseUpgradeTarget(
  targetId: string | undefined,
): { areaId: string; upgradeId: string } | undefined {
  if (!targetId) return undefined
  const split = targetId.indexOf(':')
  if (split <= 0) return undefined
  const areaId = targetId.slice(0, split)
  const upgradeId = targetId.slice(split + 1)
  if (!areaId || !upgradeId) return undefined
  return { areaId, upgradeId }
}

export function upgradeTargetId(areaId: string, upgradeId: string): string {
  return `${areaId}:${upgradeId}`
}

/** The one place the quote's owner-time inputs come from. */
function quoteFor(
  state: TavernState,
  areaId: string,
  upgradeId: string,
): AreaUpgradeQuote | undefined {
  return quoteAreaUpgrade(state, areaId, upgradeId, {
    startMinutes: TIME_COST_STANDARD,
    fundMinutes: TIME_COST_SHORT,
  })
}

function describeQuote(quote: AreaUpgradeQuote): string {
  const parts = [`${quote.coin} coin`]
  if (quote.materials.length > 0) {
    parts.push(
      quote.materials
        .map((line) => `${line.required} ${line.label} (${line.held} held)`)
        .join(' + '),
    )
  }
  parts.push(`${quote.labourRequired} labour`)
  parts.push(
    Number.isFinite(quote.expectedDays)
      ? `~${quote.expectedDays}d at current pace`
      : 'no labour available',
  )
  return parts.join(', ')
}

// ---------- start_area_upgrade ----------

/**
 * Every (area, upgrade) pair the catalogue permits and the player could start.
 *
 * Ineligible pairs are dropped rather than listed disabled: an upgrade already
 * installed, already building, or belonging in a different room is not a choice
 * the player is weighing. Pairs that are eligible but UNAFFORDABLE stay in the
 * list with their price in the hint, because that is a choice — save up, or buy
 * the timber first.
 */
function listStartableUpgrades(ctx: SimContext): ActionTarget[] {
  const targets: ActionTarget[] = []
  for (const area of Object.values(ctx.state.areas).sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    for (const def of listCatalogueForArea(area)) {
      if (!checkUpgradeEligibility(ctx.state, area.id, def.id).ok) continue
      const quote = quoteFor(ctx.state, area.id, def.id)
      if (!quote) continue
      targets.push({
        id: upgradeTargetId(area.id, def.id),
        label: `${def.label} — ${area.label}`,
        hint: describeQuote(quote),
      })
    }
  }
  return targets
}

const startAreaUpgrade: OwnerActionDefinition = {
  id: 'start_area_upgrade',
  label: 'Start Upgrade',
  category: 'project',
  tags: ['area', 'upgrade', 'construction', 'project'],
  effectsPreview: 'Begins building an area upgrade; costs coin, materials and labour',
  pressureAffinity: ['maintenance'],
  targetType: 'area',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: listStartableUpgrades,
  // A player can always *open* the planner: even with nothing affordable, the
  // list is how they learn what a booth costs.
  canOpen: (ctx) =>
    listStartableUpgrades(ctx).length > 0
      ? OK
      : reject(
          'nothing_startable',
          'Every upgrade these rooms allow is already installed or under way',
        ),
  canApply: (ctx, input) => {
    const parsed = parseUpgradeTarget(input.targetId)
    if (!parsed) {
      return reject(
        'missing_target',
        'start_area_upgrade needs a target of the form <area>:<upgrade>',
      )
    }
    const eligibility = checkUpgradeEligibility(
      ctx.state,
      parsed.areaId,
      parsed.upgradeId,
    )
    if (!eligibility.ok) return reject(eligibility.code, eligibility.reason)
    const quote = quoteFor(ctx.state, parsed.areaId, parsed.upgradeId)
    if (!quote) return reject('unknown_target', `Unknown upgrade '${input.targetId}'`)
    if (!quote.affordability.ok) {
      return reject(quote.affordability.code, quote.affordability.reason)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const quote = quoteFor(ctx.state, parsed.areaId, parsed.upgradeId)!
    const result = startUpgrade(ctx, quote)
    return {
      actionId: startAreaUpgrade.id,
      label: `Started ${quote.label} in ${quote.areaLabel}`,
      targetId: input.targetId!,
      targetLabel: `${quote.label} — ${quote.areaLabel}`,
      timeCost: TIME_COST_STANDARD,
      effects: result?.effects ?? ['nothing changed'],
      data: {
        areaId: parsed.areaId,
        upgradeId: parsed.upgradeId,
        // The quote the player was shown, recorded alongside what was charged,
        // so the report can prove they agreed (required test: quote and
        // authoritative cost agreement).
        quoted: {
          coin: quote.coin,
          labour: quote.labourRequired,
          materials: quote.materials.map((line) => ({
            stockId: line.stockId,
            quantity: line.required,
          })),
          expectedDays: Number.isFinite(quote.expectedDays)
            ? quote.expectedDays
            : null,
        },
        coin: { spent: result?.coinSpent ?? 0 },
        materialsUsed: result?.materialsUsed ?? {},
      },
    }
  },
}

// ---------- shared target enumerators for live records ----------

function listRecordsByStatus(
  ctx: SimContext,
  statuses: ReadonlyArray<string>,
  hint: (args: {
    areaId: string
    upgradeId: string
    progress: number
    required: number
    condition: number
    overdueDays: number
  }) => string,
): ActionTarget[] {
  const today = ctx.state.calendar.totalDaysElapsed
  const targets: ActionTarget[] = []
  for (const area of Object.values(ctx.state.areas).sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    for (const record of Object.values(area.upgrades).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      if (!statuses.includes(record.status)) continue
      const def = getAreaUpgradeDefinition(record.id)
      targets.push({
        id: upgradeTargetId(area.id, record.id),
        label: `${def?.label ?? record.id} — ${area.label}`,
        hint: hint({
          areaId: area.id,
          upgradeId: record.id,
          progress: record.progress ?? 0,
          required: record.requiredProgress ?? 0,
          condition: record.condition ?? 100,
          overdueDays:
            record.upkeepDueDay === undefined ? 0 : today - record.upkeepDueDay,
        }),
      })
    }
  }
  return targets
}

function requireRecord(
  ctx: SimContext,
  input: OwnerActionInput,
  statuses: ReadonlyArray<string>,
  wrongStatusCode: string,
): ActionValidationResult {
  const parsed = parseUpgradeTarget(input.targetId)
  if (!parsed) {
    return reject('missing_target', 'This action needs an <area>:<upgrade> target')
  }
  const record = ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]
  if (!record) {
    return reject('unknown_target', `No upgrade record for '${input.targetId}'`)
  }
  if (!statuses.includes(record.status)) {
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    return reject(
      wrongStatusCode,
      `${def?.label ?? parsed.upgradeId} is ${record.status.replace(/_/g, ' ')}`,
    )
  }
  return OK
}

// ---------- fund_area_upgrade ----------

const FUND_COIN = 5

const fundAreaUpgrade: OwnerActionDefinition = {
  id: 'fund_area_upgrade',
  label: 'Work The Site',
  category: 'project',
  tags: ['area', 'upgrade', 'construction', 'fund'],
  effectsPreview: 'Spends an owner shift and coin to push a build forward',
  targetType: 'area',
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) =>
    listRecordsByStatus(ctx, ['in_progress'], ({ progress, required }) =>
      `${progress}/${required} labour, ${FUND_COIN} coin`,
    ),
  canApply: (ctx, input) => {
    const verdict = requireRecord(ctx, input, ['in_progress'], 'not_building')
    if (!verdict.ok) return verdict
    if (ctx.state.coin < FUND_COIN) {
      return reject(
        'insufficient_coin',
        `A shift on the site costs ${FUND_COIN} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const before =
      ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]?.progress ?? 0
    const result = fundUpgrade(
      ctx,
      parsed.areaId,
      parsed.upgradeId,
      FUND_COIN,
      TIME_COST_SHORT,
    )
    return {
      actionId: fundAreaUpgrade.id,
      label: `Worked on ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_SHORT,
      effects: [
        `labour ${before} → ${result?.progress ?? before}/${result?.requiredProgress ?? 0}`,
        `coin -${FUND_COIN}`,
      ],
      data: {
        areaId: parsed.areaId,
        upgradeId: parsed.upgradeId,
        progress: { before, after: result?.progress ?? before },
        coin: { spent: FUND_COIN },
      },
    }
  },
}

// ---------- pause_area_upgrade ----------

const pauseAreaUpgrade: OwnerActionDefinition = {
  id: 'pause_area_upgrade',
  label: 'Pause Build',
  category: 'project',
  tags: ['area', 'upgrade', 'construction', 'pause'],
  effectsPreview: 'Stops work and reopens the room; progress is kept',
  targetType: 'area',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    listRecordsByStatus(ctx, ['in_progress'], ({ progress, required }) =>
      `${progress}/${required} labour kept`,
    ),
  canApply: (ctx, input) => requireRecord(ctx, input, ['in_progress'], 'not_building'),
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const record = ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]
    pauseUpgrade(ctx, parsed.areaId, parsed.upgradeId)
    return {
      actionId: pauseAreaUpgrade.id,
      label: `Paused ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_QUICK,
      effects: [
        `paused at ${record?.progress ?? 0}/${record?.requiredProgress ?? 0} labour`,
        'the room is back in use',
      ],
      data: { areaId: parsed.areaId, upgradeId: parsed.upgradeId },
    }
  },
}

// ---------- resume_area_upgrade ----------

const resumeAreaUpgrade: OwnerActionDefinition = {
  id: 'resume_area_upgrade',
  label: 'Resume Build',
  category: 'project',
  tags: ['area', 'upgrade', 'construction', 'resume'],
  effectsPreview: 'Puts a paused build back on the crew’s list',
  targetType: 'area',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    listRecordsByStatus(ctx, ['paused'], ({ progress, required }) =>
      `${progress}/${required} labour banked`,
    ),
  canApply: (ctx, input) => {
    const verdict = requireRecord(ctx, input, ['paused'], 'not_paused')
    if (!verdict.ok) return verdict
    // Resuming can push past the concurrency limit, which starting cannot —
    // so the limit is checked here too rather than only at the start.
    const limit = getMaxConcurrentSites(ctx.state)
    if (listActiveSites(ctx.state).length >= limit) {
      return reject(
        'no_free_crew',
        `Already running ${limit} site${limit === 1 ? '' : 's'} — pause one first`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const record = ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]
    resumeUpgrade(ctx, parsed.areaId, parsed.upgradeId)
    return {
      actionId: resumeAreaUpgrade.id,
      label: `Resumed ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_QUICK,
      effects: [
        `back on the list at ${record?.progress ?? 0}/${record?.requiredProgress ?? 0} labour`,
      ],
      data: { areaId: parsed.areaId, upgradeId: parsed.upgradeId },
    }
  },
}

// ---------- cancel_area_upgrade ----------

const cancelAreaUpgrade: OwnerActionDefinition = {
  id: 'cancel_area_upgrade',
  label: 'Abandon Build',
  category: 'project',
  tags: ['area', 'upgrade', 'construction', 'cancel'],
  effectsPreview: 'Gives up on a build; coin and materials already used are lost',
  targetType: 'area',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    listRecordsByStatus(ctx, ['in_progress', 'paused'], ({ progress, required }) =>
      `${progress}/${required} labour written off`,
    ),
  canApply: (ctx, input) =>
    requireRecord(ctx, input, ['in_progress', 'paused'], 'not_building'),
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const record = ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]
    cancelUpgrade(ctx, parsed.areaId, parsed.upgradeId)
    return {
      actionId: cancelAreaUpgrade.id,
      label: `Abandoned ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_QUICK,
      effects: [
        `${record?.coinInvested ?? 0} coin and ${record?.progress ?? 0} labour written off`,
      ],
      data: {
        areaId: parsed.areaId,
        upgradeId: parsed.upgradeId,
        writtenOff: {
          coin: record?.coinInvested ?? 0,
          labour: record?.progress ?? 0,
          materials: record?.materialsUsed ?? {},
        },
      },
    }
  },
}

// ---------- repair_area_upgrade ----------

function repairCoinFor(upgradeId: string): number {
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!def) return 0
  return def.repairCoin ?? Math.max(1, Math.round(def.costCoin * 0.3))
}

const repairAreaUpgrade: OwnerActionDefinition = {
  id: 'repair_area_upgrade',
  label: 'Repair Fitting',
  category: 'immediate',
  tags: ['area', 'upgrade', 'repair', 'maintenance'],
  effectsPreview: 'Puts a broken fitting back into service',
  pressureAffinity: ['maintenance'],
  targetType: 'area',
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) =>
    listRecordsByStatus(ctx, ['damaged', 'disabled'], ({ upgradeId, condition }) =>
      `condition ${condition}, ${repairCoinFor(upgradeId)} coin`,
    ),
  canApply: (ctx, input) => {
    const verdict = requireRecord(ctx, input, ['damaged', 'disabled'], 'not_broken')
    if (!verdict.ok) return verdict
    const parsed = parseUpgradeTarget(input.targetId)!
    const coin = repairCoinFor(parsed.upgradeId)
    if (ctx.state.coin < coin) {
      return reject(
        'insufficient_coin',
        `The repair costs ${coin} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const coin = repairCoinFor(parsed.upgradeId)
    const before =
      ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]?.condition ?? 0
    repairUpgrade(ctx, parsed.areaId, parsed.upgradeId, coin)
    const after =
      ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]?.condition ?? 0
    return {
      actionId: repairAreaUpgrade.id,
      label: `Repaired ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_SHORT,
      effects: [`condition ${before} → ${after}`, `coin -${coin}`],
      data: {
        areaId: parsed.areaId,
        upgradeId: parsed.upgradeId,
        condition: { before, after },
        coin: { spent: coin },
      },
    }
  },
}

// ---------- maintain_area_upgrade ----------

function upkeepCoinFor(upgradeId: string): number {
  return getAreaUpgradeDefinition(upgradeId)?.maintenance?.coin ?? 0
}

const maintainAreaUpgrade: OwnerActionDefinition = {
  id: 'maintain_area_upgrade',
  label: 'Service Fitting',
  category: 'immediate',
  tags: ['area', 'upgrade', 'upkeep', 'maintenance'],
  effectsPreview: 'Services a fitting and resets its upkeep clock',
  pressureAffinity: ['maintenance'],
  targetType: 'area',
  timeCost: TIME_COST_QUICK,
  getValidTargets: (ctx) =>
    listRecordsByStatus(
      ctx,
      ['installed', 'damaged'],
      ({ upgradeId, condition, overdueDays }) =>
        overdueDays > 0
          ? `${overdueDays}d overdue, condition ${condition}, ${upkeepCoinFor(upgradeId)} coin`
          : `due in ${-overdueDays}d, condition ${condition}, ${upkeepCoinFor(upgradeId)} coin`,
    ).filter((target) => {
      // Only fittings that actually HAVE an upkeep contract are offered.
      const parsed = parseUpgradeTarget(target.id)!
      return getAreaUpgradeDefinition(parsed.upgradeId)?.maintenance !== undefined
    }),
  canApply: (ctx, input) => {
    const verdict = requireRecord(ctx, input, ['installed', 'damaged'], 'not_installed')
    if (!verdict.ok) return verdict
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    if (!def?.maintenance) {
      return reject(
        'no_upkeep',
        `${def?.label ?? parsed.upgradeId} needs no regular service`,
      )
    }
    const coin = def.maintenance.coin
    if (ctx.state.coin < coin) {
      return reject(
        'insufficient_coin',
        `The service costs ${coin} coin; only ${ctx.state.coin} available`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const parsed = parseUpgradeTarget(input.targetId)!
    const def = getAreaUpgradeDefinition(parsed.upgradeId)
    const coin = upkeepCoinFor(parsed.upgradeId)
    const before =
      ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]?.condition ?? 100
    serviceUpgrade(ctx, parsed.areaId, parsed.upgradeId, coin)
    const record = ctx.state.areas[parsed.areaId]?.upgrades[parsed.upgradeId]
    return {
      actionId: maintainAreaUpgrade.id,
      label: `Serviced ${def?.label ?? parsed.upgradeId}`,
      targetId: input.targetId!,
      targetLabel: `${def?.label ?? parsed.upgradeId} — ${areaLabel(ctx.state, parsed.areaId)}`,
      timeCost: TIME_COST_QUICK,
      effects: [
        `condition ${before} → ${record?.condition ?? before}`,
        `next service due day ${record?.upkeepDueDay ?? '—'}`,
        ...(coin > 0 ? [`coin -${coin}`] : []),
      ],
      data: {
        areaId: parsed.areaId,
        upgradeId: parsed.upgradeId,
        condition: { before, after: record?.condition ?? before },
        upkeepDueDay: record?.upkeepDueDay ?? null,
        coin: { spent: coin },
      },
    }
  },
}

export const AREA_UPGRADE_ACTIONS: OwnerActionDefinition[] = [
  startAreaUpgrade,
  fundAreaUpgrade,
  pauseAreaUpgrade,
  resumeAreaUpgrade,
  cancelAreaUpgrade,
  repairAreaUpgrade,
  maintainAreaUpgrade,
]

export { FUND_COIN as UPGRADE_FUND_COIN, describeQuote, quoteFor as quoteUpgradeForActions }
