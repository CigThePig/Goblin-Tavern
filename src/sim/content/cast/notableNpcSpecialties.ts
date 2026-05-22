// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
//
// Per-profile-kind specialty domain for notable NPCs. The set of `kind`
// values currently registered in `notableNpcProfiles.ts` (`authority`,
// `moneylender`, `gossip`, `fence`, `priest`, `merchant_prince`,
// `labour_lead`, `smuggler`, `creditor`, `rival`) each get a 6-entry
// trade domain — same shape as `STAFF_SPECIALTY_DOMAIN`. Unknown kinds
// fall back to `NOTABLE_NPC_FALLBACK_DOMAIN` so a new profile-kind
// doesn't break attribute rolls before its trade is registered.

export const NOTABLE_NPC_FALLBACK_DOMAIN: readonly string[] = [
  'plain_dealing',
  'reading_a_room',
  'long_memory',
  'discretion',
  'leverage',
  'tactful_silence',
] as const

export const NOTABLE_NPC_SPECIALTY_DOMAIN: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  authority: [
    'public_ruling',
    'enforcement',
    'protocol',
    'patronage',
    'public_face',
    'private_word',
  ],
  moneylender: [
    'rate_setting',
    'collateral_judgement',
    'collection',
    'discretion',
    'long_memory',
    'leverage',
  ],
  gossip: [
    'rumour_sourcing',
    'crowd_reading',
    'name_recall',
    'plausible_deniability',
    'embellishment',
    'timing',
  ],
  fence: [
    'goods_valuation',
    'discretion',
    'salvage_judgement',
    'price_haggling',
    'underworld_contacts',
    'plain_dealing',
  ],
  priest: [
    'ceremony',
    'lay_advice',
    'judgement',
    'public_voice',
    'comfort',
    'austerity',
  ],
  merchant_prince: [
    'long_view_deals',
    'patronage',
    'protocol',
    'price_setting',
    'public_face',
    'leverage',
  ],
  labour_lead: [
    'crew_organisation',
    'public_voice',
    'hard_bargain',
    'job_judgement',
    'solidarity',
    'plain_dealing',
  ],
  smuggler: [
    'route_knowledge',
    'discretion',
    'goods_valuation',
    'risk_judgement',
    'underworld_contacts',
    'quick_substitutes',
  ],
  creditor: [
    'rate_setting',
    'collateral_judgement',
    'collection',
    'discretion',
    'patience',
    'leverage',
  ],
  rival: [
    'reputation_play',
    'public_face',
    'price_undercut',
    'crowd_reading',
    'cheap_tricks',
    'long_memory',
  ],
})

export function getNotableNpcSpecialtyDomain(
  profileKind: string,
): readonly string[] {
  return NOTABLE_NPC_SPECIALTY_DOMAIN[profileKind] ?? NOTABLE_NPC_FALLBACK_DOMAIN
}
