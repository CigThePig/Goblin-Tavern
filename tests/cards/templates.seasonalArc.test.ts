// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Integration tests for `seasonalArcCard` — the first dedicated card
// for the `seasonal_arc` family (pre-Phase 14 these seeds routed to
// `fallbackCard`). One template covers BOTH the active-arc Path A
// (primaryActor is a `local_event` ref) and the anticipation Path B
// (no primaryActor); both paths render through the same pools because
// `local_event` refs have no `castAttributes` either way.
// Narrator-voiced — variety comes from theme tags (5 themes in
// `seed.toneHints`), arc pressures, memories, severity.

import { describe, expect, it } from 'vitest'

import {
  seasonalArcCard,
  fallbackCard,
} from '../../src/cards/index'
import { pickCardForSeed } from '../../src/cards/selection'
import {
  seasonalArcChoiceLabelPool,
  seasonalArcEstablishingLinePool,
  seasonalArcMannerNotePool,
  seasonalArcReactionLinePool,
  seasonalArcTitlePool,
} from '../../src/cards/compose/pools/seasonalArc'
import type {
  SnippetCondition,
  SnippetPool,
} from '../../src/cards/compose/types'
import { REQUIRED_CARDS } from '../../src/cards/templates/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../src/sim/state/TavernState'
import { makeSeed } from './cardFactories'

function arcRef(id: string): EntityRef {
  return { kind: 'local_event', id }
}

