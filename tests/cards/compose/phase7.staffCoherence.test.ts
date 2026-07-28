import { describe, expect, it } from 'vitest'

import { pickCard } from '../../../src/cards/registry'
import { getIssueSeeds } from '../../../src/sim/modules/issues/issueSeedQueries'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import { runOneDay } from '../../../src/sim/testing/simRunner'
import {
  buildStaffBurnoutTriggeringState,
  buildStaffIdentityTriggeringState,
} from '../../sim/triggeringStates'
import type { CardView } from '../../../src/cards/types'
import type { IssueSeedFamilyId } from '../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../src/sim/state/TavernState'

function cardForFamily(
  family: IssueSeedFamilyId,
  buildState: () => TavernState,
): CardView {
  const first = runOneDay(buildState(), { seed: `phase7-${family}-warm` })
  const second = runOneDay(first.state, { seed: `phase7-${family}` })
  const seed = getIssueSeeds(second.state, { family })[0]
  expect(seed).toBeDefined()
  return pickCard(seed!, second.state)
}

function mechanicalFor(card: CardView, slotId: string): string[] {
  const choice = card.choices.find((candidate) => candidate.slotId === slotId)
  expect(choice, `missing choice ${slotId}`).toBeDefined()
  return choice!.mechanicalEffects ?? []
}

describe('Phase 7 — staff card choice coherence', () => {
  it('staff burnout care, push, compensation, and scheduling options show their costs and delayed risks', () => {
    const card = cardForFamily('staff_burnout', buildStaffBurnoutTriggeringState)

    expect(mechanicalFor(card, 'pay_bonus')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Coin -15$/),
        expect.stringMatching(/^later: Debt Pressure \+3$/),
      ]),
    )
    expect(mechanicalFor(card, 'reduce_workload')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Service Capacity -8$/),
        expect.stringMatching(/^later: .* Fatigue \+6$/),
      ]),
    )
    expect(mechanicalFor(card, 'reassign')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^.* Fatigue \+6$/),
        expect.stringMatching(/^later: Staff Burnout Risk \+3$/),
      ]),
    )
    expect(mechanicalFor(card, 'push_through')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Staff Burnout Risk \+8$/),
        expect.stringMatching(/may quit$/),
      ]),
    )
  })

  it('staff identity care, bonus, blame, scheduling, and ignore choices are not free or hidden', () => {
    const card = cardForFamily('staff_identity', buildStaffIdentityTriggeringState)

    // Phase 203 / audit Wave 4 (`P6-COMP-005`) — this claimed `-5` on the
    // retired action-point scale and the applier discarded it entirely. It
    // is now half an hour of the real 6h day, and reads as a duration
    // because that is how the player reads the day clock everywhere else.
    expect(mechanicalFor(card, 'comfort_staff')).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Owner Time -30m$/)]),
    )
    expect(mechanicalFor(card, 'pay_bonus')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Coin -10$/),
        expect.stringMatching(/^later: Debt Pressure \+2$/),
      ]),
    )
    expect(mechanicalFor(card, 'blame_staff')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Rumour Pressure \+6$/),
        expect.stringMatching(/^later: Staff Loyalty Risk \+12$/),
      ]),
    )
    expect(mechanicalFor(card, 'change_priority')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Service Capacity -4$/),
        expect.stringMatching(/^later: Staff Loyalty Risk \+3$/),
      ]),
    )
    expect(mechanicalFor(card, 'ignore_request')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^later: Staff Loyalty Risk \+6$/),
      ]),
    )
  })

  it('a fresh day-one tavern does not surface staff identity loyalty cards without player-created causes', () => {
    const dayOne = runOneDay(createInitialTavernState(), {
      seed: 'phase7-fresh-day-one',
    })
    expect(getIssueSeeds(dayOne.state, { family: 'staff_identity' })).toHaveLength(0)
  })
})
