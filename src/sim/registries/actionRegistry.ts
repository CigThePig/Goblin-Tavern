import { Registry } from './Registry'

export type OwnerActionDefinition = {
  id: string
  label: string
  tags: string[]
}

export const actionRegistry = new Registry<OwnerActionDefinition>()
