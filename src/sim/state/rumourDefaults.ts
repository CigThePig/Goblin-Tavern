import type { SocialRumourState } from './TavernState'

// Expansion Phase 8 §8.4 — the one place a rumour's network fields get their
// starting values.
//
// This exists because there are two ways a rumour can acquire them and they
// have to AGREE. A rumour created during play is stamped here, by the engine's
// `addSocialRumour`. A rumour restored from a save that predates §8.4 is
// stamped by `ensureRumourNetworkFields`. If those two ever derived a
// different credibility from the same record, a save/reload taken between a
// rumour being started and the next `rumourUpdate` would land the run in a
// different place than an uninterrupted one — which is exactly the §5.10
// failure the exact-once suite catches.

/**
 * How much a story is credited before anybody has interrogated it.
 *
 * Volume is most of it — a thing lots of people are repeating is believed
 * partly BECAUSE lots of people are repeating it — and then the truth of the
 * matter nudges it, because a true story survives the first person who checks.
 */
export function defaultRumourCredibility(
  strength: number,
  accuracy: SocialRumourState['accuracy'] | string,
): number {
  const accuracyShift =
    accuracy === 'true' ? 20 : accuracy === 'partial' ? 8 : accuracy === 'false' ? -15 : 0
  return Math.max(0, Math.min(100, Math.round(strength * 0.6 + 25 + accuracyShift)))
}

/**
 * A rumour record with its §8.4 network fields filled in, or the record
 * unchanged when it already carries them.
 *
 * `audiences` starts EMPTY on purpose: creating a rumour is not the same as
 * anybody having heard it from anybody. Propagation is what puts it in ears,
 * and a record that claimed listeners it never earned would let the network's
 * audience and hop caps be bypassed at birth.
 */
export function withRumourDefaults(rumour: SocialRumourState): SocialRumourState {
  if (rumour.credibility !== undefined) return rumour
  return {
    ...rumour,
    credibility: defaultRumourCredibility(rumour.strength, rumour.accuracy),
    reach: rumour.reach ?? 'public',
    audiences: rumour.audiences ?? [],
    distortion: rumour.distortion ?? 0,
    originalLabel: rumour.originalLabel ?? rumour.label,
    hops: rumour.hops ?? 0,
  }
}
