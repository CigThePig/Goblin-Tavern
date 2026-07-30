import type { SimContext } from '../../core/context'
import type {
  AreaState,
  AreaUpgradeState,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { capacityOf } from '../../registries/areaCapacityTypes'
import { areaRegistry } from '../../registries/areaRegistry'
import { getAreaUpgradeDefinition } from '../../content/tavern/areaUpgradeRegistry'
import type { AreaUpgradeDefinition } from '../../content/tavern/upgradeTypes'
import { spendCoin } from '../stock/ledger'
import { applyDebtToRecovery } from '../../contracts/meters/index'

import {
  bumpAreaTotal,
  getAreasModuleState,
  writeAreasSlice,
  type AreaConstructionLogEntry,
} from './state'
import {
  upgradeLabourRequired,
  upgradeMaterials,
  type AreaUpgradeQuote,
} from './quote'
import { OWNER_FUND_LABOUR, listActiveSites } from './labour'
import {
  getSiteLabourPerDay,
  ownerTravelPenalty,
  scheduledSiteKeys,
  siteConflictReason,
} from './schedule'

// Expansion Phase 2 §2.2 / §2.3 — the upgrade lifecycle.
//
// THE ONE OWNER. Every transition an upgrade record can make lives in this
// file, and the `areas` module is the only domain that calls it (§5.4). Owner
// actions, scheduled events and propagation edges all REQUEST a transition
// here rather than writing `area.upgrades[...]` themselves — which is what
// makes "one authoritative upgrade record" (§2.2) true rather than aspirational.
//
// THE STATE MACHINE.
//
//   available ──start──▶ in_progress ──labour──▶ installed
//        ▲                  │    ▲                  │
//        │               pause  resume         wear/damage
//     cancel                │    │                  ▼
//        │                  ▼    │              damaged ──▶ disabled
//     cancelled ◀──────── paused │                  │
//                                └──── repair ◀─────┘
//
// `cancelled` is also where a superseded fitting lands: installing
// `reinforced_beams` retires the `patched_thatch` it replaces, with the
// reason recorded on the record.

const SOURCE = 'areas'

/** Consecutive stalled days after which a site is reported as interrupted. */
const STALL_WARNING_DAYS = 2

/** Condition at which an installed fitting stops working. */
const FITTING_BROKEN_CONDITION = 25

// ---------- record plumbing ----------

/**
 * Write one upgrade record through `ctx.modifyArea`.
 *
 * Routing through the engine helper rather than mutating the branch keeps the
 * Phase 7 §7.3.1 cause contract intact: a status flip is a material,
 * player-facing change and it arrives with its own cause naming the record.
 */
function writeUpgrade(
  ctx: SimContext,
  areaId: string,
  next: AreaUpgradeState,
  meta: {
    reason: string
    readable: string
    tags: string[]
    amount?: number
  },
): void {
  const area = ctx.state.areas[areaId]
  if (!area) return
  ctx.modifyArea(
    areaId,
    { upgrades: { ...area.upgrades, [next.id]: next } },
    {
      source: `${SOURCE}.upgrade.${meta.reason}`,
      reason: meta.reason,
      target: `area:${areaId}.upgrades.${next.id}`,
      targetType: 'area',
      amount: meta.amount ?? 1,
      readable: meta.readable,
      tags: ['area', 'upgrade', areaId, next.id, ...meta.tags],
      relatedLocations: [{ kind: 'area', id: areaId }],
      relatedSystems: ['areas'],
    },
  )
}

/**
 * Apply a patch to an upgrade record, dropping any key set to `undefined`.
 *
 * `exactOptionalPropertyTypes` is on, so `{ ...record, pausedOnDay: undefined }`
 * is not a legal `AreaUpgradeState` — and it would also serialize an explicit
 * `null`-ish key into the save. Clearing a field has to mean removing it.
 */
function patchRecord(
  record: AreaUpgradeState,
  patch: Partial<Record<keyof AreaUpgradeState, unknown>>,
): AreaUpgradeState {
  const next: Record<string, unknown> = { ...record }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as AreaUpgradeState
}

function existingRecord(
  area: AreaState,
  upgradeId: string,
): AreaUpgradeState | undefined {
  return area.upgrades[upgradeId]
}

function definitionTags(def: AreaUpgradeDefinition): string[] {
  return [...def.tags]
}

// ---------- start ----------

export type StartUpgradeResult = {
  upgradeId: string
  areaId: string
  coinSpent: number
  materialsUsed: Record<string, number>
  requiredProgress: number
  expectedDays: number
  effects: string[]
}

/**
 * Start a build, charging the quote the player was shown.
 *
 * The caller has already validated eligibility and affordability (the owner
 * action does it so it can hand the player a reason); this function charges
 * and stamps. It re-derives nothing from the catalogue that the quote did not
 * already state, so the number charged is the number quoted.
 */
export function startUpgrade(
  ctx: SimContext,
  quote: AreaUpgradeQuote,
): StartUpgradeResult | undefined {
  const { areaId, upgradeId } = quote
  const area = ctx.state.areas[areaId]
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !def) return undefined

  const today = ctx.state.calendar.totalDaysElapsed
  const effects: string[] = []

  // Materials first: they come out of stock, and a partial draw would leave
  // the build owning materials it never got.
  const materialsUsed: Record<string, number> = {}
  for (const line of quote.materials) {
    const item = ctx.state.stock[line.stockId]
    if (!item || item.quantity < line.required) continue
    ctx.modifyStock(
      line.stockId,
      { quantity: item.quantity - line.required },
      {
        source: `${SOURCE}.upgrade.materials`,
        sourceType: 'area',
        direction: 'decrease',
        amount: -line.required,
        readable: `${line.required} ${item.label} went into ${def.label} in ${area.label}.`,
        tags: ['area', 'upgrade', 'materials', upgradeId, line.stockId],
        relatedActors: [{ kind: 'stock', id: line.stockId }],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['areas', 'stock'],
      },
    )
    materialsUsed[line.stockId] = line.required
    effects.push(`${item.label} -${line.required}`)
  }

  if (quote.coin > 0) {
    spendCoin(ctx, quote.coin, {
      source: `${SOURCE}.upgrade.start.${upgradeId}`,
      category: 'repair',
      tags: ['area', 'upgrade', 'construction', areaId, upgradeId],
    })
    effects.push(`coin -${quote.coin}`)
  }

  const previous = existingRecord(area, upgradeId)
  const next: AreaUpgradeState = {
    id: upgradeId,
    status: 'in_progress',
    tags: definitionTags(def),
    progress: 0,
    requiredProgress: quote.labourRequired,
    startedAtDay: today,
    coinInvested: quote.coin,
    ownerMinutesInvested: quote.startMinutes,
    ...(Object.keys(materialsUsed).length > 0 ? { materialsUsed } : {}),
    stalledDays: 0,
    // A restart after a cancellation begins clean: no banked progress, no
    // stale stall reason, no memory of the abandoned attempt beyond history.
    ...(previous?.replacedUpgradeId
      ? { replacedUpgradeId: previous.replacedUpgradeId }
      : {}),
  }

  writeUpgrade(ctx, areaId, next, {
    reason: 'construction_started',
    readable: `Work started on ${def.label} in ${area.label}.`,
    tags: ['construction', 'started'],
  })
  bumpAreaTotal(ctx, 'upgradesStarted', 1, 'construction_started')

  ctx.addHistory({
    category: 'owner_action',
    summary: `Work started on ${def.label} in ${area.label}.`,
    tags: ['area', 'upgrade', 'construction', 'started', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  ctx.addEntityMemory(
    { kind: 'area', id: areaId },
    {
      id: 'area_under_construction',
      source: `${SOURCE}.upgrade.start`,
      locations: [{ kind: 'area', id: areaId }],
      tags: ['area', 'upgrade', 'construction', upgradeId],
    },
    // `EntityMemoryMetadata` is a closed shape; the upgrade travels as a
    // source-project ref, which is exactly what it is.
    { sourceProjectIds: [`${areaId}:${upgradeId}`] },
  )

  effects.push(
    `${def.label} under construction (0/${quote.labourRequired} labour)`,
  )
  if (quote.blocksCapacityWhileBuilding > 0) {
    effects.push(
      `${Math.round(quote.blocksCapacityWhileBuilding * 100)}% of ${area.label} closed while building`,
    )
  }

  return {
    upgradeId,
    areaId,
    coinSpent: quote.coin,
    materialsUsed,
    requiredProgress: quote.labourRequired,
    expectedDays: Number.isFinite(quote.expectedDays) ? quote.expectedDays : 0,
    effects,
  }
}

// ---------- fund / pause / resume / cancel ----------

/** Owner time and coin bought into a live site: +`OWNER_FUND_LABOUR` labour. */
export function fundUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
  coin: number,
  ownerMinutes: number,
): { progress: number; requiredProgress: number } | undefined {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def || record.status !== 'in_progress') return undefined

  const requiredProgress = record.requiredProgress ?? upgradeLabourRequired(def)
  // §2.5 travel/setup: a shift put into a room the owner has not already been
  // working in today loses part of itself to getting there and setting up.
  const travel = ownerTravelPenalty(ctx.state, areaId)
  const labour = Math.max(1, OWNER_FUND_LABOUR - travel)
  const progress = Math.min(requiredProgress, (record.progress ?? 0) + labour)

  if (coin > 0) {
    spendCoin(ctx, coin, {
      source: `${SOURCE}.upgrade.fund.${upgradeId}`,
      category: 'repair',
      tags: ['area', 'upgrade', 'construction', 'fund', areaId, upgradeId],
    })
  }

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      progress,
      requiredProgress,
      coinInvested: (record.coinInvested ?? 0) + coin,
      ownerMinutesInvested: (record.ownerMinutesInvested ?? 0) + ownerMinutes,
      lastProgressDay: ctx.state.calendar.totalDaysElapsed,
      stalledDays: 0,
      stalledReason: undefined,
    }),
    {
      reason: 'construction_funded',
      readable:
        `Owner put a shift into ${def.label} (${progress}/${requiredProgress})` +
        (travel > 0 ? ' — part of it lost to crossing the tavern.' : '.'),
      tags: ['construction', 'funded'],
      amount: labour,
    },
  )
  bumpAreaTotal(ctx, 'labourApplied', labour, 'construction_funded')

  return { progress, requiredProgress }
}

