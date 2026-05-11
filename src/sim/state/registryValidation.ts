// Phase 26 §26.5 — Registry membership and uniqueness helpers.
//
// Zod schemas can validate shape; they cannot easily validate that an id
// actually exists in a runtime registry. These small helpers exist so that
// `referenceValidation.ts` and later phase validators can speak the same
// `ValidationIssue` dialect without each rolling its own bookkeeping.
//
// The helpers are pure and synchronous: they read from a caller-supplied
// `exists` predicate (typically `registry.has`) rather than importing
// registries themselves so import order never matters.

import type { ValidationIssue } from './types'

export function validateRegistryId(
  path: string,
  registryName: string,
  id: string,
  exists: (id: string) => boolean,
): ValidationIssue[] {
  if (id.length === 0) {
    return [
      {
        path,
        message: `${registryName} id is empty`,
        code: 'empty_registry_id',
      },
    ]
  }
  if (!exists(id)) {
    return [
      {
        path,
        message: `Unknown ${registryName} id '${id}'`,
        code: 'unknown_registry_id',
      },
    ]
  }
  return []
}

export function validateUniqueIds(
  path: string,
  ids: string[],
): ValidationIssue[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  if (duplicates.size === 0) return []
  return [...duplicates].map((id) => ({
    path,
    message: `Duplicate id '${id}'`,
    code: 'duplicate_id',
  }))
}
