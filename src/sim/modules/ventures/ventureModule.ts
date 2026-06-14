import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import { advanceLifecycleEntry, resolveBranchingMilestone, type LifecycleTrigger } from '../kernel'
import { createLiquorLicenseVenture, LIQUOR_LICENSE_VENTURE_ID, liquorLicenseDefinition } from './liquorLicense'

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
  return { advanced: true, toStage: resolved.nextStage, effects: resolved.effects, cause: { source: 'ventures.advance', readable: `${entry.label} advanced through owner investment.`, tags: ['teleology', 'venture', 'advance', entry.id] } }
}

const startDayHook: SimulationHook = (ctx) => spawnDevVenture(ctx)
const endDayHook: SimulationHook = (ctx) => {
  const entry = ctx.state.ventures[LIQUOR_LICENSE_VENTURE_ID]
  if (!entry || entry.status !== 'active') return
  advanceLifecycleEntry(ctx, entry, liquorLicenseDefinition, investmentTrigger)
}

export const ventureModule: SimulationModule = {
  id: 'ventures',
  version: '0.1.0',
  dependsOn: ['kernel'],
  hooks: { startDay: [startDayHook], endDay: [endDayHook] },
}
