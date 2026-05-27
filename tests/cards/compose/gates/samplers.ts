// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Shared sampler builders for the determinism and diversity gates.
// Both produce `(seed, state)` pairs that target the drinkOrder
// template's actor — a single regular whose `castAttributes` is the
// thing under test.
//
// The determinism sampler returns a HAND-PICKED set of cast profiles
// (neutral, each one-axis-extreme, each two-axis-extreme, each verbal
// tic), so the gate exercises every snippet rung at least once.
//
// The diversity sampler rolls fresh attributes per sample via
// `createRegularCastAttributes` with a deterministic `prando`-seeded RNG,
// reproducing the real `[-1,0,0,1]`-perturbed distribution. Same `i` ⇒
// same sample, so the test is itself deterministic.

import { createRng } from '../../../../src/sim/core/rng'
import {
  createCustomerGroupCastAttributes,
  createFactionCastAttributes,
  createRegularCastAttributes,
  createStaffCastAttributes,
  createSupplierCastAttributes,
} from '../../../../src/sim/content/cast'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  SupplierCastAttributes,
  VerbalTicId,
} from '../../../../src/sim/content/cast'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type {
  IssueSeed,
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../../../../src/sim/core/effect'
import type {
  EntityRef,
  TavernState,
} from '../../../../src/sim/state/TavernState'
import type {
  DeterminismSample,
  DiversitySample,
  DiversitySampler,
} from '../../../../src/cards/compose/gates'
import type { ConditionContext } from '../../../../src/cards/compose/types'
import { makeSeed } from '../../cardFactories'
// Phase 163 / ISSUE-131 — Real-seed shape capture. Each `*_SHAPE()` returns
// the production responseSlots + consequenceProfiles + stakes for its
// family, captured once at module-load and cached. The `*SeedFor` and
// `*BaseSeed` factories below spread these into their `makeSeed` calls so
// gates exercise the shape players actually see, not the synthetic 2-slot
// `clean`/`ignore` stub `cardFactories.makeSeed` falls back to.
import {
  AREA_ATMOSPHERE_SHAPE,
  CULTURE_CONFLICT_SHAPE,
  CUSTOMER_COMPLAINT_SHAPE,
  DEBT_RENT_SHAPE,
  FACTION_REQUEST_SHAPE,
  FOOD_SAFETY_SHAPE,
  INSPECTION_SHAPE,
  MAINTENANCE_SHAPE,
  MONTHLY_REVIEW_SHAPE,
  REGULAR_CUSTOMER_COMPLAINT_SHAPE,
  REGULAR_CUSTOMER_RELATIONSHIP_SHAPE,
  REPUTATION_SHIFT_SHAPE,
  RIVAL_TAVERN_ARC_SHAPE,
  RIVAL_TAVERN_SYSTEM_SHAPE,
  RUMOUR_CRISIS_SHAPE,
  SEASONAL_ARC_SHAPE,
  STAFF_BURNOUT_SHAPE,
  STAFF_IDENTITY_SHAPE,
  STOCK_SHORTAGE_SHAPE,
  SUPPLIER_RELATIONSHIP_SHAPE,
  VIOLENCE_SHAPE,
} from './realSeedShapes'

const VERBAL_TIC_IDS: readonly VerbalTicId[] = [
  'trails_off',
  'interrupts_self',
  'understates',
  'repeats_for_emphasis',
  'qualifies_everything',
  'italicises_stakes',
  'quotes_someone_else',
]

function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a regular')
  }
  return id
}

function regularRef(id: string): EntityRef {
  return { kind: 'regular', id }
}

function installCast(
  state: TavernState,
  regularId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [regularId]: {
          ...state.world.regulars[regularId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function drinkOrderSeedFor(regularId: string, id: string): IssueSeed {
  const shape = REGULAR_CUSTOMER_RELATIONSHIP_SHAPE()
  return makeSeed({
    id,
    family: 'regular_customer',
    type: 'relationship_test',
    timing: 'during_service',
    severity: 35,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'asks for ale',
      sensoryDetails: ['stools scrape back as they settle'],
      recentContext: ['second visit this week'],
    },
  })
}

function neutralCast(): CastAttributes {
  return {
    specialty: 'gossip',
    blindspot: 'war_story',
    affinities: [],
    voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
  }
}

/**
 * Hand-picked determinism profiles. The list covers the full snippet
 * rung structure so every condition is exercised at least once across
 * the sample.
 */
export function buildDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const regularId = firstRegularId(baseState)
  const profiles: CastAttributes[] = [
    neutralCast(),
    // Single-axis extremes — one per axis, high and low where Phase B
    // wrote snippets.
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } },
    },
    // Two-axis extremes — one per Phase B top-rung snippet.
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 0, warmth: 1, formality: 1, floridity: 2 } },
    },
    // One per verbal tic — neutral axes so the tic snippet wins
    // unambiguously.
    ...VERBAL_TIC_IDS.map<CastAttributes>((tic) => ({
      ...neutralCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  const samples: DeterminismSample[] = profiles.map((cast, i) => ({
    seed: drinkOrderSeedFor(regularId, `determinism-${i}`),
    state: installCast(baseState, regularId, cast),
  }))
  return samples
}

export type DiversitySamplerOptions = {
  /** Seed string for the diversity sampler RNG. Same string ⇒ same
   *  sample sequence. */
  rngSeed?: string
}

/**
 * Roll a fresh `CastAttributes` per sample via the real factory, install
 * it on a base state, and emit a `(seed, state)` pair targeting that
 * regular. Uses a single seeded RNG advanced across all samples — same
 * `rngSeed` produces the same population in the same order.
 */
export function buildDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-124-diversity'
  // One RNG advanced across the whole sample loop. This matches what
  // `createRegularCastAttributes` expects (a single SimRng threaded
  // through all rolls).
  const rng = createRng(`${seed}:regular_identity`)
  const baseState = createInitialTavernState()
  const regularId = firstRegularId(baseState)
  return (i: number) => {
    const cast = createRegularCastAttributes({ rng })
    const state = installCast(baseState, regularId, cast)
    return {
      seed: drinkOrderSeedFor(regularId, `diversity-${i}`),
      state,
    }
  }
}

// Phase 125 / ISSUE-094: `representativeBannedNames` moved to
// `src/cards/compose/gates/representativeBannedNames.ts` so the
// generation pipeline can import it without reaching into `tests/`.
// Re-exported here for the existing call sites.
export { representativeBannedNames } from '../../../../src/cards/compose/gates/representativeBannedNames'

// ---- Phase 126 / ISSUE-095 — Living Cast Phase F (first situation) ----
//
// Staff-side equivalents of the regular-side helpers above. The new
// staff_aside template (`staff_identity / relationship_test /
// morning_prep`) needs the same determinism + diversity coverage the
// drinkOrder template enjoys. Mirror structure, swap the actor kind:
//   - `firstStaffId(state)` against `state.staff`
//   - `installStaffCast(state, staffId, cast)` against `state.staff[id]`
//   - `staffAsideSeedFor(staffId, id)` emits a staff_identity seed
//   - `createStaffCastAttributes` rolls the per-sample cast attributes
//     reproducing the same `[-1,0,0,1]` perturbation Phase A applies.

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a staff member')
  }
  return id
}

function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}

function installStaffCast(
  state: TavernState,
  staffId: string,
  cast: CastAttributes,
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...state.staff[staffId]!,
        castAttributes: cast,
      },
    },
  }
}

function staffAsideSeedFor(staffId: string, id: string): IssueSeed {
  const shape = STAFF_IDENTITY_SHAPE()
  return makeSeed({
    id,
    family: 'staff_identity',
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 40,
    domain: ['staff', 'identity', 'social'],
    primaryActor: staffRef(staffId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'before the doors open',
      sensoryDetails: ['the kettle clicks awake'],
      recentContext: ['tense week of service'],
    },
  })
}

/** Hand-picked determinism profiles against a staff actor — mirrors
 *  `buildDeterminismSamples()` but installs cast on `state.staff` and
 *  emits a `staff_identity / relationship_test / morning_prep` seed. */
export function buildStaffDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const profiles: CastAttributes[] = [
    neutralCast(),
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 0, warmth: 1, formality: 1, floridity: 2 } },
    },
    ...VERBAL_TIC_IDS.map<CastAttributes>((tic) => ({
      ...neutralCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: staffAsideSeedFor(staffId, `staff-determinism-${i}`),
    state: installStaffCast(baseState, staffId, cast),
  }))
}

/** Roll a fresh staff `CastAttributes` per sample via the real factory
 *  (`createStaffCastAttributes`), install it, and emit a `(seed, state)`
 *  pair targeting that staff member. Same `rngSeed` ⇒ same sequence. */
export function buildStaffDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-126-staff-diversity'
  const rng = createRng(`${seed}:staff_identity`)
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const roleId = baseState.staff[staffId]!.role
  return (i: number) => {
    // Pass the role so the factory uses the right specialty domain;
    // diversity is per-axis voice variance, not per-role.
    const cast = createStaffCastAttributes({ roleId, rng })
    const state = installStaffCast(baseState, staffId, cast)
    return {
      seed: staffAsideSeedFor(staffId, `staff-diversity-${i}`),
      state,
    }
  }
}

// ---- Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 ----
//
// Samplers for the staff_burnout template. The seed shape differs from
// staff_aside (different family / type, no `socialContext`) so the
// determinism harness needs its own seed factory. The diversity sampler
// reuses the same cast-perturbation rng as staff_aside since the voice
// dimensions are identical.

function staffBurnoutSeedFor(staffId: string, id: string): IssueSeed {
  const shape = STAFF_BURNOUT_SHAPE()
  return makeSeed({
    id,
    family: 'staff_burnout',
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 50,
    domain: ['staff'],
    primaryActor: staffRef(staffId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'looks ready to snap',
      sensoryDetails: ['hunched shoulders', 'dark eyes'],
      recentContext: ['heavy week of service'],
    },
  })
}

export function buildStaffBurnoutDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const profiles: CastAttributes[] = [
    neutralCast(),
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } },
    },
    ...VERBAL_TIC_IDS.map<CastAttributes>((tic) => ({
      ...neutralCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: staffBurnoutSeedFor(staffId, `staff-burnout-determinism-${i}`),
    state: installStaffCast(baseState, staffId, cast),
  }))
}

export function buildStaffBurnoutDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-133-staff-burnout-diversity'
  const rng = createRng(`${seed}:staff_burnout`)
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const roleId = baseState.staff[staffId]!.role
  return (i: number) => {
    const cast = createStaffCastAttributes({ roleId, rng })
    const state = installStaffCast(baseState, staffId, cast)
    return {
      seed: staffBurnoutSeedFor(staffId, `staff-burnout-diversity-${i}`),
      state,
    }
  }
}

// ---- Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6 ----
//
// Context builders for the choice-label and effect-preview pool
// diversity gates. Each builder maps a sample index to a
// `ConditionContext { currentResponseSlot?, currentEffect? }` so the new
// `responseVerb` / `responseShape` / `effectKind` / `effectTag`
// primitives can match. Without a context builder those conditions
// always return false (intended for body / title slots) and the gate
// would observe zero diversity.
//
// We rotate through a small representative set of (verb, shape) pairs
// per sample to ensure the verb-gated rungs of the pool fire across
// the population, mirroring how `composeChoicesFromSeed` exercises the
// pool per response slot at runtime. Effect contexts rotate through
// the per-template effect tags (`regulars` vs `staff`) plus a tagless
// `state_change` effect so the kind-gated rungs fire too.

const DRINK_ORDER_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase132-drinkorder-appease',
    labelHint: 'Smooth it over',
    allowedVerbs: ['appease'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['irritation -5'],
  },
  {
    id: 'phase132-drinkorder-ignore',
    labelHint: 'Let it ride',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['nothing changes'],
  },
]

const STAFF_ASIDE_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase132-staffaside-appease',
    labelHint: 'Hear them out',
    allowedVerbs: ['appease'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['loyalty +2'],
  },
  {
    id: 'phase132-staffaside-ignore',
    labelHint: 'Let it sit',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['nothing changes'],
  },
]

const DRINK_ORDER_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'world.regulars.irritation',
    amount: -5,
    readable: 'the regular settles',
    tags: ['regulars'],
  },
  {
    kind: 'state_change',
    target: 'noop',
    amount: 0,
    readable: 'nothing changes',
    tags: [],
  },
]

const STAFF_ASIDE_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'staff.loyalty',
    amount: 2,
    readable: 'the staffer relaxes',
    tags: ['staff'],
  },
  {
    kind: 'state_change',
    target: 'noop',
    amount: 0,
    readable: 'nothing shifts',
    tags: [],
  },
]

/** Phase 6 context builder for the drinkOrder choice-label slot.
 *  Rotates through `appease` / `ignore` per sample so verb-gated rungs
 *  in the pool fire across the population. */
export function buildDrinkOrderChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = DRINK_ORDER_RESPONSE_SLOTS[i % DRINK_ORDER_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

/** Phase 6 context builder for the drinkOrder effect-preview slot.
 *  Pairs a response slot with an effect so both `responseVerb` and
 *  `effectKind` / `effectTag` rungs can match. */
export function buildDrinkOrderEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = DRINK_ORDER_RESPONSE_SLOTS[i % DRINK_ORDER_RESPONSE_SLOTS.length]!
  const effect = DRINK_ORDER_EFFECTS[i % DRINK_ORDER_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

/** Phase 6 context builder for the staffAside choice-label slot. */
export function buildStaffAsideChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = STAFF_ASIDE_RESPONSE_SLOTS[i % STAFF_ASIDE_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

/** Phase 6 context builder for the staffAside effect-preview slot. */
export function buildStaffAsideEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = STAFF_ASIDE_RESPONSE_SLOTS[i % STAFF_ASIDE_RESPONSE_SLOTS.length]!
  const effect = STAFF_ASIDE_EFFECTS[i % STAFF_ASIDE_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 134 / ISSUE-103 — Voiced Surface arc, Phase 8 ----
//
// Samplers for the regular_complaint and customer_complaint templates.
// regular_complaint shares the regular actor shape with drinkOrder but
// targets the `complaint` type (irritation > 60 branch). customer_complaint
// centres on a customer-group cohort — a new actor kind for the gate
// harness, so it needs its own install/seed helpers and its own
// CustomerGroupCastAttributes factory.

function customerGroupRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}

function firstCustomerGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a customer group')
  }
  return id
}

function installGroupCast(
  state: TavernState,
  groupId: string,
  cast: CustomerGroupCastAttributes,
): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [groupId]: {
        ...state.customerGroups[groupId]!,
        castAttributes: cast,
      },
    },
  }
}

function regularComplaintSeedFor(regularId: string, id: string): IssueSeed {
  const shape = REGULAR_CUSTOMER_COMPLAINT_SHAPE()
  return makeSeed({
    id,
    family: 'regular_customer',
    type: 'complaint',
    timing: 'during_service',
    severity: 60,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'a sour mood',
      sensoryDetails: ['half-empty mug', 'cold stare'],
      recentContext: ['irritation 75'],
    },
  })
}

