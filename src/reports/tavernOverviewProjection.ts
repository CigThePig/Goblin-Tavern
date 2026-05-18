// Phase 92 — Tavern Overview projection.
//
// `buildTavernOverview(state)` is the single function the Tavern
// screen's five panels render against. Pure: same input → same
// TavernOverviewData. No DOM, no globals, no Math.random.
// Cards-contract §1 — the simulation is the source of truth; this
// projection resolves entity references to display labels and computes
// derived view-model fields but never invents data not already in
// state.
//
// Sub-panels: Areas, Stock (with Supply Pipeline), Recipes, Staff,
// Projects (with Policies + recent Social moves).

import { actionRegistry } from '../sim/registries/actionRegistry'
import { areaTraitRegistry } from '../sim/content/tavern/areaTraitRegistry'
import { areaUpgradeRegistry } from '../sim/content/tavern/areaUpgradeRegistry'
import { recipeRegistry } from '../sim/registries/recipeRegistry'
import { staffPriorityRegistry } from '../sim/registries/staffPriorityRegistry'
import { staffRegistry } from '../sim/registries/staffRegistry'
import { stockRegistry } from '../sim/registries/stockRegistry'
import { COMMISSION_EXPEDITION_ACTION_ID } from '../sim/modules/expeditions/commissionExpedition'
import {
  applicableActionsForTarget,
  actionDisabledReason,
  actionDisabledReasonForTarget,
  listValidTargets,
} from '../sim/modules/ownerActions/readonlyHelpers'
import { getOwnerActionsModuleState } from '../sim/modules/ownerActions/stateHelpers'
import { DEFAULT_ACTION_POINT_BUDGET as ACTION_POINT_BUDGET } from '../sim/modules/ownerActions/stateHelpers'
import { POLICY_STARTERS } from '../sim/modules/ownerActions/policyActions'
import { PROJECT_STARTERS } from '../sim/modules/ownerActions/projectActions'
import type { AreaConditionKey } from '../sim/content/text/descriptors'
import { pickAreaStateAdjective } from '../sim/content/text/descriptors'
import type { OwnerActionDefinition } from '../sim/modules/ownerActions/types'
import type {
  AreaState,
  AreaTraitId,
  AreaUpgradeId,
  ExpeditionRecord,
  HireableAdventurer,
  RecipeState,
  StaffState,
  StockState,
  TavernState,
} from '../sim/state/TavernState'

// ---------- Shared types ----------

export type TavernOverviewData = {
  areas: AreaPanelData
  stock: StockPanelData
  recipes: RecipePanelData
  staff: StaffPanelData
  projects: ProjectPanelData
}

export type ApplicableActionRef = {
  actionId: string
  label: string
  category: 'immediate' | 'project' | 'policy' | 'social'
  actionPointCost: number
  /** Reason the action can't run against this (action, target) pair right now. Undefined when selectable. */
  disabledReason?: string
}

// ---------- Areas ----------

export type AreaPanelData = {
  rows: AreaRow[]
}

export type AreaRow = {
  id: string
  label: string
  condition: number
  cleanliness: number
  mess: number
  damage: number
  smell: number
  risk: number
  /** Which non-condition meter is worst (highest dirtiness/damage/smell/risk). */
  worstMeterKey: 'cleanliness' | 'damage' | 'smell' | 'risk' | 'mess'
  worstMeterValue: number
  /** Adjective-pool key matching the worst meter. */
  conditionAdjectiveKey: AreaConditionKey
  /** Deterministic adjective pick from the matching descriptor pool. */
  conditionAdjective: string
  traits: AreaTraitRow[]
  atmosphere: string[]
  upgrades: AreaUpgradeRow[]
  activeProblems: string[]
  recentMemoryCount: number
  applicableActions: ApplicableActionRef[]
}

export type AreaTraitRow = {
  id: AreaTraitId
  label: string
  description: string
  tags: string[]
}

export type AreaUpgradeRow = {
  id: AreaUpgradeId
  label: string
  description: string
  status: 'available' | 'in_progress' | 'installed' | 'damaged' | 'disabled'
  progress?: number
  buildDays?: number
  costCoin?: number
  installedAtDay?: number
}

// ---------- Stock + Supply Pipeline ----------

