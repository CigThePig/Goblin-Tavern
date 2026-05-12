import type { SimContext } from '../../core/context'
import type {
  EntityRef,
  FactionWorldState,
  RegularWorldState,
  SocialRumourState,
  SupplierWorldState,
} from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'

import {
  getOwnerActionsModuleState,
  isPolicyEnabled,
} from '../ownerActions/stateHelpers'
import type {
  OwnerSocialActionRecord,
} from '../ownerActions/types'

import type {
  WeeklyCommunityResult,
  WeeklyCommunityRumour,
  WeeklyCommunityRumourSource,
  WeeklyFactionTrendEntry,
  WeeklyModuleState,
  WeeklyRegularTrendEntry,
  WeeklyResult,
  WeeklySupplierTrendEntry,
} from './types'

// Phase 34 — Weekly community routine.
//
// `resolveWeeklyCommunity` runs at the end of the week, after wages and
// trends have resolved but before the report is built. It walks the
// world entities introduced in Phases 29–30 (suppliers, regulars,
// factions) plus the social action audit ring from Phase 33 and the
// service scenes from Phase 32 (surfaced through the weekly memory and
// scene-count accumulators), then:
//
//   1. Updates supplier `relationship` / `reliability` based on
//      shortages affecting their goods and the social actions
//      performed against them.
//   2. Updates regular `loyalty` / `irritation` based on apologies,
//      tab policies, and the count of scenes they appeared in this
//      week.
//   3. Updates faction `relationship` / `tension` based on host
//      actions, the `ban_weapons_inside` policy, and tag-matched
//      group satisfaction movement.
//   4. Generates rumours for the most notable changes (water-ale
//      policy, repeated regular complaints, hosted faction nights).
//      Rumours that should outlive the report are also persisted to
//      `state.world.socialRumours`.
//
// Deltas are intentionally modest (single-digit). Sustained pressure
// has to come from multiple weeks; one bad week cannot detonate a
// supplier relationship by itself.

const SOURCE = 'weekly.community'

// Bounds for weekly relationship/loyalty/irritation deltas (per Phase
// 21 / 34 "modest changes" rule). Clamp shifts before applying so a
// runaway accumulator cannot move a meter by more than this in one
// pass.
const MAX_RELATIONSHIP_DELTA = 6
const MAX_RELIABILITY_DELTA = 4
const MAX_PRICE_PRESSURE_DELTA = 4
const MAX_LOYALTY_DELTA = 6
const MAX_IRRITATION_DELTA = 8
const MAX_SATISFACTION_DELTA = 5
const MAX_TENSION_DELTA = 5

function clampDelta(value: number, max: number): number {
  if (value > max) return max
  if (value < -max) return -max
  return value
}

function pushNote(notes: string[], note: string): void {
  if (note.length === 0) return
  if (!notes.includes(note)) notes.push(note)
}

// ---------- Suppliers ----------

function findSuppliersForStockId(
  suppliers: ReadonlyArray<SupplierWorldState>,
  stockId: string,
): SupplierWorldState[] {
  return suppliers.filter((s) => s.goodsProvided.includes(stockId))
}

