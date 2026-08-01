import type { SimContext } from '../../core/context'
import type {
  AreaState,
  RegularWorldState,
  TavernState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { recipeRegistry } from '../../registries/recipeRegistry'
import { outstandingAmount } from '../../contracts/obligations/index'
import { spendCoin } from '../stock/ledger'
import { effectiveQuality, isPerishable } from '../stock/spoilage'
import type { CustomerDemand, CustomerModuleState } from '../customers/types'
import { isTavernTemporarilyClosed } from '../economy/dynamics'
import {
  getAleIngredientUseFactor,
  getServicePriceMultiplier,
  getTabsPolicyAdjustment,
} from '../economy/policies'
import type {
  ServiceQualityModifiers,
  StaffModuleState,
} from '../staff/types'

import { applyServiceAreaImpact } from './flow/areaImpact'
import { generateFlowIncidents } from './flow/flowIncidents'
import { runServiceFlow } from './flow/resolveFlow'
import { emptyFlowResult, type ServiceFlowResult } from './flow/types'
import {
  collectionProbabilityFor,
  listPatronTabs,
  openPatronTab,
  tabForParty,
  type PatronTabIndexEntry,
  type TabDebtorKind,
} from './tabs'
import type {
  AreaChangeSummary,
  DailyServiceResult,
  PurchaseLine,
  ServiceIncidentSummary,
  StaffChangeSummary,
} from './types'

// Phase 12 §12.1–12.9 — Service resolver.
// Expansion Phase 4 §4.1–4.5 — rewritten around the within-service flow.
//
// WHAT THIS FILE USED TO BE. A rollup. The customers module had already sold
// everything and dirtied the main room; this pass added up the totals, took a
// fraction off for unpaid tabs, and emitted four incidents. Nothing in it could
// answer "why did tonight go badly?" beyond "fewer people came".
//
// WHAT IT IS NOW. The orchestrator of one evening:
//
//   1. read tonight's DEMAND from the customers module and the REGULARS who
//      decided to come in;
//   2. run the flow (`flow/resolveFlow.ts`) — the only place stock is sold;
//   3. open the slates the night ran up (`tabs.ts`);
//   4. derive the aggregate `DailyServiceResult` FROM the flow, so the summary
//      and the substeps cannot disagree;
//   5. charge the rooms for the wear (`flow/areaImpact.ts`);
//   6. read the incidents out of what actually happened
//      (`flow/flowIncidents.ts`).
//
// All mutations still route through the Phase 7 §7.3.1 helpers, and the
// resolver still never reaches for the unseeded global PRNG.

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

/** Expansion Phase 4 — tonight's demand, as the customers module published it. */
function readCustomerDemand(state: TavernState): CustomerDemand[] {
  const slice = state.modules['customers'] as CustomerModuleState | undefined
  if (slice?.demand && slice.demand.length > 0) return slice.demand
  // A slice written before this phase has turnouts but no demand. Reading the
  // turnout's `visitors` back out is the honest fallback: that number always
  // meant "who turned up".
  return (slice?.turnouts ?? []).map((turnout) => ({
    groupId: turnout.groupId,
    patrons: turnout.visitors,
    notes: [],
  }))
}

/**
 * Regulars who decided to come in tonight, as the regulars module published
 * them during `regularCustomerUpdate` (which runs before `service`).
 */
function readRegularVisitIntents(state: TavernState): string[] {
  const slice = state.modules['regulars'] as
    | { visitIntents?: ReadonlyArray<{ regularId: string }> }
    | undefined
  return (slice?.visitIntents ?? [])
    .map((intent) => intent.regularId)
    .filter((id) => id in state.world.regulars)
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

function dayKeyFor(state: TavernState): string {
  const c = state.calendar
  return `${c.year}-${c.month}-${c.day}`
}

export function buildEmptyResult(state: TavernState): DailyServiceResult {
  return {
    dayKey: dayKeyFor(state),
    flow: emptyFlowResult(),
    tabsOpened: [],
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

export type ResolveServiceOutput = {
  result: DailyServiceResult
  /** Slates opened tonight, for the service module's persistent index. */
  tabsOpened: PatronTabIndexEntry[]
}

export function resolveService(
  ctx: SimContext,
  inputs: ResolveServiceInputs,
): ResolveServiceOutput {
  const quality = readServiceQuality(ctx.state)
  const dayType = ctx.getDayType()
  const result = buildEmptyResult(ctx.state)
  result.serviceQuality = quality
  if (isTavernTemporarilyClosed(ctx.state)) {
    return { result, tabsOpened: [] }
  }

  // ---- run the evening (§4.1) ----
  const demand = readCustomerDemand(ctx.state)
  const regularVisitIds = readRegularVisitIntents(ctx.state)
  const regularsById: Record<string, RegularWorldState> = {}
  for (const id of regularVisitIds) {
    const regular = ctx.state.world.regulars[id]
    if (regular) regularsById[id] = regular
  }
  const demandByGroup: Record<string, number> = {}
  for (const row of demand) demandByGroup[row.groupId] = row.patrons

  const { result: flow, shortages, stockConsumed } = runServiceFlow(ctx, {
    demandByGroup,
    regularVisitIds,
    regularsById,
  })
  result.flow = flow

  // ---- tabs (§4.5) ----
  // One record per named regular who ran a slate, and one per group for the
  // strangers — so the ledger holds real debtors rather than one row per party.
  const tabs = openTabsForFlow(ctx, {
    flow,
    quality,
    regularsById,
  })
  result.tabsOpened = tabs.opened.map((entry) => entry.obligationId)

  // ---- aggregate rollup, DERIVED from the flow ----
  for (const groupId of Object.keys(flow.demandByGroup).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const group = ctx.state.customerGroups[groupId]
    if (!group) continue
    const coin = Math.round(flow.coinByGroup[groupId] ?? 0)
    const tab = Math.round(flow.tabByGroup[groupId] ?? 0)
    result.trafficByGroup[groupId] = flow.demandByGroup[groupId] ?? 0
    result.purchasesByGroup[groupId] = {
      groupId,
      visitors: flow.demandByGroup[groupId] ?? 0,
      coinEarned: coin,
      unpaidTabs: tab,
      netCoin: coin - tab,
      itemsBought: itemsBoughtFor(ctx, flow, groupId),
      shortages: (flow.shortagesByGroup[groupId] ?? []).map((s) => ({ ...s })),
    }
    result.coinEarned += coin
  }
  result.shortages = shortages.map((s) => ({ ...s }))
  result.unpaidTabs = tabs.totalDeducted
  result.netCoinEarned = result.coinEarned - result.unpaidTabs

  // ---- what the evening did to the rooms (§4.1) ----
  applyServiceAreaImpact(ctx, flow, quality)

  // ---- incidents (§4.4) ----
  const flowIncidents = generateFlowIncidents(ctx, {
    flow,
    quality,
    regularsById,
    dayType,
  })
  for (const incident of flowIncidents) {
    if (incident.id !== 'minor_brawl' || !incident.areaId) continue
    const area = ctx.state.areas[incident.areaId]
    if (!area) continue
    const nextDamage = clampPercent(area.damage + 1)
    if (nextDamage === area.damage) {
      incident.effects = incident.effects
        .filter((effect) => effect !== `${area.id}.damage +1`)
        .concat(`${area.id}.damage already at maximum`)
      continue
    }
    ctx.modifyArea(
      area.id,
      { damage: nextDamage },
      {
        source: `${SOURCE}.incident.minor_brawl`,
        sourceType: 'area',
        target: area.id,
        targetType: 'area',
        amount: nextDamage - area.damage,
        direction: 'increase',
        readable: `A brawl damaged ${area.label}.`,
        tags: ['service', 'incident', 'brawl', area.id],
        relatedLocations: [{ kind: 'area', id: area.id }],
        relatedSystems: ['service', 'areas'],
      },
    )
  }
  result.incidents.push(...flowIncidents)

  // Detect after incident consequences so the daily result and scene/report
  // include the physical damage the brawl itself claims.
  const areaChanges = detectAreaChanges(inputs.areasBefore, ctx.state.areas)
  result.messCreated = areaChanges.mess
  result.damageCreated = areaChanges.damage

  // Stock consumption, from the flow's own sales rather than a global delta:
  // the global delta would also pick up spoilage and any other module that
  // touched the cellar during the same phase.
  for (const stockId of Object.keys(stockConsumed).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const quantity = stockConsumed[stockId] ?? 0
    if (quantity > 0) result.stockConsumed.push({ stockId, quantity })
  }

  // Phase 12's furniture incident, kept and re-grounded. It used to be read
  // back out of a note string the customers module had written; it is now read
  // off the damage the impact pass actually applied, in the room that took it.
  for (const change of result.damageCreated) {
    if (change.delta < 3) continue
    const worst = worstGroupIn(flow, change.areaId)
    result.incidents.push({
      id: 'chair_damage',
      severity: Math.min(100, 10 + change.delta * 4),
      ...(worst ? { actorGroup: worst } : {}),
      areaId: change.areaId,
      effects: [`${change.areaId}.damage +${change.delta}`],
    })
  }
  for (const groupId of Object.keys(result.trafficByGroup).sort((a, b) =>
    a.localeCompare(b),
  )) {
    recordFoodComplaint(
      ctx,
      groupId,
      flow.servedByGroup[groupId] ?? 0,
      quality,
      result.incidents,
    )
  }

  return { result, tabsOpened: tabs.opened }
}

/**
 * Expansion Phase 4 §4.5 — open the night's slates.
 *
 * A named regular gets their own record; everybody else in a group is pooled
 * into one anonymous-cohort record for that group and that night. That is the
 * bound (§5.11): at most one row per regular plus one per group per day, not
 * one per party.
 *
 * The till still comes up short on the night — the money genuinely did not
 * arrive — so net takings match the pre-Phase-4 model exactly. What is new is
 * that the shortfall is a receivable somebody owes.
 */
function openTabsForFlow(
  ctx: SimContext,
  args: {
    flow: ServiceFlowResult
    quality: ServiceQualityModifiers
    regularsById: Record<string, RegularWorldState>
  },
): { opened: PatronTabIndexEntry[]; totalDeducted: number } {
  const { flow, quality, regularsById } = args
  const opened: PatronTabIndexEntry[] = []
  const cohortByGroup: Record<string, number> = {}
  const regularTabs: Array<{ regular: RegularWorldState; amount: number }> = []

  for (const party of flow.parties) {
    if (party.outcome !== 'served' || party.paid <= 0) continue
    const group = ctx.state.customerGroups[party.groupId]
    if (!group) continue
    const regular = party.regularId ? regularsById[party.regularId] : undefined
    const existingRegularDebt = regular
      ? outstandingForRegular(ctx.state, regular.id)
      : 0
    const tab = tabForParty({
      bill: party.paid,
      patrons: party.size,
      group,
      quality,
      ...(regular ? { regular } : {}),
      policyAdjustment: getTabsPolicyAdjustment(ctx.state, regular !== undefined),
      existingRegularDebt,
    })
    if (tab <= 0) continue
    party.tab = Math.round(tab * 100) / 100
    if (regular) {
      regularTabs.push({ regular, amount: tab })
    } else {
      cohortByGroup[party.groupId] = (cohortByGroup[party.groupId] ?? 0) + tab
    }
  }

  let totalDeducted = 0
  /**
   * Book one debtor's slate: round once, take the coin off the till, and move
   * the group's published totals by the SAME rounded figure so the flow's
   * `coinByGroup + tabByGroup` still adds up to what was billed.
   */
  const record = (
    make: (rounded: number) => PatronTabIndexEntry | undefined,
    groupId: string,
    raw: number,
  ): void => {
    const amount = Math.round(raw)
    if (amount <= 0) return
    const entry = make(amount)
    if (!entry) return
    // `coinByGroup` stays GROSS — what the group's bill came to — and the slate
    // is recorded beside it. Netting it off here would have subtracted the tab
    // twice, because `netCoinEarned` is `coinEarned − unpaidTabs`; that is the
    // arithmetic the pre-Phase-4 result used, and the ledger's `sales` total is
    // gross, so gross is what the two have to agree on.
    flow.tabByGroup[groupId] = (flow.tabByGroup[groupId] ?? 0) + amount
    // Cap the till hit at what is actually in it, so the schema's
    // non-negative-coin invariant holds even when a night goes badly.
    const deduction = Math.min(ctx.state.coin, amount)
    if (deduction > 0) {
      spendCoin(ctx, deduction, {
        source: `service.tabs.${entry.debtorId}`,
        category: 'other',
        tags: ['unpaid_tab', entry.groupId, entry.debtorId],
      })
      totalDeducted += deduction
    }
    opened.push(entry)
  }

  // A regular can be in more than one party over an evening; pool their night
  // into one slate rather than several.
  const regularTotals = new Map<string, { regular: RegularWorldState; amount: number }>()
  for (const { regular, amount } of regularTabs) {
    const row = regularTotals.get(regular.id) ?? { regular, amount: 0 }
    row.amount += amount
    regularTotals.set(regular.id, row)
  }
  for (const regularId of [...regularTotals.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const { regular, amount } = regularTotals.get(regularId)!
    const group = ctx.state.customerGroups[regular.customerGroupId]
    if (!group) continue
    record(
      (rounded) =>
        openPatronTab(ctx, {
          amount: rounded,
          groupId: group.id,
          debtorKind: 'regular',
          debtorId: regular.id,
          collectionProbability: collectionProbabilityFor({
            debtorKind: 'regular',
            group,
            regular,
            quality,
          }),
          readable: `${regular.name.display} owes ${rounded} coin on the slate.`,
        }),
      group.id,
      amount,
    )
  }

  for (const groupId of Object.keys(cohortByGroup).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const amount = cohortByGroup[groupId] ?? 0
    const group = ctx.state.customerGroups[groupId]
    if (!group || amount <= 0) continue
    // Identity level: a crowd you can name is a group; one you cannot is
    // anonymous. Loyal crowds are recognisable — that is what loyalty means
    // here — so the same debt is worth more from people who come back.
    const debtorKind: TabDebtorKind = group.loyalty >= 55 ? 'group' : 'anonymous'
    const debtorId = debtorKind === 'group' ? group.id : `${group.id}_strangers`
    record(
      (rounded) =>
        openPatronTab(ctx, {
          amount: rounded,
          groupId: group.id,
          debtorKind,
          debtorId,
          collectionProbability: collectionProbabilityFor({
            debtorKind,
            group,
            quality,
          }),
          readable:
            debtorKind === 'group'
              ? `The ${group.label} owe ${rounded} coin from tonight.`
              : `${rounded} coin walked out with strangers among the ${group.label}.`,
        }),
      group.id,
      amount,
    )
  }

  return { opened, totalDeducted }
}

/** The group that put the most bodies in this room tonight. */
function worstGroupIn(
  flow: ServiceFlowResult,
  areaId: string,
): string | undefined {
  const byGroup = new Map<string, number>()
  for (const party of flow.parties) {
    if (party.areaId !== areaId || party.seatedWave === undefined) continue
    byGroup.set(party.groupId, (byGroup.get(party.groupId) ?? 0) + party.size)
  }
  return [...byGroup.entries()].sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  )[0]?.[0]
}

/** What a named regular already owes across every live slate. */
function outstandingForRegular(state: TavernState, regularId: string): number {
  return listPatronTabs(state)
    .filter((record) => record.counterparty.id === regularId)
    .reduce((sum, entry) => sum + outstandingAmount(entry), 0)
}

/** Per-stock rollup of what a group actually got, from the flow's order lines. */
function itemsBoughtFor(
  ctx: SimContext,
  flow: ServiceFlowResult,
  groupId: string,
): PurchaseLine[] {
  const byStock = new Map<string, { quantity: number; coin: number }>()
  for (const party of flow.parties) {
    if (party.groupId !== groupId) continue
    for (const line of party.order) {
      if (line.delivered <= 0) continue
      if (!recipeRegistry.has(line.recipeId)) continue
      const recipe = recipeRegistry.get(line.recipeId)
      const ingredientUseFactor = recipe.tags.includes('alcohol')
        ? getAleIngredientUseFactor(ctx.state)
        : 1
      for (const input of recipe.inputs) {
        const quantity = line.delivered * input.quantity * ingredientUseFactor
        const billableQuantity = line.delivered * input.quantity
        const price = ctx.state.stock[input.ingredientId]?.salePrice ?? 0
        const row = byStock.get(input.ingredientId) ?? { quantity: 0, coin: 0 }
        row.quantity += quantity
        row.coin +=
          billableQuantity * price * getServicePriceMultiplier(ctx.state, groupId)
        byStock.set(input.ingredientId, row)
      }
    }
  }
  return [...byStock.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([stockId, row]) => ({
      stockId,
      quantity: row.quantity,
      coin: Math.round(row.coin),
    }))
}

// Phase 12 §12.9 — Updates staff stress/fatigue based on the day's
// service. Called from the service module's `afterService` hook so the
// math runs against the fully-resolved `DailyServiceResult`.
/**
 * The staff module's roster row for this member, if the day produced one.
 *
 * Read through the slice rather than imported from the staff module's own
 * accessor to keep the dependency one-directional: the service module reads
 * staff's published state, and staff never reads service's.
 */
function readStaffRosterRow(
  ctx: SimContext,
  staffId: string,
): { fatigueAdded: number; stressAdded: number } | undefined {
  const slice = ctx.state.modules['staff'] as
    | { roster?: Array<{ staffId: string; fatigueAdded: number; stressAdded: number }> }
    | undefined
  return slice?.roster?.find((row) => row.staffId === staffId)
}

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

    // Expansion Phase 3 §5.4 — the STAFF module now owns staff fatigue and
    // stress. The rule that used to live here (traffic ÷ 30 or ÷ 60 by role, plus
    // per-priority strain and per-incident stress) moved to
    // `staff/roster.ts applyDayLoad`, where the phase's own burdens — overtime, a
    // short-handed rota, bad blood on a station — are added on top and the whole
    // thing keys off WORK KIND rather than role.
    //
    // Leaving a copy here would have been two writers of one meter, both charging
    // for the same day: the player's fatigue would have climbed at twice the rate
    // either rule intended. So this reads the roster row the staff module already
    // wrote (the staff module runs at pipeline position 61, this at 71) and keeps
    // only the MORALE half, which is genuinely about how service went rather than
    // about the rota.
    const rosterRow = readStaffRosterRow(ctx, staff.id)
    let fatigueDelta = 0
    let stressDelta = 0
    let moraleDelta = 0

    if (profitable && totalIncidents === 0) {
      moraleDelta += 1
      change.notes.push('Service went smoothly.')
    }

    const nextMorale = clampPercent(staff.morale + moraleDelta)

    // Reported, not applied: these are the staff module's numbers, quoted so the
    // service report can still say what the day cost the crew.
    change.stressDelta = rosterRow?.stressAdded ?? 0
    change.fatigueDelta = rosterRow?.fatigueAdded ?? 0
    change.moraleDelta = nextMorale - staff.morale
    stressDelta = change.stressDelta
    fatigueDelta = change.fatigueDelta

    if (change.moraleDelta !== 0) {
      ctx.modifyStaff(
        staff.id,
        { morale: nextMorale },
        { source: SOURCE, reason: 'service_recovery' },
      )
      // Phase 17 §17.5 — attribute the staff morale movement so the cause
      // report can explain why it shifted during service. Only emit when the
      // delta crosses the diff-significance threshold
      // (DEFAULT_THRESHOLDS.meter = 5) so trivial drift does not flood the log.
      //
      // Expansion Phase 3 — no stress or fatigue cause here any more: the staff
      // module emitted one when it made the change, and a second cause for the
      // same movement would count it twice in the causality audit.
      if (Math.abs(change.moraleDelta) >= 5) {
        ctx.addCause({
          source: SOURCE,
          sourceType: 'service',
          target: `staff:${staff.id}.morale`,
          targetType: 'staff',
          amount: change.moraleDelta,
          readable:
            change.moraleDelta > 0
              ? `Service went smoothly — ${staff.name.display}'s morale rose.`
              : `A rough service shift dragged ${staff.name.display}'s morale down.`,
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
    // Reported straight off the roster row, so the note names the Phase 3 burden
    // that the traffic figure above cannot explain on its own.
    if (rosterRow && stressDelta > 0 && change.notes.length === 0) {
      change.notes.push(`Strained by the day's rota.`)
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
