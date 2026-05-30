// Phase 182 / ISSUE-150 — Choice-Preview Legibility arc, Phase 2.
//
// Selection policy: the preview must surface the choice's headline meter,
// its coin cost, AND its headline risk within the cap — never two vague
// lines while the deciding fact (a relieved/incurred pressure) hides past
// the cap. And no choice may render a literal duplicate line.

import { describe, expect, it } from 'vitest'

import {
  selectPreviewEffects,
  isHeadlineStateChange,
  isCostEffect,
  isRiskEffect,
  MUST_SURFACE_PREDICATES,
} from '../../../src/cards/compose/previewSelect'
import { composeChoicesFromSeed } from '../../../src/cards/cardHelpers'
import type { SnippetPool } from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import { makeSeed } from '../cardFactories'

// A `publicly_back_staff_profile`-shaped consequence: the headline loyalty
// state_change first, two reputation moves, then the loyalty-risk relief
// LAST — exactly where the flat `maxPreview: 2` used to hide it.
const headlineLoyalty = effect('state_change', 'staff.mira.loyalty', 12, 'Public backing earns loyalty', ['staff'])
const repRespectable = effect('state_change', 'reputation.respectable', 5, 'Owner stood up for staff', ['reputation'])
const repDangerous = effect('state_change', 'reputation.dangerous', -3, 'Crew-defender signal', ['reputation'])
const loyaltyRiskRelief = effect('pressure', 'pressure:staff_loyalty_risk', -8, 'Loyalty risk eases', ['pressure'])

const PUBLICLY_BACK_EFFECTS = [headlineLoyalty, repRespectable, repDangerous, loyaltyRiskRelief]

describe('Phase 182 — selectPreviewEffects decision-relevance', () => {
  it('surfaces the headline risk relief within the cap (it sat past it before)', () => {
    const selected = selectPreviewEffects(PUBLICLY_BACK_EFFECTS, 3)
    expect(selected).toContain(loyaltyRiskRelief)
    // The headline meter is still shown too.
    expect(selected).toContain(headlineLoyalty)
    // Cap respected.
    expect(selected.length).toBe(3)
  })

  it('still surfaces a coin cost that sits past the cap (Phase 166 rescue holds)', () => {
    const cost = effect('state_change', 'coin', -20, 'Appeasement cost', ['coin'])
    const source = [
      effect('state_change', 'staff.mira.morale', 6, 'Morale lifts', ['staff']),
      effect('state_change', 'customers.miners.satisfaction', 5, 'Guests warm', ['customer']),
      effect('state_change', 'reputation.respectable', 4, 'Name lifts', ['reputation']),
      cost,
    ]
    const selected = selectPreviewEffects(source, 3)
    expect(selected).toContain(cost)
  })

  it('returns effects in source order so lines read top-to-bottom as authored', () => {
    const selected = selectPreviewEffects(PUBLICLY_BACK_EFFECTS, 3)
    const indices = selected.map((e) => PUBLICLY_BACK_EFFECTS.indexOf(e))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  it('returns all effects untouched when the source fits the cap', () => {
    const source = PUBLICLY_BACK_EFFECTS.slice(0, 2)
    expect(selectPreviewEffects(source, 3)).toEqual(source)
  })

  it('returns nothing for a non-positive cap', () => {
    expect(selectPreviewEffects(PUBLICLY_BACK_EFFECTS, 0)).toEqual([])
  })

  it('exports enumerable must-surface predicates in priority order', () => {
    expect(MUST_SURFACE_PREDICATES).toEqual([
      isHeadlineStateChange,
      isCostEffect,
      isRiskEffect,
    ])
    expect(isHeadlineStateChange(headlineLoyalty)).toBe(true)
    expect(isCostEffect(effect('state_change', 'coin', -20, 'cost', ['coin']))).toBe(true)
    expect(isRiskEffect(loyaltyRiskRelief)).toBe(true)
    // A non-pressure effect is not a risk; a non-coin negative is not a cost.
    expect(isRiskEffect(headlineLoyalty)).toBe(false)
    expect(isCostEffect(repDangerous)).toBe(false)
  })
})

// ---- de-duplication through composeChoicesFromSeed ----

function buildSeed(profiles: ConsequenceProfile[]): IssueSeed {
  const slots: ResponseSlot[] = profiles.map((p) => ({
    id: p.responseSlotId,
    labelHint: `Slot ${p.responseSlotId}`,
    allowedVerbs: ['appease'],
    shape: 'safe_costly',
    targetOptions: [],
    expectedEffects: [],
  }))
  return makeSeed({
    id: 'phase182-dedup-seed',
    family: 'staff_identity',
    type: 'staff_request',
    timing: 'morning_prep',
    severity: 40,
    domain: ['staff'],
    responseSlots: slots,
    consequenceProfiles: profiles,
  })
}

const EMPTY_LABEL_POOL: SnippetPool = { slotId: 'choice_label', snippets: [] }

// One unconditional preview snippet — every effect composes the SAME text,
// so without de-dup a multi-effect choice would render literal duplicates.
const ONE_LINE_POOL: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [{ id: 'one', text: 'a clear lift would steady the crew', conditions: [] }],
}

describe('Phase 182 — composeChoicesFromSeed never renders a literal duplicate line', () => {
  const state = createInitialTavernState()

  it('falls a duplicate line back to the effect distinct readable', () => {
    // Two distinct staff meters in the same coarse cell (loyalty +10 and
    // stress −8, both staff/positive/medium) — the Appendix-A duplicate case.
    const profiles: ConsequenceProfile[] = [
      {
        id: 'comfort',
        responseSlotId: 'comfort',
        immediateEffects: [
          effect('state_change', 'staff.mira.loyalty', 10, 'Loyalty rises', ['staff']),
          effect('state_change', 'staff.mira.stress', -8, 'Stress drops', ['staff']),
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ]
    const choices = composeChoicesFromSeed(buildSeed(profiles), state, {
      labelPool: EMPTY_LABEL_POOL,
      previewPool: ONE_LINE_POOL,
    })
    const lines = choices[0]!.previewEffects
    expect(lines).toHaveLength(2)
    // No two identical lines.
    expect(new Set(lines).size).toBe(lines.length)
    // First keeps the composed line; the duplicate falls back to its readable.
    expect(lines[0]).toBe('a clear lift would steady the crew')
    expect(lines[1]).toBe('Stress drops')
  })

  it('keeps lines distinct across two choices when the pool runs out of candidates', () => {
    const mkProfile = (id: string): ConsequenceProfile => ({
      id,
      responseSlotId: id,
      immediateEffects: [
        effect('state_change', `staff.${id}.morale`, 6, `${id} morale lifts`, ['staff']),
      ],
      delayedEffects: [],
      memories: [],
      futureHooks: [],
      impactScore: 0,
    })
    const choices = composeChoicesFromSeed(
      buildSeed([mkProfile('reduce'), mkProfile('reassign')]),
      state,
      { labelPool: EMPTY_LABEL_POOL, previewPool: ONE_LINE_POOL },
    )
    const all = choices.flatMap((c) => c.previewEffects)
    // The single shared candidate is used once; the second choice falls back
    // to its distinct readable, so no line collides across choices.
    expect(new Set(all).size).toBe(all.length)
  })
})
