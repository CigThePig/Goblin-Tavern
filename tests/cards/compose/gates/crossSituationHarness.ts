// Phase 143 / ISSUE-112 — Voiced Surface arc, Phase 17 (Cross-Situation
// Voice Consistency).
//
// Wires the 11 migrated actor-voiced templates into the
// `checkCrossSituationVoice` gate. Each `CrossSituationActorKind` entry
// lists the templates a given actor kind can appear in plus a sample
// builder that installs the archetype's voice on the actor and emits
// the situation's seed for each migrated template.
//
// The 11 actor-voiced templates by kind:
//
//   staff (4):           staffAside, staffBurnout, foodSafetyCrisis,
//                        rumourCrisis (staff target)
//   regular (3):         drinkOrder, regularComplaint,
//                        rumourCrisis (regular target)
//   customer_group (3):  customerComplaint, violence,
//                        rumourCrisis (customer_group target)
//   supplier (2):        supplierReliability, rumourCrisis (supplier target)
//   faction (3):         factionRequest, inspection,
//                        rumourCrisis (faction target)
//   notable_npc (2):     inspection (npc variant), rumourCrisis (npc target)
//
// Movement IV explicitly notes the supplier and notable_npc kinds carry
// fewer templates; the gate's default config scales the floors down for
// 2-template kinds so the rule is meaningful at both sizes.

import {
  createCustomerGroupCastAttributes,
  createFactionCastAttributes,
  createNotableNpcCastAttributes,
  createRegularCastAttributes,
  createStaffCastAttributes,
  createSupplierCastAttributes,
  CULTURE_VOICE_DEFAULTS,
} from '../../../../src/sim/content/cast'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  NotableNpcCastAttributes,
  SupplierCastAttributes,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceProfile,
} from '../../../../src/sim/content/cast'
import type {
  IssueSeed,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  NotableNpcWorldState,
  TavernState,
} from '../../../../src/sim/state/TavernState'
import type {
  CrossSituationActorKind,
  CrossSituationArchetype,
  CrossSituationSample,
} from '../../../../src/cards/compose/gates'
import { areaAtmosphereTemplate } from '../../../../src/cards/templates/areaAtmosphere'
import { customerComplaintTemplate } from '../../../../src/cards/templates/customerComplaint'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { factionRequestTemplate } from '../../../../src/cards/templates/factionRequest'
import { foodSafetyCrisisTemplate } from '../../../../src/cards/templates/foodSafetyCrisis'
import { inspectionTemplate } from '../../../../src/cards/templates/inspection'
import { regularComplaintTemplate } from '../../../../src/cards/templates/regularComplaint'
import { rumourCrisisTemplate } from '../../../../src/cards/templates/rumourCrisis'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import { staffBurnoutTemplate } from '../../../../src/cards/templates/staffBurnout'
import { supplierReliabilityTemplate } from '../../../../src/cards/templates/supplierReliability'
import { violenceTemplate } from '../../../../src/cards/templates/violence'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import type { ConditionContext } from '../../../../src/cards/compose/types'
import { makeSeed } from '../../cardFactories'
import { __testing } from './samplers'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { createRng } from '../../../../src/sim/core/rng'

const {
  firstRegularId,
  installCast,
  drinkOrderSeedFor,
  regularRef,
  neutralCast,
  firstStaffId,
  installStaffCast,
  staffAsideSeedFor,
  staffRef,
  firstCustomerGroupId,
  installGroupCast,
  customerGroupRef,
  firstSupplierId,
  installSupplierCast,
  supplierOfferSeedFor,
  supplierRef,
  firstFactionId,
  installFactionCast,
  factionRequestSeedFor,
  factionRef,
} = __testing

// ---------------------------------------------------------------------
// The five archetype profiles the gate holds fixed across all templates.
// Order matters: the voice-blind detector compares the first two
// archetypes per slot. terse_cold + florid_warm is the maximally-opposed
// pair, so voice-blind slots surface there.
// ---------------------------------------------------------------------

