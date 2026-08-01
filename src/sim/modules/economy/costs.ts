import type { SimContext } from '../../core/context'
import { getRule } from '../../contracts/ruleset/index'
import { spendCoin } from '../stock/ledger'

import { getEconomyModuleState, writeEconomyState } from './state'
import type {
  OperatingCostKind,
  OperatingCostLine,
  OperatingCostSettlement,
} from './types'

type CostDraft = {
  kind: OperatingCostKind
  due: number
  readable: string
  tags: string[]
}

function rulesetCostFactor(ctx: SimContext): number {
  const assistance = getRule(ctx.state, 'recoveryAssistanceMultiplier')
  return Math.max(0.75, Math.min(1.25, 1 + (1 - assistance) * 0.25))
}

function totalDamage(ctx: SimContext): number {
  return Object.values(ctx.state.areas).reduce((sum, area) => sum + area.damage, 0)
}

function installedUpgradeCount(ctx: SimContext): number {
  let count = 0
  for (const area of Object.values(ctx.state.areas)) {
    for (const upgrade of Object.values(area.upgrades)) {
      if (upgrade.status === 'installed' || upgrade.status === 'damaged') count += 1
    }
  }
  return count
}

function policyOperatingCost(ctx: SimContext): number {
  return Object.values(getEconomyModuleState(ctx.state).policies).reduce(
    (sum, policy) =>
      policy.intendedEnabled ? sum + policy.operatingCost : sum,
    0,
  )
}

function draftCosts(ctx: SimContext): CostDraft[] {
  const economy = getEconomyModuleState(ctx.state)
  const closed =
    economy.financial.status === 'temporarily_closed' ||
    economy.financial.status === 'restructuring'
  const factor = rulesetCostFactor(ctx)
  const activeAreas = Object.values(ctx.state.areas).filter(
    (area) => area.condition > 0,
  ).length
  const damage = totalDamage(ctx)
  const upgrades = installedUpgradeCount(ctx)
  const lines: CostDraft[] = []

  // Light, attributable utilities/consumables. Closure retains one coin of
  // basic watch/board-up cost rather than operating at full burn.
  const overhead = closed
    ? 1
    : Math.max(2, Math.round((1 + activeAreas / 4) * factor))
  lines.push({
    kind: 'overhead',
    due: overhead,
    readable: closed
      ? 'Basic closure watch and utilities.'
      : `${activeAreas} usable areas drew daily utilities and consumables.`,
    tags: ['economy', 'operating_overhead', closed ? 'closure' : 'open'],
  })

  const maintenance = closed ? 0 : Math.round((damage / 70) * factor)
  if (maintenance > 0) {
    lines.push({
      kind: 'maintenance',
      due: maintenance,
      readable: `${Math.round(damage)} total area damage required routine maintenance.`,
      tags: ['economy', 'maintenance', 'area_damage'],
    })
  }

  // Installed fittings add a small common-space burden. Their named service
  // bills still belong to the area action and are separately classified as
  // `upgradeUpkeep` in accounting.
  const upkeep = closed ? 0 : Math.floor(upgrades / 4)
  if (upkeep > 0) {
    lines.push({
      kind: 'upgrade_upkeep',
      due: upkeep,
      readable: `${upgrades} installed fittings needed routine supplies.`,
      tags: ['economy', 'upgrade_upkeep', 'upkeep'],
    })
  }

  const emergency =
    damage >= 180 || economy.collapseStreak >= 7
      ? Math.max(1, Math.ceil((damage - 120) / 80))
      : 0
  if (!closed && emergency > 0) {
    lines.push({
      kind: 'emergency_premium',
      due: emergency,
      readable: 'Persistent neglect made ordinary work urgent and expensive.',
      tags: ['economy', 'maintenance', 'emergency_premium', 'neglect'],
    })
  }

  const policy = policyOperatingCost(ctx)
  if (!closed && policy > 0) {
    lines.push({
      kind: 'policy_enforcement',
      due: policy,
      readable: 'Active house rules required enforcement supplies.',
      tags: ['economy', 'policy_enforcement', 'policy'],
    })
  }

  if (economy.financial.restructuringBalance > 0) {
    lines.push({
      kind: 'financing_charge',
      due: Math.max(1, Math.ceil(economy.financial.restructuringBalance * 0.01)),
      readable: 'The restructuring agreement charged its daily financing fee.',
      tags: ['economy', 'financing_charge', 'restructuring'],
    })
    lines.push({
      kind: 'restructuring_payment',
      due: Math.max(1, Math.ceil(economy.financial.restructuringBalance / 28)),
      readable: 'The restructuring agreement called its daily principal instalment.',
      tags: ['economy', 'loan_payment', 'restructuring_payment', 'restructuring'],
    })
  }
  return lines
}

function ledgerCategory(kind: OperatingCostKind): 'repair' | 'other' {
  return kind === 'maintenance' || kind === 'upgrade_upkeep' || kind === 'emergency_premium'
    ? 'repair'
    : 'other'
}

function settleLine(ctx: SimContext, draft: CostDraft): OperatingCostLine {
  const due = Math.ceil(Math.max(0, draft.due))
  const paid = Math.min(ctx.state.coin, due)
  if (paid > 0) {
    spendCoin(ctx, paid, {
      source: `economy.cost.${draft.kind}`,
      category: ledgerCategory(draft.kind),
      tags: [...draft.tags, draft.kind],
      reason: `economy_${draft.kind}`,
    })
  }
  return {
    kind: draft.kind,
    due,
    paid,
    shortfall: due - paid,
    readable: draft.readable,
    tags: [...draft.tags],
  }
}

export function settleOperatingCosts(ctx: SimContext): OperatingCostSettlement {
  const before = getEconomyModuleState(ctx.state)
  const lines: OperatingCostLine[] = []

  // A restructuring defers old operating arrears while the doors remain
  // closed. Otherwise the new working-capital advance would be swallowed
  // before the player gets a chance to choose `reopen_tavern`.
  if (
    before.financial.operatingArrears > 0 &&
    before.financial.status !== 'restructuring'
  ) {
    lines.push(
      settleLine(ctx, {
        kind: 'arrears_payment',
        due: Math.ceil(before.financial.operatingArrears),
        readable: 'Past operating arrears were called before new costs.',
        tags: ['economy', 'operating_arrears', 'arrears_payment'],
      }),
    )
  }
  for (const draft of draftCosts(ctx)) lines.push(settleLine(ctx, draft))

  const due = lines.reduce((sum, line) => sum + line.due, 0)
  const paid = lines.reduce((sum, line) => sum + line.paid, 0)
  const shortfall = lines.reduce((sum, line) => sum + line.shortfall, 0)
  const arrearsLine = lines.find((line) => line.kind === 'arrears_payment')
  const oldRemaining = arrearsLine?.shortfall ?? before.financial.operatingArrears
  const newShortfall = lines
    .filter(
      (line) =>
        line.kind !== 'arrears_payment' &&
        line.kind !== 'restructuring_payment',
    )
    .reduce((sum, line) => sum + line.shortfall, 0)
  const principalPaid =
    lines.find((line) => line.kind === 'restructuring_payment')?.paid ?? 0

  writeEconomyState(
    ctx,
    (current) => ({
      ...current,
      financial: {
        ...current.financial,
        operatingArrears: Math.ceil(oldRemaining + newShortfall),
        restructuringBalance: Math.max(
          0,
          Math.ceil(current.financial.restructuringBalance) - principalPaid,
        ),
      },
    }),
    'operating_costs',
  )

  return { due, paid, shortfall, lines }
}