function customerComplaintSeedFor(groupId: string, id: string): IssueSeed {
  const shape = CUSTOMER_COMPLAINT_SHAPE()
  return makeSeed({
    id,
    family: 'customer_complaint',
    type: 'complaint',
    timing: 'during_service',
    severity: 55,
    domain: ['customers', 'reputation', 'service'],
    primaryActor: customerGroupRef(groupId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'a cold welcome',
      sensoryDetails: ['pursed lips', 'half-finished mugs'],
      recentContext: ['main room dirty all week'],
    },
  })
}

export function buildRegularComplaintDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const regularId = firstRegularId(baseState)
  const profiles: CastAttributes[] = [
    neutralCast(),
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } },
    },
    {
      ...neutralCast(),
      voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } },
    },
    ...VERBAL_TIC_IDS.map<CastAttributes>((tic) => ({
      ...neutralCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: regularComplaintSeedFor(regularId, `regular-complaint-determinism-${i}`),
    state: installCast(baseState, regularId, cast),
  }))
}

export function buildRegularComplaintDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-134-regular-complaint-diversity'
  const rng = createRng(`${seed}:regular_complaint`)
  const baseState = createInitialTavernState()
  const regularId = firstRegularId(baseState)
  return (i: number) => {
    const cast = createRegularCastAttributes({ rng })
    const state = installCast(baseState, regularId, cast)
    return {
      seed: regularComplaintSeedFor(regularId, `regular-complaint-diversity-${i}`),
      state,
    }
  }
}

export function buildCustomerComplaintDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const groupId = firstCustomerGroupId(baseState)
  // Customer-group cast carries only the voice axes (no specialty /
  // blindspot / affinities) so we don't reuse `neutralCast()`. The
  // profiles still cover the full one-axis, two-axis, and tic space.
  const profiles: CustomerGroupCastAttributes[] = [
    { voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } } },
    ...VERBAL_TIC_IDS.map<CustomerGroupCastAttributes>((tic) => ({
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: customerComplaintSeedFor(groupId, `customer-complaint-determinism-${i}`),
    state: installGroupCast(baseState, groupId, cast),
  }))
}

export function buildCustomerComplaintDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-134-customer-complaint-diversity'
  const rng = createRng(`${seed}:customer_complaint`)
  const baseState = createInitialTavernState()
  const groupId = firstCustomerGroupId(baseState)
  const cultureId = baseState.customerGroups[groupId]!.cultureId
  return (i: number) => {
    const cast = createCustomerGroupCastAttributes({ rng, cultureId })
    const state = installGroupCast(baseState, groupId, cast)
    return {
      seed: customerComplaintSeedFor(groupId, `customer-complaint-diversity-${i}`),
      state,
    }
  }
}

// Phase 6 context builders for the two new templates' choice-label and
// effect-preview pools. Mirror the drinkOrder / staffAside helpers; the
// representative response slots cover the verb-gated rungs in each pool.

// Five slots, one per verb the regularComplaint choice-label pool gates
// on. Rotated by index so the diversity gate can sample every rung.
const REGULAR_COMPLAINT_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase134-regular-appease',
    labelHint: 'Apologise',
    allowedVerbs: ['appease'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise loyalty'],
  },
  {
    id: 'phase134-regular-discount',
    labelHint: 'Comp a meal',
    allowedVerbs: ['discount'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise loyalty'],
  },
  {
    id: 'phase134-regular-ignore',
    labelHint: 'Ignore the regular',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise regular loss pressure'],
  },
  {
    id: 'phase134-regular-ban',
    labelHint: 'Ban the regular',
    allowedVerbs: ['ban'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'escalation' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lose regular'],
  },
  {
    id: 'phase134-regular-blame',
    labelHint: 'Refuse the request',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['hold the line'],
  },
]

const REGULAR_COMPLAINT_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'cause',
    target: 'regular.example',
    amount: 8,
    readable: 'loyalty rises',
    tags: ['regular'],
  },
  {
    kind: 'state_change',
    target: 'noop',
    amount: 0,
    readable: 'nothing changes',
    tags: [],
  },
]

// Five slots, one per verb the customerComplaint choice-label pool gates
// on. The starter Adventurers culture biases voice axes (high floridity,
// low terseness/formality) so the verbs paired with the axis-bound rungs
// must include rebrand (paired with floridity ≥ 2) and clean (paired with
// terseness ≥ 2 — fires rarely under this culture, lifted by the other
// rungs).
const CUSTOMER_COMPLAINT_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase134-cohort-discount',
    labelHint: 'Offer a discount',
    allowedVerbs: ['discount'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise satisfaction'],
  },
  {
    id: 'phase134-cohort-appease',
    labelHint: 'Public apology',
    allowedVerbs: ['appease'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise satisfaction'],
  },
  {
    id: 'phase134-cohort-blame',
    labelHint: 'Side with the house',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lose group trust'],
  },
  {
    id: 'phase134-cohort-rebrand',
    labelHint: 'Rebrand the issue',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift reputation'],
  },
  {
    id: 'phase134-cohort-clean',
    labelHint: 'Fix the root cause',
    allowedVerbs: ['clean'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise cleanliness'],
  },
]

const CUSTOMER_COMPLAINT_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'customer.satisfaction',
    amount: 10,
    readable: 'satisfaction climbs',
    tags: ['customer'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -10,
    readable: 'coin cost',
    tags: ['coin'],
  },
]

export function buildRegularComplaintChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = REGULAR_COMPLAINT_RESPONSE_SLOTS[i % REGULAR_COMPLAINT_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildRegularComplaintEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = REGULAR_COMPLAINT_RESPONSE_SLOTS[i % REGULAR_COMPLAINT_RESPONSE_SLOTS.length]!
  const effect = REGULAR_COMPLAINT_EFFECTS[i % REGULAR_COMPLAINT_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

export function buildCustomerComplaintChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = CUSTOMER_COMPLAINT_RESPONSE_SLOTS[i % CUSTOMER_COMPLAINT_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildCustomerComplaintEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = CUSTOMER_COMPLAINT_RESPONSE_SLOTS[i % CUSTOMER_COMPLAINT_RESPONSE_SLOTS.length]!
  const effect = CUSTOMER_COMPLAINT_EFFECTS[i % CUSTOMER_COMPLAINT_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 ----
//
// Samplers for the three new templates in the Suppliers/Stock/Debt
// cluster. Three patterns:
//
//   - supplierReliability: actor-perturbation, mirroring regularComplaint
//     and staffBurnout. A supplier actor carries `castAttributes`; the
//     determinism sampler hand-picks profiles; the diversity sampler
//     rolls per-sample via `createSupplierCastAttributes`.
//
//   - stockShortage / debtRent: STATE-perturbation. These seeds have no
//     primaryActor (stock_shortage's subject is a stock item, debt_rent's
//     landlord is `systemRef`), so the snippet pools gate on
//     `pressureRising` / `memoryPresent` / `hasTag` / `severityAtLeast` /
//     `repeatCount` rather than voice axes. Both samplers vary the
//     STATE the conditions read, not the cast attributes.

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a supplier')
  }
  return id
}

function supplierRef(id: string): EntityRef {
  return { kind: 'supplier', id }
}

function installSupplierCast(
  state: TavernState,
  supplierId: string,
  cast: SupplierCastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...state.world.suppliers[supplierId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function supplierOfferSeedFor(supplierId: string, id: string): IssueSeed {
  const shape = SUPPLIER_RELATIONSHIP_SHAPE()
  return makeSeed({
    id,
    family: 'supplier_relationship',
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers', 'market', 'stock'],
    primaryActor: supplierRef(supplierId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'a supply matter',
      sensoryDetails: ['stacked crates', 'tight handshake'],
      recentContext: ['reliability questions'],
    },
  })
}

function neutralSupplierCast(): SupplierCastAttributes {
  return {
    specialty: 'goods',
    blindspot: 'late_payment',
    affinities: [],
    voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
  }
}

export function buildSupplierReliabilityDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const supplierId = firstSupplierId(baseState)
  // Suppliers carry the full four-axis voice + optional verbalTic surface
  // (same as staff / regulars). Profiles cover one-axis extremes,
  // two-axis combos, and one snippet per verbal tic.
  const profiles: SupplierCastAttributes[] = [
    neutralSupplierCast(),
    { ...neutralSupplierCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } } },
    ...VERBAL_TIC_IDS.map<SupplierCastAttributes>((tic) => ({
      ...neutralSupplierCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: supplierOfferSeedFor(supplierId, `supplier-reliability-determinism-${i}`),
    state: installSupplierCast(baseState, supplierId, cast),
  }))
}

export function buildSupplierReliabilityDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-135-supplier-reliability-diversity'
  const rng = createRng(`${seed}:supplier_identity`)
  const baseState = createInitialTavernState()
  const supplierId = firstSupplierId(baseState)
  const supplier = baseState.world.suppliers[supplierId]!
  return (i: number) => {
    const cast = createSupplierCastAttributes({
      supplierType: supplier.supplierType,
      ...(supplier.cultureId !== undefined ? { cultureId: supplier.cultureId } : {}),
      rng,
    })
    const state = installSupplierCast(baseState, supplierId, cast)
    return {
      seed: supplierOfferSeedFor(
        supplierId,
        `supplier-reliability-diversity-${i}`,
      ),
      state,
    }
  }
}

// ---- stockShortage state-perturbation sampler ----
//
// stock_shortage seeds have no primaryActor; the snippet pools gate on
// state (pressures rising, prior-choice memories, calendar tone tags,
// severity) and seed shape (timing, tags). The sampler perturbs those
// across the sample loop. Each `i` rolls a deterministic combination
// from the seeded RNG.

function stockShortageBaseSeed(
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = STOCK_SHORTAGE_SHAPE()
  return makeSeed({
    id,
    family: 'stock_shortage',
    type: 'warning',
    timing: 'morning_prep',
    severity,
    domain: ['stock', 'customers'],
    toneHints: [...toneHints],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'ale stock',
      sensoryDetails: ['empty kegs'],
      recentContext: ['heavy week'],
    },
  })
}

function withPressure(
  state: TavernState,
  pressureId: string,
  value: number,
  trend: number,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [pressureId]: {
        id: pressureId,
        label: pressureId,
        value,
        trend,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function withMemoryEntry(
  state: TavernState,
  memoryId: string,
  tags: readonly string[],
): TavernState {
  return {
    ...state,
    memories: [
      ...state.memories,
      {
        id: memoryId,
        type: 'fact' as const,
        label: memoryId,
        strength: 50,
        ageDays: 1,
        createdAt: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        actors: [] as EntityRef[],
        locations: [] as EntityRef[],
        relatedSystems: [] as string[],
        tags: [...tags],
      },
    ],
  }
}

// Pre-computed perturbation slots — index `i mod N` picks one.
// Each entry names the (rising-pressure, memory-tags, tone-hint,
// severity) combination so the gate sees the whole condition space.
const STOCK_PERTURBATIONS: ReadonlyArray<{
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline — no rising pressure, no memories, neutral tone.
  { toneHints: ['warning'], severity: 50 },
  // Rising stock_shortage alone.
  {
    pressure: { id: 'stock_shortage', value: 60, trend: 1 },
    toneHints: ['warning'],
    severity: 50,
  },
  // Rising reputation_drift.
  {
    pressure: { id: 'reputation_drift', value: 40, trend: 1 },
    toneHints: ['warning'],
    severity: 50,
  },
  // Memory of deception (watered batch).
  {
    memory: { id: 'watered_ale_recently', tags: ['ale', 'deception'] },
    toneHints: ['warning'],
    severity: 50,
  },
  // Memory of price hike.
  {
    memory: { id: 'raised_prices_recently', tags: ['price', 'reputation'] },
    toneHints: ['warning'],
    severity: 50,
  },
  // Memory of ignoring the shortage.
  {
    memory: { id: 'ignored_shortage_recently', tags: ['stock', 'ignored'] },
    toneHints: ['warning'],
    severity: 50,
  },
  // High demand day type.
  { toneHints: ['urgent', 'high_demand', 'payday'], severity: 50 },
  // Brawl night.
  { toneHints: ['urgent', 'high_demand', 'brawl_night'], severity: 60 },
  // Market day.
  { toneHints: ['urgent', 'high_demand', 'market_day'], severity: 55 },
  // Local night.
  { toneHints: ['urgent', 'high_demand', 'local_night'], severity: 55 },
  // High severity.
  { toneHints: ['warning', 'urgent'], severity: 75 },
  // Rising stock + repeat (three stock memories tagged 'stock').
  {
    pressure: { id: 'stock_shortage', value: 70, trend: 1 },
    memory: { id: 'stock_repeat_marker', tags: ['stock'] },
    toneHints: ['urgent'],
    severity: 72,
  },
]

function buildStockShortageState(
  baseState: TavernState,
  perturbation: (typeof STOCK_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    // Mirror entries with the same tags to push `repeatCount stock` to 3+
    // when the perturbation is the dedicated "repeat" slot.
    if (perturbation.memory.id === 'stock_repeat_marker') {
      s = withMemoryEntry(s, 'stock_repeat_marker_b', ['stock'])
      s = withMemoryEntry(s, 'stock_repeat_marker_c', ['stock'])
    }
  }
  return s
}

export function buildStockShortageDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return STOCK_PERTURBATIONS.map((perturbation, i) => ({
    seed: stockShortageBaseSeed(
      `stock-shortage-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildStockShortageState(baseState, perturbation),
  }))
}

export function buildStockShortageDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  // Phase 135 — deterministic state-perturbation. Use `i` modulo the
  // pre-computed perturbation table; rngSeed only namespaces the cache
  // string, since the sampler reads no rng directly (state is data, not
  // RNG output).
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation = STOCK_PERTURBATIONS[i % STOCK_PERTURBATIONS.length]!
    return {
      seed: stockShortageBaseSeed(
        `stock-shortage-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildStockShortageState(baseState, perturbation),
    }
  }
}

// ---- debtRent state-perturbation sampler ----

function debtRentBaseSeed(
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = DEBT_RENT_SHAPE()
  return makeSeed({
    id,
    family: 'debt_rent',
    type: 'debt_pressure',
    timing: 'end_month',
    severity,
    domain: ['economy', 'monthly', 'landlord'],
    toneHints: [...toneHints],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'rent due',
      sensoryDetails: ['scratched ledger'],
      recentContext: ['coin tight for weeks'],
    },
  })
}

const DEBT_PERTURBATIONS: ReadonlyArray<{
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline.
  { toneHints: ['debt', 'pressure'], severity: 50 },
  // Rising debt.
  {
    pressure: { id: 'debt', value: 45, trend: 1 },
    toneHints: ['debt', 'pressure'],
    severity: 50,
  },
  // Rising landlord.
  {
    pressure: { id: 'landlord', value: 45, trend: 1 },
    toneHints: ['debt', 'pressure'],
    severity: 50,
  },
  // rent_paid_recently memory.
  {
    memory: { id: 'rent_paid_recently', tags: ['rent', 'landlord'] },
    toneHints: ['debt', 'pressure'],
    severity: 50,
  },
  // rent_delayed_recently memory.
  {
    memory: { id: 'rent_delayed_recently', tags: ['rent', 'delay'] },
    toneHints: ['debt', 'pressure'],
    severity: 50,
  },
  // borrowed_coin_recently memory.
  {
    memory: { id: 'borrowed_coin_recently', tags: ['coin', 'debt'] },
    toneHints: ['debt', 'pressure'],
    severity: 55,
  },
  // eviction_threat_possible (landlord/risk memory).
  {
    memory: { id: 'eviction_threat_possible', tags: ['landlord', 'risk'] },
    toneHints: ['debt', 'pressure'],
    severity: 60,
  },
  // rent_due_soon calendar tag (flows through toneHints in the test seed).
  { toneHints: ['debt', 'pressure', 'rent_due_soon'], severity: 55 },
  // High severity.
  { toneHints: ['debt', 'pressure', 'urgent'], severity: 75 },
  // Rising debt + repeat (three debt-tagged memories).
  {
    pressure: { id: 'debt', value: 70, trend: 1 },
    memory: { id: 'debt_repeat_marker', tags: ['debt'] },
    toneHints: ['debt', 'pressure'],
    severity: 72,
  },
  // Rising debt + rent_due_soon.
  {
    pressure: { id: 'debt', value: 60, trend: 1 },
    toneHints: ['debt', 'pressure', 'rent_due_soon'],
    severity: 70,
  },
  // High severity + rent_due_soon (top rung).
  { toneHints: ['debt', 'pressure', 'rent_due_soon', 'urgent'], severity: 80 },
]

function buildDebtRentState(
  baseState: TavernState,
  perturbation: (typeof DEBT_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'debt_repeat_marker') {
      s = withMemoryEntry(s, 'debt_repeat_marker_b', ['debt'])
      s = withMemoryEntry(s, 'debt_repeat_marker_c', ['debt'])
    }
  }
  return s
}

export function buildDebtRentDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return DEBT_PERTURBATIONS.map((perturbation, i) => ({
    seed: debtRentBaseSeed(
      `debt-rent-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildDebtRentState(baseState, perturbation),
  }))
}

export function buildDebtRentDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation = DEBT_PERTURBATIONS[i % DEBT_PERTURBATIONS.length]!
    return {
      seed: debtRentBaseSeed(
        `debt-rent-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildDebtRentState(baseState, perturbation),
    }
  }
}

// ---- Phase 6 context builders for the three new templates ----

// Supplier verb set surfaces at `expandedSeedGenerators.ts:1189-1255` —
// pay / negotiate / blame / fire / buy / ignore / inspect. Six rungs
// rotated by index so the diversity gate samples every verb at least once.
const SUPPLIER_RELIABILITY_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase135-supplier-pay',
    labelHint: 'Pay the supplier',
    allowedVerbs: ['pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['clear debt'],
  },
  {
    id: 'phase135-supplier-negotiate',
    labelHint: 'Negotiate',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift price'],
  },
  {
    id: 'phase135-supplier-blame',
    labelHint: 'Blame supplier',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shed blame'],
  },
  {
    id: 'phase135-supplier-fire',
    labelHint: 'Switch supplier',
    allowedVerbs: ['fire'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['change goods quality'],
  },
  {
    id: 'phase135-supplier-ignore',
    labelHint: 'Refuse the offer',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no risk'],
  },
  {
    id: 'phase135-supplier-buy',
    labelHint: 'Accept suspicious goods',
    allowedVerbs: ['buy'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['cheap stock'],
  },
]

const SUPPLIER_RELIABILITY_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'coin',
    amount: -20,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'supplier.relationship',
    amount: 5,
    readable: 'relationship steadies',
    tags: ['supplier'],
  },
  {
    kind: 'pressure',
    target: 'pressure:market_instability',
    amount: -5,
    readable: 'market pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'cause',
    target: 'supplier.trust',
    amount: 3,
    readable: 'trust shifts',
    tags: ['supplier'],
  },
]

export function buildSupplierReliabilityChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    SUPPLIER_RELIABILITY_RESPONSE_SLOTS[
      i % SUPPLIER_RELIABILITY_RESPONSE_SLOTS.length
    ]!
  return { currentResponseSlot: slot }
}

