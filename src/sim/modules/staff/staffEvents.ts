import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { StaffState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { staffRegistry } from '../../registries/staffRegistry'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  getLiveScheduledEvents,
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventMutation,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import {
  bumpStaffTotal,
  getEmployment,
  getStaffModuleState,
} from './workforceState'
import { STAFF_MODULE_ID } from './workforceState'
import {
  effectiveNoticeDays,
  giveNotice,
  separateStaff,
  severanceFor,
} from './employment'
import { listWageArrears, totalWageArrears } from './staffWages'
import {
  adjustEdge,
  coworkerEdgeId,
  getOwnerEdge,
  listActiveEdgesFor,
  noteContact,
  ownerEdgeId,
  ownerTrust,
} from './relationships'
import { grantExperience } from './development'
import { findTrainingLearner } from './relationships'
import { totalCoverageGap } from './roster'
import {
  AUTHORITY_TEST_EVENT,
  COVERAGE_GAP_EVENT,
  CROSS_STAFF_GRUMBLE_EVENT,
  RAISE_PROMISED_EVENT,
  STAFF_BONUS_EXPECTED_EVENT,
  STAFF_LOYALTY_MEMORY_EVENT,
  STAFF_QUIT_RISK_EVENT,
  STAFF_RAISE_DEMAND_EVENT,
  STAFF_SEPARATION_EVENT,
  TRAINING_HELPER_EVENT,
  WAGE_EXPECTATION_EVENT,
} from './staffEventTypes'

// Expansion Phase 3 §3.4 + Phase 1 §1.1 — twelve hook families move from
// narrative to mechanical, and the staff half of `OBL-02` closes.
//
// WHAT WAS BROKEN. `staff_quit_risk_<staff>` was the headline example of
// `OBL-02`: three separate response profiles told the player, in so many words,
// that a named staff member might quit. The responses module drained the hook on
// its scheduled day and — because no module owned the string — wrote a
// zero-weight cause and nothing else. The promise was made 189 times across 98
// families and kept none of them.
//
// Phase 3 can keep twelve of those promises, because this phase finally owns the
// records they are about: employment terms, arrears, absence, relationships,
// cross-training and separation. `apology_expectation_*` is the one Phase-3
// family that stays narrative, and it is recorded rather than fudged: its subject
// is a CUSTOMER GROUP (`apology_expectation_${group.id}`), so it belongs to the
// customer domain Phase 4 owns, and its ledger row moves there rather than being
// answered here by something that only looks like a resolution.
//
// §3.4's NINE REQUIREMENTS, and where each is met:
//
//   1. warn the player                  `warningWindowDays: 3` → status `warned`,
//                                       surfaced in the STAFF REPORT
//   2. identify preventable contributors `describeQuitRiskContributors`, which
//                                       reads real records, not a severity band
//   3. allow meaningful counterplay      pay arrears, grant the raise, grant
//                                       leave, negotiate — each of which changes
//                                       a contributor the resolver re-reads
//   4. evaluate the target when due      the resolver reads live state, never the
//                                       state at scheduling time
//   5. cancel / defer / negotiate / separate  four branches, below
//   6. remove or reassign safely         `separateStaff`, the single writer
//   7. update coverage and hiring needs  the roster recomputes; a vacancy opens
//   8. causes, memories, history, pressures, issues, reports  all emitted
//   9. resolve exactly once              the definition's `exactOnceKey`, plus a
//                                       live-event guard in `scheduleQuitRisk`

const StaffPayloadSchema = z.object({ staffId: z.string() })
const RaiseDemandPayloadSchema = z.object({
  staffId: z.string(),
  askedWage: z.number().min(0),
  wageAtRequest: z.number().min(0),
})
const LoyaltyMemoryPayloadSchema = z.object({
  staffId: z.string(),
  kind: z.enum([
    'backing_remembered',
    'publicly_backed',
    'betrayal_remembered',
    'emotional_debt',
  ]),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

/** Pull the subject out of a `<prefix><staffId>` hook name. */
function staffIdFromHookName(
  hookName: string,
  prefix: string,
): string | undefined {
  if (!hookName.startsWith(prefix)) return undefined
  const id = hookName.slice(prefix.length)
  return id.length > 0 ? id : undefined
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}

function staffPayloadAdapter(prefix: string) {
  return ({ hookName }: { hookName: string }) => {
    const staffId = staffIdFromHookName(hookName, prefix)
    if (!staffId) return undefined
    return {
      payload: { staffId },
      target: { kind: 'staff' as const, id: staffId },
    }
  }
}

function staffExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = StaffPayloadSchema.safeParse(payload)
  const staffId = parsed.success ? parsed.data.staffId : 'unknown'
  return `${type}:${staffId}:${scheduledForDay}`
}

/**
 * The subject, or the reason there is no subject.
 *
 * Every resolver below starts here, because "the staff member this was about has
 * already gone" is a legitimate and COMMON outcome — the player fired them, they
 * walked out first, or a different promise about the same person landed sooner —
 * and it must read as an explained no-op rather than a silent nothing.
 */
function resolveSubject(
  ctx: SimContext,
  payload: unknown,
  originReadable: string,
): { member: StaffState } | { fail: ScheduledEventResolution } {
  const parsed = StaffPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return { fail: noOp('event payload did not name a staff member', originReadable) }
  }
  const member = ctx.state.staff[parsed.data.staffId]
  if (!member) {
    return {
      fail: noOp(
        `'${parsed.data.staffId}' is no longer on the payroll`,
        originReadable,
      ),
    }
  }
  return { member }
}

// ---------------------------------------------------------------------------
// §3.4 item 2 — preventable contributors
// ---------------------------------------------------------------------------

export type QuitRiskContributor = {
  id: string
  /** What the player is told. */
  label: string
  /** How much of the risk this accounts for. */
  weight: number
  /** True when the player can still do something about it today. */
  preventable: boolean
  /** The specific thing that would help. */
  remedy?: string
}

/** Below this the risk has been answered; above the top one they walk out. */
export const QUIT_RISK_NO_OP_BELOW = 25
export const QUIT_RISK_DEFER_BELOW = 55
export const QUIT_RISK_WALKOUT_AT = 85
/** Days a deferred quit risk waits before being reassessed. */
export const QUIT_RISK_DEFER_DAYS = 5

/**
 * Why this person is thinking about leaving, itemised.
 *
 * Every row is read from a RECORD rather than from a mood: the arrears ledger,
 * the absence, the employment record's discipline rung, the owner relationship,
 * the coverage log, an unanswered request in memory. That is what makes item 2
 * ("identify preventable contributors") answerable — the player is told the
 * arrears figure and which action clears it, not that morale is low.
 */
export function describeQuitRiskContributors(
  state: TavernState,
  staffId: string,
): QuitRiskContributor[] {
  const member = state.staff[staffId]
  if (!member) return []
  const out: QuitRiskContributor[] = []

  const arrears = totalWageArrears(state, staffId)
  if (arrears > 0) {
    out.push({
      id: 'wage_arrears',
      label: `Owed ${arrears} coin in back pay.`,
      weight: Math.min(35, 10 + arrears * 2),
      preventable: true,
      remedy: 'Pay their back pay (Pay Staff Wages).',
    })
  } else if (!member.paidThisWeek) {
    out.push({
      id: 'unpaid_week',
      label: 'Went unpaid this week.',
      weight: 10,
      preventable: true,
      remedy: 'Pay their back pay (Pay Staff Wages).',
    })
  }

  if (member.fatigue >= 65) {
    out.push({
      id: 'exhausted',
      label: `Worn out (fatigue ${member.fatigue}).`,
      weight: Math.min(25, 10 + Math.round((member.fatigue - 65) / 2)),
      preventable: true,
      remedy: 'Put them on a rest shift, or grant them leave.',
    })
  }
  if (member.stress >= 65) {
    out.push({
      id: 'strained',
      label: `Under strain (stress ${member.stress}).`,
      weight: Math.min(20, 8 + Math.round((member.stress - 65) / 3)),
      preventable: true,
      remedy: 'Ease their load — cover the gap, or change their focus.',
    })
  }
  if (member.morale <= 25) {
    out.push({
      id: 'low_morale',
      label: `Miserable (morale ${member.morale}).`,
      weight: 15,
      preventable: true,
      remedy: 'A word, a rise, or a day off.',
    })
  }
  if (member.loyalty <= 25) {
    out.push({
      id: 'low_loyalty',
      label: `No attachment left (loyalty ${member.loyalty}).`,
      weight: 20,
      preventable: true,
      remedy: 'Talk them round (Negotiate With Staff).',
    })
  }

  const record = getEmployment(state, staffId)
  if (record && record.escalation >= 2) {
    out.push({
      id: 'disciplined',
      label: `Formally warned ${record.escalation} time(s).`,
      weight: 10,
      preventable: false,
    })
  }

  const trust = ownerTrust(state, staffId)
  if (trust <= 25) {
    out.push({
      id: 'no_trust',
      label: `Does not trust you (${trust}/100).`,
      weight: 12,
      preventable: true,
      remedy: 'Spend some time on them — training, a word, anything kept.',
    })
  }

  if (hasLiveMemory(state, `staff_raise_refused_${staffId}`)) {
    out.push({
      id: 'raise_refused',
      label: 'Asked for a rise and was refused.',
      weight: 20,
      preventable: true,
      remedy: 'Raise their wage (Adjust Staff Wage).',
    })
  }
  if (hasLiveMemory(state, `staff_asked_for_training_${staffId}`)) {
    out.push({
      id: 'training_ignored',
      label: 'Asked to be taught and nothing came of it.',
      weight: 8,
      preventable: true,
      remedy: 'Train them (Train Staff).',
    })
  }

  const gap = totalCoverageGap(getStaffModuleState(state).coverage)
  if (gap > 0) {
    out.push({
      id: 'short_handed',
      label: `Carrying a short-handed rota (${gap} of role demand uncovered).`,
      weight: Math.min(15, Math.round(gap * 8)),
      preventable: true,
      remedy: 'Hire, or cross-train somebody to cover.',
    })
  }

  return out.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
}

export function quitRiskScore(contributors: ReadonlyArray<QuitRiskContributor>): number {
  return contributors.reduce((sum, row) => sum + row.weight, 0)
}

function hasLiveMemory(state: TavernState, id: string): boolean {
  return state.memories.some(
    (memory) => memory.id === id && (memory.strength ?? 0) > 0,
  )
}

function memoryDay(state: TavernState, id: string): number | undefined {
  return state.memories.find((memory) => memory.id === id)?.createdAt?.absoluteDay
}

/** Somebody the player successfully talked round after this promise was made. */
function wasTalkedRound(
  state: TavernState,
  staffId: string,
  sinceDay: number,
): boolean {
  const day = memoryDay(state, `staff_talked_round_${staffId}`)
  return day !== undefined && day >= sinceDay
}

// ---------------------------------------------------------------------------
// staff_quit_risk
// ---------------------------------------------------------------------------

const quitRiskEvent: ScheduledEventDefinition = {
  type: STAFF_QUIT_RISK_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'Staff member may quit',
  payloadSchema: StaffPayloadSchema,
  // A resignation is a consequence OF the days since the warning, so it fires at
  // `wrap_up` with today's choices — the wage paid, the leave granted, the word
  // had — already counted.
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  warningWindowDays: 3,
  expiryDays: 7,
  // Resolve anyway rather than cancel, so a member who has already gone produces
  // an EXPLAINED no-op in the report instead of a silent withdrawal.
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['staff_quit_risk_'],
  fromFutureHook: staffPayloadAdapter('staff_quit_risk_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) {
      return subject.fail
    }
    const member = subject.member
    const today = ctx.state.calendar.totalDaysElapsed

    // Already leaving by another route: the promise is kept, just not twice.
    if (member.absence?.kind === 'notice_served') {
      return noOp(
        `${member.name.display} is already working out their notice`,
        `${member.name.display} was already on the way out.`,
      )
    }

    // §3.4 item 5, the NEGOTIATED branch. The player spent an action talking them
    // round after this promise was made, so the promise is withdrawn rather than
    // merely postponed — that is what makes the counterplay meaningful.
    if (wasTalkedRound(ctx.state, member.id, record.createdOnDay)) {
      bumpStaffTotal(ctx, 'quitRisksAverted')
      return {
        status: 'cancelled',
        reason: `${member.name.display} was talked round after the warning`,
        readable: `${member.name.display} is staying — you talked them round.`,
      }
    }

    const contributors = describeQuitRiskContributors(ctx.state, member.id)
    const score = quitRiskScore(contributors)

    // §3.4 item 5, the CANCEL branch: the reasons are gone.
    if (score < QUIT_RISK_NO_OP_BELOW) {
      bumpStaffTotal(ctx, 'quitRisksAverted')
      ctx.addCause({
        source: 'staff.quit_risk',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: 0,
        readable: `${member.name.display} thought about leaving and decided against it.`,
        tags: ['staff', 'quit_risk', 'averted', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      })
      return noOp(
        contributors.length === 0
          ? 'nothing was left to complain about'
          : `the worst of it was dealt with (remaining weight ${score})`,
        `${member.name.display} is staying — the worst of it was dealt with.`,
      )
    }

    // §3.4 item 5, the DEFER branch: some of it was answered, so the decision
    // moves rather than being made. Deferring is honest here — a half-answered
    // grievance is neither resolved nor a resignation.
    if (score < QUIT_RISK_DEFER_BELOW) {
      const worst = contributors[0]
      return {
        status: 'rescheduled',
        toDay: today + QUIT_RISK_DEFER_DAYS,
        reason: `partly addressed (weight ${score}); still ${worst?.label ?? 'unsettled'}`,
        readable: `${member.name.display} is giving it a few more days. ${worst?.remedy ?? ''}`.trim(),
      }
    }

    // §3.4 items 5–8, the SEPARATION branches.
    const mutations: ScheduledEventMutation[] = []
    const reasonList = contributors
      .slice(0, 3)
      .map((row) => row.label)
      .join(' ')

    if (score >= QUIT_RISK_WALKOUT_AT) {
      // No notice: they are finished with the place. No severance either — the
      // employee resigned without working it out.
      const result = separateStaff(ctx, {
        staffId: member.id,
        kind: 'resigned',
        reason: `quit risk realised (weight ${score}): ${reasonList}`,
        readable: `${member.name.display} walked out without notice.`,
        source: 'staff.quit_risk',
        // This event is mid-resolution and still live in the queue; the cleanup
        // must not archive it as cancelled while the resolver is about to archive
        // it as resolved.
        activeEventId: record.id,
      })
      if (!result) {
        return noOp('the separation could not be performed', record.origin.readable)
      }
      bumpStaffTotal(ctx, 'quitRisksHonoured')
      mutations.push({
        targetKind: 'staff',
        targetId: member.id,
        readable: `${result.staffName} is no longer employed.`,
      })
      return {
        status: 'resolved',
        mutations,
        readable: `${result.staffName} walked out. ${reasonList}`,
        cause: {
          source: 'staff.quit_risk',
          sourceType: 'staff',
          target: `staff:${member.id}`,
          targetType: 'staff',
          amount: -1,
          weight: 40,
          readable: `${result.staffName} walked out: ${reasonList}`,
          tags: ['staff', 'quit_risk', 'resigned', member.id],
          relatedActors: [{ kind: 'staff', id: member.id }],
          relatedSystems: ['staff'],
        },
        history: {
          category: 'state_change',
          summary: `${result.staffName} walked out without notice.`,
          tags: ['staff', 'quit_risk', 'resigned', member.id],
          relatedActors: [{ kind: 'staff', id: member.id }],
          relatedSystems: ['staff'],
          mechanicalRefs: [member.id, STAFF_QUIT_RISK_EVENT],
        },
        pressures: [
          {
            id: 'staff_loyalty_risk',
            change: 10,
            cause: {
              source: 'staff.quit_risk',
              sourceType: 'staff',
              target: 'pressure:staff_loyalty_risk',
              targetType: 'pressure',
              readable: `${result.staffName} walking out shook the crew.`,
              tags: ['staff', 'quit_risk', member.id],
              relatedSystems: ['staff'],
            },
          },
        ],
      }
    }

    // Notice, worked out. The player still has the notice window to change their
    // mind (`negotiate_with_staff` → `withdrawNotice`), which is the second
    // counterplay opportunity §3.4 asks for.
    const given = giveNotice(ctx, member.id, {
      givenBy: 'staff',
      reason: `quit risk realised (weight ${score}): ${reasonList}`,
    })
    if (!given) {
      return noOp(
        `${member.name.display} has already given notice`,
        `${member.name.display} was already leaving.`,
      )
    }
    bumpStaffTotal(ctx, 'quitRisksHonoured')
    mutations.push({
      targetKind: 'staff',
      targetId: member.id,
      field: 'absence',
      readable: `${member.name.display} is working out notice until day ${given.separationDay}.`,
    })
    mutations.push({
      targetKind: 'employment',
      targetId: given.record.id,
      field: 'notice',
      readable: `Notice given by ${member.name.display}.`,
    })
    return {
      status: 'resolved',
      mutations,
      readable: `${member.name.display} handed in their notice. ${reasonList}`,
      cause: {
        source: 'staff.quit_risk',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: -20,
        weight: 35,
        readable: `${member.name.display} gave notice: ${reasonList}`,
        tags: ['staff', 'quit_risk', 'notice', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
      memory: {
        id: `staff_gave_notice_${member.id}`,
        source: 'staff.quit_risk',
        actors: [{ kind: 'staff', id: member.id }],
        tags: ['staff', 'quit_risk', 'notice', member.id],
        metadata: { staffId: member.id, score, separationDay: given.separationDay },
      },
      history: {
        category: 'state_change',
        summary: `${member.name.display} gave notice.`,
        tags: ['staff', 'quit_risk', 'notice', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, STAFF_QUIT_RISK_EVENT],
      },
      pressures: [
        {
          id: 'staff_loyalty_risk',
          change: 6,
          cause: {
            source: 'staff.quit_risk',
            sourceType: 'staff',
            target: 'pressure:staff_loyalty_risk',
            targetType: 'pressure',
            readable: `${member.name.display} handing in notice unsettled the crew.`,
            tags: ['staff', 'quit_risk', member.id],
            relatedSystems: ['staff'],
          },
        },
      ],
    }
  },
}

/**
 * Put a quit risk on the calendar.
 *
 * Refuses when one is already live for the same person (§3.4 item 9 at the
 * scheduling end — the exact-once key covers the firing end). Two profiles that
 * both worry about the same cook must not produce two resignations.
 */
export function scheduleQuitRisk(
  ctx: SimContext,
  staffId: string,
  input: { reason: string; source: string; offsetDays?: number },
): boolean {
  const member = ctx.state.staff[staffId]
  if (!member) return false
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) =>
      event.type === STAFF_QUIT_RISK_EVENT &&
      event.target?.kind === 'staff' &&
      event.target.id === staffId,
  )
  if (alreadyLive) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type: STAFF_QUIT_RISK_EVENT,
    target: { kind: 'staff', id: staffId },
    scheduledForDay: today + (input.offsetDays ?? 7),
    payload: { staffId },
    origin: {
      source: input.source,
      readable: `${member.name.display} ${input.reason}.`,
    },
  })
  if (result.status === 'scheduled') bumpStaffTotal(ctx, 'quitRisksWarned')
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// staff_separation — the notice clock running out
// ---------------------------------------------------------------------------

