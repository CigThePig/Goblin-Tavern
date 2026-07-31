import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ValidationIssue } from '../../state/types'
import type {
  CustomerGroupState,
  RegularWorldState,
} from '../../state/TavernState'
import { generateName } from '../../content/naming/nameGenerator'
import {
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../../content/naming/namingProfiles'
import { createRegularCastAttributes } from '../../content/cast/createCastAttributes'

import {
  REGULARS_MODULE_ID,
  createInitialRegularModuleState,
  getRegularModuleState,
} from './state'
import { buildRegularReport } from './regularReport'
import { regularServiceDefaults } from './regularDefaults'
import { assessVisit, returnCondition, rollVisit } from './visits'
import { openRequests, sweepRequests } from './regularRequests'
import { recordVisitOutcomes } from './regularOutcomes'
import type {
  RegularEmergenceCandidate,
  RegularModuleState,
  RegularVisitIntent,
} from './types'

// Phase 27 §27.4 / Phase 30 §30.6 — Regular customer module.
//
// Phase 27 reserved the seam; Phase 30 wires the actual behaviour:
//   - `startDay` resets the per-day slice so reports only reflect today.
//   - `regularCustomerUpdate` evaluates each customer group for
//     emergence eligibility, optionally rolls a name through the
//     `regular_identity` RNG stream (Phase 24), and writes the resulting
//     `RegularWorldState` to `state.world.regulars`. Existing regulars
//     are then evaluated for whether they visit today.
//
// Emergence is intentionally conservative: regulars should feel
// notable, not pour out of the wall like named confetti. Each group
// gets at most one creation candidate per day, and the rolled chance
// is small (5–15%) gated behind loyalty/satisfaction thresholds.
//
// All randomness routes through `ctx.getRngStream('regular_identity')`
// so an extra service roll cannot shift a generated regular's name
// across re-runs of the same seed.

const SOURCE = 'regulars'
const STREAM_ID = 'regular_identity' as const

const MIN_LOYALTY_FOR_EMERGENCE = 70
const MIN_SATISFACTION_FOR_EMERGENCE = 55
// Phase 51 / ISSUE-011 — cap lifted from 3 to 7 so the emergent roster
// can grow into the ~20-30-regular range the named-entity audit expects
// before soft decay kicks in. Decay (below) is the real gate; the cap
// just prevents single-group runaway. Exported so phase tests can pin
// the value without depending on emergence-roll behaviour.
export const MAX_REGULARS_PER_GROUP = 7
const HIGH_IRRITATION_THRESHOLD = 70

// Phase 51 / ISSUE-011 — soft-decay thresholds. A regular only leaves
// state when BOTH gates clear: they have not visited in INACTIVE_DECAY_DAYS
// AND they carry irritation at or above INACTIVE_DECAY_IRRITATION. Quiet
// groups whose patronage stays below 40 do not accrue irritation, so
// regulars in low-traffic groups never decay.
const INACTIVE_DECAY_DAYS = 45
const INACTIVE_DECAY_IRRITATION = 75

function emergenceChance(group: CustomerGroupState): number {
  // Base 5% chance, scaled up with loyalty and satisfaction above the
  // minimum thresholds, plus a small bump for high patronage groups.
  const loyaltyBonus = Math.max(0, group.loyalty - MIN_LOYALTY_FOR_EMERGENCE)
  const satisfactionBonus = Math.max(
    0,
    group.satisfaction - MIN_SATISFACTION_FOR_EMERGENCE,
  )
  const patronageBonus = Math.max(0, group.patronage - 40)
  const raw = 0.05 + loyaltyBonus * 0.003 + satisfactionBonus * 0.002 + patronageBonus * 0.001
  return Math.min(0.18, Math.round(raw * 1000) / 1000)
}

function regularsForGroup(ctx: SimContext, groupId: string): RegularWorldState[] {
  const out: RegularWorldState[] = []
  for (const regular of Object.values(ctx.state.world.regulars)) {
    if (regular.customerGroupId === groupId) out.push(regular)
  }
  return out
}

function makeRegularId(
  ctx: SimContext,
  group: CustomerGroupState,
  index: number,
): string {
  const baseDay = ctx.state.calendar.totalDaysElapsed
  return `${group.id}_regular_${baseDay}_${index}`
}

function pickFavoriteStockId(
  ctx: SimContext,
  group: CustomerGroupState,
): string | undefined {
  const preferred = group.preferredStockTags
  if (preferred.length === 0) return undefined
  for (const tag of preferred) {
    const matches = Object.values(ctx.state.stock).filter((s) =>
      s.tags.includes(tag),
    )
    if (matches.length > 0) {
      const rng = ctx.getRngStream(STREAM_ID)
      const pick = rng.pick(matches)
      return pick.id
    }
  }
  return undefined
}

function createRegular(
  ctx: SimContext,
  group: CustomerGroupState,
  candidate: RegularEmergenceCandidate,
): RegularWorldState | undefined {
  ensureStarterNamingProfilesRegistered()
  const profileId = group.namingProfileId
  if (!namingProfileRegistry.has(profileId)) return undefined
  const profile = namingProfileRegistry.get(profileId)
  const rng = ctx.getRngStream(STREAM_ID)
  const name = generateName(profile, rng, 'regular_customer')

  const existing = regularsForGroup(ctx, group.id)
  const id = makeRegularId(ctx, group, existing.length + 1)
  const today = ctx.state.calendar.totalDaysElapsed
  const favoriteStockId = pickFavoriteStockId(ctx, group)

  // Phase 121 / ISSUE-090 — Living Cast Phase A. Bounded selection
  // vocabulary attached to every emergent regular. Rolls land on the
  // SAME regular_identity stream, AFTER the name + favouriteStock
  // rolls, so existing canonical regular names stay byte-identical.
  const castAttributes = createRegularCastAttributes({
    ...(group.cultureId !== undefined ? { cultureId: group.cultureId } : {}),
    customerGroupId: group.id,
    rng,
  })

  const regular: RegularWorldState = {
    id,
    name,
    customerGroupId: group.id,
    ...(group.cultureId ? { cultureId: group.cultureId } : {}),
    loyalty: Math.max(50, Math.min(100, group.loyalty)),
    irritation: 0,
    visits: 0,
    ...(favoriteStockId ? { favoriteStockId } : {}),
    knownIncidentIds: [],
    firstSeenDay: today,
    lastSeenDay: today,
    tags: ['regular', ...(group.cultureId ? [`culture:${group.cultureId}`] : [])],
    activeFlags: [],
    castAttributes,
    // Expansion Phase 4 §4.3 — from the one shared definition, so an emergent
    // regular, a starter regular and a migrated regular are the same shape.
    ...regularServiceDefaults(Math.max(50, Math.min(100, group.loyalty))),
  }

  ctx.addRegular(regular, {
    source: `${SOURCE}.emergence`,
    sourceType: 'regular',
    target: id,
    targetType: 'regular',
    amount: 1,
    direction: 'increase',
    readable: `${name.display} became a regular (${group.label}: ${candidate.reason}).`,
    tags: ['regular', 'emergence', group.id],
    relatedActors: [{ kind: 'customer_group', id: group.id }],
  })
  return regular
}


const startDayHook: SimulationHook = (ctx: SimContext): void => {
  ctx.modifyModuleState<RegularModuleState>(
    REGULARS_MODULE_ID,
    () => createInitialRegularModuleState(),
    { source: `${SOURCE}.day_initialize` },
  )
}

const regularUpdateHook: SimulationHook = (ctx: SimContext): void => {
  const candidates: RegularEmergenceCandidate[] = []
  const createdToday: string[] = []
  const visitedToday: string[] = []
  const rng = ctx.getRngStream(STREAM_ID)

  for (const group of Object.values(ctx.state.customerGroups)) {
    const existing = regularsForGroup(ctx, group.id)
    if (
      group.loyalty < MIN_LOYALTY_FOR_EMERGENCE ||
      group.satisfaction < MIN_SATISFACTION_FOR_EMERGENCE
    ) {
      continue
    }
    if (existing.length >= MAX_REGULARS_PER_GROUP) continue

    const chance = emergenceChance(group)
    const reason =
      group.satisfaction >= 70
        ? 'high_loyalty_satisfaction'
        : 'loyalty_threshold'
    const candidate: RegularEmergenceCandidate = {
      groupId: group.id,
      chance,
      reason,
      tags: ['regular_emergence', group.id],
    }
    candidates.push(candidate)
    if (rng.chance(chance)) {
      const created = createRegular(ctx, group, candidate)
      if (created) createdToday.push(created.id)
    }
  }

  // Expansion Phase 4 §4.3 — DECIDE, do not resolve.
  //
  // The old pass rolled a visit and immediately credited it: `visits + 1`,
  // `lastSeenDay = today`, loyalty up. So a regular "visited" a tavern that
  // might have had no seats, no cook and nothing to sell, and the visit counter
  // measured intent rather than attendance. Now the roll produces an INTENT the
  // service flow has to honour; the credit is given in `afterService`, to the
  // ones who actually got in.
  const intents: RegularVisitIntent[] = []
  const returnedToday: string[] = []
  for (const regular of sortedRegulars(ctx)) {
    const group = ctx.state.customerGroups[regular.customerGroupId]

    // A lapsed regular is not rolling for a visit — they are checking whether
    // the thing that drove them off has changed (§4.3 "return under changed
    // conditions").
    if (regular.stoppedVisiting) {
      const condition = returnCondition(ctx, regular)
      if (!condition) continue
      returnedToday.push(regular.id)
      ctx.modifyRegular(
        regular.id,
        { stoppedVisiting: undefined, consecutiveBadVisits: 0 },
        {
          source: `${SOURCE}.return`,
          sourceType: 'regular',
          target: regular.id,
          targetType: 'regular',
          amount: 1,
          direction: 'increase',
          readable: `${regular.name.display} came back — ${condition}.`,
          tags: ['regular', 'return', regular.customerGroupId],
          relatedActors: [{ kind: 'regular', id: regular.id }],
          relatedSystems: ['regulars'],
        },
      )
      ctx.addHistory({
        category: 'service',
        summary: `${regular.name.display} started coming back (${condition}).`,
        tags: ['regular', 'return'],
        relatedActors: [{ kind: 'regular', id: regular.id }],
        relatedSystems: ['regulars'],
        mechanicalRefs: [regular.id],
      })
    }

    const assessment = assessVisit(ctx, regular, group)
    if (!rollVisit(ctx, assessment)) continue
    intents.push({
      regularId: regular.id,
      groupId: regular.customerGroupId,
      probability: assessment.probability,
      drivers: assessment.drivers,
    })
  }

  // §4.3 "make requests or pursue a small goal" — at most one open request per
  // person, opened only when they have the standing to ask.
  const requestsOpened = openRequests(ctx)

  ctx.modifyModuleState<RegularModuleState>(
    REGULARS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialRegularModuleState()
      return {
        ...base,
        candidatesToday: candidates,
        createdToday,
        visitedToday,
        visitIntents: intents,
        returnedToday,
        requestsOpened,
      }
    },
    { source: `${SOURCE}.update` },
  )
}