export function pauseUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def || record.status !== 'in_progress') return false

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      status: 'paused',
      pausedOnDay: ctx.state.calendar.totalDaysElapsed,
      stalledDays: 0,
    }),
    {
      reason: 'construction_paused',
      // Progress and materials are kept: a paused site is a site you can come
      // back to, which is the whole point of the pause/resume pair.
      readable: `Work on ${def.label} paused at ${record.progress ?? 0}/${record.requiredProgress ?? 0}. The site reopens where it left off.`,
      tags: ['construction', 'paused'],
    },
  )
  ctx.addHistory({
    category: 'owner_action',
    summary: `Work on ${def.label} in ${area.label} paused.`,
    tags: ['area', 'upgrade', 'construction', 'paused', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  return true
}

export function resumeUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def || record.status !== 'paused') return false

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      status: 'in_progress',
      pausedOnDay: undefined,
      stalledDays: 0,
    }),
    {
      reason: 'construction_resumed',
      readable: `Work on ${def.label} resumed at ${record.progress ?? 0}/${record.requiredProgress ?? 0}.`,
      tags: ['construction', 'resumed'],
    },
  )
  ctx.addHistory({
    category: 'owner_action',
    summary: `Work on ${def.label} in ${area.label} resumed.`,
    tags: ['area', 'upgrade', 'construction', 'resumed', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  return true
}

/**
 * Abandon a build.
 *
 * Materials already worked into the site are gone — that is the cost of
 * changing your mind, and it is why the record keeps `materialsUsed` and
 * `coinInvested` after cancellation rather than clearing them: the report can
 * say what the abandoned attempt cost.
 */
export function cancelUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def) return false
  if (record.status !== 'in_progress' && record.status !== 'paused') return false

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      status: 'cancelled',
      cancelledOnDay: ctx.state.calendar.totalDaysElapsed,
      disabledReason: `Abandoned after ${record.progress ?? 0}/${record.requiredProgress ?? 0} labour`,
    }),
    {
      reason: 'construction_cancelled',
      readable: `Work on ${def.label} in ${area.label} was abandoned. Materials already used are lost.`,
      tags: ['construction', 'cancelled'],
    },
  )
  bumpAreaTotal(ctx, 'upgradesCancelled', 1, 'construction_cancelled')
  ctx.addHistory({
    category: 'owner_action',
    summary: `Work on ${def.label} in ${area.label} was abandoned.`,
    tags: ['area', 'upgrade', 'construction', 'cancelled', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  return true
}

/**
 * Expansion Phase 2 §2.2 — a fitting's identity effects follow its status.
 *
 * `completeUpgrade` used to be the only place that touched an area's traits and
 * atmosphere, which meant a fitting's identity contribution outlived the fitting
 * itself: `rat_proof_barrels` scrubs `pest_prone` when it is installed, and if
 * the barrels then rotted through to `disabled` the cellar stayed pest-free
 * forever — the pest-pressure calculator kept granting a benefit the record
 * itself said was out of service. Damage has to cost what the fitting bought.
 *
 * `apply` puts the contribution on; `suspend` takes it back off. Both are
 * guarded so they only ever undo what THIS fitting is responsible for:
 *
 *   * a trait or atmosphere tag the fitting ADDS is only removed on suspend if
 *     no other installed fitting also adds it and the room did not come with
 *     it — otherwise a second fitting's contribution, or the room's own
 *     character, would be scrubbed by an unrelated breakage;
 *   * a trait the fitting REMOVES is only restored if the room's registry
 *     default carries it and no other installed fitting also suppresses it.
 *     Restoring a trait the room never had would be inventing one.
 *
 * Meter effects are deliberately NOT reversed. Cleanliness and condition are
 * continuous quantities the whole tavern has moved on from since; clawing them
 * back days later would fabricate a change nothing caused.
 */
function applyFittingIdentity(
  ctx: SimContext,
  areaId: string,
  def: AreaUpgradeDefinition,
  mode: 'apply' | 'suspend',
): string[] {
  const area = ctx.state.areas[areaId]
  if (!area) return []
  const effects: string[] = []

  const inherentTraits = areaRegistry.has(areaId)
    ? (areaRegistry.get(areaId).defaultState.traits ?? [])
    : []

  /** Other fittings in this room that are currently in service. */
  const otherInstalled = Object.values(area.upgrades)
    .filter((record) => record.status === 'installed' && record.id !== def.id)
    .map((record) => getAreaUpgradeDefinition(record.id))
    .filter((other): other is AreaUpgradeDefinition => other !== undefined)

  let traits = [...area.traits]
  let atmosphere = [...area.atmosphere]

  for (const trait of def.addsTraits ?? []) {
    if (mode === 'apply') {
      if (traits.includes(trait)) continue
      traits.push(trait)
      effects.push(`trait +${trait}`)
      continue
    }
    if (!traits.includes(trait)) continue
    if (inherentTraits.includes(trait)) continue
    if (otherInstalled.some((other) => other.addsTraits?.includes(trait))) continue
    traits = traits.filter((t) => t !== trait)
    effects.push(`trait -${trait}`)
  }

  for (const trait of def.removesTraits ?? []) {
    if (mode === 'apply') {
      if (!traits.includes(trait)) continue
      traits = traits.filter((t) => t !== trait)
      effects.push(`trait -${trait}`)
      continue
    }
    if (traits.includes(trait)) continue
    if (!inherentTraits.includes(trait)) continue
    if (otherInstalled.some((other) => other.removesTraits?.includes(trait))) continue
    traits.push(trait)
    effects.push(`trait +${trait}`)
  }

  for (const tag of def.addsAtmosphere ?? []) {
    if (mode === 'apply') {
      if (atmosphere.includes(tag)) continue
      atmosphere.push(tag)
      effects.push(`atmosphere +${tag}`)
      continue
    }
    if (!atmosphere.includes(tag)) continue
    if (otherInstalled.some((other) => other.addsAtmosphere?.includes(tag))) continue
    atmosphere = atmosphere.filter((t) => t !== tag)
    effects.push(`atmosphere -${tag}`)
  }

  if (effects.length === 0) return effects

  ctx.modifyArea(
    areaId,
    { traits, atmosphere },
    {
      source: `${SOURCE}.upgrade.${mode === 'apply' ? 'installed' : 'suspended'}.${def.id}`,
      reason: mode === 'apply' ? 'upgrade_reshaped_area' : 'fitting_out_of_service',
      target: `area:${areaId}.traits`,
      targetType: 'area',
      readable:
        mode === 'apply'
          ? `${def.label} reshaped ${area.label}.`
          : `${def.label} is out of service, so ${area.label} loses what it was giving.`,
      tags: ['area', 'upgrade', mode === 'apply' ? 'installed' : 'suspended', areaId, def.id],
      relatedLocations: [{ kind: 'area', id: areaId }],
      relatedSystems: ['areas'],
    },
  )
  return effects
}

// ---------- completion ----------

/**
 * Install a finished build: capacity, meters, traits, atmosphere, upkeep
 * clock, and the replacement chain.
 *
 * This is the one place an upgrade becomes `installed`, so it is the one
 * place where "an installed fitting changes something" is guaranteed. The
 * capacity effect needs no code here — `getUsableAreaCapacity` reads the
 * record — which is exactly why capacity is derived rather than stored.
 */
export function completeUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
  origin: string,
): string[] {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def) return []

  const today = ctx.state.calendar.totalDaysElapsed
  const effects: string[] = []

  // 1. The record itself.
  const installed = patchRecord(record, {
    status: 'installed',
    progress: record.requiredProgress ?? record.progress ?? 0,
    installedAtDay: today,
    condition: 100,
    lastUpkeepDay: today,
    stalledDays: 0,
    stalledReason: undefined,
    ...(def.maintenance
      ? { upkeepDueDay: today + def.maintenance.intervalDays }
      : {}),
    ...(def.replaces ? { replacedUpgradeId: def.replaces } : {}),
  })
  writeUpgrade(ctx, areaId, installed, {
    reason: 'construction_completed',
    readable: `${def.label} is installed in ${area.label}.`,
    tags: ['construction', 'completed', origin],
  })
  effects.push(`${def.label} installed`)

  // 2. Traits and atmosphere.
  for (const line of applyFittingIdentity(ctx, areaId, def, 'apply')) {
    effects.push(line)
  }

  // 3. Meter effects. `cleanliness`/`condition` improvements are spent
  // against banked meter debt first (Phase 1 §1.5's `applyDebtToRecovery`):
  // a room that has been floored for a fortnight does not spring back from
  // one fitting, and this is the production caller CON-05 was waiting for.
  applyUpgradeMeterEffects(ctx, areaId, def, effects)

  // 4. The replacement chain: retire what this supersedes.
  if (def.replaces) {
    const replaced = ctx.state.areas[areaId]?.upgrades[def.replaces]
    const replacedDef = getAreaUpgradeDefinition(def.replaces)
    if (replaced && replaced.status !== 'cancelled') {
      writeUpgrade(
        ctx,
        areaId,
        patchRecord(replaced, {
          status: 'cancelled',
          cancelledOnDay: today,
          disabledReason: `Superseded by ${def.label}`,
        }),
        {
          reason: 'upgrade_superseded',
          readable: `${replacedDef?.label ?? def.replaces} was superseded by ${def.label}.`,
          tags: ['construction', 'superseded'],
        },
      )
      effects.push(`${replacedDef?.label ?? def.replaces} superseded`)
    }
  }

  bumpAreaTotal(ctx, 'upgradesInstalled', 1, 'construction_completed')
  ctx.addHistory({
    category: 'owner_action',
    summary: `${def.label} finished in ${area.label}.`,
    tags: ['area', 'upgrade', 'construction', 'completed', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  ctx.addEntityMemory(
    { kind: 'area', id: areaId },
    {
      id: 'area_recently_upgraded',
      source: `${SOURCE}.upgrade.installed`,
      locations: [{ kind: 'area', id: areaId }],
      tags: ['area', 'upgrade', upgradeId],
    },
    { sourceProjectIds: [`${areaId}:${upgradeId}`] },
  )

  return effects
}

const METER_FIELDS = [
  'condition',
  'cleanliness',
  'mess',
  'damage',
  'smell',
  'risk',
] as const

function applyUpgradeMeterEffects(
  ctx: SimContext,
  areaId: string,
  def: AreaUpgradeDefinition,
  effects: string[],
): void {
  if (!def.meterEffects) return
  const area = ctx.state.areas[areaId]
  if (!area) return
  const changes: Partial<Record<(typeof METER_FIELDS)[number], number>> = {}
  for (const field of METER_FIELDS) {
    const delta = def.meterEffects[field]
    if (delta === undefined || delta === 0) continue
    // `condition`/`cleanliness` rise with the upgrade; `mess`/`damage`/
    // `smell`/`risk` fall. Either way an improvement pays down banked debt
    // before it moves the visible meter.
    const improving =
      field === 'condition' || field === 'cleanliness' ? delta > 0 : delta < 0
    let applied = delta
    if (improving) {
      const spend = applyDebtToRecovery(
        ctx,
        `area:${areaId}.${field}`,
        Math.abs(delta),
        'upgrade_installed',
      )
      applied = delta > 0 ? spend.visibleImprovement : -spend.visibleImprovement
    }
    if (applied === 0) continue
    const next = clampPercent(area[field] + applied)
    if (next === area[field]) continue
    changes[field] = next
    effects.push(`${field} ${area[field]} → ${next}`)
  }
  if (Object.keys(changes).length === 0) return
  ctx.modifyArea(areaId, changes, {
    source: `${SOURCE}.upgrade.installed.${def.id}`,
    reason: 'upgrade_meter_effects',
    target: `area:${areaId}`,
    targetType: 'area',
    readable: `${def.label} changed ${area.label}.`,
    tags: ['area', 'upgrade', 'installed', areaId, def.id],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
  })
}

// ---------- damage, disable, repair ----------

/**
 * Knock a fitting's condition down. Below `FITTING_BROKEN_CONDITION` it stops
 * working: `damaged` while it can still be salvaged in place, `disabled` once
 * it is out of service entirely.
 *
 * Called by the upkeep tick (neglect), by propagation edges (a leaking roof
 * ruining the room below), and by the collapse-risk scheduled event.
 */
export function damageUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
  amount: number,
  reason: string,
  readable: string,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def) return false
  if (record.status !== 'installed' && record.status !== 'damaged') return false

  const before = record.condition ?? 100
  const condition = clampPercent(before - Math.abs(amount))
  if (condition === before) return false

  const broken = condition <= 0
  const failing = condition < FITTING_BROKEN_CONDITION
  const status: AreaUpgradeState['status'] = broken
    ? 'disabled'
    : failing
      ? 'damaged'
      : 'installed'

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      status,
      condition,
      ...(status !== 'installed' && record.status === 'installed'
        ? { damagedOnDay: ctx.state.calendar.totalDaysElapsed }
        : {}),
      disabledReason: broken ? readable : undefined,
    }),
    {
      reason,
      readable,
      tags: ['fitting', status],
      amount: condition - before,
    },
  )

  if (status !== 'installed' && record.status === 'installed') {
    // The fitting has just left service, so whatever it was giving the room
    // stops. Without this the cellar keeps its scrubbed `pest_prone` — and the
    // pest calculator keeps granting a benefit the record says is broken.
    applyFittingIdentity(ctx, areaId, def, 'suspend')
    bumpAreaTotal(ctx, 'upgradesDamaged', 1, reason)
    ctx.addHistory({
      // `state_change` rather than a bespoke category: the fitting's status
      // changing IS the event, and the history categories are a closed union.
      category: 'state_change',
      summary: readable,
      tags: ['area', 'upgrade', 'damaged', areaId, upgradeId],
      relatedLocations: [{ kind: 'area', id: areaId }],
      relatedSystems: ['areas'],
      mechanicalRefs: [upgradeId, areaId],
    })
  }
  return true
}