export type StockPanelData = {
  inventory: {
    rows: StockRow[]
    lowStockCount: number
    spoilingCount: number
  }
  supplyPipeline: SupplyPipelineData
}

export type StockRow = {
  id: string
  label: string
  quantity: number
  quality: number
  spoilage: number
  freshness: number
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  basePrice: number
  salePrice: number
  storageAreaId?: string
  storageAreaLabel?: string
  tags: string[]
  isLow: boolean
  isSpoiling: boolean
  applicableActions: ApplicableActionRef[]
}

export type SupplyPipelineData = {
  activeExpeditions: ActiveExpeditionRow[]
  hireableAdventurers: AdventurerRow[]
  recentCompletions: CompletedExpeditionRow[]
  canCommission: { eligible: boolean; reason?: string }
}

export type ActiveExpeditionRow = {
  id: string
  runnerId: string
  runnerName: string
  mode: 'open' | 'targeted'
  targetTier: 'uncommon' | 'rare' | 'legendary' | null
  targetIngredientId: string | null
  targetIngredientLabel?: string
  daysTotal: number
  daysElapsed: number
  daysRemaining: number
  costPaid: number
  progressFraction: number
}

export type AdventurerRow = {
  id: string
  name: string
  experience: number
  reliability: number
  relationship: number
  specialty: string | null
  wageBase: number
  daysSinceLastJob: number
  isBusy: boolean
  currentExpeditionId: string | null
}

export type CompletedExpeditionRow = {
  id: string
  runnerId: string
  runnerName: string
  resolvedDay: number
  outcome: 'success' | 'partial' | 'failure' | 'runner_lost'
  returnedIngredients: {
    ingredientId: string
    ingredientLabel: string
    quantity: number
    quality: number
  }[]
  daysSinceClose: number
}

// ---------- Recipes ----------

export type RecipePanelData = {
  onMenu: RecipeRow[]
  available: RecipeRow[]
}

export type RecipeRow = {
  id: string
  label: string
  onMenu: boolean
  tags: string[]
  inputs: {
    ingredientId: string
    ingredientLabel: string
    quantity: number
    available: number
  }[]
  prepDifficulty: number
  demandTier: 'common' | 'uncommon' | 'rare' | 'legendary'
  culturalTags: string[]
  timesServed: number
  daysSinceLastServed: number
  blocked: boolean
  blockedReason?: string
  applicableActions: ApplicableActionRef[]
}

// ---------- Staff ----------

export type StaffPanelData = {
  rows: StaffPanelRow[]
  unpaidCount: number
}

export type StaffPanelRow = {
  id: string
  name: string
  firstName?: string
  role: string
  roleLabel: string
  skill: number
  morale: number
  stress: number
  fatigue: number
  loyalty: number
  wage: number
  paidThisWeek: boolean
  currentPriority?: string
  currentPriorityLabel?: string
  allowedPriorities: { id: string; label: string }[]
  workStyle?: string
  stressResponse?: string
  personalityTags: string[]
  unavailable: boolean
  activeFlags: string[]
  applicableActions: ApplicableActionRef[]
}

// ---------- Projects + Policies + Social ----------

export type ProjectPanelData = {
  active: ProjectRow[]
  available: AvailableProjectRow[]
  policies: PolicyRow[]
  recentSocial: SocialActionRow[]
}

export type ProjectRow = {
  id: string
  projectType: string
  label: string
  targetType?: string
  targetId?: string
  targetLabel?: string
  startedAtDay: number
  daysElapsed: number
  progress: number
  requiredProgress: number
  progressFraction: number
  coinInvested: number
  status: 'active' | 'completed' | 'cancelled' | 'blocked'
  effectsPreview: string[]
  applicableActions: ApplicableActionRef[]
}

export type AvailableProjectRow = {
  actionId: string
  label: string
  targetType?: string
  validTargets: { id: string; label: string; hint?: string }[]
  initialCostCoin?: number
  requiredProgress?: number
  disabledReason?: string
}

export type PolicyRow = {
  id: string
  policyType: string
  label: string
  enabled: boolean
  startedAtDay: number
  daysActive: number
  targetType?: string
  targetId?: string
  targetLabel?: string
  effects: string[]
  tags: string[]
  toggleActionId?: string
  toggleActionLabel?: string
  toggleDisabledReason?: string
}

