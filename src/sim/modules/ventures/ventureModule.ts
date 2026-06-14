import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import { advanceLifecycleEntry, resolveBranchingMilestone, type LifecycleTrigger } from '../kernel'
import { createLiquorLicenseVenture, LIQUOR_LICENSE_VENTURE_ID } from './liquorLicense'
import { getVentureBlueprint } from './ventureCatalog'

// Phase 1 (teleology) proved the spine on one hardcoded venture via a
// dev-only spawn. Phase 2 makes openings the real entry path: a committed
// opening spawns the venture through the response applier (see
// `ventureCatalog` + the `ventures.<id>.spawn` applier path). The dev
// spawn is retained ONLY as a test affordance (gated on NODE_ENV +
// `devOptions`) — it is no longer the production way a venture appears.
function spawnDevVenture(ctx: SimContext): void {
  if (process.env.NODE_ENV === 'production') return
  if (ctx.input.devOptions?.spawnVenture !== LIQUOR_LICENSE_VENTURE_ID) return
  if (ctx.state.ventures[LIQUOR_LICENSE_VENTURE_ID]) return
  ctx.addVenture(createLiquorLicenseVenture(ctx.state.calendar.totalDaysElapsed), { source: 'ventures.dev_spawn', readable: 'Dev spawned venture: Acquire a liquor licence.', tags: ['teleology', 'venture', 'dev_spawn'] })
}

const investmentTrigger: LifecycleTrigger = (entry, ctx, definition) => {
  const milestone = definition.milestones.find((m) => m.fromStage === entry.stage)
  if (!milestone) return { advanced: false }
  const resolved = resolveBranchingMilestone(entry, ctx, milestone)
  if (!resolved) return { advanced: false }
  return { advanced: true, toStage: resolved.nextStage, effects: resolved.effects, ...(resolved.terminal ? { status: 'completed' as const } : {}), cause: { source: 'ventures.advance', readable: `${entry.label} advanced through owner investment.`, tags: ['teleology', 'venture', 'advance', entry.id] } }
}

const startDayHook: SimulationHook = (ctx) => spawnDevVenture(ctx)
const endDayHook: SimulationHook = (ctx) => {
  // Advance every active venture through its catalogued definition. Each
  // venture is a singleton keyed by its blueprint id; the catalog supplies
  // the milestone definition so this loop never hardcodes a single venture.
  for (const entry of Object.values(ctx.state.ventures)) {
    if (entry.status !== 'active') continue
    const blueprint = getVentureBlueprint(entry.id)
    if (!blueprint) continue
    advanceLifecycleEntry(ctx, entry, blueprint.definition, investmentTrigger, (id, changes, meta) => ctx.modifyVenture(id, changes, meta))
  }
}

export const ventureModule: SimulationModule = {
  id: 'ventures',
  version: '0.2.0',
  dependsOn: ['kernel'],
  hooks: { startDay: [startDayHook], endDay: [endDayHook] },
}