function sortedRegulars(ctx: SimContext): RegularWorldState[] {
  return Object.values(ctx.state.world.regulars).sort((a, b) =>
    a.id.localeCompare(b.id),
  )
}

/**
 * Expansion Phase 4 §4.3 — read the night back.
 *
 * Runs at `afterService`, after the service module's flow has resolved, so
 * every regular who set out tonight gets the outcome they actually had. This
 * is where a visit is finally counted, where the memory is written, and where
 * three bad nights in a row end with somebody deciding not to come back.
 */
const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  const slice = getRegularModuleState(ctx.state)
  const intentIds = slice.visitIntents.map((intent) => intent.regularId)
  const { outcomes, visited, stopped } = recordVisitOutcomes(ctx, intentIds)
  const requestsResolved = sweepRequests(ctx)

  ctx.modifyModuleState<RegularModuleState>(
    REGULARS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialRegularModuleState()
      return {
        ...base,
        outcomes,
        // Only the regulars who were actually served count as having visited.
        visitedToday: visited,
        stoppedToday: stopped,
        requestsResolved,
      }
    },
    { source: `${SOURCE}.outcomes` },
  )
}

// Phase 51 / ISSUE-011 — Soft decay for inactive, irritated regulars.
// Runs on `closing` after service has stamped today's `lastSeenDay`
// updates. Each removal emits a `regulars.decay` cause and records the
// id in the module slice's `decayedToday` array so reports and the
// validator can confirm the drop.
const closingHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  const decayedToday: string[] = []
  for (const regular of Object.values(ctx.state.world.regulars)) {
    const daysInactive = today - regular.lastSeenDay
    if (
      daysInactive < INACTIVE_DECAY_DAYS ||
      regular.irritation < INACTIVE_DECAY_IRRITATION
    ) {
      continue
    }
    const removedId = regular.id
    const removedDisplay = regular.name.display
    const removedGroupId = regular.customerGroupId
    ctx.removeRegular(removedId, {
      source: `${SOURCE}.decay`,
      sourceType: 'regular',
      target: removedId,
      targetType: 'regular',
      amount: -1,
      direction: 'decrease',
      readable: `${removedDisplay} stopped being a regular (${daysInactive} days absent, irritation ${regular.irritation}).`,
      tags: ['regular', 'decay', removedGroupId],
      relatedActors: [{ kind: 'customer_group', id: removedGroupId }],
    })
    decayedToday.push(removedId)
  }
  if (decayedToday.length === 0) return
  ctx.modifyModuleState<RegularModuleState>(
    REGULARS_MODULE_ID,
    (current) => {
      const base = current ?? createInitialRegularModuleState()
      return {
        ...base,
        decayedToday: [...base.decayedToday, ...decayedToday],
      }
    },
    { source: `${SOURCE}.decay` },
  )
}

