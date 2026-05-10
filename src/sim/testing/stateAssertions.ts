import { safeValidateState } from '../state/validation'
import type { TavernState } from '../state/TavernState'

// Phase 6 §6.5 — State assertions for tests.
//
// These are intentionally framework-free: they throw plain `Error` on
// failure so they compose with any test runner. They will be the standard
// post-tick invariants once the engine (Phase 7) is in place.

export function expectValidState(state: unknown): asserts state is TavernState {
  const result = safeValidateState(state)
  if (!result.success) {
    const lines = result.errors.map((e) => `  ${e.path || '<root>'}: ${e.message}`)
    throw new Error(['expectValidState failed:', ...lines].join('\n'))
  }
}

export function expectNoNegativeStock(state: TavernState): void {
  const issues: string[] = []
  for (const [id, item] of Object.entries(state.stock)) {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      issues.push(`stock.${id}.quantity = ${item.quantity}`)
    }
  }
  if (issues.length > 0) {
    throw new Error('expectNoNegativeStock failed:\n  ' + issues.join('\n  '))
  }
}

function checkMeter(path: string, value: number, issues: string[]): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    issues.push(`${path} out of 0–100 range: ${value}`)
  }
}

export function expectPercentRangesValid(state: TavernState): void {
  const issues: string[] = []

  for (const [id, area] of Object.entries(state.areas)) {
    checkMeter(`areas.${id}.condition`, area.condition, issues)
    checkMeter(`areas.${id}.cleanliness`, area.cleanliness, issues)
    checkMeter(`areas.${id}.mess`, area.mess, issues)
    checkMeter(`areas.${id}.damage`, area.damage, issues)
    checkMeter(`areas.${id}.smell`, area.smell, issues)
    checkMeter(`areas.${id}.risk`, area.risk, issues)
  }

  for (const [id, item] of Object.entries(state.stock)) {
    checkMeter(`stock.${id}.quality`, item.quality, issues)
    checkMeter(`stock.${id}.spoilage`, item.spoilage, issues)
  }

  for (const [id, staff] of Object.entries(state.staff)) {
    checkMeter(`staff.${id}.skill`, staff.skill, issues)
    checkMeter(`staff.${id}.morale`, staff.morale, issues)
    checkMeter(`staff.${id}.stress`, staff.stress, issues)
    checkMeter(`staff.${id}.fatigue`, staff.fatigue, issues)
    checkMeter(`staff.${id}.loyalty`, staff.loyalty, issues)
  }

  for (const [id, group] of Object.entries(state.customerGroups)) {
    checkMeter(`customerGroups.${id}.patronage`, group.patronage, issues)
    checkMeter(`customerGroups.${id}.satisfaction`, group.satisfaction, issues)
    checkMeter(`customerGroups.${id}.wealth`, group.wealth, issues)
    checkMeter(`customerGroups.${id}.rowdiness`, group.rowdiness, issues)
    checkMeter(`customerGroups.${id}.dangerTolerance`, group.dangerTolerance, issues)
    checkMeter(`customerGroups.${id}.filthTolerance`, group.filthTolerance, issues)
    checkMeter(`customerGroups.${id}.priceSensitivity`, group.priceSensitivity, issues)
    checkMeter(`customerGroups.${id}.damageRisk`, group.damageRisk, issues)
    checkMeter(`customerGroups.${id}.tabRisk`, group.tabRisk, issues)
  }

  for (const axis of Object.keys(state.reputation) as Array<keyof typeof state.reputation>) {
    checkMeter(`reputation.${String(axis)}`, state.reputation[axis], issues)
  }

  for (const [id, pressure] of Object.entries(state.pressures)) {
    checkMeter(`pressures.${id}.value`, pressure.value, issues)
  }

  if (issues.length > 0) {
    throw new Error('expectPercentRangesValid failed:\n  ' + issues.join('\n  '))
  }
}

export function expectCalendarValid(state: TavernState): void {
  const c = state.calendar
  const issues: string[] = []
  if (!Number.isInteger(c.day) || c.day < 1 || c.day > 28) {
    issues.push(`calendar.day out of range: ${c.day}`)
  }
  if (!Number.isInteger(c.week) || c.week < 1 || c.week > 4) {
    issues.push(`calendar.week out of range: ${c.week}`)
  }
  if (!Number.isInteger(c.month) || c.month < 1 || c.month > 12) {
    issues.push(`calendar.month out of range: ${c.month}`)
  }
  if (!Number.isInteger(c.year) || c.year < 1) {
    issues.push(`calendar.year out of range: ${c.year}`)
  }
  if (!Number.isInteger(c.dayOfWeek) || c.dayOfWeek < 1 || c.dayOfWeek > 7) {
    issues.push(`calendar.dayOfWeek out of range: ${c.dayOfWeek}`)
  }
  if (!Number.isInteger(c.totalDaysElapsed) || c.totalDaysElapsed < 0) {
    issues.push(`calendar.totalDaysElapsed out of range: ${c.totalDaysElapsed}`)
  }
  if (issues.length > 0) {
    throw new Error('expectCalendarValid failed:\n  ' + issues.join('\n  '))
  }
}
