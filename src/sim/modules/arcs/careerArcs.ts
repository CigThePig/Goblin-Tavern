import type { SimContext } from '../../core/context'
import type { StaffState, TeleologyEntry } from '../../state/TavernState'
import { getStaffModuleState } from '../staff/workforceState'
import { readArcSubjectId } from './staffMasteryArc'

export const MAX_CAREER_ARCS = 32
export const CAREER_PATHS = [
  { id: 'kitchen', label: 'craft in the kitchen', roles: /cook|chef|kitchen/, reward: 'kitchen_mentor', rewardLabel: 'Kitchen mentor', benefit: 'Adds food quality when working.' },
  { id: 'hospitality', label: 'becoming the face of the house', roles: /server|bartender|host/, reward: 'trusted_host', rewardLabel: 'Trusted host', benefit: 'Improves service speed when working.' },
  { id: 'stewardship', label: 'keeping the house together', roles: /./, reward: 'house_steward', rewardLabel: 'House steward', benefit: 'Improves mess control when working.' },
] as const
const pathFor = (staff: StaffState) => CAREER_PATHS.find(p => p.roles.test(staff.role))!
const meta = (arc: TeleologyEntry, readable: string) => ({ source: 'arcs.career', readable, tags: ['teleology', 'arc', 'career_arc', arc.id] })

/** Stable per-person ids; existing mastery entries retain their ids and stages. */
export function seedCareerArcs(ctx: SimContext): void {
  if (ctx.state.calendar.totalDaysElapsed < 7) return
  let count = Object.values(ctx.state.arcs).filter(a => a.tags.includes('career_arc')).length
  for (const staff of Object.values(ctx.state.staff).sort((a,b) => a.id.localeCompare(b.id))) {
    if (count >= MAX_CAREER_ARCS) break
    if (staff.castAttributes?.arcId || Object.values(ctx.state.arcs).some(a => readArcSubjectId(a) === staff.id)) continue
    const path = pathFor(staff)
    const day = ctx.state.calendar.totalDaysElapsed
    const arc: TeleologyEntry = { id: `career_${staff.id}`, kind: 'arc', label: `${staff.name.display}: ${path.label}`, stage: 'learning', progress: 0, status: 'active', tags: ['career_arc', `path:${path.id}`, `subject:${staff.id}`], createdAtDay: day, updatedAtDay: day }
    ctx.addArc(arc, meta(arc, `${arc.label} begins with the work they actually do.`))
    if (staff.castAttributes) ctx.modifyStaff(staff.id, { castAttributes: { ...staff.castAttributes, arcId: arc.id } }, meta(arc, `${staff.name.display} has begun a path of their own.`))
    count += 1
  }
}

export function advanceCareerArcs(ctx: SimContext): void {
  const workforce = getStaffModuleState(ctx.state)
  const day = ctx.state.calendar.totalDaysElapsed
  for (const arc of Object.values(ctx.state.arcs)) {
    if (!arc.tags.includes('career_arc') || arc.status !== 'active') continue
    const subjectId = readArcSubjectId(arc)
    const staff = ctx.state.staff[subjectId ?? '']
    if (!staff) {
      ctx.modifyArc(arc.id, { stage: 'departed', status: 'failed', updatedAtDay: day }, meta(arc, `${arc.label} ended when its subject left the workforce. The record remains.`))
      continue
    }
    const path = CAREER_PATHS.find(p => arc.tags.includes(`path:${p.id}`))!
    const row = workforce.roster.find(r => r.staffId === staff.id)
    if (!row?.available || row.contribution <= 0) continue
    const conflict = workforce.relationships.some(e => e.kind === 'coworker' && (e.from.id === staff.id || e.to.id === staff.id) && e.contacts >= 3 && e.affinity <= -30)
    const distressed = staff.stress >= 80 || staff.morale <= 20 || conflict
    if (distressed) {
      if (arc.stage !== 'conflict') ctx.modifyArc(arc.id, { stage: 'conflict', updatedAtDay: day }, meta(arc, `${arc.label} is in conflict: ${conflict ? 'a strained coworker relationship' : 'workload or low morale'} has stopped development. Rest, support or resolve the working relationship to resume.`))
      continue
    }
    if (staff.fatigue > 75) continue
    const supported = workforce.development.some(d => d.staffId === staff.id && ['training', 'promotion', 'raise'].includes(d.kind))
    const progress = Math.min(12, arc.progress + (supported ? 2 : 1))
    const trusted = staff.loyalty >= 55 && staff.morale >= 40
    const mastered = progress >= 12
    const stage = mastered ? (trusted ? 'mentor' : 'steady_hand') : progress >= 5 ? 'finding_a_voice' : 'learning'
    ctx.modifyArc(arc.id, { progress, stage, status: mastered ? 'completed' : 'active', updatedAtDay: day }, meta(arc, mastered
      ? `${staff.name.display} became ${trusted ? 'a mentor others can rely on' : 'a steady hand'} through sustained practice. ${path.benefit}`
      : `${arc.label}: ${supported ? 'owner-backed training' : 'a real working day'} moved development to ${progress}/12${arc.stage === 'conflict' ? '; the conflict has eased' : ''}.`))
    if (mastered) {
      const trait = trusted ? path.reward : `${path.reward}_steady`
      if (!staff.tags.includes(trait)) ctx.modifyStaff(staff.id, { tags: [...staff.tags, trait] }, meta(arc, `${staff.name.display} earned the ${trusted ? path.rewardLabel : 'Steady hand'} working trait.`))
    }
  }
}
