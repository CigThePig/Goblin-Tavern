// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Sim-coherence gate (framework §6 #4). The hardest of the six. Phase B
// settled the working policy: flavor slots make no checkable claims;
// sim_backed slots assert facts the sim must back. The gate runs in two
// modes, picked per slot via the `claimMode` field on `SlotSpec`.
//
// FLAVOR mode (default) — runs three structural detectors against every
// snippet's text:
//
//   1. `display_name`  — text contains any banned display-name token
//      (caller-supplied list, drawn from a representative state sample).
//      No condition can guarantee a specific actor identity, so any name
//      in the text is an invented fact.
//
//   2. `history_claim` — text contains a history-claim phrase
//      ("yesterday", "twice now", "the third time", …) but the snippet
//      has no `memoryPresent` or `repeatCount` condition. The sim does
//      not back the implied history.
//
//   3. `role_claim`    — text contains a role-claim phrase ("your cook",
//      "the cleaner", …) but the snippet has no `hasNamedEntity`
//      condition. The sim doesn't guarantee a staff member of that role
//      is present.
//
// SIM_BACKED mode — every NON-fallback snippet must carry at least one
// state-lookup condition (`pressureRising`, `memoryPresent`,
// `repeatCount`, or `hasNamedEntity`). The unconditional fallback is
// exempt — by definition it never asserts anything.
//
// Phase D's drinkOrder pool ships entirely `claimMode: 'flavor'`. The
// bad fixtures in the test suite plant each failure class. Phase E will
// extend with explicit per-snippet claim metadata when generation-spec
// authors need it; the structural gate stays the load-bearing minimum.

import type {
  CompositionalCardTemplate,
  Snippet,
  SnippetCondition,
  SlotClaimMode,
} from '../types'
import { failReport, type GateReport, type GateViolation } from './types'

export type SimCoherenceConfig = {
  /** Display names drawn from a representative state. Any of these
   *  appearing as a substring of a flavor snippet's text is a violation
   *  (no condition pins actor identity to a specific name). Case-
   *  insensitive substring match with word-boundary awareness. */
  bannedDisplayNames: readonly string[]
  /** Additional history patterns appended to the default list. */
  extraHistoryPatterns?: readonly RegExp[]
  /** Additional role patterns appended to the default list. */
  extraRolePatterns?: readonly RegExp[]
}

const DEFAULT_HISTORY_PATTERNS: readonly RegExp[] = [
  /\byesterday\b/i,
  /\blast\s+(week|night|month|time)\b/i,
  /\btwice\s+now\b/i,
  /\bthree\s+(times|weeks)\b/i,
  /\bthe\s+third\s+(time|week)\b/i,
  /\bagain\b/i,
]

const DEFAULT_ROLE_PATTERNS: readonly RegExp[] = [
  /\b(your|the)\s+(cook|cleaner|server|guard|bouncer)\b/i,
]

const STATE_LOOKUP_KINDS: readonly SnippetCondition['kind'][] = [
  'pressureRising',
  'memoryPresent',
  'repeatCount',
  'hasNamedEntity',
]

export function checkSimCoherence(
  template: CompositionalCardTemplate,
  config: SimCoherenceConfig,
): GateReport {
  const violations: GateViolation[] = []
  const historyPatterns = [
    ...DEFAULT_HISTORY_PATTERNS,
    ...(config.extraHistoryPatterns ?? []),
  ]
  const rolePatterns = [
    ...DEFAULT_ROLE_PATTERNS,
    ...(config.extraRolePatterns ?? []),
  ]
  for (const slot of template.slots) {
    const mode: SlotClaimMode = slot.claimMode ?? 'flavor'
    for (const snippet of slot.pool.snippets) {
      if (mode === 'flavor') {
        checkFlavorSnippet({
          slotId: slot.id,
          snippet,
          bannedNames: config.bannedDisplayNames,
          historyPatterns,
          rolePatterns,
          violations,
        })
      } else {
        checkSimBackedSnippet({
          slotId: slot.id,
          snippet,
          violations,
        })
      }
    }
  }
  return failReport(violations)
}

function checkFlavorSnippet(args: {
  slotId: string
  snippet: Snippet
  bannedNames: readonly string[]
  historyPatterns: readonly RegExp[]
  rolePatterns: readonly RegExp[]
  violations: GateViolation[]
}): void {
  const { slotId, snippet, bannedNames, historyPatterns, rolePatterns, violations } =
    args
  const text = snippet.text

  for (const name of bannedNames) {
    if (matchesAsWord(text, name)) {
      violations.push({
        slotId,
        snippetId: snippet.id,
        reason: 'banned_display_name',
        detail: `text contains banned display name "${name}"`,
      })
      // One violation per snippet for this detector — additional names
      // would just be noise.
      break
    }
  }

  const historyHit = historyPatterns.find((rx) => rx.test(text))
  if (historyHit && !hasConditionKinds(snippet, ['memoryPresent', 'repeatCount'])) {
    violations.push({
      slotId,
      snippetId: snippet.id,
      reason: 'unbacked_history_claim',
      detail: `text matches ${historyHit.source} but has no memoryPresent / repeatCount condition`,
    })
  }

  const roleHit = rolePatterns.find((rx) => rx.test(text))
  if (roleHit && !hasConditionKinds(snippet, ['hasNamedEntity'])) {
    violations.push({
      slotId,
      snippetId: snippet.id,
      reason: 'unbacked_role_claim',
      detail: `text matches ${roleHit.source} but has no hasNamedEntity condition`,
    })
  }
}

function checkSimBackedSnippet(args: {
  slotId: string
  snippet: Snippet
  violations: GateViolation[]
}): void {
  const { slotId, snippet, violations } = args
  // The unconditional fallback is the safety net; sim_backed pools may
  // still ship one and the gate exempts it.
  if (snippet.conditions.length === 0) return
  if (!hasConditionKinds(snippet, STATE_LOOKUP_KINDS)) {
    violations.push({
      slotId,
      snippetId: snippet.id,
      reason: 'sim_backed_missing_lookup',
      detail:
        'non-fallback snippet on a sim_backed slot has no state-lookup condition',
    })
  }
}

function hasConditionKinds(
  snippet: Snippet,
  kinds: readonly SnippetCondition['kind'][],
): boolean {
  return snippet.conditions.some((c) => kinds.includes(c.kind))
}

function matchesAsWord(text: string, name: string): boolean {
  if (name.length === 0) return false
  // Case-insensitive whole-word match. `\b` works for ASCII-only names —
  // the regulars roster in the codebase uses Latin-1, so this is safe in
  // practice. Escapes regex metacharacters in the name.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp(`\\b${escaped}\\b`, 'i')
  return rx.test(text)
}

export const __internal = {
  DEFAULT_HISTORY_PATTERNS,
  DEFAULT_ROLE_PATTERNS,
  STATE_LOOKUP_KINDS,
}
