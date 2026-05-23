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
  createRegularCastAttributes,
  createStaffCastAttributes,
} from '../../../../src/sim/content/cast'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
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
  return makeSeed({
    id,
    family: 'regular_customer',
    type: 'relationship_test',
    timing: 'during_service',
    severity: 35,
    domain: ['regulars', 'customers', 'social'],
    primaryActor: regularRef(regularId),
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
  return makeSeed({
    id,
    family: 'staff_identity',
    type: 'relationship_test',
    timing: 'morning_prep',
    severity: 40,
    domain: ['staff', 'identity', 'social'],
    primaryActor: staffRef(staffId),
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
      sensoryDetails: ['half-empty mug', 'cold stare'],
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
}
