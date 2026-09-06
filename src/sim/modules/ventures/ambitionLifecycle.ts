import type { SimContext } from '../../core/context'
import type { TeleologyEntry } from '../../state/TavernState'
import { getVentureBlueprint } from './ventureCatalog'
import { ventureRecord, writeVentureRecord } from './ambitionState'
import { ventureBlockers, ventureStage } from './ambitionQueries'
import { getStaffModuleState } from '../staff/workforceState'

/** A neglected attempt pauses after two weeks, retaining paid progress. */
export const VENTURE_STALL_DAYS = 14

export function advanceAmbition(ctx: SimContext, entry: TeleologyEntry): void {
  const plan = getVentureBlueprint(entry.id)?.ambition
  if (!plan || entry.status !== 'active') return
  const today = ctx.state.calendar.totalDaysElapsed
  const record = ventureRecord(ctx.state, entry.id)
  const stage = ventureStage(ctx.state, entry.id)
  if (!stage) return
  const blockers = ventureBlockers(ctx.state, entry.id)
  // The cook must actually have contributed today. Merely employing somebody
  // cannot earn a staff-led venture while they are resting or absent.
  if (plan.participant === 'staff' && stage.id === 'prove' && !getStaffModuleState(ctx.state).roster.some(r => r.staffId === record.participantId && r.available && r.contribution > 0)) {
    blockers.push('The named cook did not work this service.')
  }
  if (entry.progress >= stage.work && blockers.length === 0) {
    const next = plan.stages[plan.stages.findIndex(s => s.id === stage.id) + 1]
    const meta = { source: 'ventures.milestone', readable: next ? `${entry.label}: ${stage.label} is complete. Next: ${next.label}.` : `${entry.label} is complete. ${plan.benefit}`, tags: ['teleology', 'venture', entry.id, next ? 'milestone' : 'completed'] }
    ctx.modifyVenture(entry.id, { stage: next?.id ?? 'established', progress: 0, status: next ? 'active' : 'completed', updatedAtDay: today }, meta)
    writeVentureRecord(ctx, entry.id, { stageEnteredDay: today, blockedDays: 0 })
    if (!next) {
      const outcome = record.outcome ?? plan.outcome
      ctx.modifyTransformation(outcome, { id: outcome, label: outcome === 'supplier_exclusive' ? 'An exclusive supplier compact' : plan.outcomeLabel, active: true, activatedAtDay: today, tags: ['ambition', entry.id, ...(record.participantId ? [`participant:${record.participantId}`] : [])] }, meta)
      if (entry.id === 'venture_crew_kitchen' && record.participantId) {
        const staff = ctx.state.staff[record.participantId]
        if (staff && !staff.tags.includes('kitchen_mentor')) ctx.modifyStaff(staff.id, { tags: [...staff.tags, 'kitchen_mentor'] }, { ...meta, readable: `${staff.name.display} has become the kitchen's mentor through supported service.` })
      }
    }
    return
  }
  const blockedDays = record.lastWorkedDay === today ? 0 : record.blockedDays + 1
  writeVentureRecord(ctx, entry.id, { blockedDays })
  if (blockedDays >= VENTURE_STALL_DAYS) {
    ctx.modifyVenture(entry.id, { status: 'paused', updatedAtDay: today }, {
      source: 'ventures.stalled', readable: `${entry.label} was set aside after ${VENTURE_STALL_DAYS} days without owner work. Paid progress remains; resume when ready.${blockers[0] ? ` ${blockers[0]}` : ''}`,
      tags: ['teleology', 'venture', entry.id, 'paused'],
    })
  }
}
