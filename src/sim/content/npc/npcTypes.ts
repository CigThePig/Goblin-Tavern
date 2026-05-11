// Phase 22 §"NPC Types" — identity shape for generated people.
//
// Phase 22 defines the type only. Phase 31+ will write `NpcIdentity`
// records into the `world` branch of `TavernState`.

import type { GeneratedName } from '../naming/nameTypes'

export type NpcKind =
  | 'regular'
  | 'supplier_contact'
  | 'faction_contact'
  | 'visitor'
  | 'staff_candidate'

export type NpcIdentity = {
  id: string
  kind: NpcKind
  name: GeneratedName
  cultureId?: string
  factionId?: string
  customerGroupId?: string
  tags: string[]
}