export const CROSS_SITUATION_ARCHETYPES: readonly CrossSituationArchetype[] = [
  {
    id: 'terse_cold',
    axes: { terseness: 2, warmth: 0, formality: 1, floridity: 0 },
  },
  {
    id: 'florid_warm',
    axes: { terseness: 0, warmth: 2, formality: 0, floridity: 2 },
  },
  {
    id: 'formal_prickly',
    axes: { terseness: 1, warmth: 0, formality: 2, floridity: 1 },
  },
  {
    id: 'neutral_tic_qualifies',
    axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
    verbalTic: 'qualifies_everything',
  },
  {
    id: 'neutral_tic_trails_off',
    axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
    verbalTic: 'trails_off',
  },
]

function profileFor(archetype: CrossSituationArchetype): VoiceProfile {
  if (archetype.verbalTic) {
    return { axes: { ...archetype.axes }, verbalTic: archetype.verbalTic }
  }
  return { axes: { ...archetype.axes } }
}

// ---------------------------------------------------------------------
// Per-kind cast factories — pre-roll a neutral specialty/blindspot/
// affinities surface from the real factory using a fixed RNG seed, then
// overlay the archetype's voice. This keeps `specialty` / `blindspot`
// fields non-empty so `actorTrait` (forward seam) and any future
// non-voice checks behave as in production.
// ---------------------------------------------------------------------

function neutralRegularCast(seed: string): CastAttributes {
  const rng = createRng(`phase-143-regular-base:${seed}`)
  return createRegularCastAttributes({ rng })
}

function neutralStaffCast(seed: string, roleId: string): CastAttributes {
  const rng = createRng(`phase-143-staff-base:${seed}`)
  return createStaffCastAttributes({ roleId, rng })
}

function neutralSupplierCast(
  seed: string,
  supplierType: string,
  cultureId: string | undefined,
): SupplierCastAttributes {
  const rng = createRng(`phase-143-supplier-base:${seed}`)
  return createSupplierCastAttributes({
    supplierType,
    ...(cultureId !== undefined ? { cultureId } : {}),
    rng,
  })
}

function neutralFactionCast(
  seed: string,
  cultureId: string | undefined,
): FactionCastAttributes {
  const rng = createRng(`phase-143-faction-base:${seed}`)
  return createFactionCastAttributes({
    ...(cultureId !== undefined ? { cultureId } : {}),
    rng,
  })
}

function neutralGroupCast(
  seed: string,
  cultureId: string,
): CustomerGroupCastAttributes {
  const rng = createRng(`phase-143-cgroup-base:${seed}`)
  return createCustomerGroupCastAttributes({ rng, cultureId })
}

function neutralNotableNpcCast(
  seed: string,
  profileKind: string,
  cultureId: string | undefined,
): NotableNpcCastAttributes {
  const rng = createRng(`phase-143-npc-base:${seed}`)
  return createNotableNpcCastAttributes({
    profileKind,
    ...(cultureId !== undefined ? { cultureId } : {}),
    rng,
  })
}

function overlayVoice<T extends { voice: VoiceProfile }>(
  cast: T,
  archetype: CrossSituationArchetype,
): T {
  return { ...cast, voice: profileFor(archetype) }
}

// Avoid an unused-import warning while keeping the type as a contract.
void CULTURE_VOICE_DEFAULTS

// ---------------------------------------------------------------------
// notable_npc — neither initial-state factories nor cross-situation
// samplers currently expose helpers, so build them here. The
// `createInitialNotableNpcs` factory in `defaults.ts` already populates
// `state.world.notableNpcs` so we just need a first-id resolver and an
// install helper.
// ---------------------------------------------------------------------

function firstNotableNpcId(state: TavernState): string {
  const id = Object.keys(state.world.notableNpcs)[0]
  if (!id) {
    throw new Error('crossSituationHarness: createInitialTavernState() must have a notable_npc')
  }
  return id
}

function notableNpcRef(id: string): EntityRef {
  return { kind: 'notable_npc', id }
}

function installNotableNpcCast(
  state: TavernState,
  npcId: string,
  cast: NotableNpcCastAttributes,
): TavernState {
  const existing = state.world.notableNpcs[npcId]!
  const updated: NotableNpcWorldState = {
    ...existing,
    castAttributes: cast,
  }
  return {
    ...state,
    world: {
      ...state.world,
      notableNpcs: {
        ...state.world.notableNpcs,
        [npcId]: updated,
      },
    },
  }
}

