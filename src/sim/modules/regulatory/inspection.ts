import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { getRule } from '../../contracts/ruleset/index'
import {
  getObligation,
  nextObligationId,
  openObligation,
  outstandingAmount,
  payObligation,
  recordObligationPayment,
  scheduleObligationDueDate,
  transitionContract,
  upsertObligation,
} from '../../contracts/obligations/index'
import { spendCoin } from '../stock/ledger'
import { ECONOMY_MODULE_ID } from '../economy/state'
import { getEconomyModuleState } from '../economy/state'
import type { EconomyModuleState } from '../economy/types'
import {
  beliefAgainstHouse,
  beliefEffect,
} from '../attribution/beliefInputs'

import { suspicionFromEvidence } from './evidence'
import {
  bumpRegulatoryTotals,
  getCase,
  getRegulatoryModuleState,
  listFindings,
  nextCaseId,
  nextFindingId,
  upsertCase,
  upsertFinding,
  watchRef,
  writeRecords,
  writeWatchStanding,
} from './state'
import {
  INSPECTION_DIMENSIONS,
  MAX_APPEALS_PER_CASE,
  MAX_FINDINGS_PER_CASE,
  MAX_OPEN_CASES,
  REGULATORY_MODULE_ID,
  WATCH_LABEL,
  evidenceWeight,
  liveEvidence,
  type InspectionDimension,
  type InspectionFinding,
  type InspectionOutcome,
  type TavernRegulatoryCase,
} from './types'

// Expansion Phase 7 §7.3 — the visit itself, and everything it produces.
//
// The ten steps §7.3 lists map onto this file one for one:
//
//   1-2 suspicion + warning thresholds   `shouldOpenCase`
//   3-5 scheduling, preparation window,
//       inspector identity               `openCase`
//   6   the visit beat                   `regulatoryEvents.REGULATORY_VISIT`
//   7   evaluation across seven          `evaluateVisit` / `evaluateDimension`
//       dimensions
//   8   the outcome ladder               `outcomeFor` + `applyOutcome`
//   9   appeal / compliance / bribery     `appealFinding`, `remediateFinding`,
//                                        `bribeInspector`
//   10  follow-up + closure              `verifyFinding`, `closeCase`
//
// Every dimension reads live state at the moment of the visit. That is
// §7.3's hard requirement — "the inspection must consume actual current
// state, not only the pressure meter" — and it is why a player who spends
// the preparation window actually cleaning passes, while a player who
// spends it watching the meter does not.

const SOURCE = REGULATORY_MODULE_ID

/** Fixed inspector identities. Content, not generated names (rule 8). */
const INSPECTORS: ReadonlyArray<{ id: string; name: string; temperament: string }> = [
  { id: 'inspector_grell', name: 'Warden Grell', temperament: 'thorough' },
  { id: 'inspector_mabb', name: 'Warden Mabb', temperament: 'impatient' },
  { id: 'inspector_dorn', name: 'Warden Dorn', temperament: 'bribeable' },
]

/** Evidence weight at which the watch opens a case. */
export const CASE_THRESHOLD = 55
/** How far the follow-up ladder climbs before the watch stops coming back. */
export const MAX_CASE_ESCALATIONS = 3
/** Evidence weight at which the watch turns up unannounced. */
const UNANNOUNCED_THRESHOLD = 95

/** The faction whose opinion the inspector carries into a visit. */
const WATCH_FACTION_ID = 'town_watch'
/** The most that opinion may harden a grade. */
export const MAX_INSPECTION_BELIEF_BUMP = 6

export function inspectorFor(index: number): (typeof INSPECTORS)[number] {
  return INSPECTORS[index % INSPECTORS.length]!
}

// ---------- 1–2: threshold ----------

export type CaseTrigger = {
  open: boolean
  weight: number
  suspicion: number
  reason: string
}

/**
 * Should the watch take an interest?
 *
 * Deterministic on state — no roll. Randomness belongs to WHO comes and
 * WHEN (the `regulatory` stream), not to whether a tavern with six standing
 * hygiene problems attracts attention, which it should always do.
 */
export function shouldOpenCase(state: TavernState): CaseTrigger {
  const today = state.calendar.totalDaysElapsed
  const slice = getRegulatoryModuleState(state)
  const weight = evidenceWeight(slice, today)
  const suspicion = suspicionFromEvidence(state, today)
  if (Object.keys(slice.cases).length >= MAX_OPEN_CASES) {
    return {
      open: false,
      weight,
      suspicion,
      reason: `${WATCH_LABEL} already has ${MAX_OPEN_CASES} cases open on you.`,
    }
  }
  // A live case already covers the ground; the watch does not open a second
  // one about the same mess.
  if (Object.keys(slice.cases).length > 0) {
    return {
      open: false,
      weight,
      suspicion,
      reason: `${WATCH_LABEL} has an open case on you already.`,
    }
  }
  if (weight < CASE_THRESHOLD) {
    return {
      open: false,
      weight,
      suspicion,
      reason: `Nothing the watch would come out for (${Math.round(weight)} of ${CASE_THRESHOLD}).`,
    }
  }
  const worst = [...liveEvidence(slice, today)].sort(
    (a, b) => b.severity - a.severity,
  )[0]
  return {
    open: true,
    weight,
    suspicion,
    reason: worst
      ? `${WATCH_LABEL} has heard about the tavern. Worst of it: ${worst.readable}`
      : `${WATCH_LABEL} has heard about the tavern.`,
  }
}

// ---------- 3–5: scheduling, preparation window, inspector ----------

export type OpenCaseResult = {
  record: TavernRegulatoryCase
  visitDay: number
  announced: boolean
}

