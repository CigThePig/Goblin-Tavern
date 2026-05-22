// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
//
// Shared social-register domain for factions. A faction's specialty is
// the political register it brings to a moment (ceremony, hard_bargain,
// quiet_diplomacy, …); its blindspot is what it tends to mishandle in
// that same vocabulary. Factions don't partition cleanly by kind the
// way staff do by role, so one shared domain serves all factions —
// mirrors the regulars-style `REGULAR_SOCIAL_SPECIALTIES` pattern.

export const FACTION_SOCIAL_SPECIALTIES: readonly string[] = [
  'ceremony',
  'hard_bargain',
  'quiet_diplomacy',
  'public_display',
  'intelligence',
  'patronage',
  'intimidation',
] as const