// ---------------------------------------------------------------------
// rumour_crisis per-kind seed factory. The template's predicate accepts
// every actor kind that carries cast attributes, so we generate a
// matching seed per target kind. The `rumour.target.<kind>` domain tag
// matches the snippet pools' `hasTag` gates.
// ---------------------------------------------------------------------

function rumourCrisisSeedForKind(
  ref: EntityRef,
  id: string,
): IssueSeed {
  return makeSeed({
    id,
    family: 'rumour_crisis',
    type: 'rumour',
    timing: 'closing',
    severity: 50,
    domain: [
      'rumours',
      'reputation',
      'social',
      'rumour.partial',
      `rumour.target.${ref.kind}`,
    ],
    primaryActor: ref,
    toneHints: ['rumour', 'reputation'],
    textIngredients: {
      subject: 'a story doing rounds',
      sensoryDetails: ['whispered word'],
      recentContext: ['accuracy: partial'],
    },
  })
}

function staffBurnoutSeedFor(staffId: string, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'staff_burnout',
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 50,
    domain: ['staff'],
    primaryActor: staffRef(staffId),
    textIngredients: {
      subject: 'looks ready to snap',
      sensoryDetails: ['hunched shoulders'],
      recentContext: ['heavy week of service'],
    },
  })
}

function foodSafetyCrisisSeedFor(staffId: string, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'food_safety',
    type: 'crisis',
    timing: 'morning_prep',
    severity: 65,
    domain: ['food', 'kitchen', 'stock'],
    primaryActor: staffRef(staffId),
    location: { kind: 'area', id: 'kitchen' },
    toneHints: ['risk', 'kitchen', 'urgent'],
    textIngredients: {
      subject: 'the kitchen',
      sensoryDetails: ['greasy floor'],
      recentContext: ['kitchen filthy for days'],
    },
  })
}

function regularComplaintSeedFor(regularId: string, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'regular_customer',
    type: 'complaint',
    timing: 'during_service',
    severity: 60,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    textIngredients: {
      subject: 'a sour mood',
      sensoryDetails: ['half-empty mug'],
      recentContext: ['irritation 75'],
    },
  })
}

function customerComplaintSeedFor(groupId: string, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'customer_complaint',
    type: 'complaint',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'reputation', 'service'],
    primaryActor: customerGroupRef(groupId),
    textIngredients: {
      subject: 'a cold welcome',
      sensoryDetails: ['pursed lips'],
      recentContext: ['main room dirty all week'],
    },
  })
}

function violenceSeedFor(groupId: string, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'violence',
    type: 'customer_incident',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'service', 'maintenance'],
    primaryActor: customerGroupRef(groupId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['violence', 'rowdy'],
    textIngredients: {
      subject: 'main room',
      sensoryDetails: ['shouting voices'],
      recentContext: ['brawl this week'],
    },
  })
}

function inspectionSeedFor(actorRef: EntityRef, id: string): IssueSeed {
  return makeSeed({
    id,
    family: 'inspection',
    type: 'inspection_threat',
    timing: 'morning_prep',
    severity: 55,
    domain: ['inspection', 'food', 'areas', 'reputation'],
    primaryActor: actorRef,
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['inspection', 'urgent'],
    textIngredients: {
      subject: 'the tavern',
      sensoryDetails: ['privy stench'],
      recentContext: ['privy left filthy'],
    },
  })
}

// ---------------------------------------------------------------------
// Phase-6 response/effect contexts. The cross-situation gate exercises
// title + body slots (not choice/preview pools — those are per-response
// internal to choices). We omit ctx for body/title slots, matching how
// the runtime evaluates them.
// ---------------------------------------------------------------------

