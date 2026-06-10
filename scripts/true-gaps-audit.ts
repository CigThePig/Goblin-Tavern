import { simulateDay } from '../src/sim/core/engine'
import { FULL_PIPELINE } from '../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../src/sim/state/defaults'
import { canonicalCauseTarget } from '../src/sim/modules/causes/causeTargets'
import type { TavernState } from '../src/sim/state/TavernState'
import type { CauseEntry } from '../src/sim/state/TavernState'
import type { StateChange } from '../src/sim/core/diff'

// Convention-fixed matcher: a change is explained if ANY recent cause
// matches by colon convention (the audit's) OR by exact dot path (the
// engine's legacy auto-emission convention, kept as transitional tolerance).
// Phase 197 / ISSUE-164 — the colon mapping is the shared canonicalizer the
// engine emitters and both report consumers now use; import it rather than
// re-encoding the map here.
function explained(change: StateChange, causes: ReadonlyArray<CauseEntry>): boolean {
  const colon = canonicalCauseTarget(change.path)
  for (const c of causes) {
    if (c.target === change.path) return true // legacy engine dot convention
    if (colon && (c.target === colon || c.target.startsWith(colon + '.'))) return true
  }
  return false
}

const SEEDS = ['audit-alpha', 'audit-beta', 'audit-gamma']
const DAYS = 56
const tallies = new Map<string, { count: number; examples: string[]; days: Set<number> }>()
let totalPF = 0, unexplainedPF = 0

for (const seed of SEEDS) {
  let state: TavernState = createInitialTavernState()
  for (let day = 0; day < DAYS; day++) {
    const result = simulateDay(state, { seed: `${seed}-${day}` }, FULL_PIPELINE)
    const preDay = state.calendar.totalDaysElapsed
    state = result.state
    const dayDiff = result.diffs.find((d) => d.boundary === 'day')
    if (!dayDiff) continue
    const recent = result.state.causes.filter((c) => c.timestamp.absoluteDay >= preDay - 1)
    for (const change of dayDiff.significantChanges) {
      if (change.path.startsWith('modules.') || change.path === 'memories.count') continue // by-design unmapped
      totalPF++
      if (explained(change, recent)) continue
      unexplainedPF++
      const key = change.path.split('.').length >= 3
        ? `${change.path.split('.')[0]}.*.${change.path.split('.').slice(2).join('.')}`
        : change.path
      const t = tallies.get(key) ?? { count: 0, examples: [], days: new Set<number>() }
      t.count++; t.days.add(day)
      if (t.examples.length < 3) t.examples.push(change.readable.slice(0, 110))
      tallies.set(key, t)
    }
  }
}

console.log('=== TRUE ATTRIBUTION GAPS (convention-fixed matcher) ===')
console.log(`Player-facing significant changes: ${totalPF}`)
console.log(`True unexplained (no cause of either convention): ${unexplainedPF} (${((unexplainedPF / Math.max(1, totalPF)) * 100).toFixed(1)}%)`)
for (const [path, t] of [...tallies.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`\n${path}  —  ${t.count}x, days ${[...t.days].slice(0, 10).join(',')}${t.days.size > 10 ? ',…' : ''}`)
  for (const ex of t.examples) console.log(`    ${ex}`)
}
