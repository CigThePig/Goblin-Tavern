import type { SimContext } from '../../core/context'
import type {
  AreaState,
  CustomerGroupState,
  EntityRef,
  RegularWorldState,
  StaffState,
} from '../../state/TavernState'

import type {
  CustomerSatisfactionChange,
  DailyServiceResult,
  ServiceIncidentSummary,
  ServiceScene,
  ServiceSceneSeverity,
  ServiceSceneTextIngredients,
  ServiceSceneType,
} from './types'

// Phase 32 — Service scene builder.
//
// `buildServiceScenes` inspects the daily service result plus the wider
// `state.world` / staff / area context (Phases 25–31) and returns a small
// list of structured "scenes" that future card writers can pull on. The
// builder is intentionally pure: it does not mutate state. The service
// module is responsible for attaching the returned scenes to the result
// and for deciding which scenes deserve a memory or history entry.
//
// Determinism rules (§32.3):
//   - The builder is condition-driven first. Where multiple scene
//     candidates qualify, the named `incidents` RNG stream is used to
//     break ties — never the global PRNG, never an un-seeded source.
//   - Scenes never invent state. A regular cited in a complaint must
//     exist on `state.world.regulars`; a staff member quoted in a
//     `staff_moment` must exist on `state.staff`.
//   - The scene count is capped (`MAX_SERVICE_SCENES_PER_DAY`) so a
//     single rough day cannot fill the report with thirty cards-worth of
//     fuel.

const MAX_SERVICE_SCENES_PER_DAY = 3

const HIGH_REGULAR_IRRITATION = 50
const HIGH_STAFF_STRESS = 65
const HIGH_STAFF_FATIGUE = 70
const POOR_SATISFACTION_DROP = -2
const HEAVY_MESS_DELTA = 8
const HEAVY_DAMAGE_DELTA = 4

const NOTICEABLE_AREA_TRAITS = new Set<string>([
  'sticky_floor',
  'drafty',
  'smells_of_smoke',
  'pest_prone',
])

const RESPECTABLE_GROUP_TAGS = new Set<string>([
  'merchant',
  'merchants',
  'respectable',
  'town',
  'townsfolk',
])

type SceneCandidate = {
  sceneType: ServiceSceneType
  numericSeverity: number
  areaId?: string
  involvedEntityRefs: EntityRef[]
  involvedGroupIds: string[]
  staffIds: string[]
  regularIds: string[]
  supplierIds: string[]
  tags: string[]
  causes: string[]
  textIngredients: ServiceSceneTextIngredients
  possibleIssueSeedIds: string[]
}

function severityBand(numeric: number): ServiceSceneSeverity {
  if (numeric >= 65) return 'major'
  if (numeric >= 35) return 'moderate'
  return 'minor'
}

function dedupeStrings(items: ReadonlyArray<string>): string[] {
  return Array.from(new Set(items))
}

