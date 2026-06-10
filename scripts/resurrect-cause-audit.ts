// Resurrected cause-coverage audit.
//
// Finding 6 (engine-core audit, 2026-06-09): `buildCauseReport` reads
// `ctx.getDiffs()` during the `generateReports` phase, but the engine only
// finalizes the 'day' diff after the phase loop — so the in-report
// "Unexplained significant changes" check has never seen a diff and has
// reported "(none)" on every day ever simulated.
//
// This script runs the same check the way it was meant to run: against the
// post-finalize full-day diff from `SimResult.diffs`, using the report's own
// `findUnexplainedSignificantChanges`, over multi-week runs on several seeds.

import { simulateDay } from '../src/sim/core/engine'
import { FULL_PIPELINE } from '../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../src/sim/state/defaults'
import { findUnexplainedSignificantChanges } from '../src/sim/modules/causes/causeReport'
import type { TavernState } from '../src/sim/state/TavernState'
import type { StateChange } from '../src/sim/core/diff'

const SEEDS = ['audit-alpha', 'audit-beta', 'audit-gamma']
const DAYS = 56 // two in-game months: covers daily, weekly, and monthly rollups

type Tally = {
  count: number
  examples: string[]
  days: Set<number>
  seeds: Set<string>
}

// Normalize entity ids out of paths so per-entity noise groups into one row:
//   areas.taproom.cleanliness   -> areas.*.cleanliness
//   modules.issueSeeds.seedsToday -> modules.issueSeeds.seedsToday (module slices keep their key)
function normalizePath(path: string): string {
  const parts = path.split('.')
  if (parts.length >= 3 && parts[0] !== 'modules') {
    return `${parts[0]}.*.${parts.slice(2).join('.')}`
  }
  return path
}

const tallies = new Map<string, Tally>()
let totalDays = 0
let daysWithUnexplained = 0
let totalSignificant = 0
let totalUnexplained = 0

for (const seed of SEEDS) {
  let state: TavernState = createInitialTavernState()
  for (let day = 0; day < DAYS; day++) {
    const result = simulateDay(state, { seed: `${seed}-${day}` }, FULL_PIPELINE)
    const preDayAbsolute = state.calendar.totalDaysElapsed
    state = result.state
    totalDays++

    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    if (!dayDiff) continue
    totalSignificant += dayDiff.significantChanges.length

    // Mirror the report's `getRecentCauses(1)` window relative to report
    // time (pre-advanceCalendar): causes stamped today or yesterday.
    const recentCauses = result.state.causes.filter(
      (c) => c.timestamp.absoluteDay >= preDayAbsolute - 1,
    )

    const unexplained: StateChange[] = findUnexplainedSignificantChanges(
      dayDiff,
      recentCauses,
    )
    if (unexplained.length > 0) daysWithUnexplained++
    totalUnexplained += unexplained.length

    for (const change of unexplained) {
      const key = normalizePath(change.path)
      const t = tallies.get(key) ?? {
        count: 0,
        examples: [],
        days: new Set<number>(),
        seeds: new Set<string>(),
      }
      t.count++
      t.days.add(day)
      t.seeds.add(seed)
      if (t.examples.length < 2) t.examples.push(change.readable.slice(0, 110))
      tallies.set(key, t)
    }
  }
}

console.log('=== RESURRECTED CAUSE-COVERAGE AUDIT ===')
console.log(`Runs: ${SEEDS.length} seeds x ${DAYS} days = ${totalDays} simulated days`)
console.log(`Significant changes (total): ${totalSignificant}`)
console.log(`Unexplained significant changes: ${totalUnexplained} (${((totalUnexplained / Math.max(1, totalSignificant)) * 100).toFixed(1)}%)`)
console.log(`Days with at least one unexplained change: ${daysWithUnexplained}/${totalDays}`)
console.log('')
console.log('=== UNEXPLAINED PATHS, BY FREQUENCY ===')
const sorted = [...tallies.entries()].sort((a, b) => b[1].count - a[1].count)
for (const [path, t] of sorted) {
  console.log(`\n${path}  —  ${t.count} occurrences, ${t.seeds.size}/${SEEDS.length} seeds, days ${[...t.days].slice(0, 6).join(',')}${t.days.size > 6 ? ',…' : ''}`)
  for (const ex of t.examples) console.log(`    e.g. ${ex}`)
}
if (sorted.length === 0) {
  console.log('(none — every significant change had a matching cause; the dead check was masking nothing)')
}

// --- Pass 2: player-facing state only (exclude modules.* bookkeeping) ---
console.log('\n\n=== PLAYER-FACING UNEXPLAINED CHANGES (modules.* excluded) ===')
const playerFacing = sorted.filter(([p]) => !p.startsWith('modules.'))
let pfTotal = 0
for (const [, t] of playerFacing) pfTotal += t.count
console.log(`Total: ${pfTotal} across ${playerFacing.length} distinct paths\n`)
for (const [path, t] of playerFacing) {
  console.log(`${path}  —  ${t.count}x, ${t.seeds.size}/${SEEDS.length} seeds, days ${[...t.days].slice(0, 8).join(',')}${t.days.size > 8 ? ',…' : ''}`)
  for (const ex of t.examples) console.log(`    e.g. ${ex}`)
}
