import type { SimContext } from '../../core/context'
import { getVentureBlueprint } from './ventureCatalog'
import { participantLabel, ventureBlockers, ventureStage } from './ambitionQueries'

export function reportVentures(ctx: SimContext): void {
  const entries = Object.values(ctx.state.ventures)
  if (!entries.length) return
  const lines = entries.map(entry => {
    const stage = ventureStage(ctx.state, entry.id)
    const partner = participantLabel(ctx.state, entry.id)
    const blockers = entry.status === 'active' ? ventureBlockers(ctx.state, entry.id) : []
    return `${entry.label}${partner ? ` · ${partner}` : ''}: ${entry.status}${stage && entry.status !== 'completed' ? ` — ${stage.label}, ${entry.progress}/${stage.work} sessions` : ''}.${blockers[0] ? ` ${blockers[0]}` : ''}${entry.status === 'completed' ? ` ${getVentureBlueprint(entry.id)?.ambition?.benefit ?? 'Licensed liquor service is unlocked.'}` : ''}`
  })
  ctx.addReportSection({ id: 'ventures', source: 'ventures', title: 'AMBITIONS', lines, data: { active: entries.filter(v => v.status === 'active').length, completed: entries.filter(v => v.status === 'completed').length } })
}
