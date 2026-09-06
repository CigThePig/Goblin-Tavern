import type { CustomerGroupState, TavernState } from '../../state/TavernState'

export type IdentityEvidence = {
  label: string
  kind: 'knownFor' | 'atmosphere'
  strength: number
  supportedDays: number
  publicDays: number
  witnesses: number
  lastSupportedDay: number
}
export type IdentityEvidenceState = {
  evidence: Record<string, IdentityEvidence>
  lastObservedDay: number
}
/** Bounded independently of history length or procedurally generated labels. */
export const MAX_IDENTITY_EVIDENCE = 32
export const IDENTITY_ENTER = 4
export const IDENTITY_EXIT = 1
export const NICKNAME_PUBLIC_DAYS = 5
export const NICKNAME_WITNESSES = 25
export const MAX_EARNED_NICKNAMES = 3
export const NICKNAME_WORDING: Record<string, string> = {
  'cheap drinks': 'The Copper Cup',
  'tasty plates': 'The Second Helping',
  'an unfussy floor': 'The Sticky Boot',
  'a rough edge': 'The Broken Tooth',
  'a cosy corner': 'The Warm Stool',
  'curious offerings': 'The Odd Keg',
  'reliable service': 'The Sure Pour',
  'goblin authenticity': 'The Goblin Hearth',
  'respectable manners': 'The Polished Tankard',
  'culinary renown': 'The Travellers’ Table',
}
export function identityEvidence(state: Pick<TavernState, 'modules'>): IdentityEvidenceState {
  const slice = state.modules.tavernIdentity as Partial<IdentityEvidenceState> | undefined
  return { evidence: slice?.evidence ?? {}, lastObservedDay: slice?.lastObservedDay ?? -1 }
}

/** Persistence at the label boundary, without smoothing any underlying meter. */
export function observeIdentity(
  state: TavernState, raw: { knownFor: string[]; atmosphere: string[] }, witnesses: number,
): { evidence: IdentityEvidenceState; knownFor: string[]; atmosphereTags: string[] } {
  const old = identityEvidence(state)
  const day = state.calendar.totalDaysElapsed
  if (old.lastObservedDay === day) return { evidence: old, knownFor: [...state.world.tavernIdentity.knownFor], atmosphereTags: [...state.world.tavernIdentity.atmosphereTags] }
  const next: Record<string, IdentityEvidence> = {}
  const output: { knownFor: string[]; atmosphereTags: string[] } = { knownFor: [], atmosphereTags: [] }
  for (const kind of ['knownFor', 'atmosphere'] as const) {
    const current = kind === 'knownFor' ? state.world.tavernIdentity.knownFor : state.world.tavernIdentity.atmosphereTags
    const candidates = [...new Set([...current, ...raw[kind], ...Object.values(old.evidence).filter(e => e.kind === kind).map(e => e.label)])]
    for (const label of candidates) {
      const key = `${kind}:${label}`
      const before = old.evidence[key]
      const supports = raw[kind].includes(label)
      const strength = Math.max(0, Math.min(7, (before?.strength ?? (current.includes(label) ? 4 : 0)) + (supports ? 2 : -1)))
      const publicDay = supports && witnesses >= 5
      const record: IdentityEvidence = {
        label, kind, strength,
        supportedDays: Math.min(365, (before?.supportedDays ?? 0) + (supports ? 1 : 0)),
        publicDays: Math.max(0, Math.min(30, (before?.publicDays ?? 0) + (publicDay ? 1 : -1))),
        witnesses: Math.max(0, Math.min(100000, (before?.witnesses ?? 0) + (publicDay ? witnesses : -5))),
        lastSupportedDay: supports ? day : before?.lastSupportedDay ?? day,
      }
      if (strength > 0 || day - record.lastSupportedDay < 14) next[key] = record
      // Initial computation preserves the existing day-one profile, but earns
      // no backdated public evidence. Later changes need sustained support.
      const established = current.includes(label) ? strength > IDENTITY_EXIT : strength >= IDENTITY_ENTER
      if (established || (old.lastObservedDay < 0 && supports)) {
        (kind === 'knownFor' ? output.knownFor : output.atmosphereTags).push(label)
      }
    }
  }
  if (old.lastObservedDay < 0) { output.knownFor = raw.knownFor; output.atmosphereTags = raw.atmosphere }
  output.knownFor = output.knownFor.slice(0, 3)
  output.atmosphereTags = output.atmosphereTags.slice(0, 5)
  const bounded = Object.entries(next).sort((a,b) => b[1].strength - a[1].strength || b[1].lastSupportedDay - a[1].lastSupportedDay || a[0].localeCompare(b[0])).slice(0, MAX_IDENTITY_EVIDENCE)
  return { ...output, evidence: { evidence: Object.fromEntries(bounded), lastObservedDay: day } }
}

/** The public reputation affects who comes; it is not another stored meter. */
export function identityTrafficModifier(state: TavernState, group: CustomerGroupState): { amount: number; notes: string[] } {
  const evidence = identityEvidence(state).evidence
  const established = (label: string) => state.world.tavernIdentity.knownFor.includes(label) && (evidence[`knownFor:${label}`]?.publicDays ?? 0) >= 3
  let amount = 0
  if (established('reliable service')) amount += 1
  if (established('cheap drinks') && group.priceSensitivity >= 50) amount += 1
  if (established('a rough edge')) amount += group.dangerTolerance >= 60 ? 2 : -2
  if (established('an unfussy floor')) amount += group.filthTolerance >= 60 ? 1 : -1
  if (established('a cosy corner') && group.dangerTolerance < 60) amount += 1
  amount = Math.max(-3, Math.min(3, amount))
  return { amount, notes: amount ? [`The house’s established identity ${amount > 0 ? 'drew' : 'deterred'} this crowd (${amount > 0 ? '+' : ''}${amount}).`] : [] }
}
