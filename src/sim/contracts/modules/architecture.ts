import type { SimulationModule } from '../../core/module'
import { SIMULATION_PHASES, type SimulationPhase } from '../../core/phases'
import { DAY_SEGMENTS, phasesForSegment } from '../../core/segments'

import {
  MODULE_CONTRACTS,
  foreignSliceWrites,
  ownedSlices,
  type ModuleContract,
} from './contracts'

// Expansion Phase 1 §1.7 — the architecture checks.
//
// Every function here is a pure analysis of the pipeline plus the declared
// contracts, returning a list of problems. That shape (rather than throwing,
// or asserting inline) is what lets the same checks run from a test, from a
// script, and eventually from a startup guard, with one implementation.

export type ArchitectureProblem = {
  code:
    | 'dependency_missing'
    | 'dependency_ordered_after'
    | 'duplicate_module_id'
    | 'slice_two_owners'
    | 'foreign_slice_write_unowned'
    | 'phase_dependency_missing'
    | 'phase_dependency_ordered_after'
    | 'segment_boundary_moved'
    | 'phase_not_partitioned'
    | 'contract_slice_never_declared'
  message: string
}

/**
 * `dependsOn` is only meaningful if the dependency actually runs first.
 * Nothing checked that before: a module could declare a dependency on one
 * listed after it and the engine would happily run them in the wrong order.
 */
export function checkModuleOrder(
  pipeline: ReadonlyArray<SimulationModule>,
): ArchitectureProblem[] {
  const problems: ArchitectureProblem[] = []
  const index = new Map<string, number>()
  for (const [i, mod] of pipeline.entries()) {
    if (index.has(mod.id)) {
      problems.push({
        code: 'duplicate_module_id',
        message: `Module id '${mod.id}' appears twice in the pipeline`,
      })
      continue
    }
    index.set(mod.id, i)
  }

  for (const [i, mod] of pipeline.entries()) {
    for (const dep of mod.dependsOn ?? []) {
      const depIndex = index.get(dep)
      if (depIndex === undefined) {
        problems.push({
          code: 'dependency_missing',
          message: `Module '${mod.id}' depends on '${dep}', which is not in the pipeline`,
        })
        continue
      }
      if (depIndex > i) {
        problems.push({
          code: 'dependency_ordered_after',
          message: `Module '${mod.id}' depends on '${dep}', but '${dep}' runs after it`,
        })
      }
    }
  }
  return problems
}

/**
 * Same-phase dependencies, which the coarse `dependsOn` cannot express.
 *
 * A module may legitimately need to run after another ONLY in one phase
 * (the scheduled-event wrap-up beat must follow `responses`). Declaring that
 * per-phase avoids over-constraining the pipeline order, but it has to be
 * checked, and the check has to notice both "the dependency has no hook in
 * that phase" and "it has one but runs later".
 */
export function checkPhaseDependencies(
  pipeline: ReadonlyArray<SimulationModule>,
): ArchitectureProblem[] {
  const problems: ArchitectureProblem[] = []
  const index = new Map(pipeline.map((mod, i) => [mod.id, i]))
  const byId = new Map(pipeline.map((mod) => [mod.id, mod]))

  for (const [moduleId, contract] of Object.entries(MODULE_CONTRACTS)) {
    const self = byId.get(moduleId)
    if (!self) continue
    for (const [phase, deps] of Object.entries(
      contract.phaseDependencies ?? {},
    ) as Array<[SimulationPhase, ReadonlyArray<string>]>) {
      const selfHasHook = (self.hooks?.[phase]?.length ?? 0) > 0
      if (!selfHasHook) continue
      for (const dep of deps) {
        const depModule = byId.get(dep)
        if (!depModule || (depModule.hooks?.[phase]?.length ?? 0) === 0) {
          problems.push({
            code: 'phase_dependency_missing',
            message: `Module '${moduleId}' requires '${dep}' to run before it in '${phase}', but '${dep}' has no hook there`,
          })
          continue
        }
        if ((index.get(dep) ?? -1) > (index.get(moduleId) ?? -1)) {
          problems.push({
            code: 'phase_dependency_ordered_after',
            message: `Module '${moduleId}' requires '${dep}' before it in '${phase}', but '${dep}' is later in the pipeline`,
          })
        }
      }
    }
  }
  return problems
}

