import type { SimContext } from '../../core/context'
import type { SimRng } from '../../core/rng'
import type { StaffRoleId, StaffState } from '../../state/TavernState'
import {
  getRoleDailyDemand,
  staffRegistry,
  type StaffRoleDefinition,
} from '../../registries/staffRegistry'
import { createStaffIdentity } from '../../content/staff/staffIdentityFactory'
import { createStaffCastAttributes } from '../../content/cast/createCastAttributes'
import { getEconomyModuleState } from '../economy/state'

import {
  bumpStaffTotal,
  getStaffModuleState,
  writeStaffSlice,
} from './workforceState'
import {
  APPLICANT_SHELF_LIFE_DAYS,
  MAX_APPLICANTS,
  MAX_VACANCIES,
  type StaffApplicant,
} from './workforceTypes'
import { deriveCareerGoal } from './workforceDefaults'
import { createEmploymentRecord, dailyRate } from './employmentRecord'
import { noteContact } from './relationships'

// Expansion Phase 3 §3.1 — the labor market.
//
// WHY A ROSTER RATHER THAN A ROLE PICKER. Before this phase `hire_staff` took a
// ROLE id and minted a staff member at that role's registry defaults: hiring was
// a purchase at a fixed price with a fixed outcome, so "role demand", "hiring
// terms" and "replacement" had nowhere to live. An applicant board changes the
// shape of the decision without adding a second hiring path: the people on it
// are generated once, sit there for a bounded number of days, ask for the wage
// they think they are worth, and leave if nobody takes them. Whether a master
// chef is available this week is now a fact about the world instead of a
// question about the player's coin.
//
// DETERMINISM. Generation runs on the named `labor_market` stream, not on
// `ctx.rng`, so an extra service roll cannot change who is looking for work and
// an extra applicant cannot change a generated name (architecture rule 7).
// Names and cast attributes still come off `staff_identity`, in the same order
// `createInitialStaff` uses, so an applicant who is hired is indistinguishable
// from one created any other way.
//
// BOUNDED (§5.11). At most `MAX_APPLICANTS` on the board, each expiring after
// `APPLICANT_SHELF_LIFE_DAYS`; at most `MAX_VACANCIES` open postings, one per
// role. Refresh replaces the expired rather than appending.

/** Days between roster refreshes. A week, so the board is a weekly decision. */
export const MARKET_REFRESH_DAYS = 7

/** How many applicants a refresh aims to have on the board. */
const TARGET_APPLICANTS = 4

/** Wage multipliers by provenance. A referral comes cheap; a poached hand does not. */
const PROVENANCE_WAGE_FACTOR: Record<StaffApplicant['provenance'], number> = {
  walk_in: 1,
  referral: 0.9,
  poached: 1.25,
  apprentice: 0.75,
}

/** Skill offsets by provenance, applied to the role's opening skill. */
const PROVENANCE_SKILL_OFFSET: Record<StaffApplicant['provenance'], number> = {
  walk_in: 0,
  referral: 4,
  poached: 10,
  apprentice: -8,
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

/**
 * Record that the tavern is short of a role.
 *
 * A vacancy is what makes hiring reachable after a separation: the next refresh
 * guarantees at least one applicant for every open posting, so losing the cook
 * cannot leave the player staring at a board of bouncers. Idempotent per role.
 */
export function openVacancy(
  ctx: SimContext,
  roleId: StaffRoleId,
  reason: string,
): void {
  if (!staffRegistry.has(roleId)) return
  const today = ctx.state.calendar.totalDaysElapsed
  writeStaffSlice(
    ctx,
    (current) => {
      if (current.laborMarket.vacancies.some((v) => v.roleId === roleId)) {
        return current
      }
      const vacancies = [
        ...current.laborMarket.vacancies,
        { roleId, openedOnDay: today, reason },
      ].slice(-MAX_VACANCIES)
      return {
        ...current,
        laborMarket: { ...current.laborMarket, vacancies },
      }
    },
    'open_vacancy',
  )
}

export function closeVacancy(ctx: SimContext, roleId: StaffRoleId): void {
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      laborMarket: {
        ...current.laborMarket,
        vacancies: current.laborMarket.vacancies.filter(
          (v) => v.roleId !== roleId,
        ),
      },
    }),
    'close_vacancy',
  )
}

/**
 * §3.1 role demand — roles the day wants more bodies on than it has.
 *
 * Read from the registry's declared `dailyDemand` and the live roster, so it is
 * the same number the coverage pass reports rather than a second opinion.
 */
