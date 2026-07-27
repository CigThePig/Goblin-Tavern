import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import type { IssueSeed } from './issueSeedTypes'
import {
  buildSeed,
  buildTextIngredients,
  effect,
  makeProfile,
  pressureSnapshot,
  recentCauseEntries,
  seedId,
  stake,
  stampFromState,
  systemRef,
} from './generatorHelpers'
import { OWNER_TIME_EFFECT_TARGET } from '../responses/responseCost'
import { TIME_COST_QUICK } from '../ownerActions/stateHelpers'

// Phase 3 (teleology) — generator-level family gating.
//
// Transformation tags gate issue-seed generators so that reaching a venture
// milestone permanently changes what families of cards can appear.
//
// - A **retirable** generator early-returns [] when a disabling transformation
//   tag is present.
// - A **locked** generator early-returns [] until an enabling transformation
//   tag is present.
//
// These generators are pure functions of SimContext (no RNG, no DOM). The
// transformation state they read from `state.transformations` is already
// updated by the kernel before generators run (per canonicalPipeline.ts
// ordering: kernel → venture → openings → issueSeeds).

// ----------------------------------------------------------------------
// Helper: collect all tags from active transformations
// ----------------------------------------------------------------------

/** Collects tags from all active (active === true) transformations in
 *  state.transformations. Returns a flat, deduplicated array. */
export function getActiveTransformationTags(state: TavernState): string[] {
  const tags: string[] = []
  for (const t of Object.values(state.transformations)) {
    if (t.active) {
      for (const tag of t.tags) {
        if (!tags.includes(tag)) tags.push(tag)
      }
    }
  }
  return tags
}

// ----------------------------------------------------------------------
// Retirable: liquor_compliance
// ----------------------------------------------------------------------

// Fires when the tavern serves ale without a liquor licence and inspection
// pressure is elevated. Once the licence is obtained (liquor_license tag
// active) this generator permanently early-returns [] — the compliance
// risk no longer exists.

const LIQUOR_COMPLIANCE_INSPECTION_THRESHOLD = 15

/** Retirable generator. Retires permanently when 'liquor_license' is in
 *  the active transformation tag set. */
