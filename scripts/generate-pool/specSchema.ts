// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Zod schema for Phase B's spec format. The shape is FIXED to what
// `docs/plans/living-cast-arc-phase-b.md` encodes; this schema is the
// machine-readable copy. Unknown keys reject so spec drift surfaces
// early; structural validation only (the gates check prose).

import { z } from 'zod'

const VoiceAxisLevel = z.union([z.literal(0), z.literal(1), z.literal(2)])

const VoiceAxisIdSchema = z.enum([
  'terseness',
  'warmth',
  'formality',
  'floridity',
])

const VerbalTicIdSchema = z.enum([
  'trails_off',
  'interrupts_self',
  'understates',
  'repeats_for_emphasis',
  'qualifies_everything',
  'italicises_stakes',
  'quotes_someone_else',
])

const SlotClaimsSchema = z.enum(['flavor', 'sim-backed'])

const SlotSpecSchema = z
  .object({
    id: z.string().min(1),
    required: z.boolean(),
    claims: SlotClaimsSchema,
    maxWords: z.number().int().positive(),
    description: z.string(),
    // Phase 127 / ISSUE-096 — `SIGNAL_AVAILABLE` joins the skip-equivalent
    // statuses. It signals that Phase 1's signal surface reaches this slot
    // but no snippet pool has been authored yet; the pipeline treats it
    // the same way it treats `DISABLED_FOR_SPIKE` until a spike or
    // migration phase fills the pool.
    status: z.enum(['DISABLED_FOR_SPIKE', 'SIGNAL_AVAILABLE']).optional(),
  })
  .strict()

const VoiceAxisLevelMap = z.record(VoiceAxisLevel, z.string())

const VoiceAxesInPlaySchema = z
  .object({
    terseness: VoiceAxisLevelMap.optional(),
    warmth: VoiceAxisLevelMap.optional(),
    formality: VoiceAxisLevelMap.optional(),
    floridity: VoiceAxisLevelMap.optional(),
  })
  .strict()

// Phase 126 / ISSUE-095 — Living Cast Phase F (first situation).
// Per-slot word budgets used to live inline (`order_line: 12`,
// `manner_note: 10`, `sim_backed_hook?: …`) — a Phase-E hardcode of the
// first template's slot ids. Phase F surfaces the gap: a second template
// needs its own slot ids in the same field. The shape generalises to a
// `perSlotWords: Record<slotId, number>` record keyed by the spec's own
// `slots[].id` values. The prose-policy booleans stay flat — they apply
// to every snippet regardless of slot.
const HardBoundsSchema = z
  .object({
    perSlotWords: z.record(z.string().min(1), z.number().int().positive()),
    punctuation: z.string(),
    noFragmentsThatRequireConcatenation: z.boolean(),
    noMadLibPlaceholders: z.boolean(),
    noModernSlang: z.boolean(),
    noEarthIdioms: z.boolean(),
    noDirectMechanicalLanguage: z.boolean(),
  })
  .strict()

const GradientPolicySchema = z
  .object({
    base: z.string(),
    middle: z.string(),
    top: z.string(),
    tic: z.string(),
  })
  .strict()

const ExemplarVoiceSchema = z
  .object({
    terseness: VoiceAxisLevel.optional(),
    warmth: VoiceAxisLevel.optional(),
    formality: VoiceAxisLevel.optional(),
    floridity: VoiceAxisLevel.optional(),
    verbalTic: VerbalTicIdSchema.optional(),
  })
  .strict()

// Phase 126 / ISSUE-095 — Living Cast Phase F (first situation).
// Per-slot exemplar text used to live inline (`order_line: ...`,
// `manner_note?: ...`) — same Phase-E hardcode as `HardBoundsSchema`.
// Generalised to a `slotLines: Record<slotId, string>` map; an exemplar
// supplies text for whichever slots it speaks to. `buildPrompt` looks up
// `ex.slotLines[slotId]` per slot.
const PositiveExemplarSchema = z
  .object({
    id: z.string().min(1),
    claims: SlotClaimsSchema,
    voice: ExemplarVoiceSchema,
    slotLines: z.record(z.string().min(1), z.string()),
    why_it_works: z.string(),
  })
  .strict()

const NegativeExampleSchema = z
  .object({
    id: z.string().min(1),
    line: z.string(),
    fails: z.array(z.string()).min(1),
    reason: z.string(),
  })
  .strict()