function supplierWeeklyTrend(
  ctx: SimContext,
  slice: WeeklyModuleState,
  socialActions: ReadonlyArray<OwnerSocialActionRecord>,
): WeeklySupplierTrendEntry[] {
  const suppliers = Object.values(ctx.state.world.suppliers)
  if (suppliers.length === 0) return []

  const entries: WeeklySupplierTrendEntry[] = []
  // Social actions targeted at suppliers this week.
  const negotiatedThisWeek = new Set<string>()
  for (const record of socialActions) {
    if (record.targetType !== 'supplier') continue
    if (record.outcome !== 'improved') continue
    if (!withinThisWeek(ctx, record.day)) continue
    negotiatedThisWeek.add(record.targetId)
  }

  for (const supplier of suppliers) {
    const notes: string[] = []
    let relationshipDelta = 0
    let reliabilityDelta = 0
    let pricePressureDelta = 0

    // Shortages on stock this supplier provides hurt their reliability
    // and slightly raise price pressure (the market reads scarcity).
    let supplierShortageCount = 0
    for (const stockId of supplier.goodsProvided) {
      const count = slice.shortageCountByStock[stockId] ?? 0
      supplierShortageCount += count
    }
    if (supplierShortageCount > 0) {
      reliabilityDelta -= Math.min(MAX_RELIABILITY_DELTA, supplierShortageCount)
      pricePressureDelta += Math.min(
        MAX_PRICE_PRESSURE_DELTA,
        Math.ceil(supplierShortageCount / 2),
      )
      pushNote(
        notes,
        `Shortages on ${supplier.goodsProvided.join(', ')} (${supplierShortageCount}) eroded reliability.`,
      )
    }

    if (negotiatedThisWeek.has(supplier.id)) {
      relationshipDelta += 3
      reliabilityDelta += 1
      pushNote(notes, 'Successful negotiation lifted the relationship.')
    }

    // Steady purchases nudge relationship up modestly. We approximate
    // "steady purchases" as "no shortages on this supplier's goods AND
    // at least one of their goods sold this week".
    if (supplierShortageCount === 0) {
      const hadSales = supplier.goodsProvided.some(
        (id) => (slice.salesByStockId[id] ?? 0) > 0,
      )
      if (hadSales) {
        relationshipDelta += 1
        pushNote(notes, 'Consistent purchases edged the relationship up.')
      }
    }

    relationshipDelta = clampDelta(relationshipDelta, MAX_RELATIONSHIP_DELTA)
    reliabilityDelta = clampDelta(reliabilityDelta, MAX_RELIABILITY_DELTA)
    pricePressureDelta = clampDelta(pricePressureDelta, MAX_PRICE_PRESSURE_DELTA)

    if (
      relationshipDelta === 0 &&
      reliabilityDelta === 0 &&
      pricePressureDelta === 0
    ) {
      // Quiet week for this supplier — skip the entry.
      continue
    }

    const nextRelationship = clampPercent(
      supplier.relationship + relationshipDelta,
    )
    const nextReliability = clampPercent(supplier.reliability + reliabilityDelta)

    if (
      nextRelationship !== supplier.relationship ||
      nextReliability !== supplier.reliability
    ) {
      ctx.modifySupplier(
        supplier.id,
        { relationship: nextRelationship, reliability: nextReliability },
        {
          source: `${SOURCE}.supplier_trend`,
          sourceType: 'weekly',
          target: supplier.id,
          targetType: 'supplier',
          amount: relationshipDelta,
          readable: `${supplier.label} relationship ${supplier.relationship} → ${nextRelationship}.`,
          tags: ['weekly', 'community', 'supplier', supplier.id],
          relatedSystems: ['weekly', 'suppliers'],
        },
      )
    }

    const actualRelationshipDelta = nextRelationship - supplier.relationship
    const actualReliabilityDelta = nextReliability - supplier.reliability

    if (actualRelationshipDelta !== 0) {
      ctx.addCause({
        source: `${SOURCE}.supplier_relationship`,
        sourceType: 'weekly',
        target: supplier.id,
        targetType: 'supplier',
        amount: actualRelationshipDelta,
        readable: `Weekly community routine moved ${supplier.label} relationship by ${actualRelationshipDelta}.`,
        tags: ['weekly', 'community', 'supplier'],
        relatedSystems: ['weekly', 'suppliers'],
      })
    }

    entries.push({
      supplierId: supplier.id,
      relationshipDelta: actualRelationshipDelta,
      reliabilityDelta: actualReliabilityDelta,
      pricePressureDelta,
      notes,
    })
  }

  return entries
}

// ---------- Regulars ----------

