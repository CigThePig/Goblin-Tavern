import { Registry } from './Registry'

export type AreaDefinition = {
  id: string
  label: string
  tags: string[]
}

export const areaRegistry = new Registry<AreaDefinition>()
