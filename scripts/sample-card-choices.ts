import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { cardRegistry, ensureRequiredCardsRegistered } from '../src/cards/registry'
import { pickCardForSeed } from '../src/cards/selection'
import { fallbackCard } from '../src/cards/templates/fallback'
import type { CardChoice } from '../src/cards/types'
import type { EffectPreview } from '../src/sim/core/effect'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../src/sim/modules/issues/issueSeedTypes'
import { getIssueSeeds } from '../src/sim/modules/issues/issueSeedQueries'
import { runOneDay } from '../src/sim/testing/simRunner'
import type { TavernState } from '../src/sim/state/TavernState'
import {
  buildAreaAtmosphereTriggeringState,
  buildCultureConflictTriggeringState,
  buildCustomerComplaintTriggeringState,
  buildDebtRentTriggeringState,
  buildFactionRequestTriggeringState,
  buildFoodSafetyTriggeringState,
  buildInspectionTriggeringState,
  buildMaintenanceTriggeringState,
  buildMonthlyReviewTriggeringState,
  buildRegularCustomerComplaintTriggeringState,
  buildRegularCustomerRelationshipTriggeringState,
  buildReputationShiftTriggeringState,
  buildRivalTavernArcTriggeringState,
  buildRivalTavernSystemTriggeringState,
  buildRumourCrisisTriggeringState,
  buildSeasonalArcTriggeringState,
  buildStaffBurnoutTriggeringState,
  buildStaffIdentityTriggeringState,
  buildStockShortageTriggeringState,
  buildSupplierRelationshipTriggeringState,
  buildViolenceTriggeringState,
} from '../tests/sim/triggeringStates'

const OUT_DIR = 'docs/audits/generated-card-baseline'

type Scenario = {
  label: string
  family: string
  group: 'area-atmosphere' | 'stock' | 'staff' | 'reputation'
  buildState: () => TavernState
  type?: string
  select?: (seeds: IssueSeed[]) => IssueSeed[]
}

type RenderedSample = {
  scenario: Scenario
  state: TavernState
  seed: IssueSeed
  cardId: string
  choices: CardChoice[]
}

const SCENARIOS: Scenario[] = [
  { label: 'food_safety', family: 'food_safety', group: 'area-atmosphere', buildState: buildFoodSafetyTriggeringState },
  { label: 'maintenance', family: 'maintenance', group: 'area-atmosphere', buildState: buildMaintenanceTriggeringState },
  { label: 'area_atmosphere', family: 'area_atmosphere', group: 'area-atmosphere', buildState: buildAreaAtmosphereTriggeringState },
  { label: 'stock_shortage', family: 'stock_shortage', group: 'stock', buildState: buildStockShortageTriggeringState },
  { label: 'supplier_relationship', family: 'supplier_relationship', group: 'stock', buildState: buildSupplierRelationshipTriggeringState },
  { label: 'debt_rent', family: 'debt_rent', group: 'stock', buildState: buildDebtRentTriggeringState },
  { label: 'inspection', family: 'inspection', group: 'stock', buildState: buildInspectionTriggeringState },
  { label: 'staff_burnout', family: 'staff_burnout', group: 'staff', buildState: buildStaffBurnoutTriggeringState },
  { label: 'staff_identity', family: 'staff_identity', group: 'staff', buildState: buildStaffIdentityTriggeringState },
  { label: 'regular_customer_relationship', family: 'regular_customer', type: 'relationship_test', group: 'staff', buildState: buildRegularCustomerRelationshipTriggeringState },
  { label: 'regular_customer_complaint', family: 'regular_customer', type: 'complaint', group: 'staff', buildState: buildRegularCustomerComplaintTriggeringState },
  { label: 'customer_complaint', family: 'customer_complaint', group: 'staff', buildState: buildCustomerComplaintTriggeringState },
  { label: 'violence', family: 'violence', group: 'staff', buildState: buildViolenceTriggeringState },
  { label: 'faction_request', family: 'faction_request', group: 'reputation', buildState: buildFactionRequestTriggeringState },
  { label: 'culture_conflict', family: 'culture_conflict', group: 'reputation', buildState: buildCultureConflictTriggeringState },
  { label: 'reputation_shift', family: 'reputation_shift', group: 'reputation', buildState: buildReputationShiftTriggeringState },
  { label: 'rumour_crisis', family: 'rumour_crisis', group: 'reputation', buildState: buildRumourCrisisTriggeringState },
  { label: 'rival_tavern_arc', family: 'rival_tavern', group: 'reputation', buildState: buildRivalTavernArcTriggeringState, select: (seeds) => seeds.slice(0, 1) },
  { label: 'rival_tavern_system', family: 'rival_tavern', group: 'reputation', buildState: buildRivalTavernSystemTriggeringState, select: (seeds) => seeds.slice(0, 1) },
  { label: 'monthly_review', family: 'monthly_review', group: 'reputation', buildState: buildMonthlyReviewTriggeringState },
  { label: 'seasonal_arc', family: 'seasonal_arc', group: 'reputation', buildState: buildSeasonalArcTriggeringState },
]