export function buildSupplierReliabilityEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    SUPPLIER_RELIABILITY_RESPONSE_SLOTS[
      i % SUPPLIER_RELIABILITY_RESPONSE_SLOTS.length
    ]!
  const effect = SUPPLIER_RELIABILITY_EFFECTS[i % SUPPLIER_RELIABILITY_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// stockShortage verbs at `issueSeedGenerators.ts:443-484` —
// buy / raise_price / serve / delay / ignore.
const STOCK_SHORTAGE_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase135-stock-buy',
    labelHint: 'Restock ale',
    allowedVerbs: ['buy'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise ale quantity'],
  },
  {
    id: 'phase135-stock-raise-price',
    labelHint: 'Raise prices',
    allowedVerbs: ['raise_price'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise margin'],
  },
  {
    id: 'phase135-stock-serve',
    labelHint: 'Stretch the ale',
    allowedVerbs: ['serve'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower quality'],
  },
  {
    id: 'phase135-stock-delay',
    labelHint: 'Limit sales',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['conserve stock'],
  },
  {
    id: 'phase135-stock-ignore',
    labelHint: 'Ignore the shortage',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no change'],
  },
]

const STOCK_SHORTAGE_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'stock.ale.quantity',
    amount: 60,
    readable: 'add ale to stock',
    tags: ['stock'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -30,
    readable: 'spend coin restocking',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'stock.ale.quality',
    amount: -15,
    readable: 'lower ale quality',
    tags: ['stock', 'quality'],
  },
  {
    kind: 'pressure',
    target: 'pressure:stock_shortage',
    amount: -15,
    readable: 'lower shortage pressure',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'customers.miners.satisfaction',
    amount: -8,
    readable: 'miners grumble',
    tags: ['customer'],
  },
  {
    kind: 'future_hook',
    target: 'ale_watering_rumor_possible',
    amount: 0,
    readable: 'watered ale rumor may emerge',
    tags: ['future_hook'],
  },
]

export function buildStockShortageChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    STOCK_SHORTAGE_RESPONSE_SLOTS[i % STOCK_SHORTAGE_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildStockShortageEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    STOCK_SHORTAGE_RESPONSE_SLOTS[i % STOCK_SHORTAGE_RESPONSE_SLOTS.length]!
  const effect = STOCK_SHORTAGE_EFFECTS[i % STOCK_SHORTAGE_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// debtRent verbs at `issueSeedGenerators.ts:2406-2439` —
// pay / borrow / delay / raise_price.
const DEBT_RENT_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase135-debt-pay',
    labelHint: 'Pay what we owe',
    allowedVerbs: ['pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['clear arrears'],
  },
  {
    id: 'phase135-debt-borrow',
    labelHint: 'Borrow coin',
    allowedVerbs: ['borrow'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['gain coin'],
  },
  {
    id: 'phase135-debt-delay',
    labelHint: 'Delay payment',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'delay_problem' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no immediate cost'],
  },
  {
    id: 'phase135-debt-raise-price',
    labelHint: 'Raise prices',
    allowedVerbs: ['raise_price'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise margin'],
  },
]

const DEBT_RENT_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'coin',
    amount: -30,
    readable: 'pay rent',
    tags: ['coin', 'rent'],
  },
  {
    kind: 'pressure',
    target: 'pressure:landlord',
    amount: -15,
    readable: 'lower landlord pressure',
    tags: ['pressure', 'landlord'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: 40,
    readable: 'borrowed coin',
    tags: ['coin'],
  },
  {
    kind: 'pressure',
    target: 'pressure:debt',
    amount: 12,
    readable: 'future debt builds',
    tags: ['pressure', 'debt'],
  },
  {
    kind: 'future_hook',
    target: 'loan_due_soon',
    amount: 0,
    readable: 'loan will come due',
    tags: ['debt'],
  },
]

export function buildDebtRentChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = DEBT_RENT_RESPONSE_SLOTS[i % DEBT_RENT_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildDebtRentEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = DEBT_RENT_RESPONSE_SLOTS[i % DEBT_RENT_RESPONSE_SLOTS.length]!
  const effect = DEBT_RENT_EFFECTS[i % DEBT_RENT_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 ----
//
// Samplers for the two new templates in the Factions & Culture cluster.
// Two patterns:
//
//   - factionRequest: actor-perturbation, mirroring supplierReliability.
//     A faction actor carries `castAttributes` (Phase 128); the determinism
//     sampler hand-picks profiles; the diversity sampler rolls per-sample
//     via `createFactionCastAttributes`.
//
//   - cultureConflict: STATE-perturbation. Cultures have meters but no
//     castAttributes — the snippet pools gate on culture.* signal bands
//     (Phase 136 loopback), pressureRising, memoryPresent, repeatCount,
//     hasTag (festival/ritual), and severityAtLeast — never on voice
//     axes. The sampler varies the STATE the conditions read.

function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a faction')
  }
  return id
}

function factionRef(id: string): EntityRef {
  return { kind: 'faction', id }
}

function installFactionCast(
  state: TavernState,
  factionId: string,
  cast: FactionCastAttributes,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [factionId]: {
          ...state.world.factions[factionId]!,
          castAttributes: cast,
        },
      },
    },
  }
}

function factionRequestSeedFor(factionId: string, id: string): IssueSeed {
  const shape = FACTION_REQUEST_SHAPE()
  return makeSeed({
    id,
    family: 'faction_request',
    type: 'social_conflict',
    timing: 'during_service',
    severity: 45,
    domain: ['factions', 'social'],
    primaryActor: factionRef(factionId),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'a delegation visit',
      sensoryDetails: ['folded arms', 'measured glances'],
      recentContext: ['relationship questions'],
    },
  })
}

function neutralFactionCast(): FactionCastAttributes {
  return {
    specialty: 'ceremony',
    blindspot: 'patience',
    affinities: [],
    voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } },
  }
}

export function buildFactionRequestDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const factionId = firstFactionId(baseState)
  const profiles: FactionCastAttributes[] = [
    neutralFactionCast(),
    { ...neutralFactionCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 0 } } },
    ...VERBAL_TIC_IDS.map<FactionCastAttributes>((tic) => ({
      ...neutralFactionCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: factionRequestSeedFor(factionId, `faction-request-determinism-${i}`),
    state: installFactionCast(baseState, factionId, cast),
  }))
}

export function buildFactionRequestDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-136-faction-request-diversity'
  const rng = createRng(`${seed}:faction_identity`)
  const baseState = createInitialTavernState()
  const factionId = firstFactionId(baseState)
  const faction = baseState.world.factions[factionId]!
  return (i: number) => {
    const cast = createFactionCastAttributes({
      ...(faction.cultureId !== undefined ? { cultureId: faction.cultureId } : {}),
      rng,
    })
    const state = installFactionCast(baseState, factionId, cast)
    return {
      seed: factionRequestSeedFor(factionId, `faction-request-diversity-${i}`),
      state,
    }
  }
}

// ---- cultureConflict state-perturbation sampler ----
//
// culture_conflict seeds carry a culture primaryActor that has no
// castAttributes. The snippet pools gate on culture.* signal bands,
// cultural_tension pressure rising, prior-choice memory tags
// (ignored / neglected / honour / mediation / seating), repeatCount,
// hasTag (festival / ritual), and severity. The sampler perturbs those
// across the sample loop.

function firstCultureId(state: TavernState): string {
  const id = Object.keys(state.world.cultures)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have a culture')
  }
  return id
}

function cultureRef(id: string): EntityRef {
  return { kind: 'culture', id }
}

function cultureConflictBaseSeed(
  cultureId: string,
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = CULTURE_CONFLICT_SHAPE()
  return makeSeed({
    id,
    family: 'culture_conflict',
    type: 'social_conflict',
    timing: 'during_service',
    severity,
    domain: ['cultures', 'social'],
    primaryActor: cultureRef(cultureId),
    toneHints: [...toneHints],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'cultural friction',
      sensoryDetails: ['drawn breath', 'shifted seat'],
      recentContext: ['quiet tables'],
    },
  })
}

function withCultureMeters(
  state: TavernState,
  cultureId: string,
  overrides: Partial<{ tension: number; comfort: number; familiarity: number }>,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      cultures: {
        ...state.world.cultures,
        [cultureId]: {
          ...state.world.cultures[cultureId]!,
          ...overrides,
        },
      },
    },
  }
}