export function uncoveredRoles(state: {
  staff: Record<string, StaffState>
}): StaffRoleId[] {
  const held = new Map<string, number>()
  for (const member of Object.values(state.staff)) {
    held.set(member.role, (held.get(member.role) ?? 0) + 1)
  }
  const out: StaffRoleId[] = []
  for (const def of staffRegistry.all()) {
    const demand = getRoleDailyDemand(def.id)
    if (demand <= 0) continue
    if ((held.get(def.id) ?? 0) < demand) out.push(def.id)
  }
  return out.sort()
}

// ---------------------------------------------------------------------------
// Applicant generation
// ---------------------------------------------------------------------------

function pickProvenance(
  rng: SimRng,
  hasCrew: boolean,
): StaffApplicant['provenance'] {
  const roll = rng.float()
  if (hasCrew && roll < 0.2) return 'referral'
  if (roll < 0.35) return 'apprentice'
  if (roll < 0.5) return 'poached'
  return 'walk_in'
}

function clampSkill(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)))
}

/**
 * Generate one applicant.
 *
 * Roll order is fixed and documented because it is what makes generation
 * reproducible: provenance, then the skill jitter, then the wage jitter, then
 * the referrer — all on `labor_market` — and only then the identity rolls on
 * `staff_identity`. A later phase that adds a field must append to the end of
 * this sequence, exactly as Living Cast appended to `createInitialStaff`.
 */
export function generateApplicant(input: {
  def: StaffRoleDefinition
  marketRng: SimRng
  identityRng: SimRng
  today: number
  suffix: number
  existingNames: Set<string>
  crewIds: string[]
  wageDemandFactor?: number
  answersVacancyForRole?: StaffRoleId
}): StaffApplicant {
  const { def, marketRng, identityRng, today } = input
  const provenance = pickProvenance(marketRng, input.crewIds.length > 0)
  const skillJitter = Math.round((marketRng.float() - 0.5) * 16)
  const wageJitter = Math.round((marketRng.float() - 0.5) * 4)
  const referrer =
    provenance === 'referral' && input.crewIds.length > 0
      ? input.crewIds[Math.floor(marketRng.float() * input.crewIds.length)]
      : undefined

  const skill = clampSkill(
    def.defaultState.skill + PROVENANCE_SKILL_OFFSET[provenance] + skillJitter,
  )
  const wageAsk = Math.max(
    1,
    Math.round(
      (def.defaultState.wage * PROVENANCE_WAGE_FACTOR[provenance] + wageJitter) *
        (input.wageDemandFactor ?? 1),
    ),
  )

  const applicantId = `applicant_${def.id}_${today}_${input.suffix}`
  const { identity, generatedName } = createStaffIdentity({
    staffId: applicantId,
    roleId: def.id,
    rng: identityRng,
    existingNames: input.existingNames,
  })
  const castAttributes = createStaffCastAttributes({
    roleId: def.id,
    ...(identity.cultureId !== undefined ? { cultureId: identity.cultureId } : {}),
    rng: identityRng,
  })

  const provenanceNote =
    provenance === 'referral'
      ? 'came in on a word from the crew'
      : provenance === 'poached'
        ? 'is working elsewhere and open to offers'
        : provenance === 'apprentice'
          ? 'has barely started but is keen'
          : 'walked in looking for work'

  return {
    id: applicantId,
    name: generatedName,
    roleId: def.id,
    skill,
    wageAsk,
    identity,
    castAttributes,
    careerGoal: deriveCareerGoal(identity, def.id),
    provenance,
    ...(referrer !== undefined ? { referredByStaffId: referrer } : {}),
    ...(input.answersVacancyForRole !== undefined
      ? { answersVacancyForRole: input.answersVacancyForRole }
      : {}),
    postedOnDay: today,
    availableUntilDay: today + APPLICANT_SHELF_LIFE_DAYS,
    readable: `${generatedName.display} — ${def.label}, skill ${skill}, wants ${wageAsk}/wk; ${provenanceNote}.`,
  }
}

/**
 * Refresh the board: retire the expired, then top up.
 *
 * Every open vacancy is answered first, so a role the tavern actually needs is
 * always on the board — a labor market that could leave the player permanently
 * unable to replace a cook would be the same dead end the Phase 2 review found
 * with unbuyable materials.
 */
