// Phase 4b (teleology) — integration tests for `staffArcCard`, the first
// dedicated arc card. Narrator-voiced; the seed's primaryActor is a
// `system` arc ref carrying no castAttributes. The card resolves the arc
// from `state.arcs` and reads the entry's live stage — never a hardcoded id.

import { describe, expect, it } from 'vitest'

import { staffArcCard, fallbackCard } from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  staffArcEstablishingLinePool,
  staffArcReactionLinePool,
  staffArcTitlePool,
} from '../../src/cards/compose/pools/staffArc'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { createStaffMasteryArc, STAFF_MASTERY_ARC_ID } from '../../src/sim/modules/arcs'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'
import type { EntityRef, TavernState } from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function arcRef(): EntityRef {
  return { kind: 'system', id: `arc:${STAFF_MASTERY_ARC_ID}` }
}

function staffArcSeed(opts: { id?: string; stage?: string; proven?: boolean } = {}): IssueSeed {
  const id = opts.id ?? 'staff-arc-seed'
  const stage = opts.stage ?? 'apprentice'
  const toneHints = ['teleology', 'arc', 'staff_arc', `stage:${stage}`]
  if (opts.proven) toneHints.push('proven')
  return makeSeed({
    id,
    family: 'staff_arc',
    type: 'arc_milestone',
    timing: 'morning_prep',
    severity: 40,
    domain: ['teleology', 'arc', 'staff_arc', `stage:${stage}`],
    toneHints,
    primaryActor: arcRef(),
    responseSlots: [
      {
        id: 'mark_milestone',
        labelHint: 'Mark the milestone with them',
        allowedVerbs: ['promote'],
        shape: 'long_term_investment',
        targetOptions: [arcRef()],
        expectedEffects: ['Recognise the growth'],
      },
      {
        id: 'let_it_unfold',
        labelHint: 'Let them find their own way',
        allowedVerbs: ['delay'],
        shape: 'delay_problem',
        targetOptions: [arcRef()],
        expectedEffects: ['Say nothing of it'],
      },
    ],
    consequenceProfiles: [
      {
        id: 'mark_milestone',
        responseSlotId: 'mark_milestone',
        immediateEffects: [
          {
            kind: 'cause',
            target: STAFF_MASTERY_ARC_ID,
            amount: 0,
            readable: 'The owner takes note of how far they have come.',
            tags: ['teleology', 'arc', 'staff_arc', STAFF_MASTERY_ARC_ID],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 8,
      },
      {
        id: 'let_it_unfold',
        responseSlotId: 'let_it_unfold',
        immediateEffects: [
          {
            kind: 'cause',
            target: STAFF_MASTERY_ARC_ID,
            amount: 0,
            readable: 'The owner lets the moment pass without remark.',
            tags: ['teleology', 'arc', 'staff_arc', 'quiet', STAFF_MASTERY_ARC_ID],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 1,
      },
    ],
    textIngredients: {
      subject: "the server's path to mastery",
      sensoryDetails: ['a steadier hand at the work'],
      recentContext: [`stage ${stage}`],
      stakesReadable: ['A character settling into who they are'],
    },
  })
}

function withArc(state: TavernState, stage: string, label = "Mira's path to mastery"): TavernState {
  const arc = createStaffMasteryArc(label, 0)
  return {
    ...state,
    arcs: { ...state.arcs, [STAFF_MASTERY_ARC_ID]: { ...arc, stage } },
  }
}

const TITLE_TEXTS = new Set(staffArcTitlePool.snippets.map((s) => s.text))
const EST_TEXTS = new Set(staffArcEstablishingLinePool.snippets.map((s) => s.text))
const RXN_TEXTS = new Set(staffArcReactionLinePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('staffArcCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(staffArcCard)
  })

  it('matches a staff_arc / arc_milestone / morning_prep seed', () => {
    const seed = staffArcSeed()
    expect(pickCardForSeed(seed, state, REQUIRED_CARDS)?.id).toBe(staffArcCard.id)
  })

  it('does not match a closing timing (falls back)', () => {
    const seed: IssueSeed = { ...staffArcSeed(), timing: 'closing' }
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(staffArcCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('staffArcCard — render output', () => {
  it('title prefix is the arc label resolved from state; suffix is a pool snippet', () => {
    const state = withArc(createInitialTavernState(), 'journeyman')
    const view = staffArcCard.render(staffArcSeed({ stage: 'journeyman' }), state)
    expect(view.title.startsWith("Mira's path to mastery: ")).toBe(true)
    const snippet = view.title.slice("Mira's path to mastery: ".length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
  })

  it('body lines come from the pools and respect word budgets', () => {
    const state = withArc(createInitialTavernState(), 'apprentice')
    const view = staffArcCard.render(staffArcSeed({ stage: 'apprentice' }), state)
    expect(EST_TEXTS.has(view.body[0]!)).toBe(true)
    expect(RXN_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('reads the live stage: a journeyman seed fires the journeyman establishing line', () => {
    const state = withArc(createInitialTavernState(), 'journeyman')
    const view = staffArcCard.render(staffArcSeed({ stage: 'journeyman' }), state)
    expect(view.body[0]).toBe('A journeyman now carries the work with real confidence.')
  })

  it('emits choices whose verbs are in the seed responseSlots', () => {
    const state = createInitialTavernState()
    const seed = staffArcSeed()
    const view = staffArcCard.render(seed, state)
    expect(view.choices.length).toBe(2)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot?.allowedVerbs).toContain(choice.verb)
    }
    // Distinct labels (legibility choice_label_collision guard).
    expect(view.choices[0]!.label).not.toBe(view.choices[1]!.label)
  })

  it('tags and severity flow from the seed', () => {
    const view = staffArcCard.render(staffArcSeed({ id: 'sa-tag' }), createInitialTavernState())
    expect(view.tag).toBe('staff_arc')
    expect(view.severity).toBe(40)
  })

  it('is deterministic and does not mutate state', () => {
    const state = withArc(createInitialTavernState(), 'apprentice')
    const seed = staffArcSeed()
    const before = JSON.stringify(state)
    const a = staffArcCard.render(seed, state)
    const b = staffArcCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(state)).toBe(before)
  })
})
