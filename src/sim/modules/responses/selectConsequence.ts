import type {
  ConsequenceProfile,
  ResponseIntent,
  ResponseSlot,
} from '../issues/issueSeedTypes'

// Phase 19 §19.10 / Phase 41 — match a response intent to a slot/profile.
//
// Extracted from `responseResolver.ts` so both the pure resolver and the
// in-engine `responsesModule` use identical selection logic.
//
// The matcher walks three lookup paths in order:
//   1. exact slot id (when the intent metadata names a `responseSlotId`),
//   2. (verb + shape) combo,
//   3. verb alone.
// First match wins. When no slot matches, both fields are returned as
// `undefined` and the caller is expected to log and skip.

/** Minimal shape required for slot/profile selection. The full
 *  `IssueSeed` satisfies this. */
export type SelectableSeed = {
  responseSlots: ResponseSlot[]
  consequenceProfiles: ConsequenceProfile[]
}

export function selectConsequence(
  seed: SelectableSeed,
  intent: ResponseIntent,
): { profile: ConsequenceProfile | undefined; slot: ResponseSlot | undefined } {
  const named = intent.metadata?.responseSlotId as string | undefined
  let slot: ResponseSlot | undefined
  if (named) {
    slot = seed.responseSlots.find((s) => s.id === named)
  }
  if (!slot) {
    slot = seed.responseSlots.find(
      (s) => s.allowedVerbs.includes(intent.verb) && s.shape === intent.shape,
    )
  }
  if (!slot) {
    slot = seed.responseSlots.find((s) => s.allowedVerbs.includes(intent.verb))
  }
  if (!slot) return { profile: undefined, slot: undefined }
  const profile = seed.consequenceProfiles.find(
    (p) => p.responseSlotId === slot!.id,
  )
  return { profile, slot }
}
