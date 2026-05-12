import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { isActiveArcStage, isTerminalArcStage } from '../../content/events/localArcTypes'

import { listActiveArcs, listAllArcs } from './arcEngine'
import { getLocalArcsModuleState } from './state'

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
  // Only emit the report on the day a monthly tick happened so the
  // section doesn't fire every single day. The slice marks the last
  // monthly tick day; if it equals today we publish a section.
  if (slice.lastMonthlyTickDay !== today) return null

  const activeArcs = listActiveArcs(ctx.state)
  const allArcs = listAllArcs(ctx.state)
  const terminalArcs = allArcs.filter(
    (a) => a.stage !== undefined && isTerminalArcStage(a.stage),
  )

  const lines: string[] = []
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
