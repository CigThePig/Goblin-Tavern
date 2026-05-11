// Phase 22 §"Culture Types" — culture definition shape.
//
// The current `CustomerGroupState` already carries `preferredStockTags`
// and `dislikedTags`; culture definitions complement, not replace, that
// shape. Phase 30 extends this skeleton with `description`,
// `areaTraitPreferences?`, `conflictTags`, `defaultFamiliarity`,
// `defaultComfort`, and `defaultTension`. The skeleton field names here
// stay stable — Phase 30 only adds, never renames.

import type { NamingProfileId } from '../naming/nameTypes'

export type CultureDefinition = {
  id: string
  label: string
  tags: string[]
  namingProfileId: NamingProfileId
  preferredStockTags: string[]
  dislikedTags: string[]
  importantCalendarTags: string[]
}