/**
 * Open a case and set a visit date.
 *
 * The preparation window is the player's counterplay before the
 * consequence, and it is deliberately not free: a tavern the watch has heard
 * a LOT about gets no warning at all, so letting evidence pile up costs the
 * chance to prepare. The inspector and the exact day come from the named
 * `regulatory` RNG stream, so an extra service roll cannot shift who turns
 * up (architectural rule 7).
 */
export function openCase(ctx: SimContext, trigger: CaseTrigger): OpenCaseResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const rng = ctx.getRngStream('regulatory')
  const slice = getRegulatoryModuleState(ctx.state)

  const announced = trigger.weight < UNANNOUNCED_THRESHOLD
  const preparationDays = announced ? 2 + Math.floor(rng.float() * 3) : 0
  const visitDay = today + Math.max(1, preparationDays)
  const inspector = inspectorFor(
    Math.floor(rng.float() * INSPECTORS.length) + slice.totals.casesOpened,
  )

  const record: TavernRegulatoryCase = {
    id: nextCaseId(ctx.state),
    family: 'regulatory',
    ownerModuleId: REGULATORY_MODULE_ID,
    counterparty: watchRef(),
    status: 'active',
    openedOnDay: today,
    dueOnDay: visitDay,
    graceDays: getRule(ctx.state, 'obligationGraceDays'),
    lastTransitionOnDay: today,
    history: [
      {
        onDay: today,
        from: 'pending',
        to: 'active',
        reason: trigger.reason,
      },
    ],
    escalation: 0,
    readable: `${WATCH_LABEL} case — ${inspector.name}`,
    tags: ['regulatory', 'inspection'],
    caseType: 'hygiene_and_safety',
    scheduledVisitDays: [visitDay],
    visitsCompleted: 0,
    findings: [],
    caseStatus: 'open',
    inspectorId: inspector.id,
    inspectorName: inspector.name,
    preparationDays,
    nextVisitDay: visitDay,
    announced,
    findingIds: [],
    outcomes: [],
    fineObligationIds: [],
    appealsUsed: 0,
    openedOnEvidence: trigger.weight,
  }
  upsertCase(ctx, record, 'case_opened')

  ctx.addHistory({
    category: 'system',
    summary: announced
      ? `${WATCH_LABEL} gave notice of an inspection on day ${visitDay} (${inspector.name}). ${trigger.reason}`
      : `${WATCH_LABEL} is coming without notice (${inspector.name}). ${trigger.reason}`,
    tags: ['regulatory', 'inspection', announced ? 'announced' : 'unannounced'],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })
  ctx.addMemory({
    id: 'inspection_warning_recently',
    source: `${SOURCE}.case`,
    metadata: { visitDay, inspector: inspector.name, announced },
  })
  ctx.addCause({
    source: `${SOURCE}.case`,
    sourceType: 'system',
    target: 'pressure:inspection',
    targetType: 'pressure',
    amount: 15,
    direction: 'increase',
    weight: Math.round(trigger.weight),
    readable: trigger.reason,
    tags: ['regulatory', 'inspection', 'case'],
    relatedActors: [watchRef()],
    expiresAfterDays: 21,
  })

  return { record, visitDay, announced }
}

// ---------- 7: evaluation ----------

export type DimensionResult = {
  dimension: InspectionDimension
  /** 0 = perfect, 20 = as bad as it gets. */
  severity: number
  readable: string
  requirement: string
  target: InspectionFinding['target']
}

/**
 * Grade one dimension against live state.
 *
 * Returns `undefined` when the dimension is clean, so a passing visit
 * genuinely produces no finding rather than a finding of severity zero.
 */
export function evaluateDimension(
  state: TavernState,
  dimension: InspectionDimension,
): DimensionResult | undefined {
  const today = state.calendar.totalDaysElapsed
  switch (dimension) {
    case 'food_safety': {
      const kitchen = state.areas['kitchen']
      if (!kitchen || kitchen.cleanliness >= 50) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round((50 - kitchen.cleanliness) / 2)),
        readable: `Food is being prepared in a kitchen at cleanliness ${kitchen.cleanliness}.`,
        requirement: 'Bring the kitchen to cleanliness 60 or better.',
        target: { kind: 'area', id: 'kitchen', threshold: 60 },
      }
    }
    case 'cleanliness': {
      const worst = Object.values(state.areas).reduce<
        { id: string; label: string; cleanliness: number } | undefined
      >(
        (lowest, area) =>
          !lowest || area.cleanliness < lowest.cleanliness ? area : lowest,
        undefined,
      )
      if (!worst || worst.cleanliness >= 40) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round((40 - worst.cleanliness) / 2)),
        readable: `${worst.label} is not fit for the public (cleanliness ${worst.cleanliness}).`,
        requirement: `Bring ${worst.label} to cleanliness 55 or better.`,
        target: { kind: 'area', id: worst.id, threshold: 55 },
      }
    }
    case 'spoilage': {
      const worst = Object.values(state.stock)
        .filter((item) => item.tags.includes('food') && item.quantity > 0)
        .reduce<{ id: string; label: string; spoilage: number } | undefined>(
          (highest, item) =>
            !highest || item.spoilage > highest.spoilage ? item : highest,
          undefined,
        )
      if (!worst || worst.spoilage < 50) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round((worst.spoilage - 50) / 3) + 3),
        readable: `${worst.label} is being served at ${worst.spoilage}% spoilage.`,
        requirement: `Get ${worst.label} below 30% spoilage, or clear the stock.`,
        target: { kind: 'stock', id: worst.id, threshold: 30, ceiling: true },
      }
    }
    case 'damage': {
      const worst = Object.values(state.areas).reduce<
        { id: string; label: string; damage: number } | undefined
      >((highest, area) => (!highest || area.damage > highest.damage ? area : highest), undefined)
      if (!worst || worst.damage < 50) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round((worst.damage - 50) / 3) + 2),
        readable: `${worst.label} is unsafe (damage ${worst.damage}).`,
        requirement: `Bring ${worst.label}'s damage below 30.`,
        target: { kind: 'area', id: worst.id, threshold: 30, ceiling: true },
      }
    }
    case 'house_rules': {
      const economy = getEconomyModuleState(state)
      const broken = Object.values(economy.policies).find(
        (policy) => policy.intendedEnabled && policy.status === 'violated',
      )
      if (!broken) return undefined
      return {
        dimension,
        severity: 8,
        readable: `The tavern advertises '${broken.policyId}' and does not keep it (compliance ${broken.compliance}).`,
        requirement: `Either enforce '${broken.policyId}' or stop claiming it.`,
        target: { kind: 'policy', id: broken.policyId, threshold: 50 },
      }
    }
    case 'records': {
      const records = getRegulatoryModuleState(state).records
      if (records.readiness >= 50) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round((50 - records.readiness) / 3) + 2),
        readable: `The tavern's records are in no state to be inspected (${records.readiness}).`,
        requirement: 'Put the books in order (readiness 60 or better).',
        target: { kind: 'records', threshold: 60 },
      }
    }
    case 'recent_evidence': {
      const slice = getRegulatoryModuleState(state)
      const incidents = liveEvidence(slice, today).filter(
        (entry) => entry.dimension === 'recent_evidence',
      )
      if (incidents.length === 0) return undefined
      const total = incidents.reduce((sum, entry) => sum + entry.severity, 0)
      if (total < 8) return undefined
      return {
        dimension,
        severity: Math.min(20, Math.round(total / 2)),
        readable: `${incidents.length} incident(s) reported to the watch: ${incidents[0]!.readable}`,
        requirement: 'Keep the tavern out of trouble until the follow-up.',
        target: { kind: 'global', threshold: 0 },
      }
    }
  }
}

