import type { SimContext } from '../../../core/context'
import type {
  FeedbackEvidence,
  FeedbackLoopDetectorResult,
} from '../feedbackLoopTypes'
import { evidenceWeightTotal, pushEvidence } from './helpers'

// Phase 38 §38.15 — Expanded feedback loop detectors.
//
// Each detector reads expanded pressure values and (where useful) a few
// existing canonical pressures or world counts. The detectors stay
// declarative: they tally evidence weights, count active expanded
// pressures, and emit a `readable` summary so the feedback report can
// surface the spiral in plain prose.

const EXPANDED_TRIGGER = 30

type PressureRef = { id: string; label: string }

function pushPressureEvidence(
  ctx: SimContext,
  evidence: FeedbackEvidence[],
  refs: PressureRef[],
): number {
  let high = 0
  for (const ref of refs) {
    const value = ctx.state.pressures[ref.id]?.value ?? 0
    if (value >= EXPANDED_TRIGGER) {
      high += 1
      pushEvidence(evidence, {
        id: `pressure_${ref.id}`,
        readable: `${ref.label} pressure ${value}.`,
        weight: Math.round(value / 4),
        tags: ['pressure', ref.id],
      })
    }
  }
  return high
}

function resultFromEvidence(
  evidence: FeedbackEvidence[],
  highCount: number,
  speed: FeedbackLoopDetectorResult['speed'],
  nodes: string[],
  systems: string[],
  tags: string[],
  readable: string,
): FeedbackLoopDetectorResult {
  const strength = Math.min(100, evidenceWeightTotal(evidence))
  const active = highCount >= 2
  return {
    active,
    strength,
    risk: active ? Math.min(100, strength + 5) : strength,
    speed,
    evidence,
    nodes,
    relatedSystems: systems,
    tags,
    readable,
  }
}

// ----- supplier_distrust_spiral -----

export function detectSupplierDistrustSpiral(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'supplier_distrust', label: 'Supplier Distrust' },
    { id: 'stock_shortage', label: 'Stock Shortage' },
    { id: 'market_instability', label: 'Market Instability' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'medium',
    ['suppliers', 'stock', 'market', 'customers'],
    ['suppliers', 'stock', 'market', 'pressures'],
    ['supplier', 'market', 'stock'],
    'supplier distrust → stock shortage → market instability → customer complaints → reputation drift',
  )
}

// ----- regular_loss_spiral -----

export function detectRegularLossSpiral(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'regular_customer_loss', label: 'Regular Customer Loss' },
    { id: 'reputation_drift', label: 'Reputation Drift' },
    { id: 'staff_loyalty_risk', label: 'Staff Loyalty Risk' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'medium',
    ['regulars', 'reputation', 'service'],
    ['regulars', 'reputation', 'pressures'],
    ['regulars', 'social'],
    'regular customer loss → reputation drift → staff feel the strain → service falters → more regulars leave',
  )
}

// ----- staff_scapegoat_loop -----

export function detectStaffScapegoatLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'staff_loyalty_risk', label: 'Staff Loyalty Risk' },
    { id: 'staff_burnout', label: 'Staff Burnout' },
    { id: 'rumour_pressure', label: 'Rumour Pressure' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'fast',
    ['staff', 'attribution', 'rumour'],
    ['staff', 'pressures', 'attribution', 'rumours'],
    ['staff', 'social'],
    'public blame → staff scapegoated → loyalty drops → service worsens → more public blame',
  )
}

// ----- policy_backlash_loop -----

export function detectPolicyBacklashLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'policy_backlash', label: 'Policy Backlash' },
    { id: 'faction_anger', label: 'Faction Anger' },
    { id: 'cultural_tension', label: 'Cultural Tension' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'slow',
    ['policy', 'factions', 'culture'],
    ['policies', 'factions', 'cultures', 'pressures'],
    ['policy', 'social'],
    'policy backlash → faction anger → cultural tension → violence risk → reputation drift',
  )
}

// ----- rival_pressure_loop -----

export function detectRivalPressureLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'rival_tavern_pressure', label: 'Rival Tavern Pressure' },
    { id: 'regular_customer_loss', label: 'Regular Customer Loss' },
    { id: 'reputation_drift', label: 'Reputation Drift' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'medium',
    ['rival', 'regulars', 'reputation'],
    ['localArcs', 'regulars', 'reputation', 'pressures'],
    ['rival', 'market'],
    'rival arc → regular defections → reputation drift → rival looks more attractive',
  )
}

// ----- festival_unreadiness_loop -----

export function detectFestivalUnreadinessLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const festivalValue = ctx.state.pressures['festival_readiness']?.value ?? 0

  // Gate: this loop is specifically about festival unreadiness. If
  // festival pressure isn't elevated, the loop is inactive even when
  // adjacent pressures (stock, burnout) are.
  if (festivalValue < EXPANDED_TRIGGER) {
    return {
      active: false,
      strength: 0,
      risk: 0,
      speed: 'fast',
      evidence,
      nodes: ['festival', 'stock', 'staff'],
      relatedSystems: ['localArcs', 'stock', 'staff', 'pressures'],
      tags: ['festival', 'arc'],
      readable: 'festival readiness within tolerance; loop inactive.',
    }
  }

  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'festival_readiness', label: 'Festival Readiness' },
    { id: 'stock_shortage', label: 'Stock Shortage' },
    { id: 'staff_burnout', label: 'Staff Burnout' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'fast',
    ['festival', 'stock', 'staff'],
    ['localArcs', 'stock', 'staff', 'pressures'],
    ['festival', 'arc'],
    'festival arrives unprepared → stock runs out → staff exhaust themselves → preparation slips further',
  )
}

// ----- rumour_blame_loop -----

export function detectRumourBlameLoop(
  ctx: SimContext,
): FeedbackLoopDetectorResult {
  const evidence: FeedbackEvidence[] = []
  const high = pushPressureEvidence(ctx, evidence, [
    { id: 'rumour_pressure', label: 'Rumour Pressure' },
    { id: 'reputation_drift', label: 'Reputation Drift' },
    { id: 'staff_loyalty_risk', label: 'Staff Loyalty Risk' },
  ])
  return resultFromEvidence(
    evidence,
    high,
    'slow',
    ['rumour', 'attribution', 'reputation'],
    ['rumours', 'attribution', 'reputation', 'pressures'],
    ['rumour', 'social'],
    'rumours spread → public blame lands → reputation drifts → more rumours stick',
  )
}
