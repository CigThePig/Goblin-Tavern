// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Culture-aware voice defaults. Each culture id maps to a partial
// `VoiceProfile.axes` record; the factory uses the listed values as the
// starting position for the corresponding axes and falls back to 1
// (mid-scale) for any unspecified axis. After seeding, the factory
// perturbs each axis by [-1, 0, 0, 1] via the named identity RNG stream
// and clamps to [0, 2]. That keeps the cultural signature visible
// across the cast without making everyone identical.
//
// Culture ids match those registered in
// `src/sim/content/cultures/cultureRegistry.ts`. Adding a new culture
// here is a one-line edit; missing entries do not error (the factory
// just falls through to mid-scale defaults).

import type { VoiceAxisId, VoiceAxisValue } from './castTypes'

export const CULTURE_VOICE_DEFAULTS: Readonly<
  Record<string, Partial<Record<VoiceAxisId, VoiceAxisValue>>>
> = Object.freeze({
  // Townfolk goblins — warm, informal, plain-spoken.
  goblin_local: { warmth: 2, formality: 0, floridity: 0 },
  // Miners — clipped, plain, lukewarm.
  miner_workcrew: { terseness: 2, warmth: 1, formality: 0, floridity: 0 },
  // Road merchants — embellished, semi-formal, polished.
  merchant_roadfolk: { terseness: 0, warmth: 1, formality: 1, floridity: 2 },
  // Ogres — clipped, warm to clan, low formality.
  ogre_clans: { terseness: 2, warmth: 2, formality: 0, floridity: 0 },
  // Adventurers — embellished war-story register.
  adventuring_bands: { terseness: 0, warmth: 1, formality: 0, floridity: 2 },
  // Shrine devotees — formal, warm, restrained embellishment.
  shrine_devotees: { terseness: 1, warmth: 1, formality: 2, floridity: 1 },
  // Traveling outsiders — guarded, formal, plain.
  traveling_outsiders: { terseness: 1, warmth: 0, formality: 2, floridity: 0 },
  // Guild artisans — formal, polished, measured.
  guild_artisans: { terseness: 1, warmth: 1, formality: 2, floridity: 1 },
})

export function getCultureVoiceDefault(
  cultureId: string | undefined,
): Partial<Record<VoiceAxisId, VoiceAxisValue>> {
  if (!cultureId) return {}
  return CULTURE_VOICE_DEFAULTS[cultureId] ?? {}
}