export type VisitEvaluation = {
  results: DimensionResult[]
  /** Sum of finding severities. Drives the outcome ladder. */
  score: number
  outcome: InspectionOutcome
}

/** Grade every dimension, then read the ladder. */
export function evaluateVisit(state: TavernState): VisitEvaluation {
  const results: DimensionResult[] = []
  for (const dimension of INSPECTION_DIMENSIONS) {
    const result = evaluateDimension(state, dimension)
    if (result) results.push(result)
  }
  const score = results.reduce((sum, result) => sum + result.severity, 0)
  return { results, score, outcome: outcomeFor(state, results, score) }
}

/**
 * §7.3.8's outcome ladder.
 *
 * A repeat offender is judged harder than a first-timer at the same score,
 * which is what makes a case's HISTORY matter and stops a player treating
 * each visit as an independent coin-flip.
 */
export function outcomeFor(
  state: TavernState,
  results: DimensionResult[],
  score: number,
): InspectionOutcome {
  if (results.length === 0) return 'pass'
  const slice = getRegulatoryModuleState(state)
  const priors = slice.watch.visitsFailed
  // A repeat offender is judged harder at the same score — but the bump is
  // bounded, because a tavern that has failed six times and then cleaned up
  // should still be able to pass.
  // Expansion Phase 8 §8.5 — "landlord and inspector interpretation where
  // legitimate". The watch does not invent findings: every result above came
  // from live state and would be there whatever anybody believed. What belief
  // moves is how the same sheet is READ — an inspector who has come to
  // distrust the house grades a borderline visit at the harsher end of the
  // band. Capped at 6, half the repeat-offender bump, because a prior FAILURE
  // is a fact on the record and a belief is not.
  const distrust = Math.round(
    beliefEffect(
      beliefAgainstHouse(state, { kind: 'faction', id: WATCH_FACTION_ID }),
      MAX_INSPECTION_BELIEF_BUMP,
    ),
  )
  const adjusted = score + Math.min(12, priors * 3) + distrust
  const worst = results.reduce((max, result) => Math.max(max, result.severity), 0)

  // The bands are set against what the seven dimensions can actually
  // produce. A neglected-but-ordinary tavern scores in the teens, which is a
  // warning; the fine band starts where the neglect is deliberate; and the
  // top of the ladder is reserved for a tavern that has already been told.
  if (adjusted <= 8) return 'conditional_pass'
  if (adjusted <= 20) return 'warning'
  if (adjusted <= 34) return 'fine'
  if (adjusted <= 50) return 'remediation_order'
  // CLOSURE IS NEVER A FIRST ANSWER. §7.3.8 requires it to be reachable, and
  // it is — but shutting a tavern the watch has never spoken to before would
  // make the whole preparation/remediation/appeal half of the lifecycle
  // decorative. It takes two prior failed visits AND a serious failure on
  // the day, with food safety at the top of it.
  if (
    priors >= 2 &&
    worst >= 15 &&
    results.some((result) => result.dimension === 'food_safety')
  ) {
    return 'closure'
  }
  return 'escalation'
}

// ---------- 8: applying the outcome ----------

export type VisitResult = {
  outcome: InspectionOutcome
  findings: InspectionFinding[]
  fine: number
  fineObligationId?: string
  followUpDay?: number
  closed: boolean
  readable: string
  record: TavernRegulatoryCase
}

/**
 * Fine scaled to the failure and to the ruleset's appetite for punishment.
 *
 * Deliberately a bite rather than a month's takings. The first sizing
 * (`score * 4`, uncapped) produced 156-coin fines on a tavern turning over
 * about a hundred a day, and four of them across one case's follow-ups came
 * to more than the till ever held — which made the watch, not the market,
 * the thing that decided whether a tavern survived. A fine has to be worth
 * paying attention to and worth paying; `MAX_FINE` is what keeps it the
 * second as well as the first.
 */