function seedsForScenario(state: TavernState, scenario: Scenario): IssueSeed[] {
  let seeds = getIssueSeeds(state, { family: scenario.family })
  if (scenario.type) seeds = seeds.filter((seed) => seed.type === scenario.type)
  return seeds
}

function captureScenario(scenario: Scenario): RenderedSample[] {
  let result = runOneDay(scenario.buildState(), { seed: `card-baseline-${scenario.label}` })
  let seeds = seedsForScenario(result.state, scenario)
  if (seeds.length === 0) {
    result = runOneDay(result.state, { seed: `card-baseline-${scenario.label}-warm` })
    seeds = seedsForScenario(result.state, scenario)
  }
  if (seeds.length === 0) {
    throw new Error(`No seeds captured for ${scenario.label} (${scenario.family})`)
  }
  const selected = scenario.select ? scenario.select(seeds) : seeds.slice(0, 1)
  return selected.map((seed) => {
    ensureRequiredCardsRegistered()
    const chosen = pickCardForSeed(seed, result.state, cardRegistry.all()) ?? fallbackCard
    const rendered = chosen.render(seed, result.state)
    // If this ever diverges for a compositional template, the durable sample should fail loudly:
    // Phase 0 is meant to baseline the production helper path rather than a hand-rendered fixture.
    if (chosen.id !== fallbackCard.id) {
      const directChoices = rendered.choices
      if (!directChoices || directChoices.length === 0) {
        throw new Error(`Rendered card ${chosen.id} for ${seed.id} produced no choices`)
      }
    }
    return { scenario, state: result.state, seed, cardId: chosen.id, choices: rendered.choices }
  })
}

function effectJson(effect: EffectPreview): Record<string, unknown> {
  return {
    kind: effect.kind,
    target: effect.target,
    amount: effect.amount,
    readable: effect.readable,
    tags: effect.tags,
    targetKind: effect.targetKind,
    direction: effect.direction,
    magnitudeBand: effect.magnitudeBand,
    meterId: effect.meterId,
    meterLabel: effect.meterLabel,
  }
}

function profileJson(profile: ConsequenceProfile | undefined): Record<string, unknown> | undefined {
  if (!profile) return undefined
  return {
    id: profile.id,
    responseSlotId: profile.responseSlotId,
    immediateEffects: profile.immediateEffects.map(effectJson),
    delayedEffects: profile.delayedEffects.map(effectJson),
    memories: profile.memories,
    futureHooks: profile.futureHooks,
    impactScore: profile.impactScore,
  }
}

function slotJson(slot: ResponseSlot): Record<string, unknown> {
  return {
    id: slot.id,
    labelHint: slot.labelHint,
    allowedVerbs: slot.allowedVerbs,
    shape: slot.shape,
    targetOptions: slot.targetOptions,
    expectedEffects: slot.expectedEffects,
    choiceContract: slot.choiceContract,
    requiredTags: slot.requiredTags,
  }
}

function choiceJson(choice: CardChoice): Record<string, unknown> {
  return {
    slotId: choice.slotId,
    label: choice.label,
    verb: choice.verb,
    targetId: choice.targetId,
    shape: choice.shape,
    previewEffects: choice.previewEffects,
    mechanicalEffects: choice.mechanicalEffects,
    disabledReason: choice.disabledReason,
  }
}