function regularWeeklyTrend(
  ctx: SimContext,
  slice: WeeklyModuleState,
  socialActions: ReadonlyArray<OwnerSocialActionRecord>,
): WeeklyRegularTrendEntry[] {
  const regulars = Object.values(ctx.state.world.regulars)
  if (regulars.length === 0) return []

  // Social actions targeting regulars this week.
  const apologizedThisWeek = new Set<string>()
  for (const record of socialActions) {
    if (record.targetType !== 'regular') continue
    if (record.outcome !== 'improved') continue
    if (!withinThisWeek(ctx, record.day)) continue
    apologizedThisWeek.add(record.targetId)
  }

  const allowTabs = isPolicyEnabled(ctx.state, 'allow_tabs_for_regulars')
  const refuseTabs = isPolicyEnabled(ctx.state, 'refuse_tabs')
  const waterAle = isPolicyEnabled(ctx.state, 'water_ale_quietly')

  const entries: WeeklyRegularTrendEntry[] = []

  for (const regular of regulars) {
    const notes: string[] = []
    let loyaltyDelta = 0
    let irritationDelta = 0

    const sceneCount = slice.regularSceneCounts[regular.id] ?? 0
    const visitsThisWeek = slice.regularVisitsById[regular.id] ?? 0

    if (apologizedThisWeek.has(regular.id)) {
      loyaltyDelta += 3
      irritationDelta -= 5
      pushNote(notes, 'Owner apologized this week — irritation eased.')
    }

    if (sceneCount > 0) {
      irritationDelta += Math.min(MAX_IRRITATION_DELTA, sceneCount * 2)
      pushNote(
        notes,
        `Appeared in ${sceneCount} complaint scene${sceneCount === 1 ? '' : 's'}.`,
      )
    }

    if (allowTabs) {
      loyaltyDelta += 1
      pushNote(notes, 'Tabs allowed for regulars boosted loyalty.')
    } else if (refuseTabs && regular.loyalty >= 60) {
      irritationDelta += 1
      pushNote(notes, 'Refusing tabs irritated long-time regular.')
    }

    if (waterAle) {
      // Long-loyalty regulars notice watered ale faster than newcomers.
      irritationDelta += regular.loyalty >= 60 ? 2 : 1
      pushNote(notes, 'Suspects the ale is watered down.')
    }

    if (visitsThisWeek === 0 && regular.lastSeenDay < ctx.state.calendar.totalDaysElapsed - 6) {
      irritationDelta += 1
      pushNote(notes, 'Did not visit this week.')
    } else if (visitsThisWeek >= 3) {
      loyaltyDelta += 1
      pushNote(notes, 'Visited frequently this week.')
    }

    loyaltyDelta = clampDelta(loyaltyDelta, MAX_LOYALTY_DELTA)
    irritationDelta = clampDelta(irritationDelta, MAX_IRRITATION_DELTA)

    if (loyaltyDelta === 0 && irritationDelta === 0 && visitsThisWeek === 0) {
      continue
    }

    const nextLoyalty = clampPercent(regular.loyalty + loyaltyDelta)
    const nextIrritation = clampPercent(regular.irritation + irritationDelta)

    if (
      nextLoyalty !== regular.loyalty ||
      nextIrritation !== regular.irritation
    ) {
      ctx.modifyRegular(
        regular.id,
        { loyalty: nextLoyalty, irritation: nextIrritation },
        {
          source: `${SOURCE}.regular_trend`,
          sourceType: 'weekly',
          target: regular.id,
          targetType: 'regular',
          amount: loyaltyDelta - irritationDelta,
          readable: `${regular.name.display} loyalty ${regular.loyalty} → ${nextLoyalty}, irritation ${regular.irritation} → ${nextIrritation}.`,
          tags: ['weekly', 'community', 'regular', regular.id],
          relatedActors: [{ kind: 'regular', id: regular.id }],
          relatedSystems: ['weekly', 'regulars'],
        },
      )
    }

    const actualLoyaltyDelta = nextLoyalty - regular.loyalty
    const actualIrritationDelta = nextIrritation - regular.irritation

    if (actualIrritationDelta !== 0) {
      ctx.addCause({
        source: `${SOURCE}.regular_irritation`,
        sourceType: 'weekly',
        target: `regular:${regular.id}.irritation`,
        targetType: 'regular',
        amount: actualIrritationDelta,
        readable: `${regular.name.display} ${actualIrritationDelta > 0 ? 'became more irritated' : 'calmed down'} this week.`,
        tags: ['weekly', 'community', 'regular', 'irritation'],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['weekly', 'regulars'],
      })
    }

    entries.push({
      regularId: regular.id,
      loyaltyDelta: actualLoyaltyDelta,
      irritationDelta: actualIrritationDelta,
      visitsThisWeek,
      notes,
    })
  }

  return entries
}