const MAX_FINE = 80

function fineFor(state: TavernState, score: number): number {
  const harshness = 1 / Math.max(0.4, getRule(state, 'recoveryAssistanceMultiplier'))
  return Math.max(8, Math.min(MAX_FINE, Math.round(score * 1.5 * harshness)))
}

/**
 * The penalty for an order left unmet.
 *
 * Smaller than the fine that raised the order, and rising slowly with the
 * rung: the point is to keep the cost of ignoring the watch above zero, not
 * to double the debt every week.
 */
function escalationPenaltyFor(
  state: TavernState,
  score: number,
  rung: number,
): number {
  return Math.min(60, Math.round(fineFor(state, score) / 2) + 5 * rung)
}

/**
 * Carry out the visit: write the findings, apply the outcome, and put the
 * follow-up on the calendar.
 *
 * Everything here is a real mutation of a real record — a fine is a payable
 * obligation, a closure is the economy module's own closed state, a
 * remediation order is a finding with a requirement the follow-up re-reads.
 * None of it is a pressure nudge standing in for a consequence.
 */
export function performVisit(
  ctx: SimContext,
  record: TavernRegulatoryCase,
): VisitResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const evaluation = evaluateVisit(ctx.state)

  // A bought inspector looks the other way — once, and only while the
  // arrangement holds. This is what a successful bribe actually buys.
  const slice = getRegulatoryModuleState(ctx.state)
  const bought =
    slice.watch.corruptInspectorId === record.inspectorId &&
    (slice.watch.corruptUntilDay ?? 0) >= today
  const outcome: InspectionOutcome = bought ? 'conditional_pass' : evaluation.outcome

  const findings: InspectionFinding[] = []
  if (!bought && outcome !== 'pass') {
    for (const result of evaluation.results.slice(0, MAX_FINDINGS_PER_CASE)) {
      const finding: InspectionFinding = {
        id: nextFindingId(ctx.state),
        caseId: record.id,
        dimension: result.dimension,
        raisedOnDay: today,
        severity: result.severity,
        readable: result.readable,
        requirement: result.requirement,
        target: result.target,
        status: 'open',
        dueOnDay: today + 7,
        tags: ['regulatory', 'finding', result.dimension],
      }
      upsertFinding(ctx, finding, 'finding_raised')
      findings.push(finding)
    }
  }

  let fine = 0
  let fineObligationId: string | undefined
  if (outcome === 'fine' || outcome === 'remediation_order' || outcome === 'closure') {
    fine = fineFor(ctx.state, evaluation.score)
    const obligation = openObligation({
      id: nextObligationId(ctx.state, REGULATORY_MODULE_ID),
      ownerModuleId: REGULATORY_MODULE_ID,
      counterparty: watchRef(),
      direction: 'payable',
      principal: fine,
      openedOnDay: today,
      dueOnDay: today + 7,
      graceDays: getRule(ctx.state, 'obligationGraceDays'),
      lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
      readable: `${WATCH_LABEL} fine (case ${record.id})`,
      tags: ['fine', 'regulatory'],
    })
    upsertObligation(ctx, obligation, 'fine_raised')
    scheduleObligationDueDate(ctx, obligation)
    fineObligationId = obligation.id
    bumpRegulatoryTotals(
      ctx,
      { finesRaised: 1, fineValue: fine },
      'fine_raised',
    )
  }

  if (outcome === 'closure') {
    ctx.modifyModuleState<EconomyModuleState>(
      ECONOMY_MODULE_ID,
      (current) => {
        if (!current) return current as unknown as EconomyModuleState
        return {
          ...current,
          financial: {
            ...current.financial,
            status: 'temporarily_closed',
            statusSinceDay: today,
            lastTransitionReason: `${WATCH_LABEL} ordered the tavern shut`,
          },
        }
      },
      { source: `${SOURCE}.closure`, reason: 'closure_ordered' },
    )
    bumpRegulatoryTotals(ctx, { closuresOrdered: 1 }, 'closure_ordered')
  }

  const passed = outcome === 'pass' || outcome === 'conditional_pass'

  // Orders left over from an EARLIER visit still need somebody to come back
  // and look at them. Reading only `findings` — the ones raised today — left
  // a case with outstanding orders and no visit scheduled whenever a visit
  // produced none of its own: a bought inspector writes nothing down, and a
  // tavern that fixed today's fault but not last week's passes on the day.
  // Either way the earlier orders would have sat there forever with nothing
  // coming, which is `OBL-03` reappearing one level down.
  const stillOutstanding = listFindings(ctx.state, { caseId: record.id }).filter(
    (finding) => finding.status === 'open' || finding.status === 'remediated',
  )
  const followUpDay =
    stillOutstanding.length > 0 ||
    outcome === 'escalation' ||
    outcome === 'closure'
      ? today + 7
      : undefined

  const readable = describeOutcome(record, outcome, evaluation, fine, bought)

  let next: TavernRegulatoryCase = {
    ...record,
    visitsCompleted: record.visitsCompleted + 1,
    scheduledVisitDays: [...record.scheduledVisitDays, ...(followUpDay ? [followUpDay] : [])],
    nextVisitDay: followUpDay,
    findingIds: [...record.findingIds, ...findings.map((finding) => finding.id)],
    findings: [
      ...record.findings,
      ...findings.map((finding) => ({
        onDay: today,
        code: finding.dimension,
        readable: finding.readable,
        severity: finding.severity,
      })),
    ],
    outcomes: [...record.outcomes, { onDay: today, outcome, readable }],
    fineObligationIds: fineObligationId
      ? [...record.fineObligationIds, fineObligationId]
      : record.fineObligationIds,
    caseStatus: stillOutstanding.length > 0 ? 'awaiting_remediation' : 'closing',
    escalation:
      outcome === 'escalation' || outcome === 'closure'
        ? record.escalation + 1
        : record.escalation,
    lastTransitionOnDay: today,
  }
  next = transitionContract(next, next.status, today, readable)
  upsertCase(ctx, next, 'visit_completed')
  bumpRegulatoryTotals(ctx, { visitsCompleted: 1 }, 'visit_completed')

  writeWatchStanding(
    ctx,
    (watch) => ({
      ...watch,
      visitsPassed: passed ? watch.visitsPassed + 1 : watch.visitsPassed,
      visitsFailed: passed ? watch.visitsFailed : watch.visitsFailed + 1,
      finesIssued: fine > 0 ? watch.finesIssued + 1 : watch.finesIssued,
      standing: Math.max(
        0,
        Math.min(100, watch.standing + (passed ? 10 : -Math.min(25, evaluation.score))),
      ),
    }),
    'visit_completed',
  )

  ctx.addHistory({
    category: 'system',
    summary: readable,
    tags: ['regulatory', 'inspection', outcome],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })

  return {
    outcome,
    findings,
    fine,
    ...(fineObligationId ? { fineObligationId } : {}),
    ...(followUpDay !== undefined ? { followUpDay } : {}),
    closed: outcome === 'closure',
    readable,
    record: next,
  }
}

