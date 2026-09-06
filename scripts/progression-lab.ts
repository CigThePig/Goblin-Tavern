/** Reproducible progression playthrough. Never injects ventures, milestones or rumours.
 * npm run progression:lab -- --days=28 --goal=venture_supplier_compact --json
 */
import { advanceDaySegment } from '../src/sim/core/engine'
import { FULL_PIPELINE } from '../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../src/sim/state/defaults'
import { actionRegistry } from '../src/sim/registries/actionRegistry'
import { makeReadOnlyCtx, timeCostOf } from '../src/sim/modules/ownerActions/readonlyHelpers'
import type { OwnerActionInput } from '../src/sim/modules/ownerActions/types'
import { getOwnerActionsModuleState } from '../src/sim/modules/ownerActions/stateHelpers'
import { getServiceModuleState } from '../src/sim/modules/service/serviceModule'
import { startableVentures, ventureStage } from '../src/sim/modules/ventures/ambitionQueries'
import { ventureRecord } from '../src/sim/modules/ventures/ambitionState'
import { buildAmbitionsOverview } from '../src/reports/ambitionsOverview'
import { getEconomyModuleState } from '../src/sim/modules/economy/state'
import { safeValidateState } from '../src/sim/state/validation'
import { pathToFileURL } from 'node:url'
import { quoteAreaUpgrade } from '../src/sim/modules/areas/quote'
import { getVentureBlueprint } from '../src/sim/modules/ventures/ventureCatalog'

