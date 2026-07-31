// Expansion Phase 4 §4.3 / §5.7 — one definition of "a regular's Phase 4
// fields, filled in".
//
// WHY THIS IS A SHARED HELPER AND NOT THREE COPIES. Three places produce a
// regular: `createInitialTavernState` (the starter roster), the emergence pass
// (`regularModule.createRegular`), and the load-path migration
// (`ensureRegularServiceFields`). If those three disagree by so much as a
// default, a reloaded save is a DIFFERENT save — the §5.10 gate reads a reload
// as a different day — and Phase 3 hit exactly that with the workforce fields.
// So the defaults live here and all three call this.
//
// The values are derived, never rolled: no RNG runs in this file, so filling
// these fields in cannot shift a generated name (architecture rule 7).

/**
 * Where a regular starts with the owner personally.
 *
 * Loyalty is "do I drink here"; standing is "would I do you a favour". Somebody
 * who has been coming a while is on nodding terms, so the two are correlated —
 * but a new regular is not yet a friend, which is why the scale is compressed
 * around the neutral 50 rather than copied from loyalty.
 */
export function initialOwnerStanding(loyalty: number): number {
  return Math.max(0, Math.min(100, Math.round(40 + loyalty / 5)))
}

/** The Phase 4 fields, at their starting values. */
export function regularServiceDefaults(loyalty: number): {
  ownerStanding: number
  serviceMemory: never[]
  consecutiveBadVisits: number
  wordOfMouth: { recommendations: number; criticisms: number }
} {
  return {
    ownerStanding: initialOwnerStanding(loyalty),
    serviceMemory: [],
    consecutiveBadVisits: 0,
    wordOfMouth: { recommendations: 0, criticisms: 0 },
  }
}