export function generateLiquorCompliance(ctx: SimContext): IssueSeed[] {
  // Retire when the liquor licence is active
  if (getActiveTransformationTags(ctx.state).includes('liquor_license')) return []

  // Only fire if there is ale/spirits stock to serve
  const aleStock = ctx.state.stock['ale']
  if (!aleStock || aleStock.quantity <= 0) return []

  // Needs some inspection-level concern (entropy-half trigger)
  const snap = pressureSnapshot(ctx, 'inspection')
  if (!snap || snap.value < LIQUOR_COMPLIANCE_INSPECTION_THRESHOLD) return []

  const recentCauses = recentCauseEntries(ctx, ['inspection', 'ale', 'stock'], 5, 2)
  // Fall back to a synthetic cause when no recent tagged causes exist yet
  // (early-game state where the pressure module hasn't yet emitted causes).
  const stamp = stampFromState(ctx.state)
  const causes =
    recentCauses.length > 0
      ? recentCauses
      : [
          {
            id: `inspection_unlicensed_ale-d${stamp.absoluteDay}`,
            timestamp: stamp,
            source: 'pressure.inspection',
            sourceType: 'pressure' as const,
            target: 'pressure:inspection',
            targetType: 'pressure' as const,
            amount: snap.value,
            direction: 'increase' as const,
            weight: snap.value,
            readable: `Inspection concern at ${snap.value} — ale served without a licence.`,
            tags: ['inspection', 'ale', 'compliance'],
            relatedActors: [],
            relatedLocations: [],
            relatedSystems: ['inspection', 'pressures'],
            ageDays: 0,
          },
        ]

  const target = systemRef('inspection_authority')
  return [
    buildSeed({
      id: seedId('liquor_compliance', 'unlicensed_serving_risk', ctx),
      family: 'liquor_compliance',
      type: 'inspection_threat',
      timing: 'morning_prep',
      domain: ['inspection', 'compliance', 'stock'],
      severity: snap.severity ?? 45,
      urgency: 50,
      primaryActor: target,
      affectedActors: [target],
      causes,
      stakes: [
        stake(
          'license_stake',
          'system:inspection_authority',
          'Serving unlicensed ale risks a fine or closure.',
          'loss',
          ['inspection', 'compliance'],
        ),
      ],
      responseSlots: [
        {
          id: 'reduce_serving',
          labelHint: 'Limit ale serving today',
          allowedVerbs: ['sell'],
          shape: 'safe_costly',
          targetOptions: [systemRef('ale_service')],
          expectedEffects: [
            'reduce unlicensed service exposure',
            'lose customer revenue',
          ],
          choiceContract: {
            archetype: 'policy_change',
            primaryTarget: 'stock.ale.quantity',
            costTypes: ['service_capacity'],
            payoffTiming: 'immediate',
          },
        },
        {
          id: 'ignore_risk',
          labelHint: 'Continue serving as normal',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: ['inspection risk grows'],
          choiceContract: {
            archetype: 'ignore',
            costTypes: ['pressure_risk'],
            payoffTiming: 'none',
          },
        },
      ],
      consequenceProfiles: [
        makeProfile({
          id: 'reduce_serving_profile',
          responseSlotId: 'reduce_serving',
          immediateEffects: [
            effect(
              'state_change',
              'coin',
              -5,
              'Revenue reduced by limiting ale sales',
              ['coin'],
            ),
            effect(
              'pressure',
              'pressure:inspection',
              -4,
              'Compliance risk eases briefly',
              ['pressure'],
            ),
          ],
          delayedEffects: [],
          memories: [
            {
              id: 'limited_ale_for_compliance',
              tags: ['compliance', 'stock'],
            },
          ],
          futureHooks: [],
        }),
        makeProfile({
          id: 'ignore_risk_profile',
          responseSlotId: 'ignore_risk',
          immediateEffects: [],
          delayedEffects: [
            effect(
              'pressure',
              'pressure:inspection',
              6,
              'Unlicensed service compounds inspection risk',
              ['pressure'],
            ),
          ],
          memories: [
            {
              id: 'ignored_license_risk',
              tags: ['compliance', 'ignored'],
            },
          ],
          futureHooks: [
            {
              id: 'inspection_followup_possible',
              tags: ['inspection', 'risk'],
            },
          ],
        }),
      ],
      toneHints: ['compliance', 'risk', 'inspection'],
      textIngredients: buildTextIngredients({
        subject: 'unlicensed ale service',
        problemNoun: 'a licence gap',
        sensoryDetails: ['a writ notice', "the inspector's shadow"],
        actorOpinions: {},
        recentContext: [`inspection pressure ${snap.value}`],
        stakesReadable: [
          'Serving without a licence risks a fine or forced closure',
        ],
      }),
      ctx,
    }),
  ]
}

// ----------------------------------------------------------------------
// Locked: licensed_service
// ----------------------------------------------------------------------

// Fires as a management opportunity once the liquor licence is active.
// Before the licence exists (no 'liquor_license' tag in active
// transformations) this generator early-returns [] — the option isn't
// meaningful yet.

/** Locked generator. Returns [] until 'liquor_license' is in the active
 *  transformation tag set. */