function describeOutcome(
  record: TavernRegulatoryCase,
  outcome: InspectionOutcome,
  evaluation: VisitEvaluation,
  fine: number,
  bought: boolean,
): string {
  const who = record.inspectorName
  if (bought) {
    return `${who} walked the tavern, wrote nothing down, and left.`
  }
  switch (outcome) {
    case 'pass':
      return `${who} inspected the tavern and found nothing to write down.`
    case 'conditional_pass':
      return `${who} passed the tavern with words: ${evaluation.results[0]?.readable ?? 'minor faults'}`
    case 'warning':
      return `${who} issued a warning over ${evaluation.results.length} fault(s). Worst: ${evaluation.results[0]?.readable}`
    case 'fine':
      return `${who} fined the tavern ${fine} coin over ${evaluation.results.length} fault(s). Worst: ${evaluation.results[0]?.readable}`
    case 'remediation_order':
      return `${who} fined the tavern ${fine} coin and ordered ${evaluation.results.length} fault(s) put right within seven days.`
    case 'closure':
      return `${who} ordered the tavern shut and fined it ${fine} coin. ${evaluation.results[0]?.readable}`
    case 'escalation':
      return `${who} referred the tavern up. ${evaluation.results[0]?.readable}`
  }
}

// ---------- 9: the player's responses ----------

export type RemediationResult =
  | { ok: true; finding: InspectionFinding; verified: boolean; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Tell the watch a finding has been dealt with.
 *
 * Deliberately does NOT clear the finding by itself. `verifyFinding`
 * re-reads the state at the follow-up, so a player who declares a kitchen
 * clean without cleaning it is `remediated` but not `verified`, and the
 * follow-up says so. That is what stops this loop grading its own homework.
 */
export function remediateFinding(
  ctx: SimContext,
  findingId: string,
): RemediationResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const finding = getRegulatoryModuleState(ctx.state).findings[findingId]
  if (!finding) {
    return { ok: false, code: 'unknown_finding', reason: `No finding '${findingId}'.` }
  }
  if (finding.status !== 'open') {
    return {
      ok: false,
      code: 'not_open',
      reason: `That finding is already ${finding.status}.`,
    }
  }
  const verified = checkRequirement(ctx.state, finding)
  const next: InspectionFinding = {
    ...finding,
    status: verified ? 'verified' : 'remediated',
    ...(verified ? { resolvedOnDay: today } : {}),
  }
  upsertFinding(ctx, next, verified ? 'finding_verified' : 'finding_declared')
  if (verified) bumpRegulatoryTotals(ctx, { findingsCleared: 1 }, 'finding_verified')

  return {
    ok: true,
    finding: next,
    verified,
    readable: verified
      ? `${finding.requirement} — done, and it holds up.`
      : `Told the watch it was dealt with, but ${finding.requirement.toLowerCase()} is not true yet. The follow-up will check.`,
  }
}

/** Re-read the state a finding named. The one arbiter of "is it fixed?". */
export function checkRequirement(
  state: TavernState,
  finding: InspectionFinding,
): boolean {
  const { kind, id, threshold, ceiling } = finding.target
  if (threshold === undefined) return true
  const compare = (value: number) =>
    ceiling ? value <= threshold : value >= threshold
  switch (kind) {
    case 'area': {
      const area = id ? state.areas[id] : undefined
      if (!area) return false
      if (finding.dimension === 'damage') return compare(area.damage)
      return compare(area.cleanliness)
    }
    case 'stock': {
      const item = id ? state.stock[id] : undefined
      // Clearing the stock out entirely is a legitimate way to satisfy a
      // spoilage order, and the honest reading of "no spoiled food here".
      if (!item || item.quantity <= 0) return true
      return compare(item.spoilage)
    }
    case 'records':
      return compare(getRegulatoryModuleState(state).records.readiness)
    case 'policy': {
      const policy = id ? getEconomyModuleState(state).policies[id] : undefined
      if (!policy) return true
      if (!policy.intendedEnabled) return true
      return compare(policy.compliance)
    }
    case 'global':
      // A "stay out of trouble" order is satisfied by there being no fresh
      // incidents since it was raised.
      return !getRegulatoryModuleState(state).evidence.some(
        (entry) =>
          entry.dimension === 'recent_evidence' &&
          entry.observedOnDay > finding.raisedOnDay,
      )
  }
}

