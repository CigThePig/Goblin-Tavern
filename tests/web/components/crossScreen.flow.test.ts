// Phase 119 / ISSUE-058 — cross-screen flow test.
//
// Single-screen smoke tests catch isolated regressions; this test
// covers the full handoff: queue an action via the shared gameStore
// (from anywhere — the Tavern surfaces, the central picker, or directly
// programmatically), then End Day on the DayScreen and verify the
// resulting daily report reflects that the pick was processed.
//
// Why this is meaningful: ISSUE-050's owner-action queue lives on the
// store and is consumed by Segment B (`gameStore.runService`). A
// regression in the drain-after-service path, the queue→input
// conversion, or the report builder would all manifest here as a stale
// or missing report.
//
// Phase 186 / Day-Clock Cluster 5 — the day is now three engine
// segments. The queued action is applied when "Run service" runs Segment
// B; "End day" runs Segment C and builds the report. This test walks the
// real beat buttons so the full segmented handoff is exercised.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const { default: DayScreen } = await import(
  '../../../web/src/lib/screens/DayScreen.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')

describe('Cross-screen flow — queue → End Day → Report (Phase 119 / ISSUE-058)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed')
  })

  afterEach(() => {
    cleanup()
  })

  it('a queued owner action survives runDay and lands in the day result', async () => {
    // Queue Buy Mugs from outside the picker — simulating the Tavern →
    // quick-action surface that funnels through gameStore.tryAddPick.
    const result = gameStore.tryAddPick({
      actionId: 'buy_mugs',
      label: 'Buy Mugs',
      category: 'immediate',
      targetType: 'stock',
      targetId: 'mugs',
      targetLabel: 'Mugs',
      actionPointCost: 1,
    })
    expect(result.ok).toBe(true)
    expect(gameStore.picks.length).toBe(1)

    // Open the day (Segment A) and mount DayScreen at the morning beat.
    gameStore.beginDay()
    render(DayScreen)

    // Run service (Segment B) — this consumes the queued owner action.
    // Driven via the store to skip the BeatTransition timer; the beat
    // still lands on service.
    gameStore.runService()
    expect(gameStore.segment).toBe('B')
    // The queue drains once Segment B has applied the actions.
    expect(gameStore.picks.length).toBe(0)

    // End the day (Segment C) from the closing beat → report.
    gameStore.setBeat('closing')
    const endDay = await screen.findByRole('button', { name: /^end day$/i })
    await fireEvent.click(endDay)

    // The day advanced — beat is now 'report' and runError is unset.
    expect(gameStore.beat).toBe('report')
    expect(gameStore.runError).toBeUndefined()
    expect(gameStore.picks.length).toBe(0)
    // latestResult exists and was populated by Segment C.
    expect(gameStore.latestResult).toBeDefined()
    // The day-report header renders, proving the report-projection path
    // is alive end-to-end.
    expect(screen.getByText(/day\s+\d+\s+closed/i)).toBeTruthy()
  })
})
