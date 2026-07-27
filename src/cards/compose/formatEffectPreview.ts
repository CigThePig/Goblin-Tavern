import type { EffectPreview } from '../../sim/core/effect'
import type { TavernState } from '../../sim/state/TavernState'
import { RENT_PAYMENT_EFFECT_TARGET } from '../../sim/modules/monthly/types'
import { OWNER_TIME_EFFECT_TARGET } from '../../sim/modules/responses/responseCost'
import { formatDuration } from '../../sim/modules/ownerActions/stateHelpers'

function titleCase(text: string): string {
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function compactAmount(amount: number): string {
  if (Object.is(amount, -0)) return '0'
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  return `${sign}${Number.isInteger(abs) ? abs.toString() : abs.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')}`
}

function entityLabel(state: TavernState | undefined, kind: string, id: string): string {
  switch (kind) {
    case 'stock':
      return state?.stock[id]?.label ?? titleCase(id)
    case 'areas':
    case 'area':
      return state?.areas[id]?.label ?? titleCase(id)
    case 'staff':
      return state?.staff[id]?.name.display ?? titleCase(id)
    case 'customers':
    case 'customer':
      return state?.customerGroups[id]?.label ?? titleCase(id)
    case 'suppliers':
    case 'supplier':
      return state?.world.suppliers[id]?.label ?? titleCase(id)
    case 'factions':
    case 'faction':
      return state?.world.factions[id]?.label ?? titleCase(id)
    case 'regular':
    case 'regulars':
      return state?.world.regulars[id]?.name.display ?? titleCase(id)
    case 'culture':
    case 'cultures':
      return state?.world.cultures[id]?.label ?? titleCase(id)
    default:
      return titleCase(id)
  }
}

function meterLabel(effect: EffectPreview): string | undefined {
  return effect.meterLabel ? titleCase(effect.meterLabel) : undefined
}

function labelFromDottedTarget(effect: EffectPreview, state?: TavernState): string | undefined {
  const parts = effect.target.split('.')
  if (parts.length === 0) return undefined
  if (effect.target === 'coin') return 'Coin'
  // Phase 200 / audit Wave 1 — the rent payment is a coin cost that runs
  // through a transition; the player reads it as coin leaving the till.
  if (effect.target === RENT_PAYMENT_EFFECT_TARGET) return 'Coin'
  if (parts[0] === 'reputation' && parts[1]) {
    return `${meterLabel(effect) ?? titleCase(parts[1])} Reputation`
  }
  if (parts[0] === 'stock' && parts[1]) {
    return [entityLabel(state, 'stock', parts[1]), meterLabel(effect) ?? titleCase(parts[parts.length - 1]!)]
      .filter(Boolean)
      .join(' ')
  }
  if (parts[0] === 'areas' && parts[1]) {
    return [entityLabel(state, 'areas', parts[1]), meterLabel(effect) ?? titleCase(parts[parts.length - 1]!)]
      .filter(Boolean)
      .join(' ')
  }
  if (parts[0] === 'staff' && parts[1]) {
    return [entityLabel(state, 'staff', parts[1]), meterLabel(effect) ?? titleCase(parts[parts.length - 1]!)]
      .filter(Boolean)
      .join(' ')
  }
  if (parts[0] === 'customers' && parts[1]) {
    return [entityLabel(state, 'customers', parts[1]), meterLabel(effect) ?? titleCase(parts[parts.length - 1]!)]
      .filter(Boolean)
      .join(' ')
  }
  if (parts[0] === 'cultures' && parts[1]) {
    return [
      entityLabel(state, 'cultures', parts[1]),
      meterLabel(effect) ?? titleCase(parts[parts.length - 1]!),
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (parts[0] === 'world' && parts[1] && parts[2]) {
    const worldKind = parts[1]
    return [
      entityLabel(state, worldKind, parts[2]),
      meterLabel(effect) ?? titleCase(parts[parts.length - 1]!),
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (effect.meterLabel) return titleCase(effect.meterLabel)
  return undefined
}

function labelFromColonTarget(effect: EffectPreview, state?: TavernState): string | undefined {
  const [kind, id] = effect.target.split(':')
  if (!kind || !id) return undefined
  if (kind === 'pressure') return meterLabel(effect) ?? titleCase(id)
  return entityLabel(state, kind, id)
}

function effectLabel(effect: EffectPreview, state?: TavernState): string | undefined {
  if (effect.target.includes(':')) return labelFromColonTarget(effect, state)
  return labelFromDottedTarget(effect, state) ?? meterLabel(effect)
}

/**
 * Compact player-facing mechanical text for a card choice effect.
 *
 * The card layer keeps the authored flavour preview separately; this helper is
 * the numeric companion. It includes exact amounts when the sim supplied one
 * and falls back to the effect's existing readable line for non-numeric hooks.
 */
export function formatEffectPreview(
  effect: EffectPreview,
  state?: TavernState,
): string {
  if (effect.amount === undefined || !Number.isFinite(effect.amount)) {
    return effect.readable
  }
  const label = effectLabel(effect, state)
  if (!label) return effect.readable
  // Phase 203 / audit Wave 4 (`P6-COMP-005`) — owner time is minutes off
  // the day clock, and the player reads the day clock in hours and
  // minutes everywhere else (Top Bar, planner, action costs). `Owner Time
  // -60` would be the amount without being the answer; `Owner Time -1h`
  // compares directly against the six hours the day is made of.
  if (effect.target === OWNER_TIME_EFFECT_TARGET) {
    const sign = effect.amount > 0 ? '+' : '-'
    return `${label} ${sign}${formatDuration(Math.abs(effect.amount))}`
  }
  return `${label} ${compactAmount(effect.amount)}`
}