// Mark unused — Phase-6 response-slot contexts are not threaded through
// the cross-situation gate, which exercises body/title slots only.
const _UNUSED_CTX: ConditionContext = {}
void _UNUSED_CTX
// suppress an unused-name lint without disabling the rule globally
const _unusedShape: ResponseIntentShape = 'safe_costly'
const _unusedVerb: ResponseIntentVerb = 'appease'
void _unusedShape
void _unusedVerb
const _unusedSlot: ResponseSlot = {
  id: 'unused',
  labelHint: 'unused',
  allowedVerbs: [] as ResponseIntentVerb[],
  shape: 'safe_costly' as ResponseIntentShape,
  targetOptions: [],
  expectedEffects: [],
}
void _unusedSlot

// ---------------------------------------------------------------------
// Per-kind sample builders. Each one returns a list — one sample per
// migrated template the kind appears in.
// ---------------------------------------------------------------------

function buildSamplesForStaff(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const roleId = baseState.staff[staffId]!.role
  const neutral = neutralStaffCast(archetype.id, roleId)
  const cast: CastAttributes = overlayVoice(neutral, archetype)
  const state = installStaffCast(baseState, staffId, cast)
  return [
    {
      templateId: staffAsideTemplate.id,
      template: staffAsideTemplate,
      seed: staffAsideSeedFor(staffId, `xs-staff-aside-${archetype.id}`),
      state,
    },
    {
      templateId: staffBurnoutTemplate.id,
      template: staffBurnoutTemplate,
      seed: staffBurnoutSeedFor(staffId, `xs-staff-burnout-${archetype.id}`),
      state,
    },
    {
      templateId: foodSafetyCrisisTemplate.id,
      template: foodSafetyCrisisTemplate,
      seed: foodSafetyCrisisSeedFor(staffId, `xs-food-safety-${archetype.id}`),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        staffRef(staffId),
        `xs-rumour-staff-${archetype.id}`,
      ),
      state,
    },
  ]
}

function buildSamplesForRegular(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const regularId = firstRegularId(baseState)
  const neutral = neutralRegularCast(archetype.id)
  const cast: CastAttributes = overlayVoice(neutral, archetype)
  const state = installCast(baseState, regularId, cast)
  return [
    {
      templateId: drinkOrderTemplate.id,
      template: drinkOrderTemplate,
      seed: drinkOrderSeedFor(regularId, `xs-drink-order-${archetype.id}`),
      state,
    },
    {
      templateId: regularComplaintTemplate.id,
      template: regularComplaintTemplate,
      seed: regularComplaintSeedFor(regularId, `xs-regular-complaint-${archetype.id}`),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        regularRef(regularId),
        `xs-rumour-regular-${archetype.id}`,
      ),
      state,
    },
  ]
}

function buildSamplesForCustomerGroup(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const groupId = firstCustomerGroupId(baseState)
  const cultureId = baseState.customerGroups[groupId]!.cultureId
  const neutral = neutralGroupCast(archetype.id, cultureId)
  const cast: CustomerGroupCastAttributes = overlayVoice(neutral, archetype)
  const state = installGroupCast(baseState, groupId, cast)
  return [
    {
      templateId: customerComplaintTemplate.id,
      template: customerComplaintTemplate,
      seed: customerComplaintSeedFor(groupId, `xs-customer-complaint-${archetype.id}`),
      state,
    },
    {
      templateId: violenceTemplate.id,
      template: violenceTemplate,
      seed: violenceSeedFor(groupId, `xs-violence-${archetype.id}`),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        customerGroupRef(groupId),
        `xs-rumour-cgroup-${archetype.id}`,
      ),
      state,
    },
  ]
}

function buildSamplesForSupplier(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const supplierId = firstSupplierId(baseState)
  const supplier = baseState.world.suppliers[supplierId]!
  const neutral = neutralSupplierCast(
    archetype.id,
    supplier.supplierType,
    supplier.cultureId,
  )
  const cast: SupplierCastAttributes = overlayVoice(neutral, archetype)
  const state = installSupplierCast(baseState, supplierId, cast)
  return [
    {
      templateId: supplierReliabilityTemplate.id,
      template: supplierReliabilityTemplate,
      seed: supplierOfferSeedFor(supplierId, `xs-supplier-offer-${archetype.id}`),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        supplierRef(supplierId),
        `xs-rumour-supplier-${archetype.id}`,
      ),
      state,
    },
  ]
}