// ---------- Factions ----------

function factionGroupTagMatches(
  faction: FactionWorldState,
  groupTags: ReadonlyArray<string>,
): boolean {
  for (const tag of faction.tags) {
    if (groupTags.includes(tag)) return true
  }
  return false
}

function factionWeeklyTrend(
  ctx: SimContext,
  slice: WeeklyModuleState,
  socialActions: ReadonlyArray<OwnerSocialActionRecord>,
): WeeklyFactionTrendEntry[] {
  const factions = Object.values(ctx.state.world.factions)
  if (factions.length === 0) return []

  const hostedThisWeek = new Set<string>()
  for (const record of socialActions) {
    if (record.targetType !== 'faction') continue
    if (!withinThisWeek(ctx, record.day)) continue
    if (record.actionId === 'host_faction_night') hostedThisWeek.add(record.targetId)
  }

  const banWeapons = isPolicyEnabled(ctx.state, 'ban_weapons_inside')
  const minersDiscount = isPolicyEnabled(ctx.state, 'serve_miners_discount')
  const groups = Object.values(ctx.state.customerGroups)

  const entries: WeeklyFactionTrendEntry[] = []

  for (const faction of factions) {
    const notes: string[] = []
    let satisfactionDelta = 0
    let tensionDelta = 0

    if (hostedThisWeek.has(faction.id)) {
      satisfactionDelta += 3
      tensionDelta -= 1
      pushNote(notes, 'Hosted faction night raised satisfaction.')
    }

    if (banWeapons) {
      // Town-watch / inspection-authority factions appreciate the
      // rule; rowdy or violence-sensitive factions resent it. We use
      // tag presence as a proxy so seeded factions from Phase 30 land
      // on the correct side without bespoke per-faction checks.
      if (
        faction.id === 'town_watch' ||
        faction.tags.includes('inspection_authority') ||
        faction.tags.includes('respectable')
      ) {
        satisfactionDelta += 1
        pushNote(notes, 'Weapons ban improved standing with this faction.')
      }
      if (faction.tags.includes('rowdy') || faction.tags.includes('outlaw')) {
        tensionDelta += 2
        pushNote(notes, 'Weapons ban grated on this faction.')
      }
    }

    if (
      minersDiscount &&
      (faction.id === 'miners_union' ||
        faction.tags.includes('worker') ||
        faction.cultureId === 'miner_workcrew')
    ) {
      satisfactionDelta += 1
      pushNote(notes, 'Miner discount policy improved satisfaction.')
    }

    // Use customer-group satisfaction drift as a faction influence proxy.
    for (const group of groups) {
      if (!factionGroupTagMatches(faction, group.tags) && faction.cultureId !== group.cultureId) {
        continue
      }
      const start = slice.startingSatisfaction[group.id] ?? group.satisfaction
      const drift = group.satisfaction - start
      if (drift <= -10) {
        tensionDelta += 1
        pushNote(notes, `${group.label} satisfaction dropped — faction notices.`)
      } else if (drift >= 10) {
        satisfactionDelta += 1
        pushNote(notes, `${group.label} satisfaction climbed — faction notices.`)
      }
    }

    satisfactionDelta = clampDelta(satisfactionDelta, MAX_SATISFACTION_DELTA)
    tensionDelta = clampDelta(tensionDelta, MAX_TENSION_DELTA)

    if (satisfactionDelta === 0 && tensionDelta === 0) continue

    const nextRelationship = clampPercent(
      faction.relationship + satisfactionDelta,
    )
    const nextFear = clampPercent(faction.fear + Math.max(0, tensionDelta))
    const nextTrust = clampPercent(faction.trust + (tensionDelta < 0 ? 1 : 0))

    if (
      nextRelationship !== faction.relationship ||
      nextFear !== faction.fear ||
      nextTrust !== faction.trust
    ) {
      ctx.modifyFaction(
        faction.id,
        { relationship: nextRelationship, fear: nextFear, trust: nextTrust },
        {
          source: `${SOURCE}.faction_trend`,
          sourceType: 'weekly',
          target: faction.id,
          targetType: 'faction',
          amount: satisfactionDelta - tensionDelta,
          readable: `${faction.label} relationship ${faction.relationship} → ${nextRelationship}.`,
          tags: ['weekly', 'community', 'faction', faction.id],
          relatedSystems: ['weekly', 'factions'],
        },
      )
    }

    const actualSatisfactionDelta = nextRelationship - faction.relationship

    if (actualSatisfactionDelta !== 0) {
      ctx.addCause({
        source: `${SOURCE}.faction_relationship`,
        sourceType: 'weekly',
        target: faction.id,
        targetType: 'faction',
        amount: actualSatisfactionDelta,
        readable: `${faction.label} relationship shifted ${actualSatisfactionDelta} this week.`,
        tags: ['weekly', 'community', 'faction'],
        relatedSystems: ['weekly', 'factions'],
      })
    }

    entries.push({
      factionId: faction.id,
      satisfactionDelta: actualSatisfactionDelta,
      tensionDelta,
      notes,
    })
  }

  return entries
}