export function generateLicensedService(ctx: SimContext): IssueSeed[] {
  // Locked until liquor_license transformation is active
  if (!getActiveTransformationTags(ctx.state).includes('liquor_license'))
    return []

  // Only fire when there IS ale/spirits to serve
  const aleStock = ctx.state.stock['ale']
  if (!aleStock || aleStock.quantity <= 0) return []

  // Collect causes from transformation activation; fall back to a synthetic
  // cause when the transformation was activated via a direct state mutation
  // (e.g. dev tools or tests) that left no causal trail.
  const transformationCauses = ctx.state.causes
    .filter(
      (c) =>
        c.tags.includes('transformation') &&
        c.tags.includes('licensed_liquor_service'),
    )
    .slice(-2)
  const stamp = stampFromState(ctx.state)
  const causes =
    transformationCauses.length > 0
      ? transformationCauses
      : [
          {
            id: `licensed_liquor_service_active-d${stamp.absoluteDay}`,
            timestamp: stamp,
            source: 'transformations.licensed_liquor_service',
            sourceType: 'system' as const,
            target: 'global',
            targetType: 'global' as const,
            amount: 1,
            direction: 'increase' as const,
            weight: 30,
            readable: 'The liquor licence is now active.',
            tags: ['transformation', 'licensed_liquor_service', 'teleology'],
            relatedActors: [],
            relatedLocations: [],
            relatedSystems: ['transformations', 'licensed_liquor_service'],
            ageDays: 0,
          },
        ]

  const target = systemRef('licensed_service')
  return [
    buildSeed({
      id: seedId('licensed_service', 'promote_licensed_spirits', ctx),
      family: 'licensed_service',
      type: 'opportunity',
      timing: 'morning_prep',
      domain: ['teleology', 'service', 'licensed_service'],
      severity: 30,
      urgency: 25,
      primaryActor: target,
      affectedActors: [target],
      causes,
      stakes: [
        stake(
          'license_gain_stake',
          'system:licensed_service',
          'The licence opens premium service options.',
          'gain',
          ['teleology', 'licensed_service'],
        ),
      ],
      responseSlots: [
        {
          id: 'promote_service',
          labelHint: 'Promote the licensed spirits offering',
          allowedVerbs: ['promote'],
          shape: 'reputation_play',
          targetOptions: [target],
          expectedEffects: [
            'reputation gains',
            'customer satisfaction rises',
          ],
          choiceContract: {
            archetype: 'policy_change',
            primaryTarget: 'reputation.overall',
            costTypes: ['owner_time'],
            payoffTiming: 'delayed',
          },
        },
        {
          id: 'maintain_steady',
          labelHint: 'Run the licensed service as usual',
          allowedVerbs: ['ignore'],
          shape: 'ignore',
          targetOptions: [],
          expectedEffects: ['steady operation'],
          choiceContract: {
            archetype: 'ignore',
            costTypes: ['none'],
            payoffTiming: 'none',
          },
        },
      ],
      consequenceProfiles: [
        makeProfile({
          id: 'promote_service_profile',
          responseSlotId: 'promote_service',
          immediateEffects: [
            effect(
              'state_change',
              'reputation.respectable',
              4,
              'Licensed spirits reputation spreads',
              ['reputation'],
            ),
            effect(
              'state_change',
              'coin',
              -3,
              'Extra effort in promotion',
              ['coin'],
            ),
            // Phase 203 / audit Wave 4 (`P6-COMP-005`) — the slot's contract
            // declares `owner_time`; the profile now carries it.
            effect(
              'state_change',
              OWNER_TIME_EFFECT_TARGET,
              -TIME_COST_QUICK,
              'Owner time spent talking the offering up',
              ['time', 'owner'],
            ),
          ],
          delayedEffects: [],
          memories: [
            {
              id: 'promoted_licensed_spirits',
              tags: ['licensed_service', 'reputation'],
            },
          ],
          futureHooks: [],
        }),
        makeProfile({
          id: 'maintain_steady_profile',
          responseSlotId: 'maintain_steady',
          immediateEffects: [],
          delayedEffects: [],
          memories: [
            {
              id: 'steady_licensed_operation',
              tags: ['licensed_service'],
            },
          ],
          futureHooks: [],
        }),
      ],
      toneHints: ['teleology', 'licensed_service', 'opportunity'],
      textIngredients: buildTextIngredients({
        subject: 'licensed liquor service',
        problemNoun: 'a service opportunity',
        sensoryDetails: ['polished bottles', 'the licence displayed'],
        actorOpinions: {},
        recentContext: ['liquor licence active'],
        stakesReadable: [
          'A licence opens new service tiers and reputation gains',
        ],
      }),
      ctx,
    }),
  ]
}
