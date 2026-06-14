import { z } from 'zod'

import type { SimulationHook, SimulationModule } from '../../core/module'
import type { SimContext } from '../../core/context'
import { allVentureBlueprints } from '../ventures/ventureCatalog'
import { teleologyUnlocked } from './teleologyUnlock'
import {
  OPENING_ACTIVE_WINDOW_DAYS,
  OPENING_RETURN_WINDOW_DAYS,
  classifyReturnDelta,
  describeReturnDelta,
  readOpeningMeters,
} from './openingLifecycle'
import {
  OPENINGS_MODULE_ID,
  createInitialOpeningsModuleState,
  type OpeningRecord,
  type OpeningsModuleState,
} from './types'

// Phase 2 (teleology) — openings lifecycle module.
//
// Runs on `startDay`, BEFORE the issue-seed generation pass (pipeline order
// places this module ahead of `issueSeedsModule`), so the opening
// generator reads an up-to-date opening store the same morning. This hook
// owns all RNG-driven and structural lifecycle transitions:
//   · cold-bootstrap   — offer an opening keyed off identity with zero
//                        ventures (the entry path);
//   · commit detection — a venture now exists for the opening's blueprint
//                        (spawned by the "pursue" response through the
//                        applier) → the opening is committed and retired;
//   · parking          — an ignored opening past its active window is
//                        parked with a meter snapshot;
//   · return/death     — a parked opening's snapshot is compared against
//                        current meters; a qualifying delta re-offers it
//                        (causally mutated), otherwise it dies after N days.
//
// The opening seed itself is emitted by a separate pure generator
// (`openingIssueSeedGenerator`) that only reads this store — no RNG there,
// matching the "generators are pure readers of state" contract.

// Probability that a parked opening with a qualifying delta returns on a
// given day. Causality decides *whether* a return is possible (a delta must
// exist) and its *valence*; this roll only spreads the return across the
// window so it does not always fire on the first qualifying day.
const OPENING_RETURN_CHANCE = 0.45

// The segment RNG set is reseeded from the base seed each day (the segment
// seed excludes the day number), so a single-consumer `getRngStream('opening')
// .chance()` would return the same value every day. Key a dynamic 'opening'
// stream by day + record id so the return roll varies day-to-day while
// staying replay-deterministic (same seed + day + opening → same roll).
function returnRoll(ctx: SimContext, recordId: string, day: number): boolean {
  return ctx
    .getRngStreamByName(`opening:${day}:${recordId}`)
    .chance(OPENING_RETURN_CHANCE)
}

function getSlice(ctx: SimContext): OpeningsModuleState {
  return (
    (ctx.state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState | undefined) ??
    createInitialOpeningsModuleState()
  )
}

function writeSlice(
  ctx: SimContext,
  patch: (current: OpeningsModuleState) => OpeningsModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<OpeningsModuleState>(
    OPENINGS_MODULE_ID,
    (current) => patch(current ?? createInitialOpeningsModuleState()),
    { source: OPENINGS_MODULE_ID, reason },
  )
}