export type SocialActionRow = {
  id: string
  actionId: string
  actionLabel: string
  targetType: string
  targetId: string
  targetLabel: string
  day: number
  daysAgo: number
  outcome: 'improved' | 'worsened' | 'neutral'
  notes: string[]
}

// ---------- Implementation ----------

export function buildTavernOverview(state: TavernState): TavernOverviewData {
  return {
    areas: projectAreas(state),
    stock: projectStock(state),
    recipes: projectRecipes(state),
    staff: projectStaff(state),
    projects: projectProjects(state),
  }
}

// ---------- Areas ----------

function projectAreas(state: TavernState): AreaPanelData {
  const rows = Object.values(state.areas)
    .map((a) => projectAreaRow(state, a))
    .sort((a, b) => a.label.localeCompare(b.label))
  return { rows }
}

function projectAreaRow(state: TavernState, area: AreaState): AreaRow {
  const dirty = 100 - area.cleanliness
  const candidates: Array<{
    key: AreaRow['worstMeterKey']
    value: number
    adjective: AreaConditionKey
  }> = [
    { key: 'cleanliness', value: dirty, adjective: 'dirty' },
    { key: 'damage', value: area.damage, adjective: 'damaged' },
    { key: 'smell', value: area.smell, adjective: 'smelly' },
    { key: 'risk', value: area.risk, adjective: 'risky' },
    { key: 'mess', value: area.mess, adjective: 'dirty' },
  ]
  // Pick the highest-value meter. Stable order preserved by sort.
  candidates.sort((a, b) => b.value - a.value)
  const worst = candidates[0]!

  const conditionAdjectiveKey: AreaConditionKey =
    worst.value >= 25 ? worst.adjective : 'clean'
  const conditionAdjective = pickAreaStateAdjective(
    conditionAdjectiveKey,
    `tavern.${area.id}.${state.calendar.totalDaysElapsed}`,
  )

  const traits: AreaTraitRow[] = area.traits.map((traitId) => {
    const def = areaTraitRegistry.get(traitId)
    return {
      id: traitId,
      label: def?.label ?? traitId,
      description: def?.description ?? '',
      tags: def?.mechanicalTags ? [...def.mechanicalTags] : [],
    }
  })

  const upgrades: AreaUpgradeRow[] = Object.values(area.upgrades).map(
    (upgrade) => {
      const def = areaUpgradeRegistry.get(upgrade.id)
      const row: AreaUpgradeRow = {
        id: upgrade.id,
        label: def?.label ?? upgrade.id,
        description: def?.description ?? '',
        status: upgrade.status,
      }
      if (upgrade.progress !== undefined) row.progress = upgrade.progress
      if (def?.buildDays !== undefined) row.buildDays = def.buildDays
      if (def?.costCoin !== undefined) row.costCoin = def.costCoin
      if (upgrade.installedAtDay !== undefined) {
        row.installedAtDay = upgrade.installedAtDay
      }
      return row
    },
  )

  const recentMemoryCount = state.memories.filter((m) =>
    m.locations.some((loc) => loc.kind === 'area' && loc.id === area.id),
  ).length

  const applicableActions = applicableActionsForRow(state, 'area', area.id)

  return {
    id: area.id,
    label: area.label,
    condition: area.condition,
    cleanliness: area.cleanliness,
    mess: area.mess,
    damage: area.damage,
    smell: area.smell,
    risk: area.risk,
    worstMeterKey: worst.key,
    worstMeterValue: worst.value,
    conditionAdjectiveKey,
    conditionAdjective,
    traits,
    atmosphere: [...area.atmosphere],
    upgrades,
    activeProblems: [...area.activeProblems],
    recentMemoryCount,
    applicableActions,
  }
}

// ---------- Stock ----------

const LOW_QUANTITY_THRESHOLD = 5
const SPOILAGE_THRESHOLD = 40

function projectStock(state: TavernState): StockPanelData {
  const rows = Object.values(state.stock)
    .map((s) => projectStockRow(state, s))
    .sort((a, b) => a.label.localeCompare(b.label))
  const lowStockCount = rows.filter((r) => r.isLow).length
  const spoilingCount = rows.filter((r) => r.isSpoiling).length
  return {
    inventory: { rows, lowStockCount, spoilingCount },
    supplyPipeline: projectSupplyPipeline(state),
  }
}

