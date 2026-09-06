import type { TavernState } from '../sim/state/TavernState'
import { allVentureBlueprints } from '../sim/modules/ventures/ventureCatalog'
import { participantLabel, startableVentures, ventureBlockers, ventureStage, ventureWorkQuote } from '../sim/modules/ventures/ambitionQueries'
import { ventureRecord } from '../sim/modules/ventures/ambitionState'
import { identityEvidence, NICKNAME_PUBLIC_DAYS } from '../sim/modules/tavernIdentity/evidence'
import type { OpeningsModuleState } from '../sim/modules/openings/types'
import { actionRegistry } from '../sim/registries/actionRegistry'
import { makeReadOnlyCtx, timeCostOf } from '../sim/modules/ownerActions/readonlyHelpers'

export type AmbitionControl = { actionId: string; targetId: string; label: string; minutes: number; coin: number; material?: string; blocked?: string }
export type AmbitionView = {
  id: string; label: string; summary: string; status: string; statusLabel: string;
  stageLabel: string; description: string; progress: number; required: number;
  stages: { label: string; current: boolean; complete: boolean }[];
  partner?: string; benefit: string; blockers: string[]; controls: AmbitionControl[];
  starts: { id: string; label: string }[]; outcome?: string;
}
export function buildAmbitionsOverview(state: TavernState) {
  const ctx = makeReadOnlyCtx(state)
  const starts = startableVentures(state)
  const openings = Object.values((state.modules.openings as OpeningsModuleState | undefined)?.openings ?? {})
  const rows: AmbitionView[] = allVentureBlueprints().map(blueprint => {
    const entry = state.ventures[blueprint.id]
    const opening = openings.find(o => o.blueprintId === blueprint.id)
    const stage = ventureStage(state, blueprint.id)
    const available = starts.filter(s => s.ventureId === blueprint.id)
    const status = entry ? entry.tags.includes('abandoned') ? 'abandoned' : entry.status : available.length ? 'available' : opening?.status === 'active' ? (state.calendar.totalDaysElapsed > opening.expiresAtDay ? 'parked' : 'blocked_opening') : opening?.status ?? 'locked'
    const statusLabel = ({ active: 'Underway', available: 'An opening', blocked_opening: 'No available partner', paused: 'Set aside', failed: 'Setback', completed: 'Established', abandoned: 'Abandoned', parked: 'Lapsed opening', dead: 'Opportunity passed', locked: 'Not yet offered' } as Record<string,string>)[status] ?? status
    const controls: AmbitionControl[] = []
    if (entry) for (const actionId of ['work_on_venture', 'pause_venture', 'resume_venture', 'abandon_venture']) {
      const def = actionRegistry.get(actionId)
      for (const target of def.getValidTargets(ctx).filter(t => t.id === entry.id || t.id.startsWith(`${entry.id}:`))) {
        const input = { actionId, targetId: target.id }
        const check = def.canApply(ctx, input)
        const work = actionId === 'work_on_venture' ? ventureWorkQuote(state, target.id).option : undefined
        controls.push({ actionId, targetId: target.id, label: work?.label ?? (actionId === 'resume_venture' && target.id.includes(':') ? `Resume · ${target.label.split(' · ').slice(1).join(' · ')}` : def.label), minutes: timeCostOf(def, state, input), coin: work?.coin ?? 0, ...(work?.material ? { material: `${work.material.quantity} ${work.material.id}` } : {}), ...(!check.ok ? { blocked: check.reason } : {}) })
      }
    }
    const stages = blueprint.ambition?.stages ?? [{ id: 'paperwork', label: 'Licence paperwork' }]
    const index = stages.findIndex(s => s.id === entry?.stage)
    const partner = entry ? participantLabel(state, entry.id) : undefined
    const record = entry ? ventureRecord(state, entry.id) : undefined
    const outcome = record?.outcome === 'supplier_exclusive' ? 'Exclusive terms selected' : record?.outcome === 'supplier_compact' ? 'Mutual terms selected' : undefined
    let description = stage?.description ?? blueprint.opening.establishingLine
    if (!entry) {
      if (status === 'parked') description = 'This opening lapsed. A change in the house’s standing may bring it back.'
      else if (status === 'dead') description = 'Its return window ended. Other ambitions remain possible.'
      else if (status === 'blocked_opening') description = 'This opening needs an available partner. Recruit the relevant staff or check the world roster.'
      else if (status === 'locked') description = blueprint.ambition && state.calendar.totalDaysElapsed < blueprint.ambition.unlockDay ? `Can be offered from day ${blueprint.ambition.unlockDay + 1}.` : 'This opening needs a relevant change in the tavern’s circumstances.'
      else if (opening) description = `Take it up by day ${opening.expiresAtDay + 1}. ${blueprint.opening.establishingLine}`
    }
    return { id: blueprint.id, label: blueprint.label, summary: blueprint.ambition?.summary ?? blueprint.opening.establishingLine, status, statusLabel,
      stageLabel: stage?.label ?? statusLabel, description, progress: entry?.progress ?? 0, required: stage?.work ?? 0,
      stages: stages.map((s,i) => ({ label: s.label, current: entry?.stage === s.id && entry.status !== 'completed', complete: entry?.status === 'completed' || (index >= 0 && i < index) })),
      ...(partner ? { partner } : {}), benefit: blueprint.ambition?.benefit ?? 'Unlocks licensed liquor service permanently.',
      blockers: entry && entry.status === 'active' ? ventureBlockers(state, entry.id) : [], controls, starts: available.map(s => ({ id: s.id, label: s.label })),
      ...(outcome ? { outcome } : {}),
    }
  })
  const order = ['active','available','blocked_opening','paused','failed','completed','parked','locked','dead','abandoned']
  rows.sort((a,b) => order.indexOf(a.status) - order.indexOf(b.status))
  const evidence = Object.values(identityEvidence(state).evidence).filter(e => e.kind === 'knownFor' && e.strength > 1)
    .sort((a,b) => b.publicDays - a.publicDays || b.strength - a.strength || a.label.localeCompare(b.label))
  const nicknames = Object.values(state.world.socialRumours).filter(r => r.tags.includes('nickname') && r.accuracy !== 'false' && r.correctedOnDay === undefined && r.strength >= 20).sort((a,b) => b.strength - a.strength).slice(0,3)
    .map(r => ({ label: r.label, source: state.customerGroups[r.sourceEntityId ?? '']?.label ?? 'Local voices', strength: Math.round(r.strength) }))
  return { rows, evidence, nicknames, nicknameDays: NICKNAME_PUBLIC_DAYS,
    arcs: Object.values(state.arcs).map(a => ({ ...a, stageLabel: a.stage.replaceAll('_',' '), reason: state.causes.filter(c => c.tags.includes(a.id) && c.tags.includes('arc')).at(-1)?.readable })),
    activeCount: rows.filter(r => r.status === 'active').length, availableCount: rows.filter(r => r.status === 'available').length,
  }
}
