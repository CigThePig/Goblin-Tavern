// Temporary card adapter for the foundation pass.
//
// The real card registry lives behind phase 87. Until then, this
// module wraps any incoming IssueSeed into a minimal CardView so the
// <CardRenderer> chassis can be proven against real sim output.
//
// When `src/cards/` lands, this file should DELETE — not migrate.
// Real card definitions will own composition; this is intentionally
// dumb.

import type { IssueSeed } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../../src/sim/state/TavernState'
import {
  pickSeverityAdjective,
  severityTier,
} from '../../../../src/sim/content/text/descriptors'
import type { CardView, CardChoice, StakeView } from './types'

function clampWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/)
  if (words.length <= max) return s
  return words.slice(0, max).join(' ') + '…'
}

function mapStakeDirection(dir: 'loss' | 'gain' | 'risk'): StakeView['direction'] {
  return dir
}

export function renderMockCard(seed: IssueSeed, _state: TavernState): CardView {
  const ti = seed.textIngredients
  const adj = pickSeverityAdjective(seed.severity, seed.id)
  const subject = ti.subject || seed.family
  const title = clampWords(`${adj} ${subject}`, 6)

  const body: string[] = []
  if (ti.sensoryDetails[0]) body.push(ti.sensoryDetails[0])
  if (ti.recentContext[0]) body.push(ti.recentContext[0])
  if (ti.pressureContext?.[0]) body.push(ti.pressureContext[0])

  const stakes: StakeView[] = seed.stakes.slice(0, 3).map((s) => ({
    readable: s.readable,
    direction: mapStakeDirection(s.direction),
  }))

  const choices: CardChoice[] = seed.responseSlots.map((slot) => {
    const profile = seed.consequenceProfiles.find(
      (p) => p.responseSlotId === slot.id,
    )
    const verb = slot.allowedVerbs[0] ?? 'ignore'
    return {
      slotId: slot.id,
      label: slot.labelHint,
      verb,
      ...(slot.targetOptions[0]?.id !== undefined
        ? { targetId: slot.targetOptions[0].id }
        : {}),
      shape: slot.shape,
      previewEffects: (profile?.immediateEffects ?? [])
        .map((e) => e.readable)
        .slice(0, 3),
    }
  })

  return {
    title,
    body,
    stakes,
    choices,
    severity: seed.severity,
    tag: `${seed.family} · ${severityTier(seed.severity)}`,
  }
}
