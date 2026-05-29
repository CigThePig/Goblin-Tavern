// Phase 164 / ISSUE-132 — Faithful Surface arc, Phase 2 (Meter Valence).
//
// End-to-end proof that valence-aware `direction` makes inverted-meter effects
// render the correct good/bad-toned preview line with a matching magnitude
// token. Before Phase 164, `staff.stress -8` (a kindness) classified `negative`
// and rendered the "things got worse" staff line; now it classifies `positive`
// and renders the "things eased" line. Pressure stays on arithmetic sign and is
// guarded here so a future phase doesn't fold it into the valence map.

import { describe, expect, it } from 'vitest'

import { pickSnippet } from '../../../src/cards/compose/assemble'
import { narratorEffectPreviewBase } from '../../../src/cards/compose/pools/_shared/effectPreviewBase'
import { lineCarriesMagnitude } from '../../../src/cards/compose/magnitudeLexicon'
import type {
  ConditionContext,
  SlotSpec,
  Snippet,
  SnippetPool,
} from '../../../src/cards/compose/types'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import { effect } from '../../../src/sim/modules/issues/generatorHelpers'
import type {
  EffectDirection,
  EffectMagnitudeBand,
  EffectPreview,
} from '../../../src/sim/core/effect'
import { makeSeed } from '../cardFactories'

const BASE: Snippet[] = narratorEffectPreviewBase()
const state = createInitialTavernState()
const seed = makeSeed({
  id: 'phase164-valence',
  family: 'staff_identity',
  type: 'relationship_test',
  timing: 'morning_prep',
  severity: 40,
  domain: ['staff'],
})
const pool: SnippetPool = { slotId: 'effect_preview', snippets: BASE }

function renderEffect(target: string, amount: number, tags: string[]): {
  text: string
  direction: EffectDirection
  band: EffectMagnitudeBand | undefined
} {
  const e = effect('state_change', target, amount, 'readable stub', tags)
  const slot: SlotSpec = {
    id: `effect_preview::valence::0`,
    role: 'effect_preview',
    pool,
    optional: true,
    wordBudget: 10,
    claimMode: 'flavor',
  }
  const ctx: ConditionContext = { currentEffect: e as EffectPreview }
  const text = pickSnippet(slot, seed, state, ctx)
  expect(text, `a snippet fired for ${target} ${amount}`).toBeDefined()
  return { text: text!, direction: e.direction!, band: e.magnitudeBand }
}

describe('Phase 164 — meter valence renders the correct-tone preview line', () => {
  it('staff.stress reduction (kindness) renders a positive line with a positive magnitude token', () => {
    const r = renderEffect('staff.mira.stress', -8, ['staff'])
    expect(r.direction).toBe('positive')
    expect(lineCarriesMagnitude(r.text, 'positive', r.band!)).toBe(true)
  })

  it('staff.stress increase (a worsening) renders a negative line with a negative magnitude token', () => {
    const r = renderEffect('staff.mira.stress', 8, ['staff'])
    expect(r.direction).toBe('negative')
    expect(lineCarriesMagnitude(r.text, 'negative', r.band!)).toBe(true)
  })

  it('area.damage repair renders a positive line; accrual renders a negative line', () => {
    const repair = renderEffect('areas.kitchen.damage', -20, ['area'])
    expect(repair.direction).toBe('positive')
    expect(lineCarriesMagnitude(repair.text, 'positive', repair.band!)).toBe(true)

    const accrual = renderEffect('areas.kitchen.damage', 6, ['area'])
    expect(accrual.direction).toBe('negative')
  })

  it('culture.tension relief renders a positive line; rise renders a negative line', () => {
    const relief = renderEffect('cultures.dwarven.tension', -10, ['culture'])
    expect(relief.direction).toBe('positive')
    expect(lineCarriesMagnitude(relief.text, 'positive', relief.band!)).toBe(true)

    const rise = renderEffect('cultures.dwarven.tension', 12, ['culture'])
    expect(rise.direction).toBe('negative')
  })

  it('higher-is-better meters are unaffected (cleanliness up = positive, morale down = negative)', () => {
    const clean = renderEffect('areas.kitchen.cleanliness', 25, ['area'])
    expect(clean.direction).toBe('positive')
    expect(lineCarriesMagnitude(clean.text, 'positive', clean.band!)).toBe(true)

    const morale = renderEffect('staff.cook.morale', -12, ['staff'])
    expect(morale.direction).toBe('negative')
    expect(lineCarriesMagnitude(morale.text, 'negative', morale.band!)).toBe(true)
  })

  it('pressure stays on arithmetic sign (rising = positive) — excluded from valence', () => {
    // The pressure pool encodes threat-vs-relief in the verbs; its direction
    // must NOT invert or the threat/relief verbs land on the wrong outcome.
    const rise = effect('pressure', 'pressure:food_safety', 12, 'rising', ['pressure'])
    expect(rise.direction).toBe('positive')
    const relief = effect('pressure', 'pressure:food_safety', -12, 'relief', ['pressure'])
    expect(relief.direction).toBe('negative')
  })
})
