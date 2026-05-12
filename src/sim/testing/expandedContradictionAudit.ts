import type { TavernState, EntityRef } from '../state/TavernState'
import type { IssueSeed } from '../modules/issues/issueSeedTypes'
import { EXPANDED_ISSUE_SEED_FAMILIES } from '../modules/issues/issueSeedTypes'
import { getAllSeedsToday } from '../modules/issues/index'
import type { CardlessRunResult } from './simRunner'

// Phase 40 §40.12 — Expanded contradiction audit.
//
// The Phase 20 audit covered the core ten families. Phase 40 adds checks
// targeted at the expansion arc: seeds that name an entity should still
// reference an entity that actually exists; seeds that mention an arc,
// policy, project, market condition, calendar tag, or area trait should
// only do so while that fact is still true.

export type ExpandedContradictionEvidence = {
  seedId: string
  family: string
  reason: string
  evidence: Record<string, number | string | boolean>
}

export type ExpandedContradictionAuditResult = {
  totalExpandedSeedsAudited: number
  contradictionsFound: ExpandedContradictionEvidence[]
  familiesWithContradictions: string[]
  /** 0–100; 100 = no contradictions. */
  score: number
}

const EXPANDED_FAMILY_SET = new Set<string>(EXPANDED_ISSUE_SEED_FAMILIES)

function isExpandedFamily(family: string): boolean {
  return EXPANDED_FAMILY_SET.has(family)
}

function refsFromSeed(seed: IssueSeed): EntityRef[] {
  const refs: EntityRef[] = []
  if (seed.location) refs.push(seed.location)
  if (seed.primaryActor) refs.push(seed.primaryActor)
  for (const a of seed.affectedActors) refs.push(a)
  for (const ne of seed.textIngredients.namedEntities ?? []) refs.push(ne.ref)
  return refs
}

function entityExists(state: TavernState, ref: EntityRef): boolean {
  switch (ref.kind) {
    case 'staff':
      return state.staff[ref.id] !== undefined
    case 'customer_group':
      return state.customerGroups[ref.id] !== undefined
    case 'area':
      return state.areas[ref.id] !== undefined
    case 'stock':
      return state.stock[ref.id] !== undefined
    case 'culture':
      return state.world.cultures[ref.id] !== undefined
    case 'faction':
      return state.world.factions[ref.id] !== undefined
    case 'supplier':
      return state.world.suppliers[ref.id] !== undefined
    case 'regular':
      return state.world.regulars[ref.id] !== undefined
    case 'notable_npc':
      return state.world.notableNpcs[ref.id] !== undefined
    case 'local_event':
      return state.world.localEvents[ref.id] !== undefined
    case 'rumour':
      return state.world.socialRumours[ref.id] !== undefined
    case 'tavern_identity':
    case 'role':
    case 'system':
    case 'other':
      return true
    default:
      return true
  }
}

type OwnerActionsSlice = {
  policies?: Record<string, { enabled?: boolean }>
  projects?: Record<string, { status?: string }>
}

function ownerActionsSlice(state: TavernState): OwnerActionsSlice {
  return (state.modules.ownerActions as OwnerActionsSlice | undefined) ?? {}
}

function policyActive(state: TavernState, policyId: string): boolean {
  const slice = ownerActionsSlice(state)
  const pol = slice.policies?.[policyId]
  return pol !== undefined && pol.enabled !== false
}

function projectStillIncomplete(state: TavernState, projectId: string): boolean {
  const slice = ownerActionsSlice(state)
  const proj = slice.projects?.[projectId]
  if (!proj) return true
  return proj.status !== 'completed'
}

type SupplierSlice = {
  activeMarketConditions?: Array<{ id?: string }>
}

function marketConditionActive(state: TavernState, conditionId: string): boolean {
  const slice = state.modules.suppliers as SupplierSlice | undefined
  for (const active of slice?.activeMarketConditions ?? []) {
    if (active.id === conditionId) return true
  }
  return false
}

function calendarTagActive(state: TavernState, tag: string): boolean {
  return state.calendar.tags.includes(tag as never)
}

