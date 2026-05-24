// Phase 143 / ISSUE-112 — Voiced Surface arc, Phase 17 (Cross-Situation
// Voice Consistency).
//
// Two suites:
//
//   1. The live suite — runs `checkCrossSituationVoice` against every
//      registered actor kind and the real migrated pools. Expects
//      `report.pass === true`. Any kind failing here is a content debt
//      to be filed as a Phase 18 follow-on, per the Phase-17 plan's
//      "feed gaps back to the spec author" rule — not patched in this
//      phase.
//
//   2. The failure-fixture suite — three synthetic templates each
//      designed to fail one rule. Each fixture proves the corresponding
//      violation reason fires, so the gate is provably load-bearing.

import { describe, expect, it } from 'vitest'

import {
  checkCrossSituationVoice,
  type CrossSituationActorKind,
  type CrossSituationArchetype,
  type CrossSituationSample,
} from '../../../../src/cards/compose/gates'
import {
  CROSS_SITUATION_ACTOR_KINDS,
  CROSS_SITUATION_ARCHETYPES,
} from './crossSituationHarness'
import { __testing } from './samplers'
const { drinkOrderSeedFor } = __testing
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import type {
  CompositionalCardTemplate,
  Snippet,
  SlotSpec,
} from '../../../../src/cards/compose/types'
import type {
  CastAttributes,
  VoiceProfile,
} from '../../../../src/sim/content/cast'

// ---------------------------------------------------------------------
// Live suite — the real pools.
// ---------------------------------------------------------------------

