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
import { querySignal, repeatCountByTag } from '../../sim/signals'
import { classifyCause, pickDominantCause } from '../../sim/modules/causes'
import type { ConditionContext, SnippetCondition } from './types'

/** Resolve the actor referenced by a role string against the seed. v1
 *  rules:
 *  - `'primaryActor'` → `seed.primaryActor`
 *  - `'location'` → `seed.location` (Phase 137 / ISSUE-106; lets
 *    narrator-voiced area-centred cards reach the area through the
 *    signal surface without inventing a namedEntities entry)
 *  - any other role → first `seed.textIngredients.namedEntities` entry
 *    whose `role` matches
 *  Returns `undefined` when nothing resolves. */
function resolveActorRef(role: string, seed: IssueSeed): EntityRef | undefined {
  if (role === 'primaryActor') return seed.primaryActor
  if (role === 'location') return seed.location
  const named = seed.textIngredients.namedEntities?.find((n) => n.role === role)
  return named?.ref
}

/** Look up the resolved actor's `castAttributes`. Returns `undefined`
 *  when the actor doesn't resolve, when the entity exists but the
 *  Phase-A / Phase-2 migration hasn't reached it, or when the kind has
 *  no cast surface at all.
 *
 *  Phase 128 / ISSUE-097 — coverage widened to the four new actor kinds:
 *  supplier, faction, notable_npc carry the full shape; customer_group
 *  carries voice-only (groups are cohorts, not individuals — see
 *  `castTypes.ts` `CustomerGroupCastAttributes`). The adapter shape
 *  below keeps the return type uniform so the `CastAttribute`
 *  primitives (voiceAxis*, verbalTic, actorTrait) evaluate identically
 *  across kinds; specialty/blindspot/affinities on a group will not
 *  match because the adapter returns empty defaults — that's the
 *  intended behaviour. */
