// Phase 185 / ISSUE-153 — Choice-Preview Legibility arc, Phase 5
// (Drive, tune, deepen — standing).
//
// The arc's motivating audit (Appendix A §2) tabulated three families as
// "unverified": `food_safety`, `regular_customer`, and `rumour_crisis` did
// not surface in the passive playthrough sweep, so although the legibility
// harness exercises their templates via synthetic determinism samplers, the
// gate had never run against a seed the LIVE simulation emitted under adverse
// state. This harness closes that gap: it drives each family into existence
// through the real `simulateDay` pipeline from constructed adverse state, then
// pairs the surfaced production seed with its production template so the
// Phase-4 legibility gate can render exactly what the player would see.
//
// Each builder perturbs only the state the family's seed generator + its
// backing pressure calculator read, so the target family dominates the day.
// A single `runOneDay` lets the real generators emit the seed (no synthetic
// seed shapes), and the surfaced seed is paired with that day's result state.

import { runOneDay } from '../../../../src/sim/testing/simRunner'
import { getAllSeedsToday } from '../../../../src/sim/modules/issues/index'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import { pickCardForSeed } from '../../../../src/cards/selection'
import { defineCompositionalCard } from '../../../../src/cards/compose/defineCompositionalCard'
import type { CompositionalCardTemplate } from '../../../../src/cards/compose/types'
import type { LegibilitySample } from '../../../../src/cards/compose/gates'
import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import { LEGIBILITY_SITUATIONS } from './legibilityHarness'

/** The three families the audit left unverified — driven here from adverse
 *  state. Plain enumerable data so the test iterates them. */
export const DRIVEN_FAMILIES = ['food_safety', 'regular_customer', 'rumour_crisis'] as const

export type DrivenFamily = (typeof DRIVEN_FAMILIES)[number]

// ----------------------------------------------------------------------
// Adverse-state builders — pure state perturbation.
// ----------------------------------------------------------------------

/** Kitchen cleanliness 8 + smell 85 and stew/mushroom spoilage 85 push
 *  `calculateFoodSafety` to ~62, over the generator's 45 threshold. */
export function buildAdverseFoodSafetyState(base: TavernState): TavernState {
  const kitchen = base.areas.kitchen
  return {
    ...base,
    areas: {
      ...base.areas,
      ...(kitchen ? { kitchen: { ...kitchen, cleanliness: 8, smell: 85 } } : {}),
    },
    stock: {
      ...base.stock,
      ...(base.stock.stew ? { stew: { ...base.stock.stew, spoilage: 85 } } : {}),
      ...(base.stock.mushrooms
        ? { mushrooms: { ...base.stock.mushrooms, spoilage: 85 } }
        : {}),
    },
  }
}

/** Every starter regular at irritation 80 / loyalty 20 lifts
 *  `calculateRegularCustomerLoss` to ~36, over the 25 threshold, and the
 *  irritation > 60 branch makes the generator emit `type: 'complaint'`. */
export function buildAdverseRegularCustomerState(base: TavernState): TavernState {
  const regulars = { ...base.world.regulars }
  for (const id of Object.keys(regulars)) {
    regulars[id] = { ...regulars[id]!, irritation: 80, loyalty: 20 }
  }
  return { ...base, world: { ...base.world, regulars } }
}

/** A strength-100 false rumour drives `rumour_pressure` over 25; a
 *  high-publicness false `suspicion` attribution targeting a real starter
 *  regular makes the dramatic target a regular (not the tavern), so the
 *  seed clears the "no actor, group, or location" validation contract. */
