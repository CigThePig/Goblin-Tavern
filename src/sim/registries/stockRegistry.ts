import { Registry } from './Registry'

export type StockDefinition = {
  id: string
  label: string
  tags: string[]
}

export const stockRegistry = new Registry<StockDefinition>()
