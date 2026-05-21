// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// `evalCondition(condition, seed, state)` is the only function the
// assembler calls per snippet condition. One small arm per `kind`. Every
// arm is pure, side-effect-free, and tolerant of missing inputs — a
// condition that can't resolve simply returns `false` so a less-specific
// snippet wins (framework §5 forward-seam pattern, "unresolvable →
// graceful degradation").

import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type {
  EntityRef,
  TavernState,
} from '../../sim/state/TavernState'
import type { CastAttributes } from '../../sim/content/cast'
import type { SnippetCondition } from './types'

/** Resolve the actor referenced by a role string against the seed. v1
 *  rules:
 *  - `'primaryActor'` → `seed.primaryActor`
 *  - any other role → first `seed.textIngredients.namedEntities` entry
 *    whose `role` matches
 *  Returns `undefined` when nothing resolves. */
function resolveActorRef(role: string, seed: IssueSeed): EntityRef | undefined {
  if (role === 'primaryActor') return seed.primaryActor
  const named = seed.textIngredients.namedEntities?.find((n) => n.role === role)
  return named?.ref
}

/** Look up the resolved actor's `castAttributes`. Returns `undefined`
 *  when the actor doesn't resolve, when the kind has no cast surface
 *  yet (e.g. supplier, faction), or when the entity exists but the
 *  Phase-A migration hasn't reached it. */
function resolveActorCastAttributes(
  role: string,
  seed: IssueSeed,
  state: TavernState,
): CastAttributes | undefined {
  const ref = resolveActorRef(role, seed)
  if (!ref) return undefined
  if (ref.kind === 'staff') return state.staff[ref.id]?.castAttributes
  if (ref.kind === 'regular') return state.world.regulars[ref.id]?.castAttributes
  return undefined
}

/** Collect the seed tags the `hasTag` condition matches against:
 *  domain ∪ toneHints ∪ stake tags (framework §2.3 comment). Computed
 *  on demand so the assembler doesn't pay for it when no `hasTag` is in
 *  the pool. */
function collectSeedTags(seed: IssueSeed): Set<string> {
  const out = new Set<string>()
  for (const d of seed.domain) out.add(d)
  for (const t of seed.toneHints) out.add(t)
  for (const stake of seed.stakes) {
    for (const tag of stake.tags) out.add(tag)
  }
  return out
}

export function evalCondition(
  condition: SnippetCondition,
  seed: IssueSeed,
  state: TavernState,
): boolean {
  switch (condition.kind) {
    case 'seedFamily':
      return condition.anyOf.includes(seed.family as never)

    case 'seedType':
      return condition.anyOf.includes(seed.type)

    case 'timing':
      return condition.anyOf.includes(seed.timing)

    case 'severityAtLeast':
      return seed.severity >= condition.value

    case 'severityBelow':
      return seed.severity < condition.value

    case 'hasTag':
      return collectSeedTags(seed).has(condition.tag)

    case 'hasNamedEntity': {
      const named = seed.textIngredients.namedEntities ?? []
      return named.some((entry) => {
        if (condition.role !== undefined && entry.role !== condition.role) {
          return false
        }
        if (
          condition.entityKind !== undefined &&
          entry.ref.kind !== condition.entityKind
        ) {
          return false
        }
        return true
      })
    }

    case 'pressureRising': {
      const snapshot =
        state.modules &&
        (state.modules as { pressures?: { snapshots?: Record<string, { trend?: string }> } })
          .pressures?.snapshots?.[condition.pressureId]
      if (snapshot && snapshot.trend) return snapshot.trend === 'rising'
      // Fall back to the lightweight on-state shape — positive trend
      // means rising.
      const pressure = state.pressures[condition.pressureId]
      if (!pressure) return false
      return pressure.trend > 0
    }

    case 'memoryPresent': {
      if (condition.tag === undefined) return state.memories.length > 0
      const tag = condition.tag
      return state.memories.some((m) => m.tags.includes(tag))
    }

    case 'repeatCount': {
      // The sim does not yet emit per-subject repeat tracking (Phase B
      // §"Reality check"). Until it does, this condition is structurally
      // declared but always false. Phase D / E will revisit once the
      // sim signal exists.
      return false
    }

    case 'actorTrait': {
      // Forward seam (framework §5). No actor carries a flat
      // `trait: string` field today, so this never matches. Phase C
      // does NOT implement exact-string equality against voice axes —
      // Phase B settled that the comparison-aware `voiceAxis` forms
      // are the correct bridge.
      return false
    }

    case 'voiceAxis': {
      const cast = resolveActorCastAttributes(condition.role, seed, state)
      if (!cast) return false
      const value = cast.voice.axes[condition.axis]
      if ('atLeast' in condition) return value >= condition.atLeast
      return value <= condition.atMost
    }

    case 'verbalTic': {
      const cast = resolveActorCastAttributes(condition.role, seed, state)
      if (!cast) return false
      return cast.voice.verbalTic === condition.tic
    }
  }
}

export const __internal = {
  resolveActorRef,
  resolveActorCastAttributes,
  collectSeedTags,
}