// ---------- Rumours ----------

function withinThisWeek(ctx: SimContext, day: number): boolean {
  const today = ctx.state.calendar.totalDaysElapsed
  return today - day >= 0 && today - day < 7
}

function makeRumourId(ctx: SimContext, kind: string): string {
  const week = ctx.state.calendar.week
  const month = ctx.state.calendar.month
  const year = ctx.state.calendar.year
  return `rumour_Y${year}M${month}W${week}_${kind}`
}

function buildRumour(args: {
  ctx: SimContext
  id: string
  sourceType: WeeklyCommunityRumourSource
  sourceId: string
  summary: string
  strength: number
  accuracy: SocialRumourState['accuracy']
  tags: string[]
  involvedRefs: EntityRef[]
}): WeeklyCommunityRumour {
  const { id, sourceType, sourceId, summary, strength, accuracy, tags, involvedRefs } = args
  return {
    id,
    sourceType,
    sourceId,
    strength: clampPercent(strength),
    accuracy,
    tags: [...tags],
    involvedRefs: [...involvedRefs],
    summary,
  }
}

function persistRumour(
  ctx: SimContext,
  rumour: WeeklyCommunityRumour,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const existing = ctx.state.world.socialRumours[rumour.id]
  if (existing) {
    const nextStrength = clampPercent(
      Math.max(existing.strength, rumour.strength),
    )
    ctx.modifySocialRumour(
      rumour.id,
      {
        strength: nextStrength,
        lastSpreadDay: today,
        tags: Array.from(new Set([...existing.tags, ...rumour.tags])),
        involvedRefs: rumour.involvedRefs,
      },
      {
        source: `${SOURCE}.rumour_refresh`,
        sourceType: 'weekly',
        target: rumour.id,
        targetType: 'rumour',
        amount: nextStrength - existing.strength,
        readable: `Rumour "${rumour.summary}" refreshed.`,
        tags: ['weekly', 'community', 'rumour', ...rumour.tags],
        relatedSystems: ['weekly'],
      },
    )
    return
  }
  const persisted: SocialRumourState = {
    id: rumour.id,
    label: rumour.summary,
    strength: rumour.strength,
    accuracy: rumour.accuracy,
    firstHeardDay: today,
    lastSpreadDay: today,
    tags: [...rumour.tags],
    involvedRefs: [...rumour.involvedRefs],
  }
  // Mutate the world container directly. The pattern matches the
  // regulars module's `ctx.state.world.regulars[id] = regular` write
  // (see `regularModule.ts` §"createRegular"): there is no `addRumour`
  // helper, but `state` is a live getter on `runtime.current`, so the
  // assignment lands on the active state. The follow-up `addCause`
  // call records the change so the cause trail still attributes it.
  ctx.state.world.socialRumours[rumour.id] = persisted
  ctx.addCause({
    source: `${SOURCE}.rumour_started`,
    sourceType: 'weekly',
    target: rumour.id,
    targetType: 'rumour',
    amount: rumour.strength,
    readable: `Rumour started: "${rumour.summary}".`,
    tags: ['weekly', 'community', 'rumour', 'new', ...rumour.tags],
    relatedSystems: ['weekly'],
  })
}

