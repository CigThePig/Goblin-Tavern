// Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10
// (Reputation, Rumour & Rivals cluster).
//
// Exhaustive matrix-cell reachability tests for the three compositional
// templates this phase deepens: reputationShift (narrator-voiced;
// matrix cells on `(axis × pressure × memory)` / `(axis × severity)` /
// top-rung `(axis × severity × repeat)`), rumourCrisis (actor-voiced
// through six target kinds; matrix on `(accuracy × target_kind ×
// pressure)` / `(accuracy × memory)` / top-rung `(accuracy × pressure
// × repeat)`), and rivalTavern (narrator-voiced; matrix on
// `(rival_type × pressure)` / `(rival_type × memory)` / dual-pressure
// / top-rung `(rival_type × severity × repeat)`).
//
// Unlike Phases 149/150/151/152/153/154, this cluster has **no band
// signals on its primary subject** — reputation axes, rumour accuracy,
// rumour target kind, and rival type are categorical enums per Phase
// 13 / ISSUE-108's tag-enrichment design. So the matrix uses `hasTag`
// reads paired with `pressureRising` / `memoryPresent` /
// `severityAtLeast` / `repeatCount` (every combo carries ≥1 state-
// lookup primitive for the simCoherence gate to pass).

import { describe, expect, it } from 'vitest'

import {
  reputationShiftCard,
  rumourCrisisCard,
  rivalTavernCard,
} from '../../../src/cards/index'
import type {
  EntityRef,
  TavernState,
} from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type {
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  SupplierCastAttributes,
} from '../../../src/sim/content/cast'
import { makeSeed } from '../cardFactories'

// ─── Shared helpers ─────────────────────────────────────────────────

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) throw new Error('test setup expects at least one supplier')
  return id
}
function firstRegularId(state: TavernState): string {
  const id = Object.keys(state.world.regulars)[0]
  if (!id) throw new Error('test setup expects at least one regular')
  return id
}
function firstFactionId(state: TavernState): string {
  const id = Object.keys(state.world.factions)[0]
  if (!id) throw new Error('test setup expects at least one faction')
  return id
}
function firstCustomerGroupId(state: TavernState): string {
  const id = Object.keys(state.customerGroups)[0]
  if (!id) {
    throw new Error('test setup expects at least one customer group')
  }
  return id
}
function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects at least one staff')
  return id
}

// Neutral cast — axes all at 1 so voice-extreme reaction/manner
// snippets (which require atLeast: 2 or atMost: 0) never fire; isolates
// state-keyed snippets from voice perturbation on the rumour target.
const NEUTRAL_VOICE = {
  axes: { terseness: 1, warmth: 1, formality: 1, floridity: 1 },
} as const

const NEUTRAL_SUPPLIER_CAST: SupplierCastAttributes = {
  specialty: 'foraged_goods',
  blindspot: 'paperwork',
  affinities: [],
  voice: NEUTRAL_VOICE,
}
const NEUTRAL_REGULAR_CAST: CastAttributes = {
  specialty: 'observation',
  blindspot: 'patience',
  affinities: [],
  voice: NEUTRAL_VOICE,
}
const NEUTRAL_FACTION_CAST: FactionCastAttributes = {
  specialty: 'ceremony',
  blindspot: 'patience',
  affinities: [],
  voice: NEUTRAL_VOICE,
}
const NEUTRAL_GROUP_CAST: CustomerGroupCastAttributes = {
  voice: NEUTRAL_VOICE,
}
const NEUTRAL_STAFF_CAST: CastAttributes = {
  specialty: 'meat_dishes',
  blindspot: 'pastry',
  affinities: [],
  voice: NEUTRAL_VOICE,
}