/** Put a damaged or disabled fitting back into service. */
export function repairUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
  coin: number,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def) return false
  if (record.status !== 'damaged' && record.status !== 'disabled') return false

  const today = ctx.state.calendar.totalDaysElapsed
  if (coin > 0) {
    spendCoin(ctx, coin, {
      source: `${SOURCE}.upgrade.repair.${upgradeId}`,
      category: 'repair',
      tags: ['area', 'upgrade', 'repair', areaId, upgradeId],
    })
  }

  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      status: 'installed',
      // A repair restores service, not newness: a fitting that has been
      // broken once is never quite the same again.
      condition: 85,
      lastUpkeepDay: today,
      ...(def.maintenance
        ? { upkeepDueDay: today + def.maintenance.intervalDays }
        : {}),
      damagedOnDay: undefined,
      disabledReason: undefined,
      coinInvested: (record.coinInvested ?? 0) + coin,
    }),
    {
      reason: 'fitting_repaired',
      readable: `${def.label} in ${area.label} was repaired and is back in service.`,
      tags: ['fitting', 'repaired'],
    },
  )
  // Back in service, so what it gives the room comes back with it.
  applyFittingIdentity(ctx, areaId, def, 'apply')
  bumpAreaTotal(ctx, 'upgradesRepaired', 1, 'fitting_repaired')
  ctx.addHistory({
    category: 'owner_action',
    summary: `${def.label} in ${area.label} was repaired.`,
    tags: ['area', 'upgrade', 'repair', areaId, upgradeId],
    relatedLocations: [{ kind: 'area', id: areaId }],
    relatedSystems: ['areas'],
    mechanicalRefs: [upgradeId, areaId],
  })
  return true
}

