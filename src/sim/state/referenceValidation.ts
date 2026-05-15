// Phase 26 §26.4 — Cross-reference validation helpers.
//
// Zod can confirm shape ("this looks like an EntityRef") but cannot
// confirm reachability ("the supplier this rumour points at actually
// exists in `state.world.suppliers`"). These helpers run after schema
// parsing succeeds and surface broken pointers as `ValidationIssue`s
// using the same path/message/code style as the Phase 6 validators.

import { namingProfileRegistry } from '../content/naming/namingProfiles'
import { recipeRegistry } from '../registries/recipeRegistry'
import { staffRegistry } from '../registries/staffRegistry'
import { stockRegistry } from '../registries/stockRegistry'
import type { EntityRef, TavernState } from './TavernState'
import type { ValidationIssue } from './types'

function makeIssue(
  path: string,
  message: string,
  code: string,
): ValidationIssue {
  return { path, message, code }
}

// Phase 26 §26.4 — Resolve a single `EntityRef` against the current
// state and the appropriate registries. `system` and `other` are
// shape-only (an `id` exists on the ref but no further membership
// check is required).
export function validateEntityRef(
  state: TavernState,
  ref: EntityRef,
  path = 'ref',
): ValidationIssue[] {
  if (typeof ref.id !== 'string' || ref.id.length === 0) {
    return [makeIssue(`${path}.id`, `EntityRef id is empty`, 'empty_ref_id')]
  }

  switch (ref.kind) {
    case 'staff':
      if (!(ref.id in state.staff)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown staff id '${ref.id}'`,
            'unknown_staff_ref',
          ),
        ]
      }
      return []
    case 'customer_group':
      if (!(ref.id in state.customerGroups)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown customer_group id '${ref.id}'`,
            'unknown_customer_group_ref',
          ),
        ]
      }
      return []
    case 'area':
      if (!(ref.id in state.areas)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown area id '${ref.id}'`,
            'unknown_area_ref',
          ),
        ]
      }
      return []
    case 'stock':
      if (!(ref.id in state.stock)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown stock id '${ref.id}'`,
            'unknown_stock_ref',
          ),
        ]
      }
      return []
    case 'role':
      if (!staffRegistry.has(ref.id)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown staff role id '${ref.id}'`,
            'unknown_role_ref',
          ),
        ]
      }
      return []
    case 'culture':
      if (!(ref.id in state.world.cultures)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown culture id '${ref.id}'`,
            'unknown_culture_ref',
          ),
        ]
      }
      return []
    case 'faction':
      if (!(ref.id in state.world.factions)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown faction id '${ref.id}'`,
            'unknown_faction_ref',
          ),
        ]
      }
      return []
    case 'supplier':
      if (!(ref.id in state.world.suppliers)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown supplier id '${ref.id}'`,
            'unknown_supplier_ref',
          ),
        ]
      }
      return []
    case 'regular':
      if (!(ref.id in state.world.regulars)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown regular id '${ref.id}'`,
            'unknown_regular_ref',
          ),
        ]
      }
      return []
    case 'notable_npc':
      if (!(ref.id in state.world.notableNpcs)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown notable_npc id '${ref.id}'`,
            'unknown_notable_npc_ref',
          ),
        ]
      }
      return []
    case 'local_event':
      if (!(ref.id in state.world.localEvents)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown local_event id '${ref.id}'`,
            'unknown_local_event_ref',
          ),
        ]
      }
      return []
    case 'rumour':
      if (!(ref.id in state.world.socialRumours)) {
        return [
          makeIssue(
            `${path}.id`,
            `Unknown rumour id '${ref.id}'`,
            'unknown_rumour_ref',
          ),
        ]
      }
      return []
    case 'tavern_identity':
      // The tavern_identity record is a singleton on the world branch.
      // Any non-empty id is treated as legal — Phase 26 does not pin
      // a particular id (the meta id and the identity record are not
      // 1:1 in every save).
      return []
    case 'system':
    case 'other':
      return []
    default: {
      // Schema parsing should have rejected unknown kinds already; this
      // branch exists so a future widening of the enum without an update
      // here surfaces as a hard error rather than a silent pass.
      const exhaustive: never = ref.kind
      return [
        makeIssue(
          `${path}.kind`,
          `Unsupported EntityRef kind '${String(exhaustive)}'`,
          'unsupported_ref_kind',
        ),
      ]
    }
  }
}

// Phase 26 §26.4 / Phase 30 §30.11 — Walk every world-branch record
// (and Phase 30's culturally-linked customer group entries) that points
// at another id and report broken pointers. The checks here are the
// minimum set required by the phase spec; later phases can extend the
// world without touching this helper as long as new pointers are
// reported through the same `ValidationIssue` channel.
// Phase 65 / ISSUE-025 §6.1 — Every recipe must reference real
// ingredient ids. A recipe whose `inputs` point at an unknown
// ingredient id is unservable; validation surfaces it instead of
// letting the service flow throw at runtime.
export function validateRecipeReferences(state: TavernState): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const [id] of Object.entries(state.recipes)) {
    const def = recipeRegistry.has(id) ? recipeRegistry.get(id) : null
    if (!def) {
      issues.push(
        makeIssue(
          `recipes.${id}`,
          `Recipe '${id}' has no registry definition`,
          'unknown_recipe_definition',
        ),
      )
      continue
    }
    for (let i = 0; i < def.inputs.length; i++) {
      const input = def.inputs[i]!
      if (!(input.ingredientId in state.stock) && !stockRegistry.has(input.ingredientId)) {
        issues.push(
          makeIssue(
            `recipes.${id}.inputs[${i}].ingredientId`,
            `Recipe '${id}' references unknown ingredient '${input.ingredientId}'`,
            'unknown_stock_ref',
          ),
        )
      }
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        issues.push(
          makeIssue(
            `recipes.${id}.inputs[${i}].quantity`,
            `Recipe '${id}' input quantity must be a positive number`,
            'invalid_recipe_input_quantity',
          ),
        )
      }
    }
  }
  return issues
}

export function validateWorldReferences(state: TavernState): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const world = state.world

  // Phase 30 §30.11 — customer groups must point at a registered
  // culture and a registered naming profile, and any relationship-map
  // keys must refer to other groups that exist.
  for (const [id, group] of Object.entries(state.customerGroups)) {
    if (!(group.cultureId in world.cultures)) {
      issues.push(
        makeIssue(
          `customerGroups.${id}.cultureId`,
          `Customer group '${id}' references unknown culture '${group.cultureId}'`,
          'unknown_culture_ref',
        ),
      )
    }
    if (!namingProfileRegistry.has(group.namingProfileId)) {
      issues.push(
        makeIssue(
          `customerGroups.${id}.namingProfileId`,
          `Customer group '${id}' references unknown naming profile '${group.namingProfileId}'`,
          'unknown_naming_profile_ref',
        ),
      )
    }
    for (const otherId of Object.keys(group.relationshipToOtherGroups)) {
      if (!(otherId in state.customerGroups)) {
        issues.push(
          makeIssue(
            `customerGroups.${id}.relationshipToOtherGroups.${otherId}`,
            `Customer group '${id}' references unknown customer_group '${otherId}'`,
            'unknown_customer_group_ref',
          ),
        )
      }
    }
  }

  // Cultures: naming profile must exist in the naming registry.
  for (const [id, culture] of Object.entries(world.cultures)) {
    if (!namingProfileRegistry.has(culture.namingProfileId)) {
      issues.push(
        makeIssue(
          `world.cultures.${id}.namingProfileId`,
          `Culture '${id}' references unknown naming profile '${culture.namingProfileId}'`,
          'unknown_naming_profile_ref',
        ),
      )
    }
  }

  // Factions: optional cultureId must exist if present.
  for (const [id, faction] of Object.entries(world.factions)) {
    if (faction.cultureId !== undefined && !(faction.cultureId in world.cultures)) {
      issues.push(
        makeIssue(
          `world.factions.${id}.cultureId`,
          `Faction '${id}' references unknown culture '${faction.cultureId}'`,
          'unknown_culture_ref',
        ),
      )
    }
  }

  // Suppliers: goodsProvided ids must exist (state.stock or stockRegistry),
  // optional faction/culture ids must exist.
  for (const [id, supplier] of Object.entries(world.suppliers)) {
    for (let i = 0; i < supplier.goodsProvided.length; i++) {
      const stockId = supplier.goodsProvided[i]!
      if (!(stockId in state.stock) && !stockRegistry.has(stockId)) {
        issues.push(
          makeIssue(
            `world.suppliers.${id}.goodsProvided[${i}]`,
            `Supplier '${id}' provides unknown stock id '${stockId}'`,
            'unknown_stock_ref',
          ),
        )
      }
    }
    if (
      supplier.factionId !== undefined &&
      !(supplier.factionId in world.factions)
    ) {
      issues.push(
        makeIssue(
          `world.suppliers.${id}.factionId`,
          `Supplier '${id}' references unknown faction '${supplier.factionId}'`,
          'unknown_faction_ref',
        ),
      )
    }
    if (
      supplier.cultureId !== undefined &&
      !(supplier.cultureId in world.cultures)
    ) {
      issues.push(
        makeIssue(
          `world.suppliers.${id}.cultureId`,
          `Supplier '${id}' references unknown culture '${supplier.cultureId}'`,
          'unknown_culture_ref',
        ),
      )
    }
    if (supplier.name && !namingProfileRegistry.has(supplier.name.profileId)) {
      issues.push(
        makeIssue(
          `world.suppliers.${id}.name.profileId`,
          `Supplier '${id}' generated name references unknown naming profile '${supplier.name.profileId}'`,
          'unknown_naming_profile_ref',
        ),
      )
    }
  }

  // Regulars: group must exist, optional culture must exist, optional
  // favoriteStockId must exist, naming profile must exist.
  for (const [id, regular] of Object.entries(world.regulars)) {
    if (!(regular.customerGroupId in state.customerGroups)) {
      issues.push(
        makeIssue(
          `world.regulars.${id}.customerGroupId`,
          `Regular '${id}' references unknown customer_group '${regular.customerGroupId}'`,
          'unknown_customer_group_ref',
        ),
      )
    }
    if (
      regular.cultureId !== undefined &&
      !(regular.cultureId in world.cultures)
    ) {
      issues.push(
        makeIssue(
          `world.regulars.${id}.cultureId`,
          `Regular '${id}' references unknown culture '${regular.cultureId}'`,
          'unknown_culture_ref',
        ),
      )
    }
    if (
      regular.factionId !== undefined &&
      !(regular.factionId in world.factions)
    ) {
      issues.push(
        makeIssue(
          `world.regulars.${id}.factionId`,
          `Regular '${id}' references unknown faction '${regular.factionId}'`,
          'unknown_faction_ref',
        ),
      )
    }
    if (
      regular.favoriteStockId !== undefined &&
      !(regular.favoriteStockId in state.stock)
    ) {
      issues.push(
        makeIssue(
          `world.regulars.${id}.favoriteStockId`,
          `Regular '${id}' references unknown stock '${regular.favoriteStockId}'`,
          'unknown_stock_ref',
        ),
      )
    }
    if (!namingProfileRegistry.has(regular.name.profileId)) {
      issues.push(
        makeIssue(
          `world.regulars.${id}.name.profileId`,
          `Regular '${id}' generated name references unknown naming profile '${regular.name.profileId}'`,
          'unknown_naming_profile_ref',
        ),
      )
    }
  }

  // Notable NPCs: optional group/culture/faction must exist, naming
  // profile must exist.
  for (const [id, npc] of Object.entries(world.notableNpcs)) {
    if (
      npc.customerGroupId !== undefined &&
      !(npc.customerGroupId in state.customerGroups)
    ) {
      issues.push(
        makeIssue(
          `world.notableNpcs.${id}.customerGroupId`,
          `Notable NPC '${id}' references unknown customer_group '${npc.customerGroupId}'`,
          'unknown_customer_group_ref',
        ),
      )
    }
    if (npc.cultureId !== undefined && !(npc.cultureId in world.cultures)) {
      issues.push(
        makeIssue(
          `world.notableNpcs.${id}.cultureId`,
          `Notable NPC '${id}' references unknown culture '${npc.cultureId}'`,
          'unknown_culture_ref',
        ),
      )
    }
    if (npc.factionId !== undefined && !(npc.factionId in world.factions)) {
      issues.push(
        makeIssue(
          `world.notableNpcs.${id}.factionId`,
          `Notable NPC '${id}' references unknown faction '${npc.factionId}'`,
          'unknown_faction_ref',
        ),
      )
    }
    if (!namingProfileRegistry.has(npc.name.profileId)) {
      issues.push(
        makeIssue(
          `world.notableNpcs.${id}.name.profileId`,
          `Notable NPC '${id}' generated name references unknown naming profile '${npc.name.profileId}'`,
          'unknown_naming_profile_ref',
        ),
      )
    }
  }

  // Local events: related faction and culture ids must exist.
  for (const [id, event] of Object.entries(world.localEvents)) {
    for (let i = 0; i < event.relatedFactionIds.length; i++) {
      const factionId = event.relatedFactionIds[i]!
      if (!(factionId in world.factions)) {
        issues.push(
          makeIssue(
            `world.localEvents.${id}.relatedFactionIds[${i}]`,
            `Local event '${id}' references unknown faction '${factionId}'`,
            'unknown_faction_ref',
          ),
        )
      }
    }
    for (let i = 0; i < event.relatedCultureIds.length; i++) {
      const cultureId = event.relatedCultureIds[i]!
      if (!(cultureId in world.cultures)) {
        issues.push(
          makeIssue(
            `world.localEvents.${id}.relatedCultureIds[${i}]`,
            `Local event '${id}' references unknown culture '${cultureId}'`,
            'unknown_culture_ref',
          ),
        )
      }
    }
  }

  // Social rumours: subject and involved refs must resolve.
  for (const [id, rumour] of Object.entries(world.socialRumours)) {
    if (rumour.subject) {
      const subjectIssues = validateEntityRef(
        state,
        rumour.subject,
        `world.socialRumours.${id}.subject`,
      )
      issues.push(...subjectIssues)
    }
    if (rumour.involvedRefs) {
      for (let i = 0; i < rumour.involvedRefs.length; i++) {
        const involved = rumour.involvedRefs[i]!
        const involvedIssues = validateEntityRef(
          state,
          involved,
          `world.socialRumours.${id}.involvedRefs[${i}]`,
        )
        issues.push(...involvedIssues)
      }
    }
  }

  return issues
}
