// Phase 22 §"Culture Types" / Phase 30 §30.1 — culture definition shape.
//
// The current `CustomerGroupState` already carries `preferredStockTags`
// and `dislikedTags`; culture definitions complement, not replace, that
// shape. Phase 30 extends the Phase 22 skeleton with `description`,
// `areaTraitPreferences?`, `conflictTags`, `defaultFamiliarity`,
// `defaultComfort`, and `defaultTension`. The Phase 22 field names stay
// stable — Phase 30 only adds, never renames.

import type { NamingProfileId } from '../naming/nameTypes'

export type CultureDefinition = {
  id: string
  label: string
  tags: string[]
  namingProfileId: NamingProfileId
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
  // Phase 30 §30.1 — added fields.
  description: string
  areaTraitPreferences?: {
    likes: string[]
    dislikes: string[]
  }
  conflictTags: string[]
  defaultFamiliarity: number
  defaultComfort: number
  defaultTension: number
}
