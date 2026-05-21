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
import { createRegularCastAttributes } from '../../../../src/sim/content/cast'
import type {
  CastAttributes,
  VerbalTicId,
} from '../../../../src/sim/content/cast'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../../../src/sim/state/TavernState'
import type {
  DeterminismSample,
  DiversitySampler,
} from '../../../../src/cards/compose/gates'
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

/**
 * Pull every regular and staff `name.display` from the given state.
 * Used to feed the sim-coherence gate the list of names it should ban
 * from flavor snippet text.
 */
export function representativeBannedNames(
  state: TavernState,
): readonly string[] {
  const out = new Set<string>()
  for (const regular of Object.values(state.world.regulars)) {
    if (regular?.name?.display) out.add(regular.name.display)
  }
  for (const staff of Object.values(state.staff)) {
    if (staff?.name?.display) out.add(staff.name.display)
  }
  return [...out]
}

export const __testing = {
  firstRegularId,
  installCast,
  drinkOrderSeedFor,
  regularRef,
  neutralCast,
}
