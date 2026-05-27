// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility).
//
// The tenth structural gate. Sibling to `previewVariety`'s Phase-147
// `requireMagnitude` rule (which reads `EffectPreview.magnitudeBand` for
// choice-effect previews), but adapted to report-section snippet pools
// whose magnitude band lives in the routing TAG rather than in a sim-
// classified `EffectPreview`. The defect this gate catches:
//
//   "Respectable rose +5" reads identically to "Respectable rose +25" —
//   the verb pool routes by direction (`reputation_gain`) but the verb
//   itself ("rose") carries no calibrated weight. A `+5` and a `+25`
//   gain on the same report are visually indistinguishable; the player
//   can read direction but not magnitude.
//
// The structural rule: when a snippet's conditions include a `hasTag`
// gate on a band-bearing tag (`reputation_gain_small`, `trend_large`,
// `service_loss_mid`, …), the snippet's text must contain a token from
// `MAGNITUDE_LEXICON[direction][band]` for the (direction, band) pair
// the tag is mapped to. The mapping is supplied at config time —
// `tagToBand: Record<string, { direction; band }>` — so each section
// declares which of its routing tags carry which magnitude weight.
//
// Snippets without any band-bearing `hasTag` condition (fallbacks,
// direction-only snippets, action-category snippets) are exempt — the
// gate is OPT-IN per (tag) cell, and unbanded snippets keep working as
// they did pre-Phase-160.
//
// Pure: no I/O, no Math.random. Same template + same config ⇒ same
// report. Same structural shape as the seven framework gates and the
// two Phase-V sibling gates: a `GateReport` with `pass` and
// `violations[]`, no warnings (every catch is a fail).

import type { CompositionalCardTemplate } from '../types'
import type {
  EffectDirection,
  EffectMagnitudeBand,
} from '../../../sim/core/effect'
import { MAGNITUDE_LEXICON, lineCarriesMagnitude } from '../magnitudeLexicon'
import { failReport, type GateReport, type GateViolation } from './types'

export type ReportTagBand = {
  direction: EffectDirection
  band: EffectMagnitudeBand
}

export type ReportLegibilityConfig = {
  /** Per-tag mapping from a routing tag (the string that lands in
   *  `seed.domain` and that snippets gate on via `hasTag`) to the
   *  (direction, band) pair the lexicon should be checked against.
   *  Tags absent from this map are ignored — the gate is opt-in cell-
   *  by-cell so a partially-authored section keeps passing while the
   *  matrix fills. */
  tagToBand: Readonly<Record<string, ReportTagBand>>
  /** Override the magnitude lexicon. Defaults to `MAGNITUDE_LEXICON`. */
  magnitudeLexicon?: Record<
    EffectDirection,
    Record<EffectMagnitudeBand, readonly string[]>
  >
}

export const REPORT_LEGIBILITY_REASONS = Object.freeze([
  'report_magnitude_missing',
] as const)

export type ReportLegibilityReason = (typeof REPORT_LEGIBILITY_REASONS)[number]

export type ReportLegibilityObservation = {
  /** Total snippets across the template whose conditions named a tag
   *  in `tagToBand`. */
  bandedSnippets: number
  /** Of those, how many rendered text containing the expected
   *  lexicon token. `bandedSnippets - magnitudeOkSnippets` is the
   *  violation count. */
  magnitudeOkSnippets: number
}

export function checkReportLegibility(
  template: CompositionalCardTemplate,
  config: ReportLegibilityConfig,
): GateReport & { observed: ReportLegibilityObservation } {
  const lexicon = config.magnitudeLexicon ?? MAGNITUDE_LEXICON
  const violations: GateViolation[] = []
  let bandedSnippets = 0
  let magnitudeOkSnippets = 0
  for (const slot of template.slots) {
    for (const snippet of slot.pool.snippets) {
      // Find the first hasTag condition whose tag is band-mapped. If
      // a snippet gates on multiple banded tags (rare; would mean the
      // tag emitter pushes a banded tag AND a banded fallback), the
      // first match in the conditions array drives the check —
      // deterministic by snippet authoring order.
      let band: ReportTagBand | undefined
      let matchedTag: string | undefined
      for (const cond of snippet.conditions) {
        if (cond.kind !== 'hasTag') continue
        const mapping = config.tagToBand[cond.tag]
        if (mapping) {
          band = mapping
          matchedTag = cond.tag
          break
        }
      }
      if (!band) continue
      bandedSnippets += 1
      if (lineCarriesMagnitude(snippet.text, band.direction, band.band, lexicon)) {
        magnitudeOkSnippets += 1
        continue
      }
      const expected = lexicon[band.direction]?.[band.band] ?? []
      violations.push({
        slotId: slot.id,
        snippetId: snippet.id,
        reason: 'report_magnitude_missing',
        detail:
          `snippet text "${snippet.text}" gated on tag "${matchedTag}" ` +
          `(${band.direction}/${band.band}) carries no magnitude-lexicon token ` +
          `from [${expected.join(', ')}]`,
      })
    }
  }
  const report = failReport(violations) as GateReport & {
    observed: ReportLegibilityObservation
  }
  report.observed = { bandedSnippets, magnitudeOkSnippets }
  return report
}
