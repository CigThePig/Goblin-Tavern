// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Adapter that wraps a candidate `Snippet[]` for one slot in a minimal
// `CompositionalCardTemplate`, then runs Phase D's `runAllGates` over
// the whole spec's worth of slots in one call. The pipeline calls this
// after parse, before dedupe — failures feed back into the retry loop.
//
// The sampler helpers come from the existing Phase D test helpers
// (`tests/cards/compose/gates/samplers.ts`). The pipeline lives under
// `scripts/`, which is build-time code; the prohibition on importing
// from `tests/` is for runtime code (`src/sim/`, `web/`). Re-using the
// hand-tuned determinism + diversity samples avoids drift between
// what Phase D enforces in CI and what Phase E enforces on model
// output.

import type {
  CompositionalCardTemplate,
  Snippet,
  SnippetPool,
  SlotSpec,
  FilledSlots,
} from '../../src/cards/compose/types'
import {
  runAllGates,
  representativeBannedNames,
  type AllGatesConfig,
  type AllGatesReport,
  type DeterminismSample,
  type DiversitySampler,
  type GateViolation,
} from '../../src/cards/compose/gates'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  buildDeterminismSamples,
  buildDiversitySampler,
} from '../../tests/cards/compose/gates/samplers'
import type { GenerationSpec } from './types'
import type { SpecSlotSpec } from './specSchema'

const PHASE_E_WORD_BUDGETS: Record<string, number> = {
  order_line: 12,
  manner_note: 10,
}

const DIVERSITY_MIN_DISTINCT: Record<string, number> = {
  order_line: 6,
  manner_note: 3,
}

const DIVERSITY_SAMPLE_SIZE = 100

function specSlotToSlotSpec(
  slot: SpecSlotSpec,
  snippets: Snippet[],
): SlotSpec {
  const pool: SnippetPool = { slotId: slot.id, snippets }
  return {
    id: slot.id,
    role: slot.id,
    pool,
    optional: !slot.required,
    wordBudget: PHASE_E_WORD_BUDGETS[slot.id] ?? slot.maxWords,
    claimMode: slot.claims === 'flavor' ? 'flavor' : 'sim_backed',
  }
}

/** Wrap candidate `Snippet[]` per slot in a minimal compositional
 *  template. The `toCardView` projection is intentionally trivial —
 *  the gates run on the slot/pool data, not on the rendered card. */
export function buildTemplateFromCandidates(
  spec: GenerationSpec,
  candidatesBySlot: ReadonlyMap<string, Snippet[]>,
): CompositionalCardTemplate {
  const activeSlots = spec.slots.filter(
    (s) => s.status !== 'DISABLED_FOR_SPIKE',
  )
  const slots: SlotSpec[] = activeSlots.map((slot) =>
    specSlotToSlotSpec(slot, candidatesBySlot.get(slot.id) ?? []),
  )
  const toCardView = (filled: FilledSlots) => {
    const body: string[] = []
    for (const slot of slots) {
      const text = filled[slot.id]
      if (text) body.push(text)
    }
    return {
      title: spec.templateId,
      body,
      stakes: [],
      choices: [],
    }
  }
  return {
    id: spec.templateId,
    appliesTo: { custom: () => true },
    voiceRegister: spec.voiceRegister,
    slots,
    toCardView,
  }
}

export function buildGatesConfig(spec: GenerationSpec): AllGatesConfig {
  const baseState = createInitialTavernState()
  const determinism: DeterminismSample[] = buildDeterminismSamples()
  const diversity = spec.slots
    .filter((s) => s.status !== 'DISABLED_FOR_SPIKE')
    .map((slot) => {
      const sampler: DiversitySampler = buildDiversitySampler({
        rngSeed: `phase-125-diversity-${slot.id}`,
      })
      return {
        slotId: slot.id,
        sampler,
        config: {
          sampleSize: DIVERSITY_SAMPLE_SIZE,
          minDistinct: DIVERSITY_MIN_DISTINCT[slot.id] ?? 3,
        },
      }
    })
  return {
    voiceBounds: { defaultWordBudget: 12 },
    simCoherence: {
      bannedDisplayNames: representativeBannedNames(baseState),
    },
    determinism: { samples: determinism },
    diversity,
  }
}

export type GateRunResult = {
  template: CompositionalCardTemplate
  report: AllGatesReport
}

export function runGatesOnCandidates(
  spec: GenerationSpec,
  candidatesBySlot: ReadonlyMap<string, Snippet[]>,
): GateRunResult {
  const template = buildTemplateFromCandidates(spec, candidatesBySlot)
  const config = buildGatesConfig(spec)
  const report = runAllGates(template, config)
  return { template, report }
}

/** Extract violations that pertain to a specific slot. Sim-coherence,
 *  voice-bounds, coverage, and specificity violations carry `slotId`;
 *  diversity is per-entry; determinism is template-wide and is
 *  attributed to every slot in the candidate map. */
export function violationsForSlot(
  report: AllGatesReport,
  slotId: string,
): GateViolation[] {
  const out: GateViolation[] = []
  for (const sub of [
    report.coverage,
    report.specificity,
    report.voiceBounds,
    report.simCoherence,
  ]) {
    for (const v of sub.violations) {
      if (v.slotId === slotId) out.push(v)
    }
  }
  const diversityEntry = report.diversity.find((d) => d.slotId === slotId)
  if (diversityEntry) {
    for (const v of diversityEntry.violations) out.push(v)
  }
  if (!report.determinism.pass) {
    for (const v of report.determinism.violations) out.push(v)
  }
  return out
}