export type AppealResult =
  | { ok: true; upheld: boolean; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Contest a finding.
 *
 * Resolved against the evidence that produced it and the tavern's standing,
 * not a coin-flip: a finding raised on real state at severity 12 does not
 * get quashed because the player asked nicely. Bounded to one appeal per
 * case, so it is a decision and not a retry button.
 */
export function appealFinding(
  ctx: SimContext,
  findingId: string,
): AppealResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getRegulatoryModuleState(ctx.state)
  const finding = slice.findings[findingId]
  if (!finding) {
    return { ok: false, code: 'unknown_finding', reason: `No finding '${findingId}'.` }
  }
  const record = getCase(ctx.state, finding.caseId)
  if (!record) {
    return { ok: false, code: 'case_closed', reason: 'That case is closed.' }
  }
  if (record.appealsUsed >= MAX_APPEALS_PER_CASE) {
    return {
      ok: false,
      code: 'appeals_exhausted',
      reason: `${WATCH_LABEL} will hear one appeal per case, and you have used it.`,
    }
  }
  if (finding.status !== 'open' && finding.status !== 'remediated') {
    return {
      ok: false,
      code: 'not_appealable',
      reason: `That finding is already ${finding.status}.`,
    }
  }

  // A finding is quashed when the state no longer supports it and the
  // tavern is in reasonable standing — which is to say, when the inspector
  // got it wrong or the tavern fixed it before the paperwork caught up.
  const stillTrue = !checkRequirement(ctx.state, finding)
  const upheld = stillTrue || slice.watch.standing < 30
  const next: InspectionFinding = {
    ...finding,
    status: upheld ? 'upheld' : 'quashed',
    resolvedOnDay: today,
  }
  upsertFinding(ctx, next, upheld ? 'appeal_upheld' : 'appeal_quashed')
  upsertCase(
    ctx,
    {
      ...record,
      appealsUsed: record.appealsUsed + 1,
      caseStatus: 'under_appeal',
      lastTransitionOnDay: today,
    },
    'appeal_heard',
  )
  bumpRegulatoryTotals(
    ctx,
    upheld ? { appealsUpheld: 1 } : { appealsQuashed: 1, findingsCleared: 1 },
    'appeal_heard',
  )
  writeWatchStanding(
    ctx,
    (watch) => ({
      ...watch,
      standing: Math.max(0, Math.min(100, watch.standing + (upheld ? -5 : 3))),
    }),
    'appeal_heard',
  )

  const readable = upheld
    ? `${record.inspectorName} heard the appeal and stood by the finding: ${finding.readable}`
    : `${record.inspectorName} heard the appeal and struck the finding out.`
  ctx.addHistory({
    category: 'system',
    summary: readable,
    tags: ['regulatory', 'appeal', upheld ? 'upheld' : 'quashed'],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })
  return { ok: true, upheld, readable }
}

export type BribeResult =
  | { ok: true; accepted: boolean; paid: number; readable: string }
  | { ok: false; code: string; reason: string }

/**
 * Offer the inspector money.
 *
 * §7.3.9 allows this "only if consistent with the game", and it is: the
 * implementation ledger already carries `HOOK-corrupt_inspector_relationship`
 * and `HOOK-inspection_bribe_exposed_*`, both of which this makes real. It
 * is a genuine gamble on the named `regulatory` stream — an accepted bribe
 * buys one clean visit, a refused one hardens the watch, and either can be
 * exposed later, which is a consequence the tavern cannot appeal.
 */
export function bribeInspector(
  ctx: SimContext,
  caseId: string,
  amount: number,
): BribeResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const record = getCase(ctx.state, caseId)
  if (!record) {
    return { ok: false, code: 'unknown_case', reason: `No open case '${caseId}'.` }
  }
  if (record.bribe) {
    return {
      ok: false,
      code: 'already_offered',
      reason: `${record.inspectorName} has already been approached about this case.`,
    }
  }
  const offer = Math.max(0, Math.floor(amount))
  if (offer <= 0) {
    return { ok: false, code: 'no_offer', reason: 'Name an amount.' }
  }
  if (ctx.state.coin < offer) {
    return {
      ok: false,
      code: 'cannot_afford',
      reason: `The till holds ${ctx.state.coin}, not ${offer}.`,
    }
  }

  const inspector = INSPECTORS.find((entry) => entry.id === record.inspectorId)
  const rng = ctx.getRngStream('regulatory')
  // A bribeable inspector takes a serious offer; a thorough one almost never
  // does. The tavern's standing with the watch cuts both ways: a tavern
  // already under suspicion is watched more closely.
  const base = inspector?.temperament === 'bribeable' ? 0.65 : inspector?.temperament === 'impatient' ? 0.35 : 0.1
  const sizeBonus = Math.min(0.25, offer / 400)
  const accepted = rng.float() < base + sizeBonus

  spendCoin(ctx, offer, {
    source: `${SOURCE}.bribe`,
    category: 'other',
    readable: `Offered ${record.inspectorName} ${offer} coin.`,
    tags: ['regulatory', 'bribe'],
  })

  upsertCase(
    ctx,
    {
      ...record,
      bribe: { onDay: today, amount: offer, accepted, exposed: false },
      lastTransitionOnDay: today,
    },
    'bribe_offered',
  )
  writeWatchStanding(
    ctx,
    (watch) => ({
      ...watch,
      bribesOffered: watch.bribesOffered + 1,
      bribesAccepted: accepted ? watch.bribesAccepted + 1 : watch.bribesAccepted,
      standing: accepted
        ? watch.standing
        : Math.max(0, watch.standing - 20),
      ...(accepted
        ? { corruptInspectorId: record.inspectorId, corruptUntilDay: today + 21 }
        : {}),
    }),
    'bribe_offered',
  )

  const readable = accepted
    ? `${record.inspectorName} pocketed the ${offer} coin and said nothing more about it.`
    : `${record.inspectorName} took the ${offer} coin as evidence of something worse.`
  ctx.addHistory({
    category: 'system',
    summary: readable,
    tags: ['regulatory', 'bribe', accepted ? 'accepted' : 'refused'],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })
  ctx.addMemory({
    id: 'inspector_bribed_recently',
    source: `${SOURCE}.bribe`,
    metadata: { caseId, amount: offer, accepted },
  })
  return { ok: true, accepted, paid: offer, readable }
}