/** Service an installed fitting, resetting its upkeep clock. */
export function serviceUpgrade(
  ctx: SimContext,
  areaId: string,
  upgradeId: string,
  coin: number,
): boolean {
  const area = ctx.state.areas[areaId]
  const record = area ? existingRecord(area, upgradeId) : undefined
  const def = getAreaUpgradeDefinition(upgradeId)
  if (!area || !record || !def?.maintenance) return false
  if (record.status !== 'installed' && record.status !== 'damaged') return false

  const today = ctx.state.calendar.totalDaysElapsed
  if (coin > 0) {
    spendCoin(ctx, coin, {
      source: `${SOURCE}.upgrade.upkeep.${upgradeId}`,
      category: 'repair',
      tags: ['area', 'upgrade', 'upkeep', areaId, upgradeId],
    })
  }

  const condition = clampPercent(Math.max(record.condition ?? 100, 0) + 15)
  writeUpgrade(
    ctx,
    areaId,
    patchRecord(record, {
      // Servicing a fitting that had slipped into `damaged` brings it back if
      // the service alone lifted it clear of the failure line.
      status: condition >= FITTING_BROKEN_CONDITION ? 'installed' : record.status,
      condition,
      lastUpkeepDay: today,
      upkeepDueDay: today + def.maintenance.intervalDays,
      ...(condition >= FITTING_BROKEN_CONDITION
        ? { damagedOnDay: undefined, disabledReason: undefined }
        : {}),
    }),
    {
      reason: 'fitting_serviced',
      readable: `${def.label} in ${area.label} was serviced (condition ${condition}).`,
      tags: ['fitting', 'serviced'],
      amount: condition - (record.condition ?? 100),
    },
  )
  // A service that lifted a damaged fitting back over the failure line puts it
  // back in service, so its identity contribution returns with it.
  if (record.status !== 'installed' && condition >= FITTING_BROKEN_CONDITION) {
    applyFittingIdentity(ctx, areaId, def, 'apply')
  }
  bumpAreaTotal(ctx, 'upkeepsServiced', 1, 'fitting_serviced')
  return true
}