export function refreshLaborMarket(ctx: SimContext, force = false): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getStaffModuleState(ctx.state)
  const live = slice.laborMarket.applicants.filter(
    (a) => a.availableUntilDay >= today,
  )
  const expired = slice.laborMarket.applicants.length - live.length
  const due =
    force ||
    slice.laborMarket.lastRefreshedOnDay < 0 ||
    today - slice.laborMarket.lastRefreshedOnDay >= MARKET_REFRESH_DAYS

  const vacancies = slice.laborMarket.vacancies.map((v) => v.roleId)
  const needsVacancyCover = vacancies.filter(
    (roleId) => !live.some((a) => a.roleId === roleId),
  )

  if (!due && expired === 0 && needsVacancyCover.length === 0) return

  const marketRng = ctx.getRngStream('labor_market')
  const identityRng = ctx.getRngStream('staff_identity')
  const existingNames = new Set<string>([
    ...Object.values(ctx.state.staff).map((s) => s.name.display),
    ...live.map((a) => a.name.display),
  ])
  const crewIds = Object.keys(ctx.state.staff).sort()
  const wageDemandFactor = getEconomyModuleState(ctx.state).modifiers.wageDemandFactor

  // Hireable roles, in a stable order. `seedOnDayZero: false` roles are
  // hireable too — that is how a cook tier or a lead is brought in from
  // outside rather than promoted.
  const hireable = [...staffRegistry.all()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )

  const additions: StaffApplicant[] = []
  let suffix = slice.laborMarket.nextSuffix

  // 1. every open vacancy gets an answer.
  for (const roleId of needsVacancyCover) {
    if (!staffRegistry.has(roleId)) continue
    additions.push(
      generateApplicant({
        def: staffRegistry.get(roleId),
        marketRng,
        identityRng,
        today,
        suffix: suffix++,
        existingNames,
        crewIds,
        wageDemandFactor,
        answersVacancyForRole: roleId,
      }),
    )
    existingNames.add(additions[additions.length - 1]!.name.display)
  }

  // 2. top the board up towards the target, for whichever roles come up.
  if (due) {
    const want = Math.max(0, TARGET_APPLICANTS - live.length - additions.length)
    for (let i = 0; i < want; i += 1) {
      const def = hireable[Math.floor(marketRng.float() * hireable.length)]
      if (!def) continue
      additions.push(
        generateApplicant({
          def,
          marketRng,
          identityRng,
          today,
          suffix: suffix++,
          existingNames,
          crewIds,
          wageDemandFactor,
        }),
      )
      existingNames.add(additions[additions.length - 1]!.name.display)
    }
  }

  const nextSuffix = suffix
  const applicants = [...live, ...additions].slice(-MAX_APPLICANTS)

  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      laborMarket: {
        ...current.laborMarket,
        applicants,
        lastRefreshedOnDay: due ? today : current.laborMarket.lastRefreshedOnDay,
        nextSuffix,
      },
    }),
    'refresh_labor_market',
  )

  if (additions.length > 0) {
    ctx.addLog(
      {
        message: `${additions.length} new applicant(s) on the board.`,
        level: 'debug',
        data: { applicants: additions.map((a) => a.id) },
      },
      'staff',
    )
  }
}

export function getApplicant(
  state: { modules: Record<string, unknown> },
  applicantId: string,
): StaffApplicant | undefined {
  return getStaffModuleState(state).laborMarket.applicants.find(
    (a) => a.id === applicantId,
  )
}

export function listApplicants(state: {
  modules: Record<string, unknown>
}): StaffApplicant[] {
  return [...getStaffModuleState(state).laborMarket.applicants].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
}

// ---------------------------------------------------------------------------
// Hiring
// ---------------------------------------------------------------------------

export type HireResult = {
  staffId: string
  staffName: string
  roleId: StaffRoleId
  weeklyWage: number
  skill: number
}

/**
 * Take an applicant off the board and onto the payroll.
 *
 * The wage is the terms actually agreed — `wageOffer` when the player negotiated
 * one, the applicant's ask otherwise — and it is what the employment record and
 * the weekly settlement both read. An applicant offered less than they asked
 * starts with lower loyalty: the person remembers what they settled for.
 */
