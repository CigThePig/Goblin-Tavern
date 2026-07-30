// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// Per-role specialty domain. Each role declares a small bounded list;
// the factory picks one entry as the staff member's specialty and a
// different entry as the blindspot. Same list serves both — specialty
// and blindspot are pulled from the same domain so they remain
// comparable ("sharp at sauces / blind to pastry" reads as one axis,
// not two unrelated tags).
//
// Domains are intentionally narrow (4–6 entries). The fix to the
// 20-line demo failure is *bounded* vocabulary; expanding past ~6 per
// role pushes the assembler toward selection noise.

import type { StaffRoleId } from '../../state/TavernState'

export const STAFF_SPECIALTY_DOMAIN: Readonly<Record<StaffRoleId, readonly string[]>> =
  Object.freeze({
    cook: ['meat_dishes', 'stews', 'pickling', 'pastry', 'grilling', 'sauces'],
    server: [
      'fast_service',
      'tab_management',
      'crowd_calming',
      'upsell',
      'seat_juggling',
    ],
    cleaner_bouncer: [
      'pest_control',
      'spill_response',
      'door_screening',
      'drunk_handling',
      'fight_breaking',
    ],
    kitchen_hand: [
      'prep_speed',
      'knife_work',
      'ingredient_storage',
      'cleanup_pace',
      'errand_running',
    ],
    seasoned_cook: [
      'rare_ingredients',
      'menu_planning',
      'taste_balance',
      'kitchen_pacing',
      'recipe_invention',
      'stock_judgement',
    ],
    master_chef: [
      'signature_dish',
      'showpiece_plating',
      'rare_preparations',
      'mentorship',
      'palate_calibration',
      'crisis_recipes',
    ],
    // Expansion Phase 3 §3.1 — the two lead roles the promotion ladder adds.
    // A domain per role is mandatory (`getStaffSpecialtyDomain` throws without
    // one), so a promotion target with no domain would be a role nobody could
    // be promoted into. Both lean on what a lead actually does that their own
    // role below them does not: running other people.
    head_server: [
      'floor_command',
      'regular_diplomacy',
      'tab_recovery',
      'shift_handover',
      'training_juniors',
    ],
    head_keeper: [
      'house_rules',
      'threat_reading',
      'rota_discipline',
      'repair_triage',
      'training_juniors',
    ],
  })

export function getStaffSpecialtyDomain(roleId: StaffRoleId): readonly string[] {
  const domain = STAFF_SPECIALTY_DOMAIN[roleId]
  if (!domain) {
    throw new Error(
      `getStaffSpecialtyDomain: no specialty domain registered for role '${roleId}'`,
    )
  }
  return domain
}
