import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { isActiveArcStage, isTerminalArcStage } from '../../content/events/localArcTypes'

import { listPresentedArcs, listAllArcs } from './arcEngine'
import { getLocalArcsModuleState } from './state'
import { liveArcRuns } from './arcRuns'
import { progressionFor, stageFor, unmetConditions } from './arcProgress'
import { availableInterventions } from './arcDay'

// Phase 35 §35.8 — Local arcs report builder.
//
// Numeric-and-summary; no narrative prose, no card text. The section
// lists every active arc with its current stage, intensity, age, and
// the effect ids it is currently driving. Resolved/failed arcs are
// listed beneath the active ones with a smaller note so the player
// can see the wider history without scrolling through state.

const SOURCE = 'localArcs'

function formatEffectIds(activeEffects: string[]): string {
  if (activeEffects.length === 0) return '(no effects)'
  return activeEffects.join(', ')
}

export function buildLocalArcsReport(ctx: SimContext): ReportSection | null {
  const slice = getLocalArcsModuleState(ctx.state)
  const today = ctx.state.calendar.totalDaysElapsed
  const runs = liveArcRuns(ctx.state)

  // Phase 35 published this only on a monthly tick day, which was right
  // while arcs only moved once a month. Expansion Phase 9 §9.2 moved the
  // progression to a daily pass, and a contest the player is expected to
  // intervene in has to be visible on the days they could intervene — so
  // the section also publishes whenever an arc is actually running. On a
  // quiet day with no live arc it still says nothing.
  //
  // The gate is PRESENTED ARCS rather than live runs, because the two come
  // apart for exactly one day: an arc seeded by the monthly pass gets its
  // run on the next daily pass, and an arc the player can see is an arc the
  // report has to describe.
  const presented = listPresentedArcs(ctx.state)
  if (slice.lastMonthlyTickDay !== today && presented.length === 0) return null

  // Phase 204 / audit Wave 5 (`P4-SEAM-005`) — the player-facing question
  // is "is this arc in play", not "does it count against the seeding cap".
  // The narrower predicate reported a just-created arc as `(none)` while
  // the monthly overview listed it, at the exact boundary where the arc
  // begins. Both surfaces now ask `listPresentedArcs`.
  const activeArcs = presented
  const allArcs = listAllArcs(ctx.state)
  const terminalArcs = allArcs.filter(
    (a) => a.stage !== undefined && isTerminalArcStage(a.stage),
  )

  const lines: string[] = []

  // Expansion Phase 9 §9.2 — the contest, first: what the house is trying
  // to do, who is pushing back, how it stands, when it runs out, what is
  // still in the way, and what can be done about it today. Everything the
  // player needs in order to have a turn.
  if (runs.length > 0) {
    lines.push('In play:')
    const offers = availableInterventions(ctx.state)
    for (const run of runs) {
      const arc = ctx.state.world.localEvents[run.arcId]
      const progression = progressionFor(run.definitionId)
      const stage = progression ? stageFor(progression, run.stageId) : undefined
      lines.push(`  ${arc?.label ?? run.definitionId}${run.ownerLabel ? ` — ${run.ownerLabel} are behind it` : ''}`)
      if (progression) lines.push(`    goal: ${progression.goal}`)
      if (stage) {
        lines.push(`    ${stage.readable}${stage.stakes ? ` ${stage.stakes}` : ''}`)
      }
      lines.push(
        `    standing at ${run.goalProgress} against ${run.opposition}` +
          (run.deadlineDay !== undefined
            ? `, ${Math.max(0, run.deadlineDay - today)} day(s) left`
            : ''),
      )
      if (stage && stage.advanceWhen.length > 0) {
        const unmet = unmetConditions(ctx.state, run, stage.advanceWhen)
        if (unmet.length > 0) lines.push(`    still wants: ${unmet.join(', ')}`)
      }
      const mine = offers.filter(
        (offer) => offer.arcId === run.arcId && offer.blockedReason === undefined,
      )
      if (mine.length > 0) {
        lines.push(`    can do: ${mine.map((offer) => offer.intervention.label).join('; ')}`)
      }
    }
    lines.push('')
  }

  lines.push('Active Local Arcs:')
  if (activeArcs.length === 0) {
    lines.push('  (none)')
  } else {
    for (const arc of activeArcs) {
      const def = localArcRegistry.has(arc.definitionId)
        ? localArcRegistry.get(arc.definitionId)
        : undefined
      const label = def?.label ?? arc.label
      lines.push(
        `  ${label}: ${arc.stage}, intensity ${arc.intensity}, age ${arc.ageDays ?? 0}d`,
      )
      lines.push(`    effects: ${formatEffectIds(arc.activeEffects ?? [])}`)
    }
  }

  if (terminalArcs.length > 0) {
    lines.push('')
    lines.push('Resolved Arcs:')
    for (const arc of terminalArcs) {
      lines.push(`  ${arc.label}: ${arc.stage} on day ${arc.lastUpdatedDay ?? arc.startedDay}`)
    }
  }

  if (slice.activeArcTags.length > 0) {
    lines.push('')
    lines.push(`Active Arc Tags: ${slice.activeArcTags.join(', ')}`)
  }
  if (slice.activeIssueSeedTags.length > 0) {
    lines.push(`Active Issue Seed Tags: ${slice.activeIssueSeedTags.join(', ')}`)
  }
  if (slice.activeMarketConditionIds.length > 0) {
    lines.push(
      `Active Market Conditions: ${slice.activeMarketConditionIds.join(', ')}`,
    )
  }

  return {
    id: 'localArcs',
    source: SOURCE,
    title: 'LOCAL ARCS',
    lines,
    data: {
      liveRunIds: runs.map((run) => run.arcId),
      liveRunProgress: runs.map((run) => ({
        arcId: run.arcId,
        stageId: run.stageId,
        goalProgress: run.goalProgress,
        opposition: run.opposition,
      })),
      day: today,
      activeArcs: activeArcs.map((arc) => ({
        id: arc.id,
        definitionId: arc.definitionId,
        type: arc.type,
        label: arc.label,
        stage: arc.stage,
        ageDays: arc.ageDays ?? 0,
        intensity: arc.intensity,
        activeEffects: [...(arc.activeEffects ?? [])],
      })),
      resolvedArcs: terminalArcs.map((arc) => ({
        id: arc.id,
        definitionId: arc.definitionId,
        stage: arc.stage,
        resolvedDay: arc.lastUpdatedDay ?? arc.startedDay,
      })),
      activeArcTags: [...slice.activeArcTags],
      activeIssueSeedTags: [...slice.activeIssueSeedTags],
      activeMarketConditionIds: [...slice.activeMarketConditionIds],
    },
  }
}

export function isArcStillActive(stage: string | undefined): boolean {
  if (stage === undefined) return false
  return isActiveArcStage(stage as never)
}
