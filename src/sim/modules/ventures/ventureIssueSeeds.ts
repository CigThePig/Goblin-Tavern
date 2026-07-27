import type { IssueSeedGenerator } from '../issues/issueSeedRegistry'
import { buildSeed, effect } from '../issues/generatorHelpers'
import { OWNER_TIME_EFFECT_TARGET } from '../responses/responseCost'
import { TIME_COST_SHORT } from '../ownerActions/stateHelpers'
import { LIQUOR_LICENSE_VENTURE_ID } from './liquorLicense'

export const ventureIssueSeedGenerator: IssueSeedGenerator = {
  id: 'venture_liquor_license_current_stage',
  family: 'venture',
  domain: ['teleology', 'venture'],
  timing: ['morning_prep'],
  generate(ctx) {
    const venture = ctx.state.ventures[LIQUOR_LICENSE_VENTURE_ID]
    if (!venture || venture.status !== 'active') return []
    const target = { kind: 'system' as const, id: `venture:${venture.id}` }
    return [buildSeed({
      id: `venture_${venture.id}_${venture.stage}`,
      family: 'venture',
      type: 'opportunity',
      timing: 'morning_prep',
      domain: ['teleology', 'venture'],
      severity: 45,
      urgency: 35,
      primaryActor: target,
      affectedActors: [target],
      causes: ctx.state.causes.filter((cause) => cause.tags.includes('teleology') && cause.tags.includes(venture.id)).slice(-3),
      stakes: [{ id: `${venture.id}_ratchet`, target: venture.id, readable: 'A permanent liquor licence can change what the tavern is allowed to serve.', direction: 'gain', tags: ['teleology', 'venture'] }],
      responseSlots: [
        { id: 'invest_owner_time', labelHint: 'Spend owner time on the licence', allowedVerbs: ['upgrade'], shape: 'long_term_investment', targetOptions: [target], expectedEffects: ['Advance licence paperwork'], choiceContract: { archetype: 'major_project', primaryTarget: `ventures.${venture.id}.progress`, costTypes: ['owner_time'], payoffTiming: 'delayed' } },
        { id: 'set_aside', labelHint: 'Set the licence aside today', allowedVerbs: ['delay'], shape: 'delay_problem', targetOptions: [target], expectedEffects: ['No licence progress today'], choiceContract: { archetype: 'delay', primaryTarget: `ventures.${venture.id}.progress`, costTypes: ['none'], payoffTiming: 'none' } },
      ],
      consequenceProfiles: [
        // Phase 203 / audit Wave 4 (`P6-COMP-005`) — the slot's contract
        // declares `costTypes: ['owner_time']`; until this wave the profile
        // spent none, so the card promised an opportunity cost the model
        // did not have. The hour is now real, named on the preview, gated
        // at selection and taken at resolution.
        { id: 'invest_owner_time', responseSlotId: 'invest_owner_time', immediateEffects: [{ kind: 'state_change', target: `ventures.${venture.id}.progress`, amount: 1, readable: 'Licence paperwork advances.', tags: ['teleology', 'venture', venture.id], targetKind: 'global', direction: 'positive', magnitudeBand: 'small', meterId: 'progress', meterLabel: 'progress', meterDisplayCategory: 'good_when_higher' }, effect('state_change', OWNER_TIME_EFFECT_TARGET, -TIME_COST_SHORT, 'An hour of the day goes into the paperwork', ['time', 'owner', 'teleology'])], delayedEffects: [], memories: [{ id: 'venture_liquor_license_invested', type: 'fact', label: 'Owner time went into the liquor licence.', strength: 30, tags: ['teleology', 'venture'] }], futureHooks: [], impactScore: 25 },
        { id: 'set_aside', responseSlotId: 'set_aside', immediateEffects: [{ kind: 'cause', target: venture.id, amount: 0, readable: 'The licence waits for another day.', tags: ['teleology', 'venture', 'delayed'] }], delayedEffects: [], memories: [{ id: 'venture_liquor_license_waits', type: 'fact', label: 'The licence paperwork waited.', strength: 10, tags: ['teleology', 'venture'] }], futureHooks: [], impactScore: 1 },
      ],
      toneHints: ['teleology', 'paperwork', venture.stage],
      textIngredients: { subject: venture.label, problemNoun: 'licence paperwork', sensoryDetails: ['ink and stamps'], actorOpinions: {}, recentContext: [`stage ${venture.stage}`, `progress ${venture.progress}/2`], stakesReadable: ['Permanent liquor service unlock'] },
      ctx,
    })]
  },
}