function seasonalArcSeed(
  options: {
    id?: string
    type?: 'arc_milestone' | 'festival_preparation'
    primaryActor?: EntityRef
    theme?: string
    severity?: number
  } = {},
): IssueSeed {
  const id = options.id ?? 'seasonal-arc-seed'
  const theme = options.theme ?? 'festival_approaching'
  const type = options.type ?? 'festival_preparation'
  const ref = options.primaryActor
  return makeSeed({
    id,
    family: 'seasonal_arc' as IssueSeedFamilyId,
    type,
    timing: 'morning_prep',
    severity: options.severity ?? 45,
    domain: ['arcs', 'calendar'],
    toneHints: ['arc', 'calendar', theme],
    ...(ref ? { primaryActor: ref } : {}),
    responseSlots: [
      {
        id: `${id}-prep`,
        labelHint: 'Prepare for the arc',
        allowedVerbs: ['upgrade'],
        shape: 'long_term_investment',
        targetOptions: [],
        expectedEffects: ['raise readiness'],
      },
      {
        id: `${id}-host`,
        labelHint: 'Host the moment',
        allowedVerbs: ['invite'],
        shape: 'risky_profitable',
        targetOptions: [],
        expectedEffects: ['gain reputation'],
      },
      {
        id: `${id}-ignore`,
        labelHint: 'Ignore the warning',
        allowedVerbs: ['ignore'],
        shape: 'ignore',
        targetOptions: [],
        expectedEffects: ['arc deepens'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-prep-profile`,
        responseSlotId: `${id}-prep`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:festival_readiness',
            amount: -10,
            readable: 'readiness lifts',
            tags: ['pressure', 'arc'],
          },
          {
            kind: 'state_change',
            target: 'coin',
            amount: -20,
            readable: 'invest coin',
            tags: ['coin'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
      {
        id: `${id}-host-profile`,
        responseSlotId: `${id}-host`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'reputation.tasty',
            amount: 8,
            readable: 'reputation rises',
            tags: ['reputation'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 4,
      },
      {
        id: `${id}-ignore-profile`,
        responseSlotId: `${id}-ignore`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:arc_escalation',
            amount: 10,
            readable: 'arc deepens',
            tags: ['pressure', 'arc'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
    ],
    textIngredients: {
      subject: 'the arc',
      sensoryDetails: ['flags rising', 'crowds gathering'],
      recentContext: ['intensity 25'],
      stakesReadable: ['arc may fail', 'readiness may drop'],
    },
  })
}

function withArcLabel(
  state: TavernState,
  arcId: string,
  label: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      localEvents: {
        ...state.world.localEvents,
        [arcId]: {
          ...(state.world.localEvents[arcId] ?? {
            id: arcId,
            tags: [],
            severity: 50,
          }),
          id: arcId,
          label,
        },
      } as TavernState['world']['localEvents'],
    },
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 55,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [pressureId]: {
        id: pressureId,
        label: pressureId,
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

const ESTABLISHING_TEXTS = new Set(
  seasonalArcEstablishingLinePool.snippets.map((s) => s.text),
)
const REACTION_TEXTS = new Set(
  seasonalArcReactionLinePool.snippets.map((s) => s.text),
)
const TITLE_TEXTS = new Set(seasonalArcTitlePool.snippets.map((s) => s.text))

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function poolHasActorCondition(pool: SnippetPool): boolean {
  return pool.snippets.some((snippet) =>
    snippet.conditions.some(
      (c: SnippetCondition) =>
        c.kind === 'voiceAxis' || c.kind === 'verbalTic' || c.kind === 'actorTrait',
    ),
  )
}

describe('seasonalArcCard — appliesTo', () => {
  const state = createInitialTavernState()

  it('is registered in REQUIRED_CARDS', () => {
    expect(REQUIRED_CARDS).toContain(seasonalArcCard)
  })

  it('matches a festival_preparation seed (Path B anticipation, no primaryActor)', () => {
    const seed = seasonalArcSeed()
    const chosen = pickCardForSeed(seed, state, REQUIRED_CARDS)
    expect(chosen?.id).toBe(seasonalArcCard.id)
  })

  it('matches an arc_milestone seed with an active arc primaryActor (Path A)', () => {
    const arcId = 'mushroom_festival_arc'
    const stateWithArc = withArcLabel(state, arcId, 'The Mushroom Festival')
    const seed = seasonalArcSeed({
      id: 'seasonal-arc-active',
      type: 'arc_milestone',
      primaryActor: arcRef(arcId),
      theme: 'festival_approaching',
    })
    const chosen = pickCardForSeed(seed, stateWithArc, REQUIRED_CARDS)
    expect(chosen?.id).toBe(seasonalArcCard.id)
  })

  it('does not match a closing timing (falls back)', () => {
    const seed = seasonalArcSeed({ id: 'seasonal-arc-wrong-timing' })
    const mismatched: IssueSeed = { ...seed, timing: 'closing' }
    const chosen = pickCardForSeed(mismatched, state, REQUIRED_CARDS)
    expect(chosen?.id).not.toBe(seasonalArcCard.id)
    expect(chosen?.id).toBe(fallbackCard.id)
  })
})

describe('seasonalArcCard — render output', () => {
  it('body[0] is the sim-backed establishing line; body[1] is the flavor reaction', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed()
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[0]).toBeDefined()
    expect(view.body[1]).toBeDefined()
    expect(ESTABLISHING_TEXTS.has(view.body[0]!)).toBe(true)
    expect(REACTION_TEXTS.has(view.body[1]!)).toBe(true)
    expect(wordCount(view.body[0]!)).toBeLessThanOrEqual(14)
    expect(wordCount(view.body[1]!)).toBeLessThanOrEqual(12)
  })

  it('body never surfaces raw textIngredients fragments', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed()
    const view = seasonalArcCard.render(seed, state)
    for (const line of view.body) {
      expect(line).not.toBe('flags rising')
      expect(line).not.toBe('crowds gathering')
      expect(line).not.toBe('intensity 25')
    }
  })

  it('title prefix is the arc label when an active local_event resolves (Path A)', () => {
    const arcId = 'mushroom_festival_arc'
    const state = withArcLabel(createInitialTavernState(), arcId, 'The Mushroom Festival')
    const seed = seasonalArcSeed({
      id: 'seasonal-arc-active-title',
      type: 'arc_milestone',
      primaryActor: arcRef(arcId),
      theme: 'festival_approaching',
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.title.startsWith('The Mushroom Festival: ')).toBe(true)
    const snippet = view.title.slice('The Mushroom Festival: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
    expect(view.title).not.toContain('…')
    expect(view.title).not.toContain('...')
  })

  it('title prefix falls back to the theme label when no primaryActor (Path B anticipation)', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed({
      id: 'seasonal-arc-anticipation-title',
      theme: 'mushroom_blight',
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.title.startsWith('Mushroom blight: ')).toBe(true)
    const snippet = view.title.slice('Mushroom blight: '.length)
    expect(TITLE_TEXTS.has(snippet)).toBe(true)
  })

  it('establishing_line fires the climax snippet for arc_milestone type + rising arc_escalation', () => {
    const state = createInitialTavernState()
    const arcId = 'climax_arc'
    let stateWithArc = withArcLabel(state, arcId, 'The Climax')
    // Phase 14: the climax snippet has specificity 2 (seedType +
    // pressureRising — the latter is the sim-coherence co-condition,
    // since seedType is seed-shape not state-lookup). The festival
    // theme snippet (festival tag + festival_readiness rising) does
    // NOT fire because festival_readiness is flat. So the climax
    // snippet wins.
    stateWithArc = withRisingPressure(stateWithArc, 'arc_escalation')
    const seed = seasonalArcSeed({
      id: 'seasonal-arc-climax',
      type: 'arc_milestone',
      primaryActor: arcRef(arcId),
      theme: 'festival_approaching',
    })
    const view = seasonalArcCard.render(seed, stateWithArc)
    expect(view.body[0]).toBe(
      'The arc has reached the day the room cannot ignore.',
    )
  })

  it('establishing_line fires the rising arc_escalation snippet when arc_escalation trends positive', () => {
    const state = createInitialTavernState()
    const rising = withRisingPressure(state, 'arc_escalation')
    const seed = seasonalArcSeed({ id: 'seasonal-arc-escalating' })
    const view = seasonalArcCard.render(seed, rising)
    // The blight / payday / etc. theme snippets have specificity 2
    // (theme tag + arc-escalation pressure); the bare arc_escalation
    // snippet has specificity 1. With festival_approaching as the
    // theme, the theme snippet (festival_readiness + festival tag)
    // does NOT match (no festival_readiness rising). So the bare
    // arc_escalation snippet wins.
    expect(view.body[0]).toBe(
      'Arc pressure has been thickening through every closing of the week.',
    )
  })

  it('reaction_line picks the blight snippet when the theme tag is present', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed({
      id: 'seasonal-arc-blight-rxn',
      theme: 'mushroom_blight',
    })
    const view = seasonalArcCard.render(seed, state)
    expect(view.body[1]).toBe(
      'Cooks and bartenders will be measuring losses by mid-shift.',
    )
  })

  it('emits valid choices whose verbs are in seed.responseSlots.allowedVerbs', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed()
    const view = seasonalArcCard.render(seed, state)
    expect(view.choices.length).toBeGreaterThan(0)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)
      expect(slot, `slot ${choice.slotId} resolves`).toBeDefined()
      expect(slot!.allowedVerbs).toContain(choice.verb)
    }
  })

  it('preserves choice mechanical truth: verb, shape, preview count unchanged by composition', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed()
    const view = seasonalArcCard.render(seed, state)
    for (const choice of view.choices) {
      const slot = seed.responseSlots.find((s) => s.id === choice.slotId)!
      const profile = seed.consequenceProfiles.find(
        (p) => p.responseSlotId === slot.id,
      )!
      expect(slot.allowedVerbs).toContain(choice.verb)
      expect(slot.shape).toBe(choice.shape)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(2)
      expect(choice.previewEffects.length).toBeLessThanOrEqual(
        profile.immediateEffects.length,
      )
    }
  })

  it('tags and severity flow from the seed', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed({ id: 'seasonal-arc-tag', severity: 75 })
    const view = seasonalArcCard.render(seed, state)
    expect(view.tag).toBe('seasonal_arc')
    expect(view.severity).toBe(75)
  })

  it('is deterministic — same seed + state ⇒ identical CardView', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed({ id: 'seasonal-arc-deterministic' })
    const a = seasonalArcCard.render(seed, state)
    const b = seasonalArcCard.render(seed, structuredClone(state) as TavernState)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('does not mutate state', () => {
    const state = createInitialTavernState()
    const seed = seasonalArcSeed()
    const before = JSON.stringify(state)
    seasonalArcCard.render(seed, state)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('does not collide between themes — mushroom_blight establishing line cannot appear for a festival_approaching seed', () => {
    const state = withRisingPressure(createInitialTavernState(), 'arc_escalation')
    const blightSeed = seasonalArcSeed({
      id: 'seasonal-arc-blight-theme',
      theme: 'mushroom_blight',
    })
    const festivalSeed = seasonalArcSeed({
      id: 'seasonal-arc-festival-theme',
      theme: 'festival_approaching',
    })
    const blightView = seasonalArcCard.render(blightSeed, state)
    const festivalView = seasonalArcCard.render(festivalSeed, state)
    expect(blightView.body[0]).toBe(
      'A mushroom blight is biting the supply lanes wide open.',
    )
    // festival theme + arc_escalation rising: the theme snippet for
    // festival fires on festival_readiness (NOT arc_escalation), so the
    // bare arc_escalation snippet wins.
    expect(festivalView.body[0]).toBe(
      'Arc pressure has been thickening through every closing of the week.',
    )
    expect(festivalView.body[0]).not.toBe(blightView.body[0])
  })
})

describe('seasonalArcCard — ownerless guarantee', () => {
  it('every pool is free of actor-voice conditions (local_event refs carry no castAttributes)', () => {
    expect(poolHasActorCondition(seasonalArcTitlePool)).toBe(false)
    expect(poolHasActorCondition(seasonalArcEstablishingLinePool)).toBe(false)
    expect(poolHasActorCondition(seasonalArcReactionLinePool)).toBe(false)
    expect(poolHasActorCondition(seasonalArcMannerNotePool)).toBe(false)
    expect(poolHasActorCondition(seasonalArcChoiceLabelPool)).toBe(false)
  })
})
