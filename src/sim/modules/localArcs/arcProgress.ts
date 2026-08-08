import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import {
  type ArcAdvanceCondition,
  type ArcOpposingMove,
  type ArcOutcomeKind,
  type ArcOwnerSpec,
  type ArcStageDefinition,
  type LocalArcDefinition,
  type LocalArcProgression,
} from '../../content/events/localArcTypes'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { noteStanding } from '../factions/standing'
import { getSupplierAccount, writeSupplierAccount } from '../suppliers/state'

import {
  bumpArcRunTotal,
  getArcRun,
  liveArcRuns,
  noteArcRun,
  writeArcRun,
  type ArcRun,
} from './arcRuns'

// Expansion Phase 9 §9.2 — arcs progress on state and on moves, not on age.
//
// The daily pass, in order:
//
//   1. `runOpposingMoves`  — the arc's owner pushes, on its own cadence and
//                            in its own domain.
//   2. `advanceArcStages`  — stages advance when their conditions hold, fork
//                            on branches, or fall through on a timeout.
//   3. terminal stages close the arc, and `arcOutcomes.ts` applies what the
//      world keeps.
//
// It runs DAILY, at `localEventUpdate`, which is the §9.2 headline: "move
// arcs from mostly monthly age progression toward event- and state-driven
// stages". A blight that the player is actually fighting now moves on the
// day they fight it rather than at the end of the month.
//
// WHY THE ORDER. The owner moves first so a stage that advances today
// advances against the opposition the owner has actually applied — otherwise
// a player could always get one free day out of every push. And the outcome
// is computed from the two meters at the moment the arc closes, so the last
// intervention before a deadline genuinely counts.

const SOURCE = 'localArcs.progress'

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function progressionFor(
  definitionId: string,
): LocalArcProgression | undefined {
  if (!localArcRegistry.has(definitionId)) return undefined
  return localArcRegistry.get(definitionId).progression
}

export function stageFor(
  progression: LocalArcProgression,
  stageId: string,
): ArcStageDefinition | undefined {
  return progression.stages.find((stage) => stage.id === stageId)
}

// ---------------------------------------------------------------------------
// Owner resolution
// ---------------------------------------------------------------------------

/**
 * Pick the actor this arc belongs to, once, at seed time.
 *
 * §9.2 asks for "actors and ownership", and the reason it is resolved once
 * and stored is architecture rule 8: an arc whose owner were recomputed on
 * every read would change hands the moment a relationship moved, and the
 * player would be arguing with somebody different each morning.
 */
export function resolveArcOwner(
  state: TavernState,
  spec: ArcOwnerSpec,
): { ref: EntityRef; label: string } | undefined {
  if (spec.id) {
    const label = labelForOwner(state, spec.kind, spec.id)
    return label ? { ref: { kind: refKind(spec.kind), id: spec.id }, label } : undefined
  }

  const candidates = ownerCandidates(state, spec)
  if (candidates.length === 0) return undefined
  const chosen = candidates[0]!
  return {
    ref: { kind: refKind(spec.kind), id: chosen.id },
    label: chosen.label,
  }
}

function refKind(kind: ArcOwnerSpec['kind']): EntityRef['kind'] {
  switch (kind) {
    case 'faction':
      return 'faction'
    case 'supplier':
      return 'supplier'
    case 'culture':
      return 'culture'
    case 'customer_group':
      return 'customer_group'
    default:
      return 'system'
  }
}

/** A supplier's display name. `name` is a generated-name record, not a string. */
function supplierName(state: TavernState, id: string): string | undefined {
  const supplier = state.world.suppliers[id]
  if (!supplier) return undefined
  const name = supplier.name as unknown
  if (typeof name === 'string') return name
  if (name && typeof name === 'object' && typeof (name as { display?: unknown }).display === 'string') {
    return (name as { display: string }).display
  }
  return id
}