const CULTURE_PERTURBATIONS: ReadonlyArray<{
  meters?: Partial<{ tension: number; comfort: number; familiarity: number }>
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline.
  { toneHints: ['culture', 'tension'], severity: 50 },
  // High tension (band: high).
  {
    meters: { tension: 80 },
    toneHints: ['culture', 'tension'],
    severity: 55,
  },
  // Low comfort.
  {
    meters: { comfort: 25 },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // High comfort.
  {
    meters: { comfort: 80 },
    toneHints: ['culture', 'tension'],
    severity: 45,
  },
  // Low familiarity.
  {
    meters: { familiarity: 25 },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // High familiarity.
  {
    meters: { familiarity: 80 },
    toneHints: ['culture', 'tension'],
    severity: 45,
  },
  // Rising cultural_tension pressure.
  {
    pressure: { id: 'cultural_tension', value: 50, trend: 1 },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // Memory of ignoring the custom.
  {
    memory: { id: 'culture_ignored_recently', tags: ['culture', 'ignored'] },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // Memory of neglecting the group.
  {
    memory: { id: 'culture_neglected_recently', tags: ['culture', 'neglected'] },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // Memory of honouring the custom.
  {
    memory: { id: 'culture_honoured_recently', tags: ['culture', 'honour'] },
    toneHints: ['culture', 'tension'],
    severity: 45,
  },
  // Memory of prior mediation.
  {
    memory: { id: 'culture_mediated_recently', tags: ['culture', 'mediation'] },
    toneHints: ['culture', 'tension'],
    severity: 45,
  },
  // Memory of seating change.
  {
    memory: { id: 'culture_seating_recently', tags: ['culture', 'seating'] },
    toneHints: ['culture', 'tension'],
    severity: 50,
  },
  // Festival calendar tag.
  { toneHints: ['culture', 'tension', 'festival'], severity: 55 },
  // Ritual calendar tag.
  { toneHints: ['culture', 'tension', 'ritual'], severity: 55 },
  // High severity baseline.
  { toneHints: ['culture', 'tension', 'urgent'], severity: 75 },
  // High tension + repeat (three culture-tagged memories).
  {
    meters: { tension: 80 },
    memory: { id: 'culture_repeat_marker', tags: ['culture'] },
    toneHints: ['culture', 'tension', 'urgent'],
    severity: 72,
  },
  // Rising + ignored (top rung).
  {
    pressure: { id: 'cultural_tension', value: 60, trend: 1 },
    memory: { id: 'culture_ignored_repeat', tags: ['culture', 'ignored'] },
    toneHints: ['culture', 'tension', 'urgent'],
    severity: 65,
  },
  // Rising + festival (top rung).
  {
    pressure: { id: 'cultural_tension', value: 55, trend: 1 },
    toneHints: ['culture', 'tension', 'festival'],
    severity: 60,
  },
  // High severity + repeat (top rung on reaction).
  {
    memory: { id: 'culture_severity_repeat', tags: ['culture'] },
    toneHints: ['culture', 'tension', 'urgent'],
    severity: 75,
  },
]

function buildCultureConflictState(
  baseState: TavernState,
  cultureId: string,
  perturbation: (typeof CULTURE_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.meters) {
    s = withCultureMeters(s, cultureId, perturbation.meters)
  }
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (
      perturbation.memory.id === 'culture_repeat_marker' ||
      perturbation.memory.id === 'culture_severity_repeat'
    ) {
      s = withMemoryEntry(s, `${perturbation.memory.id}_b`, ['culture'])
      s = withMemoryEntry(s, `${perturbation.memory.id}_c`, ['culture'])
    }
  }
  return s
}

export function buildCultureConflictDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const cultureId = firstCultureId(baseState)
  return CULTURE_PERTURBATIONS.map((perturbation, i) => ({
    seed: cultureConflictBaseSeed(
      cultureId,
      `culture-conflict-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildCultureConflictState(baseState, cultureId, perturbation),
  }))
}

export function buildCultureConflictDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  const cultureId = firstCultureId(baseState)
  return (i: number) => {
    const perturbation = CULTURE_PERTURBATIONS[i % CULTURE_PERTURBATIONS.length]!
    return {
      seed: cultureConflictBaseSeed(
        cultureId,
        `culture-conflict-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildCultureConflictState(baseState, cultureId, perturbation),
    }
  }
}

// ---- Phase 6 context builders for the two new Phase-10 templates ----

// faction_request verb surface (expandedSeedGenerators.ts:1930-1979):
// appease / pay / negotiate / blame / ignore / threaten / invite.
const FACTION_REQUEST_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase136-faction-appease',
    labelHint: 'Appease them',
    allowedVerbs: ['appease', 'pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise relationship'],
  },
  {
    id: 'phase136-faction-negotiate',
    labelHint: 'Negotiate terms',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise relationship'],
  },
  {
    id: 'phase136-faction-blame',
    labelHint: 'Lay the fault',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['hold ground'],
  },
  {
    id: 'phase136-faction-ignore',
    labelHint: 'Refuse outright',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'escalation' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lose relationship'],
  },
  {
    id: 'phase136-faction-threaten',
    labelHint: 'Call the watch',
    allowedVerbs: ['threaten'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'escalation' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower tension'],
  },
  {
    id: 'phase136-faction-invite',
    labelHint: 'Host them tonight',
    allowedVerbs: ['invite'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise relationship'],
  },
]

const FACTION_REQUEST_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'factions.example.relationship',
    amount: 10,
    readable: 'relationship rises',
    tags: ['faction'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -15,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'pressure',
    target: 'pressure:faction_anger',
    amount: -10,
    readable: 'anger eases',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'faction_grudge_example',
    amount: 0,
    readable: 'faction may retaliate',
    tags: ['future_hook'],
  },
]

export function buildFactionRequestChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = FACTION_REQUEST_RESPONSE_SLOTS[i % FACTION_REQUEST_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildFactionRequestEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = FACTION_REQUEST_RESPONSE_SLOTS[i % FACTION_REQUEST_RESPONSE_SLOTS.length]!
  const effect = FACTION_REQUEST_EFFECTS[i % FACTION_REQUEST_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// culture_conflict verb surface (expandedSeedGenerators.ts:2238-2287):
// appease / negotiate / invite / serve / ignore / rebrand / discount /
// delegate.
const CULTURE_CONFLICT_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase136-culture-mediate',
    labelHint: 'Mediate between groups',
    allowedVerbs: ['appease', 'negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower tension'],
  },
  {
    id: 'phase136-culture-invite',
    labelHint: 'Honour the custom',
    allowedVerbs: ['invite', 'serve'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise familiarity'],
  },
  {
    id: 'phase136-culture-ignore',
    labelHint: 'Ignore the custom',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise tension'],
  },
  {
    id: 'phase136-culture-rebrand',
    labelHint: 'Change seating',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower tension'],
  },
  {
    id: 'phase136-culture-discount',
    labelHint: 'Stand a round',
    allowedVerbs: ['discount'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise comfort'],
  },
  {
    id: 'phase136-culture-delegate',
    labelHint: 'Ask staff to intervene',
    allowedVerbs: ['delegate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'delay_problem' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower visible tension'],
  },
]

const CULTURE_CONFLICT_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'cultures.example.tension',
    amount: -10,
    readable: 'tension drops',
    tags: ['culture'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -10,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'pressure',
    target: 'pressure:cultural_tension',
    amount: -10,
    readable: 'tension eases',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'reputation.strange',
    amount: 6,
    readable: 'house reads as taking sides',
    tags: ['reputation'],
  },
  {
    kind: 'pressure',
    target: 'pressure:staff_burnout',
    amount: 8,
    readable: 'staff carry the strain',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'culture_walkout_risk_example',
    amount: 0,
    readable: 'culture may walk out',
    tags: ['future_hook'],
  },
]

export function buildCultureConflictChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = CULTURE_CONFLICT_RESPONSE_SLOTS[i % CULTURE_CONFLICT_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildCultureConflictEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = CULTURE_CONFLICT_RESPONSE_SLOTS[i % CULTURE_CONFLICT_RESPONSE_SLOTS.length]!
  const effect = CULTURE_CONFLICT_EFFECTS[i % CULTURE_CONFLICT_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 ----
//
// Samplers for the two new templates in the Premises & Atmosphere cluster.
// Both are narrator-voiced (areas have no `castAttributes`), so the
// diversity sampler perturbs STATE — area meters via the Phase-1 signal
// surface (including the Phase-11 `area.damage` loopback), pressures,
// memories, calendar tone tags, and severity — never cast attributes.
// The sampler resolves the area through `seed.location` (the Phase-11
// `resolveActorRef` extension to the `'location'` role).

function firstAreaId(state: TavernState): string {
  const id = Object.keys(state.areas)[0]
  if (!id) {
    throw new Error('samplers: createInitialTavernState() must have an area')
  }
  return id
}

function withAreaMeters(
  state: TavernState,
  areaId: string,
  overrides: Partial<{ damage: number; cleanliness: number; condition: number }>,
): TavernState {
  return {
    ...state,
    areas: {
      ...state.areas,
      [areaId]: {
        ...state.areas[areaId]!,
        ...overrides,
      },
    },
  }
}

function maintenanceBaseSeed(
  areaId: string,
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = MAINTENANCE_SHAPE()
  return makeSeed({
    id,
    family: 'maintenance',
    type: 'maintenance_problem',
    timing: 'morning_prep',
    severity,
    domain: ['areas', 'maintenance'],
    location: { kind: 'area', id: areaId },
    toneHints: [...toneHints],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'visible damage',
      sensoryDetails: ['cracked plank'],
      recentContext: ['damage worsening'],
    },
  })
}

const MAINTENANCE_PERTURBATIONS: ReadonlyArray<{
  meters?: Partial<{ damage: number; condition: number; cleanliness: number }>
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline.
  { toneHints: ['maintenance'], severity: 50 },
  // High damage (band: high).
  { meters: { damage: 80 }, toneHints: ['maintenance', 'risk'], severity: 55 },
  // Low condition (band: low).
  { meters: { condition: 25 }, toneHints: ['maintenance'], severity: 55 },
  // Rising maintenance pressure.
  {
    pressure: { id: 'maintenance', value: 60, trend: 1 },
    toneHints: ['maintenance'],
    severity: 50,
  },
  // Memory of warning.
  {
    memory: { id: 'maintenance_warning_seen', tags: ['maintenance', 'warning'] },
    toneHints: ['maintenance'],
    severity: 50,
  },
  // Memory of ignoring.
  {
    memory: { id: 'habitual_roof_neglect', tags: ['maintenance', 'ignored'] },
    toneHints: ['maintenance'],
    severity: 50,
  },
  // Memory of patch.
  {
    memory: { id: 'main_room_patched_recently', tags: ['maintenance', 'patch'] },
    toneHints: ['maintenance'],
    severity: 50,
  },
  // Inspection-relevant tone.
  { toneHints: ['maintenance', 'inspection_relevant'], severity: 60 },
  // Fire-risk tone.
  { toneHints: ['maintenance', 'fire_risk'], severity: 55 },
  // Urgent tone.
  { toneHints: ['maintenance', 'urgent'], severity: 65 },
  // High damage + rising pressure (top rung on establishing).
  {
    meters: { damage: 80 },
    pressure: { id: 'maintenance', value: 70, trend: 1 },
    toneHints: ['maintenance', 'urgent'],
    severity: 75,
  },
  // High severity + repeat (three maintenance-tagged memories).
  {
    memory: { id: 'maintenance_repeat_marker', tags: ['maintenance'] },
    toneHints: ['maintenance', 'urgent'],
    severity: 80,
  },
  // Rising pressure + ignored memory (reaction's two-condition rung).
  {
    pressure: { id: 'maintenance', value: 65, trend: 1 },
    memory: { id: 'ignored_maintenance', tags: ['maintenance', 'ignored'] },
    toneHints: ['maintenance'],
    severity: 60,
  },
  // High severity + inspection_relevant.
  {
    toneHints: ['maintenance', 'inspection_relevant', 'urgent'],
    severity: 80,
  },

  // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
  // Cube-coverage perturbations: Phase 8 adds `area.cleanliness` as a
  // salient signal for maintenance and authors 4 spec-3 cube corners
  // (damage=high × condition × cleanliness 2×2). Diversity gate needs
  // samples that vary the previously-unperturbed cleanliness band.
  // Low cleanliness alone.
  { meters: { cleanliness: 25 }, toneHints: ['maintenance'], severity: 50 },
  // High cleanliness alone.
  { meters: { cleanliness: 85 }, toneHints: ['maintenance'], severity: 50 },
  // Cube corner: damage=high × condition=high × cleanliness=high.
  {
    meters: { damage: 80, condition: 80, cleanliness: 85 },
    toneHints: ['maintenance'],
    severity: 60,
  },
  // Cube corner: damage=high × condition=high × cleanliness=low.
  {
    meters: { damage: 80, condition: 80, cleanliness: 25 },
    toneHints: ['maintenance'],
    severity: 60,
  },
  // Cube corner: damage=high × condition=low × cleanliness=high.
  {
    meters: { damage: 80, condition: 25, cleanliness: 85 },
    toneHints: ['maintenance'],
    severity: 60,
  },
  // Cube corner: damage=high × condition=low × cleanliness=low.
  {
    meters: { damage: 80, condition: 25, cleanliness: 25 },
    toneHints: ['maintenance'],
    severity: 65,
  },
  // Spec-2 support: damage=mid × condition=low.
  {
    meters: { damage: 50, condition: 25 },
    toneHints: ['maintenance'],
    severity: 55,
  },
]

function buildMaintenanceState(
  baseState: TavernState,
  areaId: string,
  perturbation: (typeof MAINTENANCE_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.meters) {
    s = withAreaMeters(s, areaId, perturbation.meters)
  }
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'maintenance_repeat_marker') {
      s = withMemoryEntry(s, 'maintenance_repeat_marker_b', ['maintenance'])
      s = withMemoryEntry(s, 'maintenance_repeat_marker_c', ['maintenance'])
    }
  }
  return s
}

export function buildMaintenanceDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const areaId = firstAreaId(baseState)
  return MAINTENANCE_PERTURBATIONS.map((perturbation, i) => ({
    seed: maintenanceBaseSeed(
      areaId,
      `maintenance-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildMaintenanceState(baseState, areaId, perturbation),
  }))
}

export function buildMaintenanceDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  const areaId = firstAreaId(baseState)
  return (i: number) => {
    const perturbation = MAINTENANCE_PERTURBATIONS[i % MAINTENANCE_PERTURBATIONS.length]!
    return {
      seed: maintenanceBaseSeed(
        areaId,
        `maintenance-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildMaintenanceState(baseState, areaId, perturbation),
    }
  }
}

// ---- areaAtmosphere state-perturbation sampler ----

function areaAtmosphereBaseSeed(
  areaId: string,
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = AREA_ATMOSPHERE_SHAPE()
  return makeSeed({
    id,
    family: 'area_atmosphere',
    type: 'warning',
    timing: 'morning_prep',
    severity,
    domain: ['areas', 'atmosphere'],
    location: { kind: 'area', id: areaId },
    affectedActors: [{ kind: 'area', id: areaId }],
    toneHints: [...toneHints],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'sour atmosphere',
      sensoryDetails: ['dim light'],
      recentContext: ['cleanliness slipping'],
    },
  })
}

const AREA_ATMOSPHERE_PERTURBATIONS: ReadonlyArray<{
  meters?: Partial<{ damage: number; condition: number; cleanliness: number }>
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline.
  { toneHints: ['atmosphere'], severity: 50 },
  // Low cleanliness (band: low).
  { meters: { cleanliness: 25 }, toneHints: ['atmosphere'], severity: 50 },
  // High damage feeding atmosphere (band: high).
  { meters: { damage: 80 }, toneHints: ['atmosphere'], severity: 55 },
  // Rising maintenance pressure.
  {
    pressure: { id: 'maintenance', value: 55, trend: 1 },
    toneHints: ['atmosphere'],
    severity: 50,
  },
  // Memory of the atmosphere seed firing before.
  {
    memory: { id: 'area_atmosphere_seed_main_room', tags: ['area', 'atmosphere', 'warning'] },
    toneHints: ['atmosphere'],
    severity: 50,
  },
  // Memory of neglect.
  {
    memory: { id: 'area_ignored_main_room', tags: ['area', 'neglected'] },
    toneHints: ['atmosphere'],
    severity: 50,
  },
  // Memory of cleaning.
  {
    memory: { id: 'area_cleaned_main_room', tags: ['area', 'cleaning'] },
    toneHints: ['atmosphere'],
    severity: 50,
  },
  // Memory of repair.
  {
    memory: { id: 'area_repaired_main_room', tags: ['area', 'repair'] },
    toneHints: ['atmosphere'],
    severity: 50,
  },
  // Reputation tone.
  { toneHints: ['atmosphere', 'reputation'], severity: 55 },
  // Inspection-negative tone.
  { toneHints: ['atmosphere', 'inspection_negative'], severity: 60 },
  // Merchant-sensitive tone.
  { toneHints: ['atmosphere', 'merchant_sensitive'], severity: 55 },
  // Urgent tone.
  { toneHints: ['atmosphere', 'urgent'], severity: 65 },
  // Low cleanliness + rising pressure (top rung on establishing).
  {
    meters: { cleanliness: 25 },
    pressure: { id: 'maintenance', value: 65, trend: 1 },
    toneHints: ['atmosphere', 'urgent'],
    severity: 70,
  },
  // High severity + repeat (three atmosphere-tagged memories).
  {
    memory: { id: 'atmosphere_repeat_marker', tags: ['atmosphere'] },
    toneHints: ['atmosphere', 'urgent'],
    severity: 80,
  },
  // Reputation + high severity (reaction's top rung).
  { toneHints: ['atmosphere', 'reputation', 'urgent'], severity: 80 },
  // Neglected + rising pressure (reaction's two-condition rung).
  {
    pressure: { id: 'maintenance', value: 60, trend: 1 },
    memory: { id: 'area_neglected_again', tags: ['area', 'neglected'] },
    toneHints: ['atmosphere'],
    severity: 60,
  },

  // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
  // Cube-coverage perturbations: Phase 8 adds `area.condition` as a
  // salient signal for area_atmosphere and authors 4 spec-3 cube
  // corners (cleanliness=low × damage × condition 2×2). Diversity
  // gate needs samples that vary the previously-unperturbed condition
  // band, plus more damage-band coverage.
  // Low condition alone.
  { meters: { condition: 25 }, toneHints: ['atmosphere'], severity: 50 },
  // High condition alone.
  { meters: { condition: 85 }, toneHints: ['atmosphere'], severity: 50 },
  // Cube corner: cleanliness=low × damage=high × condition=high.
  {
    meters: { cleanliness: 25, damage: 80, condition: 80 },
    toneHints: ['atmosphere'],
    severity: 60,
  },
  // Cube corner: cleanliness=low × damage=high × condition=low.
  {
    meters: { cleanliness: 25, damage: 80, condition: 25 },
    toneHints: ['atmosphere'],
    severity: 65,
  },
  // Cube corner: cleanliness=low × damage=low × condition=high.
  {
    meters: { cleanliness: 25, damage: 25, condition: 80 },
    toneHints: ['atmosphere'],
    severity: 55,
  },
  // Cube corner: cleanliness=low × damage=low × condition=low.
  {
    meters: { cleanliness: 25, damage: 25, condition: 25 },
    toneHints: ['atmosphere'],
    severity: 60,
  },
  // Spec-2 support: cleanliness=mid × damage=high.
  {
    meters: { cleanliness: 50, damage: 80 },
    toneHints: ['atmosphere'],
    severity: 60,
  },
  // Spec-2 support: cleanliness=high × damage=high (the rare cell).
  {
    meters: { cleanliness: 85, damage: 80 },
    toneHints: ['atmosphere'],
    severity: 55,
  },
]

function buildAreaAtmosphereState(
  baseState: TavernState,
  areaId: string,
  perturbation: (typeof AREA_ATMOSPHERE_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.meters) {
    s = withAreaMeters(s, areaId, perturbation.meters)
  }
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'atmosphere_repeat_marker') {
      s = withMemoryEntry(s, 'atmosphere_repeat_marker_b', ['atmosphere'])
      s = withMemoryEntry(s, 'atmosphere_repeat_marker_c', ['atmosphere'])
    }
  }
  return s
}

export function buildAreaAtmosphereDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const areaId = firstAreaId(baseState)
  return AREA_ATMOSPHERE_PERTURBATIONS.map((perturbation, i) => ({
    seed: areaAtmosphereBaseSeed(
      areaId,
      `area-atmosphere-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildAreaAtmosphereState(baseState, areaId, perturbation),
  }))
}

export function buildAreaAtmosphereDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  const areaId = firstAreaId(baseState)
  return (i: number) => {
    const perturbation = AREA_ATMOSPHERE_PERTURBATIONS[i % AREA_ATMOSPHERE_PERTURBATIONS.length]!
    return {
      seed: areaAtmosphereBaseSeed(
        areaId,
        `area-atmosphere-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildAreaAtmosphereState(baseState, areaId, perturbation),
    }
  }
}

// ---- Phase 6 context builders for the two new Phase-11 templates ----

// maintenance verbs at `issueSeedGenerators.ts:692-725`:
// repair / repair (patch) / ignore / delay (close_area).
const MAINTENANCE_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase137-maintenance-repair',
    labelHint: 'Repair the area',
    allowedVerbs: ['repair'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['restore condition'],
  },
  {
    id: 'phase137-maintenance-patch',
    labelHint: 'Patch temporarily',
    allowedVerbs: ['repair'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'short_term_patch' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['small fix'],
  },
  {
    id: 'phase137-maintenance-ignore',
    labelHint: 'Ignore the damage',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no cost'],
  },
  {
    id: 'phase137-maintenance-delay',
    labelHint: 'Close the area',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['stop further damage'],
  },
]

const MAINTENANCE_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'areas.main_room.damage',
    amount: -25,
    readable: 'damage reduced',
    tags: ['area'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -25,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'pressure',
    target: 'pressure:maintenance',
    amount: -12,
    readable: 'maintenance eases',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'customers.miners.satisfaction',
    amount: -5,
    readable: 'customers inconvenienced',
    tags: ['customer'],
  },
  {
    kind: 'future_hook',
    target: 'failed_patch_possible',
    amount: 0,
    readable: 'risk of later failure',
    tags: ['future_hook'],
  },
]

export function buildMaintenanceChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = MAINTENANCE_RESPONSE_SLOTS[i % MAINTENANCE_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildMaintenanceEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = MAINTENANCE_RESPONSE_SLOTS[i % MAINTENANCE_RESPONSE_SLOTS.length]!
  const effect = MAINTENANCE_EFFECTS[i % MAINTENANCE_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// area_atmosphere verbs at `expandedSeedGenerators.ts:2523-2572`:
// repair / clean / upgrade / delay / rebrand / ignore.
const AREA_ATMOSPHERE_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase137-area-repair',
    labelHint: 'Repair the area',
    allowedVerbs: ['repair'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['restore condition'],
  },
  {
    id: 'phase137-area-clean',
    labelHint: 'Clean the area',
    allowedVerbs: ['clean'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'short_term_patch' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise cleanliness'],
  },
  {
    id: 'phase137-area-upgrade',
    labelHint: 'Start a project',
    allowedVerbs: ['upgrade'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['major upgrade'],
  },
  {
    id: 'phase137-area-delay',
    labelHint: 'Close the area',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['stop damage'],
  },
  {
    id: 'phase137-area-rebrand',
    labelHint: 'Rebrand the area',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift identity'],
  },
  {
    id: 'phase137-area-ignore',
    labelHint: 'Ignore the problem',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no cost'],
  },
]

const AREA_ATMOSPHERE_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'areas.main_room.condition',
    amount: 15,
    readable: 'condition rises',
    tags: ['area'],
  },
  {
    kind: 'state_change',
    target: 'areas.main_room.cleanliness',
    amount: 20,
    readable: 'area cleaned',
    tags: ['area'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -25,
    readable: 'project cost',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'reputation.respectable',
    amount: -8,
    readable: 'reputation shifts',
    tags: ['reputation'],
  },
  {
    kind: 'pressure',
    target: 'pressure:maintenance',
    amount: -10,
    readable: 'maintenance eases',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'area_rebrand_audience_shift_main_room',
    amount: 0,
    readable: 'audience may narrow',
    tags: ['future_hook'],
  },
]

export function buildAreaAtmosphereChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = AREA_ATMOSPHERE_RESPONSE_SLOTS[i % AREA_ATMOSPHERE_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildAreaAtmosphereEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = AREA_ATMOSPHERE_RESPONSE_SLOTS[i % AREA_ATMOSPHERE_RESPONSE_SLOTS.length]!
  const effect = AREA_ATMOSPHERE_EFFECTS[i % AREA_ATMOSPHERE_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety) ----
//
// Samplers for the three new compositional templates:
//   - foodSafetyCrisisCard (actor-voiced via cook staff cast)
//   - violenceCard         (actor-voiced via customer-group cohort cast)
//   - inspectionCard       (actor-voiced via faction cast)
//
// Each determinism sample set is a hand-picked profile cover plus the
// six verbal tics; each diversity sampler rolls fresh cast attributes
// via the matching factory. State is otherwise unperturbed — the
// establishing-line slot is sim-backed at `minDistinct: 1`, so the
// fallback covers the diversity floor.

// ---- foodSafety (cook-voiced) ----

function foodSafetyCrisisSeedFor(staffId: string, id: string): IssueSeed {
  const shape = FOOD_SAFETY_SHAPE()
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
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'the kitchen',
      sensoryDetails: ['greasy floor'],
      recentContext: ['kitchen filthy for days'],
    },
  })
}

export function buildFoodSafetyDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const profiles: CastAttributes[] = [
    neutralCast(),
    { ...neutralCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 0, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    ...VERBAL_TIC_IDS.map<CastAttributes>((tic) => ({
      ...neutralCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: foodSafetyCrisisSeedFor(staffId, `food-safety-determinism-${i}`),
    state: installStaffCast(baseState, staffId, cast),
  }))
}

export function buildFoodSafetyDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-138-food-safety-diversity'
  const rng = createRng(`${seed}:food_safety`)
  const baseState = createInitialTavernState()
  const staffId = firstStaffId(baseState)
  const roleId = baseState.staff[staffId]!.role
  return (i: number) => {
    const cast = createStaffCastAttributes({ roleId, rng })
    const state = installStaffCast(baseState, staffId, cast)
    return {
      seed: foodSafetyCrisisSeedFor(staffId, `food-safety-diversity-${i}`),
      state,
    }
  }
}

// ---- violence (customer-group-voiced) ----

function violenceSeedFor(groupId: string, id: string): IssueSeed {
  const shape = VIOLENCE_SHAPE()
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
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'main room',
      sensoryDetails: ['shouting voices'],
      recentContext: ['brawl this week'],
    },
  })
}

