import type { IssueSeedGenerator } from '../issues/issueSeedRegistry'
import type { TeleologyEntry } from '../../state/TavernState'
import { buildSeed, stampFromState } from '../issues/generatorHelpers'
import { ventureGateBlockedNote } from './ventureCatalog'
import { SIGNATURE_BREW_VENTURE_ID } from './signatureBrew'

// Phase 4c (teleology) — the signature-brew venture seed.
//
// This is the cross-pollination card surface. It reveals the brew venture's
// current stage and — crucially — whether it is STALLED on the arc gate (a
// master is not yet on the staff). It also carries the venture→arc
// reach-back: a "lean on the staff" response that pushes the brew faster but
// WOUNDS the linked staff arc (a venture outcome reaching back into an arc,
// plan §"Phase 4c"). Both directions route through real authored content the
// guard test can scan; neither targets a pressure id (constraint 3/4).
//
// The woundable arc is resolved from `state.arcs` at generation, never a
// hardcoded id (guardrail §10), so the reach-back survives a second arc.

/** The active staff arc this venture leans on — resolved from state. */
function resolveWoundableArc(arcs: Record<string, TeleologyEntry>): TeleologyEntry | undefined {
  return Object.values(arcs).find(
    (arc) => arc.status === 'active' && arc.tags.includes('staff_arc'),
  )
}

function resolveBrewCauses(
  state: import('../../state/TavernState').TavernState,
  venture: TeleologyEntry,
  blockedNote: string | undefined,
) {
  const real = state.causes
    .filter((cause) => cause.tags.includes('teleology') && cause.tags.includes(venture.id))
    .slice(-3)
  if (real.length > 0) return real
  const stamp = stampFromState(state)
  return [
    {
      id: `venture_${venture.id}_stage-d${stamp.absoluteDay}`,
      timestamp: stamp,
      source: 'ventures.signature_brew',
      sourceType: 'system' as const,
      target: `venture:${venture.id}`,
      targetType: 'global' as const,
      amount: 0,
      direction: 'neutral' as const,
      weight: 1,
      readable: blockedNote ?? `The signature brew is at the ${venture.stage} stage.`,
      tags: ['teleology', 'venture', 'signature_brew', venture.id],
      relatedActors: [],
      relatedLocations: [],
      relatedSystems: ['ventures', 'signature_brew'],
      ageDays: 0,
    },
  ]
}

