import type { CardContextLine, CardContextView } from '../cards/types'
import type { SurfaceFact, SurfaceFactKind } from './types'
import { canonicalReadable, cleanReadable } from './evidence'

const MAX_WORDS = 18

export function cardContextFromSurfaceFacts(facts: SurfaceFact[]): CardContextView {
  const used = new Set<string>()
  const whyNow = selectLines(facts, used, isWhyNow, 'why_now', 3)
  const causes = selectLines(facts, used, (fact) => fact.kind === 'cause', 'cause', 3)
  const history = selectLines(facts, used, (fact) => fact.kind === 'memory', 'history', 2)
  const future = selectLines(facts, used, isFuture, 'future', 2)
  return { whyNow, causes, history, future }
}

function selectLines(
  facts: SurfaceFact[],
  used: Set<string>,
  predicate: (fact: SurfaceFact) => boolean,
  kind: CardContextLine['kind'],
  limit: number,
): CardContextLine[] {
  const lines: CardContextLine[] = []
  for (const fact of facts.filter(predicate)) {
    if (lines.length >= limit) break
    const readable = clampWords(cleanReadable(fact.readable), MAX_WORDS)
    if (!readable) continue
    const key = canonicalReadable(readable)
    if (used.has(key)) continue
    used.add(key)
    lines.push({
      readable,
      kind,
      source: cardSourceForFact(fact, kind),
      ...(fact.evidence[0]?.id ? { refId: fact.evidence[0].id } : {}),
    })
  }
  return lines
}

function isWhyNow(fact: SurfaceFact): boolean {
  return fact.kind === 'pressure' || fact.kind === 'trigger' || fact.kind === 'trend'
}

function isFuture(fact: SurfaceFact): boolean {
  return fact.kind === 'consequence' || fact.kind === 'missed_opportunity'
}

function cardSourceForFact(
  fact: SurfaceFact,
  contextKind: CardContextLine['kind'],
): CardContextLine['source'] {
  if (fact.toneTags.includes('fallback_trigger')) return 'fallback'
  if (contextKind === 'history' && fact.evidence[0]?.source === 'issue_seed') {
    return 'text_ingredient'
  }
  switch (fact.evidence[0]?.source) {
    case 'issue_seed':
      return 'issue_seed'
    case 'seed_cause':
      return 'seed_cause'
    case 'pressure_snapshot':
      return 'pressure_snapshot'
    case 'stake':
      return 'stake'
    case 'memory':
    case 'future_hook':
      return 'memory'
    default:
      return contextKind === 'cause' ? 'seed_cause' : 'issue_seed'
  }
}


function clampWords(value: string, maxWords: number): string {
  const words = cleanReadable(value).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return cleanReadable(value)
  return `${words.slice(0, maxWords).join(' ')}…`
}

export type { SurfaceFactKind }
