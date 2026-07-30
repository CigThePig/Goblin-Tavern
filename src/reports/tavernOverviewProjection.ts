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
import { getStaffModuleState } from '../sim/modules/staff/workforceState'
import { listApplicants } from '../sim/modules/staff/laborMarket'
import { stockRegistry } from '../sim/registries/stockRegistry'
import { COMMISSION_EXPEDITION_ACTION_ID } from '../sim/modules/expeditions/commissionExpedition'
import {
  applicableActionsForTarget,
  actionDisabledReason,
  actionDisabledReasonForTarget,
  listValidTargets,
} from '../sim/modules/ownerActions/readonlyHelpers'
import { getOwnerActionsModuleState } from '../sim/modules/ownerActions/stateHelpers'
import {
  DAY_MINUTES,
  TIME_COST_SHORT,
  TIME_COST_STANDARD,
} from '../sim/modules/ownerActions/stateHelpers'
// Expansion Phase 2 §2.1 / §2.2 — the projection reads the areas module's own
// capacity and quote helpers rather than re-deriving either. Recomputing a
// quote in the projection is precisely how the number shown and the number
// charged drift apart.
import {
  getAreaBlockedFraction,
  getBaseAreaCapacity,
  getInstalledAreaCapacity,
  getUsableAreaCapacity,
} from '../sim/modules/areas/capacity'
import {
  checkUpgradeEligibility,
  listCatalogueForArea,
  quoteAreaUpgrade,
  type AreaUpgradeQuote,
} from '../sim/modules/areas/quote'
import { getMaxConcurrentSites, listActiveSites } from '../sim/modules/areas/labour'
import { getSiteLabourPerDay } from '../sim/modules/areas/schedule'
import { getAreasModuleState } from '../sim/modules/areas/state'
import { AREA_CAPACITY_KINDS } from '../sim/registries/areaCapacityTypes'
import { POLICY_STARTERS } from '../sim/modules/ownerActions/policyActions'
import { idLabel } from './labels/idLabel'
import { humanizeActionReason } from './labels/actionReason'
import { PROJECT_STARTERS } from '../sim/modules/ownerActions/projectActions'
import type { AreaConditionKey } from '../sim/content/text/descriptors'
import { pickAreaStateAdjective } from '../sim/content/text/descriptors'
import type { OwnerActionDefinition } from '../sim/modules/ownerActions/types'
import type {
  AreaState,
  AreaTraitId,
  AreaUpgradeId,
  AreaUpgradeStatus,
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
  timeCost: number
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
  /** Expansion Phase 2 §2.1 — seats / workstations / storage / beds. */
  capacity: AreaCapacityRow[]
  /** Share of the room out of use right now, as a percentage. */
  blockedPercent: number
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
  status: AreaUpgradeStatus
  progress?: number
  buildDays?: number
  costCoin?: number
  installedAtDay?: number
  // ---- Expansion Phase 2 §"Player-facing work" ----
  /** Labour the accepted quote asked for; the denominator of `progress`. */
  requiredProgress?: number
  /** Why the site made no progress on its last tick. */
  stalledReason?: string
  /** Condition of the installed fitting, 0–100. */
  condition?: number
  /** Day upkeep falls due. Negative `upkeepOverdueDays` means not yet due. */
  upkeepDueDay?: number
  upkeepOverdueDays?: number
  /** Always present when the fitting is `disabled` or `cancelled`. */
  disabledReason?: string
  /** The live quote, when this upgrade can be started here. */
  quote?: AreaUpgradeQuoteRow
  /** The specific reason this upgrade cannot be started here, when it cannot. */
  blockedReason?: string
}

/**
 * Expansion Phase 2 §2.2 — the quote, projected verbatim from
 * `quoteAreaUpgrade`.
 *
 * The projection does not recompute a single number: the row the player reads
 * and the charge the sim applies come from the same call, which is what the
 * "quote and authoritative cost agreement" requirement means in practice.
 */
export type AreaUpgradeQuoteRow = {
  coin: number
  labourRequired: number
  labourPerDay: number
  /** `null` when nothing is working the site, so no honest estimate exists. */
  expectedDays: number | null
  quotedBuildDays: number
  ownerMinutes: number
  materials: Array<{
    stockId: string
    label: string
    required: number
    held: number
    short: number
  }>
  capacityEffects: Array<{ kind: string; amount: number }>
  blocksPercentWhileBuilding: number
  upkeep?: { intervalDays: number; coin: number }
  repairCoin: number
  /** Display label of the upgrade this one retires, never its raw id. */
  replacesLabel?: string
  affordable: boolean
  affordabilityReason?: string
}