function labelForOwner(
  state: TavernState,
  kind: ArcOwnerSpec['kind'],
  id: string,
): string | undefined {
  switch (kind) {
    case 'faction':
      return state.world.factions[id]?.label
    case 'supplier':
      return supplierName(state, id)
    case 'culture':
      return state.world.cultures[id]?.label
    case 'customer_group':
      return state.customerGroups[id]?.label
    default:
      // A `system` owner is a standing institution — the watch, the other
      // house — and has no world record to read a label from.
      return id.replace(/_/g, ' ')
  }
}

function ownerCandidates(
  state: TavernState,
  spec: ArcOwnerSpec,
): Array<{ id: string; label: string; score: number }> {
  const out: Array<{ id: string; label: string; score: number }> = []
  const pick = spec.pick ?? 'worst_relationship'

  if (spec.kind === 'faction') {
    for (const faction of Object.values(state.world.factions)) {
      out.push({
        id: faction.id,
        label: faction.label,
        score:
          pick === 'most_influential'
            ? faction.influence
            : pick === 'largest'
              ? faction.influence
              : 100 - faction.relationship,
      })
    }
  } else if (spec.kind === 'supplier') {
    for (const supplier of Object.values(state.world.suppliers)) {
      out.push({
        id: supplier.id,
        label: supplierName(state, supplier.id) ?? supplier.id,
        score: pick === 'most_influential' ? supplier.reliability : 100 - supplier.relationship,
      })
    }
  } else if (spec.kind === 'culture') {
    for (const culture of Object.values(state.world.cultures)) {
      out.push({
        id: culture.id,
        label: culture.label,
        score: pick === 'largest' ? culture.familiarity : 100 - culture.comfort,
      })
    }
  } else if (spec.kind === 'customer_group') {
    for (const group of Object.values(state.customerGroups)) {
      if (group.patronage <= 0) continue
      out.push({
        id: group.id,
        label: group.label,
        score: pick === 'largest' ? group.patronage : 100 - group.satisfaction,
      })
    }
  }

  // Deterministic: score first, then id. No RNG — the same world always
  // hands the same arc to the same actor.
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/** The owner's current standing with the house, 0..100, or undefined. */
export function ownerRelationship(
  state: TavernState,
  ref: EntityRef | undefined,
): number | undefined {
  if (!ref) return undefined
  switch (ref.kind) {
    case 'faction':
      return state.world.factions[ref.id]?.relationship
    case 'supplier':
      return state.world.suppliers[ref.id]?.relationship
    case 'culture':
      return state.world.cultures[ref.id]?.comfort
    case 'customer_group':
      return state.customerGroups[ref.id]?.satisfaction
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export function evaluateAdvanceCondition(
  state: TavernState,
  run: ArcRun,
  condition: ArcAdvanceCondition,
): boolean {
  const today = state.calendar.totalDaysElapsed
  switch (condition.kind) {
    case 'days_in_stage':
      return today - run.stageEnteredDay >= condition.days
    case 'goal_progress_at_least':
      return run.goalProgress >= condition.value
    case 'margin_at_least':
      return run.goalProgress - run.opposition >= condition.value
    case 'goal_progress_below':
      return run.goalProgress < condition.value
    case 'opposition_at_least':
      return run.opposition >= condition.value
    case 'pressure_above':
      return (state.pressures[condition.id]?.value ?? 0) > condition.threshold
    case 'pressure_below':
      return (state.pressures[condition.id]?.value ?? 0) < condition.threshold
    case 'reputation_above':
      return (
        ((state.reputation as Record<string, number>)[condition.id] ?? 0) >
        condition.threshold
      )
    case 'reputation_below':
      return (
        ((state.reputation as Record<string, number>)[condition.id] ?? 100) <
        condition.threshold
      )
    case 'area_cleanliness_below':
      return (state.areas[condition.id]?.cleanliness ?? 100) < condition.threshold
    case 'coin_below':
      return state.coin < condition.value
    case 'intervention_taken':
      return run.interventions.some((entry) => entry.interventionId === condition.id)
    case 'owner_relationship_below': {
      const relationship = ownerRelationship(state, run.ownerRef)
      return relationship !== undefined && relationship < condition.threshold
    }
    default:
      return false
  }
}

export function allConditionsHold(
  state: TavernState,
  run: ArcRun,
  conditions: ReadonlyArray<ArcAdvanceCondition>,
): boolean {
  for (const condition of conditions) {
    if (!evaluateAdvanceCondition(state, run, condition)) return false
  }
  return true
}

/** A readable account of which conditions are not yet met. For the report. */
export function unmetConditions(
  state: TavernState,
  run: ArcRun,
  conditions: ReadonlyArray<ArcAdvanceCondition>,
): string[] {
  const out: string[] = []
  for (const condition of conditions) {
    if (evaluateAdvanceCondition(state, run, condition)) continue
    out.push(describeCondition(state, run, condition))
  }
  return out
}

function describeCondition(
  state: TavernState,
  run: ArcRun,
  condition: ArcAdvanceCondition,
): string {
  const today = state.calendar.totalDaysElapsed
  switch (condition.kind) {
    case 'days_in_stage':
      return `${condition.days - (today - run.stageEnteredDay)} more day(s)`
    case 'goal_progress_at_least':
      return `progress ${run.goalProgress}/${condition.value}`
    case 'margin_at_least':
      return `to be ${condition.value} ahead (currently ${run.goalProgress - run.opposition})`
    case 'goal_progress_below':
      return `progress must fall below ${condition.value}`
    case 'opposition_at_least':
      return `opposition ${run.opposition}/${condition.value}`
    case 'pressure_above':
      return `${condition.id.replace(/_/g, ' ')} above ${condition.threshold}`
    case 'pressure_below':
      return `${condition.id.replace(/_/g, ' ')} below ${condition.threshold}`
    case 'reputation_above':
      return `${condition.id} above ${condition.threshold}`
    case 'reputation_below':
      return `${condition.id} below ${condition.threshold}`
    case 'area_cleanliness_below':
      return `${condition.id.replace(/_/g, ' ')} cleanliness below ${condition.threshold}`
    case 'coin_below':
      return `coin below ${condition.value}`
    case 'intervention_taken':
      return `${condition.id.replace(/_/g, ' ')} not done`
    case 'owner_relationship_below':
      return `they must think less of the house than ${condition.threshold}`
    default:
      return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Opposing moves
// ---------------------------------------------------------------------------

function movesAvailable(
  progression: LocalArcProgression,
  run: ArcRun,
  today: number,
): ArcOpposingMove[] {
  return progression.opposingMoves.filter((move) => {
    if (move.inStages && move.inStages.length > 0 && !move.inStages.includes(run.stageId)) {
      return false
    }
    const readyOn = run.opposingCooldowns[move.id]
    return readyOn === undefined || today >= readyOn
  })
}

/**
 * The owner pushes back.
 *
 * §9.2's "opposing moves". Each one raises the arc's opposition and, where
 * the owner is a real actor with a domain of its own, does something IN that
 * domain — a faction records how it is being treated, a supplier gets less
 * generous. That second half is what stops opposition being a private number
 * the arc keeps to itself: neglect an arc a faction owns and the faction's
 * standing ledger says so, which the faction layer then acts on separately.
 */
export function runOpposingMoves(ctx: SimContext, run: ArcRun): void {
  const progression = progressionFor(run.definitionId)
  if (!progression) return
  const today = ctx.state.calendar.totalDaysElapsed
  const stage = stageFor(progression, run.stageId)
  if (!stage || stage.outcome !== undefined) return

  const available = movesAvailable(progression, run, today)
  if (available.length === 0) return
  // One move a day at most, in declared order. An owner that made three
  // moves in a morning would be noise rather than pressure — the same
  // reasoning as a faction's commitment window.
  const move = available[0]!

  const ownerLabel = run.ownerLabel ?? 'They'
  writeArcRun(
    ctx,
    run.arcId,
    (current) => ({
      ...current,
      opposition: clamp100(current.opposition + move.opposition),
      opposingCooldowns: {
        ...current.opposingCooldowns,
        [move.id]: today + move.everyDays,
      },
    }),
    'opposing_move',
  )
  noteArcRun(ctx, run.arcId, `${ownerLabel} ${move.readable}.`)
  bumpArcRunTotal(ctx, 'opposingMovesMade')

  applyDomainMove(ctx, run, move)

  ctx.addLog(
    {
      message: `${ownerLabel} ${move.readable}.`,
      level: 'info',
      data: { arcId: run.arcId, moveId: move.id },
    },
    'localArcs',
  )
}

/**
 * The half of an opposing move that belongs to somebody else's domain.
 *
 * Deliberately narrow. The arc does not reach into a faction and move its
 * relationship — it records an entry in the standing ledger the factions
 * module owns and re-derives the meter from, which is the same route the
 * faction's own evidence takes. Anything wider would be this domain writing
 * another's conclusions.
 */
function applyDomainMove(ctx: SimContext, run: ArcRun, move: ArcOpposingMove): void {
  const kind = move.domainMove ?? 'none'
  if (kind === 'none' || !run.ownerRef) return

  if (kind === 'press_grievance' && run.ownerRef.kind === 'faction') {
    noteStanding(ctx, {
      factionId: run.ownerRef.id,
      id: `arc_pressure_${run.arcId}_${move.id}`,
      kind: 'grievance',
      weight: Math.max(4, Math.round(move.opposition / 2)),
      readable: `${run.ownerLabel ?? run.ownerRef.id} are unhappy about how the house is handling this.`,
      tags: ['arc', 'grievance'],
    })
    return
  }

  if (kind === 'harden_terms' && run.ownerRef.kind === 'supplier') {
    const account = getSupplierAccount(ctx.state, run.ownerRef.id)
    if (!account) return
    const today = ctx.state.calendar.totalDaysElapsed
    writeSupplierAccount(
      ctx,
      run.ownerRef.id,
      (current) => ({
        ...current,
        termsAdjustment: Math.min(1.6, Math.round(current.termsAdjustment * 105) / 100),
        termsAdjustmentUntilDay: today + 21,
        lastDecisionDay: today,
        lastDecisionReason: `Trading harder while ${run.definitionId.replace(/_/g, ' ')} runs.`,
      }),
      'arc_pressure',
    )
    return
  }

  if (kind === 'talk') {
    // Talk is the rumour layer's business; the arc only supplies the reason.
    // §8.4's propagation then decides who hears it and whether they believe
    // it, which is the point of having a rumour network at all.
    const today = ctx.state.calendar.totalDaysElapsed
    const rumourId = `arc_word_${run.arcId}`
    const existing = ctx.state.world.socialRumours[rumourId]
    if (existing) {
      ctx.modifySocialRumour(
        rumourId,
        {
          strength: Math.min(100, existing.strength + 8),
          lastSpreadDay: today,
        },
        {
          source: `${SOURCE}.talk`,
          sourceType: 'local_event',
          target: rumourId,
          targetType: 'rumour',
          amount: 8,
          readable: `${run.ownerLabel ?? 'They'} kept the word going.`,
          tags: ['arc', 'rumour'],
          relatedSystems: ['rumours', 'local_arcs'],
        },
      )
      return
    }
    ctx.addSocialRumour(
      {
        id: rumourId,
        label: `${run.ownerLabel ?? 'They'} are telling everybody how the house is handling this.`,
        strength: 30,
        accuracy: 'partial',
        firstHeardDay: today,
        lastSpreadDay: today,
        tags: ['arc', 'rumour', run.definitionId],
        reach: 'public',
        ...(run.ownerRef ? { originRef: run.ownerRef } : {}),
        involvedRefs: [{ kind: 'local_event', id: run.arcId }],
      },
      {
        source: `${SOURCE}.talk`,
        sourceType: 'local_event',
        target: rumourId,
        targetType: 'rumour',
        amount: 30,
        readable: `${run.ownerLabel ?? 'They'} started talking about how this is going.`,
        tags: ['arc', 'rumour'],
        relatedSystems: ['rumours', 'local_arcs'],
      },
    )
  }
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

export type ArcTransition = {
  arcId: string
  fromStageId: string
  toStageId: string
  reason: string
  /** True when the move came from the stage running out rather than resolving. */
  timedOut: boolean
}

/**
 * Where this arc goes next, if anywhere.
 *
 * Branches are checked before `next`, in declared order, which is what makes
 * a fork on live state possible: a blight the player has fought reaches
 * `contained`, one they ignored reaches `entrenched`, and the difference is
 * a condition rather than a different arc.
 *
 * A timeout wins over neither: it is checked LAST, so a stage whose
 * conditions come good on the very day it would have run out still resolves
 * properly. That ordering is the difference between a deadline and a trap.
 */
export function computeStageTransition(
  state: TavernState,
  run: ArcRun,
): ArcTransition | undefined {
  const progression = progressionFor(run.definitionId)
  if (!progression) return undefined
  const stage = stageFor(progression, run.stageId)
  if (!stage || stage.outcome !== undefined) return undefined

  for (const branch of stage.branches ?? []) {
    if (!allConditionsHold(state, run, branch.when)) continue
    return {
      arcId: run.arcId,
      fromStageId: run.stageId,
      toStageId: branch.toStage,
      reason: branch.readable,
      timedOut: false,
    }
  }

  if (stage.next && allConditionsHold(state, run, stage.advanceWhen)) {
    return {
      arcId: run.arcId,
      fromStageId: run.stageId,
      toStageId: stage.next,
      reason: stage.readable,
      timedOut: false,
    }
  }

  if (
    run.deadlineDay !== undefined &&
    state.calendar.totalDaysElapsed >= run.deadlineDay &&
    stage.onTimeout
  ) {
    return {
      arcId: run.arcId,
      fromStageId: run.stageId,
      toStageId: stage.onTimeout,
      reason: 'time ran out',
      timedOut: true,
    }
  }

  return undefined
}

/** Move a run into a stage, stamping its deadline. */
export function enterStage(
  ctx: SimContext,
  arcId: string,
  stageId: string,
  note: string,
): void {
  const progression = progressionFor(getArcRun(ctx.state, arcId)?.definitionId ?? '')
  const today = ctx.state.calendar.totalDaysElapsed
  const stage = progression ? stageFor(progression, stageId) : undefined
  writeArcRun(
    ctx,
    arcId,
    (run) => {
      const { deadlineDay: _dropped, ...rest } = run
      return {
        ...rest,
        stageId,
        stageEnteredDay: today,
        ...(stage?.timeoutDays !== undefined
          ? { deadlineDay: today + stage.timeoutDays }
          : {}),
      }
    },
    `stage_${stageId}`,
  )
  noteArcRun(ctx, arcId, note)
}

// ---------------------------------------------------------------------------
// The outcome
// ---------------------------------------------------------------------------

/**
 * How an arc that has reached its end actually went.
 *
 * A terminal stage may name its own outcome — a branch that only a
 * well-fought arc can reach ends in success by construction. When it does
 * not, the outcome is the comparison the whole model exists to make: how far
 * the house got against how hard the owner pushed. The middle band is a
 * COMPROMISE rather than a failure, because §9.2 asks for one and because a
 * contest that ends level should end level.
 */
export function computeOutcome(run: ArcRun, stage: ArcStageDefinition): ArcOutcomeKind {
  if (stage.outcome) return stage.outcome
  const margin = run.goalProgress - run.opposition
  if (margin >= 20) return 'success'
  if (margin <= -20) return 'failure'
  return 'compromise'
}

/** Every live run, with the arc record it belongs to. */
export function liveRunsWithDefinition(
  state: TavernState,
): Array<{ run: ArcRun; definition: LocalArcDefinition; progression: LocalArcProgression }> {
  const out: Array<{
    run: ArcRun
    definition: LocalArcDefinition
    progression: LocalArcProgression
  }> = []
  for (const run of liveArcRuns(state)) {
    if (!localArcRegistry.has(run.definitionId)) continue
    const definition = localArcRegistry.get(run.definitionId)
    if (!definition.progression) continue
    out.push({ run, definition, progression: definition.progression })
  }
  return out
}
