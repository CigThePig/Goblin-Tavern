// Phase 88 — Test helpers for the card layer.
//
// Builds minimal but realistic IssueSeeds + states so each template's
// `render(seed, state)` can be exercised without spinning up a full
// simulation day. The shapes mirror what the real generators produce —
// every field is populated to its contract minimum.

import { buildTextIngredients } from '../../src/sim/modules/issues/index'
import { makeTavernState } from '../../src/sim/testing/stateFactories'
import type {
  IssueSeed,
  IssueSeedTiming,
  IssueSeedType,
  IssueSeedFamilyId,
  ResponseSlot,
  ConsequenceProfile,
  TextIngredients,
} from '../../src/sim/modules/issues/issueSeedTypes'
import type { EntityRef } from '../../src/sim/state/TavernState'
import type { StakeRef } from '../../src/sim/modules/issues/issueSeedTypes'

export const ZERO_STAMP = {
  year: 1,
  month: 1,
  week: 1,
  day: 1,
  absoluteDay: 0,
}

export type SeedBlueprint = {
  id?: string
  family?: IssueSeedFamilyId | string
  type?: IssueSeedType
  timing?: IssueSeedTiming
  severity?: number
  urgency?: number
  novelty?: number
  cardWorthiness?: number
  domain?: string[]
  location?: EntityRef
  primaryActor?: EntityRef
  affectedActors?: EntityRef[]
  stakes?: StakeRef[]
  responseSlots?: ResponseSlot[]
  consequenceProfiles?: ConsequenceProfile[]
  toneHints?: string[]
  textIngredients?: Partial<TextIngredients>
}

export function makeSeed(blueprint: SeedBlueprint = {}): IssueSeed {
  const id = blueprint.id ?? 'seed-test'
  const stake: StakeRef = blueprint.stakes?.[0] ?? {
    id: `${id}-stake-0`,
    target: 'reputation.tasty',
    readable: 'patrons will gossip',
    direction: 'loss',
    tags: [],
  }
  const slots: ResponseSlot[] = blueprint.responseSlots ?? [
    {
      id: `${id}-slot-a`,
      labelHint: 'Address the issue',
      allowedVerbs: ['clean'],
      shape: 'safe_costly',
      targetOptions: [{ kind: 'area', id: 'main_room' }],
      expectedEffects: ['cleanliness +5'],
    },
    {
      id: `${id}-slot-b`,
      labelHint: 'Push through it',
      allowedVerbs: ['ignore'],
      shape: 'ignore',
      targetOptions: [],
      expectedEffects: ['nothing changes'],
    },
  ]
  const profiles: ConsequenceProfile[] = blueprint.consequenceProfiles ?? [
    {
      id: `${id}-profile-a`,
      responseSlotId: slots[0]!.id,
      immediateEffects: [
        {
          kind: 'state_change',
          target: 'areas.main_room.cleanliness',
          amount: 5,
          readable: 'main room cleaned up a touch',
          tags: ['cleanliness'],
        },
      ],
      delayedEffects: [
        {
          kind: 'pressure',
          target: 'pressure.maintenance',
          amount: -2,
          readable: 'maintenance pressure eases',
          tags: ['maintenance'],
        },
      ],
      memories: [],
      futureHooks: [],
      impactScore: 10,
    },
    ...(slots[1]
      ? [
          {
            id: `${id}-profile-b`,
            responseSlotId: slots[1].id,
            immediateEffects: [
              {
                kind: 'state_change' as const,
                target: 'noop',
                amount: 0,
                readable: 'nothing happens',
                tags: [],
              },
            ],
            delayedEffects: [],
            memories: [],
            futureHooks: [],
            impactScore: 0,
          },
        ]
      : []),
  ]
  return {
    id,
    family: blueprint.family ?? 'food_safety',
    type: blueprint.type ?? 'crisis',
    timing: blueprint.timing ?? 'during_service',
    domain: blueprint.domain ?? ['food'],
    severity: blueprint.severity ?? 75,
    urgency: blueprint.urgency ?? 60,
    novelty: blueprint.novelty ?? 50,
    cardWorthiness: blueprint.cardWorthiness ?? 60,
    affectedActors: blueprint.affectedActors ?? [],
    causes: [],
    pressures: [],
    stakes: blueprint.stakes ?? [stake],
    responseSlots: slots,
    consequenceProfiles: profiles,
    memoriesCreated: [],
    futureHooks: [],
    toneHints: blueprint.toneHints ?? [],
    ...(blueprint.location ? { location: blueprint.location } : {}),
    ...(blueprint.primaryActor ? { primaryActor: blueprint.primaryActor } : {}),
    textIngredients: buildTextIngredients({
      subject: 'spoiled stew',
      sensoryDetails: ['acrid steam off the pot'],
      recentContext: ['the cook noticed at midday'],
      stakesReadable: ['patrons will get sick'],
      pressureContext: ['food safety climbing fast'],
      ...(blueprint.textIngredients ?? {}),
    }),
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: ZERO_STAMP,
  }
}

export { makeTavernState }
