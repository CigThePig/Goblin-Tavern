// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Social-interaction domain for regulars. A regular's specialty is the
// social register they bring to a moment (gossip, war_story, dealmaking,
// …); their blindspot is what they miss or mishandle in that same
// vocabulary. Same domain for both — the factory picks specialty first,
// then a different entry as the blindspot.
//
// Uniform shape with staff (one specialty, one blindspot, same
// bounded-id pattern) means the compose-layer assembler does not need
// to branch on entity kind.

export const REGULAR_SOCIAL_SPECIALTIES: readonly string[] = [
  'gossip',
  'war_story',
  'complaint',
  'dealmaking',
  'personal_drama',
  'house_news',
  'political_rumour',
] as const