function clamp0to100(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function isRespectableGroup(group: CustomerGroupState): boolean {
  if (RESPECTABLE_GROUP_TAGS.has(group.id)) return true
  for (const tag of group.tags) {
    if (RESPECTABLE_GROUP_TAGS.has(tag)) return true
  }
  return false
}

function regularsForGroup(
  ctx: SimContext,
  groupId: string,
): RegularWorldState[] {
  const matches: RegularWorldState[] = []
  for (const regular of Object.values(ctx.state.world.regulars)) {
    if (regular.customerGroupId === groupId) matches.push(regular)
  }
  return matches
}

function pickIrritatedRegular(
  ctx: SimContext,
  groupId: string,
): RegularWorldState | undefined {
  const regulars = regularsForGroup(ctx, groupId)
  if (regulars.length === 0) return undefined
  let best: RegularWorldState | undefined
  for (const regular of regulars) {
    if (regular.irritation < HIGH_REGULAR_IRRITATION) continue
    if (!best || regular.irritation > best.irritation) best = regular
  }
  return best
}

function averageStockQuality(
  ctx: SimContext,
  preferredTags: ReadonlyArray<string>,
): { stockId: string; quality: number } | undefined {
  let lowest: { stockId: string; quality: number } | undefined
  for (const stock of Object.values(ctx.state.stock)) {
    if (stock.quantity <= 0) continue
    if (preferredTags.length > 0) {
      const match = preferredTags.some((tag) => stock.tags.includes(tag))
      if (!match) continue
    }
    if (!lowest || stock.quality < lowest.quality) {
      lowest = { stockId: stock.id, quality: stock.quality }
    }
  }
  return lowest
}

function buildStockQualityComplaint(
  ctx: SimContext,
  result: DailyServiceResult,
  satChange: CustomerSatisfactionChange,
): SceneCandidate | undefined {
  const group = ctx.state.customerGroups[satChange.groupId]
  if (!group) return undefined
  const visitors = result.trafficByGroup[group.id] ?? 0
  if (visitors <= 0) return undefined
  if (satChange.delta > POOR_SATISFACTION_DROP) return undefined

  const groupShortages = result.shortages.filter(
    (s) => result.purchasesByGroup[group.id]?.shortages.some((g) => g.stockId === s.stockId),
  )
  const foodComplaint = result.incidents.find(
    (i) => i.id === 'food_complaint' && i.actorGroup === group.id,
  )
  if (groupShortages.length === 0 && !foodComplaint && result.serviceQuality.foodQualityModifier >= 0) {
    return undefined
  }

  const lowest = averageStockQuality(ctx, group.preferredStockTags)
  if (!lowest) return undefined

  const numericSeverity = clamp0to100(
    25 +
      Math.max(0, -satChange.delta) * 6 +
      Math.max(0, 50 - lowest.quality) +
      (foodComplaint ? foodComplaint.severity / 3 : 0),
  )

  const cook = Object.values(ctx.state.staff).find((s) => s.role === 'cook')
  const staffIds = cook ? [cook.id] : []
  const textIngredients: ServiceSceneTextIngredients = {
    groupName: group.label,
    groupId: group.id,
    stockId: lowest.stockId,
    stockQuality: lowest.quality,
    satisfactionDelta: satChange.delta,
    visitors,
  }
  if (cook) textIngredients.staffName = cook.name.display

  return {
    sceneType: 'stock_quality_complaint',
    numericSeverity,
    involvedEntityRefs: [
      { kind: 'customer_group', id: group.id },
      { kind: 'stock', id: lowest.stockId },
      ...(cook ? [{ kind: 'staff' as const, id: cook.id }] : []),
    ],
    involvedGroupIds: [group.id],
    staffIds,
    regularIds: [],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'stock_quality_complaint',
      group.id,
      lowest.stockId,
    ]),
    causes: foodComplaint
      ? ['food_complaint', 'stock_quality']
      : ['stock_quality'],
    textIngredients,
    possibleIssueSeedIds: ['stock_quality_complaint', 'food_quality_concern'],
  }
}

function buildRegularComplaint(
  ctx: SimContext,
  result: DailyServiceResult,
  satChange: CustomerSatisfactionChange,
): SceneCandidate | undefined {
  if (satChange.delta > POOR_SATISFACTION_DROP) return undefined
  const regular = pickIrritatedRegular(ctx, satChange.groupId)
  if (!regular) return undefined
  const group = ctx.state.customerGroups[satChange.groupId]
  if (!group) return undefined

  const groupShortages = result.purchasesByGroup[group.id]?.shortages ?? []
  let complaintTopic = 'service'
  if (groupShortages.length > 0) {
    complaintTopic = `shortage:${groupShortages[0]!.stockId}`
  } else if (result.serviceQuality.foodQualityModifier < 0) {
    complaintTopic = 'watery_ale'
  } else if (result.incidents.some((i) => i.id === 'minor_brawl')) {
    complaintTopic = 'rowdy_crowd'
  }

  const numericSeverity = clamp0to100(
    30 +
      regular.irritation / 2 +
      Math.max(0, -satChange.delta) * 4,
  )

  return {
    sceneType: 'regular_complaint',
    numericSeverity,
    areaId: 'main_room',
    involvedEntityRefs: [
      { kind: 'regular', id: regular.id },
      { kind: 'customer_group', id: group.id },
    ],
    involvedGroupIds: [group.id],
    staffIds: [],
    regularIds: [regular.id],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'regular_complaint',
      group.id,
      complaintTopic,
    ]),
    causes: ['regular_irritation', complaintTopic],
    textIngredients: {
      regularName: regular.name.display,
      regularId: regular.id,
      groupName: group.label,
      groupId: group.id,
      complaintTopic,
      irritation: regular.irritation,
      satisfactionDelta: satChange.delta,
    },
    possibleIssueSeedIds: ['regular_complained', 'regular_unhappy'],
  }
}

