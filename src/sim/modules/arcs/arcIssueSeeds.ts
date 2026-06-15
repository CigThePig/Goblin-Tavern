import type { IssueSeedGenerator } from '../issues/issueSeedRegistry'
import { buildSeed } from '../issues/generatorHelpers'
import { PROVEN_TAG } from './staffMasteryArc'

// Phase 4b (teleology) — the arc-milestone seed generator. Surfaces an
// active staff arc's autonomous movement in the same ranked `seedsToday`
// hand as everything else. ONE family (`staff_arc`); the rest of the arc
// card-authoring mass is deferred to 4d.
//
// The generator resolves the arc from `state.arcs` and tags the seed with
// the LIVE stage (+ `proven` when set), so the card reads the entry's
// current milestone — never a hardcoded id or threshold (guardrail §10).
// Both choices are acknowledgement-only (`cause`-kind effects): the arc
// advances on its own, so the card REVEALS movement rather than driving it
// (core design rule).
export const arcIssueSeedGenerator: IssueSeedGenerator = {
  id: 'staff_arc_current_stage',
  family: 'staff_arc',
  domain: ['teleology', 'arc', 'staff_arc'],
  timing: ['morning_prep'],
  generate(ctx) {
    const seeds = []
    for (const arc of Object.values(ctx.state.arcs)) {
      if (arc.status !== 'active') continue
      if (!arc.tags.includes('staff_arc')) continue
      const target = { kind: 'system' as const, id: `arc:${arc.id}` }
      const proven = arc.tags.includes(PROVEN_TAG)
      const toneHints = ['teleology', 'arc', 'staff_arc', `stage:${arc.stage}`]
      if (proven) toneHints.push(PROVEN_TAG)
      seeds.push(
        buildSeed({
          id: `staff_arc_${arc.id}_${arc.stage}`,
          family: 'staff_arc',
          type: 'arc_milestone',
          timing: 'morning_prep',
          domain: ['teleology', 'arc', 'staff_arc', `stage:${arc.stage}`],
          severity: 40,
          urgency: 30,
          primaryActor: target,
          affectedActors: [target],
          causes: ctx.state.causes
            .filter((cause) => cause.tags.includes('teleology') && cause.tags.includes(arc.id))
            .slice(-3),
          stakes: [
            {
              id: `${arc.id}_trajectory`,
              target: arc.id,
              readable: 'A character is growing into who they will become at the tavern.',
              direction: 'gain',
              tags: ['teleology', 'arc', 'staff_arc'],
            },
          ],
          responseSlots: [
            {
              id: 'mark_milestone',
              labelHint: 'Mark the milestone with them',
              allowedVerbs: ['promote'],
              shape: 'long_term_investment',
              targetOptions: [target],
              expectedEffects: ['Recognise the growth'],
              choiceContract: {
                archetype: 'staff_care',
                primaryTarget: `arcs.${arc.id}`,
                costTypes: ['none'],
                payoffTiming: 'delayed',
              },
            },
            {
              id: 'let_it_unfold',
              labelHint: 'Let them find their own way',
              allowedVerbs: ['delay'],
              shape: 'delay_problem',
              targetOptions: [target],
              expectedEffects: ['Say nothing of it'],
              choiceContract: {
                archetype: 'delay',
                primaryTarget: `arcs.${arc.id}`,
                costTypes: ['none'],
                payoffTiming: 'none',
              },
            },
          ],
          consequenceProfiles: [
            {
              id: 'mark_milestone',
              responseSlotId: 'mark_milestone',
              immediateEffects: [
                {
                  kind: 'cause',
                  target: arc.id,
                  amount: 0,
                  readable: 'The owner takes note of how far they have come.',
                  tags: ['teleology', 'arc', 'staff_arc', arc.id],
                },
              ],
              delayedEffects: [],
              memories: [
                {
                  id: `staff_arc_${arc.id}_recognised`,
                  type: 'fact',
                  label: 'The owner recognised a staffer growing into their craft.',
                  strength: 20,
                  tags: ['teleology', 'arc', 'staff_arc'],
                },
              ],
              futureHooks: [],
              impactScore: 8,
            },
            {
              id: 'let_it_unfold',
              responseSlotId: 'let_it_unfold',
              immediateEffects: [
                {
                  kind: 'cause',
                  target: arc.id,
                  amount: 0,
                  readable: 'The owner lets the moment pass without remark.',
                  tags: ['teleology', 'arc', 'staff_arc', 'quiet', arc.id],
                },
              ],
              delayedEffects: [],
              memories: [],
              futureHooks: [],
              impactScore: 1,
            },
          ],
          toneHints,
          textIngredients: {
            subject: arc.label,
            problemNoun: 'a turning point in a character',
            sensoryDetails: ['a steadier hand at the work'],
            actorOpinions: {},
            recentContext: [`stage ${arc.stage}`, `progress ${arc.progress}`],
            stakesReadable: ['A character settling into who they are'],
          },
          ctx,
        }),
      )
    }
    return seeds
  },
}
