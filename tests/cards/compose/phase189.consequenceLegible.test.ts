// Phase 189 / ISSUE-156 — Consequence-Legible Choices.
//
// The Choice-Preview Legibility arc surfaced the SHOWN effects legibly; this
// phase admits two consequence axes that previously could not enter an active
// choice's preview at all:
//   A. the most decision-relevant DELAYED consequence, as a trailing `later:`
//      line (additive — never displacing a surfaced immediate cost);
//   B. the blast radius — the NON-PRIMARY actor a previewed effect moves,
//      named in the line.
// Plus the unit behaviour of the shared selectors both the renderer and the
// legibility gate read.

import { describe, expect, it } from 'vitest'

import { composeChoicesFromSeed } from '../../../src/cards/cardHelpers'
import {
  isDecisionRelevantDelayed,
  isLaterPreviewLine,
  selectDelayedPreviewEffect,
  LATER_PREVIEW_PREFIX,
} from '../../../src/cards/compose/previewSelect'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type { SnippetPool } from '../../../src/cards/compose/types'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { EntityRef } from '../../../src/sim/state/TavernState'
import { makeSeed } from '../cardFactories'

const EMPTY_LABEL_POOL: SnippetPool = { slotId: 'choice_label', snippets: [] }
// A pool with no snippets — every preview line falls through to the effect's
// sim `readable`, so exact lines are predictable.
const EMPTY_PREVIEW_POOL: SnippetPool = { slotId: 'effect_preview', snippets: [] }
// A pool that always composes a generic (non-readable) line, so the actor-
// attribution path (Plan B) — which never touches a sim `readable` line —
// engages.
const COMPOSING_PREVIEW_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [{ id: 'generic', text: 'the meter shifts a step', conditions: [] }],
}

const MINERS: EntityRef = { kind: 'customer_group', id: 'miners' }

function activeSeed(parts: {
  slotId: string
  immediate: ConsequenceProfile['immediateEffects']
  delayed: ConsequenceProfile['delayedEffects']
  primaryActor?: EntityRef
  verb?: ResponseSlot['allowedVerbs'][number]
  shape?: ResponseSlot['shape']
}): IssueSeed {
  const slot: ResponseSlot = {
    id: parts.slotId,
    labelHint: 'Address it',
    allowedVerbs: [parts.verb ?? 'appease'],
    shape: parts.shape ?? 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }
  const profile: ConsequenceProfile = {
    id: `${parts.slotId}-profile`,
    responseSlotId: parts.slotId,
    immediateEffects: parts.immediate,
    delayedEffects: parts.delayed,
    memories: [],
    futureHooks: [],
    impactScore: 5,
  }
  return makeSeed({
    id: `phase189-${parts.slotId}`,
    family: 'customer_complaint',
    primaryActor: parts.primaryActor ?? MINERS,
    responseSlots: [slot],
    consequenceProfiles: [profile],
  })
}

describe('Phase 189 / ISSUE-156 — delayed-effect selectors (shared with the gate)', () => {
  it('isDecisionRelevantDelayed: future_hook and risk/future_hook-tagged effects qualify', () => {
    const hook = effect('future_hook', 'expectation_hook', 8, 'group may expect this', [
      'future_hook',
    ])
    const riskTagged = effect('pressure', 'pressure:rumour_pressure', 8, 'rumours', ['risk'])
    const plainPressure = effect('pressure', 'pressure:maintenance', -4, 'drifts', ['pressure'])
    expect(isDecisionRelevantDelayed(hook)).toBe(true)
    expect(isDecisionRelevantDelayed(riskTagged)).toBe(true)
    // A plain pressure drift, tagged only 'pressure', is not on its own a
    // decision-relevant LATER consequence.
    expect(isDecisionRelevantDelayed(plainPressure)).toBe(false)
  })

  it('selectDelayedPreviewEffect: picks one relevant entry by magnitude, none when absent', () => {
    expect(selectDelayedPreviewEffect([])).toBeUndefined()
    const small = effect('future_hook', 'a', 5, 'small hook', ['future_hook'])
    const big = effect('future_hook', 'b', 15, 'big hook', ['future_hook'])
    const noise = effect('pressure', 'pressure:x', -3, 'drift', ['pressure'])
    expect(selectDelayedPreviewEffect([small, big, noise])).toBe(big)
    // Only a non-relevant delayed effect → nothing to surface.
    expect(selectDelayedPreviewEffect([noise])).toBeUndefined()
  })
})

