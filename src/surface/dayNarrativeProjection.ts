import type { SimResult } from '../sim/core/result'
import type { StateChange } from '../sim/core/diff'
import type { DailyServiceResult } from '../sim/modules/service/types'
import type { OwnerActionApplied } from '../sim/modules/ownerActions/types'
import type { ResolvedIntentRecord } from '../sim/modules/responses/types'
import type { TavernState, MemoryState } from '../sim/state/TavernState'
import type { PressureSnapshot } from '../sim/modules/pressures/pressureTypes'
import { closedDayAbsolute } from '../reports/causeLookup'
import { humanizeId } from '../reports/labels/idLabel'
import { projectMissedOpportunities } from '../reports/missedOpportunityProjection'
import { addSurfaceFact, dedupeSurfaceFacts, evidenceRef } from './evidence'
import type { SurfaceFact } from './types'

export type DayNarrativeMovementId =
  | 'opening'
  | 'service'
  | 'reckoning'
  | 'aftermath'

export type DayNarrativeMovement = {
  id: DayNarrativeMovementId
  title: string
  facts: SurfaceFact[]
  summary?: string
}

export type DayNarrative = {
  movements: DayNarrativeMovement[]
}

export function buildDayNarrative(input: {
  result: SimResult
  state: TavernState
  closedDay: number
}): DayNarrative {
  const opening = buildOpeningFacts(input.result)
  const service = buildServiceFacts(input.result)
  const reckoning = buildReckoningFacts(input.result, input.state, input.closedDay)
  const aftermath = buildAftermathFacts(input.result, input.state, input.closedDay)

  const movements: DayNarrativeMovement[] = [
    movement('opening', 'Opening', opening),
    movement('service', 'Service', service),
    movement('reckoning', 'Reckoning', reckoning),
    movement('aftermath', 'Aftermath', aftermath),
  ]

  const hasFacts = movements.some((m) => m.facts.length > 0)
  if (!hasFacts) {
    return {
      movements: movements.map((m) => ({
        ...m,
        summary: gentleSummary(m.id),
      })),
    }
  }
  return { movements }
}

function buildOpeningFacts(result: SimResult): SurfaceFact[] {
  const facts: SurfaceFact[] = []
  const applied = ownerActions(result)
  for (const action of applied) {
    addSurfaceFact(facts, {
      id: `day:opening:owner-action:${action.actionId}:${action.targetId ?? 'global'}`,
      kind: 'player_action',
      readable: action.targetId
        ? `${action.label} (${action.targetId}).`
        : `${action.label}.`,
      evidence: [
        evidenceRef('owner_action', {
          id: action.actionId,
          ...(action.targetId ? { path: action.targetId } : {}),
          readable: action.label,
        }),
      ],
      salience: Math.max(10, action.timeCost * 10),
      toneTags: ['owner_action'],
      ...(action.targetId ? { target: action.targetId } : {}),
    })
  }
  for (const pressure of pressureSnapshots(result)) {
    if (pressure.previousValue <= 0 && pressure.value <= 0) continue
    addSurfaceFact(facts, {
      id: `day:opening:pressure:${pressure.id}`,
      kind: 'pressure',
      readable: `${pressure.label} opened at ${pressure.value}.`,
      evidence: [
        evidenceRef('pressure_snapshot', {
          id: String(pressure.id),
          path: `pressures.${pressure.id}.value`,
          readable: pressure.label,
        }),
      ],
      salience: pressure.severity,
      toneTags: ['opening_pressure', pressure.trend, ...pressure.tags],
      target: `pressure:${pressure.id}`,
    })
  }
  return dedupeSurfaceFacts(facts).sort(bySalienceThenId).slice(0, 8)
}

