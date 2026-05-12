import type { SimContext } from '../../core/context'
import type {
  EntityRef,
  MemoryState,
  TavernState,
} from '../../state/TavernState'

import type { MemoryDraft } from './memoryTypes'

// Phase 36 §36.1 — Entity memory ownership semantics.
//
// The canonical `MemoryState` shape (defined in `state/TavernState.ts`)
// already carries `actors`, `locations`, `relatedSystems`, `tags`, and a
// free-form `metadata` record. Phase 36 layers ownership semantics on
// top of that shape rather than forking the record: a memory still lives
// in `state.memories`, but its `metadata` now describes who *remembers*
// the event, who was the *subject* of it, who was *blamed* or *credited*,
// and what objective source artifacts (causes, scenes, projects, arcs)
// it grew out of.
//
// Keep this file dependency-light: it is imported from query helpers,
// the engine's context layer, and the pattern detector — all of which
// need stable serializable shapes.

// ---------- Metadata shapes ----------

export type EntityMemoryRole =
  | 'owner'
  | 'subject'
  | 'beneficiary'
  | 'target'
  | 'witness'
  | 'blamed'
  | 'credited'

export type EntityMemoryMetadata = {
  /** Who remembers this event — the canonical owner of the memory. */
  owner?: EntityRef
  /** Entities the memory is *about* without being blamed or credited. */
  subjects?: EntityRef[]
  /** Entities that came out ahead because of the event. */
  beneficiaries?: EntityRef[]
  /** Entities on the receiving end (apology target, blamed party, etc). */
  targets?: EntityRef[]
  /** Entities that saw the event but were not directly involved. */
  witnesses?: EntityRef[]
  /** Who is held responsible according to the memory. */
  blamed?: EntityRef[]
  /** Who is given credit for a positive event. */
  credited?: EntityRef[]
  /** Objective source-event references (history, scenes, etc.). */
  sourceEventId?: string
  sourceCauseIds?: string[]
  sourceSceneIds?: string[]
  sourceProjectIds?: string[]
  sourceArcIds?: string[]
}

/** Same options shape used by both `memoriesForOwner` and
 *  `memoriesAboutEntity`. Filters are intersection rules: a memory must
 *  match every supplied option. */
export type EntityMemoryQueryOptions = {
  tags?: string[]
  minStrength?: number
  types?: MemoryState['type'][]
  /** When true, also include memories whose recorded duration has
   *  elapsed but that have not yet been pruned by the aging step. By
   *  default expired memories are filtered out. */
  includeExpired?: boolean
  limit?: number
}

// ---------- Refs helpers ----------

function entityRefEquals(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id
}

function refListIncludes(
  list: ReadonlyArray<EntityRef> | undefined,
  entity: EntityRef,
): boolean {
  if (!list) return false
  for (const ref of list) {
    if (entityRefEquals(ref, entity)) return true
  }
  return false
}

function readMetadata(memory: MemoryState): EntityMemoryMetadata {
  if (!memory.metadata) return {}
  return memory.metadata as EntityMemoryMetadata
}

// ---------- Read helpers ----------

export function memoryOwner(memory: MemoryState): EntityRef | undefined {
  return readMetadata(memory).owner
}

export function memorySubjects(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.subjects ? [...meta.subjects] : []
}

export function memoryTargets(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.targets ? [...meta.targets] : []
}

export function memoryBeneficiaries(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.beneficiaries ? [...meta.beneficiaries] : []
}

export function memoryWitnesses(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.witnesses ? [...meta.witnesses] : []
}

export function memoryCredited(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.credited ? [...meta.credited] : []
}

export function memoryBlamed(memory: MemoryState): EntityRef[] {
  const meta = readMetadata(memory)
  return meta.blamed ? [...meta.blamed] : []
}

// ---------- Match predicates ----------

/**
 * A memory counts as being **for an owner** if any of the following hold:
 *   1. `metadata.owner` matches the entity, or
 *   2. `actors` includes the entity and no owner is specified, or
 *   3. `locations` includes the entity for area-owned memories.
 */
export function memoryBelongsTo(
  memory: MemoryState,
  owner: EntityRef,
): boolean {
  const meta = readMetadata(memory)
  if (meta.owner) return entityRefEquals(meta.owner, owner)
  if (refListIncludes(memory.actors, owner)) return true
  if (owner.kind === 'area' && refListIncludes(memory.locations, owner)) {
    return true
  }
  return false
}

/**
 * A memory counts as being **about an entity** if the entity appears in
 * any subject-like field, in `actors`, or in `locations`. Owner alone
 * does not count: a memory `about Brakka` should not match a memory
 * `owned by Brakka about a third party`.
 */
export function memoryIsAbout(
  memory: MemoryState,
  entity: EntityRef,
): boolean {
  const meta = readMetadata(memory)
  if (refListIncludes(meta.subjects, entity)) return true
  if (refListIncludes(meta.targets, entity)) return true
  if (refListIncludes(meta.beneficiaries, entity)) return true
  if (refListIncludes(meta.blamed, entity)) return true
  if (refListIncludes(meta.credited, entity)) return true
  if (refListIncludes(meta.witnesses, entity)) return true
  if (refListIncludes(memory.actors, entity)) return true
  if (refListIncludes(memory.locations, entity)) return true
  return false
}

// ---------- Filter helpers ----------

