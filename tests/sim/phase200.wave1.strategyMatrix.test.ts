// Phase 200 / gameplay audit Wave 1 — the eight-strategy half of the gate.
//
// Audit Phase 8 §7 closes Wave 1 on "eight shared-seed 28-day strategies
// validate throughout", with the §8.2 invariants holding every day. The
// audit's own matrix ran green on validation while two of its strategies
// were quietly going bankrupt through the rent response (`P7-EXP-001`),
// so this asserts the invariants per-day rather than trusting the
// end-of-run summary.
//
// Eight 28-day runs, ~13s — fast tier, so the gate re-runs on every change.

import { describe, expect, it } from 'vitest'

import { runStrategy } from '../../src/sim/testing/balanceRuns'
import { PHASE_20_POLICY_BOTS } from '../../src/sim/testing/policyBots'
// Phase 206 / Wave 7 prep — this check moved into `balanceHarness` so the
// Wave 1 gate and every Wave 7 balance cell test ONE contract. Wave 7 must
// not be able to publish a "balanced" run that Wave 1 would have called
// schema-invalid, which is exactly what Phase 7 §5.2's first limitation
// was: two strategies ranked on data taken after they went invalid.
import { coreStateInvariantFailures as invariantFailures } from '../../src/sim/testing/balanceHarness'

const SHARED_SEED = 'phase200-wave1-matrix'
const DAYS = 28

describe('Wave 1 gate — eight shared-seed 28-day strategies', () => {
  const bots = PHASE_20_POLICY_BOTS.filter((bot) => bot.id !== 'manual_debug')

  it('runs eight distinct strategies', () => {
    expect(bots.length).toBe(8)
  })

  for (const bot of bots) {
    it(`${bot.id}: validates and holds every invariant across ${DAYS} days`, () => {
      const { run } = runStrategy({
        botId: bot.id,
        days: DAYS,
        seed: SHARED_SEED,
      })

      const failures: string[] = []
      for (const day of run.days) {
        failures.push(...invariantFailures(day.result.state, `day ${day.index}`))
        const errors = day.result.validation.errors ?? []
        if (errors.length > 0) {
          failures.push(
            `day ${day.index}: ${errors.length} validation error(s) — ${errors[0]?.path} ${errors[0]?.message}`,
          )
        }
      }
      expect(failures.slice(0, 10)).toEqual([])
      expect(run.validatedThroughout).toBe(true)
    })
  }
})