// ---------- the daily tick ----------

/**
 * §2.3 — advance every live site, then wear every neglected fitting.
 *
 * Deterministic: labour comes from `getSiteLabourPerDay` (pure, sorted crew,
 * no RNG), the site order is sorted, and a reload cannot change either. That
 * is what makes the required "deterministic construction progress" and
 * "save/load at every construction state" tests provable rather than lucky.
 */
export function tickConstruction(ctx: SimContext): void {
  const log: AreaConstructionLogEntry[] = []
  let labourApplied = 0

  // §2.5 — the schedule the module wrote a moment ago decides which sites are
  // worked. Read rather than recomputed so the report, the record and the tick
  // cannot disagree about why a site sat idle.
  const schedule = getAreasModuleState(ctx.state).schedule
  const cleared = scheduledSiteKeys(schedule)

  for (const site of listActiveSites(ctx.state)) {
    const area = ctx.state.areas[site.areaId]
    const record = area?.upgrades[site.upgradeId]
    const def = getAreaUpgradeDefinition(site.upgradeId)
    if (!area || !record || !def) continue

    const requiredProgress = record.requiredProgress ?? upgradeLabourRequired(def)
    const contributors: string[] = ['site']
    for (const member of listConstructionCrewIds(ctx.state)) {
      contributors.push(`staff:${member}`)
    }

    // Materials the build still owes are checked every day, not just at the
    // start: a site can be short because the record was migrated in, or
    // because a later phase's supplier failure took the delivery back.
    // Anything the record still owes is drawn NOW, before labour is counted —
    // so a site can never progress on materials it has not actually consumed.
    const shortage = settleOwedMaterials(ctx, site.areaId, def, record).shortage
    const blocked = cleared.has(`${site.areaId}:${site.upgradeId}`)
      ? undefined
      : (siteConflictReason(schedule, site.areaId, site.upgradeId) ??
        'the day’s schedule had no room for this site')
    let labour =
      shortage || blocked
        ? 0
        : // The schedule the module already wrote is handed straight in, so the
          // crew split the tick applies is the same one the schedule laid out
          // rather than a second computation that could disagree with it.
          getSiteLabourPerDay(ctx.state, site.areaId, schedule)
    let stalledReason: string | undefined = shortage
      ? `short of ${shortage}`
      : blocked
        ? blocked
        : labour <= 0
          ? 'nobody worked the site'
          : undefined

    if (labour <= 0) labour = 0

    const progress = Math.min(requiredProgress, (record.progress ?? 0) + labour)
    const moved = progress > (record.progress ?? 0)
    const stalledDays = moved ? 0 : (record.stalledDays ?? 0) + 1

    // `settleOwedMaterials` may have rewritten the record, so patch the live
    // one rather than the copy read at the top of the loop.
    const current = ctx.state.areas[site.areaId]?.upgrades[site.upgradeId] ?? record

    if (moved) {
      labourApplied += labour
      writeUpgrade(
        ctx,
        site.areaId,
        patchRecord(current, {
          progress,
          requiredProgress,
          lastProgressDay: ctx.state.calendar.totalDaysElapsed,
          stalledDays: 0,
          stalledReason: undefined,
        }),
        {
          reason: 'construction_progress',
          readable: `${def.label} in ${area.label}: ${progress}/${requiredProgress} labour.`,
          tags: ['construction', 'progress'],
          amount: labour,
        },
      )
    } else {
      if (stalledDays >= STALL_WARNING_DAYS && stalledReason) {
        stalledReason = `${stalledReason} (${stalledDays} days)`
      }
      writeUpgrade(
        ctx,
        site.areaId,
        patchRecord(current, {
          requiredProgress,
          stalledDays,
          stalledReason,
        }),
        {
          reason: 'construction_stalled',
          readable: `${def.label} in ${area.label} made no progress: ${stalledReason ?? 'unknown'}.`,
          tags: ['construction', 'stalled'],
          amount: 0,
        },
      )
    }

    log.push({
      areaId: site.areaId,
      upgradeId: site.upgradeId,
      labourAdded: moved ? labour : 0,
      progress,
      requiredProgress,
      contributors,
      ...(stalledReason ? { stalledReason } : {}),
      readable: moved
        ? `${def.label}: ${progress}/${requiredProgress} labour.`
        : `${def.label}: stalled — ${stalledReason ?? 'unknown'}.`,
    })

    if (progress >= requiredProgress) {
      completeUpgrade(ctx, site.areaId, site.upgradeId, 'construction_tick')
    }
  }

  if (log.length > 0) {
    writeAreasSlice(
      ctx,
      (current) => ({ ...current, construction: log }),
      'construction_log',
    )
  }
  if (labourApplied > 0) {
    bumpAreaTotal(ctx, 'labourApplied', labourApplied, 'construction_progress')
  }
}

