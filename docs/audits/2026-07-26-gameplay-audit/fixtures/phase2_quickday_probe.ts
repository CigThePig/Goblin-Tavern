import { FULL_PIPELINE } from '../../../../src/sim/canonicalPipeline.ts'
import { advanceDaySegment } from '../../../../src/sim/core/engine.ts'
import { getIssueSeeds } from '../../../../src/sim/modules/issues/index.ts'
import { createInitialTavernState } from '../../../../src/sim/state/defaults.ts'
import { DIFFICULTY_PRESETS } from '../../../../src/sim/state/difficulty.ts'

const freshSeedsScanned = 100
let freshEligible:
  | { root: string; visibleSeedCount: number }
  | undefined
let freshMinimum = Number.POSITIVE_INFINITY

for (let index = 0; index < freshSeedsScanned; index += 1) {
  const root = `phase2-quick-fresh-${index}`
  const base = createInitialTavernState(undefined, DIFFICULTY_PRESETS.standard)
  const a = advanceDaySegment(base, { seed: `${root}-d0` }, FULL_PIPELINE, 'A')
  const count = getIssueSeeds(a.state).length
  freshMinimum = Math.min(freshMinimum, count)
  if (count === 0) {
    freshEligible = { root, visibleSeedCount: count }
    break
  }
}

const rootsScanned = 10
const maxDaysPerRoot = 20
let sequentialEligible:
  | {
      root: string
      dayIndex: number
      emergentAfterService: number
    }
  | undefined
let sequentialDaysScanned = 0
let sequentialFailures = 0
let sequentialMinimum = Number.POSITIVE_INFINITY

outer: for (let rootIndex = 0; rootIndex < rootsScanned; rootIndex += 1) {
  const root = `phase2-quick-sequential-${rootIndex}`
  let state = createInitialTavernState(undefined, DIFFICULTY_PRESETS.standard)
  for (let dayIndex = 0; dayIndex < maxDaysPerRoot; dayIndex += 1) {
    const input = {
      seed: `${root}-d${state.calendar.totalDaysElapsed}`,
      ownerActions: [],
      staffPriorities: {},
    }
    try {
      const baseline = state
      const a = advanceDaySegment(baseline, input, FULL_PIPELINE, 'A')
      sequentialDaysScanned += 1
      const morningCount = getIssueSeeds(a.state).length
      sequentialMinimum = Math.min(sequentialMinimum, morningCount)
      const b = advanceDaySegment(a.state, input, FULL_PIPELINE, 'B', {
        dayBaseline: baseline,
      })
      if (morningCount === 0) {
        const emergentAfterService = getIssueSeeds(b.state).filter(
          (candidate) =>
            candidate.timing === 'during_service' || candidate.timing === 'closing',
        ).length
        sequentialEligible = { root, dayIndex, emergentAfterService }
        break outer
      }
      state = advanceDaySegment(b.state, input, FULL_PIPELINE, 'C', {
        dayBaseline: baseline,
      }).state
    } catch {
      sequentialFailures += 1
      break
    }
  }
}

console.log(
  JSON.stringify(
    {
      fresh: {
        rootsRequested: freshSeedsScanned,
        rootsActuallyScanned: freshEligible
          ? Number(freshEligible.root.split('-').at(-1)) + 1
          : freshSeedsScanned,
        minimumVisibleSeedCount: freshMinimum,
        eligible: freshEligible ?? null,
      },
      sequential: {
        rootsRequested: rootsScanned,
        maxDaysPerRoot,
        daysActuallyScanned: sequentialDaysScanned,
        rootsStoppedBySimulationFailure: sequentialFailures,
        minimumVisibleSeedCount: sequentialMinimum,
        eligible: sequentialEligible ?? null,
      },
    },
    null,
    2,
  ),
)