function openingCause(ctx: SimContext, record: OpeningRecord, readable: string, extraTags: string[]): void {
  ctx.addCause({
    source: 'openings',
    sourceType: 'system',
    target: `opening:${record.id}`,
    targetType: 'global',
    amount: 0,
    direction: 'neutral',
    weight: 1,
    readable,
    tags: ['teleology', 'opening', record.id, record.blueprintId, ...extraTags],
  })
}

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  if (!teleologyUnlocked(ctx.state)) return

  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getSlice(ctx)
  // Work against a mutable copy of the records, then write once.
  const records: Record<string, OpeningRecord> = { ...slice.openings }
  let nextSuffix = slice.nextSuffix
  let changed = false

  // 1) Process existing openings.
  for (const record of Object.values(slice.openings)) {
    const ventureExists = Boolean(ctx.state.ventures[record.blueprintId])

    // Commit: a venture now exists for this opening's blueprint (the
    // "pursue" response spawned it through the applier). Retire the
    // opening so it stops being offered, and record why.
    if (ventureExists && (record.status === 'active' || record.status === 'parked')) {
      delete records[record.id]
      changed = true
      openingCause(ctx, record, `Committed to the ${record.blueprintId} opening — the venture is underway.`, ['commit'])
      continue
    }

    if (record.status === 'active') {
      if (today > record.expiresAtDay) {
        // Park with a snapshot of the keying meters.
        records[record.id] = {
          ...record,
          status: 'parked',
          parkedAtDay: today,
          meterSnapshot: readOpeningMeters(ctx.state),
          returnByDay: today + OPENING_RETURN_WINDOW_DAYS,
        }
        changed = true
        openingCause(ctx, record, `The ${record.blueprintId} opening lapsed and was set aside.`, ['park'])
      }
      continue
    }

    if (record.status === 'parked') {
      const delta = classifyReturnDelta(record.meterSnapshot ?? {}, readOpeningMeters(ctx.state))
      if (delta.qualifies && returnRoll(ctx, record.id, today)) {
        // Causal return: re-offer the opening, mutated by the delta's sign.
        const revived: OpeningRecord = {
          ...record,
          status: 'active',
          origin: 'return',
          valence: delta.valence,
          createdAtDay: today,
          expiresAtDay: today + OPENING_ACTIVE_WINDOW_DAYS,
        }
        delete revived.meterSnapshot
        delete revived.parkedAtDay
        delete revived.returnByDay
        records[record.id] = revived
        changed = true
        openingCause(
          ctx,
          revived,
          `The ${record.blueprintId} opening returned (${delta.valence}): ${describeReturnDelta(delta)}.`,
          ['return', `valence:${delta.valence}`],
        )
      } else if (record.returnByDay !== undefined && today >= record.returnByDay) {
        // No qualifying movement within the window: the opening dies.
        records[record.id] = { ...record, status: 'dead' }
        changed = true
        openingCause(ctx, record, `The ${record.blueprintId} opening died — no movement brought it back.`, ['death'])
      }
      continue
    }
  }

  // 2) Cold-bootstrap: offer an opening for any blueprint whose keying
  //    condition is met, with no venture and no existing record (active,
  //    parked, committed, or dead). Dead/committed records persist precisely
  //    to keep this from re-offering a resolved opening.
  for (const blueprint of allVentureBlueprints()) {
    if (ctx.state.ventures[blueprint.id]) continue
    if (Object.values(records).some((r) => r.blueprintId === blueprint.id)) continue
    if (!blueprint.openingApplies(ctx.state)) continue
    const id = `opening_${blueprint.id}_${nextSuffix}`
    nextSuffix += 1
    const record: OpeningRecord = {
      id,
      blueprintId: blueprint.id,
      origin: 'bootstrap',
      status: 'active',
      createdAtDay: today,
      expiresAtDay: today + OPENING_ACTIVE_WINDOW_DAYS,
    }
    records[id] = record
    changed = true
    openingCause(ctx, record, `A new opening appeared: ${blueprint.opening.problemNoun}.`, ['bootstrap'])
  }

  if (changed || nextSuffix !== slice.nextSuffix || slice.lastProcessedDay !== today) {
    writeSlice(
      ctx,
      (current) => ({ ...current, openings: records, nextSuffix, lastProcessedDay: today }),
      'openings_lifecycle',
    )
  }
}

const OpeningsModuleStateSchema = z.object({
  openings: z.record(z.string(), z.unknown()),
  nextSuffix: z.number().int().min(0),
  lastProcessedDay: z.number().int(),
})

export const openingsModule: SimulationModule = {
  id: OPENINGS_MODULE_ID,
  version: '0.1.0',
  // Reads ventures (commit detection), reputation/world/customers (meter
  // snapshots), and must run before issue-seed generation. The pipeline
  // registers it after `ventureModule` and before `issueSeedsModule`.
  dependsOn: ['kernel', 'ventures'],
  hooks: { startDay: [startDayHook] },
  stateSchema: OpeningsModuleStateSchema,
}
