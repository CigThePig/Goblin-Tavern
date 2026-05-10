import { Registry } from './Registry'

export type StaffRoleDefinition = {
  id: string
  label: string
  tags: string[]
}

export const staffRegistry = new Registry<StaffRoleDefinition>()
