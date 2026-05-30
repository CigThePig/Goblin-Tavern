// Phase 172 / ISSUE-140 — Complete Surface arc, Phase 5
// (Staff & Personnel matrix fill).
//
// Second application of the Phase-3 cell-coverage read
// (`enumerateMatrixCells`, ISSUE-138) to content, after Phase 4's
// suppliers. Where `phase150.exhaustiveMatrix.test.ts` proved the four
// hand-picked stress × fatigue corners render, this file *derives* the
// 9-cell matrix from each staff family's salience table and asserts EVERY
// cell resolves to a covering snippet (or the documented all-mid centre
// fallback, or an `unreachableCells` allowlist entry). It turns "is this
// matrix complete?" from an author's-eye judgement into a machine
// question — the per-cluster proof the Phase-12 coverage gate will later
// generalise.
//
// Coverage definition (mirrors the Phase-161 legibility gate's "meaningful
// read" filter, identical to phase171): a cell with >=1 low/high
// (extremity-2) banded signal read demands an establishing snippet whose
// `scoreCandidateSalience` index is finite; a cell whose meters are all
// mid (extremity 1, the intentional default) is covered by the
// unconditional fallback.
//
// The hole this phase closed: neither staff establishing pool authored an
// `est_low_fatigue` single rung, so the (stress=mid, fatigue=low) cell had
// no covering snippet and fell to the bare fallback — the band corners
// need stress low/high, and est_low_stress needs stress=low.

import { describe, expect, it } from 'vitest'

import { staffAsideCard } from '../../../src/cards/templates/staffAside'
import { staffBurnoutCard } from '../../../src/cards/templates/staffBurnout'
import { staffAsideTemplate } from '../../../src/cards/templates/staffAside'
import { staffBurnoutTemplate } from '../../../src/cards/templates/staffBurnout'
import {
  enumerateMatrixCells,
  matrixMetersForFamily,
  resolveSalientReads,
  scoreCandidateSalience,
  UNREACHABLE_CELLS,
  isCellAllowlisted,
  validateUnreachableCells,
} from '../../../src/cards/compose'
import { pickSnippetTrace } from '../../../src/cards/compose/assemble'
import type { TavernState } from '../../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../../src/sim/state/defaults'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import type { BandId } from '../../../src/sim/signals'
import type { CompositionalCardTemplate } from '../../../src/cards/compose/types'
import type { CardDefinition } from '../../../src/cards/types'
import { makeSeed } from '../cardFactories'

// ─── helpers ────────────────────────────────────────────────────────

function firstStaffId(state: TavernState): string {
  const id = Object.keys(state.staff)[0]
  if (!id) throw new Error('test setup expects at least one starter staff')
  return id
}

function withStaff(
  state: TavernState,
  staffId: string,
  partial: { stress?: number; fatigue?: number },
): TavernState {
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...state.staff[staffId]!,
        ...(partial.stress !== undefined ? { stress: partial.stress } : {}),
        ...(partial.fatigue !== undefined ? { fatigue: partial.fatigue } : {}),
      },
    },
  }
}

function staffSeed(
  family: 'staff_identity' | 'staff_burnout',
  staffId: string,
  id: string,
): IssueSeed {
  return makeSeed({
    id,
    family,
    type: family === 'staff_identity' ? 'relationship_test' : 'staff_request',
    timing: 'morning_prep',
    severity: 45,
    domain: ['staff'],
    primaryActor: { kind: 'staff', id: staffId },
  })
}

// Band-representative scalar. Thresholds are [40, 70] for both staff
// signals, so 20 lands `low`, 55 `mid`, 85 `high`.
function bandValue(band: BandId): number {
  return band === 'low' ? 20 : band === 'high' ? 85 : 55
}

const STAFF_ASIDE_FALLBACK = 'A staff member surfaces before the day fully opens.'
const STAFF_BURNOUT_FALLBACK = 'A staff member stands at the rota, hands quiet.'

type ClusterCase = {
  label: string
  family: 'staff_identity' | 'staff_burnout'
  template: CompositionalCardTemplate
  card: CardDefinition
  fallback: string
}

const CLUSTER: ClusterCase[] = [
  {
    label: 'staffAside (staff_identity)',
    family: 'staff_identity',
    template: staffAsideTemplate,
    card: staffAsideCard,
    fallback: STAFF_ASIDE_FALLBACK,
  },
  {
    label: 'staffBurnout (staff_burnout)',
    family: 'staff_burnout',
    template: staffBurnoutTemplate,
    card: staffBurnoutCard,
    fallback: STAFF_BURNOUT_FALLBACK,
  },
]

