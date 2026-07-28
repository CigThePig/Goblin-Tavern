import type {
  IssueSeed,
  SeedContinuity,
} from '../sim/modules/issues/issueSeedTypes'
import type { PressureSnapshot } from '../sim/modules/pressures/pressureTypes'
import type { TavernState } from '../sim/state/TavernState'
import { buildPressureConsequenceLine } from '../reports/pressureConsequenceLine'
import {
  addSurfaceFact,
  dedupeSurfaceFacts,
  evidenceRef,
} from './evidence'
import type { SurfaceFact } from './types'

export function projectSurfaceFactsForSeed(
  seed: IssueSeed,
  state: TavernState,
): SurfaceFact[] {
  const facts: SurfaceFact[] = []
  const subject = seed.primaryActor ?? seed.location

  const pressures = seed.pressures
    .slice()
    .sort((a, b) => pressureScore(b) - pressureScore(a))
  for (const pressure of pressures) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:pressure:${pressure.id}`,
      kind: 'pressure',
      readable: readablePressureLine(pressure),
      evidence: [
        evidenceRef('pressure_snapshot', {
          id: String(pressure.id),
          readable: pressure.label,
        }),
      ],
      salience: pressureScore(pressure),
      toneTags: [...pressure.tags, pressure.trend],
      ...(subject ? { subject } : {}),
      target: `pressure:${pressure.id}`,
    })
  }

  addThresholdFact(facts, seed, 'severity', seed.severity)
  addThresholdFact(facts, seed, 'urgency', seed.urgency)
  addThresholdFact(facts, seed, 'cardWorthiness', seed.cardWorthiness)

  for (const fragment of seed.textIngredients.pressureContext ?? []) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:pressure-context:${stableKey(fragment)}`,
      kind: 'trigger',
      readable: fragment,
      evidence: [
        evidenceRef('issue_seed', {
          id: seed.id,
          path: 'textIngredients.pressureContext',
          readable: fragment,
        }),
      ],
      salience: Math.max(seed.urgency, seed.severity),
      toneTags: ['pressure_context', ...seed.toneHints],
      ...(subject ? { subject } : {}),
    })
  }

  if (!facts.some((fact) => fact.kind === 'pressure' || fact.kind === 'trigger')) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:fallback-trigger`,
      kind: 'trigger',
      readable: `${humanizeFamily(seed.family)} surfaced during ${humanizeTiming(seed.timing)}.`,
      evidence: [evidenceRef('issue_seed', { id: seed.id, readable: seed.family })],
      salience: Math.max(seed.severity, seed.urgency, seed.cardWorthiness),
      toneTags: ['fallback_trigger', ...seed.toneHints],
      ...(subject ? { subject } : {}),
      target: `seed:${seed.id}`,
    })
  }

  const causes = seed.causes
    .filter((cause) => cause.readable.trim().length > 0)
    .slice()
    .sort((a, b) => causeScore(b) - causeScore(a))
  for (const cause of causes) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:cause:${cause.id}`,
      kind: 'cause',
      readable: cause.readable,
      evidence: [
        evidenceRef('seed_cause', {
          id: cause.id,
          path: cause.target,
          readable: cause.readable,
        }),
      ],
      salience: causeScore(cause),
      toneTags: cause.tags,
      ...(cause.relatedActors[0] ? { subject: cause.relatedActors[0] } : subject ? { subject } : {}),
      target: cause.target,
    })
  }

  // Phase 205 / audit Wave 6 (`P7-EXP-005`) — continuity. A recurring
  // issue used to arrive with no statement that it was the same issue: the
  // audit saw `staff_identity` and `stock_shortage` return for 25
  // consecutive days as if each morning were the first. The sim now tracks
  // the thread (`seed.continuity`), so the card can say how long the
  // problem has stood and what the player already decided about it.
  //
  // Salience is above every other history fact on purpose: "this is the
  // same problem, and here is what you did last time" outranks flavour
  // when the two compete for the History section's two lines.
  if (seed.continuity) {
    const line = continuityLine(seed.continuity)
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:continuity`,
      kind: 'memory',
      readable: line,
      evidence: [
        seed.continuity.lastSelectionLabel !== undefined
          ? evidenceRef('resolved_intent', {
              id: seed.continuity.threadKey,
              readable: seed.continuity.lastSelectionLabel,
            })
          : evidenceRef('issue_seed', {
              id: seed.id,
              path: 'continuity',
              readable: line,
            }),
      ],
      salience: 100,
      toneTags: [
        'continuity',
        seed.continuity.escalated ? 'escalating' : 'standing',
      ],
      ...(subject ? { subject } : {}),
    })
  }

  for (const fragment of seed.textIngredients.relevantMemories ?? []) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:memory:${stableKey(fragment)}`,
      kind: 'memory',
      readable: fragment,
      evidence: [
        evidenceRef('memory', {
          path: 'textIngredients.relevantMemories',
          readable: fragment,
        }),
      ],
      salience: seed.novelty,
      toneTags: ['memory', ...seed.toneHints],
      ...(subject ? { subject } : {}),
    })
  }

  for (const fragment of seed.textIngredients.recentContext ?? []) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:recent:${stableKey(fragment)}`,
      kind: 'memory',
      readable: fragment,
      evidence: [
        evidenceRef('issue_seed', {
          id: seed.id,
          path: 'textIngredients.recentContext',
          readable: fragment,
        }),
      ],
      salience: seed.novelty,
      toneTags: ['recent_context', ...seed.toneHints],
      ...(subject ? { subject } : {}),
    })
  }

  for (const hook of seed.futureHooks) {
    const readable = hook.label ?? hook.id
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:future-hook:${hook.id}`,
      kind: 'consequence',
      readable,
      evidence: [evidenceRef('future_hook', { id: hook.id, readable })],
      salience: Math.max(seed.severity, seed.cardWorthiness),
      toneTags: [...(hook.tags ?? []), 'future_hook'],
      ...(subject ? { subject } : {}),
    })
  }

  for (const stake of seed.stakes) {
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:stake:${stake.id}`,
      kind: 'consequence',
      readable: stake.readable,
      evidence: [
        evidenceRef('stake', {
          id: stake.id,
          path: stake.target,
          readable: stake.readable,
        }),
      ],
      salience: stake.direction === 'gain' ? seed.cardWorthiness : seed.severity,
      toneTags: [...stake.tags, stake.direction],
      ...(subject ? { subject } : {}),
      target: stake.target,
    })
  }

  for (const pressure of seed.pressures) {
    const consequence = buildPressureConsequenceLine(String(pressure.id), state)
    if (!consequence) continue
    addSurfaceFact(facts, {
      id: `seed:${seed.id}:pressure-consequence:${pressure.id}`,
      kind: 'consequence',
      readable: consequence,
      evidence: [
        evidenceRef('pressure_snapshot', {
          id: String(pressure.id),
          readable: pressure.label,
        }),
      ],
      salience: pressure.severity,
      toneTags: ['pressure_consequence', ...pressure.tags],
      ...(subject ? { subject } : {}),
      target: `pressure:${pressure.id}`,
    })
  }

  return dedupeSurfaceFacts(facts)
}

function addThresholdFact(
  facts: SurfaceFact[],
  seed: IssueSeed,
  field: 'severity' | 'urgency' | 'cardWorthiness',
  value: number,
): void {
  if (value < 70) return
  const readable =
    field === 'severity'
      ? `Severity is high for ${humanizeFamily(seed.family)}.`
      : field === 'urgency'
        ? `Urgency is high for ${humanizeTiming(seed.timing)}.`
        : 'This rose above the card-worthiness threshold.'
  addSurfaceFact(facts, {
    id: `seed:${seed.id}:trigger:${field}`,
    kind: 'trigger',
    readable,
    evidence: [evidenceRef('issue_seed', { id: seed.id, path: field })],
    salience: value,
    toneTags: [field, ...seed.toneHints],
    target: `seed:${seed.id}`,
  })
}

function pressureScore(pressure: PressureSnapshot): number {
  return Math.max(pressure.severity, pressure.urgency, Math.abs(pressure.delta))
}

function causeScore(cause: { weight?: number; amount?: number }): number {
  const weight = Number.isFinite(cause.weight) ? Math.abs(cause.weight ?? 0) : 0
  const amount = Number.isFinite(cause.amount) ? Math.abs(cause.amount ?? 0) : 0
  return Math.max(weight, amount)
}

function readablePressureLine(pressure: PressureSnapshot): string {
  const label = pressure.label || humanizeFamily(String(pressure.id))
  const trend =
    pressure.trend === 'stable' ? 'is stable' : `is ${pressure.trend}`
  return `${label} ${trend}.`
}

function humanizeFamily(family: string): string {
  return family.replace(/[_-]+/g, ' ')
}

function humanizeTiming(timing: string): string {
  return timing.replace(/[_-]+/g, ' ')
}

/**
 * Phase 205 / audit Wave 6 (`P7-EXP-005`) — one line stating that this is
 * the same problem, how long it has stood, and what the player decided
 * last time.
 *
 * The decision half preserves the Wave 3 / `DC-02` distinction: a
 * deliberate "let it stand" arrives here as a real choice label, while a
 * card that was never answered says so. Collapsing the two would undo the
 * decision Wave 3 recorded.
 */
function continuityLine(continuity: SeedContinuity): string {
  const age =
    continuity.daysStanding <= 0
      ? 'Still open from earlier today'
      : continuity.daysStanding === 1
        ? 'Standing since yesterday'
        : `Standing ${continuity.daysStanding} days`
  const worse = continuity.escalated ? ', and worse than last time' : ''
  // Three cases, not two: answered with a label the sim can quote,
  // answered by an intent that carried none (bots, tests), and never
  // answered at all. Only the last one may say so.
  const decision =
    continuity.lastSelectionLabel !== undefined
      ? `. You chose: ${continuity.lastSelectionLabel}`
      : continuity.unanswered
        ? '. You have not answered it yet'
        : ''
  return `${age}${worse}${decision}`
}

function stableKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'fragment'
}