function pickNotableArea(ctx: SimContext, result: DailyServiceResult):
  | { areaId: string; trait?: string; delta: number; reason: string }
  | undefined {
  let best:
    | { areaId: string; trait?: string; delta: number; reason: string }
    | undefined
  for (const change of [...result.messCreated, ...result.damageCreated]) {
    const area = ctx.state.areas[change.areaId]
    if (!area) continue
    const noticeableTrait = area.traits.find((t) => NOTICEABLE_AREA_TRAITS.has(t))
    const reason = change.field === 'mess' ? 'mess_buildup' : 'damage_buildup'
    const absDelta = Math.abs(change.delta)
    if (change.field === 'mess' && absDelta < HEAVY_MESS_DELTA && !noticeableTrait) continue
    if (change.field === 'damage' && absDelta < HEAVY_DAMAGE_DELTA && !noticeableTrait) continue
    const score = absDelta + (noticeableTrait ? 6 : 0)
    if (!best || score > Math.abs(best.delta)) {
      best = {
        areaId: change.areaId,
        ...(noticeableTrait ? { trait: noticeableTrait } : {}),
        delta: change.delta,
        reason,
      }
    }
  }
  return best
}

function buildAreaProblemScene(
  ctx: SimContext,
  result: DailyServiceResult,
): SceneCandidate | undefined {
  const candidate = pickNotableArea(ctx, result)
  if (!candidate) return undefined
  const area: AreaState | undefined = ctx.state.areas[candidate.areaId]
  if (!area) return undefined

  // Phase 32 §32.3 — area scenes prefer to surface when respectable
  // customers were present and noticed the state of the room.
  const respectableGroupIds: string[] = []
  for (const group of Object.values(ctx.state.customerGroups)) {
    if (!isRespectableGroup(group)) continue
    if ((result.trafficByGroup[group.id] ?? 0) > 0) {
      respectableGroupIds.push(group.id)
    }
  }
  if (respectableGroupIds.length === 0 && !candidate.trait) return undefined

  const numericSeverity = clamp0to100(
    20 +
      Math.abs(candidate.delta) * 3 +
      (candidate.trait ? 18 : 0) +
      respectableGroupIds.length * 4,
  )

  return {
    sceneType: 'area_problem_noticed',
    numericSeverity,
    areaId: area.id,
    involvedEntityRefs: [
      { kind: 'area', id: area.id },
      ...respectableGroupIds.map((id) => ({ kind: 'customer_group' as const, id })),
    ],
    involvedGroupIds: respectableGroupIds,
    staffIds: [],
    regularIds: [],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'area_problem_noticed',
      area.id,
      ...(candidate.trait ? [candidate.trait] : []),
      candidate.reason,
    ]),
    causes: [candidate.reason, ...(candidate.trait ? [`trait:${candidate.trait}`] : [])],
    textIngredients: {
      areaId: area.id,
      areaLabel: area.label,
      trait: candidate.trait ?? null,
      delta: candidate.delta,
      respectableGroupCount: respectableGroupIds.length,
    },
    possibleIssueSeedIds: ['area_problem_noticed', 'cleanliness_concern'],
  }
}

function buildUnpaidTabScene(
  ctx: SimContext,
  result: DailyServiceResult,
): SceneCandidate | undefined {
  if (result.unpaidTabs <= 0) return undefined

  const server = Object.values(ctx.state.staff).find((s) => s.role === 'server')
  const serverWatching = server?.currentPriority === 'watch_tabs'
  // Only escalate to a scene when the leak was material OR the server
  // had an actively counter-productive priority.
  if (serverWatching && result.unpaidTabs < 4) return undefined

  let worstGroupId: string | undefined
  let worstTabs = 0
  for (const purchase of Object.values(result.purchasesByGroup)) {
    if (purchase.unpaidTabs > worstTabs) {
      worstTabs = purchase.unpaidTabs
      worstGroupId = purchase.groupId
    }
  }

  const group = worstGroupId
    ? ctx.state.customerGroups[worstGroupId]
    : undefined
  const numericSeverity = clamp0to100(
    20 + result.unpaidTabs * 4 + (serverWatching ? 0 : 10),
  )

  return {
    sceneType: 'unpaid_tab_argument',
    numericSeverity,
    areaId: 'main_room',
    involvedEntityRefs: [
      ...(server ? [{ kind: 'staff' as const, id: server.id }] : []),
      ...(group ? [{ kind: 'customer_group' as const, id: group.id }] : []),
    ],
    involvedGroupIds: group ? [group.id] : [],
    staffIds: server ? [server.id] : [],
    regularIds: [],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'unpaid_tab_argument',
      ...(group ? [group.id] : []),
    ]),
    causes: ['unpaid_tabs'],
    textIngredients: {
      totalUnpaid: result.unpaidTabs,
      worstGroupId: group?.id ?? null,
      worstGroupName: group?.label ?? null,
      worstTabs,
      serverName: server?.name.display ?? null,
      serverPriority: server?.currentPriority ?? null,
    },
    possibleIssueSeedIds: ['unpaid_tab_argument', 'tab_problem'],
  }
}