export function buildViolenceDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const groupId = firstCustomerGroupId(baseState)
  const profiles: CustomerGroupCastAttributes[] = [
    { voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 0, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    ...VERBAL_TIC_IDS.map<CustomerGroupCastAttributes>((tic) => ({
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: violenceSeedFor(groupId, `violence-determinism-${i}`),
    state: installGroupCast(baseState, groupId, cast),
  }))
}

export function buildViolenceDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-138-violence-diversity'
  const rng = createRng(`${seed}:violence`)
  const baseState = createInitialTavernState()
  const groupId = firstCustomerGroupId(baseState)
  const cultureId = baseState.customerGroups[groupId]!.cultureId
  return (i: number) => {
    const cast = createCustomerGroupCastAttributes({ rng, cultureId })
    const state = installGroupCast(baseState, groupId, cast)
    return {
      seed: violenceSeedFor(groupId, `violence-diversity-${i}`),
      state,
    }
  }
}

// ---- inspection (faction-voiced) ----

function inspectionSeedFor(factionId: string, id: string): IssueSeed {
  const shape = INSPECTION_SHAPE()
  return makeSeed({
    id,
    family: 'inspection',
    type: 'inspection_threat',
    timing: 'morning_prep',
    severity: 55,
    domain: ['inspection', 'food', 'areas', 'reputation'],
    primaryActor: factionRef(factionId),
    location: { kind: 'area', id: 'main_room' },
    toneHints: ['inspection', 'urgent'],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'the tavern',
      sensoryDetails: ['privy stench'],
      recentContext: ['privy left filthy'],
    },
  })
}

export function buildInspectionDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const factionId = firstFactionId(baseState)
  const profiles: FactionCastAttributes[] = [
    neutralFactionCast(),
    { ...neutralFactionCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 0, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralFactionCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 2 } } },
    ...VERBAL_TIC_IDS.map<FactionCastAttributes>((tic) => ({
      ...neutralFactionCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: inspectionSeedFor(factionId, `inspection-determinism-${i}`),
    state: installFactionCast(baseState, factionId, cast),
  }))
}

export function buildInspectionDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-138-inspection-diversity'
  const rng = createRng(`${seed}:inspection`)
  const baseState = createInitialTavernState()
  const factionId = firstFactionId(baseState)
  const faction = baseState.world.factions[factionId]!
  return (i: number) => {
    const cast = createFactionCastAttributes({
      ...(faction.cultureId !== undefined ? { cultureId: faction.cultureId } : {}),
      rng,
    })
    const state = installFactionCast(baseState, factionId, cast)
    return {
      seed: inspectionSeedFor(factionId, `inspection-diversity-${i}`),
      state,
    }
  }
}

// ---- Phase 6 context builders for the three Phase-12 templates ----

const FOOD_SAFETY_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase138-foodsafety-discard',
    labelHint: 'Discard questionable stock',
    allowedVerbs: ['discard'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['stock -20'],
  },
  {
    id: 'phase138-foodsafety-clean',
    labelHint: 'Clean the kitchen',
    allowedVerbs: ['clean'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['cleanliness +25'],
  },
  {
    id: 'phase138-foodsafety-serve',
    labelHint: 'Serve it anyway',
    allowedVerbs: ['serve'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['coin +15'],
  },
  {
    id: 'phase138-foodsafety-blame',
    labelHint: 'Blame the supplier',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['supplier grudge'],
  },
]

const FOOD_SAFETY_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'stock.mushrooms.quantity',
    amount: -20,
    readable: 'mushrooms drop',
    tags: ['stock'],
  },
  {
    kind: 'state_change',
    target: 'areas.kitchen.cleanliness',
    amount: 25,
    readable: 'kitchen cleaner',
    tags: ['area'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: 15,
    readable: 'earn coin',
    tags: ['coin'],
  },
  {
    kind: 'pressure',
    target: 'pressure:food_safety',
    amount: -10,
    readable: 'food safety pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'food_poisoning_rumor_possible',
    amount: 0,
    readable: 'food poisoning rumor may emerge',
    tags: ['future_hook'],
  },
]

