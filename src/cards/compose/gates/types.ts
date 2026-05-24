// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Shared shapes for the six structural gates the framework names in
// `card-composition-framework.md §6`. Each gate returns a `GateReport`
// whose `violations` array names the specific snippets / slots that
// failed and why. Phase E's generation pipeline reads the same shape —
// `pass: false` blocks a generation cycle and the violations feed back
// into the retry prompt.

export type GateViolation = {
  /** The slot whose pool produced the violation. Required because all
   *  six gates operate slot-by-slot. */
  slotId: string
  /** The offending snippet id, when the violation is attributable to a
   *  single snippet. Omitted for pool-level failures (e.g. "no
   *  unconditional fallback"). */
  snippetId?: string
  /** Stable kebab-or-snake string naming the failure class. Phase E
   *  matches on this; tests assert exact equality. */
  reason: string
  /** Free-form supplementary text — observed word count, the offending
   *  substring, etc. Not parsed by Phase E, only surfaced to authors. */
  detail?: string
}

export type GateReport = {
  pass: boolean
  violations: GateViolation[]
  /** Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. Soft
   *  signals that do NOT fail the gate. The invariant
   *  `pass === (violations.length === 0)` is preserved across all nine
   *  gates; warnings never affect `pass`. The eight pre-Phase-148 gates
   *  leave this undefined (existing assertions like `violations.length
   *  === 0` keep meaning exactly what they always have). The new
   *  `checkChoiceDistinctness` gate populates this with
   *  `choice_preview_near_collision` entries — near-identical previews
   *  surfaced for author attention without blocking the gate. */
  warnings?: GateViolation[]
}

/** Build a passing report (no violations). */
export function passReport(): GateReport {
  return { pass: true, violations: [] }
}

/** Build a failing report from a single violation. Convenience for arms
 *  that emit one violation; multi-violation paths build the array
 *  inline. */
export function failReport(violations: GateViolation[]): GateReport {
  return { pass: violations.length === 0, violations }
}