export type PayFineResult =
  | { ok: true; paid: number; cleared: boolean; readable: string }
  | { ok: false; code: string; reason: string }

/** Pay a watch fine. Partial payment counts, like every other obligation. */
export function payFine(
  ctx: SimContext,
  obligationId: string,
  amountOffered: number,
): PayFineResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const obligation = getObligation(ctx.state, obligationId)
  if (!obligation) {
    return { ok: false, code: 'unknown_fine', reason: `No outstanding fine '${obligationId}'.` }
  }
  const outstanding = outstandingAmount(obligation)
  const applied = Math.min(
    outstanding,
    Math.max(0, Math.floor(amountOffered)),
    ctx.state.coin,
  )
  if (applied <= 0) {
    return {
      ok: false,
      code: 'cannot_pay',
      reason:
        ctx.state.coin <= 0
          ? 'The till is empty.'
          : `Nothing to pay: ${outstanding} outstanding.`,
    }
  }
  spendCoin(ctx, applied, {
    source: `${SOURCE}.fine`,
    category: 'other',
    readable: `Paid ${applied} of ${obligation.readable}.`,
    tags: ['fine', 'regulatory'],
  })
  const result = payObligation(obligation, applied, today, 'fine paid')
  upsertObligation(ctx, result.record, 'fine_payment')
  recordObligationPayment(ctx, applied, 'fine_payment')
  if (result.settled) {
    writeWatchStanding(
      ctx,
      (watch) => ({
        ...watch,
        finesPaid: watch.finesPaid + 1,
        standing: Math.min(100, watch.standing + 5),
      }),
      'fine_paid',
    )
  }
  return {
    ok: true,
    paid: applied,
    cleared: result.settled,
    readable: result.settled
      ? `Paid ${obligation.readable} in full.`
      : `Paid ${applied} of ${obligation.readable}; ${outstandingAmount(result.record)} still owed.`,
  }
}

/** Put the books in order. The one thing the preparation window is FOR. */
export function updateRecords(ctx: SimContext): { readiness: number; readable: string } {
  const today = ctx.state.calendar.totalDaysElapsed
  let readiness = 0
  writeRecords(
    ctx,
    (current) => {
      readiness = Math.min(100, current.readiness + 35)
      return {
        readiness,
        lastUpdatedOnDay: today,
        timesUpdated: current.timesUpdated + 1,
      }
    },
    'records_updated',
  )
  return {
    readiness,
    readable: `Spent an evening on the books; records readiness is now ${readiness}.`,
  }
}

// ---------- 10: follow-up and closure ----------

export type FollowUpResult = {
  verified: number
  outstanding: InspectionFinding[]
  escalated: boolean
  closed: boolean
  readable: string
  record: TavernRegulatoryCase
}

/**
 * The follow-up visit.
 *
 * Re-reads every open finding against live state. Everything satisfied
 * closes the case; anything still outstanding escalates it, which is the
 * "follow-up and case closure" §7.3 asks for and the reason a remediation
 * order is a real deadline rather than a note.
 */
