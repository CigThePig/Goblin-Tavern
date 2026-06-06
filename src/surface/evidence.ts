import type {
  SurfaceEvidenceRef,
  SurfaceEvidenceSource,
  SurfaceFact,
  SurfaceFactKind,
} from './types'

export type SurfaceFactInput = {
  id: string
  kind: SurfaceFactKind
  readable: string
  evidence: SurfaceEvidenceRef[]
  salience: number
  toneTags?: string[]
  subject?: SurfaceFact['subject']
  target?: string
}

export function evidenceRef(
  source: SurfaceEvidenceSource,
  ref: Omit<SurfaceEvidenceRef, 'source'> = {},
): SurfaceEvidenceRef {
  return { source, ...ref }
}

export function createSurfaceFact(input: SurfaceFactInput): SurfaceFact | undefined {
  const readable = cleanReadable(input.readable)
  if (!readable || input.evidence.length === 0) return undefined
  const fact: SurfaceFact = {
    id: input.id,
    kind: input.kind,
    readable,
    evidence: input.evidence.map((ref) => ({ ...ref })),
    salience: clampSalience(input.salience),
    toneTags: [...new Set(input.toneTags ?? [])].sort(),
  }
  if (input.subject) fact.subject = { ...input.subject }
  if (input.target !== undefined) fact.target = input.target
  return fact
}

export function addSurfaceFact(facts: SurfaceFact[], input: SurfaceFactInput): void {
  const fact = createSurfaceFact(input)
  if (!fact) return
  facts.push(fact)
}

export function cleanReadable(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function canonicalReadable(value: string): string {
  return cleanReadable(value).toLowerCase().replace(/[.!?]+$/g, '')
}

export function dedupeSurfaceFacts(facts: SurfaceFact[]): SurfaceFact[] {
  const seen = new Set<string>()
  const out: SurfaceFact[] = []
  for (const fact of facts) {
    const key = `${fact.kind}:${canonicalReadable(fact.readable)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      ...fact,
      evidence: fact.evidence.map((ref) => ({ ...ref })),
      toneTags: [...fact.toneTags],
      ...(fact.subject ? { subject: { ...fact.subject } } : {}),
    })
  }
  return out
}

function clampSalience(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}
