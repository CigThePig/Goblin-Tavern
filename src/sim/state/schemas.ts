import { z } from 'zod'
import type { SimulationModule } from '../core/module'

// Phase 6 §6.1 — Core schemas.
//
// Each schema mirrors the corresponding Phase 5 type exactly: same field
// names, same shapes, no re-tuned ranges beyond what Phase 5 already
// specified. The 0–100 percentage range and the "stock quantity ≥ 0,
// no NaN" rules come from `phases-06-10.md` §"State Safety Rules".

const meter = () => z.number().min(0).max(100)
const nonNegativeNumber = () => z.number().min(0)
const nonNegativeInt = () => z.number().int().min(0)

export const CalendarStateSchema = z.object({
  day: z.number().int().min(1).max(28),
  week: z.number().int().min(1).max(4),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1),
  totalDaysElapsed: nonNegativeInt(),
  dayOfWeek: z.number().int().min(1).max(7),
  dayType: z.enum([
    'supplier_day',
    'quiet_day',
    'market_day',
    'local_night',
    'payday',
    'brawl_night',
    'maintenance_day',
  ]),
})

export const TavernMetaStateSchema = z.object({
  tavernId: z.string(),
  tavernName: z.string(),
  simVersion: z.string(),
  createdAtDay: nonNegativeInt(),
})

export const AreaStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  condition: meter(),
  cleanliness: meter(),
  mess: meter(),
  damage: meter(),
  smell: meter(),
  risk: meter(),
  tags: z.array(z.string()),
  activeProblems: z.array(z.string()),
})

export const StockItemStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantity: nonNegativeNumber(),
  quality: meter(),
  spoilage: meter(),
  unitValue: z.number(),
  tags: z.array(z.string()),
})

export const StaffStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['cook', 'server', 'cleaner_bouncer']),
  skill: meter(),
  morale: meter(),
  stress: meter(),
  fatigue: meter(),
  loyalty: meter(),
  wage: z.number(),
  tags: z.array(z.string()),
  activeProblems: z.array(z.string()),
})

export const CustomerGroupStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  patronage: meter(),
  satisfaction: meter(),
  wealth: meter(),
  rowdiness: meter(),
  dangerTolerance: meter(),
  filthTolerance: meter(),
  priceSensitivity: meter(),
  damageRisk: meter(),
  tabRisk: meter(),
  tags: z.array(z.string()),
  activeGrudges: z.array(z.string()),
})

export const ReputationStateSchema = z.object({
  cheap: meter(),
  tasty: meter(),
  filthy: meter(),
  dangerous: meter(),
  cozy: meter(),
  strange: meter(),
  reliable: meter(),
  goblinAuthentic: meter(),
})

export const MemoryStateSchema = z.object({
  id: z.string(),
  type: z.enum(['fact', 'timed', 'grudge', 'hook']),
  strength: z.number(),
  ageDays: nonNegativeInt(),
  durationDays: nonNegativeInt().optional(),
  tags: z.array(z.string()),
  relatedIds: z.array(z.string()),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const CauseEntrySchema = z.object({
  id: z.string(),
  day: z.number().int(),
  source: z.string(),
  target: z.string(),
  amount: z.number(),
  readable: z.string(),
  tags: z.array(z.string()),
})

export const PressureStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: meter(),
  trend: z.number(),
  tags: z.array(z.string()),
  topCauses: z.array(z.string()),
})

// Phase 6 §6.1.1 — Module schema composition.
//
// Each registered simulation module may declare a `stateSchema` for its
// namespaced data under `state.modules[id]`. `buildModulesSchema` composes a
// dynamic schema from the modules supplied. Unknown keys are passed through
// (via `.passthrough()`) so a save envelope that references a disabled
// module still validates; the caller (validation.ts) surfaces those keys
// as warnings.
export function buildModulesSchema(
  modules: ReadonlyArray<SimulationModule>,
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType<unknown>> = {}
  for (const mod of modules) {
    if (mod.stateSchema) {
      shape[mod.id] = mod.stateSchema.optional()
    }
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<Record<string, unknown>>
}

// Compose the full TavernState schema. The `modules` argument lets the
// validator wire in currently-registered module schemas (Phase 6 §6.1.1).
export function buildTavernStateSchema(modules: ReadonlyArray<SimulationModule>) {
  return z.object({
    meta: TavernMetaStateSchema,
    calendar: CalendarStateSchema,
    coin: z.number().int().min(0),
    areas: z.record(z.string(), AreaStateSchema),
    stock: z.record(z.string(), StockItemStateSchema),
    staff: z.record(z.string(), StaffStateSchema),
    customerGroups: z.record(z.string(), CustomerGroupStateSchema),
    reputation: ReputationStateSchema,
    memories: z.array(MemoryStateSchema),
    causes: z.array(CauseEntrySchema),
    pressures: z.record(z.string(), PressureStateSchema),
    modules: buildModulesSchema(modules),
  })
}

// Default static schema (no modules registered). Useful for simple use
// and for tests that don't care about module-state composition.
export const TavernStateSchema = buildTavernStateSchema([])
