import type { IssueSeedGenerator } from '../issues/issueSeedRegistry'
import { buildSeed } from '../issues/generatorHelpers'
import { getVentureBlueprint } from '../ventures/ventureCatalog'
import { teleologyUnlocked } from './teleologyUnlock'
import {
  OPENINGS_MODULE_ID,
  createInitialOpeningsModuleState,
  type OpeningsModuleState,
} from './types'

// Phase 2 (teleology) — opening seed generator.
//
// A pure reader of the openings store (no RNG — all RNG-driven lifecycle
// lives in `openingsModule`). For each ACTIVE opening it emits an
// `opportunity` seed in the `opening` family with two responses: "pursue"
// (whose consequence profile spawns the venture through the applier's
// `ventures.<id>.spawn` path) and "decline" (a no-op that lets the opening
// decay toward parking/return/death). The seed's entity is resolved from
// the record's blueprint — never a hardcoded venture id (guardrail §10).

export const openingIssueSeedGenerator: IssueSeedGenerator = {
  id: 'opening_opportunity',
  family: 'opening',
  domain: ['teleology', 'opening'],
  timing: ['morning_prep'],
  generate(ctx) {
    if (!teleologyUnlocked(ctx.state)) return []
    const slice =
      (ctx.state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState | undefined) ??
      createInitialOpeningsModuleState()

    const seeds = []
    for (const record of Object.values(slice.openings)) {
      if (record.status !== 'active') continue
      const blueprint = getVentureBlueprint(record.blueprintId)
      if (!blueprint) continue
      // Already committed (venture exists): the openings module retires the
      // record next morning, but guard here too so the card never double-renders.
      if (ctx.state.ventures[record.blueprintId]) continue

      const openingRef = { kind: 'system' as const, id: `opening:${record.id}` }
      const spawnTarget = `ventures.${record.blueprintId}.spawn`
      const valenceTone = record.valence ? [`return:${record.valence}`] : ['fresh']

      seeds.push(
        buildSeed({
          id: `opening_${record.id}`,
          family: 'opening',
          type: 'opportunity',
          timing: 'morning_prep',
          domain: ['teleology', 'opening'],
          severity: 40,
          urgency: 30,
          primaryActor: openingRef,
          affectedActors: [openingRef],
          causes: ctx.state.causes
            .filter((cause) => cause.tags.includes('opening') && cause.tags.includes(record.id))
            .slice(-3),
          stakes: [
            {
              id: `${record.id}_commit`,
              target: record.blueprintId,
              readable: blueprint.opening.stakesReadable,
              direction: 'gain',
              tags: ['teleology', 'opening'],
            },
          ],
          responseSlots: [
            {
              id: 'pursue',
              labelHint: blueprint.opening.pursueHint,
              allowedVerbs: ['upgrade'],
              shape: 'long_term_investment',
              targetOptions: [openingRef],
              expectedEffects: [`Launch: ${blueprint.label}`],
              choiceContract: {
                archetype: 'major_project',
                primaryTarget: spawnTarget,
                costTypes: ['owner_time'],
                payoffTiming: 'delayed',
              },
            },
            {
              id: 'decline',
              labelHint: blueprint.opening.declineHint,
              allowedVerbs: ['delay'],
              shape: 'delay_problem',
              targetOptions: [openingRef],
              expectedEffects: ['The opening lapses; it may return or fade'],
              choiceContract: {
                archetype: 'delay',
                primaryTarget: spawnTarget,
                costTypes: ['none'],
                payoffTiming: 'none',
              },
            },
          ],
          consequenceProfiles: [
            {
              id: 'pursue',
              responseSlotId: 'pursue',
              immediateEffects: [
                {
                  kind: 'state_change',
                  target: spawnTarget,
                  amount: 1,
                  readable: `${blueprint.label} begins.`,
                  tags: ['teleology', 'venture', 'opening', record.blueprintId, 'spawn'],
                  targetKind: 'global',
                  direction: 'positive',
                  magnitudeBand: 'medium',
                  meterId: 'spawn',
                  meterLabel: 'new venture',
                  meterDisplayCategory: 'good_when_higher',
                },
              ],
              delayedEffects: [],
              memories: [
                {
                  id: `opening_${record.blueprintId}_committed`,
                  type: 'fact',
                  label: `The tavern took up ${blueprint.label.toLowerCase()}.`,
                  strength: 35,
                  tags: ['teleology', 'opening', 'commit'],
                },
              ],
              futureHooks: [],
              impactScore: 30,
            },
            {
              id: 'decline',
              responseSlotId: 'decline',
              immediateEffects: [
                {
                  kind: 'cause',
                  target: record.id,
                  amount: 0,
                  readable: 'The opening was left to lapse.',
                  tags: ['teleology', 'opening', 'declined'],
                },
              ],
              delayedEffects: [],
              memories: [
                {
                  id: `opening_${record.blueprintId}_declined`,
                  type: 'fact',
                  label: `An opening (${blueprint.opening.problemNoun}) was set aside.`,
                  strength: 10,
                  tags: ['teleology', 'opening'],
                },
              ],
              futureHooks: [],
              impactScore: 1,
            },
          ],
          toneHints: ['teleology', 'opening', ...valenceTone],
          textIngredients: {
            subject: blueprint.label,
            problemNoun: blueprint.opening.problemNoun,
            sensoryDetails: blueprint.opening.sensoryDetails,
            actorOpinions: {},
            recentContext: [
              record.origin === 'return' ? 'returned opportunity' : 'new opportunity',
            ],
            stakesReadable: [blueprint.opening.stakesReadable],
          },
          ctx,
        }),
      )
    }
    return seeds
  },
}