function listConstructionCrewIds(state: TavernState): string[] {
  return Object.values(state.staff)
    .filter(
      (member) => member.unavailable !== true && member.currentPriority === 'minor_repairs',
    )
    .map((member) => member.id)
    .sort()
}

/**
 * Settle whatever materials a build still owes, drawing them from stores.
 *
 * A build charged at the start owes nothing, so this is normally a no-op — it
 * exists for records that arrived some other way (a migrated save, a future
 * phase's supplier failure clawing a delivery back). The important part is that
 * it CONSUMES: checking that the store holds enough and then letting the site
 * build anyway would hand the player a free build and leave the same timber
 * available for the next one.
 *
 * Returns a shortage description when the store cannot cover what is owed, in
 * which case nothing is drawn — a half-delivered site is worse than a stalled
 * one, because it spends materials and still makes no progress.
 */
function settleOwedMaterials(
  ctx: SimContext,
  areaId: string,
  def: AreaUpgradeDefinition,
  record: AreaUpgradeState,
): { shortage?: string } {
  const owed: Array<{ stockId: string; label: string; quantity: number }> = []
  for (const line of upgradeMaterials(ctx.state, def)) {
    const delivered = record.materialsUsed?.[line.stockId] ?? 0
    if (delivered >= line.required) continue
    const missing = line.required - delivered
    if (line.held < missing) return { shortage: `${missing} ${line.label}` }
    owed.push({ stockId: line.stockId, label: line.label, quantity: missing })
  }
  if (owed.length === 0) return {}

  const area = ctx.state.areas[areaId]
  const materialsUsed: Record<string, number> = { ...(record.materialsUsed ?? {}) }
  for (const line of owed) {
    const item = ctx.state.stock[line.stockId]
    if (!item) continue
    ctx.modifyStock(
      line.stockId,
      { quantity: item.quantity - line.quantity },
      {
        source: `${SOURCE}.upgrade.materials`,
        sourceType: 'area',
        direction: 'decrease',
        amount: -line.quantity,
        readable: `${line.quantity} ${item.label} went into ${def.label} in ${area?.label ?? areaId}.`,
        tags: ['area', 'upgrade', 'materials', def.id, line.stockId],
        relatedActors: [{ kind: 'stock', id: line.stockId }],
        relatedLocations: [{ kind: 'area', id: areaId }],
        relatedSystems: ['areas', 'stock'],
      },
    )
    materialsUsed[line.stockId] = (materialsUsed[line.stockId] ?? 0) + line.quantity
  }

  const live = ctx.state.areas[areaId]?.upgrades[def.id]
  if (live) {
    writeUpgrade(ctx, areaId, patchRecord(live, { materialsUsed }), {
      reason: 'construction_materials_settled',
      readable: `${def.label} drew the materials it still owed.`,
      tags: ['construction', 'materials'],
      amount: 0,
    })
  }
  return {}
}