const separationEvent: ScheduledEventDefinition = {
  type: STAFF_SEPARATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'Notice period ends',
  payloadSchema: StaffPayloadSchema,
  // Morning, so the player finds the empty chair on the day they have to work
  // around it rather than after the day is over.
  beat: 'morning',
  defaultOffsetDays: 3,
  warningWindowDays: 2,
  expiryDays: 3,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const member = subject.member
    const employment = getEmployment(ctx.state, member.id)

    // Notice withdrawn in the meantime: the player earned the no-op.
    if (!employment?.notice) {
      return noOp(
        `${member.name.display}'s notice was withdrawn`,
        `${member.name.display} stayed on after all.`,
      )
    }

    const byOwner = employment.notice.givenBy === 'owner'
    const result = separateStaff(ctx, {
      staffId: member.id,
      kind: 'notice_expired',
      reason: employment.notice.reason,
      readable: byOwner
        ? `${member.name.display} worked their last shift and left.`
        : `${member.name.display} finished their notice and left.`,
      // Notice served out in full: nothing further is owed for it.
      severance: 0,
      source: 'staff.separation_event',
      activeEventId: record.id,
    })
    if (!result) {
      return noOp('the separation could not be performed', record.origin.readable)
    }
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          readable: `${result.staffName} is no longer employed.`,
        },
      ],
      readable: `${result.staffName} has left the tavern.`,
      cause: {
        source: 'staff.separation_event',
        sourceType: 'staff',
        target: `staff:${member.id}`,
        targetType: 'staff',
        amount: -1,
        weight: 30,
        readable: `${result.staffName} left at the end of their notice.`,
        tags: ['staff', 'separation', 'notice_expired', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
      history: {
        category: 'state_change',
        summary: `${result.staffName} left at the end of their notice.`,
        tags: ['staff', 'separation', 'notice_expired', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, STAFF_SEPARATION_EVENT],
      },
    }
  },
}