export function buildFoodSafetyChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = FOOD_SAFETY_RESPONSE_SLOTS[i % FOOD_SAFETY_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildFoodSafetyEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = FOOD_SAFETY_RESPONSE_SLOTS[i % FOOD_SAFETY_RESPONSE_SLOTS.length]!
  const effect = FOOD_SAFETY_EFFECTS[i % FOOD_SAFETY_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

const VIOLENCE_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase138-violence-pay',
    labelHint: 'Hire security',
    allowedVerbs: ['pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['coin -20'],
  },
  {
    id: 'phase138-violence-ban',
    labelHint: 'Ban the rowdiest group',
    allowedVerbs: ['ban'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['patronage -25'],
  },
  {
    id: 'phase138-violence-rebrand',
    labelHint: 'Embrace the chaos',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['dangerous rep up'],
  },
  {
    id: 'phase138-violence-repair',
    labelHint: 'Repair the damage',
    allowedVerbs: ['repair'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'short_term_patch' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['area damage -20'],
  },
]

const VIOLENCE_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'coin',
    amount: -20,
    readable: 'coin drops',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'customers.ogres.patronage',
    amount: -25,
    readable: 'group leaves',
    tags: ['customer'],
  },
  {
    kind: 'state_change',
    target: 'reputation.dangerous',
    amount: 6,
    readable: 'dangerous reputation up',
    tags: ['reputation'],
  },
  {
    kind: 'pressure',
    target: 'pressure:violence',
    amount: -15,
    readable: 'violence pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'areas.main_room.damage',
    amount: -20,
    readable: 'damage repaired',
    tags: ['area'],
  },
  {
    kind: 'cause',
    target: 'customer_group:ogres',
    amount: -20,
    readable: 'group banned',
    tags: ['customer'],
  },
  {
    kind: 'future_hook',
    target: 'security_routine_possible',
    amount: 14,
    readable: 'security may stay on',
    tags: ['future_hook'],
  },
]

export function buildViolenceChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = VIOLENCE_RESPONSE_SLOTS[i % VIOLENCE_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildViolenceEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = VIOLENCE_RESPONSE_SLOTS[i % VIOLENCE_RESPONSE_SLOTS.length]!
  const effect = VIOLENCE_EFFECTS[i % VIOLENCE_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// Eight slots — the inspection family has the largest verb roster in
// the codebase. Rotated by index so the diversity gate exercises every
// verb-gated rung.
const INSPECTION_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase138-inspection-clean',
    labelHint: 'Clean the worst areas',
    allowedVerbs: ['clean'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['areas cleaner'],
  },
  {
    id: 'phase138-inspection-bribe',
    labelHint: 'Bribe the inspector',
    allowedVerbs: ['bribe'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['coin -30'],
  },
  {
    id: 'phase138-inspection-hide',
    labelHint: 'Hide the evidence',
    allowedVerbs: ['hide'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['stall, risk'],
  },
  {
    id: 'phase138-inspection-discard',
    labelHint: 'Improve food safety',
    allowedVerbs: ['discard'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['stock -10'],
  },
  {
    id: 'phase138-inspection-ignore',
    labelHint: 'Ignore it',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no cost'],
  },
  {
    id: 'phase138-inspection-delegate',
    labelHint: 'Set up a cleaning roster',
    allowedVerbs: ['delegate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['cleanliness up'],
  },
  {
    id: 'phase138-inspection-invite',
    labelHint: 'Walk them through',
    allowedVerbs: ['invite'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['inspection eases'],
  },
  {
    id: 'phase138-inspection-negotiate',
    labelHint: 'Ask their guidance',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['reputation up'],
  },
]

const INSPECTION_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'areas.kitchen.cleanliness',
    amount: 20,
    readable: 'kitchen cleaner',
    tags: ['area'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -30,
    readable: 'coin drops',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'stock.stew.quantity',
    amount: -10,
    readable: 'stock drops',
    tags: ['stock'],
  },
  {
    kind: 'pressure',
    target: 'pressure:inspection',
    amount: -12,
    readable: 'inspection pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'reputation.respectable',
    amount: 5,
    readable: 'respect up',
    tags: ['reputation'],
  },
  {
    kind: 'future_hook',
    target: 'town_watch_goodwill',
    amount: 10,
    readable: 'goodwill may bloom',
    tags: ['future_hook'],
  },
  {
    kind: 'cause',
    target: 'faction:town_watch',
    amount: 10,
    readable: 'watch weighs the gesture',
    tags: ['faction'],
  },
]

export function buildInspectionChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = INSPECTION_RESPONSE_SLOTS[i % INSPECTION_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildInspectionEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot = INSPECTION_RESPONSE_SLOTS[i % INSPECTION_RESPONSE_SLOTS.length]!
  const effect = INSPECTION_EFFECTS[i % INSPECTION_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ---- Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals) ----
//
// Samplers for the three new compositional templates:
//   - reputationShiftCard (narrator-voiced, state perturbation across
//     the seven reputation axes via `hasTag reputation.<axis>`)
//   - rumourCrisisCard    (actor-voiced via the target's castAttributes;
//     state perturbation across accuracy / target.kind tags)
//   - rivalTavernCard     (narrator-voiced, state perturbation across
//     rival.arc vs rival.system + pressures + memories)
//
// reputation_shift + rival_tavern follow the maintenance / debtRent
// pattern (state-perturbation table per template); rumour_crisis is
// actor-perturbation against the supplier cast factory (any of the six
// kinds works; supplier is chosen as the representative kind here).

// ---- reputationShift state-perturbation sampler ----

const REPUTATION_AXES = [
  'cozy',
  'tasty',
  'reputable',
  'reliable',
  'dangerous',
  'respectable',
  'scholarly',
] as const

function reputationShiftBaseSeed(
  id: string,
  domain: readonly string[],
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = REPUTATION_SHIFT_SHAPE()
  return makeSeed({
    id,
    family: 'reputation_shift',
    type: 'reputation_shift',
    timing: 'closing',
    severity,
    domain: [...domain],
    toneHints: [...toneHints],
    location: { kind: 'area', id: 'main_room' },
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'the tavern',
      sensoryDetails: ['regulars settle in'],
      recentContext: ['identity shifting'],
    },
  })
}

const REPUTATION_PERTURBATIONS: ReadonlyArray<{
  axis?: string
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  { toneHints: ['identity', 'reputation'], severity: 50 },
  ...REPUTATION_AXES.map((axis) => ({
    axis,
    toneHints: ['identity', 'reputation'] as readonly string[],
    severity: 50,
  })),
  {
    pressure: { id: 'reputation_drift', value: 55, trend: 1 },
    toneHints: ['identity', 'reputation'],
    severity: 55,
  },
  {
    memory: { id: 'embraced_cozy_identity', tags: ['reputation', 'identity'] },
    toneHints: ['identity', 'reputation'],
    severity: 55,
  },
  {
    memory: { id: 'advertised_to_group_recently', tags: ['customer', 'reputation'] },
    toneHints: ['identity', 'reputation'],
    severity: 50,
  },
  // High severity (hard turn).
  { toneHints: ['identity', 'reputation', 'urgent'], severity: 75 },
  // Two-condition top rungs.
  {
    axis: 'cozy',
    pressure: { id: 'reputation_drift', value: 65, trend: 1 },
    toneHints: ['identity', 'reputation'],
    severity: 60,
  },
  {
    axis: 'dangerous',
    toneHints: ['identity', 'reputation', 'urgent'],
    severity: 80,
  },
  // High severity + repeat marker.
  {
    memory: { id: 'reputation_repeat_marker', tags: ['reputation'] },
    toneHints: ['identity', 'reputation', 'urgent'],
    severity: 75,
  },
  // Rising pressure + identity memory.
  {
    pressure: { id: 'reputation_drift', value: 60, trend: 1 },
    memory: { id: 'embraced_dangerous_identity', tags: ['reputation', 'identity'] },
    toneHints: ['identity', 'reputation'],
    severity: 60,
  },
]

function buildReputationShiftState(
  baseState: TavernState,
  perturbation: (typeof REPUTATION_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'reputation_repeat_marker') {
      s = withMemoryEntry(s, 'reputation_repeat_marker_b', ['reputation'])
      s = withMemoryEntry(s, 'reputation_repeat_marker_c', ['reputation'])
    }
  }
  return s
}

function reputationShiftSeedFor(
  id: string,
  perturbation: (typeof REPUTATION_PERTURBATIONS)[number],
): IssueSeed {
  const domain = ['reputation', 'customers']
  if (perturbation.axis) domain.push(`reputation.${perturbation.axis}`)
  return reputationShiftBaseSeed(
    id,
    domain,
    perturbation.toneHints,
    perturbation.severity,
  )
}

export function buildReputationShiftDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return REPUTATION_PERTURBATIONS.map((perturbation, i) => ({
    seed: reputationShiftSeedFor(
      `reputation-shift-determinism-${i}`,
      perturbation,
    ),
    state: buildReputationShiftState(baseState, perturbation),
  }))
}

export function buildReputationShiftDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation =
      REPUTATION_PERTURBATIONS[i % REPUTATION_PERTURBATIONS.length]!
    return {
      seed: reputationShiftSeedFor(
        `reputation-shift-diversity-${i}`,
        perturbation,
      ),
      state: buildReputationShiftState(baseState, perturbation),
    }
  }
}

// ---- rumourCrisis sampler (actor-perturbation on supplier cast) ----

function rumourCrisisSeedFor(supplierId: string, id: string): IssueSeed {
  const shape = RUMOUR_CRISIS_SHAPE()
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
      'rumour.target.supplier',
    ],
    primaryActor: supplierRef(supplierId),
    toneHints: ['rumour', 'reputation'],
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'a story doing rounds',
      sensoryDetails: ['whispered word'],
      recentContext: ['accuracy: partial'],
    },
  })
}

export function buildRumourCrisisDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  const supplierId = firstSupplierId(baseState)
  // Reuse the supplier neutral cast + one-axis / two-axis / verbal-tic
  // matrix that supplierReliability uses — the rumour template centres
  // the same voice surface.
  const profiles: SupplierCastAttributes[] = [
    neutralSupplierCast(),
    { ...neutralSupplierCast(), voice: { axes: { terseness: 2, warmth: 1, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 2, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 0, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 1, formality: 1, floridity: 2 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 2, warmth: 0, formality: 1, floridity: 1 } } },
    { ...neutralSupplierCast(), voice: { axes: { terseness: 1, warmth: 2, formality: 0, floridity: 1 } } },
    ...VERBAL_TIC_IDS.map<SupplierCastAttributes>((tic) => ({
      ...neutralSupplierCast(),
      voice: {
        axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
        verbalTic: tic,
      },
    })),
  ]
  return profiles.map((cast, i) => ({
    seed: rumourCrisisSeedFor(supplierId, `rumour-crisis-determinism-${i}`),
    state: installSupplierCast(baseState, supplierId, cast),
  }))
}

export function buildRumourCrisisDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  const seed = options.rngSeed ?? 'phase-139-rumour-crisis-diversity'
  const rng = createRng(`${seed}:rumour_crisis`)
  const baseState = createInitialTavernState()
  const supplierId = firstSupplierId(baseState)
  const supplier = baseState.world.suppliers[supplierId]!
  return (i: number) => {
    const cast = createSupplierCastAttributes({
      supplierType: supplier.supplierType,
      ...(supplier.cultureId !== undefined ? { cultureId: supplier.cultureId } : {}),
      rng,
    })
    const state = installSupplierCast(baseState, supplierId, cast)
    return {
      seed: rumourCrisisSeedFor(supplierId, `rumour-crisis-diversity-${i}`),
      state,
    }
  }
}

// ---- rivalTavern state-perturbation sampler ----

function rivalTavernBaseSeed(
  id: string,
  domain: readonly string[],
  toneHints: readonly string[],
  severity: number,
  primaryActor: EntityRef,
): IssueSeed {
  // Phase 163 — Slot shape differs between the arc and system activation
  // paths (host_counter_event's targetOptions point at a `local_event`
  // ref or a `system` ref). Pick the matching captured shape.
  const shape =
    primaryActor.kind === 'local_event'
      ? RIVAL_TAVERN_ARC_SHAPE()
      : RIVAL_TAVERN_SYSTEM_SHAPE()
  return makeSeed({
    id,
    family: 'rival_tavern',
    type: 'social_conflict',
    timing: 'closing',
    severity,
    domain: [...domain],
    toneHints: [...toneHints],
    primaryActor,
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'the rival tavern',
      sensoryDetails: ['emptier seats tonight'],
      recentContext: ['rival pulling crowds'],
    },
  })
}

const RIVAL_PERTURBATIONS: ReadonlyArray<{
  activation: 'arc' | 'system'
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline (system).
  { activation: 'system', toneHints: ['rival', 'market'], severity: 50 },
  // System with rising rival pressure.
  {
    activation: 'system',
    pressure: { id: 'rival_tavern_pressure', value: 60, trend: 1 },
    toneHints: ['rival', 'market'],
    severity: 55,
  },
  // System with rising regulars-loss.
  {
    activation: 'system',
    pressure: { id: 'regular_customer_loss', value: 45, trend: 1 },
    toneHints: ['rival', 'market'],
    severity: 55,
  },
  // Arc activation.
  { activation: 'arc', toneHints: ['rival', 'market'], severity: 55 },
  // Arc + rising pressure (top rung).
  {
    activation: 'arc',
    pressure: { id: 'rival_tavern_pressure', value: 70, trend: 1 },
    toneHints: ['rival', 'market'],
    severity: 65,
  },
  // System + compete memory.
  {
    activation: 'system',
    memory: { id: 'rival_priced_recently', tags: ['rival', 'price'] },
    toneHints: ['rival', 'market'],
    severity: 50,
  },
  // System + event memory.
  {
    activation: 'system',
    memory: { id: 'rival_counter_event_recently', tags: ['rival', 'event'] },
    toneHints: ['rival', 'market'],
    severity: 50,
  },
  // System + quality memory.
  {
    activation: 'system',
    memory: { id: 'rival_quality_recently', tags: ['rival', 'quality'] },
    toneHints: ['rival', 'market'],
    severity: 50,
  },
  // System + deception memory.
  {
    activation: 'system',
    memory: { id: 'rival_counter_rumour_recently', tags: ['rival', 'deception'] },
    toneHints: ['rival', 'market'],
    severity: 50,
  },
  // System + compromise memory.
  {
    activation: 'system',
    memory: { id: 'rival_negotiated_recently', tags: ['rival', 'compromise'] },
    toneHints: ['rival', 'market'],
    severity: 50,
  },
  // System + ignored memory.
  {
    activation: 'system',
    memory: { id: 'rival_ignored_recently', tags: ['rival', 'ignored'] },
    toneHints: ['rival', 'market'],
    severity: 55,
  },
  // High severity.
  { activation: 'system', toneHints: ['rival', 'market', 'urgent'], severity: 75 },
  // High severity + repeat marker.
  {
    activation: 'system',
    memory: { id: 'rival_repeat_marker', tags: ['rival'] },
    toneHints: ['rival', 'market', 'urgent'],
    severity: 80,
  },
  // System + ignored + rising pressure (reaction's two-condition rung).
  {
    activation: 'system',
    pressure: { id: 'rival_tavern_pressure', value: 65, trend: 1 },
    memory: { id: 'rival_ignored_repeat', tags: ['rival', 'ignored'] },
    toneHints: ['rival', 'market'],
    severity: 60,
  },
]

function rivalSystemRef(): EntityRef {
  return { kind: 'system', id: 'rival_tavern' }
}

function rivalArcRef(): EntityRef {
  return { kind: 'local_event', id: 'phase139_rival_arc' }
}