function generateRumours(
  ctx: SimContext,
  slice: WeeklyModuleState,
  socialActions: ReadonlyArray<OwnerSocialActionRecord>,
  supplierTrend: ReadonlyArray<WeeklySupplierTrendEntry>,
  regularTrend: ReadonlyArray<WeeklyRegularTrendEntry>,
  factionTrend: ReadonlyArray<WeeklyFactionTrendEntry>,
): WeeklyCommunityRumour[] {
  const rumours: WeeklyCommunityRumour[] = []

  // Watered-ale policy → "tavern waters down ale" rumour, partial truth.
  if (isPolicyEnabled(ctx.state, 'water_ale_quietly')) {
    // Strength scales with regular irritation totals: louder regulars,
    // louder rumour.
    let strength = 25
    for (const trend of regularTrend) {
      if (trend.irritationDelta > 0) strength += trend.irritationDelta * 2
    }
    rumours.push(
      buildRumour({
        ctx,
        id: makeRumourId(ctx, 'tavern_waters_ale'),
        sourceType: 'policy',
        sourceId: 'water_ale_quietly',
        summary: 'The tavern waters down ale.',
        strength,
        accuracy: 'partial',
        tags: ['rumour', 'ale', 'policy'],
        involvedRefs: regularTrend
          .filter((t) => t.irritationDelta > 0)
          .slice(0, 3)
          .map((t) => ({ kind: 'regular', id: t.regularId })),
      }),
    )
  }

  // Repeated complaint scenes → "bouncer is rough with X" or similar.
  const sceneTotals = slice.sceneTypeCounts
  if ((sceneTotals['brawl_aftermath'] ?? 0) >= 2) {
    rumours.push(
      buildRumour({
        ctx,
        id: makeRumourId(ctx, 'tavern_brawls'),
        sourceType: 'incident',
        sourceId: 'brawl_aftermath',
        summary: 'Brawls keep breaking out at this tavern.',
        strength: 30 + (sceneTotals['brawl_aftermath'] ?? 0) * 8,
        accuracy: 'true',
        tags: ['rumour', 'brawl', 'violence'],
        involvedRefs: [],
      }),
    )
  }

  // Apology → "owner apologized to X" rumour, true, ephemeral (not
  // persisted long; weekly report only unless strong).
  for (const record of socialActions) {
    if (record.actionId !== 'apologize_to_regular') continue
    if (!withinThisWeek(ctx, record.day)) continue
    const regular = ctx.state.world.regulars[record.targetId] as
      | RegularWorldState
      | undefined
    if (!regular) continue
    rumours.push(
      buildRumour({
        ctx,
        id: makeRumourId(ctx, `owner_apologized_${record.targetId}`),
        sourceType: 'service_scene',
        sourceId: record.id,
        summary: `The owner apologized to ${regular.name.display}.`,
        strength: 30,
        accuracy: 'true',
        tags: ['rumour', 'apology', 'regular'],
        involvedRefs: [{ kind: 'regular', id: regular.id }],
      }),
    )
  }

  // Hosted faction night → "tavern is friendly to X" rumour.
  for (const entry of factionTrend) {
    if (entry.satisfactionDelta < 3) continue
    const faction = ctx.state.world.factions[entry.factionId]
    if (!faction) continue
    rumours.push(
      buildRumour({
        ctx,
        id: makeRumourId(ctx, `friendly_to_${faction.id}`),
        sourceType: 'faction',
        sourceId: faction.id,
        summary: `The tavern is friendly to ${faction.label}.`,
        strength: 25 + entry.satisfactionDelta * 3,
        accuracy: 'partial',
        tags: ['rumour', 'faction', faction.id],
        involvedRefs: [{ kind: 'faction', id: faction.id }],
      }),
    )
  }

  // Supplier deeply damaged → "X delivers bad goods" rumour.
  for (const entry of supplierTrend) {
    if (entry.reliabilityDelta > -3) continue
    const supplier = ctx.state.world.suppliers[entry.supplierId]
    if (!supplier) continue
    rumours.push(
      buildRumour({
        ctx,
        id: makeRumourId(ctx, `bad_supplier_${supplier.id}`),
        sourceType: 'supplier',
        sourceId: supplier.id,
        summary: `${supplier.label} delivers questionable goods.`,
        strength: 25 + Math.abs(entry.reliabilityDelta) * 4,
        accuracy: 'partial',
        tags: ['rumour', 'supplier', supplier.id],
        involvedRefs: [{ kind: 'supplier', id: supplier.id }],
      }),
    )
  }

  // Persist rumours strong enough to matter beyond the report. The
  // threshold is intentionally generous: a brand-new low-strength
  // rumour persists at 20, where Phase 16 memory aging still drains
  // it over a few weeks if it does not get refreshed.
  for (const rumour of rumours) {
    if (rumour.strength >= 20) {
      persistRumour(ctx, rumour)
    }
  }

  // Add history for any new rumour started this week.
  for (const rumour of rumours) {
    ctx.addHistory({
      category: 'weekly',
      summary: `Rumour: ${rumour.summary}`,
      tags: ['weekly', 'community', 'rumour', ...rumour.tags],
      relatedSystems: ['weekly'],
      mechanicalRefs: [rumour.id],
    })
  }

  return rumours
}