function areaTraitStillPresent(
  state: TavernState,
  areaId: string,
  traitId: string,
): boolean {
  const area = state.areas[areaId]
  if (!area) return false
  return area.traits.includes(traitId)
}

function arcStillActive(state: TavernState, arcId: string): boolean {
  const ev = state.world.localEvents[arcId]
  if (!ev) return false
  if (ev.stage === 'resolved' || ev.stage === 'failed') return false
  return true
}

function regularLeaving(state: TavernState, regularId: string): boolean {
  const reg = state.world.regulars[regularId]
  if (!reg) return false
  if (reg.loyalty <= 25) return true
  if (reg.irritation >= 75) return true
  if (reg.activeFlags.some((f) => f === 'leaving' || f === 'angry')) return true
  return false
}

function supplierAngry(state: TavernState, supplierId: string): boolean {
  const sup = state.world.suppliers[supplierId]
  if (!sup) return false
  if (sup.relationship <= 30) return true
  if (sup.activeFlags.some((f) => f === 'angry' || f === 'broken')) return true
  return false
}

function metadataString(seed: IssueSeed, key: string): string | undefined {
  const md = (seed as unknown as { metadata?: Record<string, unknown> }).metadata
  if (!md) return undefined
  const v = md[key]
  return typeof v === 'string' ? v : undefined
}

/** Audit a single expanded seed against the state at generation time. */
export function auditExpandedSeed(
  seed: IssueSeed,
  state: TavernState,
): ExpandedContradictionEvidence | null {
  if (!isExpandedFamily(seed.family)) return null

  // 1. Named entity references must exist.
  for (const ref of refsFromSeed(seed)) {
    if (!entityExists(state, ref)) {
      return {
        seedId: seed.id,
        family: seed.family,
        reason: `Seed references missing ${ref.kind}:${ref.id}`,
        evidence: { kind: ref.kind, id: ref.id },
      }
    }
  }

  // 2. Family-specific consistency checks.
  switch (seed.family) {
    case 'policy_backlash': {
      const policyId =
        metadataString(seed, 'policyId') ??
        seed.affectedActors.find((a) => a.kind === 'other' && a.id.startsWith('policy:'))?.id
      if (policyId && policyId.startsWith('policy:')) {
        const realId = policyId.slice('policy:'.length)
        if (!policyActive(state, realId)) {
          return {
            seedId: seed.id,
            family: seed.family,
            reason: `Seed references inactive policy ${realId} as active`,
            evidence: { policyId: realId, active: false },
          }
        }
      }
      break
    }
    case 'seasonal_arc':
    case 'arc_milestone' as string: {
      const arcRef =
        seed.affectedActors.find((a) => a.kind === 'local_event') ??
        seed.primaryActor
      if (arcRef && arcRef.kind === 'local_event') {
        if (!arcStillActive(state, arcRef.id)) {
          return {
            seedId: seed.id,
            family: seed.family,
            reason: `Seed references ended arc ${arcRef.id} as active`,
            evidence: { arcId: arcRef.id, active: false },
          }
        }
      }
      break
    }
    case 'supplier_relationship': {
      const supplierRef =
        seed.affectedActors.find((a) => a.kind === 'supplier') ?? seed.primaryActor
      if (supplierRef && supplierRef.kind === 'supplier') {
        const claimsAngry =
          (seed.toneHints ?? []).includes('angry') ||
          (seed.textIngredients.perceivedBlame ?? []).length > 0
        if (claimsAngry && !supplierAngry(state, supplierRef.id)) {
          // Soft: only flag when the seed *also* names blame against the
          // supplier — relationship may simply be neutral otherwise.
          if ((seed.textIngredients.perceivedBlame ?? []).length > 0) {
            return {
              seedId: seed.id,
              family: seed.family,
              reason: `Seed says supplier ${supplierRef.id} is angry but state disagrees`,
              evidence: { supplierId: supplierRef.id },
            }
          }
        }
      }
      break
    }
    case 'regular_customer': {
      const regularRef =
        seed.affectedActors.find((a) => a.kind === 'regular') ?? seed.primaryActor
      if (regularRef && regularRef.kind === 'regular') {
        const loyaltyTag = (seed.toneHints ?? []).includes('loyal')
        if (loyaltyTag && regularLeaving(state, regularRef.id)) {
          return {
            seedId: seed.id,
            family: seed.family,
            reason: `Seed says regular ${regularRef.id} is loyal while state shows leaving/anger`,
            evidence: { regularId: regularRef.id },
          }
        }
      }
      break
    }
    case 'area_atmosphere': {
      const areaRef =
        seed.location ?? seed.affectedActors.find((a) => a.kind === 'area')
      const traitId = metadataString(seed, 'traitId')
      if (areaRef && areaRef.kind === 'area' && traitId) {
        if (!areaTraitStillPresent(state, areaRef.id, traitId)) {
          return {
            seedId: seed.id,
            family: seed.family,
            reason: `Seed uses area trait ${traitId} that area ${areaRef.id} no longer has`,
            evidence: { areaId: areaRef.id, traitId },
          }
        }
      }
      break
    }
    default:
      break
  }

  // 3. Project references in metadata.
  const projectId = metadataString(seed, 'projectId')
  if (projectId) {
    if (!projectStillIncomplete(state, projectId)) {
      return {
        seedId: seed.id,
        family: seed.family,
        reason: `Seed references completed project ${projectId} as unfinished`,
        evidence: { projectId, completed: true },
      }
    }
  }

  // 4. Calendar / market context contradictions — only when the seed
  // explicitly claims the tag/condition is currently active via the
  // `active:` prefix. Bare references and historical mentions are
  // legitimate flavor context.
  const calendarContext = seed.textIngredients.calendarContext ?? []
  for (const tag of calendarContext) {
    const candidate = tag.trim()
    if (!candidate) continue
    if (candidate.startsWith('active_tag:')) {
      const t = candidate.slice('active_tag:'.length).trim()
      if (!calendarTagActive(state, t)) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: `Seed uses cultural calendar context for inactive tag ${t}`,
          evidence: { tag: t, active: false },
        }
      }
    }
  }

  const marketContext = seed.textIngredients.marketContext ?? []
  for (const m of marketContext) {
    const candidate = m.trim()
    if (!candidate) continue
    if (candidate.startsWith('active_market:')) {
      const cond = candidate.slice('active_market:'.length).trim()
      if (!marketConditionActive(state, cond)) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: `Seed uses market context for inactive condition ${cond}`,
          evidence: { condition: cond, active: false },
        }
      }
    }
  }

  return null
}