function buildRivalTavernState(
  baseState: TavernState,
  perturbation: (typeof RIVAL_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.activation === 'arc') {
    s = {
      ...s,
      world: {
        ...s.world,
        localEvents: {
          ...s.world.localEvents,
          phase139_rival_arc: {
            ...(s.world.localEvents['phase139_rival_arc'] ?? {
              id: 'phase139_rival_arc',
              tags: ['rival'],
              severity: 50,
            }),
            id: 'phase139_rival_arc',
            label: 'The Crooked Pint',
          },
        } as TavernState['world']['localEvents'],
      },
    }
  }
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'rival_repeat_marker') {
      s = withMemoryEntry(s, 'rival_repeat_marker_b', ['rival'])
      s = withMemoryEntry(s, 'rival_repeat_marker_c', ['rival'])
    }
  }
  return s
}

function rivalTavernSeedFor(
  id: string,
  perturbation: (typeof RIVAL_PERTURBATIONS)[number],
): IssueSeed {
  const domain = ['rival', 'market', 'customers']
  domain.push(perturbation.activation === 'arc' ? 'rival.arc' : 'rival.system')
  const actor =
    perturbation.activation === 'arc' ? rivalArcRef() : rivalSystemRef()
  return rivalTavernBaseSeed(
    id,
    domain,
    perturbation.toneHints,
    perturbation.severity,
    actor,
  )
}

export function buildRivalTavernDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return RIVAL_PERTURBATIONS.map((perturbation, i) => ({
    seed: rivalTavernSeedFor(`rival-tavern-determinism-${i}`, perturbation),
    state: buildRivalTavernState(baseState, perturbation),
  }))
}

export function buildRivalTavernDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation = RIVAL_PERTURBATIONS[i % RIVAL_PERTURBATIONS.length]!
    return {
      seed: rivalTavernSeedFor(`rival-tavern-diversity-${i}`, perturbation),
      state: buildRivalTavernState(baseState, perturbation),
    }
  }
}

// ---- Phase 6 context builders for the three Phase-13 templates ----

// reputation_shift verbs: rebrand (reputation_play), clean/repair/pay
// (long_term_investment), invite (compromise), rebrand (compromise).
const REPUTATION_SHIFT_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase139-reputation-embrace',
    labelHint: 'Embrace the identity',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lean into reputation'],
  },
  {
    id: 'phase139-reputation-correct',
    labelHint: 'Correct the identity',
    allowedVerbs: ['clean', 'repair', 'pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift reputation away'],
  },
  {
    id: 'phase139-reputation-advertise',
    labelHint: 'Advertise to matching group',
    allowedVerbs: ['invite'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise patronage'],
  },
  {
    id: 'phase139-reputation-diversify',
    labelHint: 'Diversify',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['broaden appeal'],
  },
]

const REPUTATION_SHIFT_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'reputation.cozy',
    amount: 5,
    readable: 'cozy rises',
    tags: ['reputation'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -10,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'customers.miners.patronage',
    amount: 8,
    readable: 'patronage rises',
    tags: ['customer'],
  },
  {
    kind: 'pressure',
    target: 'pressure:reputation_drift',
    amount: 4,
    readable: 'drift pressure shifts',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'identity_lock_in_cozy',
    amount: 14,
    readable: 'identity may lock in',
    tags: ['future_hook'],
  },
]

