import type { OwnerActionDefinition, OwnerActionApplied } from './types'
import type { SimContext } from '../../core/context'
import { getVentureBlueprint } from '../ventures/ventureCatalog'
import { ventureRecord, writeVentureRecord } from '../ventures/ambitionState'
import { startableVentures, ventureParticipants, ventureStage, ventureWorkQuote } from '../ventures/ambitionQueries'
import { spendCoin } from '../stock/ledger'

const source = 'ownerActions.ventures'
const meta = (id: string, readable: string) => ({ source, sourceType: 'owner_action' as const, readable, tags: ['teleology', 'venture', id] })
function applied(id: string, label: string, targetId: string, minutes: number, effects: string[]): OwnerActionApplied {
  return { actionId: id, label, targetId, timeCost: minutes, effects, data: {} }
}
const reject = (reason: string) => ({ ok: false as const, code: 'venture_unavailable', reason })
const controls = (ctx: SimContext, statuses: string[]) => Object.values(ctx.state.ventures).filter(v => statuses.includes(v.status))

const start: OwnerActionDefinition = {
  id: 'start_venture', label: 'Take up an ambition', category: 'project', targetType: 'composite', timeCost: 30, tags: ['venture'],
  effectsPreview: 'Commit to an offered ambition with a named partner; later work has its own costs.',
  getValidTargets: ctx => startableVentures(ctx.state),
  canApply: (ctx, input) => startableVentures(ctx.state).some(s => s.id === input.targetId) ? { ok: true } : reject('This opening has lapsed, is already committed, or has no available partner.'),
  apply: (ctx, input) => {
    const selected = startableVentures(ctx.state).find(s => s.id === input.targetId)!
    const blueprint = getVentureBlueprint(selected.ventureId)!
    ctx.addVenture(blueprint.createEntry(ctx.state.calendar.totalDaysElapsed), meta(blueprint.id, `Took up ${selected.label}.`))
    writeVentureRecord(ctx, blueprint.id, { ...(selected.participantId ? { participantId: selected.participantId } : {}), blockedDays: 0 })
    return applied(start.id, start.label, input.targetId!, 30, [`Started ${selected.label}.`])
  },
}
const work: OwnerActionDefinition = {
  id: 'work_on_venture', label: 'Work on an ambition', category: 'project', targetType: 'composite', timeCost: 60, tags: ['venture'],
  effectsPreview: 'One invested work session per venture per day. Costs and requirements depend on its current stage.',
  timeCostFor: (state, input) => ventureWorkQuote(state, input.targetId ?? '').option?.minutes ?? 60,
  getValidTargets: ctx => controls(ctx, ['active']).flatMap(v => (ventureStage(ctx.state, v.id)?.options ?? []).map(o => ({
    id: `${v.id}:${o.id}`, label: `${v.label}: ${o.label}`, hint: `${o.coin} coin · ${o.minutes} min${o.material ? ` · ${o.material.quantity} ${o.material.id}` : ''}`,
  }))),
  canApply: (ctx, input) => { const q = ventureWorkQuote(ctx.state, input.targetId ?? ''); return q.blocked ? reject(q.blocked) : { ok: true } },
  apply: (ctx, input) => {
    const { id, option } = ventureWorkQuote(ctx.state, input.targetId!)
    const o = option!
    if (o.coin) spendCoin(ctx, o.coin, { ...meta(id, `${ctx.state.ventures[id]!.label}: ${o.label}.`), category: 'other' })
    if (o.material) {
      const stock = ctx.state.stock[o.material.id]!
      ctx.modifyStock(stock.id, { quantity: stock.quantity - o.material.quantity }, meta(id, `Used ${o.material.quantity} ${stock.label} for ${ctx.state.ventures[id]!.label}.`))
    }
    const entry = ctx.state.ventures[id]!
    ctx.modifyVenture(id, { progress: entry.progress + 1, updatedAtDay: ctx.state.calendar.totalDaysElapsed }, meta(id, `${entry.label}: ${o.label} (${entry.progress + 1}/${ventureStage(ctx.state, id)!.work}).`))
    writeVentureRecord(ctx, id, { lastWorkedDay: ctx.state.calendar.totalDaysElapsed, blockedDays: 0, ...(getVentureBlueprint(id)?.ambition ? { outcome: o.outcome ?? getVentureBlueprint(id)!.ambition!.outcome } : {}) })
    return applied(work.id, work.label, input.targetId!, o.minutes, [`${entry.label}: invested ${o.minutes} min${o.coin ? ` and ${o.coin} coin` : ''}.`])
  },
}
const pause: OwnerActionDefinition = {
  id: 'pause_venture', label: 'Set an ambition aside', category: 'project', targetType: 'composite', timeCost: 0, tags: ['venture'],
  effectsPreview: 'Keep paid progress and stop the inactivity clock.',
  getValidTargets: ctx => controls(ctx, ['active']).map(v => ({ id: v.id, label: v.label })),
  canApply: (ctx, input) => ctx.state.ventures[input.targetId ?? '']?.status === 'active' ? { ok: true } : reject('Only an active venture can be paused.'),
  apply: (ctx, input) => {
    const v = ctx.state.ventures[input.targetId!]!
    ctx.modifyVenture(v.id, { status: 'paused', updatedAtDay: ctx.state.calendar.totalDaysElapsed }, meta(v.id, `${v.label} is paused; invested progress remains.`))
    return applied(pause.id, pause.label, v.id, 0, ['Paused with progress preserved.'])
  },
}
function resumable(ctx: SimContext) {
  return controls(ctx, ['paused', 'failed']).filter(v => !v.tags.includes('abandoned')).flatMap(v => {
    const oldId = ventureRecord(ctx.state, v.id).participantId
    const people = ventureParticipants(ctx.state, v.id)
    // A live partner stays bound. Replacement is offered only after departure.
    const candidates = people.some(p => p.id === oldId) ? people.filter(p => p.id === oldId) : people
    return candidates.map(p => ({ id: p.id ? `${v.id}:${p.id}` : v.id, ventureId: v.id, participantId: p.id, label: `${v.label}${p.id ? ` · ${p.label}` : ''}` }))
  })
}
const resume: OwnerActionDefinition = {
  id: 'resume_venture', label: 'Return to an ambition', category: 'project', targetType: 'composite', timeCost: 30, tags: ['venture'],
  effectsPreview: 'Resume paid progress. If the named partner has left, choose a replacement and re-establish the current stage.',
  getValidTargets: resumable,
  canApply: (ctx, input) => resumable(ctx).some(r => r.id === input.targetId) ? { ok: true } : reject('There is no paused or recoverable venture with that partner.'),
  apply: (ctx, input) => {
    const selected = resumable(ctx).find(r => r.id === input.targetId)!
    const record = ventureRecord(ctx.state, selected.ventureId)
    const entry = ctx.state.ventures[selected.ventureId]!
    const replaced = selected.participantId !== record.participantId
    ctx.modifyVenture(entry.id, { status: 'active', ...(replaced ? { progress: 0 } : {}), updatedAtDay: ctx.state.calendar.totalDaysElapsed }, meta(entry.id, `${selected.label} resumes${replaced ? ' with a new partner; this stage must be established again' : ' with its progress intact'}.`))
    writeVentureRecord(ctx, entry.id, { ...(selected.participantId ? { participantId: selected.participantId } : {}), blockedDays: 0, attempts: record.attempts + 1 })
    return applied(resume.id, resume.label, input.targetId!, 30, ['The ambition is active again.'])
  },
}
const abandon: OwnerActionDefinition = {
  id: 'abandon_venture', label: 'Abandon an ambition', category: 'project', targetType: 'composite', timeCost: 0, tags: ['venture'],
  effectsPreview: 'End this venture permanently. Coin, time and materials already spent are not refunded.',
  getValidTargets: ctx => controls(ctx, ['active', 'paused']).map(v => ({ id: v.id, label: v.label })),
  canApply: (ctx, input) => ['active', 'paused'].includes(ctx.state.ventures[input.targetId ?? '']?.status ?? '') ? { ok: true } : reject('This ambition has already ended.'),
  apply: (ctx, input) => {
    const v = ctx.state.ventures[input.targetId!]!
    ctx.modifyVenture(v.id, { status: 'failed', tags: [...v.tags, 'abandoned'], updatedAtDay: ctx.state.calendar.totalDaysElapsed }, meta(v.id, `${v.label} was abandoned. Its costs remain spent.`))
    return applied(abandon.id, abandon.label, v.id, 0, ['Permanently abandoned.'])
  },
}
export const VENTURE_ACTIONS: OwnerActionDefinition[] = [start, work, pause, resume, abandon]
