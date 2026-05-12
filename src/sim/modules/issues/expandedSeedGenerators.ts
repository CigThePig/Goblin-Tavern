import type { SimContext } from '../../core/context'
import type {
  CauseEntry,
  EntityRef,
  TavernState,
} from '../../state/TavernState'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
  TextIngredients,
} from './issueSeedTypes'
import {
  EXPANDED_CONTRADICTION_GUARDS,
  activeArcExistsGuard,
  factionExistsGuard,
  policyStillActiveGuard,
  projectStillIncompleteGuard,
  regularExistsGuard,
  rumourStillActiveGuard,
  staffStillEmployedGuard,
  supplierExistsGuard,
} from './contradictionGuards'
import {
  areaRef,
  buildSeed,
  buildTextIngredients,
  cultureRef,
  customerRef,
  displayNameForRef,
  effect,
  entityMemoryList,
  factionRef,
  localArcRef,
  makeProfile,
  namedEntityIngredient,
  pressureCauseRefsAsEntries,
  pressureSnapshot,
  recentCauseEntries,
  regularRef,
  rumourRef,
  seedId,
  severityFromPressures,
  stake,
  staffRef,
  stockRef,
  strongestAttributionText,
  strongestMemoryText,
  supplierRef,
  systemRef,
  tavernIdentityRef,
  urgencyFromPressures,
} from './generatorHelpers'
import type { IssueSeedGenerator } from './issueSeedRegistry'
import { listActiveArcs } from '../localArcs/arcEngine'
import {
  attributionsByTarget,
  strongestPublicAttributions,
} from '../attribution/attributionQueries'

// Phase 39 §39.5–§39.14 — Expanded issue seed generators.
//
// Each generator pulls "why this seed exists now" from real world state
// (suppliers, regulars, factions, cultures, local arcs, policies,
// rumours, area atmosphere) together with the Phase 18/38 pressure
// snapshots, Phase 36 entity-scoped memories, and Phase 37 attributions.
// Generators NEVER write card prose — they only assemble structured
// ingredients (named entities, social context, memory fragments) so the
// future card layer can compose text deterministically.

const PRESSURE_THRESHOLD = 35

function pressureSnapshotsList(ctx: SimContext): IssueSeed['pressures'] {
  const slice = ctx.state.modules.pressures as
    | { snapshots?: Record<string, IssueSeed['pressures'][number]> }
    | undefined
  return slice?.snapshots ? Object.values(slice.snapshots) : []
}

function pressureSnapshotById(
  ctx: SimContext,
  id: string,
): IssueSeed['pressures'][number] | undefined {
  const slice = ctx.state.modules.pressures as
    | { snapshots?: Record<string, IssueSeed['pressures'][number]> }
    | undefined
  return slice?.snapshots?.[id]
}

function pressureSnapshotsFor(
  ctx: SimContext,
  ids: string[],
): IssueSeed['pressures'] {
  const out: IssueSeed['pressures'] = []
  for (const id of ids) {
    const snap = pressureSnapshotById(ctx, id)
    if (snap) out.push(snap)
  }
  return out
}

function pickStrongest<T extends { strength: number }>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  let best = items[0]!
  for (const item of items) {
    if (item.strength > best.strength) best = item
  }
  return best
}

function calendarContextLines(state: TavernState): string[] {
  const tags = state.calendar.tags ?? []
  const lines: string[] = []
  if (tags.length > 0) {
    lines.push(`tags: ${tags.slice(0, 3).join(', ')}`)
  }
  return lines
}

// ----------------------------------------------------------------------
// 39.5 — staff_identity
// ----------------------------------------------------------------------

