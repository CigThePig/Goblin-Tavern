import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { FeedbackLoopSnapshot } from './feedbackLoopTypes'
import { getFeedbackModuleState } from './feedbackLoopModule'

// Phase 18 §18.14 — Feedback loop report.

export const FEEDBACK_REPORT_ID = 'feedback_loops'
export const FEEDBACK_REPORT_SOURCE = 'feedback'

function describeLoopHeader(snapshot: FeedbackLoopSnapshot): string {
  return `Active Loop: ${snapshot.label} (strength ${snapshot.strength}, risk ${snapshot.risk}, speed ${snapshot.speed})`
}

export function buildFeedbackLoopReport(ctx: SimContext): ReportSection {
  const slice = getFeedbackModuleState(ctx.state)
  const lines: string[] = []
  const all = Object.values(slice.loops).sort((a, b) => b.strength - a.strength)
  const active = all.filter((l) => l.active)

  lines.push(`Active loops: ${active.length} / ${all.length}`)
  lines.push('')

  if (active.length === 0) {
    lines.push('(No feedback loops are firing right now.)')
  } else {
    for (const loop of active) {
      lines.push(describeLoopHeader(loop))
      lines.push(`Pattern: ${loop.readable}`)
      if (loop.evidence.length > 0) {
        lines.push('Evidence:')
        for (const e of loop.evidence.slice(0, 4)) {
          lines.push(`  - ${e.readable}`)
        }
      }
      lines.push('')
    }
  }

  // Trim trailing blank.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  return {
    id: FEEDBACK_REPORT_ID,
    source: FEEDBACK_REPORT_SOURCE,
    title: 'FEEDBACK LOOP REPORT',
    lines,
    data: {
      activeCount: active.length,
      totalCount: all.length,
      activeIds: active.map((l) => l.id),
      summaries: all.map((l) => ({
        id: l.id,
        active: l.active,
        strength: l.strength,
        risk: l.risk,
        speed: l.speed,
        nodes: [...l.nodes],
        tags: [...l.tags],
      })),
    },
  }
}
