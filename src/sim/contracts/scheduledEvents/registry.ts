import { Registry } from '../../registries/Registry'

import type { ScheduledEventDefinition } from './types'

// Expansion Phase 1 §1.1 — the mechanical event-type registry.
//
// `Registry<T>` keys on `id`, and a scheduled-event definition keys on
// `type`, so definitions are adapted rather than stored raw. The adapter
// is what enforces the ownership rule the plan calls out: registering a
// type a different module already owns THROWS. Two domains silently
// sharing an event type is exactly how "who applies this mutation?"
// becomes unanswerable.

type RegisteredScheduledEvent = { id: string; definition: ScheduledEventDefinition }

const registry = new Registry<RegisteredScheduledEvent>()

export function registerScheduledEvent(definition: ScheduledEventDefinition): void {
  const existing = registry.has(definition.type)
    ? registry.get(definition.type).definition
    : undefined
  if (existing) {
    if (existing.ownerModuleId !== definition.ownerModuleId) {
      throw new Error(
        `scheduledEvents: '${definition.type}' is already owned by module ` +
          `'${existing.ownerModuleId}'; '${definition.ownerModuleId}' cannot claim it`,
      )
    }
    // Same owner re-registering the same type is an idempotent
    // `ensureRequired…` call from a re-imported module, not an error.
    return
  }
  if (definition.repeat && definition.repeat.maxOccurrences < 1) {
    throw new Error(
      `scheduledEvents: '${definition.type}' declares a repeat with maxOccurrences < 1`,
    )
  }
  if (definition.expiryDays < 0) {
    throw new Error(
      `scheduledEvents: '${definition.type}' declares a negative expiry window`,
    )
  }
  registry.register({ id: definition.type, definition })
}

export function getScheduledEventDefinition(
  type: string,
): ScheduledEventDefinition | undefined {
  return registry.has(type) ? registry.get(type).definition : undefined
}

export function hasScheduledEventDefinition(type: string): boolean {
  return registry.has(type)
}

export function allScheduledEventDefinitions(): ScheduledEventDefinition[] {
  return registry
    .all()
    .map((entry) => entry.definition)
    .sort((a, b) => a.type.localeCompare(b.type))
}

/**
 * Find the definition that claims a future-hook NAME.
 *
 * Expansion Phase 2 §2.2 — exact type match first (Phase 1's behaviour,
 * unchanged), then the longest declared `futureHookPrefixes` match. Longest-
 * wins is what stops a broad family (`area_`) shadowing a narrow one
 * (`area_collapse_risk_`), and the tie-break on type id keeps the choice
 * deterministic if two definitions somehow declare the same prefix length.
 */
export function findScheduledEventDefinitionForHookName(
  hookName: string,
): ScheduledEventDefinition | undefined {
  const exact = getScheduledEventDefinition(hookName)
  if (exact) return exact

  let best: { definition: ScheduledEventDefinition; length: number } | undefined
  for (const definition of allScheduledEventDefinitions()) {
    for (const prefix of definition.futureHookPrefixes ?? []) {
      if (!hookName.startsWith(prefix)) continue
      if (hookName.length === prefix.length) continue
      if (
        !best ||
        prefix.length > best.length ||
        (prefix.length === best.length &&
          definition.type.localeCompare(best.definition.type) < 0)
      ) {
        best = { definition, length: prefix.length }
      }
    }
  }
  return best?.definition
}

/** Test-only. Production code registers once at module import. */
export function clearScheduledEventRegistry(): void {
  registry.clear()
}

export function unregisterScheduledEvent(type: string): boolean {
  return registry.unregister(type)
}