function buildServiceFacts(result: SimResult): SurfaceFact[] {
  const facts: SurfaceFact[] = []
  const serviceResult = serviceResultFrom(result)
  if (!serviceResult) return facts

  const trafficTotal = Object.values(serviceResult.trafficByGroup ?? {}).reduce(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0,
  )
  if (trafficTotal > 0) {
    addSurfaceFact(facts, {
      id: 'day:service:traffic-total',
      kind: 'state_change',
      readable: `${trafficTotal} patrons came through service.`,
      evidence: [
        evidenceRef('report_projection', {
          id: 'service',
          path: 'result.trafficByGroup',
        }),
      ],
      salience: Math.min(100, trafficTotal),
      toneTags: ['traffic'],
      target: 'service.traffic',
    })
  }
  if (serviceResult.netCoinEarned !== undefined && serviceResult.netCoinEarned !== 0) {
    addSurfaceFact(facts, {
      id: 'day:service:net-coin',
      kind: 'state_change',
      readable: `Service changed coin by ${formatDelta(serviceResult.netCoinEarned)}.`,
      evidence: [evidenceRef('report_projection', { id: 'service', path: 'result.netCoinEarned' })],
      salience: Math.min(100, Math.abs(serviceResult.netCoinEarned)),
      toneTags: ['coin'],
      target: 'coin',
    })
  }
  for (const [index, incident] of (serviceResult.incidents ?? []).entries()) {
    const inc = incident as { readable?: string; id?: string; kind?: string; type?: string }
    // Humanize the machine id (`chair_damage` → "chair damage"); skip
    // incidents with no usable identity rather than printing "Incident:
    // event".
    const rawKind = inc.kind ?? inc.type ?? inc.id
    const readable = inc.readable
      ?? (rawKind ? `Incident: ${humanizeId(rawKind).toLowerCase()}.` : undefined)
    if (!readable) continue
    addSurfaceFact(facts, {
      id: `day:service:incident:${index}`,
      kind: 'consequence',
      readable,
      evidence: [evidenceRef('report_projection', { id: 'service', path: `result.incidents.${index}`, readable })],
      salience: 65,
      toneTags: ['incident'],
    })
  }
  return dedupeSurfaceFacts(facts).sort(bySalienceThenId).slice(0, 8)
}

function buildReckoningFacts(
  result: SimResult,
  state: TavernState,
  closedDay: number,
): SurfaceFact[] {
  const facts: SurfaceFact[] = []
  for (const intent of resolvedIntents(state)) {
    addSurfaceFact(facts, {
      id: `day:reckoning:intent:${intent.intentId}`,
      kind: 'player_action',
      readable: `${intent.verb} answered ${intent.seedId}.`,
      evidence: [
        evidenceRef('resolved_intent', {
          id: intent.intentId,
          path: intent.seedId,
        }),
      ],
      salience: 70,
      toneTags: ['resolved_intent', intent.verb],
      target: intent.seedId,
    })
  }

  for (const change of negativeSignificantDiffs(result)) {
    addSurfaceFact(facts, {
      id: `day:reckoning:negative-diff:${change.path}`,
      kind: 'consequence',
      readable: change.readable,
      evidence: [evidenceRef('state_diff', { path: change.path, readable: change.readable })],
      salience: Math.min(100, Math.abs(change.delta ?? 0)),
      toneTags: [...change.tags, 'negative_diff'],
      target: change.path,
    })
  }

  for (const miss of projectMissedOpportunities(result, state, { closedDay })) {
    addSurfaceFact(facts, {
      id: `day:reckoning:missed:${miss.id}`,
      kind: 'missed_opportunity',
      readable: miss.readable,
      evidence: [
        evidenceRef('report_projection', {
          id: miss.id,
          ...(miss.diffPath ?? miss.pressureId ?? miss.seedId
            ? { path: miss.diffPath ?? miss.pressureId ?? miss.seedId }
            : {}),
          readable: miss.readable,
        }),
      ],
      salience: miss.impact,
      toneTags: ['missed_opportunity', miss.kind],
      ...(miss.targetRef ? { subject: miss.targetRef } : {}),
      ...(miss.diffPath ?? miss.pressureId ?? miss.seedId
        ? { target: miss.diffPath ?? miss.pressureId ?? miss.seedId }
        : {}),
    })
  }

  for (const pressure of pressureSnapshots(result).filter((p) => p.delta > 0)) {
    addSurfaceFact(facts, {
      id: `day:reckoning:rising-pressure:${pressure.id}`,
      kind: 'trend',
      readable: `${pressure.label} rose by ${pressure.delta}.`,
      evidence: [
        evidenceRef('pressure_snapshot', {
          id: String(pressure.id),
          path: `pressures.${pressure.id}.value`,
          readable: pressure.label,
        }),
      ],
      salience: Math.min(100, pressure.severity + Math.abs(pressure.delta)),
      toneTags: ['rising_pressure', ...pressure.tags],
      target: `pressure:${pressure.id}`,
    })
  }
  return dedupeSurfaceFacts(facts).sort(bySalienceThenId).slice(0, 10)
}