export function scheduleSeparation(
  ctx: SimContext,
  staffId: string,
  separationDay: number,
  readable: string,
): boolean {
  const result = scheduleEvent(ctx, {
    type: STAFF_SEPARATION_EVENT,
    target: { kind: 'staff', id: staffId },
    scheduledForDay: separationDay,
    payload: { staffId },
    origin: { source: 'staff.notice', readable },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// staff_raise_demand — an ask with a deadline
// ---------------------------------------------------------------------------

const raiseDemandEvent: ScheduledEventDefinition = {
  type: STAFF_RAISE_DEMAND_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'Staff member is waiting on an answer about a rise',
  payloadSchema: RaiseDemandPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RaiseDemandPayloadSchema.safeParse(payload)
    const staffId = parsed.success ? parsed.data.staffId : 'unknown'
    return `${type}:${staffId}:${scheduledForDay}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RaiseDemandPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a raise request', record.origin.readable)
    }
    const member = ctx.state.staff[parsed.data.staffId]
    if (!member) {
      return noOp(
        `'${parsed.data.staffId}' is no longer on the payroll`,
        record.origin.readable,
      )
    }

    // Granted. The wage rose since the ask, so the request was answered — and
    // the loyalty for it was already paid by `setStaffWage`.
    if (member.wage >= parsed.data.askedWage) {
      noteContact(ctx, {
        aStaffId: member.id,
        withOwner: true,
        affinityDelta: 8,
        trustDelta: 10,
        reason: 'the rise came through',
        tags: ['wages', 'raise'],
      })
      return noOp(
        `${member.name.display}'s wage rose to ${member.wage} — the request was granted`,
        `${member.name.display} got the rise they asked for.`,
      )
    }

    // Part-granted counts for something, but not for everything.
    const moved = member.wage > parsed.data.wageAtRequest
    const loyaltyHit = moved ? -6 : -14
    const moraleHit = moved ? -4 : -10

    ctx.modifyStaff(
      member.id,
      {
        loyalty: clampPercent(member.loyalty + loyaltyHit),
        morale: clampPercent(member.morale + moraleHit),
      },
      {
        source: 'staff.raise_demand',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: loyaltyHit,
        readable: moved
          ? `${member.name.display} got less than they asked for and knows it.`
          : `${member.name.display} asked for a rise and got no answer.`,
        tags: ['staff', 'wages', 'raise', 'refused', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      affinityDelta: moved ? -4 : -10,
      trustDelta: moved ? -4 : -12,
      reason: 'the rise did not come',
      tags: ['wages', 'raise', 'refused'],
    })

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'loyalty',
          readable: `${member.name.display}'s loyalty fell ${Math.abs(loyaltyHit)}.`,
        },
      ],
      readable: moved
        ? `${member.name.display} was offered less than they asked for.`
        : `${member.name.display}'s request for a rise went unanswered.`,
      // The memory is what `describeQuitRiskContributors` reads, so a refused
      // rise is a NAMED contributor the player can still fix rather than an
      // invisible loyalty tax.
      memory: {
        id: `staff_raise_refused_${member.id}`,
        source: 'staff.raise_demand',
        actors: [{ kind: 'staff', id: member.id }],
        tags: ['staff', 'wages', 'raise', 'refused', member.id],
        durationDays: 21,
        metadata: {
          staffId: member.id,
          askedWage: parsed.data.askedWage,
          wage: member.wage,
        },
      },
      history: {
        category: 'state_change',
        summary: `${member.name.display} did not get the rise they asked for.`,
        tags: ['staff', 'wages', 'raise', 'refused', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, STAFF_RAISE_DEMAND_EVENT],
      },
    }
  },
}

