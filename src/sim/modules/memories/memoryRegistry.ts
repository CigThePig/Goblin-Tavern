import { Registry } from '../../registries/Registry'
import type { MemoryDefinition } from './memoryTypes'

// Phase 16 §16.1 — Memory registry.
//
// A registry holds the canonical definitions for memory ids the sim
// uses. Modules call `ctx.addMemory({ id, ... })` and the memory module
// looks up the registry to fill in defaults (type, duration, strength,
// stacking strategy, tags). Memories with no registered definition are
// still allowed — they default to a `timed` memory with no duration.

export const memoryRegistry = new Registry<MemoryDefinition>()

// Phase 16 §16.3 — required default definitions cover the obvious
// memory-creation points wired through Phases 12–15. The numbers below
// follow the spec recommendations: timed memories last 7–21 days,
// strength sits around 30–50, and stacking favours `increase_strength`
// for repeated-event memories (watered ale, missed wages) so they
// compound without exploding into duplicates.
export const REQUIRED_MEMORY_DEFINITIONS: MemoryDefinition[] = [
  // --- Owner-action memories ---
  {
    id: 'watered_ale_recently',
    type: 'timed',
    label: 'Watered Down Ale',
    defaultDurationDays: 14,
    defaultStrength: 40,
    tags: ['stock', 'ale', 'deception', 'customer_trust'],
    relatedSystems: ['stock', 'reputation'],
    stacking: 'increase_strength',
  },
  {
    id: 'staff_bonus_paid_recently',
    type: 'timed',
    label: 'Staff Bonus Paid',
    defaultDurationDays: 10,
    defaultStrength: 35,
    tags: ['staff', 'wages', 'morale'],
    relatedSystems: ['staff'],
    stacking: 'refresh',
  },
  {
    id: 'roof_patched_recently',
    type: 'timed',
    label: 'Roof Patched',
    defaultDurationDays: 14,
    defaultStrength: 30,
    tags: ['repair', 'roof', 'maintenance'],
    relatedSystems: ['areas'],
    stacking: 'refresh',
  },
  {
    id: 'cellar_fumigated_recently',
    type: 'timed',
    label: 'Cellar Fumigated',
    defaultDurationDays: 10,
    defaultStrength: 35,
    tags: ['cellar', 'pests', 'sanitation'],
    relatedSystems: ['areas'],
    stacking: 'refresh',
  },
  {
    id: 'area_cleaned_recently',
    type: 'timed',
    label: 'Area Cleaned',
    defaultDurationDays: 5,
    defaultStrength: 25,
    tags: ['cleanliness', 'maintenance'],
    relatedSystems: ['areas'],
    stacking: 'refresh',
  },
  {
    id: 'area_repaired_recently',
    type: 'timed',
    label: 'Area Repaired',
    defaultDurationDays: 14,
    defaultStrength: 30,
    tags: ['repair', 'maintenance'],
    relatedSystems: ['areas'],
    stacking: 'refresh',
  },

  // --- Weekly memories ---
  {
    id: 'wages_paid_recently',
    type: 'timed',
    label: 'Wages Paid',
    defaultDurationDays: 7,
    defaultStrength: 35,
    tags: ['staff', 'wages'],
    relatedSystems: ['staff'],
    stacking: 'refresh',
  },
  {
    id: 'wages_unpaid_recently',
    type: 'timed',
    label: 'Wages Unpaid',
    defaultDurationDays: 14,
    defaultStrength: 50,
    tags: ['staff', 'wages', 'risk'],
    relatedSystems: ['staff'],
    stacking: 'increase_strength',
  },

  // --- Monthly memories ---
  {
    id: 'rent_paid_recently',
    type: 'timed',
    label: 'Rent Paid',
    defaultDurationDays: 14,
    defaultStrength: 35,
    tags: ['rent', 'landlord'],
    relatedSystems: ['monthly'],
    stacking: 'refresh',
  },
  {
    id: 'rent_missed_recently',
    type: 'timed',
    label: 'Rent Missed',
    defaultDurationDays: 28,
    defaultStrength: 55,
    tags: ['rent', 'landlord', 'risk'],
    relatedSystems: ['monthly'],
    stacking: 'increase_strength',
  },
  {
    id: 'first_rent_paid',
    type: 'fact',
    label: 'First Rent Paid',
    defaultStrength: 60,
    tags: ['rent', 'milestone'],
    relatedSystems: ['monthly'],
    stacking: 'replace',
  },
  {
    id: 'inspection_warning_recently',
    type: 'timed',
    label: 'Inspection Warning',
    defaultDurationDays: 28,
    defaultStrength: 60,
    tags: ['inspection', 'warning', 'risk'],
    relatedSystems: ['monthly', 'inspection'],
    stacking: 'increase_strength',
  },

  // --- Service memories ---
  {
    id: 'recent_brawl',
    type: 'timed',
    label: 'Recent Brawl',
    defaultDurationDays: 7,
    defaultStrength: 40,
    tags: ['violence', 'incident'],
    relatedSystems: ['service'],
    stacking: 'increase_strength',
  },
  {
    id: 'ale_shortage_recently',
    type: 'timed',
    label: 'Ale Shortage',
    defaultDurationDays: 5,
    defaultStrength: 35,
    tags: ['stock', 'ale', 'shortage'],
    relatedSystems: ['stock', 'service'],
    stacking: 'increase_strength',
  },
  {
    id: 'stew_shortage_recently',
    type: 'timed',
    label: 'Stew Shortage',
    defaultDurationDays: 5,
    defaultStrength: 30,
    tags: ['stock', 'stew', 'shortage'],
    relatedSystems: ['stock', 'service'],
    stacking: 'increase_strength',
  },
  {
    id: 'merchants_unhappy_recently',
    type: 'timed',
    label: 'Merchants Unhappy',
    defaultDurationDays: 7,
    defaultStrength: 35,
    tags: ['customers', 'merchants', 'complaint'],
    relatedSystems: ['customers'],
    stacking: 'increase_strength',
  },

  // Phase 33 §33.5 / §33.7 — owner project + social-action memories.
  // These power the weekly community routine planned for Phase 34: a
  // recently-comforted staff member or a recently-apologized-to regular
  // should weigh on later scene generation and rumour propagation.
  {
    id: 'project_completed_recently',
    type: 'timed',
    label: 'Project Completed',
    defaultDurationDays: 21,
    defaultStrength: 50,
    tags: ['owner_action', 'project', 'milestone'],
    relatedSystems: ['ownerActions', 'projects'],
    stacking: 'refresh',
  },
  {
    id: 'staff_comforted_recently',
    type: 'timed',
    label: 'Staff Comforted',
    defaultDurationDays: 7,
    defaultStrength: 35,
    tags: ['owner_action', 'social', 'staff', 'morale'],
    relatedSystems: ['ownerActions', 'staff'],
    stacking: 'refresh',
  },
  {
    id: 'regular_apologized_to_recently',
    type: 'timed',
    label: 'Regular Apologized To',
    defaultDurationDays: 10,
    defaultStrength: 40,
    tags: ['owner_action', 'social', 'regulars'],
    relatedSystems: ['ownerActions', 'regulars'],
    stacking: 'refresh',
  },

  // Phase 32 §32.5 — scene-driven memories. The service scene builder
  // emits these only when the scene should influence future days; the
  // scene itself stays a structural record on the daily result so the
  // history/cause trail does not double-record.
  {
    id: 'regular_complained_recently',
    type: 'timed',
    label: 'Regular Complained',
    defaultDurationDays: 7,
    defaultStrength: 35,
    tags: ['service', 'scene', 'regulars', 'complaint'],
    relatedSystems: ['service', 'regulars'],
    stacking: 'increase_strength',
  },
  {
    id: 'staff_snapped_recently',
    type: 'timed',
    label: 'Staff Snapped',
    defaultDurationDays: 7,
    defaultStrength: 40,
    tags: ['service', 'scene', 'staff', 'stress'],
    relatedSystems: ['service', 'staff'],
    stacking: 'increase_strength',
  },
  {
    id: 'area_problem_publicly_noticed',
    type: 'timed',
    label: 'Area Problem Publicly Noticed',
    defaultDurationDays: 7,
    defaultStrength: 30,
    tags: ['service', 'scene', 'areas'],
    relatedSystems: ['service', 'areas'],
    stacking: 'increase_strength',
  },

  // --- Pattern memories ---
  {
    id: 'repeated_ale_shortages',
    type: 'pattern',
    label: 'Repeated Ale Shortages',
    defaultDurationDays: 21,
    defaultStrength: 60,
    tags: ['pattern', 'stock', 'ale', 'shortage'],
    relatedSystems: ['stock', 'reputation'],
    stacking: 'refresh',
  },
  {
    id: 'repeated_unpaid_wages',
    type: 'pattern',
    label: 'Repeated Unpaid Wages',
    defaultDurationDays: 21,
    defaultStrength: 65,
    tags: ['pattern', 'staff', 'wages', 'risk'],
    relatedSystems: ['staff'],
    stacking: 'refresh',
  },
  {
    id: 'habitual_roof_neglect',
    type: 'pattern',
    label: 'Habitual Roof Neglect',
    defaultDurationDays: 28,
    defaultStrength: 55,
    tags: ['pattern', 'maintenance', 'roof'],
    relatedSystems: ['areas'],
    stacking: 'refresh',
  },
  {
    id: 'merchant_decline_pattern',
    type: 'pattern',
    label: 'Merchant Decline',
    defaultDurationDays: 28,
    defaultStrength: 60,
    tags: ['pattern', 'customers', 'merchants'],
    relatedSystems: ['customers', 'reputation'],
    stacking: 'refresh',
  },

  // --- Future hook examples ---
  {
    id: 'food_poisoning_rumor_possible',
    type: 'future_hook',
    label: 'Food Poisoning Rumor Possible',
    defaultDurationDays: 7,
    defaultStrength: 35,
    tags: ['food_safety', 'rumor', 'customer_trust'],
    relatedSystems: ['stock', 'customers', 'inspection'],
    stacking: 'replace',
  },
  {
    id: 'inspector_followup_possible',
    type: 'future_hook',
    label: 'Inspector Follow-up Possible',
    defaultDurationDays: 14,
    defaultStrength: 45,
    tags: ['inspection', 'risk'],
    relatedSystems: ['inspection'],
    stacking: 'replace',
  },
  {
    id: 'supplier_retaliation_possible',
    type: 'future_hook',
    label: 'Supplier Retaliation Possible',
    defaultDurationDays: 14,
    defaultStrength: 30,
    tags: ['supplier', 'risk'],
    relatedSystems: ['stock'],
    stacking: 'replace',
  },
  {
    id: 'staff_quit_risk_possible',
    type: 'future_hook',
    label: 'Staff Quit Risk',
    defaultDurationDays: 14,
    defaultStrength: 40,
    tags: ['staff', 'risk'],
    relatedSystems: ['staff'],
    stacking: 'replace',
  },
]

let initialized = false

export function ensureRequiredMemoriesRegistered(): void {
  if (initialized) return
  for (const def of REQUIRED_MEMORY_DEFINITIONS) {
    if (!memoryRegistry.has(def.id)) {
      memoryRegistry.register(def)
    }
  }
  initialized = true
}

ensureRequiredMemoriesRegistered()