export function buildReputationShiftChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    REPUTATION_SHIFT_RESPONSE_SLOTS[i % REPUTATION_SHIFT_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildReputationShiftEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    REPUTATION_SHIFT_RESPONSE_SLOTS[i % REPUTATION_SHIFT_RESPONSE_SLOTS.length]!
  const effect = REPUTATION_SHIFT_EFFECTS[i % REPUTATION_SHIFT_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// rumour_crisis verbs (nine slots; largest in the codebase): rebrand
// (reputation_play / long_term_investment / deception), confess
// (relationship_sacrifice / escalation), blame (deception / escalation),
// bribe, ignore, invite/negotiate.
const RUMOUR_CRISIS_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase139-rumour-deny',
    labelHint: 'Deny the rumour',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift attribution'],
  },
  {
    id: 'phase139-rumour-confess',
    labelHint: 'Confess partial truth',
    allowedVerbs: ['confess'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'relationship_sacrifice' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower distrust'],
  },
  {
    id: 'phase139-rumour-blame',
    labelHint: 'Blame someone else',
    allowedVerbs: ['blame'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift blame'],
  },
  {
    id: 'phase139-rumour-prove',
    labelHint: 'Prove the truth',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower rumour'],
  },
  {
    id: 'phase139-rumour-bribe',
    labelHint: 'Bribe the gossip',
    allowedVerbs: ['bribe'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['silence source'],
  },
  {
    id: 'phase139-rumour-ignore',
    labelHint: 'Ignore the rumour',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no cost'],
  },
  {
    id: 'phase139-rumour-counter',
    labelHint: 'Plant a counter-rumour',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['drown out original'],
  },
  {
    id: 'phase139-rumour-vouch',
    labelHint: 'Ask a regular to vouch',
    allowedVerbs: ['invite', 'negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower rumour'],
  },
  {
    id: 'phase139-rumour-name',
    labelHint: 'Name the source publicly',
    allowedVerbs: ['blame', 'confess'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'escalation' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['flip blame'],
  },
]

const RUMOUR_CRISIS_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'pressure',
    target: 'pressure:rumour_pressure',
    amount: -10,
    readable: 'rumour pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'state_change',
    target: 'reputation.respectable',
    amount: -6,
    readable: 'credibility takes a hit',
    tags: ['reputation'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -20,
    readable: 'pay the gossip',
    tags: ['coin'],
  },
  {
    kind: 'cause',
    target: 'supplier:example',
    amount: -10,
    readable: 'target faces blame',
    tags: ['rumour', 'attribution'],
  },
  {
    kind: 'state_change',
    target: 'world.regulars.example.loyalty',
    amount: -3,
    readable: 'regular favour drawn down',
    tags: ['regular'],
  },
  {
    kind: 'future_hook',
    target: 'rumour_blame_grudge_example',
    amount: 14,
    readable: 'grudge may form',
    tags: ['future_hook'],
  },
]

export function buildRumourCrisisChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    RUMOUR_CRISIS_RESPONSE_SLOTS[i % RUMOUR_CRISIS_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildRumourCrisisEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    RUMOUR_CRISIS_RESPONSE_SLOTS[i % RUMOUR_CRISIS_RESPONSE_SLOTS.length]!
  const effect = RUMOUR_CRISIS_EFFECTS[i % RUMOUR_CRISIS_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// rival_tavern verbs: lower_price, invite, upgrade, rebrand,
// negotiate, ignore.
const RIVAL_TAVERN_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase139-rival-price',
    labelHint: 'Compete on price',
    allowedVerbs: ['lower_price'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise patronage'],
  },
  {
    id: 'phase139-rival-event',
    labelHint: 'Host counter-event',
    allowedVerbs: ['invite'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise patronage'],
  },
  {
    id: 'phase139-rival-quality',
    labelHint: 'Improve quality',
    allowedVerbs: ['upgrade'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise reputation'],
  },
  {
    id: 'phase139-rival-rumour',
    labelHint: 'Spread counter-rumour',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['hurt rival'],
  },
  {
    id: 'phase139-rival-negotiate',
    labelHint: 'Negotiate with the rival',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['share market'],
  },
  {
    id: 'phase139-rival-ignore',
    labelHint: 'Ignore the rival',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['no cost'],
  },
]

const RIVAL_TAVERN_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'customers.local_goblins.patronage',
    amount: 8,
    readable: 'patronage rises',
    tags: ['customer'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -20,
    readable: 'coin out',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'reputation.tasty',
    amount: 12,
    readable: 'reputation rises',
    tags: ['reputation'],
  },
  {
    kind: 'pressure',
    target: 'pressure:rival_tavern_pressure',
    amount: -10,
    readable: 'rival pressure eases',
    tags: ['pressure'],
  },
  {
    kind: 'future_hook',
    target: 'rival_rumour_exposed_example',
    amount: 0,
    readable: 'counter-rumour may be exposed',
    tags: ['future_hook'],
  },
]

export function buildRivalTavernChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    RIVAL_TAVERN_RESPONSE_SLOTS[i % RIVAL_TAVERN_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildRivalTavernEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    RIVAL_TAVERN_RESPONSE_SLOTS[i % RIVAL_TAVERN_RESPONSE_SLOTS.length]!
  const effect = RIVAL_TAVERN_EFFECTS[i % RIVAL_TAVERN_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// ============================================================
// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14
// (Periodic & Narrative Beats).
//
// Sampler families for the two new templates in the cluster:
//
//   - monthlyReview: STATE-perturbation. The seed's primaryActor is a
//     month ref (`{ kind: 'other', id: 'month:${monthKey}' }`) with no
//     castAttributes — variety is in pressure trends, prior-monthly
//     memories, calendar tags, severity, repeat count.
//
//   - seasonalArc: STATE-perturbation. The seed's primaryActor is a
//     `local_event` ref (Path A) or undefined (Path B anticipation);
//     local_events carry no castAttributes — variety is in arc
//     pressures, theme tags (5 themes), prior-arc memories, severity.
// ============================================================

// ---- monthlyReview state-perturbation sampler ----

function monthlyReviewBaseSeed(
  id: string,
  toneHints: readonly string[],
  severity: number,
): IssueSeed {
  const shape = MONTHLY_REVIEW_SHAPE()
  return makeSeed({
    id,
    family: 'monthly_review',
    type: 'monthly_review',
    timing: 'end_month',
    severity,
    domain: ['monthly', 'economy', 'reputation'],
    toneHints: [...toneHints],
    primaryActor: { kind: 'other', id: 'month:1' },
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'month 1',
      sensoryDetails: ['ledger closed'],
      recentContext: ['net coin change -10'],
    },
  })
}

const MONTHLY_REVIEW_PERTURBATIONS: ReadonlyArray<{
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  toneHints: readonly string[]
  severity: number
}> = [
  // Fallback baseline.
  { toneHints: ['summary', 'monthly'], severity: 40 },
  // Rising landlord.
  {
    pressure: { id: 'landlord', value: 45, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // Rising debt.
  {
    pressure: { id: 'debt', value: 45, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // Rising reputation_drift.
  {
    pressure: { id: 'reputation_drift', value: 40, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // Rising staff_burnout.
  {
    pressure: { id: 'staff_burnout', value: 50, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 50,
  },
  // Rising customer_complaint.
  {
    pressure: { id: 'customer_complaint', value: 45, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 50,
  },
  // Rising rival_tavern_pressure.
  {
    pressure: { id: 'rival_tavern_pressure', value: 50, trend: 1 },
    toneHints: ['summary', 'monthly'],
    severity: 50,
  },
  // rent_paid memory.
  {
    memory: { id: 'rent_paid_recently', tags: ['rent', 'paid', 'monthly'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // reserves_held memory.
  {
    memory: { id: 'reserves_held_recently', tags: ['reserves', 'monthly'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // landlord memory.
  {
    memory: { id: 'landlord_visited_recently', tags: ['landlord'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // cellar memory.
  {
    memory: { id: 'cellar_invested_recently', tags: ['cellar', 'investment', 'monthly'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // rival memory.
  {
    memory: { id: 'rival_settled_recently', tags: ['rival', 'settle', 'monthly'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // review memory.
  {
    memory: { id: 'monthly_review_prior', tags: ['monthly', 'review'] },
    toneHints: ['summary', 'monthly'],
    severity: 45,
  },
  // risk memory.
  {
    memory: { id: 'eviction_threat_possible', tags: ['landlord', 'risk'] },
    toneHints: ['summary', 'monthly'],
    severity: 55,
  },
  // rent_due_soon calendar tag (flows through toneHints).
  { toneHints: ['summary', 'monthly', 'rent_due_soon'], severity: 50 },
  // High severity.
  { toneHints: ['summary', 'monthly', 'urgent'], severity: 75 },
  // Rising debt + monthly repeat (three monthly-tagged memories).
  {
    pressure: { id: 'debt', value: 70, trend: 1 },
    memory: { id: 'monthly_repeat_marker', tags: ['monthly'] },
    toneHints: ['summary', 'monthly'],
    severity: 70,
  },
  // Rising landlord + rent_due_soon.
  {
    pressure: { id: 'landlord', value: 60, trend: 1 },
    toneHints: ['summary', 'monthly', 'rent_due_soon'],
    severity: 65,
  },
  // High severity + rising debt (top rung).
  {
    pressure: { id: 'debt', value: 75, trend: 1 },
    toneHints: ['summary', 'monthly', 'urgent'],
    severity: 75,
  },
]

function buildMonthlyReviewState(
  baseState: TavernState,
  perturbation: (typeof MONTHLY_REVIEW_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
    if (perturbation.memory.id === 'monthly_repeat_marker') {
      s = withMemoryEntry(s, 'monthly_repeat_marker_b', ['monthly'])
      s = withMemoryEntry(s, 'monthly_repeat_marker_c', ['monthly'])
    }
  }
  return s
}

export function buildMonthlyReviewDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return MONTHLY_REVIEW_PERTURBATIONS.map((perturbation, i) => ({
    seed: monthlyReviewBaseSeed(
      `monthly-review-determinism-${i}`,
      perturbation.toneHints,
      perturbation.severity,
    ),
    state: buildMonthlyReviewState(baseState, perturbation),
  }))
}

export function buildMonthlyReviewDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation =
      MONTHLY_REVIEW_PERTURBATIONS[i % MONTHLY_REVIEW_PERTURBATIONS.length]!
    return {
      seed: monthlyReviewBaseSeed(
        `monthly-review-diversity-${i}`,
        perturbation.toneHints,
        perturbation.severity,
      ),
      state: buildMonthlyReviewState(baseState, perturbation),
    }
  }
}

// ---- seasonalArc state-perturbation sampler ----

const SEASONAL_ARC_THEMES: readonly string[] = [
  'mushroom_blight',
  'miner_payday_boom',
  'inspection_campaign',
  'rival_tavern_expansion',
  'festival_approaching',
]

function seasonalArcRef(): EntityRef {
  return { kind: 'local_event', id: 'phase140_seasonal_arc' }
}

function seasonalArcBaseSeed(
  id: string,
  type: 'arc_milestone' | 'festival_preparation',
  theme: string,
  primaryActor: EntityRef | undefined,
  severity: number,
  extraToneHints: readonly string[] = [],
): IssueSeed {
  const shape = SEASONAL_ARC_SHAPE()
  return makeSeed({
    id,
    family: 'seasonal_arc',
    type,
    timing: 'morning_prep',
    severity,
    domain: ['arcs', 'calendar'],
    toneHints: ['arc', 'calendar', theme, ...extraToneHints],
    ...(primaryActor ? { primaryActor } : {}),
    responseSlots: shape.responseSlots,
    consequenceProfiles: shape.consequenceProfiles,
    stakes: shape.stakes,
    textIngredients: {
      subject: 'the arc',
      sensoryDetails: ['flags rising'],
      recentContext: ['intensity 25'],
    },
  })
}

const SEASONAL_ARC_PERTURBATIONS: ReadonlyArray<{
  type: 'arc_milestone' | 'festival_preparation'
  activation: 'arc' | 'anticipation'
  theme: string
  pressure?: { id: string; value: number; trend: number }
  memory?: { id: string; tags: readonly string[] }
  extraToneHints?: readonly string[]
  severity: number
}> = [
  // Fallback baseline — anticipation festival_preparation, no rising pressure.
  {
    type: 'festival_preparation',
    activation: 'anticipation',
    theme: 'festival_approaching',
    severity: 45,
  },
  // Active arc with rising arc_escalation.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'festival_approaching',
    pressure: { id: 'arc_escalation', value: 50, trend: 1 },
    severity: 50,
  },
  // Active arc with rising festival_readiness.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'festival_approaching',
    pressure: { id: 'festival_readiness', value: 60, trend: 1 },
    severity: 50,
  },
  // Climax (arc_milestone) + arc_escalation rising.
  {
    type: 'arc_milestone',
    activation: 'arc',
    theme: 'festival_approaching',
    pressure: { id: 'arc_escalation', value: 70, trend: 1 },
    severity: 65,
  },
  // mushroom_blight theme + arc_escalation rising.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'mushroom_blight',
    pressure: { id: 'arc_escalation', value: 55, trend: 1 },
    severity: 55,
  },
  // miner_payday_boom theme + arc_escalation rising.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'miner_payday_boom',
    pressure: { id: 'arc_escalation', value: 55, trend: 1 },
    severity: 55,
  },
  // inspection_campaign theme + arc_escalation rising.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'inspection_campaign',
    pressure: { id: 'arc_escalation', value: 55, trend: 1 },
    severity: 55,
  },
  // rival_tavern_expansion theme + arc_escalation rising.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'rival_tavern_expansion',
    pressure: { id: 'arc_escalation', value: 55, trend: 1 },
    severity: 55,
  },
  // arc memory present.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'festival_approaching',
    memory: { id: 'arc_seed_prior', tags: ['arc', 'warning'] },
    severity: 50,
  },
  // festival memory present.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'festival_approaching',
    memory: { id: 'festival_prep_prior', tags: ['festival', 'prepare'] },
    severity: 50,
  },
  // Anticipation tone hint.
  {
    type: 'festival_preparation',
    activation: 'anticipation',
    theme: 'festival_approaching',
    extraToneHints: ['anticipation'],
    severity: 45,
  },
  // High severity.
  {
    type: 'arc_milestone',
    activation: 'arc',
    theme: 'mushroom_blight',
    pressure: { id: 'arc_escalation', value: 75, trend: 1 },
    severity: 75,
  },
  // High severity + memory (top rung).
  {
    type: 'arc_milestone',
    activation: 'arc',
    theme: 'festival_approaching',
    pressure: { id: 'arc_escalation', value: 80, trend: 1 },
    memory: { id: 'arc_prior_climax', tags: ['arc'] },
    severity: 80,
  },
  // Inspection theme.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'inspection_campaign',
    memory: { id: 'arc_inspection_prior', tags: ['arc'] },
    severity: 55,
  },
  // Festival theme with festival_readiness rising.
  {
    type: 'festival_preparation',
    activation: 'arc',
    theme: 'festival_approaching',
    pressure: { id: 'festival_readiness', value: 65, trend: 1 },
    memory: { id: 'festival_memory_prior', tags: ['festival'] },
    severity: 55,
  },
]

function buildSeasonalArcState(
  baseState: TavernState,
  perturbation: (typeof SEASONAL_ARC_PERTURBATIONS)[number],
): TavernState {
  let s = baseState
  if (perturbation.activation === 'arc') {
    s = {
      ...s,
      world: {
        ...s.world,
        localEvents: {
          ...s.world.localEvents,
          phase140_seasonal_arc: {
            ...(s.world.localEvents['phase140_seasonal_arc'] ?? {
              id: 'phase140_seasonal_arc',
              tags: ['arc'],
              severity: 50,
            }),
            id: 'phase140_seasonal_arc',
            label: 'The Arc',
          },
        } as TavernState['world']['localEvents'],
      },
    }
  }
  if (perturbation.pressure) {
    s = withPressure(
      s,
      perturbation.pressure.id,
      perturbation.pressure.value,
      perturbation.pressure.trend,
    )
  }
  if (perturbation.memory) {
    s = withMemoryEntry(s, perturbation.memory.id, perturbation.memory.tags)
  }
  return s
}

function seasonalArcSeedFor(
  id: string,
  perturbation: (typeof SEASONAL_ARC_PERTURBATIONS)[number],
): IssueSeed {
  const primaryActor =
    perturbation.activation === 'arc' ? seasonalArcRef() : undefined
  return seasonalArcBaseSeed(
    id,
    perturbation.type,
    perturbation.theme,
    primaryActor,
    perturbation.severity,
    perturbation.extraToneHints,
  )
}

export function buildSeasonalArcDeterminismSamples(): DeterminismSample[] {
  const baseState = createInitialTavernState()
  return SEASONAL_ARC_PERTURBATIONS.map((perturbation, i) => ({
    seed: seasonalArcSeedFor(`seasonal-arc-determinism-${i}`, perturbation),
    state: buildSeasonalArcState(baseState, perturbation),
  }))
}

export function buildSeasonalArcDiversitySampler(
  options: DiversitySamplerOptions = {},
): DiversitySampler {
  void options.rngSeed
  const baseState = createInitialTavernState()
  return (i: number) => {
    const perturbation =
      SEASONAL_ARC_PERTURBATIONS[i % SEASONAL_ARC_PERTURBATIONS.length]!
    return {
      seed: seasonalArcSeedFor(`seasonal-arc-diversity-${i}`, perturbation),
      state: buildSeasonalArcState(baseState, perturbation),
    }
  }
}

// ---- Phase 6 context builders for the two Phase-14 templates ----

// monthly_review verbs: pay / upgrade / delay / negotiate
// (`issueSeedGenerators.ts:3628-3664`).
const MONTHLY_REVIEW_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase140-monthly-pay',
    labelHint: 'Pay the landlord on time',
    allowedVerbs: ['pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower landlord pressure'],
  },
  {
    id: 'phase140-monthly-upgrade',
    labelHint: 'Invest in the cellar',
    allowedVerbs: ['upgrade'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['improve cellar'],
  },
  {
    id: 'phase140-monthly-delay',
    labelHint: 'Hold reserves through next month',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower debt'],
  },
  {
    id: 'phase140-monthly-negotiate',
    labelHint: 'Settle with the rival tavern',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lower rival pressure'],
  },
]

const MONTHLY_REVIEW_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'state_change',
    target: 'coin',
    amount: -30,
    readable: 'pay rent',
    tags: ['coin', 'rent'],
  },
  {
    kind: 'pressure',
    target: 'pressure:landlord',
    amount: -25,
    readable: 'landlord eased',
    tags: ['pressure', 'landlord'],
  },
  {
    kind: 'state_change',
    target: 'areas.cellar.condition',
    amount: 12,
    readable: 'cellar improves',
    tags: ['area', 'cellar'],
  },
  {
    kind: 'pressure',
    target: 'pressure:debt',
    amount: -4,
    readable: 'reserves held',
    tags: ['pressure', 'debt'],
  },
  {
    kind: 'pressure',
    target: 'pressure:rival_tavern_pressure',
    amount: -12,
    readable: 'rival pressure cools',
    tags: ['pressure', 'rival'],
  },
  {
    kind: 'future_hook',
    target: 'landlord_goodwill_window',
    amount: 30,
    readable: 'goodwill window opens',
    tags: ['future_hook', 'landlord'],
  },
]

export function buildMonthlyReviewChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    MONTHLY_REVIEW_RESPONSE_SLOTS[i % MONTHLY_REVIEW_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildMonthlyReviewEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    MONTHLY_REVIEW_RESPONSE_SLOTS[i % MONTHLY_REVIEW_RESPONSE_SLOTS.length]!
  const effect = MONTHLY_REVIEW_EFFECTS[i % MONTHLY_REVIEW_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

// seasonal_arc verbs vary by theme; the cross-theme verb surface from
// `buildSeasonalArcContent` (expandedSeedGenerators.ts:2849-4245) is
// wide. Five representative verbs cover the choice-label pool's gating
// (`pools/seasonalArc/choiceLabel.ts`).
const SEASONAL_ARC_RESPONSE_SLOTS: readonly ResponseSlot[] = [
  {
    id: 'phase140-arc-upgrade',
    labelHint: 'Prepare for the arc',
    allowedVerbs: ['upgrade'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise readiness'],
  },
  {
    id: 'phase140-arc-buy',
    labelHint: 'Stock up for the rush',
    allowedVerbs: ['buy'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['lay in supply'],
  },
  {
    id: 'phase140-arc-invite',
    labelHint: 'Host the moment',
    allowedVerbs: ['invite'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['gain reputation'],
  },
  {
    id: 'phase140-arc-clean',
    labelHint: 'Scrub the back rooms',
    allowedVerbs: ['clean'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'long_term_investment' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise cleanliness'],
  },
  {
    id: 'phase140-arc-raise-price',
    labelHint: 'Lift prices for the day',
    allowedVerbs: ['raise_price'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'risky_profitable' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['raise margin'],
  },
  {
    id: 'phase140-arc-bribe',
    labelHint: 'Slide coin under the table',
    allowedVerbs: ['bribe'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'deception' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['quiet trouble'],
  },
  {
    id: 'phase140-arc-rebrand',
    labelHint: 'Lean into the moment',
    allowedVerbs: ['rebrand'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'reputation_play' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['shift reputation'],
  },
  {
    id: 'phase140-arc-negotiate',
    labelHint: 'Cut a deal',
    allowedVerbs: ['negotiate'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'compromise' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['share the moment'],
  },
  {
    id: 'phase140-arc-pay',
    labelHint: 'Pay to keep it quiet',
    allowedVerbs: ['pay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['quiet a problem'],
  },
  {
    id: 'phase140-arc-delay',
    labelHint: 'Wait it out',
    allowedVerbs: ['delay'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'delay_problem' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['hold the line'],
  },
  {
    id: 'phase140-arc-discard',
    labelHint: 'Throw the bad stock out',
    allowedVerbs: ['discard'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'safe_costly' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['cut losses'],
  },
  {
    id: 'phase140-arc-ignore',
    labelHint: 'Ignore the warning',
    allowedVerbs: ['ignore'] as readonly ResponseIntentVerb[] as ResponseIntentVerb[],
    shape: 'ignore' as ResponseIntentShape,
    targetOptions: [],
    expectedEffects: ['arc deepens'],
  },
]

const SEASONAL_ARC_EFFECTS: readonly EffectPreview[] = [
  {
    kind: 'pressure',
    target: 'pressure:festival_readiness',
    amount: -10,
    readable: 'readiness lifts',
    tags: ['pressure', 'arc'],
  },
  {
    kind: 'state_change',
    target: 'coin',
    amount: -20,
    readable: 'invest coin',
    tags: ['coin'],
  },
  {
    kind: 'state_change',
    target: 'reputation.tasty',
    amount: 8,
    readable: 'reputation rises',
    tags: ['reputation'],
  },
  {
    kind: 'pressure',
    target: 'pressure:arc_escalation',
    amount: -8,
    readable: 'arc settles',
    tags: ['pressure', 'arc'],
  },
  {
    kind: 'state_change',
    target: 'stock.ale.amount',
    amount: 20,
    readable: 'stock rises',
    tags: ['stock'],
  },
  {
    kind: 'future_hook',
    target: 'arc_aftermath',
    amount: 14,
    readable: 'an aftermath surfaces',
    tags: ['future_hook'],
  },
]

export function buildSeasonalArcChoiceLabelContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    SEASONAL_ARC_RESPONSE_SLOTS[i % SEASONAL_ARC_RESPONSE_SLOTS.length]!
  return { currentResponseSlot: slot }
}

export function buildSeasonalArcEffectPreviewContext(
  _sample: DiversitySample,
  i: number,
): ConditionContext {
  const slot =
    SEASONAL_ARC_RESPONSE_SLOTS[i % SEASONAL_ARC_RESPONSE_SLOTS.length]!
  const effect = SEASONAL_ARC_EFFECTS[i % SEASONAL_ARC_EFFECTS.length]!
  return { currentResponseSlot: slot, currentEffect: effect }
}

export const __testing = {
  firstRegularId,
  installCast,
  drinkOrderSeedFor,
  regularRef,
  neutralCast,
  firstStaffId,
  installStaffCast,
  staffAsideSeedFor,
  staffRef,
  DRINK_ORDER_RESPONSE_SLOTS,
  STAFF_ASIDE_RESPONSE_SLOTS,
  DRINK_ORDER_EFFECTS,
  STAFF_ASIDE_EFFECTS,
  firstCustomerGroupId,
  installGroupCast,
  customerGroupRef,
  REGULAR_COMPLAINT_RESPONSE_SLOTS,
  CUSTOMER_COMPLAINT_RESPONSE_SLOTS,
  firstSupplierId,
  installSupplierCast,
  supplierOfferSeedFor,
  supplierRef,
  SUPPLIER_RELIABILITY_RESPONSE_SLOTS,
  STOCK_SHORTAGE_RESPONSE_SLOTS,
  DEBT_RENT_RESPONSE_SLOTS,
  STOCK_PERTURBATIONS,
  DEBT_PERTURBATIONS,
  firstFactionId,
  installFactionCast,
  factionRequestSeedFor,
  factionRef,
  firstCultureId,
  cultureRef,
  FACTION_REQUEST_RESPONSE_SLOTS,
  CULTURE_CONFLICT_RESPONSE_SLOTS,
  CULTURE_PERTURBATIONS,
  firstAreaId,
  maintenanceBaseSeed,
  areaAtmosphereBaseSeed,
  buildMaintenanceState,
  buildAreaAtmosphereState,
  MAINTENANCE_RESPONSE_SLOTS,
  AREA_ATMOSPHERE_RESPONSE_SLOTS,
  MAINTENANCE_PERTURBATIONS,
  AREA_ATMOSPHERE_PERTURBATIONS,
  REPUTATION_PERTURBATIONS,
  RIVAL_PERTURBATIONS,
  REPUTATION_SHIFT_RESPONSE_SLOTS,
  RUMOUR_CRISIS_RESPONSE_SLOTS,
  RIVAL_TAVERN_RESPONSE_SLOTS,
  MONTHLY_REVIEW_PERTURBATIONS,
  MONTHLY_REVIEW_RESPONSE_SLOTS,
  SEASONAL_ARC_PERTURBATIONS,
  SEASONAL_ARC_RESPONSE_SLOTS,
  SEASONAL_ARC_THEMES,
}
