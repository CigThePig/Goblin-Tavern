import { isOnDuty } from '../staff/workforceTypes'
import type { TavernState } from '../../state/TavernState'
import type { VentureOption, VentureRequirement, VentureStage } from './ambitionTypes'
import { getVentureBlueprint, allVentureBlueprints } from './ventureCatalog'
import { ventureRecord } from './ambitionState'
import { getSupplierModuleState } from '../suppliers/state'
import { getEconomyModuleState } from '../economy/state'

import type { OpeningsModuleState } from '../openings/types'

export function ventureParticipants(state: TavernState, id: string): { id?: string; label: string }[] {
  const kind = getVentureBlueprint(id)?.ambition?.participant
  if (!kind) return [{ label: 'The tavern' }]
  if (kind === 'staff') return Object.values(state.staff).filter(s => /cook|chef|kitchen/.test(s.role))
    .map(s => ({ id: s.id, label: s.name.display })).sort((a,b) => a.id.localeCompare(b.id))
  const records = kind === 'supplier' ? state.world.suppliers : kind === 'faction' ? state.world.factions : state.world.cultures
  return Object.values(records).map(s => ({ id: s.id, label: s.label })).sort((a,b) => a.id.localeCompare(b.id))
}
export function participantLabel(state: TavernState, id: string): string | undefined {
  const participant = ventureRecord(state, id).participantId
  return ventureParticipants(state, id).find(p => p.id === participant)?.label
}
export function ventureStage(state: TavernState, id: string): VentureStage | undefined {
  if (id === 'venture_liquor_license') return {
    id: 'paperwork', label: 'Licence paperwork', description: 'File the paperwork with the magistrate.', work: 2,
    requirements: [], options: [{ id: 'invest', label: 'Work on the paperwork', coin: 0, minutes: 60 }],
  }
  const entry = state.ventures[id]
  return getVentureBlueprint(id)?.ambition?.stages.find(s => s.id === entry?.stage)
}
export function requirementBlocker(state: TavernState, id: string, requirement: VentureRequirement): string | undefined {
  const target = ventureRecord(state, id).participantId
  const plan = getVentureBlueprint(id)?.ambition
  switch (requirement.kind) {
    case 'upgrade': return state.areas[requirement.areaId]?.upgrades[requirement.upgradeId]?.status === 'installed' ? undefined : `Install or repair ${requirement.label}.`
    case 'deliveries': {
      const count = target ? getSupplierModuleState(state).accounts[target]?.history.ordersDelivered ?? 0 : 0
      return count >= requirement.count ? undefined : `Receive ${requirement.count} orders from this supplier (${count} received).`
    }
    case 'relationship': {
      const person = plan?.participant === 'supplier' ? state.world.suppliers[target ?? ''] : state.world.factions[target ?? '']
      return person && person.relationship >= requirement.minimum ? undefined : `Build this ${plan?.participant ?? 'partner'} relationship to ${requirement.minimum} (${person?.relationship ?? 0} now).`
    }
    case 'staff_ready': {
      const staff = state.staff[target ?? '']
      if (!staff) return 'The cook who led this venture has left; choose a new lead when resuming.'
      if (!isOnDuty(staff) || staff.fatigue > 70 || staff.stress > 75) return 'Give the cook a working shift and time to recover below 70 fatigue and 75 stress.'
      return undefined
    }
    case 'culture_comfort': {
      const culture = state.world.cultures[target ?? '']
      return culture && culture.comfort >= requirement.minimum ? undefined : `Raise this culture’s comfort to ${requirement.minimum} (${Math.round(culture?.comfort ?? 0)} now).`
    }
    case 'solvent': {
      const financial = getEconomyModuleState(state).financial
      return state.coin >= 100 && financial.operatingArrears === 0 && financial.restructuringBalance === 0 && ['stable', 'recovering'].includes(financial.status)
        ? undefined : 'Reopen, clear operating arrears and the restructuring balance, and keep 100 coin in reserve.'
    }
    case 'trading': return ['temporarily_closed', 'insolvent', 'restructuring'].includes(getEconomyModuleState(state).financial.status)
      ? 'Reopen a viable trading house first.' : undefined
  }
}
export function ventureBlockers(state: TavernState, id: string): string[] {
  const stage = ventureStage(state, id)
  const kind = getVentureBlueprint(id)?.ambition?.participant
  const participant = ventureRecord(state, id).participantId
  if (kind && !ventureParticipants(state, id).some(p => p.id === participant)) return ['The named partner is no longer available. Pause and resume with a replacement.']
  return stage?.requirements.flatMap(r => { const b = requirementBlocker(state, id, r); return b ? [b] : [] }) ?? ['This venture has no active work stage.']
}
export function startableVentures(state: TavernState): { id: string; ventureId: string; participantId?: string; label: string }[] {
  const openings = (state.modules.openings as OpeningsModuleState | undefined)?.openings ?? {}
  return allVentureBlueprints().flatMap(blueprint => {
    if (state.ventures[blueprint.id]) return []
    if (!Object.values(openings).some(o => o.blueprintId === blueprint.id && o.status === 'active' && state.calendar.totalDaysElapsed <= o.expiresAtDay)) return []
    return ventureParticipants(state, blueprint.id).map(p => ({
      id: p.id ? `${blueprint.id}:${p.id}` : blueprint.id, ventureId: blueprint.id,
      ...(p.id ? { participantId: p.id } : {}), label: `${blueprint.label}${p.id ? ` · ${p.label}` : ''}`,
    }))
  })
}
export function ventureWorkQuote(state: TavernState, target: string): { id: string; option?: VentureOption; blocked?: string } {
  const index = target.lastIndexOf(':')
  const id = index < 0 ? target : target.slice(0, index)
  const optionId = index < 0 ? 'invest' : target.slice(index + 1)
  const entry = state.ventures[id]
  const option = ventureStage(state, id)?.options.find(o => o.id === optionId)
  const fail = (blocked: string) => ({ id, ...(option ? { option } : {}), blocked })
  if (!entry || entry.status !== 'active') return fail('Start or resume this venture first.')
  if (!option) return fail('This work option is not available at the current stage.')
  if (ventureRecord(state, id).lastWorkedDay === state.calendar.totalDaysElapsed) return fail('You have already worked on this venture today.')
  if (entry.progress >= (ventureStage(state, id)?.work ?? 0)) return fail('This stage is funded; it will be reviewed at closing.')
  const blocked = ventureBlockers(state, id)[0]
  if (blocked) return fail(blocked)
  if (state.coin < option.coin) return fail(`Needs ${option.coin} coin (${Math.floor(state.coin)} available).`)
  if (option.material && (state.stock[option.material.id]?.quantity ?? 0) < option.material.quantity) return fail(`Needs ${option.material.quantity} ${option.material.id} in stock.`)
  return { id, option }
}
