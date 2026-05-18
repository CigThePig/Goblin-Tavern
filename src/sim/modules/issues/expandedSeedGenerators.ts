import type { SimContext } from '../../core/context'
import type { EffectPreview } from '../../core/effect'
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
  dedupeRefs,
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
import {
  pickCustomerFacingArea,
  pickRepairableArea,
} from './areaPickers'
import { recencyPenalty, recordPick } from './seedRotation'
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
// otherwise win the per-family argmax every day. Phase 64 / ISSUE-024
// extracted the helpers to `./seedRotation` so the core generators
// (food_safety, stock_shortage, maintenance) can rotate too.

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
  const scoreStaff = (s: (typeof allStaff)[number]) => {
    const candidateRef = staffRef(s.id)
    const attributions = attributionsByTarget(ctx.state, candidateRef)
    const blameWeight = attributions
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'resentment')
      .reduce((acc, a) => acc + a.strength * (a.publicness / 100), 0)
    const loyaltyDeficit = 100 - s.loyalty
    const baseScore = blameWeight + loyaltyDeficit + s.stress + s.fatigue
    const penalty = recencyPenalty(ctx.state, 'staff_identity', `staff:${s.id}`, today)
    return baseScore - penalty
  }
  const ranked = allStaff
    .map((s) => ({ s, score: scoreStaff(s) }))
    .sort((a, b) => b.score - a.score)
  const chosen = ranked[0]!.s
  const ref = staffRef(chosen.id)
  const guard = staffStillEmployedGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'staff_identity', `staff:${chosen.id}`)

  // Phase 40 audit pass 2 §1 — Pull a peer staff member (the next-best
  // candidate) so memories and futureHooks reference two staff actors.
  // This dilutes single-staff dominance in named_entity_repetition and
  // gives the calculator richer relatedActors when scapegoat/comforted
  // memories land. Pull the most-relevant customer group too: any group
  // whose loyalty axis matches the staff member's served scenes.
  const peer = ranked.length > 1 ? ranked[1]!.s : undefined
  const peerRef = peer ? staffRef(peer.id) : undefined
  const witnessGroupId =
    Object.entries(ctx.state.customerGroups)
      .sort((a, b) => b[1].patronage - a[1].patronage)[0]?.[0] ?? 'local_goblins'
  const witnessGroupRef = customerRef(witnessGroupId)
  const witnessFactionRef = ctx.state.world.factions['brewers_guild']
    ? factionRef('brewers_guild')
    : undefined

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
    {
      id: 'give_authority',
      labelHint: `Give ${chosen.name.display} more authority`,
      allowedVerbs: ['promote', 'delegate'],
      shape: 'long_term_investment',
      targetOptions: [ref],
      expectedEffects: ['raise loyalty sharply', 'raise stress', 'service capacity grows'],
    },
    {
      id: 'quieter_role',
      labelHint: `Move ${chosen.name.display} to a quieter role`,
      allowedVerbs: ['delegate'],
      shape: 'compromise',
      targetOptions: [ref],
      expectedEffects: ['lower stress', 'service capacity drops'],
    },
    {
      id: 'promise_raise',
      labelHint: `Promise ${chosen.name.display} a raise`,
      allowedVerbs: ['pay'],
      shape: 'delay_problem',
      targetOptions: [ref],
      expectedEffects: ['raise loyalty now', 'future wage cost'],
    },
    {
      id: 'staff_meeting',
      labelHint: 'Hold a staff meeting',
      allowedVerbs: ['negotiate'],
      shape: 'compromise',
      targetOptions: peerRef ? [ref, peerRef] : [ref],
      expectedEffects: ['lower burnout', 'spread context to peers'],
    },
    {
      id: 'training_helper',
      labelHint: peerRef
        ? `Pair ${chosen.name.display} with ${peer!.name.display}`
        : `Train ${chosen.name.display} on a new station`,
      allowedVerbs: ['delegate', 'promote'],
      shape: 'long_term_investment',
      targetOptions: peerRef ? [ref, peerRef] : [ref],
      expectedEffects: ['lower burnout', 'raise peer loyalty', 'service quality climbs'],
    },
  ]

  const peerActors = peerRef ? [ref, peerRef] : [ref]
  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'comfort_staff_profile',
      responseSlotId: 'comfort_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 10, 'Loyalty rises', ['staff']),
        effect('state_change', `staff.${chosen.id}.stress`, -8, 'Stress drops', ['staff']),
        effect('state_change', `staff.${chosen.id}.morale`, 6, 'Morale lifts', ['staff']),
        effect('cause', `staff:${chosen.id}`, 5, 'Private gratitude', ['staff', 'attribution']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `staff_emotional_debt_${chosen.id}`,
          8,
          'Owner owes the moment back',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_comforted_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'loyalty', 'comforted', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_comfort_peer_witness_${peer!.id}`,
                actors: peerActors,
                tags: ['staff', 'witness'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `staff_emotional_debt_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'attribution'],
        },
      ],
    }),
    makeProfile({
      id: 'publicly_back_staff_profile',
      responseSlotId: 'publicly_back_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 12, 'Public backing earns loyalty', [
          'staff',
        ]),
        effect('state_change', 'reputation.respectable', 5, 'Owner stood up for staff', [
          'reputation',
        ]),
        effect('state_change', 'reputation.dangerous', -3, 'Crew-defender signal', [
          'reputation',
        ]),
        effect('pressure', 'pressure:staff_loyalty_risk', -8, 'Loyalty risk eases', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `staff_publicly_backed_${chosen.id}`,
          10,
          'Crew remembers being defended',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_publicly_backed_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'reputation', 'protected', 'attribution'],
        },
        {
          id: `staff_back_witness_${witnessGroupId}`,
          actors: [ref, witnessGroupRef],
          tags: ['staff', 'witness', 'reputation'],
        },
      ],
      futureHooks: [
        {
          id: `staff_publicly_backed_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'reputation'],
        },
      ],
    }),
    makeProfile({
      id: 'pay_bonus_profile',
      responseSlotId: 'pay_bonus',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.morale`, 12, 'Morale up', ['staff']),
        effect('state_change', `staff.${chosen.id}.loyalty`, 6, 'Bonus earns loyalty', ['staff']),
        effect('state_change', 'coin', -10, 'Bonus paid', ['coin']),
        effect('cause', `staff:${chosen.id}`, 8, 'Bonus felt directly', ['staff', 'bonus']),
        effect('pressure', 'pressure:staff_loyalty_risk', -10, 'Loyalty risk drops', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `wage_expectation_${chosen.id}`,
          8,
          'Bonus becomes the new floor',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_bonus_paid_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'bonus', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_bonus_peer_notice_${peer!.id}`,
                actors: peerActors,
                tags: ['staff', 'witness', 'wages'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `wage_expectation_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'wages'],
        },
      ],
    }),
    makeProfile({
      id: 'blame_staff_profile',
      responseSlotId: 'blame_staff',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, -20, 'Loyalty collapses', ['staff']),
        effect('state_change', `staff.${chosen.id}.morale`, -12, 'Morale crumbles', ['staff']),
        effect('state_change', 'reputation.respectable', -8, 'Owner scapegoats publicly', [
          'reputation',
        ]),
        effect('cause', `staff:${chosen.id}`, -12, 'Owner publicly blamed staff', [
          'staff',
          'blame',
          'attribution',
        ]),
        effect('pressure', 'pressure:rumour_pressure', 6, 'Scapegoat story spreads', [
          'pressure',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:staff_loyalty_risk', 12, 'Loyalty risk spikes', [
          'pressure',
        ]),
        effect(
          'future_hook',
          `staff_quit_risk_${chosen.id}`,
          15,
          'Staff may quit',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_scapegoated_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'grudge', 'scapegoat', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_scapegoat_witness_${peer!.id}`,
                actors: peerActors,
                tags: ['staff', 'witness', 'grudge'],
              },
            ]
          : []),
        {
          id: `tavern_blamed_staff_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory'],
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
        effect('state_change', `staff.${chosen.id}.fatigue`, -5, 'Some rest', ['staff']),
        effect('pressure', 'pressure:staff_burnout', -6, 'Burnout eases', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_priority_changed_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'priority', 'protected'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_priority_peer_pickup_${peer!.id}`,
                actors: peerActors,
                tags: ['staff', 'workload'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'ignore_request_profile',
      responseSlotId: 'ignore_request',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, -3, 'Slight loyalty drop', [
          'staff',
        ]),
        effect('state_change', `staff.${chosen.id}.stress`, 4, 'Unspoken stress lingers', [
          'staff',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:staff_loyalty_risk', 6, 'Loyalty risk rises', ['pressure']),
        effect(
          'future_hook',
          `staff_quit_risk_${chosen.id}`,
          10,
          'Quiet quitting watch',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_ignored_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'ignored', 'scapegoat'],
        },
        {
          id: `tavern_owner_walked_past_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory', 'ignored'],
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
      id: 'give_authority_profile',
      responseSlotId: 'give_authority',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 15, 'Authority earns deep loyalty', [
          'staff',
        ]),
        effect('state_change', `staff.${chosen.id}.stress`, 6, 'Authority weighs', ['staff']),
        effect('state_change', 'coin', -8, 'Training tools and badges', ['coin']),
        effect('pressure', 'pressure:staff_loyalty_risk', -10, 'Loyalty risk eases', [
          'pressure',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `authority_test_${chosen.id}`,
          12,
          'Authority will be tested',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_given_authority_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'authority', 'protected', 'attribution'],
        },
        {
          id: `staff_authority_witness_${witnessGroupId}`,
          actors: [ref, witnessGroupRef],
          tags: ['staff', 'witness', 'reputation'],
        },
      ],
      futureHooks: [
        {
          id: `authority_test_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'risk', 'authority'],
        },
      ],
    }),
    makeProfile({
      id: 'quieter_role_profile',
      responseSlotId: 'quieter_role',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.stress`, -12, 'Quiet station relieves', [
          'staff',
        ]),
        effect('state_change', `staff.${chosen.id}.fatigue`, -8, 'Rest returns', ['staff']),
        effect('state_change', `staff.${chosen.id}.loyalty`, 5, 'Recognised the need', [
          'staff',
        ]),
        effect('pressure', 'pressure:staff_loyalty_risk', -6, 'Loyalty risk eases', ['pressure']),
        effect('pressure', 'pressure:staff_burnout', -8, 'Burnout falls', ['pressure']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_quieter_role_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'protected', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_quiet_peer_workload_${peer!.id}`,
                actors: peerActors,
                tags: ['staff', 'workload'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'promise_raise_profile',
      responseSlotId: 'promise_raise',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 14, 'Promise of more', ['staff']),
        effect('state_change', `staff.${chosen.id}.morale`, 8, 'Hope lifts mood', ['staff']),
        effect('pressure', 'pressure:staff_loyalty_risk', -10, 'Loyalty risk eases', [
          'pressure',
        ]),
      ],
      delayedEffects: [
        effect('state_change', 'coin', -15, 'Raise becomes due', ['coin', 'wages']),
        effect(
          'future_hook',
          `raise_promised_${chosen.id}`,
          15,
          'Promise must be kept',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_raise_promised_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'wages', 'bonus', 'attribution'],
        },
        {
          id: `tavern_promised_raise_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory', 'wages'],
        },
      ],
      futureHooks: [
        {
          id: `raise_promised_${chosen.id}`,
          actors: [ref],
          tags: ['staff', 'wages', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'staff_meeting_profile',
      responseSlotId: 'staff_meeting',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.morale`, 6, 'Crew heard out', ['staff']),
        effect('pressure', 'pressure:staff_loyalty_risk', -8, 'Loyalty risk eases', ['pressure']),
        effect('pressure', 'pressure:staff_burnout', -6, 'Burnout eases', ['pressure']),
        effect('cause', `staff:${chosen.id}`, 6, 'Public acknowledgement', [
          'staff',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `staff_meeting_held_${chosen.id}`,
          actors: peerActors,
          tags: ['staff', 'protected', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_meeting_peer_${peer!.id}`,
                actors: [peerRef],
                tags: ['staff', 'protected'],
              },
            ]
          : []),
        ...(witnessFactionRef
          ? [
              {
                id: `staff_meeting_faction_signal`,
                actors: [witnessFactionRef],
                tags: ['faction', 'memory'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'training_helper_profile',
      responseSlotId: 'training_helper',
      immediateEffects: [
        effect('state_change', `staff.${chosen.id}.loyalty`, 8, 'Mentor role earns loyalty', [
          'staff',
        ]),
        effect('state_change', `staff.${chosen.id}.fatigue`, 4, 'Mentoring is work', ['staff']),
        ...(peer
          ? [
              effect('state_change', `staff.${peer.id}.loyalty`, 8, 'Apprentice gains loyalty', [
                'staff',
              ]),
              effect('state_change', `staff.${peer.id}.morale`, 6, 'Apprentice morale rises', [
                'staff',
              ]),
            ]
          : []),
        effect('pressure', 'pressure:staff_burnout', -8, 'Workload spreads', ['pressure']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `training_helper_${chosen.id}`,
          10,
          'Pair becomes a station',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `staff_training_${chosen.id}`,
          actors: peerActors,
          tags: ['staff', 'protected', 'attribution'],
        },
        ...(peerRef
          ? [
              {
                id: `staff_training_peer_${peer!.id}`,
                actors: [peerRef],
                tags: ['staff', 'comforted'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `training_helper_${chosen.id}`,
          actors: peerActors,
          tags: ['staff', 'opportunity'],
        },
      ],
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

  // Phase 40 audit pass 2 §1 — Keep textIngredients.namedEntities to a
  // single primary entry. The audit counts mentions across primaryActor,
  // affectedActors, and textIngredients.namedEntities — listing the
  // peer / witness in all three triples the count. Affected actors still
  // carry the secondary refs so social_consequence_quality reads them.
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

  // Phase 40 audit pass 2 §1 — Only keep the witness customer group on
  // affectedActors; the peer staff reference still travels through
  // profile memories (where the calculator picks it up) but doesn't
  // inflate the per-seed staff repetition counter.
  const seedAffected = dedupeRefs([witnessGroupRef], ref)

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
      affectedActors: seedAffected,
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

  // Phase 54 / ISSUE-014 — Relax the second gate. The previous form
  // required `memories.length === 0` to AND with irritation < 50 AND
  // loyalty > 40 — meaning a sufficiently-irritated regular still
  // couldn't surface the seed if they had no memories yet (which is the
  // case for freshly-decayed regulars or those who haven't accumulated
  // service-failure tags). Drop the memory precondition; allow either
  // a memory trail OR a regular trending visibly negative
  // (irritation > 30 OR loyalty < 60) to fire the seed.
  const memories = entityMemoryList(ctx.state, ref)
  const trendingNegative = chosen.irritation > 30 || chosen.loyalty < 60
  if (memories.length === 0 && !trendingNegative) return []

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

  // Pick the supplier with highest blame/distrust signal. Phase 40 audit
  // pass 2 §1 — also keep the second-best candidate as a secondary
  // supplier so split-orders / switch-supplier responses can reference
  // two named suppliers, diluting `brakka_mushroom_cart` dominance.
  const today = ctx.state.calendar.totalDaysElapsed
  const scoreSupplier = (s: (typeof suppliers)[number]) => {
    const candidateRef = supplierRef(s.id)
    const blameWeight = attributionsByTarget(ctx.state, candidateRef)
      .filter((a) => a.attributionType === 'blame' || a.attributionType === 'distrust')
      .reduce((acc, a) => acc + a.strength, 0)
    const memWeight = entityMemoryList(ctx.state, candidateRef).length * 10
    const reliabilityDeficit = 100 - s.reliability
    const baseScore = blameWeight + memWeight + reliabilityDeficit
    const penalty = recencyPenalty(ctx.state, 'supplier_relationship', `supplier:${s.id}`, today)
    return baseScore - penalty
  }
  const rankedSuppliers = suppliers
    .map((s) => ({ s, score: scoreSupplier(s) }))
    .sort((a, b) => b.score - a.score)
  const chosen = rankedSuppliers[0]!.s
  const secondary = rankedSuppliers.length > 1 ? rankedSuppliers[1]!.s : undefined
  const ref = supplierRef(chosen.id)
  const secondaryRef = secondary ? supplierRef(secondary.id) : undefined
  const guard = supplierExistsGuard(ctx, ref)
  if (!guard.allowed) return []
  recordPick(ctx, 'supplier_relationship', `supplier:${chosen.id}`)
  // Phase 40 audit pass 2 §1 — Faction-tied actor (e.g. brewers_guild) +
  // local town_watch faction get pulled into delivery/payment memories so
  // expanded pressure causes ("brewers_guild remembers late payment") gain
  // a named related actor.
  const factionRefForSupplier = chosen.factionId
    ? factionRef(chosen.factionId)
    : ctx.state.world.factions['brewers_guild']
      ? factionRef('brewers_guild')
      : undefined
  const inspectorFaction = ctx.state.world.factions['town_watch']
    ? factionRef('town_watch')
    : undefined
  const cultureRefForSupplier = chosen.cultureId
    ? cultureRef(chosen.cultureId)
    : undefined

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
    {
      id: 'place_standing_order',
      labelHint: `Place a standing order with ${displayNameForRef(ctx.state, ref)}`,
      allowedVerbs: ['buy', 'negotiate'],
      shape: 'safe_costly',
      targetOptions: [ref],
      expectedEffects: ['lock weekly volume', 'reduce market exposure'],
    },
    {
      id: 'inspect_delivery',
      labelHint: 'Inspect today’s delivery',
      allowedVerbs: ['inspect'],
      shape: 'compromise',
      targetOptions: [ref, goodsRef],
      expectedEffects: ['gate suspicious goods', 'show supplier you care'],
    },
    {
      id: 'split_orders',
      labelHint: secondaryRef
        ? `Split orders with ${displayNameForRef(ctx.state, secondaryRef)}`
        : 'Split orders across two suppliers',
      allowedVerbs: ['buy', 'negotiate'],
      shape: 'long_term_investment',
      targetOptions: secondaryRef ? [ref, secondaryRef] : [ref],
      expectedEffects: ['dilute supply risk', 'spread relationship cost'],
    },
    {
      id: 'supplier_exclusivity_deal',
      labelHint: `Sign exclusivity with ${displayNameForRef(ctx.state, ref)}`,
      allowedVerbs: ['negotiate', 'buy'],
      shape: 'risky_profitable',
      targetOptions: [ref],
      expectedEffects: ['unlock discount', 'single point of failure'],
    },
    {
      id: 'investigate_suspicious_goods',
      labelHint: 'Investigate suspicious goods',
      allowedVerbs: ['inspect', 'discard'],
      shape: 'safe_costly',
      targetOptions: [ref, goodsRef],
      expectedEffects: ['close food safety gap', 'spend hours'],
    },
  ]

  const factionMems = factionRefForSupplier
    ? [factionRefForSupplier]
    : []
  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'pay_supplier_profile',
      responseSlotId: 'pay_supplier',
      immediateEffects: [
        effect('state_change', 'coin', -15, 'Pay supplier', ['coin']),
        effect('pressure', 'pressure:supplier_distrust', -10, 'Lower distrust', ['pressure']),
        effect('pressure', 'pressure:market_instability', -8, 'Steady payments steady prices', [
          'pressure',
        ]),
        effect('cause', `supplier:${chosen.id}`, 10, 'Supplier paid on time', [
          'supplier',
          'paid_on_time',
          'attribution',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `supplier_goodwill_return_${chosen.id}`,
          8,
          'Goodwill returns next delivery',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_paid_${chosen.id}`,
          actors: [ref, ...factionMems],
          tags: ['supplier', 'payment', 'paid_on_time', 'fair_deal', 'attribution'],
        },
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_faction_paid_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'memory', 'hosted_event'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `supplier_goodwill_return_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'opportunity'],
        },
      ],
    }),
    makeProfile({
      id: 'negotiate_supplier_profile',
      responseSlotId: 'negotiate_supplier',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, 12, 'Negotiation succeeds', [
          'supplier',
          'fair_deal',
          'attribution',
        ]),
        effect('pressure', 'pressure:stock_shortage', -6, 'New pricing eases stock', [
          'pressure',
        ]),
        effect('pressure', 'pressure:market_instability', -5, 'Locked price calms market', [
          'pressure',
        ]),
        effect('state_change', `world.suppliers.${chosen.id}.relationship`, 3, 'Relationship up', [
          'supplier',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `supplier_renegotiation_${chosen.id}`,
          8,
          'Terms may need revisiting',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_negotiated_${chosen.id}`,
          actors: [ref, ...factionMems],
          tags: ['supplier', 'negotiation', 'fair_deal', 'attribution'],
        },
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_negotiation_faction_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'memory'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `supplier_renegotiation_${chosen.id}`,
          actors: [ref],
          tags: ['supplier'],
        },
      ],
    }),
    makeProfile({
      id: 'blame_supplier_profile',
      responseSlotId: 'blame_supplier',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, -15, 'Relationship damaged', [
          'supplier',
          'blame',
          'attribution',
        ]),
        effect('pressure', 'pressure:supplier_distrust', 8, 'Distrust rises', ['pressure']),
        effect('pressure', 'pressure:rumour_pressure', 5, 'Blame leaks publicly', ['pressure']),
        effect('state_change', `world.suppliers.${chosen.id}.relationship`, -10, 'Bond strained', [
          'supplier',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `supplier_retaliation_${chosen.id}`,
          12,
          'Supplier may retaliate',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_blamed_${chosen.id}`,
          actors: [ref, ...factionMems],
          tags: ['supplier', 'grudge', 'delivery_dispute', 'attribution'],
        },
        {
          id: `tavern_blamed_supplier_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory', 'blame'],
        },
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_faction_blame_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'grudge', 'attribution'],
              },
            ]
          : []),
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
        effect('cause', `supplier:${chosen.id}`, -20, 'Relationship ends', [
          'supplier',
          'attribution',
        ]),
        effect('pressure', 'pressure:supplier_distrust', -8, 'Clean slate with new supplier', [
          'pressure',
        ]),
        effect('pressure', 'pressure:stock_shortage', 10, 'Gap while transitioning', [
          'pressure',
        ]),
        effect('state_change', 'coin', -20, 'Switching cost', ['coin']),
      ],
      delayedEffects: secondary
        ? [
            effect(
              'future_hook',
              `new_supplier_uncertainty_${secondary.id}`,
              10,
              `${secondary.label} reliability unproven`,
              ['future_hook'],
            ),
          ]
        : [],
      memories: [
        {
          id: `supplier_switched_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'switched', 'grudge', 'delivery_dispute'],
        },
        ...(secondary && secondaryRef
          ? [
              {
                id: `supplier_new_${secondary.id}`,
                actors: [secondaryRef],
                tags: ['supplier', 'opportunity', 'fair_deal'],
              },
            ]
          : []),
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_faction_drop_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'memory', 'grudge'],
              },
            ]
          : []),
      ],
      futureHooks:
        secondary && secondaryRef
          ? [
              {
                id: `new_supplier_uncertainty_${secondary.id}`,
                actors: [secondaryRef],
                tags: ['supplier', 'risk'],
              },
            ]
          : [],
    }),
    makeProfile({
      id: 'accept_suspicious_profile',
      responseSlotId: 'accept_suspicious_goods',
      immediateEffects: [
        effect('pressure', 'pressure:food_safety', 8, 'Food safety risk rises', ['pressure']),
        effect('pressure', 'pressure:inspection', 6, 'Inspection risk rises', ['pressure']),
        effect('cause', `supplier:${chosen.id}`, 4, 'Supplier owes a favour', [
          'supplier',
          'attribution',
        ]),
        effect('state_change', 'coin', 6, 'Cheap goods, immediate margin', ['coin']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `food_poisoning_outbreak_${chosen.id}`,
          12,
          'Outbreak risk grows',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_suspicious_goods_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'deception', 'delivery_dispute'],
        },
        {
          id: `tavern_kept_secret_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: `food_poisoning_outbreak_${chosen.id}`,
          actors: [ref],
          tags: ['food_safety', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'refuse_supplier_profile',
      responseSlotId: 'refuse_supplier_offer',
      immediateEffects: [
        effect('cause', `supplier:${chosen.id}`, -10, 'Refusal stings', [
          'supplier',
          'attribution',
        ]),
        effect('pressure', 'pressure:supplier_distrust', 6, 'Distrust rises', ['pressure']),
        effect('state_change', `world.suppliers.${chosen.id}.relationship`, -5, 'Bond cools', [
          'supplier',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:stock_shortage', 4, 'Stock pressure rises', ['pressure']),
      ],
      memories: [
        {
          id: `supplier_refused_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'refused', 'delivery_dispute', 'attribution'],
        },
        {
          id: `tavern_stood_firm_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['tavern_identity', 'memory', 'standards'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'place_standing_order_profile',
      responseSlotId: 'place_standing_order',
      immediateEffects: [
        effect('state_change', 'coin', -25, 'Weekly volume locked', ['coin']),
        effect('pressure', 'pressure:market_instability', -10, 'Market exposure trimmed', [
          'pressure',
        ]),
        effect('state_change', `world.suppliers.${chosen.id}.reliability`, 5, 'Reliability climbs', [
          'supplier',
        ]),
        effect('cause', `supplier:${chosen.id}`, 8, 'Standing order signed', [
          'supplier',
          'fair_deal',
          'paid_on_time',
          'attribution',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `standing_order_due_${chosen.id}`,
          10,
          'Weekly volume is now owed',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_standing_order_${chosen.id}`,
          actors: [ref, ...factionMems],
          tags: ['supplier', 'fair_deal', 'paid_on_time', 'attribution'],
        },
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_faction_signed_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'memory', 'hosted_event'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `standing_order_due_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'rent_like'],
        },
      ],
    }),
    makeProfile({
      id: 'inspect_delivery_profile',
      responseSlotId: 'inspect_delivery',
      immediateEffects: [
        effect('state_change', 'coin', -3, 'Time lost inspecting', ['coin']),
        effect('pressure', 'pressure:food_safety', -8, 'Bad goods rejected', ['pressure']),
        effect('pressure', 'pressure:market_instability', -4, 'Surprises trimmed', ['pressure']),
        effect('cause', `supplier:${chosen.id}`, 6, 'Supplier respects the diligence', [
          'supplier',
          'fair_deal',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `supplier_delivery_inspected_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'fair_deal', 'attribution'],
        },
        ...(inspectorFaction
          ? [
              {
                id: `inspection_practice_witness_${chosen.id}`,
                actors: [inspectorFaction],
                tags: ['faction', 'memory', 'hosted_event'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'split_orders_profile',
      responseSlotId: 'split_orders',
      immediateEffects: [
        effect('pressure', 'pressure:market_instability', -12, 'Two suppliers dilute risk', [
          'pressure',
        ]),
        effect('pressure', 'pressure:supplier_distrust', -6, 'Reduced single-supplier pressure', [
          'pressure',
        ]),
        effect('state_change', 'coin', -10, 'Split orders cost more upfront', ['coin']),
        ...(secondary
          ? [
              effect(
                'cause',
                `supplier:${secondary.id}`,
                8,
                `Order placed with ${secondary.label}`,
                ['supplier', 'fair_deal', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `dual_supplier_balance_${chosen.id}`,
          8,
          'Balancing two suppliers ongoing',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_split_primary_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'fair_deal', 'attribution'],
        },
        ...(secondary && secondaryRef
          ? [
              {
                id: `supplier_split_secondary_${secondary.id}`,
                actors: [secondaryRef],
                tags: ['supplier', 'fair_deal', 'attribution'],
              },
            ]
          : []),
        ...(factionRefForSupplier
          ? [
              {
                id: `supplier_split_faction_${chosen.id}`,
                actors: [factionRefForSupplier],
                tags: ['faction', 'memory'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `dual_supplier_balance_${chosen.id}`,
          actors: secondaryRef ? [ref, secondaryRef] : [ref],
          tags: ['supplier'],
        },
      ],
    }),
    makeProfile({
      id: 'supplier_exclusivity_profile',
      responseSlotId: 'supplier_exclusivity_deal',
      immediateEffects: [
        effect('state_change', 'coin', 12, 'Exclusivity discount applied', ['coin']),
        effect('pressure', 'pressure:supplier_distrust', -10, 'Locked-in trust', ['pressure']),
        effect('pressure', 'pressure:market_instability', 8, 'Single point of failure', [
          'pressure',
        ]),
        effect('cause', `supplier:${chosen.id}`, 12, 'Exclusivity earns commitment', [
          'supplier',
          'fair_deal',
          'attribution',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `exclusivity_risk_${chosen.id}`,
          15,
          'Exclusivity locks tavern in',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_exclusivity_${chosen.id}`,
          actors: [ref, tavernIdentityRef('self')],
          tags: ['supplier', 'paid_on_time', 'fair_deal', 'attribution'],
        },
        ...(secondary && secondaryRef
          ? [
              {
                id: `supplier_exclusivity_rival_${secondary.id}`,
                actors: [secondaryRef],
                tags: ['supplier', 'grudge'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `exclusivity_risk_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'investigate_suspicious_goods_profile',
      responseSlotId: 'investigate_suspicious_goods',
      immediateEffects: [
        effect('pressure', 'pressure:food_safety', -10, 'Suspicious stock contained', [
          'pressure',
        ]),
        effect('pressure', 'pressure:inspection', -6, 'Records show diligence', ['pressure']),
        effect('cause', `supplier:${chosen.id}`, -8, 'Supplier feels investigated', [
          'supplier',
          'attribution',
        ]),
        effect('state_change', 'coin', -8, 'Hours and discarded stock', ['coin']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `supplier_investigation_concluded_${chosen.id}`,
          10,
          'Findings will go on record',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `supplier_investigation_${chosen.id}`,
          actors: [ref],
          tags: ['supplier', 'delivery_dispute', 'attribution'],
        },
        ...(inspectorFaction
          ? [
              {
                id: `inspection_investigation_${chosen.id}`,
                actors: [inspectorFaction],
                tags: ['faction', 'memory', 'hosted_event'],
              },
            ]
          : []),
        ...(cultureRefForSupplier
          ? [
              {
                id: `supplier_culture_signal_${chosen.cultureId ?? 'unknown'}`,
                actors: [cultureRefForSupplier],
                tags: ['culture', 'memory'],
              },
            ]
          : []),
      ],
      futureHooks: [
        {
          id: `supplier_investigation_concluded_${chosen.id}`,
          actors: [ref],
          tags: ['supplier'],
        },
      ],
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

  // Phase 40 audit pass 2 §2 — Keep affectedActors minimal so the
  // secondary supplier + faction don't double-count daily. They still
  // ride along inside profile memories where the actual relationship
  // shift lands.
  const seedAffected: EntityRef[] = dedupeRefs([], ref)

  const namedEntities = [namedEntityIngredient(ctx.state, 'supplier', ref)]

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
      affectedActors: seedAffected,
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
        namedEntities,
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
      targetOptions: [pickCustomerFacingArea(ctx, 'culture_conflict')],
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
      // Phase 64 / ISSUE-024 — taking sides on seating risks pushback
      // from the other groups later.
      futureHooks: [
        {
          id: `culture_seating_backlash_${chosen.id}`,
          actors: [ref],
          tags: ['culture', 'risk'],
        },
      ],
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

// Phase 40 audit pass 2 §6 — Seasonal arc archetypes. Five archetypes, each
// with its own response slots + consequence profiles. The generator
// chooses one of these based on an active local arc when present, or by
// "anticipation" cues (calendar tags + market conditions + pressure
// thresholds) when no arc is yet active in state.world.localEvents.
type SeasonalArcTheme =
  | 'mushroom_blight'
  | 'miner_payday_boom'
  | 'inspection_campaign'
  | 'rival_tavern_expansion'
  | 'festival_approaching'

const SEASONAL_ARC_LABELS: Record<SeasonalArcTheme, string> = {
  mushroom_blight: 'Mushroom Blight',
  miner_payday_boom: 'Miner Payday Boom',
  inspection_campaign: 'Inspection Campaign',
  rival_tavern_expansion: 'Rival Tavern Expansion',
  festival_approaching: 'Festival Approaching',
}

function buildSeasonalArcContent(
  ctx: SimContext,
  theme: SeasonalArcTheme,
  arcRef: EntityRef,
  arcKey: string,
  arcSlotRef: EntityRef,
): { responseSlots: ResponseSlot[]; consequenceProfiles: ConsequenceProfile[]; extraAffected: EntityRef[] } {
  // arcSlotRef is used inside response slot targetOptions; arcRef is
  // used inside profile memories. For active arcs both are the same; for
  // anticipation seeds we replace the slot ref with systemRef('arc')
  // (resolves as true) since the validator requires slot targets to
  // resolve against state.
  const tavernSelf = tavernIdentityRef('self')
  const factionByThemes: Record<SeasonalArcTheme, string[]> = {
    mushroom_blight: ['scrap_collectors', 'brewers_guild'],
    miner_payday_boom: ['miners_union', 'town_watch'],
    inspection_campaign: ['town_watch', 'local_shrine'],
    rival_tavern_expansion: ['market_caravan_circle', 'brewers_guild'],
    festival_approaching: ['local_shrine', 'miners_union'],
  }
  const supplierByThemes: Record<SeasonalArcTheme, string[]> = {
    mushroom_blight: ['brakka_mushroom_cart', 'scrap_meat_vendor'],
    miner_payday_boom: ['old_keg_brewers', 'mudroad_grain_runner'],
    inspection_campaign: ['scrap_meat_vendor', 'brakka_mushroom_cart'],
    rival_tavern_expansion: ['mudroad_grain_runner', 'old_keg_brewers'],
    festival_approaching: ['old_keg_brewers', 'mudroad_grain_runner'],
  }
  const cultureByThemes: Record<SeasonalArcTheme, string[]> = {
    mushroom_blight: ['goblin_local'],
    miner_payday_boom: ['miner_workcrew'],
    inspection_campaign: ['merchant_roadfolk'],
    rival_tavern_expansion: ['merchant_roadfolk', 'adventuring_bands'],
    festival_approaching: ['goblin_local', 'ogre_clans'],
  }

  const factionRefs = factionByThemes[theme]
    .filter((id) => ctx.state.world.factions[id])
    .map((id) => factionRef(id))
  const supplierRefs = supplierByThemes[theme]
    .filter((id) => ctx.state.world.suppliers[id])
    .map((id) => supplierRef(id))
  const cultureRefs = cultureByThemes[theme]
    .filter((id) => ctx.state.world.cultures[id])
    .map((id) => cultureRef(id))

  const primaryFaction = factionRefs[0]
  const secondaryFaction = factionRefs[1]
  const primarySupplier = supplierRefs[0]
  const secondarySupplier = supplierRefs[1]
  const primaryCulture = cultureRefs[0]

  // Each archetype gets a curated set of slots + profiles. Common backbone
  // (prepare / exploit / delay / ask_supplier / ask_faction / ignore) is
  // preserved, but archetype-specific slots replace the generic targets.
  switch (theme) {
    case 'mushroom_blight':
      return {
        extraAffected: [
          ...(primarySupplier ? [primarySupplier] : []),
          ...(primaryFaction ? [primaryFaction] : []),
          ...(primaryCulture ? [primaryCulture] : []),
        ],
        responseSlots: [
          {
            id: 'lock_in_cheap_mushrooms',
            labelHint: 'Lock in cheap mushrooms now',
            allowedVerbs: ['buy', 'negotiate'],
            shape: 'risky_profitable',
            targetOptions: primarySupplier ? [primarySupplier] : [arcRef],
            expectedEffects: ['stockpile mushrooms', 'commit supplier coin'],
          },
          {
            id: 'swap_to_substitute_stew',
            labelHint: 'Swap to substitute stew',
            allowedVerbs: ['buy', 'discard'],
            shape: 'compromise',
            targetOptions: secondarySupplier ? [secondarySupplier] : [arcRef],
            expectedEffects: ['replace mushrooms with stew', 'food safety steady'],
          },
          {
            id: 'embrace_blight_branding',
            labelHint: 'Embrace blight branding',
            allowedVerbs: ['rebrand'],
            shape: 'reputation_play',
            targetOptions: primaryCulture ? [primaryCulture] : [arcRef],
            expectedEffects: ['lean into goblin authenticity', 'lock identity'],
          },
          {
            id: 'ration_supply',
            labelHint: 'Ration the mushroom supply',
            allowedVerbs: ['delay'],
            shape: 'safe_costly',
            targetOptions: [arcSlotRef],
            expectedEffects: ['stretch stock', 'customer dissatisfaction'],
          },
          {
            id: 'ignore_warning',
            labelHint: 'Ignore the blight warning',
            allowedVerbs: ['ignore'],
            shape: 'ignore',
            targetOptions: [],
            expectedEffects: ['no cost', 'shortage spirals'],
          },
        ],
        consequenceProfiles: [
          makeProfile({
            id: 'lock_in_cheap_mushrooms_profile',
            responseSlotId: 'lock_in_cheap_mushrooms',
            immediateEffects: [
              effect('state_change', 'stock.mushrooms.quantity', 30, 'Mushroom glut buys time', [
                'stock',
              ]),
              effect('state_change', 'coin', -20, 'Bulk buy upfront', ['coin']),
              effect('pressure', 'pressure:market_instability', -8, 'Locked supply steadies market', [
                'pressure',
              ]),
              ...(primarySupplier
                ? [
                    effect(
                      'cause',
                      `supplier:${primarySupplier.id}`,
                      10,
                      'Supplier promised volume',
                      ['supplier', 'fair_deal', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:food_safety', 4, 'Cheap stock requires care', [
                'pressure',
              ]),
              effect(
                'future_hook',
                `cheap_supply_glut_${arcKey}`,
                10,
                'Glut may rot before sold',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_blight_lockin_${arcKey}`,
                actors: primarySupplier ? [arcRef, primarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'fair_deal', 'paid_on_time', 'attribution'],
              },
              {
                id: `tavern_blight_lockin_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'investment'],
              },
            ],
            futureHooks: [
              {
                id: `cheap_supply_glut_${arcKey}`,
                actors: primarySupplier ? [arcRef, primarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'swap_to_substitute_stew_profile',
            responseSlotId: 'swap_to_substitute_stew',
            immediateEffects: [
              effect('state_change', 'stock.stew.quantity', 20, 'Stew replaces lost mushrooms', [
                'stock',
              ]),
              effect('state_change', 'stock.mushrooms.quantity', -10, 'Trim blight-exposed mushrooms', [
                'stock',
              ]),
              effect('pressure', 'pressure:food_safety', -6, 'Substitute is safer', ['pressure']),
              ...(secondarySupplier
                ? [
                    effect(
                      'cause',
                      `supplier:${secondarySupplier.id}`,
                      8,
                      'Substitute supplier gains business',
                      ['supplier', 'fair_deal', 'attribution'],
                    ),
                  ]
                : []),
              effect('pressure', 'pressure:arc_escalation', -6, 'Crisis substitution noted', [
                'pressure',
              ]),
            ],
            delayedEffects: [],
            memories: [
              {
                id: `arc_blight_substitute_${arcKey}`,
                actors: secondarySupplier ? [arcRef, secondarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'fair_deal', 'attribution'],
              },
              ...(secondarySupplier
                ? [
                    {
                      id: `supplier_substitute_${secondarySupplier.id}`,
                      actors: [secondarySupplier],
                      tags: ['supplier', 'opportunity', 'fair_deal'],
                    },
                  ]
                : []),
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'embrace_blight_branding_profile',
            responseSlotId: 'embrace_blight_branding',
            immediateEffects: [
              effect('state_change', 'reputation.goblinAuthentic', 8, 'Blight becomes branding', [
                'reputation',
              ]),
              effect('state_change', 'reputation.respectable', -5, 'Genteel crowd recoils', [
                'reputation',
              ]),
              ...(primaryCulture
                ? [
                    effect(
                      'cause',
                      `culture:${primaryCulture.id}`,
                      6,
                      'Local culture leans in',
                      ['culture', 'attribution'],
                    ),
                  ]
                : []),
              effect('pressure', 'pressure:cultural_tension', 6, 'Outsiders unsure', ['pressure']),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `blight_brand_lock_${arcKey}`,
                12,
                'Brand may lock in long-term',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_blight_brand_${arcKey}`,
                actors: primaryCulture ? [arcRef, primaryCulture] : [arcRef],
                tags: ['arc', 'culture', 'reputation', 'attribution'],
              },
              {
                id: `tavern_blight_branded_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'reputation'],
              },
            ],
            futureHooks: [
              {
                id: `blight_brand_lock_${arcKey}`,
                actors: primaryCulture ? [arcRef, primaryCulture] : [arcRef],
                tags: ['arc', 'culture', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'ration_supply_profile',
            responseSlotId: 'ration_supply',
            immediateEffects: [
              effect('pressure', 'pressure:stock_shortage', -10, 'Rationing stretches supply', [
                'pressure',
              ]),
              effect('state_change', 'customers.local_goblins.satisfaction', -6, 'Goblins grumble', [
                'customer',
              ]),
              effect('state_change', 'staff.cook.morale', -4, 'Cook hates rationing', ['staff']),
            ],
            delayedEffects: [],
            memories: [
              {
                id: `arc_blight_ration_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'compromise'],
              },
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'ignore_warning_profile',
            responseSlotId: 'ignore_warning',
            immediateEffects: [],
            delayedEffects: [
              effect('pressure', 'pressure:stock_shortage', 12, 'Shortage worsens', ['pressure']),
              effect('pressure', 'pressure:food_safety', 6, 'Bad stock served anyway', [
                'pressure',
              ]),
              effect('pressure', 'pressure:arc_escalation', 10, 'Arc spirals', ['pressure']),
            ],
            memories: [
              {
                id: `arc_blight_ignored_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'ignored'],
              },
            ],
            futureHooks: [
              {
                id: `arc_failure_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk', 'failure'],
              },
            ],
          }),
        ],
      }

    case 'miner_payday_boom':
      return {
        extraAffected: [
          ...(primarySupplier ? [primarySupplier] : []),
          ...(primaryFaction ? [primaryFaction] : []),
          ...(secondaryFaction ? [secondaryFaction] : []),
        ],
        responseSlots: [
          {
            id: 'prep_extra_ale',
            labelHint: 'Pre-order extra ale',
            allowedVerbs: ['buy', 'negotiate'],
            shape: 'safe_costly',
            targetOptions: primarySupplier ? [primarySupplier] : [arcRef],
            expectedEffects: ['stock up ale', 'spend coin'],
          },
          {
            id: 'raise_prices_for_boom',
            labelHint: 'Raise prices for the boom',
            allowedVerbs: ['raise_price'],
            shape: 'risky_profitable',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise margin', 'miners feel gouged'],
          },
          {
            id: 'hire_security_for_night',
            labelHint: 'Hire security for the night',
            allowedVerbs: ['pay'],
            shape: 'safe_costly',
            targetOptions: secondaryFaction ? [secondaryFaction] : [arcRef],
            expectedEffects: ['lower violence', 'spend coin'],
          },
          {
            id: 'let_it_brawl',
            labelHint: 'Let the night go wild',
            allowedVerbs: ['ignore', 'rebrand'],
            shape: 'reputation_play',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise dangerous rep', 'damage rises'],
          },
          {
            id: 'ignore_warning',
            labelHint: 'Ignore the boom',
            allowedVerbs: ['ignore'],
            shape: 'ignore',
            targetOptions: [],
            expectedEffects: ['no cost', 'miners may overrun'],
          },
        ],
        consequenceProfiles: [
          makeProfile({
            id: 'prep_extra_ale_profile',
            responseSlotId: 'prep_extra_ale',
            immediateEffects: [
              effect('state_change', 'stock.ale.quantity', 40, 'Cellars overflow', ['stock']),
              effect('state_change', 'coin', -20, 'Bulk ale costs', ['coin']),
              effect('state_change', 'staff.cook.fatigue', 6, 'Crew braced for big night', [
                'staff',
              ]),
              ...(primarySupplier
                ? [
                    effect(
                      'cause',
                      `supplier:${primarySupplier.id}`,
                      10,
                      'Brewer earns a big order',
                      ['supplier', 'fair_deal', 'paid_on_time', 'attribution'],
                    ),
                  ]
                : []),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      8,
                      'Miners union notices the prep',
                      ['faction', 'hosted_event', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `payday_supplier_return_${arcKey}`,
                10,
                'Supplier expects standing demand',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_payday_prepped_${arcKey}`,
                actors: primarySupplier ? [arcRef, primarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'fair_deal', 'paid_on_time', 'attribution'],
              },
              ...(primaryFaction
                ? [
                    {
                      id: `arc_payday_faction_${primaryFaction.id}`,
                      actors: [primaryFaction],
                      tags: ['faction', 'hosted_event', 'attribution'],
                    },
                  ]
                : []),
            ],
            futureHooks: [
              {
                id: `payday_supplier_return_${arcKey}`,
                actors: primarySupplier ? [primarySupplier] : [arcRef],
                tags: ['supplier', 'opportunity'],
              },
            ],
          }),
          makeProfile({
            id: 'raise_prices_for_boom_profile',
            responseSlotId: 'raise_prices_for_boom',
            immediateEffects: [
              effect('state_change', 'coin', 30, 'Premium payday prices', ['coin']),
              effect('state_change', 'reputation.cheap', -10, 'No longer the cheap pour', [
                'reputation',
              ]),
              effect('pressure', 'pressure:regular_customer_loss', 12, 'Miners feel gouged', [
                'pressure',
              ]),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      -10,
                      'Miners union takes offence',
                      ['faction', 'grudge', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `payday_gouging_remembered_${arcKey}`,
                12,
                'Next payday may boycott',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_payday_gouged_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'grudge', 'attribution'],
              },
              {
                id: `tavern_payday_priced_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'reputation'],
              },
            ],
            futureHooks: [
              {
                id: `payday_gouging_remembered_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'hire_security_for_night_profile',
            responseSlotId: 'hire_security_for_night',
            immediateEffects: [
              effect('pressure', 'pressure:violence', -15, 'Bouncers cool the room', ['pressure']),
              effect('state_change', 'coin', -15, 'Security wages', ['coin']),
              ...(secondaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${secondaryFaction.id}`,
                      6,
                      'Town watch appreciates the hire',
                      ['faction', 'hosted_event', 'attribution'],
                    ),
                  ]
                : []),
              effect('pressure', 'pressure:rumour_pressure', -4, 'Calm night quiets rumours', [
                'pressure',
              ]),
            ],
            delayedEffects: [],
            memories: [
              {
                id: `arc_payday_security_${arcKey}`,
                actors: secondaryFaction ? [arcRef, secondaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'attribution'],
              },
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'let_it_brawl_profile',
            responseSlotId: 'let_it_brawl',
            immediateEffects: [
              effect('state_change', 'reputation.dangerous', 8, 'Rowdy night brands the place', [
                'reputation',
              ]),
              effect('state_change', 'reputation.respectable', -6, 'Merchants leave early', [
                'reputation',
              ]),
              effect('pressure', 'pressure:violence', 8, 'Brawl spills', ['pressure']),
              effect('state_change', `areas.${pickRepairableArea(ctx, 'staff_identity_brawl').id}.damage`, 6, 'Broken stools', ['area']),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:rumour_pressure', 8, 'Word of the brawl spreads', [
                'pressure',
              ]),
              effect(
                'future_hook',
                `payday_brawl_legend_${arcKey}`,
                10,
                'Legend of the night may grow',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_payday_brawl_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'violence'],
              },
              ...(primaryCulture
                ? [
                    {
                      id: `arc_payday_culture_${primaryCulture.id}`,
                      actors: [primaryCulture],
                      tags: ['culture', 'memory'],
                    },
                  ]
                : []),
            ],
            futureHooks: [
              {
                id: `payday_brawl_legend_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'reputation'],
              },
            ],
          }),
          makeProfile({
            id: 'ignore_warning_profile',
            responseSlotId: 'ignore_warning',
            immediateEffects: [],
            delayedEffects: [
              effect('pressure', 'pressure:violence', 10, 'Violence rises unchecked', ['pressure']),
              effect('pressure', 'pressure:regular_customer_loss', 6, 'Regulars drift', ['pressure']),
              effect('pressure', 'pressure:arc_escalation', 10, 'Boom spirals', ['pressure']),
            ],
            memories: [
              {
                id: `arc_payday_ignored_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'ignored'],
              },
            ],
            futureHooks: [
              {
                id: `arc_failure_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk', 'failure'],
              },
            ],
          }),
        ],
      }

    case 'inspection_campaign':
      return {
        extraAffected: [
          ...(primaryFaction ? [primaryFaction] : []),
          ...(secondaryFaction ? [secondaryFaction] : []),
        ],
        responseSlots: [
          {
            id: 'deep_clean_all_areas',
            labelHint: 'Deep-clean every area',
            allowedVerbs: ['clean'],
            shape: 'long_term_investment',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise cleanliness', 'cost coin and crew time'],
          },
          {
            id: 'proactive_inspector_invite',
            labelHint: 'Invite inspectors over for a walkthrough',
            allowedVerbs: ['invite'],
            shape: 'safe_costly',
            targetOptions: primaryFaction ? [primaryFaction] : [arcRef],
            expectedEffects: ['lower inspection', 'time and ale cost'],
          },
          {
            id: 'bribe_the_campaign',
            labelHint: 'Bribe the campaign organiser',
            allowedVerbs: ['bribe'],
            shape: 'deception',
            targetOptions: primaryFaction ? [primaryFaction] : [arcRef],
            expectedEffects: ['stall inspections', 'risk corruption'],
          },
          {
            id: 'petition_local_shrine',
            labelHint: 'Petition the local shrine for support',
            allowedVerbs: ['negotiate'],
            shape: 'compromise',
            targetOptions: secondaryFaction ? [secondaryFaction] : [arcRef],
            expectedEffects: ['mild inspection relief', 'shrine owed favour'],
          },
          {
            id: 'ignore_warning',
            labelHint: 'Ignore the campaign',
            allowedVerbs: ['ignore'],
            shape: 'ignore',
            targetOptions: [],
            expectedEffects: ['no cost', 'inspection pressure climbs'],
          },
        ],
        consequenceProfiles: [
          makeProfile({
            id: 'deep_clean_all_areas_profile',
            responseSlotId: 'deep_clean_all_areas',
            immediateEffects: [
              effect('state_change', 'areas.kitchen.cleanliness', 20, 'Kitchen scrubbed', ['area']),
              effect('state_change', 'areas.privy.cleanliness', 20, 'Privy scoured', ['area']),
              effect('state_change', 'areas.main_room.cleanliness', 15, 'Main room polished', [
                'area',
              ]),
              effect('state_change', 'coin', -25, 'Cleaning supplies', ['coin']),
              effect('pressure', 'pressure:inspection', -20, 'Inspection risk drops', ['pressure']),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      12,
                      'Town watch notices the cleanup',
                      ['faction', 'hosted_event', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [],
            memories: [
              {
                id: `arc_inspection_deep_clean_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'attribution'],
              },
              {
                id: `tavern_inspection_clean_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'standards'],
              },
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'proactive_inspector_invite_profile',
            responseSlotId: 'proactive_inspector_invite',
            immediateEffects: [
              effect('pressure', 'pressure:inspection', -15, 'Walkthrough builds trust', [
                'pressure',
              ]),
              effect('state_change', 'reputation.respectable', 8, 'Honest tavern signal', [
                'reputation',
              ]),
              effect('state_change', 'coin', -8, 'Hospitality cost', ['coin']),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      15,
                      'Inspectors leave warmer',
                      ['faction', 'hosted_event', 'honoured_discount', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `inspector_advisor_${arcKey}`,
                10,
                'Inspector may become an ally',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_inspector_walkthrough_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'attribution'],
              },
            ],
            futureHooks: [
              {
                id: `inspector_advisor_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'opportunity'],
              },
            ],
          }),
          makeProfile({
            id: 'bribe_the_campaign_profile',
            responseSlotId: 'bribe_the_campaign',
            immediateEffects: [
              effect('state_change', 'coin', -40, 'Heavy bribe', ['coin']),
              effect('pressure', 'pressure:inspection', -12, 'Stall the campaign', ['pressure']),
              effect('pressure', 'pressure:cultural_tension', 10, 'Word leaks', ['pressure']),
              effect('pressure', 'pressure:rumour_pressure', 8, 'Bribery whispers', ['pressure']),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      -10,
                      'Some inspectors disgusted',
                      ['faction', 'grudge', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `inspection_bribe_exposed_${arcKey}`,
                14,
                'Bribe may be exposed',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_inspection_bribe_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'grudge', 'attribution'],
              },
              {
                id: `tavern_bribed_campaign_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'deception'],
              },
            ],
            futureHooks: [
              {
                id: `inspection_bribe_exposed_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'risk', 'corruption'],
              },
            ],
          }),
          makeProfile({
            id: 'petition_local_shrine_profile',
            responseSlotId: 'petition_local_shrine',
            immediateEffects: [
              effect('pressure', 'pressure:inspection', -6, 'Shrine letter eases pressure', [
                'pressure',
              ]),
              ...(secondaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${secondaryFaction.id}`,
                      8,
                      'Shrine appreciates the deference',
                      ['faction', 'honoured_discount', 'attribution'],
                    ),
                  ]
                : []),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      4,
                      'Watch respects the ritual gesture',
                      ['faction', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `shrine_favour_owed_${arcKey}`,
                8,
                'Shrine will call the favour',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_inspection_shrine_${arcKey}`,
                actors: secondaryFaction ? [arcRef, secondaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'honoured_discount', 'attribution'],
              },
            ],
            futureHooks: [
              {
                id: `shrine_favour_owed_${arcKey}`,
                actors: secondaryFaction ? [secondaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'debt'],
              },
            ],
          }),
          makeProfile({
            id: 'ignore_warning_profile',
            responseSlotId: 'ignore_warning',
            immediateEffects: [],
            delayedEffects: [
              effect('pressure', 'pressure:inspection', 15, 'Inspection unchecked', ['pressure']),
              effect('pressure', 'pressure:food_safety', 6, 'No deep clean', ['pressure']),
              effect('pressure', 'pressure:arc_escalation', 10, 'Arc spirals', ['pressure']),
            ],
            memories: [
              {
                id: `arc_inspection_ignored_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'ignored'],
              },
            ],
            futureHooks: [
              {
                id: `arc_failure_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk', 'failure'],
              },
            ],
          }),
        ],
      }

    case 'rival_tavern_expansion':
      return {
        extraAffected: [
          ...(primarySupplier ? [primarySupplier] : []),
          ...(primaryFaction ? [primaryFaction] : []),
        ],
        responseSlots: [
          {
            id: 'compete_on_quality',
            labelHint: 'Compete on quality',
            allowedVerbs: ['upgrade'],
            shape: 'long_term_investment',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise ale quality', 'spend coin'],
          },
          {
            id: 'compete_on_price',
            labelHint: 'Undercut their prices',
            allowedVerbs: ['lower_price'],
            shape: 'risky_profitable',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise cheap rep', 'tight margins'],
          },
          {
            id: 'poach_their_regulars',
            labelHint: 'Poach their regulars',
            allowedVerbs: ['invite', 'rebrand'],
            shape: 'escalation',
            targetOptions: [arcSlotRef],
            expectedEffects: ['gain patronage', 'rival retaliates'],
          },
          {
            id: 'partner_with_caravan_circle',
            labelHint: 'Partner with the caravan circle',
            allowedVerbs: ['negotiate'],
            shape: 'compromise',
            targetOptions: primaryFaction ? [primaryFaction] : [arcRef],
            expectedEffects: ['stabilise supply', 'owe faction'],
          },
          {
            id: 'ignore_warning',
            labelHint: 'Ignore the rival',
            allowedVerbs: ['ignore'],
            shape: 'ignore',
            targetOptions: [],
            expectedEffects: ['no cost', 'rival eats market'],
          },
        ],
        consequenceProfiles: [
          makeProfile({
            id: 'compete_on_quality_profile',
            responseSlotId: 'compete_on_quality',
            immediateEffects: [
              effect('state_change', 'stock.ale.quality', 10, 'Better ale on tap', ['stock']),
              effect('state_change', 'coin', -20, 'Quality costs', ['coin']),
              effect('state_change', 'reputation.respectable', 6, 'Word of quality spreads', [
                'reputation',
              ]),
              effect('pressure', 'pressure:regular_customer_loss', -10, 'Regulars stay', [
                'pressure',
              ]),
              effect('pressure', 'pressure:rival_tavern_pressure', -8, 'Rival noted', ['pressure']),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `quality_arms_race_${arcKey}`,
                12,
                'Rival may match quality',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_rival_quality_${arcKey}`,
                actors: primarySupplier ? [arcRef, primarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'fair_deal', 'attribution'],
              },
              {
                id: `tavern_quality_push_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'investment'],
              },
            ],
            futureHooks: [
              {
                id: `quality_arms_race_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'compete_on_price_profile',
            responseSlotId: 'compete_on_price',
            immediateEffects: [
              effect('state_change', 'stock.ale.salePrice', -1, 'Lower price per pour', [
                'stock',
              ]),
              effect('state_change', 'coin', -15, 'Margins thin out', ['coin']),
              effect('state_change', 'reputation.cheap', 6, 'Known for cheap pours', [
                'reputation',
              ]),
              effect('pressure', 'pressure:market_instability', 6, 'Price war signal', [
                'pressure',
              ]),
              effect('pressure', 'pressure:regular_customer_loss', -8, 'Regulars stay', [
                'pressure',
              ]),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `price_war_${arcKey}`,
                10,
                'Rival may slash too',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_rival_price_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'reputation'],
              },
            ],
            futureHooks: [
              {
                id: `price_war_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'poach_their_regulars_profile',
            responseSlotId: 'poach_their_regulars',
            immediateEffects: [
              effect('state_change', 'customers.adventurers.patronage', 10, 'Adventurers walk in', [
                'customer',
              ]),
              effect('pressure', 'pressure:rumour_pressure', 8, 'Sharp gossip flies', ['pressure']),
              effect('pressure', 'pressure:rival_tavern_pressure', -10, 'Rival short on table', [
                'pressure',
              ]),
              effect('state_change', 'reputation.dangerous', 4, 'Aggressive owner signal', [
                'reputation',
              ]),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `rival_retaliation_${arcKey}`,
                14,
                'Rival will hit back',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_rival_poach_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'grudge'],
              },
              {
                id: `tavern_poached_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'escalation'],
              },
            ],
            futureHooks: [
              {
                id: `rival_retaliation_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'partner_with_caravan_circle_profile',
            responseSlotId: 'partner_with_caravan_circle',
            immediateEffects: [
              effect('pressure', 'pressure:rival_tavern_pressure', -8, 'Caravan supplies tilt our way', [
                'pressure',
              ]),
              effect('state_change', 'coin', -10, 'Partnership setup', ['coin']),
              ...(primarySupplier
                ? [
                    effect(
                      'state_change',
                      `world.suppliers.${primarySupplier.id}.reliability`,
                      5,
                      'Supplier reliability climbs',
                      ['supplier'],
                    ),
                  ]
                : []),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      12,
                      'Caravan circle backs the tavern',
                      ['faction', 'hosted_event', 'honoured_discount', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:faction_anger', -5, 'Caravan circle relaxes', [
                'pressure',
              ]),
            ],
            memories: [
              {
                id: `arc_rival_caravan_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'attribution'],
              },
              ...(primarySupplier
                ? [
                    {
                      id: `arc_rival_supplier_${primarySupplier.id}`,
                      actors: [primarySupplier],
                      tags: ['supplier', 'fair_deal', 'attribution'],
                    },
                  ]
                : []),
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'ignore_warning_profile',
            responseSlotId: 'ignore_warning',
            immediateEffects: [],
            delayedEffects: [
              effect('pressure', 'pressure:rival_tavern_pressure', 12, 'Rival eats market', [
                'pressure',
              ]),
              effect('pressure', 'pressure:regular_customer_loss', 6, 'Regulars drift', ['pressure']),
              effect('pressure', 'pressure:arc_escalation', 10, 'Arc spirals', ['pressure']),
            ],
            memories: [
              {
                id: `arc_rival_ignored_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'ignored'],
              },
            ],
            futureHooks: [
              {
                id: `arc_failure_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk', 'failure'],
              },
            ],
          }),
        ],
      }

    case 'festival_approaching':
    default:
      return {
        extraAffected: [
          ...(primaryFaction ? [primaryFaction] : []),
          ...(primarySupplier ? [primarySupplier] : []),
          ...(primaryCulture ? [primaryCulture] : []),
        ],
        responseSlots: [
          {
            id: 'prepare_for_arc',
            labelHint: 'Prepare for the festival',
            allowedVerbs: ['upgrade', 'buy'],
            shape: 'long_term_investment',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise readiness', 'spend coin'],
          },
          {
            id: 'host_festival_event',
            labelHint: 'Host a festival event',
            allowedVerbs: ['invite', 'rebrand'],
            shape: 'risky_profitable',
            targetOptions: primaryFaction ? [primaryFaction] : [arcRef],
            expectedEffects: ['big payday', 'big obligation'],
          },
          {
            id: 'exploit_arc',
            labelHint: 'Exploit the moment',
            allowedVerbs: ['raise_price', 'rebrand'],
            shape: 'risky_profitable',
            targetOptions: [arcSlotRef],
            expectedEffects: ['raise margin', 'shrine disapproves'],
          },
          {
            id: 'ask_supplier_help',
            labelHint: 'Ask a supplier for help',
            allowedVerbs: ['negotiate'],
            shape: 'compromise',
            targetOptions: primarySupplier ? [primarySupplier] : [arcRef],
            expectedEffects: ['secure stock', 'owe favour'],
          },
          {
            id: 'ask_faction_help',
            labelHint: 'Ask a faction for help',
            allowedVerbs: ['negotiate'],
            shape: 'relationship_sacrifice',
            targetOptions: primaryFaction ? [primaryFaction] : [arcRef],
            expectedEffects: ['secure help', 'owe debt'],
          },
          {
            id: 'ignore_warning',
            labelHint: 'Ignore the festival',
            allowedVerbs: ['ignore'],
            shape: 'ignore',
            targetOptions: [],
            expectedEffects: ['no cost', 'festival passes us by'],
          },
        ],
        consequenceProfiles: [
          makeProfile({
            id: 'prepare_for_arc_profile',
            responseSlotId: 'prepare_for_arc',
            immediateEffects: [
              effect('pressure', 'pressure:festival_readiness', -15, 'Readiness climbs', [
                'pressure',
              ]),
              effect('state_change', 'coin', -20, 'Preparation cost', ['coin']),
              effect('pressure', 'pressure:arc_escalation', -8, 'Arc pressure eases', ['pressure']),
              effect('state_change', 'reputation.reliable', 8, 'Tavern prepared for the moment', [
                'reputation',
              ]),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      8,
                      'Shrine notices the prep',
                      ['faction', 'hosted_event', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [],
            memories: [
              {
                id: `arc_prepared_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'preparation', 'investment', 'attribution'],
              },
              {
                id: `tavern_festival_prep_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'investment'],
              },
            ],
            futureHooks: [],
          }),
          makeProfile({
            id: 'host_festival_event_profile',
            responseSlotId: 'host_festival_event',
            immediateEffects: [
              effect('state_change', 'coin', 30, 'Festival night earnings', ['coin']),
              effect('pressure', 'pressure:festival_readiness', -20, 'Festival becomes ours', [
                'pressure',
              ]),
              effect('state_change', 'reputation.respectable', 8, 'Hospitable reputation grows', [
                'reputation',
              ]),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      12,
                      'Shrine elevated as patron',
                      ['faction', 'hosted_event', 'honoured_discount', 'attribution'],
                    ),
                  ]
                : []),
              effect('state_change', 'staff.cook.fatigue', 8, 'Long night for the crew', ['staff']),
            ],
            delayedEffects: [
              effect(
                'future_hook',
                `festival_obligations_${arcKey}`,
                12,
                'Festival sets a yearly expectation',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_festival_hosted_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'attribution'],
              },
              {
                id: `tavern_hosted_festival_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'reputation'],
              },
              ...(primaryCulture
                ? [
                    {
                      id: `arc_festival_culture_${primaryCulture.id}`,
                      actors: [primaryCulture],
                      tags: ['culture', 'memory'],
                    },
                  ]
                : []),
            ],
            futureHooks: [
              {
                id: `festival_obligations_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'faction'],
              },
            ],
          }),
          makeProfile({
            id: 'exploit_arc_profile',
            responseSlotId: 'exploit_arc',
            immediateEffects: [
              effect('state_change', 'coin', 20, 'Premium prices', ['coin']),
              effect('state_change', 'reputation.cheap', -10, 'No longer feels affordable', [
                'reputation',
              ]),
              effect('pressure', 'pressure:rumour_pressure', 6, 'Shrine gossip travels', [
                'pressure',
              ]),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      -8,
                      'Shrine disapproves',
                      ['faction', 'grudge', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:regular_customer_loss', 10, 'Regulars feel gouged', [
                'pressure',
              ]),
              effect(
                'future_hook',
                `arc_exploit_backlash_${arcKey}`,
                12,
                'Reputation backlash possible',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_exploited_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'exploit', 'risky', 'grudge', 'attribution'],
              },
              {
                id: `tavern_exploited_festival_${arcKey}`,
                actors: [arcRef, tavernSelf],
                tags: ['tavern_identity', 'memory', 'reputation'],
              },
            ],
            futureHooks: [
              {
                id: `arc_exploit_backlash_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'risk'],
              },
            ],
          }),
          makeProfile({
            id: 'ask_supplier_help_profile',
            responseSlotId: 'ask_supplier_help',
            immediateEffects: [
              effect('pressure', 'pressure:festival_readiness', -12, 'Stock secured for arc', [
                'pressure',
              ]),
              effect('pressure', 'pressure:stock_shortage', -8, 'Stock pressure eases', [
                'pressure',
              ]),
              ...(primarySupplier
                ? [
                    effect(
                      'cause',
                      `supplier:${primarySupplier.id}`,
                      10,
                      'Supplier earns the festival order',
                      ['supplier', 'fair_deal', 'paid_on_time', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:supplier_distrust', 5, 'Owed favour shifts balance', [
                'pressure',
              ]),
              effect(
                'future_hook',
                `arc_supplier_favour_owed_${arcKey}`,
                10,
                'Favour will be called in',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_supplier_helped_${arcKey}`,
                actors: primarySupplier ? [arcRef, primarySupplier] : [arcRef],
                tags: ['arc', 'supplier', 'fair_deal', 'attribution'],
              },
            ],
            futureHooks: [
              {
                id: `arc_supplier_favour_owed_${arcKey}`,
                actors: primarySupplier ? [primarySupplier] : [arcRef],
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
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      10,
                      'Faction lends face',
                      ['faction', 'hosted_event', 'attribution'],
                    ),
                  ]
                : []),
            ],
            delayedEffects: [
              effect('pressure', 'pressure:faction_anger', 8, 'Debt to faction simmers', [
                'pressure',
              ]),
              effect(
                'future_hook',
                `arc_faction_debt_${arcKey}`,
                12,
                'Faction will demand repayment',
                ['future_hook'],
              ),
            ],
            memories: [
              {
                id: `arc_faction_helped_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'hosted_event', 'debt', 'attribution'],
              },
            ],
            futureHooks: [
              {
                id: `arc_faction_debt_${arcKey}`,
                actors: primaryFaction ? [primaryFaction] : [arcRef],
                tags: ['arc', 'faction', 'debt'],
              },
            ],
          }),
          makeProfile({
            id: 'ignore_warning_profile',
            responseSlotId: 'ignore_warning',
            immediateEffects: [],
            delayedEffects: [
              effect('pressure', 'pressure:festival_readiness', 15, 'Readiness collapses', [
                'pressure',
              ]),
              effect('pressure', 'pressure:arc_escalation', 12, 'Arc spirals', ['pressure']),
              effect('state_change', 'reputation.reliable', -10, 'Reputation suffers', [
                'reputation',
              ]),
              ...(primaryFaction
                ? [
                    effect(
                      'cause',
                      `faction:${primaryFaction.id}`,
                      -8,
                      'Shrine remembers the snub',
                      ['faction', 'grudge', 'attribution'],
                    ),
                  ]
                : []),
            ],
            memories: [
              {
                id: `arc_ignored_${arcKey}`,
                actors: primaryFaction ? [arcRef, primaryFaction] : [arcRef],
                tags: ['arc', 'ignored', 'grudge'],
              },
            ],
            futureHooks: [
              {
                id: `arc_failure_${arcKey}`,
                actors: [arcRef],
                tags: ['arc', 'risk', 'failure'],
              },
            ],
          }),
        ],
      }
  }
}

function pickAnticipationTheme(ctx: SimContext): SeasonalArcTheme | undefined {
  const tags = ctx.state.calendar.tags ?? []
  const dayType = ctx.state.calendar.dayType
  const inspection = pressureSnapshotById(ctx, 'inspection')
  const rival = pressureSnapshotById(ctx, 'rival_tavern_pressure')
  // Market conditions live on the supplier module slice.
  const supplierSlice = ctx.state.modules['suppliers'] as
    | {
        activeMarketConditions?: Array<{ id: string; tags: string[] }>
      }
    | undefined
  const marketConditionIds = (supplierSlice?.activeMarketConditions ?? []).map(
    (c) => c.id,
  )

  if (tags.includes('festival_window') || tags.includes('mushroom_festival'))
    return 'festival_approaching'
  if (
    marketConditionIds.includes('cheap_mushrooms') ||
    tags.includes('winter_shortage_risk')
  )
    return 'mushroom_blight'
  if (tags.includes('miner_payday') || dayType === 'payday') return 'miner_payday_boom'
  if (tags.includes('inspection_window') || (inspection?.value ?? 0) > 50)
    return 'inspection_campaign'
  if (
    (rival?.value ?? 0) > 25 ||
    tags.includes('merchant_traffic') ||
    dayType === 'market_day'
  )
    return 'rival_tavern_expansion'
  if (tags.includes('road_danger_risk') || marketConditionIds.includes('road_bandits'))
    return 'mushroom_blight'
  return undefined
}

function generateSeasonalArc(ctx: SimContext): IssueSeed[] {
  const arcs = listActiveArcs(ctx.state)
  const escalation = pressureSnapshotById(ctx, 'arc_escalation')
  const festival = pressureSnapshotById(ctx, 'festival_readiness')
  const today = ctx.state.calendar.totalDaysElapsed

  // Path A — active arc present. Pick the most "interesting" arc by
  // intensity + stage with the existing recency rotation.
  let arcRef: EntityRef
  let arcKey: string
  let arcLabel: string
  let arcStage: string
  let arcIntensity: number
  let theme: SeasonalArcTheme
  let anticipation = false
  if (arcs.length > 0) {
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
    arcRef = localArcRef(chosen.id)
    const guard = activeArcExistsGuard(ctx, arcRef)
    if (!guard.allowed) return []
    recordPick(ctx, 'seasonal_arc', `local_event:${chosen.id}`)
    arcKey = chosen.id
    arcLabel = chosen.label
    arcStage = chosen.stage ?? 'unknown'
    arcIntensity = chosen.intensity ?? 30
    const def = chosen.definitionId as SeasonalArcTheme | string
    theme = (
      ['mushroom_blight', 'miner_payday_boom', 'inspection_campaign', 'rival_tavern_expansion', 'festival_approaching'] as const
    ).includes(def as SeasonalArcTheme)
      ? (def as SeasonalArcTheme)
      : 'festival_approaching'
  } else {
    // Path B — anticipation. No active arc yet, but calendar tags and
    // market conditions signal an archetype is on the way. Emit a
    // structured seed keyed on the predicted theme so seasonal_arc
    // produces real content during card-readiness runs.
    const predicted = pickAnticipationTheme(ctx)
    if (!predicted) return []
    // Recency rotation across themes so anticipation seeds rotate.
    const key = `anticipation:${predicted}`
    if (recencyPenalty(ctx.state, 'seasonal_arc_anticipation', key, today) > 0) {
      return []
    }
    recordPick(ctx, 'seasonal_arc_anticipation', key)
    arcRef = localArcRef(predicted)
    arcKey = predicted
    arcLabel = `${SEASONAL_ARC_LABELS[predicted]} (anticipated)`
    arcStage = 'anticipation'
    arcIntensity = 25
    theme = predicted
    anticipation = true
  }

  const causes: CauseEntry[] = []
  for (const c of recentCauseEntries(
    ctx,
    ['arc', 'local_arc', arcKey, theme, 'festival'],
    14,
    4,
  )) {
    causes.push(c)
  }
  causes.push(...pressureCauseRefsAsEntries(ctx, 'arc_escalation', 2))
  causes.push(...pressureCauseRefsAsEntries(ctx, 'festival_readiness', 2))
  if (causes.length === 0) {
    // Phase 40 audit pass 2 §6 — Arc engines emit `local_arc` causes only
    // when an arc starts, progresses, or resolves. Between those beats,
    // both anticipation seeds and live-arc seeds need a synthetic cause
    // so the seed validator (causes.length > 0) doesn't reject them.
    causes.push({
      id: `${anticipation ? 'anticipation' : 'arc'}-${theme}-d${today}`,
      timestamp: {
        year: ctx.state.calendar.year,
        month: ctx.state.calendar.month,
        week: ctx.state.calendar.week,
        day: ctx.state.calendar.day,
        absoluteDay: today,
      },
      source: `seasonal_arc.${theme}`,
      sourceType: 'system',
      target: `arc:${theme}`,
      targetType: 'global',
      amount: 5,
      direction: 'neutral',
      weight: 5,
      readable: anticipation
        ? `Calendar signals ${SEASONAL_ARC_LABELS[theme]} is coming`
        : `${SEASONAL_ARC_LABELS[theme]} is unfolding`,
      tags: ['arc', anticipation ? 'anticipation' : 'active', theme],
      relatedActors: [arcRef],
      relatedLocations: [],
      relatedSystems: ['calendar', 'world'],
      ageDays: 0,
    })
  }

  // Slot-target ref: in active-arc mode arcRef resolves; in
  // anticipation mode swap to systemRef('arc') so target validation
  // passes. Profile memories still use arcRef for the local_event label.
  const arcSlotRef = anticipation ? systemRef('arc') : arcRef
  const { responseSlots, consequenceProfiles, extraAffected } = buildSeasonalArcContent(
    ctx,
    theme,
    arcRef,
    arcKey,
    arcSlotRef,
  )

  const arcContext: string[] = [`stage ${arcStage}`]
  if (escalation) arcContext.push(`escalation ${escalation.value}`)
  if (festival) arcContext.push(`readiness ${festival.value}`)
  if (anticipation) arcContext.push('anticipation seed')

  // Phase 40 audit pass 2 §6 — The seed validator requires the
  // `primaryActor` to resolve as a local_event when the family is
  // seasonal_arc (see issueSeedValidation.ts §6). For anticipation
  // seeds the arc is a theme, not an instantiated local_event, so we
  // omit primaryActor entirely and put a real archetype actor on
  // affectedActors. For path A (active arc) we keep primaryActor=arcRef.
  const primaryArcActor =
    extraAffected.find((r) => r.kind === 'faction') ??
    extraAffected.find((r) => r.kind === 'supplier') ??
    extraAffected[0]
  const seedPrimary = anticipation ? undefined : arcRef
  const seedAffected: EntityRef[] = anticipation
    ? dedupeRefs(extraAffected, undefined)
    : primaryArcActor
      ? dedupeRefs([primaryArcActor], arcRef)
      : []
  const namedEntities = primaryArcActor
    ? [
        namedEntityIngredient(
          ctx.state,
          anticipation ? 'arc_anticipated' : 'arc',
          primaryArcActor,
        ),
      ]
    : seedPrimary
      ? [namedEntityIngredient(ctx.state, 'arc', seedPrimary)]
      : []

  // Phase 40 audit pass 2 §6 — Anticipation seeds reference a theme
  // (e.g. `local_event:festival_approaching`) that hasn't been
  // instantiated yet in `state.world.localEvents`. The validator
  // requires `primaryActor` to resolve when it's set, so omit it for
  // anticipation seeds and let `affectedActors` carry the local_event
  // ref instead.
  return [
    buildSeed({
      id: seedId('seasonal_arc', arcKey, ctx),
      family: 'seasonal_arc',
      type: arcStage === 'climax' ? 'arc_milestone' : 'festival_preparation',
      timing: 'morning_prep',
      domain: ['arcs', 'calendar'],
      severity: Math.max(35, escalation?.severity ?? 35, arcIntensity),
      urgency: Math.max(30, escalation?.urgency ?? 30),
      ...(seedPrimary ? { primaryActor: seedPrimary } : {}),
      affectedActors: seedAffected,
      causes,
      pressures: pressureSnapshotsFor(ctx, ['arc_escalation', 'festival_readiness']),
      stakes: [
        stake('arc_stake', `arc:${arcKey}`, 'Arc may fail', 'loss', ['arc']),
        stake('readiness_stake', 'pressure:festival_readiness', 'Readiness may drop', 'risk', [
          'arc',
        ]),
      ],
      responseSlots,
      consequenceProfiles,
      memoriesCreated: [
        {
          id: `arc_seed_${arcKey}`,
          actors: [arcRef],
          tags: ['arc', 'warning', anticipation ? 'anticipation' : 'active'],
        },
      ],
      futureHooks: [],
      toneHints: ['arc', 'calendar', theme],
      textIngredients: buildTextIngredients({
        subject: arcLabel,
        problemNoun: anticipation ? 'arc anticipated' : 'arc milestone',
        sensoryDetails: ['flags rising', 'crowds gathering'],
        actorOpinions: { regulars: 'whisper about it' },
        recentContext: [`intensity ${arcIntensity}`],
        stakesReadable: ['arc may fail', 'readiness may drop'],
        namedEntities,
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

  // Phase 53 / ISSUE-013 — Hand-written profiles per slot. The previous
  // implementation collapsed all 6 slots through `responseSlots.map(makeProfile({…}))`
  // with a single cause-only effect, which the resolver treated as a
  // no-op. Each profile below carries at least one `delayedEffect`; three
  // carry a `futureHook`.
  const firstTarget = targetRefs[0]
  const exceptionEffect: EffectPreview | undefined = firstTarget
    ? firstTarget.kind === 'customer_group'
      ? effect(
          'state_change',
          `customers.${firstTarget.id}.loyalty`,
          6,
          `Exception eases ${firstTarget.id}`,
          ['policy', 'exception', 'customer'],
        )
      : effect(
          'cause',
          `${firstTarget.kind}:${firstTarget.id}`,
          6,
          `Exception eases ${firstTarget.kind}:${firstTarget.id}`,
          ['policy', 'exception', firstTarget.kind],
        )
    : undefined
  const punishEffect: EffectPreview | undefined = firstTarget
    ? effect(
        'cause',
        `${firstTarget.kind}:${firstTarget.id}`,
        -12,
        `Punishment burns ${firstTarget.kind}:${firstTarget.id}`,
        ['policy', 'punish', 'grudge', firstTarget.kind],
      )
    : undefined

  const consequenceProfiles: ConsequenceProfile[] = [
    makeProfile({
      id: 'keep_policy_profile',
      responseSlotId: 'keep_policy',
      immediateEffects: [
        effect('pressure', 'pressure:policy_backlash', 6, 'Holding the line stokes backlash', [
          'pressure',
          'policy',
        ]),
        effect('pressure', 'pressure:faction_anger', 4, 'Factions take note', [
          'pressure',
          'faction',
        ]),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:policy_backlash',
          6,
          'Resentment compounds across the week',
          ['pressure', 'policy', 'delay:7'],
        ),
        effect(
          'future_hook',
          `policy_held_unrest_${policy.id}`,
          14,
          'Unrest may surface if held longer',
          ['future_hook', 'policy'],
        ),
      ],
      memories: [
        {
          id: `policy_kept_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'held', 'attribution'],
        },
      ],
      futureHooks: [
        {
          id: `policy_held_unrest_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'modify_policy_profile',
      responseSlotId: 'modify_policy',
      immediateEffects: [
        effect('pressure', 'pressure:policy_backlash', -10, 'Compromise lowers backlash', [
          'pressure',
          'policy',
        ]),
        effect('state_change', 'coin', -5, 'Admin cost for the rewrite', ['coin']),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:faction_anger',
          -4,
          'Factions warm to the modification',
          ['pressure', 'faction', 'delay:5'],
        ),
      ],
      memories: [
        {
          id: `policy_modified_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'modify'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'repeal_policy_profile',
      responseSlotId: 'repeal_policy',
      immediateEffects: [
        effect('pressure', 'pressure:policy_backlash', -25, 'Repeal ends the backlash', [
          'pressure',
          'policy',
          'repeal',
        ]),
        effect('state_change', 'reputation.respectable', -3, 'Flip-flop dents respectability', [
          'reputation',
        ]),
        effect(
          'cause',
          `policy:${policy.id}`,
          -20,
          `Policy ${policy.label} repealed`,
          ['policy', 'repeal'],
        ),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:rumour_pressure',
          6,
          'Reversal feeds the rumour mill',
          ['pressure', 'rumour', 'delay:4'],
        ),
        effect(
          'future_hook',
          `policy_reversal_remembered_${policy.id}`,
          10,
          'Reversal may be brought up again',
          ['future_hook', 'policy', 'reversal'],
        ),
      ],
      memories: [
        {
          id: `policy_repealed_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'repeal', 'reversal'],
        },
      ],
      futureHooks: [
        {
          id: `policy_reversal_remembered_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'reversal'],
        },
      ],
    }),
    makeProfile({
      id: 'make_exception_profile',
      responseSlotId: 'make_exception',
      immediateEffects: [
        effect('pressure', 'pressure:policy_backlash', -8, 'Exception soothes local anger', [
          'pressure',
          'policy',
          'exception',
        ]),
        ...(exceptionEffect ? [exceptionEffect] : []),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:cultural_tension',
          4,
          'Inconsistent rules breed tension',
          ['pressure', 'culture', 'delay:5'],
        ),
      ],
      memories: [
        {
          id: `policy_exception_${policy.id}`,
          actors: firstTarget ? [policyRefId, firstTarget] : [policyRefId],
          tags: ['policy', 'exception'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'explain_policy_profile',
      responseSlotId: 'explain_policy',
      immediateEffects: [
        effect('pressure', 'pressure:policy_backlash', -6, 'Explanation lowers confusion', [
          'pressure',
          'policy',
        ]),
        effect('state_change', 'reputation.respectable', 2, 'Owner explains themselves', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect(
          'pressure',
          'pressure:rumour_pressure',
          -3,
          'Plain talk defuses gossip',
          ['pressure', 'rumour', 'delay:3'],
        ),
      ],
      memories: [
        {
          id: `policy_explained_${policy.id}`,
          actors: [policyRefId],
          tags: ['policy', 'explanation'],
        },
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'punish_violation_profile',
      responseSlotId: 'punish_violation',
      immediateEffects: [
        effect('pressure', 'pressure:violence', 5, 'Punishment edges the room', [
          'pressure',
          'violence',
        ]),
        effect('pressure', 'pressure:faction_anger', 8, 'Punishment hardens factions', [
          'pressure',
          'faction',
        ]),
        ...(punishEffect ? [punishEffect] : []),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `policy_punishment_grudge_${policy.id}`,
          14,
          'Grudge may surface later',
          ['future_hook', 'policy', 'grudge'],
        ),
      ],
      memories: [
        {
          id: `policy_punished_${policy.id}`,
          actors: firstTarget ? [policyRefId, firstTarget] : [policyRefId],
          tags: ['policy', 'punish', 'grudge'],
        },
      ],
      futureHooks: [
        {
          id: `policy_punishment_grudge_${policy.id}`,
          actors: firstTarget ? [firstTarget] : [policyRefId],
          tags: ['policy', 'grudge'],
        },
      ],
    }),
  ]

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

  // Phase 40 audit pass 2 §1 — Pull a second named actor: the rumour source
  // (perceiver from the attribution) and a witness regular drawn from the
  // starter roster with recency rotation. These dilute target-only entity
  // usage and give the `blame_someone_else` / `name_source_publicly` /
  // `ask_regular_to_vouch` responses real named refs.
  const today = ctx.state.calendar.totalDaysElapsed
  const sourceRef =
    dramatic.perceivedBy &&
    dramatic.perceivedBy.kind !== 'system' &&
    `${dramatic.perceivedBy.kind}:${dramatic.perceivedBy.id}` !==
      `${target.kind}:${target.id}`
      ? dramatic.perceivedBy
      : undefined

  const regulars = Object.values(ctx.state.world.regulars)
  let vouchRegular: EntityRef | undefined
  if (regulars.length > 0) {
    const ranked = regulars
      .map((r) => {
        const k = `regular:${r.id}`
        const penalty = recencyPenalty(ctx.state, 'rumour_crisis_vouch', k, today)
        const isTarget =
          target.kind === 'regular' && target.id === r.id ? 1000 : 0
        return { r, score: r.loyalty - penalty - isTarget }
      })
      .sort((a, b) => b.score - a.score)
    if (ranked[0]!.score > 0) {
      vouchRegular = regularRef(ranked[0]!.r.id)
      recordPick(ctx, 'rumour_crisis_vouch', `regular:${ranked[0]!.r.id}`)
    }
  }
  const tavernSelf = tavernIdentityRef('self')

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
      targetOptions: sourceRef ? [target, sourceRef] : [target],
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
      targetOptions: sourceRef ? [sourceRef] : [target],
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
    {
      id: 'counter_rumour',
      labelHint: 'Plant a counter-rumour',
      allowedVerbs: ['rebrand'],
      shape: 'deception',
      targetOptions: [target, ...(vouchRegular ? [vouchRegular] : [])],
      expectedEffects: ['drown out original rumour', 'add new lie to ledger'],
    },
    {
      id: 'ask_regular_to_vouch',
      labelHint: vouchRegular
        ? `Ask ${displayNameForRef(ctx.state, vouchRegular)} to vouch`
        : 'Ask a regular to vouch',
      allowedVerbs: ['invite', 'negotiate'],
      shape: 'safe_costly',
      targetOptions: vouchRegular ? [vouchRegular] : [target],
      expectedEffects: ['lower rumour', 'spend regular goodwill'],
    },
    {
      id: 'name_source_publicly',
      labelHint: sourceRef
        ? `Name ${displayNameForRef(ctx.state, sourceRef)} publicly`
        : 'Name the source publicly',
      allowedVerbs: ['blame', 'confess'],
      shape: 'escalation',
      targetOptions: sourceRef ? [sourceRef] : [target],
      expectedEffects: ['flip blame onto source', 'risk faction anger'],
    },
  ]

  const sourceMems = sourceRef ? [sourceRef] : []
  const vouchMems = vouchRegular ? [vouchRegular] : []
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
        effect('state_change', 'reputation.reliable', -8, 'Audience doubts the protest', [
          'reputation',
        ]),
        effect('pressure', 'pressure:cultural_tension', 4, 'Friction lingers', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 6, 'Whisper rebounds', ['pressure']),
        effect(
          'future_hook',
          `rumour_denial_backfire_${target.kind}_${target.id}`,
          12,
          'Denial may backfire if true',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_denied_${target.kind}_${target.id}`,
          actors: [target, ...sourceMems],
          tags: ['rumour', 'denial', 'reputation', 'false_blame'],
        },
        {
          id: `tavern_denial_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'rumour'],
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
        effect('state_change', 'reputation.reliable', 10, 'Reliable reputation grows', [
          'reputation',
        ]),
        effect('cause', `${target.kind}:${target.id}`, 8, 'Target gets context', [
          'rumour',
          'attribution',
        ]),
        effect('state_change', 'reputation.dangerous', -4, 'Open-hand signal', ['reputation']),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_confessed_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'confess', 'honesty', 'attribution'],
        },
        {
          id: `tavern_confession_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'honesty'],
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
        effect('cause', `${target.kind}:${target.id}`, -10, 'Tavern smeared the target', [
          'rumour',
          'blame',
          'attribution',
        ]),
        effect('pressure', 'pressure:cultural_tension', 6, 'Blamed party simmers', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:cultural_tension', 8, 'Simmer becomes a glare', [
          'pressure',
        ]),
        effect('pressure', 'pressure:faction_anger', 6, 'Faction tied to blame is sore', [
          'pressure',
        ]),
        effect(
          'future_hook',
          `rumour_blame_grudge_${target.kind}_${target.id}`,
          14,
          'Blamed party may grudge',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_deflected_${target.kind}_${target.id}`,
          actors: [target, ...sourceMems],
          tags: ['rumour', 'deception', 'blame', 'grudge', 'attribution'],
        },
        ...(sourceRef
          ? [
              {
                id: `rumour_source_blamed_${sourceRef.kind}_${sourceRef.id}`,
                actors: [sourceRef],
                tags: ['rumour', 'grudge', 'attribution'],
              },
            ]
          : []),
        {
          id: `tavern_deflection_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: `rumour_blame_grudge_${target.kind}_${target.id}`,
          actors: sourceRef ? [target, sourceRef] : [target],
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
        effect('state_change', 'reputation.reliable', 8, 'Reliable reputation grows', [
          'reputation',
        ]),
        effect('state_change', 'coin', -10, 'Investigation costs', ['coin']),
        effect('cause', `${target.kind}:${target.id}`, 12, 'Target name cleared', [
          'rumour',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_disproved_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'truth', 'investment', 'attribution'],
        },
        ...(vouchRegular
          ? [
              {
                id: `rumour_witness_${vouchRegular.id}`,
                actors: [vouchRegular],
                tags: ['regular', 'witness', 'favorite_order'],
              },
            ]
          : []),
      ],
      futureHooks: [],
    }),
    makeProfile({
      id: 'bribe_gossip_profile',
      responseSlotId: 'bribe_gossip',
      immediateEffects: [
        effect('state_change', 'coin', -20, 'Pay the gossip', ['coin']),
        effect('pressure', 'pressure:rumour_pressure', -12, 'Source quiets down', ['pressure']),
        effect('cause', `${target.kind}:${target.id}`, -6, 'Bribery whispers anyway', [
          'rumour',
          'attribution',
        ]),
        effect('pressure', 'pressure:cultural_tension', 8, 'Trust in tavern dents', [
          'pressure',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 5, 'Someone always talks', ['pressure']),
        effect(
          'future_hook',
          `rumour_bribe_exposed_${target.kind}_${target.id}`,
          15,
          'Bribe may be exposed',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_bribed_${target.kind}_${target.id}`,
          actors: [target, ...sourceMems],
          tags: ['rumour', 'bribe', 'risk', 'attribution'],
        },
        {
          id: `tavern_bribed_gossip_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'deception'],
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
      immediateEffects: [
        effect('state_change', 'reputation.respectable', -4, 'Silence reads as guilt', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 12, 'Silence lets rumour grow', [
          'pressure',
        ]),
        effect('state_change', 'reputation.dangerous', 8, 'Reputation rots', ['reputation']),
        effect('pressure', 'pressure:regular_customer_loss', 6, 'Regulars drift away', [
          'pressure',
        ]),
      ],
      memories: [
        {
          id: `rumour_ignored_${target.kind}_${target.id}`,
          actors: [target],
          tags: ['rumour', 'ignored', 'false_blame'],
        },
        {
          id: `tavern_silent_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'rumour'],
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
    makeProfile({
      id: 'counter_rumour_profile',
      responseSlotId: 'counter_rumour',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -8, 'Counter-rumour confuses gossip', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', -4, 'Sleight of tongue noticed', [
          'reputation',
        ]),
        effect('pressure', 'pressure:cultural_tension', 10, 'Two stories collide', ['pressure']),
        effect('cause', `${target.kind}:${target.id}`, -4, 'New lie cluster planted', [
          'rumour',
          'attribution',
        ]),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          `counter_rumour_runaway_${target.id}`,
          14,
          'Counter-rumour may run away',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_counter_${target.kind}_${target.id}`,
          actors: [target, ...sourceMems],
          tags: ['rumour', 'deception', 'false_blame', 'attribution'],
        },
        ...(vouchRegular
          ? [
              {
                id: `rumour_counter_source_${vouchRegular.id}`,
                actors: [vouchRegular],
                tags: ['regular', 'deception'],
              },
            ]
          : []),
        {
          id: `tavern_counter_rumour_${target.id}`,
          actors: [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'deception'],
        },
      ],
      futureHooks: [
        {
          id: `counter_rumour_runaway_${target.id}`,
          actors: [target],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
    makeProfile({
      id: 'ask_regular_to_vouch_profile',
      responseSlotId: 'ask_regular_to_vouch',
      immediateEffects: [
        effect('pressure', 'pressure:rumour_pressure', -12, 'Regular vouches publicly', [
          'pressure',
        ]),
        effect('state_change', 'reputation.respectable', 5, 'Credible voice helps', [
          'reputation',
        ]),
        ...(vouchRegular
          ? [
              effect(
                'state_change',
                `world.regulars.${vouchRegular.id}.loyalty`,
                -3,
                'Favour drawn down',
                ['regular'],
              ),
              effect(
                'cause',
                `regular:${vouchRegular.id}`,
                -5,
                'Tavern owes the vouch',
                ['regular', 'attribution'],
              ),
            ]
          : []),
      ],
      delayedEffects: [
        ...(vouchRegular
          ? [
              effect(
                'future_hook',
                `regular_favour_owed_${vouchRegular.id}`,
                10,
                'Owed favour returns later',
                ['future_hook'],
              ),
            ]
          : []),
      ],
      memories: [
        ...(vouchRegular
          ? [
              {
                id: `rumour_vouch_${vouchRegular.id}`,
                actors: [vouchRegular],
                tags: ['regular', 'favorite_order', 'attribution'],
              },
            ]
          : []),
        {
          id: `rumour_vouched_target_${target.kind}_${target.id}`,
          actors: [target, ...vouchMems],
          tags: ['rumour', 'attribution'],
        },
      ],
      futureHooks: vouchRegular
        ? [
            {
              id: `regular_favour_owed_${vouchRegular.id}`,
              actors: [vouchRegular],
              tags: ['regular', 'opportunity'],
            },
          ]
        : [],
    }),
    makeProfile({
      id: 'name_source_publicly_profile',
      responseSlotId: 'name_source_publicly',
      immediateEffects: [
        ...(sourceRef
          ? [
              effect(
                'cause',
                `${sourceRef.kind}:${sourceRef.id}`,
                -15,
                'Source named in public',
                ['rumour', 'blame', 'attribution'],
              ),
            ]
          : [
              effect(
                'cause',
                `${target.kind}:${target.id}`,
                -10,
                'Target faces blame from owner',
                ['rumour', 'blame', 'attribution'],
              ),
            ]),
        effect('pressure', 'pressure:rumour_pressure', -6, 'Story flips toward source', [
          'pressure',
        ]),
        effect('pressure', 'pressure:cultural_tension', 12, 'Public naming heats culture', [
          'pressure',
        ]),
        ...(sourceRef && sourceRef.kind === 'faction'
          ? [
              effect('pressure', 'pressure:faction_anger', 8, 'Faction fumes', ['pressure']),
            ]
          : []),
        effect('state_change', 'reputation.dangerous', 6, 'Owner shows teeth', ['reputation']),
      ],
      delayedEffects: [
        effect(
          'future_hook',
          sourceRef
            ? `public_naming_blowback_${sourceRef.id}`
            : `public_naming_blowback_${target.id}`,
          16,
          'Public naming risks blowback',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: sourceRef
            ? `rumour_source_named_${sourceRef.kind}_${sourceRef.id}`
            : `rumour_target_named_${target.kind}_${target.id}`,
          actors: sourceRef ? [sourceRef] : [target],
          tags: ['rumour', 'grudge', 'attribution', 'false_blame'],
        },
        {
          id: `rumour_publicly_named_${target.id}`,
          actors: [target, ...sourceMems],
          tags: ['rumour', 'attribution'],
        },
        {
          id: `tavern_publicly_named_${target.id}`,
          actors: sourceRef ? [sourceRef, tavernSelf] : [target, tavernSelf],
          tags: ['tavern_identity', 'memory', 'escalation'],
        },
      ],
      futureHooks: [
        {
          id: sourceRef
            ? `public_naming_blowback_${sourceRef.id}`
            : `public_naming_blowback_${target.id}`,
          actors: sourceRef ? [sourceRef] : [target],
          tags: ['rumour', 'risk'],
        },
      ],
    }),
  ]

  const perceivedBlame: string[] = [dramatic.readable]

  // Phase 40 audit pass 2 §5 — Keep affectedActors minimal so the rumour
  // source / vouch regular don't add to per-seed repetition counts. They
  // still appear inside profile memories.
  const seedAffected: EntityRef[] = dedupeRefs([], target)

  const namedEntities = [namedEntityIngredient(ctx.state, target.kind, target)]

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
      affectedActors: seedAffected,
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
        namedEntities,
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

  const tavernSelf = tavernIdentityRef('self')
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
        effect('state_change', 'reputation.reliable', -6, 'Audience doubts the protest', [
          'reputation',
        ]),
        effect('pressure', 'pressure:cultural_tension', 4, 'Friction lingers', ['pressure']),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 5, 'Whisper rebounds', ['pressure']),
        effect(
          'future_hook',
          `rumour_denial_backfire_${rumour.id}`,
          12,
          'Denial may backfire',
          ['future_hook'],
        ),
      ],
      memories: [
        {
          id: `rumour_denied_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'denial', 'false_blame'],
        },
        {
          id: `tavern_denial_${rumour.id}`,
          actors: [ref, tavernSelf],
          tags: ['tavern_identity', 'memory', 'rumour'],
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
      immediateEffects: [
        effect('state_change', 'reputation.respectable', -4, 'Silence reads as guilt', [
          'reputation',
        ]),
      ],
      delayedEffects: [
        effect('pressure', 'pressure:rumour_pressure', 12, 'Silence lets rumour grow', [
          'pressure',
        ]),
        effect('state_change', 'reputation.dangerous', 8, 'Reputation rots', ['reputation']),
        effect('pressure', 'pressure:regular_customer_loss', 6, 'Regulars drift', ['pressure']),
      ],
      memories: [
        {
          id: `rumour_ignored_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'ignored', 'false_blame'],
        },
        {
          id: `tavern_silent_${rumour.id}`,
          actors: [ref, tavernSelf],
          tags: ['tavern_identity', 'memory', 'rumour'],
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
        effect('state_change', 'reputation.reliable', 10, 'Reliable reputation grows', [
          'reputation',
        ]),
        effect('state_change', 'reputation.dangerous', -4, 'Open-hand signal', ['reputation']),
        effect('cause', `rumour:${rumour.id}`, 8, 'Tavern owns the story', [
          'rumour',
          'attribution',
        ]),
      ],
      delayedEffects: [],
      memories: [
        {
          id: `rumour_confessed_${rumour.id}`,
          actors: [ref],
          tags: ['rumour', 'confess', 'honesty', 'attribution'],
        },
        {
          id: `tavern_confession_${rumour.id}`,
          actors: [ref, tavernSelf],
          tags: ['tavern_identity', 'memory', 'honesty'],
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