function generateStaffIdentity(ctx: SimContext): IssueSeed[] {
  const loyaltyRisk = pressureSnapshotById(ctx, 'staff_loyalty_risk')
  const burnout = pressureSnapshotById(ctx, 'staff_burnout')
  if (!loyaltyRisk && !burnout) return []
  const totalSignal = (loyaltyRisk?.value ?? 0) + (burnout?.value ?? 0)
  if (totalSignal < PRESSURE_THRESHOLD) return []

  const allStaff = Object.values(ctx.state.staff)
  if (allStaff.length === 0) return []

  // Pick the staff with strongest blame attribution + lowest loyalty.
  let chosen = allStaff[0]!
  let chosenScore = -Infinity
  for (const s of allStaff) {
    const ref = staffRef(s.id)
    const attributions = attributionsByTarget(ctx.state, ref)
    const blameWeight = attributions
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'resentment')
      .reduce((acc, a) => acc + a.strength * (a.publicness / 100), 0)
    const loyaltyDeficit = 100 - s.loyalty
    const score = blameWeight + loyaltyDeficit + s.stress + s.fatigue
    if (score > chosenScore) {
      chosenScore = score
      chosen = s
    }
  }
  const ref = staffRef(chosen.id)
  const guard = staffStillEmployedGuard(ctx, ref)
  if (!guard.allowed) return []

  const memories = entityMemoryList(ctx.state, ref, ['staff'])
  const blameAttribution = strongestAttributionText(ctx.state, ref, ['blame', 'resentment'])
  const creditAttribution = strongestAttributionText(ctx.state, ref, ['credit', 'gratitude'])
  if (memories.length === 0 && !blameAttribution && !creditAttribution) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'staff_loyalty_risk', 2)
  causes.push(...pressureCauseRefsAsEntries(ctx, 'staff_burnout', 2))
  for (const c of recentCauseEntries(ctx, ['staff', chosen.id, 'blame'], 7, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'comfort_staff',
      labelHint: `Comfort ${chosen.name.display}`,
      allowedVerbs: ['appease'],
      shape: 'relationship_sacrifice',
      targetOptions: [ref],
      expectedEffects: ['raise loyalty', 'time cost'],
    },
    {
      id: 'publicly_back_staff',
      labelHint: `Publicly back ${chosen.name.display}`,
      allowedVerbs: ['rebrand', 'appease'],
      shape: 'reputation_play',
      targetOptions: [ref],
      expectedEffects: ['shift blame off staff', 'risk owner reputation'],
    },
    {
      id: 'pay_bonus',
      labelHint: 'Pay a bonus',
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['raise morale', 'spend coin'],
    },
    {
      id: 'blame_staff',
      labelHint: `Blame ${chosen.name.display}`,
      allowedVerbs: ['blame'],
      shape: 'relationship_sacrifice',
      targetOptions: [ref],
      expectedEffects: ['shed owner blame', 'destroy loyalty'],
    },
    {
      id: 'change_priority',
      labelHint: 'Change priority',
      allowedVerbs: ['delegate'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['lower stress', 'reduce service capacity'],
    },
    {
      id: 'ignore_request',
      labelHint: 'Ignore the moment',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'risk staff quitting'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'comfort_staff_profile',
      responseSlotId: 'comfort_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 10, 'Loyalty rises', ['staff']),
        effect('state_change', `staff.${chosen.id}.stress`, -8, 'Stress drops', ['staff']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_comforted_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'loyalty', 'comfort'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'publicly_back_staff_profile',
      responseSlotId: 'publicly_back_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 12, 'Public backing earns loyalty', [
          'staff',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_publicly_backed_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'reputation'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'pay_bonus_profile',
      responseSlotId: 'pay_bonus',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.morale`, 12, 'Morale up', ['staff']),
        effect('state_change', 'coin', -10, 'Bonus paid', ['coin']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_bonus_paid_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'bonus'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'blame_staff_profile',
      responseSlotId: 'blame_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, -20, 'Loyalty collapses', ['staff']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `staff_quit_risk_${chosen.id}`,
          0,
          'Staff may quit',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_scapegoated_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'grudge', 'scapegoat'],
        },
      ],
      futureHooks: [
        {
          id: `staff_quit_risk_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'change_priority_profile',
      responseSlotId: 'change_priority',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.stress`, -10, 'Stress drops', ['staff']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_priority_changed_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'priority'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_request_profile',
      responseSlotId: 'ignore_request',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:staff_loyalty_risk', 6, 'Loyalty risk rises', ['pressure']),
      ],
      memories: [
        {
          id: `staff_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'ignored'],
        },
      ],
      futureHooks: [],
    }),
  ]

  const memoryText = strongestMemoryText(ctx.state, ref, ['staff'])
  const relevantMemories: string[] = []
  if (memoryText) relevantMemories.push(memoryText)
  for (const m of memories.slice(0, 2)) {
    if (m.label && !relevantMemories.includes(m.label)) relevantMemories.push(m.label)
  }
  const perceivedBlame: string[] = []
  if (blameAttribution) perceivedBlame.push(blameAttribution)
  const pressureContext: string[] = []
  if (loyaltyRisk) pressureContext.push(`loyalty risk ${loyaltyRisk.value}`)
  if (burnout) pressureContext.push(`burnout ${burnout.value}`)

  const ingredients: TextIngredients = buildTextIngredients({
    subject: chosen.name.display,
    problemNoun: blameAttribution ? 'public blame' : 'loyalty test',
    sensoryDetails: ['tight jaw', 'long silence'],
    actorOpinions: { [chosen.id]: 'feels watched' },
    recentContext: ['tense week of service'],
    stakesReadable: [`${chosen.name.display} may quit`, 'service may collapse'],
    namedEntities: [namedEntityIngredient(ctx.state, 'staff', ref)],
    socialContext: blameAttribution ? ['publicly blamed'] : ['quietly slighted'],
    relevantMemories,
    perceivedBlame,
    pressureContext,
  })

  return [
    buildSeed({
      id: seedId('staff_identity', chosen.id, ctx),
      family: 'staff_identity',
      type: 'relationship_test',
      timing: 'morning_prep',
      domain: ['staff', 'identity', 'social'],
      severity: Math.max(
        40,
        severityFromPressures(ctx, ['staff_loyalty_risk', 'staff_burnout']),
      ),
      urgency: Math.max(
        30,
        urgencyFromPressures(ctx, ['staff_loyalty_risk', 'staff_burnout']),
      ),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['staff_loyalty_risk', 'staff_burnout']),
      stakes: [
        stake('quit_stake', `staff:${chosen.id}`, `${chosen.name.display} may quit`, 'loss', ['staff']),
        stake('loyalty_stake', `staff:${chosen.id}`, 'Loyalty may break', 'risk', ['staff']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `staff_identity_warning_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'identity', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['staff', 'identity'],
      textIngredients: ingredients,
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.6 — regular_customer
// ----------------------------------------------------------------------

function generateRegularCustomer(ctx: SimContext): IssueSeed[] {
  const loss = pressureSnapshotById(ctx, 'regular_customer_loss')
  if (!loss || loss.value < 25) return []
  const regulars = Object.values(ctx.state.world.regulars)
  if (regulars.length === 0) return []

  // Pick the regular with highest irritation / lowest loyalty.
  let chosen = regulars[0]!
  let chosenScore = -Infinity
  for (const r of regulars) {
    const score = r.irritation + (100 - r.loyalty)
    if (score > chosenScore) {
      chosenScore = score
      chosen = r
    }
  }
  const ref = regularRef(chosen.id)
  const guard = regularExistsGuard(ctx, ref)
  if (!guard.allowed) return []

  const memories = entityMemoryList(ctx.state, ref)
  if (memories.length === 0 && chosen.irritation < 50 && chosen.loyalty > 40) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'regular_customer_loss', 2)
  for (const c of recentCauseEntries(ctx, ['regular', chosen.id, chosen.customerGroupId], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const groupRef = customerRef(chosen.customerGroupId)
  const responseSlots: ResponseSlot[] = [
    {
      id: 'apologize_to_regular',
      labelHint: `Apologise to ${chosen.name.display}`,
      allowedVerbs: ['appease'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['raise loyalty', 'time cost'],
    },
    {
      id: 'comp_regular_meal',
      labelHint: 'Comp a meal',
      allowedVerbs: ['discount', 'pay'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['raise loyalty', 'lose coin'],
    },
    {
      id: 'refuse_request',
      labelHint: 'Refuse the request',
      allowedVerbs: ['blame', 'ignore'],
      shape: 'relationship_sacrifice',
      targetOptions: [ref],
      expectedEffects: ['hold the line', 'lose regular'],
    },
    {
      id: 'ask_regular_to_spread_word',
      labelHint: 'Ask them to spread the word',
      allowedVerbs: ['invite', 'negotiate'],
      shape: 'long_term_investment',
      targetOptions: [ref, groupRef],
      expectedEffects: ['raise reputation', 'risk credibility'],
    },
    {
      id: 'ban_regular',
      labelHint: `Ban ${chosen.name.display}`,
      allowedVerbs: ['ban'],
      shape: 'escalation',
      targetOptions: [ref],
      expectedEffects: ['lose regular', 'send signal'],
    },
    {
      id: 'ignore_regular',
      labelHint: 'Ignore the regular',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'raise regular loss pressure'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'apologize_profile',
      responseSlotId: 'apologize_to_regular',
      immediateEffects: [
        effect('cause', `regular:${chosen.id}`, 8, 'Loyalty rises', ['regular']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `regular_apology_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'apology', 'gratitude'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'comp_regular_profile',
      responseSlotId: 'comp_regular_meal',
      immediateEffects: [
        effect('state_change', 'coin', -8, 'Comp cost', ['coin']),
        effect('cause', `regular:${chosen.id}`, 10, 'Loyalty rises sharply', ['regular']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `regular_comped_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'comp'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'refuse_profile',
      responseSlotId: 'refuse_request',
      immediateEffects: [
        effect('cause', `regular:${chosen.id}`, -12, 'Regular grudges', ['regular']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `regular_grudge_${chosen.id}`,
          0,
          'Regular may turn rival',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `regular_refused_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'grudge'],
        },
      ],
      futureHooks: [
        {
          id: `regular_grudge_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'ask_regular_word_profile',
      responseSlotId: 'ask_regular_to_spread_word',
      immediateEffects: [
        effect('state_change', `customers.${chosen.customerGroupId}.loyalty`, 5, 'Word spreads', [
          'customer',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `regular_word_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'reputation'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ban_regular_profile',
      responseSlotId: 'ban_regular',
      immediateEffects: [
        effect('cause', `regular:${chosen.id}`, -25, 'Regular banned', ['regular']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `regular_banned_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'ban'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_regular_profile',
      responseSlotId: 'ignore_regular',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:regular_customer_loss', 6, 'Loss pressure rises', [
          'pressure',
        ]),
      ],
      memories: [
        {
          id: `regular_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'ignored'],
        },
      ],
      futureHooks: [],
    }),
  ]

  const grudgeMemory = strongestMemoryText(ctx.state, ref, ['grudge', 'ignored_complaint', 'memory'])
  const relevantMemories: string[] = []
  if (grudgeMemory) relevantMemories.push(grudgeMemory)
  for (const m of memories.slice(0, 2)) {
    if (m.label && !relevantMemories.includes(m.label)) relevantMemories.push(m.label)
  }

  const socialContext: string[] = []
  socialContext.push(`group: ${chosen.customerGroupId}`)
  if (chosen.factionId) socialContext.push(`faction tied: ${chosen.factionId}`)

  return [
    buildSeed({
      id: seedId('regular_customer', chosen.id, ctx),
      family: 'regular_customer',
      type: chosen.irritation > 60 ? 'complaint' : 'relationship_test',
      timing: 'during_service',
      domain: ['regulars', 'customers', 'social'],
      severity: Math.max(35, chosen.irritation),
      urgency: Math.max(30, loss.urgency),
      primaryActor: ref,
      affectedActors: [ref, groupRef],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['regular_customer_loss']),
      stakes: [
        stake(
          'regular_loss',
          `regular:${chosen.id}`,
          `${chosen.name.display} may walk out`,
          'loss',
          ['regular'],
        ),
        stake(
          'group_loyalty',
          `customer:${chosen.customerGroupId}`,
          'Group loyalty may drop',
          'risk',
          ['customer'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `regular_seed_${chosen.id}`,
          actors: [ref],
          tags: ['regular', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['regular', 'relationship'],
      textIngredients: buildTextIngredients({
        subject: chosen.name.display,
        problemNoun: 'sour mood',
        sensoryDetails: ['half-empty mug', 'cold stare'],
        actorOpinions: { [chosen.id]: 'looks ready to leave' },
        recentContext: [`irritation ${chosen.irritation}`],
        stakesReadable: ['regular may walk out', 'group loyalty may drop'],
        namedEntities: [
          namedEntityIngredient(ctx.state, 'regular', ref),
          namedEntityIngredient(ctx.state, 'group', groupRef),
        ],
        socialContext,
        relevantMemories,
        ...(chosen.irritation > 70 ? { perceivedBlame: ['blames the house'] } : {}),
        pressureContext: [`regular loss ${loss.value}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.7 — supplier_relationship
// ----------------------------------------------------------------------

function generateSupplierRelationship(ctx: SimContext): IssueSeed[] {
  const distrust = pressureSnapshotById(ctx, 'supplier_distrust')
  const market = pressureSnapshotById(ctx, 'market_instability')
  const totalSignal = (distrust?.value ?? 0) + (market?.value ?? 0)
  if (totalSignal < PRESSURE_THRESHOLD) return []

  const suppliers = Object.values(ctx.state.world.suppliers)
  if (suppliers.length === 0) return []

  // Pick the supplier with highest blame/distrust signal.
  let chosen = suppliers[0]!
  let chosenScore = -Infinity
  for (const s of suppliers) {
    const ref = supplierRef(s.id)
    const blameWeight = attributionsByTarget(ctx.state, ref)
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'distrust')
      .reduce((acc, a) => acc + a.strength, 0)
    const memWeight = entityMemoryList(ctx.state, ref).length * 10
    const reliabilityDeficit = 100 - s.reliability
    const score = blameWeight + memWeight + reliabilityDeficit
    if (score > chosenScore) {
      chosenScore = score
      chosen = s
    }
  }
  const ref = supplierRef(chosen.id)
  const guard = supplierExistsGuard(ctx, ref)
  if (!guard.allowed) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'supplier_distrust', 2)
  causes.push(...pressureCauseRefsAsEntries(ctx, 'market_instability', 2))
  for (const c of recentCauseEntries(ctx, ['supplier', chosen.id, 'delivery'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const goodsRef = chosen.goodsProvided[0]
    ? stockRef(chosen.goodsProvided[0])
    : systemRef('market')

  const responseSlots: ResponseSlot[] = [
    {
      id: 'pay_supplier',
      labelHint: `Pay ${displayNameForRef(ctx.state, ref)}`,
      allowedVerbs: ['pay'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['clear debt', 'spend coin'],
    },
    {
      id: 'negotiate_supplier',
      labelHint: 'Negotiate',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['shift price', 'risk relationship'],
    },
    {
      id: 'blame_supplier',
      labelHint: 'Blame supplier',
      allowedVerbs: ['blame'],
      shape: 'relationship_sacrifice',
      targetOptions: [ref],
      expectedEffects: ['shed blame', 'destroy relationship'],
    },
    {
      id: 'switch_supplier',
      labelHint: 'Switch supplier',
      allowedVerbs: ['fire'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['change goods quality', 'lose relationship'],
    },
    {
      id: 'accept_suspicious_goods',
      labelHint: 'Accept suspicious goods',
      allowedVerbs: ['buy'],
      shape: 'risky_profitable',
      targetOptions: [goodsRef],
      expectedEffects: ['cheap stock', 'risk food safety'],
    },
    {
      id: 'refuse_supplier_offer',
      labelHint: 'Refuse the offer',
      allowedVerbs: ['ignore'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['no risk', 'less stock'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'pay_supplier_profile',
      responseSlotId: 'pay_supplier',
      immediateEffects: [
        effect('state_change', 'coin', -15, 'Pay supplier', ['coin']),
        effect('pressure', 'pressure:supplier_distrust', -10, 'Lower distrust', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `supplier_paid_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'payment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'negotiate_supplier_profile',
      responseSlotId: 'negotiate_supplier',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, 4, 'Negotiation succeeds', ['supplier']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `supplier_negotiated_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'negotiation'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'blame_supplier_profile',
      responseSlotId: 'blame_supplier',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, -15, 'Relationship damaged', ['supplier']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `supplier_retaliation_${chosen.id}`,
          0,
          'Supplier may retaliate',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_blamed_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'grudge'],
        },
      ],
      futureHooks: [
        {
          id: `supplier_retaliation_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'switch_supplier_profile',
      responseSlotId: 'switch_supplier',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, -20, 'Relationship ends', ['supplier']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `supplier_switched_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'switched'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'accept_suspicious_profile',
      responseSlotId: 'accept_suspicious_goods',
      immediateEffects: [
        effect('pressure', 'pressure:food_safety', 8, 'Food safety risk rises', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `supplier_suspicious_goods_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'deception'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'refuse_supplier_profile',
      responseSlotId: 'refuse_supplier_offer',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:stock_shortage', 4, 'Stock pressure rises', ['pressure']),
      ],
      memories: [
        {
          id: `supplier_refused_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'refused'],
        },
      ],
      futureHooks: [],
    }),
  ]

  const blameText = strongestAttributionText(ctx.state, ref, ['blame', 'distrust'])
  const memoryText = strongestMemoryText(ctx.state, ref, ['supplier'])
  const relevantMemories: string[] = []
  if (memoryText) relevantMemories.push(memoryText)
  const perceivedBlame: string[] = []
  if (blameText) perceivedBlame.push(blameText)
  const marketContext: string[] = []
  if (market && market.value > 20) marketContext.push(`market unstable ${market.value}`)

  return [
    buildSeed({
      id: seedId('supplier_relationship', chosen.id, ctx),
      family: 'supplier_relationship',
      type: 'supplier_offer',
      timing: 'morning_prep',
      domain: ['suppliers', 'market', 'stock'],
      severity: Math.max(35, distrust?.severity ?? 30),
      urgency: Math.max(30, distrust?.urgency ?? 25),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['supplier_distrust', 'market_instability']),
      stakes: [
        stake('supplier_stake', `supplier:${chosen.id}`, 'Supplier may walk', 'risk', ['supplier']),
        stake(
          'stock_stake',
          'stock:flow',
          'Stock flow may break',
          'loss',
          ['stock'],
        ),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `supplier_seed_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['supplier', 'market'],
      textIngredients: buildTextIngredients({
        subject: displayNameForRef(ctx.state, ref),
        problemNoun: 'supply dispute',
        sensoryDetails: ['stacked crates', 'tight handshake'],
        actorOpinions: { supplier: 'demands an answer' },
        recentContext: [`reliability ${chosen.reliability}`],
        stakesReadable: ['supplier may walk', 'stock may run dry'],
        namedEntities: [namedEntityIngredient(ctx.state, 'supplier', ref)],
        socialContext: ['market tension'],
        relevantMemories,
        perceivedBlame,
        pressureContext: [`distrust ${distrust?.value ?? 0}`],
        marketContext,
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.8 — faction_request
// ----------------------------------------------------------------------

function generateFactionRequest(ctx: SimContext): IssueSeed[] {
  const anger = pressureSnapshotById(ctx, 'faction_anger')
  if (!anger || anger.value < 25) return []
  const factions = Object.values(ctx.state.world.factions)
  if (factions.length === 0) return []

  let chosen = factions[0]!
  let chosenScore = -Infinity
  for (const f of factions) {
    const score = Math.abs(50 - f.relationship) + f.influence * 0.5
    if (score > chosenScore) {
      chosenScore = score
      chosen = f
    }
  }
  const ref = factionRef(chosen.id)
  const guard = factionExistsGuard(ctx, ref)
  if (!guard.allowed) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'faction_anger', 3)
  for (const c of recentCauseEntries(ctx, ['faction', chosen.id, 'culture'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'appease_faction',
      labelHint: `Appease ${chosen.label}`,
      allowedVerbs: ['appease', 'pay'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['raise relationship', 'spend coin'],
    },
    {
      id: 'negotiate_terms',
      labelHint: 'Negotiate terms',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['raise relationship', 'concede something'],
    },
    {
      id: 'refuse_faction',
      labelHint: 'Refuse outright',
      allowedVerbs: ['blame', 'ignore'],
      shape: 'escalation',
      targetOptions: [ref],
      expectedEffects: ['hold ground', 'raise faction anger'],
    },
    {
      id: 'host_faction_night',
      labelHint: `Host ${chosen.label} night`,
      allowedVerbs: ['invite'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['raise relationship', 'narrow audience'],
    },
    {
      id: 'call_watch',
      labelHint: 'Call the watch',
      allowedVerbs: ['threaten'],
      shape: 'escalation',
      targetOptions: [ref],
      expectedEffects: ['lower tension', 'destroy relationship'],
    },
    {
      id: 'play_rival_faction',
      labelHint: 'Play rival factions',
      allowedVerbs: ['negotiate'],
      shape: 'deception',
      targetOptions: [ref],
      expectedEffects: ['shift tension', 'risk discovery'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect('cause', `faction:${chosen.id}`, slot.id === 'refuse_faction' ? -10 : 8, slot.labelHint, [
          'faction',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `faction_${slot.id}_${chosen.id}`,
          actors: [ref],
          tags: ['faction', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const memoryText = strongestMemoryText(ctx.state, ref)
  const relevantMemories: string[] = memoryText ? [memoryText] : []
  const blameText = strongestAttributionText(ctx.state, ref, ['blame', 'resentment'])
  const perceivedBlame: string[] = blameText ? [blameText] : []

  return [
    buildSeed({
      id: seedId('faction_request', chosen.id, ctx),
      family: 'faction_request',
      type: 'social_conflict',
      timing: 'during_service',
      domain: ['factions', 'social'],
      severity: Math.max(35, anger.severity),
      urgency: Math.max(30, anger.urgency),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['faction_anger', 'cultural_tension']),
      stakes: [
        stake('faction_stake', `faction:${chosen.id}`, 'Relationship may break', 'risk', ['faction']),
        stake('reputation_stake', 'reputation:respectable', 'Audience may narrow', 'risk', ['reputation']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `faction_seed_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['faction', 'social'],
      textIngredients: buildTextIngredients({
        subject: chosen.label,
        problemNoun: 'faction demand',
        sensoryDetails: ['drawn-out silence', 'folded arms'],
        actorOpinions: { faction: 'wants something specific' },
        recentContext: [`relationship ${chosen.relationship}`],
        stakesReadable: ['relationship may break', 'audience may narrow'],
        namedEntities: [namedEntityIngredient(ctx.state, 'faction', ref)],
        socialContext: chosen.cultureId ? [`culture: ${chosen.cultureId}`] : ['no culture link'],
        relevantMemories,
        perceivedBlame,
        pressureContext: [`faction anger ${anger.value}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.9 — culture_conflict
// ----------------------------------------------------------------------

function generateCultureConflict(ctx: SimContext): IssueSeed[] {
  const tension = pressureSnapshotById(ctx, 'cultural_tension')
  if (!tension || tension.value < 25) return []
  const cultures = Object.values(ctx.state.world.cultures)
  if (cultures.length === 0) return []

  let chosen = cultures[0]!
  let chosenScore = -Infinity
  for (const c of cultures) {
    if (c.tension > chosenScore) {
      chosenScore = c.tension
      chosen = c
    }
  }
  const ref = cultureRef(chosen.id)

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'cultural_tension', 3)
  for (const c of recentCauseEntries(ctx, ['culture', chosen.id, 'cultural'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const calendarTags = (ctx.state.calendar.tags ?? []) as ReadonlyArray<string>
  const calendarContext: string[] = []
  for (const tag of chosen.importantCalendarTags) {
    if (calendarTags.includes(tag)) calendarContext.push(`tag: ${tag}`)
  }

  const responseSlots: ResponseSlot[] = [
    {
      id: 'mediate_groups',
      labelHint: 'Mediate between groups',
      allowedVerbs: ['appease', 'negotiate'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['lower tension', 'time cost'],
    },
    {
      id: 'honour_custom',
      labelHint: `Honour ${chosen.label} custom`,
      allowedVerbs: ['invite', 'serve'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['raise familiarity', 'narrow audience'],
    },
    {
      id: 'ignore_custom',
      labelHint: 'Ignore the custom',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'raise tension'],
    },
    {
      id: 'change_seating_policy',
      labelHint: 'Change seating policy',
      allowedVerbs: ['rebrand'],
      shape: 'compromise',
      targetOptions: [areaRef('main_room')],
      expectedEffects: ['lower tension', 'displease other groups'],
    },
    {
      id: 'offer_discount',
      labelHint: 'Offer a discount',
      allowedVerbs: ['discount'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['raise comfort', 'lose coin'],
    },
    {
      id: 'ask_staff_to_intervene',
      labelHint: 'Ask staff to intervene',
      allowedVerbs: ['delegate'],
      shape: 'delay_problem',
      targetOptions: [systemRef('staff')],
      expectedEffects: ['lower visible tension', 'add staff stress'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect(
          'cause',
          `culture:${chosen.id}`,
          slot.id === 'ignore_custom' ? -8 : 6,
          slot.labelHint,
          ['culture'],
        ),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `culture_${slot.id}_${chosen.id}`,
          actors: [ref],
          tags: ['culture', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  return [
    buildSeed({
      id: seedId('culture_conflict', chosen.id, ctx),
      family: 'culture_conflict',
      type: 'social_conflict',
      timing: 'during_service',
      domain: ['cultures', 'social'],
      severity: Math.max(30, tension.severity),
      urgency: Math.max(25, tension.urgency),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['cultural_tension']),
      stakes: [
        stake('culture_stake', `culture:${chosen.id}`, 'Culture tension may rise', 'risk', ['culture']),
        stake('comfort_stake', `culture:${chosen.id}:comfort`, 'Comfort may collapse', 'loss', ['culture']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `culture_seed_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['culture', 'tension'],
      textIngredients: buildTextIngredients({
        subject: chosen.label,
        problemNoun: 'cultural friction',
        sensoryDetails: ['drawn breath', 'shifted seat'],
        actorOpinions: { [chosen.id]: 'expects a gesture' },
        recentContext: [`tension ${chosen.tension}`],
        stakesReadable: ['tension may rise', 'group may walk'],
        namedEntities: [namedEntityIngredient(ctx.state, 'culture', ref)],
        socialContext: chosen.preferredStockTags.length > 0
          ? [`prefers: ${chosen.preferredStockTags.slice(0, 2).join(', ')}`]
          : ['quiet preferences'],
        calendarContext: calendarContext.length > 0 ? calendarContext : calendarContextLines(ctx.state),
        pressureContext: [`cultural tension ${tension.value}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.10 — area_atmosphere
// ----------------------------------------------------------------------

function generateAreaAtmosphere(ctx: SimContext): IssueSeed[] {
  const allAreas = Object.values(ctx.state.areas)
  if (allAreas.length === 0) return []

  let chosen = allAreas[0]!
  let chosenScore = -Infinity
  for (const a of allAreas) {
    const dirty = 100 - (a.cleanliness ?? 50)
    const damaged = a.damage ?? 0
    const score = dirty + damaged
    if (score > chosenScore) {
      chosenScore = score
      chosen = a
    }
  }
  // Don't fire when the area is fine.
  if (chosenScore < 60) return []

  const ref = areaRef(chosen.id)
  const causes: CauseEntry[] = []
  for (const c of recentCauseEntries(ctx, ['area', chosen.id, 'cleanliness', 'damage'], 14, 4)) {
    causes.push(c)
  }
  causes.push(...pressureCauseRefsAsEntries(ctx, 'maintenance', 2))
  if (causes.length === 0) return []

  // Optional unfinished project in this area.
  const owner = ctx.state.modules.ownerActions as
    | { projects?: Record<string, { id: string; targetType?: string; targetId?: string; status: string; label: string }> }
    | undefined
  const projects = owner?.projects ?? {}
  const projectIncomplete = Object.values(projects).find(
    (p) => p.targetType === 'area' && p.targetId === chosen.id && p.status === 'active',
  )

  const responseSlots: ResponseSlot[] = [
    {
      id: 'repair_area',
      labelHint: `Repair ${chosen.label}`,
      allowedVerbs: ['repair'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['restore condition', 'spend coin'],
    },
    {
      id: 'clean_area',
      labelHint: `Clean ${chosen.label}`,
      allowedVerbs: ['clean'],
      shape: 'short_term_patch',
      targetOptions: [ref],
      expectedEffects: ['raise cleanliness', 'time cost'],
    },
    {
      id: 'start_project',
      labelHint: 'Start a project',
      allowedVerbs: ['upgrade'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['major upgrade', 'coin and time cost'],
    },
    {
      id: 'close_area_temporarily',
      labelHint: `Close ${chosen.label}`,
      allowedVerbs: ['delay'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['stop damage', 'lose capacity'],
    },
    {
      id: 'rebrand_area',
      labelHint: 'Rebrand the area',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [ref],
      expectedEffects: ['shift identity', 'risk audience'],
    },
    {
      id: 'ignore_area_problem',
      labelHint: 'Ignore the problem',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'rep drifts'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect('cause', `area:${chosen.id}`, slot.id === 'ignore_area_problem' ? -5 : 5, slot.labelHint, [
          'area',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `area_${slot.id}_${chosen.id}`,
          actors: [ref],
          tags: ['area', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const memoryText = strongestMemoryText(ctx.state, ref, ['area'])
  const relevantMemories: string[] = memoryText ? [memoryText] : []
  if (projectIncomplete) relevantMemories.push(`project: ${projectIncomplete.label}`)

  return [
    buildSeed({
      id: seedId('area_atmosphere', chosen.id, ctx),
      family: 'area_atmosphere',
      type: 'warning',
      timing: 'morning_prep',
      domain: ['areas', 'atmosphere'],
      severity: Math.max(35, Math.round(chosenScore / 2)),
      urgency: 30,
      location: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['maintenance']),
      stakes: [
        stake('atmosphere_stake', `area:${chosen.id}`, 'Atmosphere may rot', 'loss', ['area']),
        stake('reputation_stake', 'reputation:filthy', 'Reputation may drift', 'risk', ['reputation']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `area_atmosphere_seed_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'atmosphere', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['area', 'atmosphere'],
      textIngredients: buildTextIngredients({
        subject: chosen.label.toLowerCase(),
        problemNoun: 'sour atmosphere',
        sensoryDetails: ['dim light', 'dust haze'],
        actorOpinions: { regulars: 'wrinkle their noses' },
        recentContext: [`cleanliness ${chosen.cleanliness ?? 0}`],
        stakesReadable: ['atmosphere may rot', 'rep may drift'],
        namedEntities: [namedEntityIngredient(ctx.state, 'area', ref)],
        relevantMemories,
        pressureContext: ['maintenance pressure'],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.11 — seasonal_arc
// ----------------------------------------------------------------------

function generateSeasonalArc(ctx: SimContext): IssueSeed[] {
  const arcs = listActiveArcs(ctx.state)
  if (arcs.length === 0) return []
  const escalation = pressureSnapshotById(ctx, 'arc_escalation')
  const festival = pressureSnapshotById(ctx, 'festival_readiness')

  // Pick the most "interesting" arc — highest intensity + advanced stage.
  let chosen = arcs[0]!
  let chosenScore = -Infinity
  for (const arc of arcs) {
    const stageScore =
      arc.stage === 'climax' ? 50 : arc.stage === 'active' ? 30 : arc.stage === 'rising' ? 15 : 5
    const score = (arc.intensity ?? 0) + stageScore
    if (score > chosenScore) {
      chosenScore = score
      chosen = arc
    }
  }
  const ref = localArcRef(chosen.id)
  const guard = activeArcExistsGuard(ctx, ref)
  if (!guard.allowed) return []

  const causes: CauseEntry[] = []
  for (const c of recentCauseEntries(ctx, ['arc', chosen.id, chosen.definitionId, 'festival'], 14, 4)) {
    causes.push(c)
  }
  causes.push(...pressureCauseRefsAsEntries(ctx, 'arc_escalation', 2))
  causes.push(...pressureCauseRefsAsEntries(ctx, 'festival_readiness', 2))
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'prepare_for_arc',
      labelHint: 'Prepare for the arc',
      allowedVerbs: ['upgrade', 'buy'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['raise readiness', 'spend coin'],
    },
    {
      id: 'exploit_arc',
      labelHint: 'Exploit the moment',
      allowedVerbs: ['raise_price', 'rebrand'],
      shape: 'risky_profitable',
      targetOptions: [ref],
      expectedEffects: ['raise margin', 'risk reputation'],
    },
    {
      id: 'delay_preparation',
      labelHint: 'Delay preparation',
      allowedVerbs: ['delay'],
      shape: 'delay_problem',
      targetOptions: [ref],
      expectedEffects: ['no cost', 'arc escalates'],
    },
    {
      id: 'ask_supplier_help',
      labelHint: 'Ask a supplier for help',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: [systemRef('supplier')],
      expectedEffects: ['secure stock', 'owe favour'],
    },
    {
      id: 'ask_faction_help',
      labelHint: 'Ask a faction for help',
      allowedVerbs: ['negotiate'],
      shape: 'relationship_sacrifice',
      targetOptions: [systemRef('faction')],
      expectedEffects: ['secure help', 'owe debt'],
    },
    {
      id: 'ignore_warning',
      labelHint: 'Ignore the warning',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'arc may fail'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect('cause', `arc:${chosen.id}`, slot.id === 'ignore_warning' ? -8 : 5, slot.labelHint, [
          'arc',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `arc_${slot.id}_${chosen.id}`,
          actors: [ref],
          tags: ['arc', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const arcContext: string[] = [`stage ${chosen.stage ?? 'unknown'}`]
  if (escalation) arcContext.push(`escalation ${escalation.value}`)
  if (festival) arcContext.push(`readiness ${festival.value}`)

  return [
    buildSeed({
      id: seedId('seasonal_arc', chosen.id, ctx),
      family: 'seasonal_arc',
      type: chosen.stage === 'climax' ? 'arc_milestone' : 'festival_preparation',
      timing: 'morning_prep',
      domain: ['arcs', 'calendar'],
      severity: Math.max(35, escalation?.severity ?? 35, chosen.intensity ?? 30),
      urgency: Math.max(30, escalation?.urgency ?? 30),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['arc_escalation', 'festival_readiness']),
      stakes: [
        stake('arc_stake', `arc:${chosen.id}`, 'Arc may fail', 'loss', ['arc']),
        stake('readiness_stake', 'pressure:festival_readiness', 'Readiness may drop', 'risk', ['arc']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `arc_seed_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['arc', 'calendar'],
      textIngredients: buildTextIngredients({
        subject: chosen.label,
        problemNoun: 'arc milestone',
        sensoryDetails: ['flags rising', 'crowds gathering'],
        actorOpinions: { regulars: 'whisper about it' },
        recentContext: [`intensity ${chosen.intensity}`],
        stakesReadable: ['arc may fail', 'readiness may drop'],
        namedEntities: [namedEntityIngredient(ctx.state, 'arc', ref)],
        arcContext,
        calendarContext: calendarContextLines(ctx.state),
        pressureContext: [`arc escalation ${escalation?.value ?? 0}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.12 — policy_backlash
// ----------------------------------------------------------------------

function generatePolicyBacklash(ctx: SimContext): IssueSeed[] {
  const backlash = pressureSnapshotById(ctx, 'policy_backlash')
  if (!backlash || backlash.value < 25) return []
  const owner = ctx.state.modules.ownerActions as
    | { policies?: Record<string, { id: string; label: string; enabled: boolean; targetType?: string; targetId?: string }> }
    | undefined
  const policies = Object.values(owner?.policies ?? {}).filter((p) => p.enabled)
  if (policies.length === 0) return []

  const policy = policies[0]!
  const guard = policyStillActiveGuard(ctx, policy.id)
  if (!guard.allowed) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'policy_backlash', 3)
  for (const c of recentCauseEntries(ctx, ['policy', policy.id, 'backlash'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const targetRefs: EntityRef[] = []
  if (policy.targetType === 'faction' && policy.targetId) {
    targetRefs.push(factionRef(policy.targetId))
  } else if (policy.targetType === 'culture' && policy.targetId) {
    targetRefs.push(cultureRef(policy.targetId))
  } else if (policy.targetType === 'customer_group' && policy.targetId) {
    targetRefs.push(customerRef(policy.targetId))
  }

  const policyRefId: EntityRef = { kind: 'other', id: `policy:${policy.id}` }

  const responseSlots: ResponseSlot[] = [
    {
      id: 'keep_policy',
      labelHint: `Keep ${policy.label}`,
      allowedVerbs: ['ignore'],
      shape: 'escalation',
      targetOptions: [policyRefId],
      expectedEffects: ['hold line', 'backlash grows'],
    },
    {
      id: 'modify_policy',
      labelHint: 'Modify the policy',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: [policyRefId],
      expectedEffects: ['lower backlash', 'partial loss'],
    },
    {
      id: 'repeal_policy',
      labelHint: 'Repeal the policy',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [policyRefId],
      expectedEffects: ['end backlash', 'reverse intended effect'],
    },
    {
      id: 'make_exception',
      labelHint: 'Make an exception',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: targetRefs.length > 0 ? targetRefs : [policyRefId],
      expectedEffects: ['lower local anger', 'risk inconsistency'],
    },
    {
      id: 'explain_policy',
      labelHint: 'Explain the policy',
      allowedVerbs: ['rebrand'],
      shape: 'compromise',
      targetOptions: [policyRefId],
      expectedEffects: ['lower confusion', 'time cost'],
    },
    {
      id: 'punish_violation',
      labelHint: 'Punish a violation',
      allowedVerbs: ['threaten'],
      shape: 'escalation',
      targetOptions: targetRefs.length > 0 ? targetRefs : [policyRefId],
      expectedEffects: ['signal enforcement', 'destroy relationship'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect('cause', `policy:${policy.id}`, slot.id === 'repeal_policy' ? -15 : 5, slot.labelHint, [
          'policy',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `policy_${slot.id}_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const perceivedBlame: string[] = []
  for (const ref of targetRefs) {
    const blame = strongestAttributionText(ctx.state, ref, ['blame', 'resentment'])
    if (blame) perceivedBlame.push(blame)
  }
  const tavernRef = tavernIdentityRef(ctx.state.meta.tavernId)
  const ownerBlame = strongestAttributionText(ctx.state, tavernRef, ['blame', 'resentment'])
  if (ownerBlame) perceivedBlame.push(ownerBlame)

  const namedEntities = [namedEntityIngredient(ctx.state, 'policy', policyRefId)]
  for (const target of targetRefs) {
    namedEntities.push(namedEntityIngredient(ctx.state, target.kind, target))
  }

  return [
    buildSeed({
      id: seedId('policy_backlash', policy.id, ctx),
      family: 'policy_backlash',
      type: 'policy_reaction',
      timing: 'morning_prep',
      domain: ['policies', 'social'],
      severity: Math.max(35, backlash.severity),
      urgency: Math.max(30, backlash.urgency),
      primaryActor: policyRefId,
      affectedActors: targetRefs.length > 0 ? targetRefs : [policyRefId],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['policy_backlash', 'faction_anger']),
      stakes: [
        stake('policy_stake', `policy:${policy.id}`, 'Policy may collapse', 'risk', ['policy']),
        stake('faction_stake', 'pressure:faction_anger', 'Faction anger may spike', 'risk', ['faction']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `policy_seed_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['policy', 'backlash'],
      textIngredients: buildTextIngredients({
        subject: policy.label,
        problemNoun: 'policy backlash',
        sensoryDetails: ['sharp glances', 'lowered voices'],
        actorOpinions: { policy: 'feels heavy-handed' },
        recentContext: [`backlash ${backlash.value}`],
        stakesReadable: ['policy may collapse', 'faction anger may spike'],
        namedEntities: namedEntities.slice(0, 4),
        socialContext: targetRefs.length > 0 ? [`target: ${targetRefs[0]!.kind}`] : ['broad target'],
        perceivedBlame,
        pressureContext: [`policy backlash ${backlash.value}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.13 — rumour_crisis
// ----------------------------------------------------------------------

function generateRumourCrisis(ctx: SimContext): IssueSeed[] {
  const rumourPressure = pressureSnapshotById(ctx, 'rumour_pressure')
  if (!rumourPressure || rumourPressure.value < 25) return []

  // Find a strong public attribution (Phase 37). Prefer false/partial accuracy.
  const publicAttributions = strongestPublicAttributions(ctx.state, 5)
  const dramatic = publicAttributions.find(
    (a) => a.accuracy === 'false' || a.accuracy === 'partial',
  ) ?? publicAttributions[0]
  if (!dramatic) {
    // Fall back to a rumour record if no attribution surfaced.
    const rumour = pickStrongest(Object.values(ctx.state.world.socialRumours))
    if (!rumour) return []
    return rumourSeedFromRumour(ctx, rumour, rumourPressure)
  }

  const target = dramatic.target
  const guardRef =
    target.kind === 'supplier'
      ? supplierExistsGuard(ctx, target)
      : target.kind === 'regular'
        ? regularExistsGuard(ctx, target)
        : target.kind === 'faction'
          ? factionExistsGuard(ctx, target)
          : target.kind === 'staff'
            ? staffStillEmployedGuard(ctx, target)
            : { allowed: true }
  if (!guardRef.allowed) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'rumour_pressure', 3)
  for (const c of recentCauseEntries(ctx, ['rumour', 'attribution', 'reputation'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'deny_rumour',
      labelHint: 'Deny the rumour',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [target],
      expectedEffects: ['shift attribution', 'risk credibility'],
    },
    {
      id: 'confess_partial_truth',
      labelHint: 'Confess partial truth',
      allowedVerbs: ['confess'],
      shape: 'relationship_sacrifice',
      targetOptions: [target],
      expectedEffects: ['lower distrust', 'admit fault'],
    },
    {
      id: 'blame_someone_else',
      labelHint: 'Blame someone else',
      allowedVerbs: ['blame'],
      shape: 'deception',
      targetOptions: [target],
      expectedEffects: ['shift blame', 'create grudge'],
    },
    {
      id: 'prove_truth',
      labelHint: 'Prove the truth',
      allowedVerbs: ['rebrand'],
      shape: 'long_term_investment',
      targetOptions: [target],
      expectedEffects: ['lower rumour', 'effort cost'],
    },
    {
      id: 'bribe_gossip',
      labelHint: 'Bribe the gossip',
      allowedVerbs: ['bribe'],
      shape: 'risky_profitable',
      targetOptions: [target],
      expectedEffects: ['silence source', 'spend coin'],
    },
    {
      id: 'ignore_rumour',
      labelHint: 'Ignore the rumour',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'rumour grows'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect(
          'cause',
          `rumour:${target.kind}:${target.id}`,
          slot.id === 'ignore_rumour' ? -5 : 5,
          slot.labelHint,
          ['rumour'],
        ),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_${slot.id}_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const perceivedBlame: string[] = [dramatic.readable]

  return [
    buildSeed({
      id: seedId('rumour_crisis', `${target.kind}-${target.id}`, ctx),
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'closing',
      domain: ['rumours', 'reputation', 'social'],
      severity: Math.max(35, rumourPressure.severity),
      urgency: Math.max(30, rumourPressure.urgency),
      primaryActor: target,
      affectedActors: [target],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['rumour_pressure', 'reputation_drift']),
      stakes: [
        stake('rumour_stake', `rumour:${target.kind}:${target.id}`, 'Rumour may spread', 'risk', [
          'rumour',
        ]),
        stake('reputation_stake', 'reputation:dangerous', 'Reputation may rot', 'loss', ['reputation']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `rumour_seed_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['rumour', 'reputation'],
      textIngredients: buildTextIngredients({
        subject: displayNameForRef(ctx.state, target),
        problemNoun: dramatic.accuracy === 'false' ? 'false rumour' : 'spreading rumour',
        sensoryDetails: ['whispered word', 'turned heads'],
        actorOpinions: { source: 'will not stop talking' },
        recentContext: [`publicness ${dramatic.publicness}`],
        stakesReadable: ['rumour may spread', 'reputation may rot'],
        namedEntities: [namedEntityIngredient(ctx.state, target.kind, target)],
        socialContext: [`accuracy: ${dramatic.accuracy}`],
        perceivedBlame,
        pressureContext: [`rumour pressure ${rumourPressure.value}`],
      }),
      ctx,
    }),
  ]
}

function rumourSeedFromRumour(
  ctx: SimContext,
  rumour: { id: string; label: string; strength: number; accuracy: string; subject?: EntityRef },
  rumourPressure: IssueSeed['pressures'][number],
): IssueSeed[] {
  const ref = rumour.subject ?? rumourRef(rumour.id)
  const guard = rumourStillActiveGuard(ctx, rumour.id)
  if (!guard.allowed) return []

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'rumour_pressure', 3)
  if (causes.length === 0) return []

  const responseSlots: ResponseSlot[] = [
    {
      id: 'deny_rumour',
      labelHint: 'Deny the rumour',
      allowedVerbs: ['rebrand'],
      shape: 'reputation_play',
      targetOptions: [ref],
      expectedEffects: ['shift blame', 'risk credibility'],
    },
    {
      id: 'ignore_rumour',
      labelHint: 'Ignore the rumour',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'rumour grows'],
    },
    {
      id: 'confess_partial_truth',
      labelHint: 'Confess partial truth',
      allowedVerbs: ['confess'],
      shape: 'relationship_sacrifice',
      targetOptions: [ref],
      expectedEffects: ['lower distrust', 'admit fault'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect('cause', `rumour:${rumour.id}`, slot.id === 'ignore_rumour' ? -5 : 5, slot.labelHint, [
          'rumour',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_${slot.id}_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  return [
    buildSeed({
      id: seedId('rumour_crisis', rumour.id, ctx),
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'closing',
      domain: ['rumours', 'reputation'],
      severity: Math.max(35, rumour.strength),
      urgency: Math.max(30, rumourPressure.urgency),
      primaryActor: ref,
      affectedActors: [ref],
      causes,
      pressures: [rumourPressure],
      stakes: [
        stake('rumour_stake', `rumour:${rumour.id}`, 'Rumour may spread', 'risk', ['rumour']),
        stake('reputation_stake', 'reputation:dangerous', 'Reputation may rot', 'loss', ['reputation']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `rumour_seed_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['rumour', 'reputation'],
      textIngredients: buildTextIngredients({
        subject: rumour.label,
        problemNoun: 'spreading rumour',
        sensoryDetails: ['whispered word', 'turned heads'],
        actorOpinions: { source: 'will not stop talking' },
        recentContext: [`accuracy ${rumour.accuracy}`],
        stakesReadable: ['rumour may spread', 'reputation may rot'],
        namedEntities: [namedEntityIngredient(ctx.state, 'rumour', ref)],
        perceivedBlame: [rumour.label],
        pressureContext: [`rumour pressure ${rumourPressure.value}`],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// 39.14 — rival_tavern
// ----------------------------------------------------------------------

function generateRivalTavern(ctx: SimContext): IssueSeed[] {
  const rival = pressureSnapshotById(ctx, 'rival_tavern_pressure')
  if (!rival || rival.value < 25) return []
  const regularsLoss = pressureSnapshotById(ctx, 'regular_customer_loss')

  // Look for a rival-themed arc, if any.
  const arcs = listActiveArcs(ctx.state)
  const rivalArc = arcs.find((a) => a.tags.includes('rival') || a.definitionId.includes('rival'))

  const causes: CauseEntry[] = pressureCauseRefsAsEntries(ctx, 'rival_tavern_pressure', 3)
  for (const c of recentCauseEntries(ctx, ['rival', 'market', 'patronage'], 14, 3)) {
    if (!causes.find((existing) => existing.id === c.id)) causes.push(c)
  }
  if (causes.length === 0) return []

  const rivalRef: EntityRef = rivalArc
    ? localArcRef(rivalArc.id)
    : systemRef('rival_tavern')

  const responseSlots: ResponseSlot[] = [
    {
      id: 'compete_on_price',
      labelHint: 'Compete on price',
      allowedVerbs: ['lower_price'],
      shape: 'risky_profitable',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise patronage', 'lose margin'],
    },
    {
      id: 'host_counter_event',
      labelHint: 'Host counter-event',
      allowedVerbs: ['invite'],
      shape: 'long_term_investment',
      targetOptions: [rivalRef],
      expectedEffects: ['raise patronage', 'spend coin'],
    },
    {
      id: 'improve_quality',
      labelHint: 'Improve quality',
      allowedVerbs: ['upgrade'],
      shape: 'long_term_investment',
      targetOptions: [stockRef('ale')],
      expectedEffects: ['raise reputation', 'time cost'],
    },
    {
      id: 'spread_counter_rumour',
      labelHint: 'Spread counter-rumour',
      allowedVerbs: ['rebrand'],
      shape: 'deception',
      targetOptions: [rivalRef],
      expectedEffects: ['hurt rival', 'risk discovery'],
    },
    {
      id: 'negotiate_with_rival',
      labelHint: 'Negotiate with the rival',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: [rivalRef],
      expectedEffects: ['share market', 'lose autonomy'],
    },
    {
      id: 'ignore_rival',
      labelHint: 'Ignore the rival',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['no cost', 'rival grows'],
    },
  ]

  const consequenceProfiles: ConsequenceProfile[] = responseSlots.map((slot) =>
    makeProfile({
      id: `${slot.id}_profile`,
      responseSlotId: slot.id,
      immediateEffects: [
        effect(
          'cause',
          `rival:tavern`,
          slot.id === 'ignore_rival' ? -5 : 5,
          slot.labelHint,
          ['rival'],
        ),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rival_${slot.id}`,
          actors: [rivalRef],
          tags: ['rival', slot.id],
        },
      ],
      futureHooks: [],
    }),
  )

  const namedEntities = [namedEntityIngredient(ctx.state, 'rival', rivalRef)]
  const arcContext: string[] = []
  if (rivalArc) arcContext.push(`arc ${rivalArc.label}`)

  return [
    buildSeed({
      id: seedId('rival_tavern', rivalArc ? rivalArc.id : 'rival', ctx),
      family: 'rival_tavern',
      type: 'social_conflict',
      timing: 'closing',
      domain: ['rival', 'market', 'customers'],
      severity: Math.max(35, rival.severity),
      urgency: Math.max(30, rival.urgency),
      primaryActor: rivalRef,
      affectedActors: [rivalRef],
      causes,
      pressures: pressureSnapshotsFor(ctx, ['rival_tavern_pressure', 'regular_customer_loss']),
      stakes: [
        stake('rival_stake', 'rival:tavern', 'Rival may steal market', 'risk', ['rival']),
        stake('regular_stake', 'regulars', 'Regulars may leave', 'loss', ['regular']),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `rival_seed_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'warning'],
        },
      ],
      futureHooks: [],
      toneHints: ['rival', 'market'],
      textIngredients: buildTextIngredients({
        subject: 'the rival tavern',
        problemNoun: 'rival pressure',
        sensoryDetails: ['empty tables', 'distant cheer'],
        actorOpinions: { regulars: 'mention the other place' },
        recentContext: [`rival pressure ${rival.value}`],
        stakesReadable: ['regulars may leave', 'market may shift'],
        namedEntities,
        marketContext: [`pressure ${rival.value}`],
        arcContext,
        ...(regularsLoss && regularsLoss.value > 0
          ? { pressureContext: [`regular loss ${regularsLoss.value}`] }
          : {}),
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Expanded generator registry definitions
// ----------------------------------------------------------------------

export const EXPANDED_SEED_GENERATORS: IssueSeedGenerator[] = [
  {
    id: 'staff_identity_loyalty',
    family: 'staff_identity',
    domain: ['staff', 'identity'],
    timing: ['morning_prep'],
    generate: generateStaffIdentity,
  },
  {
    id: 'regular_customer_irritation',
    family: 'regular_customer',
    domain: ['regulars', 'customers'],
    timing: ['during_service'],
    generate: generateRegularCustomer,
  },
  {
    id: 'supplier_relationship_distrust',
    family: 'supplier_relationship',
    domain: ['suppliers', 'market'],
    timing: ['morning_prep'],
    generate: generateSupplierRelationship,
  },
  {
    id: 'faction_request_anger',
    family: 'faction_request',
    domain: ['factions', 'social'],
    timing: ['during_service'],
    generate: generateFactionRequest,
  },
  {
    id: 'culture_conflict_tension',
    family: 'culture_conflict',
    domain: ['cultures', 'social'],
    timing: ['during_service'],
    generate: generateCultureConflict,
  },
  {
    id: 'area_atmosphere_dirty',
    family: 'area_atmosphere',
    domain: ['areas', 'atmosphere'],
    timing: ['morning_prep'],
    generate: generateAreaAtmosphere,
  },
  {
    id: 'seasonal_arc_milestone',
    family: 'seasonal_arc',
    domain: ['arcs', 'calendar'],
    timing: ['morning_prep'],
    generate: generateSeasonalArc,
  },
  {
    id: 'policy_backlash_active',
    family: 'policy_backlash',
    domain: ['policies', 'social'],
    timing: ['morning_prep'],
    generate: generatePolicyBacklash,
  },
  {
    id: 'rumour_crisis_attribution',
    family: 'rumour_crisis',
    domain: ['rumours', 'reputation'],
    timing: ['closing'],
    generate: generateRumourCrisis,
  },
  {
    id: 'rival_tavern_pressure',
    family: 'rival_tavern',
    domain: ['rival', 'market'],
    timing: ['closing'],
    generate: generateRivalTavern,
  },
]
