import type { SimContext } from '../../core/context'
import type { StaffState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { staffRegistry } from '../../registries/staffRegistry'
import { spendCoin } from '../stock/ledger'
import {
  transitionContract,
  type EmploymentRecord,
} from '../../contracts/obligations/index'
import {
  cancelScheduledEvents,
  scheduleEvent,
} from '../../contracts/scheduledEvents/index'

import {
  bumpStaffTotal,
  getEmployment,
  getStaffModuleState,
  recordSeparation,
  upsertEmployment,
  writeStaffSlice,
  STAFF_MODULE_ID,
} from './workforceState'
import {
  DEFAULT_SHIFT,
  deriveCareerGoal,
  withWorkforceDefaults,
} from './workforceDefaults'
import {
  DEFAULT_NOTICE_DAYS,
  MAX_DISCIPLINE_ESCALATION,
  PROBATION_DAYS,
  PROBATION_NOTICE_DAYS,
  createEmploymentRecord,
  dailyRate,
  employmentId,
} from './employmentRecord'
import { STAFF_SEPARATION_EVENT } from './staffEventTypes'
import { openVacancy } from './laborMarket'
import { dropEdgesFor, listActiveEdgesFor } from './relationships'
import type { StaffSeparationEntry } from './workforceTypes'

// Expansion Phase 3 §3.1 / §3.4 — the employment lifecycle, and the only place
// a staff member is removed from the tavern.
//
// ONE WRITER. Everything that changes someone's terms or ends their employment
// goes through this file: the owner actions, the autonomous staff actor, the
// quit-risk resolver, and the notice-expiry event all *request* a transition
// here rather than editing `state.staff` themselves. That is §5.4 applied to
// the transition the phase is really about — a separation performed in two
// places is a separation that forgets to do half of it in one of them, and the
// half that gets forgotten is always the cleanup.
//
// WHAT A SAFE SEPARATION ACTUALLY INVOLVES (§3.4 items 6–8). It is not
// `delete state.staff[id]`. In one pass it has to: pay or record severance,
// close the employment record into the archive, drop the person's social edges,
// drop their autonomous-actor record, withdraw every scheduled event that was
// about them, open a vacancy so hiring is reachable again, tell the people who
// worked with them, and leave a cause, a memory, a history entry and a pressure
// behind. Anything less leaves the run pointing at somebody who is not there.
//
// FOUNDING STAFF ARE NO LONGER IMMUNE. `startDayHook` used to throw when
// `cook`, `server` or `cleaner_bouncer` was missing, so the game's central
// staff promise — that people leave when you treat them badly — was
// structurally impossible for the only three people it could have been about.
// That check is gone. A missing role is now a COVERAGE GAP with a cost
// (`roster.ts`), which is the honest version of the same constraint: the tavern
// keeps running, badly, until the player hires someone.

/** Morale each remaining staff member loses when a colleague leaves. */
const SEPARATION_WITNESS_MORALE = 4
/** Extra morale lost by someone who actually got on with the departed. */
const SEPARATION_FRIEND_MORALE = 6

export const EMPLOYMENT_SOURCE = `${STAFF_MODULE_ID}.employment`

// ---------------------------------------------------------------------------
// Opening and reading terms
// ---------------------------------------------------------------------------

/**
 * Belt-and-braces: give every staff member on state an employment record.
 *
 * `ensureStaffWorkforceFields` does this on the load path, which is where §5.7
 * requires it. This is the runtime equivalent, for a state built by a factory
 * or a test that never went through a save — the same pattern
 * `ensureRequiredStaffRolesRegistered` uses for the registry.
 */
export function ensureEmploymentRecords(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getStaffModuleState(ctx.state)
  const missing = Object.values(ctx.state.staff).filter(
    (member) => !slice.employment[member.id],
  )
  const stale = Object.keys(slice.employment).filter(
    (staffId) => !ctx.state.staff[staffId],
  )
  if (missing.length === 0 && stale.length === 0) return

  writeStaffSlice(
    ctx,
    (current) => {
      const employment = { ...current.employment }
      for (const staffId of stale) delete employment[staffId]
      for (const member of missing) {
        employment[member.id] = createEmploymentRecord({
          staffId: member.id,
          staffName: member.name.display,
          roleId: member.role,
          weeklyWage: member.wage,
          onDay: today - (member.daysEmployed ?? 0),
          reason: 'employment_recorded',
        })
      }
      return { ...current, employment }
    },
    'ensure_employment',
  )
}

/** Fill the workforce fields on any staff member missing them. */
export function ensureWorkforceFieldsOnState(ctx: SimContext): void {
  for (const member of Object.values(ctx.state.staff)) {
    const filled = withWorkforceDefaults(member)
    if (filled === member) continue
    ctx.modifyStaff(
      member.id,
      {
        shift: filled.shift ?? DEFAULT_SHIFT,
        experience: filled.experience ?? 0,
        crossTraining: filled.crossTraining ?? {},
        careerGoal:
          filled.careerGoal ?? deriveCareerGoal(member.identity, member.role),
        daysEmployed: filled.daysEmployed ?? 0,
        consecutiveDaysWorked: filled.consecutiveDaysWorked ?? 0,
      },
      { source: EMPLOYMENT_SOURCE, reason: 'workforce_fields_defaulted' },
    )
  }
}

export function isOnProbation(
  member: StaffState,
  record: EmploymentRecord | undefined,
  today: number,
): boolean {
  if (!record) return false
  return today - record.openedOnDay < PROBATION_DAYS
}

/** Notice this member is actually owed today — one day while on probation. */
export function effectiveNoticeDays(
  member: StaffState,
  record: EmploymentRecord | undefined,
  today: number,
): number {
  if (!record) return DEFAULT_NOTICE_DAYS
  return isOnProbation(member, record, today)
    ? PROBATION_NOTICE_DAYS
    : record.noticeDays
}

/** Severance owed if the owner dismisses this member today without notice. */
export function severanceFor(
  member: StaffState,
  record: EmploymentRecord | undefined,
  today: number,
): number {
  const days = effectiveNoticeDays(member, record, today)
  return Math.max(0, Math.round(days * dailyRate(member.wage)))
}

// ---------------------------------------------------------------------------
// Terms changes
// ---------------------------------------------------------------------------

/**
 * The only writer of a staff wage.
 *
 * Writes `StaffState.wage` and the employment record's derived daily rate in
 * one call, records the development entry the report reads, and moves loyalty
 * and morale in the direction the change deserves — a raise the player chose to
 * give is worth more loyalty than one they were forced into, which is why
 * `kind` is a parameter rather than the sign of the delta.
 */
export function setStaffWage(
  ctx: SimContext,
  staffId: string,
  nextWage: number,
  input: { kind: 'raise' | 'wage_cut' | 'promotion'; reason: string },
): { before: number; after: number } | undefined {
  const member = ctx.state.staff[staffId]
  if (!member) return undefined
  const before = member.wage
  const after = Math.max(0, Math.round(nextWage))
  if (after === before && input.kind !== 'promotion') return undefined

  const delta = after - before
  const loyaltyMove =
    input.kind === 'wage_cut' ? -12 : input.kind === 'promotion' ? 12 : 8
  const moraleMove =
    input.kind === 'wage_cut' ? -10 : input.kind === 'promotion' ? 10 : 6

  ctx.modifyStaff(
    staffId,
    {
      wage: after,
      loyalty: clampPercent(member.loyalty + loyaltyMove),
      morale: clampPercent(member.morale + moraleMove),
    },
    {
      source: `${EMPLOYMENT_SOURCE}.${input.kind}`,
      sourceType: 'staff',
      target: `staff:${staffId}.wage`,
      targetType: 'staff',
      amount: delta,
      readable: `${member.name.display}'s wage ${before} → ${after} (${input.reason}).`,
      tags: ['staff', 'employment', input.kind, staffId],
      relatedActors: [{ kind: 'staff', id: staffId }],
      relatedSystems: ['staff'],
    },
  )

  const record = getEmployment(ctx.state, staffId)
  if (record) {
    const today = ctx.state.calendar.totalDaysElapsed
    upsertEmployment(
      ctx,
      {
        ...record,
        wagePerDay: dailyRate(after),
        lastTransitionOnDay: today,
        // Stamp the DAY the wage went up, not the level it went up to. A promise
        // about a rise is judged against when it was made, and `wagePerDay` moves
        // with the rise itself — so comparing levels would report every kept
        // promise as broken.
        ...(delta > 0 ? { lastRaiseOnDay: today } : {}),
        readable: `${member.name.display} is employed at ${after} coin a week.`,
      },
      `wage_${input.kind}`,
    )
  }

  recordDevelopment(ctx, {
    staffId,
    kind: input.kind === 'promotion' ? 'promotion' : input.kind,
    before,
    after,
    readable: `${member.name.display}'s wage ${before} → ${after} — ${input.reason}.`,
  })
  if (input.kind === 'raise') bumpStaffTotal(ctx, 'raises')

  return { before, after }
}

/**
 * A formal warning. Climbs the shared escalation ladder.
 *
 * Discipline is not a morale tax with extra words: the rung it sets is read by
 * the dismissal path (a dismissal at the top rung costs the owner no standing
 * with the rest of the crew, an arbitrary one does) and by the quit-risk
 * resolver (a warned employee whose complaint was never addressed is more
 * likely to walk, not less).
 */
export function disciplineStaff(
  ctx: SimContext,
  staffId: string,
  reason: string,
): EmploymentRecord | undefined {
  const member = ctx.state.staff[staffId]
  const record = getEmployment(ctx.state, staffId)
  if (!member || !record) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const next: EmploymentRecord = {
    ...record,
    escalation: Math.min(MAX_DISCIPLINE_ESCALATION, record.escalation + 1),
    lastTransitionOnDay: today,
    history: [
      ...record.history.slice(-20),
      { onDay: today, from: record.status, to: record.status, reason: `discipline: ${reason}` },
    ],
  }
  upsertEmployment(ctx, next, 'discipline')

  ctx.modifyStaff(
    staffId,
    {
      morale: clampPercent(member.morale - 6),
      stress: clampPercent(member.stress + 5),
      loyalty: clampPercent(member.loyalty - 4),
    },
    {
      source: `${EMPLOYMENT_SOURCE}.discipline`,
      sourceType: 'staff',
      target: `staff:${staffId}.morale`,
      targetType: 'staff',
      amount: -6,
      readable: `${member.name.display} was formally warned (${reason}).`,
      tags: ['staff', 'discipline', staffId],
      relatedActors: [{ kind: 'staff', id: staffId }],
      relatedSystems: ['staff'],
    },
  )
  recordDevelopment(ctx, {
    staffId,
    kind: 'discipline',
    before: record.escalation,
    after: next.escalation,
    readable: `${member.name.display} received warning ${next.escalation} of ${MAX_DISCIPLINE_ESCALATION} — ${reason}.`,
  })
  return next
}

/**
 * Days of unexcused absence remembered when judging whether somebody has
 * stopped turning up. Long enough to span several call-ins on the actor's
 * seven-day cooldown; short enough that a bad month a season ago is forgotten.
 */
export const UNEXCUSED_MEMORY_DAYS = 21

/**
 * Record that somebody did not come in, and say what their run of it stands at.
 *
 * WHY A RUNNING TOTAL EXISTS. Abandonment was written against ONE absence's
 * length: four consecutive days out and the job is gone. Nothing in the game
 * produces a four-day unexcused absence — the only writer is the actor's
 * `call_in_sick`, which takes a single day and then waits a week — so the rule
 * fired never, and the crew could no-show indefinitely at no risk. Counting the
 * days across a remembered window makes "stopped turning up" mean what it says:
 * four days of no-shows inside three weeks ends the employment, however they
 * are spread.
 *
 * The window is enforced at write time: an absence more than
 * `UNEXCUSED_MEMORY_DAYS` after the last one starts the count again, so the
 * record never accumulates forever (§5.11).
 */
export function recordUnexcusedAbsence(
  ctx: SimContext,
  staffId: string,
  days: number,
): number {
  const record = getEmployment(ctx.state, staffId)
  if (!record) return 0
  const today = ctx.state.calendar.totalDaysElapsed
  const last = record.lastUnexcusedOnDay
  const carried =
    last !== undefined && today - last <= UNEXCUSED_MEMORY_DAYS
      ? (record.unexcusedDays ?? 0)
      : 0
  const total = carried + Math.max(1, days)
  upsertEmployment(
    ctx,
    {
      ...record,
      unexcusedDays: total,
      lastUnexcusedOnDay: today,
      lastTransitionOnDay: today,
    },
    'unexcused_absence',
  )
  return total
}

/** How many unexcused days this person has run up inside the remembered window. */
export function unexcusedRun(
  state: { modules: Record<string, unknown>; calendar: { totalDaysElapsed: number } },
  staffId: string,
): number {
  const record = getEmployment(state as never, staffId)
  if (!record?.lastUnexcusedOnDay) return 0
  const elapsed = state.calendar.totalDaysElapsed - record.lastUnexcusedOnDay
  if (elapsed > UNEXCUSED_MEMORY_DAYS) return 0
  return record.unexcusedDays ?? 0
}

// ---------------------------------------------------------------------------
// Notice
// ---------------------------------------------------------------------------

/**
 * Serve notice, from either side.
 *
 * Notice is a real clock rather than a label: the record carries who gave it
 * and when, the member goes on `notice_served` absence for its duration (they
 * are on the books and off the floor, which is what makes the coverage cost
 * land while the notice runs), and a `staff_separation` event is scheduled for
 * the day it expires. The owner can still change their mind
 * (`withdrawNotice`) — that is the counterplay half of §3.4 for a resignation
 * the player wants to reverse.
 */
export function giveNotice(
  ctx: SimContext,
  staffId: string,
  input: { givenBy: 'owner' | 'staff'; reason: string; noticeDays?: number },
): { record: EmploymentRecord; separationDay: number } | undefined {
  const member = ctx.state.staff[staffId]
  const record = getEmployment(ctx.state, staffId)
  if (!member || !record) return undefined
  if (record.notice) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const days = Math.max(
    0,
    input.noticeDays ?? effectiveNoticeDays(member, record, today),
  )
  const separationDay = today + days

  const next: EmploymentRecord = {
    ...record,
    status: 'grace',
    dueOnDay: separationDay,
    lastTransitionOnDay: today,
    notice: { givenBy: input.givenBy, givenOnDay: today, reason: input.reason },
    history: [
      ...record.history.slice(-20),
      {
        onDay: today,
        from: record.status,
        to: 'grace',
        reason: `notice_given_by_${input.givenBy}: ${input.reason}`,
      },
    ],
    readable:
      input.givenBy === 'owner'
        ? `${member.name.display} is working out ${days} days' notice.`
        : `${member.name.display} has given ${days} days' notice.`,
  }
  upsertEmployment(ctx, next, 'notice_given')

  // On the books, off the floor. Zero notice means they are gone today, so
  // there is nothing to mark them absent for.
  if (days > 0) {
    ctx.modifyStaff(
      staffId,
      {
        absence: {
          kind: 'notice_served',
          startedOnDay: today,
          untilDay: separationDay,
          reason: next.readable,
        },
      },
      {
        source: `${EMPLOYMENT_SOURCE}.notice`,
        sourceType: 'staff',
        target: `staff:${staffId}`,
        targetType: 'staff',
        amount: -1,
        readable: next.readable,
        tags: ['staff', 'notice', input.givenBy, staffId],
        relatedActors: [{ kind: 'staff', id: staffId }],
        relatedSystems: ['staff'],
      },
    )
  }

  // The notice clock is a scheduled event, not a field somebody remembers to
  // check: `staff_separation` fires on `separationDay` and performs the removal.
  // Scheduled directly through the shared contract rather than via a helper in
  // `staffEvents.ts`, so the lifecycle file and the resolver file do not import
  // each other — the event type id lives in the leaf `staffEventTypes.ts`.
  scheduleEvent(ctx, {
    type: STAFF_SEPARATION_EVENT,
    target: { kind: 'staff', id: staffId },
    scheduledForDay: separationDay,
    payload: { staffId },
    origin: { source: `${EMPLOYMENT_SOURCE}.notice`, readable: next.readable },
  })

  ctx.addHistory({
    category: 'state_change',
    summary: next.readable,
    tags: ['staff', 'notice', input.givenBy, staffId],
    relatedActors: [{ kind: 'staff', id: staffId }],
    relatedSystems: ['staff'],
    mechanicalRefs: [staffId, STAFF_SEPARATION_EVENT],
  })

  return { record: next, separationDay }
}

/**
 * Take notice back — the player talked them round, or changed their mind.
 *
 * Withdrawing cancels the scheduled separation and clears the absence, so the
 * promise made by the notice is undone rather than left to fire at an employee
 * who has already been talked into staying (§3.4 item 5, the "cancel" branch).
 */
export function withdrawNotice(
  ctx: SimContext,
  staffId: string,
  reason: string,
): EmploymentRecord | undefined {
  const member = ctx.state.staff[staffId]
  const record = getEmployment(ctx.state, staffId)
  if (!member || !record?.notice) return undefined
  const today = ctx.state.calendar.totalDaysElapsed

  const next: EmploymentRecord = {
    ...record,
    status: 'active',
    lastTransitionOnDay: today,
    history: [
      ...record.history.slice(-20),
      { onDay: today, from: record.status, to: 'active', reason: `notice_withdrawn: ${reason}` },
    ],
    readable: `${member.name.display} is employed at ${member.wage} coin a week.`,
  }
  delete next.notice
  delete next.dueOnDay
  upsertEmployment(ctx, next, 'notice_withdrawn')

  if (member.absence?.kind === 'notice_served') {
    ctx.modifyStaff(
      staffId,
      { absence: undefined, unavailable: false },
      {
        source: `${EMPLOYMENT_SOURCE}.notice_withdrawn`,
        sourceType: 'staff',
        target: `staff:${staffId}`,
        targetType: 'staff',
        amount: 1,
        readable: `${member.name.display} is back on the rota — ${reason}.`,
        tags: ['staff', 'notice', 'withdrawn', staffId],
        relatedActors: [{ kind: 'staff', id: staffId }],
        relatedSystems: ['staff'],
      },
    )
  }

  cancelScheduledEvents(
    ctx,
    (event) =>
      event.type === STAFF_SEPARATION_EVENT &&
      event.target?.kind === 'staff' &&
      event.target.id === staffId,
    `notice withdrawn: ${reason}`,
  )
  return next
}

// ---------------------------------------------------------------------------
// Separation
// ---------------------------------------------------------------------------

export type SeparationInput = {
  staffId: string
  kind: StaffSeparationEntry['kind']
  reason: string
  readable?: string
  /** Coin owed for notice not worked. Paid as far as the till allows. */
  severance?: number
  /** Who set this in motion. Shapes the witness reaction. */
  source?: string
  /**
   * The scheduled event performing this separation, when one is.
   *
   * It is still live in the queue while its own resolver runs, so the cleanup
   * below would archive it as `cancelled` and the shared resolver would then
   * archive the same firing again as `resolved` — two outcome rows and two
   * contradictory totals for one event. Naming it here excludes it from the
   * sweep without weakening the sweep for its siblings.
   */
  activeEventId?: string
}

export type SeparationResult = {
  staffId: string
  staffName: string
  roleId: string
  severancePaid: number
  severanceUnpaid: number
}

/**
 * End someone's employment, and leave the run consistent.
 *
 * The order below is load-bearing. Witnesses are told and severance is paid
 * BEFORE the record is removed, because both need the departing member's name,
 * role and relationships; the cleanup happens after, because every part of it
 * is about a person who is no longer there.
 */
export function separateStaff(
  ctx: SimContext,
  input: SeparationInput,
): SeparationResult | undefined {
  const member = ctx.state.staff[input.staffId]
  if (!member) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const record = getEmployment(ctx.state, input.staffId)
  const staffName = member.name.display
  const roleId = member.role
  const source = input.source ?? `${EMPLOYMENT_SOURCE}.separation`
  const readable =
    input.readable ??
    (input.kind === 'resigned'
      ? `${staffName} handed in their apron and walked out.`
      : input.kind === 'dismissed'
        ? `${staffName} was let go.`
        : input.kind === 'notice_expired'
          ? `${staffName} worked their last shift.`
          : `${staffName} stopped turning up.`)

  // ---- severance, as far as the till allows
  const owed = Math.max(0, Math.round(input.severance ?? 0))
  const severancePaid = Math.min(owed, ctx.state.coin)
  const severanceUnpaid = owed - severancePaid
  if (severancePaid > 0) {
    spendCoin(ctx, severancePaid, {
      source,
      category: 'wage',
      tags: ['staff', 'severance', roleId, input.staffId],
    })
  }

  // ---- the people who worked with them
  //
  // A dismissal at the top of the discipline ladder is DUE PROCESS, and the crew
  // reads it that way: everybody watched the warnings land. Charging the same
  // crew-wide morale hit for that as for an arbitrary firing made the ladder
  // mechanically pointless and taxed the player for following it. The
  // friend-specific reaction still lands either way — losing somebody you got on
  // with hurts however deserved it was.
  const wasFinalWarning =
    input.kind === 'dismissed' &&
    (record?.escalation ?? 0) >= MAX_DISCIPLINE_ESCALATION
  const friends = new Set(
    listActiveEdgesFor(ctx.state, input.staffId)
      .filter((edge) => edge.kind === 'coworker' && edge.affinity > 20)
      .map((edge) =>
        edge.from.id === input.staffId ? edge.to.id : edge.from.id,
      ),
  )
  for (const other of Object.values(ctx.state.staff)) {
    if (other.id === input.staffId) continue
    const witnessHit = wasFinalWarning ? 0 : SEPARATION_WITNESS_MORALE
    const hit = friends.has(other.id)
      ? witnessHit + SEPARATION_FRIEND_MORALE
      : witnessHit
    if (hit === 0) continue
    const nextMorale = clampPercent(other.morale - hit)
    if (nextMorale === other.morale) continue
    ctx.modifyStaff(
      other.id,
      { morale: nextMorale },
      {
        source: `${source}.witness`,
        sourceType: 'staff',
        target: `staff:${other.id}.morale`,
        targetType: 'staff',
        amount: -hit,
        readable: friends.has(other.id)
          ? `${other.name.display} lost a friend on the crew when ${staffName} left (morale -${hit}).`
          : `${other.name.display} watched ${staffName} go (morale -${hit}).`,
        tags: ['staff', 'morale', 'separation', 'witness', input.staffId],
        relatedActors: [
          { kind: 'staff', id: other.id },
          { kind: 'staff', id: input.staffId },
        ],
        relatedSystems: ['staff'],
      },
    )
  }

  // ---- close the employment record into the archive
  //
  // Through the SHARED transition (§1.2) rather than a local status write, so
  // an employment record that ended and a debt that was written off carry the
  // same kind of terminal entry with the same mandatory reason. `cancelled`
  // for a dismissal or a walk-out (the terms were withdrawn), `settled` for
  // notice actually served out (the terms ran their course).
  if (record) {
    upsertEmployment(
      ctx,
      transitionContract(
        record,
        input.kind === 'dismissed' || input.kind === 'abandoned'
          ? 'cancelled'
          : 'settled',
        today,
        `${input.kind}: ${input.reason}`,
        severancePaid > 0 ? severancePaid : undefined,
      ),
      'separation',
    )
  }

  // ---- remove the person
  ctx.removeStaff(input.staffId, {
    source,
    sourceType: 'staff',
    direction: 'decrease',
    amount: -1,
    readable,
    tags: ['staff', 'separation', input.kind, roleId, input.staffId],
    relatedActors: [{ kind: 'staff', id: input.staffId }],
    relatedSystems: ['staff'],
  })

  // ---- cleanup: nothing may still point at them
  dropEdgesFor(ctx, input.staffId, `${input.kind}: left the tavern`)
  writeStaffSlice(
    ctx,
    (current) => {
      const actors = { ...current.actors }
      delete actors[input.staffId]
      return {
        ...current,
        actors,
        roster: current.roster.filter((row) => row.staffId !== input.staffId),
      }
    },
    'separation_cleanup',
  )
  // Withdraw the events that were about THEM — and only those. Scoping to the
  // staff module's own events matters: their wage arrears carry an
  // `obligation_due` event targeting the same staff ref, and cancelling it would
  // freeze a debt the player still owes at `active` forever, never escalating.
  // A departed employee is still owed what they were owed (§1.2: "a debt outlives
  // the lender"), so the shared ledger keeps its clock.
  cancelScheduledEvents(
    ctx,
    (event) =>
      event.id !== input.activeEventId &&
      event.ownerModuleId === STAFF_MODULE_ID &&
      event.target?.kind === 'staff' &&
      event.target.id === input.staffId,
    `${staffName} has left the tavern`,
  )

  // ---- hiring is reachable again
  openVacancy(ctx, roleId, `${staffName} (${roleLabel(roleId)}) left: ${input.reason}`)

  // ---- the record of it
  const entry: StaffSeparationEntry = {
    staffId: input.staffId,
    staffName,
    roleId,
    kind: input.kind,
    onDay: today,
    severancePaid,
    reason: input.reason,
    readable:
      severanceUnpaid > 0
        ? `${readable} ${severanceUnpaid} coin of severance went unpaid.`
        : readable,
  }
  recordSeparation(ctx, entry)
  bumpStaffTotal(ctx, 'separated')
  if (input.kind === 'resigned' || input.kind === 'abandoned') {
    bumpStaffTotal(ctx, 'resigned')
  }
  if (input.kind === 'dismissed') bumpStaffTotal(ctx, 'dismissed')

  ctx.addMemory({
    id:
      input.kind === 'dismissed'
        ? 'staff_fired'
        : `staff_left_${input.staffId}`,
    source,
    actors: [{ kind: 'staff', id: input.staffId }],
    tags: ['staff', 'separation', input.kind, roleId, input.staffId],
    metadata: {
      staffId: input.staffId,
      staffName,
      roleId,
      kind: input.kind,
      severancePaid,
      severanceUnpaid,
    },
  })
  ctx.addHistory({
    category: 'state_change',
    summary: entry.readable,
    tags: ['staff', 'separation', input.kind, roleId, input.staffId],
    relatedActors: [{ kind: 'staff', id: input.staffId }],
    relatedSystems: ['staff'],
    mechanicalRefs: [input.staffId, roleId],
  })

  // A departure is a real staffing problem, so it moves the pressure the
  // player watches — but that is the REPORT of the change, not the change
  // itself: the authoritative mutation is the person being gone.
  ctx.modifyPressure('staff_loyalty_risk', input.kind === 'dismissed' ? 4 : 8, {
    source,
    sourceType: 'staff',
    target: 'pressure:staff_loyalty_risk',
    targetType: 'pressure',
    readable: `${staffName} left — the rest of the crew noticed.`,
    tags: ['staff', 'separation', input.kind, input.staffId],
    relatedSystems: ['staff'],
  })

  return {
    staffId: input.staffId,
    staffName,
    roleId,
    severancePaid,
    severanceUnpaid,
  }
}

function roleLabel(roleId: string): string {
  return staffRegistry.has(roleId) ? staffRegistry.get(roleId).label : roleId
}

// ---------------------------------------------------------------------------
// Development log
// ---------------------------------------------------------------------------

/** Append to the day's development log. Rebuilt each morning, so bounded. */
export function recordDevelopment(
  ctx: SimContext,
  entry: {
    staffId: string
    kind:
      | 'experience'
      | 'skill_growth'
      | 'cross_training'
      | 'promotion'
      | 'raise'
      | 'wage_cut'
      | 'discipline'
      | 'training'
    readable: string
    before?: number
    after?: number
    roleId?: string
  },
): void {
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      development: [
        ...current.development,
        {
          staffId: entry.staffId,
          kind: entry.kind,
          readable: entry.readable,
          ...(entry.before !== undefined ? { before: entry.before } : {}),
          ...(entry.after !== undefined ? { after: entry.after } : {}),
          ...(entry.roleId !== undefined ? { roleId: entry.roleId } : {}),
        },
      ],
    }),
    'development',
  )
}

export {
  DEFAULT_NOTICE_DAYS,
  MAX_DISCIPLINE_ESCALATION,
  PROBATION_DAYS,
  PROBATION_NOTICE_DAYS,
  STAFF_SEPARATION_EVENT,
  createEmploymentRecord,
  dailyRate,
  employmentId,
}
