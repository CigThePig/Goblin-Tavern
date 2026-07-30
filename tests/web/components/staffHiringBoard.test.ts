// Expansion Phase 3 — the Tavern > Staff hiring board.
//
// WHY THIS EXISTS. Phase 3 changed `hire_staff` from "pick a role, pay the
// going rate" to "pick a person off a board that expires", and left the Staff
// panel showing only the roster — with an empty state that pointed at the World
// screen's adventurer list, which has nothing to do with staff. Every part of
// hiring was therefore invisible unless the player already knew the action's
// target list had changed meaning. §5.12 fails a phase whose capability a player
// cannot discover, so the board is on the panel and it queues the real action.
//
// Coverage:
// 1. Each applicant renders with the facts a hiring decision needs.
// 2. The row's Hire button queues `hire_staff` against THAT applicant's id.
// 3. An empty board explains itself instead of rendering nothing.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'

const { default: StaffPanel } = await import(
  '../../../web/src/lib/components/tavern/StaffPanel.svelte'
)
const { gameStore } = await import('../../../web/src/lib/sim/gameStore.svelte')
const { buildTavernOverview } = await import(
  '../../../src/reports/tavernOverviewProjection'
)

describe('StaffPanel — the hiring board (Expansion Phase 3)', () => {
  beforeEach(() => {
    gameStore.reset('test-seed-hiring')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders every applicant with role, skill, ask and how long they will wait', () => {
    // Open the tavern for a day so word gets round and the board fills.
    gameStore.runDay()
    const data = buildTavernOverview(gameStore.state).staff
    expect(data.hiring.applicants.length).toBeGreaterThan(0)

    render(StaffPanel, { props: { data } })
    for (const applicant of data.hiring.applicants) {
      expect(screen.getByText(applicant.name)).toBeTruthy()
    }
    // The decision facts, not just the names.
    const first = data.hiring.applicants[0]!
    expect(
      screen.getAllByText(
        new RegExp(`${first.roleLabel}.*skill ${first.skill}.*${first.wageAsk}c/wk`),
      ).length,
    ).toBeGreaterThan(0)
  })

  it('the Hire button on a row queues hire_staff against that applicant', async () => {
    gameStore.runDay()
    const data = buildTavernOverview(gameStore.state).staff
    const applicant = data.hiring.applicants[0]!
    render(StaffPanel, { props: { data } })

    const hireButtons = screen.getAllByText('Hire Staff')
    expect(hireButtons.length).toBe(data.hiring.applicants.length)
    await fireEvent.click(hireButtons[0]!)

    const queued = gameStore.picks.find((pick) => pick.actionId === 'hire_staff')
    expect(queued).toBeDefined()
    // Against the PERSON, which is what the action now takes.
    expect(queued!.targetId).toBe(applicant.id)
    expect(queued!.targetLabel).toBe(applicant.name)
  })

  it('an empty board says why rather than rendering nothing', () => {
    const data = buildTavernOverview(gameStore.state).staff
    expect(data.hiring.applicants).toEqual([])
    render(StaffPanel, { props: { data } })
    expect(screen.getByText(data.hiring.emptyReason!)).toBeTruthy()
  })
})