function buildAftermathFacts(
  result: SimResult,
  state: TavernState,
  closedDay: number,
): SurfaceFact[] {
  const facts: SurfaceFact[] = []
  for (const memory of state.memories.filter((m) => m.createdAt.absoluteDay === closedDay)) {
    const readable = humanizeMemory(memory)
    addSurfaceFact(facts, {
      id: `day:aftermath:memory:${memory.id}`,
      kind: memory.type === 'future_hook' ? 'consequence' : 'memory',
      readable,
      evidence: [evidenceRef(memory.type === 'future_hook' ? 'future_hook' : 'memory', { id: memory.id, readable })],
      salience: memory.type === 'future_hook' ? 70 : 50,
      toneTags: [memory.type, ...memory.tags],
      ...(memory.actors[0] ? { subject: memory.actors[0] } : {}),
      ...(memory.locations[0] ? { target: `${memory.locations[0].kind}:${memory.locations[0].id}` } : {}),
    })
  }
  for (const change of digestWorthChanges(result)) {
    addSurfaceFact(facts, {
      id: `day:aftermath:diff:${change.path}`,
      kind: 'state_change',
      readable: change.readable,
      evidence: [evidenceRef('state_diff', { path: change.path, readable: change.readable })],
      salience: Math.min(100, Math.abs(change.delta ?? 0)),
      toneTags: [...change.tags, 'digest_change'],
      target: change.path,
    })
  }
  for (const pressure of pressureSnapshots(result).filter((p) => p.value >= 25)) {
    addSurfaceFact(facts, {
      id: `day:aftermath:recurring-pressure:${pressure.id}`,
      kind: 'pressure',
      readable: `${pressure.label} remains at ${pressure.value}.`,
      evidence: [evidenceRef('pressure_snapshot', { id: String(pressure.id), path: `pressures.${pressure.id}.value`, readable: pressure.label })],
      salience: pressure.value,
      toneTags: ['recurring_pressure', pressure.trend, ...pressure.tags],
      target: `pressure:${pressure.id}`,
    })
  }
  return dedupeSurfaceFacts(facts).sort(bySalienceThenId).slice(0, 10)
}

function movement(
  id: DayNarrativeMovementId,
  title: string,
  facts: SurfaceFact[],
): DayNarrativeMovement {
  return { id, title, facts }
}

function gentleSummary(id: DayNarrativeMovementId): string {
  switch (id) {
    case 'opening':
      return 'No opening facts stood out.'
    case 'service':
      return 'Service left no structured facts to surface.'
    case 'reckoning':
      return 'No decisions or consequences needed reckoning.'
    case 'aftermath':
      return 'No new memories or hooks were recorded.'
  }
}

function ownerActions(result: SimResult): OwnerActionApplied[] {
  const section = result.reports.find((r) => r.id === 'ownerActions')
  return (section?.data?.['applied'] as OwnerActionApplied[] | undefined) ?? []
}

function serviceResultFrom(result: SimResult): DailyServiceResult | undefined {
  const section = result.reports.find((r) => r.id === 'service')
  return section?.data?.['result'] as DailyServiceResult | undefined
}

function pressureSnapshots(result: SimResult): PressureSnapshot[] {
  const section = result.reports.find((r) => r.id === 'pressures')
  return ((section?.data?.['snapshots'] as PressureSnapshot[] | undefined) ?? []).slice()
}

function resolvedIntents(state: TavernState): ResolvedIntentRecord[] {
  const slice = state.modules['responses'] as
    | { resolvedToday?: ResolvedIntentRecord[] }
    | undefined
  return (slice?.resolvedToday ?? []).slice()
}

function dayDiffChanges(result: SimResult): StateChange[] {
  return result.diffs.find((d) => d.boundary === 'day')?.significantChanges ?? []
}

function negativeSignificantDiffs(result: SimResult): StateChange[] {
  return dayDiffChanges(result).filter((change) => (change.delta ?? 0) < 0)
}

function digestWorthChanges(result: SimResult): StateChange[] {
  return dayDiffChanges(result).filter((change) => Math.abs(change.delta ?? 0) >= 10)
}

function humanizeMemory(memory: MemoryState): string {
  return memory.label ?? memory.definitionId ?? memory.id
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function bySalienceThenId(a: SurfaceFact, b: SurfaceFact): number {
  if (b.salience !== a.salience) return b.salience - a.salience
  return a.id.localeCompare(b.id)
}

export { closedDayAbsolute }