export function hireApplicant(
  ctx: SimContext,
  applicantId: string,
  input: { wageOffer?: number; source: string },
): HireResult | undefined {
  const applicant = getApplicant(ctx.state, applicantId)
  if (!applicant) return undefined
  if (!staffRegistry.has(applicant.roleId)) return undefined
  const def = staffRegistry.get(applicant.roleId)
  const today = ctx.state.calendar.totalDaysElapsed

  const weeklyWage = Math.max(1, Math.round(input.wageOffer ?? applicant.wageAsk))
  const shortfall = Math.max(0, applicant.wageAsk - weeklyWage)
  // Every coin below the ask costs three loyalty, capped so a lowball still
  // produces someone who turns up rather than someone who is already leaving.
  const loyaltyPenalty = Math.min(20, shortfall * 3)

  const staffId = mintStaffId(ctx, applicant.roleId, today)
  const member: StaffState = {
    ...def.defaultState,
    id: staffId,
    name: applicant.name,
    role: applicant.roleId,
    tags: [...def.defaultTags],
    activeFlags: [...def.defaultState.activeFlags],
    identity: applicant.identity,
    castAttributes: applicant.castAttributes,
    skill: applicant.skill,
    wage: weeklyWage,
    loyalty: Math.max(0, def.defaultState.loyalty - loyaltyPenalty),
    paidThisWeek: true,
    shift: 'early',
    experience: 0,
    crossTraining: {},
    careerGoal: applicant.careerGoal,
    daysEmployed: 0,
    consecutiveDaysWorked: 0,
  }

  ctx.addStaff(member, {
    source: input.source,
    sourceType: 'staff',
    direction: 'increase',
    amount: 1,
    readable: `Hired ${applicant.name.display} as ${def.label} at ${weeklyWage}/wk.`,
    tags: ['staff', 'hire', applicant.roleId, staffId],
    relatedActors: [{ kind: 'staff', id: staffId }],
    relatedSystems: ['staff'],
  })

  // Terms on the record from day one, with a probation window: notice is one
  // day and severance is nil until `PROBATION_DAYS` have passed, which is what
  // makes an early bad fit recoverable instead of expensive.
  writeStaffSlice(
    ctx,
    (current) => ({
      ...current,
      employment: {
        ...current.employment,
        [staffId]: createEmploymentRecord({
          staffId,
          staffName: applicant.name.display,
          roleId: applicant.roleId,
          weeklyWage,
          onDay: today,
          reason:
            shortfall > 0
              ? `hired below ask (${weeklyWage} vs ${applicant.wageAsk})`
              : 'hired at ask',
        }),
      },
      laborMarket: {
        ...current.laborMarket,
        applicants: current.laborMarket.applicants.filter(
          (a) => a.id !== applicantId,
        ),
        vacancies: current.laborMarket.vacancies.filter(
          (v) => v.roleId !== applicant.roleId,
        ),
      },
    }),
    'hire',
  )
  bumpStaffTotal(ctx, 'hired')

  // A referral arrives already knowing someone. That is a real edge from a real
  // event, which is exactly how §3.3 says relationships must start.
  if (applicant.referredByStaffId && ctx.state.staff[applicant.referredByStaffId]) {
    noteContact(ctx, {
      aStaffId: applicant.referredByStaffId,
      bStaffId: staffId,
      affinityDelta: 12,
      trustDelta: 6,
      reason: 'vouched for them',
      contacts: 3,
    })
  }

  ctx.addMemory({
    id: 'staff_hired',
    source: input.source,
    actors: [{ kind: 'staff', id: staffId }],
    tags: ['staff', 'hire', applicant.roleId, staffId],
    metadata: {
      staffId,
      staffName: applicant.name.display,
      roleId: applicant.roleId,
      weeklyWage,
      wageAsk: applicant.wageAsk,
      provenance: applicant.provenance,
    },
  })
  ctx.addHistory({
    category: 'owner_action',
    summary: `Hired ${applicant.name.display} as ${def.label} at ${weeklyWage} coin a week.`,
    tags: ['staff', 'hire', applicant.roleId, staffId],
    relatedActors: [{ kind: 'staff', id: staffId }],
    relatedSystems: ['staff'],
    mechanicalRefs: [staffId, applicant.roleId],
  })

  return {
    staffId,
    staffName: applicant.name.display,
    roleId: applicant.roleId,
    weeklyWage,
    skill: applicant.skill,
  }
}

function mintStaffId(ctx: SimContext, roleId: string, today: number): string {
  let counter = 0
  let candidate = `hire_${roleId}_${today}_${counter}`
  while (ctx.state.staff[candidate]) {
    counter += 1
    candidate = `hire_${roleId}_${today}_${counter}`
  }
  return candidate
}

export { dailyRate }