export function buildAdverseRumourCrisisState(base: TavernState): TavernState {
  const regularId = Object.keys(base.world.regulars)[0]
  const staffId = Object.keys(base.staff)[0]
  if (!regularId || !staffId) {
    throw new Error('drivenFamilies: initial state must have a regular and staff')
  }
  const target = { kind: 'regular' as const, id: regularId }
  const attrSlice = base.modules.attribution as
    | {
        attributions?: unknown[]
        generatedToday?: string[]
        lastUpdatedDay?: number
        recentDistrustByRumour?: Record<string, number>
      }
    | undefined
  return {
    ...base,
    world: {
      ...base.world,
      socialRumours: {
        ...base.world.socialRumours,
        driven_watered_ale_rumour: {
          id: 'driven_watered_ale_rumour',
          label: 'The ale is watered',
          strength: 100,
          accuracy: 'false',
          subject: target,
          firstHeardDay: 0,
          lastSpreadDay: 0,
          tags: ['rumour', 'reputation'],
        },
      },
    },
    modules: {
      ...base.modules,
      attribution: {
        attributions: [
          ...((attrSlice?.attributions as unknown[]) ?? []),
          {
            id: 'driven_false_blame',
            timestamp: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
            sourceCauseIds: [],
            sourceMemoryIds: [],
            sourceSceneIds: [],
            perceivedBy: { kind: 'staff', id: staffId },
            target,
            attributionType: 'suspicion',
            accuracy: 'false',
            strength: 90,
            confidence: 80,
            publicness: 95,
            volatility: 40,
            readable: 'regular blamed for watering the ale',
            tags: ['rumour', 'false_blame'],
            relatedSystems: ['rumours'],
            ageDays: 0,
          },
        ],
        generatedToday: attrSlice?.generatedToday ?? [],
        lastUpdatedDay: attrSlice?.lastUpdatedDay ?? 0,
        recentDistrustByRumour: attrSlice?.recentDistrustByRumour ?? {},
      },
    },
  }
}

const ADVERSE_STATE_BUILDERS: Record<DrivenFamily, (base: TavernState) => TavernState> = {
  food_safety: buildAdverseFoodSafetyState,
  regular_customer: buildAdverseRegularCustomerState,
  rumour_crisis: buildAdverseRumourCrisisState,
}

// ----------------------------------------------------------------------
// Surfacing + template resolution.
// ----------------------------------------------------------------------

/** The 20 migrated compositional templates (the legibility harness's set —
 *  `REQUIRED_CARDS` minus the fallback), reused so template selection here
 *  matches the live gate. */
const MIGRATED_TEMPLATES: readonly CompositionalCardTemplate[] =
  LEGIBILITY_SITUATIONS.map((s) => s.template)

/** Wrapped as `CardDefinition`s once so `pickCardForSeed` runs the exact
 *  production selection (priority → specificity → id). */
const MIGRATED_CARD_DEFS = MIGRATED_TEMPLATES.map((t) => defineCompositionalCard(t))

/** Surface the first seed of `family` from constructed adverse state, paired
 *  with the day's result state. Throws if the family did not surface so a
 *  future generator change that stops emitting it fails loudly. */
export function surfaceDrivenSample(family: DrivenFamily): LegibilitySample {
  const adverse = ADVERSE_STATE_BUILDERS[family](createInitialTavernState())
  const result = runOneDay(adverse, { seed: `driven-${family}` })
  const seed = getAllSeedsToday(result.state).find((s) => s.family === family)
  if (!seed) {
    const surfaced = getAllSeedsToday(result.state)
      .map((s) => s.family)
      .join(', ')
    throw new Error(
      `drivenFamilies: "${family}" did not surface from its adverse state. ` +
        `Surfaced families: [${surfaced}]. The generator's trigger conditions ` +
        `may have changed — update the adverse-state builder.`,
    )
  }
  return { seed, state: result.state }
}

/** The production template a surfaced seed renders through, via the exact
 *  registry selection. Throws if no migrated template matches (it would mean
 *  the seed falls back, which is out of scope for this gate). */
export function templateForSeed(seed: IssueSeed, state: TavernState): CompositionalCardTemplate {
  const chosen = pickCardForSeed(seed, state, MIGRATED_CARD_DEFS)
  if (!chosen) {
    throw new Error(
      `drivenFamilies: no migrated template matched seed ${seed.id} ` +
        `(family ${seed.family}, type ${seed.type}).`,
    )
  }
  const template = MIGRATED_TEMPLATES.find((t) => t.id === chosen.id)
  if (!template) {
    throw new Error(`drivenFamilies: selected card ${chosen.id} has no backing template`)
  }
  return template
}