/** One slice, one owner — and a foreign write only where an owner exists. */
export function checkSliceOwnership(): ArchitectureProblem[] {
  const problems: ArchitectureProblem[] = []
  for (const [sliceId, owners] of ownedSlices()) {
    if (owners.length > 1) {
      problems.push({
        code: 'slice_two_owners',
        message: `Slice '${sliceId}' is declared as owned by ${owners.join(', ')}`,
      })
    }
  }
  for (const write of foreignSliceWrites()) {
    if (!write.owner) {
      problems.push({
        code: 'foreign_slice_write_unowned',
        message: `Module '${write.moduleId}' writes slice '${write.sliceId}', which no module declares owning`,
      })
    }
  }
  return problems
}

/**
 * Segment boundaries are a locked contract
 * (`docs/plans/phase-186-day-clock-time-economy.md` §2): the day pauses at
 * exactly two seams, and adding a phase must not move them. This check is
 * what lets a later phase add a phase without silently changing where the
 * player is asked for input.
 */
export const EXPECTED_SEGMENT_FIRST_PHASES: Readonly<
  Record<'A' | 'B' | 'C', SimulationPhase>
> = {
  A: 'startDay',
  B: 'beforeOwnerActions',
  C: 'applyResponses',
}

export function checkSegmentBoundaries(): ArchitectureProblem[] {
  const problems: ArchitectureProblem[] = []
  for (const segment of DAY_SEGMENTS) {
    const phases = phasesForSegment(segment)
    const expected = EXPECTED_SEGMENT_FIRST_PHASES[segment]
    if (phases[0] !== expected) {
      problems.push({
        code: 'segment_boundary_moved',
        message: `Segment ${segment} now starts at '${phases[0]}', expected '${expected}'`,
      })
    }
  }

  // The three segments must still partition the pipeline exactly.
  const partitioned = DAY_SEGMENTS.flatMap((segment) => [
    ...phasesForSegment(segment),
  ])
  if (partitioned.length !== SIMULATION_PHASES.length) {
    problems.push({
      code: 'phase_not_partitioned',
      message: `Segments cover ${partitioned.length} phases but the pipeline has ${SIMULATION_PHASES.length}`,
    })
  }
  for (const [i, phase] of SIMULATION_PHASES.entries()) {
    if (partitioned[i] !== phase) {
      problems.push({
        code: 'phase_not_partitioned',
        message: `Segment partition diverges at index ${i}: '${partitioned[i]}' vs '${phase}'`,
      })
      break
    }
  }
  return problems
}

/** Declared slices must correspond to a real module id. */
export function checkContractCoverage(
  pipeline: ReadonlyArray<SimulationModule>,
): ArchitectureProblem[] {
  const ids = new Set(pipeline.map((mod) => mod.id))
  return Object.keys(MODULE_CONTRACTS)
    .filter((moduleId) => !ids.has(moduleId))
    .map((moduleId) => ({
      code: 'contract_slice_never_declared' as const,
      message: `A module contract is declared for '${moduleId}', which is not in the pipeline`,
    }))
}

export function runArchitectureChecks(
  pipeline: ReadonlyArray<SimulationModule>,
): ArchitectureProblem[] {
  return [
    ...checkModuleOrder(pipeline),
    ...checkPhaseDependencies(pipeline),
    ...checkSliceOwnership(),
    ...checkSegmentBoundaries(),
    ...checkContractCoverage(pipeline),
  ]
}

/** Modules with no declared contract yet. A number to drive down, not a failure. */
export function undeclaredModules(
  pipeline: ReadonlyArray<SimulationModule>,
): string[] {
  return pipeline
    .map((mod) => mod.id)
    .filter((id) => !(id in MODULE_CONTRACTS))
    .sort()
}

export type { ModuleContract }
