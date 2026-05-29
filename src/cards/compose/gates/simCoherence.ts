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
//   4. `state_claim`   — (Phase 166 / ISSUE-134, Faithful Surface arc,
//      Phase 4) text contains a phrase that asserts an emotional or
//      situational state ("heavy hush", "wrung out", "shadows under the
//      eyes", "rested", …) but the snippet carries NO state-lookup
//      condition. The prior arcs' "flavor makes no checkable claims"
//      rule was too broad: a flavor line that asserts how an actor FEELS
//      makes a claim the sim must back, even when it invents no name,
//      history, or role. The lexicon is deliberately small and
//      inspectable (curated distress + calm phrases, NOT an open
//      vocabulary) so authors know exactly what triggers gating; lines
//      that make no situational claim ("They smooth their apron") stay
//      free. Direction-correctness (a distress line gated on a
//      distress-direction signal) is enforced by authoring + the
//      multi-fact join + the legibility gate, not here — this detector
//      stays as structurally simple as `history_claim`: claim token
//      present ⇒ a state-lookup condition must be present.
//
// SIM_BACKED mode — every NON-fallback snippet must carry at least one
// state-lookup condition (`pressureRising`, `memoryPresent`,
// `repeatCount`, `hasNamedEntity`, or — added Phase 127 / ISSUE-096 —
// `signalEquals`). The unconditional fallback is exempt — by
// definition it never asserts anything.
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
  /** Phase 166 — additional state-claim patterns appended to the
   *  default distress/calm list. */
  extraStatePatterns?: readonly RegExp[]
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

// Phase 166 / ISSUE-134 — the state-claim lexicon. Two curated, small,
// inspectable sets of phrases that assert an emotional / situational
// state about the speaker (or, for close-third physical tells, the
// actor the card centres on). A flavor snippet matching any of these
// must carry a state-lookup condition; otherwise it renders byte-
// identical at low, mid, and high state and will contradict the sim.
//
// Scope is first-person / close-third WELLBEING — exhaustion, strain,
// dread, relief, rest. It deliberately does NOT cover narrator lines
// about the room or market ("tension is rising", "the board has
// climbed") — those describe the seed's own premise, not an actor's
// invented inner state. Phrases are distinctive enough not to fire on
// the gesture-only manner notes ("they roll their sleeves",
// "unhurried") that are legitimate ungated flavor.
const DEFAULT_DISTRESS_PATTERNS: readonly RegExp[] = [
  /\bheavy hush\b/i,
  /\blike ash\b/i,
  /\bwrung out\b/i,
  /\bworn (through|thin|out)\b/i,
  /\bworn knot\b/i,
  /\bpulled tight\b/i,
  /\bstrain\b/i,
  /\bholding the line\b/i,
  /\bhands? (are |is )?slow(er)?\b/i,
  /\bslow today\b/i,
  /\bshadows under (the|his|her|their) eyes\b/i,
  /\beyes shadowed\b/i,
  /\bknuckles? whiten\b/i,
  /\bwhite (at|on) the knuckles\b/i,
  /\bshoulders rounded\b/i,
  /\btired hand\b/i,
  /\bweight off (her|his|their) feet\b/i,
]
const DEFAULT_CALM_PATTERNS: readonly RegExp[] = [
  /\brested\b/i,
  /\bwell[- ]?slept\b/i,
  /\bat ease\b/i,
  /\bloose[- ]?shouldered\b/i,
]

const STATE_LOOKUP_KINDS: readonly SnippetCondition['kind'][] = [
  'pressureRising',
  'memoryPresent',
  'repeatCount',
  'hasNamedEntity',
  // Phase 127 / ISSUE-096 — signal-surface query counts as a state lookup.
  'signalEquals',
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
  const statePatterns = [
    ...DEFAULT_DISTRESS_PATTERNS,
    ...DEFAULT_CALM_PATTERNS,
    ...(config.extraStatePatterns ?? []),
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
          statePatterns,
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
  statePatterns: readonly RegExp[]
  violations: GateViolation[]
}): void {
  const {
    slotId,
    snippet,
    bannedNames,
    historyPatterns,
    rolePatterns,
    statePatterns,
    violations,
  } = args
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

  // Phase 166 / ISSUE-134 — state-claim detector. A flavor line that
  // asserts how the actor feels must carry a state-lookup condition so
  // it can't fire at the wrong meter band and contradict the sim.
  //
  // Scoped to body flavor slots. The synthetic choice-label and
  // effect-preview slots are exempt: a label is an action verb and a
  // preview ("Staff would carry the strain of the moment") describes a
  // FUTURE mechanical consequence that is backed 1-to-1 by the effect it
  // previews — not an unbacked claim about the actor's CURRENT state.
  const stateHit = isConsequenceSlot(slotId)
    ? undefined
    : statePatterns.find((rx) => rx.test(text))
  if (stateHit && !hasConditionKinds(snippet, STATE_LOOKUP_KINDS)) {
    violations.push({
      slotId,
      snippetId: snippet.id,
      reason: 'unbacked_state_claim',
      detail: `text matches ${stateHit.source} (implies actor state) but has no state-lookup condition`,
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

/** Phase 166 — choice-label and effect-preview slots (and their
 *  production `::`-namespaced synthetic forms built by
 *  `composeChoicesFromSeed`) describe an action or a mechanical
 *  consequence, not the actor's current felt state, so the state-claim
 *  detector skips them. */
function isConsequenceSlot(slotId: string): boolean {
  return (
    slotId === 'choice_label' ||
    slotId === 'effect_preview' ||
    slotId.startsWith('choice_label::') ||
    slotId.startsWith('effect_preview::')
  )
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
  DEFAULT_DISTRESS_PATTERNS,
  DEFAULT_CALM_PATTERNS,
  STATE_LOOKUP_KINDS,
}
