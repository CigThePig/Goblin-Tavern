// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Intentionally-bad pool / template builders. Each fixture plants one
// failure class so the corresponding gate has something to reject. The
// happy-path side of every test runs against the real drinkOrder
// template; these fixtures cover the "fails when it should" half.
//
// Every fixture is a function so callers can compose them into custom
// templates without sharing mutable state between tests.

import { fallbackCard } from '../../../../src/cards/templates/fallback'
import type {
  CompositionalCardTemplate,
  SlotSpec,
  Snippet,
  SnippetPool,
  VoiceRegisterId,
} from '../../../../src/cards/compose/types'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder'
import type { CardView } from '../../../../src/cards/types'

const TEST_REGISTER: VoiceRegisterId = 'tavern_floor'

/** Build a minimal compositional template wrapping the supplied slots.
 *  Re-uses the fallback card's render shape for the `toCardView` plumbing
 *  — gates do not exercise `toCardView`, so this is harmless. */
export function buildTemplate(
  id: string,
  slots: SlotSpec[],
  overrides: Partial<CompositionalCardTemplate> = {},
): CompositionalCardTemplate {
  return {
    id,
    appliesTo: { seedFamilies: ['regular_customer'] },
    priority: 10,
    voiceRegister: TEST_REGISTER,
    slots,
    toCardView: (_filled, seed, state): CardView =>
      fallbackCard.render(seed, state),
    ...overrides,
  }
}

function makeSlot(
  id: string,
  snippets: Snippet[],
  overrides: Partial<SlotSpec> = {},
): SlotSpec {
  const pool: SnippetPool = { slotId: id, snippets }
  const slot: SlotSpec = { id, role: 'aside', pool, ...overrides }
  return slot
}

/** A required slot missing the unconditional fallback. Coverage and
 *  specificity-gradient gates both flag it. */
export function noFallbackSlot(): SlotSpec {
  return makeSlot('order_line', [
    {
      id: 'only_conditioned',
      text: 'Ale.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
  ])
}

/** A required slot with ONLY the unconditional fallback — no gradient
 *  to climb. Specificity-gradient gate flags it. */
export function allFallbackSlot(): SlotSpec {
  return makeSlot('order_line', [
    { id: 'only_fallback', text: 'An ale.', conditions: [] },
  ])
}

/** A slot whose pool contains one over-budget snippet. Voice-bounds gate
 *  flags it. */
export function overBudgetSlot(budget: number): SlotSpec {
  const overflow = budget + 3
  const words: string[] = []
  for (let i = 0; i < overflow; i += 1) words.push('word')
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'Ale.', conditions: [] },
      { id: 'too_long', text: words.join(' '), conditions: [] },
    ],
    { wordBudget: budget, claimMode: 'flavor' },
  )
}

/** A slot whose pool contains a snippet text referencing a banned
 *  display name. Sim-coherence gate flags it. The `bannedName` arg is
 *  the literal name the test plants — must match the `bannedDisplayNames`
 *  list the gate is configured with. */
export function bannedNameSlot(bannedName: string): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'plants_name',
        text: `${bannedName} nods. Ale, then.`,
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** A slot whose pool contains a snippet asserting unbacked history with
 *  no `memoryPresent` / `repeatCount` condition. */
export function unbackedHistoryClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'unbacked_history',
        text: 'Ale. Twice now, mind.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** Same text but with a `memoryPresent` condition added — the gate
 *  should accept this version. */
export function backedHistoryClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'backed_history',
        text: 'Ale. Twice now, mind.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
          { kind: 'memoryPresent', tag: 'ale_order' },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** A slot whose pool contains a snippet asserting a role claim ("your
 *  cook") with no `hasNamedEntity` condition. */
export function unbackedRoleClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'unbacked_role',
        text: 'Ale, and tell your cook the bread is fine.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** Phase 166 / ISSUE-134 — a flavor slot whose pool contains a snippet
 *  asserting an emotional state ("wrung out") with no state-lookup
 *  condition. The state-claim detector must flag it. */
export function unbackedStateClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'unbacked_state',
        text: "Ale. I'm wrung out, but I'll pour.",
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** Same text but with a `signalEquals` state condition added — the gate
 *  should accept this version. */
export function backedStateClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'backed_state',
        text: "Ale. I'm wrung out, but I'll pour.",
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
          { kind: 'signalEquals', role: 'primaryActor', signal: 'staff.fatigue', equals: 'high' },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** A flavor snippet that makes a pure gesture / no-claim observation —
 *  the state-claim detector must stay silent on it even with no
 *  state-lookup condition. */
export function noStateClaimSlot(): SlotSpec {
  return makeSlot(
    'order_line',
    [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'no_state',
        text: 'They smooth their apron as if rehearsing.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
        ],
      },
    ],
    { claimMode: 'flavor' },
  )
}

/** A `claimMode: 'sim_backed'` slot whose non-fallback snippet has only
 *  `voiceAxis` conditions. Sim-coherence gate must flag the missing
 *  state-lookup condition. */
export function simBackedMissingLookupSlot(): SlotSpec {
  return makeSlot(
    'sim_backed_hook',
    [
      { id: 'fallback', text: 'Ale.', conditions: [] },
      {
        id: 'voice_only_on_sim_backed',
        text: 'Ale — and the usual grumble.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
        ],
      },
    ],
    { claimMode: 'sim_backed' },
  )
}

/** A `claimMode: 'sim_backed'` slot whose non-fallback snippet carries
 *  a state-lookup condition — should PASS the gate. */
export function simBackedWithLookupSlot(): SlotSpec {
  return makeSlot(
    'sim_backed_hook',
    [
      { id: 'fallback', text: 'Ale.', conditions: [] },
      {
        id: 'memory_backed',
        text: 'Ale — and the usual grumble.',
        conditions: [
          { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
          { kind: 'memoryPresent', tag: 'usual_grumble' },
        ],
      },
    ],
    { claimMode: 'sim_backed' },
  )
}

/** A pool that yields exactly one distinct output across any sample
 *  (only the fallback can fire). Diversity gate flags it. */
export function lowDiversityPool(): SnippetPool {
  return {
    slotId: 'order_line',
    snippets: [
      { id: 'fallback', text: 'An ale.', conditions: [] },
      {
        id: 'never',
        text: 'Bring me the rarest pour the house keeps.',
        conditions: [
          // Both extreme: `severityAtLeast: 9999` cannot match the
          // diversity sampler's seeds (severity 35).
          { kind: 'severityAtLeast', value: 9999 },
        ],
      },
    ],
  }
}

/** Wrap a slot into a minimal template (default id 'fixture_template').
 *  Tests use this to feed per-template gates a single bad slot without
 *  involving the real drinkOrder card. */
export function templateWithSlot(
  slot: SlotSpec,
  templateId = 'fixture_template',
): CompositionalCardTemplate {
  return buildTemplate(templateId, [slot])
}

/** Re-export the real order_line pool for tests that need a clean
 *  starting point. */
export { orderLinePool }

export const __testing = {
  buildTemplate,
  templateWithSlot,
  noFallbackSlot,
  allFallbackSlot,
  overBudgetSlot,
  bannedNameSlot,
  unbackedHistoryClaimSlot,
  backedHistoryClaimSlot,
  unbackedRoleClaimSlot,
  simBackedMissingLookupSlot,
  simBackedWithLookupSlot,
  lowDiversityPool,
}
