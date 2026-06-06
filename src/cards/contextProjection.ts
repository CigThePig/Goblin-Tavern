import type { CardContextLine, CardContextView } from './types'
import type { IssueSeed } from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'
import type { PressureSnapshot } from '../sim/modules/pressures/pressureTypes'
import { buildPressureConsequenceLine } from '../reports/pressureConsequenceLine'

const MAX_WORDS = 18

export function buildCardContext(
  seed: IssueSeed,
  state: TavernState,
): CardContextView {
  const used = new Set<string>()
  return {
    whyNow: capLines(buildWhyNow(seed, used), 3),
    causes: capLines(buildCauses(seed, used), 3),
    history: capLines(buildHistory(seed, used), 2),
    future: capLines(buildFuture(seed, state, used), 2),
  }
}

function buildWhyNow(seed: IssueSeed, used: Set<string>): CardContextLine[] {
  const lines: CardContextLine[] = []
  const pressures = seed.pressures
    .slice()
    .sort((a, b) => pressureScore(b) - pressureScore(a))

  for (const pressure of pressures) {
    const readable = readablePressureLine(pressure)
    addLine(lines, used, {
      readable,
      kind: 'why_now',
      source: 'pressure_snapshot',
      refId: String(pressure.id),
    })
  }

  if (seed.severity >= 70) {
    addLine(lines, used, {
      readable: `Severity is high for ${humanizeFamily(seed.family)}.`,
      kind: 'why_now',
      source: 'issue_seed',
      refId: seed.id,
    })
  }
  if (seed.urgency >= 70) {
    addLine(lines, used, {
      readable: `Urgency is high for ${humanizeTiming(seed.timing)}.`,
      kind: 'why_now',
      source: 'issue_seed',
      refId: seed.id,
    })
  }
  if (seed.cardWorthiness >= 70) {
    addLine(lines, used, {
      readable: `This rose above the card-worthiness threshold.`,
      kind: 'why_now',
      source: 'issue_seed',
      refId: seed.id,
    })
  }

  for (const fragment of seed.textIngredients.pressureContext ?? []) {
    addLine(lines, used, {
      readable: fragment,
      kind: 'why_now',
      source: 'text_ingredient',
      refId: 'textIngredients.pressureContext',
    })
  }

  if (lines.length === 0) {
    addLine(lines, used, {
      readable: `${humanizeFamily(seed.family)} surfaced during ${humanizeTiming(seed.timing)}.`,
      kind: 'why_now',
      source: 'fallback',
      refId: seed.id,
    })
  }

  return lines
}

function buildCauses(seed: IssueSeed, used: Set<string>): CardContextLine[] {
  const lines: CardContextLine[] = []
  const causes = seed.causes
    .filter((cause) => cleanReadable(cause.readable).length > 0)
    .slice()
    .sort((a, b) => causeScore(b) - causeScore(a))

  for (const cause of causes) {
    addLine(lines, used, {
      readable: cause.readable,
      kind: 'cause',
      source: 'seed_cause',
      refId: cause.id,
    })
  }
  return lines
}

function buildHistory(seed: IssueSeed, used: Set<string>): CardContextLine[] {
  const lines: CardContextLine[] = []
  for (const fragment of seed.textIngredients.relevantMemories ?? []) {
    addLine(lines, used, {
      readable: fragment,
      kind: 'history',
      source: 'memory',
      refId: 'textIngredients.relevantMemories',
    })
  }
  for (const fragment of seed.textIngredients.recentContext ?? []) {
    addLine(lines, used, {
      readable: fragment,
      kind: 'history',
      source: 'text_ingredient',
      refId: 'textIngredients.recentContext',
    })
  }
  return lines
}

function buildFuture(
  seed: IssueSeed,
  state: TavernState,
  used: Set<string>,
): CardContextLine[] {
  const lines: CardContextLine[] = []
  for (const hook of seed.futureHooks) {
    const readable = hook.label ?? hook.id
    addLine(lines, used, {
      readable,
      kind: 'future',
      source: 'memory',
      refId: hook.id,
    })
  }
  for (const stake of seed.stakes) {
    addLine(lines, used, {
      readable: stake.readable,
      kind: 'future',
      source: 'stake',
      refId: stake.id,
    })
  }
  for (const pressure of seed.pressures) {
    const consequence = buildPressureConsequenceLine(String(pressure.id), state)
    if (!consequence) continue
    addLine(lines, used, {
      readable: consequence,
      kind: 'future',
      source: 'pressure_snapshot',
      refId: String(pressure.id),
    })
  }
  return lines
}

function addLine(
  lines: CardContextLine[],
  used: Set<string>,
  line: CardContextLine,
): void {
  const readable = clampWords(cleanReadable(line.readable), MAX_WORDS)
  if (!readable) return
  const key = canonical(readable)
  if (used.has(key)) return
  used.add(key)
  const next: CardContextLine = { ...line, readable }
  lines.push(next)
}

function capLines(lines: CardContextLine[], limit: number): CardContextLine[] {
  return lines.slice(0, limit)
}

function cleanReadable(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function canonical(value: string): string {
  return cleanReadable(value).toLowerCase().replace(/[.!?]+$/g, '')
}

function clampWords(value: string, maxWords: number): string {
  const words = cleanReadable(value).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return cleanReadable(value)
  return `${words.slice(0, maxWords).join(' ')}…`
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