export function performFollowUp(
  ctx: SimContext,
  record: TavernRegulatoryCase,
): FollowUpResult {
  const today = ctx.state.calendar.totalDaysElapsed
  const findings = listFindings(ctx.state, { caseId: record.id }).filter(
    (finding) => finding.status === 'open' || finding.status === 'remediated',
  )

  let verified = 0
  const outstanding: InspectionFinding[] = []
  for (const finding of findings) {
    if (checkRequirement(ctx.state, finding)) {
      upsertFinding(
        ctx,
        { ...finding, status: 'verified', resolvedOnDay: today },
        'finding_verified',
      )
      verified += 1
    } else {
      outstanding.push(finding)
    }
  }
  if (verified > 0) {
    bumpRegulatoryTotals(ctx, { findingsCleared: verified }, 'follow_up')
  }

  // §5.11 applied to the LADDER rather than to a collection.
  //
  // The escalation rung has a top. Without one, a case whose orders are
  // never met raised a fresh penalty every seven days for ever — a tavern
  // the watch had already shut, and which therefore could not trade its way
  // to meeting them, accumulated two thousand coin of penalties by day 100.
  // Past the top rung the case is `escalated` and stays there: the watch has
  // done everything it is going to do, and the next move is the player's.
  const exhausted = record.escalation >= MAX_CASE_ESCALATIONS
  const escalated = outstanding.length > 0 && !exhausted
  let next: TavernRegulatoryCase = {
    ...record,
    visitsCompleted: record.visitsCompleted + 1,
    escalation: escalated ? record.escalation + 1 : record.escalation,
    caseStatus: escalated
      ? 'awaiting_remediation'
      : outstanding.length > 0
        ? 'escalated'
        : 'closing',
    nextVisitDay: escalated ? today + 7 : undefined,
    scheduledVisitDays: escalated
      ? [...record.scheduledVisitDays, today + 7]
      : record.scheduledVisitDays,
    lastTransitionOnDay: today,
  }

  if (escalated) {
    // An ignored order costs money the second time. The fine is a real
    // payable, so ignoring it in turn has the ledger's own consequences.
    const score = outstanding.reduce((sum, finding) => sum + finding.severity, 0)
    const fine = escalationPenaltyFor(ctx.state, score, next.escalation)
    const obligation = openObligation({
      id: nextObligationId(ctx.state, REGULATORY_MODULE_ID),
      ownerModuleId: REGULATORY_MODULE_ID,
      counterparty: watchRef(),
      direction: 'payable',
      principal: fine,
      openedOnDay: today,
      dueOnDay: today + 7,
      graceDays: getRule(ctx.state, 'obligationGraceDays'),
      lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
      readable: `${WATCH_LABEL} penalty for an unmet order (case ${record.id})`,
      tags: ['fine', 'regulatory', 'escalation'],
    })
    upsertObligation(ctx, obligation, 'escalation_fine')
    scheduleObligationDueDate(ctx, obligation)
    next = {
      ...next,
      fineObligationIds: [...next.fineObligationIds, obligation.id],
      outcomes: [
        ...next.outcomes,
        {
          onDay: today,
          outcome: 'escalation',
          readable: `${outstanding.length} order(s) unmet; a further ${fine} coin penalty.`,
        },
      ],
    }
    bumpRegulatoryTotals(ctx, { finesRaised: 1, fineValue: fine }, 'escalation_fine')

    // Three unmet follow-ups can shut the tavern — but only over something
    // that endangers the public.
    //
    // The bar is the same one the visit's own closure uses, and for the same
    // reason: the watch shuts a tavern that is poisoning people, not one
    // whose paperwork is a fortnight behind. Judged on any accumulated
    // score, a tavern that kept every room spotless and simply never sorted
    // its books was shut on day 55 — a consequence with no proportion to the
    // fault. Everything short of that lands on the `escalated` rung, where
    // the penalties stand and the doors stay open.
    const dangerous = outstanding.some(
      (finding) =>
        finding.severity >= 15 &&
        (finding.dimension === 'food_safety' || finding.dimension === 'cleanliness'),
    )
    if (next.escalation >= MAX_CASE_ESCALATIONS && dangerous) {
      ctx.modifyModuleState<EconomyModuleState>(
        ECONOMY_MODULE_ID,
        (current) => {
          if (!current) return current as unknown as EconomyModuleState
          return {
            ...current,
            financial: {
              ...current.financial,
              status: 'temporarily_closed',
              statusSinceDay: today,
              lastTransitionReason: `${WATCH_LABEL} shut the tavern over repeated unmet orders`,
            },
          }
        },
        { source: `${SOURCE}.closure`, reason: 'repeat_escalation' },
      )
      bumpRegulatoryTotals(ctx, { closuresOrdered: 1 }, 'repeat_escalation')
      next = {
        ...next,
        outcomes: [
          ...next.outcomes,
          {
            onDay: today,
            outcome: 'closure',
            readable: `${WATCH_LABEL} shut the tavern over repeated unmet orders.`,
          },
        ],
      }
    }
  }

  upsertCase(ctx, next, escalated ? 'follow_up_escalated' : 'follow_up_passed')
  bumpRegulatoryTotals(ctx, { visitsCompleted: 1 }, 'follow_up')
  writeWatchStanding(
    ctx,
    (watch) => ({
      ...watch,
      standing: Math.max(
        0,
        Math.min(100, watch.standing + (escalated ? -12 : 12)),
      ),
    }),
    'follow_up',
  )

  const readable = escalated
    ? `${record.inspectorName} came back and found ${outstanding.length} order(s) still unmet.`
    : outstanding.length > 0
      ? `${record.inspectorName} has stopped coming back. ${outstanding.length} order(s) stand against the tavern until somebody meets them.`
      : `${record.inspectorName} came back, found everything put right, and closed the case.`
  ctx.addHistory({
    category: 'system',
    summary: readable,
    tags: ['regulatory', 'follow_up', escalated ? 'escalated' : 'cleared'],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })

  return {
    verified,
    outstanding,
    escalated,
    closed: false,
    readable,
    record: next,
  }
}

/** Wind a case up once nothing is outstanding on it. */
export function closeCase(
  ctx: SimContext,
  record: TavernRegulatoryCase,
  reason: string,
): TavernRegulatoryCase {
  const today = ctx.state.calendar.totalDaysElapsed
  const next: TavernRegulatoryCase = {
    ...record,
    caseStatus: 'closed',
    status: 'settled',
    closedOnDay: today,
    nextVisitDay: undefined,
    lastTransitionOnDay: today,
    history: [
      ...record.history,
      { onDay: today, from: record.status, to: 'settled' as const, reason },
    ].slice(-24),
  }
  upsertCase(ctx, next, 'case_closed')
  ctx.addHistory({
    category: 'system',
    summary: `${WATCH_LABEL} closed case ${record.id} (${reason}).`,
    tags: ['regulatory', 'case', 'closed'],
    relatedActors: [watchRef()],
    relatedSystems: [REGULATORY_MODULE_ID],
  })
  return next
}

/**
 * Can this case be wound up?
 *
 * Every finding resolved, every fine settled. A case with an unpaid fine
 * stays open, because the fine is the consequence and closing over it would
 * make the consequence optional.
 */
export function caseIsSettled(state: TavernState, record: TavernRegulatoryCase): boolean {
  const findings = listFindings(state, { caseId: record.id })
  if (findings.some((finding) => finding.status === 'open' || finding.status === 'remediated')) {
    return false
  }
  for (const id of record.fineObligationIds) {
    const obligation = getObligation(state, id)
    if (obligation && outstandingAmount(obligation) > 0) return false
  }
  return true
}
