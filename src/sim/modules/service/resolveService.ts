import type { SimContext } from '../../core/context'
import type {
  AreaState,
  CustomerGroupState,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { spendCoin } from '../stock/ledger'
import { effectiveQuality, isPerishable } from '../stock/spoilage'
import type { CustomerModuleState, CustomerTurnout } from '../customers/types'
import type {
  ServiceQualityModifiers,
  StaffModuleState,
} from '../staff/types'

import type {
  AreaChangeSummary,
  DailyServiceResult,
  PurchaseSummary,
  ServiceIncidentSummary,
  StaffChangeSummary,
} from './types'

// Phase 12 §12.1–12.9 — Service resolver.
//
// The customers module produces per-group turnouts during the `service`
// phase: visitor counts, coin earned, shortages, and the per-group
// area impact. The service module runs *after* the customers module in
// the same `service` phase (declared via `dependsOn`). Its job is to:
//
//   - compute unpaid tabs (Phase 9 `spendCoin`), per Phase 12 §12.6;
//   - apply extra fight-control / mess-control damage adjustments,
//     when the staff module's published modifiers are strong enough to
//     have prevented damage that already landed (rare; mostly a hook
//     for future tuning);
//   - generate structured `ServiceIncidentSummary` records, per §12.7;
//   - aggregate the day into a `DailyServiceResult` written to
//     `state.modules.service`.
//
// All mutations route through Phase 7 §7.3.1 helpers
// (`ctx.modifyArea`, `ctx.modifyStock`, `ctx.modifyStaff`,
// `ctx.modifyCoin`, `ctx.modifyModuleState`). The resolver never
// reaches for the unseeded global PRNG.

const SOURCE = 'service'

function emptyServiceQuality(): ServiceQualityModifiers {
  return {
    foodQualityModifier: 0,
    serviceSpeed: 0,
    tabControl: 0,
    messControl: 0,
    fightControl: 0,
    repairSupport: 0,
    staffSummaries: [],
  }
}

export function readServiceQuality(state: TavernState): ServiceQualityModifiers {
  const slice = state.modules['staff'] as StaffModuleState | undefined
  if (!slice?.serviceQuality) return emptyServiceQuality()
  return slice.serviceQuality
}

function readCustomerTurnouts(state: TavernState): CustomerTurnout[] {
  const slice = state.modules['customers'] as CustomerModuleState | undefined
  return slice?.turnouts ?? []
}

function computeUnpaidTabs(
  group: CustomerGroupState,
  visitors: number,
  coinEarned: number,
  quality: ServiceQualityModifiers,
): number {
  // Phase 12 §12.6 — Unpaid tabs.
  //
  // Each visitor leaves behind a fractional unpaid bill scaled by the
  // group's `tabRisk`. Rowdy groups raise the leak. Server `watch_tabs`
  // / bouncer `intimidate_debtors` reduce it; `maximize_sales` widens
  // it (`tabControl < 0`). Capped at this group's actual coin earned
  // so tabs never produce phantom debt the resolver does not know how
  // to settle yet.
  if (visitors <= 0 || coinEarned <= 0) return 0
  const tabBaseRate = (visitors * group.tabRisk) / 100
  const rowdyBoost = group.rowdiness >= 70 ? 0.25 : 0
  const controlFactor = Math.max(-0.5, Math.min(0.8, quality.tabControl / 4))
  const raw = tabBaseRate * (1 + rowdyBoost) * (1 - controlFactor)
  const tab = Math.round(Math.max(0, raw))
  return Math.min(tab, coinEarned)
}

function recordFoodComplaint(
  ctx: SimContext,
  groupId: string,
  visitors: number,
  quality: ServiceQualityModifiers,
  incidents: ServiceIncidentSummary[],
): void {
  if (visitors <= 0) return
  if (quality.foodQualityModifier >= 0) return
  let total = 0
  let count = 0
  for (const item of Object.values(ctx.state.stock)) {
    if (item.quantity <= 0) continue
    const q = isPerishable(item) ? effectiveQuality(item) : item.quality
    total += q
    count += 1
  }
  if (count === 0) return
  const avg = total / count
  if (avg >= 50) return
  incidents.push({
    id: 'food_complaint',
    severity: Math.min(100, 20 + Math.round((50 - avg) * 2)),
    actorGroup: groupId,
    effects: [`food.quality_avg ${avg.toFixed(1)}`],
  })
}

function generateIncidents(args: {
  group: CustomerGroupState
  turnout: CustomerTurnout
  quality: ServiceQualityModifiers
  dayType: string
  unpaidTabs: number
}): ServiceIncidentSummary[] {
  // Phase 12 §12.7 — Structured incident summaries. No prose; numeric
  // severity plus structured effect strings.
  const incidents: ServiceIncidentSummary[] = []
  const { group, turnout, quality, dayType, unpaidTabs } = args

  // Damage incident. The customers module already applied the damage;
  // we surface it as an incident when meaningful.
  const damageNote = turnout.notes.find((n) =>
    n.includes('main room damage'),
  )
  if (damageNote) {
    const match = damageNote.match(/\+(\d+) main room damage/)
    const delta = match && match[1] ? Number(match[1]) : 0
    if (delta >= 3) {
      incidents.push({
        id: 'chair_damage',
        severity: Math.min(100, 10 + delta * 4),
        actorGroup: group.id,
        areaId: 'main_room',
        effects: [`main_room.damage +${delta}`],
      })
    }
  }

  if (
    dayType === 'brawl_night' &&
    group.rowdiness >= 70 &&
    quality.fightControl < 1.5 &&
    turnout.visitors >= 3
  ) {
    incidents.push({
      id: 'minor_brawl',
      severity: Math.min(100, 30 + Math.round((group.rowdiness - 50) / 2)),
      actorGroup: group.id,
      areaId: 'main_room',
      effects: ['main_room.damage +1', 'satisfaction.rowdy_adjacent -1'],
    })
  }

  for (const shortage of turnout.shortages) {
    incidents.push({
      id: 'stock_shortage',
      severity: Math.min(
        100,
        20 + Math.round((shortage.requested - shortage.available) * 2),
      ),
      actorGroup: group.id,
      effects: [`stock.${shortage.stockId}.shortfall`],
    })
  }

  if (unpaidTabs > 0 && unpaidTabs >= Math.max(2, Math.round(turnout.visitors / 2))) {
    incidents.push({
      id: 'unpaid_tabs',
      severity: Math.min(100, 15 + unpaidTabs * 3),
      actorGroup: group.id,
      effects: [`coin -${unpaidTabs}`],
    })
  }

  return incidents
}

function dayKeyFor(state: TavernState): string {
  const c = state.calendar
  return `${c.year}-${c.month}-${c.day}`
}

export function buildEmptyResult(state: TavernState): DailyServiceResult {
  return {
    dayKey: dayKeyFor(state),
    trafficByGroup: {},
    purchasesByGroup: {},
    coinEarned: 0,
    unpaidTabs: 0,
    netCoinEarned: 0,
    stockConsumed: [],
    shortages: [],
    messCreated: [],
    damageCreated: [],
    satisfactionChanges: [],
    staffChanges: [],
    incidents: [],
    serviceQuality: emptyServiceQuality(),
    // Phase 32 §32.1 — scenes array is always present (possibly empty)
    // so downstream callers can iterate without null-checking.
    scenes: [],
  }
}

function detectAreaChanges(
  before: Record<string, AreaState>,
  after: Record<string, AreaState>,
): { mess: AreaChangeSummary[]; damage: AreaChangeSummary[] } {
  const mess: AreaChangeSummary[] = []
  const damage: AreaChangeSummary[] = []
  for (const [id, a] of Object.entries(after)) {
    const prev = before[id]
    if (!prev) continue
    if (a.mess !== prev.mess) {
      mess.push({
        areaId: id,
        field: 'mess',
        delta: a.mess - prev.mess,
        reason: 'service_day',
      })
    }
    if (a.damage !== prev.damage) {
      damage.push({
        areaId: id,
        field: 'damage',
        delta: a.damage - prev.damage,
        reason: 'service_day',
      })
    }
  }
  return { mess, damage }
}

export type ResolveServiceInputs = {
  /** Snapshot of `state.areas` taken at the start of the service hook,
   *  before the customer module's impact pass. The resolver compares
   *  pre/post snapshots to surface mess/damage deltas. */
  areasBefore: Record<string, AreaState>
  /** Snapshot of `state.stock` taken at the start of the service hook,
   *  used to compute per-item stock consumption deltas. */
  stockBefore: Record<string, { quantity: number }>
}

export function resolveService(
  ctx: SimContext,
  inputs: ResolveServiceInputs,
): DailyServiceResult {
  const turnouts = readCustomerTurnouts(ctx.state)
  const quality = readServiceQuality(ctx.state)
  const dayType = ctx.getDayType()
  const result = buildEmptyResult(ctx.state)
  result.serviceQuality = quality

  for (const turnout of turnouts) {
    const group = ctx.state.customerGroups[turnout.groupId]
    if (!group) continue

    result.trafficByGroup[group.id] = turnout.visitors

    // Group-level purchase rollup. Stock consumption is computed from
    // the global stock delta below so the per-group rollup mirrors the
    // ledger rather than re-walking baskets.
    const unpaidTabs = computeUnpaidTabs(
      group,
      turnout.visitors,
      turnout.coinEarned,
      quality,
    )

    const purchase: PurchaseSummary = {
      groupId: group.id,
      visitors: turnout.visitors,
      coinEarned: turnout.coinEarned,
      unpaidTabs,
      netCoin: turnout.coinEarned - unpaidTabs,
      itemsBought: [],
      shortages: turnout.shortages.map((s) => ({ ...s })),
    }
    result.purchasesByGroup[group.id] = purchase
    result.coinEarned += turnout.coinEarned
    result.shortages.push(...turnout.shortages.map((s) => ({ ...s })))

    if (unpaidTabs > 0) {
      // Cap the deduction at current coin so the strict
      // non-negative-coin schema invariant holds even when tabs
      // outpace day-one capital.
      const deduction = Math.min(ctx.state.coin, unpaidTabs)
      if (deduction > 0) {
        spendCoin(ctx, deduction, {
          source: `service.tabs.${group.id}`,
          category: 'other',
          tags: ['unpaid_tab', group.id],
        })
        result.unpaidTabs += deduction
        purchase.unpaidTabs = deduction
        purchase.netCoin = purchase.coinEarned - deduction
      }
    }

    const incidents = generateIncidents({
      group,
      turnout,
      quality,
      dayType,
      unpaidTabs: purchase.unpaidTabs,
    })
    recordFoodComplaint(ctx, group.id, turnout.visitors, quality, incidents)
    result.incidents.push(...incidents)
  }

  // Area mess/damage deltas from the customers module's impact pass.
  const areaChanges = detectAreaChanges(inputs.areasBefore, ctx.state.areas)
  result.messCreated = areaChanges.mess
  result.damageCreated = areaChanges.damage

  // Stock consumption deltas from the customers module's purchases.
  for (const [id, prev] of Object.entries(inputs.stockBefore)) {
    const after = ctx.state.stock[id]
    if (!after) continue
    const delta = prev.quantity - after.quantity
    if (delta > 0) {
      result.stockConsumed.push({ stockId: id, quantity: delta })
    }
  }

  result.netCoinEarned = result.coinEarned - result.unpaidTabs

  return result
}

// Phase 12 §12.9 — Updates staff stress/fatigue based on the day's
// service. Called from the service module's `afterService` hook so the
// math runs against the fully-resolved `DailyServiceResult`.
export function applyStaffStressFatigue(
  ctx: SimContext,
  result: DailyServiceResult,
): StaffChangeSummary[] {
  const summaries: StaffChangeSummary[] = []
  const totalTraffic = Object.values(result.trafficByGroup).reduce(
    (acc, v) => acc + v,
    0,
  )
  const totalIncidents = result.incidents.length
  const profitable = result.netCoinEarned >= 10

  for (const staff of Object.values(ctx.state.staff)) {
    if (staff.unavailable === true) continue
    const change: StaffChangeSummary = {
      staffId: staff.id,
      stressDelta: 0,
      fatigueDelta: 0,
      moraleDelta: 0,
      notes: [],
    }

    let fatigueDelta = 0
    let stressDelta = 0
    let moraleDelta = 0

    if (staff.role === 'cook' || staff.role === 'server') {
      fatigueDelta += Math.round(totalTraffic / 30)
    } else {
      fatigueDelta += Math.round(totalTraffic / 60)
    }

    if (totalIncidents > 0) {
      if (staff.role === 'server') {
        stressDelta += Math.min(8, totalIncidents * 2)
      }
      if (staff.role === 'cleaner_bouncer') {
        const fightIncidents = result.incidents.filter(
          (i) => i.id === 'minor_brawl' || i.id === 'chair_damage',
        ).length
        stressDelta += Math.min(10, fightIncidents * 3)
      }
      if (staff.role === 'cook') {
        const foodIncidents = result.incidents.filter(
          (i) => i.id === 'food_complaint',
        ).length
        stressDelta += Math.min(6, foodIncidents * 3)
      }
    }

    if (staff.role === 'cook') {
      if (staff.currentPriority === 'quality') {
        stressDelta += 1
        fatigueDelta += 1
      } else if (staff.currentPriority === 'speed') {
        fatigueDelta += 2
      }
    }
    if (staff.role === 'server') {
      if (staff.currentPriority === 'maximize_sales') {
        stressDelta += 2
      }
    }

    if (profitable && totalIncidents === 0) {
      moraleDelta += 1
      change.notes.push('Service went smoothly.')
    }

    const nextStress = clampPercent(staff.stress + stressDelta)
    const nextFatigue = clampPercent(staff.fatigue + fatigueDelta)
    const nextMorale = clampPercent(staff.morale + moraleDelta)

    change.stressDelta = nextStress - staff.stress
    change.fatigueDelta = nextFatigue - staff.fatigue
    change.moraleDelta = nextMorale - staff.morale

    if (
      change.stressDelta !== 0 ||
      change.fatigueDelta !== 0 ||
      change.moraleDelta !== 0
    ) {
      ctx.modifyStaff(
        staff.id,
        {
          stress: nextStress,
          fatigue: nextFatigue,
          morale: nextMorale,
        },
        { source: SOURCE, reason: 'service_recovery' },
      )
      // Phase 17 §17.5 — attribute the staff meter movements so the cause
      // report can explain why stress/fatigue/morale shifted during
      // service. Only emit when the delta crosses the diff-significance
      // threshold (DEFAULT_THRESHOLDS.meter = 5) so trivial drift does
      // not flood the cause log.
      if (Math.abs(change.stressDelta) >= 5) {
        const driver =
          totalIncidents > 0
            ? `${totalIncidents} service incident${totalIncidents === 1 ? '' : 's'} stressed ${staff.name}.`
            : `${staff.name}'s service priority strained them.`
        ctx.addCause({
          source: SOURCE,
          sourceType: 'service',
          target: `staff:${staff.id}.stress`,
          targetType: 'staff',
          amount: change.stressDelta,
          readable: driver,
          tags: ['service', 'staff', staff.id, 'stress'],
          relatedActors: [{ kind: 'staff', id: staff.id }],
          relatedSystems: ['staff', 'service'],
          expiresAfterDays: 7,
        })
      }
      if (Math.abs(change.fatigueDelta) >= 5) {
        ctx.addCause({
          source: SOURCE,
          sourceType: 'service',
          target: `staff:${staff.id}.fatigue`,
          targetType: 'staff',
          amount: change.fatigueDelta,
          readable: `${staff.name} grew fatigued from serving ${totalTraffic} visitors.`,
          tags: ['service', 'staff', staff.id, 'fatigue'],
          relatedActors: [{ kind: 'staff', id: staff.id }],
          relatedSystems: ['staff', 'service'],
          expiresAfterDays: 7,
        })
      }
      if (Math.abs(change.moraleDelta) >= 5) {
        ctx.addCause({
          source: SOURCE,
          sourceType: 'service',
          target: `staff:${staff.id}.morale`,
          targetType: 'staff',
          amount: change.moraleDelta,
          readable:
            change.moraleDelta > 0
              ? `Service went smoothly — ${staff.name}'s morale rose.`
              : `A rough service shift dragged ${staff.name}'s morale down.`,
          tags: ['service', 'staff', staff.id, 'morale'],
          relatedActors: [{ kind: 'staff', id: staff.id }],
          relatedSystems: ['staff', 'service'],
          expiresAfterDays: 7,
        })
      }
    }

    if (fatigueDelta > 0 && change.notes.length === 0) {
      change.notes.push(`Fatigued by ${totalTraffic} visitors.`)
    }

    summaries.push(change)
  }

  return summaries
}

// Phase 12 §12.10 helper — used by the daily service report to find the
// largest positive and negative drivers of the day. Pure function; takes
// only the resolved result.
export function findDayDrivers(result: DailyServiceResult): {
  positive?: string
  negative?: string
} {
  let positive: { id: string; score: number } | undefined
  let negative: { id: string; score: number } | undefined
  for (const purchase of Object.values(result.purchasesByGroup)) {
    if (purchase.coinEarned > 0) {
      const score = purchase.coinEarned
      if (!positive || score > positive.score) {
        positive = { id: purchase.groupId, score }
      }
    }
  }
  for (const incident of result.incidents) {
    if (incident.severity > 0) {
      const score = incident.severity
      if (!negative || score > negative.score) {
        negative = { id: incident.id, score }
      }
    }
  }
  const out: { positive?: string; negative?: string } = {}
  if (positive) out.positive = positive.id
  if (negative) out.negative = negative.id
  return out
}

export function readServiceResult(
  state: TavernState,
): DailyServiceResult | undefined {
  const slice = state.modules['service'] as
    | { result?: DailyServiceResult }
    | undefined
  return slice?.result
}

// Phase 12 §12.4 / §12.8 — Customer-facing satisfaction adjustments derived
// from staff service quality and structured incidents. Returned as a
// (delta, drivers) pair so the customers module can fold the signal into
// its existing satisfaction math without bypassing its `modifyCustomerGroup`
// mutation.
export function satisfactionAdjustmentsFromService(
  groupId: string,
  result: DailyServiceResult | undefined,
  quality: ServiceQualityModifiers,
): { delta: number; drivers: string[] } {
  const drivers: string[] = []
  let delta = 0

  if (quality.foodQualityModifier !== 0) {
    const foodSignal = Math.round(quality.foodQualityModifier)
    if (foodSignal !== 0) {
      delta += foodSignal
      drivers.push(
        foodSignal > 0
          ? 'Cook lifted food quality.'
          : 'Cook stretched ingredients — food suffered.',
      )
    }
  }

  if (result) {
    const groupIncidents = result.incidents.filter(
      (i) => i.actorGroup === groupId,
    )
    if (groupIncidents.length > 0) {
      delta -= groupIncidents.length
      drivers.push(`${groupIncidents.length} incident(s) involving this group.`)
    }
  }

  return { delta, drivers }
}
