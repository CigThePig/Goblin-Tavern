import { Registry } from './Registry'

export type CustomerGroupDefinition = {
  id: string
  label: string
  tags: string[]
}

export const customerRegistry = new Registry<CustomerGroupDefinition>()
