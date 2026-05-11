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
  effect,
  makeProfile,
  pressureCauseRefsAsEntries,
  pressureSnapshot,
  recentCauseEntries,
  seedId,
  severityFromPressures,
  stake,
  staffRef,
  stockRef,
  systemRef,
  urgencyFromPressures,
} from './generatorHelpers'
import type { IssueSeedGenerator } from './issueSeedRegistry'

// Phase 19 §19.7 — Initial seed families.
//
// Each generator is a pure function of SimContext. Generators inspect
// the current state, pressure snapshots, and recent causes; when a
// trigger condition is met they build a structured seed. Generators do
// NOT decide whether the seed should be presented — ranking does that.

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
      delayedEffects: [],
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
      futureHooks: [],
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

  const sensoryDetails: string[] = []
  if (mushrooms && mushrooms.spoilage >= 50) sensoryDetails.push('blue mushroom foam')
  if (stew && stew.spoilage >= 50) sensoryDetails.push('vinegar stew stink')
  if (kitchen && kitchen.cleanliness < 30) sensoryDetails.push('greasy floor')

  const actorOpinions: Record<string, string> = {}
  if (cook) actorOpinions['cook'] = 'insists it is fine'
  actorOpinions['merchants'] = 'look horrified'

  return [
    buildSeed({
      id: seedId('food_safety', 'kitchen_risk', ctx),
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
        subject: 'the stew',
        problemNoun: 'sour bubbling',
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

function generateStockShortage(ctx: SimContext): IssueSeed[] {
  const familyGuard = CONTRADICTION_GUARDS.stock_shortage(ctx)
  if (!familyGuard.allowed) return []
  const guard = aleStockHighGuard(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'stock_shortage')
  if (!snap || snap.value < 35) return []

  const ale = ctx.state.stock.ale
  if (!ale || ale.quantity > 30) return []
  const dayType = ctx.state.calendar.dayType
  const highDemand = HIGH_DEMAND_DAY_TYPES.has(dayType)

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'stock_shortage', 3)
  for (const c of recentCauseEntries(ctx, ['stock', 'ale', 'sales'], 5, 2)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'restock',
      labelHint: 'Restock ale',
      allowedVerbs: ['buy'],
      shape: 'safe_costly',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise ale quantity', 'spend coin'],
    },
    {
      id: 'raise_prices',
      labelHint: 'Raise prices',
      allowedVerbs: ['raise_price'],
      shape: 'risky_profitable',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise margin', 'risk customer satisfaction'],
    },
    {
      id: 'water_down',
      labelHint: 'Stretch the ale',
      allowedVerbs: ['serve'],
      shape: 'deception',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise quantity', 'lower quality', 'risk reputation'],
    },
    {
      id: 'limit_sales',
      labelHint: 'Limit sales',
      allowedVerbs: ['delay'],
      shape: 'compromise',
      targetOptions: [stockRef('ale')],
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
        effect('state_change', 'stock.ale.quantity', 60, 'Add ale to stock', ['stock']),
        effect('state_change', 'coin', -30, 'Spend coin restocking', ['coin']),
        effect('pressure', 'pressure:stock_shortage', -15, 'Lower shortage pressure', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'restocked_ale_recently', tags: ['stock', 'ale'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'raise_prices_profile',
      responseSlotId: 'raise_prices',
      immediateEffects: [
        effect('state_change', 'stock.ale.salePrice', 1, 'Raise ale price', ['stock', 'price']),
        effect('state_change', 'customers.miners.satisfaction', -8, 'Miners grumble', ['customer']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'raised_prices_recently', tags: ['price', 'reputation'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'water_down_profile',
      responseSlotId: 'water_down',
      immediateEffects: [
        effect('state_change', 'stock.ale.quantity', 20, 'Stretch ale', ['stock']),
        effect('state_change', 'stock.ale.quality', -15, 'Lower ale quality', ['stock', 'quality']),
        effect('pressure', 'pressure:reputation_drift', 5, 'Reputation drifts', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'ale_watering_rumor_possible',
          0,
          'Watered ale rumor may emerge',
          ['future_hook'],
        ),
      ],
      memories: [
        { id: 'watered_ale_recently', tags: ['ale', 'deception'] },
      ],
      futureHooks: [
        { id: 'ale_watering_rumor_possible', tags: ['ale', 'rumor'] },
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
      delayedEffects: [],
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
    stake('ale_stake', 'stock:ale', 'Ale may run dry', 'loss', ['ale', 'stock']),
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
      id: seedId('stock_shortage', `ale_${dayType}`, ctx),
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
        subject: 'ale stock',
        problemNoun: 'low stock',
        sensoryDetails: ['empty kegs', 'thirsty regulars'],
        actorOpinions: { miners: 'glance at the taps' },
        recentContext: ['ale sales heavy this week'],
        stakesReadable: ['ale may run dry', 'miners may leave'],
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
  // pick the worst area
  const worst = Object.values(ctx.state.areas)
    .slice()
    .sort((a, b) => b.damage - a.damage + (60 - a.condition) - (60 - b.condition))[0]
  if (!worst) return []

  if (worst.id === 'roof' && !roofGuard.allowed) return []

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
      delayedEffects: [],
      memories: [
        { id: `${worst.id}_repaired_recently`, tags: ['maintenance', worst.id] },
      ],
      futureHooks: [],
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

function generateStaffBurnout(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.staff_burnout(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'staff_burnout')
  if (!snap || snap.value < 40) return []
  const allStaff = Object.values(ctx.state.staff)
  if (allStaff.length === 0) return []
  const worst = allStaff
    .slice()
    .sort((a, b) => b.stress + b.fatigue - (a.stress + a.fatigue))[0]!

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
      delayedEffects: [],
      memories: [
        {
          id: 'staff_bonus_paid_recently',
          actors: [staffRef(worst.id)],
          tags: ['staff', 'bonus'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'reduce_workload_profile',
      responseSlotId: 'reduce_workload',
      immediateEffects: [
        effect('state_change', `staff.${worst.id}.fatigue`, -15, 'Lower fatigue', ['staff']),
        effect('state_change', `staff.${worst.id}.stress`, -10, 'Lower stress', ['staff']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: 'workload_reduced_recently',
          actors: [staffRef(worst.id)],
          tags: ['staff', 'workload'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'push_through_profile',
      responseSlotId: 'push_through',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:staff_burnout', 8, 'Burnout worsens', ['pressure']),
        effect(
          'future_hook',
          'staff_quit_risk_possible',
          0,
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
          id: 'staff_quit_risk_possible',
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
      ],
      delayedEffects: [],
      memories: [
        {
          id: 'reassigned_priorities_recently',
          tags: ['staff', 'priority'],
        },
      ],
      futureHooks: [],
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
        subject: worst.name,
        problemNoun: 'exhaustion',
        sensoryDetails: ['hunched shoulders', 'dark eyes'],
        actorOpinions: { [worst.id]: 'looks ready to snap' },
        recentContext: ['heavy week of service'],
        stakesReadable: [`${worst.name} may quit`, 'service may decline'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Customer complaint
// ----------------------------------------------------------------------

function generateCustomerComplaint(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.customer_complaint(ctx)
  if (!guard.allowed) return []
  const presence = merchantPresenceGuard(ctx)
  if (!presence.allowed) return []
  const merchants = ctx.state.customerGroups.merchants
  if (!merchants) return []
  if (merchants.satisfaction > 40) return []

  const causes: CauseEntry[] = []
  const recent = recentCauseEntries(
    ctx,
    ['customer', 'merchants', 'area', 'reputation', 'cleanliness'],
    7,
    4,
  )
  causes.push(...recent)
  // augment with pressure causes that explain merchant unhappiness
  causes.push(...pressureCauseRefsAsEntries(ctx, 'reputation_drift', 2))
  if (causes.length < 1) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'discount',
      labelHint: 'Offer merchants a discount',
      allowedVerbs: ['discount'],
      shape: 'safe_costly',
      targetOptions: [customerRef('merchants')],
      expectedEffects: ['raise merchant satisfaction', 'lose coin'],
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
      targetOptions: [customerRef('merchants')],
      expectedEffects: ['save coin', 'lose merchant trust'],
    },
    {
      id: 'rebrand',
      labelHint: 'Rebrand the issue',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [systemRef('reputation')],
      expectedEffects: ['shift reputation', 'risk audience'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'discount_profile',
      responseSlotId: 'discount',
      immediateEffects: [
        effect('state_change', 'customers.merchants.satisfaction', 10, 'Discount appeases', [
          'customer',
        ]),
        effect('state_change', 'coin', -10, 'Discount cost', ['coin']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: 'merchant_discount_recently',
          actors: [customerRef('merchants')],
          tags: ['customer', 'merchants'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'fix_root_profile',
      responseSlotId: 'fix_root',
      immediateEffects: [
        effect('state_change', 'areas.main_room.cleanliness', 18, 'Cleaner main room', ['area']),
        effect('state_change', 'coin', -10, 'Cleaning cost', ['coin']),
        effect('pressure', 'pressure:reputation_drift', -5, 'Stabilize reputation', [
          'pressure',
        ]),
      ],
      delayedEffects: [],
      memories: [
        { id: 'main_room_cleaned_recently', tags: ['cleanliness', 'main_room'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'mock_profile',
      responseSlotId: 'mock',
      immediateEffects: [
        effect('state_change', 'customers.merchants.satisfaction', -15, 'Merchants offended', [
          'customer',
        ]),
        effect('state_change', 'customers.merchants.loyalty', -10, 'Trust broken', ['customer']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'merchant_boycott_possible',
          0,
          'Merchants may boycott',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: 'merchants_mocked',
          actors: [customerRef('merchants')],
          tags: ['grudge', 'merchants'],
        },
      ],
      futureHooks: [
        { id: 'merchant_boycott_possible', tags: ['merchants', 'risk'] },
      ],
    }),
    makeProfile({
      id: 'rebrand_profile',
      responseSlotId: 'rebrand',
      immediateEffects: [
        effect('state_change', 'reputation.respectable', -3, 'Respectability slips', [
          'reputation',
        ]),
        effect('state_change', 'reputation.goblinAuthentic', 3, 'Authenticity grows', [
          'reputation',
        ]),
      ],
      delayedEffects: [],
      memories: [
        { id: 'rebrand_attempted_recently', tags: ['reputation', 'rebrand'] },
      ],
      futureHooks: [],
    }),
  ]

  return [
    buildSeed({
      id: seedId('customer_complaint', 'merchants', ctx),
      family: 'customer_complaint',
      type: 'complaint',
      timing: 'during_service',
      domain: ['customers', 'reputation', 'service'],
      severity: Math.max(35, 80 - merchants.satisfaction),
      urgency: Math.max(30, 60 - merchants.satisfaction + 20),
      primaryActor: customerRef('merchants'),
      affectedActors: [customerRef('merchants')],
      causes,
      stakes: [
        stake(
          'merchant_loss',
          'customer:merchants',
          'Merchants may stop visiting',
          'loss',
          ['merchants', 'customer'],
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
          id: 'merchant_complaint_seen',
          actors: [customerRef('merchants')],
          tags: ['customer', 'complaint'],
        },
      ],
      futureHooks: [],
      toneHints: ['customer', 'reputation'],
      textIngredients: buildTextIngredients({
        subject: 'the merchants',
        problemNoun: 'cold welcome',
        sensoryDetails: ['pursed lips', 'half-finished mugs'],
        actorOpinions: {
          merchants: 'eye the filthy floor',
        },
        recentContext: ['main room dirty all week'],
        stakesReadable: ['merchants may stop visiting', 'respectability may drop'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Violence
// ----------------------------------------------------------------------

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

  const ogres = ctx.state.customerGroups.ogres
  const adventurers = ctx.state.customerGroups.adventurers
  const target = (ogres?.patronage ?? 0) > (adventurers?.patronage ?? 0)
    ? customerRef('ogres')
    : customerRef('adventurers')

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'hire_security_profile',
      responseSlotId: 'hire_security',
      immediateEffects: [
        effect('state_change', 'coin', -20, 'Hire security cost', ['coin']),
        effect('pressure', 'pressure:violence', -15, 'Lower violence pressure', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'security_hired_recently', tags: ['security', 'violence'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ban_group_profile',
      responseSlotId: 'ban_group',
      immediateEffects: [
        effect('state_change', `customers.${target.id}.patronage`, -25, 'Group banned', [
          'customer',
        ]),
        effect('pressure', 'pressure:violence', -12, 'Lower violence pressure', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `${target.id}_banned`,
          actors: [target],
          tags: ['ban', 'customer', target.id],
        },
      ],
      futureHooks: [],
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
      delayedEffects: [],
      memories: [
        { id: 'rowdy_identity_embraced', tags: ['reputation', 'identity'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'repair_damage_profile',
      responseSlotId: 'repair_damage',
      immediateEffects: [
        effect('state_change', 'areas.main_room.damage', -20, 'Repair damage', ['area']),
        effect('state_change', 'coin', -12, 'Repair cost', ['coin']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'main_room_repaired_recently', tags: ['maintenance', 'main_room'] },
      ],
      futureHooks: [],
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
      location: areaRef('main_room'),
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
      severity: Math.max(40, debt, landlord),
      urgency: Math.max(45, landlord + 10),
      primaryActor: systemRef('landlord'),
      affectedActors: [systemRef('landlord')],
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
        recentContext: missedPayments > 0
          ? ['rent missed previously']
          : ['coin tight for weeks'],
        stakesReadable: ['rent may be missed', 'landlord may evict'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Inspection
// ----------------------------------------------------------------------

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
      targetOptions: [systemRef('inspector')],
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
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'clean_profile',
      responseSlotId: 'clean',
      immediateEffects: [
        effect('state_change', 'areas.kitchen.cleanliness', 20, 'Kitchen cleaner', ['area']),
        effect('pressure', 'pressure:inspection', -12, 'Lower inspection pressure', [
          'pressure',
        ]),
      ],
      delayedEffects: [],
      memories: [{ id: 'inspection_prep_recently', tags: ['inspection', 'cleanliness'] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'bribe_profile',
      responseSlotId: 'bribe',
      immediateEffects: [
        effect('state_change', 'coin', -30, 'Pay bribe', ['coin']),
        effect('pressure', 'pressure:inspection', -10, 'Stall inspection', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'corrupt_inspector_relationship',
          0,
          'Inspector may demand more',
          ['future_hook'],
        ),
      ],
      memories: [{ id: 'bribed_inspector', tags: ['bribe', 'corruption'] }],
      futureHooks: [{ id: 'corrupt_inspector_relationship', tags: ['inspection', 'risk'] }],
    }),
    makeProfile({
      id: 'hide_profile',
      responseSlotId: 'hide',
      immediateEffects: [
        effect('pressure', 'pressure:inspection', -6, 'Briefly lower risk', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          'inspection_discovery_possible',
          0,
          'Inspectors may dig deeper',
          ['future_hook'],
        ),
      ],
      memories: [{ id: 'hid_evidence', tags: ['inspection', 'deception'] }],
      futureHooks: [{ id: 'inspection_discovery_possible', tags: ['inspection', 'risk'] }],
    }),
    makeProfile({
      id: 'improve_food_safety_profile',
      responseSlotId: 'improve_food_safety',
      immediateEffects: [
        effect('state_change', 'stock.mushrooms.quantity', -15, 'Discard mushrooms', ['stock']),
        effect('pressure', 'pressure:inspection', -8, 'Lower inspection pressure', [
          'pressure',
        ]),
        effect('pressure', 'pressure:food_safety', -10, 'Lower food safety', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        { id: 'food_safety_improved_recently', tags: ['food_safety', 'inspection'] },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_profile',
      responseSlotId: 'ignore',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:inspection', 8, 'Inspection looms', ['pressure']),
      ],
      memories: [{ id: 'inspection_ignored_recently', tags: ['inspection', 'ignored'] }],
      futureHooks: [],
    }),
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
      primaryActor: systemRef('inspector'),
      affectedActors: [systemRef('inspector')],
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
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Reputation shift
// ----------------------------------------------------------------------

function generateReputationShift(ctx: SimContext): IssueSeed[] {
  const guard = CONTRADICTION_GUARDS.reputation_shift(ctx)
  if (!guard.allowed) return []
  const snap = pressureSnapshot(ctx, 'reputation_drift')
  if (!snap || snap.value < 35) return []

  // identify the axis with the highest absolute value
  const axes = Object.entries(ctx.state.reputation)
  const strongest = axes
    .slice()
    .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))[0]
  if (!strongest) return []
  const [axisId, axisValue] = strongest

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'embrace_profile',
      responseSlotId: 'embrace',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, 5, 'Lean into reputation', ['reputation']),
      ],
      delayedEffects: [],
      memories: [{ id: `embraced_${axisId}_identity`, tags: ['reputation', axisId] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'correct_profile',
      responseSlotId: 'correct',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, -5, 'Shift reputation', ['reputation']),
        effect('state_change', 'coin', -10, 'Effort cost', ['coin']),
      ],
      delayedEffects: [],
      memories: [{ id: `corrected_${axisId}_identity`, tags: ['reputation', axisId] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'advertise_profile',
      responseSlotId: 'advertise',
      immediateEffects: [
        effect('state_change', 'customers.miners.patronage', 8, 'Bring in matching group', [
          'customer',
        ]),
      ],
      delayedEffects: [],
      memories: [{ id: 'advertised_to_group_recently', tags: ['customer', 'reputation'] }],
      futureHooks: [],
    }),
    makeProfile({
      id: 'diversify_profile',
      responseSlotId: 'diversify',
      immediateEffects: [
        effect('state_change', `reputation.${axisId}`, -3, 'Soften identity', ['reputation']),
      ],
      delayedEffects: [],
      memories: [{ id: 'diversification_attempted', tags: ['reputation', 'identity'] }],
      futureHooks: [],
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
      primaryActor: systemRef('reputation'),
      affectedActors: [systemRef('reputation')],
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
        }
      }
    | undefined
  const result = monthly?.lastMonthlyResult
  if (!result) return []

  // monthly_review has no choice responses — it is a structured report seed.
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

  return [
    buildSeed({
      id: seedId('monthly_review', result.monthKey, ctx),
      family: 'monthly_review',
      type: 'monthly_review',
      timing: 'end_month',
      domain: ['monthly', 'economy', 'reputation'],
      severity: 40,
      urgency: 30,
      affectedActors: [],
      causes,
      stakes: [],
      responseSlots: [],
      consequenceProfiles: [],
      memoriesCreated: [],
      futureHooks: [],
      toneHints: ['summary', 'monthly'],
      textIngredients: buildTextIngredients({
        subject: `month ${result.monthKey}`,
        problemNoun: 'month review',
        sensoryDetails: ['ledger closed', 'lamps trimmed'],
        actorOpinions: {},
        recentContext: [`net coin change ${result.economy.net}`],
        stakesReadable: [],
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

let initialized = false
export function ensureRequiredSeedGeneratorsRegistered(
  registry: { register(g: IssueSeedGenerator): void; has(id: string): boolean },
): void {
  if (initialized) return
  for (const gen of REQUIRED_SEED_GENERATORS) {
    if (!registry.has(gen.id)) registry.register(gen)
  }
  initialized = true
}
