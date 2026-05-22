// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Public surface of the cast content slice. The slice owns the bounded
// attribute vocabulary every staff member and regular carries; the
// compose layer (Phase C+) will eventually read these fields via the
// `actorTrait` SnippetCondition.

export type {
  AffinityAxis,
  AffinityPolarity,
  AffinityStrength,
  CastAttributes,
  CustomerGroupCastAttributes,
  FactionCastAttributes,
  NotableNpcCastAttributes,
  SupplierCastAttributes,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceProfile,
} from './castTypes'

export { VOICE_AXIS_IDS, VOICE_AXIS_DEFINITIONS } from './voiceAxes'
export type { VoiceAxisDefinition } from './voiceAxes'

export {
  verbalTicRegistry,
  ensureRequiredVerbalTicsRegistered,
} from './verbalTics'
export type { VerbalTicDefinition } from './verbalTics'

export {
  STAFF_SPECIALTY_DOMAIN,
  getStaffSpecialtyDomain,
} from './staffSpecialties'

export { REGULAR_SOCIAL_SPECIALTIES } from './regularSpecialties'

// Phase 128 / ISSUE-097 — Voiced Surface Phase 2 (Universal Cast).
export {
  SUPPLIER_FALLBACK_DOMAIN,
  SUPPLIER_SPECIALTY_DOMAIN,
  getSupplierSpecialtyDomain,
} from './supplierSpecialties'

export { FACTION_SOCIAL_SPECIALTIES } from './factionSpecialties'

export {
  NOTABLE_NPC_FALLBACK_DOMAIN,
  NOTABLE_NPC_SPECIALTY_DOMAIN,
  getNotableNpcSpecialtyDomain,
} from './notableNpcSpecialties'

export {
  AFFINITY_TARGETS,
  AFFINITY_TARGET_SET,
  isKnownAffinityTarget,
} from './affinityTargets'

export {
  CULTURE_VOICE_DEFAULTS,
  getCultureVoiceDefault,
} from './cultureVoiceDefaults'

export {
  createStaffCastAttributes,
  createRegularCastAttributes,
  // Phase 128 / ISSUE-097.
  createCustomerGroupCastAttributes,
  createFactionCastAttributes,
  createNotableNpcCastAttributes,
  createSupplierCastAttributes,
} from './createCastAttributes'
export type {
  CreateStaffCastAttributesArgs,
  CreateRegularCastAttributesArgs,
  // Phase 128 / ISSUE-097.
  CreateCustomerGroupCastAttributesArgs,
  CreateFactionCastAttributesArgs,
  CreateNotableNpcCastAttributesArgs,
  CreateSupplierCastAttributesArgs,
} from './createCastAttributes'