export function runProgressionLab(days = 28, seed = 'progression-lab', goal = 'venture_liquor_license', terms: 'mutual' | 'exclusive' = 'mutual') {
  if (!Number.isInteger(days) || days < 1 || days > 196) throw new Error('days must be an integer between 1 and 196')
  if (!getVentureBlueprint(goal)) throw new Error(`Unknown ambition: ${goal}`)
  let state = createInitialTavernState()
  const trace: { day: number; coin: number; patrons: number; status: string; stage?: string; actions: string[]; rejected: string[]; nicknames: string[] }[] = []
  for (let day = 0; day < days; day++) {
    const baseline = state
    const input = { seed: `${seed}:${day}` }
    const morning = advanceDaySegment(state, input, FULL_PIPELINE, 'A').state
    const actions: OwnerActionInput[] = []
    let minutes = 0
    const choose = (input: OwnerActionInput) => {
      const def = actionRegistry.get(input.actionId)
      const cost = timeCostOf(def, morning, input)
      if (minutes + cost > 360 || !def.canApply(makeReadOnlyCtx(morning), input).ok) return
      if (actions.some(a => a.actionId === input.actionId && a.targetId === input.targetId)) return
      actions.push(input); minutes += cost
    }
    const candidates = startableVentures(morning).filter(s => s.ventureId === goal)
    if (goal === 'venture_shared_table') candidates.sort((a,b) => (morning.world.cultures[b.participantId ?? '']?.comfort ?? 0) - (morning.world.cultures[a.participantId ?? '']?.comfort ?? 0))
    const start = candidates[0]
    if (start) choose({ actionId: 'start_venture', targetId: start.id })
    const entry = morning.ventures[goal]
    if (entry?.status === 'active') {
      choose({ actionId: 'work_on_venture', targetId: `${goal}:${goal === 'venture_supplier_compact' && entry.stage === 'prove' && terms === 'exclusive' ? 'exclusive' : 'invest'}` })
      for (const requirement of ventureStage(morning, goal)?.requirements ?? []) {
        if (requirement.kind === 'upgrade') {
          const quote = quoteAreaUpgrade(morning, requirement.areaId, requirement.upgradeId, { startMinutes: actionRegistry.get('start_area_upgrade').timeCost, fundMinutes: actionRegistry.get('fund_area_upgrade').timeCost })
          for (const line of quote?.materials ?? []) if (line.held < line.required) choose({ actionId: 'restock_item', targetId: line.stockId, amount: line.required - line.held })
          choose({ actionId: 'start_area_upgrade', targetId: `${requirement.areaId}:${requirement.upgradeId}` })
        }
        const person = ventureRecord(morning, goal).participantId
        if (requirement.kind === 'relationship' && person) choose({ actionId: goal === 'venture_supplier_compact' ? 'negotiate_with_supplier' : 'host_faction_night', targetId: person })
        if (requirement.kind === 'deliveries' && person) {
          const supplier = morning.world.suppliers[person]
          const good = supplier?.goodsProvided[0]
          if (good) choose({ actionId: 'place_supplier_order', targetId: `${person}:${good}`, amount: 10 })
        }
        if (requirement.kind === 'culture_comfort' && person) {
          choose({ actionId: 'make_amends_to_culture', targetId: person })
          choose({ actionId: 'mark_culture_observance', targetId: person })
        }
      }
    }
    const tired = Object.values(morning.staff).sort((a,b) => b.stress - a.stress)[0]
    if (tired && tired.stress > 40) choose({ actionId: 'comfort_stressed_staff', targetId: tired.id })
    for (const id of ['ale','ingredients','stew','firewood','mugs']) if ((morning.stock[id]?.quantity ?? 100) < 30) choose({ actionId: 'restock_item', targetId: id, amount: 20 })
    const dirty = Object.values(morning.areas).sort((a,b) => a.cleanliness - b.cleanliness)[0]
    if (dirty && dirty.cleanliness < 60) choose({ actionId: 'clean_area', targetId: dirty.id })
    const afterB = advanceDaySegment(morning, { ...input, ownerActions: actions }, FULL_PIPELINE, 'B', { dayBaseline: baseline }).state
    const result = advanceDaySegment(afterB, input, FULL_PIPELINE, 'C', { dayBaseline: baseline })
    state = result.state
    const validation = safeValidateState(state, { modules: FULL_PIPELINE })
    if (!validation.success) throw new Error(`Day ${day + 1}: ${validation.errors.map(e => `${e.path}: ${e.message}`).join('; ')}`)
    const overview = buildAmbitionsOverview(state)
    trace.push({ day: day + 1, coin: Math.round(state.coin), patrons: Object.values(getServiceModuleState(state).result.trafficByGroup).reduce((a,b) => a+b,0), status: getEconomyModuleState(state).financial.status, ...(state.ventures[goal] ? { stage: `${state.ventures[goal]!.stage}:${state.ventures[goal]!.progress}` } : {}), actions: actions.map(a => `${a.actionId}${a.targetId ? `:${a.targetId}` : ''}`), rejected: getOwnerActionsModuleState(state).rejected.map(r => r.reason), nicknames: overview.nicknames.map(n => n.label) })
  }
  return { seed, days, goal, terms, trace, overview: buildAmbitionsOverview(state), state }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const read = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=')
  const days = Number(read('days') ?? 28)
  if (!Number.isInteger(days) || days < 1 || days > 196) throw new Error('--days must be an integer between 1 and 196')
  const terms = read('terms') ?? 'mutual'
  if (terms !== 'mutual' && terms !== 'exclusive') throw new Error('--terms must be mutual or exclusive')
  const result = runProgressionLab(days, read('seed') ?? 'progression-lab', read('goal') ?? 'venture_liquor_license', terms)
  if (args.includes('--json')) console.log(JSON.stringify({ ...result, state: undefined }, null, 2))
  else {
    for (const day of result.trace) console.log(`Day ${day.day}: ${day.coin} coin · ${day.patrons} patrons · ${day.status} · ${day.stage ?? 'not started'}${day.rejected.length ? ` · ${day.rejected.length} rejected actions` : ''}`)
    for (const venture of result.overview.rows) console.log(`${venture.label}: ${venture.statusLabel}${venture.blockers.length ? ` — ${venture.blockers.join(' ')}` : ''}`)
    console.log(`Nicknames: ${result.overview.nicknames.map(n => n.label).join(', ') || 'none earned'}`)
  }
}
