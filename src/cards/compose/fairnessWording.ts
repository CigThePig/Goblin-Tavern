import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import { repeatCountByTag } from '../../sim/signals'
import type { TavernState } from '../../sim/state/TavernState'
import type { CardView } from '../types'

const BLAME_MEMORY_TAGS = new Set([
  'ignored',
  'neglected',
  'refused',
  'unpaid',
  'warning',
  'risk',
  'broken_promise',
  'promise',
])

function hasBlameOrRecurrenceEvidence(seed: IssueSeed, state: TavernState): boolean {
  if (state.memories.length > 0) return true
  if (state.history.some((h) => h.category === 'owner_action')) return true
  if (
    seed.causes.some(
      (c) =>
        c.sourceType === 'owner_action' ||
        c.source.includes('ownerActions') ||
        c.tags.some((tag) => BLAME_MEMORY_TAGS.has(tag)),
    )
  ) {
    return true
  }
  if (state.memories.some((m) => m.tags.some((tag) => BLAME_MEMORY_TAGS.has(tag)))) {
    return true
  }
  if (repeatCountByTag(state, seed.family) >= 2) return true
  if (repeatCountByTag(state, seed.type) >= 2) return true
  return false
}

function guardLine(line: string, supported: boolean): string {
  if (supported) return line
  const hadRecurrenceClaim = /\b(from before|earlier|prior|last warning|same|again)\b/i.test(line)
  let out = line
    .replace(/\bthe neglect from before\b/gi, 'the area was already in rough shape')
    .replace(/\bwas ignored\b/gi, 'is active')
    .replace(/\bignored\b/gi, 'unresolved')
    .replace(/\bbeing neglected\b/gi, 'settling in')
    .replace(/\bneglected\b/gi, 'already in rough shape')
    .replace(/\bneglect\b/gi, 'rough condition')
    .replace(/\bfailed\b/gi, 'could not')
    .replace(/\bunanswered\b/gi, 'open')
    .replace(/\bleft too long\b/gi, 'waiting')
    .replace(/\brefused\b/gi, 'declined')
    .replace(/\bbroken promise\b/gi, 'open promise')
    .replace(/\bunpaid\b/gi, 'payment due')
    .replace(/\bno one dealt with it\b/gi, 'it remains unresolved')
    .replace(/\ball week\b/gi, 'today')
    .replace(/\bThird morning running,?\s*/gi, 'This morning, ')

  if (hadRecurrenceClaim) {
    out = out
      .replace(/\bagain\b/gi, '')
      .replace(/\bstill\b/gi, 'currently')
  }

  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

export function guardCardViewWording(
  card: CardView,
  seed: IssueSeed,
  state: TavernState,
): CardView {
  const supported = hasBlameOrRecurrenceEvidence(seed, state)
  return {
    ...card,
    title: guardLine(card.title, supported),
    body: card.body.map((line) => guardLine(line, supported)),
    stakes: card.stakes.map((stake) => ({
      ...stake,
      readable: guardLine(stake.readable, supported),
    })),
    choices: card.choices.map((choice) => ({
      ...choice,
      label: guardLine(choice.label, supported),
    })),
  }
}
