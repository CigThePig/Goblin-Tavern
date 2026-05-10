import { Registry } from './Registry'

export type PressureDefinition = {
  id: string
  label: string
  tags: string[]
}

export const pressureRegistry = new Registry<PressureDefinition>()
