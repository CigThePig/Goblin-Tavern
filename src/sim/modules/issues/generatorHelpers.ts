import type { SimContext } from '../../core/context'
import type {
  CalendarStamp,
  CauseEntry,
  EntityRef,
  TavernState,
} from '../../state/TavernState'
import type { EffectPreview } from '../../core/effect'
import type {
  ConsequenceProfile,
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedTiming,
  IssueSeedType,
  ResponseSlot,
  StakeRef,
  TextIngredients,
} from './issueSeedTypes'
import { scoreProfile } from './impactScoring'

// Phase 19 — Shared helpers for seed generators.
//
// Generators build seeds from current state, pressure snapshots, and
// recent causes. These helpers keep the family-specific generators
// short and consistent.

export function stampFromState(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

export function effect(
  kind: EffectPreview['kind'],
  target: string,
  amount: number,
  readable: string,
  tags: string[] = [],
): EffectPreview {
  return { kind, target, amount, readable, tags }
}

/** Compute impactScore for a profile shaped by partial inputs. */
export function makeProfile(
  partial: Omit<ConsequenceProfile, 'impactScore'>,
): ConsequenceProfile {
  const impactScore = scoreProfile(partial)
  return { ...partial, impactScore }
}

/** Sum severity from given pressures (clamped). */
export function severityFromPressures(
  ctx: SimContext,
  pressureIds: string[],
): number {
  let total = 0
  let count = 0
  const snapshots = (ctx.state.modules.pressures as
    | { snapshots?: Record<string, { value: number; severity: number }> }
    | undefined)?.snapshots ?? {}
  for (const id of pressureIds) {
    const snap = snapshots[id]
    if (!snap) continue
    total += snap.severity
    count += 1
  }
  if (count === 0) return 0
  return Math.round(total / count)
}

export function urgencyFromPressures(
  ctx: SimContext,
  pressureIds: string[],
): number {
  let total = 0
  let count = 0
  const snapshots = (ctx.state.modules.pressures as
    | { snapshots?: Record<string, { value: number; urgency: number }> }
    | undefined)?.snapshots ?? {}
  for (const id of pressureIds) {
    const snap = snapshots[id]
    if (!snap) continue
    total += snap.urgency
    count += 1
  }
  if (count === 0) return 0
  return Math.round(total / count)
}

/** Filter recent causes (created within `days`) matching any of the
 *  given tags. */
export function recentCauseEntries(
  ctx: SimContext,
  tags: string[],
  days: number = 3,
  limit: number = 4,
): CauseEntry[] {
  const recent = ctx.getRecentCauses(days)
  const matching: CauseEntry[] = []
  for (const cause of recent) {
    if (tags.some((tag) => cause.tags.includes(tag))) {
      matching.push(cause)
    }
  }
  matching.sort((a, b) => b.weight - a.weight)
  return matching.slice(0, limit)
}

/** Manufacture a synthetic cause from a pressure cause-ref. The pressure
 *  module records its own `state.causes` entries when shifts are
 *  significant, but the calculation always exposes the breakdown via the
 *  snapshot. We adapt those refs to CauseEntries so seeds always have at
 *  least two causes. */
export function pressureCauseRefsAsEntries(
  ctx: SimContext,
  pressureId: string,
  limit: number = 3,
): CauseEntry[] {
  const snapshots = (ctx.state.modules.pressures as
    | {
        snapshots?: Record<
          string,
          {
            causes: Array<{
              id: string
              readable: string
              amount: number
              weight: number
              direction: 'increase' | 'decrease' | 'neutral'
              tags: string[]
            }>
          }
        >
      }
    | undefined)?.snapshots ?? {}
  const snap = snapshots[pressureId]
  if (!snap) return []
  const stamp = stampFromState(ctx.state)
  return snap.causes.slice(0, limit).map((ref, idx) => ({
    id: `pressure-${pressureId}-${idx}-${stamp.absoluteDay}`,
    timestamp: stamp,
    source: `pressures.${pressureId}`,
    sourceType: 'pressure' as const,
    target: `pressure:${pressureId}`,
    targetType: 'pressure' as const,
    amount: ref.amount,
    direction: ref.direction,
    weight: ref.weight,
    readable: ref.readable,
    tags: [...ref.tags],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    ageDays: 0,
  }))
}

/** Build a basic text ingredients object, trimmed to fit budgets. */
export function buildTextIngredients(input: {
  subject: string
  problemNoun?: string
  sensoryDetails?: string[]
  actorOpinions?: Record<string, string>
  recentContext?: string[]
  stakesReadable?: string[]
}): TextIngredients {
  return {
    subject: input.subject,
    ...(input.problemNoun !== undefined
      ? { problemNoun: input.problemNoun }
      : {}),
    sensoryDetails: (input.sensoryDetails ?? []).slice(0, 3),
    actorOpinions: Object.fromEntries(
      Object.entries(input.actorOpinions ?? {}).slice(0, 2),
    ),
    recentContext: (input.recentContext ?? []).slice(0, 3),
    stakesReadable: (input.stakesReadable ?? []).slice(0, 3),
  }
}

/** Build a stake ref. */
export function stake(
  id: string,
  target: string,
  readable: string,
  direction: StakeRef['direction'] = 'loss',
  tags: string[] = [],
): StakeRef {
  return { id, target, readable, direction, tags }
}

/** Build a seed id stable for a single day. */
export function seedId(
  family: string,
  templateId: string,
  ctx: SimContext,
): string {
  const stamp = stampFromState(ctx.state)
  return `seed-${family}-${templateId}-d${stamp.absoluteDay}`
}

/** Skeleton seed factory. */
export function buildSeed(input: {
  id: string
  family: IssueSeedFamilyId | string
  type: IssueSeedType
  timing: IssueSeedTiming
  domain: string[]
  severity: number
  urgency: number
  location?: EntityRef | undefined
  primaryActor?: EntityRef | undefined
  affectedActors?: EntityRef[]
  causes: CauseEntry[]
  pressures?: IssueSeed['pressures']
  stakes: StakeRef[]
  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]
  memoriesCreated?: IssueSeed['memoriesCreated']
  futureHooks?: IssueSeed['futureHooks']
  toneHints?: string[]
  textIngredients: TextIngredients
  ctx: SimContext
}): IssueSeed {
  const { ctx, location, primaryActor, ...rest } = input
  const seed: IssueSeed = {
    id: rest.id,
    family: rest.family,
    type: rest.type,
    timing: rest.timing,
    domain: rest.domain,
    severity: rest.severity,
    urgency: rest.urgency,
    novelty: 0,
    cardWorthiness: 0,
    affectedActors: rest.affectedActors ?? [],
    causes: rest.causes,
    pressures: rest.pressures ?? [],
    stakes: rest.stakes,
    responseSlots: rest.responseSlots,
    consequenceProfiles: rest.consequenceProfiles,
    memoriesCreated: rest.memoriesCreated ?? [],
    futureHooks: rest.futureHooks ?? [],
    toneHints: rest.toneHints ?? [],
    textIngredients: rest.textIngredients,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      contractChecks: {},
    },
    generatedAt: stampFromState(ctx.state),
  }
  if (location !== undefined) seed.location = location
  if (primaryActor !== undefined) seed.primaryActor = primaryActor
  return seed
}

/** Read pressure snapshot directly. */
export function pressureSnapshot(
  ctx: SimContext,
  id: string,
):
  | {
      id: string
      value: number
      severity: number
      urgency: number
      trend: 'rising' | 'stable' | 'falling'
    }
  | undefined {
  const snapshots = (ctx.state.modules.pressures as
    | {
        snapshots?: Record<
          string,
          {
            id: string
            value: number
            severity: number
            urgency: number
            trend: 'rising' | 'stable' | 'falling'
          }
        >
      }
    | undefined)?.snapshots ?? {}
  return snapshots[id]
}

/** EntityRef helpers. */
export function areaRef(id: string): EntityRef {
  return { kind: 'area', id }
}
export function stockRef(id: string): EntityRef {
  return { kind: 'stock', id }
}
export function staffRef(id: string): EntityRef {
  return { kind: 'staff', id }
}
export function customerRef(id: string): EntityRef {
  return { kind: 'customer_group', id }
}
export function systemRef(id: string): EntityRef {
  return { kind: 'system', id }
}
