// @vitest-environment jsdom
//
// Phase 196 / ISSUE-163 — Day dominance and cleanups (web).
//
// Covers the acceptance criteria:
//   1. The Day tab always carries the accent-emphasis class in BottomNav
//      (faded when inactive, full when active), distinct from the other
//      reference tabs.
//   2. The Day icon shows the unresolved-work dot when there are queued
//      picks or unresolved beat cards AND the player has navigated away
//      from Day; the dot retires once Day is active.
//   3. Quick Day reads as a `.primary` peer affordance, not a `.secondary`
//      italic footnote, when it is available.
//
// The dot's data source is the pure `gameStore.hasUnresolvedDayWork`
// getter, exercised directly first, then through the rendered BottomNav.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { default: BottomNav } = await import(
  '../../web/src/lib/components/BottomNav.svelte'
)

type SeedLite = {
  id: string
  timing: string
  validation: { valid: boolean }
}

/** Plant valid issue seeds into the module slot `todaysSeeds` reads. */
function plantSeeds(seeds: SeedLite[]): void {
  gameStore.state.modules['issueSeeds'] = { seedsToday: seeds }
}

/** Queue one owner-action pick (shape is forwarded verbatim to the engine). */
function queuePick(): void {
  gameStore.addPick({
    actionId: 'clean_area',
    label: 'Clean',
    category: 'operations' as never,
    targetType: 'area' as never,
    targetId: 'common_room',
    timeCost: 30,
  })
}

beforeEach(() => {
  gameStore.reset('phase196-seed')
  gameStore.setPicks([])
  gameStore.pendingBySeedId = {}
  plantSeeds([])
  gameStore.setBeat('morning')
})

afterEach(() => {
  cleanup()
})

// ─────────────────────── hasUnresolvedDayWork getter ────────────────────

describe('gameStore.hasUnresolvedDayWork (Phase 196)', () => {
  it('is false with no picks and no seeds', () => {
    expect(gameStore.hasUnresolvedDayWork).toBe(false)
  })

  it('is true when a pick is queued (cross-screen queue)', () => {
    queuePick()
    expect(gameStore.hasUnresolvedDayWork).toBe(true)
  })

  it('is true for an unresolved seed on the active beat', () => {
    plantSeeds([
      { id: 's-morn', timing: 'morning_prep', validation: { valid: true } },
    ])
    expect(gameStore.hasUnresolvedDayWork).toBe(true)
  })

  it('is false once that seed is resolved (recorded in pendingBySeedId)', () => {
    plantSeeds([
      { id: 's-morn', timing: 'morning_prep', validation: { valid: true } },
    ])
    gameStore.pendingBySeedId = { 's-morn': {} as never }
    expect(gameStore.hasUnresolvedDayWork).toBe(false)
  })

  it("ignores seeds whose timing isn't owned by the active beat", () => {
    // A during-service seed does not count while on the morning beat.
    plantSeeds([
      { id: 's-svc', timing: 'during_service', validation: { valid: true } },
    ])
    expect(gameStore.hasUnresolvedDayWork).toBe(false)
    gameStore.setBeat('service')
    expect(gameStore.hasUnresolvedDayWork).toBe(true)
  })

  it('ignores invalid seeds (never produced a card)', () => {
    plantSeeds([
      { id: 's-bad', timing: 'morning_prep', validation: { valid: false } },
    ])
    expect(gameStore.hasUnresolvedDayWork).toBe(false)
  })

  it('the plan beat has no card deck — only picks drive it', () => {
    gameStore.setBeat('plan')
    plantSeeds([
      { id: 's-morn', timing: 'morning_prep', validation: { valid: true } },
    ])
    expect(gameStore.hasUnresolvedDayWork).toBe(false)
    queuePick()
    expect(gameStore.hasUnresolvedDayWork).toBe(true)
  })
})

// ───────────────────────── BottomNav rendering ──────────────────────────

describe('BottomNav Day emphasis + work dot (Phase 196)', () => {
  it('the Day tab always carries the .day-tab emphasis class', async () => {
    const { container } = render(BottomNav, {
      props: { active: 'tavern', onnavigate: () => {} },
    })
    await tick()
    const dayTab = container.querySelector('.day-tab')
    expect(dayTab).not.toBeNull()
    expect(dayTab?.textContent).toContain('Day')
    // Exactly one tab gets the emphasis; the rest are plain reference tabs.
    expect(container.querySelectorAll('.day-tab').length).toBe(1)
    expect(container.querySelectorAll('.tab').length).toBe(5)
  })

  it('shows no work dot when there is nothing outstanding', async () => {
    const { container } = render(BottomNav, {
      props: { active: 'tavern', onnavigate: () => {} },
    })
    await tick()
    expect(container.querySelector('.work-dot')).toBeNull()
  })

  it('shows the work dot when away from Day with a queued pick', async () => {
    queuePick()
    const { container } = render(BottomNav, {
      props: { active: 'tavern', onnavigate: () => {} },
    })
    await tick()
    const dot = container.querySelector('.work-dot')
    expect(dot).not.toBeNull()
    // The dot anchors to the Day tab's icon, not another tab.
    expect(dot?.closest('.day-tab')).not.toBeNull()
  })

  it('shows the work dot for an unresolved morning card when away from Day', async () => {
    plantSeeds([
      { id: 's-morn', timing: 'morning_prep', validation: { valid: true } },
    ])
    const { container } = render(BottomNav, {
      props: { active: 'reports', onnavigate: () => {} },
    })
    await tick()
    expect(container.querySelector('.work-dot')).not.toBeNull()
  })

  it('retires the dot once the player is on the Day tab', async () => {
    queuePick()
    const { container } = render(BottomNav, {
      props: { active: 'day', onnavigate: () => {} },
    })
    await tick()
    expect(container.querySelector('.work-dot')).toBeNull()
  })
})

// ──────────────────────── Quick Day promotion ───────────────────────────

describe('Quick Day promotion to a peer affordance (Phase 196)', () => {
  it('the Quick Day button uses the .primary peer treatment, not .secondary', () => {
    const src = readFileSync(
      join(process.cwd(), 'web/src/lib/screens/DayScreen.svelte'),
      'utf8',
    )
    // The button onclick={runQuickDay} should carry `primary quick-day`,
    // and no longer the old `secondary quick-day` footnote class.
    expect(src).toContain('class="primary quick-day"')
    expect(src).not.toContain('class="secondary quick-day"')
    // The footnote styling (italic / dim) is gone from the .quick-day rule.
    const styleStart = src.indexOf('.quick-day {')
    const styleBlock = src.slice(styleStart, styleStart + 200)
    expect(styleBlock).not.toContain('font-style: italic')
  })
})