describe('Phase 189 / ISSUE-156 — Plan A: delayed consequence surfaces as a later: line', () => {
  const state = createInitialTavernState()

  it('appends exactly one later: line, additive to the immediate previews', () => {
    const seed = activeSeed({
      slotId: 'fix_root',
      immediate: [
        effect('state_change', 'reputation.respectable', 4, 'the name steadies', ['reputation']),
        effect('state_change', 'coin', -10, 'ten coin leaves the till', ['coin']),
      ],
      delayed: [
        effect('future_hook', 'expectation_hook', 8, 'group may expect this standard', [
          'future_hook',
        ]),
      ],
    })
    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: EMPTY_PREVIEW_POOL,
    })
    const laterLines = choice!.previewEffects.filter(isLaterPreviewLine)
    const immediateLines = choice!.previewEffects.filter((l) => !isLaterPreviewLine(l))
    // Exactly one delayed line, naming the authored consequence.
    expect(laterLines).toHaveLength(1)
    expect(laterLines[0]).toBe(`${LATER_PREVIEW_PREFIX}group may expect this standard`)
    // Both immediate previews remain — the delayed line did not displace them.
    expect(immediateLines).toEqual(['the name steadies', 'ten coin leaves the till'])
  })

  it('does not displace a surfaced coin cost (cost-rescue preserved)', () => {
    const seed = activeSeed({
      slotId: 'pay_it',
      verb: 'pay',
      immediate: [
        // Three immediate effects with the cost LAST — under the cap the
        // cost-rescue keeps it; the delayed line must be additive on top.
        effect('state_change', 'reputation.respectable', 4, 'respectable rises', ['reputation']),
        effect('state_change', 'reputation.tasty', 3, 'tasty rises', ['reputation']),
        effect('state_change', 'coin', -12, 'twelve coin leaves the till', ['coin']),
      ],
      delayed: [
        effect('future_hook', 'expectation_hook', 8, 'they will expect it again', ['future_hook']),
      ],
    })
    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: EMPTY_PREVIEW_POOL,
    })
    const lines = choice!.previewEffects
    expect(lines.some((l) => l.includes('coin leaves the till'))).toBe(true)
    expect(lines.filter(isLaterPreviewLine)).toHaveLength(1)
  })

  it('the inaction path is unchanged — delayed effects preview WITHOUT a later: prefix', () => {
    const seed = activeSeed({
      slotId: 'ignore_it',
      verb: 'ignore',
      shape: 'ignore',
      immediate: [],
      delayed: [
        effect('future_hook', 'expectation_hook', 8, 'they will remember this', ['future_hook']),
      ],
    })
    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: EMPTY_PREVIEW_POOL,
    })
    expect(choice!.previewEffects).toEqual(['they will remember this'])
    expect(choice!.previewEffects.some(isLaterPreviewLine)).toBe(false)
  })
})

describe('Phase 189 / ISSUE-156 — Plan B: the spillover line names the other actor', () => {
  const state = createInitialTavernState()

  it('names a non-primary staff actor a previewed effect moves', () => {
    // staff "server" resolves to "Mira the Resolute"; the primary actor is the
    // miners group, so the staff is the blast-radius actor.
    const seed = activeSeed({
      slotId: 'back_the_staff',
      immediate: [effect('state_change', 'staff.server.loyalty', 12, 'staff backed', ['staff'])],
      delayed: [],
    })
    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: COMPOSING_PREVIEW_POOL,
    })
    expect(choice!.previewEffects[0]).toContain('Mira the Resolute')
  })

  it('does NOT name the primary actor (the card already centres on it)', () => {
    // The effect moves the miners group — the primary actor — so no spillover
    // attribution: re-naming the primary would be noise.
    const seed = activeSeed({
      slotId: 'soothe_group',
      primaryActor: MINERS,
      immediate: [
        effect('state_change', 'customers.miners.satisfaction', 10, 'group warms', ['customer']),
      ],
      delayed: [],
    })
    const [choice] = composeChoicesFromSeed(seed, state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: COMPOSING_PREVIEW_POOL,
    })
    // The composed line is the bare generic line — no parenthetical actor name.
    expect(choice!.previewEffects[0]).toBe('the meter shifts a step')
  })
})