// ---------- Entry point ----------

export type ResolveWeeklyCommunityArgs = {
  ctx: SimContext
  currentWeeklyState: WeeklyModuleState
  baseWeeklyResult: WeeklyResult
}

function emitEntityMemoriesFromTrends(
  ctx: SimContext,
  supplierTrend: ReadonlyArray<WeeklySupplierTrendEntry>,
  regularTrend: ReadonlyArray<WeeklyRegularTrendEntry>,
  factionTrend: ReadonlyArray<WeeklyFactionTrendEntry>,
  socialActions: ReadonlyArray<OwnerSocialActionRecord>,
): void {
  // Phase 36 §36.5 — Weekly community converts repeated signals into
  // entity memories. Emissions are additive: they sit alongside the
  // existing rumour / cause / history records and never overwrite the
  // trend deltas themselves.
  const today = ctx.state.calendar.totalDaysElapsed
  const tavernRef: EntityRef = {
    kind: 'tavern_identity',
    id: ctx.state.meta.tavernId,
  }

  for (const trend of supplierTrend) {
    if (trend.reliabilityDelta <= -3) {
      ctx.addEntityMemory(
        { kind: 'supplier', id: trend.supplierId },
        {
          id: 'supplier_blamed_for_bad_stock',
          source: `${SOURCE}.supplier_trend`,
          tags: ['supplier', 'blame', 'stock', 'weekly'],
        },
        {
          subjects: [tavernRef],
          blamed: [tavernRef],
        },
      )
    }
    if (trend.relationshipDelta >= 3) {
      ctx.addEntityMemory(
        { kind: 'supplier', id: trend.supplierId },
        {
          id: 'supplier_given_fair_deal',
          source: `${SOURCE}.supplier_trend`,
          tags: ['supplier', 'gratitude', 'weekly'],
        },
        {
          credited: [tavernRef],
        },
      )
    }
  }

  for (const trend of regularTrend) {
    if (trend.irritationDelta >= 3) {
      const regular = ctx.state.world.regulars[trend.regularId]
      if (regular) {
        ctx.addEntityMemory(
          { kind: 'regular', id: regular.id },
          {
            id: 'regular_complaint_ignored',
            source: `${SOURCE}.regular_trend`,
            tags: ['regular', 'complaint', 'weekly'],
          },
          {
            blamed: [tavernRef],
          },
        )
      }
    }
    if (trend.loyaltyDelta >= 2) {
      ctx.addEntityMemory(
        { kind: 'regular', id: trend.regularId },
        {
          id: 'regular_helped_by_owner',
          source: `${SOURCE}.regular_trend`,
          tags: ['regular', 'gratitude', 'weekly'],
        },
        {
          credited: [tavernRef],
        },
      )
    }
  }

  for (const trend of factionTrend) {
    if (trend.satisfactionDelta >= 3) {
      ctx.addEntityMemory(
        { kind: 'faction', id: trend.factionId },
        {
          id: 'faction_event_hosted',
          source: `${SOURCE}.faction_trend`,
          tags: ['faction', 'gratitude', 'weekly'],
        },
        {
          credited: [tavernRef],
        },
      )
    }
    if (trend.tensionDelta >= 2) {
      ctx.addEntityMemory(
        { kind: 'faction', id: trend.factionId },
        {
          id: 'faction_publicly_insulted',
          source: `${SOURCE}.faction_trend`,
          tags: ['faction', 'blame', 'weekly'],
        },
        {
          blamed: [tavernRef],
        },
      )
    }
  }

  // Apology social actions write an owner-credited gratitude memory.
  for (const record of socialActions) {
    if (record.actionId !== 'apologize_to_regular') continue
    if (record.outcome !== 'improved') continue
    if (today - record.day >= 7) continue
    const regular = ctx.state.world.regulars[record.targetId]
    if (!regular) continue
    ctx.addEntityMemory(
      { kind: 'regular', id: regular.id },
      {
        id: 'regular_helped_by_owner',
        source: `${SOURCE}.apology`,
        tags: ['regular', 'gratitude', 'apology'],
      },
      {
        credited: [tavernRef],
        sourceEventId: record.id,
      },
    )
  }
}