/** Expansion Phase 2 §2.1 — the physical facts an area sheet now shows. */
export type AreaCapacityRow = {
  kind: string
  total: number
  usable: number
  fromFittings: number
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
  /**
   * Phase 117 — true when this stock item is referenced by at least
   * one `upkeep`-tagged recipe (firewood, mugs, raw ingredients).
   * Lets the Stock panel surface a "used for upkeep" hint so players
   * understand why the quantity drops without re-introducing the
   * recipe to the Recipes menu.
   */
  isUpkeepConsumed: boolean
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
  /**
   * Expansion Phase 3 — the hiring half of the staff picture.
   *
   * `hire_staff` stopped taking a role and started taking a PERSON off a board
   * that refreshes weekly and expires. That board had no surface here at all:
   * the roster listed who you already employ, and the panel's empty state told
   * the player to hire from the World screen's adventurer list, which has
   * nothing to do with staff. The only route left was the action picker's target
   * sub-sheet — findable only if you already knew hiring had moved. So the board
   * and the open vacancies are projected alongside the roster, each applicant
   * carrying the same `hire_staff` ref every other row-level action uses.
   */
  hiring: StaffHiringData
}

export type StaffHiringData = {
  applicants: StaffApplicantRow[]
  vacancies: StaffVacancyRow[]
  /** Set when the board is empty, saying when it will next be worth a look. */
  emptyReason?: string
}

export type StaffApplicantRow = {
  id: string
  name: string
  roleId: string
  roleLabel: string
  skill: number
  wageAsk: number
  provenance: string
  /** Days left before they take work elsewhere. */
  daysLeft: number
  /** True when they came in answer to a vacancy the tavern posted. */
  answersVacancy: boolean
  readable: string
  applicableActions: ApplicableActionRef[]
}

export type StaffVacancyRow = {
  roleId: string
  roleLabel: string
  reason: string
  openDays: number
  /** How short that role is on today's rota, if at all. */
  coverageGap: number
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
  /**
   * Expansion Phase 2 §"Player-facing work" — the construction planner.
   *
   * The five legacy project starters are retired (they duplicated upgrade
   * definitions), so `available` is empty until a genuine non-upgrade project
   * exists. This section is where building actually happens now: every live
   * site with its progress and stall reason, every startable upgrade with its
   * quote, and the schedule's conflicts.
   */
  construction: ConstructionPanelData
}

export type ConstructionPanelData = {
  sites: ConstructionSiteRow[]
  buildable: BuildableUpgradeRow[]
  /** Blocks the day's schedule could not place, with the reason. */
  conflicts: Array<{ label: string; reason: string }>
  activeSites: number
  maxConcurrentSites: number
  /** Fittings that are broken or overdue for service. */
  attention: FittingAttentionRow[]
}

export type ConstructionSiteRow = {
  areaId: string
  areaLabel: string
  upgradeId: string
  label: string
  status: 'in_progress' | 'paused'
  progress: number
  requiredProgress: number
  progressFraction: number
  labourPerDay: number
  /** `null` when nothing is working the site. */
  expectedDaysRemaining: number | null
  stalledReason?: string
  startedAtDay: number
  coinInvested: number
  blocksPercentWhileBuilding: number
  applicableActions: ApplicableActionRef[]
}

export type BuildableUpgradeRow = {
  areaId: string
  areaLabel: string
  upgradeId: string
  label: string
  description: string
  quote: AreaUpgradeQuoteRow
  applicableActions: ApplicableActionRef[]
}