function buildSamplesForFaction(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const factionId = firstFactionId(baseState)
  const faction = baseState.world.factions[factionId]!
  const neutral = neutralFactionCast(archetype.id, faction.cultureId)
  const cast: FactionCastAttributes = overlayVoice(neutral, archetype)
  const state = installFactionCast(baseState, factionId, cast)
  return [
    {
      templateId: factionRequestTemplate.id,
      template: factionRequestTemplate,
      seed: factionRequestSeedFor(factionId, `xs-faction-request-${archetype.id}`),
      state,
    },
    {
      templateId: inspectionTemplate.id,
      template: inspectionTemplate,
      seed: inspectionSeedFor(
        factionRef(factionId),
        `xs-inspection-faction-${archetype.id}`,
      ),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        factionRef(factionId),
        `xs-rumour-faction-${archetype.id}`,
      ),
      state,
    },
  ]
}

function buildSamplesForNotableNpc(
  archetype: CrossSituationArchetype,
): readonly CrossSituationSample[] {
  const baseState = createInitialTavernState()
  const npcId = firstNotableNpcId(baseState)
  const npc = baseState.world.notableNpcs[npcId]!
  const neutral = neutralNotableNpcCast(archetype.id, npc.kind, npc.cultureId)
  const cast: NotableNpcCastAttributes = overlayVoice(neutral, archetype)
  const state = installNotableNpcCast(baseState, npcId, cast)
  return [
    {
      templateId: inspectionTemplate.id,
      template: inspectionTemplate,
      seed: inspectionSeedFor(
        notableNpcRef(npcId),
        `xs-inspection-npc-${archetype.id}`,
      ),
      state,
    },
    {
      templateId: rumourCrisisTemplate.id,
      template: rumourCrisisTemplate,
      seed: rumourCrisisSeedForKind(
        notableNpcRef(npcId),
        `xs-rumour-npc-${archetype.id}`,
      ),
      state,
    },
  ]
}

// ---------------------------------------------------------------------
// The actor-kind registry the gate iterates. Ordering here is the order
// the gate iterates; the harness orders kinds by template count descending
// so the larger-N kinds (staff, regular, customer_group, faction) lead.
// ---------------------------------------------------------------------

export const CROSS_SITUATION_ACTOR_KINDS: readonly CrossSituationActorKind[] = [
  {
    actorKind: 'staff',
    templateIds: [
      staffAsideTemplate.id,
      staffBurnoutTemplate.id,
      foodSafetyCrisisTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForStaff,
  },
  {
    actorKind: 'regular',
    templateIds: [
      drinkOrderTemplate.id,
      regularComplaintTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForRegular,
  },
  {
    actorKind: 'customer_group',
    templateIds: [
      customerComplaintTemplate.id,
      violenceTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForCustomerGroup,
  },
  {
    actorKind: 'faction',
    templateIds: [
      factionRequestTemplate.id,
      inspectionTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForFaction,
  },
  {
    actorKind: 'supplier',
    templateIds: [
      supplierReliabilityTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForSupplier,
  },
  {
    actorKind: 'notable_npc',
    templateIds: [
      inspectionTemplate.id,
      rumourCrisisTemplate.id,
    ],
    buildSamples: buildSamplesForNotableNpc,
  },
]

// Re-export internals for use in failure-fixture tests.
export const __crossSituationInternals = {
  buildSamplesForStaff,
  buildSamplesForRegular,
  buildSamplesForCustomerGroup,
  buildSamplesForSupplier,
  buildSamplesForFaction,
  buildSamplesForNotableNpc,
  firstNotableNpcId,
  installNotableNpcCast,
  notableNpcRef,
  rumourCrisisSeedForKind,
  staffBurnoutSeedFor,
  foodSafetyCrisisSeedFor,
  regularComplaintSeedFor,
  customerComplaintSeedFor,
  violenceSeedFor,
  inspectionSeedFor,
}

// Re-export shapes consumed by the failure-fixture tests.
export type {
  CompositionalCardTemplate,
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  NotableNpcCastAttributes,
  SupplierCastAttributes,
  VoiceAxisId,
  VoiceAxisValue,
  VerbalTicId,
  VoiceProfile,
}

void neutralCast
