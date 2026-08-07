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
  // -- Expansion Phase 8 §8.2 — what the culture actually rubs against ------
  /**
   * Culture TAGS this culture has friction with.
   *
   * `conflictTags` above is the narrative label the friction is reported
   * under ("merchant distrust"); it names the feeling, not the target, and
   * nothing had ever resolved it to another culture — so culture-to-culture
   * relationships did not exist. This resolves: a culture rubs against any
   * culture carrying one of these tags, and §8.2's "relationships with
   * other cultures" becomes a thing the seating pass can actually check.
   */
  frictionWith: string[]
  /**
   * How much this culture trusts the house to look after them, at day zero.
   *
   * Distinct from comfort, which §8.2 lists separately: comfort is "am I at
   * ease in this room tonight", trust is "will this house look after my
   * people again". A culture can be comfortable in a warm room and still not
   * trust an owner who served them something they do not eat last week.
   */
  defaultTrust: number
  /**
   * Tags that count as HONOURING this culture's observance.
   *
   * A recipe tag, a policy tag, a project tag or an arc tag — matched
   * against what the tavern actually did on the day the observance ran, so
   * "we kept their festival" is evidence rather than an assumption.
   */
  observanceHonouredBy: string[]
}
