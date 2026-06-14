// Phase 168 / ISSUE-136 — Complete Surface arc, Phase 1 (Gate-Wiring
// Contract).
//
// Coverage is a contract, not a hand-maintained list. This test derives
// the required template set from `REQUIRED_CARDS` (the single source of
// truth) and fails if any migrated template is absent from a cross-sim
// harness or the full-gate walk. A template added to `REQUIRED_CARDS` but
// forgotten in `LEGIBILITY_SITUATIONS`, `FULL_GATE_SITUATIONS`,
// `cardRegistry` (the faithfulness walk), or — when actor-voiced —
// `CROSS_SITUATION_ACTOR_KINDS` makes this test red, naming the gap.

import { describe, expect, it } from 'vitest'

import {
  FALLBACK_CARD_ID,
  REQUIRED_CARDS,
} from '../../../../src/cards/templates/index'
import { cardRegistry } from '../../../../src/cards/registry'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import { LEGIBILITY_SITUATIONS } from './legibilityHarness'
import { CROSS_SITUATION_ACTOR_KINDS } from './crossSituationHarness'
import {
  CARD_TEMPLATE_EXCLUDED_GATES,
  FULL_GATE_SITUATIONS,
} from './fullGateHarness'

/** The migrated templates the harnesses must cover — every `REQUIRED_CARDS`
 *  entry except the catch-all fallback. */
const NON_COMPOSITIONAL_CARD_IDS = new Set([FALLBACK_CARD_ID, 'venture.current_stage', 'opening.opportunity'])
const REQUIRED_IDS: readonly string[] = REQUIRED_CARDS.map((c) => c.id).filter(
  (id) => !NON_COMPOSITIONAL_CARD_IDS.has(id),
)

/** A template is actor-voiced — and so must appear in the cross-situation
 *  voice harness — iff any of its body/title slots' pool snippets carry a
 *  `voiceAxis` or `verbalTic` condition. The runtime templates' `.slots`
 *  never include the choice-label / effect-preview pools (those are passed
 *  to `composeChoicesFromSeed`, not declared as slots), so no exclusion is
 *  needed. Derived structurally from the template object — never a list. */
function isActorVoiced(template: CompositionalCardTemplate): boolean {
  return template.slots.some((slot) =>
    slot.pool.snippets.some((sn) =>
      sn.conditions.some(
        (c) => c.kind === 'voiceAxis' || c.kind === 'verbalTic',
      ),
    ),
  )
}

const FULL_GATE_TEMPLATES = new Map(
  FULL_GATE_SITUATIONS.map((s) => [s.templateId, s.template] as const),
)

function missing(have: ReadonlySet<string>): string[] {
  return REQUIRED_IDS.filter((id) => !have.has(id))
}

describe('harness completeness — derived from REQUIRED_CARDS', () => {
  it('every non-fallback template is in the full-gate walk', () => {
    const have = new Set(FULL_GATE_SITUATIONS.map((s) => s.templateId))
    const gaps = missing(have)
    expect(gaps, `missing from FULL_GATE_SITUATIONS: ${gaps.join(', ')}`).toEqual(
      [],
    )
  })

  it('every non-fallback template is in the legibility harness', () => {
    const have = new Set(LEGIBILITY_SITUATIONS.map((s) => s.templateId))
    const gaps = missing(have)
    expect(gaps, `missing from LEGIBILITY_SITUATIONS: ${gaps.join(', ')}`).toEqual(
      [],
    )
  })

  it('every non-fallback template is a faithfulness candidate (registered card)', () => {
    // `faithfulnessHarness` walks `cardRegistry.all()` dynamically, so
    // registry membership IS faithfulness coverage.
    const have = new Set(cardRegistry.all().map((c) => c.id))
    const gaps = missing(have)
    expect(gaps, `missing from cardRegistry: ${gaps.join(', ')}`).toEqual([])
  })

  it('every actor-voiced template is in the cross-situation voice harness', () => {
    const crossIds = new Set(
      CROSS_SITUATION_ACTOR_KINDS.flatMap((k) => k.templateIds),
    )
    const actorVoicedRequired = REQUIRED_IDS.filter((id) => {
      const template = FULL_GATE_TEMPLATES.get(id)
      return template !== undefined && isActorVoiced(template)
    })
    // Sanity: the structural derivation reproduces the documented set of
    // 11 actor-voiced templates the crossSituation harness was authored
    // against. A drift here means a new actor-voiced template (or a pool
    // that gained/lost a voice condition) — investigate before adjusting.
    expect(actorVoicedRequired.length).toBe(11)
    const gaps = actorVoicedRequired.filter((id) => !crossIds.has(id))
    expect(
      gaps,
      `actor-voiced templates missing from CROSS_SITUATION_ACTOR_KINDS: ${gaps.join(', ')}`,
    ).toEqual([])
  })

  it('no harness registers a template that is not in REQUIRED_CARDS (no stale entries)', () => {
    const requiredSet = new Set(REQUIRED_CARDS.map((c) => c.id))
    const allRegistered = [
      ...FULL_GATE_SITUATIONS.map((s) => s.templateId),
      ...LEGIBILITY_SITUATIONS.map((s) => s.templateId),
      ...CROSS_SITUATION_ACTOR_KINDS.flatMap((k) => k.templateIds),
    ]
    const stale = [...new Set(allRegistered)].filter(
      (id) => !requiredSet.has(id),
    )
    expect(stale, `harness entries not in REQUIRED_CARDS: ${stale.join(', ')}`).toEqual(
      [],
    )
  })

  it('records the report-only gate exclusion as data', () => {
    // `reportLegibility` legitimately does not apply to card templates
    // (its band lives in a routing tag; card snippets never gate on
    // band-bearing tags). Recorded as data so the exclusion is inspectable
    // rather than silent.
    expect(CARD_TEMPLATE_EXCLUDED_GATES).toContain('reportLegibility')
  })
})