export type FittingAttentionRow = {
  areaId: string
  areaLabel: string
  upgradeId: string
  label: string
  status: AreaUpgradeStatus
  condition: number
  /** Positive when service is late. */
  upkeepOverdueDays: number
  reason: string
  applicableActions: ApplicableActionRef[]
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
      // Phase 204 / audit Wave 5 (`P6-COMP-007`) — these are engine hooks
      // (`cleanliness_negative`, `merchant_sensitive`), and the detail
      // sheet rendered them verbatim. The tag ids stay what they are in
      // the registry; the projection names them for the player.
      tags: def?.mechanicalTags
        ? def.mechanicalTags.map((tag) => idLabel('mechanicalTag', tag))
        : [],
    }
  })

  // Expansion Phase 2 §"Player-facing work" — the area sheet lists the whole
  // catalogue for this room, not only the records that already exist. Before
  // this phase every record was `available` and nothing could be started, so
  // "what could I build here, and why can't I?" had no surface at all.
  const upgrades: AreaUpgradeRow[] = buildAreaUpgradeRows(state, area)

  const capacity: AreaCapacityRow[] = buildAreaCapacityRows(area)
  const blockedPercent = Math.round(getAreaBlockedFraction(area) * 100)

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
    // Phase 204 / audit Wave 5 (`P6-COMP-007`) — atmosphere tags are
    // stored as ids (`lived_in`) and rendered as a chip row on the area
    // sheet, directly under the "Atmosphere" glossary link. Named here so
    // the chip reads as a word; the stored tag is untouched.
    atmosphere: area.atmosphere.map((tag) => idLabel('mechanicalTag', tag)),
    upgrades,
    capacity,
    blockedPercent,
    activeProblems: [...area.activeProblems],
    recentMemoryCount,
    applicableActions,
  }
}

/**
 * One row per catalogue entry this room allows, plus any record it already
 * carries. Sorted so installed fittings and live builds read first — the things
 * the player owns before the things they might buy.
 */
function buildAreaUpgradeRows(
  state: TavernState,
  area: AreaState,
): AreaUpgradeRow[] {
  const today = state.calendar.totalDaysElapsed
  const ids = new Set<string>(Object.keys(area.upgrades))
  for (const def of listCatalogueForArea(area)) ids.add(def.id)

  const rows: AreaUpgradeRow[] = []
  for (const id of [...ids].sort()) {
    const def = areaUpgradeRegistry.has(id) ? areaUpgradeRegistry.get(id) : undefined
    const record = area.upgrades[id]
    const row: AreaUpgradeRow = {
      id,
      label: def?.label ?? id,
      description: def?.description ?? '',
      status: record?.status ?? 'available',
    }
    if (record?.progress !== undefined) row.progress = record.progress
    if (record?.requiredProgress !== undefined) {
      row.requiredProgress = record.requiredProgress
    }
    if (record?.stalledReason !== undefined) row.stalledReason = record.stalledReason
    if (record?.condition !== undefined) row.condition = record.condition
    if (record?.upkeepDueDay !== undefined) {
      row.upkeepDueDay = record.upkeepDueDay
      row.upkeepOverdueDays = today - record.upkeepDueDay
    }
    if (record?.disabledReason !== undefined) {
      row.disabledReason = record.disabledReason
    }
    if (def?.buildDays !== undefined) row.buildDays = def.buildDays
    if (def?.costCoin !== undefined) row.costCoin = def.costCoin
    if (record?.installedAtDay !== undefined) {
      row.installedAtDay = record.installedAtDay
    }

    const eligibility = checkUpgradeEligibility(state, area.id, id)
    if (eligibility.ok) {
      const quote = quoteAreaUpgrade(state, area.id, id, {
        startMinutes: TIME_COST_STANDARD,
        fundMinutes: TIME_COST_SHORT,
      })
      if (quote) row.quote = projectQuote(quote)
    } else {
      row.blockedReason = eligibility.reason
    }
    rows.push(row)
  }

  const rank = (status: AreaUpgradeStatus): number => {
    switch (status) {
      case 'in_progress':
        return 0
      case 'paused':
        return 1
      case 'damaged':
      case 'disabled':
        return 2
      case 'installed':
        return 3
      case 'available':
        return 4
      default:
        return 5
    }
  }
  return rows.sort(
    (a, b) => rank(a.status) - rank(b.status) || a.label.localeCompare(b.label),
  )
}

