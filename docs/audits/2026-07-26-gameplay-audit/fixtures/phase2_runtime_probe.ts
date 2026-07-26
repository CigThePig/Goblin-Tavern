import { isDeepStrictEqual } from 'node:util'

import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline.ts'
import {
  advanceDaySegment,
  simulateDay,
} from '../../../../src/sim/core/engine.ts'
import type { SimInput } from '../../../../src/sim/core/context.ts'
import { getIssueSeeds } from '../../../../src/sim/modules/issues/index.ts'
import type {
  IssueSeed,
  ResponseIntent,
} from '../../../../src/sim/modules/issues/issueSeedTypes.ts'
import { createInitialTavernState } from '../../../../src/sim/state/defaults.ts'
import { DIFFICULTY_PRESETS } from '../../../../src/sim/state/difficulty.ts'
import { buildTavernLog } from '../../../../src/reports/tavernLogProjection.ts'

const seed = 'phase2-runtime-fixed-d0'
const base = createInitialTavernState(undefined, DIFFICULTY_PRESETS.standard)

const segmentA = advanceDaySegment(base, { seed }, FULL_PIPELINE, 'A')

function intentFor(
  issueSeed: IssueSeed,
  slotId: string,
  verb: ResponseIntent['verb'],
): ResponseIntent {
  const slot = issueSeed.responseSlots.find((candidate) => candidate.id === slotId)
  if (!slot) throw new Error(`Missing ${issueSeed.id}/${slotId}`)
  const intent: ResponseIntent = {
    id: `phase2-${issueSeed.id}-${slotId}`,
    seedId: issueSeed.id,
    verb,
    shape: slot.shape,
    tags: [],
    intensity: 1,
    metadata: { responseSlotId: slot.id },
  }
  if (slot.targetOptions[0]) intent.target = slot.targetOptions[0]
  return intent
}

const seeds = getIssueSeeds(segmentA.state)
const opening = seeds.find(
  (candidate) => candidate.id === 'opening_opening_venture_liquor_license_0',
)
const staffArc = seeds.find(
  (candidate) => candidate.id === 'staff_arc_arc_staff_mastery_apprentice',
)
if (!opening || !staffArc) throw new Error('Expected fixed-seed opening cards are missing')

const responseIntents = [
  intentFor(opening, 'pursue', 'upgrade'),
  intentFor(staffArc, 'mark_milestone', 'promote'),
]
const input: SimInput = {
  seed,
  ownerActions: [],
  staffPriorities: {},
  responseIntents,
}

const segmentB = advanceDaySegment(
  segmentA.state,
  input,
  FULL_PIPELINE,
  'B',
  { dayBaseline: base },
)
const segmentC = advanceDaySegment(
  segmentB.state,
  input,
  FULL_PIPELINE,
  'C',
  { dayBaseline: base },
)
const fullDay = simulateDay(base, input, FULL_PIPELINE)

const fullDayDiff = fullDay.diffs.find((diff) => diff.boundary === 'day')
const segmentedDayDiff = segmentC.diffs.find((diff) => diff.boundary === 'day')
const service = segmentC.state.modules.service as
  | {
      result?: {
        trafficByGroup?: Record<string, number>
        netCoinEarned?: number
        incidents?: unknown[]
      }
    }
  | undefined
const patrons = Object.values(service?.result?.trafficByGroup ?? {}).reduce(
  (sum, count) => sum + count,
  0,
)

const log = buildTavernLog(segmentC.state, { dayRange: 'all' })

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

const duplicateTagsByRow = log.rows
  .map((row) => ({
    rowId: row.id,
    summary: row.summary,
    tags: row.tags,
    duplicates: duplicates(row.tags),
  }))
  .filter((row) => row.duplicates.length > 0)
const duplicateActorsByRow = log.rows
  .map((row) => ({
    rowId: row.id,
    duplicates: duplicates(row.actorChips.map((chip) => `${chip.kind}:${chip.id}`)),
  }))
  .filter((row) => row.duplicates.length > 0)
const duplicateLocationsByRow = log.rows
  .map((row) => ({
    rowId: row.id,
    duplicates: duplicates(row.locationChips.map((chip) => `${chip.kind}:${chip.id}`)),
  }))
  .filter((row) => row.duplicates.length > 0)

const summary = {
  fixedSeed: seed,
  segmentACards: seeds.map((issueSeed) => ({
    id: issueSeed.id,
    family: issueSeed.family,
    timing: issueSeed.timing,
  })),
  segmentedVsFull: {
    finalStateEqual: isDeepStrictEqual(segmentC.state, fullDay.state),
    dayDiffEqual: isDeepStrictEqual(segmentedDayDiff, fullDayDiff),
    segmentedStateId: segmentC.state.id,
    fullDayStateId: fullDay.state.id,
  },
  finalState: {
    calendar: segmentC.state.calendar,
    coin: segmentC.state.coin,
    stock: Object.fromEntries(
      ['ale', 'stew', 'mushrooms'].map((id) => [
        id,
        segmentC.state.stock[id]?.quantity,
      ]),
    ),
    pressures: Object.fromEntries(
      Object.entries(segmentC.state.pressures).map(([id, pressure]) => [
        id,
        pressure.value,
      ]),
    ),
    mainRoom: segmentC.state.areas.main_room,
    service: {
      patrons,
      netCoin: service?.result?.netCoinEarned,
      incidents: service?.result?.incidents?.length,
      trafficByGroup: service?.result?.trafficByGroup,
    },
  },
  tavernLog: {
    totalEntries: log.totalEntries,
    filteredEntries: log.filteredEntries,
    rowIdsDuplicate: duplicates(log.rows.map((row) => row.id)),
    groupDaysDuplicate: duplicates(log.groups.map((group) => String(group.absoluteDay))),
    duplicateTagsByRow,
    duplicateActorsByRow,
    duplicateLocationsByRow,
  },
}

console.log(JSON.stringify(summary, null, 2))
