import { Registry } from './Registry'

export type IssueSeedFamilyDefinition = {
  id: string
  label: string
  tags: string[]
}

export const issueSeedRegistry = new Registry<IssueSeedFamilyDefinition>()