function validateRegularState(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = getRegularModuleState(ctx.state)
  for (let i = 0; i < slice.createdToday.length; i++) {
    const id = slice.createdToday[i]!
    if (!(id in ctx.state.world.regulars)) {
      issues.push({
        path: `modules.regulars.createdToday[${i}]`,
        message: `Unknown regular id '${id}' in createdToday`,
        code: 'unknown_regular_ref',
      })
    }
  }
  for (let i = 0; i < slice.visitedToday.length; i++) {
    const id = slice.visitedToday[i]!
    if (!(id in ctx.state.world.regulars)) {
      issues.push({
        path: `modules.regulars.visitedToday[${i}]`,
        message: `Unknown regular id '${id}' in visitedToday`,
        code: 'unknown_regular_ref',
      })
    }
  }
  for (let i = 0; i < slice.candidatesToday.length; i++) {
    const candidate = slice.candidatesToday[i]!
    if (!(candidate.groupId in ctx.state.customerGroups)) {
      issues.push({
        path: `modules.regulars.candidatesToday[${i}].groupId`,
        message: `Unknown customer_group id '${candidate.groupId}' in candidate`,
        code: 'unknown_customer_group_ref',
      })
    }
  }
  // Phase 51 / ISSUE-011 — decayedToday must reference ids that have
  // actually left state. The decay hook deletes the entry immediately
  // before recording the id, so the inverse check is the right invariant.
  // Read defensively so a hand-injected slice without the new field
  // (legacy tests, custom test rigs) still flows through the other
  // validation paths and gets caught by the schema check separately.
  const decayedToday = slice.decayedToday ?? []
  for (let i = 0; i < decayedToday.length; i++) {
    const id = decayedToday[i]!
    if (id in ctx.state.world.regulars) {
      issues.push({
        path: `modules.regulars.decayedToday[${i}]`,
        message: `Regular '${id}' marked as decayed but still present in world.regulars`,
        code: 'unknown_regular_ref',
      })
    }
  }
  return issues
}