// Conditions in the spec mirror the runtime `SnippetCondition` shape.
// We accept the eleven framework primitives plus the two Phase-B voice
// bridge forms. Anything else rejects.
//
// NOTE: the voiceAxis form has two shapes (atLeast vs. atMost), so we
// use a plain `union` rather than `discriminatedUnion` — Zod v4 rejects
// duplicate discriminator values. The combined `voiceAxis` schema
// below requires exactly one of `atLeast` / `atMost`.
const VoiceAxisAtLeastSchema = z
  .object({
    kind: z.literal('voiceAxis'),
    role: z.string(),
    axis: VoiceAxisIdSchema,
    atLeast: VoiceAxisLevel,
  })
  .strict()

const VoiceAxisAtMostSchema = z
  .object({
    kind: z.literal('voiceAxis'),
    role: z.string(),
    axis: VoiceAxisIdSchema,
    atMost: VoiceAxisLevel,
  })
  .strict()

const SnippetConditionSchema = z.union([
  z
    .object({
      kind: z.literal('seedFamily'),
      anyOf: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('seedType'),
      anyOf: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('timing'),
      anyOf: z.array(z.string()),
    })
    .strict(),
  z.object({ kind: z.literal('severityAtLeast'), value: z.number() }).strict(),
  z.object({ kind: z.literal('severityBelow'), value: z.number() }).strict(),
  z.object({ kind: z.literal('hasTag'), tag: z.string() }).strict(),
  z
    .object({
      kind: z.literal('hasNamedEntity'),
      role: z.string().optional(),
      entityKind: z.string().optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal('pressureRising'), pressureId: z.string() })
    .strict(),
  z
    .object({ kind: z.literal('memoryPresent'), tag: z.string().optional() })
    .strict(),
  z
    .object({
      kind: z.literal('repeatCount'),
      subjectTag: z.string(),
      atLeast: z.number().int(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('actorTrait'),
      role: z.string(),
      trait: z.string(),
    })
    .strict(),
  VoiceAxisAtLeastSchema,
  VoiceAxisAtMostSchema,
  z
    .object({
      kind: z.literal('verbalTic'),
      role: z.string(),
      tic: VerbalTicIdSchema,
    })
    .strict(),
])

export const SnippetSeedSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    conditions: z.array(SnippetConditionSchema),
    specificity: z.number().int().nonnegative().optional(),
  })
  .strict()

const SnippetPoolSeedSchema = z
  .object({
    slotId: z.string().min(1),
    required: z.boolean(),
    // Phase 127 / ISSUE-096 — `SIGNAL_AVAILABLE` joins the skip-equivalent
    // statuses. It signals that Phase 1's signal surface reaches this slot
    // but no snippet pool has been authored yet; the pipeline treats it
    // the same way it treats `DISABLED_FOR_SPIKE` until a spike or
    // migration phase fills the pool.
    status: z.enum(['DISABLED_FOR_SPIKE', 'SIGNAL_AVAILABLE']).optional(),
    snippets: z.array(SnippetSeedSchema),
  })
  .strict()

const MustPassEntrySchema = z
  .object({
    rule: z.string(),
    current: z.union([z.string(), z.boolean()]),
  })
  .strict()

const MustPassSchema = z
  .object({
    coverage: MustPassEntrySchema,
    specificityGradient: MustPassEntrySchema,
    voiceBounds: MustPassEntrySchema,
    simCoherence: MustPassEntrySchema,
    determinism: MustPassEntrySchema,
    diversity: MustPassEntrySchema,
  })
  .strict()

export const GenerationSpecSchema = z
  .object({
    templateId: z.string().min(1),
    voiceRegister: z.string().min(1),
    status: z.string().optional(),
    purpose: z.string(),
    slots: z.array(SlotSpecSchema).min(1),
    voiceAxesInPlay: VoiceAxesInPlaySchema,
    verbalTicsCovered: z.array(VerbalTicIdSchema),
    allowedTargets: z.array(z.string()),
    mustNotInvent: z.array(z.string()),
    hardBounds: HardBoundsSchema,
    gradientPolicy: GradientPolicySchema,
    positiveExemplars: z.array(PositiveExemplarSchema),
    negativeExamples: z.array(NegativeExampleSchema),
    snippetPools: z.array(SnippetPoolSeedSchema),
    diversityCases: z.array(z.string()),
    mustPass: MustPassSchema,
  })
  .strict()

export type GenerationSpecParsed = z.infer<typeof GenerationSpecSchema>
export type SpecSlotSpec = z.infer<typeof SlotSpecSchema>
export type SpecSnippet = z.infer<typeof SnippetSeedSchema>
export type SpecPositiveExemplar = z.infer<typeof PositiveExemplarSchema>
export type SpecNegativeExample = z.infer<typeof NegativeExampleSchema>