function projectQuote(quote: AreaUpgradeQuote): AreaUpgradeQuoteRow {
  return {
    coin: quote.coin,
    labourRequired: quote.labourRequired,
    labourPerDay: quote.labourPerDay,
    expectedDays: Number.isFinite(quote.expectedDays) ? quote.expectedDays : null,
    quotedBuildDays: quote.quotedBuildDays,
    ownerMinutes: quote.ownerMinutes,
    materials: quote.materials.map((line) => ({
      stockId: line.stockId,
      label: line.label,
      required: line.required,
      held: line.held,
      short: Math.max(0, line.required - line.held),
    })),
    capacityEffects: Object.entries(quote.capacityEffects).map(([kind, amount]) => ({
      kind,
      amount: amount ?? 0,
    })),
    blocksPercentWhileBuilding: Math.round(quote.blocksCapacityWhileBuilding * 100),
    ...(quote.maintenance
      ? {
          upkeep: {
            intervalDays: quote.maintenance.intervalDays,
            coin: quote.maintenance.coin,
          },
        }
      : {}),
    repairCoin: quote.repairCoin,
    ...(quote.replaces && areaUpgradeRegistry.has(quote.replaces)
      ? { replacesLabel: areaUpgradeRegistry.get(quote.replaces).label }
      : {}),
    affordable: quote.affordability.ok,
    ...(quote.affordability.ok
      ? {}
      : { affordabilityReason: quote.affordability.reason }),
  }
}

function buildAreaCapacityRows(area: AreaState): AreaCapacityRow[] {
  const base = getBaseAreaCapacity(area.id)
  const installed = getInstalledAreaCapacity(area)
  const usable = getUsableAreaCapacity(area)
  const rows: AreaCapacityRow[] = []
  for (const kind of AREA_CAPACITY_KINDS) {
    const total = installed[kind] ?? 0
    if (total === 0) continue
    rows.push({
      kind,
      total,
      usable: usable[kind] ?? 0,
      fromFittings: total - (base[kind] ?? 0),
    })
  }
  return rows
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
    isUpkeepConsumed: stockConsumedByUpkeep(item.id),
    applicableActions,
  }
  if (item.storageAreaId !== undefined) row.storageAreaId = item.storageAreaId
  if (storageAreaLabel !== undefined) row.storageAreaLabel = storageAreaLabel
  return row
}

/**
 * Phase 117 — true if at least one `upkeep`-tagged recipe consumes
 * the given stock id. Used by `StockPanel.svelte` to render a "used
 * for upkeep" hint on firewood/mug rows so the daily quantity drop
 * is legible without re-introducing the recipe to the Recipes menu.
 */
function stockConsumedByUpkeep(stockId: string): boolean {
  for (const def of recipeRegistry.all()) {
    if (!def.tags.includes('upkeep')) continue
    if (def.inputs.some((input) => input.ingredientId === stockId)) {
      return true
    }
  }
  return false
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
    const reason = actionDisabledReason(commissionDef, state, DAY_MINUTES)
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
  // Phase 117 — `upkeep`-tagged recipes (firewood, mugs, raw
  // ingredient consumption) are simulation-side consumption pipelines,
  // not player-facing menu choices. Filter them out of both lists so
  // the Recipes panel only shows dishes a customer might order. The
  // recipe instances stay in state and the service module still
  // resolves them if explicitly referenced.
  const rows = Object.values(state.recipes)
    .filter((r) => !isUpkeepRecipe(r.id))
    .map((r) => projectRecipeRow(state, r))
    .sort((a, b) => a.label.localeCompare(b.label))
  return {
    onMenu: rows.filter((r) => r.onMenu),
    available: rows.filter((r) => !r.onMenu),
  }
}

function isUpkeepRecipe(recipeId: string): boolean {
  if (!recipeRegistry.has(recipeId)) return false
  return recipeRegistry.get(recipeId).tags.includes('upkeep')
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
  return { rows, unpaidCount, hiring: projectHiring(state) }
}