function isExpired(memory: MemoryState): boolean {
  if (memory.durationDays === undefined) return false
  return memory.ageDays >= memory.durationDays
}

export function applyEntityMemoryFilters(
  memories: ReadonlyArray<MemoryState>,
  options?: EntityMemoryQueryOptions,
): MemoryState[] {
  const out: MemoryState[] = []
  for (const memory of memories) {
    if (!options?.includeExpired && isExpired(memory)) continue
    if (
      options?.minStrength !== undefined &&
      memory.strength < options.minStrength
    ) {
      continue
    }
    if (options?.types && options.types.length > 0 && !options.types.includes(memory.type)) {
      continue
    }
    if (options?.tags && options.tags.length > 0) {
      let hasAll = true
      for (const tag of options.tags) {
        if (!memory.tags.includes(tag)) {
          hasAll = false
          break
        }
      }
      if (!hasAll) continue
    }
    out.push(memory)
  }
  if (options?.limit !== undefined && out.length > options.limit) {
    return out.slice(0, options.limit)
  }
  return out
}

// ---------- Draft helpers ----------

/**
 * Returns a new draft whose `metadata` carries the supplied
 * `EntityMemoryMetadata`. Existing metadata is preserved; supplied
 * entries override fields with the same key.
 */
export function withEntityMemoryMetadata(
  draft: MemoryDraft,
  metadata: EntityMemoryMetadata,
): MemoryDraft {
  const existing = (draft.metadata ?? {}) as Record<string, unknown>
  return {
    ...draft,
    metadata: { ...existing, ...metadata },
  }
}

/**
 * Variant of {@link withEntityMemoryMetadata} that also ensures the
 * supplied owner appears in `actors`. The memory module already keys
 * actor-based queries off this list, so adding the owner there keeps
 * legacy callers (`ctx.getMemoriesForActor`) consistent without forcing
 * them to learn about metadata.
 */
export function attachEntityOwnerToDraft(
  draft: MemoryDraft,
  owner: EntityRef,
  rest?: Omit<EntityMemoryMetadata, 'owner'>,
): MemoryDraft {
  const metadata: EntityMemoryMetadata = { owner, ...(rest ?? {}) }
  const next = withEntityMemoryMetadata(draft, metadata)
  const actors = next.actors ? [...next.actors] : []
  if (!actors.some((a) => entityRefEquals(a, owner))) {
    actors.push(owner)
  }
  return { ...next, actors }
}

// ---------- TavernState-facing queries ----------

function asMemoryList(
  input: TavernState | ReadonlyArray<MemoryState>,
): ReadonlyArray<MemoryState> {
  if (Array.isArray(input)) return input
  return (input as TavernState).memories
}

export function memoriesForOwner(
  state: TavernState | ReadonlyArray<MemoryState>,
  owner: EntityRef,
  options?: EntityMemoryQueryOptions,
): MemoryState[] {
  const matches: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memoryBelongsTo(memory, owner)) matches.push(memory)
  }
  return applyEntityMemoryFilters(matches, options)
}

export function memoriesAboutEntity(
  state: TavernState | ReadonlyArray<MemoryState>,
  entity: EntityRef,
  options?: EntityMemoryQueryOptions,
): MemoryState[] {
  const matches: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    if (memoryIsAbout(memory, entity)) matches.push(memory)
  }
  return applyEntityMemoryFilters(matches, options)
}

export function grudgesAgainst(
  state: TavernState | ReadonlyArray<MemoryState>,
  target: EntityRef,
): MemoryState[] {
  const matches: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    const meta = readMetadata(memory)
    if (refListIncludes(meta.blamed, target)) {
      matches.push(memory)
      continue
    }
    if (memory.type === 'grudge' && refListIncludes(meta.targets, target)) {
      matches.push(memory)
    }
  }
  return applyEntityMemoryFilters(matches)
}

export function gratitudeToward(
  state: TavernState | ReadonlyArray<MemoryState>,
  target: EntityRef,
): MemoryState[] {
  const matches: MemoryState[] = []
  for (const memory of asMemoryList(state)) {
    const meta = readMetadata(memory)
    if (refListIncludes(meta.credited, target)) matches.push(memory)
  }
  return applyEntityMemoryFilters(matches)
}

export function strongestMemoryFor(
  state: TavernState | ReadonlyArray<MemoryState>,
  owner: EntityRef,
  tags?: string[],
): MemoryState | undefined {
  const options: EntityMemoryQueryOptions = {}
  if (tags && tags.length > 0) options.tags = tags
  const candidates = memoriesForOwner(state, owner, options)
  if (candidates.length === 0) return undefined
  let best: MemoryState | undefined
  for (const memory of candidates) {
    if (!best || memory.strength > best.strength) best = memory
  }
  return best
}

// ---------- Context helper ----------

/**
 * Standalone implementation of `ctx.addEntityMemory`. Lives outside the
 * engine so tests and modules can call it directly when they want to
 * skip the context (e.g. constructing fixtures). The engine wires its
 * own `addEntityMemory` to call this with the live context.
 */
export function addEntityMemoryViaCtx(
  ctx: SimContext,
  owner: EntityRef,
  draft: MemoryDraft,
  metadata?: Omit<EntityMemoryMetadata, 'owner'>,
): MemoryState {
  const enriched = attachEntityOwnerToDraft(draft, owner, metadata)
  return ctx.addMemory(enriched)
}
