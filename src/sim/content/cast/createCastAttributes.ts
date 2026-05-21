// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Factories that produce a single `CastAttributes` record per character
// using a caller-supplied seeded RNG. The caller is responsible for
// routing the correct named identity stream in
// (`ctx.getRngStream('staff_identity')` for staff,
// `ctx.getRngStream('regular_identity')` for regulars,
// `createRngStreams('initial-cast-attributes')` for migration).
//
// THE ROLL ORDER IS COMMITTED FOREVER. Re-ordering, inserting, or
// removing a roll shifts every canonical attribute the codebase has
// ever produced for that seed. Changes to the roll order MUST land as
// a new phase with a migration story, not a silent edit.
//
// Order, per character:
//   1. specialty       — rng.pick(domain)
//   2. blindspot       — rng.pick(domain minus specialty)
//   3. affinity count  — rng.pick([1, 2])
//   4. for each affinity:  rng.pick(targets) then polarity then strength
//   5. for each voice axis in VOICE_AXIS_IDS order: perturbation roll
//   6. verbal-tic chance roll, then (if hit) rng.pick(registry)
//
// Existing identity rolls (work style, stress response, naming, etc.)
// fire BEFORE the new cast-attribute rolls in the canonical staff and
// regular factories, so adding this layer does not shift any
// previously-generated name or identity field.

import type { SimRng } from '../../core/rng'
import type { StaffRoleId } from '../../state/TavernState'
import { AFFINITY_TARGETS } from './affinityTargets'
import type {
  AffinityAxis,
  AffinityPolarity,
  AffinityStrength,
  CastAttributes,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceProfile,
} from './castTypes'
import { getCultureVoiceDefault } from './cultureVoiceDefaults'
import { REGULAR_SOCIAL_SPECIALTIES } from './regularSpecialties'
import { getStaffSpecialtyDomain } from './staffSpecialties'
import {
  ensureRequiredVerbalTicsRegistered,
  verbalTicRegistry,
} from './verbalTics'
import { VOICE_AXIS_IDS } from './voiceAxes'

const VERBAL_TIC_PROBABILITY = 0.4
const PERTURBATION_ROLLS: readonly number[] = [-1, 0, 0, 1]
const AFFINITY_COUNT_OPTIONS: readonly AffinityStrength[] = [1, 2]
const AFFINITY_POLARITIES: readonly AffinityPolarity[] = ['toward', 'away']
const AFFINITY_STRENGTHS: readonly AffinityStrength[] = [1, 2]
const MID_AXIS_VALUE: VoiceAxisValue = 1

export type CreateStaffCastAttributesArgs = {
  roleId: StaffRoleId
  cultureId?: string
  rng: SimRng
}

export type CreateRegularCastAttributesArgs = {
  cultureId?: string
  customerGroupId?: string
  rng: SimRng
}

export function createStaffCastAttributes(
  args: CreateStaffCastAttributesArgs,
): CastAttributes {
  ensureRequiredVerbalTicsRegistered()
  const domain = getStaffSpecialtyDomain(args.roleId)
  return rollAttributes({
    rng: args.rng,
    domain,
    cultureId: args.cultureId,
  })
}

export function createRegularCastAttributes(
  args: CreateRegularCastAttributesArgs,
): CastAttributes {
  ensureRequiredVerbalTicsRegistered()
  return rollAttributes({
    rng: args.rng,
    domain: REGULAR_SOCIAL_SPECIALTIES,
    cultureId: args.cultureId,
  })
}

type RollArgs = {
  rng: SimRng
  domain: readonly string[]
  cultureId: string | undefined
}

function rollAttributes(args: RollArgs): CastAttributes {
  const { rng, domain, cultureId } = args
  if (domain.length < 2) {
    throw new Error(
      'rollAttributes: specialty domain must contain at least two entries (for distinct specialty + blindspot).',
    )
  }

  const specialty = rng.pick([...domain])
  const blindspotPool = domain.filter((entry) => entry !== specialty)
  const blindspot = rng.pick([...blindspotPool])

  const affinityCount = rng.pick([...AFFINITY_COUNT_OPTIONS])
  const affinities: AffinityAxis[] = []
  for (let i = 0; i < affinityCount; i += 1) {
    const target = rng.pick([...AFFINITY_TARGETS])
    const polarity = rng.pick([...AFFINITY_POLARITIES])
    const strength = rng.pick([...AFFINITY_STRENGTHS])
    affinities.push({ target, polarity, strength })
  }

  const voice = rollVoiceProfile(rng, cultureId)

  return { specialty, blindspot, affinities, voice }
}

function rollVoiceProfile(
  rng: SimRng,
  cultureId: string | undefined,
): VoiceProfile {
  const cultureDefaults = getCultureVoiceDefault(cultureId)
  const axes = {} as Record<VoiceAxisId, VoiceAxisValue>
  for (const axisId of VOICE_AXIS_IDS) {
    const base = cultureDefaults[axisId] ?? MID_AXIS_VALUE
    const perturbation = rng.pick([...PERTURBATION_ROLLS])
    axes[axisId] = clampAxis(base + perturbation)
  }

  const ticHit = rng.float() < VERBAL_TIC_PROBABILITY
  if (!ticHit) {
    return { axes }
  }
  const tics = verbalTicRegistry.all()
  if (tics.length === 0) {
    return { axes }
  }
  const tic = rng.pick(tics)
  return { axes, verbalTic: tic.id }
}

function clampAxis(value: number): VoiceAxisValue {
  if (value <= 0) return 0
  if (value >= 2) return 2
  return 1
}
