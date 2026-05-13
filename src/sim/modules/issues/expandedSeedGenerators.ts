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

// Phase 40 audit pass 1 — Picker rotation. The same slow-moving entity
// (worst-loyalty staff, dirtiest area, lowest-relationship faction) would
// otherwise win the per-family argmax every day. We track recent picks
// and apply a recency penalty so other candidates get a turn.
const RECENCY_WINDOW_DAYS = 5
const RECENCY_PENALTY = 25

function recencyPenalty(
  state: TavernState,
  family: string,
  entityKey: string,
  today: number,
): number {
  const slice = state.modules.issueSeeds as
    | { recentPicks?: Record<string, Record<string, number>> }
    | undefined
  const familyPicks = slice?.recentPicks?.[family] ?? {}
  const lastDay = familyPicks[entityKey]
  if (lastDay === undefined) return 0
  if (today - lastDay >= RECENCY_WINDOW_DAYS) return 0
  return RECENCY_PENALTY
}

function recordPick(ctx: SimContext, family: string, entityKey: string): void {
  const today = ctx.state.calendar.totalDaysElapsed
  ctx.modifyModuleState(
    'issueSeeds',
    (current) => {
      const slice = (current ?? {}) as {
        recentPicks?: Record<string, Record<string, number>>
      } & Record<string, unknown>
      const recent = { ...(slice.recentPicks ?? {}) }
      recent[family] = { ...(recent[family] ?? {}), [entityKey]: today }
      return { ...slice, recentPicks: recent } as never
    },
    { source: 'expandedSeedGenerators.recordPick' },
  )
}

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
  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = allStaff[0]!
  let chosenScore = -Infinity
  for (const s of allStaff) {
    const candidateRef = staffRef(s.id)
    const attributions = attributionsByTarget(ctx.state, candidateRef)
    const blameWeight = attributions
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'resentment')
      .reduce((acc, a) => acc + a.strength * (a.publicness / 100), 0)
    const loyaltyDeficit = 100 - s.loyalty
    const baseScore = blameWeight + loyaltyDeficit + s.stress + s.fatigue
    const penalty = recencyPenalty(ctx.state, 'staff_identity', `staff:${s.id}`, today)
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = s
    }
  }
  const ref = staffRef(chosen.id)
  const guard = staffStillEmployedGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'staff_identity', `staff:${chosen.id}`)

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
  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = regulars[0]!
  let chosenScore = -Infinity
  for (const r of regulars) {
    const baseScore = r.irritation + (100 - r.loyalty)
    const penalty = recencyPenalty(ctx.state, 'regular_customer', `regular:${r.id}`, today)
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = r
    }
  }
  const ref = regularRef(chosen.id)
  const guard = regularExistsGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'regular_customer', `regular:${chosen.id}`)

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
  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = suppliers[0]!
  let chosenScore = -Infinity
  for (const s of suppliers) {
    const candidateRef = supplierRef(s.id)
    const blameWeight = attributionsByTarget(ctx.state, candidateRef)
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'distrust')
      .reduce((acc, a) => acc + a.strength, 0)
    const memWeight = entityMemoryList(ctx.state, candidateRef).length * 10
    const reliabilityDeficit = 100 - s.reliability
    const baseScore = blameWeight + memWeight + reliabilityDeficit
    const penalty = recencyPenalty(ctx.state, 'supplier_relationship', `supplier:${s.id}`, today)
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = s
    }
  }
  const ref = supplierRef(chosen.id)
  const guard = supplierExistsGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'supplier_relationship', `supplier:${chosen.id}`)

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

  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = factions[0]!
  let chosenScore = -Infinity
  for (const f of factions) {
    const baseScore = Math.abs(50 - f.relationship) + f.influence * 0.5
    const penalty = recencyPenalty(ctx.state, 'faction_request', `faction:${f.id}`, today)
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = f
    }
  }
  const ref = factionRef(chosen.id)
  const guard = factionExistsGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'faction_request', `faction:${chosen.id}`)

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'appease_faction_profile',
      responseSlotId: 'appease_faction',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, 15, 'Relationship rises', [
          'faction',
        ]),
        effect('state_change', 'coin', -20, 'Appeasement cost', ['coin']),
        effect('pressure', 'pressure:faction_anger', -10, 'Faction anger eases', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `faction_appeased_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'appease', 'gratitude'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'negotiate_terms_profile',
      responseSlotId: 'negotiate_terms',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, 10, 'Relationship improves', [
          'faction',
        ]),
        effect('state_change', `factions.${chosen.id}.trust`, 8, 'Trust grows', ['faction']),
        effect('pressure', 'pressure:faction_anger', -6, 'Anger softens', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `faction_negotiated_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'negotiation'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'refuse_faction_profile',
      responseSlotId: 'refuse_faction',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, -20, 'Relationship collapses', [
          'faction',
        ]),
        effect('state_change', `factions.${chosen.id}.trust`, -12, 'Trust drops', ['faction']),
        effect('pressure', 'pressure:faction_anger', 12, 'Faction anger spikes', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `faction_grudge_${chosen.id}`,
          0,
          'Faction may retaliate',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `faction_refused_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'grudge', 'refusal'],
        },
      ],
      futureHooks: [
        {
          id: `faction_grudge_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'host_faction_night_profile',
      responseSlotId: 'host_faction_night',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, 18, 'Hosting wins favour', [
          'faction',
        ]),
        effect('state_change', `factions.${chosen.id}.influence`, 5, 'Faction influence rises', [
          'faction',
        ]),
        effect('state_change', 'coin', -15, 'Event costs', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:cultural_tension', 5, 'Other groups feel sidelined', ['pressure']),
      ],
      memories: [
        {
          id: `faction_hosted_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'host', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'call_watch_profile',
      responseSlotId: 'call_watch',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, -25, 'Faction sees betrayal', [
          'faction',
        ]),
        effect('state_change', `factions.${chosen.id}.fear`, 15, 'Faction fears retaliation', [
          'faction',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `faction_revenge_${chosen.id}`,
          0,
          'Faction may seek revenge',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `faction_watch_called_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'escalation', 'betrayal'],
        },
      ],
      futureHooks: [
        {
          id: `faction_revenge_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'play_rival_faction_profile',
      responseSlotId: 'play_rival_faction',
      immediateEffects: [
        effect('state_change', `factions.${chosen.id}.relationship`, 5, 'Shift relationship slightly', [
          'faction',
        ]),
        effect('state_change', `factions.${chosen.id}.trust`, -8, 'Trust quietly erodes', ['faction']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 8, 'Whispers spread', ['pressure']),
        effect(
          'future_hook',
          `faction_deception_exposed_${chosen.id}`,
          0,
          'Deception may surface',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `faction_played_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: `faction_deception_exposed_${chosen.id}`,
          actors: [ref],
          tags: ['faction', 'risk', 'deception'],
        },
      ],
    }),
  ]

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

  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = cultures[0]!
  let chosenScore = -Infinity
  for (const c of cultures) {
    const penalty = recencyPenalty(ctx.state, 'culture_conflict', `culture:${c.id}`, today)
    const score = c.tension - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = c
    }
  }
  const ref = cultureRef(chosen.id)
  recordPick(ctx, 'culture_conflict', `culture:${chosen.id}`)

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'mediate_groups_profile',
      responseSlotId: 'mediate_groups',
      immediateEffects: [
        effect('state_change', `cultures.${chosen.id}.tension`, -15, 'Tension drops', ['culture']),
        effect('state_change', `cultures.${chosen.id}.comfort`, 10, 'Comfort rises', ['culture']),
        effect('pressure', 'pressure:cultural_tension', -10, 'Tension eases', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `culture_mediated_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'mediation', 'compromise'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'honour_custom_profile',
      responseSlotId: 'honour_custom',
      immediateEffects: [
        effect('state_change', `cultures.${chosen.id}.familiarity`, 15, 'Familiarity grows', [
          'culture',
        ]),
        effect('state_change', `cultures.${chosen.id}.comfort`, 12, 'Group feels seen', ['culture']),
        effect('state_change', 'coin', -10, 'Custom honoured', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:cultural_tension', -8, 'Cultural tension eases', ['pressure']),
      ],
      memories: [
        {
          id: `culture_honoured_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'honour', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_custom_profile',
      responseSlotId: 'ignore_custom',
      immediateEffects: [],
      delayedEffects: [
        effect('state_change', `cultures.${chosen.id}.tension`, 12, 'Tension rises', ['culture']),
        effect('state_change', `cultures.${chosen.id}.comfort`, -8, 'Comfort erodes', ['culture']),
        effect('pressure', 'pressure:cultural_tension', 10, 'Tension grows', ['pressure']),
      ],
      memories: [
        {
          id: `culture_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'ignored', 'neglected'],
        },
      ],
      futureHooks: [
        {
          id: `culture_walkout_risk_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'change_seating_policy_profile',
      responseSlotId: 'change_seating_policy',
      immediateEffects: [
        effect('state_change', `cultures.${chosen.id}.tension`, -10, 'Seating eases this group', [
          'culture',
        ]),
        effect('state_change', `cultures.${chosen.id}.comfort`, 8, 'Group settles', ['culture']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:cultural_tension', 5, 'Other groups feel sidelined', [
          'pressure',
        ]),
        effect('state_change', 'reputation.strange', 6, 'House reads as taking sides', ['reputation']),
      ],
      memories: [
        {
          id: `culture_seating_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'seating', 'compromise'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'offer_discount_profile',
      responseSlotId: 'offer_discount',
      immediateEffects: [
        effect('state_change', `cultures.${chosen.id}.comfort`, 15, 'Discount buys comfort', [
          'culture',
        ]),
        effect('state_change', 'coin', -15, 'Discount cost', ['coin']),
        effect('pressure', 'pressure:cultural_tension', -8, 'Tension eases', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `culture_discounted_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'discount', 'gratitude'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ask_staff_to_intervene_profile',
      responseSlotId: 'ask_staff_to_intervene',
      immediateEffects: [
        effect('state_change', `cultures.${chosen.id}.tension`, -8, 'Visible tension drops', [
          'culture',
        ]),
        effect('pressure', 'pressure:staff_burnout', 8, 'Staff carry the strain', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:staff_loyalty_risk', 5, 'Staff resent the burden', ['pressure']),
      ],
      memories: [
        {
          id: `culture_staff_intervene_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'staff', 'delegate'],
        },
      ],
      futureHooks: [],
    }),
  ]

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

  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = allAreas[0]!
  let chosenScore = -Infinity
  let chosenRawScore = 0
  let bestPenalised = -Infinity
  for (const a of allAreas) {
    const dirty = 100 - (a.cleanliness ?? 50)
    const damaged = a.damage ?? 0
    const rawScore = dirty + damaged
    const penalty = recencyPenalty(ctx.state, 'area_atmosphere', `area:${a.id}`, today)
    const penalised = rawScore - penalty
    if (penalised > bestPenalised) {
      bestPenalised = penalised
      chosenScore = rawScore
      chosenRawScore = rawScore
      chosen = a
    }
  }
  // Don't fire when the area is fine.
  if (chosenRawScore < 60) return []

  const ref = areaRef(chosen.id)
  recordPick(ctx, 'area_atmosphere', `area:${chosen.id}`)
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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'repair_area_profile',
      responseSlotId: 'repair_area',
      immediateEffects: [
        effect('state_change', `areas.${chosen.id}.condition`, 15, 'Condition restored', ['area']),
        effect('state_change', `areas.${chosen.id}.damage`, -15, 'Damage reduced', ['area']),
        effect('state_change', 'coin', -15, 'Repair cost', ['coin']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `area_repaired_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'repair'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'clean_area_profile',
      responseSlotId: 'clean_area',
      immediateEffects: [
        effect('state_change', `areas.${chosen.id}.cleanliness`, 20, 'Area cleaned', ['area']),
        effect('state_change', `areas.${chosen.id}.smell`, -12, 'Smell reduced', ['area']),
        effect('state_change', `areas.${chosen.id}.mess`, -10, 'Mess cleared', ['area']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `area_cleaned_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'cleaning'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'start_project_profile',
      responseSlotId: 'start_project',
      immediateEffects: [
        effect('state_change', 'coin', -25, 'Project investment', ['coin']),
        effect('state_change', `areas.${chosen.id}.condition`, 10, 'Initial upgrade work', ['area']),
      ],
      delayedEffects: [
        effect('state_change', `areas.${chosen.id}.condition`, 20, 'Project completes', ['area']),
        effect('pressure', 'pressure:maintenance', -10, 'Maintenance pressure eases', ['pressure']),
      ],
      memories: [
        {
          id: `area_project_started_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'project', 'upgrade'],
        },
      ],
      futureHooks: [
        {
          id: `area_project_completion_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'project'],
        },
      ],
    }),
    makeProfile({
      id: 'close_area_temporarily_profile',
      responseSlotId: 'close_area_temporarily',
      immediateEffects: [
        effect('state_change', `areas.${chosen.id}.damage`, -8, 'Damage stops accruing', ['area']),
        effect('state_change', `areas.${chosen.id}.cleanliness`, 10, 'Empty area gets tidied', ['area']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:stock_shortage', 6, 'Capacity loss strains service', ['pressure']),
      ],
      memories: [
        {
          id: `area_closed_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'closed', 'compromise'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'rebrand_area_profile',
      responseSlotId: 'rebrand_area',
      immediateEffects: [
        effect('state_change', 'reputation.respectable', -8, 'Reputation shifts on identity gamble', [
          'reputation',
        ]),
        effect('state_change', `areas.${chosen.id}.condition`, 5, 'Coat of paint masks problem', ['area']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `area_rebrand_audience_shift_${chosen.id}`,
          0,
          'Audience may narrow',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `area_rebranded_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'rebrand', 'reputation'],
        },
      ],
      futureHooks: [
        {
          id: `area_rebrand_audience_shift_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'ignore_area_problem_profile',
      responseSlotId: 'ignore_area_problem',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:maintenance', 10, 'Maintenance pressure rises', ['pressure']),
        effect('state_change', `areas.${chosen.id}.condition`, -8, 'Slow decay', ['area']),
        effect('state_change', `areas.${chosen.id}.damage`, 6, 'Damage accrues', ['area']),
      ],
      memories: [
        {
          id: `area_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'neglected'],
        },
      ],
      futureHooks: [
        {
          id: `area_collapse_risk_${chosen.id}`,
          actors: [ref],
          tags: ['area', 'risk'],
        },
      ],
    }),
  ]

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
  const today = ctx.state.calendar.totalDaysElapsed
  let chosen = arcs[0]!
  let chosenScore = -Infinity
  for (const arc of arcs) {
    const stageScore =
      arc.stage === 'climax' ? 50 : arc.stage === 'active' ? 30 : arc.stage === 'rising' ? 15 : 5
    const baseScore = (arc.intensity ?? 0) + stageScore
    const penalty = recencyPenalty(ctx.state, 'seasonal_arc', `local_event:${arc.id}`, today)
    const score = baseScore - penalty
    if (score > chosenScore) {
      chosenScore = score
      chosen = arc
    }
  }
  const ref = localArcRef(chosen.id)
  const guard = activeArcExistsGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'seasonal_arc', `local_event:${chosen.id}`)

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'prepare_for_arc_profile',
      responseSlotId: 'prepare_for_arc',
      immediateEffects: [
        effect('pressure', 'pressure:festival_readiness', -15, 'Readiness climbs', ['pressure']),
        effect('state_change', 'coin', -20, 'Preparation cost', ['coin']),
        effect('pressure', 'pressure:arc_escalation', -8, 'Arc pressure eases', ['pressure']),
      ],
      delayedEffects: [
        effect('state_change', 'reputation.reliable', 8, 'Tavern prepared for the moment', [
          'reputation',
        ]),
      ],
      memories: [
        {
          id: `arc_prepared_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'preparation', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'exploit_arc_profile',
      responseSlotId: 'exploit_arc',
      immediateEffects: [
        effect('state_change', 'coin', 20, 'Premium prices', ['coin']),
        effect('state_change', 'reputation.cheap', -10, 'No longer feels affordable', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:regular_customer_loss', 10, 'Regulars feel gouged', ['pressure']),
        effect(
          'future_hook',
          `arc_exploit_backlash_${chosen.id}`,
          0,
          'Reputation backlash possible',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `arc_exploited_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'exploit', 'risky'],
        },
      ],
      futureHooks: [
        {
          id: `arc_exploit_backlash_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'delay_preparation_profile',
      responseSlotId: 'delay_preparation',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:festival_readiness', 12, 'Readiness slips further', [
          'pressure',
        ]),
        effect('pressure', 'pressure:arc_escalation', 10, 'Arc escalates', ['pressure']),
        effect('pressure', 'pressure:staff_burnout', 6, 'Rush work later strains staff', [
          'pressure',
        ]),
      ],
      memories: [
        {
          id: `arc_delayed_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'delayed'],
        },
      ],
      futureHooks: [
        {
          id: `arc_unprepared_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'ask_supplier_help_profile',
      responseSlotId: 'ask_supplier_help',
      immediateEffects: [
        effect('pressure', 'pressure:festival_readiness', -12, 'Stock secured for arc', ['pressure']),
        effect('pressure', 'pressure:stock_shortage', -8, 'Stock pressure eases', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:supplier_distrust', 5, 'Owed favour shifts balance', [
          'pressure',
        ]),
        effect(
          'future_hook',
          `arc_supplier_favour_owed_${chosen.id}`,
          0,
          'Favour will be called in',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `arc_supplier_helped_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'supplier', 'compromise'],
        },
      ],
      futureHooks: [
        {
          id: `arc_supplier_favour_owed_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'supplier', 'debt'],
        },
      ],
    }),
    makeProfile({
      id: 'ask_faction_help_profile',
      responseSlotId: 'ask_faction_help',
      immediateEffects: [
        effect('pressure', 'pressure:festival_readiness', -15, 'Faction backing secures arc', [
          'pressure',
        ]),
        effect('pressure', 'pressure:arc_escalation', -6, 'Arc steadies', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:faction_anger', 8, 'Debt to faction simmers', ['pressure']),
        effect(
          'future_hook',
          `arc_faction_debt_${chosen.id}`,
          0,
          'Faction will demand repayment',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `arc_faction_helped_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'faction', 'debt'],
        },
      ],
      futureHooks: [
        {
          id: `arc_faction_debt_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'faction', 'debt'],
        },
      ],
    }),
    makeProfile({
      id: 'ignore_warning_profile',
      responseSlotId: 'ignore_warning',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:festival_readiness', 15, 'Readiness collapses', ['pressure']),
        effect('pressure', 'pressure:arc_escalation', 12, 'Arc spirals', ['pressure']),
        effect('state_change', 'reputation.reliable', -8, 'Reputation suffers', ['reputation']),
      ],
      memories: [
        {
          id: `arc_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'ignored'],
        },
      ],
      futureHooks: [
        {
          id: `arc_failure_${chosen.id}`,
          actors: [ref],
          tags: ['arc', 'risk', 'failure'],
        },
      ],
    }),
  ]

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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'deny_rumour_profile',
      responseSlotId: 'deny_rumour',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -10, 'Public denial blunts rumour', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', -6, 'Credibility takes a hit', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `rumour_denial_backfire_${target.kind}_${target.id}`,
          0,
          'Denial may backfire if true',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_denied_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'denial', 'reputation'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_denial_backfire_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'confess_partial_truth_profile',
      responseSlotId: 'confess_partial_truth',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -15, 'Honesty disarms the rumour', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 8, 'Audience respects candour', [
          'reputation',
        ]),
        effect('state_change', 'reputation.reliable', 10, 'Reliable reputation grows', ['reputation']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_confessed_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'confess', 'honesty'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'blame_someone_else_profile',
      responseSlotId: 'blame_someone_else',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -8, 'Deflection muddies the story', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', -4, 'Audience smells dishonesty', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:cultural_tension', 8, 'Blamed party simmers', ['pressure']),
        effect(
          'future_hook',
          `rumour_blame_grudge_${target.kind}_${target.id}`,
          0,
          'Blamed party may grudge',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_deflected_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'deception', 'blame'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_blame_grudge_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'risk', 'grudge'],
        },
      ],
    }),
    makeProfile({
      id: 'prove_truth_profile',
      responseSlotId: 'prove_truth',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -20, 'Evidence ends the rumour', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 12, 'Credibility climbs', [
          'reputation',
        ]),
        effect('state_change', 'coin', -10, 'Investigation costs', ['coin']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_disproved_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'truth', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'bribe_gossip_profile',
      responseSlotId: 'bribe_gossip',
      immediateEffects: [
        effect('state_change', 'coin', -20, 'Pay the gossip', ['coin']),
        effect('pressure', 'pressure:rumour_pressure', -12, 'Source quiets down', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `rumour_bribe_exposed_${target.kind}_${target.id}`,
          0,
          'Bribe may be exposed',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_bribed_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'bribe', 'risk'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_bribe_exposed_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'risk', 'corruption'],
        },
      ],
    }),
    makeProfile({
      id: 'ignore_rumour_profile',
      responseSlotId: 'ignore_rumour',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 12, 'Silence lets rumour grow', [
          'pressure',
        ]),
        effect('state_change', 'reputation.dangerous', 8, 'Reputation rots', ['reputation']),
      ],
      memories: [
        {
          id: `rumour_ignored_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'ignored'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_escalation_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
  ]

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
      // Audit fixes pass 1 §5.3 — Only attach a primaryActor when the
      // rumour points at a real entity. A tavern-wide rumour has no
      // single character on the hook, so leave primary unset and let the
      // affected list represent the rumour locus.
      ...(target.kind !== 'tavern_identity' ? { primaryActor: target } : {}),
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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'deny_rumour_profile',
      responseSlotId: 'deny_rumour',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -10, 'Public denial blunts rumour', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', -6, 'Credibility takes a hit', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `rumour_denial_backfire_${rumour.id}`,
          0,
          'Denial may backfire',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_denied_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'denial'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_denial_backfire_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'ignore_rumour_profile',
      responseSlotId: 'ignore_rumour',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 12, 'Silence lets rumour grow', [
          'pressure',
        ]),
        effect('state_change', 'reputation.dangerous', 8, 'Reputation rots', ['reputation']),
      ],
      memories: [
        {
          id: `rumour_ignored_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'ignored'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_escalation_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'confess_partial_truth_profile',
      responseSlotId: 'confess_partial_truth',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -15, 'Honesty disarms the rumour', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 8, 'Audience respects candour', [
          'reputation',
        ]),
        effect('state_change', 'reputation.reliable', 10, 'Reliable reputation grows', ['reputation']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_confessed_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'confess', 'honesty'],
        },
      ],
      futureHooks: [],
    }),
  ]

  return [
    buildSeed({
      id: seedId('rumour_crisis', rumour.id, ctx),
      family: 'rumour_crisis',
      type: 'rumour',
      timing: 'closing',
      domain: ['rumours', 'reputation'],
      severity: Math.max(35, rumour.strength),
      urgency: Math.max(30, rumourPressure.urgency),
      // Audit fixes pass 1 §5.3 — Only attach a primaryActor when the
      // rumour points at a real entity. A tavern-wide rumour has no
      // single character on the hook.
      ...(ref.kind !== 'tavern_identity' ? { primaryActor: ref } : {}),
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

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'compete_on_price_profile',
      responseSlotId: 'compete_on_price',
      immediateEffects: [
        effect('state_change', 'customers.local_goblins.patronage', 8, 'Locals return for cheap drink', [
          'customer',
        ]),
        effect('state_change', 'customers.miners.patronage', 10, 'Miners drift back', ['customer']),
        effect('state_change', 'coin', -12, 'Margin erodes', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', -8, 'Rival pressure eases', ['pressure']),
      ],
      memories: [
        {
          id: `rival_priced_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'compete', 'price'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'host_counter_event_profile',
      responseSlotId: 'host_counter_event',
      immediateEffects: [
        effect('state_change', 'customers.merchants.patronage', 12, 'Merchants drawn in', [
          'customer',
        ]),
        effect('state_change', 'customers.adventurers.patronage', 10, 'Adventurers come for the show', [
          'customer',
        ]),
        effect('state_change', 'coin', -20, 'Event cost', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', -12, 'Rival upstaged', ['pressure']),
        effect('state_change', 'reputation.cozy', 8, 'Tavern feels lively', ['reputation']),
      ],
      memories: [
        {
          id: `rival_counter_event_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'event', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'improve_quality_profile',
      responseSlotId: 'improve_quality',
      immediateEffects: [
        effect('state_change', 'reputation.tasty', 12, 'Quality improves reputation', ['reputation']),
        effect('state_change', 'reputation.respectable', 8, 'Standards rise', ['reputation']),
        effect('state_change', 'coin', -15, 'Investment cost', ['coin']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', -10, 'Rival pressure recedes', [
          'pressure',
        ]),
      ],
      memories: [
        {
          id: `rival_quality_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'quality', 'investment'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'spread_counter_rumour_profile',
      responseSlotId: 'spread_counter_rumour',
      immediateEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', -10, 'Rumour weakens rival', ['pressure']),
        effect('pressure', 'pressure:rumour_pressure', 10, 'Town gossip stirs', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `rival_rumour_exposed_${rivalRef.id}`,
          0,
          'Counter-rumour may be exposed',
          ['future_hook'],
        ),
        effect('state_change', 'reputation.dangerous', 6, 'Reputation darkens', ['reputation']),
      ],
      memories: [
        {
          id: `rival_counter_rumour_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'deception', 'rumour'],
        },
      ],
      futureHooks: [
        {
          id: `rival_rumour_exposed_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'negotiate_with_rival_profile',
      responseSlotId: 'negotiate_with_rival',
      immediateEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', -12, 'Truce eases rival pressure', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 4, 'Civility noted', ['reputation']),
      ],
      delayedEffects: [
        effect('state_change', 'customers.merchants.patronage', -6, 'Shared market splits', [
          'customer',
        ]),
      ],
      memories: [
        {
          id: `rival_negotiated_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'compromise'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_rival_profile',
      responseSlotId: 'ignore_rival',
      immediateEffects: [],
      delayedEffects: [
        effect('pressure', 'pressure:rival_tavern_pressure', 12, 'Rival grows unchecked', [
          'pressure',
        ]),
        effect('state_change', 'customers.merchants.patronage', -8, 'Merchants drift away', [
          'customer',
        ]),
        effect('pressure', 'pressure:regular_customer_loss', 6, 'Regulars hear of the other place', [
          'pressure',
        ]),
      ],
      memories: [
        {
          id: `rival_ignored_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'ignored'],
        },
      ],
      futureHooks: [
        {
          id: `rival_dominance_${rivalRef.id}`,
          actors: [rivalRef],
          tags: ['rival', 'risk'],
        },
      ],
    }),
  ]

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