function buildBrawlAftermath(
  ctx: SimContext,
  result: DailyServiceResult,
): SceneCandidate | undefined {
  const brawl = result.incidents.find((i) => i.id === 'minor_brawl')
  if (!brawl) return undefined
  const area = brawl.areaId ? ctx.state.areas[brawl.areaId] : undefined
  const bouncer = Object.values(ctx.state.staff).find(
    (s) => s.role === 'cleaner_bouncer',
  )
  const numericSeverity = clamp0to100(40 + brawl.severity / 2)

  const involvedEntityRefs: EntityRef[] = []
  if (area) involvedEntityRefs.push({ kind: 'area', id: area.id })
  if (brawl.actorGroup) {
    involvedEntityRefs.push({ kind: 'customer_group', id: brawl.actorGroup })
  }
  if (bouncer) involvedEntityRefs.push({ kind: 'staff', id: bouncer.id })

  return {
    sceneType: 'brawl_aftermath',
    numericSeverity,
    ...(area ? { areaId: area.id } : {}),
    involvedEntityRefs,
    involvedGroupIds: brawl.actorGroup ? [brawl.actorGroup] : [],
    staffIds: bouncer ? [bouncer.id] : [],
    regularIds: [],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'brawl_aftermath',
      ...(brawl.actorGroup ? [brawl.actorGroup] : []),
      ...(area ? [area.id] : []),
    ]),
    causes: ['minor_brawl'],
    textIngredients: {
      brawlSeverity: brawl.severity,
      actorGroupId: brawl.actorGroup ?? null,
      areaId: area?.id ?? null,
      bouncerName: bouncer?.name.display ?? null,
      bouncerPriority: bouncer?.currentPriority ?? null,
    },
    possibleIssueSeedIds: ['brawl_aftermath', 'violence_concern'],
  }
}

function pickStressedStaff(ctx: SimContext): StaffState | undefined {
  let worst: StaffState | undefined
  let worstScore = 0
  for (const staff of Object.values(ctx.state.staff)) {
    if (staff.unavailable === true) continue
    const stressed = staff.stress >= HIGH_STAFF_STRESS
    const fatigued = staff.fatigue >= HIGH_STAFF_FATIGUE
    if (!stressed && !fatigued) continue
    const score = staff.stress + staff.fatigue
    if (!worst || score > worstScore) {
      worst = staff
      worstScore = score
    }
  }
  return worst
}

function buildStaffMoment(
  ctx: SimContext,
  result: DailyServiceResult,
): SceneCandidate | undefined {
  const staff = pickStressedStaff(ctx)
  if (!staff) return undefined

  const stressResponse = staff.identity?.stressResponse ?? 'rushes'
  const workStyle = staff.identity?.workStyle ?? 'steady'
  const numericSeverity = clamp0to100(
    25 + (staff.stress - HIGH_STAFF_STRESS) + Math.max(0, staff.fatigue - HIGH_STAFF_FATIGUE) / 2,
  )
  const positive =
    result.netCoinEarned >= 10 &&
    result.incidents.length === 0 &&
    staff.morale > 50

  return {
    sceneType: 'staff_moment',
    numericSeverity,
    involvedEntityRefs: [{ kind: 'staff', id: staff.id }],
    involvedGroupIds: [],
    staffIds: [staff.id],
    regularIds: [],
    supplierIds: [],
    tags: dedupeStrings([
      'service_scene',
      'staff_moment',
      staff.id,
      staff.role,
      stressResponse,
      workStyle,
      positive ? 'positive' : 'strained',
    ]),
    causes: positive ? ['service_smooth'] : ['staff_stress', 'staff_fatigue'],
    textIngredients: {
      staffId: staff.id,
      staffName: staff.name.display,
      role: staff.role,
      stress: staff.stress,
      fatigue: staff.fatigue,
      stressResponse,
      workStyle,
      tone: positive ? 'positive' : 'strained',
    },
    possibleIssueSeedIds: positive
      ? ['staff_moment_positive']
      : ['staff_burnout', 'staff_moment_strained'],
  }
}

