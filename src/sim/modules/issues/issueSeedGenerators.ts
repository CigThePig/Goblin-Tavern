import type { SimContext } from '../../core/context'
import type { CauseEntry } from '../../state/TavernState'
import type { MemoryDraft } from '../memories/memoryTypes'
import type {
  ConsequenceProfile,
  IssueSeed,
  IssueSeedFamilyId,
  ResponseSlot,
} from './issueSeedTypes'
import {
  aleStockHighGuard,
  CONTRADICTION_GUARDS,
  merchantPresenceGuard,
  roofRepairedTodayGuard,
  unpaidWagesGuard,
} from './contradictionGuards'
import {
  areaRef,
  buildSeed,
  buildTextIngredients,
  customerRef,
  dedupeRefs,
  displayNameForRef,
  effect,
  factionRef,
  findNotableNpcByFaction,
  makeProfile,
  namedEntityIngredient,
  pressureCauseRefsAsEntries,
  pressureSnapshot,
  recentCauseEntries,
  regularRef,
  seedId,
  severityFromPressures,
  stake,
  staffRef,
  stockRef,
  systemRef,
  tavernIdentityRef,
  urgencyFromPressures,
} from './generatorHelpers'
import type { EntityRef } from '../../state/TavernState'
import type { IssueSeedGenerator } from './issueSeedRegistry'
import { recencyPenalty, recordPick } from './seedRotation'
import { EXPANDED_SEED_GENERATORS } from './expandedSeedGenerators'

// Phase 19 §19.7 — Initial seed families.
//
// Each generator is a pure function of SimContext. Generators inspect
// the current state, pressure snapshots, and recent causes; when a
// trigger condition is met they build a structured seed. Generators do
// NOT decide whether the seed should be presented — ranking does that.

// Phase 73 / ISSUE-033 §6.8 — `main_room` un-pin helper.
//
// Seeds whose "location" used to hard-pin to `main_room` now ask the
// picker for a customer-facing area. The selection rotates via a
// deterministic day-index + family-name hash so the same area
// doesn't dominate the 28-day named-entity-repetition report. Falls
// back to `main_room` if no other customer-facing area exists.
function familyHash(family: string): number {
  let h = 0
  for (let i = 0; i < family.length; i += 1) {
    h = (h * 31 + family.charCodeAt(i)) >>> 0
  }
  return h
}

function pickCustomerFacingArea(
  ctx: SimContext,
  family: string,
): EntityRef {
  const candidates = Object.values(ctx.state.areas)
    .filter((a) => a.tags.includes('customer_facing'))
    .map((a) => a.id)
    .sort()
  if (candidates.length === 0) return areaRef('main_room')
  const today = ctx.state.calendar.totalDaysElapsed
  const idx = (familyHash(family) + today) % candidates.length
  return areaRef(candidates[idx]!)
}

// ----------------------------------------------------------------------
// Food safety
// ----------------------------------------------------------------------

const FOOD_SAFETY_PRESSURE_THRESHOLD = 45

