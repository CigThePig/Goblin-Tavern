// Phase 22 §"Naming Types" — type-only scaffolding for the expansion-arc
// naming system. Phase 22 defines the shapes; later phases (Phase 24
// generates names, Phase 31+ attaches them to staff and NPCs).

export type NamingProfileId = string

export type NamePartKind =
  | 'given'
  | 'family'
  | 'nickname'
  | 'title'
  | 'clan'
  | 'origin'

export type NamePattern = {
  id: string
  weight: number
  template: string
  partKinds: NamePartKind[]
  tags: string[]
}

export type NamingProfile = {
  id: NamingProfileId
  label: string
  tags: string[]
  given: string[]
  family?: string[]
  nicknames?: string[]
  titles?: string[]
  patterns: NamePattern[]
  syllables?: {
    starts: string[]
    middles?: string[]
    ends: string[]
  }
  reservedNames?: string[]
}

export type GeneratedName = {
  display: string
  profileId: NamingProfileId
  parts: Partial<Record<NamePartKind, string>>
  patternId: string
  generatedBy: string
}