export const signatureBrewIssueSeedGenerator: IssueSeedGenerator = {
  id: 'venture_signature_brew_current_stage',
  family: 'venture',
  domain: ['teleology', 'venture', 'signature_brew'],
  timing: ['morning_prep'],
  generate(ctx) {
    const venture = ctx.state.ventures[SIGNATURE_BREW_VENTURE_ID]
    if (!venture || venture.status !== 'active') return []

    const target = { kind: 'system' as const, id: `venture:${venture.id}` }
    const blockedNote = ventureGateBlockedNote(ctx.state, venture)
    const woundArc = resolveWoundableArc(ctx.state.arcs)

    // Base responses: invest owner time (safe) and set aside (no-op). The
    // "lean on the staff" response is only offered when there is a real arc
    // to wound — otherwise there is nothing for the reach-back to land on.
    const responseSlots = [
      {
        id: 'invest_owner_time',
        labelHint: 'Spend owner time perfecting the brew',
        allowedVerbs: ['upgrade' as const],
        shape: 'long_term_investment' as const,
        targetOptions: [target],
        expectedEffects: ['Advance the brew'],
        choiceContract: {
          archetype: 'major_project' as const,
          primaryTarget: `ventures.${venture.id}.progress`,
          costTypes: ['owner_time' as const],
          payoffTiming: 'delayed' as const,
        },
      },
      ...(woundArc
        ? [
            {
              id: 'lean_on_staff',
              labelHint: 'Lean on the staff to rush it',
              allowedVerbs: ['gamble' as const],
              shape: 'risky_profitable' as const,
              targetOptions: [target],
              expectedEffects: ['Faster brew progress', 'Strains the staffer'],
              choiceContract: {
                archetype: 'staff_push' as const,
                primaryTarget: `ventures.${venture.id}.progress`,
                costTypes: ['relationship_risk' as const],
                payoffTiming: 'immediate' as const,
              },
            },
          ]
        : []),
      {
        id: 'set_aside',
        labelHint: 'Set the brew aside today',
        allowedVerbs: ['delay' as const],
        shape: 'delay_problem' as const,
        targetOptions: [target],
        expectedEffects: ['No brew progress today'],
        choiceContract: {
          archetype: 'delay' as const,
          primaryTarget: `ventures.${venture.id}.progress`,
          costTypes: ['none' as const],
          payoffTiming: 'none' as const,
        },
      },
    ]

    const consequenceProfiles = [
      {
        id: 'invest_owner_time',
        responseSlotId: 'invest_owner_time',
        immediateEffects: [
          {
            kind: 'state_change' as const,
            target: `ventures.${venture.id}.progress`,
            amount: 1,
            readable: 'The brew comes along under careful attention.',
            tags: ['teleology', 'venture', venture.id],
            targetKind: 'global' as const,
            direction: 'positive' as const,
            magnitudeBand: 'small' as const,
            meterId: 'progress',
            meterLabel: 'progress',
            meterDisplayCategory: 'good_when_higher' as const,
          },
        ],
        delayedEffects: [],
        memories: [
          {
            id: 'venture_signature_brew_invested',
            type: 'fact' as const,
            label: 'Owner time went into the signature brew.',
            strength: 25,
            tags: ['teleology', 'venture', 'signature_brew'],
          },
        ],
        futureHooks: [],
        impactScore: 20,
      },
      ...(woundArc
        ? [
            {
              id: 'lean_on_staff',
              responseSlotId: 'lean_on_staff',
              immediateEffects: [
                {
                  kind: 'state_change' as const,
                  target: `ventures.${venture.id}.progress`,
                  amount: 2,
                  readable: 'Pushed hard, the brew jumps ahead.',
                  tags: ['teleology', 'venture', venture.id],
                  targetKind: 'global' as const,
                  direction: 'positive' as const,
                  magnitudeBand: 'small' as const,
                  meterId: 'progress',
                  meterLabel: 'progress',
                  meterDisplayCategory: 'good_when_higher' as const,
                },
                {
                  // The reach-back: leaning on the staff wounds the linked
                  // arc's own progress. Targets the arc collection, never a
                  // pressure id (constraint 3/4); arc resolved from state.
                  kind: 'state_change' as const,
                  target: `arcs.${woundArc.id}.progress`,
                  amount: -2,
                  readable: 'Leaning on them this hard sets back their own growth.',
                  tags: ['teleology', 'arc', 'wound', 'cross_pollination', woundArc.id],
                  targetKind: 'arc' as const,
                  direction: 'negative' as const,
                  magnitudeBand: 'small' as const,
                  meterId: 'progress',
                  meterLabel: 'progress',
                  meterDisplayCategory: 'good_when_higher' as const,
                },
              ],
              delayedEffects: [],
              memories: [
                {
                  id: 'venture_signature_brew_rushed',
                  type: 'fact' as const,
                  label: 'The signature brew was rushed at the staffer’s expense.',
                  strength: 30,
                  tags: ['teleology', 'venture', 'arc', 'wound'],
                },
              ],
              futureHooks: [],
              impactScore: 22,
            },
          ]
        : []),
      {
        id: 'set_aside',
        responseSlotId: 'set_aside',
        immediateEffects: [
          {
            kind: 'cause' as const,
            target: venture.id,
            amount: 0,
            readable: 'The brew waits for another day.',
            tags: ['teleology', 'venture', 'delayed'],
          },
        ],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 1,
      },
    ]

    return [
      buildSeed({
        id: `venture_${venture.id}_${venture.stage}`,
        family: 'venture',
        type: 'opportunity',
        timing: 'morning_prep',
        domain: ['teleology', 'venture', 'signature_brew'],
        severity: 42,
        urgency: 32,
        primaryActor: target,
        affectedActors: [target],
        // Prefer the venture's real causal trail (start/advance/investment);
        // fall back to a synthetic cause naming the current stage so the seed
        // always explains why it appeared (validator requires ≥1 cause),
        // mirroring the transformation-gated generators.
        causes: resolveBrewCauses(ctx.state, venture, blockedNote),
        stakes: [
          {
            id: `${venture.id}_ratchet`,
            target: venture.id,
            readable: 'A signature ale would mark the tavern out for good.',
            direction: 'gain',
            tags: ['teleology', 'venture', 'signature_brew'],
          },
        ],
        responseSlots,
        consequenceProfiles,
        toneHints: ['teleology', 'venture', 'signature_brew', venture.stage, ...(blockedNote ? ['blocked'] : [])],
        textIngredients: {
          subject: venture.label,
          problemNoun: 'a brew taking shape',
          sensoryDetails: ['hops and roasted grain'],
          actorOpinions: {},
          recentContext: [
            `stage ${venture.stage}`,
            `progress ${venture.progress}`,
            ...(blockedNote ? [blockedNote] : []),
          ],
          stakesReadable: [
            blockedNote ?? 'A signature ale that sets the tavern apart',
          ],
        },
        ctx,
      }),
    ]
  },
}