function makeSceneId(
  ctx: SimContext,
  sceneType: ServiceSceneType,
  index: number,
): string {
  const day = ctx.state.calendar.totalDaysElapsed
  return `scene_${day}_${sceneType}_${index}`
}

/** 1 when the scene is about somebody the game can name, 0 otherwise. */
function namedEntityRank(candidate: SceneCandidate): number {
  return candidate.regularIds.length > 0 || candidate.staffIds.length > 0 ? 1 : 0
}

function rankCandidates(
  candidates: ReadonlyArray<SceneCandidate>,
  ctx: SimContext,
): SceneCandidate[] {
  if (candidates.length <= MAX_SERVICE_SCENES_PER_DAY) {
    // Even when no tie-breaking is needed, sort by severity so the
    // report always lists the most notable scene first.
    return [...candidates].sort(
      (a, b) => b.numericSeverity - a.numericSeverity,
    )
  }
  const rng = ctx.getRngStream('incidents')
  const sorted = [...candidates].sort((a, b) => {
    if (b.numericSeverity !== a.numericSeverity) {
      return b.numericSeverity - a.numericSeverity
    }
    // Expansion Phase 4 — a scene about a NAMED person outranks an ambient
    // one at equal severity.
    //
    // Severity saturates at 100, and a genuinely bad night now saturates
    // several candidates at once (the room is filthy AND the slate is long AND
    // a regular is furious). Before this phase that rarely happened, so the
    // coin flip below decided little; once it does happen, a pure coin flip
    // drops the scene that names Grulk in favour of the one that names the
    // main room roughly half the time — and §32.3's whole preference is for
    // entity-driven scenes. Ties within a tier still break on the seeded
    // `incidents` stream, so this stays deterministic.
    const named = namedEntityRank(b) - namedEntityRank(a)
    if (named !== 0) return named
    return rng.float() - 0.5
  })
  return sorted.slice(0, MAX_SERVICE_SCENES_PER_DAY)
}

export type BuildServiceScenesArgs = {
  ctx: SimContext
  resultBeforeScenes: DailyServiceResult
  satisfactionChanges: ReadonlyArray<CustomerSatisfactionChange>
}

export function buildServiceScenes(
  args: BuildServiceScenesArgs,
): ServiceScene[] {
  const { ctx, resultBeforeScenes: result, satisfactionChanges } = args
  const candidates: SceneCandidate[] = []

  for (const satChange of satisfactionChanges) {
    const stockQuality = buildStockQualityComplaint(ctx, result, satChange)
    if (stockQuality) candidates.push(stockQuality)
    const regular = buildRegularComplaint(ctx, result, satChange)
    if (regular) candidates.push(regular)
  }

  const area = buildAreaProblemScene(ctx, result)
  if (area) candidates.push(area)

  const tabs = buildUnpaidTabScene(ctx, result)
  if (tabs) candidates.push(tabs)

  const brawl = buildBrawlAftermath(ctx, result)
  if (brawl) candidates.push(brawl)

  const staffMoment = buildStaffMoment(ctx, result)
  if (staffMoment) candidates.push(staffMoment)

  const picked = rankCandidates(candidates, ctx)
  return picked.map((candidate, index) => {
    const scene: ServiceScene = {
      id: makeSceneId(ctx, candidate.sceneType, index),
      sceneType: candidate.sceneType,
      severity: severityBand(candidate.numericSeverity),
      numericSeverity: candidate.numericSeverity,
      ...(candidate.areaId ? { areaId: candidate.areaId } : {}),
      involvedEntityRefs: candidate.involvedEntityRefs,
      involvedGroupIds: candidate.involvedGroupIds,
      staffIds: candidate.staffIds,
      regularIds: candidate.regularIds,
      supplierIds: candidate.supplierIds,
      tags: candidate.tags,
      causes: candidate.causes,
      textIngredients: candidate.textIngredients,
      possibleIssueSeedIds: candidate.possibleIssueSeedIds,
    }
    return scene
  })
}

export const SERVICE_SCENE_LIMITS = {
  MAX_SERVICE_SCENES_PER_DAY,
}
