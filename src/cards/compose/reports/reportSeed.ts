// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Synthetic IssueSeed adapter for report-section composition. The card
// compose runtime (`pickSnippet`, `evalCondition`, `assembleSlots`) takes
// an `IssueSeed` shaped object as its first non-state argument; report
// sections do not have seeds — they have state — so this builder
// constructs a minimal seed that satisfies the runtime contract.
//
// Field-by-field rationale:
//   - `id`: stable per (sectionId, periodKey) so determinism holds across
//     re-render — same projection inputs → same FNV tie-break result.
//   - `family`: literal `'report'` string. `IssueSeed['family']` accepts
//     `IssueSeedFamilyId | string`; condition primitives that gate on
//     `seedFamily` simply do not match for report seeds, which is the
//     correct behaviour (no card-template-style routing happens at the
//     report layer).
//   - `type`: typed `IssueSeedType` per `IssueSeedType` union; we reuse
//     `'monthly_review'` as the closest pre-existing type for any report
//     section, since no condition primitive in any report pool gates on
//     `seedType`. (If a future report wants type-gated branching, this
//     becomes a per-section choice; for now the type is irrelevant to
//     selection.)
//   - `timing`: per-section. Daily reports use `'closing'`, weekly use
//     `'end_week'`, monthly use `'end_month'`.
//   - `severity`/`urgency`/`novelty`/`cardWorthiness`: zeroed. Numeric
//     conditions in report pools read state via `severityAtLeast` against
//     pressure / signal severity, never against seed severity.
//   - `domain`: caller-supplied tags. The Phase-13 precedent of pushing
//     enum facts onto `seed.domain` for `hasTag` to read carries over —
//     report sections compute and pass relevant tags at projection time
//     (e.g. `'rent_paid'`, `'rent_unpaid'`).
//   - `toneHints`: caller-supplied; same role as `domain`.
//   - `primaryActor`: the actor a row-scoped section centres on (e.g.
//     a staff ref for `StaffRow.notes`). When the actor carries
//     `castAttributes`, `voiceAxis` / `verbalTic` conditions on row
//     snippets resolve through it; absence falls through to narrator
//     voicing, matching the Phase 7 / 8 / 12 graceful-fallback pattern.
//   - All other fields are empty arrays / minimal defaults the runtime
//     and gates accept.

import type { EntityRef } from '../../../sim/state/TavernState'
import type {
  IssueSeed,
  IssueSeedTiming,
} from '../../../sim/modules/issues/issueSeedTypes'

export type ReportSeedTiming = IssueSeedTiming

export type BuildReportSeedOptions = {
  sectionId: string
  periodKey: string
  timing: ReportSeedTiming
  primaryActor?: EntityRef
  domain?: readonly string[]
  toneHints?: readonly string[]
}

export function buildReportSeed(opts: BuildReportSeedOptions): IssueSeed {
  const {
    sectionId,
    periodKey,
    timing,
    primaryActor,
    domain = [],
    toneHints = [],
  } = opts
  const seed: IssueSeed = {
    id: `report.${sectionId}.${periodKey}`,
    family: 'report',
    type: 'monthly_review',
    domain: [...domain],
    timing,
    severity: 0,
    urgency: 0,
    novelty: 0,
    cardWorthiness: 0,
    affectedActors: [],
    causes: [],
    pressures: [],
    stakes: [],
    responseSlots: [],
    consequenceProfiles: [],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [...toneHints],
    textIngredients: {
      subject: '',
      sensoryDetails: [],
      actorOpinions: {},
      recentContext: [],
      stakesReadable: [],
    },
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      contractChecks: {},
    },
    generatedAt: {
      year: 0,
      month: 0,
      week: 0,
      day: 0,
      absoluteDay: 0,
    },
  }
  if (primaryActor !== undefined) seed.primaryActor = primaryActor
  return seed
}
