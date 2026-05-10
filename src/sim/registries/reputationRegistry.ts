import { Registry } from './Registry'

export type ReputationAxisDefinition = {
  id: string
  label: string
  tags: string[]
}

export const reputationRegistry = new Registry<ReputationAxisDefinition>()
