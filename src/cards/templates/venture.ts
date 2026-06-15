import type { CardDefinition } from '../types'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState, TeleologyEntry } from '../../sim/state/TavernState'
import { buildStakes, familyTag } from '../cardHelpers'
import {
  getVentureBlueprint,
  ventureGateBlockedNote,
} from '../../sim/modules/ventures/ventureCatalog'

// Resolve the venture from the seed's `venture:<id>` primary-actor target —
// never a hardcoded id, so a second venture (Phase 4c's signature brew)
// renders its own state rather than the first venture's (guardrail §10).
function resolveVentureId(seed: IssueSeed): string | undefined {
  const ref = seed.primaryActor
  if (!ref || ref.kind !== 'system') return undefined
  if (!ref.id.startsWith('venture:')) return undefined
  return ref.id.slice('venture:'.length)
}

// The progress requirement for the venture's CURRENT stage, read from its
// catalogued definition — so the "N/needed" denominator is the live
// milestone's threshold, not a literal (guardrail §10).
function currentStageRequirement(venture: TeleologyEntry): number | undefined {
  const milestone = getVentureBlueprint(venture.id)?.definition.milestones.find(
    (m) => m.fromStage === venture.stage,
  )
  const req = milestone?.requirements.find((c) => c.kind === 'progress_at_least')
  return req?.kind === 'progress_at_least' ? req.value : undefined
}

function buildBody(venture: TeleologyEntry | undefined, state: TavernState): string[] {
  if (!venture) return ['A long project is waiting for owner attention.', 'Owner time invested here ratchets toward a permanent tavern change.']
  const needed = currentStageRequirement(venture)
  const progressLine =
    needed !== undefined
      ? `Progress at this stage: ${venture.progress}/${needed}.`
      : `Progress so far: ${venture.progress}.`
  const lines = [progressLine, 'Owner time invested here ratchets toward a permanent tavern change.']
  // Phase 4c cross-pollination legibility: surface when this venture is
  // stalled on another teleology system's milestone (an arc reaching
  // mastery). Resolved generically from the catalogued gate.
  const blocked = ventureGateBlockedNote(state, venture)
  if (blocked) lines.splice(1, 0, blocked)
  return lines
}

export const ventureCard: CardDefinition = {
  id: 'venture.current_stage',
  appliesTo: { seedFamilies: ['venture'], seedTypes: ['opportunity'], timings: ['morning_prep'] },
  priority: 75,
  render(seed, state) {
    const ventureId = resolveVentureId(seed)
    const venture = ventureId ? state.ventures[ventureId] : undefined
    return {
      title: venture ? `${venture.label}: ${venture.stage}` : 'Venture: next step',
      body: buildBody(venture, state),
      stakes: buildStakes(seed, 3),
      choices: seed.responseSlots.slice(0, 3).map((slot) => {
        const choice = { slotId: slot.id, label: slot.labelHint, verb: slot.allowedVerbs[0]!, shape: slot.shape, previewEffects: slot.expectedEffects }
        const targetId = slot.targetOptions[0]?.id
        return targetId ? { ...choice, targetId } : choice
      }),
      severity: seed.severity,
      tag: familyTag(seed),
      meta: { templateId: 'venture.current_stage' },
    }
  },
}