function projectStockRow(state: TavernState, item: StockState): StockRow {
  const storageAreaLabel = item.storageAreaId
    ? state.areas[item.storageAreaId]?.label
    : undefined
  const freshness = Math.max(0, Math.min(100, 100 - item.spoilage))
  const applicableActions = applicableActionsForRow(state, 'stock', item.id)
  const row: StockRow = {
    id: item.id,
    label: item.label,
    quantity: item.quantity,
    quality: item.quality,
    spoilage: item.spoilage,
    freshness,
    rarity: item.rarity,
    basePrice: item.basePrice,
    salePrice: item.salePrice,
    tags: [...item.tags],
    isLow: item.quantity <= LOW_QUANTITY_THRESHOLD,
    isSpoiling: item.spoilage >= SPOILAGE_THRESHOLD,
    applicableActions,
  }
  if (item.storageAreaId !== undefined) row.storageAreaId = item.storageAreaId
  if (storageAreaLabel !== undefined) row.storageAreaLabel = storageAreaLabel
  return row
}

function projectSupplyPipeline(state: TavernState): SupplyPipelineData {
  const activeExpeditions: ActiveExpeditionRow[] = state.expeditions.active.map(
    (exp) => {
      const runner = state.world.hireableAdventurers[exp.runnerId]
      const runnerName = runner?.name.display ?? exp.runnerId
      const targetIngredientLabel = exp.targetIngredientId
        ? stockRegistry.get(exp.targetIngredientId)?.label
        : undefined
      const daysRemaining = Math.max(0, exp.daysTotal - exp.daysElapsed)
      const progressFraction =
        exp.daysTotal > 0
          ? Math.max(0, Math.min(1, exp.daysElapsed / exp.daysTotal))
          : 0
      const row: ActiveExpeditionRow = {
        id: exp.id,
        runnerId: exp.runnerId,
        runnerName,
        mode: exp.mode,
        targetTier: exp.targetTier,
        targetIngredientId: exp.targetIngredientId,
        daysTotal: exp.daysTotal,
        daysElapsed: exp.daysElapsed,
        daysRemaining,
        costPaid: exp.costPaid,
        progressFraction,
      }
      if (targetIngredientLabel !== undefined) {
        row.targetIngredientLabel = targetIngredientLabel
      }
      return row
    },
  )

  const hireableAdventurers: AdventurerRow[] = Object.values(
    state.world.hireableAdventurers,
  )
    .map((adv) => projectAdventurer(adv))
    .sort((a, b) => a.name.localeCompare(b.name))

  const recentCompletions: CompletedExpeditionRow[] = state.expeditions.completed
    .slice()
    .sort((a, b) => b.resolvedDay - a.resolvedDay)
    .slice(0, 8)
    .map((rec) => projectCompleted(state, rec))

  const commissionDef = actionRegistry.get(COMMISSION_EXPEDITION_ACTION_ID)
  let canCommission: SupplyPipelineData['canCommission'] = { eligible: true }
  if (commissionDef) {
    const reason = actionDisabledReason(commissionDef, state, ACTION_POINT_BUDGET)
    canCommission = reason ? { eligible: false, reason } : { eligible: true }
  } else {
    canCommission = { eligible: false, reason: 'commission action missing' }
  }

  return {
    activeExpeditions,
    hireableAdventurers,
    recentCompletions,
    canCommission,
  }
}

function projectAdventurer(adv: HireableAdventurer): AdventurerRow {
  return {
    id: adv.id,
    name: adv.name.display,
    experience: adv.experience,
    reliability: adv.reliability,
    relationship: adv.relationship,
    specialty: adv.specialty,
    wageBase: adv.wageBase,
    daysSinceLastJob: adv.daysSinceLastJob,
    isBusy: adv.currentExpeditionId !== null,
    currentExpeditionId: adv.currentExpeditionId,
  }
}