describe('Phase 17 — cross-situation voice consistency (live pools)', () => {
  it('every registered actor kind passes the cross-situation gate', () => {
    const report = checkCrossSituationVoice({
      kinds: CROSS_SITUATION_ACTOR_KINDS,
      archetypes: CROSS_SITUATION_ARCHETYPES,
    })
    if (!report.pass) {
      // Surface the first ~10 violations so the failure mode is legible
      // in CI output. The full violations list lives in report.violations.
      const preview = report.violations.slice(0, 10).map((v) => `${v.reason}: ${v.detail}`)
      throw new Error(
        `cross-situation gate failed with ${report.violations.length} violations:\n${preview.join('\n')}`,
      )
    }
    expect(report.pass).toBe(true)
    expect(report.observed.kinds.length).toBe(CROSS_SITUATION_ACTOR_KINDS.length)
  })

  it('records observed coverage for every archetype × every kind', () => {
    const report = checkCrossSituationVoice({
      kinds: CROSS_SITUATION_ACTOR_KINDS,
      archetypes: CROSS_SITUATION_ARCHETYPES,
    })
    for (const kind of report.observed.kinds) {
      expect(kind.archetypes.length).toBe(CROSS_SITUATION_ARCHETYPES.length)
      // Every archetype must have reached AT LEAST ONE template — if a
      // kind installs the cast but the template selector wholly rejects
      // every seed, that's a harness wiring bug we want to fail loudly on.
      for (const arch of kind.archetypes) {
        expect(arch.templatesReached).toBeGreaterThan(0)
      }
    }
  })

  it('reports voice-blind pair fractions for every actor-voiced slot in every kind', () => {
    const report = checkCrossSituationVoice({
      kinds: CROSS_SITUATION_ACTOR_KINDS,
      archetypes: CROSS_SITUATION_ARCHETYPES,
    })
    for (const kind of report.observed.kinds) {
      // Each kind covers at least one actor-voiced slot per template.
      expect(kind.voiceBlindPairs.length).toBeGreaterThan(0)
      for (const pair of kind.voiceBlindPairs) {
        expect(pair.totalSamples).toBeGreaterThan(0)
        expect(pair.fraction).toBeGreaterThanOrEqual(0)
        expect(pair.fraction).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is deterministic — two calls return identical violation lists', () => {
    const a = checkCrossSituationVoice({
      kinds: CROSS_SITUATION_ACTOR_KINDS,
      archetypes: CROSS_SITUATION_ARCHETYPES,
    })
    const b = checkCrossSituationVoice({
      kinds: CROSS_SITUATION_ACTOR_KINDS,
      archetypes: CROSS_SITUATION_ARCHETYPES,
    })
    expect(a.pass).toBe(b.pass)
    expect(a.violations.length).toBe(b.violations.length)
    expect(a.violations.map((v) => `${v.reason}:${v.detail}`)).toEqual(
      b.violations.map((v) => `${v.reason}:${v.detail}`),
    )
  })
})

// ---------------------------------------------------------------------
// Failure-fixture suite — synthetic templates that prove each violation
// reason fires.
// ---------------------------------------------------------------------

// The fixtures all install a regular actor and hand the gate a synthetic
// kind with a single template. We need one neutral state + cast to pin
// every seed against. The cast is overlaid per archetype by the
// fixture's `buildSamples`.

const ARCHETYPE_TERSE_COLD: CrossSituationArchetype = {
  id: 'terse_cold',
  axes: { terseness: 2, warmth: 0, formality: 1, floridity: 0 },
}

const ARCHETYPE_FLORID_WARM: CrossSituationArchetype = {
  id: 'florid_warm',
  axes: { terseness: 0, warmth: 2, formality: 0, floridity: 2 },
}

const ARCHETYPE_TIC: CrossSituationArchetype = {
  id: 'neutral_tic_trails_off',
  axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
  verbalTic: 'trails_off',
}

function profileFor(archetype: CrossSituationArchetype): VoiceProfile {
  if (archetype.verbalTic) {
    return { axes: { ...archetype.axes }, verbalTic: archetype.verbalTic }
  }
  return { axes: { ...archetype.axes } }
}

/** Build a regular-voiced state with the archetype's voice installed.
 *  Reuses the real `state.world.regulars[0]` so all the same template
 *  selectors see a real cast. */
function regularStateFor(archetype: CrossSituationArchetype): {
  state: ReturnType<typeof createInitialTavernState>
  regularId: string
} {
  const baseState = createInitialTavernState()
  const regularId = Object.keys(baseState.world.regulars)[0]!
  const existing = baseState.world.regulars[regularId]!
  const cast: CastAttributes = {
    specialty: 'gossip',
    blindspot: 'war_story',
    affinities: [],
    voice: profileFor(archetype),
  }
  const state = {
    ...baseState,
    world: {
      ...baseState.world,
      regulars: {
        ...baseState.world.regulars,
        [regularId]: { ...existing, castAttributes: cast },
      },
    },
  }
  return { state, regularId }
}

/** Synthesise a one-slot template whose pool snippets are listed
 *  inline. `slotId` defaults to 'order_line' so the snippets share a
 *  slot with the live drinkOrder pool, but they aren't loaded from
 *  there — the fixture pool stands alone. */
function makeFixtureTemplate(
  id: string,
  slotId: string,
  snippets: Snippet[],
): CompositionalCardTemplate {
  const slot: SlotSpec = {
    id: slotId,
    role: 'utterance',
    pool: { slotId, snippets },
    wordBudget: 12,
    claimMode: 'flavor',
  }
  return {
    id,
    appliesTo: { seedFamilies: ['regular_customer'] },
    voiceRegister: 'tavern_floor',
    slots: [slot],
    toCardView: () => ({
      title: 'fixture',
      body: ['fixture'],
      stakes: [],
      choices: [],
      severity: 0,
      tag: 'fixture',
    }),
  }
}

function makeFixtureKind(
  templates: CompositionalCardTemplate[],
  archetypes: readonly CrossSituationArchetype[],
): CrossSituationActorKind {
  // One actor-kind covers all the fixture templates; the gate iterates
  // archetypes × templates for it.
  return {
    actorKind: 'fixture_regular',
    templateIds: templates.map((t) => t.id),
    buildSamples: (archetype) => {
      const { state, regularId } = regularStateFor(archetype)
      // One sample per fixture template — voice-blind detection
      // compares index-aligned samples across archetypes, so we need
      // identical seed ids across the archetype loop.
      return templates.map<CrossSituationSample>((template, i) => ({
        templateId: template.id,
        template,
        seed: drinkOrderSeedFor(regularId, `fixture-${archetype.id}-${i}`),
        state,
      }))
    },
  } satisfies CrossSituationActorKind
  void archetypes
}

describe('Phase 17 — failure fixtures (each violation reason bites)', () => {
  it('voice_axis_under_expressed fires when no template gates on a high-pole axis', () => {
    // Two fixture templates, neither gating on terseness. The terse_cold
    // archetype (terseness=2, floridity=0) should reach 0 templates for
    // either pole and trip the rule.
    const a = makeFixtureTemplate('phase143.mute-a', 'order_line', [
      {
        id: 'mute_a_fallback',
        text: 'A drink, thanks.',
        conditions: [],
      },
    ])
    const b = makeFixtureTemplate('phase143.mute-b', 'order_line', [
      {
        id: 'mute_b_fallback',
        text: 'A different drink, thanks.',
        conditions: [],
      },
    ])
    const report = checkCrossSituationVoice({
      kinds: [makeFixtureKind([a, b], [ARCHETYPE_TERSE_COLD, ARCHETYPE_FLORID_WARM])],
      archetypes: [ARCHETYPE_TERSE_COLD, ARCHETYPE_FLORID_WARM],
    })
    expect(report.pass).toBe(false)
    const axisViolations = report.violations.filter(
      (v) => v.reason === 'voice_axis_under_expressed',
    )
    expect(axisViolations.length).toBeGreaterThan(0)
    // Per-archetype aggregate: detail names the archetype, not a
    // specific axis (real pools rarely author every pole).
    expect(axisViolations.some((v) => v.detail?.includes('terse_cold'))).toBe(true)
    expect(axisViolations.some((v) => v.detail?.includes('florid_warm'))).toBe(true)
  })

  it('tic_under_surfaced fires when no template gates on the archetype\'s tic', () => {
    const a = makeFixtureTemplate('phase143.no-tic-a', 'order_line', [
      {
        id: 'no_tic_a_fallback',
        text: 'A round, please.',
        conditions: [],
      },
      // Includes a DIFFERENT tic gate so the snippet selector finds
      // candidates, but never matches the fixture archetype's tic.
      {
        id: 'no_tic_a_other',
        text: 'Allow me to indulge a moment.',
        conditions: [
          { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
        ],
      },
    ])
    const b = makeFixtureTemplate('phase143.no-tic-b', 'order_line', [
      {
        id: 'no_tic_b_fallback',
        text: 'Whatever the house pours.',
        conditions: [],
      },
    ])
    const report = checkCrossSituationVoice({
      kinds: [makeFixtureKind([a, b], [ARCHETYPE_TIC])],
      archetypes: [ARCHETYPE_TIC],
    })
    expect(report.pass).toBe(false)
    const ticViolations = report.violations.filter(
      (v) => v.reason === 'tic_under_surfaced',
    )
    expect(ticViolations.length).toBeGreaterThan(0)
    expect(ticViolations.some((v) => v.detail?.includes('trails_off'))).toBe(true)
  })

  it('voice_blind_pool fires when a pool produces identical text for opposite-pole archetypes', () => {
    // The pool has ONE snippet — both terse_cold and florid_warm
    // archetypes draw the same text in every sample. To trigger only
    // voice_blind_pool (not voice_axis_under_expressed) we also include
    // an axis-gated snippet that fires under both archetypes' poles in
    // a *different* slot — but the gate detects voice-blindness slot by
    // slot, so the offending slot fires regardless.
    //
    // We DO need an axis-gated snippet present so voice-axis-under-
    // expressed doesn't also trip — we include axis gates on every pole
    // via a second template the same kind also covers. Keeping just one
    // template simpler: make the pool large enough that axis-pole gates
    // are reached, but make ONE slot voice-blind.
    const voiceBlindTemplate = {
      id: 'phase143.voice-blind',
      appliesTo: { seedFamilies: ['regular_customer'] as const },
      voiceRegister: 'tavern_floor',
      slots: [
        {
          id: 'order_line',
          role: 'utterance',
          pool: {
            slotId: 'order_line',
            snippets: [
              // The voice-blind slot has just an unconditional fallback
              // — both archetypes draw it identically every sample.
              {
                id: 'vb_fallback',
                text: 'A drink, please.',
                conditions: [],
              },
              // High-terseness snippet covers the axis-expression rule
              // for terse_cold.
              {
                id: 'vb_terse',
                text: 'Ale. The usual.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
                ],
              },
              // High-floridity snippet covers the axis-expression rule
              // for florid_warm.
              {
                id: 'vb_florid',
                text: 'Pour me something the bards would envy, dear keeper.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
                ],
              },
              // Cover the remaining pole axes so the gate doesn't trip
              // voice_axis_under_expressed for them.
              {
                id: 'vb_cold',
                text: 'Whatever\'s least likely to spoil.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
                ],
              },
              {
                id: 'vb_warm',
                text: 'Something cheerful, if you would, please.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
                ],
              },
              {
                id: 'vb_plain',
                text: 'Same as last time, no fuss.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atMost: 0 },
                ],
              },
              {
                id: 'vb_formal_low',
                text: 'Hey, an ale.',
                conditions: [
                  { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
                ],
              },
            ],
          },
          wordBudget: 12,
          claimMode: 'flavor' as const,
        },
        // A second, deliberately voice-blind slot — opposite archetypes
        // will both draw the unconditional snippet. The pool has a
        // tic-gated snippet only, so `actorVoicedSlots` recognises it
        // as actor-voiced (and we want to detect the blindness).
        // Neither terse_cold nor florid_warm carries a verbalTic, so
        // both fall back to the unconditional fallback every sample.
        {
          id: 'manner_note',
          role: 'aside',
          pool: {
            slotId: 'manner_note',
            snippets: [
              {
                id: 'vb_manner_fallback',
                text: 'They settle into the seat.',
                conditions: [],
              },
              {
                id: 'vb_manner_tic',
                text: 'They quote a line they heard last week.',
                conditions: [
                  { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
                ],
              },
            ],
          },
          wordBudget: 12,
          claimMode: 'flavor' as const,
        },
      ],
      toCardView: () => ({
        title: 'voice blind fixture',
        body: ['voice blind fixture'],
        stakes: [],
        choices: [],
        severity: 0,
        tag: 'voice_blind_fixture',
      }),
    } satisfies CompositionalCardTemplate

    // Terse_cold has terseness=2, warmth=0, floridity=0 — three pole
    // axes; the snippets above cover those three. Florid_warm has
    // terseness=0, warmth=2, formality=0, floridity=2 — four poles;
    // covered by vb_terse(off)/vb_warm/vb_florid/vb_formal_low. Both
    // archetypes reach axis-gated snippets in order_line, so axis
    // expression passes. But manner_note is voice-blind across both
    // archetypes, so voice_blind_pool fires.
    const fixtureKind: CrossSituationActorKind = {
      actorKind: 'fixture_regular_vb',
      templateIds: [voiceBlindTemplate.id],
      buildSamples: (archetype) => {
        const { state, regularId } = regularStateFor(archetype)
        return [{
          templateId: voiceBlindTemplate.id,
          template: voiceBlindTemplate,
          seed: drinkOrderSeedFor(regularId, `fixture-vb-${archetype.id}`),
          state,
        }]
      },
    }

    const report = checkCrossSituationVoice({
      kinds: [fixtureKind],
      archetypes: [ARCHETYPE_TERSE_COLD, ARCHETYPE_FLORID_WARM],
    })
    expect(report.pass).toBe(false)
    const blindViolations = report.violations.filter(
      (v) => v.reason === 'voice_blind_pool',
    )
    expect(blindViolations.length).toBeGreaterThan(0)
    expect(blindViolations.some((v) => v.slotId === 'manner_note')).toBe(true)
  })
})