export function resolveWeeklyCommunity(
  args: ResolveWeeklyCommunityArgs,
): WeeklyCommunityResult {
  const { ctx, currentWeeklyState: slice } = args
  const socialActions = getOwnerActionsModuleState(ctx.state).recentSocialActions

  const supplierTrend = supplierWeeklyTrend(ctx, slice, socialActions)
  const regularTrend = regularWeeklyTrend(ctx, slice, socialActions)
  const factionTrend = factionWeeklyTrend(ctx, slice, socialActions)
  const rumours = generateRumours(
    ctx,
    slice,
    socialActions,
    supplierTrend,
    regularTrend,
    factionTrend,
  )

  emitEntityMemoriesFromTrends(
    ctx,
    supplierTrend,
    regularTrend,
    factionTrend,
    socialActions,
  )

  const notes: string[] = []
  if (supplierTrend.length === 0 && regularTrend.length === 0 && factionTrend.length === 0 && rumours.length === 0) {
    notes.push('Quiet week — no community shifts.')
  }

  return {
    supplierTrend,
    regularTrend,
    factionTrend,
    rumours,
    notes,
  }
}

export function emptyWeeklyCommunityResult(): WeeklyCommunityResult {
  return {
    supplierTrend: [],
    regularTrend: [],
    factionTrend: [],
    rumours: [],
    notes: [],
  }
}

// Re-exported helper so weeklyModule (and tests) can stay aligned on
// the helper used to attribute supplier deliveries to specific stock
// ids without exporting the implementation detail.
export { findSuppliersForStockId }