function projectCompleted(
  state: TavernState,
  rec: ExpeditionRecord,
): CompletedExpeditionRow {
  const runner = state.world.hireableAdventurers[rec.runnerId]
  const runnerName = runner?.name.display ?? rec.runnerId
  const daysSinceClose = Math.max(
    0,
    state.calendar.totalDaysElapsed - rec.resolvedDay,
  )
  return {
    id: rec.id,
    runnerId: rec.runnerId,
    runnerName,
    resolvedDay: rec.resolvedDay,
    outcome: rec.outcome,
    daysSinceClose,
    returnedIngredients: rec.returnedIngredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      ingredientLabel:
        stockRegistry.get(ing.ingredientId)?.label ?? ing.ingredientId,
      quantity: ing.quantity,
      quality: ing.quality,
    })),
  }
}

// ---------- Recipes ----------

function projectRecipes(state: TavernState): RecipePanelData {
  const rows = Object.values(state.recipes)
    .map((r) => projectRecipeRow(state, r))
    .sort((a, b) => a.label.localeCompare(b.label))
  return {
    onMenu: rows.filter((r) => r.onMenu),
    available: rows.filter((r) => !r.onMenu),
  }
}

function projectRecipeRow(state: TavernState, recipe: RecipeState): RecipeRow {
  const def = recipeRegistry.get(recipe.id)
  const inputs = (def?.inputs ?? []).map((input) => ({
    ingredientId: input.ingredientId,
    ingredientLabel:
      state.stock[input.ingredientId]?.label ??
      stockRegistry.get(input.ingredientId)?.label ??
      input.ingredientId,
    quantity: input.quantity,
    available: state.stock[input.ingredientId]?.quantity ?? 0,
  }))

  let blocked = false
  let blockedReason: string | undefined
  for (const input of inputs) {
    if (input.available < input.quantity) {
      blocked = true
      blockedReason = `out of ${input.ingredientLabel}`
      break
    }
  }

  const applicableActions = applicableActionsForRow(state, 'recipe', recipe.id)

  const row: RecipeRow = {
    id: recipe.id,
    label: recipe.label,
    onMenu: recipe.onMenu,
    tags: [...recipe.tags],
    inputs,
    prepDifficulty: def?.prepDifficulty ?? 0,
    demandTier: def?.demandTier ?? 'common',
    culturalTags: def?.culturalTags ? [...def.culturalTags] : [],
    timesServed: recipe.timesServed,
    daysSinceLastServed: recipe.daysSinceLastServed,
    blocked,
    applicableActions,
  }
  if (blockedReason !== undefined) row.blockedReason = blockedReason
  return row
}

// ---------- Staff ----------

function projectStaff(state: TavernState): StaffPanelData {
  const rows = Object.values(state.staff)
    .map((s) => projectStaffRow(state, s))
    .sort((a, b) => a.name.localeCompare(b.name))
  const unpaidCount = rows.filter((r) => !r.paidThisWeek).length
  return { rows, unpaidCount }
}

function projectStaffRow(state: TavernState, staff: StaffState): StaffPanelRow {
  const def = staffRegistry.get(staff.role)
  const roleLabel = def?.label ?? staff.role
  const allowedPriorities = (def?.allowedPriorities ?? []).map((priorityId) => {
    const pdef = staffPriorityRegistry.get(priorityId)
    return { id: priorityId, label: pdef?.label ?? priorityId }
  })
  const currentPriorityLabel = staff.currentPriority
    ? staffPriorityRegistry.get(staff.currentPriority)?.label
    : undefined
  const applicableActions = applicableActionsForRow(state, 'staff', staff.id)

  const row: StaffPanelRow = {
    id: staff.id,
    name: staff.name.display,
    role: staff.role,
    roleLabel,
    skill: staff.skill,
    morale: staff.morale,
    stress: staff.stress,
    fatigue: staff.fatigue,
    loyalty: staff.loyalty,
    wage: staff.wage,
    paidThisWeek: staff.paidThisWeek,
    allowedPriorities,
    personalityTags: staff.identity?.personalityTags
      ? [...staff.identity.personalityTags]
      : [],
    unavailable: staff.unavailable === true,
    activeFlags: [...staff.activeFlags],
    applicableActions,
  }
  if (staff.name.parts.given) row.firstName = staff.name.parts.given
  if (staff.currentPriority !== undefined) {
    row.currentPriority = staff.currentPriority
  }
  if (currentPriorityLabel !== undefined) {
    row.currentPriorityLabel = currentPriorityLabel
  }
  if (staff.identity?.workStyle) row.workStyle = staff.identity.workStyle
  if (staff.identity?.stressResponse) {
    row.stressResponse = staff.identity.stressResponse
  }
  return row
}

