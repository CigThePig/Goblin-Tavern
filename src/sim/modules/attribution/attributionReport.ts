import type { ReportSection } from '../../core/reports'
import type { TavernState } from '../../state/TavernState'

import { ATTRIBUTION_MODULE_ID, getAttributionModuleState } from './attributionQueries'
import type { AttributionState } from './attributionTypes'

// Phase 37 §37.8 — Attribution report.
//
// Surface only the most relevant beliefs. Each line names *who* believes
// *what about whom* and (when relevant) flags accuracy when the belief
// is partial, false, or unknown. Detailed numeric fields stay in the
// `data` payload for tests / debug consumers.

const ATTRIBUTION_REPORT_ID = 'attribution'
const ATTRIBUTION_REPORT_SOURCE = ATTRIBUTION_MODULE_ID

const REPORT_LIMIT = 8
const STRONG_THRESHOLD = 50

function describeRef(ref: AttributionState['perceivedBy']): string {
  return `${ref.kind}:${ref.id}`
}

function accuracyTag(attribution: AttributionState): string {
  switch (attribution.accuracy) {
    case 'true':
      return ''
    case 'partial':
      return ' (partial truth)'
    case 'false':
      return ' (false)'
    case 'unknown':
      return ' (unverified)'
  }
}

function describeAttribution(attribution: AttributionState): string {
  const verb = attribution.attributionType
  const perceiver = describeRef(attribution.perceivedBy)
  const target = describeRef(attribution.target)
  const acc = accuracyTag(attribution)
  return `${perceiver} → ${verb} → ${target}${acc}: ${attribution.readable} [strength ${Math.round(
    attribution.strength,
  )}, public ${Math.round(attribution.publicness)}]`
}

function sortBySalience(a: AttributionState, b: AttributionState): number {
  return b.publicness * b.strength - a.publicness * a.strength
}

export function buildAttributionReport(state: TavernState): ReportSection {
  const slice = getAttributionModuleState(state)
  const attributions = slice?.attributions ?? []

  const lines: string[] = []
  lines.push(`Active attributions: ${attributions.length}`)
  lines.push('')

  const generated = slice?.generatedToday ?? []
  lines.push(`New / refreshed today: ${generated.length}`)
  lines.push('')

  const strongest = [...attributions]
    .filter((a) => a.strength >= STRONG_THRESHOLD)
    .sort(sortBySalience)
    .slice(0, REPORT_LIMIT)

  lines.push('Strongest beliefs:')
  if (strongest.length === 0) {
    lines.push('  (no strong beliefs)')
  } else {
    for (const attribution of strongest) {
      lines.push(`  - ${describeAttribution(attribution)}`)
    }
  }
  lines.push('')

  const falseBeliefs = attributions.filter(
    (a) => a.accuracy === 'false' || a.accuracy === 'partial',
  )
  if (falseBeliefs.length > 0) {
    lines.push('Distorted beliefs:')
    for (const attribution of falseBeliefs.slice(0, REPORT_LIMIT)) {
      lines.push(`  - ${describeAttribution(attribution)}`)
    }
    lines.push('')
  }

  return {
    id: ATTRIBUTION_REPORT_ID,
    source: ATTRIBUTION_REPORT_SOURCE,
    title: 'ATTRIBUTION REPORT',
    lines,
    data: {
      activeCount: attributions.length,
      generatedToday: generated.length,
      strongestIds: strongest.map((a) => a.id),
      falseCount: falseBeliefs.length,
      byType: countByType(attributions),
    },
  }
}

function countByType(
  attributions: ReadonlyArray<AttributionState>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const attribution of attributions) {
    out[attribution.attributionType] =
      (out[attribution.attributionType] ?? 0) + 1
  }
  return out
}

export { ATTRIBUTION_REPORT_ID, ATTRIBUTION_REPORT_SOURCE }