function projectHiring(state: TavernState): StaffHiringData {
  const slice = getStaffModuleState(state)
  const today = state.calendar.totalDaysElapsed
  const coverage = new Map(slice.coverage.map((row) => [row.roleId, row.gap]))

  const applicants: StaffApplicantRow[] = listApplicants(state).map(
    (applicant) => ({
      id: applicant.id,
      name: applicant.name.display,
      roleId: applicant.roleId,
      roleLabel: staffRegistry.has(applicant.roleId)
        ? staffRegistry.get(applicant.roleId).label
        : applicant.roleId,
      skill: applicant.skill,
      wageAsk: applicant.wageAsk,
      provenance: applicant.provenance.replace(/_/g, ' '),
      daysLeft: Math.max(0, applicant.availableUntilDay - today),
      answersVacancy: applicant.answersVacancyForRole !== undefined,
      readable: applicant.readable,
      applicableActions: applicableActionsForRow(state, 'staff', applicant.id),
    }),
  )

  const vacancies: StaffVacancyRow[] = slice.laborMarket.vacancies.map(
    (vacancy) => ({
      roleId: vacancy.roleId,
      roleLabel: staffRegistry.has(vacancy.roleId)
        ? staffRegistry.get(vacancy.roleId).label
        : vacancy.roleId,
      reason: vacancy.reason,
      openDays: Math.max(0, today - vacancy.openedOnDay),
      coverageGap: coverage.get(vacancy.roleId) ?? 0,
    }),
  )

  const data: StaffHiringData = { applicants, vacancies }
  if (applicants.length === 0) {
    // The board is generated on the first morning and refreshed weekly, so an
    // empty one on day zero is "not yet", not "never". Saying which it is keeps
    // the player from concluding that hiring is gone.
    data.emptyReason =
      today === 0
        ? 'Word has not gone round yet — the board fills once you open.'
        : 'Nobody is looking for work at the moment. The board refreshes weekly, and a vacancy always draws somebody.'
  }
  return data
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

  return {
    active,
    available,
    policies,
    recentSocial,
    construction: projectConstruction(state),
  }
}

/**
 * Expansion Phase 2 §"Player-facing work" — the construction planner.
 *
 * Everything here is read from the areas module's own helpers. The projection
 * decides ORDER and WORDING; it never decides a cost, an eligibility or a
 * completion horizon.
 */
function projectConstruction(state: TavernState): ConstructionPanelData {
  const today = state.calendar.totalDaysElapsed
  const schedule = getAreasModuleState(state).schedule

  const sites: ConstructionSiteRow[] = []
  const buildable: BuildableUpgradeRow[] = []
  const attention: FittingAttentionRow[] = []

  for (const area of Object.values(state.areas).sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const labourPerDay = getSiteLabourPerDay(state, area.id)

    for (const record of Object.values(area.upgrades).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const def = areaUpgradeRegistry.has(record.id)
        ? areaUpgradeRegistry.get(record.id)
        : undefined
      const label = def?.label ?? record.id
      const targetId = `${area.id}:${record.id}`

      if (record.status === 'in_progress' || record.status === 'paused') {
        const required = Math.max(1, record.requiredProgress ?? 1)
        const progress = record.progress ?? 0
        const remaining = Math.max(0, required - progress)
        const row: ConstructionSiteRow = {
          areaId: area.id,
          areaLabel: area.label,
          upgradeId: record.id,
          label,
          status: record.status,
          progress,
          requiredProgress: required,
          progressFraction: Math.max(0, Math.min(1, progress / required)),
          labourPerDay,
          expectedDaysRemaining:
            record.status === 'paused' || labourPerDay <= 0
              ? null
              : Math.ceil(remaining / labourPerDay),
          startedAtDay: record.startedAtDay ?? today,
          coinInvested: record.coinInvested ?? 0,
          blocksPercentWhileBuilding: Math.round(
            (def?.blocksCapacityWhileBuilding ?? 0) * 100,
          ),
          applicableActions: upgradeActionRefs(state, targetId, [
            'fund_area_upgrade',
            'pause_area_upgrade',
            'resume_area_upgrade',
            'cancel_area_upgrade',
          ]),
        }
        if (record.stalledReason !== undefined) row.stalledReason = record.stalledReason
        sites.push(row)
        continue
      }

      const broken = record.status === 'damaged' || record.status === 'disabled'
      const overdue =
        record.upkeepDueDay !== undefined ? today - record.upkeepDueDay : 0
      if (broken || overdue > 0) {
        attention.push({
          areaId: area.id,
          areaLabel: area.label,
          upgradeId: record.id,
          label,
          status: record.status,
          condition: record.condition ?? 100,
          upkeepOverdueDays: overdue,
          reason: broken
            ? (record.disabledReason ?? `${label} is out of service`)
            : `Service is ${overdue} day${overdue === 1 ? '' : 's'} overdue`,
          applicableActions: upgradeActionRefs(state, targetId, [
            'repair_area_upgrade',
            'maintain_area_upgrade',
          ]),
        })
      }
    }

    for (const def of listCatalogueForArea(area)) {
      if (!checkUpgradeEligibility(state, area.id, def.id).ok) continue
      const quote = quoteAreaUpgrade(state, area.id, def.id, {
        startMinutes: TIME_COST_STANDARD,
        fundMinutes: TIME_COST_SHORT,
      })
      if (!quote) continue
      buildable.push({
        areaId: area.id,
        areaLabel: area.label,
        upgradeId: def.id,
        label: def.label,
        description: def.description,
        quote: projectQuote(quote),
        applicableActions: upgradeActionRefs(state, `${area.id}:${def.id}`, [
          'start_area_upgrade',
        ]),
      })
    }
  }

  // Affordable first, then cheapest: the planner leads with what the player can
  // actually do today.
  buildable.sort(
    (a, b) =>
      Number(b.quote.affordable) - Number(a.quote.affordable) ||
      a.quote.coin - b.quote.coin ||
      a.label.localeCompare(b.label),
  )

  return {
    sites,
    buildable,
    conflicts: schedule
      .filter((block) => block.status === 'conflicted')
      .map((block) => ({
        label: block.label,
        reason: block.conflictReason ?? 'blocked',
      })),
    activeSites: listActiveSites(state).length,
    maxConcurrentSites: getMaxConcurrentSites(state),
    attention,
  }
}