/**
 * §2.2 — wear every fitting whose upkeep has fallen due.
 *
 * This is what makes progression cost something ongoing. A fitting serviced
 * on time never wears; one left a week past its interval loses condition
 * every day until it slips below the failure line and stops contributing its
 * capacity at all.
 */
export function tickUpkeep(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  for (const area of Object.values(ctx.state.areas)) {
    for (const record of Object.values(area.upgrades)) {
      if (record.status !== 'installed' && record.status !== 'damaged') continue
      const def = getAreaUpgradeDefinition(record.id)
      if (!def?.maintenance) continue
      const due = record.upkeepDueDay
      if (due === undefined || today <= due) continue
      const overdueDays = today - due
      const wear = def.maintenance.wearPerOverdueDay
      damageUpgrade(
        ctx,
        area.id,
        record.id,
        wear,
        'fitting_upkeep_overdue',
        `${def.label} in ${area.label} is ${overdueDays} day${overdueDays === 1 ? '' : 's'} past its service and wearing out.`,
      )
    }
  }
}

/** Total capacity an area's live builds are holding out of use, per kind. */
export function describeBlockedCapacity(area: AreaState): string[] {
  const lines: string[] = []
  for (const record of Object.values(area.upgrades)) {
    if (record.status !== 'in_progress') continue
    const def = getAreaUpgradeDefinition(record.id)
    const share = def?.blocksCapacityWhileBuilding ?? 0
    if (share <= 0) continue
    lines.push(`${def?.label ?? record.id} closes ${Math.round(share * 100)}%`)
  }
  return lines
}

export { FITTING_BROKEN_CONDITION, capacityOf }
