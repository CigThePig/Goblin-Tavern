# Simulation Story Layer Plan

This pass defines a translation layer, not a story pass.

## 1. Purpose

The surface layer exists to translate simulation facts into narrative facts. It must not invent plot, scripted campaign beats, or detached cutscenes. The simulation remains the source of truth; the surface layer reads issue seeds, pressures, causes, state diffs, resolved intents, memories, owner actions, and report projections, then names what those facts mean as sequence, cause, consequence, and memory.

## 2. Starting story direction

A future starting story should be a state-backed scenario. It should initialize a real tavern state, expose opening facts from that state, and let cards, reports, tavern log entries, detail sheets, onboarding, and intro prose consume the same facts.

It should not be an authored plot pasted over unrelated simulation state.

## 3. Future contract sketch

The future implementation should define a `StartingScenario` contract along these lines:

```ts
export type StartingScenario = {
  id: string
  title: string
  initialFacts: SurfaceFact[]
  initialStatePatch: Partial<TavernState>
  openingSeeds?: IssueSeed[]
  tutorialHooks?: Array<{
    id: string
    surfaceFactIds: string[]
    uiTarget?: string
  }>
}
```

Required fields:

- `id`: stable scenario id.
- `title`: player-facing scenario title.
- `initialFacts`: structured `SurfaceFact[]` explaining what is already true.
- `initialStatePatch`: the mechanical state changes that make those facts true.
- `openingSeeds`: optional state-backed issue seeds available at the start.
- `tutorialHooks`: optional onboarding prompts attached to facts or UI targets.

## 4. Intro text rule

Intro text should be generated from `initialFacts`, not written separately from the state patch. If the intro says the pantry is bare, the state patch must make stock low and the opening facts must cite that evidence.

## 5. Explicitly out of scope for this pass

- No starting scenario is implemented here.
- No scripted campaign is added.
- No family-specific authored story voice is added.
- No report rewrite is required; reports can carry the surface narrative in parallel.
- No tavern log, detail sheet, or onboarding consumer is required yet.