/** Action refs for a composite `<area>:<upgrade>` target, skipping unknown ids. */
function upgradeActionRefs(
  state: TavernState,
  targetId: string,
  actionIds: ReadonlyArray<string>,
): ApplicableActionRef[] {
  const refs: ApplicableActionRef[] = []
  for (const actionId of actionIds) {
    if (!actionRegistry.has(actionId)) continue
    const def = actionRegistry.get(actionId)
    const reason = actionDisabledReasonForTarget(def, state, targetId, DAY_MINUTES)
    // A ref whose action is simply wrong for this record's state (pausing an
    // already-paused build) is dropped rather than shown greyed out: the row
    // already says what state it is in.
    if (
      reason !== undefined &&
      /is (paused|installed|available|cancelled|in progress)/.test(reason)
    ) {
      continue
    }
    refs.push(makeRef(def, reason))
  }
  return refs
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

  // Expansion Phase 2 §2.2 — `fund_active_project` / `cancel_project` are
  // retired along with the five upgrade-building starters. A migrated save can
  // still carry a non-convertible project row, so the refs are looked up
  // defensively rather than assumed present (`Registry.get` throws).
  const fundDef = actionRegistry.has('fund_active_project')
    ? actionRegistry.get('fund_active_project')
    : undefined
  const cancelDef = actionRegistry.has('cancel_project')
    ? actionRegistry.get('cancel_project')
    : undefined
  const applicableActions: ApplicableActionRef[] = []
  if (fundDef) {
    const reason = actionDisabledReasonForTarget(
      fundDef,
      state,
      project.id,
      DAY_MINUTES,
    )
    applicableActions.push(makeRef(fundDef, reason))
  }
  if (cancelDef) {
    const reason = actionDisabledReasonForTarget(
      cancelDef,
      state,
      project.id,
      DAY_MINUTES,
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
    ? actionDisabledReason(def, state, DAY_MINUTES)
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
  if (disabledReason !== undefined) {
    row.disabledReason = humanizeActionReason(disabledReason)
  }
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
    // Phase 203 / audit Wave 4 (`P3-BHV-001`) — ask about THIS policy. The
    // untargeted query answered for the toggle definition in general, so
    // the row could read "available" while the queue rejected the pick the
    // row built.
    const toggleDisabledReason = toggleDef
      ? actionDisabledReasonForTarget(toggleDef, state, starter.id, DAY_MINUTES)
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
      row.toggleDisabledReason = humanizeActionReason(toggleDisabledReason)
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
      DAY_MINUTES,
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
    timeCost: def.timeCost,
  }
  // Phase 204 / audit Wave 5 (`P6-COMP-007`) — engine rejection strings
  // are written for the engine ("adjust_prices requires a numeric amount
  // delta"). Translating here means every consumer of this projection is
  // safe, rather than each component having to remember the call.
  if (disabledReason !== undefined) {
    ref.disabledReason = humanizeActionReason(disabledReason)
  }
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