export function scheduleRaiseDemand(
  ctx: SimContext,
  member: StaffState,
  askedWage: number,
): boolean {
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) =>
      event.type === STAFF_RAISE_DEMAND_EVENT &&
      event.target?.kind === 'staff' &&
      event.target.id === member.id,
  )
  if (alreadyLive) return false
  const result = scheduleEvent(ctx, {
    type: STAFF_RAISE_DEMAND_EVENT,
    target: { kind: 'staff', id: member.id },
    payload: {
      staffId: member.id,
      askedWage,
      wageAtRequest: member.wage,
    },
    origin: {
      source: 'staff.actors.request_raise',
      readable: `${member.name.display} has asked for ${askedWage} coin a week.`,
    },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// wage_expectation — "this is the new floor"
// ---------------------------------------------------------------------------

const wageExpectationEvent: ScheduledEventDefinition = {
  type: WAGE_EXPECTATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A bonus became the expected wage',
  payloadSchema: StaffPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 8,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['wage_expectation_'],
  fromFutureHook: staffPayloadAdapter('wage_expectation_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const member = subject.member

    // The promise was "what you paid once is what I now expect". Paid up and no
    // arrears means the expectation is being met.
    const arrears = totalWageArrears(ctx.state, member.id)
    if (arrears <= 0 && member.paidThisWeek) {
      return noOp(
        `${member.name.display} is being paid on time`,
        `${member.name.display} has no complaint about the money.`,
      )
    }

    const hit = arrears > 0 ? -10 : -5
    ctx.modifyStaff(
      member.id,
      {
        loyalty: clampPercent(member.loyalty + hit),
        morale: clampPercent(member.morale + hit),
      },
      {
        source: 'staff.wage_expectation',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: hit,
        readable: `${member.name.display} remembers being paid better than this.`,
        tags: ['staff', 'wages', 'expectation', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    // A dashed wage expectation is exactly the kind of grievance that becomes a
    // resignation, so it schedules the risk rather than merely noting it.
    scheduleQuitRisk(ctx, member.id, {
      reason: 'is being paid less than they were led to expect',
      source: 'staff.wage_expectation',
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'loyalty',
          readable: `${member.name.display}'s loyalty fell ${Math.abs(hit)}.`,
        },
      ],
      readable: `${member.name.display} noticed the money went back down.`,
      history: {
        category: 'state_change',
        summary: `${member.name.display}'s wage expectation went unmet.`,
        tags: ['staff', 'wages', 'expectation', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, WAGE_EXPECTATION_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// raise_promised — a promise measured against the wage on record
// ---------------------------------------------------------------------------

const raisePromisedEvent: ScheduledEventDefinition = {
  type: RAISE_PROMISED_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A promised rise comes due',
  payloadSchema: RaiseDemandPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 7,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RaiseDemandPayloadSchema.safeParse(payload)
    const staffId = parsed.success ? parsed.data.staffId : 'unknown'
    return `${type}:${staffId}:${scheduledForDay}`
  },
  futureHookPrefixes: ['raise_promised_'],
  // The hook name carries only the subject, so the owner supplies the terms: the
  // promise is measured against the wage AT THE MOMENT IT WAS MADE, which is the
  // only reading under which "did the rise happen?" has an answer.
  fromFutureHook: ({ hookName }) => {
    const staffId = staffIdFromHookName(hookName, 'raise_promised_')
    if (!staffId) return undefined
    return {
      payload: { staffId, askedWage: 0, wageAtRequest: 0 },
      target: { kind: 'staff' as const, id: staffId },
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RaiseDemandPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a promised rise', record.origin.readable)
    }
    const member = ctx.state.staff[parsed.data.staffId]
    if (!member) {
      return noOp(
        `'${parsed.data.staffId}' is no longer on the payroll`,
        record.origin.readable,
      )
    }
    // WAS THE PROMISE KEPT? Two readings, and the second is the one a
    // hook-routed promise needs.
    //
    // A promise scheduled with terms (`wageAtRequest > 0`) is judged against
    // those terms. A promise routed from a bare `raise_promised_<staffId>` hook
    // carries none, and the obvious fallback — compare the wage now against the
    // wage on the employment record — is circular: granting the rise is what
    // moves that figure, so a kept promise would always read as broken. So the
    // fallback asks whether a rise HAPPENED since the promise was made, which is
    // what `lastRaiseOnDay` records.
    const employment = getEmployment(ctx.state, member.id)
    const hasTerms = parsed.data.wageAtRequest > 0
    const baseline = hasTerms ? parsed.data.wageAtRequest : member.wage
    const raisedSincePromise =
      employment?.lastRaiseOnDay !== undefined &&
      employment.lastRaiseOnDay >= record.createdOnDay

    if (hasTerms ? member.wage > baseline : raisedSincePromise) {
      noteContact(ctx, {
        aStaffId: member.id,
        withOwner: true,
        affinityDelta: 10,
        trustDelta: 12,
        reason: 'kept a promise about money',
        tags: ['wages', 'promise', 'kept'],
      })
      return noOp(
        hasTerms
          ? `${member.name.display}'s wage rose from ${baseline} to ${member.wage} — the promise was kept`
          : `${member.name.display}'s wage rose on day ${employment?.lastRaiseOnDay} — the promise was kept`,
        `${member.name.display} got the rise you promised.`,
      )
    }

    ctx.modifyStaff(
      member.id,
      {
        loyalty: clampPercent(member.loyalty - 16),
        morale: clampPercent(member.morale - 10),
      },
      {
        source: 'staff.raise_promised',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: -16,
        readable: `${member.name.display} was promised a rise that never came.`,
        tags: ['staff', 'wages', 'promise', 'broken', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      affinityDelta: -14,
      trustDelta: -18,
      reason: 'broke a promise about money',
      tags: ['wages', 'promise', 'broken'],
    })
    scheduleQuitRisk(ctx, member.id, {
      reason: 'was promised a rise that never came',
      source: 'staff.raise_promised',
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'loyalty',
          readable: `${member.name.display}'s loyalty fell 16.`,
        },
      ],
      readable: `${member.name.display} was promised a rise that never came.`,
      memory: {
        id: `staff_raise_refused_${member.id}`,
        source: 'staff.raise_promised',
        actors: [{ kind: 'staff', id: member.id }],
        tags: ['staff', 'wages', 'raise', 'refused', 'promise', member.id],
        durationDays: 28,
        metadata: { staffId: member.id, baseline, wage: member.wage },
      },
      history: {
        category: 'state_change',
        summary: `A promised rise for ${member.name.display} never arrived.`,
        tags: ['staff', 'wages', 'promise', 'broken', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, RAISE_PROMISED_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// coverage_gap — "the hole will still be there when they get back"
// ---------------------------------------------------------------------------

const coverageGapEvent: ScheduledEventDefinition = {
  type: COVERAGE_GAP_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A coverage gap resurfaces',
  payloadSchema: StaffPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 7,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['coverage_gap_'],
  fromFutureHook: staffPayloadAdapter('coverage_gap_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const member = subject.member
    const roleId = member.role

    // The gap this promise was about: is that role covered TODAY?
    const held = Object.values(ctx.state.staff).filter(
      (other) =>
        other.role === roleId && !other.absence && other.shift !== 'rest',
    ).length
    const demand = staffRegistry.has(roleId)
      ? (staffRegistry.get(roleId).dailyDemand ?? 0)
      : 0
    const crossCover = Object.values(ctx.state.staff).some(
      (other) =>
        other.role !== roleId &&
        !other.absence &&
        (other.crossTraining?.[roleId] ?? 0) >= 60,
    )

    if (held >= demand || crossCover) {
      return noOp(
        crossCover
          ? `somebody else is now trained to cover ${roleLabel(roleId)}`
          : `${roleLabel(roleId)} is covered (${held} of ${demand})`,
        `The hole in the ${roleLabel(roleId)} rota was filled in time.`,
      )
    }

    // Still short. The people who ARE in carry it, and the fatigue lands on them.
    const carrying = Object.values(ctx.state.staff)
      .filter((other) => !other.absence && other.shift !== 'rest')
      .sort((a, b) => a.id.localeCompare(b.id))
    if (carrying.length === 0) {
      return noOp(
        'nobody is in to carry the gap',
        'There was nobody in to carry the shortfall.',
      )
    }
    const mutations: ScheduledEventMutation[] = []
    for (const other of carrying) {
      const nextFatigue = clampPercent(other.fatigue + 5)
      const nextStress = clampPercent(other.stress + 4)
      if (nextFatigue === other.fatigue && nextStress === other.stress) continue
      ctx.modifyStaff(
        other.id,
        { fatigue: nextFatigue, stress: nextStress },
        {
          source: 'staff.coverage_gap',
          sourceType: 'staff',
          target: `staff:${other.id}.fatigue`,
          targetType: 'staff',
          amount: 5,
          readable: `${other.name.display} covered the missing ${roleLabel(roleId)} again.`,
          tags: ['staff', 'coverage', roleId, other.id],
          relatedActors: [{ kind: 'staff', id: other.id }],
          relatedSystems: ['staff'],
        },
      )
      mutations.push({
        targetKind: 'staff',
        targetId: other.id,
        field: 'fatigue',
        readable: `${other.name.display} fatigue +5 covering the gap.`,
      })
    }
    if (mutations.length === 0) {
      return noOp(
        'everybody carrying the gap is already at their limit',
        'The crew could not be any more worn out than they already are.',
      )
    }
    return {
      status: 'resolved',
      mutations,
      readable: `The ${roleLabel(roleId)} rota is still short, and the crew is carrying it.`,
      cause: {
        source: 'staff.coverage_gap',
        sourceType: 'staff',
        target: `staff:${carrying[0]!.id}.fatigue`,
        targetType: 'staff',
        amount: 5,
        readable: `Nobody was covering ${roleLabel(roleId)}, so everyone else did.`,
        tags: ['staff', 'coverage', roleId],
        relatedSystems: ['staff'],
      },
      history: {
        category: 'state_change',
        summary: `The ${roleLabel(roleId)} rota was still short.`,
        tags: ['staff', 'coverage', roleId],
        relatedSystems: ['staff'],
        mechanicalRefs: [roleId, COVERAGE_GAP_EVENT],
      },
      pressures: [
        {
          id: 'staff_burnout',
          change: 5,
          cause: {
            source: 'staff.coverage_gap',
            sourceType: 'staff',
            target: 'pressure:staff_burnout',
            targetType: 'pressure',
            readable: `Working short on ${roleLabel(roleId)} is wearing the crew down.`,
            tags: ['staff', 'coverage', roleId],
            relatedSystems: ['staff'],
          },
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// training_helper — the colleague who said they would show them
// ---------------------------------------------------------------------------

const trainingHelperEvent: ScheduledEventDefinition = {
  type: TRAINING_HELPER_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A colleague shows them the job',
  payloadSchema: StaffPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 6,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['training_helper_'],
  fromFutureHook: staffPayloadAdapter('training_helper_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    // THE SUBJECT IS THE MENTOR, not the apprentice.
    //
    // `training_helper_<staffId>` comes from a response profile that gives THAT
    // person the mentoring fatigue and the loyalty for taking it on, and names
    // the apprentice separately. Reading the subject as the learner and hunting
    // for somebody even better inverts the promise: the named mentor is normally
    // the strongest hand already, so the event either no-opped or taught the
    // wrong person.
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const helper = subject.member

    const learnerId = findTrainingLearner(ctx.state, helper.id)
    const learner = learnerId ? ctx.state.staff[learnerId] : undefined
    if (!learner) {
      return noOp(
        `nobody on the crew both gets on with ${helper.name.display} and has anything left to learn from them`,
        `${helper.name.display} had nobody to show anything to.`,
      )
    }
    if (helper.absence || learner.absence) {
      return noOp(
        'one of the two was not in',
        `${helper.name.display} and ${learner.name.display} were never both in.`,
      )
    }

    const before = learner.skill
    const { skillGained } = grantExperience(
      ctx,
      learner,
      35,
      `${helper.name.display} showing them the job`,
    )
    noteContact(ctx, {
      aStaffId: learner.id,
      bStaffId: helper.id,
      affinityDelta: 8,
      trustDelta: 5,
      reason: 'taught them the job',
      tags: ['training'],
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: learner.id,
          field: skillGained > 0 ? 'skill' : 'experience',
          readable:
            skillGained > 0
              ? `${learner.name.display} skill ${before} → ${before + skillGained}.`
              : `${learner.name.display} banked 35 experience.`,
        },
      ],
      readable: `${helper.name.display} showed ${learner.name.display} how it is done.`,
      history: {
        category: 'state_change',
        summary: `${helper.name.display} trained ${learner.name.display}.`,
        tags: ['staff', 'development', 'training', learner.id, helper.id],
        relatedActors: [
          { kind: 'staff', id: learner.id },
          { kind: 'staff', id: helper.id },
        ],
        relatedSystems: ['staff'],
        mechanicalRefs: [learner.id, TRAINING_HELPER_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// authority_test — the person you put in charge gets tested
// ---------------------------------------------------------------------------

const authorityTestEvent: ScheduledEventDefinition = {
  type: AUTHORITY_TEST_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'Delegated authority is tested',
  payloadSchema: StaffPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 3,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['authority_test_'],
  fromFutureHook: staffPayloadAdapter('authority_test_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const member = subject.member
    if (member.absence) {
      return noOp(
        `${member.name.display} was not in when it came to it`,
        `${member.name.display} was away when the moment came.`,
      )
    }

    // Whether they carry it is a fact about their state, not a roll: skill and
    // composure against the strain they are under. That is why the player can
    // influence the outcome by looking after them.
    const composure = member.skill + Math.round((member.morale - member.stress) / 2)
    const passed = composure >= 55
    const trust = ownerTrust(ctx.state, member.id)

    if (passed) {
      const before = member.skill
      grantExperience(ctx, member, 30, 'carrying the responsibility')
      ctx.modifyStaff(
        member.id,
        { loyalty: clampPercent(member.loyalty + 10) },
        {
          source: 'staff.authority_test',
          sourceType: 'staff',
          target: `staff:${member.id}.loyalty`,
          targetType: 'staff',
          amount: 10,
          readable: `${member.name.display} handled it, and knows you saw.`,
          tags: ['staff', 'authority', 'passed', member.id],
          relatedActors: [{ kind: 'staff', id: member.id }],
          relatedSystems: ['staff'],
        },
      )
      noteContact(ctx, {
        aStaffId: member.id,
        withOwner: true,
        affinityDelta: 10,
        trustDelta: 8,
        reason: 'carried the responsibility',
        tags: ['authority'],
      })
      return {
        status: 'resolved',
        mutations: [
          {
            targetKind: 'staff',
            targetId: member.id,
            field: 'loyalty',
            readable: `${member.name.display} loyalty +10 (skill was ${before}).`,
          },
        ],
        readable: `${member.name.display} was tested on the authority you gave them, and carried it.`,
        history: {
          category: 'state_change',
          summary: `${member.name.display} handled the responsibility you gave them.`,
          tags: ['staff', 'authority', 'passed', member.id],
          relatedActors: [{ kind: 'staff', id: member.id }],
          relatedSystems: ['staff'],
          mechanicalRefs: [member.id, AUTHORITY_TEST_EVENT],
        },
      }
    }

    ctx.modifyStaff(
      member.id,
      {
        stress: clampPercent(member.stress + 12),
        morale: clampPercent(member.morale - 8),
      },
      {
        source: 'staff.authority_test',
        sourceType: 'staff',
        target: `staff:${member.id}.stress`,
        targetType: 'staff',
        amount: 12,
        readable: `${member.name.display} was out of their depth with the authority you gave them.`,
        tags: ['staff', 'authority', 'failed', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    // Trust cuts both ways: the owner backed somebody who was not ready.
    if (trust > 0) {
      adjustEdge(ctx, ownerEdgeId(member.id), {
        affinityDelta: -4,
        trustDelta: -6,
        tags: ['authority', 'failed'],
      })
    }
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'stress',
          readable: `${member.name.display} stress +12.`,
        },
      ],
      readable: `${member.name.display} could not carry the authority you gave them.`,
      history: {
        category: 'state_change',
        summary: `${member.name.display} was out of their depth.`,
        tags: ['staff', 'authority', 'failed', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, AUTHORITY_TEST_EVENT],
      },
      pressures: [
        {
          id: 'staff_burnout',
          change: 4,
          cause: {
            source: 'staff.authority_test',
            sourceType: 'staff',
            target: 'pressure:staff_burnout',
            targetType: 'pressure',
            readable: `${member.name.display} is carrying more than they can.`,
            tags: ['staff', 'authority', member.id],
            relatedSystems: ['staff'],
          },
        },
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// staff_bonus_expected — "there'll be another one of those, won't there"
// ---------------------------------------------------------------------------

const staffBonusExpectedEvent: ScheduledEventDefinition = {
  type: STAFF_BONUS_EXPECTED_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A second bonus is expected',
  payloadSchema: StaffPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 30,
  warningWindowDays: 4,
  expiryDays: 10,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['staff_bonus_expected_'],
  fromFutureHook: staffPayloadAdapter('staff_bonus_expected_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const member = subject.member

    // Anything that actually put extra coin their way since the promise counts.
    // All of it is recorded, so this reads records rather than guessing — but it
    // has to read ALL the shapes those records come in.
    //
    // The obvious one was missing: `pay_staff_bonus`, the owner action a player
    // reaches for when told somebody is expecting another bonus, writes the
    // shared memory id `staff_bonus_paid_recently` and names the person in
    // `actors` / `metadata.staffId` rather than in the id. Matching only the
    // per-staff id meant the player could pay the bonus and still take the
    // morale penalty for not paying it.
    const lookedAfter = ctx.state.memories.some((memory) => {
      const day = memory.createdAt?.absoluteDay ?? -1
      if (day < record.createdOnDay) return false
      if (
        memory.id === `staff_promoted_${member.id}` ||
        memory.id === `staff_bonus_paid_${member.id}`
      ) {
        return memory.tags.includes(member.id)
      }
      if (memory.id !== 'staff_bonus_paid_recently') return false
      return (
        memory.actors?.some(
          (actor) => actor.kind === 'staff' && actor.id === member.id,
        ) === true ||
        (memory.metadata as { staffId?: string } | undefined)?.staffId ===
          member.id
      )
    })
    const owedNothing = totalWageArrears(ctx.state, member.id) <= 0

    if (lookedAfter && owedNothing) {
      return noOp(
        `${member.name.display} has been looked after since`,
        `${member.name.display} has had no cause to feel short-changed.`,
      )
    }

    const hit = owedNothing ? -5 : -12
    ctx.modifyStaff(
      member.id,
      { morale: clampPercent(member.morale + hit) },
      {
        source: 'staff.bonus_expected',
        sourceType: 'staff',
        target: `staff:${member.id}.morale`,
        targetType: 'staff',
        amount: hit,
        readable: `${member.name.display} was waiting for another bonus that never came.`,
        tags: ['staff', 'wages', 'bonus', 'expectation', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      affinityDelta: -5,
      trustDelta: -4,
      reason: 'the second bonus never came',
      tags: ['wages', 'bonus'],
    })
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'morale',
          readable: `${member.name.display} morale ${hit}.`,
        },
      ],
      readable: `${member.name.display} had got used to the extra coin.`,
      history: {
        category: 'state_change',
        summary: `${member.name.display} expected another bonus.`,
        tags: ['staff', 'wages', 'bonus', member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, STAFF_BONUS_EXPECTED_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// cross_staff_grumble — the colleague who got landed with it
// ---------------------------------------------------------------------------

const crossStaffGrumbleEvent: ScheduledEventDefinition = {
  type: CROSS_STAFF_GRUMBLE_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A colleague grumbles about the reassignment',
  payloadSchema: StaffPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 2,
  expiryDays: 7,
  missingTarget: 'resolve_anyway',
  exactOnceKey: staffExactOnceKey,
  futureHookPrefixes: ['cross_staff_grumble_'],
  fromFutureHook: staffPayloadAdapter('cross_staff_grumble_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const subject = resolveSubject(ctx, record.payload, record.origin.readable)
    if ('fail' in subject) return subject.fail
    const grumbler = subject.member

    // The grumble is ABOUT somebody: the colleague they actually work with most.
    // Before this phase there was no such record, which is exactly why this
    // family could not be honoured.
    const peer = listActiveEdgesFor(ctx.state, grumbler.id)
      .filter((edge) => edge.kind === 'coworker')
      .map((edge) => (edge.from.id === grumbler.id ? edge.to.id : edge.from.id))
      .map((id) => ctx.state.staff[id])
      .filter((other): other is StaffState => other !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id))[0]

    if (!peer) {
      return noOp(
        `${grumbler.name.display} works with nobody closely enough to fall out with`,
        `${grumbler.name.display} kept it to themselves.`,
      )
    }
    // Somebody who has since been looked after has nothing left to grumble about.
    if (grumbler.fatigue < 45 && grumbler.morale >= 45) {
      return noOp(
        `${grumbler.name.display} is in good enough shape to let it go`,
        `${grumbler.name.display} let it go.`,
      )
    }

    const edgeId = coworkerEdgeId(grumbler.id, peer.id)
    const moved = adjustEdge(ctx, edgeId, {
      affinityDelta: -18,
      trustDelta: -8,
      tags: ['grumble', 'reassignment'],
    })
    if (!moved) {
      return noOp(
        'the working relationship this was about no longer exists',
        `${grumbler.name.display} had nobody left to say it to.`,
      )
    }
    ctx.modifyStaff(
      grumbler.id,
      { stress: clampPercent(grumbler.stress + 6) },
      {
        source: 'staff.cross_staff_grumble',
        sourceType: 'staff',
        target: `staff:${grumbler.id}.stress`,
        targetType: 'staff',
        amount: 6,
        readable: `${grumbler.name.display} fell out with ${peer.name.display} over who does what.`,
        tags: ['staff', 'conflict', grumbler.id, peer.id],
        relatedActors: [
          { kind: 'staff', id: grumbler.id },
          { kind: 'staff', id: peer.id },
        ],
        relatedSystems: ['staff'],
      },
    )
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff_relationship',
          targetId: edgeId,
          field: 'affinity',
          readable: `${grumbler.name.display} and ${peer.name.display} are on worse terms (affinity ${moved.affinity}).`,
        },
      ],
      readable: `${grumbler.name.display} took it out on ${peer.name.display}.`,
      history: {
        category: 'state_change',
        summary: `${grumbler.name.display} and ${peer.name.display} fell out over the rota.`,
        tags: ['staff', 'conflict', grumbler.id, peer.id],
        relatedActors: [
          { kind: 'staff', id: grumbler.id },
          { kind: 'staff', id: peer.id },
        ],
        relatedSystems: ['staff'],
        mechanicalRefs: [edgeId, CROSS_STAFF_GRUMBLE_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// staff_loyalty_memory — four "they remember this" families, one resolver
// ---------------------------------------------------------------------------

const LOYALTY_MEMORY_PREFIXES: Record<
  string,
  z.infer<typeof LoyaltyMemoryPayloadSchema>['kind']
> = {
  staff_backing_remembered_: 'backing_remembered',
  staff_publicly_backed_: 'publicly_backed',
  staff_betrayal_remembered_: 'betrayal_remembered',
  staff_emotional_debt_: 'emotional_debt',
}

/**
 * §3.3 makes these four deliverable for the first time.
 *
 * All four say the same mechanical thing — "this staff member remembers how you
 * treated them, and it will matter" — and before this phase there was nothing for
 * it to matter TO. Now there is: the owner relationship edge, whose trust gates
 * raise requests and negotiation, and whose affinity decides who steps up when
 * somebody is ill. So the mutation is on a real record with real downstream
 * consumers, not a loyalty nudge with a nice sentence attached.
 *
 * One resolver claims all four prefixes because they differ only in sign and
 * magnitude. Four near-identical resolvers would be four places to fix the same
 * bug.
 */
const LOYALTY_MEMORY_EFFECTS: Record<
  z.infer<typeof LoyaltyMemoryPayloadSchema>['kind'],
  { affinity: number; trust: number; loyalty: number; readable: string }
> = {
  backing_remembered: {
    affinity: 12,
    trust: 14,
    loyalty: 8,
    readable: 'has not forgotten that you took their side',
  },
  publicly_backed: {
    affinity: 14,
    trust: 16,
    loyalty: 10,
    readable: 'has not forgotten that you defended them in front of the room',
  },
  betrayal_remembered: {
    affinity: -18,
    trust: -20,
    loyalty: -12,
    readable: 'has not forgotten being overruled in front of the room',
  },
  emotional_debt: {
    affinity: 8,
    trust: 6,
    loyalty: 4,
    readable: 'still owes you one for that private word',
  },
}

const staffLoyaltyMemoryEvent: ScheduledEventDefinition = {
  type: STAFF_LOYALTY_MEMORY_EVENT,
  kind: 'mechanical',
  ownerModuleId: STAFF_MODULE_ID,
  label: 'A staff member remembers how you treated them',
  payloadSchema: LoyaltyMemoryPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 0,
  expiryDays: 10,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = LoyaltyMemoryPayloadSchema.safeParse(payload)
    const staffId = parsed.success ? parsed.data.staffId : 'unknown'
    const kind = parsed.success ? parsed.data.kind : 'unknown'
    return `${type}:${kind}:${staffId}:${scheduledForDay}`
  },
  futureHookPrefixes: Object.keys(LOYALTY_MEMORY_PREFIXES),
  fromFutureHook: ({ hookName }) => {
    // Longest prefix first, so `staff_publicly_backed_` is never mistaken for a
    // shorter sibling.
    const prefixes = Object.keys(LOYALTY_MEMORY_PREFIXES).sort(
      (a, b) => b.length - a.length,
    )
    for (const prefix of prefixes) {
      const staffId = staffIdFromHookName(hookName, prefix)
      if (!staffId) continue
      return {
        payload: { staffId, kind: LOYALTY_MEMORY_PREFIXES[prefix]! },
        target: { kind: 'staff' as const, id: staffId },
      }
    }
    return undefined
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = LoyaltyMemoryPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a staff memory', record.origin.readable)
    }
    const member = ctx.state.staff[parsed.data.staffId]
    if (!member) {
      return noOp(
        `'${parsed.data.staffId}' is no longer on the payroll`,
        record.origin.readable,
      )
    }
    const effect = LOYALTY_MEMORY_EFFECTS[parsed.data.kind]

    // The three contact days are the point: this is a MEMORY becoming a standing
    // relationship, so it counts as repeated contact rather than a single brush.
    noteContact(ctx, {
      aStaffId: member.id,
      withOwner: true,
      affinityDelta: effect.affinity,
      trustDelta: effect.trust,
      contacts: 3,
      reason: effect.readable,
      tags: ['memory', parsed.data.kind],
    })
    const edge = getOwnerEdge(ctx.state, member.id)
    ctx.modifyStaff(
      member.id,
      { loyalty: clampPercent(member.loyalty + effect.loyalty) },
      {
        source: 'staff.loyalty_memory',
        sourceType: 'staff',
        target: `staff:${member.id}.loyalty`,
        targetType: 'staff',
        amount: effect.loyalty,
        readable: `${member.name.display} ${effect.readable}.`,
        tags: ['staff', 'memory', parsed.data.kind, member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
      },
    )
    // A remembered betrayal is a live grievance, so it earns a quit risk rather
    // than only a number.
    if (parsed.data.kind === 'betrayal_remembered') {
      scheduleQuitRisk(ctx, member.id, {
        reason: 'has not forgotten being overruled',
        source: 'staff.loyalty_memory',
      })
    }
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'staff_relationship',
          targetId: ownerEdgeId(member.id),
          field: 'trust',
          readable: `Your standing with ${member.name.display} is now ${edge?.trust ?? 50}/100.`,
        },
        {
          targetKind: 'staff',
          targetId: member.id,
          field: 'loyalty',
          readable: `${member.name.display} loyalty ${effect.loyalty >= 0 ? '+' : ''}${effect.loyalty}.`,
        },
      ],
      readable: `${member.name.display} ${effect.readable}.`,
      history: {
        category: 'state_change',
        summary: `${member.name.display} ${effect.readable}.`,
        tags: ['staff', 'memory', parsed.data.kind, member.id],
        relatedActors: [{ kind: 'staff', id: member.id }],
        relatedSystems: ['staff'],
        mechanicalRefs: [member.id, STAFF_LOYALTY_MEMORY_EVENT],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const STAFF_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  quitRiskEvent,
  separationEvent,
  raiseDemandEvent,
  wageExpectationEvent,
  raisePromisedEvent,
  coverageGapEvent,
  trainingHelperEvent,
  authorityTestEvent,
  staffBonusExpectedEvent,
  crossStaffGrumbleEvent,
  staffLoyaltyMemoryEvent,
]

let registered = false

/**
 * Register the staff module's mechanical event types.
 *
 * Idempotent and called at import, like every other `ensureRequired*` bootstrap,
 * because the response bridge has to find these types the first time a hook is
 * routed — which can happen before any staff code runs.
 */
export function ensureStaffScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of STAFF_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
  registered = true
}

ensureStaffScheduledEventsRegistered()

export const STAFF_SCHEDULED_EVENT_TYPES = STAFF_SCHEDULED_EVENTS.map(
  (definition) => definition.type,
)

export { severanceFor, effectiveNoticeDays, listWageArrears }

export {
  AUTHORITY_TEST_EVENT,
  COVERAGE_GAP_EVENT,
  CROSS_STAFF_GRUMBLE_EVENT,
  RAISE_PROMISED_EVENT,
  STAFF_BONUS_EXPECTED_EVENT,
  STAFF_LOYALTY_MEMORY_EVENT,
  STAFF_QUIT_RISK_EVENT,
  STAFF_RAISE_DEMAND_EVENT,
  STAFF_SEPARATION_EVENT,
  TRAINING_HELPER_EVENT,
  WAGE_EXPECTATION_EVENT,
}
