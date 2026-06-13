import { describe, expect, it } from 'vitest'

import { buildRows } from '../../../../scripts/audit-card-choices'

const PHASE_9_AND_10_SLOTS = new Set([
  'hire_security',
  'ban_group',
  'embrace_rowdy',
  'repair_damage',
  'appease_faction',
  'negotiate_terms',
  'refuse_faction',
  'host_faction_night',
  'call_watch',
  'play_rival_faction',
  'pay',
  'borrow',
  'delay',
  'raise_prices',
  'pay_landlord_on_time',
  'invest_in_cellar',
  'hold_reserves',
  'settle_with_rival',
])

const PHASE_9_AND_10_FAMILIES = new Set([
  'violence',
  'faction_request',
  'debt_rent',
  'monthly_review',
])

describe('Phase 11 — card choice audit regressions', () => {
  it('keeps the Phase 9/10 repaired conflict and economy rows warning-free', () => {
    const rows = buildRows()
    const scopedRows = rows.filter(
      (row) =>
        PHASE_9_AND_10_FAMILIES.has(row.cardFamily) &&
        PHASE_9_AND_10_SLOTS.has(row.responseSlotId),
    )
    const warningRows = scopedRows.filter((row) => row.warningFlags.length > 0)

    expect(
      scopedRows.length,
      'phase 9/10 audit rows should be represented',
    ).toBeGreaterThanOrEqual(18)
    expect(
      warningRows.map((row) => ({
        family: row.cardFamily,
        seed: row.seedId,
        slot: row.responseSlotId,
        warnings: row.warningFlags,
      })),
    ).toEqual([])
  })
})