// ---------- Projects + Policies + Social ----------

function projectProjects(state: TavernState): ProjectPanelData {
  const slice = getOwnerActionsModuleState(state)
  const today = state.calendar.totalDaysElapsed

  const active: ProjectRow[] = Object.values(slice.projects)
    .filter((p) => p.status === 'active' || p.status === 'blocked')
    .sort((a, b) => a.startedAtDay - b.startedAtDay)
    .map((p) => projectProjectRow(state, p, today))

  const startedTypes = new Set(
    Object.values(slice.projects)
      .filter((p) => p.status === 'active')
      .map((p) => p.projectType),
  )

  const available: AvailableProjectRow[] = PROJECT_STARTERS.filter(
    (starter) => !startedTypes.has(starter.projectType),
  ).map((starter) => projectAvailableProject(state, starter))

  const policies: PolicyRow[] = projectPolicies(state, slice, today)

  const recentSocial: SocialActionRow[] = slice.recentSocialActions
    .slice(0, 10)
    .map((r) => projectSocialRow(state, r, today))

  return { active, available, policies, recentSocial }
}

function projectProjectRow(
  state: TavernState,
  project: NonNullable<
    ReturnType<typeof getOwnerActionsModuleState>['projects'][string]
  >,
  today: number,
): ProjectRow {
  const required = Math.max(project.requiredProgress, 1)
  const progressFraction = Math.max(0, Math.min(1, project.progress / required))
  const daysElapsed = Math.max(0, today - project.startedAtDay)
  const targetLabel = resolveTargetLabel(state, project.targetType, project.targetId)

  const fundDef = actionRegistry.get('fund_active_project')
  const cancelDef = actionRegistry.get('cancel_project')
  const applicableActions: ApplicableActionRef[] = []
  if (fundDef) {
    const reason = actionDisabledReasonForTarget(
      fundDef,
      state,
      project.id,
      ACTION_POINT_BUDGET,
    )
    applicableActions.push(makeRef(fundDef, reason))
  }
  if (cancelDef) {
    const reason = actionDisabledReasonForTarget(
      cancelDef,
      state,
      project.id,
      ACTION_POINT_BUDGET,
    )
    applicableActions.push(makeRef(cancelDef, reason))
  }

  const row: ProjectRow = {
    id: project.id,
    projectType: project.projectType,
    label: project.label,
    startedAtDay: project.startedAtDay,
    daysElapsed,
    progress: project.progress,
    requiredProgress: project.requiredProgress,
    progressFraction,
    coinInvested: project.coinInvested,
    status: project.status,
    effectsPreview: [...project.effectsPreview],
    applicableActions,
  }
  if (project.targetType !== undefined) row.targetType = project.targetType
  if (project.targetId !== undefined) row.targetId = project.targetId
  if (targetLabel !== undefined) row.targetLabel = targetLabel
  return row
}

function projectAvailableProject(
  state: TavernState,
  starter: (typeof PROJECT_STARTERS)[number],
): AvailableProjectRow {
  const def = actionRegistry.get(starter.id)
  const validTargets = def ? listValidTargets(def, state) : []
  const disabledReason = def
    ? actionDisabledReason(def, state, ACTION_POINT_BUDGET)
    : 'unknown action'
  const row: AvailableProjectRow = {
    actionId: starter.id,
    label: starter.label,
    validTargets: validTargets.map((t) => {
      const target: { id: string; label: string; hint?: string } = {
        id: t.id,
        label: t.label,
      }
      if (t.hint !== undefined) target.hint = t.hint
      return target
    }),
    initialCostCoin: starter.initialCoinCost,
    requiredProgress: starter.requiredProgress,
  }
  if (def?.targetType !== undefined) row.targetType = def.targetType
  if (disabledReason !== undefined) row.disabledReason = disabledReason
  return row
}

