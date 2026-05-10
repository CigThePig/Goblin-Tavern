import { Registry } from './Registry'
import type { SimulationModule } from '../core/module'

export const moduleRegistry = new Registry<SimulationModule>()
