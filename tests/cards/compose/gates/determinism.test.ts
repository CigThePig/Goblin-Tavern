// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Determinism gate (framework §6 #5): same `(seed, state)` ⇒ same
// `CardView` even after `structuredClone(state)`, and no state mutation.
// The assembler is structurally deterministic (data conditions, FNV
// tie-break, no Math.random); this gate guards against regression.
//
// No "bad fixture" — making the assembler non-deterministic requires
// breaking architectural rules (closures, Math.random) that the
// codebase already forbids. The gate exists to lock the property.

import { describe, expect, it } from 'vitest'

import { checkDeterminism } from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import {
  buildDeterminismSamples,
  buildStaffDeterminismSamples,
} from './samplers'

describe('determinism gate', () => {
  it('the real drinkOrder template is deterministic across the full sample matrix', () => {
    const samples = buildDeterminismSamples()
    // Sanity: the sample matrix covers neutral + every single-axis +
    // every two-axis + every verbal tic, so the assembler is exercised
    // against the full snippet rung structure.
    expect(samples.length).toBeGreaterThanOrEqual(15)

    const report = checkDeterminism(drinkOrderTemplate, samples)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  // Phase 126 / ISSUE-095 — Phase F's staff template is structurally
  // deterministic under the same sample matrix shape (mirrored against a
  // staff actor instead of a regular).
  it('the real staffAside template is deterministic across the full staff sample matrix', () => {
    const samples = buildStaffDeterminismSamples()
    expect(samples.length).toBeGreaterThanOrEqual(15)
    const report = checkDeterminism(staffAsideTemplate, samples)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('reports state_mutated_during_render if a template ever mutates state', () => {
    // Construct an artificial template whose `toCardView` does mutate
    // its inputs — proves the gate detects this failure mode. The
    // assembler itself never mutates, but a misbehaving template could.
    const samples = buildDeterminismSamples().slice(0, 1)
    const report = checkDeterminism(
      {
        ...drinkOrderTemplate,
        id: 'mutating_template',
        toCardView: (_filled, _seed, state) => {
          ;(state as { __bad?: number }).__bad = 1
          return drinkOrderTemplate.toCardView(_filled, _seed, state)
        },
      },
      samples,
    )
    expect(report.pass).toBe(false)
    expect(report.violations[0]!.reason).toBe('state_mutated_during_render')
  })
})
