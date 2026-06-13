import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { formatEffectPreview } from '../src/cards/compose/formatEffectPreview'
import { cardRegistry, ensureRequiredCardsRegistered } from '../src/cards/registry'
import { pickCardForSeed } from '../src/cards/selection'
import { fallbackCard } from '../src/cards/templates/fallback'
import type { CardChoice } from '../src/cards/types'
import type { EffectPreview } from '../src/sim/core/effect'
import type {
  ChoiceContract,
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

const OUT_DIR = 'docs/audits'
const REPORT_MD = 'card-choice-audit.md'
const REPORT_JSON = 'card-choice-audit.json'

const WARNING_FLAGS = [
  'expected_cost_missing',
  'expected_risk_missing',
  'expected_capacity_loss_missing',
  'free_positive_option',
  'hidden_delayed_benefit',
  'hidden_delayed_risk',
  'high_cost_low_visible_benefit',
  'possible_dominated_option',
  'long_term_investment_without_visible_payoff',
  'ignore_without_downside',
  'pressure_label_unclear',
  'label_strength_mismatch',
  'contract_cost_missing',
  'contract_visible_tradeoff_missing',
  'contract_delayed_payoff_missing',
  'contract_archetype_rule_violation',
] as const

type WarningFlag = (typeof WARNING_FLAGS)[number]

type Scenario = {
  label: string
  family: string
  buildState: () => TavernState
  type?: string
}

type EffectRole = 'cost' | 'benefit' | 'risk'

type EffectAudit = {
  kind: EffectPreview['kind']
  target: string
  amount?: number
  readable: string
  tags: string[]
  targetKind?: EffectPreview['targetKind']
  direction?: EffectPreview['direction']
  magnitudeBand?: EffectPreview['magnitudeBand']
  meterId?: string
  meterLabel?: string
  meterDisplayCategory?: EffectPreview['meterDisplayCategory']
  formatted: string
  roles: EffectRole[]
  visible: boolean
}

type AuditRow = {
  cardFamily: string
  cardId: string
  scenario: string
  issueId: string
  seedId: string
  responseSlotId: string
  responseLabel: string
  responseShape: string
  choiceContract?: ChoiceContract
  allowedVerbs: string[]
  targetOptions: string[]
  choiceLabel: string
  renderedPreviewEffects: string[]
  renderedMechanicalEffects: string[]
  immediateEffects: EffectAudit[]
  delayedEffects: EffectAudit[]
  expectedEffects: string[]
  visiblePreviewEffects: EffectAudit[]
  costEffects: EffectAudit[]
  benefitEffects: EffectAudit[]
  riskEffects: EffectAudit[]
  hiddenDelayedBenefits: EffectAudit[]
  hiddenDelayedRisks: EffectAudit[]
  warningFlags: WarningFlag[]
}

const SCENARIOS: Scenario[] = [
  { label: 'food_safety', family: 'food_safety', buildState: buildFoodSafetyTriggeringState },
  { label: 'maintenance', family: 'maintenance', buildState: buildMaintenanceTriggeringState },
  { label: 'area_atmosphere', family: 'area_atmosphere', buildState: buildAreaAtmosphereTriggeringState },
  { label: 'stock_shortage', family: 'stock_shortage', buildState: buildStockShortageTriggeringState },
  { label: 'supplier_relationship', family: 'supplier_relationship', buildState: buildSupplierRelationshipTriggeringState },
  { label: 'debt_rent', family: 'debt_rent', buildState: buildDebtRentTriggeringState },
  { label: 'inspection', family: 'inspection', buildState: buildInspectionTriggeringState },
  { label: 'staff_burnout', family: 'staff_burnout', buildState: buildStaffBurnoutTriggeringState },
  { label: 'staff_identity', family: 'staff_identity', buildState: buildStaffIdentityTriggeringState },
  { label: 'regular_customer_relationship', family: 'regular_customer', type: 'relationship_test', buildState: buildRegularCustomerRelationshipTriggeringState },
  { label: 'regular_customer_complaint', family: 'regular_customer', type: 'complaint', buildState: buildRegularCustomerComplaintTriggeringState },
  { label: 'customer_complaint', family: 'customer_complaint', buildState: buildCustomerComplaintTriggeringState },
  { label: 'violence', family: 'violence', buildState: buildViolenceTriggeringState },
  { label: 'faction_request', family: 'faction_request', buildState: buildFactionRequestTriggeringState },
  { label: 'culture_conflict', family: 'culture_conflict', buildState: buildCultureConflictTriggeringState },
  { label: 'reputation_shift', family: 'reputation_shift', buildState: buildReputationShiftTriggeringState },
  { label: 'rumour_crisis', family: 'rumour_crisis', buildState: buildRumourCrisisTriggeringState },
  { label: 'rival_tavern_arc', family: 'rival_tavern', buildState: buildRivalTavernArcTriggeringState },
  { label: 'rival_tavern_system', family: 'rival_tavern', buildState: buildRivalTavernSystemTriggeringState },
  { label: 'monthly_review', family: 'monthly_review', buildState: buildMonthlyReviewTriggeringState },
  { label: 'seasonal_arc', family: 'seasonal_arc', buildState: buildSeasonalArcTriggeringState },
]

function seedsForScenario(state: TavernState, scenario: Scenario): IssueSeed[] {
  let seeds = getIssueSeeds(state, { family: scenario.family })
  if (scenario.type !== undefined) seeds = seeds.filter((seed) => seed.type === scenario.type)
  return seeds
}

function captureScenario(scenario: Scenario): Array<{ scenario: Scenario; state: TavernState; seed: IssueSeed; cardId: string; choices: CardChoice[] }> {
  let result = runOneDay(scenario.buildState(), { seed: `card-choice-audit-${scenario.label}` })
  let seeds = seedsForScenario(result.state, scenario)
  if (seeds.length === 0) {
    result = runOneDay(result.state, { seed: `card-choice-audit-${scenario.label}-warm` })
    seeds = seedsForScenario(result.state, scenario)
  }
  if (seeds.length === 0) {
    throw new Error(`No seeds captured for ${scenario.label} (${scenario.family})`)
  }

  ensureRequiredCardsRegistered()
  return seeds.map((seed) => {
    const chosen = pickCardForSeed(seed, result.state, cardRegistry.all()) ?? fallbackCard
    const rendered = chosen.render(seed, result.state)
    if (chosen.id !== fallbackCard.id) {
      const directChoices = rendered.choices
      if (!directChoices || directChoices.length === 0) {
        throw new Error(`Rendered card ${chosen.id} for ${seed.id} produced no choices`)
      }
    }
    return { scenario, state: result.state, seed, cardId: chosen.id, choices: rendered.choices }
  })
}

function toText(value: string | undefined): string {
  return value?.toLowerCase() ?? ''
}

function effectRoles(effect: EffectPreview): EffectRole[] {
  const roles: EffectRole[] = []
  const target = toText(effect.target)
  const meter = toText(effect.meterId)
  const readable = toText(effect.readable)
  const tags = effect.tags.map((tag) => tag.toLowerCase())

  const isCoinCost = effect.targetKind === 'coin' && effect.direction === 'negative'
  const isStaffBurden =
    effect.targetKind === 'staff' &&
    ((meter === 'stress' || meter === 'fatigue')
      ? effect.direction === 'negative'
      : (meter === 'morale' || meter === 'loyalty') && effect.direction === 'negative')
  const isRiskIncrease =
    (effect.targetKind === 'pressure' && effect.direction === 'positive') ||
    tags.includes('risk') ||
    (effect.kind === 'future_hook' && /risk|revenge|retaliat|return|grudge|expos|less|gossip|blur|dilution/.test(readable))
  const isCapacityLoss =
    effect.direction === 'negative' &&
    (meter.includes('capacity') || target.includes('capacity') || readable.includes('capacity'))

  if (isCoinCost || isStaffBurden || isCapacityLoss || target.includes('cost')) roles.push('cost')
  if (isRiskIncrease) roles.push('risk')

  if (effect.targetKind === 'pressure') {
    if (effect.direction === 'negative') roles.push('benefit')
  } else if (
    effect.direction === 'positive' &&
    effect.targetKind !== 'coin' &&
    !roles.includes('risk')
  ) {
    roles.push('benefit')
  }

  return roles
}

function effectVisible(effect: EffectPreview, state: TavernState, choice: CardChoice, delayed: boolean): boolean {
  const formatted = formatEffectPreview(effect, state)
  const laterFormatted = `later: ${formatted}`
  const laterReadable = `later: ${effect.readable}`
  const lines = [...choice.previewEffects, ...(choice.mechanicalEffects ?? [])]
  return lines.some((line) =>
    line === formatted ||
    line === effect.readable ||
    (delayed && (line === laterFormatted || line === laterReadable)) ||
    line.includes(formatted) ||
    line.includes(effect.readable),
  )
}

function auditEffect(effect: EffectPreview, state: TavernState, choice: CardChoice, delayed: boolean): EffectAudit {
  const formatted = formatEffectPreview(effect, state)
  return {
    kind: effect.kind,
    target: effect.target,
    ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
    readable: effect.readable,
    tags: effect.tags,
    ...(effect.targetKind !== undefined ? { targetKind: effect.targetKind } : {}),
    ...(effect.direction !== undefined ? { direction: effect.direction } : {}),
    ...(effect.magnitudeBand !== undefined ? { magnitudeBand: effect.magnitudeBand } : {}),
    ...(effect.meterId !== undefined ? { meterId: effect.meterId } : {}),
    ...(effect.meterLabel !== undefined ? { meterLabel: effect.meterLabel } : {}),
    ...(effect.meterDisplayCategory !== undefined
      ? { meterDisplayCategory: effect.meterDisplayCategory }
      : {}),
    formatted,
    roles: effectRoles(effect),
    visible: effectVisible(effect, state, choice, delayed),
  }
}

function expectedClaims(expectedEffects: string[]): Set<string> {
  const claims = new Set<string>()
  const text = expectedEffects.join(' ').toLowerCase()
  const costText = text
    .replace(/no (?:immediate )?(?:coin )?cost/g, '')
    .replace(/rent already paid/g, '')

  if (/(?:pay|paid|spend|cost|lose|lost|discount|bribe|compensat|settle|payment).{0,24}(?:coin|silver|coppers|rent)|(?:coin|silver|coppers|rent).{0,24}(?:cost|spent|leave|leaves|slip|lose|lost|paid|payment|settle)/.test(costText)) claims.add('coin cost')
  if (/time cost|takes time|spend time|delay cost|wait cost|temporary closure|temporarily close/.test(costText)) claims.add('time cost')
  if (/capacity|close|shut|space|service capacity|lose service/.test(text)) claims.add('capacity loss')
  if (/fatigue|stress|burden|overwork|workload|rota|staff cost|staff time/.test(text)) claims.add('staff burden')
  if (/(risk|strain|hurt|damage|lose|grudge).*(relationship|loyalty|trust|regular|supplier|faction|customer)|(relationship|loyalty|trust|regular|supplier|faction|customer).*(risk|strain|hurt|damage|lose|grudge)/.test(text)) claims.add('risk relationship')
  if (/(risk|strain|hurt|damage|lose|grudge).*(credib|reputation|rumou?r|respect|standing)|(credib|reputation|rumou?r|respect|standing).*(risk|strain|hurt|damage|lose|grudge)|blame/.test(text)) claims.add('risk credibility')
  return claims
}

function hasMechanicalCostForClaim(claim: string, effects: EffectAudit[]): boolean {
  switch (claim) {
    case 'coin cost':
      return effects.some((effect) => effect.targetKind === 'coin' && effect.direction === 'negative')
    case 'time cost':
      return effects.some((effect) => effect.tags.includes('time') || /time|delay|later|wait/.test(effect.readable.toLowerCase()))
    case 'capacity loss':
      return effects.some((effect) => effect.roles.includes('cost') && /capacity|close|shut|service/.test(`${effect.target} ${effect.readable}`.toLowerCase()))
    case 'staff burden':
      return effects.some(
        (effect) =>
          (effect.targetKind === 'staff' && effect.roles.includes('cost')) ||
          (effect.targetKind === 'pressure' &&
            effect.direction === 'positive' &&
            (effect.tags.includes('staff') || /staff|burnout|loyalty/.test(effect.readable.toLowerCase()))),
      )
    case 'risk relationship':
      return effects.some((effect) => effect.roles.includes('risk') || (['customer', 'staff', 'supplier', 'faction', 'culture', 'cohort'].includes(effect.targetKind ?? '') && effect.direction === 'negative'))
    case 'risk credibility':
      return effects.some((effect) => effect.roles.includes('risk') || (effect.targetKind === 'reputation' && effect.direction === 'negative'))
    default:
      return false
  }
}

function hasVisibleDownside(effects: EffectAudit[]): boolean {
  return effects.some((effect) =>
    effect.visible &&
    (effect.roles.includes('cost') || effect.roles.includes('risk') || effect.direction === 'negative'),
  )
}

function hasVisibleBenefit(effects: EffectAudit[]): boolean {
  return effects.some((effect) => effect.visible && effect.roles.includes('benefit'))
}

function isLargeOrMedium(effect: EffectAudit): boolean {
  return effect.magnitudeBand === 'medium' || effect.magnitudeBand === 'large'
}

function addWarning(flags: Set<WarningFlag>, flag: WarningFlag): void {
  flags.add(flag)
}

function hasContractCost(costType: NonNullable<ChoiceContract['costTypes']>[number], effects: EffectAudit[]): boolean {
  switch (costType) {
    case 'none':
      return true
    case 'coin':
      return hasMechanicalCostForClaim('coin cost', effects)
    case 'owner_time':
      return hasMechanicalCostForClaim('time cost', effects)
    case 'service_capacity':
      return hasMechanicalCostForClaim('capacity loss', effects)
    case 'staff_fatigue':
    case 'staff_morale':
      return hasMechanicalCostForClaim('staff burden', effects)
    case 'reputation_risk':
      return hasMechanicalCostForClaim('risk credibility', effects)
    case 'relationship_risk':
      return hasMechanicalCostForClaim('risk relationship', effects)
    case 'pressure_risk':
      return effects.some((effect) => effect.targetKind === 'pressure' && effect.direction === 'positive')
    case 'stock':
      return effects.some((effect) => effect.targetKind === 'stock' && effect.direction === 'negative')
    default:
      return false
  }
}

function hasDirectRepairBenefit(effects: EffectAudit[]): boolean {
  return effects.some(
    (effect) =>
      effect.roles.includes('benefit') &&
      effect.targetKind === 'area' &&
      (effect.meterId === 'condition' || effect.meterId === 'damage'),
  )
}

function hasCleanlinessBenefit(effects: EffectAudit[]): boolean {
  return effects.some(
    (effect) =>
      effect.roles.includes('benefit') &&
      effect.targetKind === 'area' &&
      ['cleanliness', 'smell', 'mess'].includes(effect.meterId ?? ''),
  )
}

function hasMaterialRepairBenefit(effects: EffectAudit[]): boolean {
  const repairEffects = effects.filter(
    (effect) =>
      effect.roles.includes('benefit') &&
      effect.targetKind === 'area' &&
      (effect.meterId === 'condition' || effect.meterId === 'damage'),
  )
  return (
    repairEffects.some(isLargeOrMedium) ||
    repairEffects.reduce((sum, effect) => sum + Math.abs(effect.amount ?? 0), 0) >= 20
  )
}

function contractWarningsForRow(
  slot: ResponseSlot,
  immediate: EffectAudit[],
  delayed: EffectAudit[],
): WarningFlag[] {
  const contract = slot.choiceContract
  if (contract === undefined) return []

  const flags = new Set<WarningFlag>()
  const allEffects = [...immediate, ...delayed]
  const delayedBenefits = delayed.filter((effect) => effect.roles.includes('benefit'))

  for (const costType of contract.costTypes ?? []) {
    if (!hasContractCost(costType, allEffects)) addWarning(flags, 'contract_cost_missing')
  }

  if (contract.requiresVisibleTradeoff && !hasVisibleDownside(allEffects)) {
    addWarning(flags, 'contract_visible_tradeoff_missing')
  }

  if (contract.mustShowDelayedPayoff && !delayedBenefits.some((effect) => effect.visible)) {
    addWarning(flags, 'contract_delayed_payoff_missing')
  }

  switch (contract.archetype) {
    case 'major_project':
      if (contract.payoffTiming !== 'mixed' && contract.payoffTiming !== 'delayed') {
        addWarning(flags, 'contract_archetype_rule_violation')
      }
      if (delayedBenefits.length === 0) addWarning(flags, 'contract_archetype_rule_violation')
      break
    case 'proper_repair':
      if (!hasMaterialRepairBenefit(immediate)) addWarning(flags, 'contract_archetype_rule_violation')
      break
    case 'clean':
      if (!hasCleanlinessBenefit(allEffects)) addWarning(flags, 'contract_archetype_rule_violation')
      if (hasDirectRepairBenefit(allEffects) && !hasCleanlinessBenefit(allEffects)) {
        addWarning(flags, 'contract_archetype_rule_violation')
      }
      break
    case 'close_temporarily':
      if (!hasContractCost('service_capacity', allEffects)) addWarning(flags, 'contract_cost_missing')
      break
    case 'spin_or_rebrand':
      if (hasMaterialRepairBenefit(allEffects)) addWarning(flags, 'contract_archetype_rule_violation')
      if (!hasContractCost('reputation_risk', allEffects)) addWarning(flags, 'contract_cost_missing')
      break
    case 'ignore':
      if (!delayed.some((effect) => effect.roles.includes('risk') || effect.direction === 'negative')) {
        addWarning(flags, 'contract_archetype_rule_violation')
      }
      break
    default:
      break
  }

  return [...flags]
}

function warningsForRow(slot: ResponseSlot, choice: CardChoice, immediate: EffectAudit[], delayed: EffectAudit[]): WarningFlag[] {
  const flags = new Set<WarningFlag>()
  const allEffects = [...immediate, ...delayed]
  const visible = allEffects.filter((effect) => effect.visible)
  const claims = expectedClaims(slot.expectedEffects)

  if ([...claims].some((claim) => ['coin cost', 'time cost', 'staff burden'].includes(claim) && !hasMechanicalCostForClaim(claim, allEffects))) {
    addWarning(flags, 'expected_cost_missing')
  }
  if ([...claims].some((claim) => ['risk relationship', 'risk credibility'].includes(claim) && !hasMechanicalCostForClaim(claim, allEffects))) {
    addWarning(flags, 'expected_risk_missing')
  }
  if (claims.has('capacity loss') && !hasMechanicalCostForClaim('capacity loss', allEffects)) {
    addWarning(flags, 'expected_capacity_loss_missing')
  }

  const hiddenDelayedBenefits = delayed.filter((effect) => effect.roles.includes('benefit') && !effect.visible)
  const hiddenDelayedRisks = delayed.filter((effect) => effect.roles.includes('risk') && !effect.visible)
  if (hiddenDelayedBenefits.length > 0) addWarning(flags, 'hidden_delayed_benefit')
  if (hiddenDelayedRisks.length > 0) addWarning(flags, 'hidden_delayed_risk')

  const hasMeaningfulPositiveImmediate = immediate.some((effect) => effect.roles.includes('benefit') && isLargeOrMedium(effect))
  if (hasMeaningfulPositiveImmediate && !hasVisibleDownside([...immediate, ...delayed])) {
    addWarning(flags, 'free_positive_option')
  }

  const visibleCosts = visible.filter((effect) => effect.roles.includes('cost') && isLargeOrMedium(effect))
  if (visibleCosts.length > 0 && !hasVisibleBenefit(visible)) {
    addWarning(flags, 'high_cost_low_visible_benefit')
  }

  const label = choice.label.toLowerCase()
  if ((choice.shape === 'long_term_investment' || /project|overhaul|proper|invest/.test(label)) && hiddenDelayedBenefits.length > 0) {
    addWarning(flags, 'long_term_investment_without_visible_payoff')
  }
  if ((choice.verb === 'ignore' || choice.shape === 'ignore' || /ignore|wait|leave it/.test(label)) && !hasVisibleDownside(allEffects)) {
    addWarning(flags, 'ignore_without_downside')
  }
  if (allEffects.some((effect) => effect.targetKind === 'pressure' && effect.meterLabel === undefined)) {
    addWarning(flags, 'pressure_label_unclear')
  }
  if (/major|deep|proper|overhaul|project|full/.test(label) && !allEffects.some(isLargeOrMedium)) {
    addWarning(flags, 'label_strength_mismatch')
  }

  for (const flag of contractWarningsForRow(slot, immediate, delayed)) addWarning(flags, flag)

  return [...flags]
}

export function buildRows(): AuditRow[] {
  const rows: AuditRow[] = []
  for (const sample of SCENARIOS.flatMap(captureScenario)) {
    for (const choice of sample.choices) {
      const slot = sample.seed.responseSlots.find((candidate) => candidate.id === choice.slotId)
      if (slot === undefined) continue
      const profile = sample.seed.consequenceProfiles.find((candidate) => candidate.responseSlotId === slot.id)
      const immediate = (profile?.immediateEffects ?? []).map((effect) => auditEffect(effect, sample.state, choice, false))
      const delayed = (profile?.delayedEffects ?? []).map((effect) => auditEffect(effect, sample.state, choice, true))
      const allEffects = [...immediate, ...delayed]
      rows.push({
        cardFamily: sample.seed.family,
        cardId: sample.cardId,
        scenario: sample.scenario.label,
        issueId: sample.seed.type,
        seedId: sample.seed.id,
        responseSlotId: slot.id,
        responseLabel: slot.labelHint,
        responseShape: slot.shape,
        ...(slot.choiceContract !== undefined ? { choiceContract: slot.choiceContract } : {}),
        allowedVerbs: slot.allowedVerbs,
        targetOptions: slot.targetOptions.map((target) => `${target.kind}:${target.id}`),
        choiceLabel: choice.label,
        renderedPreviewEffects: choice.previewEffects,
        renderedMechanicalEffects: choice.mechanicalEffects ?? [],
        immediateEffects: immediate,
        delayedEffects: delayed,
        expectedEffects: slot.expectedEffects,
        visiblePreviewEffects: allEffects.filter((effect) => effect.visible),
        costEffects: allEffects.filter((effect) => effect.roles.includes('cost')),
        benefitEffects: allEffects.filter((effect) => effect.roles.includes('benefit')),
        riskEffects: allEffects.filter((effect) => effect.roles.includes('risk')),
        hiddenDelayedBenefits: delayed.filter((effect) => effect.roles.includes('benefit') && !effect.visible),
        hiddenDelayedRisks: delayed.filter((effect) => effect.roles.includes('risk') && !effect.visible),
        warningFlags: warningsForRow(slot, choice, immediate, delayed),
      })
    }
  }
  flagDominatedOptions(rows)
  return rows
}

function visibleBenefitScore(row: AuditRow): number {
  return row.visiblePreviewEffects
    .filter((effect) => effect.roles.includes('benefit'))
    .reduce((sum, effect) => sum + Math.abs(effect.amount ?? 0), 0)
}

function visibleCostScore(row: AuditRow): number {
  return row.visiblePreviewEffects
    .filter((effect) => effect.roles.includes('cost') || effect.roles.includes('risk') || effect.direction === 'negative')
    .reduce((sum, effect) => sum + Math.abs(effect.amount ?? 0), 0)
}

function visibleTargets(row: AuditRow): Set<string> {
  return new Set(row.visiblePreviewEffects.map((effect) => `${effect.targetKind ?? 'unknown'}:${effect.meterId ?? effect.target}`))
}

function flagDominatedOptions(rows: AuditRow[]): void {
  const groups = new Map<string, AuditRow[]>()
  for (const row of rows) {
    const key = `${row.cardFamily}|${row.seedId}|${row.cardId}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  for (const groupRows of groups.values()) {
    for (const row of groupRows) {
      if (row.hiddenDelayedBenefits.length > 0 || row.riskEffects.some((effect) => effect.visible)) continue
      const rowBenefit = visibleBenefitScore(row)
      const rowCost = visibleCostScore(row)
      if (rowBenefit <= 0 || rowCost <= 0) continue
      for (const other of groupRows) {
        if (other === row) continue
        const otherBenefit = visibleBenefitScore(other)
        const otherCost = visibleCostScore(other)
        const sameTargets = [...visibleTargets(row)].some((target) => visibleTargets(other).has(target))
        if (!sameTargets) continue
        if (rowCost > otherCost && rowBenefit <= otherBenefit) {
          if (!row.warningFlags.includes('possible_dominated_option')) {
            row.warningFlags = [...row.warningFlags, 'possible_dominated_option']
          }
          break
        }
      }
    }
  }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function compactEffects(effects: EffectAudit[]): string {
  if (effects.length === 0) return '—'
  return effects
    .map((effect) => `${effect.formatted}${effect.visible ? '' : ' (hidden)'} [${effect.roles.join(',') || 'none'}]`)
    .join('<br>')
}

function markdownReport(rows: AuditRow[]): string {
  const warningCounts = new Map<WarningFlag, number>()
  for (const flag of WARNING_FLAGS) warningCounts.set(flag, 0)
  for (const row of rows) {
    for (const flag of row.warningFlags) warningCounts.set(flag, (warningCounts.get(flag) ?? 0) + 1)
  }

  const lines: string[] = []
  lines.push('# Card Choice Coherence Audit')
  lines.push('')
  lines.push('Generated by `npm run audit:card-choices`. The audit renders real issue seeds through the same card registry/template path used by gameplay and records one row per rendered `CardChoice`; it does not apply any responses.')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Rows audited: ${rows.length}`)
  lines.push(`- Rows with warnings: ${rows.filter((row) => row.warningFlags.length > 0).length}`)
  lines.push(`- Families covered: ${[...new Set(rows.map((row) => row.cardFamily))].sort().join(', ')}`)
  lines.push('')
  lines.push('## Warning counts')
  lines.push('')
  lines.push('| Warning | Rows |')
  lines.push('|---|---:|')
  for (const flag of WARNING_FLAGS) {
    lines.push(`| ${flag} | ${warningCounts.get(flag) ?? 0} |`)
  }
  lines.push('')
  lines.push('## Warning rows')
  lines.push('')
  lines.push('| Family | Seed | Slot | Archetype | Choice | Warnings | Preview | Mechanical | Hidden delayed benefits | Hidden delayed risks | Expected effects |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const row of rows.filter((candidate) => candidate.warningFlags.length > 0)) {
    lines.push([
      row.cardFamily,
      row.seedId,
      row.responseSlotId,
      row.choiceContract?.archetype ?? '—',
      row.choiceLabel,
      row.warningFlags.join('<br>'),
      row.renderedPreviewEffects.join('<br>') || '—',
      row.renderedMechanicalEffects.join('<br>') || '—',
      compactEffects(row.hiddenDelayedBenefits),
      compactEffects(row.hiddenDelayedRisks),
      row.expectedEffects.join('<br>') || '—',
    ].map(escapeCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push('')
  lines.push('## All audited rows')
  lines.push('')
  lines.push('| Family | Issue | Seed | Slot | Shape | Archetype | Contract cost | Contract timing | Allowed verbs | Targets | Choice | Warnings | Immediate effects | Delayed effects | Visible effects | Cost effects | Benefit effects | Risk effects |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const row of rows) {
    lines.push([
      row.cardFamily,
      row.issueId,
      row.seedId,
      row.responseSlotId,
      row.responseShape,
      row.choiceContract?.archetype ?? '—',
      row.choiceContract?.costTypes?.join(', ') ?? '—',
      row.choiceContract?.payoffTiming ?? '—',
      row.allowedVerbs.join(', '),
      row.targetOptions.join(', ') || '—',
      row.choiceLabel,
      row.warningFlags.join('<br>') || '—',
      compactEffects(row.immediateEffects),
      compactEffects(row.delayedEffects),
      compactEffects(row.visiblePreviewEffects),
      compactEffects(row.costEffects),
      compactEffects(row.benefitEffects),
      compactEffects(row.riskEffects),
    ].map(escapeCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push('')
  return lines.join('\n')
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  const rows = buildRows()
  await writeFile(join(OUT_DIR, REPORT_JSON), JSON.stringify({ generatedBy: 'npm run audit:card-choices', rows }, null, 2))
  await writeFile(join(OUT_DIR, REPORT_MD), markdownReport(rows))
  console.log(`Wrote ${rows.length} card-choice audit row(s) to ${join(OUT_DIR, REPORT_MD)} and ${join(OUT_DIR, REPORT_JSON)}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
