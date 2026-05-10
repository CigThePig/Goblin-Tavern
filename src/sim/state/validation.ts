import type { z } from 'zod'
import type { SimulationModule } from '../core/module'
import { moduleRegistry } from '../registries/moduleRegistry'
import { buildTavernStateSchema } from './schemas'
import type { TavernState } from './TavernState'
import type { ValidationIssue } from './types'

// Phase 6 §6.2 / §6.3 — full-state validation.
//
// `validateState` throws on invalid state, `safeValidateState` is the
// non-throwing variant. Both compose the full state schema from currently
// registered simulation modules (§6.1.1). Unknown keys under
// `state.modules` with no registered schema surface as warnings rather
// than hard failures.

export type SafeValidateResult =
  | {
      success: true
      state: TavernState
      warnings: ValidationIssue[]
    }
  | {
      success: false
      errors: ValidationIssue[]
      warnings: ValidationIssue[]
    }

export type ValidateOptions = {
  modules?: ReadonlyArray<SimulationModule>
}

function resolveModules(
  options?: ValidateOptions,
): ReadonlyArray<SimulationModule> {
  return options?.modules ?? moduleRegistry.all()
}

function formatZodErrors(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((p) => String(p)).join('.'),
    message: issue.message,
    code: issue.code,
  }))
}

function detectModuleWarnings(
  state: unknown,
  modules: ReadonlyArray<SimulationModule>,
): ValidationIssue[] {
  if (state === null || typeof state !== 'object') return []
  const modulesField = (state as { modules?: unknown }).modules
  if (modulesField === null || typeof modulesField !== 'object') return []
  const registeredIds = new Set(
    modules.filter((m) => m.stateSchema).map((m) => m.id),
  )
  const warnings: ValidationIssue[] = []
  for (const key of Object.keys(modulesField as Record<string, unknown>)) {
    if (!registeredIds.has(key)) {
      warnings.push({
        path: `modules.${key}`,
        message: `Unknown module key '${key}' has no registered schema`,
        code: 'unknown_module_key',
      })
    }
  }
  return warnings
}

function formatErrorMessage(issues: ValidationIssue[]): string {
  const lines = issues.map((i) => `  ${i.path || '<root>'}: ${i.message}`)
  return ['Invalid tavern state:', ...lines].join('\n')
}

export function validateState(
  state: unknown,
  options?: ValidateOptions,
): TavernState {
  const modules = resolveModules(options)
  const schema = buildTavernStateSchema(modules)
  const result = schema.safeParse(state)
  if (!result.success) {
    const issues = formatZodErrors(result.error)
    throw new Error(formatErrorMessage(issues))
  }
  return result.data as unknown as TavernState
}

export function safeValidateState(
  state: unknown,
  options?: ValidateOptions,
): SafeValidateResult {
  const modules = resolveModules(options)
  const schema = buildTavernStateSchema(modules)
  const result = schema.safeParse(state)
  const warnings = detectModuleWarnings(state, modules)
  if (!result.success) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
      warnings,
    }
  }
  return {
    success: true,
    state: result.data as unknown as TavernState,
    warnings,
  }
}
