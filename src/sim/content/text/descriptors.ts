// Phase 85 / ISSUE-045 — mechanical descriptor pools.
//
// Phase 22 reserved this file as an empty placeholder; ISSUE-045
// populates it. These are mechanical labels and tag-fragments —
// NEVER card prose. Per the Phase 21 contract, card text is built
// by the eventual card layer on top of these pools; this file holds
// the raw vocabulary.
//
// Phase 123 / ISSUE-092: the FNV-1a helper that picks a deterministic
// fragment from a pool moved to `src/sim/utils/fnv.ts` so the compose
// slice and the voice composer share one implementation.

import { fnvIndex } from '../../utils/fnv'
//
// Three pools cover the most common descriptor needs across the
// existing issue-seed families:
//
//   - `SEVERITY_ADJECTIVES`: short adjectives keyed by mechanical
//     severity tier. Used to attach a non-numeric severity label to
//     a seed's text ingredients.
//   - `AREA_STATE_ADJECTIVES`: short adjectives describing area
//     conditions (dirty / damaged / clean). The phase 56 violence
//     generator builds sensory details from these.
//   - `FACTION_RELATION_NOUNS`: nouns describing the mechanical
//     relationship between two factions or a faction and the tavern.
//
// Each pool is a frozen const so callers don't mutate the source
// vocabulary; helpers below return deterministic picks given a key.

export type SeverityTier = 'low' | 'medium' | 'high'

export const SEVERITY_ADJECTIVES: Readonly<Record<SeverityTier, readonly string[]>> = {
  low: ['minor', 'simmering', 'rumbling', 'background', 'occasional'],
  medium: ['notable', 'persistent', 'troubling', 'recurring', 'mounting'],
  high: ['severe', 'urgent', 'volatile', 'acute', 'escalating'],
} as const

export type AreaConditionKey = 'dirty' | 'damaged' | 'clean' | 'smelly' | 'risky'

export const AREA_STATE_ADJECTIVES: Readonly<
  Record<AreaConditionKey, readonly string[]>
> = {
  dirty: ['grimy', 'soiled', 'sticky', 'unswept', 'caked'],
  damaged: ['cracked', 'scarred', 'splintered', 'patched', 'broken'],
  clean: ['polished', 'tidy', 'swept', 'spotless', 'orderly'],
  smelly: ['acrid', 'sour', 'stale', 'fetid', 'pungent'],
  risky: ['rowdy', 'volatile', 'edgy', 'tense', 'incident-prone'],
} as const

export type FactionRelationKey =
  | 'cooperation'
  | 'tension'
  | 'rivalry'
  | 'truce'
  | 'feud'

export const FACTION_RELATION_NOUNS: Readonly<
  Record<FactionRelationKey, readonly string[]>
> = {
  cooperation: ['rapport', 'alliance', 'partnership', 'accord'],
  tension: ['friction', 'unease', 'standoff', 'pressure'],
  rivalry: ['rivalry', 'contest', 'competition'],
  truce: ['détente', 'truce', 'ceasefire', 'pause'],
  feud: ['feud', 'vendetta', 'grudge', 'enmity'],
} as const

// Map a numeric severity (0–100) to a coarse tier. The thresholds
// match the mechanical bands used by `severityFromPressures` in
// `issueSeedGenerators.ts` (≥70 high, ≥40 medium, else low).
export function severityTier(severity: number): SeverityTier {
  if (severity >= 70) return 'high'
  if (severity >= 40) return 'medium'
  return 'low'
}

export function pickSeverityAdjective(
  severity: number,
  key: string,
): string {
  const pool = SEVERITY_ADJECTIVES[severityTier(severity)]
  return pool[fnvIndex(key, pool.length)]!
}

export function pickAreaStateAdjective(
  condition: AreaConditionKey,
  key: string,
): string {
  const pool = AREA_STATE_ADJECTIVES[condition]
  return pool[fnvIndex(key, pool.length)]!
}

export function pickFactionRelationNoun(
  relation: FactionRelationKey,
  key: string,
): string {
  const pool = FACTION_RELATION_NOUNS[relation]
  return pool[fnvIndex(key, pool.length)]!
}