const RegularEmergenceCandidateSchema = z.object({
  groupId: z.string(),
  chance: z.number().min(0).max(1),
  reason: z.string(),
  tags: z.array(z.string()),
})

// Expansion Phase 4 §4.3 — the visit lifecycle's per-day scratch. All
// `.default([])` so a slice written before this phase validates forward; the
// hooks rewrite them every day.
const RegularVisitIntentSchema = z.object({
  regularId: z.string(),
  groupId: z.string(),
  probability: z.number().min(0).max(1),
  drivers: z.array(z.string()),
})

const RegularVisitOutcomeSchema = z.object({
  regularId: z.string(),
  outcome: z.enum(['served', 'abandoned', 'turned_away', 'no_visit']),
  partyId: z.string().optional(),
  readable: z.string(),
})

const RegularModuleStateSchema = z.object({
  candidatesToday: z.array(RegularEmergenceCandidateSchema),
  createdToday: z.array(z.string()),
  visitedToday: z.array(z.string()),
  decayedToday: z.array(z.string()),
  visitIntents: z.array(RegularVisitIntentSchema).default([]),
  outcomes: z.array(RegularVisitOutcomeSchema).default([]),
  stoppedToday: z.array(z.string()).default([]),
  returnedToday: z.array(z.string()).default([]),
  requestsOpened: z.array(z.string()).default([]),
  requestsResolved: z.array(z.string()).default([]),
})

export { REGULARS_MODULE_ID, createInitialRegularModuleState, getRegularModuleState }

export const regularModule: SimulationModule = {
  id: REGULARS_MODULE_ID,
  version: '0.4.0',
  // Expansion Phase 4 §4.3 — no `dependsOn: ['service']`, deliberately. The
  // outcome pass reads the flow the service module wrote during the `service`
  // PHASE, and this hook runs in `afterService`, so the pipeline's phase order
  // already guarantees it. Declaring the dependency would additionally force
  // every test rig that exercises regulars to drag in the whole service module,
  // and `readServiceFlow` already copes with the flow being absent.
  hooks: {
    startDay: [startDayHook],
    regularCustomerUpdate: [regularUpdateHook],
    afterService: [afterServiceHook],
    closing: [closingHook],
  },
  buildReport: buildRegularReport,
  validate: validateRegularState,
  stateSchema: RegularModuleStateSchema,
}