function resolveActorCastAttributes(
  role: string,
  seed: IssueSeed,
  state: TavernState,
): CastAttributes | undefined {
  const ref = resolveActorRef(role, seed)
  if (!ref) return undefined
  if (ref.kind === 'staff') return state.staff[ref.id]?.castAttributes
  if (ref.kind === 'regular') return state.world.regulars[ref.id]?.castAttributes
  if (ref.kind === 'supplier') return state.world.suppliers[ref.id]?.castAttributes
  if (ref.kind === 'faction') return state.world.factions[ref.id]?.castAttributes
  if (ref.kind === 'notable_npc') {
    return state.world.notableNpcs[ref.id]?.castAttributes
  }
  if (ref.kind === 'customer_group') {
    const group = state.customerGroups[ref.id]
    if (!group?.castAttributes) return undefined
    return {
      specialty: '',
      blindspot: '',
      affinities: [],
      voice: group.castAttributes.voice,
    }
  }
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
  ctx: ConditionContext = {},
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
      const { tag, scopeToActor, minAgeDays } = condition
      // Fast path: original global, any-age semantics when neither
      // optional field is set (preserves every pre-Phase-187 caller).
      if (scopeToActor === undefined && minAgeDays === undefined) {
        if (tag === undefined) return state.memories.length > 0
        return state.memories.some((m) => m.tags.includes(tag))
      }
      // Phase 187 / ISSUE-154 — scoped / age-gated lookup. Resolve the
      // actor once; an unresolvable actor means no memory can match
      // (graceful degradation, framework §5).
      const scopedRef =
        scopeToActor !== undefined
          ? resolveActorRef(scopeToActor, seed)
          : undefined
      if (scopeToActor !== undefined && !scopedRef) return false
      const today = state.calendar.totalDaysElapsed
      return state.memories.some((m) => {
        if (tag !== undefined && !m.tags.includes(tag)) return false
        if (
          scopedRef &&
          !m.actors.some(
            (a) => a.kind === scopedRef.kind && a.id === scopedRef.id,
          )
        ) {
          return false
        }
        if (
          minAgeDays !== undefined &&
          today - m.createdAt.absoluteDay < minAgeDays
        ) {
          return false
        }
        return true
      })
    }

    case 'repeatCount': {
      // Phase 127 / ISSUE-096 — wired to the signal surface. Counts
      // memories tagged with `subjectTag` inside the rolling window
      // (default 28 days). No schema migration — memories already carry
      // `tags` + `createdAt.absoluteDay`. Returns false if the count is
      // below threshold so a less-specific snippet still wins.
      return repeatCountByTag(state, condition.subjectTag) >= condition.atLeast
    }

    case 'dominantCause': {
      // Phase 188 / ISSUE-155 — read-only over `seed.causes`. Classify
      // the dominant negative cause and match against `anyOf`. An empty
      // / all-positive / unclassifiable `causes` array yields no class,
      // so the cause line omits and a less-specific (or no) snippet wins
      // — graceful degradation, framework §5.
      const cls = classifyCause(pickDominantCause(seed.causes))
      if (cls === undefined) return false
      return condition.anyOf.includes(cls)
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

    case 'signalEquals': {
      // Phase 127 / ISSUE-096 — read-only query against the signal
      // surface. The dispatcher returns `{ missing: true }` for an
      // unresolvable actor, a kind mismatch, or an absent field; we
      // treat all of those as no-match so a less-specific snippet wins.
      const ref = resolveActorRef(condition.role, seed)
      if (!ref) return false
      const result = querySignal(state, condition.signal, ref)
      if ('missing' in result) return false
      return result.band === condition.equals
    }

    case 'responseVerb': {
      // Phase 132 / ISSUE-101 — reads `ctx.currentResponseSlot`, which the
      // choice helper threads in per response slot. Body / title evaluation
      // passes no context, so this returns false there (intended).
      const slot = ctx.currentResponseSlot
      if (!slot) return false
      return slot.allowedVerbs.some((v) =>
        (condition.anyOf as readonly string[]).includes(v),
      )
    }

    case 'responseShape': {
      const slot = ctx.currentResponseSlot
      if (!slot) return false
      return (condition.anyOf as readonly string[]).includes(slot.shape)
    }

    case 'responseSlot': {
      // Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3.
      // Slot-discriminating gate. Reads `ctx.currentResponseSlot?.id`;
      // returns false outside choice iteration (body / title slots).
      const slot = ctx.currentResponseSlot
      if (!slot) return false
      return condition.anyOf.includes(slot.id)
    }

    case 'effectKind': {
      // Reads `ctx.currentEffect`, threaded in per immediate effect by
      // the choice helper. Body / title slots evaluate with no context
      // and the condition returns false.
      const effect = ctx.currentEffect
      if (!effect) return false
      return (condition.anyOf as readonly string[]).includes(effect.kind)
    }

    case 'effectTag': {
      const effect = ctx.currentEffect
      if (!effect) return false
      return effect.tags.includes(condition.tag)
    }

    case 'effectTargetKind': {
      // Phase 145 / ISSUE-113 — reads the structural target classification
      // that `effect()` in `generatorHelpers.ts` writes onto every preview.
      // Older serialized seeds that pre-date the field return false here
      // (graceful degradation).
      const effect = ctx.currentEffect
      if (!effect || effect.targetKind === undefined) return false
      return (condition.anyOf as readonly string[]).includes(effect.targetKind)
    }

    case 'effectDirection': {
      const effect = ctx.currentEffect
      if (!effect || effect.direction === undefined) return false
      return effect.direction === condition.sign
    }

    case 'effectMagnitudeBand': {
      // `magnitudeBand` is undefined for zero / missing amounts (cause
      // effects, neutral markers). Snippets gated on magnitude should
      // never match those — voice-on-zero is ambiguous anyway.
      const effect = ctx.currentEffect
      if (!effect || effect.magnitudeBand === undefined) return false
      return (condition.anyOf as readonly string[]).includes(
        effect.magnitudeBand,
      )
    }

    case 'effectMeter': {
      // Phase 181 / ISSUE-149 — reads the distinguishing meter leaf that
      // `effect()` in `generatorHelpers.ts` writes onto every preview.
      // Older serialized seeds that pre-date the field return false here
      // (graceful degradation), same as the sibling effect* arms.
      const effect = ctx.currentEffect
      if (!effect || effect.meterId === undefined) return false
      return condition.anyOf.includes(effect.meterId)
    }

    case 'inactionPreview': {
      // Phase 147 / ISSUE-115 — true when `composeChoicesFromSeed`
      // routed the preview through `delayedEffects` (immediate was
      // empty). Snippets gated on `value: true` only fire on the
      // inaction path. `value: false` makes a snippet explicitly
      // non-inaction; ctx field absent ⇒ neither variant matches.
      if (ctx.inactionPreview === undefined) return false
      return ctx.inactionPreview === condition.value
    }
  }
}

export const __internal = {
  resolveActorRef,
  resolveActorCastAttributes,
  collectSeedTags,
}