// ─── stress × fatigue — every cell of each derived 9-cell matrix ──────

for (const tc of CLUSTER) {
  describe(`Phase 172 — ${tc.label} matrix is covered to the cell`, () => {
    const family = tc.family as IssueSeedFamilyId
    const meters = matrixMetersForFamily(family)
    const cells = enumerateMatrixCells(family)
    const slot = tc.template.slots.find((s) => s.id === 'establishing_line')!

    it('the Phase-3 read enumerates the stress × fatigue 9-cell cube', () => {
      expect(meters.map((m) => m.signal)).toEqual([
        'staff.stress',
        'staff.fatigue',
      ])
      expect(cells).toHaveLength(9)
    })

    for (const cell of cells) {
      it(`cell ${cell.key} resolves to a covering snippet (or the documented centre fallback)`, () => {
        const base = createInitialTavernState()
        const staffId = firstStaffId(base)
        const state = withStaff(base, staffId, {
          stress: bandValue(cell.bands[0]!),
          fatigue: bandValue(cell.bands[1]!),
        })
        const seed = staffSeed(tc.family, staffId, `cov-${tc.family}-${cell.key}`)

        // Allowlisted-unreachable cells are satisfied without a snippet.
        if (isCellAllowlisted(family, cell.key)) return

        const resolved = resolveSalientReads(seed, state)
        // Mirror the legibility gate: a mid-band signal read (extremity 1)
        // is the intentional default, not a "meaningful" fact demanding
        // cover.
        const meaningful = resolved.filter(
          (r) => !(r.read.kind === 'signal' && r.extremity <= 1),
        )
        const trace = pickSnippetTrace(slot, seed, state, {})
        expect(trace).toBeDefined()

        if (meaningful.length === 0) {
          // The all-mid centre cell: the fallback IS the story.
          expect(trace!.text).toBe(tc.fallback)
        } else {
          const score = scoreCandidateSalience(trace!, meaningful)
          expect(score.index).not.toBe(Infinity)
          expect(trace!.text).not.toBe(tc.fallback)
        }
      })
    }

    it('renders the covering line into body[0] for the four corners', () => {
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      const corners: { stress: BandId; fatigue: BandId }[] = [
        { stress: 'low', fatigue: 'low' },
        { stress: 'low', fatigue: 'high' },
        { stress: 'high', fatigue: 'low' },
        { stress: 'high', fatigue: 'high' },
      ]
      for (const { stress, fatigue } of corners) {
        const state = withStaff(base, staffId, {
          stress: bandValue(stress),
          fatigue: bandValue(fatigue),
        })
        const view = tc.card.render(
          staffSeed(tc.family, staffId, `corner-${stress}-${fatigue}`),
          state,
        )
        expect(view.body[0]).not.toBe(tc.fallback)
      }
    })

    it('the mid-stress × low-fatigue edge opens on a covering line, not the fallback', () => {
      // The specific cell this phase closed. Before the est_low_fatigue
      // single rung, this body opened on the bare fallback.
      const base = createInitialTavernState()
      const staffId = firstStaffId(base)
      const state = withStaff(base, staffId, { stress: 55, fatigue: 20 })
      const view = tc.card.render(
        staffSeed(tc.family, staffId, `edge-mid-low`),
        state,
      )
      expect(view.body[0]).not.toBe(tc.fallback)
    })
  })
}

// ─── reachability allowlist — clean, no cluster entries ───────────────

describe('Phase 172 — reachability allowlist', () => {
  it("validates clean (no typo'd or duplicate cells anywhere)", () => {
    expect(validateUnreachableCells()).toEqual([])
  })

  it('records no entries for the staff cluster — every cell is reachable', () => {
    // generateStaffIdentity scores staff by blame + loyalty-deficit +
    // stress + fatigue, so a low-stress/low-fatigue but blamed/disloyal
    // staff member can be the pick — every stress × fatigue cell is
    // reachable. generateStaffBurnout biases toward high stress+fatigue
    // but falls back to the single highest staff when nobody crosses the
    // threshold, so all cells stay reachable too. No allowlist entries.
    expect(
      UNREACHABLE_CELLS['staff_identity' as IssueSeedFamilyId],
    ).toBeUndefined()
    expect(
      UNREACHABLE_CELLS['staff_burnout' as IssueSeedFamilyId],
    ).toBeUndefined()
  })
})