function withSupplierCast(state: TavernState, id: string): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [id]: {
          ...state.world.suppliers[id]!,
          castAttributes: NEUTRAL_SUPPLIER_CAST,
        },
      },
    },
  }
}
function withRegularCast(state: TavernState, id: string): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: {
        ...state.world.regulars,
        [id]: {
          ...state.world.regulars[id]!,
          castAttributes: NEUTRAL_REGULAR_CAST,
        },
      },
    },
  }
}
function withFactionCast(state: TavernState, id: string): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      factions: {
        ...state.world.factions,
        [id]: {
          ...state.world.factions[id]!,
          castAttributes: NEUTRAL_FACTION_CAST,
        },
      },
    },
  }
}
function withGroupCast(state: TavernState, id: string): TavernState {
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      [id]: {
        ...state.customerGroups[id]!,
        castAttributes: NEUTRAL_GROUP_CAST,
      },
    },
  }
}
function withStaffCast(state: TavernState, id: string): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [id]: {
        ...state.staff[id]!,
        castAttributes: NEUTRAL_STAFF_CAST,
      },
    },
  }
}

function withRisingPressure(
  state: TavernState,
  pressureId: string,
  value = 50,
): TavernState {
  return {
    ...state,
    pressures: {
      ...state.pressures,
      [pressureId]: {
        ...(state.pressures[pressureId] ?? {
          id: pressureId,
          label: pressureId,
          tags: [],
          topCauses: [],
        }),
        value,
        trend: 1,
        tags: state.pressures[pressureId]?.tags ?? [],
        topCauses: state.pressures[pressureId]?.topCauses ?? [],
      },
    },
  }
}

function withMemory(
  state: TavernState,
  memoryId: string,
  tags: string[],
): TavernState {
  return {
    ...state,
    memories: [
      ...state.memories,
      {
        id: memoryId,
        type: 'fact',
        label: memoryId,
        strength: 50,
        ageDays: 1,
        createdAt: {
          year: 1,
          month: 1,
          week: 1,
          day: 1,
          absoluteDay: 0,
        },
        actors: [],
        locations: [],
        relatedSystems: [],
        tags,
      },
    ],
  }
}

// Repeat-count of N for a given subject tag is read against the seed
// flow. We simulate the repeat by adding ≥3 memories tagged with the
// subject so `repeatCountByTag` reads the value.
function withRepeats(
  state: TavernState,
  subjectTag: string,
  count = 3,
): TavernState {
  let next = state
  for (let i = 0; i < count; i++) {
    next = withMemory(next, `repeat-${subjectTag}-${i}`, [subjectTag])
  }
  return next
}

// ─── reputation_shift fixtures ──────────────────────────────────────

function reputationSeed(
  id: string,
  overrides: {
    severity?: number
    axis?: string
    toneHints?: string[]
  } = {},
): IssueSeed {
  const axis = overrides.axis ?? 'cozy'
  return makeSeed({
    id,
    family: 'reputation_shift' as IssueSeedFamilyId,
    type: 'reputation_shift',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain: ['reputation', 'customers', `reputation.${axis}`],
    toneHints: overrides.toneHints ?? ['identity', 'reputation'],
    location: { kind: 'area', id: 'main_room' },
  })
}

