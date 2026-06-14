import type { SimulationModule } from '../../core/module'
export * from './types'
export * from './kernel'
export const kernelModule: SimulationModule = { id: 'kernel', version: '0.1.0' }