function generateFoodSafety(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.food_safety(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'food_safety')
  if (!snap) return []
  if (snap.value < FOOD_SAFETY_PRESSURE_THRESHOLD) return []

  const kitchen = ctx.state.areas.kitchen
  const mushrooms = ctx.state.stock.mushrooms
  const stew = ctx.state.stock.stew
  const cook = Object.values(ctx.state.staff).find((s) => s.role === 'cook')

  // Phase 64 / ISSUE-024 — picker rotation across kitchen risk
  // vectors. Without this the family fires the same "kitchen risk"
  // suffix every day even when stew or mushroom spoilage is the
  // dominant signal. Score each candidate, apply the shared recency
  // penalty, pick the winner and record.
  const today = ctx.state.calendar.totalDaysElapsed
  type FoodVector = {
    key: 'kitchen' | 'mushrooms' | 'stew' | 'cook'
    score: number
    subject: string
    problemNoun: string
    sensoryDetail: string
  }
  const vectors: FoodVector[] = []
  if (kitchen) {
    vectors.push({
      key: 'kitchen',
      score: 100 - kitchen.cleanliness,
      subject: 'the kitchen',
      problemNoun: 'a greasy reek',
      sensoryDetail: 'greasy floor',
    })
  }
  if (mushrooms) {
    vectors.push({
      key: 'mushrooms',
      score: mushrooms.spoilage,
      subject: 'the mushrooms',
      problemNoun: 'blue foam',
      sensoryDetail: 'blue mushroom foam',
    })
  }
  if (stew) {
    vectors.push({
      key: 'stew',
      score: stew.spoilage,
      subject: 'the stew',
      problemNoun: 'sour bubbling',
      sensoryDetail: 'vinegar stew stink',
    })
  }
  if (cook) {
    vectors.push({
      key: 'cook',
      score: Math.max(0, 100 - cook.loyalty),
      subject: 'the cook',
      problemNoun: 'careless hands',
      sensoryDetail: 'unwashed apron',
    })
  }
  if (vectors.length === 0) return []

  let chosenVector = vectors[0]!
  let chosenScore = -Infinity
  for (const v of vectors) {
    const penalised = v.score - recencyPenalty(ctx.state, 'food_safety', v.key, today)
    if (penalised > chosenScore) {
      chosenScore = penalised
      chosenVector = v
    }
  }
  recordPick(ctx, 'food_safety', chosenVector.key)

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'food_safety', 3)
  for (const c of recentCauseEntries(ctx, ['kitchen', 'spoilage', 'food'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'discard_stock',
      labelHint: 'Discard questionable stock',
      allowedVerbs: ['discard'],
      shape: 'safe_costly',
      targetOptions: [stockRef('mushrooms'), stockRef('stew')],
      expectedEffects: ['reduce food safety pressure', 'lose stock'],
    },
    {
      id: 'clean_kitchen',
      labelHint: 'Clean the kitchen',
      allowedVerbs: ['clean'],
      shape: 'long_term_investment',
      targetOptions: [areaRef('kitchen')],
      expectedEffects: ['raise kitchen cleanliness', 'time and effort cost'],
    },
    {
      id: 'serve_anyway',
      labelHint: 'Serve it anyway',
      allowedVerbs: ['serve'],
      shape: 'risky_profitable',
      targetOptions: [stockRef('stew')],
      expectedEffects: [
        'keep coin from sales',
        'raise food safety risk',
        'raise inspection pressure',
      ],
    },
    {
      id: 'blame_supplier',
      labelHint: 'Blame the supplier',
      allowedVerbs: ['blame'],
      shape: 'relationship_sacrifice',
      targetOptions: [systemRef('supplier')],
      expectedEffects: [
        'avoid immediate blame',
        'create supplier grudge memory',
      ],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'discard_stock_profile',
      responseSlotId: 'discard_stock',
      immediateEffects: [
        effect('state_change', 'stock.mushrooms.quantity', -20, 'Discard mushrooms', ['stock']),
        effect('pressure', 'pressure:food_safety', -12, 'Lower food safety risk', ['pressure']),
      ],
      // Phase 64 / ISSUE-024 — losing a chunk of stock leaves a small
      // reputation drag (customers see the shortage).
      delayedEffects: [
        effect(
          'state_change',
          'reputation.respectable',
          -3,
          'Customers notice the shortage',
          ['reputation'],
        ),
      ],
      memories: [
        { id: 'discarded_unsafe_stock_recently', tags: ['stock', 'food_safety'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'clean_kitchen_profile',
      responseSlotId: 'clean_kitchen',
      immediateEffects: [
        effect('state_change', 'areas.kitchen.cleanliness', 25, 'Kitchen cleaner', ['area']),
        effect('pressure', 'pressure:food_safety', -10, 'Lower food safety risk', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'kitchen_cleaned_recently', tags: ['kitchen', 'cleanliness'] },
      ],
      // Phase 64 / ISSUE-024 — a clean kitchen invites the inspector to
      // notice next time they pass.
      futureHooks: [
        {
          id: 'kitchen_inspection_followup',
          tags: ['food_safety', 'inspection'],
        },
      ],
    }),
    makeProfile({
      id: 'serve_anyway_profile',
      responseSlotId: 'serve_anyway',
      immediateEffects: [
        effect('state_change', 'coin', 15, 'Earn coin from sales', ['coin']),
        effect('pressure', 'pressure:food_safety', 8, 'Food safety risk rises', ['pressure']),
        effect('pressure', 'pressure:inspection', 6, 'Inspection risk rises', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'food_poisoning_rumor_possible',
          0,
          'Food poisoning rumor may emerge later',
          ['future_hook'],
        ),
      ],
      memories: [
        { id: 'served_questionable_stew', tags: ['stew', 'food_safety', 'deception'] },
      ],
      futureHooks: [
        {
          id: 'food_poisoning_rumor_possible',
          tags: ['food_safety', 'rumor'],
        },
      ],
    }),
    makeProfile({
      id: 'blame_supplier_profile',
      responseSlotId: 'blame_supplier',
      immediateEffects: [
        effect('cause', 'global', 0, 'Push blame onto supplier', ['blame']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'supplier_retaliation_possible',
          0,
          'Supplier may retaliate later',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: 'supplier_blamed_for_bad_mushrooms',
          tags: ['supplier', 'grudge'],
        },
      ],
      futureHooks: [
        {
          id: 'supplier_retaliation_possible',
          tags: ['supplier', 'risk'],
        },
      ],
    }),
  ]

  // Build the sensory pool — the chosen vector's detail leads,
  // remaining strong signals tail behind so the seed still reads as a
  // kitchen problem.
  const sensoryDetails: string[] = [chosenVector.sensoryDetail]
  if (mushrooms && mushrooms.spoilage >= 50 && chosenVector.key !== 'mushrooms') {
    sensoryDetails.push('blue mushroom foam')
  }
  if (stew && stew.spoilage >= 50 && chosenVector.key !== 'stew') {
    sensoryDetails.push('vinegar stew stink')
  }
  if (kitchen && kitchen.cleanliness < 30 && chosenVector.key !== 'kitchen') {
    sensoryDetails.push('greasy floor')
  }

  const actorOpinions: Record<string, string> = {}
  if (cook) actorOpinions['cook'] = 'insists it is fine'
  actorOpinions['merchants'] = 'look horrified'

  return [
    buildSeed({
      id: seedId('food_safety', chosenVector.key, ctx),
      family: 'food_safety',
      type: 'crisis',
      timing: 'morning_prep',
      domain: ['food', 'kitchen', 'stock'],
      severity: severityFromPressures(ctx, ['food_safety']),
      urgency: urgencyFromPressures(ctx, ['food_safety']),
      location: areaRef('kitchen'),
      primaryActor: cook ? staffRef(cook.id) : undefined,
      affectedActors: cook ? [staffRef(cook.id)] : [],
      causes,
      pressures: (() => {
        const slice = ctx.state.modules.pressures as
          | { snapshots?: Record<string, IssueSeed['pressures'][number]> }
          | undefined
        const snapValue = slice?.snapshots?.['food_safety']
        return snapValue ? [snapValue] : []
      })(),
      stakes: [
        stake('food_safety_stake', 'pressure:food_safety', 'Customers may get sick', 'loss', [
          'food_safety',
        ]),
        stake('inspection_stake', 'pressure:inspection', 'Inspectors may visit', 'risk', [
          'inspection',
        ]),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: 'food_safety_warning_seen',
          tags: ['food_safety', 'warning'],
        },
      ],
      futureHooks: [
        {
          id: 'food_poisoning_rumor_possible',
          tags: ['food_safety', 'rumor'],
        },
      ],
      toneHints: ['risk', 'kitchen', 'urgent'],
      textIngredients: buildTextIngredients({
        subject: chosenVector.subject,
        problemNoun: chosenVector.problemNoun,
        sensoryDetails,
        actorOpinions,
        recentContext: ['kitchen filthy for days'],
        stakesReadable: ['customers may get sick', 'inspectors may visit'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Stock shortage
// ----------------------------------------------------------------------

const HIGH_DEMAND_DAY_TYPES = new Set([
  'payday',
  'brawl_night',
  'market_day',
  'local_night',
])

const STOCK_LOW_THRESHOLD = 30

function generateStockShortage(ctx: SimContext): IssueSeed[] {
  const familyGuard = CONTRADICTION_GUARDS.stock_shortage(ctx)
  if (!familyGuard.allowed) return []
  const snap = pressureSnapshot(ctx, 'stock_shortage')
  if (!snap || snap.value < 35) return []

  // Phase 64 / ISSUE-024 — rotate across stock items rather than
  // hardcoding ale. Candidate set = items whose quantity sits at or
  // below the low-stock threshold. Apply the recency penalty so the
  // same shortage doesn't dominate consecutive days.
  const today = ctx.state.calendar.totalDaysElapsed
  const allStock = Object.values(ctx.state.stock)
  const candidates = allStock.filter(
    (item) => item.quantity <= STOCK_LOW_THRESHOLD,
  )
  if (candidates.length === 0) return []

  let chosen = candidates[0]!
  let chosenScore = -Infinity
  for (const item of candidates) {
    const baseScore = STOCK_LOW_THRESHOLD - item.quantity
    const penalty = recencyPenalty(
      ctx.state,
      'stock_shortage',
      `stock:${item.id}`,
      today,
    )
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = item
    }
  }
  // Keep the ale-specific guard: when the chosen stock IS ale but
  // ale stock is somehow high (e.g. a recent restock the same day),
  // skip the seed so the deception "we've barely got ale" does not
  // contradict the visible state.
  if (chosen.id === 'ale') {
    const guard = aleStockHighGuard(ctx)
    if (!guard.allowed) return []
  }
  recordPick(ctx, 'stock_shortage', `stock:${chosen.id}`)

  const dayType = ctx.state.calendar.dayType
  const highDemand = HIGH_DEMAND_DAY_TYPES.has(dayType)

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'stock_shortage', 3)
  for (const c of recentCauseEntries(ctx, ['stock', chosen.id, 'sales'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const stockLabel = chosen.label.toLowerCase()
  const responseSlots: ResponseSlot[] = [
    {
      id: 'restock',
      labelHint: `Restock ${stockLabel}`,
      allowedVerbs: ['buy'],
      shape: 'safe_costly',
      targetOptions: [stockRef(chosen.id)],
      expectedEffects: [`raise ${stockLabel} quantity`, 'spend coin'],
    },
    {
      id: 'raise_prices',
      labelHint: 'Raise prices',
      allowedVerbs: ['raise_price'],
      shape: 'risky_profitable',
      targetOptions: [stockRef(chosen.id)],
      expectedEffects: ['raise margin', 'risk customer satisfaction'],
    },
    {
      id: 'water_down',
      labelHint: `Stretch the ${stockLabel}`,
      allowedVerbs: ['serve'],
      shape: 'deception',
      targetOptions: [stockRef(chosen.id)],
      expectedEffects: ['raise quantity', 'lower quality', 'risk reputation'],
    },
    {
      id: 'limit_sales',
      labelHint: 'Limit sales',
      allowedVerbs: ['delay'],
      shape: 'compromise',
      targetOptions: [stockRef(chosen.id)],
      expectedEffects: ['conserve stock', 'lose income'],
    },
    {
      id: 'ignore',
      labelHint: 'Ignore the shortage',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no immediate change', 'risk shortage backlash'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'restock_profile',
      responseSlotId: 'restock',
      immediateEffects: [
        effect('state_change', `stock.${chosen.id}.quantity`, 60, `Add ${stockLabel} to stock`, ['stock']),
        effect('state_change', 'coin', -30, 'Spend coin restocking', ['coin']),
        effect('pressure', 'pressure:stock_shortage', -15, 'Lower shortage pressure', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        { id: `restocked_${chosen.id}_recently`, tags: ['stock', chosen.id] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'raise_prices_profile',
      responseSlotId: 'raise_prices',
      immediateEffects: [
        effect('state_change', `stock.${chosen.id}.salePrice`, 1, `Raise ${stockLabel} price`, ['stock', 'price']),
        effect('state_change', 'customers.miners.satisfaction', -8, 'Miners grumble', ['customer']),
      ],
      // Phase 64 / ISSUE-024 — price hikes seed downstream loss and a
      // potential complaint rumour.
      delayedEffects: [
        effect(
          'pressure',
          'pressure:regular_customer_loss',
          4,
          'Regulars consider walking',
          ['pressure'],
        ),
      ],
      memories: [
        { id: 'raised_prices_recently', tags: ['price', 'reputation'] },
      ],
      futureHooks: [
        { id: 'price_complaint_possible', tags: ['price', 'rumor'] },
      ],
    }),
    makeProfile({
      id: 'water_down_profile',
      responseSlotId: 'water_down',
      immediateEffects: [
        effect('state_change', `stock.${chosen.id}.quantity`, 20, `Stretch ${stockLabel}`, ['stock']),
        effect('state_change', `stock.${chosen.id}.quality`, -15, `Lower ${stockLabel} quality`, ['stock', 'quality']),
        effect('pressure', 'pressure:reputation_drift', 5, 'Reputation drifts', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `${chosen.id}_watering_rumor_possible`,
          0,
          `Watered ${stockLabel} rumor may emerge`,
          ['future_hook'],
        ),
      ],
      memories: [
        { id: `watered_${chosen.id}_recently`, tags: [chosen.id, 'deception'] },
      ],
      futureHooks: [
        { id: `${chosen.id}_watering_rumor_possible`, tags: [chosen.id, 'rumor'] },
      ],
    }),
    makeProfile({
      id: 'limit_sales_profile',
      responseSlotId: 'limit_sales',
      immediateEffects: [
        effect('state_change', 'customers.miners.satisfaction', -5, 'Miners disappointed', [
          'customer',
        ]),
      ],
      // Phase 64 / ISSUE-024 — venting demand softens the shortage
      // tomorrow but leaves a faint regular-loss risk.
      delayedEffects: [
        effect(
          'pressure',
          'pressure:stock_shortage',
          -4,
          'Demand vents naturally',
          ['pressure'],
        ),
      ],
      memories: [
        { id: 'limited_sales_recently', tags: ['stock', 'service'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_profile',
      responseSlotId: 'ignore',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:stock_shortage', 6, 'Shortage worsens', ['pressure']),
      ],
      memories: [
        { id: 'ignored_shortage_recently', tags: ['stock', 'ignored'] },
      ],
      futureHooks: [],
    }),
  ]

  const stakes = [
    stake(
      `${chosen.id}_stake`,
      `stock:${chosen.id}`,
      `${chosen.label} may run out`,
      'loss',
      [chosen.id, 'stock'],
    ),
    stake(
      'miner_stake',
      'customer:miners',
      'Miners may stop visiting',
      'loss',
      ['customer', 'miners'],
    ),
  ]
  if (highDemand) {
    stakes.push(
      stake(
        'demand_stake',
        'service:demand',
        `Demand is high (${dayType.replace('_', ' ')})`,
        'risk',
        ['demand'],
      ),
    )
  }

  return [
    buildSeed({
      id: seedId('stock_shortage', `${chosen.id}_${dayType}`, ctx),
      family: 'stock_shortage',
      type: 'warning',
      timing: 'morning_prep',
      domain: ['stock', 'customers'],
      severity: severityFromPressures(ctx, ['stock_shortage']),
      urgency: urgencyFromPressures(ctx, ['stock_shortage']),
      location: areaRef('cellar'),
      affectedActors: [customerRef('miners')],
      causes,
      stakes,
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [],
      futureHooks: [],
      toneHints: highDemand ? ['urgent', 'high_demand'] : ['warning'],
      textIngredients: buildTextIngredients({
        subject: `${stockLabel} stock`,
        problemNoun: 'low stock',
        sensoryDetails: ['empty kegs', 'thirsty regulars'],
        actorOpinions: { miners: 'glance at the taps' },
        recentContext: [`${stockLabel} sales heavy this week`],
        stakesReadable: [`${stockLabel} may run dry`, 'miners may leave'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Maintenance
// ----------------------------------------------------------------------

function generateMaintenance(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.maintenance(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'maintenance')
  if (!snap || snap.value < 40) return []
  const roofGuard = roofRepairedTodayGuard(ctx)

  // Phase 64 / ISSUE-024 — picker rotation across top-3 damaged areas.
  // Without rotation the single worst area would dominate every day.
  // Score = damage + (60 - condition); apply the recency penalty so
  // the same area cannot win 5 days running.
  const today = ctx.state.calendar.totalDaysElapsed
  const scored = Object.values(ctx.state.areas)
    .map((a) => ({
      area: a,
      rawScore: a.damage + (60 - a.condition),
    }))
    .sort((a, b) => b.rawScore - a.rawScore)
  const topCandidates = scored.slice(0, 3)
  if (topCandidates.length === 0) return []

  let chosen = topCandidates[0]!.area
  let chosenScore = -Infinity
  for (const { area, rawScore } of topCandidates) {
    const penalised =
      rawScore - recencyPenalty(ctx.state, 'maintenance', `area:${area.id}`, today)
    if (penalised > chosenScore) {
      chosenScore = penalised
      chosen = area
    }
  }
  if (chosen.id === 'roof' && !roofGuard.allowed) return []
  recordPick(ctx, 'maintenance', `area:${chosen.id}`)
  const worst = chosen

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'maintenance', 3)
  for (const c of recentCauseEntries(ctx, ['area', worst.id, 'damage'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'repair',
      labelHint: `Repair ${worst.label}`,
      allowedVerbs: ['repair'],
      shape: 'long_term_investment',
      targetOptions: [areaRef(worst.id)],
      expectedEffects: ['raise area condition', 'spend coin'],
    },
    {
      id: 'patch',
      labelHint: 'Patch temporarily',
      allowedVerbs: ['repair'],
      shape: 'short_term_patch',
      targetOptions: [areaRef(worst.id)],
      expectedEffects: ['small condition gain', 'cheap'],
    },
    {
      id: 'ignore',
      labelHint: 'Ignore the damage',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'risk failure later'],
    },
    {
      id: 'close_area',
      labelHint: `Close ${worst.label}`,
      allowedVerbs: ['delay'],
      shape: 'compromise',
      targetOptions: [areaRef(worst.id)],
      expectedEffects: ['stop further damage', 'lose service capacity'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'repair_profile',
      responseSlotId: 'repair',
      immediateEffects: [
        effect('state_change', `areas.${worst.id}.damage`, -25, 'Repair damage', ['area']),
        effect('state_change', `areas.${worst.id}.condition`, 20, 'Raise condition', ['area']),
        effect('state_change', 'coin', -25, 'Pay for repair', ['coin']),
        effect('pressure', 'pressure:maintenance', -12, 'Lower maintenance pressure', [
          'pressure',
        ]),
      ],
      // Phase 64 / ISSUE-024 — settled repairs continue to relieve
      // maintenance pressure as the fix beds in.
      delayedEffects: [
        effect(
          'pressure',
          'pressure:maintenance',
          -4,
          'Repair beds in',
          ['pressure'],
        ),
      ],
      memories: [
        { id: `${worst.id}_repaired_recently`, tags: ['maintenance', worst.id] },
      ],
      futureHooks: [
        { id: 'repair_inspection_followup', tags: ['maintenance', 'inspection'] },
      ],
    }),
    makeProfile({
      id: 'patch_profile',
      responseSlotId: 'patch',
      immediateEffects: [
        effect('state_change', `areas.${worst.id}.damage`, -10, 'Patch damage', ['area']),
        effect('state_change', 'coin', -8, 'Cheap patch cost', ['coin']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'failed_patch_possible',
          0,
          'Patch may fail later',
          ['future_hook'],
        ),
      ],
      memories: [
        { id: `${worst.id}_patched_recently`, tags: ['maintenance', worst.id, 'patch'] },
      ],
      futureHooks: [
        { id: 'failed_patch_possible', tags: ['maintenance', 'risk'] },
      ],
    }),
    makeProfile({
      id: 'ignore_profile',
      responseSlotId: 'ignore',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:maintenance', 6, 'Maintenance pressure worsens', [
          'pressure',
        ]),
      ],
      memories: [
        { id: 'habitual_roof_neglect', tags: ['maintenance', 'ignored'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'close_area_profile',
      responseSlotId: 'close_area',
      immediateEffects: [
        effect('state_change', `areas.${worst.id}.risk`, -10, 'Reduce risk', ['area']),
        effect('state_change', 'customers.miners.satisfaction', -5, 'Customers inconvenienced', [
          'customer',
        ]),
      ],
      delayedEffects: [],
      memories: [
        { id: `${worst.id}_closed_recently`, tags: ['maintenance', worst.id] },
      ],
      futureHooks: [],
    }),
  ]

  return [
    buildSeed({
      id: seedId('maintenance', worst.id, ctx),
      family: 'maintenance',
      type: 'maintenance_problem',
      timing: 'morning_prep',
      domain: ['areas', 'maintenance'],
      severity: severityFromPressures(ctx, ['maintenance']),
      urgency: urgencyFromPressures(ctx, ['maintenance']),
      location: areaRef(worst.id),
      causes,
      stakes: [
        stake('damage_stake', `area:${worst.id}`, `${worst.label} may collapse`, 'loss', [
          'maintenance',
        ]),
        stake(
          'service_stake',
          'service:capacity',
          'Service may suffer',
          'risk',
          ['service'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        { id: 'maintenance_warning_seen', tags: ['maintenance', 'warning'] },
      ],
      futureHooks: [
        { id: 'area_failure_possible', tags: ['maintenance', 'risk'] },
      ],
      toneHints: ['maintenance', 'risk'],
      textIngredients: buildTextIngredients({
        subject: worst.label.toLowerCase(),
        problemNoun: 'visible damage',
        sensoryDetails: ['cracked plank', 'creaking timber'],
        actorOpinions: { staff: 'eye the damage warily' },
        recentContext: ['damage worsening over days'],
        stakesReadable: [`${worst.label} may collapse`, 'service may suffer'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Staff burnout
// ----------------------------------------------------------------------

// Phase 57 / ISSUE-017 — Staff burnout rotation. Without rotation the
// picker always selected the single highest stress+fatigue staff
// member, so the same person dominated for the duration of their
// burnout. Now consider every staff member above the stress+fatigue
// threshold, scored with a recency penalty.
const BURNOUT_RECENCY_WINDOW = 5
const BURNOUT_RECENCY_PENALTY = 30
const BURNOUT_STRESS_THRESHOLD = 60

function burnoutRecencyPenalty(
  ctx: SimContext,
  entityKey: string,
  today: number,
): number {
  const slice = ctx.state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.['staff_burnout'] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= BURNOUT_RECENCY_WINDOW) return 0
  return BURNOUT_RECENCY_PENALTY
}

function recordBurnoutPick(ctx: SimContext, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent['staff_burnout'] = {
        ...(recent['staff_burnout'] ?? {}),
        [entityKey]: today,
      }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'staffBurnout.recordPick' },
  )
}

function generateStaffBurnout(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.staff_burnout(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'staff_burnout')
  if (!snap || snap.value < 40) return []
  const allStaff = Object.values(ctx.state.staff)
  if (allStaff.length === 0) return []

  // Picker rotation: consider staff members whose stress+fatigue
  // crosses the threshold. Score by `(stress+fatigue)` minus a
  // 5-day recency penalty of 30. Falls back to single highest if
  // nobody crosses the threshold so the family still fires on
  // small staff sets / early-game states.
  const today = ctx.state.calendar.totalDaysElapsed
  const candidates = allStaff.filter(
    (s) => s.stress + s.fatigue > BURNOUT_STRESS_THRESHOLD,
  )
  let worst: typeof allStaff[number]
  if (candidates.length > 0) {
    const ranked = candidates
      .map((s) => {
        const baseScore = s.stress + s.fatigue
        const penalty = burnoutRecencyPenalty(
          ctx,
          `staff:${s.id}`,
          today,
        )
        return { s, score: baseScore - penalty }
      })
      .sort((a, b) => b.score - a.score)
    worst = ranked[0]!.s
  } else {
    worst = allStaff
      .slice()
      .sort((a, b) => b.stress + b.fatigue - (a.stress + a.fatigue))[0]!
  }
  recordBurnoutPick(ctx, `staff:${worst.id}`)

  // Phase 57 / ISSUE-017 — Pick a second staff member to absorb
  // cross-staff redistribution from `reduce_workload` / `reassign`.
  // Falls back to the picked staff if there's only one.
  const otherStaff =
    allStaff.find((s) => s.id !== worst.id) ?? worst

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'staff_burnout', 3)
  for (const c of recentCauseEntries(ctx, ['staff', 'wages', 'service'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'pay_bonus',
      labelHint: `Pay ${worst.name} a bonus`,
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [staffRef(worst.id)],
      expectedEffects: ['raise staff morale', 'spend coin'],
    },
    {
      id: 'reduce_workload',
      labelHint: `Lighten ${worst.name}'s load`,
      allowedVerbs: ['delegate'],
      shape: 'compromise',
      targetOptions: [staffRef(worst.id)],
      expectedEffects: ['lower stress', 'reduce service capacity'],
    },
    {
      id: 'push_through',
      labelHint: 'Push through',
      allowedVerbs: ['ignore'],
      shape: 'risky_profitable',
      targetOptions: [staffRef(worst.id)],
      expectedEffects: ['no cost', 'risk staff quitting'],
    },
    {
      id: 'reassign',
      labelHint: 'Reassign priorities',
      allowedVerbs: ['delegate'],
      shape: 'compromise',
      targetOptions: [staffRef(worst.id)],
      expectedEffects: ['shift workload', 'side effects elsewhere'],
    },
  ]

  // Phase 57 / ISSUE-017 — Every profile carries delayedEffects and
  // a futureHook. The `pay_bonus`, `reduce_workload`, and `reassign`
  // profiles previously had only immediates. `push_through` already
  // had delayedEffects; its futureHook id is now per-staff so the
  // pending entry binds to a specific actor.
  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'pay_bonus_profile',
      responseSlotId: 'pay_bonus',
      immediateEffects: [
        effect('state_change', `staff.${worst.id}.morale`, 15, `Boost ${worst.name} morale`, [
          'staff',
        ]),
        effect('state_change', `staff.${worst.id}.stress`, -10, 'Lower stress', ['staff']),
        effect('state_change', 'coin', -15, 'Pay bonus cost', ['coin']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:debt',
          3,
          'Bonus tightens the ledger over the week',
          ['pressure', 'debt', 'delay:5'],
        ),
        effect(
          'future_hook',
          `staff_bonus_expected_${worst.id}`,
          30,
          `${worst.name} may expect another bonus`,
          ['future_hook', 'staff'],
        ),
      ],
      memories: [
        {
          id: 'staff_bonus_paid_recently',
          actors: [staffRef(worst.id)],
          tags: ['staff', 'bonus'],
        },
      ],
      futureHooks: [
        {
          id: `staff_bonus_expected_${worst.id}`,
          actors: [staffRef(worst.id)],
          tags: ['staff', 'bonus'],
        },
      ],
    }),
    makeProfile({
      id: 'reduce_workload_profile',
      responseSlotId: 'reduce_workload',
      immediateEffects: [
        effect('state_change', `staff.${worst.id}.fatigue`, -15, 'Lower fatigue', ['staff']),
        effect('state_change', `staff.${worst.id}.stress`, -10, 'Lower stress', ['staff']),
      ],
      delayedEffects: [
        effect(
          'state_change',
          `staff.${otherStaff.id}.fatigue`,
          6,
          `${otherStaff.name.display} picks up the slack`,
          ['staff', 'coverage_gap', 'delay:3'],
        ),
        effect(
          'future_hook',
          `coverage_gap_${worst.id}`,
          7,
          `Coverage gap may resurface when ${worst.name} returns`,
          ['future_hook', 'staff', 'coverage'],
        ),
      ],
      memories: [
        {
          id: 'workload_reduced_recently',
          actors: [staffRef(worst.id)],
          tags: ['staff', 'workload'],
        },
      ],
      futureHooks: [
        {
          id: `coverage_gap_${worst.id}`,
          actors: [staffRef(worst.id), staffRef(otherStaff.id)],
          tags: ['staff', 'coverage'],
        },
      ],
    }),
    makeProfile({
      id: 'push_through_profile',
      responseSlotId: 'push_through',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:staff_burnout', 8, 'Burnout worsens', ['pressure']),
        effect(
          'future_hook',
          `staff_quit_risk_${worst.id}`,
          14,
          `${worst.name} may quit`,
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: 'pushed_staff_recently',
          actors: [staffRef(worst.id)],
          tags: ['staff', 'risk'],
        },
      ],
      futureHooks: [
        {
          id: `staff_quit_risk_${worst.id}`,
          actors: [staffRef(worst.id)],
          tags: ['staff', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'reassign_profile',
      responseSlotId: 'reassign',
      immediateEffects: [
        effect('state_change', `staff.${worst.id}.stress`, -8, 'Slight relief', ['staff']),
        effect(
          'state_change',
          `staff.${otherStaff.id}.fatigue`,
          6,
          `${otherStaff.name.display} absorbs reassigned duties`,
          ['staff', 'reassign'],
        ),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:staff_burnout',
          3,
          'Cross-staff load creeps the burnout meter',
          ['pressure', 'staff', 'delay:5'],
        ),
        effect(
          'future_hook',
          `cross_staff_grumble_${otherStaff.id}`,
          10,
          `${otherStaff.name.display} may grumble about the reassign`,
          ['future_hook', 'staff'],
        ),
      ],
      memories: [
        {
          id: 'reassigned_priorities_recently',
          actors: [staffRef(worst.id), staffRef(otherStaff.id)],
          tags: ['staff', 'priority'],
        },
      ],
      futureHooks: [
        {
          id: `cross_staff_grumble_${otherStaff.id}`,
          actors: [staffRef(otherStaff.id)],
          tags: ['staff', 'reassign'],
        },
      ],
    }),
  ]

  return [
    buildSeed({
      id: seedId('staff_burnout', worst.id, ctx),
      family: 'staff_burnout',
      type: 'staff_request',
      timing: 'morning_prep',
      domain: ['staff'],
      severity: severityFromPressures(ctx, ['staff_burnout']),
      urgency: urgencyFromPressures(ctx, ['staff_burnout']),
      primaryActor: staffRef(worst.id),
      affectedActors: [staffRef(worst.id)],
      causes,
      stakes: [
        stake('quit_stake', `staff:${worst.id}`, `${worst.name} may quit`, 'loss', ['staff']),
        stake(
          'service_stake',
          'service:capacity',
          'Service quality may drop',
          'risk',
          ['service'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: 'staff_burnout_warning_seen',
          actors: [staffRef(worst.id)],
          tags: ['staff'],
        },
      ],
      futureHooks: [],
      toneHints: ['staff', 'fatigue'],
      textIngredients: buildTextIngredients({
        subject: worst.name.display,
        problemNoun: 'exhaustion',
        sensoryDetails: ['hunched shoulders', 'dark eyes'],
        actorOpinions: { [worst.id]: 'looks ready to snap' },
        recentContext: ['heavy week of service'],
        stakesReadable: [`${worst.name.display} may quit`, 'service may decline'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Customer complaint
// ----------------------------------------------------------------------

// Phase 40 audit pass 2 §3 — Recency rotation for complainer customer group.
// Higher penalty (35) widens the rotation window across the five groups so
// `customer_group:merchants` (or `local_goblins`) doesn't dominate.
const COMPLAINT_RECENCY_WINDOW = 9
const COMPLAINT_RECENCY_PENALTY = 45

function complaintRecencyPenalty(
  ctx: SimContext,
  entityKey: string,
  today: number,
): number {
  const slice = ctx.state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.['customer_complaint'] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= COMPLAINT_RECENCY_WINDOW) return 0
  return COMPLAINT_RECENCY_PENALTY
}

function recordComplaintPick(ctx: SimContext, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent['customer_complaint'] = {
        ...(recent['customer_complaint'] ?? {}),
        [entityKey]: today,
      }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'customerComplaint.recordPick' },
  )
}

function generateCustomerComplaint(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.customer_complaint(ctx)
  if (!guard.allowed) return []
  // Phase 40 audit pass 2 §3 — Rotate the complainer across the five
  // active customer groups (whichever has lowest satisfaction, with a
  // recency penalty so the same group doesn't dominate). Falls back to
  // merchants when present so existing test expectations still work.
  const today = ctx.state.calendar.totalDaysElapsed
  const groupIds = [
    'merchants',
    'miners',
    'local_goblins',
    'adventurers',
    'ogres',
  ] as const
  const candidates = groupIds
    .map((id) => ctx.state.customerGroups[id])
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
  if (candidates.length === 0) return []

  // For merchants-only environments fall through to the existing guard,
  // so contradiction guard semantics stay intact.
  const presence = merchantPresenceGuard(ctx)
  // Phase 40 audit pass 2 §3 — Widen the candidate pool to satisfaction
  // ≤60 so multiple groups qualify each day. The recency penalty rotates
  // the actual pick across that pool; otherwise the lowest-satisfaction
  // group dominates the family.
  const groupCandidates = candidates.filter((g) => {
    if (g.id === 'merchants' && !presence.allowed) return false
    return g.satisfaction <= 60
  })
  if (groupCandidates.length === 0) return []

  const ranked = groupCandidates
    .map((g) => {
      const baseScore = 100 - g.satisfaction
      const penalty = complaintRecencyPenalty(ctx, `customer_group:${g.id}`, today)
      return { g, score: baseScore - penalty }
    })
    .sort((a, b) => b.score - a.score)
  const group = ranked[0]!.g
  recordComplaintPick(ctx, `customer_group:${group.id}`)
  const groupRef = customerRef(group.id)

  // Pull a named regular from the group's starter roster (rotates via a
  // sub-family key so individual regulars don't dominate either).
  const regulars = Object.values(ctx.state.world.regulars).filter(
    (r) => r.customerGroupId === group.id,
  )
  let irritatedRegular: typeof regulars[number] | undefined
  if (regulars.length > 0) {
    const rankedRegulars = regulars
      .map((r) => {
        const baseScore = r.irritation + (100 - r.loyalty)
        const penalty = complaintRecencyPenalty(
          ctx,
          `customer_complaint_regular:${r.id}`,
          today,
        )
        return { r, score: baseScore - penalty }
      })
      .sort((a, b) => b.score - a.score)
    if (rankedRegulars[0]!.score > 0) {
      irritatedRegular = rankedRegulars[0]!.r
      recordComplaintPick(
        ctx,
        `customer_complaint_regular:${irritatedRegular.id}`,
      )
    }
  }
  const regularEntityRef = irritatedRegular
    ? regularRef(irritatedRegular.id)
    : undefined

  // Pick a staff member to side with / against (cook for kitchen
  // complaints, server otherwise). Falls back to the first staff entry.
  const allStaff = Object.values(ctx.state.staff)
  const staffOnHook =
    allStaff.find((s) => s.role === 'server') ??
    allStaff.find((s) => s.role === 'cook') ??
    allStaff[0]
  const staffEntityRef = staffOnHook ? staffRef(staffOnHook.id) : undefined

  const causes: CauseEntry[] = []
  const recent = recentCauseEntries(
    ctx,
    ['customer', group.id, 'area', 'reputation', 'cleanliness'],
    7,
    4,
  )
  causes.push(...recent)
  causes.push(...pressureCauseRefsAsEntries(ctx, 'reputation_drift', 2))
  if (causes.length < 1) return []

  const tavernSelf = tavernIdentityRef('self')

  const responseSlots: ResponseSlot[] = [
    {
      id: 'discount',
      labelHint: `Offer ${group.label} a discount`,
      allowedVerbs: ['discount'],
      shape: 'safe_costly',
      targetOptions: [groupRef],
      expectedEffects: [`raise ${group.id} satisfaction`, 'lose coin'],
    },
    {
      id: 'fix_root',
      labelHint: 'Fix the root cause',
      allowedVerbs: ['clean', 'repair'],
      shape: 'long_term_investment',
      targetOptions: [areaRef('main_room'), areaRef('kitchen')],
      expectedEffects: ['raise cleanliness', 'time/coin cost'],
    },
    {
      id: 'mock',
      labelHint: 'Mock the complaint',
      allowedVerbs: ['blame'],
      shape: 'relationship_sacrifice',
      targetOptions: regularEntityRef ? [groupRef, regularEntityRef] : [groupRef],
      expectedEffects: ['save coin', `lose ${group.id} trust`],
    },
    {
      id: 'rebrand',
      labelHint: 'Rebrand the issue',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['shift reputation', 'risk audience'],
    },
    {
      id: 'public_apology',
      labelHint: `Make a public apology to ${group.label}`,
      allowedVerbs: ['appease', 'confess'],
      shape: 'relationship_sacrifice',
      targetOptions: [groupRef, ...(regularEntityRef ? [regularEntityRef] : [])],
      expectedEffects: ['raise satisfaction', 'staff feels overruled'],
    },
    {
      id: 'side_with_staff',
      labelHint: staffOnHook
        ? `Back ${staffOnHook.name.display} over the complaint`
        : 'Back the staff over the complaint',
      allowedVerbs: ['blame'],
      shape: 'relationship_sacrifice',
      targetOptions: staffEntityRef ? [staffEntityRef, groupRef] : [groupRef],
      expectedEffects: ['raise staff loyalty', 'lose group trust'],
    },
    {
      id: 'side_with_regular',
      labelHint: irritatedRegular
        ? `Side with ${irritatedRegular.name.display}`
        : 'Side with the regular',
      allowedVerbs: ['appease'],
      shape: 'safe_costly',
      targetOptions: regularEntityRef
        ? [regularEntityRef]
        : [groupRef],
      expectedEffects: ['raise regular loyalty', 'staff feels betrayed'],
    },
    {
      id: 'house_rule_change',
      labelHint: 'Change the house rules',
      allowedVerbs: ['rebrand'],
      shape: 'long_term_investment',
      targetOptions: [systemRef('house_rules'), groupRef],
      expectedEffects: ['policy shift', 'cultural friction'],
    },
    {
      id: 'comp_table',
      labelHint: `Comp ${group.label}'s table`,
      allowedVerbs: ['discount', 'pay'],
      shape: 'safe_costly',
      targetOptions: regularEntityRef ? [groupRef, regularEntityRef] : [groupRef],
      expectedEffects: ['raise satisfaction broadly', 'spend coin'],
    },
  ]

  const groupPath = `customers.${group.id}`
  const regularActors = regularEntityRef ? [regularEntityRef] : []
  const staffActors = staffEntityRef ? [staffEntityRef] : []

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'discount_profile',
      responseSlotId: 'discount',
      immediateEffects: [
        effect('state_change', `${groupPath}.satisfaction`, 10, 'Discount appeases', [
          'customer',
        ]),
        effect('state_change', 'coin', -10, 'Discount cost', ['coin']),
        effect('state_change', `${groupPath}.loyalty`, 5, 'Goodwill builds', ['customer']),
        ...(regularEntityRef
          ? [
              effect(
                'state_change',
                `world.regulars.${regularEntityRef.id}.loyalty`,
                6,
                'Regular feels heard',
                ['regular'],
              ),
            ]
          : []),
        effect('cause', `customer_group:${group.id}`, 6, 'Group thawed by discount', [
          'customer',
          'favorite_order',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `${group.id}_discount_recently`,
          actors: [groupRef, ...regularActors],
          tags: ['customer', group.id, 'favorite_order', 'attribution'],
        },
        ...(regularEntityRef
          ? [
              {
                id: `regular_discount_${regularEntityRef.id}`,
                actors: [regularEntityRef],
                tags: ['regular', 'favorite_order', 'attribution'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'fix_root_profile',
      responseSlotId: 'fix_root',
      immediateEffects: [
        effect('state_change', 'areas.main_room.cleanliness', 18, 'Cleaner main room', ['area']),
        effect('state_change', 'areas.main_room.damage', -8, 'Patched as part of clean-up', ['area']),
        effect('state_change', 'coin', -10, 'Cleaning cost', ['coin']),
        effect('pressure', 'pressure:reputation_drift', -5, 'Stabilize reputation', ['pressure']),
        effect('state_change', `${groupPath}.satisfaction`, 6, 'Visible cleanup wins respect', [
          'customer',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `cleanliness_streak_${group.id}`,
          8,
          'Group may expect this standard',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `${group.id}_root_cleaned_recently`,
          actors: [groupRef, ...staffActors],
          tags: ['cleanliness', 'main_room', 'attribution'],
        },
        ...(staffEntityRef
          ? [
              {
                id: `staff_led_cleanup_${staffEntityRef.id}`,
                actors: [staffEntityRef],
                tags: ['staff', 'protected', 'attribution'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `cleanliness_streak_${group.id}`,
          actors: [groupRef],
          tags: ['customer', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'mock_profile',
      responseSlotId: 'mock',
      immediateEffects: [
        effect('state_change', `${groupPath}.satisfaction`, -15, `${group.label} offended`, [
          'customer',
        ]),
        effect('state_change', `${groupPath}.loyalty`, -10, 'Trust broken', ['customer']),
        effect('state_change', 'reputation.respectable', -6, 'Owner mocked a complaint', [
          'reputation',
        ]),
        effect('cause', `customer_group:${group.id}`, -12, `${group.label} bear a grudge`, [
          'customer',
          'bad_reputation',
          'attribution',
        ]),
        ...(regularEntityRef
          ? [
              effect(
                'cause',
                `regular:${regularEntityRef.id}`,
                -15,
                'Regular humiliated in public',
                ['regular', 'grudge', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 8, 'Group spreads the story', [
          'pressure',
        ]),
        effect('pressure', 'pressure:cultural_tension', 6, 'Cultural snub', ['pressure']),
        effect(
          'future_hook',
          `${group.id}_boycott_possible`,
          15,
          `${group.label} may boycott`,
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `${group.id}_mocked`,
          actors: [groupRef, ...regularActors],
          tags: ['grudge', group.id, 'bad_reputation', 'attribution'],
        },
        ...(regularEntityRef
          ? [
              {
                id: `regular_mocked_${regularEntityRef.id}`,
                actors: [regularEntityRef],
                tags: ['regular', 'grudge', 'ignored_complaint'],
              },
            ]
          : []),
        {
          id: `tavern_mocked_${group.id}`,
          actors: [groupRef, tavernSelf],
          tags: ['tavern_identity', 'memory', 'reputation'],
        },
      ],
      futureHooks: [
        {
          id: `${group.id}_boycott_possible`,
          actors: [groupRef],
          tags: [group.id, 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'rebrand_profile',
      responseSlotId: 'rebrand',
      immediateEffects: [
        effect('state_change', 'reputation.respectable', -3, 'Respectability slips', [
          'reputation',
        ]),
        effect('state_change', 'reputation.goblinAuthentic', 4, 'Authenticity grows', [
          'reputation',
        ]),
        effect('cause', `customer_group:${group.id}`, 4, 'Group placated by spin', [
          'customer',
          'attribution',
        ]),
        ...(staffEntityRef
          ? [
              effect(
                'state_change',
                `staff.${staffEntityRef.id}.loyalty`,
                -5,
                'Staff finds spin embarrassing',
                ['staff'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `rebrand_locks_in_${group.id}`,
          10,
          'Rebrand becomes the brand',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rebrand_attempted_${group.id}`,
          actors: [groupRef],
          tags: ['reputation', 'rebrand', 'attribution'],
        },
        ...(staffEntityRef
          ? [
              {
                id: `staff_witness_rebrand_${staffEntityRef.id}`,
                actors: [staffEntityRef],
                tags: ['staff', 'witness'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `rebrand_locks_in_${group.id}`,
          actors: [groupRef],
          tags: ['reputation', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'public_apology_profile',
      responseSlotId: 'public_apology',
      immediateEffects: [
        effect('state_change', 'reputation.respectable', 8, 'Public humility plays well', [
          'reputation',
        ]),
        effect('state_change', `${groupPath}.satisfaction`, 10, 'Group accepts the apology', [
          'customer',
        ]),
        effect('pressure', 'pressure:regular_customer_loss', -10, 'Regulars stay', ['pressure']),
        ...(regularEntityRef
          ? [
              effect(
                'cause',
                `regular:${regularEntityRef.id}`,
                10,
                'Named regular accepts apology',
                ['regular', 'favorite_order', 'attribution'],
              ),
            ]
          : []),
        ...(staffEntityRef
          ? [
              effect(
                'state_change',
                `staff.${staffEntityRef.id}.morale`,
                -8,
                'Staff felt thrown under',
                ['staff'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `apology_expectation_${group.id}`,
          8,
          'Group may expect more apologies',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `${group.id}_apology_${irritatedRegular?.id ?? 'all'}`,
          actors: [groupRef, ...regularActors],
          tags: ['customer', 'favorite_order', 'attribution'],
        },
        ...(staffEntityRef
          ? [
              {
                id: `staff_overruled_apology_${staffEntityRef.id}`,
                actors: [staffEntityRef],
                tags: ['staff', 'scapegoat'],
              },
            ]
          : []),
        {
          id: `tavern_apology_${group.id}`,
          actors: [groupRef, tavernSelf],
          tags: ['tavern_identity', 'memory', 'honesty'],
        },
      ],
      futureHooks: [
        {
          id: `apology_expectation_${group.id}`,
          actors: [groupRef],
          tags: ['customer'],
        },
      ],
    }),
    makeProfile({
      id: 'side_with_staff_profile',
      responseSlotId: 'side_with_staff',
      immediateEffects: [
        ...(staffEntityRef
          ? [
              effect(
                'state_change',
                `staff.${staffEntityRef.id}.loyalty`,
                12,
                'Staff backed by owner',
                ['staff'],
              ),
              effect(
                'cause',
                `staff:${staffEntityRef.id}`,
                8,
                'Staff publicly backed',
                ['staff', 'protected', 'attribution'],
              ),
            ]
          : []),
        effect('state_change', `${groupPath}.satisfaction`, -10, 'Group rebuffed', ['customer']),
        effect('state_change', 'reputation.respectable', -4, 'Public side-taking', ['reputation']),
        effect('cause', `customer_group:${group.id}`, -10, 'Group feels dismissed', [
          'customer',
          'bad_reputation',
          'attribution',
        ]),
        effect('pressure', 'pressure:staff_loyalty_risk', -6, 'Loyalty risk eases', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `staff_backing_remembered_${staffEntityRef?.id ?? 'staff'}`,
          10,
          'Staff remember the backing',
          ['future_hook'],
        ),
      ],
      memories: [
        ...(staffEntityRef
          ? [
              {
                id: `staff_publicly_backed_${staffEntityRef.id}`,
                actors: [staffEntityRef],
                tags: ['staff', 'protected', 'attribution'],
              },
            ]
          : []),
        {
          id: `${group.id}_dismissed`,
          actors: [groupRef, ...regularActors],
          tags: ['grudge', group.id, 'ignored_complaint', 'attribution'],
        },
      ],
      futureHooks: [
        {
          id: `staff_backing_remembered_${staffEntityRef?.id ?? 'staff'}`,
          actors: staffEntityRef ? [staffEntityRef] : [],
          tags: ['staff', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'side_with_regular_profile',
      responseSlotId: 'side_with_regular',
      immediateEffects: [
        ...(regularEntityRef
          ? [
              effect(
                'state_change',
                `world.regulars.${regularEntityRef.id}.loyalty`,
                12,
                'Regular elevated',
                ['regular'],
              ),
              effect(
                'cause',
                `regular:${regularEntityRef.id}`,
                12,
                'Regular championed',
                ['regular', 'favorite_order', 'attribution'],
              ),
            ]
          : []),
        ...(staffEntityRef
          ? [
              effect(
                'state_change',
                `staff.${staffEntityRef.id}.loyalty`,
                -10,
                'Staff publicly overruled',
                ['staff'],
              ),
              effect(
                'state_change',
                `staff.${staffEntityRef.id}.morale`,
                -6,
                'Staff morale slumps',
                ['staff'],
              ),
            ]
          : []),
        effect('pressure', 'pressure:staff_loyalty_risk', 8, 'Loyalty risk spikes', ['pressure']),
        effect('pressure', 'pressure:regular_customer_loss', -8, 'Regulars stay', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `staff_betrayal_remembered_${staffEntityRef?.id ?? 'staff'}`,
          12,
          'Staff remember being overruled',
          ['future_hook'],
        ),
      ],
      memories: [
        ...(regularEntityRef
          ? [
              {
                id: `regular_championed_${regularEntityRef.id}`,
                actors: [regularEntityRef],
                tags: ['regular', 'favorite_order', 'attribution'],
              },
            ]
          : []),
        ...(staffEntityRef
          ? [
              {
                id: `staff_overruled_${staffEntityRef.id}`,
                actors: [staffEntityRef],
                tags: ['staff', 'scapegoat', 'grudge'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `staff_betrayal_remembered_${staffEntityRef?.id ?? 'staff'}`,
          actors: staffEntityRef ? [staffEntityRef] : [],
          tags: ['staff', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'house_rule_change_profile',
      responseSlotId: 'house_rule_change',
      immediateEffects: [
        effect('state_change', 'reputation.respectable', 4, 'Codifies a standard', [
          'reputation',
        ]),
        effect('pressure', 'pressure:cultural_tension', 6, 'Some groups bristle', ['pressure']),
        effect('pressure', 'pressure:policy_backlash', 10, 'Rule sticks in throats', ['pressure']),
        effect('pressure', 'pressure:regular_customer_loss', 5, 'Some regulars drift', [
          'pressure',
        ]),
        effect('cause', `customer_group:${group.id}`, 4, 'Group sees the change', [
          'customer',
          'attribution',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `house_rule_friction_${group.id}`,
          12,
          'House rule will see friction',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `house_rule_${group.id}`,
          actors: [groupRef, tavernSelf],
          tags: ['tavern_identity', 'memory', 'policy', 'attribution'],
        },
        ...(regularEntityRef
          ? [
              {
                id: `regular_rule_witness_${regularEntityRef.id}`,
                actors: [regularEntityRef],
                tags: ['regular', 'memory'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `house_rule_friction_${group.id}`,
          actors: [groupRef],
          tags: ['policy', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'comp_table_profile',
      responseSlotId: 'comp_table',
      immediateEffects: [
        effect('state_change', 'coin', -15, 'Comp cost', ['coin']),
        effect('state_change', `${groupPath}.satisfaction`, 12, 'Whole table beams', [
          'customer',
        ]),
        // Neighbouring tables: pick a second group that isn't the complainer.
        ...(() => {
          const others = groupIds.filter((g) => g !== group.id)
          const neighbour = others.find((g) => ctx.state.customerGroups[g])
          if (!neighbour) return []
          return [
            effect(
              'state_change',
              `customers.${neighbour}.satisfaction`,
              5,
              'Neighbouring table cheers',
              ['customer'],
            ),
            effect(
              'cause',
              `customer_group:${neighbour}`,
              5,
              'Hospitality spreads',
              ['customer', 'favorite_order', 'attribution'],
            ),
          ]
        })(),
        effect('cause', `customer_group:${group.id}`, 10, 'Group remembers the comp', [
          'customer',
          'favorite_order',
          'attribution',
        ]),
        ...(regularEntityRef
          ? [
              effect(
                'state_change',
                `world.regulars.${regularEntityRef.id}.loyalty`,
                10,
                'Regular elevated',
                ['regular'],
              ),
            ]
          : []),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `${group.id}_comped_table`,
          actors: [groupRef, ...regularActors],
          tags: ['customer', group.id, 'favorite_order', 'attribution'],
        },
        ...(regularEntityRef
          ? [
              {
                id: `regular_comped_${regularEntityRef.id}`,
                actors: [regularEntityRef],
                tags: ['regular', 'favorite_order', 'attribution'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
  ]

  // Phase 40 audit pass 2 §3 — Drop staffEntityRef from the seed-level
  // affectedActors so a single staff role doesn't get counted in every
  // complaint seed. Profile memories still carry the staff ref where
  // the response actually side-takes (e.g. side_with_staff_profile).
  const seedAffected: EntityRef[] = dedupeRefs([regularEntityRef], groupRef)

  const namedEntities = [
    namedEntityIngredient(ctx.state, 'customer_group', groupRef),
  ]

  return [
    buildSeed({
      id: seedId('customer_complaint', group.id, ctx),
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
      domain: ['customers', 'reputation', 'service'],
      severity: Math.max(35, 80 - group.satisfaction),
      urgency: Math.max(30, 60 - group.satisfaction + 20),
      primaryActor: groupRef,
      affectedActors: seedAffected,
      causes,
      stakes: [
        stake(
          `${group.id}_loss`,
          `customer:${group.id}`,
          `${group.label} may stop visiting`,
          'loss',
          [group.id, 'customer'],
        ),
        stake(
          'reliability_loss',
          'reputation:respectable',
          'Respectability may drop',
          'loss',
          ['reputation'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `${group.id}_complaint_seen`,
          actors: [groupRef],
          tags: ['customer', 'complaint'],
        },
      ],
      futureHooks: [],
      toneHints: ['customer', 'reputation'],
      textIngredients: buildTextIngredients({
        subject: `the ${group.label}`,
        problemNoun: 'cold welcome',
        sensoryDetails: ['pursed lips', 'half-finished mugs'],
        actorOpinions: {
          [group.id]: 'eye the filthy floor',
        },
        recentContext: ['main room dirty all week'],
        stakesReadable: [
          `${group.label} may stop visiting`,
          'respectability may drop',
        ],
        namedEntities,
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Violence
// ----------------------------------------------------------------------

// Phase 56 / ISSUE-016 — Violence rotation. Without rotation the picker
// always selected whichever of `ogres` or `adventurers` had higher
// patronage, so the same group dominated. ISSUE-032 grew the customer
// roster; the picker now considers every group whose tags include
// `rowdy`, `dangerous`, or `incident_prone`, scored by
// `(patronage + rowdiness)` minus a recency penalty.
const VIOLENCE_RECENCY_WINDOW = 7
const VIOLENCE_RECENCY_PENALTY = 35

function violenceRecencyPenalty(
  ctx: SimContext,
  entityKey: string,
  today: number,
): number {
  const slice = ctx.state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.['violence'] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= VIOLENCE_RECENCY_WINDOW) return 0
  return VIOLENCE_RECENCY_PENALTY
}

function recordViolencePick(ctx: SimContext, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent['violence'] = {
        ...(recent['violence'] ?? {}),
        [entityKey]: today,
      }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'violence.recordPick' },
  )
}

const VIOLENCE_TENSION_TAGS = ['rowdy', 'dangerous', 'incident_prone']

function generateViolence(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.violence(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'violence')
  if (!snap || snap.value < 35) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'violence', 3)
  for (const c of recentCauseEntries(ctx, ['service', 'brawl', 'ogres', 'damage'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  // Picker rotation: consider every customer group whose tags include
  // any of `rowdy`, `dangerous`, or `incident_prone`. Score by
  // `(patronage + rowdiness)` minus a recency penalty. Falls back to
  // the previous binary ogres-vs-adventurers behaviour if no group
  // carries the relevant tags.
  const today = ctx.state.calendar.totalDaysElapsed
  const groups = Object.values(ctx.state.customerGroups)
  const candidates = groups.filter(
    (g) =>
      g.patronage > 0 &&
      g.tags.some((t) => VIOLENCE_TENSION_TAGS.includes(t)),
  )
  let target = customerRef('ogres')
  if (candidates.length > 0) {
    const ranked = candidates
      .map((g) => {
        const baseScore = g.patronage + g.rowdiness
        const penalty = violenceRecencyPenalty(
          ctx,
          `customer_group:${g.id}`,
          today,
        )
        return { g, score: baseScore - penalty }
      })
      .sort((a, b) => b.score - a.score)
    target = customerRef(ranked[0]!.g.id)
  } else {
    const ogres = ctx.state.customerGroups.ogres
    const adventurers = ctx.state.customerGroups.adventurers
    target = (ogres?.patronage ?? 0) > (adventurers?.patronage ?? 0)
      ? customerRef('ogres')
      : customerRef('adventurers')
  }
  recordViolencePick(ctx, `customer_group:${target.id}`)

  const responseSlots: ResponseSlot[] = [
    {
      id: 'hire_security',
      labelHint: 'Hire security',
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [systemRef('security')],
      expectedEffects: ['lower violence pressure', 'spend coin'],
    },
    {
      id: 'ban_group',
      labelHint: 'Ban the rowdiest group',
      allowedVerbs: ['ban'],
      shape: 'relationship_sacrifice',
      targetOptions: [target],
      expectedEffects: ['lower danger', 'lose patronage'],
    },
    {
      id: 'embrace_rowdy',
      labelHint: 'Embrace the chaos',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['raise dangerous reputation', 'lose merchants'],
    },
    {
      id: 'repair_damage',
      labelHint: 'Repair the main room',
      allowedVerbs: ['repair'],
      shape: 'short_term_patch',
      targetOptions: [areaRef('main_room')],
      expectedEffects: ['lower damage', 'spend coin'],
    },
  ]

  // Phase 56 / ISSUE-016 — Every profile carries delayedEffects and
  // futureHooks. Previously all four were flat immediate-only.
  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'hire_security_profile',
      responseSlotId: 'hire_security',
      immediateEffects: [
        effect('state_change', 'coin', -20, 'Hire security cost', ['coin']),
        effect('pressure', 'pressure:violence', -15, 'Lower violence pressure', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:staff_burnout',
          4,
          'Security crew tires the staff coordination',
          ['pressure', 'staff', 'delay:5'],
        ),
        effect(
          'future_hook',
          'security_routine_possible',
          14,
          'Security may become a routine fixture',
          ['future_hook', 'security'],
        ),
      ],
      memories: [
        { id: 'security_hired_recently', tags: ['security', 'violence'] },
      ],
      futureHooks: [
        { id: 'security_routine_possible', tags: ['security', 'violence', 'opportunity'] },
      ],
    }),
    makeProfile({
      id: 'ban_group_profile',
      responseSlotId: 'ban_group',
      immediateEffects: [
        effect('state_change', `customers.${target.id}.patronage`, -25, 'Group banned', [
          'customer',
        ]),
        effect('pressure', 'pressure:violence', -12, 'Lower violence pressure', ['pressure']),
        effect('cause', `customer_group:${target.id}`, -20, `${target.id} group banned`, [
          'customer',
          'ban',
          target.id,
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `banned_group_returns_${target.id}`,
          14,
          `${target.id} may try to return`,
          ['future_hook', 'customer', target.id],
        ),
      ],
      memories: [
        {
          id: `${target.id}_banned`,
          actors: [target],
          tags: ['ban', 'customer', target.id],
        },
      ],
      futureHooks: [
        {
          id: `banned_group_returns_${target.id}`,
          actors: [target],
          tags: ['customer', target.id, 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'embrace_rowdy_profile',
      responseSlotId: 'embrace_rowdy',
      immediateEffects: [
        effect('state_change', 'reputation.dangerous', 6, 'Dangerous rises', ['reputation']),
        effect('state_change', 'reputation.respectable', -4, 'Respectability falls', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect(
          'state_change',
          'customers.merchants.patronage',
          -8,
          'Merchants drift away from the rowdy rep',
          ['customer', 'merchants', 'delay:5'],
        ),
        effect(
          'future_hook',
          'dangerous_rep_locked',
          10,
          'Dangerous reputation may lock in',
          ['future_hook', 'reputation', 'dangerous'],
        ),
      ],
      memories: [
        { id: 'rowdy_identity_embraced', tags: ['reputation', 'identity'] },
      ],
      futureHooks: [
        { id: 'dangerous_rep_locked', tags: ['reputation', 'dangerous', 'identity'] },
      ],
    }),
    makeProfile({
      id: 'repair_damage_profile',
      responseSlotId: 'repair_damage',
      immediateEffects: [
        effect('state_change', 'areas.main_room.damage', -20, 'Repair damage', ['area']),
        effect('state_change', 'coin', -12, 'Repair cost', ['coin']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:staff_burnout',
          3,
          'Repair shifts tire the crew',
          ['pressure', 'staff', 'delay:3'],
        ),
        effect(
          'future_hook',
          'main_room_resilient',
          10,
          'Main room may shrug off later damage',
          ['future_hook', 'area', 'main_room'],
        ),
      ],
      memories: [
        { id: 'main_room_repaired_recently', tags: ['maintenance', 'main_room'] },
      ],
      futureHooks: [
        { id: 'main_room_resilient', tags: ['area', 'main_room', 'opportunity'] },
      ],
    }),
  ]

  return [
    buildSeed({
      id: seedId('violence', target.id, ctx),
      family: 'violence',
      type: 'customer_incident',
      timing: 'during_service',
      domain: ['customers', 'service', 'maintenance'],
      severity: severityFromPressures(ctx, ['violence']),
      urgency: urgencyFromPressures(ctx, ['violence']),
      // Phase 73 / ISSUE-033 §6.8 — picker-driven location.
      location: pickCustomerFacingArea(ctx, 'violence'),
      primaryActor: target,
      affectedActors: [target],
      causes,
      stakes: [
        stake('damage_stake', 'area:main_room', 'Main room may take damage', 'loss', ['damage']),
        stake('merchant_loss', 'customer:merchants', 'Merchants may flee', 'risk', ['merchants']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [{ id: 'violence_warning_seen', tags: ['violence', 'warning'] }],
      futureHooks: [{ id: 'brawl_possible', tags: ['violence', 'risk'] }],
      toneHints: ['violence', 'rowdy'],
      textIngredients: buildTextIngredients({
        subject: 'main room',
        problemNoun: 'rowdy energy',
        sensoryDetails: ['shouting voices', 'broken stools'],
        actorOpinions: { [target.id]: 'spoiling for trouble' },
        recentContext: ['brawl this week', 'damage rising'],
        stakesReadable: ['main room may break', 'merchants may flee'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Debt / Rent
// ----------------------------------------------------------------------

type MonthlySliceShape = {
  rent?: {
    monthlyAmount: number
    paidThisMonth: boolean
    missedPayments: number
    arrears: number
  }
}

function generateDebtRent(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.debt_rent(ctx)
  if (!guard.allowed) return []
  const debtSnap = pressureSnapshot(ctx, 'debt')
  const landlordSnap = pressureSnapshot(ctx, 'landlord')
  const debt = debtSnap?.value ?? 0
  const landlord = landlordSnap?.value ?? 0
  if (debt < 30 && landlord < 30 && ctx.state.coin > 50) return []

  const monthly = ctx.state.modules.monthly as MonthlySliceShape | undefined
  const rent = monthly?.rent
  const missedPayments = rent?.missedPayments ?? 0
  const paidThisMonth = rent?.paidThisMonth ?? true
  // Phase 61 / ISSUE-021 — when the `rent_due_soon` calendar tag is
  // active, bump severity/urgency and surface a calendar cause line.
  const rentDueSoon = (ctx.state.calendar.tags ?? []).includes('rent_due_soon')

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'debt', 2)
  causes.push(...pressureCauseRefsAsEntries(ctx, 'landlord', 2))
  for (const c of recentCauseEntries(ctx, ['rent', 'coin', 'wages'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'pay',
      labelHint: 'Pay what we owe',
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [systemRef('landlord')],
      expectedEffects: ['clear arrears', 'spend coin'],
    },
    {
      id: 'borrow',
      labelHint: 'Borrow coin',
      allowedVerbs: ['borrow'],
      shape: 'risky_profitable',
      targetOptions: [systemRef('lender')],
      expectedEffects: ['gain coin', 'create future debt'],
    },
    {
      id: 'delay',
      labelHint: 'Delay payment',
      allowedVerbs: ['delay'],
      shape: 'delay_problem',
      targetOptions: [systemRef('landlord')],
      expectedEffects: ['no immediate cost', 'raise landlord pressure'],
    },
    {
      id: 'raise_prices',
      labelHint: 'Raise prices',
      allowedVerbs: ['raise_price'],
      shape: 'compromise',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise margin', 'risk customer trust'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'pay_profile',
      responseSlotId: 'pay',
      immediateEffects: [
        effect('state_change', 'coin', -(rent?.monthlyAmount ?? 30), 'Pay rent', ['coin', 'rent']),
        effect('pressure', 'pressure:landlord', -15, 'Lower landlord pressure', ['pressure']),
        effect('pressure', 'pressure:debt', -10, 'Lower debt pressure', ['pressure']),
      ],
      delayedEffects: [],
      memories: [{ id: 'rent_paid_recently', tags: ['rent', 'landlord'] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'borrow_profile',
      responseSlotId: 'borrow',
      immediateEffects: [
        effect('state_change', 'coin', 40, 'Borrowed coin', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:debt', 12, 'Future debt builds', ['pressure']),
        effect(
          'future_hook',
          'loan_due_soon',
          0,
          'Loan will come due',
          ['future_hook'],
        ),
      ],
      memories: [{ id: 'borrowed_coin_recently', tags: ['coin', 'debt'] }],
      futureHooks: [{ id: 'loan_due_soon', tags: ['debt', 'risk'] }],
    }),
    makeProfile({
      id: 'delay_profile',
      responseSlotId: 'delay',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:landlord', 10, 'Landlord angrier', ['pressure']),
        effect(
          'future_hook',
          'eviction_threat_possible',
          0,
          'Landlord may threaten eviction',
          ['future_hook'],
        ),
      ],
      memories: [{ id: 'rent_delayed_recently', tags: ['rent', 'delay'] }],
      futureHooks: [
        { id: 'eviction_threat_possible', tags: ['landlord', 'risk'] },
      ],
    }),
    makeProfile({
      id: 'raise_prices_profile',
      responseSlotId: 'raise_prices',
      immediateEffects: [
        effect('state_change', 'stock.ale.salePrice', 1, 'Raise ale price', ['price']),
      ],
      delayedEffects: [
        effect('state_change', 'customers.miners.satisfaction', -6, 'Miners grumble', [
          'customer',
        ]),
      ],
      memories: [{ id: 'raised_prices_recently', tags: ['price', 'rent'] }],
      futureHooks: [],
    }),
  ]

  const stakes = [
    stake('rent_stake', 'rent', 'Rent may be missed', 'loss', ['rent']),
    stake(
      'landlord_stake',
      'pressure:landlord',
      'Landlord may evict',
      'risk',
      ['landlord'],
    ),
  ]

  return [
    buildSeed({
      id: seedId('debt_rent', paidThisMonth ? 'pressure' : 'arrears', ctx),
      family: 'debt_rent',
      type: 'debt_pressure',
      timing: 'end_month',
      domain: ['economy', 'monthly', 'landlord'],
      severity: Math.max(40, debt, landlord) + (rentDueSoon ? 10 : 0),
      urgency: Math.max(45, landlord + 10) + (rentDueSoon ? 10 : 0),
      // Audit fixes pass 1 §5.3 — No real landlord entity exists; omit
      // primaryActor (was singleton system:landlord) and let domain +
      // location stand in.
      // Phase 73 / ISSUE-033 §6.8 — picker-driven location.
      location: pickCustomerFacingArea(ctx, 'debt_rent'),
      affectedActors: [],
      causes,
      stakes,
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: 'debt_warning_seen',
          tags: ['debt', 'rent'],
        },
      ],
      futureHooks: missedPayments > 0
        ? [{ id: 'eviction_threat_possible', tags: ['landlord', 'risk'] }]
        : [],
      toneHints: ['debt', 'pressure'],
      textIngredients: buildTextIngredients({
        subject: 'rent due',
        problemNoun: 'shrinking coin pile',
        sensoryDetails: ['scratched ledger', 'thin coin stack'],
        actorOpinions: { landlord: 'arms folded, frowning' },
        recentContext: (() => {
          const ctxLines: string[] =
            missedPayments > 0 ? ['rent missed previously'] : ['coin tight for weeks']
          if (rentDueSoon) ctxLines.push('rent window approaches')
          return ctxLines
        })(),
        stakesReadable: ['rent may be missed', 'landlord may evict'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Inspection
// ----------------------------------------------------------------------

// Phase 58 / ISSUE-018 — Inspection family rotation. Pre-phase the
// family hardcoded `town_watch` as primary actor and pinned
// `scrap_collectors` plus `local_shrine` as cross-faction support
// refs on every seed, saturating those three factions on the
// 28-day named-entity audit. Picker-driven rotation now selects the
// primary from any faction whose tags include
// `inspection_authority`, `reputation_authority`, `authority`,
// `regulation`, or `enforcement`, with a +20 base-score boost when
// the faction is the inspection authority. Support refs come from
// the remaining faction set keyed on `cleanliness_relevant`,
// `ritual`, `reputation_authority`, or `reputation_influence` tags.
const INSPECTION_RECENCY_WINDOW = 7
const INSPECTION_RECENCY_PENALTY = 35
const INSPECTION_AUTHORITY_BONUS = 20

const INSPECTION_PRIMARY_TAGS = [
  'inspection_authority',
  'reputation_authority',
  'authority',
  'regulation',
  'enforcement',
]
const INSPECTION_AUTHORITY_TAG = 'inspection_authority'
const INSPECTION_SUPPORT_TAGS = [
  'cleanliness_relevant',
  'ritual',
  'reputation_authority',
  'reputation_influence',
]

function inspectionRecencyPenalty(
  ctx: SimContext,
  entityKey: string,
  today: number,
): number {
  const slice = ctx.state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.['inspection'] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= INSPECTION_RECENCY_WINDOW) return 0
  return INSPECTION_RECENCY_PENALTY
}

function recordInspectionPick(ctx: SimContext, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent['inspection'] = {
        ...(recent['inspection'] ?? {}),
        [entityKey]: today,
      }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'inspection.recordPick' },
  )
}

function generateInspection(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.inspection(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'inspection')
  if (!snap) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'inspection', 3)
  for (const c of recentCauseEntries(ctx, ['kitchen', 'privy', 'food', 'inspection'], 7, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  // Phase 58 / ISSUE-018 — Picker-driven primary faction selection.
  // Enumerate factions whose tags include any of
  // INSPECTION_PRIMARY_TAGS; score by recency penalty with a +20
  // bonus for `inspection_authority`-tagged factions. Fall back to
  // `town_watch` if it exists, then to a system ref.
  const today = ctx.state.calendar.totalDaysElapsed
  const allFactions = Object.values(ctx.state.world.factions)
  const primaryCandidates = allFactions.filter((f) =>
    f.tags.some((t) => INSPECTION_PRIMARY_TAGS.includes(t)),
  )
  let townWatch: EntityRef | undefined
  if (primaryCandidates.length > 0) {
    const ranked = primaryCandidates
      .map((f) => {
        const authorityBonus = f.tags.includes(INSPECTION_AUTHORITY_TAG)
          ? INSPECTION_AUTHORITY_BONUS
          : 0
        const penalty = inspectionRecencyPenalty(
          ctx,
          `faction:${f.id}`,
          today,
        )
        return { f, score: authorityBonus - penalty }
      })
      .sort((a, b) => b.score - a.score)
    townWatch = factionRef(ranked[0]!.f.id)
  } else if (ctx.state.world.factions['town_watch']) {
    townWatch = factionRef('town_watch')
  }
  if (townWatch) recordInspectionPick(ctx, `faction:${townWatch.id}`)

  // Pick two support faction refs from the remaining set, keyed on
  // the support tags. Distinct ids from the primary.
  const supportCandidates = allFactions.filter(
    (f) =>
      f.id !== townWatch?.id &&
      f.tags.some((t) => INSPECTION_SUPPORT_TAGS.includes(t)),
  )
  const supportRanked = supportCandidates
    .map((f) => {
      const penalty = inspectionRecencyPenalty(
        ctx,
        `faction:${f.id}`,
        today,
      )
      return { f, score: -penalty }
    })
    .sort((a, b) => b.score - a.score)
  const scrapCollectors: EntityRef | undefined = supportRanked[0]
    ? factionRef(supportRanked[0]!.f.id)
    : undefined
  const localShrine: EntityRef | undefined = supportRanked[1]
    ? factionRef(supportRanked[1]!.f.id)
    : undefined
  if (scrapCollectors)
    recordInspectionPick(ctx, `faction:${scrapCollectors.id}`)
  if (localShrine) recordInspectionPick(ctx, `faction:${localShrine.id}`)

  // Phase 44 §ISSUE-004 — Prefer a notable NPC actor when one exists
  // for the picked primary faction. Falls back to the faction ref,
  // then to a system ref so inspections still fire when no faction
  // is seeded.
  const watchInspectorNpc = townWatch
    ? findNotableNpcByFaction(ctx.state, townWatch.id)
    : undefined
  const inspectorActor = watchInspectorNpc ?? townWatch ?? systemRef('inspector')

  const allStaff = Object.values(ctx.state.staff)
  const cook = allStaff.find((s) => s.role === 'cook')
  const cleaner =
    allStaff.find((s) => s.role === 'server') ??
    allStaff.find((s) => s.role === 'cleaner') ??
    allStaff[0]
  const cookRef = cook ? staffRef(cook.id) : undefined
  const cleanerRef = cleaner ? staffRef(cleaner.id) : undefined

  const tavernSelf = tavernIdentityRef('self')

  const responseSlots: ResponseSlot[] = [
    {
      id: 'clean',
      labelHint: 'Clean the worst areas',
      allowedVerbs: ['clean'],
      shape: 'long_term_investment',
      targetOptions: [areaRef('kitchen'), areaRef('privy'), areaRef('main_room')],
      expectedEffects: ['lower inspection pressure', 'time cost'],
    },
    {
      id: 'bribe',
      labelHint: 'Bribe the inspector',
      allowedVerbs: ['bribe'],
      shape: 'risky_profitable',
      targetOptions: townWatch ? [townWatch] : [systemRef('inspector')],
      expectedEffects: ['stall inspection', 'spend coin', 'risk corruption'],
    },
    {
      id: 'hide',
      labelHint: 'Hide the evidence',
      allowedVerbs: ['hide'],
      shape: 'deception',
      targetOptions: [areaRef('cellar')],
      expectedEffects: ['stall inspection', 'risk discovery'],
    },
    {
      id: 'improve_food_safety',
      labelHint: 'Improve food safety',
      allowedVerbs: ['discard', 'clean'],
      shape: 'safe_costly',
      targetOptions: [stockRef('stew'), stockRef('mushrooms')],
      expectedEffects: ['lower food safety pressure', 'lose stock'],
    },
    {
      id: 'ignore',
      labelHint: 'Ignore it',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'risk full inspection'],
    },
    {
      id: 'cleaning_roster',
      labelHint: 'Set up a cleaning roster',
      allowedVerbs: ['delegate'],
      shape: 'long_term_investment',
      targetOptions: cleanerRef ? [cleanerRef] : [systemRef('staff')],
      expectedEffects: ['ongoing cleanliness', 'staff fatigue'],
    },
    {
      id: 'preinspection_walkthrough',
      labelHint: townWatch
        ? `Walk ${displayNameForRef(ctx.state, townWatch)} through proactively`
        : 'Walk inspectors through proactively',
      allowedVerbs: ['invite'],
      shape: 'safe_costly',
      targetOptions: townWatch ? [townWatch] : [systemRef('inspector')],
      expectedEffects: ['lower inspection', 'show good faith'],
    },
    {
      id: 'ask_town_watch_for_guidance',
      labelHint: townWatch
        ? `Ask ${displayNameForRef(ctx.state, townWatch)} for guidance`
        : 'Ask the watch for guidance',
      allowedVerbs: ['negotiate'],
      shape: 'safe_costly',
      targetOptions: townWatch ? [townWatch] : [systemRef('inspector')],
      expectedEffects: ['build watch relationship', 'spend hours'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'clean_profile',
      responseSlotId: 'clean',
      immediateEffects: [
        effect('state_change', 'areas.kitchen.cleanliness', 20, 'Kitchen cleaner', ['area']),
        effect('state_change', 'areas.privy.cleanliness', 15, 'Privy scrubbed', ['area']),
        effect('state_change', 'areas.main_room.cleanliness', 10, 'Main room polished', ['area']),
        effect('pressure', 'pressure:inspection', -12, 'Lower inspection pressure', ['pressure']),
        ...(cookRef
          ? [
              effect('state_change', `staff.${cookRef.id}.fatigue`, 8, 'Cleaning shift adds load', [
                'staff',
              ]),
            ]
          : []),
        ...(townWatch
          ? [
              effect(
                'cause',
                `faction:${townWatch.id}`,
                6,
                'Town watch notes the cleanup',
                ['faction', 'hosted_event', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [],
      memories: [
        {
          id: 'inspection_prep_recently',
          actors: cookRef ? [cookRef] : [],
          tags: ['inspection', 'cleanliness', 'attribution'],
        },
        ...(townWatch
          ? [
              {
                id: 'town_watch_clean_witness',
                actors: [townWatch],
                tags: ['faction', 'hosted_event', 'attribution'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'bribe_profile',
      responseSlotId: 'bribe',
      immediateEffects: [
        effect('state_change', 'coin', -30, 'Pay bribe', ['coin']),
        effect('pressure', 'pressure:inspection', -10, 'Stall inspection', ['pressure']),
        effect('pressure', 'pressure:cultural_tension', 12, 'Whispers of corruption', ['pressure']),
        effect('pressure', 'pressure:rumour_pressure', 8, 'Bribery rumours start', ['pressure']),
        ...(townWatch
          ? [
              effect(
                'cause',
                `faction:${townWatch.id}`,
                -10,
                'Honest watchmen disgusted',
                ['faction', 'grudge', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'corrupt_inspector_relationship',
          15,
          'Inspector may demand more',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: 'bribed_inspector',
          actors: townWatch ? [townWatch] : [],
          tags: ['bribe', 'corruption', 'grudge', 'attribution'],
        },
        {
          id: 'tavern_bribe_secret',
          actors: townWatch ? [townWatch, tavernSelf] : [tavernSelf],
          tags: ['tavern_identity', 'memory', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: 'corrupt_inspector_relationship',
          // Phase 44 §ISSUE-004 — Route through `inspectorActor` so the
          // futureHook binds to the watch inspector NPC when one is
          // seeded, lighting up the `notable_npc` ref kind for
          // downstream attribution + named-entity audits. Falls back to
          // the faction ref / system ref through `inspectorActor`'s own
          // resolution chain.
          actors: [inspectorActor],
          tags: ['inspection', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'hide_profile',
      responseSlotId: 'hide',
      immediateEffects: [
        effect('pressure', 'pressure:inspection', -6, 'Briefly lower risk', ['pressure']),
        effect('pressure', 'pressure:rumour_pressure', 8, 'Staff gossips about hidden goods', [
          'pressure',
        ]),
        ...(cookRef
          ? [
              effect('state_change', `staff.${cookRef.id}.loyalty`, -4, 'Staff worried by hiding', [
                'staff',
              ]),
            ]
          : []),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:inspection', 6, 'Hidden goods rot quietly', ['pressure']),
        effect(
          'future_hook',
          'inspection_discovery_possible',
          12,
          'Inspectors may dig deeper',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: 'hid_evidence',
          actors: cookRef ? [cookRef] : [],
          tags: ['inspection', 'deception'],
        },
        {
          id: 'tavern_hid_evidence',
          actors: [tavernSelf],
          tags: ['tavern_identity', 'memory', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: 'inspection_discovery_possible',
          // Phase 44 §ISSUE-004 — Lift to `inspectorActor` so the
          // notable NPC ref reaches this hook (see corrupt_inspector
          // hook above for the full note).
          actors: [inspectorActor],
          tags: ['inspection', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'improve_food_safety_profile',
      responseSlotId: 'improve_food_safety',
      immediateEffects: [
        effect('state_change', 'stock.mushrooms.quantity', -15, 'Discard mushrooms', ['stock']),
        effect('state_change', 'stock.stew.quantity', -10, 'Discard stew', ['stock']),
        effect('pressure', 'pressure:inspection', -8, 'Lower inspection pressure', ['pressure']),
        effect('pressure', 'pressure:food_safety', -10, 'Lower food safety', ['pressure']),
        ...(cookRef
          ? [
              effect('state_change', `staff.${cookRef.id}.morale`, 5, 'Cook proud of standard', [
                'staff',
              ]),
            ]
          : []),
        effect('cause', 'pressure:food_safety', -10, 'Food safety closed off', [
          'food_safety',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: 'food_safety_improved_recently',
          actors: cookRef ? [cookRef] : [],
          tags: ['food_safety', 'inspection', 'attribution'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_profile',
      responseSlotId: 'ignore',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:inspection', 8, 'Inspection looms', ['pressure']),
        effect('pressure', 'pressure:rumour_pressure', 6, 'Bad word spreads', ['pressure']),
        effect('state_change', 'reputation.dangerous', 4, 'Reputation sours', ['reputation']),
      ],
      memories: [
        {
          id: 'inspection_ignored_recently',
          actors: townWatch ? [townWatch] : [],
          tags: ['inspection', 'ignored'],
        },
        {
          id: 'tavern_ignored_inspection',
          actors: [tavernSelf],
          tags: ['tavern_identity', 'memory', 'ignored'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'cleaning_roster_profile',
      responseSlotId: 'cleaning_roster',
      immediateEffects: [
        effect('state_change', 'areas.kitchen.cleanliness', 12, 'Roster keeps kitchen clean', [
          'area',
        ]),
        effect('state_change', 'areas.privy.cleanliness', 12, 'Roster covers privy', ['area']),
        effect('state_change', 'areas.main_room.cleanliness', 10, 'Floor mopped each shift', [
          'area',
        ]),
        effect('pressure', 'pressure:inspection', -12, 'Routine keeps inspection at bay', [
          'pressure',
        ]),
        ...(cleanerRef
          ? [
              effect('state_change', `staff.${cleanerRef.id}.fatigue`, 8, 'Cleaning shifts tire', [
                'staff',
              ]),
              effect('cause', `staff:${cleanerRef.id}`, 5, 'Staff trusted with roster', [
                'staff',
                'protected',
                'attribution',
              ]),
            ]
          : []),
        ...(scrapCollectors
          ? [
              effect(
                'cause',
                `faction:${scrapCollectors.id}`,
                8,
                'Scrap collectors appreciate the routine',
                ['faction', 'hosted_event', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'cleaning_routine_streak',
          10,
          'Routine becomes a habit',
          ['future_hook'],
        ),
      ],
      memories: [
        ...(cleanerRef
          ? [
              {
                id: `staff_cleaning_roster_${cleanerRef.id}`,
                actors: [cleanerRef],
                tags: ['staff', 'protected', 'attribution'],
              },
            ]
          : []),
        ...(scrapCollectors
          ? [
              {
                id: 'scrap_collectors_routine',
                actors: [scrapCollectors],
                tags: ['faction', 'hosted_event', 'attribution'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: 'cleaning_routine_streak',
          actors: cleanerRef ? [cleanerRef] : [],
          tags: ['inspection', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'preinspection_walkthrough_profile',
      responseSlotId: 'preinspection_walkthrough',
      immediateEffects: [
        effect('state_change', 'coin', -5, 'Drinks and time for the visit', ['coin']),
        effect('pressure', 'pressure:inspection', -15, 'Walkthrough cools the watch', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 5, 'Honest tavern signal', [
          'reputation',
        ]),
        ...(townWatch
          ? [
              effect(
                'cause',
                `faction:${townWatch.id}`,
                12,
                'Watch impressed by the openness',
                ['faction', 'hosted_event', 'honoured_discount', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'town_watch_goodwill',
          10,
          'Watch may return with goodwill',
          ['future_hook'],
        ),
      ],
      memories: [
        ...(townWatch
          ? [
              {
                id: 'town_watch_walkthrough',
                actors: [townWatch],
                tags: ['faction', 'hosted_event', 'attribution'],
              },
            ]
          : []),
        {
          id: 'tavern_walkthrough_done',
          actors: townWatch ? [townWatch, tavernSelf] : [tavernSelf],
          tags: ['tavern_identity', 'memory', 'standards'],
        },
      ],
      futureHooks: [
        {
          id: 'town_watch_goodwill',
          // Phase 44 §ISSUE-004 — Lift to `inspectorActor`.
          actors: [inspectorActor],
          tags: ['inspection', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'ask_town_watch_for_guidance_profile',
      responseSlotId: 'ask_town_watch_for_guidance',
      immediateEffects: [
        effect('pressure', 'pressure:inspection', -10, 'Watch advises soft pre-checks', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 5, 'Earnest signal helps reputation', [
          'reputation',
        ]),
        ...(townWatch
          ? [
              effect(
                'cause',
                `faction:${townWatch.id}`,
                10,
                'Watch flattered to advise',
                ['faction', 'honoured_discount', 'attribution'],
              ),
            ]
          : []),
        ...(localShrine
          ? [
              effect(
                'cause',
                `faction:${localShrine.id}`,
                4,
                'Shrine appreciates the discretion',
                ['faction', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'town_watch_advisor',
          8,
          'Watch may keep an open door',
          ['future_hook'],
        ),
      ],
      memories: [
        ...(townWatch
          ? [
              {
                id: 'town_watch_advisor_memory',
                actors: [townWatch],
                tags: ['faction', 'hosted_event', 'attribution'],
              },
            ]
          : []),
        ...(cleanerRef
          ? [
              {
                id: `staff_escorted_watch_${cleanerRef.id}`,
                actors: [cleanerRef],
                tags: ['staff', 'protected'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: 'town_watch_advisor',
          // Phase 44 §ISSUE-004 — The orphan hook in ISSUE-004's
          // evidence. Lifting through `inspectorActor` binds it to the
          // watch inspector NPC when seeded, which is the explicit
          // resolution called for in the issue scope ("at least one
          // seed family hook that binds to a notable NPC").
          actors: [inspectorActor],
          tags: ['inspection', 'opportunity'],
        },
      ],
    }),
  ]

  // Phase 40 audit pass 2 §4 — Drop staff refs from seed-level
  // affectedActors. Each inspection seed runs daily under high pressure
  // so listing cookRef + cleanerRef here causes severe staff repetition
  // counts. The cleaning_roster / preinspection_walkthrough profiles
  // still reference staff inside their memories.
  const seedAffected: EntityRef[] = dedupeRefs(
    [scrapCollectors, localShrine],
    inspectorActor,
  )

  const namedEntities = [
    namedEntityIngredient(ctx.state, 'inspector', inspectorActor),
  ]

  return [
    buildSeed({
      id: seedId('inspection', 'threat', ctx),
      family: 'inspection',
      type: 'inspection_threat',
      timing: 'morning_prep',
      domain: ['inspection', 'food', 'areas', 'reputation'],
      severity: severityFromPressures(ctx, ['inspection']),
      urgency: urgencyFromPressures(ctx, ['inspection']),
      primaryActor: inspectorActor,
      affectedActors: seedAffected,
      location: areaRef('main_room'),
      causes,
      stakes: [
        stake('inspection_stake', 'pressure:inspection', 'Inspector may visit', 'risk', [
          'inspection',
        ]),
        stake('rep_stake', 'reputation:filthy', 'Reputation may rot', 'loss', ['reputation']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [{ id: 'inspection_warning_seen', tags: ['inspection', 'warning'] }],
      futureHooks: [{ id: 'inspector_followup_possible', tags: ['inspection', 'risk'] }],
      toneHints: ['inspection', 'urgent'],
      textIngredients: buildTextIngredients({
        subject: 'the tavern',
        problemNoun: 'inspection looming',
        sensoryDetails: ['privy stench', 'grimy floor'],
        actorOpinions: {
          merchants: 'whisper about inspectors',
        },
        recentContext: ['privy left filthy', 'kitchen dirty for days'],
        stakesReadable: ['inspector may visit', 'reputation may rot'],
        namedEntities,
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Reputation shift
// ----------------------------------------------------------------------

// Phase 55 / ISSUE-015 — Reputation-axis rotation. Without a recency
// penalty the family would always pick whichever axis had the largest
// |value - 50| deviation, so the same axis dominates day after day. A
// per-axis penalty rotates picks across the top-2 / top-3 strongest
// axes.
const REPUTATION_RECENCY_WINDOW = 5
const REPUTATION_RECENCY_PENALTY = 18

function reputationRecencyPenalty(
  ctx: SimContext,
  entityKey: string,
  today: number,
): number {
  const slice = ctx.state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.['reputation_shift'] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= REPUTATION_RECENCY_WINDOW) return 0
  return REPUTATION_RECENCY_PENALTY
}

function recordReputationPick(ctx: SimContext, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent['reputation_shift'] = {
        ...(recent['reputation_shift'] ?? {}),
        [entityKey]: today,
      }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'reputationShift.recordPick' },
  )
}

function generateReputationShift(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.reputation_shift(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'reputation_drift')
  if (!snap || snap.value < 35) return []

  // Score each reputation axis by |value - 50| minus a recency penalty.
  // Pick the highest after penalty, preserving the "strongest axis
  // dominates" intuition while rotating across the top axes day to day.
  const today = ctx.state.calendar.totalDaysElapsed
  const axes = Object.entries(ctx.state.reputation)
  const ranked = axes
    .map(([id, value]) => {
      const baseScore = Math.abs(value - 50)
      const penalty = reputationRecencyPenalty(ctx, `reputation:${id}`, today)
      return { id, value, score: baseScore - penalty, baseScore }
    })
    .sort((a, b) => b.score - a.score)
  const top = ranked[0]
  // Require either a real deviation OR the recency penalty isn't
  // hiding a still-significant deviation — the underlying base score
  // must clear 15 for the family to fire.
  if (!top || top.baseScore < 15) return []
  const axisId = top.id
  const axisValue = top.value
  recordReputationPick(ctx, `reputation:${axisId}`)

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'reputation_drift', 3)
  for (const c of recentCauseEntries(ctx, ['reputation', axisId, 'customer'], 14, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'embrace',
      labelHint: 'Embrace the identity',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['lean into reputation', 'narrow audience'],
    },
    {
      id: 'correct',
      labelHint: 'Correct the identity',
      allowedVerbs: ['clean', 'repair', 'pay'],
      shape: 'long_term_investment',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['shift reputation away', 'costly effort'],
    },
    {
      id: 'advertise',
      labelHint: 'Advertise to matching group',
      allowedVerbs: ['invite'],
      shape: 'compromise',
      targetOptions: [customerRef('miners'), customerRef('merchants')],
      expectedEffects: ['raise patronage', 'lock identity'],
    },
    {
      id: 'diversify',
      labelHint: 'Diversify',
      allowedVerbs: ['rebrand'],
      shape: 'compromise',
      targetOptions: [systemRef('customers')],
      expectedEffects: ['broaden appeal', 'risk dilution'],
    },
  ]

  // Phase 55 / ISSUE-015 — Each profile now carries at least one
  // `delayedEffect` and one `futureHook`. Previously all four were flat
  // immediate-only with `delayedEffects: []` and only the seed itself
  // carried a single `identity_lock_in_possible` hook.
  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'embrace_profile',
      responseSlotId: 'embrace',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, 5, 'Lean into reputation', ['reputation']),
      ],
      delayedEffects: [
        effect(
          'state_change',
          `reputation.${axisId}`,
          3,
          'Embraced identity continues to drift',
          ['reputation', 'delay:7'],
        ),
        effect(
          'future_hook',
          `identity_lock_in_${axisId}`,
          14,
          `${axisId} identity may lock in`,
          ['future_hook', 'reputation', axisId],
        ),
      ],
      memories: [{ id: `embraced_${axisId}_identity`, tags: ['reputation', axisId] }],
      futureHooks: [
        {
          id: `identity_lock_in_${axisId}`,
          tags: ['reputation', axisId, 'identity'],
        },
      ],
    }),
    makeProfile({
      id: 'correct_profile',
      responseSlotId: 'correct',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, -5, 'Shift reputation', ['reputation']),
        effect('state_change', 'coin', -10, 'Effort cost', ['coin']),
      ],
      delayedEffects: [
        effect(
          'state_change',
          `reputation.${axisId}`,
          -3,
          'Correction shows through across the week',
          ['reputation', 'delay:5'],
        ),
        effect(
          'future_hook',
          `identity_correction_${axisId}`,
          10,
          `${axisId} correction may settle`,
          ['future_hook', 'reputation', axisId],
        ),
      ],
      memories: [{ id: `corrected_${axisId}_identity`, tags: ['reputation', axisId] }],
      futureHooks: [
        {
          id: `identity_correction_${axisId}`,
          tags: ['reputation', axisId, 'correction'],
        },
      ],
    }),
    makeProfile({
      id: 'advertise_profile',
      responseSlotId: 'advertise',
      immediateEffects: [
        effect('state_change', 'customers.miners.patronage', 8, 'Bring in matching group', [
          'customer',
        ]),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:reputation_drift',
          4,
          'Targeted advertising deepens the drift',
          ['pressure', 'reputation', 'delay:5'],
        ),
        effect(
          'future_hook',
          `audience_lock_${axisId}`,
          10,
          `${axisId} audience may lock in`,
          ['future_hook', 'reputation', axisId, 'audience'],
        ),
      ],
      memories: [{ id: 'advertised_to_group_recently', tags: ['customer', 'reputation'] }],
      futureHooks: [
        {
          id: `audience_lock_${axisId}`,
          tags: ['reputation', axisId, 'audience'],
        },
      ],
    }),
    makeProfile({
      id: 'diversify_profile',
      responseSlotId: 'diversify',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, -3, 'Soften identity', ['reputation']),
        effect('state_change', 'customers.merchants.patronage', 4, 'Broader appeal lands', [
          'customer',
        ]),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:rumour_pressure',
          3,
          'Mixed messages breed gossip',
          ['pressure', 'rumour', 'delay:5'],
        ),
        effect(
          'future_hook',
          `audience_dilution_${axisId}`,
          12,
          `${axisId} audience may dilute`,
          ['future_hook', 'reputation', axisId, 'dilution'],
        ),
      ],
      memories: [{ id: 'diversification_attempted', tags: ['reputation', 'identity'] }],
      futureHooks: [
        {
          id: `audience_dilution_${axisId}`,
          tags: ['reputation', axisId, 'dilution'],
        },
      ],
    }),
  ]

  return [
    buildSeed({
      id: seedId('reputation_shift', axisId, ctx),
      family: 'reputation_shift',
      type: 'reputation_shift',
      timing: 'closing',
      domain: ['reputation', 'customers'],
      severity: Math.max(30, Math.abs(axisValue - 50)),
      urgency: Math.max(25, snap.urgency),
      // Audit fixes pass 1 §5.3 — Reputation is tavern-wide; omit
      // primaryActor (was singleton system:reputation) and locate the
      // seed in the public room instead.
      location: areaRef('main_room'),
      affectedActors: [],
      causes,
      stakes: [
        stake(
          'identity_stake',
          `reputation:${axisId}`,
          'Identity may lock in',
          'risk',
          ['reputation', axisId],
        ),
        stake(
          'audience_stake',
          'service:audience',
          'Audience may narrow',
          'risk',
          ['customer'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        { id: `reputation_shift_${axisId}_seen`, tags: ['reputation', axisId] },
      ],
      futureHooks: [{ id: 'identity_lock_in_possible', tags: ['reputation', 'identity'] }],
      toneHints: ['identity', 'reputation'],
      textIngredients: buildTextIngredients({
        subject: 'the tavern',
        problemNoun: 'identity shift',
        sensoryDetails: ['regulars settle in', 'newcomers turn away'],
        actorOpinions: { regulars: 'feel at home here' },
        recentContext: [`${axisId} reputation rising`],
        stakesReadable: ['identity may lock in', 'audience may narrow'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Monthly review
// ----------------------------------------------------------------------

function generateMonthlyReview(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.monthly_review(ctx)
  if (!guard.allowed) return []

  // Pull together a summary based on the just-finalized month.
  const monthly = ctx.state.modules.monthly as
    | {
        lastMonthlyResult?: {
          monthKey: string
          endingCoin: number
          economy: { net: number }
          // Phase 59 fix — `rent` carries the resolved RentResolution
          // from `resolveRent`; `pay_landlord_on_time` must consult it
          // to avoid double-charging coin that was already spent at
          // month-end.
          rent: {
            amountDue: number
            paid: boolean
            paidAmount: number
            arrears: number
            missedPayments: number
          }
        }
        rent?: { monthlyAmount?: number }
      }
    | undefined
  const result = monthly?.lastMonthlyResult
  if (!result) return []

  const causes: CauseEntry[] = recentCauseEntries(
    ctx,
    ['monthly', 'rent', 'reputation', 'inspection'],
    28,
    5,
  )
  if (causes.length === 0) {
    // ensure at least a synthetic cause from monthly result so validation passes
    causes.push(...pressureCauseRefsAsEntries(ctx, 'landlord', 1))
  }
  if (causes.length === 0) {
    return []
  }

  // Phase 59 / ISSUE-019 — Promote monthly_review to a card family.
  // Four strategic month-end decisions, each shaped by month-end
  // context. The `settle_with_rival` slot gracefully degrades to
  // 3 slots when the `rival_taverns` faction (added in phase 52) isn't
  // seeded, preserving the contract's ≥ 2-slot floor.
  // `monthlyModule.endMonth` has already run `resolveRent` before this
  // seed fires; if `result.rent.paid` is true the coin has already been
  // spent, so `pay_landlord_on_time` must charge 0. Otherwise it
  // settles the full outstanding `amountDue` (monthly + arrears).
  const rentDueNow = result.rent.paid ? 0 : result.rent.amountDue
  const rivalRef = ctx.state.world.factions['rival_taverns']
    ? factionRef('rival_taverns')
    : undefined

  const monthRef: EntityRef = { kind: 'other', id: `month:${result.monthKey}` }

  const responseSlots: ResponseSlot[] = [
    {
      id: 'pay_landlord_on_time',
      labelHint: 'Pay the landlord on time',
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [systemRef('landlord')],
      expectedEffects: ['lower landlord pressure', 'spend coin'],
    },
    {
      id: 'invest_in_cellar',
      labelHint: 'Invest in the cellar',
      allowedVerbs: ['upgrade'],
      shape: 'long_term_investment',
      targetOptions: [areaRef('cellar')],
      expectedEffects: ['improve cellar', 'risk rent slip'],
    },
    {
      id: 'hold_reserves',
      labelHint: 'Hold reserves through next month',
      allowedVerbs: ['delay'],
      shape: 'compromise',
      targetOptions: [systemRef('reserves')],
      expectedEffects: ['lower debt', 'staff feel the squeeze'],
    },
    ...(rivalRef
      ? [
          {
            id: 'settle_with_rival',
            labelHint: 'Settle with the rival tavern',
            allowedVerbs: ['negotiate'],
            shape: 'compromise',
            targetOptions: [rivalRef],
            expectedEffects: ['lower rival pressure', 'fuel gossip'],
          } as ResponseSlot,
        ]
      : []),
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'pay_landlord_on_time_profile',
      responseSlotId: 'pay_landlord_on_time',
      immediateEffects: [
        effect(
          'state_change',
          'coin',
          -rentDueNow,
          result.rent.paid
            ? 'Rent already paid this month'
            : 'Rent settled with the landlord',
          ['coin', 'rent'],
        ),
        effect('pressure', 'pressure:landlord', -25, 'Landlord eased', ['pressure', 'landlord']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:debt',
          6,
          'Reserves thinner after rent',
          ['pressure', 'debt', 'delay:5'],
        ),
        effect(
          'future_hook',
          'landlord_goodwill_window',
          30,
          'Landlord may offer a window of goodwill',
          ['future_hook', 'landlord'],
        ),
      ],
      memories: [
        {
          id: `rent_paid_${result.monthKey}`,
          actors: [systemRef('landlord')],
          tags: ['rent', 'paid', 'monthly'],
        },
      ],
      futureHooks: [
        {
          id: 'landlord_goodwill_window',
          actors: [systemRef('landlord')],
          tags: ['landlord', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'invest_in_cellar_profile',
      responseSlotId: 'invest_in_cellar',
      immediateEffects: [
        effect('state_change', 'coin', -20, 'Cellar investment', ['coin']),
        effect('state_change', 'areas.cellar.condition', 12, 'Cellar improves', ['area', 'cellar']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:landlord',
          12,
          'Rent slip — landlord notices',
          ['pressure', 'landlord', 'delay:3'],
        ),
        effect(
          'future_hook',
          `cellar_capacity_unlocked_${result.monthKey}`,
          14,
          'Cellar capacity may unlock next month',
          ['future_hook', 'cellar'],
        ),
      ],
      memories: [
        {
          id: `cellar_invested_${result.monthKey}`,
          actors: [areaRef('cellar')],
          tags: ['cellar', 'investment', 'monthly'],
        },
      ],
      futureHooks: [
        {
          id: `cellar_capacity_unlocked_${result.monthKey}`,
          actors: [areaRef('cellar')],
          tags: ['cellar', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'hold_reserves_profile',
      responseSlotId: 'hold_reserves',
      immediateEffects: [
        effect('pressure', 'pressure:debt', -4, 'Reserves held', ['pressure', 'debt']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:staff_loyalty_risk',
          6,
          'Staff sense the penny-pinching',
          ['pressure', 'staff', 'delay:7'],
        ),
        effect(
          'future_hook',
          `reserves_intact_${result.monthKey}`,
          28,
          'Reserves intact through next month',
          ['future_hook', 'reserves'],
        ),
      ],
      memories: [
        {
          id: `reserves_held_${result.monthKey}`,
          tags: ['reserves', 'monthly'],
        },
      ],
      futureHooks: [
        {
          id: `reserves_intact_${result.monthKey}`,
          tags: ['reserves', 'opportunity'],
        },
      ],
    }),
    ...(rivalRef
      ? [
          makeProfile({
            id: 'settle_with_rival_profile',
            responseSlotId: 'settle_with_rival',
            immediateEffects: [
              effect('state_change', 'coin', -15, 'Settlement payment', ['coin']),
              effect('cause', `faction:${rivalRef.id}`, 12, 'Rival eases up', [
                'faction',
                'rival',
                'settle',
              ]),
              effect(
                'pressure',
                'pressure:rival_tavern_pressure',
                -12,
                'Rival pressure cools',
                ['pressure', 'rival'],
              ),
            ],
            delayedEffects: [
              effect(
                'pressure',
                'pressure:rumour_pressure',
                6,
                'Visible accommodation feeds gossip',
                ['pressure', 'rumour', 'delay:5'],
              ),
              effect(
                'future_hook',
                `rival_settlement_pact_${result.monthKey}`,
                21,
                'Rival pact may reopen later',
                ['future_hook', 'rival'],
              ),
            ],
            memories: [
              {
                id: `rival_settled_${result.monthKey}`,
                actors: [rivalRef],
                tags: ['rival', 'settle', 'monthly'],
              },
            ],
            futureHooks: [
              {
                id: `rival_settlement_pact_${result.monthKey}`,
                actors: [rivalRef],
                tags: ['rival', 'opportunity'],
              },
            ],
          }),
        ]
      : []),
  ]

  return [
    buildSeed({
      id: seedId('monthly_review', result.monthKey, ctx),
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
      domain: ['monthly', 'economy', 'reputation'],
      severity: 40,
      urgency: 30,
      primaryActor: monthRef,
      affectedActors: [],
      causes,
      stakes: [
        stake('rent_stake', 'pressure:landlord', 'Rent may slip', 'risk', ['rent', 'landlord']),
        stake('coin_stake', 'coin', 'Coin reserves at stake', 'loss', ['coin']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `monthly_review_${result.monthKey}`,
          actors: [monthRef],
          tags: ['monthly', 'review'],
        },
      ],
      futureHooks: [],
      toneHints: ['summary', 'monthly'],
      textIngredients: buildTextIngredients({
        subject: `month ${result.monthKey}`,
        problemNoun: 'month review',
        sensoryDetails: ['ledger closed', 'lamps trimmed'],
        actorOpinions: {},
        recentContext: [`net coin change ${result.economy.net}`],
        stakesReadable: ['rent may slip', 'coin reserves at stake'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Generator registry definitions
// ----------------------------------------------------------------------

export const REQUIRED_SEED_GENERATORS: IssueSeedGenerator[] = [
  {
    id: 'food_safety_kitchen_risk',
    family: 'food_safety',
    domain: ['food', 'kitchen'],
    timing: ['morning_prep'],
    generate: generateFoodSafety,
  },
  {
    id: 'stock_shortage_ale',
    family: 'stock_shortage',
    domain: ['stock', 'customers'],
    timing: ['morning_prep'],
    generate: generateStockShortage,
  },
  {
    id: 'maintenance_worst_area',
    family: 'maintenance',
    domain: ['areas', 'maintenance'],
    timing: ['morning_prep'],
    generate: generateMaintenance,
  },
  {
    id: 'staff_burnout_worst_staff',
    family: 'staff_burnout',
    domain: ['staff'],
    timing: ['morning_prep'],
    generate: generateStaffBurnout,
  },
  {
    id: 'customer_complaint_merchants',
    family: 'customer_complaint',
    domain: ['customers', 'reputation'],
    timing: ['during_service'],
    generate: generateCustomerComplaint,
  },
  {
    id: 'violence_brawl_risk',
    family: 'violence',
    domain: ['customers', 'service'],
    timing: ['during_service'],
    generate: generateViolence,
  },
  {
    id: 'debt_rent_pressure',
    family: 'debt_rent',
    domain: ['economy', 'monthly'],
    timing: ['end_month'],
    generate: generateDebtRent,
  },
  {
    id: 'inspection_threat',
    family: 'inspection',
    domain: ['inspection', 'areas'],
    timing: ['morning_prep'],
    generate: generateInspection,
  },
  {
    id: 'reputation_shift_axis',
    family: 'reputation_shift',
    domain: ['reputation', 'customers'],
    timing: ['closing'],
    generate: generateReputationShift,
  },
  {
    id: 'monthly_review',
    family: 'monthly_review',
    domain: ['monthly', 'economy'],
    timing: ['end_month'],
    generate: generateMonthlyReview,
  },
]

// Phase 39 §39.5–§39.14 — the expanded families are registered alongside
// the original ten. Generators that depend on world entities (suppliers,
// regulars, factions, cultures, arcs, policies) self-skip when those
// entities aren't present, so the expanded set is safe to register on
// every initialization.
export const ALL_SEED_GENERATORS: IssueSeedGenerator[] = [
  ...REQUIRED_SEED_GENERATORS,
  ...EXPANDED_SEED_GENERATORS,
]

let initialized = false
export function ensureRequiredSeedGeneratorsRegistered(
  registry: { register(g: IssueSeedGenerator): void; has(id: string): boolean },
): void {
  if (initialized) return
  for (const gen of ALL_SEED_GENERATORS) {
    if (!registry.has(gen.id)) registry.register(gen)
  }
  initialized = true
}