/** Audit every expanded seed across a multi-day run. */
export function auditRunForExpandedContradictions(
  run: CardlessRunResult,
): ExpandedContradictionAuditResult {
  const found: ExpandedContradictionEvidence[] = []
  let total = 0
  for (const day of run.days) {
    const seeds = getAllSeedsToday(day.result.state)
    for (const seed of seeds) {
      if (!isExpandedFamily(seed.family)) continue
      total += 1
      const ev = auditExpandedSeed(seed, day.result.state)
      if (ev) found.push(ev)
    }
  }
  const families = Array.from(new Set(found.map((e) => e.family))).sort()
  const score =
    total === 0 ? 100 : Math.round(((total - found.length) / total) * 100)
  return {
    totalExpandedSeedsAudited: total,
    contradictionsFound: found,
    familiesWithContradictions: families,
    score,
  }
}

/** Audit a single state's currently-generated expanded seeds. */
export function auditStateForExpandedContradictions(
  state: TavernState,
): ExpandedContradictionAuditResult {
  const seeds = getAllSeedsToday(state).filter((s) => isExpandedFamily(s.family))
  const found: ExpandedContradictionEvidence[] = []
  for (const seed of seeds) {
    const ev = auditExpandedSeed(seed, state)
    if (ev) found.push(ev)
  }
  const families = Array.from(new Set(found.map((e) => e.family))).sort()
  const score =
    seeds.length === 0
      ? 100
      : Math.round(((seeds.length - found.length) / seeds.length) * 100)
  return {
    totalExpandedSeedsAudited: seeds.length,
    contradictionsFound: found,
    familiesWithContradictions: families,
    score,
  }
}
