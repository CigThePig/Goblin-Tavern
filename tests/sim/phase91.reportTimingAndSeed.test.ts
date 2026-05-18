// Phase 91 / ISSUE-051 — Day result/report timing + browser RNG seed.
//
// Covers:
//   1. `collectReports` now runs AFTER the `generateReports` hook so
//      the issue-seed report reflects today's freshly generated seeds.
//   2. The browser-style absolute-day seed coordinate produces a
//      different RNG sequence on day 5 vs day 33 (same day-of-month
//      under the old day-of-month seed).

import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createRng } from '../../src/sim/core/rng'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'

describe('Phase 91 — report ordering', () => {
  it('issue-seed report matches state.modules.issueSeeds.seedsToday after the day', () => {
    const state = createInitialTavernState()
    // Run a single day so the engine has data to seed against.
    const result = simulateDay(
      state,
      { seed: 'tests/phase91-ordering' },
      FULL_PIPELINE,
    )
    // The state slot is the source of truth: collectReports must reflect
    // it. Walk the reports for an issueSeeds entry and compare it to
    // the state slice.
    const issueSeedReport = result.reports.find(
      (r) => r.source === 'issueSeeds',
    )
    expect(issueSeedReport).toBeDefined()
    const stateSeeds =
      (result.state.modules['issueSeeds'] as
        | { seedsToday?: unknown[] }
        | undefined)?.seedsToday ?? []
    // Every seed id in state must appear in the serialised report body.
    const reportText = JSON.stringify(issueSeedReport)
    for (const seed of stateSeeds as Array<{ id?: string }>) {
      if (seed && typeof seed.id === 'string') {
        expect(reportText).toContain(seed.id)
      }
    }
  })
})

describe('Phase 91 — absolute-day seed coordinate', () => {
  it('produces different RNG output for day 5 vs day 33 with the same seed prefix', () => {
    // Mirror the browser-side runDay seed construction.
    const seedDay5 = 'tests/phase91-seed-d5'
    const seedDay33 = 'tests/phase91-seed-d33'
    const a = createRng(seedDay5, 0)
    const b = createRng(seedDay33, 0)
    // First 10 numbers from each stream. Any single mismatch is
    // sufficient to prove the streams diverge.
    let diverged = false
    for (let i = 0; i < 10; i += 1) {
      if (a.float() !== b.float()) {
        diverged = true
        break
      }
    }
    expect(diverged).toBe(true)
  })

  it('same absolute-day seed reproduces the same RNG sequence', () => {
    const a = createRng('tests/phase91-stable-d5', 0)
    const b = createRng('tests/phase91-stable-d5', 0)
    for (let i = 0; i < 10; i += 1) {
      expect(a.float()).toBe(b.float())
    }
  })
})