function projectPolicies(
  state: TavernState,
  slice: ReturnType<typeof getOwnerActionsModuleState>,
  today: number,
): PolicyRow[] {
  // Surface every starter policy. Enabled ones merge in the state
  // record's `startedAtDay`; un-enabled ones get a default
  // "not enabled" state so the player sees the full catalog with
  // toggle affordances.
  return POLICY_STARTERS.map((starter) => {
    const existing = slice.policies[starter.id]
    const enabled = existing?.enabled ?? false
    const startedAtDay = existing?.startedAtDay ?? 0
    const daysActive = enabled ? Math.max(0, today - startedAtDay) : 0
    const toggleActionId = enabled
      ? `disable_${starter.policyType}`
      : `enable_${starter.policyType}`
    const toggleDef = actionRegistry.get(toggleActionId)
    const toggleActionLabel = toggleDef?.label
    const toggleDisabledReason = toggleDef
      ? actionDisabledReason(toggleDef, state, ACTION_POINT_BUDGET)
      : 'toggle action missing'

    const row: PolicyRow = {
      id: starter.id,
      policyType: starter.policyType,
      label: starter.label,
      enabled,
      startedAtDay,
      daysActive,
      effects: [...starter.effects],
      tags: [...starter.tags],
    }
    if (existing?.targetType !== undefined) row.targetType = existing.targetType
    if (existing?.targetId !== undefined) row.targetId = existing.targetId
    const targetLabel = existing
      ? resolveTargetLabel(state, existing.targetType, existing.targetId)
      : undefined
    if (targetLabel !== undefined) row.targetLabel = targetLabel
    if (toggleDef) row.toggleActionId = toggleActionId
    if (toggleActionLabel !== undefined) {
      row.toggleActionLabel = toggleActionLabel
    }
    if (toggleDisabledReason !== undefined) {
      row.toggleDisabledReason = toggleDisabledReason
    }
    return row
  })
}

function projectSocialRow(
  state: TavernState,
  rec: ReturnType<typeof getOwnerActionsModuleState>['recentSocialActions'][number],
  today: number,
): SocialActionRow {
  const def = actionRegistry.get(rec.actionId)
  const actionLabel = def?.label ?? rec.actionId
  const targetLabel =
    resolveTargetLabel(state, rec.targetType, rec.targetId) ?? rec.targetId
  return {
    id: rec.id,
    actionId: rec.actionId,
    actionLabel,
    targetType: rec.targetType,
    targetId: rec.targetId,
    targetLabel,
    day: rec.day,
    daysAgo: Math.max(0, today - rec.day),
    outcome: rec.outcome,
    notes: [...rec.notes],
  }
}

// ---------- Shared helpers ----------

function applicableActionsForRow(
  state: TavernState,
  targetType: OwnerActionDefinition['targetType'],
  targetId: string,
): ApplicableActionRef[] {
  return applicableActionsForTarget(state, targetType, targetId).map((def) => {
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      targetId,
      ACTION_POINT_BUDGET,
    )
    return makeRef(def, reason)
  })
}

function makeRef(
  def: OwnerActionDefinition,
  disabledReason: string | undefined,
): ApplicableActionRef {
  const ref: ApplicableActionRef = {
    actionId: def.id,
    label: def.label,
    category: def.category,
    actionPointCost: def.actionPointCost,
  }
  if (disabledReason !== undefined) ref.disabledReason = disabledReason
  return ref
}

function resolveTargetLabel(
  state: TavernState,
  targetType: string | undefined,
  targetId: string | undefined,
): string | undefined {
  if (!targetType || !targetId) return undefined
  switch (targetType) {
    case 'area':
      return state.areas[targetId]?.label
    case 'stock':
      return state.stock[targetId]?.label
    case 'staff':
      return state.staff[targetId]?.name.display
    case 'recipe':
      return state.recipes[targetId]?.label
    case 'customer_group':
      return state.customerGroups[targetId]?.label
    case 'regular':
      return state.world.regulars[targetId]?.name?.display
    case 'supplier':
      return (
        state.world.suppliers[targetId]?.name?.display ??
        state.world.suppliers[targetId]?.label
      )
    case 'faction':
      return state.world.factions[targetId]?.label
    case 'project': {
      const slice = getOwnerActionsModuleState(state)
      return slice.projects[targetId]?.label
    }
    case 'policy': {
      const slice = getOwnerActionsModuleState(state)
      return slice.policies[targetId]?.label
    }
    default:
      return undefined
  }
}