function sampleBlock(sample: RenderedSample): string {
  const { seed, scenario } = sample
  const lines: string[] = []
  lines.push(`## ${scenario.label}`)
  lines.push('')
  lines.push(`- **Scenario:** ${scenario.label}`)
  lines.push(`- **Card id:** ${sample.cardId}`)
  lines.push(`- **Seed:** \`${seed.id}\``)
  lines.push(`- **Family/type/timing:** ${seed.family} / ${seed.type} / ${seed.timing}`)
  lines.push(`- **Severity/urgency/novelty/cardWorthiness:** ${seed.severity} / ${seed.urgency} / ${seed.novelty} / ${seed.cardWorthiness}`)
  lines.push(`- **Domain:** ${seed.domain.join(', ')}`)
  lines.push('')
  lines.push('### Authored simulation data')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify({
    causes: seed.causes,
    pressures: seed.pressures,
    stakes: seed.stakes,
    memoriesCreated: seed.memoriesCreated,
    futureHooks: seed.futureHooks,
    textIngredients: seed.textIngredients,
    validation: seed.validation,
  }, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('### Authored slots and consequence profiles')
  for (const slot of seed.responseSlots) {
    const profile = seed.consequenceProfiles.find((p) => p.responseSlotId === slot.id)
    lines.push('')
    lines.push(`#### Slot: ${slot.id}`)
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify({ responseSlot: slotJson(slot), consequenceProfile: profileJson(profile) }, null, 2))
    lines.push('```')
  }
  lines.push('')
  lines.push('### Rendered card choices')
  lines.push('')
  lines.push('These are the current player-facing `CardChoice` objects after the production card/template path has called `composeChoicesFromSeed()` for compositional cards.')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(sample.choices.map(choiceJson), null, 2))
  lines.push('```')
  lines.push('')
  return lines.join('\n')
}

function indexFile(samples: RenderedSample[]): string {
  const lines: string[] = []
  lines.push('# Generated Card Choice Baseline')
  lines.push('')
  lines.push('Generated by `npm run sample:card-choices`. This is a Phase 0 snapshot of authored issue-seed data beside rendered `CardChoice` data; it is intentionally stored under `docs/audits/` so it cannot affect runtime gameplay.')
  lines.push('')
  lines.push('## Coverage')
  lines.push('')
  lines.push('| Scenario | Family | Type | Timing | Card | Slots | Rendered choices | File |')
  lines.push('|---|---|---|---|---|---:|---:|---|')
  for (const sample of samples) {
    const file = groupFile(sample.scenario.group)
    lines.push(`| ${sample.scenario.label} | ${sample.seed.family} | ${sample.seed.type} | ${sample.seed.timing} | ${sample.cardId} | ${sample.seed.responseSlots.length} | ${sample.choices.length} | [${file}](${file}) |`)
  }
  lines.push('')
  lines.push('## Regeneration')
  lines.push('')
  lines.push('```sh')
  lines.push('npm run sample:card-choices')
  lines.push('```')
  lines.push('')
  return lines.join('\n')
}

function groupFile(group: Scenario['group']): string {
  switch (group) {
    case 'area-atmosphere': return 'area-atmosphere-samples.md'
    case 'stock': return 'stock-samples.md'
    case 'staff': return 'staff-samples.md'
    case 'reputation': return 'reputation-samples.md'
  }
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
  const samples = SCENARIOS.flatMap(captureScenario)
  await writeFile(join(OUT_DIR, 'card-sample-index.md'), indexFile(samples))
  for (const group of ['area-atmosphere', 'stock', 'staff', 'reputation'] as const) {
    const groupSamples = samples.filter((sample) => sample.scenario.group === group)
    const title = group === 'area-atmosphere' ? 'Area & Atmosphere Samples' : `${group[0]!.toUpperCase()}${group.slice(1)} Samples`
    const content = [`# ${title}`, '', ...groupSamples.map(sampleBlock)].join('\n')
    await writeFile(join(OUT_DIR, groupFile(group)), content)
  }
  console.log(`Wrote ${samples.length} card-choice sample(s) to ${OUT_DIR}`)
}

void main()