describe('reputationShiftCard — multi-meter axis × pressure × memory combos', () => {
  // 5 spec-3 axis × pressureRising × memoryPresent cells covering the
  // five highest-trafficked axes (cozy / tasty / dangerous / reliable /
  // respectable). Each combo's substring is unique within the pool.
  const tests: {
    label: string
    axis: string
    memory: string
    substring: string
  }[] = [
    {
      label: 'cozy × pressure × identity-memory',
      axis: 'cozy',
      memory: 'identity',
      substring: 'cozy welcome embraced before',
    },
    {
      label: 'dangerous × pressure × customer-memory',
      axis: 'dangerous',
      memory: 'customer',
      substring: 'rougher draw at the door',
    },
    {
      label: 'reliable × pressure × identity-memory',
      axis: 'reliable',
      memory: 'identity',
      substring: 'reliable rhythm leaned into before',
    },
    {
      label: 'tasty × pressure × customer-memory',
      axis: 'tasty',
      memory: 'customer',
      substring: 'kitchen note from before',
    },
    {
      label: 'respectable × pressure × identity-memory',
      axis: 'respectable',
      memory: 'identity',
      substring: 'respectable register chosen before',
    },
  ]
  for (const { label, axis, memory, substring } of tests) {
    it(`opens with the spec-3 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = withRisingPressure(state, 'reputation_drift', 50)
      state = withMemory(state, `rep-${axis}-${memory}`, [memory])
      const seed = reputationSeed(`rep-axis-${axis}-${memory}`, { axis })
      const view = reputationShiftCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('reputationShiftCard — axis × severity × pressure combos', () => {
  const tests: {
    label: string
    axis: string
    substring: string
  }[] = [
    {
      label: 'cozy × high severity',
      axis: 'cozy',
      substring: 'cozy hold has tipped past softening',
    },
    {
      label: 'tasty × high severity',
      axis: 'tasty',
      substring: 'kitchen note is past softening',
    },
    {
      label: 'reliable × high severity',
      axis: 'reliable',
      substring: 'reliable rhythm is past softening',
    },
    {
      label: 'respectable × high severity',
      axis: 'respectable',
      substring: 'respectable register is past softening',
    },
  ]
  for (const { label, axis, substring } of tests) {
    it(`opens with the spec-3 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = withRisingPressure(state, 'reputation_drift', 50)
      const seed = reputationSeed(`rep-sev-${axis}`, { axis, severity: 80 })
      const view = reputationShiftCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }

  it('opens with the dangerous × severity × repeat top-rung cell', () => {
    let state = createInitialTavernState()
    state = withRepeats(state, 'reputation', 3)
    const seed = reputationSeed('rep-dangerous-top', {
      axis: 'dangerous',
      severity: 80,
    })
    const view = reputationShiftCard.render(seed, state)
    expect(view.body[0]).toContain('Three closings on a rougher name')
  })
})

// ─── rumour_crisis fixtures ─────────────────────────────────────────

function rumourSeed(
  primaryActor: EntityRef,
  id: string,
  overrides: {
    accuracy?: 'true' | 'partial' | 'false' | 'unknown'
    severity?: number
  } = {},
): IssueSeed {
  const accuracy = overrides.accuracy ?? 'partial'
  return makeSeed({
    id,
    family: 'rumour_crisis' as IssueSeedFamilyId,
    type: 'rumour',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain: [
      'rumours',
      'reputation',
      `rumour.${accuracy}`,
      `rumour.target.${primaryActor.kind}`,
    ],
    toneHints: ['rumour', 'reputation'],
    primaryActor,
    responseSlots: [
      {
        id: `${id}-deny`,
        labelHint: 'Deny the rumour',
        allowedVerbs: ['rebrand'],
        shape: 'reputation_play',
        targetOptions: [primaryActor],
        expectedEffects: ['shift attribution'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-deny-profile`,
        responseSlotId: `${id}-deny`,
        immediateEffects: [
          {
            kind: 'pressure',
            target: 'pressure:rumour_pressure',
            amount: -8,
            readable: 'public denial blunts rumour',
            tags: ['pressure'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
    textIngredients: {
      subject: 'a spreading rumour',
      sensoryDetails: ['whispered word'],
      recentContext: [`accuracy: ${accuracy}`],
      stakesReadable: ['rumour may spread'],
    },
  })
}

describe('rumourCrisisCard — accuracy × target_kind × pressure combos', () => {
  const tests: {
    label: string
    accuracy: 'true' | 'partial' | 'false' | 'unknown'
    targetKind: 'regular' | 'faction' | 'supplier' | 'staff' | 'customer_group'
    substring: string
  }[] = [
    {
      label: 'false × regular',
      accuracy: 'false',
      targetKind: 'regular',
      substring: 'false tale has wound around a regular',
    },
    {
      label: 'true × faction',
      accuracy: 'true',
      targetKind: 'faction',
      substring: 'true story has landed on a whole faction',
    },
    {
      label: 'partial × supplier',
      accuracy: 'partial',
      targetKind: 'supplier',
      substring: 'half-truth has wound around a supplier',
    },
    {
      label: 'false × staff',
      accuracy: 'false',
      targetKind: 'staff',
      substring: 'false tale has folded one of the staff',
    },
    {
      label: 'true × customer_group',
      accuracy: 'true',
      targetKind: 'customer_group',
      substring: 'true story about a whole cohort',
    },
    {
      label: 'partial × faction',
      accuracy: 'partial',
      targetKind: 'faction',
      substring: 'half-truth pinned on a faction',
    },
  ]
  for (const { label, accuracy, targetKind, substring } of tests) {
    it(`opens with the spec-3 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = withRisingPressure(state, 'rumour_pressure', 50)
      let ref: EntityRef
      switch (targetKind) {
        case 'regular': {
          const regularId = firstRegularId(state)
          state = withRegularCast(state, regularId)
          ref = { kind: 'regular', id: regularId }
          break
        }
        case 'faction': {
          const factionId = firstFactionId(state)
          state = withFactionCast(state, factionId)
          ref = { kind: 'faction', id: factionId }
          break
        }
        case 'supplier': {
          const supplierId = firstSupplierId(state)
          state = withSupplierCast(state, supplierId)
          ref = { kind: 'supplier', id: supplierId }
          break
        }
        case 'staff': {
          const staffId = firstStaffId(state)
          state = withStaffCast(state, staffId)
          ref = { kind: 'staff', id: staffId }
          break
        }
        case 'customer_group': {
          const groupId = firstCustomerGroupId(state)
          state = withGroupCast(state, groupId)
          ref = { kind: 'customer_group', id: groupId }
          break
        }
      }
      const seed = rumourSeed(ref, `rumour-${label.replace(/\s+/g, '-')}`, {
        accuracy,
      })
      const view = rumourCrisisCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('rumourCrisisCard — accuracy × memory + top rung', () => {
  it('opens with the false × denial-memory cell', () => {
    let state = createInitialTavernState()
    const factionId = firstFactionId(state)
    state = withFactionCast(state, factionId)
    state = withMemory(state, 'rum-denial', ['denial'])
    const seed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-false-denial',
      { accuracy: 'false' },
    )
    const view = rumourCrisisCard.render(seed, state)
    expect(view.body[0]).toContain(
      'false tale and last round',
    )
  })

  it('opens with the true × honesty-memory cell', () => {
    let state = createInitialTavernState()
    const factionId = firstFactionId(state)
    state = withFactionCast(state, factionId)
    state = withMemory(state, 'rum-honesty', ['honesty'])
    const seed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-true-honesty',
      { accuracy: 'true' },
    )
    const view = rumourCrisisCard.render(seed, state)
    expect(view.body[0]).toContain('truth admitted last round')
  })

  it('opens with the false × pressure × repeat top-rung cell', () => {
    let state = createInitialTavernState()
    const factionId = firstFactionId(state)
    state = withFactionCast(state, factionId)
    state = withRisingPressure(state, 'rumour_pressure', 60)
    state = withRepeats(state, 'rumour', 3)
    const seed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-false-top',
      { accuracy: 'false' },
    )
    const view = rumourCrisisCard.render(seed, state)
    expect(view.body[0]).toContain('false tale, three closings deep')
  })
})

// ─── rival_tavern fixtures ──────────────────────────────────────────

function rivalSeed(
  primaryActor: EntityRef,
  id: string,
  overrides: { severity?: number } = {},
): IssueSeed {
  const isArc = primaryActor.kind === 'local_event'
  return makeSeed({
    id,
    family: 'rival_tavern' as IssueSeedFamilyId,
    type: 'social_conflict',
    timing: 'closing',
    severity: overrides.severity ?? 50,
    domain: ['rival', 'market', 'customers', isArc ? 'rival.arc' : 'rival.system'],
    toneHints: ['rival', 'market'],
    primaryActor,
    responseSlots: [
      {
        id: `${id}-price`,
        labelHint: 'Compete on price',
        allowedVerbs: ['lower_price'],
        shape: 'risky_profitable',
        targetOptions: [{ kind: 'stock', id: 'ale' }],
        expectedEffects: ['raise patronage'],
      },
    ],
    consequenceProfiles: [
      {
        id: `${id}-price-profile`,
        responseSlotId: `${id}-price`,
        immediateEffects: [
          {
            kind: 'state_change',
            target: 'customers.local_goblins.patronage',
            amount: 4,
            readable: 'raise patronage',
            tags: ['customers'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 5,
      },
    ],
  })
}

describe('rivalTavernCard — rival_type × pressure / memory combos', () => {
  const tests: {
    label: string
    primaryActorKind: 'local_event' | 'system'
    mutate: (s: TavernState) => TavernState
    substring: string
  }[] = [
    {
      label: 'rival.arc × regular_customer_loss pressure',
      primaryActorKind: 'local_event',
      mutate: (s) => withRisingPressure(s, 'regular_customer_loss', 50),
      substring: 'named rival has been bleeding regulars',
    },
    {
      label: 'rival.system × regular_customer_loss pressure',
      primaryActorKind: 'system',
      mutate: (s) => withRisingPressure(s, 'regular_customer_loss', 50),
      substring: 'anonymous undercutter is bleeding regulars',
    },
    {
      label: 'rival.arc × price memory',
      primaryActorKind: 'local_event',
      mutate: (s) => withMemory(s, 'rival-price', ['price']),
      substring: 'named rival and last round',
    },
    {
      label: 'rival.system × ignored memory',
      primaryActorKind: 'system',
      mutate: (s) => withMemory(s, 'rival-ignored', ['ignored']),
      substring: 'anonymous pull was set aside last round',
    },
  ]
  for (const { label, primaryActorKind, mutate, substring } of tests) {
    it(`opens with the spec-2 cell for ${label}`, () => {
      let state = createInitialTavernState()
      state = mutate(state)
      const ref: EntityRef =
        primaryActorKind === 'local_event'
          ? { kind: 'local_event', id: 'rival_tavern_arc' }
          : { kind: 'system', id: 'rival_tavern' }
      const seed = rivalSeed(ref, `rival-${label.replace(/\s+/g, '-')}`)
      const view = rivalTavernCard.render(seed, state)
      expect(view.body[0]).toContain(substring)
    })
  }
})

describe('rivalTavernCard — dual-pressure + top rungs', () => {
  it('renders dual-pressure facts via the multi-fact join (primary rival_type + secondary customer-loss)', () => {
    // When both pressures rise on a rival.system seed, the salience
    // table's lead `hasTag` reads tie with the pressure reads at
    // top index — multi-fact picks a rival_type primary then appends
    // a secondary covering the orthogonal customer-loss pressure. The
    // dual-pressure snippet is salience-disadvantaged when the seed
    // always carries a rival_type tag; this test asserts the joined
    // output still surfaces both pressure facts.
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'rival_tavern_pressure', 50)
    state = withRisingPressure(state, 'regular_customer_loss', 50)
    const seed = rivalSeed(
      { kind: 'system', id: 'rival_tavern' },
      'rival-dual-pressure',
    )
    const view = rivalTavernCard.render(seed, state)
    // The joined body[0] should mention both the rival pull
    // (rival_type snippet) and the regulars-loss pressure.
    expect(view.body[0]).toMatch(/competitor|undercutter|rival/i)
    expect(view.body[0]).toMatch(/regulars/i)
  })

  it('opens with the rival.arc × severity × repeat top rung', () => {
    let state = createInitialTavernState()
    state = withRepeats(state, 'rival', 3)
    const seed = rivalSeed(
      { kind: 'local_event', id: 'rival_tavern_arc' },
      'rival-arc-top',
      { severity: 80 },
    )
    const view = rivalTavernCard.render(seed, state)
    expect(view.body[0]).toContain('named house, three closings deep')
  })

  it('opens with the rival.system × severity × pressure top rung', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'rival_tavern_pressure', 60)
    const seed = rivalSeed(
      { kind: 'system', id: 'rival_tavern' },
      'rival-system-top',
      { severity: 80 },
    )
    const view = rivalTavernCard.render(seed, state)
    expect(view.body[0]).toContain('anonymous pull has tipped past softening')
  })
})

// ─── State-varying reaction proof ───────────────────────────────────

describe('reputationShiftCard — reaction_line varies with state', () => {
  it('a cozy + pressure state and a dangerous + severity state produce different reactions', () => {
    let cozyState = createInitialTavernState()
    cozyState = withRisingPressure(cozyState, 'reputation_drift', 50)
    let dangerousState = createInitialTavernState()
    dangerousState = withRisingPressure(dangerousState, 'reputation_drift', 50)
    const cozySeed = reputationSeed('rep-cozy-var', { axis: 'cozy' })
    const dangerousSeed = reputationSeed('rep-dangerous-var', {
      axis: 'dangerous',
      severity: 80,
    })
    const cozyView = reputationShiftCard.render(cozySeed, cozyState)
    const dangerousView = reputationShiftCard.render(
      dangerousSeed,
      dangerousState,
    )
    expect(cozyView.body[1]).not.toBe(dangerousView.body[1])
  })
})

describe('rumourCrisisCard — reaction_line varies with state', () => {
  it('a false + denial-memory target and a true + honesty-memory target produce different reactions', () => {
    let baseState = createInitialTavernState()
    const factionId = firstFactionId(baseState)
    baseState = withFactionCast(baseState, factionId)
    let falseState = withMemory(baseState, 'rum-denial-var', ['denial'])
    let trueState = withMemory(baseState, 'rum-honesty-var', ['honesty'])
    const falseSeed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-false-var',
      { accuracy: 'false' },
    )
    const trueSeed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-true-var',
      { accuracy: 'true' },
    )
    const falseView = rumourCrisisCard.render(falseSeed, falseState)
    const trueView = rumourCrisisCard.render(trueSeed, trueState)
    expect(falseView.body[1]).not.toBe(trueView.body[1])
  })
})

describe('rivalTavernCard — reaction_line varies with state', () => {
  it('an arc + customer-loss state and a system + rival-pressure state produce different reactions', () => {
    let arcState = createInitialTavernState()
    arcState = withRisingPressure(arcState, 'regular_customer_loss', 50)
    let systemState = createInitialTavernState()
    systemState = withRisingPressure(systemState, 'rival_tavern_pressure', 50)
    const arcSeed = rivalSeed(
      { kind: 'local_event', id: 'rival_tavern_arc' },
      'rival-arc-var',
    )
    const systemSeed = rivalSeed(
      { kind: 'system', id: 'rival_tavern' },
      'rival-system-var',
    )
    const arcView = rivalTavernCard.render(arcSeed, arcState)
    const systemView = rivalTavernCard.render(systemSeed, systemState)
    expect(arcView.body[1]).not.toBe(systemView.body[1])
  })
})

// ─── Re-render stability ─────────────────────────────────────────────

describe('reputation/rumour/rival matrix cells — re-render stability', () => {
  it('reputationShift cell is byte-identical on re-render', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'reputation_drift', 50)
    state = withMemory(state, 'rep-stable', ['identity'])
    const seed = reputationSeed('rep-stable', { axis: 'cozy' })
    const a = reputationShiftCard.render(seed, state)
    const b = reputationShiftCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('rumourCrisis cell is byte-identical on re-render', () => {
    let state = createInitialTavernState()
    const factionId = firstFactionId(state)
    state = withFactionCast(state, factionId)
    state = withRisingPressure(state, 'rumour_pressure', 50)
    const seed = rumourSeed(
      { kind: 'faction', id: factionId },
      'rumour-stable',
      { accuracy: 'true' },
    )
    const a = rumourCrisisCard.render(seed, state)
    const b = rumourCrisisCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('rivalTavern cell is byte-identical on re-render', () => {
    let state = createInitialTavernState()
    state = withRisingPressure(state, 'rival_tavern_pressure', 50)
    state = withRisingPressure(state, 'regular_customer_loss', 50)
    const seed = rivalSeed(
      { kind: 'system', id: 'rival_tavern' },
      'rival-stable',
    )
    const a = rivalTavernCard.render(seed, state)
    const b = rivalTavernCard.render(seed, state)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
